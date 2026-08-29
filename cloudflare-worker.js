const EL = "https://api.elevenlabs.io";
const GOOGLE = "https://texttospeech.googleapis.com/v1";
const cors = (origin, env) => ({
  "Access-Control-Allow-Origin":
    env.ALLOWED_ORIGIN === "*" ? "*" : env.ALLOWED_ORIGIN || origin,
  "Access-Control-Allow-Headers": "Content-Type, X-OpalReader-Token",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  Vary: "Origin",
});
const json = (body, status, origin, env) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors(origin, env) },
  });
const relay = (response, origin, env, type = "application/json") =>
  new Response(response.body, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("Content-Type") || type,
      ...cors(origin, env),
    },
  });
const decodeBase64 = (value) => {
  const binary = atob(value),
    bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};
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
        upstream.searchParams.set("key", env.GOOGLE_CLOUD_TTS_API_KEY);
        return relay(await fetch(upstream), origin, env);
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
        const response = await fetch(
          `${GOOGLE}/text:synthesize?key=${encodeURIComponent(env.GOOGLE_CLOUD_TTS_API_KEY)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
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
          },
        );
        if (!response.ok) return relay(response, origin, env);
        const data = await response.json();
        return new Response(decodeBase64(data.audioContent), {
          headers: { "Content-Type": "audio/mpeg", ...cors(origin, env) },
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
        return relay(
          await fetch(target, {
            headers: { "xi-api-key": env.ELEVENLABS_API_KEY },
          }),
          origin,
          env,
        );
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
        return relay(
          await fetch(
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
          ),
          origin,
          env,
        );
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
        return relay(
          await fetch(
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
          ),
          origin,
          env,
          "audio/mpeg",
        );
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
