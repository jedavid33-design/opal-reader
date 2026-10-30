// CH2 DISPOSITION PACKAGE — the uncertainty disposition
// (UNCERTAINTY-DISPOSITION-DESIGN Rev 2; Rowan DESIGN PASS
// 6535393656; Julie's build approval 6535417583), store /
// service / guard level. Covers design §10 tests 1, 3, 4, 6, 7,
// 8, and the store/service halves of 10–15 (the route-level
// halves — tests 2, 5, 9, and the route inventory of 10 — live
// in ch2disp-route.test.mjs).
//
// Fixture numbers are chosen to discriminate: the disposed
// attempt's plan entry carries char_count 1000, whose OWN-LENGTH
// expectedCostMicro is 14,098 — visibly NOT the flat 19,652
// grant estimate (§5.2) — and the attempt row's recorded upper
// (23,000) deliberately differs from the plan entry's recorded
// upper (22,500), so the reservation's sourcing from the
// ATTEMPT ROW (§5.2) is proven, not assumed.
//
// All fixtures synthetic; no book text anywhere. This suite is
// the package's own candidate suite; no baseline suite is
// touched by it.
import test from "node:test";
import assert from "node:assert/strict";
import { makeHarness } from "./helpers/do-harness.mjs";
import { createGenStore, ATTEMPT_OUTCOMES } from "../worker/generation/genstore.mjs";
import * as genstoreModule from "../worker/generation/genstore.mjs";
import { createGenerationService } from "../worker/generation/service.mjs";
import { createCoordinatorPlaneSource } from "../worker/generation/content-plane-adapter.mjs";
import { d6GrantGuard, d6PhaseBudgetCheck } from "../worker/generation/grant-guards.mjs";
import { createGenStoreDouble } from "./helpers/d6-genstore-double.mjs";
import { expectedCostMicro } from "../worker/generation/gen-constants.mjs";

const PHASE = "forever-pucked"; // the one budgeted phase (13,500,000)
const BUDGET = 13_500_000;
const PLAN = "plan:disp-1";
const JOB = "plan:disp-1:ch1";
const OCC = "occ-disp-1";
const EXEC = "exec-disp-1";
const ATT = "att-disp-1";
const CHARS = 1000;
const ESTIMATE = expectedCostMicro(CHARS); // 14,098 — NOT 19,652
const ENTRY_UPPER = 22500;
const ATTEMPT_UPPER = 23000;
const AUTH = "julie-approval:fixture-6535417583";
const EVIDENCE = ["exhibit-a:fixture", "rowan-design-pass:6535393656"];

assert.equal(ESTIMATE, 14098, "fixture math: own-length estimate for 1000 chars");
assert.notEqual(ESTIMATE, 19652, "the estimate is NOT the flat grant estimate");

function seedPlan(h, { planId = PLAN, state = "halted_unknown", phase = PHASE } = {}) {
  h.db.prepare(`INSERT INTO d6_plans (plan_id, intent_key, book_id, scope,
      keep_going, phase, lane, state, stop_reason, eligible_digest,
      created_at, updated_at)
    VALUES (?, ?, 'book-disp', 'chapter', 0, ?, 'standard', ?,
      'phase_halted_unknown_billing', NULL, 1, 1)`)
    .run(planId, `intent-${planId}`, phase, state);
}
function seedEntry(h, { planId = PLAN, occ = OCC, chars = CHARS, upper = ENTRY_UPPER, jobId = JOB } = {}) {
  h.db.prepare(`INSERT INTO d6_plan_entries (plan_id, occurrence_id, book_id,
      chapter_id, chapter_index, position, pov_key, char_count,
      upper_micro_cents, disposition, job_id)
    VALUES (?, ?, 'book-disp', 'ch-1', 1, 0, 'pov-a', ?, ?, 'eligible', ?)`)
    .run(planId, occ, chars, upper, jobId);
}
function seedExecution(h, { execId = EXEC, planId = PLAN, jobId = JOB, occ = OCC } = {}) {
  h.db.prepare(`INSERT INTO d6_execution_records (execution_id, plan_id,
      job_id, occurrence_id, grant_id, state, stage, cache_key, object_key,
      etag, size_bytes, sha256, detail_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'grant-disp', 'unknown_billing', 'synthesis',
      NULL, NULL, NULL, NULL, NULL, '{"message":"simulated timeout"}', 1, 2)`)
    .run(execId, planId, jobId, occ);
}
function seedAttempt(h, { attId = ATT, execId = EXEC, planId = PLAN, occ = OCC,
                          phase = "confirmed", outcome = "unknown",
                          cost = null, upper = ATTEMPT_UPPER } = {}) {
  h.db.prepare(`INSERT INTO d6_attempt_log (attempt_id, execution_id, plan_id,
      occurrence_id, seq, phase, outcome, cost_micro_cents, upper_micro_cents,
      provider_request_id, detail_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, NULL, NULL, 1, 2)`)
    .run(attId, execId, planId, occ, phase, outcome, cost, upper);
}
function seedPhaseFlag(h, { phase = PHASE, set = 1 } = {}) {
  h.db.prepare(`INSERT INTO d6_phase_state (phase, halted_unknown_billing,
      halt_detail, updated_at) VALUES (?, ?, 'unknown billing', 1)`)
    .run(phase, set);
}

// The Ch 2 shape at fixture scale: one halted_unknown plan, one
// confirmed/unknown attempt (cost NULL), its execution record in
// unknown_billing, the phase flag set.
function makeWorld(extraEnv = {}) {
  const h = makeHarness({ extraEnv });
  const store = createGenStore(h.coord);
  store.ensureSchema();
  seedPlan(h); seedEntry(h); seedExecution(h); seedAttempt(h); seedPhaseFlag(h);
  const service = createGenerationService({
    coord: h.coord, env: { GENERATION_HALT: "1", ...extraEnv }, store,
    sources: createCoordinatorPlaneSource(h.coord),
  });
  return { h, store, service };
}

const one = (h, sql, ...p) => h.db.prepare(sql).get(...p);
const attemptRow = (h, id = ATT) =>
  one(h, `SELECT * FROM d6_attempt_log WHERE attempt_id = ?`, id);
const planRow = (h, id = PLAN) =>
  one(h, `SELECT * FROM d6_plans WHERE plan_id = ?`, id);
const phaseFlag = (h, phase = PHASE) =>
  one(h, `SELECT halted_unknown_billing FROM d6_phase_state WHERE phase = ?`, phase)
    ?.halted_unknown_billing;
const adjudicationRows = (h) => {
  const exists = one(h, `SELECT name FROM sqlite_master WHERE type='table'
                          AND name='d6_billing_adjudications'`);
  return exists ? h.db.prepare(`SELECT * FROM d6_billing_adjudications`).all() : [];
};
const tableNames = (h) => h.db.prepare(
  `SELECT name FROM sqlite_master WHERE type='table'`).all().map(r => r.name);
