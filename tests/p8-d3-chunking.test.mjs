// Opal Reader v2 — P8 D3: the chunked migration import contract
// (cutover plan §S3 as corrected; design §10).
//
// Harness-level proofs over synthetic fixtures: pinned chunking,
// per-chunk atomicity, sync-plane invisibility of partial state,
// whole-book certificate derivation at completion, the gate
// applying unchanged afterwards, the plan's three retry cases,
// the limit enforcement, and the negative suite. Worker-path
// proofs (both surfaces) live in
// tests/p8-d3-production-surface.test.mjs; scale proofs in
// tests/p8-d3-scale-rehearsal.test.mjs and
// tests/p8-d3-resource-proofs.test.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import {
  attestationFor, chunkCmd, chunkPinDigest, gateCmd, importCmd, makeWorld,
  seedRow, sha256Hex, syntheticBytes, v1Meta,
} from "./helpers/migration-fixtures.mjs";
import { MIGRATION_CHUNK_LIMITS } from "../v2/p8/migration-chunk-limits.mjs";

const MIG = "mig-d3-chunks";
const FREEZE = "freeze-digest-synthetic";
// Small derivation limits for tests: chunks of at most 2 rows.
// (Enforcement in the coordinator binds at the CODE limits; a pin
// may always be stricter than the caps.)
const SMALL = { maxRowsPerChunk: 2, maxChunkBytes: 64 * 1024 * 1024, maxItemBytes: 16 * 1024 * 1024 };

// The plan's receipt/command id scheme: the first attempt at chunk
// n is <migrationId>:<bookId>:chunk:<n>; a corrected attempt after
// a durable rejection uses a NEW deterministic attempt id with a
// retry generation suffix (:g2, :g3, ...).
const cmdId = (bookId, n, gen) =>
  `${MIG}:${bookId}:chunk:${n}` + (gen ? `:g${gen}` : "");

// Build a seeded book in the world and pin it (whole-book pin +
// chunk pin). Rows come back in pinned (occurrence-sorted) order
// with their chunk slices.
function buildBook(world, bookId, { count = 5, forms = null, format = "mp3" } = {}) {
  const seeded = [], pairs = [];
  for (let i = 0; i < count; i++) {
    const occurrenceId = `${bookId}-seg-${String(i + 1).padStart(3, "0")}`;
    const form = forms ? forms[i] : "fingerprinted";
    const s = seedRow(world.bucket, { bookId, occurrenceId, form, format });
    const row = { ...s.row };
    if (form === "distinct")
      row.provenanceAttestation = attestationFor(s, { bookId, freezeDigest: FREEZE });
    seeded.push({ ...s, row });
    pairs.push({ row, etag: s.etag });
  }
  world.pinBookChunks(bookId, pairs, SMALL);
  const rows = seeded.map(s => s.row); // occurrence order == pinned order
  const chunks = [];
  for (let start = 0; start < rows.length; start += SMALL.maxRowsPerChunk)
    chunks.push(rows.slice(start, start + SMALL.maxRowsPerChunk));
  const content = { title: bookId, occurrenceIds: rows.map(r => r.occurrenceId) };
  return { bookId, rows, chunks, content, seeded };
}
const chunk = (book, i, id, extra = {}) => chunkCmd(id, {
  migrationId: MIG, freezeDigest: FREEZE, bookId: book.bookId,
  chunkIndex: i, content: i === 0 ? book.content : undefined,
  rows: book.chunks[i], ...extra.payload });

