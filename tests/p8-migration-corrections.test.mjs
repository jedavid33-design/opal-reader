// P8 migration-import CORRECTIONS (Rowan re-review 6354569652):
// G1 lazy/request-scoped R2 reads through the REAL Worker path,
// G2 operator-only admission + pinned approved freeze, G3
// server-derived certificate, G4 exact bidirectional gate.
//
// Synthetic data only; the operator credential below is an obvious
// test fake. Nothing here touches a network or a real bucket.
import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import workerEntry, { OpalReaderCoordinator } from "../v2/worker-entry.js";
import {
  attestationFor, gateCmd, importCmd, makeWorld, pinnedEntry, seedRow,
  sha256Hex, syntheticBytes, v1Meta,
} from "./helpers/migration-fixtures.mjs";

const MIG = "migration-2026-10-freeze";
const FREEZE = "freeze-digest-synthetic";
const CLIENT_TOKEN = "test-client-token";
const OPERATOR_TOKEN = "test-operator-token"; // obvious fake
const PAGES_ORIGIN = "https://jedavid33-design.github.io";

// ------------------------------------------------------------ fakes
// A DO-shaped state over real SQLite (same SqlCursor discipline as
// tests/helpers/do-harness.mjs — `.one()` throws unless exactly
// one row, as production does).
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

// A counting R2-shaped bucket: records every GET (key + bytes).
class CountingBucket {
  constructor() { this.map = new Map(); this.gets = []; this.putCalls = []; }
  seed(key, bytes, meta = {}) {
    this.map.set(key, { bytes: new Uint8Array(bytes),
      customMetadata: meta, httpMetadata: { contentType: "audio/mpeg" } });
  }
  async get(key) {
    const e = this.map.get(key);
    this.gets.push({ key, bytes: e ? e.bytes.byteLength : 0 });
    if (!e) return null;
    return { arrayBuffer: async () => e.bytes.slice().buffer,
             customMetadata: e.customMetadata, httpMetadata: e.httpMetadata,
             etag: `"etag:${key}"`, size: e.bytes.byteLength };
  }
  async put(key, bytes, opts = {}) {
    this.putCalls.push(key);
    this.map.set(key, { bytes: new Uint8Array(bytes),
      customMetadata: opts.customMetadata || {}, httpMetadata: opts.httpMetadata || {} });
  }
  resetGets() { this.gets = []; }
  get totalBytes() { return this.gets.reduce((n, g) => n + g.bytes, 0); }
  get keys() { return this.gets.map(g => g.key); }
}

