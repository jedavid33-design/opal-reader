Inputs read at evaluation start: containment state; reported registration (`getAlarm()`); pending-row census (minimum `due_at`, watchdog-row presence); the latest recorder row and recorder health; the repair-ineffectiveness counter (§3.5, hazard 6).

- **P-STALE (repairable):** registration non-null and `armedAt ≤ now − ALARM_STALE_THRESHOLD_MS`. The S-0/S-1/S-2 class.
- **P-ABSENT (repairable only when corroborated):** registration null **and** pending rows exist. A bare null never authorizes registration — `getAlarm()` also returns null while a handler is running (A-R2 hazard 1). Corroboration requires: the latest recorder row is stage `complete` (no pass in flight), **and** the null persists on a second read taken within the same evaluation after the pending census (two reads, one evaluation), **and** no recorder row has appeared between them. Scheduler-path evaluations apply the same rule; there is no weaker scheduler variant.
- **P-FUTURE (diagnostic-only):** registration non-null and `armedAt > now + WATCHDOG_PERIOD_MS + 60,000` (an unexpectedly future-dated registration). The evaluation records the observation and declines: registering an earlier due would fight a registration that may be entirely valid, and no incident in evidence exhibits this class.
- **P-SILENT (diagnostic-only):** registration fresh (not stale) but no recorder row within `2 × WATCHDOG_PERIOD_MS + 300,000` ms — P-DEL silence despite apparently fresh P-REG (the H-2 divergence shape). Diagnostic-only by design (ruling A-R7): automatic repair authority is not broadened to cover an unproven failure mode. The observation is recorded with its full predicate values so the class accumulates evidence.
- **Healthy / not-stale:** decline, outcome recorded. An evaluation against a live chain is a pure no-op apart from its records.

### 3.3 The registration act (when a repairable predicate holds and containment permits)

1. Ensure a pending watchdog row exists (the `wake()` pattern, coordinator.mjs:3200–3205).
2. Compute `due` = minimum pending `due_at`; if none, `now + WATCHDOG_PERIOD_MS` (the `_armAlarm` fallback, :2790–2817).
3. Re-read the containment gate **in the same synchronous stretch** that initiates `setAlarm(due)` (the v3 pattern, §3.5).
4. Issue exactly one `setAlarm(due)`; then read back `getAlarm()` and record the value as *re-registration successfully reported* (a P-REG statement only).
5. No other write is permitted to this method: its complete write set is the watchdog-row ensure, one `setAlarm`, and its audit/health records (§3.4). It has no path to halt, queue, containment-transition, command, or provider surfaces — a structural property of the method, verified by the test matrix (§8, T-11).

### 3.4 Records and the outcome ladder (A-R1, A-R3 in part)

Every evaluation writes an **audit record inside the coordinator** (append-only, alongside the containment audit family) containing: timestamp; invocation source (`operator` | `scheduler`); predicate found (with its input values); containment state observed; action taken or decline reason; and the four-stage ladder, each stage separately valued:

1. **Evaluation attempted** — always set, at initiation. An *intent* record is written **before** any registration (§3.5, hazard 2), and completed after; an intent record that is never completed reads as "attempted, outcome unknown," never as success.
2. **Re-registration successfully reported** — the post-act `getAlarm()` read-back value, or null.
3. **Subsequent delivery observed** — **never set by the evaluation itself.** Filled later, by linkage: when a recorder row appears whose `at` follows the evaluation and whose `armedAfter` is consistent with the re-registration, an observer (the weekly peek, a gate census, or a subsequent evaluation) may link it. Until then the field reads `unverified`.
4. **Autonomous continuation demonstrated** — filled only by an observed sequence of ≥2 further consecutive complete passes after the linked delivery (the same shape L-1 witnesses, §7). Until then, `unverified`.

