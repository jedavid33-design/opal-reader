// Opal Reader v2 — Finding F1 regression tests (Part 2 fix round,
// Rowan ruling 6349288135).
//
// F1: Cloudflare's SQLite DO cursor `.one()` throws on zero rows and
// on >1 row; the pre-fix harness fake returned null / the first row,
// so every coordinator fallback for "no such row" only ever ran in
// tests and a brand-new real instance 500'd at its first empty
// lookup (proven live: GET /v2/settings and the first SetSettings on
// smoke-p8 both returned 500 "Expected exactly one result from SQL
// query, but got no results.").
//
// These tests run under the CORRECTED harness (SqlFacade.one()
// emulates Cloudflare exactly) and pin the production-faithful
// behavior on brand-new empty instances — directly against the
// coordinator and through the worker entry -> DO transport, in the
// §5 smoke order for the settings/idempotency portion.
//
// REVISION (Rowan 6349834892, Proof 1): the entry tests' DO env now
// models the ACTUAL staged script's binding set. Real Cloudflare
// hands a Durable Object the script's own bindings; the first
// version of makeWorkerEnv() gave the DO only the bucket and the
// halt flag, omitting OPALREADER_V2_SCOPE and R2_KEY_PREFIX — so
// OpalReaderCoordinator._cache()'s staging namespace check compared
// an ABSENT scope against "staging-smoke", never fired, and the
// entry scenarios passed with the fail-closed R2 namespace check
// inadvertently bypassed. The DO env below is the pinned
// deploy-spec set (v2/p8/deploy-spec.json): the COORDINATOR
// namespace itself, the R2 bucket, the generation queue, and the
// four plain texts (ALLOWED_ORIGIN — the pages origin —,
// OPALREADER_V2_SCOPE, GENERATION_HALT, R2_KEY_PREFIX), plus the
// OPALREADER_ACCESS_TOKEN secret binding modeled PRESENCE-ONLY
// (a marker, never a value; nothing inside the DO reads it — the
// token gate runs in the worker fetch handler, whose env carries
// the test fixture as before).
import test from "node:test";
import assert from "node:assert/strict";
import workerEntry, { OpalReaderCoordinator } from "../v2/worker-entry.js";
import { makeHarness } from "./helpers/do-harness.mjs";

// ------------------------------------------------------------ fakes
// Mirrors tests/p8-part1-integration.test.mjs: the worker entry wired
// to the DO class over the SQLite harness, so the full transport
// (staging gate -> instance routing -> DO fetch -> API) is exercised.
// The bucket records every operation (op + key), in the manner of
// the B7 safety tests' InstrumentedBucket, so the namespace
// assertions below can prove WHICH keys the cache touched — not
// merely what it answered.
class FakeBucket {
  constructor() { this.map = new Map(); this.calls = []; }
  async get(key) {
    this.calls.push({ op: "get", key });
    const e = this.map.get(key);
    if (!e) return null;
    return { arrayBuffer: async () => e.bytes.slice().buffer, customMetadata: e.customMetadata, httpMetadata: {} };
  }
  async head(key) {
    this.calls.push({ op: "head", key });
    return this.map.has(key) ? { size: this.map.get(key).bytes.length } : null;
  }
  async put(key, bytes, opts = {}) {
    this.calls.push({ op: "put", key });
    if (opts.onlyIf?.etagDoesNotMatch === "*" && this.map.has(key)) return null;
    this.map.set(key, { bytes: new Uint8Array(bytes), customMetadata: opts.customMetadata || {} });
    return { key };
  }
  seed(key, bytes, meta = {}) { this.map.set(key, { bytes: new Uint8Array(bytes), customMetadata: meta }); }
}

function makeDoNamespace(doEnv) {
  const instances = new Map();
  return {
    idFromName: (name) => name,
    get(id) {
      if (!instances.has(id)) {
        const h = makeHarness({});
        instances.set(id, { inst: new OpalReaderCoordinator(h.state, doEnv), harness: h });
      }
      const { inst } = instances.get(id);
      return { fetch: (req) => inst.fetch(req) };
    },
    _instances: instances,
  };
}

