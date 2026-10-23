// Opal Reader v2 — P8 D3-1 correction: the chunk mandate on the
// production surface (Rowan D3 re-review 6356184643, HARD STOP
// D3-1; Wren concession 6356193843).
//
// The defect: at D3 pin 4eb5a4b3 the row/byte limits lived only in
// the chunk path. The legacy whole-book command
// MigrateImportBindings was still admitted on the PRODUCTION
// surface under the operator credential with no limits, and its
// partial-chunk interleaving guard fired only AFTER the async
// prime — so a mistaken whole-book call could spend a full
// 510-row / ~1.56 GB / 1,020-GET prime before rejecting, or
// import the whole largest book in one invocation if no chunk had
// run. That defeats the D1 mandate: chunking is the REQUIRED
// execution shape on production, because live invocation limits
// are unproven.
//
// The correction, in three layers, all refusing with the named
// error `migration_chunk_required` BEFORE the DO is touched (entry)
// or before anything is prepared/primed (DO/API backups):
//   1. the production worker entry refuses the type outright;
//   2. the production DO class refuses it on direct internal
//      requests (the _migrationChunkRequired surface hook);
//   3. the API layer refuses a production-surface-marked
//      whole-book command beside its operator-admission fence.
// MigrateImportChunk and MigrateRecordFlipGate remain admitted
// under the existing operator policy, unchanged. The staging
// surface keeps the whole-book command exactly as reviewed —
// nothing in this file touches it; its suites are the proof.
//
// Shapes: the pinned Pucked Over shape (510 rows, 1,555,992,872 B,
// the approved freeze's largest book) at its real sizes/formats/
// order, synthetic bytes via a procedural counting bucket — the
// resource-proof fixture pattern. All tokens are synthetic fakes.
import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import prodEntry, { OpalReaderCoordinatorProd } from "../v2/worker-entry-prod.js";
import { createApi } from "../v2/api.mjs";
import { sha256Hex } from "../v2/host/adapters.mjs";
import {
  chunkCmd, importCmd, pinnedChunksEntry, pinnedEntry, v1Meta,
} from "./helpers/migration-fixtures.mjs";
import { APPROVED_FREEZE_MANIFEST } from "../v2/p8/approved-freeze-manifest.mjs";
import { APPROVED_FREEZE_CHUNKS } from "../v2/p8/approved-freeze-chunks.mjs";

const CLIENT = "prod-client-token-synthetic";
const OPERATOR = "prod-operator-token-synthetic";
const ORIGIN = "https://jedavid33-design.github.io";
const MIG = "mig-d3-chunk-mandate";
const FREEZE = "freeze-digest-synthetic";
const BOOK = "21f655a2-0b0a-4b62-86c9-3a3808dbab40"; // Pucked Over
const MIB = 1024 * 1024;

// ---- production-faithful DO SQL facade (.one() throws)
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

// ---- procedural counting bucket (descriptor store; bytes are
// synthesized per GET — the resource-proof pattern).
const BLOCK = new Uint8Array(MIB);
for (let i = 0; i < BLOCK.length; i++) BLOCK[i] = (i * 31 + 7) & 0xff;
function synthBytes(size, stamp) {
  const out = new Uint8Array(size);
  for (let off = 0; off < size; off += MIB)
    out.set(BLOCK.subarray(0, Math.min(MIB, size - off)), off);
  new DataView(out.buffer).setUint32(0, stamp);
  return out;
}
class ProceduralBucket {
  constructor() { this.objects = new Map(); this.gets = []; this.putCalls = []; }
  seed(key, { size, format, stamp, meta = {} }) {
    this.objects.set(key, { size, format, stamp, meta });
  }
  async get(key) {
    const o = this.objects.get(key);
    this.gets.push({ key, hit: !!o, bytes: o ? o.size : 0 });
    if (!o) return null;
    return { arrayBuffer: async () => synthBytes(o.size, o.stamp).buffer,
             customMetadata: o.meta, httpMetadata: {},
             etag: `"etag:${key}"`, size: o.size };
  }
  async put(key) { this.putCalls.push(key); }
  resetGets() { this.gets = []; }
}

