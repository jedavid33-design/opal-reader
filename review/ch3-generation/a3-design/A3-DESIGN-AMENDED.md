# A-3 DESIGN PACKAGE — AMENDED (M1–M8)

Case #10 / P8 (issue #15). Prepared by Wren, 2026-11-16, amending the A-3
design package (pin `b5ef92c8e53527a40d2a3f2d4bddcbf442bbd5a1`) under
Rowan's ruling on it (PASS WITH REQUIRED DESIGN AMENDMENTS; verbatim board
6921482971). Julie's design-drafting GO (board 6921189395) covers this
documentary round.
Handoff: RT-H-20261116-b837df
Review pin: PIN-SLOT (repo `jedavid33-design/opal-reader`, branch `ui1-review`;
the Dropbox copy carries the filled pin — the only difference between copies).
Source basis: the deployed build `8a16def4` tree (`a1-build/candidate-tree/`).
Platform basis: Cloudflare documentation as cited in §2 (checked 2026-11-16).

**Status: DESIGN ONLY.** Construction B, the 30-minute cadence, and the
10-minute grace (provisionally) stand as accepted. Nothing here authorizes
implementation, deployment, trigger configuration, or any production action.

## 0. Amendment map

- **M1 (fence rejected)** → §3: the expiring lease is REPLACED by a
  per-instance, non-expiring in-memory active-pass guard (promise-chain),
  with exactly one acquisition point; instance-replacement behavior
  established from platform documentation, including old in-flight effects.
- **M2 (collision + replay)** → §4: owner-exit registration assurance +
  native guard-waiting close the consumed-registration interleaving;
  sequential replay after interruption is analyzed per schedule-row kind;
  no exactly-once claim is made anywhere.
- **M3 (admission boundary)** → §5: DRIVE_CONTAINED scheduled behavior is
  now SKIP; final admission re-validation inside the guard; the in-flight
  boundary is defined; mid-flight state changes are specified per stage.
- **M4 (predicate)** → §6: observations and classifications are separated
  into an explicit table that uses the latest pass row; read failure is
  never P-ABSENT; anomalous registrations are report-only; grace is
  evaluated against the actual constants (WATCHDOG_PERIOD_MS 10 min,
  work-pending cadence ~5 min, ALARM_STALE_THRESHOLD_MS 60 min).
- **M5 (transport/identity/WAIT)** → §7: the tick route is DO-internal
  only (path outside the public dispatcher's forwarded set, explicitly
  denied there); platform-derived tick identity + duplicate suppression +
  activation epochs; runtime automatic retries addressed with controls;
  WAIT law specified in four branches.
- **M6 (RC-2/recorder migration)** → §8: full-sequence adjacency;
  backward-compatible migration with a recorded watermark; unknown kinds
  fail closed; pruning protects qualifying pairs; scheduler-log failure
  isolation.
- **M7 (activation/disablement/rollback)** → §9: authorizationRef AND
  reason required on every change; a read-only status surface; the
  four-stage disablement record; rollback ordering; pre-activation census
  with an S-3 classification return.
- **M8 (cost/tests/boundary)** → §10 (measured-cost commitments),
  §11 (battery expanded to T-A3-01…25), §12 (boundary reconciled).

Sections 1, 2, and the D4 safeguards analysis of the original package are
carried forward unchanged in substance and restated briefly where the
amendments touch them.

## 1. What A-3 is (unchanged)

A Cron Trigger (every 30 minutes) invokes the worker's `scheduled()`
handler, which delivers one tick to the production coordinator. The tick
observes the native alarm chain; in health it records a classified skip;
when intervention is due it admits ONE drive pass through the shared
implementation the native alarm uses (`_drivePass(entryKind)`), whose own
arming restores the native chain. A-3 adds an entry, not an authority:
every generation, accounting, and containment fence inside a pass applies
unchanged; the tick can submit, resolve, and configure nothing. Expected
detection-plus-entry latency for a future P-ABSENT/P-STALE event is
grace + cadence (≈ 40 minutes) as a conditional expectation, **not** a
recovery SLA.

## 2. Platform facts relied on (Cloudflare documentation, checked 2026-11-16)

