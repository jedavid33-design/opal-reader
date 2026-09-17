const EL = "https://api.elevenlabs.io";
const GOOGLE = "https://texttospeech.googleapis.com/v1";
const SPEECHIFY = "https://api.speechify.ai";
const azureReady = (env) =>
  Boolean(env.AZURE_SPEECH_KEY && /^[a-z0-9-]+$/i.test(env.AZURE_SPEECH_REGION || ""));
const azureBase = (env) =>
  `https://${env.AZURE_SPEECH_REGION}.tts.speech.microsoft.com`;
const cors = (origin, env) => ({
  "Access-Control-Allow-Origin":
    env.ALLOWED_ORIGIN === "*" ? "*" : env.ALLOWED_ORIGIN || origin,
  "Access-Control-Allow-Headers": "Content-Type, X-OpalReader-Token",
  "Access-Control-Allow-Methods": "GET,PUT,POST,DELETE,OPTIONS",
  "Access-Control-Expose-Headers": "X-OpalReader-Cache",
  Vary: "Origin",
});
const json = (body, status, origin, env) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors(origin, env) },
  });
const relay = (body, status, contentType, origin, env, extra = {}) =>
  new Response(body, {
    status,
    headers: { "Content-Type": contentType, ...extra, ...cors(origin, env) },
  });
