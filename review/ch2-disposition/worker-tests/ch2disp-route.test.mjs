// CH2 DISPOSITION PACKAGE — the uncertainty disposition
// (UNCERTAINTY-DISPOSITION-DESIGN Rev 2), route / fence level.
// Covers design §10 tests 2 (non-resumption in BOTH halt
// states, incl. the admission-fence leg), 5 (route negatives —
// the closed allowlist), 9 (stale-message dispatch refusal
// after retirement), and 10's route inventory. The store /
// service / guard halves live in ch2disp-disposition.test.mjs.
//
// The entry world mirrors ch2fix-reconcile-route.test.mjs (the
// B2 negative pattern); the stale-message world mirrors
// ch2fix-rearm-fence.test.mjs's real pre-claim path. All
// fixtures synthetic; no book text anywhere. This suite is the
// package's own candidate suite; no baseline suite is touched.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import D6Entry from "../worker/worker-entry-prod-d6.js";
import { OpalReaderCoordinatorProd as D6Prod } from "../worker/worker-entry-prod-d6.js";
import { GenerationCoordinator } from "../worker/coordinator.mjs";
import { createGenerationService } from "../worker/generation/service.mjs";
import { createGenStore } from "../worker/generation/genstore.mjs";
import { createCoordinatorPlaneSource } from "../worker/generation/content-plane-adapter.mjs";
import { makeHarness } from "./helpers/do-harness.mjs";
import {
  makeFakeR2Bucket, makeFakeD6Providers, sha256HexOf,
} from "./helpers/d6-fakes.mjs";
import { createFlushStore } from "../worker/generation/flush-store.mjs";
import { createD6Executor } from "../worker/generation/d6-executor.mjs";
import { createD6WorkSource } from "../worker/generation/d6-work-source.mjs";
import { fingerprintFor } from "../worker/executor.mjs";

const CLIENT_TOKEN = "disp-fixture-client-token";
const OPERATOR_TOKEN = "disp-fixture-operator-token";
const PLAN_ID = "plan:disp";
const ATTEMPT_ID = "att-disp-1";
const PHASE = "phase-disp";
const AUTH = "julie-approval:fixture-6535417583";
const DISPOSE_BODY = {
  attemptId: ATTEMPT_ID, planId: PLAN_ID, authorizationRef: AUTH,
  note: "fixture disposition",
};

// ---------------------------------------------------------------
// Entry world (the ch2fix-reconcile-route pattern): the real
// production entry + class over a real SQLite store, seeded
// with the Ch 2 shape — halted plan, plan entry, confirmed /
// unknown attempt, unknown_billing execution, phase flag set.
// ---------------------------------------------------------------
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
    if (isQuery) rows = stmt.all(...params);
    else stmt.run(...params);
    return new SqlCursor(rows);
  }
}

