// gen-pkg-1 round-2 corrections — R2-2 (Rowan round-2 source
// review, comment 6511950562).
//
// R2-2: B2's semantics-in-identity stops a different-semantics
// request from being SILENTLY handed the old plan, but on its
// own it lets two live plans own the same eligible occurrences —
// both grantable, both payable. The server-side ACTIVE
// OVERLAPPING-OCCURRENCE FENCE (service.mjs
// activeOverlapConflict) closes that at admission:
//
//   * after intent convergence (a byte-identical retry returns
//     its own plan and never fences itself), a NEW intent whose
//     eligible set overlaps any ACTIVE plan's eligible entries
//     for the same book is rejected as plan_overlap_conflict,
//     naming the existing plan and its immutable semantics
//     (lane, keepGoing, phase) — across keepGoing changes and
//     across scopes; a lane change meets the lane gate first
//     (documented ordering: lane → phase → convergence → fence);
//   * "active" = every state the driver can still grant against
//     without a fresh operator decision: 'active' and the
//     parked_* family (parks resume on their own in driveOnce);
//   * terminal plans do NOT fence — 'complete' / 'partial'
//     (and, since round 3, 'retired': the operator-cleared
//     terminal state). 'halted_unknown' FENCED-EXEMPT in round
//     2's design (a halt grants again only after a gated
//     reconciliation, so it "must not block a fresh intent");
//     ROUND 3 REVERSED THAT PREMISE — see the amendment note on
//     the halted test below and service.mjs: a halted plan now
//     fences until an explicit operator reconciliation +
//     retirement clears its ownership (R3-2, Rowan round-3
//     review, comment 6512804398);
//   * non-overlapping sets still admit (later runs over newly
//     eligible segments stay possible);
//   * the parked Ch 3 JOB (coordinator-level, parked_policy) is
//     untouched and unfenced: its occurrences never enter an
//     eligible set, and a fenced rejection changes none of its
//     rows (asserted byte-identical below);
//   * two racing different-semantics submissions over one set
//     create exactly ONE plan.
//
// Terminal/parked plan states are set directly by SQL where a
// test's subject is the fence itself: the fence's contract is
// over plan STATE, and the executor-driven paths that produce
// those states are proven by the D6/genpkg1 suites (the
// idempotency suite drives a real completion for its fence
// interplay).
import test from "node:test";
import assert from "node:assert/strict";
import { createGenStore } from "../worker/generation/genstore.mjs";
import { createGenerationService } from "../worker/generation/service.mjs";
import { createCoordinatorPlaneSource } from "../worker/generation/content-plane-adapter.mjs";
import { makeHarness } from "./helpers/do-harness.mjs";

const BOOK = "book-fence-mini";
const PARKED_JOB = "job-parked-fixture";
const T = (id) => `Synthetic prose for segment ${id}, invented for the overlap-fence harness only.`;

function bookData({ parked = false } = {}) {
  const seg = (occurrenceId, text) => ({ occurrenceId, text, pov: "pov-a" });
  const chapters = [
    { chapterId: "ch-1", index: 1, segments: [seg("e0", T("e0")), seg("e2", T("e2"))] },
    { chapterId: "ch-2", index: 2, segments: [seg("e3", T("e3")), seg("e4", T("e4"))] },
  ];
  if (parked)
    chapters.push({ chapterId: "ch-3", index: 3, segments: [seg("p0", T("p0")), seg("p1", T("p1"))] });
  return {
    chapters,
    povs: [{ id: "pov-a", name: "Aria", voice: { voice_id: "Zephyr", provider: "gemini", model_id: "gemini-3.8-flash-tts", style_direction: "warm" } }],
    defaultVoice: { provider: "gemini", voice_id: "Zephyr" },
  };
}

async function makeWorld(opts = {}) {
  const h = makeHarness({});
  const store = createGenStore(h.coord);
  store.ensureSchema();
  h.db.prepare(`INSERT INTO sync_entities (family, entity_key, book_id, revision, deleted, data_json)
                VALUES ('content', ?, ?, 1, 0, ?)`).run(BOOK, BOOK, JSON.stringify(bookData(opts)));
  if (opts.parked) {
    const now = h.now();
    h.db.prepare(`INSERT INTO jobs (job_id, kind, book_id, chapter_index, lane, state,
                    revision, data_json, created_at, updated_at)
                  VALUES (?, 'chapter', ?, 3, 'standard', 'parked_policy', 1, ?, ?, ?)`)
      .run(PARKED_JOB, BOOK, JSON.stringify({ carried: "migration" }), now, now);
    const ins = h.db.prepare(`INSERT INTO occurrences (job_id, occurrence_id, revision_key, state, cache_key)
                              VALUES (?, ?, ?, 'pending', NULL)`);
    ins.run(PARKED_JOB, "p0", "fp-p0");
    ins.run(PARKED_JOB, "p1", "fp-p1");
  }
  const sources = createCoordinatorPlaneSource(h.coord);
  const mkService = () => createGenerationService({ coord: h.coord, env: h.env, store, sources });
  return { h, store, mkService, service: mkService() };
}

