# GATE-7 PROPOSAL — Re-arm readiness: stale Chapter 2 work cannot execute

**Status: PROPOSAL ONLY — repo-only. This package makes no production
call, mutates nothing, and authorizes nothing.** It exists so Rowan
can review the safety demonstration and Julie can later decide,
separately, whether to re-arm. Re-arm itself, and any generation,
remain distinct future Julie gates (§6).

Lineage: design §11 gate 7. Rowan's gate-6 plan PASS (roundtable
issue #15, comment 6537327586) set this proposal's mandatory
contents: *"Before any later gate-7 re-arm/queue unpause/fresh-
generation approval, Wren must inventory any queued or claimable
Chapter 2 work and demonstrate an executor-level refusal or an
explicitly authorized safe neutralization of the stale job/grant;
prove no old-plan execution, duplicate billing, or unintended
launch can occur… The surviving Chapter 2 job (`generating`) and
grant (`issued`) must not be characterized as permanently
non-dispatchable solely because existing conflicts say
`schedule_dead`."* Rowan's gate-6 execution-record PASS (comment
6537433281) named this proposal the next turn. The demonstration in
§2 stands on the deployed fence/driver code, **not** on the
`schedule_dead` records and **not** on any claim that the queue is
empty.

Basis: live build `6a73d9622e1b4eac00c58e289de1c674ed6b3d6b`
(deployed source: the §8 disposition build tree), fresh read-only
inventory captured 2026-10-31T01:55:55Z (GETs only; canonical
assessment in `evidence/inventory-assessment.json`).

**Conclusion up front:** every code path by which the stale job or
grant could ever execute terminates at a refusal that is already
live in the deployed build, or is never selected in the first
place. No path reaches a provider call. No gap was found, so **no
safe-neutralization is proposed** (§2.6).

---

## 1. Inventory — queued / claimable Chapter 2 old work

### 1.1 The retired plan (context; ownership already cleared)

| Field | Value |
|---|---|
| Plan | `plan:603ab416bd67ab1b25de97be` |
| State | `retired` / `retired_unknown_billing` (gate 6, 2026-10-31T01:49:05Z) |
| Scope | chapter, chapterIndex 1, lane `standard`, phase `forever-pucked`, keepGoing `false` |
| Entries | 38 = 20 `bound_already` + 18 `eligible` (25,091 chars) |
| Plan totals | eligible 18, done 0, failed 8, blocked 0, prompts 0 |
| Plan settled | 179,991 micro-cents (recorded/known ledger basis) |
| Quarantine | not held |

### 1.2 The stale job and grant (the subject of this proposal)

| Artifact | State |
|---|---|
| Job `plan:603ab416bd67ab1b25de97be:ch1` | `generating`, revision 2, lane `standard`; 18 occurrence rows, all state `granted`; no quarantine hold |
| Grant `grant:plan:603ab416bd67ab1b25de97be:ch1:1:full` | `issued`, revision 2 — never claimed to completion, never closed |

These records are historical residue of the October 29 run. The
retirement (gate 6) deliberately did not touch them. They are
**claimable in shape only**: §2 demonstrates that no live code
path can consume them.

### 1.3 Execution plane (operator diagnostics, this plan)

- Execution records: **9 total — 8 `failed` (terminal), 1
  `unknown_billing`**. Zero records in `granted`, `attempted`,
  `synthesized`, `flushed`, or `verified` states.
- The sole non-terminal record is
  `exec-6a9c4e14-2223-4806-9694-90cd140cbd8e` (occurrence
  `59acff00-d6a4-4e2b-9734-34d50f4f59f0`), state `unknown_billing`
  — the execution behind the gate-5 disposed attempt. In the
  store's recovery scan its action is `reconcile_hold`: reported,
  never retried, never re-dispatched (§2, Path B).
- Attempt census (confirmed): **51 = 29 success + 21 policy_block
  + 1 `estimated_unverified` + 0 unknown**. The disposed attempt
  `att-37d63768-db4b-447d-8150-580b7c6ee257` remains
  `estimated_unverified` with `cost_micro_cents` NULL (gate 5;
  unchanged by retirement, per design invariant 1).

### 1.4 Lease / conflict records