function entryWorld({ halt = "1" } = {}) {
  const db = new DatabaseSync(":memory:");
  const storage = {
    sql: new SqlFacade(db),
    transactionSync(fn) {
      db.exec("BEGIN IMMEDIATE");
      try { const r = fn(); db.exec("COMMIT"); return r; }
      catch (e) { try { db.exec("ROLLBACK"); } catch {} throw e; }
    },
    async setAlarm() {},
    async getAlarm() { return null; },
  };
  const queue = { sent: [], async send(m) { this.sent.push(m); } };
  const classEnv = {
    OPALREADER_V2_SCOPE: "production",
    OPALREADER_ACCESS_TOKEN: CLIENT_TOKEN,
    OPALREADER_MIGRATION_OPERATOR_TOKEN: OPERATOR_TOKEN,
    OPALREADER_PHASE_POLICY: "enforce",
    ALLOWED_ORIGIN: "https://opalreader.invalid",
    GENERATION_HALT: halt,
    OPALREADER_R2: {
      async head() { return null; },
      async get() { return null; },
      async put() { return { etag: "x" }; },
    },
    OPALREADER_GENERATION_QUEUE: queue,
  };
  const inst = new D6Prod({ storage }, classEnv);
  const entryEnv = {
    ...classEnv,
    COORDINATOR: {
      idFromName: (n) => n,
      get: () => ({ fetch: (req) => inst.fetch(req) }),
    },
  };
  const coord = new GenerationCoordinator({ storage }, classEnv);
  const store = createGenStore(coord);
  store.ensureSchema();
  const run = (sql, ...params) => db.prepare(sql).run(...params);
  run(`INSERT INTO d6_plans (plan_id, intent_key, book_id, scope, keep_going,
        phase, lane, state, stop_reason, eligible_digest, created_at, updated_at)
       VALUES (?, 'intent-disp', 'book-disp', 'chapter', 0, ?, 'standard',
        'halted_unknown', 'phase_halted_unknown_billing', NULL, 1, 1)`,
    PLAN_ID, PHASE);
  run(`INSERT INTO d6_plan_entries (plan_id, occurrence_id, book_id, chapter_id,
        chapter_index, position, pov_key, char_count, upper_micro_cents,
        disposition, job_id)
       VALUES (?, 'occ-disp-1', 'book-disp', 'ch-1', 1, 0, 'pov-a', 1000,
        22500, 'eligible', 'plan:disp:ch1')`, PLAN_ID);
  run(`INSERT INTO d6_execution_records (execution_id, plan_id, job_id,
        occurrence_id, grant_id, state, stage, cache_key, object_key, etag,
        size_bytes, sha256, detail_json, created_at, updated_at)
       VALUES ('exec-disp-1', ?, 'plan:disp:ch1', 'occ-disp-1', 'grant-disp',
        'unknown_billing', 'synthesis', NULL, NULL, NULL, NULL, NULL,
        '{"message":"simulated timeout"}', 1, 2)`, PLAN_ID);
  run(`INSERT INTO d6_attempt_log (attempt_id, execution_id, plan_id,
        occurrence_id, seq, phase, outcome, cost_micro_cents,
        upper_micro_cents, provider_request_id, detail_json,
        created_at, updated_at)
       VALUES (?, 'exec-disp-1', ?, 'occ-disp-1', 1, 'confirmed',
        'unknown', NULL, 31337, NULL, NULL, 1, 2)`,
    ATTEMPT_ID, PLAN_ID);
  run(`INSERT INTO d6_phase_state (phase, halted_unknown_billing,
        halt_detail, updated_at) VALUES (?, 1, 'unknown billing', 1)`, PHASE);
  const service = createGenerationService({
    coord, env: classEnv, store,
    sources: createCoordinatorPlaneSource(coord),
    phasePolicyMode: "enforce",
  });
  return { db, inst, entryEnv, classEnv, queue, service };
}

const one = (db, sql, ...p) => db.prepare(sql).get(...p);
const all = (db, sql, ...p) => db.prepare(sql).all(...p);
const attemptRow = (db) => one(db, `SELECT * FROM d6_attempt_log WHERE attempt_id = ?`, ATTEMPT_ID);
const planRow = (db) => one(db, `SELECT * FROM d6_plans WHERE plan_id = ?`, PLAN_ID);
const adjudicationCount = (db) => {
  const exists = one(db, `SELECT name FROM sqlite_master WHERE type='table' AND name='d6_billing_adjudications'`);
  return exists ? all(db, `SELECT * FROM d6_billing_adjudications`).length : 0;
};

async function adjudicateViaEntry(w, body, { operator = OPERATOR_TOKEN, access = null } = {}) {
  const headers = {
    "content-type": "application/json",
    "x-opalreader-scope": "production",
    "x-opalreader-instance": "account",
    Origin: "https://opalreader.invalid",
  };
  if (operator != null) headers["x-opalreader-operator-token"] = operator;
  if (access != null) headers["x-opalreader-token"] = access;
  const res = await D6Entry.fetch(new Request(
    "https://opalreader.invalid/v2/d6-adjudicate-estimated",
    { method: "POST", headers, body: JSON.stringify(body) }), w.entryEnv);
  return { status: res.status, body: await res.json().catch(() => null) };
}

