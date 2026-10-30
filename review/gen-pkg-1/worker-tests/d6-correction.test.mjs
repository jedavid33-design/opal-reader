// D6 CORRECTION suite — Rowan source-review block 6501450683.
//
// Proves, against the REAL SQLite harness/storage (node:sqlite,
// production `.one()`-throws semantics):
//   C1  Class identity + deploy spec: the D6 entry exports the
//       coordinator under the EXISTING production class name
//       OpalReaderCoordinatorProd; no D6-named class exists; the
//       spec binds that class, applies NO new-class migration, and
//       carries the arming preconditions (fresh R2 recount first).
//   C2  Continuity before/after: the pre-D6 coordinator over a
//       production-shaped fixture (settings at the revision-0
//       baseline, a bound segment, a granted job, a parked-job-
//       shaped job, ledger/content rows) -> the D6-corrected code
//       loaded as the SAME class over the SAME durable state.
//       Every pre-existing table/row byte-identical after the
//       in-place schema bootstrap; the d6_* tables appear empty;
//       settings still revision 0 (the CAS arming write is NOT
//       performed); D6 intent + grant operate on the carried state
//       without rewriting any seeded row.
//   C3  Route/handler preservation with GENERATION_HALT="1" through
//       the REAL host entry: token gate (401, production body),
//       scope gate (403 production_scope_required), instance gate
//       (403 production_instance_required), intent admitted as
//       durable state only (zero grants, zero dispatches, zero
//       executions), internal execute refused 423 exactly as
//       production today, class internal gate intact, queue handler
//       halts BEFORE touching the coordinator namespace.
//   C4  Grant identity with halt="0": a crafted grant (no valid
//       coordinator grant behind it) is dropped `unknown_grant` by
//       the real internal route AND via the real queue handler
//       (acked, never executed, zero execution records, zero
//       bindings); a batch-lane grant is refused `lane_not_allowed`
//       with zero execution records — execution still flows through
//       the coordinator's grant identity checks, no alternate path.
//   C5  Alarm wake/restart + quota rollover through the REAL D6
//       entry (fetch + class alarm): plan A dispatches once and
//       settles; plan B parks at exactly 100 daily attempts;
//       a worker restart (fresh class instance over the same
//       state) changes nothing; after the day boundary the alarm
//       resumes B with exactly one dispatch and never re-sends a
//       settled occurrence.
//
// Synthetic fixtures only. No book text beyond placeholder strings.
//
// ROUND-5 FIXTURE MODERNIZATION (R4-2; Rowan round-5 ruling,
// comment 6514899384, item 3; Julie's explicit approval, comment
// 6522602149 — the ONLY baseline-suite change that approval
// covers): C2/C3/C5 were written before phase policy existed and
// staged budgeted `forever-pucked` intents through the real
// production entry against an EMPTY phase→book registry — the
// first-use admission the registry law now forbids, and (in C5)
// two different books sharing one exclusive phase. The fixtures
// now stage the enforced production shape instead: the entry
// envs carry OPALREADER_PHASE_POLICY="enforce" (the production
// entry constructs enforcement unconditionally since round 5
// and refuses submission with a 503 when the flag is not exactly
// "enforce"), and each fixture records the authorized phase
// binding in its synthetic DO setup before submitting (C2:
// book-fix; C3: book-host; C5: book-a — see recordFixtureBinding
// below). C5's second book no longer claims the shared phase:
// its forged claim is asserted REJECTED
// (phase_bound_to_other_book, zero new plans) and its real plan
// runs unbudgeted (phase null) — C5's proof obligations (one
// grant + one dispatch per plan, alarm wake/restart continuity,
// quota parking at exactly 100, day-boundary rollover with zero
// duplicates) are asserted exactly as before. NO assertion in
// this suite was deleted, skipped, or lowered; the test count
// is unchanged (5 tests: C1–C5). Before/after semantics are
// documented in the gen-pkg-1 build report, Round-5 section.

