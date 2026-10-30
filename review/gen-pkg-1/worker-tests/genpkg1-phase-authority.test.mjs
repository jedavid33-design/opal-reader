// gen-pkg-1 round-1 corrections — B1 + B2 (Rowan source review,
// comment 6511518715).
//
// B1: the phase a plan rides is SERVER authority. submitIntent
// derives/restricts it from authoritative book policy — the
// budgeted-phase registry (PHASE_BUDGET_MICRO_CENTS) plus the
// book's binding recorded in the server's own plan state — and
// rejects mismatched/missing/invented phases BEFORE any plan or
// ledger state moves. The caller's phase is a hint; a disagreement
// is a rejection, never a silent override.
//
// B2: intent identity covers the authoritative requested
// EXECUTION SEMANTICS (lane, keepGoing, server-derived phase)
// alongside the eligible set. Byte-identical retries still
// converge; a semantics change never silently returns a plan
// minted under different semantics.
//
// Lane note: the pinned allowlist admits only "standard" today,
// so a lane change is exercised as the explicit lane_not_allowed
// rejection — the old plan is never returned for a different-lane
// request (and once Batch is armed, lane sits inside the identity
// hash, so a differing lane mints its own plan the same way
// keepGoing does here).
//
// Round-2 amendment (Rowan comment 6511950562, R2-2): two tests
// below originally asserted that a semantics change MINTS a
// second plan while the first is still active over the same
// set. R2-2 supersedes that: the active overlapping-occurrence
// fence rejects the second submission while the first plan is
// active, and the distinct plan is minted once the first is
// terminal. The tests now assert exactly that sequence; their
// B1/B2 subject (binding establishment, identity distinction,
// convergence) is unchanged.
import test from "node:test";
import assert from "node:assert/strict";
import { makeHarness } from "./helpers/do-harness.mjs";
import { makeFakeR2Bucket, makeFakeD6Providers, sha256HexOf } from "./helpers/d6-fakes.mjs";
import { createGenStore } from "../worker/generation/genstore.mjs";
import { createGenerationService } from "../worker/generation/service.mjs";
import { createCoordinatorPlaneSource } from "../worker/generation/content-plane-adapter.mjs";
import { createFlushStore } from "../worker/generation/flush-store.mjs";

const BOOK = "book-fp-mini";
const GOAL = "book-goal-mini";
const T = (id) => `Synthetic prose for segment ${id}, invented for the phase-authority harness only.`;

function bridgeProbe(bucket, flushStore) {
  const find = (cacheKey) => {
    for (const ext of ["wav", "mp3"]) {
      const key = flushStore.objectKeyFor(cacheKey, ext);
      const e = bucket.store.get(key);
      if (e) return { key, ...e };
    }
    return null;
  };
  return {
    exists: (k) => !!find(k),
    sniff: (k) => { const e = find(k); return e ? (e.key.endsWith(".mp3") ? "mp3" : "wav") : null; },
    recordedIdentity: (k) => { const e = find(k); return e ? (e.customMetadata?.identity ?? null) : null; },
    hash: (k) => { const e = find(k); return e ? sha256HexOf(e.bytes) : null; },
    recordedSha256: (k) => { const e = find(k); return e ? (e.customMetadata?.sha256 ?? null) : null; },
    keyFor: () => null,
  };
}

function fpBookData() {
  const seg = (occurrenceId, text) => ({ occurrenceId, text, pov: "pov-a" });
  return {
    chapters: [
      { chapterId: "ch-1", index: 1, segments: [seg("e0", T("e0")), seg("e2", T("e2"))] },
    ],
    povs: [{ id: "pov-a", name: "Aria", voice: { voice_id: "Zephyr", provider: "gemini", model_id: "gemini-3.8-flash-tts", style_direction: "warm" } }],
    defaultVoice: { provider: "gemini", voice_id: "Zephyr" },
  };
}

async function makeWorld(bookData, bookId = BOOK) {
  const bucket = makeFakeR2Bucket();
  const flushStore = createFlushStore(bucket, { keyPrefix: "" });
  const probe = bridgeProbe(bucket, flushStore);
  const h = makeHarness({ probe });
  const store = createGenStore(h.coord);
  store.ensureSchema();
  h.db.prepare(`INSERT INTO sync_entities (family, entity_key, book_id, revision, deleted, data_json)
                VALUES ('content', ?, ?, 1, 0, ?)`).run(bookId, bookId, JSON.stringify(bookData));
  const sources = createCoordinatorPlaneSource(h.coord);
  const mkService = () => createGenerationService({ coord: h.coord, env: h.env, store, sources });
  return { bucket, flushStore, h, store, mkService, service: mkService() };
}

function ledgerCounts(h) {
  return {
    plans: h.rows("d6_plans").length,
    ledger: h.rows("ledger_ops").length,
    attempts: h.rows("d6_attempt_log").length,
    grants: h.rows("grants").length,
  };
}

