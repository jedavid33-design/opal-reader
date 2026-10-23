// Opal Reader v2 — P8 B1: the carry pin against the REAL frozen
// books, the §3B runner (determinism + hash sheet), and full
// synthetic per-book sequences driven through the REAL production
// Worker entry by the runner driver itself.
//
// The real-book tests are byte-level consistency proofs only:
// the deriver's pin, the runner's independent content
// construction, and the frozen snapshot must agree exactly. No
// book content is printed or asserted on — counts and digests
// only (standing no-spoilers rule: book text is technical data).
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import prodEntry, {
  OpalReaderCoordinatorProd, PRODUCTION_SCOPE, PRODUCTION_INSTANCE,
} from "../v2/worker-entry-prod.js";
import { APPROVED_FREEZE_MANIFEST } from "../v2/p8/approved-freeze-manifest.mjs";
import { APPROVED_FREEZE_CHUNKS } from "../v2/p8/approved-freeze-chunks.mjs";
import { APPROVED_FREEZE_CARRY } from "../v2/p8/approved-freeze-carry.mjs";
import {
  buildBookPlan, buildGateCommand, contentRecordFromTransform,
  loadSnapshotBook, renderHashSheet, sha256HexText, canonicalJson,
} from "../tools/d4-runner/build-payloads.mjs";
import { runBookMigration, runFlipGate } from "../tools/d4-runner/run-book.mjs";
import {
  pinnedEntry, pinnedChunksEntry, pinnedCarryEntry, sha256Hex, v1Meta,
} from "./helpers/migration-fixtures.mjs";

const REPO = fileURLToPath(new URL("../", import.meta.url));
const DATA_DIR = fileURLToPath(new URL("../../../opal-reader-p8-data/", import.meta.url));
const MIG = "mig-b1-runner";
const FREEZE = "freeze-digest-synthetic";
const ORIGIN = "https://jedavid33-design.github.io";
const PROD_CLIENT = "prod-client-token-synthetic";
const PROD_OPERATOR = "prod-operator-token-synthetic";

// ============================================================ the real pin
test("deriver: re-running the carry deriver reproduces the committed pin byte-for-byte (--check)", () => {
  const out = execFileSync(process.execPath,
    [join(REPO, "tools/derive-approved-freeze-carry.mjs"), "--check"],
    { cwd: REPO, encoding: "utf8" });
  assert.match(out, /up to date/);
});

const EXPECTED_BOOKS = {
  "5c589095-f812-48a2-8ab2-03ba2791f2b2": { content: 407, bound: 50, jobs: 1, chunks: 1, checkpoints: 21 },
  "48019197-b92e-4766-928e-5f73f7084e6d": { content: 152, bound: 152, jobs: 0, chunks: 3, checkpoints: 19 },
  "f1b1e2f9-8c09-4f23-8290-472740923954": { content: 209, bound: 110, jobs: 0, chunks: 2, checkpoints: 40 },
  "1c6bc7a6-6ef7-45b9-9a58-f492a1526ea0": { content: 203, bound: 203, jobs: 0, chunks: 3, checkpoints: 44 },
  "89b2d4f1-d3b4-41ef-b59c-83800bec9f81": { content: 654, bound: 307, jobs: 0, chunks: 4, checkpoints: 28 },
  "067ddb04-d68f-4c5a-a368-ccd1d71876cd": { content: 475, bound: 467, jobs: 0, chunks: 6, checkpoints: 38 },
  "21f655a2-0b0a-4b62-86c9-3a3808dbab40": { content: 510, bound: 510, jobs: 3, chunks: 6, checkpoints: 28 },
};

