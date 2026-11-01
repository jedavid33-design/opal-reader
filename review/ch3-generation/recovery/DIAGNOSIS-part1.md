# Opal Reader v2 — Chapter 3 Phase A Stall Diagnosis

**Status:** Read-only diagnosis. No production mutation, code change, GitHub pin, or board post is made by this document.

**Live build diagnosed:** `63d7260ef0c87c45cdcb88c7007643bb90e1631c`

**Shipped-source root for citations:** `~/workspace/ch2-program/ch3-build/worker-build/worker/`

Unless a citation names another file, `file:line` below is relative to that root. Test citations are relative to `~/workspace/ch2-program/ch3-build/worker-build/`.

**Execution record reviewed:** `~/workspace/ch2-program/ch3-phase-a/execution/EXECUTION-RECORD.md` and its `evidence/` directory.

**No-spoilers note:** This diagnosis uses only structural metadata — IDs, states, counts, digests, timestamps, and ledger figures. It does not use segment text or speech text.

---

## Executive verdict

1. **The stall mechanism is understood.** Cohort 1 committed all eight of its occurrences through the store commit path, but the coordinator grant was never reported. The grant therefore remains `issued`, its eight quota reservations remain open, and the normal plan driver refuses to request another grant while any grant for the job is `issued`.

2. **The stall is permanent on the shipped automatic paths.** Queue redelivery cannot regenerate the missing report after all eight occurrences have become `ready`; the lease handler acts only on occurrences still `granted`; the watchdog drains only unsent outbox rows; recovery scans exclude committed executions; and no shipped schedule creates a `retry_grant` row for a lost report. A Pacific-Time day rollover does not close either the grant or its reservations.

3. **The exact micro-cause of the first lost report is not provable from the available surfaces.** The durable end state is consistent with an invocation ending before the report transaction committed, a throwing report transaction that rolled back, or — a third path not listed in the execution record — a non-throwing `stale_revision` rejection whose return value the D6 executor ignores. Workers Logs, queue-delivery records, or a readable coordinator transitions log would be needed to distinguish those cases.

4. **One correction to a possible reading of the execution record:** shipped code does contain a generic `POST /v2/reports` surface that can call `handleReport`. It is not an automatic recovery path and it is not operator-fenced. Its existence does not make the stall self-healing, and using it would be a production mutation requiring its own explicit authorization and Rowan review.

5. **One correction about the test harness:** the older warning that the DO harness returns `null` from `.one()` on an empty result is stale for this tree's main harness. `tests/helpers/do-harness.mjs:9-26` now implements production semantics: `.one()` throws on zero rows and on more than one row. New recovery code must nevertheless use absence-safe reads (`_oneOrNull` / `_all`) wherever absence is a legitimate precondition outcome, and its tests must run on a production-semantics harness rather than any local fake that returns `null`.

---

## 1. Established Phase A end state

The execution record and closing evidence establish the following state. These are record/evidence facts, not inferences from source.

| Surface | Closing state |
|---|---|
| Book | Forever Pucked, book ID `5c589095-f812-48a2-8ab2-03ba2791f2b2` |
| Chapter | `chapterIndex: 2` |
| Plan | `plan:e377a5559961b294154276b6`, state `active` |
| Plan totals | eligible 23, done 8, failed 0, blocked 0, prompts 0 |
| Chapter job | `plan:e377a5559961b294154276b6:ch2`, state `generating`, revision 2 |
| Job occurrences | 8 `ready`, 15 `pending`, 0 `granted` among the plan job's 23 |
| Grant | `grant:plan:e377a5559961b294154276b6:ch2:1:full`, state `issued`, revision 2 |
| Executions | exactly 8, all `committed` |
| Provider attempts | 44, all `confirmed`; 30 `success`, 14 `policy_block`; failed 0, unknown/open 0 |
| PT 2026-10-31 quota | dispatched 44, reserved 52, consumed 96 of 100 |
| Phase `forever-pucked` settled | 732,303 ledger units, after a Phase A delta of +152,964 |
| Estimated unverified | 19,018, unchanged |
| Reserved unverified | 5,648, unchanged |
| Unknown open | 0 |
| Phase remaining | 12,762,049 |
| Chapter eligibility after | eligible 15, bound already 11, parked 1 |
| Remaining quote | 15 segments, 20,864 chars, expected 294,137 units (≈ $0.294) |
| Eligibility digest after | `9453ab5dc7ee6ade7c650d14066054b965875f2ef1b65eb24bc633588d778e67` |
| Sync watermarks | bindings 1826 (1818 + 8), content 18 unchanged |
| Conflicts | exactly the same three known `schedule_dead` rows, ids 1, 2, 3 |
| Parked Chapter 3 job | untouched, `parked_policy`, revision 1 |
| Phase B | untouched; no chapter-exemption write |

