# OpalReader v1.2.0

Personal EPUB audiobook reader with per-POV casting, Cloudflare Queue generation, KV sync, and private R2 audio caching.

## v1.2.0 — Wednesday book-club readiness pass

- Added **Speechify Simba 3.2** as a fourth provider.
- Added Speechify voice browsing, Book Audition, cast assignment, Queue generation, R2 reuse, cost estimation, and usage-ledger support.
- Added a **Setup → Refresh TTS report** view backed by the Worker's detailed usage ledger.
- EPUB import now preserves italic/emphasis semantics as speech metadata. Azure and Speechify receive safe `<emphasis>` SSML; providers without that path receive clean text rather than spoken markup.
- Chapter audio becomes playable as soon as a generated segment is actually ready instead of waiting for every segment in the chapter.
- When playback reaches an unfinished next segment/chapter, the logical resume target advances instead of replaying the completed audio.
- Added Media Session handlers for lock-screen Play/Pause, ±seek, previous/next chapter, metadata, and playback-state restoration.
- Hardened the mobile viewport/nav so Library / Cast / Chapters / Setup cannot widen the page horizontally.
- Hardened the floating player so it stays attached to the viewport rather than drifting with page scroll.
- Preserved the existing Queue, KV, R2, Azure, Google, ElevenLabs, playback-speed, cached-audio, and replacement-generation behavior.
- Service-worker cache bumped to `opalreader-shell-v24`.

## Worker secrets and bindings

Keep the existing secrets and bindings. Add `SPEECHIFY_API_KEY` only when you are ready to test Speechify.

Provider secrets:
- `SPEECHIFY_API_KEY`
- `ELEVENLABS_API_KEY`
- `GOOGLE_CLOUD_TTS_API_KEY`
- `AZURE_SPEECH_KEY`
- `AZURE_SPEECH_REGION`
- `OPALREADER_ACCESS_TOKEN`

Cloudflare bindings:
- `OPALREADER_KV`
- `OPALREADER_STORAGE`
- `OPALREADER_GENERATION`

The Worker exposes public `GET /health` with only status/version. `GET /api/usage/report` remains PAT-protected.

## Speechify

OpalReader explicitly requests `simba-3.2` for English synthesis. Voice browsing uses Speechify's `/v1/voices` catalog and synthesis uses `/v1/audio/stream` with MP3 output. Book Auditions and normal generation are cached in R2 using the same provider/model/voice/text-sensitive cache identity as the existing engines.

## Playback note

The pass removes the app-side stale-state bugs we reproduced around completed chapters, partially generated chapters, and lock-screen resume. iOS can still impose browser/PWA background-media restrictions outside the app's control; test locked-screen auto-advance on the target iPhone before relying on it for long unattended listening.

## Deployment

See `UPLOAD-INSTRUCTIONS.txt`.
