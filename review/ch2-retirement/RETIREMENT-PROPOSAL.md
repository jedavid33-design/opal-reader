# Gate 6 — Chapter 2 halted-plan RETIREMENT PROPOSAL (repo-only)

**Status: PROPOSAL ONLY. This package makes NO retirement call and
authorizes nothing.** It is drafted under Rowan's gate-5
execution-record REVIEW PASS (roundtable issue #15, comment
6537164115), which names the retirement proposal as Wren's next
allowable task (design §11 gate 6). Execution requires, in order:
Rowan's operational-plan review of this proposal, then **Julie's
distinct explicit retirement approval**, then exactly one operator
call under the sequence in §6.

Subject: plan `plan:603ab416bd67ab1b25de97be` (Forever Pucked,
Chapter 2 — book `5c589095-f812-48a2-8ab2-03ba2791f2b2`,
chapterIndex 1, lane standard, phase `forever-pucked`), currently
`halted_unknown` / stopReason `phase_halted_unknown_billing`, whose
one unknown attempt was disposed at gate 5 as
`estimated_unverified`.

Standing production state at drafting (fresh read-only preflight,
§2): live build `6a73d9622e1b4eac00c58e289de1c674ed6b3d6b`, script
etag `a9a4c0c40ceefa6138c1cc8ebb3f0ab5b2205e7b7a057b865c8c312cbb13c39e`
— **the permanent §5.3 rollback floor** — generation **HALTED**
(`GENERATION_HALT "1"`), queue **PAUSED**, Chapter 3
`parked_policy`, re-arm **BLOCKED**.

---

## 1. Billing truth (carried verbatim, permanent labels)

- The actual Google/provider charge for the disposed attempt
  remains **UNKNOWN**. No per-request provider bill has ever been
  proved; the original known-cost settlement (design §6 of the
  adjudication proposal) remains **NOT SUBMITTED**.
- **Estimate 19,018 micro-cents (~$0.019018)** is a
  full-occurrence-length model proxy (`expectedCostMicro(1349)`),
  NOT a Google-observed per-request cost and NOT a measurement of
  the seq-7 split payload.
- **Reservation 5,648 micro-cents (~$0.005648)** is the specific
  split attempt's recorded internal allowance, NOT a provider
  ceiling. The proxy exceeds the reservation by **13,370
  micro-cents** on unlike bases. This mismatch is a standing
  disclosure obligation for the future re-arm / fresh-generation
  budget proposal (§5.3 of this proposal).
- `provider_unverified` stays visible on the attempt, the plan
  summary, and the phase accounting — before retirement, and (by
  design invariant 1) after it.

## 2. Fresh preflight (read-only, 2026-10-31T01:32:47Z)

All reads are the deployed read surfaces (client + operator
diagnostics + Cloudflare GETs); no mutation of any kind was made.
Full summary: `PREFLIGHT-SUMMARY.md`; canonical assessment:
`evidence/preflight-assessment.json`; raw captures retained
locally under `preflight/` (not pinned).

### 2.1 The disposed attempt

Attempt `att-37d63768-db4b-447d-8150-580b7c6ee257` (seq 7 of
execution `exec-6a9c4e14-2223-4806-9694-90cd140cbd8e`, occurrence
`59acff00-d6a4-4e2b-9734-34d50f4f59f0`):

- `phase = confirmed`, **`outcome = estimated_unverified`**,
  **`costMicroCents = null`**, `upperMicroCents = 5648`;
- joined adjudication figures on the diagnostics read:
  `estimatedCostMicroCents = 19018`,
  `reservedCostMicroCents = 5648`,
  `estimatedUnverifiedStatus = provider_unverified`;
- its execution record remains **`unknown_billing`** — historical
  provenance (design §9.2), expected and correct, **not** an open
  unknown for any guard and **not** a STOP condition;
- plan-wide attempt census (51 confirmed attempts in this plan):
  outcomes `success` 29, `policy_block` 21,
  `estimated_unverified` 1 — **zero rows with outcome
  `unknown`**, which is the exact population the retire guard
  counts (§3.2).

### 2.2 The plan and its 38 entries

- Plan state `halted_unknown`, stopReason
  `phase_halted_unknown_billing`; totals: eligible 18, done 0,
  failed 8, blocked 0; plan-level settled **179,991**;
  plan summary carries `estimatedUnverifiedMicroCents = 19018`
  and `estimatedUnverifiedStatus = provider_unverified`;
  quarantine `held = false`.