`GET /v2/conflicts` returns exactly two rows, both `schedule_dead`
lease records from the base coordinator's schedule machinery:

| id | at (UTC) | subject |
|---|---|---|
| 2 | 2026-10-30T00:24:14Z | `grant:plan:603ab416bd67ab1b25de97be:ch1:1:full` (the stale grant) |
| 1 | 2026-10-29T23:54:14Z | `grant:plan:3183ecbf2ac4bf50bbc6166e:seg:1:full` (the completed smoke grant) |

Per Rowan's condition, these records are inventoried here but are
**not** load-bearing in §2: the demonstration does not rely on
them, and a hypothetical world in which they did not exist would
not change any conclusion.

### 1.5 Queue state (Cloudflare GET, read-only)

Queue `opalreader-generation-v2` (`93b6a35fb8cf4788a91a2c90b748ae66`):
`delivery_paused: true`, `delivery_delay: 0`,
`message_retention_period: 86400` s; sole producer and sole
consumer both `opalreader-api-v2-prod`.

### 1.6 What can and cannot be observed (stated plainly)

Observable: plan / job / grant records; execution records and the
attempt log (diagnostics — the execution plane); the
`binding_conflicts` rows; queue settings; worker bindings
(`GENERATION_HALT` = `"1"`, `OPALREADER_PHASE_POLICY` =
`"enforce"`, 10 bindings); settings revision 1 (lane `standard`,
monthly cap $50); the quota view (attemptsToday 0,
spentMicroCents 371,485 — grant-time estimate debits in the
coordinator ledger, **not** provider-confirmed spend).

**Not observable on any live read surface:**

- **The queue's message backlog.** No surface used exposes queued
  message contents or depth. This proposal makes **no claim that
  the queue is empty.** The demonstration in §2 does not need one.
  A bound is still available from source + settings: a grant's
  dispatch message is produced exactly once, by the outbox row
  written at grant issuance (coordinator grant issuance inserts
  one `dispatch` outbox row; the driver's grant step refuses to
  request a further grant while a live `issued` grant exists, so
  no second dispatch for this grant was ever produced); the stale
  grant was issued 2026-10-29 (~23:05–23:54Z record window), and
  retention is 86,400 s, so any undelivered copy expired by
  2026-10-30/31. While halted, the production entry wires **no**
  `sendGrant` at all, so nothing can leave the outbox in the
  current state regardless. And if — contrary to all of the above
  — a copy were delivered after a future unpause, Path A (§2)
  refuses it before claim and ACKs it permanently.
- **The coordinator outbox table.** No read surface exists.
  Delivery of the original dispatch is established indirectly and
  sufficiently: the original run's 51 attempts exist and were
  executed under this grant.
- **The claims table directly.** Visible only through the two
  `schedule_dead` lease records in §1.4. The fence demonstration
  does not depend on the claim row's contents: the fence runs
  *before* `claimGrant` is reached (§2, Path A), and the fence
  test lineage (T1) covers the worst case — a claim already held
  by the executor's own consumer identity.

### 1.7 Neighbors (unchanged, re-verified in this capture)

- Smoke plan `plan:3183ecbf2ac4bf50bbc6166e`: `complete` (settled
  19,674 plan-level). These are the **only two D6 plans** in the
  store — there is no active plan.
- Chapter 3 job `1832c21fcf0425454227c4736048a8a632f422abca4a2685ddb775bb1681406a`:
  `parked_policy` rev 1, no grants, 3 `ready` / 24 `pending`
  occurrence rows. Untouched by everything proposed here.
- Phase accounting (`forever-pucked`): settled 199,665;
  estimatedUnverified 19,018; reservedUnverified 5,648;
  inFlightUpper 0; unknownOpen 0; remaining 13,294,687;
  `provider_unverified` (§5).

---

## 2. Executor-level refusal demonstration

Scope of the hypothetical: **queue unpaused AND `GENERATION_HALT`
flipped to `"0"`** — the full re-armed state. Every path below is
traced in the deployed source of build `6a73d962…`. "Refuses"
always means: returns normally with a refusal result, zero
provider contact, zero ledger/attempt/execution movement, unless
stated otherwise.

