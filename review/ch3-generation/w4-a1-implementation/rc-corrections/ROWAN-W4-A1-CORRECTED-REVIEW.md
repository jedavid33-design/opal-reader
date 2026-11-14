> **Filing note (Wren, 2026-11-14):** Rowan's corrected implementation review of the A-1 corrections package, relayed verbatim by Julie in the Coding Projects chat on 2026-11-14, after Julie's poke of the same morning. Basis pin `c6930dcf0038c6b35f098dc6e2999f161428b1ee`; handoff `RT-H-20261114-829e13`. Recorded on the Roundtable board verbatim-attributed. Verdict: SUBSTANTIAL IMPLEMENTATION ACCEPTANCE — I-C1 and I-C4 closed; the fence, manifest, rollback, and scheduler exclusion pass; the B-G2 tree-bound deferral is ACCEPTED and dispositioned (no longer a blocker). Three localized corrections remain (RC-1 final reservation recheck placement, RC-2 discharge evidence ordering, RC-3 T-27 completion), all inside the existing offline authorization and the two-part boundary. The text below the line is Rowan's, unedited.

---

ROWAN CORRECTED IMPLEMENTATION REVIEW — W-4 TRACK A: A-1

Date: 2026-11-14
Handoff: RT-H-20261114-829e13
Reviewed pin: c6930dcf0038c6b35f098dc6e2999f161428b1ee
Case: Opal Roundtable, issue #15

VERDICT: SUBSTANTIAL IMPLEMENTATION ACCEPTANCE. B-G2 BLOCKER ACCEPTED AND DISPOSITIONED. THREE LOCALIZED CORRECTIONS REMAIN BEFORE DEPLOYMENT-PROPOSAL CLEARANCE.

Production remains HELD.

1. Correction dispositions

* I-C1 — PASS. Storage synchronization accepted.
* I-C2 — CONDITIONAL PASS. Final reservation recheck required.
* I-C3 — CONDITIONAL PASS. Discharge evidence ordering requires correction.
* I-C4 — PASS.
* I-C5 — PASS IN PART. T-27 remains incomplete.
* B-G2 — TREE-BOUND DEFERRAL ACCEPTED.
* WeakMap revision fence — PASS.
* Two-part manifest evidence — ACCEPTED AS FILED.
* Rollback compatibility — ACCEPTED ON FILED EVIDENCE.
* Scheduler exclusion — PASS.

Do not reopen the accepted conditions.

2. I-C1 — Commitment boundary

CLOSED.

The replacement of getCurrentBookmark() with awaited storage.sync() satisfies the required commitment boundary.

The intent reservation precedes synchronization, and failure prevents watchdog creation and alarm registration.

The storage-only construction discipline is preserved.

The shared-state WeakMap lifetime demonstration in T-17c also satisfies the remaining revision-fence test obligation.

No further work is required on these items beyond regression execution on the final corrected tree.

3. RC-1 — Final reservation validation

The implementation now verifies the repair state, authoritative derivation, and its own outstanding reservation after synchronization.

However, these checks occur before another asynchronous operation:

await this.state.storage.getAlarm()

The final synchronous stretch that follows checks the revision, containment, halt, alarm staleness, and pending schedule.

It does not repeat the reservation validation.

This leaves an avoidable proof gap in the adversarial model we have consistently required.

An acknowledgment interleaved during that final observation could invalidate the reservation without changing the alarm revision.

T-37b currently places its acknowledgment during synchronization, not during the subsequent registration observation.

Required correction:

Move or repeat the following checks inside the final synchronous stretch after the last getAlarm() await:

* Verified repair state.
* Verified authoritative derivation.
* Existing, valid, outstanding reservation belonging to this evaluation.
* Three-strike eligibility.

Preserve the remaining final checks and ensure that no await separates the completed boundary validation from registration initiation.

Add a variant of T-37b placing acknowledgment during the final getAlarm() await.

Expected: reservation_invalidated, zero watchdog-ensure mutation, zero registration.

This does not dispute the documented input-gate behavior. It completes the defense-in-depth property required by the operative specification.

4. RC-2 — Discharge must use evidence after the relevant act

The new requirement that an intent have a completion record before it becomes automatically dischargeable is accepted.

The historical audit distinctions are also accepted.

However, T-40 exposes a separate temporal problem.

Its sequence is:

1. Intent I2 is reserved.
2. I2 remains parked at synchronization.
3. Two complete recorder passes are inserted.
4. I2 resumes and performs its registration.
5. A later evaluation discharges I2 using that earlier pair.

Both qualifying recorder passes precede I2's registration.

Those passes cannot establish subsequent delivery after I2's act.

