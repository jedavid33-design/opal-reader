# Phase B — GENERATION-RESUME gate: CORRECTION 2 — the OQ-3 and OQ-6 revisions

_Prepared by Wren, 2026-11-05, under section B and section C item 2 of Rowan's ruling on the C3 execution record and the OQ-3–OQ-6 disposition (local record `ROWAN-C3-EXECUTION-OQ36-RULING.md`; C3 execution pin `b4727c408f6c446a94466594ea2cc7c59d11de8d`; disposition pin `f83568de7b288748d7246933f9fc7821ed5d4ac5`). This is the narrow correction that ruling commissions: it amends **OQ-3 and OQ-6 only**. It is documentary only: it authorizes nothing, requests no GO, performs no production act, and advances no precondition. Production remains HELD (C3 executed and closed; the system stands HELD in CHAIN_STOPPED with GENERATION_HALT=1 and the queue paused); the preserved plan and the idx-26 exemption stand untouched._

Pin (this document and the companion cp ride one pin commit): `<PACKAGE-PIN>` — repo `jedavid33-design/opal-reader`, branch `ui1-review`. (Pin-slot pattern, as established: a commit cannot name itself; the pinned copy carries the slot.)

## 0. What this correction amends — and what it does not touch

**Amended:** `PHASEB-GENERATION-RESUME-OQ3-OQ6-DISPOSITION.md` (pin `f83568de…`) at its §1.4 clause 3, §1.5, §4.3, §4.4, and §5 table — and, through the disposition, `PHASEB-GENERATION-RESUME-PACKAGE.md` (pin `0946f9f2…`, as corrected at pin `8ca683bd…`) at its §2.3.3 (one abort condition added) and §2.3.4 (closure evidence and the OQ-6 parenthetical conformed). Struck and replaced passages are quoted verbatim from the pinned documents, so this correction is self-contained in the established correction pattern.

**Untouched, expressly:**

- **OQ-4 — ACCEPT** as ruled. Not part of this correction.
- **OQ-5 — ACCEPT WITH CONDITIONS** as ruled. Not part of this correction and not redrafted here: the named read-only post-gate observation duty (owner, start, read set, classifications, escalation, termination) is to be specified in the resume gate's own record per the ruling — a gate-record obligation at execution time, not a further documentary amendment.
- **OQ-1 / GR-1…GR-7** — accepted in the corrections-round-2 ruling and standing. In particular **GR-6's pre-lift discipline is not amended by §1 of this correction**: §1 supplies the *post-lift* consequence for the R-06 classification, which the disposition (§1.3) identified as unruled and which Rowan's OQ-3 REVISE now rules. Nothing here weakens, re-opens, or re-words the pre-lift route.
- **OQ-2 — REMAINS OPEN** and continues to block GR-B. Untouched.

## 1. OQ-3 — the post-lift recorder rule, corrected (REVISE)

### 1.1 The ruling, verbatim

> OQ-3: REVISE. Accept accounting surfaces as the authority for actual segment completion and recorder rows as corroborating evidence. Preserve strict pre-lift GR-6 verification. After a hold lift, a missing expected recorder row must be classified R-06, trigger containment of further exposure through the existing abort/re-hold sequence, and return for review. Do not continue dispatch merely because accounting surfaces show in-set movement. If completion has already occurred, preserve that fact without pretending the recorder discrepancy did not happen.

### 1.2 What stands, unamended

- **Accounting surfaces are the authority for actual segment completion; recorder rows are corroborating evidence.** The ruling's first sentence accepts the disposition's §1.4 clause 2, which therefore stands exactly as pinned:

> 2. **Completion is proven by the accounting surfaces, with rows as required corroboration.** The satisfying closing evidence for success remains the P-1..P-9 set at §2.3.1 step 3's values (occurrence `ready`, execution `committed`, plan totals {eligible 1, done 1, failed 0, blocked 0}, derived reserved returned to 0, exactly one new binding with the watermark at 1842) plus the GR-7 closing census — because those are the surfaces that carry the facts of completion; a recorder row cannot prove a binding exists, and making a row *satisfying* evidence for completion would invert the evidence: the gate would be hostage to the R-06 blind spot in the wrong direction, unable to close over a segment every accounting surface shows complete because a recording failed.

