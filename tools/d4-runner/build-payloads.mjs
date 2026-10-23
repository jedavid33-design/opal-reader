// D4 runner — payload builder (D4 proposal §3B).
//
// PURE: frozen inputs in, deterministic command payloads plus a
// pre-run hash sheet out. No network, no storage, no clock, no
// randomness — the same freeze in produces byte-identical
// payloads out, so any payload can be re-derived and compared
// before it is ever sent.
//
// Sources of truth, and only these:
//   - the P7 transform output for the book (content, cast,
//     chapter/segment structure) — the content record presented
//     on chunk 1 is built here as the transform record PLUS the
//     deterministic occurrenceIds (§3A.7), byte-identical to the
//     construction the carry deriver pins;
//   - the committed chunk pin (which occurrences ride which
//     chunk, under which cache keys);
//   - the committed manifest pin (object keys, for the GET
//     estimates);
//   - the committed carry pin (positions + jobs payloads are
//     reduced from it — the pin is the payload's source, never
//     the other way around).
//
// Full binding digests: the freeze recorded only 16-hex digest
// PREFIXES for the audio (audio-results.jsonl, the audit
// workpapers); the full SHA-256 values live in R2 custom
// metadata — a live, separately gated read. The builder takes an
// injected digestOf(cacheKey) resolver; until one is supplied, a
// row's digest is null and the plan marks the payload
// digestPending — and the driver REFUSES to send a digestPending
// chunk. A guessed, zero, or prefix-extended digest is never
// constructed here.
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { audioObjectIndex, transformBook as transformBookImpl } from "../../v2/migration/transform.mjs";