// ---------------------------------------------------------------
// §10 test 5 — route negatives (the closed allowlist), the B2
// negative pattern: every refusal with zero state/audit
// movement — the adjudication tables are never even created.
// ---------------------------------------------------------------
test("disp-5 fence: no operator token, client token alone, unstamped internal — all refused", async () => {
  const w = entryWorld();
  const before = JSON.stringify(attemptRow(w.db));
  let r = await adjudicateViaEntry(w, DISPOSE_BODY, { operator: null });
  assert.equal(r.status, 403, "no operator credential -> 403 at the entry fence");
  r = await adjudicateViaEntry(w, DISPOSE_BODY, { operator: null, access: CLIENT_TOKEN });
  assert.equal(r.status, 403, "the everyday client token alone is refused");
  r = await adjudicateViaEntry(w, DISPOSE_BODY, { operator: "wrong-operator-token" });
  assert.equal(r.status, 403, "a wrong operator credential is refused");
  const direct = await w.inst.fetch(new Request(
    "https://do.internal/internal/d6/adjudicate-estimated",
    { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(DISPOSE_BODY) }));
  assert.equal(direct.status, 403, "the class gate refuses without the operator-admitted stamp");
  assert.equal(JSON.stringify(attemptRow(w.db)), before, "refusals moved nothing");
  assert.equal(adjudicationCount(w.db), 0, "no audit rows from refused calls");
});

test("disp-5 closed allowlist: figure keys and foreign keys refuse the whole request", async () => {
  const w = entryWorld();
  const before = JSON.stringify(attemptRow(w.db));
  for (const key of ["knownCostMicro", "estimatedCostMicro",
                     "estimated_cost_micro_cents", "reservedCostMicro",
                     "reserved_cost_micro_cents", "costMicroCents"]) {
    const r = await adjudicateViaEntry(w, { ...DISPOSE_BODY, [key]: 123 });
    assert.equal(r.body?.outcome, "rejected", key);
    assert.equal(r.body?.reason, "adjudication_figure_caller_supplied",
      `${key}: money figures are server-derived; naming one is malformed`);
  }
  for (const key of ["source", "phase", "outcome", "evidenceRefs"]) {
    const r = await adjudicateViaEntry(w, { ...DISPOSE_BODY, [key]: "x" });
    assert.equal(r.body?.reason, "adjudication_request_key_not_allowed", key);
  }
  let r = await adjudicateViaEntry(w, { ...DISPOSE_BODY, note: 42 });
  assert.equal(r.body?.reason, "note_invalid", "a non-string note refuses");
  r = await adjudicateViaEntry(w, {});
  assert.equal(r.body?.reason, "attempt_id_required");
  r = await adjudicateViaEntry(w, { ...DISPOSE_BODY, attemptId: "   " });
  assert.equal(r.body?.reason, "attempt_id_required", "whitespace-only attemptId is no attemptId");
  r = await adjudicateViaEntry(w, { attemptId: ATTEMPT_ID });
  assert.equal(r.body?.reason, "plan_id_required");
  r = await adjudicateViaEntry(w, { ...DISPOSE_BODY, planId: "  " });
  assert.equal(r.body?.reason, "plan_id_required", "whitespace-only planId is no planId");
  r = await adjudicateViaEntry(w, { attemptId: ATTEMPT_ID, planId: PLAN_ID });
  assert.equal(r.body?.reason, "authorization_ref_required");
  r = await adjudicateViaEntry(w, { ...DISPOSE_BODY, authorizationRef: "   " });
  assert.equal(r.body?.reason, "authorization_ref_required",
    "whitespace-only authorizationRef is no authorization");
  r = await adjudicateViaEntry(w, { ...DISPOSE_BODY, attemptId: "att-nope" });
  assert.equal(r.body?.reason, "attempt_not_found",
    "a well-formed request for a missing attempt reaches the store and refuses there");
  assert.equal(JSON.stringify(attemptRow(w.db)), before,
    "every refusal left the attempt byte-identical");
  assert.equal(one(w.db, `SELECT halted_unknown_billing FROM d6_phase_state
                           WHERE phase = ?`, PHASE).halted_unknown_billing, 1,
    "the phase flag still stands");
  assert.equal(adjudicationCount(w.db), 0, "no audit rows from any refused call");
  const tables = all(w.db, `SELECT name FROM sqlite_master WHERE type='table'`).map(t => t.name);
  assert.ok(!tables.includes("d6_billing_adjudications"),
    "route/store refusals never create the adjudication tables");
});

