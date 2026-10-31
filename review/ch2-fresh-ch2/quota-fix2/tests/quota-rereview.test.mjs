// D6 QUOTA GUARD — re-review suite for Rowan's PARTIAL PASS
// (roundtable issue #15, comment 6545597263) on the quota
// corrections. Hold A proofs live here:
//
//   Hold A — the 100-grant daily guard saw the FULL pending
//     set before cohorting: a job with 101 fresh occurrences
//     was refused quota_estimate_exhausted every PT day,
//     forever, because 0 + 101 > 100 no matter how small a
//     fundable cohort would be. The fix evaluates the
//     grant-count budget against the BOUNDED COHORT on armed
//     D6 non-probe grants (unarmed/non-D6 callers keep the
//     exact full-set semantics; DAILY_QUOTA_LIMIT itself is
//     unchanged, and the day's granted count can never exceed
//     it). Proofs:
//       A1 (store): with the day's grant ledger preloaded to
//         92, a 101-occurrence job still grants its bounded
//         cohort of 8 and the day's count lands on exactly
//         100 (full-set semantics would refuse: 92 + 101);
//         preloaded to 96, the same job refuses
//         quota_estimate_exhausted — the count check still
//         binds, against the cohort (96 + 8 > 100) — and
//         leaves nothing partial behind.
//       A2 (executor): a 101-fresh-occurrence job's first
//         grant is nonempty and bounded; the remainder stays
//         pending in order (no silent skip); the day ends on
//         the provider-attempt SLOT budget, never on the count
//         guard; after midnight the job continues and
//         completes. Grant-ledger counts for both days are
//         proven <= 100.
//
//   Hold B's proofs live in the revised tests it names:
//     quota-corrections C2 (prior-day choice on a
//     current-day-straddling fixture leaves ALL ledgers and
//     the hold unchanged; same-day disposition still works),
//     quota-corrections C3 (reconcile + the over-cap fixture,
//     now built on provably same-day unstamped floor-build
//     calls), and quota-budget T3 (multi-day disposition
//     refused; the block expires with time).
//
// All deterministic: harness-injected clock, fake bucket and
// fake providers, ZERO real provider calls. Synthetic fixtures
// only. These tests prove the guard's behavior; they are NOT
// verification of any real provider limit (the cap is the
// app-selected Reader policy constant, 100).
//
// Run: node --test tests/quota-rereview.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { makeHarness, makeProbe, occ, submit } from "./helpers/do-harness.mjs";
import { createGenStore } from "../worker/generation/genstore.mjs";
import {
  makeFakeR2Bucket, makeFakeD6Providers, sha256HexOf,
} from "./helpers/d6-fakes.mjs";
import { createFlushStore } from "../worker/generation/flush-store.mjs";
import { createD6Executor } from "../worker/generation/d6-executor.mjs";
import { createD6WorkSource } from "../worker/generation/d6-work-source.mjs";
import { fingerprintFor } from "../worker/executor.mjs";
import {
  bootstrapQuota, derivedDayTotals, settleReservationsForGrant,
  ptDayKey, QUOTA_REFUSALS,
} from "../worker/generation/quota-budget.mjs";

const PLAN = "plan-q";
const PHASE = "forever-pucked";
const BOOK = "book-1";
const DAY_MS = Date.parse("2026-03-12T20:00:00Z"); // PT 2026-03-12

// ---- store-level helpers (mirroring quota-corrections.test.mjs) ----
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
const reservations = (h) => h.rows("d6_grant_reservations");
const segIds = (n, prefix = "s") =>
  Array.from({ length: n }, (_, i) => `${prefix}${String(i + 1).padStart(2, "0")}`);

// Fill the day's GRANT ledger (ledger_ops 'attempt' rows)
// without holding any provider-attempt slots: grant filler
// jobs, then settle their reservations (no executions exist
// for store-level grants, so settlement is unblocked). The
// granted count persists in the ledger while the slot budget
// returns to full headroom — isolating the grant-COUNT check
// from the slot budget, which is exactly the separation hold A
// is about.
async function preloadGrantCount(h, total) {
  let made = 0, n = 0;
  while (made < total) {
    const k = Math.min(8, total - made);
    const g = await grantJob(h, `job-fill-${n}`, segIds(k, `f${n}-`));
    assert.equal(g.ok, true, "filler grant issues");
    const s = settleReservationsForGrant(h.coord, g.grantId);
    assert.equal(s.closed.length, k, "filler reservations settle, freeing the slot budget");
    made += k; n++;
  }
  return made;
}