import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  OpalReaderCoordinatorProd as PreD6Prod,
} from "../worker/worker-entry-prod.js";
import D6Entry, * as d6Module from "../worker/worker-entry-prod-d6.js";
import { GenerationCoordinator } from "../worker/coordinator.mjs";
import { ensurePhaseBindingSchema } from "../worker/generation/phase-policy.mjs";
import { makeHarness, makeProbe } from "./helpers/do-harness.mjs";
import { makeFakeR2Bucket } from "./helpers/d6-fakes.mjs";

const D6Prod = d6Module.OpalReaderCoordinatorProd;
const TOK = "prod-client-token-synthetic";
const ORIGIN = "https://jedavid33-design.github.io";
const NOW = Date.parse("2026-10-29T12:00:00.000Z");

// ---------------------------------------------------------------------------
// Fake Durable Object storage over REAL node:sqlite (same pattern as
// the production-surface suite: DatabaseSync + production seams).
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
  return { db, state: { storage }, storage };
}

// ---------------------------------------------------------------------------
// Fixtures + snapshots.
// ---------------------------------------------------------------------------

function povSet() {
  return {
    povs: [{ id: "pov-n", name: "Narrator", voice: { provider: "gemini", voice_id: "Zephyr", model_id: "gemini-3.8-flash-tts" } }],
    defaultVoice: { provider: "gemini", voiceId: "Zephyr" },
  };
}
function seedContent(db, bookId, chapters) {
  const data = { chapters, ...povSet() };
  db.prepare(`INSERT INTO sync_entities (family, entity_key, book_id, revision, deleted, data_json)
              VALUES ('content', ?, ?, 1, 0, ?)`)
    .run(bookId, bookId, JSON.stringify(data));
}
function seg(id, text = "Synthetic segment text.") { return { occurrenceId: id, text, pov: "pov-n" }; }

