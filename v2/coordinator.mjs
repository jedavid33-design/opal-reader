// Opal Reader v2 — Generation Coordinator (P2).
//
// One account-wide Durable Object owning: job/plan aggregates, the durable
// command log with receipts, dispatch grants, the usage ledger (quota +
// spending authority), the durable schedule + alarm watchdog chain, the
// settings aggregate, and audio bindings with conflict validation.
//
// Design: pre-implementation package §1.1/§1.2/§1.5 + Rowan's sign-off
// criteria (autonomous recovery; audio-conflict validation). The class is
// written against the standard DO storage interface (state.storage.sql,
// transactionSync, setAlarm/getAlarm) and holds NO state in memory — every
// fact lives in SQLite, so an instance crash is a non-event: a fresh
// instance over the same storage continues exactly where the last stopped.
//
// Storage interface used (implemented by the test harness over node:sqlite
// and by Cloudflare's DO SQLite storage in production):
//   storage.sql.exec(query, ...params) -> { toArray(), one() }
//   storage.transactionSync(fn)
//   storage.setAlarm(msEpoch) / storage.getAlarm() / storage.deleteAlarm()
import { createHash } from "node:crypto";
import { APPROVED_FREEZE_MANIFEST } from "./p8/approved-freeze-manifest.mjs";

export const JOB_STATES = [
  "queued", "generating", "paused_quota", "paused_user", "outcome_unknown",
  "complete", "partial", "failed", "cancelled", "superseded",
];
export const JOB_EVENTS = [
  "grant", "report_complete", "report_partial", "report_failed",
  "park", "pause", "resume", "resume_probe", "cancel",
  "unknown", "resolve", "supersede",
];
// The transition table. Anything (state, event) NOT listed here is an
// explicit rejection — there is no implicit or default transition.
export const JOB_TRANSITIONS = {
  // queued / paused_user also accept the SETTLE events (report_complete,
  // report_partial, report_failed, unknown): work dispatched before a
  // pause — or before a resume landed the job back in queued — can
  // finish in flight, and the shared completion derivation must be able
  // to land the job in its TRUE state through this single applier
  // (round 3, fix 4). A pause stops NEW dispatches; it cannot un-finish
  // work that already completed.
  queued:          { grant: "generating", pause: "paused_user", cancel: "cancelled", supersede: "superseded",
                     report_complete: "complete", report_partial: "partial", report_failed: "failed",
                     unknown: "outcome_unknown" },
  generating:      { grant: "generating", report_complete: "complete", report_partial: "partial", report_failed: "failed",
                     park: "paused_quota", pause: "paused_user", cancel: "cancelled", unknown: "outcome_unknown" },
  paused_quota:    { resume_probe: "generating", cancel: "cancelled", supersede: "superseded" },
  paused_user:     { resume: "queued", cancel: "cancelled", supersede: "superseded",
                     report_complete: "complete", report_partial: "partial", report_failed: "failed",
                     unknown: "outcome_unknown" },
  outcome_unknown: { resolve: "queued", report_complete: "complete", report_partial: "partial",
                     report_failed: "failed", cancel: "cancelled", supersede: "superseded" },
  complete:        { supersede: "superseded" },
  partial:         { resume: "queued", cancel: "cancelled", supersede: "superseded" },
  failed:          { supersede: "superseded" },
  cancelled:       {},
  superseded:      {},
};

export const OCC_STATES = [
  "pending", "granted", "ready", "blocked_policy", "failed", "outcome_unknown",
];
export const OCC_EVENTS = [
  "grant", "report_success", "report_blocked", "report_failed", "defer",
  "lease_expired", "report_unvalidated",
  "reconcile_adopt", "reconcile_spent", "resolve_resynthesize",
];
export const OCC_TRANSITIONS = {
  pending:         { grant: "granted" },
  granted:         { report_success: "ready", report_blocked: "blocked_policy",
                     report_failed: "failed", defer: "pending",
                     report_unvalidated: "outcome_unknown",
                     lease_expired: "outcome_unknown" },
  ready:           {},
  blocked_policy:  {},
  failed:          {},
  outcome_unknown: { reconcile_adopt: "ready", reconcile_spent: "failed",
                     resolve_resynthesize: "pending" },
};

export const COMMAND_TYPES = [
  "SubmitJob", "RequestRepair", "RequestPause", "RequestResume",
  "RequestCancel", "RequestSynthesis", "AdoptAudio",
  "ResolveOutcomeUnknown", "SetSettings", "FreezeDirective",
  "SyncPush", "PushPositionEvents", "DeleteBook",
  "MigrateImportBindings", "MigrateRecordFlipGate",
];

// The migration command types (G2 correction; Rowan re-review
// 6354569652). These are OPERATOR-ONLY: the server entry refuses
// them for ordinary client tokens before the coordinator is ever
// reached (v2/worker-entry.js + v2/api.mjs admission fence), and
// the coordinator independently pins what they may carry to the
// approved freeze (below). A command NAME is not authorization —
// this list exists so every layer fences the same set.
export const MIGRATION_COMMAND_TYPES = [
  "MigrateImportBindings", "MigrateRecordFlipGate",
];

// P4 sync families. Position rides the same change machinery; money
// is NOT a family — it is never client-writable (coordinator ledger).
export const SYNC_FAMILIES = ["content", "bindings", "position", "settings"];

const WATCHDOG_PERIOD_MS = 10 * 60 * 1000;
const LEASE_MS = 15 * 60 * 1000;
const DAILY_QUOTA_LIMIT = 100; // Gemini Tier 1 requests/day (provider day, PT)
const SCHEDULE_MAX_ATTEMPTS = 8;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS commands (
  command_id TEXT PRIMARY KEY, type TEXT NOT NULL, payload_json TEXT NOT NULL,
  received_at INTEGER NOT NULL, outcome TEXT NOT NULL, outcome_json TEXT);
CREATE TABLE IF NOT EXISTS jobs (
  job_id TEXT PRIMARY KEY, kind TEXT NOT NULL, book_id TEXT, chapter_index INTEGER,
  lane TEXT, state TEXT NOT NULL, revision INTEGER NOT NULL,
  data_json TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS occurrences (
  job_id TEXT NOT NULL, occurrence_id TEXT NOT NULL,
  revision_key TEXT NOT NULL, state TEXT NOT NULL,
  cache_key TEXT, detail_json TEXT,
  PRIMARY KEY (job_id, occurrence_id));
CREATE TABLE IF NOT EXISTS transitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL,
  aggregate TEXT NOT NULL, aggregate_id TEXT NOT NULL, cause TEXT NOT NULL,
  from_state TEXT, to_state TEXT, revision INTEGER, detail_json TEXT);
CREATE TABLE IF NOT EXISTS grants (
  grant_id TEXT PRIMARY KEY, job_id TEXT NOT NULL, revision INTEGER NOT NULL,
  state TEXT NOT NULL, created_at INTEGER NOT NULL, lease_expires_at INTEGER,
  report_json TEXT);
CREATE TABLE IF NOT EXISTS outbox (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL, payload_json TEXT NOT NULL,
  created_at INTEGER NOT NULL, sent_at INTEGER, send_attempted_at INTEGER);
CREATE TABLE IF NOT EXISTS ledger_ops (
  op_key TEXT PRIMARY KEY, at INTEGER NOT NULL, day_key TEXT NOT NULL,
  month_key TEXT NOT NULL, kind TEXT NOT NULL,
  est_micro_cents INTEGER NOT NULL DEFAULT 0, detail_json TEXT);
CREATE TABLE IF NOT EXISTS quota_parks (
  id INTEGER PRIMARY KEY AUTOINCREMENT, parked_at INTEGER NOT NULL,
  evidence_json TEXT, released_at INTEGER, release_cause TEXT);
CREATE TABLE IF NOT EXISTS schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT, due_at INTEGER NOT NULL,
  kind TEXT NOT NULL, ref TEXT, payload_json TEXT,
  attempts INTEGER NOT NULL DEFAULT 0, state TEXT NOT NULL DEFAULT 'pending');
CREATE TABLE IF NOT EXISTS bindings (
  occurrence_id TEXT NOT NULL, revision_key TEXT NOT NULL,
  cache_key TEXT NOT NULL, provenance TEXT, bound_at INTEGER NOT NULL,
  PRIMARY KEY (occurrence_id, revision_key));
