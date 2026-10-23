// Opal Reader v2 — P8 D3 Part C: resource proofs, MEASURED through
// the real Worker path (production entry -> OpalReaderCoordinatorProd
// -> real SQLite DO storage -> counting procedural R2 fake), at the
// approved freeze's worst-case shapes:
//
//   * the largest single object in the corpus (5,787,234 bytes);
//   * the largest book (Pucked Over: 510 rows, 1,555,992,872 bytes)
//     imported in its pinned chunks.
//
// The bucket is PROCEDURAL: it stores only per-object descriptors
// (size/format/stamp) and synthesizes the exact bytes on each GET
// (a tiled 1 MiB pattern block, stamped per object so digests are
// distinct). The fixture therefore holds no byte state of its own —
// what the memory sampler sees during an import is the worker
// path's own footprint: the prime's one-object-at-a-time buffering
// plus digests/metadata. That is the honest local measurement; what
// it cannot prove about the real 128 MB isolate ceiling is stated
// in the D3 build report (local process RSS includes the Node
// runtime, the SQLite store, and test bookkeeping; the isolate
// figure that matters — per-object transient buffering — is
// bounded by the largest single object and measured directly).
//
// The derived limits in v2/p8/migration-chunk-limits.mjs were set
// from these measurements; this file re-measures on every run and
// asserts the safety margins the derivation claims. Numbers are
// printed as a table for the report (local harness figures, not
// production guarantees).
import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import prodEntry, { OpalReaderCoordinatorProd } from "../v2/worker-entry-prod.js";
import { sha256Hex } from "../v2/host/adapters.mjs";
import {
  chunkCmd, pinnedChunksEntry, pinnedEntry, v1Meta,
} from "./helpers/migration-fixtures.mjs";
import { APPROVED_FREEZE_MANIFEST } from "../v2/p8/approved-freeze-manifest.mjs";
import { APPROVED_FREEZE_CHUNKS } from "../v2/p8/approved-freeze-chunks.mjs";
import { MIGRATION_CHUNK_LIMITS } from "../v2/p8/migration-chunk-limits.mjs";

const CLIENT = "prod-client-token-synthetic";
const OPERATOR = "prod-operator-token-synthetic";
const ORIGIN = "https://jedavid33-design.github.io";
const MIG = "mig-d3-resource";
const FREEZE = "freeze-digest-synthetic";
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

// ---- deterministic synthetic bytes at exact sizes: a 1 MiB
// pattern block, tiled; the first 4 bytes carry the object's stamp
// so no two objects share a digest.
const BLOCK = new Uint8Array(MIB);
for (let i = 0; i < BLOCK.length; i++) BLOCK[i] = (i * 31 + 7) & 0xff;
function synthBytes(size, stamp) {
  const out = new Uint8Array(size);
  for (let off = 0; off < size; off += MIB)
    out.set(BLOCK.subarray(0, Math.min(MIB, size - off)), off);
  new DataView(out.buffer).setUint32(0, stamp);
  return out;
}

// ---- procedural counting bucket: descriptors only; bytes are
// synthesized per GET, so the fixture store holds ~nothing.
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
  get totalBytes() { return this.gets.reduce((n, g) => n + g.bytes, 0); }
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
  return { bucket, state, instance, call, manifest, chunksManifest };
}

// ---- memory sampling while a phase runs. Reports, per metric,
// the phase's floor (minimum sample) and peak (maximum sample):
// the delta between them is the phase's own transient footprint.
// (A start-value baseline would be polluted by setup allocations
// the allocator has not yet reclaimed; the floor the process
// returns to BETWEEN objects is the honest reference, because the
// prime releases each object before fetching the next.)
function startSampler() {
  const keys = ["rss", "heapUsed", "external", "arrayBuffers"];
  const min = {}, max = {};
  const sample = () => {
    const m = process.memoryUsage();
    for (const k of keys) {
      if (min[k] === undefined || m[k] < min[k]) min[k] = m[k];
      if (max[k] === undefined || m[k] > max[k]) max[k] = m[k];
    }
  };
  sample();
  const timer = setInterval(sample, 2);
  return { stop: () => { clearInterval(timer); sample();
    const delta = {};
    for (const k of keys) delta[k] = max[k] - min[k];
    return { min, max, delta }; } };
}
const cpuMs = (delta) => (delta.user + delta.system) / 1000;

