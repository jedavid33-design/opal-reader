# UI1 Build Report — Opal Reader v2 pretty-UI candidate (LOCAL BUILD ONLY)

Built under Julie's recorded local-build Go (Oct 28, 2026). Nothing was
published, pushed, or posted. This report is the builder's record for
Wren to file; Rowan's source review and Julie's publish/window Go are
separate later gates.

## Candidate identity

- Entry `app-264.js`; service worker `sw-ui1.js`; cache
  `opalreader-shell-ui1`; build marker `d5b-v2-playback-client-13`;
  packaging marker `ui-pkg-1`.
- Base: the published CORR1 tree, commit
  `4189e85b21169c039b5088b2996b51f32d1a94af` on
  `jedavid33-design/opal-reader` (local copy `ui1-build/base/` =
  `corr-build/package/publish`). Rollback basis `4189e85b…` intact:
  app-263 / sw-corr1 / cache `opalreader-shell-corr1` are preserved in
  the package and exercised by proof rows C1/C5.

## Preflight — cast census (frozen source records)

Source: `~/workspace/opal-reader-p8-data/books/*.json` (structural
metadata only — counts, keys, IDs, voice names; no book text read or
logged). The census JSONs have no top-level cast array; the migration
transform (`v2/migration/transform.mjs`) carries each book's `povs`
list verbatim as the content plane's `cast`, and does **not** carry
`defaultVoice`. Verified by `tests/cast-census.mjs` (exit 0; log
`tests/cast-census-results.txt`):

| Book | Cast | Voiced | No voice | style_direction present |
|---|---|---|---|---|
| Pucked Up (067ddb04…) | 2 | 2 | 0 | 2/2 |
| In Her Own League (1c6bc7a6…) | 4 | 2 | 2 | 0/2 |
| Pucked Over (21f655a2…) | 2 | 2 | 0 | 2/2 |
| Finding Home (48019197…) | 2 | 2 | 0 | 2/2 |
| Forever Pucked (5c589095…) | 2 | 2 | 0 | 2/2 |
| Pucked (89b2d4f1…) | 2 | 2 | 0 | 1/2 |
| The Goal (f1b1e2f9…) | 2 | 2 | 0 | 0/2 |

Totals: 16 cast entries across 7 books; **every book carries cast
data** (no book's Cast is blocked). Named exceptions, rendered
truthfully by the Cast view and never papered over:

- IHOL's two epilogue entries ("Epilogue - Reese", "Epilogue -
  Emmett") have `voice: null` → shown as "No voice recorded" with a
  "Needs a voice" flag.
- `style_direction` is absent on 5 of 14 voiced entries (IHOL's two
  Speechify voices, The Goal's Azure + ElevenLabs voices, Pucked's
  Violet) → those rows simply have no Style line.
- The shell's recorded voice-mapping table covers **exactly** the
  census's 4 non-Gemini cast voices (IHOL Emmett → Gemini Charon,
  IHOL Reese → Gemini Kore, The Goal Sabrina → Gemini Aoede, The Goal
  Tucker → Gemini Puck), no more, no fewer; the unverified flag sits
  exactly on Tucker — all machine-checked by the census script.

**Gap G-1 (book-wide style note):** the design's book-wide style card
has no source field: the v2 content plane carries no `defaultVoice`
(it exists in 3 of 7 source records but the transform does not carry
it). The Cast view therefore renders the truthful line "No book-wide
style note is carried in this book's data." for every book. Carrying
a book-level style field is a future data-plane decision, not
something this reskin may invent.

## What was built — delta (11 paths vs the CORR1 base)

New files (10): `app-264.js`, `sw-ui1.js`, `styles-151.css`,
`modules/composition-ui1.js`, `modules/constants-ui1.js`,
`modules/entry-ui1.js`, `modules/runnable-ui1.js`,
`modules/vendor/client-store-ui1.js`,
`modules/vendor/client/assembled-client-ui1.js`,
`modules/vendor/client/projection-ui1.js`.
Modified (1): `index.html` — exactly the 2 pointer lines
(`app-264.js?v=ui-pkg-1`, `styles-151.css?v=ui-pkg-1`).
All other 42 publish paths are byte-identical to the base (checked).

Substance, per the design + BUILD-PROPOSAL scope:

