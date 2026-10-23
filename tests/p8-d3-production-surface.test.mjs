// Opal Reader v2 — P8 D3 Part A: the production worker surface
// (cutover plan §S4 as corrected — the P1 topology fix).
//
// Cross-worker synthetic integration proofs through BOTH real
// worker entries: the production surface (v2/worker-entry-prod.js,
// script opalreader-api-v2-prod) owns its coordinator class
// (OpalReaderCoordinatorProd) and its own DO state; the staging
// surface (v2/worker-entry.js) is unchanged and still smoke-fenced.
// The fences are disjoint in both directions, production reads the
// unprefixed R2 namespace and refuses any configured prefix, the
// operator fence guards migration commands on both surfaces, and
// no state is shared. All tokens below are obvious synthetic test
// fakes; all data is synthetic.
import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import stagingEntry, { OpalReaderCoordinator } from "../v2/worker-entry.js";
import prodEntry, {
  OpalReaderCoordinatorProd, ProductionR2NamespaceError,
  PRODUCTION_SCOPE, PRODUCTION_INSTANCE,
} from "../v2/worker-entry-prod.js";
import {
  chunkCmd, pinnedChunksEntry, pinnedEntry, sha256Hex, v1Meta,
} from "./helpers/migration-fixtures.mjs";

const CLIENT = "client-token-synthetic";
const OPERATOR = "operator-token-synthetic";
const PROD_CLIENT = "prod-client-token-synthetic";
const PROD_OPERATOR = "prod-operator-token-synthetic";
const ORIGIN = "https://jedavid33-design.github.io";
const MIG = "mig-d3-surface";
const FREEZE = "freeze-digest-synthetic";
const SMALL = { maxRowsPerChunk: 2, maxChunkBytes: 64 * 1024 * 1024, maxItemBytes: 16 * 1024 * 1024 };

// Production-faithful DO SQL facade (the F1 discipline: .one()
// throws unless exactly one row).
class SqlCursor {
  constructor(rows) { this.rows = rows ?? []; }
  toArray() { return this.rows; }
  one() {
    if (this.rows.length === 0) throw new Error("Expected exactly one result from SQL query, but got no results.");
    if (this.rows.length > 1) throw new Error("Expected exactly one result from SQL query, but got multiple results.");
    return this.rows[0];
  }
}
class SqlFacade {
  constructor(db) { this.db = db; }
  exec(query, ...params) {
    if (params.length === 0 && query.includes(";")) { this.db.exec(query); return new SqlCursor([]); }
    const stmt = this.db.prepare(query);
    const isQuery = /^\s*(SELECT|WITH)\b/i.test(query);
    return new SqlCursor(isQuery ? stmt.all(...params) : (stmt.run(...params), null));
  }
}
function makeDoState() {
  const db = new DatabaseSync(":memory:");
  const storage = {
    sql: new SqlFacade(db),
    transactionSync(fn) {
      db.exec("BEGIN IMMEDIATE");
      try { const r = fn(); db.exec("COMMIT"); return r; }
      catch (e) { try { db.exec("ROLLBACK"); } catch {} throw e; }
    },
    async setAlarm() {}, async getAlarm() { return null; }, async deleteAlarm() {},
  };
  return { storage, blockConcurrencyWhile: async (fn) => { await fn(); } };
}

class CountingBucket {
  constructor() { this.map = new Map(); this.gets = []; this.putCalls = []; }
  seed(key, bytes, customMetadata = {}) {
    this.map.set(key, { bytes: new Uint8Array(bytes), customMetadata });
  }
  async get(key) {
    const e = this.map.get(key);
    this.gets.push({ key, bytes: e ? e.bytes.byteLength : 0 });
    if (!e) return null;
    return { arrayBuffer: async () => e.bytes.slice().buffer,
             customMetadata: e.customMetadata, httpMetadata: {},
             etag: `"etag:${key}"`, size: e.bytes.byteLength };
  }
  async put(key) { this.putCalls.push(key); }
  resetGets() { this.gets = []; }
  get totalBytes() { return this.gets.reduce((n, g) => n + g.bytes, 0); }
}

