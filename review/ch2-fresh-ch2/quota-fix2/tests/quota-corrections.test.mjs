// D6 QUOTA GUARD — corrections suite for Rowan's SOURCE HOLD
// (roundtable issue #15, comment 6545387295) on the quota
// implementation. Three corrections, each with its required
// proof:
//
//   Correction 1 — cohort-bounded grants: an 18-fresh-segment
//     job (216 worst-case slots) is no longer refused forever;
//     a grant covers a bounded prefix cohort, the remainder
//     stays pending on the same job, and subsequent authorized
//     grants progress the same job to completion.
//   Correction 2 — disposition day validation: an assigned day
//     outside the row's evidenced [created_at, updated_at] PT
//     interval is refused and changes NOTHING; invalid calendar
//     dates are refused; the disposition record preserves the
//     authorization/source/basis incl. the evidence interval.
//     REVISED by re-review hold B (Rowan 6545597263): a
//     MULTI-DAY interval proves possible days, not the real
//     one, so ANY day assignment for a straddler is now refused
//     (quota_disposition_ambiguous_interval) and its block
//     expires naturally with time; the disposition path remains
//     only for SAME-DAY intervals, whose day is provable. The
//     C3 over-cap fixture accordingly uses provably same-day
//     unstamped floor-build calls. (Hold A's 101-occurrence
//     proofs live in tests/quota-rereview.test.mjs.)
//   Correction 3 — reconciliation truth + day-wide cap:
//     reconcileQuota.ok means genuinely safe to rearm; a
//     post-disposition over-cap day is under a named hold and
//     ZERO additional provider calls proceed on it.
//
// All deterministic: harness-injected clock, fake bucket and
// fake providers, ZERO real provider calls. Synthetic fixtures
// only. These tests prove the guard's behavior; they are NOT
// verification of any real provider limit (the cap is the
// app-selected Reader policy constant, 100).
//
// Run: node --test tests/quota-corrections.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { makeHarness, makeProbe, occ, submit } from "./helpers/do-harness.mjs";
import { createGenStore } from "../worker/generation/genstore.mjs";
import {
  makeFakeR2Bucket, makeFakeD6Providers, sha256HexOf, syntheticWav,
} from "./helpers/d6-fakes.mjs";
import { createFlushStore } from "../worker/generation/flush-store.mjs";
import { createD6Executor } from "../worker/generation/d6-executor.mjs";
import { createD6WorkSource } from "../worker/generation/d6-work-source.mjs";
import { fingerprintFor } from "../worker/executor.mjs";
import {
  bootstrapQuota, disposeBootstrapException, reconcileQuota,
  derivedDayTotals, quotaBudgetView, ptDayKey, QUOTA_REFUSALS,
} from "../worker/generation/quota-budget.mjs";

const PLAN = "plan-q";
const PHASE = "forever-pucked";
const BOOK = "book-1";