const SNAPSHOT_TABLES = ["grants", "claims", "transitions", "jobs", "occurrences",
  "d6_plans", "d6_plan_jobs", "d6_plan_entries", "d6_execution_records",
  "spend_intents", "d6_phase_state"];
const snapshot = (h) => JSON.stringify(
  SNAPSHOT_TABLES.map(t => [t, h.rows(t)]));

function dispose(w, over = {}) {
  return w.service.adjudicateEstimatedAttempt(ATT, {
    planId: PLAN, authorizationRef: AUTH, note: "fixture disposition",
    source: "operator-route", evidenceRefs: EVIDENCE, ...over,
  });
}

// ---------------------------------------------------------------
// §10 test 1 — happy path + write-set exactness.
// ---------------------------------------------------------------
test("disp-1 happy path: disposition applies with the exact write set", () => {
  const w = makeWorld();
  const execBefore = JSON.stringify(
    one(w.h, `SELECT * FROM d6_execution_records WHERE execution_id = ?`, EXEC));
  const before = snapshot(w.h);
  const r = dispose(w, { authorizationRef: `  ${AUTH}  ` });
  assert.equal(r.outcome, "applied");
  assert.equal(r.attemptOutcome, "estimated_unverified");
  assert.equal(r.attemptCostMicroCents, null, "the attempt's cost stays NULL");
  assert.equal(r.estimatedCostMicroCents, ESTIMATE);
  assert.equal(r.reservedCostMicroCents, ATTEMPT_UPPER,
    "the reservation is the ATTEMPT ROW's recorded upper (§5.2)");
  assert.equal(r.haltCleared, true, "this was the phase's last unadjudicated unknown");
  assert.deepEqual(r.adjudication, {
    attemptId: ATT, planId: PLAN, phase: PHASE, disposition: "estimated_unverified",
  });

  const a = attemptRow(w.h);
  assert.equal(a.outcome, "estimated_unverified");
  assert.equal(a.cost_micro_cents, null, "cost_micro_cents remains NULL — never written");
  assert.equal(phaseFlag(w.h), 0, "the phase unknown-billing flag cleared (Q1)");
  assert.equal(planRow(w.h).state, "halted_unknown",
    "the PLAN is untouched — settlement is not clearance");

  const adj = adjudicationRows(w.h);
  assert.equal(adj.length, 1, "exactly one adjudication row");
  assert.equal(adj[0].estimated_cost_micro_cents, ESTIMATE);
  assert.equal(adj[0].reserved_cost_micro_cents, ATTEMPT_UPPER);
  assert.equal(adj[0].authorization_ref, AUTH,
    "the authorization reference is recorded TRIMMED, verbatim");
  assert.equal(adj[0].source, "operator-route", "source is server-stamped");
  assert.deepEqual(JSON.parse(adj[0].evidence_refs), EVIDENCE);
  assert.equal(adj[0].current_amendment, 0);
  assert.ok(adj[0].estimate_basis.includes(`char_count=${CHARS}`),
    "basis records the derivation");
  assert.ok(adj[0].estimate_basis.includes(`upper_micro_cents=${ENTRY_UPPER}`),
    "basis records the plan entry's recorded upper (validated)");
  assert.ok(adj[0].estimate_basis.includes(`upper_micro_cents=${ATTEMPT_UPPER}`),
    "basis records the attempt row's recorded upper (the reservation source)");
  assert.ok(adj[0].estimate_basis.includes("19652 NOT used"),
    "basis states the flat grant estimate was NOT used");

  assert.equal(JSON.stringify(
    one(w.h, `SELECT * FROM d6_execution_records WHERE execution_id = ?`, EXEC)),
    execBefore, "the execution record is byte-identical (§9.2 provenance)");
  assert.equal(w.h.rows("d6_execution_records").length, 1, "no new execution rows");
  assert.equal(w.h.rows("grants").length, 0, "no grants created");
  assert.equal(w.h.rows("d6_plans").length, 1, "no new plans");
  assert.equal(w.h.rows("jobs").length, 0, "no new jobs");
  const after = snapshot(w.h);
  assert.notEqual(after, before, "the disposition did write its own set");
  // Every snapshot table except the attempt's own phase_state flag
  // row is byte-identical: the write set is exactly {attempt
  // outcome, adjudication row, phase flag}.
  const beforeMap = Object.fromEntries(JSON.parse(before));
  const afterMap = Object.fromEntries(JSON.parse(after));
  for (const t of SNAPSHOT_TABLES) {
    if (t === "d6_phase_state") continue;
    assert.equal(JSON.stringify(afterMap[t]), JSON.stringify(beforeMap[t]),
      `${t} untouched by the disposition`);
  }
});

// ---------------------------------------------------------------
// §10 test 3 — exactly-once.
// ---------------------------------------------------------------
test("disp-3 exactly-once: a second disposition refuses and changes nothing", () => {
  const w = makeWorld();
  assert.equal(dispose(w).outcome, "applied");
  const attemptBefore = JSON.stringify(attemptRow(w.h));
  const r2 = dispose(w);
  assert.equal(r2.outcome, "rejected");
  assert.equal(r2.reason, "attempt_not_unknown",
    "a disposed attempt is no longer unknown — the duplicate refusal");
  assert.equal(JSON.stringify(attemptRow(w.h)), attemptBefore);
  assert.equal(adjudicationRows(w.h).length, 1, "still exactly one adjudication row");
});

