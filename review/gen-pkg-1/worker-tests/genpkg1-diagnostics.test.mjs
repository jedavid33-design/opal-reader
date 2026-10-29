// gen-pkg-1 worker delta item 5 — the OPERATOR-ONLY attempt
// diagnostics surface (added under Julie's Oct 29, 2026
// diagnostics approval, board comment 6511269658, following the
// Forever Pucked Ch 2 halt diagnosis). The diagnosis showed the
// decisive halt evidence — per-execution stage/detail and the
// per-call attempt log — had no read path in the live build.
// This surface reads d6_execution_records + d6_attempt_log for
// one plan or one job, behind the seed route's fence class.
//
// Proven here:
//   Svc-1  fixture records read back correctly (execution stage/
//          detail, attempt rows with outcome/cost/duration —
//          incl. an unknown attempt with a ~120 s span, the
//          timeout signature the diagnosis looks for);
//   Svc-2  detail payloads are scalar-whitelisted: fixture text
//          sentinels under non-whitelisted keys NEVER appear in
//          the serialized response, whitelisted error fields do;
//   Svc-3  pagination: executions page by keyset cursor, stable
//          order, no repeats; jobId targeting works;
//   Svc-4  unknown plan/job -> found:false, empty pages, no
//          throw (the harness .one() THROWS on empty results);
//          missing/duplicated target -> rejected;
//   Ent-1  operator credential admitted WITHOUT any client token
//          (the Option D fence class) and reads the fixtures;
//   Ent-2  the everyday client token alone is refused (403
//          migration_operator_required), as are a wrong operator
//          token and no credentials — refusals read nothing;
//   Ent-3  fail-closed configuration: operator unset, or equal
//          to the client token -> 503;
//   Ent-4  the admitted stamp cannot be forged through public
//          routing; the class gate requires the stamp (internal
//          header + scope alone do not suffice);
//   Ent-5  unknown plan through the full public chain -> 200
//          found:false (no throw end to end).
import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";

import { createGenStore } from "../worker/generation/genstore.mjs";
import { createGenerationService } from "../worker/generation/service.mjs";
import { makeHarness } from "./helpers/do-harness.mjs";
import D6Entry, * as d6Module from "../worker/worker-entry-prod-d6.js";

const D6Prod = d6Module.OpalReaderCoordinatorProd;
const TOK = "prod-client-token-synthetic";
const OPTOK = "prod-operator-token-synthetic";
const ORIGIN = "https://jedavid33-design.github.io";
const SENTINEL = "SENTINEL_SEGMENT_TEXT_7f3a";
const SENTINEL2 = "SENTINEL_SPEECH_TEXT_91bc";
const T0 = 1793315400000;