function ledgerCounts(h) {
  return {
    plans: h.rows("d6_plans").length,
    ledger: h.rows("ledger_ops").length,
    attempts: h.rows("d6_attempt_log").length,
    grants: h.rows("grants").length,
  };
}

function setPlanState(h, planId, state, stopReason = null) {
  h.db.prepare(`UPDATE d6_plans SET state = ?, stop_reason = ? WHERE plan_id = ?`)
    .run(state, stopReason, planId);
}

const chapterIntent = (over = {}) => ({
  bookId: BOOK, scope: "chapter", chapterIndex: 1, keepGoing: false,
  phase: null, lane: "standard", ...over,
});

test("R2-2: a keepGoing change over the same set is fenced — the conflict names the existing plan's semantics", async () => {
  const w = await makeWorld();
  const a = await w.service.submitIntent({ commandId: "f-1", ...chapterIntent({ keepGoing: true }) });
  assert.equal(a.created, true);
  const before = ledgerCounts(w.h);
  const b = await w.service.submitIntent({ commandId: "f-2", ...chapterIntent({ keepGoing: false }) });
  assert.equal(b.outcome, "rejected");
  assert.equal(b.reason, "plan_overlap_conflict");
  assert.deepEqual(b.conflict, {
    planId: a.planId, bookId: BOOK, scope: "chapter",
    lane: "standard", keepGoing: true, phase: null, overlapCount: 2,
  }, "the rejection carries the EXISTING plan's immutable semantics, not the request's");
  assert.deepEqual(ledgerCounts(w.h), before, "a fenced rejection creates no plan and moves no ledger state");
});

test("R2-2: a byte-identical retry still converges — the fence never fires on convergence", async () => {
  const w = await makeWorld();
  const intent = chapterIntent({ keepGoing: true });
  const a = await w.service.submitIntent({ commandId: "f-3", ...intent });
  const retry = await w.service.submitIntent({ commandId: "f-4", ...intent });
  assert.equal(retry.planId, a.planId);
  assert.equal(retry.created, false);
  assert.equal(w.h.rows("d6_plans").length, 1);
});

test("R2-2: non-overlapping sets still admit; a later overlapping scope is fenced by whichever plan owns the segment", async () => {
  const w = await makeWorld();
  const ch1 = await w.service.submitIntent({ commandId: "f-5", ...chapterIntent() });
  assert.equal(ch1.created, true);
  // Chapter 2's segment e3 is in no plan yet: a segment run admits.
  const seg = await w.service.submitIntent({
    commandId: "f-6", bookId: BOOK, scope: "segment", occurrenceId: "e3",
    phase: null, lane: "standard",
  });
  assert.equal(seg.created, true, "a non-overlapping segment run is possible beside an active chapter plan");
  // Now a chapter-2 run overlaps the segment plan (e3) — fenced,
  // naming the SEGMENT plan.
  const ch2 = await w.service.submitIntent({
    commandId: "f-7", bookId: BOOK, scope: "chapter", chapterIndex: 2,
    keepGoing: false, phase: null, lane: "standard",
  });
  assert.equal(ch2.reason, "plan_overlap_conflict");
  assert.equal(ch2.conflict.planId, seg.planId);
  assert.equal(ch2.conflict.scope, "segment");
  assert.equal(ch2.conflict.overlapCount, 1);
  // Once both owners are terminal, the chapter run admits.
  setPlanState(w.h, ch1.planId, "complete");
  setPlanState(w.h, seg.planId, "complete");
  const ch2b = await w.service.submitIntent({
    commandId: "f-8", bookId: BOOK, scope: "chapter", chapterIndex: 2,
    keepGoing: false, phase: null, lane: "standard",
  });
  assert.equal(ch2b.created, true, "later runs over the same segments are possible once prior plans are terminal");
});

