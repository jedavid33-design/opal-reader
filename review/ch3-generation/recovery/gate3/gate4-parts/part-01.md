### 2.4 Money — where it stands, and the bounds §5.5 derives from it

Phase accounting, fresh capabilities read (2026-11-01 ~17:49Z), **unchanged from the Gate 3 close**:

| Field | Value |
|---|---|
| Budget (`PHASE_BUDGET_MICRO_CENTS["forever-pucked"]`) | 13,500,000 |
| settled | 732,303 |
| estimatedUnverified | 19,018 |
| reservedUnverified | 5,648 |
| inFlightUpper | 0 |
| unknownOpen | 0 |
| **remaining** | **12,762,049** |

(Ledger units behave as micro-dollars despite the `MicroCents` name — $1 ≈ 1,000,000 units. The straddler's 5,648 reservedUnverified is unaffected by this gate, exactly as at Gate 3.)

### 2.5 The fresh quote (refreshed for this proposal, 2026-11-01 ~17:47Z)

`GET /v2/d6-eligibility?bookId=5c589095-f812-48a2-8ab2-03ba2791f2b2&scope=chapter&chapterIndex=2`:

| Field | Value |
|---|---|
| eligibleCount | **15** |
| totalChars | **20,864** |
| expectedCostMicroCents | **294,137** (≈ $0.294) |
| exclusions | bound_already 11 / voice_prompt 0 / parked 1 / other 0 |
| digest | `9453ab5dc7ee6ade7c650d14066054b965875f2ef1b65eb24bc633588d778e67` |
| advisory | true |

The quote is **byte-identical to the Oct 31 Phase A close quote** (same digest) — expected: the underlying set has not changed; what changed is that the blocker in front of it is gone. The model behind it: `expectedCostMicro(chars) = round(chars / 15.96 × 225)` (`worker/generation/gen-constants.mjs:80-81`); the per-attempt upper bound is `round(chars / 10 × 225)` (:87-88) and the per-occurrence guard projection is 12 × that (:94-95).

### 2.6 Parked job — untouched by design

Job `1832c21fcf0425454227c4736048a8a632f422abca4a2685ddb775bb1681406a` remains `parked_policy` rev 1, fingerprint `b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282`. Its release (releaseId 1) covers only the plan's definition set; its remaining member is the Phase B segment (§1.2). Gate 4 reads it in census (§4) only to prove it did not move.

---

## 3. The resume mechanism — code-grounded, from the deployed tree

All citations are to the range-fix build tree (`~/workspace/ch2-program/ch3-recovery/range-fix-build/worker-build/worker/`), the tree build `1c2d1d0f` was assembled from.

### 3.1 Who drives, and when

The coordinator Durable Object's alarm runs the watchdog cycle; each cycle calls `driveOnce` (`generation/service.mjs:888`). `driveOnce` selects every plan whose state is NOT IN (`complete`, `partial`, `retired`, `halted_unknown`) (`service.mjs:931-933`) — this plan reads `active`, so it is selected on every cycle, now and after re-arm. Before any grant step it skips quarantined plans (this plan: not held, §2.2), plans whose phase is unknown-billing-halted (the forever-pucked phase is not — the sole straddler is adjudicated `estimated_unverified`, not open-unknown), and plans failing the storage projection (the plan passed it in Phase A and nothing material has changed; census re-verifies the plan is still `active`, not `parked_storage`).

### 3.2 The grant step

For the plan's current (last) job, the grant step (`service.mjs:977-1010`): computes `pending` = the job's occurrences in state `pending`; if none, or if any grant for the job reads `issued` (a *live* grant), it does nothing. It also refuses to move while any pending occurrence has a non-terminal execution record. Otherwise it calls `coord.requestGrant(jobId)` (`coordinator.mjs:1805`), which issues the grant through `_issueGrant` under the grant guard (`generation/grant-guards.mjs` — quarantine strict-read, phase halt, phase-budget projection, quota). **No SubmitJob, command, intent, or operator call participates.** After Gate 4, the only thing that changes is what happens to the grant *after* issuance.

### 3.3 Cohort bounding — the 100/day cap arithmetic

Constants: `SEGMENT_ATTEMPT_BUDGET = 12` (`generation/gen-constants.mjs:16`); `PROVIDER_ATTEMPT_DAILY_LIMIT = 100` (:36 — an app-selected Reader policy cap, honestly labeled as such in the quota read, not a verified provider limit). `boundGrantTargets` (`generation/quota-budget.mjs:622-645`) takes the longest **prefix** of the job's pending occurrences — in the pending query's own order, never skipping an unfundable occurrence — whose worst-case slots fit the day's remaining derived headroom, where each occurrence costs `12 − attempts already used` slots and the day's consumption is derived as `dispatched + Σ(slots_total − slots_consumed) over open reservations` (`derivedDayTotals`, `quota-budget.mjs:192-202`). Every granted occurrence is reserved at its full remaining worst case inside the grant transaction. An empty cohort refuses with the quota reasons and the plan parks on quota — never a zero-target grant, never a spin.

Worked expectations for this plan (all 15 fresh, 0 attempts used → 12 slots each):

- **First delivered cohort: 8** (8 × 12 = 96 ≤ 100; a 9th would need 108). This is exactly the cohort size Phase A ran, and exactly the 96 reserved the §0.2 cycle keeps re-reserving today.
- After a cohort settles, its unused reservation slots are released (reservations close at settlement; derived consumption falls to *dispatched only* — Phase A's cohort produced 44 dispatches, so post-settlement consumption read 44, headroom 56).
- **Successive cohorts are therefore sized by what is actually left**: at headroom 56 the next prefix is 4 (4 × 12 = 48 ≤ 56; 5 × 12 = 60 > 56); and so on. The sequence is arithmetic, not a promise — realized attempts per segment vary (Phase A: 4–6 per committed segment, including policy splits), so the exact cohort sequence cannot be stated in advance and the proposal does not pretend otherwise (the Gate 2 fixture lesson). What *can* be stated: each cohort is ≥ 1 while headroom ≥ 12 and pending remain; a cohort never exceeds the day's headroom; the plan completes when the prefix machinery has walked all 15.
- **PT-day boundary:** the quota day is the Pacific day (rolls 07:00Z). If the day's headroom falls below 12 with segments still pending, the cohort is empty, the plan parks on quota, and continuation waits for the rollover — after which the remaining set is re-evaluated whole, in order, against the new day ("on quota rollover the remaining set is re-evaluated whole," `quota-budget.mjs:604-608`). **A rollover is a normal continuation, not a failure and not a stall**; reservations are day-attributed by construction (`day_key` on every reservation row), and no operator act is needed or permitted to hurry it. Realistically (§3.5's attempt rates), completion is expected within one PT day, but the gate is written to span two without any step changing.

### 3.4 Delivery, execution, and how each grant closes in the normal path

Once R1 wires the sender and R2 unpauses the queue: `driveOnce`'s tail calls `coord.drainOutbox(env.sendGrant)` (`service.mjs:1032-1034`); the drain sends the live grant's unsent outbox row to the queue under the delivery fence — the grant must be `issued`, at the job's current revision, inside its delivery window; an expired or revision-stale dispatch is voided with reservations released and the work re-grants fresh (`coordinator.mjs:1855-1876`). The queue consumer runs the D6 executor over the grant's occurrences; the executor calls `coord.handleReport({grantId, grantRevision, results})` **once per grant message, at the end** (`generation/d6-executor.mjs:859`, contract comment at :24). The report settles the grant's attempts, the grant leaves `issued` (normal terminal state `reported`), the settlement sweep closes its reservations (only through `closeReservation`, only with vocabulary reasons, dispatch-capable executions block closure — `quota-budget.mjs:655-672`), and the next `driveOnce` pass — finding pending occurrences and no live grant — issues the next cohort. **The Phase A stall signature was precisely this close failing to happen** (§7 names it as a STOP).

### 3.5 What the 15 will encounter: POLICY_BLOCK splitting and the honest cost envelope

Feature law (F3): on a provider `POLICY_BLOCK`, the segment's text is split and the parts retried recursively, **without voice substitution**, original text preserved across splits, floor 50 chars, **≤ 12 attempted calls per segment across the split tree + retries** (`generation/policy-split.mjs:1-14`) — the same 12 the quota budget reserves per occurrence, so the worst case the quota guard reserves for is the worst case the splitter can spend. A part that cannot be resolved within the ceilings is terminal `policy_block_terminal` (`policy-split.mjs:20-26`) — a failed disposition for that segment, and a STOP under §7 (it is not the normal path; Phase A produced none).

Phase A cohort-1 experience on this very chapter: 44 attempts across 8 segments — 30 `success`, 14 `policy_block` (all confirmed, 0 failed) — recorded cost delta **+152,964** (≈ $0.1530). Rates: ≈ 5.5 attempts and ≈ 19,121 units per segment, all-in with splits.

For the 15, honestly bounded:

- **Expected (quote model): 294,137 units (≈ $0.294)** for 20,864 chars (§2.5). At Phase A's realized per-segment rate the figure would be ≈ 286,800 — the two models agree closely.
- **Attempt envelope:** worst case 15 × 12 = 180 attempts, but the 100/day cap binds first on any single PT day (§3.3); expected ≈ 82 attempts at Phase A rates.
- **Cost ceiling (proposed, §5.5): STOP at a recorded settled-cost delta of 600,000 units (≈ $0.60)** — ≈ 2.04× the quote expectation, and 4.7% of the remaining phase headroom (12,762,049). Even if the ceiling were reached, phase remaining afterward would be ≥ 12,162,049 and the phase guard's own projection fence (settled + reservedUnverified + inFlightUpper + pendingUpper ≤ 13,500,000, `grant-guards.mjs` §6.2 path) stands beneath the executor's ceiling as the code-enforced backstop. **Open question Q5 (§10)** asks Rowan to confirm the ceiling.
- **Money truth rule (unchanged family law):** ledger figures are Reader-recorded costs, not provider-confirmed spend; Google's retroactive detail is day-level only. The gate reports ledger deltas as ledger deltas.

### 3.6 Observable completion

The plan is complete when `finishPlan` (`service.mjs:870-887`) finds every eligible entry's occurrence `ready` or its execution `committed` and sets the plan state `complete`. Observable surface: plan totals **23 / done 23 / failed 0**, plan state `complete`; a fresh eligibility quote for the chapter reads **eligible 0** (bound_already 26, parked 1); every grant for the job in a terminal state (none `issued`); reconcile `ok: true`; phase accounting settled increased by exactly the recorded generation delta (and nothing else moved). Julie's playback check (§6) is the acceptance step — hers, outside the executor's verdict.

---

## 4. Census specification — E0, fresh, complete, hard precondition

The census runs **before any mutation**, in one sitting, under the executor STOP law (§7): **any item that does not match its expectation stops the gate; the executor reports the deviation verbatim, separately from any proposed explanation, and proceeds only on a fresh explicit GO or Rowan ruling for that deviation. The executor's own tracing never clears its own stop; there are no executor-cleared exemptions, for any item, in any number.**

Because of the §0.2 cycle, census items are of two kinds: **exact** (must match to the value) and **invariant** (must hold, with the cycle-dependent value named as a range). Both kinds are hard preconditions.

### 4.1 Production identity, build, and HELD state (exact)

1. `/health` reports build exactly `1c2d1d0fa7ebb769f68cfb327fb9fde7d4d30867`, generation `halted`, coordinator `armed`.
2. Live script parts byte-identical to the range-fix operative manifest (31/31; the deploy record's manifest, pin `b986b562`), metadata unchanged (10 bindings, GENERATION_HALT `"1"` read at `/settings`).