// ---------------------------------------------------------------------------
// Fixtures (shared by the service and entry levels)
// ---------------------------------------------------------------------------
function seedDiagnostics(db) {
  db.prepare(`INSERT INTO d6_plans (plan_id, book_id, intent_key, scope,
      keep_going, lane, phase, state, stop_reason, eligible_digest,
      created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run("plan:diag1", "book-diag", "intent-diag", "chapter", 0, "standard",
      "forever-pucked", "halted_unknown", "phase_halted_unknown_billing",
      "digest-diag", T0, T0 + 130000);
  db.prepare(`INSERT INTO d6_plan_jobs (plan_id, job_id, chapter_index, seq)
    VALUES (?, ?, ?, ?)`)
    .run("plan:diag1", "plan:diag1:ch1", 1, 0);
  // exec-1: failed at synthesis with the no-audio 502 detail
  // (diagnosis branch (b)) + a sentinel-carrying payload.
  db.prepare(`INSERT INTO d6_execution_records (execution_id, plan_id, job_id,
      occurrence_id, grant_id, state, stage, cache_key, size_bytes, detail_json,
      created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run("exec-1", "plan:diag1", "plan:diag1:ch1", "occ-a", "grant-1", "failed",
      "synthesis", null, null,
      JSON.stringify({ stage: "synthesis", httpStatus: 502,
        message: "Gemini 3.8 TTS returned no audio.",
        text: SENTINEL, speechText: SENTINEL2 }), T0 + 1000, T0 + 3000);
  db.prepare(`INSERT INTO d6_attempt_log (attempt_id, execution_id, plan_id,
      occurrence_id, seq, phase, outcome, cost_micro_cents, upper_micro_cents,
      provider_request_id, detail_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run("att-1", "exec-1", "plan:diag1", "occ-a", 1, "confirmed", "failed_known",
      0, 19652, "req-1", JSON.stringify({ httpStatus: 502, text: SENTINEL }),
      T0 + 1000, T0 + 3000);
  // exec-2: the unknown-billing execution — one attempt, unknown
  // outcome, NULL cost, a ~120 s dispatch span (the timeout
  // signature), and the stored raw error message.
  db.prepare(`INSERT INTO d6_execution_records (execution_id, plan_id, job_id,
      occurrence_id, grant_id, state, stage, cache_key, size_bytes, detail_json,
      created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run("exec-2", "plan:diag1", "plan:diag1:ch1", "occ-b", "grant-1",
      "unknown_billing", null, null, null,
      JSON.stringify({ message: "The operation timed out.", occurrenceId: "occ-b",
        text: SENTINEL }), T0 + 4000, T0 + 124000);
  db.prepare(`INSERT INTO d6_attempt_log (attempt_id, execution_id, plan_id,
      occurrence_id, seq, phase, outcome, cost_micro_cents, upper_micro_cents,
      provider_request_id, detail_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run("att-2", "exec-2", "plan:diag1", "occ-b", 1, "confirmed", "unknown",
      null, 19652, null, null, T0 + 4000, T0 + 124000);
  // exec-3: committed cleanly (a success record for contrast).
  db.prepare(`INSERT INTO d6_execution_records (execution_id, plan_id, job_id,
      occurrence_id, grant_id, state, stage, cache_key, size_bytes, detail_json,
      created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run("exec-3", "plan:diag1", "plan:diag1:ch1", "occ-c", "grant-1", "committed",
      "commit", "f".repeat(64), 4197164, null, T0 + 125000, T0 + 126000);
  db.prepare(`INSERT INTO d6_attempt_log (attempt_id, execution_id, plan_id,
      occurrence_id, seq, phase, outcome, cost_micro_cents, upper_micro_cents,
      provider_request_id, detail_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run("att-3", "exec-3", "plan:diag1", "occ-c", 1, "confirmed", "success",
      17749, 19652, "req-3", null, T0 + 125000, T0 + 126000);
}

function svc() {
  const h = makeHarness({});
  const store = createGenStore(h.coord);
  const service = createGenerationService({
    coord: h.coord, env: { GENERATION_HALT: "0" }, store,
  });
  return { h, service };
}

// ---------------------------------------------------------------------------
// Service level
// ---------------------------------------------------------------------------
test("Svc-1: fixture records read back — stage/detail, attempts, the 120 s unknown span", async () => {
  const { h, service } = svc();
  seedDiagnostics(h.db);
  const r = await service.attemptDiagnostics({ planId: "plan:diag1" });
  assert.equal(r.found, true);
  assert.equal(r.plan.state, "halted_unknown");
  assert.equal(r.plan.stopReason, "phase_halted_unknown_billing");
  assert.equal(r.plan.chapterIndex, 1);
  assert.equal(r.executions.length, 3);
  const [e1, e2, e3] = r.executions;
  assert.equal(e1.state, "failed");
  assert.equal(e1.stage, "synthesis");
  assert.equal(e1.detail.httpStatus, 502);
  assert.equal(e1.detail.message, "Gemini 3.8 TTS returned no audio.");
  assert.equal(e1.attempts.length, 1);
  assert.equal(e1.attempts[0].outcome, "failed_known");
  assert.equal(e1.attempts[0].durationMs, 2000);
  assert.equal(e2.state, "unknown_billing");
  assert.equal(e2.detail.message, "The operation timed out.");
  assert.equal(e2.attempts[0].outcome, "unknown");
  assert.equal(e2.attempts[0].costMicroCents, null, "unknown cost stays NULL — never estimated");
  assert.equal(e2.attempts[0].durationMs, 120000, "the ~120 s span is the timeout signature");
  assert.equal(e3.state, "committed");
  assert.equal(e3.cacheKey, "f".repeat(64));
  assert.equal(e3.attempts[0].outcome, "success");
  assert.equal(e3.attempts[0].costMicroCents, 17749);
});

test("Svc-2: no segment text can ride the surface — sentinels absent, whitelist only", async () => {
  const { h, service } = svc();
  seedDiagnostics(h.db);
  const r = await service.attemptDiagnostics({ planId: "plan:diag1" });
  const raw = JSON.stringify(r);
  assert.ok(!raw.includes(SENTINEL), "execution-detail sentinel leaked");
  assert.ok(!raw.includes(SENTINEL2), "speechText sentinel leaked");
  const e1 = r.executions[0];
  assert.deepEqual(Object.keys(e1.detail).sort(), ["httpStatus", "message"],
    "only whitelisted scalar fields survive");
  assert.ok(!("text" in e1.detail) && !("speechText" in e1.detail), "text keys stripped");
  assert.ok(!("text" in (e1.attempts[0].detail ?? {})), "attempt detail stripped");
  assert.equal(e1.attempts[0].detail.httpStatus, 502, "whitelisted attempt detail survives");
});

test("Svc-3: keyset pagination over executions + jobId targeting", async () => {
  const { h, service } = svc();
  seedDiagnostics(h.db);
  const seen = [];
  let cursor = null;
  for (let i = 0; i < 5; i++) {
    const page = await service.attemptDiagnostics({ planId: "plan:diag1", limit: 2, cursor });
    seen.push(...page.executions.map((e) => e.executionId));
    cursor = page.nextCursor;
    if (!cursor) break;
  }
  assert.deepEqual(seen, ["exec-1", "exec-2", "exec-3"], "stable order, no repeats");
  assert.equal(cursor, null);
  const byJob = await service.attemptDiagnostics({ jobId: "plan:diag1:ch1" });
  assert.equal(byJob.found, true);
  assert.equal(byJob.executions.length, 3);
  assert.equal(byJob.plan.planId, "plan:diag1", "job query resolves its plan summary");
  const clamped = await service.attemptDiagnostics({ planId: "plan:diag1", limit: 10000 });
  assert.equal(clamped.executions.length, 3, "limit clamps without error");
});

test("Svc-4: unknown targets -> found:false without throwing; bad targeting rejected", async () => {
  const { service } = svc(); // empty store: every lookup is an empty result
  const noPlan = await service.attemptDiagnostics({ planId: "plan:missing" });
  assert.equal(noPlan.found, false);
  assert.deepEqual(noPlan.executions, []);
  assert.equal(noPlan.plan, null);
  assert.equal(noPlan.nextCursor, null);
  const noJob = await service.attemptDiagnostics({ jobId: "job:missing" });
  assert.equal(noJob.found, false);
  for (const bad of [{}, { planId: "x", jobId: "y" }, { planId: "" }, { planId: 7 }]) {
    const r = await service.attemptDiagnostics(bad);
    assert.equal(r.outcome, "rejected");
    assert.equal(r.reason, "diagnostics_target_required");
  }
});

// ---------------------------------------------------------------------------
// Entry level — through the REAL D6 entry + class (the seed-
// hardening world pattern: node:sqlite behind a DO-shaped facade
// whose .one() THROWS on empty results, like the real DO).
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

function world({ entryExtra = {}, classExtra = {}, seed = true } = {}) {
  const { db, state } = makeDoState();
  const inst = new D6Prod(state, {
    OPALREADER_V2_SCOPE: "production", OPALREADER_ACCESS_TOKEN: TOK,
    OPALREADER_MIGRATION_OPERATOR_TOKEN: OPTOK,
    GENERATION_HALT: "0", ALLOWED_ORIGIN: ORIGIN, ...classExtra,
  });
  const ns = { idFromName: n => n, get: () => ({ fetch: (req) => inst.fetch(req) }) };
  const entryEnv = {
    OPALREADER_V2_SCOPE: "production", OPALREADER_ACCESS_TOKEN: TOK,
    OPALREADER_MIGRATION_OPERATOR_TOKEN: OPTOK,
    GENERATION_HALT: "0", COORDINATOR: ns, ALLOWED_ORIGIN: ORIGIN,
    ...entryExtra,
  };
  const call = ({ token = null, operator = OPTOK, headers = {}, query = "planId=plan%3Adiag1" } = {}) =>
    D6Entry.fetch(new Request(`https://w.test/v2/d6-diagnostics?${query}`, {
      method: "GET",
      headers: {
        ...(token === null ? {} : { "x-opalreader-token": token }),
        ...(operator === null ? {} : { "x-opalreader-operator-token": operator }),
        "x-opalreader-scope": "production", "x-opalreader-instance": "account",
        ...headers,
      },
    }), entryEnv);
  return { db, inst, entryEnv, call, seed };
}

// Bootstrap the schema through one admitted empty-store call,
// then insert the fixtures into the same DO database.
async function seededWorld(opts = {}) {
  const w = world(opts);
  const boot = await w.call({ query: "planId=plan%3Abootstrap" });
  assert.equal(boot.status, 200, "bootstrap call admitted");
  assert.equal((await boot.json()).found, false, "empty store reads as found:false");
  if (opts.seed !== false) seedDiagnostics(w.db);
  return w;
}

test("Ent-1: operator credential admitted with NO client token; fixtures read", async () => {
  const w = await seededWorld();
  const r = await w.call();
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.found, true);
  assert.equal(body.executions.length, 3);
  assert.equal(body.executions[1].attempts[0].durationMs, 120000);
  const raw = JSON.stringify(body);
  assert.ok(!raw.includes(SENTINEL) && !raw.includes(SENTINEL2), "no sentinel over the wire");
});

test("Ent-2: the client token alone is refused — and refusals read nothing", async () => {
  const w = await seededWorld();
  const clientOnly = await w.call({ token: TOK, operator: null });
  assert.equal(clientOnly.status, 403);
  assert.equal((await clientOnly.json()).error, "migration_operator_required");
  const wrongOp = await w.call({ operator: "not-the-operator-token" });
  assert.equal(wrongOp.status, 403);
  const none = await w.call({ operator: null });
  assert.equal(none.status, 403);
  const clientAsOperator = await w.call({ token: TOK, operator: TOK });
  assert.equal(clientAsOperator.status, 403,
    "the client token presented as the operator credential is refused");
});

test("Ent-3: fail-closed configuration — operator unset or equal to client token -> 503", async () => {
  // No fixtures needed: the refusal happens before any read.
  const unset = world({ entryExtra: { OPALREADER_MIGRATION_OPERATOR_TOKEN: undefined } });
  const ru = await unset.call();
  assert.equal(ru.status, 503);
  assert.equal((await ru.json()).error, "migration_operator_not_configured");
  const equal = world({ entryExtra: { OPALREADER_MIGRATION_OPERATOR_TOKEN: TOK } });
  const r = await equal.call({ operator: TOK });
  assert.equal(r.status, 503);
  assert.equal((await r.json()).error, "migration_operator_not_configured");
});

test("Ent-4: the stamp cannot be forged publicly; the class gate requires it", async () => {
  const w = await seededWorld();
  const forged = await w.call({ operator: null, headers: { "x-opalreader-operator-admitted": "1" } });
  assert.equal(forged.status, 403, "a client-supplied stamp never substitutes for admission");
  const mk = (stamp) => new Request("https://do.test/internal/d6/diagnostics?planId=plan%3Adiag1", {
    method: "GET",
    headers: {
      "x-opalreader-internal": "1", "x-opalreader-scope": "production",
      ...(stamp === null ? {} : { "x-opalreader-operator-admitted": stamp }),
    },
  });
  for (const stamp of [null, "0"]) {
    const r = await w.inst.fetch(mk(stamp));
    assert.equal(r.status, 403);
    assert.equal((await r.json()).error, "migration_operator_required");
  }
  const admitted = await w.inst.fetch(mk("1"));
  assert.equal(admitted.status, 200);
  assert.equal((await admitted.json()).executions.length, 3);
});

test("Ent-5: unknown plan through the public chain -> 200 found:false, no throw", async () => {
  const w = await seededWorld();
  const r = await w.call({ query: "planId=plan%3Adoes-not-exist" });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.found, false);
  assert.deepEqual(body.executions, []);
  const bad = await w.call({ query: "" });
  assert.equal(bad.status, 400, "a missing target is a clean rejection, not a throw");
});