### Path A — a queue message naming the stale grant is delivered

1. **Queue consumer** (`worker-entry-prod-d6.js` `queueHandler`):
   with the halt flipped, `assertGenerationEnabled` passes and the
   message body is forwarded to the coordinator's
   `/internal/execute`. (While halted, this layer throws before
   touching the coordinator — halt layer 1 — but the demonstration
   assumes the flip, so this layer is passed by hypothesis.)
2. **Coordinator `_execute`**: validates the message shape, builds
   the D6 executor (`createD6Executor` — the only executor the
   production entry constructs), calls `handleMessage`.
3. **Executor pre-claim fence** (`generation/d6-executor.mjs`,
   `handleMessage`, store-backed branch — the Workstream A fence,
   Rowan-accepted design, board comments 6532307605 / 6532784704):
   - **Strict plan resolution** (`resolvePlanForFence`): the plan
     identity is read from persisted server records only — the
     `d6_plan_jobs` link (DISTINCT; multiplicity is itself a
     conflict) cross-checked against the job's own `data_json`
     stamp. Message-carried plan fields confer nothing and select
     nothing. For the stale job both records name
     `plan:603ab416bd67ab1b25de97be`. Any read fault, blank/corrupt
     record, or disagreement refuses (`plan_state_check_failed` /
     `plan_link_conflict` / `plan_link_mismatch`) — a database
     fault never reads as "no plan" and never as dispatchable.
   - **Quarantine read** (strict, D8-1): no hold exists for this
     plan or job (§1.1/§1.2) — passes, correctly: quarantine is not
     the fence this plan needs.
   - **Plan-state fence** (`planStateFenceRefusal`):
     `PLAN_STATES_REFUSED = {complete, partial, retired,
     halted_unknown}` — the exact complement of the driver's own
     selection. The plan row's state is `retired`, so the executor
     returns **`{ refused: "plan_not_dispatchable", planId,
     planState: "retired" }` — before `claimGrant` is called**,
     before any execution record is created, before any spend
     intent, and with zero provider contact.
4. **Normal ACK**: `_execute` returns HTTP 200 with the refusal
   result, so `queueHandler` ACKs the message. The stale message
   is consumed permanently — it is never retried into the fence.

**Test lineage:** fence test **T2** is this exact case (the T1
production-shape fixture with the plan `retired` → refused
`plan_not_dispatchable` / `retired`, provider calls 0, zero
movement across grants, claims, execution records, spend intents,
attempt log, plans, and jobs). **T1** is the same fixture in the
live October shape — job `generating` rev 2, grant `issued` rev 2,
claim already held by the executor's own consumer id
(`opalreader-v2-prod-d6`, so claim discipline alone would have
fallen through), 18 `granted` rows — refused identically. The
fence suite passed 29/29 at its pin and the fence code shipped in
the combined Chapter 2 deploy, byte-present in the live build's
lineage through the disposition deploy (build `6a73d962…`).

### Path B — the coordinator alarm (no queue message involved)

The Durable Object alarm fires on the watchdog cycle independent
of the queue, in the re-armed state exactly as now. The production
entry's `alarm()` runs the base coordinator alarm, then
`service.recover()`, then `service.driveOnce()`.

1. **Driver selection** (`generation/service.mjs` `driveOnce`):
   plans are selected with `state NOT IN ('complete', 'partial',
   'retired', 'halted_unknown')`. The retired plan is excluded **at
   selection** — the driver never reaches its jobs, never runs a
   grant step for the stale job, and can never flip the plan back
   to `active` (the only transition out of `halted_unknown` was
   retirement; `retired` is terminal in the driver — R4-1/R3-2
   source law). The stale job is reachable only through its plan
   row, so an unselected plan means an undriven job, on every pass,
   however often the alarm fires.
2. **Recovery** (`service.recover()` over `store.recoveryScan()`):
   the service performs only the non-spending `release_and_fail`
   action (release *reserved* attempts of never-dispatched
   executions and mark them failed). The retired plan has **no**
   execution in a `release_and_fail` class (§1.3): its sole
   non-terminal record is `unknown_billing`, whose scan action is
   `reconcile_hold` — skipped by `recover()`. The executor's own
   `recover()` (the only code that re-verifies or re-enters flush
   states) is **never invoked** by the production entry. No
   synthesis path exists on the alarm for this plan — and the
   recovery actions that do exist never synthesize at all
   (`verifyAndCommit` / `reenterFlush` commit only from
   already-flushed R2 objects, and neither is reachable here).