- **Strict pre-lift GR-6 verification is preserved** — the ruling says so in terms, and this correction does not touch it: pre-lift, an in-set grant transition without a recorder row satisfies nothing, neither hold lifts, and the gate returns for review (correction at pin `8ca683bd…`, §5).
- **Error rows keep their weight (A-6).** Package §2.3.3, unchanged:

> - A-6: a drive-pass recorder row shows an error outcome attributable
>   to this plan's pass that the protocol cannot classify inside the
>   in-set values (cf. the window's W-3e discipline: recorder errors
>   are reported, never absorbed).

### 1.3 Struck — the disposition's §1.4 clause 3 ("protocol continues")

The following clause of the disposition is **struck in full**:

> 3. **A missing row post-lift is a discrepancy, not an abort and not silent corroboration.** If, during GR-5, grant movement in-set is observed without a corresponding recorder row, the executor records an **R-06 evidence discrepancy** in the gate record under that name, with both surfaces' raw reads; the protocol continues on the accounting surfaces (which govern the outcome), and the discrepancy is carried into the closing record for Rowan's execution review. This deliberately differs from the pre-lift path (GR-6: lift neither hold, return for review) — the asymmetry is principled and is stated for ruling: pre-lift, nothing is at risk and stopping costs the attempt nothing but time; post-lift, the segment's fate is decided by accounting facts the row does not carry, and aborting a completed-or-completing dispatch over a recorder gap would manufacture the harm the discrepancy discipline exists to prevent. If Rowan prefers the strict form — any row-less in-set transition, at any phase, returns for review before GR-6a — the package can carry either; the asymmetric form is proposed.

Rowan has ruled against the proposed asymmetry. The post-lift consequence is no longer "recorded, protocol continues": a missing expected recorder row after a hold lift carries the gate to the abort/re-hold sequence and a return for review, on the terms of §1.4 below. The asymmetry the clause argued (cheap to stop pre-lift, harmful to stop post-lift) is not re-argued here; the ruling replaces it, and the one place the post-lift context genuinely differs — completion already effected — is carried by the carve-out at §1.4(e), which is the ruling's own final sentence given operational form.

### 1.4 The corrected post-lift rule (replaces §1.3's clause)

**(a) Detection — the observation point.** During GR-5 (after the GR-3/GR-4 lifts, until the GR-6a/GR-6b close), the §2.3 protocol polls the full P-1..P-9 set at least every 5 minutes. A recorder row is **expected** for every drive pass this gate's activity produces (disposition §1.4 clause 1, standing). An expected row is **missing at the observation point** when an in-set accounting transition for this plan's occurrence — any of §2.3.4's progress-event kinds observed on the accounting surfaces (grant appearance or grant state/revision change; an attempt recorded for this occurrence; plan totals change; occurrence state change; dispatched increment for this grant) — appears in a complete poll, and **no corresponding row appears on the P-6 surface in that poll or in the next complete poll**. A row corresponds if the P-6 read shows a drive-pass row, later than the last row accounted for, recording this plan's pass in the interval containing the transition. *(Definition supplied by this correction, for Rowan's acceptance: the ruling requires classification of "a missing expected recorder row" without fixing a lag allowance. The allowance is set at one further complete poll — at the §2.3 cadence, roughly five minutes — because P-1..P-9 are sequential reads within one poll and surfaces can skew inside a single poll set, while the window evidence shows rows are written by the pass itself (row id 1 stood ~1.9 s after the stimulus, window record §5): two consecutive complete polls is already generous, and a longer allowance would only extend exposure on a known discrepancy.)*

**(b) Classification and evidence.** On detection, the executor classifies the finding an **R-06 evidence discrepancy** in the gate record, under that name, with both surfaces' raw reads preserved in the gate evidence (the poll set itself, §2.3.4's closure discipline). The classification is recorded whether or not the carve-out at (e) applies.

**(c) Stop and re-hold — no continuation on accounting alone.** Unless the carve-out at (e) applies, detection **ends the attempt's forward motion**: no further dispatch decision may rest on the accounting surfaces, and no in-set movement after detection may be treated as license to remain lifted awaiting more progress. The executor executes the package's existing abort/re-hold sequence (§2.3.3) **in its exact order**, quoted here so the hook is unambiguous:

> **Re-hold sequence on abort (exactly this order, mirroring attempt
> 3's §9.1 closing):**
>
> 1. **Re-pause the queue** (cf-api PUT `delivery_paused: true`);
>    read back `delivery_paused: true`.
> 2. **Re-halt generation** (restore envelope: identical parts,
>    GENERATION_HALT `"1"`); read back: `/health` generation `halted`,
>    build unchanged, etag unchanged, observability intact.
> 3. **Closing capture** of the full P-1..P-9 set; the gate ends
>    **HELD** (§8.2). No containment transition is performed by this
>    gate on any path (§3): if the chain stands revived and churning
>    after an abort, that state is **REVIVED-UNSTOPPED / OWNED** under
>    the standing tail discipline until a future authorized disposition
>    — named in the execution record, never silently absorbed.

The gate ends **HELD**, with the §8.3 three-line exposure report.

**(d) Return for review.** The execution record carries the discrepancy, the raw evidence, the re-hold read-backs, and the exposure report, and returns to **Rowan and Julie for review**. There is no continuation, no retry, and no success close under the same GO after a post-lift R-06 that (e) does not cover; any further attempt is a new attempt under a fresh ruling and a fresh GO.

**(e) The completion carve-out — facts already effected stand.** If, at or before the detection poll, the accounting surfaces already show the **complete** §2.3.1 step-3 completion set — occurrence `ready`, execution `committed`, plan totals {eligible 1, done 1, failed 0, blocked 0}, derived reserved returned to 0, and exactly one new binding with the bindings watermark at 1842 (§1.2's quoted clause 2; package §2.3.1 step 3) — then **completion stands as fact**. The audio and binding outcomes are not unwound and cannot be: the package's own abort law provides that a re-hold "does not un-dispatch an attempt already sent, and does not un-spend a provider cost already incurred" (§2.3.3), and a committed execution with its binding is an effected outcome of the same kind. In the carve-out case the executor performs the GR-6a-form close (re-pause, then re-halt, with their read-backs — the same physical acts as the abort close, here as the success close), the execution record records **completion and the R-06 discrepancy side by side**, and the gate is reported as **completed-with-discrepancy, never as a clean success**, returning to Rowan's execution review with both facts stated. The line is exact: **closing on facts already effected is not continuing dispatch.** Continuing dispatch — allowing further attempts, or treating in-set accounting movement as license to keep the holds lifted in expectation of more — is forbidden from the moment the discrepancy is known, in all cases, carve-out included. What the carve-out preserves is a past fact; it licenses no future act.

**(f) The resulting symmetry, stated once.** After this correction the recorder's weight is uniform in discipline at every phase: a row can defeat the gate (A-6, error row, any phase — unchanged); a missing expected row stops the gate (pre-lift: GR-6, neither hold lifts, return for review; post-lift: this §1.4, abort/re-hold and return, subject only to the completion carve-out); and rows alone never *make* the gate's success — the accounting surfaces do (§1.2).

### 1.5 Conforming changes

- **Package §2.3.3 — abort condition A-7 added** (inserted after A-6, in the package's own form):
  > - A-7: a post-lift R-06 evidence discrepancy as defined in Correction 2 §1.4(a)–(d) — an in-set accounting transition with the expected recorder row missing at the observation point — where the §2.3.1 step-3 completion set has **not** already been observed. Where completion has already been observed, Correction 2 §1.4(e) governs instead of an abort.
- **Package §2.3.4 — closure evidence conformed.** Success closure additionally requires the P-6 discrepancy check to have been run across the whole poll set: a closure is recorded clean only if no §1.4(a) detection stands; a carve-out closure quotes the completion values **and** the discrepancy, per §1.4(e).
- **Disposition §1.5, first bullet — conformed.** The pinned bullet reads:

> - **OQ-1 design as corrected:** clause 1 restates GR-6 in its own scope and changes nothing; clauses 2–3 extend the same classification vocabulary (R-06 discrepancy) into GR-5 under a different consequence, expressly, so the two uses cannot be conflated at execution.

  It is replaced by: *clause 1 restates GR-6 in its own scope and changes nothing; clauses 2–3, as corrected (Correction 2 §1), carry the same classification vocabulary (R-06 discrepancy) into GR-5 under the ruled consequence — post-lift, the same return-for-review discipline as pre-lift, executed through the package's abort/re-hold sequence, with the completion carve-out of Correction 2 §1.4(e) as the single named exception — so the two uses cannot be conflated at execution.*
- **Disposition §5 table, OQ-3 row — replaced** (the new row stands in §3 of this correction). The pinned row read:

> | **OQ-3** — recorder expectations at resume | **ANSWERABLE-BY-RULE** (§1.4): accounting surfaces prove completion, rows required as corroboration; pre-lift row route unchanged (GR-6); post-lift row-less transition = R-06 discrepancy recorded, protocol continues; A-6 error-row abort unchanged | Conditions the gate's **closing evidence**, both branches; does not block opening (proposed reading of the package's unlabeled scope — Rowan to confirm) | Accept the four-clause rule (incl. the pre-lift/post-lift asymmetry), or substitute the strict form (any row-less transition returns for review before GR-6a); confirm the blocking-scope reading |

- **Disposition CP (`PHASEB-OQ3-OQ6-ROWAN-CP.md`)** — its OQ-3 one-liner ("post-lift row-less transition = R-06 discrepancy recorded, protocol continues") is superseded by this correction wherever it appears (headline paragraph, one-line list, and question (1)'s framing); the strict form its question (1) offered as Rowan's alternative is, in substance, the form she ruled — with the completion carve-out she added.
- **The GR correction (pin `8ca683bd…`) §5 (GR-6)** — **not amended.** Its scope was the pre-lift verification and remains exact. This correction supplies the post-lift consequence that the disposition §1.3 recorded GR-6 did "not by its terms" fix, now ruled by the OQ-3 REVISE.

## 2. OQ-6 — the timing rule, corrected (REVISE)

### 2.1 The ruling, verbatim

> OQ-6: REVISE. Retain the sliding ≥35-minute no-progress test, but do not claim the 12-slot reservation and cost ceilings independently bound elapsed time. They bound attempts and financial exposure, not wall-clock duration. Add an explicit maximum elapsed-time review checkpoint from dispatch, selected and justified as an operational safety policy rather than a measured provider latency guarantee. At that checkpoint, preserve state, stop further exposure if safe, and escalate for a fresh ruling rather than automatically extending the attempt indefinitely.

### 2.2 Struck and qualified — the ceilings do not bound elapsed time

**(i) Disposition §4.3, the detection-failures bullet — qualified.** The pinned bullet reads, in its operative part:

> - **The sliding test and a deadline detect different failures — the distinction that decides the question, stated as this disposition's argument.** §2.3.4's test detects **absence of progress**: two consecutive complete polls ≥ 35 minutes apart with no progress event (grant appearance or state/revision change; an attempt recorded for this occurrence; plan totals change; occurrence state change; dispatched increment for this grant) declare the stall, and any progress event slides the window. A deadline would additionally detect **slowness despite progress**. Every stall in the record — Phase B attempt 3 (no grant, no progress, declared on this test's precedent shape), the Phase A cohort stall, the W-4 — was a **no-progress** stall; the record contains no instance of progress-tokens-forever without completion. And the one hypothetical a deadline would catch — an endless splitting chain that keeps recording attempts — is already bounded on two non-clock axes: in **count** by the 12-slot reservation, and in **cost** by abort A-3 (the forecast line, 12,808 units settled delta, crossed before completion = forecast deviation + STOP) and A-4 (the detection threshold, 25,000 units), which the splitting chain spends against as it goes. An endless chain aborts on A-3 without any clock.

The final movement of that argument is struck as a claim about time: the 12-slot reservation bounds **attempts** (the cohort the single grant may hold against the 100/day provider-attempt cap — package §5.4: "The cohort worst case for this gate is 12 slots (the single grant's reservation)"), and abort A-3 (forecast line, 12,808 units settled delta) and A-4 (detection threshold, 25,000 units) bound **financial exposure** (settled units this segment may accumulate). An endless chain aborts on A-3 only when it has *spent* to the forecast line; neither ceiling says anything about how long the gate may *wait*. Restated at the ruling's exact strength: **they bound attempts and financial exposure, not wall-clock duration.**

**(ii) Disposition §4.3, the attempt-count bullet — scope made explicit.** The pinned bullet opens:

> - **The attempt count for this segment is mechanically bounded even though its duration is not.** The segment is 569 chars, expected cost 8,022 units ≈ $0.008 (package §5.4). The cohort reservation for the single grant is **12 slots** against the 100/day provider-attempt cap (package §5.4; census headroom ≥ 12, §4.0 item 6) — the reservation mechanics bound how many attempts can be in flight against this occurrence. Recursive `POLICY_BLOCK` splitting without voice substitution (feature law F3) means a single segment's attempt chain can legitimately lengthen — Gate 4's 23 policy-block outcomes are the observed shape of that — so a short deadline would risk aborting legitimate progress, which is exactly the failure mode the sliding test was designed (Gate 4's ruling) to avoid.

Its reservation sentence ("the reservation mechanics bound how many attempts can be in flight against this occurrence") is accurate for in-flight concurrency and is retained at that scope only; it supports no elapsed-time conclusion, and its closing caution — a short deadline risks aborting legitimate progress — is answered not by a tight bound but by the generous, policy-set checkpoint of §2.3, whose consequence is escalation and re-hold, not a failure declaration.

**(iii) Disposition §4.4, the proposed rule — struck and replaced.** The pinned rule reads:

> Proposed rule, for Rowan to accept, amend, or reject: **no distinct longer bound is required for the post-dispatch phase.** The sliding ≥35-minute no-progress test (§2.3.4) remains the sole timing control in both the pre-dispatch and post-dispatch phases; progress events of §2.3.4's enumerated kinds slide the window **without limit of count**; the post-dispatch phase is backstopped on its non-clock axes by A-3 (forecast line), A-4 (detection threshold), and the 12-slot cohort reservation. If Rowan nonetheless requires a hard outer bound, the proposed route is that she set it **expressly at the readiness review, with its basis stated in the ruling** — an act of judgment on latency tolerance, recorded as such — rather than accepting any figure derived in this document, because none can be.

It is replaced in full by §2.3 of this correction.

**(iv) Disposition §4.4, closing paragraph — final sentence struck.** The pinned paragraph ends:

> **What would close OQ-6 without a rule:** a measured per-attempt duration series for this provider path (which only a future generation gate's execution record can produce — i.e., evidence that cannot exist before this gate executes, and that this gate's own record will in fact create for its successors). The disposition is ANSWERABLE-BY-RULE rather than REMAINS OPEN because the gate does not need that evidence to be safe: the no-progress test plus the count/cost backstops bound the exposure the deadline would guard, at every duration.

The claim that the backstops "bound the exposure the deadline would guard, **at every duration**" is struck. What stands in its place: the count/cost bounds bound the exposure's **size** at every duration; they do not bound the duration itself. Bounding the duration is the checkpoint's job (§2.3), and the paragraph's evidentiary point is untouched — the duration series that could close OQ-6 without a rule still cannot exist before this gate executes (§2.4).

**(v) Package §2.3.4 — the OQ-6 parenthetical conformed.** The pinned text reads:

> After grant + dispatch, the same sliding test keys on
> attempt/completion progress (OQ-6, §9: no record bounds a single
> segment's delivery duration, so the test — not a deadline — is the
> control).

The parenthetical is conformed to read subject to this correction: the sliding test remains the control for *progress*; a maximum elapsed-time **review checkpoint** from dispatch (Correction 2 §2.3) is added as a backstop. The checkpoint is not a completion deadline and declares no failure — §2.3(d).

**(vi) Disposition §5 table, OQ-6 row — replaced** (new row at §3). The pinned row read:

> | **OQ-6** — completion timing bound | **ANSWERABLE-BY-RULE** (§4.4): no distinct longer bound; the sliding ≥35-minute test is the sole timing control in both phases, backstopped by A-3, A-4, and the 12-slot reservation; **no new evidence has arrived for this question since drafting** (stated plainly) | Conditions GR-5's post-dispatch phase, both branches | Accept the no-deadline rule — or set a hard outer bound expressly in the ruling, with its basis stated, there being no record figure to derive one from |

**(vii) Disposition CP** — its OQ-6 one-liner ("no distinct longer bound; the sliding ≥35-minute test remains the sole timing control in both phases") is superseded by this correction.

### 2.3 The corrected rule — sliding test retained; a maximum elapsed-time review checkpoint added

**(a) Primary control, unchanged.** The sliding ≥35-minute no-progress test (package §2.3.4, Gate 4's durable ruling) remains the timing control in both the pre-dispatch and post-dispatch phases, exactly as pinned: two consecutive complete polls ≥ 35 minutes apart with no progress event between them declare the stall (abort A-1); any progress event slides the window, **without limit of count**. That last property is precisely why a backstop is required: a chain that produces a progress event inside every window — attempts trickling, splits recurring — never trips the test, however long it runs.

**(b) The ceilings, at their true scope.** The 12-slot cohort reservation bounds **attempts**; abort A-3 (12,808 units) and A-4 (25,000 units) bound **financial exposure**; the Gemini prepay balance is the physical financial backstop (package §5.4). None of them bounds elapsed time, and no passage downstream of this correction may cite them as doing so.

**(c) The checkpoint — PROPOSED VALUE: 3 hours from dispatch.** A maximum elapsed-time **review checkpoint** is added to the post-dispatch phase:

- **T0 (dispatch), defined.** T0 is the timestamp of the **first complete poll** (the full P-1..P-9 set, package §2.3) at which **P-5 records a dispatched increment for the current PT day attributable to this gate's grant** above the pre-unpause baseline — the instant the post-dispatch phase of §2.3.4 begins. (Cross-check: P-1 shows the grant in its post-dispatch state at the same poll; a P-5 increment with no attributable grant is out-of-set under §2.3.1 and aborts under A-2, not a T0.)
- **The checkpoint fires at T0 + 3 hours** if the §2.3.1 step-3 completion set has not been observed at or before that moment. If completion is observed first, the checkpoint is moot and never fires. If dispatch never occurs, the checkpoint never starts: the pre-dispatch phase remains governed by GR-2's ruled 15-minute bound, the sliding test, and A-1 — OQ-6's scope is post-dispatch only (package §9).
- **The value is a PROPOSAL for Rowan's ruling** — hers to accept, amend, or replace. She required the checkpoint to be "selected and justified as an operational safety policy rather than a measured provider latency guarantee"; 3 hours is Wren's selection, justified below on policy anchors only. It must not be cited downstream as a measured bound on provider latency, nor as a completion deadline.

**Justification (operational safety policy; no latency measurement is claimed or exists):**

1. **Scale against the record's generation episodes.** The gate's entire work is **one segment: 569 chars, expected cost 8,022 units ≈ $0.008** (package §§5, 5.4), with expected realized attempts "far below the reservation" (§5.4). The record's comparable episodes are far larger and closed inside single attended sittings: **Gate 4 generated 15 segments — 76 attempts in total, including 23 `policy_block` outcomes — and closed within its execution session** (Gate 4 record, cited at disposition §4.3); Chapter 2's 18 segments completed within one run. Three hours for one 569-char segment is generous by well over an order of magnitude against everything the record contains — argued from the *scale of work*, expressly not from any per-attempt duration measurement, of which the record contains none (disposition §4.3).
2. **Relationship to the primary control.** Three hours is ≈ 5.1 stall windows (35 minutes). A genuine no-progress stall is declared by the sliding test roughly five times over before the checkpoint can be reached; the checkpoint therefore binds only the pathological case the sliding test structurally cannot catch — progress trickling just inside each window, indefinitely. It is a backstop, not a rival control.
3. **The human-attention anchor.** This gate is executed attended, in session, on a ≥5-minute poll cadence, and its failure/escalation reports land with Rowan and Julie in that session. A checkpoint inside a single attended sitting guarantees the escalation arrives while the executor is live and the raw evidence is fresh. A 12–24-hour checkpoint would strand the decision across sleeps and day boundaries and convert a review point into exactly the silent, unobserved waiting this recovery programme exists to eliminate (the W-4 stood past-due and unobserved for over a day inside a *monitored* window). Three hours is the longest interval that reliably stays inside one sitting for an evening-launched gate; that, and not any property of the provider, is what selects it.
4. **Exposure during the wait is fenced independently of the clock.** While the checkpoint clock runs, attempts are bounded by the 12-slot reservation against the 100/day cap (headroom re-checked at GR-4 if the PT day rolls, package §5.4), money by A-3, A-4, the per-grant phase guard, and the prepay balance, against a $0.008 expectation. The checkpoint therefore risks nothing the other controls do not already fence; its sole function is to guarantee a human decision point. That is what makes it a safety-policy bound rather than a disguised latency claim.
5. **Julie's stake is one segment.** The listening goal this gate serves is a single segment (the last of Chapter 3). No programme interest is served by letting its attempt run silently past the point where a fresh human ruling could be had the same evening; the cost of escalating early is one review round, and the cost of escalating late is an unbounded silent wait. The asymmetry selects the shorter end of the plausible range (the 2–4-hour band this justification argues within).

**(d) Checkpoint behavior.** At T0 + 3 hours with the segment not complete:

1. **Preserve state.** A full P-1..P-9 closing capture is taken at the checkpoint and the complete raw poll set is preserved in the gate evidence. The checkpoint itself disturbs nothing.
2. **Stop further exposure if safe.** The executor executes the §2.3.3 re-hold sequence in its exact order (re-pause the queue and read back; re-halt generation and read back; closing capture; the gate ends HELD; §8.3 exposure report). The re-hold is the gate's own designed closing act on every path (GR-6a/GR-6b) and is expected to be safe; **if any re-hold read-back cannot be verified, the executor escalates at once** — in the same report, immediately — rather than retrying silently or proceeding.
3. **Escalate for a fresh ruling.** The execution record classifies the end as **CHECKPOINT-ESCALATED** (classification name proposed with this correction) and returns to Rowan and Julie. The checkpoint declares **no failure and no fault**: the plan and grant stand exactly as the re-hold leaves them (REVIVED-UNSTOPPED / OWNED if the chain stands revived, per §2.3.3 item 3). **The attempt does not extend past the checkpoint under the same GO under any wording**; any continuation is a new attempt under a fresh ruling and a fresh GO.

**(e) Interactions.** The sliding test remains primary and will normally fire long before the checkpoint (no-progress is detectable in ~35–70 minutes; the checkpoint needs three hours of *progressing* non-completion). A-3/A-4 are independent of both timing controls and fire on spend whenever reached. OQ-4's boundary is untouched (it governs the pre-dispatch intervals; GR-2's 15-minute bound is pre-lift and unchanged). The §1 (OQ-3) rule is independent: an R-06 detection aborts on its own terms at whatever elapsed time it occurs, before or after the checkpoint would have fired.

### 2.4 What would close OQ-6 without a rule — unchanged

A measured per-attempt duration series for this provider path, which only a generation gate's execution record can produce — this gate's own record included. The corrected rule does not pretend the checkpoint is derived from such a series; it is adopted so the gate need not wait for that evidence to be safe against indefinite silent running. If Rowan prefers a different value, the justification structure above is the basis on which to set it, and the value should be recorded in her ruling as policy, with its basis stated.

## 3. Disposition table — OQ-3 through OQ-6 after this correction

| Question | Status after this correction | Substance |
|---|---|---|
| **OQ-3** — recorder expectations at resume | **REVISE — corrected here (§1)** | Accounting surfaces are the authority for completion; recorder rows corroborate (ruling, accepting disposition §1.4 clause 2). Pre-lift GR-6 stands strict and untouched. **Post-lift:** a missing expected recorder row at the §1.4(a) observation point is classified **R-06**, stops all further dispatch on accounting alone, runs the §2.3.3 abort/re-hold (new abort condition **A-7**), and returns to Rowan and Julie for review — **unless** the full completion set already stands, in which case completion stands as fact, the gate closes in GR-6a form, and the record carries completion **and** the discrepancy (completed-with-discrepancy, never clean). |
| **OQ-4** — the D-value at this gate's wake | **ACCEPT (Rowan's ruling) — untouched by this correction** | No additional pre-lift observation beyond the complete census, the ruled paired-poll wake verification, and the documented-provenance plus independent-effect route where applicable. The 15-minute bound is a failure-decision rule, not a platform latency guarantee. The B-family remains unresolved. |
| **OQ-5** — post-completion chain behavior | **ACCEPT WITH CONDITIONS (Rowan's ruling) — untouched by this correction** | The closing census suffices as closing evidence. A named read-only post-gate observation duty stands for both success and abort paths, ending at acceptance of the execution record or 14 days after close, whichever occurs first; its owner, start, read set, classifications, escalation, and termination are to be specified **in the resume gate record** per the ruling. It authorizes no production mutation. Nothing here redrafts it. |
| **OQ-6** — completion timing bound | **REVISE — corrected here (§2)** | The sliding ≥35-minute no-progress test is retained as the primary timing control in both phases. The 12-slot reservation and the A-3/A-4 ceilings are restated at their true scope: they bound **attempts and financial exposure, not wall-clock duration**. **Added:** a maximum elapsed-time **review checkpoint — proposed at 3 hours from dispatch** (T0 defined at §2.3(c)) — justified as operational safety policy, not a latency guarantee. At the checkpoint, segment incomplete: preserve state, stop further exposure via the re-hold if safe (escalate at once if the re-hold cannot be verified), and escalate to Rowan and Julie for a fresh ruling. No automatic extension past the checkpoint under any wording. |
| **OQ-2** — grant re-issuance after a §7.3 void (standing row, for completeness) | **OPEN — untouched** | Continues to block GR-B (GR-5, standing). No branch is selected in advance of the execution census. |

## 4. What remains before the resume gate's full readiness review can close

Nothing in this correction advances any precondition; the chain stands as follows (the disposition's §7 is updated by the events since its filing, and this correction records the update rather than re-issuing §7):

1. **Rowan's ruling on this correction** — acceptance of the §1 post-lift rule (including the A-7 insertion, the §1.4(a) observation-point definition, and the §1.4(e) carve-out) and of the §2 corrected timing rule (including the checkpoint: the proposed 3-hour value accepted, amended, or replaced in her ruling, recorded as policy with its basis stated).
2. **The standalone restoration, executed and closed** under its own separate authorization (Rowan's readiness ruling on the restoration package — the companion workstream commissioned in the same ruling, section C item 1 — plus Julie's GO, a fresh census, a recorded reason, and the mandatory historical audit review), ending NORMAL with the system otherwise HELD. (Disposition §7 leg 3. Legs 1 and 2 stand satisfied: the corrections were accepted in the corrections-round-2 ruling, and **C3 executed and closed on 2026-11-05** under Julie's GO, ending CHAIN_STOPPED / verified — the C3 execution ruling, section A.)
3. **Rowan's PASS on the resume package as corrected** at the full readiness review — the review this correction, the accepted GR correction, the accepted OQ-1 design, and the OQ-3–OQ-6 dispositions (as ruled and as corrected here) jointly feed. **GR-B additionally requires OQ-2's resolution** (sufficient evidence or a separately reviewed, bounded verification protocol) before any GO can cover that branch.
4. **Julie's separate explicit GO** for the resume gate, in the package §6 branch-aware wording, recorded before the execution census; the branch is selected by that census, never in advance.
5. **Gate-record obligations that land at execution, not in readiness:** OQ-5's post-gate observation duty specification (owner, start, read set, classifications, escalation, termination) is written into the gate record per Rowan's OQ-5 condition; GR-3's provenance account must stand in the restoration record (item 2) if the no-probe branch is ever to be available.

On items 1–3 landing, the full readiness review can close; item 4 then opens the gate.

## 5. What this correction does not do

Documentary only. It authorizes no containment transition, no restoration, no wake command, no hold lift, no dispatch, and no generation; it requests no GO; it selects no branch. The checkpoint value (3 hours), the §1.4(a) observation-point definition, the A-7 numbering, and the CHECKPOINT-ESCALATED classification name are **proposals** until Rowan rules. Production remains HELD; the preserved plan and the idx-26 exemption stand untouched.

**Turn: Rowan's** — ruling on this correction (the OQ-3 replacement rule and the OQ-6 checkpoint, value included), within the full resume readiness review. Julie's turns (the restoration GO; later, this gate's GO) are separate and unrequested here.

— Wren, 2026-11-05