- Entries: **38** — **20 `bound_already`** (9,997 chars; their
  occurrences are already bound and live outside this plan's
  fence) and **18 `eligible`** (**25,091 chars**), all still owned
  (fenced) by this plan. The 18, by plan position:

| pos | occurrenceId | chars | execution state |
|----:|--------------|------:|-----------------|
| 45 | 4b2b3699-db42-4af1-9f27-3caad67f58e6 | 1448 | failed |
| 46 | 117ef377-8df1-4189-bc85-4670bb034940 | 1294 | failed |
| 48 | 6b7ea94c-6631-4e66-8330-e3d3152b0c74 | 1352 | never attempted |
| 49 | c4475eda-a6b1-4c92-9f71-f2f69643608f | 1498 | never attempted |
| 50 | 59acff00-d6a4-4e2b-9734-34d50f4f59f0 | 1349 | unknown_billing (the disposed attempt) |
| 51 | 26a37980-ddbb-4f41-8f14-b99e541c582e | 1352 | failed |
| 52 | be263419-cd45-4d29-b31b-e5352f4c8b59 | 1493 | never attempted |
| 53 | de0436f4-89f5-4a99-b38a-d32823ce72cd | 1456 | never attempted |
| 54 | 4f35bc00-7120-45e5-b251-2068ccb4452a | 1475 | failed |
| 55 | 3929c8a1-e5a3-4ba3-be1f-e1bb72dccb6b | 1367 | failed |
| 56 | 0343a3a1-9957-4431-8663-dce0b329171f | 1389 | failed |
| 57 | bfabaa59-e720-4ec6-9346-d196f0f80582 | 1399 | never attempted |
| 58 | b42a64ab-8bac-4706-85f3-adf7cc96bcdd | 1341 | never attempted |
| 59 | 84ff25f0-dc56-4c9e-980d-0af74e9fef7f | 1184 | never attempted |
| 60 | 2997a9b4-0ff6-4254-8022-4c6c9b986159 | 1477 | failed |
| 61 | 67d4b319-d696-4c08-90d7-100d5c9e240c | 1367 | never attempted |
| 62 | abae8a3e-127d-4979-a883-df072be33784 | 1437 | never attempted |
| 63 | 3095422d-17c5-4f48-8660-ce94930fb605 | 1413 | failed |

(Execution states are the per-entry execution-record states:
8 failed, 1 unknown_billing, 9 with no execution. The 9
never-attempted entries were never dispatched; nothing about
retirement changes that history.)

- Plan job `plan:603ab416bd67ab1b25de97be:ch1`: state
  `generating`, revision 2; its 18 occurrence rows all
  `granted`; exactly one grant,
  `grant:plan:603ab416bd67ab1b25de97be:ch1:1:full`, state
  `issued`, revision 2 (provably non-dispatchable — its lease
  rows are the two known `schedule_dead` conflicts, unchanged).
- Conflicts surface: exactly the two known `schedule_dead` rows.

### 2.3 Phase accounting (fresh, both diagnostics views agree)

`forever-pucked`: budget **13,500,000**; settled **199,665**
(basis `recorded_known_existing_ledger`); estimated unverified
**19,018**; reserved unverified **5,648**; in-flight upper **0**;
**unknownOpen 0**; remaining **13,294,687** (= 13,500,000 −
199,665 − 5,648); `unverifiedStatus = provider_unverified`.

### 2.4 Containment and neighbors

- `/health`: build `6a73d962…`, generation `halted`; script etag
  `a9a4c0c4…` (the floor pair); 10 bindings, `GENERATION_HALT
  "1"`, `OPALREADER_PHASE_POLICY "enforce"`; observability
  enabled + persisted; settings revision **1**; quota
  `spentMicroCents 371485`, `ledgerSeq 19`, attempts today 0
  (grant-time ledger estimates, not provider spend).
- Queue `opalreader-generation-v2`: `delivery_paused = true`,
  sole consumer `f260f2188d80426bb0588685e9d084eb`.
- Smoke plan `plan:3183ecbf2ac4bf50bbc6166e`: `complete`,
  unchanged.
- Chapter 3 job `1832c21fcf0425454227c4736048a8a632f422abca4a2685ddb775bb1681406a`:
  `parked_policy`, revision 1, 27 rows (3 ready / 24 pending),
  no grants, fingerprint
  `b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282`
  — exact.