// A worker world: the real workerEntry.fetch in front of the real
// OpalReaderCoordinator DO class over the counting bucket, with a
// synthetic pinned freeze injected as DO deployment configuration.
function makeWorkerWorld({ operatorToken = OPERATOR_TOKEN, manifest } = {}) {
  const bucket = new CountingBucket();
  const state = makeDoState();
  const doEnv = {
    OPALREADER_V2_SCOPE: "staging-smoke",
    OPALREADER_ACCESS_TOKEN: CLIENT_TOKEN,
    GENERATION_HALT: "1",
    R2_KEY_PREFIX: "smoke-p8/",
    OPALREADER_STORAGE: bucket,
    PAGES_ORIGIN,
    approvedFreezeManifest: manifest,
  };
  const instance = new OpalReaderCoordinator(state, doEnv);
  const namespace = {
    idFromName: (name) => name,
    get: () => ({ fetch: (req) => instance.fetch(req) }),
  };
  const env = {
    OPALREADER_ACCESS_TOKEN: CLIENT_TOKEN,
    OPALREADER_V2_SCOPE: "staging-smoke",
    COORDINATOR: namespace,
    PAGES_ORIGIN,
    ...(operatorToken == null ? {} : { OPALREADER_MIGRATION_OPERATOR_TOKEN: operatorToken }),
  };
  const call = (path, { method = "GET", body, operator, token = CLIENT_TOKEN, headers = {} } = {}) =>
    workerEntry.fetch(new Request(`https://opalreader-api-v2.test${path}`, {
      method,
      headers: { "x-opalreader-token": token, "x-opalreader-scope": "staging-smoke",
        "x-opalreader-instance": "smoke-p8", Origin: PAGES_ORIGIN,
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(operator !== undefined ? { "x-opalreader-operator-token": operator } : {}),
        ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }), env);
  const commandCount = () =>
    state.storage.sql.exec(`SELECT COUNT(*) AS c FROM commands`).toArray()[0].c;
  return { bucket, state, instance, env, call, commandCount };
}

// One synthetic book for the worker path: rows whose objects live
// under the smoke prefix, pinned into the manifest.
function workerBook(bucket, manifest, bookId, sizes) {
  const pairs = [], rows = [], contentIds = [];
  sizes.forEach((size, i) => {
    const occurrenceId = `${bookId}-o${i + 1}`;
    const bytes = new Uint8Array(size).fill(65 + i);
    const sha = sha256Hex(bytes);
    const objectKey = `smoke-p8/audio/${sha}.mp3`;
    bucket.seed(objectKey, bytes, v1Meta("mp3"));
    const row = { occurrenceId, revisionKey: sha, cacheKey: sha,
      manifest: { sha256: sha, size, format: "mp3" } };
    rows.push(row); contentIds.push(occurrenceId);
    pairs.push({ row, etag: `"etag:${objectKey}"` });
  });
  manifest.books[bookId] = pinnedEntry(pairs);
  return { rows, content: { title: bookId, occurrenceIds: contentIds } };
}
const importBody = (id, bookId, book) => ({ command_id: id, type: "MigrateImportBindings",
  payload: { migrationId: MIG, freezeDigest: FREEZE, bookId,
             content: book.content, rows: book.rows } });
const gateBody = (id, bookId, certificateSha256) => ({ command_id: id, type: "MigrateRecordFlipGate",
  payload: { migrationId: MIG, bookId, certificateSha256 } });

// Option D two-phase send through the worker world: submit under
// the client credential alone; a durable submit refusal is itself
// the final receipt; otherwise approve the server-returned hash
// under the operator credential and return the final receipt.
const postMigration = async (w, body) => {
  const sub = await w.call("/v2/commands", { method: "POST", body });
  const first = await sub.json();
  if (first.state !== "pending_operator") return first;
  const app = await w.call("/v2/command-approvals", { method: "POST", operator: OPERATOR_TOKEN,
    body: { commandId: body.command_id, payloadSha256: first.payloadSha256 } });
  return app.json();
};

// ============================================================== G1
test("G1 worker path: imports fetch only their own book's bytes; read-only surfaces fetch ZERO audio", async () => {
  const manifest = { snapshotDigest: FREEZE, books: {} };
  const w = makeWorkerWorld({ manifest });
  const MIB = 1024 * 1024;
  const book1 = workerBook(w.bucket, manifest, "g1-book-1", [4 * MIB, 3 * MIB, 2 * MIB]);
  const book2 = workerBook(w.bucket, manifest, "g1-book-2", [1 * MIB, MIB / 2]);
  const book1Bytes = 9 * MIB, book2Bytes = Math.floor(1.5 * MIB);
  const book1Keys = book1.rows.map(r => `smoke-p8/audio/${r.cacheKey}.mp3`).sort();
  const book2Keys = book2.rows.map(r => `smoke-p8/audio/${r.cacheKey}.mp3`).sort();

  // Import book 1 through the real worker entry + DO class.
  w.bucket.resetGets();
  const imp1Body = await postMigration(w, importBody("g1-imp-1", "g1-book-1", book1));
  assert.equal(imp1Body.outcome, "applied", JSON.stringify(imp1Body));
  assert.deepEqual(w.bucket.keys.sort(), book1Keys);       // exactly its own objects
  assert.equal(w.bucket.totalBytes, book1Bytes);            // and nothing else's
  assert.ok(w.bucket.totalBytes < book1Bytes + book2Bytes,
    "one book's import stays below the two-book corpus in this world");

  // Every read-only surface now answers with ZERO audio GETs.
  w.bucket.resetGets();
  for (const [path, opts] of [
    ["/v2/settings", {}],
    ["/v2/quota", {}],
    ["/v2/sync/snapshot?family=bindings", {}],
    ["/v2/migration/book/g1-book-1", {}],
  ]) {
    const res = await w.call(path, opts);
    assert.equal(res.status, 200, path);
    await res.json();
  }
  const view = await (await w.call("/v2/migration/book/g1-book-1")).json();
  assert.equal(view.completeness.complete, true);
  const gate = await postMigration(w,
    gateBody("g1-gate-1", "g1-book-1", imp1Body.certificate.certificateSha256));
  assert.equal(gate.outcome, "applied");
  assert.equal(w.bucket.gets.length, 0, `read-only surfaces fetched audio: ${JSON.stringify(w.bucket.gets)}`);
  assert.equal(w.bucket.totalBytes, 0);

  // The cache factory itself hydrates nothing (bounded resident).
  const freshCache = await w.instance._cache();
  assert.deepEqual(freshCache.stats(), { entries: 0, residentBytes: 0 });

  // Successive import: book 2's import does NOT re-fetch book 1.
  w.bucket.resetGets();
  const imp2 = await postMigration(w, importBody("g1-imp-2", "g1-book-2", book2));
  assert.equal(imp2.outcome, "applied");
  assert.deepEqual(w.bucket.keys.sort(), book2Keys);
  assert.equal(w.bucket.totalBytes, book2Bytes);

  // Byte-check still works and costs exactly its one named key.
  w.bucket.resetGets();
  const bc = await w.call(`/v2/sync/byte-check/${book1.rows[0].cacheKey}`);
  assert.equal(bc.status, 200);
  assert.equal((await bc.json()).exists, true);
  assert.deepEqual(w.bucket.keys, [`smoke-p8/audio/${book1.rows[0].cacheKey}.mp3`]);

  // AdoptAudio through the worker path: the command's own named
  // key is hydrated on demand; the rest of the corpus is not.
  const adoptBytes = syntheticBytes("g1-adopt");
  const adoptSha = sha256Hex(adoptBytes);
  w.bucket.seed(`smoke-p8/audio/${adoptSha}.mp3`, adoptBytes,
    { ...v1Meta("mp3"), identity: "fp-g1-adopt" });
  await w.call("/v2/commands", { method: "POST", body: { command_id: "g1-sync-1",
    type: "SyncPush", payload: { bookId: "g1-book-3", baseTip: null, changes: [
      { family: "books", entityId: "g1-book-3", data: { title: "G1 Three" } },
      { family: "occurrences", entityId: "g1-o1", bookId: "g1-book-3",
        data: { chapterIndex: 0 } } ] } } });
  w.bucket.resetGets();
  const adopt = await w.call("/v2/commands", { method: "POST", body: { command_id: "g1-adopt-1",
    type: "AdoptAudio", payload: { occurrenceId: "g1-o1", revisionKey: "fp-g1-adopt",
    cacheKey: adoptSha } } });
  const adoptBody = await adopt.json();
  assert.equal(adoptBody.outcome, "applied", JSON.stringify(adoptBody));
  assert.deepEqual(w.bucket.keys, [`smoke-p8/audio/${adoptSha}.mp3`]);
  assert.equal(w.bucket.putCalls.length, 0);
});

// ============================================================== G2
test("G2 worker entry (Option D): submits pend under the client credential; approvals are operator-only and fail closed", async () => {
  const manifest = { snapshotDigest: FREEZE, books: {} };
  const w = makeWorkerWorld({ manifest });
  const book = workerBook(w.bucket, manifest, "g2-book", [128]);

  // Ordinary client token, no operator credential → the command
  // PENDS. Nothing has executed: no commands row.
  let res = await w.call("/v2/commands", { method: "POST", body: importBody("g2-a", "g2-book", book) });
  assert.equal(res.status, 200);
  const pendA = await res.json();
  assert.equal(pendA.state, "pending_operator");
  assert.equal(w.commandCount(), 0);
  // A client-forged admission mark is worthless: the submit
  // behaves exactly like a plain submit (it pends), and a forged
  // mark on the approval route admits nothing.
  res = await w.call("/v2/commands", { method: "POST", body: importBody("g2-b", "g2-book", book),
    headers: { "x-opalreader-operator-admitted": "1" } });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).state, "pending_operator");
  assert.equal(w.commandCount(), 0);
  res = await w.call("/v2/command-approvals", { method: "POST",
    headers: { "x-opalreader-operator-admitted": "1" },
    body: { commandId: "g2-a", payloadSha256: pendA.payloadSha256 } });
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error, "migration_operator_required");
  assert.equal(w.commandCount(), 0);
  // Wrong operator credential on the approval route → 403.
  res = await w.call("/v2/command-approvals", { method: "POST", operator: "test-operator-WRONG",
    body: { commandId: "g2-a", payloadSha256: pendA.payloadSha256 } });
  assert.equal(res.status, 403);
  assert.equal(w.commandCount(), 0);
  // Approval under the correct operator credential → the import
  // applies exactly once.
  res = await w.call("/v2/command-approvals", { method: "POST", operator: OPERATOR_TOKEN,
    body: { commandId: "g2-a", payloadSha256: pendA.payloadSha256 } });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).outcome, "applied");
  assert.equal(w.commandCount(), 1);

  // Operator credential UNSET → approvals are 503 fail-closed,
  // even presenting one; the submit itself still pends.
  const wUnset = makeWorkerWorld({ operatorToken: null, manifest });
  res = await wUnset.call("/v2/commands", { method: "POST", body: importBody("g2-e", "g2-book", book) });
  assert.equal(res.status, 200);
  const pendE = await res.json();
  res = await wUnset.call("/v2/command-approvals", { method: "POST", operator: OPERATOR_TOKEN,
    body: { commandId: "g2-e", payloadSha256: pendE.payloadSha256 } });
  assert.equal(res.status, 503);
  assert.equal((await res.json()).error, "migration_operator_not_configured");
  assert.equal(wUnset.commandCount(), 0);
  // Operator credential EQUAL to the client token → still closed:
  // a shared value is not a distinct credential.
  const wShared = makeWorkerWorld({ operatorToken: CLIENT_TOKEN, manifest });
  res = await wShared.call("/v2/commands", { method: "POST", body: importBody("g2-f", "g2-book", book) });
  const pendF = await res.json();
  res = await wShared.call("/v2/command-approvals", { method: "POST", operator: CLIENT_TOKEN,
    body: { commandId: "g2-f", payloadSha256: pendF.payloadSha256 } });
  assert.equal(res.status, 503);
  assert.equal(wShared.commandCount(), 0);

  // API-layer fence: an approval request that reaches the DO
  // without the entry's admission mark is refused before anything
  // executes — the internal headers alone do not admit it.
  const direct = await w.instance.fetch(new Request("https://do.test/v2/command-approvals", {
    method: "POST",
    headers: { "x-opalreader-internal": "1", "x-opalreader-scope": "staging-smoke",
      "content-type": "application/json" },
    body: JSON.stringify({ commandId: "g2-b", payloadSha256: "0".repeat(64) }) }));
  assert.equal(direct.status, 403);
  assert.equal((await direct.json()).error, "migration_operator_required");
  assert.equal(w.commandCount(), 1); // still only the approved one
});

