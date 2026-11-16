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
  instance replacement modeled as authority revocation with
  per-authority storage (T-A3-15/T-A3-16/T-A3-26; the soak
  T-A3-23 mixes native and scheduled evidence across
  admissions — CORRECTION, corrections round: an earlier
  draft of this section described T-A3-23 as covering
  "resumed external publication after instance replacement",
  which it does not; that exercise is T-A3-46, added by the
  corrections round, together with T-A3-16's flush
  convergence and T-A3-25(a)'s bucket evidence);
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
(Corrections round: this section is the FIRST build's record.
The corrected candidate's results are in the
corrections-round section at the end of these notes, from
`evidence/final-run-corrections/`.)

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

---

## Corrections round — Rowan's IMPLEMENTATION HOLD ruling (R1–R8)

Targeted offline corrections under the existing offline
implementation GO. The three-part boundary is unchanged; no
correction required expanding it. Final complete run on the
exact final trees: `evidence/final-run-corrections/`
(2026-11-16T18:04:05Z), via the extended `run-all.sh`.
**Overall runner exit: 1** — because the historical T0/CT0
assembly-fixture suites exit 1, exactly as in the first run;
never describe this run as all-green.

### Results (corrections run)

| Suite | Result | Exit |
|---|---|---|
| A-3 battery (T-A3-01…46) | 48 pass / 0 fail / 0 skipped | 0 |
| A-1 battery (adapted, disclosed) | 48 pass / 0 fail / 5 skipped | 0 |
| S1 enforcement | 9 / 0 | 0 |
| V-3 cold restart | 5 / 0 | 0 |
| Composition (`verify-composition.mjs`) | OK | 0 |
| Rollback RC-2 (`tests/rollback-rc2.test.mjs`) | 2 / 0 | 0 |
| Rollback: A-1 battery | 48 / 0 / 5 skipped | 0 |
| Rollback: S1 | 9 / 0 | 0 |
| Rollback: V-3 | 5 / 0 | 0 |
| Containment (candidate AND rollback) | 41 pass / 1 fail (CT0 only) | 1 |
| P2 (candidate AND rollback) | 31 pass / 2 fail (T0 only) | 1 |
| R5A (candidate AND rollback) | 22 pass / 1 fail (T0 only) | 1 |

### R1 — Composition verification. DONE.

`COMPOSITION-VERIFICATION.md` + `verify-composition.mjs`:
both trees differ from the live-build baseline in exactly
the three parts (28 files byte-identical), with explicit
dispositions for the four historical assertions (containment
CT0; P2 T0 identity; P2 T0 round-trip; R5A T0) — each a
historical assembly-fixture incompatibility, not a
behavioral regression. Fixtures and raw exits preserved.

### R2 — RC-2 fail-open fallback. DONE (blocker).

`_repairRecorderPasses()` (Part 2) no longer falls back on a
generic exception. It first PROBES each A-3 column
separately (`SELECT <col> FROM d6_drive_passes LIMIT 0`):
both present → migrated world, the extended read is the only
permissible semantics and its failure returns null (no
recorder evidence, `recorderVerified: false`); both absent
("no such column") → positively established pre-migration
schema, legacy semantics; anything else (mixed, unexpected
error, missing table) → null. And in `deriveRepairStrikes()`
the pair-skip is replaced, for extended worlds, by the
design §8 window rule: any not-well-formed extended row in
an intent's window (post-watermark NULL kind, unrecognized
kind, or a recognized kind without a numeric seq) fails that
intent closed — no discharge, and the intent is surfaced in
`failClosedIntentIds` on the derivation and on the repair
status surface. A well-formed scheduled row breaks adjacency
without poisoning (T-A3-22/T-A3-10 semantics preserved).
Tests: T-A3-39 (fault injection: extended read fails over
scheduled evidence → no discharge; the pre-corrections code
discharged exactly this shape through the legacy SELECT),
T-A3-40 (poison variants + control).

### R3 — Watchdog-only classification. DONE.

