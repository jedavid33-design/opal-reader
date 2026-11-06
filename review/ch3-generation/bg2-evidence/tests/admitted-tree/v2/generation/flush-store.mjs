// D6 (WS-2) — flush-before-commit R2 store (CONTRACTS.md §flush-store;
// proposal §4 Blocker A / D10).
//
// The durability gate for D6 generation: synthesized audio bytes are
// flushed to R2 AND verified there (existence + size + ETag via HEAD,
// then a prime digest over a full GET) before any binding/report
// commit may happen. This module owns only the R2 side; the executor
// sequences execution-record states around it, and the coordinator
// commit (genstore.commitVerified) runs only after flushAndVerify
// returns.
//
// Fail-closed rules (mirroring the B7 R2FlushError discipline in
// worker/host/adapters.mjs, restated for the D6 execution record):
//   - the PUT is conditional (create-if-absent, onlyIf
//     etagDoesNotMatch "*") and is NEVER retried unconditionally;
//   - a PUT that throws leaves the outcome indeterminate ->
//     FlushError(stage "flush", code "flush_indeterminate");
//   - a lost race (PUT returns null) adopts the winner ONLY when the
//     winner's bytes digest-equal the synthesized bytes; a differing
//     winner is FlushError(stage "flush", code
//     "winner_digest_mismatch"), never an overwrite;
//   - any HEAD/prime disagreement after a successful PUT is
//     FlushError(stage "verify", code "verify_*"); the object, if
//     present, is preserved in place for the job report to flag.
import { createHash } from "node:crypto";