// ---------------------------------------------------------------
// §10 test 2 — non-resumption in BOTH halt states (Q1's proof),
// through the route, in the R4-1 sequence: dispose first, then
// drive cycles (the alarm shape included). The halted plan must
// be byte-identical afterwards.
// ---------------------------------------------------------------
for (const halt of ["1", "0"]) {
  test(`disp-2 (GENERATION_HALT "${halt}"): route disposition -> drives NEVER resume the halted plan`, async () => {
    const w = entryWorld({ halt });
    const r = await adjudicateViaEntry(w, DISPOSE_BODY);
    assert.equal(r.status, 200);
    assert.equal(r.body?.outcome, "applied", "the disposition applies in this halt state");
    assert.equal(r.body?.attemptOutcome, "estimated_unverified");
    assert.equal(r.body?.estimatedCostMicroCents, 14098,
      "own-length estimate for the fixture's 1000 chars — not the flat 19,652");
    assert.equal(r.body?.reservedCostMicroCents, 31337,
      "the reservation is the attempt row's recorded upper");
    assert.equal(r.body?.haltCleared, true);
    assert.equal(planRow(w.db).state, "halted_unknown");
    assert.equal(one(w.db, `SELECT halted_unknown_billing FROM d6_phase_state
                             WHERE phase = ?`, PHASE).halted_unknown_billing, 0,
      "the phase flag cleared at disposition (Q1) — and clearing is not re-arm");

    if (halt === "1") {
      const headers = {
        "content-type": "application/json",
        "x-opalreader-scope": "production",
        "x-opalreader-instance": "account",
        "x-opalreader-token": CLIENT_TOKEN,
        Origin: "https://opalreader.invalid",
      };
      const res = await D6Entry.fetch(new Request(
        "https://opalreader.invalid/v2/commands",
        { method: "POST", headers, body: JSON.stringify({
          command_id: "cmd-legacy-1", type: "SubmitJob",
          payload: { jobId: "job-legacy-1", bookId: "book-disp",
                     chapterIndex: 1, lane: "standard", occurrences: [],
                     data: { estMicroCents: 1000 } } }) }), w.entryEnv);
      assert.equal(res.status, 423,
        "halt-refused legacy commands still refuse 423 after the disposition");
    }

    const planBefore = JSON.stringify(planRow(w.db));
    const attemptBefore = JSON.stringify(attemptRow(w.db));
    for (let i = 0; i < 3; i++) {
      const outcomes = await w.service.driveOnce();
      assert.ok(!outcomes.some((o) => o.planId === PLAN_ID),
        `drive cycle ${i + 1} never selected the halted plan`);
    }
    await w.inst.alarm(); // the production alarm shape: recover + drive
    assert.equal(JSON.stringify(planRow(w.db)), planBefore,
      "the plan row is byte-identical after disposition + drives + alarm");
    assert.equal(JSON.stringify(attemptRow(w.db)), attemptBefore,
      "the disposed attempt was not re-touched");
    assert.equal(planRow(w.db).state, "halted_unknown");
    assert.equal(all(w.db, `SELECT * FROM d6_attempt_log`).length, 1, "no new attempts");
    assert.equal(all(w.db, `SELECT * FROM d6_execution_records`).length, 1,
      "no execution was created");
    assert.equal(w.queue.sent.length, 0, "nothing was dispatched to the generation queue");
    const adj = all(w.db, `SELECT * FROM d6_billing_adjudications`);
    assert.equal(adj.length, 1);
    assert.equal(adj[0].authorization_ref, AUTH,
      "the recorded authorization reference is the call's, verbatim");
    assert.equal(adj[0].source, "operator-route");
    assert.ok(Array.isArray(JSON.parse(adj[0].evidence_refs)) &&
              JSON.parse(adj[0].evidence_refs).length >= 4,
      "the frozen evidence reference set is stamped server-side");
  });
}

