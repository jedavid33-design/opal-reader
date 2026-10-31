// D6 QUOTA GUARD — executor-level suite for the provider-attempt
// budget (QUOTA-PROPOSAL.md as amended by QUOTA-ADDENDUM.md;
// DESIGN PASS 6544950778; Julie's build approval 6545090525).
// Covers addendum §5 tests T4 (quota exhaustion mid-split), T5
// (known and unknown provider outcomes), T6 (cross-day
// continuation, executor leg), plus Rowan invariant 4's
// failure-injection crash-window test and the §1.5
// execution-recovery legs. The store-level legs of T6 live in
// tests/quota-budget.test.mjs.
//
// All deterministic: harness-injected clock, fake bucket and
// fake providers, ZERO real provider calls. Synthetic text only.
//
// These tests prove the GUARD's accounting behavior. They are
// NOT verification of any real provider limit: the fake provider
// accepts everything it is sent, and the daily cap enforced here
// is the app-selected Reader policy constant (100), not a
// measured Google limit. Traffic sent to the same Google Cloud
// project from outside Reader is invisible to this counter by
// construction.
//
// Run: node --test tests/quota-executor.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { makeHarness } from "./helpers/do-harness.mjs";
import {
  makeFakeR2Bucket, makeFakeD6Providers, sha256HexOf,
  httpError, policyBlockError, quotaError, unknownTransportError, syntheticWav,
} from "./helpers/d6-fakes.mjs";
import { createFlushStore } from "../worker/generation/flush-store.mjs";
import { createGenStore } from "../worker/generation/genstore.mjs";
import { createD6Executor } from "../worker/generation/d6-executor.mjs";
import { createD6WorkSource } from "../worker/generation/d6-work-source.mjs";
import { fingerprintFor } from "../worker/executor.mjs";
import {
  bootstrapQuota, reconcileQuota, derivedDayTotals, ptDayKey,
} from "../worker/generation/quota-budget.mjs";

const JOB = "job-d6-1";
const FILLER = "job-filler";
const BOOK = "book-1";
const PLAN = "plan-1";
const PHASE = "forever-pucked";
const TEXT1 = "Synthetic segment one carries a plain opening line of invented prose for testing.";

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

function seedContent(h, segments) {
  const data = {
    chapters: [{ chapterId: "ch-1", segments: segments.map((s) => ({
      occurrenceId: s.occurrenceId, text: s.text, pov: s.pov || "pov-a" })) }],
    povs: [
      { id: "pov-a", name: "Aria", voice: { voice_id: "Zephyr", provider: "gemini", model_id: "gemini-3.8-flash-tts", style_direction: "warm" } },
    ],
  };
  h.db.prepare(`INSERT INTO sync_entities (family, entity_key, book_id, revision, deleted, data_json)
                VALUES ('content', ?, ?, 1, 0, ?)`).run(BOOK, BOOK, JSON.stringify(data));
}

async function submitJob(h, jobId, segments) {
  const occs = segments.map((s) => ({
    occurrenceId: s.occurrenceId, revisionKey: fingerprintFor(payloadFor(s.text)), estMicroCents: 1000,
  }));
  await h.coord.handleCommand({
    command_id: `cmd-${jobId}`, type: "SubmitJob",
    payload: { jobId, bookId: BOOK, chapterIndex: 0, lane: "standard", occurrences: occs,
               data: { estMicroCents: 1000, d6PlanId: PLAN } },
  });
  h.db.prepare(`INSERT OR IGNORE INTO d6_plan_jobs (plan_id, job_id, chapter_index, seq)
                VALUES (?, ?, 0, 0)`).run(PLAN, jobId);
}