// Bind BOOK to the forever-pucked phase with one legitimate
// submission; returns the created plan's id.
async function bindForeverPucked(w) {
  const r = await w.service.submitIntent({
    commandId: "bind-1", bookId: BOOK, scope: "chapter", chapterIndex: 1,
    phase: "forever-pucked", lane: "standard",
  });
  assert.equal(r.created, true, "the binding submission creates its plan");
  const row = w.h.rows("d6_plans").find(p => p.plan_id === r.planId);
  assert.equal(row.phase, "forever-pucked", "the plan stores the server-admitted phase");
  return r.planId;
}

test("B1: budgeted book — missing/null phase is rejected, nothing is created, no ledger movement", async () => {
  const w = await makeWorld(fpBookData());
  await bindForeverPucked(w);
  const before = ledgerCounts(w.h);
  const omitted = await w.service.submitIntent({
    commandId: "atk-omit", bookId: BOOK, scope: "book", keepGoing: true, lane: "standard",
  });
  assert.deepEqual(omitted, { outcome: "rejected", reason: "phase_required" });
  const explicitNull = await w.service.submitIntent({
    commandId: "atk-null", bookId: BOOK, scope: "book", keepGoing: true,
    phase: null, lane: "standard",
  });
  assert.deepEqual(explicitNull, { outcome: "rejected", reason: "phase_required" });
  assert.deepEqual(ledgerCounts(w.h), before,
    "a phase rejection creates no plan and moves no ledger/attempt/grant state");
});

test("B1: budgeted book — a wrong phase string is rejected (phase_mismatch)", async () => {
  const w = await makeWorld(fpBookData());
  await bindForeverPucked(w);
  const before = ledgerCounts(w.h);
  const wrong = await w.service.submitIntent({
    commandId: "atk-wrong", bookId: BOOK, scope: "chapter", chapterIndex: 1,
    phase: "some-other-phase", lane: "standard",
  });
  assert.deepEqual(wrong, { outcome: "rejected", reason: "phase_mismatch" });
  assert.deepEqual(ledgerCounts(w.h), before, "no plan, no ledger movement");
});

test("B1: budgeted book — the correct phase is admitted and converges on the existing plan", async () => {
  const w = await makeWorld(fpBookData());
  const planId = await bindForeverPucked(w);
  const again = await w.service.submitIntent({
    commandId: "ok-2", bookId: BOOK, scope: "chapter", chapterIndex: 1,
    phase: "forever-pucked", lane: "standard",
  });
  assert.equal(again.planId, planId);
  assert.equal(again.created, false);
  assert.equal(w.h.rows("d6_plans").length, 1);
});

test("B1: unbudgeted book — no phase is admitted; an invented phase is rejected", async () => {
  const w = await makeWorld(fpBookData(), GOAL);
  const ok = await w.service.submitIntent({
    commandId: "goal-1", bookId: GOAL, scope: "book", keepGoing: true,
    phase: null, lane: "standard",
  });
  assert.equal(ok.created, true);
  const row = w.h.rows("d6_plans").find(p => p.plan_id === ok.planId);
  assert.equal(row.phase, null, "an unbudgeted plan stores phase null");

  const w2 = await makeWorld(fpBookData(), GOAL);
  const invented = await w2.service.submitIntent({
    commandId: "goal-2", bookId: GOAL, scope: "book", keepGoing: true,
    phase: "my-invented-phase", lane: "standard",
  });
  assert.deepEqual(invented, { outcome: "rejected", reason: "phase_not_budgeted" });
  assert.equal(w2.h.rows("d6_plans").length, 0, "an invented phase creates nothing");
});

test("B1+B2: a registry phase establishes the book's binding; afterwards the book is budgeted", async () => {
  const w = await makeWorld(fpBookData());
  // First run unbudgeted (phase null): its own plan, phase null.
  const a = await w.service.submitIntent({
    commandId: "est-1", bookId: BOOK, scope: "book", keepGoing: true,
    phase: null, lane: "standard",
  });
  assert.equal(a.created, true);
  // Round 2 (R2-2): while plan A is ACTIVE, the same-set phase
  // run is fenced — two live plans must never own the same
  // eligible occurrences. The binding-establishment sequence
  // therefore completes A first (its state set directly here;
  // the fence's contract is over plan state, and the driven
  // completion path is proven in the fence + idempotency
  // suites).
  const fenced = await w.service.submitIntent({
    commandId: "est-2a", bookId: BOOK, scope: "book", keepGoing: true,
    phase: "forever-pucked", lane: "standard",
  });
  assert.equal(fenced.reason, "plan_overlap_conflict",
    "round 2: an active plan fences the same set regardless of the phase change");
  assert.equal(fenced.conflict.planId, a.planId);
  w.h.db.prepare(`UPDATE d6_plans SET state = 'complete' WHERE plan_id = ?`).run(a.planId);
  // Same set, now under the registry phase: a DISTINCT plan (the
  // phase is inside intent identity), and it binds the book.
  const b = await w.service.submitIntent({
    commandId: "est-2", bookId: BOOK, scope: "book", keepGoing: true,
    phase: "forever-pucked", lane: "standard",
  });
  assert.equal(b.created, true);
  assert.notEqual(b.planId, a.planId, "changing only the phase mints a distinct plan");
  assert.equal(w.h.rows("d6_plans").find(p => p.plan_id === b.planId).phase, "forever-pucked");
  // The book is budgeted now: a later null-phase submission is
  // rejected instead of minting another unbudgeted plan.
  const c = await w.service.submitIntent({
    commandId: "est-3", bookId: BOOK, scope: "book", keepGoing: true,
    phase: null, lane: "standard",
  });
  assert.deepEqual(c, { outcome: "rejected", reason: "phase_required" });
  assert.equal(w.h.rows("d6_plans").length, 2);
});

