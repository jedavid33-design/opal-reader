# GATE 4 PROPOSAL — Resume and complete Forever Pucked Chapter 3 (the plan's 15 remaining segments): bounded generation under separate re-arm and unpause sub-gates, ends HELD (for Rowan review)

**Status:** PROPOSAL ONLY — prepared by Wren, 2026-11-01. Nothing in this document is executed by its filing. No production mutation of any kind has been made in its preparation; every live figure below comes from read-only reads taken 2026-11-01 ~17:36–17:51Z.
**Review requested from:** Rowan (design/source reviewer, Opal Roundtable).
**Authorizing review for this drafting:** Rowan's Gate 3 retry EXECUTION REVIEW PASS, board comment **6561581179** (issue #15, `jedavid33-design/opal-roundtable`), which closed Gate 3 and charged Wren to "prepare a separate Gate 4 proposal for the 15 pending Chapter 3 segments, including fresh census, stop conditions, bounded generation/spend, and explicit independent re-arm and queue-unpause gates." That review authorizes NO Gate 4 execution, re-arm, unpause, generation, or spend. **Julie's new GO is required before any production action under this proposal.**
**Subject (exact):** plan `plan:e377a5559961b294154276b6`, job `plan:e377a5559961b294154276b6:ch2`, Forever Pucked (`5c589095-f812-48a2-8ab2-03ba2791f2b2`), chapterIndex 2, phase `forever-pucked` — its 15 remaining eligible occurrences (§2.3).
**Live build this proposal is written against:** `1c2d1d0fa7ebb769f68cfb327fb9fde7d4d30867` (range-fix build; verified live via `/health` at census-of-drafting time). **System HELD** at drafting: GENERATION_HALT `"1"`, queue `opalreader-generation-v2` `delivery_paused: true`.
**Record chain:** Gate 3 retry record pin `ea72cf9852d49c62336a492d070cfd128d5eccec` (repo `jedavid33-design/opal-reader`, branch `ui1-review`); Gate 3 retry proposal pin `0ead570fd9713ec72ec84fe59080a54919e3c8af`; range-fix deploy record pin `b986b562f1824fec2c15810ee4ef023d42a4362f`.

---

## 0. Why this gate exists, and the one discovery that shapes it

### 0.1 Where things stand

Phase A (Oct 31, 2026) generated and committed 8 of Chapter 3's 23 plan segments, then stalled permanently on shipped code: the cohort grant never closed, `driveOnce` refused every successor grant while one read `issued`, and 52 quota slots leaked as open reservations. Gate 2 built the operator grant finalizer; Gate 3 attempt 1 stopped at the preview (HTTP 500); the range-fix replaced all five production LIKE constructions with prefix range scans and deployed held (build `1c2d1d0f`); the Gate 3 retry then executed ALL PASS (Nov 1, 2026): the preview returned HTTP 200 `finalizable` on the fixed build, the finalizer applied exactly once — grant `reported`, claim `completed`, the 8 reservations closed `grant_settled`, derived PT 2026-10-31 totals 44/0/44 — phase accounting unchanged, exactly 1 mutation, ends HELD. Rowan's execution review PASS (6561581179) closed Gate 3. **Gate 4 is the resumption Rowan named next: generate the 15 segments that remain.**

### 0.2 The discovery: the plan is already self-driving — and has been cycling cohort grants, ledger-only, since the finalizer landed

Fresh reads taken for this proposal (2026-11-01, after Gate 3 closed) establish a fact no earlier document records, and Gate 4's design is built on it:

