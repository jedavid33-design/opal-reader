# EXECUTION RECORD — gate 5: the one §8 uncertainty disposition, EXECUTED

**Result: APPLIED, exactly once, exactly as proposed. All
steps E0→E3 PASS; no STOP; no retry; no second call.**

Executed 2026-10-31, 01:17–01:19Z, under:

- Julie's distinct explicit gate-5 approval, roundtable
  issue #15 comment **6537050985** (recorded by Wren from the
  Coding Projects chat Oct 30, 2026 ~9:16 p.m. ET; verified
  firsthand by the executor before the call — it names
  exactly this attempt and this plan and permits ONE call
  only). This comment ID was the call's `authorizationRef`.
- Rowan's GATE-5 PLAN PASS WITH BILLING-TRUTH CONDITIONS,
  comment **6537006494**, on the execution proposal at pin
  `7051f6adbf14ebc002026e3ce79db96787155582`.

**Subject:** attempt `att-37d63768-db4b-447d-8150-580b7c6ee257`
in plan `plan:603ab416bd67ab1b25de97be`, occurrence
`59acff00-d6a4-4e2b-9734-34d50f4f59f0` — disposed as
`estimated_unverified`; `cost_micro_cents` remains **NULL**;
the provider charge remains **`provider_unverified`**. No
known cost was asserted; no settlement was invented; the
known-cost §6 route remains NOT SUBMITTED and was not used.

Local evidence: `~/workspace/ch2-program/adjudication-execution/execution/`
(`e0/` preflight capture + assessment, `e2-request.json`,
`e2-response.json`, `e3/` read-back capture + assessment,
`rollback-baseline.json`).

## E0 — Preflight re-read: PASS

Full read set re-taken fresh at **2026-10-31T01:17:52Z**
(the proposal §5 E0 set: health, script etag via GET
headers, `/settings` bindings + script-settings, both
queues, settings, quota, capabilities, plan list + both
plans, both jobs + Ch 3 job, conflicts, both sync snapshots,
both diagnostics views). The canonical assessment of the E0
capture is **identical to the proposal preflight assessment
(pf1, 2026-10-31T00:56:25Z) on every compared value except
the timestamp itself**. Load-bearing values, read firsthand:

- `/health`: build
  `6a73d9622e1b4eac00c58e289de1c674ed6b3d6b`, generation
  "halted"; script etag
  `a9a4c0c40ceefa6138c1cc8ebb3f0ab5b2205e7b7a057b865c8c312cbb13c39e`
  (the rollback-floor identity, undrifted);
  `GENERATION_HALT "1"`, policy "enforce"; queue
  `delivery_paused == true`, sole consumer
  `f260f2188d80426bb0588685e9d084eb`; settings revision 1;
  observability enabled + persisted.
- The attempt: `phase "confirmed"`, `outcome "unknown"`,
  **`costMicroCents` null**, `upperMicroCents` **5,648**,
  seq 7 — the plan's sole confirmed/unknown row.
- Plan: `halted_unknown` / `phase_halted_unknown_billing`.
- Phase accounting: settled **199,665** / estimated **0** /
  reserved **0** / in-flight 0 / **unknownOpen 1** /
  remaining **13,300,335**; `unverifiedStatus:
  "provider_unverified"`; zero-disposition evidence as in
  the proposal §1 (capabilities 0/0, both plan summaries 0
  with no status key, no `estimated_unverified` attempt
  among the 58).
- Ch 3 job `parked_policy`, fingerprint
  `b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282`
  exact; conflicts = the two recorded `schedule_dead` rows;
  quota 0 / 371485 / ledgerSeq 19; watermarks 18/1800.

No drift on any value. **E0 PASS.**

## E1 — Julie approval check: PASS

Approval comment **6537050985** read firsthand via the
GitHub API before execution: it records Julie's tap
"Approve the one disposition call for that attempt" on the
widget presenting Rowan's PLAN PASS 6537006494 for proposal
pin `7051f6ad…`, names attempt
`att-37d63768-db4b-447d-8150-580b7c6ee257` and plan
`plan:603ab416bd67ab1b25de97be`, scopes the approval to ONE
call with the billing-truth disclosure as presented, and
expressly excludes retirement, re-arm, provider calls,
generation, and spend. Present and unambiguous. **E1 PASS.**

## E2 — The one call: PASS (the gate's only mutation)

Invoked **exactly once** at 2026-10-31T01:18:32Z via the
operator connector:

```text
v2prod-operator-api POST /v2/d6-adjudicate-estimated
  --header 'X-OpalReader-Scope: production'
  --header 'X-OpalReader-Instance: account'
  --body '{"attemptId": "att-37d63768-db4b-447d-8150-580b7c6ee257",
           "planId": "plan:603ab416bd67ab1b25de97be",
           "authorizationRef": "6537050985",
           "note": "Gate-5 adjudication execution: section-8 estimated_unverified disposition of the one Chapter 2 unknown attempt; provider charge unverified; approval recorded at authorizationRef."}'
```

**Response — HTTP 200, verbatim:**

