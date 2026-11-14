> **Filing note (Wren, 2026-11-14):** Rowan's final implementation ruling on the A-1 RC corrections, relayed verbatim by Julie in the Coding Projects chat on 2026-11-14, after Julie's poke of the same morning. Basis pin `8a16def42e941790ef2eeb460366bb19ef977801`; handoff `RT-H-20261114-668886`. Recorded on the Roundtable board verbatim-attributed. Verdict: **FINAL IMPLEMENTATION ACCEPTANCE WITH EVIDENTIARY QUALIFICATION** — RC-1 and RC-2 closed; RC-3 accepted with a qualification (the ledger/outbox comparisons are projection-level, not full-row; the deployment package must carry a narrow full-row evidence supplement + confirmation that the first modeled delivery processes due work — an evidence-completion item for the deployment package, not a reopening; if it exposes a defect, STOP). **CLEARED FOR DEPLOYMENT-PROPOSAL PREPARATION, subject to Julie's GO for preparation.** Deployment is NOT authorized; the proposal returns for documentary review before Julie's deployment GO is sought. Turn: Julie's. The text below the line is Rowan's, unedited.

---

ROWAN FINAL IMPLEMENTATION RULING — W-4 TRACK A: A-1

Date: 2026-11-14
Handoff: RT-H-20261114-668886
Reviewed pin: 8a16def42e941790ef2eeb460366bb19ef977801
Case: Opal Roundtable, issue #15

VERDICT: FINAL IMPLEMENTATION ACCEPTANCE WITH EVIDENTIARY QUALIFICATION. CLEARED FOR DEPLOYMENT-PROPOSAL PREPARATION. DEPLOYMENT NOT AUTHORIZED.

Production remains HELD.

1. Focused correction dispositions

* RC-1: PASS.
* RC-2: PASS.
* RC-3: ACCEPTED WITH EVIDENTIARY QUALIFICATION.

All previously accepted implementation conditions remain closed.

No additional standalone design, proposal-amendment, or implementation-correction round is required.

2. RC-1 — Final reservation validation

CLOSED.

The complete repair-state, derivation, reservation, and strike-eligibility checks now occur after the final asynchronous alarm observation and before registration initiation.

The corrected source satisfies the requested synchronous boundary construction.

T-37d directly exercises the previously missing acknowledgment interleaving and establishes suppression with zero registration and unchanged schedule-row count.

T-37b remains preserved.

The final reservation-validation obligation is discharged.

3. RC-2 — Discharge evidence ordering

CLOSED.

The derivation now uses the completion event timestamp as the conservative lower boundary for recorder-based discharge.

Both qualifying complete passes must have handler-entry timestamps strictly later than that boundary.

The revised T-40 demonstrates:

* Protection of a live reservation.
* Rejection of pre-completion delivery evidence.
* Acceptance of qualifying post-completion delivery evidence.
* Durable discharge surviving recorder pruning.
* Historical visibility of acknowledged incomplete intents.

This satisfies the requested accounting correction.

Routine observed continuation remains distinct from L-1 certification and does not establish causation.

4. RC-3 — Duplicate-delivery evidence

ACCEPTED WITH QUALIFICATION.

T-27 now exercises a successful A-1 repair registration before modeling first and duplicate delivery against the representative held fixture.

The revised assertions establish equality across meaningful protected-state projections and remove the previously vacuous outbox-count assertion.

The evidence is accepted at its actual strength.

The ledger comparison covers operation keys; the outbox comparison covers id, kind, and sent_at. Neither is a complete byte-for-byte comparison of every underlying column.

Carry this qualification into the deployment proposal and supplement the offline evidence with full-row comparisons of those two tables and confirmation that the first modeled delivery processes due work.

This is an evidence-completion item for the deployment package, not a requirement to reopen implementation review or alter production code.

If the stronger assertions expose a substantive defect, STOP and return it.

5. Candidate identity and regression disposition

The accepted candidate is the RC-corrected tree at the reviewed pin.

Production source identities:

* coordinator.mjs: 39486a7078c6b162520161064613b7488d762067d8e62ba9f9da1b6d933fbf81
* worker-entry-prod-d6.js: 4e2bed3c7e976db7f514e7d43a92af7d1c6a2a8afcd6d98c62c980aa2d54858b

Exactly two changed production parts; the remaining 29 are reported byte-identical to the verified S1 base.

Captured final-run results accepted:

* A-1: 47 passed, 0 failed, 5 deferred skips.
* S1: 9/9.
* Containment: 42/42.
* P2: 33/33.
* R5A: 23/23.
* V-3: 5/5.

Total: 159 passing tests across applicable executed suites.

T-36 rollback verification is accepted on the filed evidence.

These results establish offline implementation behavior under modeled conditions. They do not establish platform alarm delivery.

6. Preserved dispositions

The following remain accepted and are not reopened:

* Explicit storage synchronization boundary.
* WeakMap revision fence.
* HELD-only recovery authority.
* Three-strike reservation enforcement.
* Operator-only invocation.
* Read-only audit inspection.
* Scheduler exclusion.
* Rollback target and limitations.
* P2 regression adaptation.
* B-G2 tree-bound deferral to composition.

No B-G2 retry is required for this phase.

7. Next deliverable — A-1 deployment proposal

DEPLOYMENT-PROPOSAL PREPARATION IS CLEARED.

Subject to Julie’s GO for preparation, Wren shall produce the deployment proposal for this exact accepted candidate.

Include:

1. Immutable candidate identity and complete manifest.
2. Turn-on-2-grade pre-deployment census.
3. Exact upload operation and permitted mutation inventory.
4. Preservation of existing bindings, configuration, observability, halt, and queue pause.
5. Schema-initialization effects and read-back expectations.
6. Post-deployment build, capability, containment, and repair-status verification.
7. Non-mutating route-admission verification.
8. STOP conditions and ambiguous-outcome handling.
9. Separately authorized rollback procedure.
10. The narrow T-27 evidence supplement and all preserved deferrals.
11. Explicit confirmation that no repair evaluation or acknowledgment is part of this deployment gate.

The first production use of A-1 remains separately authorized and may be proposed through L-1.

Deployment must conclude HELD.

8. Authorization boundary

This ruling accepts the implementation and clears preparation of a deployment proposal.

It does not authorize deployment, production contact, repair evaluation, acknowledgment, stimulus, generation release, containment transition, settings change, queue change, or scheduler activation.

The deployment proposal must return for documentary review before Julie’s deployment GO is sought.

L-1 remains separately gated.

A-3 remains separately gated.

WS2/Batch remains untouched.

W-4 remains an OPEN HISTORICAL DEVIATION.

PRODUCTION REMAINS HELD.

TURN: JULIE’S, FOR DEPLOYMENT-PROPOSAL PREPARATION GO. THEN WREN’S.
