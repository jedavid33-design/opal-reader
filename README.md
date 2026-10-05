# OpalReader v1.4.66

Current source of truth: `app-204.js` + `styles-139.css` + `sw-166.js`; Worker source `cloudflare-worker.js` v1.4.23.

Current stack: Gemini / Fish Audio / Azure / OpenAI TTS, Cloudflare Queue generation, KV sync, private R2 audio caching, Opal Shelf listening-time sync, per-section playback/navigation, and EPUB imports targeting ~1,500-character narration segments.

Worker v1.4.23 recognizes Gemini 3.8 Interactions HTTP 400 policy refusals such as `Request blocked for an unspecified policy reason. Please modify your input and retry.` as blocked content. Those refusals are single-shot, do not consume automatic Queue retries, and reuse Reader's existing blocked-segment recovery flow: split the segment, use the free device voice, or choose another cloud voice. Other Gemini 400 errors still remain generic failures.\n\nWorker v1.4.17 hardens Gemini TTS against missing narration at the start of a segment. Narration/style directions now travel in `systemInstruction`, while `contents[].parts[].text` contains only the verbatim book excerpt. The instruction explicitly requires the first through last words, narration before colons, speaker tags, and quoted dialogue to be spoken exactly once. Existing cached audio is not invalidated automatically.

v1.4.66 + Worker v1.4.22 migrate Gemini narration to **Gemini 3.8 Flash TTS** by default. Existing cast voice assignments and `style_direction` notes are preserved; only the Gemini model selection changes. Worker 1.4.22 uses the Gemini Interactions API, sends the book text as the strict verbatim `text` transcript, and sends sustained delivery notes through `speech_metadata.style`. Unary 3.8 output is stored directly as WAV. Usage accounting now understands Interactions API token fields and 3.8 pricing. Setup also offers 3.8 Flash-Lite as an optional lower-cost alternative.

v1.4.65 + Worker v1.4.21 let Reader get past an isolated Gemini HTTP 500 instead of sacrificing the rest of a chapter. In a multi-segment job, the Worker marks only that piece `provider_failed`, does not auto-retry it, and continues later segments. Segment Review then offers **Retry Gemini**, **Use free device voice**, or **Choose another cloud voice** for the failed piece. Legacy 500 failures from older Worker versions are recovered into the same per-segment UI after reload. `Generate rest of chapter` skips an isolated failed piece so it cannot be re-requested accidentally.

Worker v1.4.20 also makes Gemini HTTP 500 internal errors single-shot Queue failures. Because newly freed Gemini TTS request slots may be scarce under the apparent rolling 24-hour quota window, Reader no longer spends up to four automatic Queue attempts on the same provider-side 500; the user can explicitly retry later.

v1.4.64 + Worker v1.4.19 make Gemini quota exhaustion a first-class Queue failure. The Worker marks Gemini HTTP 429 responses with `quota_exceeded`, stops Queue retries immediately, and ACKs the delivery. Segment Review recognizes that state and does **not** offer an immediate new queued synthesis while quota is still exhausted; it clears the failed job reference so a later explicit tap can start a fresh job once quota returns.

Worker v1.4.18 treats Gemini HTTP 429 quota/rate-limit responses as terminal for that Queue delivery. Reader records the failure once and the Queue consumer acknowledges it instead of auto-retrying the same segment up to four times. A later explicit user retry remains available after Gemini quota recovers.

v1.4.63 fixes Segment Review progress labeling for **Generate rest of chapter**. While a chapter Queue job is active, only segments actually included in that job show **Chapter working…**; already-generated segments outside the queued subset keep their normal label. The chapter-wide action remains disabled during the active job to prevent overlapping generation.

v1.4.62 restores the previous Segment Review button layout after v1.4.61 was based on a misunderstood screenshot. The actual issue was Gemini successfully returning audio while omitting the opening narration of a segment; that is addressed by Worker v1.4.17, which sends narration instructions as `systemInstruction` and the book excerpt as a separate verbatim transcript.

v1.4.61 compacts Segment Review generation controls on mobile. **Generate/Regenerate segment** and **Generate rest** now sit side-by-side instead of stacking into two oversized rows, while keeping the same queue behavior and cost safeguards. This frontend-only change does not require a Worker redeploy.

v1.4.60 hardens whole-chapter Queue submission against Safari/network acknowledgement loss. If the POST returns a transport error such as `Load failed` without an HTTP status, Reader keeps the exact chapter/regeneration job in `queued` state and polls that same job instead of presenting it as failed or risking a duplicate paid request. **Clear error** now resumes a preserved failed job ID when one exists; if the Worker confirms the job is gone (404), Reader can then safely surface an expired-job failure for an explicit retry.

v1.4.59 removes the old stitched/composite chapter playback path. Reader now always plays the actual narration segments one-by-one and auto-advances between them. The **−15s / +30s** transport remains cross-segment and cross-chapter: it measures neighboring cached audio durations and lands at the correct offset in the adjacent segment instead of being trapped by a segment boundary. Device/system fallback speech has no seekable timeline, so crossing into it lands at its start; while already in device speech, −15 moves into the previous audio segment and +30 moves to the next playable segment.

v1.4.58 makes the free device/system fallback voice always speak at **1.0×**, regardless of the audiobook player's selected playback speed. Cloud-generated audio continues to use the normal player speed.

v1.4.57 fixes the iOS device-voice handoff used by blocked-segment fallback. Reader now keeps a fallback segment selected if system speech fails to auto-start, never treats an `onend` that occurred before `onstart` as a completed segment, labels the player `device voice · tap Play` when manual intervention is needed, and gives an explicit Play/section tap a synchronous `speechSynthesis.speak()` path before IndexedDB or voice-loading awaits can consume iOS user activation. This prevents the fallback segment from being silently skipped to the next Gemini segment.

v1.4.56 removes the now-redundant chapter-level **Generation provider** override from chapter details. Chapter generation always follows the assigned cast, while blocked-text recovery can still use a one-segment fallback voice without changing the cast. Existing saved chapter-provider overrides are ignored/cleared when a book is hydrated. Failed generation cards now also show **Clear error**, which dismisses the stale failure state without deleting audio or the section.

v1.4.55 adds **Generate rest of chapter** beside normal per-segment generation in Segment Review. Starting at the selected segment, Reader queues only missing or stale cloud-generated segments through the end of the chapter, reuses current cached audio, skips already-resolved device-voice fallbacks and still-blocked segments, shows an estimated incremental cost before submission, and preserves a stable Queue job ID if Safari loses the acknowledgement.

v1.4.54 adds a last-resort blocked-text fallback after safe splitting is exhausted. Reader can use a free browser/device speech voice for only that blocked piece, with no cloud TTS provider request or provider charge, and chapter playback can step into and out of that device-spoken segment. Alternatively, the user can choose a one-segment cloud fallback voice without changing the book cast; Reader prefers Azure when available, then Fish, OpenAI, and Gemini. The device fallback is not an R2 audio file, so export/composite audio and background/lock-screen behavior remain subject to browser/iOS speech-synthesis limits.

v1.4.53 / Worker v1.4.16 changes Gemini `PROHIBITED_CONTENT` handling: during whole-chapter Queue generation, only the refused segment is marked blocked and the Worker continues generating the remaining segments. A deliberate one-segment job still stops on that segment. Reader surfaces the blocked segment, never auto-retries it, and offers **Split blocked segment & continue** after the rest of the chapter finishes; the split uses a natural paragraph/sentence boundary, preserves the exact wording, and reuses already-cached chapter audio so only the smaller replacement pieces need synthesis.

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