// ============================================================ happy path
test("chunked import: partial state is invisible and ungated; completion derives the one whole-book certificate; the existing gate applies unchanged", async () => {
  const world = makeWorld();
  const book = buildBook(world, "d3-book-happy", { count: 5 });
  const { coord, bucket, harness: h } = world;
  const B = book.bookId;
  assert.equal(book.chunks.length, 3);

  // Chunk 0: primes ONLY its own rows (2 mp3 objects = 2 GETs).
  const gets0 = bucket.getCalls;
  const r0 = await coord.handleCommand(chunk(book, 0, cmdId(B, 0)));
  assert.equal(r0.outcome, "applied", JSON.stringify(r0));
  assert.equal(r0.bookComplete, false);
  assert.equal(r0.chunksApplied, 1);
  assert.equal(bucket.getCalls - gets0, 2, "chunk 0 primed exactly its 2 rows");
  assert.equal(bucket.putCalls.length, 0);

  // Invisibility: no sync state for the book at all, no import
  // record, no gate possible — while SQL evidence for the chunk
  // exists in the coordinator's own bookkeeping.
  assert.equal(h.rows("sync_entities").filter(e => e.book_id === B).length, 0);
  assert.equal(h.rows("bindings").length, 2);
  assert.equal(h.rows("migration_books").length, 0);
  let view = coord.migrationBookView(B);
  assert.equal(view.importRecord, null);
  assert.equal(view.completeness.complete, false);
  assert.deepEqual(view.chunkedImport.chunksApplied, [0]);
  assert.equal(view.chunkedImport.complete, false);
  const gateEarly = await coord.handleCommand(gateCmd(`${MIG}:gate-early`, {
    migrationId: MIG, bookId: B, certificateSha256: "0".repeat(64) }));
  assert.equal(gateEarly.outcome, "rejected");
  assert.equal(gateEarly.reason, "flip_gate_incomplete");

  // Chunks 1 and 2 (the final chunk completes the book).
  const r1 = await coord.handleCommand(chunk(book, 1, cmdId(B, 1)));
  assert.equal(r1.outcome, "applied");
  assert.equal(r1.bookComplete, false);
  const r2 = await coord.handleCommand(chunk(book, 2, cmdId(B, 2)));
  assert.equal(r2.outcome, "applied");
  assert.equal(r2.bookComplete, true);
  assert.match(r2.certificateSha256, /^[a-f0-9]{64}$/);

  view = coord.migrationBookView(B);
  assert.equal(view.completeness.complete, true, JSON.stringify(view.completeness));
  assert.equal(view.importRecord.certificateSha256, r2.certificateSha256);
  assert.equal(view.chunkedImport.complete, true);
  assert.deepEqual(view.chunkedImport.chunksApplied, [0, 1, 2]);
  assert.equal(h.rows("sync_entities").filter(e => e.book_id === B).length, 6); // content + 5 bindings
  const gate = await coord.handleCommand(gateCmd(`${MIG}:gate`, {
    migrationId: MIG, bookId: B, certificateSha256: r2.certificateSha256 }));
  assert.equal(gate.outcome, "applied");
  assert.equal(bucket.putCalls.length, 0);
});

test("chunked and whole-book imports of the same book anchor the IDENTICAL certificate", async () => {
  // Two worlds with byte-identical synthetic books (same tags ->
  // same bytes, digests, etags): the certificate is a function of
  // the verified facts, not of the path that gathered them.
  const build = () => {
    const world = makeWorld();
    return { world, book: buildBook(world, "d3-book-twin", { count: 5 }) };
  };
  const a = build();
  for (let i = 0; i < 3; i++)
    await a.world.coord.handleCommand(chunk(a.book, i, cmdId(a.book.bookId, i)));
  const viewA = a.world.coord.migrationBookView("d3-book-twin");
  const b = build();
  const whole = await b.world.coord.handleCommand(importCmd("twin-whole", {
    migrationId: MIG, freezeDigest: FREEZE, bookId: "d3-book-twin",
    content: b.book.content, rows: b.book.rows }));
  assert.equal(whole.outcome, "applied", JSON.stringify(whole));
  assert.equal(viewA.importRecord.certificateSha256, whole.certificate.certificateSha256);
  assert.equal(viewA.importRecord.rowsSha256,
    b.world.coord.migrationBookView("d3-book-twin").importRecord.rowsSha256);
});

