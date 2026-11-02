# Phase B — R5a Design / Specification / Gate Proposal (DESIGN REVIEW ONLY)

**Status: DESIGN REVIEW ONLY. This document authorizes nothing.** Execution would require (1) Rowan's approval of this design, (2) a built, tested, pinned candidate package, and (3) Julie's separate explicit GO naming that pin, under the gate skeleton in §9. No production code change, deploy, command, report, alarm stimulus, halt change, queue change, or generation is authorized by this document.
**Production mutations performed for this document: NONE.**
**Basis date: 2026-11-02.** Prepared by Wren under Rowan's ruling on the alarm-semantics assessment (verdict: **DOCUMENTARY ACCEPTANCE WITH REQUIRED CORRECTIONS**; opal-roundtable issue #15, comment 6583967424), item 5: **SELECT R5a for DESIGN REVIEW ONLY** — analyze repeated overdue re-arming, idempotency, schedule churn, test coverage, and an independently gated stopping/containment procedure. R5b remains a fallback (§11).

---

## 1. Scope and non-authorization

R5a is the code-assisted recovery option from the amended alarm-semantics assessment (`PHASEB-ALARM-SEMANTICS-ASSESSMENT-AMENDED.md`): a **one-condition change** to the coordinator's conditional alarm-arming function so that a **past-due armed value is treated as unarmed** and the alarm is re-registered at the earliest pending due time. It is the only recovery mechanism that pays off in all three assessment branches (B1 D = A, B2 D < A, B3 D > A), because `setAlarm` overwrites the platform registration whatever state it is in.

In scope for this document: the exact change (§2), its repeated-firing behavior (§3), idempotency (§4), schedule churn (§5), a test-coverage plan (§6), the stopping/containment analysis Rowan required (§7), sequencing against R2 (§8), a gate skeleton for a future execution (§9), and unverified items and open questions (§10).

Out of scope: building the candidate (no code is written by this document), any deploy, any stimulus, any generation. The Phase B step-0 procedural-variance requirement is **preserved** for any later generation gate (ruling item 7); nothing here touches it. Production remains INVESTIGATION HELD: GENERATION_HALT "1", queue `opalreader-generation-v2` delivery paused, plan `plan:19cad189fab54b9c804a74a6` and the idx-26 exemption preserved.

## 2. The change, precisely

### 2.1 Current condition (verified firsthand, deployed source)

From the live instrumented build's tree (`p2-gate-execution/build/deploy-tree/v2/coordinator.mjs`, 276,256 B, SHA-256 `bca88fe92bfd316c727866f7f69817e290fc8167006d32362577010c2037e20a`; this part is byte-identical to the pre-instrumentation basis in `phaseb-attempt3/evidence/parts-e0/` — diff 0 lines — because the P2 instrumentation touched only the entry and service parts), lines 2480–2488:

```js
  async _armAlarmIfEarlier() {
    const armed = await this.state.storage.getAlarm();
    const next = this._one(
      `SELECT MIN(due_at) AS due FROM schedule WHERE state = 'pending'`);
    const due = next && next.due !== null ? next.due : this._now() + WATCHDOG_PERIOD_MS;
    if (armed === null || armed === undefined || due < armed)
      await this.state.storage.setAlarm(due);
  }
```

The current guard fires `setAlarm(due)` only when **nothing is armed** or the earliest pending due time is **strictly earlier** than the armed value. A past-due armed value (our A = 1793562576104) with D = A therefore never re-registers — the attempt-3 stall arithmetic (assessment §5, branch B1, the leading explanation).

### 2.2 The R5a condition

One condition changes; nothing else in the function changes:

```js
    const now = this._now();
    if (armed === null || armed === undefined || armed <= now || due < armed)
      await this.state.storage.setAlarm(due);
```

That is: `setAlarm(due)` when `armed == null || armed <= now || due < armed` (with the source's explicit null/undefined pair retained, and `now` bound once from the coordinator's existing `this._now()` clock — the same clock the rest of the schedule machinery uses; no new clock seam is introduced). The added disjunct is `armed <= now`: **an armed value at or in the past is treated as unarmed**, and the registration is overwritten with `due`, computed exactly as today.

