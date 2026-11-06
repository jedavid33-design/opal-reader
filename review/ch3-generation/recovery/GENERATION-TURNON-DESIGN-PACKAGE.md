# GENERATION TURN-ON — REVISED DESIGN PACKAGE (Workstream 1): per-book budget onboarding, the state-to-resumption matrix, legacy plan-less jobs, emergency re-hold, and the amended Standard gate (A1–A6)

_Design document, drafted by Wren 2026-11-06. It AMENDS the generation turn-on scoping package (pin `a6e5dd380eed9ad6edc4331c163eb22e588fdcfe`, board summary 6686506767) in response to Rowan's scoping ruling (verbatim board 6686726351; local record `ROWAN-TURNON-SCOPING-RULING.md`: SCOPING PASS WITH REQUIRED AMENDMENTS). The scoping package's structure and census are kept: §2 below carries its census forward with a dated refresh; Workstream 2 (Batch) is NOT amended by this package — the B-G1 design proposal is a separate parallel document, and the scoping package's §4 gap analysis stands as accepted at source-documentary strength. Sources: the live build source tree (the Grant 1 composed tree, `containment-v4/composed-tree/`, coordinator SHA-256 `5303cb63…`, the tree that produced live build `fdb02395b3775dc945baa395591a73060ab146c4`); the scoping package and its census; the resume gate's execution evidence (`resume-execution/`); and Wren's fresh read-only production reads of 2026-11-06 (§2.2). File:line citations are to the composed tree's `v2/` directory unless another source is named. This package is pinned at `<DESIGN-PIN>` (the pin is carried in the companion CP file, per the established slot pattern)._

---

## 1. Purpose, authority, and the ruling map

Julie decided on 2026-11-06 (board comment 6686374302) to scope both generation workstreams in one program, Workstream 1 (Standard turn-on) first. Rowan's scoping ruling accepted the program structure and the Standard gate in principle, and required amendments before any GO presentation. Her "next authorized work" authorizes exactly this document: a revised DESIGN package addressing A1–A6, the per-book budget onboarding approach, and the parked-plan state matrix, returned for her review. **This package authorizes nothing** — no production mutation, no staging deployment, no provider call, no generation, no GO presentation (ruling §6). Where this package proposes figures, thresholds, or terms the ruling left to the package, they are labeled **PROPOSAL** and are Rowan's and Julie's to rule on; source mechanics are stated at source strength and cited.

How the ruling is answered:

| Ruling item | Disposition | Where |
|---|---|---|
| Q1 AMEND — per-book budget required; phase-null not accepted as the default | Onboarding design with three options weighed and one recommended | §4 |
| Q2 CONDITIONAL PASS — routine parked plans may auto-resume after fresh guard evaluation; safety / quarantine / billing-uncertainty / operator-held must NOT | Exact state-to-resumption matrix (22 state rows + 3 overlay rows) + live inventory mapped | §5 |
| Q3 PASS — parked Chapter 3 job preserved unchanged | Carried as a census predicate and a GO bar | §5.4, §8.1 P-6, §9 |
| Q4 AMEND — legacy plan-less job inventory feasibility; else fail-closed proof + residual uncertainty | Feasibility: NOT FEASIBLE on the current build (proven from the route surface); fail-closed behavior proven from source; residual uncertainty stated in three parts | §6 |
| Q5 AMEND — Julie's general re-hold; Wren's preauthorized emergency re-hold under enumerated triggers, bounded verified procedure, immediate report; fresh GO for re-turn-on | Emergency re-hold design: 9 objectively checkable triggers, a 2-act bounded procedure, reporting, the fresh-GO rule | §7 (and in-gate at §8.2/A2) |
| Q6 PASS — the four `schedule_dead` rows preserved | Carried as census predicate P-4 and a GO bar | §8.1, §9 |
| Q7 PASS WITH CONDITION — complete OQ-5 verification/termination; define a separate normal-operations observation arrangement | OQ-5 status carried honestly (leg (iii) pending at drafting; a gate preflight predicate, §8.1 P-14); the normal-ops arrangement designed at §8.5 (A5) | §8.5 |
| Q8 PASS — `geminiLane` non-operative, no mutation | Noted; no act anywhere in this package touches it | §3 |
| A1 — exact preflight predicates, drift rules, STOP conditions | 15 predicates with per-predicate drift rules + the STOP set | §8.1 |
| A2 — emergency re-hold inside the gate | §7 incorporated by reference into the gate + the GO wording | §8.2, §9 |
| A3 — smoke limits, completion evidence, failure handling, playback acceptance | §8.3 | §8.3 |
| A4 — soak permissions and restrictions, incl. additional app submissions | §8.4 — the package PROPOSES additional submissions allowed (onboarded books only), with the alternative stated | §8.4 |
| A5 — daily observation, accounting checks, anomaly handling, named responsibility | §8.5 — owner Wren; `normal-ops-daily-check`; three classifications | §8.5 |
| A6 — declaration criteria + the prohibition on smoke-alone acceptance | §8.6 | §8.6 |

Preserved from the ruling without change: the program structure (WS1 before WS2, separately gated); the Batch source assessment; Julie's GR-B GO stands consumed; production remains HELD at NORMAL.

---

## 2. Census — carried forward, with a dated refresh

### 2.1 The scoping census (2026-11-06T13:52Z–13:56Z) stands

The scoping package's §2 census (pin `a6e5dd38…`) is incorporated by reference and not repeated: production HELD at NORMAL; build `fdb02395…`; containment NORMAL with the standing registration; recorder at pass 360, all complete, `recordingFailures` 0; five plans, all terminal; the parked job `parked_policy` rev 1; conflicts exactly 4; quota reconcile ok with the sole adjudicated straddler; queue paused; `GENERATION_HALT` `"1"`; settings revision 1; phase settled 1,037,880 / remaining 12,456,472; FP book quote 314 eligible ≈ $5.84, digest `7d76a053…`. The turn-on gate re-runs the full census as its preflight (§8.1) — this section is a design-time baseline, not a substitute.

### 2.2 Refresh reads (Wren, read-only, 2026-11-06 ~14:0xZ)

| Surface | Read | Value |
|---|---|---|
| Capabilities | `GET /v2/generation/capabilities` | Unchanged from the scoping census: `halted`; standard admitted; batch `batch_not_armed`; configuredLane null; FP settled 1,037,880, remaining 12,456,472 |
| Plans | `GET /v2/d6-plans` | The same five plans, all terminal (Phase B, Ch 3, Ch 2, smoke `complete`; old Ch 2 `retired`), totals as censused |
| Drive recorder | `GET /v2/d6-diagnostics?drive=1` | `recordingFailures` 0; `lastRecordedAt` advanced past the scoping census (chain alive and passing under the holds); alarm `armedAt` non-null (standing registration), pendingSchedule 1, pendingWatchdog 1 |
| **Smoke candidate quote — FP Chapter 4** | `GET /v2/d6-eligibility?bookId=5c589095…&scope=chapter&chapterIndex=3` | **20 eligible, 26,638 chars, expected 375,535 units (≈ $0.38)**, digest `7d76a053…` (the book digest); exclusions: bound_already 1, voice_prompt 0, parked 0, other 0 |
| Comparison quote — FP Chapter 5 | same surface, `chapterIndex=4` | 21 eligible, 29,145 chars, expected 410,880 units (≈ $0.41) — quoted so the largest-chapter math in §4.4 uses a real figure |

No production state was changed by these reads.

---

## 3. Turn-on mechanics (carried from the scoping package §3.1, condensed)

Turn-on remains two proven acts, performed once and not reversed at gate end:

