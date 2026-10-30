# Chapter 2 recovery — unknown-billing ADJUDICATION proposal

**Status: PROPOSAL ONLY.** Prepared by Wren at Rowan's assignment in her
evidence-based closeout of the combined Chapter 2 halted deployment
(issue #15, comment 6533495004): *"Wren's to prepare the next separate
Chapter 2 recovery/unknown-billing adjudication proposal, with the
provider-billing evidence requirement and bounded transitions; Julie's
for the future action approval."* This document takes no production
action and authorizes none. Execution requires (a) Rowan's review of
this proposal and (b) Julie's separate approval of the exact scope in
§6, in that order.

**Update (Oct 30, 2026, during preparation): the provider billing
evidence arrived ahead of schedule** — Julie provided it at
~5:13 p.m. ET today, before this proposal was even filed. It is
incorporated as **Exhibit A (§2.5)** with its reconciliation, and the
decision rule now carries an explicit aggregate-evidence sufficiency
question for Rowan's ruling (§2.4–§2.5).

**Correction (Oct 30, 2026, per Rowan's focused HOLD, issue #15
comment 6533798118 — both corrections applied in this revision):**

- **HOLD 1 (evidence honesty).** Two certainty claims in the
  original §2.5 are **RETRACTED** as too strong and are removed
  wherever they appeared: (i) that Exhibit A **"refutes
  no_charge"**; (ii) that **"no alternative attribution
  exists"** for the window remainder. The corrected conclusion
  (§2.5, restated): Exhibit A establishes a Google-confirmed
  **account/day aggregate** ($0.20 net for Oct 24–30, all on
  Oct 29, rounded to cents) and is **consistent with** the
  unknown attempt having been charged — among several
  distributions — but it **proves neither `no_charge` nor
  `failed_known` at 19,652 micro-cents**. Under §2.4, the only
  justified branch **on the evidence currently in hand is STOP
  — no reconciliation call**. The §2.5 arithmetic is retained
  only as an illustration of one possible distribution, labeled
  non-attributive. The attribution research (§7, companion
  document `BILLING-ATTRIBUTION-RESEARCH.md`) shows no
  allocation of the day aggregate reaches per-attempt proof.
- **HOLD 2 (read-back contract).** §3 Steps 3 and 6 and the
  footprint narrative are corrected to the deployed code:
  `genstore.reconcileUnknown` updates `d6_attempt_log`,
  possibly `d6_phase_state`, and writes `d6_reconcile_audit` —
  it does **not** call `transitionExecution` and does **not**
  update `d6_execution_records`; `retireHaltedPlan` changes
  plan state/audit only. A successful reconcile is therefore
  expected to leave the settled attempt's execution in state
  `unknown_billing` as historical provenance; expecting a
  transition to `failed` would falsely STOP a valid settlement.
- **Status consequence.** **§6 is NOT submitted as a go** on
  the current evidence. The run described in §3 does not
  proceed until a Rowan-accepted basis exists: either
  provider-attributed evidence at the §2.4 standard (§7
  research), or the separately designed, transparently marked
  uncertainty disposition outlined in §8 — which itself needs
  Rowan's ruling, a code change, source review, a halted
  deploy, and Julie's fresh approval before any use. **Julie
  needs to provide nothing further for this revision.**

**References.** Rowan's B1/B2/B3 source PASS + the standing
provider-evidence requirement (6532307605); deploy operational-plan
PASS (6532917893); Julie's deploy approval (6533012361); deploy
execution record (6533267319); deploy closeout PASS (6533495004);
halt diagnosis (`~/workspace/d6-build/deploy-evidence/followon-fp/
ch2-halt-diagnosis.md`, Oct 29, 2026). Deployed remedy source:
`worker/generation/genstore.mjs` (`reconcileUnknown`),
`worker/generation/service.mjs` (`reconcileUnknownAttempt`,
`retireHaltedPlan`), `worker/worker-entry-prod-d6.js`
(`/v2/d6-reconcile-unknown`, `/v2/d6-retire-halted-plan`,
`/v2/d6-diagnostics`), `worker/generation/d6-executor.mjs`
(dispatch fence) — all live in build `28850807…`.

---

## §1 Objective and exact scope

**Objective.** Close out the halted Chapter 2 plan
`plan:603ab416bd67ab1b25de97be` (Forever Pucked, book
`5c589095-f812-48a2-8ab2-03ba2791f2b2`, chapter scope) honestly:

1. **Settle exactly ONE attempt** — the plan's single
   `unknown_billing` attempt — recording what the provider actually
   charged for it, established from **independent provider billing
   evidence** (§2), via the operator-only
   `POST /v2/d6-reconcile-unknown` route.
2. **Retire the halted plan** via the operator-only
   `POST /v2/d6-retire-halted-plan` route, which is reachable only
   once no unknown attempts remain open for the plan.

That is the entire scope: **two bounded operator calls, each with
read-backs, inside one attended run.**

**Current status of that objective (per the Correction block
above):** on the evidence currently in hand, no settlement
branch fires under §2.4 — the justified branch is **STOP**
(Rowan, 6533798118) — so this run does not take place on
Exhibit A. §3 remains the binding run specification for when
a Rowan-accepted basis exists: provider-attributed evidence
(§7 research), or the §8 uncertainty disposition **if** it is
separately designed, reviewed, built, deployed, and approved.
Nothing in this document performs, schedules, or requests the
run today.

**Explicitly NOT in scope** (each remains its own later, separate
proposal and Julie gate):

- **Re-arm** — no halt flip (`GENERATION_HALT` stays `"1"` for the
  whole run and at its end), no queue unpause
  (`opalreader-generation-v2` stays PAUSED), no settings change.
- **No generation** — no intent submission, no provider contact, no
  quota consumption, no spending. The reconciliation records a
  historical charge; it does not create work, a grant, or an
  execution, in either halt state (service.mjs, fix-2 header note).
- **No Chapter 3 action** — the parked job is read only as an
  inventory-equality witness (fingerprint must remain exact).
- **No quarantine release**, no other plan or attempt, no client
  publication, no deploy. The settlement touches the one named
  attempt; the retirement touches the one named plan.
- **Nothing auto-resumes.** Reconciliation leaves the plan in state
  `halted_unknown` by design (the driver excludes `halted_unknown`
  plans at selection — R4-1); retirement moves it to the terminal
  state `retired`. Neither outcome can wake the plan.

**Why retirement, not resumption.** The halted plan's 18 occurrences
sit under an unreported grant whose executions are final (8 failed,
1 unknown, 9 never attempted; the build that ran it had no repair
driver). The designed exit from a `halted_unknown` plan is exactly
this pair — reconcile the unknowns, then retire — after which the
segments become re-runnable only under a **fresh intent** (§5). The
admission fence counts a `halted_unknown` plan as owning its
segments until retirement clears that ownership
(service.mjs, R3-2 semantics).

**Stale queue messages and the fence (required statement).** The
closeout (6533495004) notes the D4 evidence is "not evidence that
the queue has no stale messages." This proposal does not re-arm, so
no message can be consumed during it (queue PAUSED; and while
`GENERATION_HALT="1"` the queue consumer refuses at layer 1 —
`assertGenerationEnabled` throws before the coordinator is
touched). For the later re-arm gate, the treatment is already live
in build `28850807…` and is stated here so that gate can rely on
it: when the halt is eventually flipped under a separate approval,
any stale or redelivered message for this plan's job reaches the
executor's pre-claim fence (`d6-executor.mjs`), which

- resolves the plan identity from **persisted server records only**
  (`resolvePlanForFence`: `d6_plan_jobs` + the job's persisted
  `data_json` stamp), never from message-carried fields — each
  present message field (`planId`, `d6PlanId`) is validated
  independently against the resolved identity and any disagreement
  or malformed value refuses as `plan_link_mismatch` (F1);
- reads the quarantine hold against that resolved identity
  (`heldQuarantineStrict`, fail-closed on read errors);
- refuses pre-claim for every non-dispatchable plan state —
  `PLAN_STATES_REFUSED = {complete, partial, retired,
  halted_unknown}` → `{refused: "plan_not_dispatchable"}` — so a
  stale message is refused **whether it arrives before this
  adjudication (plan `halted_unknown`) or after it (plan
  `retired`)**;
- a refusal is a **normal return**: `_execute` answers 200 and the
  queue handler ACKs — the stale message is consumed exactly once,
  never retried into the fence, with **zero claim, zero grant, zero
  provider calls, zero spend-intent or attempt rows** (fence suite
  T1: a production-shape Chapter 2 replay is refused with zero
  provider calls and byte-identical ledger/claim/attempt/execution
  rows; suite 29/29, live in the deployed build).

Independently of messages, the plan driver never selects a
`retired` plan (terminal everywhere) or a `halted_unknown` plan
(R4-1), so no alarm cycle can wake it either.

---

## §2 The billing-evidence requirement

**Evidence classes — kept separate throughout (per Rowan's
HOLD 1, 6533798118).** Everything cited in this section is one
of two kinds, and the two are never blended:

- **(a) Google-confirmed:** exactly one datum so far — the
  account/day aggregate in Exhibit A (§2.5): **$0.20 net for
  Oct 24–30, 2026, all of it on Oct 29, rounded to cents**,
  read from Google's own AI Studio billing view. Google has
  confirmed nothing at per-request granularity for this
  account (§7 research: no surface Google offers can
  attribute an Oct 29 charge to a single request
  retroactively).
- **(b) Application-recorded:** every per-attempt figure in
  our own records — the attempt log's outcomes and costs
  (including the 8 failures' cost 0 and the smoke's settled
  $0.017749) and all grant-time estimates — was written by our
  system under its own conventions (known failures are
  confirmed at cost 0 by construction; settled costs are the
  system's estimator outputs). These are our records of the
  run, **not** provider confirmation of what Google billed
  for any individual attempt.

**Rule (Rowan, 6532307605, carried into 6533495004).** The operator
must hold **independent provider billing evidence** before
asserting `no_charge` or any known cost. The reconcile route's API
shape is not proof of the billing fact. A settlement recorded
without evidence is a fabricated billing record: a wrong
`no_charge` would understate real spend against the phase budget;
a wrong charge would overstate it. **No evidence, no settlement —
the run stops at the §3 Step 1 gate.**

### 2.1 The attempt to be adjudicated (structural metadata only — no segment text)

- Plan: `plan:603ab416bd67ab1b25de97be`; book
  `5c589095-f812-48a2-8ab2-03ba2791f2b2`; phase `forever-pucked`;
  lane `standard`; the plan's chapter job (diagnosis record suffix
  `:ch1`; full jobId read fresh from diagnostics at the gate).
- The attempt is the plan's **only** attempt-log row in phase
  `confirmed` with outcome `unknown` and cost NULL — exactly one
  such row exists (diagnostics at D4 of the deploy: 51 Ch 2
  confirmed attempts = 50 known + this 1 unknown). The plan's
  other 8 attempted executions are **recorded in the local
  attempt ledger** as `failed_known` at cost 0 — a (b)-class
  local accounting convention (the executor confirms every
  known failure at cost 0 by construction), **not** provider
  confirmation that Google billed $0.00 for any of them.
- Its execution is the plan's only execution in state
  `unknown_billing`; it was the last execution attempted in the
  Oct 29, 2026 run (the executor stopped the message at the first
  unknown outcome; the 9 later occurrences were never attempted).
- Run window: grant issued **Oct 29, 2026 ~19:16 ET (23:16Z)**; the
  run's activity falls inside **23:16Z–23:30Z, Oct 29, 2026** (the
  window the diagnosis used for its telemetry query).
