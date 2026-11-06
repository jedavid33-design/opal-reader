# Phase B — Gate C3: CORRECTION to the branch-(d) reconciliation amendment

_Correction filed by Wren, 2026-11-05, under Rowan's ruling on the C3 branch-(d) reconciliation and generation-resume OQ-1 analysis (verdict: REVISE — C3 CONDITIONALLY ACCEPTED; EXECUTION NOT AUTHORIZED; local record `ROWAN-C3D-OQ1-RULING.md`). Documentary only: this correction authorizes nothing, requests no GO, and performs no production act. Production remains INVESTIGATION HELD; GENERATION_HALT=1; queue paused; the preserved plan and the idx-26 exemption stand untouched._

Correction pin (this document, the companion resume correction, and the companion cp ride one pin commit): `<PACKAGE-PIN>` — repo `jedavid33-design/opal-reader`, branch `ui1-review`. (Pin-slot pattern, as established: a commit cannot name itself; the pinned copy carries the slot.)

---

## 0. What this correction is, and what it amends

This correction amends exactly one document: `PHASEB-C3-BRANCH-D-RECONCILIATION.md` (the branch-(d) reconciliation amendment, pin `60da50c3a6da36e42dd8e93fa67bc8673737613e`), which itself amends the operative C3 readiness package (`46112a03…` + `aba681a0…`). The operative package is **not** amended by this correction. The reconciliation remains the C3 branch-(d) specification as corrected here; where the reconciliation and this correction differ, **this correction governs**; where the ruling (`ROWAN-C3D-OQ1-RULING.md`) and either document differ, **the ruling governs**.

The ruling's C3 decisions were: **C3-1 ACCEPT** (W-4 blocker); **C3-2 PASS ON DESIGN** (stop independence, with a verification condition); **C3-3 PASS WITH CONDITIONS** (post-stop verification); **C3-4 PASS WITH CONDITIONS** (branch-(d) census); **C3-5 REVISE** (movement rule — the re-census-and-continue permission STRUCK). Its Required Revisions 1 and 2 are discharged by §1–§3 of this correction; §4 records the full disposition state. Struck and replaced passages are quoted verbatim from the pinned reconciliation so this correction is self-contained.

---

## 1. Required Revision 1 — the movement rule: re-census-and-continue STRUCK (C3-5)

### 1.1 The passage struck

Reconciliation §6, items 3 and 4, read:

> 3. **A pass in the interval is not a stop-blocker by itself — it is a re-census event.** The movement means the chain's delivery state has changed (the W-4's open future arriving, in one direction). The gate does not proceed on the census it took, because the stop's target and the churn state are census facts that just changed. It also does not classify the movement as an anomaly: a delivered pass under the holds, inside the §7.3 invariants, is the pre-classified churn behavior resuming — expected machinery, newly timed. What it invalidates is the census, not the branch.
> 4. **Re-census procedure.** On a §6 movement: STOP all further acts; preserve steps already recorded (their recorded completion stands under §R — a sent C3-1/C3-3 is never re-sent); append the movement finding, with raw reads, to the gate record; then **re-run C3-0 in full** against §5.2, with the moved values (new latest pass, new live grant position, new `armedAt`, new job revision) adopted as the candidate baseline **only if** the re-census matches the branch's *form* in every item — exactly one live grant, occurrence `granted`, reserved 12, phase frozen, containment NORMAL, holds intact. If the re-census matches in form, the gate may proceed to C3-5 against the re-censused registration **only if Julie's GO, as given, expressly covers one re-census-and-continue** (§9's wording includes that term, as a deliberate term for Rowan's review — §9.1). If the re-census does not match in form, or the GO does not carry the term, the attempt **ends** on the movement finding and returns for ruling. **At most one re-census-and-continue per attempt**; a second movement ends the attempt unconditionally.

**Items 3 and 4 are struck in full.** The re-census-and-continue permission they construct — in every form, including the conditional form gated on the GO's wording — is removed from the branch-(d) specification. Reconciliation §9.1 anticipated exactly this disposition ("If Rowan prefers the stricter form — any §6 movement ends the attempt, full stop — striking the term requires no other change"); Rowan has ruled for the stricter form, and this correction enacts the strike §9.1 contemplated.

### 1.2 The replacement — reconciliation §6 items 3 and 4, as corrected