Decline/failure reasons are a closed list: `not_stale`, `contained_drive` (watchdog-only registration performed under DRIVE_CONTAINED — an action, recorded as such), `contained_stop`, `future_dated`, `silent_fresh`, `absent_uncorroborated`, `repair_ineffective` (§3.5 hazard 6), `error:<surface>`.

### 3.5 Concurrency specification (A-R2)

Alarm overwrite semantics alone are **not** claimed as concurrency safety. The specification answers each named hazard:

1. **`getAlarm()` null during an active handler** — P-ABSENT's corroboration rule (§3.2): two reads, a completed latest pass, and no intervening row. If a handler is in fact running, its `finally` re-arms unconditionally (coordinator.mjs:3298–3304), so the worst case of a corroborated-but-wrong evaluation is one redundant `setAlarm` at the same min-due the handler's own re-arm would choose — absorbed by overwrite semantics and recorded in both trails.
2. **Registration succeeds, audit write fails** — ordering is intent-first (§3.4): the intent record precedes the act, completion follows the read-back. A crash between act and completion leaves an uncompleted intent — visible, classified "attempted, outcome unknown," and never silently retried by the same invocation. For the scheduler path, the external health record (§5.3) is written with the same intent-first discipline in the scheduler's own storage, so the attempt is observable even if the coordinator is unreachable from that moment on.
3. **Duplicate or overlapping scheduled invocations** — no lock is claimed. Evaluations are predicate-idempotent: a second evaluation that begins after the first's registration observes a fresh registration and declines `not_stale`; one that begins before observes the same stale predicate and may register the same `due` — the same value the first chose, since `due` is recomputed from the same pending census (§3.3 step 2) — an overwrite with an identical value, recorded in both trails. Outcomes remain distinguishable per invocation.
4. **Late delivery of the original alarm** — if the platform delivers a supposedly lost alarm after a repair registration, the handler processes rows by state; dispatch is plan-state-driven, never alarm-count-driven, so no work is duplicated. The recorder's row sequence is the arbiter of what actually ran, and the evaluation's ladder linkage (§3.4) tolerates the delivery being attributable to either registration — it records delivery *observed*, not delivery *caused by this evaluation*.
5. **Pending-schedule changes during evaluation** — `due` is computed inside the registration stretch from a fresh minimum-`due_at` read, mirroring `_armAlarm`'s own structure; the evaluation never registers a due later than the minimum it read in that stretch. A row added mid-evaluation with an earlier due is armed by its adder's own wake path (every such path arms), or witnessed by the next evaluation; it cannot be stranded by this evaluation's act.
6. **Repeated repair against a persistently unhealthy chain** — bounded twice: by cadence on the scheduler path (≤4 evaluations/day), and by a **repair-ineffectiveness counter**: consecutive evaluations (either source) that register without an intervening recorder row increment it; at **3** (proposed bound, flagged provisional for Rowan's ruling), scheduler-path evaluations decline with `repair_ineffective` and record an escalation observation, until a recorder row appears or an operator-path evaluation resets the counter by being invoked (human judgment re-enters explicitly, and its invocation is itself recorded). The operator path is never blocked by the counter — but every evaluation's record carries the counter's value, so a human is never shown a repair history with the strike count hidden.

**v3 recheck applicability:** the registration stretch executes *inside* the coordinator object, in the same structural position as `_armAlarmIfEarlier`'s recheck (coordinator.mjs:3254–3267): gate read and `setAlarm` initiation in one synchronous stretch, no intervening await. Both invocation sources converge on this one method (the operator route calls it as a DO method; the scheduler reaches it through the §5 entrypoint, which dispatches to exactly this method), so the race proof obligation is discharged **once**, for the shared method — and the acceptance matrix (§8, T-05) re-runs the CT13-pattern race with the new entry tags to prove the recheck's applicability rather than assert it.

### 3.6 Containment, halt, and authority matrix (A-R5)

| Condition | Evaluation behavior |
|---|---|
| Containment NORMAL | Full §3.3 act permitted on a repairable predicate. |
