# UI3 Candidate Build Report — Opal Reader v2: W-4 byte-confirmation wiring + W-5 Settings quota-row fix (LOCAL BUILD ONLY)

Built under Julie's recorded LOCAL-BUILD Go (board issue #15, comment 6498473594),
to the authoritative spec `ui-design/UI3-PROPOSAL.md` **including Amendment A-1**
(Rowan's six conditions from her conditional design support, comment 6498331194,
all adopted). Nothing here is published, pushed to the opal-reader repo's main,
or posted to the board; the candidate is local, packaged, and pinned for review.
No live/backend traffic of any kind was made: every battery runs against
loopback stub coordinators.

## Candidate identity

| | |
|---|---|
| Entry | `app-266.js` |
| Service worker | `sw-ui3.js` |
| Cache | `opalreader-shell-ui3` |
| Stylesheet | `styles-153.css` |
| Build marker | `d5b-v2-playback-client-14` (**advanced** — behaviour changed this round, per the proposal's identities section; carried by `modules/constants-ui3.js`, so Diagnostics and the startup notice report it truthfully) |
| Packaging marker | `ui-pkg-3` |
| Base | published UI2 tree (ui-pkg-2), live commit `b83a6d99b8e3428b462fd328a65cfeab484761ab` (the `base/` tree here is `ui2-fix-build/package/publish`, byte-identical to that commit; its 56 files match the ui-pkg-2 PACKAGE-MANIFEST on record) |
| Publish tree | 63 paths (56 base + 7 new), publish digest `86719a0f3b7f84b74aa9aaee65f477cf503ec8b6c7e15ae0efd8241f79622dc1` (SHA-256 of the sorted `path sha256` lines of `package/PACKAGE-MANIFEST.json`; supersedes the originally pinned digest — see Correction C-1) |
| Delta | exactly 8 paths (below) |

## Item B — W-4: byte-confirmation on playback (the substantive item)

### Where the hook lives, and the exact trigger signal

The hook lives in **`modules/composition-ui3.js`** (successor to
composition-ui1.js), in the composition's own player wiring — **not** in the
store and **not** in player.js. Two parts:

1. A per-candidate helper, `confirmBytesOnPlaying(tok)` (defined in the
   `createCandidate` closure, next to `createPlayback`), which calls
   `client.store.verifyBindingBytes(tok.bookId, tok.occurrenceId)`
   fire-and-forget.
2. One added call at the head of the `playing` branch of the
   `onPlayingChange` callback the composition passes to `createPlayer`.

**Trigger signal, exactly:** `onPlayingChange(tok, true)`. Reading player.js
(unchanged, shared): that callback fires with `playing === true` from exactly
two places — (a) the end of `play()`, after the media element's `play()`
promise has resolved, after the post-settle admission re-check, with
`state === "playing"` and the selection token still current; and (b)
`onResumeAfterWait()`, when playback resumes after a waiting/stalled dip (a
genuine return to playing for the same selection; dedup makes it a no-op in
the normal case). A **failed or refused start can never reach it**: a
`play()` rejection lands in the catch branch (state back to "paused", no
callback), a restore-offset refusal returns before the media is touched, an
admission refusal returns before the media is touched, and a stale selection
returns without firing. Rowan's condition 2 (successful start only) is
therefore met by construction, and T5 proves it against a real rejection.

### Fire-and-forget discipline

The hook is never awaited in any playback path. `verifyBindingBytes` is
invoked inside a `try` (a synchronous refusal is swallowed identically), its
promise is held only by the flight map (below), and rejection settles the map
entry and nothing else: failures record nothing (the store writes a
confirmation only after a truthy byte-check — its accepted code), block
nothing, and are **never retried automatically** — one attempt per play
initiation; a failed check may be attempted again only by a later
successful play initiation (see the bound statement below, as corrected
by Correction C-1).
If the byte-check succeeds, the store's own serialized, re-checking mutation
records `state.bytes[cacheKey] = { bindingRevision }` (unchanged accepted
machinery).

### Single-flight guard (Amendment A-1 condition 3)

The helper keeps `byteConfirmFlights: Map<flightKey, Promise>`. First
initiation for a key invokes `verifyBindingBytes` once and stores its
promise; any concurrent initiation for the same key while the entry exists
**skips** (no second invocation); the entry is deleted when the promise
settles (fulfil or reject).

**Flight key: `${bookId}:${occurrenceId}:${cacheKey}`** — cacheKey, not
revision, because that is what the data at the hook supports: the player
token carries the selection's `cacheKey` (the shell's `bindingFor` supplies
`cacheKey/format/sizeBytes`; **no binding revision ever reaches the token**).
A re-bind to a different audio object changes the cacheKey, so a stale
in-flight entry can never suppress the check a new binding needs; the store's
record-time re-verification (revision + key compared inside its serialized
mutation) remains the authority on what gets recorded.

