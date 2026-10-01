# OpalReader Project Context

Last updated: 2026-09-30

## Source of truth
- Repository: jedavid33-design/opal-reader
- Main branch is the source of truth.
- Current frontend generation: app-172.js (v1.4.35) / styles-139.css / sw-142.js.
- v1.4.35: -15s/+30s now span section and chapter boundaries via seekBy(). Backward: while t<0, stepSection(-1) to the previous generated section (crossing chapters), probe its duration with a temp Audio element, t+=dur. Forward: while t>dur, stepSection(+1), t-=dur. Then Ot() to the target and apply the final time once metadata is ready. Section-row CSS fixed for the light modal theme (was unreadable white-on-white). Composite chapters keep the old clamp. Lock-screen seekbackward/seekforward route through seekBy too. Tested: 18 node harness checks. Live 2026-09-30 ~10:45pm EDT.
- v1.4.34: per-section navigation for un-composited chapters (>10 segments). Player context row now has ‹ › prev/next-section buttons; the "segment N/M" label is tappable and opens a Sections jump list (all sections, current highlighted, ungenerated rows disabled). prevSection scans backward for the last generated section, crossing chapter boundaries (restarts section 1 at the very start); nextSection advances or moves to the next playable chapter via Me(). Section jumps go through Ot() so composite mode yields to per-segment play. Media-session prev/next stay chapter-level. Tested: 14 node harness checks on extracted jr/prevSection/nextSection/renderSectionList. Live 2026-09-30 ~9:50pm EDT.
- Current worker: v1.4.9.
- v1.4.33: `onended` segment-boundary handler also skips the composite for chapters with >10 segments (was only skipped at chapter start in v1.4.32) + added "onended next seg=" breadcrumb. Live 2026-09-30 ~1:52pm EDT.
- Julie 2026-09-30 ~1:51pm: ch18 plays on 1.4.32 but segment advance seemed stalled; when she switched away and back, section two started correctly (not a restart of section 1). Likely the boundary composite attempt (removed in 1.4.33) plus iOS background suspension delaying the async handoff. Awaiting retest on 1.4.33 for prompt handoffs.
- cloudflare-worker.js is the Worker source of truth (v1.4.8).
- Keep deliverables flat when making ZIPs: all files at ZIP root, no enclosing folder.
- Deploy helper (recreated 2026-09-30 after /tmp cleanup): `~/workspace/opal-reader-deploy/gh-push.py` — pushes via contents API with the body over HTTP (argv can't carry large files). Same verify-before-switch rule: confirm the versioned JS is live on Pages before repointing index.html.

## Per-paragraph pause fix (v1.4.23, 2026-09-30)
- Julie: most recent generated chapter paused after each paragraph; voice also changed drastically segment-to-segment.
- Root cause: `ee.onended` retried `playChapterComposite()` (a full worker round-trip to re-stitch all remaining segments) on EVERY segment boundary, with no try/catch. For a chapter whose composite fails (mixed MP3/WAV, missing R2 object, invalid WAV), each boundary sat through a failed stitch attempt = the pause, and the uncaught throw could kill playback instead of advancing (same bug family as the 9/28 `Me()` fix; the onended path was missed then).
- Fix: `ee._compositeFailed` session flag — `Me()` resets it at chapter start and sets it when the initial composite fails; `onended` skips the composite retry once it has failed and catches the throw, falling straight through to per-segment `Ot()`. One stitch attempt per chapter, then clean paragraph-to-paragraph play.
- Open: whether the drastic voice changes are the POV cast voices swapping per section (by design) or one voice varying between syntheses (Gemini variance). Asked Julie.

## Shorter segments (v1.4.24, 2026-09-30)
- Julie reported the voice drifts within a segment — turns breathier with more breath/mic noises as the segment plays, then resets clean at the next segment. Classic long-synthesis degradation.
- Her call, and she's right: segment target cut 4000 -> 1000 chars (`qt` default `4e3` -> `1e3`). Same total characters = same TTS cost; more segments per chapter (worker cap is 100 segments/chapter; provider per-request limits are 4000-8000 chars, so 1000 is safe everywhere). Splits still land on paragraph/sentence boundaries.
- Applies to newly imported books only — existing books keep the segments they were imported with. Told Julie she'd need to re-import a book to get the shorter segments.

## Silent disabled Generate button (v1.4.25, 2026-09-30)
- After re-importing for the shorter segments, Julie's Generate button did nothing with no error.
- Root cause: fresh imports build the cast with `voice:null` for every POV and `defaultVoice:null`, so `m=e.segments.some(S=>!st(S.pov))` is true and the button rendered `disabled` while still labeled "Generate" — a dead button with zero feedback. (My miss: I told her to re-import without warning her the cast resets.)
- Fix: the button is now only disabled while generation is actually working (`_`). With voices unassigned, tapping it surfaces the existing `qe()` alert ("Choose a voice for X first."), which names exactly what's missing.
- Julie's unblock: open the book → Cast tab → assign voices (Violet=Zephyr, Alex=Charon, etc.) → Generate lights up.

## Playback stall at segment boundaries (v1.4.26, 2026-09-30)
- Julie reported chapter 18 (re-imported, 27× 1000-char segments) stuck paused at 0:00 of segment 2 — "regressed to not playing the next chapter that's generated."
- Diagnosis: at every segment/chapter boundary the app calls `ee.play()` programmatically. iOS sometimes rejects that call; the old code set `_pendingPlay` and gave up with no retry — and that flag was write-only (never read). With 4–5× more boundaries per chapter after the 1000-char change, a previously rare stall became frequent, which is why it felt like a regression.
- Fix: new `retryPlay()` helper retries `play()` up to 4 more times (~0.9s apart) when rejected, used at both boundary play sites (segment `Ot` and chapter composite). A user-initiated pause (`ee._userPaused`, tracked in the #play handler) cancels retries so the app never restarts audio against her will.
- v1.4.26 did NOT fix Julie's chapter 18 stall (still stuck paused at 0:00, no alert) → not a transient rejection.

## Silent playback stall — damaged cached audio (v1.4.27, 2026-09-30)
- Revised diagnosis: the stall is deterministic. Tapping play produced no alert, meaning `ee.play()` never rejected — it never settled, which happens when the audio element is waiting on data that never arrives (damaged/empty cached blob). The app had NO `ee.onerror` handling and no blob validation, so any corrupt cache entry = permanent silent death at 0:00.
- Fix: `Bt()` now validates cached blobs (>1024 bytes); damaged entries are evicted from IDB and refetched from the network (fresh copy persisted). If the network copy is also bad → null → existing "missing or damaged" alert names the remedy. Added `ee.onerror` logging. The #play handler now races `ee.play()` against a 15s timeout so a stuck start surfaces an error message instead of sitting silently.
- v1.4.27 did NOT fix Julie's chapter 18 stall (still stuck paused at 0:00, no alert) → the stall is not in the direct-play path (fresh load goes through resumeCurrent, which the timeout doesn't wrap) and not a damaged segment blob.

## Playback diagnostic build (v1.4.28, 2026-09-30)
- After two theory-driven fixes failed, stopped guessing: v1.4.28 records a timestamped breadcrumb trail (`dl()`) of the tap→play chain (play handler, resumeCurrent, Me, composite fetch/load, Ot/Bt, retryPlay attempts, onloadedmetadata/onended/onerror, unhandled rejections) persisted to localStorage.
- Tapping the version number 5x within 2.5s shows the log in an alert (otherwise shows version as before).
- Also added real hang protection on the composite path: 45s fetch timeout → segment fallback; 15s loadedmetadata timeout / element error → `_compositeFailed`, revoke blob URL, fall back to `Ot` segments.
- Worker side verified clean: `pcmToWav` writes valid headers, `relay()` sets correct Content-Length, no mismatched-length hang source.
- `ee` is a detached `new Audio()` — app re-renders cannot disturb it. `#play` binding verified intact (Zr re-binds after every se() render).
- Earlier `ot(a.book...)` no-op suspicion was a misread of a stale grep — current onended handles segment boundaries correctly.
- v1.4.30: fixed a TDZ bug in the v1.4.28 diagnostic itself — `dl("Me("+e+") ir="+ir(ch))` referenced `ch` before its `const` declaration, throwing "Cannot access 'ch' before initialization" on every `Me()` call (this is the alert Julie screenshotted 2026-09-30). This means 1.4.28/1.4.29 never actually exercised the playback path — every tap died in `Me` before reaching the composite/fetch logic. After this fix the hang-protection + diagnostics run for real.
- **Chapter 18 root cause found + fixed 2026-09-30 (v1.4.32 + worker v1.4.9).** Julie's 1:38pm log screenshot showed the composite fetch starting at 17:37:27 and then 50s of silence — no success, no failure, timeout never fired (iOS suspends JS timers when the phone auto-locks, which is why even the 45s safety net never ran). Server-side: ch18 = 27 Gemini WAV segments ≈ 73MB total; the worker downloaded all 27 sequentially and materialized ~150-220MB in memory, over the 128MB free-plan limit — it hung and never responded. R2 `chapter-audio/` cache was completely empty: no composite had EVER succeeded. Fixes: (a) client skips the composite for chapters with >10 segments and plays segments directly (her normal listening mode all along); (b) worker now checks the composite cache FIRST, uses parallel HEADs, refuses cleanly with 413 over 64MB total (client falls back to segments), and parallelizes segment GETs. Awaiting Julie's retest on 1.4.32.
- Worker v1.4.9 deployed 2026-09-30 via deploy-worker.py (settings verified: compat 2026-08-29, bindings match).

## Library sorted by most recent (v1.4.22, 2026-09-30)
- Julie asked for the library grid sorted with the latest listened-to/imported book on top.
- `Rr()` now renders `[...a.books]` sorted desc by `lastPlayedAt || updatedAt || importedAt` (same precedence the existing Resume strip uses, plus `importedAt` so fresh imports rank). Sort is render-only; `a.books` order untouched.
- Frontend-only: app-158.js → app-159.js, index.html repointed (verified live before the switch, per the standing rule).

## Fix: deleted books resurrecting via sync (v1.4.20/v1.4.21, 2026-09-30)
- Root causes found: (1) `deleteBookFlow` fired the server DELETE inside `try{...}catch(_){}` — any network/worker failure was silent, so the server kept the book and the next sync re-downloaded it; (2) the sync push loop re-uploaded every local-only book with no notion of deletion, so a second device (iPad) resurrected books deleted on the first (iPhone).
- Worker v1.4.8: DELETE `/api/sync/book/:id` now writes a `deleted:<id>` tombstone `{id,title,deletedAt}`; PUT on a tombstoned id returns **409** `{deleted:true}`; GET `/api/sync/library` includes `deleted[]`; new `DELETE /api/sync/deleted/:id` clears a tombstone (explicit restore path only, never called by background sync). Verified 8/8 against the real worker module with a mock KV (PUT→DELETE→tombstone listed→stale PUT 409→clear→PUT accepted).
- Frontend v1.4.20 (app-157.js): delete verifies the server DELETE response; sync `rt()` drops local copies listed in `deleted[]` and never re-pushes tombstoned ids; `Ee()` treats 409 as "server says deleted" and purges the stale local copy; localStorage tombstone registry `opalreader.deletedBooks.v1` (pruned >180d at boot); restore-from-backup clears the tombstone first and marks `restoredAt` so the 409 path re-clears + re-pushes instead of deleting.
- Frontend v1.4.21 (app-158.js): offline deletes are no longer blocked — the book deletes locally, a tombstone is recorded, and the next sync propagates the DELETE to the server (merge loop issues server DELETE for any locally-tombstoned id found server-side instead of re-downloading it).
- Deploy notes: worker via `~/workspace/opal-reader-deploy/deploy-worker.py` (secret inherit). Frontend pushed via GitHub Data API (`/tmp/gh_push_file.py`); **verify the new app-NNN.js returns 200 with expected content on Pages BEFORE pointing index.html at it** (the app-156 404 lesson). sw-142.js unchanged — JS/navigations are network-first so the new bundle is picked up on reopen.
- Test UUIDs used in the mock-KV harness only; no production KV keys were touched.

## Fix: single-segment Regenerate was broken by undefined `it(s)` (v1.4.6, 2026-09-26)
- `regenerateOneSegment()` called `it(s)` — a function that was never defined anywhere in the bundle (latent bug in the original ChatGPT-built code, present since before v1.4.4). Every "Regenerate segment" tap threw `Can't find variable: it` before any request went out.
- Replaced with a real guard using the app's own provider map: `if(!a.providers[s.provider]) throw new Error("The "+s.provider+" provider is not configured. Add its key in Voice Lab first.")`.
- Frontend-only: app-141.js → app-142.js, sw-141.js → sw-142.js (cache opalreader-shell-v142). Worker stays v1.4.4.

## Review POV modal cleanup (v1.4.5, 2026-09-26)

## Speechify removed; provider order Gemini > Fish > Azure > OpenAI (v1.4.4, 2026-09-26)
- Speechify provider fully removed (frontend + worker) at Julie's request after she cancelled her subscription (generation issues + cost). Voice Lab tabs, settings model picker, provider status note, per-char pricing, voice mapping, worker synth branch, /api/providers/speechify/* endpoints all gone.
- Provider fallback/tab order is now Gemini → Fish Audio → Azure → OpenAI (Julie: azure ahead of openai).
- Frontend app-139.js → app-140.js, sw-139.js → sw-140.js (cache opalreader-shell-v140). Worker v1.4.2 → v1.4.4.
- SPEECHIFY_API_KEY secret left in place unused (same precedent as ELEVENLABS/GOOGLE_CLOUD_TTS keys); Julie can ask to delete it.

## Default provider: Gemini first (v1.4.3, 2026-09-26)
- Voice Lab provider-tab fallback chain now prefers Gemini: gemini → speechify → fish → openai → azure (was speechify first). Cast voice picker opens on the Gemini tab when Gemini is configured.
- Frontend-only change: app-139.js / sw-139.js (cache opalreader-shell-v139). Worker stays v1.4.2.

## Gemini style direction (v1.4.2, 2026-09-26)
- Cast view shows a "Style direction" text input under any POV (or Default Narrator) using a Gemini voice, e.g. "warm Southern drawl".
- Stored as `voice.style_direction` on the cast voice; persisted with the book.
- Threaded into every Gemini request: chapter generation, single-segment regen, book auditions, prosody auditions.
- Included in cache-key hashes, so changing the direction invalidates old audio and the "already uses the current cast" guard detects it.
- Worker prepends `Voice direction: <text>` to the Gemini prompt (300-char cap).

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

## v1.4.1: removed Kokoro, Chatterbox, ElevenLabs, Google Cloud TTS (2026-09-26)
- Removed four providers, leaving Azure Speech, Speechify, Fish Audio, OpenAI TTS, and Gemini TTS. Worker APP_VERSION and frontend APP_UI_VERSION bumped to 1.4.1.
- Kokoro/Chatterbox removed because self-hosting wasn't worth maintaining without an always-on machine.
- ElevenLabs removed because its free tier (~10 min/month) was too limited to be useful for audiobook generation; Julie also struggled to find a voice she liked that was actually usable on a free account.
- Google Cloud TTS removed in the same pass (Julie's call); Gemini (the separate AI Studio TTS provider) stays.
- Worker: removed the kokoro/chatterbox self-hosted voice lists and endpoints, elevenlabs/voices + /speech + /shared/add endpoints, google/voices + /speech endpoints, all four synthesis branches, provider-label branches, char-limit entries, status fields, and generation-job validation entries. Unknown providers now get a 400 "Unknown TTS provider" error instead of falling through to ElevenLabs.
- Frontend: removed the four Voice Lab tab buttons, display-name/pricing branches, elevenModel state/settings/cloud-sync/picker UI (Google had no model picker), the ElevenLabs shared-library tabs + shared-voice add flow (Rt/kt), the ElevenLabs free-preview path (wt/it/lr), age/use-case filters, and the google provider default (now "speechify", matching the fallback chain). Fallback chain is now speechify > fish > openai > gemini > azure.
- ELEVENLABS_API_KEY and GOOGLE_CLOUD_TTS_API_KEY Worker secrets left in place (harmless, unused); Julie can delete them herself later.
