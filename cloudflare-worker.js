const EL = "https://api.elevenlabs.io";
const GOOGLE = "https://texttospeech.googleapis.com/v1";
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
const decodeBase64 = (value) => {
  const binary = atob(value),
    bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};
const validId = (value) => /^[a-zA-Z0-9_-]{8,100}$/.test(value || "");
const validCacheKey = (value) => /^(preview-)?[a-f0-9]{64}$/.test(value || "");
const syncReady = (env) => env.OPALREADER_KV && env.OPALREADER_STORAGE;
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
export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers: cors(origin, env) });
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
    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/providers/status" && request.method === "GET")
        return json(
          {
            google: Boolean(env.GOOGLE_CLOUD_TTS_API_KEY),
            elevenlabs: Boolean(env.ELEVENLABS_API_KEY),
            sync: Boolean(syncReady(env)),
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
        return new Response(
          (
            await fetch(upstream, {
              headers: { "x-goog-api-key": env.GOOGLE_CLOUD_TTS_API_KEY },
            })
          ).body,
          {
            headers: {
              "Content-Type": "application/json",
              ...cors(origin, env),
            },
          },
        );
      }
      if (
        url.pathname === "/api/providers/google/speech" &&
        request.method === "POST"
      ) {
        if (!env.GOOGLE_CLOUD_TTS_API_KEY)
          return json(
            { error: "Google Cloud TTS has not been connected yet." },
            503,
            origin,
            env,
          );
        const body = await request.json();
        if (!body.voice_id || !body.text)
          return json(
            { error: "Voice and text are required." },
            400,
            origin,
            env,
          );
        if (body.text.length > 4500)
          return json(
            {
              error:
                "This narration segment is too long for one Google request. Split the segment first.",
            },
            413,
            origin,
            env,
          );
        const hit = body.cache_key && (await cachedAudio(env, body.cache_key));
        if (hit)
          return relay(hit.body, 200, "audio/mpeg", origin, env, {
            "X-OpalReader-Cache": "HIT",
          });
        const response = await fetch(`${GOOGLE}/text:synthesize`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": env.GOOGLE_CLOUD_TTS_API_KEY,
          },
          body: JSON.stringify({
            input: { text: body.text },
            voice: {
              name: body.voice_id,
              languageCode:
                body.language_code ||
                body.voice_id.split("-").slice(0, 2).join("-"),
            },
            audioConfig: {
              audioEncoding: "MP3",
              speakingRate: body.speaking_rate || 1,
              pitch: body.pitch || 0,
            },
          }),
        });
        if (!response.ok)
          return new Response(response.body, {
            status: response.status,
            headers: {
              "Content-Type": "application/json",
              ...cors(origin, env),
            },
          });
        const data = await response.json(),
          bytes = decodeBase64(data.audioContent);
        if (body.cache_key)
          await storeAudio(env, body.cache_key, bytes, {
            provider: "google",
            voiceId: body.voice_id,
          });
        return relay(bytes, 200, "audio/mpeg", origin, env, {
          "X-OpalReader-Cache": "MISS",
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
        if (!env.ELEVENLABS_API_KEY)
          return json(
            { error: "ElevenLabs has not been connected yet." },
            503,
            origin,
            env,
          );
        const body = await request.json();
        if (!body.voice_id || !body.text)
          return json(
            { error: "Voice and text are required." },
            400,
            origin,
            env,
          );
        if (body.text.length > 40000)
          return json(
            {
              error:
                "This narration segment is too long for one ElevenLabs request.",
            },
            413,
            origin,
            env,
          );
        const hit = body.cache_key && (await cachedAudio(env, body.cache_key));
        if (hit)
          return relay(hit.body, 200, "audio/mpeg", origin, env, {
            "X-OpalReader-Cache": "HIT",
          });
        const response = await fetch(
          `${EL}/v1/text-to-speech/${encodeURIComponent(body.voice_id)}/stream?output_format=mp3_44100_128`,
          {
            method: "POST",
            headers: {
              "xi-api-key": env.ELEVENLABS_API_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              text: body.text,
              model_id: body.model_id || "eleven_flash_v2_5",
            }),
          },
        );
        if (!response.ok)
          return new Response(response.body, {
            status: response.status,
            headers: {
              "Content-Type": "application/json",
              ...cors(origin, env),
            },
          });
        const bytes = await response.arrayBuffer();
        if (body.cache_key)
          await storeAudio(env, body.cache_key, bytes, {
            provider: "elevenlabs",
            voiceId: body.voice_id,
          });
        return relay(bytes, 200, "audio/mpeg", origin, env, {
          "X-OpalReader-Cache": "MISS",
        });
      }
      return json({ error: "Not found" }, 404, origin, env);
    } catch (error) {
      return json(
        { error: error.message || "Provider request failed." },
        502,
        origin,
        env,
      );
    }
  },
};
