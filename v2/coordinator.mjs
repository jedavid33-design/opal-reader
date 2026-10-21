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
];

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
  created_at INTEGER NOT NULL, sent_at INTEGER);
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

export class GenerationCoordinator {
  constructor(state, env = {}) {
    this.state = state;
    this.env = env;
    this._txDepth = 0;
    this.sql = state.storage.sql;
    // Schema DDL is idempotent and runs on writable instances. Read-only
    // facades (the GET API) pass ASSUME_SCHEMA: the tables exist because
    // every writable wake creates them first.
    if (!env.ASSUME_SCHEMA) this.sql.exec(SCHEMA);
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
    const r = this._one(`SELECT value FROM meta WHERE key = 'frozen'`);
    return r && r.value === "1";
  }

  // ---- job aggregate: the single applier ---------------------------------
  // Every job state change in the system funnels through here. The
  // transition must exist in JOB_TRANSITIONS and the caller's expected
  // revision must match, in the caller's transaction — otherwise the
  // event is rejected and the rejection is logged (I12).
  applyJobEvent(jobId, event, cause, detail = null, expectedRevision = null) {
    const job = this._one(`SELECT * FROM jobs WHERE job_id = ?`, jobId);
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
    const occ = this._one(
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
    const existing = this._one(`SELECT * FROM commands WHERE command_id = ?`, cmd.command_id);
    if (existing) {
      return { command_id: existing.command_id, outcome: existing.outcome,
               ...(existing.outcome_json ? JSON.parse(existing.outcome_json) : {}),
               replayed: true };
    }
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
        result = this._applyCommand(cmd.type, cmd.payload || {}, cmd.command_id);
      this.sql.exec(`UPDATE commands SET outcome = ?, outcome_json = ? WHERE command_id = ?`,
        result.outcome, JSON.stringify(result), cmd.command_id);
      return result;
    });
    await this._armAlarmIfEarlier(); // the command may have scheduled earlier work
    return { command_id: cmd.command_id, ...outcome };
  }

  _applyCommand(type, p, commandId) {
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
    const dupe = this._one(`SELECT job_id FROM jobs WHERE job_id = ?`, p.jobId);
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
    const job = this._one(`SELECT * FROM jobs WHERE job_id = ?`, p.jobId);
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
      const b = this._one(
        `SELECT * FROM bindings WHERE occurrence_id = ? AND revision_key = ?`,
        p.occurrenceId, p.revisionKey);
      if (b) return { outcome: "applied", answer: "cached", cacheKey: b.cache_key };
      // One in-flight operation per (occurrence, revision), whoever asked
      // (P2 review round 2, gap 1): two devices requesting the same audio
      // before either recording exists share the operation — the second
      // request joins it instead of paying for a duplicate synthesis.
      const dupe = this._one(
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
      const job = this._one(`SELECT * FROM jobs WHERE job_id = ?`, jobId);
      if (!job) return { ok: false, reason: "job_not_found" };
      const park = this._one(
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
      const dupe = this._one(`SELECT grant_id FROM grants WHERE grant_id = ?`, grantId);
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
  // resolves. A throw or rejection leaves the row unsent for the next
  // drain; a missing handler delivers nothing and marks nothing.
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
        ? this._one(`SELECT * FROM jobs WHERE job_id = ?`, payload.jobId) : null;
      if (job && ["paused_user", "paused_quota", "cancelled", "superseded"].includes(job.state)) {
        this._tx(() => this._voidDispatch(payload, job.state));
        continue;
      }
      // Delivery fence (round 4, Rowan blocker 1): a dispatch may leave
      // ONLY while its grant is live — state 'issued', issued against the
      // job's CURRENT revision, and inside its delivery window. Anything
      // else is provably unsent work and must never be handed to the
      // provider late: expired/revision-stale grants are voided with
      // their reservations released (the work re-grants fresh); rows
      // belonging to settled grants are debris and are cleared without
      // touching accounting (their spend already settled by report).
      if (payload.grantId) {
        const grant = this._one(`SELECT * FROM grants WHERE grant_id = ?`, payload.grantId);
        if (!grant || grant.state !== "issued") {
          this.sql.exec(`DELETE FROM outbox WHERE id = ?`, row.id);
          this._logTransition("grant", payload.grantId, "dispatch_debris_cleared",
            grant ? grant.state : null, grant ? grant.state : null, null,
            { jobId: payload.jobId });
          continue;
        }
        if (job && grant.revision !== job.revision) {
          this._tx(() => this._voidDispatch(payload, "revision_stale"));
          continue;
        }
        if (this._now() > grant.lease_expires_at) {
          this._tx(() => this._voidDispatch(payload, "delivery_window_expired"));
          continue;
        }
      }
      try {
        await send(payload);
      } catch {
        continue; // unacknowledged: stays unsent, retried by a later drain
      }
      this.sql.exec(`UPDATE outbox SET sent_at = ? WHERE id = ?`, this._now(), row.id);
      if (payload.grantId) {
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
  _voidDispatch(payload, reason) {
    const jobState = reason;
    const grantId = payload.grantId;
    const ops = this._all(
      `SELECT * FROM ledger_ops WHERE kind = 'attempt' AND op_key LIKE ?`,
      `op:${grantId}:%`);
    for (const op of ops) {
      // Release this attempt's reservation exactly once: the provider
      // was never contacted for it, so it must not consume quota or cap.
      const relKey = `rel:${op.op_key}`;
      if (!this._one(`SELECT op_key FROM ledger_ops WHERE op_key = ?`, relKey)) {
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
      const o = this._one(
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
    const row = this._one(`SELECT * FROM ledger_ops WHERE op_key = ?`, opKey);
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
    const row = this._one(`SELECT * FROM ledger_ops WHERE op_key = ?`, opKey);
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
      const grant = this._one(`SELECT * FROM grants WHERE grant_id = ?`, report.grantId);
      if (!grant) return { ok: false, reason: "grant_not_found" };
      if (grant.state === "reported")
        return { ok: true, replayed: true };
      const job = this._one(`SELECT * FROM jobs WHERE job_id = ?`, grant.job_id);
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
        const o = this._one(
          `SELECT * FROM occurrences WHERE job_id = ? AND occurrence_id = ?`, grant.job_id, oid);
        if (o && o.state === "granted")
          this.applyOccEvent(grant.job_id, oid, "defer", "report:grant_closed",
            { grantId: grant.grant_id });
      }
      this.sql.exec(`UPDATE grants SET state = 'reported', report_json = ? WHERE grant_id = ?`,
        JSON.stringify(report), grant.grant_id);
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
      const jobRow = this._one(`SELECT * FROM jobs WHERE job_id = ?`, grant.job_id);
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
    const idx = this._one(`SELECT * FROM cache_index WHERE cache_key = ?`, cacheKey);
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
    const existing = this._one(
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
      const occ = this._one(
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
      const entry = this._one(
        `SELECT detail_json FROM transitions
          WHERE aggregate = 'occurrence' AND aggregate_id = ? AND to_state = 'outcome_unknown'
          ORDER BY id DESC LIMIT 1`, `${jobId}/${occurrenceId}`);
      const sourceGrantId = entry
        ? (JSON.parse(entry.detail_json || "{}").grantId || null) : null;
      const sourceGrant = sourceGrantId
        ? this._one(`SELECT * FROM grants WHERE grant_id = ?`, sourceGrantId) : null;
      const spend = (sourceGrant && sourceGrant.job_id === jobId)
        ? this._one(`SELECT * FROM ledger_ops WHERE op_key = ?`,
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
      const occ = this._one(
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
      const job = this._one(`SELECT * FROM jobs WHERE job_id = ?`, jobId);
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
    const row = this._one(`SELECT * FROM settings WHERE id = 1`);
    if (!row) return { monthlyCap: 50, geminiLane: "batch", revision: 0 };
    return { ...JSON.parse(row.data_json), revision: row.revision };
  }

  _setSettings(p, commandId) {
    const cur = this._one(`SELECT * FROM settings WHERE id = 1`);
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
        const grant = this._one(`SELECT * FROM grants WHERE grant_id = ?`, row.ref);
        if (!grant || grant.state === "reported" || grant.state === "voided") break;
        // Pre-delivery expiry (round 4, Rowan blocker 1): provider
        // uncertainty may be inferred ONLY for work provably handed
        // off. Delivery is proven by the outbox row's sent_at — the
        // acknowledged handoff. A grant whose dispatch never left has
        // NO unknown outcome to record: void the dispatch, release its
        // reservations, and return its occurrences to pending so the
        // work can be granted fresh. No phantom outcome_unknown, ever.
        const outRow = this._one(`SELECT * FROM outbox WHERE id = ?`, grant.grant_id);
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
          if (outRow) {
            this._tx(() => this._voidDispatch(
              { grantId: grant.grant_id, jobId: grant.job_id },
              "lease_expired_undelivered"));
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
        // Bounded-backoff continuation after generic 429s / plan steps.
        const job = this._one(`SELECT * FROM jobs WHERE job_id = ?`, row.ref);
        if (job && job.state === "generating") await this.requestGrant(row.ref, { cause: "retry_grant" });
        break;
      }
      default: break; // plan_step kinds are interpreted by their owners
    }
  }

  // ---- read models (pure — used by the GET API; no writes) -------------------
  receipt(commandId) {
    const c = this._one(`SELECT * FROM commands WHERE command_id = ?`, commandId);
    if (!c) return null;
    return { command_id: c.command_id, type: c.type, outcome: c.outcome,
             ...(c.outcome_json ? JSON.parse(c.outcome_json) : {}),
             received_at: c.received_at };
  }

  jobView(jobId) {
    const job = this._one(`SELECT * FROM jobs WHERE job_id = ?`, jobId);
    if (!job) return null;
    const occs = this._all(
      `SELECT occurrence_id, revision_key, state, cache_key FROM occurrences WHERE job_id = ? ORDER BY occurrence_id`,
      jobId);
    return { jobId: job.job_id, kind: job.kind, bookId: job.book_id,
             chapterIndex: job.chapter_index, lane: job.lane, state: job.state,
             revision: job.revision, occurrences: occs };
  }

  quotaView() {
    const now = this._now();
    const day = dayKeyPT(now), month = monthKey(now);
    const attemptsToday = this._attemptsOn(day);
    const spentMonth = this._spendIn(month);
    const park = this._one(
      `SELECT * FROM quota_parks WHERE released_at IS NULL ORDER BY id DESC LIMIT 1`);
    return { dayKey: day, attemptsToday, dailyLimit: DAILY_QUOTA_LIMIT,
             basis: "Reader estimate (server attempt ledger)",
             monthKey: month, spentMicroCents: spentMonth,
             monthlyCap: this._settings().monthlyCap,
             parked: park ? { parkedAt: park.parked_at,
                              evidence: JSON.parse(park.evidence_json || "{}") } : null };
  }

  settingsView() { return this._settings(); }

  conflictsView() {
    return this._all(`SELECT * FROM binding_conflicts ORDER BY id DESC LIMIT 100`);
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