// ============================================================ retry cases
test("retry (b): the same command id replays the stored receipt — zero additional R2 GETs, single effect", async () => {
  const world = makeWorld();
  const book = buildBook(world, "d3-book-replay", { count: 3 });
  const { coord, bucket, harness: h } = world;
  const first = await coord.handleCommand(chunk(book, 0, cmdId(book.bookId, 0)));
  assert.equal(first.outcome, "applied");
  const gets = bucket.getCalls, bindings = h.rows("bindings").length;
  const replay = await coord.handleCommand(chunk(book, 0, cmdId(book.bookId, 0)));
  assert.equal(replay.replayed, true);
  assert.equal(replay.outcome, "applied");
  assert.equal(bucket.getCalls, gets, "replay performed no R2 GETs");
  assert.equal(h.rows("bindings").length, bindings, "replay applied nothing twice");
});

test("retry (a): an ambiguous transport interruption resolves to the true outcome under the same command id", async () => {
  const world = makeWorld();
  const book = buildBook(world, "d3-book-ambiguous", { count: 3 });
  const { coord, bucket } = world;
  // The request is executed but the caller never sees the response
  // (transport drops it). The caller cannot know whether it landed.
  await coord.handleCommand(chunk(book, 0, cmdId(book.bookId, 0))); // response "lost"
  const gets = bucket.getCalls;
  const resolved = await coord.handleCommand(chunk(book, 0, cmdId(book.bookId, 0)));
  assert.equal(resolved.replayed, true);
  assert.equal(resolved.outcome, "applied", "the true outcome: it had landed");
  assert.equal(bucket.getCalls, gets);
  // And the mirror image: an interruption BEFORE execution — the
  // same id, sent for the first time the coordinator sees it,
  // executes fresh and lands exactly once.
  const fresh = await coord.handleCommand(chunk(book, 1, cmdId(book.bookId, 1)));
  assert.equal(fresh.outcome, "applied");
  assert.equal(fresh.replayed, undefined);
});

test("retry (c): a durably rejected chunk replays ONLY its refusal under the same id; a corrected attempt needs a new retry-generation id", async () => {
  const world = makeWorld();
  const book = buildBook(world, "d3-book-rejected", { count: 5 });
  const { coord, bucket, harness: h } = world;
  const B = book.bookId;
  await coord.handleCommand(chunk(book, 0, cmdId(B, 0)));
  // Corrupt one object of chunk 1 in the bucket (bytes drift).
  const victim = book.seeded[2];
  bucket.seed(victim.objectKey, syntheticBytes("corrupted"), v1Meta("mp3"));
  const bad = await coord.handleCommand(chunk(book, 1, cmdId(B, 1)));
  assert.equal(bad.outcome, "rejected");
  assert.equal(bad.reason, "content_hash_mismatch");
  // The rejection applied NOTHING of chunk 1; chunk 0 stands.
  assert.equal(h.rows("migration_chunks").length, 1);
  assert.equal(h.rows("bindings").length, 2);
  let view = coord.migrationBookView(B);
  assert.deepEqual(view.chunkedImport.chunksApplied, [0]);
  assert.equal(view.gate, null);
  // Repair the bucket. The SAME command id still returns only the
  // stored refusal — no re-execution, no R2 contact.
  bucket.seed(victim.objectKey, victim.bytes, v1Meta("mp3"));
  const gets = bucket.getCalls;
  const replay = await coord.handleCommand(chunk(book, 1, cmdId(B, 1)));
  assert.equal(replay.replayed, true);
  assert.equal(replay.outcome, "rejected");
  assert.equal(replay.reason, "content_hash_mismatch");
  assert.equal(bucket.getCalls, gets, "a refused id never re-executes");
  // The corrected attempt uses a NEW deterministic attempt id
  // (retry generation) — and is the only path that re-executes.
  const fixed = await coord.handleCommand(chunk(book, 1, cmdId(B, 1, 2)));
  assert.equal(fixed.outcome, "applied", JSON.stringify(fixed));
  assert.equal(fixed.chunksApplied, 2);
  view = coord.migrationBookView(B);
  assert.equal(view.chunkedImport.complete, false);
  assert.equal(view.gate, null);
});

