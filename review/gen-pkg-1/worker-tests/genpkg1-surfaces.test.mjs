// gen-pkg-1 — the three read surfaces (brief §6 items 2–4; Rowan
// obligations 2, 4, 6).
//
//   * GET /v2/d6-plans (service.listPlans): stable keyset
//     pagination, settled amounts from the attempt ledger, binding
//     publication counts, and NO book text anywhere in the payload.
//   * GET /v2/generation/capabilities (service.capabilities): lane
//     admission from the pinned allowlist (Batch NOT admitted),
//     generation state from the halt flag, phase authority from the
//     ledger — and no invented budgets for unbudgeted phases.
//   * GET /v2/d6-eligibility (service.eligibilityQuote): the same
//     builder submitIntent executes, so the quote's eligible set
//     EQUALS the executed plan's eligible set — including the
//     parked Chapter 3 fence and voice_prompt exclusions.
//   * Empty-result paths run on the real harness, whose .one()
//     THROWS on empty results (production DO semantics): the
//     surfaces answer sane empties instead of throwing.
import test from "node:test";
import assert from "node:assert/strict";
import { makeHarness } from "./helpers/do-harness.mjs";
import { makeFakeR2Bucket, makeFakeD6Providers, sha256HexOf } from "./helpers/d6-fakes.mjs";
import { createGenStore } from "../worker/generation/genstore.mjs";
import { createGenerationService } from "../worker/generation/service.mjs";
import { createCoordinatorPlaneSource } from "../worker/generation/content-plane-adapter.mjs";
import { createD6Executor } from "../worker/generation/d6-executor.mjs";
import { createFlushStore } from "../worker/generation/flush-store.mjs";
import { createD6WorkSource } from "../worker/generation/d6-work-source.mjs";

const BOOK = "book-fp-mini";
const PARKED_JOB = "1832c21fcf0425454227c4736048a8a632f422abca4a2685ddb775bb1681406a";
const T = (id) => `Synthetic prose for segment ${id}, invented for the surfaces harness only.`;

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

function seedBook(h) {
  const seg = (occurrenceId, text) => ({ occurrenceId, text, pov: "pov-a" });
  const data = {
    chapters: [
      { chapterId: "ch-0", index: 0, segments: [seg("b0", T("b0")), seg("b1", T("b1"))] },
      { chapterId: "ch-1", index: 1, segments: [seg("e0", T("e0")), seg("e2", T("e2"))] },
      { chapterId: "ch-2", index: 2, segments: [seg("p0", T("p0")), seg("p1", T("p1")), seg("p3", T("p3"))] },
    ],
    povs: [{ id: "pov-a", name: "Aria", voice: { voice_id: "Zephyr", provider: "gemini", model_id: "gemini-3.8-flash-tts", style_direction: "warm" } }],
    defaultVoice: { provider: "gemini", voice_id: "Zephyr" },
  };
  h.db.prepare(`INSERT INTO sync_entities (family, entity_key, book_id, revision, deleted, data_json)
                VALUES ('content', ?, ?, 1, 0, ?)`).run(BOOK, BOOK, JSON.stringify(data));
  const bind = h.db.prepare(`INSERT INTO bindings (occurrence_id, revision_key, cache_key, provenance, bound_at)
                             VALUES (?, ?, ?, 'migration', 1)`);
  bind.run("b0", "legacy:aa", "a".repeat(64));
  bind.run("b1", "legacy:bb", "b".repeat(64));
  bind.run("p0", "legacy:pp", "c".repeat(64));
  const now = Date.now();
  h.db.prepare(`INSERT INTO jobs (job_id, kind, book_id, chapter_index, lane, state, revision, data_json, created_at, updated_at)
                VALUES (?, 'job', ?, 2, 'standard', 'parked_policy', 1, '{}', ?, ?)`).run(PARKED_JOB, BOOK, now, now);
  const occ = h.db.prepare(`INSERT INTO occurrences (job_id, occurrence_id, revision_key, state) VALUES (?, ?, ?, ?)`);
  occ.run(PARKED_JOB, "p0", "legacy:pp", "ready");
  occ.run(PARKED_JOB, "p1", "fp-p1", "pending");
}

