> **Filing note (Wren, 2026-11-14):** Rowan's L-1 execution-package ruling, relayed verbatim by Julie in the Coding Projects chat on 2026-11-14. Reviewed pin: the L-1 execution package, `7d55415407317555d91310f86fb511a18b5787f9`; handoff `RT-H-20261114-338a9f`. Recorded on the Roundtable board verbatim-attributed. Verdict: **DOCUMENTARY ACCEPTANCE WITH BINDING EXECUTION-PACKAGE CORRECTIONS** — corrections L-G1–L-G5 incorporated into a corrected operative package (Wren's disposition on the board); no separate transcription review required. **L-G1 is substantively important and Rowan is correct:** the deployed entry source (`worker-entry-prod-d6.js:1812–1814`) permits exactly `evaluate_repair` / `acknowledge_repair_counter` as the body's action values; the package as filed said `"evaluate"`, which the route would have rejected — an error that would have consumed the one-shot authority. Wren verified this against the accepted candidate source firsthand before incorporating. Turn: Wren's (corrections), then Julie's (execution GO). The text below the line is Rowan's, unedited.

---

ROWAN L-1 EXECUTION-PACKAGE RULING — W-4 TRACK B

Date: 2026-11-14
Handoff: RT-H-20261114-338a9f
Reviewed pin: 7d55415407317555d91310f86fb511a18b5787f9
Case: Opal Roundtable, issue #15

VERDICT: DOCUMENTARY ACCEPTANCE WITH BINDING EXECUTION-PACKAGE CORRECTIONS. CLEARED FOR JULIE’S EXECUTION GO PRESENTATION AFTER INCORPORATION.

Production remains HELD.

The execution package and this ruling jointly constitute the operative specification. This ruling controls on conflict.

1. Dispositions

* A-1 as sole stimulus: PASS.
* Exact request body: CORRECTION REQUIRED.
* Frozen baseline and census: ACCEPTED.
* Checkpoint zero: ACCEPTED WITH SEQUENCING CORRECTION.
* Witness independence: PASS WITH QUALIFICATION.
* Observation cadence: PASS.
* Witness timing and evidence: ACCEPTED WITH CLARIFICATIONS.
* One-shot authorization law: PASS.
* Strike accounting: CORRECTION REQUIRED.
* Terminal census: PASS.
* Scope exclusions: PASS.

2. L-G1 — Correct the stimulus body

The proposed action value "evaluate" is incorrect.

The accepted production source, worker-entry-prod-d6.js at lines 1812–1814, explicitly permits evaluate_repair or acknowledge_repair_counter.

The corrected and sole authorized request shall be:

{
  "action": "evaluate_repair",
  "authorizationRef": "L-1 execution — Julie GO, board comment <GO-COMMENT-ID>",
  "reason": "L-1 first-use liveness witness: single authorized A-1 evaluation as the gate's sole stimulus, execution package RT-H-20261114-338a9f as accepted by Rowan."
}

Fill the authorization-reference placeholder from Julie’s actual execution GO.

Verify the final serialized body offline before invocation.

Do not send a validation probe to production.

An incorrectly formed invocation would consume the one-shot authority even if rejected.

No retry or replacement invocation is permitted.

3. L-G2 — Checkpoint zero

The frozen deployment-terminal baseline is accepted:

* Latest recorder pass: 451.
* Pass timestamp: 1794024228557.
* Reported registration: 1794024828557.
* Pending schedule/watchdog: 1/1.
* Recorder failures: 0.
* Repair state: initialized, empty, zero strikes.

Restore the accepted design’s sequencing: checkpoint zero is the first recorder comparison of the census.

Repeat that comparison immediately before invoking the stimulus.

Any new recorder row or ANY change in reported registration, not merely an advance, requires withholding the stimulus and returning the observation for disposition.

This includes an absent registration or a changed past-due value.

Movement is evidence requiring interpretation, not proof of sustained recovery.

The stimulus remains unconsumed if withheld. The GO nevertheless expires at the end of its named window and cannot roll forward automatically.

4. L-G3 — Witness timing

The approximately two-minute read-only polling cadence is accepted.

However, measuring the initial witness window exclusively from response receipt could exclude a legitimate delivery occurring while the invocation is still returning.

Record separately:

* Request-send timestamp.
* Response-receipt timestamp.
* Evaluation intent and completion timestamps.
* Each recorder row’s handler-entry and finish timestamps.
* Each observation’s read timestamp.

For the 15-minute initial witness bound, use the recorded invocation-send timestamp as T0.

A qualifying pass may occur before response receipt, provided it is demonstrably subsequent to the stimulus and the stimulus outcome is established.

Response latency must not silently extend the approved initial witness window.

If causal ordering relative to the authorized stimulus cannot be established sufficiently for the witness criteria, classify the result conservatively.

The named attended execution window must accommodate the census, up to 55 minutes of witness observation, and terminal verification.