Julie's later device/playback check independently matched the server state: the three pre-existing and eight Phase A segments were visible/playable; the other segments had no audio. Playback is therefore not the defect. The defect is plan/grant bookkeeping continuation.

---

## 2. The normal report path

### 2.1 Successes commit outside `handleReport`

The D6 executor's documented contract is explicit:

- `handleReport` is called once per message at the end;
- it carries only non-success results, plus an empty `results` array when successes were committed, specifically to close the grant;
- successes are committed separately through `store.commitVerified`;
- successes are not re-reported through `handleReport`;
- if an unknown-billing outcome occurs, the message stops and `handleReport` is not called at all.

Source: `generation/d6-executor.mjs:19-37`.

`commitVerified` runs in a coordinator transaction. It validates and binds, updates the occurrence cache key, applies `report_success` if the occurrence is still `granted`, and transitions the execution to `committed`. Re-committing an already committed execution is an idempotent no-op return. Source: `generation/genstore.mjs:250-290`.

Critically, `commitVerified` does **not**:

- change grant state;
- complete the claim;
- settle quota reservations;
- substitute for `handleReport`'s job-completion derivation.

That separation is the structural precondition for this stall: all content work can be durable while grant bookkeeping remains open.

### 2.2 D6 executor end-of-message report call

The executor claims the grant first. A `completed`, `closed`, or `unknown_grant` claim drops the message; another consumer's claim makes it stand down. Source: `generation/d6-executor.mjs:777-781`.

For each message occurrence, it re-reads the occurrence fresh and skips it unless its current state is exactly `granted`. Source: `generation/d6-executor.mjs:795-800`.

Fresh work accumulates non-success results in `reportResults`; committed successes increment `committedCount`. An unknown-billing stop returns without a report. Source: `generation/d6-executor.mjs:844-856`.

The sole D6 end-of-message report call is:

```js
await c.handleReport({
  grantId,
  jobRevision: view ? view.revision : undefined,
  results: reportResults
});
```

at `generation/d6-executor.mjs:859`, guarded by:

```js
if (reportResults.length > 0 || committedCount > 0)
```

at `generation/d6-executor.mjs:857`.

The executor does **not** inspect `handleReport`'s return value. That fact matters for the `stale_revision` candidate in §8.

For the original cohort-1 pass, the eight committed successes made `committedCount === 8`. The shipped code therefore should have attempted exactly one report with an empty `results` array. No durable effect of that report is present.

### 2.3 `handleReport` transaction and writes

Coordinator transactions are defined at `coordinator.mjs:384-392`. A nested transaction joins the outer transaction; the outer call uses `state.storage.transactionSync(fn)`. A throw inside the transaction rolls back that transaction's writes.

`handleReport` is at `coordinator.mjs:2057-2205`. Its sequence is:

1. Require a grant ID (`coordinator.mjs:2058`).
2. Await `this.wake()` before opening the transaction (`coordinator.mjs:2059`).
3. Inside `_tx`, load the grant with `_oneOrNull` (`coordinator.mjs:2060-2062`).
4. If the grant is already `reported`, return `{ ok: true, replayed: true }` before any stale-revision check (`coordinator.mjs:2063-2064`). This is the grant-level idempotency path.
5. If the grant is `handoff_uncertain`, record handoff resolution and mark the outbox row sent, because a report is proof the executor received the dispatch (`coordinator.mjs:2065-2072`).
6. Load the job; a missing job returns `job_not_found` (`coordinator.mjs:2074-2075`).
7. If `report.jobRevision` is defined and differs from the current job revision, log the rejection and return `{ ok: false, reason: "stale_revision" }`, with no grant or reservation change (`coordinator.mjs:2076-2079`).
8. Apply each result:
   - success: validate/bind, update cache key, apply `report_success`, or apply `report_unvalidated` if validation fails (`coordinator.mjs:2083-2102`);
   - policy block: apply `report_blocked` (`coordinator.mjs:2104-2107`);
   - daily limit: record a quota park, defer the occurrence, park the job, and close that grant's reservations with reason `quota_park` (`coordinator.mjs:2108-2125`);
   - rate limit: defer the occurrence and schedule `retry_grant` (`coordinator.mjs:2126-2131`);
   - other outcomes: apply `report_failed` (`coordinator.mjs:2132-2135`).