**Per-device bound, stated accurately (condition 3; wording corrected by
Correction C-1):** with the flight map plus the store's persisted
per-revision early return, one device has **at most one concurrent
app-initiated verification per (segment, binding object)**; once a check
succeeds and the confirmation persists, all later starts for that binding
read it locally at zero network cost. A **failed** check records nothing
and may be attempted again on a later successful start. Browser/
network-layer retransmissions (e.g. Chromium re-issuing a connection-reset
GET below the app layer) sit outside this bound — the app issues one fetch
per initiation and contains no retry logic. Independent devices hold
independent state, so each device may check once; successful-check traffic
is bounded by devices × segments × binding objects, paced by real
listening. No burst mode exists. T6 proves the concurrency bound
end-to-end in the browser (below).

### Preservation (Amendment A-1 condition 1 — hard)

- **The store module is reused byte-identical.** `client-store-ui1.js` keeps
  its accepted name and bytes (SHA-256
  `778d4c3367b5f9b65b738ab48ac8c9cfcfce4bb514acb927defc1df0c013e3ad`,
  asserted by the package checks). `verifyBindingBytes` needed no changes:
  it already existed, exported, idempotent and race-safe — it simply had no
  call site.
- **`resolvePlayback` stays pure** (it lives in the untouched store).
- **Shared modules are never edited in place**: `player.js`, `screens.js`,
  `audio-transport.js` and the rest are byte-identical to base. Everything
  UI3 changes ships under a new versioned name, so the ui-pkg-2 / ui-pkg-1 /
  CORR1 rollback closures keep resolving byte-identical files (asserted:
  the three rollback SW SHELLs resolve fully in the new tree, and the
  rollback entries' import closures contain no ui3 paths).

## Item A — W-5: Settings quota row (CSS only)

`styles-153.css` is `styles-152.css` byte-identical plus ONE appended section
(diff: a single hunk, `444a445,462` — pure addition, no existing rule edited),
in the UI2 corrective discipline. At `≤600px`, rows carrying a `.ui-val`
(scoped with `.ui-srow:has(> .ui-val)`, so the Backup/Reconnect button rows
are untouched) wrap: the label takes its own full-width line, the value sits
full-width below it, left-aligned, wrapping at spaces. Wider viewports keep
the accepted side-by-side arrangement.

**The defect, measured on the published tree** (phone-width proof fixtures,
Julie's exact quota text now served by a stub `/v2/quota` route — see
harness notes): at both 390 and 360 the label column is **crushed to width
0** (left == right == 29.8) and its text wraps word-by-word down a 192px-tall
column whose span paints 51.5px wide — overflowing its own box — while the
bold value (320px wide, top 358.6) sits **inside** the label's vertical span
(281.6..473.6). The label's painted text crosses the value's box by
**1,562 px²** — the overlap Julie photographed. On the candidate at 390: the
label is a 330.4×41 box on its own line, the value a 330.4×38 box directly
below it (top 362.3 > label bottom 352), text/value paint overlap **0**.

## Delta — exactly 8 paths vs the published ui-pkg-2 tree

| Path | Kind | SHA-256 (head) | Justification |
|---|---|---|---|
| `index.html` | modified | `a3bf01936147` | Exactly 3 line diffs: `app-266.js?v=ui-pkg-3`, `styles-153.css?v=ui-pkg-3`, and the startup notice advancing to "(build d5b-v2-playback-client-14)" (the C-1 line: the notice carries the build marker, and the build moved). |
| `app-266.js` | new | `7709738b69c0` | `app-265.js` with ONLY: the UI3 header/lineage note, the identity block, `PACKAGING_MARKER "ui-pkg-3"`, `register("./sw-ui3.js")`, and its two module pointers moved to entry-ui3 / constants-ui3. |
| `sw-ui3.js` | new | `424cd8a81ea0` | `sw-ui2.js` with only: cache `opalreader-shell-ui3`, SHELL naming the ui3 closure (app-266, styles-153, composition/constants/entry/runnable-ui3 in place of the ui2/ui1 counterparts), header/purge comments. `PURGE_ON_ACTIVATE` stays `[]`; fetch/activate logic byte-identical. |
| `styles-153.css` | new | `f063b246c040` | `styles-152.css` + the one appended W-5 section (above). |
| `modules/composition-ui3.js` | new | `a1d81ff73963` | `composition-ui1.js` + the W-4 hook (header note, the `confirmBytesOnPlaying` helper + flight map, one call in `onPlayingChange`) + the constants-ui3 import pointer. Everything else byte-identical. **This is the only behaviour change in the package.** |
| `modules/constants-ui3.js` | new | `48adbcbfb8603e` | `constants-ui1.js` with only its identity constants advanced: build marker -14, bundle app-266.js, styles styles-153.css, cache opalreader-shell-ui3. Required: the build marker lives here (composition and the shell both read it for Diagnostics); a ui-pkg-3 package whose constants still said -13/ui1 would be lying in its own diagnostics. |
| `modules/entry-ui3.js` | new | `c9e522b647df` | `entry-ui1.js` with only its 3 re-export pointers moved (composition-ui3, runnable-ui3, constants-ui3). |
| `modules/runnable-ui3.js` | new | `d271b4d3df39` | `runnable-ui1.js` with only its createCandidate import moved to composition-ui3. |

The set stays inside the proposal's expected shape
({index, app-266, sw-ui3, styles-153, composition successor, entry/runnable
successors}) plus `constants-ui3.js`, justified above (the build marker's
home; UI1 made the identical move from constants-corr1). **No
player-successor was needed**: the player's existing `onPlayingChange`
contract already exposes the successful-start signal at the composition
layer, so player.js is untouched. Rollback basis: commit `b83a6d99…` stays
the parent; `app-265.js` / `sw-ui2.js` / `styles-152.css` / cache
`opalreader-shell-ui2` (and the ui-pkg-1 and CORR1 lines beneath them) are
preserved byte-identical inside the publish tree.

## Battery results — one complete run each on the exact final trees, logs preserved

| Battery | Tree | Result | Log |
|---|---|---|---|
| Unit battery (UI1 suite, 13 tests) | tree-a | **13/13 PASS** (exit 0) | `tests/unit-results.txt` |
| Unit battery | package/publish | **13/13 PASS** (exit 0) | `tests/unit-results-package.txt` |
| Cast census | source records | **PASS** (exit 0) — read from `src/app-266.js`; mappings table carried verbatim | `tests/cast-census-results.txt` |
| Chromium proof (C0–C9, V1–V4) | tree-a | **14/14 PASS** (exit 0) — C0 is now the published UI2 shell, C1 the upgrade to sw-ui3 with the ui2 cache preserved, C5 the rollback to UI2 with the ui3 cache preserved inert | `tests/chromium-results-tree-a.txt` |
| Chromium proof | package/publish | **14/14 PASS** (exit 0) | `tests/chromium-results-package.txt` |
| Phone-width proof (UI2 rows + Q1/Q2) | tree-a | **11/11 PASS** (exit 0) | `tests/phone-results-tree-a.txt` |
| Phone-width proof | package/publish | **11/11 PASS** (exit 0) | `tests/phone-results-package.txt` |
| Phone-width proof | **base (published ui-pkg-2)** | **9/11 PASS (exit 1) — expected**: the 9 UI2 rows pass (ui-pkg-2 fixed W-1/W-2/W-3); only Q1/Q2 fail — the W-5 reproduction evidence | `tests/phone-results-base.txt` |
| **W-4 proof (T1–T6 + TQ)** | tree-a | **7/7 PASS** (exit 0) | `tests/w4-results-tree-a.txt` |
| **W-4 proof (T1–T6 + TQ)** | package/publish | **7/7 PASS** (exit 0) | `tests/w4-results-package.txt` |
| Package static checks | package | **ALL CHECKS PASS** (exit 0): base 56, publish 63, delta exactly the 8 declared paths, index diff exactly 3 lines, sw-ui3 SHELL == 30-entry packaged closure, purge `[]`, sw-ui2/sw-ui1/sw-corr1 SHELLs resolvable, app-266 closure routes ui3 (no ui1 composition/constants/entry/runnable) and reuses the ui1 store/client set, rollback closures clean, **store SHA-256 pinned byte-identical**, bridge hash pinned, markers correct | `package/assemble-results.txt` |

Exit codes for every run: `tests/run-exit-codes.json` (also pinned in the artifact).

### The W-4 rows, and what each proved (stub byte-check counts requests per key at the transport boundary)

- **T4 (no-play browsing)**: after Connect, the ONLY byte-check issued is the
  preflight's designated C3 probe (1 GET for the probe key — pre-existing
  accepted behaviour, disclosed here because a naive reading of "zero
  byte-checks on Connect" would miscount it). Library render, book open,
  chapter expands, a Settings visit: the per-key counts do not move at all,
  and the device state holds zero confirmations.
- **T1**: playing segment a2 fires exactly **1** GET for its key; the
  confirmation is recorded (`{bindingRevision: 1}`); re-rendering the book
  shows the ch.1 pill advanced to "Uncertain — audio not verified on this
  device (**1/3 confirmed**)" from 0/3.
- **T2**: pause → play on the confirmed a2: **0** additional GETs (persisted
  early return).
- **T3 (failures)**: with the byte-check answering **HTTP 500**, playback
  still reaches "playing", nothing is recorded, and a second initiation
  brings the total to exactly 2 — one attempt per initiation, no retry
  burst. With the byte-check connection **aborted** (socket destroyed),
  playback succeeds and nothing is recorded. No unhandled rejection surfaces
  anywhere in the run (0 page exceptions). One precision, evidenced in the
  log: for the abort key the **app made exactly 1 fetch() call** (counted by
  an in-page wrapper installed before any page script) while the **server
  saw 3 requests** — Chromium's network stack transparently retries a
  connection-reset GET below the app layer. That retry is a property of the
  browser's network stack for ANY idempotent GET (the accepted client's own
  sync GETs behave identically); the client itself made one attempt,
  awaited nothing, and recorded nothing.
