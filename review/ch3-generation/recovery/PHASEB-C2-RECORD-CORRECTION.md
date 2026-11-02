# Phase B — Gate C2 EXECUTION RECORD CORRECTION (D-2 documentary exception)

**What this document is:** the permanent archive's disclosure and correction of one accounting statement in the C2 execution record, required by Rowan's C2 execution ruling (PASS WITH QUALIFICATION — C2 READABILITY VERIFIED; relayed by Julie Nov 2, 2026; verbatim record `ROWAN-C2-EXECUTION-RULING.md`). **The original execution record is NOT edited by this correction** — it stands exactly as pinned (pin `13375e8d8c3d6d5ff26be84d99b878fc22adfa12` on `ui1-review`, repo `jedavid33-design/opal-reader`), and its raw evidence (`c2-gate-execution/evidence/`, 81 files; manifest SHA-256 `58ab27f6bd5165f7f65827f879ea39565dd38f511b9182fe5b0c29fc85965682`) is preserved unchanged. This correction sits alongside the record in the archive and governs how the record may be cited.

## The correction, plainly

Wherever the C2 execution record or its summaries state or imply that all 15 census items were **"fully verified"** (e.g., the record's outcome line "all three capture sets matched every hard expectation exactly" and its §2 header accounting), the accurate accounting is:

- **14 of 15 census items: FULLY VERIFIED** — exact at all three capture sets.
- **Item 7 (phase accounting): PARTIALLY VERIFIED.** The figures (settled **1,029,420**; estimatedUnverified **19,018**; reservedUnverified **5,648**; inFlightUpper **0**; unknownOpen **0**; remaining **12,464,932** of 13,500,000) were verified **exactly** on the one in-scope surface that carries them — the capabilities phase block (read R-7) — at every set, and a full-body scan of every captured body in each set confirmed no other phase-accounting figures existed in scope to differ.

## The unfulfilled requirement (recorded as unfulfilled, not as a pass)

The approved C2 census (PHASEB-C2-READINESS-PACKAGE.md §4, item 7) required phase accounting **on both surfaces**. The second surface exists and is identified: the plan-diagnostics read `GET /v2/d6-diagnostics?planId=plan:19cad189fab54b9c804a74a6`, whose body carries the figures at `plan.phaseAccounting` — the read that supplied the second surface at the C1 census (C1 evidence `diag-pb-*`). That read was **deliberately not enumerated** in C2's read set (the C2 readiness package's R-3 description incorrectly implied the `drive=1` body carried the second surface; it does not — its key set contains no phase-accounting block, verified in the C2 raw evidence).

Accordingly, per Rowan's correction instruction 2: **the second-surface phase-accounting verification is recorded as an UNFULFILLED VERIFICATION REQUIREMENT. It is not a passing check, and item 7 must never be cited as fully verified on the basis of the C2 execution.** The exact figures on the captured surface do not establish the required second-surface verification (Rowan's ruling, D-2).

## What does NOT change

- **The C2 readability finding stands.** Rowan: "No production re-execution is required to accept the containment-readability finding." The containment-specific objective passed on its own evidence (both containment surfaces, three sets, matching NORMAL/absent projections); item 7 is a preservation figure, not part of the readability claim.
- **D-1 (the 33-second set-timing offset) is ACCEPTED** by the ruling; no correction applies to it.
- **C2's GO is consumed.** No further production activity is authorized by the ruling or by this correction. Production remains under INVESTIGATION HOLD, ending HELD.
- The record's zero-mutation tally, holds, preservation checks on the other 14 items, and ends-HELD certification are accepted by the ruling "within the captured evidence" and are unaffected by this correction.

## Standing paperwork rule (the lesson, carried forward)

**A census item that names "both surfaces" (or any set of surfaces) must enumerate, in the gate's read set, a read that actually covers each named surface — or the item must be scoped, in its own text, to exactly what the read set covers.** A "both surfaces" item whose read set covers one surface is a defective census item even when every captured figure is exact: the defect surfaces only at accounting time, which is too late. This rule is applied for the first time in the C3 readiness package filed alongside this correction: its census item 7 enumerates the capabilities read **and** the plan-diagnostics read (`planId=` form) by name.

— Wren, Nov 2, 2026 (filed with the C3 readiness package; Rowan's ruling is the authority for every statement above about her disposition)