function makeWorkerEnv(overrides = {}, doOverrides = {}) {
  const bucket = new FakeBucket();
  const queueSends = [];
  const queue = { send: async (msg) => { queueSends.push(msg); } };
  // The staged script's binding set, per the pinned deploy-spec —
  // this is the env the DO is constructed with in production.
  const doEnv = {
    OPALREADER_STORAGE: bucket,
    OPALREADER_GENERATION: queue,
    ALLOWED_ORIGIN: "https://jedavid33-design.github.io",
    OPALREADER_V2_SCOPE: "staging-smoke",
    GENERATION_HALT: "1",
    R2_KEY_PREFIX: "smoke-p8/",
    // Secret binding modeled presence-only (see the header note).
    OPALREADER_ACCESS_TOKEN: "<presence-only: harness models no secret values>",
    ...doOverrides,
  };
  const namespace = makeDoNamespace(doEnv);
  doEnv.COORDINATOR = namespace; // the script's env carries its own DO namespace binding
  const env = {
    COORDINATOR: namespace,
    OPALREADER_ACCESS_TOKEN: "staging-token",
    OPALREADER_V2_SCOPE: "staging-smoke",
    GENERATION_HALT: "1",
    ALLOWED_ORIGIN: "https://jedavid33-design.github.io",
    OPALREADER_STORAGE: bucket,
    OPALREADER_GENERATION: queue,
    R2_KEY_PREFIX: "smoke-p8/",
    ...overrides,
  };
  return { env, bucket, queueSends };
}