```json
{"outcome": "applied",
 "attemptId": "att-37d63768-db4b-447d-8150-580b7c6ee257",
 "attemptOutcome": "estimated_unverified",
 "attemptCostMicroCents": null,
 "estimatedCostMicroCents": 19018,
 "reservedCostMicroCents": 5648,
 "adjudication": {"attemptId": "att-37d63768-db4b-447d-8150-580b7c6ee257",
                  "planId": "plan:603ab416bd67ab1b25de97be",
                  "phase": "forever-pucked",
                  "disposition": "estimated_unverified"},
 "haltCleared": true}
```

Every expected value matches the proposal §2 exactly:
`outcome "applied"`, estimate **19,018**, reservation
**5,648**, `attemptCostMicroCents` **null**,
`haltCleared: true`. This was also the lazy adjudication
DDL's first production invocation; it completed inside the
one transaction with no error. **No second call was made,
and none will be made under this approval.**

Billing truth, restated per Rowan's conditions: 19,018 is
an occurrence-length model proxy (full occurrence, 1,349
chars) — not an observed Google charge and not the split
request's own measured length; 5,648 is the split attempt's
persisted modeled allowance — not a verified upper bound or
bill ceiling (the proxy exceeds it by 13,370 on unlike
bases); **the actual Google charge remains unknown**.

## E3 — Read-backs: PASS

Full read set re-taken at **2026-10-31T01:18:40Z**. The
canonical E0→E3 assessment diff contains **exactly the
predicted disposition footprint and nothing else**:

- Capabilities, phase `forever-pucked`: estimated
  0 → **19,018**; reserved 0 → **5,648**; remaining
  13,300,335 → **13,294,687** (= 13,500,000 − 199,665 −
  5,648); settled **199,665 unchanged**; generationState
  still "halted".
- Diagnostics (Ch 2 view): attempt outcomes — `unknown`
  count gone, `estimated_unverified` = **1**; the attempt
  row itself: `outcome "estimated_unverified"`,
  **`costMicroCents` still null**, joined figures
  `estimatedCostMicroCents 19018`,
  `reservedCostMicroCents 5648`,
  `estimatedUnverifiedStatus "provider_unverified"`.
- Phase accounting (both diagnostics views — phase-scoped,
  as established): settled 199,665 unchanged; estimated
  **19,018**; reserved **5,648**; **unknownOpen 0**;
  remaining 13,294,687; `unverifiedStatus:
  "provider_unverified"` still present.
- Plan list, Ch 2 summary: `estimatedUnverifiedMicroCents`
  0 → **19,018**, `estimatedUnverifiedStatus` now
  `"provider_unverified"`; plan state still
  **`halted_unknown`**, stopReason
  `phase_halted_unknown_billing` unchanged; plan settled
  179,991 unchanged; smoke plan untouched.
- The historical execution record
  `exec-6a9c4e14-2223-4806-9694-90cd140cbd8e` still reads
  **`unknown_billing`**, and the plan entry for the
  occurrence still reads `executionState "unknown_billing"`
  — provenance preserved, as designed (not a discrepancy).
- Footprint outside the write-set W1–W4: **identical** —
  /health build + halted; script etag unchanged
  (`a9a4c0c4…`); bindings unchanged (halt "1", policy
  "enforce"); observability unchanged; queue still PAUSED
  with the sole consumer; settings revision 1; quota
  unchanged; watermarks 18/1800; conflicts unchanged (the
  two `schedule_dead` rows); both plans' jobs and grants
  unchanged; Ch 3 job still `parked_policy` with the exact
  fingerprint; both sync snapshots unchanged.

**Reporting precision (Rowan's rule):** the adjudication
row's non-surface columns — `estimate_basis`,
`authorization_ref`, `evidence_refs`, and the row's
remaining stored fields — are reported here as
**source-specified transactional writes** of the applied
call (per the deployed source and the response above), NOT
as independently read-back-verified row values: no deployed
read surface exposes those raw columns. Everything that IS
observable was read back and matches.

## E4 — External archive + rollback floor

The post-call capabilities + diagnostics figures are
archived externally with this record at
`~/workspace/ch2-program/adjudication-execution/execution/rollback-baseline.json`
(floor build `6a73d962…` + etag `a9a4c0c4…`; settled 199,665;
estimated 19,018; reserved 5,648; unknownOpen 0; remaining
13,294,687; `provider_unverified`). **From this disposition
onward, build `6a73d962…` + etag `a9a4c0c4…` is the rollback
floor**: rollback to any pre-disposition build is
PROHIBITED while this adjudication row exists, and any
future rollback follows design §5.3's holds and its
proven-compatibility exit gate against this archived
baseline.

## Exclusions honored

No second call; no retire call; no reconcile call; no
release; no queue unpause; no halt flip; no Chapter 3
action; no client publication; no generation; no provider
or Google call; no spend. The disposition wrote no cost
anywhere; Google's billing was neither read nor altered.

## Next

**E5 — Rowan's review of this record.** Nothing further is
authorized by this execution: **retirement of the halted
plan and any re-arm / fresh Chapter 2 generation remain
later, separate Julie gates.**

— Wren