// One surface world: a worker entry + its OWN DO class instance
// over its OWN SQLite state and its OWN bucket.
function makeSurface({ entry, CoordinatorClass, scope, instance, prefix,
                       clientToken, operatorToken }) {
  const bucket = new CountingBucket();
  const state = makeDoState();
  const manifest = { snapshotDigest: FREEZE, books: {} };
  const chunksManifest = { snapshotDigest: FREEZE, books: {} };
  const doEnv = {
    OPALREADER_V2_SCOPE: scope, OPALREADER_ACCESS_TOKEN: clientToken,
    GENERATION_HALT: "1", OPALREADER_STORAGE: bucket, ALLOWED_ORIGIN: ORIGIN,
    approvedFreezeManifest: manifest, approvedFreezeChunks: chunksManifest,
  };
  if (prefix !== null && prefix !== undefined) doEnv.R2_KEY_PREFIX = prefix;
  const instanceObj = new CoordinatorClass(state, doEnv);
  const namespace = { idFromName: (n) => n, get: () => ({ fetch: (req) => instanceObj.fetch(req) }) };
  const env = {
    OPALREADER_ACCESS_TOKEN: clientToken, OPALREADER_V2_SCOPE: scope,
    COORDINATOR: namespace, ALLOWED_ORIGIN: ORIGIN,
  };
  if (operatorToken) env.OPALREADER_MIGRATION_OPERATOR_TOKEN = operatorToken;
  const call = (path, { method = "GET", body, operator, token = clientToken,
                         scopeHeader = scope, instanceHeader = instance, headers = {} } = {}) =>
    entry.fetch(new Request(`https://surface.test${path}`, {
      method,
      headers: { "x-opalreader-token": token, "x-opalreader-scope": scopeHeader,
        "x-opalreader-instance": instanceHeader, Origin: ORIGIN,
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(operator !== undefined ? { "x-opalreader-operator-token": operator } : {}),
        ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }), env);
  const commandCount = () =>
    state.storage.sql.exec(`SELECT command_id FROM commands`).toArray().length;
  // Option D two-phase send: submit under the client credential
  // (pends), approve the server-returned hash under the surface's
  // operator credential; returns the final receipt.
  const sendMigration = async (cmd, operator = operatorToken) => {
    const sub = await call("/v2/commands", { method: "POST", body: cmd });
    const pending = await sub.json();
    assert.equal(pending.state, "pending_operator", JSON.stringify(pending));
    const app = await call("/v2/command-approvals", { method: "POST", operator,
      body: { commandId: cmd.command_id, payloadSha256: pending.payloadSha256 } });
    return app.json();
  };
  return { bucket, state, instance: instanceObj, env, call, commandCount,
           sendMigration, manifest, chunksManifest };
}
const makeStaging = (over = {}) => makeSurface({
  entry: stagingEntry, CoordinatorClass: OpalReaderCoordinator,
  scope: "staging-smoke", instance: "smoke-p8", prefix: "smoke-p8/",
  clientToken: CLIENT, operatorToken: OPERATOR, ...over });
const makeProd = (over = {}) => makeSurface({
  entry: prodEntry, CoordinatorClass: OpalReaderCoordinatorProd,
  scope: PRODUCTION_SCOPE, instance: PRODUCTION_INSTANCE, prefix: null,
  clientToken: PROD_CLIENT, operatorToken: PROD_OPERATOR, ...over });

// Seed a small book on a surface at the surface's key prefix and
// pin it (whole-book + chunk pins).
function seedSurfaceBook(surface, prefix, bookId, sizes) {
  const pairs = [], rows = [], contentIds = [];
  sizes.forEach((size, i) => {
    const occurrenceId = `${bookId}-o${i + 1}`;
    const bytes = new Uint8Array(size).fill(65 + i);
    const sha = sha256Hex(bytes);
    const objectKey = `${prefix}audio/${sha}.mp3`;
    surface.bucket.seed(objectKey, bytes, v1Meta("mp3"));
    const row = { occurrenceId, revisionKey: sha, cacheKey: sha,
      manifest: { sha256: sha, size, format: "mp3" } };
    rows.push(row); contentIds.push(occurrenceId);
    pairs.push({ row, etag: `"etag:${objectKey}"` });
  });
  surface.manifest.books[bookId] = pinnedEntry(pairs);
  surface.chunksManifest.books[bookId] = pinnedChunksEntry(pairs, SMALL);
  const chunks = [];
  for (let s = 0; s < rows.length; s += SMALL.maxRowsPerChunk)
    chunks.push(rows.slice(s, s + SMALL.maxRowsPerChunk));
  return { rows, chunks, content: { title: bookId, occurrenceIds: contentIds } };
}
const chunkBody = (book, bookId, i, id) => chunkCmd(id, {
  migrationId: MIG, freezeDigest: FREEZE, bookId, chunkIndex: i,
  content: i === 0 ? book.content : undefined, rows: book.chunks[i] });

// ============================================================ topology
test("prod surface serves its OWN coordinator: health names the production scope, settings round-trip on the account instance, staging state untouched", async () => {
  const prod = makeProd();
  const staging = makeStaging();
  const health = await prod.call("/health");
  assert.equal(health.status, 200);
  const hb = await health.json();
  assert.equal(hb.scope, "production");
  assert.equal(hb.generation, "halted");
  assert.equal(hb.coordinator, "armed");

  const set = await prod.call("/v2/commands", { method: "POST", body: {
    command_id: "prod-settings-1", type: "SetSettings",
    payload: { data: { monthlyCap: 42 } } } });
  assert.equal(set.status, 200);
  const got = await (await prod.call("/v2/settings")).json();
  assert.equal(got.monthlyCap, 42);
  // The staging surface's own coordinator never saw the command.
  const stagingSettings = await (await staging.call("/v2/settings")).json();
  assert.notEqual(stagingSettings.monthlyCap, 42);
  assert.equal(staging.commandCount(), 0);
  assert.equal(prod.commandCount(), 1);
});

test("the fences are disjoint in both directions: staging-shaped requests die on prod, production-shaped requests die on staging", async () => {
  const prod = makeProd();
  const staging = makeStaging();
  // A fully staging-shaped request (staging scope, smoke instance,
  // staging token) to the PRODUCTION entry.
  let res = await prod.call("/v2/settings", {
    token: CLIENT, scopeHeader: "staging-smoke", instanceHeader: "smoke-p8" });
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error, "production_scope_required");
  // A fully production-shaped request to the STAGING entry.
  res = await staging.call("/v2/settings", {
    token: PROD_CLIENT, scopeHeader: "production", instanceHeader: "account" });
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error, "staging_scope_required");
  // Right scope, wrong instance, each way.
  res = await prod.call("/v2/settings", { instanceHeader: "smoke-p8" });
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error, "production_instance_required");
  res = await staging.call("/v2/settings", { instanceHeader: "account" });
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error, "staging_instance_required");
  // The prod binary refuses to serve even when its env is
  // (mis)configured with the staging scope: fail closed, never a
  // staging surface in production clothing.
  res = await prod.call("/v2/settings", { scopeHeader: "production" });
  assert.equal(res.status, 200); // control: the correct shape works
  const prodEnvStaging = makeProd();
  prodEnvStaging.env.OPALREADER_V2_SCOPE = "staging-smoke";
  res = await prodEntry.fetch(new Request("https://surface.test/v2/settings", {
    headers: { "x-opalreader-token": PROD_CLIENT, "x-opalreader-scope": "staging-smoke",
      "x-opalreader-instance": "account", Origin: ORIGIN } }), prodEnvStaging.env);
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error, "production_scope_required");
  // Neither refusal reached a coordinator.
  assert.equal(prod.commandCount(), 0);
  assert.equal(staging.commandCount(), 0);
});