test("resource proof: the corpus' largest single object (5,787,234 B) primes with a one-object buffer footprint", async () => {
  const world = makeProdWorld();
  const { bucket, manifest, chunksManifest } = world;
  const SIZE = 5787234; // the approved freeze's largest object (Pucked Up)
  const stamp = 424242;
  const sha = sha256Hex(synthBytes(SIZE, stamp));
  const key = `audio/${sha}.wav`;
  bucket.seed(key, { size: SIZE, format: "wav", stamp, meta: v1Meta("wav") });
  const bookId = "d3-res-largest-object";
  const row = { occurrenceId: `${bookId}-seg-001`, revisionKey: sha, cacheKey: sha,
    manifest: { sha256: sha, size: SIZE, format: "wav" } };
  const pairs = [{ row, etag: `"etag:${key}"` }];
  manifest.books[bookId] = pinnedEntry(pairs);
  chunksManifest.books[bookId] = pinnedChunksEntry(pairs);
  const content = { title: bookId, occurrenceIds: [row.occurrenceId] };

  const sampler = startSampler();
  const cpu0 = process.cpuUsage();
  const t0 = performance.now();
  const res = await world.call("/v2/commands", { method: "POST", operator: OPERATOR,
    body: chunkCmd(`${MIG}:${bookId}:chunk:0`, {
      migrationId: MIG, freezeDigest: FREEZE, bookId, chunkIndex: 0,
      content, rows: [row] }) });
  const wallMs = performance.now() - t0;
  const cpu = cpuMs(process.cpuUsage(cpu0));
  const mem = sampler.stop();
  const body = await res.json();
  assert.equal(body.outcome, "applied", JSON.stringify(body));
  assert.equal(body.bookComplete, true);
  assert.equal(bucket.gets.length, 2, "one wav object = mp3 probe miss + wav hit");
  assert.equal(bucket.totalBytes, SIZE);
  assert.equal(bucket.putCalls.length, 0);
  console.log(`  [resource] largest object: size=${SIZE} wall=${wallMs.toFixed(1)}ms cpu=${cpu.toFixed(1)}ms ` +
    `memDelta rss=${(mem.delta.rss / MIB).toFixed(1)}MiB heap=${(mem.delta.heapUsed / MIB).toFixed(1)}MiB ` +
    `external=${(mem.delta.external / MIB).toFixed(1)}MiB arrayBuffers=${(mem.delta.arrayBuffers / MIB).toFixed(1)}MiB ` +
    `(abs peak AB=${(mem.max.arrayBuffers / MIB).toFixed(1)}MiB)`);
  // The per-object buffer term: ArrayBuffers growth attributable
  // to the import stays within a small multiple of ONE object —
  // the prime never holds more than the object it is hashing
  // (plus the bucket's synthesized copy behind the GET, a fixture
  // artifact).
  assert.ok(mem.delta.arrayBuffers < 6 * SIZE,
    `ArrayBuffers delta ${(mem.delta.arrayBuffers / MIB).toFixed(1)} MiB vs object ${(SIZE / MIB).toFixed(2)} MiB`);
  // And the derived item cap carries real headroom over the corpus.
  assert.ok(MIGRATION_CHUNK_LIMITS.maxItemBytes >= 2.5 * SIZE,
    "item cap is at least 2.5x the largest real object");
});

