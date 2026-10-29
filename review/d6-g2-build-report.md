# D6 G2 Build Report — enrichment build under Rowan's DESIGN PASS WITH BUILD CONDITIONS (Oct 29, 2026)

Built under Julie's G2 approval (board comment 6504868252,
`JULIE-APPROVAL:D6-G2-20261029`) and Rowan's combined-design review
(comment 6504846855, DESIGN PASS WITH BUILD CONDITIONS). **Repo-only:
no deployment, no production write, no SyncPush against production,
no seed, no arming, no generation, no spend, no secret touched.**
Production contact: none at all in this build — the tooling's
read-only snapshot path is exercised against local harness entities;
the frozen-corpus path runs over the local P8 snapshot files
(sizes/digests only). All work in `~/workspace/d6-build/impl/`;
evidence in `impl/logs/g2/`. The parked Forever Pucked Ch 3 job is
untouched (parked-inertness suite green, §5).

**Headline: all four items built; Rowan's condition 1 (the payload
test) PASSES with wide margin — the feared ~7 MB book does not
exist.** The design estimated per-book enriched payloads at
1.6–7.2 MB from source *file* sizes; the actual enriched entities,
built by the migration's own transform + the G2 tooling from the
manifest-verified frozen records, top out at **1,440,764 bytes**
(In Her Own League), and all seven together total **7,389,581
bytes** — the ~40 MB aggregate sync-history concern in Rowan's Q1
answer resolves to ~7.4 MB of text across the whole library (the
source files carry large v1 apparatus beyond segment text). The
largest book's full SyncPush, command envelope included, applies
whole through the real coordinator path, read-back byte-identical.

## 1. Item 1 FIRST — the largest-book SyncPush payload test

Suite: `tests/d6-syncpush-payload.test.mjs` (3 tests, all pass;
log `logs/g2/d6-syncpush-payload.log`). Method: every book's
enriched entity was constructed from the frozen source (tooling
manifest verification → `transformBook` live shape → G2 enrichment
construction, digest gate 2,610/2,610 by lineage, asserted per
book), serialized, and ranked by **full command-envelope** size:

| Book | Enriched entity (bytes) | Envelope (bytes) | text / speechText writes | defaultVoice |
|---|---|---|---|---|
| In Her Own League | **1,440,764** | **1,441,029** | 203 / 203 | source-null-noop |
| Pucked | 1,330,538 | 1,330,803 | 654 / 654 | source-null-noop |
| Pucked Over | 1,280,560 | 1,280,825 | 510 / 510 | source-null-noop |
| Forever Pucked | 1,144,602 | 1,144,867 | 407 / 407 | restore |
| Pucked Up | 1,102,169 | 1,102,434 | 475 / 475 | restore |
| The Goal | 654,043 | 654,308 | 209 / 0 | source-null-noop |
| Finding Home | 436,905 | 437,170 | 152 / 152 | restore |
| **Aggregate** | **7,389,581** | — | 2,610 / 2,401 | 3 restores |

The largest (In Her Own League) was then pushed through the REAL
SyncPush path (`handleCommand` → `_syncPush` → `_upsertSyncEntity`)
on the harness, against the pre-enrichment entity at revision 1:

- **Applied whole**, one change, CAS base 1 → revision 2, in
  **~40 ms** in-process (heap delta not meaningful under GC; no
  memory posture concern at 1.44 MB). No platform limit is
  approached: the envelope is ~5.5× under even the design's own
  7.2 MB upper estimate and >20× under the smallest per-call
  payload ceiling in the delivery chain.
- **Read-back byte-identical**: the sync snapshot's entity digests
  to the planned entity's SHA-256, and the read-back text rollup
  equals the plan rollup (the §1.3 post-write check in miniature).
- **sync_changes growth: exactly +1 row**, whose payload is the
  whole enriched entity (1,440,764 bytes) — the append-only history
  cost of one book, and the device-pull unit: a device catching up
  across this book downloads the entity once.
- **CAS discipline at this size**: the same envelope with a stale
  baseRevision returns `conflict` and writes nothing.

No limit was reached, so per Rowan's condition the enrichment
mechanics stand as designed — per-book SyncPush, no chunking path
invented or needed.

## 2. Item 2 — work-source corrections

