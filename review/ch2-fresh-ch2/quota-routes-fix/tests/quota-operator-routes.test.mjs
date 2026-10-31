// Quota operator routes (QUOTA ROUTES PACKAGE; DP1, Rowan
// operational review 6546037460; Julie's repo-only build
// approval 6546054510).
//
// bootstrapQuota / disposeBootstrapException / reconcileQuota
// shipped in the quota guard build with NO caller anywhere
// (deployment proposal §4). This suite proves the invocation
// routes added to worker-entry-prod-d6.js:
//   * the fence class — the routes sit in the migration-
//     operator fence class of the seed-storage / phase-binding
//     / retirement / release / reconcile / adjudicate
//     surfaces: the production gate skips the client token,
//     admission requires the operator credential, and the DO
//     class gate requires the operator-admitted stamp again.
//     Absent / wrong credentials, a spoofed stamp, wrong
//     scope / instance, method mismatch, and an unset (or
//     aliased) operator secret all refuse with zero state
//     movement;
//   * the bootstrap route is HALT-ONLY and FIGURELESS (the
//     body allowlist is empty — there is nothing to pass);
//   * the disposition route enforces a CLOSED allowlist
//     { attemptId, dayKey, authorizationRef, source, note }
//     and forwards the store's own refusals unchanged — the
//     Hold-B law (multi-day -> quota_disposition_ambiguous_
//     interval) lives in the store and cannot be weakened by
//     any route input;
//   * the reconcile route is read-only, returns the store's
//     floor shape pre-bootstrap, and BOUNDS the identity-
//     bearing detail arrays (exact counts, explicit
//     truncation flags, never a silent cut);
//   * happy paths for all three, bootstrap idempotence, and
//     duplicate disposition refusal.
// Deterministic fakes only (throwing-.one() node:sqlite
// facade, inert R2, no provider, no network), in the house
// shape of tests/ch2disp-route.test.mjs.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import D6Entry, { OpalReaderCoordinatorProd as D6Prod } from "../worker/worker-entry-prod-d6.js";
import { GenerationCoordinator } from "../worker/coordinator.mjs";
import { createGenStore } from "../worker/generation/genstore.mjs";
import { createR2AudioCache } from "../worker/host/adapters.mjs";

class SqlCursor {
  constructor(rows) { this.rows = rows ?? []; }
  toArray() { return this.rows; }
  one() {
    if (this.rows.length === 0)
      throw new Error("Expected exactly one result from SQL query, but got no results.");
    if (this.rows.length > 1)
      throw new Error("Expected exactly one result from SQL query, but got multiple results.");
    return this.rows[0];
  }
}
class SqlFacade {
  constructor(db) { this.db = db; }
  exec(query, ...params) {
    if (params.length === 0 && query.includes(";")) {
      this.db.exec(query);
      return new SqlCursor([]);
    }
    const stmt = this.db.prepare(query);
    const isQuery = /^\s*(SELECT|WITH)\b/i.test(query);
    let rows = null;
    if (isQuery) rows = stmt.all(...params); else stmt.run(...params);
    return new SqlCursor(rows);
  }
}

const CLIENT_TOKEN = "qroutes-fixture-client-token";
const OPERATOR_TOKEN = "qroutes-fixture-operator-token";
const T = (iso) => Date.parse(iso);