function snapshotAll(db) {
  const tables = db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`).all().map(r => r.name);
  const out = {};
  for (const t of tables) {
    out[t] = db.prepare(`SELECT * FROM "${t}" ORDER BY rowid`).all().map(r => ({ ...r }));
  }
  return out;
}
function digestOf(snap) {
  return createHash("sha256").update(JSON.stringify(snap)).digest("hex");
}
function internalReq(path, body) {
  return new Request(`https://do.test${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "x-opalreader-internal": "1",
      "x-opalreader-scope": "production",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
function doEnv(extra = {}) {
  return {
    OPALREADER_V2_SCOPE: "production",
    OPALREADER_ACCESS_TOKEN: TOK,
    GENERATION_HALT: "1",
    OPALREADER_STORAGE: makeFakeR2Bucket(),
    ALLOWED_ORIGIN: ORIGIN,
    ...extra,
  };
}

// Round-5 fixture modernization: record the authorized
// phase→book binding in the synthetic DO setup, the fixture
// equivalent of the operator's gated recording act (the table
// DDL is the production module's own ensure function; the row
// is written directly, exactly as the genpkg1-phase-policy
// entry fixture does). Synthetic books only — nothing here
// touches any production store.
function recordFixtureBinding(storage, db, phase, bookId) {
  ensurePhaseBindingSchema({ sql: storage.sql });
  db.prepare(`INSERT INTO d6_phase_bindings (phase, book_id, source, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?)`)
    .run(phase, bookId, "d6-correction-fixture-r5", NOW, NOW);
}

// ---------------------------------------------------------------------------
// C1 — class identity + deploy spec.
// ---------------------------------------------------------------------------

test("C1: same class identity; spec binds it with no new-class migration", () => {
  assert.equal(D6Prod.name, "OpalReaderCoordinatorProd");
  assert.equal(PreD6Prod.name, "OpalReaderCoordinatorProd");
  assert.notEqual(D6Prod, PreD6Prod, "successor class, same exported name");
  assert.ok(!("OpalReaderCoordinatorProdD6" in d6Module), "no D6-named class export");
  const entrySrc = readFileSync(new URL("../worker/worker-entry-prod-d6.js", import.meta.url), "utf8");
  assert.ok(!entrySrc.includes("class OpalReaderCoordinatorProdD6"), "no D6 subclass declaration");
  const spec = JSON.parse(readFileSync(new URL("../worker/p8/deploy-spec-prod-d6.json", import.meta.url), "utf8"));
  const coord = spec.bindings.find(b => b.name === "COORDINATOR");
  assert.equal(coord.class_name, "OpalReaderCoordinatorProd");
  assert.equal(spec.do_topology.coordinator_class, "OpalReaderCoordinatorProd");
  assert.equal(spec.do_topology.migration_tag, "v1", "the existing production migration");
  assert.equal(spec.durable_object_migrations.applied_for_d6, false);
  assert.deepEqual(spec.durable_object_migrations.new_sqlite_classes, []);
  assert.equal(spec.bindings.find(b => b.name === "GENERATION_HALT").text, "1");
  assert.ok(spec.arming_preconditions[0].includes("5,736,481,302"),
    "arming precondition 1 carries the fresh post-deletion R2 recount");
  assert.ok(spec.arming_preconditions[0].includes("recount first"),
    "recount is an arming precondition, stated as such");
});

// ---------------------------------------------------------------------------
// C2 — continuity before/after over production-shaped fixture state.
// ---------------------------------------------------------------------------

test("C2: D6 bootstrap over carried state rewrites nothing; D6 operates on it", async () => {
  const { db, state } = makeDoState();
  const parkedId = "a".repeat(64);

  // (a) Pre-D6 coordinator over production-shaped fixture state.
  const pre = new PreD6Prod(state, doEnv());
  const coord = pre.coordinator;
  // Settings baseline: NO row — revision 0 is the sealed default.
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM settings").get().n, 0);
  assert.deepEqual(coord._settings(), { monthlyCap: 50, geminiLane: "batch", revision: 0 });

  seedContent(db, "book-fix", [
    { chapterId: "ch-0", index: 0, segments: [{ ...seg("s0"), revisionKey: "fp-s0" }, seg("s1")] },
    { chapterId: "ch-1", index: 1, segments: [seg("s2")] },
    { chapterId: "ch-2", index: 2, segments: [seg("p0"), seg("p1"), seg("p2")] },
  ]);
  // One bound segment (migration-carried binding).
  db.prepare(`INSERT INTO bindings (occurrence_id, revision_key, cache_key, provenance, bound_at)
              VALUES ('s0', 'fp-s0', 'ck-s0', 'migration', ?)`)
    .run(NOW);
  // An ordinary granted standard job (carried ledger/outbox state).
  await coord.handleCommand({
    command_id: "seed-submit", type: "SubmitJob",
    payload: {
      jobId: "job-fix", bookId: "book-fix", chapterIndex: 0, lane: "standard",
      occurrences: [{ occurrenceId: "s1", revisionKey: "fp-s1" }], data: { estMicroCents: 1000 },
    },
  });
  const seededGrant = await coord.requestGrant("job-fix");
  assert.equal(seededGrant.ok, true);
  // A parked-job-shaped job (the Ch 3 carry shape): job + occurrences.
  db.prepare(`INSERT INTO jobs (job_id, kind, book_id, chapter_index, lane, state, revision, data_json, created_at, updated_at)
              VALUES (?, 'job', 'book-fix', 2, 'standard', 'parked_policy', 1, '{}', ?, ?)`)
    .run(parkedId, NOW, NOW);
  db.prepare(`INSERT INTO occurrences (job_id, occurrence_id, revision_key, state) VALUES (?, 'p0', 'fp-p0', 'ready')`).run(parkedId);
  db.prepare(`INSERT INTO occurrences (job_id, occurrence_id, revision_key, state) VALUES (?, 'p1', 'fp-p1', 'pending')`).run(parkedId);

  const before = snapshotAll(db);
  const beforeDigest = digestOf(before);

  // (b) D6-corrected code as the SAME class over the SAME state.
  const sends = [];
  const post = new D6Prod(state, doEnv({
    GENERATION_HALT: "0",
    // Round-5 modernization: the enforced deployment shape.
    OPALREADER_PHASE_POLICY: "enforce",
    OPALREADER_GENERATION_V2: { send: async (m) => { sends.push(m); } },
  }));
  const after = snapshotAll(db);

  // Every pre-existing table/row byte-identical (incl. sqlite_sequence).
  for (const t of Object.keys(before)) {
    assert.deepEqual(after[t], before[t], `pre-existing table ${t} changed by the D6 bootstrap`);
  }
  assert.equal(digestOf(Object.fromEntries(Object.keys(before).map(t => [t, after[t]]))), beforeDigest);
  // The only additions: the eight generation tables, all empty.
  const added = Object.keys(after).filter(t => !(t in before)).sort();
  assert.deepEqual(added, [
    "d6_attempt_log", "d6_execution_records", "d6_phase_state", "d6_plan_entries",
    "d6_plan_jobs", "d6_plans", "d6_storage_state", "d6_voice_prompts",
  ]);
  for (const t of added) assert.equal(after[t].length, 0, `${t} must start empty`);
  // Settings untouched: still no row, still revision 0 — CAS NOT performed.
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM settings").get().n, 0);
  assert.deepEqual(post.coordinator._settings(), { monthlyCap: 50, geminiLane: "batch", revision: 0 });

  // Round-5 modernization: the authorized binding for this
  // fixture's book is recorded in the DO setup BEFORE the intent
  // below is submitted (under enforcement + an empty registry,
  // the round-5 bootstrap gate would refuse even this book's own
  // phase claim — and its null-phase claim too). Recorded after
  // the bootstrap snapshots above, so the table-set assertions
  // over the D6 bootstrap itself are unchanged.
  recordFixtureBinding(state.storage, db, "forever-pucked", "book-fix");

  // (c) D6 behaviors operate against the carried-over state.
  const intentRes = await post.fetch(internalReq("/internal/d6/intent", {
    commandId: "c-int-1", bookId: "book-fix", scope: "book",
    keepGoing: true, phase: "forever-pucked", lane: "standard",
  }));
  assert.equal(intentRes.status, 200);
  const intent = await intentRes.json();
  assert.equal(intent.created, true);

  await post.alarm(); // coordinator alarm + service recover/driveOnce
  const planJobs = db.prepare("SELECT * FROM d6_plan_jobs WHERE plan_id = ?").all(intent.planId);
  assert.equal(planJobs.length, 1);
  const planGrants = db.prepare("SELECT * FROM grants WHERE job_id = ?").all(planJobs[0].job_id);
  assert.equal(planGrants.length, 1, "plan job granted against carried state");
  assert.equal(sends.filter(m => m.jobId === planJobs[0].job_id).length, 1, "plan grant dispatched once");

  // Seeded rows still byte-identical after D6 operation (additions only).
  const nowSnap = snapshotAll(db);
  for (const t of ["bindings", "sync_entities", "settings"]) {
    assert.deepEqual(nowSnap[t], before[t], `seeded ${t} rows rewritten by D6 operation`);
  }
  assert.deepEqual(
    nowSnap.jobs.find(r => r.job_id === parkedId), before.jobs.find(r => r.job_id === parkedId),
    "parked job row untouched");
  assert.deepEqual(
    nowSnap.occurrences.filter(r => r.job_id === parkedId),
    before.occurrences.filter(r => r.job_id === parkedId),
    "parked occurrences untouched");
  assert.deepEqual(
    nowSnap.jobs.find(r => r.job_id === "job-fix"), before.jobs.find(r => r.job_id === "job-fix"),
    "seeded job row untouched");
  assert.deepEqual(post.coordinator._settings(), { monthlyCap: 50, geminiLane: "batch", revision: 0 },
    "settings revision still 0 after intent + drive (arming CAS not performed)");
});

// ---------------------------------------------------------------------------
// C3 — preservation through the real host entry, GENERATION_HALT="1".
// ---------------------------------------------------------------------------

test("C3: halted host entry preserves production gates and halts", async () => {
  const { db, state } = makeDoState();
  // Round-5 modernization: the enforced deployment shape + the
  // authorized binding for this fixture's book, recorded in the
  // DO setup before any submission.
  const inst = new D6Prod(state, doEnv({ OPALREADER_PHASE_POLICY: "enforce" }));
  seedContent(db, "book-host", [{ chapterId: "ch-0", index: 0, segments: [seg("h0")] }]);
  recordFixtureBinding(state.storage, db, "forever-pucked", "book-host");

  let nsCalls = 0;
  const ns = { idFromName: n => n, get: () => { nsCalls++; return { fetch: (req) => inst.fetch(req) }; } };
  const entryEnv = {
    OPALREADER_V2_SCOPE: "production", OPALREADER_ACCESS_TOKEN: TOK,
    GENERATION_HALT: "1", COORDINATOR: ns, ALLOWED_ORIGIN: ORIGIN,
    OPALREADER_PHASE_POLICY: "enforce",
  };
  const call = (path, { method = "GET", body, token = TOK, scope = "production", instance = "account" } = {}) =>
    D6Entry.fetch(new Request(`https://w.test${path}`, {
      method,
      headers: {
        ...(token === null ? {} : { "x-opalreader-token": token }),
        ...(scope === null ? {} : { "x-opalreader-scope": scope }),
        ...(instance === null ? {} : { "x-opalreader-instance": instance }),
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }), entryEnv);
  const intentBody = {
    command_id: "h-int-1", type: "SubmitJob",
    payload: { bookId: "book-host", lane: "standard", data: { d6Intent: { scope: "book", keepGoing: true, phase: "forever-pucked" } } },
  };

  const health = await (await call("/health")).json();
  assert.equal(health.ok, true);
  assert.equal(health.generation, "halted");

  const noTok = await call("/v2/commands", { method: "POST", body: intentBody, token: null });
  assert.equal(noTok.status, 401);
  assert.equal((await noTok.json()).error, "The personal access token is missing or incorrect.");

  const badScope = await call("/v2/commands", { method: "POST", body: intentBody, scope: "staging" });
  assert.equal(badScope.status, 403);
  assert.equal((await badScope.json()).error, "production_scope_required");

  const badInst = await call("/v2/commands", { method: "POST", body: intentBody, instance: "other" });
  assert.equal(badInst.status, 403);
  assert.equal((await badInst.json()).error, "production_instance_required");

  // Valid gate: the intent is admitted as durable state ONLY.
  const ok = await call("/v2/commands", { method: "POST", body: intentBody });
  assert.equal(ok.status, 200);
  const okBody = await ok.json();
  assert.equal(okBody.created, true);
  const planJobs = db.prepare("SELECT * FROM d6_plan_jobs WHERE plan_id = ?").all(okBody.planId);
  assert.equal(planJobs.length, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM grants WHERE job_id = ?").get(planJobs[0].job_id).n, 0,
    "halted: no grant issued for the plan job");
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM outbox").get().n, 0,
    "halted: nothing queued for dispatch (outbox empty in this world)");
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM d6_execution_records").get().n, 0,
    "halted: zero executions");

  const status = await call(`/v2/d6-plans/${okBody.planId}`);
  assert.equal(status.status, 200);
  assert.equal((await status.json()).state, "active");

  // Internal route: the class gate is intact, and execute halts 423 —
  // exactly the production behavior today.
  const noInternal = await inst.fetch(new Request("https://do.test/internal/execute", {
    method: "POST", headers: { "x-opalreader-scope": "production", "content-type": "application/json" },
    body: JSON.stringify({ grantId: "g", jobId: "j", occurrences: [] }),
  }));
  assert.equal(noInternal.status, 403);
  assert.equal((await noInternal.json()).error, "internal_only");
  const wrongScope = await inst.fetch(new Request("https://do.test/internal/execute", {
    method: "POST",
    headers: { "x-opalreader-internal": "1", "x-opalreader-scope": "staging", "content-type": "application/json" },
    body: JSON.stringify({ grantId: "g", jobId: "j", occurrences: [] }),
  }));
  assert.equal(wrongScope.status, 403);
  assert.equal((await wrongScope.json()).error, "production_scope_required");
  const haltedExec = await inst.fetch(internalReq("/internal/execute", { grantId: "g", jobId: "j", occurrences: [] }));
  assert.equal(haltedExec.status, 423);
  assert.equal((await haltedExec.json()).error, "generation_halted");

  // Queue handler: the halt fires BEFORE the namespace is touched.
  nsCalls = 0;
  await assert.rejects(
    () => d6Module.queueHandler(
      { messages: [{ body: { grantId: "g", jobId: "j", occurrences: [] }, ack() {}, retry() {} }] },
      entryEnv),
    (e) => e && e.code === "generation_halted");
  assert.equal(nsCalls, 0, "queue handler never reached the coordinator while halted");
});

