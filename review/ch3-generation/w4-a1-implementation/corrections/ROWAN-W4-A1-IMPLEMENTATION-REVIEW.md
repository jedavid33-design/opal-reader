> **Filing note (Wren, 2026-11-14):** Rowan's implementation review of the A-1 implementation package, relayed verbatim by Julie in the Coding Projects chat on 2026-11-14, after Julie's poke of the same morning. Basis pin `d873ce75abe6bb069d206f8c456e886890b66f0a`; handoff `RT-H-20261114-a58bcb`. Recorded on the Roundtable board verbatim-attributed. The corrections (I-C1–I-C5) are targeted implementation corrections INSIDE the scope of Julie's offline implementation GO (board 6878879682) — the final ruling's §8 directed Wren to implement conditions and return the candidate without another proposal round — so they proceed under that GO; no new scope, no production contact. The text below the line is Rowan's, unedited.

---

ROWAN IMPLEMENTATION REVIEW — W-4 TRACK A: A-1

Date: 2026-11-14
Handoff: RT-H-20261114-a58bcb
Reviewed pin: d873ce75abe6bb069d206f8c456e886890b66f0a
Case: Opal Roundtable, issue #15

VERDICT: IMPLEMENTATION ACCEPTED IN PART. TARGETED OFFLINE CORRECTIONS REQUIRED BEFORE DEPLOYMENT-PROPOSAL PREPARATION.

The recovery architecture and operative specification remain accepted. No additional design round is required.

Production remains HELD.

1. Implementation dispositions

* Base and manifest evidence: ACCEPTED AS FILED.
* Two-part change boundary: PASS.
* WeakMap revision fence: ACCEPTED.
* Strike reservation architecture: ACCEPTED WITH CORRECTION.
* Bookmark commitment boundary: REPLACE.
* Durable discharge architecture: ACCEPTED WITH QUALIFICATION.
* Operator admission and request validation: ACCEPTED WITH RESPONSE CORRECTION.
* Audit surface: CORRECTION REQUIRED.
* Scheduler exclusion: PASS.
* Rollback compatibility: ACCEPTED ON FILED EVIDENCE.
* Acceptance and regression evidence: INCOMPLETE.

Review was conducted against the pinned package, source changes, relevant full-source sections, test definitions and captured logs. The harness was not independently rerun.

2. I-C1 — Commitment boundary

Replace getCurrentBookmark() with await state.storage.sync().

Cloudflare's SQLite-backed Durable Object Storage API documents two distinct operations:

* getCurrentBookmark(): obtains a bookmark representing a point in the object's history.
* sync(): synchronizes pending writes to disk and resolves when pending writes complete.

Source:
https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/

The bookmark documentation does not explicitly establish the independent durability guarantee required by the final ruling.

The sync documentation does.

This is a narrow substitution within the existing architecture. Preserve the Phase B1 reservation, commitment failure handling, and Phase B2 boundary checks.

Update the harness commitment seam, T-20, T-17b, T-24a, and T-35 accordingly.

No PITR operation is required for A-1.

3. Revision fence

ACCEPTED.

The WeakMap keyed by the Durable Object state object is an appropriate minimal implementation.

It avoids the coordinator-per-request lifetime problem without introducing persistent writes into ordinary alarm passes.

The six mutation initiation sites are covered in the filed source.

The revision remains instance-local because the observations it protects are themselves instance-local. A replaced instance cannot continue executing an observation owned by its terminated predecessor.

Retain the fence and the documented storage-only construction discipline.

T-17a and T-17b establish the intended modeled invalidation behavior.

For completeness, extend the lifetime test to use two distinct GenerationCoordinator wrappers sharing the same state object. A registration through one wrapper must invalidate an observation through the other.

No persistent revision counter is required.

4. I-C2 — Phase B2 must fail closed

The strike reservation in Phase B1 correctly addresses the original concurrent fourth-registration counterexample.

However, there is a concrete defect in the second boundary check.

At the current coordinator source around lines 3290–3293, the method calculates othersOutstanding from derive2.unresolvedIntentIds without first checking derive2.verified.

A failed derivation returns an empty array.

Consequently, a storage-read failure can be interpreted as zero competing outstanding reservations, allowing the evaluation to proceed.

That is the opposite of the required fail-closed behavior.

Required correction

At Phase B2:

1. Verify repair state again.
2. Verify the authoritative strike derivation.
3. Establish that the evaluation's own reservation still exists and remains valid.
4. Reject an unreadable, missing, discharged, acknowledged-away, or otherwise invalid reservation.
5. Re-establish P-STALE from a fresh registration observation after the synchronization boundary, with the revision fence preserved.
6. Perform the final synchronous eligibility, containment, halt, and due checks before initiation.

A platform-side change in registration state need not increment the application's revision counter. The final registration observation therefore remains necessary.

Add fault-injection cases for failed derivation and invalidated reservation after synchronization.

A failed boundary check must produce zero watchdog-ensure and registration acts.

5. I-C3 — Recorder discharge and audit meaning

The durable discharge-event architecture is accepted.

Persisting qualifying evidence prevents recorder pruning from resurrecting a durably discharged strike.

The production recorder also captures rec.at at handler entry, rather than at row insertion. Preserve that distinction in the evidence description.

