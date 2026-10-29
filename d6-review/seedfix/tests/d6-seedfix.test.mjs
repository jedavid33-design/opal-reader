// D6 SEED-FIX — the seed route's admission correction (Rowan
// design pass 6509192325, Option (a) with strict conditions).
//
// The G2 dual-credential shape (full client gate + operator
// admission on ONE request) is unreachable through the
// credential-exchange transport, which refuses any request
// carrying two credential surrogates (HTTP 403
// credential_ambiguity — the Oct 29, 2026 arming attempt's seed
// call never reached the Worker; same wall as the Oct 23, 2026
// D4 pilot). The correction admits POST /v2/d6-seed-storage on
// the migration-operator credential ALONE — the Option D
// operator-route shape — and changes NOTHING else:
//
//   F1  client token only            -> denied (operator fence)
//   F2  no credentials               -> denied (operator fence)
//   F3  operator only, halted        -> admitted; seed APPLIES
//        from the worker's own recount; state recorded with
//        provenance; no credential reflected in the response
//   F4  operator only, NOT halted    -> generation_not_halted
//   F5  operator only + figures      -> caller_figures_refused
//   F6  operator only + bucket drift -> recount_mismatch
//   F7  replay of F3                 -> idempotent, state stands
//   F8  cross-route regression: normal routes still require the
//       client token (operator alone does NOT admit them), the
//       client token still admits them, and the Option D
//       operator routes behave exactly as before.
//
// All synthetic: invented tokens, a metadata-only list stub
// totaling the recorded base. No production contact, no writes
// outside the in-memory harness store.
import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";

import { RECORDED_STORAGE_BASE } from "../worker/generation/gen-constants.mjs";
import D6Entry, * as d6Module from "../worker/worker-entry-prod-d6.js";

const D6Prod = d6Module.OpalReaderCoordinatorProd;
const TOK = "prod-client-token-synthetic";
const OPTOK = "prod-operator-token-synthetic";
const ORIGIN = "https://jedavid33-design.github.io";

// ---------------------------------------------------------------------------
// Harness (same idiom as tests/d6-seed-hardening.test.mjs)
// ---------------------------------------------------------------------------

class SqlCursor {
  constructor(rows) { this._rows = rows; }
  one() {
    if (this._rows.length === 0) throw new Error("Expected exactly one result from SQL query, but got no results.");
    if (this._rows.length > 1) throw new Error(`Expected exactly one result from SQL query, but got ${this._rows.length} results.`);
    return this._rows[0];
  }
  toArray() { return [...this._rows]; }
  [Symbol.iterator]() { return this._rows[Symbol.iterator](); }
}
class SqlFacade {
  constructor(db) { this.db = db; }
  exec(query, ...params) {
    if (params.length === 0 && query.includes(";")) { this.db.exec(query); return new SqlCursor([]); }
    const stmt = this.db.prepare(query);
    const verb = query.trimStart().slice(0, 6).toUpperCase();
    if (verb.startsWith("SELECT") || verb.startsWith("WITH")) return new SqlCursor(stmt.all(...params));
    const info = stmt.run(...params);
    return new SqlCursor([{ changes: Number(info.changes), lastInsertRowid: Number(info.lastInsertRowid) }]);
  }
}
function makeDoState() {
  const db = new DatabaseSync(":memory:");
  let alarmAt = null;
  const storage = {
    sql: new SqlFacade(db),
    transactionSync(fn) {
      db.exec("BEGIN IMMEDIATE");
      try { const r = fn(); db.exec("COMMIT"); return r; }
      catch (e) { try { db.exec("ROLLBACK"); } catch { /* noop */ } throw e; }
    },
    async setAlarm(ms) { alarmAt = ms; },
    async getAlarm() { return alarmAt; },
    async deleteAlarm() { alarmAt = null; },
  };
  return { db, state: { storage } };
}

