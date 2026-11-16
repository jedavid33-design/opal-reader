# A-3 DESIGN — TARGETED ADDENDUM answering C1–C8

Case #10 / P8 (issue #15). Prepared by Wren, 2026-11-16, under Rowan's
ruling on the amended A-3 design (CONDITIONAL PASS; verbatim board
6921805690). This addendum amends the amended design (pin
`d3de2def69b1a45c01ec2072015f350ecdbea9b4`) at the points named; settled
decisions (Construction B, 30-minute cadence, provisional 10-minute
grace, the stricter containment matrix, internal transport, separately
gated activation) are not reopened.
Handoff: RT-H-20261116-0c19a9
Review pin: PIN-SLOT (repo `jedavid33-design/opal-reader`, branch `ui1-review`;
the Dropbox copy carries the filled pin — the only difference between copies).

## C1. Instance replacement — cross-instance EFFECT safety

The amended design's §3 assertion is corrected: replacement does NOT
necessarily terminate every old in-flight execution. Per Cloudflare's
known-issues and lifecycle documentation (cited in the ruling), an old
HTTP/RPC invocation may continue running after replacement until it next
accesses Durable Object storage, at which point the loss of authority is
detected. The tick enters through HTTP, so the qualification applies
directly. The in-memory guard is retained for what it actually proves —
same-instance mutual exclusion — and cross-instance safety is established
separately, per effect site, on one structural fact: **every externally
visible effect reachable from a pass is preceded, in the same code path,
by a durable storage write (its intent), and a storage write is exactly
the operation a replaced instance can no longer perform.** A resumed old
invocation therefore cannot INITIATE a new effect after replacement: its
next intent write fails first. Effects initiated BEFORE replacement are
not retracted by this argument — each is governed by its own fence:

| Effect site | Preceding durable intent | Post-replacement behavior / fence |
|---|---|---|
| Queue send (grant delivery) | The outbox row's `send_attempted_at` UPDATE precedes `await send(...)` in `drainOutbox` | A resumed invocation's marker write fails before any new send can be invoked. A send already invoked is ATTEMPTED forever: drains skip attempted rows; handoff reconciliation is the sole arbiter. |
| Alarm registration (`setAlarm`) | Arming occurs inside/after storage operations in the same flow; `setAlarm` is itself a storage-API operation | A post-replacement call fails on authority loss. A registration made before replacement occupies the object's single alarm slot; later arming by the live instance replaces it under the existing arm-revision discipline — the single-slot API makes duplicate registrations impossible by construction. |
| Cache flush (external projection writes) | Flush follows the pass's storage writes; its inputs are read from storage | A resumed flush's storage reads fail before it can compute output. A flush already in flight writes digest-keyed projections: re-writing identical keys with identical values is idempotent, and a second flush from the live instance converges to the same bytes. |
| Provider calls | Never made inside a pass. A pass only SENDS grants (above); provider calls occur in separate executor invocations gated by durable attempt rows (`dispatching` marker precedes the call; `reconcileHold` blocks success reports for attempts left `dispatching`) | The executor's own fences, unchanged; a pass instance's replacement cannot mint a provider call. |
| Tick response | None (a bare acknowledgment to `scheduled()`) | A resumed duplicate tick invocation is refused by the admission watermark (C5) before any effect. |

No distributed-lock architecture is introduced: the enumeration shows
each site's existing intent/fence pair is sufficient, and the battery
proves the two load-bearing sequences (intent-write-fails-first for
sends; single-slot replacement for registrations) rather than assuming
them. **T-A3-15 is amended**: the fixture models a replaced instance
whose outstanding asynchronous operation RESUMES — its next storage
write fails, no new external effect is initiated after that point, and
effects initiated before replacement are inventoried against their
fences. Simulated immediate termination remains as a second case, not
the only one (new T-A3-26 carries the resumed-continuation case).

## C2. Ownership exit, waiter mechanics, and the retry_grant correction

**Collision assurance, narrowly triggered.** The unconditional owner-exit
`_armAlarm()` is replaced: at exit, the pass performs ONE `getAlarm()`
read (a read, not a registration). Assurance fires ONLY IF pending
schedule rows exist AND the read returns null — i.e., a registration was
consumed during the pass (the M2 collision) or never survived it. In a
healthy native pass the read returns the numeric value its own arming
left, and nothing is written: **native behavior, including during
dormant deployment, is byte-for-byte preserved in registrations** (the
single added read is the only delta, and reads never arm). When
assurance fires it calls the existing `_armAlarm()` (no new writer).

