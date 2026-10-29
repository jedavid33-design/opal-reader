# D6 Correction 2 Report — response to the arming sub-step 0 findings (Oct 29, 2026)

Built under Julie's explicit repo-only BUILD Go (Oct 29, 2026) for the
four findings in `~/workspace/d6-build/arming-evidence/ARMING-REPORT.md`.
**No deployment, no production mutation, no secret read or set, no
spend, no board contact.** The only production contact was the
acceptance proof re-run: read-only GET snapshots via the client
connector (content, bindings, the parked job view), exactly the
arming run's own method, feeding the corrected code locally.
GENERATION_HALT remains `"1"` in the deploy spec; the parked Forever
Pucked Ch 3 job is untouched (parked-inertness re-proven below). All
work is in the existing build tree, `~/workspace/d6-build/impl/`; new
evidence in `impl/logs/correction2/` and
`~/workspace/d6-build/arming-evidence/proofs-production-correction2.json`.

**Headline:** fixes 1–4 are built, regression-covered on live-shaped
fixtures, and proven against the live plane: proofs 1, 2, 4, 5 PASS
with the required numbers, and the eligible split is exactly
688 + 99. **Proof 3 stands at ONE named offender** — not a code
defect: the migration transform dropped `book.defaultVoice` from the
content plane, and exactly one unbound occurrence in the corpus (a
25-char, single-segment title chapter in Pucked Up) resolves only
through it. No legitimate code fix exists inside a repo-only build
(§5 gives the full chain and the gated data fix that closes it).
Also flagged for Rowan's disposition, §5.2: the D6 work source reads
the cast only under `povs`; live entities carry it under `cast`.

## 1. What changed

### 1.1 Fix 1 — POV name→id mapping (`worker/generation/content-plane-adapter.mjs`)

New SHA-256 `51c177dd8d2c4c85dbd1ce19180f60f70b3d037c53081be17c9762f93e7b8f38`.

- New `resolvePovValue(value, cast)`: an exact **id** match wins;
  else an exact **name** match against **exactly one** cast entry
  maps to that entry's id; a name matching multiple entries or none
  returns **null** — never a guess.
- `resolvePovKey` keeps the original chain shape: segment pov, else
  chapter pov (each through `resolvePovValue`), else — only when
  **neither names a speaker** — the book default voice matched back
  to a cast entry by (provider, voice_id). A segment that NAMES an
  unresolvable speaker returns null rather than being silently
  reassigned to the chapter/default voice (that would be a
  substitution; the POV proof exists to name exactly these).
  Verified against the frozen census before building: of 811
  unbound occurrences, 810 resolve by unique segment-name match, 1
  by the default-voice step, 0 by chapter name, 0 unresolved, and
  **no book's cast contains a duplicate name** — so the conservative
  chain and the census fixture's chain agree on every occurrence
  the live plane can resolve.
- The plane segment now also carries `blockRootId` (passthrough,
  for fix 4). `CONTRACTS.md` records the resolution + plane shape.

### 1.2 Fix 2 — charCountOf fallback (same file)

