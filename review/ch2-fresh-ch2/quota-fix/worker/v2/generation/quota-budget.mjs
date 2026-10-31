// D6 QUOTA GUARD — the provider-attempt budget (QUOTA-PROPOSAL.md
// as amended by QUOTA-ADDENDUM.md; Rowan DESIGN PASS, roundtable
// issue #15 comment 6544950778; Julie's repo-only build approval,
// comment 6545090525). This module implements the addendum's
// two-ledger design:
//
//   (a) d6_provider_dispatches — one row per AUTHORIZED dispatch,
//       written inside the markDispatching transaction, atomically
//       with the attempt's phase transition. A row is proof that a
//       dispatch was authorized and counted; per Rowan's
//       acceptance invariant it is NOT proof the provider call
//       arrived — a crash after the transaction commits but before
//       the fetch still counts, conservatively, forever. The
//       unknown-charge distinction is untouched: this ledger counts
//       requests, never billing knowledge.
//   (b) d6_grant_reservations — one row per (grant, occurrence,
//       PT day) reservation created at grant time, identity
//       `qres:${grantId}:${occurrenceId}:${day_key}`, slots_total =
//       SEGMENT_ATTEMPT_BUDGET − segmentAttemptsUsed at grant time
//       (the worst-case ×12 of proposal §3.2.2, kept; the §3.4 ×6
//       refinement is NOT adopted). slots_consumed moves only
//       inside the markDispatching transaction.
//
// Totals are DERIVED from these rows (§1.4) — there is no summary
// counter to drift; the one stored counter, slots_consumed, is
// verified against the derived dispatch count at every
// consumption and any mismatch refuses
// (provider_attempt_budget_counter_drift), the d6PhaseBudgetCheck
// shape-fence discipline.
//
// ARMING: enforcement is active exactly when the durable
// bootstrap record exists (meta key d6_quota_bootstrapped_at,
// written only by bootstrapQuota below — the §3 migration). A
// store that was never bootstrapped behaves byte-for-byte as the
// floor build 6a73d962…: no reservations are created, and
// markDispatching takes its legacy path. This is deliberate: the
// floor build does NOT enforce this quota (addendum §3.3), and
// the guarded build's enforcement begins at its gated bootstrap,
// never silently at deploy.
//
// The daily limit is the PINNED CONSTANT
// PROVIDER_ATTEMPT_DAILY_LIMIT (gen-constants.mjs) — an
// APP-SELECTED Reader policy cap, NOT an independently verified
// Google limit (addendum §4). This counter sees only dispatches
// made through the D6 executor; any other use of the same Google
// project is invisible to it by construction. The provider 429
// remains the external final backstop.

import { SEGMENT_ATTEMPT_BUDGET, PROVIDER_ATTEMPT_DAILY_LIMIT } from "./gen-constants.mjs";

export { PROVIDER_ATTEMPT_DAILY_LIMIT };

// PT day key — the same convention as coordinator.mjs's dayKeyPT
// (a Pacific-Time day; an app convention, not a claim about the
// provider's accounting, addendum §4). Kept local so this module
// does not import the coordinator (the coordinator imports this
// module); the quota suites cross-check the two implementations
// over boundary instants.
export function ptDayKey(nowMs) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(nowMs));
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

const BOOTSTRAP_META_KEY = "d6_quota_bootstrapped_at";

// The refusal raised by the dispatch transaction. A named,
// classed error so the executor's one call site can distinguish a
// budget refusal (quota-park shape; the attempt provably never
// dispatched) from a genuine fault (which must stay loud) and
// from an unknown billing outcome (which this never is: no
// provider contact happened).
export class QuotaBudgetRefusal extends Error {
  constructor(reason) {
    super(reason);
    this.name = "QuotaBudgetRefusal";
    this.quotaBudgetRefusal = true;
    this.reason = reason;
  }
}

export const QUOTA_REFUSALS = Object.freeze({
  BUDGET: "provider_attempt_budget",
  DAY_ROLLOVER: "provider_attempt_budget_day_rollover",
  BOOTSTRAP_INCOMPLETE: "provider_attempt_budget_bootstrap_incomplete",
  UNRESERVED: "provider_attempt_budget_unreserved",
  COUNTER_DRIFT: "provider_attempt_budget_counter_drift",
  SCHEMA_INCONSISTENT: "provider_attempt_budget_schema_inconsistent",
  // Correction 3 (Rowan SOURCE HOLD 6545387295): a day whose
  // derived consumed total already EXCEEDS the cap — reachable
  // only when a truthful operator disposition attributes
  // historical dispatches to a day that also carries large open
  // reservations — is under a named, auditable hold: no further
  // dispatch and no new grant may proceed on that day until the
  // excess is resolved by settlement. The historical count
  // itself is never erased or rewritten.
  DAY_OVER_LIMIT: "provider_attempt_budget_day_over_limit",
});

export const RESERVATION_CLOSE_REASONS = Object.freeze([
  "grant_settled",   // the grant's executions for the occurrence are terminal
  "quota_park",      // provider-quota park recorded; dispatch under the grant impossible while parked
  "halt_settled",    // unknown-billing halt settled by disposition/retirement
  "grant_voided",    // coordinator void: the dispatch provably never left
]);

