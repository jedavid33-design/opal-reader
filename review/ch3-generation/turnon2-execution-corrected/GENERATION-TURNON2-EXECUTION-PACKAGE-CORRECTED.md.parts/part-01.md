# GENERATION TURN-ON — SECOND ATTEMPT: FINAL EXECUTION PACKAGE (WS1) — CORRECTED

**Status: CORRECTED FILING — FILED FOR ROWAN'S FINAL DOCUMENTARY READINESS CHECK. THIS PACKAGE EXECUTES NOTHING AND PRESENTS NO GO. Julie's GO is presented only after Rowan's final readiness pass on this corrected text, under §5's rules.** It is the complete corrected text of the second-attempt execution package: the uncorrected package (pin `22c7aea70be544b409375d12d8aceca182351125`) drew Rowan's review verdict **DOCUMENTARY CORRECTION REQUIRED BEFORE FINAL READINESS PASS** (handoff `RT-H-20261107-cc21c8`), with three targeted corrections — **R1** (the WAIT extension's progress predicate), **R2** (disposition of the extension deadline), **R3** (a partial-lift contingency branch). This corrected text makes **only** those corrections, plus the filing front matter a corrected filing requires; A2–A6 and the settled OQ dispositions are not reopened, and the uncorrected text is preserved byte-unchanged at its pin. Appendix B lists every change. The package itself is the corrected execution package Rowan's proposal ruling authorized Wren to prepare: "Wren may prepare the corrected second-attempt execution package offline, incorporating these rulings, with the full census, STOP law, observation schedule, act budget, close branches and proposed Julie GO passage. Return the pinned package for Rowan's documentary readiness review. NO PRODUCTION GO. NO LIFTS. NO DEPLOY. NO WAKE ACT. NO BATCH ACT." No production read or call of any kind was taken in preparing either text; every production value below is carried from the accepted first-attempt record and stands as a design-time expectation the gate's own census re-verifies fresh.

Operative sources, in order of authority for this gate:
1. **The corrective proposal** (pin `ea0a4bc3c5ebced5549568b9a56dfbf328ca3f3b`, repo `jedavid33-design/opal-reader`, branch `ui1-review`) — the design this package executes, as corrected by the ruling below.
2. **Rowan's corrective-proposal ruling** (handoff `RT-H-20261107-1e33ea`, relayed verbatim by Julie Nov 7, 2026; recorded verbatim in `ROWAN-TURNON2-PROPOSAL-RULING.md`): **CONDITIONAL DOCUMENTARY DESIGN PASS** — the combination A-variant + Option C bounded WAIT + P-1 + advisory B + deferred D accepted; OQ-1 PASS WITH AMENDMENTS; OQ-2 CONDITIONAL PASS; OQ-3 PASS WITH TIMING CORRECTION; OQ-4 PASS; OQ-5 PASS; OQ-6 AMENDED; OQ-7 PASS WITH PRECISION; OQ-8 PASS; mandatory corrections **A1–A6**; next authorized step = this package.
3. **Rowan's review of the uncorrected package** (handoff `RT-H-20261107-cc21c8`, relayed verbatim by Julie Nov 7, 2026; recorded verbatim in `ROWAN-TURNON2-EXECUTION-PACKAGE-REVIEW.md`): **DOCUMENTARY CORRECTION REQUIRED BEFORE FINAL READINESS PASS** — the package substantially conforms to A1–A6 and preserves the required production boundaries; three targeted corrections remain (**R1** progress predicate; **R2** extension-deadline disposition; **R3** partial-lift contingency); "Do not reopen A2–A6 or the previously settled OQ questions without new evidence." This corrected text answers that review and is the text returned for the final readiness check.
4. **The executed first attempt's record** (pin `f1d78ae01694a99ebef36dc729148fe76a80f81c`) and **Rowan's execution review of it** (handoff `RT-H-20261106-e81241`; verbatim board comment `6708028182`): **DOCUMENTARY EXECUTION PASS WITH QUALIFICATIONS** — terminal SUSPENDED-BY-FAULT accepted; substantive FAILED-by-incompleteness accepted; COMPLETE excluded; fault clearance unverified; parked plan's post-close state not freshly readable; a future proposal must resolve the quota/headroom/window mismatch and establish fault-clearance prerequisites.
4. Where this package and the first-attempt package (pin `2ee79872516036e7d78fde923a8d955a5ed03492`) differ, **this package governs for the second attempt**; where this package says "carried forward," the first-attempt text is incorporated by reference at that pin, and its mechanics were proven in execution (record at `f1d78ae0…`). The first-attempt record and the corrective proposal are **preserved byte-unchanged**; this package amends neither.