// ---- store-level helpers (mirroring quota-budget.test.mjs) ----
function setupStore({ startMs } = {}) {
  const h = makeHarness({ probe: makeProbe(new Map()),
                          ...(startMs ? { startMs } : {}),
                          extraEnv: { d6StandardOnly: true } });
  const store = createGenStore(h.coord);
  store.ensureSchema();
  return { h, store };
}
function insertPlan(h, planId = PLAN) {
  const t = h.now();
  h.db.prepare(`INSERT OR IGNORE INTO d6_plans (plan_id, intent_key, book_id, scope, keep_going,
                  phase, lane, state, created_at, updated_at)
                VALUES (?, ?, 'book-1', 'book', 1, ?, 'standard', 'active', ?, ?)`)
    .run(planId, "intent-" + planId, PHASE, t, t);
}
function linkJob(h, jobId, planId = PLAN) {
  h.db.prepare(`INSERT INTO d6_plan_jobs (plan_id, job_id, chapter_index, seq)
                VALUES (?, ?, 0, 0)`).run(planId, jobId);
}
async function grantJob(h, jobId, occIds, planId = PLAN) {
  insertPlan(h, planId);
  await submit(h.coord, "cmd-" + jobId, jobId, occIds.map(id => occ(id)));
  linkJob(h, jobId, planId);
  return h.coord.requestGrant(jobId);
}
function seedAttempt(h, { attId, execId, planId = PLAN, occId, phase, outcome = null,
                          cost = null, created, updated, grantId }) {
  h.db.prepare(`INSERT INTO d6_execution_records
      (execution_id, plan_id, job_id, occurrence_id, grant_id, state, created_at, updated_at)
    VALUES (?, ?, 'job-hist', ?, ?, 'attempted', ?, ?)`)
    .run(execId, planId, occId, grantId, created, updated);
  h.db.prepare(`INSERT INTO d6_attempt_log
      (attempt_id, execution_id, plan_id, occurrence_id, seq, phase, outcome,
       cost_micro_cents, upper_micro_cents, provider_request_id, detail_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, 1, ?, ?, ?, 100, NULL, NULL, ?, ?)`)
    .run(attId, execId, planId, occId, phase, outcome, cost, created, updated);
}
const reservations = (h) => h.rows("d6_grant_reservations");
const dispatches = (h) => h.rows("d6_provider_dispatches");
const attempts = (h) => h.rows("d6_attempt_log");
const today = (h) => ptDayKey(h.now());
const segIds = (n, prefix = "s") =>
  Array.from({ length: n }, (_, i) => `${prefix}${String(i + 1).padStart(2, "0")}`);

// ==================================================================
// CORRECTION 1 — store legs: the cohort is bounded by the day's
// prior commitments, and an unfundable first occurrence refuses
// the whole grant cleanly (no zero-target grant, no partials).
test("C1 store: cohort shrinks with prior commitments; the job's ordered set and plan identity are untouched", async () => {
  const { h } = setupStore();
  bootstrapQuota(h.coord);
  const gFill = await grantJob(h, "job-fill", ["f1", "f2", "f3", "f4", "f5"]); // 60 slots
  assert.equal(gFill.ok, true);
  const ids = segIds(18); // the Gate-8 chapter shape: 18 fresh segments, 216 slots worst case
  const g = await grantJob(h, "job-big", ids);
  assert.equal(g.ok, true, "the 18-segment job is grantable at last");
  assert.equal(g.count, 3, "60 committed + 3x12 = 96 <= 100; a 4th would reach 108");
  const occs = h.rows("occurrences").filter(o => o.job_id === "job-big");
  assert.equal(occs.length, 18, "the job's complete occurrence set is preserved");
  assert.deepEqual(occs.filter(o => o.state === "granted").map(o => o.occurrence_id), ids.slice(0, 3),
    "the cohort is the ordered prefix — nothing skipped, nothing reordered");
  assert.deepEqual(occs.filter(o => o.state === "pending").map(o => o.occurrence_id), ids.slice(3),
    "the remainder stays pending on the same job");
  assert.equal(reservations(h).filter(r => r.grant_id === g.grantId).length, 3,
    "every granted occurrence holds a full worst-case reservation (no under-reservation)");
  assert.ok(reservations(h).filter(r => r.grant_id === g.grantId)
    .every(r => r.slots_total === 12 && r.state === "open"));
  const plan = h.rows("d6_plans").find(p => p.plan_id === PLAN);
  assert.equal(plan.intent_key, "intent-" + PLAN, "plan/intent identity unaltered");
  assert.equal(h.rows("d6_plan_jobs").filter(j => j.job_id === "job-big").length, 1);
  assert.deepEqual(derivedDayTotals(h.coord, today(h)),
    { dayKey: today(h), dispatched: 0, reserved: 96, consumed: 96 });
});