**Waiter mechanics, specified.**
- *Timestamps:* a native pass row records BOTH `at` (handler entry,
  pre-guard — the existing field) and a new `admitted_at` (guard
  acquisition). Evidence can therefore distinguish delivery time from
  admission time after a wait.
- *Priority and transfer:* waiters queue on the promise chain in arrival
  order (FIFO). Transfer is atomic: the holder's release and the next
  waiter's check-and-set each occur inside synchronous stretches, and
  the chain orders them — no two holders, no gap in which a third entry
  can slip between release and transfer.
- *Waiter timeout/throw:* the guard imposes NO timeout of its own (a
  timeout would re-create the discarded-delivery problem). The waiting
  handler is bounded by the platform's own invocation limits. If the
  waiting alarm throws or its instance is replaced before acquisition,
  it records a pass row with stage `wait_interrupted` (never `complete`)
  IF it can still write; if it cannot, nothing is recorded and nothing
  is claimed. The chain is safe regardless: the in-flight pass's
  owner-exit assurance (above) leaves a registration whenever pending
  work exists, so a lost waiter never strands the chain.
- *Final registration evidence after a collision:* the exiting pass's
  record carries `exit_armed` (the exit read's value) and
  `assurance_fired` (boolean); a collision is therefore provable from
  the record: a waited native entry exists, `exit_armed` was null, and
  assurance re-armed.
- *Exception preservation and guaranteed release:* the pass body runs
  under a captured-error discipline — the body's error (if any) is
  captured, never replaced. Assurance and evidence writes run AFTER
  capture, each in its own try/catch that cannot throw out of the exit
  path; the guard is released in the innermost `finally`, so release is
  guaranteed even if assurance or recording fails. For the native kind,
  the ORIGINAL error is then rethrown unchanged (platform retry
  semantics preserved); a failure inside assurance/recording is noted
  via recorder health, never substituted for the original error. For
  the scheduled kind, the original error is recorded, not rethrown
  (cron has no retry semantics to preserve), under the same
  non-masking rule.

**retry_grant replay — source correction.** The amended design's §4
claim (that the retry_grant case counts existing retry rows) is WRONG
and is withdrawn; Rowan's reading is correct — the case checks only
that the job is `generating` and calls `requestGrant`, and
`_scheduleReAdvance`'s deduplication governs scheduling of retry rows,
not replay of an executing one. Safety against replay rests instead on
the grant machinery inside `_issueGrant` (verified at the pinned
source), which runs as ONE transaction:
1. **Pending-only target selection:** targets are occurrences in state
   `pending` only. An occurrence granted by the first execution is no
   longer pending; a replay cannot re-target it.
2. **Deterministic grant identity with an existence check:** the grant
   id is `grant:{jobId}:{job.revision}:{probe|full}`; if a grant with
   that id exists, issuance returns `grant_exists` and writes nothing.
   A replay against the same job revision is therefore a no-op by
   identity, not by row counting.
3. **Reservations inside the same transaction, after the duplicate
   check:** a refused replay leaves no grant row, no ledger row, no
   outbox row, and no partial reservation.
If the job revision has advanced between the original execution and the
replay, the differing identity is LEGITIMATE SUCCESSOR work, still
bounded by pending-only selection and the quota/cohort checks inside
the same transaction. T-A3-16 is extended to distinguish the two
outcomes explicitly (same-revision replay = no-op; advanced-revision
replay = successor, singly issued), and new T-A3-29 covers replay of an
already successful retry_grant operation end to end. The at-least-once
processing claim stands; exactly-once is claimed nowhere.

## C3. Final admission as one synchronous stretch; mid-flight stage rules

**The boundary, restated exactly.** The tick's asynchronous observations
end with a single `getAlarm()` read — the LAST asynchronous observation.
Immediately after it resolves, admission executes as ONE synchronous
stretch with no `await` inside it (the codebase's `_tx` discipline over
the synchronous SQLite API): re-read activation + epoch (sync); re-read
containment (sync; must be NORMAL); re-check guard ownership and tick
eligibility (sync, in-memory + watermark); evaluate the predicate's
storage-local inputs (sync); commit the durable tick admission AND the
`d6_active_pass` record in the same transaction; then initiate the
admitted operation by invoking the pass body. Because the stretch never
awaits, no other invocation's write can land inside it: a deactivation
or containment change either landed before the stretch (and is seen by
the re-reads) or lands after initiation (and is governed by the
mid-flight rules). There is no third possibility.

**Mid-flight stage rules, corrected.** The amended design's blanket
"completes identically" statement is withdrawn. The rule is per stage,
and it is the EXISTING native contract, now stated exactly: effects
already initiated are never retroactively cancelled; stages not yet
initiated honor the gates that govern them. Concretely, for a scheduled
pass in flight when containment transitions: base processing already
snapshotted continues (its effects are initiated), BUT the pass then
reaches the drive gate — the containment read that already exists
between `super.alarm()` and `recover()`/`driveOnce()` in the native
body — and a transition landed during base processing is honored
there: the drive is suppressed, the pass records stage `contained`,
and no drive work begins. A transition landing during cache
construction or `recover()` (both after that gate in the body) cannot
un-honor the gate's read; the remaining exposure is a transition
landing after the gate's read but before `driveOnce()`'s first effect —
identical to the native path's existing exposure today (the current
code carries the same window, with the standing rule that the NEXT
pass is contained), and A-3 neither widens nor narrows it. Deactivation
mid-flight follows §9's rule (the pass drains; stages record it). A
completed admission is not an exemption: every downstream fence inside
the pass applies as for a native pass.