test("pin self-consistency: the runner's independent content construction hashes to the carry pin for all seven real books; counts and job sets match the freeze record", () => {
  assert.equal(APPROVED_FREEZE_CARRY.snapshotDigest,
    "1c73c56c8005660788a93d7283faae24abcd979ce110264c5da462ea82f2dc18");
  let totalContent = 0, totalBound = 0;
  for (const [bookId, exp] of Object.entries(EXPECTED_BOOKS)) {
    const pin = APPROVED_FREEZE_CARRY.books[bookId];
    assert.ok(pin, `carry pin exists for ${bookId}`);
    const loaded = loadSnapshotBook({ dataDir: DATA_DIR, bookId });
    assert.ok(loaded, `snapshot book loads for ${bookId}`);
    const content = contentRecordFromTransform(loaded.transformed);
    assert.equal(sha256HexText(canonicalJson(content)), pin.contentSha256,
      `${bookId}: runner-constructed content hash == carry pin`);
    assert.equal(pin.occurrenceCount, exp.content);
    assert.equal(content.occurrenceIds.length, exp.content);
    assert.equal(pin.boundCount, exp.bound);
    assert.equal(APPROVED_FREEZE_MANIFEST.books[bookId].rows.length, exp.bound);
    assert.equal(APPROVED_FREEZE_CHUNKS.books[bookId].chunkCount, exp.chunks);
    assert.equal(pin.jobs.count, exp.jobs);
    assert.equal(pin.position.checkpoints.length, exp.checkpoints);
    totalContent += exp.content; totalBound += exp.bound;
  }
  assert.equal(totalContent, 2610);
  assert.equal(totalBound, 1799);
});

test("pin job sets: Forever Pucked carries exactly one parked_policy (chapter 2); Pucked Over exactly three superseded; the other five are SIGNED empty sets", () => {
  const fp = APPROVED_FREEZE_CARRY.books["5c589095-f812-48a2-8ab2-03ba2791f2b2"];
  assert.equal(fp.jobs.aggregates.length, 1);
  assert.equal(fp.jobs.aggregates[0].v2State, "parked_policy");
  assert.equal(fp.jobs.aggregates[0].chapterIndex, 2);
  assert.match(fp.jobs.aggregates[0].definitionDigest, /^[a-f0-9]{64}$/);
  const po = APPROVED_FREEZE_CARRY.books["21f655a2-0b0a-4b62-86c9-3a3808dbab40"];
  assert.deepEqual(po.jobs.aggregates.map((a) => a.v2State),
    ["superseded", "superseded", "superseded"]);
  const emptyHash = sha256HexText("[]");
  for (const id of ["48019197-b92e-4766-928e-5f73f7084e6d",
                    "f1b1e2f9-8c09-4f23-8290-472740923954",
                    "1c6bc7a6-6ef7-45b9-9a58-f492a1526ea0",
                    "89b2d4f1-d3b4-41ef-b59c-83800bec9f81",
                    "067ddb04-d68f-4c5a-a368-ccd1d71876cd"]) {
    const pin = APPROVED_FREEZE_CARRY.books[id];
    assert.equal(pin.jobs.count, 0, `${id}: explicit zero count`);
    assert.equal(pin.jobs.setSha256, emptyHash, `${id}: the signed empty-set hash`);
    assert.deepEqual(pin.jobs.aggregates, []);
  }
});

test("runner determinism: the same freeze in produces byte-identical plans and hash sheets; a content/pin mismatch refuses to build", () => {
  const bookId = "5c589095-f812-48a2-8ab2-03ba2791f2b2";
  const { transformed } = loadSnapshotBook({ dataDir: DATA_DIR, bookId });
  const content = contentRecordFromTransform(transformed);
  const args = { bookId, content, chunksEntry: APPROVED_FREEZE_CHUNKS.books[bookId],
    manifestEntry: APPROVED_FREEZE_MANIFEST.books[bookId],
    carry: APPROVED_FREEZE_CARRY.books[bookId],
    migrationId: MIG, freezeDigest: APPROVED_FREEZE_CARRY.snapshotDigest };
  const a = buildBookPlan(args);
  const b = buildBookPlan(args);
  assert.deepEqual(a, b);
  assert.equal(renderHashSheet([a]), renderHashSheet([b]));
  assert.equal(a.hashSheet.contentSha256, APPROVED_FREEZE_CARRY.books[bookId].contentSha256);
  assert.equal(a.hashSheet.chunkCount, 1);
  assert.equal(a.hashSheet.bindingRows, 50);
  assert.equal(a.hashSheet.digestPendingRows, 50,
    "no digest resolver supplied: every row is honestly digest-pending");
  assert.equal(a.hashSheet.positions.payloadSha256,
    APPROVED_FREEZE_CARRY.books[bookId].position.payloadSha256);
  assert.equal(a.hashSheet.jobs.setSha256,
    APPROVED_FREEZE_CARRY.books[bookId].jobs.setSha256);
  assert.equal(a.commands[0].command_id, `${MIG}:${bookId}:chunk:0`);
  assert.equal(a.commands[1].command_id, `${MIG}:${bookId}:positions`);
  assert.equal(a.commands[2].command_id, `${MIG}:${bookId}:jobs`);
  assert.throws(() => buildBookPlan({ ...args, content: { ...content, title: "Tampered" } }),
    /does not match the carry pin/);
});

