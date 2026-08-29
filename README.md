# OpalReader V1

A personal, installable EPUB audiobook reader with per-POV ElevenLabs casting.

## What V1 includes

- Local EPUB import and parsing (metadata, cover, spine chapters, headings and text)
- Conservative all-caps POV detection suitable for `CHAPTER 18 / TUCKER`
- Manual POV creation, renaming and chapter reassignment
- Default narrator plus per-POV casting
- Search of account voices and the broader shared Voice Library
- Book-excerpt voice previews
- Chapter-at-a-time narration and IndexedDB audio caching
- Cached-audio stale markers after casting changes
- Persistent library, casting, chapter progress and playback position
- Mobile PWA shell and touch-friendly player
- A separate Cloudflare Worker so the ElevenLabs key never reaches browser code

## Deploy the Worker

1. In `worker`, run `npm install`.
2. Run `npx wrangler login` once if needed.
3. Store the key securely: `npx wrangler secret put ELEVENLABS_API_KEY`.
4. Create a long private token of your choice and store it with `npx wrangler secret put OPALREADER_ACCESS_TOKEN`. This prevents strangers who discover the Worker URL from consuming your credits.
5. Set `ALLOWED_ORIGIN` in `wrangler.toml` to the exact GitHub Pages origin (for example `https://jedavid33.github.io`). During local development it is already `http://localhost:5173`.
6. Run `npm run deploy` and copy the resulting Worker URL. Enter that URL and your private OpalReader token—not the ElevenLabs key—on the app's Setup screen.

## Run and publish the app

1. In the project root, run `npm install` then `npm run dev`.
2. Open **Setup** in OpalReader and save the deployed Worker URL.
3. For GitHub Pages, set the repository's Pages workflow to run `npm ci && npm run build` and publish `dist`. Vite uses relative PWA assets; set the repository path as `base` in `vite.config.js` if the site is not hosted at the domain root.

Never add the ElevenLabs API key to this repository, `.env` files committed to Git, or the browser setup screen.

## Storage note

V1 keeps books and generated MP3 data in browser IndexedDB. It survives ordinary closing and reopening on the same browser/device, but it is not cross-device sync and mobile browsers may reclaim site data under storage pressure. R2/D1-backed durable storage is intentionally deferred.