### 2.3 Which paths gain the new behavior

- `_armAlarmIfEarlier()` has exactly six call sites, all in `coordinator.mjs`: via `wake()` at `handleCommand` (:521), `requestGrant` (:1806), `handleReport` (:2064); and directly post-apply at :523, :1809, :2219. **All six gain the past-due branch.** In practice: any fresh (non-replay) valid command, any report carrying a `grantId`, and any internal `requestGrant` (executor/plan advancer, and the `retry_grant` schedule handler at :2636) becomes a potential re-registration event while a past-due armed value persists.
- The base alarm's `finally` calls the **unconditional** `_armAlarm()` (:2458–2463, called at :2520) — **unchanged**; it already overwrites unconditionally from inside a pass.
- `wake()`'s watchdog insertion (:2469–2474) — unchanged. `driveOnce` (`generation/service.mjs:1008` in the instrumented tree) — unchanged. Reads and operator routes — unchanged; the `drive=1` diagnostics read still performs no wake and no arming, exactly as its in-source header states.
- The P2 instrumentation recorder (entry part) — **stays, untouched**. A 5a-triggered revival is precisely what the recorder exists to observe.

### 2.4 Footprint and estimate method

The candidate, when built under a future gate, is assembled from the **current live build's tree** (build `86ad06ab…`, the instrumented 31-part tree) — **not** from `parts-e0` alone. (For this one part the distinction is provably moot — `coordinator.mjs` is byte-identical between the two bases — but the build basis is the live tree, per standing practice.) Estimate method, to be measured exactly at build time by `diff -u` against that tree and asserted in the gate's T0: **one part differs by the condition change** — expected +2/−1 lines in `coordinator.mjs` (one added `const now` line, one modified condition line) — plus, per the standing build-stamp convention observed in the P2 gate, the deployed tree additionally stamps `build-identity.mjs` with the gate's build pin, so **2 parts differ from the pre-gate live tree at deploy time** (candidate + stamp) and 29 are byte-identical. No other part changes. These are estimates by stated method, not measured figures; the gate's T0 must produce the measured diff and STOP on any excess.

## 3. Repeated overdue re-arming (ruling item 5)

Question: if the re-armed alarm *also* fails to deliver, what happens on each subsequent wake? Is it bounded? Can the alarm time move later than D?

**Per-wake behavior.** While the armed value remains past-due, *every* wake evaluates the new disjunct as true and calls `setAlarm(due)`. A single command/report path evaluates `_armAlarmIfEarlier()` **twice** (pre- and post-apply, §2.3): the first call sets `armed := due` (a past value in branches B1/B3-past), so the second call reads a still-past armed value and **fires again** — up to **2 identical `setAlarm(due)` writes per wake event** under persistent non-delivery. There is no counter, backoff, or suppression in the proposed condition.

**What bounds it.** The churn is **proportional to wake traffic, never self-generating**: `setAlarm` produces no wake; wakes arrive only from external commands/reports and internal `requestGrant` calls. With no traffic, a 5a build sitting on an undeliverable registration does exactly nothing more than today's build — it does not spin on its own. The moment delivery *does* work, the behavior self-terminates: a delivered pass ends in the base alarm's `finally`, which calls the unconditional `_armAlarm()` and leaves the armed value at a **future** due time, after which `armed <= now` is false and ordinary wakes go back to today's arithmetic.

**Can the armed time move later than D? No — with one disclosed sub-case.** The value written is always `due` = the minimum pending `due_at` (or `now + WATCHDOG_PERIOD_MS` when no row is pending). 5a never writes a value later than `due`, and never later than what a delivered pass's own `finally` would write. The disclosed sub-case: in the B3-future shape (the stale armed value A is past, but the earliest pending row D is **later than A and in the future**), today's code leaves A untouched, while 5a writes `setAlarm(D)` — moving the *registration* later than the stale A. That is not a delay of any real work: A is a dead timestamp pointing at no live row, and D is the true earliest pending work — the same value `_armAlarm()` would set. It is disclosed here because "5a can move the alarm later" is literally true in this sub-case and Rowan should rule on it with eyes open.

