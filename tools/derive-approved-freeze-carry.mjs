// Opal Reader v2 — derive the coordinator's pinned FREEZE CARRY
// manifest (B1 migration-state build; D4 proposal §3A.1/§3A.7,
// Rowan spec acceptance 6368503750).
//
// Usage: node tools/derive-approved-freeze-carry.mjs [--check]
//
// Reads Julie's approved frozen snapshot
// (~/workspace/opal-reader-p8-data) and emits
// v2/p8/approved-freeze-carry.mjs: per book, the carry pin the
// B1 migration-state commands check against —
//   * contentSha256: the canonical full-content hash (§3A.7) —
//     SHA-256 over the coordinator's canonicalJson of the book's
//     frozen content WITH the derived occurrenceIds included;
//   * the frozen position payload (opening occurrence + the
//     book record's offset into it + the adjudicated checkpoints,
//     verbatim) and its canonical payload hash;
//   * the job aggregate-set descriptor (§3A.5): ordered job IDs
//     + states + per-aggregate definitionDigest (the P7
//     transform's own digest, reused) + occurrence-set digests,
//     a set hash and a count — with an explicit signed empty-set
//     entry for every book that carries no jobs.
//
// DATA DISCIPLINE: metadata and digests only — occurrence ids,
// checkpoint coordinates, job definition PREIMAGES in exactly
// the shape transformJobs digests (ids/indices/repair fields and
// per-segment TEXT HASHES; never segment text), no audio bytes.
// The definition preimage is stored in the pin so the
// coordinator can write the frozen definition from the pin
// itself and later recompute its digest from the stored rows
// (§3A.5) — the caller only ever matches digests.
//
// Every care was taken to RECOMPUTE rather than copy: contents
// and job aggregates are re-derived here through the repo's P7
// transform (v2/migration/transform.mjs) from the snapshot's raw
// records, and cross-checked against the frozen run outputs
// (run/corpus.json) and the committed bindings/chunks pins. Any
// disagreement aborts the derivation. The position cloud claim
// is likewise recomputed from the book record (currentChapter /
// currentSegment / per-chapter playback checkpoints) and checked
// against the adjudicated corpus position.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { audioObjectIndex, transformBook, transformJobs } from "../v2/migration/transform.mjs";
import { digest as transformDigest, sha256hex } from "../v2/migration/util.mjs";
import { APPROVED_FREEZE_MANIFEST } from "../v2/p8/approved-freeze-manifest.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SNAP = process.env.OPAL_P8_DATA || join(homedir(), "workspace", "opal-reader-p8-data");
const EXPECTED_DIGEST = "1c73c56c8005660788a93d7283faae24abcd979ce110264c5da462ea82f2dc18";
const OUT = join(root, "v2", "p8", "approved-freeze-carry.mjs");
const checkOnly = process.argv.includes("--check");