`speechChars` counts only when a number **> 0** (a numeric 0 is an
absent count, not a measured one — The Goal's live shape); else
`textChars` when numeric; else the text length. One condition
changed; the Goal's 99 completeness offenders drop to zero (§4).

### 1.3 Fix 3 — the fenced storage-seed path

The seed now has a production invocation path, in D6-owned files
only. **Design choice (documented in CONTRACTS.md): an internal
route, not a coordinator command type.** A `d6.seedStorageBase`
command would have required editing `coordinator.mjs`
(COMMAND_TYPES + `_applyCommand`) — the copied-source file whose D6
delta is pinned to exactly two flag-gated hunks — and on the
`/v2/commands` path the coordinator's env carries no D6 marker, so
a command handler there could not distinguish this surface from
staging's. The route lives entirely in the D6 entry + generation
modules and is fenced equivalently to the existing D6 routes.

- **Route**: public `POST /v2/d6-seed-storage` (in
  `worker/worker-entry-prod-d6.js`, new SHA-256
  `0d9ba35ffc1bea13ac44dfcc6bd558e67a82680e4e9fc9f33fad6e957b726166`)
  passes the full production gate chain (scope config → scope
  header → client token → instance header), then forwards to the
  internal `POST /internal/d6/seed-storage`; the class fetch
  requires the internal header + production scope, exactly like
  `/internal/d6/intent` and `/internal/d6/plan`.
- **Service fence** (`generation/service.mjs`, new SHA-256
  `cf3385e80b6918d4ab0cb63829fb539e8d7f34e5b00aa5b8a68395d696da75de`):
  `seedStorageBase({baseBytes, objectCount?, recountedAt?, source?})`
  refuses with `generation_not_halted` unless `env.GENERATION_HALT`
  is exactly `"1"` (a missing flag fails closed), then refuses
  `seed_shape` unless the figures are non-negative safe integers.
  The executor/driver never call it — seeding happens only when the
  operator calls the route with a fresh recount in hand.
- **Store** (`generation/genstore.mjs`, new SHA-256
  `2e1eb5bd2b53fce4b58eb1b06f737326c385f1d49ba612e91a24f3ab43f311bb`):
  `seedStorageBase` + `storageSeedState`. Same-values re-seed is
  idempotent (writes nothing, history and `updated_at` stand);
  a different-values re-seed replaces the base and **appends a
  provenance entry carrying the previous values** — a silent
  overwrite is impossible by construction. `setStorageBaseBytes`
  and `storageAccounting()` are unchanged; `ensureSchema()` now
  delegates to gen-schema's `ensureGenSchema` so every path evolves
  the tables the same way.
- **Schema evolution** (`generation/gen-schema.mjs`, new SHA-256
  `d7ae4936b11fe0d01c9ff8a6e1ccbb7364541ecad7d012b8fc3e712a453aacc5`):
  `d6_storage_state` gains `object_count`, `seeded_at`,
  `provenance_json`. Fresh stores are born with them via the
  CREATE; **pre-existing stores — the deployed build's 3-column
  table — gain them through guarded, idempotent ALTERs** in
  `ensureGenSchema`, swallowing only SQLite's duplicate-column
  error (any other failure rethrows). This is the evolution form
  Correction 1's schema comment prescribed (guarded ALTER beside
  the DDL, never a table rebuild); it is read-free like the rest
  of the bootstrap, and rows/values are never touched (proven in
  §2 against the deployed DDL verbatim).
- **Deploy spec** (`worker/p8/deploy-spec-prod-d6.json`, SHA-256
  `374261df…` → `286eccef…`): arming precondition 1 now names the
  seed mechanism (route + halt fence + provenance). No binding,
  var, topology, or migration value changed; GENERATION_HALT is
  still `"1"`. (The file was re-serialized by the JSON edit in the
  same 2-space style; the only value change is the appended clause
  — the C1 assertions on its substrings still pass.)

### 1.4 Fix 4 — proof-5 tightening (`worker/generation/proofs.mjs`)

New SHA-256 `e7571e1181a5e0e558ff2d7b524f620c260a601289eb66bcf73c43bce2910d38`.

- **Anchor = the blockRootId lineage ROOT**: chains are walked to
  the self-referential root (or the target other block-rooted
  occurrences chain to); a unique root wins, then a record-carrying
  root, then structural order. Planes without lineage ids (the
  census fixture) fall back to the occurrence carrying the
  POLICY_BLOCK failure record, then the first blocked segment in
  structural order — deterministic, never the old scan-order "last
  wins" that named `16e860aa…` on live data.
