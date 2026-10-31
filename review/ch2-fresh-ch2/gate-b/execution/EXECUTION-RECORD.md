# EXECUTION RECORD — Gate (b): quota-guard bootstrap + read-only reconciliation (B0–B2)

Executed 2026-10-31, 18:13:05–18:14:41Z, under Julie's recorded
approval (issue #15 comment **6547256803** — "GO — execute gate (b)
B0–B2 exactly as scoped (one bootstrap attempt, no retry)") of the
proposal pinned **`e324efb060b9b272d67977effc59890fca6d8441`** on
`ui1-review` (`jedavid33-design/opal-reader`), which carries Rowan's
gate-(b) proposal PASS (comment 6547238747, including her execution
caution on fault-vs-rollback proof).

**Outcome: GATE (b) B0–B2 COMPLETE — declared outcome CLEAN
(§5.5).** B0: all six checks PASS. B1: exactly **one** bootstrap
call, clean HTTP 200 `applied` — assigned **136**, exceptions **1**.
B2: census **COMPLETE** under §5.3's law — drift **empty**,
`ok === true`, one exception, fully enumerated and explained
below. End state: quota guard **ARMED** in the accounting sense
only (§8); generation still **HALTED**, queue still **PAUSED**,
nothing generated, no provider call, nothing spent. **No B3 /
disposition call was made** (the route was not touched in this
run); **no second bootstrap call**; no re-arm, no unpause, no
halt flip, no settings change.

Labels: **CONFIRMED** = read back from production or verified in
this run. **INFERRED** = deduced from cited recorded evidence.
**OPEN** = unresolved and carried forward.

## B0 — preconditions re-verified in-session: PASS, all six checks (capture 18:13:05Z; evidence/b0/)

Comparison basis: the gate-(a) D4 final assess
(`final-envelope/execution/evidence/d4/assess-d4.json`) plus
proposal §2. **CONFIRMED: every compared surface of this run's B0
capture is identical to gate-(a)'s D4 final state** — health,
queue, bindings, observability, settings, capabilities, plan
list, all three plan reads, all three job reads, both snapshot
families, conflicts, all three diagnostics reads, and the script
etag all compare equal.

1. **Build identity — CONFIRMED.** `/health`: build
   `945875bc26b0e2ca965d5c0f710f11c0164025f8`, generation
   `"halted"`, coordinator `"armed"`, scope `"production"`.
   Script etag re-read (GET script response header):
   `d63b61c349a3518998d29d318ec465af24a63468df6cdf4876e4ba8862849039`
   — exact.
2. **Hold state — CONFIRMED.** Bindings: exactly the 10 expected
   names; `GENERATION_HALT "1"`; `OPALREADER_PHASE_POLICY
   "enforce"`. Observability enabled + logs enabled + persisted
   (script-settings read).
3. **Queue pause (pre-B1 read) — CONFIRMED.** cf-api read-back:
   `delivery_paused == true`, sole consumer
   `f260f2188d80426bb0588685e9d084eb` (`opalreader-api-v2-prod`).
   The binding C-1 checkpoint read is recorded separately below.
4. **Unarmed proof — CONFIRMED.** Operator
   `GET /v2/d6-quota-reconcile` (18:13:36Z) returned exactly
   `{"armed":false,"ok":false,"reason":"not_armed"}` — the floor
   shape, verbatim (evidence/b0/reconcile-b0.json).
5. **Generation-plane identity — CONFIRMED.** Plans (list
   exhaustive, nextCursor null): smoke `complete`; old Ch 2
   `plan:603ab416bd67ab1b25de97be` `retired`; fresh Ch 2
   `plan:b2dc2a3d1cd367a0245b9102` `complete`. No active plan.
   Ch 3 job `1832c21f…` `parked_policy`, 27 rows (3 ready /
   24 pending), grants [], fingerprint recomputed by the G8
   recipe =
   **`b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282`**
   (exact). Phase `forever-pucked`: settled **579,339**,
   estimatedUnverified **19,018**, reservedUnverified **5,648**,
   unknownOpen **0** (inFlightUpper 0), remaining **12,915,013**
   of 13,500,000. Settings revision **1** (lane standard, cap
   $50). Watermarks content **18** / bindings **1818**.
   Conflicts: the same 3 `schedule_dead` rows (raw-identical to
   gate-(a) D4). Attempt inventory: **137** attempts across the
   three plans (7 smoke + 51 old Ch 2 + 79 fresh Ch 2), **all**
   in phase `confirmed`, zero in-flight; the old Ch 2
   diagnostics show exactly one `estimated_unverified` attempt
   outcome (the gate-5 adjudicated attempt, §6.3).
6. **Operator readiness — CONFIRMED.** Binding
   `OPALREADER_MIGRATION_OPERATOR_TOKEN` present by name in the
   bindings list (presence only); the B0.4 reconcile read was
   admitted through the operator fence, doubling as the
   readiness proof. No credential value was displayed or logged.

## Checkpoint C-1 — queue pause immediately before B1: PASS (18:13:39Z; evidence/queue-c1.json)

cf-api read-back, 4 seconds before the B1 call:
`delivery_paused == true`, sole consumer unchanged.

## B1 — the bootstrap: exactly ONE call, clean applied (18:13:43Z; evidence/b1-request.txt, evidence/b1-response.json)

- **Call:** `POST /v2/d6-quota-bootstrap` via the operator
  connector, production scope/instance headers, one credential
  surrogate, **no body sent** (the connector was invoked with no
  `--body`/`--body-file` argument — an absent body, the first
  admissible shape in §4.1).
- **Response: HTTP 200**, full body archived verbatim:
  `{"outcome":"applied","bootstrapped":true,
  "alreadyArmed":false,"assigned":136,
  "providerAttemptDailyLimit":100,"exceptionCount":1,
  "exceptions":[{"attemptId":"att-37d63768-db4b-447d-8150-580b7c6ee257",
  "phase":"confirmed","intervalDays":["2026-10-29","2026-10-30"]}],
  "exceptionsTruncated":false}`.
- **Reading of the response — CONFIRMED:** the call was neither
  a refusal/fault (§4.4 class (a)) nor an ambiguous/lost
  response (class (b)): a complete, readable HTTP 200 `applied`
  outcome was received, so no rollback-vs-commit ambiguity
  arises and Rowan's caution (fault alone ≠ rollback proof;
  read back, STOP on uncertainty) was never triggered. The
  first census read at B2 (below) independently confirms the
  committed state the response reports (`armed: true`, totals
  consistent with `assigned 136` + `exceptionCount 1`).
