// D7-2 (Rowan ruling, board issue #15 comment 6524426826; Julie's
// approval, comment 6524562842) — the BIRTH-MARK + GRANT-QUARANTINE
// store: the durable record that separates plan ADMISSION from
// SPEND AUTHORITY.
//
// A plan submitted while GENERATION_HALT !== "0" (missing or
// malformed counts as halted) is admitted exactly as before —
// durable plan, first job, state 'active', zero grants — but it is
// BORN QUARANTINED: an immutable, server-stamped hold row written
// in the SAME transaction as the plan insert. The hold, not the
// halt flag, is what fences the plan's money: the D6 grant guard
// (generation/grant-guards.mjs) refuses every grant for a held
// subject even after a generic re-arm flips the halt off, the
// driver skips held plans, and the executor refuses held jobs.
// The ONLY way a hold clears is the operator-only, per-subject
// release (generation/service.mjs releaseQuarantine) — re-arm,
// phase binding, settings changes, plan retries, client fields,
// and other plans' releases never touch it.
//
// A second subject kind covers the non-D6 hole Rowan named: a job
// with NO D6 plan that attempts a grant while halted (a legacy
// RequestSynthesis / RequestResume from an old client) is refused
// by the guard AND durably marked at that first halted attempt, so
// the staged job stays fenced after re-arm until an operator
// releases that job explicitly.
//
// Storage law (the phase-policy / plan-retirements precedent):
// this table is ADDITIVE and LAZILY ENSURED — its DDL lives here,
// beside its writers, and is never added to gen-schema.mjs,
// because the correction suites pin the bootstrap's table set
// (d6-correction C2 asserts exactly eight bootstrap tables). The
// DDL is CREATE TABLE IF NOT EXISTS only, and every read is
// throw-safe (_oneOrNull / _all over toArray, never a bare .one()
// — real DO SQLite throws on empty results). A store that never
// submits while halted and never attempts a halted non-plan grant
// never grows the table.
//
// Immutability: the birth fields (reason, source, marked_at) are
// written once by INSERT OR IGNORE and are never updated. Release
// appends its own audit fields (released_at, release_source,
// release_actor_class) and flips state to 'released'; the row
// itself is never deleted, so the record of the hold — and of who
// cleared it, when, and under what recorded authorization — is
// permanent.

export const QUARANTINE_SCHEMA = `
CREATE TABLE IF NOT EXISTS d6_quarantine_holds (
  subject_kind TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  state TEXT NOT NULL,
  reason TEXT NOT NULL,
  source TEXT,
  marked_at INTEGER NOT NULL,
  released_at INTEGER,
  release_source TEXT,
  release_actor_class TEXT,
  PRIMARY KEY (subject_kind, subject_id)
);
`;

export function ensureQuarantineSchema(sql) {
  sql.exec(QUARANTINE_SCHEMA);
}

// Strict read for callers that have already ensured the schema
// (the grant guard, the service): returns the hold row or null.
export function quarantineHoldRow(coord, subjectKind, subjectId) {
  return coord._oneOrNull(
    `SELECT * FROM d6_quarantine_holds
      WHERE subject_kind = ? AND subject_id = ?`,
    subjectKind, subjectId);
}

// Throw-safe read for surfaces that must work on stores where the
// table was never created (read views, the executor's defense
// layer): a missing table reads as "no hold", never an error.
export function quarantineHoldRowSafe(coord, subjectKind, subjectId) {
  try {
    return quarantineHoldRow(coord, subjectKind, subjectId);
  } catch { return null; }
}

// The held row for a subject, or null when there is no hold or the
// hold has been released.
export function heldQuarantine(coord, subjectKind, subjectId) {
  const row = quarantineHoldRowSafe(coord, subjectKind, subjectId);
  return row && row.state === "held" ? row : null;
}

// Record a subject's birth/first-attempt hold. INSERT OR IGNORE:
// a duplicate submission or a repeated halted grant attempt
// converges on the existing row — never a second mark, never an
// overwrite of the original provenance.
export function recordQuarantineHold(coord, { subjectKind, subjectId,
                                               reason, source }) {
  ensureQuarantineSchema(coord.sql);
  coord.sql.exec(
    `INSERT OR IGNORE INTO d6_quarantine_holds
       (subject_kind, subject_id, state, reason, source, marked_at)
     VALUES (?, ?, 'held', ?, ?, ?)`,
    subjectKind, subjectId, reason, source ?? null, coord._now());
  return quarantineHoldRow(coord, subjectKind, subjectId);
}

// The release write (service.releaseQuarantine is the only
// caller): flips a HELD row to 'released' and stamps the audit
// fields. Returns the updated row, or null when no held row
// existed (the service distinguishes the idempotent re-release
// from the never-held refusal before calling this).
export function applyQuarantineRelease(coord, { subjectKind, subjectId,
                                                source, actorClass }) {
  const t = coord._now();
  coord.sql.exec(
    `UPDATE d6_quarantine_holds
        SET state = 'released', released_at = ?,
            release_source = ?, release_actor_class = ?
      WHERE subject_kind = ? AND subject_id = ? AND state = 'held'`,
    t, source ?? null, actorClass ?? null, subjectKind, subjectId);
  return quarantineHoldRow(coord, subjectKind, subjectId);
}

// The read-surface shape: what plan/job views report. `held` is
// the fence state right now; `approvalRequired` is the truthful
// client-facing reading of a held subject (a human authorization
// is required before any spend — it does NOT imply audio is
// generating, queued, or in flight).
export function quarantineView(row) {
  if (!row) return { held: false, approvalRequired: false, state: null };
  const held = row.state === "held";
  return {
    held,
    approvalRequired: held,
    state: row.state,
    reason: row.reason,
    source: row.source ?? null,
    markedAt: row.marked_at,
    releasedAt: row.released_at ?? null,
    releaseSource: row.release_source ?? null,
    releaseActorClass: row.release_actor_class ?? null,
  };
}