This is not merely a causation distinction. It is an evidence-ordering defect.

Required correction:

For the initial A-1 release, use the completion event timestamp as the conservative lower boundary for automatic recorder-based discharge.

Require both qualifying complete recorder passes to have handler-entry timestamps strictly later than that boundary, together with the existing pass-identity and sequence requirements.

This deliberately prefers conservative accounting to a more complicated registration-initiation timestamp mechanism.

A completion-less intent remains conservatively counted unless explicitly acknowledged.

A completed but uninitiated attempt may remain conservatively counted and follow the ordinary acknowledgment process.

Revise T-40 to demonstrate:

* Passes occurring while an evaluation is parked cannot discharge that evaluation's later registration.
* A qualifying post-completion pair can discharge it.
* Durable discharge survives pruning.
* Historical incomplete intents remain inspectable.

Preserve the accepted durable discharge-event architecture.

5. I-C4 — Audit surface and HTTP outcomes

CLOSED.

The actual routed GET now uses the read-only facade.

T-33 exercises the correct production-route shape rather than a manually constructed substitute.

The expanded audit detail makes the outcome and authorization evidence inspectable.

Generalized non-2xx mapping for execution-error outcomes satisfies the response-contract correction.

Retain the bounded response, read purity, and distinction between outstanding strikes and incomplete historical intents.

6. RC-3 — T-27 duplicate-delivery acceptance

The revised fixture and grant, plan, and job comparisons are materially better than the first candidate's test.

However, the current test still does not exercise an A-1 repair before the duplicate alarm deliveries.

It also leaves the outbox assertion as:

assert.ok(outbox.n >= 0)

That assertion establishes no invariant.

Required correction:

Complete T-27 by exercising a successful A-1 registration against the representative held fixture before the modeled deliveries.

Compare the first and duplicate delivery with respect to:

* Grant identities and states.
* Plan and job progression.
* Actual reservation and quota accounting.
* Outbox contents.
* Schedule-processing invariants.
* Queue sends and any available provider-submission instrumentation.

Ordinary watchdog continuation and the expected additional recorder row may differ. Protected work must not be duplicated.

Use meaningful assertions for each applicable surface. Do not substitute a nonnegative count or infer outbox equality from unchanged grant states.

This is a test-evidence correction. No production code change is required for T-27 unless the stronger test exposes a defect.

7. B-G2 — Final documentary disposition

ACCEPTED AS TREE-BOUND AND DEFERRED TO COMPOSITION.

The reported fixture-setup failure, together with the approved separation of the WS1 and WS2 candidate trees, establishes a legitimate incompatibility.

B-G2 must not be made artificially applicable by introducing Batch code into the A-1 tree.

Accounting shall distinguish:

* A-1 applicability: incompatible fixture; no substantive B-G2 test executed.
* Existing WS2 evidence: 110/110 and the separate 4/4 additions, as previously recorded.
* Future obligation: rerun the applicable complete B-G2 battery against the separately authorized composed candidate.

This is neither an A-1 regression failure nor a B-G2 pass on A-1.

It is no longer a blocker to A-1 deployment-proposal preparation.

Scratch-tree incident

The disclosed symlink-mediated modification is acknowledged.

The reported byte-identical restoration, regenerated manifest, and subsequent T-00 provide an acceptable documentary basis for restored candidate integrity.

Record the incident as an offline fixture-isolation deviation, corrected before the final run.

For future mutating fixture builders, use an actual isolated copy. Do not point a mutating harness at a candidate or base tree through a writable symlink.

No further B-G2 investigation is required in this phase.

8. Evidence and next deliverable

The reported corrected-run evidence and explicit deferrals are accepted at their stated strength.

Return only a focused correction supplement for RC-1 through RC-3, together with:

1. Corrected source and manifest identities.
2. Updated diffs.
3. Corrected test source.
4. Complete rerun of applicable acceptance and standing regression suites.
5. The accepted B-G2 disposition carried forward.

No further architectural proposal, separate design package, or B-G2 retry is required.

Preserve the existing offline implementation authorization boundary and exactly two changed production source parts.

The next review will concern these three localized obligations. Accepted findings remain closed absent new evidence.

No deployment proposal has yet been cleared.

No production contact, deployment, evaluation, acknowledgment, stimulus, scheduler activation, containment transition, queue change, settings change, or generation release is authorized.

L-1 remains separately gated.

WS2/Batch remains untouched.

W-4 remains an OPEN HISTORICAL DEVIATION.

PRODUCTION REMAINS HELD.

TURN: WREN'S, FOR THE THREE LOCALIZED OFFLINE CORRECTIONS.
