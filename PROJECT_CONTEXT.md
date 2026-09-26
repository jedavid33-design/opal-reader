# OpalReader Project Context

Last updated: 2026-09-24

## Source of truth
- Repository: jedavid33-design/opal-reader
- Main branch is the source of truth.
- Current frontend generation: app-137.js / styles-137.css / sw-137.js.
- cloudflare-worker.js is the Worker source of truth.
- Keep deliverables flat when making ZIPs: all files at ZIP root, no enclosing folder.

## v137 unified frontend
- Unified the previously split v135/v136 frontend on 2026-09-23.
- v137 uses the latest v135 backup/restore, audition, and TTS diagnostic work as its base while preserving v136 Book OCR Studio `data-opal-pov` support.
- The mobile chapter-card overflow fix is included in `styles-137.css`.
- Added touch pull-to-refresh for iPhone/PWA use. Pulling down from the top shows a small status pill; releasing after the threshold saves the current playback position and reloads the app.
- `index.html` now loads `app-137.js` and `styles-137.css`.
- Do not resume feature work from app-135.js or app-136.js; v137 is the new frontend source of truth.

## Product
OpalReader is Julie's EPUB-to-audiobook reader/generator. It imports EPUBs, identifies POV/narrator roles, casts voices, generates chapter audio through configured TTS providers, caches audio, and provides playback/progress controls.

## Current TTS providers / model work
- Speechify is actively used.
- Speechify model selector includes Simba 3.2 and Simba 3.0 for testing.
- Denise is a preferred narrator under investigation.
- Shaun at Speechify support confirmed Denise on Simba 3.2 can have a voice-identity defect because it is zero-shot on 3.2.
- Speechify recommended Simba 3.0 with Denise as the interim choice.
- Simba 3.0 has shown separate rendering glitches: repeated phrases that sound like a skipping CD and intermittent omitted text.
- Do not assume these are Denise-specific until other voices/books provide controls.

## Preserved Denise diagnostics
- Simba 3.2 Chapter 32 Segment 1 had major identity/timbre drift around 1:24, 2:20, 2:30.
- Simba 3.0 regeneration of the same segment fixed the dramatic identity shifts but had four repetition/skipping artifacts. Examples: about 0:40 "work as well work as well" and 1:22 "takes my face takes my face".
- The repeated phrases are present in the generated MP3, not merely app playback.
- Later Denise/Simba 3.0 chapters showed omitted passages.
- Two omissions were initially found at ends of segments, including Chapter 37 Segment 2.
- Chapter 39 then showed omissions near the beginning and middle of a segment, so this is not simply end-of-request truncation.
- An Emmett Simba 3.0 Chapter 36 was checked and was clean.
- Julie is preserving suspicious renders and highlighting omitted passages in the book for later debugging rather than regenerating them.
- One preserved omission diagnostic request ID: 5708c5994642ecfcec75b35f.
- Earlier known audio/cache keys from testing:
  - Simba 3.2 bad control: 3f9b43bb633284ee16b6c1c398b7e95980bfcd8b613a3d4016996e9c9727b627
  - Simba 3.0 Chapter 32 Segment 1 comparison: 1be51241bff1166d78e42f2d323fde871492c4eeba03dec1e5a7334e73e72439

## Diagnostic workflow
When missing/repeated/bad audio is found:
1. Do not regenerate the affected segment until evidence is preserved.
2. Confirm source text exists in EPUB/reader.
3. Use Review POV -> Listen to segment to play the cached segment MP3 directly.
4. Capture model, provider request ID, and audio key.
5. Verify exact TTS request text before assigning fault to Speechify.
6. Single-segment regeneration is available after evidence is preserved.

## Current features added during Speechify investigation
- Review POV exposes Prepare MP3 for generated segments.
- Review POV exposes Regenerate segment, which regenerates only that segment with the current cast/model.
- Review POV exposes Listen to segment, which plays only the existing cached MP3 and stops at that segment's end. It does not regenerate or mutate audio.
- Provider request IDs and generated model information are retained when returned by generation jobs.
- These diagnostics are intended to distinguish provider rendering failures from OpalReader chapter assembly/playback issues.

## Voice audition
- Voice audition uses book text appropriate to the selected POV/role.
- As of 2026-09-24, audition text is roughly 190 characters, targeting about 35 seconds of speech.
- This change affects voice audition only. Production TTS segmentation is unchanged.

## Audio / generation principles
- Generation and playback must preserve existing cached audio until a replacement succeeds.
- Avoid unnecessary regeneration because it costs provider credits and destroys useful bug specimens.
- Single-segment regeneration should remain available permanently.
- Keep provider/model/cache/request metadata useful for debugging.
- Chapter playback bugs and provider-generation bugs must be isolated rather than assumed.

## Current investigation status
- Denise issues are intentionally on the back burner.
- Continue normal reading and observe whether omissions, repetitions, or identity drift reproduce with other voices in new books.
- If other voices show the same omissions, investigate a broader Speechify/model/request issue.
- If other voices remain clean while Denise repeatedly fails, strengthen the Denise-specific case and return to Speechify support with preserved request IDs/files.