1. **Halt lift** — the metadata-only envelope upload, proven at the resume gate's GR-3 step (evidence `resume-execution/flip/`): the multipart upload carries all 31 script parts byte-identical to the live build (manifest-compared before upload) and a metadata part whose bindings are the live set with exactly one text changed — `GENERATION_HALT` plain_text `"1"` → `"0"` (the flip evidence's metadata names the full binding set: `ALLOWED_ORIGIN`, `COORDINATOR`, `GENERATION_HALT`, `OPALREADER_GENERATION_V2`, `OPALREADER_PHASE_POLICY` `"enforce"`, `OPALREADER_V2_SCOPE`, `OPALREADER_STORAGE`, with `GEMINI_API_KEY`, `OPALREADER_ACCESS_TOKEN`, `OPALREADER_MIGRATION_OPERATOR_TOKEN` as `inherit` — no secret value is read or carried by the act); `main_module` `v2/worker-entry-prod-d6.js`, compatibility preserved. Script etag unchanged; observability re-checked after the upload and re-applied by the multipart settings PATCH if reset (the standing post-upload rule). Effect in source: `generationEnabled = env.GENERATION_HALT === "0"` (worker-entry-prod-d6.js:326) wires `sendGrant` (:343) and the entry's halt admission fence (`isHaltRefusedCommand`, :296-312 — it refuses RequestSynthesis / RequestResume / RequestRepair / plain SubmitJob while halted) stops refusing.
2. **Queue unpause** — cf-api `PUT` queue `opalreader-generation-v2` with `queue_name` + `settings.delivery_paused: false`, then read back `delivery_paused: false`.

No code deploy. No settings-record write. No containment transition. The settings record's legacy `geminiLane` key is non-operative (Q8 PASS) and is touched by nothing in this package.