test("prod DO class enforces the production scope on direct internal calls", async () => {
  const prod = makeProd();
  const direct = (scopeHeader) => prod.instance.fetch(new Request("https://do.test/v2/settings", {
    method: "GET",
    headers: { "x-opalreader-internal": "1", "x-opalreader-scope": scopeHeader },
  }));
  assert.equal((await direct("staging-smoke")).status, 403);
  assert.equal((await (await direct("staging-smoke")).json()).error, "production_scope_required");
  assert.equal((await direct("production")).status, 200);
  // The executor path stays halted on the production surface too.
  const exec = await prod.instance.fetch(new Request("https://do.test/internal/execute", {
    method: "POST",
    headers: { "x-opalreader-internal": "1", "x-opalreader-scope": "production",
      "content-type": "application/json" },
    body: JSON.stringify({ grantId: "g", jobId: "j", occurrences: [] }) }));
  assert.equal(exec.status, 423);
  assert.equal((await exec.json()).error, "generation_halted");
});

// ============================================================ R2 namespace
test("prod surface imports from the UNPREFIXED namespace; smoke-prefixed objects are invisible to it", async () => {
  const prod = makeProd();
  const book = seedSurfaceBook(prod, "", "prod-book-ns", [128, 96, 64]);
  // The import path exercised here is the pinned chunk sequence —
  // the only migration import this surface serves. (At D3 pin
  // 4eb5a4b3 this test imported via the whole-book command; the
  // D3-1 correction refuses that command on production —
  // migration_chunk_required — so the namespace claims now ride
  // the sanctioned path. See tests/p8-d3-chunk-mandate.test.mjs.)
  let last = null;
  for (let i = 0; i < book.chunks.length; i++) {
    last = await prod.sendMigration(
      chunkBody(book, "prod-book-ns", i, `${MIG}:prod-book-ns:chunk:${i}`));
    assert.equal(last.outcome, "applied");
  }
  assert.equal(last.bookComplete, true);
  for (const g of prod.bucket.gets) assert.ok(!g.key.startsWith("smoke-p8/"), g.key);

  // The same book seeded ONLY under the smoke prefix: production
  // cannot see it (object_missing at execution), and never
  // reaches for the prefixed keys.
  const prod2 = makeProd();
  seedSurfaceBook(prod2, "smoke-p8/", "prod-book-ns", [128, 96, 64]);
  prod2.bucket.resetGets();
  const imp2Body = await prod2.sendMigration(
    chunkBody(book, "prod-book-ns", 0, `${MIG}:prod-book-ns:chunk:0`));
  assert.equal(imp2Body.outcome, "rejected");
  assert.equal(imp2Body.reason, "object_missing");
  for (const g of prod2.bucket.gets) assert.ok(!g.key.startsWith("smoke-p8/"), g.key);
});

