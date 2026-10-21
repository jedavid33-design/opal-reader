// Test harness for the v2 coordinator: a Durable-Object-shaped runtime
// over REAL SQLite (node:sqlite), with a fake clock, simulated alarms,
// and crash = discarding the coordinator instance while keeping storage.
// The coordinator holds no in-memory state, so crash/restart here is the
// same operation as a DO eviction/restart in production.
import { DatabaseSync } from "node:sqlite";
import { GenerationCoordinator } from "../../v2/coordinator.mjs";

class SqlFacade {
  constructor(db) { this.db = db; }
  exec(query, ...params) {
    if (params.length === 0 && query.includes(";")) {
      this.db.exec(query); // DDL batch (schema)
      return { toArray: () => [], one: () => null };
    }
    const stmt = this.db.prepare(query);
    const isQuery = /^\s*(SELECT|WITH)\b/i.test(query);
    let rows = null;
    if (isQuery) rows = stmt.all(...params);
    else stmt.run(...params);
    return {
      toArray: () => rows ?? [],
      one: () => (rows && rows.length ? rows[0] : null),
    };
  }
}

export function makeHarness({ probe = null, startMs = 1760000000000 } = {}) {
  const db = new DatabaseSync(":memory:");
  let now = startMs;
  let alarmAt = null;
  const sentGrants = [];
  const storage = {
    sql: new SqlFacade(db),
    transactionSync(fn) {
      db.exec("BEGIN IMMEDIATE");
      try { const r = fn(); db.exec("COMMIT"); return r; }
      catch (e) { try { db.exec("ROLLBACK"); } catch {} throw e; }
    },
    // Cloudflare's alarm API is async — these return Promises on purpose,
    // so the coordinator can never pass by treating them synchronously.
    async setAlarm(ms) { alarmAt = ms; },
    async getAlarm() { return alarmAt; },
    async deleteAlarm() { alarmAt = null; },
  };
  const env = {
    now: () => now,
    probe,
    sendGrant: g => sentGrants.push(g),
    scheduleHook: null,
  };
  const state = { storage };
  let instance = new GenerationCoordinator(state, env);
  return {
    db, env, state, sentGrants,
    get coord() { return instance; },
    now: () => now,
    setNow(ms) { now = ms; },
    advance(ms) { now += ms; },
    alarmAt: () => alarmAt,
    crash() { instance = new GenerationCoordinator(state, env); return instance; },
    async fireAlarm() {
      if (alarmAt === null) return false;
      if (alarmAt > now) now = alarmAt;
      alarmAt = null; // the DO consumes the alarm before invoking
      await instance.alarm();
      return true;
    },
    snapshot() {
      const tables = ["commands", "jobs", "occurrences", "transitions", "grants",
        "outbox", "ledger_ops", "quota_parks", "schedule", "bindings",
        "cache_index", "binding_conflicts", "settings", "meta"];
      const out = {};
      for (const t of tables)
        out[t] = db.prepare(`SELECT * FROM ${t}`).all().map(r => ({ ...r }));
      return JSON.stringify(out);
    },
    rows(table) { return db.prepare(`SELECT * FROM ${table}`).all().map(r => ({ ...r })); },
  };
}

// A cache/R2 probe stub. `objects`: Map cacheKey -> { format, identity, sha }.
export function makeProbe(objects = new Map(), keyFor = null) {
  return {
    exists: k => objects.has(k),
    sniff: k => (objects.has(k) ? objects.get(k).format : null),
    recordedIdentity: k => (objects.has(k) ? objects.get(k).identity ?? null : null),
    hash: k => (objects.has(k) ? objects.get(k).sha ?? null : null),
    keyFor: keyFor || (() => null),
    _objects: objects,
  };
}

export const occ = (id, extra = {}) => ({
  occurrenceId: id, revisionKey: "fp-" + id, estMicroCents: 1000, ...extra,
});
export async function submit(coord, commandId, jobId, occurrences, extra = {}) {
  return coord.handleCommand({
    command_id: commandId, type: "SubmitJob",
    payload: { jobId, bookId: "book-1", chapterIndex: 0, lane: "standard",
               occurrences, data: { estMicroCents: 1000 }, ...extra },
  });
}
