// Opal Reader v2 — Part 1 queue/DO adapters (P8 integration build).
//
// Three layers, kept separate on purpose:
//
//   1. providerAdapters — the real Gemini/OpenAI synthesis kernels ported
//      from the v1 worker behind the executor's `providers` seam.
//   2. r2AudioCache    — the async R2 cache plus the synchronous
//      cache/probe facade the coordinator/executor demand.
//   3. contentWorkSource — resolves an occurrence's content payload from
//      the coordinator's content-plane snapshot (the coordinator itself
//      stays content-blind, exactly as P2 designed).
//
// FAIL-CLOSED: every synthesis path refuses with a named error while
// the generation halt flag is set, before any provider network call.
// Azure and Fish are NOT carried over as generation providers (feature
// law F-law approved removals); their adapter behavior is a named,
// never-silent refusal. Provider secrets are read from the environment
// and never invented here.
import { createHash } from "node:crypto";
import { fingerprintFor } from "../executor.mjs";

// Part 1 runtime-compat decision (see v2/p8/part1-decisions.md): the
// executor keeps its node:crypto dependency and the upload metadata
// sets the `nodejs_compat` compatibility flag, so createHash is the
// same primitive in the node harness and the Workers runtime.
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

export class GenerationHaltedError extends Error {
  constructor(message = "generation is halted") {
    super(message);
    this.name = "GenerationHaltedError";
    this.code = "generation_halted";
  }
}
export class ProviderNotConfiguredError extends Error {
  constructor(provider, variable) {
    super(`${provider} is not connected: set ${variable} on the worker before enabling generation.`);
    this.name = "ProviderNotConfiguredError";
    this.code = "provider_not_configured";
    this.provider = provider;
    this.httpStatus = 503;
  }
}
export class UnsupportedProviderError extends Error {
  constructor(provider) {
    super(`provider_not_carried_over: ${provider} is an approved v2 removal; existing audio remains playable, but no new synthesis is dispatched.`);
    this.name = "UnsupportedProviderError";
    this.code = "provider_not_carried_over";
    this.provider = provider;
    this.httpStatus = 422;
  }
}

// Fail-closed R2 flush failures (B7 revision, Rowan 6345016639). A
// flush either makes the intended bytes durable, adopts a verified
// identical winner, or throws one of these — it never reports success
// for bytes it could not verify, and it never overwrites. Codes:
//   r2_flush_indeterminate   — the conditional PUT errored in a way
//                              that leaves the outcome unknown.
//   r2_winner_digest_mismatch — another writer's object exists at the
//                              key but its bytes hash differently.
//   r2_winner_unverifiable   — a winner was indicated but its bytes
//                              could not be re-read for verification.
export class R2FlushError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "R2FlushError";
    this.code = code;
  }
}

// The staging configuration is fail-closed: synthesis dispatch is
// permitted ONLY when the deployment explicitly enables it. This is a
// layer-3 check; the worker entry also refuses queue work and registers
// no consumer while the flag is set.
export function assertGenerationEnabled(env = {}) {
  if (env.GENERATION_HALT === "0") return true;
  throw new GenerationHaltedError();
}

const SUPPORTED_GENERATION_PROVIDERS = new Set(["gemini", "openai"]);
const REMOVED_GENERATION_PROVIDERS = new Set(["azure", "fish"]);

function httpError(provider, status, message, extra = {}) {
  const err = new Error(message);
  err.provider = provider;
  err.httpStatus = status;
  Object.assign(err, extra);
  return err;
}

async function throwProviderError(provider, response) {
  let raw = "";
  try { raw = await response.text(); } catch {}
  let detail = null;
  try { detail = raw ? JSON.parse(raw) : null; } catch {}
  const said = String(detail?.error?.message ?? detail?.message ?? detail?.error ?? raw ?? "").trim();
  const err = httpError(
    provider,
    response.status,
    said ? `${provider} error (${response.status}): ${said.slice(0, 320)}` : `${provider} request failed with status ${response.status}.`
  );
  if (provider === "gemini" && response.status === 429) {
    err.noRetry = true;
    err.quotaExceeded = true;
  }
  if (provider === "gemini" && response.status === 500) {
    err.noRetry = true;
    err.providerInternal = true;
  }
  if (provider === "gemini" && response.status === 400 &&
      /request\s+blocked|input\s+blocked|blocked.{0,40}policy|policy\s+reason|modify\s+your\s+input|prompt\s+contains\s+sensitive\s+words|generative\s+ai\s+prohibited\s+use\s+policy/i.test(said)) {
    err.noRetry = true;
    err.contentBlocked = true;
    err.blockReason = "POLICY_BLOCK";
    err.finishReason = "HTTP_400";
  }
  throw err;
}