const errorMessage = (value, fallback) => {
  const seen = new Set();
  function extract(item) {
    if (typeof item === "string") return item.trim();
    if (!item || typeof item !== "object" || seen.has(item)) return "";
    seen.add(item);
    if (Array.isArray(item))
      return item.map(extract).filter(Boolean).join("; ");
    for (const key of [
      "message",
      "error",
      "detail",
      "reason",
      "description",
      "statusText",
    ]) {
      const message = extract(item[key]);
      if (message) return message;
    }
    return "";
  }
  return extract(value) || fallback;
};
async function googleError(response, origin, env) {
  const fallback = `Google Cloud TTS request failed (${response.status}).`;
  let detail,
    raw = "";
  try {
    raw = await response.text();
    detail = raw ? JSON.parse(raw) : null;
  } catch {}
  return json(
    {
      error: errorMessage(detail, raw.trim() || fallback),
      provider: "google",
      status: response.status,
      details: detail || raw || undefined,
    },
    response.status,
    origin,
    env,
  );
}
async function azureError(response, origin, env) {
  const fallback = `Azure Speech request failed (${response.status}).`;
  let detail,
    raw = "";
  try {
    raw = await response.text();
    detail = raw ? JSON.parse(raw) : null;
  } catch {}
  return json(
    {
      error: errorMessage(detail, raw.trim() || fallback),
      provider: "azure",
      status: response.status,
      details: detail || raw || undefined,
    },
    response.status,
    origin,
    env,
  );
}
const xml = (value) =>
  String(value || "").replace(
    /[<>&"']/g,
    (character) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[character],
  );
const speechMarkup = (value) =>
  xml(value)
    .replaceAll("&lt;emphasis&gt;", "<emphasis>")
    .replaceAll("&lt;/emphasis&gt;", "</emphasis>");
const plainSpeechText = (value) =>
  String(value || "").replace(/<\/?emphasis>/gi, "");

const decodeBase64 = (value) => {
  const binary = atob(value),
    bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};
const validId = (value) => /^[a-zA-Z0-9_-]{8,100}$/.test(value || "");
const validCacheKey = (value) => /^(preview-)?[a-f0-9]{64}$/.test(value || "");
const validJobId = (value) => /^[a-f0-9]{64}$/.test(value || "");
const syncReady = (env) => env.OPALREADER_KV && env.OPALREADER_STORAGE;
const APP_VERSION = "1.3.2";
const usageEventPrefix = "usage/events/";
const safeUsageType = (value) =>
  ["book_generation", "book_audition", "voice_sample", "other"].includes(value)
    ? value
    : "other";
async function recordTtsUsage(env, body, details = {}) {
  if (!env.OPALREADER_STORAGE) return;
  try {
    const now = Date.now();
    const event = {
      id: crypto.randomUUID(),
      timestamp: now,
      iso_timestamp: new Date(now).toISOString(),
      usage_type: safeUsageType(body?.usage_type),
      provider: details.provider || body?.provider || null,
      provider_call: Boolean(details.provider_call),
      request_status: details.request_status || "succeeded",
      cache_status: details.cache_status || "provider_call",
      book_id: body?.book_id || null,
      book_title: body?.book_title || null,
      chapter_index: Number.isInteger(body?.chapter_index) ? body.chapter_index : null,
      chapter_number: Number.isInteger(body?.chapter_number) ? body.chapter_number : null,
      chapter_title: body?.chapter_title || null,
      segment_index: Number.isInteger(body?.segment_index) ? body.segment_index : null,
      total_segments: Number.isInteger(body?.total_segments) ? body.total_segments : null,
      queue_job_id: body?.queue_job_id || body?.job_id || null,
      voice_id: body?.voice_id || null,
      voice_name: body?.voice_name || null,
      model: body?.model_id || null,
      character_count_sent: details.provider_call ? String(body?.text || "").length : 0,
      provider_call_duration_ms: Number(details.duration_ms) || 0,
      audio_bytes_returned: Number(details.audio_bytes) || 0,
      retry_attempt: Number(body?.retry_attempt) || 1,
      error: details.error || null,
      r2_write_success: details.r2_write_success ?? null,
      estimated_cost: Number(body?.estimated_cost) || 0,
      pricing_rate: Number(body?.pricing_rate) || null,
      pricing_unit: body?.pricing_rate ? "USD per 1M characters" : null,
      cache_key: body?.cache_key || null,
    };
    await env.OPALREADER_STORAGE.put(
      `${usageEventPrefix}${String(now).padStart(13, "0")}-${event.id}.json`,
      JSON.stringify(event),
      { httpMetadata: { contentType: "application/json" } },
    );
  } catch (error) {
    console.warn("TTS usage ledger write failed", error);
  }
}
async function usageReport(env, url) {
  if (!env.OPALREADER_STORAGE) return { events: 0, summary: [] };
  const from = url.searchParams.get("from") ? Date.parse(url.searchParams.get("from")) : 0;
  const to = url.searchParams.get("to") ? Date.parse(url.searchParams.get("to")) : Number.POSITIVE_INFINITY;
  const providerFilter = url.searchParams.get("provider") || "";
  const bookFilter = url.searchParams.get("book_id") || "";
  const usageFilter = url.searchParams.get("usage_type") || "";
  let cursor;
  const events = [];
  do {
    const listed = await env.OPALREADER_STORAGE.list({ prefix: usageEventPrefix, cursor, limit: 1000 });
    cursor = listed.truncated ? listed.cursor : undefined;
    for (const object of listed.objects) {
      try {
        const item = await env.OPALREADER_STORAGE.get(object.key);
        if (!item) continue;
        const event = item.json ? await item.json() : JSON.parse(await new Response(item.body).text());
        if ((event.timestamp || 0) < from || (event.timestamp || 0) > to) continue;
        if (providerFilter && event.provider !== providerFilter) continue;
        if (bookFilter && event.book_id !== bookFilter) continue;
        if (usageFilter && event.usage_type !== usageFilter) continue;
        events.push(event);
      } catch {}
    }
  } while (cursor);
  const map = new Map();
  for (const event of events) {
    const key = `${event.provider || "unknown"}|${event.usage_type || "other"}`;
    const row = map.get(key) || {
      provider: event.provider || "unknown",
      usage_type: event.usage_type || "other",
      provider_synthesis_calls: 0,
      successful_calls: 0,
      failed_calls: 0,
      characters_sent: 0,
      audio_bytes_returned: 0,
      retries: 0,
      cache_hits: 0,
      skipped_existing_audio: 0,
      estimated_cost: 0,
    };
    if (event.provider_call) {
      row.provider_synthesis_calls += 1;
      row.characters_sent += Number(event.character_count_sent) || 0;
      row.audio_bytes_returned += Number(event.audio_bytes_returned) || 0;
      if (event.request_status === "failed") row.failed_calls += 1;
      else {
        row.successful_calls += 1;
        row.estimated_cost += Number(event.estimated_cost) || 0;
      }
      if ((Number(event.retry_attempt) || 1) > 1) row.retries += 1;
    }
    if (event.cache_status === "cache_hit") row.cache_hits += 1;
    if (event.cache_status === "skipped_existing_audio") row.skipped_existing_audio += 1;
    map.set(key, row);
  }
  return { events: events.length, summary: [...map.values()] };
}
async function libraryIndex(env) {
  return (await env.OPALREADER_KV.get("library:index", "json")) || [];
}
async function saveBook(env, book) {
  if (!book?.id || !validId(book.id))
    throw new Error("Invalid book identifier.");
  const key = `book:${book.id}`,
    existing = await env.OPALREADER_KV.get(key, "json");
  if (existing && (existing.updatedAt || 0) > (book.updatedAt || 0))
    return { book: existing, accepted: false };
  await env.OPALREADER_KV.put(key, JSON.stringify(book));
  const index = await libraryIndex(env),
    summary = {
      id: book.id,
      title: book.title,
      author: book.author || "",
      cover: book.cover || null,
      updatedAt: book.updatedAt || Date.now(),
    },
    at = index.findIndex((item) => item.id === book.id);
  if (at >= 0) index[at] = summary;
  else index.push(summary);
  await env.OPALREADER_KV.put("library:index", JSON.stringify(index));
  return { book, accepted: true };
}
async function cachedAudio(env, key) {
  if (!env.OPALREADER_STORAGE || !validCacheKey(key)) return null;
  return env.OPALREADER_STORAGE.get(`audio/${key}.mp3`);
}
async function storeAudio(env, key, bytes, metadata = {}) {
  if (env.OPALREADER_STORAGE && validCacheKey(key))
    await env.OPALREADER_STORAGE.put(`audio/${key}.mp3`, bytes, {
      httpMetadata: { contentType: "audio/mpeg" },
      customMetadata: metadata,
    });
}

async function hasCachedAudio(env, key) {
  if (!env.OPALREADER_STORAGE || !validCacheKey(key)) return false;
  if (env.OPALREADER_STORAGE.head)
    return Boolean(await env.OPALREADER_STORAGE.head(`audio/${key}.mp3`));
  return Boolean(await env.OPALREADER_STORAGE.get(`audio/${key}.mp3`));
}


async function chapterCompositeAudio(env, audioKeys, cacheKey) {
  if (!env.OPALREADER_STORAGE) throw new Error("R2 storage has not been configured yet.");
  const compositeObjectKey = `chapter-audio/${cacheKey}.mp3`;
  const cached = await env.OPALREADER_STORAGE.get(compositeObjectKey);
  if (cached) return { body: cached.body, cache: "HIT" };
  const chunks = [];
  let total = 0;
  for (const key of audioKeys) {
    const object = await cachedAudio(env, key);
    if (!object) {
      const error = new Error("One or more chapter audio segments are missing from R2.");
      error.status = 404;
      throw error;
    }
    const bytes = new Uint8Array(await new Response(object.body).arrayBuffer());
    chunks.push(bytes);
    total += bytes.byteLength;
  }
  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  await env.OPALREADER_STORAGE.put(compositeObjectKey, combined, {
    httpMetadata: { contentType: "audio/mpeg" },
  });
  return { body: combined, cache: "MISS" };
}

async function compositeCacheKey(bookId, chapterIndex, audioKeys) {
  const value = `${bookId}|${chapterIndex}|${audioKeys.join("|")}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function throwProviderError(response, provider) {
  const label =
    provider === "azure"
      ? "Azure Speech"
      : provider === "google"
        ? "Google Cloud TTS"
        : provider === "speechify"
          ? "Speechify"
          : "ElevenLabs";
  let detail,
    raw = "";
  try {
    raw = await response.text();
    detail = raw ? JSON.parse(raw) : null;
  } catch {}
  const error = new Error(
    errorMessage(detail, raw.trim() || `${label} request failed (${response.status}).`),
  );
  error.status = response.status;
  error.provider = provider;
  error.details = detail || raw || undefined;
  throw error;
}

async function synthesizeAudio(env, provider, body) {
  if (!body.voice_id || !body.text) {
    const error = new Error("Voice and text are required.");
    error.status = 400;
    throw error;
  }
  const limits = { azure: 8000, google: 4500, elevenlabs: 40000, speechify: 20000 };
  if (!limits[provider]) {
    const error = new Error("Unknown voice provider.");
    error.status = 400;
    throw error;
  }
  if (body.text.length > limits[provider]) {
    const error = new Error(
      `This narration segment is too long for one ${provider === "azure" ? "Azure" : provider === "google" ? "Google" : "ElevenLabs"} request. Split the segment first.`,
    );
    error.status = 413;
    throw error;
  }
  const hit = body.cache_key && (await cachedAudio(env, body.cache_key));
  if (hit) {
    await recordTtsUsage(env, body, {
      provider,
      provider_call: false,
      request_status: "succeeded",
      cache_status: "cache_hit",
    });
    return { body: hit.body, cache: "HIT" };
  }
  const started = Date.now();
  let response, bytes, r2WriteSuccess = null;
  try {
    if (provider === "azure") {
      if (!azureReady(env)) {
        const error = new Error(
          "Azure Speech has not been connected. Add AZURE_SPEECH_KEY and AZURE_SPEECH_REGION to the Worker.",
        );
        error.status = 503;
        throw error;
      }
      const languageCode =
          body.language_code || body.voice_id.split("-").slice(0, 2).join("-"),
        ssml = `<speak version="1.0" xml:lang="${xml(languageCode)}"><voice name="${xml(body.voice_id)}">${speechMarkup(body.text)}</voice></speak>`;
      response = await fetch(`${azureBase(env)}/cognitiveservices/v1`, {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": env.AZURE_SPEECH_KEY,
          "Content-Type": "application/ssml+xml",
          "X-Microsoft-OutputFormat": "audio-24khz-96kbitrate-mono-mp3",
          "User-Agent": "OpalReader",
        },
        body: ssml,
      });
      if (!response.ok) await throwProviderError(response, provider);
      bytes = await response.arrayBuffer();
    } else if (provider === "google") {
      if (!env.GOOGLE_CLOUD_TTS_API_KEY) {
        const error = new Error("Google Cloud TTS has not been connected yet.");
        error.status = 503;
        throw error;
      }
      const chirp = /Chirp(?:[\s-]*3)?[\s-]*HD/i.test(body.voice_id),
        audioConfig = { audioEncoding: "MP3" };
      if (!chirp) {
        audioConfig.speakingRate = body.speaking_rate || 1;
        audioConfig.pitch = body.pitch || 0;
      }
      response = await fetch(`${GOOGLE}/text:synthesize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": env.GOOGLE_CLOUD_TTS_API_KEY,
        },
        body: JSON.stringify({
          input: { text: plainSpeechText(body.text) },
          voice: {
            name: body.voice_id,
            languageCode:
              body.language_code || body.voice_id.split("-").slice(0, 2).join("-"),
          },
          audioConfig,
        }),
      });
      if (!response.ok) await throwProviderError(response, provider);
      const data = await response.json();
      bytes = decodeBase64(data.audioContent);
    } else if (provider === "speechify") {
      if (!env.SPEECHIFY_API_KEY) {
        const error = new Error("Speechify has not been connected yet.");
        error.status = 503;
        throw error;
      }
      const hasMarkup = /<\/?emphasis>/i.test(body.text);
      const speechInput = hasMarkup
        ? `<speak>${speechMarkup(body.text)}</speak>`
        : plainSpeechText(body.text);
      response = await fetch(`${SPEECHIFY}/v1/audio/stream`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.SPEECHIFY_API_KEY}`,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          input: speechInput,
          voice_id: body.voice_id,
          model: body.model_id || "simba-3.2",
          language: body.language_code || "en-US",
        }),
      });
      if (!response.ok) await throwProviderError(response, provider);
      bytes = await response.arrayBuffer();
    } else {
      if (!env.ELEVENLABS_API_KEY) {
        const error = new Error("ElevenLabs has not been connected yet.");
        error.status = 503;
        throw error;
      }
      response = await fetch(
        `${EL}/v1/text-to-speech/${encodeURIComponent(body.voice_id)}/stream?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: {
            "xi-api-key": env.ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: plainSpeechText(body.text),
            model_id: body.model_id || "eleven_flash_v2_5",
          }),
        },
      );
      if (!response.ok) await throwProviderError(response, provider);
      bytes = await response.arrayBuffer();
    }
    if (body.cache_key) {
      try {
        await storeAudio(env, body.cache_key, bytes, { provider, voiceId: body.voice_id });
        r2WriteSuccess = true;
      } catch (error) {
        r2WriteSuccess = false;
        throw error;
      }
    }
    await recordTtsUsage(env, body, {
      provider,
      provider_call: true,
      request_status: "succeeded",
      cache_status: "provider_call",
      duration_ms: Date.now() - started,
      audio_bytes: bytes?.byteLength || bytes?.length || 0,
      r2_write_success: r2WriteSuccess,
    });
    return { body: bytes, cache: "MISS" };
  } catch (error) {
    await recordTtsUsage(env, body, {
      provider,
      provider_call: true,
      request_status: "failed",
      cache_status: "provider_call",
      duration_ms: Date.now() - started,
      error: error.message || "Provider request failed.",
      r2_write_success: r2WriteSuccess,
    });
    throw error;
  }
}

