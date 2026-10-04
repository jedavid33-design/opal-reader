# OpalReader v1.4.52

Current source of truth: `app-190.js` + `styles-139.css` + `sw-152.js`; Worker source `cloudflare-worker.js` v1.4.15.

Current stack: Gemini / Fish Audio / Azure / OpenAI TTS, Cloudflare Queue generation, KV sync, private R2 audio caching, Opal Shelf listening-time sync, per-section playback/navigation, and EPUB imports targeting ~1,500-character narration segments.

Gemini TTS billing is token-based, not character-based. Worker v1.4.15 records Gemini `usageMetadata` input/output tokens and calculated provider cost for new calls. The Setup TTS report separates token-metered cost from legacy character estimates; the local soft-cap number is explicitly only a forecast. Frontend v1.4.51 routes individual segment generation through the existing Cloudflare Queue, using a durable one-segment job so iOS/Safari no longer has to hold the provider request open. The same job ID is resumed after a lost acknowledgement, and the Worker's duplicate-delivery lease prevents duplicate provider synthesis. Cast and Chapters now also show a full-book/current-cast cost forecast plus the still-ungenerated forecast. Legacy v1.4.50 pending direct requests are still recoverable. v1.4.52 also ignores explicit `data-opal-narration="skip"` regions and EPUB-native `titlepage` regions while importing, so OCR Studio's visible title/author page no longer becomes a TTS chapter.

> The versioned notes below are historical and may mention providers or implementation details that are no longer active.

## Historical notes

## OpalReader v1.2.0

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


## Opal POV metadata
Opal Reader v137 recognizes Book OCR Studio chapter metadata exported as `data-opal-pov="Character"` on EPUB chapter sections. When present, that POV is authoritative for the chapter and uppercase text inside the chapter is not interpreted as a narrator switch. EPUBs without the tag continue to use the existing POV heuristic.


## v1.3.7 — unified mobile reader

- Unified the v135 backup/restore and diagnostic work with v136 authoritative Book OCR Studio POV metadata.
- Added pull-to-refresh on touch devices when the reader is already at the top of the page.
- Preserved the mobile chapter-card overflow fix so long chapter titles wrap without pushing controls offscreen.