The predicate's rows 4/5 are rewritten: HEALTHY_IDLE only
for a timely, consistently armed idle watchdog (numeric
registration within SKEW of the watchdog's due, due not
overdue). An overdue watchdog row is overdue WORK under the
general rows: INTERVENE-eligible (verified-absent or
overdue-registration), or PASS_WITHOUT_PROGRESS report-only
when a complete pass finished after its due. No schedule
rows at all → NO_SCHEDULE_OBSERVED; read failure →
READ_FAILURE. The admission stretch now computes earliest
due over ALL pending rows (watchdog included) — the same
definition as the predicate (see R4). Tests: T-A3-41
(watchdog-only fixtures for each case).

### R4 — Final admission revalidation. DONE (blocker).

The admission stretch recomputes EVERY storage-local
eligibility input from fresh reads — activation + epoch,
WAIT hold (R5 form), containment, GENERATION_HALT, the
watermark family, pending rows and earliest due under the
consistent definition, the complete-pass-since-due component
against that due — and RE-EVALUATES the actual classifier on
the fresh observations; admission proceeds only on a fresh
INTERVENE. The tick's initial observations now also capture
the newest pass id; if the stretch's newest pass is newer
and the registration it left differs from the registration
the tick observed, the tick refuses `UNMATCHED /
stale_alarm_observation` (log action
`skip_stale_observation`) rather than admitting on stale
evidence. The atomic watermark + active-pass commitment in
the single transaction is unchanged. Test: T-A3-42 (a native
pass completes during the tick's `getAlarm()` await and
leaves a different registration, overdue work still present
→ no admission). The classifier re-evaluation path is
additionally exercised by the standing stretch refusals
(T-A3-17) and the totality matrix (T-A3-33).

### R5 — WAIT hold verified-inactive. DONE, with the scope decision recorded here.

The valid hold representations are exactly 1 (active) and 0
(inactive). The tick's initial observation treats any other
stored value as `wait_hold_unverifiable` (classifier
READ_FAILURE); the admission stretch refuses
`WAIT_HOLD / hold_set_before_admission` on exactly 1 and
`READ_FAILURE / wait_hold_unverifiable` on anything not
exactly 0. Hold persistence across activation/deactivation
is unchanged and re-proven (T-A3-38). Test: T-A3-43
(malformed hold at the initial observation and inside the
stretch). The failed/ambiguous hold-write contingency
remains documented for the activation proposal, as the
ruling directs.

**Operating-scope decision (expressly documented per R5):**
the candidate refuses scheduled admission whenever
`GENERATION_HALT` is not `"0"` — the initial operating scope
is LIVE-only. In the HELD state the scheduler classifies
INELIGIBLE (`generation_not_enabled`) and admits nothing;
revival in the HELD state remains A-1's contract, not A-3's.
This is a scope decision of the initial release, not a
defect: the predicate, admission, and pass machinery are
halt-agnostic, and widening the scope is an activation-
proposal question, not a code change.

### R6(a) — Exit assurance outcomes. DONE.

