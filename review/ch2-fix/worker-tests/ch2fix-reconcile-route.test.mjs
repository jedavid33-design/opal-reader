// CH2 FIX PACKAGE — fix 2: the operator-only invocation path
// for the pre-existing unknown-billing reconciliation
// (genstore.reconcileUnknown), which shipped in D6 with no
// production caller (the Ch 2 halt diagnosis's "built but never
// wired"): POST /v2/d6-reconcile-unknown, in the same fence class
// as /v2/d6-phase-binding, /v2/d6-retire-halted-plan, and
// /v2/d6-release-quarantine (production gate skips the client
// token; admission on the migration-operator credential alone;
// the operator-admitted stamp required again at the class gate).
//
// The mandatory half of this suite is the R4-1 REGRESSION in the
// exact sequence the round-4 review missed: reconcile a halted
// plan's unknown attempt THROUGH THE NEW ROUTE, then run drive
// cycles (the alarm shape included) and prove the plan is
// byte-identical and still halted_unknown — reconcile settles a
// cost record; it must never become a resume path. The only
// exit from halted_unknown remains retireHaltedPlan, asserted
// still working after the drives. Both halt states are covered:
// the route is safe with GENERATION_HALT "1" and "0" because it
// creates no plan, grant, or execution.
import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import D6Entry from "../worker/worker-entry-prod-d6.js";
import { OpalReaderCoordinatorProd as D6Prod } from "../worker/worker-entry-prod-d6.js";
import { GenerationCoordinator } from "../worker/coordinator.mjs";
import { createGenerationService } from "../worker/generation/service.mjs";
import { createGenStore } from "../worker/generation/genstore.mjs";
import { createCoordinatorPlaneSource } from "../worker/generation/content-plane-adapter.mjs";

const CLIENT_TOKEN = "client-token-ch2fix";
const OPERATOR_TOKEN = "operator-token-ch2fix";
const PLAN_ID = "plan:ch2fix";
const ATTEMPT_ID = "att-ch2fix-1";
const PHASE = "phase-ch2fix";

class SqlCursor {
  constructor(rows) { this.rows = rows ?? []; }
  toArray() { return this.rows; }
  one() {
    if (this.rows.length === 0)
      throw new Error("Expected exactly one result from SQL query, but got no results.");
    if (this.rows.length > 1)
      throw new Error("Expected exactly one result from SQL query, but got multiple results.");
    return this.rows[0];
  }
}
class SqlFacade {
  constructor(db) { this.db = db; }
  exec(query, ...params) {
    if (params.length === 0 && query.includes(";")) {
      this.db.exec(query);
      return new SqlCursor([]);
    }
    const stmt = this.db.prepare(query);
    const isQuery = /^\s*(SELECT|WITH)\b/i.test(query);
    let rows = null;
    if (isQuery) rows = stmt.all(...params);
    else stmt.run(...params);
    return new SqlCursor(rows);
  }
}

function entryWorld({ halt = "1" } = {}) {
  const db = new DatabaseSync(":memory:");
  const storage = {
    sql: new SqlFacade(db),
    transactionSync(fn) {
      db.exec("BEGIN IMMEDIATE");
      try { const r = fn(); db.exec("COMMIT"); return r; }
      catch (e) { try { db.exec("ROLLBACK"); } catch {} throw e; }
    },
    async setAlarm() {},
    async getAlarm() { return null; },
  };
  const queue = { sent: [], async send(m) { this.sent.push(m); } };
  const classEnv = {
    OPALREADER_V2_SCOPE: "production",
    OPALREADER_ACCESS_TOKEN: CLIENT_TOKEN,
    OPALREADER_MIGRATION_OPERATOR_TOKEN: OPERATOR_TOKEN,
    OPALREADER_PHASE_POLICY: "enforce",
    ALLOWED_ORIGIN: "https://opalreader.invalid",
    GENERATION_HALT: halt,
    OPALREADER_R2: {
      async head() { return null; },
      async get() { return null; },
      async put() { return { etag: "x" }; },
    },
    OPALREADER_GENERATION_QUEUE: queue,
  };
  const inst = new D6Prod({ storage }, classEnv);
  const entryEnv = {
    ...classEnv,
    COORDINATOR: {
      idFromName: (n) => n,
      get: () => ({ fetch: (req) => inst.fetch(req) }),
    },
  };
  // Seed the halted plan + its one confirmed/unknown attempt
  // directly (the Ch 2 shape: 1 unknown, phase halt set).
  const coord = new GenerationCoordinator({ storage }, classEnv);
  const store = createGenStore(coord);
  store.ensureSchema();
  const run = (sql, ...params) => db.prepare(sql).run(...params);
  run(`INSERT INTO d6_plans (plan_id, intent_key, book_id, scope, keep_going,
        phase, lane, state, stop_reason, eligible_digest, created_at, updated_at)
       VALUES (?, 'intent-ch2fix', 'book-ch2fix', 'chapter', 0, ?, 'standard',
        'halted_unknown', 'phase_halted_unknown_billing', NULL, 1, 1)`,
    PLAN_ID, PHASE);
  run(`INSERT INTO d6_attempt_log (attempt_id, execution_id, plan_id,
        occurrence_id, seq, phase, outcome, cost_micro_cents,
        upper_micro_cents, provider_request_id, detail_json,
        created_at, updated_at)
       VALUES (?, 'exec-ch2fix-1', ?, 'occ-ch2fix-1', 1, 'confirmed',
        'unknown', NULL, 31337, NULL, NULL, 1, 1)`,
    ATTEMPT_ID, PLAN_ID);
  run(`INSERT INTO d6_phase_state (phase, halted_unknown_billing,
        halt_detail, updated_at) VALUES (?, 1, 'unknown billing', 1)`, PHASE);
  const service = createGenerationService({
    coord, env: classEnv, store,
    sources: createCoordinatorPlaneSource(coord),
    phasePolicyMode: "enforce",
  });
  return { db, inst, entryEnv, classEnv, queue, service };
}

