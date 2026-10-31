# Gate 6 — Chapter 2 halted-plan RETIREMENT: EXECUTION RECORD

**Outcome: APPLIED — exactly one retire call, R0→R5 all PASS, no
STOPs, no retry.** Executed 2026-10-31, 01:48–01:49Z, under
Julie's distinct gate-6 approval (roundtable issue #15, comment
**6537380052**) of the retirement proposal at pin
`108a6d935a6bee72ef0988c9280c4d120c802ea4`, on Rowan's GATE-6
RETIREMENT OPERATIONAL PLAN PASS WITH FUTURE RE-ARM FENCE
(**6537327586**).

Subject: plan `plan:603ab416bd67ab1b25de97be` (Forever Pucked,
Chapter 2) — **only** that plan. Live build
`6a73d9622e1b4eac00c58e289de1c674ed6b3d6b`, script etag
`a9a4c0c40ceefa6138c1cc8ebb3f0ab5b2205e7b7a057b865c8c312cbb13c39e`
(the permanent rollback floor) throughout; generation HALTED;
queue PAUSED throughout.

**Billing truth (unchanged by this gate, permanent labels):**
the actual Google/provider charge for the gate-5 disposed
attempt remains **UNKNOWN**; estimate **19,018 micro-cents** is
a full-occurrence-length model proxy, NOT an observed charge;
reservation **5,648 micro-cents** is the attempt's recorded
internal allowance, NOT a provider ceiling (unlike bases;
13,370 micro-cent mismatch carried forward to the gate-7
budget decision per the proposal §5.3 obligation).
`provider_unverified` remains visible after retirement
(invariant 1 — verified in R3 below).

## R0 — Fresh preflight re-read (2026-10-31T01:48:23Z)

Full closed inventory by the proposal §2 capture method
(client reads, operator diagnostics, Cloudflare GETs; no
mutations). The canonical assessment is **identical to the
proposal preflight on every compared value** (the only
difference is the timestamp). Headline values:

- Plan `halted_unknown` / `phase_halted_unknown_billing`;
  38 entries (20 `bound_already` / 18 `eligible`, 25,091
  chars); totals eligible 18 / done 0 / failed 8; quarantine
  not held.
- Retire-guard population **zero**: plan attempt census 51
  confirmed — success 29, policy_block 21,
  estimated_unverified 1, **unknown 0**.
- Disposed attempt `att-37d63768-db4b-447d-8150-580b7c6ee257`:
  `estimated_unverified`, `costMicroCents` **null**,
  estimate 19,018 / reservation 5,648 joined,
  `provider_unverified`; its execution record
  `unknown_billing` (provenance).
- Phase `forever-pucked`: settled **199,665** (basis
  `recorded_known_existing_ledger`), estimated **19,018**,
  reserved **5,648**, in-flight 0, **unknownOpen 0**,
  remaining **13,294,687**, `provider_unverified`.
- Containment/neighbors: /health build `6a73d962…`,
  generation `halted`; etag `a9a4c0c4…`; 10 bindings,
  `GENERATION_HALT "1"`, policy `enforce`; observability
  enabled + persisted; settings revision 1; quota
  371,485 / ledgerSeq 19 / attempts today 0; queue
  `delivery_paused = true`, sole consumer `f260f218…`;
  conflicts = exactly the two known `schedule_dead` lease
  rows; sync watermarks content 18 / bindings 1800.