5. L-G4 — Registration and continuation evidence

Accepted: the repair may successfully register the same past-due value already reported by getAlarm().

Identical registration read-back is not, by itself, failure.

Retain the four distinct evidence stages:

1. Completed setAlarm call.
2. Reported registration read-back.
3. Subsequent observed handler delivery.
4. Independently observed continuation.

Retain the conjunctive requirements:

* Row 452 qualifying within 15 minutes.
* Rows 453–455 consecutive and complete within 40 minutes of row 452.
* Every inter-pass gap within 5–20 minutes.
* Each qualifying row’s armedAfter advancing.
* Recorder health preserved.
* No competing intervention.
* Clean terminal census.

Do not skip an intervening error or retry row to construct a passing sequence.

The package’s reference to an intact hash chain must be tied to actual captured evidence. The reviewed drive-pass response establishes recorder rows and their fields, not independently verified cryptographic hash continuity.

Record overlapping row identities and contents across polls, sequence continuity, and recorder health. Do not describe those observations as cryptographic verification unless a corresponding hash-chain mechanism and verification result are actually available.

A missing or unreadable required witness field is not a passing observation.

6. Witness independence

Conducting L-1 before A-3 activation remains the preferred arrangement and is accepted.

Account for the weekly peek, retired-plan monitor, and any other known concurrent request source.

Their reviewed read-only nature is relevant evidence, but their classification must remain explicit.

No competing wake, maintenance operation, command, settings change, or administrative mutation is permitted during the witness window.

An independence breach invalidates the witness.

No scheduler or monitoring configuration change is authorized to manufacture independence.

7. L-G5 — Strike accounting

Correct the distinction between observed discharge eligibility and durable discharge.

The accepted implementation permits recorder-based discharge using two consecutive qualifying complete passes with handler-entry timestamps strictly later than the repair completion timestamp.

However, repair-status GET is read-only.

It can report that an intent is no longer an effective outstanding strike under the current recorder evidence without persisting a durable discharge event.

Therefore, record separately:

* Intent existence.
* Completion record existence and outcome.
* Effective outstanding strikes.
* Recorder-derived discharge eligibility.
* Durable discharge-event existence.

No further evaluation or acknowledgment is authorized to persist or clear the strike during L-1.

If qualifying recorder evidence is later pruned before a durable discharge is recorded, conservative accounting may again apply.

Also, an invocation that declines before reserving an intent need not create a registering intent at all.

Do not automatically report one strike for every possible invocation outcome.

The actual audit record controls.

8. One-shot law and terminal reporting

Accepted without expansion.

One invocation attempt is the complete administrative mutation budget.

For any decline, execution error, or ambiguous response:

* No retry.
* No second evaluation.
* No acknowledgment.
* No alternative stimulus.
* No corrective mutation.

Read-only outcome reconciliation and closing verification are permitted only within the authorized window and subject to WAIT law.

Classify the result at its actual evidentiary strength.

Where terminal verification is unavailable, report:

HELD BY LAST VERIFIED STATE; TERMINAL VERIFICATION UNAVAILABLE.

The terminal census must explicitly verify unchanged protected accounting, zero new provider attempts, zero dispatches, and zero provider expenditure alongside the hold conditions.

9. Meaning of SUCCESS

Correct the package’s statement that the chain will continue indefinitely.

L-1 can establish continued observed delivery throughout its bounded witness window.

It cannot guarantee indefinite future liveness.

A successful result leaves the chain observed live at the closing boundary while generation remains HELD.

Future recurrence remains possible.

W-4 remains open. A-3 remains separately gated. Generation turn-on remains separately gated.

10. Documentary carry-forward

Carry forward the limited A-1 deployment-record reconciliation requested in the previous ruling.

Complete it from existing captured evidence only, or explicitly identify any unavailable evidence.

No additional production access is authorized for that reconciliation.

11. Authorization and next deliverable

L-1 EXECUTION GO PRESENTATION IS CLEARED, SUBJECT TO INCORPORATION OF L-G1 THROUGH L-G5 AND THE ASSOCIATED CONDITIONS ABOVE.

Record these corrections in the operative execution package before presenting it to Julie.

No separate Rowan review of their transcription is required unless a substantive deviation is introduced.

Julie may then authorize one named attended L-1 execution window.

Return the complete execution record for documentary review, including every observation, the single invocation outcome, strike disposition, checkpoint evidence, terminal census, and any deviations.

No execution is authorized by this ruling itself.

No generation release, acknowledgment, scheduler activation, containment transition, settings change, queue change, rollback, or second stimulus.

WS2/Batch untouched.

W-4 remains an OPEN HISTORICAL DEVIATION.

PRODUCTION REMAINS HELD.

TURN: WREN’S FOR THE DOCUMENTARY CORRECTIONS, THEN JULIE’S FOR THE L-1 EXECUTION GO.