// An ARMED world: d6StandardOnly on, quota bootstrapped before
// the grant, plan linked. Mirrors d6-executor-fi's makeWorld.
async function makeWorld({ segments, startMs, fillerSegments = null } = {}) {
  const bucket = makeFakeR2Bucket();
  const flushStore = createFlushStore(bucket, { keyPrefix: "" });
  const probe = bridgeProbe(bucket, flushStore);
  const h = makeHarness({ probe, ...(startMs ? { startMs } : {}),
                          extraEnv: { d6StandardOnly: true } });
  const store = createGenStore(h.coord);
  store.ensureSchema();
  h.db.prepare(`INSERT OR IGNORE INTO d6_plans (plan_id, intent_key, book_id, scope, keep_going, phase, lane, state, created_at, updated_at)
                VALUES (?, ?, ?, 'book', 1, ?, 'standard', 'active', 0, 0)`)
    .run(PLAN, `intent-${PLAN}`, BOOK, PHASE);
  seedContent(h, segments);
  bootstrapQuota(h.coord);
  const providers = makeFakeD6Providers();
  const workSource = createD6WorkSource(h.coord, { cache: null });
  const mkExec = (over = {}) => createD6Executor({
    coord: h.coord, store, providers, flushStore, workSource, consumerId: "exec-A", ...over,
  });
  const exec = mkExec();
  await submitJob(h, JOB, segments);
  if (fillerSegments) await submitJob(h, FILLER, fillerSegments);
  const g = await h.coord.requestGrant(JOB);
  assert.equal(g.ok, true, "world grant issued");
  let msg = null;
  await h.coord.drainOutbox((p) => { if (p.jobId === JOB) msg = p; });
  assert.ok(msg && msg.grantId === g.grantId, "grant dispatched");
  return { bucket, flushStore, probe, h, store, providers, exec, mkExec, workSource, msg, g };
}

const reservations = (h) => h.rows("d6_grant_reservations");
const dispatches = (h) => h.rows("d6_provider_dispatches");
const attempts = (h) => h.rows("d6_attempt_log");
const parks = (h) => h.rows("quota_parks");
const day = (h) => ptDayKey(h.now());

// ------------------------------------------------------------------
// T5 (success leg) + the happy path: exactly one dispatch row,
// stamped with the dispatch day; the reservation settles
// 'grant_settled' when the grant's report closes it, and the
// dispatch stays counted permanently.
test("T5 success: one dispatch, counted permanently; reservation settles grant_settled", async () => {
  const w = await makeWorld({ segments: [{ occurrenceId: "o1", text: TEXT1 }] });
  const r = await w.exec.handleMessage(w.msg);
  assert.equal(r.occurrences.o1.committed, true);
  assert.equal(w.providers.calls.length, 1);
  assert.equal(dispatches(w.h).length, 1);
  assert.equal(dispatches(w.h)[0].dispatch_day_key, day(w.h));
  assert.equal(attempts(w.h)[0].dispatched_day_key, day(w.h));
  assert.equal(attempts(w.h)[0].outcome, "success");
  const res = reservations(w.h);
  assert.equal(res.length, 1);
  assert.equal(res[0].slots_consumed, 1);
  assert.equal(res[0].state, "closed");
  assert.equal(res[0].close_reason, "grant_settled");
  assert.equal(derivedDayTotals(w.h.coord, day(w.h)).dispatched, 1,
    "a settled reservation's dispatch remains in the day's count forever");
});

// ------------------------------------------------------------------
// T5 (POLICY_BLOCK leg): dispatch began, so it counts — once for
// the single unsplittable attempt.
test("T5 policy_block: a terminal block counts exactly one dispatch", async () => {
  const w = await makeWorld({ segments: [{ occurrenceId: "o1", text: "blocked synthetic passage" }] });
  w.providers.behavior.onCall = (occ) => {
    if (occ.payload.text.includes("blocked synthetic")) throw policyBlockError();
    return syntheticWav(occ.payload.text);
  };
  const r = await w.exec.handleMessage(w.msg);
  assert.equal(r.occurrences.o1.blocked, true);
  assert.equal(w.providers.calls.length, 1, "unsplittable: one attempt only");
  assert.equal(attempts(w.h).length, 1);
  assert.equal(attempts(w.h)[0].outcome, "policy_block");
  assert.equal(dispatches(w.h).length, 1);
  assert.equal(reservations(w.h)[0].slots_consumed, 1);
  assert.equal(derivedDayTotals(w.h.coord, day(w.h)).dispatched, 1);
});

