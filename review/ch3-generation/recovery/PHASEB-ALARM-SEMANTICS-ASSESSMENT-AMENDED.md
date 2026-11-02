# Phase B — Durable Object Alarm-Semantics Assessment and Smallest Safe Recovery-Path Proposal

**Status: PROPOSAL ONLY — INVESTIGATION HOLD. Nothing in this document is executed, built, or authorized by its existence.**
**Production mutations performed for this document: NONE.** No alarm wake, no command, no report, no deploy, no SubmitJob, no halt/queue change.
**Basis date: 2026-11-02.** Prepared by Wren at Rowan's direction in her P2 gate execution review (verdict: **DOCUMENTARY PASS ON EXECUTION AND CONTAINMENT; DIAGNOSTIC RESULT INCONCLUSIVE**; recorded verbatim on opal-roundtable issue #15, comment 6581853615, Handoff ID RT-H-20261102-cf451c).
**AMENDED 2026-11-02** under Rowan's ruling on this assessment (verdict: **DOCUMENTARY ACCEPTANCE WITH REQUIRED CORRECTIONS. PRODUCTION HOLD CONTINUES**; recorded verbatim on opal-roundtable issue #15, comment 6583967424, Handoff ID RT-H-20261102-9289ce). See the Amendment Banner below for every change. The unamended original is preserved at pin `fe224038…` (opal-reader, `ui1-review`).

---

---

## AMENDMENT BANNER — Rowan ruling, 2026-11-02 (comment 6583967424)

This document is the original assessment **amended in place** under Rowan's ruling. Every change:

- **(a) Ruling item 1 — B1 reframed.** B1 (D = A) is the **LEADING** source-grounded explanation of attempt 3, **NOT PROVEN** — it is not proven until the pending schedule due times (D) are established. B2/B3 are preserved, and the recorder dual-failure caveat (§10 item 10) is preserved wherever an inference rests on absent recorder rows. (§0, §5, §10 item 1)
- **(b) Ruling item 2 — Q2 guarantee language removed.** No general documented guarantee of unchanged alarm registration across deployments is claimed anywhere in this document. Only the **incident-specific observation** stands: in this incident the reported alarm timestamp survived the P2 deploy bit-identical. The general proposition remains UNSPECIFIED. (§0, Q2, §10 item 4)
- **(c) Ruling item 2 — Q4 reworded to exact strength.** The claim is now: **no self-healing mechanism was identified in the reviewed documentation** — never that no such platform mechanism exists. (Q4, §10-adjacent classification lines)
- **(d) Ruling item 4 — R3 STRUCK.** R3 is struck from the recommended recovery escalation sequence everywhere it appeared as a rung. It is retained only in a clearly labeled considered-and-struck passage (§7), citing the P2 deploy's negative evidence for the adoption/restart hypothesis. (§7 R3, §7 ranking, §7 recommendation)
- **(e) Ruling item 3 — R2 confirmed preferred.** R2 is the preferred first diagnostic stimulus over R1, subject to a separately approved execution gate; its preflight must verify target-job nonexistence and a fresh `command_id`. R1 is retained as a considered alternative. (§7 common preflight, §7 R1, §7 R2, §7 recommendation)
- **(f) Ruling item 6 — STOP correction applied.** Wherever STOP language appears: **STOP prevents additional operator stimuli but cannot itself stop an already-revived alarm chain.** A successful revival continues watchdog and grant/void activity beyond any observation window, indefinitely under the holds; containment of a revived chain is an **open problem** requiring its own independently gated procedure. (§6.1, §6.2, §8 preamble, §7 R5)
- **(g) Ruling item 7 — Step-0 preserved.** The Phase B step-0 procedural-variance requirement is restated as preserved for any later generation gate. (§9)

No production action was taken or is authorized by this amendment. Production remains INVESTIGATION HELD: GENERATION_HALT "1", queue delivery paused, preserved plan and idx-26 exemption untouched.


## 0. Executive answer

The live `getAlarm()` value for the account coordinator Durable Object is **A = 1793562576104 = 2026-11-01T19:49:36.104Z**, first read at 2026-11-02T15:42:57Z (≈19 h 53 m past due) and unchanged at 15:58:02Z, with `pendingSchedule: 2` / `pendingWatchdog: 1` and the drive-pass recorder table still **missing** (no subclass alarm pass has completed a recording since the instrumented build deployed).

The documentation supports this much, and no more:

- A past-due value from `getAlarm()` is **not by itself** proof of a dead alarm: the SQLite storage documentation defines an alarm as still "set" if it "has not started, or if it has failed and any retry has not begun," and describes ordinary delivery delays of up to about a minute during maintenance/failover. A ~20-hour overrun is **outside every documented normal condition** retrieved.
- Cloudflare documents **at-least-once execution with up to 6 automatic retries on a throwing handler**. That is self-healing for a handler that was *invoked and failed*. **No retrieved documentation describes any catch-up scan, reconciliation, or revival mechanism for an alarm that is never invoked**, and none states what `getAlarm()` returns after retry exhaustion.
- A Worker code deploy is documented to discard **in-memory** state and adopt new code on a lifecycle schedule; state that must survive must be in Durable Storage, and an alarm is storage state (setting one is a storage write; removing one requires `deleteAlarm()`). **No retrieved page states in so many words that a pending alarm survives a script upload unchanged** — that specific proposition is UNSPECIFIED in the docs and is supported here only by incident observation: the P2 instrumentation deploy (2026-11-02T15:32:31Z) left the reported value bit-identical at both post-deploy reads and produced no recorder row.
- The shipped code's wake path **cannot correct this state** in the expected arithmetic: `wake()` / `_armAlarmIfEarlier()` call `setAlarm(due)` only when the earliest pending schedule due time **D** is **strictly earlier** than the armed value A. Every alarm this code ever set was set to the then-earliest pending due time, and schedule rows are removed only by alarm processing — so on the source's own invariants the leading case is **D = A**, in which a wake is an alarm no-op. This reconciles attempt 3 without needing a second platform failure at the wake itself (see §5 for the full branch table). **Framing per ruling item 1: D = A (branch B1) is the LEADING source-grounded explanation — it is NOT PROVEN, and cannot be proven until the pending schedule due times are established (D is unobservable on shipped surfaces, §10 item 1). B2 and B3 remain open.**

**Recovery consequence:** no existing read, command, report, operator route, or redeploy *guarantees* a fresh alarm registration. The options in §7 are ranked by ascending durable effect; only the code-assisted option (R5) contains a mechanism — an unconditional `setAlarm` — that directly overwrites a stale registration. Any successful revival is **one-way and perpetual** under the existing surfaces: the watchdog chain self-perpetuates and the preserved plan enters the gate §7.3 grant/void cycle under HELD. There is no existing "stop the alarm again" surface short of a further gated action.

---

## 1. Evidence base and method

### 1.1 Shipped source (firsthand trace)