test("C1 store: a day that cannot fund even one fresh occurrence refuses the grant whole — no partials, no spin", async () => {
  const { h } = setupStore();
  bootstrapQuota(h.coord);
  const gFill = await grantJob(h, "job-fill", segIds(8, "f")); // 96 of 100
  assert.equal(gFill.ok, true);
  const g = await grantJob(h, "job-late", ["x1", "x2"]);
  assert.equal(g.ok, false);
  assert.equal(g.reason, QUOTA_REFUSALS.BUDGET,
    "headroom 4 < 12: the ordinary budget refusal (the day is NOT over limit)");
  assert.equal(h.rows("grants").filter(r => r.job_id === "job-late").length, 0);
  assert.equal(reservations(h).filter(r => r.grant_id.includes("job-late")).length, 0);
  assert.ok(h.rows("occurrences").filter(o => o.job_id === "job-late")
    .every(o => o.state === "pending"), "nothing was granted, skipped, or dropped");
  assert.equal(derivedDayTotals(h.coord, today(h)).consumed, 96, "totals untouched by the refusal");
});

// ---- executor-level world (mirroring quota-executor.test.mjs) ----
const payloadFor = (text) => ({
  text, voice: "Zephyr", provider: "gemini", model: "gemini-3.8-flash-tts",
  styleDirection: "warm", mode: "standard",
});
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
function seedContent(h, segments, planId = PLAN) {
  const data = {
    chapters: [{ chapterId: "ch-1", segments: segments.map((s) => ({
      occurrenceId: s.occurrenceId, text: s.text, pov: "pov-a" })) }],
    povs: [{ id: "pov-a", name: "Aria",
             voice: { voice_id: "Zephyr", provider: "gemini", model_id: "gemini-3.8-flash-tts", style_direction: "warm" } }],
  };
  h.db.prepare(`INSERT INTO sync_entities (family, entity_key, book_id, revision, deleted, data_json)
                VALUES ('content', ?, ?, 1, 0, ?)`).run(BOOK, BOOK, JSON.stringify(data));
  h.db.prepare(`INSERT OR IGNORE INTO d6_plans (plan_id, intent_key, book_id, scope, keep_going, phase, lane, state, created_at, updated_at)
                VALUES (?, ?, ?, 'book', 1, ?, 'standard', 'active', 0, 0)`)
    .run(planId, `intent-${planId}`, BOOK, PHASE);
}
async function submitJob(h, jobId, segments, planId = PLAN) {
  const occs = segments.map((s) => ({
    occurrenceId: s.occurrenceId, revisionKey: fingerprintFor(payloadFor(s.text)), estMicroCents: 1000,
  }));
  await h.coord.handleCommand({
    command_id: `cmd-${jobId}`, type: "SubmitJob",
    payload: { jobId, bookId: BOOK, chapterIndex: 0, lane: "standard", occurrences: occs,
               data: { estMicroCents: 1000, d6PlanId: planId } },
  });
  h.db.prepare(`INSERT OR IGNORE INTO d6_plan_jobs (plan_id, job_id, chapter_index, seq)
                VALUES (?, ?, 0, 0)`).run(planId, jobId);
}
function makeExecWorld({ startMs } = {}) {
  const bucket = makeFakeR2Bucket();
  const flushStore = createFlushStore(bucket, { keyPrefix: "" });
  const probe = bridgeProbe(bucket, flushStore);
  const h = makeHarness({ probe, ...(startMs ? { startMs } : {}),
                          extraEnv: { d6StandardOnly: true } });
  const store = createGenStore(h.coord);
  store.ensureSchema();
  const providers = makeFakeD6Providers();
  const workSource = createD6WorkSource(h.coord, { cache: null });
  const exec = createD6Executor({ coord: h.coord, store, providers, flushStore, workSource, consumerId: "exec-A" });
  return { bucket, h, store, providers, exec };
}
async function drainJobMessage(h, jobId) {
  let msg = null;
  await h.coord.drainOutbox((p) => { if (p.jobId === jobId) msg = p; });
  return msg;
}

