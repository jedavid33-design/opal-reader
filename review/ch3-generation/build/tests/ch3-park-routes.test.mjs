// Ch 3 mechanisms — the four operator routes end to end through
// the REAL production entry + coordinator class
// (worker-entry-prod-d6.js), modeled on
// tests/quota-operator-routes.test.mjs.
//
// Fence class (proposal §5A/§5B + Rowan's DESIGN PASS conditions):
// operator-alone — the public gate skips the client token for
// these paths, the entry's admission block requires the dedicated
// migration-operator credential, and the coordinator class gate
// re-checks the unforgeable operator-admitted stamp. No halt
// fence: the release/exemption are execution-time fence
// adjustments (gate (c) has re-armed the system); the acts create
// no plan, job, or grant. Both halt states are exercised below.
//
// The seeded world is the live-shaped Chapter 3 fixture (real
// pinned aggregate; jobs/occurrences rows exactly as
// _migrateImportJobs left them; synthetic content entity with idx
// 0–2 bound) — the same fixture as tests/ch3-park-release.test.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import D6Entry, {
  OpalReaderCoordinatorProd as D6Prod,
} from "../worker/worker-entry-prod-d6.js";
import { GenerationCoordinator } from "../worker/coordinator.mjs";
import { createGenStore } from "../worker/generation/genstore.mjs";
import { APPROVED_FREEZE_CARRY } from "../worker/p8/approved-freeze-carry.mjs";
import { FP_BOOK_ID, PARKED_JOB_ID } from "./helpers/d6-census-fixture.mjs";

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

const CLIENT_TOKEN = "ch3routes-fixture-client-token";
const OPERATOR_TOKEN = "ch3routes-fixture-operator-token";

const BOOK = FP_BOOK_ID;
const JOB = PARKED_JOB_ID;
const AGG = APPROVED_FREEZE_CARRY.books[BOOK].jobs.aggregates
  .find(a => a.jobId === JOB);