// §10 test 2(b), admission leg: with the global halt OFF and the
// phase flag cleared by the disposition, a FRESH intent over the
// halted plan's occurrences is still fenced by the plan's
// ownership — a byte-identical retry converges on the halted
// plan (creating nothing), and a different-semantics intent is
// refused by the active-overlap fence naming that plan.
test("disp-2b admission fence: a fresh intent over the disposed plan's occurrences stays fenced", async () => {
  const h = makeHarness({});
  const store = createGenStore(h.coord);
  store.ensureSchema();
  const BOOK = "book-disp-intent";
  const seg = (occurrenceId, text) => ({ occurrenceId, text, pov: "pov-a" });
  const data = {
    chapters: [{ chapterId: "ch-1", index: 1, segments: [
      seg("s1", "Synthetic intent-fixture prose one."),
      seg("s2", "Synthetic intent-fixture prose two."),
    ] }],
    povs: [{ id: "pov-a", name: "Aria", voice: {
      voice_id: "Zephyr", provider: "gemini",
      model_id: "gemini-3.8-flash-tts", style_direction: "warm" } }],
  };
  h.db.prepare(`INSERT INTO sync_entities (family, entity_key, book_id, revision, deleted, data_json)
                VALUES ('content', ?, ?, 1, 0, ?)`).run(BOOK, BOOK, JSON.stringify(data));
  const service = createGenerationService({
    coord: h.coord, env: { GENERATION_HALT: "0" }, store,
    sources: createCoordinatorPlaneSource(h.coord),
  });
  const sub = await service.submitIntent({
    commandId: "cmd-disp-intent", bookId: BOOK, scope: "chapter",
    chapterIndex: 1, phase: "forever-pucked", lane: "standard",
  });
  assert.ok(sub.planId, "the chapter plan was created");
  const planId = sub.planId;
  // Force the Ch 2 shape onto the real plan: halted_unknown, one
  // confirmed/unknown attempt over its first eligible entry, the
  // phase flag set.
  const entry = h.db.prepare(
    `SELECT * FROM d6_plan_entries WHERE plan_id = ? AND disposition = 'eligible'
      ORDER BY position LIMIT 1`).get(planId);
  assert.ok(entry, "the plan has an eligible entry");
  h.db.prepare(`UPDATE d6_plans SET state = 'halted_unknown',
                  stop_reason = 'phase_halted_unknown_billing'
                 WHERE plan_id = ?`).run(planId);
  h.db.prepare(`INSERT INTO d6_execution_records (execution_id, plan_id, job_id,
      occurrence_id, grant_id, state, stage, detail_json, created_at, updated_at)
    VALUES ('exec-intent', ?, ?, ?, 'grant-intent', 'unknown_billing',
      'synthesis', '{"message":"simulated timeout"}', 1, 2)`)
    .run(planId, entry.job_id, entry.occurrence_id);
  h.db.prepare(`INSERT INTO d6_attempt_log (attempt_id, execution_id, plan_id,
      occurrence_id, seq, phase, outcome, cost_micro_cents, upper_micro_cents,
      created_at, updated_at)
    VALUES ('att-intent', 'exec-intent', ?, ?, 1, 'confirmed', 'unknown',
      NULL, 23000, 1, 2)`).run(planId, entry.occurrence_id);
  h.db.prepare(`INSERT INTO d6_phase_state (phase, halted_unknown_billing,
      halt_detail, updated_at)
    VALUES ('forever-pucked', 1, 'unknown billing', 1)`).run();

  const r = service.adjudicateEstimatedAttempt("att-intent", {
    planId, authorizationRef: AUTH, source: "operator-route",
    evidenceRefs: ["exhibit-a:fixture"],
  });
  assert.equal(r.outcome, "applied");
  assert.equal(r.haltCleared, true, "the phase flag cleared — the plan did not move");

  const drives = await service.driveOnce();
  assert.ok(!drives.some((o) => o.planId === planId),
    "the driver still excludes the halted plan with the halt OFF");

  const retry = await service.submitIntent({
    commandId: "cmd-disp-intent", bookId: BOOK, scope: "chapter",
    chapterIndex: 1, phase: "forever-pucked", lane: "standard",
  });
  assert.equal(retry.created, false, "a byte-identical retry converges — creates nothing");
  assert.equal(retry.planId, planId);
  assert.equal(retry.state, "halted_unknown", "and what it converges on is still halted");

  const fresh = await service.submitIntent({
    commandId: "cmd-disp-intent-2", bookId: BOOK, scope: "chapter",
    chapterIndex: 1, phase: "forever-pucked", lane: "standard",
    keepGoing: true,
  });
  assert.equal(fresh.outcome, "rejected");
  assert.equal(fresh.reason, "plan_overlap_conflict",
    "a different-semantics intent over the same occurrences is fenced");
  assert.equal(fresh.conflict.planId, planId,
    "the fence names the halted plan as the owner");
  assert.equal(h.rows("d6_plans").length, 1, "no new plan was minted");
  assert.equal(h.rows("d6_execution_records").length, 1, "no execution was created");
});