- **Two-sided parked accounting**: the report gains
  `parkedAccounting { censusParkedCount, liveParkedCount,
  liveOnlyRows, censusOnlyRows }`, and every row gains
  `liveParkedDisposition`. A live-only row is NAMED with both
  sides' dispositions (idx 26: live `parked-pending` vs census
  `absent`) and its exclusion on both accounts stated. Naming is
  reportage, not an offender — the proof still passes (§4).
- One latent trap fixed on the way: the blocked test was
  `!!(s.policyBlockRecord ?? s.blockHistory)` — a boolean
  `policyBlockRecord: false` masked a true `blockHistory`. It is
  now `||` (record OR lineage), matching the fixture header's own
  definitions.

## 2. Regression coverage — `tests/d6-correction2.test.mjs` (new, 10 tests)

Fixtures mirror the LIVE shapes (the root lesson of sub-step 0):

- **Adapter**: cast entries keyed by UUID ids with segment/chapter
  `pov` as NAMES — unique name → id; chapter-level name pov; the
  default-voice (provider, voice_id) match when the entity carries
  the field, and no-match → unresolved. **Duplicate-name cast** →
  null, and the POV proof names exactly the unresolved occurrences;
  a segment naming an unknown speaker is NOT reassigned to the
  chapter voice. **Digest equality**: name-shaped and id-shaped
  planes over the same book produce identical eligible sets.
- **Goal shape**: `speechChars: 0` + real `textChars` on every
  segment (positive speechChars still wins); the removed-provider
  occurrence named by name dispositions **voice_prompt**, never
  eligible.
- **Proof 5**: a lineage-shaped Ch 3 (self-referential root, two
  children, and a LATER record-carrying segment as the "last wins"
  trap) → the anchor is the root; the record-fallback shape →
  the record carrier; live entries = census + the idx-26 row →
  proof passes, accounting reads 26 vs 27, the live-only row is
  named with both dispositions.
- **Seed**: schema evolution over the deployed 3-column DDL with a
  live row (columns added, row byte-preserved, second run a no-op);
  store semantics (first seed / same-values idempotence — row
  identical including `updated_at` / different-values provenance
  with previous values; shape throws); the service halt + shape
  fences (refusals write nothing; a missing halt flag fails
  closed); and the **real D6 entry end-to-end**: 401 without a
  token, 403 `production_scope_required`, 403
  `production_instance_required`, 403 `internal_only` at the class
  gate — gate refusals never reach the store — then an applied
  seed while halted with provenance recorded, and a
  `generation_not_halted` refusal (no row) while unhalted.

## 3. Retest results (final corrected tree; logs in `impl/logs/correction2/`)

- **D6 suites: 87/87 tests PASS, all exit 0** — the 11 build +
  correction suites (77 tests) **plus the new correction-2 suite
  (10)**. Parked-inertness re-proven on the corrected tree (the
  parked Ch 3 job stays byte-identical and unenumerated); the C2
  continuity proof passes unchanged (the schema evolution adds no
  table and rewrites no pre-existing row; the 8 d6 tables still
  appear empty at bootstrap — a seed is written only through the
  fenced route).
- **All 107 test files rerun individually** (per-file logs +
  `worker-suites-summary.txt`): **85 files exit 0; 22 exit 1 — the
  failing SET is byte-identical to Correction 1's, every one an
  environment/fixture failure, zero assertion failures**:
  20 × `ENOENT` for legacy v1 client entry fixtures
  (`app-2XX.js`) never copied into this tree, and 2 × git-required
  tooling suites (`p8-d3-prod-envelope`, `p8-upload-envelope` — the
  impl tree is not a git checkout). Per the D5 pristine evidence
  carried into Step D attempt 2, those 22 pass in the pristine
  source-of-record checkout; nothing in this correction touches
  any file they load.
- **Client batteries** — all six on the (unchanged) corrected
  `client-package` tree, **all exit 0**: unit **13/13** · cast
  census **PASS** · Chromium **14/14** · phone-width **11/11** ·
  W-4 **7/7** · gen-client **6/6** (Batch still unselectable,
  exactly one correctly-shaped SubmitJob, Ch 3 excluded).