const plainSpeechText = (value) => String(value || "").replace(/<\/?emphasis>/gi, "");
const decodeBase64 = (value) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};
function pcmToWav(pcmBytes, { sampleRate = 24000, channels = 1, bitsPerSample = 16 } = {}) {
  const pcm = pcmBytes instanceof Uint8Array ? pcmBytes : new Uint8Array(pcmBytes);
  const header = new DataView(new ArrayBuffer(44));
  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) header.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  header.setUint32(4, 36 + pcm.byteLength, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  header.setUint32(16, 16, true);
  header.setUint16(20, 1, true);
  header.setUint16(22, channels, true);
  header.setUint32(24, sampleRate, true);
  header.setUint32(28, (sampleRate * channels * bitsPerSample) / 8, true);
  header.setUint16(32, (channels * bitsPerSample) / 8, true);
  header.setUint16(34, bitsPerSample, true);
  writeStr(36, "data");
  header.setUint32(40, pcm.byteLength, true);
  const out = new Uint8Array(44 + pcm.byteLength);
  out.set(new Uint8Array(header.buffer), 0);
  out.set(pcm, 44);
  return out;
}
function wavDurationSec(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 44) return null;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (at) => String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]);
  if (tag(0) !== "RIFF" || tag(8) !== "WAVE") return null;
  let format = null, dataLen = 0;
  for (let at = 12; at + 8 <= bytes.length;) {
    const type = tag(at), length = dv.getUint32(at + 4, true), start = at + 8, end = start + length;
    if (end > bytes.length) return null;
    if (type === "fmt " && length >= 16) format = { byteRate: dv.getUint32(start + 8, true) };
    else if (type === "data" && !dataLen) dataLen = length;
    at = end + (length & 1);
  }
  if (!format?.byteRate || !dataLen) return null;
  return dataLen / format.byteRate;
}
const MP3_BITRATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
function mp3DurationSec(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 4) return null;
  for (let i = 0; i < Math.min(bytes.length - 4, 4096); i++) {
    if (bytes[i] === 0xff && (bytes[i + 1] & 0xe0) === 0xe0) {
      const version = (bytes[i + 1] >> 3) & 0x3, layer = (bytes[i + 1] >> 1) & 0x3;
      const bitrateIdx = (bytes[i + 2] >> 4) & 0xf;
      if (version !== 3 || layer !== 1 || bitrateIdx === 0 || bitrateIdx === 15) continue;
      const bitrateKbps = MP3_BITRATES[bitrateIdx];
      if (!bitrateKbps) continue;
      const padding = (bytes[i + 2] >> 1) & 0x1;
      const frameLen = Math.floor((144 * bitrateKbps * 1000) / 44100) + padding;
      if (frameLen <= 0 || frameLen > bytes.length) continue;
      return Math.max(1, Math.round((bytes.length / frameLen) * 0.026));
    }
  }
  return null;
}
function audioDurationSec(bytes, format, textLength) {
  const parsed = format === "wav" ? wavDurationSec(bytes) : mp3DurationSec(bytes);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  // Honest fallback only: the executor rejects absurd values, and the
  // coordinator binds only after probing the stored object. Generation
  // is halted, so this path has no production behavior yet.
  const estimate = Math.max(1, Math.round(textLength / 14));
  return Math.min(estimate, Math.max(60, textLength));
}

