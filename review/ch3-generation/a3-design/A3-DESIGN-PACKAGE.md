# A-3 DESIGN PACKAGE — independent scheduled drive entry (revised direction)

Case #10 / P8 (issue #15). Prepared by Wren, 2026-11-16, on Julie's
design-drafting GO (board 6921189395), under Rowan's assessment ruling
(DOCUMENTARY PASS WITH QUALIFICATIONS; REVISED A-3 DESIGN DIRECTION
ACCEPTED; verbatim board 6920417597) and its requirements D1–D8.
Handoff: RT-H-20261116-54c191
Review pin: PIN-SLOT (repo `jedavid33-design/opal-reader`, branch `ui1-review`;
the Dropbox copy carries the filled pin — the only difference between copies).
Source basis: the deployed build `8a16def4` tree (`a1-build/candidate-tree/`).
References are to `v2/worker-entry-prod-d6.js` (entry), `v2/coordinator.mjs`
(coordinator), and `v2/generation/service.mjs` (service) as named.

**Status: DESIGN ONLY.** No implementation, deployment, trigger
configuration, or production action is authorized by this package or by
Julie's drafting GO. The gate chain is §13.

## 0. Summary

A-3 supplies the one thing the current implementation lacks: a drive entry
that does not depend on the Durable Object alarm registration existing. A
Cloudflare Cron Trigger (every 30 minutes) invokes the worker's `scheduled()`
handler, which asks the production coordinator — through a fenced internal
route — to run a **check**: if the native alarm chain is healthy, the tick
records a skip and does nothing; if intervention is due, the tick runs **one
drive pass through the same shared implementation the native alarm uses**,
under a new execution fence, with the entry kind recorded. The pass's own
arming restores the native chain. A-3 does not automate A-1's evaluation,
does not widen any generation authority, and does not resolve
`outcome_unknown` occurrences. Expected recovery latency for a future
P-ABSENT/P-STALE event is bounded by grace + cadence (≈ 40 minutes at the
proposed constants) as a design expectation, **not** a guaranteed maximum
recovery time.

## 1. Current-state mechanics the design builds on (source-grounded)

- The DO class's `alarm()` (entry:2030) is the sole drive entry. Its body:
  `super.alarm()` (base schedule processing: snapshot all due pending
  schedule rows, process each with awaits between rows, mark done after
  processing; poison rows back off and eventually park as `schedule_dead`),
  then the containment gate (`containmentDriveSuppressed` — DRIVE_CONTAINED /
  CHAIN_STOPPED / unverified suppress the drive; the pass records stage
  `contained`, driveInvoked 0), then `service.recover()` + `service.driveOnce()`,
  then a pass record via `_recordDrivePass` (stage, driveInvoked, outcomes,
  error fields, `armedAfter`). On a throw it records, then rethrows (platform
  alarm-retry semantics preserved).
- Base processing runs in EVERY containment state by design ("so leases
  still close in-flight grants"); containment suppresses only the drive
  (new grants / plan advancement). In CHAIN_STOPPED the native chain does
  not run at all in practice, because the containment stop deletes the
  registration.
- The base alarm's `finally` re-arms unconditionally (`_armAlarm()` at the
  earliest pending due) and ensures a watchdog row exists. Arming elsewhere
  happens only inside operations (`_armAlarmIfEarlier` at the wake call
  sites: `handleCommand`, `requestGrant`, `handleReport`). Reads never arm.
