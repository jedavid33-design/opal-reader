That is the proven permanence mechanism. Redelivery protects against duplicate provider spend; it does not reconstruct a report whose only evidence was the prior pass's in-memory `committedCount`.

### 5.3 Commit recovery does not create a report

The production DO alarm calls, in order:

- `super.alarm()`;
- service `recover()`;
- service `driveOnce()`.

Source: `worker-entry-prod-d6.js:1379-1390`.

The store recovery scan selects execution records **not** in `committed` or `failed`. Source: `generation/genstore.mjs:922-941`. Phase A's eight executions are `committed`, so they are excluded. The 15 pending occurrences have no execution records, so they are not in the scan either.

Service `recover()` directly handles only `release_and_fail` scan items. It does not call `handleReport`, close grants, or settle grant reservations. Source: `generation/service.mjs:1386-1395`.

The D6 executor has a separate `recover()` that can reverify/commit flushed or verified records, but the production alarm path above calls the **service** recovery, not that executor recovery. In any event, all eight relevant executions are already committed, so neither recovery shape creates the missing grant report.

---

## 6. No shipped schedule heals this state

### 6.1 Lease handler

The lease schedule case is at `coordinator.mjs:2521-2604`.

Relevant behavior:

- If the grant is already `reported` or `voided`, it stops (`coordinator.mjs:2529-2530`).
- If the outbox row is missing or unsent, it follows the pre-delivery, attempted-uncertain, never-invoked, or absent-outbox branches (`coordinator.mjs:2538-2586`). Phase A's dispatch was sent and executed, so those branches are not its state.
- For a sent dispatch, it loads occurrences for the job still in state `granted`, intersects them with the grant's ledger attempt IDs, and applies `lease_expired` only to those still-`granted` occurrences (`coordinator.mjs:2588-2600`).
- Only if at least one occurrence becomes unknown does it move the job to unknown and invoke reconciliation (`coordinator.mjs:2601-2603`).

At Phase A lease expiry:

- the eight grant targets were already `ready`;
- the other 15 were `pending`, but were never targets of this grant;
- the still-`granted` target set was empty;
- `newlyUnknown` was empty.

The lease handler does not call `handleReport`, does not write `reported`, and does not settle reservations for a delivered grant whose targets are all already `ready`.

### 6.2 Watchdog and outbox drain

The watchdog schedule case only reasserts the alarm chain and calls `drainOutbox(env.sendGrant)` if a sender exists. Source: `coordinator.mjs:2513-2519`.

`drainOutbox` selects only rows with `sent_at IS NULL`. Source: `coordinator.mjs:1821-1823`.

It can delete debris for reported/voided grants and can void provably unsent work under its fences, but it never re-invokes an attempted row. Sources: `coordinator.mjs:1840-1855` and `coordinator.mjs:1856-1875`.

Phase A's grant dispatch was sent and executed. It is not an unsent outbox row awaiting delivery. The watchdog therefore has no action that reports or closes the grant.

### 6.3 Alarm driver

The alarm's service `driveOnce()` is the normal continuation path, but §4 shows its grant step returns immediately because a grant is still `issued`. Its finish/advance step also cannot fire because 15 occurrences remain pending.

The alarm therefore observes the stall indefinitely without changing it. The execution record's 41 identical polls over roughly 31 minutes — spanning the 15-minute lease fuse and three 10-minute watchdog cycles — match this source prediction.

### 6.4 Retry schedule

Retry rows are created in identified places:

- `_scheduleReAdvance`, after a safe void: `coordinator.mjs:1792-1800`;
- `handleReport` rate-limit result: `coordinator.mjs:2131`;
- frozen retry deferral: `coordinator.mjs:2613`;
- after the Batch never-accepted resolution: `coordinator.mjs:3051`;
- after a handoff void: `coordinator.mjs:2708`;
- after a drain-time delivery-window void: `coordinator.mjs:1873`.

No shipped path creates a `retry_grant` row merely because a report failed to arrive.

The retry handler itself is at `coordinator.mjs:2606-2618`. If a row existed and the job were `generating`, it would call `requestGrant` directly. As §4 notes, that handler does not repeat the driver's `liveGrant` check. The correct negative is therefore narrower and exact:

