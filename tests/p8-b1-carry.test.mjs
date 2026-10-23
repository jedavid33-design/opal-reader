// Opal Reader v2 — P8 B1: the migration-state carry (D4 proposal
// §3A, Rowan's spec acceptance 6368503750 + its three
// implementation checkpoints).
//
// What is proven here, at coordinator level:
//   - the two operator-fenced carry commands land the frozen
//     positions and job aggregates EXACTLY as pinned (direct
//     state writes — no journal fabrication, no SubmitJob
//     lifecycle), with durable audit + receipts;
//   - checkpoint 1: altered-but-binding-compatible content is
//     refused at chunk 1 in the pre-prime path — zero R2 GETs,
//     zero migration business rows, a durable REJECTED receipt
//     (which is the legitimate record of the refusal);
//   - checkpoint 2: a carried position_state has the correct
//     occ_index, and genuine device events fold onto it by the
//     normal causality rules (baseSeq 0 → receipt 1; a later
//     stale backward event is superseded, never a regression);
//   - checkpoint 3: a carried parked_policy / superseded job is
//     inert against direct AND indirect grant paths, with full
//     rollback (no grant/outbox/schedule/quota-ledger rows);
//   - P5: the jobs set proof is exact (omission / extra /
//     duplicate / wrong state / wrong digest all refuse the
//     whole transaction; signed empty sets carry with receipt +
//     audit and zero job rows);
//   - P6: the flip gate fails closed server-side until both
//     carries verify three-way (audit = stored = pin), writing
//     zero gate rows on every refusal; G4 semantics unchanged.
// All data is synthetic; all worlds run the coordinator through
// the standard harness.
import test from "node:test";
import assert from "node:assert/strict";
import { JOB_EVENTS } from "../v2/coordinator.mjs";
import { canonical as canonicalJson } from "../v2/migration/util.mjs";
import {
  makeWorld, seedRow, chunkCmd, gateCmd, positionsCmd, jobsCmd,
  SYNTHETIC_FREEZE_DIGEST,
} from "./helpers/migration-fixtures.mjs";

const MIG = "mig-b1";
const FREEZE = SYNTHETIC_FREEZE_DIGEST;
const OP = { actorId: "op", source: "sync" };
const SMALL = { maxRowsPerChunk: 2, maxChunkBytes: 64 * 1024 * 1024, maxItemBytes: 16 * 1024 * 1024 };
const cid = (bookId, kind, n = 0) => `${MIG}:${bookId}:${kind}${n ? `:${n}` : ""}`;

// A synthetic carry world: `contentCount` content occurrences,
// the first `boundCount` bound; a pinned position; pinned jobs
// (default: none). Chunk slices follow SMALL (2 rows per chunk).
function carryWorld({ bookId = "b1-book", contentCount = 6, boundCount = 4,
                      positionAt = 2, positionOffset = 42.25, jobs = [],
                      checkpoints = [{ chapterIndex: 0, segmentIndex: 1, offsetSec: 3.5 }],
                      pinCarry = true } = {}) {
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
  if (pinCarry)
    world.pinBookCarry(bookId, {
      content,
      position: { occurrenceId: occIds[positionAt], offsetSec: positionOffset, checkpoints },
      jobs });
  const rows = seeded.map((s) => s.row);
  const chunks = [];
  for (let i = 0; i < rows.length; i += SMALL.maxRowsPerChunk)
    chunks.push(rows.slice(i, i + SMALL.maxRowsPerChunk));
  return { world, bookId, occIds, content, chunks, rows, seeded,
           carry: world.carryManifest.books[bookId] || null };
}