test("B2: changing only keepGoing at book scope is a distinct intent — fenced while the first plan is active (R2-2), minted once it is terminal", async () => {
  const w = await makeWorld(fpBookData());
  const base = { bookId: BOOK, scope: "book", phase: "forever-pucked", lane: "standard" };
  const a = await w.service.submitIntent({ commandId: "kg-1", ...base, keepGoing: true });
  assert.equal(a.created, true);
  // Round 1 asserted this second submission MINTS its own plan.
  // Round 2 (R2-2) supersedes that while plan A is active: a
  // distinct intent, yes — but creating it would put two live
  // plans over the same eligible set, so admission rejects it
  // with the conflict naming plan A's semantics.
  const fenced = await w.service.submitIntent({ commandId: "kg-2a", ...base, keepGoing: false });
  assert.equal(fenced.outcome, "rejected");
  assert.equal(fenced.reason, "plan_overlap_conflict");
  assert.equal(fenced.conflict.planId, a.planId);
  assert.equal(fenced.conflict.keepGoing, true, "the conflict names the EXISTING plan's keepGoing");
  assert.equal(w.h.rows("d6_plans").length, 1, "no second live plan over the same set");
  // Once plan A is terminal, the different-semantics intent
  // mints its own plan exactly as B2 requires.
  w.h.db.prepare(`UPDATE d6_plans SET state = 'complete' WHERE plan_id = ?`).run(a.planId);
  const b = await w.service.submitIntent({ commandId: "kg-2", ...base, keepGoing: false });
  assert.equal(b.created, true, "a keepGoing change is a different intent, not the old plan");
  assert.notEqual(b.planId, a.planId);
  const rows = w.h.rows("d6_plans");
  assert.equal(rows.length, 2);
  assert.equal(rows.find(p => p.plan_id === a.planId).keep_going, 1);
  assert.equal(rows.find(p => p.plan_id === b.planId).keep_going, 0);
  const retry = await w.service.submitIntent({ commandId: "kg-3", ...base, keepGoing: true });
  assert.equal(retry.planId, a.planId, "a byte-identical retry still converges");
  assert.equal(retry.created, false);
  assert.equal(w.h.rows("d6_plans").length, 2, "no third plan");
});

test("B2: a different-lane request never returns the existing plan (explicit rejection today)", async () => {
  const w = await makeWorld(fpBookData());
  const a = await w.service.submitIntent({
    commandId: "ln-1", bookId: BOOK, scope: "book", keepGoing: true,
    phase: "forever-pucked", lane: "standard",
  });
  assert.equal(a.created, true);
  const b = await w.service.submitIntent({
    commandId: "ln-2", bookId: BOOK, scope: "book", keepGoing: true,
    phase: "forever-pucked", lane: "batch",
  });
  assert.deepEqual(b, { outcome: "rejected", reason: "lane_not_allowed" },
    "the batch request is explicitly rejected, never handed the standard plan");
  assert.equal(w.h.rows("d6_plans").length, 1);
});

test("B2: concurrent identical submissions with full semantics converge on one plan", async () => {
  const w = await makeWorld(fpBookData());
  const intent = { bookId: BOOK, scope: "book", keepGoing: true,
                   phase: "forever-pucked", lane: "standard" };
  const [ra, rb] = await Promise.all([
    w.mkService().submitIntent({ commandId: "cc-a", ...intent }),
    w.mkService().submitIntent({ commandId: "cc-b", ...intent }),
  ]);
  assert.equal(ra.planId, rb.planId);
  assert.equal([ra.created, rb.created].filter(Boolean).length, 1);
  assert.equal(w.h.rows("d6_plans").length, 1);
  assert.equal(w.h.rows("d6_plan_jobs").length, 1);
});