- Frozen Shelf bridge re-verified in the final trees:
  `modules/vendor/client/shelf-bridge.js` SHA-256
  `bc0a5879fbf4a6f455170ead8e0fbe1aa19d82126df4eb631bd0ebad9112ec8e`
  in both `client/` and `client-package/` — byte-identical to the
  frozen value.

## 4. Acceptance evidence — the five proofs re-run on the live plane

Method identical to the arming run's (read-only GET snapshots →
real `planeFromCoordinator` + `runProofs` vs the frozen census):
`~/workspace/d6-build/arming-evidence/run-proofs-correction2.mjs`;
full structural output in `proofs-production-correction2.json`
(ids/counts/dispositions/digests only — no book text). The run's
preflight verifies the bindings mapping at id level (per-book bound
overlap with the census exact; 1,799 bound ids; note the bindings
entity keys are composite `"<bookId>:<occurrenceId>"`). Content
watermark 11, bindings watermark 1,799 — the same state the arming
run read.

| # | Proof | Result |
|---|-------|--------|
| 1 | Completeness | **PASS** — 0 offenders (was 99, all The Goal) |
| 2 | ID set equality | **PASS** — plane 2,610 = census 2,610; zero diff either direction |
| 3 | POV resolution | **1 offender** — `67b819e1-090f-46f2-b72f-e5ceff3b4d6e` only (was 811); §5 |
| 4 | No silent skips | **PASS** — 2,610 enumerated exactly once, all dispositioned |
| 5 | Ch 3 reconciliation | **PASS** — 27 rows; anchor `6bd358a7-f590-4c49-8c07-dacf558c2721` (the lineage root); absent `2a85f74f-353d-4c25-a86a-4a4db392868b`; accounting 26 census vs 27 live, the one live-only row named (live `parked-pending`, census `absent`) |

Disposition tallies on the corrected live plane: **eligible 688 +
voice_prompt 99** across all books (The Goal's 99 are voice_prompt,
as required); **Forever Pucked eligible 333** (357 unbound − 24
live parked rows; excluded_ch3 0 on the live shape, since idx 26
is a live parked entry). Eligible-set digests vs the arming run:
**identical for six books; The Goal's alone changed** — exactly
the 99 eligible→voice_prompt corrections, nothing else moved.

## 5. The fifth finding — a migration data gap, not a code defect

### 5.1 `defaultVoice` never reached the content plane

