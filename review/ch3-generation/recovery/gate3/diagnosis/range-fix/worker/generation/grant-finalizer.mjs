// Ch 3 Phase A RECOVERY — Option A (RECOVERY-PROPOSAL-DRAFT §4):
// the dedicated operator-only GRANT FINALIZER.
//
// The stall this repairs (DIAGNOSIS.md): cohort 1 of plan
// plan:e377a5559961b294154276b6 committed all eight of its
// occurrences through the store commit path, but the executor's
// end-of-message handleReport never landed. The grant therefore
// remains 'issued', its claim 'claimed', and its eight quota
// reservations 'open' — and no shipped automatic path can close
// it (redelivery skips the now-'ready' occurrences and never
// re-calls handleReport; the driver refuses a second grant while
// one reads 'issued'; rollover does not close either record).
//
// This module is the truthful manual closure for exactly that
// shape, built to the proposal's §4 discipline:
//
//   * TWO surfaces, one derivation. The preview (read-only) and
//     the action share deriveGrantFinalizationState: every fact
//     is re-derived server-side from durable records; no
//     caller-supplied count, outcome, or close reason is ever
//     trusted. The action body is a closed allowlist (enforced at
//     the entry): { grantId, planId, jobId, authorizationRef,
//     expectedPreconditionDigest }. There is NO results array —
//     the caller can never supply success/failure/block outcomes.
//   * ONE transaction. All precondition reads AND all writes run
//     inside a single coord._tx (the action derives INSIDE the
//     transaction, so the state it proves is the state it acts
//     on — the releasePark/bootstrapQuota shape). A failed
//     post-write verification throws a FinalizeAbort, which rolls
//     the whole transaction back: a partial finalization is not
//     an acceptable outcome.
//   * The writes are exactly handleReport's closure, made
//     STRICTER (proposal §4.4): one audit row in the new
//     append-only d6_grant_finalizations (keyed by grant_id);
//     grants -> 'reported' with a report_json that is a clearly
//     labeled operator-finalization record, never an impersonated
//     executor report; _completeClaim; settleReservationsForGrant
//     with its result REQUIRED to be exactly the expected
//     reservation ids in `closed` and an empty `blocked` list
//     (generic handleReport does not inspect the blocked list);
//     _deriveJobCompletion, verified to leave the job
//     'generating'. The generic closure's "defer unmentioned
//     granted targets" step is a PROVED no-op here — precondition
//     7 establishes no target is 'granted', and the finalizer
//     re-asserts that inside the write phase (any granted target
//     aborts) instead of deferring anything (proposal §4.4 design
//     note, branch (b): the assertion form, achieved without
//     touching handleReport's behavior for ordinary reports).
//   * Idempotency by state recognition (§4.5), never by repeating
//     effects: an exact replay returns
//     { outcome: "already_finalized" } with zero writes; a grant
//     reported WITHOUT this finalizer's audit row returns
//     { outcome: "already_reported_not_finalizer" } (a real
//     executor report landed — not ours to claim); a reported
//     grant whose reservations are still open is an inconsistent
//     partial state and REFUSES (grant_finalization_
//     reported_inconsistent) — it is never silently settled on
//     the replay path.
//   * The audit table is NOT in gen-schema.mjs: it bootstraps
//     lazily, DDL-only and idempotent, inside this module — the
//     house pattern for every post-genesis table
//     (d6_park_releases, d6_quarantine_holds,
//     d6_provider_dispatches). With the table absent the preview
//     reads it throw-safely as "no audit row" (the quota D1
//     cold-start discipline); writers ensure the schema first
//     and then read strictly. GEN_SCHEMA is untouched.
//   * Absence-safe reads (§4.3's reading rule): every read whose
//     absence is a legitimate refusal outcome uses _oneOrNull or
//     _all; bare _one() is used only for SQLite-guaranteed
//     aggregate rows (COUNT(*) / COALESCE(SUM(...))).
//
// Phase accounting and plan totals are computed with the same
// queries as genstore.phaseAccounting and service.planStatus
// (duplicated here so this module never imports the store or the
// service — the quota-budget.mjs segmentAttemptsUsed precedent:
// the two must not drift, and the finalizer suites pin the
// agreement against the live-shaped fixture).
//
// Store discipline mirrors park-release.mjs / quota-budget.mjs:
// validation failures return named domain refusals
// ({ outcome: "rejected", reason }); unexpected faults THROW
// (the entry maps them to HTTP 500 — never laundered).

import { createHash } from "node:crypto";
import {
  settleReservationsForGrant, derivedDayTotals, quotaArmed,
} from "./quota-budget.mjs";
import { prefixRangeClause } from "./prefix-range.mjs";

