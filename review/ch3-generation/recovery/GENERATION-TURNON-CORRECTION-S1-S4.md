# WS1 CORRECTION S1–S4 — enforcement, smoke semantics, trigger refinements, soak auditability, and the conformed GO passage

_Amends the WS1 turn-on design package, `GENERATION-TURNON-DESIGN-PACKAGE.md`, pin `5cca000fac0838203f084aa07d9ada53c7fa1c75` (board summary 6686937444), under Part 1 of Rowan's combined WS1/WS2 design ruling (relayed by Julie in chat 2026-11-06; local record `ROWAN-COMBINED-DESIGN-RULING.md`). Design only: nothing here is implemented, deployed, or presented to Julie. The §9 GO wording as conformed at §5 of this correction is returned FOR ROWAN'S FINAL READINESS REVIEW — it is NOT approved for presentation. Production remains HELD at NORMAL. Pin slot: this document is pinned at `<CORR2-PIN>` (named in the companion CP)._

---

## 0. Disposition of the ruling's Part 1

| Ruling item | Disposition |
|---|---|
| Accepted decision 1 — O1 interim onboarding architecture (code-constant budgets, existing binding route, no registry redesign for this gate) | STANDS. No correction. §1 of this correction builds S1's enforcement on the same machinery. |
| Accepted decision 2 — the figure calculation is a recommendation tool; Julie retains authority over actual budgets; FP's $13.50 unchanged | STANDS. No correction. |
| Accepted decision 3 — OI-4 procedural identity control (canonical book ID from the book surface, proposed phase and budget, exact target identity verified immediately before the irreversible write; any discrepancy stops) | STANDS. No correction; the control is part of the onboarding procedure as filed. |
| Accepted decision 4 — OI-1 RE-TESTED for `parked_budget` / `parked_storage` (re-testing grants no authority over budgets, storage, accounting, quarantine) | STANDS. No correction. |
| Accepted decision 5 — Q4 legacy plan-less conclusion at source strength; fail-closed behavior and residual uncertainty remain visible | STANDS. No correction. |
| Accepted decision 6 — the nine-trigger framework and two-act procedure, subject to corrections | CORRECTED at §3 (S3): every trigger gains its evidence source and unavailable-source consequence; T-8 is rewritten as a two-stage rule. |
| Accepted decision 7 — OI-2: additional Standard submissions for onboarded books during the soak, within restrictions | STANDS. Carried into the conformed GO (§5) unchanged. |
| Accepted decision 8 — OI-3 thresholds provisional (60-dispatch smoke signal = escalation threshold, not a cap; 95% storage; 10 consecutive errors; missed-day extension; re-hold invalidates the soak) | STANDS, and the provisional thresholds are woven into §§2–4 where they operate. |
| **S1 — enforce the onboarded-book restriction** | **§1 of this correction.** The enforcement design (E1, recommended), the re-verified absence of a configuration-only alternative (E2), and the fallback risk decision (E3, not recommended). |
| **S2 — smoke failure and timeout semantics** | **§2 of this correction.** Decision interval, terminal classifications, re-hold conditions, incomplete-smoke disposition, the soak-entry evidence predicate. |
| **S3 — refine emergency triggers** | **§3 of this correction.** |
| **S4 — make the soak auditable** | **§4 of this correction.** Clean-day definition, missed reads, deadlines, findings disposition, observation-arrangement verification, P-14's evidence. |
| §9 GO wording — NOT YET APPROVED FOR PRESENTATION | **§5 of this correction**: the passage conformed in full, for Rowan's final readiness review. |

One correction propagates beyond S1's own section and is flagged wherever it lands: the design package's §3 closed with the sentence **"No code deploy"** for the turn-on gate. Under §1's enforcement design the gate gains one small reviewed deploy before the lifts. **WS1 is therefore no longer a zero-code gate.** The struck text and its replacements are given at §1.6.

---

## 1. S1 — Enforce the onboarded-book restriction

### 1.1 How a phase-null submission flows today (source, exact)

The ruling's premise is confirmed at source strength; this subsection is the flow the enforcement must close.