- **One active instance per Durable Object name.** The runtime guarantees
  at most one instance of a given object is running at any moment;
  requests for that name route to it. In-memory state is preserved only
  while the object remains in memory; inactive objects can be evicted,
  and on code update the default strategy is `deferred` (max_delay
  300 s), after which — or sooner, on a reset — a fresh isolate is created
  and in-memory state is discarded. Termination ends the old instance's
  execution: it cannot continue initiating effects afterward. Storage
  (SQLite) persists across incarnations.
- **blockConcurrencyWhile** blocks ALL other events until its callback
  finishes and has a 30-second timeout after which the object resets.
  It is therefore used in this design NOWHERE new (considered and
  rejected for the drive path, per the ruling; its legitimate home is
  bounded constructor initialization).
- **Automatic retries for DO calls** (runtime behavior announced
  2026-11-05): `fetch()` and RPC stub calls failing with a retryable
  error BEFORE reaching the object are retried up to 4 times, no retry
  starting more than 10 s after the initial call; errors thrown by the
  object's own code and `.overloaded` errors are not retried. If delivery
  is uncertain, the retry is REJECTED by the object if the first attempt
  arrived — a method never runs twice because of a retry unless marked
  `retryable()`. Per-stub limits are configurable via
  `get()`/`getByName()` with `retry: { maxRetries: 0..10, timeoutMs }`.