// Metadata-only bucket whose list totals EXACTLY the recorded
// base across pages (bulk object + 1-byte objects), like R2.
function recordedBucket({ driftBytes = 0 } = {}) {
  const total = RECORDED_STORAGE_BASE.objectCount;
  const bulk = RECORDED_STORAGE_BASE.baseBytes - (total - 1) + driftBytes;
  return {
    async list({ limit = 1000, cursor } = {}) {
      const start = cursor ? Number(cursor) : 0;
      const n = Math.min(limit, total - start);
      const objects = [];
      for (let i = 0; i < n; i++)
        objects.push({ key: `k${start + i}`, size: (start + i) === 0 ? bulk : 1 });
      const truncated = start + n < total;
      return { objects, truncated, ...(truncated ? { cursor: String(start + n) } : {}) };
    },
  };
}

function world({ bucket = recordedBucket(), entryExtra = {}, classExtra = {} } = {}) {
  const { db, state } = makeDoState();
  const inst = new D6Prod(state, {
    OPALREADER_V2_SCOPE: "production", OPALREADER_ACCESS_TOKEN: TOK,
    GENERATION_HALT: "1", OPALREADER_STORAGE: bucket, ALLOWED_ORIGIN: ORIGIN,
    ...classExtra,
  });
  const ns = { idFromName: n => n, get: () => ({ fetch: (req) => inst.fetch(req) }) };
  const entryEnv = {
    OPALREADER_V2_SCOPE: "production", OPALREADER_ACCESS_TOKEN: TOK,
    OPALREADER_MIGRATION_OPERATOR_TOKEN: OPTOK,
    GENERATION_HALT: "1", COORDINATOR: ns, ALLOWED_ORIGIN: ORIGIN,
    ...entryExtra,
  };
  const call = ({ method = "POST", path = "/v2/d6-seed-storage",
                  token = null, operator = OPTOK, headers = {}, body = {} } = {}) =>
    D6Entry.fetch(new Request(`https://w.test${path}`, {
      method,
      headers: {
        ...(token === null ? {} : { "x-opalreader-token": token }),
        ...(operator === null ? {} : { "x-opalreader-operator-token": operator }),
        "x-opalreader-scope": "production", "x-opalreader-instance": "account",
        "content-type": "application/json", ...headers,
      },
      body: method === "GET" ? undefined : JSON.stringify(body),
    }), entryEnv);
  const rows = () => db.prepare("SELECT COUNT(*) AS n FROM d6_storage_state").get().n;
  return { db, inst, entryEnv, call, rows };
}

// ---------------------------------------------------------------------------
// Rowan's named set
// ---------------------------------------------------------------------------

test("F1: client token only -> denied at the operator fence, no row", async () => {
  const w = world();
  const r = await w.call({ token: TOK, operator: null });
  assert.equal(r.status, 403);
  assert.equal((await r.json()).error, "migration_operator_required");
  const wrong = await w.call({ token: TOK, operator: "not-the-operator-token" });
  assert.equal(wrong.status, 403);
  assert.equal(w.rows(), 0, "refusals never reach the store");
});

test("F2: no credentials at all -> denied at the operator fence, no row", async () => {
  const w = world();
  const r = await w.call({ token: null, operator: null });
  assert.equal(r.status, 403,
    "with the client-token check skipped for this route, the operator fence is the denial that fires");
  assert.equal((await r.json()).error, "migration_operator_required");
  assert.equal(w.rows(), 0);
});

test("F3: operator only, halted -> admitted; seed applies from the worker recount; state recorded", async () => {
  const w = world();
  const r = await w.call({ token: null });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.outcome, "applied");
  assert.deepEqual(body.recounted,
    { baseBytes: RECORDED_STORAGE_BASE.baseBytes, objectCount: RECORDED_STORAGE_BASE.objectCount });
  assert.equal(body.baseBytes, RECORDED_STORAGE_BASE.baseBytes);
  assert.equal(body.objectCount, RECORDED_STORAGE_BASE.objectCount);
  assert.ok(body.seededAt, "seededAt recorded");
  assert.equal(body.provenance.length, 1);
  assert.equal(body.provenance[0].source, "worker-recount");
  const raw = JSON.stringify(body);
  assert.ok(!raw.includes(OPTOK) && !raw.includes(TOK),
    "no credential is reflected in the response");
  const row = w.db.prepare("SELECT * FROM d6_storage_state WHERE id = 1").get();
  assert.equal(row.base_bytes, RECORDED_STORAGE_BASE.baseBytes);
  assert.equal(row.object_count, RECORDED_STORAGE_BASE.objectCount);
  assert.ok(row.seeded_at, "the stored row carries seeded_at");
});

