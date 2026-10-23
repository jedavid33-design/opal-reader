// Opal Reader v2 — derive the coordinator's pinned approved-freeze
// manifest (G2 correction, Rowan re-review 6354569652).
//
// Usage: node tools/derive-approved-freeze-manifest.mjs [--check]
//
// Reads Julie's approved frozen snapshot (~/workspace/opal-reader-p8-data)
// and emits v2/p8/approved-freeze-manifest.mjs: the authoritative
// manifest identity the coordinator pins for MigrateImportBindings —
// the freeze's corpus digest plus, per book, the expected binding
// row set (occurrenceId / revisionKey / cacheKey / size / format /
// byte-pass SHA-256 prefix / freeze-listing etag) and its canonical
// row-set digest.
//
// DATA DISCIPLINE: only binding metadata is copied — keys, digests,
// sizes, formats, etags. No book text, no segment text, no audio
// bytes. The snapshot's byte-pass recorded SHA-256 as a 16-hex
// prefix per object (audio-results.jsonl); the pin binds exactly
// that evidence. The full digest of each object is verified from
// bytes inside the import operation itself and must carry this
// prefix (see v2/p8/migration-import-design.md, G2 addendum).
//
// Sources (all inside the snapshot directory):
//   snapshot-manifest.json  corpus_digest (must equal the digest
//                           Julie approved / the task pins)
//   run/corpus.json         per-book bindings (kind "r2" only — the
//                           7 "device-voice" rows name no R2 object
//                           and are not migration bindings)
//   audio-results.jsonl     the rehearsal byte-pass: per unique
//                           object { bytes, sha256 prefix, format }
//   listings.json           the freeze-time R2 listing: per object
//                           key { size, etag }
// Cross-check: ~/workspace/binding-audit-work/bindings.json (the
// per-binding audit's row set + revision forms) must agree exactly.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SNAP = process.env.OPAL_P8_DATA || join(homedir(), "workspace", "opal-reader-p8-data");
const AUDIT = process.env.OPAL_BINDING_AUDIT || join(homedir(), "workspace", "binding-audit-work");
const EXPECTED_DIGEST = "1c73c56c8005660788a93d7283faae24abcd979ce110264c5da462ea82f2dc18";
const OUT = join(root, "v2", "p8", "approved-freeze-manifest.mjs");
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

const fail = (msg) => { console.error(`derive-approved-freeze-manifest: ${msg}`); process.exit(1); };

const snapshotManifest = JSON.parse(readFileSync(join(SNAP, "snapshot-manifest.json"), "utf8"));
if (snapshotManifest.corpus_digest !== EXPECTED_DIGEST)
  fail(`snapshot corpus_digest ${snapshotManifest.corpus_digest} != approved ${EXPECTED_DIGEST}`);

const corpus = JSON.parse(readFileSync(join(SNAP, "run", "corpus.json"), "utf8"));
const bytePass = new Map();
for (const line of readFileSync(join(SNAP, "audio-results.jsonl"), "utf8").split("\n")) {
  if (!line.trim()) continue;
  const r = JSON.parse(line);
  bytePass.set(r.key, r);
}
const listing = new Map();
const listingsByPrefix = JSON.parse(readFileSync(join(SNAP, "listings.json"), "utf8"));
for (const entries of Object.values(listingsByPrefix))
  for (const e of entries) listing.set(e.key, e);
const auditRows = JSON.parse(readFileSync(join(AUDIT, "bindings.json"), "utf8"));
const auditByKey = new Map(auditRows.map(r => [`${r.bookId}${r.occurrenceId}`, r]));

const formOf = (revisionKey, cacheKey) =>
  revisionKey === cacheKey ? "fingerprinted"
  : revisionKey === `legacy:${cacheKey}` ? "legacy-anchor"
  : "fingerprinted-distinct";

