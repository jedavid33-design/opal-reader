// P8 migration-import test fixtures: a recording fake R2 bucket and
// synthetic freeze-manifest builders. ALL data here is synthetic —
// byte strings derived from tags, shaped like the real corpus'
// binding classes (fingerprinted / fingerprinted-distinct / legacy
// anchor) without touching a single real key, digest, or byte.
import { createR2AudioCache, sha256Hex } from "../../v2/host/adapters.mjs";
import { makeHarness } from "./do-harness.mjs";

export { sha256Hex };

// A bucket that records every write attempt. The migration path
// must perform ZERO puts across every scenario, success or failure.
export class RecordingBucket {
  constructor() { this.map = new Map(); this.putCalls = []; this.getCalls = 0; }
  seed(objectKey, bytes, customMetadata = {}, etag = null) {
    this.map.set(objectKey, {
      bytes: new Uint8Array(bytes), customMetadata,
      etag: etag ?? `"etag:${objectKey}"`,
    });
  }
  async get(key) {
    this.getCalls++;
    const e = this.map.get(key);
    if (!e) return null;
    return { arrayBuffer: async () => e.bytes.slice().buffer,
             customMetadata: e.customMetadata, httpMetadata: {}, etag: e.etag };
  }
  async head(key) {
    const e = this.map.get(key);
    return e ? { size: e.bytes.length } : null;
  }
  async put(key, bytes, opts = {}) {
    this.putCalls.push(key);
    if (opts.onlyIf?.etagDoesNotMatch === "*" && this.map.has(key)) return null;
    this.map.set(key, { bytes: new Uint8Array(bytes),
      customMetadata: opts.customMetadata || {}, etag: '"put-etag"' });
    return { key };
  }
  // Canonical digest of everything in the bucket: any mutation —
  // write, overwrite, delete — changes it.
  digestAll() {
    const lines = [...this.map.entries()].sort()
      .map(([k, e]) => `${k}:${e.bytes.length}:${sha256Hex(e.bytes)}:${JSON.stringify(e.customMetadata)}`);
    return sha256Hex(lines.join("\n"));
  }
}

// Deterministic synthetic "audio": the tag, hashed and stretched to
// a fixed length. Never real audio; format is carried by the object
// key's extension exactly as the host's format evidence works.
export function syntheticBytes(tag, length = 96) {
  const seed = sha256Hex(`synthetic:${tag}`);
  const out = new Uint8Array(length);
  for (let i = 0; i < length; i++) out[i] = parseInt(seed.slice((i % 32) * 2, (i % 32) * 2 + 2), 16) ^ (i & 0x1f);
  return out;
}

// The v1 customMetadata shape (audit §5.1): provider/voice/format
// only — NO identity, NO sha256. The recorded identity of such an
// object defaults to its cache key; its digest must be recomputed
// from bytes by any honest reader.
export const v1Meta = (format = "mp3") => ({ provider: "gemini", voiceId: "SyntheticVoice", format });

