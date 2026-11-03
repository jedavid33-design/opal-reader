# Phase B — Gate C3: focused correction C3-R1 (branch (c) consistency)

**Scope of this document.** This is the single focused correction Rowan's ruling on the rebased C3 readiness package requires (ruling: REVISE — ONE REQUIRED CORRECTION, C3-R1). It amends **branch (c)** of the rebased package and nothing else. It is offline paperwork: no production calls, no execution, no GO request.

**Operative package.** On Rowan's acceptance of this correction, the operative C3 readiness package is the **rebased package, pin `46112a0397bcee37af0bb65d98c8114a9d914be7`** (repo `jedavid33-design/opal-reader`, branch `ui1-review`), **as amended by this correction**. Where any text in the rebased package conflicts with this correction on a branch-(c) matter, this correction governs; the consistency table in §4 lists every amended location with its operative replacement text. The original package text is preserved unchanged in the pin — corrections ride as amendments, as throughout this case.

**Statuses at writing (per the ruling):** R5a-D **CLOSED**. S1 **OPEN**, awaiting its actual observation outcome and Rowan's disposition. C3 readiness **NOT YET PASSED** — this correction is the outstanding item. Production remains **INVESTIGATION HELD**, ends HELD.

---

## 1. The contradiction, quoted verbatim

Rowan's C3-R1 identifies two instructions in §3.4 of the rebased package that cannot both be followed.

**C3-0c (entry census) — its failure/exit cell:**

> "The disposition's eligibility test is re-run here, from fresh reads: eligibility requires `stopConfidence` = `verified_current` on both surfaces (recorded success **and** fresh null agree). Fresh null absent, surfaces disagree, or the record differs from the window record → the branch's premise fails: STOP before any act; the state is reclassified under §4.5 (an unverified S1-X stop is **not** a C3 disposition — R3-V first, or Rowan's express disposition)"

**C3-1c (the conditional verify step):**

> "`verify_chain_stop` — **conditional**: ONLY if C3-0c's fresh reads leave either surface's displayed `stopConfidence` short of `verified_current` while the recorded outcome stands verified (e.g. a surface cannot make its fresh observation inside the census reads). Charged to the **S1-X episode**: the call is attempt *n*+1 of that episode, where *n* is its recorded `stopVerifyAttempts`; permitted only while *n* < 3"

The conflict is exact: C3-0c makes `verified_current` on both surfaces a premise whose failure stops the gate **before any act**; C3-1c then authorizes an act — a `verify_chain_stop` call, spending the S1-X episode's verification budget — for precisely the case in which that premise has failed (a surface displaying short of `verified_current`). A gate cannot both stop before any act on a failed premise and act on that same failure. Rowan's preferred resolution is applied below, point for point.

---

## 2. The resolution, applied (Rowan's five points)

### 2.1 Point 1 — branch (c) entry requirements (all four mandatory, all fresh at the execution census)

Branch (c) may open only if **all four** hold at C3-0c, from the census's own fresh reads:

- **ER-1 — `verified_current` on BOTH surfaces.** Each surface's displayed `stopConfidence` is `verified_current` (truth-table row 3 family: recorded success **and** that surface's fresh null observation agree). This is §4.3 item **C-1** as written; no change to §4.3 is needed.
- **ER-2 — fresh null alarm observations.** `getAlarm()` reads **null** on the live read of **each** surface — the containment state surface (`GET /v2/d6-containment`) and the `drive=1` diagnostics surface (`GET /v2/d6-diagnostics?drive=1`) — taken inside the C3-0c census, not carried from any earlier read. This is §4.3 items **C-1/C-2** as written.
- **ER-3 — complete episode history.** The S1-X episode's history is read from the **append-only audit table** (`d6_containment_events`) in full for that episode — every event present, in order, with no event the disposition does not account for. Per the design's standing rule (V4-1), the `prevEpisode*` summary is **not** this history and cannot substitute for it: it holds exactly one closed episode and is overwritten by later clears, so summary-only disclosure is incomplete on its face. This is §4.3 item **C-4** as written; for branch (c) it is complete by construction, because the branch's world contains exactly this one episode — a second episode, a `clear` after the stop, or a missing event is not a gap to note but a **premise failure** (§2.3, C-PF3).
- **ER-4 — agreement with the reviewed S1-X disposition.** The fresh stop record, the episode history, and the frozen churn state agree with the **window record as reviewed in Rowan's S1 disposition ruling** — the disposition whose STOPPED-BY-S1X-VERIFIED form selected this branch (§4.3 item **C-5** and the §4 branch-selection act). The disposition is cited, not re-litigated; any disagreement is a premise failure (§2.3, C-PF4), not a question the executor settles.