// ---------------------------------------------------------------
// §10 test 9 — stale-message dispatch refusal after retirement:
// the fence suite's retired-plan case, extended to the
// post-disposition path (dispose -> retire -> deliver the stale
// grant message -> the plan-state fence refuses it, the message
// is consumed, zero provider contact, zero grants, zero
// movement).
// ---------------------------------------------------------------
const FENCE_BOOK = "book-1";
const FENCE_PHASE = "forever-pucked";
const CONSUMER = "opalreader-v2-prod-d6";
const TEXT = "Synthetic fence-fixture segment prose, invented for the harness only.";
const payloadFor = (text) => ({
  text, voice: "Zephyr", provider: "gemini", model: "gemini-3.8-flash-tts",
  styleDirection: "warm", mode: "standard",
});

function bridgeProbe(bucket, flushStore) {
  const find = (cacheKey) => {
    for (const ext of ["wav", "mp3"]) {
      const key = flushStore.objectKeyFor(cacheKey, ext);
      const e = bucket.store.get(key);
      if (e) return { key, ...e };
    }
    return null;
  };
  return {
    exists: (k) => !!find(k),
    sniff: (k) => { const e = find(k); return e ? (e.key.endsWith(".mp3") ? "mp3" : "wav") : null; },
    recordedIdentity: (k) => { const e = find(k); return e ? (e.customMetadata?.identity ?? null) : null; },
    hash: (k) => { const e = find(k); return e ? sha256HexOf(e.bytes) : null; },
    recordedSha256: (k) => { const e = find(k); return e ? (e.customMetadata?.sha256 ?? null) : null; },
    keyFor: () => null,
  };
}

async function makeFenceWorld() {
  const planId = "plan:disp-fence";
  const bucket = makeFakeR2Bucket();
  const flushStore = createFlushStore(bucket, { keyPrefix: "" });
  const probe = bridgeProbe(bucket, flushStore);
  const h = makeHarness({ probe });
  const store = createGenStore(h.coord);
  store.ensureSchema();
  const jobId = `${planId}:ch1`;
  h.db.prepare(`INSERT OR IGNORE INTO d6_plans
                  (plan_id, intent_key, book_id, scope, keep_going, phase, lane, state, stop_reason, created_at, updated_at)
                VALUES (?, ?, ?, 'chapter', 0, ?, 'standard', 'halted_unknown', 'phase_halted_unknown_billing', 0, 0)`)
    .run(planId, `intent-${planId}`, FENCE_BOOK, FENCE_PHASE);
  const data = {
    chapters: [{ chapterId: "ch-1", segments: [
      { occurrenceId: "o1", text: TEXT, pov: "pov-a" }] }],
    povs: [{ id: "pov-a", name: "Aria", voice: {
      voice_id: "Zephyr", provider: "gemini",
      model_id: "gemini-3.8-flash-tts", style_direction: "warm" } }],
  };
  h.db.prepare(`INSERT INTO sync_entities (family, entity_key, book_id, revision, deleted, data_json)
                VALUES ('content', ?, ?, 1, 0, ?)`).run(FENCE_BOOK, FENCE_BOOK, JSON.stringify(data));
  const providers = makeFakeD6Providers();
  const workSource = createD6WorkSource(h.coord, { cache: null });
  const exec = createD6Executor({
    coord: h.coord, store, providers, flushStore, workSource, consumerId: CONSUMER,
  });
  const sub = await h.coord.handleCommand({
    command_id: `cmd-${jobId}`, type: "SubmitJob",
    payload: { jobId, bookId: FENCE_BOOK, chapterIndex: 1, lane: "standard",
               occurrences: [{ occurrenceId: "o1",
                 revisionKey: fingerprintFor(payloadFor(TEXT)), estMicroCents: 1000 }],
               data: { estMicroCents: 1000, d6PlanId: planId } },
  });
  assert.equal(sub.outcome, "applied");
  h.db.prepare(`INSERT INTO d6_plan_jobs (plan_id, job_id, chapter_index, seq)
                VALUES (?, ?, 1, 0)`).run(planId, jobId);
  const g = await h.coord.requestGrant(jobId);
  assert.equal(g.ok, true);
  let msg = null;
  await h.coord.drainOutbox((p) => { msg = p; });
  assert.ok(msg && msg.grantId === g.grantId, "grant dispatched");
  // The plan entry + the unknown-billing shape over o1.
  h.db.prepare(`INSERT INTO d6_plan_entries (plan_id, occurrence_id, book_id,
      chapter_id, chapter_index, position, pov_key, char_count,
      upper_micro_cents, disposition, job_id)
    VALUES (?, 'o1', ?, 'ch-1', 1, 0, 'pov-a', 1000, 22500, 'eligible', ?)`)
    .run(planId, FENCE_BOOK, jobId);
  const { executionId } = store.createExecution(
    { planId, jobId, occurrenceId: "o1", grantId: g.grantId });
  store.transitionExecution(executionId, "attempted", {});
  const attemptId = store.reserveAttempt(executionId, { upperMicroCents: 23000 });
  store.markDispatching(attemptId);
  store.confirmAttempt(attemptId, { outcome: "unknown", costMicroCents: null });
  store.markUnknownBilling(executionId,
    { message: "simulated timeout", occurrenceId: "o1" });
  const service = createGenerationService({
    coord: h.coord, env: { GENERATION_HALT: "0" }, store,
    sources: createCoordinatorPlaneSource(h.coord),
  });
  return { h, store, service, providers, exec, msg, planId, jobId, attemptId };
}

