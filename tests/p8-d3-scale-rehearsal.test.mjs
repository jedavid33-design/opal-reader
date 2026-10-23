// Opal Reader v2 — P8 D3: the full-corpus CHUNKED scale rehearsal.
//
// The migration rehearsal's audit shape — 7 books, 1,799 rows;
// 1,148 fingerprinted, 31 fingerprinted-distinct (29 + 2 in the
// two affected books), 620 legacy anchors; 1,798 unique objects
// with one shared key — imported this time through the D3 chunked
// path (MigrateImportChunk under the code limits), into a
// genuinely cold coordinator. Every book completes, derives its
// one whole-book certificate from its chunks' evidence, and
// passes the EXISTING flip gate; all 31 attestation rows flow
// through chunking with provenance intact; the three retry cases
// are exercised at scale; bucket PUTs stay zero throughout. All
// data is synthetic — keys, digests, bytes (the byte-SCALE proof
// at the corpus' real sizes lives in
// tests/p8-d3-resource-proofs.test.mjs).
import test from "node:test";
import assert from "node:assert/strict";
import {
  attestationFor, chunkCmd, gateCmd, makeWorld, seedRow, syntheticBytes, v1Meta,
} from "./helpers/migration-fixtures.mjs";
import { APPROVED_FREEZE_CHUNKS } from "../v2/p8/approved-freeze-chunks.mjs";

const MIG = "mig-d3-scale";
const FREEZE = "freeze-digest-synthetic-scale";

const BOOKS = [
  { bookId: "syn-finding-home",    rows: 152, legacy: 52,  distinct: 0 },
  { bookId: "syn-forever-pucked",  rows: 50,  legacy: 17,  distinct: 0 },
  { bookId: "syn-in-her-own-league", rows: 203, legacy: 70, distinct: 0 },
  { bookId: "syn-pucked",          rows: 307, legacy: 106, distinct: 0 },
  { bookId: "syn-pucked-over",     rows: 510, legacy: 176, distinct: 2 },
  { bookId: "syn-pucked-up",       rows: 467, legacy: 161, distinct: 29 },
  { bookId: "syn-the-goal",        rows: 110, legacy: 38,  distinct: 0 },
];
const cmdId = (bookId, n, gen) => `${MIG}:${bookId}:chunk:${n}` + (gen ? `:g${gen}` : "");

function buildBook(bucket, spec) {
  const rows = [], pairs = [], seededByOcc = new Map();
  let sharedSeeded = null;
  for (let i = 0; i < spec.rows; i++) {
    const occurrenceId = `${spec.bookId}-seg-${String(i + 1).padStart(3, "0")}`;
    const form = i < spec.distinct ? "distinct"
      : i < spec.distinct + spec.legacy ? "legacy" : "fingerprinted";
    const format = i % 5 === 4 ? "wav" : "mp3";
    let seeded;
    if (spec.bookId === "syn-pucked-up" && i === spec.rows - 1 && sharedSeeded) {
      seeded = sharedSeeded;
    } else {
      seeded = seedRow(bucket, { bookId: spec.bookId, occurrenceId, form, format });
      if (spec.bookId === "syn-pucked-up" && i === spec.rows - 2) sharedSeeded = seeded;
    }
    const row = { ...seeded.row, occurrenceId };
    if (form === "distinct")
      row.provenanceAttestation = attestationFor(
        { ...seeded, row }, { bookId: spec.bookId, freezeDigest: FREEZE });
    rows.push(row);
    seededByOcc.set(occurrenceId, seeded);
    pairs.push({ row, etag: seeded.etag });
  }
  const unbound = [`${spec.bookId}-unbound-1`, `${spec.bookId}-unbound-2`];
  const content = { title: spec.bookId,
    occurrenceIds: [...rows.map(r => r.occurrenceId), ...unbound] };
  return { rows, pairs, content, seededByOcc };
}