test("G2 pinned freeze: caller input may only MATCH the approved freeze, never define it", async () => {
  const manifest = { snapshotDigest: FREEZE, books: {} };
  const w = makeWorkerWorld({ manifest });
  const book = workerBook(w.bucket, manifest, "g2-pin-book", [64, 96]);
  const post = (body) => postMigration(w, body);

  // Unapproved freeze digest (self-consistent caller claim).
  let body = await post({ ...importBody("g2p-a", "g2-pin-book", book),
    payload: { ...importBody("g2p-a", "g2-pin-book", book).payload, freezeDigest: "freeze-of-my-own" } });
  assert.equal(body.outcome, "rejected");
  assert.equal(body.reason, "migration_freeze_unapproved");
  // A book outside the approved freeze.
  body = await post(importBody("g2p-b", "g2-other-book",
    { rows: book.rows, content: { title: "X", occurrenceIds: book.content.occurrenceIds } }));
  assert.equal(body.outcome, "rejected");
  assert.equal(body.reason, "migration_freeze_unapproved");
  // One row's size redefined by the caller.
  const resized = book.rows.map((r, i) => i === 0
    ? { ...r, manifest: { ...r.manifest, size: r.manifest.size + 1 } } : r);
  body = await post({ command_id: "g2p-c", type: "MigrateImportBindings",
    payload: { migrationId: MIG, freezeDigest: FREEZE, bookId: "g2-pin-book",
               content: book.content, rows: resized } });
  assert.equal(body.outcome, "rejected");
  assert.equal(body.reason, "migration_manifest_mismatch");
  // A row set replayed from another book's manifest (extra row).
  const extended = [...book.rows, { occurrenceId: "g2-pin-book-oX",
    revisionKey: book.rows[0].revisionKey, cacheKey: book.rows[0].cacheKey,
    manifest: book.rows[0].manifest }];
  body = await post({ command_id: "g2p-d", type: "MigrateImportBindings",
    payload: { migrationId: MIG, freezeDigest: FREEZE, bookId: "g2-pin-book",
               content: { title: "g2-pin-book", occurrenceIds: [...book.content.occurrenceIds, "g2-pin-book-oX"] },
               rows: extended } });
  assert.equal(body.outcome, "rejected");
  assert.equal(body.reason, "migration_manifest_mismatch");
  // The exact pinned rows import cleanly.
  body = await post(importBody("g2p-e", "g2-pin-book", book));
  assert.equal(body.outcome, "applied");
});