// ------------------------------------------------------------------
// T5 (known failure leg): an HTTP 500 is a known outcome for a
// dispatch that happened — it counts once.
test("T5 failed_known: an HTTP 500 counts exactly one dispatch", async () => {
  const w = await makeWorld({ segments: [{ occurrenceId: "o1", text: TEXT1 }] });
  w.providers.behavior.onCall = () => { throw httpError(500); };
  await w.exec.handleMessage(w.msg);
  assert.equal(w.providers.calls.length, 1);
  assert.equal(attempts(w.h)[0].outcome, "failed_known");
  assert.equal(dispatches(w.h).length, 1);
  assert.equal(derivedDayTotals(w.h.coord, day(w.h)).dispatched, 1);
});

// ------------------------------------------------------------------
// T5 (provider 429 leg): a real provider quota answer also counts
// (dispatch began), and the reservation closes at the park with
// reason quota_park.
test("T5 provider 429: counts once; reservation closes quota_park at the park", async () => {
  const w = await makeWorld({ segments: [{ occurrenceId: "o1", text: TEXT1 }] });
  w.providers.behavior.onCall = () => { throw quotaError(); };
  const r = await w.exec.handleMessage(w.msg);
  assert.equal(r.quotaExhausted, true);
  assert.equal(w.providers.calls.length, 1);
  assert.equal(dispatches(w.h).length, 1);
  assert.equal(parks(w.h).length, 1);
  const res = reservations(w.h)[0];
  assert.equal(res.state, "closed");
  assert.equal(res.close_reason, "quota_park");
  assert.equal(res.slots_consumed, 1);
});

// ------------------------------------------------------------------
// T5 (transport-unknown leg): dispatch began, outcome unknown —
// counts once, and the reservation stays FROZEN open (§1.5): no
// report is made for an unknown-billing stop, so nothing may
// free it.
test("T5 transport-unknown: counts once; reservation frozen open; no park", async () => {
  const w = await makeWorld({ segments: [{ occurrenceId: "o1", text: TEXT1 }] });
  w.providers.behavior.onCall = () => { throw unknownTransportError(); };
  const r = await w.exec.handleMessage(w.msg);
  assert.equal(r.stoppedUnknownBilling, true);
  assert.equal(w.providers.calls.length, 1);
  assert.equal(attempts(w.h)[0].outcome, "unknown");
  assert.equal(dispatches(w.h).length, 1);
  const res = reservations(w.h)[0];
  assert.equal(res.state, "open", "frozen: an unknown-billing halt frees nothing");
  assert.equal(res.slots_consumed, 1);
  assert.equal(parks(w.h).length, 0);
  assert.equal(derivedDayTotals(w.h.coord, day(w.h)).dispatched, 1);
});

