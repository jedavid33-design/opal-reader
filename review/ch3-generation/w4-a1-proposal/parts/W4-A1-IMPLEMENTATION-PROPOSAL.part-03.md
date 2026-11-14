**Authorization boundary:** the route is the *only* A-1 caller of `evaluateAlarmRepair`. Possession of the operator credential admits the call; the `authorizationRef` is the audit link to the human authorization for that specific call (a gate GO, recorded on the board), and the implementation's contract is that the route is invoked only under such paperwork — the same discipline the containment transitions already run under. The route performs no other verb; there is no GET variant (state is read through the existing diagnostics/containment surfaces, keeping this route write-only and reads pure, §5.3).

**Replay/idempotence:** there is no client-supplied idempotency key and none is simulated. A repeated identical call is a second evaluation: after a successful first registration it observes the fresh registration and declines `not_stale`; before one, it is a second act, recorded as such and counted by §2.5. Callers are operators under paperwork that counts calls; the record makes any double-call visible rather than absorbing it silently.

## 4. Dedicated entrypoint disposition and activation fence (IC-4)

**Disposition:** the A-1 implementation **includes** the named entrypoint in the production script — `export class RepairSchedulerEntrypoint extends WorkerEntrypoint` in `v2/worker-entry-prod-d6.js` — with exactly one method, `async evaluate()`, which takes **no arguments** and calls the coordinator stub's `evaluateAlarmRepair({ source: "scheduler-entrypoint", authorizationRef: null })`. It ships **inert**, fenced four ways, each verifiable in the implementation review (T-23):

1. **Flag fence:** `evaluate()` first reads `this.env.REPAIR_SCHEDULER_ENABLED`; unless it equals `"1"`, the method returns `{ status: "disabled" }` without touching the coordinator. The A-1 deploy spec **does not define this binding** — absence is the disabled state, and defining it is an act of the A-3 activation package, not of any deploy in this proposal's scope.
2. **No caller exists:** no scheduler Worker, Cron Trigger, or service binding to this entrypoint is created by the A-1 implementation. A binding that does not exist cannot invoke; activation requires creating the scheduler *and* defining the flag — two separate, visible acts, both reserved to A-3's own approved package.
3. **Router isolation:** the entrypoint is reachable only through a service binding's RPC channel. The public `fetch` handler routes only its enumerated HTTP paths; no path dispatches to the entrypoint, and the entrypoint is not a fetch handler (verified by T-23's public-path probes).
4. **No caller-supplied anything:** the method accepts no arguments — no commands, no coordinator identity (the stub is the account coordinator, obtained exactly as the fetch handler obtains it), no source tag (hardcoded), no authorization reference (the scheduler's authorization basis is A-3's to establish; in the A-1 release the flag fence means the question never arises in practice).

**Removal safety (IC-4):** because nothing binds the entrypoint in the A-1 configuration, deleting the scheduler later — or never creating it — leaves A-1 exactly as deployed; and the entrypoint's own deletion in some future build touches nothing else (no other code references it). Shipping the entrypoint does not silently activate its future caller: fences 1 and 2 are both required to fail before a scheduled evaluation could occur, and each is a separately approved act.

## 5. Complete write-set and concurrency specification

### 5.1 Write-set inventory (IC-7 — complete, nothing under "bookkeeping")

Per single evaluation, the **complete** set of persistent writes the new code can perform:

| Write | Where | When |
|---|---|---|
| `d6_repair_events` INSERT (`intent`) | Coordinator SQL | Inside the boundary stretch, before the act (registering evaluations only) |
| `setAlarm(due)` | DO storage | The act itself (registering evaluations only) |
| `d6_repair_events` INSERT (`completion`) | Coordinator SQL | After the read-back (registering evaluations); diagnostic/decline evaluations write a single completion-shaped event with no intent |
| `d6_repair_state` UPDATE (strike counter + last registering event) | Coordinator SQL | With the completion write of a registering evaluation |
| `schedule` INSERT (watchdog row ensure) | Coordinator SQL | Only when no watchdog row is pending — the identical write `wake()` performs |
| `d6_repair_events` INSERT (`acknowledgment`) + `d6_repair_state` UPDATE | Coordinator SQL | Only from the `acknowledge_repair_counter` verb, under its own authorization |