**Empty-schedule sub-case.** On a post-apply direct call with **no pending rows**, `due` computes to `now + WATCHDOG_PERIOD_MS`; if the armed value is past-due, 5a writes that registration where today writes nothing. When it fires, the base alarm's `finally` creates the watchdog row and re-arms — the chain restarts from an empty schedule. Bounded, and arguably the function's documented intent ("if the chain is unarmed… re-arm it", `wake()` comment), but it is a real behavior change in an edge case and is covered by test T5b (§6).

**Interaction with the watchdog's unconditional re-arm.** If a pass runs, the `finally` re-arm dominates: it is unconditional and sets the same `due` computation. 5a's branch becomes irrelevant for as long as the chain is healthy. 5a matters only in the gap where passes are *not* running but wakes *are* arriving.

## 4. Idempotency

**Repeated wakes, same stale value.** `setAlarm` has overwrite semantics on a single per-DO alarm (assessment §3.1, D1): repeated `setAlarm(due)` calls with the same `due` converge to exactly one registration with that value. No duplicates, no accumulation in the platform registration itself. Application state is likewise untouched by the arming call — `_armAlarmIfEarlier()` writes no schedule rows, no transitions, nothing but the alarm registration.

**Delivery works, handler throws.** A `setAlarm` to a past time schedules asynchronous execution in the immediate future (assessment §3.1, D2). If the handler is invoked and throws, the platform retries up to 6 times with backoff (D1), each retry running the handler from the beginning. Two 5a-relevant interplays:

1. **Where a throw can land.** Inside `coordinator.alarm()`, the row-processing body is wrapped so the `finally` — including the unconditional `_armAlarm()` — runs even when rows throw. A throw *after* the base alarm (in `recover()` or `driveOnce()`, in the subclass sequence) likewise leaves the base re-arm already done. So a **delivered** pass leaves a future armed value in essentially every throw position, and the 5a branch goes quiet. The recorder's record-then-rethrow preserves the platform retry semantics unchanged.
2. **A wake landing in a retry gap.** Between a failure and its retry, `getAlarm()` reports the failed (past) time as still set (D2 semantics, assessment Q1 case 2). A wake in that gap under 5a calls `setAlarm(due)` — and retries apply "only to the most recent `setAlarm()` call" (D1), so the wake's fresh registration **supersedes the pending retry schedule** with an immediate-execution registration. Net effect: the pass runs sooner, possibly one extra time relative to the pure-retry path. Bounded by wake traffic; each execution is a normal pass with the per-pass write set (amended assessment §6.1). This is a real semantic interaction, disclosed for Rowan's ruling — it does not create a loop, because executions do not generate wakes.

**Loop bounds, stated flatly.** There is no code path in which an alarm pass, a `setAlarm`, or a recorder write generates a command/report/`requestGrant`. All 5a re-firing is driven by external wake traffic or by platform retries (≤ 6 per registration). Worst case is therefore **churn proportional to traffic**, never an autonomous spin.

## 5. Schedule churn

**What 5a does not touch.** The `due` computation (same `MIN(due_at)` query over pending rows), all schedule-row writes, the watchdog insertion rule, and row processing are byte-identical. `_armAlarmIfEarlier()` itself inserts **no** schedule rows under either condition — so **5a cannot insert or duplicate watchdog rows**. Watchdog insertion happens only in `wake()` (:2469–2474) and the base alarm's `finally`, each guarded by "insert only if no pending watchdog row exists."

**Against the last observed state** (pendingSchedule 2 / pendingWatchdog 1, from the P2 gate `drive=1` reads): a 5a wake inserts no watchdog row (count is 1), changes no row, and — if delivery follows — the revived chain processes rows exactly per base semantics: due rows → `done` (or backoff/death on failure, unchanged), the watchdog row consumed and re-created by the `finally`, lease/retry rows appearing and clearing with the grant cycle (amended assessment §6).

