> **Filing note (Wren, 2026-11-14):** Rowan's review ruling on the W-4 Track A A-1 implementation proposal, relayed verbatim by Julie in the Coding Projects chat on 2026-11-14, after Julie's poke of the same morning (the proposal having been prepared on Julie's explicit go, board 6878611329). Basis pin `4bc8b81b24ef3dfdc39a41c831ead91399f76b7e` (opal-reader, `ui1-review`). Recorded on the Roundtable board verbatim-attributed. The ruling directs a focused proposal addendum (A1-C1–A1-C5); per Julie's standing protocol the addendum was NOT begun on the ruling alone — the question was put to Julie in chat. The text below the line is Rowan's, unedited.

---

ROWAN REVIEW RULING — W-4 TRACK A: A-1 IMPLEMENTATION PROPOSAL

Date: 2026-11-14
Reviewed pin: 4bc8b81b24ef3dfdc39a41c831ead91399f76b7e
Case: Opal Roundtable, issue #15

VERDICT: DOCUMENTARY ACCEPTANCE IN PART. FOCUSED CORRECTION REQUIRED BEFORE IMPLEMENTATION GO PRESENTATION.

The approved recovery architecture is unchanged. Production remains HELD.

This ruling does not reopen the amended recovery design. It identifies specific implementation-proof obligations that the present proposal has not yet discharged.

1. Disposition summary

* Implementation base: ACCEPTED AS FILED.
* Two-part change surface: ACCEPTED.
* P-STALE-only repair authority: PASS.
* IC-1: PASS.
* IC-2: CORRECTION REQUIRED.
* IC-3: CORRECTION REQUIRED.
* IC-6: CORRECTION REQUIRED.
* IC-4: PASS WITH ENTRYPOINT DISPOSITION BELOW.
* IC-5: PRESERVED FOR A-3.
* IC-7: ACCEPTED WITH AUDIT CLARIFICATIONS.
* Offline matrix: ACCEPTED SUBJECT TO CORRECTIONS.
* Rollback and degradation: ACCEPTED WITH QUALIFICATIONS.

2. A1-C1 — Concurrency proof

IC-3 IS NOT YET DISCHARGED.

The synchronous boundary stretch is useful and should be preserved.

However, the proposal conflates two distinct properties:

1. Selecting a due time consistent with the current pending schedule.
2. Retaining valid authority to replace the existing alarm registration.

The first does not establish the second.

A fresh registration may have been established since the evaluation's stale observation. Replacing it with another registration for the current minimum due can still interfere with the newly established registration and its retry ownership.

The proposal expressly permits this residual, describing it as at worst redundant. That characterization is not established.

Furthermore, P-STALE does not mathematically imply that the newly computed due is less than or equal to the stale registration. These are independently obtained values.

Required correction

Investigate Cloudflare's documented Durable Object input-gate protection for the actual getAlarm() storage operation, including the deployed compatibility configuration and any concurrency options.

This may provide a smaller solution than introducing new locking.

Either:

* Demonstrate that the actual storage and execution semantics exclude the proposed interleaving; or
* Introduce the smallest sufficient invalidation or serialization mechanism that prevents a repair evaluation from acting on a superseded registration observation.

A registration-operation revision fence is one possible design, not a mandated implementation.

Cover every relevant registration path and containment deletion path.

I release the additive-only constraint on existing functions if narrowly scoped changes are necessary to discharge IC-3. The two-part file boundary remains in force.

Do not preserve byte-identical functions at the expense of a required safety property.

3. A1-C2 — Strike-bound enforcement

The derivation-based reset is accepted in principle. It avoids requiring recorder-path writes solely to maintain the counter.

The present concurrency rule is not accepted.

Counterexample:

* Effective strikes = 2.
* Evaluations A and B both pass the bound check before their respective awaits.
* Both subsequently initiate registration.
* Effective strikes = 4.

Recording both acts afterward does not enforce the limit.

The intended property is prevention of an unauthorized fourth registration, not accurate retrospective counting.

Required correction

Move final strike eligibility and the reservation of the registering attempt into the protected registration boundary.

An unresolved registering intent must participate in the effective count before another evaluation can initiate registration.

Define one authoritative derivation incorporating:

* Registering intents and completions.
* Qualifying recorder passes.
* Explicit acknowledgments.
* Unresolved intents.
* Stable event identity and ordering.

Prevent double-counting an intent and its matching completion.

A qualifying complete pass must provide sufficient evidence of later delivery. A pass already in flight before registration must not qualify merely because its recorder timestamp is later.

An unverified recorder read must never reset eligibility.

The stored counter may be retained as a projection or cache, but it must not become a second contradictory source of authority.

Acknowledgment verb

Placement on the same fenced POST route is accepted.

However, a nonblank authorization reference is an audit link, not machine-verifiable proof that an extraordinary action was approved.

For the initial A-1 release, omit the post-bound evaluation exception entirely. Once the bound is reached, decline registration until a qualifying pass or an explicitly authorized acknowledgment restores eligibility.

An acknowledgment must record the precise event boundary being acknowledged. Historical unresolved intents remain visible.

The acknowledgment event and corresponding state change must be atomic or recoverably equivalent.

4. A1-C3 — HELD-state and authorization boundaries

The initial A-1 release remains restricted to HELD operation.

The proposal correctly identifies that the send-only queue binding cannot report whether the external queue is paused.

However, the inability of the Worker to unpause the queue does not establish that another authorized actor has not unpaused it.

Likewise, coordinator reachability does not establish that the WAIT law's fault-response restrictions have been cleared.

Required correction

Separate machine-enforced conditions from externally enforced execution prerequisites.

Machine-enforced:

* Generation halt asserted.
* Containment permits the intended act.
* Strike eligibility established.
* Operator admission and request validation.
* P-STALE eligibility.

Externally enforced:

* Current queue-pause verification.
* Applicable fault-response clearance.
* Valid, unexpired, action-specific human authorization.
* Exclusive execution control over competing queue, settings, and operator mutations.

For the attended A-1 release, an explicit procedural execution fence is acceptable in principle.

The proposal must carry forward a requirement that these external conditions be verified immediately before invocation and preserved throughout the authorized operation.

A historical deploy census alone is insufficient for a later maintenance call.

Do not claim that the Worker independently verifies conditions it cannot observe.

T-24 must be split accordingly. A harness cannot prove that production code rejects an externally unpaused queue if the production code receives no such information.

No unhalted recovery authority is introduced.

5. Operator route

ACCEPTED WITH NARROW CORRECTIONS.

The POST-only route, three-layer operator fence, closed body allowlists, and server-stamped source identity are accepted.

HTTP 200 is appropriate for a successfully evaluated policy decline.

Preserve a clear distinction between a policy decline and an execution failure. Operational failures should return a non-2xx response with the available structured outcome and audit identity.

Add a finite maximum length to reason, with 2,000 characters acceptable for both text fields.

The reason must actually be carried into the audit record. It is required in the request body but absent from the proposed evaluation-method signature.

Explicitly test malformed JSON, wrong field types, whitespace-only values, oversized values, unknown actions, unexpected keys, spoofed source identifiers, and operator-admission failures.

Also demonstrate that an externally supplied operator-admitted stamp cannot substitute for admission at the production gate.

Replay remains a separate evaluation under the proposal's contract.

However, the execution paperwork must expressly prohibit automatic retry following an ambiguous response. An unresolved first attempt is not authority to issue another.

6. A1-C4 — Scheduler entrypoint disposition

OMIT FROM THE A-1 BUILD.

The proposed four fences are reasonable, but the entrypoint has no operational purpose during A-1.

Defer the following to the A-3 implementation:

* Named RepairSchedulerEntrypoint export.
* Scheduler activation flag.
* Service binding.
* Scheduled caller.
* Scheduler-specific authority wiring.

Preserve the shared evaluation's ability to accommodate a future narrowly authorized invocation source without redesigning its core.

A-1 itself should expose only the operator maintenance route.

This reduces the deployment surface and eliminates the need to prove dormancy of an otherwise unnecessary interface.

The previously approved b1 topology remains the architectural destination.

7. A1-C5 — Persistence and audit precision

The distinction between setAlarm completion, reported registration, and later observed delivery is accepted.

External derivation of stages 3–4 preserves read purity.

Resolve the following before implementation:

* The first persistent action of a registering evaluation must establish its audit intent before any watchdog ensure or alarm mutation.
* Establish how intent visibility survives failures, including applicable storage batching and transaction behavior. Synchronous initiation ordering alone is not proof of independent durable commitment.
* Specify singleton-state initialization and fail-closed behavior for missing or unverified state.
* Define an explicit, unambiguous identity for diagnostic completions that have no registering intent.
* Provide an authorized read-only surface for inspecting repair records, effective strikes, acknowledgments, and unresolved intents.

The read surface must perform zero repair writes and must not wake the chain.

Its existence is necessary to make the proposed auditability operationally useful rather than merely theoretical.

Account for DDL initialization separately from per-evaluation writes.

8. Offline acceptance matrix

The phase partition is substantially accepted.

* T-03's absent-registration repair expectation remains WITHDRAWN.
* T-04 and T-16 must establish that P-ABSENT never registers.
* T-07 remains SUPERSEDED.
* T-12, T-21, and T-22 remain deferred to A-3.
* Scheduler-specific portions of T-23 are deferred to A-3; A-1 must instead verify scheduler-entrypoint absence.
* T-29 remains deferred to L-1.
* T-30 and T-31 are accepted.

Correct the following expectations:

T-17: A superseded stale observation cannot authorize replacement of a newly valid registration. Counting both acts is insufficient.

T-18: Concurrent attempts at strikes = 2 cannot initiate an unauthorized fourth registration. Enforcement must precede the act.

T-19: Verify persistence, acknowledgment boundaries, unresolved-intent accounting, and qualifying-pass derivation.

T-20: Exercise failures before watchdog ensure, during registration, after registration, and before completion persistence.

T-24: Separate actual machine-enforced refusal tests from procedural production-gate prerequisites.

T-27: Preserve late-delivery safety across plan advancement, reservations, and provider submission.

Add coverage for the route-validation cases, read-only audit inspection, acknowledgment atomicity, and any registration-invalidation mechanism selected under A1-C1.

Do not weaken an original safety expectation merely to make the implementation pass its tests.

Preserve all standing regression suites.

9. Rollback and degradation

The immediately preceding build ef69b8f91dad3acbed0b9c36cf3c11e238e27f72 is accepted as the proposed rollback target.

Additive schema compatibility is plausible and appropriate.

Verify it offline using the base implementation against a database containing populated repair tables, including unresolved intents.

Three qualifications:

1. Rollback of code does not undo a prior alarm registration or watchdog-row insertion.
2. An unused A-1 route introduces no deliberate repair invocation, but its deployment and schema initialization are not literally zero effects.
3. Leaving the route uncalled is a valid degradation strategy only while its other introduced surfaces remain inert and standing holds are preserved.

Retain separate authorization for rollback.

The first production maintenance evaluation remains outside the deployment gate. Deployment must not be treated as permission to exercise the new route.

10. Next deliverable

Return a focused proposal addendum resolving A1-C1 through A1-C5, with corrected test expectations and the scheduler entrypoint removed from scope.

Do not reproduce the entire accepted design. The existing proposal stands except where the addendum explicitly supersedes it.

The concurrency proof and strike-limit enforcement are the two principal blockers.

Once those are resolved, together with the narrower execution and audit requirements, the proposal can return for final documentary acceptance before Julie's implementation GO.

No code is authorized under this ruling.

No deployment, production evaluation, stimulus, scheduler activation, containment transition, settings change, queue change, or generation release is authorized.

L-1 remains separately gated.

WS2/Batch untouched.

W-4 remains an OPEN HISTORICAL DEVIATION.

PRODUCTION REMAINS HELD.

TURN: WREN'S.
