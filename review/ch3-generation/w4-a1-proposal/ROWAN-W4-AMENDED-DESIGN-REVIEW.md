> **Filing note (Wren, 2026-11-14):** Rowan's review ruling on the amended W-4 recovery-design package, relayed verbatim by Julie in the Coding Projects chat on 2026-11-14, after Julie's poke of the same morning (the design package having been prepared on Julie's explicit go, board 6878476854). Basis pin `cd40ab8cafcd670f031872ab41885e73aa5095ad` (opal-reader, `ui1-review`). Recorded on the Roundtable board verbatim-attributed. The ruling names the next step as **Julie's decision** (the A-1 proposal-preparation go); nothing in it was actioned by Wren beyond this recording — see Wren's disposition summary on the board. The text below the line is Rowan's, unedited.

---

ROWAN REVIEW RULING — W-4 AMENDED RECOVERY DESIGN

Date: 2026-11-14
Reviewed pin: cd40ab8cafcd670f031872ab41885e73aa5095ad
Case: Opal Roundtable, issue #15

VERDICT: AMENDED DESIGN ACCEPTED WITH IMPLEMENTATION CONDITIONS. A-1 IMPLEMENTATION PROPOSAL IS THE NEXT APPROVED DOCUMENTARY DIRECTION, SUBJECT TO JULIE'S GO FOR ITS PREPARATION.

Production remains HELD.

No further standalone recovery-design revision is required. Carry the conditions below directly into the next implementation proposal.

1. Amendment dispositions

* A-R1: PASS WITH CLARIFICATION.
* A-R2: CONDITIONAL PASS.
* A-R3: CONDITIONAL PASS.
* A-R4: PASS.
* A-R5: CONDITIONAL PASS.
* A-R6: PASS AT DESIGN LEVEL.
* A-R7: CONDITIONAL PASS.
* B-R1: PASS WITH CLARIFICATION.
* B-R2: CONDITIONAL PASS.
* B-R3: PASS WITH QUALIFICATION.
* B-R4: PASS.
* B-R5: PASS.

G-1, G-4, G-5, and G-6 are accepted as amended. Do not reopen them absent new evidence.

The exact code ranges and source identities are accepted as filed documentary evidence. Independent byte-level verification against the future implementation tree remains T-00's obligation.

2. P-ABSENT — corroboration insufficient by itself

RULING: AMEND.

Two null reads, a previously completed recorder row, and the absence of a new recorder row do not establish that no alarm handler is presently executing.

Counterexample:

1. Pass N completes.
2. Pass N+1 begins and reaches an asynchronous operation before its recorder write.
3. The repair evaluation observes null twice.
4. Pass N remains the latest recorded complete pass.
5. P-ABSENT incorrectly classifies the chain as unarmed.

Cloudflare's documented null-while-running behavior permits precisely this ambiguity.

Furthermore, a redundant registration cannot be presumed to use the same due time as the active handler. Pending rows may have changed.

Implementation condition IC-1:

Either establish a reliable handler-in-flight exclusion with a demonstrated race proof, or retain P-ABSENT as diagnostic-only in the initial implementation.

My preference is the latter for A-1's first release.

P-STALE addresses the observed W-4 failure class. We do not need to expand the initial mutation surface to solve every hypothetical alarm state.

Retain P-ABSENT's observation fields for future evidence.

3. Strike counter — three accepted, reset semantics amended

RULING: ACCEPT THE BOUND OF THREE.

Three consecutive ineffective registering evaluations constitute a reasonable initial circuit-breaker threshold.

However, invoking the operator route must not reset the counter merely by entering the method.

An operator call that declines or fails is not evidence of restored liveness. Automatic counter reset through invocation alone can also defeat the scheduler's circuit breaker.

IC-2:

* Persist the counter across coordinator restarts.
* Count actual registering evaluations, not ordinary declines.
* Account conservatively for unresolved registration intents.
* Prevent concurrent invocations from bypassing the bound.
* Reset automatically only on a qualifying subsequent complete recorder pass.
* Require separately authorized, explicitly audited acknowledgment for any manual reset.

An operator may retain authority to conduct one specifically approved evaluation after the scheduler reaches its bound. That does not implicitly restore automatic scheduler eligibility.

The initial A-1 proposal must specify the counter and its future integration, even if scheduler enforcement is not yet active.

4. Registration concurrency — additional proof required

IC-3:

T-07's expectation of one effective registration value is insufficient.

Two setAlarm calls using identical timestamps remain two registration acts. They may affect retry ownership or overwrite a registration established between them.

Likewise, recomputing a minimum due time does not establish that concurrent operations will select the same value.

The implementation proposal must demonstrate a shared serialization or equivalent race-safe ordering strategy covering:

* Repair evaluations.
* Ordinary R5a wake paths.
* Alarm-handler rearming.
* Pending-row changes.
* Containment transitions.

Final eligibility, current registration, applicable containment state, and due selection must remain valid at the registration boundary.

The new repair operation must not overwrite a valid earlier registration established after its initial observation.

Do not introduce a broad locking mechanism without examining its effect on the existing coordinator and containment behavior.

Prefer the smallest source-grounded solution.

5. Scheduler topology

RULING: SHAPE (b1) ACCEPTED.

Select the separate minimal scheduler Worker with a narrowly scoped named service-binding entrypoint.

Reject duplicated general operator credentials.

This topology provides useful deployment separation and a smaller authority surface. It does not provide independence from Cloudflare itself.

IC-4:

The implementation proposal must verify that:

* The named entrypoint exposes only the approved maintenance operation.
* The operation cannot be reached through the public fetch router.
* The caller cannot supply arbitrary commands, coordinator identities, or invocation-source tags.
* The scheduler binding is absent or inert until separately authorized activation.
* Removing the scheduler does not disturb A-1.

The dedicated entrypoint may be included in A-1's proposed implementation, provided its scheduled invocation authority is disabled by construction.

Shipping an entrypoint must not silently activate its future caller.

6. Independent health record

RULING: ARCHITECTURE ACCEPTED; FAILURE POLICY AMENDED.

The external storage location, 90-day retention, and six distinguished states are accepted.

The scheduler must remain observable when the coordinator is unavailable.

However, §5.3's policy of proceeding with repair when its own intent record cannot be written is not accepted.

IC-5:

During initial scheduled-repair operation, failure to establish the scheduler's intent record must fail closed before invoking the repair evaluation.

If the completion record fails after invocation, retain the incomplete intent as outcome unknown.

Additionally:

* Assign a unique run identity and expected scheduled timestamp.
* Distinguish an incomplete intent from a wholly missing run.
* Preserve original execution outcomes when later delivery evidence is linked.
* Do not treat a recent intent alone as proof of successful evaluation.
* Define duplicate-run handling and retention-boundary behavior.
* Maintain separate timestamps for scheduler execution, coordinator response, and later observed delivery.

The external health record is an authority and accountability safeguard, not merely optional bookkeeping.

The 12-hour freshness threshold is accepted provisionally for monitoring, not as proof that every expected scheduled run occurred.

7. Recovery authority and WAIT law

IC-6:

The statement that the evaluation has no concept of generation authority is insufficient to discharge A-R5.

A registration operation can indirectly restore dispatch through the alarm handler. It therefore cannot be considered harmless solely because the evaluation method never calls sendGrant.

The initial A-1 release shall be scoped to the existing HELD operating state:

* Generation halt asserted.
* Queue paused.
* Applicable containment restrictions satisfied.
* Explicit operator authorization present.
* No applicable fault-response prohibition.

Recheck these conditions at the act boundary.

Recovery under legitimately unhalted generation, including expired or ambiguous authorization, remains deferred until its authority model is demonstrated separately.

An accessible coordinator is not necessarily a cleared incident. Scheduler activation must eventually specify how WAIT-law conditions suppress repair even when some platform surfaces have recovered.

No automatic post-fault dispatch is authorized by this ruling.

8. Outcome ladder and read purity

IC-7:

The four-stage outcome ladder is accepted with the following clarifications.

First, distinguish successful completion of the setAlarm call from its subsequent reported registration.

A newly scheduled alarm might already be executing by the read-back. A null read-back therefore does not prove the registration call failed.

Second, a recorder row after an evaluation establishes later observed delivery, not causation by that evaluation.

Third, the two further passes proposed for routine scheduler observation are not equivalent to L-1 certification. Label that evidence as routine observed continuation and retain the stricter three-further-pass L-1 requirement.

Finally, an observational GET or Q-5 monitoring run must not fill coordinator audit fields through production writes.

A read-only observer may derive and report linkage externally. Persistent annotation inside production requires an explicitly authorized write path.

The complete implementation write-set inventory must include the strike counter, intent and completion records, and any other introduced persistent metadata. Do not hide these under an unspecified bookkeeping category.

9. L-1 gate

RULING: REVISED DESIGN ACCEPTED WITH EXECUTION-PACKAGE CONDITIONS.

Cadence tolerance

Accept [5, 20] minutes per inter-row gap, with three further consecutive complete passes within the overall 40-minute continuation window.

These are conjunctive requirements. Individual gaps satisfying the tolerance cannot override the total deadline.

The tolerance is an operational witness criterion, not a Cloudflare delivery guarantee.

Require available retry and pass-identity evidence to distinguish ordinary continuation from retries or duplicate delivery. Timing alone cannot establish that distinction.

Pre-gate liveness exclusion

Accept checkpoint 0.

One new recorder row establishes observed delivery; an advancing reported registration establishes P-REG movement only.

Either warrants withholding the stimulus and returning the changed condition for documentary disposition. Neither alone establishes spontaneous sustained recovery.

Witness independence

Accept pre-gate STOP when independence cannot be established.

GO remains unconsumed by stimulus, but remains subject to its original validity window and expiry. It must not roll automatically into a later attempt.

Cadence arithmetic alone cannot prove that no delayed or overlapping scheduler invocation occurred.

Prefer L-1 before A-3 activation. If performed after activation, require evidence sufficient to exclude delayed, in-flight, and duplicate scheduled invocations as well as ordinary external wake paths.

Closing and outcomes

B-R4 and B-R5 are accepted.

L-1 remains a time-bounded liveness witness. It does not authorize generation release, establish indefinite recovery durability, or close historical W-4.

10. Offline acceptance matrix

RULING: T-00–T-15 ACCEPTED AS THE BASE MATRIX, NOT YET SUFFICIENT FOR IMPLEMENTATION ACCEPTANCE.

Preserve all standing regression suites and add the following cases, or demonstrably equivalent coverage:

* T-16: Active alarm handler before recorder write; two null reads and unchanged prior complete row cannot authorize unsafe repair.
* T-17: Competing evaluation and ordinary wake choose different due times; valid earlier registration is preserved.
* T-18: Concurrent evaluations cannot bypass the bounded registration policy or strike counter.
* T-19: Strike state survives restart; failed or declined operator invocation does not reset it.
* T-20: Registration succeeds but completion audit fails; unresolved intent remains visible.
* T-21: Scheduler intent storage unavailable; no repair invocation occurs.
* T-22: Duplicate, delayed, overlapping, and missing scheduler runs remain distinguishable.
* T-23: Named entrypoint cannot be invoked through an unintended public or general-authority path.
* T-24: Halt, queue, containment, or applicable recovery-authority state changes before registration; prohibited act is suppressed.
* T-25: Expired or ambiguous generation authority cannot indirectly restore unauthorized dispatch.
* T-26: Post-registration null read-back is represented without inventing success or failure of delivery.
* T-27: Late original alarm delivery cannot duplicate plan advancement, reservation, or provider submission.
* T-28: Diagnostic linkage and Q-5 observation perform zero production writes.
* T-29: L-1 witness fixtures reject cadence violations, retry-only sequences, external repair interference, and incomplete terminal verification.

Also add a boundary test at the exact stale threshold and define predicate precedence where observation classes overlap.

The A-1 proposal may defer scheduler-specific test execution to the A-3 implementation phase, but must identify that deferral explicitly.

No deferred test may be reported as passed.

Offline tests establish implementation behavior under modeled conditions, never actual platform delivery.

11. Cadence and cost

Accept:

* Ten-minute watchdog period.
* One-hour stale threshold.
* Six-hour scheduler cadence.
* Three-strike automatic repair circuit breaker, as amended.

These remain design parameters pending implementation and operational evidence.

State the conditional observation bound precisely: approximately seven hours from the onset of an otherwise eligible stale-registration condition before accounting for the one-hour threshold, or one scheduler cadence after eligibility has been reached, assuming successful scheduled execution and accessibility.

Four scheduled slots per day is the nominal cadence, not an independently enforced maximum on duplicate invocations.

Account inventory and free-tier feasibility remain required.

No paid feature or additional provider expenditure is authorized.

12. Supporting observation

Q-5's reported approval and activation are acknowledged.

Its existing weekly read-only authorization remains intact.

Extending that observation to a future scheduler's health record is a scope addition to be included in A-3's approval package, not presumed authorized today.

The platform inquiry wording remains accepted. Posting authority is still separate.

G-3 remains nonblocking.

13. Next deliverable and authorization

A-1 IMPLEMENTATION PROPOSAL PREPARATION: ACCEPTED AS THE NEXT STEP, SUBJECT TO JULIE'S EXPLICIT GO.

The next proposal shall include:

1. Exact implementation base and minimal change surface.
2. Shared evaluation algorithm with IC-1 through IC-7 incorporated.
3. Operator route contract and authorization boundary.
4. Dedicated entrypoint disposition and activation fence.
5. Complete write-set and concurrency specification.
6. Expanded offline acceptance matrix with phase-specific test obligations.
7. Rollback and degradation design.
8. Explicit production execution exclusions.

Do not implement code under permission to prepare a proposal.

Do not require another standalone design-amendment filing. Carry this ruling's conditions directly into the proposal.

L-1 remains independently preparable and separately gated.

A-3 remains the approved architectural destination, not an approved implementation or activation.

WS2/Batch remains untouched.

W-4 remains an OPEN HISTORICAL DEVIATION.

No implementation, deployment, production stimulus, scheduled recovery activation, containment transition, queue change, or generation release is authorized by this ruling.

PRODUCTION REMAINS HELD.

TURN: JULIE'S, FOR THE A-1 PROPOSAL-PREPARATION GO. THEN WREN'S.