// ---------------------------------------------------------------
// §10 test 4 — cross-plan / wrong-plan / particulars refusals.
// Every refusal: zero state movement, zero audit rows, and —
// because every §4.1 validation precedes the step-7 schema
// ensure — the adjudication tables are never even created.
// ---------------------------------------------------------------
test("disp-4 refusal matrix: every refusal moves nothing and writes no audit", () => {
  const cases = [];
  { // wrong plan
    const w = makeWorld();
    cases.push([w, dispose(w, { planId: "plan:someone-else" }),
      "adjudication_plan_mismatch"]);
  }
  { // attempt in a non-halted plan
    const w = makeWorld();
    w.h.db.prepare(`UPDATE d6_plans SET state = 'active' WHERE plan_id = ?`).run(PLAN);
    cases.push([w, dispose(w), "adjudication_plan_not_halted_unknown"]);
  }
  { // unknown attempt id
    const w = makeWorld();
    cases.push([w, w.service.adjudicateEstimatedAttempt("att-nope", {
      planId: PLAN, authorizationRef: AUTH }),
      "attempt_not_found"]);
  }
  { // blank authorization reference
    const w = makeWorld();
    cases.push([w, dispose(w, { authorizationRef: "   " }),
      "adjudication_authorization_required"]);
  }
  for (const [label, mutate] of [
    ["no plan entry", (w) => w.h.db.prepare(
      `DELETE FROM d6_plan_entries WHERE plan_id = ?`).run(PLAN)],
    ["entry char_count NULL", (w) => w.h.db.prepare(
      `UPDATE d6_plan_entries SET char_count = NULL`).run()],
    ["entry char_count zero", (w) => w.h.db.prepare(
      `UPDATE d6_plan_entries SET char_count = 0`).run()],
    ["entry char_count negative", (w) => w.h.db.prepare(
      `UPDATE d6_plan_entries SET char_count = -5`).run()],
    ["entry char_count non-integer", (w) => w.h.db.prepare(
      `UPDATE d6_plan_entries SET char_count = 2.5`).run()],
    ["entry upper NULL", (w) => w.h.db.prepare(
      `UPDATE d6_plan_entries SET upper_micro_cents = NULL`).run()],
    ["entry upper negative", (w) => w.h.db.prepare(
      `UPDATE d6_plan_entries SET upper_micro_cents = -1`).run()],
    ["attempt upper NULL", (w) => w.h.db.prepare(
      `UPDATE d6_attempt_log SET upper_micro_cents = NULL`).run()],
    ["attempt upper negative", (w) => w.h.db.prepare(
      `UPDATE d6_attempt_log SET upper_micro_cents = -1`).run()],
    ["plan phase NULL", (w) => w.h.db.prepare(
      `UPDATE d6_plans SET phase = NULL WHERE plan_id = ?`).run(PLAN)],
    ["plan phase empty", (w) => w.h.db.prepare(
      `UPDATE d6_plans SET phase = '' WHERE plan_id = ?`).run(PLAN)],
  ]) {
    const w = makeWorld();
    mutate(w);
    const r = dispose(w);
    assert.equal(r.outcome, "rejected", label);
    assert.equal(r.reason, "adjudication_particulars_missing", label);
    cases.push([w, r, "adjudication_particulars_missing"]);
  }
  for (const [w, r, reason] of cases) {
    assert.equal(r.outcome, "rejected");
    assert.equal(r.reason, reason);
    assert.equal(attemptRow(w.h).outcome, "unknown", "the attempt is still unknown");
    assert.equal(attemptRow(w.h).cost_micro_cents, null);
    assert.equal(phaseFlag(w.h), 1, "the phase flag still stands");
    assert.equal(adjudicationRows(w.h).length, 0, "no audit rows from a refusal");
    assert.ok(!tableNames(w.h).includes("d6_billing_adjudications"),
      "a refused disposition never even creates the adjudication tables");
  }
});

// ---------------------------------------------------------------
// §10 test 6 — partial-mutation fault injection: a throw after
// the attempt UPDATE rolls the whole transaction back.
// ---------------------------------------------------------------
test("disp-6 fault injection: throw after the attempt UPDATE rolls back whole", () => {
  const w = makeWorld();
  const facade = w.h.state.storage.sql;
  const orig = facade.exec.bind(facade);
  facade.exec = (q, ...p) => {
    if (typeof q === "string" && q.includes("INSERT INTO d6_billing_adjudications"))
      throw new Error("injected_disposition_fault");
    return orig(q, ...p);
  };
  try {
    assert.throws(() => w.store.adjudicateEstimated(ATT, {
      planId: PLAN, authorizationRef: AUTH, source: "operator-route",
    }), /injected_disposition_fault/);
  } finally {
    delete facade.exec;
  }
  assert.equal(attemptRow(w.h).outcome, "unknown",
    "the attempt UPDATE rolled back with the transaction");
  assert.equal(phaseFlag(w.h), 1, "the phase flag is unchanged");
  assert.equal(adjudicationRows(w.h).length, 0, "no adjudication row survived");
  // And the store is fully usable afterwards: the disposition
  // applies cleanly once the fault is gone.
  assert.equal(dispose(w).outcome, "applied");
});

// ---------------------------------------------------------------
// §10 test 7 — accounting exactness + guard projection,
// including the discriminating case (estimate fits, reservation
// refuses). Two worlds: small figures (admit + remainder), and
// near-budget figures (the reservation is the deciding term).
// ---------------------------------------------------------------
function seedAccounting(w, { settledCost }) {
  // A second plan in the phase carrying the recorded/known
  // settled figure and an in-flight reserved attempt.
  seedPlan(w.h, { planId: "plan:disp-known", state: "complete" });
  seedExecution(w.h, { execId: "exec-known", planId: "plan:disp-known",
                       jobId: "job-known", occ: "occ-known" });
  w.h.db.prepare(`UPDATE d6_execution_records SET state = 'committed'
                   WHERE execution_id = 'exec-known'`).run();
  seedAttempt(w.h, { attId: "att-known", execId: "exec-known",
                     planId: "plan:disp-known", occ: "occ-known",
                     outcome: "success", cost: settledCost, upper: 999 });
  seedAttempt(w.h, { attId: "att-flight", execId: "exec-known",
                     planId: "plan:disp-known", occ: "occ-known",
                     phase: "reserved", outcome: null, cost: null, upper: 5000 });
  // The guard's job: a third, ACTIVE plan in the phase with one
  // pending eligible occurrence (pending upper 2,250).
  seedPlan(w.h, { planId: "plan:disp-guard", state: "active" });
  seedEntry(w.h, { planId: "plan:disp-guard", occ: "occ-g1", chars: 100,
                   upper: 2250, jobId: "job-guard" });
  w.h.db.prepare(`INSERT INTO d6_plan_jobs (plan_id, job_id, chapter_index, seq)
                   VALUES ('plan:disp-guard', 'job-guard', 1, 0)`).run();
  w.h.db.prepare(`INSERT INTO occurrences (job_id, occurrence_id, revision_key, state)
                   VALUES ('job-guard', 'occ-g1', 'rk-g1', 'pending')`).run();
}
const guardJob = { job_id: "job-guard", state: "queued", created_at: 0 };

test("disp-7a accounting exactness: all five figures + remainder + admit", () => {
  const w = makeWorld();
  seedAccounting(w, { settledCost: 17749 });
  assert.equal(w.store.phaseAccounting(PHASE).unknownOpen, 1,
    "one open unknown before the disposition");
  assert.equal(dispose(w).outcome, "applied");
  const acct = w.store.phaseAccounting(PHASE);
  assert.deepEqual(acct, {
    settledMicro: 17749,           // recorded/known only — the estimate never enters
    inFlightUpperMicro: 5000,
    unknownOpen: 0,                // reduced by exactly 1
    estimatedUnverifiedMicro: ESTIMATE,
    reservedUnverifiedMicro: ATTEMPT_UPPER,
  });
  const caps = w.service.capabilities();
  const phase = caps.phases.find(p => p.phase === PHASE);
  assert.equal(phase.estimatedUnverifiedMicroCents, ESTIMATE);
  assert.equal(phase.reservedUnverifiedMicroCents, ATTEMPT_UPPER);
  assert.equal(phase.remainingMicroCents,
    BUDGET - 17749 - ATTEMPT_UPPER - 5000,
    "the remainder subtracts the reservation (§6.2, Q4)");
  assert.deepEqual(d6GrantGuard(w.h.coord, guardJob), { ok: true },
    "the real guard admits when settled + reservation + in-flight + pending fit");
});