// Provider adapter factory behind the executor's seam.
// `fetchFn` defaults to the global fetch; `env` supplies API keys.
export function createProviderAdapters(env = {}, fetchFn = globalThis.fetch) {
  const fetchImpl = fetchFn || globalThis.fetch;

  async function synthesizeGemini(occ) {
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) throw new ProviderNotConfiguredError("gemini", "GEMINI_API_KEY");
    const payload = occ.payload;
    const text = plainSpeechText(payload.text);
    if (!text || !payload.voice) throw httpError("gemini", 400, "Voice and text are required.");
    if (text.length > 8000) throw httpError("gemini", 413, "This narration segment is too long for one Gemini request. Split the segment first.");
    const model = payload.model || "gemini-3.8-flash-tts";
    const style = [String(payload.styleDirection || "").trim().slice(0, 300),
      "clear normal speaking voice; never whisper, murmur, or speak softly"].filter(Boolean).join(". ");
    let bytes, format = "wav";
    if (/^gemini-3\.8-(?:flash|flash-lite)-tts$/i.test(model)) {
      const response = await fetchImpl("https://generativelanguage.googleapis.com/v1beta/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        signal: AbortSignal.timeout(120000),
        body: JSON.stringify({
          model,
          input: [{ type: "user_input", content: [{ type: "text", text, annotations: [{ type: "speech_metadata", style }] }] }],
          response_format: { type: "audio" },
          generation_config: { speech_config: [{ voice: payload.voice }] },
        }),
      });
      if (!response.ok) await throwProviderError("gemini", response);
      const data = await response.json();
      const audioPart = (data?.steps || [])
        .filter((s) => s?.type === "model_output")
        .flatMap((s) => s?.content || [])
        .filter((p) => p?.type === "audio" && p?.data).at(-1);
      if (!audioPart?.data) {
        // CH2 FIX PACKAGE (fix 1 — 3.8 block mapping): on the
        // interactions surface, a content refusal arrives as an
        // HTTP-200 response whose model output carries NO audio
        // (a text refusal and/or block-signal fields instead).
        // The pre-fix code threw a plain 502 here, so the refusal
        // was classified as a known provider failure and the
        // recursive POLICY_BLOCK splitting path (policy-split.mjs,
        // feature law F3) NEVER engaged — the Ch 2 halt's eight
        // identical one-call failures (see the Oct 29, 2026 halt
        // diagnosis, Q5 branch (b)). Mirror the generateContent
        // branch below: a no-audio 200 on this audio-only request
        // IS the refusal outcome, so map it to the same
        // contentBlocked result the splitting path consumes,
        // carrying whatever block signal the response exposed.
        // No voice substitution, no text change: the splitter
        // retries the SAME payload with the text cut, verbatim.
        // Genuine provider errors still arrive as non-200s and
        // keep their existing classification via
        // throwProviderError above (incl. its 400 policy-regex
        // mapping); a malformed 200 body still throws from
        // response.json() with neither flag — billing-unknown,
        // fail-closed, exactly as before.
        const outputSteps = (data?.steps || []).filter((s) => s?.type === "model_output");
        const signalText = [
          data?.finishReason, data?.blockReason, data?.status,
          ...outputSteps.flatMap((s) => [s?.finishReason, s?.blockReason, s?.status]),
        ].filter(Boolean).join("/");
        const refusalText = outputSteps
          .flatMap((s) => s?.content || [])
          .filter((p) => p?.type === "text" && typeof p.text === "string")
          .map((p) => p.text).join(" ").trim().slice(0, 200);
        const detail = [signalText, refusalText].filter(Boolean).join(" — ");
        throw httpError("gemini", 502,
          `Gemini 3.8 TTS returned no audio.${detail ? ` Block signal: ${detail}` : ""}`,
          { noRetry: true, providerInternal: true, contentBlocked: true,
            blockReason: /prohibited/i.test(signalText) ? "PROHIBITED_CONTENT" : "POLICY_BLOCK",
            finishReason: "NO_AUDIO" });
      }
      bytes = decodeBase64(audioPart.data);
    } else {
      const response = await fetchImpl(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          signal: AbortSignal.timeout(120000),
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text }] }],
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: payload.voice } } },
            },
          }),
        });
      if (!response.ok) await throwProviderError("gemini", response);
      const data = await response.json();
      const part = (data?.candidates?.[0]?.content?.parts || []).find((p) => p?.inlineData?.data);
      if (!part) {
        const detail = [data?.candidates?.[0]?.finishReason, data?.promptFeedback?.blockReason].filter(Boolean).join("/");
        throw httpError("gemini", 502, `Gemini did not return audio (${detail || "UNKNOWN"}).`,
          { noRetry: true, contentBlocked: /PROHIBITED_CONTENT/i.test(detail), blockReason: data?.promptFeedback?.blockReason || null });
      }
      const rateMatch = /rate=(\d+)/.exec(String(part.inlineData.mimeType || ""));
      bytes = pcmToWav(decodeBase64(part.inlineData.data), { sampleRate: rateMatch ? Number(rateMatch[1]) : 24000 });
    }
    return { audio: bytes, format, durationSec: audioDurationSec(bytes, format, text.length) };
  }

  async function synthesizeOpenAI(occ) {
    const apiKey = env.OPENAI_API_KEY;
    if (!apiKey) throw new ProviderNotConfiguredError("openai", "OPENAI_API_KEY");
    const payload = occ.payload;
    const text = plainSpeechText(payload.text);
    if (!text || !payload.voice) throw httpError("openai", 400, "Voice and text are required.");
    if (text.length > 4000) throw httpError("openai", 413, "This narration segment is too long for one OpenAI request. Split the segment first.");
    const model = payload.model || "gpt-4o-mini-tts";
    const response = await fetchImpl("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(120000),
      body: JSON.stringify({ model, input: text, voice: payload.voice, response_format: "mp3" }),
    });
    if (!response.ok) await throwProviderError("openai", response);
    const bytes = new Uint8Array(await response.arrayBuffer());
    return { audio: bytes, format: "mp3", durationSec: audioDurationSec(bytes, "mp3", text.length) };
  }

  async function synthesize(occ) {
    assertGenerationEnabled(env);
    const provider = occ?.payload?.provider || "gemini";
    if (REMOVED_GENERATION_PROVIDERS.has(provider)) throw new UnsupportedProviderError(provider);
    if (!SUPPORTED_GENERATION_PROVIDERS.has(provider))
      throw httpError(provider, 400, `Unknown voice provider: ${provider}.`);
    return provider === "openai" ? synthesizeOpenAI(occ) : synthesizeGemini(occ);
  }

  async function submitBatch(occ, displayName) {
    assertGenerationEnabled(env);
    const provider = occ?.payload?.provider || "gemini";
    if (provider !== "gemini") throw new UnsupportedProviderError(provider);
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) throw new ProviderNotConfiguredError("gemini", "GEMINI_API_KEY");
    const model = occ.payload.model || "gemini-3.8-flash-tts";
    if (!/^gemini-3\.8-(?:flash|flash-lite)-tts$/i.test(model))
      throw httpError("gemini", 422, `Batch is only supported for Gemini 3.8 TTS models, not ${model}.`);
    const text = plainSpeechText(occ.payload.text);
    const style = [String(occ.payload.styleDirection || "").trim().slice(0, 300),
      "clear normal speaking voice; never whisper, murmur, or speak softly"].filter(Boolean).join(". ");
    const response = await fetchImpl(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:batchGenerateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        signal: AbortSignal.timeout(120000),
        body: JSON.stringify({
          batch: {
            display_name: displayName,
            input_config: {
              requests: { requests: [{
                request: {
                  contents: [{ role: "user", parts: [{ text, speech_metadata: { style } }] }],
                  generationConfig: {
                    responseModalities: ["AUDIO"],
                    speechConfig: { voiceConfig: { voice: occ.payload.voice } },
                  },
                },
                metadata: { key: `seg-${occ.occurrenceId}` },
              }] },
            },
          },
        }),
      });
    if (!response.ok) await throwProviderError("gemini", response);
    const accepted = await response.json();
    const name = accepted?.name;
    if (typeof name !== "string" || !/^batches\/[A-Za-z0-9_-]+$/.test(name))
      throw httpError("gemini", 502, "Gemini accepted Batch but returned no valid job ID. Manual reconciliation required.",
        { noRetry: true, providerInternal: true });
    return { name };
  }

  async function getBatch(providerName) {
    assertGenerationEnabled(env);
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) throw new ProviderNotConfiguredError("gemini", "GEMINI_API_KEY");
    if (!/^batches\/[A-Za-z0-9_-]+$/.test(String(providerName || "")))
      throw httpError("gemini", 400, "Invalid saved Batch job identifier.");
    const response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/${providerName}`, {
      headers: { "x-goog-api-key": apiKey },
      signal: AbortSignal.timeout(120000),
    });
    if (!response.ok) await throwProviderError("gemini", response);
    const batch = await response.json();
    const metaState = String(batch?.metadata?.state || "");
    if (batch?.error || ["BATCH_STATE_FAILED", "BATCH_STATE_CANCELLED", "BATCH_STATE_EXPIRED"].includes(metaState))
      return { done: true, state: metaState || "BATCH_STATE_FAILED" };
    if (!batch?.done) return { done: false, state: metaState || "BATCH_STATE_UNKNOWN" };
    let records = batch?.response?.inlinedResponses;
    if (records && !Array.isArray(records)) records = records.inlinedResponses || records.inlined_responses;
    const first = Array.isArray(records) && records.length === 1 ? records[0] : null;
    const parts = first?.response?.candidates?.[0]?.content?.parts || [];
    const audio = parts.find((p) => p?.inlineData?.data && /audio/i.test(String(p.inlineData.mimeType || "audio/wav")));
    if (!first || first?.error || !audio?.inlineData?.data) return { done: true, state: "BATCH_STATE_FAILED" };
    const bytes = decodeBase64(audio.inlineData.data);
    // A parsed WAV duration is real; the fallback is a conservative
    // lower bound within the executor's plausibility check.
    return { done: true, state: "BATCH_STATE_SUCCEEDED", audio: bytes, format: "wav",
             durationSec: audioDurationSec(bytes, "wav", 0) };
  }

  // Reconciliation lookup (executor contract 2): enumeration is a hint
  // only. A missing match proves nothing; this function returns matches,
  // it never resolves ambiguity itself.
  async function listBatchesByDisplayName(displayName) {
    assertGenerationEnabled(env);
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) throw new ProviderNotConfiguredError("gemini", "GEMINI_API_KEY");
    const response = await fetchImpl(
      `https://generativelanguage.googleapis.com/v1beta/batches?pageSize=100`,
      { headers: { "x-goog-api-key": apiKey }, signal: AbortSignal.timeout(120000) });
    if (!response.ok) await throwProviderError("gemini", response);
    const data = await response.json();
    const rows = data?.batches || data?.batchJobs || data?.jobs || [];
    return rows
      .filter((r) => (r?.displayName ?? r?.display_name) === displayName)
      .map((r) => ({ name: r.name, displayName: r.displayName ?? r.display_name }));
  }

  // P3 review gate, condition on the never-accepted evidence: the real
  // wiring must verify the evidence's SOURCE, not merely record a caller
  // string. The public Gemini API offers no "never accepted" proof, so
  // this always fails closed: absence proves nothing, and an arbitrary
  // evidence string is not a verification. This is a named residual (the
  // route that could call resolveBatchNeverAccepted is not exposed in
  // Part 1, and generation is halted), not a smoothed-over proof.
  function verifyNeverAcceptedEvidence() {
    const err = new Error("never_accepted_evidence_unverifiable: no provider API proves non-acceptance; a lookup miss is a hint, not evidence");
    err.code = "never_accepted_evidence_unverifiable";
    throw err;
  }

  return { synthesize, submitBatch, getBatch, listBatchesByDisplayName, verifyNeverAcceptedEvidence };
}

