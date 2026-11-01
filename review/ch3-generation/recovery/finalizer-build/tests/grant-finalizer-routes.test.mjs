// Ch 3 Phase A RECOVERY — Option A grant finalizer, ROUTES level
// (RECOVERY-PROPOSAL-DRAFT §4.2/§9.2; Rowan 6551435961 check 3):
// both surfaces end to end through the REAL production entry +
// coordinator class (worker-entry-prod-d6.js), modeled on
// tests/ch3-park-routes.test.mjs.
//
// Fence class: operator-alone — the public gate skips the client
// token for these paths, the entry's admission block requires
// the dedicated migration-operator credential, and the class
// gate re-checks the unforgeable operator-admitted stamp. No
// halt fence: finalization is bookkeeping closure (it performs
// no provider call, no submission, no wake), and both halt
// states are exercised below. The seeded world is Fixture S —
// the exact live-shaped stalled state (shared helper).
import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import D6Entry, {
  OpalReaderCoordinatorProd as D6Prod,
} from "../worker/worker-entry-prod-d6.js";
import { GenerationCoordinator } from "../worker/coordinator.mjs";
import { createGenStore } from "../worker/generation/genstore.mjs";
import {
  GRANT, PLAN, JOB, seedStalledState,
} from "./helpers/grant-finalizer-fixture.mjs";