- **No shipped lost-report path creates the retry row.**
- **No retry row for this job/grant is present in the closing evidence.**
- On PT 2026-10-31, the open 52-slot reservation would in any event have left only four slots of derived headroom, insufficient for a 12-slot fresh occurrence.

A manually created retry row or a direct `requestGrant` call would be a new intervention, not shipped self-healing.

### 6.5 Handoff reconciliation

`handoff_check` acts only while a grant is `handoff_uncertain`. Source: `coordinator.mjs:2620-2635`. Phase A's grant is `issued`, its dispatch was accepted and claimed, and no handoff uncertainty is the present state. The handoff path cannot report the grant.

### 6.6 Permanence conclusion

On shipped automatic code, the plan remains stalled because all of the following hold simultaneously:

- grant = `issued`;
- claim completion is reachable only through `handleReport`;
- reservation settlement for a normally completed grant is reachable only through `handleReport`;
- the driver refuses a second grant while the first is `issued`;
- redelivery cannot call `handleReport` again;
- lease, watchdog, recovery, retry, and handoff schedules do not supply the missing call.

---

## 7. Quota ledger and PT-day rollover

### 7.1 Schema and reservation identity

`generation/quota-budget.mjs:118-131` defines the quota tables used here:

- `d6_provider_dispatches`: one row per authorized dispatch, primary key `attempt_id`, with grant, occurrence, plan, execution, dispatch day, and timestamp;
- `d6_grant_reservations`: primary key `reservation_id`, with grant, occurrence, plan, job, PT `day_key`, `slots_total`, `slots_consumed`, `state`, `close_reason`, and timestamps.

A reservation's identity is:

```text
qres:${grantId}:${occurrenceId}:${day_key}
```

Source: `generation/quota-budget.mjs:568`.

### 7.2 Reservation creation

`reserveForGrant` is at `generation/quota-budget.mjs:544-583`.

For each target it computes:

```text
SEGMENT_ATTEMPT_BUDGET - segmentAttemptsUsed
```

where `SEGMENT_ATTEMPT_BUDGET` is 12. It sums all new slots before inserting, refuses if the derived day total would exceed 100, treats reinsertion under an existing reservation identity as a no-op read, and inserts new rows as `open` with `slots_consumed = 0`.

At Phase A grant issuance, each of the eight targets was fresh for this plan/occurrence pair. Each therefore received 12 slots:

```text
8 × 12 = 96 slots reserved
```

### 7.3 Cohort bounding

`boundGrantTargets` selects the longest ordered prefix of pending occurrences whose full worst-case reservations fit the day's derived headroom. Source: `generation/quota-budget.mjs:585-642`.

At Phase A start:

- PT 2026-10-31 dispatched = 0;
- reserved = 0;
- each fresh occurrence required 12;
- eight occurrences required 96;
- a ninth would have required 108 > 100.

Cohort 1 was therefore exactly eight.

The module's own continuation comment assumes the existing driver machinery will issue the next cohort once the current grant settles (`generation/quota-budget.mjs:597-603`). The stall is precisely the failure of that settlement precondition.

### 7.4 Dispatch accounting

`applyDispatchQuota` is at `generation/quota-budget.mjs:737-817`.

Its key properties are:

- it computes the dispatch day in Pacific Time;
- if an open reservation exists for the same grant and occurrence on the dispatch day, it uses it;
- if no same-day reservation exists but an open reservation exists for another day, it creates a new same-grant/same-occurrence reservation for the dispatch day; the old-day reservation is neither debited nor closed in that transaction;
- it verifies stored `slots_consumed` equals the derived dispatch count for the reservation;
- it refuses if no slot remains;
- it writes exactly one dispatch row;
- it increments exactly one reservation's `slots_consumed`.

`markDispatching` calls `applyDispatchQuota` inside the attempt-transition transaction before a provider call. Source: `generation/genstore.mjs:171-189`.

A dispatch-ledger row therefore proves an authorized, counted dispatch. It does not by itself prove a particular Google-billed amount.

### 7.5 Derived day totals

`derivedDayTotals` is at `generation/quota-budget.mjs:193-202`:

- **dispatched** = count of `d6_provider_dispatches` rows whose `dispatch_day_key` equals the requested day;
- **reserved** = sum of `slots_total - slots_consumed` over reservation rows whose `day_key` equals the requested day **and** whose state is `open`;
- **consumed** = dispatched + reserved.

There is no stored day counter to reset, expire, or decrement.

Phase A arithmetic reconciles exactly:

| Chapter idx | Occurrence ID | Attempts used | Residual slots |
|---:|---|---:|---:|
| 7 | `05941584-5669-4ea9-91e7-59a5397f46c4` | 4 | 8 |
| 9 | `5f6ca428-524d-448a-8fbf-a773dfc132e6` | 6 | 6 |
| 11 | `4e163ba6-87d6-467f-a8a7-52a0062ca69e` | 6 | 6 |
| 12 | `4746f9a6-9f05-4a65-a175-83b24f8d539a` | 6 | 6 |
| 16 | `338676cd-63fa-409d-8e42-e13c28636de3` | 6 | 6 |
| 20 | `203af7f9-d88a-4f2a-a0fd-3f70d0a11f07` | 6 | 6 |
| 23 | `0c83bc51-7fc9-4ac7-b0ca-f81f1729a38e` | 4 | 8 |
| 25 | `35ab06fd-8459-41ff-a8b7-ae4bf25be731` | 6 | 6 |
| **Total** | **8 reservations** | **44** | **52** |

Thus, while the reservations remain open:

```text
PT 2026-10-31: 44 dispatched + 52 reserved = 96 consumed
```

If — and only if — the eight reservations are legitimately closed with `grant_settled`, no dispatch row is erased and no `slots_consumed` value changes. That day's derived totals become:

```text
PT 2026-10-31: 44 dispatched + 0 open reserved = 44 consumed
```

That would restore 56 slots of derived headroom **for PT 2026-10-31**. It would not create a credit on another day and would not alter the 44 real dispatches.

### 7.6 What PT rollover actually does

A PT-day rollover does **not**:

- delete an open reservation;
- expire an open reservation;
- close an open reservation;
- change the grant from `issued`;
- complete the claim;
- call `handleReport`;
- create a `retry_grant` row.

The reservation row remains `open`, keyed to its original `day_key`. The grant remains `issued` independently of the date.

There is, however, a second fact that must not be conflated with the first:

- because `derivedDayTotals` filters reservations by `day_key`, an old day's open reservation does **not** consume a later day's derived reserved total;
- a genuinely fresh PT day therefore starts with fresh derived headroom, absent that day's own dispatches/reservations;
- the plan still does not resume, because `driveOnce`'s `liveGrant` check is date-independent.

Rowan's warning is therefore upheld in its operative sense and refined in its accounting sense:

> **Rollover clears neither the issued grant nor the old reservation. It only means the old reservation is not counted against the new day's derived total. The stall persists because of grant state, not because the old 52 slots continue to consume the new day.**

If the same old grant somehow dispatched on a later day, `applyDispatchQuota` could create a new reservation for the dispatch day while leaving the old-day reservation open and undebited. That is not the Phase A continuation path: the old grant's eight occurrences are terminal/committed, and the 15 pending occurrences were never targets of that grant.

---

## 8. Candidate micro-causes for the first lost report

### Ranking summary

| Rank | Candidate | Status |
|---:|---|---|
| 1 | The executor invocation ended after the final commit but before the report transaction committed | Most parsimonious; consistent with every durable fact; exact termination point unprovable |
| 2 | `handleReport` began, its transaction threw, and `_tx` rolled it back | Source-proven failure shape; no specific throwing statement or production error identified |
| 3 | `handleReport` returned `stale_revision` without throwing, and the executor ignored the return | Real shipped path newly identified here; no evidence that the revision actually diverged |
| — | Redelivery non-healing | **Proven permanence mechanism**, not an independent explanation for the first loss |

### 8.1 Candidate 1 — invocation ended before the report committed

This includes termination:

- after the eighth `commitVerified` and before the report call;
- during the `jobView` read immediately before the report;
- during `handleReport`'s pre-transaction `wake()`;
- during the report call before its transaction committed.

Evidence for:

- all eight executions and bindings committed durably;
- grant remained `issued`;
- claim remained uncompleted;
- reservations remained open;
- the rest of the cohort is clean and complete.

That is exactly the state expected if the report transaction never committed.

Evidence limitation: no available surface proves the precise termination point.

### 8.2 Candidate 2 — report transaction threw and rolled back

Under `_tx`, a throw inside `handleReport` rolls back the transaction's writes, including the grant's `reported` state, claim completion, and reservation settlement. Source: `coordinator.mjs:384-392`.

The coordinator test suite proves the shape: in `tests/coordinator-recovery.test.mjs:131-149`, a report whose binding probe throws is rejected, the grant remains `issued`, the occurrence remains `granted`, no binding is written, and a later direct re-report succeeds.

Evidence for applying that shape here:

- the durable end state is indistinguishable from “the report never landed”;
- if the throw propagated through the D6 executor and queue handler, a redelivery would be expected;
- that redelivery is provably non-healing because all targets are skipped and the report condition becomes false.

Evidence limitation: no specific throwing statement has been identified from production evidence, and the Phase A occurrences were already committed through `commitVerified`, so the coordinator test's exact binding-probe failure is not a demonstrated Phase A cause.

### 8.3 Candidate 3 — non-throwing `stale_revision` rejection ignored by the executor

This candidate was **not** in the execution record's two hypotheses. Source analysis found it.

Mechanism:

1. The D6 executor reads the job view at `generation/d6-executor.mjs:858`.
2. It passes that view's revision to `handleReport` at `generation/d6-executor.mjs:859`.
3. `handleReport` awaits `wake()` before entering its transaction (`coordinator.mjs:2059-2060`).
4. Inside the transaction, if the supplied revision differs from the job's current revision, it returns `{ ok: false, reason: "stale_revision" }` and changes no grant or reservation state (`coordinator.mjs:2076-2079`).
5. The D6 executor does not inspect the return value.
6. `handleMessage` therefore returns normally, `_execute` returns HTTP 200, and the queue handler can acknowledge the message (`worker-entry-prod-d6.js:1374-1376`, `worker-entry-prod-d6.js:1834-1835`).

This path produces exactly the observed durable end state and explains why there may have been no useful queue redelivery.

Why it is not ranked higher:

- no production evidence shows that the job revision changed between the executor's final `jobView` and the coordinator transaction;
- the closing job and grant revisions are both 2, and the executor reads its view after the work loop;
- ordinary commit operations before that read do not by themselves establish a mismatch;
- the narrow interleaving that would be required has not been proved.

It must remain a candidate, not a conclusion.

### 8.4 Redelivery non-healing is the permanence mechanism

If a redelivery occurred, §5 proves why it could not repair the state. That mechanism explains permanence after any of Candidates 1–3. It does not by itself explain why the first report was lost.

### 8.5 Ruled out or strongly disfavored

- **Unknown-billing stop:** the D6 executor's unknown path returns without a report (`generation/d6-executor.mjs:851-856`), but Phase A has all 44 attempts confirmed, unknown open 0, and all eight executions committed. That is not the observed state.
- **Provider daily-limit report:** no quota park was recorded, the job did not park, and blocked/failed remained 0.
- **Terminal policy block:** the 14 `policy_block` attempts were absorbed by recursive splitting and the eight executions ultimately committed; plan blocked remained 0.
- **Lease expiry as a closer:** §6.1 proves it processes only still-`granted` target occurrences.
- **Watchdog outbox drain:** §6.2 proves it processes only unsent rows.
- **Reservation expiry by PT rollover:** §7.6 proves no such expiry path exists.
- **A second grant blocked by grant-ID collision:** not the primary mechanism. The old grant embeds job revision 1 and the job is now revision 2; the operative automatic block is the driver's explicit `liveGrant` check.

### 8.6 What remains unprovable

Without Workers Logs, queue delivery/acknowledgement records, or a readable coordinator transitions log, the available evidence cannot distinguish definitively among:

- termination before the report;
- a throwing and rolled-back report transaction;
- a non-throwing stale-revision rejection;
- another interruption inside the report call.

The diagnosis therefore proves the **stall mechanism and its permanence**, not the single micro-cause of the first lost report.