9. For any grant-ledger occurrence not mentioned in the report and still in state `granted`, defer it back to `pending` (`coordinator.mjs:2138-2155`).
10. Write the grant to `reported` and store the whole report object as `report_json` (`coordinator.mjs:2156-2157`).
11. Complete the claim (`coordinator.mjs:2158-2159`). `_completeClaim` updates a `claimed` claim to `completed`; its only caller is `handleReport`. Sources: `coordinator.mjs:2874-2879` and the tree-wide call search in §3.3.
12. Settle the grant's quota reservations through `settleReservationsForGrant` (`coordinator.mjs:2160-2167`). Note: generic `handleReport` does not inspect the settlement sweep's `blocked` list. In the exact Phase A state the fence should close all eight, but the generic path does not itself prove that precondition set.
13. Derive job completion (`coordinator.mjs:2168-2169`).
14. For a qualifying repair job only, create and grant a follow-on in the same transaction (`coordinator.mjs:2176-2200`). Phase A's job is not that repair-chain case.
15. Return `{ ok: true, ready, blocked, failed }` (`coordinator.mjs:2202`).
16. After the transaction, re-arm the alarm if needed (`coordinator.mjs:2204`).

For Phase A's eight already-committed successes, an empty-results report is semantically sufficient in principle:

- no success needs rebinding;
- no grant target remains `granted`, so the grant-close defer loop changes none of them;
- the grant becomes `reported`;
- the claim completes;
- reservation settlement runs;
- job-completion derivation runs and, because 15 occurrences remain open, does not complete the job.

`_deriveJobCompletion` counts ready/blocked/failed/open/unknown occurrences. If any are open and the job is not `outcome_unknown`, it returns the current job state rather than completing it. Source: `coordinator.mjs:2370-2386`. Only when no occurrences are open can it apply `report_complete`, `report_partial`, or `report_failed` (`coordinator.mjs:2387-2393`).

### 2.4 The generic `/v2/reports` surface is real, but it is not a self-healing path

A generic API branch exists:

```js
if (request.method === "POST" && path === "/v2/reports") {
  const report = await request.json();
  const coord = new GenerationCoordinator(coordinatorState, env);
  return json(200, await coord.handleReport(report));
}
```

Source: `api.mjs:152-155`.

It is reachable in the production D6 entry through the ordinary forward chain:

- the public handler does not list `/v2/reports` among the operator routes whose client-token check is skipped (`worker-entry-prod-d6.js:1430-1512`);
- it requires the production instance and then forwards the original request to the Durable Object (`worker-entry-prod-d6.js:1514-1516`, `worker-entry-prod-d6.js:1809`);
- the production coordinator class's non-D6-internal routes fall through to `super.fetch(request)` (`worker-entry-prod-d6.js:1350-1352`);
- the base coordinator fetch constructs the API and dispatches to it (`worker-entry.js:232-235`).

The important qualifications are:

- It requires the ordinary production client-token gate, not the migration-operator admission used by the operator-only D6 surfaces.
- `api.mjs:152-155` imposes no closed request shape, no exact grant/plan/job binding, no authorization reference, no precondition proof, and no operator-finalization audit.
- It returns HTTP 200 with `handleReport`'s result object, including a possible `{ ok: false, reason: "stale_revision" }`; a caller must inspect the body, not merely the HTTP status.
- Nothing schedules or constructs a call to it after a lost executor report.

Accordingly, the precise diagnosis is **not** “no shipped code can call `handleReport`.” It is: **no shipped automatic path calls it for this stalled grant, and the only shipped manual path is a broad client-token report surface rather than a fenced operator repair.**

The legacy non-D6 executor also has a report helper that refuses to call `handleReport` for an empty results array (`executor.mjs:63-67`). That is not the production D6 queue executor; the production `_execute` constructs `createD6Executor` (`worker-entry-prod-d6.js:1364-1374`).

---

## 3. Complete transition and settlement enumeration

### 3.1 Enumeration method

The enumeration was made by searching the entire shipped worker tree for:

