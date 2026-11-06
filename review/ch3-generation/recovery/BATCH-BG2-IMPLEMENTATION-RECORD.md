# WS2 B-G2 — Offline Implementation Record

**Scope.** The WS2 B-G2 offline build, per Rowan's conditional
B-G2 scope pass (`ROWAN-WS1-READINESS-BG2-SCOPE-RULING.md` Part 2)
and the build contract `BATCH-BG2-IMPLEMENTATION-SPEC.md`
(pin `7e3d773c11549c8656151cd44a6c7b4120ef1c0b`). OFFLINE ONLY:
local files + the local harness. No production or staging
contact of any kind, no provider calls, no deploys, no board
posts, no pins, no uploads were made by this build. The
candidate ships with `D6_LANE_ALLOWLIST = ["standard"]`.

**Baseline.** The containment-v4 composed tree (the deployed
build `fdb02395b3775dc945baa395591a73060ab146c4` source), copied
to `candidate-tree/`; the composed tree was never edited in
place. A second pristine copy is kept at `baseline-tree/` as the
identity twin. Per-file delta + full part manifest:
`MANIFEST.md` (8 files changed — exactly the spec §3 file map;
`quota-budget.mjs` and the client unchanged).

## What was built, per spec section

- **§3.2 Classification surface** (`host/adapters.mjs`). A pure
  exported `classifyBatchTerminal(facts)` + `batchToken(value)`
  (uppercase, non-`[A-Z0-9_]` runs → `_`, 64-char cap). Policy is
  decided ONLY on structured token evidence (`PROHIBITED_CONTENT`
  / `POLICY_BLOCK`, or a block-reason token containing
  `PROHIBITED_CONTENT`); precedence policy → item error → batch
  error → terminal metadata state → response shape → catch-all
  `provider_error_unclassified`. Unknown shapes classify
  `failed_known`, never policy. Raw provider message text is
  never read, returned, or persisted. `getBatch` terminal
  returns carry the classification; success and not-done returns
  are byte-identical to before. `submitBatch`'s
  accepted-but-unnamed throw carries
  `{batchAcceptedUnnamed: true, code: "batch_accepted_unnamed"}`.
  `listBatchesByDisplayName` matches carry `nameValid`.
- **§3.4 / §4.1 Fence bundle** (`generation/d6-executor.mjs`).
  `batchFenceBundle` runs ONE synchronous `coord._tx`:
  execution → `attempted` transition → spend intent → attempt
  reserve at the upper bound → `fenceBatchSubmit` → 
  `markDispatching` (which runs `applyDispatchQuota` in the same
  transaction). The dispatch count is durable BEFORE any
  provider call. An unarmed quota refuses the bundle
  (`batch_quota_unarmed`) before any write.
- **§3.3 Execution path** (`generation/d6-executor.mjs`).
  Refusal layer 1 became a lane check; layer 2 is untouched;
  layer 3 stands verbatim (job-lane routing makes it unreachable
  for Batch jobs; it still guards the Standard path). One
  submission per occurrence; submit outcomes: HTTP answers go
  through the known-outcome bundle (a known rejection stays
  counted, I-4), ambiguity converts fail-closed, a halt at
  submit leaves the fence standing.
- **§3.5 Terminal accounting** (`generation/genstore.mjs` +
  executor). Durable terminal receipts
  (`d6_batch_terminal_receipts`, lazily ensured beside their
  writer, idempotent on identical content, conflicting content
  refused); the terminal bundle confirms the attempt, notes the
  spend outcome, writes the receipt, and fails the execution —
  in one transaction. `recoveryScan` never releases an attempted
  execution that carries a landed receipt.
- **§3.6 Poll driver + §3.8 shared commit tail**. Durable
  poll-state + observation tables; one poll per map per pass,
  pass-token idempotence, started-row-before-GET discipline;
  D-4 classifications at their fixed parameters (extended
  latency 1h; stalled = ≥12 no-progress passes AND ≥6h;
  ambiguity escalation 24h) as observation/escalation only —
  no automatic action follows any of them; §3.6.6 continuation
  for claimed-but-undelivered grants; §3.6.5 cohort reporting
  (a Batch grant reports only when its cohort is complete, or
  when staged daily-limits exist with nothing in flight). The
  commit tail is shared with the Standard path's shape and
  commits exactly one binding; a landed success is resumed by
  re-poll, never resubmission. Wired into the entry `alarm()`
  between `recover()` and `driveOnce()`, invoked only when
  `GENERATION_HALT === "0"`, with the same dependencies
  `_execute` uses.