All source claims are traced in the gate-assembled deployed tree of the **live instrumented build `86ad06aba6083f7ea84d64b08eac1788d5bf570c`**:

- Tree: `~/workspace/ch2-program/ch3-recovery/p2-gate-execution/build/deploy-tree/v2/` (31 parts; manifest `p2-gate-execution/build/deploy-manifest-stamped.json`).
- Pre-instrumentation basis: `~/workspace/ch2-program/ch3-recovery/phaseb-attempt3/evidence/parts-e0/` (build `1c2d1d0f…`). The alarm machinery (`coordinator.mjs` schedule/alarm section) is byte-identical between the basis and the instrumented tree; instrumentation touched only the entry's subclass alarm wrapper and the diagnostics read.
- Diagnostic report: `~/workspace/ch2-program/ch3-recovery/PHASEB-STALL-DIAGNOSTIC-REPORT.md` (pin `cccfea62…`, opal-reader `ui1-review`), especially §2/Q1, §5/Q4, §6/Q5.
- Gate §7.3: `~/workspace/ch2-program/ch3-recovery/PHASEB-INSTRUMENTATION-GATE-PROPOSAL.md` (pin `385debd9…`, opal-reader `ui1-review`).

### 1.2 Live observations relied on

From the P2 gate execution record (pin `0e8f802f…`): `drive=1` diagnostics reads at 2026-11-02T15:42:57Z and 15:58:02Z both returned `tableState: "missing"`, `drivePasses: []`, `recorderHealth: null`, `alarm: { armedAt: 1793562576104, pendingSchedule: 2, pendingWatchdog: 1 }`. System HELD throughout (GENERATION_HALT "1", queue `opalreader-generation-v2` delivery paused). Preserved plan `plan:19cad189fab54b9c804a74a6` `active`; job `plan:19cad189fab54b9c804a74a6:seg` `queued` rev 1, grants []; occurrence `2a85f74f-353d-4c25-a86a-4a4db392868b` `pending`; derived reserved 0; dispatched 0; phase figures frozen at settled 1,029,420 / estimatedUnverified 19,018 / reservedUnverified 5,648 / unknownOpen 0 / remaining 12,464,932.

### 1.3 Platform documentation relied on (official, crawled 2026-11-02)

| # | Page | Updated (per page) | URL |
|---|------|--------------------|-----|
| D1 | Alarms (Durable Objects API) | 2026-04-21 | https://developers.cloudflare.com/durable-objects/api/alarms/ |
| D2 | SQLite-backed Durable Object Storage — Alarms section | 2026-09-21 | https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/ |
| D3 | Access Durable Objects Storage | 2026-10-30 | https://developers.cloudflare.com/durable-objects/best-practices/access-durable-objects-storage/ |
| D4 | Lifecycle of a Durable Object | 2026-10-30 | https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/ |
| D5 | Durable Objects code updates | 2026-10-30 | https://developers.cloudflare.com/durable-objects/deployments/durable-objects-code-updates/ |

Every platform claim below is tagged with its source page. Claims are classified **GUARANTEED** (the docs state them as semantics), **UNSPECIFIED** (the retrieved docs do not state them), or **UNVERIFIED** (true or false for *this* DO, not determinable from the available surfaces).

---

## 2. The shipped alarm chain, traced firsthand

Constants (`coordinator.mjs`): `WATCHDOG_PERIOD_MS = 600,000` (10 min, line 133); `LEASE_MS = 900,000` (15 min, line 134); `SCHEDULE_MAX_ATTEMPTS = 8` (line 148).