**Recorder accrual under a revived chain.** Each delivered pass writes 1 recorder row + a prune to the newest 288 + 1 recorder-health KV put. A healthy chain passes on the ~10-minute watchdog cadence interleaved with lease (+15 min) and retry (+30 s) passes — order ~150–250 passes/day — so the 288-row cap is reached in roughly **1–2 days** of continuous revival and the oldest diagnostic evidence begins pruning. Any gate that revives the chain must capture recorder reads promptly and treat the cap as an evidence-retention limit, not a safety limit.

**Quota-ledger churn (under the holds).** Per cycle: derived reserved moves 0 → 12 at issuance and 12 → 0 at the safe void (amended assessment §6) — symmetric, non-accumulating, and day-scoped (PT day rolls 07:00Z). Dispatched stays 0; no provider contact; $0 spend. Row growth, however, *is* cumulative: each cycle adds a grant row, transition-log entries, and `ledger_ops` rows (order ~90+ cycles/day if the cycle runs continuously). Nothing functional depletes (§7.4), but storage and log growth accrue for as long as the chain lives. This is a standing cost of revival under any option, not of 5a alone.

## 6. Test coverage plan

Built and run to the P2 instrumentation battery's standards: assembly from the exact candidate tree, patch round-trip on pristine basis parts, one complete run's full log + exit code captured on the final tree, no green claim before that run exists. The candidate tree is the live instrumented tree (§2.4) with the single condition change.

- **T0 — Assembly & identity.** Fresh assembly from the live build's 31 parts + the §2.2 change; measured diff == the §2.4 estimate (1 part, condition-only, plus the build-stamp part at deploy packaging); `coordinator.mjs` in the basis verified byte-identical between `parts-e0` and the instrumented tree; patch round-trip reproduces the candidate byte-for-byte.
- **T1 — Bring-up.** Harness DO instantiates on the candidate; seeded stale state reproduced: schedule rows with a past minimum due, `getAlarm()` stubbed/seeded to a past armed value A, preserved-plan-shaped job in `queued` rev 1, halt "1".
- **T2 — Stale-armed wake, D = A (B1).** One command-path wake → `setAlarm` called with value exactly D (past); armed value after == D; no schedule rows inserted; no other writes.
- **T3 — Stale-armed wake, D < A (B2).** Wake → `setAlarm(D)` (also fires under the old condition — regression guard that 5a preserves it).
- **T4 — Armed null (legacy).** Wake → `setAlarm(due)` exactly as today.
- **T5 — Armed future.** (a) `due < armed` (both future) → advance fires, as today. (b) `due >= armed`, armed future → **no** `setAlarm` (5a must not fire on a healthy future registration). **T5b — empty schedule, armed past** → `setAlarm(now + WATCHDOG_PERIOD_MS)` fires (the §3 disclosed edge), and a subsequent simulated delivery creates the watchdog row via the base `finally`.
- **T6 — Repeated wakes, delivery disabled.** N = 10 wakes against a past armed value with the platform stub never delivering: `setAlarm` count ≤ 2 per wake, every value == D, armed value stable, zero schedule-row growth, zero watchdog duplication, zero grant/plan movement.
- **T7 — Delivery-success path.** After a T2 wake, harness invokes `alarm()`: the pass completes; the grant transition set matches the amended gate §7.3 pre-classified set **exactly** (one grant issued, occurrence `pending` → `granted`, job → `generating` rev 2, derived reserved 0 → 12, dispatched 0, phase figures frozen); the `finally` re-arm leaves a future armed value; a further wake fires **no** 5a `setAlarm` (self-termination verified).
- **T8 — Delivery-failure paths.** (a) Throw inside row processing → row backoff/death semantics unchanged; `finally` re-arm still lands; subsequent wake quiet. (b) Throw in `driveOnce` after the base alarm → recorder error-stage row written, original error rethrown identically, armed value future, subsequent wake quiet. (c) Simulated platform retries (≤ 6 re-invocations) → one recorder row per invocation, no duplicate grant (grant step refuses while a grant reads `issued`).
- **T9 — Recorder interaction.** Passes triggered via a 5a re-registration are recorded identically to ordinary passes; recorder write faults (SQL insert, prune, KV put, `getAlarm` readback) are swallowed per the shipped recorder contract and do not alter arming behavior; recorder-health failure surfaces as a finding, not a pass failure (gate correction C4 posture).
- **T10 — Shipped-surface equivalence.** Everything except the §2.2 condition behaves identically to the live build on the battery's existing surfaces: `drive=1` diagnostics still no-wake/no-arm; operator routes unchanged; capabilities/halt fences unchanged; the four baseline `schedule_dead` conflicts untouched by construction.
- **T11 — (Only if Rowan entertains the one-shot variant, §10.)** The boxed condition fires its re-registration exactly the boxed number of times across repeated wakes, then evaluates as today's condition; the box state survives re-instantiation; reset requires the gated path the variant specifies.

