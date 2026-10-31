// Opal Reader v2 — D5-A authenticated audio-byte route
// (design: opal-reader-v2-p8-d5a-d5b-design-v2 §2).
//
// This module serves exactly one route shape, at the production
// worker entry's R2 layer (§2.2):
//
//   GET  /v2/sync/audio/<cacheKey>.<format>
//   HEAD /v2/sync/audio/<cacheKey>.<format>
//
// <cacheKey> must match ^[a-f0-9]{64}$ and <format> must be
// exactly mp3 or wav. The server constructs exactly ONE object
// key — `audio/<cacheKey>.<format>` — from those two validated
// parts. It does not probe the other extension, does not accept a
// caller-supplied object key, and never follows a redirect.
//
// Placement and state (§2.2): the production entry invokes this
// handler only AFTER its existing production gate (scope → token
// → instance, §2.3, order unchanged) has admitted the request.
// The handler itself performs no gate logic and touches no
// Durable Object state: it is stateless, reads R2 only (HEAD-style
// metadata lookup + GET), and writes NOTHING — no coordinator
// schema, no R2 put/delete, no queue, no provider contact.
//
// HTTP contract (§2.5, RFC 9110 §§13/14): single-range only, with
// the design's normative matrix — oversized ends clamped, zero
// suffix / start ≥ size / start > end / multiple ranges refused
// 416, unknown units and malformed Range headers IGNORED (200 full
// body, RFC behaviour — never a silent fallback for an understood
// but unsatisfiable range), If-Range honoured only on a strong
// ETag match, If-None-Match evaluated first (304 even when a Range
// is present), HEAD ignoring Range entirely and answering from
// metadata alone. Every response carries the §2.6 privacy headers
// (`Cache-Control: private, no-store`) alongside the entry's
// exact-origin CORS behaviour, which is passed in (`cors`) and
// preserved verbatim — never replaced.
//
// Validators: the route issues the R2 object's ETag as a strong
// ETag on 200/206/304 responses. It issues no Last-Modified, so
// If-Modified-Since is inert here by design (§2.5).
//
// Errors (§2.7): malformed key/format → 400 invalid_audio_key;
// absent object (including a format mismatch — the other format
// is never probed) → 404 audio_not_found; a storage failure the
// entry can distinguish — binding missing, bucket throw, or a
// head/get size inconsistency (the object the bucket describes is
// not the object it returns) → 503 audio_storage_unavailable.
// Error bodies are JSON {error: <code>} and contain no token, no
// signed URL, no credential, and no book text.
//
// Repair pass (Rowan proof review 6388683241, items 5 / D5-A):
// A1 — the coordinator's production R2 namespace invariant
// (_enforceR2Namespace on the production surface: production
// scope with a non-empty R2_KEY_PREFIX is refused BEFORE any R2
// contact) is replicated at this boundary, because this route
// reads R2 directly from the entry and never constructs the
// coordinator's cache. Production scope + a non-empty prefix →
// 503 production_r2_prefix_forbidden before ANY R2 operation.
// Non-production scopes keep their existing behaviour.
// A2 — validator integrity: the GET object's ETag is compared
// against the HEAD metadata ETag the validators were built
// from, not only its size. A same-size replacement between HEAD
// and GET therefore fails closed (503
// audio_storage_unavailable, §2.7) instead of being served under
// the stale validator.

export const AUDIO_PATH_PREFIX = "/v2/sync/audio/";
export const AUDIO_EXPOSE_HEADERS = "accept-ranges, content-range, content-length, etag";

const CONTENT_TYPES = { mp3: "audio/mpeg", wav: "audio/wav" };
const AUDIO_SEGMENT = /^([a-f0-9]{64})\.(mp3|wav)$/;

export function isAudioPath(pathname) {
  return typeof pathname === "string" && pathname.startsWith(AUDIO_PATH_PREFIX);
}

function jsonError(status, code, headers) {
  return new Response(JSON.stringify({ error: code }), {
    status, headers: { "content-type": "application/json", ...headers },
  });
}

// The object's ETag in strong (quoted) form. R2 etags arrive
// already quoted on some surfaces and bare on others; the wire
// form this route issues is always the quoted strong form, and
// every comparison below is made against it consistently.
function strongEtag(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  const s = String(raw);
  return s.startsWith('"') ? s : `"${s}"`;
}
function etagContent(raw) {
  if (raw === null || raw === undefined) return null;
  let s = String(raw).trim();
  if (s.startsWith("W/")) s = s.slice(2).trim();
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1);
  return s;
}

// If-None-Match (§2.5 precedence rule 1): weak comparison per
// RFC 9110 §13.1.2 — `*` matches any current representation, and
// a listed tag matches when its opaque content equals the
// object's, weak prefix or not.
function ifNoneMatchMatches(header, etag) {
  if (!header) return false;
  const current = etagContent(etag);
  for (const part of String(header).split(",")) {
    const candidate = part.trim();
    if (candidate === "*") return true;
    if (current !== null && etagContent(candidate) === current) return true;
  }
  return false;
}