> 3. **Any movement in the interval ENDS the attempt.** Any new drive pass, grant movement, registration change, or other disqualifying movement arising between the accepted execution census and the stop attempt — whether in-set (a delivered pass inside the §7.3 invariants, the pre-classified churn resuming) or out-of-set — **ends that attempt** at the point of detection. There is no re-census-and-continue under any wording: the executor does not re-run C3-0 against moved values, does not adopt a changed baseline, and does not proceed to the stop act on a census the movement has superseded. Steps already recorded before the detection stand as recorded (their recorded completion stands under §R — a sent C3-1/C3-3 is never re-sent); no further act follows them.
> 4. **Preservation and return.** On a §6 movement the executor preserves the evidence — the movement finding with its raw reads, the accepted census it supersedes, and every step recorded before detection — appends it to the gate record, and the matter **returns for review**. A new attempt requires **a new Rowan ruling and Julie's separate new GO**; an existing GO is consumed by the ended attempt and **must not be adapted to a changed baseline** by the executor, by implication, or by the movement's in-set character. An in-set movement is not an anomaly and is not classified as one — but its in-set character changes nothing about the consequence: the attempt is over.

Reconciliation §6 items 1, 2, and 5 stand unamended: item 1 defines the interval and the bit-identical expectation; item 2 enumerates the detecting movements and surfaces (its consequence clause — "STOPS the gate before the stop act (or, if detected at the C3-5 observe step or a read-back, before any further act)" — is now read with corrected items 3–4: the stop it names is the **end of the attempt**, not a pause before re-census); item 5's boundary stands (an out-of-set movement is additionally a §7 STOP-and-escalate under the operative package — corrected items 3–4 govern the attempt's end in both cases).

**Cross-references conformed.** Every other passage in the reconciliation that routes movement "under §6" or "as §6 states" — §4.3 (the D-PF2 row), §5.1, §5.2 (the §4.0 item-8 note and rows D-1, D-4), §5.3, §7 (A-9, A-10) — is read against §6 **as corrected**: movement after an accepted census ends the attempt and returns for review; movement found **at** the census itself remains a census failure under §5.2 / §4.3 (D-PF2, D-PF4, or operative §7 condition 1, as the class fits), which likewise ends the attempt before any act. No passage survives that permits proceeding on moved values.

### 1.3 The branch-(d) GO wording, corrected (reconciliation §9)

Reconciliation §9's GO wording contained this clause:

> "…if any drive pass, grant change, or armedAt change occurs between the census and the stop act, STOP, re-census once in full, and continue to the stop act only if the re-census matches the branch-(d) form in every item — a second such movement, or any out-of-set movement, ends the attempt;…"

That clause is struck. The corrected GO wording, in full — the changes from the pinned §9 text are exactly three: the struck clause is replaced (shown in its place), the amendment reference gains "as corrected at `<PACKAGE-PIN>`", and the disposition basis gains "and her ruling on the reconciliation (C3-1–C3-5)"; nothing else differs:

> "GO — execute exactly one Gate C3 attempt as pinned at `46112a03…` + `aba681a0…`, as amended for branch (d) at `60da50c3a6da36e42dd8e93fa67bc8673737613e` and as corrected at `<PACKAGE-PIN>`, **in branch (d) REVIVED-UNSTOPPED (POST-WINDOW) as dispositioned by Rowan's 2026-11-05 ruling (R1–R3) and her ruling on the reconciliation (C3-1–C3-5)**: preflight census on the operative core plus the amendment's branch-(d) delta (tail-log baselines, latest completed tail check less than 48 hours old, the standing past-due registration `armedAt` 1793826389431 as the adopted pre-stop value); the contain_drive + reasoned clear mechanics pair (contain_drive in its sent form — containment stands NORMAL); exactly one stop_chain act against the then-current registration (with verify_chain_stop retries only within the design's attempts bound of 3 if the stop is unverified); if any drive pass, grant movement, registration change, or other disqualifying movement occurs between the accepted census and the stop attempt, the attempt ENDS on that movement — evidence preserved, no re-census, no continuation under this GO, and no adaptation of this GO to a changed baseline; a further attempt requires a new ruling and a new GO; passive read-backs only, NO command, NO wake provocation, NO stimulus of any kind, ending HELD in CHAIN_STOPPED. I understand C3's verification is PARTIAL and its verdict cannot exceed PARTIAL, that the W-4 stands accepted as an observation and NOT resolved (root cause unconfirmed), that C3 does not restore NORMAL, that the return to NORMAL needs its own separate standalone authorization with a fresh census, a recorded reason, and a historical audit review, and that a deleted registration cannot be restored by this gate."

The wording is **not requested by this correction** and remains inoperative until Rowan accepts this correction **and** Julie's GO in this wording is recorded on the board before the execution census (reconciliation §1, leg 4; ruling R3's ordering, carried).

### 1.4 §9.1 conformed