test("disp-7b discriminating case: the estimate would fit; the reservation refuses", () => {
  const w = makeWorld();
  // settled total 13,475,000: settled + in-flight (5,000) +
  // pending (2,250) = 13,482,250; + estimate (14,098) =
  // 13,496,348 <= budget (would ADMIT); + reservation (23,000) =
  // 13,505,250 > budget (REFUSES). The reservation decides.
  seedAccounting(w, { settledCost: 13_475_000 });
  assert.equal(dispose(w).outcome, "applied");
  const acct = w.store.phaseAccounting(PHASE);
  assert.equal(acct.settledMicro, 13_475_000);
  const withEstimate = d6PhaseBudgetCheck(
    { ...acct, reservedUnverifiedMicro: acct.estimatedUnverifiedMicro },
    2250, BUDGET);
  assert.deepEqual(withEstimate, { ok: true },
    "control: had the ESTIMATE gated, the grant would be admitted");
  assert.deepEqual(d6PhaseBudgetCheck(acct, 2250, BUDGET),
    { ok: false, reason: "phase_budget" },
    "the RESERVATION is the gating term (§6.2)");
  assert.deepEqual(d6GrantGuard(w.h.coord, guardJob),
    { ok: false, reason: "phase_budget" },
    "the real guard refuses on the reservation-inclusive projection");
  assert.equal(w.h.rows("grants").length, 0, "no grant issued");
});

// ---------------------------------------------------------------
// §10 test 8 — retirement after disposition; the guard is
// unchanged for a still-unknown attempt.
// ---------------------------------------------------------------
test("disp-8 retirement after disposition applies; before, it refuses", () => {
  const w = makeWorld();
  const early = w.service.retireHaltedPlan({ planId: PLAN, source: "operator-route" });
  assert.equal(early.outcome, "rejected");
  assert.equal(early.reason, "unknown_billing_open",
    "the retire guard's definition is unchanged (HOLD 2)");
  assert.equal(dispose(w).outcome, "applied");
  const r = w.service.retireHaltedPlan({
    planId: PLAN, source: "operator-route",
    note: `unknown attempt ${ATT} disposed estimated_unverified (adjudication recorded)`,
  });
  assert.equal(r.outcome, "applied");
  assert.equal(planRow(w.h).state, "retired");
  assert.equal(planRow(w.h).stop_reason, "retired_unknown_billing");
  const audit = w.h.rows("d6_plan_retirements");
  assert.equal(audit.length, 1, "one retirement audit row");
  assert.ok(audit[0].note.includes(ATT) && audit[0].note.includes("estimated_unverified"),
    "the retirement note references the disposition (§9.1)");
  assert.equal(one(w.h, `SELECT state FROM d6_execution_records
                          WHERE execution_id = ?`, EXEC).state, "unknown_billing",
    "the execution record STILL reads unknown_billing — provenance, not a STOP (§9.2)");
});

// ---------------------------------------------------------------
// §10 test 10 (store/service half) — amendment schema only:
// both tables exist after a disposition, amendments empty,
// current_amendment 0, and NO amendment entry point anywhere.
// ---------------------------------------------------------------
test("disp-10 amendment ships as schema only — no entry point exists", () => {
  const w = makeWorld();
  assert.equal(dispose(w).outcome, "applied");
  const names = tableNames(w.h);
  assert.ok(names.includes("d6_billing_adjudications"));
  assert.ok(names.includes("d6_billing_adjudication_amendments"),
    "the amendments table ships WITH the disposition (Q3)");
  assert.equal(w.h.rows("d6_billing_adjudication_amendments").length, 0,
    "the amendments table is empty — it has no writer in this build");
  assert.equal(adjudicationRows(w.h)[0].current_amendment, 0);
  assert.equal(w.store.amendAdjudication, undefined,
    "no amendAdjudication on the store");
  assert.ok(!("amendAdjudication" in genstoreModule),
    "no amendAdjudication export in the store module");
  assert.ok(!Object.keys(w.service).some(k => /amend/i.test(k)),
    "no amendment handle on the service");
});

// ---------------------------------------------------------------
// §10 test 11 (store half) — legacy vocabulary + machinery:
// confirmAttempt refuses the new outcome; the outcome
// vocabularies are unchanged; reconcile still works exactly as
// deployed, including refusing the new outcome as a settlement.
// (The full legacy suites pass unmodified in the battery.)
// ---------------------------------------------------------------
test("disp-11 legacy vocabulary and reconcile machinery unchanged", () => {
  assert.deepEqual([...ATTEMPT_OUTCOMES],
    ["success", "failed_known", "policy_block", "unknown"],
    "ATTEMPT_OUTCOMES is byte-identical to the deployed vocabulary");
  const w = makeWorld();
  // confirmAttempt can never produce the disposition outcome.
  const { executionId } = w.store.createExecution(
    { planId: null, jobId: "job-x", occurrenceId: "occ-x" });
  const att = w.store.reserveAttempt(executionId, { upperMicroCents: 100 });
  w.store.markDispatching(att);
  assert.throws(
    () => w.store.confirmAttempt(att,
      { outcome: "estimated_unverified", costMicroCents: null }),
    /attempt_outcome_invalid/,
    "confirmAttempt refuses estimated_unverified — the dispatch path can never produce it");
  // The deployed reconcile path is untouched: it settles a
  // DIFFERENT unknown attempt post-disposition-era, and refuses
  // the disposition outcome as a settlement outcome.
  seedPlan(w.h, { planId: "plan:disp-rec", state: "halted_unknown" });
  seedEntry(w.h, { planId: "plan:disp-rec", occ: "occ-rec", jobId: "job-rec" });
  seedExecution(w.h, { execId: "exec-rec", planId: "plan:disp-rec",
                       jobId: "job-rec", occ: "occ-rec" });
  seedAttempt(w.h, { attId: "att-rec", execId: "exec-rec",
                     planId: "plan:disp-rec", occ: "occ-rec" });
  const bad = w.service.reconcileUnknownAttempt("att-rec", {
    planId: "plan:disp-rec", knownCostMicro: null, outcome: "estimated_unverified" });
  assert.equal(bad.outcome, "rejected");
  assert.equal(bad.reason, "reconcile_outcome_invalid",
    "estimated_unverified is NOT a settlement outcome");
  const ok = w.service.reconcileUnknownAttempt("att-rec", {
    planId: "plan:disp-rec", knownCostMicro: null, outcome: "no_charge",
    note: "fixture", source: "operator-route" });
  assert.equal(ok.outcome, "applied", "the deployed reconcile still applies");
  assert.equal(attemptRow(w.h, "att-rec").outcome, "failed_known");
  assert.equal(attemptRow(w.h, "att-rec").cost_micro_cents, 0);
});