// ==================================================================
// CORRECTION 1 — the regression: 18 eligible fresh occurrences.
// One bounded grant runs; the remainder stays pending; subsequent
// authorized grants progress the SAME job to completion without
// widening generation scope.
test("C1 regression: 18 fresh segments complete through three bounded grants of the same job", async () => {
  const JOB = "job-ch18";
  const ids = segIds(18);
  const segments = ids.map((id) => ({
    occurrenceId: id, text: `Synthetic chapter segment ${id} carries invented prose for the cohort regression.` }));
  const w = makeExecWorld({ startMs: Date.parse("2026-03-12T20:00:00Z") });
  seedContent(w.h, segments);
  bootstrapQuota(w.h.coord);
  await submitJob(w.h, JOB, segments);

  // The cohorts are 8 / 7 / 3, not 8 / 8 / 2: each round's
  // headroom is the day's DERIVED total, which permanently
  // counts the dispatches already made (8 consumed -> 7 fresh
  // fit; 15 consumed -> the last 3 fit). Conservative accounting
  // is the point of the guard.
  const grantedPayloads = [];
  const grantIds = [];
  const expectedCohorts = [ids.slice(0, 8), ids.slice(8, 15), ids.slice(15)];
  let grantedSoFar = 0;
  for (let round = 0; round < 3; round++) {
    const g = await w.h.coord.requestGrant(JOB);
    assert.equal(g.ok, true, `grant round ${round + 1} issued`);
    assert.equal(g.count, expectedCohorts[round].length,
      `round ${round + 1} is bounded to the day's remaining derived headroom`);
    grantIds.push(g.grantId);
    const msg = await drainJobMessage(w.h, JOB);
    assert.ok(msg && msg.grantId === g.grantId, "the issued grant is the one delivered");
    assert.deepEqual(msg.occurrences, expectedCohorts[round],
      "the grant covers exactly the next ordered cohort");
    grantedPayloads.push(msg.occurrences);
    const r = await w.exec.handleMessage(msg);
    for (const id of expectedCohorts[round])
      assert.equal(r.occurrences[id].committed, true, `${id} committed in round ${round + 1}`);
    grantedSoFar += expectedCohorts[round].length;
    if (round < 2) {
      const view = w.h.coord.jobView(JOB);
      const stillPending = view.occurrences.filter(o => o.state === "pending").map(o => o.occurrence_id);
      assert.deepEqual(stillPending, ids.slice(grantedSoFar),
        "after each round exactly the un-granted remainder stays pending");
      assert.notEqual(view.state, "complete", "the job cannot finish early");
    }
  }
  // Invariants across the cohort sequence.
  assert.equal(new Set(grantIds).size, 3, "three distinct grants — no cycling, no replay");
  const union = grantedPayloads.flat();
  assert.equal(union.length, 18);
  assert.deepEqual([...union].sort(), [...ids].sort(),
    "no omitted and no duplicated occurrence across the sequence");
  assert.equal(w.providers.calls.length, 18, "exactly one provider call per segment — scope never widened");
  assert.equal(dispatches(w.h).length, 18);
  const grants = w.h.rows("grants").filter(r => r.job_id === JOB);
  assert.equal(grants.length, 3, "no fourth grant was minted");
  const view = w.h.coord.jobView(JOB);
  assert.equal(view.state, "complete", "the job completes through its own grants");
  const fourth = await w.h.coord.requestGrant(JOB);
  assert.equal(fourth.ok, false, "nothing remains to grant");
  assert.equal(w.h.rows("grants").filter(r => r.job_id === JOB).length, 3);
  const plan = w.h.rows("d6_plans").find(p => p.plan_id === PLAN);
  assert.equal(plan.intent_key, "intent-" + PLAN, "plan/intent identity unaltered by cohorting");
  assert.deepEqual(derivedDayTotals(w.h.coord, today(w.h)),
    { dayKey: today(w.h), dispatched: 18, reserved: 0, consumed: 18 });
});

