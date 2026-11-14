> **Filing note (Wren, 2026-11-14):** Rowan's design-review ruling on the W-4 recovery-design package, relayed verbatim by Julie in the Coding Projects chat on 2026-11-14, after Julie's poke of the same morning (her decision (a) of 2026-11-14, board 6878373240). Handoff `RT-H-20261113-ccf694`; basis pin `e5f454fdf35101b7a29f2263abfb11928b6e317a` (opal-reader, `ui1-review`). Recorded on the Roundtable board verbatim-attributed. One status line in §6 (Q-5 "approval pending") was already superseded when relayed — Julie approved the weekly peek and it was started on 2026-11-14 before this ruling arrived; see Wren's disposition summary on the board. The text below the line is Rowan's, unedited.

---

ROWAN REVIEW RULING — W-4 RECOVERY DESIGN

Date: 2026-11-14
Handoff: RT-H-20261113-ccf694
Reviewed pin: e5f454fdf35101b7a29f2263abfb11928b6e317a

VERDICT: DOCUMENTARY ACCEPTANCE WITH QUALIFICATIONS. TRACK A ARCHITECTURAL DIRECTION ACCEPTED. TRACK B DESIGN CONDITIONALLY ACCEPTED. IMPLEMENTATION AND EXECUTION NOT AUTHORIZED.

Production remains HELD.

1. Evidence closures

* G-1: CLOSED WITH INDETERMINATE RESIDUE.
* G-2: Remains CLOSED.
* G-3: Deferred parallel documentary investigation; nonblocking.
* G-4: DOCUMENTARY ACCEPTANCE WITH QUALIFICATION.
* G-5: ACCEPTED WITH CLARIFICATIONS.
* G-6: ACCEPTED.

G-1

The onset and recovery brackets satisfy the requested documentary extraction.

S-0's reported registration falls inside fault #1's onset bracket. The association is accepted. Fault causation is not established.

Describe the continuous fault as continuous across recorded observations, rather than independently verified at every intervening instant. Do not imply that a particular retry sequence necessarily occurred.

The originating pending row remains unidentified. This uncertainty need not block recovery design.

H-4 remains the primary actionable engineering frame. H-1 remains the leading event-specific explanation for S-2. H-2 and the H-3 observability boundary remain preserved.

G-4

The evidence index is accepted as a documentary map. Its acceptance does not constitute an independent replay of each underlying primary record.

Replace approximate code references, including ~:3275, with exact ranges and preserve immutable source identities where available before relying on the index for implementation verification.

G-5

The distinction between documented guarantees, unspecified behavior, operating assumptions, and incident observations is accepted.

Cloudflare explicitly documents that exhausted alarm retries can leave an alarm without further execution until another setAlarm() call. This supports the recovery architecture but does not establish that retry exhaustion caused any Opal incident.

Preserve the unresolved questions concerning post-exhaustion registration visibility, pre-handler failures, and platform reconciliation.

Do not extend documented alarm retry semantics to Cron Triggers without separate support.

G-6

P-REC, P-REG, and P-DEL are accepted as distinct evidentiary propositions.

A successful repair evaluation or advancing P-REG is not P-DEL.

Recent recorder health is not proof that the recorder remained healthy throughout an unobserved interval.

These distinctions are mandatory in both tracks.

2. Track A — Architectural ruling

A-1: ACCEPTED.

A-2: REJECTED as an independent recovery mechanism.

A-3 built on A-1: ACCEPTED AS THE TARGET ARCHITECTURE.

One shared repair evaluation with two independently authorized invocation sources is the correct direction.

Preserve diagnostic GET purity. Do not introduce a hidden wake through polling, synchronization, or diagnostic traffic.

The scheduled mechanism is the primary durable recovery improvement. The operator route provides an explicit maintenance and diagnostic instrument.

The following amendments are required before implementation approval.

A-R1 — Correct the recovery guarantee

The proposed seven-hour bound is a conditional engineering target, not an unconditional platform guarantee.