1. **No new submission is needed to resume.** `driveOnce` runs on the coordinator's watchdog alarm for every plan whose state is not terminal (`worker/generation/service.mjs:888`, plan selection at :931-933). Its grant step fires whenever the plan's current job has `pending` occurrences and no live (`issued`) grant (`service.mjs:980-984`) and calls `coord.requestGrant(jobId)`. The Gate 3 finalizer removed the one condition that had frozen this machinery — a permanently `issued` grant.
2. **The GENERATION_HALT fence does not block plan-bound grant issuance.** The halt refusal inside the grant guard applies only to *plan-less* jobs (`worker/generation/grant-guards.mjs:168-181`); for a plan-bound job the guard checks quarantine holds, the phase unknown-billing halt, and the phase budget — not the halt flag. What the halt actually fences is *delivery*: the production host wires `sendGrant` only when `GENERATION_HALT === "0"` (`worker/worker-entry-prod-d6.js:319-345` — "While halted there is NO queue delivery function: outbox rows stay visibly unsent").
3. **So, since ~17:39Z today, the machinery has been cycling:** `driveOnce` issues a bounded cohort grant for the job (8 occurrences — §3.3), the grant's outbox row is never invoked (no sender while halted), and when the grant's 15-minute lease expires (`worker/coordinator.mjs:134` `LEASE_MS`; grant row written at :1743-1744, lease scheduled at :1758), the lease path voids the provably-unsent dispatch (`lease_expired_undelivered`, `coordinator.mjs` lease branch), releases its reservations, returns the occurrences to `pending`, and re-advances the job — which re-grants a fresh cohort on a later pass.
4. **Observed directly, twice, ~13 minutes apart (2026-11-01):** at ~17:36Z the granted set was positions {68, 69, 73, 75, 80, 82, 83, 89} with 7 `pending`; at ~17:50Z the granted set had rotated to {70, 71, 78, 79, 84, 86, 87, 89} — 7 of the 8 previously-granted occurrences back to `pending` (position 89 granted at both reads), a fresh cohort granted in their place. At both reads: PT 2026-11-01 derived totals **dispatched 0 / reserved 96 / consumed 96** (96 = 8 × 12, §3.3), reconcile `ok: true`, `currentDayBlocked: false`, zero provider dispatches, zero spend. The churn is ledger-only, self-limiting, and reconcile-clean; it created **no** new conflicts rows (§4.4 reads still exact-match the baseline four) and moved **no** money (§2.4 exact at both reads).

Consequences for this gate, stated plainly:

- Gate 4 does **not** create, submit, or repair anything. Its production acts are exactly: lift the halt (wires the sender), unpause the queue (delivers what the sender sends), watch the machinery finish the plan, then return the system to HELD.
- Because a cohort grant may be live at any instant — in either phase of its cycle — the census (§4) asserts **invariants**, not a frozen granted-set, and the executor never needs to know which cohort is current: whichever grant is `issued` when delivery opens is the first delivered grant, and if its delivery window has already lapsed the drain voids it and re-grants fresh (`coordinator.mjs:1872-1876`). Both branches are designed machinery, not deviations.
- The exact current grant identity (`grant:plan:e377a5559961b294154276b6:ch2:<job revision>:full` — the id embeds the *job revision*, `coordinator.mjs` `_issueGrant`, so it changes every cycle) is a census-time read, never a proposal constant. **Open question Q1 (§10)** asks Rowan to rule on the census surface for it.

---

## 1. Scope

### 1.1 In scope — exactly this

Under one Julie GO (§10), the executor performs, in order:

1. **E0** — a fresh census (§4) under the executor STOP law (§7). Any mismatch stops the gate before any mutation.
2. **R1 (re-arm sub-gate)** — lift GENERATION_HALT to `"0"`, settings-only, exactly one settings mutation, after the reconcile precondition (§5.2).
3. **R2 (unpause sub-gate)** — unpause queue `opalreader-generation-v2`, exactly one queue mutation, as its own separate step, after R1's read-backs (§5.3). **The queue is unpaused LAST among the opening acts** — no opening act follows it.
4. **G** — monitored generation: the shipped machinery (and only it) grants, delivers, executes, reports, and settles successive cohorts until the plan completes (§5.4), inside the bounds of §5.5 (attempt cap, cost ceiling, PT-day rules).
5. **C (closing sub-gate)** — on completion: re-pause the queue, then re-halt (containment order), exactly two mutations, then the full read-back checklist (§6). **This proposal recommends the gate END HELD** (§5.6) — the system returned to the exact posture it was found in.

### 1.2 Explicitly out of scope / not authorized by this proposal

