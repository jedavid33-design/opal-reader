# Rowan ruling — C3 rebased readiness: REVISE, one correction (C3-R1) (record of relay)

> **Record note (Wren):** Relayed verbatim by Julie in the Coding Projects chat on Nov 2, 2026 (~7:35 p.m. ET). Pin reviewed: `46112a0397bcee37af0bb65d98c8114a9d914be7`. No board copy exists; this chat relay is the record. Verdict: REVISE — ONE REQUIRED CORRECTION. The rebase to the composed build is accepted in principle; RB-1..RB-4 and RB-6..RB-11 PASS (branch-invariant census, four branches, blockers, restoration dependency, PARTIAL boundary, separate generation-resume gate all accepted as design). **C3-R1 — BRANCH (c) CONTRADICTION**: §3.4's C3-0c requires verified_current on both surfaces with STOP before any act if the premise fails, yet C3-1c permits verify_chain_stop when a surface's confidence falls short of verified_current — the instructions conflict. Preferred resolution: (1) require verified_current on both surfaces + fresh null alarm observations + complete episode history + agreement with the reviewed S1-X disposition; (2) if they hold, perform the closing READ-ONLY census — no verify_chain_stop is necessary; (3) if any fails, STOP and classify — do NOT spend the S1-X episode's remaining verification budget within C3; (4) additional verification/remediation routes through a separately reviewed and authorized path; (5) update the branch-(c) ledger, mutation budget, STOP rules, evidence claims, and branch-aware GO wording consistently. Statuses: R5a-D CLOSED; S1 OPEN; C3 READINESS NOT YET PASSED. No execution authorized. Return a focused C3-R1 correction + updated CP.

---

ROWAN RULING — C3 REBASED READINESS

Date: 2026-11-02
Pin: 46112a0397bcee37af0bb65d98c8114a9d914be7
Verdict: REVISE — ONE REQUIRED CORRECTION

The C3 rebase to the composed production build is accepted in principle.

RB-1 through RB-4 and RB-6 through RB-11: PASS.

The branch-invariant census, four eligible outcome branches, preflight blockers, restoration dependency, PARTIAL evidence boundary, and separate generation-resume gate are accepted as documentary design.

C3-R1 — BRANCH (c) CONTRADICTION

Section 3.4 C3-0c requires verified_current on both surfaces and mandates STOP before any act if that premise fails.

C3-1c nevertheless permits verify_chain_stop when a surface’s displayed confidence falls short of verified_current.

These instructions conflict.

Revise branch (c) so its entry requirements and permitted actions are mutually consistent.

Preferred resolution:

1. Require verified_current on both surfaces, fresh null alarm observations, complete episode history, and agreement with the reviewed S1-X disposition.
2. If those requirements hold, perform the closing read-only census. No verify_chain_stop is necessary.
3. If any requirement fails, STOP and classify. Do not spend the S1-X episode’s remaining verification budget within C3.
4. Route any additional verification or remediation through a separately reviewed and authorized path.
5. Update the branch-(c) ledger, mutation budget, STOP rules, evidence claims, and branch-aware GO wording consistently.

Preserve all other accepted C3 safeguards.

STATUS

R5a-D: CLOSED.

S1: OPEN, awaiting its actual observation outcome and Rowan’s disposition.

C3: READINESS REVIEW NOT YET PASSED.

Production remains INVESTIGATION HELD. No C3 execution, containment transition, restoration, generation, deployment, or hold change is authorized.

Return a focused C3-R1 correction and updated Rowan CP. No full package rewrite is required unless consistency demands it.

Turn: Wren.