- Provider/model: Gemini API, `gemini-3.8-flash-tts`, via the
  v1beta interactions endpoint, billed against Julie's AI Studio
  prepay account.
- Diagnosis (most likely cause): the fetch's 120-second
  `AbortSignal.timeout` expired mid-generation — a throw carrying
  neither `httpStatus` nor `contentBlocked`, hence `unknown`. At
  the §3 Step 0 diagnostics read, the attempt's `durationMs`
  (updated − created) is expected to corroborate this (≈120,000 ms
  span ⇒ timeout; a near-instant span would point at the runner-up
  classes — truncated-body JSON parse or base64 decode — and must
  be reported in the run record, though it does not change the
  settlement rule, which turns on billing evidence, not mechanism).
  The attempt's `providerRequestId` is expected to be null (no
  response was received). The execution's stored error message is
  exposed, sanitized, via the same diagnostics read.
- Money units: the system's unit is the micro-cent as implemented —
  the smoke segment's 17,749 units settled at **$0.017749**, i.e.
  **1 unit = $0.000001; USD × 1,000,000 = knownCostMicro**. The
  unknown attempt's grant-time ledger estimate was **19,652 units
  (≈ $0.0197)** — the job's flat per-occurrence estimate
  (`ceil(mean(expectedCostMicro))` over the 18 entries). It is an
  **estimate written at grant time**, and it must never be
  recorded as the known cost. **Rowan has ruled on the
  sufficiency question (6533798118): the §2.5 aggregate does
  NOT make 19,652 — or any other figure — the attributable
  known cost of this attempt.** The uniform-estimate
  reconciliation in §2.5 is one possible distribution of the
  day's spend among several (§7), nothing more. The attempt's recorded
  upper bound (`upperMicroCents` on the attempt row, chars/10 rate)
  is read fresh at Step 0 and bounds any attributable charge.

