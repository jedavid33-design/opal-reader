# S-3 RECOVERY-PATH ASSESSMENT (documentary)

Case #10 / P8 (issue #15). Prepared by Wren, 2026-11-16, under Rowan's HOLD
ruling on the L-2 amended execution package (HOLD — MATERIAL SOURCE
CONTRADICTIONS; verbatim board 6920182264).
Handoff: RT-H-20261116-3674ab
Review pin: PIN-SLOT (repo `jedavid33-design/opal-reader`, branch `ui1-review`;
the Dropbox copy carries the filled pin — the only difference between copies).
Source basis: the deployed build `8a16def42e941790ef2eeb460366bb19ef977801`
tree (`a1-build/candidate-tree/`). References are to `v2/coordinator.mjs`
unless another file is named.

**The HOLD is accepted without reservation. L-2 is WITHDRAWN, not merely
unapproved: its operative act is inapplicable to S-3.** The two blockers were
Wren's errors — the HELD-only operating contract sits in the A-1 feature's own
header comment, which the L-2 package did not check, and the package asserted
P-STALE from recorder-pass age, which is not registration age. No execution GO
is presented to Julie. Nothing in this assessment authorizes any production
action.

## 1. B1 — The deployed repair eligibility contract vs the LIVE posture

The A-1 header contract (coordinator.mjs:466–479) states the terms plainly:
the evaluation's ONLY repairable predicate is P-STALE (P-ABSENT / P-FUTURE /
P-SILENT "are diagnostic observations and never register"), and "the
evaluation acts only in the HELD operating state (GENERATION_HALT === "1"
inside the coordinator; the queue-pause, fault-clearance, authorization, and
exclusive-control conditions are externally enforced execution prerequisites
of any gate that invokes it)". The halt condition is enforced in code at the
evaluation's boundary checks (lines 3253–3254 and again at 3374–3375).

Production posture is LIVE (halt "0", queue unpaused) under the standing
release. An invocation in this posture would be declined
(`held_state_required`, assuming earlier boundary checks pass) — and per the
ruling it was not invoked to confirm this, because a decline can still write
evaluation and projection records. L-1 succeeded because production was HELD
at that time; the Nov 14 release changed the posture, not the contract.
IC-6 scoped A-1's initial release to the HELD state; nothing since has
amended that scope. **B1 stands: the proposed invocation is incompatible
with the deployed implementation in the current posture.**

## 2. B2 — Classification of S-3: P-ABSENT

Predicate definitions (lines 3190–3216): P-STALE requires a **numeric**
registration timestamp sufficiently past due; P-ABSENT is `getAlarm()`
returning null; P-SILENT is recorder silence without a qualifying stale
registration. Only the stale predicate may proceed (lines 3264–3269), and
the final registration boundary independently requires a qualifying numeric
registration (lines 3377–3380).

Whether the diagnostics `armedAt` faithfully represents `getAlarm()`:
**yes.** The drive diagnostics read performs
`armedAt = await coord.state.storage.getAlarm()` directly
(`v2/generation/service.mjs`:1786) and projects the number or null into the
response (line 1890). One caveat at true strength: a *failed* getAlarm()
read also projects null in the `alarm` object (the failure is distinguished
only inside the containment-confidence computation, which is not applicable
in the NORMAL state). A persistent read failure is nonetheless untenable as
the explanation here: the same surface returned numeric values whenever the
chain was healthy, and roughly eighty independent successful reads over
~41 hours (the half-hourly watch plus attended checks) returned null
uniformly while every other field populated normally.

The decisive record: pass 505's own row carries **`armedAfter`
1794690056225** — when pass 505 completed, a registration existed, due
2026-11-14T21:00:56Z. No pass 506 was ever recorded, and `getAlarm()` now
returns null. The registration therefore **vanished unexecuted**; it is not
sitting past-due in storage (which is what P-STALE would show). **S-3 is
classified P-ABSENT.** A-1 cannot repair P-ABSENT even in the HELD state.
The L-2 package's P-STALE assertion is withdrawn: recorder age is not
alarm-registration age.