- **Reskin**: `styles-151.css` is the v1 stylesheet (Quicksand, plum
  `#4a315c` family, opalescent washes, frosted cards) with the D5-C
  shell additions replaced by a UI1 layer scoped to `#v2shell`:
  three-tab nav (Library · Find text · Settings), dark plum sticky
  player bar, cards/tiles/progress bars/pills/status dots, sheets,
  focus-visible outlines. The Access screen keeps CORR1's markup,
  ids, and texts verbatim; its reskin is CSS-only (deliberate
  preservation).
- **Library**: "Continue listening" hero (first book with a saved
  position), friendly per-book counts ("N with audio · M to go" /
  "Complete"), CORR1's sync-incomplete banner text unchanged.
  Partial sync says "not yet synced", never a false count.
- **Book view**: collapsible chapters (current chapter open by
  default; open/shut remembered per book+chapter in a shell-owned
  localStorage prefs key that never touches the candidate state
  record), collapsible actions card (Saved position/Resume strip;
  Generate all, Cast, Shelf behind the chevron, remembered), segment
  rows labelled "Segment N" with a "YOU ARE HERE" marker, per-chapter
  CORR1 truth pills unchanged in wording. Label law enforced:
  "No audio yet" only when the bindings drain is COMPLETE; otherwise
  "Not checked yet" / "Still syncing…", and no generate affordances
  are offered while incomplete. The stray cross-book card observed in
  the CORR1 FP view is absent (asserted in C3).
- **Generation's designed home, rendered but inert**: Generate all,
  per-chapter Generate, per-segment +, and the confirm sheet (title,
  segment scope, attempts estimate, cast voice lines, Standard |
  Batch switch with Batch disabled, "until today's quota" switch
  disabled in the on position) all render; every control that would
  act is disabled and the sheet states "Generation isn't on yet —
  these controls are a preview." Nothing submits, mutates, or
  charges. Proven by proof row V1 (clicks through every affordance;
  zero network writes after connect; candidate state record
  byte-identical before/after).
