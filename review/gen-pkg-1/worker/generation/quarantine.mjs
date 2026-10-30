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
// DDL is CREATE TABLE IF NOT EXISTS only, and every read goes
// through _oneOrNull / _all over toArray, never a bare .one()
// (real DO SQLite throws on empty results). Read ERROR semantics
// are fence-dependent since D8-1 (see the D8 note below): strict
// at spending/execute fences; at read-only views a genuinely
// absent table — and only that — reads as "no hold". A store
// that never submits while halted and never attempts a halted
// non-plan grant never grows the table.
//
// Immutability: the birth fields (reason, source, marked_at) are
// written once by INSERT OR IGNORE and are never updated. Release
// appends its own audit fields (released_at, release_source,
// release_actor_class) and flips state to 'released'; the row
// itself is never deleted, so the record of the hold — and of who
// cleared it, when, and under what recorded authorization — is
// permanent.
//
// D8 (Rowan review of the D7-2 build, board comment 6525035570):
// two corrections live here.
//   D8-1 FAIL-CLOSED READS: the original build read holds through
//   a catch-all helper that returned null on ANY SQL error, so a
//   failed SELECT at a spending fence masqueraded as "no hold"
//   and a held subject could be granted. That is now impossible
//   at every fence: the guard, the driver skip, and the executor
//   defense read through heldQuarantineStrict (schema ensured
//   first; ANY error propagates and refuses the spend). The
//   throw-safe read survives ONLY for read-only views (plan
//   status / summaries / the release read-back), and even there
//   it swallows exactly one error class — a genuinely absent
//   lazily-created table ("no such table") — and rethrows
//   everything else. An ERROR is never "no hold".
//   D8-2 HALT-EPOCH LEDGER: a plan-less job staged in the store
//   while halted (the pre-D8 shape: plain SubmitJob admitted by
//   the old entry, or any row that never passed a D6-owned
//   surface) carried no birth mark, and a halted grant attempt
//   rejected BEFORE the D6 guard (quota park / daily quota /
//   monthly cap — all checked earlier inside _issueGrant) never
//   reached the guard's guard-time mark — so a generic re-arm
//   could make it spendable. The ledger below is the durable
//   answer: every D6-owned observation point (the grant guard,
//   driveOnce, submitIntent) notes whether generation was halted
//   when it ran, maintaining halt EPOCHS — intervals bounded by
//   the last observed unhalted moment and the last observed
//   halted moment. The guard fences a plan-less job still in its
//   pre-grant 'queued' state whose created_at falls inside an
//   epoch: it is durably marked (reason "born_while_halted",
//   source "halt_epoch") and refused, atomically in the grant
//   transaction, on the FIRST guarded attempt — whenever that
//   attempt happens. Jobs created before an epoch (pre-halt work)
//   are never suspect; jobs already granted (state other than
//   'queued') are outside this fence — the hold fence above,
//   which is state-independent, governs held subjects. The
//   epoch bounds are observation-bounded by construction: an
//   epoch's suspect window runs from the last moment D6
//   machinery OBSERVED the system unhalted to the last moment it
//   observed it halted, so in production (the class alarm's
//   driveOnce runs every watchdog cycle, and every intent and
//   guarded grant notes an observation) any real halt is
//   observed many times. Client-reachable staging while halted
//   is refused outright at the entry/class admission fence
//   (worker-entry-prod-d6.js); the ledger covers the rows that
//   exist in the store despite that fence.

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

// Thrown by a SQL engine when a lazily-ensured table was never
// created. This is the ONLY error a read-only view may read as
// "no hold" (D8-1): it proves the store never marked anything,
// because marks are written only after the schema is ensured.
export function isNoSuchTableError(e) {
  return !!e && typeof e.message === "string" &&
    e.message.includes("no such table");
}

// Throw-safe read for READ-ONLY surfaces that must work on stores
// where the table was never created (plan status / summaries,
// the release read-back view): a genuinely absent table reads as
// "no hold". Any OTHER error is rethrown (D8-1) — a database
// fault must surface as a fault, never as an all-clear. Spending
// and execute fences must NOT use this helper; they ensure the
// schema and read strictly (heldQuarantineStrict below).
export function quarantineHoldRowSafe(coord, subjectKind, subjectId) {
  try {
    return quarantineHoldRow(coord, subjectKind, subjectId);
  } catch (e) {
    if (isNoSuchTableError(e)) return null;
    throw e;
  }
}

// The held row for a subject, or null when there is no hold or the
// hold has been released. VIEW-LEVEL helper (throw-safe read
// semantics above); fences use heldQuarantineStrict.
export function heldQuarantine(coord, subjectKind, subjectId) {
  const row = quarantineHoldRowSafe(coord, subjectKind, subjectId);
  return row && row.state === "held" ? row : null;
}