// ------------------------------------------------------------------
// T4 — Quota exhaustion mid-split, across midnight: a segment
// whose recursive split straddles the PT day boundary; the day
// rolls over mid-split and the next day's budget is consumed by
// another grant, so a later leaf's dispatch is refused. Earlier
// attempts keep their confirmed outcomes; the refused attempt
// provably never dispatched (released, no provider call); the
// occurrence takes the quota-park shape with honest app-side
// evidence; the day-D reservation closes quota_park and its
// remaining slots are freed exactly once.
test("T4 exhaustion mid-split across midnight: later leaf refused, earlier outcomes stand, park closes the day-D reservation", async () => {
  const D_START = Date.parse("2026-03-10T06:30:00Z");   // 2026-03-09 23:30 PDT
  const D1_START = Date.parse("2026-03-10T07:30:00Z");  // 2026-03-10 00:30 PDT
  const fillerSegments = Array.from({ length: 8 }, (_, i) => ({
    occurrenceId: `f${i + 1}`, text: `Synthetic filler segment ${i + 1} prose for the harness.` }));
  const left = "Left marker mkA opens this synthetic blocked passage with a long line of prose.";
  const right = "Right marker mkB closes the same synthetic passage with another long line here.";
  const w = await makeWorld({
    segments: [{ occurrenceId: "o1", text: `${left} ${right}` }],
    startMs: D_START, fillerSegments,
  });
  const dayD = ptDayKey(D_START), dayD1 = ptDayKey(D1_START);
  assert.equal(day(w.h), dayD);
  w.providers.behavior.onCall = async (occ, n) => {
    if (n === 2) {
      // The left half is about to succeed on day D; before it
      // returns, midnight passes and another grant reserves 96
      // of day D+1's 100 dispatch slots.
      w.h.setNow(D1_START);
      const fg = await w.h.coord.requestGrant(FILLER);
      assert.equal(fg.ok, true, "filler grant reserves day D+1");
    }
    if (occ.payload.text.includes("mkA") && occ.payload.text.includes("mkB"))
      throw policyBlockError();
    return syntheticWav(occ.payload.text);
  };
  const r = await w.exec.handleMessage(w.msg);
  assert.equal(r.quotaExhausted, true);
  assert.equal(w.providers.calls.length, 2,
    "the provider saw the whole and the left half — the refused leaf was never sent");
  const atts = attempts(w.h);
  assert.deepEqual(atts.map(a => [a.phase, a.outcome]),
    [["confirmed", "policy_block"], ["confirmed", "success"], ["released", null]],
    "earlier attempts keep confirmed outcomes; the refused attempt is released");
  assert.equal(dispatches(w.h).length, 2);
  assert.ok(dispatches(w.h).every(d => d.dispatch_day_key === dayD));
  // The park: honest app-side evidence, no fabricated 429.
  assert.equal(parks(w.h).length, 1);
  const evidence = JSON.parse(parks(w.h)[0].evidence_json);
  assert.equal(evidence.quotaBudgetRefusal, "provider_attempt_budget_day_rollover");
  // Day-D reservation for the split segment: closed at the park,
  // both real dispatches consumed, remainder freed exactly once.
  const resD = reservations(w.h).filter(x => x.grant_id === w.g.grantId);
  assert.equal(resD.length, 1, "no day-D+1 reservation was created for the refused grant");
  assert.equal(resD[0].day_key, dayD);
  assert.equal(resD[0].slots_consumed, 2);
  assert.equal(resD[0].state, "closed");
  assert.equal(resD[0].close_reason, "quota_park");
  assert.deepEqual(derivedDayTotals(w.h.coord, dayD),
    { dayKey: dayD, dispatched: 2, reserved: 0, consumed: 2 });
  // The filler grant's day-D+1 reservations stand untouched.
  assert.equal(reservations(w.h).filter(x => x.day_key === dayD1 && x.state === "open").length, 8);
  assert.equal(derivedDayTotals(w.h.coord, dayD1).reserved, 96);
});

// ------------------------------------------------------------------
// T6 (executor leg) — Cross-day continuation: a grant issued on
// day D whose message is first delivered on day D+1 dispatches
// against day D+1 through the atomic re-reservation; the day-D
// reservation is untouched by the dispatch.
test("T6 cross-day: first delivery after midnight re-reserves atomically onto the dispatch day", async () => {
  const D_START = Date.parse("2026-03-10T06:30:00Z");   // 2026-03-09 23:30 PDT
  const D1_START = Date.parse("2026-03-10T07:30:00Z");  // 2026-03-10 00:30 PDT
  const w = await makeWorld({ segments: [{ occurrenceId: "o1", text: TEXT1 }], startMs: D_START });
  const dayD = ptDayKey(D_START), dayD1 = ptDayKey(D1_START);
  assert.equal(reservations(w.h).length, 1);
  assert.equal(reservations(w.h)[0].day_key, dayD);
  w.h.setNow(D1_START);
  const r = await w.exec.handleMessage(w.msg);
  assert.equal(r.occurrences.o1.committed, true);
  assert.equal(w.providers.calls.length, 1);
  assert.equal(dispatches(w.h).length, 1);
  assert.equal(dispatches(w.h)[0].dispatch_day_key, dayD1, "the dispatch is stamped with its own day");
  const res = reservations(w.h).filter(x => x.grant_id === w.g.grantId);
  assert.equal(res.length, 2, "the re-reservation is a second row, not a mutation of the day-D row");
  const resD = res.find(x => x.day_key === dayD);
  const resD1 = res.find(x => x.day_key === dayD1);
  assert.equal(resD.slots_consumed, 0, "the day-D reservation was not consumed by a day-D+1 dispatch");
  assert.equal(resD1.slots_consumed, 1);
  assert.equal(resD1.slots_total, 12);
  assert.equal(derivedDayTotals(w.h.coord, dayD).dispatched, 0);
  assert.equal(derivedDayTotals(w.h.coord, dayD1).dispatched, 1);
});