function makeProdWorld() {
  const bucket = new ProceduralBucket();
  const state = makeDoState();
  const manifest = { snapshotDigest: FREEZE, books: {} };
  const chunksManifest = { snapshotDigest: FREEZE, books: {} };
  const doEnv = {
    OPALREADER_V2_SCOPE: "production", OPALREADER_ACCESS_TOKEN: CLIENT,
    GENERATION_HALT: "1", OPALREADER_STORAGE: bucket, ALLOWED_ORIGIN: ORIGIN,
    approvedFreezeManifest: manifest, approvedFreezeChunks: chunksManifest,
  };
  const instance = new OpalReaderCoordinatorProd(state, doEnv);
  const namespace = { idFromName: (n) => n, get: () => ({ fetch: (req) => instance.fetch(req) }) };
  const env = {
    OPALREADER_ACCESS_TOKEN: CLIENT, OPALREADER_V2_SCOPE: "production",
    COORDINATOR: namespace, ALLOWED_ORIGIN: ORIGIN,
    OPALREADER_MIGRATION_OPERATOR_TOKEN: OPERATOR,
  };
  const call = (path, { method = "GET", body, operator } = {}) =>
    prodEntry.fetch(new Request(`https://prod.test${path}`, {
      method,
      headers: { "x-opalreader-token": CLIENT, "x-opalreader-scope": "production",
        "x-opalreader-instance": "account", Origin: ORIGIN,
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(operator !== undefined ? { "x-opalreader-operator-token": operator } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }), env);
  const commandCount = () =>
    state.storage.sql.exec(`SELECT command_id FROM commands`).toArray().length;
  return { bucket, state, instance, call, commandCount, manifest, chunksManifest };
}

// Seed Pucked Over at its pinned shape: the approved freeze's own
// occurrence ids, sizes, formats and order; synthetic bytes and
// digests throughout. The fixture partition is asserted equal to
// the committed chunk pin, so "the pinned shape" is not a claim —
// it is checked on every run.
function seedPuckedOver(world) {
  const pinned = APPROVED_FREEZE_MANIFEST.books[BOOK];
  assert.equal(pinned.rows.length, 510);
  const pairs = [], rows = [], contentIds = [];
  pinned.rows.forEach((t, i) => {
    const [occurrenceId, , , size, format] = t;
    const stamp = i + 1;
    const sha = sha256Hex(synthBytes(size, stamp));
    const objectKey = `audio/${sha}.${format}`;
    world.bucket.seed(objectKey, { size, format, stamp, meta: v1Meta(format) });
    const row = { occurrenceId, revisionKey: sha, cacheKey: sha,
      manifest: { sha256: sha, size, format } };
    rows.push(row); contentIds.push(occurrenceId);
    pairs.push({ row, etag: `"etag:${objectKey}"` });
  });
  assert.equal(rows.reduce((n, r) => n + r.manifest.size, 0), 1555992872);
  world.manifest.books[BOOK] = pinnedEntry(pairs);
  world.chunksManifest.books[BOOK] = pinnedChunksEntry(pairs);
  const committed = APPROVED_FREEZE_CHUNKS.books[BOOK];
  assert.equal(world.chunksManifest.books[BOOK].chunkCount, committed.chunkCount);
  assert.deepEqual(
    world.chunksManifest.books[BOOK].chunks.map(c => [c.rowCount, c.totalBytes]),
    committed.chunks.map(c => [c.rowCount, c.totalBytes]));
  const content = { title: "Pucked Over (synthetic byte shape)", occurrenceIds: contentIds };
  return { rows, content, chunks: committed.chunks };
}

const wholeBook = (id, book) => importCmd(id, {
  migrationId: MIG, freezeDigest: FREEZE, bookId: BOOK,
  content: book.content, rows: book.rows });
const postChunk = (world, book, i) => world.call("/v2/commands", {
  method: "POST", operator: OPERATOR,
  body: chunkCmd(`${MIG}:${BOOK}:chunk:${i}`, {
    migrationId: MIG, freezeDigest: FREEZE, bookId: BOOK, chunkIndex: i,
    content: i === 0 ? book.content : undefined,
    rows: book.rows.slice(book.chunks[i].start,
                           book.chunks[i].start + book.chunks[i].rowCount) }) });

// ============================================================ (a)
test("D3-1 (a): whole-book import on production is refused migration_chunk_required with a CORRECT operator credential — zero R2 GETs, zero commands written", async () => {
  const world = makeProdWorld();
  const book = seedPuckedOver(world);
  const id = `${MIG}:whole-book-a`;
  const res = await world.call("/v2/commands", { method: "POST", operator: OPERATOR,
    body: wholeBook(id, book) });
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error, "migration_chunk_required");
  // The refusal precedes the DO and the prime: no bucket contact,
  // no command row, no receipt — the coordinator never saw it.
  assert.equal(world.bucket.gets.length, 0);
  assert.equal(world.bucket.putCalls.length, 0);
  assert.equal(world.commandCount(), 0);
  const receipt = await world.call(`/v2/commands/${id}`);
  assert.equal(receipt.status, 404);
  assert.equal((await receipt.json()).error, "command_not_found");
  // The type is refused outright on this surface — the refusal is
  // not a credential outcome, so it precedes the operator check:
  // the same request WITHOUT the operator credential names the
  // same error (and still writes nothing).
  const noOp = await world.call("/v2/commands", { method: "POST",
    body: wholeBook(`${MIG}:whole-book-a-noop`, book) });
  assert.equal(noOp.status, 403);
  assert.equal((await noOp.json()).error, "migration_chunk_required");
  assert.equal(world.bucket.gets.length, 0);
  assert.equal(world.commandCount(), 0);
});

// ============================================================ (b)
test("D3-1 (b): the refusal is identical with chunk 1 already applied — zero additional GETs, the applied chunk's state untouched", async () => {
  const world = makeProdWorld();
  const book = seedPuckedOver(world);
  const first = await postChunk(world, book, 0);
  assert.equal((await first.json()).outcome, "applied");
  assert.equal(world.commandCount(), 1);
  const viewBefore = await (await world.call(`/v2/migration/book/${BOOK}`)).json();
  assert.deepEqual(viewBefore.chunkedImport.chunksApplied, [0]);
  assert.equal(viewBefore.importRecord, null);
  assert.equal(viewBefore.completeness.complete, false);

  world.bucket.resetGets();
  const id = `${MIG}:whole-book-b`;
  const res = await world.call("/v2/commands", { method: "POST", operator: OPERATOR,
    body: wholeBook(id, book) });
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error, "migration_chunk_required");
  // No prime, no revalidation, no writes: at pin 4eb5a4b3 this
  // same call spent the full 510-row prime before its interleave
  // guard rejected inside the coordinator.
  assert.equal(world.bucket.gets.length, 0);
  assert.equal(world.bucket.putCalls.length, 0);
  assert.equal(world.commandCount(), 1);
  const receipt = await world.call(`/v2/commands/${id}`);
  assert.equal(receipt.status, 404);
  const viewAfter = await (await world.call(`/v2/migration/book/${BOOK}`)).json();
  assert.deepEqual(viewAfter.chunkedImport.chunksApplied, [0]);
  assert.equal(viewAfter.importRecord, null);
  assert.equal(viewAfter.completeness.complete, false);
});