// Canonical JSON (sorted keys, recursively) — the same discipline
// as v2/coordinator.mjs's canonicalJson, duplicated here so these
// fixtures (and the tests built on them) also load against older
// source trees for negative demonstrations.
function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort()
    .map(k => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(",")}}`;
}

// The synthetic approved freeze (G2): tests pin the books they
// import into a manifest with this digest, in exactly the shape
// the coordinator's committed pin uses — { snapshotDigest, books:
// { [bookId]: { rowSetSha256, rows: [[occurrenceId, revisionKey,
// cacheKey, size, format, sha256Prefix, etag], ...] } } }.
export const SYNTHETIC_FREEZE_DIGEST = "freeze-digest-synthetic";

export function pinnedEntry(pairs) {
  const rows = pairs.map(({ row, etag }) => ({
    occurrenceId: row.occurrenceId, revisionKey: row.revisionKey,
    cacheKey: row.cacheKey, size: row.manifest.size, format: row.manifest.format,
    sha256Prefix: row.manifest.sha256.slice(0, 16), etag }));
  rows.sort((a, b) => (a.occurrenceId < b.occurrenceId ? -1 : 1));
  return { rowSetSha256: sha256Hex(canonicalJson(rows)),
           rows: rows.map(r => [r.occurrenceId, r.revisionKey, r.cacheKey,
             r.size, r.format, r.sha256Prefix, r.etag]) };
}

// A world: recording bucket + the REAL R2 audio cache (for the
// prime) + a harness coordinator wired with env.migrationPrime.
// The coordinator starts genuinely cold: empty cache_index, and
// the cache snapshot is never hydrated. The world carries a
// synthetic approved-freeze manifest (G2): a test pins each book
// it imports with pinBook() BEFORE importing — an unpinned book
// is refused migration_freeze_unapproved, exactly as production
// refuses anything outside Julie's approved freeze.
export function makeWorld({ freezeDigest = SYNTHETIC_FREEZE_DIGEST } = {}) {
  const bucket = new RecordingBucket();
  const cache = createR2AudioCache(bucket);
  const manifest = { snapshotDigest: freezeDigest, books: {} };
  const harness = makeHarness({
    probe: cache.probe,
    extraEnv: { migrationPrime: (k) => cache.primeForMigration(k),
                approvedFreezeManifest: manifest },
  });
  return { bucket, cache, harness, coord: harness.coord, manifest,
           pinBook(bookId, pairs) { manifest.books[bookId] = pinnedEntry(pairs); } };
}

// Seed one object and return the manifest row for it.
// form: "fingerprinted" (revisionKey == cacheKey == sha256(bytes)),
// "legacy" (revisionKey == legacy:<cacheKey>), or "distinct"
// (revisionKey is a fingerprint of a DIFFERENT slicing — the 31's
// shape; cacheKey is the retained audio's own fingerprint).
export function seedRow(bucket, { bookId, occurrenceId, form = "fingerprinted",
                                  format = "mp3", meta = null, tag = null }) {
  const bytes = syntheticBytes(tag ?? `${bookId}:${occurrenceId}`);
  const audioSha = sha256Hex(bytes);
  let cacheKey, revisionKey;
  if (form === "fingerprinted") { cacheKey = audioSha; revisionKey = audioSha; }
  else if (form === "legacy") { cacheKey = `synthetic-legacy-${bookId}-${occurrenceId}`; revisionKey = `legacy:${cacheKey}`; }
  else if (form === "distinct") {
    cacheKey = audioSha;
    revisionKey = sha256Hex(`resliced:${bookId}:${occurrenceId}`);
  } else throw new Error(`unknown form ${form}`);
  const objectKey = `audio/${cacheKey}.${format}`;
  bucket.seed(objectKey, bytes, meta ?? v1Meta(format));
  const etag = `"etag:${objectKey}"`;
  return {
    bytes, cacheKey, revisionKey, objectKey, etag,
    row: { occurrenceId, revisionKey, cacheKey,
           manifest: { sha256: audioSha, size: bytes.length, format } },
  };
}

// The freeze-snapshot attestation for a seeded row (design §5),
// built from the listing facts exactly as the freeze recorded them.
export function attestationFor(seeded, { bookId, freezeDigest }) {
  return {
    kind: "freeze_snapshot_attestation",
    snapshotDigest: freezeDigest,
    bookId, occurrenceId: seeded.row.occurrenceId,
    revisionKey: seeded.revisionKey, cacheKey: seeded.cacheKey,
    sha256: seeded.row.manifest.sha256, size: seeded.row.manifest.size,
    format: seeded.row.manifest.format,
    r2Key: seeded.objectKey, r2Etag: seeded.etag,
    identityLimitation: "v1_metadata_no_identity",
  };
}

export function importCmd(commandId, { migrationId, freezeDigest, bookId, content, rows }) {
  return { command_id: commandId, type: "MigrateImportBindings",
           payload: { migrationId, freezeDigest, bookId, content, rows } };
}
export function gateCmd(commandId, { migrationId, bookId, certificateSha256 }) {
  return { command_id: commandId, type: "MigrateRecordFlipGate",
           payload: { migrationId, bookId, certificateSha256 } };
}
