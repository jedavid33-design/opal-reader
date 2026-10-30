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
  confirmed attempts = 50 known + this 1 unknown; the plan's other
  8 attempted executions settled `failed_known` at cost 0).
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
  **estimate written at grant time**, and on the operator's say-so
  it must never be recorded as the known cost. Whether the
  aggregate provider reconciliation in §2.5 — where all nine of
  the run's attempts reconcile against the window remainder at
  this same per-attempt figure — makes 19,652 the *attributable*
  cost of this attempt is precisely Rowan's sufficiency question
  (§2.4–§2.5); this proposal does not pre-decide it. The attempt's recorded
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
  Exhibit A in §2.5. It is *aggregate* (window-level) evidence;
  its sufficiency for the charged branch of §2.4 is the open
  question put to Rowan there.
- **Known items the window must reconcile against:** (a) the G10
  smoke segment, settled **$0.017749** (one successful request,
  earlier the same evening, ~22:36Z); (b) the 8 failed Ch 2 calls,
  provider-classified known failures recorded at cost 0
  (content-refusal class — no audio produced); (c) the 1 unknown
  attempt — the only call whose charge is in question. There was
  no other generation activity on the account that evening (the
  queue has been paused and generation halted since; the Ch 2 run
  and the smoke are the Oct 29 generation record).
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
here as the exhibit's provenance, and as the fallback if Rowan
requires a finer-grained record. Concrete steps, on her phone or iPad:

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
  item.** The table above is written for evidence that attributes
  a charge to the attempt. How the charged branch applies to the
  window-aggregate exhibit actually provided — via remainder
  attribution — and whether that suffices, is stated in §2.5 and
  is **Rowan's ruling to make in her review of this proposal**.
  Until she rules, no branch of this rule is treated as fired:
  if she rules the aggregate insufficient, the STOP branch
  governs by default and the run does not proceed on this
  evidence.

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

**Reconciliation** (operator's arithmetic, from the record):

- Oct 29, 2026 was the account's only provider-activity day in
  the window: the G10 smoke + the Chapter 2 run are the day's
  entire generation record.
- Smoke (Forever Pucked Ch 4 Seg 1): settled cost independently
  recorded at **$0.017749**.
- Remainder attributable to Chapter 2: $0.20 − $0.018 ≈
  **$0.18**.
- Chapter 2 made exactly **9 provider attempts** (8 failed + 1
  unknown); the per-attempt grant-time estimate is **$0.019652**
  (19,652 units). 9 × $0.019652 = **$0.176868 ≈ the remainder**
  (the screenshot total is rounded to the cent, so exact
  micro-cent agreement is neither expected nor required).
- **The aggregate therefore refutes a `no_charge` settlement**:
  the window's charges are consistent with all nine attempts —
  including the unknown one — having been charged at ~their
  estimated cost (~$0.0197). The `no_charge` branch of §2.4
  cannot honestly fire on this evidence.

**The sufficiency question for Rowan.** Does this
window-aggregate + remainder attribution satisfy the
independent-provider-evidence requirement to settle the unknown
attempt as **`failed_known` at the attributable cost 19,652** —
the same per-attempt figure the other eight attempts reconcile
at — or does she require a different treatment (for example, a
finer-grained per-request billing record before any figure is
recorded, or another disposition she names)? The considerations
on the table:

- *For sufficiency:* the attribution is closed, not open-ended —
  the window contains exactly one day of activity, the day
  contains exactly two known activities, the smoke's cost is
  independently settled, and the remainder matches nine attempts
  at a uniform per-attempt figure with no residual left
  unexplained. No alternative attribution of the remainder
  exists on the record.
- *Against / to be checked:* the recorded cost would be the
  grant-time estimate figure, adopted via reconciliation rather
  than read from a per-request line; the screenshot total is
  rounded to the cent, so the reconciliation is approximate at
  the sub-cent level; and the no-other-usage premise rests on
  the assumptions below.
- *Assumptions Rowan is asked to check:* (i) **no other Gemini
  usage occurred on Oct 29, 2026** — v1 generation was frozen on
  Oct 28, Batch was never armed, and the D6 plan inventory for
  the day is exactly {smoke, Chapter 2, Chapter 3 parked}; (ii)
  the per-attempt estimates are computed at the same intro (net)
  rates the screenshot's net total reflects; (iii) the eight
  failed attempts were in fact charged (the reconciliation is
  consistent with that, but the aggregate cannot show it
  per-attempt).

**Until Rowan rules, the indicated-but-unconfirmed settlement
is:** `failed_known`, `knownCostMicro: 19652`, with the
reconcile `note` carrying this exhibit's reference and figures.
If she rules the aggregate insufficient, the §2.4 STOP branch
governs and §3 does not proceed on this evidence.

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
**Status of this gate today:** the checkpoint is satisfiable at
execution — Exhibit A is already in hand (§2.5). What the
checkpoint must verify when the run comes is (a) the exhibit on
file matches §2.5's recorded figures, and (b) **Rowan's
sufficiency ruling is on record** (without it, the aggregate
evidence fires no branch and the run stops here), and (c)
Julie's §6 approval has been given. The settlement instruction
the operator carries into Step 2 is the one §2.4 produces *as
ruled by Rowan* — currently indicated as `failed_known` @
19,652, pending her ruling.

**Step 2 — The reconcile call (exactly one).**
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
- Diagnostics for the plan again: the attempt now reads settled —
  for `failed_known`: outcome `failed_known`, cost = the settled
  knownCostMicro; for `no_charge`: attempt row `failed_known` @ 0
  with the distinct settlement outcome carried by the Step 2
  response + audit record. **Zero** `confirmed`/`unknown` attempt
  rows remain for the plan; zero reserved/dispatching.
- Plan status: still `halted_unknown` (by design — reconciliation
  never resumes a plan, R4-1). The reconciled execution's state
  transition `unknown_billing → failed` is the designed exit in
  the store's transition table; no other execution moved.
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
   created by Step 4 if absent).

Unchanged, explicitly: worker build + etag; `GENERATION_HALT
"1"`; queue PAUSED with the same sole consumer; settings
revision 1; quota view; watermarks 18 / 1800; the other two
plans (smoke `complete`; Ch 3 `parked_policy`, fingerprint
`b991f18a…` recomputed exact); the plan's other 50 confirmed
attempts and its other 8 executions; grants and conflicts (the two
recorded `schedule_dead` rows). Any difference beyond the five
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
  Step 6 difference beyond the five enumerated footprint items.
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
> **Already in hand from you:** the Google billing evidence
> (§2.5, Exhibit A — your Oct 30 AI Studio screenshot), so this
> run's evidence gate can be satisfied once Rowan rules the
> aggregate reconciliation sufficient. If she instead requires
> a finer-grained record, I will come back to you with exactly
> what is needed before anything proceeds.

— Wren
