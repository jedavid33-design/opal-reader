// Opal Reader v2 — P8 B1 CORRECTION (Rowan's B1 source review,
// issue #15 comment 6369823670; Wren ack 6369866700). Two holes in
// the B1 build at pin 32e5594, closed here:
//
//   B1-C1 — effective-content verification. The chunk tripwire
//   hashed only the content a command PRESENTED; the flip gate
//   never re-checked the stored content at all. Altered content
//   that reached the sync entity by another path (SyncPush
//   verifies identity/revision, never content) was therefore
//   used — and could be flipped — unchecked. Now the pre-prime
//   chunk check verifies EVERY source the import can draw on
//   (presented / stored entity / held import copy) against the
//   carry pin, refusing at zero R2 contact when any source
//   mismatches or none exists; and the gate re-verifies the
//   durable stored content in its own transaction
//   (flip_gate_content_mismatch).
//
//   B1-C2 — complete stored-state verification. The gate's
//   carry verifier compared job digests and position
//   coordinates, but not the stored jobs' kind/lane/chapter/
//   revision/book columns, and not the truthful no-playback
//   baseline of a carried position (playing / tip / superseded
//   counts, empty journal). Both are now compared against the
//   pin, inside the gate's SELECT-only verifier only.
//
// Every negative below is a stored-state or preseed mutation on
// an otherwise-complete book; every refusal writes zero gate
// rows (or, at chunk time, zero migration business rows and zero
// R2 GETs). All data is synthetic; all worlds run the
// coordinator through the standard harness.
import test from "node:test";
import assert from "node:assert/strict";
import {
  makeWorld, seedRow, chunkCmd, gateCmd, positionsCmd, jobsCmd,
  SYNTHETIC_FREEZE_DIGEST,
} from "./helpers/migration-fixtures.mjs";

const MIG = "mig-b1c";
const FREEZE = SYNTHETIC_FREEZE_DIGEST;
const OP = { actorId: "op", source: "sync" };
const SMALL = { maxRowsPerChunk: 2, maxChunkBytes: 64 * 1024 * 1024, maxItemBytes: 16 * 1024 * 1024 };
const cid = (bookId, kind, n = 0) => `${MIG}:${bookId}:${kind}${n ? `:${n}` : ""}`;

// The same synthetic carry world shape as tests/p8-b1-carry.test.mjs.
function carryWorld({ bookId = "b1c-book", contentCount = 6, boundCount = 4,
                      positionAt = 2, positionOffset = 42.25 } = {}) {
  const world = makeWorld();
  const occIds = Array.from({ length: contentCount }, (_, i) =>
    `${bookId}-seg-${String(i + 1).padStart(3, "0")}`);
  const content = { title: bookId, occurrenceIds: occIds };
  const seeded = [], pairs = [];
  for (let i = 0; i < boundCount; i++) {
    const s = seedRow(world.bucket, { bookId, occurrenceId: occIds[i] });
    seeded.push(s); pairs.push({ row: s.row, etag: s.etag });
  }
  world.pinBookChunks(bookId, pairs, SMALL);
  world.pinBookCarry(bookId, {
    content,
    position: { occurrenceId: occIds[positionAt], offsetSec: positionOffset,
                checkpoints: [{ chapterIndex: 0, segmentIndex: 1, offsetSec: 3.5 }] },
    jobs: [] });
  const rows = seeded.map((s) => s.row);
  const chunks = [];
  for (let i = 0; i < rows.length; i += SMALL.maxRowsPerChunk)
    chunks.push(rows.slice(i, i + SMALL.maxRowsPerChunk));
  return { world, bookId, occIds, content, chunks, rows, seeded,
           carry: world.carryManifest.books[bookId] || null };
}

function parkedJobFor(w, { jobId = "b1c-parked", chapterIndex = 1 } = {}) {
  const occ = [
    { occurrenceId: w.occIds[3], revisionKey: w.seeded[3].revisionKey, state: "ready" },
    { occurrenceId: w.occIds[4], revisionKey: "unbound", state: "blocked_policy" },
    { occurrenceId: w.occIds[5], revisionKey: "unbound", state: "pending" },
  ];
  return { jobId, chapterIndex, v2State: "parked_policy",
           cause: "v1 job paused_update (chapter blocked by POLICY_BLOCK outcomes)",
           definition: { kind: "job", bookId: w.bookId, chapterIndex, lane: "standard",
             batchJobName: null, migrationProvenance: "synthetic",
             statusSegments: [{ status: "done" }, { status: "blocked" }, { status: "pending" }] },
           occurrences: occ };
}