- **Alarm delivery:** alarms fire at least once; a throwing `alarm()`
  handler is retried by the platform (up to 6 attempts, exponential
  backoff). `getAlarm()` can return null during an executing alarm
  handler (per the assessment ruling's qualification, carried here).
- **Cron:** 5 triggers per account on Workers Free (this design uses 1);
  CPU per cron invocation 10 ms on Free (waiting on fetch/DO calls does
  not count); wall time up to 15 minutes; configuration changes can take
  up to 15 minutes to propagate; cron deliveries carry no platform
  retries of their own.
- **Source constants:** `WATCHDOG_PERIOD_MS` = 600,000 (10 min);
  `ALARM_STALE_THRESHOLD_MS` = 3,600,000 (60 min, the R5a past-due
  disjunct); `DRIVE_PASS_RETENTION` = 288 pass rows;
  `SCHEDULE_MAX_ATTEMPTS` = 8 (poison-row parking).

## 3. M1 — The active-pass guard (replacing the fence)

**Mechanism.** A per-instance, non-expiring guard held in a field of the
coordinator DO class instance: a promise chain (`this._passChain`) plus a
holder record (`this._passHolder = { kind, since, tickIdentity }`).
Acquisition is a synchronous check-and-set stretch (no `await` between
checking the holder and setting it — atomic within the instance because
JavaScript runs the stretch uninterrupted), after which the acquirer
appends its completion promise to the chain. The guard is held for the
ENTIRE asynchronous pass and released in a `finally`. There is no expiry:
a live holder can never be superseded, which removes the rejected lease's
failure mode by construction rather than by duration.

**One acquisition point.** The guard is acquired in exactly one place —
the head of `_drivePass(entryKind)` — for both entry kinds. Everything
before it (the tick's activation, containment, and predicate reads; the
native handler's entry) is observation, not admission. §5 defines what
happens immediately after acquisition (final re-validation), and the
in-flight boundary.

**Asymmetric contention behavior.** The NATIVE entry acquires in `wait`
mode: if a pass is in flight, the alarm handler awaits the chain (the
delivery is already consumed; waiting inside the handler is the handler's
own time, bounded by the in-flight pass, and the platform's alarm-retry
semantics are unaffected — a throw still records-then-rethrows). When the
wait ends it acquires and runs its normal pass (which may find no due
rows and complete as an ordinary, genuinely native, complete pass). The
SCHEDULED entry acquires in `try` mode: if the guard is held, the tick
records `skip_guard_held` and returns — a pass in flight is itself proof
the chain is being driven, so the backup has nothing to do.

**Instance replacement.** If the instance is replaced mid-pass, the
holder dies with the isolate: per §2, the old instance cannot continue
initiating effects after termination, and the new instance starts with an
empty chain. The hazard is therefore not overlap but INTERRUPTION, and it
is handled where it belongs: §4's replay analysis (schedule rows not
marked done remain pending and are re-processed under their per-row
guards) and the effect fences below. Effects the old instance had ALREADY
initiated externally before termination are not retracted by replacement,
and each class is already fenced in the current implementation: queue
sends (the outbox row's `send_attempted_at` is written before invocation;
an attempted row is never re-invoked and is owned by handoff
reconciliation), provider calls (executor attempts are durable rows whose
`dispatching` phase precedes the call; `reconcileHold` blocks any success
report for an attempt left `dispatching`), and storage writes (a
synchronous stretch of writes is atomic; outgoing messages are held by
the output gate until prior writes are durable).

**Durable evidence, not a lock.** At admission (inside the guard, after
final re-validation) the pass writes a durable record `d6_active_pass`
{ kind, started_at, tick_identity } and clears it at exit. This record is
EVIDENCE for the status surface and the disablement record (§9); it plays
no part in exclusion. A record left behind by a killed instance is
reported as `in_flight: unknown (stale record)` — never treated as a
held lock, never blocking a later admission in a new instance (whose
guard starts empty by construction).

**Why not a durable fencing token.** Rowan's condition for a durable
lease — an enforceable mechanism preventing a superseded holder from
initiating further effects — would require every effect site in the drive
to check a fencing token, i.e., changes across the coordinator, executor,
and service parts. The in-instance guard achieves exclusion without
touching effect sites, because the platform's one-active-instance
guarantee makes "another instance's holder" impossible while this holder
lives, and termination makes a dead holder inert. The design selects the
guard and does not carry a durable lease.

## 4. M2 — Collision handoff and replay

**The consumed-registration interleaving, closed.** The ruling's sequence
(scheduled pass re-arms → native fires and consumes the registration →
native finds the guard held → scheduled pass ends with no registration)
is closed by two cooperating rules:
1. **Owner-exit registration assurance.** The last step inside the
   guarded region of `_drivePass` (both kinds, after the pass body, still
   holding the guard) is: if any pending schedule rows exist, call the
   coordinator's existing `_armAlarm()` (the chain's own re-arm path —
   the same method the base alarm's `finally` uses; A-3 introduces no new
   `setAlarm` writer); if none exist, ensure the watchdog row exists
   (the base finally's own rule) and arm to it. Because this runs inside
   the guard, no entry can interleave between a pass's final processing
   and its assurance. Whichever pass exits last leaves a registration
   whenever pending work exists.
2. **Native guard-waiting (§3).** A native entry that arrives during a
   scheduled pass does not discard itself: it waits, acquires, and runs —
   and its own owner-exit assurance re-arms again. The registration the
   native delivery consumed is thus always replaced by a subsequent
   assurance before the chain can go quiet.
Containment is preserved: owner-exit assurance arms only the coordinator's
own schedule machinery; in DRIVE_CONTAINED a scheduled pass never runs
(§5), and a native pass in a contained state behaves exactly as today
(its internal gate governs the drive; base adjudication and arming are
the containment design's own semantics). Earliest-due scheduling is
preserved because `_armAlarm()` arms at the earliest pending due, as
today. Native retry semantics are preserved: `alarm()` keeps
record-then-rethrow.

**Sequential replay after interruption (distinct from concurrent
duplication).** The base alarm marks a schedule row `done` only after its
processor returns; a crash between an effect and the done-write leaves
the row pending, and the next pass replays it. The design claims
**at-least-once row processing with per-row idempotence guards**, never
exactly-once. The guards, per row kind (all pre-existing, verified
against the pinned source during the L-2/assessment rounds):
- *lease:* the processor re-reads the grant and breaks on terminal
  states; voiding is claim-fenced; an already-adjudicated grant cannot
  transition twice (the state machine rejects illegal transitions and
  rolls the transaction back).
- *retry_grant:* re-checks the job is `generating` and counts existing
  retry rows for the grant before issuing; a replay after a successful
  issuance sees the successor and stands down.
- *handoff_check:* re-reads outbox and grant state inside one
  transaction and applies its verdict conditionally on that state;
  replay converges to the same verdict or to `handoff_unresolved`
  parking — never to a second send.
- *watchdog / plan-advance:* arming is earliest-due and idempotent;
  job transitions are revision-checked.
Effects beneath the rows keep their own fences (§3): outbox
attempted-fence, claim fence, `reconcileHold`, `validateAndBind` plus
the (occurrence, revision) binding-conflict fence. Accounting invariant:
reservations are created exactly once per grant row, inside the grant
transaction; replay acts on the same grant row and cannot mint a second
reservation. The battery tests interruption after an effect but before
the done-write for each row kind (T-A3-16).

## 5. M3 — Admission matrix, final boundary, mid-flight changes

**Scheduled admission matrix (initial A-3):**
- NORMAL → eligible for intervention (predicate §6 permitting).
- DRIVE_CONTAINED → SKIP entirely: no scheduled base processing, no
  registration. (This supersedes the original package's §5 choice; the
  ruling's source basis is accepted — the base watchdog can drain the
  outbox and `retry_grant` can request a grant, so a base pass is not
  adjudication-only maintenance, and A-3 introduces no expanded
  maintenance authority in this release.)
- CHAIN_STOPPED → SKIP: no resurrection.
- Unverified containment → fail closed: SKIP.
The native alarm's behavior in every state is unchanged.

**Final admission boundary.** A scheduled pass is admitted — and becomes
IN FLIGHT — at a single point inside `_drivePass`, after ALL of:
guard acquired (§3); activation re-read (still active, same epoch as the
tick's observation); containment re-read (still NORMAL); predicate
re-evaluated on fresh reads (still intervention-due); and the durable
`d6_active_pass` record written. The first due-row snapshot (inside the
base alarm) is the first act of the in-flight pass. Anything failing
re-validation exits before the boundary as a classified skip
(`skip_readmission_<cause>`), never as a pass. The tick's earlier reads
are explicitly demoted to observations that decide whether admission is
*attempted*; they authorize nothing. The native path's boundary is its
guard acquisition plus its existing internal containment gate, unchanged.

**Mid-flight changes.** Once in flight, a pass is NOT interrupted by
containment transitions or deactivation — mirroring the existing native
rule (a pass inside `driveOnce` when a transition lands completes; the
next pass is contained). Per stage: during base processing, cache
construction, `recover()`, `driveOnce()`, or registration (owner-exit
assurance), the rule is identical — the in-flight pass completes,
including its assurance step; the new state governs the NEXT admission.
Deactivation mid-flight is recorded in the disablement record as the
in-flight disposition (§9). A completed scheduled admission confers no
exemption from downstream fences: halt wiring, S1, quota, phase, claim,
and state-machine fences inside the pass apply exactly as for a native
pass.

## 6. M4 — Observations, classifications, and the predicate

**Observations** (raw, per tick): `armed` ∈ { number, null, THREW };
`latestPass` = { at, stage, entryKind } | none; `earliestDue` (earliest
`due_at` among pending schedule rows) | none; `watchdogPending` ∈
{ true, false }; `guardHeld` ∈ { true, false }; `now`.

**Classifications** (exactly one primary per tick; the tick acts only on
INTERVENE):
- `READ_FAILURE` — `armed` is THREW. Log and exit. A failed read is
  never P-ABSENT and never grounds intervention.
- `ACTIVE_ENTRY` — `guardHeld`. Skip (§3 try-mode).
- `NO_PENDING_WORK` — `earliestDue` is none. If `watchdogPending` is
  true → the chain's keep-alive exists: classify HEALTHY_IDLE. If false
  → log `no_schedule_observed` (report-only): the state is NOT silently
  called healthy; it is recorded on every tick it persists, and the
  initial implementation takes no action on it (new work re-arms via the
  existing wake call sites; broader action would need its own
  justification).
- `BACKOFF_OBSERVED` — a complete pass (any kind) finished at or after
  `earliestDue` and the registration is timely: the overdue row is in
  the schedule machinery's own backoff/processing, not a chain failure.
  Report-only.
- `INTERVENE` — `earliestDue <= now − GRACE` AND no complete pass has
  finished at or after `earliestDue` AND (`armed` is null on a
  successful read [verified absent] OR `armed` is a number
  `<= now − GRACE` [overdue registration]).
- `DELAYED_ARMED` — work is overdue but `armed` is a number in
  `(now − GRACE, now + SKEW]`: the native chain will process all due
  rows when it fires. Report-only.
- `ANOMALOUS` — `armed` is a number `> now + SKEW` (future-dated beyond
  clock-skew bound SKEW = 5 min) while work is overdue, OR `armed` is
  later than `earliestDue + GRACE` (inconsistent with earliest-due
  arming). Report-only in the initial implementation (`anomalous_
  registration` log kind); a future registration does not establish
  health, and the initial implementation does not act on unsupported
  cases.
- `PASS_WITHOUT_PROGRESS` — a complete pass finished at or after
  `earliestDue`, work remains overdue, and the registration is absent or
  overdue: report-only in the initial implementation (broader predicates
  require explicit justification).

**Grace evaluation against the real constants.** The native chain arms
~5 minutes out while work pends (observed throughout Chapter 6) and
10 minutes out when idle (WATCHDOG_PERIOD_MS). GRACE = 10 minutes =
two missed work-pending cycles, or one full watchdog period — a chain
that merely runs late is not intervened on; a chain that has missed a
full keep-alive cycle with overdue work is. Detection-plus-entry
expectation ≈ GRACE + cadence ≈ 40 minutes, conditional, not an SLA.

**Restoration evidence (three separate findings).** A fallback pass
records distinctly: (i) the pass outcome (its stage); (ii) the
registration read-back after owner-exit assurance (a number, null, or
THREW); (iii) native resumption — which ONLY a later `native_alarm`
complete pass establishes. A numeric read-back alone does not establish
that the intended registration was restored, remains valid, or that
native delivery resumed, and no A-3 record claims otherwise. The existing
arm-revision discipline (`_bumpAlarmRevision`) and the containment
rechecks are preserved untouched; A-3 adds no independent `setAlarm`
writer (owner-exit assurance calls the existing `_armAlarm()`).

## 7. M5 — Transport, tick identity, runtime retries, WAIT law

**Truly internal transport.** The tick is delivered by the worker's
`scheduled()` handler through the production stub directly to a
DO-internal path, `/internal/d6-scheduler-tick`, on the coordinator's
fetch handler. The public Worker dispatcher forwards only `/v2/*` paths
into the object (all other paths already return `route_not_found` at the
Worker surface, verified in the pinned entry), and the amended design
adds an EXPLICIT denial: any path beginning `/internal/` is refused by
the public dispatcher before routing, regardless of credentials —
including a caller holding the operator credential. The DO accepts the
internal path only because the Worker never forwards it: arrival on that
path implies a direct server-side stub call, and `scheduled()` is the
only caller. No client-controllable instance, scope, generation
parameters, or event identity exist on this path: the instance is the
worker's own configured production coordinator; the event identity is
platform-derived (below); the body carries no parameters beyond that
identity.

**Tick identity, duplicates, epochs.** Identity =
`{cron expression}|{controller.scheduledTime}` — both supplied by the
platform to `scheduled()`, passed through unchanged. The coordinator's
scheduler state records `lastAdmittedTickIdentity` and the current
`epoch` (incremented on EVERY activation, with `epochActivatedAt`). A
tick is admissible only if: activation is on; its identity differs from
`lastAdmittedTickIdentity` (duplicate suppression — a repeated delivery
logs `skip_duplicate`); and its `scheduledTime >= epochActivatedAt`
(a delayed event from before a deactivation logs `skip_stale_epoch`
and can never be authorized by a later activation). One logical tick
admits at most one pass: identity dedupe + the guard + final
re-validation (§5) compose the guarantee, and an ambiguous response to a
previous tick justifies nothing — the next cron delivery is a NEW
logical tick, evaluated fresh on current state.

**Runtime automatic retries.** Per §2, the runtime retries stub calls
that fail before reaching the object, and rejects duplicates when
delivery is uncertain, so an unmarked method cannot run twice from a
retry. The design additionally removes the ambiguity at the source: the
`scheduled()` handler obtains its stub with `retry: { maxRetries: 0 }`,
making the tick exactly one application-level attempt; the tick method
is NOT marked `retryable()`. Residual platform behavior if the retry
option is unavailable in the deployed compatibility configuration:
runtime retries may deliver the tick call more than once at the
transport level, but duplicate suppression (identity) and the guard make
admission idempotent — demonstrated in T-A3-21. The implementation phase
must verify the retry option against the worker's actual compatibility
date and report which branch applies.

**WAIT law, four branches.** (a) *Failure detected by the tick itself*
(transport error, DO error before admission): log, exit, no retry within
the tick, no escalation. (b) *Known fault episode already under WAIT*
(the tick observes the 1101 signature / DO unreachability): the tick
records its observation in the scheduler log and takes no action;
repeated ticks during the episode do not re-report to chat — reporting
follows the standing WAIT protocol, and the cadence is never treated as
authorization to escalate through a known fault. (c) *Ambiguous
completion of a previous tick:* the next tick evaluates fresh state; it
neither assumes the previous pass ran nor assumes it did not — the
predicate and guard decide on current observations. (d) *Recovery
readiness after the fault clears:* ticks resume normal classification
automatically; if the chain is still absent, the ordinary predicate
intervenes — that is the standing design behavior under an existing
activation, not a new escalation, and it requires no human re-gate
because activation itself was the gated act.

## 8. M6 — Recorder migration and RC-2

**Migration.** The pass table gains `entry_kind` (TEXT, nullable) via an
idempotent migration in the recorder's schema path: check the column's
presence; add it if absent; safe to interrupt and re-run (a second run
sees the column and does nothing). The migration records a watermark —
the maximum pass id existing at migration time — in a migration record.
Fresh databases create the table with the column and a watermark of 0.
Rollback compatibility: the column is additive; the pre-A-3 build's
recorder writes name their columns explicitly and its reads project
named fields, so old code runs against the migrated table unchanged (the
implementation phase verifies this against the rollback build's source,
and T-A3-22 exercises it).

**Semantics.** Rows with id <= watermark and `entry_kind` NULL are
defined as `native_alarm` (every pre-A-3 row belongs to the native-only
era — including passes 452/453, intent 1's discharging evidence, which
remain usable). Post-migration rows MUST carry an explicit kind written
by `_recordDrivePass` from the `_drivePass` argument. A post-migration
row with NULL or an unrecognized kind makes the derivation FAIL CLOSED
for any intent whose evaluation window includes it (no discharge is
reported; the anomaly is surfaced on the repair status surface).

**Adjacency (the amendment's exact form).** The derivation scans the
FULL retained pass sequence in order — it does not filter first. A
qualifying pair is two ADJACENT rows in that full sequence, both
qualifying-native (explicit `native_alarm`, or NULL at/below the
watermark), both stage `complete`, both with handler-entry timestamps
strictly later than the intent's completion timestamp, satisfying the
existing RC-2 boundary rules. A scheduled pass or a fence-skip row
between two native passes breaks adjacency; such rows are never erased
from the sequence — they are evidence, and their presence is exactly
what the adjacency rule prices in.

**Pruning.** Retention stays 288 rows with one amendment: before
pruning, the qualifying pairs for all recorded repair intents are
computed, and rows belonging to any qualifying pair are excluded from
prune candidates. (Intents are rare and pairs are two rows; the retained
excess is bounded and tiny.) A discharged intent's evidence therefore
survives pruning for as long as the intent record does.

**Failure isolation.** Scheduler-log writes are best-effort: wrapped so
a failure is noted in Workers Logs and can never throw into a pass or
into the native path (the native path never writes the scheduler log at
all). Recorder write failure remains distinct from drive success,
exactly as the existing `_noteDrivePassHealth` discipline already
separates them: a pass whose recording fails is reported as
recording-failed, not drive-failed, and recorder health
(`recordingFailures`) counts write failures only — skip rows and
scheduler-log entries do not touch it.

## 9. M7 — Activation, status, disablement, rollback

**Activation record.** `d6_scheduler_state` { active, epoch,
updated_at, authorization_ref, reason } plus the append-only
`d6_scheduler_events` history (mirroring the containment events
discipline). The operator route `POST /v2/d6-scheduler-activation`
(operator-credential fenced, public surface as an authenticated operator
function) accepts a closed allowlist { action ∈ activate | deactivate |
note_trigger_removed, authorizationRef, reason } with **authorizationRef
AND reason required nonblank on EVERY state change**. Activation and
deactivation are separate authenticated calls; neither is reachable from
the tick path.

**Status surface.** `GET /v2/d6-scheduler-status` (read-only, operator
read class alongside diagnostics — never the tick route) returns:
activation state + epoch + last-change record; last tick { identity,
at, classification }; last fallback { at, stage, read-back finding };
the durable active-pass record (or its stale/unknown form); and the
disablement checklist state (below).

**Disablement record.** A deactivation is tracked in four distinguishable
stages, each an event in `d6_scheduler_events` and visible on the status
surface: (1) `admission_disabled` (the authoritative change — new
admissions stop from this moment); (2) `in_flight_noted` { pass kind +
identity, or none }; (3) `drained` (the in-flight pass, if any, has
completed — recorded when its exit clears `d6_active_pass`, or
immediately if none was in flight); (4) `trigger_removal_confirmed`
(recorded via `note_trigger_removed` after the operator's Cloudflare API
read-back). An inactive transition does not cancel an admitted pass or
retract effects already initiated; stages 2–3 exist precisely to keep
that visible.

**Deployment vs activation; rollback.** Dormant deployment and
activation remain separate gates (deployment: no trigger, activation
record untouched, code dormant — a stray tick with activation off logs
`skip_inactive`). Activation gate: pre-activation FULL production census
repeated; **if S-3 has spontaneously recovered or the milestone state
has changed, the activation returns for classification before any use of
the anticipated recovery scenario.** Activation acts, in order:
(1) activation record → active (read back on the status surface);
(2) Cron Trigger created via the Cloudflare API (read back). Activation
is effective only when a tick is OBSERVED; the first observed tick, the
first successful fallback, and the first resumed native pass are three
distinct verification checkpoints. Rollback ordering is fixed:
deactivate → establish the in-flight disposition (stages 2–3) → remove
the trigger (and confirm, stage 4) → only then roll back code under its
own authorized gate. Code rollback alone while the trigger remains
enabled is prohibited. Trigger propagation (up to 15 minutes) is
retained as a standing qualification on stages involving trigger
changes; the activation record, not the trigger, is the real stop fence.

## 10. M8 (part 1) — Cost: measurement commitments and per-tick accounting

The design commits the implementation/staging evidence to MEASURE, not
assert: Worker CPU per tick (from the staging trial's Workers Logs /
metrics), DO active duration per skip tick and per fallback pass, and
storage operation counts. The design-stage accounting, to be verified by
measurement: a skip tick performs ≈ 6 storage operations (activation
read, containment read, `getAlarm()`, latest-pass read, pending-rows
read, one scheduler-log write) + 1 DO request; a fallback tick adds one
drive pass at exactly the cost a native pass already incurs today.
Cadence volume: ~48 ticks/day against free-tier allowances of 100,000
DO requests/day and 100,000 SQLite rows written/day; scheduler-log
growth ~48 rows/day, pruned under the pass-retention discipline. The
staging evidence package must include the account's existing usage and
remaining headroom (from the standing weekly free-tier check) alongside
the measurements. Free-tier exhaustion behavior is noted: if DO
allowances were ever exhausted, ticks fail as ordinary failed reads
(§7 branch (a)) and the native chain is unaffected — A-3 can degrade to
absence, never to interference.

## 11. M8 (part 2) — Battery specification (house harness, real node:sqlite; synthetic fixtures only)

Carried from the original package: **T-A3-01** healthy skip; **T-A3-02**
P-ABSENT recovery; **T-A3-03** P-STALE recovery; **T-A3-04**
alarm-delivery-impaired independence; **T-A3-05** guard overlap
(native-vs-scheduled); **T-A3-06** duplicate + delayed ticks;
**T-A3-07** interrupted pass (guard released by instance death, work
resumes, no double processing); **T-A3-08** containment matrix (now
including DRIVE_CONTAINED → total scheduled skip, no base processing,
no registration write); **T-A3-09** activation semantics;
**T-A3-10** RC-2 protection (scheduled passes never discharge);
**T-A3-11** Chapter 6 adjudication fixture; **T-A3-12** WAIT-law tick.

Added under M8/M1–M7:
- **T-A3-13 Long pass:** a pass exceeding the former 10-minute lease
  duration still excludes a second entry for its entire span (the
  rejected fence would have failed this).
- **T-A3-14 Consumed-registration collision:** the ruling's M2
  interleaving, step by step — the chain ends with a registration and
  no silent gap.
- **T-A3-15 Instance replacement under ownership:** the instance is
  replaced mid-pass; the new instance admits a later entry; the dead
  holder initiates no further effects; durable state is consistent.
- **T-A3-16 Replay after effect:** for each schedule-row kind, kill the
  pass after the effect but before the done-write; the replay converges
  with no duplicate dispatch, reservation, or binding.
- **T-A3-17 Admission races:** activation flips off, and separately
  containment transitions to DRIVE_CONTAINED and to CHAIN_STOPPED,
  during the tick's asynchronous admission — the pass is not admitted;
  and the same transitions landing mid-flight — the pass completes and
  the next admission obeys the new state.
- **T-A3-18 Epoch-spanning delayed tick:** a tick created before a
  deactivation is delivered after a later reactivation →
  `skip_stale_epoch`; a duplicate of an admitted tick → `skip_duplicate`.
- **T-A3-19 Predicate anomalies:** `getAlarm()` throws (READ_FAILURE,
  no action); future-dated registration with overdue work (ANOMALOUS,
  report-only); missing watchdog with no pending rows
  (`no_schedule_observed`, never silently healthy).
- **T-A3-20 Public-surface rejection:** the internal tick path requested
  through the public dispatcher with no credential, with the client
  token, and with the operator credential → refused in all three cases;
  the same path via direct stub call from `scheduled()` → admitted.
- **T-A3-21 Ambiguous transport:** the tick's stub call fails
  ambiguously after the DO admitted the pass → no second admission from
  that tick; the next logical tick evaluates fresh state and does not
  double-admit.
- **T-A3-22 RC-2 migration:** a populated pre-A-3 recorder (NULL kinds)
  derives intent 1's discharge identically before and after migration;
  a scheduled row inserted between the pair breaks adjacency and the
  discharge is NOT reported; an unknown-kind post-migration row fails
  the derivation closed; pruning retains qualifying pairs; rollback
  build runs against the migrated table.
- **T-A3-23 Mixed evidence + pruning soak:** alternating native and
  scheduled passes over a simulated multi-day window with pruning
  active → derivations remain correct, no row of a qualifying pair is
  pruned, scheduler-log growth is bounded.
- **T-A3-24 In-flight deactivation + rollback sequence:** deactivation
  during a scheduled pass → the four disablement stages record in
  order; the pass drains; trigger removal is confirmed before the code
  rollback step is permitted by the procedure fixture.
- **T-A3-25 Chapter 6 branches:** three fixtures of the S-3 stall —
  (a) unknown-outcome branch (no audio): occurrence `outcome_unknown`,
  job `outcome_unknown`, 3 pending untouched, zero spend;
  (b) cache-adoption branch (audio present at the deterministic key):
  in-line reconciliation adopts, binding published exactly once for the
  intended revision, the job resumes; (c) handoff-uncertain branch
  (probe stays unknown): the grant parks in `handoff_uncertain`, no
  spend, no resynthesis.
Standing suites must stay green on the composed tree: containment 42,
P2, R5A, V-3, S1 9, A-1 48 (with §8's derivation tests updated
deliberately, never silently).

## 12. Implementation boundaries (reconciled)

Three parts change, as originally claimed — re-examined against the
amended design, the deltas are:
1. `v2/worker-entry-prod-d6.js` — the `scheduled()` export (with the
   `maxRetries: 0` stub); the explicit `/internal/` public-dispatcher
   denial; the DO-internal tick handler; the activation operator route;
   the scheduler status route; `_drivePass` extraction with the guard,
   final re-validation, owner-exit assurance, and entry kind; scheduler
   state/events/log/active-pass tables (idempotent); the recorder
   migration and `entry_kind` writes.
2. `v2/coordinator.mjs` — ONLY the repair derivation: full-sequence
   adjacency, watermark semantics, fail-closed unknown kinds, and the
   pruning exclusion for qualifying pairs.
3. `v2/generation/service.mjs` — ONLY the drive diagnostics projection
   surfacing `entryKind` on pass rows.
No other part changes; the coordinator's predicates, halt logic, strike
logic, and effect sites are untouched (the guard makes that possible —
§3). Per the ruling's invitation: if implementation evidence shows a
further part is genuinely required, that returns for review as a
justified boundary change rather than being absorbed silently. Trigger
configuration remains platform configuration, created only at activation.

## 13. Gate chain (unchanged)

Design review of this amendment (Rowan) → Julie's implementation GO
(offline build only) → build + battery → Rowan's implementation review →
deployment proposal → Julie's deployment GO → dormant deployment →
activation proposal (with the §9 pre-activation census) → Julie's
activation GO (attended) → the three activation checkpoints → the
Chapter 6 milestone path (including Julie's separate
`ResolveOutcomeUnknown` decision on the expected branch). A-3 authorizes
none of: ResolveOutcomeUnknown, automatic resynthesis, a Chapter 6
replacement submission, or Chapter 7.

Turn: Rowan's (amended-design review). Julie pokes.