// If-Range (§2.5 precedence rule 2): the Range is honoured ONLY
// on an exact strong-ETag match. A weak tag, a non-matching tag,
// or a date-form value (which can never match — this route issues
// no Last-Modified) all mean the Range is ignored.
function ifRangeMatches(header, etag) {
  if (etag === null) return false;
  const value = String(header).trim();
  if (value.startsWith("W/")) return false;
  return value === etag;
}

// Parse a Range header against the object size (§2.5 table).
// Returns one of:
//   { kind: "ignore" }                          — unknown unit or
//     malformed: the header is ignored and the full 200
//     representation is served (RFC 9110 §14.2 behaviour).
//   { kind: "unsatisfiable" }                   — an understood
//     bytes range that names no satisfiable bytes (zero suffix,
//     start ≥ size, start > end), or a multiple-range request,
//     which this contract intentionally refuses: 416.
//   { kind: "range", start, end }               — one satisfiable
//     inclusive range, end already clamped to size − 1.
export function parseSingleRange(header, size) {
  const value = String(header).trim();
  const eq = value.indexOf("=");
  if (eq < 0) return { kind: "ignore" };
  const unit = value.slice(0, eq).trim().toLowerCase();
  if (unit !== "bytes") return { kind: "ignore" };
  const spec = value.slice(eq + 1).trim();
  if (spec.includes(",")) return { kind: "unsatisfiable" }; // multi-range: intentional 416 (§2.5)
  const m = /^(\d*)-(\d*)$/.exec(spec);
  if (!m || (m[1] === "" && m[2] === "")) return { kind: "ignore" }; // malformed
  if (m[1] === "") {
    // Suffix range: the final <suffix> bytes.
    const suffix = Number(m[2]);
    if (suffix === 0 || size === 0) return { kind: "unsatisfiable" };
    return { kind: "range", start: Math.max(0, size - suffix), end: size - 1 };
  }
  const start = Number(m[1]);
  if (start >= size) return { kind: "unsatisfiable" };
  if (m[2] === "") return { kind: "range", start, end: size - 1 };
  const end = Number(m[2]);
  if (end < start) return { kind: "unsatisfiable" };
  return { kind: "range", start, end: Math.min(end, size - 1) }; // oversized end clamps (§2.5)
}

// Read an R2 object's bytes. A ranged GET returns just the slice
// (its arrayBuffer is the slice, never the whole object); the
// body stream is the fallback for runtimes without arrayBuffer.
async function objectBytes(object) {
  if (typeof object.arrayBuffer === "function")
    return new Uint8Array(await object.arrayBuffer());
  if (object.body && typeof object.body.getReader === "function") {
    const reader = object.body.getReader();
    const chunks = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value); total += value.byteLength;
    }
    const out = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { out.set(c, off); off += c.byteLength; }
    return out;
  }
  return new Uint8Array();
}