test("scale rehearsal: 1,799 synthetic bindings import CHUNKED cold, certify per book, gate — with zero storage writes and the retry cases exercised at scale", async () => {
  const { bucket, harness: h, coord, pinBookChunks, chunksManifest } =
    makeWorld({ freezeDigest: FREEZE });
  const world = BOOKS.map(spec => ({ spec, ...buildBook(bucket, spec) }));
  const totalRows = world.reduce((n, b) => n + b.rows.length, 0);
  assert.equal(totalRows, 1799);
  assert.equal(bucket.map.size, 1798); // one shared object, as audited
  const bucketDigestBefore = bucket.digestAll();
  assert.equal(h.rows("cache_index").length, 0); // genuinely cold

  let accepted = 0, provenance = 0, totalChunks = 0;
  const partitionCounts = {};
  for (const book of world) {
    pinBookChunks(book.spec.bookId, book.pairs); // code limits: 100 rows/chunk here
    const pin = chunksManifest.books[book.spec.bookId];
    partitionCounts[book.spec.bookId] = pin.chunkCount;
    totalChunks += pin.chunkCount;
    let last = null;
    for (const c of pin.chunks) {
      const slice = book.rows.slice(c.start, c.start + c.rowCount);
      const getsBefore = bucket.getCalls;
      const res = await coord.handleCommand(chunkCmd(cmdId(book.spec.bookId, c.index), {
        migrationId: MIG, freezeDigest: FREEZE, bookId: book.spec.bookId,
        chunkIndex: c.index, content: c.index === 0 ? book.content : undefined,
        rows: slice }));
      assert.equal(res.outcome, "applied",
        `${book.spec.bookId} chunk ${c.index}: ${JSON.stringify(res.certificate?.rows?.find(r => r.status === "blocked") ?? res)}`);
      // Per-chunk GET discipline: exactly this chunk's unique
      // objects, with the WAV probe multiplier (a wav object costs
      // a missed mp3 probe plus the wav hit; an mp3 object costs
      // one GET). The book's one shared key is primed once.
      const uniqueByKey = new Map(slice.map(r => [r.cacheKey, r]));
      const expectedGets = [...uniqueByKey.values()]
        .reduce((n, r) => n + (r.manifest.format === "wav" ? 2 : 1), 0);
      assert.equal(bucket.getCalls - getsBefore, expectedGets,
        `${book.spec.bookId} chunk ${c.index} GET count`);
      accepted += res.certificate.totals.accepted;
      provenance += res.certificate.totals.acceptedProvenance;
      last = res;

      // Retry case (b) at scale: replay this chunk's command id —
      // stored receipt, zero further GETs.
      if (book.spec.bookId === "syn-the-goal" && c.index === 0) {
        const g = bucket.getCalls;
        const replay = await coord.handleCommand(chunkCmd(cmdId(book.spec.bookId, 0), {
          migrationId: MIG, freezeDigest: FREEZE, bookId: book.spec.bookId,
          chunkIndex: 0, content: book.content, rows: slice }));
        assert.equal(replay.replayed, true);
        assert.equal(replay.outcome, "applied");
        assert.equal(bucket.getCalls, g);
      }
      // Retry case (a) at scale: a response lost in transport —
      // the same id resolves to the true (applied) outcome.
      if (book.spec.bookId === "syn-finding-home" && c.index === 0) {
        const again = await coord.handleCommand(chunkCmd(cmdId(book.spec.bookId, 0), {
          migrationId: MIG, freezeDigest: FREEZE, bookId: book.spec.bookId,
          chunkIndex: 0, content: book.content, rows: slice }));
        assert.equal(again.replayed, true);
        assert.equal(again.outcome, "applied");
      }
    }
    assert.equal(last.bookComplete, true, book.spec.bookId);
    const view = coord.migrationBookView(book.spec.bookId);
    assert.equal(view.completeness.complete, true, book.spec.bookId);
    assert.equal(view.importRecord.certificateSha256, last.certificateSha256);
    assert.equal(view.chunkedImport.complete, true);
    const gate = await coord.handleCommand(gateCmd(`scale-gate-${book.spec.bookId}`, {
      migrationId: MIG, bookId: book.spec.bookId,
      certificateSha256: last.certificateSha256 }));
    assert.equal(gate.outcome, "applied", book.spec.bookId);
  }
  assert.equal(accepted + provenance, 1799);
  assert.equal(provenance, 31, "all 31 attestation rows flowed through chunking");
  assert.equal(h.rows("bindings").length, 1799);
  assert.equal(h.rows("cache_index").length, 1798); // shared key anchored once
  assert.equal(h.rows("migration_audit").length, 31);
  assert.equal(h.rows("migration_gates").length, 7);
  assert.equal(h.rows("migration_chunks").length, totalChunks);
  console.log(`  [scale] partition counts (row-cap-bound, small bytes): ${JSON.stringify(partitionCounts)}; total chunks ${totalChunks}`);
  assert.equal(bucket.putCalls.length, 0);
  assert.equal(bucket.digestAll(), bucketDigestBefore);
});