// ============================================================== G3
test("G3: only the coordinator-anchored certificate opens the gate", async () => {
  const { bucket, coord, pinBook } = makeWorld();
  const a = seedRow(bucket, { bookId: "g3-a", occurrenceId: "o1" });
  const b = seedRow(bucket, { bookId: "g3-b", occurrenceId: "o1b" });
  pinBook("g3-a", [{ row: a.row, etag: a.etag }]);
  pinBook("g3-b", [{ row: b.row, etag: b.etag }]);
  const impA = await coord.handleCommand(importCmd("g3-ia", { migrationId: MIG,
    freezeDigest: FREEZE, bookId: "g3-a", content: { title: "A", occurrenceIds: ["o1"] }, rows: [a.row] }));
  const impB = await coord.handleCommand(importCmd("g3-ib", { migrationId: MIG,
    freezeDigest: FREEZE, bookId: "g3-b", content: { title: "B", occurrenceIds: ["o1b"] }, rows: [b.row] }));
  const certA = impA.certificate.certificateSha256;
  assert.match(certA, /^[0-9a-f]{64}$/);
  assert.notEqual(certA, impB.certificate.certificateSha256);
  // The anchored digest is visible on the read-back view.
  assert.equal(coord.migrationBookView("g3-a").importRecord.certificateSha256, certA);
  assert.equal(coord.migrationBookView("g3-a").pinnedFreeze.inApprovedFreeze, true);

  const attempt = (id, bookId, certificateSha256, migrationId = MIG) =>
    coord.handleCommand(gateCmd(id, { migrationId, bookId, certificateSha256 }));
  // Arbitrary string — the pre-correction tests' own literal shape.
  let g = await attempt("g3-1", "g3-a", "cert-j");
  assert.deepEqual([g.outcome, g.reason], ["rejected", "flip_gate_certificate_mismatch"]);
  // Well-formed but wrong digest.
  g = await attempt("g3-2", "g3-a", "0".repeat(64));
  assert.equal(g.reason, "flip_gate_certificate_mismatch");
  // Another book's genuine certificate.
  g = await attempt("g3-3", "g3-a", impB.certificate.certificateSha256);
  assert.equal(g.reason, "flip_gate_certificate_mismatch");
  // The right certificate under another migration id certifies nothing.
  g = await attempt("g3-4", "g3-a", certA, "migration-other");
  assert.equal(g.outcome, "rejected");
  assert.equal(g.reason, "flip_gate_incomplete");
  // The anchored certificate itself: applied, then idempotent.
  g = await attempt("g3-5", "g3-a", certA);
  assert.equal(g.outcome, "applied");
  g = await attempt("g3-6", "g3-a", certA);
  assert.deepEqual([g.outcome, g.idempotent], ["applied", true]);
});