### 2.2 Point 2 — if all four hold: the closing READ-ONLY census, and nothing else

With ER-1…ER-4 satisfied at C3-0c, branch (c) performs exactly one further act: **C3-2c, the closing census repeat** (§4 core + §4.3 delta, with the both-surface stop-record read-back). **No `verify_chain_stop` is performed, and none is necessary** — the premise the verify call existed to repair (a surface short of `verified_current`) is excluded by ER-1/ER-2 at entry, and a confirmation call against an already-`verified_current` display would purchase nothing the census's own fresh null observations do not already establish, at the price of the S1-X episode's budget.

Consequences, stated as amendments (operative text in §4):

- **Step C3-1c is REMOVED.** The branch-(c) ledger is C3-0c → C3-2c. The numbering gap is deliberate: C3-0c and C3-2c keep their names so no cross-reference in the package or the record shifts.
- **The branch-(c) mutation budget is ZERO in all cases** — state writes **0**, audit rows **0**, `deleteAlarm` **0**, `setAlarm` **0**. There is no worst case above zero: every failure in this branch is a STOP **before any act** (§2.3), so no path through branch (c) writes anything. Branch (c) is a read-only gate unconditionally, not only on its no-failure path.
- Branch (c) mints no episode, performs no transition, and its closing state is bit-identical to its opening state.

### 2.3 Point 3 — if any requirement fails: STOP and classify; the episode budget is never spent

Any failure of ER-1…ER-4 at C3-0c — or a fresh-read contradiction arising at C3-2c — stops the gate **before any act**. The finding is classified under exactly one named class, recorded in the gate record with its raw reads, and reported. No class is acted on inside C3.

| Class | Trigger | Recorded as |
|---|---|---|
| **C-PF1 — CONFIDENCE-SHORTFALL** | Either surface's `stopConfidence` at C3-0c is anything other than `verified_current` (including `unverified`, `contested`, `unknown`, or an unreadable/underivable display) | the per-surface derived values and the read shapes that produced them |
| **C-PF2 — NON-NULL-ALARM** | A fresh `getAlarm()` observation on either surface returns a registration | the observed value(s), per surface, with timestamps — a surviving or re-appeared registration against a verified record is the R-02/R-15 evidence class and is reported at that strength |
| **C-PF3 — INCOMPLETE-HISTORY** | The append-only episode history is incomplete, unreadable, or contains an event the reviewed disposition does not account for (missing event, second episode, `clear` after the stop) | which completeness check failed and what the history actually shows |
| **C-PF4 — DISPOSITION-DISAGREEMENT** | The fresh record/state disagrees with the reviewed S1-X disposition in any other respect (stop-record fields differ from the window record; the frozen churn state differs beyond the tail log's recorded checks; the C-5 binding facts do not hold) | the field-by-field disagreement |

**The budget rule, without exception:** C3 does **not** spend the S1-X episode's remaining verification budget — not on a premise failure, not on a closing-census contradiction, not as a "confirmation." Every provision in the rebased package that charged a branch-(c) `verify_chain_stop` call to that episode, or permitted one, is **removed** (§3 of this correction lists them; §4 gives the replacement texts). The episode's recorded attempt count at C3 is a **census fact to be read** (ER-3/ER-4 evidence), never a resource C3 draws on.

### 2.4 Point 4 — the onward path after a premise failure

A premise failure means the live state **no longer matches the reviewed S1-X disposition** on which branch (c) was selected. Branch (c)'s dependency leg (§0 leg 2) is therefore not met on that evidence, and no branch re-selection happens by executor choice (§4's standing rule). Verification or remediation of the mismatched state routes **only** through a separately reviewed and authorized path:

- **A fresh Rowan ruling + fresh Julie authorization**, whose scope that ruling sets. The classified finding (C-PF1…C-PF4, with raw reads) is the ruling's input.
- **R3-V is the named candidate where — and only where — the failure establishes the episode exhausted or its stop unverified** (the §4.5 STOPPED-BY-S1X-EXHAUSTED/UNVERIFIED blocker, whose law is unchanged). A premise failure does not by itself establish exhaustion: a C-PF2 registration, for example, is a physical-truth contradiction whose remedy Rowan's ruling determines; this correction invents no mechanism for it and pre-authorizes none.

### 2.5 Point 5 — consistency

