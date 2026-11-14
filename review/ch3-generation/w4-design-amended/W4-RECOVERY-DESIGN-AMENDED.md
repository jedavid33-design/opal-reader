# W-4 RECOVERY DESIGN — AMENDED PACKAGE

**Case:** Opal Roundtable, issue #15. **Round:** W-4 diagnostic round, third filing. **Prepared on Julie's explicit go of 2026-11-14** (button tap, Coding Projects chat), in response to Rowan's design-review ruling of 2026-11-14 (handoff `RT-H-20261113-ccf694`; verbatim on the board, comment 6878405627), which accepted the first design package's direction with qualifications and required amendments A-R1–A-R7 and B-R1–B-R5 in an amended package. **Status: DESIGN PREPARATION ONLY.** Nothing in this document is implemented, deployed, or executed; no production act is proposed for authorization here. Production remains HELD (GENERATION_HALT `"1"`, queue paused, live build `ef69b8f91dad3acbed0b9c36cf3c11e238e27f72`).

**Supersession:** §§5–7 of the first design filing (pin `e5f454fdf35101b7a29f2263abfb11928b6e317a`) are superseded by §§3–9 of this package. The evidence closures (§§1–4 of the first filing) stand, as amended in §2 below. Accepted documentary findings are not reopened.

**Language law** (unchanged, per Rowan's Q-1 corrections and the 2026-11-14 ruling): "no handler execution was recorded," never "never invoked"; a `getAlarm()` value is a **reported registration** (P-REG), not proof an executable alarm is queued; a fault is described as *continuous across recorded observations*, not verified at every intervening instant; H-4 is stated as: *no application-controlled autonomous recovery path is identified in the reviewed implementation after the alarm chain ceases, absent another qualifying entry path*.

---

## 1. Amendment disposition map

| Amendment | Incorporated at |
|---|---|
| A-R1 Recovery guarantee corrected (conditional target; four stages kept distinct) | §3.4 (outcome ladder), §3.1 (guarantee statement) |
| A-R2 Concurrency safety (six named hazards; v3 recheck applicability) | §3.5 |
| A-R3 Independent scheduler observability (record outside the coordinator; six states) | §5.3 |
| A-R4 Topology and least privilege (separate scheduler Worker preferred; narrow entrypoint) | §5.1–§5.2, recommendation §5.4 |
| A-R5 Recovery authority (containment × halt × authority-expiry matrix; WAIT law) | §3.6 |
| A-R6 Cadence and cost (full inventory; free-tier feasibility as a checklist, not an assumption) | §6 |
| A-R7 Scope of detection (absent / future-dated / silent-despite-fresh classes) | §3.2 |
| B-R1 Exclude an already-live chain | §7, checkpoint 0 |
| B-R2 Witness independence (no scheduler during L-1; no disable mutation) | §7, checkpoint 2 + pre-gate condition |
| B-R3 Prove consecutive continuation (per-pass records; cadence consistency) | §7, checkpoint 4 |
| B-R4 Refined outcomes | §7, outcome definitions |
| B-R5 Closing boundary (verified census or "HELD by last verified state") | §7, checkpoint 5 |
| G-1 language correction ("continuous across recorded observations") | §2.1 |
| G-4 qualification (exact ranges; immutable source identities) | §2.2 |
| G-5 clarification (documented retry-exhaustion behavior; no Cron extension) | §2.3 |
| G-6 corollaries (repair ≠ P-DEL; recent P-REC ≠ interval health) | §2.4, enforced in §3.4 |

## 2. Evidence closures, as amended

### 2.1 G-1 — CLOSED WITH INDETERMINATE RESIDUE (language corrected)

The §1 extraction of the first filing stands, with one phrasing replaced throughout per the ruling: fault #1 was **continuous across recorded observations** between its onset bracket (2026-11-01T19:46:25Z last verified-good reads → 20:06:25Z first located primary failure) and its recovery bracket (2026-11-02T00:16:03Z last 500 → 00:26:25Z first clean run; verified form 00:31:08Z). No statement in this program implies the fault was independently verified at every intervening instant, and none implies that a particular retry sequence necessarily occurred in any incident. S-0's due time (2026-11-01T19:49:36.104Z) falls inside the onset bracket; the association is accepted; fault causation is not established; the originating pending row remains unidentified, and that uncertainty does not block recovery design (ruling).

### 2.2 G-4 — Evidence index, code rows corrected to exact ranges with source identities

The first filing's index is accepted as a documentary map; its two approximate code references are replaced here, verified firsthand against the candidate tree on 2026-11-14. **Immutable source identities:** tree = the S1 candidate tree, the deployed build's source (build `ef69b8f91dad3acbed0b9c36cf3c11e238e27f72`, deployed 2026-11-07T01:25:44Z; parts verified byte-identical to the deployed script at deploy). File SHA-256: `v2/coordinator.mjs` = `5303cb6323da01c21a5ebe9a7983f87abe08e14945660daaebce99734849e1ed`; `v2/worker-entry-prod-d6.js` = `2bb0608b589a084ca275428c3236c24680f4a4692afe2245dfcb2880257983c1`.

| Claim | Exact range |
|---|---|
| `WATCHDOG_PERIOD_MS` = `10 * 60 * 1000` | `v2/coordinator.mjs:133` |
| `ALARM_STALE_THRESHOLD_MS` = `60 * 60 * 1000` (provisional) | `v2/coordinator.mjs:144` |
| `_armAlarm()` — unconditional min-due registration; `setAlarm` at :2816 | `v2/coordinator.mjs:2790–2817` |
| `wake()` — watchdog ensure, then `_armAlarmIfEarlier` | `v2/coordinator.mjs:3200–3205` |
| `_armAlarmIfEarlier` — R5a condition at :3265 (unarmed / stale / earlier-due), v3 recheck, `setAlarm` at :3267 | `v2/coordinator.mjs:3220–3270` |
| `alarm()` — due-row processing; `finally` ensures the watchdog row (:3300–3302) and calls `_armAlarm()` (:3303) unconditionally | `v2/coordinator.mjs:3272–3305` |
| Wake-path arm call sites | `v2/coordinator.mjs:853`, `:2140`, `:2551` |
| Recorder: table DDL; health key; `_recordDrivePass` (INSERT :1914; 288-row prune :1925–1929) | `v2/worker-entry-prod-d6.js:434`, `:455`, `:1899–1937` (comment header :1888) |

The non-code rows of the first filing's index are unchanged. Per the qualification, this index is a map, not a replay of the underlying records; before any implementation verification relies on it, the cited ranges are re-verified against the implementation tree's own hashes (checklist item, §8 T-00).

### 2.3 G-5 — ACCEPTED WITH CLARIFICATIONS (one documented item added)

The **Documented guarantees** list gains the item Rowan supplied: *Cloudflare explicitly documents that exhausted alarm retries can leave an alarm without further execution until another `setAlarm()` call.* Recorded at its true strength: it supports the recovery architecture; it does **not** establish that retry exhaustion caused any Opal incident, and no statement in this package asserts that it did. The unresolved questions (post-exhaustion registration visibility, pre-handler failures, platform reconciliation) remain open and are carried into §9's inquiry. Documented alarm retry semantics are **not** extended to Cron Triggers anywhere in this package; the scheduler design in §5 relies only on the trigger firing, never on alarm-like retry behavior.

### 2.4 G-6 — ACCEPTED (distinctions mandatory in both tracks)

P-REC (recorder health), P-REG (reported registration), and P-DEL (proven delivery) remain distinct propositions, with the ruling's two corollaries enforced in this package's mechanics: **a successful repair evaluation, or an advancing P-REG, is not P-DEL** (§3.4's ladder keeps "delivery observed" and "continuation demonstrated" as separate, later-filled fields that an evaluation can never set itself); and **recent recorder health is not proof the recorder remained healthy throughout an unobserved interval** (no predicate in §§3–7 draws an interval conclusion from endpoint observations).

## 3. The shared repair evaluation — revised specification

### 3.1 What it is, and the guarantee stated at true strength (A-R1)

The **repair evaluation** is a single coordinator method, invocable from exactly two sources — the A-1 operator route (§4.1) and the A-3 scheduler (§4.2) — which examines the chain's reported state and, when a repairable condition holds and containment permits, issues **exactly one** `setAlarm(due)`. It is the only new write-capable operation this design introduces.

**Guarantee, correctly stated:** with a 6-hour scheduler cadence and the 1-hour stale threshold, an eligible stale registration *should receive a repair evaluation* within ≈7 hours of becoming eligible — a **conditional engineering target**, conditioned on the scheduler running, the coordinator being reachable, and containment and recovery authority permitting. It is not a platform guarantee, and no outcome of an evaluation is ever reported as "repaired": the four stages of §3.4 are recorded and reported separately.

### 3.2 Detection predicates (A-R7 — what the evaluation can see, and what it must not touch)

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
| Containment DRIVE_CONTAINED | Registration permitted for the watchdog cadence only (the containment arm gate already encodes this distinction; the evaluation inherits it, never re-derives it). Outcome recorded as `contained_drive` when the act is so limited. |
| Containment CHAIN_STOPPED | Declines (`contained_stop`). The arm gate suppresses every `setAlarm` path in this state; the evaluation honors it structurally, and a stop committed during an evaluation is caught by the §3.5 recheck. |
| GENERATION_HALT `"1"`, queue paused (the held state) | No effect on the evaluation — repairing the cadence under holds is the primary use case. A repaired chain produces drive passes only (the S1 window: days of passes under holds, 0 dispatches, $0). |
| Generation legitimately unhalted | The evaluation restores cadence; the chain then performs exactly the work the plans already authorize. The evaluation itself submits nothing, ever (§3.3 step 5). |
| Generation authority expired (e.g., a consumed GO) | The evaluation has no concept of generation authority and cannot extend, renew, or resurrect it. Cadence repair is not authorization: dispatch remains governed by halt, queue, and plan state exactly as without the evaluation. |
| Platform fault in progress (1101 signature) | The evaluation fails at the fetch/storage layer like every other surface — visibly, as an `error:` outcome (operator path) or a `ran; coordinator unreachable` health state (scheduler path, §5.3). Julie's WAIT law governs: no evaluation result may be recorded as a fault clearance, and the scheduler simply evaluates again next cadence. |

**Scheduled repair authority requires explicit approval before activation** (ruling A-R5): §9 sequences A-3 activation as its own Julie-approved step, after A-1 exists and its records have been observed. Nothing in this package activates anything.

## 4. Invocation sources

### 4.1 A-1 — Operator maintenance route (ACCEPTED; invoked, never autonomous)

A new operator-fenced POST route (shape precedent: the containment and phase-binding routes). Body is a closed allowlist: `{action: "evaluate_repair", authorizationRef, reason}` — `authorizationRef` required nonblank on every call (the containment POST contract's discipline). The route runs exactly one evaluation and returns its §3.4 record. It performs no other action and exposes no other verb. **Honest label, preserved from the first filing: operator-invoked recovery.** Its purpose is to replace today's improvised wake stimulus (a refused command sent for its side effect) with a purpose-built, audited, semantically honest operation, and to serve as the counted stimulus option for L-1 (§7).

### 4.2 A-3 — Scheduled invocation (the durable improvement)

A Cron Trigger fires the evaluation on a **6-hour cadence** (provisional, §6): 4 evaluations/day, each at most one registration. The trigger reaches the evaluation through the §5 topology. The scheduler's per-run behavior: write intent to its external health record (§5.3) → invoke one evaluation → complete the health record with the outcome ladder's first two stages → on later runs, fill stages 3–4 by linkage when recorder rows warrant (§3.4). A run that finds the chain healthy records `not_stale` and nothing else happens. There is no catch-up behavior: missed runs are not replayed, and a run that finds a fresh registration declines regardless of how many runs were missed.

### 4.3 A-2 — REJECTED (recorded, not specified)

Per the ruling, the piggyback mechanism is rejected as an independent recovery mechanism and is not carried into the amended design. Its one residue stands: any future non-read write path added for other reasons runs the existing R5a arm logic, as all current ones do.

### 4.4 Read purity (preserved)

No diagnostic or read surface gains a side effect under this design. The evaluation is reachable only through the two invocation sources above; the Q-5 weekly peek (§9.3) remains a pure read; no polling, synchronization, or diagnostic traffic becomes a hidden wake.

## 5. Scheduler topology and authority (A-R4, A-R3)

### 5.1 Shapes compared

- **(a) `scheduled` export on the production worker.** The generation worker's own script gains a scheduled handler that calls the coordinator's evaluation method internally. One deploy, no new credential surface, no new script.
- **(b1) Separate minimal scheduler Worker + service-binding entrypoint (Rowan's preferred investigation).** A second, tiny Worker whose only handler is the Cron Trigger; it invokes a **dedicated entrypoint** on the production worker via service binding. The entrypoint exposes exactly one operation — run the repair evaluation — and dispatches to the shared method (§3.5). No bearer credential exists: the binding itself is the authority channel, scoped by construction to that single entrypoint.
- **(b2) Separate scheduler Worker + duplicated operator credential.** The scheduler holds a copy of the general operator credential and calls the A-1 route as an external client.

### 5.2 Comparison

| | (a) in-worker | (b1) separate + binding entrypoint | (b2) separate + credential |
|---|---|---|---|
| Common-cause exposure to generation-worker deploys | **High** — every generation deploy ships the scheduler too; a bad deploy can silently take both | **Low** — scheduler script untouched by generation deploys; only the shared platform and the entrypoint's host script are common | Low (same as b1) |
| Credential surface | None new | **None** — no credential exists to leak, rotate, or duplicate | **Worst** — the general operator credential duplicated into a second script's secrets |
| Authority ceiling | Evaluation method only (internal call) | Evaluation only — entrypoint dispatches to exactly one method; cannot reach halt/queue/containment/command/provider surfaces | **Full operator authority in principle** — the route fence is the only limit; violates least privilege |
| Health-record independence (§5.3) | Weakened — the record can live in separate storage, but the writer shares fate with the generation worker's deploy cycle | **Strong** — writer is the separate script; record lives in its own storage | Strong |
| Maintenance burden | Lowest (one script) | One extra tiny script + one entrypoint on the production worker | One extra script; credential rotation now touches two scripts |
| Degradation | A generation rollback rolls the scheduler back with it | Removing or disabling the scheduler Worker returns the system to A-1-only, cleanly, at any time | Same as b1 |

Shared-platform honesty (ruling A-R4): no shape eliminates the common Cloudflare platform dependency — during a platform fault, the scheduler's invocation fails like everything else (§3.6). Shape choice buys deploy-coupling isolation and least privilege, not platform independence.

### 5.3 Scheduler health record (A-R3)

Stored in the **scheduler Worker's own storage** (a dedicated KV namespace or its own small Durable Object — final choice at implementation design; in either case, **not** inside the coordinator, and not in the production worker's storage). One record per run, intent-first (§3.5 hazard 2), retained on a rolling **90-day** window (storage at 4 runs/day is trivial). Each record carries: run timestamp; the six distinguished states the ruling requires, of which exactly one is primary per run —

1. `not_observed` — no record exists for an expected run (a *derived* state: an observer comparing expected cadence against records finds a gap; this is how a silently dead scheduler presents);
2. `ran_unreachable` — the scheduler ran; the coordinator could not be reached (fault signature recorded verbatim);
3. `declined` — evaluation completed, no act (reason carried: `not_stale`, `contained_stop`, `repair_ineffective`, …);
4. `failed` — the invocation itself errored after reachability (error surface recorded);
5. `registered_unverified` — re-registration successfully reported (P-REG value carried); delivery unverified;
6. `delivery_verified` — a later run's linkage (§3.4 stage 3) observed the subsequent pass; the only state that asserts a P-DEL fact, and it asserts it about the *earlier* run's repair.

Freshness expectation: with a 6-hour cadence, a newest record younger than 12 hours = scheduler alive at last check. **The watcher is watched:** the Q-5 weekly peek (§9.3), once A-3 exists, includes this record's freshness and latest state in its observation set, so scheduler death is detectable by the same instrument that watches the chain. Failure behavior: if the health storage itself is unavailable, the run still attempts the evaluation (recovery outranks bookkeeping) and the missing record presents as `not_observed` at the next comparison — a false-alarm-shaped failure, never a silent one.

### 5.4 Recommendation

**Adopt (b1).** It is the only shape that satisfies least privilege without a duplicated credential, it isolates the scheduler from the generation deploy cadence (the failure mode this whole round exists because of — mechanisms that share fate with the thing they watch), and its degradation path (remove the scheduler → A-1-only) is clean. Its costs are one tiny additional script and one single-purpose entrypoint carried on the production worker (which ships with the A-1 implementation, §9). This is a design recommendation for Rowan's ruling; implementation in any shape requires its own reviewed proposal and Julie's GO.

## 6. Cadence and cost inventory (A-R6)

Parameters (provisional, accepted as design parameters by the ruling): scheduler cadence **6 h**; stale threshold **1 h** (`ALARM_STALE_THRESHOLD_MS`, the deployed constant); watchdog period **10 min**.

| Consumer | Rate | Notes |
|---|---|---|
| Scheduler runs | 4/day | 1 Worker invocation + ≤1 coordinator evaluation + 2 health-record writes each |
| Repair registrations | ≤4/day, realistically ~0 | Only on a repairable predicate; each is 1 `setAlarm` + 1 `getAlarm` read-back |
| Restored watchdog cadence | ≈144 alarm invocations/day while the chain runs | The chain's **normal** operating cost — demonstrated in practice by the S1 window (passes at ~10-min cadence for days, under holds, $0 provider spend). Plus ≈144 recorder writes/day (SQL row + health write, 288-row prune) |
| Duplicate-delivery exposure | Bounded by row-state idempotence (§3.5 hazard 4) | No provider cost is possible while halted; while legitimately unhalted, restored cadence performs only plan-authorized work |
| Provider quota / Gemini | **0** | The evaluation touches no provider surface; the quota guard is not involved |

**Free-tier feasibility — a checklist, not an assumption** (ruling A-R6): Workers Free allows 100k requests/day and Cron Triggers are a free-plan feature; Durable Objects free-tier request/storage allowances and the account's **existing trigger inventory** must be established against the actual account at implementation design (named census items: current Worker cron triggers account-wide — this program has deployed **zero** to date; DO usage to date; KV/storage usage to date). Julie's standing law applies: free GitHub + Cloudflare tiers only, and any feature that would cost money is flagged before it is built. On the rates above, feasibility is *plausible*; this package does not assert it as established.

## 7. Track B — L-1 chain-liveness witness gate, revised specification

**Identity and supersession (accepted):** L-1 succeeds P-12. P-12 required *independent* resumption under passive observation; L-1 instead administers an **authorized stimulus** and witnesses **autonomous continuation**. It remains explicitly distinct from independent resumption, and its success proposition is the narrower one: *the chain accepts a registration and then continues delivering on its own.* L-1 success establishes time-bounded chain liveness only; it does not authorize generation turn-on and does not close W-4 (ruling B-R5).

**Checkpoints:**

0. **Pre-stimulus liveness exclusion (B-R1).** The census's first act compares the live recorder state against the frozen baseline named in the execution package. If any pass exists beyond the baseline, or the reported registration has advanced — i.e., the chain has spontaneously resumed — **the stimulus is not administered.** The gate ends before it begins; the unexpected recovery is returned to the Roundtable for documentary disposition. An unnecessary production mutation is not authorized merely because a gate exists.
1. **Pre-stimulus census.** Turn-on-2-grade, unchanged in strength: build/etag captured (R4), P-REG/P-REC baseline recorded, containment NORMAL, quota reconcile clean, conflicts exact, phase accounting frozen, queue paused, halt on. Any deviation = STOP under the standing executor law.
2. **Authorized, counted stimulus — exactly one.** Named in the execution package, never both: either the proven `RequestPause` probe (refused `job_not_found` as designed), or — if A-1 has by then been implemented and separately authorized — one A-1 evaluation call (its record then also exercises §3.4 in production for the first time). **Witness-independence pre-condition (B-R2):** the gate may proceed only if the continuation window is demonstrably free of external wake and repair paths — in practice: L-1 is conducted **before A-3 activation**, or, if A-3 is by then active, within a window established by cadence arithmetic and the scheduler's health record (§5.3) in which no scheduled invocation falls. **No scheduler-disable mutation is added to this gate.** If independence cannot be established, the gate does not proceed — a pre-gate STOP, before any stimulus, GO unconsumed (the stimulus ceiling is consumed only once exercised, B-R4).
3. **Immediate post-stimulus result.** A new recorder row (P-DEL) within **15 minutes** of the stimulus (the resume gate's GR-2C bound; the empirically observed revival latency is ~1.4 s), stage `complete`, `armedAfter` advanced beyond the pre-stimulus reported registration. The stimulus's own outcome (the probe's refusal receipt, or the evaluation's record) must be established — a response row without an established stimulus outcome does not satisfy this checkpoint.
4. **Autonomous continuation (B-R3).** With zero further wake-path traffic from anyone, **three further consecutive complete passes** (rows N+2, N+3, N+4) within **40 minutes** of row N+1. For **each** pass the gate record carries: row id, timestamp, completion stage, hash-chain continuity status, and `armedAfter`. Continuation is proven only if the four rows are consecutive (no gaps, no interleaved error rows), each row's `armedAfter` advances, and inter-row timing is consistent with successive self-re-arming at the 10-minute watchdog cadence — proposed tolerance for Rowan's ruling: each inter-row gap within **[5, 20] minutes**. A burst of retries or duplicate-delivery rows (gaps far below cadence) does **not** satisfy the predicate; nor does any sequence in which an external repair invocation appears in the §5.3 record or the operator log during the window — any such invocation **invalidates the witness** (outcome INCONCLUSIVE at best, §below). Diagnostic observations throughout remain strictly read-only.
5. **Closing boundary (B-R5).** Final verification: generationState halted, queue still paused, containment NORMAL, zero dispatches, zero provider attempts, phase accounting bit-identical to census, conflicts exact. **A clean terminal census is required for verified closure.** If final observations become unavailable, the gate closes as **HELD by last verified state, with terminal verification unavailable** — a verified closing census that did not occur is never claimed. The gate closes HELD regardless of outcome.

**Outcomes (B-R4, refined):**
- **SUCCESS** — checkpoint 3 and all of checkpoint 4 established; checkpoint 5 clean.
- **FAILURE** — no qualifying recorder row within the 15-minute bound, with the observation surfaces available and the stimulus outcome established. This is *failure to demonstrate revival under the gate conditions* — not categorical proof that the handler never ran.
- **INCONCLUSIVE** — checkpoint 3 satisfied but continuation not established; or the evidence cannot distinguish continuation from externally assisted recovery (including any witness-independence breach discovered after the stimulus).
- **TIMEOUT/STOP** — a 1101 signature at any read, a safety deviation, unreadable required evidence, or inability to complete required verification: suspend under the fault law and the standing STOP law; ends HELD.

**Ceiling and consumption:** exactly **1 stimulus**, consumed once exercised, regardless of outcome — no silent retry; any second attempt is a new gate under a new GO. $0 provider spend. The authorized stimulus and the chain's expected internal watchdog/recorder writes are distinguished from prohibited additional operator mutations: there are none — no other operator mutation of any kind is within the gate. The authorizing GO names a single execution window and lapses at its end. Rowan's documentary acceptance of the execution package precedes the GO request; Julie's GO precedes any use — the ordinary sequence, unshortened.

## 8. Offline acceptance-test matrix (proposed; for the future implementation)

Harness: the house harness (real node:sqlite, production `.one()` semantics). **Stated limit:** harness results never prove platform alarm delivery; the matrix verifies the evaluation's logic, records, and authority boundaries — delivery itself is witnessed only in production, by L-1's design. The implementation tree must also re-verify §2.2's ranges against its own hashes (**T-00**) and keep every standing suite green (containment 42, P2 32, R5A 23, V-3 5, S1 9 — at their current counts or their reviewed successors).

| ID | Clause | Setup → expected |
|---|---|---|
| T-00 | §2.2 | Implementation tree's coordinator/entry hashes and cited ranges re-verified → all ranges exact, or the package is corrected before review |
| T-01 | §3.2 P-STALE | Stale registration, pending rows → exactly one `setAlarm(min due)`, read-back recorded, ladder stages 1–2 set, 3–4 `unverified` |
| T-02 | §3.2 healthy | Fresh registration → decline `not_stale`, zero `setAlarm` calls |
| T-03 | §3.2 P-ABSENT corroborated | Null registration, completed last pass, null on both reads, pending rows → one registration |
| T-04 | §3.2 P-ABSENT uncorroborated | Null on first read, non-null (or a row appears) on second → decline `absent_uncorroborated`, zero registrations |
| T-05 | §3.5 v3 race | Containment stop commits during the evaluation's await (CT13 pattern, both entry tags) → no registration after the stop; outcome records the suppression |
| T-06 | §3.6 matrix | Each containment state × repairable predicate → NORMAL: act; DRIVE_CONTAINED: watchdog-only act, `contained_drive`; CHAIN_STOPPED: decline `contained_stop` |
| T-07 | §3.5 hazard 3 | Two overlapping evaluations, same stale state → combined effect is one effective registration value; both trails recorded |
| T-08 | §3.5 hazard 2 | Crash injected between registration and completion → uncompleted intent record reads "attempted, outcome unknown"; no automatic retry |
| T-09 | §3.5 hazard 6 | Three registering evaluations, no intervening row → counter at 3; fourth (scheduler source) declines `repair_ineffective`; a recorder row (or an operator invocation) resets eligibility |
| T-10 | §3.2 P-FUTURE / P-SILENT | Future-dated registration → decline, diagnostic record, no act. Fresh registration + no row within the silence window → decline, diagnostic record with full predicate values, no act |
| T-11 | §3.3 step 5 authority | Static + behavioral: the evaluation method's write set is exactly {watchdog ensure, one `setAlarm`, audit record}; attempts to reach halt/queue/containment/command surfaces from the entrypoint are refused (b1 entrypoint dispatches one method only) |
| T-12 | §5.3 states | Scheduler runs scripted against: healthy chain (`declined`), stale chain (`registered_unverified`, then next run links the pass → `delivery_verified`), unreachable coordinator (`ran_unreachable`), invocation error (`failed`), missing run (`not_observed` derived by the freshness comparison) |
| T-13 | §4.4 purity | Every diagnostic/read route exercised against a stale chain → zero registrations, zero writes (the standing read-purity assertions, extended to the new surfaces) |
| T-14 | No-dispatch invariant | Evaluation against an unhalted fixture with armed plans → the evaluation itself submits nothing; dispatch counters move only via the chain's ordinary, separately-driven operation |
| T-15 | §3.3 due computation | Row added mid-evaluation with an earlier due → the registered due is never later than the minimum read in the registration stretch |

## 9. Sequencing and authorization boundaries

1. **A-1 first** (ruling §4 preference): an implementation proposal for the shared evaluation + A-1 route (+ the (b1) entrypoint, which ships with it) may be prepared as the next documentary step **only on Julie's further go after Rowan's ruling on this package**. Implementation, when proposed, is separately gated end-to-end (review → Julie GO → deploy gate → read-back verification). A-1's production records then give the evaluation its first observed exercise.
2. **L-1 second, independently:** its execution package may name the RequestPause probe or (if it exists by then) A-1. It is prepared, reviewed, and GO'd separately, and is **never bundled** with A-3 activation. Per §7 checkpoint 2, L-1 is preferably conducted before A-3 activation.
3. **A-3 activation last, separately approved:** the scheduler Worker is deployed and its trigger activated only under its own reviewed package and Julie's explicit activation approval (ruling A-R5), after A-1's records exist and §5.3's health record has been specified to implementation depth. Deactivation/removal of the scheduler returns the system to A-1-only at any time.
4. **Platform inquiry:** Rowan's replacement wording (ruling §5) is adopted verbatim as the draft of record: *"…a Durable Object alarm's reported due time elapsed during a period when DO-backed requests returned HTTP 500 with error 1101. After the requests recovered, no subsequent alarm-handler execution was recorded for several days, while getAlarm() continued to report the same past-due timestamp. Is there documented behavior concerning (a) alarm delivery or retry exhaustion during faults that may prevent handler entry, (b) getAlarm() values after retry exhaustion, and (c) automatic reconciliation of overdue registrations? Under what circumstances, if any, is a fresh setAlarm() call necessary to restore delivery?"* Posting requires Julie's separate approval; **none is requested by this filing.**
5. **Q-5 weekly peek — status correction:** the first filing described Julie's approval as pending. **Superseded:** Julie approved the weekly read-only recorder check on 2026-11-14 and it is **running** (cron `w4-recorder-weekly-peek`, Saturdays ~9:47 a.m. ET; first observation 2026-11-14). It remains instrumentation only — never recovery authority — and, once A-3 exists, §5.3 extends its observation set to the scheduler's health record.
6. **G-3** remains a deferred, nonblocking parallel documentary investigation; nothing in this package depends on it.
7. **Untouched:** WS2/Batch; the four preserved `schedule_dead` conflicts rows; all holds; every other separately-gated item. No implementation, deployment, production stimulus, scheduled repair activation, settings change, containment transition, or generation release is authorized by this filing or requested by it.

## 10. Asked of Rowan

Documentary/design review of this amended package, in particular: (i) the §3.2 P-ABSENT corroboration rule and the §3.5 hazard-6 bound (3, provisional) — accepted, amended, or struck; (ii) the §5.4 topology recommendation (b1) and the §5.3 health-record design; (iii) the §7 cadence tolerance ([5, 20] minutes) and the pre-gate independence STOP (GO unconsumed when independence cannot be established); (iv) the §8 matrix's sufficiency as the offline acceptance basis for a future implementation proposal; and (v) whether the A-1 implementation proposal (§9 step 1) may be prepared next — preparation only, with implementation still subject to Julie's GO after review. **Turn: Rowan's**, once Julie relays. Pin: `<W4D2-PIN>` (opal-reader, branch `ui1-review`, to be filled on the filed copy).