// ============================================================== G4
// One clean world per mutation: a 3-row book (fingerprinted,
// fingerprinted-distinct with attestation, fingerprinted) plus one
// content occurrence deliberately left unbound.
async function g4World() {
  const w = makeWorld();
  const { bucket, coord, pinBook, harness: h } = w;
  const bookId = "g4-book";
  const fp = seedRow(bucket, { bookId, occurrenceId: "o1" });
  const di = seedRow(bucket, { bookId, occurrenceId: "o2", form: "distinct" });
  di.row.provenanceAttestation = attestationFor(di, { bookId, freezeDigest: FREEZE });
  const fp2 = seedRow(bucket, { bookId, occurrenceId: "o3" });
  const rows = [fp.row, di.row, fp2.row];
  pinBook(bookId, [{ row: fp.row, etag: fp.etag }, { row: di.row, etag: di.etag },
                   { row: fp2.row, etag: fp2.etag }]);
  const imp = await coord.handleCommand(importCmd("g4-imp", { migrationId: MIG,
    freezeDigest: FREEZE, bookId,
    content: { title: "G4", occurrenceIds: ["o1", "o2", "o3", "oU"] }, rows }));
  assert.equal(imp.outcome, "applied", JSON.stringify(imp));
  return { ...w, bookId, rows, cert: imp.certificate.certificateSha256,
           fp, di, fp2 };
}
const g4Gate = (w, id = "g4-gate") => w.coord.handleCommand(gateCmd(id, {
  migrationId: MIG, bookId: w.bookId, certificateSha256: w.cert }));