Proof 3's one remaining offender is Pucked Up's opening title
segment (`67b819e1…`, 25 chars): the **sole segment of its
chapter**, carrying no segment pov, in a chapter carrying no
chapter pov. The census resolves it to Miller through the book
`defaultVoice` (Gemini Algenib = Miller's cast voice). But
`worker/migration/transform.mjs` builds the content entity as
`{bookId, title, author, cast, chapters}` — **`book.defaultVoice`
is dropped**, and the live check confirms it: **none of the seven
live content entities carries a defaultVoice** (the client cast
census battery records the same fact: "content plane carries
cast = povs verbatim, no defaultVoice").

Consequences, stated plainly:

- The adapter's default-voice fallback (fix 1, kept and
  regression-pinned in §2) is correct and fires the moment the
  entity carries the field; on today's plane there is nothing for
  it to read. The segment's voice is **not derivable from live
  production data** — no other sync family carries book data, and
  the cast carries no default marker.
- No honest code fix exists inside this build: a "first cast
  entry" heuristic would guess (for Forever Pucked and Finding
  Home the census default matches **no** cast entry at all, so
  the heuristic is not even the data's semantics), and writing
  production data is outside a repo-only build by definition.
- The accounting is unaffected: the builder dispositions an
  unresolved-POV occurrence as eligible (eligible-set rule 5), so
  the split already reads 688 + 99 and PU's eligible count is 8
  either way. What blocks is proof 3's gate itself — by design:
  the proof refuses to call an unresolvable voice resolved.
- **The unblock is a data fix, separately gated**: backfill each
  book's `defaultVoice` from the frozen census record into its
  coordinator content entity, through the migration's own audited
  write discipline. Its natural home is the already-planned
  **text-plane enrichment** (the live entities carry no segment
  text at all — 0 of 2,610 segments — which enrichment must
  supply before generation can run; the source book records it
  draws on carry `defaultVoice`, as the census does). After either
  lands, sub-step 0's proof 3 passes with zero offenders and **no
  further code change** — the adapter chain already ends there.

### 5.2 Adjacent observation — the D6 work source's cast key

`generation/d6-work-source.mjs` resolves the cast from
`data?.povs || []` only; live entities carry the cast under
`cast` (the transform's key, which the adapter already reads).
On today's plane this is **masked**: the same entities carry no
segment text, so the work source returns its designed
`no_content` before POV resolution matters (adapters.mjs states
the limit plainly: a migrated entity "must be enriched with the
text plane before generation is ever enabled"). The legacy work
source in `worker/host/adapters.mjs` has the same `povs`-only
read. **Neither file was changed** — the legacy source is frozen
copied source, and the D6 source's input contract should be
settled with the text-plane enrichment's entity shape, under
Rowan's disposition, rather than guessed at here. The one-line
divergence and this paragraph are the flag.

## 6. Deploy-delta statement

Against the deployed build (worker etag `f644346c…`, artifact
`31ed9e5b…`; the attempt-2 record `d2-postupload-compare.json`
verified all 26 upload parts byte-identical to this tree at deploy
time), the corrected tree differs in **exactly six deployed
modules plus the deploy spec's text**:

| Deployed part | Change |
|---|---|
| `v2/generation/content-plane-adapter.mjs` | Fixes 1 + 2; `blockRootId` passthrough (§1.1–1.2) |
| `v2/generation/proofs.mjs` | Fix 4 (§1.4) |
| `v2/generation/gen-schema.mjs` | Seed columns + guarded evolution (§1.3) |
| `v2/generation/genstore.mjs` | Seed methods; `ensureSchema` delegation (§1.3) |
| `v2/generation/service.mjs` | `seedStorageBase` (halt + shape fences) (§1.3) |
| `v2/worker-entry-prod-d6.js` | Seed route + public forward (§1.3) |
| `worker/p8/deploy-spec-prod-d6.json` (config) | Arming precondition 1 names the seed mechanism; no binding/var/topology change |

**`worker/coordinator.mjs` is NOT changed** (SHA-256
`c31359ae87cf0271c2186a579e6540461089e0ffaa181e00c732ceed649d8eb3`,
the deployed bytes) — the pinned two-hunk gated D6 diff stands
exactly as Correction 1 left it; the command-type seed design was
rejected partly to keep it so (§1.3). The other 20 deployed
modules are byte-identical. **The client delta is zero**
(gen-pkg-1 stands as Correction 1 left it; batteries re-run green
in §3). Repo-only, not deployed: `impl/CONTRACTS.md` (seed +
resolution + proof contracts), the new suite
`tests/d6-correction2.test.mjs`, and `impl/logs/correction2/`.
The genstore test double does not model the seed (no service test
exercises it; the seed is covered against the real store and the
real entry). Deploying this correction, and re-running arming
sub-step 0 against it, remain separate gates; arming itself still
requires the §5.1 data fix (or the enrichment) for proof 3.

## 7. What did not change

The coordinator and its two gated hunks; the executor, grant
guards, eligible-set logic, policy split, and settings CAS; the
client in any byte; the parked Ch 3 job; the frozen Shelf bridge;
production (nothing deployed, nothing mutated, no secret touched,
nothing spent). The seed route ships **inert**: the spec keeps
GENERATION_HALT at `"1"`, and the seed's own fence refuses to act
in any other state — deployment of this correction cannot seed,
arm, or generate anything by itself.