// ==================================================================
// HOLD A, store legs — the count check is evaluated against
// the bounded cohort, and it still binds.
test("A1 store: at 92 prior grants the 101-job grants its cohort (day lands on exactly 100); at 96 it refuses quota_estimate_exhausted with no partials", async () => {
  // Case 92: full-set semantics would refuse (92 + 101 > 100)
  // every day, forever. Against the bounded cohort (8), the
  // grant fits exactly: 92 + 8 = 100, the limit itself.
  {
    const { h } = setupStore({ startMs: DAY_MS });
    bootstrapQuota(h.coord);
    const day = ptDayKey(h.now());
    await preloadGrantCount(h, 92);
    assert.equal(h.coord._attemptsOn(day), 92);
    assert.equal(derivedDayTotals(h.coord, day).consumed, 0,
      "the slot budget is untouched by the preload — only the count is loaded");
    const ids = segIds(101);
    const g = await grantJob(h, "job-101", ids);
    assert.equal(g.ok, true, "the 101-occurrence job grants at last");
    assert.equal(g.count, 8, "the cohort is the slot-bounded prefix (8 x 12 = 96 <= 100)");
    assert.equal(h.coord._attemptsOn(day), 100,
      "grant-ledger count proof: the day's granted count reaches exactly 100 and never exceeds it");
    const occs = h.rows("occurrences").filter(o => o.job_id === "job-101");
    assert.deepEqual(occs.filter(o => o.state === "granted").map(o => o.occurrence_id), ids.slice(0, 8),
      "the granted set is the ordered prefix — nothing skipped");
    assert.deepEqual(occs.filter(o => o.state === "pending").map(o => o.occurrence_id), ids.slice(8),
      "the other 93 stay pending on the same job");
    const res = reservations(h).filter(r => r.grant_id === g.grantId);
    assert.equal(res.length, 8);
    assert.ok(res.every(r => r.slots_total === 12 && r.state === "open"),
      "every granted occurrence holds a full worst-case reservation");
  }
  // Case 96: the count check still binds — against the cohort.
  // 96 + 8 > 100 refuses quota_estimate_exhausted, and the
  // refusal leaves no grant, no reservations, nothing granted.
  {
    const { h } = setupStore({ startMs: DAY_MS });
    bootstrapQuota(h.coord);
    const day = ptDayKey(h.now());
    await preloadGrantCount(h, 96);
    assert.equal(h.coord._attemptsOn(day), 96);
    const ids = segIds(101);
    const g = await grantJob(h, "job-101", ids);
    assert.equal(g.ok, false);
    assert.equal(g.reason, "quota_estimate_exhausted",
      "the grant-count guard still fires — evaluated against the bounded cohort");
    assert.equal(h.rows("grants").filter(r => r.job_id === "job-101").length, 0);
    assert.equal(reservations(h).filter(r => r.grant_id.includes("job-101")).length, 0);
    assert.ok(h.rows("occurrences").filter(o => o.job_id === "job-101")
      .every(o => o.state === "pending"), "nothing was granted, skipped, or dropped");
    assert.equal(h.coord._attemptsOn(day), 96, "the refused grant wrote no ledger rows");
  }
});