- **T5 (failed start)**: a segment whose fetched bytes are exactly the
  expected size but undecodable makes the media `play()` reject (player
  settles to "error", never "playing"): **0** byte-check GETs, nothing
  recorded.
- **T6 (concurrency / the bound)**: with the byte-check response for c1's
  key **held** (deferred), a play initiation fires 1 GET; a pause → play
  initiation while it is still in flight fires **no second GET** (the
  single-flight skip); on release, the one check records the confirmation;
  a third initiation after settle still totals **1 GET** (persisted early
  return). Bound proven as stated above (as corrected by Correction C-1):
  at most one concurrent app-initiated verification per (segment, binding
  object) per device, with the persisted confirmation suppressing all later
  app requests for that binding.
- **TQ (quota immobility, condition 4/6)**: the device state's money view
  (`attemptsToday 0, spentMicroCents 0, monthlyCap 50`) is byte-identical
  before and after the entire W-4 run, and the stub logged **zero**
  `POST /v2/commands` — byte-check traffic never touches the generation
  quota, the monthly cap, or any billing counter. (Byte-check is a
  sync-family GET; the only `/v2/quota` traffic in the run is the Settings
  render's own read.)

### Regression rows added (phone-width proof)

- **Q1/Q2** (W-5 @390/@360): the Settings quota row's label and value boxes
  are disjoint, the label's *painted text* does not cross the value's box,
  the label column is not crushed (≥100px), the value is stacked full-width
  below the label and inside the viewport — with Julie's exact quota text,
  which required one harness addition (below). On the published tree both
  rows FAIL on the paint-overlap assertion (1,562 px²) — the reproduction.
  All nine UI2 rows (P/S/V/H/T) stay green on the candidate, and the tablet
  row re-verified @768 (the stacking is phone-only; desktop/tablet keep the
  side-by-side row).

## Harness honesty notes

- **WebGL policy switches (environment adaptation, all three browser
  proofs).** This VM's Chromium build refuses to start without the
  image-owned WebGL domain-policy switches (normally supplied by the
  browser daemon): `--hatch-webgl-allowed-domains-file` +
  `--hatch-webgl-allowed-domains-sha256`, computed in-process from the
  image's own policy file. The UI1/UI2-era harnesses did not need them in
  their environment; the switch changes no test semantics — it only lets
  the browser start. Recorded here because it is a real delta from the
  inherited harnesses.
- **`/v2/quota` stub route (phone-width proof).** The UI2 stub had no
  `/v2/quota` route, so its Settings row rendered the "Quota unavailable"
  fallback text, not Julie's. The UI3 phone proof adds the route (fixed
  zero view) so Q1/Q2 measure the row with the exact production text
  "0/100 generation attempts today · $0.00 of $50 this month". The route
  also feeds the W-4 proof's TQ counters.
