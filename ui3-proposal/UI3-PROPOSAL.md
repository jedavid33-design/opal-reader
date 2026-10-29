# UI3 — Combined corrective proposal: W-4 byte-confirmation wiring + W-5 Settings quota-row fix

Drafted Oct 29, 2026, at Julie's direction ("Can we fold both into the same fix?" → "Draft the combined proposal"). For Rowan's review on issue #15. Base: the accepted live client, ui-pkg-2 @ `b83a6d99…` (app-265 / sw-ui2 / styles-152, build `d5b-v2-playback-client-13`).

## Scope — two items, one package

**Item A (W-5, CSS only).** In Settings, the Gemini quota row's bold value ("0/100 generation attempts today · $0.00 of $50 this month" — content verified exact) overlaps its label column, which wraps word-by-word down a narrow column ("Quota counter (kept from the accepted client)"). Fix in the W-2 family: at phone widths the row stacks — label on its own line, value full-width below; no overlap at 390 or 360. Content and data unchanged.

**Item B (W-4, behaviour — the substantive item).** The chapter status pill's "(x/y confirmed)" count requires a device-local byte-confirmation. Code-verified facts (client source, this draft read firsthand):

- `verifyBindingBytes(bookId, occurrenceId)` already exists in the client store (client-store-ui1.js:375), is exported, and is **idempotent and race-safe**: it returns early with no network call when a confirmation for the binding's current revision already exists locally; on success it records `state.bytes[cacheKey] = { bindingRevision }` inside a serialized mutation that re-verifies revision + cacheKey at record time. A binding revision change naturally stales old confirmations.
- It has **no call site** in the shipped client. (The transport's `byteCheck` is used exactly once elsewhere: the preflight C3 probe of the designated key, composition-ui1.js:900 — which also proves the server endpoint `GET /v2/sync/byte-check/<key>` exists, is authenticated, and needs **no worker change**.)
- `resolvePlayback` is deliberately pure ("Playback never writes records", client-store-ui1.js:484-492). This proposal does **not** change it.

## Item B design — confirmation on playback

1. **Hook placement:** in the composition/player wiring that starts a segment's audio after `resolvePlayback` returns ok — not inside the store. The wiring already knows `bookId` + `occurrenceId` at play time.
2. **Trigger:** once per segment play initiation, **only after actual successful start** — the media play() promise for that selection has resolved / the player has transitioned to "playing" (the player module already models this transition distinctly; refused or failed starts, e.g. a bad-offset refusal, never reach the hook and never record anything). Fire-and-forget: never awaited, never blocks or delays playback; any failure (offline, HTTP error) is swallowed and records nothing — playback is completely unaffected either way.
3. **Cost:** the store's early return makes repeat plays of an already-confirmed (segment, revision) cost **zero network requests** — one local state read. The only byte-check traffic ever generated is one small authenticated GET per not-yet-confirmed segment per binding revision per device, paced by actual listening. Worst realistic case: a full book (~500 segments) listened end-to-end = ~500 small GETs spread over days of listening. Workers free tier (100k requests/day) is nowhere near pressured. No burst mode exists in this design.
4. **Semantics preserved:** pill states and their wording are untouched; confirmations mean exactly what they meant in the migration-era checks. "Complete" becomes reachable on a device by listening through a chapter (or by preserved confirmations from prior verified checks, which remain valid). Synced-but-never-played chapters stay Uncertain/Partial — the honest meaning of "verified on this device."
5. **Offline:** if a segment plays from local cache while offline, no confirmation is attempted (the call fails silently); it confirms on a later online play. No queue, no retry machinery.
6. **Alternatives considered and declined:** check on chapter open (spends requests on audio that may never be played; verifies ahead of any listening); check during sync drain (~1,799-request burst per device verifying mostly-unplayed audio, and dilutes the counter's meaning). Playback pacing is the honest trigger.

## Identities and expected delta

This round **does** change behaviour, so the build marker advances (unlike ui-pkg-2): build `d5b-v2-playback-client-14`, packaging `ui-pkg-3`, entry `app-266.js`, SW `sw-ui3.js`, cache `opalreader-shell-ui3`, stylesheet `styles-153.css` (152 + the W-5 section). Expected delta vs `b83a6d99…`: index.html (pointers), app-266.js (new), sw-ui3.js (new), styles-153.css (new), the composition/player module successor carrying the hook (new), possibly the entry module successor if registration/wiring lives there. The store module is expected to be **reused unchanged** (the function and its export already exist) — if the build finds the hook needs a store change after all, that is a stop-and-report event, not a silent expansion. Frozen Shelf bridge byte-identical; rollback closures for ui-pkg-2 / ui-pkg-1 / CORR1 intact; `PURGE_ON_ACTIVATE == []`.

## Test plan (all on the exact final tree + package, logs pinned)

- Full existing batteries: unit, cast census, Chromium proof, phone-width proof — all must stay green.
- **New W-4 rows:** (T1) synthetic playback of an unconfirmed segment issues exactly one byte-check request and records the confirmation; the chapter pill math advances (fixture 0/27 → 1/27). (T2) replay of a confirmed segment issues zero byte-check requests. (T3) byte-check failure (HTTP 500 and network-down variants) leaves playback working and records nothing. (T4) Connect, sync drain, chapter open, and library render issue zero byte-check requests — traffic exists only on the playback trigger.
- **New W-5 rows:** phone-width proof asserts label/value bounding boxes are disjoint in the Settings quota row at 390 and 360, and the new assertion is shown to FAIL on the ui-pkg-2 tree.
- **Build-phase verification item:** demonstrate byte-check requests do not touch the generation quota/cap counters (they are a sync-family GET; the build must prove the counters don't move in the synthetic runs, not merely assert it).

## Gates (same pattern as UI1/UI2)

Proposal → Rowan review → Julie's build Go → local build + full battery → review artifact pinned → Rowan source review → Julie's packaging Go → publish (recheck, pinned delta, served-byte verification) → attended verification: on Julie's iPhone, play Forever Pucked Ch 1 Segment 2 and watch the pill advance 0/27 → 1/27; check the Settings quota row renders stacked and clean; iPad spot check → Julie's accept. Rollback available at every step, only on her direction.

## Out of scope

No worker/backend changes; no generation/D6 work (generation stays halted; byte-checks are not generation attempts); no Shelf changes (bridge frozen; A-1 stands); G-1 (book-wide style-note field) and G-2 (backup/restore implementation) remain separate future decisions. W-4's fix does not rewrite or discard any preserved confirmations.

## Questions for Rowan

1. Hook placement in the composition/player layer (store untouched) — agreed as the right layer?
2. Trigger on successful play initiation, fire-and-forget — agreed, vs on segment completion?
3. Identity/delta shape and the T1–T4 + W-5 test set — sufficient to prove both items?

## Amendment A-1 (Oct 29, 2026) — Rowan's conditional design support, conditions addressed

Rowan's review (board comment 6498331194): **CONDITIONAL DESIGN SUPPORT** with six conditions. The full proposal + pinned source/line references are published with this amendment (review repo, folder `ui3-proposal/`: proposal, SOURCE-REFERENCES.md, and byte-identical copies of client-store-ui1.js and http-transport.js from the live publish tree) so every code claim below is independently inspectable.

1. **Layer (agreed, hard condition).** Hook in the composition/player wiring; `resolvePlayback` stays pure; the store API is unchanged and the store module is reused byte-identical. If the build finds a store change is necessary, it stops and returns for review — no silent expansion.
2. **Successful-start trigger (adopted).** The hook fires only after the media play() promise resolves for that selection (see Item B point 2, amended). A failed or refused start issues no call and records nothing. New test **T5 (failed start)**: play() rejection/refusal → zero byte-check requests, nothing recorded, player state not "playing".
3. **In-flight single-flight guard (adopted — the substantive condition).** Rowan is correct that the persisted per-revision guard alone cannot prevent duplicate GETs when two initiations race before the first GET settles. The hook therefore keeps an in-flight map keyed by binding identity (`bookId : occurrenceId : bindingRevision` — or cacheKey where revision is not at hand; the build pins the exact key from the data present at the hook, the invariant is what is specified here): the first initiation for a key calls `verifyBindingBytes` once and stores its promise; any concurrent initiation for the same key skips (the in-flight call records the result); the entry is deleted when the promise settles. Combined with the store's persisted early return, the accurate bound is: **at most one byte-check GET per (segment, binding revision) per device, ever** — concurrent starts collapse to one, later starts read local state. Independent devices hold independent state, so each device may check once; network-side worst case is bounded by devices × segments × revisions, paced by real listening. New test **T6 (concurrency)**: two play initiations for the same binding issued before the stubbed byte-check resolves produce exactly **1** GET and 1 recorded confirmation; a third initiation after settle still totals 1 GET.
4. **No quota/billing/cap contact; failure discipline (adopted).** byteCheck is a sync-family GET (`/v2/sync/byte-check/<key>`, http-transport.js:65-68) returning `{exists}`; the generation quota lives behind `/v2/quota` and generation commands. The build-phase proof stands: synthetic runs must show the quota/cap counters unmoved. The hook makes **one attempt per initiation, no retries anywhere**; failures are swallowed by the hook and, inside the store, a falsy byte-check records nothing (verified in source) — no confirmation corruption, no playback blocking, no retry loops.
5. **W-5 tests (adopted as specified).** Regression assertions at 360px and 390px; the old package must be shown FAILING and the new package PASSING; CSS stays scoped to the corrective section.
6. **Publish-review preconditions (adopted).** Before any publish review: T1–T6 complete on the exact tree + package, full batteries, exact manifest diff, bridge hash equality, SW purge `[]`, rollback proof, served-byte verification.

**Delta note (preservation constraint added):** `modules/player.js` is a SHARED module referenced by the CORR1 and UI1 service-worker shells — it is never edited in place. If the hook needs player-layer code, it ships as a versioned successor (e.g. player-ui3.js) with importer pointers updated, per the established pattern; the same applies to any shared module. The expected delta grows by at most that successor + its importer's successor; the build pins the exact set and stops-and-reports if it exceeds the shape described here.
