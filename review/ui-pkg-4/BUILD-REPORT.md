# G7 Build Report — Opal Reader v2 ui-pkg-4: IndexedDB state storage (REPO-ONLY BUILD)

Built under Julie's approval `JULIE-APPROVAL:G7-BUILD-20261029` (board issue #15,
comment 6506732468), implementing `G7-STORAGE-DESIGN.md` exactly as passed by
Rowan with conditions (comment 6506670300). **Scope was strictly: implement +
test + assemble candidate package + pin + this report.** Nothing is published
or deployed; no production data was contacted; no device work; no arming,
generation, or spending. Every battery ran against loopback stub coordinators
or in-process fakes.

## Candidate identity

| | |
|---|---|
| Entry | `app-267.js` |
| Service worker | `sw-ui4.js` |
| Cache | `opalreader-shell-ui4` |
| Stylesheet | `styles-154.css` |
| Build marker | `d5b-v2-playback-client-15` (carried by `modules/constants-ui4.js`) |
| Packaging marker | `ui-pkg-4` |
| Base | accepted live ui-pkg-3 tree, commit `bf4e5ba2a31d6e47390817d2b1333ff2d7df9f1d` (63 paths; `~/workspace/ui4-build/base/`) |
| Publish tree | 73 paths (63 base + 10 new), publish digest `178a6876393ce4367c0f2c1293a15c80dbd2f91fd50bf885aebb477d63e00d23` (SHA-256 of the sorted `path sha256` lines of `package/PACKAGE-MANIFEST.json`) |
| Delta | exactly 11 paths (below); every non-delta publish path is byte-identical to the base (asserted by `package-assemble.py`) |

## Delta manifest (SHA-256)

| Path | Kind | Before (ui-pkg-3) | After (ui-pkg-4) |
|---|---|---|---|
| `index.html` | modified (exactly 3 lines: app/styles pointers + notice marker) | `a3bf01936147aaba49aecd88149d68487cbb5e27d02700588cbc7e89ea2355a6` | `a70de8fff0ae6388c210368c4eb0e91d498d7aafb85f77ce8c931414fbbdbbd0` |
| `app-267.js` | new | — | `f15b5f43d8b438e69d3102b5a9e529657df08730f971e1757639542f4e4de039` |
| `styles-154.css` | new (styles-153 + comment-only layer note) | — | `2984b4fcbe207388dd9d5fd349ee2c75a498c44c51763b214ad55edc6aa287dc` |
| `sw-ui4.js` | new | — | `a5227e199a4ec7b1d357de4bd37428d30eb550cae22dac5ed77dc173eb9bc022` |
| `modules/constants-ui4.js` | new | — | `5b2f4bcc7e1d2bf679854e75445bd487c4ab437ae45352bda60a98a7c5ffe778` |
| `modules/entry-ui4.js` | new | — | `7d9bf1588e1c5049c98d30c3aaf024976c59b4600e8bd2c37670621eae1eb329` |
| `modules/runnable-ui4.js` | new | — | `2ae1eef4deb03c88a5339dcfccfab22e80efbcbf3627065a178a350ec9dc4059` |
| `modules/composition-ui4.js` | new (header note + 2 import pointer swaps only) | — | `7ca8340a348bda9f77e4dad4ee1fc577dded5fa951df812ef6e6628706f4ef8f` |
| `modules/storage-state.js` | new (authored core module: classifier, IDB adapter, routing adapter, migration S0–S6, boot agreement, guard) | — | `853eebd97e9b2f8c40992f2e91b3a372262438923eb4402c9a786f723da4cb74` |
| `modules/vendor/client-store-ui4.js` | new | — | `a65638bb9c0c715b7ac5494f6e94d8b2f5e97451e633a4266d4111d0053493a6` |
| `modules/vendor/client/assembled-client-ui4.js` | new (header note + store import swap only) | — | `294df1c7bfd8820ef7985e427f1942e9acd31ebf231ff4f243167f9600c09d23` |

Frozen surfaces verified byte-identical in the publish tree: Shelf bridge
`modules/vendor/client/shelf-bridge.js` SHA-256
`bc0a5879fbf4a6f455170ead8e0fbe1aa19d82126df4eb631bd0ebad9112ec8e` (pinned);
the accepted UI1 store remains present byte-identical for rollback
(`778d4c3367b5f9b65b738ab48ac8c9cfcfce4bb514acb927defc1df0c013e3ad`).
`client-store-ui4.js` differs from `client-store-ui1.js` by 94 diff lines,
confined to the declared regions: the header note, the `onStageError`
parameter, the resync snapshot stage tag, and the drain classification block.
Everything else in the store is byte-identical.