// ---------------------------------------------------------------
// §10 test 12 — read-surface honesty: the estimate appears only
// under its own keys with provider_unverified; no surface labels
// the settled bucket "verified"; the status persists in the
// phase read AND the retired plan's summary after retirement.
// ---------------------------------------------------------------
test("disp-12 read-surface honesty, before and after retirement", () => {
  const w = makeWorld();
  seedAccounting(w, { settledCost: 17749 });
  assert.equal(dispose(w).outcome, "applied");

  const checkSurfaces = (label) => {
    const caps = w.service.capabilities();
    const phase = caps.phases.find(p => p.phase === PHASE);
    assert.equal(phase.settledMicroCents, 17749 + 0, `${label}: settled excludes the estimate`);
    assert.equal(phase.estimatedUnverifiedMicroCents, ESTIMATE, label);
    assert.equal(phase.reservedUnverifiedMicroCents, ATTEMPT_UPPER, label);
    assert.ok(!JSON.stringify(phase).includes('"verified"'),
      `${label}: capabilities never labels settled as verified`);

    const diag = w.service.attemptDiagnostics({ planId: PLAN });
    const dAtt = diag.executions[0].attempts[0];
    assert.equal(dAtt.outcome, "estimated_unverified", label);
    assert.equal(dAtt.costMicroCents, null,
      `${label}: the estimate never rides the cost key`);
    assert.equal(dAtt.estimatedCostMicroCents, ESTIMATE, label);
    assert.equal(dAtt.reservedCostMicroCents, ATTEMPT_UPPER, label);
    assert.equal(dAtt.estimatedUnverifiedStatus, "provider_unverified", label);
    const pa = diag.plan.phaseAccounting;
    assert.equal(pa.settledBasis, "recorded_known_existing_ledger",
      `${label}: the settled bucket is labeled recorded/known, never verified`);
    assert.equal(pa.settledMicroCents, 17749, label);
    assert.equal(pa.estimatedUnverifiedMicroCents, ESTIMATE, label);
    assert.equal(pa.reservedUnverifiedMicroCents, ATTEMPT_UPPER, label);
    assert.equal(pa.unverifiedStatus, "provider_unverified", label);
    assert.equal(pa.remainingMicroCents, BUDGET - 17749 - ATTEMPT_UPPER - 5000, label);

    const summary = w.service.listPlans({}).plans.find(p => p.planId === PLAN);
    assert.equal(summary.settledMicroCents, 0,
      `${label}: the plan's settled excludes the estimate`);
    assert.equal(summary.estimatedUnverifiedMicroCents, ESTIMATE, label);
    assert.equal(summary.estimatedUnverifiedStatus, "provider_unverified", label);
  };
  checkSurfaces("pre-retirement");
  assert.equal(w.service.retireHaltedPlan({
    planId: PLAN, source: "operator-route",
    note: `unknown attempt ${ATT} disposed estimated_unverified (adjudication recorded)`,
  }).outcome, "applied");
  checkSurfaces("post-retirement");
});

// ---------------------------------------------------------------
// §10 test 13 — COLD pre-disposition integration (D1): on a
// fresh GEN_SCHEMA-only store, every surface reads exact zeros
// with legacy-identical figures, and READS ARE NON-MUTATING
// (neither adjudication table exists afterward). Then the
// post-write and post-retirement legs in the same fixture.
// ---------------------------------------------------------------
test("disp-13 cold store: exact zeros, legacy-identical, reads non-mutating", () => {
  const h = makeHarness({});
  const store = createGenStore(h.coord);
  store.ensureSchema();
  const service = createGenerationService({
    coord: h.coord, env: { GENERATION_HALT: "1" }, store,
    sources: createCoordinatorPlaneSource(h.coord),
  });
  // Legacy activity in the budgeted phase: known settled +
  // in-flight, on an active plan. NO disposition has ever run.
  seedPlan(h, { planId: "plan:cold", state: "active" });
  seedExecution(h, { execId: "exec-cold", planId: "plan:cold",
                     jobId: "job-cold", occ: "occ-cold" });
  h.db.prepare(`UPDATE d6_execution_records SET state = 'committed'
                 WHERE execution_id = 'exec-cold'`).run();
  seedAttempt(h, { attId: "att-cold", execId: "exec-cold", planId: "plan:cold",
                   occ: "occ-cold", outcome: "success", cost: 17749, upper: 999 });
  seedAttempt(h, { attId: "att-cold-flight", execId: "exec-cold",
                   planId: "plan:cold", occ: "occ-cold", phase: "reserved",
                   outcome: null, cost: null, upper: 5000 });
  seedEntry(h, { planId: "plan:cold", occ: "occ-g1", chars: 100, upper: 2250,
                 jobId: "job-cold" });
  h.db.prepare(`INSERT INTO d6_plan_jobs (plan_id, job_id, chapter_index, seq)
                 VALUES ('plan:cold', 'job-cold', 1, 0)`).run();
  h.db.prepare(`INSERT INTO occurrences (job_id, occurrence_id, revision_key, state)
                 VALUES ('job-cold', 'occ-g1', 'rk-g1', 'pending')`).run();

  const acct = store.phaseAccounting(PHASE);
  assert.deepEqual(acct, {
    settledMicro: 17749, inFlightUpperMicro: 5000, unknownOpen: 0,
    estimatedUnverifiedMicro: 0, reservedUnverifiedMicro: 0,
  }, "cold phaseAccounting: new fields exactly 0, legacy figures unchanged");

  const caps = service.capabilities();
  assert.equal(caps.phases.length, 1, "every budgeted phase is returned");
  const phase = caps.phases[0];
  assert.equal(phase.estimatedUnverifiedMicroCents, 0);
  assert.equal(phase.reservedUnverifiedMicroCents, 0);
  assert.equal(phase.remainingMicroCents, BUDGET - 17749 - 5000,
    "the cold remainder is byte-equal to the legacy computation");

  const diag = service.attemptDiagnostics({ planId: "plan:cold" });
  assert.equal(diag.plan.phaseAccounting.estimatedUnverifiedMicroCents, 0);
  assert.equal(diag.plan.phaseAccounting.reservedUnverifiedMicroCents, 0);
  assert.ok(!("estimatedCostMicroCents" in diag.executions[0].attempts[0]),
    "no adjudication join keys on a legacy attempt row");

  const summary = service.listPlans({}).plans.find(p => p.planId === "plan:cold");
  assert.equal(summary.estimatedUnverifiedMicroCents, 0);
  assert.ok(!("estimatedUnverifiedStatus" in summary),
    "no provider_unverified status where no adjudication exists");

  assert.deepEqual(d6GrantGuard(h.coord, guardJob), { ok: true },
    "the cold guard admits on a legacy-identical projection");
  // (The cold phase_budget refusal on legacy figures alone is
  // the second world below.)

  const names = tableNames(h);
  assert.ok(!names.includes("d6_billing_adjudications") &&
            !names.includes("d6_billing_adjudication_amendments"),
    "after ALL cold reads, neither adjudication table exists — reads never run the DDL");

  // Post-write leg: one disposition in this same fixture -> all
  // surfaces show the frozen figures.
  seedPlan(h); seedEntry(h); seedExecution(h); seedAttempt(h); seedPhaseFlag(h);
  const svc2 = service; // same store; the halted plan is PLAN
  assert.equal(svc2.adjudicateEstimatedAttempt(ATT, {
    planId: PLAN, authorizationRef: AUTH, source: "operator-route",
    evidenceRefs: EVIDENCE }).outcome, "applied");
  assert.equal(store.phaseAccounting(PHASE).estimatedUnverifiedMicro, ESTIMATE);
  assert.equal(store.phaseAccounting(PHASE).reservedUnverifiedMicro, ATTEMPT_UPPER);
  const caps2 = service.capabilities().phases[0];
  assert.equal(caps2.estimatedUnverifiedMicroCents, ESTIMATE);
  assert.equal(caps2.remainingMicroCents, BUDGET - 17749 - ATTEMPT_UPPER - 5000);
  const diag2 = service.attemptDiagnostics({ planId: PLAN });
  assert.equal(diag2.executions[0].attempts[0].estimatedCostMicroCents, ESTIMATE);
  const sum2 = service.listPlans({}).plans.find(p => p.planId === PLAN);
  assert.equal(sum2.estimatedUnverifiedMicroCents, ESTIMATE);
  assert.equal(sum2.estimatedUnverifiedStatus, "provider_unverified");

  // Post-retirement leg: retire -> all surfaces still show the
  // figures, with the status.
  assert.equal(service.retireHaltedPlan({
    planId: PLAN, source: "operator-route",
    note: `unknown attempt ${ATT} disposed estimated_unverified (adjudication recorded)`,
  }).outcome, "applied");
  assert.equal(store.phaseAccounting(PHASE).estimatedUnverifiedMicro, ESTIMATE);
  const sum3 = service.listPlans({}).plans.find(p => p.planId === PLAN);
  assert.equal(sum3.state, "retired");
  assert.equal(sum3.estimatedUnverifiedMicroCents, ESTIMATE);
  assert.equal(sum3.estimatedUnverifiedStatus, "provider_unverified",
    "retirement does not launder the unverified status");
  const diag3 = service.attemptDiagnostics({ planId: PLAN });
  assert.equal(diag3.executions[0].attempts[0].estimatedUnverifiedStatus,
    "provider_unverified");
});