(For the record, S-2 — the silence L-1 repaired — presented with a numeric
past-due registration and registered P-STALE. S-3 is a different failure
class under the same W-4 symptom pattern: the chain ceased, and this time
the registration itself is gone.)

## 3. Corrected downstream expectations (B3, B4)

### 3.1 B3 — No pending-occurrence progression while the job is unknown

`JOB_TRANSITIONS.outcome_unknown` = { resolve, report_complete,
report_partial, report_failed, cancel, supersede } — **no `grant`**
(lines 59–69). `requestGrant` issues through `_issueGrant` with the `grant`
job event; from `outcome_unknown` that transition is illegal and the grant
transaction rolls back. `_scheduleReAdvance` and the `retry_grant` schedule
case act only for `generating` jobs. `_deriveJobCompletion` keeps a job with
any unknown occurrence in `outcome_unknown`. No D6-specific lawful
continuation path around this was found in the deployed source.

**Corrected expectation for any future revival + lease adjudication:**
**10 ready + 1 outcome_unknown + 3 pending — revival and adjudication may
succeed with ZERO additional chapter generation, and the expected new
expenditure attributable to revival is 0.** The 3 pending occurrences can
be granted only after the job lawfully exits `outcome_unknown` (in
practice: Julie's `ResolveOutcomeUnknown`, which returns the occurrence to
`pending` and the job to `queued` — a separate authorization). The L-2
package's 13/14 progression expectation is withdrawn.

### 3.2 B4.1 — The dispatching marker, restated

The `dispatching` phase marker establishes that the attempt crossed the
pre-dispatch uncertainty boundary (the reserved → dispatching transition was
recorded in the append-only attempt log before the provider call). It does
**not** prove the network invocation began. The attempt remains in the
uncertainty class on either reading, and the classification that matters —
not provably-never-dispatched (which requires all attempts still
`reserved`) — is unchanged.

### 3.3 B4.2 — The no-outbox-row retirement branch is excluded by invariant

The lease case's direct retirement branch (grant → `voided` with no
`_voidDispatch`) requires the outbox row to be **absent**. Invariant: grant
issuance creates the grant row, the outbox `dispatch` row, and the lease
schedule row in one atomic stretch (lines 2234–2358); the outbox row is
deleted only inside `_voidDispatch`; a void is terminal and
transition-logged. This grant stands `issued` and was never voided, so its
outbox row exists, and the retirement branch cannot apply. (With the row
present and `sent_at` null but `send_attempted_at` set, the applicable
branch would be `handoff_uncertain`, not retirement.)

### 3.4 B4.3 — Handoff convergence, corrected

The L-2 package's convergence statement was too strong. Handoff
reconciliation converges only if the queue probe settles (`accepted` /
`not_accepted`) or a claim/report arrives. A persistently `unknown` probe
exhausts bounded retries and logs `handoff_unresolved`; the grant then
**stays `handoff_uncertain`** — safe (no void, no release, no re-grant;
occurrences stay `granted`; the uncertainty is visible on `jobView`) — but
it does not reach the `outcome_unknown` endpoint by that path. In the
observed case the delivered branch remains the expectation on the executor
evidence, and the claim fence governs any `not_accepted` verdict; the
correction is to the claimed necessity, not to the expected branch.

### 3.5 B4.4 — The late-report binding path, demonstrated

Rowan is correct that OCC_TRANSITIONS alone was insufficient: `handleReport`
calls `validateAndBind` **before** applying the occurrence transition
(lines 2691–2699), and `validateAndBind` writes the bindings row itself
(lines 2890–2896). The composite D6 path nonetheless preserves the required
invariants, through five fences:

1. **No success report can be generated for this attempt.** A report is
   assembled only by a live executor finishing a message. On any re-entry,
   the executor's recovery classification for an execution with a
   `dispatching` attempt is `reconcileHold` (`d6-executor.mjs`:414–418) —
   it neither synthesizes nor reports a result for that attempt. The
   service-side scan recovery owns the same classification.
2. **No unverified binding.** `validateAndBind` requires the object to
   exist and every available authoritative digest to agree (cache index,
   write-time record, caller-stated hash); a new recording without a
   verified digest is refused (`digest_unverified`).
3. **No different second binding.** The bindings table is keyed by
   (occurrence_id, revision_key): an existing binding with a different
   cache key returns `binding_conflict_existing` and inserts nothing; the
   same key is an idempotent return. Exactly one authoritative binding per
   occurrence is enforced at the table, not only by the state machine.
4. **No state bypass.** A success result applied to an `outcome_unknown`
   occurrence meets no `report_success` transition; the occurrence's state
   does not move. (Its `cache_key` column could be set by the report path
   if a binding validated — bounded, provenance-recorded as `grant:<id>`,
   and identical to what the lawful exit would adopt; see 5.)
5. **Lawful absorption + reservation fence.** If validated audio for the
   occurrence exists, `reconcileUnknown`'s adopt exit binds exactly that
   deterministic key (idempotently) and moves the occurrence to `ready`
   through the state machine — the designed path for late-landing audio.
   At any report-driven grant closure, the quota fence leaves an
   unknown-billing execution's reservation **open and visible**, never
   silently freed (`settleReservationsForGrant`).

Residual statement, at true strength: in a hypothetical where a success
report somehow arrived post-adjudication with validated audio, a bindings
row could exist while the occurrence still reads `outcome_unknown`, until
reconciliation adopts it. No spend, no second binding, and no state
corruption follows; the milestone verification (per-occurrence binding
checks) would see exactly one binding.

### 3.6 B4.5 — Expenditure figures, separated