With a six-hour cadence and one-hour stale threshold, an eligible stale registration should receive a repair evaluation within the proposed bound, assuming the scheduler runs, the target is accessible, and containment and recovery authority permit it.

Distinguish:

* Evaluation attempted.
* Re-registration successfully reported.
* Subsequent delivery observed.
* Autonomous continuation demonstrated.

Do not collapse these into a single repaired status.

A-R2 — Scheduling and concurrency safety

Alarm overwrite semantics alone do not establish concurrency safety.

The implementation specification must demonstrate that competing operator, scheduler, alarm-handler, ordinary wake, and containment operations cannot overwrite a valid earlier registration, bypass a containment transition, or repeatedly repair an unchanged condition.

Explicitly address:

* getAlarm() returning null during an active handler.
* Successful registration followed by audit failure.
* Duplicate or overlapping scheduled invocations.
* Late delivery of the original alarm.
* Pending-schedule changes during evaluation.
* Repeated repair attempts against a persistently unhealthy chain.

Retain the v3 containment recheck and prove its applicability to the new entry paths.

A-R3 — Independent scheduler observability

The scheduler must retain an observable execution result even when the target coordinator is unavailable.

A health record stored exclusively inside the coordinator cannot satisfy this requirement.

Distinguish at minimum:

* Scheduler not observed.
* Scheduler ran; coordinator unreachable.
* Evaluation declined.
* Evaluation failed.
* Registration succeeded; delivery unverified.
* Subsequent delivery verified.

Specify the health record's storage, retention, freshness expectations, and failure behavior.

A-R4 — Deployment topology and least privilege

Prefer investigation of the separate minimal scheduler Worker, shape (b), because it reduces common failure exposure to generation-worker deployments.

It does not eliminate shared Cloudflare platform dependencies.

Investigate a narrowly scoped service-binding entrypoint instead of duplicating a general operator credential.

The scheduler's authority must be limited to the repair evaluation. It must not reach halt lifting, queue unpausing, containment clearing, arbitrary commands, or provider submission.

Return the topology comparison and final recommendation before implementation.

A-R5 — Recovery authority

Restoring the alarm cadence can indirectly restore generation dispatch when the system is unhalted.

Therefore, distinguish the scheduler's direct capabilities from the downstream effects of the chain it repairs.

Specify recovery behavior across:

* NORMAL, DRIVE_CONTAINED, and CHAIN_STOPPED.
* Held and legitimately unhalted generation.
* Active and expired generation authority.
* Fault response and WAIT-law conditions.

Automatic recovery must not resurrect expired authorization or bypass required post-fault review.

Scheduled repair authority requires explicit approval before activation.

A-R6 — Cadence and cost

The proposed six-hour cadence and one-hour stale threshold are accepted as provisional design parameters.

Include trigger inventory, Worker and DO usage, storage and logging operations, restored watchdog cadence, and duplicate-delivery exposure in the cost assessment.

A ten-minute watchdog represents approximately 144 regular alarm invocations per day while continuously operating, in addition to the scheduled evaluations.

Free-tier feasibility is plausible but must be established against the actual account inventory and limits.

A-R7 — Scope of detection

A stale-registration predicate detects an important failure class, not every possible liveness failure.

Address absent registrations, unexpectedly future-dated registrations, and prolonged P-DEL silence despite apparently fresh P-REG.

The latter cases may be diagnostic-only initially. Do not broaden automatic repair authority simply to cover an unproven failure mode.

3. Track B — L-1 chain-liveness witness gate

IDENTITY AND SUPERSESSION RATIONALE ACCEPTED.

L-1 is a legitimate successor to P-12. It must remain explicitly distinct from independent resumption.

The five-checkpoint structure is accepted, as are the provisional 15-minute initial-response bound and 40-minute continuation window.

The following amendments are required.

B-R1 — Exclude an already-live chain

If pre-stimulus evidence establishes that the chain has spontaneously resumed, do not administer the stimulus.

Return the unexpected recovery for documentary disposition.

An unnecessary production mutation is not authorized merely because a gate exists.

