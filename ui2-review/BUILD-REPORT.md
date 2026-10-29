# UI2 Corrective Build Report — Opal Reader v2 player-bar + chapter-header fix (LOCAL BUILD ONLY)

Window findings W-1, W-2, W-3 from Julie's attended UI1 window (Oct 28, 2026). Julie's
disposition: "Fix it now — small corrective round." Nothing here is published, pushed, or
posted; the candidate is local, packaged, and pinned for Wren to push for review.

## Candidate identity

| | |
|---|---|
| Entry | `app-265.js` |
| Service worker | `sw-ui2.js` |
| Cache | `opalreader-shell-ui2` |
| Stylesheet | `styles-152.css` |
| Build marker | `d5b-v2-playback-client-13` (**unchanged** — see "Versioning" below) |
| Packaging marker | `ui-pkg-2` |
| Base | published UI1 tree (ui-pkg-1), live commit `a9f8c169b6bcbcbf8c2240abd83af3e0772e4c1d` |
| Publish tree | 56 paths (53 base + 3 new), publish digest `1c7c39c261b9b8a4e6d8d5a42972adff8f11ecf26d5ff69d47ae37463ef181f9` (SHA-256 of the sorted `path sha256` lines of `package/PACKAGE-MANIFEST.json`) |
| Delta | exactly 4 paths (below) |

Base integrity: every one of the 53 base files is hash-identical to the UI1
`PACKAGE-MANIFEST.json` on record, so the corrective is built on exactly the tree Julie's
phone is running.

## The findings — reproduced first, with measurements

All measurements are from the new phone-width proof (`tests/phone-width-proof.mjs`) run
against the published tree (`UI2_TREE=base`, preserved log `tests/phone-results-base.txt`:
**1/9 PASS** — only the short-pill Complete state passes). Viewports are emulated at
390×844 and 360×740 (CSS px, mobile, DSF 2). The fixture book mirrors Julie's Forever
Pucked: a 27-segment chapter, single POV "Violet", all bound, nothing byte-confirmed on
the device → pill text exactly as on her phone.

### W-1 — player bar overflows; speed chip clipped (Julie's screenshot)

At 390px: the bar itself fits (12.8..377.2), but the speed select (`#player-rate`) spans
**343.6..420.3** — 43.1px past the bar's right edge, 30.3px past the viewport. At 360px
the select sits at the *same absolute* 343.6..420.3 (bar ends at 347.2): the row does not
compress at all as the viewport narrows.

**Exact CSS cause.** The controls row `.ui-pcontrols` (prev / play / next / seek / speed)
has an inflexible minimum of ≈392px against a bar inner width of 334px @390 (304px @360):

- prev 44 + play 56 + next 44 are `flex: 0 0 auto` (`.ui-pround`) — never shrink;
- the seek input is `flex: 1 1 8rem`, but a flex item's *automatic minimum size*
  (`min-width: auto`) for `input[type=range]` is its intrinsic width ≈ its 128px basis —
  it cannot shrink below ≈128px;
- the speed select (default `flex: 0 1 auto`, `min-width: auto`) cannot shrink below its
  min-content ≈77px (longest option "1.25×" + native chrome);
- gaps add 4 × 9.6px.

44+56+44+128+77+38.4 ≈ 387–392px > 334px → the row overflows the bar to the right and the
last control is painted off-viewport. The desktop-width Chromium battery never saw it
because the row fits easily at ≥800px.

### W-2 — chapter header collision (Julie's Forever Pucked screenshot)

At 390px on the published tree: the heading `h4` measures **clientWidth 0** (scrollWidth
64 — the word "Chapter" alone); the status pill spans to **right edge 447** and the
chevron to **469** against a card edge of 377.2 and a viewport of 390.

**Exact CSS/markup cause.** The header is one no-wrap flex row
(`.ui-chap-head`, `display:flex`, no `flex-wrap`) carrying: `h4` + narrator span +
status pill + chevron.

- `h4` is `flex: 1` (= `1 1 0%`) with `min-width: 0` — basis zero, fully crushable;
- the pill `.ui-pill` is `white-space: nowrap`; the Uncertain text
  ("Uncertain — audio not verified on this device (0/27 confirmed)") has a min-content of
  ≈367px and, with flex's `min-width: auto`, cannot shrink;
- narrator + pill + chevron minimums (≈440px) exceed the row (330px), so the shrink
  algorithm takes everything from the only crushable item: the heading collapses to a
  0-wide box, its text wraps ("Chapter" / "1" stacked) and paints outside its box across
  the narrator label — the overlap Julie saw — while the pill is pushed past the card's
  right edge and clipped mid-word by the viewport.

### W-3 — player bar not pinned (Julie's design request: "make the player sticky")