## C4. The predicate as an ordered, exhaustive decision table

Observations are corrected to include **`finished_at`** (written by
`_recordDrivePass` at recording time) wherever completion time is used;
the latest-pass observation is { at, finished_at, stage, entryKind }.
The skew rule is corrected: future-ness is judged against the earliest
pending due, never against `now` alone — a legitimate idle registration
is the watchdog's own due (up to WATCHDOG_PERIOD_MS ahead) and is
consistent by construction. SKEW (5 min) bounds only clock disagreement
in comparing `armed` to `earliestDue`.

Ordered rules — first match wins; every tick lands in exactly one row:

1. Guard held → **ACTIVE_ENTRY** (skip).
2. `armed` read THREW → **READ_FAILURE** (log; never P-ABSENT).
3. Activation off / stale epoch / duplicate watermark (C5) →
   **INELIGIBLE** (skip; kinds distinguished in the log).
4. No pending rows, watchdog pending → **HEALTHY_IDLE**.
5. No pending rows, no watchdog pending → **NO_SCHEDULE_OBSERVED**
   (report-only; never silently healthy).
6. Pending rows; `armed` is a number, `armed <= earliestDue + SKEW`,
   `earliestDue > now − GRACE` → **ARMED_TIMELY** (healthy active work
   or timely idle watchdog; skip).
7. Pending rows overdue (`earliestDue <= now − GRACE`); `armed` is a
   number in `(earliestDue + SKEW, now + WATCHDOG_PERIOD_MS]` with
   `armed > now − GRACE` → **DELAYED_ARMED** (report-only; the native
   chain fires at `armed` and processes all due rows).
8. Pending rows overdue; a complete pass has `finished_at >=
   earliestDue`; registration absent or overdue → **PASS_WITHOUT_
   PROGRESS** (report-only — see the limitation below).
9. Pending rows overdue; `armed` is a number `> earliestDue + GRACE`
   or `> now + WATCHDOG_PERIOD_MS` → **ANOMALOUS** (report-only;
   inconsistent with earliest-due arming).
10. Pending rows overdue; no complete pass with `finished_at >=
    earliestDue`; `armed` null on a successful read → **INTERVENE**
    (verified absent).
11. Pending rows overdue; no complete pass with `finished_at >=
    earliestDue`; `armed` a number `<= now − GRACE` → **INTERVENE**
    (overdue registration).

Rows 6–11 partition the overdue/timely space by construction (armed is
null, timely-relative-to-due, delayed, anomalous, or overdue; the
pass-completion test splits 8 from 10/11), so the table is total.
**PASS_WITHOUT_PROGRESS is named an initial-release COVERAGE
LIMITATION, not a recovery class:** A-3 does not self-heal every
possible silence. The condition is visibly reported — it persists on
the scheduler status surface with a consecutive-tick count, and at 48
consecutive ticks (~24 hours) the log kind escalates to
`coverage_limitation_escalated`, which Wren's standing reporting
surfaces to Julie. Intervention in this class requires a future,
separately justified predicate amendment.