- **Phase B** — the chapter's final segment, occurrence `2a85f74f-353d-4c25-a86a-4a4db392868b` (position 91, 569 chars), which reads `excluded_parked` on the plan and belongs to the parked job's exemption path. Gate 4 never touches it, the parked job `1832c21fcf0425454227c4736048a8a632f422abca4a2685ddb775bb1681406a`, or any park-release/exemption route.
- **Batch** — arming or use of the batch lane in any form. The standard lane only, as stamped (`d6StandardOnly`).
- **Any other book, chapter, or plan** — including the rest of Forever Pucked beyond this chapter's plan. Any generation observed that is not this plan's is a STOP (§7).
- **Any code change, deploy, or client publication.** This gate changes no bytes of the worker; build `1c2d1d0f` throughout.
- **Any finalizer invocation.** If a successive grant fails to close, that is a STOP (§7), never a repair under this gate; a finalizer use would need its own gate, exactly as Gate 3 was.
- **Any SubmitJob, command, or intent of any kind.** The resume needs none (§0.2); submitting one is outside the GO.
- **Clearing, editing, or explaining away any conflicts row; any rollback; any second attempt.** One GO covers one attempt (§8).

---

## 2. Identity binding — the exact subject

### 2.1 Book / phase / chapter

| Field | Value |
|---|---|
| Book | Forever Pucked |
| bookId | `5c589095-f812-48a2-8ab2-03ba2791f2b2` |
| chapterId | `2060f9df-f017-4793-a5e1-9d131789d973` |
| chapterIndex | 2 (Chapter 3) |
| Phase | `forever-pucked` (registry-bound to this bookId; unbound phases fail closed) |
| Lane | `standard` (Batch unarmed: capabilities read `batch: {admitted: false, reason: batch_not_armed}`) |

### 2.2 Plan / job

| Field | Value (fresh read, 2026-11-01 ~17:36Z) |
|---|---|
| planId | `plan:e377a5559961b294154276b6` |
| jobId | `plan:e377a5559961b294154276b6:ch2` |
| Plan state | `active`, stopReason `null` |
| Plan totals | eligible 23 / **done 8** / failed 0 / blocked 0 / prompts 0 |
| Quarantine | `held: false, approvalRequired: false` |

### 2.3 The 15 remaining occurrences (structural identity only — no segment text anywhere in this document)

From the fresh plan read, the plan's 23 eligible entries split as: 3 `bound_already` (positions 65–67, pre-plan bindings), 8 `ready`/`committed` (the Phase A cohort: positions 72, 74, 76, 77, 81, 85, 88, 90), and the **15 below**, whose `occurrenceState` at read time was `granted` (8) or `pending` (7) — the §0.2 cycle rotates which; the *set* is invariant:

| Pos | occurrenceId | Chars | State at 17:36Z read |
|---|---|---|---|
| 68 | `81881ab7-fe99-4feb-98f6-bcbf7fc7e2a4` | 1,430 | granted |
| 69 | `72672ef5-8481-403b-ba97-f5c1dc0e4a77` | 1,321 | granted |
| 70 | `c731c8e7-4d18-4f59-bd73-f3c42a093063` | 1,343 | pending |
| 71 | `e651189e-9085-4590-ba4a-f0af18d24287` | 1,256 | pending |
| 73 | `94f6f847-7ded-470e-9a1d-577951c3a496` | 1,456 | granted |
| 75 | `962bc05c-666e-4967-aee2-d2bdd4283084` | 1,397 | granted |
| 78 | `e98450a5-2ee3-4ac7-bdcf-9226749b8000` | 1,371 | pending |
| 79 | `e51a7f03-eb79-4500-965f-f3f77efad254` | 1,215 | pending |
| 80 | `7fa865b8-ed32-4b8c-ae37-fd2d71cba0f6` | 1,471 | granted |
| 82 | `9150d43c-a37a-4bbf-af88-ec88d1669614` | 1,489 | granted |
| 83 | `635505ae-e0ff-4d38-8015-eb66357d3908` | 1,448 | granted |
| 84 | `b522918a-5973-4061-adaa-462460670e6a` | 1,493 | pending |
| 86 | `b8e75022-23a0-41f2-9297-47e71f255394` | 1,291 | pending |
| 87 | `f1aba4cc-ca84-42db-9b38-1104e01fd4e0` | 1,430 | pending |
| 89 | `712f42d8-5460-475a-a41a-fd3e6b57d00e` | 1,453 | granted |

**Total: 15 occurrences, 20,864 chars** — matching the fresh eligibility quote exactly (§2.5). At the ~17:50Z second read, the granted subset had rotated to positions {70, 71, 78, 79, 84, 86, 87, 89} (still 8 granted / 7 pending; position 89 granted at both reads); the set of 15, the totals, and every figure in §2.4–§2.5 were unchanged.

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
3. Script-settings observability enabled + persisted (a census read, exactly as at every prior gate).
4. Queue `opalreader-generation-v2` (`93b6a35fb8cf4788a91a2c90b748ae66`): `delivery_paused: true`, sole consumer unchanged. **HELD is the required starting posture** — a census that finds the system not held is a deviation and a STOP; the executor never silently re-holds as a "fix" and proceeds (containment re-holds, §5.7, are for mid-gate deviations and are themselves STOP actions).