async function makeWorld(extraEnv = {}) {
  const bucket = makeFakeR2Bucket();
  const flushStore = createFlushStore(bucket, { keyPrefix: "" });
  const probe = bridgeProbe(bucket, flushStore);
  const h = makeHarness({ probe, extraEnv });
  const store = createGenStore(h.coord);
  store.ensureSchema();
  seedBook(h);
  const sources = createCoordinatorPlaneSource(h.coord);
  const service = createGenerationService({
    coord: h.coord, env: { ...h.env, ...extraEnv }, store, sources });
  const providers = makeFakeD6Providers();
  const workSource = createD6WorkSource(h.coord, { cache: null });
  const exec = createD6Executor({ coord: h.coord, store, providers, flushStore, workSource, consumerId: "exec-surf" });
  return { bucket, flushStore, h, store, service, providers, exec };
}

test("empty store: surfaces answer sane empties under production .one() semantics", async () => {
  const h = makeHarness({});
  const store = createGenStore(h.coord);
  store.ensureSchema();
  const sources = createCoordinatorPlaneSource(h.coord);
  const service = createGenerationService({ coord: h.coord, env: h.env, store, sources });
  const list = service.listPlans({});
  assert.deepEqual(list.plans, []);
  assert.equal(list.nextCursor, null);
  const caps = service.capabilities();
  assert.equal(caps.generationState, "halted", "missing halt flag fails closed");
  assert.equal(caps.lanes.standard.admitted, true);
  assert.equal(caps.lanes.batch.admitted, false);
  assert.equal(caps.lanes.batch.reason, "batch_not_armed");
  assert.equal(caps.phases.length, 1, "only the one budgeted phase exists");
  assert.equal(caps.phases[0].phase, "forever-pucked");
  assert.equal(caps.phases[0].budgetMicroCents, 13_500_000);
  assert.equal(caps.phases[0].settledMicroCents, 0);
  assert.equal(caps.phases[0].remainingMicroCents, 13_500_000);
  assert.equal(caps.phases[0].bookId, null, "no plan yet: no invented book link");
  // Unknown book: the quote fails closed with the adapter's named
  // error rather than fabricating an empty set.
  await assert.rejects(
    () => service.eligibilityQuote({ bookId: "no-such-book", scope: "book" }),
    /d6_content_plane_book_missing/);
  const bad = await service.eligibilityQuote({ bookId: "x", scope: "nonsense" });
  assert.equal(bad.outcome, "rejected");
  assert.equal(bad.reason, "scope_invalid");
});

test("capabilities: generation state follows the halt flag", async () => {
  const w = await makeWorld({ GENERATION_HALT: "0" });
  assert.equal(w.service.capabilities().generationState, "enabled");
  const w2 = await makeWorld({ GENERATION_HALT: "1" });
  assert.equal(w2.service.capabilities().generationState, "halted");
});