1. **`_armAlarm()`** (2458–2463): `setAlarm` to the minimum `due_at` over `schedule WHERE state='pending'`, or `now + WATCHDOG_PERIOD_MS` when no row is pending. Unconditional.
2. **`wake()`** (2469–2474): if no pending `watchdog` schedule row exists, insert one at `now + WATCHDOG_PERIOD_MS`; then call `_armAlarmIfEarlier()`. Comment in source: "Recovery never requires a client — any wake (command, report, alarm) re-establishes the chain."
3. **`_armAlarmIfEarlier()`** (2480–2488): read `armed = await storage.getAlarm()`; compute `due` exactly as `_armAlarm()` does; **`setAlarm(due)` only if `armed` is null/undefined or `due < armed`**. It never moves an alarm later, never re-sets an equal value, and never verifies delivery.
4. **Base `alarm()`** (2489–2525): process every pending row with `due_at <= now`, per-row isolated (failure: backoff `min(30 s × 2^attempts, 900 s)`; at 8 attempts the row dies as a visible `schedule_dead` row in `binding_conflicts`); in `finally`, ensure a pending watchdog row exists and call `_armAlarm()` **unconditionally**.
5. **`wake()` callers — the complete set:** `handleCommand` (`coordinator.mjs:521`, before the command transaction; `_armAlarmIfEarlier()` again at :523 after apply), `requestGrant` (:1806, arm again :1809), `handleReport` (:2064, arm again :2219). **No GET/read path calls `wake()`** — including the `drive=1` diagnostics read (`generation/service.mjs` `drivePassDiagnostics`, ~1725), which performs SELECTs, one `getAlarm()`, and one storage `get`, and is documented in its own header comment as read-only: "no wake, no command, and no mutation is reachable from here."
6. **Short-circuits that never reach `wake()`:** a command with a missing `command_id` or unknown type returns before `wake()`; a command whose `command_id` already exists returns its stored receipt **before** `wake()` (the replay fence at `handleCommand`, lines 487–494); a report with no `grantId` returns before `wake()`. A *replayed command is therefore not a wake stimulus* on the shipped code.
7. **Subclass alarm** (`worker-entry-prod-d6.js:1820`): `super.alarm()` (base entry `worker-entry.js:270` → `coord.alarm()` + cache flush) → construct cache/coordinator/service → `service.recover()` → `service.driveOnce()` → cache flush. The P2 recorder runs **last on both paths**: it lazily creates `d6_drive_passes` (`CREATE TABLE IF NOT EXISTS`, entry line 431), inserts one row (stage reached, `driveInvoked`, allowlisted outcomes JSON, error name/message if thrown, `armedAfter` = post-pass `getAlarm()`), prunes to the newest 288 rows, and writes the recorder-health object to DO key-value storage (`d6DrivePassRecorderHealth`) — then rethrows any original error unchanged, preserving platform retry semantics.
8. **`driveOnce` has exactly one caller**: the subclass alarm handler. No fetch, command, queue, or report path drives grants.
9. **No `deleteAlarm` call exists anywhere in the deployed tree.** The only two `setAlarm` call sites are `_armAlarm()` (unconditional, reached only from the base alarm's `finally`) and `_armAlarmIfEarlier()` (conditional, above).

---

## 3. Semantics: guaranteed / unspecified / unverified

### 3.1 What the documentation GUARANTEES (or states as semantics)

- **Single alarm per DO; overwrite semantics.** "Each Durable Object is able to schedule a single alarm at a time by calling `setAlarm()`"; "If you call `setAlarm` when there is already one scheduled, it will override the existing alarm." (D1) There are no per-row alarms: the application's many schedule rows share one platform alarm.
- **Wake-up purpose.** "Durable Objects alarms allow you to schedule the Durable Object to be woken up at a time in the future. When the alarm's scheduled time comes, the `alarm()` handler method will be called." Alarms "provide a mechanism to guarantee that operations within a Durable Object will complete without relying on incoming requests to keep the Durable Object alive." (D1)
- **At-least-once + bounded retries on handler failure.** "Alarms have guaranteed at-least-once execution and are retried automatically when the `alarm()` handler throws… exponential backoff starting at a 2 second delay… up to 6 retries." Retries apply "only to the most recent `setAlarm()` call" and only on uncaught exception. (D1)
- **`getAlarm()` semantics (SQLite).** It returns the current alarm time, or `null`. "The alarm is considered to be set if it has not started, or if it has failed and any retry has not begun." (D2) On the Alarms page: if `getAlarm` is called **while an `alarm` is already running**, it returns `null` unless `setAlarm` has also been called since the handler started. (D1)
- **Past-time `setAlarm` = immediate asynchronous execution.** "If `setAlarm()` is called with a time equal to or before `Date.now()`, the alarm will be scheduled for asynchronous execution in the immediate future… Alarms… will usually execute within a few milliseconds after the set time, but can be delayed by up to a minute due to maintenance or failures while failover takes place." (D2)
- **Alarm operations are storage operations.** "Alarms are modified using the Storage API, and alarm operations follow the same rules as other storage operations." (D1) Setting an alarm counts as writing storage: a DO that has set an alarm has non-empty storage and must `deleteAlarm()` to remove it. (D3)
- **Re-instantiation on unexpected termination.** "If an unexpected error terminates the Durable Object, the `alarm()` handler may be re-instantiated on another machine. Following a short delay, the `alarm()` handler will run from the beginning on the other machine." (D1)
- **Lifecycle.** Creating a stub does not instantiate the DO; the lifecycle begins when a method is invoked on the stub. "The first incoming request or event (like an alarm) will execute the `constructor()`… then run the corresponding function." An event arriving while hibernated runs the constructor again. Shutdowns occur for code updates (immediate, or deferred reaching `max_delay`), inactivity transitions, runtime updates, and hosting decisions; "the object instance is automatically restarted and new requests are routed to the new instance." (D4)
- **Code updates.** Deployment itself completes immediately; the strategy controls when each already-active DO adopts the new version. Default is `deferred`, `max_delay` 300 s: an active object may keep running current code until it hibernates; at `max_delay` (or immediately under `immediate`) it resets and adopts the new code, in a fresh isolate, discarding in-memory state. An inactive object "starts on the new version on the next request." Deferral is best-effort. (D5, D3)
- **Durability rule.** "State that must survive deployments must be persisted to Durable Storage" — in-memory state is preserved only while the DO remains in memory; inactive DOs can be evicted. (D3)

### 3.2 What the documentation leaves UNSPECIFIED (in the retrieved pages)

- **No explicit statement that a pending alarm survives, is dropped by, or is retimestamped by a Worker script upload.** Storage persistence across deploys is documented generally (§3.1), and nothing documents a deploy calling `setAlarm`/`deleteAlarm` — but the pending-alarm-across-deploy proposition itself is not stated.
- **No catch-up semantics for overdue alarms.** Nothing retrieved states that instantiating a DO (by request, restart, eviction recovery, or code adoption) scans for an overdue alarm and delivers it, nor any bound on how late a "will be woken up" delivery may be outside the D2 failover-delay sentence.
- **No post-exhaustion state.** Nothing retrieved states what `getAlarm()` returns after an alarm's 6 retries are exhausted, or whether the registration is cleared, retained, or reconciled later.
- **No periodic reconciliation / dead-letter revival.** No retrieved page describes any platform process that re-delivers an alarm whose delivery was lost without a handler invocation.
- **No statement that a code deploy or DO restart invokes `alarm()`** absent an incoming request/event routed to that DO.

### 3.3 What remains UNVERIFIED for this DO

Consolidated in §9. The load-bearing items: the exact `due_at`/`kind`/`ref` of the two pending schedule rows (diagnostics returns counts only), hence whether D = A, D < A, or D > A; whether the platform consumed the original alarm, retains a live-but-undelivered registration, or reports a stale value for a dead registration; and whether a fresh `setAlarm` for this DO will now deliver.

---

## 4. The five questions

### Q1. Can `getAlarm()` return a time in the past for an alarm that will still fire? Under what documented conditions?

**Yes — in three documented situations, all transient:**

1. **Set but not yet started.** `getAlarm()` returns the scheduled time while the alarm "has not started" (D2). Between the scheduled instant and handler start, the value is in the past and delivery is still expected. D2 bounds the ordinary version of this gap: execution is usually within milliseconds, "delayed by up to a minute due to maintenance or failures while failover takes place."
2. **Failed, retry not yet begun.** An alarm that "has failed and any retry has not begun" is still considered set (D2). During a retry gap — backoff starting at 2 s, up to 6 retries (D1) — the reported time is the (past) scheduled time of an alarm that will be invoked again.
3. **Just set to a past/now time.** A `setAlarm` at or before `Date.now()` schedules "asynchronous execution in the immediate future" (D2); a `getAlarm()` in that interval reads a past time for an alarm about to fire.

**Not this case, on duration alone:** none of these conditions documents a ~20-hour gap. The observed value (19 h 53 m past due at first read, unchanged 15 minutes later, no recorder row) is outside every documented normal condition retrieved. The docs also do **not** license the opposite conclusion — that a long-past value proves the alarm can never fire: post-exhaustion and lost-delivery states are UNSPECIFIED (§3.2). Classification: **anomalous stale armed value; future delivery neither documented nor excluded.**

### Q2. Does a Worker code deploy preserve, drop, or alter a pending DO alarm?

**Answer at ruling strength (item 2): the only claim that stands is incident-specific** — in *this* incident, the reported alarm timestamp survived the P2 deploy bit-identical (below). **No general documented guarantee of unchanged alarm registration across deployments is claimed.** An inference from storage semantics points toward preservation — alarm state is storage state (D1, D3); deploys discard only in-memory state and change which code an object runs and when it adopts it (D3, D4, D5); no retrieved page describes a deploy calling `deleteAlarm()` or `setAlarm()`, and the shipped deploy path contains no alarm call of its own (the upload replaces script parts; it does not invoke a DO stub method — stub creation alone "does not send a request to the Durable Object," D4) — but an inference is not a documented guarantee, and the general proposition remains UNSPECIFIED.

**Direct incident evidence:** the instrumentation deploy uploaded at 2026-11-02T15:32:31Z *while this alarm was pending*. At +10.5 min and +25.5 min, `getAlarm()` still returned exactly A and the recorder table was still missing. That deploy therefore **did not drop, retimestamp, or revive** the reported alarm in the observed window.

**Classification:** incident-specific observation — **the timestamp survived the P2 deploy** (observed, bit-identical); general proposition — **UNSPECIFIED** in the retrieved docs; **no documented guarantee is claimed**. A deploy also does not, by any documented mechanism, *deliver* an overdue alarm: an inactive object adopts new code "on the next request" (D5), and adoption is a code event, not an alarm event.

### Q3. What platform events re-instantiate a DO and give an overdue alarm a chance to fire?

Re-instantiation events (D4): an incoming request or event routed to the DO (HTTP/RPC stub method invocation, WebSocket message, or **the alarm event itself**); return from hibernation on such an event (constructor runs again); restart after shutdowns caused by code-update adoption, inactivity/eviction transitions, Workers runtime updates, or hosting decisions — after which "new requests are routed to the new instance."

Specific alarm-relevant case (D1): if an unexpected error **terminates the DO during an alarm invocation**, the handler may be re-instantiated on another machine and, after a short delay, runs from the beginning there.

**The crucial distinction:** re-instantiation is not alarm delivery. Every documented re-instantiation path runs the constructor and then *the invoked function* — for a request, the request handler; only an alarm event runs `alarm()`. No retrieved page states that a restart, eviction recovery, or code adoption scans for and fires an overdue alarm. So platform events give an overdue alarm a "chance" only in the weak sense that the DO is alive and addressable again; the only documented trigger of `alarm()` is the platform's alarm delivery itself. For this DO, many re-instantiations have already occurred since A went past due (attempt-3 commands, dozens of reads, the instrumentation deploy and its diagnostics reads) with no recorded pass — empirical evidence that ordinary instantiation does not, at least reliably, produce catch-up delivery. **Classification: GUARANTEED for request/event re-instantiation; UNSPECIFIED for any overdue-alarm catch-up on re-instantiation.**

### Q4. If the alarm handler is never invoked, is there any documented self-healing, or does the stale value persist indefinitely until an external stimulus?

**No self-healing mechanism was identified in the reviewed documentation for the never-invoked case.** (Ruling item 2 strength: this is a statement about the reviewed documentation, **not** a claim that no such platform mechanism exists.) The documented recovery mechanisms all presuppose an invocation: at-least-once delivery with ≤6 retries applies when the handler *throws* (D1); re-instantiation on another machine applies when an error *terminates the DO during* an invocation (D1). If delivery itself is lost before any handler code runs, no retrieved documentation describes a reconciliation pass, a watchdog-of-watchdogs, or a deadline after which the platform re-registers or clears the alarm.

**Persistence:** within the application, the stale value persists because the only code that could overwrite it is `_armAlarmIfEarlier()` (which, per §5, is expected to no-op at D = A) and `_armAlarm()` (reachable only from inside an alarm invocation). Within the platform, persistence duration after a lost delivery is UNSPECIFIED. Empirically, the value has persisted ~20 h across commands, reads, and a deploy.

**One refinement:** "external stimulus" must be read narrowly. A stimulus heals this state only if it causes a **`setAlarm` overwrite** (or an actual alarm delivery). Stimuli that merely instantiate the DO — every GET/read, the diagnostics surface, a deploy — have demonstrably not healed it. **Classification: no self-healing mechanism identified in the reviewed documentation (a statement about the docs, not about the platform's full behavior); indefinite persistence — UNVERIFIED as a platform guarantee, observed in this incident.**

### Q5. What does the shipped code do on the next command/wake, given `getAlarm()` returns the stale past time A?

Let **D** = minimum `due_at` over pending schedule rows (currently 2 pending, 1 watchdog; the rows' `due_at` values are **not exposed by any read surface** — UNVERIFIED, §9). Let **A** = 1793562576104.

On any path that reaches `wake()` — a fresh (non-replay) valid command via `handleCommand`, a report with a `grantId` via `handleReport`, or `requestGrant`:

1. `wake()` checks pending watchdog rows: count is 1 → **no schedule insert**.
2. `_armAlarmIfEarlier()`: reads `armed = A`; computes `due = D`.
   - **D < A →** `setAlarm(D)`. D is in the past → per D2, "scheduled for asynchronous execution in the immediate future." This is the only branch in which a wake changes the platform registration.
   - **D = A →** **no `setAlarm` call** (the comparison is strict: `due < armed`).
   - **D > A →** **no `setAlarm` call** (the code never moves an alarm later).
3. The command/report transaction applies (for the benign stimuli in §7: no target state changes).
4. The post-apply `_armAlarmIfEarlier()` repeats the same computation against the post-transaction state. For a stimulus that does not alter the schedule, the inputs are unchanged — **at most one effective `setAlarm` per wake path**, and zero in the D ≥ A branches.

Paths that do **nothing** to the alarm: every GET/read (including `drive=1` diagnostics, which only *reads* `getAlarm()`), replayed commands (receipt short-circuit precedes `wake()`), malformed/unknown commands (validation precedes `wake()`), reports without a `grantId`, all existing operator routes (they construct the coordinator/service directly and none calls `wake()`; the finalizer preview is explicitly documented in-source as performing "no wake"), and a Worker deploy (no DO invocation at all).

**Net:** the next wake either re-registers the alarm at a past time (D < A branch — immediate documented delivery) or **leaves the stale registration exactly as it is**. Which branch production is in is UNVERIFIED because D is unobservable; §5 argues D = A is the expected branch.

---

## 5. Reconciling attempt 3: the 01:23:15Z wake vs. armedAt still = A

Attempt 3's SubmitJob (2026-11-02T01:23:15Z) reached `handleCommand` and therefore ran `wake()` + the post-apply `_armAlarmIfEarlier()`. No drive pass followed. The diagnostic report (§5) showed the naive fault hypothesis needs a fifth condition; the source arithmetic now separates the branches cleanly. Exactly one of these held at that wake:

| Branch | Condition at 01:23:15Z | What the wake did | What must also be true to explain no pass |
|--------|------------------------|-------------------|--------------------------------------------|
| **B1 — equal (LEADING, not proven)** | D = A: the row whose `due_at` A was set from is still pending and still earliest | Nothing (strict `<` fails) | The platform holds an armed value it reports faithfully but does not deliver — *or* the registration was consumed in the fault while `getAlarm()` continues to report the stale timestamp (a read/registration divergence). Either way the failure is delivery-side; the wake is blameless. |
| **B2 — earlier row existed** | D < A: some pending row was due before A (e.g., A had been set against a different row that was then earliest) | `setAlarm(D)`, a past time → documented immediate async execution | The fresh `setAlarm` registration was itself silently ineffective for this DO, or its delivery was also lost. Requires a second, stronger platform condition. |
| **B3 — later row only** | D > A: the row A was set from is gone, earliest pending is later | Nothing (never moves later) | A points at no live schedule row, yet the platform neither delivers nor clears it, and the code has no path to correct a *later*-than-armed discrepancy in the past direction. (How the A-row could disappear without an alarm processing it is itself unexplained on the source — no non-alarm path deletes schedule rows — so B3 is the weakest branch.) |

**Why B1 is the leading explanation (not proven):** every `setAlarm` this code performs sets A := the then-minimum pending `due_at` (or now + 10 min on an empty schedule). Pending rows are removed or rescheduled only inside alarm processing (`alarm()` marks rows done / backs them off; `_voidDispatch` voids a grant's lease row — itself alarm- or drain-invoked). No alarm processing is recorded after A was set, and all post-A `_schedule` insertions are future-dated relative to their insertion time (lease +15 min, retry +30 s, watchdog +10 min), so none can undercut A. The single platform alarm is not "for" a row in any case (D1: one alarm per DO) — A is simply the timestamp the platform was last told; B1 says the schedule and the platform value still agree, and delivery is what is missing.

**What this assessment does *not* claim:** that B1 is proven. **Per ruling item 1, B1 is not proven until the pending schedule due times are established.** D is unobservable on shipped surfaces; B2/B3 remain open, and the fault-causation question (diagnostic H1 vs H4 — fault-caused vs fault-coincident delivery failure) is untouched by this analysis. **Recorder dual-failure caveat (preserved per ruling item 1):** every inference in this section that rests on the absence of recorder rows carries the §10 item 10 caveat — a pass whose SQL record *and* KV health note both fail leaves no row, so absent rows narrow, but do not eliminate, the space of unrecorded passes. The branches matter because they price the options in §7: a wake probe pays off in B2, is a no-op in B1/B3; only an unconditional `setAlarm` (R5) pays off in all three.

---

## 6. If a drive pass finally runs under HELD — the pre-classified transition set

Re-verified against the gate §7.3 text and the shipped source (`driveOnce` grant step, `generation/service.mjs` ~1008–1113; `_issueGrant`, `coordinator.mjs` ~1636–1790; `reserveForGrant`, `generation/quota-budget.mjs` ~544). Under GENERATION_HALT "1" + queue paused, a revived pass that reaches the grant step produces **exactly** this, and nothing else is pre-classified:

- Grants [] → exactly [`grant:plan:19cad189fab54b9c804a74a6:seg:1:full`, `issued`] (job revision as read at issuance).
- Occurrence `pending` → `granted`; job `queued` rev 1 → `generating` rev 2.
- Issuance writes: 1 grant row; 1 occurrence transition (+ transition log); 1 `ledger_ops` attempt row; 1 **unsent** outbox dispatch row; 1 pending `lease` schedule row (+15 min); 1 `d6_grant_reservations` row, `slots_total` 12, `open`.
- Derived reserved for the issuance PT day 0 → **12**. Dispatched stays **0** (no `sendGrant` is wired while halted; the outbox row is never sent; zero provider contact; $0 spend).
- **All five phase figures frozen**: settled 1,029,420; estimatedUnverified 19,018; reservedUnverified 5,648; unknownOpen 0; remaining 12,464,932. (The earlier draft prediction that `reservedUnverified` would rise was withdrawn in the amended gate — `phaseAccounting` derives it only from adjudication/attempt-log state that grant issuance never writes.)
- Plan remains `active`, totals {eligible 1 / done 0 / failed 0 / blocked 0}; bindings 1841 and sync watermarks 18/1841 frozen; parked job fingerprint unchanged.
- **Bounded lease-expiry/re-grant cycle (also pre-classified):** at lease expiry (+15 min) the base alarm finds the outbox row unsent and never attempted and safe-voids it (`_voidDispatch`, "lease_expired_undelivered"): occurrence `granted` → `pending`, grant → `voided`, 1 `ledger_ops` attempt-release row, reservation closes (derived reserved 12 → 0), outbox row deleted, `retry_grant` scheduled +30 s; re-issuance follows under the grant-id grammar at the then-current job revision. Invariants at every instant: **≤ 1 live grant; derived reserved ∈ {0, 12}; dispatched 0; phase figures frozen.**

**Any movement outside this set is unmatched → STOP (§8).**

### 6.1 Per-pass write set (the honest recurring budget of any revival)

Each subclass alarm pass that runs to completion also writes, beyond §6's grant effects:

- Base alarm: 1 update per due schedule row processed (→ `done`; a failing row instead backs off or dies — a new `binding_conflicts` row at death is **unmatched movement → STOP**); ≤ 1 watchdog schedule insert in `finally`; 1 unconditional `setAlarm` (to the earliest pending due).
- `driveOnce` preamble: halt-observation writes (epoch/meta upserts in `d6_halt_epochs` / `d6_quarantine_meta`); binding-projection sweep (expected no-op — no pending projections are known; any sweep movement is reported, not assumed).
- Recorder: `CREATE TABLE IF NOT EXISTS d6_drive_passes` (**first pass only** — the table is currently missing), 1 row insert, 1 prune statement (deletes only beyond the newest 288), 1 recorder-health KV `put`.
- A pass that **throws** after the recorder runs still records its row (record-then-rethrow) and is retried by the platform up to 6 times — each retry is another recorded pass. Error-stage rows are **findings requiring classification, not automatic failures** (gate correction C4).

**Revival is perpetual:** once the chain lives, watchdog passes recur (~10-min cadence interleaved with lease/retry passes), recorder rows accumulate toward the 288 cap (oldest diagnostic evidence is pruned — capture reads promptly), and the §6 grant cycle churns roughly every 15 minutes, indefinitely, until some *separately authorized* disposition changes the plan or the code. No option below includes an "off switch," because none exists on the shipped surfaces.

**Correction 6 (ruling item 6) — read with every STOP in this document:** STOP prevents additional operator stimuli; it **cannot itself stop an already-revived alarm chain**. A successful recovery may continue watchdog and grant/void activity **beyond the observation window, indefinitely under the holds**. Containment of a revived chain is an **open problem requiring its own independently gated procedure** — none exists on shipped surfaces — and this continuing effect must be explicitly addressed before any production stimulus (the R5a proposal's §7 carries the full containment analysis).

### 6.2 The live-trigger warning (preservation risk, all options)

While **both** holds stand, a revived drive is grant/void churn only: no dispatch, no spend (§6). The danger is coincidence with any hold change, by anyone, for any purpose:

- **Queue unpause alone** (halt still "1"): the §6 cycle only; nothing reaches the provider.
- **Halt lift alone** (queue still paused): `sendGrant` becomes wired; a drive pass drains the outbox and **stages a real dispatch message in the paused queue** (retention 86,400 s). Any later unpause inside retention delivers it; the executor re-checks the halt flag at delivery time.
- **Both lifted, for any reason, including unrelated work:** the preserved plan — the only selectable plan — **executes end-to-end with no further command, submission, or approval touchpoint** (expected cost ≈ $0.008 for the one 569-char segment; modeled occurrence ceiling 153,636 units), and Chapter 3 completes at 27/27.

A recovery GO therefore **expires by its own terms** if either hold changes before or during execution (§8 STOP), and every future gate must be told the chain may be live. **Correction 6 applies here in full:** the STOP that a hold change triggers binds the operator's stimuli only — it does not, and cannot, quiet a chain that has already revived; the revived chain's activity continues under whatever hold state follows, bounded in effect only by the holds themselves (§6).

---

## 7. Proposal — candidate recovery stimuli, ascending by durable effect

**Common preflight (every option; any mismatch → STOP before the stimulus; STOP here and everywhere below carries correction 6 — it binds operator stimuli, never an already-revived chain):** live build stamp `86ad06ab…`; GENERATION_HALT "1"; queue delivery paused; `drive=1` read returns armedAt = A exactly, pendingSchedule 2, pendingWatchdog 1, tableState "missing", recorderHealth null; preserved plan/job exactly at §1.2 state (grants [], occurrence pending, job queued rev 1, derived reserved 0, dispatched 0); phase figures frozen; conflicts exactly the four baseline `schedule_dead` rows; parked job fingerprint `b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282`; settings revision 1; quota reconcile `ok: true` with the sole known straddler exception. **R2-specific preflight (ruling item 3): verify (i) the target job's nonexistence — the reserved probe job id resolves to no job on the live job/plan reads — and (ii) a fresh `command_id`, never used before, recorded in the execution record before the stimulus.** **If the preflight `drive=1` read shows any recorder row or a changed armedAt, the state has already moved — STOP; no stimulus is needed or permitted; classify and report.**

**Common observation (every option):** `drive=1` + plan/job/quota reads at ≈ +1 min, +6 min, +12 min, +20 min, +35 min after the stimulus; no second stimulus of any kind within the window; all reads captured to the gate evidence folder. Success evidence = a recorder row (stage, `driveInvoked`, outcomes, `armedAfter`); §6 transitions, if any, itemized against the pre-classified set.

**Conditional budget notation:** **PP** = one completed alarm pass's write set (§6.1); **GC** = one §6 grant issuance (+, at +15 min, its void set). These are *conditional* — they occur only if a pass actually runs — and are counted in every option below, not hidden.

### R0 — Passive re-read only (baseline; not a recovery stimulus)

- **Action:** one `drive=1` diagnostics read + passive observation. Reaches the DO (instantiates it) but, per source, calls no `wake()` and no `setAlarm`.
- **Expected effect:** none. Already performed twice post-deploy (15:42:57Z, 15:58:02Z) with no change — this option is **empirically negative** over a 15-minute span and is listed only as the control and as the preflight/post-stimulus read for the other options.
- **Mutation budget:** 0 production writes. (Conditional PP/GC only if the platform spontaneously delivers — in which case the option stops being passive and is reported as a spontaneous revival.)
- **GO wording:** "GO — one read-only drive-diagnostics recheck and a 35-minute passive observation window only. No command, report, deploy, alarm wake, SubmitJob, halt or queue change."

### R1 — Wake via a replayed executor report (smallest durable effect: zero application rows) — RETAINED AS A CONSIDERED ALTERNATIVE; NOT the preferred first stimulus (ruling item 3 prefers R2)

- **Action:** one `POST /v2/reports` naming a grant that preflight has verified is already in state `reported`. Source trace: `handleReport` calls `wake()` **before** its transaction; the transaction sees `grant.state === "reported"` and returns `{ ok: true, replayed: true }` with **no state writes**; `_armAlarmIfEarlier()` runs again after. No results array is needed — the reported short-circuit precedes result processing.
- **Alarm effect:** exactly the §4/Q5 arithmetic — `setAlarm(D)` once **iff D < A** (past time → documented immediate execution); otherwise nothing. Instantiates the DO either way.
- **Mutation budget:** **0 application-data writes**; 0 commands; conditional ≤ 1 `setAlarm` (platform alarm metadata); conditional PP/GC if a pass runs. Watchdog insert: 0 expected (preflight verifies pendingWatchdog = 1; if it were 0, +1 schedule row — a preflight mismatch → STOP anyway).
- **Risks:** depends entirely on preflight correctly identifying a `reported` grant — a report against a *live* grant would be a real executor report with real closure effects, which is why the grant's state must be verified in the same preflight, and any ambiguity is a STOP. Semantically borrows the executor's surface for a non-executor purpose.
- **GO wording:** "GO — exactly one replay report for the preflight-verified already-reported grant named in the execution preflight, for alarm-wake diagnosis only, while GENERATION_HALT stays "1" and the queue stays paused. No new command, no SubmitJob, no deploy, no hold change. Stop on any movement outside gate §7.3."

### R2 — Wake via one targetless durable command (one application row; self-auditing) — **PREFERRED FIRST DIAGNOSTIC STIMULUS (ruling item 3)**, over R1, subject to a separately approved execution gate. R2's durable receipt and nonexistent target justify its one-row application cost. Its preflight must verify target-job nonexistence and a fresh `command_id` (see common preflight).

- **Action:** one `POST /v2/commands`: type `RequestPause`, a **fresh** `command_id` recorded in the execution record, payload naming a reserved **nonexistent** job id (e.g. `alarm-wake-probe:nonexistent`). Source trace: `RequestPause` is not in the halt-refused command set; `handleCommand` runs `wake()` (521), then `_recordAndApply` inserts the `commands` row and applies: `applyJobEvent` finds no such job and returns `job_not_found` **before** any transition log or job write; the row's outcome is updated to `rejected / job_not_found`; `_armAlarmIfEarlier()` runs again (523). The failure mode is bounded by construction — a nonexistent job can never transition, be granted, or be dispatched.
- **Alarm effect:** identical to R1 (two evaluations of the same arithmetic; at most one effective `setAlarm`, iff D < A).
- **Mutation budget:** **1 durable `commands` row** (insert + outcome update); 0 job/occurrence/grant/settings/schedule writes (watchdog insert 0 under preflight); conditional ≤ 1 `setAlarm`; conditional PP/GC if a pass runs.
- **Risks:** one permanent (but truthful and self-describing) receipt row. Otherwise as R1, minus the dependence on any real grant's state.
- **GO wording:** "GO — exactly one RequestPause command with the fresh command_id recorded in the execution record, naming the reserved nonexistent job `alarm-wake-probe:nonexistent`, for alarm-wake diagnosis only, while GENERATION_HALT stays "1" and the queue stays paused. No other command or report, no SubmitJob, no deploy, no hold change. Stop on any movement outside gate §7.3."

### R3 — Redeploy the identical instrumented build — **STRUCK FROM THE RECOMMENDED ESCALATION SEQUENCE (ruling item 4)**. Retained ONLY as a considered, speculative alternative in this passage. The P2 deploy has already provided negative evidence for the adoption/restart hypothesis R3 depends on: a deploy occurred while this alarm was pending, with adoption/instantiation events, and produced no delivery and no recorder row. R3 appears in no ranking, ladder, or recommendation in this amended document.

- **Action:** one multipart upload of the byte-identical 31-part instrumented envelope (build `86ad06ab…`), followed by the standing post-upload observability check and, **only if** the upload reset it, the settings-only multipart PATCH restoring observability.
- **Alarm effect — assessed honestly:** a deploy invokes no DO method and calls no alarm API (Q2). Its only alarm-relevant pathway is indirect: code adoption resets an active DO (immediate, or deferred up to `max_delay`), and a later request/event instantiates it on the new code. No documented mechanism delivers an overdue alarm on adoption or restart (Q3). **And the experiment has substantially been run:** the P2 deploy *was* a deploy-while-this-alarm-was-pending; it changed the code rather than redeploying identical bytes, but its adoption/instantiation events produced no delivery and no recorder row in 25.5 minutes. An identical redeploy's incremental value over that datapoint is UNVERIFIED and, on the docs, speculative.
- **Mutation budget:** **1 script upload**; conditional **+1 observability PATCH** (only if logging is found reset — it was *not* needed after the P2 upload); 0 commands/reports; conditional PP/GC if a pass runs. Side effects: script ETag may change; in-memory DO state is discarded on adoption; adoption timing under the script-API upload path is UNVERIFIED (§9).
- **Risks:** the broadest blast radius per unit of expected benefit — a whole-script deploy to test a hypothesis the docs do not support, with the standing observability-reset hazard and an uncontrolled adoption moment that could coincide with unrelated traffic.
- **GO wording:** "GO — exactly one redeploy of the byte-identical instrumented build 86ad06aba6083f7ea84d64b08eac1788d5bf570c (31 parts), plus only the conditional observability settings PATCH if the upload resets logging. No command, report, SubmitJob, halt or queue change."

### R4 — Existing operator actions — CONSIDERED; NONE EXISTS

The shipped operator surfaces were enumerated firsthand: the four Ch 3 operator routes, the two finalizer routes, and the `drive=1` diagnostics mode. **None calls `wake()` or `setAlarm`**; the read-only ones (diagnostics, finalizer preview) are explicitly no-wake, and the mutating ones (exemption apply/revoke, finalizer apply) are substantive production actions that are (a) prohibited under the current disposition, (b) preserved-state changes this proposal must not touch, and (c) still would not re-register the alarm. There is **no operator wake/re-arm endpoint to invoke**. Inventing one is R5, not an existing action. Cloudflare-side, no documented API invokes a specific DO's alarm or restarts a specific DO on demand; PITR/storage restore is a destructive data operation and is **rejected outright** as a stimulus.

### R5 — Code-assisted unconditional re-arm (separate design/spec/gate; NOT built here)

The only option whose mechanism pays off in **all three** §5 branches, because it replaces the conditional arming with an unconditional `setAlarm`, overwriting whatever registration the platform holds:

- **Variant 5a (minimal diff):** in `_armAlarmIfEarlier()`, treat a past-due armed value as unarmed — `if (armed == null || armed <= now || due < armed) setAlarm(due)`. One condition changed; thereafter any ordinary wake (e.g. the R2 command) re-registers at D — in B1/B3, D is past → documented immediate execution. Permanent semantic change: any future stuck-past-due alarm self-heals on the next command/report wake. (That is arguably the actual defect fix; it is also a standing behavior change Rowan must rule on as such.) **Correction 6 applies with full force to R5:** deploying 5a makes re-registration *easier*, and once a chain revives under it, no STOP and no shipped surface stops the chain; containment is the open problem flagged in §6.1/§8.
- **Variant 5b (dedicated surface):** a new operator-only wake route that calls the existing unconditional `_armAlarm()` once and returns before/after `getAlarm()` values. No change to command/report semantics; larger surface (route, admission, tests) and a permanent new operator capability.
- **Either variant requires, before any execution:** its own design + spec + gate under the standing pattern (Rowan source review, executed battery on the exact candidate tree, pinned package, Julie's separate explicit GO naming the pin). **This proposal does not build it and does not ask for its execution.**
- **Mutation budget (execution, when separately gated):** 1 script upload (+ conditional observability PATCH, per the standard deploy mechanics); stimulus = 1 `commands` row (5a, via the R2 command) or 0 application rows (5b, operator invocation); **exactly 1 unconditional `setAlarm`** by design; conditional PP/GC if a pass runs.
- **GO wording available now (design phase only):** "GO — draft, test, and pin an alarm-rearm design/spec/gate package for Rowan review only. No production upload, command, report, or hold change is authorized by this GO." An execution GO cannot be worded from this proposal — it must name the future pin.

### Explicitly not proposed

- **Any fresh SubmitJob for idx 26** — prohibited; it would create a duplicate plan for the same occurrence. The preserved plan is the resume vehicle.
- **A replayed command as a wake** — source-proven non-stimulus (§2.6).
- **Malformed/unknown commands or reports without a `grantId`** — return before `wake()`; non-stimuli.
- **`deleteAlarm`** — no surface exists; deleting the registration without a re-arm design would strand the schedule outright.
- **Any hold change as part of recovery** — halt lift / queue unpause are disposition decisions, not alarm stimuli, and are excluded from every option above.

### Ranking and recommendation

By ascending durable effect: **R0 (0 writes, known-negative) → R1 (0 application rows, ≤1 conditional `setAlarm`) → R2 (1 row, ≤1 conditional `setAlarm`) → R5 (1 upload + code change, mechanism certain).** *(R3 is struck from this sequence per ruling item 4 and appears nowhere in it; it survives only as the considered-and-struck passage in §7.)*

**Recommendation:**

1. **Execute R2 first** — Rowan's ruling item 3 prefers R2 over R1 as the first diagnostic stimulus — under a separately approved execution gate with Julie's GO in the wording above, and only after its preflight verifies target-job nonexistence and a fresh `command_id`. R1 is one row smaller, but R2's single row buys a targetless stimulus whose failure mode is bounded by construction and which leaves its own durable audit receipt; R1's zero-row advantage depends on a real grant's replay state and borrows the executor's surface. R1 remains a considered alternative; do not do both in one window.
2. **If the wake probe produces no recorder row and armedAt is unchanged, do not repeat wake probes.** That outcome closes B2's cheap branch and leaves B1/B3, in which no existing surface can re-register the alarm. The remaining rung in the sequence is **R5** — the only option that directly overwrites the stale registration; Rowan has selected variant **R5a for design review only** (ruling item 5), and its design proceeds on documents alone. **R3 is struck** (ruling item 4): it is not an escalation step; revisiting it would require a fresh ruling, against the P2 deploy's negative evidence.
3. **Whichever option is chosen, the §6.2 warning rides with it:** a successful revival leaves a live, self-perpetuating chain pointed at a preserved, executable plan. The disposition of that plan (resume under a generation gate, or retirement) becomes the next required decision — it does not make itself.

---

## 8. STOP conditions (all options)

**Correction 6 preamble (ruling item 6) — governs every STOP below:** STOP prevents additional operator stimuli. **It cannot itself stop an already-revived alarm chain.** A successful recovery may continue watchdog and grant/void activity beyond the observation window, indefinitely under the holds; that continuing effect is a known, accepted-or-rejected cost of the stimulus decision itself, not something a later STOP can claw back. Containment of a revived chain is an open problem requiring a separate, independently gated procedure (none exists on shipped surfaces), and it must be explicitly addressed before any production stimulus.

- **Preflight:** any §7 preflight item differs — including armedAt ≠ A, counts ≠ 2/1, tableState ≠ "missing", any recorder row, any §6-invariant already violated. STOP; no stimulus; classify the movement first.
- **Ambiguous stimulus result:** the stimulus request errors, times out, or returns an unreadable response. STOP; verify by reads whether it landed before even considering (under a fresh GO) any repeat. **One stimulus per GO, ever.**
- **Unmatched movement:** any state change outside the §6 pre-classified set — any phase-figure movement, dispatched ≠ 0, > 1 live grant, derived reserved ∉ {0, 12}, plan state ≠ `active`, job state/revision outside the §6 cycle shapes, bindings/watermarks moved, conflicts ≠ 4 baseline, parked job fingerprint changed, quota reconcile non-`ok`, any provider contact or spend. STOP; preserve; report; no self-clearing.
- **Recorder findings:** a row with stage ≠ "complete", `driveInvoked` false on a completed stage path, or non-null error fields; or recorderHealth reporting recording failures. STOP further stimuli; the row is a finding for classification (per gate correction C4), not an automatic failure and not a success.
- **Cadence anomaly:** alarm passes arriving materially faster than the schedule arithmetic permits (e.g. sustained > 1 pass/minute) — a spinning chain is unmatched behavior. STOP; report.
- **Window expiry:** no recorder row by +35 min → the stimulus **failed**; STOP. Escalation to another option requires Rowan's ruling + a fresh Julie GO naming that option. Silence is not consent to climb the ladder.
- **Hold coincidence:** if GENERATION_HALT or the queue state changes for any reason before or during the window, the GO is **void**; read-only verification and immediate report only. No hold manipulation is authorized by any recovery GO, in either direction.

---

## 9. Step-0 procedural-variance note (required separation)

**Preserved per ruling item 7:** any later generation gate must explicitly resolve this variance — it is not waived, absorbed, or cured by anything in this document or the R5a proposal. Phase B attempt 3 proceeded under a recorded **procedural variance**: the approved procedure's step-0 grant-level verification was unsatisfiable by construction (grants issue only from a drive pass, which the step-0 preceded), and deliverable-set verification was substituted. **This proposal is about alarm revival only. It is not a generation attempt, not an Attempt 4, and does not propose one.** Nothing here resumes, re-plans, or re-prices idx 26 generation; the preserved plan's disposition and any future generation gate — which must resolve the step-0 variance explicitly, per Rowan's standing ruling — remain separate and unproposed. The §6 transition set is cited solely because a revived drive would produce it mechanically under HELD; pre-classifying it is containment accounting, not generation authorization.

---

## 10. UNVERIFIED list

1. The exact `due_at`, `kind`, and `ref` of the 2 pending schedule rows — hence whether D = A (leading, B1), D < A (B2), or D > A (B3). No shipped read surface exposes schedule rows. **Status under the ruling: UNCHANGED and load-bearing — B1 remains UNPROVEN until these due times are established (ruling item 1).**
2. Whether the platform consumed the original alarm during the 1101 fault, retains a live-but-undelivered registration, or reports a stale timestamp for a dead registration.
3. Whether a fresh `setAlarm` (same or past timestamp) issued now will be delivered for this DO — i.e., whether the defect was transient (fault-era) or persistent.
4. The general proposition that a pending alarm survives a Worker script upload unchanged — **not** stated in the retrieved documentation, and **no general documented guarantee is claimed** (ruling item 2). Only the incident-specific observation stands: this incident's reported timestamp survived the P2 deploy bit-identical.
5. The code-update strategy and adoption timing that applied to the P2 script-API upload, and that would apply to an identical redeploy (R3); whether/when the coordinator instance reset.
6. Whether the DO was active, hibernated, or inactive at the P2 deploy and at each diagnostics read (no surface reports this).
7. `getAlarm()`'s value after platform retry exhaustion (undocumented); whether the observed persistence of A implies retries never began, never exhausted, or exhausted without clearing.
8. The exact number of alarm passes (hence recorder rows) in a 35-minute revival window — schedule alignment and lease/retry interleaving make it variable; §6.1 bounds the per-pass set, not the count.
9. Causation: whether the 1101 fault caused the alarm condition (diagnostic H1) or merely coincided with it (H4). This assessment changes neither's standing.
10. The recorder's dual-failure blind spot: a pass whose SQL record **and** KV health note both fail leaves no row (gate C1 caveat) — a future "no row" result retains that ambiguity, narrowed but not eliminated by the health channel.
11. Whether attempt 3's wake actually called `setAlarm` — branch-dependent on item 1.
12. Whether ordinary request instantiation can *ever* trigger catch-up delivery of an overdue alarm on this platform — undocumented; incident evidence is negative but not exhaustive.

---

## 11. Sources

**Shipped source** (gate-assembled tree, build `86ad06ab…`): `coordinator.mjs` (constants :133–148; `handleCommand` :475–525; `requestGrant` :1805–1810; `handleReport` :2062–2219; schedule/alarm :2448–2525); `generation/service.mjs` (`driveOnce` :1008–1165; `drivePassDiagnostics` :1725–1822); `worker-entry-prod-d6.js` (recorder :424–470, :1769–1890; subclass `alarm()` :1820); `worker-entry.js` (base `alarm()` :270); `generation/quota-budget.mjs` (`reserveForGrant` :544); `generation/quarantine.mjs` (`noteHaltObservation` :296).

**Records:** P2 gate execution record (pin `0e8f802f…`); amended gate proposal §7.3 (pin `385debd9…`); stall diagnostic report §§2, 5, 6 (pin `cccfea62…`); original assessment (pin `fe224038…`); Rowan's ruling on this assessment (opal-roundtable issue #15, comment 6583967424) — code-repo records all opal-reader, branch `ui1-review`.

**Platform documentation:** D1–D5 as tabled in §1.3 (developers.cloudflare.com, crawled 2026-11-02).

— Wren, 2026-11-02. Documents only; no production action taken or authorized.