// ------------------------------------------------------------------
// Schema — additive, DDL-only, idempotent, lazy (the gen-schema
// pattern): CREATE IF NOT EXISTS plus one guarded ALTER. The
// tables are deliberately NOT part of GEN_SCHEMA (the correction
// suites pin the floor bootstrap's table set; a store that never
// bootstraps the quota guard never grows these tables), and the
// ALTER is NOT part of it either — d6_attempt_log gains
// dispatched_day_key only when the quota bootstrap runs. Rows of
// existing tables are never touched by the DDL.
const QUOTA_SCHEMA = `
CREATE TABLE IF NOT EXISTS d6_provider_dispatches (
  attempt_id TEXT PRIMARY KEY,
  grant_id TEXT NOT NULL, occurrence_id TEXT NOT NULL,
  plan_id TEXT, execution_id TEXT NOT NULL,
  dispatch_day_key TEXT NOT NULL, dispatched_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS d6_grant_reservations (
  reservation_id TEXT PRIMARY KEY,
  grant_id TEXT NOT NULL, occurrence_id TEXT NOT NULL,
  plan_id TEXT, job_id TEXT NOT NULL,
  day_key TEXT NOT NULL,
  slots_total INTEGER NOT NULL, slots_consumed INTEGER NOT NULL DEFAULT 0,
  state TEXT NOT NULL, close_reason TEXT,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
`;

export function ensureQuotaSchema(sql) {
  sql.exec(QUOTA_SCHEMA);
  try {
    sql.exec(`ALTER TABLE d6_attempt_log ADD COLUMN dispatched_day_key TEXT`);
  } catch (e) {
    if (!/duplicate column/i.test(String((e && e.message) || e))) throw e;
  }
}

// Presence discipline (the §5.4 adjudication pattern): both
// tables present -> "present"; neither -> "absent"; exactly one
// -> loud inconsistency.
function quotaTablesPresence(coord) {
  const rows = coord._all(
    `SELECT name FROM sqlite_master WHERE type = 'table'
      AND name IN ('d6_provider_dispatches', 'd6_grant_reservations')`);
  const names = new Set(rows.map(r => r.name));
  const hasD = names.has("d6_provider_dispatches");
  const hasR = names.has("d6_grant_reservations");
  if (hasD && hasR) return "present";
  if (!hasD && !hasR) return "absent";
  throw new Error(
    "provider_attempt_budget_schema_inconsistent: exactly one quota table present");
}

// Armed = the bootstrap record exists. Read-only; never creates
// anything. An armed store whose tables are missing is corrupt
// and loud here (the marker is written only in the bootstrap
// transaction, after the DDL).
export function quotaArmed(coord) {
  const row = coord._oneOrNull(
    `SELECT value FROM meta WHERE key = ?`, BOOTSTRAP_META_KEY);
  if (!row) return false;
  if (quotaTablesPresence(coord) !== "present")
    throw new Error(
      "provider_attempt_budget_schema_inconsistent: bootstrap record exists but quota tables are missing");
  return true;
}

export function quotaBootstrapRecord(coord) {
  const row = coord._oneOrNull(
    `SELECT value FROM meta WHERE key = ?`, BOOTSTRAP_META_KEY);
  return row ? JSON.parse(row.value) : null;
}

// Attempts that count toward the segment budget for one
// (plan, occurrence): dispatching + confirmed — the identical
// semantics of genstore.segmentAttemptsUsed (duplicated here so
// this module never imports the store; the two must not drift,
// and the quota suites pin the agreement).
function segmentAttemptsUsed(coord, planId, occurrenceId) {
  return coord._one(
    `SELECT COUNT(*) AS n FROM d6_attempt_log
      WHERE plan_id = ? AND occurrence_id = ? AND phase IN ('dispatching', 'confirmed')`,
    planId, occurrenceId).n;
}

// ------------------------------------------------------------------
// §1.4 — the one reconciled total, derived from unique rows.
export function derivedDayTotals(coord, dayKey) {
  const dispatched = coord._one(
    `SELECT COUNT(*) AS n FROM d6_provider_dispatches WHERE dispatch_day_key = ?`,
    dayKey).n;
  const reservedRow = coord._one(
    `SELECT COALESCE(SUM(slots_total - slots_consumed), 0) AS s
       FROM d6_grant_reservations WHERE day_key = ? AND state = 'open'`, dayKey);
  const reserved = reservedRow.s;
  return { dayKey, dispatched, reserved, consumed: dispatched + reserved };
}

// Per-reservation derived consumption: dispatch-ledger rows
// attributed by (grant, occurrence, dispatch day) — the
// reservation identity's own coordinates.
function derivedSlotsConsumed(coord, reservation) {
  return coord._one(
    `SELECT COUNT(*) AS n FROM d6_provider_dispatches
      WHERE grant_id = ? AND occurrence_id = ? AND dispatch_day_key = ?`,
    reservation.grant_id, reservation.occurrence_id, reservation.day_key).n;
}