And the negative inventory, asserted for verification (T-11): **no** writes to `ledger_ops`, quota or phase accounting, `jobs`, `grants`, `outbox`, `settings`, `commands`, `d6_containment_*`, `d6_drive_passes`, the queue, any R2 object, or any settings/binding surface; **no** `deleteAlarm` anywhere in the new code. The entrypoint adds no writes of its own in any configuration. (The A-3 scheduler's future health record lives in the scheduler's own storage and is inventoried in A-3's package, not here; §7 phases its tests accordingly.)

### 5.2 Concurrency: the shared serialization discipline (IC-3)

**The strategy — one discipline, uniformly applied, no new locking mechanism.** The coordinator is a single Durable Object; its methods interleave only at `await` points, and its SQL reads/writes (`this.sql.exec`) are **synchronous**. Every alarm registration in the system is therefore required to satisfy the same invariant, which the existing code already embodies and the evaluation adopts in its strongest form:

> **Boundary invariant:** a `setAlarm` may be initiated only inside a synchronous stretch in which (i) the containment gate has been read **within that stretch**, (ii) the due has been computed from a synchronous minimum-`due_at` read **within that stretch**, and (iii) no `await` separates those reads from the initiation. Any value that can only be obtained asynchronously (the reported registration, via `getAlarm()`) is read **immediately before** the stretch, with only synchronous operations between its resolution and the initiation.

Per-path conformance, from the base source:

| Registration path | Stretch composition |
|---|---|
| `_armAlarm` (handler re-arm) | Due from synchronous SQL (:2791–2793); gate read and initiation in one stretch, no await between (:2812–2816) — the source's own comment states the invariant (:2798–2802) |
| `_armAlarmIfEarlier` (R5a wake paths) | Gate read → the single `await getAlarm()` (:3246) → synchronous re-check of the gate and initiation (:3259–3267) — the v3 pattern |
| `evaluateAlarmRepair` (new) | All eligibility reads synchronous except the single `await getAlarm()` (step 4); the stretch then **re-reads containment, re-reads GENERATION_HALT, recomputes due from a fresh synchronous minimum-`due_at` read, writes the intent row, and initiates** (step 7) — every synchronously re-readable input is re-read inside the stretch, a strictly stronger form than either existing path |

**Why this discharges IC-3's list:**
- *Repair evaluations vs. each other:* two overlapping evaluations both read the same stale registration before their stretches; their stretches cannot interleave (each is synchronous), so they execute in some order; the second stretch's fresh minimum-`due_at` read sees any schedule effects of the first, and its registration — if it still initiates — uses a due computed from current rows. Two `setAlarm` calls remain two acts (Rowan's correction, accepted): both are recorded, both counted by §2.5, and neither can overwrite with a due *later* than the current minimum pending due — the only overwrite hazard IC-3 names (a valid **earlier** registration established after initial observation) is answered by the stretch's fresh due computation plus the predicate's direction: the evaluation registers only a due ≤ the stale value it read, and any registration established in between was itself for the then-current minimum due, which the stretch's fresh read now reflects — if that minimum has moved earlier, the evaluation's due moves with it; if it has moved later (rows processed), the evaluation's due is that later minimum, which is the correct current target, and the in-between registration targeted the same rows' earlier state. The residual below names what this does not cover.
- *Ordinary R5a wake paths and handler re-arming:* unchanged code, same invariant; the evaluation adds no new interleaving class because its only pre-stretch await is the same `getAlarm()` the wake path already awaits.
- *Pending-row changes:* rows are inserted by synchronous SQL inside other operations' own stretches; a change either precedes the evaluation's stretch (visible to its fresh reads) or follows its initiation (handled by that operation's own arming, or the handler's unconditional re-arm).