// CORRECTION 1 — rollover: the remainder is re-evaluated whole
// against the new day; nothing pending is silently skipped when
// the quota day rolls over mid-job.
test("C1 rollover: the pending remainder survives midnight untouched and continues on the new day", async () => {
  const JOB = "job-roll";
  const ids = segIds(10);
  const segments = ids.map((id) => ({
    occurrenceId: id, text: `Synthetic rollover segment ${id} with invented prose for testing.` }));
  const D_START = Date.parse("2026-03-10T06:30:00Z");   // PT 2026-03-09
  const D1_START = Date.parse("2026-03-10T08:30:00Z");  // PT 2026-03-10
  const dayD = ptDayKey(D_START), dayD1 = ptDayKey(D1_START);
  const w = makeExecWorld({ startMs: D_START });
  seedContent(w.h, segments);
  bootstrapQuota(w.h.coord);
  await submitJob(w.h, JOB, segments);
  const g1 = await w.h.coord.requestGrant(JOB);
  assert.equal(g1.ok, true);
  assert.equal(g1.count, 8);
  const msg1 = await drainJobMessage(w.h, JOB);
  await w.exec.handleMessage(msg1);
  assert.equal(w.providers.calls.length, 8);
  // Midnight passes with 2 occurrences still pending.
  w.h.setNow(D1_START);
  const viewMid = w.h.coord.jobView(JOB);
  assert.deepEqual(viewMid.occurrences.filter(o => o.state === "pending").map(o => o.occurrence_id),
    ids.slice(8), "the remainder is still pending after rollover — not skipped, not dropped");
  const g2 = await w.h.coord.requestGrant(JOB);
  assert.equal(g2.ok, true);
  assert.equal(g2.count, 2, "the new day funds exactly the remainder");
  const msg2 = await drainJobMessage(w.h, JOB);
  assert.deepEqual(msg2.occurrences, ids.slice(8));
  await w.exec.handleMessage(msg2);
  assert.equal(w.providers.calls.length, 10);
  assert.equal(w.h.coord.jobView(JOB).state, "complete");
  assert.equal(derivedDayTotals(w.h.coord, dayD).dispatched, 8, "day D's count stays on day D");
  assert.equal(derivedDayTotals(w.h.coord, dayD1).dispatched, 2);
});

// ==================================================================
// CORRECTION 2 — disposition day validation. The straddler's
// evidenced interval is [2026-03-11, 2026-03-12]; today is
// 2026-03-12, so the exception blocks the current day.
const C2_NOW = Date.parse("2026-03-12T20:00:00Z");
function seedStraddler(h, attId = "att-x", occId = "oh-x") {
  seedAttempt(h, { attId, execId: "exec-" + attId, occId, phase: "confirmed",
    outcome: "success", cost: 42,
    created: Date.parse("2026-03-12T06:30:00Z"),   // PT 2026-03-11 23:30
    updated: Date.parse("2026-03-12T07:30:00Z"),   // PT 2026-03-12 00:30
    grantId: "grant:hist:1:full" });
}

function seedSameDayHist(h, attId, occId) {
  // An unstamped floor-build call (dispatched_day_key NULL),
  // surfaced after bootstrap as a rollback window would surface
  // it, whose created_at AND updated_at both fall inside PT
  // 2026-03-12: its evidenced interval is the single day
  // [2026-03-12, 2026-03-12], so its dispatch day is genuinely
  // provable and the disposition path stays open for it
  // (re-review hold B, Rowan 6545597263).
  seedAttempt(h, { attId, execId: "exec-" + attId, occId, phase: "confirmed",
    outcome: "success", cost: 42,
    created: Date.parse("2026-03-12T17:00:00Z"),   // PT 2026-03-12 10:00
    updated: Date.parse("2026-03-12T19:00:00Z"),   // PT 2026-03-12 12:00
    grantId: "grant:hist:1:full" });
}