- **First W-4 run's T3 failure — a harness/instrumentation finding, kept in
  the record.** The first full W-4 run failed T3 with "abort-key GETs: 3
  (expected 1)" counted at the SERVER. Rather than assume an app defect,
  the proof was instrumented at the app layer (a fetch wrapper installed
  via `Page.addScriptToEvaluateOnNewDocument`, counting byte-check
  `fetch()` calls): app layer 1, server side 3 — Chromium's transparent
  network-stack retry of a connection-reset GET, as reported in T3 above.
  The final battery's logs are from the instrumented harness; the
  assertion of record for the abort variant is the app-layer count (the
  client's behaviour), with the server count printed as evidence. (An
  intermediate instrumented run also failed at Connect because the first
  wrapper used a regex whose escapes collapsed inside the harness's
  template literal — a harness bug, fixed by switching the matcher to
  plain string search; no candidate code was involved. The two aborted
  runs are not among the preserved logs; the preserved logs are the final,
  clean, complete runs only.)
- **Chromium-proof adaptations were mechanical** (placeholder identity
  swaps: baseline generation ui1→ui2, candidate ui2→ui3, markers -14 only
  in the candidate assertions C1/C4) plus the WebGL switches. Two stranded
  adaptation scripts were discarded along the way; the shipped
  `tests/chromium-proof.mjs` was verified assertion-by-assertion against
  the UI2 original (the only remaining `-13` assertions are the baseline
  rows C0/C5, which is correct).