## Contents at a glance

- **§0** — Pin binding and the deliberate openings in this text.
- **§1** — Identity: the live build is already the S1 build; there is **no deploy act and no probe act** in this gate; the binding clause.
- **§2** — Compliance map: how this package visibly satisfies corrections **A1–A6** and each **OQ disposition**.
- **§3** — The schedule: one gate morning, all times in Z and ET; targets expressly subordinate to predicates (A3).
- **§4** — The gate: GO of record; pre-census clearance-evidence assembly; the predicate census (**P-1…P-15** + clearance group **FC-1…FC-5**); STOP law; the gate-time census-record slot; the two lifts; the P-1 inherited-plan phase with the A6 snapshot; the smoke and its submission window; the WAIT law with A1's deterministic deadlines (formulas + worked example); classifications; the close branches and A4 authorization accounting; the partial-lift contingency (§4.13A); triggers and the emergency re-hold; the soak; the declaration; rollback and contingency.
- **§5** — The authorization text: the proposed GO passage, for presentation to Julie **only after Rowan's review of this package**, including the **OQ-6 adoption clause as an explicit adopt/strike choice**.
- **§6** — What this package is not; the counted-acts table.
- **§7** — Open items carried forward at their recorded strength.
- **Appendix A** — The execution-record template's accounting separation (inherited ledger vs smoke ledger), required by A6.
- **Appendix B** — Change list for this corrected filing: every change from the uncorrected text (pin `22c7aea7…`), by correction (R1–R3) and section.

## §0 Pin binding

**This package is filed at its own pin, recorded in its filing board summary and in the CP delivered to Julie; the Dropbox copy carries that pin filled in its header line.** As with every prior filing, a document cannot name its own pin inside its pinned text; the header slot is one of exactly three deliberate openings in this package. The other two are named now so neither can be mistaken for a gap:

1. **The gate-time census record slot (§4.5).** A reserved section the executor fills only at gate time, in the execution record — never in advance, never in this pinned text.
2. **The smoke chapter's identity (§4.9).** The smoke target is defined by rule — *the first fresh Forever Pucked chapter Julie selects at GO time* — because Julie has not chosen it yet. Her choice is recorded in the GO of record (§4.1) before the census; the census then quotes that chapter fresh (P-13). The package fixes every predicate, deadline, and accounting rule the choice feeds; it does not fix the choice.

"Governs at its pin" means: if the text at the pin differs from any summary of it — including the board summary that files it and the CP that delivers it — the pinned text governs.

**Corrected-filing note.** This corrected text supersedes the uncorrected package at pin `22c7aea70be544b409375d12d8aceca182351125` as the text under Rowan's review; the uncorrected text is preserved byte-unchanged at its pin, and its filing summary (board comment `6708243199`) stands as its record. The corrections are R1–R3 only (Appendix B): if any text here and the uncorrected filing could be read to differ beyond Appendix B's change list, Appendix B is incomplete and the discrepancy is a filing defect to be reported, not a silent amendment.

## §1 Identity and binding clause

**There is no candidate in this gate.** The S1 enforcement build is already live from the first attempt:

| Field | Value |
|---|---|
| Worker | `opalreader-api-v2-prod` |
| Live build | `ef69b8f91dad3acbed0b9c36cf3c11e238e27f72` (deployed 2026-11-07T01:25:44Z, deployment `ee7bcb14…`; the suspension close's binding flip rode deployment `f4c14000d91e4b0f92bbe7be62bbd8e8`, code untouched) |
| Live script ETag (last verified) | `d0eb6ea9b378eaed9a42a4a481d3b5738dc733c13d690463b85a1b918b4674a3` (script size 1,516,396 B; gate-1 evidence artifact `turnon-execution/deploy/etag-after.json`) |
| Current holds | `GENERATION_HALT` = `"1"`; queue `opalreader-generation-v2` (id `93b6a35fb8cf4788a91a2c90b748ae66`) delivery **paused**, sole consumer `f260f2188d80426bb0588685e9d084eb` — both re-imposed by the first attempt's suspension close and verified at 2026-11-07T04:51:14Z |
| Rollback target (this gate) | **None by deploy — there is no deploy to roll back.** Any observed change to the live build is a census STOP (§4.4), dispositioned outside this gate. The permanent floor law is restated at §4.16 for the record. |

**Binding clause.** This package is bound to the live build `ef69b8f9…` and its etag `d0eb6ea9…` as censused under P-1. If the live build at census is anything else, the pa