# Rowan ruling — R5a-D readiness: REVISE; Ruling Item 1 = Option (ii) (record of relay)

> **Record note (Wren):** Relayed verbatim by Julie in the Coding Projects chat on Nov 2, 2026 (~5:00 p.m. ET). Reviewed PHASEB-R5AD-READINESS-PACKAGE.md (pin `74b7120ee7073ba2df3544a98991819a89cf0420`) and its cp. No board copy exists; this chat relay is the record. Verdict: REVISE — PRODUCTION HOLD CONTINUES. Ruling Item 1: OPTION (ii) — the first-wake consequence belongs to the S1 stimulus scope; R5a-D may not execute as an isolated code-only deployment. Options (i) and (iii) declined (app-use restrictions unreliable as sole mitigation: delayed/queued sync). Candidate definition, census structure, battery evidence, mutation limits, rollback classification, STOP conditions, adoption caveat ACCEPTED as the basis for revision. Corrections R5AD-1..R5AD-4. Next deliverable: a revised R5a-D/S1 sequencing and readiness proposal + new CP. No execution authorized.

---

ROWAN RULING — R5a-D READINESS PACKAGE

Date: 2026-11-02
Verdict: REVISE — PRODUCTION HOLD CONTINUES
Ruling Item 1: OPTION (ii)

Rowan has reviewed PHASEB-R5AD-READINESS-PACKAGE.md and its companion CP.

RULING 1 — FIRST-WAKE OWNERSHIP

Option (ii) is selected. The first-wake consequence belongs to the S1 stimulus scope.

R5a-D may not execute as an isolated code-only deployment under the current proposed GO.

Ordinary Reader position synchronization can wake the coordinator after deployment. The resulting alarm revival may initiate bounded but indefinitely recurring grant/void activity without S1’s observation and response arrangements in place.

Option (i) is declined. Informed acceptance of the consequence is insufficient without the appropriate operational controls.

Option (iii) is declined as a sole mitigation. App-use restrictions cannot reliably prevent delayed or queued synchronization.

DOCUMENTARY ASSESSMENT

The composed candidate definition, live-build comparison, battery evidence, fresh census structure, mutation limits, rollback classification, STOP conditions, and explicit runtime-adoption caveat are accepted as the basis for revision.

This is not independent byte-level certification or production execution approval.

REQUIRED CORRECTIONS

* R5AD-1: Resolve S1 readiness and R5a-D sequencing without violating the requirement that R5a-D close before C3.
* R5AD-2: Define first-wake detection, observation, classification, and authorized response.
* R5AD-3: Reconcile R5a-D, S1, C3, and separately authorized stop/restoration boundaries.
* R5AD-4: Replace the current §11 GO wording with an authorization proposal consistent with Option (ii).

Preserve the existing evidence and accepted safeguards. Identify any proposed deviations explicitly.

AUTHORIZATION

No deployment, containment transition, alarm wake, stimulus, SubmitJob, hold change, queue change, or restoration is authorized.

The preserved Phase B plan plan:19cad189fab54b9c804a74a6 and the final Chapter 3 segment, idx 26, remain protected.

Production remains INVESTIGATION HELD and ends HELD.

NEXT DELIVERABLE

Return a revised R5a-D/S1 sequencing and readiness proposal, with a new Rowan CP identifying every correction and any unresolved decisions.

Do not execute the revised plan.

Turn: Wren.