- The browser proofs measure the app in headless Chromium with the
  sandbox's fallback fonts (external webfonts are blocked by the harness's
  fetch interception), as in UI1/UI2. The W-5 geometry defect reproduced
  regardless (the row's failure is structural — a crushed label column —
  not font-dependent), and the fix's stacking is likewise structural.

## Deliverables in this directory

- `src/` — the 8 delta sources (index as `index-ui3.html` → `index.html`).
- `base/` — the published UI2 tree (56 paths, hash-verified against the
  ui-pkg-2 PACKAGE-MANIFEST); also the "old tree" the Q-rows fail against.
- `tree-a/`, `tree-b/` — assembled candidate trees (verified byte-identical
  to each other); `assemble.py` rebuilds them; `make-src.py` regenerates
  `src/` from `base/` by anchored replacements (each anchor asserted to
  occur exactly once).
- `package/` — `publish/` (63 paths), `delta/` (8 paths),
  `PACKAGE-MANIFEST.json` (per-file SHA-256), `assemble-results.txt`;
  `package-assemble.py` rebuilds it.
- `tests/` — all test sources and preserved logs, incl. `run-exit-codes.json`
  and the new `w4-proof.mjs`.
- `review-artifact/` — the snapshot for Rowan
  (`snapshot-review-artifact.py`): BUILD-REPORT, PACKAGE-MANIFEST,
  base-index, `delta/` (8 files), `tests/` (6 sources), `logs/` (12
  preserved logs), `MANIFEST.json` (candidate identity, battery tails,
  exit codes, per-file digests, and the FULL publish-tree file map +
  digest).