**What the harness cannot prove — stated plainly.** Real platform **delivery** of a re-registered alarm (the harness invokes `alarm()` directly; delivery is the very platform behavior under investigation); `getAlarm()` semantics after real retry exhaustion; code-adoption timing on a real deploy; and any real-DO behavior beyond harness fidelity (the standing caveat: harness-green is no evidence for empty-result paths on real DO SQLite, whose `.one()` throws). A green battery qualifies the candidate for a gate; it does not predict revival.

## 7. Stopping / containment — the honest analysis (ruling item 6)

**Correction 6, restated as this section's premise:** STOP prevents additional operator stimuli; it cannot itself stop an already-revived alarm chain. A successful recovery — by R2, by R5a, or spontaneously — may continue watchdog and grant/void activity beyond the observation window, indefinitely under the holds. This section prices that fact for R5a specifically, and reaches an uncomfortable conclusion that must not be softened.

### 7.1 Option (i): rollback to the pre-5a instrumented build

The pre-5a parts are preserved byte-identically (gate-assembled tree + manifest, build `86ad06ab…`), so a rollback upload is mechanically straightforward and its read-back verifiable part-by-part, exactly as in prior gates. **What rollback does:** removes the 5a *semantic* — after rollback, a future stall's past-due armed value will no longer be re-registered by ordinary wakes. **What rollback does NOT do:** unregister or quiet an **already-revived** chain. The chain's perpetuation machinery — the base alarm's unconditional `finally` re-arm and the watchdog rows — is present and identical in *both* builds, and per the assessment's Q2/Q3 findings a deploy neither delivers nor cancels an alarm and invokes no DO method. **Deployment cannot stop a running chain.** Rollback is prevention of future re-registrations, not containment of a live one.

### 7.2 Option (ii): the holds as containment

While GENERATION_HALT "1" and the queue stay paused, a revived chain's effects are bounded to: watchdog passes (~10-min cadence), the §6 grant/void cycle (~15-min lease cadence; derived reserved ∈ {0, 12}; dispatched 0; phase figures frozen; $0 spend, because `sendGrant` is unwired under the halt), and recorder-row accrual to the 288 cap. The holds are real containment of *consequences* — no provider contact, no spend, no dispatch — but they are not a stop: the churn (§5: grant rows, transition logs, `ledger_ops` rows) accrues for as long as the chain lives, and the live-trigger warning stands in full — **any future hold change, by anyone, for any purpose, meets a live chain pointed at the only selectable plan** (halt lift alone stages a real dispatch into the paused queue; both lifted executes the preserved plan end-to-end, ≈ $0.008 expected). Containment by holds is therefore containment by *continued vigilance*, priced as a standing operational fact, not a resolved state.

### 7.3 Option (iii): a code-level kill switch