### 2.2 What evidence suffices

Evidence is sufficient when the operator can reconcile the
**total Gemini charges for the Oct 29, 2026 run window** against
the window's known items, leaving the unknown attempt as the only
unaccounted call:

- **Primary:** Google billing records for Julie's own account (the
  account that owns the Gemini API key / AI Studio prepay) covering
  **Oct 29, 2026**, showing charges for the Gemini API
  (`generativelanguage`) at day granularity or finer — e.g. the
  Cloud Billing report for that date filtered to the Gemini API
  service, and/or the AI Studio prepay transaction/usage history
  showing deductions in the window. A **screenshot is acceptable
  evidence** (Julie's Oct 29 prepay-balance screenshot was verified
  exactly this way); the operator reads values from it and records
  them in the run record with the evidence reference.
  **This primary evidence has in fact been provided** — Julie's
  AI Studio billing screenshot of Oct 30, 2026, incorporated as
  Exhibit A in §2.5. It is *aggregate* (window-level) evidence,
  and **Rowan has ruled (6533798118) that it is NOT sufficient
  for the charged branch of §2.4**: it establishes a day-level
  aggregate, not a per-attempt known cost. It stands as
  contextual evidence (§2.5 as corrected). No finer-grained
  provider record that could attribute the charge exists or
  can be obtained retroactively (§7 research).
- **Known items the window must reconcile against:** (a) the G10
  smoke segment, **recorded settled at $0.017749 in our own
  ledger** — a (b)-class figure: one successful request earlier
  the same evening (~22:36Z), its cost being our estimator's
  output, not a Google line item; (b) the 8 failed Ch 2 calls —
  classified `failed_known` in the local attempt ledger and
  recorded there at cost 0 **by local convention** (§2.1);
  their response character (HTTP 200, no audio content part)
  is established by the diagnosis and the B1 evidence, but
  **what Google billed for them, if anything, is not
  established by any record we hold**; (c) the 1 unknown
  attempt — the only call whose charge is in question. Per our
  records (a (b)-class statement), there was no other
  generation activity on the account that evening — the Ch 2
  run and the smoke are the Oct 29 generation record, and the
  queue has been paused and generation halted since; that
  premise is itself part of what an attribution would have to
  independently support, not a Google-confirmed fact.
- **Aggregate cross-check (supporting, never sufficient alone):**
  the prepay balance history — **$20.00 top-up added Oct 17,
  2026; balance $17.83 verified by Julie's screenshot Oct 29,
  2026** — bounds total account consumption across the whole
  period. Because it aggregates *all* account activity since the
  top-up, it can sanity-check the window records but can never by
  itself settle this attempt.

### 2.3 How Julie obtains it (the one personal action in this gate)

Only Julie can access her Google account's billing records; Wren
has no connector to them. **She has already taken these steps and
provided the screenshot (Exhibit A, §2.5)**; they are recorded
here as the exhibit's provenance. Rowan did require a
finer-grained basis (6533798118); the §7 research establishes
that none can be obtained retroactively for Oct 29, 2026, so
**no further step of Julie's is requested or expected** — the
steps below stand as provenance only. Concrete steps, on her phone or iPad:

1. Open **Google AI Studio** (aistudio.google.com), signed in with
   the Google account that owns the Gemini API key → open the
   **Billing** section → view the prepaid-credit **transaction /
   usage history** for **Oct 29–30, 2026**. Screenshot what it
   shows (deductions and amounts).
2. If AI Studio shows purchases but not per-day usage charges,
   open **Google Cloud Console** (console.cloud.google.com) →
   **Billing → Reports**, set the date to **Oct 29, 2026** and
   group/filter by service = **Gemini API**, and screenshot the
   day's total; the **APIs & Services → Gemini API → Usage** view
   for Oct 29 (request counts) is a useful second screenshot.
   (Menu labels may vary slightly; what matters is a Google
   record showing what the Gemini API charged on Oct 29, 2026.)
3. Send the screenshot(s) to Wren in chat. That is the whole
   ask — Wren does the reconciliation arithmetic and records the
   evidence reference; Julie never touches the operator routes.

### 2.4 Decision rule (evidence → settlement)

Applied at the §3 Step 1 gate, before any call. Exactly one branch
may fire:

| Evidence shows | Settlement (route body) |
|---|---|
| Window charges reconcile to the known items alone — **no charge attributable** to the unknown attempt (remainder $0.0000, allowing ≤ $0.001 rounding) | `outcome: "no_charge"`, `knownCostMicro: null` |
| A charge **is** attributable to the unknown attempt: the window remainder after the known items is **> 0 and ≤ the attempt's recorded upper bound** (`upperMicroCents`), and the unknown attempt is the only unaccounted call that could carry it | `outcome: "failed_known"`, `knownCostMicro: ` remainder × 1,000,000 (rounded to the nearest unit) |
| Anything else — records unavailable; window cannot be isolated; remainder exceeds the upper bound; balance cross-check contradicts the window records; attribution contestable | **STOP.** No settlement is recorded, no call is made, the plan stays `halted_unknown`, and the ambiguity is escalated to Julie and Rowan with the evidence as-obtained |