- `alreadyArmed: false` — consistent with B0.4's floor-shape
  proof; no B0↔B1 discrepancy exists.
- `assigned (136) + exceptionCount (1) = 137` — the entire
  recorded attempt inventory from B0.5 is accounted for;
  nothing else existed for the backfill to meet (CONFIRMED by
  the B2 totals: day totals sum to 136).
- **Exactly one bootstrap call was made in this run.** No
  retry, no second invocation, deliberate or otherwise.

## Checkpoint C-2 — queue pause after B1, before the census: PASS (18:13:47Z; evidence/queue-c2.json)

cf-api read-back: `delivery_paused == true`, sole consumer
unchanged.

## B2 — the complete paginated reconcile census: COMPLETE (evidence/census-page-000…003.json)

Four operator `GET /v2/d6-quota-reconcile` reads, all HTTP 200,
all archived verbatim:

| Page | Offsets (exc/drift) | exceptionCount | driftCount | nextOffsets | censusComplete |
|---|---|---|---|---|---|
| 000 | default (0/0) | 1 | 0 | null / null | **true** |
| 001 | explicit 0/0 | 1 | 0 | null / null | **true** |
| 002 | explicit 1/0 (past-end probe) | 1 | 0 | null / null | false |
| 003 | default (0/0), closing read | 1 | 0 | null / null | **true** |

**Completeness under §5.3 — CONFIRMED:**
- *Disjoint:* the single offset-0 response holds the whole
  exceptions array (1 of 1) and the whole drift array (0 of 0);
  the offset-1 probe returns an empty slice. No entry appears
  twice.