// --- R2 audio cache: async bucket I/O with a synchronous probe/cache ---
//
// The coordinator calls probe/cache synchronously (its storage contract
// is the P2 design), but Cloudflare R2 is async. The honest resolution
// is a request-scoped snapshot: before any coordinator operation the
// host hydrates every coordinator-indexed key (plus the work-source
// primed fingerprint key) into memory; the executor's cache writes land
// in the snapshot and are flushed to R2 AFTER the synchronous phase.
//
// Flush write safety (B7 revision, Rowan 6345016639): every PUT is
// conditional (create-if-absent). A failed conditional PUT is NEVER
// retried unconditionally — the pre-fix fallback could overwrite
// another writer's object on a race and disguised network errors as
// success. Instead flush fails closed: indeterminate errors throw
// R2FlushError, and when another writer won the key, the winner's
// bytes are re-read and adopted ONLY if their digest matches the
// digest this cache intended to make durable.
//
// Key namespace: production keys are `audio/<cacheKey>.<ext>`. A host
// may pass `keyPrefix` (the staging deploy spec sets
// R2_KEY_PREFIX="smoke-p8/") so every staging read/write lands under a
// non-overlapping prefix in the shared bucket; the production key
// shape itself is unchanged.
//
// Residual (stated, not smoothed): this is a write-behind snapshot, not
// a truly synchronous conditional write. Rowan's B7 ruling makes the
// flush-before-commit redesign an explicit production-activation
// blocker (decisions doc): generation and real-audio binding stay
// blocked on it; the snapshot may exist only in zero-generation
// synthetic staging until then.
const AUDIO_EXTENSIONS = ["mp3", "wav"];