Notes on the vocabulary (from the deployed store,
`genstore.reconcileUnknown` + the B2 correction):

- The (cost, outcome) pair is validated as a pair: a null cost
  settles **only** as `no_charge` (the attempt log then records
  `failed_known` @ 0, and the distinct `no_charge` value lives in
  the audit row's `final_outcome`); a numeric cost **never**
  settles as `no_charge`; `success` requires a finite known cost.
  The route refuses inconsistent pairs
  (`reconcile_settlement_inconsistent`) — a malformed request can
  never silently become a no-charge settlement.
- **`failed_known`, not `success`, for a charged attempt.** Reader
  received no audio from this call: nothing was flushed, verified,
  or committed, and no binding exists. From the system's side the
  call is a charged-but-failed call — the diagnosis's intended-path
  wording exactly. `success` would falsely assert a usable result
  exists and is therefore not an available branch of this
  adjudication, whatever the evidence shows about Google's side.
- The settlement is recorded with an audit row
  (`d6_reconcile_audit`: attempt, plan, phase, settlement outcome,
  final cost, note, source, timestamp) **in the same transaction**
  as the attempt update — there is no state in which the attempt
  moves without its audit row. The operator's `note` will carry
  the evidence reference (what Julie provided, its date coverage,
  and the reconciled figures) so the settlement stays traceable
  to its evidence.
- **The evidence in hand is aggregate, not a per-request line
  item — and Rowan has ruled (6533798118).** The table above is
  written for evidence that attributes a charge to the attempt.
  The window-aggregate exhibit actually provided (Exhibit A,
  §2.5) does not perform that attribution: **neither `no_charge`
  nor `failed_known` at any figure is proven by it**, and the
  §7 allocation research confirms no defensible allocation of
  the day aggregate reaches per-attempt proof. **On the
  current evidence, the only branch of this rule that fires is
  the STOP branch: no settlement is recorded, no call is made,
  the plan stays `halted_unknown`.** A settlement under this
  rule requires evidence of a kind §7 shows Google cannot
  supply retroactively for Oct 29 — or the different,
  separately governed disposition outlined in §8, which does
  not operate under this rule's known-cost claim at all.

### 2.5 Evidence in hand — Exhibit A (provided Oct 30, 2026)

**Exhibit.** A screenshot Julie provided on Oct 30, 2026
(~5:13 p.m. ET) of her Google AI Studio billing view
(aistudio.google.com), 7-day window, all API keys, all models.
The image itself is **held in the local case file**
(`~/workspace/ch2-program/adjudication/evidence/`, with Wren's
reconciliation note) and is **not reproduced in this pinned
proposal** — no account-private data is published; the figures
below are the adjudication-relevant facts read from it:

- Window **Oct 24–30, 2026**: list cost **$0.40** − savings
  **$0.20** = **net total $0.20** (intro/net rates).
- The daily chart shows a **single bar on Oct 29, 2026**
  (~$0.20) and **zero on every other day** of the window.
- (A month-to-date spend-cap card also appears in the shot; it
  is context only and plays no part in this adjudication.)

**What the exhibit is (corrected statement of strength).**
Exhibit A is **(a)-class evidence of exactly one fact**: Google
billed this account **$0.20 net in total for Oct 24–30, 2026,
all of it on Oct 29** (list $0.40 − savings $0.20, figures
rounded to cents). It is valuable contextual evidence: it
bounds the day's total Gemini spend and corroborates that
Oct 29 carried real, non-trivial charges. It is **not** a
per-request record, and — per Rowan's ruling (6533798118) —
it does not attribute any charge, or absence of charge, to
the unknown attempt.

**One possible distribution — ILLUSTRATION ONLY,
non-attributive.** The arithmetic below was the original
filing's reconciliation. It is retained **solely** as an
illustration of *one* distribution of the day total that is
consistent with the aggregate; it is **not** an attribution
and supports no settlement:

- Oct 29, 2026 was, per our records, the account's only
  provider-activity day in the window: the G10 smoke + the
  Chapter 2 run are the day's entire generation record
  (a (b)-class premise).
- Smoke (Forever Pucked Ch 4 Seg 1): recorded settled in our
  ledger at **$0.017749** (a (b)-class estimator figure).
- Remainder for Chapter 2 under this illustration:
  $0.20 − $0.018 ≈ **$0.18**.
- Chapter 2 made exactly **9 provider attempts** (8 failed +
  1 unknown); the flat per-attempt grant-time estimate is
  **$0.019652** (19,652 units). 9 × $0.019652 = **$0.176868
  ≈ the remainder** (the screenshot total is rounded to the
  cent, so exact agreement is neither expected nor required).

**Retracted claims (named, per HOLD 1).** The original filing
asserted on the basis of the illustration above that the
aggregate **"refutes a `no_charge` settlement"** and that
**"no alternative attribution of the remainder exists."**
**Both assertions are retracted.** They were wrong: the
remainder can be distributed across the nine Chapter 2
attempts in many ways — including distributions in which the
unknown attempt was charged nothing and the eight failures
absorbed the whole remainder, and distributions in which the
charges fall unevenly — and the exhibit cannot select among
them. The 8 failures' cost-0 is a **local ledger record**
(§2.1), not provider confirmation they were billed $0; the
proposal's illustration silently assumed they were charged at
the estimate, which is the very fact in question.

**Corrected conclusion.** The aggregate is **consistent
with** the unknown attempt having been charged — the
illustrated distribution is one of several that fit — and it
**proves neither `no_charge` nor `failed_known` at 19,652
micro-cents** (nor at any other exact figure: a cent-rounded
aggregate over ten requests cannot certify a sub-cent
per-request amount). **Under §2.4, the only justified branch
on the evidence currently in hand is STOP — no
reconciliation call.** Rowan's ruling (6533798118) is
recorded here as the disposition of the sufficiency question
the original filing posed: **the aggregate is insufficient
for a known per-attempt cost.** The avenues that remain are
researched in §7 (provider attribution — concluded: not
obtainable at proof standard) and §8 (a transparently marked
uncertain/estimated-accounting disposition, outlined as an
option for Rowan's ruling and Julie's approval — not a
decided path).

---

## §3 Bounded execution sequence

One attended run, in this order. Every value named as "expected"
is an **expectation to re-verify fresh at this gate** (per the
closeout's fresh-reads requirement), not carried-forward proof.
Any mismatch is a STOP (§4). Tooling: operator connector
`custom.opalreader-v2-prod-operator` for the two POSTs and the
diagnostics read (every `/v2/*` call carries
`X-OpalReader-Scope: production` and
`X-OpalReader-Instance: account`); client connector
`custom.opalreader-v2-prod` for plan/quota reads; cf-api for
script/queue/settings reads. No token values in any log or record.

**Step 0 — Fresh pre-state inventory (read-only).**
- `GET /health` → build `288508073b5218a6e0dd90b68d497a331ad872b6`,
  generation `"halted"`.
- cf-api GET script → etag
  `72a4ee815e01af5cd505c580999e73633bd355aceb8513f4e9b024eb526e4669`;
  GET `/settings` bindings → `GENERATION_HALT "1"`,
  `OPALREADER_PHASE_POLICY "enforce"`, 10 bindings.
- cf-api GET queue `opalreader-generation-v2`
  (`93b6a35fb8cf4788a91a2c90b748ae66`) → `delivery_paused: true`,
  sole consumer unchanged.
- Client reads: settings revision **1**; quota view
  {attemptsToday 0, spentMicroCents 371485, ledgerSeq 19};
  watermarks content 18 / bindings 1800.
- `GET /v2/d6-plans/plan:603ab416bd67ab1b25de97be` → state
  `halted_unknown`, stopReason `phase_halted_unknown_billing`,
  totals {eligible 18, done 0, failed 8}; execution states
  {failed ×8, unknown_billing ×1, none ×9}.
- `GET /v2/d6-diagnostics?planId=plan:603ab416bd67ab1b25de97be`
  (operator) → identify THE unknown attempt: exactly **one**
  attempt row with phase `confirmed`, outcome `unknown`,
  `costMicroCents` null. Record its `attemptId`, `executionId`,
  `occurrenceId`, `seq`, `upperMicroCents`, `providerRequestId`,
  `createdAt`/`updatedAt`/`durationMs`, and the execution's
  sanitized detail. Confirm **zero** attempts in `reserved` or
  `dispatching` phase across the plan, and that the other 50 Ch 2
  confirmed attempts are all known-outcome.
- Ch 3 witness: job view for the parked job + fingerprint
  recomputed by the G8 recipe → `b991f18a…` exact; plan list shows
  Ch 3 `parked_policy`, smoke plan `complete`.
- **STOP** on any deviation from the above, including a second
  unknown attempt or any in-flight attempt anywhere in the plan.

**Step 1 — EVIDENCE GATE (hard stop inside the run).**
The operator states, in the run record, the evidence in hand
(§2.2), the reconciled window arithmetic, and the single
settlement instruction the §2.4 rule produces (outcome +
knownCostMicro). **Execution may not proceed past this step
without evidence that fires exactly one branch of §2.4.** If the
rule fires the STOP branch, the run ends here: no calls have been
made, nothing has changed, and the ambiguity goes to Julie and
Rowan. (Julie's approval under §6 is approval of the *rule-bound*
settlement, given before the run; the evidence itself is what she
supplies under §2.3 — if the evidence she can obtain cannot fire
a branch, that is a STOP outcome, not a judgment call for the
operator.)
**Status of this gate today: NOT satisfiable — the run stops
here on current evidence.** Rowan's sufficiency ruling is on
record (6533798118): Exhibit A is insufficient for a known
per-attempt cost, and §7's research concludes no provider
record obtainable retroactively can attribute the charge.
The evidence in hand therefore fires **only the STOP branch**
of §2.4, and **Step 2 must not be reached**. This step becomes
passable only if a Rowan-accepted basis later exists —
provider-attributed evidence at the §2.4 standard, or the §8
uncertainty disposition after its own design, review, build,
deploy, and Julie-approval chain. When a run does occur, the
checkpoint verifies (a) the evidence/basis on file matches
what Rowan accepted, (b) her acceptance is on record, and
(c) Julie's fresh approval of that run has been given. §6 of
this revision is **not** that approval and is not submitted
as one.

**Step 2 — The reconcile call (exactly one).**
*(Unreachable on the evidence currently in hand — Step 1
stops the run; see its status note. Specified here, unchanged,
for the future run this proposal governs.)*
`POST /v2/d6-reconcile-unknown` via the operator connector, body:

```json
{
  "attemptId": "<from Step 0 diagnostics>",
  "planId": "plan:603ab416bd67ab1b25de97be",
  "knownCostMicro": <number ≥ 0, or null — per §2.4>,
  "outcome": "<failed_known | no_charge — per §2.4>",
  "note": "<evidence reference: source, date coverage, reconciled figures>"
}
```

(Request shape per the deployed route: `attemptId` and `planId`
required non-empty strings; `knownCostMicro` key required —
finite number ≥ 0 or exactly null; `outcome` required, one of
`success` / `failed_known` / `no_charge` — this adjudication
never sends `success`, per §2.4; the store verifies the attempt
belongs to the named plan, `reconcile_plan_mismatch` otherwise;
the recorded `source` is stamped `"operator-route"` server-side,
never caller-supplied.)
Expected response: HTTP 200
`{outcome: "applied", attemptId, attemptOutcome,
attemptCostMicroCents, settlementOutcome, haltCleared: true}` —
`haltCleared: true` is expected because this is the phase's last
open unknown: the phase's `halted_unknown_billing` flag clears in
the same transaction. (The plan itself remains `halted_unknown` —
Step 3 verifies exactly that.) Any `rejected` outcome, non-200,
or malformed/ambiguous response → §4 containment.

**Step 3 — Reconcile read-back (read-only).**
- Diagnostics for the plan again: the attempt now reads settled
  **in `d6_attempt_log`** — for `failed_known`: outcome
  `failed_known`, cost = the settled knownCostMicro; for
  `no_charge`: attempt row `failed_known` @ 0 with the distinct
  settlement outcome carried by the Step 2 response + audit
  record. Zero reserved/dispatching.
- **"Zero open unknowns" is defined by attempt rows** — zero
  `d6_attempt_log` rows for the plan with `phase = 'confirmed'`
  AND `outcome = 'unknown'`. That is the deployed retire
  guard's own test (`service.mjs` `retireHaltedPlan`, which
  counts exactly those rows and refuses with
  `unknown_billing_open` while any remain) and the phase
  accounting's `unknownOpen` (`genstore.mjs` `phaseAccounting`
  counts the same rows phase-wide). It is **not** defined by
  execution state.