## C5. Admission watermark; the WAIT-hold state and its named limitation

**Watermark (replacing the last-identity comparison).** Scheduler state
carries, per epoch, `admittedWatermark` = the greatest admitted
`scheduledTime`. A tick is eligible only if `scheduledTime >
admittedWatermark` AND `scheduledTime >= epochActivatedAt` AND
`scheduledTime <= now + SKEW` AND its cron expression equals the
configured constant (`*/30 * * * *`, verified at admission — a
misconfigured or additional trigger cannot become the scheduler).
Admission commits `admittedWatermark = scheduledTime` in the SAME
synchronous transaction as the admission record (C3), BEFORE any drive
effect. The ruling's counterexample closes: A admitted (watermark =
A.time) → B admitted (watermark = B.time) → delayed duplicate A arrives
with A.time < watermark → ineligible. An interrupted attempt after the
commit has CONSUMED the logical tick; recovery belongs to a later
logical tick, never to a re-presentation of the same one.

**WAIT law — how the scheduler learns.** There is no pre-existing
durable WAIT-episode state in the current implementation, so the design
adds one, deliberately small: `d6_scheduler_state.wait_hold` { active,
declared_at, ref }, set and cleared ONLY through the activation
operator route (new actions `set_wait_hold` / `clear_wait_hold`, same
closed-allowlist contract, authorizationRef + reason required). While
the hold is active, ticks observe and log (classification `WAIT_HOLD`)
and admit nothing. The operator (Wren) sets the hold when Julie
declares WAIT under the standing protocol and clears it only on Julie's
declaration that the episode is over — a successful read by the
scheduler NEVER clears it, and transient connectivity during an episode
admits nothing (T-A3-38). **The precise limitation, returned for
Julie's explicit operational decision:** the hold is only as timely as
the human declaration. Between a fault's onset and the hold being set,
ticks already take no action (their reads fail — amended §7 branch (a)
— or the DO is unreachable), so the ONLY window the hold closes is
*connectivity restored mid-episode, before the episode is declared
over*: without the hold, a tick in that window could admit a fallback
pass while WAIT is still declared. With the hold, that window is
closed at the cost of an operator duty during fault episodes. If Julie
declines the hold mechanism, that residual window stands as a named,
accepted limitation of the initial release; the addendum does not
silently narrow WAIT either way. (Julie's decision is recorded
alongside this round; it does not block the design, because both
branches are fully specified.)

## C6. Migration atomicity, pruning-safe adjacency, evidence-compatible rollback

**Atomic initialization.** The `entry_kind` migration runs as ONE
synchronous storage transaction (read max pass id → write the watermark
record → add the column), inside the recorder's schema path, and it
runs at new-code startup BEFORE any pass can be recorded by the new
build. Interruption before commit applies nothing; a rerun recomputes
the identical watermark, because post-A-3 rows cannot exist before the
column does (the only writer of explicit kinds is the new build, which
cannot record until its schema path has run). A rerun can therefore
never extend the historical watermark over post-A-3 rows.

**Pruning cannot manufacture adjacency.** Pass rows gain a dedicated
`seq` assigned inside the same transaction as the row write
(`seq = max(seq) + 1` over the retained table, seeded from the
migration watermark for historical rows). RC-2 adjacency is defined on
`seq`: a qualifying pair must satisfy `seq2 = seq1 + 1` in the ORIGINAL
sequence. Pruning deletes rows but never renumbers, so deleting an
intervening row leaves a `seq` gap and cannot create adjacency;
protected-pair retention (amended §8) continues to preserve the pairs
themselves as evidence. T-A3-35 proves the manufactured-adjacency case
fails closed.

**Evidence-compatible rollback.** Once any scheduled-kind row exists,
rollback to the ORIGINAL A-1 build is PROHIBITED (it ignores
`entry_kind`: scheduled complete passes could discharge an intent, and
its NULL-kind writes would land beyond the watermark). The permitted
rollback target is a **scheduler-disabled rollback candidate**: the A-3
build itself, deployed with the scheduler never activated (activation
record inactive; no trigger), which retains the amended recorder and
RC-2 semantics exactly — native rows it writes carry explicit kinds,
scheduled evidence is preserved unrelabeled, and intent 1's discharge
(historical pair, watermark semantics) survives migration, retention,
and this rollback unchanged. Rollback to the original build remains
permitted ONLY in the window before the first scheduled row exists
(e.g., a dormant deployment that was never activated), verified by a
census of the pass table at the rollback gate. T-A3-36 exercises both
branches.