## Implementation map (design → code)

- **§5.1 seam**: `runnable-ui4.js` builds the legacy browser storage, the
  IndexedDB adapter, and the routing adapter; migration runs after
  `owner.acquire()` and before `createCandidate` (from `composition-ui4.js`).
- **§5.2 routing**: `createStateRoutingStorage` dispatches on exact key
  equality with `cs:state:v1` only; every other key (Shelf record, deviceId
  slot, UI prefs, unknown keys) flows through the existing localStorage
  adapter unchanged, pre- and post-cutover. No path back after cutover.
- **§5.3 IDB adapter**: DB `opalreader-v2-state` v1, store `records`,
  rows `{key, value}` with the JSON **string** as value; one readwrite
  transaction per `set`, the ownership guard invoked immediately before
  `put`, resolution on `tx.oncomplete`; blocked open beyond a bounded wait
  and `onversionchange` both surface `storage_unavailable`;
  `navigator.storage.persist()`/`estimate()` are best-effort diagnostics.
- **§5.4 migration S0–S6**: verbatim record move; S2 schema + deviceId-slot
  validation and Shelf/prefs guard hashes; S3 single transaction (state +
  meta); S4 verify on a fresh connection (string equality, SHA-256,
  field-level invariant counts); S5 cutover marker written last; legacy
  record retained byte-identical (no deletion anywhere except S4's removal
  of the migration's own unverified rows). `commandCounter` and the outbox
  migrate as data — nothing is re-executed or replayed.
- **§5.5 boot agreement + tripwire**: marker present ⇒ IDB must open, meta
  must parse at schema 1, state row must parse; legacy hash mismatch ⇒
  `legacy_writer_detected` stop; missing/unreadable IDB ⇒
  `storage_unavailable` stop. Stale legacy is never served.
- **§5.6 shell snapshot**: `readStateRecord()` reads an in-memory snapshot
  refreshed from the active backend — at boot, after client construction,
  after Connect's drains, on entering any data screen (`show()`), after
  playback selection (`selectSegment`), and before Diagnostics renders.
  Diagnostics gains a **State storage** row (`diag-state-storage`).
  `shelfOutboxCount()` and `device-identity.js` are unchanged.
- **§3 classification**: `classifyStorageError` matches by `err.name`, then
  legacy `err.code`, never message text (except the cyclic-structure
  TypeError). The store drain splits stages (transport vs apply vs storage
  write) so a storage throw is never again labelled `network_error`;
  persisted `drainStatus` entries carry a `diag` object restricted to the
  §3.3 allowlist. Ownership-gate refusals are never classified or
  re-labelled (their codes are control flow).
- **§6 frozen surfaces**: routing exclusion + direct-read exclusion + the
  S2/S6 hash guard over the raw Shelf and prefs strings; guard outcomes are
  reported as booleans + the Shelf pending count only, evaluated at the
  first post-cutover Connect **before** that session's Shelf flush.

## Design-decision notes (choices the design left open)

1. **Errors are wrapped, never mutated** (DOMException properties are
   read-only in strict-mode modules): classification attaches via a new
   error carrying `.code` = class, `.diag`, and `.cause`.
2. **Frozen-record guard timing**: evaluated once, at the first
   post-cutover Connect, before the Shelf flush — the bridge legitimately
   ticks attempt counters during a flush, so a post-flush comparison
   would false-positive on the bridge's own writes.
3. **Migration health shape**: `{backend, state, migratedAt, sourceChars,
   lastDiag, markerWriteFailed, verifyGuard(), estimate, persist}` — the
   shell surfaces it via `run.storageHealth()` and the Diagnostics row.
4. **Marker-write failure** leaves the verified IDB rows as a resumable
   remnant (next boot re-verifies and retries only the marker); the router
   does not flip and legacy stays authoritative.
5. **T8 method**: the design allowed a test build flag to force the legacy
   path; the proof instead removes `window.indexedDB` before app load on
   the **unmodified candidate build**, which drives the same S1
   stay-on-legacy path. No test-only code ships in the candidate.

## Test results (final tree; full logs in `~/workspace/ui4-build/tests/logs/`)

| Battery | Tree | Result | Exit | Log |
|---|---|---|---:|---|
| Package static checks (`package-assemble.py`) | package | ALL CHECKS PASS (base 63, publish 73, delta exactly the 11 declared paths, index diff exactly 3 lines, sw-ui4 SHELL == 31-entry packaged closure, PURGE `[]`, all rollback SW SHELLs resolvable, closures correct, bridge + ui1-store SHA pinned, markers correct) | 0 | `package/assemble-results.txt` |
| G7 suite (23 rows: §9 T1–T6, T9, T11 at Node level) | tree-a | 23/23 | 0 | `logs/g7-suite-tree-a.log` |
| G7 suite | package/publish | 23/23 | 0 | `logs/g7-suite-package.log` |
| Unit battery (accepted UI1 store battery, adapted imports) | tree-a | 13/13 | 0 | `logs/unit-tree-a.log` |
| Unit battery | package/publish | 13/13 | 0 | `logs/unit-package.log` |
| Cast census | src | PASS | 0 | `logs/cast-census.log` |
| Chromium G7 proof (T7 full-size, T8 real quota, T11 eviction) | tree-a | 7/7 | 0 | `logs/chromium-g7-tree-a.log` |
| Chromium G7 proof | package/publish | 7/7 | 0 | `logs/chromium-g7-package.log` |
| Phone-width proof (T12 regressions) | tree-a | 11/11 | 0 | `logs/phone-width-tree-a.log` |
| Phone-width proof | package/publish | 11/11 | 0 | `logs/phone-width-package.log` |
| W-4 proof (T12 regressions) | tree-a | 7/7 | 0 | `logs/w4-tree-a.log` |
| W-4 proof | package/publish | 7/7 | 0 | `logs/w4-package.log` |

Headline Chromium evidence (both trees): migration verifies and cuts over;
content drains **12→18 COMPLETE** against the measured seq 13–18 page
(7,278,325 payload chars); the state record resides in IndexedDB at
**8,669,722 chars**; the legacy snapshot's SHA-256 is unchanged after
migration, drains, and a restart; no re-migration on relaunch (meta
untouched); Diagnostics shows `IndexedDB · migration S6 · storage estimate
1035880/1074777704 bytes`, Content `18/18 COMPLETE`, Bindings `1799/1799`,
Shelf pending `7`; the library renders 7 books and a bound segment reaches
the audio pipeline. Forced onto the legacy path, the same drain stops at
cursor 12 with reason **`storage_quota_exceeded`** and diag
`{class: storage_quota_exceeded, stage: apply, errorName:
QuotaExceededError, seqFrom: 13, seqTo: 18, pagePayloadChars: 7278325,
recordChars: 8669485}` — the G7 mislabel is closed. With the IDB deleted in
steady state, Connect fails closed with `storage_unavailable` and the stale
legacy library is never rendered.

§9 matrix coverage: T1 → G2; T2 → G1 + G15/G16 diag assertions; T3 → G3;
T4 → G6a–G6e + G7; T5 → G9; T6 → G5, G11, G12, G13; T7 → Chromium P0–P4;
T8 → G15 (Node) + Chromium P6 (real Chromium quota); T9 → G8 (R1 abort
bit-identical legacy) + design §7 (post-cutover rollback is forward-fix /
attended paths only — no code path implements a stale rollback); T10 →
package static checks; T11 → G10 (Node) + Chromium P5; T12 → phone-width +
W-4 batteries.

Harness adaptations (disclosed): the UI3-era `w4-proof` and
`phone-width-proof` read/mutated the state record in localStorage — the
very assumption this package changes. Their record accessors now read the
authoritative backend (IndexedDB post-cutover), and the phone-width H3a
seed writes confirmed bytes into the IDB record instead of the frozen
legacy snapshot (writing the legacy copy post-cutover is, by design, a
legacy-writer act). No assertion was weakened. One environmental note: a
mid-session battery interruption was traced to this VM's `/tmp` tmpfs
filling with abandoned headless-Chrome profiles (512 MB, 100%); after
cleanup every battery passes deterministically on both trees.

## Rowan condition compliance (comment 6506670300)

| # | Condition | Status | Evidence |
|---|---|---|---|
| (a) | Async IDB commit honors the single-writer epoch guard | ✅ | G17: guard flips mid-flight (delayed IDB commit) → refusal propagates unlabelled, nothing lands; concurrent writers never tear the record. Classifier explicitly never re-labels `ownership_*` refusals. |
| (b) | Marker-write failure + every crash boundary tested | ✅ | G7 (marker failure → legacy, resumable remnant, cutover next launch); G6a–G6e (crash after S1, after S3/S4, steady-state relaunch, S3 transaction abort atomicity, aborted set). |
| (c) | Shell state refreshed after all relevant mutations | ✅ | Snapshot refresh at boot, post-construction, post-drain, on data-screen entry (`show()`), after playback selection (`selectSegment`), and before Diagnostics; W-4 byte-confirmation rows pass against the IDB backend. |
| (d) | Legacy-writer tripwire preserved; no stale rollback | ✅ | G9 (post-cutover legacy mutation → `legacy_writer_detected` stop, IDB untouched); §7 R2: no code path serves or restores the legacy snapshot post-cutover (G10, Chromium P5). |
| (e) | IDB unavailable, evicted, blocked, full tested | ✅ | G5 (open failure), G12 (blocked open, bounded wait), G13 (versionchange), G11 + G6d (quota/full), G10 + Chromium P5 (eviction). |
| (f) | Shelf + preferences verified untouched | ✅ | G3/G18 (raw strings byte-identical; guard hashes; tamper detection); Chromium P1 (Shelf pending still 7 after a 409 flush). |
| (g) | All pending outbox records preserved | ✅ | G3/G14 (outbox length/status counts, `commandCounter` 41, journals intact across migration + full drain); Chromium P2 (pending command still pending after Connect against a 404 commands endpoint). |
| (h) | Full-size browser sync 12→18 passes | ✅ | Chromium P1–P4 on both trees at the measured production sizes. |
| (i) | Attended device checks are later gates; app can report the classified error on device | ✅ (build side) | Diagnostics State storage row + classified drain reasons ship in the candidate (§3.4 surface); device checks themselves are NOT part of this build and remain Julie-gated. |
| (j) | No text or secrets in any evidence | ✅ | All fixtures are synthetic (`Synthetic book-*`, filler pads); diagnostics emit only the §3.3 allowlist (sizes, cursors, seq ranges, error names/codes); no tokens, titles, or segment text in any log or in this report. |

## Known limitations / unproven (by design, not smoothed over)

- **WKWebView's exact localStorage quota and IndexedDB eviction behavior
  on Julie's iOS 27 devices are unmeasured** (design §12). The design is
  threshold-independent; the conclusive measurements are the attended
  iPhone/iPad gates, which remain separate and unstarted.
- **Two-tab contention** is proven at the storage layer (epoch guard +
  transaction serialization, G17) and by the tripwire (G9); two real
  browser tabs racing the Web Lock were not exercised — the lock itself is
  the unchanged accepted ownership module.
- The Chromium proofs use headless Chromium 155 on this VM, not Safari/
  WKWebView; storage semantics (transactions, quota error names) are
  standards-based but engine differences on device remain for the
  attended gates to confirm.
- Rollback from ui-pkg-4 post-cutover is **not** a silent return to
  ui-pkg-3 (design §7 R2, accepted at build approval): forward-fix,
  attended export-back (expected to refuse — it cannot fit), or attended
  reset-and-resync are the sanctioned paths. Pre-cutover abandonment (R1)
  is a clean, proven rollback (G8).

## Pin

- Repo/branch: `jedavid33-design/opal-reader`, branch `ui1-review`.
- Parent: `a3152e373ca6ba6ecd1ae7416ad830d8e9b2bb9b` (the G7 design pin;
  current head at build time).
- Paths: this report at `review/g7-build-report.md`; the candidate
  artifact at `review/ui-pkg-4/` (`BUILD-REPORT.md`,
  `PACKAGE-MANIFEST.json`, `MANIFEST.json`, `base-index.html`,
  `delta/` — the 11 delta files at final paths, `tests/` — 9 test
  sources, `logs/` — 13 preserved logs incl. exit codes). The full
  publish tree is reproducible locally from `~/workspace/ui4-build/`
  (`make-src.py` → `assemble.py` → `package-assemble.py`) and is
  identified by the publish digest above; read-back byte-identity of
  the report and `PACKAGE-MANIFEST.json` was verified after the pin.

## Local tree

`~/workspace/ui4-build/` — `base/` (ui-pkg-3), `src/` (delta sources +
`make-src.py` generator), `tree-a/` + `tree-b/` (assembled, byte-identical),
`package/` (`publish/` 73 paths, `delta/` 11 paths, `PACKAGE-MANIFEST.json`,
`assemble-results.txt`), `tests/` (sources + `logs/` + `run-exit-codes.json`),
`review-artifact/`, this report also at `~/workspace/ui4-build/BUILD-REPORT.md`.
Evidence logs live under `~/workspace/ui4-build/tests/logs/` (the location
chosen for deliverable 4).

**Next gates (not this build):** Rowan source review of this pin → Julie's
publication approval → attended iPhone check → attended iPad check → D6
resumes only on Julie's fresh arming approval.