test("resource proof: the largest book (Pucked Over shape — 510 rows, 1,555,992,872 B) imports in its pinned chunks through the production Worker path", async () => {
  const world = makeProdWorld();
  const { bucket, manifest, chunksManifest } = world;
  const BOOK = "21f655a2-0b0a-4b62-86c9-3a3808dbab40"; // Pucked Over
  const pinned = APPROVED_FREEZE_MANIFEST.books[BOOK];
  assert.equal(pinned.rows.length, 510);
  // Synthetic rows at the book's REAL sizes/formats/order (its real
  // occurrence ids — the pin's own identifiers; all bytes and
  // digests are synthetic). Fingerprinted form throughout: the
  // attested-row provenance at byte scale is covered by the
  // structure rehearsal; this proof is about resources.
  const pairs = [], rows = [], contentIds = [];
  pinned.rows.forEach((t, i) => {
    const [occurrenceId, , , size, format] = t;
    const stamp = i + 1;
    const sha = sha256Hex(synthBytes(size, stamp));
    const objectKey = `audio/${sha}.${format}`;
    bucket.seed(objectKey, { size, format, stamp, meta: v1Meta(format) });
    const row = { occurrenceId, revisionKey: sha, cacheKey: sha,
      manifest: { sha256: sha, size, format } };
    rows.push(row); contentIds.push(occurrenceId);
    pairs.push({ row, etag: `"etag:${objectKey}"` });
  });
  const totalBookBytes = rows.reduce((n, r) => n + r.manifest.size, 0);
  assert.equal(totalBookBytes, 1555992872);
  manifest.books[BOOK] = pinnedEntry(pairs);
  chunksManifest.books[BOOK] = pinnedChunksEntry(pairs);
  // The fixture partition (same partitioner, same sizes) must equal
  // the committed real-freeze chunk pin for this book.
  const committed = APPROVED_FREEZE_CHUNKS.books[BOOK];
  assert.equal(chunksManifest.books[BOOK].chunkCount, committed.chunkCount);
  assert.deepEqual(
    chunksManifest.books[BOOK].chunks.map(c => [c.rowCount, c.totalBytes]),
    committed.chunks.map(c => [c.rowCount, c.totalBytes]));
  const content = { title: "Pucked Over (synthetic byte shape)", occurrenceIds: contentIds };

  const sampler = startSampler();
  const table = [];
  let last = null;
  for (const c of committed.chunks) {
    const slice = rows.slice(c.start, c.start + c.rowCount);
    bucket.resetGets();
    const cpu0 = process.cpuUsage();
    const t0 = performance.now();
    const res = await world.call("/v2/commands", { method: "POST", operator: OPERATOR,
      body: chunkCmd(`${MIG}:${BOOK}:chunk:${c.index}`, {
        migrationId: MIG, freezeDigest: FREEZE, bookId: BOOK, chunkIndex: c.index,
        content: c.index === 0 ? content : undefined, rows: slice }) });
    const wallMs = performance.now() - t0;
    const cpu = cpuMs(process.cpuUsage(cpu0));
    const body = await res.json();
    assert.equal(body.outcome, "applied", `chunk ${c.index}: ${JSON.stringify(body).slice(0, 200)}`);
    const expectedGets = slice.reduce((n, r) => n + (r.manifest.format === "wav" ? 2 : 1), 0);
    assert.equal(bucket.gets.length, expectedGets, `chunk ${c.index} GET count`);
    assert.equal(bucket.totalBytes, c.totalBytes, `chunk ${c.index} bytes`);
    table.push({ chunk: c.index, rows: c.rowCount, bytes: c.totalBytes,
                 gets: bucket.gets.length, wallMs: Math.round(wallMs), cpuMs: Math.round(cpu) });
    last = body;
  }
  const mem = sampler.stop();
  assert.equal(last.bookComplete, true);
  const totalGets = table.reduce((n, r) => n + r.gets, 0);
  const totalWall = table.reduce((n, r) => n + r.wallMs, 0);
  console.log("  [resource] Pucked Over chunk table: " + JSON.stringify(table));
  console.log(`  [resource] totals: gets=${totalGets} wall=${totalWall}ms ` +
    `memDelta rss=${(mem.delta.rss / MIB).toFixed(1)}MiB heap=${(mem.delta.heapUsed / MIB).toFixed(1)}MiB ` +
    `external=${(mem.delta.external / MIB).toFixed(1)}MiB arrayBuffers=${(mem.delta.arrayBuffers / MIB).toFixed(1)}MiB ` +
    `(abs peaks rss=${(mem.max.rss / MIB).toFixed(1)}MiB AB=${(mem.max.arrayBuffers / MIB).toFixed(1)}MiB)`);
  // The plan's accounting: 510 wav rows -> exactly 1,020 GET calls.
  assert.equal(totalGets, 1020);
  assert.equal(bucket.putCalls.length, 0);
  // Read-back + gate cost zero further audio GETs (G1 discipline on
  // the production surface).
  bucket.resetGets();
  const view = await (await world.call(`/v2/migration/book/${BOOK}`)).json();
  assert.equal(view.completeness.complete, true);
  const gate = await world.call("/v2/commands", { method: "POST", operator: OPERATOR,
    body: { command_id: `${MIG}:gate-po`, type: "MigrateRecordFlipGate",
      payload: { migrationId: MIG, bookId: BOOK, certificateSha256: last.certificateSha256 } } });
  assert.equal((await gate.json()).outcome, "applied");
  assert.equal(bucket.gets.length, 0, "read-back + gate fetched no audio");
  // Memory: across a 1.45 GiB book imported in ~250 MiB chunks,
  // resident growth stays a small fraction of the 128 MB isolate
  // ceiling — the prime's footprint is per-object (largest here
  // 5.6 MiB), never per-chunk or per-book. Had any layer buffered
  // a whole chunk, the ArrayBuffers delta alone would exceed
  // 250 MiB.
  assert.ok(mem.delta.rss < 128 * MIB, `RSS delta ${(mem.delta.rss / MIB).toFixed(1)} MiB`);
  assert.ok(mem.delta.arrayBuffers < 64 * MIB,
    `ArrayBuffers delta ${(mem.delta.arrayBuffers / MIB).toFixed(1)} MiB`);
  // Chunk shape sanity vs the derived limits.
  for (const r of table) {
    assert.ok(r.rows <= MIGRATION_CHUNK_LIMITS.maxRowsPerChunk);
    assert.ok(r.bytes <= MIGRATION_CHUNK_LIMITS.maxChunkBytes);
    assert.ok(r.wallMs < 30000, "each chunk far inside the 30 s DO CPU budget locally");
  }
});
