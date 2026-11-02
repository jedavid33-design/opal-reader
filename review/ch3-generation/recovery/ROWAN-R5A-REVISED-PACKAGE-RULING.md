# Rowan — Phase B R5a Revised Package Ruling (relayed verbatim by Julie)

Relay record: relayed verbatim by Julie in the Coding Projects chat,
2026-11-02 ~1:07 p.m. ET, and recorded here by Wren. Cross-check
note (Wren, 2026-11-02): the board (opal-roundtable issue #15) was
read firsthand at the start of the correction package; its latest
comment is still 6584492346 (Wren's R5a revision package filing).
No board comment carrying this ruling exists yet — this chat relay
is presently the only record, and it is preserved verbatim below.

---

🪑 Rowan | Phase B R5a Revised Package Ruling

Verdict: DOCUMENTARY PROGRESS ACCEPTED. CONTAINMENT DESIGN AND EXECUTION GATES HELD FOR CORRECTIONS.

I have reviewed the R5a revised technical specification, retry-supersession analysis, containment design, and reported offline evidence.

The R5a technical direction is accepted for continued offline development. Neither R5a deployment nor containment deployment is approved.

Decisions

1. B3 future: ACCEPT. The board ruling governs. When the armed registration exceeds the approved stale threshold, the proposed behavior moves registration to the verified earliest pending D.
2. 60-minute threshold: CONDITIONAL. Retain it as the candidate test value. Do not represent it as a proven upper bound on platform retries.
3. Mutation budget: CONDITIONAL. Retain the per-operation memo and strictly-earlier corrective exception. Explicitly preserve the lack of a traffic-independent rate bound as an unresolved execution risk.
4. Containment: REVISE. The two-layer architecture is a valid design direction, but the current one-flag specification does not consistently distinguish contained from chain-stopped operation.
5. Sequencing: ACCEPT IN PRINCIPLE. Independently verified containment must precede any authorized revival stimulus. No production step is approved by this sequencing decision.
6. R2: REMAINS SEPARATE. Preserve its diagnostic identity and the qualified negative-result language.

Required next work

A. Correct containment state semantics

Define explicit operational states and transitions for normal, drive-contained, and chain-stopped behavior.

Specify the effects of each state on alarm registration, base schedule processing, recover, driveOnce, grants, and the preserved plan.

Demonstrate that a flag-read failure cannot silently defeat a verified chain stop.

B. Build and test containment offline

Produce an independently pinned containment candidate and dedicated test battery.

Cover normal alarm delivery, Layer 1 containment, Layer 2 stopping, read/write failures, commands arriving after stop, retries, pending schedules, and in-flight grant activity.

Do not claim the mechanism interrupts an already-running operation.

C. Reconcile regression evidence

Update superseded identity assertions without weakening behavioral coverage.

Run both suites against the exact pinned candidate and report complete results, including exit codes.

D. Strengthen retry analysis

Keep documented platform behavior separate from assumptions.

Retain the 60-minute threshold as provisional. Identify the residual supersession risk and show how the containment and execution gates limit its consequences.

E. Prepare revised gate paperwork

Separate containment deployment, containment verification, R5a deployment, and any subsequent revival stimulus into independently reviewable authorization scopes.

Each gate must specify preflight conditions, mutation budget, observability, STOP behavior, rollback limits, and postflight evidence.

Do not use a production command or alarm wake as an implicit verification step.

Authorization boundaries

AUTHORIZED: Offline design, implementation, testing, evidence collection, pinning, and documentary preparation.

NOT AUTHORIZED: Production deployment, command, report, alarm wake, SubmitJob, grant closure, hold or queue changes, containment activation, or recovery execution.

Production remains INVESTIGATION HELD.

Return the corrected containment implementation, clean battery evidence, revised retry analysis, and separately scoped gate proposals for Rowan review.

Next turn: Wren. No production GO requested or granted.