// A world whose carry pin includes the parked job.
function parkedWorld() {
  const book = carryWorld({});
  book.world.pinBookCarry(book.bookId, {
    content: book.content,
    position: { occurrenceId: book.occIds[2], offsetSec: 42.25,
                checkpoints: [{ chapterIndex: 0, segmentIndex: 1, offsetSec: 3.5 }] },
    jobs: [parkedJobFor(book)] });
  book.carry = book.world.carryManifest.books[book.bookId];
  return book;
}

async function importAll(book, { withContent = true } = {}) {
  for (let i = 0; i < book.chunks.length; i++) {
    const r = await book.world.coord.handleCommand(chunkCmd(cid(book.bookId, "chunk", i), {
      migrationId: MIG, freezeDigest: FREEZE, bookId: book.bookId, chunkIndex: i,
      content: withContent && i === 0 ? book.content : undefined,
      rows: book.chunks[i] }), OP);
    assert.equal(r.outcome, "applied", `chunk ${i}: ${JSON.stringify(r)}`);
  }
}
const carryPositions = (book) => book.world.coord.handleCommand(
  positionsCmd(cid(book.bookId, "positions"), {
    migrationId: MIG, freezeDigest: FREEZE, bookId: book.bookId, carry: book.carry }), OP);
const carryJobs = (book) => book.world.coord.handleCommand(
  jobsCmd(cid(book.bookId, "jobs"), {
    migrationId: MIG, freezeDigest: FREEZE, bookId: book.bookId, carry: book.carry }), OP);
async function fullCarry(book) {
  await importAll(book);
  assert.equal((await carryPositions(book)).outcome, "applied");
  assert.equal((await carryJobs(book)).outcome, "applied");
}
const gate = (book, cert) => book.world.coord.handleCommand(gateCmd(cid(book.bookId, "gate"), {
  migrationId: MIG, bookId: book.bookId, certificateSha256: cert }), OP);
const certOf = (book) => book.world.coord.migrationBookView(book.bookId).importRecord.certificateSha256;

// The supported sync path (what a client write looks like):
// content upsert at an explicit base revision. SyncPush checks
// identity + revision — it never verifies content against any
// pin, which is precisely the hole B1-C1 closes at the migration
// boundary.
const syncPushContent = (book, idSuffix, baseRevision, payload) =>
  book.world.coord.handleCommand({ command_id: cid(book.bookId, idSuffix),
    type: "SyncPush",
    payload: { changes: [{ family: "content", entityKey: book.bookId,
      bookId: book.bookId, baseRevision, payload }] } }, OP);

// ============================================================ B1-C1, chunk side
test("C1: altered content preseeded via SyncPush (same occurrence IDs, changed cast) + first chunk WITHOUT content refuses migration_content_mismatch pre-prime — zero GETs, zero migration business rows, durable rejected receipt", async () => {
  const book = carryWorld({});
  const { coord, harness: h, bucket } = book.world;
  const altered = { title: `${book.bookId} — a different cast entirely`,
                    occurrenceIds: book.occIds };
  const push = await syncPushContent(book, "preseed", 0, altered);
  assert.equal(push.outcomes[0].status, "applied",
    "SyncPush lands the altered content — it does no content verification");

  const r = await coord.handleCommand(chunkCmd(cid(book.bookId, "chunk", 0), {
    migrationId: MIG, freezeDigest: FREEZE, bookId: book.bookId, chunkIndex: 0,
    rows: book.chunks[0] }), OP);
  assert.equal(r.outcome, "rejected");
  assert.equal(r.reason, "migration_content_mismatch",
    "the EFFECTIVE content (the stored entity) is verified, not just a presented copy");
  assert.equal(bucket.getCalls, 0, "refused before any R2 contact");
  assert.equal(bucket.putCalls.length, 0);
  for (const t of ["migration_books", "migration_chunks", "migration_imports",
                   "migration_carry", "bindings"])
    assert.equal(h.rows(t).length, 0, `${t}: zero migration business rows`);
  assert.equal(h.rows("sync_entities").length, 1,
    "the only sync row is the preseed itself — the chunk wrote nothing");
  const receipt = h.rows("commands").find((c) => c.command_id === cid(book.bookId, "chunk", 0));
  assert.equal(receipt.outcome, "rejected");
  assert.match(receipt.outcome_json, /migration_content_mismatch/);
});