- **§3.7 Lease custody** (`coordinator.mjs`). The custody
  predicate (non-superseded fenced/submitted/ambiguous map +
  non-terminal execution + dispatching attempt, at the map's
  generation, under the occurrence's live grant): custody
  occurrences are excluded from lease-expiry unknowning; a
  wholly-custody grant's lease is tolled (+LEASE_MS, rescheduled
  with `deferred: "batch_custody"`); mixed grants behave exactly
  as before for their non-custody occurrences.
- **§3.9 Repair partition** (`coordinator.mjs` `handleReport`).
  A batch repair parent's follow-ons are partitioned by THIS
  report's results: `policy_block` occurrences → a Standard-lane
  follow-on carrying `chainParent`, `parentLane: "batch"`,
  `laneDeviation: "batch_policy_block_standard"`,
  `followOnClass: "policy_block"`; all others keep the inherited
  lane with `followOnClass: "other"`. Ids allocate
  policy-subset-first from the `${jobId}:follow:` sequence;
  per-follow-on grant behavior is unchanged. A non-batch parent
  produces exactly the pre-B-G2 shape (one follow-on, inherited
  lane, no new data keys). Only a `policy_block` result takes
  the deviation.
- **§3.10 Adjudication** (`coordinator.mjs`, `service.mjs`,
  legacy `executor.mjs`, entry). Lazily-ensured run + record
  tables with presence-checked reads (absent reads empty without
  creating; a half-created pair throws
  `batch_adjudication_schema_inconsistent`); the shared
  adjudicator (0 matches → run only, map byte-identical;
  single valid match + no open adjudication → the ONLY automatic
  adoption; single invalid name → open adjudication preserving
  the identifier; ≥2 matches → block, NOTHING adopted, every
  identifier preserved verbatim, duplicate-exposure report as an
  upper-bound scenario — null fields +
  `batch_exposure_unavailable`, never zero-filled, when the
  fence bound is unreadable; open adjudication → later
  enumerations update evidence only, never adopt); the decision
  act (one transaction; selection must be a preserved, valid
  name; `alreadyApplied` / `batch_adjudication_already_resolved`
  idempotence; the record states an operator decision on a
  stated basis). The legacy `reconcileBatch` is hardened to the
  same law and still has no caller. No path deletes adjudication
  rows; the only exit from ambiguous is adoption;
  `resolveBatchNeverAccepted` is reachable from no wired flow.
- **§5 Routes** (`worker-entry-prod-d6.js`). `POST
  /v2/d6-batch-reconcile`, `POST /v2/d6-batch-adjudicate`, `GET
  /v2/d6-batch-inventory`, each wired at all four points
  (predicate, gate skip list, operator admission, forward +
  class handler re-checking the operator-admitted stamp).
  Closed allowlist bodies; caller-supplied provider identity
  refuses `batch_provider_identity_caller_supplied`;
  figure-shaped keys refuse `batch_figure_caller_supplied`;
  extra keys refuse by route name; nonblank authorizationRef
  (and evidenceRef on adjudicate) required; recorded source
  stamped server-side `"operator-route"`; neither POST performs
  its own halt check — the adapter's halt assert is the law and
  surfaces as `generation_halted` with nothing written.
- **§3.12 Inventory** (`service.mjs` + entry). SELECT-only;
  creates no table; keyset pagination by (job_id, occurrence_id,
  generation), limit default 50 max 100, exact totals, explicit
  truncation/next-cursor; per-row linkage (intent outcome,
  execution state, attempt scalars, dispatch identity,
  reservation, open adjudication id, `batch_poll_linkage_missing`
  classification); §3.12 custody classes; summary over ALL rows
  (`countedDispatches`, `outstandingUpperMicroCents`,
  `duplicateUnledgeredUpperMicroCents`, `knownSettledMicroCents`,
  `lastDrivePassAt`, outstanding-map count — the
  chain-non-observation facts).
- **§3.13 Inertness**. The allowlist is unchanged in the
  candidate; BG2-S proves the shipped tree refuses Batch at
  admission, at dispatch, and in capabilities
  (`batch_not_armed`), that the new routes are no-op refusals on
  a Batch-less store, and that the poll driver writes nothing
  there.

## B2-R1..B2-R4 incorporation

- **B2-R1 (lease custody).** §3.7 built as above. BG2-P proves:
  a custody occurrence survives lease expiry (occurrence stays
  granted, attempt stays dispatching, I-9); tolling repeats
  across successive expiries; the restarted instance
  (harness `crash()`) tolls identically; a terminally consumed
  map draws no toll; the no-map control still unknowns exactly
  as before. Rollback shape: BG2-B runs the BASELINE build's
  executor against a populated Batch store — it refuses the
  batch message and leaves every Batch row untouched
  (restoration then polls without resubmitting). The stated
  boundary stands: a rollback target WITHOUT the custody
  predicate + inventory (e.g. the permanent floor build
  `6a73d962…`) does NOT preserve custody semantics; B-G4 must
  name a custody-aware target or rule on it. This build does
  not claim the floor build is a safe Batch rollback target.