test("prod class refuses ANY configured R2 prefix before bucket contact (the mirror of the staging namespace fence)", async () => {
  const prod = makeProd({ prefix: "smoke-p8/" });
  await assert.rejects(() => prod.instance._cache(),
    (e) => e instanceof ProductionR2NamespaceError && e.code === "production_r2_prefix_forbidden");
  // Through the public surface the misconfiguration fails the
  // request closed, and the bucket is never touched.
  const res = await prod.call("/v2/settings");
  assert.equal(res.status, 500);
  assert.match((await res.json()).error, /production scope forbids R2_KEY_PREFIX/);
  assert.equal(prod.bucket.gets.length, 0);
  assert.equal(prod.bucket.putCalls.length, 0);
});

// ============================================================ operator fence
test("Option D admission on the production surface: submits pend under the client credential alone; approvals are operator-fenced and fail closed", async () => {
  const prod = makeProd();
  const book = seedSurfaceBook(prod, "", "prod-book-fence", [128, 96, 64]);
  const body = chunkBody(book, "prod-book-fence", 0, `${MIG}:prod-book-fence:chunk:0`);
  // Client token only → the command PENDS (200). Nothing has
  // executed: no commands row, and the receipt surface shows the
  // pending view, not an outcome.
  let res = await prod.call("/v2/commands", { method: "POST", body });
  assert.equal(res.status, 200);
  const pending = await res.json();
  assert.equal(pending.state, "pending_operator");
  assert.equal(typeof pending.payloadSha256, "string");
  assert.equal(prod.commandCount(), 0);
  // The legacy dual-header shape (operator header riding the
  // submit) is inert under the one protocol: it pends exactly
  // like a plain submit and executes nothing. (The negative
  // regression for the retired path; see also the dedicated
  // battery in tests/p8-option-d-two-phase.test.mjs.)
  res = await prod.call("/v2/commands", { method: "POST", operator: PROD_OPERATOR,
    body: chunkBody(book, "prod-book-fence", 0, `${MIG}:prod-book-fence:chunk:legacy`) });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).state, "pending_operator");
  assert.equal(prod.commandCount(), 0);
  // Forged admission mark on the approval route → still 403.
  res = await prod.call("/v2/command-approvals", { method: "POST",
    headers: { "x-opalreader-operator-admitted": "1" },
    body: { commandId: body.command_id, payloadSha256: pending.payloadSha256 } });
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error, "migration_operator_required");
  assert.equal(prod.commandCount(), 0);
  // Wrong operator → 403. The STAGING operator credential is not
  // the production one → 403. The client token alone is not
  // sufficient on the approval route → 403.
  for (const operator of ["prod-operator-WRONG", OPERATOR, undefined]) {
    res = await prod.call("/v2/command-approvals", { method: "POST", operator,
      body: { commandId: body.command_id, payloadSha256: pending.payloadSha256 } });
    assert.equal(res.status, 403, `operator=${operator}`);
    assert.equal((await res.json()).error, "migration_operator_required");
  }
  assert.equal(prod.commandCount(), 0);
  // Correct production operator → admitted (the client token is
  // not even consulted on this route: a wrong one changes
  // nothing); the chunk applies exactly once.
  res = await prod.call("/v2/command-approvals", { method: "POST", operator: PROD_OPERATOR,
    token: "wrong-client-token",
    body: { commandId: body.command_id, payloadSha256: pending.payloadSha256 } });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).outcome, "applied");
  assert.equal(prod.commandCount(), 1);
  // Operator unset → submissions still pend, but approvals are
  // 503 fail-closed even when a credential is presented.
  const prodUnset = makeProd({ operatorToken: null });
  seedSurfaceBook(prodUnset, "", "prod-book-fence", [128, 96, 64]);
  res = await prodUnset.call("/v2/commands", { method: "POST", body });
  assert.equal(res.status, 200);
  const unsetPending = await res.json();
  res = await prodUnset.call("/v2/command-approvals", { method: "POST", operator: PROD_OPERATOR,
    body: { commandId: body.command_id, payloadSha256: unsetPending.payloadSha256 } });
  assert.equal(res.status, 503);
  assert.equal((await res.json()).error, "migration_operator_not_configured");
  // Operator equal to the client token → treated as not configured.
  const prodShared = makeProd({ operatorToken: PROD_CLIENT });
  res = await prodShared.call("/v2/command-approvals", { method: "POST", operator: PROD_CLIENT,
    body: { commandId: body.command_id, payloadSha256: pending.payloadSha256 } });
  assert.equal(res.status, 503);
});