- **Execution records: EXPECT NO CHANGE — this is the
  corrected read-back contract (HOLD 2, 6533798118), verified
  against the deployed source.** `genstore.reconcileUnknown`
  (`worker/generation/genstore.mjs`, the `reconcileUnknown`
  function) writes exactly three things: the `d6_attempt_log`
  UPDATE (outcome, cost, timestamp), a conditional
  `d6_phase_state` UPDATE clearing the phase's
  unknown-billing flag when its last open unknown closes, and
  the `d6_reconcile_audit` INSERT — all in one transaction. It
  does **not** call `transitionExecution` (that function is
  exercised by the executor's commit/fail/unknown-marking
  paths, not by the reconciler) and contains no write to
  `d6_execution_records`. `retireHaltedPlan`
  (`worker/generation/service.mjs`) likewise changes only
  plan state + its audit row. **The settled attempt's
  execution therefore remains in state `unknown_billing`
  after a successful reconcile, as historical provenance, and
  the plan-status read will still show it so — that reading
  is EXPECTED, not a discrepancy and not a STOP.** (The
  original filing expected a transition `unknown_billing →
  failed`; that transition exists in the store's
  `EXEC_TRANSITIONS` table but no reconcile/retire code path
  performs it — Rowan's correction, verified by Wren against
  the source.) Distinguish the two records: the **attempt is
  financially reconciled** (its billing question is settled
  in the attempt log + audit); the **execution remains an
  execution that ended without usable audio** — its state is
  run-time history and is not rewritten by a financial
  settlement. Test/source citation: the reconciler's write
  set above (`genstore.mjs` `reconcileUnknown`; wrapper
  `service.mjs` `reconcileUnknownAttempt`) and the B2 suite
  `tests/ch2fix-reconcile-route.test.mjs` (9/9 at the B2 pin;
  Rowan SOURCE PASS 6532307605), which pins the (cost,
  outcome) validation and the zero-movement refusals.