§4 of this correction updates every branch-(c) location Rowan named — ledger, mutation budget, STOP rules, evidence claims, branch-aware GO wording — plus each further location the sweep found carrying the removed provision. Each entry gives the amended location, the text it replaces (quoted or identified), and the operative replacement.

---

## 3. The removal, stated explicitly

Removed from the rebased package, in substance (operative replacement texts in §4):

1. **Step C3-1c itself** — the conditional `verify_chain_stop` (§3.4).
2. **The episode-charging rule for branch (c)** — every statement that a C3 call in branch (c) is an attempt of the S1-X episode counting against its bound of 3 (rebase banner RB-5; §3.2's episode-continuity paragraph **as applied to branch-(c) calls inside C3**; §1's branch-(c) summary; §5.2's expected-results row; §6's GO wording; §7 condition 5's branch-(c) clause).
3. **The branch-(c) non-zero budget** — writes ≤1 / audit ≤1 / `deleteAlarm` ≤1 (§3.4 totals; §5.2).
4. **The branch-(c) closing-delta allowance** — "except for any C3-1c record" (§3.4; §5.2).
5. **The premise-failure workaround in §7 condition 10** — the parenthetical that recorded the verify call's outcome and continued; replaced by the C-PF classification (§4, item 9).

**Not removed, and not touched:** `MAX_STOP_VERIFY_ATTEMPTS = 3`, the exhaustion law, and the R3-V micro-scope (§3.2) **for the stop-act branches** — C3-5/C3-6 in branches (a)/(b)/(d) still mint and spend their own episode exactly as written. The bound still attaches to the S1-X **episode as a record fact** (its count is read at census and preserved in the audit history every later authorization reads); what is removed is only C3 branch (c)'s *use* of that episode's budget. The §4.5 blocker row for STOPPED-BY-S1X-EXHAUSTED/UNVERIFIED is likewise unchanged.

---

## 4. Consistency table — every amended location, with operative replacement text

**Item 1 — Rebase banner, RB-5 row (§"REBASE BANNER", table).**
*Replaces:* the sentences "Branch (c)'s ledger is a verification-only ledger (§3.4). Any `verify_chain_stop` call C3 makes in branch (c) is an attempt **of the S1-X episode** — the episode S1-X's `stop_chain` minted — and counts against that episode's bound of 3; C3 mints no episode in branch (c)" and the row's closing "…the verify-confirmation path only, under the episode-continuity rule stated".
*Operative replacement:* "Branch (c)'s ledger is a **read-only** ledger (§3.4, as corrected by C3-R1): entry census and closing census, no calls. C3 makes **no** `verify_chain_stop` call in branch (c) and spends nothing against the S1-X episode's bound of 3; that episode's recorded attempt count is a census fact, read and preserved, never drawn on. C3 mints no episode in branch (c)." — and the closing phrase becomes: "This package defines which legs remain meaningful: none of the transitions, and — per C3-R1 — no verify call either; fresh-read corroboration only."

**Item 2 — §1, branch (c) summary paragraph.**
*Replaces:* "a `verify_chain_stop` confirmation **only if** the fresh reads leave the display short of `verified_current` — charged to the **S1-X episode's** attempt bound — and a closing census."
*Operative replacement:* "a closing census. If the entry census's fresh reads leave either surface's display short of `verified_current` — or fail any other entry requirement (§3.4 as corrected: ER-1…ER-4) — the branch does not proceed: STOP and classify (C-PF1…C-PF4); no `verify_chain_stop` is called and the S1-X episode's attempt bound is never spent inside C3."

**Item 3 — §3.2, "Episode continuity (branch (c))" paragraph.**
*Replaces:* "**Episode continuity (branch (c)):** the bound attaches to the EPISODE, not to the gate — attempts S1-X consumed against its episode inside the window are attempts of that episode at C3; C3 neither resets nor supplements the count (§3.4)."
*Operative replacement:* "**The S1-X episode at C3 (branch (c)):** the bound attaches to the EPISODE, not to the gate — attempts S1-X consumed against its episode inside the window stand as that episode's recorded count at C3, and C3 neither resets nor supplements it. As corrected by C3-R1, branch (c) makes **no call against that episode at all**: the count is census evidence (ER-3/ER-4), and any further verification of the episode routes through a separately reviewed and authorized path (§4.5's blocker law; C3-R1 §2.4). In the stop-act branches the episode C3 spends is the one C3-5 mints; the S1-X episode is never it."
*Flag (sentence spanning scopes):* the original sentence also underwrites §4.5/RS-5 reasoning (C3 cannot borrow a spent budget). The replacement preserves that ground — C3 cannot mint, reset, **or borrow** — while removing the branch-(c) use; the §4.5 blocker row itself is unchanged.

**Item 4 — §3.4, the ledger table.**
(a) *Row C3-1c:* **REMOVED in full.** The ledger is C3-0c → C3-2c (numbering gap deliberate, §2.2).
(b) *Row C3-0c, failure/exit cell — replaces its final clause* ("the state is reclassified under §4.5 (an unverified S1-X stop is **not** a C3 disposition — R3-V first, or Rowan's express disposition)"): "the state is classified under the C3-R1 premise-failure classes (C-PF1 CONFIDENCE-SHORTFALL / C-PF2 NON-NULL-ALARM / C-PF3 INCOMPLETE-HISTORY / C-PF4 DISPOSITION-DISAGREEMENT), the gate ends unopened, and the finding returns for a fresh Rowan ruling + fresh Julie authorization (C3-R1 §2.4). §4.5's STOPPED-BY-S1X-EXHAUSTED/UNVERIFIED blocker and its R3-V-first law govern where the failure establishes the episode exhausted or unverified; a premise failure alone does not establish that, and no other branch is selected by executor choice."
(c) *Row C3-2c, failure/exit cell — replaces* "Any delta beyond this ledger's own = STOP and classify": "Any delta from C3-0c = STOP and classify under the C-PF classes (§3.4 as corrected); the ledger has no writes, so every delta is by definition outside it."

**Item 5 — §3.4, budget totals paragraph.**
*Replaces the paragraph in full.*
*Operative replacement:* "**Branch (c) budget totals (all cases):** state writes **0**, audit rows **0**, `deleteAlarm` **0**, `setAlarm` **0** — as corrected by C3-R1, branch (c) is a **read-only gate unconditionally**: entry census (C3-0c) and closing census (C3-2c), and every failure is a STOP before any act, so no path through the branch writes anything. It mints no episode, performs no transition, spends nothing against the S1-X episode's bound, and its closing state is bit-identical to its opening state. Its verdict is PARTIAL (§8 states the corrected, narrowed claim)."

**Item 6 — §5.2, branch (c) expected-results table.**
(a) *Row "C3-1c verify (only if required)":* **REMOVED in full.**
(b) *Row C3-2c, expected projection — replaces* "identical to C3-0c except any C3-1c record": "identical to C3-0c in every field (the branch writes nothing; any delta is a premise failure, §7 condition 10 as corrected)".
(The following preservation paragraph's check "against the executing branch's budget (§3.1 or §3.4)" stands — §3.4's budget is now zero, which is what the check enforces.)

**Item 7 — §6, GO wording (branch-(c) clause).**
*Replaces:* "in the STOPPED-BY-S1X-VERIFIED branch, verification of the existing S1-X stop record against fresh reads only, with any verify_chain_stop charged to the S1-X episode's bound;"
*Operative replacement:* "in the STOPPED-BY-S1X-VERIFIED branch, read-only corroboration of the existing S1-X stop record against fresh reads only — entry and closing censuses, with NO verify_chain_stop call and no containment transition of any kind in that branch (any entry-requirement failure stops the gate before any act, classified and returned for ruling);"
The remainder of the GO wording is unchanged, including its closing: "…ending HELD — in the stop-act branches in CHAIN_STOPPED, in the verification branch in the CHAIN_STOPPED state it opened in."

**Item 8 — §7, STOP condition 5.**
*Flag (sentence spanning branches):* condition 5 covers the stop-act branches and a branch-(c) clause. The branch-(c) clause is **severed**; the rest of condition 5 stands verbatim.
*Replaces:* "or (branch (c)) the S1-X episode's bound is reached inside C3-1c" — **deleted**. Condition 5 now ends at "…C3-6 attempts exhausted (§3.2): STOP; C3 ends STOPPED-unverified; the package returns for ruling. No clear, no re-stop, no further verify — R3-V or nothing." (In branch (c) there is no verify to exhaust; premise failures are condition 10's, as corrected.)

**Item 9 — §7, STOP condition 10.**
*Replaces the condition in full.*
*Operative replacement:* "10. **Branch (c) premise failure at any point** — any failure of the entry requirements (ER-1…ER-4, §3.4 as corrected): a surface short of `verified_current` (**C-PF1**), a fresh read showing a registration present (**C-PF2**), an incomplete or unaccounted episode history (**C-PF3**), or any other disagreement with the reviewed S1-X disposition (**C-PF4**): STOP before any further act and classify. No `verify_chain_stop` is called, in this branch or as a response to it; the S1-X episode's budget is never spent inside C3. The classified finding returns for a fresh Rowan ruling + fresh Julie authorization (C3-R1 §2.4); it is never absorbed as a routine success and never re-branched by executor choice."

**Item 10 — §8, harness-evidence bullet CT11a–f.**
*Replaces the bullet's final clause:* "verify on an already-verified stop is an idempotent confirmation (branch (c)'s C3-1c path)" → "verify on an already-verified stop is an idempotent confirmation (design behavior, harness-proven; **as corrected by C3-R1, no C3 step exercises it** — in the stop-act branches verify follows only an unverified C3-5, and branch (c) calls no verify at all)".

**Item 11 — §8, "Branch (c)'s narrowed claim" paragraph — the corrected evidence claim, at exact strength.**
*Replaces the paragraph's claim sentences.*
*Operative replacement:* "**Branch (c)'s claim (as corrected by C3-R1 — READ-ONLY CORROBORATION, stated at exact strength):** a branch-(c) PASS establishes that at C3's two census times, (i) both containment surfaces displayed the S1-X stop record identically, (ii) each surface's `stopConfidence` derived `verified_current` from **fresh null `getAlarm()` observations** agreeing with that record, and (iii) the complete append-only episode history agreed with the reviewed S1-X disposition. It is **not** a re-verification: C3 issues no `verify_chain_stop` call, creates no new verification event, and adds no physical evidence beyond the fresh null observations themselves — reads the census makes in any case. The physical stop's proof remains exactly what S1-X's own record plus these corroborating reads support, no more. A branch-(c) PASS is **not** evidence that C3's own stop act works live (that evidence exists only in branches (a)/(b)/(d) executions, or stands on the harness + those branches' analogy), and it does **not** discharge any part of the unverifiable remainder, which remains OPEN (Ruling 2). If Rowan requires a C3-performed stop act regardless of branch, that requirement cannot be met from a CHAIN_STOPPED opening state without a restoration first — and this package does not propose manufacturing one. (Both closing sentences of the original paragraph stand unchanged.)"

**Item 12 — §9, register R-08 (branch-(c) sentence).**
*Replaces:* "in branch (c) the S1-X episode already exists and C3's episode-continuity rule (§3.2) is the anti-circumvention discipline applied prospectively."
*Operative replacement:* "in branch (c) the S1-X episode already exists and — as corrected by C3-R1 — C3's discipline is stronger than continuity: **C3 makes no call against that episode at all**, so no C3 act can spend, reset, or borrow its budget; the episode's record is preserved intact as census evidence."

**Item 13 — §11, "Requested of Rowan" paragraph (informational).**
The paragraph's reference to "the branch-(c) verification-only ledger and episode-continuity rule (§3.4, §3.2)" is **superseded by this correction** (read-only ledger; no episode use inside C3). No operative text depends on it — it was the package's own review request; the operative request now rides in this correction's companion CP.

**Checked and NOT amended (verified consistent with the resolution):**
- **§4.3 (C-1…C-5)** — already encodes ER-1…ER-4 exactly (verified_current fresh on both surfaces, fresh null, complete episode segment, disposition agreement via C-5). It stands unchanged and, with §3.4 as corrected, is branch (c)'s complete entry gate.
- **§4.5 blocker table** — unchanged, including STOPPED-BY-S1X-EXHAUSTED/UNVERIFIED → R3-V first.
- **§2 (restoration dependency)** — its branch-(c) sentence ("the episode id, its attempt count, and its verification chain are census items, §4.3") stands: those remain census **reads**, and the branch-(c) record still makes the restoration's future audit review possible.
- **Branches (a)/(b)/(d) in full** — no text amended. The only cross-branch sentences touched are §7 condition 5 and §3.2's continuity paragraph, flagged at items 8 and 3; in both, the stop-act branches' law is preserved verbatim in substance.

---

## 5. What this correction does not change

Everything else in the rebased package stands at the strength Rowan's ruling gave it: RB-1…RB-4 and RB-6…RB-11 PASS as written; the branch-invariant census and both named phase surfaces; the four eligible branches and the §4.5 blockers; the stop-act ledger (C3-0…C3-7 + §R) and its budget in branches (a)/(b)/(d); the bound of 3 and exhaustion law for C3-minted episodes; the restoration dependency; the PARTIAL verdict in every branch; the separate generation-resume gate. **No execution, containment transition, restoration, generation, deployment, or hold change is authorized by this filing.** Production remains INVESTIGATION HELD; the S1 window runs under its own arrangements meanwhile.

---

*End of correction. Companion: `PHASEB-C3-R1-ROWAN-CP.md`.*