test("C1: the same preseed refuses even when the chunk PRESENTS the pin-correct content — the stored entity is the effective content and it mismatches", async () => {
  const book = carryWorld({});
  const { coord, bucket } = book.world;
  const altered = { title: `${book.bookId} — a different cast entirely`,
                    occurrenceIds: book.occIds };
  await syncPushContent(book, "preseed", 0, altered);
  const r = await coord.handleCommand(chunkCmd(cid(book.bookId, "chunk", 0), {
    migrationId: MIG, freezeDigest: FREEZE, bookId: book.bookId, chunkIndex: 0,
    content: book.content, rows: book.chunks[0] }), OP);
  assert.equal(r.outcome, "rejected");
  assert.equal(r.reason, "migration_content_mismatch");
  assert.equal(bucket.getCalls, 0, "still pre-prime: presenting good content cannot launder a bad stored entity");
});

test("C1 positive control: pin-correct content preseeded via SyncPush is a trustworthy source — chunks without content import against it and complete", async () => {
  const book = carryWorld({});
  const { coord, harness: h } = book.world;
  const push = await syncPushContent(book, "preseed", 0, book.content);
  assert.equal(push.outcomes[0].status, "applied");
  await importAll(book, { withContent: false });
  const view = coord.migrationBookView(book.bookId);
  assert.ok(view.importRecord.certificateSha256,
    "the import completed against the stored (verified) content");
  assert.equal(h.rows("migration_chunks").length, book.chunks.length);
});

test("C1: a carry-pinned book with NO content source anywhere refuses migration_content_mismatch pre-prime (no priming for an import that cannot be verified)", async () => {
  const book = carryWorld({});
  const { coord, harness: h, bucket } = book.world;
  const r = await coord.handleCommand(chunkCmd(cid(book.bookId, "chunk", 0), {
    migrationId: MIG, freezeDigest: FREEZE, bookId: book.bookId, chunkIndex: 0,
    rows: book.chunks[0] }), OP);
  assert.equal(r.outcome, "rejected");
  assert.equal(r.reason, "migration_content_mismatch");
  assert.equal(bucket.getCalls, 0);
  assert.equal(h.rows("migration_books").length, 0);
  assert.equal(h.rows("migration_chunks").length, 0);
});

// ============================================================ B1-C1, gate side
test("C1: after a legitimate import + both carries, altering the stored content via SyncPush (same ID membership, reversed order, changed cast) makes the gate refuse flip_gate_content_mismatch with zero gate rows; restoring the pinned content lets the gate apply", async () => {
  const book = parkedWorld();
  const { coord, harness: h } = book.world;
  const B = book.bookId;
  await fullCarry(book);
  const cert = certOf(book);
  assert.equal(coord.migrationBookView(B).carry.gatePreconditions.ready, true,
    "pre-alteration the book is fully gate-ready (the positive control baseline)");

  // The supported sync path rewrites the stored content: same
  // occurrence ID membership, different order, different cast.
  const altered = { title: `${B} — a different cast entirely`,
                    occurrenceIds: [...book.occIds].reverse() };
  const push = await syncPushContent(book, "alter", 1, altered);
  assert.equal(push.outcomes[0].status, "applied");

  const g = await gate(book, cert);
  assert.equal(g.outcome, "rejected");
  assert.equal(g.reason, "flip_gate_content_mismatch",
    JSON.stringify(g));
  assert.equal(g.expected, book.carry.contentSha256);
  assert.equal(h.rows("migration_gates").length, 0, "zero gate rows on refusal");

  // Restoring the pinned content (revision is now 2) un-refuses:
  // the refusal was about the stored bytes, not a sticky state.
  // (The corrected attempt uses a NEW command id — a durably
  // rejected id only ever replays its refusal, per the three-case
  // receipt rules.)
  const restore = await syncPushContent(book, "restore", 2, book.content);
  assert.equal(restore.outcomes[0].status, "applied");
  const g2 = await book.world.coord.handleCommand(gateCmd(cid(book.bookId, "gate", 2), {
    migrationId: MIG, bookId: book.bookId, certificateSha256: cert }), OP);
  assert.equal(g2.outcome, "applied", JSON.stringify(g2));
  assert.equal(h.rows("migration_gates").length, 1);
});

// ============================================================ B1-C2, job columns
async function expectCarryRefusal(book, field) {
  const g = await gate(book, certOf(book));
  assert.equal(g.outcome, "rejected", JSON.stringify(g));
  assert.equal(g.reason, "flip_gate_carry_incomplete");
  assert.ok((g.divergences || []).some((d) => d.field === field),
    `expected a ${field} divergence: ${JSON.stringify(g.divergences)}`);
  assert.equal(book.world.harness.rows("migration_gates").length, 0,
    "zero gate rows on refusal");
}

test("C2 control: an untouched complete book (chunks + both carries) still gates", async () => {
  const book = parkedWorld();
  await fullCarry(book);
  const g = await gate(book, certOf(book));
  assert.equal(g.outcome, "applied", JSON.stringify(g));
  assert.equal(book.world.harness.rows("migration_gates").length, 1);
});