// Canonical JSON (sorted keys, recursively) — the same discipline
// as v2/coordinator.mjs's canonicalJson; digests must agree.
function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort()
    .map(k => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(",")}}`;
}
const sha256HexText = (text) => createHash("sha256").update(text, "utf8").digest("hex");
const fail = (msg) => { console.error(`derive-approved-freeze-carry: ${msg}`); process.exit(1); };
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));

const snapshotManifest = readJson(join(SNAP, "snapshot-manifest.json"));
if (snapshotManifest.corpus_digest !== EXPECTED_DIGEST)
  fail(`snapshot corpus_digest ${snapshotManifest.corpus_digest} != approved ${EXPECTED_DIGEST}`);
if (APPROVED_FREEZE_MANIFEST.snapshotDigest !== EXPECTED_DIGEST)
  fail("committed bindings pin is for a different freeze than the approved snapshot");

const corpus = readJson(join(SNAP, "run", "corpus.json"));
const listings = readJson(join(SNAP, "listings.json"));
const booksRaw = readdirSync(join(SNAP, "books")).map((f) => readJson(join(SNAP, "books", f)));
const statuses = readdirSync(join(SNAP, "statuses")).map((f) => readJson(join(SNAP, "statuses", f)));
const audioIdx = audioObjectIndex(listings);
const bookById = new Map(booksRaw.map((b) => [b.id, b]));
const statusByJob = new Map(statuses.map((s) => [s.job_id, s]));

// ---- jobs: re-derive through the transform, cross-check the corpus.
const completeBookIds = new Set(booksRaw.filter((b) =>
  (b.chapters || []).every((ch) => (ch.segments || []).every((s) => s.audioKey || s.systemVoiceFallback)))
  .map((b) => b.id));
const jobsDerived = transformJobs(statuses, completeBookIds);
if (transformDigest(jobsDerived.inventory) !== transformDigest(corpus.jobs.inventory))
  fail("job inventory disagreement: re-derived transform output != frozen corpus");
if (jobsDerived.aggregates.length !== corpus.jobs.aggregates.length)
  fail("job aggregate count disagreement vs frozen corpus");
const corpusAggById = new Map(corpus.jobs.aggregates.map((a) => [a.jobId, a]));
for (const agg of jobsDerived.aggregates) {
  const want = corpusAggById.get(agg.jobId);
  if (!want || want.definitionDigest !== agg.definitionDigest ||
      want.v2State !== agg.v2State || want.chapterIndex !== agg.chapterIndex ||
      want.bookId !== agg.bookId)
    fail(`job aggregate disagreement vs frozen corpus: ${agg.jobId}`);
}

// The definition preimage in exactly the shape transformJobs
// digests (§3A.5) — rebuilt from the aggregate's own frozen
// status record through the transform's per-segment projection,
// and PROVEN by recomputing the digest: it must reproduce the
// aggregate's pinned definitionDigest bit-for-bit.
function definitionPreimage(agg) {
  const st = statusByJob.get(agg.jobId);
  if (!st) fail(`no frozen status record for aggregate ${agg.jobId}`);
  const pre = {
    job_id: st.job_id, book_id: st.book_id, chapter_index: st.chapter_index,
    total: st.total, completed: st.completed,
    segments: (st.segments || []).map((s) => ({
      id: s.id ?? null, segment_index: s.segment_index ?? null,
      repair_path: s.repair_path ?? null, repair_parent: s.repair_parent ?? null,
      text_sha: sha256hex(s.text ?? s.speechText ?? ""),
    })),
  };
  if (transformDigest(pre) !== agg.definitionDigest)
    fail(`definition preimage does not reproduce the pinned digest for ${agg.jobId}`);
  return pre;
}

// ---- per book: content hash, position payload, job set descriptor.
const EXPECTED_CONTENT_COUNTS = {
  "5c589095-f812-48a2-8ab2-03ba2791f2b2": 407, // Forever Pucked
  "48019197-b92e-4766-928e-5f73f7084e6d": 152, // Finding Home
  "f1b1e2f9-8c09-4f23-8290-472740923954": 209, // The Goal
  "1c6bc7a6-6ef7-45b9-9a58-f492a1526ea0": 203, // In Her Own League
  "89b2d4f1-d3b4-41ef-b59c-83800bec9f81": 654, // Pucked
  "067ddb04-d68f-4c5a-a368-ccd1d71876cd": 475, // Pucked Up
  "21f655a2-0b0a-4b62-86c9-3a3808dbab40": 510, // Pucked Over
};
const books = {};
let totalOccurrences = 0;
for (const [bookId, corpusBook] of Object.entries(corpus.books)) {
  const raw = bookById.get(bookId);
  if (!raw) fail(`corpus book ${bookId} has no frozen book record`);
  const t = transformBook(raw, audioIdx);
  if (canonicalJson(t.content) !== canonicalJson(corpusBook.content))
    fail(`content disagreement: re-derived transform output != frozen corpus for ${bookId}`);
  const occurrenceIds = t.content.chapters.flatMap((ch) => ch.segments.map((s) => s.occurrenceId));
  if (occurrenceIds.some((x) => !x) || new Set(occurrenceIds).size !== occurrenceIds.length)
    fail(`occurrence ids not non-null/unique for ${bookId}`);
  if (EXPECTED_CONTENT_COUNTS[bookId] !== undefined &&
      occurrenceIds.length !== EXPECTED_CONTENT_COUNTS[bookId])
    fail(`content count for ${bookId}: ${occurrenceIds.length} != expected ${EXPECTED_CONTENT_COUNTS[bookId]}`);
  totalOccurrences += occurrenceIds.length;
  const contentSha256 = sha256HexText(canonicalJson({ ...t.content, occurrenceIds }));
  // The bound subset must be exactly the committed bindings pin's
  // row set for this book (occurrence/revision/cacheKey).
  const pinRows = APPROVED_FREEZE_MANIFEST.books[bookId]?.rows || [];
  const r2 = t.bindings.filter((b) => b.kind === "r2");
  if (r2.length !== pinRows.length)
    fail(`bound row count for ${bookId}: ${r2.length} != bindings pin ${pinRows.length}`);
  const pinByOcc = new Map(pinRows.map((r) => [r[0], r]));
  for (const b of r2) {
    const pr = pinByOcc.get(b.occurrenceId);
    if (!pr || pr[1] !== b.revision || pr[2] !== b.cacheKey)
      fail(`bound row disagreement vs bindings pin at ${bookId}/${b.occurrenceId}`);
  }

  // Position: the adjudicated corpus position, with the cloud
  // claim recomputed independently from the book record.
  const pos = corpusBook.position;
  if (!pos || !pos.opening) fail(`no adjudicated position for ${bookId}`);
  const graph = t.content.chapters.map((ch) => ch.segments.map((s) => s.occurrenceId));
  const cc = Math.min(raw.currentChapter || 0, graph.length - 1);
  const cs = Math.min(raw.currentSegment || 0, graph[cc].length - 1);
  if (pos.opening.occurrenceId !== graph[cc][cs] ||
      pos.opening.chapterIndex !== cc || pos.opening.segmentIndex !== cs)
    fail(`position opening disagreement for ${bookId}: corpus claim != recomputed cloud claim`);
  const recomputedCheckpoints = (raw.chapters || []).map((ch, ci) => ch.playback
    ? { chapterIndex: ci,
        segmentIndex: Math.min(ch.playback.segment || 0, graph[ci].length - 1),
        occurrenceId: graph[ci][Math.min(ch.playback.segment || 0, graph[ci].length - 1)] }
    : null).filter(Boolean);
  if (canonicalJson(recomputedCheckpoints) !== canonicalJson(pos.checkpoints))
    fail(`position checkpoints disagreement for ${bookId}`);
  if (typeof raw.position !== "number" || !Number.isFinite(raw.position))
    fail(`book record position offset is not a finite number for ${bookId}`);
  const positionPayload = {
    bookId,
    position: { occurrenceId: pos.opening.occurrenceId, offsetSec: raw.position },
    checkpoints: pos.checkpoints,
  };
  const positionPayloadSha256 = sha256HexText(canonicalJson(positionPayload));

  // Jobs: this book's aggregates (transform order = jobId order),
  // each with its derived occurrence set over the aggregate's
  // chapter (§3A.3's stated rule: bound → ready; generation-
  // blocked → blocked_policy; otherwise → pending; the revision
  // key is the binding's revision when bound, the device-voice
  // revision for device-voice bindings, and the explicit marker
  // "unbound" when the occurrence has no binding — no revision
  // exists for it in any frozen record).
  const bindingByOcc = new Map(t.bindings.map((b) => [b.occurrenceId, b]));
  const blockedByOcc = new Map(t.outcomes.map((o) => [o.occurrenceId, o]));
  const aggregates = [];
  for (const agg of jobsDerived.aggregates.filter((a) => a.bookId === bookId)) {
    const chapter = t.content.chapters[agg.chapterIndex];
    if (!chapter) fail(`aggregate ${agg.jobId} names missing chapter ${agg.chapterIndex} of ${bookId}`);
    const occurrences = chapter.segments.map((seg) => {
      const b = bindingByOcc.get(seg.occurrenceId);
      if (b) return { occurrenceId: seg.occurrenceId, revisionKey: b.revision, state: "ready" };
      if (blockedByOcc.has(seg.occurrenceId))
        return { occurrenceId: seg.occurrenceId, revisionKey: "unbound", state: "blocked_policy" };
      return { occurrenceId: seg.occurrenceId, revisionKey: "unbound", state: "pending" };
    });
    aggregates.push({
      jobId: agg.jobId, chapterIndex: agg.chapterIndex,
      kind: "job", lane: "standard", v2State: agg.v2State, cause: agg.cause,
      definitionDigest: agg.definitionDigest,
      definition: definitionPreimage(agg),
      occurrenceSetSha256: sha256HexText(canonicalJson(occurrences)),
      occurrences,
    });
  }
  const descriptor = aggregates.map((a) => ({
    jobId: a.jobId, chapterIndex: a.chapterIndex, v2State: a.v2State,
    definitionDigest: a.definitionDigest, occurrenceSetSha256: a.occurrenceSetSha256,
  }));
  books[bookId] = {
    contentSha256, occurrenceCount: occurrenceIds.length, boundCount: r2.length,
    position: {
      occurrenceId: pos.opening.occurrenceId, offsetSec: raw.position,
      source: pos.source, checkpoints: pos.checkpoints,
      payloadSha256: positionPayloadSha256,
    },
    jobs: {
      count: aggregates.length,
      setSha256: sha256HexText(canonicalJson(descriptor)),
      aggregates,
    },
  };
}
if (totalOccurrences !== 2610) fail(`total content occurrences ${totalOccurrences} != 2610`);
const carryCounts = Object.values(books).map((b) => b.jobs.count);
if (carryCounts.reduce((a, b) => a + b, 0) !== 4)
  fail(`carryable job total ${carryCounts.reduce((a, b) => a + b, 0)} != 4 (FP 1 parked_policy + PO 3 superseded)`);

const lines = [];
lines.push("// Opal Reader v2 — the APPROVED FREEZE CARRY PIN (B1).");
lines.push("//");
lines.push("// The migration-state carry's authoritative identity for the");
lines.push("// approved freeze: per book, the canonical full-content hash");
lines.push("// (§3A.7 — SHA-256 over the coordinator's canonicalJson of");
lines.push("// the frozen content WITH the derived occurrenceIds), the");
lines.push("// frozen position payload + its canonical hash, and the job");
lines.push("// aggregate-set descriptor (§3A.5: ordered job IDs + states +");
lines.push("// per-aggregate definition/occurrence-set digests + set hash");
lines.push("// + count, with an explicit signed empty set for books that");
lines.push("// carry no jobs). Caller input may only MATCH this data,");
lines.push("// never define it. Generated by");
lines.push("// tools/derive-approved-freeze-carry.mjs from");
lines.push("// ~/workspace/opal-reader-p8-data — metadata and digests");
lines.push("// only: occurrence ids, checkpoint coordinates, definition");
lines.push("// preimages in the transform's digest shape (per-segment");
lines.push("// text HASHES, never text), no audio bytes. Do not");
lines.push("// hand-edit: regenerate.");
lines.push("");
lines.push(`export const APPROVED_FREEZE_CARRY = Object.freeze({`);
lines.push(`  snapshotDigest: ${JSON.stringify(EXPECTED_DIGEST)},`);
lines.push("  books: Object.freeze({");
for (const bookId of Object.keys(books).sort()) {
  const b = books[bookId];
  lines.push(`    ${JSON.stringify(bookId)}: Object.freeze({`);
  lines.push(`      contentSha256: ${JSON.stringify(b.contentSha256)},`);
  lines.push(`      occurrenceCount: ${b.occurrenceCount},`);
  lines.push(`      boundCount: ${b.boundCount},`);
  lines.push(`      position: Object.freeze({ occurrenceId: ${JSON.stringify(b.position.occurrenceId)}, offsetSec: ${JSON.stringify(b.position.offsetSec)}, source: ${JSON.stringify(b.position.source)}, payloadSha256: ${JSON.stringify(b.position.payloadSha256)}, checkpoints: Object.freeze(${JSON.stringify(b.position.checkpoints)}) }),`);
  lines.push(`      jobs: Object.freeze({ count: ${b.jobs.count}, setSha256: ${JSON.stringify(b.jobs.setSha256)}, aggregates: Object.freeze(${JSON.stringify(b.jobs.aggregates)}) }),`);
  lines.push("    }),");
}
lines.push("  }),");
lines.push("});");
lines.push("");
const text = lines.join("\n");

if (checkOnly) {
  const current = readFileSync(OUT, "utf8");
  if (current !== text) fail("committed carry pin differs from the derived carry pin (--check)");
  console.log("approved freeze carry pin: up to date");
} else {
  writeFileSync(OUT, text);
  console.log(`wrote ${OUT}`);
}
console.log(`books: ${Object.keys(books).length}, content occurrences: ${totalOccurrences}`);
for (const bookId of Object.keys(books).sort()) {
  const b = books[bookId];
  console.log(`  ${bookId}: content ${b.occurrenceCount} occ / ${b.boundCount} bound, jobs ${b.jobs.count} ` +
    `(${b.jobs.aggregates.map((a) => a.v2State).join(", ") || "signed empty set"}), checkpoints ${b.position.checkpoints.length}`);
}