test("F4: operator only, NOT halted -> generation_not_halted, no mutation", async () => {
  const w = world({ classExtra: { GENERATION_HALT: "0" } });
  const r = await w.call({ token: null });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.outcome, "rejected");
  assert.equal(body.reason, "generation_not_halted");
  assert.equal(w.rows(), 0);
});

test("F5: operator only + caller figures -> caller_figures_refused, no mutation", async () => {
  const w = world();
  const r = await w.call({
    token: null,
    body: { baseBytes: RECORDED_STORAGE_BASE.baseBytes, objectCount: RECORDED_STORAGE_BASE.objectCount },
  });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.outcome, "rejected");
  assert.equal(body.reason, "caller_figures_refused");
  assert.equal(w.rows(), 0);
});

test("F6: operator only + one byte of bucket drift -> recount_mismatch, no mutation", async () => {
  const w = world({ bucket: recordedBucket({ driftBytes: 1 }) });
  const r = await w.call({ token: null });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.outcome, "rejected");
  assert.equal(body.reason, "recount_mismatch");
  assert.deepEqual(body.recounted,
    { baseBytes: RECORDED_STORAGE_BASE.baseBytes + 1, objectCount: RECORDED_STORAGE_BASE.objectCount });
  assert.equal(w.rows(), 0);
});

test("F7: replay — a second identical operator-only call is idempotent and changes nothing", async () => {
  const w = world();
  const first = await (await w.call({ token: null })).json();
  assert.equal(first.outcome, "applied");
  const second = await (await w.call({ token: null })).json();
  assert.equal(second.outcome, "applied");
  assert.equal(second.idempotent, true, "same-values re-seed is the store's idempotent path");
  assert.equal(second.baseBytes, RECORDED_STORAGE_BASE.baseBytes);
  assert.equal(second.provenance.length, 1, "replay appends no provenance");
  assert.equal(w.rows(), 1, "still exactly one seed row");
});

test("F8: cross-route regression — normal routes keep the client gate; Option D routes unchanged", async () => {
  const w = world();

  // Operator alone does NOT admit a normal client route.
  const settingsOpOnly = await w.call({ method: "GET", path: "/v2/settings", operator: OPTOK });
  assert.equal(settingsOpOnly.status, 401, "GET /v2/settings still requires the client token");
  const settingsNone = await w.call({ method: "GET", path: "/v2/settings", operator: null });
  assert.equal(settingsNone.status, 401);
  const commandsOpOnly = await w.call({
    path: "/v2/commands", operator: OPTOK,
    body: { command_id: "seedfix-probe", type: "SetSettings", payload: { baseRevision: 0, data: {} } },
  });
  assert.equal(commandsOpOnly.status, 401, "POST /v2/commands still requires the client token");

  // The client token still admits normal routes.
  const settingsClient = await w.call({ method: "GET", path: "/v2/settings", token: TOK, operator: null });
  assert.equal(settingsClient.status, 200);
  assert.equal((await settingsClient.json()).revision, 0);

  // The Option D operator routes behave exactly as before:
  // operator alone is admitted past the entry fences (the
  // downstream refusal for an unknown command is the API's, not
  // a gate error); client alone and neither are refused at the
  // operator fence.
  const approval = { commandId: "seedfix-unknown-command", payloadSha256: "0".repeat(64) };
  const opRoute = await w.call({ path: "/v2/command-approvals", operator: OPTOK, body: approval });
  const opBody = await opRoute.json();
  assert.notEqual(opRoute.status, 401);
  assert.notEqual(opBody.error, "migration_operator_required");
  assert.notEqual(opBody.error, "production_scope_required");
  const opClientOnly = await w.call({ path: "/v2/command-approvals", token: TOK, operator: null, body: approval });
  assert.equal(opClientOnly.status, 403);
  assert.equal((await opClientOnly.json()).error, "migration_operator_required");
  const opNone = await w.call({ path: "/v2/command-approvals", operator: null, body: approval });
  assert.equal(opNone.status, 403);
  assert.equal((await opNone.json()).error, "migration_operator_required");

  // None of the regression probes seeded anything.
  assert.equal(w.rows(), 0);
});