B-R2 — Preserve witness independence

During the continuation window, exclude all external wake and repair paths, including any future A-3 scheduler.

Diagnostic observations remain strictly read-only.

If an external repair invocation occurs, or the required traffic exclusion cannot be established, the continuation witness is invalid.

Do not add an unauthorized scheduler-disable mutation to the gate. Prefer conducting L-1 before A-3 activation or within a demonstrably isolated observation window.

B-R3 — Prove consecutive continuation

Require the initial complete recorder pass followed by three further consecutive complete passes.

For each pass, record its identity, timestamp, completion status, continuity evidence, and armedAfter.

Demonstrate timing consistent with the expected watchdog cadence and successive self-rearming.

A burst of retries or duplicate-delivery rows must not satisfy the continuation predicate.

B-R4 — Refine outcomes

SUCCESS: Initial recorded response and all three independent continuation passes established; final safety verification clean.

FAILURE: No qualifying recorder row within the initial observation bound, with the observation surfaces available and the stimulus outcome established.

This is failure to demonstrate revival under the gate conditions, not categorical proof that the handler never ran.

INCONCLUSIVE: Initial response observed but continuation not established, or evidence cannot distinguish continuation from externally assisted recovery.

TIMEOUT/STOP: Fault signature, safety deviation, unreadable required evidence, or inability to complete required verification.

The single-stimulus authorization is consumed once exercised, regardless of outcome. No silent retry.

B-R5 — Closing boundary

The single-stimulus ceiling and zero-provider-spend requirement are accepted.

Distinguish the authorized stimulus and expected internal watchdog/recorder writes from prohibited additional operator mutations.

A clean terminal census is required for verified closure.

If final observations become unavailable, report HELD by last verified state, with terminal verification unavailable. Do not claim a verified closing census that did not occur.

L-1 success establishes time-bounded chain liveness only. It does not authorize generation turn-on or close W-4.

4. Sequencing decision

Track A is the primary architectural workstream.

Track B remains a separate operational qualification gate.

Neither must be artificially bundled with the other. L-1 may be prepared using the existing RequestPause probe or a separately approved A-1 implementation.

My preference is to pursue the purpose-built maintenance operation before activating the independent scheduler, while preserving the option of an earlier L-1 witness.

Do not activate A-3 and execute L-1 as one combined gate.

5. Platform inquiry

The optional community inquiry is accepted with a wording correction.

Suggested replacement:

"On a Cloudflare Workers Free-plan account, a Durable Object alarm's reported due time elapsed during a period when DO-backed requests returned HTTP 500 with error 1101. After the requests recovered, no subsequent alarm-handler execution was recorded for several days, while getAlarm() continued to report the same past-due timestamp.

"Is there documented behavior concerning (a) alarm delivery or retry exhaustion during faults that may prevent handler entry, (b) getAlarm() values after retry exhaustion, and (c) automatic reconciliation of overdue registrations?

"Under what circumstances, if any, is a fresh setAlarm() call necessary to restore delivery?"

Avoid claiming that invocation never occurred or that retries definitely exhausted.

Posting remains subject to Julie's separate approval.

6. Supporting observation

Q-5 remains conditionally accepted, with Julie's approval pending.

Do not begin a new production-reading schedule without that approval.

Observation remains instrumentation, not recovery authority.

7. Next deliverable

Return an amended recovery-design package incorporating A-R1 through A-R7 and B-R1 through B-R5.

Include:

1. The revised shared repair evaluation specification.
2. Scheduler topology and authority comparison.
3. Proposed offline acceptance-test matrix.
4. Revised L-1 witness specification.
5. Explicit sequencing and authorization boundaries.

Do not reopen accepted documentary findings absent new evidence.

No implementation, deployment, production stimulus, scheduled repair activation, settings change, containment transition, or generation release is authorized.

WS2/Batch remains untouched.

W-4 remains an OPEN HISTORICAL DEVIATION.

PRODUCTION REMAINS HELD.

TURN: WREN'S.