class SqlCursor {
  constructor(rows) { this._rows = rows || []; }
  toArray() { return this._rows; }
  one() {
    if (this._rows.length !== 1)
      throw new Error(`Expected exactly one result row, got ${this._rows.length}`);
    return this._rows[0];
  }
  [Symbol.iterator]() { return this._rows[Symbol.iterator](); }
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

const CLIENT_TOKEN = "finroutes-fixture-client-token";
const OPERATOR_TOKEN = "finroutes-fixture-operator-token";
const PREVIEW_PATH = "/v2/d6-grant-finalization-preview";
const FINALIZE_PATH = "/v2/d6-finalize-grant";
const AUTH_REF = "board:gate-2-routes-go";

function finWorld({ halt = "0", operatorToken = OPERATOR_TOKEN,
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
    OPALREADER_GENERATION_V2: queue,
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
  seedStalledState(seedCoord, createGenStore(seedCoord));
  return { db, inst, entryEnv, classEnv, queue };
}

const tableExists = (w, name) => !!w.db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(name);
function snapshot(w) {
  return JSON.stringify({
    grant: w.db.prepare("SELECT state, report_json FROM grants WHERE grant_id = ?").get(GRANT),
    claim: w.db.prepare("SELECT state FROM claims WHERE grant_id = ?").get(GRANT),
    reservations: w.db.prepare(
      "SELECT reservation_id, state, close_reason FROM d6_grant_reservations ORDER BY reservation_id").all(),
    auditRows: tableExists(w, "d6_grant_finalizations")
      ? w.db.prepare("SELECT COUNT(*) AS n FROM d6_grant_finalizations").get().n : 0,
    queueSent: w.queue.sent.length,
  });
}

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
const previewAsOperator = (w, qs = `?grantId=${encodeURIComponent(GRANT)}`) =>
  call(w, PREVIEW_PATH + qs, { method: "GET", operator: OPERATOR_TOKEN });

test("FINR-1: happy path through the entry — preview, finalize, replay; the queue is never touched", async () => {
  const w = finWorld();
  const p = await previewAsOperator(w);
  assert.equal(p.status, 200, JSON.stringify(p.body));
  assert.equal(p.body.outcome, "preview");
  assert.equal(p.body.classification, "finalizable");
  assert.match(p.body.preconditionDigest, /^[0-9a-f]{64}$/);
  assert.equal(p.body.state.attemptsTotal, 44);
  assert.equal(tableExists(w, "d6_grant_finalizations"), false,
    "the preview did not even bootstrap the audit table");

  const fin = await call(w, FINALIZE_PATH, {
    operator: OPERATOR_TOKEN,
    body: {
      grantId: GRANT, planId: PLAN, jobId: JOB,
      authorizationRef: AUTH_REF,
      expectedPreconditionDigest: p.body.preconditionDigest,
    },
  });
  assert.equal(fin.status, 200, JSON.stringify(fin.body));
  assert.equal(fin.body.outcome, "applied");
  assert.equal(fin.body.audit.authorizationRef, AUTH_REF);
  const grant = w.db.prepare("SELECT state FROM grants WHERE grant_id = ?").get(GRANT);
  assert.equal(grant.state, "reported");
  assert.equal(w.queue.sent.length, 0, "finalization never wakes the queue");

  const replay = await call(w, FINALIZE_PATH, {
    operator: OPERATOR_TOKEN,
    body: {
      grantId: GRANT, planId: PLAN, jobId: JOB,
      authorizationRef: AUTH_REF,
      expectedPreconditionDigest: p.body.preconditionDigest,
    },
  });
  assert.equal(replay.body.outcome, "already_finalized");
  const p2 = await previewAsOperator(w);
  assert.equal(p2.body.classification, "already_finalized");
});

test("FINR-2: no halt fence — preview and finalize work in BOTH halt states", async () => {
  for (const halt of ["0", "1"]) {
    const w = finWorld({ halt });
    const p = await previewAsOperator(w);
    assert.equal(p.body.classification, "finalizable", `halt=${halt}`);
    const fin = await call(w, FINALIZE_PATH, {
      operator: OPERATOR_TOKEN,
      body: {
        grantId: GRANT, planId: PLAN, jobId: JOB,
        authorizationRef: AUTH_REF,
        expectedPreconditionDigest: p.body.preconditionDigest,
      },
    });
    assert.equal(fin.body.outcome, "applied", `halt=${halt}`);
  }
});

test("FINR-3: the operator fence — no credential and client-token-alone refuse on both routes, zero writes", async () => {
  const w = finWorld();
  const before = snapshot(w);
  for (const [path, opts] of [
    [PREVIEW_PATH + `?grantId=${encodeURIComponent(GRANT)}`, { method: "GET" }],
    [FINALIZE_PATH, { body: { grantId: GRANT } }],
  ]) {
    const noCred = await call(w, path, opts);
    assert.equal(noCred.status, 403, path);
    assert.equal(noCred.body.error, "migration_operator_required", path);
    const clientOnly = await call(w, path, { ...opts, access: CLIENT_TOKEN });
    assert.equal(clientOnly.status, 403, path);
    assert.equal(clientOnly.body.error, "migration_operator_required", path);
    const wrongOperator = await call(w, path, { ...opts, operator: "not-the-operator" });
    assert.equal(wrongOperator.status, 403, path);
  }
  assert.equal(snapshot(w), before, "denials moved no state");
  assert.equal(tableExists(w, "d6_grant_finalizations"), false,
    "denied requests never reach the store — not even the lazy DDL ran");

  const unconfigured = finWorld({ operatorToken: null });
  const r503 = await call(unconfigured, FINALIZE_PATH,
    { operator: OPERATOR_TOKEN, body: { grantId: GRANT } });
  assert.equal(r503.status, 503);
  assert.equal(r503.body.error, "migration_operator_not_configured");
});

test("FINR-4: wrong production scope / instance refuse at the entry gate", async () => {
  const w = finWorld();
  const badScope = await call(w, FINALIZE_PATH, {
    operator: OPERATOR_TOKEN, scope: "staging", body: { grantId: GRANT },
  });
  assert.equal(badScope.status, 403);
  assert.equal(badScope.body.error, "production_scope_required");
  const badInstance = await call(w, FINALIZE_PATH, {
    operator: OPERATOR_TOKEN, instance: "someone-else", body: { grantId: GRANT },
  });
  assert.equal(badInstance.status, 403);
  assert.equal(badInstance.body.error, "production_instance_required");
});

test("FINR-5: a spoofed operator-admitted stamp never admits — public forgery and direct class calls refuse", async () => {
  const w = finWorld();
  const before = snapshot(w);
  const forged = await call(w, FINALIZE_PATH, {
    body: { grantId: GRANT },
    headers: { "x-opalreader-operator-admitted": "1" },
  });
  assert.equal(forged.status, 403);
  assert.equal(forged.body.error, "migration_operator_required");
  for (const [path, method] of [
    ["/internal/d6/finalize-grant", "POST"],
    ["/internal/d6/grant-finalization-preview", "GET"],
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
  const noInternal = await w.inst.fetch(new Request(
    "https://do.internal/internal/d6/finalize-grant", {
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

test("FINR-6: closed-allowlist matrix at the entry — malformed bodies refuse with zero writes", async () => {
  const w = finWorld();
  const p = await previewAsOperator(w);
  const digest = p.body.preconditionDigest;
  const good = {
    grantId: GRANT, planId: PLAN, jobId: JOB,
    authorizationRef: AUTH_REF, expectedPreconditionDigest: digest,
  };
  const cases = [
    // A caller-supplied results array is refused BY SHAPE — the
    // finalizer's defining closed-body property (§4.2).
    [{ ...good, results: [{ outcome: "success" }] },
      "grant_finalization_request_key_not_allowed"],
    [{ ...good, note: "extra" }, "grant_finalization_request_key_not_allowed"],
    [{ ...good, authorizationRef: undefined }, "grant_finalization_authorization_ref_required"],
    [{ grantId: GRANT, planId: PLAN, jobId: JOB, authorizationRef: AUTH_REF },
      "grant_finalization_digest_required"],
    [{ ...good, expectedPreconditionDigest: "not-a-digest" },
      "grant_finalization_digest_required"],
    [{ ...good, grantId: " " }, "grant_finalization_grant_required"],
    [{ ...good, planId: "" }, "grant_finalization_plan_required"],
    [{ ...good, jobId: 42 }, "grant_finalization_job_required"],
    [null, "grant_finalization_grant_required"],
    [[1, 2], "grant_finalization_request_key_not_allowed"],
  ];
  for (const [body, reason] of cases) {
    const r = await call(w, FINALIZE_PATH, { operator: OPERATOR_TOKEN, body });
    assert.equal(r.status, 200, reason);
    assert.equal(r.body?.outcome, "rejected", reason);
    assert.equal(r.body?.reason, reason);
  }
  const grant = w.db.prepare("SELECT state FROM grants WHERE grant_id = ?").get(GRANT);
  assert.equal(grant.state, "issued", "no malformed body finalized anything");
  assert.equal(w.db.prepare(
    "SELECT COUNT(*) AS n FROM d6_grant_reservations WHERE state = 'open'").get().n, 8);
});

test("FINR-7: preview without grantId refuses at the class gate (400), store refusals surface as named rejections", async () => {
  const w = finWorld();
  const noId = await call(w, PREVIEW_PATH, { method: "GET", operator: OPERATOR_TOKEN });
  assert.equal(noId.status, 400);
  assert.equal(noId.body.error, "grant_id_required");
  const unknown = await previewAsOperator(w, "?grantId=grant%3Anope");
  assert.equal(unknown.status, 200);
  assert.equal(unknown.body.outcome, "rejected");
  assert.equal(unknown.body.reason, "grant_finalization_grant_not_found");
  const mismatch = await previewAsOperator(w,
    `?grantId=${encodeURIComponent(GRANT)}&planId=plan%3Aother`);
  assert.equal(mismatch.body.outcome, "rejected");
  assert.equal(mismatch.body.reason, "grant_finalization_identity_mismatch");
});