test("scale rehearsal, retry case (c): a sabotaged chunk in the largest attested book rejects durably; chunk-generation discipline repairs it", async () => {
  const { bucket, harness: h, coord, pinBookChunks, chunksManifest } =
    makeWorld({ freezeDigest: FREEZE });
  const spec = BOOKS.find(b => b.bookId === "syn-pucked-up");
  const book = buildBook(bucket, spec);
  pinBookChunks(spec.bookId, book.pairs);
  const pin = chunksManifest.books[spec.bookId];
  // Apply chunk 0, then sabotage one object inside chunk 1.
  const sliceOf = (c) => book.rows.slice(c.start, c.start + c.rowCount);
  const send = (c, gen) => coord.handleCommand(chunkCmd(cmdId(spec.bookId, c.index, gen), {
    migrationId: MIG, freezeDigest: FREEZE, bookId: spec.bookId, chunkIndex: c.index,
    content: c.index === 0 ? book.content : undefined, rows: sliceOf(c) }));
  assert.equal((await send(pin.chunks[0])).outcome, "applied");
  const victimRow = sliceOf(pin.chunks[1])[0];
  const victim = book.seededByOcc.get(victimRow.occurrenceId);
  bucket.seed(victim.objectKey, syntheticBytes("sabotage"), v1Meta(victim.row.manifest.format));
  const bad = await send(pin.chunks[1]);
  assert.equal(bad.outcome, "rejected");
  assert.equal(bad.reason, "content_hash_mismatch");
  // Earlier verified chunks stand; the book is ungated/unflipped.
  assert.equal(h.rows("migration_chunks").length, 1);
  assert.equal(coord.migrationBookView(spec.bookId).gate, null);
  // The same id replays ONLY the refusal even after repair.
  bucket.seed(victim.objectKey, victim.bytes, v1Meta(victim.row.manifest.format));
  const replay = await send(pin.chunks[1]);
  assert.equal(replay.replayed, true);
  assert.equal(replay.outcome, "rejected");
  // The corrected attempt (new retry generation) is the only path
  // that re-executes — and the book then completes and gates.
  assert.equal((await send(pin.chunks[1], 2)).outcome, "applied");
  let last = null;
  for (const c of pin.chunks.slice(2)) last = await send(c);
  assert.equal(last.bookComplete, true);
  const view = coord.migrationBookView(spec.bookId);
  assert.equal(view.completeness.complete, true);
  const gate = await coord.handleCommand(gateCmd("scale-gate-pu-repair", {
    migrationId: MIG, bookId: spec.bookId,
    certificateSha256: view.importRecord.certificateSha256 }));
  assert.equal(gate.outcome, "applied");
  assert.equal(h.rows("migration_audit").length, 29, "Pucked Up's 29 attested rows intact");
  assert.equal(bucket.putCalls.length, 0);
});

test("the committed real-freeze chunk pin: 7 books, 1,799 rows, 25 chunks under the code limits", async () => {
  // The partition of the REAL approved freeze (digests/metadata
  // only), as committed in v2/p8/approved-freeze-chunks.mjs and
  // enforced by the coordinator. These are the counts D4 would
  // execute against.
  const counts = Object.fromEntries(Object.entries(APPROVED_FREEZE_CHUNKS.books)
    .map(([id, b]) => [id, b.chunkCount]));
  assert.deepEqual(counts, {
    "067ddb04-d68f-4c5a-a368-ccd1d71876cd": 6, // Pucked Up
    "1c6bc7a6-6ef7-45b9-9a58-f492a1526ea0": 3, // In Her Own League
    "21f655a2-0b0a-4b62-86c9-3a3808dbab40": 6, // Pucked Over
    "48019197-b92e-4766-928e-5f73f7084e6d": 3, // Finding Home
    "5c589095-f812-48a2-8ab2-03ba2791f2b2": 1, // Forever Pucked
    "89b2d4f1-d3b4-41ef-b59c-83800bec9f81": 4, // Pucked
    "f1b1e2f9-8c09-4f23-8290-472740923954": 2, // The Goal
  });
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  assert.equal(total, 25);
  for (const b of Object.values(APPROVED_FREEZE_CHUNKS.books))
    for (const c of b.chunks) {
      assert.ok(c.rowCount <= 100, "row cap");
      assert.ok(c.totalBytes <= 250 * 1024 * 1024, "byte cap");
    }
});