const generationPayloadKey = (jobId) => `generation/jobs/${jobId}.json`;
const generationStatusKey = (jobId) => `generation:${jobId}`;
const generationStatusObjectKey = (jobId) =>
  `generation/status/${jobId}.json`;

async function saveGenerationStatus(env, status) {
  const serialized = JSON.stringify(status);
  await Promise.all([
    env.OPALREADER_KV.put(generationStatusKey(status.job_id), serialized, {
      expirationTtl: 60 * 60 * 24 * 14,
    }),
    env.OPALREADER_STORAGE.put(
      generationStatusObjectKey(status.job_id),
      serialized,
      { httpMetadata: { contentType: "application/json" } },
    ),
  ]);
}

async function readGenerationStatus(env, jobId) {
  const object = await env.OPALREADER_STORAGE.get(
    generationStatusObjectKey(jobId),
  );
  if (object) {
    if (object.json) return object.json();
    return JSON.parse(await new Response(object.body).text());
  }
  return env.OPALREADER_KV.get(generationStatusKey(jobId), "json");
}

async function readGenerationPayload(env, jobId) {
  const object = await env.OPALREADER_STORAGE.get(generationPayloadKey(jobId));
  if (!object) return null;
  if (object.json) return object.json();
  return JSON.parse(await new Response(object.body).text());
}