function bytesOf(audio) {
  if (audio instanceof Uint8Array) return audio;
  if (audio instanceof ArrayBuffer) return new Uint8Array(audio);
  if (ArrayBuffer.isView(audio)) return new Uint8Array(audio.buffer, audio.byteOffset, audio.byteLength);
  return new TextEncoder().encode(String(audio ?? ""));
}

export function createR2AudioCache(bucket, { keyPrefix = "" } = {}) {
  const objectKeyFor = (cacheKey, format) => `${keyPrefix}audio/${cacheKey}.${format}`;
  const snapshot = new Map(); // cacheKey -> { audio, format, durationSec, identity, sha256, recordedSha256, pending }
  const pending = new Set();

  function setEntry(key, entry) { snapshot.set(key, entry); }

  async function hydrateKey(key) {
    if (snapshot.has(key)) return snapshot.get(key);
    if (!bucket) { snapshot.set(key, null); return null; }
    for (const ext of AUDIO_EXTENSIONS) {
      const object = await bucket.get(objectKeyFor(key, ext));
      if (!object) continue;
      const bytes = new Uint8Array(await object.arrayBuffer());
      const meta = object.customMetadata || {};
      const entry = {
        audio: bytes, format: ext,
        durationSec: meta.duration_seconds ? Number(meta.duration_seconds) : null,
        identity: meta.identity ?? key,
        sha256: meta.sha256 ?? sha256Hex(bytes),
        recordedSha256: meta.sha256 ?? sha256Hex(bytes),
        pending: false,
      };
      setEntry(key, entry);
      return entry;
    }
    snapshot.set(key, null);
    return null;
  }

  // Hydrate every key the coordinator's cache_index knows about.
  // NOTE (G1 correction): the Worker request path no longer calls
  // this — eagerly downloading every indexed object's bytes on
  // every request is a corpus-scale denial of service against
  // ourselves (≈5.35 GB at the approved freeze). It remains for
  // callers that genuinely bound themselves to a whole index (the
  // direct cache tests); request paths hydrate exactly the keys
  // they name, via hydrateKey/hydrateKeys below.
  async function hydrateIndex(sql) {
    let rows = [];
    try {
      rows = sql.exec(`SELECT cache_key FROM cache_index`).toArray();
    } catch { rows = []; }
    for (const r of rows) await hydrateKey(r.cache_key);
    return snapshot;
  }

  // Hydrate exactly the named keys — the lazy, request-scoped read
  // path (G1). Each key costs at most one bucket GET per extension
  // tried; a key absent from the bucket is a cached miss.
  async function hydrateKeys(keys) {
    for (const k of keys) await hydrateKey(k);
    return snapshot;
  }

  // Snapshot occupancy — the resident-bytes observable the G1
  // stress tests bound. Only entries actually hydrated/put count.
  function stats() {
    let entries = 0, residentBytes = 0;
    for (const e of snapshot.values()) {
      if (!e) continue;
      entries++;
      residentBytes += e.audio ? e.audio.byteLength : 0;
    }
    return { entries, residentBytes };
  }

  // The executor hands {audio, format, durationSec} through a sync
  // putIfAbsent. The entry lands in the snapshot immediately; the R2
  // write happens in flush(), guarded create-if-absent.
  function putIfAbsent(key, entry) {
    const existing = snapshot.get(key);
    if (existing) return { stored: false, object: existing };
    const audio = bytesOf(entry.audio);
    const sha256 = sha256Hex(audio);
    const record = {
      audio, format: entry.format === "wav" ? "wav" : "mp3",
      durationSec: entry.durationSec ?? null, identity: key,
      sha256, recordedSha256: sha256, pending: true,
    };
    setEntry(key, record);
    pending.add(key);
    return { stored: true, object: record };
  }

  function get(key) { return snapshot.get(key) ?? null; }

  // Another writer landed an object at objectKey first. NEVER
  // overwrite it: re-read the winner's bytes and adopt them as this
  // key's durable entry ONLY if their digest equals the digest this
  // cache intended to make durable. Any other outcome fails closed.
  //
  // Ordering (B7 fix): the pending snapshot entry is evicted BEFORE
  // the winner's entry is set. The pre-fix code called hydrateKey()
  // while the pending entry was still in the snapshot — hydrateKey
  // returns the cached entry on sight, so it "hydrated" the pending
  // bytes, and the subsequent delete discarded the key entirely: the
  // winner was never adopted.
  async function adoptWinner(key, record, objectKey) {
    let object = null;
    try { object = await bucket.get(objectKey); } catch { object = null; }
    if (!object)
      throw new R2FlushError("r2_winner_unverifiable",
        `flush: a competing object exists at ${objectKey} but its bytes could not be re-read for digest verification; failing closed without overwriting`);
    const bytes = new Uint8Array(await object.arrayBuffer());
    const digest = sha256Hex(bytes);
    if (digest !== record.sha256)
      throw new R2FlushError("r2_winner_digest_mismatch",
        `flush: competing object at ${objectKey} has sha256 ${digest}, expected ${record.sha256}; failing closed without overwriting`);
    const meta = object.customMetadata || {};
    snapshot.delete(key);
    setEntry(key, {
      audio: bytes, format: record.format,
      durationSec: meta.duration_seconds ? Number(meta.duration_seconds) : record.durationSec,
      identity: meta.identity ?? record.identity,
      sha256: digest, recordedSha256: meta.sha256 ?? digest,
      pending: false,
    });
  }

  async function flush() {
    if (!bucket) return { flushed: 0, bucket: false };
    let flushed = 0;
    for (const key of [...pending]) {
      const record = snapshot.get(key);
      if (!record?.pending) { pending.delete(key); continue; }
      const objectKey = objectKeyFor(key, record.format);
      const head = await bucket.head(objectKey);
      if (head) {
        // Someone (or a redelivery) wrote first: adopt the verified
        // winner, exactly as a create-if-absent semantic would.
        await adoptWinner(key, record, objectKey);
        pending.delete(key);
        flushed += 1;
        continue;
      }
      let created;
      try {
        created = await bucket.put(objectKey, record.audio, {
          httpMetadata: { contentType: record.format === "wav" ? "audio/wav" : "audio/mpeg" },
          customMetadata: {
            sha256: record.sha256, identity: record.identity,
            ...(record.durationSec != null ? { duration_seconds: String(record.durationSec) } : {}),
          },
          // Atomic conditional write: create only if absent.
          onlyIf: { etagDoesNotMatch: "*" },
        });
      } catch (e) {
        // Indeterminate: the write may or may not have landed. Fail
        // closed — NEVER retry unconditionally. (The pre-fix fallback
        // re-PUT without the condition: it could overwrite another
        // writer's object and disguised network errors as success.)
        throw new R2FlushError("r2_flush_indeterminate",
          `flush: conditional PUT for ${objectKey} failed indeterminately (${(e && e.message) || e}); refusing any unconditional retry`);
      }
      if (created === null || created === undefined) {
        // Precondition unmet: another writer won between head and PUT.
        await adoptWinner(key, record, objectKey);
        pending.delete(key);
        flushed += 1;
        continue;
      }
      record.pending = false;
      pending.delete(key);
      flushed += 1;
    }
    return { flushed, bucket: true };
  }

  const probe = {
    exists: (key) => snapshot.has(key) && snapshot.get(key) !== null,
    sniff: (key) => snapshot.get(key)?.format ?? null,
    recordedIdentity: (key) => snapshot.get(key)?.identity ?? null,
    hash: (key) => snapshot.get(key)?.sha256 ?? null,
    recordedSha256: (key) => snapshot.get(key)?.recordedSha256 ?? null,
    keyFor: () => null,
  };

  async function byteCheck(key) {
    if (!/^[a-f0-9]{64}$/.test(key)) return false;
    await hydrateKey(key);
    return probe.exists(key);
  }

  // Migration prime (P8 migration-import design §2/§3; Rowan
  // ruling 6354217340, I2+I3). The migration import path may not
  // trust the request snapshot: on a cold coordinator the snapshot
  // is empty (hydrateIndex loads only cache_index keys), and its
  // sha256 can be ADVERTISED METADATA rather than a digest of the
  // bytes (hydrateKey: meta.sha256 ?? sha256Hex(bytes)).
  // primeForMigration therefore reads the object DIRECTLY from the
  // bucket — inside the caller's import operation, before any
  // bind — and ALWAYS computes the SHA-256 from the downloaded
  // bytes. The metadata SHA is returned as a separate, untrusted
  // field for the coordinator's three-way comparison. GET only:
  // this function performs no bucket write of any kind, and it
  // neither consults nor mutates the snapshot, so the general
  // probe path is byte-identical to before.
  async function primeForMigration(cacheKey) {
    if (!bucket) return null;
    for (const ext of AUDIO_EXTENSIONS) {
      const objectKey = objectKeyFor(cacheKey, ext);
      const object = await bucket.get(objectKey);
      if (!object) continue;
      const bytes = new Uint8Array(await object.arrayBuffer());
      const meta = object.customMetadata || {};
      return {
        cacheKey, objectKey, format: ext,
        byteLength: bytes.byteLength,
        computedSha256: sha256Hex(bytes),
        metadataSha256: meta.sha256 ?? null,
        metadataIdentity: meta.identity ?? null,
        etag: object.etag ?? null,
      };
    }
    return null;
  }

  return {
    hydrateIndex, hydrateKey, hydrateKeys, stats,
    putIfAbsent, get, flush, probe, byteCheck,
    primeForMigration,
    // Prime one fingerprint key from an occurrence payload before the
    // executor's synchronous cache phase (called by the work source).
    async prime(payload) {
      if (!payload) return null;
      return hydrateKey(fingerprintFor(payload));
    },
  };
}