## C7. Disablement dispositions; cost claim corrected

The disablement record gains an explicit disposition classification for
any in-flight pass: **`drained_normally`** (the pass's own exit cleared
`d6_active_pass` with its completion record) vs
**`interrupted_or_unknown`** (the record is stale, or was cleared by a
later admission's observation rather than by the pass itself). A stale
record is never reported as a safe drain. Rollback requires the
evidence-based disposition: if it is `interrupted_or_unknown`, the
rollback gate includes a classification step (last pass row, scheduler
log, plan states) before proceeding. Trigger-removal confirmation
before rollback stands.

**Cost claim corrected:** the amended design's §10 sentence implying
the native chain would be unaffected by account-wide free-tier
exhaustion is withdrawn. Exhaustion is an account-level condition that
could affect native operations as well; A-3's obligation is to MEASURE
its incremental usage (the §10 commitments stand) so its contribution
to any shared allowance is known, not to claim isolation.

## C8. Battery additions (deterministic; house harness; synthetic fixtures)

T-A3-01…25 are retained. Added:
- **T-A3-26** Replaced instance, resumed continuation: an old
  invocation resumes after replacement; its next storage write fails;
  no new external effect follows; pre-replacement effects reconcile
  under their fences (extends T-A3-15).
- **T-A3-27** Owner-exit assurance failure: assurance throws → the
  original handler error is rethrown unchanged, the guard is released,
  the failure is recorded as a recording/assurance failure only.
- **T-A3-28** Dormant native behavior: with A-3 deployed and never
  activated, native passes produce registrations identical to the
  pre-A-3 build (exit read is read-only when `armed` is numeric).
- **T-A3-29** retry_grant replay after success: same-revision replay
  returns `grant_exists` with zero new rows of any kind;
  advanced-revision replay issues exactly one successor.
- **T-A3-30** Old duplicate tick after a newer admitted tick:
  watermark rejects it even when the predicate would qualify.
- **T-A3-31** Interruption between admission commit and first drive
  effect: the logical tick is consumed; the next tick is a new logical
  tick and admits (or not) on fresh state.
- **T-A3-32** Containment transition during cache construction /
  `recover()`: the drive gate's read governs; and a transition during
  base processing is honored at the gate (no drive effects after it).
- **T-A3-33** Exhaustive predicate classification: a generated case
  matrix over the observation space lands every case in exactly one
  table row, including the legitimate idle watchdog (armed = watchdog
  due, +10 min, no work overdue → row 6/HEALTHY, never ANOMALOUS).
- **T-A3-34** Interrupted recorder migration: kill between transaction
  steps → rerun yields the identical watermark and column state.
- **T-A3-35** Pruning vs adjacency: prune the intervening scheduled
  row between two native rows → the pair does NOT qualify (seq gap);
  prune outside any window → derivations unchanged.
- **T-A3-36** Rollback after mixed evidence: with scheduled rows
  present, the original-build rollback is refused by the gate fixture
  and the scheduler-disabled candidate preserves derivations exactly,
  including intent 1.
- **T-A3-37** Disablement dispositions: a normally drained pass
  records `drained_normally`; a killed pass records
  `interrupted_or_unknown` and blocks the rollback fixture until
  classified.
- **T-A3-38** Declared WAIT with transient connectivity: hold set →
  ticks during a window of successful reads admit nothing; hold
  cleared only by the operator action → admissions resume.

**Boundary note (per the ruling's invitation):** the corrections above
remain inside the three named parts (the recorder's `finished_at`/`seq`
fields, the watermark, and the scheduler-state hold all live in the
entry part; the derivation's `seq`-adjacency lives in the coordinator
part). No boundary expansion is required by C1–C8; if implementation
evidence shows otherwise, it returns for review.

## Next gate

On Rowan's acceptance of this addendum, the intended next gate is
Julie's offline implementation GO. Nothing in this addendum authorizes
implementation, deployment, activation, or any production action.

Turn: Rowan's (addendum review). Julie pokes.