---

## 9. Gate-8 Chapter 2 precedent

The Gate-8 Chapter 2 plan completed even though its single grant still carries `issued` residue. That is not a counterexample to this diagnosis. It follows from the completion rules.

### 9.1 Why Chapter 2 could complete

Chapter 2 had 18 eligible occurrences, all covered by one grant. Once all 18 occurrences/executions reached their completed states, no second cohort was needed.

`finishPlan` counts an eligible entry as done if:

- its occurrence is `ready`, **or**
- its execution is `committed`.

If done equals the number of eligible entries, it sets the plan `complete`. It does not inspect grant state. Source: `generation/service.mjs:869-885`.

The driver can invoke that finish path when the current job is terminal or has zero occurrences in `pending` or `granted`. Grant state is not part of that condition. Source: `generation/service.mjs:1011-1027`.

Likewise, `_deriveJobCompletion` derives job completion from occurrence counts, not from whether the grant was reported (`coordinator.mjs:2370-2393`).

A single-grant plan can therefore finish from occurrence/execution state despite a lost grant report.

### 9.2 Why Phase A cannot use the same exit

Phase A needs cohort succession:

- grant 1 covered only 8 of 23;
- 15 occurrences remain `pending`;
- `finishPlan` cannot count them done;
- the driver's finish branch cannot fire while they remain open;
- the driver's grant branch cannot fire while grant 1 remains `issued`.

The implication is general:

> **A lost report is survivable for a plan whose only grant covers every eligible occurrence. It is fatal to automatic continuation for any plan that needs a second cohort.**

### 9.3 Test history

Cohort succession had never run live before Phase A. It had run in harness regressions where each round's report landed:

- `tests/quota-corrections.test.mjs:220-280` runs an 18-fresh-segment job through three bounded grants described as 8 / 7 / 3, asserting that the remainder stays pending after each round, that the three grant IDs are distinct, that no occurrence is omitted or duplicated, and that derived totals end at 18 dispatched / 0 reserved.
- `tests/quota-rereview.test.mjs:244-330` runs a 101-fresh-occurrence job across a PT-day boundary, asserting bounded progress on day 1, survival of the ordered remainder across midnight, and completion on day 2 through the job's own grants.

Those tests prove the intended succession machinery when reports settle. They do not exercise the exact Phase A defect state: a first cohort whose executions all commit while its grant report never lands, followed by an executor redelivery.

The D6 fault-injection test at `tests/d6-executor-fi.test.mjs:265-292` covers a different redelivery shape: recovery commits the execution, a later pass lands the report, and a still later redelivery is dropped because the claim is `completed`. It does not cover a redelivery that arrives when the executions are committed but the claim/grant remain unreported.

---

## 10. Diagnosis conclusions for the recovery proposal

Any safe recovery must satisfy all of the following. These are consequences of the source proof above, not optional preferences.

1. It must close the existing grant truthfully as a delivered, claimed, executed grant — not void it.
2. It must settle exactly that grant's eight reservations with reason `grant_settled`, and it must prove all eight actually closed rather than assuming a settlement sweep succeeded.
3. It must preserve all 44 dispatch rows and all stored `slots_consumed` values.
4. It must not change phase settled (732,303), estimated unverified (19,018), reserved unverified (5,648), unknown open (0), bindings (1826), or content watermark (18) as part of grant finalization.
5. It must leave the plan `active` with done 8 and the job `generating` with 15 pending; finalization is bookkeeping closure, not plan completion.
6. It must resume the 15 only through the ordinary driver/grant machinery, so the existing phase, budget, storage, quarantine, halt, grant-count, and provider-attempt fences all remain in force.
7. It must not touch the Phase A park-release row (releaseId 1, already `live`) and must not perform any Phase B exemption action.
8. It must treat a PT-day rollover as accounting context only, never as the recovery mechanism.
9. It must distinguish finalization from resumed generation as separate authorized acts.
10. It must include the exact lost-report/redelivery fixture in tests, because the shipped harness proves cohort succession only when the report lands.

**Diagnosis verdict:** the lost-report path and the permanence of the stall are understood. The first report's exact micro-cause remains honestly unprovable on the available telemetry.
