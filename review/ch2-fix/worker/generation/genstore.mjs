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
import { ensureGenSchema } from "./gen-schema.mjs";

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

  // The full bootstrap (DDL + the guarded column evolution) lives
  // in gen-schema.mjs so every path that ensures the schema — the
  // D6 entry constructor and this store — evolves the tables the
  // same way.
  function ensureSchema() { ensureGenSchema(sql); }

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

  // CH2 FIX PACKAGE (fix 2): the reconciliation audit. The DDL
  // lives beside its only writer and is ensured lazily inside the
  // reconcile transaction — the phase-policy / plan-retirement
  // precedent — and is deliberately NOT part of GEN_SCHEMA (the
  // correction suites pin the bootstrap's table set; a store that
  // never reconciles never grows the table). One row per
  // reconciled attempt (an attempt reconciles exactly once: the
  // unknown -> known transition is one-way), written in the SAME
  // transaction as the settlement itself, so an applied reconcile
  // always carries its audit row and a refused one never does.
  const RECONCILE_AUDIT_SCHEMA = `
CREATE TABLE IF NOT EXISTS d6_reconcile_audit (
  attempt_id TEXT PRIMARY KEY, plan_id TEXT, phase TEXT,
  final_outcome TEXT NOT NULL, final_cost_micro_cents INTEGER NOT NULL,
  note TEXT, source TEXT, created_at INTEGER NOT NULL);
`;
  function ensureReconcileAuditSchema() {
    sql.exec(RECONCILE_AUDIT_SCHEMA);
  }

  // Operator reconciliation mechanism for one unknown attempt.
  //
  // SETTLEMENT CONTRACT (tightened per Rowan's B2 HOLD,
  // Oct 30, 2026). A settlement is a (knownCostMicro, outcome)
  // pair, validated TOGETHER before anything moves:
  //   * outcome vocabulary — the SETTLEMENT outcomes are
  //     "success", "failed_known", and "no_charge". (Distinct
  //     from the attempt-log outcomes in KNOWN_OUTCOMES:
  //     "policy_block" is not a settlement — a reconcile asserts
  //     a billing fact, not a block classification.)
  //   * knownCostMicro a finite number >= 0 — a KNOWN cost.
  //     outcome may be "success" (the default) or
  //     "failed_known" (a charged-but-failed call); the attempt
  //     is recorded under that outcome at that cost. "success"
  //     REQUIRES the finite known cost: success is a claim that
  //     the call completed at a known price.
  //   * knownCostMicro exactly null — a PROVEN NO-CHARGE: the
  //     operator has established from the provider's records
  //     that nothing was billed. The ONLY consistent settlement
  //     outcome is "no_charge" (the default when outcome is
  //     omitted). null with ANY other outcome — above all
  //     "success", which the pre-B2 code accepted and recorded
  //     as success at cost 0 — is a contradiction and is refused
  //     (reconcile_settlement_inconsistent), as is a numeric
  //     cost paired with "no_charge". On the attempt log a
  //     no-charge settlement records failed_known at cost 0
  //     (the attempt-log vocabulary has no no-charge value, and
  //     phase accounting treats failed_known @ 0 as settled
  //     zero); the settlement outcome "no_charge" itself is
  //     preserved distinctly on the audit row's final_outcome.
  //   * a malformed cost (non-number, NaN, infinite, negative)
  //     refuses as reconcile_cost_invalid; an outcome outside
  //     the settlement vocabulary refuses as
  //     reconcile_outcome_invalid. Every refusal throws inside
  //     the transaction: zero state movement, zero audit rows.
  // When no unknown attempts remain open for the attempt's
  // phase, the phase halt clears in the same transaction.
  // CH2 FIX PACKAGE (fix 2): opts additionally accepts
  // { planId?, note?, source? } — when planId is supplied, the
  // attempt must belong to that plan (reconcile_plan_mismatch;
  // a guard against settling an attempt from the wrong plan;
  // the operator route REQUIRES it — see the entry). The
  // attempt's plan_id was stamped server-side when the attempt
  // was reserved, never caller-supplied, so this check verifies
  // ownership against the server's own linkage. note/source
  // are recorded on the audit row above. The remaining
  // preconditions are unchanged: the attempt must exist and be
  // confirmed/unknown — anything else refuses and moves nothing.
  const SETTLEMENT_OUTCOMES = Object.freeze(["success", "failed_known", "no_charge"]);
  function reconcileUnknown(attemptId, { knownCostMicro = null, outcome = null, planId = null, note = null, source = null } = {}) {
    return coord._tx(() => {
      const row = attemptRow(attemptId);
      if (!row) throw new Error(`attempt_not_found: ${attemptId}`);
      if (!(row.phase === "confirmed" && row.outcome === "unknown"))
        throw new Error(`attempt_not_unknown: ${attemptId} (${row.phase}/${row.outcome})`);
      if (planId !== null && planId !== undefined && row.plan_id !== planId)
        throw new Error(`reconcile_plan_mismatch: attempt ${attemptId} belongs to ${row.plan_id}, not ${planId}`);
      if (knownCostMicro !== null && knownCostMicro !== undefined &&
          (typeof knownCostMicro !== "number" || !Number.isFinite(knownCostMicro) || knownCostMicro < 0))
        throw new Error(`reconcile_cost_invalid: ${knownCostMicro}`);
      if (outcome !== null && outcome !== undefined && !SETTLEMENT_OUTCOMES.includes(outcome))
        throw new Error(`reconcile_outcome_invalid: ${outcome}`);
      let settlementOutcome, finalOutcome, finalCost;
      if (knownCostMicro === null || knownCostMicro === undefined) {
        settlementOutcome = outcome ?? "no_charge";
        if (settlementOutcome !== "no_charge")
          throw new Error(`reconcile_settlement_inconsistent: knownCostMicro null (proven no-charge) requires outcome "no_charge", got "${settlementOutcome}"`);
        finalOutcome = "failed_known";
        finalCost = 0;
      } else {
        settlementOutcome = outcome ?? "success";
        if (settlementOutcome === "no_charge")
          throw new Error(`reconcile_settlement_inconsistent: outcome "no_charge" requires knownCostMicro null, got ${knownCostMicro}`);
        finalOutcome = settlementOutcome;
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
      let planPhase = null;
      if (row.plan_id) {
        const plan = coord._oneOrNull(
          `SELECT * FROM d6_plans WHERE plan_id = ?`, row.plan_id);
        if (plan && plan.phase) {
          planPhase = plan.phase;
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
      // The audit row lands in the same transaction (fix 2).
      // Its final_outcome records the SETTLEMENT outcome
      // (success / failed_known / no_charge) — for a no-charge
      // settlement this is where the distinct value lives,
      // since the attempt log itself records failed_known @ 0.
      ensureReconcileAuditSchema();
      sql.exec(
        `INSERT INTO d6_reconcile_audit
           (attempt_id, plan_id, phase, final_outcome,
            final_cost_micro_cents, note, source, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        attemptId, row.plan_id ?? null, planPhase, settlementOutcome,
        finalCost, note ?? null, source ?? null, now());
      return { attempt: attemptRow(attemptId), haltCleared, settlementOutcome };
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

  // ---- the storage seed (CORRECTION 2) ------------------------------
  // The production seed path for the storage guard's base. The
  // caller (the generation service's seedStorageBase, behind the
  // fenced seed route) supplies the FRESH recount figures; this
  // method is the only writer of the seed columns. Semantics:
  //   * first seed: records baseBytes + objectCount + seededAt and
  //     opens the provenance history;
  //   * re-seed with the SAME values: idempotent — nothing is
  //     written (updated_at and the history stand), reported as
  //     { changed: false, idempotent: true };
  //   * re-seed with DIFFERENT values: replaces the base and
  //     APPENDS a provenance entry carrying the previous values —
  //     a silent overwrite is impossible by construction.
  // The halt fence itself lives in the service (it owns env); this
  // method validates shape and throws on anything but non-negative
  // safe integers, so no caller can seed a nonsense base.
  function storageSeedState() {
    const row = coord._oneOrNull(`SELECT * FROM d6_storage_state WHERE id = 1`);
    if (!row) return {
      seeded: false, baseBytes: 0, objectCount: null,
      seededAt: null, provenance: [],
    };
    return {
      seeded: true,
      baseBytes: row.base_bytes,
      objectCount: row.object_count ?? null,
      seededAt: row.seeded_at ?? null,
      provenance: row.provenance_json ? JSON.parse(row.provenance_json) : [],
    };
  }

  function seedStorageBase({ baseBytes, objectCount = null,
                             recountedAt = null, source = null } = {}) {
    if (!Number.isSafeInteger(baseBytes) || baseBytes < 0)
      throw new Error("storage_seed_shape: baseBytes must be a non-negative safe integer");
    if (objectCount !== null &&
        (!Number.isSafeInteger(objectCount) || objectCount < 0))
      throw new Error("storage_seed_shape: objectCount must be null or a non-negative safe integer");
    const cur = coord._oneOrNull(`SELECT * FROM d6_storage_state WHERE id = 1`);
    if (cur && cur.base_bytes === baseBytes &&
        (cur.object_count ?? null) === objectCount)
      return { ...storageSeedState(), changed: false, idempotent: true };
    const t = now();
    const history = cur && cur.provenance_json
      ? JSON.parse(cur.provenance_json) : [];
    history.push({
      baseBytes, objectCount, seededAt: t,
      recountedAt: recountedAt ?? null, source: source ?? null,
      previous: cur ? {
        baseBytes: cur.base_bytes,
        objectCount: cur.object_count ?? null,
      } : null,
    });
    sql.exec(
      `INSERT INTO d6_storage_state
         (id, base_bytes, object_count, seeded_at, provenance_json, updated_at)
       VALUES (1, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET base_bytes = excluded.base_bytes,
         object_count = excluded.object_count, seeded_at = excluded.seeded_at,
         provenance_json = excluded.provenance_json,
         updated_at = excluded.updated_at`,
      baseBytes, objectCount, t, JSON.stringify(history), t);
    return { ...storageSeedState(), changed: true, idempotent: false };
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
    storageAccounting, setStorageBaseBytes, seedStorageBase, storageSeedState,
    recoveryScan,
  };
}
