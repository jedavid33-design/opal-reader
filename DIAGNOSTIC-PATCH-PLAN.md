# Sync diagnostic patch — prepared, awaiting approval (2026-10-19)

Prepared by Wren in a clean clone of `jedavid33-design/opal-reader` main @ 6d70ca6.
**Not committed, not pushed, not deployed.** Book data, audio, jobs, and sessions untouched.
Transient KV failure remains a *hypothesis*, not a confirmed root cause — this patch exists to capture the actual exception on the next controlled sync.

## The change set (complete diff is 5 files)

1. **`cloudflare-worker.js`** (+33 lines, nothing else)
   - New `logSyncFailure(request, url, error)` helper: one `console.error` JSON line with `event: "opalreader_sync_failure"`, method, path, book ID (parsed from the path), error name, error message (≤500 chars), error stack (≤2000 chars).
   - One added line in the fetch handler's outer catch: log only when the path starts with `/api/sync/`.
   - Never logs book contents, request bodies, access tokens, or credentials (enforced by a test asserting the log line contains neither the sample book's title/text nor the token).
   - Wrapped in try/catch so diagnostics can never alter the error response; the 502 response body is byte-for-byte the pre-patch behavior (also test-asserted).
2. **`app-255.js`** (new file; `app-254.js` copied with exactly 2 edits) + **`index.html`** (script tag → `./app-255.js?v=sync-diagnostics-20261019`)
   - New `syncServerMessage(err)` helper: returns the server's own error message, whitespace-collapsed and capped at 240 chars; returns "" for the fetch layer's "Request failed (N)" placeholder (no server body).
   - The sync error formatter's 5xx branch now shows `HTTP <status>: <server message>` and falls back to the previous generic gloss only when the server sent no message. Other branches (401/403/413/429/TypeError/etc.) unchanged.
3. **`tests/sync-diagnostics.test.mjs`** (new) — 6 tests, all passing:
   failed PUT logged with endpoint/bookId/error detail and no sensitive content; failed GET logged the same; successful PUT logs nothing and the stored record + compact index are exactly as before (generation state, session, audio keys preserved); auth rejections and non-sync failures log nothing; Reader helper behavior (preserve/placeholder/collapse/cap/fallback); release constants intact.
4. **`tests/continue-preparation-progress.test.mjs`** — one line: the index.html cache-bust expectation updated to app-255.

## Compatibility

- `APP_VERSION` "1.4.42", `READER_GENERATION_UI_VERSION` "1.4.116", `GENERATION_RELEASE_ID` — untouched in both Worker and Reader. Generation jobs/sessions validate exactly as today.
- No behavioral change to sync: same requests, same responses, same KV writes; the Worker only *observes* failures on sync routes, the Reader only changes what the error display says.

## Test results

- Patched tree: **117 tests, 108 pass, 9 fail**.
- Unmodified main (baseline, run the same way): **111 tests, 102 pass, 9 fail** — the *identical* 9 failures pre-exist on main (generation/quota suites, plus two stale suite files: `composite-cache-isolation` reads the app filename from index.html with a regex that predates the `?v=` cache-bust convention, and `split-first-update-stop` fails to load with a SyntaxError). **Zero regressions introduced; the +6 passing tests are the new diagnostics suite.** All sync suites (sync-manifest, generation-session-sync-guard, continue-*) pass.

## Deployment plan (executes only on approval)

1. **Pre-deploy gate:** verify zero active generation jobs (scan `generation:*` in KV) and no device mid-generation, so nothing in flight can be interrupted. The patch doesn't touch generation code or the release ID, and the queue consumer is the same script — this is a belt-and-braces check, per Rowan's deployment requirement.
2. **Rowan commits** the change set to main (Pages auto-deploys the Reader side: app-255 + index.html).
3. **Wren deploys the Worker** from the exact committed `cloudflare-worker.js` using the standard deploy script: compatibility date preserved (2026-08-29), secrets inherited, all 12 bindings verified by live read afterwards, `/health` + script etag checked. (Order between 2 and 3 is safety-neutral — each side works with the old counterpart — but Worker-first means even a sync attempted before Pages propagates is captured.)
4. **One controlled sync** from the iPad with the Workers Logs dashboard open. Read the `opalreader_sync_failure` line (the Reader's Sync Details will also show the real message). That names the failing operation and exception.
5. **Then** a targeted fix proposal based on the captured exception — no speculative KV retries or storage changes in this patch or before that evidence exists.
6. **Rollback if needed:** Worker — redeploy the previous file snapshot; Reader — point index.html back to app-254.js (retained in the repo).

Finding Home recovery remains parked; the iPhone's Reader stays closed until sync is fixed.