test("C2: mutating the stored job's chapter_index makes the gate refuse (chapter_index), zero gate rows", async () => {
  const book = parkedWorld();
  await fullCarry(book);
  book.world.harness.db.prepare(
    `UPDATE jobs SET chapter_index = 7 WHERE job_id = 'b1c-parked'`).run();
  await expectCarryRefusal(book, "chapter_index");
});

test("C2: mutating the stored job's lane makes the gate refuse (lane), zero gate rows", async () => {
  const book = parkedWorld();
  await fullCarry(book);
  book.world.harness.db.prepare(
    `UPDATE jobs SET lane = 'batch' WHERE job_id = 'b1c-parked'`).run();
  await expectCarryRefusal(book, "lane");
});

test("C2: mutating the stored job's kind makes the gate refuse (kind), zero gate rows", async () => {
  const book = parkedWorld();
  await fullCarry(book);
  book.world.harness.db.prepare(
    `UPDATE jobs SET kind = 'repair' WHERE job_id = 'b1c-parked'`).run();
  await expectCarryRefusal(book, "kind");
});

test("C2: mutating the stored job's revision makes the gate refuse (revision), zero gate rows", async () => {
  const book = parkedWorld();
  await fullCarry(book);
  book.world.harness.db.prepare(
    `UPDATE jobs SET revision = 2 WHERE job_id = 'b1c-parked'`).run();
  await expectCarryRefusal(book, "revision");
});

// ============================================================ B1-C2, position baseline
test("C2: a nonzero position tip makes the gate refuse (tip), zero gate rows", async () => {
  const book = parkedWorld();
  await fullCarry(book);
  book.world.harness.db.prepare(
    `UPDATE position_state SET tip = 3 WHERE book_id = ?`).run(book.bookId);
  await expectCarryRefusal(book, "tip");
});

test("C2: a position_events journal row for the book makes the gate refuse (position_events), zero gate rows", async () => {
  const book = parkedWorld();
  await fullCarry(book);
  book.world.harness.db.prepare(
    `INSERT INTO position_events (book_id, event_id, receipt_seq, device_id,
       local_seq, kind, occurrence_id, offset_sec, base_seq, superseded, payload_json)
     VALUES (?, 'evt-foreign', 1, 'dev-x', 1, 'seek', ?, 0, 0, 0, '{}')`)
    .run(book.bookId, book.occIds[0]);
  await expectCarryRefusal(book, "position_events");
});

test("C2: playing = 1 on the carried position makes the gate refuse (playing), zero gate rows", async () => {
  const book = parkedWorld();
  await fullCarry(book);
  book.world.harness.db.prepare(
    `UPDATE position_state SET playing = 1 WHERE book_id = ?`).run(book.bookId);
  await expectCarryRefusal(book, "playing");
});

test("C2: superseded_count > 0 on the carried position makes the gate refuse (superseded_count), zero gate rows", async () => {
  const book = parkedWorld();
  await fullCarry(book);
  book.world.harness.db.prepare(
    `UPDATE position_state SET superseded_count = 2 WHERE book_id = ?`).run(book.bookId);
  await expectCarryRefusal(book, "superseded_count");
});

// ============================================================ B1-C2 scoping
test("C2 scoping: the no-playback baseline binds the gate only — after a successful gate, genuine device position events fold onto the carried state by the normal rules", async () => {
  const book = parkedWorld();
  const { coord, harness: h } = book.world;
  const B = book.bookId;
  await fullCarry(book);
  const g = await gate(book, certOf(book));
  assert.equal(g.outcome, "applied", JSON.stringify(g));

  // Nothing in the event path consults the baseline: a first
  // genuine event (baseSeq 0, exactly as checkpoint 2 requires)
  // folds as receipt 1 and the journal grows — post-flip
  // playback is legal and truthful, not restricted.
  const push = await coord.handleCommand({ command_id: cid(B, "postgate-push"),
    type: "PushPositionEvents",
    payload: { bookId: B, events: [{ eventId: "dev1-1", deviceId: "dev1",
      localSeq: 1, kind: "seek", occurrenceId: book.occIds[3],
      offsetSec: 7.5, baseSeq: 0 }] } },
    { actorId: "device-1", source: "sync" });
  assert.equal(push.outcomes[0].receiptSeq, 1);
  assert.equal(push.outcomes[0].superseded, false);
  const st = h.rows("position_state").find((r) => r.book_id === B);
  assert.deepEqual([st.occurrence_id, st.occ_index, st.offset_sec, st.tip],
    [book.occIds[3], 3, 7.5, 1],
    "the genuine event folded normally after the gate");
  assert.equal(h.rows("position_events").length, 1);
});