- **Cast (per book, display-only)**: rows built purely from the
  content plane's cast (identity, provider + voice name chips,
  per-character style line when `style_direction` exists), recorded
  mappings shown as mapping lines with Tucker's "Match not verified"
  flag, attention-first stable ordering (no voice / unverified /
  unmapped first), search filter, the never-silent-swap law printed
  on screen. Try/Change open a voice sheet that is likewise inert
  (Try and "Use this voice" disabled, off-note shown). A book whose
  data carries no cast array gets a disabled Cast row ("Cast data
  isn't carried for this book") — never an invented cast. Proof row
  V2 exercises the real Goal book id + census cast metadata, the FP
  unmapped/null-voice cases, and a no-cast book.
- **Shelf row (display-only)**: Linked pill / "Not linked" from the
  book's own attribution fields; **Open in Shelf** is a plain link;
  the **Link** button is disabled — creating a mapping remains
  separately gated Shelf-side work. The frozen bridge is untouched
  (hash below) and no mapping is created anywhere.
- **Find text**: result cards with "Book · Chapter N · Segment N",
  the real chapter/occurrence ids, and the match highlighted with
  `<mark>` built from text nodes (no HTML injection). Proof row C9.
- **Settings**: Reading settings in plain words (monthly cap,
  generation lane with a "Batch isn't armed" note when the server
  setting says batch, today's quota sentence from the CORR1 quota
  model verbatim), a **Backup section rendered honestly unavailable**
  (see Gap G-2), Connection row, and the Diagnostics section folded
  in — every CORR1 diagnostic row kept verbatim (same `diag-*` ids
  and texts, incl. flush "sent vs blocked" meanings and the
  "N of M books carry a Shelf read ID" attribution), with decorative
  status dots added. Proof row C4.
- **Player bar**: prev/next/play-pause/seek/rate kept functional;
  status humanized to "Chapter N · Segment M · Xs in" (the CORR1
  diagnostics-style status string no longer shows). Proof row V4
  plays a segment, checks the humanized status, and advances with
  Next to the computed successor.

**Gap G-2 (backup):** the accepted CORR1 client contains no backup
or restore implementation at all (grep-verified across the tree),
and the proposal scoped backup to presentation only. UI1 renders the
design's Backup rows with Download/Restore **disabled** and the note
"Backup and restore aren't part of this build yet." Implementing
DB-G1 backup in the client is separate future work — flagged here
for disposition rather than faked.

**Assumption A-1 (Open in Shelf target):** the link points at the
compiled Shelf service root (`${SHELF_BASE.url}/`); no Shelf *app*
page URL exists anywhere in the accepted client to link to instead.
To be confirmed in the attended window.

## Battery results (one complete run each, full logs preserved)

- Unit battery (CORR1's U1–U13, imports retargeted to the ui1
  modules): **13/13 PASS**, exit 0 — on tree-a
  (`tests/unit-results.txt`) and on package/publish
  (`tests/unit-results-package.txt`).
- Cast census: **PASS**, exit 0 (`tests/cast-census-results.txt`).
- Chromium proof, 14 rows (C0–C9 CORR1-preservation rows + V1–V4 UI1
  rows): **14/14 PASS**, exit 0 — on tree-a
  (`tests/chromium-results-tree-a.txt`) and on the exact final
  package tree (`tests/chromium-results-package.txt`).
- Package assembly static checks: **ALL CHECKS PASS**, exit 0
  (`package/assemble-results.txt`): base 43 paths → publish 53;
  delta classification exactly the 11 declared paths; non-delta
  paths byte-identical; index diff exactly 2 lines; sw-ui1 SHELL ==
  packaged closure (30 entries); `PURGE_ON_ACTIVATE == []`;
  app-264 closure uses only ui1 + inherited modules; app-263
  rollback closure resolves and contains no ui1 modules; markers in
  both entries.

Preservation specifics asserted by the proof: upgrade keeps the
CORR1 cache and rollback works with the UI1 cache preserved inert
(C1/C5); one-connect bindings drain 251/251 in 3 pages (C2);
first-page and partial-sync truth agree across banner, library,
chapter pills, segment labels, and Diagnostics (C7/C8); Shelf flush
meanings exact incl. 409-stays-pending (C6); token never appears in
web storage (C4); collapsible + actions state persists across reload
and reconnect (V3); tap targets ≥ 40px nav/actions, ≥ 44px chapter
headers, ≥ 36px play buttons, aria-expanded/aria-labels present
(V3).

## Frozen bridge & inherited files

- `modules/vendor/client/shelf-bridge.js` SHA-256 in the package =
  `bc0a5879fbf4a6f455170ead8e0fbe1aa19d82126df4eb631bd0ebad9112ec8e`
  — byte-identical to the pinned value (package-assemble check).
- The CORR1 store/projection forks differ from their CORR1 sources
  only by banner/identity lines plus the inherited CORR1 fixes
  (chapterId keying, bounded drain); composition fork = import
  renames only. Shelf bridge, player, transport, and all other
  inherited modules are the base's bytes.

## Harness honesty note

The Chromium proof harness (stub coordinator/Shelf + fixtures) went
through several corrections during this build; every failure along
the way was traced to a harness defect, not the candidate: the stub
initially lacked the settings sync family; the stub audio had to be
a real decodable WAV of exactly the probe's pinned 10,944 bytes for
preflight step C4; the probe key is addressed with a `.mp3` suffix;
and fixture bindings initially lacked the `format`/`sizeBytes`
fields the player requires (`invalid_audio_binding`). Two transient
single-row failures (a collapsible assertion, a playback-state
observation) occurred under the defective fixtures and did not
reproduce once fixtures carried the production binding shape. The
final logs above are complete single runs of the corrected harness
on the final trees, claimed green on that basis only.

## Deliverables in this directory

- `tree-a/` — assembled candidate (review tree); `tree-b/` — identical
  second assembly.
- `package/publish/` — publish tree (53 paths); `package/delta/` —
  the 11 delta paths; `package/PACKAGE-MANIFEST.json` +
  `package/assemble-results.txt`.
- `review-artifact/` — base index, delta files, test sources, and
  `MANIFEST.json` (per-file bytes/SHA-256/git-blob + recorded
  battery results).
- `src/` — the delta sources; `assemble.py`, `package-assemble.py`,
  `snapshot-review-artifact.py` — the build process;
  `tests/` — batteries and all preserved logs.

## Open items for Wren / Rowan / Julie

1. Gap G-1: book-wide style note has no data-plane field (Cast card
   states this plainly). Disposition needed only if the design wants
   the field carried in a future migration.
2. Gap G-2: backup/restore is not implemented in the accepted client
   at all; UI1 shows it honestly unavailable. Separate future work.
3. Assumption A-1: Open-in-Shelf link target (Shelf service root) to
   confirm in the attended window.
4. Next gates (not taken): Rowan source review of this artifact,
   then Julie's publish/window Go. D6 arming remains entirely
   separate; this candidate's generation controls are inert by
   construction and by test.

## Correction C-1 (Rowan source review, Oct 28)

Two findings from Rowan's source review, applied as a bounded
correction. Identities unchanged (app-264.js / sw-ui1.js /
opalreader-shell-ui1 / build -13 / ui-pkg-1); the delta is still
exactly the same 11 paths; index.html is still the only modified
base path. This section supersedes the two earlier statements that
the index diff is "exactly the 2 pointer lines" / "exactly 2 lines".

**Finding 1 — stale version string in the startup failure notice.**
The candidate's index.html startup-failure notice (inherited
unchanged from the base tree) read "Opal Reader could not load its
interface (v1.4.122)" — a stale user-facing version identification:
the notice fires precisely when the UI1 build itself has failed to
load, and UI 1.4.122 is the pre-window client, not this build.
Corrected in `src/index-ui1.html` to identify the build truthfully
by its build marker, the same identity the candidate carries in its
constants and diagnostics:

  "Opal Reader could not load its interface (build
  d5b-v2-playback-client-13). …"