const COMPARED = ["grants", "claims", "transitions", "jobs", "occurrences",
  "d6_plans", "d6_plan_jobs", "d6_execution_records", "spend_intents",
  "d6_attempt_log"];

test("disp-9 stale message after disposition + retirement: fence refusal, zero contact, zero movement", async () => {
  const w = await makeFenceWorld();
  const disp = w.service.adjudicateEstimatedAttempt(w.attemptId, {
    planId: w.planId, authorizationRef: AUTH, source: "operator-route",
    evidenceRefs: ["exhibit-a:fixture"],
  });
  assert.equal(disp.outcome, "applied");
  const retire = w.service.retireHaltedPlan({
    planId: w.planId, source: "operator-route",
    note: `unknown attempt ${w.attemptId} disposed estimated_unverified (adjudication recorded)`,
  });
  assert.equal(retire.outcome, "applied");
  assert.equal(w.h.rows("d6_plans")[0].state, "retired");

  const before = JSON.stringify(COMPARED.map((t) => [t, w.h.rows(t)]));
  const r = await w.exec.handleMessage(w.msg);
  assert.deepEqual(r, { refused: "plan_not_dispatchable",
                        planId: w.planId, planState: "retired" },
    "the stale grant message resolves to the RETIRED plan and the fence refuses it");
  assert.equal(w.providers.calls.length, 0, "zero provider contact");
  assert.equal(JSON.stringify(COMPARED.map((t) => [t, w.h.rows(t)])), before,
    "zero row movement in every compared table — the message was consumed, nothing else happened");
});

// ---------------------------------------------------------------
// §10 test 10 (route half) — amendment route inventory: the
// entry's route table contains the disposition route and NO
// adjudicate-amend path of any kind.
// ---------------------------------------------------------------
test("disp-10 route inventory: disposition route present, amendment route absent", () => {
  const src = readFileSync(
    new URL("../worker/worker-entry-prod-d6.js", import.meta.url), "utf8");
  assert.ok(src.includes("/v2/d6-adjudicate-estimated"),
    "the disposition route is in the route table");
  assert.ok(src.includes("/internal/d6/adjudicate-estimated"));
  assert.ok(!src.includes("adjudicate-amend"),
    "no d6-adjudicate-amend path exists anywhere in the entry (Q3: operation deferred)");
  assert.ok(!src.includes("amendAdjudication"),
    "no amendment handler exists in the entry");
  const w = entryWorld();
  assert.ok(!Object.keys(w.service).some(k => /amend/i.test(k)),
    "no amendment handle on the service");
});