### Path C — grant consumption without a queue message

There is no other consumer. A grant is consumed only by the D6
executor's `claimGrant` inside `handleMessage`, which Path A
shows is unreachable for this job (the fence returns first). The
legacy v1 executor is not constructed anywhere in the production
entry, and the v1 queue/consumer belong to the separate frozen v1
script. A hand-delivered `/internal/execute` (reachable only
DO-internally) runs the identical `_execute` → fence chain, so
message provenance does not matter; fence test **T9** covers the
adversarial variant — a message mislabeled with a *different,
active* plan's id is still refused, because plan identity never
comes from the message.

### Path D — could anything issue a NEW grant for the stale job?

`requestGrant` is called from exactly one place: `driveOnce`'s
grant step, for a **selected** plan's current job. Path B shows
the retired plan is never selected. `submitIntent` cannot do it
either: a byte-identical resubmission converges on the retired
plan and creates nothing (§3); a different-semantics intent
creates a **new** plan and a **new** job — it never touches the
old job's rows. Quarantine release operates on hold rows (this
plan has none) and never changes plan state; it is not a
resurrection path. The grant guard (`generation/grant-guards.mjs`)
stands behind all of these as the spending fence for any grant
that *is* requested — it is never reached for the stale job
because no request is ever made.

### 2.5 What the demonstration does *not* rest on

- **Not** on `schedule_dead` (Rowan's condition). Remove both
  conflict rows from the record and every path above is unchanged.
- **Not** on queue emptiness (§1.6). Path A handles a delivered
  message; Path B handles the no-message case; retention bounds
  any hypothetical survivor.
- **Not** on the halt or the pause. Both are assumed away
  (flipped / unpaused) throughout this section; the refusals live
  in the plan-state fence and the driver selection, which are
  state-of-the-plan facts, not state-of-the-switch facts.

### 2.6 Gaps

**None found.** Every traced path — queue delivery, alarm driver,
alarm recovery, direct internal execute, new-grant issuance —
terminates at the executor plan-state fence, the driver selection
exclusion, or a non-spending hold. No path reaches a provider
call, a claim, a spend intent, or a ledger movement for the stale
job/grant. Because no path is left unproven, **no safe
neutralization is proposed**: mutating the stale job or grant
(e.g., an operator void) would be an additional production write
with its own risk, purchased against a risk the code already
refuses. If Rowan's review identifies a path this demonstration
missed, the neutralization option can be framed then, as its own
separately-gated proposal — it is not performed or bundled here.

---

## 3. Duplicate execution / billing exclusion

A future re-arm plus a fresh Chapter 2 intent cannot double-
execute or double-bill the retired plan's work:

1. **Eligibility is re-derived, never inherited.** `submitIntent`
   rebuilds the eligible plane from the *current* content and
   bindings. The retired plan's 20 `bound_already` occurrences
   derive as `bound_already` again — they are never in a fresh
   plan's eligible set, never granted, never billed a second time.
   The 18 eligible occurrences derive as eligible. The old plan's
   entry rows are history; nothing reads them for execution.
2. **Convergence branch (no new work, by construction).** Intent
   identity is a server-side hash of {bookId, scope, chapterIndex,
   occurrenceId, eligibleIds, lane, keepGoing, phase}. A
   resubmission with the retired plan's exact semantics (chapter
   scope, chapter 1, `standard`, keepGoing `false`, the same 18
   eligible ids) hashes identically and **converges on the retired
   plan**: `submitIntent` returns `{ planId: <retired plan>,
   created: false, state: "retired" }` and creates no job, no
   grant, no entries. Nothing executes and nothing bills — and,
   operationally, nothing generates either. **Consequence for the
   later fresh-go gate (stated now so it is not discovered live):**
   the fresh Chapter 2 submission must carry semantics that mint a
   new plan — e.g. keepGoing `true` — or it will return the retired
   plan and stop there, safely but silently unproductive.