const books = {};
const formCounts = { fingerprinted: 0, "legacy-anchor": 0, "fingerprinted-distinct": 0 };
let totalRows = 0;
for (const [bookId, book] of Object.entries(corpus.books)) {
  const rows = [];
  for (const b of book.bindings) {
    if (b.kind !== "r2") continue; // device-voice rows name no R2 object
    const bp = bytePass.get(b.cacheKey);
    if (!bp) fail(`no byte-pass record for ${b.cacheKey}`);
    const objectKey = `audio/${b.cacheKey}.${bp.format}`;
    const li = listing.get(objectKey);
    if (!li) fail(`no freeze listing entry for ${objectKey}`);
    if (li.size !== bp.bytes)
      fail(`size disagreement listing vs byte-pass for ${objectKey}: ${li.size} != ${bp.bytes}`);
    const form = formOf(b.revision, b.cacheKey);
    formCounts[form]++;
    const audit = auditByKey.get(`${bookId}${b.occurrenceId}`);
    if (!audit) fail(`audit row set missing ${bookId}/${b.occurrenceId}`);
    if (audit.cacheKey !== b.cacheKey || audit.revision !== b.revision)
      fail(`audit/corpus disagreement at ${bookId}/${b.occurrenceId}`);
    if (audit.revisionForm !== form)
      fail(`revision form disagreement at ${bookId}/${b.occurrenceId}: audit ${audit.revisionForm} != derived ${form}`);
    rows.push({
      occurrenceId: b.occurrenceId, revisionKey: b.revision, cacheKey: b.cacheKey,
      size: bp.bytes, format: bp.format, sha256Prefix: bp.sha256, etag: li.etag,
    });
  }
  rows.sort((a, z) => (a.occurrenceId < z.occurrenceId ? -1 : 1));
  books[bookId] = { rowSetSha256: sha256HexText(canonicalJson(rows)), rows };
  totalRows += rows.length;
}
if (totalRows !== auditRows.length)
  fail(`row count ${totalRows} != audit row count ${auditRows.length}`);
if (totalRows !== 1799) fail(`row count ${totalRows} != 1799`);
if (formCounts.fingerprinted !== 1148 || formCounts["legacy-anchor"] !== 620 ||
    formCounts["fingerprinted-distinct"] !== 31)
  fail(`revision form counts ${JSON.stringify(formCounts)} != 1148/620/31`);

const lines = [];
lines.push("// Opal Reader v2 — the APPROVED FREEZE MANIFEST, pinned in code");
lines.push("// (G2 correction; Rowan re-review 6354569652).");
lines.push("//");
lines.push("// This module is the coordinator-side authoritative manifest");
lines.push("// identity for MigrateImportBindings: the freeze Julie approved");
lines.push("// (corpus digest below) and, per book, the expected binding row");
lines.push("// set with its canonical digest. Caller input may only MATCH");
lines.push("// this data, never define it. Generated by");
lines.push("// tools/derive-approved-freeze-manifest.mjs from");
lines.push("// ~/workspace/opal-reader-p8-data — binding metadata only");
lines.push("// (keys, digests, sizes, formats, etags); no book text, no");
lines.push("// audio bytes. sha256Prefix is the freeze byte-pass record's");
lines.push("// 16-hex SHA-256 prefix per object: the freeze recorded");
lines.push("// prefixes, so the pin binds prefixes; the full digest is");
lines.push("// verified from bytes inside the import operation and must");
lines.push("// carry the pinned prefix. Do not hand-edit: regenerate.");
lines.push("");
lines.push(`export const APPROVED_FREEZE_SNAPSHOT_DIGEST = ${JSON.stringify(EXPECTED_DIGEST)};`);
lines.push("");
lines.push("export const APPROVED_FREEZE_BOOKS = {");
for (const bookId of Object.keys(books).sort()) {
  const book = books[bookId];
  lines.push(`  ${JSON.stringify(bookId)}: {`);
  lines.push(`    rowSetSha256: ${JSON.stringify(book.rowSetSha256)},`);
  lines.push("    rows: [");
  for (const r of book.rows)
    lines.push(`      [${JSON.stringify(r.occurrenceId)}, ${JSON.stringify(r.revisionKey)}, ` +
      `${JSON.stringify(r.cacheKey)}, ${r.size}, ${JSON.stringify(r.format)}, ` +
      `${JSON.stringify(r.sha256Prefix)}, ${JSON.stringify(r.etag)}],`);
  lines.push("    ],");
  lines.push("  },");
}
lines.push("};");
lines.push("");
lines.push("// Row tuple field order: occurrenceId, revisionKey, cacheKey,");
lines.push("// size, format, sha256Prefix, etag.");
lines.push("export const APPROVED_FREEZE_MANIFEST = Object.freeze({");
lines.push("  snapshotDigest: APPROVED_FREEZE_SNAPSHOT_DIGEST,");
lines.push("  books: APPROVED_FREEZE_BOOKS,");
lines.push("});");
lines.push("");
const text = lines.join("\n");

if (checkOnly) {
  const current = readFileSync(OUT, "utf8");
  if (current !== text) fail("committed manifest differs from the derived manifest (--check)");
  console.log("approved freeze manifest: up to date");
} else {
  writeFileSync(OUT, text);
  console.log(`wrote ${OUT}`);
}
console.log(`books: ${Object.keys(books).length}, rows: ${totalRows}, forms: ${JSON.stringify(formCounts)}`);
for (const bookId of Object.keys(books).sort())
  console.log(`  ${bookId}: ${books[bookId].rows.length} rows, rowSetSha256 ${books[bookId].rowSetSha256}`);