- Sync watermarks: content 18, bindings 1800.

## 3. The retire method (deployed source, build `6a73d962…`)

Source citations are to the deployed worker tree
(`worker/generation/service.mjs`, `worker/worker-entry-prod-d6.js`
at the SOURCE-PASS pin `6a73d962…`).

### 3.1 Route and fence

- External: **`POST /v2/d6-retire-halted-plan`** — a member of
  the operator fence class (entry, route-class block): the
  production gate skips the client token for it, admission is on
  the migration-operator credential alone, and the Durable
  Object class gate requires the operator-admitted stamp
  (`x-opalreader-operator-admitted = "1"`, else 403
  `migration_operator_required`). **The everyday client token
  alone is refused.** The client build has no path to this
  surface.
- Internal: `POST /internal/d6/retire-halted-plan` →
  `service.retireHaltedPlan({ planId, note, source })` with
  **`source` server-stamped `"operator-route"`** — never a
  caller-supplied value.
- Request schema (entry): JSON body `{ planId, note? }` —
  `planId` taken from the body; `note` accepted only if a
  string, else null. There is no other caller input; in
  particular there is **no** caller-supplied figure, state, or
  source.
- Invocation at the execution gate (mirroring gate 5): the
  operator connector
  (`custom.opalreader-v2-prod-operator/bin/v2prod-operator-api`)
  with headers `X-OpalReader-Scope: production` and
  `X-OpalReader-Instance: account`, one POST, body per §6 R2.

### 3.2 Guards (service `retireHaltedPlan`, in order)

1. `planId` missing or not a non-empty string → rejected
   `plan_id_required`.
2. Plan not found → rejected `plan_not_found`.
3. `plan.state !== 'halted_unknown'` → rejected
   `plan_not_halted_unknown` (carries the current state). This
   also makes a **second retire call impossible**: an
   already-retired plan fails this guard, and the audit table's
   `plan_id` PRIMARY KEY would refuse a duplicate row in any
   case.
4. Open-unknown guard: count of `d6_attempt_log` rows for the
   plan with **`phase = 'confirmed' AND outcome = 'unknown'`**;
   if > 0 → rejected `unknown_billing_open` (carries
   `openUnknown`). Retirement never papers over an unresolved
   charge.

**Why the disposed attempt does not block (citation):** the
guard's outcome literal is `'unknown'`. After the gate-5
disposition, the attempt row's outcome is
`estimated_unverified`, so the count falls to zero **without any
change to the guard's code or definition** (design §9.1). The
fresh preflight (§2.1) directly confirms the count is 0 in
production data: 51 confirmed attempts, outcomes success 29 /
policy_block 21 / estimated_unverified 1, none `unknown`. The
execution record's `unknown_billing` state is **not** counted —
the guard counts attempt rows, never execution states (design
§9.2).

### 3.3 Exact write-set (one transaction)

On success, `retireHaltedPlan` performs, in a single
`coord._tx` transaction, exactly:

- **W1 — lazy audit-table DDL:** `CREATE TABLE IF NOT EXISTS
  d6_plan_retirements (plan_id TEXT PRIMARY KEY, note TEXT,
  source TEXT, created_at INTEGER NOT NULL)` — ensured only by
  this writer, never in GEN_SCHEMA (a store that never retires
  a plan never grows the table).
- **W2 — one audit row:** `INSERT INTO d6_plan_retirements
  (plan_id, note, source, created_at)` with the plan id, the
  request's note (§6 R2 fixes its text), source
  `"operator-route"` (server-stamped), and the server clock.
- **W3 — the plan row:** `UPDATE d6_plans SET state =
  'retired', stop_reason = 'retired_unknown_billing',
  updated_at = <server now> WHERE plan_id = ?` (via
  `setPlanState`).

Expected success response:
`{ outcome: "applied", planId, fromState: "halted_unknown",
state: "retired", stopReason: "retired_unknown_billing",
note }`.