test("out-of-order chunk: durable refusal; the in-order retry still needs a new generation id", async () => {
  const world = makeWorld();
  const book = buildBook(world, "d3-book-order", { count: 5 });
  const { coord } = world;
  const B = book.bookId;
  const early = await coord.handleCommand(chunk(book, 1, cmdId(B, 1)));
  assert.equal(early.outcome, "rejected");
  assert.equal(early.reason, "migration_chunk_out_of_order");
  assert.equal(early.expectedChunk, 0);
  await coord.handleCommand(chunk(book, 0, cmdId(B, 0)));
  const replay = await coord.handleCommand(chunk(book, 1, cmdId(B, 1)));
  assert.equal(replay.replayed, true);
  assert.equal(replay.outcome, "rejected");
  const fixed = await coord.handleCommand(chunk(book, 1, cmdId(B, 1, 2)));
  assert.equal(fixed.outcome, "applied");
});

test("duplicate chunk under a NEW command id converges on the recorded application — zero GETs, no double effect", async () => {
  const world = makeWorld();
  const book = buildBook(world, "d3-book-dupe", { count: 5 });
  const { coord, bucket, harness: h } = world;
  const B = book.bookId;
  await coord.handleCommand(chunk(book, 0, cmdId(B, 0)));
  const gets = bucket.getCalls;
  const again = await coord.handleCommand(chunk(book, 0, `${MIG}:${B}:chunk:0:reissue`));
  assert.equal(again.outcome, "applied");
  assert.equal(again.converged, true);
  assert.equal(bucket.getCalls, gets, "a converged chunk is never re-fetched");
  assert.equal(h.rows("bindings").length, 2);
  assert.equal(h.rows("migration_chunks").length, 1);
  // After completion, a re-issued chunk still converges and reports
  // the anchored whole-book certificate.
  await coord.handleCommand(chunk(book, 1, cmdId(B, 1)));
  const fin = await coord.handleCommand(chunk(book, 2, cmdId(B, 2)));
  const post = await coord.handleCommand(chunk(book, 0, `${MIG}:${B}:chunk:0:reissue-2`));
  assert.equal(post.converged, true);
  assert.equal(post.bookComplete, true);
  assert.equal(post.certificateSha256, fin.certificateSha256);
});

// ============================================================ negatives
test("negative: missing chunk — the gate cannot pass and the view names the gap", async () => {
  const world = makeWorld();
  const book = buildBook(world, "d3-book-missing", { count: 5 });
  const { coord } = world;
  const B = book.bookId;
  await coord.handleCommand(chunk(book, 0, cmdId(B, 0)));
  await coord.handleCommand(chunk(book, 1, cmdId(B, 1)));
  const view = coord.migrationBookView(B);
  assert.deepEqual(view.chunkedImport.chunksApplied, [0, 1]);
  assert.equal(view.chunkedImport.chunksExpected, 3);
  assert.equal(view.completeness.complete, false);
  const gate = await coord.handleCommand(gateCmd(`${MIG}:gate-missing`, {
    migrationId: MIG, bookId: B, certificateSha256: "0".repeat(64) }));
  assert.equal(gate.outcome, "rejected");
  assert.equal(gate.reason, "flip_gate_incomplete");
});

test("negative: reordered rows inside a chunk payload are refused as a chunk mismatch, pre-prime", async () => {
  const world = makeWorld();
  const book = buildBook(world, "d3-book-reorder", { count: 5 });
  const { coord, bucket, harness: h } = world;
  const B = book.bookId;
  const reordered = [...book.chunks[0]].reverse();
  const res = await coord.handleCommand(chunkCmd(cmdId(B, 0), {
    migrationId: MIG, freezeDigest: FREEZE, bookId: B, chunkIndex: 0,
    content: book.content, rows: reordered }));
  assert.equal(res.outcome, "rejected");
  assert.equal(res.reason, "migration_chunk_mismatch");
  assert.equal(bucket.getCalls, 0, "a mismatched chunk is never primed");
  assert.equal(h.rows("migration_imports").length, 0);
});