test("R2-2: a book-scope intent is fenced by an active chapter plan over a subset of its set", async () => {
  const w = await makeWorld();
  const ch1 = await w.service.submitIntent({ commandId: "f-9", ...chapterIntent() });
  assert.equal(ch1.created, true);
  const book = await w.service.submitIntent({
    commandId: "f-10", bookId: BOOK, scope: "book", keepGoing: true,
    phase: null, lane: "standard",
  });
  assert.equal(book.reason, "plan_overlap_conflict");
  assert.equal(book.conflict.planId, ch1.planId);
  assert.equal(book.conflict.overlapCount, 2, "the chapter's two eligible segments are inside the book set");
  assert.equal(w.h.rows("d6_plans").length, 1);
});

test("R2-2: a batch-shaped request meets the lane gate BEFORE the fence (documented ordering)", async () => {
  const w = await makeWorld();
  const a = await w.service.submitIntent({ commandId: "f-11", ...chapterIntent({ keepGoing: true }) });
  assert.equal(a.created, true);
  const batch = await w.service.submitIntent({ commandId: "f-12", ...chapterIntent({ lane: "batch" }) });
  assert.deepEqual(batch, { outcome: "rejected", reason: "lane_not_allowed" },
    "with an active overlapping standard plan, the batch request is still a lane rejection — the lane gate runs first");
  const w2 = await makeWorld();
  const batch2 = await w2.service.submitIntent({ commandId: "f-13", ...chapterIntent({ lane: "batch" }) });
  assert.deepEqual(batch2, { outcome: "rejected", reason: "lane_not_allowed" },
    "and with no plan at all, the same — the fence is never the lane answer");
  assert.equal(w.h.rows("d6_plans").length, 1);
  assert.equal(w2.h.rows("d6_plans").length, 0);
});

test("R2-2: terminal plans (complete, partial) do not fence", async () => {
  const w = await makeWorld();
  const a = await w.service.submitIntent({
    commandId: "f-14", bookId: BOOK, scope: "book", keepGoing: true, phase: null, lane: "standard",
  });
  assert.equal(a.created, true);
  setPlanState(w.h, a.planId, "complete");
  const b = await w.service.submitIntent({
    commandId: "f-15", bookId: BOOK, scope: "book", keepGoing: false, phase: null, lane: "standard",
  });
  assert.equal(b.created, true, "a completed plan leaves the set free for a different-semantics run");
  assert.notEqual(b.planId, a.planId);
  setPlanState(w.h, b.planId, "partial", "incomplete");
  const c = await w.service.submitIntent({ commandId: "f-16", ...chapterIntent() });
  assert.equal(c.created, true, "a partial plan leaves the set free too");
  assert.equal(w.h.rows("d6_plans").length, 3);
});

// AMENDED IN ROUND 3 — PREMISE REVERSED BY ROWAN'S R3-2.
// Round 2 asserted a halted_unknown plan does NOT fence ("it
// must not block a future fresh intent"). Rowan's round-3 review
// (comment 6512804398) held that a halted plan's unresolved
// occurrences must stay fenced until an explicit operator
// reconciliation + retirement clears ownership: otherwise a new
// paid plan can mint over the same occurrences while the halt's
// billing is still unresolved. This test now asserts the
// round-3 contract — the fresh intent is REJECTED as
// plan_overlap_conflict naming the halted plan — while keeping
// round 2's other half intact: the fence and the rejected intent
// never resume, alter, or grant against the halted plan (its row
// and jobs stay byte-identical). The full clearance lifecycle
// (real unknown-billing record → fence → reconcile → retire →
// admission) is proven in genpkg1-halted-fence.test.mjs.
test("R3-2 (amends R2-2): a halted_unknown plan FENCES a fresh intent — and is left byte-identical (never resumed)", async () => {
  const w = await makeWorld();
  const a = await w.service.submitIntent({
    commandId: "f-17", bookId: BOOK, scope: "book", keepGoing: true,
    phase: "forever-pucked", lane: "standard",
  });
  assert.equal(a.created, true);
  // The Ch 2 shape: the plan halted on unknown billing.
  setPlanState(w.h, a.planId, "halted_unknown", "phase_halted_unknown_billing");
  const haltedRow = JSON.stringify(w.h.rows("d6_plans").find(p => p.plan_id === a.planId));
  const haltedJobs = JSON.stringify(w.h.rows("d6_plan_jobs").filter(r => r.plan_id === a.planId));
  const b = await w.service.submitIntent({
    commandId: "f-18", bookId: BOOK, scope: "book", keepGoing: false,
    phase: "forever-pucked", lane: "standard",
  });
  assert.equal(b.outcome, "rejected");
  assert.equal(b.reason, "plan_overlap_conflict",
    "a halted_unknown plan fences its overlapping occurrences until operator clearance (R3-2)");
  assert.equal(b.conflict.planId, a.planId);
  assert.equal(b.conflict.phase, "forever-pucked");
  assert.equal(b.conflict.keepGoing, true);
  assert.equal(b.conflict.scope, "book");
  assert.equal(w.h.rows("d6_plans").length, 1, "no new plan was created over the halted plan's set");
  assert.equal(JSON.stringify(w.h.rows("d6_plans").find(p => p.plan_id === a.planId)), haltedRow,
    "the halted plan's row is byte-identical — the fence and the rejected intent never resume or alter it");
  assert.equal(JSON.stringify(w.h.rows("d6_plan_jobs").filter(r => r.plan_id === a.planId)), haltedJobs,
    "no new jobs were attached to the halted plan");
  assert.equal(w.h.rows("grants").filter(g => g.job_id.startsWith(a.planId)).length, 0,
    "no grant was issued for the halted plan");
});