test("disp-13b cold guard: a phase_budget refusal on legacy figures alone", () => {
  const h = makeHarness({});
  const store = createGenStore(h.coord);
  store.ensureSchema();
  seedPlan(h, { planId: "plan:cold", state: "active" });
  seedExecution(h, { execId: "exec-cold", planId: "plan:cold",
                     jobId: "job-cold", occ: "occ-cold" });
  seedAttempt(h, { attId: "att-cold", execId: "exec-cold", planId: "plan:cold",
                   occ: "occ-cold", outcome: "success", cost: BUDGET - 1000,
                   upper: 999 });
  seedEntry(h, { planId: "plan:cold", occ: "occ-g1", chars: 100, upper: 2250,
                 jobId: "job-guard" });
  h.db.prepare(`INSERT INTO d6_plan_jobs (plan_id, job_id, chapter_index, seq)
                 VALUES ('plan:cold', 'job-guard', 1, 0)`).run();
  h.db.prepare(`INSERT INTO occurrences (job_id, occurrence_id, revision_key, state)
                 VALUES ('job-guard', 'occ-g1', 'rk-g1', 'pending')`).run();
  // (BUDGET - 1000) + 0 + 0 + 2250 > BUDGET: refuses on legacy
  // figures alone, with zero adjudications anywhere.
  assert.deepEqual(d6GrantGuard(h.coord, guardJob),
    { ok: false, reason: "phase_budget" });
  assert.ok(!tableNames(h).includes("d6_billing_adjudications"),
    "the refusal created nothing");
});

// ---------------------------------------------------------------
// §10 test 14 — presence discrimination (D1): a split schema is
// loud; a genuine SQL fault propagates unmasked; neither reads
// as zero. ((c) both-absent is test 13, cross-referenced.)
// ---------------------------------------------------------------
const ADJ_DDL_MAIN = `CREATE TABLE d6_billing_adjudications (
  attempt_id TEXT PRIMARY KEY, plan_id TEXT, phase TEXT,
  disposition TEXT NOT NULL, estimated_cost_micro_cents INTEGER NOT NULL,
  reserved_cost_micro_cents INTEGER NOT NULL, estimate_basis TEXT NOT NULL,
  evidence_refs TEXT, authorization_ref TEXT NOT NULL, note TEXT,
  source TEXT, current_amendment INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL)`;
const ADJ_DDL_AMEND = `CREATE TABLE d6_billing_adjudication_amendments (
  attempt_id TEXT NOT NULL, amendment_seq INTEGER NOT NULL,
  kind TEXT NOT NULL, verified_outcome TEXT NOT NULL,
  verified_cost_micro_cents INTEGER NOT NULL, evidence_refs TEXT,
  authorization_ref TEXT NOT NULL, note TEXT, source TEXT,
  created_at INTEGER NOT NULL, PRIMARY KEY (attempt_id, amendment_seq))`;

test("disp-14a split schema: exactly one table -> loud inconsistency everywhere", () => {
  const w = makeWorld();
  w.h.db.exec(ADJ_DDL_MAIN); // ONLY the main table: the split state
  assert.throws(() => w.store.phaseAccounting(PHASE),
    /adjudication_schema_inconsistent/);
  assert.throws(() => w.service.capabilities(),
    /adjudication_schema_inconsistent/,
    "capabilities surfaces the error — never zeros");
  seedEntry(w.h, { planId: PLAN, occ: "occ-g1", chars: 100, upper: 2250, jobId: "job-guard" });
  w.h.db.prepare(`UPDATE d6_plans SET state = 'active' WHERE plan_id = ?`).run(PLAN);
  w.h.db.prepare(`INSERT INTO d6_plan_jobs (plan_id, job_id, chapter_index, seq)
                   VALUES (?, 'job-guard', 1, 0)`).run(PLAN);
  w.h.db.prepare(`INSERT INTO occurrences (job_id, occurrence_id, revision_key, state)
                   VALUES ('job-guard', 'occ-g1', 'rk-g1', 'pending')`).run();
  w.h.db.prepare(`UPDATE d6_phase_state SET halted_unknown_billing = 0`).run();
  assert.throws(() => d6GrantGuard(w.h.coord, guardJob),
    /adjudication_schema_inconsistent/,
    "at the guard the throw IS the refusal (§5.4)");
  assert.equal(w.h.rows("grants").length, 0, "no grant issued");
});