export function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(",")}}`;
}
export function sha256HexText(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

// The §3A.7 content record: the transform's content record PLUS
// the ordered occurrenceIds — the flatmap, in order, of each
// segment's own occurrenceId. This is the exact construction
// tools/derive-approved-freeze-carry.mjs pins (it cross-checks
// the record against the frozen corpus); the pin-consistency
// tests prove the two agree on all seven real books, and
// buildBookPlan refuses a book whose content does not hash to
// its carry pin.
export function contentRecordFromTransform(t) {
  const occurrenceIds = t.content.chapters.flatMap((ch) =>
    ch.segments.map((s) => s.occurrenceId));
  return { ...t.content, occurrenceIds };
}

// Load one book straight from the frozen snapshot — the same
// inputs (books/*.json + listings.json) and the same transform
// the carry deriver reads. Returns the raw record and its
// transform, or null when the book is not in the snapshot.
export function loadSnapshotBook({ dataDir, bookId }) {
  const listings = JSON.parse(readFileSync(join(dataDir, "listings.json"), "utf8"));
  const audioIdx = audioObjectIndex(listings);
  for (const f of readdirSync(join(dataDir, "books"))) {
    const raw = JSON.parse(readFileSync(join(dataDir, "books", f), "utf8"));
    if (raw.id === bookId) return { raw, transformed: transformBookImpl(raw, audioIdx) };
  }
  return null;
}

// Build the full ordered command plan for one book:
//   chunks (F2/F3) → positions carry (F4) → jobs carry (F5),
// with deterministic command ids per the D3/D4 scheme. The flip
// gate (F8) is NOT part of the plan: it is sent only after the
// F7 acceptance read-back, via buildGateCommand. `content` is
// the §3A.7 content record (see contentRecordFromTransform).
export function buildBookPlan({ bookId, content, chunksEntry, manifestEntry, carry,
                                migrationId, freezeDigest, digestOf = null,
                                attestationOf = null }) {
  const contentSha256 = sha256HexText(canonicalJson(content));
  if (carry && contentSha256 !== carry.contentSha256)
    throw new Error(
      `content hash ${contentSha256} does not match the carry pin ` +
      `${carry.contentSha256} for book ${bookId} — refusing to build a plan`);
  // The chunk pin carries only the partition (start / rowCount /
  // rowsSha256 per chunk); the ROWS themselves are the manifest
  // pin's ordered row set, sliced per chunk. Manifest rows arrive
  // in either shape: the committed pin's tuples [occurrenceId,
  // revisionKey, cacheKey, size, format, sha256Prefix, etag] or
  // plain objects. Normalize once.
  const manifestRows = (manifestEntry?.rows || []).map((r) =>
    Array.isArray(r)
      ? { occurrenceId: r[0], revisionKey: r[1], cacheKey: r[2],
          size: r[3], format: r[4], sha256Prefix: r[5], etag: r[6] }
      : { occurrenceId: r.occurrenceId, revisionKey: r.revisionKey,
          cacheKey: r.cacheKey, size: r.size ?? r.manifest?.size,
          format: r.format ?? r.manifest?.format, objectKey: r.objectKey });
  const commands = [];
  const chunkSheets = [];
  let totalRows = 0, expectedGetsEstimate = 0, digestPendingRows = 0,
      attestationPendingRows = 0;
  (chunksEntry?.chunks || []).forEach((chunkPin, i) => {
    const slice = manifestRows.slice(chunkPin.start, chunkPin.start + chunkPin.rowCount);
    if (slice.length !== chunkPin.rowCount)
      throw new Error(
        `chunk ${i} of ${bookId} slices ${slice.length} rows, pin says ` +
        `${chunkPin.rowCount} — manifest/chunk pin disagreement, refusing to build`);
    let pendingAttestation = false;
    const rows = slice.map((m) => {
      const sha256 = digestOf ? digestOf(m.cacheKey) : null;
      if (!sha256) digestPendingRows += 1;
      // GET estimate (§3B): the prime probe tries .mp3 first, so
      // a row whose object lives at .wav costs one miss + one
      // hit. Labeled an estimate: it assumes every pinned object
      // is present at its pinned key (the import itself proves
      // that per row, or refuses).
      expectedGetsEstimate +=
        (m.objectKey && m.objectKey.endsWith(".wav")) || m.format === "wav" ? 2 : 1;
      const row = { occurrenceId: m.occurrenceId, revisionKey: m.revisionKey,
        cacheKey: m.cacheKey,
        manifest: { sha256, size: m.size, format: m.format } };
      // A binding whose revision is neither its fingerprint nor
      // a legacy key is a DISTINCT binding: the coordinator
      // requires its freeze provenance attestation in the row.
      // Like the full digest, the attestation is freeze data the
      // builder takes from an injected resolver — never invents.
      if (m.revisionKey !== m.cacheKey && m.revisionKey !== `legacy:${m.cacheKey}`) {
        const att = attestationOf ? attestationOf(m.cacheKey) : null;
        if (att) row.provenanceAttestation = att;
        else { attestationPendingRows += 1; pendingAttestation = true; }
      }
      return row;
    });
    totalRows += rows.length;
    const payload = { migrationId, freezeDigest, bookId, chunkIndex: i, rows };
    if (i === 0) payload.content = content;
    const cmd = { command_id: `${migrationId}:${bookId}:chunk:${i}`,
                  type: "MigrateImportChunk", payload,
                  ...(pendingAttestation ? { pendingAttestation: true } : {}) };
    commands.push(cmd);
    chunkSheets.push({ chunkIndex: i, rowCount: rows.length,
      rowsSha256: sha256HexText(canonicalJson(rows)),
      commandSha256: sha256HexText(canonicalJson(cmd)) });
  });
  let positionsSheet = null, jobsSheet = null;
  if (carry) {
    const positionsPayload = { migrationId, freezeDigest, bookId,
      position: { occurrenceId: carry.position.occurrenceId,
                  offsetSec: carry.position.offsetSec },
      checkpoints: carry.position.checkpoints };
    const positionsCmd = { command_id: `${migrationId}:${bookId}:positions`,
      type: "MigrateImportPositions", payload: positionsPayload };
    commands.push(positionsCmd);
    positionsSheet = { payloadSha256: carry.position.payloadSha256,
      commandSha256: sha256HexText(canonicalJson(positionsCmd)) };
    const jobsPayload = { migrationId, freezeDigest, bookId,
      aggregates: carry.jobs.aggregates.map((a) => ({
        jobId: a.jobId, chapterIndex: a.chapterIndex, kind: a.kind, lane: a.lane,
        v2State: a.v2State, definitionDigest: a.definitionDigest,
        occurrences: a.occurrences })) };
    const jobsCmd = { command_id: `${migrationId}:${bookId}:jobs`,
      type: "MigrateImportJobs", payload: jobsPayload };
    commands.push(jobsCmd);
    jobsSheet = { count: carry.jobs.count, setSha256: carry.jobs.setSha256,
      commandSha256: sha256HexText(canonicalJson(jobsCmd)) };
  }
  return {
    bookId,
    commands,
    hashSheet: {
      bookId,
      contentSha256,
      occurrenceCount: content.occurrenceIds.length,
      chunks: chunkSheets,
      chunkCount: chunkSheets.length,
      bindingRows: totalRows,
      expectedGetsEstimate,
      digestPendingRows,
      attestationPendingRows,
      positions: positionsSheet,
      jobs: jobsSheet,
    },
  };
}

// F8's gate command — built only when a certificate exists (the
// F7 acceptance reads it off the completed book's view) and
// Julie's per-book acceptance has been given. Deterministic id
// per the D3/D4 scheme.
export function buildGateCommand({ bookId, migrationId, certificateSha256 }) {
  return { command_id: `${migrationId}:${bookId}:gate`,
           type: "MigrateRecordFlipGate",
           payload: { bookId, migrationId, certificateSha256 } };
}

// The pre-run hash sheet (§3B): everything a reviewer needs to
// verify a run afterwards without trusting the runner — per-book
// content hash, per-chunk digests, carry payload hashes, and the
// GET expectations (estimates). Printed before anything is sent.
export function renderHashSheet(plans) {
  const lines = ["D4 pre-run hash sheet (GET counts are estimates)"];
  for (const plan of plans) {
    const s = plan.hashSheet;
    lines.push(`book ${s.bookId}`);
    lines.push(`  content sha256: ${s.contentSha256} (${s.occurrenceCount} occurrences)`);
    lines.push(`  chunks: ${s.chunkCount}, binding rows: ${s.bindingRows}, ` +
               `expected GETs (estimate): ${s.expectedGetsEstimate}, ` +
               `digest-pending rows: ${s.digestPendingRows}, ` +
               `attestation-pending rows: ${s.attestationPendingRows}`);
    for (const c of s.chunks)
      lines.push(`    chunk ${c.chunkIndex}: ${c.rowCount} rows, rows sha256 ${c.rowsSha256}`);
    if (s.positions) lines.push(`  positions payload sha256: ${s.positions.payloadSha256}`);
    if (s.jobs) lines.push(`  jobs: ${s.jobs.count} aggregates, set sha256 ${s.jobs.setSha256}`);
  }
  return lines.join("\n");
}