**None exists on shipped surfaces.** There is no `deleteAlarm` call anywhere in the deployed tree, no route or command that clears the alarm or drains the schedule, and the operator routes (exemption, finalizer, diagnostics) do not touch the schedule or the registration. A kill switch — a `deleteAlarm` route, an alarm-suppression flag checked in the subclass handler, a schedule-drain operation — would be a **new code change with its own design/spec/gate**, i.e., containment-by-code is a separate gated project that would have to be proposed, reviewed, built, and deployed *while the chain is live*. It cannot be improvised inside a recovery gate, and this document does not propose it.

### 7.4 Option (iv): does the chain ever self-terminate? (traced)

- **Watchdog chain:** no. The watchdog row is consumed by its pass and re-created in the base alarm's `finally`, unconditionally ("the chain itself is self-perpetuating" — `wake()` comment, `coordinator.mjs:2467–2468`). There is no pass count, age, or condition under which the shipped code stops re-arming.
- **Grant cycle:** no depletion found, traced through the deployed source. The lease row for an issued grant is processed at expiry (`coordinator.mjs` lease case, ~:2545–2600): the outbox row is provably unsent and never attempted under the halt wiring, so the safe void applies — `_voidDispatch(..., "lease_expired_undelivered")` (:2589–2592) returns the occurrence to `pending`, voids the grant, releases the reservation — followed by `_scheduleReAdvance(jobId)` (:1790–1802), which schedules **exactly one** bounded `retry_grant` (+30 s, only if the job is still `generating` and no retry is already pending). The `retry_grant` handler (:2625–2638) calls `requestGrant` if the job is `generating`; a grant-gate refusal (park/cap/quota/state) **ends that retry chain without self-rescheduling** — but `driveOnce` independently selects the plan on every pass while its state is outside (`complete`, `partial`, `retired`, `halted_unknown`) and it is not quarantined, so the next watchdog pass re-issues regardless. Nothing cumulative is consumed: provider-attempt budgets count *executions* (dispatches), which never occur under the halt; reservations open and close symmetrically within a PT day and the day itself rolls. **The cycle repeats indefinitely** until the plan leaves the selectable set or the job leaves `generating` — both of which are operator dispositions under separate gates — or the phase parks (a state-based interruption that itself resumes on its own per `service.mjs`, and in any case is not an operator stop).
- **Schedule rows generally:** a *failing* row backs off and dies as a visible `schedule_dead` conflict at 8 attempts (`SCHEDULE_MAX_ATTEMPTS`, :148) — but the healthy watchdog/lease/retry rows do not fail, and a dying row would in any case be unmatched movement requiring report, not a stop mechanism.

### 7.5 Conclusion — stated plainly, as a first-class cost

**There is NO operator stopping procedure for a revived alarm chain on the shipped surfaces.** Not STOP, not rollback, not any existing route, command, or setting. The complete containment set is: (1) **the holds**, bounding a live chain's effects to grant/void churn, watchdog passes, and recorder rows for as long as they stand; (2) **rollback of the 5a semantic**, which prevents *future* re-registrations after any *future* stall but does nothing to a chain already running; and (3) **separately gated dispositions** — a plan disposition (retirement/completion path) or a new kill-switch code change — each its own gate, none available inside a recovery execution. Rowan and Julie must weigh R5a (and, per §8, R2 as well) as the purchase of a **permanent-until-disposition running chain** in exchange for reviving the drive mechanism at all. If that price is unacceptable, the correct ruling is to not revive the chain by any option — the held, stalled state is stable and costs nothing.

## 8. Interaction with R2 — sequencing

Rowan's ruling item 3 prefers **R2** (the one-row targetless wake command) as the first diagnostic stimulus, under its own separately approved execution gate, and item 5 selects R5a for **design review only**. The two proceed in parallel on paper; execution order, if both are ever approved, is **R2 first**:

- **If R2 succeeds** (a recorder row appears; the chain revives): the incident's stall is over. 5a is then **unnecessary for this incident** — its only remaining value would be as a standing defect fix against future stalls, which is a separate decision Rowan and Julie can take up calmly, or never. Note well: R2 success carries **exactly the §7 containment price** — correction 6 is not specific to 5a. A revived chain via R2 is just as unstoppable on shipped surfaces.
- **If R2 fails** (no recorder row by window expiry; armedAt unchanged): B2's cheap branch closes. B1/B3 remain, in which no shipped wake can re-register the alarm, and 5a — already designed and, by then, possibly already built and pinned under its own paperwork — is the remaining mechanism. Nothing about an R2 failure changes 5a's design; it changes only its necessity.
- **5a-first is not recommended** in any ordering: it spends a code change and a deploy to obtain what R2 might obtain for one durable row, and it makes the §7 price *more* likely to be paid (its mechanism cannot miss in B1/B3, whereas R2's can).

## 9. Proposed gate skeleton (for Rowan's design review — NOT an execution authorization)

A future R5a execution gate, following the standing pattern (census → build → battery → pin → GO → deploy → stimulus → observation → ends-HELD certification), would contain at minimum:

- **Census (pre-flight, all must match exactly; any deviation → STOP before any mutation):** live build stamp `86ad06ab…` with 31/31 parts matching the gate-assembled tree; observability enabled + persisted; GENERATION_HALT "1"; queue delivery paused; settings revision 1; preserved plan/job/occurrence exactly at the amended assessment §1.2 state (grants [], occurrence `pending`, job `queued` rev 1, derived reserved 0, dispatched 0, phase figures frozen); `drive=1` read returning armedAt = A exactly, pendingSchedule 2, pendingWatchdog 1, recorder table still missing, recorderHealth null; conflicts exactly the four baseline `schedule_dead` rows; parked job fingerprint exact; quota reconcile `ok: true` with the sole known straddler.
- **Build & battery:** candidate assembled from the live instrumented tree + the §2.2 change only; footprint measured against the §2.4 estimate (excess → STOP); battery §6 executed in one complete run on the exact candidate tree, full log + exit code captured; candidate pinned before any GO is requested.
- **Mutation budget (the whole gate, counted honestly):** **1 script upload** + **≤ 1 conditional observability PATCH** (only if the upload is found to have reset logging — it did not after the P2 upload); **exactly 1 stimulus command** of the R2 form (fresh `command_id` recorded in the execution record; payload naming the reserved nonexistent probe job, whose nonexistence the census re-verifies; the command is the wake that lets 5a fire) = **1 durable `commands` row**; **exactly 1 expected 5a `setAlarm`** (the stimulus wake's first `_armAlarmIfEarlier` evaluation; a second evaluation in the same wake writing the same value is pre-classified, per §3); conditional per-pass (PP) and grant-cycle (GC) writes **only** as pre-classified in the amended assessment §6/§6.1. **Conditional rollback** (named §-conditions only, same execution): **1 upload** of the byte-identical pre-5a instrumented parts + **≤ 1 conditional PATCH**. Nothing else. $0 spend in every branch.
- **Observation:** `drive=1` + plan/job/quota reads at ≈ +1, +6, +12, +20, +35 min after the stimulus; no second stimulus of any kind in the window; recorder reads captured promptly thereafter (288-cap pruning, §5).
- **STOP conditions:** the amended assessment §8 set, **including correction 6 verbatim in the gate text** — STOP binds operator stimuli only and cannot stop a revived chain; plus: any census deviation; any build/battery shortfall; any movement outside the §6 pre-classified set; recorder error-stage/health findings held for classification (not automatic failure, not success); cadence anomaly; hold coincidence voids the GO. Window expiry with no recorder row = the deployment stands but revival failed — report, classify, and **stop**; the 5a semantic remaining live is itself reported as a state change requiring a disposition decision (keep as standing fix vs rollback), never silently left.
- **Preservation checks:** plan, job, occurrence, exemption, parked job, settings, conflicts baseline, and both holds verified unchanged at every observation (the §6 cycle's own pre-classified movements excepted and itemized).
- **Ends state:** HELD — halt "1", queue paused, no generation, no SubmitJob, no further command. The execution record must state, as a headline fact and not a footnote, whether the chain is now live and self-perpetuating.
- **Julie GO wording a future gate would need (scope-exact):** "GO — execute one R5a gate attempt as pinned at \<pin\>: one upload of the 5a candidate build, one R2-form wake command with the command_id recorded in the execution record naming the reserved nonexistent probe job, conditional observability PATCH and conditional rollback exactly as budgeted in the gate; observation window as specified; ends HELD. No generation, no SubmitJob, no halt or queue change." A GO in any other words does not open this gate.

## 10. UNVERIFIED list and open questions for Rowan

**UNVERIFIED (carried from the amended assessment, unchanged by this design):** the pending rows' `due_at` values (hence B1 vs B2 vs B3 — B1 remains the leading, unproven explanation); whether a fresh `setAlarm` will deliver now; post-exhaustion `getAlarm()` semantics; the recorder dual-failure blind spot; real-platform delivery of *any* re-registration. **New with this design:** the §2.4 footprint is an estimate by stated method until a candidate is built and measured; harness behavior of the past-due branch is specified (§6) but not yet executed — no battery has run on any 5a candidate, because none exists.

**Open questions for Rowan:**

1. **Permanent semantic vs one-shot variant — the headline question.** As designed, 5a is a **permanent** semantic change: forever after, any wake that finds a past-due armed value re-registers it. Framed one way, that is the actual defect fix (the function's own comment already promises that "any wake… re-establishes the chain" — the current condition simply fails to keep that promise in the past-due case). Framed the other way, it is a standing behavior change purchased to solve one incident. **Wren-originated alternative, offered for Rowan's consideration and labeled as such:** a **boxed variant** — the past-due disjunct fires only while a durable counter (a DO storage value written by the arming path itself) is below a small bound (e.g. 1, or 3), after which the condition reverts to today's arithmetic until a later gate resets the counter. A bound of 1 makes 5a a one-shot incident tool: exactly one re-registration per arming of the box. Costs of the boxed variant, honestly: a second durable write per firing; new state whose own failure modes need tests (T11); a reset path that is itself a future gated act; and the loss of the standing-fix property — the next stall, years from now, finds the box spent. A **time-boxed variant** (disjunct active only until a build-constant deadline) was considered and is **not** recommended: the deadline is arbitrary, build-bound, and silently converts a semantic decision into a calendar accident. Rowan is asked to rule: permanent (as designed), boxed (bound = ?), or reject both framings.
2. **The B3-future sub-case (§3):** 5a can move a registration from a stale past A to a future D. Ruled acceptable, or should the disjunct be restricted to cases where `due` is also past?
3. **Retry-gap interaction (§4):** a wake superseding a pending platform retry with an immediate registration — acceptable, or should the design distinguish "failed, retry pending" from "never delivered" (noting the shipped surfaces cannot distinguish them)?
4. **Containment posture (§7):** does Rowan accept the holds + rollback-of-semantic + separate-disposition set as the complete containment story for a *design approval*, or is a kill-switch design (its own project) a precondition of any revival — by 5a **or** by R2?
5. **Sequencing confirmation (§8):** R2 executes first if approved; 5a's *build* phase (candidate + battery + pin) — may it proceed on paperwork in parallel, or only after an R2 outcome is known?

## 11. R5b — retained as fallback (unchanged)

A dedicated operator-only wake route that calls the existing unconditional `_armAlarm()` once and returns before/after `getAlarm()` values. **Retained as a fallback, unchanged from the amended assessment.** Its trade, in one paragraph: no change to command/report semantics and no standing self-heal — re-registration happens only on explicit operator invocation — at the cost of a larger surface (new route, operator admission, tests) and a permanent new operator capability. If Rowan rejects 5a's permanent semantic on principle but accepts a code-assisted revival, R5b is the variant to design next. Nothing in this document builds or authorizes it either.

— Wren, 2026-11-02. Design review only; no production action taken or authorized.