3. **New-plan branch (the intended fresh run).** Different
   semantics → different intent hash → a new plan id, admitted
   because a `retired` plan does **not** fence overlap
   (`PLAN_FENCE_TERMINAL = {complete, partial, retired}` — the
   retirement is precisely what cleared ownership, per the
   `retireHaltedPlan` source law). The new plan creates its **own**
   job (`<new planId>:ch1`) and its own occurrence rows; the stale
   job's `granted` rows belong to the old job id and are never
   read by the new plan's driver or executor. Double-billing would
   require one occurrence to be granted under two live plans —
   the overlapping-occurrence fence (R2-2) forbids that among
   non-terminal plans, and §2 shows the retired plan can never
   grant at all.
4. **Spend-intent backstop.** Even inside the executor,
   `acquireSpendIntent` is keyed per grant + job + occurrence and
   is only reachable after a successful claim; §2 Path A/C show
   the stale grant can never be claimed, so no spend intent under
   it can ever be acquired or re-acquired.

---

## 4. Re-arm sequence (for a later, separate approval)

Mirrors the original D6 arming order (proofs → settings →
consumer routing → halt flip → queue delivery **last**) and
reverses the Gate-1 pause-first holds in the safe direction. Each
step is read-back-verified; the rollback at each step is a single
reversible write; **any ambiguity at any step is a STOP** — hold
position, read only, no retry of a mutating step without a fresh
Julie go.

- **A0 — Fresh pre-arm inventory.** Re-capture §1 in full and
  require equality with this proposal's snapshot: plan `retired`;
  stale job/grant byte-identical in state and revision; conflicts
  exactly the two known rows; phase figures unchanged; Ch 3 job
  unchanged; settings revision 1; build `6a73d962…`; halt `"1"`;
  queue paused. **Any drift = STOP**, no further steps.
- **A1 — Julie's re-arm approval.** Her distinct tap on this
  reviewed proposal, recorded on the board. (Rowan's review of
  this proposal authorizes nothing; this step is Julie's alone.)
- **A2 — Settings: verify only, no write.** Revision 1 already
  carries the original arming's values (lane `standard`, monthly
  cap $50). Read back and confirm; settings are **not** modified
  by re-arm. (A settings change, if ever wanted, would be its own
  CAS step *before* the flip — none is proposed.)
- **A3 — Consumer routing verification.** Read back the queue's
  attachments: sole consumer `opalreader-api-v2-prod`, sole
  producer the same script; worker bindings read-back shows the
  queue binding present and `GENERATION_HALT` still `"1"`.
  Nothing is attached or detached by re-arm.
- **A4 — Halt flip.** `GENERATION_HALT` `"1"` → `"0"` by the same
  binding-write mechanism used at the October 29 arming, then
  read back (bindings + `/health`). **Rollback:** flip back to
  `"1"` — one write; the queue is still paused at this point, so
  the only machinery that can run in the interval is the alarm
  driver, which A5 verifies selected nothing.
- **A5 — Armed-idle verification (queue still paused).** `/health`
  generation enabled; plan list unchanged (retired + complete
  only — no active plan exists to drive); diagnostics and phase
  figures unchanged; conflicts unchanged; quota attemptsToday
  still 0. Any unexpected plan, grant, attempt, or figure movement
  = **STOP**, roll back via A4-reverse (re-halt), report.
- **A6 — Queue unpause, LAST.** PUT the queue with `queue_name`
  and `delivery_paused: false`; read back `delivery_paused:
  false` (a mutation is never trusted without read-back).
  **Rollback:** re-pause (same PUT, `delivery_paused: true`) plus
  re-halt if anything moved. Post-unpause verification repeats the
  A5 read set: §2 predicts zero movement attributable to the old
  plan; any movement = **STOP**, re-pause + re-halt, report.

**End state:** the system is **armed but idle**. No active plan
exists, so no generation can occur until Julie's separate fresh
Chapter 2 intent go (§3.2's minting-semantics note applies to that
submission). Re-arm creates no plan, submits no intent, and
spends nothing.

---

## 5. Budget — with the mandatory billing-truth disclosures