- `driveOnce` has exactly one caller (the entry's alarm handler). Schedule
  processing likewise runs only from the base alarm. **Fencing the drive
  entry therefore fences every schedule-processing and drive path.**
- The recorder's pass rows are written by the entry part; the A-1 repair
  derivation (coordinator) reads recorder rows for its RC-2 discharge rule
  (two consecutive complete passes strictly after an intent's completion).
- Platform facts verified 2026-11-16 against Cloudflare's documentation:
  Cron Triggers on Workers Free — **5 per account** (this design uses 1);
  **CPU time per cron invocation 10 ms** on Free (time waiting on fetch/DO
  calls does not count); cron wall time up to 15 minutes; trigger
  configuration changes can take **up to 15 minutes to propagate**; cron
  deliveries carry **no platform retries**; Workers Free requests
  100,000/day; DO (SQLite) requests 100,000/day, rows written 100,000/day.
  Durable Object per-request CPU (30 s class) is where drive passes already
  run in production today (passes 452–505, including backlog cascades).

## 2. D1 — Constructions compared; selection

**Construction A — registration restoration only.** The tick checks
`getAlarm()`; if absent or long past-due, it re-registers an alarm and lets
the native machinery work. Rejected as the sole mechanism: it restores the
*registration*, but the work still depends entirely on successful alarm
*delivery*. If the platform's delivery path is the impaired component (the
S-3 evidence cannot exclude this — the mechanism is undetermined), A alone
re-arms a mechanism that may not fire, and the tick has no way to know.
Rowan's D1 instruction prohibits claiming independence for this shape.

**Construction C — unconditional duplication.** Every tick runs a full
drive pass regardless of chain health. Rejected: it doubles drive cycles in
health (cost, evidence noise, needless contention with the native chain)
and contradicts the ruling's stated preference for a conditional backup.

**Construction B — conditional direct fallback through the shared, guarded
drive implementation. SELECTED.** The tick evaluates a health predicate
(§3); in health it skips. When intervention is due it runs one drive pass
through the *identical* code path the native alarm runs (the alarm body,
extracted as a shared `_drivePass(entryKind)`), under the execution fence
(§4), after the containment pre-check (§5). Independence: the fallback pass
is invoked by the cron delivery → worker → DO route; it does not use alarm
delivery at all. Behavior when alarm delivery remains impaired: fallback
passes continue to occur at each due tick (schedule work, adjudication, and
generation continuation all proceed at 30-minute cadence), while each pass
also re-arms the native registration (§7), so the low-latency chain resumes
the moment delivery works again. The design claims independence for the
*fallback*, never for the native chain.

## 3. The tick algorithm

Worker export `scheduled(controller, env, ctx)`: builds one internal
request to the production coordinator stub — `POST /v2/d6-scheduler-tick`,
operator-credential fenced (the credential is attached from `env` server-
side; the route refuses the client token class exactly as the other
operator routes do) — and returns. Worker-side CPU is a few storage-free
operations plus one stub call (well under the 10 ms cron CPU budget; the
DO wait does not count). A transport failure at this level is caught,
logged as a structured Workers Logs line (§8), and swallowed — cron has no
platform retry to preserve, and the next tick is the retry (§5, WAIT law).

Inside the coordinator (the tick method on the DO class), in order:

1. **Activation check.** Read `d6_scheduler_state`. If not active →
   scheduler-log `skip_inactive`; return. (Deployment is dormant by
   default; §9.)
2. **Containment pre-read** (verified read of the durable containment
   state, the same projection the drive diagnostics use):
   unverified/failed → scheduler-log `skip_containment_unverified`; return
   (fail closed). CHAIN_STOPPED → scheduler-log `skip_chain_stopped`;
   return — no pass, no registration, no resurrection (§5).
3. **Intervention predicate.** Read `armed = getAlarm()`, the newest pass
   row (`at`, `stage`), and `earliestDue` = the earliest `due_at` among
   pending schedule rows (null if none). Intervention is due iff
   `earliestDue != null` AND `earliestDue <= now − GRACE` AND
   (`armed == null` OR `armed <= now − GRACE`), with **GRACE = 10 minutes**
   (two missed native cycles at the observed ~5-minute work-pending
   cadence). Otherwise → scheduler-log `check_skip_healthy` (carrying the
   three observations); return.
4. **Fence.** Acquire the drive fence (§4). If held → scheduler-log
   `skip_fence_held`; return.
5. **Fallback pass.** Run `_drivePass("scheduled_fallback")` — the shared
   implementation (§1), whose internal containment gate applies unchanged
   (in DRIVE_CONTAINED it records a `contained` pass; §5) — releasing the
   fence in a `finally`.
6. **Read-back.** Read `getAlarm()` again; scheduler-log
   `fallback_completed` with the pass's stage and the read-back value
   (`alarm_restored` is recorded as a field of this entry, with the armed
   value, when it is a number). On a pass throw: the pass row already
   carries the error (record-then-log discipline mirrors the native
   record-then-rethrow, minus the rethrow); scheduler-log
   `fallback_failed` with the error name; return without retry.

The native `alarm()` becomes `return this._drivePass("native_alarm")` —
same body, same record-then-rethrow behavior, plus the fence and the entry
kind. No other native behavior changes.

## 4. D2 — The shared execution fence

Cloudflare's concurrent-alarm-handler guarantee does not cover
alarm-vs-fetch-vs-scheduled overlap, and the base alarm snapshots due rows
before awaiting their processing — so overlap is a real hazard the design
must fence, not argue away.

**Mechanism.** A singleton row `d6_drive_fence` in the coordinator's SQLite
storage: `{ holder_token, acquired_at, expires_at }`. Acquisition and
release run inside synchronous transaction stretches in the codebase's
existing `_tx` discipline (no awaits inside; atomic against every other
coordinator operation): acquire succeeds iff no row exists or its
`expires_at` has passed; the acquirer writes its token with
**FENCE_LEASE = 10 minutes**. Release deletes the row iff the token
matches. The fence is acquired inside `_drivePass` before `super.alarm()`
and released in its `finally` — so it covers base processing, recovery,
and driveOnce as one unit, for BOTH entry kinds. Commands and reports do
not process schedule rows (they only arm), so they need no fence; their
existing internal transactions are unchanged.

**Case analysis** (each is a battery test, §11):
- *Native vs scheduled overlap:* one acquires; the other records its skip
  (native: a pass row with stage `fence_skip`, never `complete`, so it
  cannot satisfy RC-2; scheduled: scheduler-log `skip_fence_held`) and
  returns normally — no throw, no platform retry storm.
- *Duplicate cron deliveries:* the second tick sees either the fence held
  (skip) or, arriving after the first pass completed, a healthy predicate
  (the pass re-armed and processed the due work) → `check_skip_healthy`.
- *Delayed events:* a tick arriving late evaluates the predicate on
  current state; staleness of the event itself is irrelevant.
- *Instance replacement:* the fence row is durable (SQLite), not in-memory;
  a holder that died with its instance leaves a lease that expires within
  FENCE_LEASE, bounding the wedge. Pass rows and schedule rows are
  likewise durable.
- *Interrupted pass:* rows not yet marked done remain `pending` (the base
  marks done only after processing); the next admitted pass — native or
  scheduled — resumes them. Per-row processors re-read current state
  before acting (the lease case breaks on terminal grants; the handoff
  verdict applies only to state re-read inside one transaction; grant
  issuance is transaction-wrapped with rollback on illegal transitions),
  so resumed processing does not double-dispatch: the outbox
  attempted-fence, claim fence, and quota fences inside the single
  admitted pass remain the only dispatch path.
- *Failed pass:* the pass row records the failure stage; the fence is
  released by the `finally` (or expires); poison schedule rows already
  back off / park as `schedule_dead` under existing machinery. The next
  tick or native alarm proceeds normally.

No double dispatch, duplicate provider expenditure, duplicate schedule
processing, or conflicting binding publication follows from any overlap
case: at most one pass executes at a time, and within a pass all existing
fences apply unchanged (§6).

## 5. D3 — Containment and WAIT law

The native alarm calls `super.alarm()` BEFORE its containment gate, so
invoking the existing alarm method is not, by itself, safe scheduled
admission. The tick therefore pre-reads containment (§3 step 2) BEFORE any
base schedule work or registration can occur:

- **NORMAL:** the tick proceeds per the predicate; a fallback pass runs
  only work the standing operating posture permits (all internal fences
  apply; §6).
- **DRIVE_CONTAINED — specified maintenance behavior:** the tick may
  invoke the pass; base adjudication continues exactly as containment's
  own design intends (leases close in-flight grants in every state), and
  the pass's internal gate suppresses the drive, recording stage
  `contained` with driveInvoked 0. The drive hold is not circumvented —
  the same gate that governs a native pass in this state governs the
  scheduled one. (This is the design's one DRIVE_CONTAINED behavior
  choice; it is flagged for Rowan's explicit review in §14 rather than
  inherited silently.)
- **CHAIN_STOPPED:** the tick does nothing — no pass, no base processing,
  no registration. A stopped chain is never resurrected by the scheduler.
- **Unverified containment:** fail closed — skip, log, return.

**WAIT law.** A tick that observes a platform fault — transport failure
reaching the coordinator, or a DO error before processing — records it
(`transport_failure` in Workers Logs at the worker level; `fallback_failed`
if the pass began) and exits. No retry inside the tick, no escalation, no
state change attempted as a "fix". The 30-minute cadence is the retry.
Ambiguous outcomes are reported as observed; the scheduler never
manufactures certainty.

## 6. D4 — Generation and accounting safeguards

The scheduled path adds an *entry*, not an authority. A fallback pass is
the identical implementation as a native pass: GENERATION_HALT wiring
(halted ⇒ no `sendGrant`, nothing leaves the outbox), S1 book-onboarding
enforcement, the quota guard (100/day, 12-slot cohort rule), the phase
guard and per-phase budgets, the $50 monthly cap, claim/execution/
reservation fences, and the job/occurrence state machines all apply
unchanged, because they live inside the pass, not in the entry. The tick
itself can submit nothing, resolve nothing, and change no setting: its
only writes are the scheduler log, the fence, the activation-gated pass,
and whatever that pass's existing machinery does. `outcome_unknown`
occurrences are never auto-resolved or resynthesized by the scheduler —
the pass adjudicates leases through the existing machinery (which is
adjudication, not resolution). Book scope, lane, submission authority,
the Chapter 6 milestone, and the second-chapter restriction are unchanged.

## 7. D5 — Alarm restoration

Restoration is intrinsic to a pass: the base alarm's `finally` re-arms via
`_armAlarm()` at the earliest pending due and ensures a watchdog row
exists. The scheduler never calls `setAlarm`/`deleteAlarm` itself —
registration ownership stays with the coordinator's existing arming code,
including its revision fence (`_bumpAlarmRevision` discipline shared with
A-1). After a fallback pass the tick reads back `getAlarm()` and records
the value (§3 step 6): restoration is thus *evidenced*, not assumed. A
healthy chain is never overwritten by the scheduler: the predicate skips
whenever the registration is present and timely (§3), and within a pass
the arming code only moves the registration to the earliest due under its
own rules. A-1's HELD-only, P-STALE-only contract is untouched (§8's
evidence amendment aside, A-1's code and predicates do not change).

## 8. D6 — Recorder and repair evidence

- **Pass rows gain `entry_kind`** (`native_alarm` | `scheduled_fallback`),
  written by `_recordDrivePass` from the `_drivePass` argument. All
  existing fields are unchanged. A pass row with entry_kind
  `scheduled_fallback` is evidence a *scheduled* pass ran — it never
  masquerades as native alarm delivery.
- **Scheduler log** — a new append-only table `d6_scheduler_log`
  `{ id, at, kind, detail_json }`, kinds: `skip_inactive`,
  `skip_containment_unverified`, `skip_chain_stopped`,
  `check_skip_healthy`, `skip_fence_held`, `fallback_completed`,
  `fallback_failed`. Checks and skips exist ONLY here, never as pass rows.
  Retention follows the pass-row retention discipline.
- **RC-2 protection (named amendment, requires Rowan's approval):** the
  A-1 derivation's discharge-qualifying passes are restricted to
  `entry_kind = "native_alarm"` AND stage `complete`. Scheduled passes can
  therefore never discharge an A-1 intent, and "autonomous alarm-chain
  recovery" findings may cite native passes only. The direction is
  conservative (it can only make discharge harder to claim, never easier).
  The coordinator's repair part is otherwise unchanged.
- **Pre-coordinator failure visibility:** when the worker cannot reach the
  coordinator, no DO row can be written — the tick's structured Workers
  Logs line (observability is enabled and persisted on this worker) is the
  independent record, and the existing weekly peek's failed-read reporting
  already surfaces DO unreachability. This boundary is stated, not
  papered over: pre-coordinator failures are visible in logs, not in the
  scheduler log.
- The drive diagnostics projection (service) surfaces `entryKind` on pass
  rows so the evidence is readable on the existing operator surface.

## 9. D7 — Scope, admission, operating cost

- **Entry surface:** the platform-invoked `scheduled()` export is the only
  scheduler entry; it accepts no client input and exposes no parameters.
  Its internal route is operator-credential fenced and additionally gated
  by the activation record — an external caller without the operator
  credential receives the standard operator refusal, and even a called
  tick with activation off is a logged no-op. The tick targets the
  production coordinator instance through the existing stub routing
  (account instance), never a client-chosen instance.
- **Activation semantics:** a dedicated record `d6_scheduler_state`
  `{ active, updated_at, authorization_ref, reason }`, written only via a
  new operator route `POST /v2/d6-scheduler-activation` whose contract
  mirrors the containment POST (closed allowlist `{active,
  authorizationRef, reason}`; authorizationRef required nonblank; reason
  required when deactivating is NOT required — reason required on every
  write, mirroring containment's stricter reading is left to §14).
  **Deployment ≠ activation:** the code ships dormant (no trigger exists;
  activation record defaults to inactive; a tick with no trigger never
  occurs, and a stray tick with activation off logs `skip_inactive`).
  Activation is its own gate (§10).
- **Cost (verified figures, §1):** 1 of the account's 5 free cron triggers;
  ~48 ticks/day against 100,000 requests/day; ~48 scheduler-log rows/day
  against 100,000 DO rows written/day; worker CPU per tick is a few reads
  plus one stub call (waiting does not count) against the 10 ms cron CPU
  budget; fallback passes occur only on intervention and cost what a
  native pass costs. No paid feature is used anywhere in this design.

## 10. D8 — Deployment, activation, disablement, verification

**Deployment gate (dormant code)** — mirrors the A-1 deployment discipline:
pre-flight census; exactly ONE upload attempt (a proven non-landing
consumes it); at most ONE conditional observability PATCH; full read-backs
(build, etag, bindings, observability). The deployment creates NO trigger
and does NOT touch the activation record. Rollback target: the pre-A-3
live build `8a16def4` redeployed from its pinned tree (repair/scheduler
tables remain in place, inert — the old build never reads them; a trigger,
if ever created, is removed as part of any rollback).

**Activation gate** — two counted acts, each read back:
(1) `POST /v2/d6-scheduler-activation` {active: true, authorizationRef:
Julie's activation-GO record} → read back via the tick surface/diagnostics;
(2) create the Cron Trigger (`*/30 * * * *`) via the Cloudflare API →
read back the trigger list. Activation is not declared effective until a
tick is OBSERVED in the scheduler log (propagation can take up to 15
minutes). Julie attends the activation window; the first fallback pass
against the live S-3 condition — which will adjudicate Chapter 6's lease
through the existing machinery — is observed under the milestone
verification protocol, not treated as a routine tick.

**Emergency disablement:** act 1 — activation record set inactive via the
operator route (effective at the next tick, immediately; THIS is the real
stop fence). Act 2 — trigger removal via the API (propagates up to 15
minutes). A late scheduled event arriving after disablement hits step 1 of
the tick algorithm and logs `skip_inactive` — safe by construction, proven
in the battery (T-A3-08). Trigger removal alone is never treated as the
stop fence.

**Verification:** (i) the offline battery (§11) on the house harness;
(ii) a staging coexistence trial (staging worker: deploy dormant →
activate → with a healthy simulated chain, ticks record
`check_skip_healthy` only; deactivate → late ticks record `skip_inactive`);
(iii) production activation observation as above. **No production fault is
intentionally induced** — P-ABSENT/P-STALE recovery in production is
verified against the pre-existing S-3 condition at activation (observed,
not manufactured), and in simulation only in the battery/staging.

## 11. Proposed offline test battery (house harness, real node:sqlite; synthetic fixtures only)

- **T-A3-01 Healthy skip** (D1): registration present and timely, due work
  pending → tick logs `check_skip_healthy`; no pass row; no schedule row
  processed.
- **T-A3-02 P-ABSENT recovery** (D1/D5): no registration, overdue pending
  rows → one fallback pass processes them; entry_kind
  `scheduled_fallback`; the pass re-arms; tick read-back records a numeric
  registration.
- **T-A3-03 P-STALE recovery** (D1): past-due registration beyond grace →
  same as T-A3-02.
- **T-A3-04 Alarm-delivery impaired** (D1): registrations are restored by
  passes but deliveries are simulated never to fire → subsequent due ticks
  still run fallback passes; work progresses at cadence. (Independence
  proof.)
- **T-A3-05 Fence overlap** (D2): a native entry and a scheduled entry
  race → exactly one pass executes; the other records its fence skip; no
  schedule row is processed twice; no duplicate dispatch.
- **T-A3-06 Duplicate + delayed ticks** (D2): the same tick delivered
  twice, and a tick delivered 20 minutes late → second/late ticks skip on
  fence or predicate; effects identical to a single tick.
- **T-A3-07 Interrupted pass + fence expiry** (D2): a pass dies holding
  the fence → before expiry, entries skip; after expiry, the next entry
  proceeds; unprocessed rows resume; no double processing.
- **T-A3-08 Containment matrix** (D3): NORMAL proceeds; DRIVE_CONTAINED →
  pass records `contained`, driveInvoked 0, leases adjudicate;
  CHAIN_STOPPED → tick logs `skip_chain_stopped`, no pass row, no
  registration write; unverified containment → `skip_containment_
  unverified`, nothing runs.
- **T-A3-09 Activation semantics** (D7/D8): dormant code + a tick →
  `skip_inactive`; after activation, ticks act; after deactivation, a
  late tick → `skip_inactive` and no pass.
- **T-A3-10 RC-2 protection** (D6): an A-1 intent followed by two complete
  scheduled passes → NOT discharged; followed by two complete native
  passes → discharged.
- **T-A3-11 Chapter 6 adjudication fixture** (D4/D8): a synthetic replica
  of the S-3 stall (expired lease, `dispatching` attempt, 10 ready /
  1 granted / 3 pending) → one fallback pass → occurrence
  `outcome_unknown` with in-line reconciliation, job `outcome_unknown`,
  3 pending untouched, zero provider expenditure, exactly one binding for
  every ready occurrence.
- **T-A3-12 WAIT-law tick** (D3): coordinator unreachable / pass throws →
  the tick records the failure, performs no retry and no state change;
  the following tick behaves normally.
- Standing suites must stay green on the composed tree: containment 42,
  P2, R5A, V-3, S1 9, A-1 48 (with the §8 derivation amendment's own tests
  updated deliberately, never silently).

## 12. Implementation boundaries

Exactly **three** existing parts change; every other part of the live
build's tree remains byte-identical (the A-1 discipline):
1. `v2/worker-entry-prod-d6.js` — the `scheduled()` worker export; the
   internal tick route; the activation operator route; `_drivePass`
   extraction with entry kind; the fence, scheduler state, and scheduler
   log (new idempotent tables in the DO's storage); `_recordDrivePass`
   writes `entry_kind`.
2. `v2/coordinator.mjs` — ONLY the repair derivation's qualifying-pass
   filter (§8). No predicate, halt, or strike logic changes.
3. `v2/generation/service.mjs` — ONLY the drive diagnostics projection
   surfacing `entryKind` on pass rows.
Trigger configuration is platform configuration, not code, and is created
only in the activation gate (§10). The implementation phase must enumerate
each part's diff against the live tree before review, as prior builds did.

## 13. Gate chain from here

Design review (Rowan) → Julie's implementation GO (offline build only) →
build + battery → Rowan's implementation review → deployment-proposal
round → Julie's deployment GO → dormant deployment → activation proposal
→ Julie's activation GO (attended) → production observation incl. the
Chapter 6 adjudication under milestone verification → the milestone's own
completion path (which, on the expected branch, includes Julie's separate
`ResolveOutcomeUnknown` decision). WS2/Batch is untouched by every step.

## 14. Open questions for Rowan

1. §5's DRIVE_CONTAINED specification (invoke the pass; its internal gate
   suppresses the drive) vs the stricter alternative (skip entirely in
   DRIVE_CONTAINED as in CHAIN_STOPPED). The design selects invoke, on
   containment's own adjudication-continues semantics; confirmation or
   correction requested.
2. §8's RC-2 qualifying-pass amendment (native-only) — a deliberate change
   to A-1's evidence semantics in the conservative direction; approval or
   an alternative (e.g., procedural-only) requested.
3. Constants: GRACE 10 minutes; FENCE_LEASE 10 minutes; cadence 30
   minutes. Proposed, not derived — confirmation requested.
4. The activation route's reason requirement (mirror containment exactly:
   authorizationRef always; reason always) vs reason-on-deactivation-only.
5. Tick transport: internal fetch with the operator credential (selected,
   for codebase consistency) vs DO RPC if the implementation phase finds
   the parts already expose a suitable stub method.

Turn: Rowan's (design review). Julie pokes.