// ---------------------------------------------------------------------------
// C4 — grant identity via the real routes, halt="0".
// ---------------------------------------------------------------------------

test("C4: crafted grant fails exactly as production; batch lane refused", async () => {
  const { db, state } = makeDoState();
  const inst = new D6Prod(state, doEnv({
    GENERATION_HALT: "0",
    OPALREADER_GENERATION_V2: { send: async () => {} },
  }));
  const ns = { idFromName: n => n, get: () => ({ fetch: (req) => inst.fetch(req) }) };

  // A crafted execute message with no valid grant behind it.
  const crafted = await inst.fetch(internalReq("/internal/execute",
    { grantId: "grant:crafted", jobId: "job-crafted", occurrences: ["o1"] }));
  assert.equal(crafted.status, 200);
  assert.equal((await crafted.json()).dropped, "unknown_grant");
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM d6_execution_records").get().n, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM bindings").get().n, 0);

  // The same crafted grant arriving through the real queue handler is
  // acked on the executor's drop verdict — never executed, never retried.
  let acked = 0, retried = 0;
  await d6Module.queueHandler(
    { messages: [{ body: { grantId: "grant:crafted", jobId: "job-crafted", occurrences: ["o1"] }, ack() { acked++; }, retry() { retried++; } }] },
    { GENERATION_HALT: "0", COORDINATOR: ns });
  assert.equal(acked, 1);
  assert.equal(retried, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM d6_execution_records").get().n, 0);

  // A REAL grant for a batch-lane job still cannot execute: the D6
  // executor refuses the lane before any synthesis or record.
  const coord = inst.coordinator;
  await coord.handleCommand({
    command_id: "b-sub", type: "SubmitJob",
    payload: {
      jobId: "job-batch", bookId: "book-host", chapterIndex: 0, lane: "batch",
      occurrences: [{ occurrenceId: "o9", revisionKey: "fp-o9" }], data: { estMicroCents: 1000 },
    },
  });
  const bg = await coord.requestGrant("job-batch");
  assert.equal(bg.ok, true);
  const refused = await inst.fetch(internalReq("/internal/execute",
    { grantId: bg.grantId, jobId: "job-batch", occurrences: ["o9"] }));
  assert.equal(refused.status, 200);
  assert.equal((await refused.json()).refused, "lane_not_allowed");
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM d6_execution_records").get().n, 0,
    "lane refusal happens before any execution record");
});