The pass record now distinguishes the assurance outcome,
classified from a READ-BACK, never from `_armAlarm()`'s
return (which is normal under containment suppression):
`assurance_outcome` ∈ `not_required` (exit read found a
registration) / `verified` (attempted; read-back armed —
the value is recorded in `assurance_armed_after`) /
`suppressed` (attempted; read-back still null) / `failed`
(the re-arm or the read-back threw) / `read_failed` (the
exit read threw), alongside `assurance_fired` (the ATTEMPT)
and `exit_armed` (unchanged: the exit read's own value). Two
new recorder columns ride the same migration (fresh tables
via the schema; older tables via the ensure's ALTER list).
Channel discipline stands: assurance failures note the
scheduler event stream; recorder failures the health channel.
One honest limit: `suppressed` records that no registration
stood after a normally-returning `_armAlarm()`; containment
suppression is the only in-source cause of that path, but
the record itself does not prove the cause. The dormant-
deployment property is unchanged (T-A3-28: dormant native
passes record `not_required` with zero assurance attempts,
and the alarm-call sequence is identical to the pre-A-3
build). Tests: T-A3-44 (verified / suppressed / failed).

### R6(b) — Disablement evidence. DONE.

`drained_normally` is now recorded only when the pass's
completion was DURABLY recorded (its pass-row write returned
an id). If recording failed, the active-pass record is NOT
cleared, the disposition resolves `interrupted_or_unknown`
atomically with a `drain_unrecorded` scheduler event, and
the evidence stands for the rollback gate (a later
admission's supersede remains the other sanctioned
resolution). The normal path is also hardened: owner
clearing + disposition + the `drained` event are now ONE
transaction, so the record cannot be cleared without its
disposition landing, nor a disposition recorded for a record
that stands. Tests: T-A3-45 (unrecorded drain); T-A3-24/T-A3-37
re-prove the recorded paths.

### R6(c) — Genuine rollback candidate. DONE.

`rollback-tree/` + `ROLLBACK-MANIFEST.md`: the pre-A-3 build
retaining the new recorder (full-column schema, the
migration, the transactional seq-stamping recorder, the
pair-protecting prune) and the corrected RC-2 derivation
(Parts 2 and 3 byte-identical to the candidate's), with the
scheduler and shared-drive mechanism REMOVED (no
`scheduled()` export, no tick/activation routes, no guard,
no scheduler tables). Its passes are well-formed extended
evidence: the candidate's derivation accepts them (test
RB-4, both directions). Regression evidence: the full
rollback suite set in the results table above (P2/R5A via
the `rollback-suites/` shadow root of real copies).

### R7 — I1 effect census, completed. DONE, with one correction and one separate defect.

For every external effect reachable through the pass, the
authority/durable-intent boundary relative to each
asynchronous continuation, traced against the corrected
source:

- **Grant issuance** (`coordinator.mjs` `_issueGrant`,
  :2288): ONE atomic stretch — ledger reservations, the
  grant row (`issued`, lease = now + 15 min), the outbox
  `dispatch` row, the lease schedule row. No await inside
  the stretch: no continuation exists between intent and
  effect. Deterministic grant id + `grant_exists` check make
  re-execution converge rather than duplicate (addendum §C2).
- **Queue delivery** (`coordinator.mjs` `drainOutbox`,
  :2475): the send-attempt marker is written BEFORE the send
  function is invoked (`UPDATE outbox SET send_attempted_at`,
  :2535); an attempted row is never re-invoked by the drain.
  The authority boundary is exactly the marker: before it,
  no effect is possible; after it, the effect may be
  outstanding and its completion bookkeeping is what a
  replacement reconciles (T-A3-26: the outstanding send lands
  once; the replacement converges the grant to
  `handoff_uncertain` without re-sending). `sendGrant` is
  wired only when generation is enabled
  (`worker-entry-prod-d6.js` :343).
- **Cache publication / flush** (`generation/flush-store.mjs`):
  the PUT is conditional create-if-absent (`onlyIf:
  etagDoesNotMatch: "*"`, :96) against a CONTENT-ADDRESSED
  key (`audio/${cacheKey}.${format}`). A resumed publication
  of the same bytes adopts the winner only on digest
  equality (`validateAndBind`, coordinator.mjs :2884; call
  sites :2167, :2743, :2966); a differing winner fails
  closed (`winner_digest_mismatch`) and is never overwritten.
  Publication therefore needs no authority boundary of its
  own: the key is the intent, and equality is the fence.
  Exercised at module level by T-A3-46(b) and at pass level
  by T-A3-16's flush convergence.
- **Recovery** (`generation/service.mjs` `recover()`, :1529)
  and **drive** (`driveOnce()`, :1031): both run inside the
  pass body (`worker-entry-prod-d6.js` `_drivePassBody`,
  :3413; stages recover → drive → flush at :3459/:3474/:3476)
  over durable state only; every effect they reach is one of
  the fenced effects above. A continuation resumed after
  instance replacement hits the revoked authority at its next
  storage access BEFORE initiating any new effect —
  exercised by T-A3-46(a) (parked pre-drive, revoked: zero
  grants, zero outbox rows, zero sends; the replacement's
  pass then issues and sends exactly once) and by
  T-A3-15/T-A3-16 for the mid-drive boundaries.
- **Alarm registration** (`coordinator.mjs` `_armAlarm()`,
  :3112): a single-slot storage effect. The boundary is the
  registration itself: a resumed continuation may re-arm
  (idempotent — the slot holds the earliest due), and the
  C2 collision case is fenced by the exit assurance's
  read-back classification (R6(a)) rather than by preventing
  the write.

**Separate tracked defect (NOT repaired in A-3, per R7):**
automatic cache adoption remains unavailable in the shipped
implementation — `env.probe.keyFor()`'s only implementation
(`host/adapters.mjs` :706) returns null unconditionally, so
`reconcileUnknown`'s `adopted` exit is unreachable on both
the pre-A-3 build and this candidate (T-A3-25b). The
predicted S-3 outcome stands: on revival the granted
occurrence resolves `outcome_unknown` (10 ready + 1
outcome_unknown + 3 pending), conditional on revival and
lease adjudication. The defect is recorded here and in the
boundary findings; its repair is a separate case.

**Correction to the first build's notes:** the I8 entry
formerly described T-A3-23 as covering "resumed external
publication after instance replacement". T-A3-23 is the
mixed-evidence soak; it does not cover that. The sentence is
corrected in place above; the coverage itself is T-A3-46(b)
with T-A3-16 and T-A3-25(a).

### R8 — Reproducibility. DONE.

`REPRODUCIBILITY.md`: every input the runner references is
in the package — both trees, both baselines, the regression
sources + fixtures + their own baseline trees and diffs, the
test sources, the harness, `run-all.sh`, and the
`rollback-suites/` shadow-root construction — with the exact
reconstruction and run procedure from the pinned files
alone.

### Ruling-driven test corrections (disclosed)

Three pre-corrections tests encoded semantics the HOLD
ruling withdrew; their expectations are corrected in place,
each with a comment naming the ruling:

- **T-A3-19**: watchdog pending with no registration was
  HEALTHY_IDLE; under R3 it is ABSENT_NOT_OVERDUE.
- **T-A3-21**: the "recovered state" second tick relied on
  the withdrawn watchdog reading; the fixture now delivers
  the watchdog's alarm to model recovery, and asserts
  exactly one SCHEDULED admission (the tick is HEALTHY_IDLE
  under the corrected timely-armed branch).
- **T-A3-36**: part (3) expected a later adjacent pair to
  discharge an intent whose window contains a NULL-seq row;
  under §8/R2 the window fails closed permanently for that
  intent, which is now asserted (with its
  `failClosedIntentIds` surfacing).

One test-side adaptation is added: the A-1 battery's
`seedPass` falls back to `_ensureRecorderSchema` for
rollback runs (adaptation 4 in its header; candidate
behavior unchanged). Every standing deferred disposition is
preserved: the A-1 battery's five skips remain skips
(T-12/T-21/T-22 → A-3, T-29 → L-1, T-24b procedural) in both
the candidate and rollback runs.

### Limitations, at true strength

- All evidence is offline simulation on the house harness
  (real node:sqlite, production `.one()` semantics). It does
  not prove platform behavior: cron delivery, alarm
  delivery/retry, the `retry: { maxRetries: 0 }` stub option
  being honored, and DO instance-replacement timing remain
  staging measurements for the deployment/activation gates
  (ruling I8).
- The R4 stretch re-evaluates the classifier with the tick
  instance's own guard state and the tick's (possibly stale-
  rejected) registration observation; it does not re-read
  `getAlarm()` inside the stretch — doing so would break the
  synchronous boundary the design requires. Freshness of the
  registration is enforced by the stale-observation rejection
  against recorded pass evidence, which is the strongest
  check available inside the boundary. (Superseded in part by
  the R4 closure round below: the registration revision fence
  is now a second, recorder-independent witness inside the
  same boundary, and it — not recorder evidence alone — is
  the freshness check for registration-writing activity that
  leaves no pass row.)
- `assurance_outcome: "suppressed"` certifies the read-back
  state, not its cause (see R6(a)).

---

## R4 closure round — Rowan's CONDITIONAL IMPLEMENTATION PASS

The corrections ruling accepted R1/R2/R3/R5 outright,
accepted R6 with deployment-gate qualifications, made R7
conditional, and passed R8 — leaving ONE admission blocker
(R4) and the R6 dormant exit-assurance qualification. This
round is scoped to exactly those two items. No accepted
correction was reopened; the implementation boundary did not
move; every standing deferred disposition below is preserved.

### The R4 blocker, restated

The corrections-round admission stretch witnesses intervening
registration activity only through recorded pass evidence
(a newly recorded pass whose `armed_after` differs from the
tick's observation). Two real registration writers leave no
such evidence: the coordinator's command and executor-report
WAKE paths register an alarm without any pass row, and a
native pass that completes while its recorder write fails
leaves no row either. Both are invisible to the recorder
witness, so a tick could admit on a registration observation
that concurrent activity had already superseded. The ruling
prescribes the fix: reuse the coordinator's existing
alarm-revision mechanism as a fence, ADDITIVE to the recorder
witness (recorder availability must not be the sole
concurrency witness).

### The correction — exact mechanism

The mechanism is A-1's, pre-existing in the coordinator:
`ALARM_REVISIONS`, a WeakMap keyed on the Durable Object
state object, bumped by `_bumpAlarmRevision()`
(coordinator.mjs:3175) in the same synchronous stretch as
EVERY registration or deletion initiation in that part
(`_armAlarm`'s bump at coordinator.mjs:3153, both
`_armAlarmIfEarlier` initiation sites, the containment stop's
`deleteAlarm`, the verify path's re-issued delete, the repair
evaluation's own act). A-1's evaluations already capture
`_alarmRevision()` before their asynchronous registration
observation and recheck it at the act boundary
(coordinator.mjs:3322, :3375, :3503). The closure extends the
same discipline to the tick:

- **Capture** — the tick reads the revision BEFORE its
  asynchronous registration observation:
  `worker-entry-prod-d6.js:2928`, immediately before the
  `await this.state.storage.getAlarm()` at :2932, and carries
  it into `_admitScheduledTick`.
- **Comparison** — inside the final synchronous admission
  stretch, after the RETAINED recorder stale-observation
  check and before the fresh classifier evaluation is acted
  on: `worker-entry-prod-d6.js:3189–3191`. A changed revision
  returns the refusal path with classification `UNMATCHED`
  and reason `revision_changed`; the tick log records it
  under the distinct action `skip_revision_changed`
  (worker-entry-prod-d6.js:3003–3004).
- **Non-consumption** — like every refusal in the stretch,
  the fence refusal commits nothing: the admitted watermark
  is NOT advanced, and the tick remains admissible on a later
  delivery once the registration is stable (demonstrated
  behaviorally in T-A3-47, where a later tick admits after
  the fenced one refused).
- **Admission still requires both witnesses clear**: revision
  unchanged AND the fresh classifier evaluation (corrections
  round, unchanged) returning INTERVENE. The recorder
  stale-observation protection is retained verbatim as the
  second witness; the fence is additive, exactly as the
  ruling requires — the native-pass-with-failed-recorder-write
  case (T-A3-49) is caught because the pass's own arming bumps
  the revision even when its pass-row write fails.
- **The stretch read is synchronous and non-mutating**: the
  comparison is `alarmRevisionFor(this.state)` — a WeakMap
  lookup. No await, no write, no throw.

### Why the coordinator changed at all (the accessor)

The ruling allowed a coordinator change only if the revision
mechanism needed an accessor; it did, for a structural
reason. The D6 entry class (`OpalReaderCoordinatorProd`)
does NOT inherit `GenerationCoordinator` — the coordinator is
a separate object the base entry constructs per operation
over the SAME state object — so the tick has no
`this._alarmRevision()` to call (verified against the source
class graph and empirically on the harness: the method exists
only on coordinator instances, and `inst.state === coord.state`,
which is what makes the shared WeakMap fence coherent).
Constructing a coordinator inside the stretch was rejected:
its constructor runs schema DDL and `INSERT OR IGNORE`
seeding writes, which would put mutation inside the boundary
the stretch exists to keep pure.

The minimal change: the revision read is factored into an
exported pure function, `alarmRevisionFor(state)`
(coordinator.mjs:576 — a WeakMap lookup only), and
`_alarmRevision()` delegates to it (coordinator.mjs:3171–3173),
so the read has exactly one definition and no coordinator
path changes behavior. The SAME edit is mirrored verbatim
into `rollback-tree/v2/coordinator.mjs` for exactly one
reason: the composition check asserts Part 2 is
byte-identical between the candidate and rollback trees. The
rollback tree has no tick and needs no fence; nothing in it
imports the accessor and it is inert there (see
`ROLLBACK-MANIFEST.md`, closure note). The rollback ENTRY is
untouched by this round.

### The four fence tests (T-A3-47…50) — all PASS

Each test parks the tick inside its `getAlarm()` observation
(the harness's deferred observation) and lands the wake
through the coordinator's ACTUAL paths — `handleCommand`,
`handleReport`, a real native `alarm()` pass — never a
synthetic revision bump:

- **T-A3-47 — command wake, no pass row.** A `RequestPause`
  command via `handleCommand` wakes the coordinator, whose
  wake-path arming registers an alarm (asserted: a
  registration exists and the revision advanced) while
  recording NO pass row — invisible to the recorder witness
  by construction. The released tick refuses
  `skip_revision_changed` / `revision_changed` / `UNMATCHED`,
  the admitted watermark stays null, no fallback pass runs;
  a LATER tick then admits normally, proving the refusal did
  not consume the tick. **PASS.**
- **T-A3-48 — executor-report wake.** `handleReport` for an
  unknown grant (which wakes identically before its
  not-found return): same registration-without-a-row shape,
  same fence refusal, watermark unconsumed, no pass. **PASS.**
- **T-A3-49 — native pass, recorder failure.** The pass's
  `INSERT INTO d6_drive_passes` is faulted: the pass runs to
  completion, registers (revision advanced), and records NO
  row. A fresh overdue lease is then added so the fresh
  classifier evaluation ALONE would return INTERVENE; the
  released tick still refuses via the fence, watermark
  unconsumed, no fallback pass. This is the case the ruling
  named: recorder availability is not the sole witness.
  **PASS.**
- **T-A3-50 — control.** No intervening activity: exactly one
  admitted fallback pass completes, the watermark is consumed
  exactly once, and a same-identity redelivery classifies
  `duplicate_or_stale_tick` and admits nothing further. No
  over-suppression regression. **PASS.**

### R6 dormant exit-assurance qualification

Rowan's R6 wording, carried as required: a numeric assurance
read-back is evidence that a registration was OBSERVED at the
read-back instant; it is not, by itself, proof of native
delivery, nor proof of the identity of the registration that
will fire. The outcome labels classify the read-back state,
nothing more.

The assurance runs at every native pass exit by design,
including when the scheduler has NEVER been activated. The
three dormant shapes (the fixtures assert the scheduler state
is `inactive`, epoch 0, with no activation events — the
assurance is not gated on activation):

- **(a) Healthy numeric registration** — demonstrated in the
  corrections round (T-A3-28): the assurance does not act;
  the pass row is equivalent to the pre-A-3 build's. No
  behavior change in dormant deployment.
- **(b) Null registration with pending rows after a native
  pass** — T-A3-51 (new). The native pass's own arming lands
  and is then lost (the T-A3-44(i) registration-loss model:
  deletion after the first landed `setAlarm`). At exit the
  assurance performs ONE `getAlarm()` read (null), finds
  pending schedule/watchdog rows, and makes ONE arming
  attempt through a coordinator's `_armAlarm()` — the
  coordinator's own containment-gated arming, which
  recomputes the earliest due from the pending rows — then
  classifies the outcome from the read-back: here `verified`,
  with `assurance_armed_after` equal to the re-armed
  registration. The pre-A-3 twin under the identical fixture
  performs no such act and exits with NO registration.
  **The delta, at full strength: in dormant deployment the
  candidate CAN restore a lost registration at a native pass
  exit where the pre-A-3 build cannot. That is a behavior
  change relative to the pre-A-3 build.** It is bounded to
  exactly: a native pass exit ∧ the exit read is null ∧
  pending rows exist ∧ containment permits arming. It is
  recorded on the pass row (`assurance_fired`,
  `assurance_outcome`, `assurance_armed_after`); both twins'
  passes otherwise complete identically, and the act
  introduces no scheduler, tick, or drive behavior.
- **(c) A FAILED native pass with null registration +
  pending rows** — T-A3-52 (new). The pass body is failed
  after the base alarm stage (its construct-stage cache
  construction throws): the pass is recorded at stage
  `construct`, and the ORIGINAL error is rethrown unchanged,
  so platform alarm-retry behavior is identical to the
  shipped build. The base alarm's own arming is lost the same
  way as (b). The assurance runs on the failure exit exactly
  as on a clean exit: it fires, re-arms, and the read-back
  classifies `verified`. The pre-A-3 twin records the same
  failed pass and exits with no registration and no recovery
  act. **PASS.**

**Delimitation.** The offline fixtures model registration
loss as deletion-after-landing — the shape the harness can
produce deterministically. Whether the platform loses
registrations in exactly this shape, and whether a re-armed
registration is subsequently DELIVERED by the platform, are
platform behaviors no offline fixture can prove; they remain
staging measurements for the deployment gate (ruling I8),
unchanged by this round. What is demonstrated offline is the
candidate's own act and its recording, in all three dormant
shapes, and the precise delta against the pre-A-3 build.

### Results — closure run

`evidence/final-run-r4closure/` (2026-11-16T18:38:41Z), one
complete `run-all.sh` run on the exact final trees,
unabridged logs with raw exit codes:

| Suite | Result | Exit |
|---|---|---|
| A-3 battery (T-A3-01…52) | **54 pass / 0 fail / 0 skipped** | 0 |
| Composition (`verify-composition.mjs`) | OK — exactly the three parts; Parts 2/3 shared verbatim | 0 |
| A-1 battery | 48 pass / 0 fail / 5 skipped (standing deferred register) | 0 |
| S1 | 9 / 9 | 0 |
| V-3 | 5 / 5 | 0 |
| Rollback RC-2 battery | 2 / 2 | 0 |
| Rollback A-1 / S1 / V-3 | 48/0/5, 9/9, 5/5 | 0 |
| Containment (candidate + rollback) | 41 pass / 1 fail (CT0 only) | 1 |
| P2 (candidate + rollback) | 31 pass / 2 fail (T0 only) | 1 |
| R5A (candidate + rollback) | 22 pass / 1 fail (T0 only) | 1 |
| **Overall runner** | | **1** |

The overall exit remains **1**, from the four historical
T0/CT0 assembly-identity assertions only (dispositions in
`COMPOSITION-VERIFICATION.md`, unchanged). No accepted
correction regressed: every suite matches the corrections run
except the A-3 battery, which grew by the six new tests
(T-A3-47…52), all passing.

### Deferred dispositions — unchanged, restated

- Platform behaviors (cron delivery, alarm delivery/retry,
  stub `retry: { maxRetries: 0 }` being honored, DO
  instance-replacement timing) remain staging measurements
  for the deployment/activation gates (I8; R7's condition).
  The fence's offline proof is about the candidate's own
  admission logic, not about platform delivery.
- The `keyFor() === null` adoption defect remains a
  separately tracked pre-existing defect, NOT repaired here
  (R7).
- A numeric assurance read-back remains observation evidence,
  not proof of delivery or registration identity (R6).
- The deployment proposal remains a separate, non-operative
  gate: this round claims and exercises no deployment,
  staging, trigger, activation, or production authority.