test("negative: substituted chunks — another chunk's rows, and another book's rows, are refused", async () => {
  const world = makeWorld();
  const bookA = buildBook(world, "d3-book-sub-a", { count: 5 });
  const bookB = buildBook(world, "d3-book-sub-b", { count: 5 });
  const { coord } = world;
  // Chunk 0's rows presented as chunk 1.
  let res = await coord.handleCommand(chunkCmd(cmdId(bookA.bookId, 1), {
    migrationId: MIG, freezeDigest: FREEZE, bookId: bookA.bookId, chunkIndex: 1,
    rows: bookA.chunks[0] }));
  assert.equal(res.outcome, "rejected");
  assert.equal(res.reason, "migration_chunk_mismatch");
  // Book B's chunk 0 presented under book A.
  res = await coord.handleCommand(chunkCmd(cmdId(bookA.bookId, 0), {
    migrationId: MIG, freezeDigest: FREEZE, bookId: bookA.bookId, chunkIndex: 0,
    content: bookA.content, rows: bookB.chunks[0] }));
  assert.equal(res.outcome, "rejected");
  assert.equal(res.reason, "migration_chunk_mismatch");
  // A chunk index the partition does not have.
  res = await coord.handleCommand(chunkCmd(cmdId(bookA.bookId, 9), {
    migrationId: MIG, freezeDigest: FREEZE, bookId: bookA.bookId, chunkIndex: 9,
    rows: bookA.chunks[0] }));
  assert.equal(res.outcome, "rejected");
  assert.equal(res.reason, "migration_chunk_mismatch");
});

test("negative: wrong migrationId mid-sequence is a divergence; earlier verified chunks stand, the book stays ungated", async () => {
  const world = makeWorld();
  const book = buildBook(world, "d3-book-migid", { count: 5 });
  const { coord, harness: h } = world;
  const B = book.bookId;
  await coord.handleCommand(chunk(book, 0, cmdId(B, 0)));
  const res = await coord.handleCommand(chunkCmd(cmdId(B, 1), {
    migrationId: "mig-someone-else", freezeDigest: FREEZE, bookId: B,
    chunkIndex: 1, rows: book.chunks[1] }));
  assert.equal(res.outcome, "rejected");
  assert.equal(res.reason, "migration_book_divergence");
  assert.equal(h.rows("migration_chunks").length, 1);
  assert.equal(h.rows("bindings").length, 2);
  const view = coord.migrationBookView(B);
  assert.equal(view.chunkedImport.complete, false);
  assert.equal(view.gate, null);
});

test("negative: altered freeze digest, altered payload row, and a book with no chunk pin are refused", async () => {
  const world = makeWorld();
  const book = buildBook(world, "d3-book-pin", { count: 3 });
  const { coord } = world;
  const B = book.bookId;
  let res = await coord.handleCommand(chunkCmd(cmdId(B, 0), {
    migrationId: MIG, freezeDigest: "freeze-of-my-own", bookId: B,
    chunkIndex: 0, content: book.content, rows: book.chunks[0] }));
  assert.equal(res.outcome, "rejected");
  assert.equal(res.reason, "migration_freeze_unapproved");
  const resized = book.chunks[0].map((r, i) => i === 0
    ? { ...r, manifest: { ...r.manifest, size: r.manifest.size + 1 } } : r);
  res = await coord.handleCommand(chunkCmd(`${MIG}:${B}:chunk:0:resized`, {
    migrationId: MIG, freezeDigest: FREEZE, bookId: B, chunkIndex: 0,
    content: book.content, rows: resized }));
  assert.equal(res.outcome, "rejected");
  assert.equal(res.reason, "migration_chunk_mismatch");
  // Pinned in the freeze manifest but NOT in the chunk pin: the
  // chunked path is not approved for this book.
  const lone = buildBook(world, "d3-book-nochunkpin", { count: 2 });
  delete world.chunksManifest.books[lone.bookId];
  res = await coord.handleCommand(chunk(lone, 0, cmdId(lone.bookId, 0)));
  assert.equal(res.outcome, "rejected");
  assert.equal(res.reason, "migration_freeze_unapproved");
});