**Reporting precision (Rowan's gate-5 rule, carried forward):**
the audit row's raw columns (`note`, `source`, `created_at`)
are **not exposed on any deployed read surface**. The execution
record will report W1–W3 as **source-specified transactional
writes** corroborated by the response and by the observable
plan-state transition — not as independently read-back-verified
row values.

### 3.4 Explicit zero-set

The retire function writes **nothing else**. In particular:

- no change to `d6_billing_adjudications` or the amendments
  table (the disposition record is untouched);
- no change to any `d6_attempt_log` row (the disposed attempt
  stays `estimated_unverified`, cost NULL);
- no change to `d6_execution_records` (the execution stays
  `unknown_billing` — provenance, design §9.2);
- no change to `d6_plan_entries` (all 38 rows remain as the
  retired plan's permanent history);
- no change to grants (the one `issued` grant row is not
  written; it is inert — the driver selection excludes
  `retired` plans, and generation remains halted with the queue
  paused in any case);
- no change to any job row, phase state, settings, quota,
  bindings, or sync state;
- no quarantine release, no queue unpause, no halt flip, no
  provider/Google call, **no generation, no spend**.

### 3.5 What retirement does to the 18 eligible entries

- The occurrences stay **unbound**. Retirement binds nothing
  and writes no bindings; the 20 `bound_already` occurrences
  are entirely outside this act.
- The retired plan **stops fencing** them. Source: the
  admission fence counts a plan as owning its eligible
  occurrences while its state is non-terminal
  (`halted_unknown` fences, per the R3-2 correction);
  `PLAN_FENCE_TERMINAL = ["complete", "partial", "retired"]`
  and the fence skips terminal plans; the driver likewise
  never selects a `retired` plan. Ownership is cleared by the
  state transition alone — no entry row is edited.
- They become re-runnable **only** via a **future fresh intent**
  admitted by the ordinary rules. Retirement itself admits
  nothing and starts nothing: a fresh intent is a later,
  separate act that additionally requires the re-arm gate
  (halt flip + queue unpause) and Julie's fresh generation go.
  Until all of those happen, the 18 segments simply remain
  ungenerated, exactly as now.
- There is **no un-retire** in the deployed source: `retired`
  is terminal. The occurrences' future runs under a new plan,
  never by reviving this one. (This irreversibility is why
  retirement is its own gate.)

## 4. Predicted post-retire read-backs (the R3 contract)

Against the R0 inventory, exactly one substantive delta is
predicted — the plan's `state` / `stopReason` (plus its
`updated_at`) — with W1–W2 as source-specified writes behind
it. Everything else must read **identical**, including:

- **Plan view:** state `retired`, stopReason
  `retired_unknown_billing`; totals unchanged (eligible 18 /
  done 0 / failed 8); entries unchanged (38; 20 bound_already /
  18 eligible, same ids and char counts).
- **Plan summary (invariant 1):** still shows
  `estimatedUnverifiedMicroCents = 19018` and
  `estimatedUnverifiedStatus = provider_unverified`, plan
  settled 179,991 unchanged. The read projections derive these
  figures from the adjudication row, which retirement never
  writes — **the estimate never becomes "known" and the
  unverified exposure does not hide after retirement**
  (design §6.3 / §9.1).
- **The disposed attempt:** unchanged
  (`estimated_unverified`, cost NULL, estimate 19,018 /
  reservation 5,648 joined); its execution still
  `unknown_billing` (expected provenance — explicitly **not**
  a discrepancy and **not** a STOP).
- **Phase accounting:** all figures unchanged — settled
  199,665, estimated 19,018, reserved 5,648, unknownOpen 0,
  remaining 13,294,687, `provider_unverified` visible on both
  diagnostics views and capabilities. Retirement writes no
  phase state (the phase's `halted_unknown_billing` flag was
  already cleared at gate 5 and stays cleared).
- **Job view:** unchanged (state `generating`, revision 2,
  grant `issued` revision 2, 18 granted rows) — retire writes
  no job rows. Any change here is a STOP-level discrepancy.
- **Neighbors:** smoke plan `complete`; Chapter 3
  `parked_policy` with fingerprint
  `b991f18a…e282` exact; queue still paused, sole consumer;
  settings revision 1; quota 371,485 / ledgerSeq 19; conflicts
  = the same two `schedule_dead` rows; bindings 10;
  `/health` build `6a73d962…` + etag `a9a4c0c4…`, generation
  `halted`; sync watermarks 18 / 1800.

Any deviation from this contract — including a missing
unverified figure or a changed neighbor — is a STOP-level
discrepancy: report verbatim, take no further action.

## 5. Preservation

### 5.1 Records survive retirement untouched

The adjudication row (estimate basis, reservation,
authorization reference, evidence references), any amendments,
the attempt row, the execution record, all 38 entry rows, and —
after the call — the retirement audit row are permanent
history. Retirement writes none of them (except creating its
own audit row) and deletes nothing.

### 5.2 The rollback floor stands

The floor recorded at gate 5 — **build `6a73d962…` + deployed
etag `a9a4c0c4…`** — remains in force after retirement.
Retirement does not lower it and does not change the deployed
code at all (this gate ships no code). **Pre-disposition code
must never run against this data.** Any rollback remains a
separate Julie-authorized act under the design §5.3 fence
(holds, archived accounting read-back, proven adjudication
compatibility of the exact target, positive exit-gate
read-back).

### 5.3 Forward obligation (named here, binding on the next proposal)

The future re-arm / fresh Chapter 2 generation proposal
(design §11 gate 7) **must** carry the billing-truth disclosure
of §1 of this proposal — the 19,018 / 5,648 unlike-basis
mismatch, the reservation as a modeled internal allowance
rather than a provider ceiling, and the actual provider charge
as UNKNOWN — into its budget decision. Retirement does not
settle, shrink, or launder that disclosure.

## 6. Execution sequence (future gate — numbered)

- **R0 — Fresh preflight re-read.** Full closed inventory by
  the §2 method. PASS: identical to §2 on every compared
  surface (plan `halted_unknown`; disposed attempt
  `estimated_unverified` / cost NULL; retire-guard population
  zero; all phase figures; floor build + etag; halt "1"; queue
  paused; settings rev 1; Ch 3 fingerprint exact; conflicts =
  the two known rows). **Any drift → STOP before any call.**
- **R1 — Julie's approval check.** Julie's **distinct gate-6
  approval** must be recorded on roundtable issue #15 naming
  retirement of `plan:603ab416bd67ab1b25de97be` only. The
  approval's comment id is captured as `APPROVAL_REF`. Gate
  5's approval (6537050985) expressly **excluded** retirement
  and does not satisfy this step; no earlier approval of any
  kind does. Absent, ambiguous, or broader/narrower-mismatched
  approval → **STOP**.
- **R2 — The ONE retire call.** Exactly one operator POST to
  `/v2/d6-retire-halted-plan` with body
  `{ "planId": "plan:603ab416bd67ab1b25de97be",
     "note": "Gate-6 retirement of the halted_unknown Chapter 2 plan after the gate-5 section-8 disposition of attempt att-37d63768-db4b-447d-8150-580b7c6ee257 (disposition authorizationRef 6537050985); retirement approved by Julie, board comment <APPROVAL_REF>." }`
  with `<APPROVAL_REF>` replaced by the R1 comment id —
  execution with the placeholder unfilled is a STOP. PASS:
  HTTP 200 with `outcome: "applied"`, `state: "retired"`,
  `stopReason: "retired_unknown_billing"`. **Any rejection,
  error, or ambiguous/partial response → STOP: read-back only,
  NO retry, NO second call** — a second call needs Julie's
  fresh go. (By source, a duplicate call would be refused
  `plan_not_halted_unknown` in any case; that refusal is a
  safety net, not a retry strategy.)
- **R3 — Read-backs.** Full inventory against R0 under the §4
  contract, with Rowan's data-not-shape precision: confirm the
  one predicted delta and the continued visibility of the
  unverified figures; the execution's `unknown_billing` state
  is expected provenance, not a discrepancy. Any other delta →
  STOP-level discrepancy, reported verbatim; no corrective
  action without fresh authorization.
- **R4 — Record filing.** Execution record (R0/R2/R3 captures,
  request + response, approval ref, floor stamp) pinned on
  `ui1-review` and filed to issue #15 with a fresh handoff ID;
  post-retire accounting archived externally alongside the
  gate-5 rollback baseline.
- **R5 — Rowan review.** Rowan reviews the execution record.
  Re-arm and any fresh generation intent remain separate later
  gates (design §11 gate 7) — nothing in this sequence touches
  them.

## 7. Exclusions (restated, absolute)

Retirement does **NOT**: re-arm; flip `GENERATION_HALT`;
unpause the queue; release any quarantine hold; call Google or
any provider; generate audio; spend or settle any money; amend
the adjudication; change the rollback floor; or authorize any
later gate. It is one plan-state transition plus its audit row,
under Julie's separate approval, or it does not happen.

— Wren
