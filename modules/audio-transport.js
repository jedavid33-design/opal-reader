// Candidate-owned audio fetch transport + raw settings read (B5).
//
// fetchSegment path: binding (cacheKey + format + expected size) ->
// authenticated GET /v2/sync/audio/<cacheKey>.<format> (D5-A route
// shape) with the three gate headers carried in headers ONLY (never
// in the URL) -> Blob whose received byte length must equal the
// binding's expected size before it is playable; a mismatch is
// audio_size_mismatch and the Blob is discarded (design 2.4/2.7).
//
// rawSettingsGet: exactly one GET /v2/settings — the specified
// read-only preflight read (design 7.3 Table C). It performs no sync,
// no cache write, no other request.
//
// probe(): the Table C preflight's raw instrument (follow-up
// correction 1). It performs ONE request — any method, optional
// per-request headers and an optional instance override (C1's
// authenticated wrong-instance probe) — and returns the observed
// { status, headers, bodyBytes, json } WITHOUT throwing on HTTP
// error statuses, so the orchestrator can assert the exact expected
// outcome per row (403 / 200 / 206 / 304). Network-level failures
// still throw and are recorded by the orchestrator as step failures.
// Probes are reads: they never write, sync, or cache anything.
export function createAudioTransport({ baseUrl, token, scope, instance, fetchFn } = {}) {
  if (!baseUrl) { const e = new Error("transport baseUrl required"); e.code = "transport_base_url_required"; throw e; }
  const base = String(baseUrl).replace(/\/+$/, "");
  const fetchImpl = fetchFn ?? ((...args) => globalThis.fetch(...args));
  const headers = (over = {}) => ({
    "x-opalreader-token": token ?? "",
    "x-opalreader-scope": scope,
    "x-opalreader-instance": over.instance ?? instance,
    ...(over.headers ?? {}),
  });
  async function probe(path, { method = "GET", instance: instanceOverride, headers: extraHeaders } = {}) {
    const res = await fetchImpl(base + path, { method, headers: headers({ instance: instanceOverride, headers: extraHeaders }) });
    const header = (name) => {
      const h = res?.headers;
      if (!h) return null;
      if (typeof h.get === "function") { try { return h.get(name); } catch { return null; } }
      return h[name.toLowerCase()] ?? h[name] ?? null;
    };
    // A real Response body can be consumed only once: take the clone
    // for JSON parsing BEFORE reading bytes from the original. Test
    // stubs implement the readers independently (no clone needed).
    const jsonSource = typeof res?.clone === "function" ? res.clone() : res;
    let bodyBytes = null, json = null;
    if (typeof res?.arrayBuffer === "function") {
      try { bodyBytes = (await res.arrayBuffer()).byteLength; } catch { bodyBytes = null; }
    }
    if (bodyBytes === null && typeof res?.blob === "function" && method !== "HEAD") {
      try { bodyBytes = (await res.blob()).size; } catch { bodyBytes = null; }
    }
    if (method !== "HEAD" && bodyBytes !== 0 && typeof jsonSource?.json === "function") {
      try { json = await jsonSource.json(); } catch { json = null; }
    }
    return { status: res?.status ?? 0, ok: !!res?.ok, header, bodyBytes, json };
  }
  async function rawGet(path) {
    const res = await fetchImpl(base + path, { method: "GET", headers: headers() });
    let data = null;
    try { data = await res.json(); } catch { data = null; }
    if (!res.ok) {
      const err = new Error(data?.error || `HTTP ${res.status}`);
      err.code = data?.error || `http_${res.status}`;
      err.status = res.status;
      err.body = data;
      throw err;
    }
    return data;
  }
  return {
    // The single preflight read.
    rawSettingsGet: () => rawGet("/v2/settings"),
    // Table C probe instrument (see header): one request, observed
    // outcome returned, HTTP statuses never thrown.
    probe,
    // C3: authenticated byte-check for a designated cache key.
    byteCheck: (cacheKey) => probe(`/v2/sync/byte-check/${cacheKey}`),
    // C4–C6: the designated audio object's route.
    audioProbe: (binding, opts = {}) => probe(`/v2/sync/audio/${binding?.cacheKey}.${binding?.format}`, opts),
    // binding: { cacheKey, format, sizeBytes|size|expectedSize }
    async fetchSegment(binding, { signal } = {}) {
      const cacheKey = binding?.cacheKey ?? null;
      const format = binding?.format ?? null;
      const expected = binding?.sizeBytes ?? binding?.size ?? binding?.expectedSize ?? null;
      if (!cacheKey || !/^[a-f0-9]{64}$/.test(cacheKey) || !(format === "mp3" || format === "wav")) {
        const e = new Error("invalid_audio_binding"); e.code = "invalid_audio_binding"; throw e;
      }
      const res = await fetchImpl(`${base}/v2/sync/audio/${cacheKey}.${format}`, { method: "GET", headers: headers(), signal });
      if (!res.ok) {
        let data = null; try { data = await res.json(); } catch {}
        const err = new Error(data?.error || `HTTP ${res.status}`);
        err.code = data?.error || `http_${res.status}`; err.status = res.status; throw err;
      }
      const blob = await res.blob();
      if (expected !== null && expected !== undefined && blob.size !== expected) {
        const err = new Error("audio_size_mismatch"); err.code = "audio_size_mismatch";
        err.expected = expected; err.received = blob.size; throw err;
      }
      return blob;
    },
  };
}