export function sha256Hex(value) {
  const h = createHash("sha256");
  if (typeof value === "string") h.update(value, "utf8");
  else if (value instanceof Uint8Array) h.update(value);
  else if (value instanceof ArrayBuffer) h.update(new Uint8Array(value));
  else if (ArrayBuffer.isView(value))
    h.update(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
  else h.update(String(value), "utf8");
  return h.digest("hex");
}

export class FlushError extends Error {
  constructor(stage, code, message) {
    super(message || `flush-store ${stage} failure: ${code}`);
    this.name = "FlushError";
    this.stage = stage; // "flush" | "verify"
    this.code = code;
  }
}

const AUDIO_EXTENSIONS = ["wav", "mp3"];

function bytesOf(audio) {
  if (audio instanceof Uint8Array) return audio;
  if (audio instanceof ArrayBuffer) return new Uint8Array(audio);
  if (ArrayBuffer.isView(audio)) return new Uint8Array(audio.buffer, audio.byteOffset, audio.byteLength);
  return new TextEncoder().encode(String(audio ?? ""));
}

// createFlushStore(bucket, { keyPrefix })
// bucket is the R2 binding shape: put(key, value, opts) ->
// { etag, size, customMetadata } | null; head(key) ->
// { size, etag, customMetadata } | null; get(key) ->
// { arrayBuffer(), etag, size, customMetadata } | null.
export function createFlushStore(bucket, { keyPrefix = "" } = {}) {
  if (!bucket) throw new Error("createFlushStore requires an R2 bucket");
  const objectKeyFor = (cacheKey, format) => `${keyPrefix}audio/${cacheKey}.${format}`;

  // Full GET + digest for an object key. Returns
  // { sha256, etag, sizeBytes, objectKey } or null when absent.
  async function digestOfKey(objectKey) {
    const object = await bucket.get(objectKey);
    if (!object) return null;
    const bytes = new Uint8Array(await object.arrayBuffer());
    return {
      sha256: sha256Hex(bytes),
      etag: object.etag ?? null,
      sizeBytes: bytes.byteLength,
      objectKey,
    };
  }

  // flushAndVerify(cacheKey, bytes, format, durationSec)
  // -> { objectKey, etag, sizeBytes, sha256, adopted? }
  // Throws FlushError on any flush/verify failure.
  async function flushAndVerify(cacheKey, bytes, format, durationSec) {
    const data = bytesOf(bytes);
    const fmt = format === "wav" ? "wav" : "mp3";
    const objectKey = objectKeyFor(cacheKey, fmt);
    const sha256 = sha256Hex(data);

    let created;
    try {
      created = await bucket.put(objectKey, data, {
        httpMetadata: { contentType: fmt === "wav" ? "audio/wav" : "audio/mpeg" },
        customMetadata: {
          sha256, identity: cacheKey,
          ...(durationSec != null ? { duration_seconds: String(durationSec) } : {}),
        },
        onlyIf: { etagDoesNotMatch: "*" },
      });
    } catch (e) {
      // Indeterminate: the write may or may not have landed. Fail
      // closed — never retry unconditionally.
      throw new FlushError("flush", "flush_indeterminate",
        `flush: conditional PUT for ${objectKey} failed indeterminately (${(e && e.message) || e}); refusing any unconditional retry`);
    }

    if (created === null || created === undefined) {
      // Lost race: another writer's object occupies the key. Adopt it
      // ONLY if its bytes are exactly the bytes we synthesized.
      let winner = null;
      try { winner = await digestOfKey(objectKey); } catch { winner = null; }
      if (!winner)
        throw new FlushError("flush", "winner_unverifiable",
          `flush: a competing object exists at ${objectKey} but its bytes could not be re-read for digest verification; failing closed without overwriting`);
      if (winner.sha256 !== sha256)
        throw new FlushError("flush", "winner_digest_mismatch",
          `flush: competing object at ${objectKey} has sha256 ${winner.sha256}, expected ${sha256}; failing closed without overwriting`);
      return { objectKey, etag: winner.etag, sizeBytes: winner.sizeBytes, sha256, adopted: true };
    }

    // Verify step 1 (HEAD): exists + size + ETag all agree with the
    // flush response.
    let head;
    try { head = await bucket.head(objectKey); }
    catch (e) {
      throw new FlushError("verify", "verify_head_failed",
        `verify: HEAD for ${objectKey} failed (${(e && e.message) || e})`);
    }
    if (!head)
      throw new FlushError("verify", "verify_missing",
        `verify: object ${objectKey} absent on HEAD immediately after a successful PUT`);
    if (head.size !== data.byteLength)
      throw new FlushError("verify", "verify_size_mismatch",
        `verify: HEAD size ${head.size} != synthesized size ${data.byteLength} for ${objectKey}`);
    if (created.etag != null && head.etag !== created.etag)
      throw new FlushError("verify", "verify_etag_mismatch",
        `verify: HEAD etag ${head.etag} != PUT etag ${created.etag} for ${objectKey}`);

    // Verify step 2 (prime digest): a full GET whose computed digest
    // must equal the synthesized digest — metadata agreement alone is
    // never enough.
    let primed;
    try { primed = await digestOfKey(objectKey); }
    catch (e) {
      throw new FlushError("verify", "verify_prime_failed",
        `verify: GET for prime digest of ${objectKey} failed (${(e && e.message) || e})`);
    }
    if (!primed)
      throw new FlushError("verify", "verify_missing",
        `verify: object ${objectKey} absent on GET immediately after a successful PUT`);
    if (primed.sha256 !== sha256)
      throw new FlushError("verify", "verify_digest_mismatch",
        `verify: prime digest ${primed.sha256} != synthesized digest ${sha256} for ${objectKey}`);

    return {
      objectKey,
      etag: created.etag ?? primed.etag,
      sizeBytes: created.size ?? data.byteLength,
      sha256,
    };
  }

  // headVerify(objectKey, { sizeBytes, etag }) -> bool
  // The recovery path's cheap re-verification: the object exists and
  // every recorded fact supplied agrees with HEAD. Any read failure
  // is a false, never a throw — recovery decides what a false means.
  async function headVerify(objectKey, { sizeBytes = null, etag = null } = {}) {
    let head;
    try { head = await bucket.head(objectKey); } catch { return false; }
    if (!head) return false;
    if (sizeBytes != null && head.size !== sizeBytes) return false;
    if (etag != null && head.etag !== etag) return false;
    return true;
  }

  // primeDigest(cacheKeyOrObjectKey) -> { sha256, etag, sizeBytes,
  // objectKey } | null via GET. Accepts a bare cache key (tries the
  // known audio extensions) or a full object key.
  async function primeDigest(cacheKeyOrObjectKey) {
    const arg = String(cacheKeyOrObjectKey ?? "");
    if (!arg) return null;
    if (/^[a-f0-9]{64}$/.test(arg)) {
      for (const ext of AUDIO_EXTENSIONS) {
        let found = null;
        try { found = await digestOfKey(objectKeyFor(arg, ext)); } catch { found = null; }
        if (found) return found;
      }
      return null;
    }
    try { return await digestOfKey(arg); } catch { return null; }
  }

  return { objectKeyFor, flushAndVerify, headVerify, primeDigest };
}