function quotaWorld({ halt = "1", operatorToken = OPERATOR_TOKEN,
                      accessToken = CLIENT_TOKEN } = {}) {
  const db = new DatabaseSync(":memory:");
  const storage = {
    sql: new SqlFacade(db),
    transactionSync(fn) {
      db.exec("BEGIN IMMEDIATE");
      try { const r = fn(); db.exec("COMMIT"); return r; }
      catch (e) { try { db.exec("ROLLBACK"); } catch { /* already out */ } throw e; }
    },
    async setAlarm() {}, async getAlarm() { return null; },
  };
  const queue = { sent: [], async send(m) { this.sent.push(m); } };
  const classEnv = {
    OPALREADER_V2_SCOPE: "production",
    OPALREADER_ACCESS_TOKEN: accessToken,
    OPALREADER_PHASE_POLICY: "enforce",
    ALLOWED_ORIGIN: "https://opalreader.invalid",
    GENERATION_HALT: halt,
    OPALREADER_R2: {
      async head() { return null; },
      async get() { return null; },
      async put() { return { etag: "fixture" }; },
    },
    OPALREADER_GENERATION_QUEUE: queue,
  };
  if (operatorToken !== null)
    classEnv.OPALREADER_MIGRATION_OPERATOR_TOKEN = operatorToken;
  const inst = new D6Prod({ storage }, classEnv);
  const entryEnv = {
    ...classEnv,
    COORDINATOR: {
      idFromName: (name) => name,
      get: () => ({ fetch: (req) => inst.fetch(req) }),
    },
  };
  const seedCoord = new GenerationCoordinator({ storage }, classEnv);
  createGenStore(seedCoord).ensureSchema();
  const run = (sql, ...params) => db.prepare(sql).run(...params);
  const insertExec = (executionId, grantId) => run(
    `INSERT INTO d6_execution_records
       (execution_id, plan_id, job_id, occurrence_id, grant_id, state, stage,
        cache_key, object_key, etag, size_bytes, sha256, detail_json,
        created_at, updated_at)
     VALUES (?, 'plan:quota', 'plan:quota:ch1', ?, ?, 'committed', 'committed',
             NULL, NULL, NULL, NULL, NULL, NULL, 1, 1)`,
    executionId, "occ-" + executionId, grantId);
  const insertAttempt = (attemptId, executionId, phase, outcome, createdAt, updatedAt) => run(
    `INSERT INTO d6_attempt_log
       (attempt_id, execution_id, plan_id, occurrence_id, seq, phase, outcome,
        cost_micro_cents, upper_micro_cents, provider_request_id, detail_json,
        created_at, updated_at)
     VALUES (?, ?, 'plan:quota', ?, 1, ?, ?, NULL, 22500, NULL, NULL, ?, ?)`,
    attemptId, executionId, "occ-" + attemptId, phase, outcome, createdAt, updatedAt);
  // The floor-build history the bootstrap must classify:
  //   att-a  dispatching, same PT day (updated)     -> assigned
  //   att-b  confirmed, one PT day                 -> assigned
  //   att-c  confirmed, STRADDLES two PT days      -> exception
  //   att-d  confirmed, one PT day, execution row
  //          MISSING (unattributable)              -> exception
  insertExec("exec-a", "grant-a");
  insertExec("exec-b", "grant-b");
  insertExec("exec-c", "grant-c");
  insertAttempt("att-a", "exec-a", "dispatching", null,
    T("2026-03-12T16:00:00Z"), T("2026-03-12T18:00:00Z"));
  insertAttempt("att-b", "exec-b", "confirmed", "success",
    T("2026-03-12T17:00:00Z"), T("2026-03-12T17:00:00Z"));
  insertAttempt("att-c", "exec-c", "confirmed", "success",
    T("2026-03-12T06:30:00Z"), T("2026-03-12T07:30:00Z"));
  insertAttempt("att-d", "exec-d-missing", "confirmed", "success",
    T("2026-03-12T19:00:00Z"), T("2026-03-12T19:00:00Z"));
  const seedLateException = () => {
    // A floor-build dispatch stamped AFTER the bootstrap ran
    // (the rollback-window case the disposition exists for):
    // same-day, attributable — a valid disposition target.
    insertExec("exec-e", "grant-e");
    insertAttempt("att-e", "exec-e", "confirmed", "success",
      T("2026-03-12T20:00:00Z"), T("2026-03-12T20:00:00Z"));
  };
  return { db, inst, entryEnv, classEnv, queue, seedLateException };
}

const all = (w, sql) => w.db.prepare(sql).all();
const tableExists = (w, name) => !!w.db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(name);
function snapshot(w) {
  return JSON.stringify({
    attempts: all(w, "SELECT * FROM d6_attempt_log ORDER BY attempt_id"),
    executions: all(w, "SELECT * FROM d6_execution_records ORDER BY execution_id"),
    dispatches: tableExists(w, "d6_provider_dispatches")
      ? all(w, "SELECT * FROM d6_provider_dispatches ORDER BY attempt_id") : null,
    meta: all(w, "SELECT * FROM meta ORDER BY key"),
  });
}

const BOOTSTRAP_PATH = "/v2/d6-quota-bootstrap";
const DISPOSE_PATH = "/v2/d6-quota-dispose-exception";
const RECONCILE_PATH = "/v2/d6-quota-reconcile";

async function call(w, path, {
  method = "POST", operator, access, scope = "production",
  instance = "account", body, headers = {},
} = {}) {
  const h = {
    "x-opalreader-scope": scope,
    "x-opalreader-instance": instance,
    Origin: "https://opalreader.invalid",
    ...headers,
  };
  if (operator !== undefined && operator !== null)
    h["x-opalreader-operator-token"] = operator;
  if (access !== undefined && access !== null)
    h["x-opalreader-token"] = access;
  if (body !== undefined) h["content-type"] = "application/json";
  const res = await D6Entry.fetch(new Request(`https://opalreader.invalid${path}`, {
    method, headers: h,
    body: body === undefined ? undefined
      : (typeof body === "string" ? body : JSON.stringify(body)),
  }), w.entryEnv);
  return { status: res.status, body: await res.json().catch(() => null) };
}
const asOperator = (w, path, opts = {}) =>
  call(w, path, { operator: OPERATOR_TOKEN, ...opts });
async function boot(w) {
  const r = await asOperator(w, BOOTSTRAP_PATH, { body: {} });
  assert.equal(r.status, 200);
  assert.equal(r.body?.outcome, "applied");
  return r.body;
}
async function reconcile(w) {
  const r = await asOperator(w, RECONCILE_PATH, { method: "GET" });
  assert.equal(r.status, 200);
  return r.body;
}

// ------------------------------------------------------------------