**Disclosures (Rowan 6537006494 + 6537164115 + 6537327586,
carried verbatim in substance):**

- The estimate **19,018 micro-cents** (~$0.0190) is an
  **occurrence-length model proxy** — the full occurrence's 1,349
  characters run through the code cost model. It is **not** an
  observed Google charge and **not** the split request's own
  measured length.
- The reservation **5,648 micro-cents** (~$0.0056) is the split
  attempt's **persisted modeled allowance** — an internal modeled
  figure, **not** a verified upper bound and **not** a provider
  bill ceiling.
- The two figures are computed on **unlike bases** and differ by
  **13,370 micro-cents**; neither invalidates the other, and the
  mismatch is carried, not reconciled away.
- **The actual Google charge for the disposed attempt remains
  UNKNOWN.** The attempt's `cost_micro_cents` is NULL; its outcome
  is `estimated_unverified`; the phase carries
  `provider_unverified` permanently, including after the gate-6
  retirement.

**Phase position now** (`forever-pucked`, all micro-cents;
recorded/known vs modeled kept separate):

| Term | Value | Nature |
|---|---|---|
| Phase budget | 13,500,000 | Julie's $13.50 decision, server-enforced |
| Settled | 199,665 | recorded/known under the existing ledger |
| Estimated unverified | 19,018 | modeled proxy (above) |
| Reserved unverified | 5,648 | modeled allowance (above) — the gating term |
| In-flight uppers | 0 | — |
| Unknown open | 0 | — |
| Remaining authorization | 13,294,687 | = budget − settled − reserved |

**Fresh Chapter 2 projection** (the later generation gate's
figures, stated here because re-arm is what makes them
reachable). All figures are **modeled, not provider figures**,
computed with the deployed cost model (`gen-constants.mjs`:
expected = round(chars / 15.96 × 225); per-attempt upper =
round(chars / 10 × 225); per-occurrence upper = 12 attempts ×
per-attempt upper) over the 18 eligible occurrences / 25,091
chars:

| Projection | Micro-cents | ≈ $ |
|---|---|---|
| Expected settled-equivalent (all 18 succeed) | 353,726 | $0.3537 |
| Single-attempt uppers, summed | 564,550 | $0.5646 |
| Grant-guard reservation basis (Σ per-occurrence 12-attempt uppers) | 6,774,600 | $6.7746 |

- **Guard check at a future first grant:**
  settled 199,665 + reservedUnverified 5,648 + inFlight 0 +
  pending uppers 6,774,600 = **6,979,913 ≤ 13,500,000** — passes
  with 6,520,087 of headroom even on the worst-case reservation
  basis. The guard gates on the reservation, never the estimate
  (`d6PhaseBudgetCheck`).
- **Remaining authorization after the expected settle:**
  13,294,687 − 353,726 = **12,940,961**.
- **Physical limit context:** Julie's AI Studio prepay balance was
  **$17.83** (verified by her screenshot, Oct 29, 2026), auto-
  reload OFF — the hard physical ceiling on any actual provider
  spend, independent of every modeled figure above. The expected
  fresh-run cost (~$0.35 modeled) sits far inside both the phase
  budget and the prepay balance. No top-up is proposed or needed
  for this scope.

---

## 6. Explicit non-authorizations

This proposal authorizes **nothing**. Specifically:

- **Re-arm** (halt flip + queue unpause) requires Julie's separate
  tap after Rowan's review of this proposal — §4 is a plan, not a
  go.
- **Generation** requires a further separate Julie go (the fresh
  Chapter 2 intent), after re-arm.
- **No neutralization** of the stale job/grant is proposed or
  authorized (§2.6).
- **Batch stays unarmed** (live capabilities: `batch_not_armed`);
  nothing here changes lane admission.
- **Chapter 3 stays parked.** Its job is inventoried only to prove
  it is untouched; no resume mechanism is proposed or implied.
- No settings change, no deploy, no release, no reconcile or
  adjudication call, and no provider/Google contact is proposed.
- Rollback floor unchanged: build `6a73d962…` remains the minimum
  build that may ever run against this data.

**Turn:** Rowan's — operational-plan review of this gate-7
proposal. Then Julie's re-arm decision.

— Wren