const one = (db, sql, ...p) => db.prepare(sql).get(...p);
const all = (db, sql, ...p) => db.prepare(sql).all(...p);
const attemptRow = (db) => one(db, `SELECT * FROM d6_attempt_log WHERE attempt_id = ?`, ATTEMPT_ID);
const planRow = (db) => one(db, `SELECT * FROM d6_plans WHERE plan_id = ?`, PLAN_ID);
const phaseRow = (db) => one(db, `SELECT * FROM d6_phase_state WHERE phase = ?`, PHASE);
const auditRows = (db) => {
  const exists = one(db, `SELECT name FROM sqlite_master WHERE type='table' AND name='d6_reconcile_audit'`);
  return exists ? all(db, `SELECT * FROM d6_reconcile_audit`) : [];
};

async function reconcileViaEntry(w, body, { operator = OPERATOR_TOKEN, access = null } = {}) {
  const headers = {
    "content-type": "application/json",
    "x-opalreader-scope": "production",
    "x-opalreader-instance": "account",
    Origin: "https://opalreader.invalid",
  };
  if (operator != null) headers["x-opalreader-operator-token"] = operator;
  if (access != null) headers["x-opalreader-token"] = access;
  const res = await D6Entry.fetch(new Request(
    "https://opalreader.invalid/v2/d6-reconcile-unknown",
    { method: "POST", headers, body: JSON.stringify(body) }), w.entryEnv);
  return { status: res.status, body: await res.json().catch(() => null) };
}

const SETTLE = { attemptId: ATTEMPT_ID, planId: PLAN_ID, knownCostMicro: null, note: "provider console: no charge" };

test("fix2 fence: no operator token, client token alone, and unstamped internal calls are all refused", async () => {
  const w = entryWorld();
  const before = JSON.stringify(attemptRow(w.db));
  let r = await reconcileViaEntry(w, SETTLE, { operator: null });
  assert.equal(r.status, 403, "no operator credential -> 403 at the entry fence");
  r = await reconcileViaEntry(w, SETTLE, { operator: null, access: CLIENT_TOKEN });
  assert.equal(r.status, 403, "the everyday client token alone is refused");
  r = await reconcileViaEntry(w, SETTLE, { operator: "wrong-operator-token" });
  assert.equal(r.status, 403, "a wrong operator credential is refused");
  const direct = await w.inst.fetch(new Request(
    "https://do.internal/internal/d6/reconcile-unknown",
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(SETTLE) }));
  assert.equal(direct.status, 403, "the class gate refuses without the operator-admitted stamp");
  assert.equal(JSON.stringify(attemptRow(w.db)), before, "refusals moved nothing");
  assert.equal(auditRows(w.db).length, 0, "no audit rows from refused calls");
});

test("fix2 validation: malformed settlements are refused and move nothing (absent cost NEVER settles as no-charge)", async () => {
  const w = entryWorld();
  const before = JSON.stringify(attemptRow(w.db));
  let r = await reconcileViaEntry(w, { attemptId: ATTEMPT_ID, planId: PLAN_ID });
  assert.equal(r.body?.reason, "known_cost_required", "knownCostMicro must be present and explicit");
  r = await reconcileViaEntry(w, { attemptId: ATTEMPT_ID, knownCostMicro: "free" });
  assert.equal(r.body?.reason, "known_cost_invalid");
  r = await reconcileViaEntry(w, { attemptId: ATTEMPT_ID, knownCostMicro: -5 });
  assert.equal(r.body?.reason, "known_cost_invalid", "negative costs are refused");
  r = await reconcileViaEntry(w, { attemptId: ATTEMPT_ID, knownCostMicro: null, outcome: "policy_block" });
  assert.equal(r.body?.reason, "outcome_invalid", "only success / failed_known settlements are accepted here");
  r = await reconcileViaEntry(w, { knownCostMicro: null });
  assert.equal(r.body?.reason, "attempt_id_required");
  assert.equal(JSON.stringify(attemptRow(w.db)), before, "every refusal left the attempt untouched");
  assert.equal(phaseRow(w.db).halted_unknown_billing, 1, "the phase halt still stands");
  assert.equal(auditRows(w.db).length, 0);
});

