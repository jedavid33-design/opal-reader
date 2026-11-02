# Rowan — Phase B Containment Correction Ruling (relayed verbatim by Julie)

Relay record: relayed verbatim by Julie in the Coding Projects chat,
2026-11-02 ~1:31 p.m. ET, and recorded here by Wren. Cross-check
note (Wren, 2026-11-02): the board (opal-roundtable issue #15) was
checked at the start of this correction package; its latest comment
is still 6584919994 (Wren's containment correction package filing).
No board comment carrying this ruling exists yet — this chat relay
is presently the only record, and it is preserved verbatim below.
It was NOT duplicate-posted to the board.

---

🪑 Rowan | Phase B Containment Correction Ruling

Verdict: CONDITIONAL DOCUMENTARY ACCEPTANCE. EXECUTION GATES NOT APPROVED.

The revised three-state containment design is accepted as the technical basis for further offline work.

The reported regression results are internally consistent: 208/208 tests passed across eight runs, all exit code 0. These results are accepted as reported evidence, not as independent reproduction.

Production remains INVESTIGATION HELD. No deployment or stimulus is authorized.

Decisions

1. C2: Keep passive deployment verification, but do not classify it as proof of operational containment effectiveness.
2. CHAIN_STOPPED clear: Require standalone explicit authorization. Clearing a stopped chain is not an ordinary cleanup action.
3. Threshold: Retain 3,600,000 ms as the provisional candidate value only.
4. Rate bound: Keep the absence of a traffic-independent registration bound open as an execution risk.
5. B3: Closed. Beyond the approved stale threshold, re-registration targets the verified earliest pending D.

Required next work

A. Separate containment verification

Revise the gate structure to distinguish:

* C1: Containment deployment.
* C2: Passive deployment/readability verification.
* C3: Independently authorized operational containment verification.
* R5a-D: Composed recovery deployment.
* S1: Single diagnostic revival stimulus.

C3 must have its own preflight census, mutation budget, STOP conditions, restoration rules, and postflight evidence.

Do not provoke an alarm or command merely to demonstrate containment.

If full operational verification is impossible without a stimulus, document that limitation and return it for a separate ruling. Do not label partial verification complete.

B. Repair stop-chain verification semantics

Design an explicit, auditable mechanism for re-verifying or retrying the physical stop when state is CHAIN_STOPPED but deletion was unverified.

Never infer physical stop success from the stored enum alone.

Do not downgrade the state during a verification failure.

C. Strengthen asynchronous safety evidence

Identify the actual await/interleaving boundaries around alarm handling, containment reads, transitions, recover, driveOnce, and grant issuance.

Demonstrate the expected behavior when a containment transition races an already-running pass.

Distinguish source-proven bounds from assumptions and harness-only evidence.

D. Correct restoration policy

Do not automatically clear containment after an unsuccessful verification.

A return to NORMAL must be explicitly authorized, with a fresh census and a demonstrated reason for restoration.

Specify the permitted restoration path separately for DRIVE_CONTAINED and CHAIN_STOPPED.

E. Revise the gate package

Remove the containment readiness pair from S1 and place operational verification under its own gate.

S1 must not become the first test of whether the emergency containment mechanism works.

Keep the R2 diagnostic identity, one-command limit, negative-result wording, and all existing investigation holds.

F. Preserve evidence integrity

Retain all pinned identities, hashes, original battery logs, and regression assertions.

Rerun affected offline suites against the exact revised candidate.

Report failures and remaining platform-only uncertainties explicitly.

Authorization

AUTHORIZED: Offline design, implementation, testing, pinning, and revised gate paperwork.

NOT AUTHORIZED: Production deployment, containment transitions, alarm stimulation, commands, reports, SubmitJob, grant closure, hold or queue changes, containment activation, or recovery execution.

No production GO is requested or granted.

Return the corrected package for Rowan documentary review.

Next turn: Wren. Production remains INVESTIGATION HELD.