`worker/generation/d6-work-source.mjs`, new SHA-256
`8fa929b2d283084542d9dc76c1e75278d9f5ea4ed7a8d94540e55bef45e05006`.

- **Cast read: `cast` first, `povs` fallback** — mirroring the
  adapter's dual-read with the live key taking precedence (the work
  source consumes only coordinator entities in production).
- **Default-voice style direction**: `styleDirection` now resolves
  cast voice → **fallback (defaultVoice)** → segment → `""`,
  reading the fallback's recorded `style_direction` — the title
  segment no longer synthesizes with an empty style.
- **Named companion correction, flagged openly** (discovered by
  this build's own §2.3 test): the legacy fallback consulted
  `defaultVoice` even when a segment NAMED a speaker the cast
  cannot resolve — silently substituting the book default for a
  named voice. The source now returns `unmapped_pov` for a
  named-but-unresolvable pov, exactly as design §2.3's proof
  obligations name it and as the adapter's Correction-2 chain
  already holds; the defaultVoice fallback applies only when no
  speaker is named. No chapter-pov fallback was added (deliberate
  non-fix, §2.2 — entities carry no chapter pov).

New dedicated suite `tests/d6-work-source.test.mjs` (**10/10
pass**): exact text + fingerprint; by-name and by-id resolution;
the defaultVoice title segment fixtured on `67b819e1…`'s live
shape (sole segment, no pov, defaultVoice present) with voice,
provider, AND style from the fallback; the §2.2 style chain;
removed-provider disposition with the recorded mapping NAMED and
zero synthesis surface; unmapped pov; `no_content` for a textless
segment / unknown occurrence / missing entity / unknown job; the
title segment still unmapped when defaultVoice is absent (the
pre-enrichment live truth); the `povs`-keyed regression guard
resolving identically; and **the full text-to-voice executor
path** (harness → SubmitJob → grant → D6 executor → fake
provider): the title segment and a cast-named segment synthesize
with the exact texts/voices/styles and both bindings land through
the atomic commit. Neighboring suites stay green
(`d6-executor-fi` 21/21, `d6-integration` 3/3).

## 3. Item 3 — seed hardening

Rowan's Q3 terms: reuse the existing migration operator credential
— provided client-alone cannot seed, the admitted stamp cannot be
forged through public routing, and unset/equal credentials fail
closed. All three are now **tested**, §3.4's matrix in the new
suite `tests/d6-seed-hardening.test.mjs` (**12/12 pass**).

- **Entry** (`worker/worker-entry-prod-d6.js`, new SHA-256
  `88c3ae106a605e18d144aad585d2ed114a5a0fe1e2503f90285bf77757e40082`):
  the seed route runs the FULL client gate chain **and** the
  existing operator admission block (503
  `migration_operator_not_configured` when the operator secret is
  unset or equals the access token; 403
  `migration_operator_required` when the header does not match).
  Admission stamps `x-opalreader-operator-admitted` on the
  forward, overwritten unconditionally; the DO class gate for
  `/internal/d6/seed-storage` additionally requires the stamp
  `"1"` — the internal header alone no longer suffices.
- **Service** (`worker/generation/service.mjs`, new SHA-256
  `f9d32053724aba0845b46adcd79ba19d42f5ef73fa44c6b6389646510722492c`):
  `seedStorageBase` is now async and **figureless** — a body
  presenting `baseBytes`/`objectCount` is refused
  `caller_figures_refused`. Fences in order: HALT (verbatim from
  Correction 2, missing flag fails closed) → figureless →
  expected-base configured (else `seed_expected_base_not_configured`)
  → **worker recount** via the R2 binding's `list()`, fully
  paginated at 1,000/page, refusing errored or incomplete pages
  (`recount_failed`) → **zero-tolerance compare** against the
  expected base (else `recount_mismatch`, both figures reported,
  nothing written). On equality the store seeds the bucket's OWN
  figures with provenance source `"worker-recount"`; Correction
  2's store semantics (idempotence, provenance, shape throws) are
  unchanged — `genstore.mjs` is byte-identical to Correction 2.
- **The expected base** is pinned in `gen-constants.mjs` (new
  SHA-256 `6922ad7402bcc369bbd48b12d859ccdf93964dbd94ab593ce126aa7af0a2e4ee`)
  as `RECORDED_STORAGE_BASE` (5,736,481,302 bytes / 5,942 objects —
  the twice-verified Oct 29 recount), wired by the entry's
  `d6Service` together with `recountBucket: env.OPALREADER_STORAGE`.
- **Fail-closed matrix proven**: client-only → 403; wrong operator
  → 403; operator unset → 503; operator == client token → 503;
  forged stamp header through public routing → 403; direct
  internal call without/with `"0"` stamp → 403; figures through
  the full chain → `caller_figures_refused`; one byte of bucket
  drift → `recount_mismatch`, no row; list throw / page missing
  its truncated flag / truncated-without-cursor → `recount_failed`;
  exact match across forced multi-page lists seeds the bucket's
  own totals and a re-seed is idempotent.
- The two Correction-2 seed tests that exercised the superseded
  caller-figures contract were **amended in place** to the G2
  contract (halt fence end-to-end retained; provenance source is
  now `"worker-recount"`), with the amendment noted in the suite
  header. `CONTRACTS.md` and the deploy spec's arming
  precondition 1 now describe the hardened mechanism (spec SHA-256
  `e7a37cfeef9b64c7517f233d8b47827a5a91879ab4c01b4b7efbbd755c98ea56`;
  GENERATION_HALT still `"1"`, no binding/var/topology change).

## 4. Item 4 — enrichment tooling (local only)

`tools/d6-enrichment.mjs` (new). The runner the G5 dry run and the
gated G7 execution will drive:

- `loadSourceBooks` — manifest verification at load: per-file
  SHA-256 + byte length against `snapshot-manifest.json` (books
  entries AND `file_hashes`), plus the corpus-digest pin;
  any drift throws `source_manifest_mismatch` before a single
  record is used.
- `planBookEnrichment` — per book: ID-set equality against the
  live entity; **the mandatory pre-write identity gate**
  (transform-formula digest recomputed per segment vs the live
  `textSha256`; mismatch hard-stops the book, named); field
  classification absent / present-and-equal / **present-and-
  different (hard stop, never overwritten)** for `text`,
  `speechText` (only where the source carries the field — The
  Goal gets none, source truth), and `defaultVoice` (restore only
  where sourced-and-absent; source-null recorded as a no-op);
  construction = live entity + whitelisted additions only, proven
  by `structuralDiff` + `isWhitelistedDiff` (any other changed
  path throws a construction-bug error); per-book text rollup
  digest computed from source and self-checked against the built
  entity; the SyncPush command (per-book CAS `baseRevision`,
  command ID `enrichment-<runId>-<bookId>`) built **only when
  something changes** — an already-matching book builds none.
- `dryRunEnrichment` — plans all books against a caller-supplied
  snapshot (`snapshotFromCoord` is the read surface) and returns
  the evidence manifest: counts, digests, dispositions, hard
  stops — **no payloads, no text**.
- `captureParkedFingerprint` — the parked job's structural
  fingerprint (job fields + all occurrence rows, digested) from
  the coordinator's own tables, read-only.
- `executeEnrichmentPlan` — the §1.7 posture encoded: sequential
  pushes, parked fingerprint verified before the first push and
  after every applied push, and the FIRST non-applied outcome
  stops the run returning {completed, stoppedAt, reason,
  remaining, action: "none — fresh decision required"}. It
  contains no roll-forward and no restore path.

Suite `tests/d6-enrichment-tooling.test.mjs` (**6/6 pass**),
synthetic books on the harness: manifest tamper + wrong corpus
digest fail closed; dry run checks N/N digests, plans
whitelist-only diffs with run-scoped command IDs, and **writes
nothing** (revisions and sync history unmoved); execution lands
exactly the whitelisted additions (post-hoc structural diff),
bumps each book exactly one revision, read-back rollups equal
plan rollups, and the parked fingerprint is identical after; a
second dry run plans zero commands and execution skips all books
as no-ops; all three hard-stop shapes are named and unwritten;
and the mid-run posture test: book 2's CAS is staled after
planning → book 1 completes and STANDS, book 2's conflict stops
the run, book 3 is untouched, no rollback is attempted.

## 5. Batteries (final tree; logs in `impl/logs/g2/`)

- **D6 suites: 118/118 tests pass, all exit 0** — the 87 from
  Correction 2 (its two seed tests as amended) plus 31 new:
  syncpush-payload 3, work-source 10, seed-hardening 12,
  enrichment-tooling 6. Parked-inertness re-proven on the final
  tree (the parked job stays byte-identical and unenumerated).
- **All 111 test files rerun individually: 89 exit 0; 22 exit 1 —
  the failing SET is byte-identical to Correction 1's and
  Correction 2's** (verified by diff), every one an
  environment/fixture failure, **zero assertion failures**:
  20 × `ENOENT` for legacy v1 client entry fixtures (`app-2XX.js`)
  never copied into this tree, and 2 × git-required tooling suites
  (`p8-d3-prod-envelope`, `p8-upload-envelope` — the impl tree is
  not a git checkout). Per the D5 pristine evidence, those 22 pass
  in the pristine source-of-record checkout; nothing in this build
  touches any file they load.
- **Client batteries — all six exit 0** on the untouched client
  tree: unit · cast census · Chromium **14/14** · phone-width ·
  W-4 · gen-client (Batch still unselectable).
- Frozen Shelf bridge re-verified: `shelf-bridge.js` SHA-256
  `bc0a5879fbf4a6f455170ead8e0fbe1aa19d82126df4eb631bd0ebad9112ec8e`.

## 6. Deploy-delta statement

Against the deployed build (worker etag `f644346c…`, artifact
`31ed9e5b…`), the tree now differs in **exactly eight deployed
modules plus the deploy spec's text** — Correction 2's six (the
entry and service further amended at G2) plus two G2 additions:

| Deployed part | State |
|---|---|
| `v2/generation/content-plane-adapter.mjs` | Correction 2 (unchanged at G2), SHA `51c177dd…` |
| `v2/generation/proofs.mjs` | Correction 2 (unchanged at G2), SHA `e7571e11…` |
| `v2/generation/gen-schema.mjs` | Correction 2 (unchanged at G2), SHA `d7ae4936…` |
| `v2/generation/genstore.mjs` | Correction 2 (unchanged at G2), SHA `2e1eb5bd…` |
| `v2/generation/service.mjs` | Correction 2 + **G2 seed hardening**, SHA `f9d32053…` |
| `v2/worker-entry-prod-d6.js` | Correction 2 + **G2 operator fence**, SHA `88c3ae10…` |
| `v2/generation/gen-constants.mjs` | **G2**: `RECORDED_STORAGE_BASE` pin added, SHA `6922ad74…` |
| `v2/generation/d6-work-source.mjs` | **G2**: cast-first read + style chain + named-unmapped line, SHA `8fa929b2…` |
| `worker/p8/deploy-spec-prod-d6.json` (config) | Arming precondition 1 names the hardened seed mechanism; no binding/var/topology change; GENERATION_HALT still `"1"` |

**`worker/coordinator.mjs` is NOT changed** (SHA-256
`c31359ae87cf0271c2186a579e6540461089e0ffaa181e00c732ceed649d8eb3`,
the deployed bytes) — the pinned two-hunk gated D6 diff stands.
**The client delta is zero.** Repo-only, not deployed:
`tools/d6-enrichment.mjs`, the four new/amended test suites,
`CONTRACTS.md`, and `impl/logs/g2/`.

## 7. What did not change; what remains gated

The coordinator and its gated hunks; the executor, grant guards,
eligible-set logic, policy split, and settings CAS; the adapter and
proofs (Correction 2 stands); the client in any byte; the parked
Ch 3 job; the frozen Shelf bridge; production in any way. The seed
route remains inert-by-state: it can act only while
`GENERATION_HALT` is `"1"`, behind both credentials, and the
enrichment tooling has never been pointed at production.

Next gates, unchanged from the design's §5 sequence: **G3** —
Rowan source review of this delta; **G4** — Julie's deploy approval
+ the halted deployment of Correction 2 + G2 hardening as ONE
upload; **G5** — the enrichment dry run (read-only) executed and
filed; **G6/G7** — Julie's enrichment-write approval naming the
verified plan, then execution (proof 3 passes on its post-checks);
**G8** — arming sub-step 0 re-run (proofs → operator-invoked seed
→ CAS → routing → halt flip → delivery last); **G9/G10** — fresh
arming approval, then the smoke.