- *Union equals totals:* exceptions union = 1 = `exceptionCount`;
  drift union = 0 = `driftCount`.
- *Totals stable:* `(exceptionCount, driftCount) = (1, 0)` on
  all four reads, first through last; `dayTotals` identical on
  the first and closing reads.
- *`censusComplete`:* true on the offset-0 responses, including
  the closing read. Page 002's `false` is definitional, not a
  §5.4(4) event: CONFIRMED from source
  (`worker-entry-prod-d6.js`, reconcile handler) that
  `censusComplete` is computed as `driftOffset === 0 &&
  exceptionOffset === 0 && both nextOffsets === null` — "true
  only when one response holds both arrays whole." It became
  true at the reported totals; §5.4(4) ("never becomes true")
  does not apply.
- No §5.4 condition occurred: no page fault or refusal, no
  totals movement, no overlap, no unparsable entry, no
  checkpoint failure.

**Census content:**
- `armed: true`, `ok: true`, `currentDayBlocked: false`.
- **Per-day dispatch totals** (derived from
  `d6_provider_dispatches`): PT **2026-10-29**: dispatched
  **57**, reserved 0, consumed 57. PT **2026-10-30**:
  dispatched **79**, reserved 0, consumed 79. Sum **136** =
  B1's `assigned`. Current day (2026-10-31) totals: dispatched
  0, reserved 0, consumed 0. No day exceeds the app-selected
  cap of 100 → no `day_over_limit` drift exists.
- **Drift: EMPTY** (`drift: []`, `driftCount: 0`) — the derived
  totals agree with the records everywhere the store checks.
- **Exceptions: exactly ONE**, enumerated in full:
  - attemptId `att-37d63768-db4b-447d-8150-580b7c6ee257`
  - executionId `exec-6a9c4e14-2223-4806-9694-90cd140cbd8e`
  - planId `plan:603ab416bd67ab1b25de97be` (the retired
    original Chapter 2 plan)
  - occurrenceId `59acff00-d6a4-4e2b-9734-34d50f4f59f0`
  - phase `confirmed`; outcome **`estimated_unverified`**
  - createdAt `1793315781213` = 2026-10-29T23:16:21Z = PT
    **2026-10-29**; updatedAt `1793409518606` =
    2026-10-31T01:18:38Z = PT **2026-10-30**;
    `intervalDays: ["2026-10-29","2026-10-30"]`.

**Explanation of the single exception — CONFIRMED from the
records:** this is the gate-5 adjudicated attempt (§6.3), named
identically in the gate-5 record (same attempt id, execution
id, occurrence id). Its evidence interval straddles a PT
midnight for a recorded reason: it was *created* during the
original Chapter 2 run on PT 2026-10-29, and its *final update*
is the gate-5 adjudication write at 2026-10-31T01:18:38Z
(PT 2026-10-30) — the exact moment of the approved adjudication
call (gate-5 record: 01:18:32Z, response processing completing
seconds later). Because `[created_at, updated_at]` spans two
PT days, neither bootstrap evidence basis (§4.2) can assign it
a day with proof, so the bootstrap correctly assigned it
**nothing** and surfaced it as the exception. It is a straddle
by construction — **never dispositionable** (§7 store law:
`quota_disposition_ambiguous_interval`), and no disposition
was attempted or is proposed as a routine item (§6.3's named
callout rule stands for any future consideration). It touches
no current day: its interval ended PT 2026-10-30 and the
current PT day is 2026-10-31, so `currentDayBlocked` is
false and it does not hold the present.

**Explanation of the day totals — INFERRED from recorded
history, arithmetic CONFIRMED:** 57 + 79 = 136 assigned. The
79 on PT 2026-10-30 are the Gate-8 fresh Chapter 2 run's 79
attempts (executed 2026-10-31 03:52–04:16Z = PT 2026-10-30
evening; B0 diagnostics count exactly 79 attempts for that
plan). The remaining inventory — G10
...[truncated 5830 chars]