// Handle one admitted audio request. `bucket` is the entry's R2
// binding (env.OPALREADER_STORAGE on the production surface);
// `cors` is the entry's corsHeaders() result for this request,
// spread into every response exactly as the entry would.
// `scope` / `r2KeyPrefix` are the entry's configured scope and
// R2_KEY_PREFIX (env.OPALREADER_V2_SCOPE / env.R2_KEY_PREFIX),
// passed in so the A1 namespace invariant below can be enforced
// at this boundary; callers that pass no scope keep the
// pre-repair behaviour (no namespace check is inferred).
// Returns a Response, or null when the path is not the audio
// route (the entry checks isAudioPath first; this is a guard).
export async function handleAudioRequest(request, { bucket, cors = {}, scope = null, r2KeyPrefix = "" } = {}) {
  const url = new URL(request.url);
  if (!isAudioPath(url.pathname)) return null;
  // §2.6 cache privacy + §2.5 expose surface, on every audio
  // response (success and error alike), added to — never
  // substituted for — the entry's CORS/Vary behaviour.
  const base = {
    ...cors,
    "cache-control": "private, no-store",
    "access-control-expose-headers": AUDIO_EXPOSE_HEADERS,
  };
  // A1 namespace fail-closed (repair pass; see header): the
  // production surface's coordinator refuses a non-empty
  // R2_KEY_PREFIX before any R2 contact
  // (ProductionR2NamespaceError, code
  // production_r2_prefix_forbidden). This route bypasses the
  // coordinator's cache construction, so without this check it
  // would serve UNPREFIXED objects under exactly that
  // misconfiguration. Refuse here, before the bucket is touched
  // in any way (and before method/key handling reads anything
  // from storage). The entry's scope → token → instance gates
  // have already run before this handler is invoked, so their
  // order is unchanged. Non-production scopes are unaffected.
  if (scope === "production" && r2KeyPrefix !== null && r2KeyPrefix !== undefined && String(r2KeyPrefix) !== "")
    return jsonError(503, "production_r2_prefix_forbidden", base);
  if (request.method !== "GET" && request.method !== "HEAD")
    return jsonError(405, "method_not_allowed", { ...base, allow: "GET, HEAD" });

  const segment = url.pathname.slice(AUDIO_PATH_PREFIX.length);
  const parsed = AUDIO_SEGMENT.exec(segment);
  if (!parsed) return jsonError(400, "invalid_audio_key", base);
  const [, cacheKey, format] = parsed;
  // Exactly one constructed object key (§2.2). No other extension
  // is probed; no caller input reaches the key beyond the two
  // validated parts above.
  const objectKey = `audio/${cacheKey}.${format}`;
  const contentType = CONTENT_TYPES[format];

  if (!bucket || typeof bucket.head !== "function" || typeof bucket.get !== "function")
    return jsonError(503, "audio_storage_unavailable", base);

  // Metadata lookup first: size and ETag come from the object's
  // metadata, so HEAD, 304, and 416 answers never read a body.
  let head;
  try { head = await bucket.head(objectKey); }
  catch { return jsonError(503, "audio_storage_unavailable", base); }
  if (!head) return jsonError(404, "audio_not_found", base);
  const size = head.size;
  if (typeof size !== "number" || !Number.isFinite(size) || size < 0)
    return jsonError(503, "audio_storage_unavailable", base); // metadata that cannot describe an object
  const etag = strongEtag(head.etag);
  const validators = etag ? { etag } : {};

  // Conditional precedence (§2.5): If-None-Match BEFORE any body
  // read and BEFORE Range — a match is 304 even with a Range.
  if (ifNoneMatchMatches(request.headers.get("if-none-match"), etag))
    return new Response(null, { status: 304, headers: { ...base, ...validators } });

  // HEAD (§2.5): Range and If-Range are ignored entirely; the
  // answer is the full representation's metadata, no body, and no
  // body read behind it.
  if (request.method === "HEAD") {
    return new Response(null, { status: 200, headers: {
      ...base, ...validators,
      "content-type": contentType,
      "content-length": String(size),
      "accept-ranges": "bytes",
    } });
  }

  // GET: resolve the Range, if any, under the If-Range rule.
  let range = null;
  const rangeHeader = request.headers.get("range");
  if (rangeHeader !== null) {
    const ifRange = request.headers.get("if-range");
    if (ifRange === null || ifRangeMatches(ifRange, etag)) {
      const parsedRange = parseSingleRange(rangeHeader, size);
      if (parsedRange.kind === "unsatisfiable") {
        return new Response(null, { status: 416, headers: {
          ...base, ...validators,
          "content-range": `bytes */${size}`,
        } });
      }
      if (parsedRange.kind === "range") range = parsedRange;
      // kind === "ignore": fall through to the full 200.
    }
    // If-Range present but not a strong match: the Range is
    // ignored and the full 200 representation is served (§2.5).
  }

  let object;
  try {
    object = range
      ? await bucket.get(objectKey, { range: { offset: range.start, length: range.end - range.start + 1 } })
      : await bucket.get(objectKey);
  } catch { return jsonError(503, "audio_storage_unavailable", base); }
  if (!object) return jsonError(404, "audio_not_found", base); // vanished between head and get: truthful 404
  // A2 validator integrity (repair pass; see header): the GET
  // object's ETag must be the SAME validator as the HEAD
  // metadata's ETag — the one If-None-Match / If-Range were
  // evaluated against and the one issued on this response.
  // Comparison is in the normalized strong (quoted) form, so a
  // bare-vs-quoted rendering of the same tag still matches, but
  // a different tag — or a tag present on one side and absent on
  // the other — does not. A same-size replacement swapped in
  // between HEAD and GET is therefore caught here and fails
  // closed with the §2.7 storage-inconsistency disposition,
  // never served under the stale validator.
  if (strongEtag(object.etag) !== etag)
    return jsonError(503, "audio_storage_unavailable", base);
  // The get's own size report, when the runtime provides one,
  // must agree with the metadata the validators were built from.
  if (typeof object.size === "number" && object.size !== size)
    return jsonError(503, "audio_storage_unavailable", base);

  let bytes;
  try { bytes = await objectBytes(object); }
  catch { return jsonError(503, "audio_storage_unavailable", base); }

  if (!range) {
    // Full-object honesty: the bytes served must be the object
    // the metadata described. A size disagreement is a storage
    // inconsistency, not a playable partial success (§2.7).
    if (bytes.byteLength !== size)
      return jsonError(503, "audio_storage_unavailable", base);
    return new Response(bytes, { status: 200, headers: {
      ...base, ...validators,
      "content-type": contentType,
      "content-length": String(size),
      "accept-ranges": "bytes",
    } });
  }

  const sliceLength = range.end - range.start + 1;
  if (bytes.byteLength === size && size !== sliceLength) {
    // A runtime that ignored the ranged read and returned the
    // whole object: slice the requested range locally rather
    // than mislabel the full body as a 206 slice.
    bytes = bytes.slice(range.start, range.end + 1);
  }
  if (bytes.byteLength !== sliceLength)
    return jsonError(503, "audio_storage_unavailable", base);
  return new Response(bytes, { status: 206, headers: {
    ...base, ...validators,
    "content-type": contentType,
    "content-length": String(sliceLength),
    "content-range": `bytes ${range.start}-${range.end}/${size}`,
    "accept-ranges": "bytes",
  } });
}