// Open reservations, optionally scoped. Diagnostics surfaces use
// these to enumerate every outstanding reservation by identity —
// an orphan is visible here, never silently dropped (T7).
export function openReservations(coord, { dayKey = null, grantId = null } = {}) {
  let q = `SELECT * FROM d6_grant_reservations WHERE state = 'open'`;
  const params = [];
  if (dayKey !== null) { q += ` AND day_key = ?`; params.push(dayKey); }
  if (grantId !== null) { q += ` AND grant_id = ?`; params.push(grantId); }
  q += ` ORDER BY created_at, reservation_id`;
  return coord._all(q, ...params);
}

export function reservationById(coord, reservationId) {
  return coord._oneOrNull(
    `SELECT * FROM d6_grant_reservations WHERE reservation_id = ?`, reservationId);
}

// ------------------------------------------------------------------
// §3.2 bootstrap exceptions: attempt rows whose dispatch day
// cannot be proven from the surviving evidence — phase
// dispatching/confirmed with dispatched_day_key still NULL.
// (Post-bootstrap, every genuine dispatch stamps the column
// atomically, so a NULL here is always pre-bootstrap history or a
// floor-build dispatch during a rollback window — exactly what
// reconciliation must surface, addendum §3.3.4.)
export function bootstrapExceptions(coord) {
  if (quotaTablesPresence(coord) === "absent") return [];
  const hasColumn = coord._all(
    `SELECT name FROM pragma_table_info('d6_attempt_log')
      WHERE name = 'dispatched_day_key'`).length > 0;
  if (!hasColumn) return [];
  const rows = coord._all(
    `SELECT * FROM d6_attempt_log
      WHERE phase IN ('dispatching', 'confirmed') AND dispatched_day_key IS NULL
      ORDER BY created_at, attempt_id`);
  return rows.map(r => ({
    attemptId: r.attempt_id, executionId: r.execution_id,
    planId: r.plan_id, occurrenceId: r.occurrence_id,
    phase: r.phase, outcome: r.outcome,
    createdAt: r.created_at, updatedAt: r.updated_at,
    intervalDays: [ptDayKey(r.created_at), ptDayKey(r.updated_at)],
  }));
}

// An exception blocks a day iff its evidence interval includes
// that day (§3.2 fail-closed consequence).
function exceptionBlocksDay(exception, dayKey) {
  const [lo, hi] = exception.intervalDays;
  return lo <= dayKey && dayKey <= hi;
}

export function currentDayBootstrapBlocked(coord, dayKey) {
  return bootstrapExceptions(coord).some(e => exceptionBlocksDay(e, dayKey));
}