test("G4 baseline: the unmutated import gates", async () => {
  const w = await g4World();
  assert.equal((await g4Gate(w)).outcome, "applied");
});

const G4_MUTATIONS = [
  ["extra sync row", (w) => {
    w.harness.db.prepare(`INSERT INTO sync_entities (family, entity_key, book_id, revision, deleted, data_json)
      VALUES ('bindings', ?, ?, 1, 0, ?)`).run(`${w.bookId}:zz`, w.bookId,
      JSON.stringify({ cacheKey: "zz", revisionKey: "zz", sha256: "0".repeat(64),
                       format: "mp3", size: 1, provenance: "migration" })); }],
  ["extra SQL row for an unbound content occurrence", (w) => {
    w.harness.db.prepare(`INSERT INTO bindings (occurrence_id, revision_key, cache_key, provenance, bound_at)
      VALUES ('oU', ?, ?, 'migration', 0)`).run(w.fp.revisionKey, w.fp.cacheKey); }],
  ["wrong sync revisionKey", (w) => {
    const key = `${w.bookId}:o1`;
    const row = w.harness.db.prepare(`SELECT data_json FROM sync_entities
      WHERE family='bindings' AND entity_key=?`).get(key);
    const data = JSON.parse(row.data_json); data.revisionKey = "fp-tampered";
    w.harness.db.prepare(`UPDATE sync_entities SET data_json=? WHERE family='bindings' AND entity_key=?`)
      .run(JSON.stringify(data), key); }],
  ["changed index format", (w) => {
    w.harness.db.prepare(`UPDATE cache_index SET format='wav' WHERE cache_key=?`).run(w.fp.cacheKey); }],
  ["changed size (sync plane)", (w) => {
    const key = `${w.bookId}:o3`;
    const row = w.harness.db.prepare(`SELECT data_json FROM sync_entities
      WHERE family='bindings' AND entity_key=?`).get(key);
    const data = JSON.parse(row.data_json); data.size += 7;
    w.harness.db.prepare(`UPDATE sync_entities SET data_json=? WHERE family='bindings' AND entity_key=?`)
      .run(JSON.stringify(data), key); }],
  ["missing provenance audit row", (w) => {
    w.harness.db.prepare(`DELETE FROM migration_audit WHERE book_id=? AND occurrence_id='o2'`).run(w.bookId); }],
  ["tampered provenance audit row", (w) => {
    const row = w.harness.db.prepare(`SELECT attestation_json FROM migration_audit
      WHERE book_id=? AND occurrence_id='o2'`).get(w.bookId);
    const att = JSON.parse(row.attestation_json); att.size += 1;
    w.harness.db.prepare(`UPDATE migration_audit SET attestation_json=? WHERE book_id=? AND occurrence_id='o2'`)
      .run(JSON.stringify(att), w.bookId); }],
  ["foreign-migration audit row", (w) => {
    w.harness.db.prepare(`UPDATE migration_audit SET migration_id='migration-other'
      WHERE book_id=? AND occurrence_id='o2'`).run(w.bookId); }],
  ["partial import (one SQL binding deleted)", (w) => {
    w.harness.db.prepare(`DELETE FROM bindings WHERE occurrence_id='o3'`).run(); }],
  ["unexpected tombstone in the sync plane", (w) => {
    w.harness.db.prepare(`INSERT INTO sync_entities (family, entity_key, book_id, revision, deleted, data_json)
      VALUES ('bindings', ?, ?, 1, 1, '{}')`).run(`${w.bookId}:oT`, w.bookId); }],
];
for (const [name, mutate] of G4_MUTATIONS) {
  test(`G4 mutation refuses the gate: ${name}`, async () => {
    const w = await g4World();
    mutate(w);
    const view = w.coord.migrationBookView(w.bookId);
    assert.equal(view.completeness.complete, false, name);
    const g = await g4Gate(w);
    assert.equal(g.outcome, "rejected", name);
    assert.equal(g.reason, "flip_gate_incomplete", name);
  });
}