- **B2-R2 (repair origination).** The follow-on seam alone
  cannot create the first repair job; origination is therefore
  built as a REPORT CONSEQUENCE in `handleReport`, in the same
  transaction as the report: when a NON-repair BATCH job's
  report carries `policy_block` results for occurrences the
  report has just settled into `blocked_policy`, the first
  `kind: "repair"` job is created on the STANDARD lane with the
  partition's deviation markers plus `repairOrigin:
  "batch_policy_block"`, id `${jobId}:repair:<n>` allocated
  deterministically per parent, submitted under a
  per-parent-per-sequence command id (a replayed report cannot
  mint a duplicate), and granted in the same transaction (the
  chain advances, per the follow-on precedent). Reasons for this
  design over the alternatives: (a) it fires exactly once per
  blocked occurrence set because it is keyed to the report that
  settled them; (b) it reuses the audited `_submitJob` /
  `_issueGrant` machinery rather than adding a second job-
  creation path; (c) it needs no client presence and no
  `RequestRepair` admission change (which would have put a
  client command in the server-owned chain, against F6's
  server-owned repair law). The shared budget is preserved by
  construction: the repair job is an ordinary repair job, and
  `segmentAttemptsUsed(planId, occurrenceId)` counts the Batch
  fence attempt and the Standard repair attempts in ONE
  derivation over the shared plan linkage (BG2-R proves it
  plan-linked: the repair grant's slot assignment is
  12 − 1 = 11 after one Batch attempt). Exactly-once commit is
  the shared commit machinery's, proven end-to-end (Batch block
  → originated Standard repair → F3 split chain → exactly one
  binding). A batch `provider_error` never originates; a
  Standard original never originates; a repair parent never
  originates (it partitions).
- **B2-R3 (halted fence).** A fence whose submission meets the
  halt leaves the map `fenced` — durably visible in the
  inventory with its attempt's upper bound retained as
  outstanding exposure. Clearing the halt cannot re-POST: the
  next drive converts the fence through `noteBatchAmbiguous`
  (`fence_without_outcome`) and the ambiguity gate blocks any
  POST while any non-superseded ambiguous map exists for the
  job; the only exit is operator adoption (BG2-X proves the
  fence stands across the halt and the submit count stays 1).
- **B2-R4 (transaction atomicity).** The fence bundle, the
  terminal bundle, the known-outcome bundle, the adjudication
  recording transaction, and the decision act were all validated
  on the real SQLite harness (throwing `.one()`): fault
  injection at every grouped write (W1–W6 incl. the quota
  day-rollover re-reservation, the receipt insert, the adoption
  update, the run-record insert, the decision update) rolls the
  whole group back to a byte-identical snapshot; a RETURNED
  refusal inside a bundle is converted to a thrown rollback;
  a nested outer `_tx` abort rolls the bundle back with it
  (BG2-F, BG2-C CW-13/16/17, AW-02..04, FW-01).

## Deviations and interpretations (named, with reasons)

1. The BG2 suite lives at `bg2-build/tests/` (with cured
   standing-battery fixtures), not in the containment-v4 tests
   directory the spec describes — the build workspace is
   `bg2-build/` per the tasking; the spec's exit rule (one
   complete run, fixtures cured) is met by `tests/run-all.sh`.
2. Behavioral Batch families run on a THROWAWAY FIXTURE COPY of
   the candidate whose allowlist line is flipped in the copy
   only (`tests/admitted-tree/`, rebuilt every run) — the
   mechanism §3.13 itself prescribes ("never by editing the
   constant in the candidate tree"). The candidate is never
   edited; BG2-S runs on the true candidate.
3. Standing-battery scaffolding adaptations, each marked in the
   copied files with a "B-G2 SCAFFOLDING ADAPTATION" comment:
   cured identity fixtures regenerated from the trees on disk
   (`tests/regen-fixtures.mjs`, run by the runner before every
   run); P2/R5A behavioral groups keep their HISTORIC pre-change
   trees as behavioral twins while identity is measured against
   the pinned pre-build composed tree; R5A's round-trip uses
   the generated diff and its baseline-marker-absence assertion
   was dropped (the composed baseline already carries the R5A
   revision); the V3 copy's harness import/default tree were
   re-pointed. Behavioral groups are byte-identical to the
   originals.
4. Executor layer 3 stands verbatim: job-lane routing makes it
   unreachable for Batch jobs, and it still guards the Standard
   path. (A considered reading, recorded in Phase 3.)
5. A Batch execution in `synthesized` state WITH a landed
   success receipt resumes via re-poll + flush-adopt
   (`resumeBatchCommit`) rather than the existing `reenterFlush`,
   because `reenterFlush` fails on an absent object and
   §3.8/CW-18 requires a landed success to be preserved by
   re-poll; flushed/verified states use the existing tails
   verbatim.
6. Poll observations are recorded for DRIVE-PASS polls only;
   the queue branch's immediate poll passes no pass token (the
   D-4 counters are drive-pass concepts). The immediate poll's
   accounting is identical; only observation recording is
   scoped to passes.
7. A fence-time quota refusal's `daily_limit` is staged in
   memory and reportable only when nothing in the cohort is in
   flight — the bundle rolled back, so nothing durable exists
   to derive it from on a later pass (§3.6.5's re-derivation has
   no row to read). The occurrence is never lost: it stays
   granted/pending and re-fences on a later pass.
8. Reconcile/decision refusals for situations the spec does not
   name use house-style names, recorded here: a map that moved
   during enumeration → `batch_adjudication_map_moved`; a
   single valid match held by an open adjudication → run
   outcome `evidence_updated`, return reason
   `batch_adjudication_open`; selecting a preserved-but-invalid
   or unpreserved name → `batch_adjudication_selection_not_enumerated`;
   route field refusals `job_id_required` /
   `occurrence_id_required` / `adjudication_id_required` /
   `selected_provider_name_required` mirror the house
   `attempt_id_required` pattern; pagination refusal
   `batch_inventory_pagination_invalid` mirrors
   `quota_reconcile_offset_invalid`.
9. The alarm poll pass token is `alarm-<pass timestamp>-<seq>`
   (unique per invocation); the drive-pass recorder's existing
   allowlist passes the poll outcomes' scalar keys through.

## Test results (actual counts, from captured logs)

The exit rule is met: ONE invocation of `tests/run-all.sh` on
the final candidate tree, overall exit 0, full logs under
`test-logs/exit-run/` (2026-11-06T15:43:04Z):

| suite | tests | pass | fail | exit |
|---|---:|---:|---:|---:|
| containment (standing) | 42 | 42 | 0 | 0 |
| p2 (standing) | 32 | 32 | 0 | 0 |
| r5a (standing) | 23 | 23 | 0 | 0 |
| v3 (standing) | 5 | 5 | 0 | 0 |
| bg2 (this build) | 110 | 110 | 0 | 0 |

BG2 family coverage: BG2-E classification 15; BG2-F fence
atomicity 13 (+ BG2-A fence slice 4); BG2-X execution/cohort 15
(+ custody slice in BG2-P 3); BG2-P poll driver + remaining
BG2-C windows 17; BG2-M adjudication 8; BG2-O routes 5;
AW-01..04 4; BG2-R repair 7; BG2-B inventory/rollback 5;
BG2-S inertness + BG2-H failure behavior + BG2-A completion 14.
All 29 §4.3 crash windows are covered: CW-01..23 (CW-13/14/15/
16/17/19/20/21/22 in the driver/C sets, the rest in BG2-X/F),
AW-01..05, FW-01. Invariants I-1..I-9 are asserted where the
families name them (count-before-POST, counted dispatches,
upper-bound carriage, known-rejected-stays-counted, exposure
retention, drift names, ambiguity gate, custody non-unknowning).

## What remains unproven (platform behaviors)

Per §8, carried unchanged: B-1 pricing is OPEN (the cost model
is lane-blind by design here; no differential is assumed,
designed, or claimed). B-2 staging parity and B-3 prepay
provenance are B-G3 predicates, untouched. O-1: D-4 parameters
are observation-only. O-5: real Gemini Batch error shapes are
first observed at B-G3 — §3.2's taxonomy is conservative
because of it; tokens learned there require a new reviewed
change, never an informal tuning. O-6 platform-unverified
behaviors stand: alarm delivery/cadence, DO runtime adoption,
post-retry-exhaustion alarm semantics, racing-wake recheck.
The harness cannot prove: platform transaction behavior under
real DO eviction, real provider latency/billing, real R2
behavior, device-side client behavior, or enumeration
completeness beyond the adapter's 100-row page (the run record
flags `enumeration_may_be_incomplete` at a full page). The exit
criteria toward B-G3 are met by this package; meeting them
authorizes nothing.