1. Every generation intent enters through `submitIntent` (generation/service.mjs:851). Its first acts are the lane check (:857 — `lane_not_allowed`) and phase admission (:861): `const admission = admitPhase(bookId, phase);` — the source comment at :859-860 attests the invariant the design relies on: *"a rejection creates no plan and moves no ledger state."* Plan creation, intent identity, and all ledger movement happen only after `admission.ok`.
2. `admitPhase` (service.mjs:402) in the production construction — enforcement-bound unconditionally (the entry constructs `phasePolicyMode: "enforce"`; a missing/mistyped var makes the entry's intent route return a 503 configuration failure, :215-231) — passes the round-5 bootstrap gate (registry established in production, so the gate at :424 does not fire) into `admitPhaseRegistry` (:431).
3. `admitPhaseRegistry` reads the book's own binding row FIRST: `const own = phaseBindingForBook(coord, bookId);` (:432) — a synchronous coordinator SQLite read (`coord._oneOrNull` over `d6_phase_bindings WHERE book_id = ?`, phase-policy.mjs). A bound book is fully governed: null phase → `phase_required`; wrong phase → `phase_mismatch`; correct → derived phase. An unbound book CLAIMING a phase is refused (`phase_not_budgeted` / `phase_bound_to_other_book` / `phase_unbound`, :442-445).
4. **The gap is the function's fall-through return (:447 in substance): an unbound book submitting with NO phase is admitted `{ ok: true, phase: null }`.** The phase-policy header states it as designed behavior: *"no phase at all still runs unbudgeted (phase null)"* — designed for the pre-policy world, and the precise path the Q1 ruling now closes as policy.
5. The admitted plan stores phase `null` (the admitted phase is what intent identity binds, service.mjs:881-890). At grant time the phase checks are conditional on a phase existing: grant-guards.mjs:223 `if (plan.phase) { … }` — a null-phase plan skips BOTH the phase-halt check and the phase-budget projection. What still governs it: the quarantine fence (grant-guards, above :223), the storage projection (`d6StorageProjection` → `storage_boundary`, :253-254), the monthly settings cap, and the quota guard with cohort bounding. That residue — cap/quota/storage only — is the scoping package's Q1 finding, now traced to its exact branch.

So: today, any of the six unonboarded library books, submitted from the app with no phase, would be admitted and would generate unbudgeted. The GO wording cannot close this (the ruling, S1: *"Do not claim technical enforcement based solely on GO wording"*). §1.2 designs the closure.

### 1.2 E1 — The enforcement design (RECOMMENDED)

**The change, stated at the smallest true scope**: one branch in one function. In `admitPhaseRegistry` (generation/service.mjs), the fall-through case — registry established, the book has NO binding row (`own === null`), and the caller named NO phase (`callerPhase === null`) — returns a refusal instead of an unbudgeted admission, **when the construction is enforcement-bound**:

```
    // E1 (S1 enforcement): in an enforcement-bound construction, a
    // book with no registry row may not submit unbudgeted. The
    // per-book-budget policy (Q1 ruling) is enforced HERE, at the
    // only admission gate, on the row already read above.
    if (enforcePhasePolicy)
      return { ok: false, reason: "book_not_onboarded" };
    return { ok: true, phase: null };
```

Design facts, each source-checked:

- **The read the check performs is already performed.** `phaseBindingForBook(coord, bookId)` runs at the head of `admitPhaseRegistry` for every admission; the branch is reached only when it returned null. E1 introduces **no new read, no new table, no new surface** — it changes the verdict on a value already in hand. The read is synchronous in the coordinator's SQLite (the same class as every other admission read), so admission's shape and timing are unchanged.
- **The refusal name** is `book_not_onboarded` (PROPOSED name, for Rowan to fix): it says what is true — the book is not onboarded — and sits in the existing refusal family (`phase_required`, `phase_unbound`, …). The client surfaces the server's reason string; no client change is needed or proposed.
- **Fail-closed on read error, by construction.** If the registry read throws, the exception propagates out of `admitPhase`/`submitIntent` BEFORE any plan or ledger write (admission is the first state-touching step, §1.1.1) — the intent errors, nothing is created. This is the same throw law the grant guard documents for its own reads (*"propagates … and no grant issues — a refusal, never a silent pass"*). E1 adds no catch, no default, no coercion: an unreadable registry can never produce an admission.
- **Forever Pucked is unaffected.** FP has a registry row; its branch (`own` non-null) is untouched. Its submissions derive the phase exactly as today.
- **Scope is NEW INTENT ADMISSION only — by construction, not by discipline.** `admitPhase` has exactly ONE call site in the tree (service.mjs:861, inside `submitIntent`). The driver, the grant path, repair follow-ons, and plan resumption never re-run admission: a stored plan carries its phase, and the §5 state matrix's AUTO / RE-TESTED rows describe driver behavior over stored plans, which this change cannot reach. A plan admitted before the deploy keeps the phase it was admitted with. The parked Chapter 3 job (Q3, preserved) is a job, not an intent; untouched.
- **Eligibility quotes are unaffected — deliberately.** The quote surface does not pass through `admitPhase` (it is advisory; it authorizes nothing). Quotes for unonboarded books MUST remain available: the onboarding procedure's figure step (§4.4 of the package) is computed from a fresh whole-book quote for a book that is by definition not yet onboarded. E1 refuses generation, not information.
- **Legacy/direct constructions are byte-identical in behavior.** The refusal is gated on `enforcePhasePolicy`, which is false for every direct construction (the construction default is `"legacy"`, service.mjs:201) — including every test fixture and the legacy D6 suites that stage unbudgeted books in registry-free databases under Rowan-sanctioned fixture behavior. Only the production construction (enforce, unconditionally) changes. Enforcement-mode test constructions exist in the tree's lineage (`genpkg1-phase-enforce.test.mjs` pattern) and are where the new cases land (§1.3).
- **No new empty-result hazard.** The branch rides the EXISTING `phaseBindingForBook` null return, produced by `coord._oneOrNull` — the throw-safe reader. E1 introduces no `.one()` call and no new empty-result path, so the standing harness/real-DO `.one()` divergence is not engaged by this change.

### 1.3 Build and test shape

- **Build**: the single branch above in `generation/service.mjs`, composed into the turn-on build on the composed-tree lineage (the live build `fdb02395…` tree plus this branch — the deploy delta is one function in one file, reviewable at a glance). No other file changes. In particular: no change to phase-policy.mjs, grant-guards.mjs, gen-constants.mjs, the entry, or any route.
- **Tests** (named intents, on the enforcement-suite pattern + the standing batteries):
  - T-E1a: enforce construction, registry established, unbound book, null phase → refused `book_not_onboarded`; zero plan rows, zero ledger movement, zero watermark movement (the §1.1.1 invariant, asserted).
  - T-E1b: enforce construction, bound book (the FP shape) → admitted with the derived phase, byte-identical behavior to the pre-change tree (the FP-unaffected regression).
  - T-E1c: enforce construction, unbound book claiming a budgeted phase → the existing refusals unchanged (`phase_bound_to_other_book` / `phase_unbound` / `phase_not_budgeted`).
  - T-E1d: LEGACY construction, registry established, unbound book, null phase → still admitted phase-null (the sanctioned fixture behavior is preserved — the gate on `enforcePhasePolicy` is itself under test).
  - T-E1e: bootstrap window unchanged: enforce construction, registry EMPTY → `phase_binding_required` still fires first (the E1 branch is unreachable there, and the test proves the ordering).
  - T-E1f: registry read failure (fixture fault injection at the binding read) → the intent errors, no plan is created (fail-closed, §1.2).
  - The standing batteries (containment 42, P2, R5A, V-3) re-run on the composed turn-on tree as regression; harness-green is claimed at harness strength only, per standing law — the live proof is the in-gate probe (§1.4).
- **What the build is NOT**: not an onboarding (no budget constant changes, no binding recorded — FP's constant and binding stand as they are); not a registry redesign (decision 1 stands); not a WS2 act.

### 1.4 Deploy sequencing — the gate gains a step, stated plainly

The turn-on gate's sequence becomes: **census (on the live build) → enforcement deploy → post-deploy verification → halt lift → queue unpause → smoke → soak**. Consequences, none minimized:

1. **The deploy happens under the holds.** At deploy time GENERATION_HALT is still `"1"` and the queue still paused: the new build serves no generation while the gate verifies it. The standing deploy discipline applies whole: parts manifest-compared to the candidate tree, the etag captured after upload, observability re-checked and re-applied if the upload reset it, the rollback floor law unchanged (the rollback target for this deploy is the census build `fdb02395…`, itself above the permanent floor).
2. **Post-deploy verification, before any lift** (all read-only except the one named probe):
   - capabilities + health read back the new build identity; phases render unchanged (FP present, budget 13,500,000, binding link intact); containment NORMAL; the P-predicates re-run against the new build where they name state (P-3..P-12 as applicable) — a deploy that moved any of them stops the gate.
   - **The refused-intent probe (the live proof)**: exactly ONE intent, submitted by the executor through the client connector, for a named unonboarded library book (named in the GO at presentation; any of the six), null phase, chapter scope — expected and REQUIRED outcome: rejection `book_not_onboarded`. Zero state movement is then verified (plans list unchanged, watermarks unchanged, phase accounting unchanged). This probe is a SubmitJob-class command and is the GO's single named exception to its no-Wren-submission bar (§5); it is counted in the gate's acts. It is safe by the source invariant (§1.1.1): a rejected admission creates no plan and moves no ledger state — the probe cannot spend, reserve, or generate. If the probe is ADMITTED, or refused under any other reason, or any state moved: STOP, the gate ends HELD, and the deploy is dispositioned under the standing rollback rules before anything else is contemplated.
   - No FP probe is needed pre-lift: the smoke itself is the FP admission proof, and if FP admission were broken the smoke would fail closed at submission (a phase refusal, no spend) inside the gate's observation.
3. **Counted acts grow.** The gate's production acts are now: the deploy upload (1), the verification probe (1 command), the halt lift (1), the queue unpause (1) — plus the re-hold pair (2) on any abort path. The GO wording at §5 counts them expressly.
4. **§3 of the design package is corrected** (§1.6 below): "No code deploy" is struck. WS1's critical path is no longer governance-only; it is one small build on the critical path, gated and reviewed like every build in this program. The package's §4.5 recommendation language ("keeps the turn-on gate itself code-free") is likewise struck wherever the conformed documents rely on it — onboarding's own micro-deploys were always code acts; the turn-on gate now has one too.

### 1.5 E2 — Configuration-only alternatives: re-verified NONE

Rowan's alternative (a configuration-only prevention) was re-checked against the current source, as the scoping package first established: (a) the settings record carries no per-book structure and the guard never reads settings for budgets — there is no settings key that gates admission per book; (b) the only allowlist in the tree is the LANE allowlist (`D6_LANE_ALLOWLIST`, gen-constants.mjs:9) — no book-keyed configuration exists anywhere; (c) `OPALREADER_PHASE_POLICY` selects enforce/legacy only — enforce is already the production construction, and it does not contain an onboarding check (that absence is precisely the gap); (d) the binding registry cannot be used as the prevention by itself — recording bindings is onboarding, and the registry's presence does not change the null-phase fall-through for books without rows. **No configuration-only prevention exists in the deployed source. E1's one branch is the minimal technical prevention.**

### 1.6 E3 — The fallback risk decision (NOT the recommendation)

If Julie declines the E1 build, S1's other named path is an explicit, narrowly scoped risk decision, drafted here so the choice is real and its boundaries are written down. It is NOT recommended: it leaves a policy that exists only as an undertaking, on a system whose entire design history argues for server-side enforcement.

- **Scope of the accepted exposure**: with the holds lifted and no E1, a submission for any unonboarded book, from Julie's app (the only client path; the client token is Julie's), would be admitted phase-null and generate under the monthly cap, the daily quota, and the storage projection alone. No other actor holds a submission path (operator routes cannot submit client intents; Wren submits nothing but the gate's named acts).
- **Compensating controls that would have to hold, as GO predicates**: (i) Julie's undertaking, recorded in the GO, to submit only onboarded books; (ii) the daily check's unexplained-plan rule sharpened for this decision: ANY plan whose book is not onboarded — whatever its phase — is a NORMAL-OPS-ANOMALY on sight and a T-1 trigger evaluation the same day; (iii) the turn-on's validity is tied to the decision: if an unonboarded-book plan is ever observed, the turn-on gate's declaration path is void until Rowan dispositions it.
- **What E3 does not do**: it does not make the exposure zero, bounded per book, or technically detected before spend begins (detection is daily, after the fact, though the cap/quota bound the maximum one-day exposure). Those are the reasons it is the fallback, not the recommendation.

### 1.7 Struck text and replacements (mechanics)

The design package §3's closing paragraph —

> "No code deploy. No settings-record write. No containment transition. The settings record's legacy `geminiLane` key is non-operative (Q8 PASS) and is touched by nothing in this package."

— is struck and replaced by:

> "One code deploy — the S1 enforcement build (§1 of the correction) — precedes the two acts below, performed under the holds and verified before any lift. No settings-record write. No containment transition. The settings record's legacy `geminiLane` key is non-operative (Q8 PASS) and is touched by nothing in this package."

And §8's skeleton sentence —

> "The gate's skeleton is as accepted in principle: census → halt lift → queue unpause → a bounded Julie-submitted Standard smoke → a seven-day soak → execution record → Rowan review → declaration."

— is struck and replaced by:

> "The gate's skeleton is as accepted in principle, with the S1 step inserted: census → S1 enforcement deploy + post-deploy verification (incl. the refused-intent probe) → halt lift → queue unpause → a bounded Julie-submitted Standard smoke → a seven-day soak → execution record → Rowan review → declaration."

(§4.5's "keeps the turn-on gate itself code-free" is struck wherever relied on; the recommendation of O1 is unaffected — O1's own per-book deploys were always code acts under their own micro-gates.)

---

## 2. S2 — Smoke failure and timeout semantics

The design package's §8.3 failure handling read, in full:

> "**Failure handling**: the sliding ≥35-minute no-progress stall test (Gate 4 law) governs observation; on a declared stall Wren observes and reports — no act beyond §7 — and the gate record carries the stall for Rowan. A policy_block outcome is NOT a failure (the F3 recursive split is design behavior; the resume's own segment completed exactly that way). A provider/platform fault during the smoke: WAIT (standing law), the plan parks or waits by its own machinery, and the smoke's clock is a reporting matter, not a retry license."

That paragraph is struck and replaced by §§2.1–2.5 below. What it got right is preserved (policy_block is not a failure; a platform fault is WAIT, never a retry license); what it lacked — a decision bound, terminal classifications, a failure disposition — is now defined.

### 2.1 The maximum observation/decision interval

- The smoke's clock starts at **Julie's submission** (the plan's creation read-back).
- The **sliding ≥35-minute no-progress stall test** (Gate 4 law) runs throughout and can declare a stall at any time — a stall declaration is a decision point (§2.2), not merely a report.
- **Hard decision bound: 4 hours from submission (PROPOSAL parameter, for Rowan to fix).** By the bound, the executor must land one of the three terminal classifications at §2.2 — on the evidence then standing. The bound is a decision deadline, not a success deadline: it forces a disposition, never a claim. Sizing basis, at design strength: the program's observed Standard generation (Gate 4's 15 policy-heavy segments completed inside one observed run; the resume's single segment completed ≈ 8 minutes after unpause including the cold start) puts a 20-segment chapter's ordinary completion far inside 4 hours; a smoke still incomplete at 4 hours is therefore evidence of stall or fault, not of ordinary latency. The one force that can consume hours is a platform fault — and a fault is handled by classification (§2.2(c)), not by silently extending the bound.

### 2.2 Terminal classifications (exactly one lands, in the gate record)

- **(a) SMOKE COMPLETE** — the plan reaches its full §8.3 completion-evidence set (done 20 / failed 0 with any failed entry individually explained, job complete, exactly the expected new bindings, the recorder discipline clean) inside the bound and no stall stands declared. Only this classification can proceed to the soak-entry evaluation (§2.4).
- **(b) SMOKE FAILED** — any of: a stall declared under the sliding test and not recovered by the decision bound; the plan incomplete at the decision bound for any reason other than (c); a §7 trigger firing during the smoke (§2.3); the completion-evidence set unattainable (e.g., an R-06 recorder discrepancy — also T-4); Julie withdrawing the smoke. A failed smoke is a failed GATE ATTEMPT (§2.3's disposition), full stop.
- **(c) SMOKE SUSPENDED-BY-FAULT** — at the decision bound, a platform fault of the 1101 class is verified in progress on the read surfaces (the standing signature: /health 200 while DO-backed /v2 routes fail), or such a fault consumed the interval such that the evidence cannot distinguish stall from fault. The gate PAUSES: no classification of the plan itself, no soak, no retry; the holds stay exactly as they are (lifted — the fault is not a safety event, and re-holding into a fault would repeat the program's standing WAIT law error); the gate re-convenes only on Julie's word after the fault clears, with a fresh decision interval for the still-standing plan or a fresh smoke, as Julie and Rowan direct. Suspension is a named state in the record, never an unmarked overrun of the bound.

### 2.3 Conditions requiring emergency re-hold during the smoke — and the failure close

- **Emergency re-hold (§7.3's pair) is required** when any §7 trigger, as refined at §3 of this correction, FIRES during the smoke — the same law as the soak (the gate's A2 incorporation already applied §7 from the moment of the halt lift; this correction makes the smoke's instance explicit). Julie's word requires it at any time, trigger or none.
- **A declared stall, by itself, does not fire the re-hold** — the stalled plan parks under its own machinery and cannot spend while parked; the disposition is §2.3's failure close below, taken as a gate act, not an emergency act.
- **The failure close (DEFAULT, PROPOSED for ruling)**: on SMOKE FAILED, the gate attempt ends and the executor runs the re-hold pair (re-pause, then re-halt — §7.3's order and verifications) as the attempt's closing acts, then files the failure record. Rationale: a failed smoke has not earned a turned-on system, and the program's standing posture is that an unproven state returns to HELD rather than idling in an unplanned configuration. **Julie may countermand at the time** (her word, in the moment, directs the system to stay on for diagnosis or any other reason) — the default binds the executor, never Julie.
- **The incomplete plan's disposition**: it is left EXACTLY as it stands — no plan command, no retirement, no release, no resubmission by anyone. Under the re-hold it is inert (its state is whatever the matrix says it is: a stalled chapter plan stands `active` or parked per its guards, RE-TESTED/AUTO under the matrix if normal operations is ever declared by a later gate). Its incompleteness is recorded with its plan id and totals in the failure record; nothing about it is silently carried into any later attempt — a later turn-on gate re-censuses it as a non-terminal plan under P-5 and it receives its own disposition there.

### 2.4 The soak-entry predicate — the complete evidence set, all of it, first

The seven-day soak clock starts ONLY when every item below stands verified, recorded as the gate's SOAK-ENTRY predicate set:

1. SMOKE COMPLETE (§2.2(a)) with the full §8.3 completion-evidence set in the record;
2. **The accounting check on the smoke**: the settled delta reported in the three-line form against the chapter's quote; quota reconcile `ok: true` with no new drift; no reservation of the smoke plan surviving its terminal state (the reservation-leak check, run at completion and again at soak entry);
3. **Julie's playback acceptance of the smoke chapter, recorded** (her confirmation in chat, recorded on the board — the Gate 4 / resume pattern);
4. **The normal-operations observation arrangement verified active** in the §4.4 form (definition read-back + check #0 logged + first-run terms) — the arrangement must exist before the period it observes;
5. **P-14 closed** (the OQ-5 duty verified and terminated, §4.5) — already a census predicate; re-affirmed here because the soak may not begin while a predecessor duty is open.

If any item cannot be verified, there is no soak start and no partial start: the gate record states which item failed, and the path forward is Julie's and Rowan's, not the executor's inference.

### 2.5 The no-silent-transition rule, as a gate predicate

Restated as the ruling requires, in predicate form: **no state of the smoke other than SMOKE COMPLETE + the full §2.4 set transitions into the soak; no soak outcome other than the full A6 set (as amended at §4.3) transitions into a declaration of normal operations; every other path ends in a named state (FAILED-and-re-held, SUSPENDED-BY-FAULT, or TURNED ON UNDER OBSERVATION with the soak still running) recorded in the gate record.** An unresolved smoke — one whose classification is not yet landed — holds the gate in the smoke phase indefinitely until it lands or Julie directs otherwise; the passage of time is never itself a transition.

---

## 3. S3 — Emergency trigger refinements

The design package's §7.2 trigger table is replaced in full by the table at §3.2. The struck table (verbatim, for the record) is:

> | # | Trigger | Objective check (surface) |
> |---|---|---|
> | T-1 | **Foreign / unexplained dispatch** — provider dispatches or settled movement with no plan explaining them | `GET /v2/quota` (`providerDispatchesToday` > 0) or a phase settled delta, against `GET /v2/d6-plans` showing no non-terminal or newly-terminal plan that accounts for them (§6.3(a)'s backstop) |
> | T-2 | **Loop signature** — a plan burning the day without producing: ≥ 100 provider dispatches in one PT day (the cap itself) with zero new bindings in the same window | Quota read + bindings watermark (`GET /v2/sync/changes?family=bindings`) |
> | T-3 | **Reconcile drift** — `reconcileQuota.ok === false` or a drift list beyond the sole known adjudicated straddler | `GET /v2/d6-quota-reconcile` (operator) |
> | T-4 | **R-06-class recorder discrepancy** — an in-set accounting transition with the expected recorder row missing at the A-7 observation point (the transition's poll + one further complete poll) | Drive recorder (`drive=1`) against plan/job accounting reads |
> | T-5 | **Conflicts change** — the conflicts set differs from the four baseline `schedule_dead` rows | `GET /v2/conflicts` |
> | T-6 | **Storage boundary pressure** — recorded base + D6 bytes ≥ 95% of the 10 GB free-tier boundary (PROPOSAL figure), or `storage_boundary` refusals appearing across successive passes for multiple plans | Storage accounting surfaces; drive outcomes (`parked_storage`) |
> | T-7 | **Containment deviation** — containment state ≠ NORMAL, or any containment field inconsistent with the baseline, not commanded under an authorization | `GET /v2/d6-containment` (both surfaces) |
> | T-8 | **Hold-state inconsistency** — capabilities/health generationState inconsistent with the last authorized hold state (e.g., `halted` while turn-on stands and no re-hold was commanded; or `enabled` after a re-hold's verified read-backs) | Capabilities + health |
> | T-9 | **Provider-fault storm** — ≥ 10 consecutive provider-error-class attempt outcomes across plans in one PT day with zero successes (PROPOSAL figure) — the 1101 lesson: do not keep feeding a platform fault | Attempt diagnostics across the day's plans; quota reads |

What the ruling requires and this section adds: for every trigger, (i) the reliable evidence source named as a surface set, and (ii) the consequence when that source is UNAVAILABLE; and for T-8, the two-stage lag-vs-failure protocol (§3.3). §7.1's authority (Julie's unlimited general authority; Wren's narrow preauthorized form), §7.3's two-act procedure, §7.4's immediate reporting, and the fresh-Julie-GO rule for any re-turn-on are PRESERVED unchanged — the ruling accepted them; this section refines only the trigger evaluations.

### 3.1 The unavailable-source law (applies to every trigger)

- A trigger whose evidence source cannot be read evaluates **UNKNOWN — never PASS, never "no fire"**. Silence of a surface is not evidence of safety on a live system.
- **During the smoke**: an UNKNOWN on any trigger whose source is authoritative for the completion evidence (T-1, T-3, T-4, T-5, T-7) means the evidence set is incomplete → the smoke cannot be classified COMPLETE; at the decision bound it classifies FAILED (evidence-incomplete) or SUSPENDED-BY-FAULT (if the unavailability carries the 1101 signature). UNKNOWN triggers are reported in the gate record by name.
- **During the soak**: a daily check with an unreadable authoritative source is NOT a clean day (§4.1 — missed-read handling applies: the soak extends). The same authoritative source unavailable on TWO CONSECUTIVE checks is a NORMAL-OPS-ANOMALY with same-day escalation to Julie. Unavailability alone never fires a re-hold — with one exception: T-8, where the authoritative surfaces ARE the holds (§3.3(b)).
- A surface returning a READABLE ERROR SHAPE (a route refusing, a reconcile reporting `ok: false`) is not "unavailable" — it is evidence, evaluated by the trigger's own rule. Unavailability means: no trustworthy value could be obtained (transport failure, 1101-class 500s, malformed payload).

### 3.2 The refined trigger table

| # | Trigger | Reliable evidence source | Evaluation rule (fires when) | Source-unavailable consequence (§3.1 applied) |
|---|---|---|---|---|
| T-1 | Foreign / unexplained dispatch | `GET /v2/quota` (`providerDispatchesToday`) + per-phase accounting + `GET /v2/d6-plans` | Dispatches > 0 or a settled delta exists that no non-terminal or newly-terminal plan accounts for | Quota or plans unreadable → UNKNOWN; smoke: blocks COMPLETE; soak: day not clean; both unreadable at one check → ANOMALY same day |
| T-2 | Loop signature | `GET /v2/quota` + bindings watermark (`GET /v2/sync/changes?family=bindings&sinceSeq=<last>`) | ≥ 100 dispatches in one PT day with zero new bindings in the window | Either unreadable → UNKNOWN (the signature is a conjunction; a half-read signature is no signature); soak: day not clean |
| T-3 | Reconcile drift | `GET /v2/d6-quota-reconcile` (operator, paginated, complete walk) | `ok === false`, or drift beyond the sole adjudicated straddler `att-37d63768…` | Route unreadable or walk incomplete → UNKNOWN (a partial walk is not a reconcile); smoke: blocks COMPLETE; soak: day not clean; two consecutive → ANOMALY |
| T-4 | R-06 recorder discrepancy | Drive recorder (`GET /v2/d6-diagnostics?drive=1`) against plan/job accounting reads | An in-set accounting transition lacks its expected recorder row at the A-7 observation point (transition poll + one further complete poll) | Recorder unreadable → the observation point cannot be met: during the smoke, any accounting transition in that window is UNVERIFIED → blocks COMPLETE and is reported as a discrepancy-class finding (the recorder is also P-12's aliveness surface; its failure is itself an ANOMALY) |
| T-5 | Conflicts change | `GET /v2/conflicts` | The set differs from the four baseline rows (ids 1–4, pinned contents) | Unreadable → UNKNOWN; smoke: blocks COMPLETE; soak: day not clean |
| T-6 | Storage boundary pressure | R2 bucket accounting (the weekly free-tier script's read path) + plan-state reads (`parked_storage` outcomes) | Recorded base + D6 bytes ≥ 95% of 10 GB (provisional threshold, accepted decision 8), OR `storage_boundary` refusals across successive passes for multiple plans | R2 accounting unreadable → evaluate on the refusal half alone (plan reads); if plan reads also fail → UNKNOWN; soak: day not clean |
| T-7 | Containment deviation | `GET /v2/d6-containment` (operator surface) AND the `drive=1` projection — two surfaces by design | Either surface reads state ≠ NORMAL, or fields inconsistent with the baseline, not commanded under an authorization | ONE surface unreadable → evaluate on the other, flagged single-surface in the log; BOTH unreadable → UNKNOWN and, because containment state would be unknowable on a live system, ANOMALY with same-day escalation; smoke: blocks COMPLETE |
| T-8 | Hold-state failure | The AUTHORITATIVE pair — script settings binding read (`GENERATION_HALT`) + queue state via cf-api — with capabilities + health as PROJECTIONS | The two-stage protocol at §3.3 (replaces any single-read evaluation) | Per §3.3: an authoritative surface unreadable inside the recheck protocol is itself the failure path (§3.3(b)(iii)) |
| T-9 | Provider-fault storm | Attempt diagnostics across the day's plans (plan diagnostics) + `GET /v2/quota` | ≥ 10 consecutive provider-error-class attempt outcomes across plans in one PT day, zero successes (provisional threshold, accepted decision 8) | Diagnostics unreadable → evaluate on quota/plan outcome reads alone; if no attempt evidence is obtainable at all → UNKNOWN; soak: day not clean |

### 3.3 T-8 rewritten: the two-stage hold-state protocol

The precedent this codifies is the resume gate's own close: at ~03:55Z the first closing capabilities read showed `generationState: "enabled"` while the settings binding and health already read halted; a recheck at 03:58:02Z read `halted` — classified, and accepted by Rowan (Q3 of the execution review, with precision), as isolate projection lag, not a hold deviation. The protocol below makes that judgment mechanical, in both directions (a projection claiming ON after a verified re-hold, or claiming OFF while turn-on stands).

**Stage 1 — detection.** Any disagreement among {capabilities `generationState`, health `generation`, settings `GENERATION_HALT`, queue `delivery_paused`} with the last AUTHORIZED hold state opens the protocol. No single read ever fires T-8.

**Stage 2 — bounded rechecks.** Three rechecks over ten minutes (PROPOSAL parameters, for Rowan to fix), each reading ALL FOUR surfaces. The settings binding and the queue state are AUTHORITATIVE (they ARE the hold mechanisms); capabilities and health are PROJECTIONS of the binding (the execution transient lived in exactly a projection: `service.mjs`'s capabilities read of the isolate env). Classification at the protocol's end — or earlier, the moment an authoritative reading lands:

- **(a) Transient projection lag** — every recheck's authoritative pair agrees with the authorized state, and the disagreement is confined to a projection surface: if the projection converges within the bound → TRANSIENT: logged, reported as NORMAL-OPS-MOVEMENT (or in the gate record, during the smoke), **no re-hold, no trigger fire**. If the projection still disagrees at the bound while the authoritative pair is consistent → the holds stand as the authoritative pair reads them (the system is as held/unheld as authorized); the persisting projection fault is a NORMAL-OPS-ANOMALY (projection fault), escalated the same day; **T-8 does not fire** — re-holding against a consistent authoritative pair would be acting on the broken surface.
- **(b) Authoritative hold-state failure** — ANY recheck in which an authoritative surface reads contrary to the authorized state:
  - (i) **Less-held than authorized** (e.g., after a verified re-hold, the binding reads `"0"` or the queue reads unpaused): SAFETY failure → **emergency re-hold immediately** (§7.3's pair re-asserts both holds), immediate reporting per §7.4, and the state is treated as NOT safely held until the re-assertions verify — if a re-assertion cannot be verified, §7.4's escalation governs.
  - (ii) **More-held than authorized** (during turn-on standing: the binding reads `"1"` or the queue reads paused, with no re-hold commanded): INTEGRITY anomaly — nothing can dispatch, so nothing is unsafe; but the state changed outside authority. Immediate report to Julie; **no act**; the holds are re-lifted only on Julie's fresh direction (never on the executor's inference that it "must have been" a glitch).
  - (iii) **Authoritative surface unreadable** inside the protocol (the settings read or the queue read cannot be obtained at a recheck): the protocol cannot clear → the UNKNOWN is treated as (b)(i) for posture during the SMOKE (decision blocked; the smoke cannot classify COMPLETE; at the bound, FAILED (evidence-incomplete) or SUSPENDED-BY-FAULT on the 1101 signature) and as an ANOMALY with same-day escalation during the SOAK (day not clean). It does not by itself fire the pair — acting blind is its own hazard — UNLESS a readable authoritative surface independently shows (b)(i).

**Preserved, expressly**: any emergency re-hold under T-8 or any trigger is reported immediately (§7.4), and any re-turn-on afterward requires Julie's FRESH GO through a new gate (§7.1). The recheck protocol consumes minutes, never authority: it classifies; it does not forgive a real failure, and it does not manufacture one from a lagging projection.

---

## 4. S4 — Soak auditability

### 4.1 The clean observation day, defined

A soak day is a **CLEAN OBSERVATION DAY** only when ALL of the following stand in the `normal-ops-daily-check` log for that day:

1. The daily check ran and completed (not merely started);
2. **Every** surface of the §8.5 check set was read successfully: capabilities; health; containment on both surfaces; the recorder tail; the plans list; quota; the reconcile walk (complete, paginated); per-phase accounting for every budgeted phase; conflicts; the bindings watermark;
3. The accounting checks of §8.5 were completed against those reads (settled matched to named plans; the aging flag evaluated; the reservation-leak check evaluated; month-to-date vs the cap trajectory);
4. A classification (NORMAL-OPS-QUIET / MOVEMENT / ANOMALY) was recorded with its timestamp and the day's salient values.

Any surface unreadable, any check unevaluated, or any classification unrecorded → the day is a **MISSED-READ DAY**, not a clean day. There is no partial credit: a day that cannot be fully observed does not count toward the seven.

### 4.2 Missed-read handling

- A missed-read day **extends the soak day-for-day** (accepted decision 8) — the seven required days are seven CLEAN days, consecutive or not, but see the pause rule below.
- **The make-up obligation**: the next completed check must explicitly cover the gap interval — watermarks, counters, and phase figures compared against the LAST CLEAN day's recorded values, so movement inside the gap is retrospectively accounted for and named in that check's classification. (Residual, stated: intraday transients inside a missed interval — a reservation that opened and closed within the gap — are unobservable in principle; the soak's accounting is day-granular, as designed, and the correction does not pretend otherwise.)
- **Two consecutive missed-read days** = NORMAL-OPS-ANOMALY with same-day escalation to Julie, and the soak clock PAUSES (no further days can accrue, clean or otherwise) until a clean day lands. The pause is an observation state, not a hold change: the holds stay as authorized, and no generation right is affected by the pause itself — but no declaration can be built on paused time (§4.3).

### 4.3 Anomaly deadlines and the disposition of unresolved findings

- **Acknowledgment**: every NORMAL-OPS-ANOMALY is reported to Julie the same day it is classified (the design already required this; it is now a deadline, not a habit).
- **Disposition deadline: 24 hours from the report (PROPOSAL exact, for Rowan to fix).** A finding is DISPOSITIONED only by a written disposition — Julie's decision, or Rowan's ruling relayed of record — naming its resolution or its accepted standing (an anomaly that fired and was dispositioned in writing does not bar declaration; the design's A6.4 already said so — this correction gives the standing a deadline and a paper form).
- **Undispositioned at 24 hours** → the finding escalates (to Rowan via Julie, with the finding's full evidence) AND the soak PAUSES in place (holds untouched — §8.4's early-end terms) until the disposition lands. A paused soak resumes its count where it stopped once disposition is recorded and a clean day lands.
- **Unresolved accounting findings at soak end BLOCK the declaration.** Design A6 items 3–4 —

> "3. End-of-soak accounting is clean: reconcile `ok`, no unresolved aging flags, no reservation leaks, every settled unit of the soak explained by a named plan.
> 4. No NORMAL-OPS-ANOMALY stands unresolved at declaration. (An anomaly that fired and was dispositioned in writing does not bar declaration; an emergency re-hold during the soak VOIDS the soak — declaration then requires a fresh turn-on gate after Julie's fresh GO, never a resumed soak. PROPOSAL, for ruling.)"

— are conformed to read, in substance: *clean* means every finding either resolved or dispositioned in writing under the 24-hour rule; **no finding carries past the declaration silently** — a finding Julie wishes to carry (e.g., an aging estimated-unverified item she accepts as standing, like the FP straddler's 19,018, already reported as standing at §8.5) must be NAMED in the execution record as carried-by-disposition, with her words cited; anything else undispositioned at the soak's seventh clean day extends or pauses the soak under the deadline rule rather than expiring quietly. An emergency re-hold during the soak still VOIDS the soak (accepted decision 8), unchanged.

### 4.4 The observation arrangement verified active before the soak begins — without deadlock

The design's §8.5 setup sentence —

> "Setup verified threefold at the turn-on gate's close, on the OQ-5 precedent (definition read-back quoted in the execution record; a manual check #0 logged; the first scheduled run's log confirmed before the arrangement is called established — if setup cannot be established as specified, the gate record returns for review rather than claiming the condition discharged)."

— left a sequencing trap: if the first scheduled run must be confirmed BEFORE the soak, and the run happens daily at ~18:28 ET, a soak accepted at the wrong hour could wait a day for its own permission to start. The correction resolves it by splitting "verified active" into what must precede the soak and what the soak's first day must prove:

- **Before the soak clock starts (soak-entry predicates, joining §2.4)**: (i) the `normal-ops-daily-check` job created and its definition READ BACK and quoted in the execution record (schedule, read-only check set, classifications, log path); (ii) a manual check #0 run and logged (its classification recorded; expected QUIET or MOVEMENT-fully-explained in the smoke's aftermath); (iii) the job's next scheduled run time read back and confirmed to fall inside the soak's first day. Items (i)–(iii) ARE "verified active" for soak entry — the arrangement demonstrably exists, has run once by hand, and is scheduled to run inside the observed period.
- **On soak day 1 (a day-1 predicate, not a start blocker)**: the day-1 check evaluation includes confirming the first SCHEDULED run fired and logged. If it did not: day 1 is NOT a clean day, the failure is a NORMAL-OPS-ANOMALY (arrangement fault), the arrangement is repaired and re-verified (a fresh check #0) before any day can be clean, and the soak's count effectively restarts its accrual on repaired footing — the soak is never declared on an arrangement that only ever ran by hand. If setup under (i)–(iii) cannot be established at all, §2.4's rule applies: no soak start; the gate record returns for review rather than claiming the condition discharged.

### 4.5 P-14 — its evidence, defined; its status at drafting

Design §8.1's P-14 row —

> "| P-14 | OQ-5 CLOSED: the post-gate watch's leg (iii) verified from its first scheduled run's log, and the watch terminated per its terms (Rowan's acceptance already given) — the turn-on gate may not proceed while that duty is still open (Q7's condition) | Exact precondition. Pending at this package's drafting (the first scheduled run is 2026-11-06 18:28 ET); by gate time it must read verified-and-terminated, else STOP until it does |"

— stands as a predicate; S4 requires its EVIDENCE be named, and it now is. **P-14 passes on exactly two artifacts**: (a) the first-scheduled-run entry in the post-gate watch's own log (`~/workspace/goals/opal-roundtable/hidden_files/phaseb-resume-postgate-log.md`) for the run of **Fri 2026-11-06 18:28 ET**, read and quoted in the turn-on execution record with its classification (POST-GATE-QUIET expected; any other classification dispositioned before P-14 can pass); and (b) the **termination act** of record: the watch job disabled after that verification, per its terms (Rowan's acceptance of the resume execution record — the termination trigger — was given in her execution review, verbatim board 6686319232), with the disabling recorded in the same log or the gate record. **Status at this correction's drafting: leg (iii) is due tonight (2026-11-06 18:28 ET) and stands PENDING** — the correction asserts nothing about it; P-14 is evaluable at gate time on the two artifacts above, and passes or stops the gate exactly as its drift rule already says.

---

## 5. The conformed GO passage — for Rowan's final readiness review (NOT for presentation)

The design package's §9 wording is struck in full. The struck text:

> "GO — execute the Standard turn-on gate under the revised design as pinned at `<DESIGN-PIN>`: a fresh execution census against the fifteen A1 predicates (the script etag captured and saved as an evidence artifact before any lift; containment NORMAL; conflicts exactly the four baseline rows; the five baseline plans all terminal and none held; the parked Chapter 3 job `parked_policy` revision 1, untouched; settings revision 1; quota reconcile ok with the sole known straddler; phase figures and sync watermarks at their design values; the recorder alive with a standing registration; the smoke chapter's quote reproduced; and the OQ-5 post-gate duty verified closed and its watch terminated) — any predicate failure or unexplained movement stops the gate before any act and returns for ruling; then exactly two counted production acts, in order: one halt lift (the metadata-only envelope flip of `GENERATION_HALT` to `"0"`, all script parts byte-identical to the live build, etag and observability verified after) and one queue unpause (cf-api, read back); then the bounded smoke — I submit Forever Pucked Chapter 4 (chapter scope, `keepGoing` off, Standard lane, phase forever-pucked; expected 20 segments ≈ 375,535 units) from my own app, or another single chapter I name when I give this GO — observed read-only under the sliding 35-minute stall test and the A-7 recorder discipline, its completion evidence the full A3 set (plan done 20/failed 0, exactly 20 new bindings, watermark 1862, the three-line exposure report), and my playback of the chapter as its acceptance, outside the executor's verdict; then a seven-day soak from the accepted smoke, during which I may submit further Standard intents for onboarded books (Forever Pucked) inside their phase budgets, under the soak restrictions (no Batch, no mid-soak onboarding, no settings writes, no operator-route acts, no deploys except under separate authorization) and the daily `normal-ops-daily-check` observation (owner Wren; QUIET / MOVEMENT / ANOMALY classifications; the accounting checks as designed); the emergency re-hold standing throughout — Julie's word at any time, or Wren's preauthorized act on any of the nine enumerated triggers — executed as exactly two verified acts (re-pause, then re-halt) with immediate reporting, after which any re-turn-on needs my fresh GO through a new gate; **NO Batch arming or Batch act of any kind, NO book onboarding (no budget deploy, no phase-binding record), NO quarantine release, NO plan retirement, NO adjudication or reconcile act, NO settings write, NO SubmitJob by Wren, NO containment transition**; on success the gate ends TURNED ON UNDER OBSERVATION — the holds stay lifted by design — and normal operations are declared only on the full A6 set (the accepted smoke, a complete clean soak, clean end-of-soak accounting, no unresolved anomaly, the filed execution record with Rowan's acceptance, and my confirmation of the app experience), never on the smoke alone; on any abort after the lifts the re-hold pair runs, the gate ends HELD, and the soak is void. I understand the per-book budget law stands (Q1): only Forever Pucked is onboarded; any other book requires the onboarding procedure under its own authorization before it can generate."

The conformed replacement — same skeleton, with S1's enforcement step and probe, S2's smoke semantics, S3's refined triggers (incorporated by their corrected text), S4's auditability, and the corrected act count:

> "GO — execute the Standard turn-on gate under the revised design as pinned at `<DESIGN-PIN>`, as corrected at `<CORR2-PIN>`: a fresh execution census against the fifteen A1 predicates (the script etag captured and saved as an evidence artifact before any act; containment NORMAL; conflicts exactly the four baseline rows; the five baseline plans all terminal and none held; the parked Chapter 3 job `parked_policy` revision 1, untouched; settings revision 1; quota reconcile ok with the sole known straddler; phase figures and sync watermarks at their design values; the recorder alive with a standing registration; the smoke chapter's quote reproduced; and the OQ-5 post-gate duty closed on its two named artifacts — the first scheduled run's log entry and the termination record) — any predicate failure or unexplained movement stops the gate before any act and returns for ruling; **then the S1 enforcement step**: one deploy of the enforcement build (the single `admitPhaseRegistry` branch, `book_not_onboarded`, gated on the enforcement construction; all other parts byte-identical to the composed candidate; etag and observability verified after; the gate still HELD throughout), post-deploy predicates re-verified, and exactly one verification intent submitted by Wren for a named unonboarded book, null phase, REQUIRED to be refused `book_not_onboarded` with zero state movement verified after it — the sole exception to this GO's no-Wren-submission bar, and if the probe is admitted or moves anything, the gate stops and ends HELD; then exactly two further counted production acts, in order: one halt lift (the metadata-only envelope flip of `GENERATION_HALT` to `"0"` against the enforcement build, all script parts byte-identical to it, etag and observability verified after) and one queue unpause (cf-api, read back); then the bounded smoke — I submit Forever Pucked Chapter 4 (chapter scope, `keepGoing` off, Standard lane, phase forever-pucked; expected 20 segments ≈ 375,535 units) from my own app, or another single chapter I name when I give this GO — observed read-only under the sliding 35-minute stall test and the A-7 recorder discipline, **inside a four-hour decision bound from my submission**, landing exactly one classification: COMPLETE (the full A3 evidence set: plan done 20/failed 0, exactly 20 new bindings, watermark 1862, the three-line exposure report), FAILED (a declared stall, incompleteness at the bound, a fired trigger, or an unattainable evidence set — the gate attempt ends and the re-hold pair runs as its failure close unless I direct otherwise at the time, the incomplete plan left exactly as it stands), or SUSPENDED-BY-FAULT (a verified 1101-class platform fault — the gate pauses, holds untouched, and re-convenes only on my word); and my playback of the chapter as the smoke's acceptance, outside the executor's verdict; then — only when the soak-entry set stands complete (the smoke COMPLETE, its accounting check clean, my playback acceptance recorded, the observation arrangement verified active in its three soak-entry items, P-14 closed) — a seven-day soak of seven CLEAN observation days (a missed-read day extends the soak day-for-day and is covered by the next check's gap comparison; two consecutive missed days, or any anomaly undispositioned 24 hours after its report, pause the soak in place until disposition), during which I may submit further Standard intents for onboarded books (Forever Pucked) inside their phase budgets, under the soak restrictions (no Batch, no mid-soak onboarding, no settings writes, no operator-route acts, no further deploys except under separate authorization) and the daily `normal-ops-daily-check` observation (owner Wren; QUIET / MOVEMENT / ANOMALY classifications; the accounting checks as designed, with unresolved findings blocking any declaration unless I disposition them in writing, named in the record); the emergency re-hold standing throughout — my word at any time, or Wren's preauthorized act on any of the nine enumerated triggers as refined (every trigger evaluated on its named evidence source; an unreadable source never counts as a pass; T-8 decided only by the bounded-recheck protocol, in which the settings binding and the queue state are authoritative and capabilities/health are projections) — executed as exactly two verified acts (re-pause, then re-halt) with immediate reporting, after which any re-turn-on needs my fresh GO through a new gate; **NO Batch arming or Batch act of any kind, NO book onboarding (no budget deploy, no phase-binding record), NO quarantine release, NO plan retirement, NO adjudication or reconcile act, NO settings write, NO SubmitJob by Wren except the single named verification probe, NO containment transition**; on success the gate ends TURNED ON UNDER OBSERVATION — the holds stay lifted by design — and normal operations are declared only on the full A6 set (the accepted smoke, seven clean soak days, clean-or-dispositioned end-of-soak accounting, no unresolved anomaly, the filed execution record with Rowan's acceptance, and my confirmation of the app experience), never on the smoke alone; on any abort after the lifts the re-hold pair runs, the gate ends HELD, and the soak is void. I understand the per-book budget law (Q1) is now TECHNICALLY ENFORCED by this gate's own deploy: only Forever Pucked is onboarded, an unonboarded book's submission is refused `book_not_onboarded` by the server, and any other book requires the onboarding procedure under its own authorization before it can generate."

Changes from the struck wording, enumerated so Rowan can rule on the delta alone: (1) the S1 deploy + verification + probe inserted as the gate's first acts, with the counted-acts language corrected from "exactly two" to the true set; (2) P-14's evidence named (two artifacts); (3) the smoke gains the four-hour decision bound and the three terminal classifications, the failure close, and the incomplete plan's disposition; (4) soak entry is gated on the five-item set, expressly; (5) the soak is redefined as seven CLEAN days with missed-day, pause, and 24-hour-disposition mechanics; (6) the trigger reference carries the S3 refinements (evidence sources, UNKNOWN law, T-8 protocol with authoritative/projection surfaces named); (7) the no-Wren-submission bar gains the probe's single named exception; (8) the closing Q1 sentence now states enforcement as a fact the gate itself creates, instead of an undertaking.

---

## 6. Remaining open items and authorization boundaries

- **Parameters proposed in this correction, for Rowan to fix**: the refusal reason name `book_not_onboarded` (§1.2); the smoke's four-hour decision bound (§2.1); the T-8 recheck protocol's shape (3 rechecks / 10 minutes, §3.3); the anomaly disposition deadline (24 hours, §4.3); the smoke failure-close DEFAULT (re-hold unless Julie countermands at the time, §2.3). Each is marked PROPOSAL where it stands; none is presented as settled.
- **Carried unchanged from the design package**: OI-2's soak-submission proposal (accepted by the ruling, decision 7); OI-3's provisional thresholds (accepted provisionally, decision 8); OI-4's procedural binding control (conditionally accepted, decision 3 — its irreversibility is a fact of the machinery, now joined by S1's enforcement, which prevents unonboarded generation but does not create an unbind path); OI-5's FP figure disclosure (decision 2 settles it: the figure is Julie's; $13.50 stands).
- **The enforcement build's own gate discipline**: the build is INSIDE this turn-on gate (§1.4), not a separate pre-gate — Rowan's source review of the one-branch delta happens on this correction's review and the gate's census discipline; if Rowan prefers the build split into its own preceding build gate, that is a sequencing ruling hers to make, and the correction is written so the step can be lifted out without redesign.
- **Boundaries**: this correction designs; it implements nothing, deploys nothing, submits nothing, lifts nothing. It does not present the GO. It does not touch Workstream 2 (the B-G2 specification is a separate return). Production remains HELD at NORMAL; staging is untouched; no provider call of any kind was made or is authorized.

— Wren (drafted 2026-11-06; WS1 correction S1–S4, design only, for Rowan's final readiness review)