export const GRANT_FINALIZATION_SCHEMA = [
  // Append-only finalization audit: one row per finalized grant,
  // keyed by grant_id (a duplicate primary key on a replayed
  // write is the idempotency tripwire, never papered over). The
  // row records the authorization reference, the precondition
  // digest the action verified, and the before totals it proved.
  `CREATE TABLE IF NOT EXISTS d6_grant_finalizations (
     grant_id TEXT PRIMARY KEY,
     plan_id TEXT NOT NULL,
     job_id TEXT NOT NULL,
     book_id TEXT NOT NULL,
     chapter_index INTEGER,
     authorization_ref TEXT NOT NULL,
     precondition_digest TEXT NOT NULL,
     before_totals_json TEXT NOT NULL,
     outcome TEXT NOT NULL,
     finalized_at INTEGER NOT NULL
   )`,
];

export const GRANT_FINALIZATION_SCHEMA_SQL =
  GRANT_FINALIZATION_SCHEMA.join(";\n") + ";";

export function ensureGrantFinalizationSchema(sql) {
  // DDL-only + idempotent: safe to run on every write path.
  sql.exec(GRANT_FINALIZATION_SCHEMA_SQL);
}

const rejected = (reason, extra = {}) => ({ outcome: "rejected", reason, ...extra });
const isNonblankString = (v) => typeof v === "string" && v.trim().length > 0;

// Thrown inside the finalization transaction to force a rollback
// while still returning a named domain refusal (the
// coordinator._issueGrant Rollback-class pattern).
class FinalizeAbort extends Error {
  constructor(reason) { super(reason); this.reason = reason; }
}

// Throw-safe reads for the lazily-bootstrapped tables this module
// consults on read paths (audit, park releases, exemptions): a
// not-yet-created table reads as "no rows"; any other database
// error is rethrown (the D8-1 discipline, mirroring
// park-release.mjs's readRowSafe/readAllSafe).
function readAllSafe(coord, query, ...params) {
  try {
    return coord.sql.exec(query, ...params).toArray();
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) return [];
    throw e;
  }
}
function readOneSafe(coord, query, ...params) {
  const rows = readAllSafe(coord, query, ...params);
  return rows.length ? rows[0] : null;
}