- **Stale work recorded, NOT touched:** plan job
  `plan:603ab416bd67ab1b25de97be:ch1` state `generating`
  revision 2, 18 rows granted; grant
  `grant:plan:603ab416bd67ab1b25de97be:ch1:1:full` state
  `issued` revision 2. (Their executor-level disposition is
  Rowan's gate-7 fence proof — a later, separate matter.)
- Smoke plan `complete`; Chapter 3 job `parked_policy`,
  revision 1, 27 rows (3 ready / 24 pending), fingerprint
  `b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282`
  exact.

**R0 verdict: PASS — zero drift.**

## R1 — Approval check

Julie's gate-6 approval was read firsthand via the API:
comment **6537380052** (2026-10-31T01:47:34Z) records her tap
"Approve retiring the Chapter 2 plan — one call", naming
retirement of `plan:603ab416bd67ab1b25de97be` **only**, under
the R0→R5 sequence, exactly once, and expressly excluding
re-arm, unpause, release, job/grant mutation, provider calls,
generation, spend, Chapter 3 action, and any second call. Its
ID fills the note's `<APPROVAL_REF>`. **R1 verdict: PASS.**

## R2 — The ONE retire call (2026-10-31T01:49:03Z)

Exactly one operator POST (invoked once; no second call was
made or attempted):

```
POST /v2/d6-retire-halted-plan
{"planId": "plan:603ab416bd67ab1b25de97be",
 "note": "Gate-6 retirement of the halted_unknown Chapter 2 plan after the gate-5 section-8 disposition of attempt att-37d63768-db4b-447d-8150-580b7c6ee257 (disposition authorizationRef 6537050985); retirement approved by Julie, board comment 6537380052."}
```

Response — **HTTP 200**:

```json
{"outcome": "applied", "planId": "plan:603ab416bd67ab1b25de97be", "fromState": "halted_unknown", "state": "retired", "stopReason": "retired_unknown_billing", "note": "Gate-6 retirement of the halted_unknown Chapter 2 plan after the gate-5 section-8 disposition of attempt att-37d63768-db4b-447d-8150-580b7c6ee257 (disposition authorizationRef 6537050985); retirement approved by Julie, board comment 6537380052."}
```

**R2 verdict: PASS** — the exact expected success shape
(`outcome: "applied"`, `state: "retired"`,
`stopReason: "retired_unknown_billing"`).

**Write-set (source-specified, per the proposal §3.3 and
Rowan's precision rule):** the applied response and the
observable plan-state transition corroborate the single
transaction — W1 lazy `d6_plan_retirements` DDL, W2 one audit
row (plan id, the note above, server-stamped source
`"operator-route"`, server clock), W3 `d6_plans` →
`retired` / `retired_unknown_billing`. The audit row's raw
columns are **not exposed on any deployed read surface** and
are reported here as source-specified transactional writes,
**not** as independently read-back-verified row values.

## R3 — Read-backs (2026-10-31T01:49:08Z)

Full inventory against R0 under the proposal §4 contract
(data-not-shape: canonical assessments compared; raw plan body
diffed field-by-field). **Exactly one substantive delta:**

- `plan-ch2.state`: `halted_unknown` → **`retired`**;
  `stopReason`: `phase_halted_unknown_billing` →
  **`retired_unknown_billing`** (plus the row's `updated_at`,
  carried in the record hash). The raw plan-body field diff
  shows **no other changed field**.
- `plan-list` and diagnostics plan state reflect the same
  single transition — and, per **invariant 1**, the retired
  plan's summary still shows
  `estimatedUnverifiedMicroCents = 19018` and
  `estimatedUnverifiedStatus = provider_unverified`: the
  estimate was **not** promoted to known and the unverified
  exposure did **not** hide after retirement.

Everything else is **identical to R0**, including:

- **Phase accounting:** settled 199,665, estimated 19,018,
  reserved 5,648, in-flight 0, unknownOpen 0, remaining
  13,294,687, `provider_unverified` on diagnostics and
  capabilities alike.
- **Disposed attempt:** `estimated_unverified`, cost **null**,
  estimate 19,018 / reservation 5,648,
  `provider_unverified`; attempt census unchanged
  (29 / 21 / 1); its execution record still
  `unknown_billing` — expected provenance (design §9.2),
  explicitly not a discrepancy.
- **Entries:** 38 rows unchanged (20 `bound_already` +
  18 `eligible`, same ids/char counts; the 18 remain
  unbound; the retired plan no longer fences them — they are
  re-runnable only via a future fresh intent after the
  separate re-arm gate and Julie's fresh generation go).
- **Job/grant (untouched, as required):** job `generating`
  revision 2; grant `issued` revision 2; conflicts = the
  same two `schedule_dead` rows.
- **Neighbors:** smoke plan `complete` unchanged; Chapter 3
  `parked_policy` fingerprint
  `b991f18a…e282` exact; queue still paused, sole consumer;
  settings revision 1; quota 371,485 / ledgerSeq 19;
  bindings 10; observability unchanged; /health build
  `6a73d962…` + etag `a9a4c0c4…`, generation `halted`;
  sync snapshots/watermarks 18 / 1800 identical.

**R3 verdict: PASS — the R0→R3 diff is the predicted single
delta and nothing else.**

## R4 — External archive

Post-retire visible figures + the floor stamp are archived
outside the Worker at
`~/workspace/ch2-program/retirement/execution/post-retire-baseline.json`
(companion to the gate-5 rollback baseline), with the full
R0/R2/R3 captures under
`~/workspace/ch2-program/retirement/execution/`. The rollback
floor — build `6a73d962…` + etag `a9a4c0c4…` — is unchanged by
retirement and remains in force; pre-disposition code must
never run against this data.

## Exclusions honored

No second call; no re-arm; no halt flip; no queue unpause; no
quarantine release; no job/grant mutation; no
reconcile/adjudicate calls; no Chapter 3 action; no provider
/Google call; no generation; no spend. The retirement is
terminal (no un-retire exists in the deployed source).

## Next

Rowan's execution-record review (R5). Re-arm (gate 7 —
including Rowan's mandatory stale job/grant executor-refusal
fence proof and the carried 19,018 / 5,648 billing-truth
disclosure) and any fresh Chapter 2 generation intent remain
separate later Julie gates; nothing here authorizes them.

— Wren
