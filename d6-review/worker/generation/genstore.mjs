// D6 WS-1 — the generation store (CONTRACTS.md
// "generation/genstore.mjs"). Durable per-occurrence execution
// records, the append-only attempt log, phase accounting, and the
// atomic verified commit — all inside the coordinator's store, all
// through the coordinator's own SQL/transaction helpers so a commit
// here is atomic with the binding and occurrence writes it wraps.
//
// Attempt phases (reserved → dispatching → confirmed | released):
// a `reserved` attempt has NOT dispatched and is not spend and not a
// call; `markDispatching` is the ONLY path that may precede a
// provider call; a `released` row (outcome NULL, cost 0) provably
// never dispatched. Rows are never deleted.
import { randomUUID } from "node:crypto";
import { GEN_SCHEMA } from "./gen-schema.mjs";

export const EXECUTION_STATES = Object.freeze([
  "granted", "attempted", "synthesized", "flushed", "verified",
  "committed", "failed", "unknown_billing",
]);
export const EXECUTION_TERMINAL_STATES = Object.freeze(["committed", "failed"]);

// The execution state machine: the linear happy path plus, from any
// non-terminal state, the two failure exits. Anything else throws.
const EXEC_TRANSITIONS = Object.freeze({
  granted: ["attempted", "failed", "unknown_billing"],
  attempted: ["synthesized", "failed", "unknown_billing"],
  synthesized: ["flushed", "failed", "unknown_billing"],
  flushed: ["verified", "failed", "unknown_billing"],
  verified: ["committed", "failed", "unknown_billing"],
  unknown_billing: ["failed"],
  committed: [],
  failed: [],
});

export const ATTEMPT_OUTCOMES = Object.freeze([
  "success", "failed_known", "policy_block", "unknown",
]);
const KNOWN_OUTCOMES = Object.freeze(["success", "failed_known", "policy_block"]);

