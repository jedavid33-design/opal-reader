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
import { APPROVED_FREEZE_CHUNKS } from "./p8/approved-freeze-chunks.mjs";
import { APPROVED_FREEZE_CARRY } from "./p8/approved-freeze-carry.mjs";
import { MIGRATION_CHUNK_LIMITS } from "./p8/migration-chunk-limits.mjs";
import { D6_LANE_ALLOWLIST } from "./generation/gen-constants.mjs";
import { d6GrantGuard, d6PlanForJob } from "./generation/grant-guards.mjs";
import {
  reserveForGrant, boundGrantTargets, settleReservationsForGrant, closeReservationsForGrant,
  closeReservationsForVoidedGrant, quotaBudgetView,
} from "./generation/quota-budget.mjs";
import { prefixRangeClause } from "./generation/prefix-range.mjs";

export const JOB_STATES = [
  "queued", "generating", "paused_quota", "paused_user", "outcome_unknown",
  "complete", "partial", "failed", "cancelled", "superseded",
  // B1 (D4 proposal §3A.3): the migration-carried policy park. A
  // carried job is INSERTED in this state by MigrateImportJobs —
  // it is never submitted, never queued, and (empty transition
  // row below) no lifecycle event can move it. It exists so the
  // frozen record has a truthful home; generation over it is
  // impossible by construction, not by policy.
  "parked_policy",
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
  // B1: NO outbound transitions and no inbound lifecycle edges —
  // the only way a job enters parked_policy is the migration
  // carry's direct insert (§3A.3). Every event against a parked
  // job (resume, pause, cancel, resolve, park, grant, supersede,
  // settle reports) is an explicit logged rejection through
  // applyJobEvent.
  parked_policy:   {},
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
  "MigrateImportBindings", "MigrateRecordFlipGate", "MigrateImportChunk",
  "MigrateImportPositions", "MigrateImportJobs",
];

// The migration command types (G2 correction; Rowan re-review
// 6354569652). These are OPERATOR-ONLY: the server entry refuses
// them for ordinary client tokens before the coordinator is ever
// reached (v2/worker-entry.js + v2/api.mjs admission fence), and
// the coordinator independently pins what they may carry to the
// approved freeze (below). A command NAME is not authorization —
// this list exists so every layer fences the same set.
export const MIGRATION_COMMAND_TYPES = [
  "MigrateImportBindings", "MigrateRecordFlipGate", "MigrateImportChunk",
  // B1 (D4 proposal §3A.2/§3A.3): the carry commands ride the
  // SAME operator fence as the import commands — no new fence
  // machinery anywhere (entry peek, API admission, DO scope).
  "MigrateImportPositions", "MigrateImportJobs",
];

// P4 sync families. Position rides the same change machinery; money
// is NOT a family — it is never client-writable (coordinator ledger).
export const SYNC_FAMILIES = ["content", "bindings", "position", "settings"];

const WATCHDOG_PERIOD_MS = 10 * 60 * 1000;
const LEASE_MS = 15 * 60 * 1000;
// Option D two-phase constants (design §3.3.7, §3.10): a pending
// migration command awaits operator approval for at most 24
// hours; a claim's lease is 10 minutes — orders of magnitude
// beyond the bounded preparation time of the largest chunk; its
// only job is to make a dead claim DETECTABLE (its lapse leads to
// reconciliation, never to re-execution). Both are server-side
// constants and never client-controllable; env may override them
// (deployment configuration inside the trust boundary — the
// staging short-TTL configuration of §3.8 — and tests); request
// data never can.
const PENDING_COMMAND_TTL_MS = 24 * 60 * 60 * 1000;
const CLAIM_LEASE_MS = 10 * 60 * 1000;
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
-- P8 D3 chunked import (design §10): the chunked flow's bookkeeping.
-- migration_imports tracks one book's chunked import (the migration
-- identity, the carried content held back from the sync plane, and
-- completion); migration_chunks holds one row per APPLIED chunk —
-- its canonical row digest and the persisted class-C evidence
-- (per-row verification facts) the whole-book certificate is later
-- derived from. Neither table is a sync family: partial chunk state
-- is invisible to clients, and no migration_books row (hence no
-- gate) exists until the final chunk completes the book.
CREATE TABLE IF NOT EXISTS migration_imports (
  book_id TEXT PRIMARY KEY, migration_id TEXT NOT NULL,
  freeze_digest TEXT NOT NULL, content_json TEXT,
  chunks_expected INTEGER NOT NULL, started_at INTEGER NOT NULL,
  completed_at INTEGER, certificate_sha256 TEXT);
CREATE TABLE IF NOT EXISTS migration_chunks (
  book_id TEXT NOT NULL, chunk_index INTEGER NOT NULL,
  migration_id TEXT NOT NULL, rows_sha256 TEXT NOT NULL,
  row_count INTEGER NOT NULL, total_bytes INTEGER NOT NULL,
  evidence_json TEXT NOT NULL, command_id TEXT,
  applied_at INTEGER NOT NULL,
  PRIMARY KEY (book_id, chunk_index));
-- B1 (D4 proposal §3A.2/§3A.3/§3A.5): the migration-state carry
-- audit. One row per APPLIED carry command per book (kind
-- 'positions' | 'jobs'): the canonical payload the coordinator
-- accepted, its hash (positions: the payload hash; jobs: the
-- aggregate-set hash), and the command that carried it. The flip
-- gate and the read-back verify the stored coordinator state
-- against THIS audit and the carry pin — never against a
-- request echo.
CREATE TABLE IF NOT EXISTS migration_carry (
  id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL,
  migration_id TEXT, book_id TEXT NOT NULL, kind TEXT NOT NULL,
  command_id TEXT, payload_hash TEXT NOT NULL, payload_json TEXT NOT NULL);
-- Option D (transport plan update Part 3, Revision 3): the
-- two-phase pending-command store. One record per migration
-- command id submitted through the two-phase protocol: the
-- verbatim payload, its server-computed canonical hash, and the
-- §3.3.2 state machine's stored state. Final states carry the
-- final receipt (receipt_json); needs_reconciliation settlements
-- record their evidence in detail_json. Additive only — no
-- pre-existing table changes shape (§3.6).
CREATE TABLE IF NOT EXISTS pending_commands (
  command_id TEXT PRIMARY KEY, type TEXT NOT NULL, payload_json TEXT NOT NULL,
  migration_id TEXT, payload_sha256 TEXT NOT NULL, state TEXT NOT NULL,
  submitted_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
  claim_owner TEXT, claimed_at INTEGER,
  receipt_json TEXT, detail_json TEXT);
`;

export function dayKeyPT(nowMs) {
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
    // Option D replay fence (§3.3.4): a two-phase record under
    // this id is answered from the pending store — the state
    // view, or the final receipt for a final state — and is
    // NEVER executed or replayed as an outcome while non-final.
    // Without this fence, resubmitting a pending migration
    // command through this legacy dispatch would run it directly
    // and bypass the operator approval entirely.
    const pendingRec = this._pendingRecord(cmd.command_id);
    if (pendingRec) return this._pendingView(pendingRec);
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
    // D3 chunked import: the same discipline per chunk. The chunk
    // state check (pin match, limits, order, convergence) runs
    // BEFORE priming; only a chunk that would actually execute is
    // primed, and priming touches exactly that chunk's rows. A
    // replayed receipt returned above primes nothing; a converged