// ---------------------------------------------------------------------------
// C5 — alarm wake/restart + quota rollover through the real D6 entry.
// ---------------------------------------------------------------------------

test("C5: real-entry alarm restart + day-boundary rollover, zero duplicates", async () => {
  const objects = new Map();
  const h = makeHarness({ probe: makeProbe(objects) });
  const sends = [];
  // Round-5 modernization: the enforced deployment shape on the
  // class env and the entry env alike (production is one Worker
  // env; the class's intent route refuses submission when the
  // flag is not exactly "enforce").
  let inst = new D6Prod(h.state, doEnv({
    GENERATION_HALT: "0",
    OPALREADER_PHASE_POLICY: "enforce",
    OPALREADER_GENERATION_V2: { send: async (m) => { sends.push({ jobId: m.jobId, grantId: m.grantId, occurrences: [...m.occurrences] }); } },
    now: h.env.now,
  }));
  const ns = { idFromName: n => n, get: () => ({ fetch: (req) => inst.fetch(req) }) };
  const entryEnv = {
    OPALREADER_V2_SCOPE: "production", OPALREADER_ACCESS_TOKEN: TOK,
    GENERATION_HALT: "0", COORDINATOR: ns, ALLOWED_ORIGIN: ORIGIN,
    OPALREADER_PHASE_POLICY: "enforce",
  };
  const submit = (bookId, commandId) => d6Module.fetchHandler(new Request("https://w.test/v2/commands", {
    method: "POST",
    headers: {
      "x-opalreader-token": TOK, "x-opalreader-scope": "production",
      "x-opalreader-instance": "account", "content-type": "application/json",
    },
    body: JSON.stringify({
      command_id: commandId, type: "SubmitJob",
      payload: { bookId, lane: "standard", data: { d6Intent: { scope: "book", keepGoing: true, phase: "forever-pucked" } } },
    }),
  }), entryEnv);

  seedContent(h.db, "book-a", [{ chapterId: "a-0", index: 0, segments: [seg("a1"), seg("a2")] }]);
  seedContent(h.db, "book-b", [{ chapterId: "b-0", index: 0, segments: [seg("b1")] }]);
  // Round-5 modernization: the exclusive phase is bound to
  // book-a — the ONE book authorized to ride it. (Before round
  // 5 this fixture submitted BOTH books under the same phase;
  // that premise is exactly what the registry law forbids.)
  recordFixtureBinding(h.state.storage, h.db, "forever-pucked", "book-a");

  // Plan A through the real public route; the real class alarm drives it.
  const aRes = await submit("book-a", "c-a");
  assert.equal(aRes.status, 200);
  const planA = (await aRes.json()).planId;
  await inst.alarm();
  const aSends = sends.filter(s => s.occurrences.some(o => o === "a1" || o === "a2"));
  assert.equal(aSends.length, 1, "plan A dispatched exactly once");
  assert.deepEqual([...aSends[0].occurrences].sort(), ["a1", "a2"]);
  assert.notEqual(await h.state.storage.getAlarm(), null, "a durable alarm stays armed after the drive");

  // Settle A through the coordinator's own report path (probe objects).
  const jobA = h.db.prepare("SELECT job_id FROM d6_plan_jobs WHERE plan_id = ?").get(planA).job_id;
  const grantA = h.db.prepare(
    "SELECT grant_id FROM grants WHERE job_id = ? ORDER BY created_at DESC LIMIT 1").get(jobA).grant_id;
  const settling = new GenerationCoordinator(h.state, { now: h.env.now, probe: makeProbe(objects) });
  const viewA = await settling.jobView(jobA);
  const results = [];
  for (const o of viewA.occurrences) {
    const ck = `ck-${o.occurrence_id}`;
    objects.set(ck, {
      identity: o.revision_key, format: "wav", sha: `sha-${o.occurrence_id}`,
      size: 4, etag: `etag-${o.occurrence_id}`,
      bytes: new Uint8Array([1, 2, 3, 4]), durationSeconds: 1,
    });
    results.push({ occurrenceId: o.occurrence_id, revisionKey: o.revision_key, outcome: "success", cacheKey: ck, costMicroCents: 225 });
  }
  const settled = await settling.handleReport({ grantId: grantA, jobRevision: viewA.revision, results });
  assert.equal(settled.ok, true);
  const bindingsAfterA = h.db.prepare("SELECT COUNT(*) AS n FROM bindings WHERE occurrence_id IN ('a1', 'a2')").get().n;
  assert.equal(bindingsAfterA, 2);

  // Round-5 modernization: book-b may NOT consume book-a's
  // exclusive phase. Its forged claim on `forever-pucked` is
  // rejected by the registry law over the real public route and
  // creates nothing — the equivalently strong replacement for
  // the pre-policy premise that both books could share the
  // phase. Book-b's real plan below runs UNBUDGETED (phase
  // null), which the registry rules admit for a book with no
  // binding once the registry is established.
  const bForgedRes = await d6Module.fetchHandler(new Request("https://w.test/v2/commands", {
    method: "POST",
    headers: {
      "x-opalreader-token": TOK, "x-opalreader-scope": "production",
      "x-opalreader-instance": "account", "content-type": "application/json",
    },
    body: JSON.stringify({
      command_id: "c-b-forged", type: "SubmitJob",
      payload: { bookId: "book-b", lane: "standard", data: { d6Intent: { scope: "book", keepGoing: true, phase: "forever-pucked" } } },
    }),
  }), entryEnv);
  assert.equal(bForgedRes.status, 200);
  assert.deepEqual(await bForgedRes.json(), { outcome: "rejected", reason: "phase_bound_to_other_book" },
    "a second book cannot consume the phase bound to book-a");
  assert.equal(h.db.prepare("SELECT COUNT(*) AS n FROM d6_plans").get().n, 1,
    "the forged claim created no plan (only plan A exists)");

  // Plan B (unbudgeted): fill the day to exactly 100 attempts,
  // then the alarm parks it.
  const bRes = await d6Module.fetchHandler(new Request("https://w.test/v2/commands", {
    method: "POST",
    headers: {
      "x-opalreader-token": TOK, "x-opalreader-scope": "production",
      "x-opalreader-instance": "account", "content-type": "application/json",
    },
    body: JSON.stringify({
      command_id: "c-b", type: "SubmitJob",
      payload: { bookId: "book-b", lane: "standard", data: { d6Intent: { scope: "book", keepGoing: true, phase: null } } },
    }),
  }), entryEnv);
  assert.equal(bRes.status, 200);
  const planB = (await bRes.json()).planId;
  assert.ok(planB, "book-b's unbudgeted plan was admitted");
  assert.equal(h.db.prepare("SELECT phase FROM d6_plans WHERE plan_id = ?").get(planB).phase, null,
    "plan B rides no phase — it does not consume book-a's budget envelope");
  const { dayKey, monthKey } = h.coord.quotaView();
  const stmt = h.db.prepare(
    `INSERT INTO ledger_ops (op_key, at, day_key, month_key, kind, est_micro_cents, detail_json)
     VALUES (?, ?, ?, ?, 'attempt', 0, '{}')`);
  for (let i = 0; i < 100; i++) stmt.run(`fill-${i}`, h.env.now(), dayKey, monthKey);
  await inst.alarm(); // completes A (no sends), parks B (no dispatch)
  assert.equal(h.db.prepare("SELECT state FROM d6_plans WHERE plan_id = ?").get(planB).state, "parked_quota");
  assert.equal(sends.filter(s => s.occurrences.includes("b1")).length, 0, "quota-full: B never dispatched");
  assert.equal(sends.length, 1, "no duplicate dispatch for settled A");

  // Worker restart: a FRESH class instance over the same durable state.
  inst = new D6Prod(h.state, doEnv({
    GENERATION_HALT: "0",
    OPALREADER_PHASE_POLICY: "enforce",
    OPALREADER_GENERATION_V2: { send: async (m) => { sends.push({ jobId: m.jobId, grantId: m.grantId, occurrences: [...m.occurrences] }); } },
    now: h.env.now,
  }));
  const statusRes = await d6Module.fetchHandler(new Request(`https://w.test/v2/d6-plans/${planB}`, {
    headers: {
      "x-opalreader-token": TOK, "x-opalreader-scope": "production", "x-opalreader-instance": "account",
    },
  }), entryEnv);
  assert.equal(statusRes.status, 200);
  assert.equal((await statusRes.json()).state, "parked_quota",
    "the fresh instance reads the carried plan state through the real entry");

  // Day boundary: the alarm resumes B — exactly once — and never
  // re-sends or re-synthesizes a settled occurrence.
  h.advance(2 * 24 * 3600 * 1000);
  await inst.alarm();
  const bSends = sends.filter(s => s.occurrences.includes("b1"));
  assert.equal(bSends.length, 1, "B resumed with exactly one dispatch after rollover");
  assert.equal(sends.filter(s => s.occurrences.some(o => o === "a1" || o === "a2")).length, 1,
    "settled A occurrences never re-dispatched");
  assert.equal(h.db.prepare("SELECT COUNT(*) AS n FROM bindings WHERE occurrence_id IN ('a1', 'a2')").get().n, 2,
    "settled A bindings unchanged (no re-synthesis)");
  assert.equal(h.coord.quotaView().attemptsToday, 1, "the resumed grant is the day's only attempt");
  const planBRow = h.db.prepare("SELECT state FROM d6_plans WHERE plan_id = ?").get(planB);
  assert.equal(planBRow.state, "active");
});