export function createGenStore(coord) {
  if (!coord || !coord.sql) throw new Error("createGenStore requires a coordinator");
  const sql = coord.sql;
  const now = () => coord._now();

  function ensureSchema() { sql.exec(GEN_SCHEMA); }

  function executionRow(executionId) {
    return coord._oneOrNull(
      `SELECT * FROM d6_execution_records WHERE execution_id = ?`, executionId);
  }

  // If a non-terminal execution exists for (job_id, occurrence_id),
  // return it with created:false — never a second live execution
  // (unknown_billing counts as non-terminal here: it must be
  // reconciled, never bypassed by a fresh execution).
  function createExecution({ planId = null, jobId, occurrenceId, grantId = null }) {
    const live = coord._oneOrNull(
      `SELECT * FROM d6_execution_records
        WHERE job_id = ? AND occurrence_id = ? AND state NOT IN ('committed', 'failed')
        ORDER BY created_at DESC, execution_id DESC LIMIT 1`, jobId, occurrenceId);
    if (live) return { executionId: live.execution_id, created: false, execution: live };
    const executionId = `exec-${randomUUID()}`;
    const t = now();
    sql.exec(
      `INSERT INTO d6_execution_records
         (execution_id, plan_id, job_id, occurrence_id, grant_id, state, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'granted', ?, ?)`,
      executionId, planId, jobId, occurrenceId, grantId, t, t);
    return { executionId, created: true, execution: executionRow(executionId) };
  }

  // Latest execution record for (jobId, occurrenceId), or null.
  function executionFor(jobId, occurrenceId) {
    return coord._oneOrNull(
      `SELECT * FROM d6_execution_records
        WHERE job_id = ? AND occurrence_id = ?
        ORDER BY created_at DESC, execution_id DESC LIMIT 1`, jobId, occurrenceId);
  }

  // Validated state transition. `detail` may carry record fields
  // (stage, cacheKey, objectKey, etag, sizeBytes, sha256); any other
  // keys are merged into detail_json.
  function transitionExecution(executionId, to, detail = null) {
    const row = executionRow(executionId);
    if (!row) throw new Error(`execution_not_found: ${executionId}`);
    const allowed = EXEC_TRANSITIONS[row.state] || [];
    if (!allowed.includes(to))
      throw new Error(`illegal_execution_transition: ${row.state} -> ${to} (${executionId})`);
    const d = detail || {};
    const merged = { ...(row.detail_json ? JSON.parse(row.detail_json) : {}), ...d };
    sql.exec(
      `UPDATE d6_execution_records
          SET state = ?, stage = ?, cache_key = ?, object_key = ?, etag = ?,
              size_bytes = ?, sha256 = ?, detail_json = ?, updated_at = ?
        WHERE execution_id = ?`,
      to,
      d.stage !== undefined ? d.stage : row.stage,
      d.cacheKey !== undefined ? d.cacheKey : row.cache_key,
      d.objectKey !== undefined ? d.objectKey : row.object_key,
      d.etag !== undefined ? d.etag : row.etag,
      d.sizeBytes !== undefined ? d.sizeBytes : row.size_bytes,
      d.sha256 !== undefined ? d.sha256 : row.sha256,
      Object.keys(merged).length ? JSON.stringify(merged) : row.detail_json,
      now(), executionId);
    return executionRow(executionId);
  }

  function failExecution(executionId, stage, detail = null) {
    const row = executionRow(executionId);
    if (!row) throw new Error(`execution_not_found: ${executionId}`);
    if (row.state === "failed") return row;
    return transitionExecution(executionId, "failed", { ...(detail || {}), stage });
  }

  // ---- attempt log -------------------------------------------------

  function attemptRow(attemptId) {
    return coord._oneOrNull(`SELECT * FROM d6_attempt_log WHERE attempt_id = ?`, attemptId);
  }

  // Reserve an attempt (phase reserved): recorded BEFORE any
  // dispatch; a reservation is not a call and not spend.
  function reserveAttempt(executionId, { upperMicroCents } = {}) {
    const exec = executionRow(executionId);
    if (!exec) throw new Error(`execution_not_found: ${executionId}`);
    if (EXECUTION_TERMINAL_STATES.includes(exec.state))
      throw new Error(`execution_terminal: ${exec.state} (${executionId})`);
    const seqRow = coord._one(
      `SELECT COALESCE(MAX(seq), 0) AS m FROM d6_attempt_log WHERE execution_id = ?`,
      executionId);
    const attemptId = `att-${randomUUID()}`;
    const t = now();
    sql.exec(
      `INSERT INTO d6_attempt_log
         (attempt_id, execution_id, plan_id, occurrence_id, seq, phase,
          outcome, cost_micro_cents, upper_micro_cents, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'reserved', NULL, NULL, ?, ?, ?)`,
      attemptId, executionId, exec.plan_id, exec.occurrence_id,
      (seqRow ? seqRow.m : 0) + 1, upperMicroCents ?? 0, t, t);
    return attemptId;
  }

  // reserved -> dispatching. The ONLY path that may precede a
  // provider call.
  function markDispatching(attemptId) {
    const row = attemptRow(attemptId);
    if (!row) throw new Error(`attempt_not_found: ${attemptId}`);
    if (row.phase !== "reserved")
      throw new Error(`illegal_attempt_transition: ${row.phase} -> dispatching (${attemptId})`);
    sql.exec(`UPDATE d6_attempt_log SET phase = 'dispatching', updated_at = ? WHERE attempt_id = ?`,
      now(), attemptId);
    return attemptRow(attemptId);
  }

  // dispatching -> confirmed. Known outcomes (success | failed_known
  // | policy_block) MUST carry a numeric cost; outcome `unknown`
  // MUST carry cost null — an unknown outcome is never treated as
  // free and never silently zeroed.
  function confirmAttempt(attemptId, { outcome, costMicroCents = null, providerRequestId = null } = {}) {
    const row = attemptRow(attemptId);
    if (!row) throw new Error(`attempt_not_found: ${attemptId}`);
    if (row.phase !== "dispatching")
      throw new Error(`illegal_attempt_transition: ${row.phase} -> confirmed (${attemptId})`);
    if (!ATTEMPT_OUTCOMES.includes(outcome))
      throw new Error(`attempt_outcome_invalid: ${outcome}`);
    if (KNOWN_OUTCOMES.includes(outcome) && typeof costMicroCents !== "number")
      throw new Error(`attempt_cost_required_for_known_outcome: ${outcome}`);
    if (outcome === "unknown" && costMicroCents !== null)
      throw new Error("attempt_cost_must_be_null_for_unknown_outcome");
    sql.exec(
      `UPDATE d6_attempt_log
          SET phase = 'confirmed', outcome = ?, cost_micro_cents = ?,
              provider_request_id = ?, updated_at = ?
        WHERE attempt_id = ?`,
      outcome, costMicroCents, providerRequestId, now(), attemptId);
    return attemptRow(attemptId);
  }

  // reserved -> released: the attempt provably never dispatched
  // (outcome stays NULL, cost is set to 0 — it counts as NO call in
  // every accounting view).
  function releaseAttempt(attemptId) {
    const row = attemptRow(attemptId);
    if (!row) throw new Error(`attempt_not_found: ${attemptId}`);
    if (row.phase !== "reserved")
      throw new Error(`illegal_attempt_transition: ${row.phase} -> released (${attemptId})`);
    sql.exec(
      `UPDATE d6_attempt_log SET phase = 'released', cost_micro_cents = 0, updated_at = ?
        WHERE attempt_id = ?`, now(), attemptId);
    return attemptRow(attemptId);
  }

  function attemptsForOccurrence(planId, occurrenceId) {
    return coord._all(
      `SELECT * FROM d6_attempt_log WHERE plan_id = ? AND occurrence_id = ?
        ORDER BY created_at, seq`, planId, occurrenceId);
  }

  function attemptsForExecution(executionId) {
    return coord._all(
      `SELECT * FROM d6_attempt_log WHERE execution_id = ? ORDER BY seq`, executionId);
  }

  // Attempts that count toward the 12-attempt segment budget:
  // dispatching + confirmed. Reserved and released do NOT count —
  // they provably never became provider calls.
  function segmentAttemptsUsed(planId, occurrenceId) {
    return coord._one(
      `SELECT COUNT(*) AS n FROM d6_attempt_log
        WHERE plan_id = ? AND occurrence_id = ? AND phase IN ('dispatching', 'confirmed')`,
      planId, occurrenceId).n;
  }

  // ---- the atomic verified commit ----------------------------------
  // Runs INSIDE coord._tx: (1) coord.validateAndBind (a bound:false
  // verdict aborts by throwing — nothing commits), (2) the
  // occurrence's cache_key update + report_success event, (3) the
  // execution record -> committed. All-or-nothing. Idempotent on
  // (occurrenceId, executionId): re-committing a committed execution
  // is a no-op return.
  function commitVerified({ executionId, jobId, occurrenceId, revisionKey,
                            cacheKey, sha256 = null, provenance = null }) {
    return coord._tx(() => {
      const exec = executionRow(executionId);
      if (!exec) throw new Error(`execution_not_found: ${executionId}`);
      if (exec.state === "committed") return { bound: true, idempotent: true };
      if (exec.state !== "verified")
        throw new Error(`commit_requires_verified_execution: ${exec.state} (${executionId})`);
      const v = coord.validateAndBind({
        occurrenceId, revisionKey, cacheKey,
        provenance: provenance ?? `d6:${executionId}`,
        jobId, expectedSha256: sha256,
      });
      if (!v.bound) {
        const err = new Error(`commit_validate_failed: ${v.reason}`);
        err.reason = v.reason;
        throw err;
      }
      const occ = coord._oneOrNull(
        `SELECT * FROM occurrences WHERE job_id = ? AND occurrence_id = ?`,
        jobId, occurrenceId);
      if (!occ) throw new Error(`occurrence_not_found: ${jobId}/${occurrenceId}`);
      sql.exec(`UPDATE occurrences SET cache_key = ? WHERE job_id = ? AND occurrence_id = ?`,
        cacheKey, jobId, occurrenceId);
      if (occ.state === "granted") {
        const r = coord.applyOccEvent(jobId, occurrenceId, "report_success",
          "d6_commit", { executionId });
        if (!r.ok) throw new Error(`commit_occurrence_transition_failed: ${r.reason}`);
      } else if (occ.state !== "ready") {
        throw new Error(`commit_occurrence_state_unexpected: ${occ.state}`);
      }
      transitionExecution(executionId, "committed", { cacheKey, sha256 });
      return { bound: true };
    });
  }

  // ---- unknown billing: phase halt + reconciliation -----------------

  // Execution -> unknown_billing AND the plan's phase halt, in the
  // SAME transaction: there is no state in which the execution is
  // marked unknown but the phase can still grant.
  function markUnknownBilling(executionId, detail = null) {
    return coord._tx(() => {
      const exec = transitionExecution(executionId, "unknown_billing",
        detail && typeof detail === "object" ? detail : { detail });
      if (exec.plan_id) {
        const plan = coord._oneOrNull(
          `SELECT * FROM d6_plans WHERE plan_id = ?`, exec.plan_id);
        if (plan && plan.phase) {
          sql.exec(
            `INSERT INTO d6_phase_state (phase, halted_unknown_billing, halt_detail, updated_at)
             VALUES (?, 1, ?, ?)
             ON CONFLICT(phase) DO UPDATE SET halted_unknown_billing = 1,
               halt_detail = excluded.halt_detail, updated_at = excluded.updated_at`,
            plan.phase, JSON.stringify(detail ?? null), now());
        }
      }
      return exec;
    });
  }

  function phaseAccounting(phase) {
    const settled = coord._one(
      `SELECT COALESCE(SUM(a.cost_micro_cents), 0) AS s FROM d6_attempt_log a
        WHERE a.outcome IN ('success', 'failed_known', 'policy_block')
          AND a.phase = 'confirmed'
          AND a.plan_id IN (SELECT plan_id FROM d6_plans WHERE phase = ?)`, phase);
    const inFlight = coord._one(
      `SELECT COALESCE(SUM(a.upper_micro_cents), 0) AS s FROM d6_attempt_log a
        WHERE a.phase IN ('reserved', 'dispatching')
          AND a.plan_id IN (SELECT plan_id FROM d6_plans WHERE phase = ?)`, phase);
    const unknown = coord._one(
      `SELECT COUNT(*) AS n FROM d6_attempt_log a
        WHERE a.phase = 'confirmed' AND a.outcome = 'unknown'
          AND a.plan_id IN (SELECT plan_id FROM d6_plans WHERE phase = ?)`, phase);
    return {
      settledMicro: settled.s,
      inFlightUpperMicro: inFlight.s,
      unknownOpen: unknown.n,
    };
  }

  // Operator reconciliation mechanism for one unknown attempt:
  // { knownCostMicro: <number>, outcome? } records the now-known
  // cost under a known outcome (default: "success" when a cost is
  // supplied — the caller may pass outcome "failed_known" for a
  // charged-but-failed call); { knownCostMicro: null } records a
  // proven no-charge as failed_known with cost 0. When no unknown
  // attempts remain open for the attempt's phase, the phase halt
  // clears in the same transaction.
  function reconcileUnknown(attemptId, { knownCostMicro = null, outcome = null } = {}) {
    return coord._tx(() => {
      const row = attemptRow(attemptId);
      if (!row) throw new Error(`attempt_not_found: ${attemptId}`);
      if (!(row.phase === "confirmed" && row.outcome === "unknown"))
        throw new Error(`attempt_not_unknown: ${attemptId} (${row.phase}/${row.outcome})`);
      let finalOutcome, finalCost;
      if (knownCostMicro === null || knownCostMicro === undefined) {
        finalOutcome = outcome || "failed_known";
        finalCost = 0;
      } else {
        if (typeof knownCostMicro !== "number")
          throw new Error("reconcile_cost_must_be_number_or_null");
        finalOutcome = outcome || "success";
        finalCost = knownCostMicro;
      }
      if (!KNOWN_OUTCOMES.includes(finalOutcome))
        throw new Error(`reconcile_outcome_invalid: ${finalOutcome}`);
      sql.exec(
        `UPDATE d6_attempt_log SET outcome = ?, cost_micro_cents = ?, updated_at = ?
          WHERE attempt_id = ?`, finalOutcome, finalCost, now(), attemptId);
      // Clear the phase halt when this was the phase's last open
      // unknown.
      let haltCleared = false;
      if (row.plan_id) {
        const plan = coord._oneOrNull(
          `SELECT * FROM d6_plans WHERE plan_id = ?`, row.plan_id);
        if (plan && plan.phase) {
          const acct = phaseAccounting(plan.phase);
          if (acct.unknownOpen === 0) {
            sql.exec(
              `UPDATE d6_phase_state SET halted_unknown_billing = 0,
                 halt_detail = NULL, updated_at = ? WHERE phase = ?`,
              now(), plan.phase);
            haltCleared = true;
          }
        }
      }
      return { attempt: attemptRow(attemptId), haltCleared };
    });
  }

  // ---- storage accounting -------------------------------------------
  // baseBytes: the bucket's pre-D6 usage, seeded by the operator
  // from the verified account listing (PINS.md §3). d6Bytes: bytes
  // D6 itself has durably flushed (execution records in
  // flushed | verified | committed).
  function storageAccounting() {
    const base = coord._oneOrNull(`SELECT * FROM d6_storage_state WHERE id = 1`);
    const d6 = coord._one(
      `SELECT COALESCE(SUM(size_bytes), 0) AS s FROM d6_execution_records
        WHERE state IN ('flushed', 'verified', 'committed')`);
    return { baseBytes: base ? base.base_bytes : 0, d6Bytes: d6.s };
  }

  function setStorageBaseBytes(baseBytes) {
    sql.exec(
      `INSERT INTO d6_storage_state (id, base_bytes, updated_at) VALUES (1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET base_bytes = excluded.base_bytes,
         updated_at = excluded.updated_at`, baseBytes, now());
    return storageAccounting();
  }

  // ---- crash recovery scan -------------------------------------------
  // Classify every non-terminal execution record for the recovery
  // path (proposal §4 / FI-6). Classification only — the caller
  // (service.recover / the executor) performs the actions; R2-side
  // re-verification belongs to the executor, which owns R2.
  function recoveryScan() {
    const rows = coord._all(
      `SELECT * FROM d6_execution_records
        WHERE state NOT IN ('committed', 'failed') ORDER BY created_at, execution_id`);
    return rows.map(execution => {
      let action;
      if (execution.state === "flushed" || execution.state === "verified")
        action = "reverify_and_commit";
      else if (execution.state === "synthesized")
        action = "reenter_flush";
      else if (execution.state === "unknown_billing")
        action = "reconcile_hold";
      else { // granted | attempted
        const dispatching = coord._one(
          `SELECT COUNT(*) AS n FROM d6_attempt_log
            WHERE execution_id = ? AND phase = 'dispatching'`, execution.execution_id).n;
        action = dispatching > 0 ? "reconcile_hold" : "release_and_fail";
      }
      return { execution, action };
    });
  }

  return {
    ensureSchema,
    createExecution, executionFor, transitionExecution, failExecution,
    reserveAttempt, markDispatching, confirmAttempt, releaseAttempt,
    attemptsForOccurrence, attemptsForExecution, segmentAttemptsUsed,
    commitVerified, markUnknownBilling, phaseAccounting, reconcileUnknown,
    storageAccounting, setStorageBaseBytes, recoveryScan,
  };
}