// ---- executor-level world (mirroring quota-corrections.test.mjs) ----
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
// HOLD A, executor leg — the required 101-occurrence job proof:
// first grant nonempty and bounded; remainder stays pending;
// no silent skip; next-day continuation instead of permanent
// refusal; grant-ledger counts stay <= 100 on both days.
test("A2 executor: a 101-fresh-occurrence job starts, progresses within the day, and completes the next day — never permanently refused", async () => {
  const JOB = "job-ch101";
  const ids = segIds(101);
  // The pending set's own order — the order every cohort prefix
  // follows — is the coordinator's ORDER BY occurrence_id
  // (lexicographic): s01..s10, s100, s101, s11... The ordered
  // assertions below track exactly that order.
  const ordered = [...ids].sort();
  const segments = ids.map((id) => ({
    occurrenceId: id, text: `Synthetic segment ${id} carries invented prose for the 101-occurrence regression.` }));
  const D1 = Date.parse("2026-03-12T20:00:00Z"); // PT 2026-03-12
  const D2 = Date.parse("2026-03-13T20:00:00Z"); // PT 2026-03-13
  const day1 = ptDayKey(D1), day2 = ptDayKey(D2);
  const w = makeExecWorld({ startMs: D1 });
  seedContent(w.h, segments);
  bootstrapQuota(w.h.coord);
  await submitJob(w.h, JOB, segments);

  const pendingIds = () => w.h.coord.jobView(JOB).occurrences
    .filter(o => o.state === "pending").map(o => o.occurrence_id);
  const runRound = async () => {
    const g = await w.h.coord.requestGrant(JOB);
    if (!g.ok) return g;
    const msg = await drainJobMessage(w.h, JOB);
    assert.ok(msg && msg.grantId === g.grantId, "the issued grant is the one delivered");
    const r = await w.exec.handleMessage(msg);
    for (const id of msg.occurrences)
      assert.equal(r.occurrences[id].committed, true, `${id} committed`);
    return { ok: true, grant: g, occurrences: msg.occurrences };
  };

  // First grant of day 1 — the regression point. Before hold
  // A's fix this returned quota_estimate_exhausted (0 + 101 >
  // 100) on every day, forever. Now the count check sees the
  // bounded cohort, and the job starts.
  const first = await runRound();
  assert.equal(first.ok, true, "the 101-occurrence job is grantable at last");
  assert.equal(first.grant.count, 8, "first cohort is the slot-bounded 8 (96 of 100 slots)");
  assert.deepEqual(first.occurrences, ordered.slice(0, 8), "the cohort is the ordered prefix");
  assert.deepEqual(pendingIds(), ordered.slice(8),
    "the other 93 stay pending — nothing skipped, nothing dropped");

  // Progress within the day until the day's slot budget is
  // genuinely exhausted. The refusal that ends the day is the
  // provider-attempt SLOT budget — the grant-count guard never
  // fires.
  const grantedDay1 = [...first.occurrences];
  let refusal = null;
  for (let round = 0; round < 60 && !refusal; round++) {
    const r = await runRound();
    if (!r.ok) { refusal = r; break; }
    grantedDay1.push(...r.occurrences);
  }
  assert.ok(refusal, "the day eventually refuses");
  assert.equal(refusal.reason, QUOTA_REFUSALS.BUDGET,
    "day 1 ends on the slot budget, not on quota_estimate_exhausted");
  const day1Calls = w.providers.calls.length;
  assert.equal(day1Calls, grantedDay1.length, "every granted occurrence dispatched exactly once");
  assert.ok(day1Calls > 0 && day1Calls < 101, "real progress, but the job is not finished");
  assert.equal(w.h.coord._attemptsOn(day1), day1Calls,
    "grant-ledger count proof: day 1's granted count equals its dispatches");
  assert.ok(w.h.coord._attemptsOn(day1) <= 100, "and never exceeds the 100/day limit");
  assert.equal(derivedDayTotals(w.h.coord, day1).dispatched, day1Calls);
  assert.deepEqual(pendingIds(), ordered.slice(day1Calls),
    "the remainder is exactly the ordered suffix — no silent skip");
  assert.notEqual(w.h.coord.jobView(JOB).state, "complete");

  // Midnight passes: the remainder survives untouched, and the
  // new day CONTINUES the job instead of refusing it forever.
  w.h.setNow(D2);
  assert.deepEqual(pendingIds(), ordered.slice(day1Calls),
    "the remainder survives midnight untouched");
  let done = false;
  for (let round = 0; round < 60 && !done; round++) {
    const r = await runRound();
    assert.equal(r.ok, true, `day-2 round ${round + 1} grants — continuation, not refusal`);
    if (w.h.coord.jobView(JOB).state === "complete") done = true;
  }
  assert.equal(done, true, "the job completes on day 2 through its own grants");
  assert.equal(w.providers.calls.length, 101, "exactly one provider call per occurrence overall");
  assert.equal(w.h.coord._attemptsOn(day2), 101 - day1Calls);
  assert.ok(w.h.coord._attemptsOn(day2) <= 100, "day 2's grant count also stays within the limit");
  assert.equal(derivedDayTotals(w.h.coord, day1).dispatched, day1Calls,
    "day 1's dispatches stay counted on day 1");
  assert.equal(derivedDayTotals(w.h.coord, day2).dispatched, 101 - day1Calls);
  const plan = w.h.rows("d6_plans").find(p => p.plan_id === PLAN);
  assert.equal(plan.intent_key, "intent-" + PLAN, "plan/intent identity unaltered by cohorting");
});