// --- Content work source -------------------------------------------------
//
// The coordinator is content-blind; the executor needs the occurrence's
// words. The production source in Part 1 is the coordinator's own
// content-plane snapshot (a v2-native book entity carries chapters with
// occurrenceId/text and POV voice data). The P7 migration corpus
// deliberately strips text, so a migrated book's content entity must be
// enriched with the text plane before generation is ever enabled —
// Part 1 states the limit plainly and the executor skips no_content
// rather than inventing words.
export function createContentWorkSource(coord, { cache = null } = {}) {
  function findSegment(data, occurrenceId) {
    for (const ch of data?.chapters || [])
      for (const seg of ch?.segments || [])
        if (seg?.occurrenceId === occurrenceId) return seg;
    return null;
  }
  function resolvePov(data, segment) {
    const povs = data?.povs || [];
    const key = segment?.pov;
    return povs.find((p) => p?.id === key || p?.name === key) || null;
  }
  return async function workSource(jobId, occurrenceId) {
    const view = coord.jobView(jobId);
    if (!view || !view.bookId) return null;
    const snapshot = coord.syncSnapshot({ family: "content" });
    if (snapshot?.error) return null;
    const entity = (snapshot.entities || []).find((e) => e.entityKey === view.bookId && !e.tombstone);
    const data = entity?.data;
    if (!data) return null;
    const segment = findSegment(data, occurrenceId);
    if (!segment?.text) return null;
    const pov = resolvePov(data, segment) || data.defaultVoice || null;
    const voiceObj = pov?.voice || null;
    const voice = voiceObj?.voice_id || voiceObj?.voiceId || data.defaultVoice?.voice_id || null;
    if (!voice) return null;
    const provider = voiceObj?.provider || data.defaultVoice?.provider || "gemini";
    if (provider !== "gemini" && provider !== "openai") return null; // removed/unknown providers never generate
    const payload = {
      text: String(segment.text),
      voice,
      provider,
      model: voiceObj?.model_id || voiceObj?.model || (provider === "openai" ? "gpt-4o-mini-tts" : "gemini-3.8-flash-tts"),
      styleDirection: voiceObj?.style_direction ?? voiceObj?.styleDirection ?? segment.styleDirection ?? "",
      mode: view.lane === "batch" ? "batch" : "standard",
    };
    if (cache && typeof cache.prime === "function") await cache.prime(payload);
    return payload;
  };
}