Not done, by scope: no publish, no push to main, no board post. Packaging
and publish remain Julie's separate gates, after Rowan's source review.

## Correction C-1 (Oct 29, 2026) — comment-only bound correction in composition-ui3.js

Applied under the existing LOCAL-BUILD Go, after Rowan's source review
PASSED the candidate (board issue #15, comment 6499149890) subject to one
documentation correction: the design comment above `byteConfirmFlights`
in `modules/composition-ui3.js` (originally lines 1019–1023) claimed "at
most ONE byte-check GET per (segment, binding object) per device, ever" —
an overclaim, because a failed check records nothing and may be attempted
again on a later successful start, and browser/network-layer
retransmissions sit outside the app's bound. The comment now states
Rowan's corrected semantics verbatim in substance: at most one
CONCURRENT app-initiated verification per key; a persisted successful
confirmation suppresses all later app requests for that binding on this
device; a FAILED check records nothing and may be attempted again on a
later successful start; browser/network-layer retransmissions (e.g. a
connection-reset GET re-issued below the app layer) are outside the
bound — the app issues one fetch per initiation and contains no retry
logic. The same correction was applied to the embedded replacement text
in `make-src.py` so the src generator stays consistent with `src/`.

**Comment-only proof.** The corrected `composition-ui3.js` differs from
the pinned candidate (SHA-256
`203d331d1db9df49cea05a08f0dc170426995b33241963aae3e5a446aba90912`) in
exactly one unified-diff hunk covering only `//` comment lines (5 lines
replaced by 10, at the bound comment); stripping all full-line `//`
comments from both versions leaves byte-identical content — no code line
changed. New SHA-256:
`a1d81ff739639fa6a6839649bd7a39d18e54e1a364621982d8c9bf7bb68f0cf0`,
identical in src/, tree-a/, tree-b/, package/publish/ and package/delta/.
Candidate identities are unchanged (app-266 / sw-ui3 / styles-153 /
build `d5b-v2-playback-client-14` / `ui-pkg-3`); the delta is still
exactly the same 8 paths; publish tree still 63 paths. New publish
digest: `86719a0f3b7f84b74aa9aaee65f477cf503ec8b6c7e15ae0efd8241f79622dc1`
(superseding `e379f0a30a75835034a2703afe6c65d9750995562f20e2b69f65f00cdf4131de`).

**Battery rerun on the corrected exact final trees** (one complete run
each; logs and exit codes re-preserved in `tests/` and pinned in the
rebuilt review artifact): unit battery 13/13 PASS on tree-a and on
package/publish (exit 0); cast census PASS (exit 0); Chromium proof
14/14 PASS on tree-a and on package/publish (exit 0); phone-width proof
11/11 PASS on tree-a and on package/publish (exit 0); phone-width proof
against the published base 9/11 PASS (exit 1 — the documented expected
reproduction: only Q1/Q2 fail, the 1,562 px² label/value paint overlap);
W-4 proof (T1–T6 + TQ) 7/7 PASS on tree-a and on package/publish
(exit 0); package static checks ALL CHECKS PASS (exit 0). No regression
from the originally pinned battery. The browser proofs used the same
environment-only WebGL policy-switch adaptation as the original build
(disclosed in the harness notes above); it changes no test semantics.

**Supersession.** This section and the corrected bound statements in the
body above (the "Per-device bound" paragraph, the fire-and-forget
discipline paragraph, and the T6 row) supersede every earlier
"at most one GET ever"-style phrasing in this report, including the
originally pinned version's claim that one device issues at most one
byte-check GET per (segment, binding object) ever. The accurate bound
is the one stated in the corrected comment: one concurrent
app-initiated verification per key, with a persisted successful
confirmation suppressing all later app requests for that binding on
that device.