test("QROUTE-1: happy paths — bootstrap classifies the floor history; reconcile reports it; a late exception disposes", async () => {
  const w = quotaWorld();
  const b = await boot(w);
  assert.equal(b.bootstrapped, true);
  assert.equal(b.alreadyArmed, false);
  assert.equal(b.assigned, 2, "att-a + att-b assigned from their own evidence");
  assert.equal(b.providerAttemptDailyLimit, 100);
  assert.equal(b.exceptionCount, 2);
  assert.deepEqual(b.exceptions.map((e) => e.attemptId), ["att-c", "att-d"]);
  assert.deepEqual(b.exceptions[0].intervalDays, ["2026-03-11", "2026-03-12"]);
  assert.equal(b.exceptionsTruncated, false);

  const report = await reconcile(w);
  assert.equal(report.armed, true);
  assert.equal(report.ok, true);
  assert.deepEqual(report.drift, []);
  assert.equal(report.driftCount, 0);
  assert.equal(report.exceptionCount, 2);
  assert.equal(report.dayTotals["2026-03-12"].dispatched, 2);

  // A floor-build dispatch stamped after the bootstrap: the
  // disposition names its day under Julie's recorded approval.
  w.seedLateException();
  const before = await reconcile(w);
  assert.equal(before.exceptionCount, 3);
  const d = await asOperator(w, DISPOSE_PATH, { body: {
    attemptId: "att-e", dayKey: "2026-03-12",
    authorizationRef: "julie-approval:fixture-gate-b",
    source: "operator-route", note: "fixture disposition",
  } });
  assert.equal(d.status, 200);
  assert.equal(d.body.outcome, "applied");
  assert.equal(d.body.attemptId, "att-e");
  assert.equal(d.body.dayKey, "2026-03-12");
  const row = w.db.prepare(
    "SELECT dispatched_day_key, detail_json FROM d6_attempt_log WHERE attempt_id='att-e'").get();
  assert.equal(row.dispatched_day_key, "2026-03-12");
  const detail = JSON.parse(row.detail_json);
  assert.equal(detail.quotaBootstrapDisposition.authorizationRef,
    "julie-approval:fixture-gate-b");
  assert.deepEqual(detail.quotaBootstrapDisposition.evidenceInterval,
    ["2026-03-12", "2026-03-12"]);
  assert.equal(w.db.prepare(
    "SELECT COUNT(*) AS n FROM d6_provider_dispatches").get().n, 3);
  const after = await reconcile(w);
  assert.equal(after.exceptionCount, 2, "the disposition leaves the exception list");
  assert.equal(after.dayTotals["2026-03-12"].dispatched, 3);
});

test("QROUTE-2: reconcile pre-bootstrap returns the store's floor shape; the read is operator-fenced too", async () => {
  const w = quotaWorld();
  const report = await reconcile(w);
  assert.deepEqual(report, { armed: false, ok: false, reason: "not_armed" });
  const noCred = await call(w, RECONCILE_PATH, { method: "GET" });
  assert.equal(noCred.status, 403);
  assert.equal(noCred.body.error, "migration_operator_required");
  const clientOnly = await call(w, RECONCILE_PATH,
    { method: "GET", access: CLIENT_TOKEN });
  assert.equal(clientOnly.status, 403,
    "the everyday client token alone never reaches the quota read");
  assert.equal(clientOnly.body.error, "migration_operator_required");
});

test("QROUTE-3: absent / wrong operator credential refuses all three routes; nothing is written", async () => {
  for (const [label, opts] of [
    ["absent", {}],
    ["wrong", { operator: "not-the-operator-token" }],
    ["client token alone", { access: CLIENT_TOKEN }],
  ]) {
    const w = quotaWorld();
    const before = snapshot(w);
    const b = await call(w, BOOTSTRAP_PATH, { body: {}, ...opts });
    assert.equal(b.status, 403, label);
    assert.equal(b.body.error, "migration_operator_required", label);
    const d = await call(w, DISPOSE_PATH, { body: {
      attemptId: "att-c", dayKey: "2026-03-11", authorizationRef: "x",
    }, ...opts });
    assert.equal(d.status, 403, label);
    const r = await call(w, RECONCILE_PATH, { method: "GET", ...opts });
    assert.equal(r.status, 403, label);
    assert.equal(snapshot(w), before, `${label}: zero state movement`);
    assert.equal(tableExists(w, "d6_provider_dispatches"), false, label);
  }
});