test("C2 revised (hold B): a multi-day straddler refuses EVERY day assignment and changes NOTHING; a same-day exception dispositions on its provable day", async () => {
  const { h } = setupStore({ startMs: C2_NOW });
  insertPlan(h);
  seedStraddler(h);
  bootstrapQuota(h.coord);
  assert.equal(quotaBudgetView(h.coord).currentDayBlocked, true);
  const snapshot = () => JSON.stringify({
    a: attempts(h), d: dispatches(h), r: reservations(h),
    blocked: quotaBudgetView(h.coord).currentDayBlocked,
    exceptions: reconcileQuota(h.coord).exceptions.length,
  });
  const before = snapshot();

  // Not a real calendar date at all (validation precedes the rest).
  assert.throws(() => disposeBootstrapException(h.coord, "att-x",
    { dayKey: "2026-02-30", authorizationRef: "op-ref" }),
    /quota_disposition_day_invalid/);
  assert.throws(() => disposeBootstrapException(h.coord, "att-x",
    { dayKey: "2026-3-12", authorizationRef: "op-ref" }),
    /quota_disposition_day_invalid/);
  assert.equal(snapshot(), before, "invalid-date attempts change nothing");

  // HOLD B core proof: the PRIOR day inside the evidenced
  // interval is an assertion, not proof — a nonblank
  // authorization reference and a source string do not cure it.
  // Refused, and ALL ledgers and the hold are completely
  // unchanged.
  assert.throws(() => disposeBootstrapException(h.coord, "att-x",
    { dayKey: "2026-03-11", authorizationRef: "op-ref", source: "test-evidence" }),
    /quota_disposition_ambiguous_interval/);
  assert.equal(snapshot(), before, "the prior-day choice left everything unchanged");
  // The CURRENT day inside the interval is equally unprovable
  // for this row — refused the same way.
  assert.throws(() => disposeBootstrapException(h.coord, "att-x",
    { dayKey: "2026-03-12", authorizationRef: "op-ref" }),
    /quota_disposition_ambiguous_interval/);
  assert.equal(snapshot(), before);
  // Out-of-interval days refuse as ambiguous too: for a
  // multi-day row the ambiguity is checked before the bounds,
  // so no day choice of any kind can move it.
  assert.throws(() => disposeBootstrapException(h.coord, "att-x",
    { dayKey: "2026-03-10", authorizationRef: "op-ref" }),
    /quota_disposition_ambiguous_interval/);
  assert.throws(() => disposeBootstrapException(h.coord, "att-x",
    { dayKey: "2026-03-13", authorizationRef: "op-ref" }),
    /quota_disposition_ambiguous_interval/);
  assert.equal(snapshot(), before, "no day assignment of any kind moved the straddler");

  // A SAME-DAY exception keeps the disposition path: an
  // out-of-interval day refuses on the interval bounds, and the
  // one provable day succeeds with its basis recorded.
  seedSameDayHist(h, "att-sd", "oh-sd");
  const beforeSd = snapshot();
  assert.throws(() => disposeBootstrapException(h.coord, "att-sd",
    { dayKey: "2026-03-11", authorizationRef: "op-ref" }),
    /quota_disposition_day_outside_evidence_interval/);
  assert.equal(snapshot(), beforeSd, "the same-day row's wrong-day attempt changed nothing");
  const disp = disposeBootstrapException(h.coord, "att-sd",
    { dayKey: "2026-03-12", authorizationRef: "op-ref-2", source: "test-evidence",
      note: "the row's only evidenced day" });
  assert.equal(disp.dayKey, "2026-03-12");
  const row = attempts(h).find(a => a.attempt_id === "att-sd");
  assert.equal(row.dispatched_day_key, "2026-03-12");
  const record = JSON.parse(row.detail_json).quotaBootstrapDisposition;
  assert.equal(record.authorizationRef, "op-ref-2");
  assert.equal(record.source, "test-evidence");
  assert.deepEqual(record.evidenceInterval, ["2026-03-12", "2026-03-12"],
    "the basis the day was validated against is part of the record");
  assert.equal(derivedDayTotals(h.coord, "2026-03-12").dispatched, 1);
  // And it cannot be dispositioned twice.
  assert.throws(() => disposeBootstrapException(h.coord, "att-sd",
    { dayKey: "2026-03-12", authorizationRef: "op-ref-3" }),
    /quota_disposition_not_an_exception/);

  // The straddler is untouched by all of it: still an exception,
  // still blocking today. Its blocking effect expires naturally
  // with time — tomorrow it blocks nothing — and the row
  // remains on the record as an exception: never erased, and
  // its day never guessed.
  assert.equal(quotaBudgetView(h.coord).currentDayBlocked, true);
  h.setNow(Date.parse("2026-03-13T20:00:00Z"));
  assert.equal(quotaBudgetView(h.coord).currentDayBlocked, false,
    "the block expired with time, not with an asserted day");
  assert.equal(reconcileQuota(h.coord).exceptions.length, 1,
    "the straddler remains an exception on the record");
  assert.equal(attempts(h).find(a => a.attempt_id === "att-x").dispatched_day_key, null,
    "its day was never guessed");
});

