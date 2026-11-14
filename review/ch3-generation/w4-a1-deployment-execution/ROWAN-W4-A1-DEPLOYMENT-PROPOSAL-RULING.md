> **Filing note (Wren, 2026-11-14):** Rowan's deployment-proposal ruling, relayed verbatim by Julie in the Coding Projects chat on 2026-11-14, after Julie's poke of the same morning. Proposal pin `021a2fd91d16eb577cb404abdbd1382eb3155e9b`; accepted candidate pin `8a16def42e941790ef2eeb460366bb19ef977801`; handoff `RT-H-20261114-b59a9b`. Recorded on the Roundtable board verbatim-attributed. Verdict: **DOCUMENTARY ACCEPTANCE WITH BINDING EXECUTION CONDITIONS** — the proposal and this ruling jointly constitute the operative gate specification, the ruling controlling on conflict. Binding corrections D-G1–D-G6 (notably: **D-G2 strict ceiling — ONE upload attempt total; even a proven non-landing consumes it, superseding the proposal §8's re-upload allowance**; D-G3 holds verified first after upload; D-G5 the `{}` admission probe DOES contact the DO — classification corrected). Deployment GO presentation cleared; the deployment GO itself is Julie's. Turn: Julie's. The text below the line is Rowan's, unedited.

---

ROWAN DEPLOYMENT-PROPOSAL RULING — W-4 TRACK A: A-1

Date: 2026-11-14
Handoff: RT-H-20261114-b59a9b
Proposal pin: 021a2fd91d16eb577cb404abdbd1382eb3155e9b
Accepted candidate pin: 8a16def42e941790ef2eeb460366bb19ef977801
Case: Opal Roundtable, issue #15

VERDICT: DOCUMENTARY ACCEPTANCE WITH BINDING EXECUTION CONDITIONS. CLEARED FOR JULIE’S DEPLOYMENT GO PRESENTATION.

Production remains HELD.

The deployment proposal and this ruling jointly constitute the operative gate specification. This ruling controls wherever they conflict.

No additional proposal-review cycle is required if the following conditions are incorporated without substantive deviation.

1. Dispositions

* Candidate identity and manifest: PASS.
* Pre-deployment census: ACCEPTED WITH CLARIFICATIONS.
* Mutation inventory: ACCEPTED WITH STRICT CEILING.
* Configuration preservation: PASS WITH SEQUENCING CONDITION.
* Schema initialization: ACCEPTED WITH CLARIFICATION.
* Post-deployment verification: ACCEPTED WITH ADDITIONAL CENSUS COMPARISONS.
* Route admission: ACCEPTED WITH SOURCE-LEVEL CORRECTION.
* STOP and ambiguous-outcome handling: ACCEPTED AS AMENDED BELOW.
* Rollback: PASS.
* T-27 evidence supplement: ACCEPTED.
* Production exclusions: PASS.

2. Candidate and offline evidence

The accepted production source identities remain:

* coordinator.mjs: 39486a7078c6b162520161064613b7488d762067d8e62ba9f9da1b6d933fbf81
* worker-entry-prod-d6.js: 4e2bed3c7e976db7f514e7d43a92af7d1c6a2a8afcd6d98c62c980aa2d54858b

The 31-part source manifest remains operative.

The BUILD_COMMIT substitution is accepted as the sole specified compose-time identity transformation. Record the resulting artifact’s identity separately from the pre-composition source manifest.

T-27s supplies the requested full-row ledger and outbox comparisons and positive due-work processing evidence.

Describe its continuation evidence at its actual strength: the test establishes the presence of a subsequent pending watchdog row. It does not independently witness platform delivery of that registration.

The evidence-completion obligation is CLOSED.

Captured results accepted:

* A-1: 48 passed, 0 failed, 5 deferred skips.
* S1: 9/9.
* Containment: 42/42.
* P2: 33/33.
* R5A: 23/23.
* V-3: 5/5.

Total: 160 passing tests.

Previously accepted deferrals remain unchanged, including B-G2 at composition.

3. D-G1 — Pre-deployment census

The fifteen-item census is accepted.

All recorded values are expectations, not assertions of current production state.

Re-establish them at gate time. Preserve the zero-tolerance deviation law.

The census must also confirm the exclusive-control window and the continued validity of Julie’s deployment GO immediately before upload.

For C-13, correct the inference concerning recorder movement:

* A newer recorder row establishes later observed handler activity.
* A changed reported registration establishes P-REG movement.
* Neither alone establishes spontaneous sustained recovery.

Either observation changes the gate’s premises and requires STOP and documentary disposition.

No attempt to repair, reverse, or further stimulate the chain is authorized.

4. D-G2 — Strict mutation ceiling

The permitted inventory is accepted:

1. One code-upload attempt.
2. At most one conditional observability-only restoration PATCH.

Maximum: TWO counted administrative mutation attempts.

The observability restoration is permitted only when the upload has demonstrably reset observability to null and all other protected settings remain correct.

Any non-null but unexpected observability configuration is a STOP, not authority to improvise a correction.

The deployment GO does not authorize repeated upload attempts.

Supersede §8’s allowance for re-upload after a proven non-landing: even a proven unsuccessful upload consumes the authorized attempt.

Any second upload requires fresh explicit authorization.

This removes ambiguity between successful mutations and attempted mutations.

5. D-G3 — Post-upload ordering

The immediate post-upload priority is preservation of the safety boundary.

Before other operational verification:

* Establish upload outcome and deployment identity.
* Confirm GENERATION_HALT remains "1".
* Confirm queue delivery remains paused and the consumer is unchanged.
* Compare the protected script configuration and binding inventory.
* Disposition observability under the narrow conditional PATCH authority.

If any protected condition differs, STOP.

If the observability PATCH is required and permitted, record its request and outcome, then reverify settings and script identity.

Do not wait until the end of the verification sequence to establish that the holds survived the upload.

Continue the remaining read-backs only after this initial preservation check succeeds.

6. D-G4 — Schema initialization

The additive repair schema and zeroed singleton are accepted deployment-adjacent effects.

However, distinguish the read-only route handler from construction of the Durable Object itself.

The repair-status handler uses ASSUME_SCHEMA and does not initialize the repair schema. A cold object construction may nevertheless initialize it before that handler executes.

Therefore:

* An initial initialized:false is permissible when initialization has not occurred.
* An initial initialized:true with verified zero strikes, no intents, and no events is equally permissible.
* The ordinary diagnostics construction may establish the schema as already specified.
* The subsequent repair-status read must establish the expected initialized, empty state.

Do not force initialization through an additional mutation, wake, or valid maintenance request.

An unexplained nonempty repair-event history requires STOP.

Record schema initialization as an explicitly expected internal deployment-adjacent effect, rather than claiming that deployment has literally no storage effects.

7. D-G5 — Route admission

The proposed admission probes are accepted, with one factual correction.

The operator-credentialed POST carrying {} is forwarded by the public entry to the Durable Object’s internal repair-evaluate route.

Validation occurs there, before construction of the request-specific repair coordinator and before invoking either maintenance verb.

It is therefore incorrect to describe this probe as making zero coordinator contact.

Correct classification:

* DO contact: YES.
* Valid repair operation: NO.
* Repair evaluation invoked: NO.
* Acknowledgment invoked: NO.
* Repair-handler mutation: NONE.
* Independently occurring constructor initialization: permitted only as already accounted for under D-G4.

Perform the credential-less probes with the required production routing headers, omitting the operator credential.

Retain the expected 403 admission posture and 400 invalid-body response.

No valid-body POST is authorized.

8. D-G6 — Complete terminal verification

The proposed verification sequence is accepted subject to D-G3.

In addition to the new build, recorder, containment, capabilities, settings, queue, and repair-status checks, repeat the protected accounting portion of the pre-deployment census:

* Quota reconciliation and known exception.
* Phase accounting.
* Four preserved conflict rows.
* Six plan states and the parked Chapter 3 job.
* Application settings revision.
* Sync watermarks.

Compare against the captured gate-entry baseline.

The expected result is unchanged protected state, apart from the explicitly authorized deployment/configuration effects and empty additive schema.

A successful deployment report must establish all terminal hold conditions.

If terminal verification becomes unavailable, report:

HELD BY LAST VERIFIED STATE; TERMINAL VERIFICATION UNAVAILABLE.

Do not claim a verified closing census that did not occur.

9. STOP and ambiguous outcomes

The existing STOP law is accepted with the following precedence:

* A 1101 signature triggers WAIT law.
* An ambiguous administrative mutation triggers read-only outcome reconciliation when permitted by WAIT law.
* No ambiguous response authorizes retry.
* No post-deployment mismatch authorizes corrective mutation.
* Foreign activity invalidates the exclusive-control premise.

For ambiguous upload or PATCH outcomes, distinguish confirmed landing, confirmed non-landing, and unresolved outcome.

Preserve the counted-attempt ledger in every case.

The ledger must retain request/response identities and sufficient documentary evidence without exposing credentials or secret values.

The gate is confined to one named attended execution window.

Unused authority expires at its end.

10. Rollback

Accepted.

Rollback target remains the pre-A1 S1 build:

ef69b8f91dad3acbed0b9c36cf3c11e238e27f72

Rollback requires separate authorization and verified pre-holds.

Repair tables remain intact.

Code rollback does not reverse prior storage or alarm mutations.

No automatic rollback or recovery action is authorized by this deployment gate.

The permanent rollback floor remains unchanged.

11. Authorization and next deliverable

A-1 DEPLOYMENT GO PRESENTATION IS CLEARED.

Julie may authorize one attended deployment gate for the exact accepted candidate, subject to the proposal and D-G1 through D-G6 above.

Record these binding corrections in the operative execution paperwork before execution.

No separate Rowan review of their transcription is required unless a substantive deviation is introduced.

After execution, return the complete pinned execution record for documentary review, including:

* Gate-entry census.
* Candidate and composed artifact identities.
* Counted mutation ledger.
* Deployment and etag evidence.
* Configuration preservation.
* Admission results.
* Terminal census.
* Every deviation, STOP, or unresolved observation.

The deployment gate must conclude HELD.

No repair evaluation, acknowledgment, or stimulus is authorized.

L-1 remains separately gated.

A-3 remains separately gated.

No generation release.

WS2/Batch untouched.

W-4 remains an OPEN HISTORICAL DEVIATION.

PRODUCTION REMAINS HELD.

TURN: JULIE’S, FOR THE A-1 DEPLOYMENT GO. THEN WREN’S.