// ------------------------------------------------------------------
// Invariant 4 — failure injection for the crash window AFTER the
// markDispatching transaction commits but BEFORE the provider
// fetch: the attempt is an authorized/potential dispatch that
// provably never reached the provider (zero calls), and it still
// counts — conservatively, permanently. (The row records an
// AUTHORIZED dispatch, not proof the call arrived; the
// unknown-charge distinction is preserved: the execution lands
// in reconcile_hold, never silently freed.)
test("crash window: kill after the dispatch commit, before the fetch — zero provider calls, still counted", async () => {
  const w = await makeWorld({ segments: [{ occurrenceId: "o1", text: TEXT1 }] });
  const killingStore = { ...w.store,
    markDispatching: async (attemptId) => {
      const row = await w.store.markDispatching(attemptId); // the transaction COMMITS
      throw new Error("SIMULATED KILL after dispatch commit");
      return row;
    } };
  const execKill = w.mkExec({ store: killingStore });
  const r = await execKill.handleMessage(w.msg);
  assert.equal(r.stoppedUnknownBilling, true);
  assert.equal(w.providers.calls.length, 0, "the provider was never contacted");
  assert.equal(dispatches(w.h).length, 1, "the dispatch record stands");
  assert.equal(attempts(w.h)[0].phase, "dispatching", "never confirmed, never released");
  const res = reservations(w.h)[0];
  assert.equal(res.slots_consumed, 1, "the slot stays consumed — conservative counting");
  assert.equal(res.state, "open", "nothing frees a possibly-charged dispatch");
  assert.equal(derivedDayTotals(w.h.coord, day(w.h)).dispatched, 1);
  // Restart: a fresh coordinator/store over the same state sees
  // identical accounting, and recovery holds the execution for
  // reconciliation instead of re-dispatching it.
  const coord2 = w.h.crash();
  const store2 = createGenStore(coord2);
  store2.ensureSchema();
  assert.equal(derivedDayTotals(coord2, day(w.h)).dispatched, 1);
  assert.equal(reconcileQuota(coord2).ok, true);
  const scan = store2.recoveryScan();
  assert.equal(scan.length, 1);
  assert.equal(scan[0].action, "reconcile_hold");
});

// ------------------------------------------------------------------
// §1.5 recovery legs: resuming a granted-but-never-run execution
// consumes against the ORIGINAL grant's reservation (no new
// reservation, recovery itself reserves nothing); if that
// reservation is already closed, the resume fails CLOSED — zero
// provider calls, the attempt released, the quota outcome taken.
test("recovery: a granted execution resumes under its original reservation", async () => {
  const w = await makeWorld({ segments: [{ occurrenceId: "o1", text: TEXT1 }] });
  const pre = w.store.createExecution({ planId: PLAN, jobId: JOB, occurrenceId: "o1", grantId: w.g.grantId });
  assert.equal(pre.execution.state, "granted");
  const r = await w.exec.handleMessage(w.msg);
  assert.equal(r.occurrences.o1.committed, true);
  assert.equal(reservations(w.h).length, 1, "no second reservation for the resumed execution");
  assert.equal(dispatches(w.h).length, 1);
  assert.equal(dispatches(w.h)[0].grant_id, w.g.grantId);
});

test("recovery: a closed reservation fails the resume closed — no provider call", async () => {
  const w = await makeWorld({ segments: [{ occurrenceId: "o1", text: TEXT1 }] });
  w.store.createExecution({ planId: PLAN, jobId: JOB, occurrenceId: "o1", grantId: w.g.grantId });
  // Force the defect state out-of-band (the closure fence makes
  // it unreachable through the system's own writes).
  w.h.db.prepare(`UPDATE d6_grant_reservations SET state = 'closed', close_reason = 'grant_settled'`).run();
  const r = await w.exec.handleMessage(w.msg);
  assert.equal(r.quotaExhausted, true);
  assert.equal(w.providers.calls.length, 0, "fail closed means the provider is never contacted");
  assert.equal(dispatches(w.h).length, 0);
  assert.equal(attempts(w.h)[0].phase, "released");
});