// STRICT held read for SPENDING / EXECUTE fences (the grant
// guard, the driver's skip, the executor's defense — D8-1). The
// caller MUST have ensured the schema first (every fence does),
// so the only legitimate outcomes are "row" or "no row"; any SQL
// error — schema fault, read fault, corruption — PROPAGATES, and
// the fence treats the throw as a refusal before any grant,
// ledger, outbox, or provider effect. Never returns a fabricated
// all-clear.
export function heldQuarantineStrict(coord, subjectKind, subjectId) {
  const row = quarantineHoldRow(coord, subjectKind, subjectId);
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

// ---------------------------------------------------------------------------
// D8-2 — the HALT-EPOCH LEDGER (Rowan review 6525035570).
//
// Storage law is the same as the holds table: ADDITIVE and
// LAZILY ENSURED — the DDL lives here, beside its writers, and
// is never added to gen-schema.mjs (the bootstrap's pinned table
// set is untouched; a store whose D6 machinery never runs a
// guarded grant, a drive pass, or an intent never grows these
// tables).
//
// An epoch is one observed halt interval:
//   suspect_from    — the last moment D6 machinery observed the
//                     system UNHALTED before the interval (0 when
//                     no unhalted observation was ever recorded:
//                     every pre-observation birth is suspect,
//                     the fail-closed default for a fresh store).
//   last_halted_at  — the last moment the interval was observed
//                     still halted.
//   closed_at       — the first unhalted observation after the
//                     interval, or NULL while it is open.
// A job born at time C is suspect for an epoch when
// suspect_from < C <= last_halted_at: it provably did not exist
// at the last known-unhalted moment, and it already existed at
// the last known-halted moment. Births in the unobserved slivers
// (after the last unhalted observation but before the halt
// began; after the last halted observation but before the halt
// ended) cannot be proven either way by ANY durable record —
// the first sliver is fenced (fail-closed: its jobs are treated
// as halt-born until an operator releases them), the second is
// not (a job born there is indistinguishable from one born
// after re-arm, and fencing it would fence legitimate re-arm
// work — including the job a post-re-arm RequestSynthesis
// creates and grants inside one command). Observation density
// bounds both slivers: in production the class alarm's
// driveOnce notes an observation every watchdog cycle and every
// intent / guarded grant notes one too.
// ---------------------------------------------------------------------------

export const HALT_EPOCH_SCHEMA = `
CREATE TABLE IF NOT EXISTS d6_halt_epochs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  suspect_from INTEGER NOT NULL,
  last_halted_at INTEGER NOT NULL,
  closed_at INTEGER
);
CREATE TABLE IF NOT EXISTS d6_quarantine_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

export function ensureHaltEpochSchema(sql) {
  sql.exec(HALT_EPOCH_SCHEMA);
}

function haltMetaGet(coord, key) {
  const row = coord._oneOrNull(
    `SELECT value FROM d6_quarantine_meta WHERE key = ?`, key);
  return row ? row.value : null;
}

function haltMetaSet(coord, key, value) {
  coord.sql.exec(
    `INSERT INTO d6_quarantine_meta (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    key, String(value));
}

// Record one observation of the generation halt state, from a
// D6-owned surface (the grant guard, driveOnce, submitIntent).
// Synchronous and transactional with the caller's work where the
// caller is in a transaction (the guard is). The halt reading is
// the same law as everywhere in D6: exactly "0" is unhalted;
// missing or malformed counts as halted.
export function noteHaltObservation(coord, env) {
  ensureHaltEpochSchema(coord.sql);
  const now = coord._now();
  const halted = !env || env.GENERATION_HALT !== "0";
  const open = coord._oneOrNull(
    `SELECT * FROM d6_halt_epochs WHERE closed_at IS NULL
      ORDER BY id DESC LIMIT 1`);
  if (halted) {
    if (!open) {
      const lastUnhalted = haltMetaGet(coord, "last_unhalted_at");
      coord.sql.exec(
        `INSERT INTO d6_halt_epochs (suspect_from, last_halted_at, closed_at)
         VALUES (?, ?, NULL)`,
        lastUnhalted === null ? 0 : Number(lastUnhalted), now);
    } else if (now > open.last_halted_at) {
      coord.sql.exec(
        `UPDATE d6_halt_epochs SET last_halted_at = ? WHERE id = ?`,
        now, open.id);
    }
    haltMetaSet(coord, "halt_obs_state", "halted");
  } else {
    const prev = haltMetaGet(coord, "last_unhalted_at");
    if (prev === null || now > Number(prev))
      haltMetaSet(coord, "last_unhalted_at", now);
    if (open)
      coord.sql.exec(
        `UPDATE d6_halt_epochs SET closed_at = ? WHERE id = ?`,
        now, open.id);
    haltMetaSet(coord, "halt_obs_state", "unhalted");
  }
}

// The epoch a job born at `createdAt` is suspect under, or null.
// STRICT read (the schema is ensured by the caller — the guard
// ensures it via noteHaltObservation before asking): any SQL
// error propagates and refuses the grant. A non-numeric birth
// time cannot be proven suspect and is never fenced by the
// epoch (real job rows always carry created_at from _submitJob;
// a row without one did not come from a creation path).
export function haltEpochSuspect(coord, createdAt) {
  if (typeof createdAt !== "number" || !Number.isFinite(createdAt))
    return null;
  return coord._oneOrNull(
    `SELECT * FROM d6_halt_epochs
      WHERE suspect_from < ? AND ? <= last_halted_at
      ORDER BY id DESC LIMIT 1`, createdAt, createdAt);
}