// ================================================ import identity
test("consistency: the per-book import identity pins migrationId, freezeDigest, size, format", async () => {
  const { bucket, coord, pinBook } = makeWorld();
  const s = seedRow(bucket, { bookId: "cc-book", occurrenceId: "o1" });
  pinBook("cc-book", [{ row: s.row, etag: s.etag }]);
  const imp = await coord.handleCommand(importCmd("cc-1", { migrationId: MIG,
    freezeDigest: FREEZE, bookId: "cc-book", content: { title: "CC", occurrenceIds: ["o1"] }, rows: [s.row] }));
  assert.equal(imp.outcome, "applied");
  // Same rows under a DIFFERENT migration id: divergence, even
  // though every row field matches.
  let r = await coord.handleCommand(importCmd("cc-2", { migrationId: "migration-second",
    freezeDigest: FREEZE, bookId: "cc-book", content: { title: "CC", occurrenceIds: ["o1"] }, rows: [s.row] }));
  assert.deepEqual([r.outcome, r.reason], ["rejected", "migration_book_divergence"]);
  // After the gate exists, the fence still holds.
  const g = await coord.handleCommand(gateCmd("cc-g", { migrationId: MIG, bookId: "cc-book",
    certificateSha256: imp.certificate.certificateSha256 }));
  assert.equal(g.outcome, "applied");
  r = await coord.handleCommand(importCmd("cc-3", { migrationId: "migration-second",
    freezeDigest: FREEZE, bookId: "cc-book", content: { title: "CC", occurrenceIds: ["o1"] }, rows: [s.row] }));
  assert.deepEqual([r.outcome, r.reason], ["rejected", "migration_book_divergence"]);
  // A faithful replay under the same identity still converges.
  r = await coord.handleCommand(importCmd("cc-4", { migrationId: MIG,
    freezeDigest: FREEZE, bookId: "cc-book", content: { title: "CC", occurrenceIds: ["o1"] }, rows: [s.row] }));
  assert.equal(r.outcome, "applied");
  assert.equal(r.certificate.rows[0].status, "accepted_idempotent");
});