The off-switch is the same pair in reverse order (re-pause first, then re-halt — the resume gate's §2.3.3 closing order), designed as a standing instrument at §7.

---

## 4. Q1 — Per-book budget onboarding design (AMEND answered)

**The ruling**: initial normal operations require a per-book budget; phase-null, unbudgeted generation is not accepted as the default library-wide policy. This section designs the minimal, safe way a book becomes generatable. Nothing here is implemented or deployed under the ruling.

### 4.1 What a "phase" is today — the machinery as it stands (source)

A budgeted book = TWO records, which must exist together (phase-policy.mjs header law):

1. **A budget figure** — an entry in the frozen code constant `PHASE_BUDGET_MICRO_CENTS = Object.freeze({ "forever-pucked": 13_500_000 })` (generation/gen-constants.mjs:74-76). The constant is the whole universe of budgeted phases: capabilities renders phases ONLY from its entries (service.mjs capabilities, per the scoping package §2), admission rejects a phase outside it (`phase_not_budgeted`, service.mjs:442/470), the binding writer throws for it (below), and the grant guard looks the budget up in it (grant-guards.mjs, `PHASE_BUDGET_MICRO_CENTS[plan.phase]`).
2. **A binding row** — `d6_phase_bindings` (phase PRIMARY KEY, book_id), written ONLY by `recordPhaseBinding` (phase-policy.mjs), exposed on the service as `bindPhaseBook` and wired in the pinned production entry to exactly one surface: the operator-only `POST /v2/d6-phase-binding` route (migration-operator credential; no client path exists). Its semantics are the safety core of onboarding: insert-if-absent; the same (phase, book) pair re-recorded is an idempotent no-op (`changed: false`); a phase already bound to a DIFFERENT book **throws `phase_binding_conflict` and the recorded binding stands**; a phase outside the budget constant throws `phase_not_budgeted`; malformed input throws `phase_binding_shape`. There is NO unbind, rebind, or delete writer anywhere in the source.

Once both records exist, admission derives the book's phase from its registry row (a submission naming no phase is rejected `phase_required`; a different phase, `phase_mismatch` — service.mjs:435-437), an unbound book cannot claim a budgeted phase (`phase_bound_to_other_book`, :444), a budgeted phase with no recorded book fails closed (`phase_unbound`, :445), and the grant guard enforces the figure per grant (§4.4). The one production pair (forever-pucked ↔ `5c589095-f812-48a2-8ab2-03ba2791f2b2`) was itself recorded through this route at the gen-pkg-1 deploy gate — **Forever Pucked was onboarded by exactly the O1 procedure below**, which is the option's strongest evidence.

What onboarding must therefore supply: a phase NAME (unique, one book per phase, one phase per book — `phaseBindingForBook` returns at most one row), a budget FIGURE Julie sets, a code change for the constant (under O1/O3-variant), and one operator route call (under every option — the binding writer already exists).

### 4.2 Option O1 — Budgets stay code constants; onboarding = a reviewed micro-deploy + the existing binding route (RECOMMENDED)

**What changes**: one line added to `PHASE_BUDGET_MICRO_CENTS` per book (its phase name + Julie's figure), deployed under the program's ordinary deploy discipline (source review, the standing batteries, census, Julie's GO — a build gate, not an operator act); then the binding recorded via the existing `POST /v2/d6-phase-binding` with an authorizationRef naming that GO. Multiple books whose figures Julie has ready MAY batch into one deploy. No new machinery of any kind.

**Sequence per book** (each step verified before the next):
1. Julie sets the figure (§4.4's rule proposed as her aid; the figure is hers).
2. Paperwork: phase name, the book's id read from the book's own read surface (never typed from memory), the figure in BOTH units and dollars.
3. The deploy gate (Rowan source review folded in; the delta is one constant entry — the review surface is deliberately tiny).
4. Post-deploy read-back: capabilities renders the new phase with the figure as its budget (settled 0 / remaining = figure) BEFORE any binding is recorded — a wrong figure is caught here, while it is still only a constant.
5. The binding record (operator route, authorizationRef = the GO). Idempotent on the correct pair; a conflict throw stops the sequence.
6. Read-back: capabilities now links phase ↔ the intended book id, character-for-character against the paperwork.
7. Eligibility re-quote for the book; a first submission's plan carries the derived phase (checked on the plan read at creation).
Only then is the book generatable.

**What can go wrong, and the controls**:
- *A binding recorded against the wrong book.* The sharpest hazard in the whole design, because it is IRREVERSIBLE in current machinery: the conflict throw prevents overwrite, and no unbind writer exists — a wrong (phase, book) pair would stand, fencing the phase to the wrong book permanently, with remedy only via a future code-level disposition gate. Controls: step 2's read-from-surface rule, step 6's character-for-character read-back BEFORE any submission exists, and the fact that the error is inert until someone submits the wrong book under that phase (admission would derive it; the daily check's plan cross-check, §8.5, would flag the first such plan as unexplained). The control set is procedural, and the package says so plainly.
- *A budget typo* (a figure 10× off, in either direction). Controls: the figure appears in the gate paperwork in units AND dollars; step 4 renders the deployed constant's value on capabilities before the binding exists; too-small is self-limiting (plans park on `phase_budget`, §5); too-large is bounded by the monthly cap, the daily quota, and Julie's prepay balance — and is correctable only by another deploy, which is why step 4 exists.
- *The guard's behavior on any inconsistency* is fail-closed throughout: a budgeted phase with no binding refuses at admission (`phase_unbound`); a binding for an unbudgeted phase cannot be written; the budget check refuses a malformed accounting shape (`phase_accounting_incomplete`, grant-guards.mjs) rather than coercing it.

### 4.3 Option O2 — An operator-managed budget registry (a real build; carried as the alternative)

**What changes**: a new table (phase, budget, authorizationRef, timestamps — the phase-bindings DDL-beside-its-writer pattern), an operator write route in the phase-binding route's fence class, and every reader of the constant re-pointed or unioned: the grant guard's lookup, admission's `phase_not_budgeted` test, the binding writer's `Object.hasOwn` test, and capabilities' phase iteration. The FP entry must migrate or be dual-read in the same build, and the disagreement rule must be designed (the package's position, if O2 is ever built: while both sources exist, the LOWER figure governs — fail-closed — and the constant is retired in the same deploy that proves the table, so two sources of truth never persist). Batteries: admission/guard/capabilities against the table, the throw-safe real-DO discipline for every new read, the migration of the standing FP pair proven on staging first.

**What can go wrong**: a silent constant/table divergence (the two-sources hazard above); a bad registry write is a settings-class error, so CAS/audit discipline must be built, not assumed; and the build itself is Workstream-2-sized, inserted BEFORE Workstream 1 can onboard its second book — it delays the library, though not the FP turn-on (FP is already onboarded).

**When O2 wins**: if onboarding becomes frequent. At the current library (7 books, onboarded rarely, in batches Julie chooses), O1's per-batch micro-deploy is proportionate. The package proposes a stated revisit trigger: if Julie onboards books more often than the deploy cadence comfortably serves — or asks for self-serve figures — O2 returns as its own design.

### 4.4 The figure — a rule proposed for Julie's decision (PROPOSAL)

Julie sets each book's figure; the package proposes the aid she asked the budget system to be: the figure should clear BOTH tests, computed from the book's fresh whole-book eligibility quote at onboarding:

- **(a) The precedent test**: figure ≥ 2 × the book's expected remaining cost. (Julie's FP precedent: $13.50 against a total-book expected ≈ $6.88 — ≈ 1.96×. The factor absorbs policy-block splits and repairs, which settle at realized rates but multiply attempts.)
- **(b) The projection floor**: figure ≥ projected final settled + 270 × (the largest remaining chapter's char count). The 270 is not a mood: at each chapter-job's first grant the guard sums the job's pending occurrence uppers — `upperBoundOccurrenceMicro(chars)` = 12 attempts × round(chars/10 × 225) = 270 × chars (gen-constants.mjs) — over settled + reserved + in-flight (grant-guards.mjs `d6PhaseBudgetCheck`). A figure below this floor can park a chapter mid-book on `phase_budget` — self-limiting and overspend-proof, but an interruption whose remedy is a fresh Julie decision (+ a deploy, under O1).

Take the larger, rounded up to the next $0.50; Julie may set any figure at or above (b).

**FP worked example, disclosed at full strength**: for Forever Pucked's remaining book — expected remainder 5,837,168, projected final settled ≈ 6,875,048, largest chapter quoted for this package Ch 5 at 29,145 chars → floor (b) ≈ 6,875,048 + 7,869,150 ≈ **14,744,198 units (≈ $14.74) — ABOVE the standing $13.50 budget.** In realized terms the margin has held comfortably (settled tracks the expected rate; the uppers assume 12 attempts at 1.59× slower speech, per occurrence, simultaneously), and Ch 2/Ch 3/Ch 4-scale chapters have run under it. But on worst-case-shaped math a late FP chapter's first grant could project past $13.50 and park. That is a designed, safe outcome — and if it occurs during the soak it is a NORMAL-OPS-MOVEMENT report (§8.5), with any raise a fresh Julie decision, never a silent act. The example is carried so Rowan rules on the rule with its consequence visible.

### 4.5 Recommendation

**O1**, for three reasons: every mechanism it needs already exists and is production-proven (FP itself was onboarded this way); its hazards are known, named above, and controlled by read-backs at the two steps where they can still be caught; and it keeps the turn-on gate itself code-free — onboarding is a separate later micro-gate per book (or batch), so WS1's critical path stays governance-only. The first onboarding under this design (the first book after FP) is itself the proof and should run as its own micro-gate before the procedure is treated as routine. O2 is carried as the alternative with its revisit trigger; a settings-carried variant (per-book caps in the settings record) was considered and is NOT recommended — the guard never reads settings for phase budgets, so it is an O2-sized build with a weaker audit shape (settings writes are CAS client-reachable in ways operator routes are not).

---

## 5. Q2 — The state-to-resumption matrix (CONDITIONAL PASS answered)

**The ruling's floor**: routine parked plans may resume automatically after fresh guard evaluation; safety, quarantine, billing-uncertainty, and operator-held cases must NOT resume merely because the holds lift. This section enumerates EVERY plan state and job state reachable at turn-on, from the source, and rules each one. Verdict vocabulary: **AUTO** (the driver re-tests it every pass and it resumes when its guard clears in ordinary time — the F2 semantic the ruling conditionally passed) · **RE-TESTED** (the driver re-tests it every pass, but the lift itself and the passage of time cannot clear its cause; only a separate authorized act can) · **NO** (never resumes by driver action; a named operator/Julie path only) · **INERT** (terminal; nothing to resume).

### 5.1 The mechanics the matrix rests on (source)

- The driver (`driveOnce`, service.mjs) selects plans with `state NOT IN ('complete', 'partial', 'retired', 'halted_unknown')` (service.mjs:1043-1044) — so `active` and the whole `parked_*` family are re-selected on EVERY pass, and each selected plan runs the same gauntlet in order: the quarantine skip (a held plan, or a FAILED hold read, is skipped with `approvalRequired` — a read failure is treated as held, service.mjs driveOnce D8-1 block) → the phase unknown-billing halt check (a plan whose phase is halted transitions INTO `halted_unknown` and stops) → the storage projection (failure re-parks it `parked_storage`) → the grant step, which calls `requestGrant` and maps any refusal through `GRANT_STOP_MAP` (service.mjs:56-73) into the parked family, or sets the plan `active` on a successful grant. **Fresh guard evaluation is therefore not a metaphor: every parked plan is re-guarded from scratch on every pass**, against the full guard chain (grant-guards.mjs: quarantine first, then phase halt, then the phase-budget projection with its shape fence, then storage — plus the coordinator's quota-park, daily-quota, and monthly-cap checks inside grant issuance).
- `halted_unknown` is excluded AT SELECTION, permanently (R4-1, service.mjs:1024-1044): the driver never selects, mutates, reactivates, grants for, or dispatches a halted plan on any pass. Its ONLY exit is `retireHaltedPlan` (§5.2 row 6).
- Plan states are written in exactly these places: admission inserts `active` (service.mjs:922); the driver writes the `parked_*`/`halted_unknown`/`active` transitions above; `finishPlan` writes `complete`/`partial` (service.mjs:989-1007); `retireHaltedPlan` writes `retired`. There is no plan cancel and no plan `failed` state.
- Job states are the coordinator FSM's closed vocabulary (`JOB_STATES` / `JOB_TRANSITIONS`, coordinator.mjs:33-86): `queued, generating, paused_quota, paused_user, outcome_unknown, complete, partial, failed, cancelled, superseded, parked_policy`. Any (state, event) pair not in the table is an explicit rejection. `parked_policy`'s row is EMPTY — no outbound transitions, and no inbound lifecycle edge: the only entry is the migration carry's direct insert (coordinator.mjs:76-86).
- A plan's jobs are created `queued`, move to `generating` on grant, and settle to terminal states on reports. The driver advances a plan only through its current (latest) job (service.mjs driveOnce advancement block).

### 5.2 Plan states (9 rows)

| # | State | Cause / meaning (source) | Resumes at turn-on? | What unblocks it (whose act) | Evidence surface |
|---|---|---|---|---|---|
| P1 | `active` | The working state: admitted, with pending work or a live grant; also the state a successful grant step restores | **AUTO** — it is not parked; the driver works it every pass, each grant freshly guarded | n/a | `GET /v2/d6-plans[/<id>]`; drive outcomes |
| P2 | `parked_quota` | A grant refusal in the quota family: `quota_estimate_exhausted`, `provider_attempt_budget`, `provider_attempt_budget_bootstrap_incomplete`, `provider_attempt_budget_day_over_limit`, `quota_parked` (GRANT_STOP_MAP) | **AUTO** — re-guarded every pass; resumes when the quota reason clears in ordinary time (the PT day rolls at 07:00Z; the bootstrap completes) | Nothing but time/the guard itself; a refusal re-parks it with its reason preserved | Plan read (`state`, `stop_reason`); `GET /v2/quota`; reconcile surface |
| P3 | `parked_cap` | `spending_cap` — the settings monthly cap ($50) check refused the grant | **AUTO** — re-guarded every pass; resumes when the cap check passes (the month rolls, or the cap changes) | The passage of the month; a cap change is a settings write (Julie's act, CAS-guarded — not a turn-on act) | Plan read; `GET /v2/quota` (month figures) |
| P4 | `parked_budget` | `phase_budget` — the guard's projection (settled + reserved + in-flight + the current job's pending uppers) exceeded the phase budget | **RE-TESTED** — re-guarded every pass, but the lift changes nothing in the projection; it clears only if accounting moves | An authorized accounting act (adjudication/reconcile changing the reserved line — operator routes, Julie's separate authorization) or a budget raise (Julie's figure decision + a deploy under O1) | Plan read; capabilities phase block; plan diagnostics (phaseAccounting, both surfaces) |
| P5 | `parked_storage` | `storage_boundary` — the plan's storage projection reached the 10 GB free-tier boundary (also re-checked before the grant step on every pass) | **RE-TESTED** — the projection is recomputed every pass, but generated bytes only grow; it clears only on a real reduction in projected bytes | A storage-reducing act under its own authorization (none is proposed in this program); never the lift itself | Plan read; storage accounting in grant-guard reads |
| P6 | `halted_unknown` | `phase_halted_unknown_billing` — the plan's phase carries unresolved unknown-billing attempts; an ENDURING driver-level stop (R4-1) | **NO** — excluded at driver selection on every pass, forever, however often the alarm fires. The ruling's billing-uncertainty floor case, exactly | The R3-2 clearance, in order, each step Julie's separate authorization: reconcile or adjudicate EVERY open unknown attempt of the plan (operator routes `POST /v2/d6-reconcile-unknown` / `POST /v2/d6-adjudicate-estimated`), then `retireHaltedPlan` (operator route) → `retired`; any later work over the same occurrences is a FRESH intent under ordinary admission | Plan read; attempt diagnostics (`GET /v2/d6-diagnostics?planId=`); the retirement audit table |
| P7 | `complete` | `finishPlan`: every eligible entry's occurrence `ready` or its execution `committed` | **INERT** — terminal; never selected | n/a | Plan read (totals) |
| P8 | `partial` | `finishPlan` with entries not done when the plan's last job settled (stop_reason `incomplete`) | **INERT** at the driver (in the selection exclusion list) — NOT a resumption: the remaining occurrences can only be worked by a NEW plan from a fresh intent, under admission + the overlap fence | A fresh Julie submission (which creates a new plan; it does not revive this one) | Plan read; a later plan's read |
| P9 | `retired` | `retireHaltedPlan` (stop_reason `retired_unknown_billing`), or the Gate-6-class retirement of the old Chapter 2 plan | **INERT** — terminal everywhere; its fence ownership was cleared by the retirement itself | n/a | Plan read; retirement audit |

### 5.3 Job states (11 rows)

Plan-linked jobs move only inside their plan's driver gauntlet (§5.1); plan-less jobs are never touched by the driver at all (it iterates plans) and can move only when a command names their id — which is why their rows read differently.

| # | State | Cause / meaning (source) | Resumes at turn-on? | What unblocks it (whose act) | Evidence surface |
|---|---|---|---|---|---|
| J1 | `queued` (plan-linked) | Created by the service for a plan's chapter; awaiting its first grant | **AUTO** — via its plan's row (the grant step acts on the plan's current job every pass) | n/a | `GET /v2/jobs/<id>`; plan read |
| J2 | `queued` (plan-less, legacy) | A job with no `d6_plan_jobs` link (pre-D6 or legacy-command births) | **NO** — nothing drives it; it cannot self-start. If a legacy command names it (RequestResume probe, a repair follow-up), its first guarded grant attempt meets the §6 fence: halt-era births are marked + refused `job_quarantined`; pre-epoch births pass the D6 guard into the coordinator's standing money checks (quota park, daily quota, monthly cap) | Only a commanded act by someone holding its id — and for fenced jobs, the operator per-subject release (Julie's separate approval) | `GET /v2/jobs/<id>` (by id only — §6); diagnostics by jobId |
| J3 | `generating` | A grant is live (issued) against it | **n/a — mid-flight, not parked.** Its completion path is the report path; at turn-on the outbox drains because the halt lift wires `sendGrant` (§3) — in-flight work finishing is the design, not a resumption | n/a | Job read (grants[]); recorder outcomes |
| J4 | `paused_quota` | The job-level quota park (`park` event from `generating`) | **NO** — its only outbound lifecycle edge is `resume_probe` → `generating`, a COMMANDED probe (RequestResume), refused at the entry while halted and fully guarded whenever it runs. Not automatic. (The D6 plan-level analogue is P2, which IS automatic — the two shapes are distinct and the matrix keeps them so) | A RequestResume command (Julie's client, or an authorized act), then the guard chain | Job read; command receipts |
| J5 | `paused_user` | A `pause` event (RequestPause) | **NO** — resumes only on the `resume` event: the user's own commanded act, by design | RequestResume (Julie's) | Job read; receipts |
| J6 | `outcome_unknown` | A granted occurrence's outcome could not be validated (`unknown` event; occurrence-level `outcome_unknown` likewise) — the job-level billing-uncertainty state | **NO** — the ruling's floor: billing-uncertainty never resumes on a lift. Its edges are `resolve` (→ `queued`) and the settle reports, all commanded/operator paths | `ResolveOutcomeUnknown` / the reconcile machinery, under Julie's authorization; a `resolve` into `queued` then faces the ordinary guard chain | Job read; diagnostics by jobId; attempt log |
| J7 | `complete` | Settle: all occurrences reported complete | **INERT** | n/a | Job read |
| J8 | `partial` | Settle: some occurrences complete, some not | **INERT to the driver.** One commanded edge exists (`resume` → `queued`); for a plan-linked job whose plan is terminal this is a noted edge, NOT a turn-on behavior — a probe grant against it would still meet its (terminal) plan's phase/budget guard via `d6PlanForJob`, and this package proposes no act on it | A commanded resume (Julie's), fully guarded; no act proposed | Job read |
| J9 | `failed` | Settle: reported failed | **INERT** (only `supersede` remains, a bookkeeping act) | n/a | Job read |
| J10 | `cancelled` | A `cancel` event landed | **INERT** — empty transition row | n/a | Job read |
| J11 | `superseded` | Replaced by a successor job/intent | **INERT** — empty transition row | n/a | Job read |
| J12 | `parked_policy` | The migration-carried policy park: INSERTED by `MigrateImportJobs`, never submitted, never queued; its occurrences are fenced out of every eligible set upstream | **NO — structurally never.** Empty transition table row: EVERY event against it (resume, pause, cancel, resolve, park, grant, supersede, settle reports) is an explicit logged rejection. Generation over it is impossible by construction, not policy | Nothing resumes the JOB. Its occurrences move only through the two operator fence mechanisms, each under its own authorization: the park release (`POST /v2/d6-release-park`, definition-set ids only) and the chapter exemption (`POST /v2/d6-exempt-chapter-occurrence`, beyond-definition ids only) — the mechanisms that produced Chapter 3's completion. **Q3 PASS: the job itself is preserved unchanged** | `GET /v2/jobs/1832c21f…` (state, revision, grants []); the release/exemption journals |

### 5.4 Overlay rows (3) — holds that sit on top of states

| # | Overlay | Meaning (source) | Resumes at turn-on? | What unblocks it | Evidence surface |
|---|---|---|---|---|---|
| X1 | Quarantine hold on a PLAN (any non-terminal state) | A `d6_quarantine_holds` row (D7-2 birth-mark for plans born while halted, or a guard-recorded hold). The driver SKIPS a held plan entirely — no grant step, no advancement, no state transition — and stamps `approvalRequired`; a FAILED hold read is treated as held (fail-closed) | **NO** — operator-held, the ruling's floor. The lift does not touch it; NO generic act clears it (not a re-arm, a binding, a settings change, a plan retry, or another subject's release — grant-guards.mjs D7-2 law) | The operator-only per-subject release `POST /v2/d6-release-quarantine`, Julie's separate per-plan approval; it REFUSES a `halted_unknown` plan (`release_refused_halted_unknown` — release is not a reconciliation) | `GET /v2/d6-diagnostics` quarantine view per subject; drive outcomes (`quarantined`, `approvalRequired`) |
| X2 | Quarantine hold on a JOB | Same table, job subject (guard-recorded: `grant_attempt_while_halted`, `born_while_halted`) | **NO** — the grant guard refuses `job_quarantined` before every other check but the plan hold | The same per-subject release route (job subject), Julie's separate approval | Same surfaces |
| X3 | Phase-level unknown-billing halt (`d6_phase_state.halted_unknown_billing`) | The phase itself is flagged (an attempt settled `unknown` against it) | **NO** — while it stands, every selected plan on that phase transitions INTO `halted_unknown` (P6) and stops; the flag is a billing-uncertainty hold on the whole phase | Clearing the phase's open unknown attempts via reconcile/adjudicate (the flag clears in the same transaction as the last one's disposition — genstore), each act Julie's separate authorization | Capabilities phase block; plan diagnostics |

### 5.5 The live inventory, mapped (at the §2 census)

| Live object | Matrix row | At turn-on |
|---|---|---|
| Phase B plan `plan:19cad189…` — `complete` | P7 | Inert |
| Ch 3 plan `plan:e377a555…` — `complete` | P7 | Inert |
| Ch 2 plan `plan:b2dc2a3d…` — `complete` | P7 | Inert |
| Smoke plan `plan:3183ecbf…` — `complete` | P7 | Inert |
| Old Ch 2 plan `plan:603ab416…` — `retired` | P9 | Inert |
| Parked Ch 3 job `1832c21f…` — `parked_policy` rev 1, grants [] | J12 | Preserved unchanged (Q3); never resumes |
| Non-terminal plans of any state | — | **None exist.** Turn-on starts nothing by itself; the first work in the live system is the smoke Julie submits (§8.3) |
| Quarantine holds (plan or job subjects) | X1/X2 | None stand against the five plans or the parked job on any surface the census reads; the gate census (P-5/P-6) re-verifies per-subject before the lifts |

---

## 6. Q4 — Legacy plan-less jobs (AMEND answered)

### 6.1 Feasibility of a reliable read-only inventory: NOT FEASIBLE on the current build

Established from the route surface, exhaustively:

- Plans ARE enumerable: `GET /v2/d6-plans` (keyset-paginated list) + `GET /v2/d6-plans/<id>`. Plan-linked job ids are therefore enumerable through each plan's reads.
- Jobs are NOT: the only job read is `GET /v2/jobs/<id>` (api.mjs:231-235) — a single-id read returning 404 `job_not_found` for an unknown id. There is **no list route, no search, and no enumeration of the coordinator's `jobs` table on any surface**. Job ids are UUIDs, not sequential — there is no id space to walk.
- `GET /v2/d6-diagnostics` cannot enumerate either: it requires exactly ONE target (`planId` XOR `jobId`, else `diagnostics_target_required`, service.mjs attemptDiagnostics) or the `drive=1` recorder mode, whose outcomes name plan ids and grant ids only.
- The remaining surfaces carry no job inventory: `GET /v2/conflicts` lists schedule lease rows; `GET /v2/quota` is aggregate (its parked field names a quota-park context, not jobs); the sync families are content/bindings only — there is no jobs family.
- The bounded probe sets that DO exist: (a) plan-linked job ids (via the plans list), (b) ids preserved in the program's records (the parked job's id is known only because the migration record preserved it), (c) ids in recorder outcomes (plan-linked only). A probe of "all other jobs" has no candidate set to probe.

**Conclusion**: without new code (an operator list route — a build, outside WS1's no-code premise and not proposed here), a reliable read-only inventory of plan-less jobs cannot be produced. The census therefore does NOT claim "no plan-less jobs exist" — it claims the narrower, true statement at §6.3(c).

### 6.2 The fail-closed behavior, proven from source

A plan-less job can reach a grant ONLY through a grant-producing command naming its id (RequestSynthesis creates a NEW job; RequestResume drives a `resume_probe`/`resume`; RequestRepair drives repair follow-ups). Every such grant passes `d6GrantGuard` inside the grant transaction (grant-guards.mjs), behind the coordinator's own quota-park / daily-quota / monthly-cap checks. The fence, in evaluation order:

1. **Hold first**: a recorded quarantine hold on the job refuses `job_quarantined` — before phase, budget, or storage checks, and no generic act clears it (D7-2).
2. **While halted**: under the production entry's halt fence, a plan-less grant attempt while `GENERATION_HALT !== "0"` is refused `generation_halted` AND the job is durably marked in the same transaction (hold reason `grant_attempt_while_halted`). The mark, not the flag, is what fences it after any later re-arm.
3. **The epoch fence (D8-2)**: on the FIRST guarded attempt whenever it occurs — including after turn-on — a plan-less job still in `queued` whose birth falls inside a recorded halt epoch, with no prior hold row, is marked (`born_while_halted`) and refused `job_quarantined` in that same transaction. A job that already HAS a hold row is not re-adjudicated (a released row is the operator's completed clearance, never silently re-imposed).
4. **At the door**: while halted, the entry refuses the staging command types outright (`isHaltRefusedCommand`: RequestSynthesis, RequestResume, RequestRepair, plain SubmitJob) before the coordinator is reached — during the current halt era those commands never arrived from a client at all. (The D6 intent shape is not refused at the door; it routes to admission, where its plan is birth-marked if born halted — §5.4 X1.)
5. **The epoch ledger is live**: `noteHaltObservation` runs on every drive pass and every guarded attempt; the current halt era is a recorded, still-open epoch (its `closed_at` is NULL while the halt stands). Halt-era births are therefore inside the fence's coverage by construction.

And the structural bound underneath all of it: **the driver iterates plans only** — a plan-less job can never self-start, wake, or advance on any pass, at any time, under any hold state.

### 6.3 Residual uncertainty, stated plainly

- **(a) Pre-epoch births.** A plan-less job born BEFORE any recorded epoch (e.g., under the pre-D8 entry), never commanded since, would pass `d6GrantGuard` if commanded by id after turn-on — the D6 guard is `{ ok: true }` for it. It remains bounded by the coordinator's standing money checks (quota park, the 100/day provider-attempt cap, the $50 monthly cap), and commanding it requires knowing its id AND holding a valid token. It cannot self-start (§6.2). Its spend, if ever commanded, would surface on the daily check (§8.5) as movement with no explaining plan — a NORMAL-OPS-ANOMALY, and dispatch under it meets trigger T-1 (§7).
- **(b) Epoch coverage.** The ledger covers births from its first recorded observation forward, with unobserved slivers bounded by the pass cadence (the quarantine.mjs design note). A halt that began AND ended entirely between observations in the pre-recorder era cannot be proven covered. The current era is covered (§6.2.5); the uncertainty attaches to deep-history halts only.
- **(c) The unprovable negative.** No surface can prove the set of plan-less jobs is exactly {the parked job}. What IS claimed: none are visible on any surface; none can self-start; halt-era births are fenced fail-closed at their first attempt; any first attempt is either refused-and-fenced or passes only through the standing money guards and is visible to observation the same day. The consequence bound is therefore: at worst, bounded, capped, observed spend by a deliberately commanded legacy job — never silent, never unbounded, never self-starting.

**Answer to the scoping package's Q4 question, as amended**: surfacing-by-refusal is not merely accepted — on the current build it is the ONLY behavior available, and this section is its proof and its residual-uncertainty statement, returned for Rowan's ruling as the ruling requires.

---

## 7. Q5 / A2 — Emergency re-hold design (AMEND answered)

### 7.1 Authority

- **Julie's general authority is unlimited**: she may order a re-hold at any time, for any reason or none, in chat. Wren executes §7.3 and reports per §7.4. No trigger is needed and none is asked for.
- **Wren's preauthorized emergency authority is narrow**: Wren may execute §7.3 WITHOUT waiting for Julie ONLY when one of the §7.2 triggers is observed on a read surface, at the strength stated there. Anything outside the triggers is report-and-wait (the post-gate watch's precedent: movement is reported, never acted on).
- A re-hold is not a gate and authorizes nothing else. **Re-turn-on after any re-hold requires Julie's FRESH GO through a new turn-on gate** (§8's shape; no abbreviated re-entry is assumed anywhere in this package — if Rowan wants one designed, that is a further ruling).

### 7.2 Triggers (each objectively checkable from read surfaces; PROPOSAL thresholds marked)

| # | Trigger | Objective check (surface) |
|---|---|---|
| T-1 | **Foreign / unexplained dispatch** — provider dispatches or settled movement with no plan explaining them | `GET /v2/quota` (`providerDispatchesToday` > 0) or a phase settled delta, against `GET /v2/d6-plans` showing no non-terminal or newly-terminal plan that accounts for them (§6.3(a)'s backstop) |
| T-2 | **Loop signature** — a plan burning the day without producing: ≥ 100 provider dispatches in one PT day (the cap itself) with zero new bindings in the same window | Quota read + bindings watermark (`GET /v2/sync/changes?family=bindings`) |
| T-3 | **Reconcile drift** — `reconcileQuota.ok === false` or a drift list beyond the sole known adjudicated straddler | `GET /v2/d6-quota-reconcile` (operator) |
| T-4 | **R-06-class recorder discrepancy** — an in-set accounting transition with the expected recorder row missing at the A-7 observation point (the transition's poll + one further complete poll) | Drive recorder (`drive=1`) against plan/job accounting reads |
| T-5 | **Conflicts change** — the conflicts set differs from the four baseline `schedule_dead` rows | `GET /v2/conflicts` |
| T-6 | **Storage boundary pressure** — recorded base + D6 bytes ≥ 95% of the 10 GB free-tier boundary (PROPOSAL figure), or `storage_boundary` refusals appearing across successive passes for multiple plans | Storage accounting surfaces; drive outcomes (`parked_storage`) |
| T-7 | **Containment deviation** — containment state ≠ NORMAL, or any containment field inconsistent with the baseline, not commanded under an authorization | `GET /v2/d6-containment` (both surfaces) |
| T-8 | **Hold-state inconsistency** — capabilities/health generationState inconsistent with the last authorized hold state (e.g., `halted` while turn-on stands and no re-hold was commanded; or `enabled` after a re-hold's verified read-backs) | Capabilities + health |
| T-9 | **Provider-fault storm** — ≥ 10 consecutive provider-error-class attempt outcomes across plans in one PT day with zero successes (PROPOSAL figure) — the 1101 lesson: do not keep feeding a platform fault | Attempt diagnostics across the day's plans; quota reads |

### 7.3 The bounded procedure (exactly two production acts, in the proven order)

1. **Re-pause the queue** — cf-api `PUT` with `delivery_paused: true`; read back `delivery_paused: true`.
2. **Re-halt** — the metadata-envelope flip of `GENERATION_HALT` to `"1"` (§3's method, against the THEN-CURRENT build: parts manifest-compared to the live build at that moment, whatever it is); read back the settings binding `"1"`, health `generation: halted`, capabilities `generationState: halted`; observability re-checked after the upload (standing rule).
3. **Stop.** Nothing else. Expressly NOT in the procedure: no deploy beyond the flip envelope itself, no code change, no plan or job command, no containment transition, no quarantine release, no settings-record write, no SubmitJob, no provider call.

### 7.4 Reporting and escalation

Immediate, in the same turn the read-backs land: a message to Julie in the Coding Projects chat naming the trigger, the surface values that fired it, and the verified re-hold read-backs; a board note filed in the same working session (the gate record's anomaly entry); the daily check (§8.5) logs it as NORMAL-OPS-ANOMALY (re-hold). If a read-back in §7.3 cannot be verified, Wren escalates at once in the same message (what was attempted, what the surfaces show) rather than retrying blindly — and the state is treated as NOT safely held until Julie and Rowan disposition it.

---

## 8. The Standard gate, amended (A1, A3–A6; A2 incorporated from §7)

The gate's skeleton is as accepted in principle: census → halt lift → queue unpause → a bounded Julie-submitted Standard smoke → a seven-day soak → execution record → Rowan review → declaration. This section supplies the required additions. On success the gate's end state is deliberately NOT the program's usual HELD: the holds stay lifted and the system stands **turned on under observation** until §8.6's declaration — a distinct named state. On any STOP before the lifts, the gate ends HELD untouched; on an abort after the lifts, §7.3 runs and the gate ends HELD with the soak void (§8.6.4).

### 8.1 A1 — Preflight predicates, drift rules, STOP conditions

The execution census repeats the §2 read set in full. **Identity predicates are byte/value-exact; accounting predicates admit only movement explained by a named authorized act in the gate record; time-dependent surfaces are judged by shape (fresh, complete, zero-failure), never by frozen values** — the drift rules generalize the resume gate's discipline.

| # | Predicate (expected value) | Drift rule |
|---|---|---|
| P-1 | Live build `fdb02395b3775dc945baa395591a73060ab146c4`; script etag `bb90f182…` CAPTURED AND SAVED as an evidence artifact before any lift (Rowan R4) | Exact. Any difference = an intervening deploy: STOP and re-baseline the paperwork — never proceed on a traced explanation (the executor STOP law) |
| P-2 | BOTH holds standing at census: `GENERATION_HALT` `"1"` (script settings) and queue `delivery_paused: true`, sole consumer `f260f218…` | Exact. Either already lifted = unexplained state: STOP |
| P-3 | Containment NORMAL on both surfaces, known/verified true, `stopConfidence: not_applicable`, closed-episode summary prevEpisode 3 / 1 / false | Exact. Any new episode or transition = STOP |
| P-4 | Conflicts = exactly the four baseline `schedule_dead` rows (ids 1–4, their pinned occurrence ids) | Exact set. Any addition or change = STOP (Q6) |
| P-5 | Plans inventory = exactly the five baseline plans, all terminal, totals as censused; ZERO non-terminal plans; per-subject quarantine reads show no hold on any of the five | Exact. Any non-terminal or held plan would be live at turn-on and needs its own disposition first: STOP |
| P-6 | Parked job `1832c21f…` = `parked_policy`, revision 1, grants [] | Exact (Q3 PASS — preserved; any change = STOP) |
| P-7 | Settings revision 1; monthly cap $50; the record otherwise as censused | Exact. A revision change = a settings write outside the gate: STOP |
| P-8 | Quota reconcile `ok: true`, drift [], sole exception the adjudicated straddler `att-37d63768…` (`estimated_unverified`) | Exact. New drift or a new exception = STOP |
| P-9 | Phase accounting: settled 1,037,880; estimatedUnverified 19,018; reservedUnverified 5,648; unknownOpen 0; remaining 12,456,472 | Explained-movement-only — and no act since the design census is authorized to move it, so in practice: any movement = STOP |
| P-10 | Sync watermarks: content 18, bindings 1842 | Exact. Movement = activity outside the gate: STOP |
| P-11 | Day counters consistent with no generation since the resume close: `providerDispatchesToday` 0; attemptsToday explicable solely by the ledger's grant-counter bookkeeping | Shape-judged against the PT day; anything unexplained = STOP |
| P-12 | Recorder healthy and current: latest pass stage `complete`, `recordingFailures` 0, `lastRecordedAt` within ~2 pass cadences of census time; `armedAt` non-null (the standing registration) | Shape-judged. A null registration or a recorder failure = STOP — the chain that must advance the smoke cannot be shown alive |
| P-13 | The smoke chapter's fresh eligibility quote: digest equal to the design quote (`7d76a053…` book digest), eligible count and expected cost as quoted at §8.3 for Julie's chosen chapter | A moved quote = re-quote in the record; if the smoke target's numbers materially moved, STOP for a ruling before lifting |
| P-14 | OQ-5 CLOSED: the post-gate watch's leg (iii) verified from its first scheduled run's log, and the watch terminated per its terms (Rowan's acceptance already given) — the turn-on gate may not proceed while that duty is still open (Q7's condition) | Exact precondition. Pending at this package's drafting (the first scheduled run is 2026-11-06 18:28 ET); by gate time it must read verified-and-terminated, else STOP until it does |
| P-15 | Julie's GO for THIS gate recorded on the board BEFORE the census runs (the established ordering), naming this package's pin | Exact precondition |

**STOP conditions** (any one stops the gate; the state is preserved and the deviation reported to Julie and Rowan; proceeding requires a fresh GO or a Rowan ruling for that deviation): any predicate failure; any unexplained movement on any surface; a platform fault of the 1101 class during the gate (WAIT per Julie's standing decision — no deploy, restart, or mutation as a "fix"); a smoke-chapter quote that cannot be reproduced; Julie's or Rowan's word.

### 8.2 A2 — Emergency re-hold, in-gate

§7 is incorporated whole: the triggers, the 2-act bounded procedure, the reporting, and the fresh-GO rule apply from the moment of the halt lift (not only during the soak), and the GO wording (§9) carries the authority expressly so no in-the-moment interpretation is ever needed.

### 8.3 A3 — The smoke

- **Who submits**: Julie, from her own app, Standard lane — no Wren-submitted intent (the resume gate's discipline, kept: the smoke proves the NORMAL path, which is Julie's).
- **Target (PROPOSAL)**: Forever Pucked **Chapter 4** (chapterIndex 3) — freshly quoted (§2.2): **20 eligible segments, 26,638 chars, expected 375,535 units (≈ $0.38)**; exclusions bound_already 1 (Segment 1, already generated), voice_prompt 0, parked 0. It is the natural smoke: the next ungenerated chapter of the phase's own book, a full chapter's real shape, small enough that its worst case is bounded by the phase budget guard itself. Alternatives Julie may choose at GO presentation: Chapter 5 (21 eligible, ≈ $0.41), or a single segment for a minimal proof. The choice is recorded in the GO.
- **Shape**: chapter scope, **`keepGoing` OFF** — the plan is exactly one chapter. (Book scope with keepGoing would roll into Chapter 5 automatically on completion; the smoke must be bounded by construction, not by someone watching.)
- **Exposure limits**: the plan's own guards are the caps (phase budget projection, quota, storage). Deviation SIGNALS (signals, never caps — the Gate 4 law): settled for the chapter exceeding **2× expected (751,070 units)**; provider dispatches for the chapter exceeding **60** in a day (PROPOSAL figure — observed history: Gate 4's policy-heavy 15 segments took 76 attempts across its run; a 20-segment chapter materially past 60 same-day dispatches is worth a human look); either signal = the observation duty reports to Julie the same day; neither auto-stops Julie's plan — stopping is §7's triggers or Julie's word.
- **Expected completion evidence** (all required): the plan's totals reach done 20 / failed 0 (any failed entry individually explained — a segment exhausting its 12-attempt budget is a plan outcome to report, not to silently retry); the plan's job `complete`; exactly **20 new bindings** (watermark 1842 → 1862); content watermark unchanged (18); the phase settled delta reported in the three-line form (verified charges — none, no such surface / unverified ledger estimate — the settled delta against the 375,535 quote / remaining room); a recorder row accompanying every accounting transition (the A-7 discipline — a missing row at the ruled observation point is an R-06 discrepancy and a §7 trigger evaluation, T-4).
- **Failure handling**: the sliding ≥35-minute no-progress stall test (Gate 4 law) governs observation; on a declared stall Wren observes and reports — no act beyond §7 — and the gate record carries the stall for Rowan. A policy_block outcome is NOT a failure (the F3 recursive split is design behavior; the resume's own segment completed exactly that way). A provider/platform fault during the smoke: WAIT (standing law), the plan parks or waits by its own machinery, and the smoke's clock is a reporting matter, not a retry license.
- **Acceptance**: Julie's playback of the chapter — she listens, including the chapter's end; her confirmation is the smoke's acceptance, OUTSIDE the executor's verdict (the Gate 4 / Phase B pattern). No playback acceptance, no soak clock start (§8.4 runs from the accepted smoke's completion).

### 8.4 A4 — The seven-day soak: permissions and restrictions

The soak runs seven days from the accepted smoke's completion.

**PROPOSAL — additional submissions ALLOWED.** During the soak Julie may submit further Standard intents from her app, for ONBOARDED books only (at soak start: Forever Pucked alone), chapter or book scope at her choice, inside the phase budget. Reasons: the soak exists to prove NORMAL operations, and normal operations is Julie submitting; the standing guards bound every submission; §8.5 watches daily; §7 can end it in two acts. A no-submission soak would prove only idleness — already proven for two weeks under the holds — and would push the first real workload past the declaration, i.e., the riskiest generation would happen exactly when observation stops. **Alternative stated for ruling**: no additional submissions (the soak observes only the smoke's aftermath + the standing chain). The package recommends against it for the reason above, but it is Rowan's and Julie's to choose; the GO wording (§9) is drafted on the PROPOSAL and must be conformed if the alternative is ruled.

**Restrictions during the soak** (on the PROPOSAL): Standard lane only — Batch remains `batch_not_armed` and no WS2 act interleaves; no new book onboarding mid-soak except by the full §4 procedure under its own authorization (an onboarding is a deploy + a binding record — consequential acts that must not ride the soak); no settings-record writes (Julie VIEWING the quota counter in Settings is not a write; any write that does occur must be same-day reported and re-baselines §8.5's accounting checks); no operator-route acts (quarantine releases, plan retirements, adjudications, phase bindings) except under separate authorization; no deploys of any build.

**Early end**: an emergency re-hold (the soak is VOID, §8.6.4); an anomaly unresolved 24 hours after its report (PROPOSAL — the soak pauses in place, holds untouched, until disposition); or Julie's word at any time (which ends or extends the soak as she says).

### 8.5 A5 — The normal-operations observation arrangement (Q7's condition)

A NEW arrangement, designed here, distinct from `phaseb-resume-postgate-watch`: that watch observes a HELD system for unexpected movement and terminates on its own terms (acceptance given; leg (iii) verifies tonight; §8.1 P-14). This arrangement observes a LIVE system whose movement is expected — a different object, different classifications, and it is never a renaming or extension of the old watch.

- **Name / owner / form**: `normal-ops-daily-check` — a Wren-side scheduler job (read-only production GETs; NOT a production mutation; consumes none of any gate's counted acts). **Owner: Wren**, named responsibility: Wren runs it, reads it, classifies, and reports; nobody else is in the loop unless an anomaly escalates. Setup verified threefold at the turn-on gate's close, on the OQ-5 precedent (definition read-back quoted in the execution record; a manual check #0 logged; the first scheduled run's log confirmed before the arrangement is called established — if setup cannot be established as specified, the gate record returns for review rather than claiming the condition discharged).
- **Cadence**: daily ~18:28 ET through the soak (the retired watches' cadence, kept for Julie's habits). At declaration (§8.6) it converts to a standing WEEKLY form (PROPOSAL: Mondays ~18:28 ET) until Julie or Rowan retires it.
- **Check set** (read-only): capabilities (state, lanes, every phase vs its budget); health; containment (both surfaces); the drive recorder tail (passes complete, failures 0, outcomes explained by the plans they name); the plans list (every non-terminal or newly terminal plan cross-checked against Julie's known submissions — a plan nobody submitted is an ANOMALY); quota + reconcile (drift empty; attempts-vs-dispatches shape sane); phase accounting per phase; conflicts (exactly 4); bindings watermark.
- **Accounting checks** (daily, the soak's real substance): settled movement matched 1:1 to the plans that explain it (an unexplained settled delta = ANOMALY); any single chapter's settled vs its quote (the §8.3 2× signal, generalized); `estimatedUnverified` monitored for AGING — any estimated-unverified item older than 7 days without a disposition path flagged as MOVEMENT for a Julie disposition decision (the FP straddler's 19,018 is the known baseline and is reported as standing, not re-flagged daily); `reservedUnverified` returning to baseline when no plan is in flight — a reservation surviving its plan's terminal state by > 24 h is a LEAK flag (Gate 3's lesson: stuck reservations are this system's known failure shape, and the finalizer exists for them under separate authorization); month-to-date settled vs the $50 cap trajectory.
- **Classifications**: **NORMAL-OPS-QUIET** (no movement, or movement fully explained by Julie's known submissions with clean accounting — logged; a one-line note to the Coding Projects chat on the day only if anything at all moved) · **NORMAL-OPS-MOVEMENT** (explained movement worth reporting: a plan completed, a park with its reason — including a `parked_budget` event under §4.4's disclosure — a submission Julie made that Wren had not seen: reported to Julie the same day, no act) · **NORMAL-OPS-ANOMALY** (unexplained movement, reconcile drift, a recorder discrepancy, a reservation leak, a conflicts change, a containment deviation: immediate report to Julie + a board note for the record; §7's triggers are evaluated FIRST — if one fires, the re-hold precedes the report, and the report names both).

### 8.6 A6 — Declaration criteria, and the prohibition

Normal operations are DECLARED only when ALL of the following stand:

1. The smoke completed with its full §8.3 evidence set, AND Julie's playback acceptance of the smoke chapter is recorded.
2. The seven-day soak completed, with a §8.5 check logged for every day (a missed day extends the soak by that day — PROPOSAL).
3. End-of-soak accounting is clean: reconcile `ok`, no unresolved aging flags, no reservation leaks, every settled unit of the soak explained by a named plan.
4. No NORMAL-OPS-ANOMALY stands unresolved at declaration. (An anomaly that fired and was dispositioned in writing does not bar declaration; an emergency re-hold during the soak VOIDS the soak — declaration then requires a fresh turn-on gate after Julie's fresh GO, never a resumed soak. PROPOSAL, for ruling.)
5. The turn-on execution record (census, lifts, smoke, soak log, accounting) is filed and Rowan's documentary review of it is ACCEPTED — declaration is pronounced in Wren's filing of her acceptance, not before (the standing pattern).
6. Julie confirms the app-side experience matched the design (her submissions behaved as the client promised: quoted confirmations, plan status in plain words, audio arriving on her devices).

**THE PROHIBITION, stated as the ruling requires**: smoke success alone is NOT normal-operations acceptance. The smoke proves one chapter, submitted under observation, on a system whose guards were never in question. Normal operations is a claim about a STEADY STATE — Julie generating unobserved, the accounting staying clean across a week of real use, the observation arrangement having actually run — and it stands only on the full set above. Until declaration, the system's state is named exactly what it is: **turned on under observation**.

---

## 9. The revised GO wording — PROPOSAL for Rowan's review (NOT for presentation)

_This wording is returned for Rowan's review only. It may be presented to Julie only after Rowan accepts the revised proposal (the Q-7 pattern from the resume gate). It is drafted on §8.4's PROPOSAL (additional soak submissions allowed); if the alternative is ruled, the soak clause is conformed before presentation. On Julie's GO, it is recorded on the board BEFORE the execution census (the established ordering)._

> "GO — execute the Standard turn-on gate under the revised design as pinned at `<DESIGN-PIN>`: a fresh execution census against the fifteen A1 predicates (the script etag captured and saved as an evidence artifact before any lift; containment NORMAL; conflicts exactly the four baseline rows; the five baseline plans all terminal and none held; the parked Chapter 3 job `parked_policy` revision 1, untouched; settings revision 1; quota reconcile ok with the sole known straddler; phase figures and sync watermarks at their design values; the recorder alive with a standing registration; the smoke chapter's quote reproduced; and the OQ-5 post-gate duty verified closed and its watch terminated) — any predicate failure or unexplained movement stops the gate before any act and returns for ruling; then exactly two counted production acts, in order: one halt lift (the metadata-only envelope flip of `GENERATION_HALT` to `"0"`, all script parts byte-identical to the live build, etag and observability verified after) and one queue unpause (cf-api, read back); then the bounded smoke — I submit Forever Pucked Chapter 4 (chapter scope, `keepGoing` off, Standard lane, phase forever-pucked; expected 20 segments ≈ 375,535 units) from my own app, or another single chapter I name when I give this GO — observed read-only under the sliding 35-minute stall test and the A-7 recorder discipline, its completion evidence the full A3 set (plan done 20/failed 0, exactly 20 new bindings, watermark 1862, the three-line exposure report), and my playback of the chapter as its acceptance, outside the executor's verdict; then a seven-day soak from the accepted smoke, during which I may submit further Standard intents for onboarded books (Forever Pucked) inside their phase budgets, under the soak restrictions (no Batch, no mid-soak onboarding, no settings writes, no operator-route acts, no deploys except under separate authorization) and the daily `normal-ops-daily-check` observation (owner Wren; QUIET / MOVEMENT / ANOMALY classifications; the accounting checks as designed); the emergency re-hold standing throughout — Julie's word at any time, or Wren's preauthorized act on any of the nine enumerated triggers — executed as exactly two verified acts (re-pause, then re-halt) with immediate reporting, after which any re-turn-on needs my fresh GO through a new gate; **NO Batch arming or Batch act of any kind, NO book onboarding (no budget deploy, no phase-binding record), NO quarantine release, NO plan retirement, NO adjudication or reconcile act, NO settings write, NO SubmitJob by Wren, NO containment transition**; on success the gate ends TURNED ON UNDER OBSERVATION — the holds stay lifted by design — and normal operations are declared only on the full A6 set (the accepted smoke, a complete clean soak, clean end-of-soak accounting, no unresolved anomaly, the filed execution record with Rowan's acceptance, and my confirmation of the app experience), never on the smoke alone; on any abort after the lifts the re-hold pair runs, the gate ends HELD, and the soak is void. I understand the per-book budget law stands (Q1): only Forever Pucked is onboarded; any other book requires the onboarding procedure under its own authorization before it can generate."

---

## 10. What this package does NOT authorize

Everything production, exactly as the ruling's §6 states: no halt flip, no queue unpause, no settings write, no deploy to any worker, no phase-binding record, no budget-constant change, no SubmitJob or other generation command, no provider call, no containment transition, no quarantine release, no plan retirement, no adjudication, no conflicts-row disposition, no parked-job act, and no GO presentation to Julie. The reads behind §2 were read-only. Workstream 2 is untouched by this package beyond carrying the scoping assessment forward; the B-G1 design proposal is a separate document under the same "next authorized work."

## 11. Open items carried for Rowan's ruling (not silently resolved)

- **OI-1 — The P4/P5 verdict class.** `parked_budget` and `parked_storage` are mechanically re-tested every pass but cannot clear by the lift or by time; the matrix classifies them RE-TESTED rather than AUTO or NO. If Rowan wants them in the ruling's "must not resume" floor by NAME (they are budget/storage cases, not safety/quarantine/billing/operator cases), the classification is hers to move — the mechanics stated are not in dispute either way.
- **OI-2 — §8.4's soak-submission proposal** (allowed, onboarded books only) vs the stated alternative (none). The GO wording follows the proposal and must be conformed if the alternative is ruled.
- **OI-3 — PROPOSAL figures awaiting ruling**: the §8.3 dispatch signal (60/day for the smoke chapter), T-6's 95% storage figure, T-9's 10-consecutive-failure figure, §8.6.2's missed-day extension, §8.6.4's re-hold-voids-the-soak rule. Each is marked PROPOSAL where it stands.
- **OI-4 — §4.2's wrong-book binding hazard** is controlled procedurally only (no unbind writer exists). If Rowan judges a procedural control insufficient for an irreversible record, the remedy is a design question (a gated unbind/rebind path) that belongs to a future build ruling, not to this package.
- **OI-5 — The §4.4 FP disclosure**: the standing $13.50 figure sits below the proposed rule's projection floor (≈ $14.74) for the book's worst-case shape. No change to FP's figure is proposed here; whether Julie wishes to raise it (a figure decision + an O1 deploy, under separate authorization) is flagged for the record, and the soak's accounting checks watch for the `parked_budget` outcome either way.

— Wren (drafted 2026-11-06; design only, for Rowan's review)