function req(path, { method = "GET", body } = {}) {
  return new Request("https://staging.test" + path, {
    method,
    headers: { "content-type": "application/json",
               "x-opalreader-token": "staging-token",
               "x-opalreader-scope": "staging-smoke",
               "x-opalreader-instance": "smoke-p8" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}
const call = (env, r) => workerEntry.fetch(r, env);

// ------------------------------------------------- harness contract
test("F1 harness contract: SqlFacade .one() throws on 0 and on >1 rows, returns the row on exactly 1", () => {
  const h = makeHarness({});
  const sql = h.state.storage.sql;
  h.db.exec("CREATE TABLE f1_contract (id INTEGER PRIMARY KEY, v TEXT)");
  // 0 rows -> throw, with the production message (the exact body the
  // live smoke returned).
  assert.throws(() => sql.exec("SELECT * FROM f1_contract WHERE id = 99").one(),
    /Expected exactly one result from SQL query, but got no results\./);
  // toArray() is unaffected: empty is a legitimate list answer.
  assert.deepEqual(sql.exec("SELECT * FROM f1_contract WHERE id = 99").toArray(), []);
  // Exactly 1 -> the row.
  h.db.prepare("INSERT INTO f1_contract (id, v) VALUES (1, 'a')").run();
  assert.equal(sql.exec("SELECT * FROM f1_contract WHERE id = 1").one().v, "a");
  // >1 -> throw (never the first row by silence).
  h.db.prepare("INSERT INTO f1_contract (id, v) VALUES (2, 'b')").run();
  assert.throws(() => sql.exec("SELECT * FROM f1_contract").one(),
    /Expected exactly one result from SQL query, but got multiple results\./);
});

// --------------------------------------- fresh instance, direct API
test("F1 direct: brand-new coordinator — defaults and intended not-found states, no 500-class throws", async () => {
  const h = makeHarness({});
  const c = h.coord;
  // (a) settings read before ANY write returns defaults.
  assert.deepEqual(c.settingsView(), { monthlyCap: 50, geminiLane: "batch", revision: 0 });
  // (f) missing meta.frozen is not an error: not frozen (falsy).
  assert.ok(!c._frozen());
  // (g) unknown lookups return their intended states.
  assert.equal(c.receipt("f1-no-such-command"), null);
  assert.equal(c.jobView("f1-no-such-job"), null);
  assert.equal(c.claimView("grant:f1-nope"), null);
  assert.deepEqual(c.probeVerdict("grant:f1-nope"), { verdict: "unknown" });
  assert.deepEqual(await c.handleReport({ grantId: "grant:f1-nope", results: [] }),
    { ok: false, reason: "grant_not_found" });
  assert.deepEqual(c.applyJobEvent("f1-no-such-job", "pause", "f1-test"),
    { ok: false, reason: "job_not_found" });
  assert.deepEqual(c.noteProviderRequest("grant:f1-nope", "occ-1", "req-1"),
    { ok: false, reason: "op_not_found" });
  const pos = c.positionView("f1-no-such-book");
  assert.equal(pos.canonical, null);
  assert.equal(pos.asOfReceiptSeq, 0);
  // Quota view reads settings + aggregates on an empty ledger.
  const q = c.quotaView();
  assert.equal(q.attemptsToday, 0);
  assert.equal(q.spentMicroCents, 0);
  assert.equal(q.settingsRevision, 0);
  assert.equal(q.parked, null);
});

test("F1 direct: first SetSettings applies at revision 1, replay returns the original receipt once, stale baseRevision conflicts", async () => {
  const h = makeHarness({});
  const c = h.coord;
  const cmd = { command_id: "f1-settings-1", type: "SetSettings",
                payload: { baseRevision: 0, data: { monthlyCap: 42 } } };
  // (b) first-ever command: the command-log lookup, the frozen check,
  // and the settings read are ALL empty on a fresh instance.
  const first = await c.handleCommand(cmd);
  assert.equal(first.outcome, "applied");
  assert.equal(first.revision, 1);
  // (c) replay: original receipt, single effect.
  const replay = await c.handleCommand(cmd);
  assert.equal(replay.replayed, true);
  assert.equal(replay.outcome, "applied");
  assert.equal(replay.revision, 1);
  assert.equal(h.rows("settings").length, 1);
  // (d) read-back reflects the saved data.
  assert.deepEqual(c.settingsView(), { monthlyCap: 42, geminiLane: "batch", revision: 1 });
  // (e) invalid baseRevision conflicts; nothing silently applies.
  const conflict = await c.handleCommand({ command_id: "f1-settings-2", type: "SetSettings",
    payload: { baseRevision: 0, data: { monthlyCap: 99 } } });
  assert.equal(conflict.outcome, "rejected");
  assert.equal(conflict.reason, "settings_conflict");
  assert.equal(conflict.revision, 1);
  assert.equal(c.settingsView().monthlyCap, 42);
});

test("F1 direct: cardinality discipline — _oneOrNull is null/row/throw, and strict _one still throws", () => {
  const h = makeHarness({});
  const c = h.coord;
  h.db.exec("CREATE TABLE f1_card (id INTEGER PRIMARY KEY, v TEXT)");
  // 0 rows: the optional operation answers null...
  assert.equal(c._oneOrNull("SELECT * FROM f1_card WHERE id = 7"), null);
  // ...while the strict read throws (production .one() semantics).
  assert.throws(() => c._one("SELECT * FROM f1_card WHERE id = 7"),
    /Expected exactly one result from SQL query, but got no results\./);
  // 1 row: both answer the row.
  h.db.prepare("INSERT INTO f1_card (id, v) VALUES (7, 'x')").run();
  assert.equal(c._oneOrNull("SELECT * FROM f1_card WHERE id = 7").v, "x");
  // (h) 2 rows: a cardinality misuse stays LOUD through both helpers —
  // never a silent rows[0].
  h.db.prepare("INSERT INTO f1_card (id, v) VALUES (8, 'y')").run();
  assert.throws(() => c._oneOrNull("SELECT * FROM f1_card"),
    /Expected at most one result from SQL query, but got 2\./);
  assert.throws(() => c._one("SELECT * FROM f1_card"),
    /Expected exactly one result from SQL query, but got multiple results\./);
});

// ---------------------------------- fresh instance, entry/transport
test("F1 entry: brand-new smoke instance — GET /v2/settings returns defaults with no prior write", async () => {
  const { env } = makeWorkerEnv();
  // This exact request returned 500 in the live Part 2 smoke.
  const res = await call(env, req("/v2/settings"));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { monthlyCap: 50, geminiLane: "batch", revision: 0 });
  // Unknown command receipt / unknown book position: intended 404 /
  // empty-canonical answers through the read-only facade, not 500s.
  const noCmd = await call(env, req("/v2/commands/f1-no-such-command"));
  assert.equal(noCmd.status, 404);
  assert.equal((await noCmd.json()).error, "command_not_found");
  const noJob = await call(env, req("/v2/jobs/f1-no-such-job"));
  assert.equal(noJob.status, 404);
  assert.equal((await noJob.json()).error, "job_not_found");
  const noPos = await call(env, req("/v2/sync/position/f1-no-such-book"));
  assert.equal(noPos.status, 200);
  assert.equal((await noPos.json()).canonical, null);
  // Settings family snapshot on a fresh instance: readable, empty.
  const snap = await call(env, req("/v2/sync/snapshot?family=settings"));
  assert.equal(snap.status, 200);
  assert.deepEqual((await snap.json()).entities, []);
});

test("F1 entry: §5 smoke order — SetSettings round-trip, replay-once, read-back, conflict (worker entry -> DO)", async () => {
  const { env } = makeWorkerEnv();
  const cmd = { command_id: "f1-smoke-settings-1", type: "SetSettings",
                payload: { baseRevision: 0, data: { monthlyCap: 42 } } };
  // First command ever on this instance (500'd live before the fix).
  const first = await call(env, req("/v2/commands", { method: "POST", body: cmd }));
  assert.equal(first.status, 200);
  const firstBody = await first.json();
  assert.equal(firstBody.outcome, "applied");
  assert.equal(firstBody.revision, 1);
  // Replay: original receipt, replayed flag, single effect.
  const replay = await call(env, req("/v2/commands", { method: "POST", body: cmd }));
  assert.equal(replay.status, 200);
  const replayBody = await replay.json();
  assert.equal(replayBody.replayed, true);
  assert.equal(replayBody.outcome, "applied");
  assert.equal(replayBody.revision, 1);
  const snap = await call(env, req("/v2/sync/snapshot?family=settings"));
  assert.equal((await snap.json()).entities.length, 1);
  // Read-back through the settings view reflects the saved data.
  const read = await call(env, req("/v2/settings"));
  assert.equal(read.status, 200);
  assert.deepEqual(await read.json(), { monthlyCap: 42, geminiLane: "batch", revision: 1 });
  // Stale baseRevision conflicts and changes nothing.
  const conflict = await call(env, req("/v2/commands", { method: "POST", body: {
    command_id: "f1-smoke-settings-2", type: "SetSettings",
    payload: { baseRevision: 0, data: { monthlyCap: 99 } } } }));
  assert.equal(conflict.status, 200);
  const conflictBody = await conflict.json();
  assert.equal(conflictBody.outcome, "rejected");
  assert.equal(conflictBody.reason, "settings_conflict");
  const after = await call(env, req("/v2/settings"));
  assert.equal((await after.json()).monthlyCap, 42);
});

test("F1 entry: missing meta.frozen is not a 500 — commands flow, and a freeze then rejects new work as designed", async () => {
  const { env } = makeWorkerEnv();
  // No FreezeDirective has ever run on this instance: the meta table
  // has no 'frozen' row. A command must still be processed.
  const set = await call(env, req("/v2/commands", { method: "POST", body: {
    command_id: "f1-freeze-0", type: "SetSettings",
    payload: { baseRevision: 0, data: { monthlyCap: 50 } } } }));
  assert.equal(set.status, 200);
  assert.equal((await set.json()).outcome, "applied");
  // Now freeze, and confirm the frozen rejection (not an error).
  const freeze = await call(env, req("/v2/commands", { method: "POST", body: {
    command_id: "f1-freeze-1", type: "FreezeDirective", payload: { freeze: true } } }));
  assert.equal(freeze.status, 200);
  assert.equal((await freeze.json()).outcome, "applied");
  const blocked = await call(env, req("/v2/commands", { method: "POST", body: {
    command_id: "f1-freeze-2", type: "SubmitJob",
    payload: { jobId: "f1-job", occurrences: [{ occurrenceId: "o1", revisionKey: "r1" }] } } }));
  assert.equal(blocked.status, 200);
  const blockedBody = await blocked.json();
  assert.equal(blockedBody.outcome, "rejected");
  assert.equal(blockedBody.reason, "frozen");
  // Reads still work while frozen.
  const read = await call(env, req("/v2/settings"));
  assert.equal(read.status, 200);
});

// --------------------------- revised DO env (Rowan 6349834892, Proof 1)
// The two tests above this block now run under the corrected env by
// construction (makeWorkerEnv). These two pin WHY the correction
// matters: with the staged binding set present in the DO env, the
// staging R2 namespace check is satisfied by the real prefix — and
// it is genuinely LIVE, so the same env shape with a wrong or absent
// prefix fails closed instead of passing silently as it did before.
test("F1 entry (revised env): smoke prefix respected — byte-check sees the smoke object, never the production twin", async () => {
  const { env, bucket, queueSends } = makeWorkerEnv();
  const smokeKey = "a".repeat(64);
  const prodKey = "b".repeat(64);
  bucket.seed(`smoke-p8/audio/${smokeKey}.mp3`, new Uint8Array([1, 2, 3]));
  bucket.seed(`audio/${prodKey}.mp3`, new Uint8Array([4, 5, 6])); // production twin: must stay invisible
  // The F1 settings scenario still runs clean on this instance.
  const settings = await call(env, req("/v2/settings"));
  assert.equal(settings.status, 200);
  // Byte-check trio through the entry (the §5 smoke step-7 shape).
  const hit = await call(env, req(`/v2/sync/byte-check/${smokeKey}`));
  assert.equal(hit.status, 200);
  assert.deepEqual(await hit.json(), { cacheKey: smokeKey, exists: true });
  const miss = await call(env, req(`/v2/sync/byte-check/${prodKey}`));
  assert.equal(miss.status, 200);
  assert.deepEqual(await miss.json(), { cacheKey: prodKey, exists: false });
  const malformed = await call(env, req("/v2/sync/byte-check/not-a-key"));
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).error, "invalid_cache_key");
  // Every bucket operation the whole sequence performed stayed
  // inside the smoke namespace — and the bucket really was consulted
  // (a pass with zero R2 contact would prove nothing).
  assert.ok(bucket.calls.length > 0, "the corrected env really did consult R2");
  for (const c of bucket.calls)
    assert.ok(c.key.startsWith("smoke-p8/"), `bucket ${c.op} escaped the smoke namespace: ${c.key}`);
  // The queue binding is present in both envs now, as staged — and
  // with GENERATION_HALT=1 it still delivers nothing.
  assert.deepEqual(queueSends, []);
});

test("F1 entry (revised env): the namespace guard is LIVE — wrong or absent DO prefix fails closed, zero bucket operations", async () => {
  for (const bad of ["audio/", "", undefined]) {
    const { env, bucket } = makeWorkerEnv({}, { R2_KEY_PREFIX: bad });
    const res = await call(env, req("/v2/settings"));
    assert.equal(res.status, 500, `prefix ${JSON.stringify(bad)} must fail the request closed`);
    assert.match((await res.json()).error, /R2_KEY_PREFIX/,
      "the failure is the named staging namespace error, not a generic 500");
    assert.deepEqual(bucket.calls, [], `zero bucket operations for prefix ${JSON.stringify(bad)}`);
  }
});