// Canonical JSON (sorted keys, recursively) — the coordinator's
// own canonicalization discipline, so digests are byte-stable
// across processes and replays.
function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort()
    .map(k => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(",")}}`;
}

export function grantFinalizationDigest(view) {
  return createHash("sha256").update(canonicalJson(view), "utf8").digest("hex");
}

export function grantFinalizationAuditView(row) {
  if (!row) return null;
  let beforeTotals = null;
  try { beforeTotals = JSON.parse(row.before_totals_json || "null"); }
  catch { /* a corrupt stored record reads as null, never invented */ }
  return {
    grantId: row.grant_id,
    planId: row.plan_id,
    jobId: row.job_id,
    bookId: row.book_id,
    chapterIndex: row.chapter_index,
    authorizationRef: row.authorization_ref,
    preconditionDigest: row.precondition_digest,
    beforeTotals,
    outcome: row.outcome,
    finalizedAt: row.finalized_at,
  };
}

function getFinalizationAudit(coord, grantId) {
  return readOneSafe(coord,
    `SELECT * FROM d6_grant_finalizations WHERE grant_id = ?`, grantId);
}

// ------------------------------------------------------------------
// Phase accounting — the genstore.phaseAccounting queries,
// duplicated under the no-drift discipline (see header). Returns
// ledger units (the D6 ledger's "micro cents" naming).
function phaseAccountingView(coord, phase) {
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
  let estimatedMicro = 0, reservedMicro = 0;
  const hasAdjudications = readAllSafe(coord,
    `SELECT name FROM sqlite_master WHERE type = 'table'
      AND name = 'd6_billing_adjudications'`).length > 0;
  if (hasAdjudications) {
    const row = coord._one(
      `SELECT COALESCE(SUM(a.estimated_cost_micro_cents), 0) AS est,
              COALESCE(SUM(a.reserved_cost_micro_cents), 0) AS res
         FROM d6_billing_adjudications a
         JOIN d6_attempt_log t ON t.attempt_id = a.attempt_id
        WHERE t.plan_id IN (SELECT plan_id FROM d6_plans WHERE phase = ?)
          AND t.outcome = 'estimated_unverified'
          AND a.current_amendment = 0`, phase);
    estimatedMicro = row.est; reservedMicro = row.res;
  }
  return {
    phase,
    settledMicro: settled.s,
    inFlightUpperMicro: inFlight.s,
    unknownOpen: unknown.n,
    estimatedUnverifiedMicro: estimatedMicro,
    reservedUnverifiedMicro: reservedMicro,
  };
}

// Plan totals — the service.planStatus derivation (eligible
// entries only; done/failed read occurrence + execution state;
// prompts are voice_prompt entries).
function planTotalsView(coord, store, planId, entries) {
  const eligible = entries.filter(e => e.disposition === "eligible");
  const stateOf = (e) => {
    const occ = e.job_id ? coord._oneOrNull(
      `SELECT state FROM occurrences WHERE job_id = ? AND occurrence_id = ?`,
      e.job_id, e.occurrence_id) : null;
    const exec = e.job_id ? store.executionFor(e.job_id, e.occurrence_id) : null;
    return { occ: occ ? occ.state : null, exec: exec ? exec.state : null };
  };
  let done = 0, failed = 0, blocked = 0;
  for (const e of eligible) {
    const s = stateOf(e);
    if (s.occ === "ready" || s.exec === "committed") done++;
    if (s.occ === "failed" || s.exec === "failed") failed++;
    if (s.occ === "blocked_policy") blocked++;
  }
  return {
    eligible: eligible.length,
    done, failed, blocked,
    prompts: entries.filter(e => e.disposition === "voice_prompt").length,
  };
}

// ------------------------------------------------------------------
// The shared derivation. Reads ONLY (never writes; never ensures
// any schema). Returns exactly one of:
//
//   { classification: "finalizable", view, digest }
//   { classification: "already_finalized", view }
//   { classification: "already_reported_not_finalizer", view }
//   { classification: "refused", reason, ...context }
//
// Checks run in the proposal §4.3 order; the FIRST failure is the
// refusal (the park-release discipline). The view is the complete
// Gate 3 census surface for this grant: identity, states, the
// claim, the outbox, every target with its execution / attempts /
// reservation rows, the pending partition, day totals, phase
// accounting, sync watermarks, and the Phase B fence state.
export function deriveGrantFinalizationState(coord, store, { grantId, planId = null, jobId = null } = {}) {
  const refuse = (reason, extra = {}) => ({ classification: "refused", reason, ...extra });
  if (!isNonblankString(grantId)) return refuse("grant_finalization_grant_required");

  // §4.3.1 — the grant exists; body links match it exactly.
  const grant = coord._oneOrNull(`SELECT * FROM grants WHERE grant_id = ?`, grantId);
  if (!grant) return refuse("grant_finalization_grant_not_found", { grantId });
  if (jobId !== null && jobId !== grant.job_id)
    return refuse("grant_finalization_identity_mismatch", { grantId, jobId });
  const effJobId = grant.job_id;
  const linkRows = coord._all(
    `SELECT * FROM d6_plan_jobs WHERE job_id = ?`, effJobId);
  if (linkRows.length !== 1)
    return refuse("grant_finalization_plan_link_mismatch", { grantId, jobId: effJobId });
  const link = linkRows[0];
  if (planId !== null && planId !== link.plan_id)
    return refuse("grant_finalization_identity_mismatch", { grantId, planId });
  const effPlanId = link.plan_id;

  // §4.3.2 — the job exists, is generating, and has exactly one
  // grant: this one.
  const job = coord._oneOrNull(`SELECT * FROM jobs WHERE job_id = ?`, effJobId);
  if (!job) return refuse("grant_finalization_job_not_found", { grantId, jobId: effJobId });
  const jobGrants = coord._all(
    `SELECT grant_id, state, revision FROM grants WHERE job_id = ? ORDER BY grant_id`,
    effJobId);
  if (jobGrants.length !== 1 || jobGrants[0].grant_id !== grantId)
    return refuse("grant_finalization_multiple_grants", { grantId, jobId: effJobId });

  // §4.3.3 — the plan exists, is active, and its identity agrees
  // with the job's (book / lane; chapter via the plan link).
  const plan = coord._oneOrNull(`SELECT * FROM d6_plans WHERE plan_id = ?`, effPlanId);
  if (!plan) return refuse("grant_finalization_plan_not_found", { grantId, planId: effPlanId });
  if (plan.state !== "active")
    return refuse("grant_finalization_plan_not_active", { grantId, planId: effPlanId, state: plan.state });
  if (plan.book_id !== job.book_id || plan.lane !== job.lane
      || link.chapter_index !== job.chapter_index)
    return refuse("grant_finalization_plan_link_mismatch", { grantId, planId: effPlanId });

  const entries = coord._all(
    `SELECT * FROM d6_plan_entries WHERE plan_id = ? ORDER BY chapter_index, position`,
    effPlanId);
  const eligibleEntries = entries.filter(e => e.disposition === "eligible"
    && e.job_id === effJobId);
  const totals = planTotalsView(coord, store, effPlanId, entries);

  const auditRow = getFinalizationAudit(coord, grantId);
  const claim = coord._oneOrNull(`SELECT * FROM claims WHERE grant_id = ?`, grantId);
  const reservationsAll = quotaArmed(coord)
    ? coord._all(`SELECT * FROM d6_grant_reservations WHERE grant_id = ?
                   ORDER BY reservation_id`, grantId)
    : [];

  // §4.5 classifications for an already-reported grant.
  if (grant.state === "reported") {
    const view = {
      grantId, planId: effPlanId, jobId: effJobId,
      bookId: job.book_id, chapterIndex: job.chapter_index,
      lane: job.lane, phase: plan.phase,
      grant: { grantId, jobId: effJobId, revision: grant.revision, state: grant.state },
      job: { jobId: effJobId, state: job.state, revision: job.revision, kind: job.kind },
      plan: { planId: effPlanId, state: plan.state, totals },
      claim: claim ? { state: claim.state } : null,
      audit: grantFinalizationAuditView(auditRow),
      reservations: reservationsAll.map(r => ({
        reservationId: r.reservation_id, occurrenceId: r.occurrence_id,
        dayKey: r.day_key, slotsTotal: r.slots_total,
        slotsConsumed: r.slots_consumed, state: r.state,
        closeReason: r.close_reason ?? null,
      })),
    };
    if (!auditRow)
      return { classification: "already_reported_not_finalizer", view };
    const closedOk = reservationsAll.length > 0
      && reservationsAll.every(r => r.state === "closed"
        && r.close_reason === "grant_settled");
    if (claim && claim.state === "completed" && closedOk)
      return { classification: "already_finalized", view };
    // Reported, with a finalizer audit row, but the rest of the
    // finalized shape does not hold: a partial state this
    // finalizer cannot produce (its transaction commits all of
    // it or none of it). STOP — never settle on the replay path.
    return refuse("grant_finalization_reported_inconsistent", { grantId });
  }
  if (grant.state !== "issued")
    return refuse("grant_finalization_grant_not_issued",
      { grantId, state: grant.state });
  // An audit row beside an ISSUED grant is equally impossible for
  // this finalizer (the audit insert and the grant update commit
  // together) — a pre-existing audit mismatch stops everything.
  if (auditRow)
    return refuse("grant_finalization_audit_mismatch", { grantId });
  if (job.state !== "generating")
    return refuse("grant_finalization_job_state_mismatch",
      { grantId, jobId: effJobId, state: job.state });
  // §4.3.3 (totals half): the plan's eligible set for this job is
  // non-empty and its totals carry no failure/block/prompt.
  if (eligibleEntries.length === 0)
    return refuse("grant_finalization_plan_totals_mismatch", { grantId, planId: effPlanId });
  if (totals.failed !== 0 || totals.blocked !== 0 || totals.prompts !== 0)
    return refuse("grant_finalization_plan_totals_mismatch",
      { grantId, planId: effPlanId, totals });

  // §4.3.4 — the Phase B fences are exactly as Phase A left them:
  // no exemption row for the chapter's final occurrence, and the
  // park release for the parked job is live and covers every
  // eligible id (and not the final occurrence).
  const parkedEntries = entries.filter(e => e.disposition === "excluded_parked");
  const otherEntries = entries.filter(e => e.disposition !== "eligible"
    && e.disposition !== "excluded_parked" && e.disposition !== "voice_prompt");
  if (parkedEntries.length !== 1)
    return refuse("grant_finalization_plan_totals_mismatch",
      { grantId, planId: effPlanId, reason_detail: "excluded_parked_count" });
  const finalOccurrenceId = parkedEntries[0].occurrence_id;
  const exemption = readOneSafe(coord,
    `SELECT * FROM d6_chapter_exemptions WHERE occurrence_id = ?`, finalOccurrenceId);
  if (exemption)
    return refuse("grant_finalization_exemption_present",
      { grantId, occurrenceId: finalOccurrenceId });
  const parkedJobs = coord._all(
    `SELECT * FROM jobs WHERE book_id = ? AND chapter_index = ? AND state = 'parked_policy'
      ORDER BY job_id`, job.book_id, job.chapter_index);
  if (parkedJobs.length !== 1)
    return refuse("grant_finalization_park_release_mismatch",
      { grantId, parkedJobCount: parkedJobs.length });
  const releaseRow = readOneSafe(coord,
    `SELECT * FROM d6_park_releases WHERE job_id = ? AND state = 'live'
      ORDER BY release_id DESC LIMIT 1`, parkedJobs[0].job_id);
  let releaseIds = null;
  if (releaseRow) {
    try {
      const parsed = JSON.parse(releaseRow.occurrence_ids_json || "[]");
      if (Array.isArray(parsed)) releaseIds = parsed;
    } catch { /* corrupt set reads as no set */ }
  }
  const eligibleIds = eligibleEntries.map(e => e.occurrence_id);
  if (!releaseRow || !releaseIds
      || !eligibleIds.every(id => releaseIds.includes(id))
      || releaseIds.includes(finalOccurrenceId))
    return refuse("grant_finalization_park_release_mismatch",
      { grantId, parkedJobId: parkedJobs[0].job_id });
  const parkRelease = {
    releaseId: releaseRow.release_id, jobId: parkedJobs[0].job_id,
    state: releaseRow.state, occurrenceCount: releaseIds.length,
    coversEligible: true,
  };
  void otherEntries;

  // §4.3.5 — the grant's target set: its ledger attempt ops.
  // RANGE-FIX (Option B): the prefix scan is a half-open PK range,
  // not a LIKE pattern (see prefix-range.mjs). The ORDER BY is
  // unchanged; the range is served in the same PK index order.
  const ledgerPred = prefixRangeClause("op_key", `op:${grantId}:`);
  const ledgerOps = coord._all(
    `SELECT detail_json FROM ledger_ops WHERE kind = 'attempt' AND ${ledgerPred.clause}
      ORDER BY op_key`, ...ledgerPred.params);
  const ledgerIds = [];
  for (const op of ledgerOps) {
    let oid = null;
    try { oid = JSON.parse(op.detail_json || "{}").occurrenceId ?? null; }
    catch { oid = null; }
    if (!oid) return refuse("grant_finalization_target_set_mismatch", { grantId });
    ledgerIds.push(oid);
  }
  if (ledgerIds.length === 0 || new Set(ledgerIds).size !== ledgerIds.length)
    return refuse("grant_finalization_target_set_mismatch", { grantId });
  const ledgerSet = new Set(ledgerIds);
  // Target order = plan order (the census order).
  const targetsInPlanOrder = eligibleEntries.filter(e => ledgerSet.has(e.occurrence_id));
  if (targetsInPlanOrder.length !== ledgerIds.length)
    return refuse("grant_finalization_target_set_mismatch", { grantId });
  const targetIds = targetsInPlanOrder.map(e => e.occurrence_id);

  // §4.3.6 — the outbox row: present, acknowledged (sent_at set),
  // naming exactly the same set.
  const outbox = coord._oneOrNull(`SELECT * FROM outbox WHERE id = ?`, grantId);
  if (!outbox)
    return refuse("grant_finalization_outbox_missing", { grantId });
  if (outbox.sent_at === null || outbox.sent_at === undefined)
    return refuse("grant_finalization_outbox_unacked", { grantId });
  let outboxIds = null;
  try {
    const payload = JSON.parse(outbox.payload_json || "{}");
    if (payload && Array.isArray(payload.occurrences)) outboxIds = payload.occurrences;
  } catch { /* unparseable payload reads as no set */ }
  if (!outboxIds || outboxIds.length !== ledgerIds.length
      || !outboxIds.every(id => ledgerSet.has(id)))
    return refuse("grant_finalization_outbox_target_mismatch", { grantId });

  // §4.3.7 + §4.3.8 — target states and the job partition.
  const jobOccurrences = coord._all(
    `SELECT * FROM occurrences WHERE job_id = ?`, effJobId);
  const occById = new Map(jobOccurrences.map(o => [o.occurrence_id, o]));
  if (jobOccurrences.length !== eligibleEntries.length
      || !eligibleIds.every(id => occById.has(id)))
    return refuse("grant_finalization_partition_mismatch", { grantId, jobId: effJobId });
  for (const id of targetIds) {
    if (occById.get(id).state !== "ready")
      return refuse("grant_finalization_target_not_ready",
        { grantId, occurrenceId: id, state: occById.get(id).state });
  }
  const pendingIds = eligibleIds.filter(id => !ledgerSet.has(id));
  for (const id of pendingIds) {
    if (occById.get(id).state !== "pending")
      return refuse("grant_finalization_partition_mismatch",
        { grantId, occurrenceId: id, state: occById.get(id).state });
  }
  // This finalizer is scoped to the stalled-cohort shape: a lost
  // report with a live remainder. A grant covering the whole job
  // (no pending remainder) is a different case — its completion
  // derivation would move the job — and refuses here.
  if (pendingIds.length === 0)
    return refuse("grant_finalization_partition_mismatch",
      { grantId, reason_detail: "no_pending_remainder" });

  // §4.3.9 + §4.3.10 — executions: exactly one per target, all
  // committed; none for any pending occurrence under this plan/job.
  const jobExecutions = store.executionsForJob
    ? store.executionsForJob(effJobId)
    : coord._all(`SELECT * FROM d6_execution_records WHERE job_id = ?`, effJobId);
  const execByOcc = new Map();
  for (const ex of jobExecutions) {
    if (ex.plan_id !== effPlanId) continue;
    if (execByOcc.has(ex.occurrence_id))
      return refuse("grant_finalization_execution_mismatch",
        { grantId, occurrenceId: ex.occurrence_id });
    execByOcc.set(ex.occurrence_id, ex);
  }
  for (const id of pendingIds) {
    if (execByOcc.has(id))
      return refuse("grant_finalization_pending_execution_present",
        { grantId, occurrenceId: id });
  }
  if (execByOcc.size !== targetIds.length)
    return refuse("grant_finalization_execution_mismatch", { grantId });
  for (const id of targetIds) {
    const ex = execByOcc.get(id);
    if (!ex || ex.grant_id !== grantId || ex.state !== "committed" || !ex.cache_key)
      return refuse("grant_finalization_execution_mismatch",
        { grantId, occurrenceId: id });
  }

  // §4.3.15/16 — the claim: exactly one row (grant_id is its PK),
  // state 'claimed'. A 'completed' claim beside an 'issued' grant
  // is the named inconsistency and stops here like any other
  // non-claimed state.
  if (!claim)
    return refuse("grant_finalization_claim_missing", { grantId });
  if (claim.state !== "claimed")
    return refuse("grant_finalization_claim_not_claimed",
      { grantId, state: claim.state });

  // Quota arming is a precondition of every dispatch/reservation
  // read below (an unarmed store has no ledgers to prove against).
  if (!quotaArmed(coord))
    return refuse("grant_finalization_quota_unarmed", { grantId });

  // §4.3.11–13 + §4.3.17–19 — attempts, dispatches, reservations.
  const targets = [];
  let attemptsTotal = 0, dispatchTotal = 0;
  let residualTotal = 0, slotsTotalAll = 0, slotsConsumedAll = 0;
  let reservationDay = null;
  for (const entry of targetsInPlanOrder) {
    const id = entry.occurrence_id;
    const ex = execByOcc.get(id);
    const attemptRows = store.attemptsForExecution
      ? store.attemptsForExecution(ex.execution_id)
      : coord._all(`SELECT * FROM d6_attempt_log WHERE execution_id = ?
                     ORDER BY seq`, ex.execution_id);
    let success = 0, policyBlock = 0;
    for (const a of attemptRows) {
      if (a.phase !== "confirmed"
          || !["success", "policy_block", "failed_known"].includes(a.outcome))
        return refuse("grant_finalization_attempt_mismatch",
          { grantId, occurrenceId: id, attemptId: a.attempt_id });
      if (a.outcome === "success") success++;
      else if (a.outcome === "policy_block") policyBlock++;
    }
    const dispatchRows = coord._all(
      `SELECT * FROM d6_provider_dispatches WHERE grant_id = ? AND occurrence_id = ?
        ORDER BY attempt_id`, grantId, id);
    if (dispatchRows.length !== attemptRows.length
        || !dispatchRows.every(d => attemptRows.some(a => a.attempt_id === d.attempt_id)))
      return refuse("grant_finalization_dispatch_mismatch",
        { grantId, occurrenceId: id });
    const resRows = reservationsAll.filter(r => r.occurrence_id === id);
    if (resRows.length !== 1)
      return refuse("grant_finalization_reservation_mismatch",
        { grantId, occurrenceId: id });
    const res = resRows[0];
    if (res.state !== "open" || res.plan_id !== effPlanId || res.job_id !== effJobId)
      return refuse("grant_finalization_reservation_mismatch",
        { grantId, occurrenceId: id, reservationId: res.reservation_id });
    if (reservationDay === null) reservationDay = res.day_key;
    if (res.day_key !== reservationDay)
      return refuse("grant_finalization_reservation_mismatch",
        { grantId, occurrenceId: id, reason_detail: "day_mismatch" });
    if (!dispatchRows.every(d => d.dispatch_day_key === res.day_key))
      return refuse("grant_finalization_dispatch_mismatch",
        { grantId, occurrenceId: id, reason_detail: "day_mismatch" });
    // §4.3.18: stored consumption equals BOTH the attempt count
    // and the derived dispatch count for (grant, occurrence, day).
    if (res.slots_consumed !== attemptRows.length
        || res.slots_consumed !== dispatchRows.length)
      return refuse("grant_finalization_reservation_mismatch",
        { grantId, occurrenceId: id, reservationId: res.reservation_id,
          reason_detail: "slots_consumed_mismatch" });
    attemptsTotal += attemptRows.length;
    dispatchTotal += dispatchRows.length;
    slotsTotalAll += res.slots_total;
    slotsConsumedAll += res.slots_consumed;
    residualTotal += res.slots_total - res.slots_consumed;
    targets.push({
      occurrenceId: id,
      position: entry.position,
      occurrenceState: occById.get(id).state,
      cacheKey: ex.cache_key,
      executionId: ex.execution_id,
      executionState: ex.state,
      attempts: { total: attemptRows.length, success, policyBlock },
      reservation: {
        reservationId: res.reservation_id, dayKey: res.day_key,
        slotsTotal: res.slots_total, slotsConsumed: res.slots_consumed,
        state: res.state, closeReason: res.close_reason ?? null,
      },
    });
  }
  if (reservationsAll.length !== targetIds.length)
    return refuse("grant_finalization_reservation_mismatch", { grantId });
  if (!targets.every(t => t.reservation.slotsTotal === targets[0].reservation.slotsTotal))
    return refuse("grant_finalization_reservation_mismatch",
      { grantId, reason_detail: "slots_total_not_uniform" });

  // §4.3.20 — derived day totals for the reservation day.
  const dayTotals = derivedDayTotals(coord, reservationDay);

  // §4.3.14 + §4.3.21 — phase proof: no unknown billing anywhere
  // in the phase, the phase is not halted on unknown billing,
  // and no spend intent was ever acquired for a pending
  // occurrence under this job.
  const phaseView = phaseAccountingView(coord, plan.phase);
  if (phaseView.unknownOpen !== 0)
    return refuse("grant_finalization_unknown_open",
      { grantId, unknownOpen: phaseView.unknownOpen });
  const phaseHalt = coord._oneOrNull(
    `SELECT halted_unknown_billing FROM d6_phase_state WHERE phase = ?`, plan.phase);
  if (phaseHalt && phaseHalt.halted_unknown_billing)
    return refuse("grant_finalization_phase_halted", { grantId, phase: plan.phase });
  const pendingIntents = coord._all(
    `SELECT job_id FROM spend_intents WHERE job_id = ? AND occurrence_id IN
       (${pendingIds.map(() => "?").join(",")})`, effJobId, ...pendingIds);
  if (pendingIntents.length > 0)
    return refuse("grant_finalization_pending_spend_intent", { grantId });

  // §4.3.22 — sync watermarks.
  const wmRows = coord._all(
    `SELECT family, tip FROM sync_family_state WHERE family IN ('bindings', 'content')`);
  const watermarks = { bindings: null, content: null };
  for (const r of wmRows) watermarks[r.family] = r.tip;

  // §4.3.23 — each target's binding matches its committed
  // execution's cache key (read-only consistency; never
  // rebinds). The match is on cache_key alone: D6 commits bind
  // under the payload fingerprint as revision key (the
  // d6-integration identity rule), NOT under the job row's
  // request revision_key, so keying this lookup by the
  // occurrence's revision_key would refuse every genuine commit.
  for (const t of targets) {
    const binding = coord._oneOrNull(
      `SELECT * FROM bindings WHERE occurrence_id = ? AND cache_key = ?`,
      t.occurrenceId, t.cacheKey);
    if (!binding || occById.get(t.occurrenceId).cache_key !== t.cacheKey)
      return refuse("grant_finalization_binding_mismatch",
        { grantId, occurrenceId: t.occurrenceId });
    t.bindingCacheKey = t.cacheKey;
  }

  const view = {
    grantId, planId: effPlanId, jobId: effJobId,
    bookId: job.book_id, chapterIndex: job.chapter_index,
    lane: job.lane, phase: plan.phase,
    grant: { grantId, jobId: effJobId, revision: grant.revision, state: grant.state },
    job: { jobId: effJobId, state: job.state, revision: job.revision, kind: job.kind },
    plan: {
      planId: effPlanId, state: plan.state, scope: plan.scope,
      eligibleDigest: plan.eligible_digest ?? null, totals,
    },
    claim: { state: claim.state, consumerId: claim.consumer_id ?? null },
    outbox: { present: true, acked: true, targetIds: [...outboxIds].sort() },
    targets,
    pendingIds,
    partition: { ready: targetIds.length, pending: pendingIds.length },
    attemptsTotal,
    dispatchTotal,
    reservations: {
      count: reservationsAll.length, dayKey: reservationDay,
      slotsTotal: slotsTotalAll, slotsConsumed: slotsConsumedAll,
      residual: residualTotal,
    },
    dayTotals,
    phaseAccounting: phaseView,
    watermarks,
    parkRelease,
    exemptionForFinalOccurrence: false,
    finalOccurrenceId,
  };
  return { classification: "finalizable", view, digest: grantFinalizationDigest(view) };
}

// ------------------------------------------------------------------
// GET /v2/d6-grant-finalization-preview — read-only. Derives the
// full precondition state and its digest; writes NOTHING (it does
// not even ensure the audit schema — an absent audit table reads
// as "no audit row").
export function previewGrantFinalization(coord, store, { grantId, planId = null, jobId = null } = {}) {
  if (!isNonblankString(grantId))
    return rejected("grant_finalization_grant_required");
  const d = deriveGrantFinalizationState(coord, store, { grantId, planId, jobId });
  if (d.classification === "refused") return rejected(d.reason, { grantId });
  return {
    outcome: "preview",
    classification: d.classification,
    grantId,
    ...(d.digest ? { preconditionDigest: d.digest } : {}),
    state: d.view,
  };
}

// ------------------------------------------------------------------
// POST /v2/d6-finalize-grant — the action. Closed body (the entry
// enforces the allowlist): { grantId, planId, jobId,
// authorizationRef, expectedPreconditionDigest }. The digest is
// ONLY a concurrency check — every fact is re-derived inside the
// transaction; a state that moved since the preview refuses with
// grant_finalization_digest_mismatch and zero writes.
export function finalizeGrant(coord, store, {
  grantId, planId = null, jobId = null, authorizationRef,
  expectedPreconditionDigest,
} = {}) {
  if (!isNonblankString(grantId))
    return rejected("grant_finalization_grant_required");
  if (!isNonblankString(authorizationRef))
    return rejected("grant_finalization_authorization_ref_required");
  if (!isNonblankString(expectedPreconditionDigest))
    return rejected("grant_finalization_digest_required");
  ensureGrantFinalizationSchema(coord.sql);
  let result = null;
  try {
    coord._tx(() => {
      const d = deriveGrantFinalizationState(coord, store, { grantId, planId, jobId });
      if (d.classification === "already_finalized") {
        result = { outcome: "already_finalized", grantId, state: d.view };
        return;
      }
      if (d.classification === "already_reported_not_finalizer") {
        result = { outcome: "already_reported_not_finalizer", grantId, state: d.view };
        return;
      }
      if (d.classification === "refused") {
        result = rejected(d.reason, { grantId });
        return;
      }
      if (d.digest !== expectedPreconditionDigest) {
        result = rejected("grant_finalization_digest_mismatch", { grantId });
        return;
      }
      const view = d.view;
      const beforeTotals = {
        dayKey: view.dayTotals.dayKey,
        dispatched: view.dayTotals.dispatched,
        reserved: view.dayTotals.reserved,
        consumed: view.dayTotals.consumed,
        attemptsTotal: view.attemptsTotal,
        dispatchTotal: view.dispatchTotal,
        phaseSettledMicro: view.phaseAccounting.settledMicro,
      };
      // Write 1 — the audit row. Its grant_id PRIMARY KEY makes a
      // duplicate write impossible; a conflict throws and rolls
      // the whole finalization back.
      coord.sql.exec(
        `INSERT INTO d6_grant_finalizations
           (grant_id, plan_id, job_id, book_id, chapter_index,
            authorization_ref, precondition_digest, before_totals_json,
            outcome, finalized_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'applied', ?)`,
        grantId, view.planId, view.jobId, view.bookId, view.chapterIndex,
        authorizationRef, d.digest, JSON.stringify(beforeTotals), coord._now());
      // Fail-safe re-assertion (proposal §4.4 note, branch (b)):
      // the generic closure defers still-'granted' targets; the
      // derivation proved there are none, and if that proof is
      // somehow stale the finalizer aborts rather than deferring.
      const stillGranted = coord._one(
        `SELECT COUNT(*) AS n FROM occurrences
          WHERE job_id = ? AND occurrence_id IN (${view.targets.map(() => "?").join(",")})
            AND state = 'granted'`, view.jobId,
        ...view.targets.map(t => t.occurrenceId)).n;
      if (stillGranted !== 0)
        throw new FinalizeAbort("grant_finalization_target_not_ready");
      // Write 2 — the grant closes as reported, with the labeled
      // operator-finalization record (never an executor report).
      const reportJson = JSON.stringify({
        grantId,
        results: [],
        detail: {
          finalization: "operator_grant_finalization",
          authorizationRef,
          preconditionDigest: d.digest,
        },
      });
      coord.sql.exec(
        `UPDATE grants SET state = 'reported', report_json = ? WHERE grant_id = ?`,
        reportJson, grantId);
      // Write 3 — the claim completes (handleReport's own helper;
      // verified by read-back: exactly the 'claimed' row moved).
      coord._completeClaim(grantId);
      const claimAfter = coord._oneOrNull(
        `SELECT * FROM claims WHERE grant_id = ?`, grantId);
      if (!claimAfter || claimAfter.state !== "completed")
        throw new FinalizeAbort("grant_finalization_claim_not_claimed");
      // Write 4 — the reservations settle, STRICTER than
      // handleReport: the sweep's result must be exactly the
      // expected reservation ids in `closed`, with an empty
      // blocked list; anything else aborts the transaction.
      const settle = settleReservationsForGrant(coord, grantId);
      const expectedIds = view.targets.map(t => t.reservation.reservationId).sort();
      const closedIds = [...(settle.closed || [])].sort();
      if (!settle.armed || (settle.blocked || []).length > 0
          || closedIds.length !== expectedIds.length
          || !closedIds.every((id, i) => id === expectedIds[i]))
        throw new FinalizeAbort("grant_finalization_settlement_blocked");
      // Write 5 — job completion derivation (a no-op while the
      // remainder is pending; verified, not assumed).
      const jobRevisionBefore = view.job.revision;
      coord._deriveJobCompletion(view.jobId, "operator_finalization");
      const jobAfter = coord._oneOrNull(
        `SELECT * FROM jobs WHERE job_id = ?`, view.jobId);
      if (!jobAfter || jobAfter.state !== "generating"
          || jobAfter.revision !== jobRevisionBefore)
        throw new FinalizeAbort("grant_finalization_job_state_mismatch");
      // Post-write verification, still inside the transaction:
      // the state must now classify as exactly the finalized
      // shape, with phase money and attempt/dispatch counts
      // untouched. Any divergence aborts (rolls back) — the
      // finalizer never leaves a partial finalization behind.
      const after = deriveGrantFinalizationState(coord, store,
        { grantId, planId, jobId });
      if (after.classification !== "already_finalized")
        throw new FinalizeAbort("grant_finalization_verification_failed");
      const phaseAfter = phaseAccountingView(coord, view.phase);
      if (phaseAfter.settledMicro !== view.phaseAccounting.settledMicro
          || phaseAfter.unknownOpen !== 0)
        throw new FinalizeAbort("grant_finalization_verification_failed");
      const auditAfter = getFinalizationAudit(coord, grantId);
      result = {
        outcome: "applied", alreadyFinalized: false, grantId,
        audit: grantFinalizationAuditView(auditAfter),
        before: { digest: d.digest, dayTotals: view.dayTotals,
                  reservations: view.reservations,
                  phaseAccounting: view.phaseAccounting },
        after: after.view,
      };
    });
  } catch (e) {
    if (e instanceof FinalizeAbort) return rejected(e.reason, { grantId });
    throw e;
  }
  return result;
}