test("R2-2: a parked plan (parked_quota) DOES fence — driveOnce resumes parks without a fresh decision", async () => {
  const w = await makeWorld();
  const a = await w.service.submitIntent({ commandId: "f-19", ...chapterIntent({ keepGoing: true }) });
  assert.equal(a.created, true);
  setPlanState(w.h, a.planId, "parked_quota", "quota_parked");
  const b = await w.service.submitIntent({ commandId: "f-20", ...chapterIntent({ keepGoing: false }) });
  assert.equal(b.reason, "plan_overlap_conflict");
  assert.equal(b.conflict.planId, a.planId);
  assert.equal(w.h.rows("d6_plans").length, 1);
});

test("R2-2: two racing different-semantics submissions over one set create exactly one plan", async () => {
  const w = await makeWorld();
  const [ra, rb] = await Promise.all([
    w.mkService().submitIntent({ commandId: "f-21", ...chapterIntent({ keepGoing: true }) }),
    w.mkService().submitIntent({ commandId: "f-22", ...chapterIntent({ keepGoing: false }) }),
  ]);
  const created = [ra, rb].filter(r => r.created === true);
  const fenced = [ra, rb].filter(r => r.reason === "plan_overlap_conflict");
  assert.equal(created.length, 1, "exactly one submission creates the plan");
  assert.equal(fenced.length, 1, "the other is fenced, not silently handed the winner's plan");
  assert.equal(fenced[0].conflict.planId, created[0].planId);
  assert.equal(w.h.rows("d6_plans").length, 1);
  assert.equal(w.h.rows("d6_plan_jobs").length, 1, "one job set — no double spend surface");
});

test("R2-2: the parked Ch 3 job is untouched by admission and by the fence; its segments never enter a plan", async () => {
  const w = await makeWorld({ parked: true });
  const parkedSlice = () => JSON.stringify({
    jobs: w.h.rows("jobs").filter(r => r.job_id === PARKED_JOB),
    occurrences: w.h.rows("occurrences").filter(r => r.job_id === PARKED_JOB),
    grants: w.h.rows("grants").filter(r => r.job_id === PARKED_JOB),
  });
  const before = parkedSlice();
  const a = await w.service.submitIntent({
    commandId: "f-23", bookId: BOOK, scope: "book", keepGoing: true, phase: null, lane: "standard",
  });
  assert.equal(a.created, true);
  const entries = w.h.rows("d6_plan_entries").filter(e => e.plan_id === a.planId);
  const parkedEntries = entries.filter(e => ["p0", "p1"].includes(e.occurrence_id));
  assert.deepEqual(parkedEntries.map(e => e.disposition), ["excluded_parked", "excluded_parked"],
    "the parked chapter's segments are fenced out of the eligible set by the builder, as before");
  assert.equal(entries.filter(e => e.disposition === "eligible").length, 4,
    "only the two live chapters are eligible");
  const b = await w.service.submitIntent({
    commandId: "f-24", bookId: BOOK, scope: "book", keepGoing: false, phase: null, lane: "standard",
  });
  assert.equal(b.reason, "plan_overlap_conflict", "the fence still governs the live chapters in a parked world");
  assert.equal(parkedSlice(), before,
    "the parked job, its occurrence rows, and its (zero) grants are byte-identical after an admission and a fenced rejection");
  assert.equal(w.h.rows("jobs").find(r => r.job_id === PARKED_JOB).state, "parked_policy",
    "the parked job was not resumed");
});
