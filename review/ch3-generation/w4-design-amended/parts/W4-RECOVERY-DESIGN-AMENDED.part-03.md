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

