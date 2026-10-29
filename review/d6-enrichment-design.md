# D6 — Combined design: text-plane enrichment, executor work-source contract, seed-authorization hardening

Drafted Oct 29, 2026, in response to Rowan's Correction 2 review
(issue #15, comment 6504699851), which requires one combined design
covering the three items below before further build/deploy gates.
**Paper only.** This document authorizes nothing: no code is changed,
no production data is written, and every step it describes is
separately gated (§5). Sources: `CORRECTION-2-REPORT.md`,
`arming-evidence/ARMING-REPORT.md`, `D6-PROPOSAL.md` §5,
`impl/CONTRACTS.md`, the impl worker sources, and a structural
inspection of the frozen dataset at `~/workspace/opal-reader-p8-data/`
(Oct 29, 2026; shapes, counts, and digests only).

**No-text rule (restated, binding on everything below):** book text is
technical data. No segment text — and no excerpt, summary, or
paraphrase of one — appears in this design, in any dry-run or
execution evidence, in any board post, or in any GitHub artifact.
Evidence carries IDs, counts, dispositions, and digests only. The one
place text exists outside the source records and the coordinator is
the enrichment run's **local** run store (§1.7), which never leaves
this workspace.

---

## Part 1 — Text-plane enrichment (the data step)

### 1.1 Authoritative source — named exactly

The source is the **frozen P8 snapshot** at
`~/workspace/opal-reader-p8-data/`, snapshot digest
`1c73c56c8005660788a93d7283faae24abcd979ce110264c5da462ea82f2dc18`
(the digest the D6 proposal §5 pins and `run/run-summary.json`
records, verdict "clean"), specifically the per-book v1 records
`books/<bookId>.json`, each pinned in `snapshot-manifest.json` by
byte length + SHA-256. **Verified at design time (Oct 29, 2026): all
seven files on disk match the manifest's SHA-256 and byte length
exactly.** The same dataset's transformed corpus (`run/corpus.json`)
is the frozen census basis for the five proofs; the enrichment draws
text from the book records, which are the pre-transform originals the
corpus was derived from — one frozen lineage, no second source.

Per-book source completeness (structural inspection, Oct 29, 2026;
"text" = the segment `text` field the executor consumes;
`speechText` = the spoken-form field):

| Book (id prefix) | Segments | `text` present | `speechText` present | Cast (`povs`) | `defaultVoice` in source |
|---|---|---|---|---|---|
| Finding Home (48019197) | 152 | 152/152 | 152/152 | 2 entries | **present** |
| Forever Pucked (5c589095) | 407 | 407/407 | 407/407 | 2 entries | **present** |
| In Her Own League (1c6bc7a6) | 203 | 203/203 | 203/203 | 4 entries | null |
| Pucked (89b2d4f1) | 654 | 654/654 | 654/654 | 2 entries | null |
| Pucked Over (21f655a2) | 510 | 510/510 | 510/510 | 2 entries | null |
| Pucked Up (067ddb04) | 475 | 475/475 | 475/475 | 2 entries | **present** |
| The Goal (f1b1e2f9) | 209 | 209/209 | **0/209** | 2 entries | null |
| **Total** | **2,610** | **2,610/2,610** | 2,401/2,610 | — | 3 of 7 books |

Prove-in-design conclusions:

- **Segment text is complete for all seven books.** Every segment in
  every book record carries a non-empty `text`. No book's source is
  incomplete for the field generation actually consumes
  (`d6-work-source` reads `segment.text` only).
- **`defaultVoice` is carried exactly where it matters.** Three book
  records carry a non-null `defaultVoice` (Finding Home, Forever
  Pucked, Pucked Up — each with provider/voice_id/name and, for FH
  and PU, style_direction). Four carry an explicit null. The design
  verified the dependency side: in the four null books, **zero**
  segments lack both a segment pov and a chapter pov, so no voice
  resolution anywhere depends on a default those books do not have.
  In the two present-and-needed books the dependency is exactly one
  segment each: Pucked Up's title segment
  `67b819e1-090f-46f2-b72f-e5ceff3b4d6e` (proof 3's offender) and one
  bound Finding Home segment. Forever Pucked's defaultVoice is
  restored for census fidelity (no segment currently depends on it).
- **The Goal's `speechText` absence is source truth, not a gap.** Its
  records carry no `speechText` field at all (v1 spoke `text`
  directly). §1.2 writes none for The Goal — fabricating a spoken
  form would be inventing data; no consumer requires it (the work
  source reads `text`; the adapter's char-count path already prefers
  the carried `speechChars`/`textChars` counts and never reaches the
  text-length fallback on this plane).
- **Cast** is carried in the source under `povs`
  (`{id, name, voice{provider, voice_id, model_id, style_direction,
  …}}`) and already sits in the live entities under `cast`, verbatim
  (the migration transform's key). Cast is therefore **not** an
  enrichment payload item; §1.2/Part 2 settle its shape question.

### 1.2 What gets written — and nothing else

For each book, the target is its single coordinator **content**
sync entity (`family = "content"`, `entityKey = bookId`). The write
adds exactly:

1. **`text`** on every segment object that lacks it — all 2,610
   segments (today: 0 present). Value: the source record's `text`
   for that occurrenceId, byte-for-byte.
2. **`speechText`** on every segment whose **source record carries
   the field** and whose entity segment lacks it — 2,401 segments.
   The Goal: none written (see §1.1).
3. **`defaultVoice`** at entity top level, **only** for the three
   books whose source record carries a non-null value and whose
   entity lacks the field (today: all three lack it). Value: the
   source object verbatim. For the four null-source books, nothing
   is written — an absent field and the source's explicit null are
   the same semantic, and the write plan records that equivalence
   rather than manufacturing a field.

**Nothing else changes.** The enriched entity is constructed as:
the live entity's current data, with only the additions above. Every
pre-existing field — `occurrenceId`, `pov`, `textSha256`,
`textChars`, `speechChars`, `parentSegId`, `blockRootId`, chapter
structure and indices, `cast`, `occurrenceIds`, titles — is carried
over byte-identically, and §1.4's structural-diff check proves that
per book before any write. Untouched by construction (different
stores entirely): bindings (SQL + sync family), jobs and occurrence
rows, settings, quota, the D6 tables, R2. No IDs are created,
renamed, or removed; char counts are inputs to verification, never
recomputed-and-written.

**Cast shape decision (interacts with Part 2): the data is left
as-is.** Live entities keep `cast`; the source's `povs` is not
written into entities under either key. Justification is in Part 2,
where the consumer-side fix is specified; the short form is that
`cast` is present and correct in the data, so enrichment — whose
charter is "write only what is missing" — has nothing to do there.

### 1.3 Identity / digest discipline

- **Per-occurrence text digest.** For each segment: SHA-256 over the
  UTF-8 bytes of the source `text` (and of `speechText` where
  written, digested separately). Pre-write cross-check, free of
  charge: the live entity already carries `textSha256` per segment,
  computed by the migration transform as
  `sha256hex(speechText ?? text)`. The dry run recomputes the
  transform's exact formula from the source records and requires
  **2,610/2,610 equality with the live entity's carried digests** —
  this proves, before anything is written, that the text about to be
  written is the very text the migrated counts and digests describe.
  Any mismatch names the occurrence and hard-stops that book (§1.4).
- **Post-write read-back.** After each book's write, the entity is
  re-read through the sync snapshot surface; per-occurrence digests
  are recomputed from the read-back entity (using each written
  field) and must equal the plan's digests 100%.
- **Per-book rollup digest.** SHA-256 over the canonical ordered
  list of (occurrenceId, textDigest) pairs per book, computed from
  source (plan) and from read-back (proof of landing). Recorded in
  the run manifest.
- **Run manifest (the only execution evidence that leaves the local
  run store):** run id, source manifest digest, per book — segment
  counts (text written / speechText written / already-correct),
  defaultVoice disposition (restored / source-null-no-op), rollup
  digests (plan vs read-back), pre/post entity revisions and
  structural digests, outcome per book. Counts and digests only —
  **no text**.

### 1.4 Write mechanics — the coordinator's own surface

Writes go through the coordinator's existing content-sync surface —
no new write path is built:

- **Mechanism:** the `SyncPush` command (`POST /v2/commands`,
  command type `SyncPush` in `coordinator.mjs` `_applyCommand`),
  one change per book: `{family: "content", entityKey: bookId,
  bookId, baseRevision: <current entity revision>, payload:
  <enriched entity data>}`. SyncPush is the sanctioned surface the
  clients themselves write through; the enrichment reuses it rather
  than inventing an import path (the migration-import machinery is
  a bindings/audio bind primitive and is expressly not reused —
  wrong tool, and its freeze manifest pins a different corpus
  shape).
- **Revision / CAS behavior:** `_validateSyncChange` requires
  `baseRevision` to equal the entity's current revision, else the
  change returns `conflict` and nothing applies. Pushes apply
  **per book atomically** (the contract's atomicity unit is the
  book): one book = one change = all-or-nothing. The run writes
  books sequentially, re-reading each book's revision immediately
  before its push; a conflict stops the run at that book (a
  concurrent writer exists — in the halted, attended state there
  should be none; the stop is the point).
- **Audit:** every applied push appends to the family's append-only
  `sync_changes` history (seq, revision, op `upsert`, payload) in
  the mutation's own transaction, and the command itself lands in
  the coordinator's command log — the durable receipt store.
  **Attribution:** each push carries a run-scoped commandId
  (`enrichment-<runId>-<bookId>`) and the run id is recorded in the
  run manifest against each book's resulting (seq, revision) pair,
  so every enrichment write is attributable to the run from the
  coordinator's own records, not from the run's say-so.
- **Idempotence:** the plan is computed against the live entity
  (§1.6). A segment whose live fields already equal the plan writes
  nothing; a book whose entity already matches the plan in full is
  a **no-op book** — no push is issued for it at all (a push would
  bump revision and append a change row for zero effect; the
  discipline is to not issue it). A re-run of the whole enrichment
  after a completed run therefore issues zero pushes and reports
  all books already-correct.
- **NO SILENT OVERWRITE:** the dry run classifies every target
  field as *absent* (write planned), *present-and-equal* (no-op),
  or *present-and-different* (**hard stop**). Present-and-different
  — e.g. an entity segment already carrying a `text` whose digest
  differs from source, or an entity `defaultVoice` differing from
  the source value — stops that book, names the occurrence/field,
  and writes nothing for the book. There is no code path in this
  design that replaces an existing value.

### 1.5 Parked Ch 3 immutability (Forever Pucked)

- The parked job (`1832c21f…`, `parked_policy`) and its occurrence
  rows live in the `jobs`/`occurrences` tables. A content-family
  SyncPush touches exactly two tables — `sync_entities` and
  `sync_changes`, family `content` — by construction of
  `_upsertSyncEntity`/`_appendChange`. The enrichment cannot reach
  the job's state, rows, or accounting; Ch 3's segments receive
  `text`/`speechText` inside the FP entity exactly like every other
  segment (their text is data the *job* will one day read; writing
  it does not enumerate, submit, or alter the job), and FP's
  `defaultVoice` is restored as a book-level field.
- **Verification, pre/post:** the run captures the parked job's
  full structural fingerprint before any write (job view: state,
  lane, chapterIndex, grants; all 27 occurrence rows with states —
  digested) and re-captures it after FP's write and after the run;
  the fingerprints must be **identical**. Post-run, proof 5 is
  re-run (§1.8): its 27 rows, anchor (`6bd358a7…`), absent id
  (`2a85f74f…`), and the 26-vs-27 two-sided accounting must be
  unchanged. Any difference stops the program at the enrichment
  gate — nothing proceeds to arming on a moved parked job.

### 1.6 Fail-closed dry run (separate, earlier, read-only)

Before any write execution is even requested, a **dry run**
computes the full plan and writes nothing:

- **Inputs:** the frozen source records (§1.1, manifest-verified at
  run start — a source file whose hash has drifted from
  `snapshot-manifest.json` aborts the dry run) and read-only GET
  snapshots of production (content family; bindings family for the
  pre-checks; the parked job view) — the same read surfaces the
  proof runs already use. **The dry run touches no production
  surface except those reads.** It issues no command, no push, no
  seed, nothing.
- **Per-book report (the write plan):** segments to write `text`
  (expected 2,610 total), segments to write `speechText` (2,401),
  defaultVoice disposition per book, present-and-equal count,
  and **mismatches: must be 0** — the §1.3 `textSha256` cross-check
  (2,610/2,610), the structural-diff check (plan entity vs live
  entity differs **only** in whitelisted additions — text fields,
  speechText fields, defaultVoice), ID set equality re-verified,
  and the baseRevision each push will carry.
- The plan is a local artifact (digests + counts; the payload-
  carrying form lives only in the local run store, §1.7). The
  subsequent write run is a **separate gated execution of this
  verified plan** — it re-reads each book's live entity and
  revision first, and re-validates the plan against them (a plan
  whose base state has moved is stale and stops, §1.4).

### 1.7 Rollback / recovery

- **Pre-write snapshots:** before the first push, the run stores,
  per book, the live entity's full prior JSON plus its structural
  digest and revision — in the run's **local evidence store only**
  (`~/workspace/d6-build/enrichment-evidence/<runId>/`). (The prior
  entities contain no text — that is the gap being fixed — but the
  discipline is uniform: run payloads and snapshots are local-only
  and are never filed to GitHub or the board.)
- **Restore path, per book:** a restore is itself a SyncPush of the
  snapshot payload with `baseRevision` = the post-enrichment
  revision — forward-only through the same audited surface (sync
  history is append-only; a restore is a new revision whose payload
  equals the pre-write state, recorded in the manifest as a
  restore, never a history rewrite).
- **Partially-written posture:** books are the atomicity unit and
  the run is sequential, so a mid-run failure leaves a named set of
  completed books and a named untouched remainder — never a
  half-written book. The run **stops**, reports the exact state,
  and takes no further action: completing the remainder (roll
  forward) or restoring the completed books (roll back) happens
  only on a fresh decision at the gate, with the manifest as the
  record of which books stand where.

### 1.8 Pre/post read-only checks

**Pre (all read-only; a failed expectation stops before any push):**
content snapshot watermark + per-entity revisions and structural
digests; bindings count 1,799 and watermark; parked job fingerprint
(§1.5); settings `{monthlyCap: 50, geminiLane: "batch", revision:
0}`; quota zeros / ledgerSeq 0; `/health` halted on the deployed
build; storage seed state still **unseeded** (the seed is an arming
act, Part 3 — enrichment does not touch it).

**Post:** per-book read-back digest equality (§1.3); content
watermark advanced by exactly the number of pushed books; parked
job fingerprint identical; bindings/settings/quota byte-identical
to pre; then the **five proofs re-run** against the post-enrichment
plane (locally, read-only, the established method). Expected proof
deltas — stated exactly:

- **Proof 3 (POV resolution): CHANGES — offenders 1 → 0, PASS.**
  `67b819e1…` resolves through the restored Pucked Up
  `defaultVoice` via the adapter's existing, regression-pinned
  fallback. Zero code change is involved; if proof 3 does not pass
  here, the enrichment has not achieved its purpose and the
  program stops.
- **Proofs 1, 2, 4: outputs must NOT change** — completeness
  offenders stay 0 (enrichment alters no char count), ID sets stay
  equal (no ID is touched), enumeration/dispositions stay
  identical.
- **Proof 5: outputs must NOT change** — same 27 rows, anchor,
  absent id, and accounting (§1.5).
- **Eligible-set digests for all seven books must NOT change:**
  dispositions are unaffected by text/defaultVoice (the PU title
  segment was already dispositioned eligible; it now also
  *resolves*). A moved eligible digest means the write touched
  something outside its charter — stop and account.

One downstream note, recorded for completeness: enriched entities
sync to Julie's devices through the ordinary pull path (a content
revision bump is a change like any other). The payloads are large
(the seven entities gain ~40 MB of text in aggregate across the
family history). This is the architecture working as designed —
the devices already hold the same text locally from their own
imports — but the post-checks include a device Connect/sync sanity
confirmation at the deploy/enrichment window, as with prior
windows.

### 1.9 Execution gating (Part 1)

- The dry run requires no production approval (reads + local
  computation only); its report is filed for Rowan's review.
- The write execution requires **Julie's explicit enrichment-write
  approval**, naming the verified plan (its manifest digest). One
  approval covers one execution attempt of that plan; a stopped
  attempt (§1.7) needs a fresh decision to roll forward or back.
- Enrichment execution happens **after** the Correction 2 +
  hardening deployment (§5 ordering): the deployed code need not
  change for enrichment itself (SyncPush predates D6), but the
  post-enrichment proof re-run exercises the corrected adapter, and
  the seed route must exist in its hardened form before arming —
  one production window sequence, no interleaving.

---

## Part 2 — Executor work-source contract

### 2.1 The defect

`worker/generation/d6-work-source.mjs` resolves the cast with
`data?.povs || []` — the **source-record** key. Live content
entities carry the cast under **`cast`** (the migration transform's
output key: `cast: book.povs verbatim`). The content-plane adapter
already reads both (`data?.povs || data?.cast`). The legacy host
work source (`worker/host/adapters.mjs`, frozen copied source) has
the same `povs`-only read. Today the defect is masked: live entities
carry no segment text, so the work source returns `no_content`
before POV resolution is reached. The moment Part 1 lands, the mask
comes off — an enriched entity would resolve **no** cast entry for
any segment (every pov lookup misses), and every synthesizable
segment would disposition `unmapped_pov`. Part 2 must therefore
land **before or with** the enrichment's first generation use, and
in the same build gate (§5).

### 2.2 Decision: fix the consumer, not the data

**The D6 work source will read the live shape: `cast` first,
`povs` as fallback** — `data?.cast || data?.povs || []` — mirroring
the adapter's dual-read (in the adapter's order reversed: the
adapter prefers `povs` because it also consumes source-shaped
fixture planes; the work source consumes **only** coordinator
entities in production, so the live key takes precedence and the
source key remains as a fixture/fallback read). `resolvePov`'s
matching (`id === key || name === key`) is unchanged — live segment
`pov` values are names, cast entries carry both, and Correction 2
settled name semantics on the adapter side; the work source's
by-id-or-name match is the same rule at execute time.

**Two companion fixes in the same function, both forced by the
enriched shape and named here for Rowan's review rather than
smuggled:**

1. **Chapter-pov fallback.** The work source currently reads
   `segment.pov` only. Enriched entities keep the transform's
   segment shape (no chapter pov is carried in entities), so no
   behavior changes today; **no change is made** — recorded as a
   deliberate non-fix: adding a chapter-pov read for a field the
   entity does not carry would be speculative. (Source chapters do
   carry `pov`; if a future entity shape carries it, the fallback
   is a new design item, not this one.)
2. **Default-voice style direction.** When resolution falls to
   `data.defaultVoice` (the title-segment case), the payload's
   `styleDirection` currently reads only the cast voice object or
   the segment — the fallback voice's own recorded
   `style_direction` is ignored, so that segment would synthesize
   with an empty style direction despite its voice carrying one.
   Fix: `styleDirection` resolves voiceObj → **fallback** →
   segment → `""`, using each carrier's `style_direction ??
   styleDirection`. This affects exactly the default-voice path;
   cast-resolved segments are byte-unaffected.

**The rejected alternative — normalizing the data in Part 1**
(writing `povs` into entities, or renaming `cast` → `povs` during
enrichment): rejected on three costs. (a) It violates enrichment's
charter — `cast` is present and correct, so "fixing" it writes
data that is not missing, and every entity's structural diff gains
a cast relocation that the §1.4 whitelist must then verify for zero
benefit. (b) It breaks other consumers: the adapter reads `cast`,
and the accepted client's cast surface reads the entity's cast as
`cast` (the cast-census battery records "content plane carries
cast = povs verbatim") — a rename would need dual-reads everywhere
anyway, at which point the one-line consumer fix is strictly
smaller. (c) It fights the migration transform's canonical output:
any future re-derivation from the frozen corpus reproduces `cast`,
re-opening the divergence. The legacy host source
(`host/adapters.mjs`) is **not** changed — it is frozen copied
source serving the v1-shaped path, out of D6's fence; noted, not
touched.

### 2.3 Proof obligations (live-shaped fixtures)

A **new suite, `tests/d6-work-source.test.mjs`**, carries these
(the work source is today exercised only inside
`d6-executor-fi`/`d6-integration` fixtures — it gets its own suite
because this contract is now load-bearing). Fixtures are
enriched-shaped entities: cast under `cast`, segment `text`
present, `defaultVoice` present where the live book has one,
synthetic text only (per CONTRACTS' no-real-text rule). Against a
fixture book, the work source must yield:

1. **Correct text per segment:** for a set of segments across
   chapters, `status: "ok"` payloads whose `text` equals the
   fixture segment's text exactly, with the fingerprint computed
   over that payload.
2. **Correct cast/voice resolution:** segment pov by **name** →
   the matching cast entry's voice (`voice_id`, provider, model);
   segment pov by id → same entry; a removed-provider cast voice →
   `removed_provider` with the recorded mapping named, zero
   synthesis surface; an unresolvable pov → `unmapped_pov`.
3. **The defaultVoice title-segment case:** a sole segment with no
   pov, in a book whose entity carries `defaultVoice` → `ok`, with
   voice/provider/**styleDirection** taken from the defaultVoice
   (§2.2 fix 2) — this is `67b819e1…`'s live shape, fixtured.
4. **Correct style-direction text:** a cast-resolved segment whose
   voice carries `style_direction` → payload `styleDirection`
   equals it exactly.
5. **`no_content` disposition:** a deliberately textless segment
   (entity present, segment present, `text` absent) →
   `{status: "no_content"}`; likewise unknown occurrence and
   missing entity — the designed dispositions, named, never a
   throw.
6. **Regression guard:** the same fixture with the cast keyed
   `povs` instead of `cast` resolves identically (the fallback
   read), and the existing `d6-executor-fi` + `d6-integration`
   suites stay green unchanged.

The full-battery standard applies: the new suite plus all D6
suites green on one complete run's log + exit code on the final
tree, per CONTRACTS.

---

## Part 3 — Seed-authorization hardening

### 3.1 Current state (Correction 2, as built)

`POST /v2/d6-seed-storage` passes the ordinary client production
gate (scope config → scope header → **client token** → instance
header) and forwards to `POST /internal/d6/seed-storage`;
`service.seedStorageBase` refuses unless `GENERATION_HALT === "1"`
(a missing flag fails closed), validates that caller-supplied
`baseBytes`/`objectCount` are non-negative safe integers, and the
store records provenance (same-values re-seed idempotent;
different-values re-seed appends the previous values). Two
weaknesses against Rowan's requirement: the **client** credential
— the same token the reading app uses — suffices to invoke it, and
the **figures are caller-supplied**: the service trusts the
recount it is handed.

### 3.2 Design

**(a) A distinct operator fence.** The seed route additionally
requires the **operator credential** — the existing
`OPALREADER_MIGRATION_OPERATOR_TOKEN` secret, through the entry's
existing migration-operator admission block (the pattern at the
D6 entry's public fetch: fail-closed `503
migration_operator_not_configured` when the secret is unset or
equals the access token; `403 migration_operator_required` when
the `x-opalreader-operator-token` header does not match; on
success the entry stamps `x-opalreader-operator-admitted: 1` on
the forwarded request). Applied to the seed route specifically:

- Public fetch, `POST /v2/d6-seed-storage`: the full client gate
  chain runs as today, **and** operator admission runs; either
  failing refuses before any forward. The client token alone is
  refused (`403 migration_operator_required`) — and this is
  **tested** (§3.4), not just asserted.
- The DO class fetch for `/internal/d6/seed-storage`
  additionally requires the admitted stamp `"1"` alongside the
  existing internal header + production scope checks — defense in
  depth mirroring the migration routes, so the internal route
  cannot be reached on the internal header alone.
- No new secret is created; the operator token already exists on
  the production worker for the migration surface. The seed joins
  that fence; it does not widen it (the stamp is stamped per-route
  by the entry, not ambient).

**(b) The worker recounts; the caller supplies nothing.** The
invocation carries **no figures** — the request body is empty
(any figure fields present are refused with a named reason,
`caller_figures_refused`; the contract is that there is nothing
to trust). On invocation, after the fences, the service performs
the recount itself through the worker's own R2 binding
(`OPALREADER_STORAGE`, already bound and already used by the
flush store inside the same DO class):

- `bucket.list({ limit: 1000, cursor })` paged until
  `truncated === false`, summing `object.size` and counting
  objects over the **whole bucket** (all prefixes — the guard's
  base is the bucket, exactly as the Oct 29 recounts measured it).
- The counted figures — and only they — are seeded:
  `store.seedStorageBase({ baseBytes, objectCount, recountedAt:
  now, source: "worker-recount" })`, with Correction 2's
  provenance semantics unchanged. The response reports the figures
  it used (counts/bytes only) plus the seed state.
- **Feasibility, honestly:** R2's list API pages at up to 1,000
  objects per call inside a Worker — at the current ~5,942 objects
  that is **6 list calls**, sub-second, no CPU concern on the free
  tier, and 6 R2 Class A operations against a 10M/month free
  allowance (operationally free; stated because this program names
  costs). The list runs inside the seed invocation's request, not
  inside a DO transaction (list is async I/O; the store write
  after it is the same sync call as today's seed). Eventual
  consistency: R2 list is strongly consistent for the bucket's
  object set at call time in the home region — and the tolerance
  check below bounds any residual doubt by construction.
- **Cross-check with named tolerance:** the expected base is the
  Oct 29 recorded recount — **5,942 objects / 5,736,481,302
  bytes** (cursor-paginated via the management API, twice,
  identical). **Tolerance: zero.** Justification: in the halted
  state there is no legitimate writer to this bucket — generation
  is halted, the v1 worker is frozen (423s), the Shelf worker uses
  its own storage, and content/settings writes land in DO SQLite,
  not R2. The worker's recount must therefore equal the recorded
  base exactly; **any** nonzero delta (objects or bytes) stops
  the seed, reports both figures, and writes nothing — a drifted
  bucket is a fact to explain before arming, not to absorb into
  the guard's base. (If Rowan prefers a nonzero tolerance she can
  set it at review; the design's position is that zero is the
  honest number for a halted system.)

**(c) Kept from Correction 2, unchanged:** the halt fence
(refusal `generation_not_halted` unless `GENERATION_HALT` is
exactly `"1"`; missing flag fails closed); the store's idempotence
and provenance (same-values re-seed writes nothing; a re-seed with
the worker's own recounted — and therefore, per (b), drift-checked
— figures that differ appends the previous values); the executor/
driver never seed implicitly; the route ships inert in the halted
deployment (it can only ever act while halted).

### 3.3 Deploy implication

This hardening changes the seed route's contract (operator
admission + figureless invocation + worker-side recount), so
Correction 2's deploy delta grows: the entry
(`worker-entry-prod-d6.js` — admission on the seed forward + the
admitted-stamp check at the class gate) and the service
(`service.mjs` — figureless `seedStorageBase`, the recount, the
tolerance stop) change, and the entry's service construction
passes the bucket (`this.env.OPALREADER_STORAGE`) into
`createGenerationService`. `genstore.mjs` is unchanged (the store
contract already fits); the spec's arming precondition text is
updated to name the hardened mechanism. **It folds into the same
halted deployment as Correction 2 — one deploy gate** (a
Step-D-shaped approval, byte-verified upload, observability
re-check, attended Connect check), not a second deployment.

**Arming step order, updated** (replacing the Correction-2-era
precondition wording; the sequence itself is §5's final gates):
production proofs (sub-step 0, post-enrichment plane) → **seed
(operator-invoked: operator credential presented, worker recounts,
tolerance check, halt fence)** → settings CAS (revision 0 → 1,
lane batch → standard) → consumer routing verification (delivery
still paused) → halt flip → queue delivery enabled last — each
step read-back-verified, each carrying the plan's rollback/re-halt
on failure, exactly as the amended proposal §8 specifies.

### 3.4 Test obligations (Part 3)

In the correction test surface (extended
`tests/d6-correction2.test.mjs` seed section or a successor suite
named at build): through the real D6 entry — seed with the client
token but **no operator header → 403 `migration_operator_required`
and no store write**; operator header wrong → 403; operator not
configured (unset / equal to access token) → 503 fail-closed;
a body carrying figures → `caller_figures_refused`; with both
credentials and a fixture bucket — the seeded figures are the
**bucket's own** (fixture objects' sizes/count, not any supplied
number), the tolerance stop fires when the fixture bucket's totals
differ from the expected base the invocation context pins, and
Correction 2's semantics survive (halt fence incl. missing-flag
fail-closed, idempotent same-values re-seed, provenance on
change). Pagination is exercised with a fixture bucket whose list
returns multiple truncated pages.

---

## 5. The full gate sequence, here → smoke

(§4 is intentionally this sequence's home; numbering kept
continuous with Parts 1–3 above.)

| # | Gate | Owner |
|---|---|---|
| G1 | **This design reviewed** (combined: enrichment + Part 2 + Part 3) | Rowan (review), Julie (any scope word) |
| G2 | **Build approval** for the Part 2 + Part 3 code (work-source contract, seed hardening, test suites) | Julie |
| G3 | **Build + source review**: build executes; full battery green on the final tree; Rowan source-reviews the delta | Wren (build), Rowan (review) |
| G4 | **Deploy approval + halted deployment**: Correction 2 + Part 2/3 hardening, one upload, halt on, byte-verified, observability re-applied, Julie's attended Connect/playback check | Julie (approval + attended check), Wren (execution) |
| G5 | **Enrichment dry run** (read-only) executed; plan + manifest filed; Rowan reviews the plan | Wren (run), Rowan (review) |
| G6 | **Enrichment-write approval**, naming the verified plan's manifest digest | Julie |
| G7 | **Enrichment execution** of the verified plan; post-checks incl. proof re-run (proof 3 passes) filed | Wren (execution), Rowan (review of record) |
| G8 | **Arming sub-step 0 re-run** against the enriched, corrected deployment (five proofs + parked fingerprint + storage state read-back) | Wren |
| G9 | **Fresh arming approval** (the Oct 29 approval was spent at its proofs; arming sequence per §3.3: proofs → operator seed → CAS → routing → halt flip → delivery last) | Julie (approval), Wren (execution) |
| G10 | **Smoke approval + smoke**: synthetic job, then Forever Pucked Ch 4 Seg 1 (`bc3c9357…`), measured cost reported; Julie listens | Julie (approval + listening), Wren (execution) |

Standing fences throughout: the parked Ch 3 job resumes only on
Julie's explicit word, ever (no gate above touches it); the
gen-pkg-1 client publication remains its own gate (needed before
Julie can submit generation from the app; the smoke's synthetic leg
runs through the operator surface, and the Ch 4 Seg 1 leg's
submission path is named at the smoke gate); the FP follow-on phase
($13.50 budget) remains a separate approval after the smoke's
measured cost; Batch stays unselectable everywhere.

## 6. Open questions for Rowan

1. **Enrichment payload size through SyncPush.** One change per
   book carries the full enriched entity (~1.6–7.2 MB JSON per
   book by source size; the append-only `sync_changes` history
   stores the payload again). This is within every platform limit
   the design can check on paper, and SyncPush is the sanctioned
   surface — but it is the largest single sync write the system
   has carried. Is Rowan content with SyncPush, or does she want
   the payload chunked (which would need a mechanism this design
   deliberately did not invent)?
2. **Seed tolerance.** The design sets the recount tolerance at
   exactly zero, justified by "no legitimate writer exists in the
   halted state." Does Rowan accept zero, or does she want a named
   nonzero epsilon (and if so, what drift story would it be
   tolerating)?
3. **Operator fence reuse.** The seed route joins the existing
   migration-operator admission (same secret, same header, same
   admitted-stamp). Is sharing that credential across the migration
   and seed surfaces acceptable, or does Rowan want the seed to
   carry a separately-named operator secret (a new secret is
   Julie's hands-on step and a spec change)?

## 7. Standing restatements

- **No text in evidence** (§0): IDs, counts, dispositions, digests
  only — in this design, the dry-run report, the run manifest,
  every board post, and every GitHub artifact. Payloads and
  snapshots live only in the local run store.
- Nothing in Parts 1–3 deploys, writes, seeds, arms, or generates
  anything. Each gate in §5 is Julie's or Rowan's to open, in
  order, and a pass at one gate authorizes nothing at the next.