const IDS = AGG.occurrences.map(o => o.occurrenceId);
const IDX26 = IDS[26];
const RELEASE_SET = IDS.slice(3, 26);

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort()
    .map(k => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(",")}}`;
}

function ch3World({ halt = "0", operatorToken = OPERATOR_TOKEN,
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
  createGenStore(seedCoord).ensureSchema();
  const run = (sql, ...params) => db.prepare(sql).run(...params);
  const now = 1761000000000;
  run(`INSERT INTO jobs (job_id, kind, book_id, chapter_index, lane,
         state, revision, data_json, created_at, updated_at)
       VALUES (?, 'job', ?, 2, 'standard', 'parked_policy', 1, ?, ?, ?)`,
    JOB, BOOK, canonicalJson(AGG.definition), now, now);
  for (const o of AGG.occurrences)
    run(`INSERT INTO occurrences (job_id, occurrence_id, revision_key, state)
         VALUES (?, ?, ?, ?)`, JOB, o.occurrenceId, o.revisionKey, o.state);
  const segs = IDS.map((id, i) => ({
    occurrenceId: id, text: `synthetic segment ${i} ` + "x".repeat(600),
    pov: "Narrator",
  }));
  const data = {
    chapters: [{ chapterId: "ch-2", index: 2, segments: segs }],
    povs: [{
      id: "pov-narrator", name: "Narrator",
      voice: { provider: "gemini", voice_id: "Zephyr", model_id: "gemini-3.8-flash-tts" },
    }],
    defaultVoice: { provider: "gemini", voice_id: "Zephyr" },
  };
  run(`INSERT INTO sync_entities (family, entity_key, book_id, revision, deleted, data_json)
       VALUES ('content', ?, ?, 1, 0, ?)`, BOOK, BOOK, JSON.stringify(data));
  for (let i = 0; i < 3; i++)
    run(`INSERT INTO bindings (occurrence_id, revision_key, cache_key, provenance, bound_at)
         VALUES (?, ?, ?, 'migration', 1)`, IDS[i], AGG.occurrences[i].revisionKey, "f".repeat(64));
  return { db, inst, entryEnv, classEnv, queue };
}

const tableExists = (w, name) => !!w.db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(name);
const rowCount = (w, name) => tableExists(w, name)
  ? w.db.prepare(`SELECT COUNT(*) AS n FROM ${name}`).get().n : 0;
function snapshot(w) {
  return JSON.stringify({
    jobs: w.db.prepare("SELECT * FROM jobs ORDER BY job_id").all(),
    occurrences: w.db.prepare("SELECT * FROM occurrences ORDER BY occurrence_id").all(),
    releases: tableExists(w, "d6_park_releases")
      ? w.db.prepare("SELECT * FROM d6_park_releases ORDER BY release_id").all() : null,
    exemptions: tableExists(w, "d6_chapter_exemptions")
      ? w.db.prepare("SELECT * FROM d6_chapter_exemptions ORDER BY occurrence_id").all() : null,
  });
}

const RELEASE_PATH = "/v2/d6-release-park";
const REVOKE_RELEASE_PATH = "/v2/d6-revoke-park-release";
const EXEMPT_PATH = "/v2/d6-exempt-chapter-occurrence";
const REVOKE_EXEMPT_PATH = "/v2/d6-revoke-chapter-exemption";
const AUTH = { authorizationRef: "board:ch3-routes-go", source: "test" };

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

// ------------------------------------------------------------------

test("CH3R-1: happy path through the entry — release, exemption, both revokes; read-backs ride the responses", async () => {
  const w = ch3World();
  const rel = await asOperator(w, RELEASE_PATH,
    { body: { jobId: JOB, occurrenceIds: RELEASE_SET, ...AUTH } });
  assert.equal(rel.status, 200, JSON.stringify(rel.body));
  assert.equal(rel.body.outcome, "applied");
  assert.equal(rel.body.alreadyReleased, false);
  assert.deepEqual(rel.body.release.occurrenceIds, RELEASE_SET);
  assert.equal(rel.body.release.state, "live");
  assert.equal(rowCount(w, "d6_park_releases"), 1);

  const ex = await asOperator(w, EXEMPT_PATH,
    { body: { jobId: JOB, occurrenceId: IDX26, ...AUTH } });
  assert.equal(ex.status, 200, JSON.stringify(ex.body));
  assert.equal(ex.body.outcome, "applied");
  assert.equal(ex.body.exemption.occurrenceId, IDX26);
  assert.equal(ex.body.exemption.tombstoned, false);
  assert.equal(rowCount(w, "d6_chapter_exemptions"), 1);

  const unRel = await asOperator(w, REVOKE_RELEASE_PATH,
    { body: { jobId: JOB, ...AUTH } });
  assert.equal(unRel.body.outcome, "applied");
  assert.equal(unRel.body.release.state, "tombstoned");
  const unEx = await asOperator(w, REVOKE_EXEMPT_PATH,
    { body: { jobId: JOB, occurrenceId: IDX26, ...AUTH } });
  assert.equal(unEx.body.outcome, "applied");
  assert.equal(unEx.body.exemption.tombstoned, true);
  // Audit rows survive their tombstones.
  assert.equal(rowCount(w, "d6_park_releases"), 1);
  assert.equal(rowCount(w, "d6_chapter_exemptions"), 1);
  // The parked job was never touched.
  const job = w.db.prepare("SELECT * FROM jobs WHERE job_id = ?").get(JOB);
  assert.equal(job.state, "parked_policy");
  assert.equal(job.revision, 1);
});

test("CH3R-2: no halt fence — the release applies in BOTH halt states (execution-time fence adjustment)", async () => {
  for (const halt of ["0", "1"]) {
    const w = ch3World({ halt });
    const rel = await asOperator(w, RELEASE_PATH,
      { body: { jobId: JOB, occurrenceIds: RELEASE_SET, ...AUTH } });
    assert.equal(rel.status, 200, `halt=${halt}`);
    assert.equal(rel.body.outcome, "applied", `halt=${halt}`);
  }
});

test("CH3R-3: the operator fence — no credential, client token alone, and operator-not-configured all refuse", async () => {
  const w = ch3World();
  const before = snapshot(w);
  const noCred = await call(w, RELEASE_PATH,
    { body: { jobId: JOB, occurrenceIds: RELEASE_SET, ...AUTH } });
  assert.equal(noCred.status, 403);
  assert.equal(noCred.body.error, "migration_operator_required");
  const clientOnly = await call(w, RELEASE_PATH,
    { access: CLIENT_TOKEN, body: { jobId: JOB, occurrenceIds: RELEASE_SET, ...AUTH } });
  assert.equal(clientOnly.status, 403,
    "the everyday client token alone never reaches the Ch 3 routes");
  assert.equal(clientOnly.body.error, "migration_operator_required");
  for (const path of [REVOKE_RELEASE_PATH, EXEMPT_PATH, REVOKE_EXEMPT_PATH]) {
    const r = await call(w, path, { body: { jobId: JOB, occurrenceId: IDX26, ...AUTH } });
    assert.equal(r.status, 403, path);
    assert.equal(r.body.error, "migration_operator_required", path);
  }
  assert.equal(snapshot(w), before, "refusals moved no state");
  assert.equal(tableExists(w, "d6_park_releases"), false,
    "not even the lazy schema bootstrap ran");

  const unconfigured = ch3World({ operatorToken: null });
  const r503 = await asOperator(unconfigured, RELEASE_PATH,
    { body: { jobId: JOB, occurrenceIds: RELEASE_SET, ...AUTH } });
  assert.equal(r503.status, 503);
  assert.equal(r503.body.error, "migration_operator_not_configured");
});

test("CH3R-4: wrong production scope / instance refuse at the entry gate", async () => {
  const w = ch3World();
  const badScope = await asOperator(w, RELEASE_PATH,
    { body: { jobId: JOB, occurrenceIds: RELEASE_SET, ...AUTH }, scope: "staging" });
  assert.equal(badScope.status, 403);
  assert.equal(badScope.body.error, "production_scope_required");
  const badInstance = await asOperator(w, RELEASE_PATH,
    { body: { jobId: JOB, occurrenceIds: RELEASE_SET, ...AUTH }, instance: "someone-else" });
  assert.equal(badInstance.status, 403);
  assert.equal(badInstance.body.error, "production_instance_required");
  assert.equal(tableExists(w, "d6_park_releases"), false);
});

test("CH3R-5: a spoofed operator-admitted stamp never admits — public forgery and direct class calls both refuse", async () => {
  const w = ch3World();
  const before = snapshot(w);
  const forged = await call(w, RELEASE_PATH, {
    body: { jobId: JOB, occurrenceIds: RELEASE_SET, ...AUTH },
    headers: { "x-opalreader-operator-admitted": "1" },
  });
  assert.equal(forged.status, 403);
  assert.equal(forged.body.error, "migration_operator_required");
  for (const path of [
    "/internal/d6/release-park", "/internal/d6/revoke-park-release",
    "/internal/d6/exempt-chapter-occurrence", "/internal/d6/revoke-chapter-exemption",
  ]) {
    const res = await w.inst.fetch(new Request(`https://do.internal${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-opalreader-internal": "1",
        "x-opalreader-scope": "production",
      },
      body: "{}",
    }));
    assert.equal(res.status, 403, path);
    assert.equal((await res.json()).error, "migration_operator_required", path);
  }
  const noInternal = await w.inst.fetch(new Request(
    "https://do.internal/internal/d6/release-park", {
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
  const classScope = await w.inst.fetch(new Request(
    "https://do.internal/internal/d6/release-park", {
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
  assert.equal(snapshot(w), before, "no spoof moved any state");
});

test("CH3R-6: closed-allowlist / default-deny matrix at the entry — every malformed shape refuses with zero writes", async () => {
  const w = ch3World();
  const cases = [
    // [path, body, expected reason]
    [RELEASE_PATH, { jobId: JOB, occurrenceIds: RELEASE_SET, ...AUTH, costMicroCents: 5 },
      "park_release_request_key_not_allowed"],
    [RELEASE_PATH, { jobId: JOB, occurrenceIds: RELEASE_SET },
      "authorization_ref_required"],
    [RELEASE_PATH, { occurrenceIds: RELEASE_SET, ...AUTH },
      "park_release_job_required"],
    [RELEASE_PATH, { jobId: JOB, occurrenceIds: "nope", ...AUTH },
      "park_release_set_invalid"],
    [RELEASE_PATH, { jobId: JOB, occurrenceIds: RELEASE_SET, ...AUTH, note: "x".repeat(2001) },
      "note_invalid"],
    [RELEASE_PATH, { jobId: JOB, occurrenceIds: RELEASE_SET, ...AUTH, source: 42 },
      "source_invalid"],
    // A null/unparseable body is coerced to {} by the public
    // forward (the house shape for every operator route), so the
    // DO answers the first required-field refusal.
    [RELEASE_PATH, null, "park_release_job_required"],
    [RELEASE_PATH, [1, 2], "park_release_request_key_not_allowed"],
    [REVOKE_RELEASE_PATH, { jobId: JOB, ...AUTH, occurrenceId: IDX26 },
      "park_release_request_key_not_allowed"],
    [EXEMPT_PATH, { jobId: JOB, occurrenceId: IDX26, ...AUTH, occurrenceIds: [IDX26] },
      "chapter_exemption_request_key_not_allowed"],
    [EXEMPT_PATH, { jobId: JOB, ...AUTH },
      "chapter_exemption_occurrence_required"],
    [EXEMPT_PATH, { occurrenceId: IDX26, ...AUTH },
      "chapter_exemption_job_required"],
    [REVOKE_EXEMPT_PATH, { jobId: JOB, occurrenceId: IDX26 },
      "authorization_ref_required"],
  ];
  for (const [path, body, reason] of cases) {
    const r = await asOperator(w, path, { body });
    assert.equal(r.status, 200, `${path} ${reason}`);
    assert.equal(r.body?.outcome, "rejected", `${path} ${reason}`);
    assert.equal(r.body?.reason, reason, `${path}`);
  }
  assert.equal(rowCount(w, "d6_park_releases"), 0);
  assert.equal(rowCount(w, "d6_chapter_exemptions"), 0);
});

test("CH3R-7: store refusals surface through the entry as named rejections (never faults)", async () => {
  const w = ch3World();
  const idx26 = await asOperator(w, RELEASE_PATH,
    { body: { jobId: JOB, occurrenceIds: [IDX26], ...AUTH } });
  assert.equal(idx26.status, 200);
  assert.equal(idx26.body.outcome, "rejected");
  assert.equal(idx26.body.reason, "park_release_outside_definition");
  assert.equal(idx26.body.occurrenceId, IDX26);
  const member = await asOperator(w, EXEMPT_PATH,
    { body: { jobId: JOB, occurrenceId: IDS[10], ...AUTH } });
  assert.equal(member.body.outcome, "rejected");
  assert.equal(member.body.reason, "chapter_exemption_inside_definition");
  const noJob = await asOperator(w, RELEASE_PATH,
    { body: { jobId: "no-such-job", occurrenceIds: [IDS[3]], ...AUTH } });
  assert.equal(noJob.body.reason, "park_release_job_not_found");
  const noRelease = await asOperator(w, REVOKE_RELEASE_PATH,
    { body: { jobId: JOB, ...AUTH } });
  assert.equal(noRelease.body.reason, "park_release_not_found");
  assert.equal(rowCount(w, "d6_park_releases"), 0);
  assert.equal(rowCount(w, "d6_chapter_exemptions"), 0);
});

test("CH3R-8: idempotency through the entry — duplicate release/exemption calls are no-op successes; conflicts refuse", async () => {
  const w = ch3World();
  const body = { jobId: JOB, occurrenceIds: RELEASE_SET, ...AUTH };
  const first = await asOperator(w, RELEASE_PATH, { body });
  assert.equal(first.body.alreadyReleased, false);
  const dup = await asOperator(w, RELEASE_PATH, { body });
  assert.equal(dup.body.outcome, "applied");
  assert.equal(dup.body.alreadyReleased, true);
  assert.equal(rowCount(w, "d6_park_releases"), 1);
  const conflict = await asOperator(w, RELEASE_PATH,
    { body: { jobId: JOB, occurrenceIds: RELEASE_SET.slice(1), ...AUTH } });
  assert.equal(conflict.body.outcome, "rejected");
  assert.equal(conflict.body.reason, "park_release_conflict");

  const exBody = { jobId: JOB, occurrenceId: IDX26, ...AUTH };
  const exFirst = await asOperator(w, EXEMPT_PATH, { body: exBody });
  assert.equal(exFirst.body.alreadyExempted, false);
  const exDup = await asOperator(w, EXEMPT_PATH, { body: exBody });
  assert.equal(exDup.body.outcome, "applied");
  assert.equal(exDup.body.alreadyExempted, true);
  assert.equal(rowCount(w, "d6_chapter_exemptions"), 1);
});

test("CH3R-9: method mismatch never applies anything", async () => {
  const w = ch3World();
  const before = snapshot(w);
  const get = await asOperator(w, RELEASE_PATH, { method: "GET" });
  assert.equal(get.status, 401,
    "GET on a POST operator surface is not an operator route at all");
  assert.equal(snapshot(w), before);
  assert.equal(tableExists(w, "d6_park_releases"), false);
});