However, the current derivation anchors evidence to the intent timestamp alone and does not distinguish a still-active reservation from an attempt that has completed or ceased.

A live reservation must not automatically become available for discharge or acknowledgment while its evaluation can still act.

Prevent that case explicitly. Either protect active reservations against discharge or acknowledgment, or invalidate their permission to proceed when such an event occurs.

Retain conservative treatment of unresolved attempts.

Also distinguish:

* Outstanding strikes.
* Intents lacking a completion record.
* Completed but ineffective attempts.
* Acknowledged historical attempts.

The current unresolvedIntentIds field represents outstanding strikes, not exclusively unresolved intent/completion pairs.

An acknowledged or recorder-discharged intent with no completion must remain visible as historically unresolved.

Add tests for this distinction and for historical visibility after recorder pruning.

Routine discharge is evidence of later observed delivery. It remains distinct from L-1 certification and does not establish causation.

6. I-C4 — Audit surface and HTTP outcomes

Actual read-only route

The intended audit surface is accepted, but T-33 does not execute the actual production route.

It manually constructs a coordinator with ASSUME_SCHEMA: true.

The production repair-status handler currently constructs its coordinator with d6HostEnv alone. This permits constructor initialization of the repair tables and singleton.

Therefore, the fixture establishes the purity of a specially configured facade, not the missing-state behavior of the shipped GET handler.

Use the existing read-only facade pattern on the real repair-status path.

Test missing repair state through the actual routed GET on an already instantiated object.

The handler must report the missing state without repairing it. Independently occurring object initialization remains separately accounted for.

Inspectable audit evidence

The current status response exposes recent event summaries but omits the detail payload needed to inspect several of the safety facts.

Expose, within the authorized and bounded audit response, the relevant:

* Registration due and read-back.
* Act-initiation status.
* Discharge pass identities.
* Acknowledgment boundaries.
* Intent/completion linkage.
* Audit references and recorded reasons.

The operator must be able to disposition an ambiguous attempt without requiring an undocumented storage-access operation.

HTTP failures

The route returns HTTP 500 for three explicitly enumerated error outcomes.

The coordinator can additionally return error:containment_unverified and error:registration_unreadable.

These currently fall through to HTTP 200.

Every execution-error outcome must produce a non-2xx response. Do not equate an unreadable prerequisite with a successful policy evaluation.

Add routed response tests for those cases.

Preserve a clear distinction between failed setAlarm, completed setAlarm with unavailable read-back, and observed delivery.

7. I-C5 — Acceptance evidence

The filed logs support the reported results:

* A-1: 38 passed, 0 failed, 5 skipped.
* S1: 9/9.
* Containment: 42/42.
* P2: 33/33.
* R5A: 23/23.
* V-3: 5/5.

The deferred register is correctly reported.

P2 adaptation

Accepted.

The snapshot comparison necessarily excludes the newly introduced tables, and the additional guard supplies evidence that ordinary alarm traffic leaves their contents unchanged.

Describe this accurately as a disclosed change to the snapshot comparison's scope, with compensating coverage.

Missing standing regression

B-G2, specified in the operative proposal at 110 tests or its reviewed successor, is absent from the final-run register.

Run it against the corrected candidate or return a specific blocker for separate documentary disposition.

Do not represent the standing regression obligation as completely satisfied until B-G2 is accounted for.

T-27 — substantive test correction

The current T-27 includes:

rows.every((r) => r.state !== "pending" || r.state === "pending")

That expression is always true.

The additional assertion that a row count is nonnegative establishes no meaningful idempotence property.

Zero queue sends in a held, watchdog-only fixture is useful but does not establish the required protection against duplicate plan advancement or reservations.

Replace these assertions with substantive invariants over a representative held plan/job fixture.

Compare the first delivery and subsequent duplicate delivery with respect to:

* Schedule processing.
* Plan advancement.
* Grant identities.
* Reservation and quota state.
* Outbox and queue activity.
* Provider submission.

The duplicate must not repeat protected work.

Remaining race coverage

Account explicitly for the required mid-evaluation containment transition and earlier pending-row insertion cases.

A test beginning in CHAIN_STOPPED does not substitute for a containment transition occurring during an evaluation.

Preserve T-15 and the adversarial cases even if the platform's documented input gate would exclude particular harness interleavings.

8. Correction scope and return package

These are implementation corrections, not a request for another design or proposal cycle.

Preserve:

* The manifest-verified S1 base.
* Exactly two changed production source parts.
* P-STALE-only repair authority.
* HELD-only recovery.
* The operator-only invocation boundary.
* Scheduler absence.
* The existing rollback target.
* All procedural execution prerequisites.
* Zero production contact.

Return the corrected candidate, updated manifest, full changed sources and diffs, condition-disposition supplement, and one complete captured final test run.

No earlier passing result may be represented as a result from the corrected tree unless the test was rerun there.

Everything else in the review is preserved as filed.

No deployment proposal is cleared yet.

No production evaluation, acknowledgment, stimulus, deployment, scheduler activation, settings change, containment transition, queue change, or generation release is authorized.

L-1 remains separately gated.

WS2/Batch untouched.

W-4 remains an OPEN HISTORICAL DEVIATION.

PRODUCTION REMAINS HELD.

TURN: WREN'S, FOR TARGETED OFFLINE IMPLEMENTATION CORRECTIONS.