// ------------------------------------------------------------------
// §3.2 — the migration. One transaction: DDL, exact backfill for
// the provable subset (writing BOTH the attempt-log column and
// the dispatch-ledger row, so the derived totals of §1.4 are
// complete from the first guarded instant), exceptions left NULL
// for disposition — never guessed — and the bootstrap record.
// Idempotent: re-running assigns nothing twice (only NULL-day
// rows are considered) and never rewrites the original record.
// Any failure throws and changes nothing (the store stays
// unarmed, i.e. floor behavior, under the operational holds).
export function bootstrapQuota(coord) {
  return coord._tx(() => {
    ensureQuotaSchema(coord.sql);
    const existing = quotaBootstrapRecord(coord);
    let assigned = 0;
    const rows = coord._all(
      `SELECT * FROM d6_attempt_log
        WHERE phase IN ('dispatching', 'confirmed') AND dispatched_day_key IS NULL
        ORDER BY created_at, attempt_id`);
    for (const r of rows) {
      let day = null;
      if (r.phase === "dispatching") {
        // While a row is in this phase, the only write since
        // creation is markDispatching itself: updated_at IS the
        // dispatch moment — exact (§3.2).
        day = ptDayKey(r.updated_at);
      } else if (ptDayKey(r.created_at) === ptDayKey(r.updated_at)) {
        // Dispatch lies in [created_at, updated_at], wholly
        // inside one PT day — exact (§3.1/§3.2, INFERRED basis,
        // used only in the intra-day case).
        day = ptDayKey(r.created_at);
      }
      if (day === null) continue; // straddler: exception, never guessed
      const exec = coord._oneOrNull(
        `SELECT * FROM d6_execution_records WHERE execution_id = ?`, r.execution_id);
      if (!exec || !exec.grant_id) continue; // unattributable: exception
      coord.sql.exec(
        `UPDATE d6_attempt_log SET dispatched_day_key = ? WHERE attempt_id = ?`,
        day, r.attempt_id);
      coord.sql.exec(
        `INSERT INTO d6_provider_dispatches
           (attempt_id, grant_id, occurrence_id, plan_id, execution_id,
            dispatch_day_key, dispatched_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        r.attempt_id, exec.grant_id, r.occurrence_id, r.plan_id ?? null,
        r.execution_id, day, r.updated_at);
      assigned++;
    }
    const exceptions = bootstrapExceptions(coord);
    if (!existing) {
      const record = {
        at: coord._now(), assignedCount: assigned,
        exceptionCount: exceptions.length,
        limit: PROVIDER_ATTEMPT_DAILY_LIMIT,
      };
      coord.sql.exec(
        `INSERT INTO meta (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        BOOTSTRAP_META_KEY, JSON.stringify(record));
      return { bootstrapped: true, alreadyArmed: false, assigned, exceptions };
    }
    return { bootstrapped: true, alreadyArmed: true, assigned, exceptions };
  });
}

// Operator disposition of ONE bootstrap exception (the auditable
// action §3.2 requires before a blocked day may open): the
// operator asserts the dispatch day from evidence outside this
// store; the assertion, its authorization reference, and its
// basis are recorded on the attempt's detail_json, the column is
// set, and the dispatch-ledger row is written — the row leaves
// the exception set exactly once. Whether any evidence can ever
// settle a given straddled row remains the addendum's OPEN
// question (§6 ii); this function records an assertion, it does
// not manufacture proof.
// A day key is valid only if it is a REAL calendar date in
// YYYY-MM-DD shape (correction 2, Rowan SOURCE HOLD 6545387295):
// shape alone would accept 2026-02-30.
function isRealDayKey(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function disposeBootstrapException(coord, attemptId,
    { dayKey, authorizationRef, note = null, source = null } = {}) {
  return coord._tx(() => {
    if (typeof authorizationRef !== "string" || authorizationRef.trim().length === 0)
      throw new Error("quota_disposition_authorization_required: a non-blank authorization reference is required");
    if (!isRealDayKey(dayKey))
      throw new Error(`quota_disposition_day_invalid: ${dayKey}`);
    const row = coord._oneOrNull(
      `SELECT * FROM d6_attempt_log WHERE attempt_id = ?`, attemptId);
    if (!row) throw new Error(`attempt_not_found: ${attemptId}`);
    if (!["dispatching", "confirmed"].includes(row.phase) ||
        row.dispatched_day_key !== null)
      throw new Error(`quota_disposition_not_an_exception: ${attemptId} (${row.phase}/${row.dispatched_day_key})`);
    // Correction 2 (Rowan SOURCE HOLD 6545387295): the assigned
    // day must lie INSIDE the row's evidenced interval — the PT
    // days of [created_at, updated_at], the only days the
    // surviving evidence permits. Anything outside is refused
    // and (the whole disposition runs in this transaction) the
    // refusal changes NOTHING: no exception resolved, no ledger
    // row, no hold lifted. No separate evidence-exception path
    // exists here: if the interval cannot settle the day, the
    // row stays an exception and its days stay fail-closed.
    const interval = [ptDayKey(row.created_at), ptDayKey(row.updated_at)];
    if (dayKey < interval[0] || dayKey > interval[1])
      throw new Error(
        `quota_disposition_day_outside_evidence_interval: ${dayKey} outside [${interval[0]}, ${interval[1]}] for ${attemptId}`);
    const exec = coord._oneOrNull(
      `SELECT * FROM d6_execution_records WHERE execution_id = ?`, row.execution_id);
    if (!exec || !exec.grant_id)
      throw new Error(`quota_disposition_unattributable: ${attemptId}`);
    const detail = row.detail_json ? JSON.parse(row.detail_json) : {};
    const disposition = {
      dayKey, authorizationRef: authorizationRef.trim(),
      note: note ?? null, source: source ?? null, at: coord._now(),
      // The evidenced interval the assigned day was validated
      // against (correction 2): the authorization, source, and
      // basis of the day decision are part of the record.
      evidenceInterval: interval,
    };
    coord.sql.exec(
      `INSERT INTO d6_provider_dispatches
         (attempt_id, grant_id, occurrence_id, plan_id, execution_id,
          dispatch_day_key, dispatched_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      attemptId, exec.grant_id, row.occurrence_id, row.plan_id ?? null,
      row.execution_id, dayKey, row.updated_at);
    // If a reservation exists for exactly this
    // (grant, occurrence, day), the attributed dispatch consumed
    // one of its slots in reality — a floor-build dispatch during
    // a rollback window is precisely this case (§3.3.3/§3.3.4).
    // Realign its stored counter to the derived count INSIDE
    // this auditable transaction and record the adjustment on
    // the disposition itself: a recorded reconciliation under an
    // operator authorization, never a silent reset. Without it
    // the reservation would refuse counter_drift forever and
    // reconciliation could never go green, which §3.3.4 forbids
    // as an end state.
    const resId = `qres:${exec.grant_id}:${row.occurrence_id}:${dayKey}`;
    const res = coord._oneOrNull(
      `SELECT * FROM d6_grant_reservations WHERE reservation_id = ?`, resId);
    if (res) {
      const derived = derivedSlotsConsumed(coord, res);
      if (derived !== res.slots_consumed) {
        disposition.slotsReconciled = {
          reservationId: resId, from: res.slots_consumed, to: derived };
        coord.sql.exec(
          `UPDATE d6_grant_reservations SET slots_consumed = ?, updated_at = ?
            WHERE reservation_id = ?`,
          derived, coord._now(), resId);
      }
    }
    // Correction 3 (Rowan SOURCE HOLD 6545387295): the attributed
    // dispatch may push its day's derived total (dispatched +
    // open reserved) over the cap. The disposition still records
    // truthful history — but the over-limit state is NAMED on the
    // disposition record itself, and the dispatch/grant gates
    // (applyDispatchQuota / reserveForGrant / boundGrantTargets)
    // fail closed on it before any further dispatch: the
    // historical count never silently becomes permission.
    const totalsAfter = derivedDayTotals(coord, dayKey);
    if (totalsAfter.consumed > PROVIDER_ATTEMPT_DAILY_LIMIT)
      disposition.dayOverLimit = {
        dayKey, consumed: totalsAfter.consumed, limit: PROVIDER_ATTEMPT_DAILY_LIMIT };
    detail.quotaBootstrapDisposition = disposition;
    coord.sql.exec(
      `UPDATE d6_attempt_log SET dispatched_day_key = ?, detail_json = ?
        WHERE attempt_id = ?`,
      dayKey, JSON.stringify(detail), attemptId);
    return { attemptId, dayKey, slotsReconciled: disposition.slotsReconciled ?? null,
             dayOverLimit: disposition.dayOverLimit ?? null };
  });
}

// ------------------------------------------------------------------
// §3.3.4 — reconciliation (the re-arm proof after any rollback
// window, and the standing drift audit): derived totals must
// reproduce from unique rows; every stored slots_consumed must
// equal its derived count; every stamped attempt must have
// exactly one dispatch row and vice versa; unassigned dispatched
// history is reported as exceptions, never absorbed.
export function reconcileQuota(coord) {
  if (!quotaArmed(coord)) return { armed: false, ok: false, reason: "not_armed" };
  const drift = [];
  for (const res of coord._all(`SELECT * FROM d6_grant_reservations`)) {
    const derived = derivedSlotsConsumed(coord, res);
    if (derived !== res.slots_consumed)
      drift.push({ kind: "slots_consumed_mismatch", reservationId: res.reservation_id,
                   stored: res.slots_consumed, derived });
    if (res.slots_consumed > res.slots_total)
      drift.push({ kind: "slots_over_consumed", reservationId: res.reservation_id,
                   stored: res.slots_consumed, total: res.slots_total });
  }
  const orphans = coord._all(
    `SELECT d.attempt_id FROM d6_provider_dispatches d
      LEFT JOIN d6_attempt_log a ON a.attempt_id = d.attempt_id
      WHERE a.attempt_id IS NULL OR a.dispatched_day_key IS NULL
         OR a.dispatched_day_key <> d.dispatch_day_key`);
  for (const o of orphans)
    drift.push({ kind: "dispatch_row_unmatched", attemptId: o.attempt_id });
  const unstamped = coord._all(
    `SELECT a.attempt_id FROM d6_attempt_log a
      LEFT JOIN d6_provider_dispatches d ON d.attempt_id = a.attempt_id
      WHERE a.dispatched_day_key IS NOT NULL AND d.attempt_id IS NULL`);
  for (const o of unstamped)
    drift.push({ kind: "stamped_attempt_without_dispatch_row", attemptId: o.attempt_id });
  const exceptions = bootstrapExceptions(coord);
  const today = ptDayKey(coord._now());
  const currentDayBlocked = exceptions.some(e => exceptionBlocksDay(e, today));
  // Correction 3 (Rowan SOURCE HOLD 6545387295): every day with
  // ledger rows is totaled; a day whose derived consumed total
  // exceeds the pinned cap is drift of a named kind — the
  // historical count is REPORTED, never erased or absorbed.
  const dayKeys = new Set();
  for (const r of coord._all(`SELECT DISTINCT dispatch_day_key AS d FROM d6_provider_dispatches`))
    dayKeys.add(r.d);
  for (const r of coord._all(`SELECT DISTINCT day_key AS d FROM d6_grant_reservations`))
    dayKeys.add(r.d);
  const dayTotals = {};
  for (const d of [...dayKeys].sort()) {
    const t = derivedDayTotals(coord, d);
    dayTotals[d] = t;
    if (t.consumed > PROVIDER_ATTEMPT_DAILY_LIMIT)
      drift.push({ kind: "day_over_limit", dayKey: d,
                   consumed: t.consumed, limit: PROVIDER_ATTEMPT_DAILY_LIMIT });
  }
  return {
    armed: true,
    // ok means GENUINELY SAFE for the quota rearm gate: no
    // counter drift, no unaccounted dispatch (dispatch-row and
    // stamped-attempt mismatches above; unresolved exceptions),
    // no current-day bootstrap blockage, and no over-limit day.
    // The details are still reported separately in every case.
    ok: drift.length === 0 && !currentDayBlocked,
    drift, exceptions,
    currentDayBlocked,
    totals: derivedDayTotals(coord, today),
    dayTotals,
  };
}

// ------------------------------------------------------------------
// §1.3 — grant-time reservation. Called from the coordinator's
// _issueGrant transaction (D6 flag on) after the grant-exists
// check, before any grant write: a refusal therefore leaves no
// partial rows of any kind. Unarmed stores return immediately —
// floor behavior, byte for byte.
export function reserveForGrant(coord, { grantId, jobId, planId = null, targets, dayKey }) {
  if (!quotaArmed(coord)) return { ok: true, armed: false, reservations: [] };
  if (currentDayBootstrapBlocked(coord, dayKey))
    return { ok: false, reason: QUOTA_REFUSALS.BOOTSTRAP_INCOMPLETE };
  const t = coord._now();
  const made = [];
  let newSlots = 0;
  for (const o of targets) {
    const slots = SEGMENT_ATTEMPT_BUDGET - segmentAttemptsUsed(coord, planId, o.occurrence_id);
    if (slots < 0)
      return { ok: false, reason: QUOTA_REFUSALS.BUDGET };
    newSlots += slots;
    made.push({ occurrenceId: o.occurrence_id, slotsTotal: slots });
  }
  const totals = derivedDayTotals(coord, dayKey);
  // Correction 3: a day already over the cap (only reachable via
  // a truthful over-limit disposition) refuses under the named
  // hold, before the ordinary sum check.
  if (totals.consumed > PROVIDER_ATTEMPT_DAILY_LIMIT)
    return { ok: false, reason: QUOTA_REFUSALS.DAY_OVER_LIMIT };
  if (totals.consumed + newSlots > PROVIDER_ATTEMPT_DAILY_LIMIT)
    return { ok: false, reason: QUOTA_REFUSALS.BUDGET };
  const reservations = [];
  for (const m of made) {
    const reservationId = `qres:${grantId}:${m.occurrenceId}:${dayKey}`;
    const existing = reservationById(coord, reservationId);
    if (existing) { // §1.2: re-insert under an existing identity is a no-op read
      reservations.push(existing);
      continue;
    }
    coord.sql.exec(
      `INSERT INTO d6_grant_reservations
         (reservation_id, grant_id, occurrence_id, plan_id, job_id, day_key,
          slots_total, slots_consumed, state, close_reason, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'open', NULL, ?, ?)`,
      reservationId, grantId, m.occurrenceId, planId, jobId, dayKey, m.slotsTotal, t, t);
    reservations.push(reservationById(coord, reservationId));
  }
  return { ok: true, armed: true, reservations };
}

// ------------------------------------------------------------------
// Correction 1 (Rowan SOURCE HOLD 6545387295) — cohort bounding
// for full (non-probe) grants. The grant gate used to hand
// reserveForGrant the job's ENTIRE pending set: at 12 slots per
// fresh occurrence, any job with more than 8 eligible fresh
// occurrences (e.g. an 18-segment chapter: 216 slots) was refused
// provider_attempt_budget FOREVER — daily rollover could never
// fix it, because the next day the same full set asked for 216
// again. The coordinator's fixed contracts DO support partial
// grants safely, so the bound is applied where the target set is
// chosen: a grant covers the longest PREFIX of the job's pending
// occurrences (in the pending query's own order) whose worst-case
// slot total fits the day's remaining derived headroom. The
// remainder stays 'pending' on the SAME job — the job's complete
// ordered occurrence set, its plan link, and its intent identity
// are untouched — and the existing drive machinery (service
// driveOnce's grant step: pending occurrences + no live grant ->
// requestGrant) issues the next cohort's grant once the current
// one settles. Durable continuation needs no new state.
//
// Invariants, by construction:
//   * prefix selection over the same ordered pending set the
//     full grant used -> no omitted and no duplicated occurrence
//     across the cohort sequence; no reordering;
//   * a prefix never skips an unfundable occurrence to reach a
//     later one (no silent skip — on quota rollover the remaining
//     set is re-evaluated whole, in order, against the new day);
//   * every granted occurrence is reserved at its full remaining
//     worst case (12 - attempts used), exactly as reserveForGrant
//     re-verifies in the same transaction (no under-reservation);
//   * an empty cohort refuses with the SAME reasons the full-set
//     path produced (bootstrap-incomplete / day-over-limit /
//     provider_attempt_budget), so the plan parks on quota and
//     continuation waits for headroom — never a zero-target grant,
//     never a spin: a grant exists only when >= 1 occurrence is
//     funded, and grant issuance is driven by settlement, not by
//     refusal.
// Unarmed stores return the pending set unchanged: floor
// behavior, byte for byte.
export function boundGrantTargets(coord, { planId = null, pending, dayKey }) {
  if (!quotaArmed(coord)) return { bounded: false, targets: pending };
  if (currentDayBootstrapBlocked(coord, dayKey))
    return { bounded: true, targets: [], reason: QUOTA_REFUSALS.BOOTSTRAP_INCOMPLETE };
  const totals = derivedDayTotals(coord, dayKey);
  if (totals.consumed > PROVIDER_ATTEMPT_DAILY_LIMIT)
    return { bounded: true, targets: [], reason: QUOTA_REFUSALS.DAY_OVER_LIMIT };
  let used = totals.consumed;
  const cohort = [];
  for (const o of pending) {
    const slots = SEGMENT_ATTEMPT_BUDGET - segmentAttemptsUsed(coord, planId, o.occurrence_id);
    if (slots <= 0) break; // this occurrence's budget is spent: stop the prefix, never skip it
    if (used + slots > PROVIDER_ATTEMPT_DAILY_LIMIT) break;
    cohort.push(o);
    used += slots;
  }
  return { bounded: true, targets: cohort,
           ...(cohort.length === 0 ? { reason: QUOTA_REFUSALS.BUDGET } : {}) };
}

// ------------------------------------------------------------------
// §1.5 — the single release fence. A reservation closes ONLY
// through closeReservation, ONLY with a vocabulary reason, and
// ONLY when dispatch under it has become impossible or complete:
//   * an execution in 'granted' or 'attempted' can still reach a
//     provider call -> closure is BLOCKED for every reason;
//   * an 'unknown_billing' execution blocks every reason except
//     'halt_settled' (whose precondition — no open unknown attempt
//     for the plan — is checked here);
//   * 'synthesized'/'flushed'/'verified' executions have no
//     provider call left in them (commit path only) and never
//     block; terminal or absent executions never block.
// A second close is a no-op ({ alreadyClosed: true }), never a
// second credit. Blocked closes are REPORTED, not thrown: the
// settle sweeps below record them and the reservation stays open
// and visible.
const DISPATCH_CAPABLE_STATES = Object.freeze(["granted", "attempted"]);

export function closeReservation(coord, reservationId, reason) {
  if (!RESERVATION_CLOSE_REASONS.includes(reason))
    throw new Error(`reservation_close_reason_invalid: ${reason}`);
  const res = reservationById(coord, reservationId);
  if (!res) throw new Error(`reservation_not_found: ${reservationId}`);
  if (res.state === "closed") return { closed: false, alreadyClosed: true, reservation: res };
  const execs = coord._all(
    `SELECT * FROM d6_execution_records WHERE grant_id = ? AND occurrence_id = ?`,
    res.grant_id, res.occurrence_id);
  const capable = execs.filter(e => DISPATCH_CAPABLE_STATES.includes(e.state));
  if (capable.length > 0)
    return { closed: false, blocked: "execution_dispatch_capable",
             executionIds: capable.map(e => e.execution_id), reservation: res };
  const unknownExecs = execs.filter(e => e.state === "unknown_billing");
  if (unknownExecs.length > 0) {
    if (reason !== "halt_settled")
      return { closed: false, blocked: "execution_unknown_billing",
               executionIds: unknownExecs.map(e => e.execution_id), reservation: res };
    const openUnknown = coord._one(
      `SELECT COUNT(*) AS n FROM d6_attempt_log
        WHERE plan_id IS ? AND occurrence_id = ? AND phase = 'confirmed' AND outcome = 'unknown'`,
      res.plan_id, res.occurrence_id).n;
    if (openUnknown > 0)
      return { closed: false, blocked: "unknown_billing_open",
               executionIds: unknownExecs.map(e => e.execution_id), reservation: res };
  }
  coord.sql.exec(
    `UPDATE d6_grant_reservations SET state = 'closed', close_reason = ?,
       updated_at = ? WHERE reservation_id = ? AND state = 'open'`,
    reason, coord._now(), reservationId);
  return { closed: true, reservation: reservationById(coord, reservationId) };
}

function settleWhere(coord, where, param, reason) {
  if (!quotaArmed(coord)) return { armed: false, closed: [], blocked: [] };
  const rows = coord._all(
    `SELECT * FROM d6_grant_reservations WHERE state = 'open' AND ${where}`, param);
  const closed = [], blocked = [];
  for (const r of rows) {
    const out = closeReservation(coord, r.reservation_id, reason);
    if (out.closed) closed.push(r.reservation_id);
    else if (out.blocked) blocked.push({ reservationId: r.reservation_id, blocked: out.blocked });
  }
  return { armed: true, closed, blocked };
}

// Grant settlement sweep (report closure, §1.5 retries row).
export function settleReservationsForGrant(coord, grantId) {
  return settleWhere(coord, `grant_id = ?`, grantId, "grant_settled");
}
// Quota-park closure (§1.5): the parked grant's reservations
// close when the park is recorded; resume is a NEW grant.
export function closeReservationsForGrant(coord, grantId, reason) {
  return settleWhere(coord, `grant_id = ?`, grantId, reason);
}
// Coordinator void closure (§1.5/T7): dispatch provably never left.
export function closeReservationsForVoidedGrant(coord, grantId) {
  return settleWhere(coord, `grant_id = ?`, grantId, "grant_voided");
}
// Halt settlement (retirement of the halted plan, §1.5).
export function closeReservationsForPlan(coord, planId) {
  return settleWhere(coord, `plan_id = ?`, planId, "halt_settled");
}

// ------------------------------------------------------------------
// §2 + invariant 2 — the dispatch transaction body. Called from
// genstore.markDispatching INSIDE coord._tx, after the attempt's
// phase has been proven 'reserved' and before the phase UPDATE:
// every check runs first; on any refusal this throws
// QuotaBudgetRefusal and the surrounding transaction rolls back —
// the attempt stays 'reserved', no slot moves, no dispatch row
// exists, and the provider is never called. On success it has
// written exactly one dispatch-ledger row and incremented exactly
// one reservation's slots_consumed, and returns the dispatch day
// for the caller's attempt-row UPDATE.
export function applyDispatchQuota(coord, attemptRow, executionRow) {
  if (!quotaArmed(coord)) return { armed: false };
  if (!executionRow)
    throw new Error(`execution_not_found: ${attemptRow.execution_id}`);
  const grantId = executionRow.grant_id;
  const occurrenceId = attemptRow.occurrence_id;
  if (!grantId)
    throw new QuotaBudgetRefusal(QUOTA_REFUSALS.UNRESERVED);
  const nowMs = coord._now();
  const dispatchDay = ptDayKey(nowMs);
  if (currentDayBootstrapBlocked(coord, dispatchDay))
    throw new QuotaBudgetRefusal(QUOTA_REFUSALS.BOOTSTRAP_INCOMPLETE);
  // Correction 3 (Rowan SOURCE HOLD 6545387295): the day-wide
  // check applies on EVERY path — including binding to an
  // existing open reservation, which previously checked only
  // that reservation's own slots. A dispatch under an existing
  // reservation never raises the day's consumed total (one
  // reserved slot converts to one dispatched), but if a truthful
  // disposition has already pushed the day OVER the cap, no
  // further dispatch may proceed under pre-authorized
  // reservations: fail closed under the named hold.
  if (derivedDayTotals(coord, dispatchDay).consumed > PROVIDER_ATTEMPT_DAILY_LIMIT)
    throw new QuotaBudgetRefusal(QUOTA_REFUSALS.DAY_OVER_LIMIT);

  const open = coord._all(
    `SELECT * FROM d6_grant_reservations
      WHERE grant_id = ? AND occurrence_id = ? AND state = 'open'
      ORDER BY day_key`, grantId, occurrenceId);
  let reservation = open.find(r => r.day_key === dispatchDay) || null;

  if (!reservation) {
    if (open.length === 0) {
      // No open reservation: either never reserved under this
      // grant (a dispatch path outside the grant system) or
      // already closed while this execution can still dispatch —
      // the §1.5 recovery defect case. Fail closed, loudly.
      throw new QuotaBudgetRefusal(QUOTA_REFUSALS.UNRESERVED);
    }
    // §2 re-reservation: the only open reservation belongs to
    // another day. It is NOT debited and NOT closed here; a new
    // reservation for the dispatch day is created atomically,
    // under the §1.3 day check, in this same transaction.
    const slots = SEGMENT_ATTEMPT_BUDGET -
      segmentAttemptsUsed(coord, attemptRow.plan_id, occurrenceId);
    if (slots <= 0)
      throw new QuotaBudgetRefusal(QUOTA_REFUSALS.DAY_ROLLOVER);
    const totals = derivedDayTotals(coord, dispatchDay);
    if (totals.consumed + slots > PROVIDER_ATTEMPT_DAILY_LIMIT)
      throw new QuotaBudgetRefusal(QUOTA_REFUSALS.DAY_ROLLOVER);
    const reservationId = `qres:${grantId}:${occurrenceId}:${dispatchDay}`;
    coord.sql.exec(
      `INSERT INTO d6_grant_reservations
         (reservation_id, grant_id, occurrence_id, plan_id, job_id, day_key,
          slots_total, slots_consumed, state, close_reason, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'open', NULL, ?, ?)`,
      reservationId, grantId, occurrenceId, attemptRow.plan_id ?? null,
      executionRow.job_id, dispatchDay, slots, nowMs, nowMs);
    reservation = reservationById(coord, reservationId);
  }

  // The reservation-level checks (invariant 2): the stored
  // counter must reconcile with the derived dispatch count for
  // this reservation (drift refuses), and a slot must remain.
  const derived = derivedSlotsConsumed(coord, reservation);
  if (derived !== reservation.slots_consumed)
    throw new QuotaBudgetRefusal(QUOTA_REFUSALS.COUNTER_DRIFT);
  if (reservation.slots_consumed >= reservation.slots_total)
    throw new QuotaBudgetRefusal(QUOTA_REFUSALS.BUDGET);

  coord.sql.exec(
    `INSERT INTO d6_provider_dispatches
       (attempt_id, grant_id, occurrence_id, plan_id, execution_id,
        dispatch_day_key, dispatched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    attemptRow.attempt_id, grantId, occurrenceId, attemptRow.plan_id ?? null,
    attemptRow.execution_id, dispatchDay, nowMs);
  coord.sql.exec(
    `UPDATE d6_grant_reservations SET slots_consumed = slots_consumed + 1,
       updated_at = ? WHERE reservation_id = ?`,
    nowMs, reservation.reservation_id);
  return { armed: true, dispatchDay, reservationId: reservation.reservation_id };
}

// The read surface for diagnostics / the Settings quota view.
// Labels are exact (addendum §4): the grant counter and the
// dispatch counter are different numbers and are never merged.
export function quotaBudgetView(coord, dayKey = null) {
  if (!quotaArmed(coord)) return { armed: false };
  const day = dayKey ?? ptDayKey(coord._now());
  const totals = derivedDayTotals(coord, day);
  return {
    armed: true,
    dayKey: day,
    providerAttemptDailyLimit: PROVIDER_ATTEMPT_DAILY_LIMIT,
    limitProvenance: "app-selected Reader policy cap (not a verified provider limit)",
    dispatchesTodayLabel: "Reader D6 provider requests today, app-counted",
    dispatched: totals.dispatched,
    reserved: totals.reserved,
    consumed: totals.consumed,
    dayOverLimit: totals.consumed > PROVIDER_ATTEMPT_DAILY_LIMIT,
    openReservations: openReservations(coord).length,
    bootstrapExceptions: bootstrapExceptions(coord).length,
    currentDayBlocked: currentDayBootstrapBlocked(coord, day),
  };
}