// The Forever-Pucked-shaped parked job: one chapter aggregate in
// parked_policy with ready / blocked_policy / pending occurrences.
function parkedJobFor(w, { jobId = "b1-parked", chapterIndex = 1 } = {}) {
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
function supersededJobFor(w, { jobId, chapterIndex = 0 } = {}) {
  return { jobId, chapterIndex, v2State: "superseded",
           cause: "v1 remnant job (no live v1 counterpart)",
           definition: { kind: "job", bookId: w.bookId, chapterIndex, lane: "standard",
             batchJobName: null, migrationProvenance: "synthetic", statusSegments: [] },
           occurrences: [
             { occurrenceId: w.occIds[0], revisionKey: w.seeded[0].revisionKey, state: "ready" },
             { occurrenceId: w.occIds[1], revisionKey: w.seeded[1].revisionKey, state: "ready" }] };
}

async function importAll(book) {
  for (let i = 0; i < book.chunks.length; i++) {
    const r = await book.world.coord.handleCommand(chunkCmd(cid(book.bookId, "chunk", i), {
      migrationId: MIG, freezeDigest: FREEZE, bookId: book.bookId, chunkIndex: i,
      content: i === 0 ? book.content : undefined, rows: book.chunks[i] }), OP);
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

// ============================================================ happy path
test("B1 happy path: chunks + positions + jobs carries land exactly as pinned; the view verifies three-way; the gate applies", async () => {
  const book = carryWorld({ jobs: [] });
  book.world.pinBookCarry(book.bookId, {
    content: book.content,
    position: { occurrenceId: book.occIds[2], offsetSec: 42.25,
                checkpoints: [{ chapterIndex: 0, segmentIndex: 1, offsetSec: 3.5 }] },
    jobs: [parkedJobFor(book)] });
  book.carry = book.world.carryManifest.books[book.bookId];
  const { coord, harness: h } = book.world;
  const B = book.bookId;
  await fullCarry(book);

  // Position: direct state write, tip 0, NO journal event.
  const st = h.rows("position_state").find((r) => r.book_id === B);
  assert.deepEqual(
    { occurrence_id: st.occurrence_id, occ_index: st.occ_index,
      offset_sec: st.offset_sec, playing: st.playing, tip: st.tip },
    { occurrence_id: book.occIds[2], occ_index: 2, offset_sec: 42.25, playing: 0, tip: 0 });
  assert.equal(h.rows("position_events").length, 0,
    "the carry never fabricates a position journal event");

  // Job: inserted directly in parked_policy at revision 1, the
  // frozen definition stored from the pin, occurrences as pinned.
  const job = h.rows("jobs").find((r) => r.job_id === "b1-parked");
  assert.equal(job.state, "parked_policy");
  assert.equal(job.revision, 1);
  assert.equal(job.data_json, canonicalJson(book.carry.jobs.aggregates[0].definition));
  assert.deepEqual(
    h.rows("occurrences").filter((r) => r.job_id === "b1-parked")
      .map((r) => [r.occurrence_id, r.revision_key, r.state]),
    book.carry.jobs.aggregates[0].occurrences
      .map((o) => [o.occurrenceId, o.revisionKey, o.state]));
  const prov = h.rows("transitions").find((r) => r.aggregate_id === "b1-parked");
  assert.equal(prov.cause, "MigrateImportJobs", "provenance: carried, never lived");
  assert.equal(prov.to_state, "parked_policy");

  // Audit: one row per kind, hashes equal to the pin.
  const audits = h.rows("migration_carry").filter((r) => r.book_id === B);
  assert.equal(audits.length, 2);
  assert.equal(audits.find((r) => r.kind === "positions").payload_hash,
    book.carry.position.payloadSha256);
  assert.equal(audits.find((r) => r.kind === "jobs").payload_hash,
    book.carry.jobs.setSha256);

  // The carry moved no money and issued no work.
  assert.equal(h.rows("ledger_ops").length, 0);
  assert.equal(h.rows("grants").length, 0);
  assert.equal(h.rows("outbox").length, 0);

  // Read-back: three-way verification + gate preconditions.
  const view = coord.migrationBookView(B);
  assert.equal(view.carry.ok, true, JSON.stringify(view.carry.divergences));
  assert.equal(view.carry.positions.view.canonical.occurrenceId, book.occIds[2]);
  assert.equal(view.carry.positions.stored.occIndex, 2);
  assert.deepEqual(view.carry.positions.checkpoints,
    [{ chapterIndex: 0, segmentIndex: 1, offsetSec: 3.5 }]);
  assert.equal(view.carry.jobs.aggregates[0].definitionVerified, true);
  assert.deepEqual(view.carry.gatePreconditions,
    { bindingsComplete: true, positionsCarried: true, jobsCarried: true,
      carryVerified: true, ready: true });

  // The gate now applies — one row, durable.
  const g = await gate(book, certOf(book));
  assert.equal(g.outcome, "applied", JSON.stringify(g));
  assert.equal(h.rows("migration_gates").length, 1);
});

test("B1: carries compose with the whole-book import path as well (staging surface shape)", async () => {
  const book = carryWorld({});
  const { coord, harness: h } = book.world;
  const { importCmd } = await import("./helpers/migration-fixtures.mjs");
  const r = await coord.handleCommand(importCmd(cid(book.bookId, "whole"), {
    migrationId: MIG, freezeDigest: FREEZE, bookId: book.bookId,
    content: book.content, rows: book.rows }), OP);
  assert.equal(r.outcome, "applied", JSON.stringify(r));
  assert.equal((await carryPositions(book)).outcome, "applied");
  assert.equal((await carryJobs(book)).outcome, "applied");
  const g = await gate(book, certOf(book));
  assert.equal(g.outcome, "applied", JSON.stringify(g));
  assert.equal(h.rows("migration_gates").length, 1);
});

// ============================================================ checkpoint 1
test("checkpoint 1a: swapped-POV content (identical binding IDs) is refused at chunk 1 — zero GETs, zero migration business rows, durable rejected receipt", async () => {
  const book = carryWorld({});
  const { coord, harness: h, bucket } = book.world;
  const tampered = { title: `${book.bookId} — a different cast entirely`,
                     occurrenceIds: book.occIds };
  const r = await coord.handleCommand(chunkCmd(cid(book.bookId, "chunk", 0), {
    migrationId: MIG, freezeDigest: FREEZE, bookId: book.bookId, chunkIndex: 0,
    content: tampered, rows: book.chunks[0] }), OP);
  assert.equal(r.outcome, "rejected");
  assert.equal(r.reason, "migration_content_mismatch");
  assert.equal(bucket.getCalls, 0, "refused before any R2 contact");
  assert.equal(bucket.putCalls.length, 0);
  for (const t of ["migration_books", "migration_chunks", "migration_carry", "bindings"])
    assert.equal(h.rows(t).length, 0, `${t}: zero migration business rows`);
  assert.equal(h.rows("sync_entities").length, 0);
  // The refusal itself is durably recorded — and labeled as a
  // rejection, never confused with an import row.
  const receipts = h.rows("commands");
  assert.equal(receipts.length, 1);
  assert.equal(receipts[0].outcome, "rejected");
  assert.match(receipts[0].outcome_json, /migration_content_mismatch/);
  const replay = await coord.handleCommand(chunkCmd(cid(book.bookId, "chunk", 0), {
    migrationId: MIG, freezeDigest: FREEZE, bookId: book.bookId, chunkIndex: 0,
    content: tampered, rows: book.chunks[0] }), OP);
  assert.equal(replay.replayed, true);
  assert.equal(replay.reason, "migration_content_mismatch");
  assert.equal(bucket.getCalls, 0, "a refused id never re-executes");
});

test("checkpoint 1b: reordered-chapters content (identical binding IDs) is refused the same way; the pin-correct content then applies under a retry-generation id", async () => {
  const book = carryWorld({});
  const { coord, bucket } = book.world;
  const reordered = { title: book.bookId, occurrenceIds: [...book.occIds].reverse() };
  const r = await coord.handleCommand(chunkCmd(cid(book.bookId, "chunk", 0), {
    migrationId: MIG, freezeDigest: FREEZE, bookId: book.bookId, chunkIndex: 0,
    content: reordered, rows: book.chunks[0] }), OP);
  assert.equal(r.outcome, "rejected");
  assert.equal(r.reason, "migration_content_mismatch");
  assert.equal(bucket.getCalls, 0);
  const fixed = await coord.handleCommand(chunkCmd(`${cid(book.bookId, "chunk", 0)}:g2`, {
    migrationId: MIG, freezeDigest: FREEZE, bookId: book.bookId, chunkIndex: 0,
    content: book.content, rows: book.chunks[0] }), OP);
  assert.equal(fixed.outcome, "applied", JSON.stringify(fixed));
});

// ============================================================ checkpoint 2
test("checkpoint 2: the carried position has the correct occ_index; a genuine baseSeq-0 event folds as receipt 1; a stale backward event is superseded, never a regression", async () => {
  const book = carryWorld({});
  const { coord, harness: h } = book.world;
  await importAll(book);
  await carryPositions(book);
  const B = book.bookId;
  let st = h.rows("position_state")[0];
  assert.equal(st.occ_index, 2, "occ_index derived from the content's ordered occurrenceIds");
  assert.equal(st.tip, 0);

  const push = (id, ev) => coord.handleCommand({ command_id: id, type: "PushPositionEvents",
    payload: { bookId: B, events: [ev] } }, { actorId: "device-1", source: "sync" });
  // First genuine device event, based on the pre-carry tip (0).
  const r1 = await push("push-1", { eventId: "dev1-1", deviceId: "dev1", localSeq: 1,
    kind: "seek", occurrenceId: book.occIds[3], offsetSec: 7.5, baseSeq: 0 });
  assert.equal(r1.outcomes[0].receiptSeq, 1);
  assert.equal(r1.outcomes[0].superseded, false);
  st = h.rows("position_state")[0];
  assert.deepEqual([st.occurrence_id, st.occ_index, st.offset_sec, st.tip],
    [book.occIds[3], 3, 7.5, 1], "the genuine event folds onto the carried state");

  // A later stale event (also baseSeq 0) pointing BACKWARD:
  // recorded, superseded, position unmoved.
  const r2 = await push("push-2", { eventId: "dev1-2", deviceId: "dev1", localSeq: 2,
    kind: "seek", occurrenceId: book.occIds[0], offsetSec: 1, baseSeq: 0 });
  assert.equal(r2.outcomes[0].superseded, true);
  st = h.rows("position_state")[0];
  assert.deepEqual([st.occurrence_id, st.occ_index, st.offset_sec, st.tip, st.superseded_count],
    [book.occIds[3], 3, 7.5, 2, 1], "no regression: truth stays at the folded position");
  assert.equal(h.rows("position_events").length, 2,
    "both genuine events journaled; the carry itself journaled none");
  const view = coord.positionView(B);
  assert.equal(view.canonical.occurrenceId, book.occIds[3]);
  assert.equal(view.asOfReceiptSeq, 2);
});

// ============================================================ checkpoint 3
test("checkpoint 3: a carried parked_policy job with pending occurrences refuses direct + indirect grants with full rollback; RequestResume refuses; the quota ledger is byte-identical after every carry operation", async () => {
  const book = carryWorld({});
  book.world.pinBookCarry(book.bookId, {
    content: book.content,
    position: { occurrenceId: book.occIds[2], offsetSec: 42.25, checkpoints: [] },
    jobs: [parkedJobFor(book)] });
  book.carry = book.world.carryManifest.books[book.bookId];
  const { coord, harness: h } = book.world;
  await fullCarry(book);
  // The rollback claim, stated precisely: the work tables are
  // BYTE-IDENTICAL before and after every refused attempt (the
  // one pre-existing schedule row is the coordinator's own
  // watchdog, kind "watchdog" with ref null — it names no job
  // and is not the refused operation's doing).
  const workTables = () => JSON.stringify({
    grants: h.rows("grants"), outbox: h.rows("outbox"),
    schedule: h.rows("schedule"), ledger: h.rows("ledger_ops") });
  const before = workTables();
  assert.equal(h.rows("grants").length, 0);
  assert.equal(h.rows("outbox").length, 0);
  assert.equal(h.rows("ledger_ops").length, 0);
  assert.ok(h.rows("schedule").every((s) => s.ref === null || s.ref !== "b1-parked"));

  // Direct grant attempt (the work-source entry): _issueGrant
  // tentatively writes, applyJobEvent vetoes, everything rolls
  // back — the refusal Rowan checkpoint 3 demands be proven.
  const g = await coord.requestGrant("b1-parked");
  assert.equal(g.ok, false, JSON.stringify(g));
  assert.equal(g.reason, "illegal_transition");
  assert.ok(!g.grantId, `no grant may issue for a parked job: ${JSON.stringify(g)}`);
  assert.equal(workTables(), before,
    "the tentative grant rolled back completely — no grant, outbox, schedule, or ledger residue");
  let job = h.rows("jobs").find((r) => r.job_id === "b1-parked");
  assert.deepEqual([job.state, job.revision], ["parked_policy", 1]);
  assert.deepEqual(
    h.rows("occurrences").filter((r) => r.job_id === "b1-parked").map((r) => r.state),
    ["ready", "blocked_policy", "pending"], "no occurrence moved");

  // Indirect: resume (the probe-grant path) refuses.
  const r = await coord.handleCommand({ command_id: "resume-parked", type: "RequestResume",
    payload: { jobId: "b1-parked" } });
  assert.equal(r.outcome, "rejected");
  assert.equal(workTables(), before);

  // Indirect: an alarm cycle fires nothing FOR THE CARRIED JOB —
  // no retry_grant schedule names it (the only schedules are the
  // coordinator's own watchdog rows, ref null), no grant issues,
  // and the job does not move. (The watchdog re-arming itself is
  // ordinary housekeeping, byte-visible above and unrelated.)
  h.advance(60_000);
  await h.fireAlarm();
  assert.equal(h.rows("grants").length, 0);
  assert.equal(h.rows("outbox").length, 0);
  assert.equal(h.rows("ledger_ops").length, 0);
  assert.ok(h.rows("schedule").every((s) => s.ref !== "b1-parked"),
    "no schedule row ever references the carried job");
  job = h.rows("jobs").find((x) => x.job_id === "b1-parked");
  assert.deepEqual([job.state, job.revision], ["parked_policy", 1]);
});

test("checkpoint 3b: a carried superseded job refuses grants and resume identically", async () => {
  const book = carryWorld({});
  book.world.pinBookCarry(book.bookId, {
    content: book.content,
    position: { occurrenceId: book.occIds[2], offsetSec: 42.25, checkpoints: [] },
    jobs: [supersededJobFor(book, { jobId: "b1-superseded" })] });
  book.carry = book.world.carryManifest.books[book.bookId];
  const { coord, harness: h } = book.world;
  await fullCarry(book);
  const g = await coord.requestGrant("b1-superseded");
  assert.ok(!g.grantId);
  const r = await coord.handleCommand({ command_id: "resume-sup", type: "RequestResume",
    payload: { jobId: "b1-superseded" } });
  assert.equal(r.outcome, "rejected");
  assert.equal(h.rows("grants").length, 0);
  assert.equal(h.rows("outbox").length, 0);
  assert.equal(h.rows("ledger_ops").length, 0);
  const job = h.rows("jobs").find((x) => x.job_id === "b1-superseded");
  assert.deepEqual([job.state, job.revision], ["superseded", 1]);
});

test("checkpoint 3c: no lifecycle event transitions a carried job — the parked_policy / superseded rows of the table are empty and enforced", async () => {
  const book = carryWorld({});
  book.world.pinBookCarry(book.bookId, {
    content: book.content,
    position: { occurrenceId: book.occIds[2], offsetSec: 42.25, checkpoints: [] },
    jobs: [parkedJobFor(book), supersededJobFor(book, { jobId: "b1-sup2" })] });
  book.carry = book.world.carryManifest.books[book.bookId];
  const { coord, harness: h } = book.world;
  await fullCarry(book);
  for (const jobId of ["b1-parked", "b1-sup2"]) {
    for (const event of JOB_EVENTS) {
      const r = coord._tx(() => coord.applyJobEvent(jobId, event, "b1-inertness-probe"));
      assert.equal(r.ok, false, `${jobId} --${event} must reject`);
      assert.equal(r.reason, "illegal_transition");
    }
    const job = h.rows("jobs").find((x) => x.job_id === jobId);
    assert.equal(job.revision, 1, "no event bumped the carried revision");
  }
});

// ============================================================ P5 negatives
// Every malformed jobs payload refuses the WHOLE transaction:
// zero job rows, zero occurrence rows, zero carry audit.
async function p5World() {
  const book = carryWorld({});
  book.world.pinBookCarry(book.bookId, {
    content: book.content,
    position: { occurrenceId: book.occIds[2], offsetSec: 42.25, checkpoints: [] },
    jobs: [parkedJobFor(book),
           supersededJobFor(book, { jobId: "b1-remnant" })] });
  book.carry = book.world.carryManifest.books[book.bookId];
  await importAll(book);
  return book;
}
const jobsPayloadOf = (book) => ({
  migrationId: MIG, freezeDigest: FREEZE, bookId: book.bookId,
  aggregates: book.carry.jobs.aggregates.map((a) => ({
    jobId: a.jobId, chapterIndex: a.chapterIndex, kind: a.kind, lane: a.lane,
    v2State: a.v2State, definitionDigest: a.definitionDigest,
    occurrences: a.occurrences })) });
const sendJobs = (book, payload, id = cid(book.bookId, "jobs")) =>
  book.world.coord.handleCommand(
    { command_id: id, type: "MigrateImportJobs", payload }, OP);
function assertNoJobRows(book) {
  const h = book.world.harness;
  assert.equal(h.rows("jobs").length, 0, "zero job rows after a refused set");
  assert.equal(h.rows("occurrences").length, 0, "zero occurrence rows");
  assert.equal(h.rows("migration_carry").filter((r) => r.kind === "jobs").length, 0,
    "zero jobs-carry audit rows");
}

test("P5: omitting one pinned aggregate refuses the whole jobs transaction", async () => {
  const book = await p5World();
  const payload = jobsPayloadOf(book);
  payload.aggregates = payload.aggregates.slice(1); // drop the parked job
  const r = await sendJobs(book, payload);
  assert.equal(r.outcome, "rejected");
  assert.equal(r.reason, "migration_carry_mismatch");
  assert.equal(r.element, "job_set");
  assertNoJobRows(book);
});

test("P5: an extra aggregate refuses the whole jobs transaction", async () => {
  const book = await p5World();
  const payload = jobsPayloadOf(book);
  payload.aggregates.push({ ...payload.aggregates[0], jobId: "b1-extra" });
  const r = await sendJobs(book, payload);
  assert.equal(r.outcome, "rejected");
  assert.equal(r.element, "job_set");
  assertNoJobRows(book);
});

test("P5: a duplicated aggregate refuses (duplicate_row)", async () => {
  const book = await p5World();
  const payload = jobsPayloadOf(book);
  payload.aggregates.push(payload.aggregates[0]);
  const r = await sendJobs(book, payload);
  assert.equal(r.outcome, "rejected");
  assert.equal(r.reason, "duplicate_row");
  assertNoJobRows(book);
});

test("P5: a wrong state refuses the whole jobs transaction", async () => {
  const book = await p5World();
  const payload = jobsPayloadOf(book);
  payload.aggregates[0].v2State = "superseded"; // pinned: parked_policy
  const r = await sendJobs(book, payload);
  assert.equal(r.outcome, "rejected");
  assert.equal(r.element, "job_set");
  assertNoJobRows(book);
});

test("P5: a wrong definition digest refuses the whole jobs transaction", async () => {
  const book = await p5World();
  const payload = jobsPayloadOf(book);
  payload.aggregates[0].definitionDigest = "0".repeat(64);
  const r = await sendJobs(book, payload);
  assert.equal(r.outcome, "rejected");
  assert.equal(r.element, "job_set");
  assertNoJobRows(book);
});

test("P5: a wrong occurrence digest refuses the whole jobs transaction", async () => {
  const book = await p5World();
  const payload = jobsPayloadOf(book);
  payload.aggregates[0].occurrences[2].state = "ready"; // pinned: pending
  const r = await sendJobs(book, payload);
  assert.equal(r.outcome, "rejected");
  assert.equal(r.element, "job_set");
  assertNoJobRows(book);
});

test("P5: a non-carryable state is refused by construction (state_not_carryable)", async () => {
  const book = await p5World();
  const payload = jobsPayloadOf(book);
  payload.aggregates[0].v2State = "queued";
  const r = await sendJobs(book, payload);
  assert.equal(r.outcome, "rejected");
  assert.equal(r.element, "state_not_carryable");
  assertNoJobRows(book);
});

test("P5: the jobs carry before the import completes refuses (import_incomplete)", async () => {
  const book = carryWorld({});
  book.world.pinBookCarry(book.bookId, {
    content: book.content,
    position: { occurrenceId: book.occIds[2], offsetSec: 42.25, checkpoints: [] },
    jobs: [parkedJobFor(book)] });
  book.carry = book.world.carryManifest.books[book.bookId];
  const r = await sendJobs(book, jobsPayloadOf(book));
  assert.equal(r.outcome, "rejected");
  assert.equal(r.element, "import_incomplete");
  assertNoJobRows(book);
});

test("P5 empty set: a signed-empty book carries with receipt + audit and zero job rows; replay returns the same receipt; a new id converges without a second audit", async () => {
  const book = carryWorld({}); // pinBookCarry default: jobs []
  const { coord, harness: h } = book.world;
  await importAll(book);
  const r = await carryJobs(book);
  assert.equal(r.outcome, "applied", JSON.stringify(r));
  assert.deepEqual(r.jobs, { count: 0, setSha256: book.carry.jobs.setSha256 });
  assert.equal(h.rows("jobs").length, 0);
  const audits = h.rows("migration_carry").filter((x) => x.kind === "jobs");
  assert.equal(audits.length, 1, "the empty set still writes its audit — presented and pin-matched, not skipped");
  assert.equal(audits[0].payload_hash, book.carry.jobs.setSha256);
  const replay = await carryJobs(book);
  assert.equal(replay.replayed, true);
  assert.equal(replay.outcome, "applied");
  const converged = await coord.handleCommand(
    { command_id: cid(book.bookId, "jobs", 2), type: "MigrateImportJobs",
      payload: jobsPayloadOf(book) }, OP);
  assert.equal(converged.outcome, "applied");
  assert.equal(converged.converged, true);
  assert.equal(h.rows("migration_carry").filter((x) => x.kind === "jobs").length, 1,
    "convergence writes no second audit row");
});

// ============================================================ positions negatives
test("positions negatives: offset / occurrence / checkpoint divergence from the pin each refuse with zero rows", async () => {
  for (const mutate of [
    (p) => { p.position.offsetSec = 99.5; },
    (p) => { p.position.occurrenceId = p.position.occurrenceId.replace("seg-003", "seg-004"); },
    (p) => { p.checkpoints = [{ chapterIndex: 9, segmentIndex: 9, offsetSec: 9 }]; },
  ]) {
    const book = carryWorld({});
    const { coord, harness: h } = book.world;
    await importAll(book);
    const payload = { migrationId: MIG, freezeDigest: FREEZE, bookId: book.bookId,
      position: { occurrenceId: book.carry.position.occurrenceId,
                  offsetSec: book.carry.position.offsetSec },
      checkpoints: book.carry.position.checkpoints };
    mutate(payload);
    const r = await coord.handleCommand(
      { command_id: cid(book.bookId, "positions"), type: "MigrateImportPositions", payload }, OP);
    assert.equal(r.outcome, "rejected");
    assert.equal(r.reason, "migration_carry_mismatch");
    assert.equal(h.rows("position_state").length, 0);
    assert.equal(h.rows("migration_carry").length, 0);
  }
});

test("positions negatives: carry before the import completes refuses; wrong migration identity refuses; a book with no carry pin refuses (book_unpinned)", async () => {
  const early = carryWorld({});
  const r1 = await carryPositions(early);
  assert.equal(r1.outcome, "rejected");
  assert.equal(r1.element, "import_incomplete");

  const book = carryWorld({});
  await importAll(book);
  const wrongMig = await book.world.coord.handleCommand(
    { command_id: cid(book.bookId, "positions"), type: "MigrateImportPositions",
      payload: { migrationId: "mig-someone-else", freezeDigest: FREEZE, bookId: book.bookId,
        position: { occurrenceId: book.carry.position.occurrenceId,
                    offsetSec: book.carry.position.offsetSec },
        checkpoints: book.carry.position.checkpoints } }, OP);
  assert.equal(wrongMig.outcome, "rejected");
  assert.equal(wrongMig.element, "migration_identity");

  const unpinned = carryWorld({ pinCarry: false });
  await importAll(unpinned);
  const r3 = await unpinned.world.coord.handleCommand(
    { command_id: cid(unpinned.bookId, "positions"), type: "MigrateImportPositions",
      payload: { migrationId: MIG, freezeDigest: FREEZE, bookId: unpinned.bookId,
        position: { occurrenceId: unpinned.occIds[2], offsetSec: 42.25 }, checkpoints: [] } }, OP);
  assert.equal(r3.outcome, "rejected");
  assert.equal(r3.element, "book_unpinned");
  assert.equal(unpinned.world.coord.migrationBookView(unpinned.bookId).carry, null,
    "no carry section for a book outside the carry pin");
});

test("positions: the same payload under a new command id converges (one audit row); a divergent second carry refuses", async () => {
  const book = carryWorld({});
  const { coord, harness: h } = book.world;
  await importAll(book);
  await carryPositions(book);
  const again = await coord.handleCommand(positionsCmd(cid(book.bookId, "positions", 2), {
    migrationId: MIG, freezeDigest: FREEZE, bookId: book.bookId, carry: book.carry }), OP);
  assert.equal(again.outcome, "applied");
  assert.equal(again.converged, true);
  assert.equal(h.rows("migration_carry").filter((r) => r.kind === "positions").length, 1);
  assert.equal(h.rows("position_state").length, 1);
});

test("positions: a fail-safe-shaped position (first occurrence, offset 0) is carried exactly as pinned", async () => {
  const book = carryWorld({ positionAt: 0, positionOffset: 0 });
  const { harness: h } = book.world;
  await importAll(book);
  const r = await carryPositions(book);
  assert.equal(r.outcome, "applied", JSON.stringify(r));
  const st = h.rows("position_state")[0];
  assert.deepEqual([st.occurrence_id, st.occ_index, st.offset_sec],
    [book.occIds[0], 0, 0]);
});

// ============================================================ P6 negatives
test("P6: gate after chunks only refuses flip_gate_carry_incomplete with zero gate rows, naming both missing carries", async () => {
  const book = carryWorld({});
  book.world.pinBookCarry(book.bookId, {
    content: book.content,
    position: { occurrenceId: book.occIds[2], offsetSec: 42.25, checkpoints: [] },
    jobs: [parkedJobFor(book)] });
  book.carry = book.world.carryManifest.books[book.bookId];
  const { harness: h } = book.world;
  await importAll(book);
  const g = await gate(book, certOf(book));
  assert.equal(g.outcome, "rejected");
  assert.equal(g.reason, "flip_gate_carry_incomplete");
  assert.deepEqual(g.missing, ["positions_carry", "jobs_carry"]);
  assert.equal(h.rows("migration_gates").length, 0);
});

test("P6: gate after positions only / after jobs only refuses, naming the missing carry, zero gate rows", async () => {
  const a = carryWorld({});
  a.world.pinBookCarry(a.bookId, {
    content: a.content,
    position: { occurrenceId: a.occIds[2], offsetSec: 42.25, checkpoints: [] },
    jobs: [parkedJobFor(a)] });
  a.carry = a.world.carryManifest.books[a.bookId];
  await importAll(a);
  await carryPositions(a);
  const ga = await gate(a, certOf(a));
  assert.equal(ga.reason, "flip_gate_carry_incomplete");
  assert.deepEqual(ga.missing, ["jobs_carry"]);
  assert.equal(a.world.harness.rows("migration_gates").length, 0);

  const b = carryWorld({});
  b.world.pinBookCarry(b.bookId, {
    content: b.content,
    position: { occurrenceId: b.occIds[2], offsetSec: 42.25, checkpoints: [] },
    jobs: [parkedJobFor(b)] });
  b.carry = b.world.carryManifest.books[b.bookId];
  await importAll(b);
  await carryJobs(b);
  const gb = await gate(b, certOf(b));
  assert.equal(gb.reason, "flip_gate_carry_incomplete");
  assert.deepEqual(gb.missing, ["positions_carry"]);
  assert.equal(b.world.harness.rows("migration_gates").length, 0);
});

test("P6: tampering the positions audit after a full carry makes the gate refuse, zero gate rows", async () => {
  const book = carryWorld({});
  const { harness: h } = book.world;
  await fullCarry(book);
  h.db.prepare(`UPDATE migration_carry SET payload_json = ? WHERE kind = 'positions'`)
    .run(canonicalJson({ bookId: book.bookId,
      position: { occurrenceId: book.occIds[2], offsetSec: 42.25 },
      checkpoints: [{ chapterIndex: 0, segmentIndex: 0, offsetSec: 0 }] }));
  const g = await gate(book, certOf(book));
  assert.equal(g.outcome, "rejected");
  assert.equal(g.reason, "flip_gate_carry_incomplete");
  assert.ok(g.divergences.length > 0);
  assert.equal(h.rows("migration_gates").length, 0);
});

test("P6: tampering a stored job row after a full carry makes the gate refuse, zero gate rows", async () => {
  const book = carryWorld({});
  book.world.pinBookCarry(book.bookId, {
    content: book.content,
    position: { occurrenceId: book.occIds[2], offsetSec: 42.25, checkpoints: [] },
    jobs: [parkedJobFor(book)] });
  book.carry = book.world.carryManifest.books[book.bookId];
  const { harness: h } = book.world;
  await fullCarry(book);
  h.db.prepare(`UPDATE jobs SET data_json = '{}' WHERE job_id = 'b1-parked'`).run();
  const g = await gate(book, certOf(book));
  assert.equal(g.outcome, "rejected");
  assert.equal(g.reason, "flip_gate_carry_incomplete");
  assert.ok(g.divergences.some((d) => d.field === "definition_digest"));
  assert.equal(h.rows("migration_gates").length, 0);
});

test("P6: deleting a pinned job row after a full carry makes the gate refuse (missing_job), zero gate rows", async () => {
  const book = carryWorld({});
  book.world.pinBookCarry(book.bookId, {
    content: book.content,
    position: { occurrenceId: book.occIds[2], offsetSec: 42.25, checkpoints: [] },
    jobs: [parkedJobFor(book)] });
  book.carry = book.world.carryManifest.books[book.bookId];
  const { harness: h } = book.world;
  await fullCarry(book);
  h.db.prepare(`DELETE FROM occurrences WHERE job_id = 'b1-parked'`).run();
  h.db.prepare(`DELETE FROM jobs WHERE job_id = 'b1-parked'`).run();
  const g = await gate(book, certOf(book));
  assert.equal(g.outcome, "rejected");
  assert.equal(g.reason, "flip_gate_carry_incomplete");
  assert.ok(g.divergences.some((d) => d.field === "missing_job"));
  assert.equal(h.rows("migration_gates").length, 0);
});

test("P6 regression: G4 binding completeness still refuses FIRST (a deleted binding is a G4 refusal, not a carry refusal)", async () => {
  const book = carryWorld({});
  const { harness: h } = book.world;
  await fullCarry(book);
  h.db.prepare(`DELETE FROM bindings WHERE occurrence_id = ?`).run(book.occIds[0]);
  const g = await gate(book, certOf(book));
  assert.equal(g.outcome, "rejected");
  assert.notEqual(g.reason, "flip_gate_carry_incomplete",
    "the pre-B1 G4 check keeps its own refusal and its own order");
  assert.equal(h.rows("migration_gates").length, 0);
});

test("P6 regression: a book with NO carry pin keeps the pre-B1 gate semantics — no carries required", async () => {
  const book = carryWorld({ pinCarry: false });
  const { harness: h } = book.world;
  await importAll(book);
  const g = await gate(book, certOf(book));
  assert.equal(g.outcome, "applied", JSON.stringify(g));
  assert.equal(h.rows("migration_gates").length, 1);
});