async function processGenerationJob(env, jobId, segmentIndex, attempts = 1) {
  const payload = await readGenerationPayload(env, jobId);
  if (!payload) throw new Error("Generation job payload was not found.");
  let status = (await readGenerationStatus(env, jobId)) || payload.status;
  if (status?.state === "ready") return status;
  status = {
    ...status,
    state: "generating",
    attempts,
    error: null,
    updated_at: Date.now(),
  };
  await saveGenerationStatus(env, status);
  try {
    const index = Number.isInteger(segmentIndex)
        ? segmentIndex
        : status.segments.findIndex((item) => item.state !== "ready"),
      segment = payload.segments[index];
    if (!segment) throw new Error("Generation segment was not found.");
    segment.queue_job_id = jobId;
    segment.retry_attempt = attempts;
    if (!(await hasCachedAudio(env, segment.cache_key))) {
      const result = await synthesizeAudio(env, segment.provider, segment);
      if (result.cache === "MISS")
        status.generated_cost =
          (status.generated_cost || 0) + (Number(segment.estimated_cost) || 0);
    } else {
      await recordTtsUsage(env, segment, {
        provider: segment.provider,
        provider_call: false,
        request_status: "succeeded",
        cache_status: "skipped_existing_audio",
      });
    }
    status.segments[index] = {
      cache_key: segment.cache_key,
      state: "ready",
    };
    status.completed = status.segments.filter(
      (item) => item.state === "ready",
    ).length;
    const next = status.segments.findIndex((item) => item.state !== "ready");
    status.state = next < 0 ? "ready" : "queued";
    status.updated_at = Date.now();
    await saveGenerationStatus(env, status);
    if (next >= 0)
      await env.OPALREADER_GENERATION.send({
        job_id: jobId,
        segment_index: next,
      });
    return status;
  } catch (error) {
    status.state = attempts <= 3 ? "queued" : "failed";
    status.error = error.message || "Chapter generation failed.";
    status.updated_at = Date.now();
    await saveGenerationStatus(env, status);
    throw error;
  }
}
export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers: cors(origin, env) });
    const url = new URL(request.url);
    if ((url.pathname === "/health" || url.pathname === "/health/") && request.method === "GET")
      return json({ ok: true, app: "OpalReader API", version: APP_VERSION }, 200, origin, env);
    if (url.pathname.startsWith("/api/export/audio/") && request.method === "GET") {
      if (!env.OPALREADER_KV || !env.OPALREADER_STORAGE)
        return json({ error: "Export storage is not configured." }, 503, origin, env);
      const token = decodeURIComponent(url.pathname.slice("/api/export/audio/".length));
      if (!/^[a-f0-9]{32}$/i.test(token))
        return json({ error: "Invalid or expired export link." }, 400, origin, env);
      const record = await env.OPALREADER_KV.get(`audio-export:${token}`, "json");
      if (!record?.key || !validCacheKey(record.key))
        return json({ error: "This export link has expired." }, 410, origin, env);
      await env.OPALREADER_KV.delete(`audio-export:${token}`);
      const object = await cachedAudio(env, record.key);
      if (!object) return json({ error: "Audio not found." }, 404, origin, env);
      const filename = String(record.filename || "opalreader-segment.mp3").replace(/[\r\n\"]/g, "_");
      return relay(object.body, 200, "audio/mpeg", origin, env, {
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      });
    }
    if (
      env.OPALREADER_ACCESS_TOKEN &&
      request.headers.get("X-OpalReader-Token") !== env.OPALREADER_ACCESS_TOKEN
    )
      return json(
        { error: "The personal access token is missing or incorrect." },
        401,
        origin,
        env,
      );
    try {
      if (url.pathname === "/api/usage/report" && request.method === "GET")
        return json(await usageReport(env, url), 200, origin, env);
      if (url.pathname === "/api/providers/status" && request.method === "GET")
        return json(
          {
            azure: azureReady(env),
            google: Boolean(env.GOOGLE_CLOUD_TTS_API_KEY),
            elevenlabs: Boolean(env.ELEVENLABS_API_KEY),
            speechify: Boolean(env.SPEECHIFY_API_KEY),
            sync: Boolean(syncReady(env)),
            generation: Boolean(
              env.OPALREADER_GENERATION && syncReady(env),
            ),
          },
          200,
          origin,
          env,
        );
      if (url.pathname === "/api/sync/library" && request.method === "GET") {
        if (!syncReady(env))
          return json(
            {
              error:
                "Cross-device storage bindings have not been configured yet.",
            },
            503,
            origin,
            env,
          );
        const index = await libraryIndex(env),
          books = (
            await Promise.all(
              index.map((item) =>
                env.OPALREADER_KV.get(`book:${item.id}`, "json"),
              ),
            )
          ).filter(Boolean);
        return json({ books }, 200, origin, env);
      }
      if (
        url.pathname.startsWith("/api/sync/book/") &&
        request.method === "PUT"
      ) {
        if (!syncReady(env))
          return json(
            {
              error:
                "Cross-device storage bindings have not been configured yet.",
            },
            503,
            origin,
            env,
          );
        const id = decodeURIComponent(
          url.pathname.slice("/api/sync/book/".length),
        );
        if (!validId(id))
          return json({ error: "Invalid book identifier." }, 400, origin, env);
        const book = await request.json();
        if (book.id !== id)
          return json({ error: "Book identifier mismatch." }, 400, origin, env);
        return json(await saveBook(env, book), 200, origin, env);
      }
      if (url.pathname === "/api/sync/settings" && request.method === "GET") {
        if (!env.OPALREADER_KV)
          return json(
            {
              error:
                "Cross-device settings storage has not been configured yet.",
            },
            503,
            origin,
            env,
          );
        return json(
          { settings: await env.OPALREADER_KV.get("settings:shared", "json") },
          200,
          origin,
          env,
        );
      }
      if (url.pathname === "/api/sync/settings" && request.method === "PUT") {
        if (!env.OPALREADER_KV)
          return json(
            {
              error:
                "Cross-device settings storage has not been configured yet.",
            },
            503,
            origin,
            env,
          );
        const settings = await request.json(),
          existing = await env.OPALREADER_KV.get("settings:shared", "json");
        if (existing && (existing.updatedAt || 0) > (settings.updatedAt || 0))
          return json(
            { settings: existing, accepted: false },
            200,
            origin,
            env,
          );
        await env.OPALREADER_KV.put(
          "settings:shared",
          JSON.stringify(settings),
        );
        return json({ settings, accepted: true }, 200, origin, env);
      }
      if (url.pathname.startsWith("/api/sync/epub/")) {
        if (!env.OPALREADER_STORAGE)
          return json(
            { error: "R2 storage has not been configured yet." },
            503,
            origin,
            env,
          );
        const id = decodeURIComponent(
          url.pathname.slice("/api/sync/epub/".length),
        );
        if (!validId(id))
          return json({ error: "Invalid book identifier." }, 400, origin, env);
        const key = `epubs/${id}.epub`;
        if (request.method === "PUT") {
          await env.OPALREADER_STORAGE.put(key, request.body, {
            httpMetadata: { contentType: "application/epub+zip" },
          });
          return json({ stored: true }, 200, origin, env);
        }
        if (request.method === "GET") {
          const object = await env.OPALREADER_STORAGE.get(key);
          if (!object)
            return json({ error: "EPUB not found." }, 404, origin, env);
          return relay(object.body, 200, "application/epub+zip", origin, env);
        }
      }
      if (url.pathname === "/api/export/audio-url" && request.method === "POST") {
        if (!env.OPALREADER_KV || !env.OPALREADER_STORAGE)
          return json({ error: "Export storage is not configured." }, 503, origin, env);
        const body = await request.json();
        if (!validCacheKey(body?.cache_key))
          return json({ error: "Invalid audio cache key." }, 400, origin, env);
        if (!(await hasCachedAudio(env, body.cache_key)))
          return json({ error: "Audio not found." }, 404, origin, env);
        const token = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, "0")).join("");
        const filename = String(body?.filename || "opalreader-segment.mp3").replace(/[^a-z0-9._-]+/gi, "-").slice(0, 120);
        await env.OPALREADER_KV.put(`audio-export:${token}`, JSON.stringify({ key: body.cache_key, filename }), { expirationTtl: 300 });
        return json({ url: `${url.origin}/api/export/audio/${token}`, expires_in: 300 }, 200, origin, env);
      }

      if (
        url.pathname.startsWith("/api/sync/audio/") &&
        request.method === "GET"
      ) {
        if (!env.OPALREADER_STORAGE)
          return json(
            { error: "R2 storage has not been configured yet." },
            503,
            origin,
            env,
          );
        const key = decodeURIComponent(
          url.pathname.slice("/api/sync/audio/".length),
        );
        if (!validCacheKey(key))
          return json({ error: "Invalid audio cache key." }, 400, origin, env);
        const object = await cachedAudio(env, key);
        if (!object)
          return json({ error: "Audio not found." }, 404, origin, env);
        return relay(object.body, 200, "audio/mpeg", origin, env, {
          "X-OpalReader-Cache": "HIT",
        });
      }

      if (url.pathname === "/api/playback/chapter" && request.method === "POST") {
        const body = await request.json();
        const audioKeys = Array.isArray(body.audio_keys) ? body.audio_keys : [];
        if (!validId(body.book_id) || !Number.isInteger(body.chapter_index) || !audioKeys.length || audioKeys.length > 100 || audioKeys.some((key) => !validCacheKey(key)))
          return json({ error: "Invalid chapter playback request." }, 400, origin, env);
        const key = await compositeCacheKey(body.book_id, body.chapter_index, audioKeys);
        const result = await chapterCompositeAudio(env, audioKeys, key);
        return relay(result.body, 200, "audio/mpeg", origin, env, {
          "X-OpalReader-Cache": result.cache,
          "X-OpalReader-Playback": "chapter-composite",
        });
      }

      if (url.pathname === "/api/generation/jobs" && request.method === "POST") {
        if (!env.OPALREADER_GENERATION || !syncReady(env))
          return json(
            {
              error:
                "Background generation is not configured. Connect the opalreader-generation Queue as OPALREADER_GENERATION and keep the existing KV and R2 bindings.",
            },
            503,
            origin,
            env,
          );
        const payload = await request.json();
        if (
          !validJobId(payload.job_id) ||
          !validId(payload.book_id) ||
          !Number.isInteger(payload.chapter_index) ||
          !Array.isArray(payload.segments) ||
          payload.segments.length < 1 ||
          payload.segments.length > 100 ||
          payload.segments.some(
            (segment) =>
              !validCacheKey(segment.cache_key) ||
              !segment.text ||
              !segment.voice_id ||
              !["azure", "google", "elevenlabs", "speechify"].includes(segment.provider),
          )
        )
          return json(
            { error: "Invalid chapter generation request." },
            400,
            origin,
            env,
          );
        const existing = await readGenerationStatus(env, payload.job_id);
        if (existing && ["queued", "generating", "ready"].includes(existing.state))
          return json(existing, 200, origin, env);
        const ready = await Promise.all(
            payload.segments.map((segment) =>
              hasCachedAudio(env, segment.cache_key),
            ),
          ),
          status = {
            job_id: payload.job_id,
            book_id: payload.book_id,
            chapter_index: payload.chapter_index,
            state: ready.every(Boolean) ? "ready" : "queued",
            completed: ready.filter(Boolean).length,
            total: payload.segments.length,
            generated_cost: Number(existing?.generated_cost) || 0,
            error: null,
            segments: payload.segments.map((segment, index) => ({
              cache_key: segment.cache_key,
              state: ready[index] ? "ready" : "queued",
            })),
            updated_at: Date.now(),
          };
        await env.OPALREADER_STORAGE.put(
          generationPayloadKey(payload.job_id),
          JSON.stringify({ ...payload, status }),
          { httpMetadata: { contentType: "application/json" } },
        );
        await saveGenerationStatus(env, status);
        if (status.state !== "ready")
          await env.OPALREADER_GENERATION.send({
            job_id: payload.job_id,
            segment_index: ready.findIndex((item) => !item),
          });
        return json(status, 202, origin, env);
      }
      if (
        url.pathname.startsWith("/api/generation/jobs/") &&
        request.method === "GET"
      ) {
        if (!syncReady(env))
          return json(
            { error: "Generation status storage is not configured." },
            503,
            origin,
            env,
          );
        const jobId = decodeURIComponent(
          url.pathname.slice("/api/generation/jobs/".length),
        );
        if (!validJobId(jobId))
          return json({ error: "Invalid generation job." }, 400, origin, env);
        let status = await readGenerationStatus(env, jobId);
        if (!status)
          return json({ error: "Generation job not found." }, 404, origin, env);
        if (status.state !== "ready") {
          const payload = await readGenerationPayload(env, jobId);
          if (payload) {
            const ready = await Promise.all(
              payload.segments.map((segment) =>
                hasCachedAudio(env, segment.cache_key),
              ),
            );
            if (ready.every(Boolean)) {
              status = {
                ...status,
                state: "ready",
                completed: status.total,
                error: null,
                segments: payload.segments.map((segment) => ({
                  cache_key: segment.cache_key,
                  state: "ready",
                })),
                updated_at: Date.now(),
              };
              await saveGenerationStatus(env, status);
            }
          }
        }
        return json(status, 200, origin, env);
      }
      if (
        url.pathname === "/api/providers/azure/voices" &&
        request.method === "GET"
      ) {
        if (!azureReady(env))
          return json(
            {
              error:
                "Azure Speech has not been connected. Add AZURE_SPEECH_KEY and AZURE_SPEECH_REGION to the Worker.",
            },
            503,
            origin,
            env,
          );
        const response = await fetch(
          `${azureBase(env)}/cognitiveservices/voices/list`,
          {
            headers: {
              "Ocp-Apim-Subscription-Key": env.AZURE_SPEECH_KEY,
            },
          },
        );
        if (!response.ok) return azureError(response, origin, env);
        const languageCode = url.searchParams.get("languageCode"),
          voices = await response.json();
        return json(
          {
            voices: languageCode
              ? voices.filter((voice) => voice.Locale === languageCode)
              : voices,
          },
          200,
          origin,
          env,
        );
      }
      if (
        url.pathname === "/api/providers/azure/speech" &&
        request.method === "POST"
      ) {
        const body = await request.json();
        const result = await synthesizeAudio(env, "azure", body);
        return relay(result.body, 200, "audio/mpeg", origin, env, {
          "X-OpalReader-Cache": result.cache,
        });
      }
      if (
        url.pathname === "/api/providers/google/voices" &&
        request.method === "GET"
      ) {
        if (!env.GOOGLE_CLOUD_TTS_API_KEY)
          return json(
            { error: "Google Cloud TTS has not been connected yet." },
            503,
            origin,
            env,
          );
        const upstream = new URL(`${GOOGLE}/voices`);
        if (url.searchParams.get("languageCode"))
          upstream.searchParams.set(
            "languageCode",
            url.searchParams.get("languageCode"),
          );
        const response = await fetch(upstream, {
          headers: { "x-goog-api-key": env.GOOGLE_CLOUD_TTS_API_KEY },
        });
        if (!response.ok) return googleError(response, origin, env);
        return new Response(response.body, {
          status: response.status,
          headers: {
            "Content-Type": "application/json",
            ...cors(origin, env),
          },
        });
      }
      if (
        url.pathname === "/api/providers/google/speech" &&
        request.method === "POST"
      ) {
        const body = await request.json();
        const result = await synthesizeAudio(env, "google", body);
        return relay(result.body, 200, "audio/mpeg", origin, env, {
          "X-OpalReader-Cache": result.cache,
        });
      }
      if (
        url.pathname === "/api/providers/speechify/voices" &&
        request.method === "GET"
      ) {
        if (!env.SPEECHIFY_API_KEY)
          return json(
            { error: "Speechify has not been connected yet." },
            503,
            origin,
            env,
          );
        const upstream = new URL(`${SPEECHIFY}/v1/voices`);
        for (const key of ["locale", "gender", "model", "limit", "cursor"]) {
          const value = url.searchParams.get(key);
          if (value) upstream.searchParams.set(key, value);
        }
        const response = await fetch(upstream, {
          headers: { Authorization: `Bearer ${env.SPEECHIFY_API_KEY}` },
        });
        if (!response.ok) {
          let detail = "";
          try { detail = await response.text(); } catch {}
          return json(
            { error: detail || `Speechify voice request failed (${response.status}).`, provider: "speechify" },
            response.status,
            origin,
            env,
          );
        }
        return new Response(response.body, {
          status: response.status,
          headers: { "Content-Type": "application/json", ...cors(origin, env) },
        });
      }
      if (
        url.pathname === "/api/providers/speechify/speech" &&
        request.method === "POST"
      ) {
        const body = await request.json();
        const result = await synthesizeAudio(env, "speechify", body);
        return relay(result.body, 200, "audio/mpeg", origin, env, {
          "X-OpalReader-Cache": result.cache,
        });
      }
      if (
        url.pathname === "/api/providers/elevenlabs/voices" &&
        request.method === "GET"
      ) {
        if (!env.ELEVENLABS_API_KEY)
          return json(
            { error: "ElevenLabs has not been connected yet." },
            503,
            origin,
            env,
          );
        const shared = url.searchParams.get("library") === "true",
          target = shared
            ? new URL(`${EL}/v1/shared-voices`)
            : new URL(`${EL}/v2/voices`);
        for (const [key, value] of url.searchParams)
          if (key !== "library") target.searchParams.set(key, value);
        if (!shared) target.searchParams.set("include_total_count", "true");
        const response = await fetch(target, {
          headers: { "xi-api-key": env.ELEVENLABS_API_KEY },
        });
        return new Response(response.body, {
          status: response.status,
          headers: { "Content-Type": "application/json", ...cors(origin, env) },
        });
      }
      if (
        url.pathname === "/api/providers/elevenlabs/shared/add" &&
        request.method === "POST"
      ) {
        if (!env.ELEVENLABS_API_KEY)
          return json(
            { error: "ElevenLabs has not been connected yet." },
            503,
            origin,
            env,
          );
        const body = await request.json();
        if (!body.public_user_id || !body.voice_id)
          return json(
            { error: "Shared voice owner and ID are required." },
            400,
            origin,
            env,
          );
        const response = await fetch(
          `${EL}/v1/voices/add/${encodeURIComponent(body.public_user_id)}/${encodeURIComponent(body.voice_id)}`,
          {
            method: "POST",
            headers: {
              "xi-api-key": env.ELEVENLABS_API_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              new_name: body.new_name || "OpalReader voice",
              bookmarked: true,
            }),
          },
        );
        return new Response(response.body, {
          status: response.status,
          headers: { "Content-Type": "application/json", ...cors(origin, env) },
        });
      }
      if (
        url.pathname === "/api/providers/elevenlabs/speech" &&
        request.method === "POST"
      ) {
        const body = await request.json();
        const result = await synthesizeAudio(env, "elevenlabs", body);
        return relay(result.body, 200, "audio/mpeg", origin, env, {
          "X-OpalReader-Cache": result.cache,
        });
      }
      return json({ error: "Not found" }, 404, origin, env);
    } catch (error) {
      return json(
        {
          error: error.message || "Provider request failed.",
          provider: error.provider,
          status: error.status,
          details: error.details,
        },
        error.status || 502,
        origin,
        env,
      );
    }
  },
  async queue(batch, env) {
    for (const message of batch.messages) {
      const jobId = message.body?.job_id;
      try {
        if (!validJobId(jobId)) throw new Error("Invalid generation job.");
        await processGenerationJob(
          env,
          jobId,
          message.body?.segment_index,
          message.attempts || 1,
        );
        message.ack();
      } catch (error) {
        if ((message.attempts || 1) <= 3)
          message.retry({
            delaySeconds: Math.min(60, 2 ** (message.attempts || 1)),
          });
        else message.ack();
      }
    }
  },
};