// ============================================================ end-to-end
test("chunked import runs end-to-end on the production surface (unprefixed keys, per-chunk invisibility, gate)", async () => {
  const prod = makeProd();
  const staging = makeStaging();
  const book = seedSurfaceBook(prod, "", "prod-book-e2e", [128, 96, 64, 32, 16]);
  const B = "prod-book-e2e";
  const post = (i) => prod.sendMigration(chunkBody(book, B, i, `${MIG}:${B}:chunk:${i}`));
  let fin = await post(0);
  assert.equal(fin.outcome, "applied");
  let view = await (await prod.call(`/v2/migration/book/${B}`)).json();
  assert.equal(view.importRecord, null);
  assert.deepEqual(view.chunkedImport.chunksApplied, [0]);
  assert.equal(view.completeness.complete, false);
  fin = await post(1);
  assert.equal(fin.outcome, "applied");
  fin = await post(2);
  assert.equal(fin.outcome, "applied");
  assert.equal(fin.bookComplete, true);
  view = await (await prod.call(`/v2/migration/book/${B}`)).json();
  assert.equal(view.completeness.complete, true);
  assert.equal(view.importRecord.certificateSha256, fin.certificateSha256);
  const gate = await prod.sendMigration({ command_id: `${MIG}:gate-e2e`,
    type: "MigrateRecordFlipGate",
    payload: { migrationId: MIG, bookId: B, certificateSha256: fin.certificateSha256 } });
  assert.equal(gate.outcome, "applied");
  assert.equal(prod.bucket.putCalls.length, 0);
  // No shared state: staging's coordinator has never heard of the book.
  const stagingView = await (await staging.call(`/v2/migration/book/${B}`)).json();
  assert.equal(stagingView.importRecord, null);
  assert.equal(stagingView.chunkedImport, null);
});

