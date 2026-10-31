// D6 QUOTA GUARD — store/coordinator-level suite for the
// provider-attempt budget (QUOTA-PROPOSAL.md as amended by
// QUOTA-ADDENDUM.md; DESIGN PASS 6544950778; Julie's build
// approval 6545090525). Covers addendum §5 tests T1, T2, T3, T7,
// T8 at the level they are specified, plus Rowan's acceptance
// invariants: the closure fence (invariant 3), counter-drift
// refusal, and the grants-vs-dispatches labeling law (§4).
// Executor-level T4/T5/T6 live in tests/quota-executor.test.mjs.
//
// All deterministic: the harness's injected clock, in-memory
// SQLite, zero provider calls (this suite never constructs a
// provider). Synthetic fixtures only.
//
// Run: node --test tests/quota-budget.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { makeHarness, makeProbe, occ, submit } from "./helpers/do-harness.mjs";
import { GenerationCoordinator, dayKeyPT } from "../worker/coordinator.mjs";
import { createGenStore } from "../worker/generation/genstore.mjs";
import {
  bootstrapQuota, disposeBootstrapException, reconcileQuota, quotaArmed,
  quotaBudgetView, derivedDayTotals, openReservations, closeReservation,
  settleReservationsForGrant, ptDayKey, QuotaBudgetRefusal, QUOTA_REFUSALS,
} from "../worker/generation/quota-budget.mjs";
import { PROVIDER_ATTEMPT_DAILY_LIMIT } from "../worker/generation/gen-constants.mjs";

const PLAN = "plan-q";
const PHASE = "forever-pucked";

function setup({ startMs } = {}) {
  const h = makeHarness({ probe: makeProbe(new Map()),
                          ...(startMs ? { startMs } : {}),
                          extraEnv: { d6StandardOnly: true } });
  const store = createGenStore(h.coord);
  store.ensureSchema();
  return { h, store };
}
function arm(h) { return bootstrapQuota(h.coord); }
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
const dispatches = (h) => h.rows("d6_provider_dispatches");
const attempts = (h) => h.rows("d6_attempt_log");
const today = (h) => ptDayKey(h.now());

// ------------------------------------------------------------------
// The PT day key: the quota module's local copy must agree with
// the coordinator's dayKeyPT over boundary instants (incl. DST).
test("ptDayKey agrees with coordinator dayKeyPT across DST boundaries", () => {
  const instants = [];
  for (let d = 0; d < 400; d++) {
    const base = Date.parse("2025-01-01T00:00:00Z") + d * 86400000;
    instants.push(base + 6.9 * 3600000, base + 7.1 * 3600000, base + 12 * 3600000);
  }
  for (const ms of instants) assert.equal(ptDayKey(ms), dayKeyPT(ms), `ms=${ms}`);
  // Pinned boundary facts (PDT): midnight PT is 07:00Z.
  assert.equal(ptDayKey(Date.parse("2026-03-10T06:59:00Z")), "2026-03-09");
  assert.equal(ptDayKey(Date.parse("2026-03-10T07:01:00Z")), "2026-03-10");
});