- every `INSERT INTO grants`;
- every `UPDATE grants SET state`;
- every grant-state literal write;
- every caller of `handleReport`;
- every caller of `settleReservationsForGrant`, `closeReservationsForGrant`, `closeReservationsForVoidedGrant`, `closeReservationsForPlan`, and `closeReservation`;
- every direct insert/update/delete against `d6_grant_reservations` and `d6_provider_dispatches`.

The searches found no grant deletion path and no direct reservation-state update outside `closeReservation` in `generation/quota-budget.mjs`.

### 3.2 Every grant-state write

| Write | Source | Meaning / applicability |
|---|---|---|
| Insert grant as `issued` | `coordinator.mjs:1741-1743` | `_issueGrant` creation only |
| `handoff_uncertain` → `issued` | `coordinator.mjs:1905` | Late outbox acknowledgement in `drainOutbox` |
| Grant → `voided` | `coordinator.mjs:2003` | `_voidDispatch` |
| Grant → `reported` | `coordinator.mjs:2156` | **Only `handleReport`** |
| Grant → `handoff_uncertain` | `coordinator.mjs:2562-2567` | Lease handler for attempted-but-unacknowledged handoff |
| Grant → `voided` | `coordinator.mjs:2581` | Lease handler when no outbox row exists at all |
| `handoff_uncertain` → `issued` | `coordinator.mjs:2668` | `handoff_check`, accepted verdict |
| `handoff_uncertain` → `issued` | `coordinator.mjs:2697` | `handoff_check`, claim-precedence resolution of a contradictory not-accepted verdict |

Other grant updates are not state transitions:

- grant revision update at `coordinator.mjs:1770`;
- lease-expiry updates at `coordinator.mjs:1914` and `coordinator.mjs:2548`.

No shipped code writes a grant state of `superseded`, despite read-side checks for that state.

### 3.3 Every `handleReport` caller

The tree-wide caller search found:

- D6 executor: `generation/d6-executor.mjs:859`;
- generic API: `api.mjs:155`;
- legacy executor helper: `executor.mjs:66`.

Only the D6 executor is the production queue path for this grant. The generic API is manual/external. The legacy executor is not constructed by the production D6 `_execute` path.

### 3.4 `_voidDispatch` is not a lawful closure for this grant

`_voidDispatch` is documented for dispatches that **provably never left**. Source: `coordinator.mjs:1945-1950`.

Its ordinary claim fence is decisive: if a claim row is in state `claimed`, it logs `void_refused_claimed` and returns `false`, without releasing reservations or re-granting work. Source: `coordinator.mjs:1962-1976`.

Its state write and reservation closure are at `coordinator.mjs:2003-2010`: grant → `voided`, reservations closed with reason `grant_voided`.

Call sites found:

- drain-time void for a paused/cancelled/parked/superseded job: `coordinator.mjs:1856-1858`;
- revision-stale dispatch: `coordinator.mjs:1867-1869`;
- delivery-window-expired dispatch: `coordinator.mjs:1871-1873`;
- lease-expired, provably never-invoked dispatch: `coordinator.mjs:2574-2577`;
- `handoff_check` with terminal not-accepted evidence and no claim: `coordinator.mjs:2706-2708`;
- Batch never-accepted resolution with `claimedOk: true`: `coordinator.mjs:3040-3048`.

None fits Phase A:

- the dispatch did leave;
- the executor claimed it;
- 44 provider dispatches occurred;
- all eight executions committed;
- the Batch exception concerns a Batch submission proved never accepted, not a delivered Standard grant.

Calling this grant `voided`, or closing its reservations as `grant_voided`, would falsify the record.

### 3.5 Every quota-reservation settlement path

The allowed close reasons are exactly:

```js
["grant_settled", "quota_park", "halt_settled", "grant_voided"]
```

Source: `generation/quota-budget.mjs:102-107`.

`closeReservation` is the single state-changing release fence. It validates the reason, returns an already-closed no-op for a closed row, blocks closure while an execution for that grant/occurrence is `granted` or `attempted`, blocks unknown-billing executions for every reason except a properly fenced `halt_settled`, and otherwise performs the only reservation-state update:

```sql
UPDATE d6_grant_reservations
SET state = 'closed', close_reason = ?, updated_at = ?
WHERE reservation_id = ? AND state = 'open'
```

Sources: `generation/quota-budget.mjs:644-659` and `generation/quota-budget.mjs:662-692`.

The wrappers are:

- `settleReservationsForGrant` → `grant_settled`: `generation/quota-budget.mjs:708-711`;
- `closeReservationsForGrant` → caller-supplied reason: `generation/quota-budget.mjs:713-716`;
- `closeReservationsForVoidedGrant` → `grant_voided`: `generation/quota-budget.mjs:717-720`;
- `closeReservationsForPlan` → `halt_settled`: `generation/quota-budget.mjs:721-724`.

All production call sites found:

| Caller | Source | Reason |
|---|---|---|
| `handleReport`, daily-limit branch | `coordinator.mjs:2125` | `quota_park` |
| `handleReport`, normal grant closure | `coordinator.mjs:2167` | `grant_settled` |
| `_voidDispatch` | `coordinator.mjs:2010` | `grant_voided` |
| `retireHaltedPlan` | `generation/service.mjs:578` | `halt_settled` |

No other direct reservation-closing call site exists in the shipped worker tree.

---

## 4. Why the normal driver cannot issue cohort 2

The service driver's grant step reads the current job view, computes pending occurrences, and checks for a live grant:

```js
const liveGrant = v.grants.some(g => g.state === "issued");
if (!pending.length || liveGrant) return "ok";
```

Source: `generation/service.mjs:979-984`, especially `generation/service.mjs:983-984`.

Phase A has both:

- 15 pending occurrences; and
- one grant still `issued`.

The second condition alone makes the driver return without requesting a grant.

The driver also refuses to grant if a pending occurrence has a non-terminal execution record (`generation/service.mjs:985-991`). That is not the present blocker: the 15 have no execution records under this plan. The blocker is the issued grant.

Plan advancement/finishing is also unavailable. The driver finishes or advances only when the current job is terminal or has zero occurrences in `pending` or `granted`. Source: `generation/service.mjs:1011-1027`. Phase A has 15 pending, so that branch cannot fire.

### A necessary nuance about direct `requestGrant`

`requestGrant` itself does not contain the driver's `liveGrant` check; it calls `_issueGrant`. Sources: `coordinator.mjs:1803-1810` and `coordinator.mjs:1635-1697`.

Therefore the precise claim is not that every conceivable direct call is independently fenced by the old grant ID. In particular:

- the stalled grant ID embeds job revision 1;
- the job is now revision 2;
- a hypothetical direct `_issueGrant` call would construct a revision-2 grant ID, not collide with the revision-1 ID.

The shipped **automatic driver** is nevertheless blocked by `liveGrant`. The only other shipped caller of `requestGrant` found is the `retry_grant` schedule handler, and §6.4 proves no such row is created for a lost report. On PT 2026-10-31, a hypothetical direct request would also have been bounded to an empty cohort by the still-open reservations, as §7.5 shows.

---

## 5. Queue redelivery does not heal the lost report

### 5.1 Queue behavior

The production queue handler forwards each message to the DO internal execute route. If the HTTP response is not OK, it throws and the catch path calls `message.retry()` where available. If the response is OK, it calls `message.ack()`. Source: `worker-entry-prod-d6.js:1819-1840`.

The internal execute path constructs the D6 executor, awaits `executor.handleMessage(message)`, flushes the cache, and returns HTTP 200 if `handleMessage` returns normally. Source: `worker-entry-prod-d6.js:1355-1376`.

Consequences:

- If the original `handleReport` threw through `handleMessage`, queue redelivery would be expected.
- If `handleReport` returned a non-throwing rejection, the executor ignores it, `handleMessage` returns normally, `_execute` returns HTTP 200, and the queue can acknowledge the message with no redelivery.
- If the invocation died before returning, platform redelivery may occur, but the redelivered pass is still non-healing for the reason below.

### 5.2 Redelivered D6 pass, step by step

On a redelivery of the same grant message after cohort 1 committed:

1. `claimGrant` returns the existing claim for the same consumer (`already_claimed`), rather than a terminal drop. The claim rules are at `coordinator.mjs:2809-2835`; the D6 executor drops only `completed`, `closed`, or `unknown_grant`, and stands down only for another consumer's claim (`generation/d6-executor.mjs:777-781`).
2. Each of the eight occurrences is re-read.
3. Each is now `ready`, not `granted`, so each is skipped at `generation/d6-executor.mjs:795-800`.
4. No fresh work runs for them.
5. No non-success result is produced.
6. No new commit occurs in that pass.
7. `reportResults.length === 0` and `committedCount === 0`.
8. The report guard at `generation/d6-executor.mjs:857` is false.
9. `handleReport` is not called.
10. The handler returns normally, allowing the queue message to be acknowledged.