test("disp-14b genuine fault: a missing summed column propagates, never zeros", () => {
  const w = makeWorld();
  // Both tables present, but the main table LACKS the
  // reserved_cost_micro_cents column the strict sum reads.
  w.h.db.exec(`CREATE TABLE d6_billing_adjudications (
    attempt_id TEXT PRIMARY KEY, plan_id TEXT, phase TEXT,
    disposition TEXT NOT NULL, estimated_cost_micro_cents INTEGER NOT NULL,
    estimate_basis TEXT NOT NULL, evidence_refs TEXT,
    authorization_ref TEXT NOT NULL, note TEXT, source TEXT,
    current_amendment INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL)`);
  w.h.db.exec(ADJ_DDL_AMEND);
  let err = null;
  try { w.store.phaseAccounting(PHASE); } catch (e) { err = e; }
  assert.ok(err, "the read throws");
  assert.ok(!/adjudication_schema_inconsistent/.test(err.message),
    "a genuine fault is NOT misreported as the split-schema error");
  assert.match(err.message, /reserved_cost_micro_cents|no such column/i,
    "the genuine SQL error surfaces unmasked");
  assert.throws(() => w.service.capabilities(), /reserved_cost_micro_cents|no such column/i);
});

// ---------------------------------------------------------------
// §10 test 15 — the rollback fence (D2): (a) the guard's shape
// fence against a legacy-shaped accounting object (the genstore
// test double — the pre-disposition shape, no unverified
// fields); (b) the §5.3 Decision-3 exit-gate comparison.
// ---------------------------------------------------------------
test("disp-15a shape fence: legacy-shaped accounting refuses phase_accounting_incomplete", () => {
  const w = makeWorld();
  seedAccounting(w, { settledCost: 17749 });
  const grantsBefore = JSON.stringify(w.h.rows("grants"));
  const attemptsBefore = JSON.stringify(w.h.rows("d6_attempt_log"));
  // The double IS the pre-disposition accounting shape.
  const dbl = createGenStoreDouble(w.h.coord);
  const legacyAcct = dbl.phaseAccounting(PHASE);
  assert.deepEqual(Object.keys(legacyAcct).sort(),
    ["inFlightUpperMicro", "settledMicro", "unknownOpen"],
    "the double returns exactly the legacy shape — no unverified fields");
  assert.deepEqual(d6PhaseBudgetCheck(legacyAcct, 0, BUDGET),
    { ok: false, reason: "phase_accounting_incomplete" },
    "an absent unverified field is NEVER coerced to 0 (§6.2)");
  assert.deepEqual(d6PhaseBudgetCheck(
    { ...legacyAcct, estimatedUnverifiedMicro: 0, reservedUnverifiedMicro: "0" },
    0, BUDGET), { ok: false, reason: "phase_accounting_incomplete" },
    "a non-integer unverified field refuses identically");
  assert.deepEqual(d6PhaseBudgetCheck(w.store.phaseAccounting(PHASE), 2250, BUDGET),
    { ok: true }, "control: the real (complete) shape admits on the same figures");
  assert.equal(JSON.stringify(w.h.rows("grants")), grantsBefore,
    "zero grants from the shape refusal");
  assert.equal(JSON.stringify(w.h.rows("d6_attempt_log")), attemptsBefore,
    "zero ledger movement from the shape refusal");
});

// The §5.3 Decision-3 comparison, as a fixture: the archived
// pre-rollback read-back vs a candidate live build's surfaces.
function exitGatePasses(archived, livePhase, liveSummary) {
  if (!livePhase) return false;
  if (livePhase.estimatedUnverifiedMicroCents !== archived.estimatedUnverifiedMicroCents)
    return false;
  if (livePhase.reservedUnverifiedMicroCents !== archived.reservedUnverifiedMicroCents)
    return false;
  if (!liveSummary) return false;
  if (liveSummary.estimatedUnverifiedStatus !== "provider_unverified") return false;
  if (liveSummary.estimatedUnverifiedMicroCents !== archived.estimatedUnverifiedMicroCents)
    return false;
  return true;
}

test("disp-15b exit-gate comparison: absent keys fail, mismatches fail, exact match passes", () => {
  const w = makeWorld();
  assert.equal(dispose(w).outcome, "applied");
  // The archived read-back (Decision 2's external capture).
  const livePhase = w.service.capabilities().phases.find(p => p.phase === PHASE);
  const archived = {
    estimatedUnverifiedMicroCents: livePhase.estimatedUnverifiedMicroCents,
    reservedUnverifiedMicroCents: livePhase.reservedUnverifiedMicroCents,
  };
  const summary = w.service.listPlans({}).plans.find(p => p.planId === PLAN);
  assert.equal(exitGatePasses(archived, livePhase, summary), true,
    "the adjudication-aware build passes its own exit gate");
  const legacyPhase = { ...livePhase };
  delete legacyPhase.estimatedUnverifiedMicroCents;
  delete legacyPhase.reservedUnverifiedMicroCents;
  assert.equal(exitGatePasses(archived, legacyPhase, summary), false,
    "a legacy-shaped payload (keys ABSENT) fails the gate — the D2 hazard, caught");
  assert.equal(exitGatePasses(archived,
    { ...livePhase, reservedUnverifiedMicroCents: ATTEMPT_UPPER - 1 }, summary), false,
    "a mismatched reservation fails the gate");
  assert.equal(exitGatePasses(archived, livePhase,
    { ...summary, estimatedUnverifiedStatus: undefined }), false,
    "a summary that lost the provider_unverified status fails the gate");
});

// ---------------------------------------------------------------
// FOCUSED CORRECTIONS — Rowan source review 6535697368 (FOCUSED
// SOURCE HOLD on S1 + S2 only; corrections inside the existing
// repo-only build scope, Julie's build approval 6535417583).
// disp-16 = S1, disp-17 = S2 (orphan row), disp-18 = S2
// (negative unverified figures at the budget check).
// ---------------------------------------------------------------