// ------------------------------------------------------------------
// Unarmed store: floor behavior — no tables, no reservations, the
// grant path and dispatch path exactly as the floor build's.
test("unarmed store: no quota tables, grants create no reservations, dispatch is legacy", async () => {
  const { h, store } = setup();
  const g = await grantJob(h, "job-1", ["o1"]);
  assert.equal(g.ok, true);
  assert.equal(quotaArmed(h.coord), false);
  const names = h.db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'd6_%'`).all().map(r => r.name);
  assert.ok(!names.includes("d6_grant_reservations"), "no reservation table before bootstrap");
  assert.ok(!names.includes("d6_provider_dispatches"), "no dispatch table before bootstrap");
  const e = store.createExecution({ planId: PLAN, jobId: "job-1", occurrenceId: "o1", grantId: g.grantId });
  const a = store.reserveAttempt(e.executionId, { upperMicroCents: 1 });
  const row = store.markDispatching(a);
  assert.equal(row.phase, "dispatching");
  assert.equal(row.dispatched_day_key, undefined, "column does not exist pre-bootstrap");
});

// ------------------------------------------------------------------
// T1 — Parallel grant transactions: two grants racing one day
// with combined demand over the limit. REVISED by correction 1
// (Rowan SOURCE HOLD 6545387295): the second grant is no longer
// refused outright — it is COHORT-BOUNDED to the day's remaining
// headroom (3 of 5 occurrences, 36 of 60 slots), the remainder
// staying pending on the same job. The no-partial-rows atomicity
// proof moves to a third job arriving when headroom is zero:
// its refusal leaves nothing behind. Plus grant replay.
test("T1 parallel grants: first passes whole; second is cohort-bounded; zero-headroom refusal leaves no partial rows; replay is a no-op", async () => {
  const { h } = setup();
  arm(h);
  const occsA = ["a1", "a2", "a3", "a4", "a5"];       // 5 x 12 = 60 slots
  const occsB = ["b1", "b2", "b3", "b4", "b5"];       // 60 more -> only 40 headroom
  const gA = await grantJob(h, "job-a", occsA);
  assert.equal(gA.ok, true);
  assert.equal(reservations(h).length, 5);
  assert.ok(reservations(h).every(r => r.slots_total === 12 && r.slots_consumed === 0 && r.state === "open"));
  assert.ok(reservations(h).every(r =>
    r.reservation_id === `qres:${gA.grantId}:${r.occurrence_id}:${today(h)}`));
  const totals1 = derivedDayTotals(h.coord, today(h));
  assert.deepEqual(totals1, { dayKey: today(h), dispatched: 0, reserved: 60, consumed: 60 });

  // B is bounded to the headroom: a prefix of 3 (36 slots ->
  // consumed 96); b4/b5 stay pending on the same job; the grant
  // that exists names exactly the bounded cohort.
  const gB = await grantJob(h, "job-b", occsB);
  assert.equal(gB.ok, true);
  assert.equal(gB.count, 3);
  const bOccs = h.rows("occurrences").filter(o => o.job_id === "job-b");
  assert.deepEqual(bOccs.filter(o => o.state === "granted").map(o => o.occurrence_id), ["b1", "b2", "b3"]);
  assert.deepEqual(bOccs.filter(o => o.state === "pending").map(o => o.occurrence_id), ["b4", "b5"]);
  assert.equal(reservations(h).filter(r => r.grant_id === gB.grantId).length, 3);
  assert.deepEqual(derivedDayTotals(h.coord, today(h)),
    { dayKey: today(h), dispatched: 0, reserved: 96, consumed: 96 });

  // C arrives with 4 slots of headroom — less than one fresh
  // occurrence's 12 — so its cohort is empty and the grant
  // refuses provider_attempt_budget with NO partial anything:
  // no grant row, no ledger rows, no reservations, its
  // occurrence still pending, totals unchanged.
  const totalsBeforeC = derivedDayTotals(h.coord, today(h));
  const gC = await grantJob(h, "job-c", ["c1"]);
  assert.equal(gC.ok, false);
  assert.equal(gC.reason, "provider_attempt_budget");
  assert.equal(h.rows("grants").filter(r => r.job_id === "job-c").length, 0);
  assert.equal(h.rows("ledger_ops").filter(r => String(r.op_key || "").includes("job-c")).length, 0);
  assert.equal(reservations(h).filter(r => r.grant_id.includes("job-c")).length, 0);
  assert.ok(h.rows("occurrences").filter(o => o.job_id === "job-c").every(o => o.state === "pending"));
  assert.deepEqual(derivedDayTotals(h.coord, today(h)), totalsBeforeC, "totals unchanged by the refused grant");

  // Replay of A's grant: refused by the base path; the invariant
  // that matters is that no second reservation can appear
  // (identity, §1.2).
  const replay = await h.coord.requestGrant("job-a");
  assert.equal(replay.ok, false);
  assert.equal(reservations(h).length, 8);
});

// ------------------------------------------------------------------
// T2 — Duplicate / out-of-order markDispatching.
test("T2 duplicate and out-of-order dispatch transitions consume nothing extra", async () => {
  const { h, store } = setup();
  arm(h);
  const g = await grantJob(h, "job-1", ["o1"]);
  const e = store.createExecution({ planId: PLAN, jobId: "job-1", occurrenceId: "o1", grantId: g.grantId });
  const a1 = store.reserveAttempt(e.executionId, { upperMicroCents: 10 });
  const row = store.markDispatching(a1);
  assert.equal(row.phase, "dispatching");
  assert.equal(row.dispatched_day_key, today(h));
  assert.equal(dispatches(h).length, 1);
  assert.equal(dispatches(h)[0].attempt_id, a1);
  assert.equal(reservations(h)[0].slots_consumed, 1);

  // Duplicate dispatch: the base transition guard throws; no
  // second dispatch row, no second slot.
  assert.throws(() => store.markDispatching(a1), /illegal_attempt_transition/);
  assert.equal(dispatches(h).length, 1);
  assert.equal(reservations(h)[0].slots_consumed, 1);

  // Confirm before dispatch: throws, consumes nothing.
  const a2 = store.reserveAttempt(e.executionId, { upperMicroCents: 10 });
  assert.throws(() => store.confirmAttempt(a2, { outcome: "success", costMicroCents: 1 }),
    /illegal_attempt_transition/);
  assert.equal(dispatches(h).length, 1);

  // Dispatch of a released attempt: throws, consumes nothing.
  store.releaseAttempt(a2);
  assert.throws(() => store.markDispatching(a2), /illegal_attempt_transition/);
  assert.equal(dispatches(h).length, 1);
  assert.equal(reservations(h)[0].slots_consumed, 1);
  assert.deepEqual(derivedDayTotals(h.coord, today(h)),
    { dayKey: today(h), dispatched: 1, reserved: 11, consumed: 12 });
});

// ------------------------------------------------------------------
// Counter drift (invariant: the stored slots_consumed is verified
// against the derived count at every consumption; drift refuses).
test("counter drift: a corrupted slots_consumed refuses dispatch and consumes nothing", async () => {
  const { h, store } = setup();
  arm(h);
  const g = await grantJob(h, "job-1", ["o1"]);
  const e = store.createExecution({ planId: PLAN, jobId: "job-1", occurrenceId: "o1", grantId: g.grantId });
  const a1 = store.reserveAttempt(e.executionId, { upperMicroCents: 10 });
  store.markDispatching(a1);
  store.confirmAttempt(a1, { outcome: "success", costMicroCents: 5 });
  // Out-of-band corruption of the one stored counter.
  h.db.prepare(`UPDATE d6_grant_reservations SET slots_consumed = 7`).run();
  const a2 = store.reserveAttempt(e.executionId, { upperMicroCents: 10 });
  assert.throws(() => store.markDispatching(a2),
    (err) => err.quotaBudgetRefusal === true && err.reason === QUOTA_REFUSALS.COUNTER_DRIFT);
  assert.equal(attempts(h).find(a => a.attempt_id === a2).phase, "reserved",
    "the refused attempt stays reserved — the transaction rolled back");
  assert.equal(dispatches(h).length, 1, "no second dispatch row");
  const rec = reconcileQuota(h.coord);
  assert.equal(rec.ok, false);
  assert.equal(rec.drift[0].kind, "slots_consumed_mismatch");
});

// ------------------------------------------------------------------
// Closure fence (Rowan invariant 3): a reservation must not close
// while its grant/occurrence can still dispatch — asserted, not
// prose. Covers dispatch-capable, unknown-billing, and
// post-synthesis execution states.
test("closure fence: dispatch-capable and unknown executions block closure; terminal/post-synthesis do not", async () => {
  const { h, store } = setup();
  arm(h);
  const g = await grantJob(h, "job-1", ["o1", "o2", "o3"]);
  const resFor = (oid) => reservations(h).find(r => r.occurrence_id === oid);

  // 'attempted' execution: dispatch still reachable -> blocked.
  const e1 = store.createExecution({ planId: PLAN, jobId: "job-1", occurrenceId: "o1", grantId: g.grantId });
  store.transitionExecution(e1.executionId, "attempted");
  let out = closeReservation(h.coord, resFor("o1").reservation_id, "grant_settled");
  assert.equal(out.closed, false);
  assert.equal(out.blocked, "execution_dispatch_capable");
  assert.equal(resFor("o1").state, "open");
  // Execution terminal -> closure succeeds; second close is a no-op.
  store.transitionExecution(e1.executionId, "failed", { stage: "test" });
  out = closeReservation(h.coord, resFor("o1").reservation_id, "grant_settled");
  assert.equal(out.closed, true);
  assert.equal(out.reservation.close_reason, "grant_settled");
  out = closeReservation(h.coord, resFor("o1").reservation_id, "grant_settled");
  assert.deepEqual([out.closed, out.alreadyClosed], [false, true]);

  // 'unknown_billing': blocks grant_settled; blocks halt_settled
  // while the unknown attempt is open; closes as halt_settled
  // once the unknown is disposed.
  const e2 = store.createExecution({ planId: PLAN, jobId: "job-1", occurrenceId: "o2", grantId: g.grantId });
  store.transitionExecution(e2.executionId, "attempted");
  const a2 = store.reserveAttempt(e2.executionId, { upperMicroCents: 10 });
  store.markDispatching(a2);
  store.confirmAttempt(a2, { outcome: "unknown", costMicroCents: null });
  store.transitionExecution(e2.executionId, "unknown_billing");
  out = closeReservation(h.coord, resFor("o2").reservation_id, "grant_settled");
  assert.equal(out.closed, false);
  assert.equal(out.blocked, "execution_unknown_billing");
  out = closeReservation(h.coord, resFor("o2").reservation_id, "halt_settled");
  assert.equal(out.closed, false);
  assert.equal(out.blocked, "unknown_billing_open");
  // Simulate the disposition (the attempt leaves 'unknown').
  h.db.prepare(`UPDATE d6_attempt_log SET outcome = 'estimated_unverified'
                 WHERE attempt_id = ?`).run(a2);
  out = closeReservation(h.coord, resFor("o2").reservation_id, "halt_settled");
  assert.equal(out.closed, true);
  assert.equal(out.reservation.close_reason, "halt_settled");

  // 'synthesized': no provider call remains (commit path only)
  // -> never blocks.
  const e3 = store.createExecution({ planId: PLAN, jobId: "job-1", occurrenceId: "o3", grantId: g.grantId });
  store.transitionExecution(e3.executionId, "attempted");
  store.transitionExecution(e3.executionId, "synthesized");
  out = closeReservation(h.coord, resFor("o3").reservation_id, "grant_settled");
  assert.equal(out.closed, true);
});

// ------------------------------------------------------------------
// §1.5 recovery defect case: a non-terminal execution whose
// reservation is already closed fails CLOSED at dispatch — no new
// reservation is minted.
test("recovery with a closed reservation fails closed at dispatch (no silent re-reservation)", async () => {
  const { h, store } = setup();
  arm(h);
  const g = await grantJob(h, "job-1", ["o1"]);
  // Force the defect state out-of-band (the fence makes it
  // unreachable through the system's own writes).
  h.db.prepare(`UPDATE d6_grant_reservations SET state = 'closed', close_reason = 'grant_settled'`).run();
  const e = store.createExecution({ planId: PLAN, jobId: "job-1", occurrenceId: "o1", grantId: g.grantId });
  const a = store.reserveAttempt(e.executionId, { upperMicroCents: 10 });
  assert.throws(() => store.markDispatching(a),
    (err) => err.quotaBudgetRefusal === true && err.reason === QUOTA_REFUSALS.UNRESERVED);
  assert.equal(attempts(h)[0].phase, "reserved");
  assert.equal(dispatches(h).length, 0);
});

// ------------------------------------------------------------------
// T3 — Bootstrap: exact assignment where the evidence allows,
// exceptions never guessed, a current-day straddle refuses the
// day until dispositioned.
const T3_NOW = Date.parse("2026-03-12T20:00:00Z"); // PT day 2026-03-12
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

test("T3 bootstrap: intra-day and dispatching rows assign exactly; a past-day straddle is a reported exception and does not block", async () => {
  const { h } = setup({ startMs: T3_NOW });
  insertPlan(h);
  // Intra-day confirmed: dispatch lies inside 2026-03-10.
  seedAttempt(h, { attId: "att-intra", execId: "exec-intra", occId: "oh1", phase: "confirmed",
    outcome: "success", cost: 42,
    created: Date.parse("2026-03-10T08:00:00Z"), updated: Date.parse("2026-03-10T09:00:00Z"),
    grantId: "grant:hist:1:full" });
  // Still dispatching: updated_at IS the dispatch moment.
  seedAttempt(h, { attId: "att-disp", execId: "exec-disp", occId: "oh2", phase: "dispatching",
    created: Date.parse("2026-03-11T06:00:00Z"), updated: Date.parse("2026-03-11T06:30:00Z"),
    grantId: "grant:hist:1:full" });
  // Straddler confined to past days [2026-03-08, 2026-03-09].
  seedAttempt(h, { attId: "att-straddle", execId: "exec-straddle", occId: "oh3", phase: "confirmed",
    outcome: "success", cost: 42,
    created: Date.parse("2026-03-09T06:30:00Z"), updated: Date.parse("2026-03-09T07:30:00Z"),
    grantId: "grant:hist:1:full" });
  // Reserved: never dispatched, correctly NULL forever, no exception.
  seedAttempt(h, { attId: "att-res", execId: "exec-res", occId: "oh4", phase: "reserved",
    created: Date.parse("2026-03-10T08:00:00Z"), updated: Date.parse("2026-03-10T08:00:00Z"),
    grantId: "grant:hist:1:full" });

  const boot = arm(h);
  assert.equal(boot.assigned, 2);
  assert.equal(boot.exceptions.length, 1);
  assert.equal(boot.exceptions[0].attemptId, "att-straddle");
  const byId = Object.fromEntries(attempts(h).map(a => [a.attempt_id, a]));
  assert.equal(byId["att-intra"].dispatched_day_key, "2026-03-10");
  assert.equal(byId["att-disp"].dispatched_day_key, "2026-03-10"); // updated 2026-03-11T06:30Z = 2026-03-10 23:30 PDT
  assert.equal(byId["att-straddle"].dispatched_day_key, null, "never guessed");
  assert.equal(byId["att-res"].dispatched_day_key, null);
  assert.equal(dispatches(h).length, 2, "bootstrap writes ledger rows for assignable history");
  assert.equal(derivedDayTotals(h.coord, "2026-03-10").dispatched, 2);
  // The current day is NOT blocked by a past-day exception, and
  // the day's grants proceed.
  const view = quotaBudgetView(h.coord);
  assert.equal(view.currentDayBlocked, false);
  assert.equal(view.bootstrapExceptions, 1);
  const g = await grantJob(h, "job-new", ["n1"]);
  assert.equal(g.ok, true);
  // Idempotence: a second bootstrap assigns nothing, changes nothing.
  const totalsBefore = derivedDayTotals(h.coord, "2026-03-10");
  const boot2 = bootstrapQuota(h.coord);
  assert.equal(boot2.alreadyArmed, true);
  assert.equal(boot2.assigned, 0);
  assert.deepEqual(derivedDayTotals(h.coord, "2026-03-10"), totalsBefore);
});

test("T3 bootstrap: a straddle whose interval includes the CURRENT day refuses grants and dispatches; a multi-day disposition is refused (hold B) and the block expires with time", async () => {
  const { h, store } = setup({ startMs: T3_NOW }); // current PT day 2026-03-12
  insertPlan(h);
  seedAttempt(h, { attId: "att-straddle-now", execId: "exec-straddle-now", occId: "oh9",
    phase: "confirmed", outcome: "success", cost: 42,
    created: Date.parse("2026-03-12T06:30:00Z"),   // PT 2026-03-11 23:30
    updated: Date.parse("2026-03-12T07:30:00Z"),   // PT 2026-03-12 00:30
    grantId: "grant:hist:1:full" });
  const boot = arm(h);
  assert.equal(boot.exceptions.length, 1);
  assert.equal(quotaBudgetView(h.coord).currentDayBlocked, true);

  const g = await grantJob(h, "job-new", ["n1"]);
  assert.equal(g.ok, false);
  assert.equal(g.reason, "provider_attempt_budget_bootstrap_incomplete");
  assert.equal(reservations(h).length, 0, "the refused grant created no reservation");

  // Dispatch is refused too (fixture reservation + execution
  // inserted directly, as a pre-bootstrap grant would leave them).
  const t = h.now();
  h.db.prepare(`INSERT INTO d6_grant_reservations
      (reservation_id, grant_id, occurrence_id, plan_id, job_id, day_key,
       slots_total, slots_consumed, state, created_at, updated_at)
    VALUES ('qres:grant:hist:1:full:oh9:2026-03-12', 'grant:hist:1:full', 'oh9', ?, 'job-hist',
            '2026-03-12', 11, 0, 'open', ?, ?)`)
    .run(PLAN, t, t);
  const e = store.createExecution({ planId: PLAN, jobId: "job-hist", occurrenceId: "oh9", grantId: "grant:hist:1:full" });
  const a = store.reserveAttempt(e.executionId, { upperMicroCents: 10 });
  assert.throws(() => store.markDispatching(a),
    (err) => err.quotaBudgetRefusal === true && err.reason === QUOTA_REFUSALS.BOOTSTRAP_INCOMPLETE);
  assert.equal(attempts(h).find(x => x.attempt_id === a).phase, "reserved");

  // Re-review hold B (Rowan 6545597263): the straddler's day
  // CANNOT be settled by disposition any more. Its interval
  // spans two PT days, so either in-interval choice is an
  // assertion, not proof — a nonblank authorization reference
  // does not cure it. Both choices refuse, and the refusals
  // change nothing: the exception, the block, and the reserved
  // attempt all stand exactly as before. (Disposition remains
  // available for SAME-DAY intervals, whose day is provable;
  // that path is exercised in quota-corrections C2 and in T8,
  // whose floor dispatch is same-day by construction.)
  assert.throws(() => disposeBootstrapException(h.coord, "att-straddle-now",
    { dayKey: "2026-03-12", authorizationRef: "test-operator-ref", note: "fixture disposition" }),
    /quota_disposition_ambiguous_interval/);
  assert.throws(() => disposeBootstrapException(h.coord, "att-straddle-now",
    { dayKey: "2026-03-11", authorizationRef: "test-operator-ref" }),
    /quota_disposition_ambiguous_interval/);
  assert.equal(quotaBudgetView(h.coord).currentDayBlocked, true);
  assert.equal(quotaBudgetView(h.coord).bootstrapExceptions, 1);
  assert.equal(attempts(h).find(x => x.attempt_id === "att-straddle-now").dispatched_day_key, null,
    "the straddler's day was never guessed");
  assert.equal(attempts(h).find(x => x.attempt_id === a).phase, "reserved",
    "the refused dispatch stays refused");

  // The block expires naturally with time: on the next PT day
  // the interval no longer covers the current day, grants
  // proceed, and the exception remains on the record.
  h.setNow(Date.parse("2026-03-13T20:00:00Z"));
  assert.equal(quotaBudgetView(h.coord).currentDayBlocked, false);
  assert.equal(quotaBudgetView(h.coord).bootstrapExceptions, 1,
    "the exception is preserved — never erased, never guessed");
  const g2 = await h.coord.requestGrant("job-new");
  assert.equal(g2.ok, true);
});

// ------------------------------------------------------------------
// T7 — Orphaned reservations: void closes exactly once; an
// aborted-after-grant reservation stays open and VISIBLE until
// settlement; a crash between grant and dispatch loses nothing.
test("T7 orphans: void closes exactly once; abort stays visible; crash preserves the reservation", async () => {
  const { h, store } = setup();
  arm(h);
  // (i) Grant voided before dispatch.
  const gv = await grantJob(h, "job-void", ["v1"]);
  assert.equal(reservations(h).length, 1);
  h.coord._voidDispatch({ grantId: gv.grantId, jobId: "job-void" }, "cancelled");
  assert.equal(reservations(h)[0].state, "closed");
  assert.equal(reservations(h)[0].close_reason, "grant_voided");
  assert.equal(derivedDayTotals(h.coord, today(h)).reserved, 0);
  // Second void/settle passes are no-ops — never a second credit.
  h.coord._voidDispatch({ grantId: gv.grantId, jobId: "job-void" }, "cancelled");
  settleReservationsForGrant(h.coord, gv.grantId);
  assert.equal(reservations(h)[0].close_reason, "grant_voided");
  assert.equal(derivedDayTotals(h.coord, today(h)).reserved, 0);

  // (ii) Aborted after grant: execution created, attempt
  // reserved, message dies. The reservation stays open and is
  // enumerated by identity — an orphan, never silently dropped.
  const ga = await grantJob(h, "job-abort", ["a1"]);
  const e = store.createExecution({ planId: PLAN, jobId: "job-abort", occurrenceId: "a1", grantId: ga.grantId });
  store.reserveAttempt(e.executionId, { upperMicroCents: 10 });
  const open = openReservations(h.coord);
  assert.equal(open.length, 1);
  assert.equal(open[0].reservation_id, `qres:${ga.grantId}:a1:${today(h)}`);
  assert.equal(quotaBudgetView(h.coord).openReservations, 1);
  // Settlement frees it exactly once, when dispatch is impossible.
  store.failExecution(e.executionId, "interrupted");
  const s1 = settleReservationsForGrant(h.coord, ga.grantId);
  assert.deepEqual(s1.closed, [open[0].reservation_id]);
  const s2 = settleReservationsForGrant(h.coord, ga.grantId);
  assert.deepEqual(s2.closed, []);

  // (iii) Crash between grant and dispatch: the reservation and
  // its accounting survive a coordinator restart intact.
  const gc = await grantJob(h, "job-crash", ["c1"]);
  const before = derivedDayTotals(h.coord, today(h));
  const coord2 = h.crash();
  const store2 = createGenStore(coord2);
  store2.ensureSchema();
  assert.equal(quotaArmed(coord2), true);
  assert.deepEqual(derivedDayTotals(coord2, today(h)), before);
  const e2 = store2.createExecution({ planId: PLAN, jobId: "job-crash", occurrenceId: "c1", grantId: gc.grantId });
  const a2 = store2.reserveAttempt(e2.executionId, { upperMicroCents: 10 });
  const row = store2.markDispatching(a2);
  assert.equal(row.phase, "dispatching");
  assert.equal(derivedDayTotals(coord2, today(h)).dispatched, before.dispatched + 1);
});

// ------------------------------------------------------------------
// T8 — Rollback / re-arm: the floor build does not enforce (and
// never writes) the quota ledgers; reconciliation after the
// window reproduces totals exactly when the floor dispatched
// nothing, and DETECTS a floor dispatch as an exception rather
// than absorbing it; no counter resets across bootstrap re-runs
// or clock changes.
test("T8 rollback window: floor writes leave ledgers untouched; reconciliation detects a floor dispatch; re-arm reproduces totals", async () => {
  const { h, store } = setup();
  arm(h);
  const g = await grantJob(h, "job-1", ["o1"]);
  const e = store.createExecution({ planId: PLAN, jobId: "job-1", occurrenceId: "o1", grantId: g.grantId });
  const a1 = store.reserveAttempt(e.executionId, { upperMicroCents: 10 });
  store.markDispatching(a1);
  store.confirmAttempt(a1, { outcome: "success", costMicroCents: 5 });
  const day = today(h);
  const totalsBefore = derivedDayTotals(h.coord, day);
  assert.deepEqual(totalsBefore, { dayKey: day, dispatched: 1, reserved: 11, consumed: 12 });
  assert.equal(reconcileQuota(h.coord).ok, true);
  const ledgerSnapshot = JSON.stringify({
    d: dispatches(h), r: reservations(h),
  });

  // FLOOR WINDOW, no dispatch (halt + pause holds in force, the
  // only safe rollback shape): legacy reads run, ledgers are
  // byte-identical afterward, and the floor's own grant counter
  // never saw the quota tables.
  h.coord.quotaView();
  h.coord._attemptsOn(day);
  assert.equal(JSON.stringify({ d: dispatches(h), r: reservations(h) }), ledgerSnapshot);

  // FLOOR WINDOW, a dispatch happens anyway (the holds were
  // violated): the floor's markDispatching is a bare phase UPDATE
  // — it writes no dispatch row, consumes no slot, and stamps no
  // day. Simulated here with the floor's exact statements.
  const e2 = store.createExecution({ planId: PLAN, jobId: "job-1", occurrenceId: "o1", grantId: "grant:floor:1:full" });
  const a2 = store.reserveAttempt(e2.executionId, { upperMicroCents: 10 });
  const t = h.now();
  h.db.prepare(`UPDATE d6_attempt_log SET phase = 'dispatching', updated_at = ? WHERE attempt_id = ?`).run(t, a2);
  h.db.prepare(`UPDATE d6_attempt_log SET phase = 'confirmed', outcome = 'success',
                  cost_micro_cents = 5, updated_at = ? WHERE attempt_id = ?`).run(t, a2);
  assert.equal(JSON.stringify({ d: dispatches(h), r: reservations(h) }), ledgerSnapshot,
    "the floor's dispatch wrote nothing to the quota ledgers");

  // RE-ARM: reconciliation does NOT reproduce the pre-rollback
  // totals silently — the floor dispatch surfaces as an
  // exception, and (its interval is today) the day is blocked.
  // REVISED by correction 3 (Rowan SOURCE HOLD 6545387295):
  // reconcileQuota.ok now means genuinely safe for rearm, so a
  // current-day exception makes it false EVEN THOUGH no stored
  // counter drifted — the drift detail is still reported
  // separately (empty here), as are the exception and the block.
  const rec = reconcileQuota(h.coord);
  assert.equal(rec.ok, false, "a current-day exception is not safe to rearm over");
  assert.deepEqual(rec.drift, [], "no stored counter drifted — reported separately from ok");
  assert.equal(rec.exceptions.length, 1);
  assert.equal(rec.exceptions[0].attemptId, a2);
  assert.equal(rec.currentDayBlocked, true);
  const gBlocked = await grantJob(h, "job-2", ["o2"]);
  assert.equal(gBlocked.ok, false);
  assert.equal(gBlocked.reason, "provider_attempt_budget_bootstrap_incomplete");

  // Disposition assigns the day; totals then reproduce exactly
  // (pre-rollback totals + the one now-attributed dispatch). The
  // floor dispatch really consumed a slot of the original
  // reservation, so the disposition realigns its stored counter
  // to the derived count — recorded on the disposition itself
  // (an auditable reconciliation, never a silent reset).
  const disp = disposeBootstrapException(h.coord, a2,
    { dayKey: day, authorizationRef: "test-operator-ref" });
  assert.deepEqual(disp.slotsReconciled,
    { reservationId: reservations(h)[0].reservation_id, from: 1, to: 2 });
  assert.equal(reservations(h)[0].slots_consumed, 2);
  const rec2 = reconcileQuota(h.coord);
  assert.equal(rec2.ok, true);
  assert.equal(rec2.exceptions.length, 0);
  assert.equal(rec2.currentDayBlocked, false);
  // The floor dispatch converted one RESERVED slot into a
  // DISPATCHED one: the day total is unchanged (12) — it was
  // always inside the envelope, only misclassified.
  assert.deepEqual(derivedDayTotals(h.coord, day),
    { dayKey: day, dispatched: 2, reserved: 10, consumed: 12 });

  // No silent reset: re-running bootstrap and swinging the
  // injected clock back and forth changes no recorded total.
  bootstrapQuota(h.coord);
  h.advance(3 * 86400000);
  h.advance(-3 * 86400000);
  assert.deepEqual(derivedDayTotals(h.coord, day),
    { dayKey: day, dispatched: 2, reserved: 10, consumed: 12 });
});

// ------------------------------------------------------------------
// T6 (store leg) — Cross-day continuation at the transaction
// level: a dispatch on day D+1 under a day-D grant re-reserves
// atomically (a second row stamped D+1; the day-D row untouched
// and still holding its reservation); a second dispatch reuses
// the D+1 reservation; when D+1 cannot fund the re-reservation
// the dispatch refuses and the attempt stays reserved.
test("T6 store leg: cross-day re-reservation is atomic, reused, and refuses when the new day is full", async () => {
  const D_START = Date.parse("2026-03-10T06:30:00Z");   // 2026-03-09 23:30 PDT
  const D1_START = Date.parse("2026-03-10T07:30:00Z");  // 2026-03-10 00:30 PDT
  const dayD = ptDayKey(D_START), dayD1 = ptDayKey(D1_START);
  const { h, store } = setup({ startMs: D_START });
  arm(h);
  const g = await grantJob(h, "job-1", ["o1"]);
  assert.equal(reservations(h)[0].day_key, dayD);
  h.setNow(D1_START);
  const e = store.createExecution({ planId: PLAN, jobId: "job-1", occurrenceId: "o1", grantId: g.grantId });
  const a1 = store.reserveAttempt(e.executionId, { upperMicroCents: 10 });
  const row1 = store.markDispatching(a1);
  assert.equal(row1.dispatched_day_key, dayD1);
  assert.equal(reservations(h).length, 2);
  const resD = reservations(h).find(r => r.day_key === dayD);
  const resD1 = reservations(h).find(r => r.day_key === dayD1);
  assert.deepEqual([resD.slots_consumed, resD.state], [0, "open"],
    "the day-D reservation is untouched and still holds its slots");
  assert.deepEqual([resD1.slots_total, resD1.slots_consumed], [12, 1]);
  assert.equal(derivedDayTotals(h.coord, dayD).reserved, 12,
    "the day-D reservation still counts against day D while open");
  assert.equal(derivedDayTotals(h.coord, dayD).dispatched, 0);
  assert.equal(derivedDayTotals(h.coord, dayD1).dispatched, 1);
  // A second dispatch (a split leaf) reuses the D+1 reservation.
  store.confirmAttempt(a1, { outcome: "success", costMicroCents: 5 });
  const a2 = store.reserveAttempt(e.executionId, { upperMicroCents: 10 });
  store.markDispatching(a2);
  assert.equal(reservations(h).length, 2, "no third reservation row");
  assert.equal(reservations(h).find(r => r.day_key === dayD1).slots_consumed, 2);

  // Exhaustion leg: a fresh world where day D+1 is already full.
  const w2 = setup({ startMs: D_START });
  arm(w2.h);
  const gOld = await grantJob(w2.h, "job-old", ["x1"]);
  w2.h.setNow(D1_START);
  await grantJob(w2.h, "job-fill", ["f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8"]); // 96 of 100 on D+1
  const eOld = w2.store.createExecution({ planId: PLAN, jobId: "job-old", occurrenceId: "x1", grantId: gOld.grantId });
  const aOld = w2.store.reserveAttempt(eOld.executionId, { upperMicroCents: 10 });
  assert.throws(() => w2.store.markDispatching(aOld),
    (err) => err.quotaBudgetRefusal === true && err.reason === QUOTA_REFUSALS.DAY_ROLLOVER);
  assert.equal(attempts(w2.h).find(a => a.attempt_id === aOld).phase, "reserved",
    "the refused attempt is undispatched — the transaction rolled back whole");
  assert.equal(dispatches(w2.h).filter(d => d.grant_id === gOld.grantId).length, 0);
  assert.equal(reservations(w2.h).filter(r => r.grant_id === gOld.grantId).length, 1,
    "only the original day-D reservation exists");
});

// ------------------------------------------------------------------
// §4 labeling: grants and dispatches are distinct figures on the
// quota view; the limit is labeled an app-selected cap. Unarmed
// views carry no provider fields (floor-identical).
test("labeling: quotaView distinguishes grants from dispatches and labels the cap as app-selected", async () => {
  const { h, store } = setup();
  assert.equal(h.coord.quotaView().providerDispatchesToday, undefined, "unarmed: floor-identical view");
  arm(h);
  const g = await grantJob(h, "job-1", ["o1"]);
  const e = store.createExecution({ planId: PLAN, jobId: "job-1", occurrenceId: "o1", grantId: g.grantId });
  for (let i = 0; i < 2; i++) {
    const a = store.reserveAttempt(e.executionId, { upperMicroCents: 10 });
    store.markDispatching(a);
    store.confirmAttempt(a, { outcome: "success", costMicroCents: 5 });
  }
  const view = h.coord.quotaView();
  assert.equal(view.attemptsToday, 1, "grants today (the estimate ledger's count)");
  assert.equal(view.providerDispatchesToday, 2, "Reader D6 provider requests today, app-counted");
  assert.equal(view.providerReservedToday, 10);
  assert.equal(view.providerAttemptDailyLimit, PROVIDER_ATTEMPT_DAILY_LIMIT);
  assert.match(view.providerBasis, /app-counted/);
  assert.match(view.providerLimitProvenance, /app-selected/);
  assert.equal(PROVIDER_ATTEMPT_DAILY_LIMIT, 100);
});