// ============================================================ spec discipline
test("the production deploy spec describes a distinct script that owns its class — and the staging spec is untouched", async () => {
  const prodSpec = JSON.parse(readFileSync(new URL("../v2/p8/deploy-spec-prod.json", import.meta.url), "utf8"));
  const stagingSpec = JSON.parse(readFileSync(new URL("../v2/p8/deploy-spec.json", import.meta.url), "utf8"));
  assert.equal(prodSpec.script_name, "opalreader-api-v2-prod");
  assert.equal(prodSpec.main_module, "v2/worker-entry-prod.js");
  assert.deepEqual(prodSpec.durable_object_migrations,
    { new_sqlite_classes: ["OpalReaderCoordinatorProd"], new_tag: "v1" });
  const byName = Object.fromEntries(prodSpec.bindings.map(b => [b.name, b]));
  assert.deepEqual(Object.keys(byName).sort(),
    ["ALLOWED_ORIGIN", "COORDINATOR", "GENERATION_HALT", "OPALREADER_STORAGE", "OPALREADER_V2_SCOPE"]);
  assert.equal(byName.COORDINATOR.class_name, "OpalReaderCoordinatorProd");
  assert.ok(!("script_name" in byName.COORDINATOR), "own class, never a cross-script reference");
  assert.equal(byName.OPALREADER_V2_SCOPE.text, "production");
  assert.equal(byName.GENERATION_HALT.text, "1");
  assert.ok(!("R2_KEY_PREFIX" in byName), "no prefix binding: absence is the production shape");
  assert.ok(!prodSpec.bindings.some(b => b.type === "queue"), "no queue binding at all");
  assert.deepEqual(prodSpec.queue_producers, []);
  assert.deepEqual(prodSpec.queue_consumers, []);
  assert.deepEqual(prodSpec.provider_secrets_present, []);
  // Secrets are NAMES ONLY, recorded as deliberately unset here.
  assert.deepEqual(prodSpec.secret_bindings_required.map(s => s.name).sort(),
    ["OPALREADER_ACCESS_TOKEN", "OPALREADER_MIGRATION_OPERATOR_TOKEN"]);
  assert.ok(!prodSpec.bindings.some(b => b.type === "secret_text"));
  // The production entry exports no queue handler at all.
  assert.equal(prodEntry.queue, undefined);
  // Staging spec: exactly as before (smoke prefix, queue producer,
  // staging class, staging scope).
  assert.equal(stagingSpec.script_name, "opalreader-api-v2");
  assert.equal(stagingSpec.main_module, "v2/worker-entry.js");
  assert.deepEqual(stagingSpec.durable_object_migrations,
    { new_sqlite_classes: ["OpalReaderCoordinator"], new_tag: "v1" });
  assert.ok(stagingSpec.bindings.some(b => b.type === "queue" && b.name === "OPALREADER_GENERATION"));
  assert.equal(stagingSpec.bindings.find(b => b.name === "R2_KEY_PREFIX").text, "smoke-p8/");
  assert.equal(stagingSpec.bindings.find(b => b.name === "OPALREADER_V2_SCOPE").text, "staging-smoke");
});