test("QROUTE-4: a spoofed operator-admitted stamp never admits — public forgery and direct class calls both refuse", async () => {
  const w = quotaWorld();
  const before = snapshot(w);
  // (a) the stamp forged on the PUBLIC request (no operator
  // credential): the entry's admission never runs, and the
  // forward overwrites client stamps anyway.
  const forged = await call(w, BOOTSTRAP_PATH, { body: {},
    headers: { "x-opalreader-operator-admitted": "1" } });
  assert.equal(forged.status, 403);
  assert.equal(forged.body.error, "migration_operator_required");
  // (b) direct class calls to the internal paths WITHOUT the
  // stamp: the class gate refuses each of the three.
  for (const [path, method] of [
    ["/internal/d6/quota-bootstrap", "POST"],
    ["/internal/d6/quota-dispose-exception", "POST"],
    ["/internal/d6/quota-reconcile", "GET"],
  ]) {
    const res = await w.inst.fetch(new Request(`https://do.internal${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        "x-opalreader-internal": "1",
        "x-opalreader-scope": "production",
      },
      body: method === "POST" ? "{}" : undefined,
    }));
    assert.equal(res.status, 403, path);
    assert.equal((await res.json()).error, "migration_operator_required", path);
  }
  // (c) the stamp WITHOUT the internal marker never reaches
  // the class handlers at all.
  const noInternal = await w.inst.fetch(new Request(
    "https://do.internal/internal/d6/quota-bootstrap", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-opalreader-scope": "production",
        "x-opalreader-operator-admitted": "1",
      },
      body: "{}",
    }));
  assert.equal(noInternal.status, 403);
  assert.equal((await noInternal.json()).error, "internal_only");
  assert.equal(snapshot(w), before, "no spoof moved any state");
});

test("QROUTE-5: wrong production scope / instance headers refuse at the entry gate and at the class gate", async () => {
  const w = quotaWorld();
  const badScope = await asOperator(w, BOOTSTRAP_PATH,
    { body: {}, scope: "staging" });
  assert.equal(badScope.status, 403);
  assert.equal(badScope.body.error, "production_scope_required");
  const badInstance = await asOperator(w, BOOTSTRAP_PATH,
    { body: {}, instance: "someone-else" });
  assert.equal(badInstance.status, 403);
  assert.equal(badInstance.body.error, "production_instance_required");
  const classScope = await w.inst.fetch(new Request(
    "https://do.internal/internal/d6/quota-bootstrap", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-opalreader-internal": "1",
        "x-opalreader-scope": "staging",
        "x-opalreader-operator-admitted": "1",
      },
      body: "{}",
    }));
  assert.equal(classScope.status, 403);
  assert.equal((await classScope.json()).error, "production_scope_required");
  assert.equal(tableExists(w, "d6_provider_dispatches"), false);
});

test("QROUTE-6: method mismatch never applies anything (public gate and class fall-through)", async () => {
  const w = quotaWorld();
  const before = snapshot(w);
  // GET on the POST bootstrap surface is not an operator
  // route at all: it falls to the ordinary client gate.
  const getBoot = await asOperator(w, BOOTSTRAP_PATH, { method: "GET" });
  assert.equal(getBoot.status, 401);
  // POST on the GET reconcile surface likewise.
  const postRec = await asOperator(w, RECONCILE_PATH, { body: {} });
  assert.equal(postRec.status, 401);
  // Class level: a POST to the GET internal path, and a GET
  // to a POST internal path, fall through to the base class
  // dispatch (405 / 404) — nothing is applied either way.
  const stampHeaders = {
    "content-type": "application/json",
    "x-opalreader-internal": "1",
    "x-opalreader-scope": "production",
    "x-opalreader-operator-admitted": "1",
  };
  const postInternalRec = await w.inst.fetch(new Request(
    "https://do.internal/internal/d6/quota-reconcile",
    { method: "POST", headers: stampHeaders, body: "{}" }));
  assert.equal(postInternalRec.status, 405);
  const getInternalBoot = await w.inst.fetch(new Request(
    "https://do.internal/internal/d6/quota-bootstrap",
    { method: "GET", headers: stampHeaders }));
  assert.equal(getInternalBoot.status, 404);
  assert.equal(snapshot(w), before, "method mismatches moved nothing");
  assert.equal(tableExists(w, "d6_provider_dispatches"), false);
});

test("QROUTE-7: an unset operator secret — or one aliased to the client token — refuses the routes as not configured", async () => {
  for (const [label, worldOpts] of [
    ["secret unset", { operatorToken: null }],
    ["secret aliased to the client token", { operatorToken: CLIENT_TOKEN }],
  ]) {
    const w = quotaWorld(worldOpts);
    const b = await call(w, BOOTSTRAP_PATH,
      { body: {}, operator: OPERATOR_TOKEN });
    assert.equal(b.status, 503, label);
    assert.equal(b.body.error, "migration_operator_not_configured", label);
    const r = await call(w, RECONCILE_PATH,
      { method: "GET", operator: OPERATOR_TOKEN });
    assert.equal(r.status, 503, label);
    assert.equal(tableExists(w, "d6_provider_dispatches"), false, label);
  }
});

test("QROUTE-8: the bootstrap route is FIGURELESS — figure keys, foreign keys, and bare figures all refuse; the empty body applies", async () => {
  const w = quotaWorld();
  for (const [label, body, reason] of [
    ["assigned count", { assignedCount: 2 }, "quota_bootstrap_figure_caller_supplied"],
    ["assigned", { assigned: 2 }, "quota_bootstrap_figure_caller_supplied"],
    ["limit", { limit: 50 }, "quota_bootstrap_figure_caller_supplied"],
    ["day key", { dayKey: "2026-03-12" }, "quota_bootstrap_figure_caller_supplied"],
    ["cost figure", { knownCostMicro: 1 }, "quota_bootstrap_figure_caller_supplied"],
    ["foreign key", { note: "please" }, "quota_bootstrap_request_key_not_allowed"],
    ["bare number body", "5", "quota_bootstrap_figure_caller_supplied"],
    ["bare string body", "\"x\"", "quota_bootstrap_request_not_figureless"],
    ["array body", "[]", "quota_bootstrap_request_not_figureless"],
  ]) {
    const r = await asOperator(w, BOOTSTRAP_PATH, { body });
    assert.equal(r.status, 200, label);
    assert.equal(r.body.outcome, "rejected", label);
    assert.equal(r.body.reason, reason, label);
    assert.equal(tableExists(w, "d6_provider_dispatches"), false,
      `${label}: a refused bootstrap writes nothing`);
  }
  const ok = await boot(w);
  assert.equal(ok.assigned, 2, "the refusals were not sticky");
});

test("QROUTE-9: bootstrap idempotence — the second invocation is a replay-safe no-op", async () => {
  const w = quotaWorld();
  const first = await boot(w);
  assert.equal(first.alreadyArmed, false);
  const metaAfterFirst = w.db.prepare(
    "SELECT value FROM meta WHERE key = 'd6_quota_bootstrapped_at'").get().value;
  const snapAfterFirst = snapshot(w);
  const second = await boot(w);
  assert.equal(second.bootstrapped, true);
  assert.equal(second.alreadyArmed, true);
  assert.equal(second.assigned, 0, "nothing is assigned twice");
  assert.equal(second.exceptionCount, 2);
  assert.equal(w.db.prepare(
    "SELECT value FROM meta WHERE key = 'd6_quota_bootstrapped_at'").get().value,
    metaAfterFirst, "the original bootstrap record is never rewritten");
  assert.equal(snapshot(w), snapAfterFirst);
});

test("QROUTE-10: the bootstrap route is HALT-ONLY — GENERATION_HALT other than \"1\" refuses, nothing written", async () => {
  const w = quotaWorld({ halt: "0" });
  const r = await asOperator(w, BOOTSTRAP_PATH, { body: {} });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { outcome: "rejected", reason: "generation_not_halted" });
  assert.equal(tableExists(w, "d6_provider_dispatches"), false);
  assert.equal(w.db.prepare(
    "SELECT COUNT(*) AS n FROM meta WHERE key = 'd6_quota_bootstrapped_at'").get().n, 0);
});

test("QROUTE-11: disposition contract — closed allowlist and required-field validation refuse with zero movement", async () => {
  const w = quotaWorld();
  await boot(w);
  w.seedLateException();
  const before = snapshot(w);
  const good = {
    attemptId: "att-e", dayKey: "2026-03-12",
    authorizationRef: "julie-approval:fixture-gate-b",
  };
  for (const [label, body, reason] of [
    ["foreign key", { ...good, bogus: 1 }, "quota_disposition_request_key_not_allowed"],
    ["figure key", { ...good, costMicroCents: 5 }, "quota_disposition_figure_caller_supplied"],
    ["figure key (estimated)", { ...good, estimatedCostMicro: 5 }, "quota_disposition_figure_caller_supplied"],
    ["missing attemptId", { dayKey: "2026-03-12", authorizationRef: "x" }, "attempt_id_required"],
    ["numeric attemptId (malformed)", { ...good, attemptId: 42 }, "attempt_id_required"],
    ["blank attemptId (malformed)", { ...good, attemptId: "   " }, "attempt_id_required"],
    ["missing dayKey", { attemptId: "att-e", authorizationRef: "x" }, "day_key_required"],
    ["blank authorizationRef", { ...good, authorizationRef: " " }, "authorization_ref_required"],
    ["non-string note", { ...good, note: 42 }, "note_invalid"],
    ["non-string source", { ...good, source: 42 }, "source_invalid"],
    ["array body", "[]", "quota_disposition_request_key_not_allowed"],
  ]) {
    const r = await asOperator(w, DISPOSE_PATH, { body });
    assert.equal(r.status, 200, label);
    assert.equal(r.body.outcome, "rejected", label);
    assert.equal(r.body.reason, reason, label);
    assert.equal(snapshot(w), before, `${label}: zero state movement`);
  }
});

test("QROUTE-12: disposition store refusals pass through unchanged — unknown, straddling, invalid-day, out-of-interval, unattributable", async () => {
  const w = quotaWorld();
  await boot(w);
  w.seedLateException();
  const before = snapshot(w);
  const auth = { authorizationRef: "julie-approval:fixture-gate-b" };
  for (const [label, body, reason] of [
    ["unknown attempt id",
      { attemptId: "att-nope", dayKey: "2026-03-12", ...auth }, "attempt_not_found"],
    ["straddling interval, first day named",
      { attemptId: "att-c", dayKey: "2026-03-11", ...auth }, "quota_disposition_ambiguous_interval"],
    ["straddling interval, second day named",
      { attemptId: "att-c", dayKey: "2026-03-12", ...auth }, "quota_disposition_ambiguous_interval"],
    ["not a real calendar day",
      { attemptId: "att-c", dayKey: "2026-02-30", ...auth }, "quota_disposition_day_invalid"],
    ["day outside the evidence interval",
      { attemptId: "att-e", dayKey: "2026-03-13", ...auth }, "quota_disposition_day_outside_evidence_interval"],
    ["unattributable (no grant on the execution record)",
      { attemptId: "att-d", dayKey: "2026-03-12", ...auth }, "quota_disposition_unattributable"],
  ]) {
    const r = await asOperator(w, DISPOSE_PATH, { body });
    assert.equal(r.status, 200, label);
    assert.equal(r.body.outcome, "rejected", label);
    assert.equal(r.body.reason, reason, label);
    assert.equal(snapshot(w), before, `${label}: a store refusal changes nothing`);
  }
});

test("QROUTE-13: a duplicate disposition of the same attempt id refuses — the disposal is exactly-once", async () => {
  const w = quotaWorld();
  await boot(w);
  w.seedLateException();
  const body = {
    attemptId: "att-e", dayKey: "2026-03-12",
    authorizationRef: "julie-approval:fixture-gate-b",
  };
  const first = await asOperator(w, DISPOSE_PATH, { body });
  assert.equal(first.body.outcome, "applied");
  const afterFirst = snapshot(w);
  const second = await asOperator(w, DISPOSE_PATH, { body });
  assert.equal(second.status, 200);
  assert.equal(second.body.outcome, "rejected");
  assert.equal(second.body.reason, "quota_disposition_not_an_exception");
  assert.equal(snapshot(w), afterFirst, "the duplicate changed nothing");
});

test("QROUTE-14: the disposition route is HALT-ONLY too — refusal precedes any store contact", async () => {
  const w = quotaWorld({ halt: "0" });
  const before = snapshot(w);
  const r = await asOperator(w, DISPOSE_PATH, { body: {
    attemptId: "att-c", dayKey: "2026-03-11",
    authorizationRef: "julie-approval:fixture-gate-b",
  } });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { outcome: "rejected", reason: "generation_not_halted" });
  assert.equal(snapshot(w), before);
});

test("QROUTE-15: route inventory in the entry source, and BOUNDED detail — 105 exceptions report exact counts with truncation flags", async () => {
  const src = readFileSync(new URL("../worker/worker-entry-prod-d6.js", import.meta.url), "utf8");
  for (const path of [
    "/v2/d6-quota-bootstrap", "/v2/d6-quota-dispose-exception", "/v2/d6-quota-reconcile",
    "/internal/d6/quota-bootstrap", "/internal/d6/quota-dispose-exception",
    "/internal/d6/quota-reconcile",
  ]) assert.ok(src.includes(path), `entry source carries ${path}`);

  const w = quotaWorld();
  // 105 additional straddlers (each an exception) on top of
  // att-c / att-d: the detail arrays must cap at the bound
  // while the counts stay exact.
  for (let i = 0; i < 105; i++) {
    w.db.prepare(
      `INSERT INTO d6_execution_records
         (execution_id, plan_id, job_id, occurrence_id, grant_id, state, stage,
          cache_key, object_key, etag, size_bytes, sha256, detail_json,
          created_at, updated_at)
       VALUES (?, 'plan:quota', 'plan:quota:ch1', ?, ?, 'committed', 'committed',
               NULL, NULL, NULL, NULL, NULL, NULL, 1, 1)`)
      .run(`exec-x${i}`, `occ-x${i}`, `grant-x${i}`);
    w.db.prepare(
      `INSERT INTO d6_attempt_log
         (attempt_id, execution_id, plan_id, occurrence_id, seq, phase, outcome,
          cost_micro_cents, upper_micro_cents, provider_request_id, detail_json,
          created_at, updated_at)
       VALUES (?, ?, 'plan:quota', ?, 1, 'confirmed', 'success', NULL, 22500,
               NULL, NULL, ?, ?)`)
      .run(`att-x${i}`, `exec-x${i}`, `occ-x${i}`,
        T("2026-03-12T06:30:00Z"), T("2026-03-12T07:30:00Z"));
  }
  const b = await boot(w);
  assert.equal(b.exceptionCount, 107);
  assert.equal(b.exceptions.length, 100, "bootstrap detail is capped at the bound");
  assert.equal(b.exceptionsTruncated, true);
  const report = await reconcile(w);
  assert.equal(report.exceptionCount, 107, "the count is exact even when detail truncates");
  assert.equal(report.exceptions.length, 100);
  assert.equal(report.exceptionsTruncated, true);
  assert.equal(report.driftCount, 0);
});

// ------------------------------------------------------------------
// QUOTA ROUTES CORRECTIONS (Rowan source hold 6546277727 on the
// routes package; the core quota build is untouched).

test("QROUTE-16: strict bootstrap bodies — malformed JSON, explicit null, and a malformed figure payload refuse with zero state movement; only a valid empty request boots", async () => {
  const w = quotaWorld();
  const before = snapshot(w);
  // Through the public entry, WITH the correct operator
  // credential: admission must not bless malformed input.
  for (const [label, body, reason] of [
    ["syntactically invalid JSON", "{not json", "quota_bootstrap_body_malformed"],
    ["explicit JSON null", "null", "quota_bootstrap_body_null"],
    ["malformed figure payload", "{\"assignedCount\": }", "quota_bootstrap_body_malformed"],
  ]) {
    const r = await asOperator(w, BOOTSTRAP_PATH, { body });
    assert.equal(r.status, 200, label);
    assert.equal(r.body.outcome, "rejected", label);
    assert.equal(r.body.reason, reason, label);
    assert.equal(snapshot(w), before, `${label}: zero state movement`);
    assert.equal(tableExists(w, "d6_provider_dispatches"), false, label);
    assert.equal(w.db.prepare(
      "SELECT COUNT(*) AS n FROM meta WHERE key = 'd6_quota_bootstrapped_at'").get().n, 0, label);
  }
  // Bypass-safe: the same bodies sent DIRECTLY to the DO
  // handler (stamp admitted) refuse identically — enforcement
  // lives at the handler, not the public entry.
  for (const [label, raw, reason] of [
    ["direct malformed", "{not json", "quota_bootstrap_body_malformed"],
    ["direct null", "null", "quota_bootstrap_body_null"],
  ]) {
    const res = await w.inst.fetch(new Request(
      "https://do.internal/internal/d6/quota-bootstrap", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-opalreader-internal": "1",
          "x-opalreader-scope": "production",
          "x-opalreader-operator-admitted": "1",
        },
        body: raw,
      }));
    assert.equal(res.status, 200, label);
    const j = await res.json();
    assert.equal(j.outcome, "rejected", label);
    assert.equal(j.reason, reason, label);
    assert.equal(snapshot(w), before, `${label}: zero state movement`);
    assert.equal(tableExists(w, "d6_provider_dispatches"), false, label);
  }
  // Only a valid empty request boots: no body at all applies,
  // and the refusals were not sticky.
  const noBody = await asOperator(w, BOOTSTRAP_PATH, {});
  assert.equal(noBody.status, 200);
  assert.equal(noBody.body.outcome, "applied");
  assert.equal(noBody.body.alreadyArmed, false);
  assert.equal(noBody.body.assigned, 2);
});

function seedStraddlers(w, count) {
  for (let i = 0; i < count; i++) {
    w.db.prepare(
      `INSERT INTO d6_execution_records
         (execution_id, plan_id, job_id, occurrence_id, grant_id, state, stage,
          cache_key, object_key, etag, size_bytes, sha256, detail_json,
          created_at, updated_at)
       VALUES (?, 'plan:quota', 'plan:quota:ch1', ?, ?, 'committed', 'committed',
               NULL, NULL, NULL, NULL, NULL, NULL, 1, 1)`)
      .run(`exec-x${i}`, `occ-x${i}`, `grant-x${i}`);
    w.db.prepare(
      `INSERT INTO d6_attempt_log
         (attempt_id, execution_id, plan_id, occurrence_id, seq, phase, outcome,
          cost_micro_cents, upper_micro_cents, provider_request_id, detail_json,
          created_at, updated_at)
       VALUES (?, ?, 'plan:quota', ?, 1, 'confirmed', 'success', NULL, 22500,
               NULL, NULL, ?, ?)`)
      .run(`att-x${i}`, `exec-x${i}`, `occ-x${i}`,
        T("2026-03-12T06:30:00Z"), T("2026-03-12T07:30:00Z"));
  }
}

test("QROUTE-17: reconcile pagination — 107 all-straddling exceptions enumerate in disjoint, complete, stable pages with zero disposition calls; drift pages the same way; invalid offsets refuse", async () => {
  const w = quotaWorld();
  seedStraddlers(w, 105);
  await boot(w);
  const get = (qs) => asOperator(w, `${RECONCILE_PATH}${qs}`, { method: "GET" });

  const p1 = await get("");
  assert.equal(p1.status, 200);
  assert.equal(p1.body.exceptionCount, 107);
  assert.equal(p1.body.exceptions.length, 100);
  assert.equal(p1.body.exceptionsOffset, 0);
  assert.equal(p1.body.exceptionsNextOffset, 100);
  assert.equal(p1.body.exceptionsTruncated, true);
  assert.equal(p1.body.censusComplete, false,
    "a truncated first page never presents as the complete census");
  const p2 = await get("?exceptionOffset=100");
  assert.equal(p2.body.exceptionCount, 107);
  assert.equal(p2.body.exceptions.length, 7);
  assert.equal(p2.body.exceptionsOffset, 100);
  assert.equal(p2.body.exceptionsNextOffset, null);
  assert.equal(p2.body.exceptionsTruncated, false);
  const ids1 = p1.body.exceptions.map((e) => e.attemptId);
  const ids2 = p2.body.exceptions.map((e) => e.attemptId);
  assert.equal(new Set([...ids1, ...ids2]).size, 107, "pages are disjoint");
  const expected = new Set(all(w,
    `SELECT attempt_id FROM d6_attempt_log
      WHERE phase IN ('dispatching', 'confirmed') AND dispatched_day_key IS NULL`)
    .map((r) => r.attempt_id));
  assert.deepEqual(new Set([...ids1, ...ids2]), expected,
    "the union of the pages is the full exception set");
  const p1Again = await get("");
  assert.deepEqual(p1Again.body.exceptions.map((e) => e.attemptId), ids1,
    "page contents are stable across repeated reads");
  // Zero disposition calls happened anywhere above: every
  // exception is still unstamped and the dispatch ledger
  // holds only the bootstrap's two assigned rows.
  assert.equal(w.db.prepare(
    `SELECT COUNT(*) AS n FROM d6_attempt_log
      WHERE dispatched_day_key IS NULL AND phase IN ('dispatching', 'confirmed')`)
    .get().n, 107);
  assert.equal(w.db.prepare(
    "SELECT COUNT(*) AS n FROM d6_provider_dispatches").get().n, 2);

  // Invalid offsets refuse as a named request error and the
  // census read moves nothing.
  const beforeInvalid = snapshot(w);
  for (const bad of ["abc", "-1", "1.5", "99999999999999999999999"]) {
    const r = await get(`?exceptionOffset=${bad}`);
    assert.equal(r.status, 400, bad);
    assert.equal(r.body.error, "quota_reconcile_offset_invalid", bad);
  }
  const rDriftBad = await get("?driftOffset=-3");
  assert.equal(rDriftBad.status, 400);
  assert.equal(rDriftBad.body.error, "quota_reconcile_offset_invalid");
  assert.equal(snapshot(w), beforeInvalid);

  // Drift paginates under the same discipline: 105 stored
  // counters disagreeing with their derived counts.
  for (let i = 0; i < 105; i++) {
    w.db.prepare(
      `INSERT INTO d6_grant_reservations
         (reservation_id, grant_id, occurrence_id, plan_id, job_id, day_key,
          slots_total, slots_consumed, state, close_reason, created_at, updated_at)
       VALUES (?, ?, ?, 'plan:quota', 'plan:quota:ch1', '2026-03-12',
               1, 1, 'open', NULL, 1, 1)`)
      .run(`res-y${i}`, `grant-y${i}`, `occ-y${i}`);
  }
  const d1 = await get("");
  assert.equal(d1.body.driftCount, 105);
  assert.equal(d1.body.drift.length, 100);
  assert.equal(d1.body.driftNextOffset, 100);
  assert.equal(d1.body.driftTruncated, true);
  const d2 = await get("?driftOffset=100");
  assert.equal(d2.body.driftCount, 105);
  assert.equal(d2.body.drift.length, 5);
  assert.equal(d2.body.driftNextOffset, null);
  const resIds = [...d1.body.drift, ...d2.body.drift].map((d) => d.reservationId);
  assert.equal(new Set(resIds).size, 105, "drift pages are disjoint and complete");
  assert.ok([...d1.body.drift, ...d2.body.drift]
    .every((d) => d.kind === "slots_consumed_mismatch"));
});

test("QROUTE-18: reconcile read purity — a cache holding a pending entry is never flushed by the GET (no bucket PUT, no cache or data mutation)", async () => {
  const w = quotaWorld();
  await boot(w);
  let putCalls = 0;
  const countingBucket = {
    async head() { return null; },
    async get() { return null; },
    async put() { putCalls += 1; return { etag: "fixture" }; },
  };
  const cache = createR2AudioCache(countingBucket, {});
  cache.putIfAbsent("b".repeat(64), {
    audio: new TextEncoder().encode("fixture-audio-bytes"),
    format: "wav", durationSec: 1,
  });
  // The handler's cache is the fake: one pending entry staged.
  w.inst._cache = async () => cache;
  const before = snapshot(w);
  const report = await reconcile(w);
  assert.equal(report.armed, true);
  assert.equal(report.exceptionCount, 2);
  assert.equal(putCalls, 0, "the reconcile GET never invokes bucket PUT");
  assert.equal(snapshot(w), before, "the data plane is untouched");
  // The pending entry is still pending afterwards — the GET
  // neither flushed nor consumed it. A manual flush now
  // writes exactly that one entry.
  const flushed = await cache.flush();
  assert.equal(flushed.flushed, 1);
  assert.equal(putCalls, 1);
});

test("QROUTE-19: disposition hardening — an unexpected store fault surfaces as a real fault (HTTP 500), never as an ordinary rejected outcome", async () => {
  const w = quotaWorld();
  await boot(w);
  // A same-day, attributable exception whose stored detail is
  // malformed JSON: the store's JSON.parse throws a
  // SyntaxError — an unexpected fault, not a named refusal.
  w.db.prepare(
    `INSERT INTO d6_execution_records
       (execution_id, plan_id, job_id, occurrence_id, grant_id, state, stage,
        cache_key, object_key, etag, size_bytes, sha256, detail_json,
        created_at, updated_at)
     VALUES ('exec-f', 'plan:quota', 'plan:quota:ch1', 'occ-att-f', 'grant-f',
             'committed', 'committed', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1)`)
    .run();
  w.db.prepare(
    `INSERT INTO d6_attempt_log
       (attempt_id, execution_id, plan_id, occurrence_id, seq, phase, outcome,
        cost_micro_cents, upper_micro_cents, provider_request_id, detail_json,
        created_at, updated_at)
     VALUES ('att-f', 'exec-f', 'plan:quota', 'occ-att-f', 1, 'confirmed',
             'success', NULL, 22500, NULL, '{broken json', ?, ?)`)
    .run(T("2026-03-12T20:00:00Z"), T("2026-03-12T20:00:00Z"));
  const before = snapshot(w);
  const r = await asOperator(w, DISPOSE_PATH, { body: {
    attemptId: "att-f", dayKey: "2026-03-12",
    authorizationRef: "julie-approval:fixture-gate-b",
  } });
  assert.equal(r.status, 500, "the fault surfaces as a fault, not a refusal");
  assert.equal(r.body?.outcome, undefined, "no laundered rejected outcome");
  assert.equal(typeof r.body?.error, "string");
  assert.equal(snapshot(w), before, "the faulted disposition changed nothing");
  // Contrast: a named domain refusal in the same world still
  // returns the ordinary 200 rejected shape.
  const domain = await asOperator(w, DISPOSE_PATH, { body: {
    attemptId: "att-c", dayKey: "2026-03-11",
    authorizationRef: "julie-approval:fixture-gate-b",
  } });
  assert.equal(domain.status, 200);
  assert.deepEqual(domain.body,
    { outcome: "rejected", reason: "quota_disposition_ambiguous_interval" });
});