// ============================================================ (c)
test("D3-1 (c): after the refusal, MigrateImportChunk and MigrateRecordFlipGate are still admitted in their intended order", async () => {
  const world = makeProdWorld();
  const book = seedPuckedOver(world);
  assert.equal((await (await postChunk(world, book, 0)).json()).outcome, "applied");
  const refused = await world.call("/v2/commands", { method: "POST", operator: OPERATOR,
    body: wholeBook(`${MIG}:whole-book-c`, book) });
  assert.equal(refused.status, 403);
  assert.equal((await refused.json()).error, "migration_chunk_required");

  // The intended order simply continues: the next chunk, the
  // remaining chunks, completion, then the gate.
  let last = null;
  for (let i = 1; i < book.chunks.length; i++) {
    const res = await postChunk(world, book, i);
    last = await res.json();
    assert.equal(last.outcome, "applied", `chunk ${i}: ${JSON.stringify(last).slice(0, 200)}`);
  }
  assert.equal(last.bookComplete, true);
  assert.equal(typeof last.certificateSha256, "string");
  const view = await (await world.call(`/v2/migration/book/${BOOK}`)).json();
  assert.equal(view.completeness.complete, true);
  assert.equal(view.importRecord.certificateSha256, last.certificateSha256);
  const gate = await world.call("/v2/commands", { method: "POST", operator: OPERATOR,
    body: { command_id: `${MIG}:gate-c`, type: "MigrateRecordFlipGate",
      payload: { migrationId: MIG, bookId: BOOK,
        certificateSha256: last.certificateSha256 } } });
  assert.equal((await gate.json()).outcome, "applied");
  // The refused whole-book attempt left no receipt behind, ever.
  const receipt = await world.call(`/v2/commands/${MIG}:whole-book-c`);
  assert.equal(receipt.status, 404);
  assert.equal(world.bucket.putCalls.length, 0);
});

// ============================================================ (d)
test("D3-1 (d): DO/API backup — a direct internal request to the production coordinator (public entry bypassed) is refused the same way, and the API layer refuses a production-marked whole-book command on its own", async () => {
  const world = makeProdWorld();
  const book = seedPuckedOver(world);
  const cmd = wholeBook(`${MIG}:whole-book-d`, book);
  // Straight to the DO instance with the internal headers and the
  // admission mark the public entry would have set — the shape a
  // bypass would take. The DO layer refuses before dispatch.
  const direct = await world.instance.fetch(new Request("https://do.test/v2/commands", {
    method: "POST",
    headers: { "x-opalreader-internal": "1", "x-opalreader-scope": "production",
      "x-opalreader-operator-admitted": "1", "content-type": "application/json" },
    body: JSON.stringify(cmd) }));
  assert.equal(direct.status, 403);
  assert.equal((await direct.json()).error, "migration_chunk_required");
  assert.equal(world.bucket.gets.length, 0);
  assert.equal(world.bucket.putCalls.length, 0);
  assert.equal(world.commandCount(), 0);

  // The API layer on its own: a production-surface-marked request
  // (the scope mark the entries set and the DO validates) carrying
  // the admission mark is refused beside the operator fence,
  // before any coordinator state is touched — the state stub's
  // SQL throws if reached.
  const api = createApi({});
  const unreachableState = { storage: { sql: { exec() {
    throw new Error("api layer reached SQL: the backup did not fire"); } } } };
  const viaApi = await api(new Request("https://api.test/v2/commands", {
    method: "POST",
    headers: { "x-opalreader-scope": "production",
      "x-opalreader-operator-admitted": "1", "content-type": "application/json" },
    body: JSON.stringify(cmd) }), unreachableState);
  assert.equal(viaApi.status, 403);
  assert.equal((await viaApi.json()).error, "migration_chunk_required");
});
