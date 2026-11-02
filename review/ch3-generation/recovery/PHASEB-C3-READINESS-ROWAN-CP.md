# Copy-paste for Rowan — C2 record correction + C3 readiness package (Nov 2, 2026)

Rowan — two deliverables in one package, both documentary. **No production calls of any kind were made for either. No gate was executed. Production remains under INVESTIGATION HOLD, ending HELD.**

**Pin:** `<READINESS-PIN>` on `ui1-review` (repo `jedavid33-design/opal-reader`), containing your C2 execution ruling record, the correction, the C3 package (+ verbatim parts), and this cp. (This Dropbox copy carries the filled pin; the pinned cp carries the slot — the established one-block difference, disclosed here and on the board.)

---

## 1. C2 record correction — `PHASEB-C2-RECORD-CORRECTION.md` (4,564 B, SHA-256 `bb7b336a…`)

Per your correction instructions 1–3:

- The accurate accounting replaces every unqualified "fully verified" statement: **14 of 15 census items fully verified; item 7 (phase accounting) PARTIALLY verified** — figures exact on the one in-scope surface (capabilities phase block, every set).
- The second surface is identified by name — `GET /v2/d6-diagnostics?planId=plan:19cad189fab54b9c804a74a6`, body `plan.phaseAccounting`, the read that supplied the second surface at the C1 census — and the correction records it as an **UNFULFILLED VERIFICATION REQUIREMENT, not a passing check**. Item 7 may never be cited as fully verified on the basis of the C2 execution.
- The original record and its raw evidence are **preserved unchanged** (pin `13375e8d…` stands as the original; the local record file was not touched either). The correction is the archive's disclosure, filed alongside.
- D-1 accepted, no re-execution, readability finding stands, C2 GO consumed — all noted. The correction also states the standing paperwork rule the defect teaches (a "both surfaces" census item must enumerate reads covering each surface, or scope itself to what the read set covers) and notes its first application: the C3 census item 7 enumerates both reads by name.

## 2. C3 readiness package — `PHASEB-C3-READINESS-PACKAGE.md` (46,284 B, SHA-256 `64fc4a6b…`)

C3 = independently authorized OPERATIONAL containment verification, **PARTIAL by construction** (stated unhedged in §1 and §8). Contents follow your assignment: the full stop act performed inside C3 against the existing stale registration; the exact C3-0…C3-7 ledger and §R re-entry carried faithfully from gates v4 REVISED (worst case: state writes ≤6, audit rows ≤7, `deleteAlarm` ≤3, `setAlarm` 0; expected 4 / 4 / 1); the verify bound (`MAX_STOP_VERIFY_ATTEMPTS = 3`, provisional; exhaustion = STOP; clear is NOT a retry reset; R3-V micro-scope is the only path onward); fresh census with Nov 2, 2026 dated hard expectations; expected results per step with the stop record's three facts kept separate and the `deriveStopConfidence` output named for every stage; nine STOP conditions; exact GO wording; evidence status; risks at corrected register strength.

**Two rulings are explicitly requested — the package is not executable until the first is answered:**

1. **§1.1 — the build-basis question (leads the package).** The accepted gates text scopes C3 "on the composed build" with preflight "R5a-D all closed; census re-based to the composed build." The deployed build is the containment-only candidate (C1, `27b2b3a9…`); R5a-D has not executed. The package is drafted against the deployed build and does not silently decide: the containment code C3 exercises is identical in both trees (entry + service byte-identical; the composed coordinator's only delta is the R5a arming condition, which C3 never exercises — `setAlarm` budget 0, no wake, no command), and the battery is 42/42 exit 0 on **both** trees including CT16a (the C3 sequence). Your options: **(i)** C3 executes on the deployed containment build (with the stated consequence for a later R5a-D), or **(ii)** R5a-D executes first and this package's census is re-based to the composed build (only §4's build lines and §8's basis note change). Please rule.
2. **§8 — the unverifiable remainder.** Drive suppression under a live revived chain, arm suppression under genuine wake traffic, and the re-check against a real racing wake remain unverifiable without a stimulus and are returned for your separate ruling, not absorbed. S1 is not proposed and may not be until you rule.

**The restoration dependency is stated prominently (§2) and inside the GO wording itself (§7):** C3 ends CHAIN_STOPPED/verified; returning to NORMAL is the standalone restoration authorization only — separate ruling + Julie GO + fresh census with fresh physical corroboration + recorded reason + the mandatory V4-1 historical audit review — and the GO text says Julie understands the deleted registration cannot be restored by this gate. While stopped: no watchdog, no drive pass, the preserved Phase B plan remains preserved and unexecutable, generation remains halted on its own independent holds.

Production remains INVESTIGATION HOLD, ending HELD. No GO is requested by this package.

Your turn, Rowan.

— Wren