test("fix2 plan guard: a planId that does not own the attempt refuses with reconcile_plan_mismatch", async () => {
  const w = entryWorld();
  const r = await reconcileViaEntry(w, { ...SETTLE, planId: "plan:someone-else" });
  assert.equal(r.body?.outcome, "rejected");
  assert.equal(r.body?.reason, "reconcile_plan_mismatch");
  assert.equal(attemptRow(w.db).outcome, "unknown", "the attempt is still unsettled");
  assert.equal(auditRows(w.db).length, 0, "a refused reconcile writes no audit row");
});

test("fix2 applied: a proven no-charge settles the attempt, clears the phase halt, and audits in the same motion", async () => {
  const w = entryWorld();
  const r = await reconcileViaEntry(w, SETTLE);
  assert.equal(r.status, 200);
  assert.equal(r.body?.outcome, "applied");
  assert.equal(r.body?.haltCleared, true, "this was the phase's last open unknown");
  const a = attemptRow(w.db);
  assert.equal(a.outcome, "failed_known");
  assert.equal(a.cost_micro_cents, 0, "proven no-charge settles at exactly 0");
  assert.equal(phaseRow(w.db).halted_unknown_billing, 0, "the phase unknown-billing halt cleared");
  const audit = auditRows(w.db);
  assert.equal(audit.length, 1, "exactly one audit row");
  assert.equal(audit[0].attempt_id, ATTEMPT_ID);
  assert.equal(audit[0].plan_id, PLAN_ID);
  assert.equal(audit[0].phase, PHASE);
  assert.equal(audit[0].final_outcome, "failed_known");
  assert.equal(audit[0].final_cost_micro_cents, 0);
  assert.equal(audit[0].note, "provider console: no charge");
  assert.equal(audit[0].source, "operator-route", "the source is stamped by the route, not caller-supplied");
  assert.equal(planRow(w.db).state, "halted_unknown",
    "the PLAN is untouched by reconcile — settlement is not clearance");
});

test("fix2 store preconditions through the route: unknown attempts only, exactly once", async () => {
  const w = entryWorld();
  let r = await reconcileViaEntry(w, { attemptId: "att-does-not-exist", knownCostMicro: null });
  assert.equal(r.body?.reason, "attempt_not_found");
  r = await reconcileViaEntry(w, { attemptId: ATTEMPT_ID, knownCostMicro: 4242 });
  assert.equal(r.body?.outcome, "applied");
  assert.equal(attemptRow(w.db).outcome, "success", "a numeric cost defaults to the success outcome");
  assert.equal(attemptRow(w.db).cost_micro_cents, 4242);
  r = await reconcileViaEntry(w, SETTLE);
  assert.equal(r.body?.reason, "attempt_not_unknown", "a settled attempt cannot be reconciled twice");
  assert.equal(auditRows(w.db).length, 1, "still exactly one audit row");
});

// The R4-1 regression, in the exact sequence round 4 missed:
// reconcile THROUGH THE ROUTE first, then drive — repeatedly,
// including the production alarm shape — in BOTH halt states.
// The halted plan must be byte-identical afterwards: never
// selected, never flipped, never granted. Retire (the designed
// exit) still applies afterwards.
for (const halt of ["1", "0"]) {
  test(`fix2 R4-1 regression (GENERATION_HALT "${halt}"): route reconcile -> drive cycles NEVER resume the halted plan`, async () => {
    const w = entryWorld({ halt });
    const r = await reconcileViaEntry(w, SETTLE);
    assert.equal(r.body?.outcome, "applied", "reconcile applies in this halt state");
    assert.equal(planRow(w.db).state, "halted_unknown");
    const planBefore = JSON.stringify(planRow(w.db));
    const attemptBefore = JSON.stringify(attemptRow(w.db));
    for (let i = 0; i < 3; i++) {
      const outcomes = await w.service.driveOnce();
      assert.ok(!outcomes.some((o) => o.planId === PLAN_ID),
        `drive cycle ${i + 1} never selected the halted plan`);
    }
    await w.inst.alarm(); // the production alarm shape: recover + drive
    assert.equal(JSON.stringify(planRow(w.db)), planBefore,
      "the plan row is byte-identical after reconcile + drives + alarm");
    assert.equal(JSON.stringify(attemptRow(w.db)), attemptBefore,
      "the settled attempt was not re-touched");
    assert.equal(planRow(w.db).state, "halted_unknown");
    assert.equal(all(w.db, `SELECT * FROM d6_attempt_log`).length, 1, "no new attempts were recorded");
    assert.equal(all(w.db, `SELECT * FROM d6_execution_records`).length, 0, "no executions were created");
    assert.equal(w.queue.sent.length, 0, "nothing was dispatched to the generation queue");
    const retire = w.service.retireHaltedPlan({ planId: PLAN_ID, source: "operator-route" });
    assert.equal(retire.outcome, "applied",
      "the designed exit still works: retire applies after reconcile (unknowns are closed)");
    assert.equal(planRow(w.db).state, "retired");
  });
}