// ==================================================================
// CORRECTION 3a — reconcileQuota.ok is false on a current-day
// exception even when every stored counter is exactly right:
// the details are reported separately, ok means safe-to-rearm.
test("C3 revised (hold B): reconcile reports ok:false while a current-day straddler stands; its disposition is refused and the block expires with time", async () => {
  const { h } = setupStore({ startMs: C2_NOW });
  insertPlan(h);
  seedStraddler(h);
  bootstrapQuota(h.coord);
  const rec = reconcileQuota(h.coord);
  assert.equal(rec.ok, false, "not safe to rearm over an unaccounted possibly-today dispatch");
  assert.deepEqual(rec.drift, [], "no counter drifted — reported separately from ok");
  assert.equal(rec.exceptions.length, 1);
  assert.equal(rec.currentDayBlocked, true);
  // Hold B: the straddler's day cannot be settled by
  // disposition — both in-interval days are assertions, not
  // proof. Both refusals change nothing.
  const snapshot = () => JSON.stringify({
    a: attempts(h), d: dispatches(h), r: reservations(h) });
  const before = snapshot();
  assert.throws(() => disposeBootstrapException(h.coord, "att-x",
    { dayKey: "2026-03-12", authorizationRef: "op-ref" }),
    /quota_disposition_ambiguous_interval/);
  assert.throws(() => disposeBootstrapException(h.coord, "att-x",
    { dayKey: "2026-03-11", authorizationRef: "op-ref" }),
    /quota_disposition_ambiguous_interval/);
  assert.equal(snapshot(), before, "the refused dispositions changed nothing");
  assert.equal(reconcileQuota(h.coord).ok, false, "still not safe to rearm today");
  // The block expires naturally: on the next PT day the
  // exception's interval no longer covers the current day and
  // reconcile is truthful again — with the exception still on
  // the record, never absorbed and never guessed.
  h.setNow(Date.parse("2026-03-13T20:00:00Z"));
  const rec2 = reconcileQuota(h.coord);
  assert.equal(rec2.ok, true);
  assert.equal(rec2.exceptions.length, 1, "the exception is preserved, not absorbed");
  assert.equal(rec2.currentDayBlocked, false);
  assert.equal(attempts(h).find(a => a.attempt_id === "att-x").dispatched_day_key, null);
});