- Whole-chapter quote: 261,146 units (the sum of the per-occurrence model
  estimates; verified against the plan's 14 entries, 18,524 chars total).
- Verified settled: 188,064 (the 10 committed occurrences; their model
  estimate was 179,126 — actuals ran 8,938 over model).
- The 73,082 "residual" is quote-minus-settled arithmetic mixing model and
  actuals. It is **not** an estimate for the pending occurrences.
- Per-occurrence model estimates (chars / 15.96 × 225, rounded): the 3
  pending occurrences — position 142: 21,104; position 145: 19,610;
  position 146: 20,385 — **total 61,099**, spendable only after the job
  lawfully resumes (a separate Julie authorization, §3.1). The unknown
  occurrence (position 134): **20,921**, spendable only under a Julie-
  authorized resynthesis. Original-attempt unverified exposure: ≤ 16,808
  model upper bound (unchanged; §3.2's qualification applies).
- **Expected new expenditure from revival/adjudication itself: 0** (§3.1).

## 4. Recovery-path determination

Every already-implemented path was tested against the deployed guards:

1. **A-1 `evaluate_repair`** — inapplicable twice over: HELD-only contract
   vs the LIVE posture (B1), and P-ABSENT is never repairable by A-1 even
   in HELD (B2).
2. **Re-hold, then A-1** — cures B1 only; B2 stands. (Also not authorized.)
3. **Qualifying entry paths** (commands / executor reports — the wake call
   sites) — no approved work generates such traffic; reads never arm;
   manufacturing traffic would be a speculative mutation; a second chapter
   submission is forbidden before milestone acceptance. Not an available
   approved path. (Noted as observation only: were Julie independently to
   perform an ordinary in-app action that sends a command, the chain might
   revive as a side effect. No such action is pending or needed, and
   nothing should be sent for this purpose without a gate.)
4. **`ResolveOutcomeUnknown`** — not yet applicable: the occurrence is
   still `granted`; adjudication (which requires drive processing) must
   precede it. Julie-gated in any case.
5. **Queue redelivery** of the stalled grant's message — not observable,
   not controllable, and without effect across ~41 hours. Not a path.
6. **Waiting** — the standing posture. P-ABSENT shows no self-healing
   mechanism in the implementation: registrations are (re)created only
   inside operations, and no operation runs. (S-2's seven days ended only
   through L-1, under HELD + P-STALE conditions that no longer obtain.)

**Determination: no already-implemented, already-approved recovery path
applies to S-3 without bypassing a safety boundary.**

## 5. Smallest separately gated design proposal — an independent scheduled drive entry (A-3, P-ABSENT scope)

Per the ruling's instruction, this proposal does **not** automate A-1's
predicate. The P-ABSENT lesson is that recovery cannot depend on the DO
alarm registration existing. The minimal fix supplies an **entry path
independent of the registration**:

- A Cloudflare **Cron Trigger** on the production worker (free tier),
  firing a dedicated scheduled handler at a modest cadence (design
  proposal: every 30 minutes), which performs **one coordinator drive
  entry through the same entry the alarm handler uses**. All existing
  machinery then runs unchanged: schedule processing, lease adjudication,
  recorder passes, containment and halt fences. The alarm chain remains
  the low-latency path when healthy; the cron entry is the floor that
  makes P-STALE and P-ABSENT both self-healing, because drive passes
  occur regardless of registration state.
- The A-1 build deliberately omitted the scheduler entrypoint (A1-C4);
  this proposal adds it as a new reviewed part, together with the trigger
  configuration (a settings-side act, counted in its deploy gate).

Questions the design phase must answer from source — **not assumed here**:
(i) drive-entry idempotence and concurrency when the alarm chain is
healthy (DO serialization; a redundant pass must be provably harmless);
(ii) posture law for the scheduled entry in LIVE vs HELD (drive processing
is state maintenance whose generation effects are already fenced by halt /
containment / quota / phase guards and by the job state machines — the
design must prove the entry initiates nothing beyond what the standing
posture already permits through normal job advance); (iii) cadence vs
free-tier limits (Cron Triggers are free; ~1,440 invocations/month at
30-minute cadence — to be verified in design); (iv) failure visibility
(the recorder-health record and the existing weekly peek already observe
pass liveness — the design rides them rather than adding silent
machinery); (v) whether the scheduled entry should also re-register the
alarm when it finds it absent, restoring the low-latency chain, or leave
registration to normal operations.

Gate chain, each step separately authorized: design package → Rowan
review → Julie's design GO → offline build + battery → Rowan review →
deploy gate (Julie's GO; counted acts including trigger configuration) →
post-deploy verification. **This assessment authorizes none of these
steps.** Interim posture: WAIT law and the half-hourly watch continue;
Chapter 6 remains safe at 10/14; the milestone stays open.

Architectural note (Rowan's recommendation, with her caution applied):
the W-4 design framed A-3 as a scheduler built on A-1. The P-ABSENT
finding reframes the requirement — the scheduler must be an independent
**entry**, not an automated **evaluation**. The proposal above is the
minimal form of that reframing. A-1 remains what it was approved as: a
HELD-state, P-STALE-only maintenance operation.

## 6. What survives from L-2

Accepted in principle by the ruling and carried forward to any future
gate: the one-attempt ceiling and ambiguity-consumption rule (for any
future invocation-class act), the predeclared observation cadence and
separate checkpoint verdicts, the RC-2 discharge rule, the accounting
qualifications, the playback-acceptance requirement, and the standing
release terms. The §1 adjudication analysis of the withdrawn package
stands as corrected by §3 of this assessment.

## 7. Returns requested from Rowan

1. Confirmation of the P-ABSENT classification (§2).
2. Confirmation of the §4 determination (no applicable approved path).
3. Shape feedback on the §5 design proposal before any design package is
   drafted.

Turn: Rowan's (review). Julie pokes.