test("eligibility quote equals the executed plan's eligible set (all scopes)", async () => {
  const w = await makeWorld();
  const { service } = w;
  const bookQuote = await service.eligibilityQuote({ bookId: BOOK, scope: "book" });
  assert.equal(bookQuote.advisory, true);
  assert.ok(Number.isSafeInteger(bookQuote.quotedAt) && bookQuote.quotedAt > 0);
  assert.equal(bookQuote.eligibleCount, 2);
  assert.deepEqual(bookQuote.exclusions, { bound_already: 3, voice_prompt: 0, parked: 2, other: 0 },
    "p0/b0/b1 bound; p1 parked-entry + p3 parked-chapter");
  const res = await service.submitIntent({
    commandId: "surf-int-1", bookId: BOOK, scope: "book", keepGoing: false,
    phase: "forever-pucked", lane: "standard",
  });
  const status = service.planStatus(res.planId);
  const planEligible = status.entries.filter(e => e.disposition === "eligible")
    .map(e => e.occurrenceId).sort();
  assert.deepEqual(planEligible, ["e0", "e2"]);
  assert.equal(bookQuote.totalChars,
    status.entries.filter(e => e.disposition === "eligible")
      .reduce((s, e) => s + e.charCount, 0), "quote chars == plan chars");
  // Chapter scope.
  const chQuote = await service.eligibilityQuote({ bookId: BOOK, scope: "chapter", chapterIndex: 1 });
  assert.equal(chQuote.eligibleCount, 2);
  assert.deepEqual(chQuote.exclusions, { bound_already: 0, voice_prompt: 0, parked: 0, other: 0 });
  // Segment scope on the parked chapter: fenced, never eligible.
  const segQuote = await service.eligibilityQuote({ bookId: BOOK, scope: "segment", occurrenceId: "p1" });
  assert.equal(segQuote.eligibleCount, 0);
  assert.equal(segQuote.exclusions.parked, 1);
  // Segment scope on a bound segment.
  const boundQuote = await service.eligibilityQuote({ bookId: BOOK, scope: "segment", occurrenceId: "b0" });
  assert.equal(boundQuote.eligibleCount, 0);
  assert.equal(boundQuote.exclusions.bound_already, 1);
  // Parked fingerprint semantics intact: the parked set is exactly
  // the parked job's chapter.
  const ch2Quote = await service.eligibilityQuote({ bookId: BOOK, scope: "chapter", chapterIndex: 2 });
  assert.equal(ch2Quote.eligibleCount, 0);
  assert.equal(ch2Quote.exclusions.parked, 2);
  assert.equal(ch2Quote.exclusions.bound_already, 1);
});

test("eligibility quote: voice_prompt exclusions for removed-provider casts", async () => {
  const bucket = makeFakeR2Bucket();
  const flushStore = createFlushStore(bucket, { keyPrefix: "" });
  const h = makeHarness({ probe: bridgeProbe(bucket, flushStore) });
  const store = createGenStore(h.coord);
  store.ensureSchema();
  const BOOK2 = "book-goal-mini";
  const data = {
    chapters: [{ chapterId: "g-0", index: 0, segments: [
      { occurrenceId: "g0", text: T("g0"), pov: "pov-s" },
      { occurrenceId: "g1", text: T("g1"), pov: "pov-t" },
      { occurrenceId: "g2", text: T("g2"), pov: "pov-a" },
    ] }],
    povs: [
      { id: "pov-s", name: "Sabrina", voice: { voice_id: "en-US-SaraNeural", provider: "azure", model_id: "azure-tts", style_direction: "" } },
      { id: "pov-t", name: "Tucker", voice: { voice_id: "tucker-voice", provider: "elevenlabs", model_id: "el-tts", style_direction: "" } },
      { id: "pov-a", name: "Aria", voice: { voice_id: "Zephyr", provider: "gemini", model_id: "gemini-3.8-flash-tts", style_direction: "" } },
    ],
    defaultVoice: { provider: "gemini", voice_id: "Zephyr" },
  };
  h.db.prepare(`INSERT INTO sync_entities (family, entity_key, book_id, revision, deleted, data_json)
                VALUES ('content', ?, ?, 1, 0, ?)`).run(BOOK2, BOOK2, JSON.stringify(data));
  const service = createGenerationService({
    coord: h.coord, env: h.env, store,
    sources: createCoordinatorPlaneSource(h.coord) });
  const quote = await service.eligibilityQuote({ bookId: BOOK2, scope: "book" });
  assert.equal(quote.eligibleCount, 1, "only the live-voice segment is eligible");
  assert.equal(quote.exclusions.voice_prompt, 2);
  // No cross-book leakage: the FP book's quote is unaffected.
  seedBook(h);
  const fpQuote = await service.eligibilityQuote({ bookId: BOOK, scope: "book" });
  assert.equal(fpQuote.eligibleCount, 2);
  assert.equal(fpQuote.exclusions.voice_prompt, 0);
});