// ==================================================================
// CORRECTION 3b/c — the over-cap fixture: 96 slots of outstanding
// reservations plus five newly dispositioned same-day historical
// dispatches cross the cap (101). The historical count is
// preserved, the hold is named on the record, and ZERO additional
// provider calls proceed — neither under the pre-authorized
// reservations nor under a new grant.
test("C3 fixture: disposition over the cap fails the day closed — zero additional provider calls", async () => {
  const FILLER = "job-filler";
  const D = "2026-03-12";
  const fillerSegments = segIds(8, "f").map((id) => ({
    occurrenceId: id, text: `Synthetic filler segment ${id} prose for the over-cap fixture.` }));
  const w = makeExecWorld({ startMs: C2_NOW });
  seedContent(w.h, fillerSegments);
  bootstrapQuota(w.h.coord);
  await submitJob(w.h, FILLER, fillerSegments);
  const fg = await w.h.coord.requestGrant(FILLER);
  assert.equal(fg.ok, true);
  assert.equal(derivedDayTotals(w.h.coord, D).reserved, 96, "96 slots pre-authorized and outstanding");
  const fillerMsg = await drainJobMessage(w.h, FILLER);
  assert.ok(fillerMsg && fillerMsg.grantId === fg.grantId);

  // Five historical floor-build calls, unstamped and provably
  // SAME-DAY (created_at and updated_at both inside PT
  // 2026-03-12, evidenced interval [03-12, 03-12]), are
  // discovered as a rollback window would surface them.
  // Re-review hold B (6545597263): the over-cap proof must rest
  // on days that are genuinely provable — not on unevidenced
  // midnight guesses at a straddler's interval.
  for (let i = 1; i <= 5; i++)
    seedSameDayHist(w.h, `att-h${i}`, `oh-h${i}`);
  assert.equal(quotaBudgetView(w.h.coord).currentDayBlocked, true,
    "while unresolved, the unaccounted today history blocks the day");
  for (let i = 1; i <= 5; i++) {
    const disp = disposeBootstrapException(w.h.coord, `att-h${i}`,
      { dayKey: D, authorizationRef: "op-ref-overcap", source: "fixture" });
    if (i < 5) assert.equal(disp.dayOverLimit, null, `disposition ${i}: consumed ${96 + i} is not over the cap`);
    else assert.deepEqual(disp.dayOverLimit, { dayKey: D, consumed: 101, limit: 100 },
      "the crossing disposition names the over-limit hold on its own record");
  }
  assert.deepEqual(derivedDayTotals(w.h.coord, D),
    { dayKey: D, dispatched: 5, reserved: 96, consumed: 101 },
    "the historical count is preserved — never erased to fit the cap");
  const rec = reconcileQuota(w.h.coord);
  assert.equal(rec.ok, false);
  assert.ok(rec.drift.some(d => d.kind === "day_over_limit" && d.dayKey === D && d.consumed === 101),
    "reconciliation names the over-limit day in its drift detail");
  assert.equal(rec.exceptions.length, 0);
  assert.equal(rec.currentDayBlocked, false);
  assert.equal(quotaBudgetView(w.h.coord).dayOverLimit, true);

  // A new grant on the held day refuses under the named hold
  // (checked before any executor run records the standard quota
  // park, which would otherwise be the first refusal reason).
  await submitJob(w.h, "job-newday", [{ occurrenceId: "n1", text: "Synthetic late segment prose." }]);
  const ng = await w.h.coord.requestGrant("job-newday");
  assert.equal(ng.ok, false);
  assert.equal(ng.reason, QUOTA_REFUSALS.DAY_OVER_LIMIT);

  // The pre-authorized filler grant now reaches the executor:
  // every dispatch refuses inside markDispatching BEFORE any
  // provider contact — zero additional provider calls.
  const r = await w.exec.handleMessage(fillerMsg);
  assert.equal(w.providers.calls.length, 0, "ZERO additional provider calls on an over-cap day");
  assert.equal(dispatches(w.h).length, 5, "no new dispatch rows — only the dispositioned history");
  const fillerExecIds = new Set(w.h.rows("d6_execution_records")
    .filter(e => e.job_id === FILLER).map(e => e.execution_id));
  const fillerAttempts = attempts(w.h).filter(a => fillerExecIds.has(a.execution_id));
  assert.ok(fillerAttempts.length > 0 && fillerAttempts.every(a => a.phase === "released"),
    "every refused filler attempt was released undispatched");
  assert.equal(r.quotaExhausted, true, "the run takes the quota stop shape, not a provider outcome");

  // History is still intact at the end: five dispositioned rows
  // and their records preserved. The day's forward total drops
  // to the 5 real dispatches because the park settled the filler
  // grant's reservations (quota_park, the §1.5 shape: dispatch
  // under them is impossible once parked, and resume is a NEW
  // grant) — a settlement of reservations, not an erasure of
  // the historical count, which remains fully on the record.
  assert.equal(dispatches(w.h).length, 5);
  for (let i = 1; i <= 5; i++) {
    const row = attempts(w.h).find(a => a.attempt_id === `att-h${i}`);
    assert.equal(row.dispatched_day_key, D);
    assert.equal(JSON.parse(row.detail_json).quotaBootstrapDisposition.authorizationRef, "op-ref-overcap");
  }
  const fillerRes = reservations(w.h).filter(r => r.grant_id === fg.grantId);
  assert.ok(fillerRes.every(r => r.state === "closed" && r.close_reason === "quota_park"),
    "the parked grant's reservations settled at the park, as designed");
  assert.deepEqual(derivedDayTotals(w.h.coord, D),
    { dayKey: D, dispatched: 5, reserved: 0, consumed: 5 });
});