Reconciliation §9.1's first bullet (the re-census-and-continue term, flagged there for Rowan's express ruling) is **struck as a live term** and replaced by this record: *the term was proposed, Rowan struck it (C3-5), and the stricter form — any §6 movement ends the attempt — governs; §9.1's own contingency note ("striking the term requires no other change") is the authority that no other §9 text depends on it.* §9.1's second bullet (the adopted registration value stated in the GO text) stands unamended.

---

## 2. Required Revision 2 (first part) — the stop outcome is established by its verification reads (C3-2 condition)

C3-2 passed stop independence **on design**, with the ruling's condition in terms: "The stop operation's outcome must nevertheless be established by its actual verification reads, not inferred from the stored registration."

The reconciliation already keys its claims to the act's reads at two points — §3 step 4 ("The stop is claimed **verified only if this read returns null**… A non-null read-back, or a throwing read, records the stop **unverified**") and §4.1 ("`stopArmedBefore` = **the C3-5 observe-step value**… whatever the observe step reads is what is recorded, per the ledger"). To remove any reading under which a census value, a tail-adopted value, or the stored registration could stand in for the act's own evidence, the following sentence is **added** to reconciliation §4.1, immediately after the `stopArmedBefore` bullet, and governs §3, §4, and §5 wherever they touch the stop's outcome:

> **Reads, not inference.** The stop's outcome — verified or unverified, and every field of the stop record — is established **only** by the stop act's actual verification reads: the C3-5 observe-step `getAlarm()` read, the post-delete read-back, and the per-surface closing reads (§4.2). The stored registration, the census's adopted value (1793826389431), and the tail baseline are **expectations the reads are checked against, never evidence about the stop**. A stop whose read-back was not obtained, or whose reads disagree across surfaces, is unverified or a §7 STOP respectively, whatever the stored registration showed before the act.

No other §3/§4 wording changes: the demonstration of independence (§3) and the verification protocol with its bound (§4.2) stand as Rowan passed them, at the strength this added sentence makes explicit.

---

## 3. Required Revision 2 (second part) — post-stop verification strength and the census rule (C3-3, C3-4 conditions)

### 3.1 C3-3 — what a null readback establishes; failure classifications retained

The ruling accepts "the explicit CHAIN_STOPPED verification, null alarm readback, audit accounting, and bounded verification attempts," on the stated conditions: "A null readback establishes the observed registration state, not a guarantee about future platform behavior. Any missing, inconsistent, or failed verification must retain its designated failure classification."

Reconciliation §7 (A-2) already bounds the read-back to "this registration at that moment." The following sentence is **added** to reconciliation §4.1, after the `getAlarm()` read-back bullet, so the condition stands in the verification section itself and not only in the assumptions register:

> A null read-back establishes the **observed registration state at the moment of the read** — that no registration stood when the platform was asked — and nothing further. It is **not a guarantee about future platform behavior**: it does not establish that no registration can appear later, that the platform's treatment of this registration generalizes, or that delivery behavior has changed in either direction (register R-12 stands).

And the following affirmation is **added** to reconciliation §4.2, governing §4.3 and the ledger together:

> **Failure classifications are retained, never re-described.** Every missing, inconsistent, or failed verification in this gate keeps its designated classification: a census premise failure keeps its D-PF class (§4.3 — D-PF1 STATE-SHORTFALL, D-PF2 REGISTRATION-OBSERVATION, D-PF3 HISTORY-NONEMPTY, D-PF4 DISPOSITION-DISAGREEMENT); an unverified stop keeps the stop record's `unverified` entry and, at the bound, the episode's EXHAUSTED state (§4.2); a cross-surface disagreement is a §7 STOP. No classification is softened, merged, or carried as a lesser finding in the execution record because the gate otherwise proceeded or because a later read agreed.

§4.2's protocol (observe → delete → read-back; `verify_chain_stop` within `MAX_STOP_VERIFY_ATTEMPTS = 3`, the `stop_chain` act counting as attempt 1; EXHAUSTED ends the gate STOPPED-unverified with R3-V the only path onward) and §4.3's D-PF table stand **unchanged** — this section affirms them at the ruling's strength; it alters no bound, no class, and no route.

### 3.2 C3-4 — the 48-hour rule is a maximum evidence age; the fresh census is not skippable; any deviation is a STOP

The ruling accepts "the post-window branch form, successor-grant accounting, and tail-log baseline approach," on the stated conditions: "The 48-hour freshness rule is a maximum evidence age, not permission to skip the fresh execution census. Any deviation from the enumerated branch expectations requires STOP."

Reconciliation §5.1 already states both halves in substance ("the latest completed tail check must be **less than 48 hours old at C3-0**" and "**The execution census itself is fresh at gate time and supreme**… tail-adopted values are expectations the census must match, never facts the census inherits"). The following sentence is **added** to §5.1, after the freshness bullet, to fix the rule's character at the ruling's wording:

> The 48-hour figure is a **maximum evidence age for the tail baseline and nothing else**: it qualifies how old the baseline expectations may be when the gate opens; it does not qualify, shorten, substitute for, or excuse the **fresh execution census**, which is taken in full at gate time in every case (operative §0 supremacy). A tail check inside 48 hours with no fresh census is not a gate that may open; a fresh census is required even if the tail check completed minutes earlier.

And §5.2's hardness is affirmed in the ruling's terms, with no change to any row: **any deviation from the enumerated branch expectations (§4.0 core as carried, and rows D-1…D-6) — in value, in form, or across paired surfaces — requires STOP** before any act, classified under §4.3 where a class fits and under operative §7 otherwise. The successor-grant accounting Rowan accepted stands as written in D-1/D-3 (exactly one live grant, the tail-adopted sequential successor; accrual is movement, now governed by §6 as corrected in §1 of this correction).

---

## 4. Disposition state of the corrected package (C3-1 – C3-5)

| Ruling item | Disposition | State after this correction |
|---|---|---|
| **C3-1** — W-4 blocker | **ACCEPT** | "The prior W-4 disposition is sufficient to establish branch-(d) eligibility, subject to this amendment's corrections and a fresh execution census. The W-4 remains unresolved as a delivery failure. Its root cause is not established." Branch-(d) eligibility is therefore established **subject to** (i) this correction — Rowan's acceptance of it completes the corrections condition — and (ii) the fresh execution census at gate time. The reconciliation §2 posture is conformed accordingly: the blocker stands **DISCHARGED at disposition strength on Rowan's acceptance of this correction** — eligibility established, the W-4 itself unresolved, exactly as C3-1 states. Until that acceptance, §2's ADDRESSED-ARGUED, NOT DISCHARGED label stands. |
| **C3-2** — Stop independence | **PASS ON DESIGN** | The `stop_chain` procedure requires no further alarm delivery. Its condition — outcome established by actual verification reads, never inferred from the stored registration — is carried expressly at §2 of this correction, added to reconciliation §4.1. |
| **C3-3** — Post-stop verification | **PASS WITH CONDITIONS** | CHAIN_STOPPED verification, null readback, audit accounting, and the 3-attempt bound accepted. Its conditions — the readback's bounded meaning; failure classifications retained — are carried expressly at §3.1 of this correction, added to reconciliation §4.1/§4.2. |
| **C3-4** — Branch-(d) census | **PASS WITH CONDITIONS** | Post-window branch form, successor-grant accounting, and tail-log baselines accepted. Its conditions — 48 hours as maximum evidence age only, fresh census unskippable, any deviation = STOP — are carried expressly at §3.2 of this correction, added to reconciliation §5.1 and affirmed over §5.2. |
| **C3-5** — Movement rule | **REVISE** | The one-time re-census-and-continue permission is **struck in full** at §1 of this correction; §6 and the §9 GO wording stand as replaced there. This item closes only on Rowan's acceptance of the strike as enacted. |

**What remains before a C3 GO may be requested — stated explicitly:** exactly one documentary act: **Rowan's acceptance of this correction.** The ruling's authorization boundary stands untouched in the meantime — no C3 execution, no containment transition, no restoration, no wake, no hold lift, no deployment is authorized by the ruling, by the reconciliation, or by this correction. After Rowan's acceptance, the remaining steps are execution-side and unchanged: Julie's separate GO in the corrected §9 wording (requested only then), and the fresh execution census at gate time, supreme over every value quoted anywhere.

---

## 5. What this correction does not do

It changes nothing in the operative C3 package; nothing in the reconciliation beyond §§1–3 above (the §6/§9 strike and replacement, the three added sentences, the §9.1 conforming record); no ledger row, budget figure, bound, branch expectation, or exclusion (reconciliation §8 stands in full — the verdict remains PARTIAL in every branch, restoration and the resume gate remain separately gated, the tail watch continues under its existing ownership and exit conditions). It performs and requests no production act.

**Contents of this filing:** this correction (`PHASEB-C3-BRANCH-D-CORRECTION.md`) + the companion resume correction (`PHASEB-GENERATION-RESUME-CORRECTION.md`) + the companion cp (`PHASEB-CORRECTIONS2-ROWAN-CP.md`), under one pin (`<PACKAGE-PIN>`), with verbatim sequential parts for any document exceeding ~30 KB (exact-concat verified).

**Turn: Rowan's** — acceptance of this correction is the act that completes C3-1's corrections condition and opens the way to requesting Julie's GO.

— Wren
