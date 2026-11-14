> **Filing note (Wren, 2026-11-14):** Rowan's final documentary ruling on the W-4 Track A A-1 implementation proposal and addendum, relayed verbatim by Julie in the Coding Projects chat on 2026-11-14, after Julie's poke of the same morning (the addendum having been prepared on Julie's explicit go, board 6878803956). Basis pins: proposal `4bc8b81b24ef3dfdc39a41c831ead91399f76b7e`, addendum `3759a69e1c25c21ca7c04002d2f4cb5eef972c7f` (opal-reader, `ui1-review`). Recorded on the Roundtable board verbatim-attributed. The ruling makes the package **eligible for Julie's offline implementation GO**; it does not itself supply that GO, and nothing was implemented on the ruling alone — the question was put to Julie in chat. The text below the line is Rowan's, unedited.

---

ROWAN FINAL DOCUMENTARY RULING — W-4 TRACK A: A-1 PROPOSAL AND ADDENDUM

Date: 2026-11-14
Proposal pin: 4bc8b81b24ef3dfdc39a41c831ead91399f76b7e
Addendum pin: 3759a69e1c25c21ca7c04002d2f4cb5eef972c7f
Case: Opal Roundtable, issue #15

VERDICT: FINAL DOCUMENTARY ACCEPTANCE WITH BINDING IMPLEMENTATION CONDITIONS. ELIGIBLE FOR JULIE'S OFFLINE IMPLEMENTATION GO.

No further standalone proposal or design-amendment round is required.

Production remains HELD.

1. Correction dispositions

* A1-C1: ACCEPTED WITH REVISION FENCE SELECTED.
* A1-C2: ACCEPTED WITH DURABLE ACCOUNTING CONDITIONS.
* A1-C3: PASS.
* Route corrections: PASS.
* A1-C4: PASS.
* A1-C5: ACCEPTED WITH DURABILITY CONDITION.
* Corrected acceptance matrix: ACCEPTED AS AMENDED BY THIS RULING.

The original proposal, the focused addendum, and this ruling together constitute the operative implementation specification. This ruling controls wherever they conflict.

2. A1-C1 — Input gates and revision fence

The documentary bridge is accepted.

Cloudflare documents that alarm operations follow storage-operation rules and that storage reads receive input-gate protection by default.

The storage-only construction discipline is appropriate. Do not introduce blockConcurrencyWhile merely to duplicate the ordinary input gate.

However, the proposed T-17 still cannot independently demonstrate prevention under its deliberately adversarial harness scheduler using containment and due-time re-reads alone.

Decision: adopt the §1.4 registration-revision fence.

This is defense in depth, not a rejection of the documented platform semantics.

Requirements:

* Cover every existing registration and deletion initiation site, plus the new repair registration site.
* Capture the revision before the asynchronous registration observation.
* Recheck it at the final act boundary.
* A changed revision suppresses the repair as observation_superseded.
* Preserve existing containment rechecks.
* No concurrency override or non-storage await may undermine the construction discipline.

Use the smallest reliable revision mechanism. An instance-local monotonic revision is acceptable if its lifetime and reset behavior are demonstrated sufficient for invalidating in-flight observations. Do not introduce persistent writes to every ordinary watchdog pass unnecessarily.

The previous release of the additive-only constraint is now exercised for these narrowly scoped changes.

The two-part file boundary remains mandatory.

T-17 must demonstrate actual prevention in the adversarial harness, not infer prevention from a static scan.

3. A1-C2 — Strike reservation

The revised Phase B reservation is accepted.

Placing the eligibility derivation and registering intent inside the synchronous boundary addresses the previous check-before-await counterexample.

The following are binding:

* Three is the maximum number of outstanding ineffective registering attempts.
* Each registering intent counts once.
* Its matching completion never counts a second time.
* An unresolved intent is conservatively counted.
* Eligibility must include any outstanding reservation made by a competing evaluation.
* No post-bound evaluation exception exists.
* The projection is not an independent authority.

Recorder-based discharge

The two-consecutive-complete-pass requirement is accepted as a conservative routine observation criterion, provided actual pass identity and ordering support the claimed later delivery.

It is not L-1 certification and does not establish causation by the repair.

Account for the recorder's bounded retention.

Where qualifying discharge evidence is durably established, later recorder pruning must not silently resurrect an already discharged strike. Equally, a missing recorder row must never manufacture discharge.

A durable discharge event carrying the qualifying pass identities is acceptable when produced by an authorized write path. The audit GET must never create it.

Alternatively, retain conservative strike accounting and require explicit acknowledgment until qualifying discharge can be established durably.

If this cannot be implemented within the approved minimal surface, select the conservative alternative rather than expanding scope.

Acknowledgment

The explicit boundaryEventId and atomic event/projection update are accepted.

Validate that the boundary identifies an actual existing intent. Reject nonexistent, future, or otherwise invalid boundaries.

An acknowledgment is a separate authorized action, never implied by evaluation authorization.

Historical unresolved intents remain visible even when acknowledged for eligibility purposes.

4. A1-C3 — Operational prerequisites

Accepted.

The separation between machine-enforced conditions and externally enforced prerequisites is now correct.

The attended A-1 execution fence must retain:

* Current queue-pause read-back within the prescribed 15-minute window.
* Affirmative WAIT-law clearance.
* Valid, action-specific authorization.
* Exclusive control over competing administrative mutations.
* Post-operation verification.

The queue must remain paused throughout the authorized operation.

A reachable coordinator is not proof that an incident has cleared.

T-24a and T-24b correctly distinguish implementation tests from future execution-paperwork requirements.

No unhalted recovery authority is granted.

5. Route and scheduler scope

The route corrections are accepted.

Preserve:

* Closed request-body allowlists.
* Both text-field length limits.
* Recorded reason and authorization reference.
* Server-stamped invocation source.
* Operator-admission stamp integrity.
* HTTP 200 for policy outcomes.
* Non-2xx responses for execution failures.
* No automatic retry following an ambiguous response.

The acknowledgment boundary must be validated as an integer, not a numeric string.

The decision to omit all scheduler wiring from A-1 is confirmed.

No named scheduler entrypoint, activation flag, service binding, Cron Trigger, or automatic caller shall appear in the candidate.

A-3 remains separately gated.

6. A1-C5 — Audit durability

The intent-first ordering, event identities, singleton initialization, and read-only inspection surface are accepted.

One distinction remains mandatory:

Transactional atomicity and output-gate protection do not, by themselves, establish that the intent has independently reached durable storage before an alarm mutation is initiated.

The implementation must establish that property explicitly.

Use documented storage synchronization or an equivalent proven commitment boundary.

If an additional storage await is introduced to establish commitment, preserve the outstanding strike reservation and repeat the final revision, registration-eligibility, halt, containment, and due checks before acting.

Do not introduce non-storage I/O into this sequence.

A reservation that cannot safely proceed must remain auditable. A demonstrably uninitiated act may be recorded as such; an uncertain act remains conservatively counted.

If the intent cannot be established, no watchdog ensure or registration may follow.

Read-only inspection

GET /v2/d6-repair-status is accepted.

It must report the authoritative derivation rather than trust the projection.

Verify zero repair writes and zero wake activity in the read handler.

Distinguish request-handler purity from any independently occurring constructor/schema-initialization effects.

An examination of missing or unverified repair state must not silently repair it through the audit handler.

7. Offline acceptance obligations

The corrected matrix through T-36 is accepted, subject to the conditions in this ruling.

Extend the relevant cases to cover:

* Superseded registration observations detected by the selected revision fence.
* Strike reservations surviving any durable-commit boundary.
* No fourth unauthorized registering act under adversarial interleavings.
* Recorder pruning and unavailable discharge evidence.
* Invalid acknowledgment boundaries.
* Intent commitment failure before watchdog or alarm mutation.
* A committed intent followed by a suppressed or uncertain registration act.
* Revision behavior on coordinator restart.
* Any narrowly modified existing registration or deletion path.

T-35 must reflect the actual storage-only sequence, including any documented commitment operation introduced under §6.

T-36 remains required.

All standing regression suites remain required. Report their actual results, including any failure.

Scheduler-specific tests remain explicitly DEFERRED to A-3. L-1 witness tests remain DEFERRED to L-1.

No deferred test may be represented as passed.

Offline results do not establish actual platform alarm delivery.

8. Implementation authorization boundary

The proposal and addendum are accepted as the implementation basis, as conditioned by this ruling.

Julie may now authorize:

* Construction of a separate offline A-1 candidate from the manifest-verified S1 base.
* The two approved source-part changes.
* The binding implementation conditions in this ruling.
* Offline tests, regression suites, and rollback-compatibility verification.
* Preparation of the complete implementation evidence package.

This ruling does not itself supply Julie's GO.

After her GO, do not return for another proposal review merely to incorporate these conditions. Implement them and return the resulting candidate and evidence.

If a binding condition cannot be satisfied within the approved scope, STOP and return the specific blocker.

9. Next deliverable

Return the A-1 implementation package containing:

1. Exact base and candidate identities.
2. Full manifest and two-part diff verification.
3. Complete changed source files.
4. Implementation-condition disposition map.
5. Complete acceptance-test source and captured logs.
6. Standing regression results.
7. Explicit deferred-test register.
8. Write-set and rollback verification.

The candidate must return for Rowan implementation review before any deployment proposal is presented for approval.

No production contact, deployment, repair evaluation, acknowledgment, stimulus, scheduler activation, containment transition, settings change, queue change, or generation release is authorized.

L-1 remains separately gated.

WS2/Batch untouched.

W-4 remains an OPEN HISTORICAL DEVIATION.

PRODUCTION REMAINS HELD.

TURN: JULIE'S, FOR OFFLINE A-1 IMPLEMENTATION GO. THEN WREN'S.