test("negative: late bytes drift and late metadata drift reject the affected chunk only", async () => {
  const world = makeWorld();
  const book = buildBook(world, "d3-book-drift", { count: 5 });
  const { coord, bucket, harness: h } = world;
  const B = book.bookId;
  await coord.handleCommand(chunk(book, 0, cmdId(B, 0)));
  // Bytes drift after the freeze (same key, different content).
  const victim = book.seeded[3];
  bucket.seed(victim.objectKey, syntheticBytes("drifted-bytes"), v1Meta("mp3"));
  let res = await coord.handleCommand(chunk(book, 1, cmdId(B, 1)));
  assert.equal(res.outcome, "rejected");
  assert.equal(res.reason, "content_hash_mismatch");
  // Metadata drift: honest bytes, but the object's OWN metadata now
  // advertises a digest the bytes do not carry.
  bucket.seed(victim.objectKey, victim.bytes,
    { ...v1Meta("mp3"), sha256: sha256Hex(syntheticBytes("advertised")) });
  res = await coord.handleCommand(chunk(book, 1, cmdId(B, 1, 2)));
  assert.equal(res.outcome, "rejected");
  assert.equal(res.reason, "metadata_digest_mismatch");
  // Chunk 0's verified state is intact throughout; nothing gated.
  assert.equal(h.rows("migration_chunks").length, 1);
  assert.equal(h.rows("bindings").length, 2);
  assert.equal(coord.migrationBookView(B).gate, null);
  // Honest state restored: chunk 1 lands under a new generation id.
  bucket.seed(victim.objectKey, victim.bytes, v1Meta("mp3"));
  res = await coord.handleCommand(chunk(book, 1, cmdId(B, 1, 3)));
  assert.equal(res.outcome, "applied");
});

test("negative: the two import paths never interleave on one book", async () => {
  const world = makeWorld();
  const book = buildBook(world, "d3-book-paths", { count: 5 });
  const { coord } = world;
  const B = book.bookId;
  await coord.handleCommand(chunk(book, 0, cmdId(B, 0)));
  // Whole-book import while a chunked import is in progress.
  let res = await coord.handleCommand(importCmd(`${MIG}:whole-mid`, {
    migrationId: MIG, freezeDigest: FREEZE, bookId: B,
    content: book.content, rows: book.rows }));
  assert.equal(res.outcome, "rejected");
  assert.equal(res.reason, "migration_book_divergence");
  // And the mirror: a book imported whole-book refuses chunk commands.
  const world2 = makeWorld();
  const book2 = buildBook(world2, "d3-book-paths-2", { count: 3 });
  const whole = await world2.coord.handleCommand(importCmd("paths-whole", {
    migrationId: MIG, freezeDigest: FREEZE, bookId: book2.bookId,
    content: book2.content, rows: book2.rows }));
  assert.equal(whole.outcome, "applied");
  res = await world2.coord.handleCommand(chunk(book2, 0, cmdId(book2.bookId, 0)));
  assert.equal(res.outcome, "rejected");
  assert.equal(res.reason, "migration_book_divergence");
});

test("negative: first chunk without content (and none stored) is unknown_book; a divergent carried content is refused", async () => {
  const world = makeWorld();
  const book = buildBook(world, "d3-book-content", { count: 5 });
  const { coord } = world;
  const B = book.bookId;
  let res = await coord.handleCommand(chunkCmd(cmdId(B, 0), {
    migrationId: MIG, freezeDigest: FREEZE, bookId: B, chunkIndex: 0,
    rows: book.chunks[0] }));
  assert.equal(res.outcome, "rejected");
  assert.equal(res.reason, "unknown_book");
  await coord.handleCommand(chunk(book, 0, cmdId(B, 0, 2)));
  res = await coord.handleCommand(chunkCmd(cmdId(B, 1), {
    migrationId: MIG, freezeDigest: FREEZE, bookId: B, chunkIndex: 1,
    content: { title: "A Different Book Entirely", occurrenceIds: book.content.occurrenceIds },
    rows: book.chunks[1] }));
  assert.equal(res.outcome, "rejected");
  assert.equal(res.reason, "content_divergence");
});