- Plan status: still `halted_unknown` (by design —
  reconciliation never resumes a plan, R4-1).
- Quota view **unchanged** {0, 371485, 19} — expected, not a
  discrepancy: the coordinator ledger is grant-time estimates and
  never trues up (§2.1; diagnosis Q2). The settlement lives in the
  attempt log + `d6_reconcile_audit`, which is the phase-budget
  accounting of record.
- The audit row itself has no read surface; it is verified by the
  Step 2 `applied` response (the row is written in the settlement
  transaction — an applied response cannot exist without it) plus
  this read-back of the settled attempt.
- **STOP** if the attempt did not settle as instructed, if any
  unknown remains, or if anything else moved. Do **not** proceed
  to Step 4 on a partial or surprising result.

**Step 4 — The retire call (exactly one; only if Step 3 is clean).**
`POST /v2/d6-retire-halted-plan` via the operator connector, body:

```json
{
  "planId": "plan:603ab416bd67ab1b25de97be",
  "note": "<run reference: adjudication of the unknown attempt per the §2 evidence, settlement outcome recorded>"
}
```

Expected response: HTTP 200 `{outcome: "applied", planId,
fromState: "halted_unknown", state: "retired", stopReason:
"retired_unknown_billing"}`. The transition and its audit row
(`d6_plan_retirements`, lazily created by this call — disclosed:
the table may not exist before this run; its creation is part of
this step's expected footprint) are written in one transaction.
A `rejected` response (`plan_not_found`,
`plan_not_halted_unknown`, or `unknown_billing_open` — the last
would mean Step 3's read-back was wrong) → §4 containment.

**Step 5 — Retire read-back (read-only).**
`GET /v2/d6-plans/plan:603ab416bd67ab1b25de97be` → state
`retired`, stopReason `retired_unknown_billing`. Diagnostics plan
summary agrees. The plan's entries/executions are otherwise as
read at Step 3 (retirement changes ownership/state only — no
entry, execution, or attempt is rewritten).

**Step 6 — Final inventory equality (read-only).**
Re-run every Step 0 read. **Everything must be identical to
Step 0 except the adjudication's own footprint**, enumerated
exhaustively:
1. the one attempt row: `unknown`/NULL → its settled
   outcome/cost (+ updated timestamp);
2. one `d6_reconcile_audit` row (new);
3. the phase `forever-pucked` unknown-billing halt flag:
   set → cleared (reported at Step 2);
4. the plan row: `halted_unknown` → `retired`, stopReason →
   `retired_unknown_billing` (+ updated timestamp);
5. one `d6_plan_retirements` audit row (new; table lazily
   created by Step 4 if absent);
6. **`d6_execution_records`: NO change — an expected-unchanged
   item, enumerated so its absence of movement is verified,
   not overlooked.** Every execution row is identical to
   Step 0, including the settled attempt's execution, which
   remains in state `unknown_billing` as historical
   provenance (Step 3's corrected contract: neither the
   reconciler nor retirement writes execution records). A
   read-back showing that execution still `unknown_billing`
   is the expected result of a successful run.

Unchanged, explicitly: worker build + etag; `GENERATION_HALT
"1"`; queue PAUSED with the same sole consumer; settings
revision 1; quota view; watermarks 18 / 1800; the other two
plans (smoke `complete`; Ch 3 `parked_policy`, fingerprint
`b991f18a…` recomputed exact); the plan's other 50 confirmed
attempts and all 9 of its attempted executions' records (per
item 6); grants and conflicts (the two
recorded `schedule_dead` rows). Any difference beyond the six
enumerated items → the run record reports it as an unresolved
deviation to Julie and Rowan (§4); nothing is "fixed" inside
this run.

**Step 7 — Record.** The execution record (per-step results,
evidence reference + reconciled figures, the settlement
instruction, both applied responses, all read-backs) is written
locally and filed on issue #15 for Rowan's closeout review,
exactly as prior gates. The run ends with generation HALTED and
the queue PAUSED.

---

## §4 Failure and containment

Mirrors the deploy's C2 discipline (6532917893), which Julie
approved for that gate and which this proposal adopts for this
one:

- **Any failed, rejected, or ambiguous response** at Step 2 or
  Step 4 — including a timeout or a response whose application
  cannot be determined — receives **read-back and containment
  only**: the operator reads the attempt/plan state (diagnostics
  + plan status) to establish what, if anything, was recorded,
  and **STOPs**. No automatic retry, no second call, no
  compensating action, no fix-forward inside this run.
- **A second attempt at either call requires Julie's fresh
  authorization**, informed by the read-back. (Both routes are
  fenced so a blind duplicate is structurally blunted — the
  reconcile store refuses an attempt that is no longer
  `confirmed`/`unknown` with `attempt_not_unknown`, and retire
  refuses a plan no longer `halted_unknown` — but that is a
  safety net, not a retry license.)
- **STOP conditions elsewhere:** any Step 0 mismatch; the §2.4
  STOP branch at Step 1; any Step 3 surprise (settlement did not
  land as instructed, unknowns remain, collateral movement); any
  Step 6 difference beyond the six enumerated footprint items.
  **Explicitly NOT a STOP:** the Step 3 / Step 6 read-back
  showing the settled attempt's execution still in state
  `unknown_billing` — that is the deployed reconciler's
  expected output (Step 3's corrected contract), and treating
  it as a failure would falsely condemn a valid settlement.
  In every STOP case the run record states what the read-backs
  show, and the turn returns to Julie (and Rowan, for review)
  before anything further.
- **Partial-completion honesty:** if Step 2 applies and a later
  step STOPs, the settlement stands as recorded fact (it is an
  evidence-based billing record, not a provisional state) and
  the plan remains `halted_unknown` with zero unknowns — a
  stable, fenced state that harms nothing and from which the
  retirement can be re-proposed. The run record must say
  exactly this rather than describing the run as failed
  wholesale.

---

## §5 What happens after (informational only — nothing here is authorized)

- The plan is `retired`; its fence ownership of the 18 segments
  is cleared. The segments themselves are untouched: **0
  committed, 0 bound by this plan** — the 20 already-bound Ch 2
  occurrences belong to the earlier v1-era record and are not
  this plan's.
- The 18 segments become re-runnable **only** via a **fresh
  intent** (a new plan), and only after the **separate re-arm
  gate** (halt flip + queue unpause, its own reviewed proposal
  and Julie approval — which will rely on the §1 fence statement
  for stale messages) **and** Julie's fresh generation go for
  Chapter 2. Submitting the intent before re-arm is refused by
  the halt fences; nothing in this adjudication submits one.
- The fresh run's prospects differ from Oct 29's by the now-live
  fixes: the 8 failed segments' root cause (the Gemini 3.8
  interactions branch mapping no-audio refusals to a synthesized
  502 without `contentBlocked`) is fixed by **B1** — refusals
  with clear policy evidence now engage the recursive
  POLICY_BLOCK splitting path; the **pre-split at 1,200 chars**
  (B3) reduces exposure to the 120-second ceiling that most
  likely produced the unknown attempt; genuinely unclassifiable
  no-audio responses now land in the unknown-billing path
  (fail-closed) rather than being misclassified as known
  failures.
- Expected fresh-run size, for planning only: 18 segments,
  25,091 chars; settled-equivalent projection well under $1 at
  the recorded rates, inside the $13.50 Forever Pucked phase
  budget and the $50 cap; split sub-calls multiply request count
  but remain far inside the 100/day rolling quota. None of this
  is a request — it is context for Julie's later, separate
  decisions.

---

## §6 Julie's approval — exact text of the ask

> **STATUS: NOT SUBMITTED.** Per Rowan's HOLD (6533798118),
> the text below is **not** presented to Julie as a go, and
> no approval is sought on the current evidence: the §2.4
> STOP branch governs (Exhibit A insufficient for a known
> cost; §7 attribution research negative at proof standard).
> The text is retained, corrected, so the exact scope of a
> *future* ask is on record for the run if a Rowan-accepted
> basis comes to exist — provider-attributed evidence (§7),
> or the §8 uncertainty disposition after its own design /
> review / build / deploy chain, which would carry its own
> differently-worded ask. Julie needs to provide nothing
> further for this revision.

> **Approve the Chapter 2 adjudication run — one attended run,
> exactly as proposed:** (1) I will settle the one unknown-billing
> attempt on plan `plan:603ab416bd67ab1b25de97be` with a single
> operator call to `POST /v2/d6-reconcile-unknown`, using **only**
> the outcome and cost that your Google billing evidence produces
> under the proposal's decision rule (§2.4) — `no_charge` with a
> null cost if the evidence shows no charge for the attempt, or
> `failed_known` with the evidenced cost if it shows one; if the
> evidence is ambiguous, the run stops with nothing recorded.
> (2) If — and only if — that settlement reads back clean with
> zero unknowns remaining, I will retire the halted plan with a
> single operator call to `POST /v2/d6-retire-halted-plan`. Fresh
> read-backs before and after; any surprise stops the run with
> no retry (a second attempt would need your fresh go). The run
> ends with generation still halted and the queue still paused.
> **Not authorized:** re-arm, halt flip, queue unpause, any
> generation or provider contact, Chapter 3, quarantine release,
> any other plan or attempt, any deploy or client change.
>
> **Evidence basis (corrected):** your Google billing
> evidence (§2.5, Exhibit A — your Oct 30 AI Studio
> screenshot) is in hand and stands as context, but Rowan has
> ruled it **insufficient to record a known cost** for the
> unknown attempt, and the attribution research (§7) shows
> no finer-grained provider record can be obtained for that
> day. This approval text therefore takes effect only if a
> basis Rowan accepts exists when the ask is actually made;
> on the evidence as it stands, the run stops at its evidence
> gate and nothing is recorded.

---

## §7 Billing-attribution research — summary

Full research: companion document
**`BILLING-ATTRIBUTION-RESEARCH.md`** (pinned alongside this
proposal). Question put by Rowan (6533798118): can a provider
billing/usage record attribute charge or no-charge to the
unknown attempt — by request, narrow timestamp/model/SKU, or
"another defensible independently checked allocation with
sufficient precision"? Findings, in brief:

1. **What Google can provide tops out at day/SKU
   granularity.** The AI Studio billing view (Exhibit A's
   surface) shows date-range totals with API-key and model
   filters — day aggregates; all ten Oct 29 requests share
   one key and one model, so the filters cannot separate
   them. Cloud Billing Reports group by project / service /
   SKU (the smallest attribution dimensions Google offers;
   API keys are not a billing dimension, and there is no
   per-request dimension). A SKU-level view for Oct 29
   (input-token vs audio-output-token totals) would refine
   the day's bounds but still aggregates all ten requests.
   BigQuery billing export is likewise SKU × time-window,
   must be enabled prospectively, and is not established as
   available for this AI Studio prepay account. Request
   labels exist only on Vertex AI (not used; prospective
   only). Per-response usage metadata was never received
   for the unknown attempt and was not retained by the old
   build for the failures. **No retroactive per-request
   attribution for Oct 29, 2026 exists.**
2. **Published pricing makes per-attempt charges inherently
   uneven.** `gemini-3.8-flash-tts` (Standard, intro pricing
   through Dec 31, 2026): text input **$0.50 / 1M tokens**;
   audio output **$9.00 / 1M audio tokens** at 25 tokens per
   second of audio — i.e. **$0.000225 per audio second**,
   exactly the deployed system's 225-micro-cent rate constant
   (≈ $0.81 per audio hour). Billing is token-metered per
   response, never flat per request: equal charges for nine
   different-length attempts would be a coincidence, not a
   default.
3. **The allocation exercise (full arithmetic in the
   companion doc) does not reach proof.** The uniform-estimate
   distribution (illustrated in §2.5) approximately fits the
   aggregate but assumes the fact in question. A literal
   published-metering allocation (refusals bill input tokens
   only ≈ $0.0002 each; the unknown billed for full audio)
   sums to only ≈ **$0.04** — roughly **$0.16 short** of the
   day total — so *some* unmodeled charging occurred (the
   leading candidate: audio generated server-side and
   metered although not delivered in the response — the same
   mechanism that would bill the timed-out unknown attempt).
   The one distribution the evidence **excludes** is
   unknown-pays-everything (≈ $0.18 would exceed the
   attempt's recorded upper bound ~5.7× and the model's
   per-request output cap). Every value for the unknown
   attempt in **[0, its upper bound]** remains achievable by
   some distribution consistent with all records. A
   cent-rounded aggregate over ten requests cannot certify
   an exact micro-cent figure in any event.
4. **Conclusion:** no allocation reaches per-attempt proof
   at the standard §2.4 requires. On the current route
   vocabulary, the STOP branch is final for this evidence.
   The remaining path is a different disposition, outlined
   in §8 as an option — not a recommendation smuggled past
   the evidence rule.

## §8 OPTION for Rowan's ruling — a transparently marked uncertain/estimated-accounting disposition

*Outlined at Rowan's invitation (6533798118: "Wren may
propose a separately reviewed, transparently marked
uncertain/estimated-accounting resolution"). This is an
**option for Rowan to rule on and Julie to approve**, not a
decided path and not part of §3/§6. Nothing here is built.*

- **What it would record.** A new settlement class —
  working name **`estimated_unverified`** — under which the
  attempt is closed for plan-retirement purposes while its
  cost is recorded as an **estimate, permanently flagged as
  provider-unverified**, never as a known cost. The audit
  record would carry: the estimate figure and its basis
  (the attempt's own-length estimator value, or its recorded
  upper bound if the design chooses the conservative
  treatment — a design question for Rowan's review), the
  evidence references (Exhibit A; the §7 research conclusion
  that per-request attribution is unobtainable), the
  operator, and the authorizations. Any surface that reads
  the settlement (diagnostics, phase accounting) would show
  the estimate **with** its unverified flag; no reader could
  mistake it for a `failed_known` charge.
- **Budget honesty.** Phase-budget accounting would count
  the estimate (or upper bound) against the phase as
  settled-with-flag — the books err conservative (spend is
  never understated by the disposition) while the flag
  preserves the truth that Google never confirmed the
  figure.
- **Code change: REQUIRED.** The deployed vocabulary
  (`SETTLEMENT_OUTCOMES = success / failed_known /
  no_charge`, with the (cost, outcome) pair validation in
  `genstore.reconcileUnknown`) cannot honestly record an
  estimate: every numeric cost it accepts becomes a *known*
  cost by construction. The disposition therefore needs a
  source change: the new outcome + pair validation, its
  `phaseAccounting` treatment, the audit representation,
  and tests (including negatives: the estimated class can
  never be produced by the existing known-cost branches,
  and an estimated settlement's read-backs are visibly
  distinct everywhere). The retire guard's test (zero
  `confirmed`/`unknown` attempt rows) works unchanged once
  the attempt carries the new outcome.
- **Gates it would need (none waived).** Repo-only build →
  full battery → Rowan source review → Julie's approval of
  the design → halted pause-first deploy under its own
  operational plan (the pattern of the Oct 30 deploy) →
  only then an adjudication run under the new disposition
  (fresh pre-state reads, the run's own §6-style approval
  from Julie) → retirement in that same bounded run.
- **How retirement then proceeds.** Exactly §3 Steps 4–6,
  unchanged, once the attempt is settled under the new
  class; the retirement note would reference the estimated
  disposition so the plan's history stays honest end-to-end.
- **The null alternative, stated plainly.** Doing nothing
  is safe and costs nothing: the plan stays `halted_unknown`,
  fenced, inert. Its real price is that the halted plan
  continues to own its 18 segments at the admission fence —
  **Chapter 2 cannot be regenerated until the plan is
  retired under some disposition** — which is a legitimate
  thing for Julie to weigh, not a pressure to choose §8.

— Wren
