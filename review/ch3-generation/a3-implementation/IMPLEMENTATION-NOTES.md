# A-3 Implementation Notes

Build: offline implementation candidate for the A-3 scheduled-fallback
drive entry, built under Julie's offline implementation GO (board
6922008740) and Rowan's DESIGN PASS ruling with binding conditions
I1–I8 (board 6921985393). Offline only: no production or staging
contact, no deploys, no trigger configuration, no activation. The
candidate is DORMANT by construction — the scheduler starts
`inactive`, and nothing in this package arms it.

Specification sources (operative, in `~/workspace/ch2-program/a3-design/`):
`A3-DESIGN-PACKAGE.md`, `A3-DESIGN-AMENDED.md` (M1–M8),
`A3-DESIGN-ADDENDUM-C1-C8.md` (C1–C8), and
`ROWAN-A3-DESIGN-PASS-RULING.md` (I1–I8, overriding where tighter).

All line references are to the FINAL candidate tree in
`~/workspace/ch2-program/a3-build/candidate-tree/`.

## What was built, by design section

### Part 1 — `v2/worker-entry-prod-d6.js` (only file carrying mechanism)

- **Recorder extension + migration (design §5, ruling I6).**
  `DRIVE_PASS_SCHEMA` gains `entry_kind`, `seq`, `admitted_at`,
  `exit_armed`, `assurance_fired`. `_ensureA3Schema()` (:2374) is
  lazy (first pass/tick/activation touch — never at construction,
  so the standing suites' construction snapshots are untouched),
  idempotent, and runs the recorder migration as ONE
  `transactionSync`: per-column `ALTER TABLE ADD` with
  duplicate-column errors swallowed, then a seq backfill in id
  order continuing from the independently durable counter in
  `d6_recorder_meta` (`seq_counter`), and `migration_watermark`
  set to the max pass id. `_recordDrivePass()` (:2207) increments
  the counter and inserts the row in the SAME transaction — seq
  is never `MAX()` over the prunable table (I6). Reruns skip the
  backfill once the watermark exists; an interrupted migration
  re-runs safely (T-A3-03, T-A3-34).
- **Pruning protection (I6).** `_pruneDrivePasses()` (:2289) is a
  separate step after recording; a row that could form part of a
  qualifying RC-2 pair for an UNRESOLVED repair intent (complete,
  native-qualified, seq-adjacent window strictly after the
  intent's completion) is never pruned (T-A3-35).
- **Guard (addendum §C7, ruling I2).** Per-instance, non-expiring:
  synchronous check-and-set plus a FIFO promise-waiter chain
  (`_passGuardTryAcquire` :2454, `_passGuardWaitAcquire` :2463).
  Native acquires in WAIT mode; scheduled in TRY mode. Ownership
  is a token object; release is identity-checked with atomic
  handoff to the next waiter (no bypass, no lost wakeup —
  T-A3-29). Release happens in the innermost `finally` of
  `_drivePass` (:3339) on every exit path.
- **`_drivePass(entryKind)` extraction (design §6).**
  `_drivePassBody()` (:3256) is the shipped `alarm()` body
  verbatim — `super.alarm()` → containment gate → construct →
  recover → drive → flush → complete — parameterized by kind.
  `alarm()` (:3397) records handler-entry time BEFORE the guard
  wait (pass `at` = handler entry; `admitted_at` = acquisition,
  addendum §C2). Captured-error discipline: a body error is
  never replaced by assurance/recording/cleanup failures; native
  rethrows the ORIGINAL error object unchanged; scheduled
  returns `{ passId, stage, error, driveInvoked }` (T-A3-27,
  T-A3-28).
- **Exit assurance (design §7, ruling I2).** `_exitAssurance()`
  (:2498): exactly one `getAlarm()` read per pass exit, recorded
  as `exit_armed`; the coordinator's existing `_armAlarm()` is
  invoked ONLY when the read is null AND pending schedule rows
  exist. Healthy passes write nothing and register nothing extra
  (T-A3-25a). A failed read or failed re-arm is noted as an
  assurance failure in the SCHEDULER EVENT stream
  (`assurance_failed`) and never claimed as a restoration
  (T-A3-27) — see the I2 channel note below.
- **Scheduler tables + state (design §4).** `SCHEDULER_SCHEMA`
  (:512): `d6_scheduler_state` (singleton: activation, epoch,
  cron, admitted watermark, stall counter, last classification,
  in-flight identity, disablement disposition), `d6_scheduler_events`
  (append-only), `d6_scheduler_log` (one row per tick identity,
  UNIQUE; retention 288), `d6_active_pass` (singleton admission
  record).
- **Tick + predicate (addendum §C4 as corrected by I4).**
  `_classifyTick()` (:2604) is a pure, ordered, TOTAL decision
  table (see I4 below). `_schedulerTick()` (:2767) takes all
  async observations first (the `getAlarm()` read is LAST), then
  classification, then — only for INTERVENE — the SINGLE
  SYNCHRONOUS admission stretch `_admitScheduledTick()` (:2944):
  sync re-reads of activation+epoch, containment NORMAL, WAIT
  hold, watermark eligibility, and the predicate's storage
  inputs; the watermark advance, the admission log row, and the
  `d6_active_pass` record commit in ONE `transactionSync`; only
  then is the pass initiated. A stretch refusal REPLACES the
  classification/reason in the tick's outcome — no phantom
  admission is ever logged (T-A3-09…T-A3-14, T-A3-32).
- **I3 containment re-checks (scheduled only).** Inside
  `_drivePassBody`, for `ENTRY_KIND_SCHEDULED` only, containment
  is re-verified after cache construction and again after
  `recover()`, before `driveOnce()` — exactly two guarded blocks;
  native semantics are byte-for-byte the shipped ones (T-A3-17).
- **Owner-safe clearing (addendum §C7).** `_clearActivePass()`
  (:2574) deletes the admission record only when its identity
  matches the exiting pass's own identity; a superseded or
  replaced record is left for its owner (T-A3-38). Deactivation
  during an in-flight pass records `in_flight_noted` and leaves
  the disposition UNRESOLVED until the owner exits
  (`drained_normally`) or a later admission supersedes it
  (`interrupted_or_unknown`) (T-A3-24).
- **WAIT hold (Julie's decision, board 6921918024; ruling I5).**
  A durable hold in scheduler state, settable/clearable in any
  activation state; activation NEVER clears it. The tick refuses
  with classification WAIT_HOLD; the admission stretch re-reads
  it synchronously. A hold write whose outcome is ambiguous
  (storage fault mid-write) fails closed: the tick treats an
  unreadable hold as SET (T-A3-19, T-A3-31).
- **Routes.** DO-internal tick: `POST /internal/d6-scheduler-tick`
  (:1995), reachable only via a direct stub call — the public
  dispatcher 404s every `/internal/*` path before any credential
  check (:3472). Activation: `POST /v2/d6-scheduler-activation`
  (operator class; CLOSED allowlist `{action, authorizationRef,
  reason}`; `authorizationRef` AND `reason` nonblank on EVERY
  action; declines are 200 `{ outcome: "rejected", reason }`).
  Status: `GET /v2/d6-scheduler-status` (operator read class),
  strictly read-only — on a never-touched world it reports
  `schemaReady: false` and creates nothing (T-A3-21).
- **`scheduled()` export.** `scheduledHandler` (:4052) resolves
  the production coordinator stub with
  `{ retry: { maxRetries: 0 } }`, POSTs `{ cron, scheduledTime }`
  to the internal tick route, and drains the response. The
  default export is exactly `{ fetch, queue, scheduled }`
  (T-A3-20). Cadence is platform configuration, not code; the
  code constant is the expected expression `*/30 * * * *`.

### Part 2 — `v2/coordinator.mjs` (derivation reading rules ONLY)

`_repairRecorderPasses()` (:3150) reads the extended row shape
and annotates `nativeQualified` (:3164): `entry_kind =
'native_alarm'` qualifies; a NULL kind qualifies ONLY at/below
the migration watermark; post-watermark NULL or unknown kinds
fail closed. On any read error it falls back to the legacy
SELECT, whose rows carry no `seq` field and therefore evaluate
under pre-A-3 semantics. `deriveRepairStrikes()` (:636) requires,
for any pair in an extended world: both rows complete, both
native-qualified, handler-entry timestamps strictly after the
intent's completion (unchanged), AND `seq2 = seq1 + 1` (:718) —
adjacency in the full retained sequence, so a pruned or
interleaved scheduled row can never manufacture a pair
(T-A3-35). No predicate, halt, strike-bound, or effect site in
this file was touched (diff: 53 lines, confined to these two
functions and their comments).

### Part 3 — `v2/generation/service.mjs` (diagnostics projection ONLY)

The drive-pass diagnostics projection surfaces `entryKind`
(null for legacy rows, `"unrecognized"` for unknown values),
`seq`, `admittedAt`, `exitArmed`, and `assuranceFired` on pass
rows (DP_READ_ENTRY_KINDS :119; projection :1795), and
`wait_interrupted` joins the readable stage set. No other
service behavior changed (diff: 23 lines).

## Ruling conditions I1–I8 — where each is satisfied

- **I1 (effect safety under replay).** Every external effect in
  the drive path was traced to its durable intent/authority
  check. Demonstration (T-A3-16, all three sub-cases green):
  replays of watchdog, retry, and lease schedule rows after a
  mid-pass failure converge with the failure-free execution —
  grants are issued exactly once per (job, revision) by their
  deterministic ids, the outbox records a send attempt BEFORE
  invocation and never re-invokes an attempted row, and
  `cache.flush()` writes only content-addressed objects
  (`audio/${cacheKey}.${format}`, 64-hex content fingerprints)
  with conditional create-if-absent PUTs; a competing object is
  adopted only on digest equality (`validateAndBind`,
  coordinator.mjs). No effect path was found that cannot be
  demonstrated safe, and no boundary expansion was made. One
  pre-existing boundary fact was established — see "Boundary
  findings" (1).
- **I2 (guard, assurance, replay).** Guard atomicity/FIFO/no-
  bypass: T-A3-29. No additional registration on healthy native
  passes: T-A3-25(a). Guaranteed ownership release on every
  exit: T-A3-28, T-A3-29. Original exception preserved
  (identity): T-A3-27. Assurance failures visible and
  distinguished: the `assurance_failed` scheduler event, with
  the recorder-health channel deliberately untouched (see the
  channel note below); no restoration is ever asserted from a
  failed assurance (T-A3-27 asserts `exitArmed === null` and no
  `setAlarm` call). Replay convergence: T-A3-16.
- **I3 (containment re-checks).** Exactly two scheduled-only
  re-checks in `_drivePassBody` (after cache construction,
  after `recover()`); a containment flip at either seam stops
  the scheduled pass before any drive effect while the native
  path is unchanged: T-A3-17 (three sub-cases, including the
  flip landing mid-recovery via a fault seam on the recovery
  scan's own query).
- **I4 (predicate totality).** The decision table is total:
  rows for armed-absent-not-overdue (row 7a) and
  overdue-with-recent-consistent-registration (row 8b) were
  added per the ruling, and row 12 is a conservative
  report-only UNMATCHED catch-all. T-A3-33 proves totality two
  ways: a 96-cell generated observation matrix (every cell
  yields exactly one classification, and only INTERVENE cells
  ever admit) and the named previously-unmatched cells.
  Completion evidence everywhere uses the latest QUALIFYING
  COMPLETE pass, never merely the latest row. One
  implementation refinement inside the predicate boundary is
  disclosed under "Boundary findings" (2).
  PASS_WITHOUT_PROGRESS, ANOMALOUS, and NO_SCHEDULE_OBSERVED
  remain report-only coverage limitations; PASS_WITHOUT_PROGRESS
  increments the stall counter and raises
  `coverage_limitation_escalated` at 48 consecutive ticks
  (T-A3-30).
- **I5 (WAIT hold independence).** Activation/deactivation
  never read or write the hold columns; the hold is settable
  while inactive and survives activation cycles: T-A3-31.
- **I6 (recorder integrity + rollback).** Durable independent
  seq counter in the recording transaction (above); pruning
  protection for unresolved-intent windows (T-A3-35); sequence
  non-reuse after pruning (T-A3-34). Rollback: T-A3-36 runs the
  PRE-A-3 build (the A-1 candidate, `pre-a3-tree/`) against a
  migrated database — it operates, and its NULL-seq rows then
  fail later A-3 derivations CLOSED (no pair forms across them).
  That is the mechanical demonstration of why I6 prohibits
  rolling back to the pre-A-3 build once A-3 has recorded
  passes, except under the ruling's own terms; the permanent
  rollback floor (`6a73d962…`) is unaffected by anything here.
- **I7 (S-3 fixture honesty).** T-A3-26 builds the Chapter 6
  shape synthetically (14 occurrences: 10 ready, 1 granted
  under an expired lease with a `dispatching` attempt, 3
  pending; recorder absent) and drives it ONLY through a
  fallback pass: the granted occurrence resolves
  `outcome_unknown` via the shipped lease adjudication, the
  job surfaces for ResolveOutcomeUnknown, NO resynthesis and
  NO successor grant occur, and the 10 ready occurrences are
  untouched. The fixture claims nothing about the provider —
  `dispatching` is modeled as "pre-dispatch boundary crossed,
  provider outcome unprovable", exactly as assessed.
- **I8 (extended battery).** All extensions are in the battery:
  resumed external publication after instance replacement
  (T-A3-23, with the A-1 harness's per-authority storage
  factory modeling replacement as authority revocation);
  containment changes between recovery stages (T-A3-17);
  predicate totality matrix (T-A3-33); failed/ambiguous
  WAIT-hold writes (T-A3-31); sequence non-reuse after pruning
  (T-A3-34); rollback after migration before the first
  scheduled pass (T-A3-36); ownership-safe active-pass
  clearing (T-A3-38).

## Boundary findings

1. **Adoption cannot fire in this build (pre-existing, NOT an
   A-3 regression).** Lease adjudication calls
   `reconcileUnknown(jobId, occurrenceId)`, whose `"adopted"`
   exit requires `env.probe.keyFor(occ)` to return a key. The
   only `keyFor` in the tree is `host/adapters.mjs`'s
   `keyFor: () => null`. Adoption is therefore unreachable
   through ANY alarm pass, identically on the pre-A-3 build
   (verified by T-A3-25(b) against both trees). The reachable
   exits are `spent_without_audio` and `still_unknown`. This
   bounds what a fallback pass can resolve for the S-3 granted
   occurrence to the same outcomes a native pass could reach —
   which is the design's intent — but the adoption path itself
   remains unproven in this build and should not be cited as
   available.
2. **Classifier row 7a tightened during implementation.**
   Row 7a (ABSENT_NOT_OVERDUE) additionally requires
   `earliestDue !== null`. A pending count with NO earliest due
   is an observation inconsistency (real pending rows always
   carry a due time); without the guard, that combination
   classified ABSENT_NOT_OVERDUE and the I4 UNMATCHED catch-all
   was unreachable. The tightening is inside Part 1's predicate
   boundary, is commented at the row, and is what makes the
   T-A3-33 totality proof honest.
3. **I2 channel decision.** Assurance failures are recorded in
   the scheduler event stream and NOT on the recorder-health
   channel. An earlier draft noted them on the health channel
   under step `"assurance"`; the standing P2 suite's T4 pin
   (a getAlarm fault must produce NO recorder-health increment,
   because the fault is the base chain's, not the recorder's)
   showed that placement conflates the two channels I2 requires
   distinguished. The event stream is durable, append-only, and
   surfaced by the status route's `recentEvents` — visible and
   distinguished. (The unused `"assurance"` read-side step added
   in that draft was removed again; Part 3's diff is projection
   fields only.)

## Retry-option compatibility finding

`COORDINATOR.get(id, { retry: { maxRetries: 0 } })` IS
expressible in this tree: the call is plain stub API with no
type or config gate, and the deploy spec for this worker
(`~/workspace/ch2-program/fix/worker-build/worker/p8/deploy-spec-prod-d6.json`)
carries `compatibility_date: "2026-08-29"`. The tree has no
wrangler config of its own. The offline harness's stub records
the options argument (asserted in T-A3-20:
`coordinatorGetCalls[0].options` deep-equals
`{ retry: { maxRetries: 0 } }`) but cannot prove the runtime
honors it — that is platform behavior, to be measured at the
separately gated staging step, not claimed here.

## Test evidence

Runner: `run-all.sh <log-dir>` (suites: a3, a1, s1,
containment, p2, r5a, v3). Final complete run on the exact
final tree: `evidence/final-run/` (unabridged logs, per-suite
`.exit` files, `SUMMARY.txt`), 2026-11-16T17:09:15Z.

| Suite | Result | Exit |
|---|---|---|
| A-3 battery (T-A3-01…38 + extensions) | 40 pass / 0 fail / 0 skipped | 0 |
| A-1 battery (adapted, disclosed below) | 48 pass / 0 fail / 5 skipped | 0 |
| S1 enforcement | 9 pass / 0 fail | 0 |
| V-3 cold restart | 5 pass / 0 fail | 0 |
| Containment | 41 pass / 1 fail | 1 |
| P2 | 31 pass / 2 fail | 1 |
| R5A | 22 pass / 1 fail | 1 |

**The three failing suites fail ONLY in their T0 assembly/
identity subtests**, which pin the exact sha256 / changed-part
sets of the trees those suites were built for (containment CT0
and R5A T0 pin the coordinator at `39486a70…`; the A-3
candidate's coordinator is `dc6c2cc5…` because Part 2 changed
it; P2's T0 additionally round-trips P2's own `combined.diff`,
which by construction cannot reproduce a later build). Every
behavioral test in those suites passes against the candidate,
including P2 T4 (the recorder-fault contract that drove the I2
channel decision above). The fixtures were NOT re-pinned:
editing another build's identity fixtures to make them pass
against this tree would falsify them as regression evidence.
They are reported here at true strength instead.

### Disclosed test adaptations

- `tests/a1-battery.test.mjs` is the A-1 battery with three
  adaptations, disclosed in its header (the a1-build original
  is untouched): (1) T-00 expects exactly the three A-3 parts
  against its base; (2) its `seedPass` helper ensures the A-3
  schema and stamps seq/entry_kind so seeded passes are valid
  extended rows; (3) T-23 is inverted — the default export is
  now exactly `[fetch, queue, scheduled]` and no scheduler
  wiring calls the repair evaluator. Its deferred register is
  unchanged (T-12/T-21/T-22 → A-3, T-29 → L-1, T-24b
  procedural: skipped, never reported as passed).
- `regressions/` copies carry exclude-list extensions ONLY:
  the P2 battery's six snapshot exclude lists and containment's
  CT10 exclude list each gain the five scheduler tables
  (`d6_scheduler_state`, `d6_scheduler_events`,
  `d6_scheduler_log`, `d6_active_pass`, `d6_recorder_meta`),
  because A-3 legitimately adds tables those snapshots would
  otherwise flag as foreign. No assertion was weakened.
- Tree roles: `pre-a3-tree/` is the pristine live-build tree
  (the A-3 battery's base and T-A3-36's rollback build);
  `baseline-tree/` is the PRE-A-1 tree, retained for the
  containment/A-1 suites whose bases are defined against it.