## Recent commits
- 6196bb3: Add single-segment audio preview for TTS diagnostics.
- 4973368: Shorten voice audition samples to about 20 seconds.
- 2026-09-24: Shorten voice audition samples to ~35 seconds of speech (~190 chars).
- 2026-09-24: Add delete-with-backup flow (book header Delete button, backup-first confirmation, IndexedDB cleanup).

## Book backup / restore
- Added 2026-09-23 in commit e1bca42.
- A book can be exported from its book header with **Back up book**.
- Backup is a portable `.opalreader.zip` containing `book.json`, the original EPUB when locally available, and every generated segment MP3 that can be recovered from local storage or R2.
- Library has **Import backup** to restore the book state, EPUB, and backed-up audio.
- Restored MP3s are written to local IndexedDB and playback now checks local restored audio before R2, so a restored full backup remains playable even if the R2 object is later unavailable.
- Backup preserves OpalReader metadata including POV/cast, chapter/segment state, playback progress, audio keys, request/model metadata already stored on the book, etc.
- Current backup format identifier: `opalreader-book-backup`, version 1.
- This is intended to make deleting/archive-and-restore workflows reversible.

## R2 purge on delete (added 2026-09-26)
- New worker endpoint `DELETE /api/audio/purge` removes a book's R2 objects: segment audio (`audio/<key>.mp3/.wav`), chapter composites (`chapter-audio/<key>.mp3/.wav`, key recomputed server-side), and generation job payloads (`generation/jobs/<jobId>.json`) plus KV statuses.
- `deleteBookFlow` calls it best-effort after clearing local IndexedDB; local deletion never blocks on it. Keeps free-tier R2 storage from growing unboundedly.

## Delete with backup (added 2026-09-24)
- The book header now has a **Delete book** button next to Back up book.
- Tapping it asks: back up first, then delete (OK), or choose the next step (Cancel).
- Back-up-first path downloads the standard `.opalreader.zip` backup; if the backup fails, nothing is deleted.
- Skipping the backup asks for explicit confirmation that deletion is without a backup and cannot be undone.
- Deletion removes the book record, its local EPUB, and its cached segment audio from IndexedDB, then returns to the Library view.
- Remote R2 audio objects are intentionally left in place for now; a restored backup plays from local audio first, so orphans are harmless but may accumulate. A worker-side R2 cleanup pass can be added later if storage becomes a concern.

## v1.4.0: five new TTS providers (2026-09-26)
- Added Fish Audio, OpenAI TTS, Gemini TTS, Kokoro (self-hosted), and Chatterbox (self-hosted) alongside Azure, Google, ElevenLabs, Speechify. Worker APP_VERSION and frontend APP_UI_VERSION bumped to 1.4.0.
- Worker synthesis branches: `fish` (POST api.fish.audio/v1/tts, model header, format mp3), `openai` (POST api.openai.com/v1/audio/speech, response_format mp3), `gemini` (generateContent with responseModalities AUDIO; base64 PCM converted to WAV via pcmToWav), `kokoro`/`chatterbox` (POST {base}/v1/audio/speech, OpenAI-compatible, MP3 requested, response format sniffed).
- Gemini returns 24 kHz mono 16-bit PCM, never MP3. The worker wraps it in a WAV header and stores it as `audio/{key}.wav` (content-type audio/wav). Audio storage is now format-aware: cachedAudio tries `.mp3` then `.wav`; storeAudio picks extension from metadata.format; playback/export endpoints serve the stored content type.
- Chapter composites: WAV segments are concatenated at the PCM level (headers stripped, single header re-attached). Mixed MP3+WAV chapters are rejected with 422 and a plain-language message instead of producing a corrupt file.
- New endpoints: `/api/providers/{fish,openai,gemini,kokoro,chatterbox}/voices` and `/speech`. Fish voices proxy api.fish.audio/model with title search + pagination. OpenAI (10 voices), Gemini (30 prebuilt voices) use static catalogs. Kokoro/Chatterbox proxy `{base}/v1/audio/voices` with static fallbacks (28 Kokoro voices; Chatterbox "default").
- `/api/providers/status` now reports fish, openai, gemini, kokoro, chatterbox. Background job validation accepts all nine providers.
- Frontend: 9 Voice Lab tabs; provider display names; per-1M-char pricing (Fish $15, OpenAI $15, Gemini $1 flash/$8 pro, Kokoro $0, Chatterbox $0); per-provider model settings persisted like elevenModel/speechifyModel (fishModel, openaiModel, geminiModel, kokoroModel, chatterboxModel); model selects in Settings; Qr() helper picks the right model for auditions/prosody/chapter/regen; fallback provider chain extended (speechify > fish > openai > gemini > azure > google > kokoro > chatterbox > elevenlabs).
- Required Worker secrets (Julie adds these herself): FISH_AUDIO_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY (Google AI Studio key, not the Cloud TTS key), KOKORO_TTS_URL (+ optional KOKORO_API_KEY), CHATTERBOX_TTS_URL (+ optional CHATTERBOX_API_KEY).
- Gemini pricing is promotional through 2026 and may change in 2027; revisit before year-end.
- No automatic cross-provider fallback was added (failed segments still retry the same provider 3x). That remains a separate decision.