test("plan list: pagination is stable, amounts are ledger-true, payload carries no text", async () => {
  const w = await makeWorld();
  const { h, service, exec } = w;
  // Chapter plan, driven to completion so the ledger settles.
  const ch = await service.submitIntent({
    commandId: "surf-ch", bookId: BOOK, scope: "chapter", chapterIndex: 1,
    phase: "forever-pucked", lane: "standard",
  });
  await service.driveOnce();
  await exec.handleMessage(h.sentGrants[h.sentGrants.length - 1]);
  await service.driveOnce();
  assert.equal(service.planStatus(ch.planId).state, "complete");
  // Two more plans (segment scopes; e0 is bound by now -> nothing
  // eligible; e2 likewise) — plan rows exist regardless.
  const s1 = await service.submitIntent({
    commandId: "surf-s1", bookId: BOOK, scope: "segment", occurrenceId: "e0",
    phase: "forever-pucked", lane: "standard",
  });
  const s2 = await service.submitIntent({
    commandId: "surf-s2", bookId: BOOK, scope: "segment", occurrenceId: "e2",
    phase: "forever-pucked", lane: "standard",
  });
  const page1 = service.listPlans({ limit: 2 });
  assert.equal(page1.plans.length, 2);
  assert.ok(page1.nextCursor, "more pages exist");
  const page2 = service.listPlans({ limit: 2, cursor: page1.nextCursor });
  assert.equal(page2.plans.length, 1);
  assert.equal(page2.nextCursor, null);
  const allIds = [...page1.plans, ...page2.plans].map(p => p.planId);
  assert.deepEqual(new Set(allIds), new Set([ch.planId, s1.planId, s2.planId]),
    "every plan exactly once across pages");
  // Ordering is (created_at, plan_id) descending — stable across a
  // repeat read even when several plans share a timestamp.
  const again = service.listPlans({ limit: 2 });
  assert.deepEqual(again.plans.map(p => p.planId), page1.plans.map(p => p.planId),
    "page 1 is deterministic across reads");
  const chapterSummary = [...page1.plans, ...page2.plans]
    .find(p => p.planId === ch.planId);
  assert.equal(chapterSummary.scope, "chapter");
  assert.equal(chapterSummary.chapterIndex, 1);
  assert.equal(chapterSummary.bookId, BOOK);
  assert.equal(chapterSummary.totals.done, 2);
  assert.equal(chapterSummary.bindingsPublished, 2, "both commits published by the projection");
  assert.equal(chapterSummary.bindingsPending, 0);
  // Settled amount equals the attempt ledger, recomputed directly.
  const ledger = h.db.prepare(
    `SELECT COALESCE(SUM(cost_micro_cents), 0) AS s FROM d6_attempt_log
      WHERE plan_id = ? AND phase = 'confirmed'
        AND outcome IN ('success', 'failed_known', 'policy_block')`).get(ch.planId);
  assert.ok(ledger.s > 0, "ledger settled > 0");
  assert.equal(chapterSummary.settledMicroCents, ledger.s);
  // Capabilities phase authority agrees with the same ledger.
  const caps = service.capabilities();
  const phase = caps.phases.find(p => p.phase === "forever-pucked");
  assert.equal(phase.settledMicroCents, w.store.phaseAccounting("forever-pucked").settledMicro);
  assert.equal(phase.remainingMicroCents,
    13_500_000 - phase.settledMicroCents - phase.inFlightUpperMicroCents);
  assert.equal(phase.bookId, BOOK);
  // No book text anywhere in any surface payload.
  const blob = JSON.stringify({ page1, page2, caps });
  assert.ok(!blob.includes("Synthetic prose"), "no segment text leaks");
  assert.ok(!/"(text|speechText)":/.test(blob), "no text fields at all");
  // Bounds: a huge limit is clamped, a junk cursor reads from the top.
  assert.equal(service.listPlans({ limit: 100000 }).plans.length, 3);
  assert.equal(service.listPlans({ cursor: "!!!not-a-cursor" }).plans.length, 3);
});