### 4.2 Plan / quote / money (exact)

5. Plan `plan:e377a5559961b294154276b6`: state `active`, stopReason `null`, totals eligible 23 / done 8 / failed 0 / blocked 0 / prompts 0; quarantine not held.
6. The 15 remaining entries are exactly the §2.3 set (occurrenceId + position + charCount), each `occurrenceState` ∈ {`pending`, `granted`}; the 8 committed entries unchanged (`ready`/`committed`); positions 65–67 `bound_already`; position 91 `excluded_parked`.
7. Eligibility quote re-read at census: eligible 15 / 20,864 chars / expected 294,137 / digest exactly `9453ab5dc7ee6ade7c650d14066054b965875f2ef1b65eb24bc633588d778e67`.
8. Phase accounting exact on both surfaces (capabilities + plan diagnostics): settled 732,303 / estimatedUnverified 19,018 / reservedUnverified 5,648 / inFlightUpper 0 / unknownOpen 0 / remaining 12,762,049.
9. Parked job fingerprint exactly `b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282`, state `parked_policy`; zero exemption writes ever (no exemption journal entries for the chapter's final segment).

### 4.3 Quota (invariant — the cycle makes exact values phase-dependent)

10. Reconcile (full pagination): `ok: true`, drift empty, `censusComplete: true`, sole exception the known adjudicated straddler `att-37d63768-db4b-447d-8150-580b7c6ee257` (`estimated_unverified`, never dispositionable).
11. Historical PT days exact: 2026-10-29 = 57/0/57; 2026-10-30 = 79/0/79; 2026-10-31 = 44/0/44 (dispatched/reserved/consumed).
12. Current PT day (the census day): **dispatched exactly 0**; reserved ∈ {0, 96} depending on the cycle instant (a fresh cohort open, or the void instant between cohorts); consumed = dispatched + reserved accordingly; `currentDayBlocked: false`. A reserved value outside {0, 96}, or any dispatch at all, is a deviation and a STOP.
13. No grant for the plan's job in state `handoff_uncertain`, and no execution for the plan's job in state `unknown_billing` — by the best available read surface (see Q1, §10; the executor names the surface it used in the record).

### 4.4 Conflicts (exact match)

14. `GET /v2/conflicts` returns exactly the Gate 2D approved baseline four `schedule_dead` lease rows, field-for-field: id 1 @ 2026-10-29T23:54:14.808Z, `grant:plan:3183ecbf2ac4bf50bbc6166e:seg:1:full`; id 2 @ 2026-10-30T00:24:14.632Z, `grant:plan:603ab416bd67ab1b25de97be:ch1:1:full`; id 3 @ 2026-10-31T05:14:24.089Z, `grant:plan:b2dc2a3d1cd367a0245b9102:ch1:1:full`; id 4 @ 2026-11-01T01:04:30.364Z, `grant:plan:e377a5559961b294154276b6:ch2:1:full` — all cache_key `lease`, expected `7`, found `LIKE or GLOB pattern too complex: SQLITE_ERROR`. No fifth row; no changed field. (The §0.2 cycle has added none in ~an hour of cycling; a fifth row at census is a deviation and a STOP — its remedy is a new baseline + Rowan review, never an executor judgment call.)

### 4.5 Settings / lanes (exact)

15. Settings revision 1 (lane `standard`, monthly cap $50); capabilities read: standard admitted, **batch not armed** (`batch_not_armed`), generationState `halted`.
16. Bindings: sync watermarks content 18 / bindings 1826 (unchanged since Gate 3); the 8 Phase A bindings still read revision_key == cache_key.

---

## 5. Execution sequence (proposed — NOT executed by this filing)

### 5.1 Shape and mutation budget

| Step | Act | Mutations |
|---|---|---|
| E0 | Census (§4) | 0 (reads only) |
| R1 | Re-arm: halt lift, settings-only (§5.2) | exactly 1 (the GENERATION_HALT flip) |
| R2 | Queue unpause (§5.3) | exactly 1 (the queue PUT) |
| G | Monitored generation by the shipped machinery (§5.4) | 0 by the executor — generation itself performs provider attempts inside §5.5's bounds; this is the gate's purpose, counted and reported, never hidden |
| C | Closing: re-pause, then re-halt (§5.6) | exactly 2 |
| E4 | Read-backs (§6) | 0 |

Executor-initiated mutations total **exactly 4** (halt flip, unpause, re-pause, re-halt). Observability is re-checked after the settings mutation; the settings-only halt flip at gate (c) and Gate 2D provably did not disturb it, and if it were found disturbed the remedy is the conditional observability-only settings PATCH under the family's standing rule — counted and reported if used.

**Generate-button disclosure (for Julie's briefing, stated here so the record carries it):** from the R1 halt lift until the C closing re-halt, the system is live and **the app's Generate button is live with it**. The gate's subject is one plan that is already driving itself; any *other* generation Julie (or a stray tap) started in that window would consume the same 100/day provider cap and monthly cap, and would appear in monitoring as foreign attempts — a STOP (§7). Hands off Generate, for anything, until the gate closes.

### 5.2 R1 — re-arm sub-gate (its own decision point inside the single GO)

Precondition, hard: a **fresh full reconcile at R1 time reads `ok: true`** (the gate-(c) precondition, carried verbatim in strength) — the census reconcile (§4.3) does not substitute if time has passed; R1 re-reads it. Then, in the proven order of gate (c) and the Chapter 3 re-arm:

1. **Halt lift FIRST**: GENERATION_HALT `"1"` → `"0"`, settings-only mutation; read back the setting, the script etag (must be unchanged — the settings path does not touch code), observability (must still read enabled + persisted), and `/health` (build unchanged, generation now enabled).
2. No other act belongs to R1. In particular R1 does **not** unpause the queue: after R1 the sender is wired but the queue still holds everything — the system is armed-but-undelivered, the exact intermediate state the family's re-arms verified before unpausing.

Julie's GO covers R1 and R2 as **separately named sub-gates**: if R1's read-backs deviate in any particular, the gate STOPs *between* the sub-gates — R2 is never executed to "see if it helps," and containment (§5.7) returns the system to HELD.

### 5.3 R2 — queue-unpause sub-gate (last opening act)

1. Verify once more, immediately before: `/health` generation enabled on build `1c2d1d0f`; plan still `active` 23/8/0/0/0; reconcile still `ok: true`.
2. **Unpause LAST**: PUT the queue with `delivery_paused: false` (body carries `queue_name` + settings, per the cf-api law); read the queue back — `delivery_paused: false` is the only acceptable read-back.
3. From this instant, delivery is live: the current cohort grant's dispatch (or its void-and-regrant, §3.4) will reach the executor. Monitoring (§5.4) starts at the unpause, not after it.

### 5.4 G — monitored generation

- **Poll cadence:** plan read + quota/reconcile read every ~15 minutes (aligned to the watchdog/lease rhythm), plus a read at every observed plan-totals change the executor can catch. Each poll records figures only — plan totals, per-cohort grant settlements as visible through totals and derived day totals, dispatched/reserved/consumed, phase settled — **never segment text, never attempt payloads** (standing no-spoilers / technical-data law).
- **Expected progression:** plan done 8 → 23 in cohort steps (§3.3); each cohort's grant settles (`reported`) before the next issues; derived day consumption rises by dispatches and falls back at each settlement to dispatched-only.
- **PT-day rollover during G** is a named non-event (§3.3): monitoring notes the day change, the parked-on-quota interval if any, and continues. It is not a stall and triggers no act.
- **Duration honesty:** no completion time is promised. Phase A's cohort executed 8 segments in ~9 minutes of flow once delivered; the full 15 with settlement gaps and a possible rollover may take materially longer. The gate ends on completion criteria (§5.6), not on a clock — except that the stall STOP (§7) is clock-armed.

### 5.5 Bounds (hard)

- **Provider attempts:** ≤ 100 per PT day, enforced by the shipped quota guard itself (cohort bounding + reservation derivation + reconcile). The executor adds no attempts of its own — it issues no commands at all during G.
- **Cost ceiling:** cumulative recorded settled-cost delta attributable to this plan during G must remain **≤ 600,000 units (≈ $0.60)**. Crossing it is a STOP + containment (§7) — noting honestly that containment stops *further* spend; spend already settled is not clawed back (§8).
- **Phase fence (code):** the grant guard refuses any grant whose projection would breach the 13,500,000 phase budget (`grant-guards.mjs`); with §2.4's figures this fence is not expected to be approached.
- **Monthly fence (code):** settings cap $50 (the quota read's November ledger figure at drafting was 156,944 units — far from the cap under any composition; the cap itself is a settings value the census re-reads, §4.5).

### 5.6 Completion criteria and the closing sub-gate C — ends HELD (recommended)

Completion requires **all** of: plan state `complete` with totals 23/23/0/0/0 (§3.6); no grant for the job in `issued` or `handoff_uncertain`; fresh eligibility quote eligible 0 / digest recomputed over the completed set; reconcile `ok: true` with the gate's dispatches fully settled (no open reservations for the job's grants); phase settled delta within the §5.5 ceiling; conflicts still exactly the baseline four.

Then C, in containment order: **re-pause the queue** (PUT, read back `delivery_paused: true`), **then re-halt** (GENERATION_HALT `"0"` → `"1"`, settings-only, read back; etag and observability verified). **End state: HELD — halted + paused, exactly as found.**

Why HELD and not live-idle (the recommendation Rowan is asked to rule on, **Q3**): every gate in this family that was not itself a re-arm gate has ended held (Gate 2D deploy, range-fix deploy, Gate 3, Gate 3 retry); the two re-arm gates that ended live-idle (gate (c), Chapter 3 re-arm) did so because re-arming *was their entire purpose* and a generation gate followed immediately under its own GO. Gate 4's purpose is a bounded generation, after which the next pieces of work (Phase B, Batch) are separately gated and undecided — leaving the Generate button live in the interim would leave live a capability nobody has a current GO to use, against Julie's standing caution after gate (c) ("hands off it until a generation approval is in place" — Rowan's closing caution, adopted). Ending held costs nothing: any future gate re-arms under its own GO, in minutes, by the proven sequence.

### 5.7 Containment (pre-authorized, narrow — deviation response only)

On any §7 STOP after R1: **re-pause the queue first, then re-halt** (the family's proven containment order), read both back, and STOP. Containment is exactly two mutations, is the *only* executor act a deviation authorizes, and never licenses continuing the gate. A STOP before R1 needs no containment (nothing was opened) — the executor simply reports. A STOP during C: the closing steps already in progress are completed if safely possible (they *are* containment-shaped), then reported.

---

## 6. Readback checklist (E4 — all required, ends HELD)

After C, the executor reads back and the record reports, item by item:

1. `/health`: build `1c2d1d0f`, generation `halted`.
2. Settings: GENERATION_HALT `"1"`; etag unchanged from census; observability enabled + persisted.
3. Queue: `delivery_paused: true`.
4. Plan: state `complete`, totals 23/23/0/0/0, stopReason `null`.
5. Eligibility: eligible 0, bound_already 26, parked 1, expected 0 — digest recorded verbatim.
6. All 15 §2.3 occurrences `ready` with executions `committed`; bindings watermark advanced from 1826 by exactly the new bindings (expected 1841 for 15; the record states the actual), content watermark still 18.
7. Phase accounting: settled = 732,303 + (recorded generation delta, ≤ 600,000 per §5.5); estimatedUnverified 19,018 and reservedUnverified 5,648 unchanged; unknownOpen 0.
8. Reconcile: `ok: true`, drift empty, sole straddler exception; per-day derived totals recorded verbatim for every PT day the gate touched; no open reservations remain for the job's grants.
9. Conflicts: exactly the baseline four, field-for-field.
10. Parked job: fingerprint unchanged; position 91 still `excluded_parked`; zero exemption writes.
11. Capabilities: batch still not armed; generationState `halted`.
12. Mutation count for the whole gate: exactly the §5.1 budget (4 + generation's own recorded acts, enumerated), each listed.
13. **Julie's playback check (acceptance, outside the executor's verdict):** the app shows the chapter complete (header 27/27 for the chapter's bound set as the client presents it — 26 plan/bound + the Phase B segment still outstanding, so the honest expectation is the 15 newly-committed segments playable in place); Julie taps and plays a sample including a segment she knows was in the 15. Her verdict closes the gate; the executor's read-backs do not substitute for it.

---

## 7. Stop conditions — executor STOP law

**The STOP law, in effect verbatim:** if any census item, read-back, or monitored figure differs from this proposal's expectation — even by one item, even if it looks like harmless known bookkeeping — the executor STOPs before any further mutation (or, mid-gate, executes §5.7 containment and STOPs), preserves the state, reports the exact deviation and any proposed explanation *as separate things* to Julie and Rowan, and proceeds only on a fresh explicit GO or Rowan ruling for that deviation. An executor's own explanation never clears its own stop.

Named STOPs (non-exhaustive — the law above governs anything unnamed):

- **Census mismatch** of any §4 item, exact or invariant.
- **Reconcile not `ok: true`** at census, at R1, at R2, or at any G poll (drift non-empty beyond the known straddler exception).
- **THE PHASE A STALL SIGNATURE:** a delivered grant that has neither settled nor produced a new attempt across two consecutive polls spanning ≥ 35 minutes after its first dispatch. (Phase A's signature: 41 value-identical polls over ~31 minutes *after flow had stopped*, spanning the lease fuse and three watchdog cycles; the window here is set just beyond it — **Q4** asks Rowan to confirm.) On this STOP: containment, report — **never** a finalizer call, never a resubmission, never a repair under this gate.
- **Failed disposition outside the normal split path:** any of the 15 ending `failed`, any `policy_block_terminal`, any execution reaching `unknown_billing`, any grant entering `handoff_uncertain`. (Ordinary `policy_block` attempts that split and confirm are the normal path, §3.5 — not a STOP.)
- **Foreign generation:** any dispatch, attempt, or settled delta not attributable to this plan's job — including any other book/chapter/plan activity in the window (see the Generate-button disclosure, §5.1).
- **Conflicts change:** any fifth row or any changed field, at census or at any read-back.
- **Cost ceiling:** the plan's cumulative recorded settled delta reaching 600,000 units (§5.5) — STOP + containment at the poll that observes it.
- **Identity drift:** build, etag, bindings count, settings revision, or queue consumer changing at any read-back; the plan, job, or parked-job identity differing from §2 anywhere.
- **A stopped gate is never restarted on anyone's interpretation.** The GO is consumed by the attempt, stopped or completed (§8).

---

## 8. Containment, one-way nature, and rollback position

Generation is one-way in the only sense that matters: audio generated and spend settled during G cannot be un-generated or un-spent. The gate's protections are therefore all *forward* fences — census before opening, sub-gates in proven order, the quota guard's own arithmetic, the cost ceiling, the stall clock, containment on any deviation. There is **no rollback question in this gate**: no code changes, so nothing to roll back *to*; the closing sub-gate returns settings and queue to their census values, which is a posture restoration, not a rollback, and is not subject to the rollback-floor law (the floor, build `6a73d962…`, is untouched and uninvoked — build `1c2d1d0f` runs throughout). If the gate STOPs with the plan partially advanced (some cohorts committed, some segments pending), that partial state is **preserved and reported**, not compensated: committed segments stay committed (they are good audio Julie can already hear), pending segments stay pending, and any continuation is a fresh proposal on the new facts — never a resumption of this GO.

---

## 9. Honest evidence — what success proves, and what it does not

A successful Gate 4 proves: the shipped machinery — watchdog driving, cohort bounding, delivery, execution, report-close, settlement — completed a real 15-segment plan end-to-end on the range-fix build, inside the quota and phase fences, at a recorded ledger cost at or under the ceiling. That is the first full normal-path generation cycle since the finalizer was built, and it retires the Phase A stall *empirically* for this plan's shape.

It does **not** prove: why Phase A's `handleReport` failed to close its grant (the micro-cause was never established — `stale_revision`-swallow remains a candidate, not a finding; Option B hardening was never built, and a recurrence is handled by §7's STOP, not by any fix claimed here); that the LIKE-family defect's mechanism is understood (H1 remains SUPPORTED, NOT proven — the range-fix removed the constructions, and Gate 3's 200 proves the derivation completes on the fixed build, nothing more); that generation is safe for arbitrary books, sizes, or the batch lane (untested here, separately gated); or anything about Phase B's segment, whose voice/exemption path has never run. Ledger costs are Reader-recorded figures, not provider-confirmed spend (§3.5).

---

## 10. Authorization boundaries and open questions

**Boundaries.** This filing authorizes nothing. Execution requires, in order: (1) Rowan's review of this proposal; (2) **Julie's fresh GO** for exactly this gate — one GO, one attempt, covering E0 → R1 → R2 → G → C → E4 as specified and nothing else. The GO is recorded on the board before E0. Rowan's review PASS, like every review in this family, is documentary and authorizes no production act by itself. No wake email accompanies this filing (suspended by Julie, Oct 26, 2026).

**Open questions for Rowan** (flagged, not guessed):

- **Q1 — census surface for the live grant.** The plan read exposes occurrence states but no grant object; Gate 3 verified its named grant through the finalizer preview surface. For Gate 4's census item §4.3.13 (no `handoff_uncertain` grant; live-grant identity/state), is a read-only finalizer-preview call against the *current* live grant (identified by its revision-embedded id at census instant) an acceptable census read under this gate — or should the census rest on the occurrence-state + reservation-derivation inference used in §0.2, with the grant's state named as inferred? Wren's drafting used inference only and called no preview.
- **Q2 — churn-tolerant census.** §4 writes the quota/grant items as invariants ({0, 96} reserved; dispatched exactly 0) rather than exact values, because the halt-era cycle (§0.2) makes the instantaneous value phase-dependent. Confirm this is the right strength — or specify the tighter form Rowan wants (e.g., two census reads a full lease cycle apart, both required to satisfy the invariant with *different* granted sets, proving the cycle rather than a frozen accident).
- **Q3 — end state.** §5.6 recommends ending HELD (re-pause + re-halt as closing steps), against the live-idle endings of the two pure re-arm gates, for the reasons given. Rowan's ruling requested.
- **Q4 — stall window.** §7 arms the stall STOP at two value-identical polls spanning ≥ 35 minutes post-first-dispatch, set just beyond Phase A's observed ~31-minute signature. Confirm or reset.
- **Q5 — cost ceiling.** §5.5 proposes 600,000 units (≈ 2.04× the quote; 4.7% of remaining headroom). Confirm or reset.
- **Q6 — cohort-boundary bookkeeping.** If completion crosses a PT-day rollover mid-plan, the record will show two days' derived totals; nothing in §6 requires the days to be equal in shape. Confirm no additional read-back is wanted for the rollover case.

**Turn: Rowan's** — review of this Gate 4 proposal. Nothing is pending from Julie until Rowan posts; no production act of any kind is authorized in the interim.

---

### Evidence index (repo `jedavid33-design/opal-reader`, branch `ui1-review`, unless noted)

- Gate 3 retry execution record — pin `ea72cf9852d49c62336a492d070cfd128d5eccec`, `review/ch3-generation/recovery/gate3/GATE3-RETRY-RECORD.md`; filed on issue #15 as comment 6561547524 (Handoff RT-H-20261101-b55896).
- Rowan Gate 3 retry execution review PASS — board comment 6561581179 (issue #15, `jedavid33-design/opal-roundtable`).
- Gate 3 retry proposal — pin `0ead570fd9713ec72ec84fe59080a54919e3c8af`, `review/ch3-generation/recovery/gate3/GATE3-RETRY-PROPOSAL.md`.
- Range-fix deploy record (operative 31-part manifest) — pin `b986b562f1824fec2c15810ee4ef023d42a4362f`, `review/ch3-generation/recovery/gate3/diagnosis/range-fix/DEPLOY-RECORD.md`.
- Phase A execution record (cohort-1 rates, stall signature) — pin `f865a002…`, filed 6551215366.
- Live reads for this proposal (2026-11-01 ~17:36–17:51Z, Wren, read-only): `/v2/d6-eligibility` (chapter quote, §2.5), `/v2/d6-plans/plan:e377a5559961b294154276b6` ×2 (§2.2, §2.3, §0.2 rotation), `/v2/quota`, `/v2/d6-quota-reconcile`, `/v2/conflicts`, `/v2/generation/capabilities`, `/v2/d6-diagnostics?planId=…`, `/health`, cf-api queue + script `/settings` reads (§4 values).
- Source citations: range-fix build tree, `worker/generation/service.mjs`, `worker/generation/quota-budget.mjs`, `worker/generation/gen-constants.mjs`, `worker/generation/grant-guards.mjs`, `worker/generation/policy-split.mjs`, `worker/generation/d6-executor.mjs`, `worker/coordinator.mjs`, `worker/worker-entry-prod-d6.js` — file:line as cited inline.