CREATE TABLE IF NOT EXISTS cache_index (
  cache_key TEXT PRIMARY KEY, identity TEXT, format TEXT, sha256 TEXT, recorded_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS binding_conflicts (
  id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL,
  occurrence_id TEXT, cache_key TEXT, expected TEXT, found TEXT, reason TEXT);
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1), revision INTEGER NOT NULL, data_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
-- P3: the acceptance ledger (Case #5 contracts). One claim row per
-- grantId: claimed -> completed | (unclaimed) -> closed. A missing row
-- is UNKNOWN, never a terminal negative.
CREATE TABLE IF NOT EXISTS claims (
  grant_id TEXT PRIMARY KEY, state TEXT NOT NULL,
  consumer_id TEXT, claimed_at INTEGER, closed_reason TEXT, updated_at INTEGER NOT NULL);
-- P3: the per-occurrence spend-intent fence (gate-2 condition 1).
-- Acquired atomically exactly once; the ONLY permit for a provider
-- call. An intent with no recorded outcome is spent-or-unknown and is
-- never re-acquirable. Keyed by the OCCURRENCE (job_id, occurrence_id),
-- not the dispatch: a deferred occurrence re-granted under a new grant
-- meets the SAME fence — the spend boundary is the work, not the
-- envelope. grant_id records the dispatch that fenced it (provenance).
CREATE TABLE IF NOT EXISTS spend_intents (
  job_id TEXT NOT NULL, occurrence_id TEXT NOT NULL, grant_id TEXT,
  consumer_id TEXT NOT NULL, acquired_at INTEGER NOT NULL,
  outcome TEXT, outcome_detail TEXT,
  generation INTEGER NOT NULL DEFAULT 1,
  superseded_at INTEGER, superseded_reason TEXT,
  PRIMARY KEY (job_id, occurrence_id, generation));
-- P3: the coordinator-owned durable Batch mapping (contract 2).
-- fenced (pre-POST) -> submitted | ambiguous | rejected;
-- ambiguous -> submitted (lookup adoption) | closed (explicit
-- resolution with evidence only). display_name is a lookup hint.
-- Occurrence-keyed for the same reason as the fence: a re-granted
-- occurrence polls its EXISTING batch, never a second submission.
-- Generation-versioned like the fence (P3 review fix): a terminal
-- never-accepted resolution SUPERSEDES the closed generation, and
-- only a superseded generation may be succeeded by a fresh,
-- explicitly audited attempt — the original permit is never reused.
CREATE TABLE IF NOT EXISTS batch_maps (
  job_id TEXT NOT NULL, occurrence_id TEXT NOT NULL, grant_id TEXT,
  display_name TEXT NOT NULL, provider_name TEXT,
  state TEXT NOT NULL, detail TEXT, updated_at INTEGER NOT NULL,
  generation INTEGER NOT NULL DEFAULT 1, superseded_at INTEGER,
  PRIMARY KEY (job_id, occurrence_id, generation));
-- P4 sync substrate (Case #6 contracts): an append-only per-family
-- change history written in the SAME transaction as every mutation,
-- the current-entity mirror it reconstructs, the position journal,
-- and the folded canonical position per book.
CREATE TABLE IF NOT EXISTS sync_changes (
  family TEXT NOT NULL, seq INTEGER NOT NULL, entity_key TEXT NOT NULL,
  book_id TEXT, revision INTEGER NOT NULL, op TEXT NOT NULL,
  payload_json TEXT, PRIMARY KEY (family, seq));
-- The sequence authority is INDEPENDENT of the retained rows
-- (P4 review blocker 1): truncating history can never reset the
-- counter, and the floor records how far retention has advanced.
CREATE TABLE IF NOT EXISTS sync_family_state (
  family TEXT PRIMARY KEY, tip INTEGER NOT NULL DEFAULT 0,
  floor INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS sync_entities (
  family TEXT NOT NULL, entity_key TEXT NOT NULL, book_id TEXT,
  revision INTEGER NOT NULL DEFAULT 0, deleted INTEGER NOT NULL DEFAULT 0,
  data_json TEXT, PRIMARY KEY (family, entity_key));
CREATE TABLE IF NOT EXISTS position_events (
  book_id TEXT NOT NULL, event_id TEXT NOT NULL, receipt_seq INTEGER NOT NULL,
  device_id TEXT NOT NULL, local_seq INTEGER NOT NULL, kind TEXT NOT NULL,
  occurrence_id TEXT, offset_sec REAL, base_seq INTEGER NOT NULL,
  superseded INTEGER NOT NULL DEFAULT 0, payload_json TEXT NOT NULL,
  PRIMARY KEY (book_id, event_id));
CREATE TABLE IF NOT EXISTS position_state (
  book_id TEXT PRIMARY KEY, occurrence_id TEXT, occ_index INTEGER,
  offset_sec REAL, playing INTEGER NOT NULL DEFAULT 0,
  tip INTEGER NOT NULL DEFAULT 0, superseded_count INTEGER NOT NULL DEFAULT 0);
-- P8 migration import (v2/p8/migration-import-design.md): the
-- per-book import record (the manifest row set a book was imported
-- under, canonically digested), the provenance-acceptance audit
-- trail for the fingerprinted-distinct rows, and the flip gates.
-- A book counts as flipped ONLY through a migration_gates row,
-- which MigrateRecordFlipGate refuses to write over an incomplete
-- or divergent import.
CREATE TABLE IF NOT EXISTS migration_books (
  book_id TEXT PRIMARY KEY, migration_id TEXT, freeze_digest TEXT,
  row_count INTEGER NOT NULL, rows_json TEXT NOT NULL,
  rows_sha256 TEXT NOT NULL, imported_at INTEGER NOT NULL,
  certificate_sha256 TEXT);
CREATE TABLE IF NOT EXISTS migration_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL,
  migration_id TEXT, book_id TEXT, occurrence_id TEXT,
  revision_key TEXT, cache_key TEXT, recorded_identity TEXT,
  attestation_sha256 TEXT, attestation_json TEXT, outcome TEXT);
CREATE TABLE IF NOT EXISTS migration_gates (
  book_id TEXT PRIMARY KEY, migration_id TEXT,
  certificate_sha256 TEXT, flipped_at INTEGER NOT NULL,
  detail_json TEXT);
`;

function dayKeyPT(nowMs) {
  // Gemini's quota day is a Pacific-Time day (v1 semantics).
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(nowMs));
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
function monthKey(nowMs) { return dayKeyPT(nowMs).slice(0, 7); }

// Canonical JSON (sorted keys, recursively) + its SHA-256 — the
// digest discipline for migration row sets and attestations: two
// structures are "the same" iff their canonical forms are byte-equal.
function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort()
    .map(k => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(",")}}`;
}
function sha256HexText(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export class GenerationCoordinator {
  constructor(state, env = {}) {
    this.state = state;
    this.env = env;
    this._txDepth = 0;
    this.sql = state.storage.sql;
    // Schema DDL is idempotent and runs on writable instances. Read-only
    // facades (the GET API) pass ASSUME_SCHEMA: the tables exist because
    // every writable wake creates them first.
    if (!env.ASSUME_SCHEMA) {
      this.sql.exec(SCHEMA);
      // Part 1 integration fix: seed every sync family's state row at
      // schema time (history-aware, insert-or-ignore). _familyState's
      // lazy INSERT is a WRITE, and the GET API's read-only facade
      // rightly rejects it — so a never-written family (e.g. bindings
      // before the first binding) made snapshot/pullChanges throw on
      // the real HTTP surface even though the harness's direct calls
      // passed. Seeding here means a writable construction (which the
      // DO host always performs first) makes every family readable.
      for (const family of SYNC_FAMILIES) {
        const mx = this._one(
          `SELECT COALESCE(MAX(seq), 0) AS tip, MIN(seq) AS fl FROM sync_changes WHERE family = ?`,
          family);
        this.sql.exec(
          `INSERT OR IGNORE INTO sync_family_state (family, tip, floor) VALUES (?, ?, ?)`,
          family, mx ? mx.tip : 0, mx && mx.fl !== null ? mx.fl : 1);
      }
    }
  }

  _now() { return typeof this.env.now === "function" ? this.env.now() : Date.now(); }
  // Re-entrant: a nested _tx joins the outer transaction (the outer one
  // is the atomic unit — command acceptance + its grant commit or roll
  // back together).
  _tx(fn) {
    if (this._txDepth) return fn();
    this._txDepth = 1;
    try { return this.state.storage.transactionSync(fn); }
    finally { this._txDepth = 0; }
  }
  _one(q, ...params) { return this.sql.exec(q, ...params).one(); }
  // Optional single-row lookup (Finding F1 fix, Rowan 6349288135):
  // absence is a legitimate, expected state at the audited call sites
  // that use this — a first-ever command, settings before anyone has
  // saved any, an absent meta key, an unknown job/grant/binding.
  // Implemented over toArray() with an explicit cardinality check:
  // 0 rows -> null, 1 row -> the row, >1 rows -> THROW (a duplicate
  // singleton is corruption and must stay loud — never rows[0] by
  // silence, never a caught .one() exception). Strict reads (scalar
  // aggregates; rows a live invariant guarantees) keep using _one().
  // Full audit: v2/p8/f1-fix-addendum.md.
  _oneOrNull(q, ...params) {
    const rows = this.sql.exec(q, ...params).toArray();
    if (rows.length === 0) return null;
    if (rows.length > 1)
      throw new Error(`Expected at most one result from SQL query, but got ${rows.length}.`);
    return rows[0];
  }
  _all(q, ...params) { return this.sql.exec(q, ...params).toArray(); }

  _logTransition(aggregate, id, cause, from, to, revision, detail) {
    this.sql.exec(
      `INSERT INTO transitions (at, aggregate, aggregate_id, cause, from_state, to_state, revision, detail_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      this._now(), aggregate, id, cause, from, to, revision,
      detail ? JSON.stringify(detail) : null);
  }

  // ---- freeze ------------------------------------------------------------
  _frozen() {
    const r = this._oneOrNull(`SELECT value FROM meta WHERE key = 'frozen'`);
    return r && r.value === "1";
  }

  // ---- job aggregate: the single applier ---------------------------------
  // Every job state change in the system funnels through here. The
  // transition must exist in JOB_TRANSITIONS and the caller's expected
  // revision must match, in the caller's transaction — otherwise the
  // event is rejected and the rejection is logged (I12).
  applyJobEvent(jobId, event, cause, detail = null, expectedRevision = null) {
    const job = this._oneOrNull(`SELECT * FROM jobs WHERE job_id = ?`, jobId);
    if (!job) return { ok: false, reason: "job_not_found" };
    if (expectedRevision !== null && expectedRevision !== job.revision) {
      this._logTransition("job", jobId, cause, job.state, job.state, job.revision,
        { rejected: event, reason: "revision_conflict", expectedRevision });
      return { ok: false, reason: "revision_conflict", revision: job.revision };
    }
    const to = (JOB_TRANSITIONS[job.state] || {})[event];
    if (!to) {
      this._logTransition("job", jobId, cause, job.state, job.state, job.revision,
        { rejected: event, reason: "illegal_transition" });
      return { ok: false, reason: "illegal_transition", state: job.state };
    }
    const revision = job.revision + 1;
    this.sql.exec(`UPDATE jobs SET state = ?, revision = ?, updated_at = ? WHERE job_id = ?`,
      to, revision, this._now(), jobId);
    this._logTransition("job", jobId, cause, job.state, to, revision, detail);
    return { ok: true, state: to, revision };
  }

  applyOccEvent(jobId, occurrenceId, event, cause, detail = null) {
    const occ = this._oneOrNull(
      `SELECT * FROM occurrences WHERE job_id = ? AND occurrence_id = ?`, jobId, occurrenceId);
    if (!occ) return { ok: false, reason: "occurrence_not_found" };
    const to = (OCC_TRANSITIONS[occ.state] || {})[event];
    if (!to) {
      this._logTransition("occurrence", `${jobId}/${occurrenceId}`, cause,
        occ.state, occ.state, null, { rejected: event, reason: "illegal_transition" });
      return { ok: false, reason: "illegal_transition", state: occ.state };
    }
    this.sql.exec(
      `UPDATE occurrences SET state = ?, detail_json = ? WHERE job_id = ? AND occurrence_id = ?`,
      to, detail ? JSON.stringify(detail) : occ.detail_json, jobId, occurrenceId);
    this._logTransition("occurrence", `${jobId}/${occurrenceId}`, cause, occ.state, to, null, detail);
    return { ok: true, state: to };
  }

  // ---- durable commands (§1.2) --------------------------------------------
  // Acceptance and application commit in ONE transaction: a receipt the
  // client holds always names a durable outcome, and a re-sent command_id
  // returns the original outcome without re-applying anything.
  async handleCommand(cmd) {
    if (!cmd || typeof cmd.command_id !== "string" || !cmd.command_id)
      return { ok: false, reason: "command_id_required" };
    if (!COMMAND_TYPES.includes(cmd.type))
      return { ok: false, reason: "unknown_command_type", type: cmd.type };
    const existing = this._oneOrNull(`SELECT * FROM commands WHERE command_id = ?`, cmd.command_id);
    if (existing) {
      return { command_id: existing.command_id, outcome: existing.outcome,
               ...(existing.outcome_json ? JSON.parse(existing.outcome_json) : {}),
               replayed: true };
    }
    // Migration import preparation (design §2): the prime is ASYNC
    // and must complete inside this operation, BEFORE the command
    // transaction opens and before any bind — a fresh coordinator
    // cannot see pre-existing objects through the request snapshot.
    // Only the migration command type prepares; a replay returned
    // above re-primes nothing. The prepared facts are DATA passed
    // into the synchronous apply step; the transaction stays sync.
    let prepared = null;
    if (cmd.type === "MigrateImportBindings" &&
        !this._migrationManifestError(cmd.payload || {}))
      prepared = await this._prepareMigrationImport(cmd.payload || {});
    // (G2: an import that fails the pinned-manifest check is never
    // primed — the apply step re-runs the same check and records the
    // rejection without touching storage.)
    await this.wake();
    const outcome = this._tx(() => {
      this.sql.exec(
        `INSERT INTO commands (command_id, type, payload_json, received_at, outcome)
         VALUES (?, ?, ?, ?, 'recorded')`,
        cmd.command_id, cmd.type, JSON.stringify(cmd.payload || {}), this._now());
      let result;
      if (this._frozen() && cmd.type !== "FreezeDirective")
        result = { outcome: "rejected", reason: "frozen" };
      else
        result = this._applyCommand(cmd.type, cmd.payload || {}, cmd.command_id, prepared);
      this.sql.exec(`UPDATE commands SET outcome = ?, outcome_json = ? WHERE command_id = ?`,
        result.outcome, JSON.stringify(result), cmd.command_id);
      return result;
    });
    await this._armAlarmIfEarlier(); // the command may have scheduled earlier work
    return { command_id: cmd.command_id, ...outcome };
  }

  _applyCommand(type, p, commandId, prepared = null) {
    switch (type) {
      case "SubmitJob": return this._submitJob(p, commandId, "job");
      case "RequestRepair": return this._submitJob(p, commandId, "repair");
      case "RequestPause": {
        const r = this.applyJobEvent(p.jobId, "pause", "RequestPause", { commandId });
        return r.ok ? { outcome: "applied", state: r.state, revision: r.revision }
                    : { outcome: "rejected", reason: r.reason };
      }
      case "RequestCancel": {
        const r = this.applyJobEvent(p.jobId, "cancel", "RequestCancel", { commandId });
        return r.ok ? { outcome: "applied", state: r.state, revision: r.revision }
                    : { outcome: "rejected", reason: r.reason };
      }
      case "RequestResume": return this._resume(p, commandId);
      case "RequestSynthesis": return this._requestSynthesis(p, commandId);
      case "AdoptAudio": {
        const v = this.validateAndBind(p);
        return v.bound ? { outcome: "applied", ...v } : { outcome: "rejected", ...v };
      }
      case "ResolveOutcomeUnknown": return this._resolveUnknown(p, commandId);
      case "SetSettings": return this._setSettings(p, commandId);
      case "SyncPush": return this._syncPush(p, commandId);
      case "PushPositionEvents": return this._pushPositionEvents(p, commandId);
      case "DeleteBook": return this._deleteBook(p, commandId);
      case "MigrateImportBindings": return this._migrateImportBindings(p, commandId, prepared);
      case "MigrateRecordFlipGate": return this._migrateRecordFlipGate(p, commandId);
      case "FreezeDirective": {
        this.sql.exec(`INSERT INTO meta (key, value) VALUES ('frozen', ?)
                       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
          p.freeze ? "1" : "0");
        this._logTransition("account", "account",
          p.freeze ? "FreezeDirective:on" : "FreezeDirective:off", null, null, null, { commandId });
        return { outcome: "applied", frozen: !!p.freeze };
      }
      default: return { outcome: "rejected", reason: "unimplemented" };
    }
  }

  _submitJob(p, commandId, kind) {
    if (!p.jobId || !Array.isArray(p.occurrences) || p.occurrences.length === 0)
      return { outcome: "rejected", reason: "job_shape" };
    const dupe = this._oneOrNull(`SELECT job_id FROM jobs WHERE job_id = ?`, p.jobId);
    if (dupe) return { outcome: "rejected", reason: "job_exists" };
    const now = this._now();
    this.sql.exec(
      `INSERT INTO jobs (job_id, kind, book_id, chapter_index, lane, state, revision, data_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'queued', 1, ?, ?, ?)`,
      p.jobId, kind, p.bookId || null, p.chapterIndex ?? null, p.lane || "standard",
      JSON.stringify(p.data || {}), now, now);
    for (const o of p.occurrences) {
      this.sql.exec(
        `INSERT INTO occurrences (job_id, occurrence_id, revision_key, state) VALUES (?, ?, ?, 'pending')`,
        p.jobId, o.occurrenceId, o.revisionKey);
    }
    this._logTransition("job", p.jobId, commandId, null, "queued", 1, { kind });
    return { outcome: "applied", jobId: p.jobId, state: "queued", revision: 1 };
  }

  _resume(p, commandId) {
    const job = this._oneOrNull(`SELECT * FROM jobs WHERE job_id = ?`, p.jobId);
    if (!job) return { outcome: "rejected", reason: "job_not_found" };
    if (job.state === "paused_quota") {
      // F5: resume from a quota park is a single-probe grant — exactly one
      // occurrence is dispatched (the probe is the one sanctioned dispatch
      // past an open park); its outcome decides what happens next.
      const g = this._issueGrant(p.jobId, { probe: true, commandId,
        bypassPark: true, jobEvent: "resume_probe", cause: "RequestResume" });
      if (!g.ok) return { outcome: "rejected", reason: g.reason };
      return { outcome: "applied", state: "generating", grantId: g.grantId, probe: true };
    }
    // Work may have settled while the job was paused (in-flight reports
    // landing on a delivered grant): settle FIRST, through the same
    // derivation. If the job is already complete, the resume is
    // satisfied — there is nothing to re-queue and nothing new to
    // dispatch (round 3, fix 4).
    this._deriveJobCompletion(p.jobId, "RequestResume");
    const settled = this._one(`SELECT * FROM jobs WHERE job_id = ?`, p.jobId);
    if (settled.state === "complete")
      return { outcome: "applied", state: "complete", revision: settled.revision };
    const r = this.applyJobEvent(p.jobId, "resume", "RequestResume", { commandId });
    if (!r.ok) return { outcome: "rejected", reason: r.reason };
    // ...and derive again after the resume lands (e.g. the job was
    // re-queued with every occurrence already settled by a reconcile).
    this._deriveJobCompletion(p.jobId, "RequestResume");
    const after = this._one(`SELECT * FROM jobs WHERE job_id = ?`, p.jobId);
    return { outcome: "applied", state: after.state, revision: after.revision };
  }

  _requestSynthesis(p, commandId) {
    // §1.1: auditions and single-segment generation pass the same gate as
    // jobs. Cached answer first; otherwise a one-occurrence job + grant.
    if (p.revisionKey && p.occurrenceId) {
      const b = this._oneOrNull(
        `SELECT * FROM bindings WHERE occurrence_id = ? AND revision_key = ?`,
        p.occurrenceId, p.revisionKey);
      if (b) return { outcome: "applied", answer: "cached", cacheKey: b.cache_key };
      // One in-flight operation per (occurrence, revision), whoever asked
      // (P2 review round 2, gap 1): two devices requesting the same audio
      // before either recording exists share the operation — the second
      // request joins it instead of paying for a duplicate synthesis.
      const dupe = this._oneOrNull(
        `SELECT j.job_id AS jobId, o.state AS occState
           FROM occurrences o JOIN jobs j ON j.job_id = o.job_id
          WHERE o.occurrence_id = ? AND o.revision_key = ?
            AND j.state NOT IN ('complete', 'failed', 'cancelled', 'superseded')
          ORDER BY j.created_at DESC LIMIT 1`, p.occurrenceId, p.revisionKey);
      if (dupe && dupe.occState === "outcome_unknown")
        return { outcome: "rejected", reason: "outcome_unknown", jobId: dupe.jobId };
      if (dupe && (dupe.occState === "pending" || dupe.occState === "granted"))
        return { outcome: "applied", answer: "in_progress", jobId: dupe.jobId };
    }
    const jobId = `synth:${commandId}`;
    const sub = this._submitJob({
      jobId, bookId: p.bookId || null, chapterIndex: p.chapterIndex ?? null,
      lane: "standard",
      occurrences: [{ occurrenceId: p.occurrenceId, revisionKey: p.revisionKey }],
      data: { via: "RequestSynthesis", estMicroCents: p.estMicroCents || 0 },
    }, commandId, "synthesis");
    if (sub.outcome !== "applied") return sub;
    const g = this._issueGrant(jobId, { commandId, jobEvent: "grant", cause: "RequestSynthesis" });
    if (!g.ok) return { outcome: "rejected", reason: g.reason, jobId };
    return { outcome: "applied", answer: "granted", jobId, grantId: g.grantId };
  }

  // ---- grants: the atomic budget gate (§1.1, I8) --------------------------
  // One transaction: park check -> quota estimate -> cap -> occurrence
  // transitions -> ledger reservations -> grant + outbox rows. There is no
  // interleaving in which two grants spend the same budget.
  _issueGrant(jobId, { probe = false, commandId = null, bypassPark = false,
                       jobEvent = null, cause = "grant" } = {}) {
    class Rollback extends Error { constructor(reason) { super(reason); this.reason = reason; } }
    try {
      return this._tx(() => {
      const job = this._oneOrNull(`SELECT * FROM jobs WHERE job_id = ?`, jobId);
      if (!job) return { ok: false, reason: "job_not_found" };
      const park = this._oneOrNull(
        `SELECT * FROM quota_parks WHERE released_at IS NULL ORDER BY id DESC LIMIT 1`);
      if (park && !bypassPark) return { ok: false, reason: "quota_parked" };
      const now = this._now();
      const day = dayKeyPT(now), month = monthKey(now);
      const attempts = this._attemptsOn(day);
      if (attempts >= DAILY_QUOTA_LIMIT) return { ok: false, reason: "quota_estimate_exhausted" };
      const settings = this._settings();
      const capMicro = Math.round((settings.monthlyCap ?? 50) * 100 * 10000);
      const spent = this._spendIn(month);
      const pending = this._all(
        `SELECT * FROM occurrences WHERE job_id = ? AND state = 'pending' ORDER BY occurrence_id`, jobId);
      const targets = probe ? pending.slice(0, 1) : pending;
      if (targets.length === 0) return { ok: false, reason: "nothing_pending" };
      const est = JSON.parse(job.data_json || "{}").estMicroCents || 0;
      if (spent + est * targets.length > capMicro) return { ok: false, reason: "spending_cap" };
      if (attempts + targets.length > DAILY_QUOTA_LIMIT)
        return { ok: false, reason: "quota_estimate_exhausted" };
      const grantId = `grant:${jobId}:${job.revision}:${probe ? "probe" : "full"}`;
      const dupe = this._oneOrNull(`SELECT grant_id FROM grants WHERE grant_id = ?`, grantId);
      if (dupe) return { ok: false, reason: "grant_exists" };
      this.sql.exec(
        `INSERT INTO grants (grant_id, job_id, revision, state, created_at, lease_expires_at)
         VALUES (?, ?, ?, 'issued', ?, ?)`, grantId, jobId, job.revision, now, now + LEASE_MS);
      for (const o of targets) {
        const r = this.applyOccEvent(jobId, o.occurrence_id, "grant", "grant", { grantId });
        if (!r.ok) throw new Error(`grant transition failed: ${r.reason}`);
        this.sql.exec(
          `INSERT INTO ledger_ops (op_key, at, day_key, month_key, kind, est_micro_cents, detail_json)
           VALUES (?, ?, ?, ?, 'attempt', ?, ?)`,
          `op:${grantId}:${o.occurrence_id}`, now, day, month, est,
          JSON.stringify({ jobId, occurrenceId: o.occurrence_id }));
      }
      this.sql.exec(
        `INSERT INTO outbox (id, kind, payload_json, created_at) VALUES (?, 'dispatch', ?, ?)`,
        grantId, JSON.stringify({ grantId, jobId,
          occurrences: targets.map(o => o.occurrence_id) }), now);
      this._schedule(now + LEASE_MS, "lease", grantId, {});
      if (jobEvent) {
        // The job's own transition commits in the SAME transaction as the
        // grant (§1.1: check -> apply transition -> issue grant, atomically).
        // An illegal transition rolls the whole grant back.
        const jr = this.applyJobEvent(jobId, jobEvent, cause, { grantId });
        if (!jr.ok) throw new Rollback(jr.reason);
        // Delivery-fence baseline (round 4): the grant is valid for the
        // job AS ISSUED, including this grant's own transition. Record
        // the post-transition revision on the grant; any LATER job event
        // (pause, cancel, supersede, a newer operation) advances the
        // job's revision past it and fences the dispatch at drain time.
        const after = this._one(`SELECT revision FROM jobs WHERE job_id = ?`, jobId);
        this.sql.exec(`UPDATE grants SET revision = ? WHERE grant_id = ?`,
          after.revision, grantId);
      }
      return { ok: true, grantId, count: targets.length };
      });
    } catch (e) {
      if (e instanceof Rollback) return { ok: false, reason: e.reason };
      throw e;
    }
  }

  // After a SAFE void (the dispatch provably never left and its
  // occurrences returned to pending), a generating job must advance
  // again WITHOUT a device (round 5, Rowan qualification B): enqueue
  // one bounded retry_grant. Park/cap/quota are re-checked by the
  // grant gate itself when the retry fires; a refusal ends the chain
  // (the park/resume machinery owns what happens next), so this can
  // never spin. The retry row is scheduled even while frozen — the
  // retry_grant handler itself defers under a freeze — so exactly one
  // durable deferred retry survives any freeze/thaw (round 6, race 2)
  // instead of being silently dropped here. Paused/cancelled jobs get
  // nothing: resume owns their continuation.
  _scheduleReAdvance(jobId) {
    if (!jobId) return;
    const job = this._oneOrNull(`SELECT * FROM jobs WHERE job_id = ?`, jobId);
    if (!job || job.state !== "generating") return;
    const existing = this._one(
      `SELECT COUNT(*) AS n FROM schedule WHERE kind = 'retry_grant' AND ref = ? AND state = 'pending'`,
      jobId);
    if (existing && existing.n > 0) return;
    this._schedule(this._now() + 30000, "retry_grant", jobId, { cause: "void_re_advance" });
  }

  // Executor entry point (called by the command API / plan advancer).
  async requestGrant(jobId, opts = {}) {
    await this.wake();
    const g = this._issueGrant(jobId, { jobEvent: "grant",
      cause: opts.cause || "requestGrant", probe: !!opts.probe });
    await this._armAlarmIfEarlier(); // the new lease may be the earliest work
    return g;
  }

  // Deliver unsent grants (interruption seam ii: a grant committed but
  // never sent is delivered on the next wake, keyed by grant_id so the
  // send is idempotent). Delivery is ACKNOWLEDGED (P2 review finding 2):
  // the send function is awaited, and a row is marked sent only after it
  // resolves. A missing handler delivers nothing and marks nothing.
  // Round 5 sharpens the failure side: intent is recorded BEFORE
  // invocation, so a throw, rejection, or crash after invocation leaves
  // the row ATTEMPTED-UNCERTAIN — never re-invoked by a drain, never
  // voided as unsent; handoff reconciliation owns it from there.
  async drainOutbox(send) {
    if (typeof send !== "function") return 0;
    const rows = this._all(`SELECT * FROM outbox WHERE sent_at IS NULL ORDER BY created_at`);
    let sent = 0;
    for (const row of rows) {
      const payload = JSON.parse(row.payload_json);
      // Stop means STOP (P2 review round 2, gap 2): a dispatch queued
      // before a pause/cancel/park/freeze must not produce provider work.
      // Frozen: everything waits, nothing is voided. Paused/cancelled/
      // parked/superseded job: the dispatch is VOIDED — it provably never
      // left (this row is unsent), so its occurrences return to pending
      // and a later resume grants them fresh. Work already delivered is
      // in flight and settles by report; this gate governs only what has
      // not been sent yet.
      if (this._frozen()) continue;
      const job = payload.jobId
        ? this._oneOrNull(`SELECT * FROM jobs WHERE job_id = ?`, payload.jobId) : null;
      const grant = payload.grantId
        ? this._oneOrNull(`SELECT * FROM grants WHERE grant_id = ?`, payload.grantId) : null;
      // Rows belonging to settled grants are debris (round 4): cleared
      // without touching accounting — their spend settled by report.
      if (payload.grantId && (!grant || grant.state === "reported" || grant.state === "voided")) {
        this.sql.exec(`DELETE FROM outbox WHERE id = ?`, row.id);
        this._logTransition("grant", payload.grantId, "dispatch_debris_cleared",
          grant ? grant.state : null, grant ? grant.state : null, null,
          { jobId: payload.jobId });
        continue;
      }
      // Handoff state machine (round 5, Rowan qualification A): a row is
      // NEVER INVOKED (send_attempted_at null — provably unsent), ACKED
      // (sent_at set), or ATTEMPTED-UNCERTAIN (invoked, no ACK recorded:
      // the queue may or may not hold the message). Attempted rows are
      // owned by handoff reconciliation — a drain NEVER re-invokes one,
      // because a blind retry is exactly the duplicate-spend risk.
      if (row.send_attempted_at) continue;
      if (job && ["paused_user", "paused_quota", "cancelled", "superseded"].includes(job.state)) {
        this._tx(() => this._voidDispatch(payload, job.state));
        continue;
      }
      // Delivery fence (round 4, Rowan blocker 1): a dispatch may leave
      // ONLY while its grant is live — state 'issued', issued against the
      // job's CURRENT revision, and inside its delivery window. Anything
      // else is provably unsent work and must never be handed to the
      // provider late: expired/revision-stale grants are voided with
      // their reservations released (the work re-grants fresh).
      if (payload.grantId) {
        if (job && grant.revision !== job.revision) {
          this._tx(() => this._voidDispatch(payload, "revision_stale"));
          continue;
        }
        if (this._now() > grant.lease_expires_at) {
          this._tx(() => this._voidDispatch(payload, "delivery_window_expired"));
          this._scheduleReAdvance(payload.jobId);
          continue;
        }
      }
      // Durable intent BEFORE invocation (round 5): from this write on,
      // the handoff is ATTEMPTED. If the process dies, the ACK is lost,
      // or send rejects, the row can never again be mistaken for
      // never-invoked — it reconciles as uncertain instead of voiding.
      this.sql.exec(`UPDATE outbox SET send_attempted_at = ? WHERE id = ? AND send_attempted_at IS NULL`,
        this._now(), row.id);
      try {
        await send(payload);
      } catch {
        continue; // ACK uncertain: reconciliation owns this row now
      }
      // The ACK arrived. Settle against the grant's CURRENT state: a
      // grant voided or reported while the send was in flight is never
      // reactivated by a late continuation (round 5) — the stray message
      // is governed by the executor's dedupe-by-grantId contract, and
      // the event is logged visibly rather than silently re-arming.
      const settled = payload.grantId
        ? this._oneOrNull(`SELECT * FROM grants WHERE grant_id = ?`, payload.grantId) : null;
      if (payload.grantId && settled &&
          settled.state !== "issued" && settled.state !== "handoff_uncertain") {
        this._logTransition("grant", payload.grantId, "handoff_acked_after_settle",
          settled.state, settled.state, null, { jobId: payload.jobId });
        this.sql.exec(`DELETE FROM outbox WHERE id = ?`, row.id);
        continue;
      }
      this.sql.exec(`UPDATE outbox SET sent_at = ? WHERE id = ?`, this._now(), row.id);
      if (payload.grantId) {
        if (settled && settled.state === "handoff_uncertain") {
          this.sql.exec(`UPDATE grants SET state = 'issued' WHERE grant_id = ?`, payload.grantId);
          this._logTransition("grant", payload.grantId, "handoff_resolved",
            "handoff_uncertain", "issued", null, { via: "late_ack" });
        }
        // The execution lease runs from ACKNOWLEDGED HANDOFF, not from
        // grant creation (round 4): time spent waiting for delivery —
        // a broken queue, a backlog — consumes none of it. Supersede
        // the creation-anchored lease row with a handoff-anchored one.
        const t = this._now();
        this.sql.exec(`UPDATE grants SET lease_expires_at = ? WHERE grant_id = ?`,
          t + LEASE_MS, payload.grantId);
        this.sql.exec(
          `UPDATE schedule SET state = 'void' WHERE kind = 'lease' AND ref = ? AND state = 'pending'`,
          payload.grantId);
        this._schedule(t + LEASE_MS, "lease", payload.grantId, { anchored: "handoff" });
      }
      sent++;
    }
    return sent;
  }

  // Net ledger accounting (round 3, fix 1): an 'attempt' row is a
  // RESERVATION made at grant time, not proof of spend. A dispatch that
  // is voided before it is ever sent never contacted the provider, so
  // its reservation is explicitly RELEASED — a compensating
  // 'attempt_release' row (negative estimate, same day/month keys) that
  // preserves the audit trail while removing the charge from every
  // quota/cap count. Attempts that were actually sent keep counting.
  _attemptsOn(day) {
    return this._one(
      `SELECT (SELECT COUNT(*) FROM ledger_ops WHERE day_key = ? AND kind = 'attempt')
            - (SELECT COUNT(*) FROM ledger_ops WHERE day_key = ? AND kind = 'attempt_release')
         AS n`, day, day).n;
  }
  _spendIn(month) {
    return this._one(
      `SELECT COALESCE(SUM(est_micro_cents), 0) AS s FROM ledger_ops
        WHERE month_key = ? AND kind IN ('attempt', 'attempt_release')`, month).s;
  }

  // `reason` records WHY the dispatch is being voided: a job state
  // (paused_user / paused_quota / cancelled / superseded) or a round-4
  // delivery-fence cause (lease_expired_undelivered /
  // delivery_window_expired / revision_stale). Every path through here
  // shares one property: the dispatch provably never left, so its
  // reservations are released and its occurrences return to pending.
  _voidDispatch(payload, reason, opts = {}) {
    const jobState = reason;
    const grantId = payload.grantId;
    // P3 review fix (Rowan): a void NEVER rewrites the acceptance
    // ledger. There is no claimed -> closed transition: a claimed
    // dispatch was accepted — possibly with spend in flight — and
    // marking it closed would make probeVerdict swear a terminal
    // "never accepted" that may be false. A NEVER-claimed grant needs
    // no row here either: claimGrant maps a voided grant to a
    // 'closed' ANSWER at claim time, which is the only way a closed
    // row is ever written for it.
    // P3 round 2 (Rowan): the void itself is fenced the same way —
    // a CLAIMED grant is not voided at all (its reservations are not
    // released and its work is not re-granted out from under a live
    // consumer), unless the caller explicitly owns that semantics:
    // the evidenced Batch never-accepted resolution, whose claim is
    // preserved and whose re-attempt is generation-fenced. The
    // handoff path never passes this flag — it resolves claimed
    // grants as accepted instead (claim fence, handoff_check).
    if (!opts.claimedOk) {
      const claim = this._oneOrNull(`SELECT * FROM claims WHERE grant_id = ?`, grantId);
      if (claim && claim.state === "claimed") {
        this._logTransition("grant", grantId, "void_refused_claimed",
          null, null, null, { reason, claimedBy: claim.consumer_id });
        return false;
      }
    }
    const ops = this._all(
      `SELECT * FROM ledger_ops WHERE kind = 'attempt' AND op_key LIKE ?`,
      `op:${grantId}:%`);
    for (const op of ops) {
      // Release this attempt's reservation exactly once: the provider
      // was never contacted for it, so it must not consume quota or cap.
      const relKey = `rel:${op.op_key}`;
      if (!this._oneOrNull(`SELECT op_key FROM ledger_ops WHERE op_key = ?`, relKey)) {
        const d = JSON.parse(op.detail_json || "{}");
        this.sql.exec(
          `INSERT INTO ledger_ops (op_key, at, day_key, month_key, kind, est_micro_cents, detail_json)
           VALUES (?, ?, ?, ?, 'attempt_release', ?, ?)`,
          relKey, this._now(), op.day_key, op.month_key, -op.est_micro_cents,
          JSON.stringify({ jobId: payload.jobId, occurrenceId: d.occurrenceId || null,
                           grantId, released: "dispatch_voided", jobState,
                           voidReason: reason }));
      }
      const oid = JSON.parse(op.detail_json || "{}").occurrenceId;
      if (!oid) continue;
      const o = this._oneOrNull(
        `SELECT * FROM occurrences WHERE job_id = ? AND occurrence_id = ?`, payload.jobId, oid);
      if (o && o.state === "granted")
        this.applyOccEvent(payload.jobId, oid, "defer", "dispatch_voided",
          { grantId, jobState });
    }
    this.sql.exec(`UPDATE grants SET state = 'voided' WHERE grant_id = ?`, grantId);
    this.sql.exec(
      `UPDATE schedule SET state = 'void' WHERE kind = 'lease' AND ref = ? AND state = 'pending'`,
      grantId);
    this.sql.exec(`DELETE FROM outbox WHERE id = ?`, grantId);
    this._logTransition("grant", grantId, "dispatch_voided", "issued", "voided", null,
      { jobId: payload.jobId, jobState, voidReason: reason });
  }

  // Dispatch-time annotation: the executor records the provider request
  // identity into the ledger the moment it dispatches. A request ID is
  // evidence the request was ATTEMPTED — it is NOT proof the provider
  // completed or charged it (round 3, fix 3), so on its own it never
  // justifies calling the occurrence spent.
  noteProviderRequest(grantId, occurrenceId, providerRequestId) {
    const opKey = `op:${grantId}:${occurrenceId}`;
    const row = this._oneOrNull(`SELECT * FROM ledger_ops WHERE op_key = ?`, opKey);
    if (!row) return { ok: false, reason: "op_not_found" };
    const detail = { ...(JSON.parse(row.detail_json || "{}")), providerRequestId };
    this.sql.exec(`UPDATE ledger_ops SET detail_json = ? WHERE op_key = ?`,
      JSON.stringify(detail), opKey);
    return { ok: true };
  }

  // Provider-OUTCOME annotation: the executor records a CONFIRMED
  // terminal provider outcome (with its evidence) when the provider's
  // own record settles what happened to a dispatched request — e.g. a
  // request-status lookup showing the request failed or completed
  // without producing audio. Only a confirmed outcome recorded here can
  // support reconciliation's spent-without-audio exit.
  noteProviderOutcome(grantId, occurrenceId, outcome, evidence = null) {
    if (!["failed", "spent_without_audio"].includes(outcome))
      return { ok: false, reason: "unknown_provider_outcome" };
    const opKey = `op:${grantId}:${occurrenceId}`;
    const row = this._oneOrNull(`SELECT * FROM ledger_ops WHERE op_key = ?`, opKey);
    if (!row) return { ok: false, reason: "op_not_found" };
    const detail = { ...(JSON.parse(row.detail_json || "{}")),
                     providerOutcome: outcome, providerEvidence: evidence };
    this.sql.exec(`UPDATE ledger_ops SET detail_json = ? WHERE op_key = ?`,
      JSON.stringify(detail), opKey);
    return { ok: true };
  }

  // ---- executor reports ----------------------------------------------------
  // Applied transactionally against the grant. A report citing a stale
  // job revision is rejected for state purposes; its audio is still
  // adoptable through bindings (content-addressed audio is never wasted).
  async handleReport(report) {
    if (!report || !report.grantId) return { ok: false, reason: "grant_required" };
    await this.wake();
    const result = this._tx(() => {
      const grant = this._oneOrNull(`SELECT * FROM grants WHERE grant_id = ?`, report.grantId);
      if (!grant) return { ok: false, reason: "grant_not_found" };
      if (grant.state === "reported")
        return { ok: true, replayed: true };
      if (grant.state === "handoff_uncertain") {
        // A report IS handoff proof (round 5): the executor could only
        // report on a dispatch it received. Resolve the uncertainty
        // before applying results; the grant closes as reported below.
        this.sql.exec(`UPDATE outbox SET sent_at = ? WHERE id = ? AND sent_at IS NULL`,
          this._now(), grant.grant_id);
        this._logTransition("grant", grant.grant_id, "handoff_resolved",
          "handoff_uncertain", "issued", null, { via: "executor_report" });
      }
      const job = this._oneOrNull(`SELECT * FROM jobs WHERE job_id = ?`, grant.job_id);
      if (!job) return { ok: false, reason: "job_not_found" };
      if (report.jobRevision !== undefined && report.jobRevision !== job.revision) {
        this._logTransition("job", job.job_id, "report", job.state, job.state, job.revision,
          { rejected: "report", reason: "stale_revision", grantId: grant.grant_id });
        return { ok: false, reason: "stale_revision" };
      }
      let blocked = 0, failed = 0, ready = 0;
      for (const res of report.results || []) {
        if (res.outcome === "success") {
          const v = this.validateAndBind({
            occurrenceId: res.occurrenceId, revisionKey: res.revisionKey,
            cacheKey: res.cacheKey, provenance: "grant:" + grant.grant_id,
            jobId: grant.job_id, expectedSha256: res.sha256 || null });
          if (v.bound) {
            this.sql.exec(`UPDATE occurrences SET cache_key = ? WHERE job_id = ? AND occurrence_id = ?`,
              res.cacheKey, grant.job_id, res.occurrenceId);
            this.applyOccEvent(grant.job_id, res.occurrenceId, "report_success", "report", { grantId: grant.grant_id });
            ready++;
          } else {
            // The executor claimed success but the audio cannot be
            // validated: the dispatch's outcome is genuinely UNPROVEN
            // (§1.2 rule 4). It enters outcome_unknown — whose exits are
            // all reconciliation paths — never ready, and never parked in
            // 'granted' behind a reported grant (P2 review finding 1:
            // the lease handler skips reported grants, so a granted limbo
            // here would be a forever-stuck occurrence).
            this.applyOccEvent(grant.job_id, res.occurrenceId, "report_unvalidated", "report",
              { grantId: grant.grant_id, binding_rejected: v.reason, cacheKey: res.cacheKey });
          }
        } else if (res.outcome === "policy_block") {
          this.applyOccEvent(grant.job_id, res.occurrenceId, "report_blocked", "report",
            { grantId: grant.grant_id, evidence: res.evidence || null });
          blocked++;
        } else if (res.outcome === "daily_limit") {
          // F5: a park requires provider daily-limit EVIDENCE, recorded
          // verbatim. Occurrences not yet attempted stay pending.
          this.sql.exec(`INSERT INTO quota_parks (parked_at, evidence_json) VALUES (?, ?)`,
            this._now(), JSON.stringify(res.evidence || {}));
          this.applyOccEvent(grant.job_id, res.occurrenceId, "defer", "report:daily_limit",
            { grantId: grant.grant_id, deferred: "daily_limit", evidence: res.evidence || null });
          this.applyJobEvent(grant.job_id, "park", "report:daily_limit",
            { grantId: grant.grant_id, evidence: res.evidence || null });
        } else if (res.outcome === "rate_limited") {
          // Generic 429 = weather (B5): bounded backoff via a plan step,
          // never a park. The occurrence returns to pending.
          this.applyOccEvent(grant.job_id, res.occurrenceId, "defer", "report:rate_limited",
            { grantId: grant.grant_id, backoff: true });
          this._schedule(this._now() + 30000, "retry_grant", grant.job_id, { cause: "rate_limited" });
        } else {
          this.applyOccEvent(grant.job_id, res.occurrenceId, "report_failed", "report",
            { grantId: grant.grant_id, error: res.error || "failed" });
          failed++;
        }
      }
      // A report closes its grant: any occurrence this grant dispatched
      // but the report does not mention returns to pending NOW (the
      // executor's report is the grant's final word — it was either not
      // attempted, or the daily-limit ended the run). The lease path is
      // reserved for reports that never arrive at all.
      const reportedIds = new Set((report.results || []).map(r => r.occurrenceId));
      const grantOps = this._all(
        `SELECT detail_json FROM ledger_ops WHERE kind = 'attempt' AND op_key LIKE ?`,
        `op:${grant.grant_id}:%`);
      for (const op of grantOps) {
        const oid = JSON.parse(op.detail_json || "{}").occurrenceId;
        if (!oid || reportedIds.has(oid)) continue;
        const o = this._oneOrNull(
          `SELECT * FROM occurrences WHERE job_id = ? AND occurrence_id = ?`, grant.job_id, oid);
        if (o && o.state === "granted")
          this.applyOccEvent(grant.job_id, oid, "defer", "report:grant_closed",
            { grantId: grant.grant_id });
      }
      this.sql.exec(`UPDATE grants SET state = 'reported', report_json = ? WHERE grant_id = ?`,
        JSON.stringify(report), grant.grant_id);
      // P3: a reported grant's claim is completed (acceptance ledger).
      this._completeClaim(grant.grant_id);
      // Job-level completion derivation for this grant's job (shared).
      this._deriveJobCompletion(grant.job_id, "report");
      // A successful probe is the evidence that the provider day reset:
      // it releases the account-wide park (F5; never a clock does this, B6).
      if (grant.grant_id.endsWith(":probe") && ready > 0) {
        this.sql.exec(`UPDATE quota_parks SET released_at = ?, release_cause = 'probe_success'
                       WHERE released_at IS NULL`, this._now());
      }
      // B7/F6: a repair plan that finishes with eligible blocked
      // occurrences remaining spawns its follow-on plan server-side —
      // the chain advances with no client present.
      const jobRow = this._oneOrNull(`SELECT * FROM jobs WHERE job_id = ?`, grant.job_id);
      const followOn = report.detail && report.detail.followOn;
      if (jobRow && jobRow.kind === "repair" &&
          (jobRow.state === "complete" || jobRow.state === "partial") &&
          followOn && Array.isArray(followOn.occurrences) && followOn.occurrences.length > 0) {
        const prior = this._one(
          `SELECT COUNT(*) AS n FROM jobs WHERE job_id LIKE ?`, grant.job_id + ":follow:%").n;
        const followId = `${grant.job_id}:follow:${prior + 1}`;
        const sub = this._submitJob({
          jobId: followId, bookId: jobRow.book_id, chapterIndex: jobRow.chapter_index,
          lane: jobRow.lane, occurrences: followOn.occurrences,
          data: { ...(JSON.parse(jobRow.data_json || "{}")), chainParent: grant.job_id },
        }, "repair_chain", "repair");
        if (sub.outcome === "applied") {
          this._logTransition("job", followId, "repair_chain", null, "queued", 1,
            { parent: grant.job_id });
          // The chain ADVANCES, not just queues (P2 review finding 5): the
          // follow-on is granted in the same transaction. A refusal
          // (park/cap/quota) leaves it queued for the plan advancer —
          // the report itself is unaffected either way.
          this._issueGrant(followId, { jobEvent: "grant", cause: "repair_chain" });
        }
      }
      return { ok: true, ready, blocked, failed };
    });
    await this._armAlarmIfEarlier(); // a retry/lease from this report may be earliest
    return result;
  }

  // ---- audio bindings + conflict validation (Rowan criterion 2) -----------
  // A create-if-absent conflict NEVER silently overwrites and NEVER binds
  // on faith: the survivor's recorded identity/format is checked against
  // the occurrence's revision first. Unresolvable discrepancies stay
  // visible (binding_conflicts) and unbound.
  // `probe` is injected (env.probe in production = the R2/cache layer;
  // a stub in tests): { exists(cacheKey), sniff(cacheKey), recordedIdentity(cacheKey) }
  validateAndBind({ occurrenceId, revisionKey, cacheKey, provenance = null, jobId = null,
                    expectedSha256 = null }) {
    const probe = this.env.probe;
    const conflict = (expected, found, reason) => {
      this.sql.exec(
        `INSERT INTO binding_conflicts (at, occurrence_id, cache_key, expected, found, reason)
         VALUES (?, ?, ?, ?, ?, ?)`,
        this._now(), occurrenceId, cacheKey, expected, found, reason);
      return { bound: false, reason, expected, found };
    };
    if (!probe || !probe.exists(cacheKey))
      return { bound: false, reason: "object_missing" };
    const fmt = probe.sniff ? probe.sniff(cacheKey) : null;
    if (!fmt) return conflict(revisionKey, null, "format_invalid");
    // Byte-level verification (P2 review finding 3 + round 2 gap 3 +
    // round 3 fix 2): metadata agreement is not content agreement, and
    // for NEW recordings a verified digest is MANDATORY — a missing
    // hash no longer passes. EVERY available authoritative digest must
    // agree with the bytes actually present: the coordinator's own
    // cache index (anchored at an earlier bind), the storage layer's
    // write-time record, AND any caller-stated expected hash. A stated
    // hash that matches the current bytes does NOT excuse a prior
    // anchored digest that disagrees — bytes silently swapped under an
    // old key are a conflict, never a fresh success — and the
    // existing-binding idempotent return runs only AFTER these checks,
    // never instead of them. Legacy revisions keep their documented
    // uncertainty about identity provenance, but a KNOWN digest is never
    // ignored for them either.
    const actualSha = probe.hash ? probe.hash(cacheKey) : null;
    const idx = this._oneOrNull(`SELECT * FROM cache_index WHERE cache_key = ?`, cacheKey);
    const isLegacy = typeof revisionKey === "string" && revisionKey.startsWith("legacy:");
    const idxSha = (idx && idx.sha256) || null;
    const writeSha = probe.recordedSha256 ? probe.recordedSha256(cacheKey) : null;
    if (idxSha && writeSha && idxSha !== writeSha)
      return conflict(idxSha, writeSha, "content_hash_mismatch");
    const recordedSha = idxSha || writeSha;
    for (const stated of [recordedSha, expectedSha256]) {
      if (stated && actualSha !== stated)
        return conflict(stated, actualSha, "content_hash_mismatch");
    }
    const existing = this._oneOrNull(
      `SELECT * FROM bindings WHERE occurrence_id = ? AND revision_key = ?`,
      occurrenceId, revisionKey);
    if (existing && existing.cache_key === cacheKey)
      return { bound: true, idempotent: true, cacheKey };
    if (existing && existing.cache_key !== cacheKey)
      return conflict(revisionKey, existing.cache_key, "binding_conflict_existing");
    if (!expectedSha256 && !isLegacy && !recordedSha)
      return conflict(null, actualSha, "digest_unverified");
    // The survivor's recorded identity: the coordinator's own cache index
    // (written on every bind it has ever made) wins; the storage probe's
    // record is the fallback for objects that predate the coordinator.
    const recorded = (idx && idx.identity) ||
      (probe.recordedIdentity ? probe.recordedIdentity(cacheKey) : null);
    if (recorded && !isLegacy && recorded !== revisionKey)
      return conflict(revisionKey, recorded, "identity_mismatch");
    if (isLegacy && revisionKey !== `legacy:${cacheKey}`)
      return conflict(revisionKey, recorded, "legacy_anchor_mismatch");
    this.sql.exec(
      `INSERT INTO bindings (occurrence_id, revision_key, cache_key, provenance, bound_at)
       VALUES (?, ?, ?, ?, ?)`, occurrenceId, revisionKey, cacheKey, provenance, this._now());
    this.sql.exec(
      `INSERT INTO cache_index (cache_key, identity, format, sha256, recorded_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(cache_key) DO UPDATE SET identity = COALESCE(cache_index.identity, excluded.identity),
         format = excluded.format, sha256 = COALESCE(cache_index.sha256, excluded.sha256),
         recorded_at = excluded.recorded_at`,
      cacheKey, isLegacy ? null : revisionKey, fmt, actualSha, this._now());
    return { bound: true, cacheKey };
  }

  // ---- outcome_unknown reconciliation (§1.2 rule 4) --------------------------
  // The ONLY exits from outcome_unknown. Re-dispatch is not one of them.
  reconcileUnknown(jobId, occurrenceId) {
    return this._tx(() => {
      const occ = this._oneOrNull(
        `SELECT * FROM occurrences WHERE job_id = ? AND occurrence_id = ?`, jobId, occurrenceId);
      if (!occ || occ.state !== "outcome_unknown")
        return { ok: false, reason: "not_unknown" };
      // (a) the deterministic cache key exists -> adopt by binding.
      const candidate = this.env.probe && this.env.probe.keyFor
        ? this.env.probe.keyFor(occ) : null;
      if (candidate) {
        const v = this.validateAndBind({
          occurrenceId, revisionKey: occ.revision_key, cacheKey: candidate,
          provenance: "reconcile:cache", jobId });
        if (v.bound) {
          this.sql.exec(`UPDATE occurrences SET cache_key = ? WHERE job_id = ? AND occurrence_id = ?`,
            candidate, jobId, occurrenceId);
          const r = this.applyOccEvent(jobId, occurrenceId, "reconcile_adopt", "reconcile", { cacheKey: candidate });
          if (r.ok) { this._maybeResolveJob(jobId); return { ok: true, exit: "adopted", cacheKey: candidate }; }
        }
      }
      // (b) a CONFIRMED provider outcome recorded against the EXACT
      // grant that made this occurrence unknown -> spent, visible.
      // Evidence is never borrowed (round 4, Rowan blocker 2): the
      // source grant is read from THIS occurrence's own latest
      // transition into outcome_unknown (both entry paths — lease
      // expiry and unvalidated report — record their grantId), the
      // grant must belong to THIS job, and the attempt row is fetched
      // by its exact op key. No pattern matching over other jobs' or
      // other grants' ledger rows. A dispatch record (providerRequestId)
      // alone is only an attempt: it never proves the provider
      // completed or charged the request, so without a confirmed
      // outcome the occurrence stays outcome_unknown below — visible,
      // and never auto-replayed.
      const entry = this._oneOrNull(
        `SELECT detail_json FROM transitions
          WHERE aggregate = 'occurrence' AND aggregate_id = ? AND to_state = 'outcome_unknown'
          ORDER BY id DESC LIMIT 1`, `${jobId}/${occurrenceId}`);
      const sourceGrantId = entry
        ? (JSON.parse(entry.detail_json || "{}").grantId || null) : null;
      const sourceGrant = sourceGrantId
        ? this._oneOrNull(`SELECT * FROM grants WHERE grant_id = ?`, sourceGrantId) : null;
      const spend = (sourceGrant && sourceGrant.job_id === jobId)
        ? this._oneOrNull(`SELECT * FROM ledger_ops WHERE op_key = ?`,
            `op:${sourceGrantId}:${occurrenceId}`)
        : null;
      if (spend) {
        const d = JSON.parse(spend.detail_json || "{}");
        if (d.providerRequestId &&
            (d.providerOutcome === "failed" || d.providerOutcome === "spent_without_audio")) {
          const r = this.applyOccEvent(jobId, occurrenceId, "reconcile_spent", "reconcile",
            { providerRequestId: d.providerRequestId, providerOutcome: d.providerOutcome,
              providerEvidence: d.providerEvidence ?? null,
              spent_without_audio: true, visible_to_user: true });
          if (r.ok) { this._maybeResolveJob(jobId); return { ok: true, exit: "spent_without_audio" }; }
        }
      }
      // (c) neither -> stays outcome_unknown, surfaced to Julie (F7).
      return { ok: true, exit: "still_unknown" };
    });
  }

  _resolveUnknown(p, commandId) {
    // Julie's explicit authorization of a fresh synthesis (§1.2 rule 4c):
    // the occurrence returns to pending under a NEW operation identity.
    const r = this._tx(() => {
      const occ = this._oneOrNull(
        `SELECT * FROM occurrences WHERE job_id = ? AND occurrence_id = ?`, p.jobId, p.occurrenceId);
      if (!occ || occ.state !== "outcome_unknown")
        return { outcome: "rejected", reason: "not_unknown" };
      const a = this.applyOccEvent(p.jobId, p.occurrenceId, "resolve_resynthesize",
        "ResolveOutcomeUnknown", { commandId, authorized_by: "user" });
      if (!a.ok) return { outcome: "rejected", reason: a.reason };
      const j = this.applyJobEvent(p.jobId, "resolve", "ResolveOutcomeUnknown", { commandId });
      return j.ok ? { outcome: "applied", state: j.state }
                  : { outcome: "rejected", reason: j.reason };
    });
    return r;
  }

  // The single job-completion derivation, shared by report application,
  // reconciliation, and resume (P2 review round 2, gap 4): whenever an
  // occurrence set settles, the job lands in its TRUE state — including
  // 'complete' when a reconciliation made every occurrence ready.
  _deriveJobCompletion(jobId, cause) {
    const counts = this._one(
      `SELECT
         SUM(state = 'ready') AS ready,
         SUM(state = 'blocked_policy') AS blocked,
         SUM(state = 'failed') AS failed,
         SUM(state IN ('pending','granted')) AS open,
         SUM(state = 'outcome_unknown') AS unknown,
         COUNT(*) AS total
       FROM occurrences WHERE job_id = ?`, jobId);
    if (counts.unknown > 0) return this.applyJobEvent(jobId, "unknown", cause, {});
    if (counts.open > 0) {
      const job = this._oneOrNull(`SELECT * FROM jobs WHERE job_id = ?`, jobId);
      if (job && job.state === "outcome_unknown")
        return this.applyJobEvent(jobId, "resolve", cause, {});
      return { ok: true, state: job ? job.state : null };
    }
    if (counts.ready === counts.total)
      return this.applyJobEvent(jobId, "report_complete", cause, {});
    if (counts.ready > 0)
      return this.applyJobEvent(jobId, "report_partial", cause, {});
    if (counts.blocked > 0 || counts.failed > 0)
      return this.applyJobEvent(jobId, "report_failed", cause, {});
    return { ok: true };
  }

  _maybeResolveJob(jobId) { return this._deriveJobCompletion(jobId, "reconcile"); }

  // ---- settings aggregate ----------------------------------------------------
  _settings() {
    const row = this._oneOrNull(`SELECT * FROM settings WHERE id = 1`);
    if (!row) return { monthlyCap: 50, geminiLane: "batch", revision: 0 };
    return { ...JSON.parse(row.data_json), revision: row.revision };
  }

  _setSettings(p, commandId) {
    const cur = this._oneOrNull(`SELECT * FROM settings WHERE id = 1`);
    const curRev = cur ? cur.revision : 0;
    if (p.baseRevision !== undefined && p.baseRevision !== curRev)
      return { outcome: "rejected", reason: "settings_conflict", revision: curRev };
    const data = { ...(cur ? JSON.parse(cur.data_json) : { monthlyCap: 50, geminiLane: "batch" }),
                   ...(p.data || {}) };
    const revision = curRev + 1;
    this.sql.exec(
      `INSERT INTO settings (id, revision, data_json) VALUES (1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET revision = excluded.revision, data_json = excluded.data_json`,
      revision, JSON.stringify(data));
    this._logTransition("settings", "settings", "SetSettings",
      null, null, revision, { commandId });
    // P4: settings is a sync family — every applied update lands in
    // the change history + entity mirror in this same transaction,
    // so devices pull settings as deltas and converge detectably.
    this._appendChange("settings", "settings", null, revision, "upsert", data);
    this.sql.exec(
      `INSERT INTO sync_entities (family, entity_key, book_id, revision, deleted, data_json)
       VALUES ('settings', 'settings', NULL, ?, 0, ?)
       ON CONFLICT(family, entity_key) DO UPDATE SET revision = excluded.revision,
         deleted = 0, data_json = excluded.data_json`,
      revision, JSON.stringify(data));
    return { outcome: "applied", revision, data };
  }

  // ---- durable schedule + alarm watchdog chain (Rowan criterion 1) ----------
  _schedule(dueAt, kind, ref, payload) {
    this.sql.exec(
      `INSERT INTO schedule (due_at, kind, ref, payload_json) VALUES (?, ?, ?, ?)`,
      dueAt, kind, ref, JSON.stringify(payload || {}));
  }

  // Cloudflare's alarm API is asynchronous: getAlarm() and setAlarm()
  // return Promises. These MUST be awaited — treating a Promise as the
  // armed timestamp would read as "armed" forever and silently kill the
  // chain (P2 review finding 5).
  async _armAlarm() {
    const next = this._one(
      `SELECT MIN(due_at) AS due FROM schedule WHERE state = 'pending'`);
    const due = next && next.due !== null ? next.due : this._now() + WATCHDOG_PERIOD_MS;
    await this.state.storage.setAlarm(due);
  }

  // Called on every coordinator wake: if the chain is unarmed (alarm
  // consumed and handler died, retries exhausted, fresh start), re-arm it.
  // Recovery never requires a client — any wake (command, report, alarm)
  // re-establishes the chain, and the chain itself is self-perpetuating.
  async wake() {
    const wd = this._one(
      `SELECT COUNT(*) AS n FROM schedule WHERE state = 'pending' AND kind = 'watchdog'`);
    if (!wd || wd.n === 0) this._schedule(this._now() + WATCHDOG_PERIOD_MS, "watchdog", null, {});
    await this._armAlarmIfEarlier();
  }

  // Arm the alarm at the earliest pending work if it is sooner than the
  // currently armed time (or nothing is armed) — newly scheduled earlier
  // work must ADVANCE the alarm, not wait for it (P2 review round 2,
  // gap 5). Entry points call this after their writes commit.
  async _armAlarmIfEarlier() {
    const armed = await this.state.storage.getAlarm();
    const next = this._one(
      `SELECT MIN(due_at) AS due FROM schedule WHERE state = 'pending'`);
    const due = next && next.due !== null ? next.due : this._now() + WATCHDOG_PERIOD_MS;
    if (armed === null || armed === undefined || due < armed)
      await this.state.storage.setAlarm(due);
  }

  async alarm() {
    try {
      const now = this._now();
      const due = this._all(
        `SELECT * FROM schedule WHERE state = 'pending' AND due_at <= ? ORDER BY due_at`, now);
      for (const row of due) {
        try {
          await this._processScheduleRow(row);
          this.sql.exec(`UPDATE schedule SET state = 'done' WHERE id = ?`, row.id);
        } catch (e) {
          // A poison row backs off and eventually parks as a VISIBLE dead
          // row; it can never kill the chain or starve other rows.
          const attempts = row.attempts + 1;
          if (attempts >= SCHEDULE_MAX_ATTEMPTS) {
            this.sql.exec(`UPDATE schedule SET state = 'dead', attempts = ? WHERE id = ?`, attempts, row.id);
            this.sql.exec(
              `INSERT INTO binding_conflicts (at, occurrence_id, cache_key, expected, found, reason)
               VALUES (?, ?, ?, ?, ?, 'schedule_dead')`,
              now, row.ref, row.kind, String(row.attempts), String(e && e.message || e));
          } else {
            const backoff = Math.min(30000 * 2 ** attempts, 900000);
            this.sql.exec(`UPDATE schedule SET attempts = ?, due_at = ? WHERE id = ?`,
              attempts, now + backoff, row.id);
          }
        }
      }
    } finally {
      // The chain re-arms UNCONDITIONALLY — even if every row threw.
      const wd = this._one(
        `SELECT COUNT(*) AS n FROM schedule WHERE state = 'pending' AND kind = 'watchdog'`);
      if (!wd || wd.n === 0) this._schedule(this._now() + WATCHDOG_PERIOD_MS, "watchdog", null, {});
      await this._armAlarm();
    }
  }

  async _processScheduleRow(row) {
    const payload = JSON.parse(row.payload_json || "{}");
    if (this.env.scheduleHook) this.env.scheduleHook(row, payload); // fault-injection seam (tests)
    switch (row.kind) {
      case "watchdog": {
        // Re-assert the chain + deliver any grants whose send was lost.
        // A missing delivery handler is NOT a delivery: the outbox rows
        // stay unsent and visible rather than being marked sent.
        if (typeof this.env.sendGrant === "function")
          await this.drainOutbox(this.env.sendGrant);
        break;
      }
      case "lease": {
        // Lease expiry (interruption seam iii): occurrences still granted
        // under this grant become outcome_unknown — NEVER re-dispatched.
        // Recovery then attempts SAFE reconciliation immediately, with
        // no device involved (gap 4): adopt from the cache if the audio
        // provably landed, or record the spend ONLY on a confirmed
        // provider outcome (a dispatch record alone proves nothing).
        // Whatever cannot be proven stays outcome_unknown for Julie.
        const grant = this._oneOrNull(`SELECT * FROM grants WHERE grant_id = ?`, row.ref);
        if (!grant || grant.state === "reported" || grant.state === "voided") break;
        // Pre-delivery expiry (round 4, Rowan blocker 1): provider
        // uncertainty may be inferred ONLY for work provably handed
        // off. Delivery is proven by the outbox row's sent_at — the
        // acknowledged handoff. A grant whose dispatch never left has
        // NO unknown outcome to record: void the dispatch, release its
        // reservations, and return its occurrences to pending so the
        // work can be granted fresh. No phantom outcome_unknown, ever.
        const outRow = this._oneOrNull(`SELECT * FROM outbox WHERE id = ?`, grant.grant_id);
        if (!outRow || !outRow.sent_at) {
          if (this._frozen()) {
            // A freeze holds EVERYTHING, including this decision:
            // re-check shortly after thaw instead of voiding mid-freeze.
            // The deferral TOLLS the delivery window — the grant's
            // lease_expires_at moves with the rescheduled row, so a
            // dispatch delivered right after thaw is still in-window
            // for the drain-time fence.
            const tolled = this._now() + 60000;
            this.sql.exec(`UPDATE grants SET lease_expires_at = ? WHERE grant_id = ?`,
              tolled, grant.grant_id);
            this._schedule(tolled, "lease", grant.grant_id, { deferred: "frozen" });
            break;
          }
          if (outRow && outRow.send_attempted_at) {
            // ATTEMPTED, ACK UNCERTAIN (round 5, Rowan qualification A):
            // the send was invoked but no ACK was recorded — the queue
            // may already hold this message. "Not ACKed" is NOT "never
            // left": nothing is voided, no reservation is released, no
            // re-grant is possible (the occurrences stay granted), and
            // the uncertainty is a VISIBLE grant state, resolved only
            // by the queue-acceptance probe (handoff_check) or by the
            // executor's report — never by assumption.
            if (grant.state !== "handoff_uncertain") {
              this.sql.exec(`UPDATE grants SET state = 'handoff_uncertain' WHERE grant_id = ?`,
                grant.grant_id);
              this._logTransition("grant", grant.grant_id, "handoff_uncertain",
                grant.state, "handoff_uncertain", null, { jobId: grant.job_id });
              this._schedule(this._now() + 30000, "handoff_check", grant.grant_id, { tries: 0 });
            }
            break;
          }
          if (outRow) {
            // NEVER INVOKED: provably unsent — the round-4 safe void,
            // and the job re-advances on its own (round 5, B).
            this._tx(() => this._voidDispatch(
              { grantId: grant.grant_id, jobId: grant.job_id },
              "lease_expired_undelivered"));
            this._scheduleReAdvance(grant.job_id);
          } else {
            // No outbox row at all: nothing was ever deliverable, so
            // nothing was sent — retire the grant outright.
            this.sql.exec(`UPDATE grants SET state = 'voided' WHERE grant_id = ?`,
              grant.grant_id);
            this._logTransition("grant", grant.grant_id, "lease_expired_undelivered",
              grant.state, "voided", null, { jobId: grant.job_id, outbox: "absent" });
          }
          break;
        }
        const occs = this._all(
          `SELECT * FROM occurrences WHERE job_id = ? AND state = 'granted'`, grant.job_id);
        const grantOps = this._all(
          `SELECT detail_json FROM ledger_ops WHERE kind = 'attempt' AND op_key LIKE ?`,
          `op:${grant.grant_id}:%`);
        const grantedIds = new Set(grantOps.map(r => JSON.parse(r.detail_json || "{}").occurrenceId));
        const newlyUnknown = [];
        for (const o of occs) {
          if (!grantedIds.has(o.occurrence_id)) continue;
          const r = this.applyOccEvent(grant.job_id, o.occurrence_id, "lease_expired",
            "lease_expiry", { grantId: grant.grant_id });
          if (r.ok) newlyUnknown.push(o.occurrence_id);
        }
        if (newlyUnknown.length > 0)
          this.applyJobEvent(grant.job_id, "unknown", "lease_expiry", { grantId: grant.grant_id });
        for (const oid of newlyUnknown) this.reconcileUnknown(grant.job_id, oid);
        break;
      }
      case "retry_grant": {
        // Bounded-backoff continuation after generic 429s / plan steps /
        // safe voids (round 5, B). A freeze defers it like everything
        // else; a refusal by the grant gate (park, cap, quota, nothing
        // pending) ends the chain — no self-rescheduling, no spin.
        const job = this._oneOrNull(`SELECT * FROM jobs WHERE job_id = ?`, row.ref);
        if (job && this._frozen()) {
          this._schedule(this._now() + 60000, "retry_grant", row.ref,
            { ...payload, deferred: "frozen" });
          break;
        }
        if (job && job.state === "generating") await this.requestGrant(row.ref, { cause: "retry_grant" });
        break;
      }
      case "handoff_check": {
        // Queue-acceptance reconciliation (round 5, A): the ONLY
        // arbiter of an attempted-but-unacknowledged handoff is the
        // queue's own record for this grantId. "accepted" completes
        // the handoff (lease anchors to the confirmation); "not_
        // accepted" proves the message never landed, so the round-4
        // safe void finally applies; "unknown" (or no probe wired)
        // keeps the uncertainty visible and backs off, bounded.
        // P3 CONTRACT for the real queue probe: "not_accepted" must be
        // TERMINAL proof — the queue guarantees this grantId can never
        // be accepted after the verdict (its acceptance ledger is
        // final for the grant), never merely "not seen yet" while a
        // send may still be in flight. Anything short of terminal is
        // "unknown".
        const before = this._oneOrNull(`SELECT * FROM grants WHERE grant_id = ?`, row.ref);
        if (!before || before.state !== "handoff_uncertain") break;
        if (this._frozen()) {
          // A freeze holds this decision too (round 6, race 2): the
          // verdict — and any void it would trigger — waits for thaw,
          // so the re-advance that follows a void is scheduled in the
          // open, never dropped into a freeze and lost.
          this._schedule(this._now() + 60000, "handoff_check", row.ref, payload);
          break;
        }
        let verdict = "unknown";
        if (typeof this.env.probeQueue === "function") {
          try { verdict = await this.env.probeQueue(row.ref); }
          catch { verdict = "unknown"; }
        }
        // The verdict is evidence about the past; it may act ONLY on
        // the CURRENT state, re-read inside one transaction after the
        // await (round 6, race 1): a report or a late ACK can settle
        // the grant while the probe is in flight. A stale verdict is
        // logged and changes nothing — it can neither resurrect a
        // reported grant to 'issued' nor void a delivered one.
        this._tx(() => {
          const grant = this._oneOrNull(`SELECT * FROM grants WHERE grant_id = ?`, row.ref);
          const outRow = this._oneOrNull(`SELECT * FROM outbox WHERE id = ?`, row.ref);
          if (!grant || grant.state !== "handoff_uncertain" || !outRow || outRow.sent_at) {
            this._logTransition("grant", row.ref, "handoff_verdict_stale",
              grant ? grant.state : null, grant ? grant.state : null, null,
              { verdict, jobId: grant ? grant.job_id : null });
            return;
          }
          if (verdict === "accepted") {
            const t = this._now();
            this.sql.exec(`UPDATE outbox SET sent_at = ? WHERE id = ? AND sent_at IS NULL`,
              t, grant.grant_id);
            this.sql.exec(`UPDATE grants SET state = 'issued', lease_expires_at = ? WHERE grant_id = ?`,
              t + LEASE_MS, grant.grant_id);
            this.sql.exec(
              `UPDATE schedule SET state = 'void' WHERE kind = 'lease' AND ref = ? AND state = 'pending'`,
              grant.grant_id);
            this._schedule(t + LEASE_MS, "lease", grant.grant_id, { anchored: "handoff_confirmed" });
            this._logTransition("grant", grant.grant_id, "handoff_resolved",
              "handoff_uncertain", "issued", null, { via: "queue_probe" });
          } else if (verdict === "not_accepted") {
            // THE CLAIM FENCE (P3 round 2, Rowan): before a terminal
            // handoff void/release/re-grant, atomically verify there
            // is NO claimed acceptance for this grant. A claim is
            // stronger evidence than the queue's verdict — a consumer
            // holds the work and may be executing against a spend
            // intent. If a claim exists, the verdict is contradictory/
            // stale: preserve the grant AND its quota accounting, log
            // the contradiction, and reconcile the handoff as ACCEPTED
            // on the claim's own evidence. The execution lease runs
            // from here; an unreported execution ages into
            // outcome-unknown through the normal lease path — never
            // into a void, a false release, and an orphaned report.
            const claim = this._oneOrNull(`SELECT * FROM claims WHERE grant_id = ?`, grant.grant_id);
            if (claim && claim.state === "claimed") {
              const t = this._now();
              this._logTransition("grant", grant.grant_id, "handoff_verdict_contradicts_claim",
                "handoff_uncertain", "handoff_uncertain", null,
                { claimedBy: claim.consumer_id, claimedAt: claim.claimed_at });
              this.sql.exec(`UPDATE outbox SET sent_at = ? WHERE id = ? AND sent_at IS NULL`,
                claim.claimed_at || t, grant.grant_id);
              this.sql.exec(`UPDATE grants SET state = 'issued', lease_expires_at = ? WHERE grant_id = ?`,
                t + LEASE_MS, grant.grant_id);
              this.sql.exec(
                `UPDATE schedule SET state = 'void' WHERE kind = 'lease' AND ref = ? AND state = 'pending'`,
                grant.grant_id);
              this._schedule(t + LEASE_MS, "lease", grant.grant_id, { anchored: "claim_precedence" });
              this._logTransition("grant", grant.grant_id, "handoff_resolved",
                "handoff_uncertain", "issued", null, { via: "claim_precedence" });
            } else {
              this._voidDispatch(
                { grantId: grant.grant_id, jobId: grant.job_id }, "handoff_proven_unaccepted");
              this._scheduleReAdvance(grant.job_id);
            }
          } else {
            const tries = (payload.tries || 0) + 1;
            if (tries <= 5) {
              this._schedule(this._now() + 30000 * 2 ** (tries - 1),
                "handoff_check", grant.grant_id, { tries });
            } else {
              this._logTransition("grant", grant.grant_id, "handoff_unresolved",
                "handoff_uncertain", "handoff_uncertain", null,
                { tries, note: "queue probe could not settle acceptance; uncertainty stays visible" });
            }
          }
        });
        break;
      }
      default: break; // plan_step kinds are interpreted by their owners
    }
  }

  // ---- read models (pure — used by the GET API; no writes) -------------------
  receipt(commandId) {
    const c = this._oneOrNull(`SELECT * FROM commands WHERE command_id = ?`, commandId);
    if (!c) return null;
    return { command_id: c.command_id, type: c.type, outcome: c.outcome,
             ...(c.outcome_json ? JSON.parse(c.outcome_json) : {}),
             received_at: c.received_at };
  }

  jobView(jobId) {
    const job = this._oneOrNull(`SELECT * FROM jobs WHERE job_id = ?`, jobId);
    if (!job) return null;
    const occs = this._all(
      `SELECT occurrence_id, revision_key, state, cache_key FROM occurrences WHERE job_id = ? ORDER BY occurrence_id`,
      jobId);
    // Grant states ride along so a handoff_uncertain grant (round 5) is
    // VISIBLE on the same surface as the job it belongs to — uncertainty
    // that no read model shows is uncertainty that gets forgotten.
    const grants = this._all(
      `SELECT grant_id, state, revision FROM grants WHERE job_id = ? ORDER BY created_at`, jobId);
    return { jobId: job.job_id, kind: job.kind, bookId: job.book_id,
             chapterIndex: job.chapter_index, lane: job.lane, state: job.state,
             revision: job.revision, occurrences: occs, grants };
  }

  quotaView() {
    const now = this._now();
    const day = dayKeyPT(now), month = monthKey(now);
    const attemptsToday = this._attemptsOn(day);
    const spentMonth = this._spendIn(month);
    const park = this._oneOrNull(
      `SELECT * FROM quota_parks WHERE released_at IS NULL ORDER BY id DESC LIMIT 1`);
    const ledgerSeq = this._one(`SELECT COALESCE(MAX(rowid), 0) AS m FROM ledger_ops`).m;
    return { dayKey: day, attemptsToday, dailyLimit: DAILY_QUOTA_LIMIT,
             basis: "Reader estimate (server attempt ledger)",
             monthKey: month, spentMicroCents: spentMonth,
             monthlyCap: this._settings().monthlyCap,
             // P4 money surface: revisioned reads so two devices can
             // detect divergence and converge. A cached copy of this
             // view is display data only — grants re-read the ledger
             // inside their transaction; a cache never authorizes.
             ledgerSeq, settingsRevision: this._settings().revision,
             parked: park ? { parkedAt: park.parked_at,
                              evidence: JSON.parse(park.evidence_json || "{}") } : null };
  }

  settingsView() { return this._settings(); }

  conflictsView() {
    return this._all(`SELECT * FROM binding_conflicts ORDER BY id DESC LIMIT 100`);
  }

  // ============ P3: acceptance claims, spend fences, Batch maps ====
  // The executor-facing surface (Case #5 contracts + gate-2
  // conditions). Every method is one transaction; none of them touches
  // jobs.revision (claims are not job transitions — the executor reads
  // the job's current revision when it reports).

  // ClaimGrant: the acceptance ledger write. Claiming is allowed
  // while the grant is live (issued / delivered / handoff_uncertain).
  // Terminal grant states map to terminal claim answers: reported ->
  // completed, voided/superseded -> closed (this dispatch can never
  // be accepted now). Returns are READ-ONLY evidence (gate-2
  // condition 1): holding or re-reading a claim never permits a
  // provider call — only AcquireSpendIntent does.
  claimGrant({ grantId, consumerId }) {
    return this._tx(() => {
      const grant = this._oneOrNull(`SELECT * FROM grants WHERE grant_id = ?`, grantId);
      if (!grant) return { status: "unknown_grant" };
      const existing = this._oneOrNull(`SELECT * FROM claims WHERE grant_id = ?`, grantId);
      if (existing) {
        return { status: existing.state === "claimed" ? "already_claimed"
                : existing.state, claim: existing };
      }
      if (grant.state === "reported") {
        this.sql.exec(`INSERT INTO claims (grant_id, state, consumer_id, claimed_at, updated_at)
          VALUES (?, 'completed', NULL, NULL, ?)`, grantId, this._now());
        return { status: "completed" };
      }
      if (grant.state === "voided" || grant.state === "superseded") {
        this.sql.exec(`INSERT INTO claims (grant_id, state, consumer_id, claimed_at, closed_reason, updated_at)
          VALUES (?, 'closed', NULL, NULL, ?, ?)`, grantId, `grant_${grant.state}`, this._now());
        return { status: "closed", reason: `grant_${grant.state}` };
      }
      const t = this._now();
      this.sql.exec(`INSERT INTO claims (grant_id, state, consumer_id, claimed_at, updated_at)
        VALUES (?, 'claimed', ?, ?, ?)`, grantId, consumerId, t, t);
      this._logTransition("grant", grantId, "claim_acquired",
        grant.state, grant.state, null, { consumerId });
      return { status: "claimed",
               claim: { grant_id: grantId, state: "claimed", consumer_id: consumerId, claimed_at: t } };
    });
  }

  // The probe's source of truth (contracts addendum): verdicts derive
  // ONLY from claim rows. claimed/completed -> accepted (with the
  // claim timestamp); closed -> not_accepted (terminal: closure
  // itself required terminal evidence); NO ROW -> unknown, forever
  // until a row exists. Absence is never a terminal negative.
  probeVerdict(grantId) {
    const claim = this._oneOrNull(`SELECT * FROM claims WHERE grant_id = ?`, grantId);
    if (!claim) return { verdict: "unknown" };
    if (claim.state === "closed") return { verdict: "not_accepted", reason: claim.closed_reason };
    return { verdict: "accepted", claimedAt: claim.claimed_at };
  }

  // Terminal closure of an unclaimed grant (contract 1): allowed ONLY
  // with terminal delivery evidence supplied by the handoff machinery
  // (the queue's final never-accepted record for this grant) — the
  // caller must name the evidence; a claimed grant REFUSES closure
  // (never closed out from under its consumer). A claim landing after
  // closure is rejected_terminal by claimGrant's row check.
  closeAcceptance({ grantId, evidence }) {
    return this._tx(() => {
      const existing = this._oneOrNull(`SELECT * FROM claims WHERE grant_id = ?`, grantId);
      if (existing) {
        if (existing.state === "claimed") return { closed: false, reason: "claimed" };
        return { closed: existing.state === "closed", reason: existing.closed_reason };
      }
      const grant = this._oneOrNull(`SELECT * FROM grants WHERE grant_id = ?`, grantId);
      if (!grant) return { closed: false, reason: "unknown_grant" };
      const t = this._now();
      this.sql.exec(`INSERT INTO claims (grant_id, state, consumer_id, claimed_at, closed_reason, updated_at)
        VALUES (?, 'closed', NULL, NULL, ?, ?)`, grantId, String(evidence || "terminal_no_accept"), t);
      this._logTransition("grant", grantId, "acceptance_closed",
        grant.state, grant.state, null, { evidence: String(evidence || "") });
      return { closed: true };
    });
  }

  // Marks a claim completed when its grant is reported. Called by
  // handleReport's transaction (internal; not an executor command).
  _completeClaim(grantId) {
    this.sql.exec(`UPDATE claims SET state = 'completed', updated_at = ?
      WHERE grant_id = ? AND state = 'claimed'`, this._now(), grantId);
  }

  // AcquireSpendIntent (gate-2 condition 1): the ONLY permit for a
  // provider call, per OCCURRENCE. Atomic exactly-once. Requires a
  // live claim on the presenting grant held by THIS consumer — owning
  // or re-reading a claim is never enough. A second acquisition by
  // anyone, ever, returns the existing intent with acquired:false:
  // an intent without a recorded known outcome is spent-or-unknown
  // and must be reconciled by evidence, never re-spent. Because the
  // fence follows the occurrence, a deferred occurrence re-granted
  // under a fresh grant meets the same fence — no second spend.
  _latestIntent(jobId, occurrenceId) {
    return this._oneOrNull(
      `SELECT * FROM spend_intents WHERE job_id = ? AND occurrence_id = ?
       ORDER BY generation DESC LIMIT 1`, jobId, occurrenceId);
  }

  _latestBatchMap(jobId, occurrenceId) {
    return this._oneOrNull(
      `SELECT * FROM batch_maps WHERE job_id = ? AND occurrence_id = ?
       ORDER BY generation DESC LIMIT 1`, jobId, occurrenceId);
  }

  acquireSpendIntent({ grantId, jobId, occurrenceId, consumerId }) {
    return this._tx(() => {
      const latest = this._latestIntent(jobId, occurrenceId);
      // A live (non-superseded) intent is the spend boundary: final.
      if (latest && !latest.superseded_at) return { acquired: false, intent: latest };
      const claim = this._oneOrNull(`SELECT * FROM claims WHERE grant_id = ?`, grantId);
      if (!claim || claim.state !== "claimed") return { acquired: false, reason: "not_claimed" };
      if (claim.consumer_id !== consumerId) return { acquired: false, reason: "claimed_by_other" };
      const t = this._now();
      const generation = latest ? latest.generation + 1 : 1;
      this.sql.exec(`INSERT INTO spend_intents (job_id, occurrence_id, grant_id, consumer_id, acquired_at, generation)
        VALUES (?, ?, ?, ?, ?, ?)`, jobId, occurrenceId, grantId, consumerId, t, generation);
      if (latest) this._logTransition("grant", grantId, "spend_intent_acquired",
        "superseded", "acquired", null, { occurrenceId, generation });
      return { acquired: true,
               intent: { job_id: jobId, occurrence_id: occurrenceId, grant_id: grantId,
                         consumer_id: consumerId, acquired_at: t, outcome: null, generation } };
    });
  }

  // Records a KNOWN provider outcome against a spend intent (an HTTP
  // answer — success handled via reports; rejections and known
  // failures land here for reconciliation visibility). An ambiguous
  // outcome is recorded by NOT calling this: the intent stays open.
  noteSpendOutcome({ jobId, occurrenceId, outcome, detail }) {
    return this._tx(() => {
      const cur = this._latestIntent(jobId, occurrenceId);
      if (!cur || cur.superseded_at) return { noted: false, reason: "no_intent" };
      if (cur.outcome) return { noted: false, reason: "already_noted", outcome: cur.outcome };
      this.sql.exec(`UPDATE spend_intents SET outcome = ?, outcome_detail = ?
        WHERE job_id = ? AND occurrence_id = ? AND generation = ?`,
        outcome, detail ? String(detail).slice(0, 320) : null, jobId, occurrenceId, cur.generation);
      return { noted: true };
    });
  }

  // ---- Batch mapping (contract 2). The fence is written BEFORE the
  // billable POST and requires the spend intent (the POST is the one
  // paid action the intent permits). Exactly-once, like the intent,
  // and occurrence-keyed: re-grants poll the existing mapping.
  fenceBatchSubmit({ grantId, jobId, occurrenceId, displayName, consumerId }) {
    return this._tx(() => {
      const existing = this._latestBatchMap(jobId, occurrenceId);
      if (existing && !existing.superseded_at) return { fenced: false, map: existing };
      const intent = this._latestIntent(jobId, occurrenceId);
      if (!intent || intent.superseded_at) return { fenced: false, reason: "no_spend_intent" };
      if (intent.consumer_id !== consumerId) return { fenced: false, reason: "claimed_by_other" };
      const t = this._now();
      const generation = intent.generation;
      this.sql.exec(`INSERT INTO batch_maps (job_id, occurrence_id, grant_id, display_name, provider_name, state, detail, updated_at, generation)
        VALUES (?, ?, ?, ?, NULL, 'fenced', NULL, ?, ?)`, jobId, occurrenceId, grantId, displayName, t, generation);
      return { fenced: true,
               map: { job_id: jobId, occurrence_id: occurrenceId, grant_id: grantId,
                      display_name: displayName, provider_name: null, state: "fenced", generation } };
    });
  }

  _batchTransition(jobId, occurrenceId, fromStates, toState, fields, cause) {
    return this._tx(() => {
      const cur = this._latestBatchMap(jobId, occurrenceId);
      if (!cur) return { ok: false, reason: "no_map" };
      if (cur.superseded_at) return { ok: false, reason: "superseded", map: cur };
      if (!fromStates.includes(cur.state)) return { ok: false, reason: `state_${cur.state}`, map: cur };
      const sets = ["state = ?", "updated_at = ?"];
      const vals = [toState, this._now()];
      for (const [k, v] of Object.entries(fields || {})) { sets.push(`${k} = ?`); vals.push(v); }
      vals.push(jobId, occurrenceId, cur.generation);
      this.sql.exec(`UPDATE batch_maps SET ${sets.join(", ")} WHERE job_id = ? AND occurrence_id = ? AND generation = ?`, ...vals);
      this._logTransition("grant", cur.grant_id, cause, cur.state, toState, null,
        { occurrenceId, displayName: cur.display_name });
      return { ok: true, map: { ...cur, state: toState, ...(fields || {}) } };
    });
  }

  // The provider accepted and returned a name: persist it at once.
  noteBatchSubmitted({ jobId, occurrenceId, providerName }) {
    return this._batchTransition(jobId, occurrenceId, ["fenced"], "submitted",
      { provider_name: providerName }, "batch_submitted");
  }
  // The POST's outcome is unknown (transport loss): the fence stands;
  // this mapping may NEVER be resubmitted (contract 2).
  noteBatchAmbiguous({ jobId, occurrenceId, detail }) {
    return this._batchTransition(jobId, occurrenceId, ["fenced"], "ambiguous",
      { detail: detail ? String(detail).slice(0, 320) : "submit_outcome_unknown" }, "batch_ambiguous");
  }
  // The provider explicitly rejected the submission (an HTTP answer
  // is a KNOWN outcome): the fence clears, the failure is reportable.
  noteBatchRejected({ jobId, occurrenceId, detail }) {
    return this._batchTransition(jobId, occurrenceId, ["fenced"], "rejected",
      { detail: detail ? String(detail).slice(0, 320) : "rejected" }, "batch_rejected");
  }
  // Lookup adoption: enumeration FOUND the job (a match is evidence).
  adoptBatchByLookup({ jobId, occurrenceId, providerName, evidence }) {
    return this._batchTransition(jobId, occurrenceId, ["ambiguous"], "submitted",
      { provider_name: providerName, detail: `adopted_via_lookup: ${String(evidence || "").slice(0, 240)}` },
      "batch_adopted");
  }
  // Explicit resolution of an ambiguous submission as never-accepted,
  // ONLY with named authoritative evidence (gate-2 condition 2 — a
  // missing lookup match is NOT evidence and cannot call this). On
  // closure the fencing dispatch is voided if still open and the job
  // re-advances exactly like a proven unaccepted handoff: the spend
  // reservation is released and the work is re-granted; a job whose
  // occurrence already returned to pending via a partial report is
  // simply re-granted by the same retry path.
  resolveBatchNeverAccepted({ jobId, occurrenceId, evidence }) {
    const ev = String(evidence || "").slice(0, 240);
    const done = this._tx(() => {
      const cur = this._latestBatchMap(jobId, occurrenceId);
      if (!cur) return { ok: false, reason: "no_map" };
      if (cur.superseded_at) return { ok: false, reason: "superseded", map: cur };
      if (cur.state !== "ambiguous") return { ok: false, reason: `state_${cur.state}`, map: cur };
      const t = this._now();
      // Close this generation AND supersede it, atomically: the map
      // and its spend intent are retired together, with the evidence
      // as the audit record. Only a superseded generation may be
      // succeeded — the next claim acquires a FRESH intent at
      // generation+1 (the original permit is never reused).
      this.sql.exec(`UPDATE batch_maps SET state = 'closed', superseded_at = ?,
          detail = ?, updated_at = ?
        WHERE job_id = ? AND occurrence_id = ? AND generation = ?`,
        t, `never_accepted: ${ev}`, t, jobId, occurrenceId, cur.generation);
      const intent = this._latestIntent(jobId, occurrenceId);
      if (intent && !intent.superseded_at) {
        this.sql.exec(`UPDATE spend_intents SET superseded_at = ?, superseded_reason = ?
          WHERE job_id = ? AND occurrence_id = ? AND generation = ?`,
          t, `batch_never_accepted: ${ev}`, jobId, occurrenceId, intent.generation);
      }
      this._logTransition("grant", cur.grant_id, "batch_never_accepted",
        "ambiguous", "closed", null,
        { occurrenceId, generation: cur.generation, evidence: ev });
      this._logTransition("grant", cur.grant_id, "spend_intent_superseded",
        "acquired", "superseded", null,
        { occurrenceId, generation: cur.generation, evidence: ev });
      // Void the fencing dispatch if it is still open (releasing its
      // reservation), then the standard re-advance takes over. The
      // CLAIM on that grant is untouched — acceptance happened; only
      // the batch submission is resolved as never-accepted.
      const grant = cur.grant_id
        ? this._oneOrNull(`SELECT * FROM grants WHERE grant_id = ?`, cur.grant_id) : null;
      if (grant && (grant.state === "issued" || grant.state === "delivered" || grant.state === "handoff_uncertain")) {
        // claimedOk: this caller owns the claimed case — its
        // evidence is about the PROVIDER submission (not the queue
        // handoff), the claim row is preserved untouched, and the
        // re-attempt is generation-fenced (P3 round-2 fence scope).
        this._voidDispatch({ grantId: cur.grant_id, jobId }, "batch_never_accepted", { claimedOk: true });
      }
      return { ok: true, voided: !!grant, generation: cur.generation, map: { ...cur, state: "closed", superseded_at: t } };
    });
    if (done.ok) this._scheduleReAdvance(jobId);
    return done;
  }

  claimView(grantId) {
    return this._oneOrNull(`SELECT * FROM claims WHERE grant_id = ?`, grantId) || null;
  }

  workView(jobId) {
    // Latest generation per occurrence — the current attempt's rows.
    // (Full history stays in the tables + transitions for audit.)
    return {
      intents: this._all(
        `SELECT * FROM spend_intents WHERE job_id = ? AND generation =
           (SELECT MAX(generation) FROM spend_intents s2
             WHERE s2.job_id = spend_intents.job_id AND s2.occurrence_id = spend_intents.occurrence_id)
         ORDER BY occurrence_id`, jobId),
      batchMaps: this._all(
        `SELECT * FROM batch_maps WHERE job_id = ? AND generation =
           (SELECT MAX(generation) FROM batch_maps b2
             WHERE b2.job_id = batch_maps.job_id AND b2.occurrence_id = batch_maps.occurrence_id)
         ORDER BY occurrence_id`, jobId),
    };
  }

  // ============ P4: sync v2 + money authority (Case #6) ============
  // The protocol contracts (addendum, issue #11): per-family
  // append-only change history written in the mutation's own
  // transaction; pinned-watermark paginated pulls; durable per-book
  // receipts (the P2 command log IS the receipt store — a lost ACK
  // re-reads the same receipt, never re-applies); position as an
  // append-only event journal folded deterministically in receipt
  // order; revisioned tombstones; money read-only from the ledger.

  _familyState(family) {
    let st = this._oneOrNull(`SELECT * FROM sync_family_state WHERE family = ?`, family);
    if (!st) {
      // Lazy init from whatever history exists (pre-P4-fix data).
      const mx = this._one(`SELECT COALESCE(MAX(seq), 0) AS tip, MIN(seq) AS fl FROM sync_changes WHERE family = ?`, family);
      st = { family, tip: mx.tip, floor: mx.fl === null ? 1 : mx.fl };
      this.sql.exec(`INSERT INTO sync_family_state (family, tip, floor) VALUES (?, ?, ?)`,
        family, st.tip, st.floor);
    }
    return st;
  }

  _syncTip(family) { return this._familyState(family).tip; }

  _syncFloor(family) { return this._familyState(family).floor; }

  _appendChange(family, entityKey, bookId, revision, op, payload) {
    const st = this._familyState(family);
    const seq = st.tip + 1;
    this.sql.exec(`UPDATE sync_family_state SET tip = ? WHERE family = ?`, seq, family);
    this.sql.exec(`INSERT INTO sync_changes (family, seq, entity_key, book_id, revision, op, payload_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      family, seq, entityKey, bookId, revision, op,
      payload === undefined ? null : JSON.stringify(payload));
    return seq;
  }

  // The ONLY sanctioned history truncation: rows below beforeSeq go,
  // the floor advances to meet them, the tip NEVER moves. A cursor
  // below the new floor hears resyncRequired; a cursor at/above it
  // still receives every later change — no silent misses, ever.
  _pruneSyncHistory(family, beforeSeq) {
    const st = this._familyState(family);
    const floor = Math.max(st.floor, Math.min(beforeSeq, st.tip + 1));
    this.sql.exec(`DELETE FROM sync_changes WHERE family = ? AND seq < ?`, family, floor);
    this.sql.exec(`UPDATE sync_family_state SET floor = ? WHERE family = ?`, floor, family);
    return { family, floor, tip: st.tip };
  }

  _syncEntity(family, entityKey) {
    return this._oneOrNull(`SELECT * FROM sync_entities WHERE family = ? AND entity_key = ?`,
      family, entityKey);
  }

  _bookTombstoned(bookId) {
    if (!bookId) return false;
    const e = this._syncEntity("content", bookId);
    return !!(e && e.deleted);
  }

  _upsertSyncEntity(family, entityKey, bookId, data) {
    const cur = this._syncEntity(family, entityKey);
    const revision = (cur ? cur.revision : 0) + 1;
    this.sql.exec(
      `INSERT INTO sync_entities (family, entity_key, book_id, revision, deleted, data_json)
       VALUES (?, ?, ?, ?, 0, ?)
       ON CONFLICT(family, entity_key) DO UPDATE SET revision = excluded.revision,
         deleted = 0, data_json = excluded.data_json`,
      family, entityKey, bookId, revision, JSON.stringify(data));
    this._appendChange(family, entityKey, bookId, revision, "upsert", data);
    return revision;
  }

  _conflictWindow(family, entityKey, baseRevision) {
    return this._all(
      `SELECT seq, revision, op FROM sync_changes
       WHERE family = ? AND entity_key = ? AND revision > ? ORDER BY seq`,
      family, entityKey, baseRevision).slice(0, 20);
  }

  // Pushes validate and apply PER BOOK (P4 review: the contract's
  // atomicity unit is the book, not the entity). Within a book group
  // every change is validated first; if any fails, NONE of that
  // book's changes commit — the failing change carries its real
  // outcome and its siblings carry 'aborted_book_conflict'. Other
  // books in the same batch are unaffected (abort isolation).
  _validateSyncChange(ch) {
    const { family, entityKey } = ch || {};
    const hard = outcome => ({ ok: false, outcome });
    if (!SYNC_FAMILIES.includes(family) || family === "position" || !entityKey)
      return hard({ entityKey: entityKey || null, status: "invalid" });
    if (family === "settings") {
      if (entityKey !== "settings") return hard({ entityKey, status: "invalid" });
      const curRev = this._settings().revision;
      if (ch.baseRevision !== curRev)
        return hard({ entityKey, status: "conflict", currentRevision: curRev });
      return { ok: true };
    }
    const bookId = ch.bookId || (family === "content" ? entityKey : null);
    // Book identity, verified BEFORE any fence or CAS (P4 follow-up):
    // a change whose identifiers disagree would otherwise be fenced
    // and grouped against the WRONG book — including writing past a
    // tombstone under a live book's name. Content: the entity key IS
    // the book id. Bindings: the key must be "<bookId>:<occurrence>"
    // for a book that exists, and the occurrence must be one of the
    // book's own — ownership is proven, never assumed.
    if (family === "content" && bookId !== entityKey)
      return hard({ entityKey, status: "rejected", reason: "identity_mismatch", bookId });
    if (family === "bindings") {
      if (!bookId || !entityKey.startsWith(`${bookId}:`))
        return hard({ entityKey, status: "rejected", reason: "identity_mismatch", bookId });
      const bookEnt = this._syncEntity("content", bookId);
      if (!bookEnt)
        return hard({ entityKey, status: "rejected", reason: "unknown_book", bookId });
      if (!bookEnt.deleted) {
        const occIds = (JSON.parse(bookEnt.data_json || "{}").occurrenceIds) || [];
        if (!occIds.includes(entityKey.slice(bookId.length + 1)))
          return hard({ entityKey, status: "rejected", reason: "unknown_occurrence", bookId });
      }
    }
    // The delete fence: no family accepts a write against a
    // tombstoned book (Rowan invariant 3) — not content, not
    // bindings, and position events fence separately below.
    if (this._bookTombstoned(bookId)) {
      if (ch.op === "delete" && family === "content") {
        const cur = this._syncEntity("content", bookId);
        return { ok: true, precomputed: { entityKey, status: "applied",
          revision: cur.revision, alreadyTombstoned: true } };
      }
      return hard({ entityKey, status: "rejected_tombstoned", bookId });
    }
    if (ch.op === "delete") {
      if (family !== "content") return hard({ entityKey, status: "invalid" });
      const cur = this._syncEntity("content", bookId);
      const curRev = cur ? cur.revision : 0;
      if (ch.baseRevision !== undefined && ch.baseRevision !== curRev)
        return hard({ entityKey, status: "conflict", currentRevision: curRev,
                      window: this._conflictWindow("content", bookId, ch.baseRevision ?? 0) });
      return { ok: true };
    }
    const cur = this._syncEntity(family, entityKey);
    const curRev = cur ? cur.revision : 0;
    if (ch.baseRevision !== curRev)
      return hard({ entityKey, status: "conflict", currentRevision: curRev,
                    window: this._conflictWindow(family, entityKey, ch.baseRevision ?? 0) });
    return { ok: true };
  }

  _applyValidatedSyncChange(ch) {
    const { family, entityKey } = ch;
    if (family === "settings") {
      const r = this._setSettings({ baseRevision: ch.baseRevision, data: ch.payload || {} }, null);
      return r.outcome === "applied"
        ? { entityKey, status: "applied", revision: r.revision }
        : { entityKey, status: "conflict", currentRevision: r.revision };
    }
    const bookId = ch.bookId || (family === "content" ? entityKey : null);
    if (ch.op === "delete") {
      const r = this._tombstoneBook(bookId, ch.baseRevision);
      return { entityKey, status: r.status, revision: r.revision,
               ...(r.alreadyTombstoned ? { alreadyTombstoned: true } : {}),
               ...(r.currentRevision !== undefined ? { currentRevision: r.currentRevision } : {}) };
    }
    const revision = this._upsertSyncEntity(family, entityKey, bookId, ch.payload ?? null);
    return { entityKey, status: "applied", revision };
  }

  _syncPush(p, commandId) {
    const changes = Array.isArray(p.changes) ? p.changes : [];
    const groups = new Map();
    changes.forEach((ch, i) => {
      const key = !ch || ch.family === "settings" ? "§settings"
        : (ch.bookId || ch.entityKey || `§${i}`);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(i);
    });
    const outcomes = new Array(changes.length);
    for (const idxs of groups.values()) {
      // Group-shape fences (P4 re-review): within one book group, a
      // duplicate entity target or a delete mixed with other writes
      // has no sound sequential reading — both writes would validate
      // against the same pre-state, and an update could land after
      // the group's own tombstone. Such groups are rejected whole:
      // the offending changes carry the reason, siblings abort.
      const seen = new Map();
      let groupViolation = null;
      const dupIdx = new Set();
      for (const i of idxs) {
        const key = `${changes[i].family}:${changes[i].entityKey}`;
        if (seen.has(key)) { dupIdx.add(i); dupIdx.add(seen.get(key)); }
        else seen.set(key, i);
      }
      if (dupIdx.size > 0) groupViolation = "duplicate_entity_in_group";
      const hasDelete = idxs.some(i => changes[i].op === "delete");
      if (hasDelete && idxs.length > 1) groupViolation = "mixed_delete_group";
      if (groupViolation) {
        for (const i of idxs) {
          outcomes[i] = (groupViolation === "mixed_delete_group" || dupIdx.has(i))
            ? { entityKey: changes[i].entityKey, status: "rejected", reason: groupViolation,
                bookId: changes[i].bookId || null }
            : { entityKey: changes[i].entityKey, status: "aborted_book_conflict",
                bookId: changes[i].bookId || null };
        }
        continue;
      }
      const vals = idxs.map(i => this._validateSyncChange(changes[i]));
      if (vals.every(v => v.ok)) {
        idxs.forEach((ci, k) => {
          outcomes[ci] = vals[k].precomputed
            || this._applyValidatedSyncChange(changes[ci]);
        });
      } else {
        idxs.forEach((ci, k) => {
          outcomes[ci] = vals[k].ok
            ? { entityKey: changes[ci].entityKey, status: "aborted_book_conflict",
                bookId: changes[ci].bookId || null }
            : vals[k].outcome;
        });
      }
    }
    return { outcome: "applied", deviceId: p.deviceId || null, outcomes };
  }

  _tombstoneBook(bookId, baseRevision) {
    const cur = this._syncEntity("content", bookId);
    if (cur && cur.deleted)
      return { status: "applied", revision: cur.revision, alreadyTombstoned: true };
    const curRev = cur ? cur.revision : 0;
    if (baseRevision !== undefined && baseRevision !== curRev)
      return { status: "conflict", currentRevision: curRev,
               window: this._conflictWindow("content", bookId, baseRevision ?? 0) };
    const revision = curRev + 1;
    this.sql.exec(
      `INSERT INTO sync_entities (family, entity_key, book_id, revision, deleted, data_json)
       VALUES ('content', ?, ?, ?, 1, NULL)
       ON CONFLICT(family, entity_key) DO UPDATE SET revision = excluded.revision,
         deleted = 1, data_json = NULL`,
      bookId, bookId, revision);
    this._appendChange("content", bookId, bookId, revision, "tombstone", { bookId });
    this._logTransition("book", bookId, "DeleteBook", null, "tombstoned", revision, {});
    return { status: "applied", revision };
  }

  _deleteBook(p, commandId) {
    if (!p.bookId) return { outcome: "rejected", reason: "book_required" };
    const r = this._tombstoneBook(p.bookId, p.baseRevision);
    return r.status === "applied"
      ? { outcome: "applied", bookId: p.bookId, revision: r.revision, alreadyTombstoned: !!r.alreadyTombstoned }
      : { outcome: "rejected", reason: "conflict", bookId: p.bookId, currentRevision: r.currentRevision };
  }

  // ---- migration import (P8; v2/p8/migration-import-design.md) -------------
  // The dedicated verified bind primitive Rowan's D10 ruling
  // (6354217340) requires before any audio-containing flip may be
  // scheduled. It REPLACES the split SyncPush + AdoptAudio path for
  // migration only: prime (async, §2) -> byte-verify (three-way,
  // fail closed, §3) -> bind BOTH planes (sync bindings family +
  // SQL bindings/cache_index) inside this command's ONE transaction
  // (§1), or apply nothing at all. Non-migration commands are
  // untouched: SyncPush still does not verify bytes and AdoptAudio
  // still verifies through the request snapshot.
  //
  // The prime seam: env.migrationPrime(cacheKey) -> fact | null,
  // where fact = { objectKey, format, byteLength, computedSha256,
  // metadataSha256, metadataIdentity, etag }. computedSha256 is
  // ALWAYS the host's fresh digest over the downloaded bytes; the
  // metadata value rides separately and is never trusted (§3).

  // ---- G2: the pinned approved freeze (Rowan re-review
  // 6354569652). The authoritative manifest identity lives in code
  // (v2/p8/approved-freeze-manifest.mjs, derived from Julie's
  // approved frozen snapshot by tools/derive-approved-freeze-
  // manifest.mjs): the freeze's corpus digest plus, per book, the
  // expected binding row set. A deployment/test environment may
  // supply env.approvedFreezeManifest (deployment configuration,
  // inside the trust boundary by definition); request data can
  // NEVER influence which manifest is pinned — caller input may
  // only match it. A manifest is { snapshotDigest, books:
  // { [bookId]: { rowSetSha256, rows: [[occurrenceId, revisionKey,
  // cacheKey, size, format, sha256Prefix, etag], ...] } } }.
  _approvedFreeze() {
    return (this.env && this.env.approvedFreezeManifest) || APPROVED_FREEZE_MANIFEST;
  }

  // The pinned record for one book, normalized: rows as objects
  // plus an occurrence index. Null when the book is not part of
  // the approved freeze.
  _pinnedBook(bookId) {
    const book = this._approvedFreeze()?.books?.[bookId];
    if (!book || !Array.isArray(book.rows)) return null;
    const rows = book.rows.map(t => ({
      occurrenceId: t[0], revisionKey: t[1], cacheKey: t[2],
      size: t[3], format: t[4], sha256Prefix: t[5], etag: t[6],
    }));
    return { rowSetSha256: book.rowSetSha256 ?? null, rows,
             byOccurrence: new Map(rows.map(r => [r.occurrenceId, r])) };
  }

  _pinnedForm(row) {
    return row.revisionKey === row.cacheKey ? "fingerprinted"
      : row.revisionKey === `legacy:${row.cacheKey}` ? "legacy-anchor"
      : "fingerprinted-distinct";
  }

  // The G2 admission check on an import payload, independent of
  // primed facts: null when the payload is exactly the approved
  // freeze's shape for this book, else the rejection. Runs before
  // priming (handleCommand) and again inside the command
  // transaction (the apply step) — the same function, so the two
  // can never drift apart.
  _migrationManifestError(p) {
    const bookId = p.bookId || null;
    const rows = Array.isArray(p.rows) ? p.rows : null;
    if (!bookId || !rows || rows.length === 0 || !p.migrationId || !p.freezeDigest)
      return null; // shape errors are the apply step's to name
    const freeze = this._approvedFreeze();
    if (!freeze || p.freezeDigest !== freeze.snapshotDigest)
      return { outcome: "rejected", reason: "migration_freeze_unapproved", bookId };
    const pinned = this._pinnedBook(bookId);
    if (!pinned)
      return { outcome: "rejected", reason: "migration_freeze_unapproved", bookId };
    if (rows.length !== pinned.rows.length)
      return { outcome: "rejected", reason: "migration_manifest_mismatch", bookId,
               occurrenceId: null };
    const seen = new Set();
    for (const r of rows) {
      if (!r || !r.occurrenceId) continue; // shape errors: apply step
      const want = pinned.byOccurrence.get(r.occurrenceId);
      if (!want || seen.has(r.occurrenceId))
        return { outcome: "rejected", reason: "migration_manifest_mismatch", bookId,
                 occurrenceId: r.occurrenceId };
      seen.add(r.occurrenceId);
      if (r.revisionKey !== want.revisionKey || r.cacheKey !== want.cacheKey ||
          !r.manifest || r.manifest.size !== want.size ||
          r.manifest.format !== want.format ||
          typeof r.manifest.sha256 !== "string" ||
          !r.manifest.sha256.startsWith(want.sha256Prefix))
        return { outcome: "rejected", reason: "migration_manifest_mismatch", bookId,
                 occurrenceId: r.occurrenceId };
    }
    return null;
  }

  async _prepareMigrationImport(p) {
    const facts = new Map();
    const prime = this.env && this.env.migrationPrime;
    const keys = [...new Set((Array.isArray(p.rows) ? p.rows : [])
      .map(r => r && r.cacheKey).filter(k => typeof k === "string" && k))];
    for (const key of keys) {
      if (typeof prime !== "function") { facts.set(key, { unavailable: true }); continue; }
      try { facts.set(key, (await prime(key)) || null); }
      catch (e) { facts.set(key, { error: String(e && e.message || e) }); }
    }
    return facts;
  }

  // The typed provenance acceptance (design §5): every attestation
  // field must agree with the row, the freeze manifest, AND the
  // primed facts. The caller separately proves the disagreement is
  // exactly the known v1 limitation (no recorded identity anywhere
  // but the cache-key default) — an attestation never rescues a
  // positive foreign identity.
  _migrationAttestationValid(att, row, fact, freezeDigest, pinnedRow = null) {
    if (!att || att.kind !== "freeze_snapshot_attestation") return false;
    if (att.snapshotDigest !== freezeDigest) return false;
    if (att.bookId !== row.bookId || att.occurrenceId !== row.occurrenceId) return false;
    if (att.revisionKey !== row.revisionKey || att.cacheKey !== row.cacheKey) return false;
    if (att.sha256 !== fact.computedSha256 || att.sha256 !== row.manifest.sha256) return false;
    if (att.size !== fact.byteLength || att.size !== row.manifest.size) return false;
    if (att.format !== fact.format || att.format !== row.manifest.format) return false;
    if (att.r2Key !== fact.objectKey) return false;
    if (fact.etag !== null && fact.etag !== undefined && att.r2Etag !== fact.etag) return false;
    // G2: the attestation's etag must also be the FREEZE's etag for
    // this row — an attestation minted against any other listing is
    // not the approved freeze's paperwork, however self-consistent.
    if (pinnedRow && att.r2Etag !== pinnedRow.etag) return false;
    if (att.identityLimitation !== "v1_metadata_no_identity") return false;
    return true;
  }

  _migrateImportBindings(p, commandId, facts) {
    const bookId = p.bookId || null;
    const rows = Array.isArray(p.rows) ? p.rows : null;
    if (!bookId || !rows || rows.length === 0 || !p.migrationId || !p.freezeDigest)
      return { outcome: "rejected", reason: "migration_shape", bookId };
    if (this._bookTombstoned(bookId))
      return { outcome: "rejected", reason: "rejected_tombstoned", bookId };
    const seenOcc = new Set();
    for (const r of rows) {
      if (!r || !r.occurrenceId || !r.revisionKey || !r.cacheKey ||
          !r.manifest || typeof r.manifest.sha256 !== "string" ||
          typeof r.manifest.size !== "number" || !r.manifest.format)
        return { outcome: "rejected", reason: "migration_shape", bookId };
      if (seenOcc.has(r.occurrenceId))
        return { outcome: "rejected", reason: "duplicate_row", bookId, occurrenceId: r.occurrenceId };
      seenOcc.add(r.occurrenceId);
    }
    // G2: the payload must be the approved freeze's row set for
    // this book — pinned in code, matchable but never definable by
    // the caller (see _migrationManifestError).
    const manifestError = this._migrationManifestError(p);
    if (manifestError) return manifestError;
    const pinned = this._pinnedBook(bookId);
    // Content: carried by the command, or already present. A stored
    // content entity that disagrees with the carried one is a
    // divergence — migration never silently rewrites a book's
    // structure. Rows must belong to the book's own occurrence set
    // (the same ownership proof _validateSyncChange performs).
    const contentEnt = this._syncEntity("content", bookId);
    let contentPlan = "present";
    if (p.content) {
      const occIds = Array.isArray(p.content.occurrenceIds) ? p.content.occurrenceIds : null;
      if (!occIds) return { outcome: "rejected", reason: "migration_shape", bookId };
      for (const r of rows)
        if (!occIds.includes(r.occurrenceId))
          return { outcome: "rejected", reason: "unknown_occurrence", bookId, occurrenceId: r.occurrenceId };
      if (contentEnt) {
        if (canonicalJson(JSON.parse(contentEnt.data_json || "{}")) !== canonicalJson(p.content))
          return { outcome: "rejected", reason: "content_divergence", bookId };
        contentPlan = "identical";
      } else contentPlan = "insert";
    } else {
      if (!contentEnt)
        return { outcome: "rejected", reason: "unknown_book", bookId };
      const occIds = (JSON.parse(contentEnt.data_json || "{}").occurrenceIds) || [];
      for (const r of rows)
        if (!occIds.includes(r.occurrenceId))
          return { outcome: "rejected", reason: "unknown_occurrence", bookId, occurrenceId: r.occurrenceId };
    }
    // The import record: a re-import under a different row set is a
    // divergence, never an overwrite. The immutable per-book import
    // identity (consistency addendum to G2/G3) pins migrationId,
    // freezeDigest, size and format alongside the four fields the
    // first version hashed — a re-import redefining ANY pinned
    // field is rejected, including after a gate record exists (the
    // gate's own checks are separate; this fence fires at import).
    const canonicalRows = rows
      .map(r => ({ occurrenceId: r.occurrenceId, revisionKey: r.revisionKey,
                   cacheKey: r.cacheKey, sha256: r.manifest.sha256,
                   size: r.manifest.size, format: r.manifest.format }))
      .sort((a, b) => (a.occurrenceId < b.occurrenceId ? -1 : 1));
    const rowsSha256 = sha256HexText(canonicalJson(canonicalRows));
    const priorBook = this._oneOrNull(`SELECT * FROM migration_books WHERE book_id = ?`, bookId);
    if (priorBook && (priorBook.rows_sha256 !== rowsSha256 ||
                      priorBook.migration_id !== p.migrationId ||
                      priorBook.freeze_digest !== p.freezeDigest))
      return { outcome: "rejected", reason: "migration_book_divergence", bookId };

    // ---- validate EVERY row before applying anything (design §1).
    const certRows = [];
    const plans = [];
    let firstBlock = null;
    for (const r of rows) {
      const cert = { occurrenceId: r.occurrenceId, revisionKey: r.revisionKey,
        cacheKey: r.cacheKey, objectKey: null, manifestSha256: r.manifest.sha256,
        computedSha256: null, metadataSha256: null, etag: null,
        verified: false, status: "blocked", reason: null };
      const plan = { row: r, cert, viaProvenance: false, idempotent: false,
                     recordedIdentity: null, syncData: null, syncPresent: false };
      const fail = (reason) => { cert.reason = reason; if (!firstBlock) firstBlock = reason; };
      const fact = facts ? facts.get(r.cacheKey) : null;
      if (fact && fact.unavailable) fail("migration_prime_unavailable");
      else if (fact && fact.error) fail("prime_failed");
      else if (!fact) fail("object_missing");
      else {
        cert.objectKey = fact.objectKey ?? null;
        cert.computedSha256 = fact.computedSha256 ?? null;
        cert.metadataSha256 = fact.metadataSha256 ?? null;
        cert.etag = fact.etag ?? null;
        const idx = this._oneOrNull(`SELECT * FROM cache_index WHERE cache_key = ?`, r.cacheKey);
        const existing = this._oneOrNull(
          `SELECT * FROM bindings WHERE occurrence_id = ? AND revision_key = ?`,
          r.occurrenceId, r.revisionKey);
        const syncEnt = this._syncEntity("bindings", `${bookId}:${r.occurrenceId}`);
        const syncData = syncEnt && !syncEnt.deleted
          ? JSON.parse(syncEnt.data_json || "{}") : null;
        if (fact.format !== r.manifest.format) fail("format_mismatch");
        else if (!fact.objectKey || !fact.objectKey.endsWith(`audio/${r.cacheKey}.${fact.format}`))
          fail("object_key_mismatch");
        else if (fact.byteLength !== r.manifest.size) fail("size_mismatch");
        else if (fact.computedSha256 !== r.manifest.sha256) fail("content_hash_mismatch");
        else if (fact.metadataSha256 !== null && fact.metadataSha256 !== undefined &&
                 fact.metadataSha256 !== fact.computedSha256) fail("metadata_digest_mismatch");
        else if (idx && idx.sha256 && idx.sha256 !== fact.computedSha256)
          fail("content_hash_mismatch");
        else if (existing && existing.cache_key !== r.cacheKey) fail("binding_conflict_existing");
        else if (syncData && (syncData.cacheKey !== r.cacheKey ||
                               (syncData.sha256 && syncData.sha256 !== fact.computedSha256)))
          fail("sync_binding_divergence");
        else {
          // Identity (design §5). The recorded identity: the
          // coordinator's index wins, the object's metadata is the
          // fallback, and a v1 object with neither defaults to its
          // cache key (the hydrateKey rule, restated on primed
          // facts so the snapshot is never consulted here).
          const recorded = (idx && idx.identity) || fact.metadataIdentity || r.cacheKey;
          plan.recordedIdentity = recorded;
          const isLegacy = r.revisionKey.startsWith("legacy:");
          let accepted = false;
          if (isLegacy) {
            if (r.revisionKey === `legacy:${r.cacheKey}`) accepted = true;
            else fail("legacy_anchor_mismatch");
          } else if (recorded === r.revisionKey) accepted = true;
          else {
            const noPositiveIdentity = !(idx && idx.identity) && !fact.metadataIdentity &&
              recorded === r.cacheKey;
            const att = r.provenanceAttestation || null;
            if (att && noPositiveIdentity &&
                this._migrationAttestationValid(att, { ...r, bookId }, fact, p.freezeDigest,
                                                pinned.byOccurrence.get(r.occurrenceId))) {
              accepted = true; plan.viaProvenance = true;
            } else if (att && noPositiveIdentity) fail("attestation_invalid");
            else fail("identity_mismatch");
          }
          if (accepted) {
            cert.verified = true;
            plan.syncData = { cacheKey: r.cacheKey, revisionKey: r.revisionKey,
              sha256: fact.computedSha256, format: fact.format, size: fact.byteLength,
              provenance: plan.viaProvenance ? "migration:freeze_snapshot_attestation" : "migration" };
            plan.syncPresent = !!syncData;
            plan.idempotent = !!existing && existing.cache_key === r.cacheKey &&
              !!syncData && canonicalJson(syncData) === canonicalJson(plan.syncData);
            plan.existingBinding = !!existing;
          }
        }
      }
      certRows.push(cert); plans.push(plan);
    }

    const certificate = { bookId, migrationId: p.migrationId,
      freezeDigest: p.freezeDigest, commandId, rows: certRows,
      totals: { rows: certRows.length, accepted: 0, acceptedIdempotent: 0,
                acceptedProvenance: 0, blocked: 0 } };
    if (firstBlock) {
      for (const c of certRows) {
        c.status = "blocked";
        if (!c.reason) c.reason = "book_rejected";
      }
      certificate.totals.blocked = certRows.length;
      return { outcome: "rejected", reason: firstBlock, bookId, certificate };
    }

    // G3: the canonical certificate digest, derived HERE from the
    // verified class-C facts — never accepted from the caller. It
    // binds every row's import-time verification (object key,
    // computed + retained-metadata digests, observed etag,
    // acceptance class) to the freeze, the migration, and the
    // row-set identity digest. accepted_idempotent normalizes to
    // "accepted": an idempotent re-import observes the same facts
    // and must anchor identically; a re-import whose observations
    // changed under the same rows is a divergence, rejected here —
    // before anything is applied.
    const anchorMaterial = { v: 1, bookId, migrationId: p.migrationId,
      freezeDigest: p.freezeDigest, rowsSha256,
      rows: plans.map(plan => ({ occurrenceId: plan.row.occurrenceId,
        revisionKey: plan.row.revisionKey, cacheKey: plan.row.cacheKey,
        objectKey: plan.cert.objectKey, computedSha256: plan.cert.computedSha256,
        metadataSha256: plan.cert.metadataSha256, etag: plan.cert.etag,
        status: plan.viaProvenance ? "accepted_provenance" : "accepted" }))
        .sort((a, b) => (a.occurrenceId < b.occurrenceId ? -1 : 1)) };
    const certificateSha256 = sha256HexText(canonicalJson(anchorMaterial));
    if (priorBook && priorBook.certificate_sha256 !== certificateSha256)
      return { outcome: "rejected", reason: "migration_book_divergence", bookId };
    certificate.certificateSha256 = certificateSha256;

    // ---- apply: one transaction (the handleCommand transaction),
    // both planes, from the same verified facts.
    if (contentPlan === "insert")
      this._upsertSyncEntity("content", bookId, bookId, p.content);
    if (!priorBook) {
      this.sql.exec(
        `INSERT INTO migration_books (book_id, migration_id, freeze_digest, row_count, rows_json, rows_sha256, imported_at, certificate_sha256)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        bookId, p.migrationId, p.freezeDigest, canonicalRows.length,
        canonicalJson(canonicalRows), rowsSha256, this._now(), certificateSha256);
    }
    for (const plan of plans) {
      const r = plan.row, fact = facts.get(r.cacheKey);
      const provenance = plan.viaProvenance
        ? "migration:freeze_snapshot_attestation" : "migration";
      if (!plan.existingBinding) {
        this.sql.exec(
          `INSERT INTO bindings (occurrence_id, revision_key, cache_key, provenance, bound_at)
           VALUES (?, ?, ?, ?, ?)`,
          r.occurrenceId, r.revisionKey, r.cacheKey, provenance, this._now());
        if (plan.viaProvenance) {
          this.sql.exec(
            `INSERT INTO migration_audit (at, migration_id, book_id, occurrence_id, revision_key,
               cache_key, recorded_identity, attestation_sha256, attestation_json, outcome)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'accepted_provenance')`,
            this._now(), p.migrationId, bookId, r.occurrenceId, r.revisionKey,
            r.cacheKey, plan.recordedIdentity,
            sha256HexText(canonicalJson(r.provenanceAttestation)),
            canonicalJson(r.provenanceAttestation));
        }
      }
      // The cache_index anchor write mirrors validateAndBind's
      // exactly: an existing identity/sha is never silently replaced.
      this.sql.exec(
        `INSERT INTO cache_index (cache_key, identity, format, sha256, recorded_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(cache_key) DO UPDATE SET identity = COALESCE(cache_index.identity, excluded.identity),
           format = excluded.format, sha256 = COALESCE(cache_index.sha256, excluded.sha256),
           recorded_at = excluded.recorded_at`,
        r.cacheKey, r.revisionKey.startsWith("legacy:") ? null : r.revisionKey,
        fact.format, fact.computedSha256, this._now());
      const cur = this._syncEntity("bindings", `${bookId}:${r.occurrenceId}`);
      const curData = cur && !cur.deleted ? JSON.parse(cur.data_json || "{}") : null;
      if (!curData || canonicalJson(curData) !== canonicalJson(plan.syncData))
        this._upsertSyncEntity("bindings", `${bookId}:${r.occurrenceId}`, bookId, plan.syncData);
      plan.cert.status = plan.idempotent ? "accepted_idempotent"
        : plan.viaProvenance ? "accepted_provenance" : "accepted";
    }
    for (const c of certRows) {
      if (c.status === "accepted") certificate.totals.accepted++;
      else if (c.status === "accepted_idempotent") certificate.totals.acceptedIdempotent++;
      else if (c.status === "accepted_provenance") certificate.totals.acceptedProvenance++;
    }
    this._logTransition("book", bookId, "MigrateImportBindings", null, "imported",
      null, { commandId, migrationId: p.migrationId, rows: certRows.length });
    return { outcome: "applied", bookId, migrationId: p.migrationId, certificate };
  }

  // Both-plane completeness against the import record — the shared
  // computation behind the flip gate and the read-back view. The
  // reference set is the manifest row set the book was imported
  // under; completeness is a statement about THAT set (a book may
  // legitimately have occurrences with no audio yet).
  //
  // G4 (Rowan re-review 6354569652): completeness is EXACT,
  // BIDIRECTIONAL set equality, not "at least the expected rows".
  // Forward: every expected row is present in both planes with
  // equal book/occurrence/revisionKey/cacheKey/digest/format/size
  // (and the provenance the pinned row's form demands). Reverse:
  // neither plane holds anything MORE for this book — no extra
  // sync entity (a tombstone is state too), no extra SQL binding
  // for the book's occurrences, no foreign or surplus provenance
  // audit rows — and each attested row's audit record survives an
  // integrity recompute against the stored attestation.
  _migrationCompleteness(bookId) {
    const book = this._oneOrNull(`SELECT * FROM migration_books WHERE book_id = ?`, bookId);
    if (!book) return { book: null, complete: false, missing: ["import_record"], divergences: [] };
    const missing = [], divergences = [];
    const pinned = this._pinnedBook(bookId);
    const expected = JSON.parse(book.rows_json);
    const expectedByOcc = new Map(expected.map(r => [r.occurrenceId, r]));
    const content = this._syncEntity("content", bookId);
    if (!content || content.deleted) missing.push("content");
    const contentOccIds = content && !content.deleted
      ? new Set((JSON.parse(content.data_json || "{}").occurrenceIds) || []) : new Set();
    const expectedProvenance = (row) => {
      const prow = pinned?.byOccurrence.get(row.occurrenceId) || row;
      return this._pinnedForm(prow) === "fingerprinted-distinct"
        ? "migration:freeze_snapshot_attestation" : "migration";
    };
    const diverge = (occurrenceId, plane, field, expectedV, foundV) =>
      divergences.push({ occurrenceId, plane, field, expected: expectedV, found: foundV });

    for (const row of expected) {
      const prov = expectedProvenance(row);
      const b = this._oneOrNull(
        `SELECT * FROM bindings WHERE occurrence_id = ? AND revision_key = ?`,
        row.occurrenceId, row.revisionKey);
      if (!b) missing.push(`sql:${row.occurrenceId}`);
      else {
        if (b.cache_key !== row.cacheKey) diverge(row.occurrenceId, "sql", "cacheKey", row.cacheKey, b.cache_key);
        if (b.provenance !== prov) diverge(row.occurrenceId, "sql", "provenance", prov, b.provenance);
      }
      const idx = this._oneOrNull(`SELECT * FROM cache_index WHERE cache_key = ?`, row.cacheKey);
      if (!idx) missing.push(`index:${row.occurrenceId}`);
      else {
        if (idx.sha256 !== row.sha256) diverge(row.occurrenceId, "index", "sha256", row.sha256, idx.sha256);
        if (idx.format !== row.format) diverge(row.occurrenceId, "index", "format", row.format, idx.format);
        // The identity the import anchored: the revision key, or
        // (legacy rows) null. The cache key itself — the v1 default
        // another honest path may have anchored first — is the one
        // other consistent value; anything else is foreign.
        const identityOk = row.revisionKey.startsWith("legacy:")
          ? (idx.identity === null || idx.identity === row.cacheKey)
          : idx.identity === row.revisionKey;
        if (!identityOk) diverge(row.occurrenceId, "index", "identity",
          row.revisionKey.startsWith("legacy:") ? null : row.revisionKey, idx.identity);
      }
      const e = this._syncEntity("bindings", `${bookId}:${row.occurrenceId}`);
      if (!e || e.deleted) missing.push(`sync:${row.occurrenceId}`);
      else {
        const d = JSON.parse(e.data_json || "{}");
        const wantData = { cacheKey: row.cacheKey, revisionKey: row.revisionKey,
          sha256: row.sha256, format: row.format, size: row.size, provenance: prov };
        if (canonicalJson(d) !== canonicalJson(wantData))
          diverge(row.occurrenceId, "sync", "data", wantData, d);
      }
    }

    // ---- reverse direction: nothing extra, in either plane.
    for (const e of this._all(
        `SELECT * FROM sync_entities WHERE family = 'bindings' AND book_id = ?`, bookId)) {
      const occId = e.entity_key.startsWith(`${bookId}:`)
        ? e.entity_key.slice(bookId.length + 1) : e.entity_key;
      if (!expectedByOcc.has(occId))
        diverge(occId, "sync", "unexpected_row", null, e.deleted ? "tombstone" : "live");
    }
    // SQL bindings are occurrence-global by design (the table's own
    // identity model — AdoptAudio binds without a book context); a
    // row belongs to this book iff its occurrence is one of the
    // book's content occurrences.
    for (const occId of contentOccIds) {
      for (const b of this._all(`SELECT * FROM bindings WHERE occurrence_id = ?`, occId)) {
        const want = expectedByOcc.get(occId);
        if (!want || want.revisionKey !== b.revision_key)
          diverge(occId, "sql", "unexpected_row", want ? want.revisionKey : null, b.revision_key);
      }
    }
    // Provenance audit integrity: exactly one audit row per
    // attested row, under THIS book's migration, its fingerprint
    // recomputing over the stored attestation, the attestation
    // itself field-equal to the approved row (including the
    // freeze's etag). No audit rows for anything else.
    const attested = expected.filter(r => expectedProvenance(r) ===
      "migration:freeze_snapshot_attestation");
    const auditByOcc = new Map();
    for (const a of this._all(`SELECT * FROM migration_audit WHERE book_id = ?`, bookId)) {
      if (a.migration_id !== book.migration_id ||
          !attested.some(r => r.occurrenceId === a.occurrence_id))
        diverge(a.occurrence_id, "audit", "unexpected_row", book.migration_id, a.migration_id);
      else auditByOcc.set(a.occurrence_id,
        [...(auditByOcc.get(a.occurrence_id) || []), a]);
    }
    for (const row of attested) {
      const list = auditByOcc.get(row.occurrenceId) || [];
      if (list.length !== 1) {
        diverge(row.occurrenceId, "audit", "count", 1, list.length);
        continue;
      }
      const a = list[0];
      let ok = a.revision_key === row.revisionKey && a.cache_key === row.cacheKey &&
        a.outcome === "accepted_provenance";
      if (ok) {
        try {
          const att = JSON.parse(a.attestation_json);
          ok = a.attestation_sha256 === sha256HexText(a.attestation_json) &&
            att.bookId === bookId && att.occurrenceId === row.occurrenceId &&
            att.revisionKey === row.revisionKey && att.cacheKey === row.cacheKey &&
            att.sha256 === row.sha256 && att.size === row.size &&
            att.format === row.format && att.snapshotDigest === book.freeze_digest &&
            (!pinned || att.r2Etag === pinned.byOccurrence.get(row.occurrenceId)?.etag);
        } catch { ok = false; }
      }
      if (!ok) diverge(row.occurrenceId, "audit", "integrity",
        "one intact accepted_provenance record", "missing/tampered");
    }

    return { book, complete: missing.length === 0 && divergences.length === 0,
             missing, divergences };
  }

  _migrateRecordFlipGate(p, commandId) {
    const bookId = p.bookId || null;
    if (!bookId || !p.migrationId || !p.certificateSha256)
      return { outcome: "rejected", reason: "migration_shape", bookId };
    const chk = this._migrationCompleteness(bookId);
    if (!chk.book)
      return { outcome: "rejected", reason: "flip_gate_incomplete", bookId,
               missing: chk.missing, divergences: chk.divergences };
    if (chk.book.migration_id !== p.migrationId)
      return { outcome: "rejected", reason: "flip_gate_incomplete", bookId,
               missing: ["migration_mismatch"], divergences: [] };
    if (!chk.complete)
      return { outcome: "rejected", reason: "flip_gate_incomplete", bookId,
               missing: chk.missing, divergences: chk.divergences };
    // G3: the presented certificate must equal the digest the
    // coordinator itself derived and anchored at import time.
    // Anything else — an arbitrary string, another book's
    // certificate, a certificate minted under another migration —
    // certifies nothing and is refused. (An existing gate's stored
    // certificate equals the anchor by construction, so this check
    // subsumes the old caller-string conflict rule.)
    if (!chk.book.certificate_sha256 ||
        p.certificateSha256 !== chk.book.certificate_sha256)
      return { outcome: "rejected", reason: "flip_gate_certificate_mismatch", bookId };
    const existing = this._oneOrNull(`SELECT * FROM migration_gates WHERE book_id = ?`, bookId);
    if (existing)
      return { outcome: "applied", bookId, flipped: true, idempotent: true };
    this.sql.exec(
      `INSERT INTO migration_gates (book_id, migration_id, certificate_sha256, flipped_at, detail_json)
       VALUES (?, ?, ?, ?, ?)`,
      bookId, p.migrationId, p.certificateSha256, this._now(),
      JSON.stringify({ commandId }));
    this._logTransition("book", bookId, "MigrateRecordFlipGate", null, "flipped",
      null, { commandId, migrationId: p.migrationId });
    return { outcome: "applied", bookId, flipped: true };
  }

  // Read-back surface for the flip fence (design §4, lock 2):
  // SELECT-only, safe on the read-only facade.
  migrationBookView(bookId) {
    const contentEnt = this._syncEntity("content", bookId);
    const book = this._oneOrNull(`SELECT * FROM migration_books WHERE book_id = ?`, bookId);
    const gate = this._oneOrNull(`SELECT * FROM migration_gates WHERE book_id = ?`, bookId);
    const syncBindings = this._all(
      `SELECT * FROM sync_entities WHERE family = 'bindings' AND book_id = ? ORDER BY entity_key`, bookId)
      .map(e => ({ entityKey: e.entity_key,
                   occurrenceId: e.entity_key.slice(bookId.length + 1),
                   revision: e.revision, tombstone: !!e.deleted,
                   data: e.data_json ? JSON.parse(e.data_json) : null }));
    const expected = book ? JSON.parse(book.rows_json) : [];
    const sqlBindings = [], cacheAnchors = [], seenKeys = new Set();
    for (const row of expected) {
      const b = this._oneOrNull(
        `SELECT * FROM bindings WHERE occurrence_id = ? AND revision_key = ?`,
        row.occurrenceId, row.revisionKey);
      sqlBindings.push({ occurrenceId: row.occurrenceId, revisionKey: row.revisionKey,
        cacheKey: b ? b.cache_key : null, provenance: b ? b.provenance : null });
      if (seenKeys.has(row.cacheKey)) continue;
      seenKeys.add(row.cacheKey);
      const idx = this._oneOrNull(`SELECT * FROM cache_index WHERE cache_key = ?`, row.cacheKey);
      cacheAnchors.push({ cacheKey: row.cacheKey, identity: idx ? idx.identity : null,
        sha256: idx ? idx.sha256 : null, format: idx ? idx.format : null });
    }
    const chk = this._migrationCompleteness(bookId);
    return { bookId,
      content: contentEnt ? { revision: contentEnt.revision,
        tombstone: !!contentEnt.deleted,
        occurrenceIds: (JSON.parse(contentEnt.data_json || "{}").occurrenceIds) || [] } : null,
      importRecord: book ? { migrationId: book.migration_id,
        freezeDigest: book.freeze_digest, rowCount: book.row_count,
        rowsSha256: book.rows_sha256, importedAt: book.imported_at,
        certificateSha256: book.certificate_sha256 ?? null } : null,
      pinnedFreeze: (() => { const pb = this._pinnedBook(bookId);
        return pb ? { inApprovedFreeze: true, rowSetSha256: pb.rowSetSha256 }
                  : { inApprovedFreeze: false, rowSetSha256: null }; })(),
      syncBindings, sqlBindings, cacheAnchors,
      gate: gate ? { flipped: true, migrationId: gate.migration_id,
        certificateSha256: gate.certificate_sha256, flippedAt: gate.flipped_at } : null,
      completeness: { complete: chk.complete, missing: chk.missing,
        divergences: chk.divergences } };
  }

  // Position events: append-only journal, deterministic fold.
  // Event identity is (bookId, eventId) WITH payload equivalence:
  // the same id carrying a different payload is a conflict, never
  // a silent replay (Rowan invariant 2).
  _pushPositionEvents(p, commandId) {
    const bookId = p.bookId;
    const events = Array.isArray(p.events) ? p.events : [];
    if (this._bookTombstoned(bookId))
      return { outcome: "applied", bookId,
               outcomes: events.map(ev => ({ eventId: ev.eventId, status: "rejected", reason: "tombstoned" })) };
    const content = this._syncEntity("content", bookId);
    if (!content || content.deleted)
      return { outcome: "rejected", reason: "unknown_book", bookId };
    const occIds = (JSON.parse(content.data_json || "{}").occurrenceIds) || [];
    const outcomes = events.map(ev => this._appendPositionEvent(bookId, occIds, ev));
    return { outcome: "applied", bookId, outcomes };
  }

  _appendPositionEvent(bookId, occIds, ev) {
    const canonical = JSON.stringify({
      deviceId: ev.deviceId, localSeq: ev.localSeq, kind: ev.kind,
      occurrenceId: ev.occurrenceId, offsetSec: ev.offsetSec, baseSeq: ev.baseSeq });
    const prior = this._oneOrNull(
      `SELECT * FROM position_events WHERE book_id = ? AND event_id = ?`, bookId, ev.eventId);
    if (prior) {
      return prior.payload_json === canonical
        ? { eventId: ev.eventId, status: "replay", receiptSeq: prior.receipt_seq, superseded: !!prior.superseded }
        : { eventId: ev.eventId, status: "conflict", reason: "event_id_payload_mismatch" };
    }
    const st = this._oneOrNull(`SELECT * FROM position_state WHERE book_id = ?`, bookId)
      || { occurrence_id: null, occ_index: null, offset_sec: null, playing: 0, tip: 0, superseded_count: 0 };
    if (typeof ev.baseSeq !== "number" || ev.baseSeq > st.tip)
      return { eventId: ev.eventId, status: "rejected", reason: "base_ahead" };
    const idx = occIds.indexOf(ev.occurrenceId);
    if (idx < 0) return { eventId: ev.eventId, status: "rejected", reason: "unknown_occurrence" };
    if (typeof ev.offsetSec !== "number" || !(ev.offsetSec >= 0))
      return { eventId: ev.eventId, status: "rejected", reason: "invalid_offset" };
    if (!["play", "pause", "seek", "checkpoint"].includes(ev.kind))
      return { eventId: ev.eventId, status: "rejected", reason: "invalid_kind" };
    // Staleness is causal, never clock-based: an event created
    // against an older journal tip is stale. A stale event that
    // would move canonical position BACKWARD is recorded but
    // superseded; stale-forward and fresh events fold normally
    // (a deliberate re-read on a synced device is fresh, so it
    // always applies).
    const stale = ev.baseSeq < st.tip;
    const backward = st.occ_index !== null &&
      (idx < st.occ_index || (idx === st.occ_index && ev.offsetSec < st.offset_sec));
    const superseded = stale && backward;
    const receiptSeq = st.tip + 1;
    this.sql.exec(`INSERT INTO position_events (book_id, event_id, receipt_seq, device_id, local_seq,
        kind, occurrence_id, offset_sec, base_seq, superseded, payload_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      bookId, ev.eventId, receiptSeq, ev.deviceId, ev.localSeq, ev.kind,
      ev.occurrenceId, ev.offsetSec, ev.baseSeq, superseded ? 1 : 0, canonical);
    let { occurrence_id, occ_index, offset_sec, playing, superseded_count } = st;
    if (!superseded) {
      occurrence_id = ev.occurrenceId; occ_index = idx; offset_sec = ev.offsetSec;
      if (ev.kind === "play") playing = 1;
      if (ev.kind === "pause") playing = 0;
    } else superseded_count += 1;
    this.sql.exec(
      `INSERT INTO position_state (book_id, occurrence_id, occ_index, offset_sec, playing, tip, superseded_count)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(book_id) DO UPDATE SET occurrence_id = excluded.occurrence_id,
         occ_index = excluded.occ_index, offset_sec = excluded.offset_sec,
         playing = excluded.playing, tip = excluded.tip, superseded_count = excluded.superseded_count`,
      bookId, occurrence_id, occ_index, offset_sec, playing, receiptSeq, superseded_count);
    this._appendChange("position", bookId, bookId, receiptSeq, "event",
      { ...ev, receiptSeq, superseded });
    return { eventId: ev.eventId, status: "accepted", receiptSeq, superseded };
  }

  positionView(bookId) {
    const st = this._oneOrNull(`SELECT * FROM position_state WHERE book_id = ?`, bookId);
    if (!st) return { bookId, canonical: null, asOfReceiptSeq: 0, supersededCount: 0, journalGaps: [] };
    const byDevice = new Map();
    for (const r of this._all(
      `SELECT device_id, local_seq FROM position_events WHERE book_id = ? ORDER BY device_id, local_seq`, bookId)) {
      if (!byDevice.has(r.device_id)) byDevice.set(r.device_id, []);
      byDevice.get(r.device_id).push(r.local_seq);
    }
    const journalGaps = [];
    for (const [deviceId, seqs] of byDevice) {
      const present = new Set(seqs);
      const missing = [];
      for (let s = Math.min(...seqs); s <= Math.max(...seqs); s++)
        if (!present.has(s)) missing.push(s);
      if (missing.length) journalGaps.push({ deviceId, missing });
    }
    return { bookId,
             canonical: { occurrenceId: st.occurrence_id, offsetSec: st.offset_sec, playing: !!st.playing },
             asOfReceiptSeq: st.tip, supersededCount: st.superseded_count, journalGaps };
  }

  // Pull: pinned-watermark snapshot window. sinceSeq is EXCLUSIVE;
  // resync triggers only when the cursor fell below the retained
  // floor (sinceSeq < floor - 1) — sinceSeq = 0 against a history
  // starting at 1 is the normal first pull, never a resync.
  pullChanges({ family, sinceSeq = 0, limit = 200, cursor } = {}) {
    if (!SYNC_FAMILIES.includes(family)) return { error: "unknown_family", family };
    let wm;
    if (cursor !== undefined && cursor !== null) {
      if (cursor.family !== family) return { error: "invalid_cursor", reason: "family_mismatch" };
      sinceSeq = cursor.seq; wm = cursor.watermark;
      if (typeof wm !== "number" || wm < sinceSeq) return { error: "invalid_cursor", reason: "watermark_behind_cursor" };
      if (wm > this._syncTip(family)) return { error: "invalid_cursor", reason: "watermark_ahead_of_tip" };
    }
    const floor = this._syncFloor(family);
    if (sinceSeq < floor - 1) return { resyncRequired: true, family, floorSeq: floor };
    if (wm === undefined) wm = this._syncTip(family);
    const rows = this._all(
      `SELECT * FROM sync_changes WHERE family = ? AND seq > ? AND seq <= ? ORDER BY seq LIMIT ?`,
      family, sinceSeq, wm, Math.max(1, Math.min(limit, 500)));
    const nextSeq = rows.length ? rows[rows.length - 1].seq : sinceSeq;
    return { family, changes: rows.map(r => ({
               seq: r.seq, entityKey: r.entity_key, bookId: r.book_id,
               revision: r.revision, op: r.op,
               payload: r.payload_json ? JSON.parse(r.payload_json) : null })),
             nextSeq, highWatermark: wm, hasMore: nextSeq < wm,
             cursor: { family, seq: nextSeq, watermark: wm } };
  }

  syncSnapshot({ family } = {}) {
    if (!SYNC_FAMILIES.includes(family)) return { error: "unknown_family", family };
    const watermark = this._syncTip(family);
    if (family === "position") {
      const books = this._all(`SELECT book_id FROM position_state ORDER BY book_id`)
        .map(r => this.positionView(r.book_id));
      return { family, watermark, positions: books };
    }
    const entities = this._all(
      `SELECT * FROM sync_entities WHERE family = ? ORDER BY entity_key`, family)
      .map(e => ({ entityKey: e.entity_key, bookId: e.book_id, revision: e.revision,
                   tombstone: !!e.deleted,
                   data: e.data_json ? JSON.parse(e.data_json) : null }));
    return { family, watermark, entities };
  }

  // Phase-two sweep, DRY RUN ONLY (P4 scope): proves references and
  // reports a manifest; deletes nothing. FAILS CLOSED (P4 review
  // blocker 2): any unproven reference — a live job, an incomplete
  // binding of this book, OR an incomplete binding anywhere else
  // (which could be hiding a reference to a candidate object) —
  // empties the manifest entirely and names the blockers. A partial
  // manifest is never emitted.
  sweepDryRun(bookId) {
    const content = this._syncEntity("content", bookId);
    if (!content || !content.deleted) return { error: "not_tombstoned", bookId };
    const blockers = [];
    const liveJobs = this._one(
      `SELECT COUNT(*) AS n FROM jobs WHERE book_id = ? AND state NOT IN ('complete', 'cancelled', 'failed')`,
      bookId).n;
    if (liveJobs > 0) blockers.push(`live_jobs:${liveJobs}`);
    const bindings = this._all(
      `SELECT * FROM sync_entities WHERE family = 'bindings' AND book_id = ?`, bookId);
    const keyOf = json => { try { return JSON.parse(json || "{}").cacheKey || null; } catch { return null; } };
    const ownKeys = new Map();
    for (const b of bindings) {
      const key = keyOf(b.data_json);
      if (!key) blockers.push(`incomplete_own_binding:${b.entity_key}`);
      else ownKeys.set(b.entity_key, key);
    }
    const otherKeys = new Set();
    for (const r of this._all(
      `SELECT entity_key, data_json FROM sync_entities WHERE family = 'bindings' AND (book_id IS NULL OR book_id != ?)`, bookId)) {
      const key = keyOf(r.data_json);
      if (!key) blockers.push(`incomplete_cross_book_binding:${r.entity_key}`);
      else otherKeys.add(key);
    }
    if (blockers.length > 0)
      return { bookId, tombstoned: true, dryRun: true, deletedAnything: false,
               liveJobs, conservative: true, blockedBy: blockers,
               sharedKept: [], wouldRemove: [],
               note: "fail closed: references unproven — manifest withheld in full" };
    const wouldRemove = [{ family: "content", entityKey: bookId }];
    const sharedKept = [];
    for (const [entityKey, key] of ownKeys) {
      if (otherKeys.has(key)) { sharedKept.push(key); continue; }
      wouldRemove.push({ family: "bindings", entityKey, cacheKey: key });
    }
    return { bookId, tombstoned: true, dryRun: true, deletedAnything: false,
             liveJobs, sharedKept, wouldRemove, conservative: false, blockedBy: [],
             note: "all references proven inside one read; manifest complete" };
  }

}

// F7 chapter-state derivation (§1.3): a pure function over the chapter's
// occurrence states and covering job states. Every surface renders this
// verbatim (B8); it is defined here, once.
export function deriveChapterState(occurrenceStates, coveringJobStates) {
  const occ = occurrenceStates || [];
  const jobs = coveringJobStates || [];
  // Completeness is a fact about the audio, not about job bookkeeping:
  // a fully recorded chapter is Complete even if a stale covering job
  // still claims to be generating or parked (P2 review finding 4).
  if (occ.length > 0 && occ.every(s => s === "ready")) return "Complete";
  if (occ.includes("outcome_unknown") || jobs.includes("outcome_unknown")) return "Outcome Unknown";
  if (jobs.some(s => s === "generating" || s === "queued")) return "Generating";
  if (jobs.includes("paused_quota")) return "Quota Paused";
  const ready = occ.filter(s => s === "ready").length;
  const blocked = occ.filter(s => s === "blocked_policy").length;
  if (occ.length > 0 && ready === occ.length) return "Complete";
  if (blocked > 0 && ready === 0) return "Blocked";
  if (ready > 0) return "Partial";
  if (jobs.includes("failed")) return "Failed";
  return "Partial";
}
