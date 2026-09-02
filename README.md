# OpalReader v1.1.1

A personal, installable EPUB audiobook reader with provider-neutral, per-POV casting and optional cross-device storage.

## What this release includes

- Existing EPUB parsing, chapter and mid-chapter POV review, manual corrections, cast management, budgeting, generation, playback, and mobile PWA behavior
- ElevenLabs voice browsing and generation without requiring Google Cloud TTS
- Google Cloud TTS remains optional
- Azure Speech neural voice listing, book-text auditions, cast assignment, chapter generation, and R2 audio reuse
- Google Cloud TTS voice listing, book-text auditions, and pricing for Standard, WaveNet, Neural2/Polyglot, Studio, and Chirp 3 HD
- Bare Gemini-TTS catalog entries are excluded until a separate model-aware synthesis path is implemented
- Provider errors are normalized into readable messages instead of object placeholders
- Cloudflare KV sync for library data, parsed chapters, cast, voice assignments, playback position, progress, and shared settings
- Private Cloudflare R2 storage for imported EPUBs and generated audio
- R2-backed audio reuse across devices before any provider generation call
- Separate free provider samples and book-text auditions; book auditions are generated once and cached in R2
- Structured ElevenLabs gender, age, locale/accent, and use-case casting filters with paginated results
- Browser IndexedDB remains the fast offline/local cache

## Update the existing Worker

Replace the Worker editor contents with `worker/src/index.js` (or the flat package's `cloudflare-worker.js`) and deploy it. Keep the existing secrets and `ALLOWED_ORIGIN`.

Add these Worker bindings:

| Binding variable     | Cloudflare resource                                    |
| -------------------- | ------------------------------------------------------ |
| `OPALREADER_KV`      | KV namespace, suggested name `opalreader-sync`         |
| `OPALREADER_STORAGE` | Private R2 bucket, suggested name `opalreader-storage` |

Provider keys stay exclusively in Worker secrets:

- `ELEVENLABS_API_KEY` — optional provider secret; sufficient by itself for ElevenLabs
- `GOOGLE_CLOUD_TTS_API_KEY` — optional provider secret
- `AZURE_SPEECH_KEY` — optional Azure Speech resource key
- `AZURE_SPEECH_REGION` — required with the Azure key, such as `eastus`
- `OPALREADER_ACCESS_TOKEN` — required private access secret

Never commit provider keys to GitHub or enter them into the browser app.

## Update GitHub Pages

The Chromebook-friendly flat ZIP contains loose files. Upload all files to the existing repository and replace matching files. GitHub Pages remains configured as `main` and `/(root)`.

The PWA cache changes to `opalreader-shell-v14`, forcing browsers to fetch the Azure-enabled client.

## Cross-device behavior

Enter the same Worker URL and OpalReader access token once on each device. The app syncs on startup, when **Sync now** is pressed, and periodically after book/progress changes. EPUB bytes are uploaded to R2 at import. Parsed book state lives in KV, so another device restores the library and can play cached R2 audio without re-importing the EPUB.

Audio cache keys include narration text, provider, voice, model, and generation settings. The Worker checks R2 immediately before provider generation, preventing duplicate provider charges even when the browser cache is empty.

## Cost note

Displayed estimates are planning estimates before allowances, taxes, and pricing changes. OpalReader does not add locally tracked spend when audio was found in the shared R2 cache.

Azure standard, multilingual, and Neural HD Flash voices use a $15/M planning rate. Neural HD voices use a conservative $30/M planning rate and remain visually distinct. Confirm the applicable Azure regional price before generating a full book.