test("crash durability: a crash between chunks and after the final chunk loses nothing", async () => {
  const world = makeWorld();
  const book = buildBook(world, "d3-book-crash", { count: 5 });
  const { coord, harness: h } = world;
  const B = book.bookId;
  await coord.handleCommand(chunk(book, 0, cmdId(B, 0)));
  h.crash(); // DO eviction between chunks: storage persists
  const r1 = await h.coord.handleCommand(chunk(book, 1, cmdId(B, 1)));
  assert.equal(r1.outcome, "applied");
  const r2 = await h.coord.handleCommand(chunk(book, 2, cmdId(B, 2)));
  assert.equal(r2.bookComplete, true);
  h.crash(); // crash after the final chunk, before the gate
  const gate = await h.coord.handleCommand(gateCmd(`${MIG}:gate-crash`, {
    migrationId: MIG, bookId: B, certificateSha256: r2.certificateSha256 }));
  assert.equal(gate.outcome, "applied");
});

// ============================================================ provenance + shared key
test("attested rows flow through chunking with provenance intact; a bad attestation rejects its chunk", async () => {
  const world = makeWorld();
  const forms = ["fingerprinted", "distinct", "legacy", "distinct", "fingerprinted"];
  const book = buildBook(world, "d3-book-attest", { count: 5, forms });
  const { coord, harness: h } = world;
  const B = book.bookId;
  for (let i = 0; i < 3; i++) {
    const r = await coord.handleCommand(chunk(book, i, cmdId(B, i)));
    assert.equal(r.outcome, "applied", JSON.stringify(r));
    if (i === 2) assert.equal(r.bookComplete, true);
  }
  assert.equal(h.rows("migration_audit").length, 2, "one audit row per attested row");
  assert.ok(h.rows("migration_audit").every(a => a.outcome === "accepted_provenance"));
  const view = coord.migrationBookView(B);
  assert.equal(view.completeness.complete, true, JSON.stringify(view.completeness));
  const gate = await coord.handleCommand(gateCmd(`${MIG}:gate-attest`, {
    migrationId: MIG, bookId: B, certificateSha256: view.importRecord.certificateSha256 }));
  assert.equal(gate.outcome, "applied");

  // A tampered attestation (wrong freeze etag) rejects its chunk.
  const world2 = makeWorld();
  const book2 = buildBook(world2, "d3-book-attest-bad", { count: 3, forms: ["distinct", "fingerprinted", "fingerprinted"] });
  const tampered = book2.chunks[0].map(r => r.provenanceAttestation
    ? { ...r, provenanceAttestation: { ...r.provenanceAttestation, r2Etag: "\"etag:forged\"" } } : r);
  const res = await world2.coord.handleCommand(chunkCmd(cmdId(book2.bookId, 0), {
    migrationId: MIG, freezeDigest: FREEZE, bookId: book2.bookId, chunkIndex: 0,
    content: book2.content, rows: tampered }));
  assert.equal(res.outcome, "rejected");
  assert.equal(res.reason, "attestation_invalid");
  assert.equal(world2.harness.rows("bindings").length, 0);
});

test("the shared object: two rows, one cache key, split across chunks — anchored once, provenance intact", async () => {
  const world = makeWorld();
  const { bucket, coord, harness: h } = world;
  const B = "d3-book-shared";
  const bytes = syntheticBytes("shared-object");
  const sha = sha256Hex(bytes);
  const objectKey = `audio/${sha}.mp3`;
  bucket.seed(objectKey, bytes, v1Meta("mp3"));
  const etag = `"etag:${objectKey}"`;
  const mkRow = (occurrenceId, revisionKey) => ({ occurrenceId, revisionKey, cacheKey: sha,
    manifest: { sha256: sha, size: bytes.length, format: "mp3" } });
  const rowA = mkRow(`${B}-seg-001`, sha);            // fingerprinted
  const rowB = mkRow(`${B}-seg-002`, `legacy:${sha}`); // legacy anchor, same object
  const pairs = [{ row: rowA, etag }, { row: rowB, etag }];
  world.pinBookChunks(B, pairs, { maxRowsPerChunk: 1, maxChunkBytes: 64 * 1024 * 1024, maxItemBytes: 16 * 1024 * 1024 });
  const content = { title: B, occurrenceIds: [rowA.occurrenceId, rowB.occurrenceId] };
  const r0 = await coord.handleCommand(chunkCmd(cmdId(B, 0), {
    migrationId: MIG, freezeDigest: FREEZE, bookId: B, chunkIndex: 0,
    content, rows: [rowA] }));
  assert.equal(r0.outcome, "applied", JSON.stringify(r0));
  const r1 = await coord.handleCommand(chunkCmd(cmdId(B, 1), {
    migrationId: MIG, freezeDigest: FREEZE, bookId: B, chunkIndex: 1, rows: [rowB] }));
  assert.equal(r1.outcome, "applied", JSON.stringify(r1));
  assert.equal(r1.bookComplete, true);
  assert.equal(h.rows("cache_index").length, 1, "the shared key is anchored once");
  assert.equal(h.rows("bindings").length, 2);
  const view = coord.migrationBookView(B);
  assert.equal(view.completeness.complete, true, JSON.stringify(view.completeness));
});