// ============================================================ worker-path sequences
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
    this.gets.push(key);
    if (!e) return null;
    return { arrayBuffer: async () => e.bytes.slice().buffer,
             customMetadata: e.customMetadata, httpMetadata: {},
             etag: `"etag:${key}"`, size: e.bytes.byteLength };
  }
  async put(key) { this.putCalls.push(key); }
}

// One production surface with a SYNTHETIC freeze + carry seam
// (digest-matched, so the carry machinery is active) and
// GENERATION_HALT=1 — carries must work while generation is off.
function makeProdSurface() {
  const bucket = new CountingBucket();
  const state = makeDoState();
  const manifest = { snapshotDigest: FREEZE, books: {} };
  const chunksManifest = { snapshotDigest: FREEZE, books: {} };
  const carryManifest = { snapshotDigest: FREEZE, books: {} };
  const doEnv = {
    OPALREADER_V2_SCOPE: PRODUCTION_SCOPE, OPALREADER_ACCESS_TOKEN: PROD_CLIENT,
    GENERATION_HALT: "1", OPALREADER_STORAGE: bucket, ALLOWED_ORIGIN: ORIGIN,
    approvedFreezeManifest: manifest, approvedFreezeChunks: chunksManifest,
    approvedFreezeCarry: carryManifest,
  };
  const instanceObj = new OpalReaderCoordinatorProd(state, doEnv);
  const namespace = { idFromName: (n) => n, get: () => ({ fetch: (req) => instanceObj.fetch(req) }) };
  const env = { OPALREADER_ACCESS_TOKEN: PROD_CLIENT, COORDINATOR: namespace,
                OPALREADER_V2_SCOPE: PRODUCTION_SCOPE,
                ALLOWED_ORIGIN: ORIGIN, OPALREADER_MIGRATION_OPERATOR_TOKEN: PROD_OPERATOR };
  const call = (path, { method = "GET", body, operator, token = PROD_CLIENT } = {}) =>
    prodEntry.fetch(new Request(`https://surface.test${path}`, {
      method,
      headers: { "x-opalreader-token": token, "x-opalreader-scope": PRODUCTION_SCOPE,
        "x-opalreader-instance": PRODUCTION_INSTANCE, Origin: ORIGIN,
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(operator !== undefined ? { "x-opalreader-operator-token": operator } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }), env);
  const rows = (table) => state.storage.sql.exec(`SELECT * FROM ${table}`).toArray();
  return { bucket, state, call, rows, manifest, chunksManifest, carryManifest };
}

function workerTransport(surface, { dropFirstPositions = false } = {}) {
  let dropped = false;
  return {
    async sendCommand(cmd) {
      const res = await surface.call("/v2/commands",
        { method: "POST", operator: PROD_OPERATOR, body: cmd });
      const receipt = await res.json();
      if (dropFirstPositions && !dropped && cmd.type === "MigrateImportPositions") {
        dropped = true; // the command LANDED; the response is "lost"
        throw new Error("simulated transport drop after execution");
      }
      return receipt;
    },
    async readView(bookId) {
      const res = await surface.call(`/v2/migration/book/${encodeURIComponent(bookId)}`);
      return res.json();
    },
    async getReceipt(commandId) {
      const res = await surface.call(`/v2/commands/${encodeURIComponent(commandId)}`);
      return res.status === 200 ? res.json() : null;
    },
  };
}

// Build a synthetic transform-shaped book + seeded rows on the
// surface, pin manifest/chunks/carry, and return the runner plan.
function surfaceBook(surface, { bookId, chapterSizes, boundCount, limits,
                                positionAt, positionOffset, checkpoints, jobs }) {
  const total = chapterSizes.reduce((a, b) => a + b, 0);
  const occIds = Array.from({ length: total }, (_, i) =>
    `${bookId}-seg-${String(i + 1).padStart(3, "0")}`);
  const content = { title: bookId, occurrenceIds: occIds };
  const pairs = [], digestByKey = new Map();
  for (let i = 0; i < boundCount; i++) {
    const bytes = new Uint8Array(24).fill(i + 1);
    const sha = sha256Hex(bytes);
    const objectKey = `audio/${sha}.mp3`;
    surface.bucket.seed(objectKey, bytes, v1Meta("mp3"));
    const row = { occurrenceId: occIds[i], revisionKey: sha, cacheKey: sha,
                  manifest: { sha256: sha, size: bytes.length, format: "mp3" } };
    pairs.push({ row, etag: `"etag:${objectKey}"` });
    digestByKey.set(sha, sha);
  }
  surface.manifest.books[bookId] = pinnedEntry(pairs);
  const chunksEntry = pinnedChunksEntry(pairs, limits);
  surface.chunksManifest.books[bookId] = chunksEntry;
  const jobList = typeof jobs === "function" ? jobs({ occIds, pairs }) : jobs;
  const carry = pinnedCarryEntry({ bookId, content,
    position: { occurrenceId: occIds[positionAt], offsetSec: positionOffset, checkpoints },
    jobs: jobList });
  surface.carryManifest.books[bookId] = carry;
  const plan = buildBookPlan({ bookId, content,
    chunksEntry,
    manifestEntry: { rows: pairs.map((p) => ({
      occurrenceId: p.row.occurrenceId, revisionKey: p.row.revisionKey,
      cacheKey: p.row.cacheKey, size: p.row.manifest.size,
      format: p.row.manifest.format,
      objectKey: `audio/${p.row.cacheKey}.mp3` })) },
    carry, migrationId: MIG, freezeDigest: FREEZE,
    digestOf: (k) => digestByKey.get(k) ?? null });
  return { content, occIds, pairs, carry, plan };
}

test("FP shape through the REAL production Worker: 1 chunk of 50 + positions + 1 parked job + gate, driven by the runner; PUT 0; GETs match the hash-sheet estimate; a dropped positions response resolves from the stored receipt with no double-apply", async () => {
  const surface = makeProdSurface();
  const bookId = "fp-shape-book";
  const occIdsPreview = Array.from({ length: 407 }, (_, i) =>
    `${bookId}-seg-${String(i + 1).padStart(3, "0")}`);
  const parkedOcc = [
    ...Array.from({ length: 3 }, (_, i) => ({
      occurrenceId: occIdsPreview[380 + i], revisionKey: "device-voice", state: "ready" })),
    ...Array.from({ length: 18 }, (_, i) => ({
      occurrenceId: occIdsPreview[383 + i], revisionKey: "unbound", state: "blocked_policy" })),
    ...Array.from({ length: 6 }, (_, i) => ({
      occurrenceId: occIdsPreview[401 + i], revisionKey: "unbound", state: "pending" })),
  ];
  const { plan, carry } = surfaceBook(surface, {
    bookId, chapterSizes: [100, 100, 100, 107], boundCount: 50,
    limits: { maxRowsPerChunk: 64, maxChunkBytes: 64 * 1024 * 1024, maxItemBytes: 16 * 1024 * 1024 },
    positionAt: 6, positionOffset: 106.82,
    checkpoints: Array.from({ length: 21 }, (_, i) => ({ chapterIndex: i, segmentIndex: 0, offsetSec: i })),
    jobs: [{ jobId: "fp-shape-parked", chapterIndex: 3, v2State: "parked_policy",
             cause: "v1 job paused_update (chapter blocked by POLICY_BLOCK outcomes)",
             definition: { kind: "job", bookId, chapterIndex: 3, lane: "standard",
               batchJobName: null, migrationProvenance: "synthetic", statusSegments: [] },
             occurrences: parkedOcc }] });
  assert.equal(plan.hashSheet.chunkCount, 1);
  assert.equal(plan.hashSheet.bindingRows, 50);
  assert.equal(plan.hashSheet.expectedGetsEstimate, 50);
  assert.equal(plan.hashSheet.digestPendingRows, 0, "the resolver supplied every digest");

  const transport = workerTransport(surface, { dropFirstPositions: true });
  const run = await runBookMigration({ plan, transport });
  assert.equal(run.ok, true, JSON.stringify(run.log));
  assert.deepEqual(run.log.map((l) => [l.type, l.outcome]), [
    ["MigrateImportChunk", "applied"],
    ["MigrateImportPositions", "applied"],   // resolved via getReceipt after the drop
    ["MigrateImportJobs", "applied"]]);
  assert.equal(surface.rows("migration_carry").filter((r) => r.kind === "positions").length, 1,
    "the dropped response did not double-apply the positions carry");
  assert.equal(surface.bucket.putCalls.length, 0, "the whole sequence writes nothing to R2");
  assert.equal(surface.bucket.gets.length, plan.hashSheet.expectedGetsEstimate,
    "actual GETs == the hash sheet's labeled estimate");

  const view = run.view;
  assert.equal(view.carry.ok, true, JSON.stringify(view.carry.divergences));
  assert.equal(view.carry.positions.stored.occIndex, 6);
  assert.equal(view.carry.jobs.aggregates[0].state, "parked_policy");
  assert.equal(view.carry.jobs.aggregates[0].definitionVerified, true);

  const gateCmd = buildGateCommand({ bookId, migrationId: MIG,
    certificateSha256: view.importRecord.certificateSha256 });
  const gated = await runFlipGate({ gateCommand: gateCmd, transport });
  assert.equal(gated.receipt.outcome, "applied", JSON.stringify(gated.receipt));
  assert.equal(gated.view.gate.flipped, true);
  assert.equal(surface.rows("jobs")[0].state, "parked_policy",
    "the carried job is still parked after the flip — the gate moves no jobs");
});

test("PO shape through the REAL production Worker: 6 chunks + positions + 3 superseded jobs + gate, driven by the runner; PUT 0; GETs match the estimate", async () => {
  const surface = makeProdSurface();
  const bookId = "po-shape-book";
  const { plan } = surfaceBook(surface, {
    bookId, chapterSizes: [170, 170, 170], boundCount: 510,
    limits: { maxRowsPerChunk: 100, maxChunkBytes: 64 * 1024 * 1024, maxItemBytes: 16 * 1024 * 1024 },
    positionAt: 100, positionOffset: 337.92,
    checkpoints: Array.from({ length: 28 }, (_, i) => ({ chapterIndex: i % 3, segmentIndex: i, offsetSec: i })),
    jobs: ({ occIds: ids, pairs: ps }) => [0, 1, 2].map((k) => ({
      jobId: `po-shape-remnant-${k}`, chapterIndex: k, v2State: "superseded",
      cause: "v1 remnant job (no live v1 counterpart)",
      definition: { kind: "job", bookId, chapterIndex: k, lane: "standard",
        batchJobName: null, migrationProvenance: "synthetic", statusSegments: [] },
      occurrences: [0, 1].map((j) => ({
        occurrenceId: ids[k * 2 + j], revisionKey: ps[k * 2 + j].row.revisionKey,
        state: "ready" })) })) });
  assert.equal(plan.hashSheet.chunkCount, 6);
  assert.equal(plan.hashSheet.bindingRows, 510);
  assert.equal(plan.hashSheet.expectedGetsEstimate, 510);

  const transport = workerTransport(surface);
  const run = await runBookMigration({ plan, transport });
  assert.equal(run.ok, true, JSON.stringify(run.log));
  assert.equal(run.log.length, 8, "6 chunks + positions + jobs");
  assert.equal(surface.bucket.putCalls.length, 0);
  assert.equal(surface.bucket.gets.length, plan.hashSheet.expectedGetsEstimate);
  assert.deepEqual(
    surface.rows("jobs").map((j) => j.state).sort(),
    ["superseded", "superseded", "superseded"]);
  assert.equal(run.view.carry.ok, true, JSON.stringify(run.view.carry.divergences));

  const gateCmd = buildGateCommand({ bookId, migrationId: MIG,
    certificateSha256: run.view.importRecord.certificateSha256 });
  const gated = await runFlipGate({ gateCommand: gateCmd, transport });
  assert.equal(gated.receipt.outcome, "applied", JSON.stringify(gated.receipt));
  assert.equal(gated.view.gate.flipped, true);
});

test("operator fence on the new commands: the carry commands without the operator credential are refused at the production entry and record nothing", async () => {
  const surface = makeProdSurface();
  const bookId = "fence-book";
  const { plan } = surfaceBook(surface, {
    bookId, chapterSizes: [4], boundCount: 4,
    limits: { maxRowsPerChunk: 64, maxChunkBytes: 64 * 1024 * 1024, maxItemBytes: 16 * 1024 * 1024 },
    positionAt: 0, positionOffset: 0, checkpoints: [], jobs: [] });
  const positions = plan.commands.find((c) => c.type === "MigrateImportPositions");
  for (const operator of [undefined, "wrong-operator-token"]) {
    const res = await surface.call("/v2/commands",
      { method: "POST", operator, body: positions });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error, "migration_operator_required");
  }
  assert.equal(surface.rows("commands").length, 0,
    "a fenced command is refused before the coordinator records anything");
  // And with the operator credential the same payload is admitted
  // (it then refuses on its merits — the import has not run —
  // proving admission, not success, is what the fence controls).
  const res = await surface.call("/v2/commands",
    { method: "POST", operator: PROD_OPERATOR, body: positions });
  assert.equal(res.status, 200);
  const receipt = await res.json();
  assert.equal(receipt.outcome, "rejected");
  assert.equal(receipt.element, "import_incomplete");
});

test("driver discipline: a digest-pending chunk is never sent; a durable rejection halts the book with no retry and no repair", async () => {
  const surface = makeProdSurface();
  const bookId = "driver-book";
  const built = surfaceBook(surface, {
    bookId, chapterSizes: [4], boundCount: 4,
    limits: { maxRowsPerChunk: 64, maxChunkBytes: 64 * 1024 * 1024, maxItemBytes: 16 * 1024 * 1024 },
    positionAt: 0, positionOffset: 0, checkpoints: [], jobs: [] });
  // Strip the digests: the plan now carries digest-pending rows.
  const pendingPlan = { ...built.plan, commands: built.plan.commands.map((c) =>
    c.type === "MigrateImportChunk"
      ? { ...c, payload: { ...c.payload, rows: c.payload.rows.map((r) => ({ ...r, manifest: { ...r.manifest, sha256: null } })) } }
      : c) };
  const transport = workerTransport(surface);
  const refused = await runBookMigration({ plan: pendingPlan, transport });
  assert.equal(refused.ok, false);
  assert.equal(refused.reason, "digest_pending");
  assert.equal(surface.rows("commands").length, 0, "nothing was sent");

  // Durable rejection: tamper the positions payload (offset
  // diverges from the pin) — the coordinator refuses durably and
  // the driver halts at the rejection, sending nothing further.
  const tampered = { ...built.plan, commands: built.plan.commands.map((c) =>
    c.type === "MigrateImportPositions"
      ? { ...c, payload: { ...c.payload,
          position: { ...c.payload.position, offsetSec: c.payload.position.offsetSec + 1 } } }
      : c) };
  const halted = await runBookMigration({ plan: tampered, transport });
  assert.equal(halted.ok, false);
  assert.equal(halted.haltedAt, `${MIG}:${bookId}:positions`);
  assert.equal(halted.receipt.reason, "migration_carry_mismatch");
  assert.equal(halted.log.length, 2, "chunk applied, positions refused, jobs never sent");
  assert.equal(surface.rows("migration_gates").length, 0);
});