// S1: adjudicateEstimated must require cost_micro_cents === NULL
// before reclassifying. An anomalous confirmed/unknown row WITH
// a numeric cost refuses adjudication_cost_inconsistent, before
// any DDL/UPDATE/INSERT, with zero changes to attempt, plan,
// phase, and audit.
test("disp-16 S1: a confirmed/unknown attempt carrying a numeric cost refuses adjudication_cost_inconsistent and moves nothing", () => {
  const w = makeWorld();
  // The anomalous pre-state: confirmed/unknown WITH a numeric
  // cost. The schema does not forbid it; the valid writer
  // (confirmAttempt) never produces it.
  w.h.db.prepare(`UPDATE d6_attempt_log SET cost_micro_cents = 4242
                   WHERE attempt_id = ?`).run(ATT);
  const before = snapshot(w.h);
  assert.throws(
    () => w.store.adjudicateEstimated(ATT, {
      planId: PLAN, authorizationRef: AUTH, note: "fixture disposition",
      source: "operator-route", evidenceRefs: EVIDENCE }),
    /adjudication_cost_inconsistent/,
    "the store refuses the malformed pre-state with its own reason");
  const r = dispose(w);
  assert.equal(r.outcome, "rejected");
  assert.equal(r.reason, "adjudication_cost_inconsistent",
    "the service surfaces the distinct refusal reason");
  const a = attemptRow(w.h);
  assert.equal(a.outcome, "unknown",
    "the attempt is NOT reclassified to estimated_unverified");
  assert.equal(a.cost_micro_cents, 4242, "the attempt row is unchanged");
  assert.equal(planRow(w.h).state, "halted_unknown", "the plan is untouched");
  assert.equal(phaseFlag(w.h), 1, "the phase flag still stands");
  assert.equal(adjudicationRows(w.h).length, 0, "no audit row from a refusal");
  assert.ok(!tableNames(w.h).includes("d6_billing_adjudications"),
    "the refusal ran before any DDL — no adjudication tables created");
  assert.equal(snapshot(w.h), before, "zero state change anywhere");
  // Control: with the cost restored to NULL, the very same
  // disposition applies — the guard refuses the malformed ROW,
  // not the shape of the request.
  w.h.db.prepare(`UPDATE d6_attempt_log SET cost_micro_cents = NULL
                   WHERE attempt_id = ?`).run(ATT);
  assert.equal(dispose(w).outcome, "applied");
  assert.equal(attemptRow(w.h).cost_micro_cents, null,
    "and the applied disposition still never writes the cost");
});

// S2: an estimated_unverified attempt whose adjudication row is
// missing (both tables present) must fail closed on the
// accounting read path — phaseAccounting, the per-plan sibling,
// capabilities, plan summaries, and the grant guard — never be
// silently dropped from the sums by the inner JOIN.
test("disp-17 S2: an estimated_unverified attempt with no adjudication row is loud on every accounting read surface", () => {
  const w = makeWorld();
  // Valid linked control first: a normal disposition, and every
  // read surface agrees on the figures.
  assert.equal(dispose(w).outcome, "applied");
  const acct = w.store.phaseAccounting(PHASE);
  assert.equal(acct.estimatedUnverifiedMicro, ESTIMATE);
  assert.equal(acct.reservedUnverifiedMicro, ATTEMPT_UPPER);
  assert.doesNotThrow(() => w.service.capabilities());
  const okSummary = w.service.listPlans({}).plans.find(p => p.planId === PLAN);
  assert.equal(okSummary.estimatedUnverifiedStatus, "provider_unverified");
  assert.equal(okSummary.estimatedUnverifiedMicroCents, ESTIMATE);

  // The corrupt state: both tables present, the attempt still
  // estimated_unverified, but its adjudication row is GONE
  // (deleted out of band — unreachable through the system's own
  // writes, which set outcome + audit row in one transaction).
  w.h.db.prepare(`DELETE FROM d6_billing_adjudications
                   WHERE attempt_id = ?`).run(ATT);
  assert.throws(() => w.store.phaseAccounting(PHASE),
    /adjudication_row_missing/,
    "phase accounting refuses to silently drop the orphan");
  assert.throws(() => w.store.planUnverifiedAccounting(PLAN),
    /adjudication_row_missing/,
    "the per-plan sibling read is equally loud");
  assert.throws(() => w.service.capabilities(),
    /adjudication_row_missing/,
    "capabilities throws — never a zero reservation");
  assert.throws(() => w.service.listPlans({}),
    /adjudication_row_missing/,
    "plan summaries throw — never a silent figure");

  // The grant guard: at the guard the throw IS the refusal — no
  // grant issues. The disp-14a guard fixture shape: the plan
  // active, one pending eligible occurrence on job-guard. (The
  // disposition above already cleared the phase flag, so the
  // guard reaches the budget check.)
  seedEntry(w.h, { planId: PLAN, occ: "occ-g1", chars: 100,
                   upper: 2250, jobId: "job-guard" });
  w.h.db.prepare(`UPDATE d6_plans SET state = 'active'
                   WHERE plan_id = ?`).run(PLAN);
  w.h.db.prepare(`INSERT INTO d6_plan_jobs (plan_id, job_id, chapter_index, seq)
                   VALUES (?, 'job-guard', 1, 0)`).run(PLAN);
  w.h.db.prepare(`INSERT INTO occurrences (job_id, occurrence_id, revision_key, state)
                   VALUES ('job-guard', 'occ-g1', 'rk-g1', 'pending')`).run();
  assert.throws(() => d6GrantGuard(w.h.coord, guardJob),
    /adjudication_row_missing/,
    "the grant path throws on the orphan — the exposure is never laundered into headroom");
  assert.equal(w.h.rows("grants").length, 0, "no grant issued");
});

// S2 (second half): a NEGATIVE unverified figure is a safe
// integer in shape but must not decrease projected spend —
// d6PhaseBudgetCheck rejects it as phase_accounting_incomplete.
test("disp-18 S2: negative unverified figures refuse phase_accounting_incomplete at the budget check", () => {
  const base = { settledMicro: 0, inFlightUpperMicro: 0,
                 estimatedUnverifiedMicro: 0, reservedUnverifiedMicro: 0 };
  assert.deepEqual(d6PhaseBudgetCheck(base, 0, BUDGET), { ok: true },
    "control: exact zeros admit");
  assert.deepEqual(d6PhaseBudgetCheck(
    { ...base, estimatedUnverifiedMicro: -1 }, 0, BUDGET),
    { ok: false, reason: "phase_accounting_incomplete" },
    "a negative estimate refuses — safe-integer shape is not enough");
  assert.deepEqual(d6PhaseBudgetCheck(
    { ...base, reservedUnverifiedMicro: -1 }, 0, BUDGET),
    { ok: false, reason: "phase_accounting_incomplete" },
    "a negative reservation refuses identically");
  // The discriminating case: without the nonnegativity fence, a
  // reservation of -100 would let a pending upper of 100 project
  // 0 against a budget of 50 and ADMIT. It must refuse.
  assert.deepEqual(d6PhaseBudgetCheck(
    { ...base, reservedUnverifiedMicro: -100 }, 100, 50),
    { ok: false, reason: "phase_accounting_incomplete" },
    "a negative reservation can never decrease projected spend");
  // Control: the same figures with a lawful zero reservation hit
  // the ordinary phase_budget fence instead.
  assert.deepEqual(d6PhaseBudgetCheck(base, 100, 50),
    { ok: false, reason: "phase_budget" },
    "control: lawful figures still reach the projection fence");
});