(The remaining "1.4.122" strings in the tree live only inside the
rollback closure's own bundles — app-262.js identifies the 1.4.122
rollback client, which is what those bytes are; inherited files stay
byte-identical and none is a delta path.)

**New index diff (base → publish): exactly 3 lines.**

  1. script pointer: `app-263.js?v=corr-pkg-1` → `app-264.js?v=ui-pkg-1`
  2. stylesheet pointer: `styles-150.css?v=d5c-pkg-8` → `styles-151.css?v=ui-pkg-1`
  3. startup failure notice: `(v1.4.122)` → `(build d5b-v2-playback-client-13)`

The package static checks were updated to declare exactly this
expectation (2 pointer lines + the corrected notice line, which must
carry the build marker) plus a new whole-file check that the
published index contains no "1.4.122" anywhere;
`package/PACKAGE-MANIFEST.json` now records the diff in an
`indexDiff` field. Of the 53 publish paths, only index.html changed
bytes versus the pre-correction package (new SHA-256
b16d586faa90ac985e7ec7d628215edbff8d2f9ee746437e1fcd4b5c70586d6f);
the publish-tree digest (sorted per-file SHA-256 listing, hashed)
moved from 4060bb2098e441cf0f3f54e2883b80860d62e92137d038994a4fb44b7c63660a
to cb2375c4170fd6978069d6c5b2c2e6588240d674a7209a09a444a182e99a0f69
on that one file alone.

**Rerun results (exact final trees, one complete run each; logs
below).** Package assembly: ALL CHECKS PASS, exit 0. Unit battery:
13/13 PASS, exit 0, on tree-a and on package/publish. Cast census:
PASS, exit 0. Chromium proof: 14/14 PASS, exit 0, on tree-a and on
package/publish. Harness honesty: the first package-tree Chromium
invocation in this rerun used a wrong `UI1_TREE` path
(`../package/publish`, which resolves outside the build root); the
proof exited 1 with ENOENT before any row ran — an invocation
error, not a candidate result. The preserved package log is from
the corrected invocation (`UI1_TREE=package/publish`), and the
aborted attempt is recorded in `tests/run-exit-codes.json`.

**Finding 2 — battery logs pinned into the review artifact.**
Rowan could not fetch the logs this report references (the artifact
recorded only their tail lines; the files themselves 404'd).
`snapshot-review-artifact.py` now also copies the preserved logs
into the artifact under `logs/`: unit-results.txt,
unit-results-package.txt, chromium-results-tree-a.txt,
chromium-results-package.txt, cast-census-results.txt,
assemble-results.txt — the NEW final-run logs from the rerun above —
plus run-exit-codes.json (commands + exit codes for every run).
MANIFEST.json lists each with bytes/SHA-256/git-blob id alongside
the delta files; the pinned copies were verified byte-identical to
their sources. The artifact now holds 22 hashed files + MANIFEST.