**What it is now.** `#v2playerbar` is the last in-flow child of `#v2shell`, styled
`position: sticky; bottom: 0.6rem`. Measured on the published tree: computed position is
`sticky`, and the bar simply occupies its flow position at the end of the content —
Library at scroll 0: bar bottom at **800.4** in an 844 viewport (where the list happened
to end, 33.6px short of the viewport bottom); tablet portrait: bottom **724** of 1024; in
the book view it sits below the last chapter and is not visible at all until the reader
scrolls to the very end. That matches Julie's screenshots exactly.

**DOM-placement check (asked for in the brief).** The bar's ancestors are
`#v2shell → #app → body`; none carries a transform, filter, or backdrop-filter, so
`position: fixed` from the stylesheet alone works — **no JS or markup change was needed**,
and none was made.

## The fix — one appended CSS layer, `styles-152.css`

`styles-152.css` is `styles-151.css` byte-identical plus ONE appended section
(diff: a single hunk, `390a391,444` — pure addition, no existing rule edited). The
corrective rules override the UI1 rules of equal specificity by source order:

- **W-3:** `#v2playerbar` becomes `position: fixed; left: 50%; transform:
  translateX(-50%); width: min(720px, calc(100vw - 28px))` (the v1 player's own geometry),
  `bottom: max(10px, env(safe-area-inset-bottom))` (home-indicator safe area), z-index 20
  (above content, below the modal sheets at 40); `width: calc(100vw - 20px)` at ≤600px,
  matching the UI1 mobile inset. `#v2shell` bottom padding grows to
  `calc(9.5rem + env(safe-area-inset-bottom))` so content can always scroll clear
  (bar height measures 102.4px ≈ 6.4rem).
- **W-1:** the seek input gets `min-width: 0` (it may finally shrink below its automatic
  minimum) and the speed select gets `min-width: 3.9rem` (it may shrink from its 77px
  min-content to a 62.4px floor that still shows value + arrow). The three round buttons
  are untouched (44/56/44px — tap targets exactly as before). Result @390: seek 90.5px,
  select 62.4px, everything inside the bar; @360: seek 60.5px, select 62.4px.
- **W-2:** the heading becomes `flex: 0 1 auto; white-space: nowrap` (natural one-line
  width, never crushed, never wraps) and the row gets `flex-wrap: wrap`; the narrator is
  `white-space: nowrap` (wraps as a unit if it ever can't fit). At ≤600px the chevron
  takes `margin-left: auto` (stays at the heading's right) and the pill takes
  `order: 5; flex: 1 1 100%; white-space: normal` — its own full-width line under the
  heading row, text wrapping at spaces. Result @390: heading "Chapter 1" on one line
  (77.5px wide), pill on its own line (330.4px wide, two wrapped text lines,
  scrollWidth == clientWidth → fully readable) in **all four states** (Uncertain /
  Partial / Sync incomplete / Complete / Not started), including a long narrator name
  ("Violet Morningstar-Blackwood" fixture). The state the pill *shows* is untouched —
  only its layout changed.

Everything else — markup, ids, classes, JS behaviour, truthful-state semantics — is
unchanged. **No JS file's behaviour changed at all** (see delta).

## Delta — exactly 4 paths vs the published tree

| Path | Kind | SHA-256 (head) | Justification |
|---|---|---|---|
| `index.html` | modified | `414d24ff45d9` | Exactly the 2 pointer lines: `app-265.js?v=ui-pkg-2`, `styles-152.css?v=ui-pkg-2`. The startup notice still reads "(build d5b-v2-playback-client-13)" — true, the build did not move. |
| `styles-152.css` | new | `3ff48365c5d9` | The corrective stylesheet (above). `styles-151.css` stays published, byte-identical, for the ui-pkg-1 rollback. |
| `sw-ui2.js` | new | `3f17ec3d7617` | `sw-ui1.js` with only: cache `opalreader-shell-ui2`, SHELL naming `app-265.js` + `styles-152.css` in place of the ui1 pair, header comments. A new SW is *required*: the SW SHELL names the stylesheet, and an unchanged `sw-ui1.js` would leave `styles-152.css` outside the shell (never precached, failing offline). `PURGE_ON_ACTIVATE` stays `[]`; fetch/activate discipline byte-identical logic. |
| `app-265.js` | new | `207a0918588e` | `app-264.js` with ONLY its packaging identity advanced: `PACKAGING_MARKER "ui-pkg-2"`, `register("./sw-ui2.js")`, and header comments. A new entry is *required*: the entry is what registers the SW by name and carries the packaging marker — a "ui-pkg-2" package whose entry still said ui-pkg-1 and registered sw-ui1.js would be lying. All imports resolve to the same *-ui1 modules, byte-identical. |

**Versioning note (a deliberate choice, flagged for review).** The build marker stays
`d5b-v2-playback-client-13`: it identifies the client build, and no behaviour code
changed — the delta is presentation CSS plus identity strings. The packaging marker
advances to `ui-pkg-2`, so Settings/Diagnostics on a corrected device read build -13 /
packaging ui-pkg-2, distinguishable from the window's ui-pkg-1 devices at a glance.

Rollback basis: commit `a9f8c169…` stays the parent; `app-264.js` / `sw-ui1.js` /
`styles-151.css` / cache `opalreader-shell-ui1` are preserved byte-identical inside the
publish tree (proven by the package checks), so rollback is the same pointer-flip as
before. The frozen Shelf bridge is byte-identical (SHA-256 `bc0a5879…`, checked).

## Q4 — what "(0/27 confirmed)" counts, and whether playing moves it

Answered from the code; **no behaviour changed**.

- The pill text comes from `chapterModel` (`modules/vendor/client/projection-ui1.js:34`):
  for label `Uncertain` it renders `(${c.ready}/${c.total} confirmed)`. `total` is the
  chapter's segment count (27 for Forever Pucked ch. 1). `ready` is counted in
  `chapterDisplay` (`modules/vendor/client-store-ui1.js:414`, counting at :434): a
  segment counts as ready iff (a) its binding record is synced onto this device **and**
  (b) the device's local state holds a byte-confirmation for that binding's audio object
  at its current revision — `state.bytes[cacheKey].bindingRevision === binding.revision`.
  Bound-but-unconfirmed segments count as `unverified`; if any exist the chapter reads
  Uncertain. (Julie's phone has the bindings but an empty confirmations map for this
  content — hence 0/27 even though the audio is all present server-side.)
- A confirmation is recorded by exactly one code path: the store's
  `verifyBindingBytes(bookId, occurrenceId)` (`client-store-ui1.js:375`), which asks the
  server `GET /v2/sync/byte-check/<cacheKey>` (`modules/vendor/client/http-transport.js:66`,
  returns `{exists: true}`) and only then writes `state.bytes[cacheKey] =
  {bindingRevision}` locally.
- **Playing a segment does NOT increment it.** `verifyBindingBytes` has **zero call
  sites** anywhere in the shipped client (grep over the whole publish tree: only its
  definition and the store's export list). The playback path (`resolvePlayback`, same
  store file) is documented and implemented as "Playback never writes records"; it
  neither calls `verifyBindingBytes` nor its counterpart `reportBytesMissing` (which
  also has zero call sites and would *remove* a confirmation). The preflight's C3 step
  does perform a byte-check, but through the audio transport against the single
  designated probe key, and it records nothing into `state.bytes`.
- Consequence for the live window: if Julie plays segments from Forever Pucked ch. 1,
  the pill will stay at (0/27 confirmed) and the chapter will stay Uncertain no matter
  how much she plays. Nothing in the current client ever populates the confirmations
  map per segment, so no chapter with bindings can currently reach "Complete" on a real
  device through use. That is a pre-existing ui-pkg-1 (and CORR1-line) behaviour, stated
  here as fact for Wren/Julie — this corrective does not touch it (CSS + identity only,
  per scope).

## Battery results — one complete run each on the exact final trees, logs preserved

| Battery | Tree | Result | Log |
|---|---|---|---|
| Unit battery | tree-a | **13/13 PASS** (exit 0) | `tests/unit-results.txt` |
| Unit battery | package/publish | **13/13 PASS** (exit 0) | `tests/unit-results-package.txt` |
| Cast census | source records | **PASS** (exit 0) — read from `src/app-265.js`; the mappings table carried verbatim | `tests/cast-census-results.txt` |
| Chromium proof (C0–C9, V1–V4) | tree-a | **14/14 PASS** (exit 0) | `tests/chromium-results-tree-a.txt` |
| Chromium proof | package/publish | **14/14 PASS** (exit 0) | `tests/chromium-results-package.txt` |
| Phone-width proof (P/S/V/H/T rows) | tree-a | **9/9 PASS** (exit 0) | `tests/phone-results-tree-a.txt` |
| Phone-width proof | package/publish | **9/9 PASS** (exit 0) | `tests/phone-results-package.txt` |
| Phone-width proof | **base (published ui-pkg-1)** | **1/9 PASS (exit 1) — expected**: the W-rows fail there; this is the reproduction evidence | `tests/phone-results-base.txt` |
| Package static checks | package | **ALL CHECKS PASS** (exit 0): base 53, publish 56, delta exactly the 4 declared paths, index diff exactly 2 pointer lines, sw-ui2 SHELL == 30-entry packaged closure, purge `[]`, sw-ui1 SHELL resolvable, closures for app-265/264/263 resolve with no cross-generation imports, markers correct, bridge hash pinned | `package/assemble-results.txt` |

Exit codes for every run: `tests/run-exit-codes.json` (also pinned in the artifact).

The Chromium proof's baseline/rollback rows were re-pointed for this package: C0 now
proves the **published UI1** shell (sw-ui1, -13/ui-pkg-1), C1 the upgrade to sw-ui2 with
the ui1 cache preserved, C5 the rollback to UI1 with the ui2 cache preserved inert.

### Regression rows added (phone-width proof)

- **P1/P2** (W-1 @390/@360): bar and all five controls + status fully inside the
  viewport and the bar; tap heights unchanged (44/56/44/44; seek 32 as designed).
- **S1** (W-3 @390): bar bottom == viewport bottom − 10px at scroll 0 / mid / max in
  Library and book view; at max scroll the last chapter card's bottom clears the bar top
  (measured clearance 50.4px).
- **H1/H2/H3a/H3b** (W-2 @390/@360): heading one line and unclipped, zero
  heading/narrator and heading/pill box overlap, pill inside the card and fully readable
  (scrollWidth ≤ clientWidth) — for Uncertain (0/27, Julie's exact case), Partial,
  Not started, Sync incomplete (failed-drain profile), Complete (confirmations seeded
  into the device state record by the test), and a long-narrator chapter.
- **V1** (scan @390): zero elements outside the viewport on Library, Book, Find text, and
  Settings (the scan was also run pre-fix: its offender list is the W-1/W-2 evidence —
  `SELECT#player-rate` on every view; pill + chevron in book view).
- **T1** (tablet, task step 6): at 768×1024 the bar is exactly the 720px design width,
  centred, pinned, all controls fit with room (seek 426px); the chapter header keeps its
  **single-row** arrangement (pill beside the heading, asserted by aligned tops) — the
  pill's own-line stacking is phone-only — and no fixed-width assumption in the bar or
  header breaks at iPad portrait. No additional overflow was found anywhere in the scan;
  nothing beyond the player bar and chapter header needed fixing, and nothing else was
  touched.

## Harness honesty notes

- Two defects during this build were in my *adaptation of the test harness*, not the
  candidate, and are recorded here rather than silently absorbed: (1) a blanket
  string-replace while re-pointing the Chromium proof flipped two service-worker
  expectations (C0/C5) to the wrong generation — fixed by anchored edits; the affected
  runs were discarded and the battery rerun whole. (2) The package assembler's first
  run failed its own publish-count check (57 expected vs 56 actual — my arithmetic
  double-counted the modified index; 53 + 3 new = 56) — expectation corrected, rerun
  green. Separately, two mid-adaptation Chromium runs timed out in fresh profiles
  because ~105 leaked Chromium processes from killed runs were starving the machine;
  after cleanup the identical proof completes in ~29s. The preserved logs are from the
  final, clean, complete runs only.
- The phone-width proof measures *layout* in headless Chromium with an emulated
  viewport. It does not prove iOS Safari's fixed-position behaviour during rubber-band
  scrolling or toolbar collapse; the geometry (centred fixed bar, safe-area inset) is
  the v1 player's own, which Julie used on this phone for months.
- At 360px the seek slider ends up 60.5px wide — usable, but visibly narrower than on
  desktop. That is the arithmetic consequence of the brief's constraints (button sizes
  and tap targets preserved; the two flexible controls absorb all the shrink). If Julie
  wants a wider slider at small widths, the honest lever is smaller prev/next buttons —
  a design decision, not taken here.

## Deliverables in this directory

- `src/` — the 4 delta sources (`app-265.js`, `sw-ui2.js`, `styles-152.css`,
  `index-ui2.html` → `index.html`).
- `base/` — the published UI1 tree (53 paths, hash-verified against the UI1 manifest);
  also the "old tree" the regression rows fail against.
- `tree-a/`, `tree-b/` — assembled candidate trees (verified byte-identical to each
  other); `assemble.py` rebuilds them.
- `package/` — `publish/` (56 paths), `delta/` (4 paths), `PACKAGE-MANIFEST.json`
  (per-file SHA-256), `assemble-results.txt`; `package-assemble.py` rebuilds it.
- `tests/` — all test sources and preserved logs, incl. `run-exit-codes.json`.
- `review-artifact/` — the snapshot for Rowan (`snapshot-review-artifact.py`):
  `base-index.html`, `delta/` (4 files), `tests/` (5 sources), `logs/` (10 preserved
  logs), `MANIFEST.json` (20 hashed files, candidate identity, battery tails, publish
  digest). Delta files in the artifact verified byte-identical to the package delta.

Not done, by scope: no git push, no board post, no publish. The window stays open on
Julie's UI1 devices; acceptance of this corrective is a separate gate.
