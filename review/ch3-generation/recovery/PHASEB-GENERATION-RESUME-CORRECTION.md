# Phase B — GENERATION-RESUME gate: CORRECTION to the resume package and the OQ-1 analysis

_Correction filed by Wren, 2026-11-05, under Rowan's ruling on the C3 branch-(d) reconciliation and generation-resume OQ-1 analysis (verdict: REVISE — RESUME WAKE MECHANISM ACCEPTED IN PRINCIPLE; EXECUTION NOT AUTHORIZED; local record `ROWAN-C3D-OQ1-RULING.md`). Documentary only: this correction authorizes nothing, requests no GO, and performs no production act. The wake mechanism it corrects is NOT authorized for execution by the ruling or by this correction. Production remains INVESTIGATION HELD; GENERATION_HALT=1; queue paused._

Correction pin (this document, the companion C3 correction, and the companion cp ride one pin commit): `<PACKAGE-PIN>` — repo `jedavid33-design/opal-reader`, branch `ui1-review`. (Pin-slot pattern, as established: a commit cannot name itself; the pinned copy carries the slot.)

---

## 0. What this correction amends

This correction amends **two** documents, section by section, quoting every passage it strikes or replaces so the correction is self-contained:

1. `PHASEB-GENERATION-RESUME-PACKAGE.md` — the generation-resume readiness package, pin `0946f9f2fb978a46b562c738d8ac6d9d4ee977a6` ("the package"). Amended: §3 (the GR-2 ledger line and the budget totals), §4.0 item 4 and §5.3 (the non-null `armedAt` / "satisfiable trivially" text), §7 item 3 (the wake-slot failure condition), and the §9 OQ-2 entry's status (via §5 below).
2. `PHASEB-GENERATION-RESUME-OQ1-ANALYSIS.md` — the OQ-1 analysis, pin `60da50c3a6da36e42dd8e93fa67bc8673737613e` ("the analysis"). Amended: §2.4 (OQ-1(c)), §2.5 (OQ-1(d) ledger treatment), §3.1 (the R-06 cross-check), §3.2 (the observation bound), §4.1/§4.2 (failure behavior wording), §6 (the OQ-2 closure proposal).

The ruling's resume decisions were: **GR-1 ACCEPT IN PRINCIPLE** (the fresh probe mechanism); **GR-2 ACCEPT WITH QUALIFICATION** (the 15-minute bound); **GR-3 REVISE** (non-null `armedAt`); **GR-4 CONDITIONAL ACCEPTANCE** (mutation ledger); **GR-5** (OQ-2 REMAINS OPEN FOR GR-B); **GR-6 REVISE** (recorder cross-check); **GR-7 PASS WITH CONDITIONS** (failure behavior). Required Revisions 3–6 are discharged by §2–§5 of this correction; GR-2's qualification is carried at §1; GR-7's conditions at §6; GR-1 and the gate's remaining preconditions are recorded at §7. Where the ruling and either amended document differ, **the ruling governs**; where this correction and an amended document differ, **this correction governs**.

---

## 1. GR-2 — the observation bound, qualified (analysis §3.2)

The ruling: "Accept 15 minutes, with complete paired polling at least every five minutes, as the pre-lift observation and failure-decision bound. This is not proof of an upper bound on alarm delivery latency. No observed effect within the bound means STOP, preserve evidence, and leave both holds in place. No additional waiting period is required merely to extend the bound. However, the complete fresh census, restoration verification, and grant-state checks remain mandatory."

### 1.1 Analysis §3.2 — struck and replaced

Analysis §3.2's first bullet read:

> - **Probe-to-first-effect bound: 15 minutes**, polled on the P-6 + P-1 read pair at a cadence of at least one complete poll every 5 minutes (the §2.3 protocol's cadence discipline), starting at the probe's dispatch.

The bound and cadence stand — Rowan accepted both — but the bullet is replaced so the section carries the qualification in the same breath as the number:

> - **Probe-to-first-effect bound: 15 minutes**, polled on the P-6 + P-1 read pair as **complete paired polls at least every 5 minutes** (both surfaces read at every poll; a poll with a failed surface is a failed poll, not a negative observation), starting at the probe's dispatch. **The bound is a failure-decision bound, not a latency finding:** it is the interval at whose expiry the gate decides the wake has failed; it is **not proof of an upper bound on alarm delivery latency**, and no wording in this gate may present it as one — delivery slower than 15 minutes is not excluded by anything in the record; it is simply outside the interval this gate will wait before deciding. **No observed effect within the bound = STOP**: the failure behavior of §4.1 runs (evidence preserved raw, both holds left in place, no re-hold needed or performed because no hold was lifted). **No additional waiting period is required merely to extend the bound** — the executor does not append a grace interval, a confirmation wait, or a second observation window on its own authority; a longer bound would be a ruling, not an executor courtesy. **And the bound's outcome decides nothing else in the gate:** the complete fresh census (GR-0), the restoration verification (the census's containment and restoration-record reads, package §4.0 item 3), and the grant-state checks (the §2.3 protocol's P-1/P-5 surfaces) remain **mandatory in full regardless of whether the wake verifies, fails, or is not needed** — a verified wake never shortens the census, and a satisfied-by-observation state (corrected §2.4) never waives a grant-state check.

Analysis §3.2's second bullet (the justification from the evidence — the ~1.9 s precedent, the 600 s watchdog period, the 2-hour W-4 threshold) stands, with its closing sentence conformed: the bound is no longer "a proposal, not a settled constant" — **it is ruled at 15 minutes by GR-2, with the qualification above**; the sentence is replaced by: "*The bound is ruled (GR-2) at the proposed figure, as a failure-decision bound under the qualification stated in the first bullet — the figure's evidentiary basis is this bullet, and its character is the first bullet's, not a latency bound's.*"

### 1.2 Package alignment

- The package §2.3 poll discipline — "at least one complete poll every 5 minutes" during the post-unpause protocol — already matches the ruled cadence in form; the GR-2 pre-lift observation now adopts the **same paired-poll discipline by reference** (P-6 + P-1, complete pairs, ≥1 per 5 minutes), so the gate has one polling discipline on both sides of the lifts, not two.
- **Package §7 item 3 is amended.** As pinned it reads:

  > 3. **Wake-slot failure** — GR-2 performed in the ruled form does not produce a registration readable on the `drive=1` surface within one watchdog period (10 minutes), or OQ-1 stands unruled at execution time — STOP before the lifts (the system is still held; no re-hold is needed and none is performed).

  That form is superseded in both its test and its interval: a **readable registration is not satisfaction** (GR-3: a non-null `armedAt` does not satisfy the observation requirement; the analysis §3 governing rule: persisted `armedAt` is not proof of delivery), and the interval is the ruled **15 minutes**, not one watchdog period. Package §7 item 3 is replaced by:

  > 3. **Wake-slot failure** — GR-2 performed in the ruled form produces **no observed effect satisfying corrected §3.1 of the OQ-1 analysis within the ruled 15-minute bound** (complete paired polling at least every 5 minutes), or OQ-1 stands unruled at execution time — STOP before the lifts (the system is still held; no re-hold is needed and none is performed). A registration readable on the `drive=1` surface is a consistency marker only and never satisfies this item by itself.

---

## 2. Required Revision 3 — the non-null `armedAt` branch rewritten (GR-3)

The ruling: "A non-null armedAt does not, by itself, satisfy GR-2 or justify omitting the probe. A restoration-accounted registration may justify a no-probe branch only if its provenance is documented and a fresh, independently observed drive effect satisfies the same wake-verification requirements before either hold lifts. Otherwise STOP and return for review. Do not improvise a second wake."

### 2.1 Analysis §2.4 — struck and replaced

Analysis §2.4 proposed:

> **Proposal: yes, conditionally — and the condition is evidentiary, not formal.** … The proposal is therefore:
>
> - If GR-0 reads non-null `armedAt`, GR-2 is recorded **satisfied-by-observation** — no probe is sent (sending one would add a second wake whose only certain effect is noise in the evidence; the mechanism's discipline is *exactly one wake act by this gate*, and an act whose precondition is absent is not performed) — **provided** the restoration record accounts for the state (the value is consistent with a registration re-armed against the surviving schedule rows, i.e. a past-due or imminent due under R5a's past-due disjunct) **and** the §3 verification still runs in full: the observed-effect proof (a pass, or the in-set grant transition) is **not waived** by satisfaction-by-observation. If no delivery follows within the §3 bound, the gate treats the case under §4 exactly as a failed wake — the registration, however it arose, did not deliver.
> - If GR-0 reads non-null `armedAt` that the restoration record does **not** account for, that is a census deviation under the resume package's own law (STOP at GR-0, §7.1) — not a GR-2 question at all.

The satisfaction-by-observation disposition is **struck** and replaced by the ruled branch:

> **OQ-1(c), as ruled (GR-3).** A non-null `armedAt` at GR-0, by itself, **satisfies nothing and omits nothing**: it does not satisfy the wake-verification requirement, and it does not justify omitting the probe. There is exactly **one** no-probe branch, and it opens only when **both** of the following hold:
>
> **(i) Documented provenance.** The standing registration's provenance is documented in the **restoration record** — concretely: the restoration gate's execution record, written at restoration time and standing **before the resume gate opens**, contains an account of the registration naming (a) that a registration stands at the restoration's close (or arose at an identified point the record covers), (b) its value as read at the restoration's closing census, and (c) the identified wake that produced it — the specific command, report, or app-use path the record names as the registration's source, with its timestamp. A value merely *consistent with* a re-arm against the surviving schedule rows is **not** documentation; an executor inference at GR-0 from the value's shape is **not** documentation; a restoration record containing no such account leaves provenance **undocumented**, and the no-probe branch unavailable, however plausible the registration's origin looks.
>
> **(ii) A fresh, independently observed drive effect, pre-lift.** After GR-0 and **before either hold lifts**, a drive effect satisfying the **same** wake-verification requirement as a probe-produced effect — corrected analysis §3.1: a new drive-pass recorder row on the P-6 surface, timestamped after GR-0, stage complete, `driveInvoked` true, error fields null — is independently observed under corrected §3.2's polling discipline and bound. The observation is the executor's own fresh read set, not the restoration record's report and not the registration's persistence.
>
> If both (i) and (ii) hold, GR-2 is recorded **satisfied-by-observation under GR-3**, the evidence (the restoration record's account + the raw observation polls) is quoted in the gate record, and the sequence proceeds to GR-3 with no probe sent. **If either fails — provenance undocumented, or no qualifying effect observed within the bound — the default is the probe**: GR-2 proceeds in its ruled form (§2.1 of the analysis) exactly as if the registration were null, unless the state is one the package's census law stops on first (next paragraph). **No second wake is ever improvised**: if the probe has been sent, a standing registration — however it arose and however well documented — never licenses a further wake act by this gate; if the probe has not been sent and the no-probe branch has failed on (ii), the probe is the one wake, sent once, under §4's discipline.
>
> A non-null `armedAt` that the restoration record does not account for **at all** — no provenance account and no closing-census value to compare — remains what the package's law already made it: a census deviation, STOP at GR-0 (package §7.1), not a GR-2 question. GR-3's branch governs the *accounted* case only; it does not soften the unaccounted case.

### 2.2 Package text conformed

- **Package §5.3's closing paragraph** read: "If GR-0's census instead reads a non-null `armedAt` accounted for by the restoration record (§4.0 item 4), GR-2 may be satisfiable trivially; the ruling should say what the executor does in that case too." The ruling has now said. "Satisfiable trivially" is struck; the paragraph is replaced by: "*If GR-0's census instead reads a non-null `armedAt`, corrected §2.4 of the OQ-1 analysis (GR-3 as ruled) governs: the value alone satisfies nothing and omits nothing; the no-probe branch requires documented provenance in the restoration record **and** a fresh, independently observed drive effect before either hold lifts; otherwise the probe is sent, or the census stops the gate.*"
- **Package §4.0 item 4**'s sentence — "in which case GR-2's form changes and Rowan's OQ-1 ruling governs how the executor proceeds" — stands in substance (the ruling now exists) and is read as pointing at corrected §2.4 above; item 4's STOP rule for an unaccounted `armedAt` is unchanged and is restated in corrected §2.4's closing paragraph.

---

## 3. Required Revision 4 — the wake in the mutation ledger (GR-4)

The ruling: "Count the fresh probe as exactly one production command, including its expected rejected receipt. Account separately for any resulting alarm registration, drive activity, grant churn, and other effects. Do not represent the expected refusal as proof of zero downstream effects. Update the resume gate's mutation ceiling and execution record accordingly."

### 3.1 The package §3 GR-2 line — replaced

As pinned, the package §3 ledger row for GR-2 reads:

> | GR-2 | **Wake slot** (§5.3) — mechanism fixed by Rowan's OQ-1 ruling; accounting fixed by that ruling and recorded here by amendment before execution | per ruling |

The mechanism is now ruled (GR-1) and its accounting is now fixed (GR-4). The row is replaced by:

> | GR-2 | **Wake** (§5.3) — exactly one fresh probe command: `RequestPause` against `alarm-wake-probe:nonexistent`, newly minted command_id, via the client connector, expected receipt HTTP 200 `{"outcome":"rejected","reason":"job_not_found"}` (OQ-1 analysis §2, as corrected) | **1** |

### 3.2 The corrected ceiling — package §3 budget totals

As pinned, the totals read: "**Budget totals:** counted mutations **≤ 4** on every path (GR-3, GR-4, and exactly one of GR-6a/GR-6b), **plus** the GR-2 wake slot at whatever accounting Rowan's ruling assigns it."

GR-4 assigns the wake **exactly one**. The totals are replaced by:

> **Budget totals:** counted mutations **≤ 5** on every path — GR-2 (the probe: **1**), GR-3 (halt lift: 1), GR-4 (queue unpause: 1), and exactly one of GR-6a/GR-6b (re-pause + re-halt: 2). The probe's count of one is the **command itself, including its expected rejected receipt**: the receipt is the command's own response, not a second mutation and not an extra ledger line. No path counts the wake as zero, and no path counts it as more than one.

The explicit zero budgets that follow in package §3 (SubmitJob 0; exemption calls 0; containment transitions 0; deploys 0; queue changes beyond GR-4/GR-6 0; conflicts changes 0) stand **unchanged** — the probe is none of those things: it is a client command through the ordinary command route, counted above, and it performs no containment transition, no submission, and no queue or settings act.

### 3.3 Observed effects — accounted separately, never as mutations, never as zero-proof

The probe's **effects** are accounted on separate lines from its mutation count, as **observed effects**, each with its read source:

| Observed effect | How observed (read source) | Accounting |
|---|---|---|
| Alarm registration state after the probe | P-6 surface (`GET /v2/d6-diagnostics?drive=1`): `armedAt` value or null, per poll | An observed effect of the coordinator's `wake()`, not an executor mutation; recorded per poll, never predicted |
| Drive activity | P-6 recorder rows (new row ids, timestamps, stage, `driveInvoked`, error fields) | Observed effects; the wake-verification evidence (corrected §3.1) |
| Grant churn | P-1 job surface (`grants[]`, occurrence state, job revision) + P-5 derived reserved | Observed effects of the drive path under the holds; in-set churn is $0 and dispatch-fenced; any out-of-set value is an abort under package §2.3.3, not an accounting variation |
| Any other effect | The remaining P-surfaces as polled | Observed and recorded as read; an effect no surface explains is a finding for the record, not an assumption |

**The refusal proves nothing downstream.** The expected `job_not_found` refusal establishes exactly one fact: `handleCommand` ran and apply refused the command because the target job does not exist. It must **not** be represented — in the ledger, the execution record, or any summary — as proof of zero downstream effects. The Grant 2 precedent's read set *observed* no state change attributable to the command on the plan/phase/quota/conflict/binding surfaces (analysis §2.5, standing), but observation is the only route to that claim, in this gate as in the precedent: the execution record states what the polls **read**, and claims nothing about surfaces at instants no poll covered. Analysis §2.5's proposed treatment ("the wake is **one client command**… **Everything else: zero**") is conformed accordingly: the "one client command" count stands and is now the package's counted line (§3.1 above); the "everything else: zero" sentence is replaced by the observed-effects accounting of this section — effects are **as observed**, line by line, or not claimed.

### 3.4 Execution-record requirement

The gate's execution record must carry, for GR-2: the probe line itself (the command type and target, the newly minted command_id, the dispatch timestamp, the connector route); its receipt (the HTTP status and the response body verbatim); and **each observed effect with its read source** (surface, poll timestamp, and the values as read) — the registration state, the recorder rows relied on, and the grant-state reads — so the record distinguishes at every point between the **one counted mutation** (the command), its **receipt** (part of the same line), and the **observed effects** (separately sourced reads). A record that merges the receipt into a second count, omits an observed effect, or states an unobserved surface as unchanged fails GR-4.

---

## 4. Required Revision 5 — OQ-2 RESTORED TO OPEN for GR-B (GR-5)

The ruling: "The window establishes sequential grant reissuance after expiry while the chain was delivering. It does not establish the behavior after stop, clear, and restart. Preserve the observed pattern as a conditional expectation, but do not close the cold-restart question on inference alone. GR-B remains blocked until this case is resolved by sufficient evidence or a separately reviewed, bounded verification protocol."

### 4.1 Analysis §6 — the closure proposal struck

Analysis §6 closed with this disposition paragraph:

> - **Proposed disposition (Rowan rules — Q5):** OQ-2 is **NARROWED to the extension point**. This analysis proposes Rowan close OQ-2 for branch GR-B by adopting the observed pattern as §2.3.2's expectations — new grant, incremented id (`seg:88:full` if the standing grant has voided by the gate's first delivered pass, the exact number being a census/protocol observation, not a prediction), occurrence `granted` throughout, job revision incrementing per issuance — **with the cold-restart extension named in the package as an assumption at exactly that strength**, so the executor at GR-B knows which expectation is observed and which is extended. If Rowan instead holds OQ-2 open for the cold-restart sub-case, GR-B may not execute until the extension is otherwise evidenced, and GR-A (if its census form obtains) is unaffected. **This analysis does not close OQ-2; it reports the narrowing and proposes the disposition.**

**The closure proposal is struck.** Rowan has held OQ-2 open, on exactly the branch this paragraph proposed to close by inference. The paragraph is replaced by:

> - **Disposition (as ruled — GR-5): OQ-2 REMAINS OPEN for GR-B.** The window establishes sequential grant reissuance after lease expiry **while the chain was delivering** — the mechanics of §6's observations (new grant, incremented id, occurrence `granted` throughout, job revision incrementing per issuance) stand as observations at exactly that scope. The window does **not** establish behavior after **stop, clear, and restart**: the cold-restart case — the resume gate's own case — is unobserved, and it is **not** closed by inference from the delivering-chain pattern. The observed pattern is preserved as a **conditional expectation** only: it is what the executor expects to see if the machinery behaves alike after a restart, it may be used to *recognize* in-set behavior in a future approved verification protocol, and it fills **no** expectation in package §2.3.2 by its own force. **GR-B remains BLOCKED** until the cold-restart case is resolved by sufficient evidence or by a separately reviewed, bounded verification protocol — either route is a future Rowan ruling, requested with its evidence or its protocol, not an executor determination at gate time.

Analysis §6's earlier text stands with one conforming change: its "Established (observation strength, delivering chain)" bullet already scopes itself correctly and is unchanged; the "Not established" bullet's cold-restart point is now the **dispositive** one, and its phrasing ("an **extension of the observed pattern, not an observation**") is adopted by the replacement paragraph above. §6's title and framing ("as now observed") stand, read as: observed **for the delivering chain**.

### 4.2 What this means for the package's branches — precisely

- **GR-A is unaffected.** By the package's own branch definition (§4.1), GR-A is selected when the census reads the preserved plan/job **exactly at their attempt-3 closing values**: job `queued` rev 1, **grants []**, occurrence `pending`. No grant has ever been issued in that form, so no void exists and no re-issuance question can arise inside it: the first grant the protocol expects (§2.3.1 step 1 — `seg:1:full` appearing, occurrence `pending` → `granted`, reserved 0 → 12) is an **initial issuance**, whose expectations are fully specified from the records without OQ-2. Package §0 leg 4 says the same thing in dependency form: OQ-2 is required "**additionally if** the executing branch is GR-B." GR-5 therefore changes nothing for GR-A: if GR-A's census form obtains and the gate's other preconditions stand (§7 below), GR-A may execute on the corrected documents.
- **GR-B is blocked.** By the package's own terms, §2.3.2's expectations "wait on" the OQ-2 ruling ("this branch may not execute until Rowan's ruling on OQ-2 fills those expectations in writing"), §4.2 repeats it ("Execution in GR-B additionally requires Rowan's ruling on OQ-2"), and §0 leg 4 makes it a gate precondition. GR-5 is a ruling on OQ-2 that **declines to fill** those expectations and holds the question open. GR-B therefore remains a **census branch, not an executable one**: if the GR-0 census selects GR-B's form, the gate stops there and the OQ-2 question returns to Rowan with whatever the census read — the executor does not execute GR-B on the conditional expectation, does not treat the delivering-chain pattern as §2.3.2's fill, and does not re-characterize the census into GR-A. The package §9 OQ-2 entry's status is conformed to read: "**OQ-2 (blocking, branch GR-B only) — REMAINS OPEN** (GR-5, 2026-11-05): the delivering-chain reissuance pattern is a conditional expectation only; the post-stop/clear/restart case is unobserved and unclosed."

---

## 5. Required Revision 6 — recorder-discrepancy handling, explicit and non-permissive (GR-6)

The ruling: "An in-set grant transition without a recorder row is meaningful corroborating evidence, but does not independently establish the complete GR-2 wake-verification requirement. Classify it as an R-06 evidence discrepancy. Do not lift either hold on that evidence alone. Return for review unless an independently adequate verification route has been approved."

### 5.1 Analysis §3.1 — the cross-check passage struck and replaced

Analysis §3.1's secondary cross-check read:

> - **Secondary cross-check — the in-set grant transition.** The P-1/P-5 surfaces showing the preserved plan's grant cycle move exactly inside the branch's expected set (GR-A: the named grant appears, reserved 0 → 12; GR-B: as §6 leaves it for Rowan's OQ-2 ruling). A pass moves the grant state whether or not its recorder row survives — the recorder has a known dual-failure blind spot (register R-06: a pass and its recording failing together is invisible on the row surface). The cross-check exists so the protocol does not declare a wake failed on a recording failure; **whether the cross-check alone satisfies GR-2 is a question for Rowan (Q6)** — the conservative default this analysis proposes is: row **or** cross-check satisfies, and a cross-check-only satisfaction is recorded **as an R-06-class observation** in the gate record, at that strength, never silently as a clean pass.

The proposed "row **or** cross-check satisfies" default is **struck**. Rowan has ruled it (GR-6), and the passage is replaced by:

> - **Corroborating cross-check — the in-set grant transition (never sufficient alone).** The P-1/P-5 surfaces showing the preserved plan's grant cycle move exactly inside the branch's expected set (GR-A: the named grant appears, reserved 0 → 12; GR-B: not executable while OQ-2 stands open — §4 of the companion correction) is **meaningful corroborating evidence** that a pass ran: a pass moves the grant state whether or not its recorder row survives, and the recorder has a known dual-failure blind spot (register R-06: a pass and its recording failing together is invisible on the row surface). But corroboration is its whole weight. **An in-set grant transition without a recorder row does NOT independently establish the wake-verification requirement** and does not satisfy GR-2: wake verification requires the **recorder-row route** — a new `d6_drive_passes` row under the primary evidence above — **or an independently adequate verification route that Rowan has approved in advance**. No other route exists by default.
> - **The discrepancy path.** If, within the §3.2 bound, an in-set grant transition is observed **without** a corresponding recorder row, the executor classifies the state as an **R-06 evidence discrepancy**, records it under that name with both surfaces' raw reads, and **lifts neither hold** on that evidence. The gate does not proceed to GR-3; the discrepancy **returns for review** (Rowan and Julie), and the gate resumes only under a ruling on the discrepancy or an approved alternative verification route. The discrepancy is not a wake failure either — it is not §4.1's no-effect case, and it must not be recorded as one: the record states exactly what was seen (grant moved, in-set; no row) and exactly what was not established (delivery, by the required route). Symmetrically, a recorder row without its expected grant movement is read under the same discipline: the two surfaces corroborate or the finding is classified, never resolved by the executor preferring one.

### 5.2 Conforming changes

- **Analysis §2.4 (as corrected in §2 above)** conditions the no-probe branch on "a drive effect satisfying the **same** wake-verification requirement" — that phrase now resolves to corrected §3.1: the recorder-row route (or a pre-approved alternative). A documented-provenance registration accompanied only by a row-less grant transition does **not** open the no-probe branch; the transition is an R-06 discrepancy under §5.1's path.
- **Analysis §3's governing rule** is unchanged and is the premise of this section: persisted `armedAt` is not proof of delivery; the wake is verified by its observed effect **by the required route**, or not at all.
- **Analysis §7's R-06 bullet** ("§3.1's cross-check is the mitigation, and Q6 asks Rowan to fix its evidentiary weight") is conformed: Q6 is answered by GR-6 — the cross-check's weight is **corroboration only**, and the discrepancy classification of §5.1 is the mitigation's corrected form.
- **Package §2.3.3 abort condition A-6** (a recorder row showing an unclassifiable error outcome) is a different case — a row that exists and errs — and stands unchanged; the row-less-transition case is pre-lift (GR-2) in this gate's sequence and is governed by §5.1, not by A-6.

---

## 6. GR-7 — failure behavior: conditions confirmed and wording tightened

The ruling: "Accept one wake attempt, no automatic retry, no deploy-as-stimulus, and no hold lift following failed pre-lift verification. A failure must preserve the raw poll evidence and return to Rowan and Julie. A later alarm delivery is new evidence, not retroactive authorization. After any hold lift, retain the existing abort sequence: re-pause queue delivery, then re-halt generation, verify both, and report any uncontained exposure."

Where each element already stood, and the tightening applied:

- **One wake, no retry, no deploy-as-stimulus, no post-failure hold lift** — analysis §4.1 items 1–3 and §4.3, and §5's alternatives table (items 2, 3), already carry all four at the ruling's strength. **Confirmed, unchanged.**
- **Raw poll evidence preserved and returned** — analysis §4.1 item 4 read: "The failure is recorded as a new W-4-class observation — wake sent (command_id, dispatch timestamp, the refusal response), registration state as read (`armedAt` value or null, per surface), no pass and no grant transition within the bound, polls preserved raw — and the gate's record **returns to Rowan and Julie**." Tightened by one express clause, appended to that item: "*The raw poll evidence itself — every poll's full read set, timestamps, and surfaces — is preserved unedited and **returned with the record** to Rowan and Julie; a summary of the polls is not a substitute for the polls.*"*
- **Late delivery** — analysis §4.1 item 5 read that a late pass "does not retroactively satisfy GR-2 for a gate attempt that has ended." Tightened to the ruling's terms, the item's operative sentence now reads: "**A later alarm delivery is new evidence, not retroactive authorization**: it is observed, logged, and reported as a tail-observation fact (its pass can only churn the grant under the standing holds — $0, no dispatch); it does not satisfy GR-2 for the ended attempt, does not revive the consumed GO, and does not authorize anything. A new attempt is a new authorization." The remainder of item 5 stands.
- **Post-lift abort sequence** — analysis §4.2 carries the package §2.3.3 sequence ("(1) re-pause the queue… (2) re-halt generation… (3) closing capture"), and the package's own text carries the verification ("read back `delivery_paused: true`"; "read back: `/health` generation `halted`, build unchanged, etag unchanged, observability intact"). To make the ruling's "verify both, and report any uncontained exposure" express in the analysis, §4.2's sequence is restated with its verification and exposure clauses named: "*(1) **re-pause queue delivery** (cf-api PUT `delivery_paused: true`) **and read it back**; (2) **re-halt generation** (restore the envelope with GENERATION_HALT `"1"`) **and read it back** — `/health` generation `halted`, build and etag unchanged, observability intact; both holds are **verified by their read-backs**, never by the acts' responses alone; (3) closing capture of the full P-1..P-9 set, ending HELD, with **any uncontained exposure reported** in the package §8.3 three-line form (verified charges / unverified estimates / remaining phase room) and any revived-churn state named REVIVED-UNSTOPPED / OWNED.*" The package §2.3.3 text itself is unchanged — this restatement conforms the analysis's summary of it to the package at the ruling's strength.

---

## 7. GR-1 recorded, and the gate's remaining preconditions in order

**GR-1 — ACCEPT IN PRINCIPLE.** "Accept one newly identified RequestPause command against the verified nonexistent probe job, expecting job_not_found, as the proposed wake mechanism. The Grant 2 precedent supports this design but does not prove the post-stop/post-clear case. This mechanism is not authorized for execution by this ruling." Recorded at exactly that strength in both amended documents: the mechanism is the GR-2 fill (analysis §2, as corrected here); the precedent **supports the design and does not prove the post-stop/post-clear case** — no live precedent exists for the wake in that state (analysis §7, standing); and **no execution of the mechanism is authorized** — authorization is the resume gate's own GO, at the end of the chain below.

**Remaining preconditions, in order** — cross-checked against the package §0 dependency legs, which list five; the reconciliation of the two lists is stated after them:

1. **Rowan's acceptance of these corrections** (the C3 companion correction and this one) — the documentary act this filing requests. (Package §0 leg 4, in part: her ruling on the open questions — OQ-1 now ruled with these corrections pending acceptance; OQ-2 held open per GR-5, which gates GR-B only.)
2. **C3 executed and closed** under its own GO, ending CHAIN_STOPPED / verified (package §0 leg 2) — itself awaiting item 1 and Julie's separate C3 GO.
3. **The standalone restoration executed and closed** under its own separate authorization (Rowan ruling + Julie GO + fresh census + recorded reason + mandatory historical audit review), ending NORMAL with the system otherwise HELD (package §0 leg 3) — and, per corrected §2.1(i), its record is where the GR-3 provenance account must stand if the no-probe branch is ever to be available.
4. **Rowan's PASS on the resume package as corrected** (package §0 leg 4, remainder): the corrected package — package + analysis + this correction — as the gate's readiness basis.
5. **Julie's separate explicit GO for this gate**, in the package §6 branch-aware wording, recorded before the execution census (package §0 leg 5). For GR-B, an OQ-2 resolution (evidence or an approved bounded protocol, §4 above) is additionally required before that GO can cover the branch.

**Reconciliation with package §0:** §0 lists five legs; the four-item chain above matches legs 2–5 with leg 4 split across items 1 and 4. **Leg 1** (an eligible S1 disposition exists and Rowan has reviewed the window record) is **already satisfied**: the window record was reviewed and dispositioned in Rowan's 2026-11-05 ruling on it (R1 event accepted; R2 W-4 dispositioned) and C3-1 has since accepted that disposition as establishing branch-(d) eligibility — the eligible form for this chain is the branch-(d) disposition itself. No leg is dropped: legs 2, 3, 4, 5 stand open in the order above, and the execution census (package §4) remains fresh and supreme after all of them.

---

## 8. What this correction does not do

It authorizes no execution of anything — not the wake, not C3, not restoration, not any hold lift. It closes no open question by its own authority: OQ-1 stands answered by GR-1–GR-4/GR-6/GR-7 **as corrected here, pending Rowan's acceptance of this correction**; OQ-2 stands **OPEN** (§4); OQ-3…OQ-6 are untouched and remain Rowan's to rule on with the package's readiness review (item 4 of §7). It changes no value in the package's census, cost, or quota sections; the §4.2 baseline values the package adopts from the C3 and restoration censuses are adopted **by the package's own terms** at gate time (§4.2: "adopted from the C3 closing census and the restoration census, quoted in the execution record with their sources") and are not amended here — the window's churn outcome (successor grants to `seg:87:full`, reserved 12 at the window's close) reaches GR-B, if at all, through those censuses and the D-delta form, not through any figure carried in this correction.

**Contents of this filing:** the companion C3 correction (`PHASEB-C3-BRANCH-D-CORRECTION.md`) + this correction (`PHASEB-GENERATION-RESUME-CORRECTION.md`) + the companion cp (`PHASEB-CORRECTIONS2-ROWAN-CP.md`), under one pin (`<PACKAGE-PIN>`), with verbatim sequential parts for any document exceeding ~30 KB (exact-concat verified).

**Turn: Rowan's** — acceptance of these corrections is precondition 1 of §7 for both gates.

— Wren