// ============================================================ limits
test("limits: an oversize item, an over-cap chunk (bytes), and an over-cap chunk (rows) are all refused pre-prime", async () => {
  const world = makeWorld();
  const { coord, bucket } = world;
  // Hand-crafted pins whose DECLARED shapes breach the code limits
  // (the derive tooling would never emit these — enforcement must
  // not depend on derivation being honest). The objects behind the
  // rows need not exist: refusal happens before any priming.
  const craft = (bookId, sizes) => {
    const pairs = sizes.map((size, i) => {
      const occurrenceId = `${bookId}-seg-${String(i + 1).padStart(3, "0")}`;
      const sha = sha256Hex(syntheticBytes(`${bookId}-${i}`));
      const row = { occurrenceId, revisionKey: sha, cacheKey: sha,
        manifest: { sha256: sha, size, format: "mp3" } };
      return { row, etag: `"etag:audio/${sha}.mp3"` };
    });
    world.pinBook(bookId, pairs);
    const totalBytes = sizes.reduce((a, b) => a + b, 0);
    world.chunksManifest.books[bookId] = {
      chunkCount: 1, totalBytes,
      chunks: [{ index: 0, start: 0, rowCount: pairs.length, totalBytes,
                 rowsSha256: chunkPinDigest(pairs) }] };
    return { rows: pairs.map(p => p.row),
             content: { title: bookId, occurrenceIds: pairs.map(p => p.row.occurrenceId) } };
  };
  const attempt = (bookId, book) => coord.handleCommand(chunkCmd(cmdId(bookId, 0), {
    migrationId: MIG, freezeDigest: FREEZE, bookId, chunkIndex: 0,
    content: book.content, rows: book.rows }));

  // (1) A single item over the item cap.
  const itemBook = craft("d3-book-limit-item", [MIGRATION_CHUNK_LIMITS.maxItemBytes + 1]);
  let gets = bucket.getCalls;
  let res = await attempt("d3-book-limit-item", itemBook);
  assert.equal(res.outcome, "rejected");
  assert.equal(res.reason, "migration_item_oversize");
  assert.equal(bucket.getCalls, gets, "oversize item refused pre-prime (zero R2 GETs)");

  // (2) A chunk whose byte total breaches the chunk cap.
  const bytesBook = craft("d3-book-limit-bytes", Array(30).fill(9 * 1024 * 1024));
  gets = bucket.getCalls;
  res = await attempt("d3-book-limit-bytes", bytesBook);
  assert.equal(res.outcome, "rejected");
  assert.equal(res.reason, "migration_chunk_oversize");
  assert.equal(bucket.getCalls, gets, "over-cap chunk refused pre-prime (zero R2 GETs)");

  // (3) A chunk whose row count breaches the row cap.
  const rowsBook = craft("d3-book-limit-rows", Array(MIGRATION_CHUNK_LIMITS.maxRowsPerChunk + 1).fill(96));
  gets = bucket.getCalls;
  res = await attempt("d3-book-limit-rows", rowsBook);
  assert.equal(res.outcome, "rejected");
  assert.equal(res.reason, "migration_chunk_oversize");
  assert.equal(bucket.getCalls, gets, "over-cap chunk refused pre-prime (zero R2 GETs)");
});
