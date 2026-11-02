# Phase B — independent containment design (stopping a revived alarm chain)

**Status: DESIGN ONLY. NO CODE IN THIS ROUND.** Prepared under
Rowan's R5a revision ruling (board comment `6584187105`,
`jedavid33-design/opal-roundtable` issue #15, 2026-11-02):
*"holds and rollback alone are not sufficient for production
revival. Design an independently gated stopping/containment
mechanism addressing alarm registration, pending schedule, in-flight
passes, and preserved-plan grant activity. STOP alone halts operator
stimuli, not the chain."*

Nothing here authorizes any production action. This mechanism would
be built, reviewed, and deployed under **its own gate**, sequenced
**before** any R2 or R5a stimulus (see §7).

**Source basis:** the live instrumented build's tree
(`p2-gate-execution/build/deploy-tree/`), verified firsthand. Key
placement facts:

- The only caller of `driveOnce` is the subclass alarm handler,
  `worker-entry-prod-d6.js:1820`: `super.alarm()` (base coordinator
  alarm: pending-schedule processing, then an unconditional re-arm
  in a `finally` via `_armAlarm()`) → construct cache/coordinator/
  service → `service.recover()` → `service.driveOnce()` → cache
  flush. The P2 recorder runs last on both paths and performs no
  alarm or schedule writes.
- The subclass and the coordinator share **the same Durable Object
  SQLite database** (the coordinator is constructed over
  `this.state` in the handler; the recorder's lazily-created
  `d6_drive_passes` table already lives there and is read back
  through the coordinator's storage).
- `deleteAlarm()` is part of the storage interface the coordinator
  already documents (coordinator.mjs:19) but **no shipped code path
  calls it**.
- Generation is additionally fenced by `GENERATION_HALT`
  (host/adapters.mjs:86; grant-guards.mjs): while halted, no grant
  can leave the outbox — but grant **issuance** is not halt-fenced,
  which is why a revived chain cycles grants (§7.3 of the R5a
  paperwork) even under the holds.

---

## 1. Candidate mechanisms, evaluated against the deployed code

### (a) Drive-disable flag checked before driveOnce — **CHOSEN (Layer 1)**

A durable flag in the DO's own SQLite (lazily-created additive
table, e.g. `d6_containment (id=1, drive_disabled, set_at,
set_by_ref)`), read in the subclass handler **after** `super.alarm()`
and **before** `recover()`/`driveOnce()`. When set: the handler
skips recover+drive, records the pass with a distinct recorder stage
(`contained`), and returns normally.

- *What continues:* the base alarm still runs — pending schedule
  rows are processed (leases expire → in-flight grants are **voided
  by the lease path**, i.e. grant closure proceeds), row-failure
  backoffs apply, and the `finally` re-arm still fires, so the
  watchdog perpetuates and the alarm registration stays alive.
- *What stops:* all new grant issuance, all plan advancement, all
  drive-side state churn. Passes become observe-only ticks.
- *Why this placement:* it is the single choke point through which
  every drive pass must flow (driveOnce has exactly one caller);
  the flag shares the database both classes already use, so no new
  storage surface or cross-object call is needed; and the recorder
  — already wired at exactly this point — makes every contained
  pass visible.

### (b) Schedule-row draining via an operator route — **REJECTED as the mechanism** (retained as a disposition tool)

Marking pending schedule rows done/cancelled empties the schedule,
but it does not stop the chain and it destroys evidence:

- The base `finally` computes D from the remaining rows; with an
  empty schedule the fallback is `now + WATCHDOG_PERIOD_MS`, so the
  alarm **re-arms anyway** — draining changes the cadence, not the
  liveness.
- The next `wake()` (any command/report) inserts a fresh watchdog
  row (coordinator.mjs `wake()`), repopulating the schedule.
- Draining deletes the pending rows whose `due_at`/`kind`/`ref` are
  themselves diagnostic evidence for the B1/B2/B3 question — the
  investigation's central unknown. A containment mechanism must not
  consume the evidence it exists to protect.

### (c) deleteAlarm via a new operator route — **CHOSEN as Layer 2's registration action, INSUFFICIENT ALONE**

`deleteAlarm()` removes the current registration in one call. But
on shipped code it resurrects immediately: any later command or
report calls `wake()` → `_armAlarmIfEarlier()`, and with armed now
`null` the shipped condition registers at D from the surviving
schedule rows. Under revised R5a the same is true a fortiori.
deleteAlarm is therefore only a chain-stop when **paired** with a
gate on the re-arm paths (§2, Layer 2). It is also the only action
that addresses the *registration* itself rather than pass behavior,
which the ruling explicitly lists — hence Layer 2 rather than
rejection.

### (d) Grant-level containment — **NOT the mechanism** (interaction stated)

Voiding or finalizing an in-flight grant (the existing finalizer is
separately gated and has been used exactly once) treats one grant;
the chain issues the next on the following pass (the §7.3 cycle).
Grant-level tools remain the disposition path for any specific
grant a revived chain creates, under their own gates; they are not
a chain stop and this design does not propose widening them.

## 2. The chosen design: two layers, one flag

**One durable flag** (as in (a)) with **two effects at two depths**:

- **Layer 1 — drive containment (flag set).** Subclass handler:
  after `super.alarm()`, if the flag reads set → skip
  `recover()`/`driveOnce()`, record the pass at stage `contained`,
  return normally. Schedule processing, lease-driven grant closure,
  and the `finally` re-arm all continue. The chain stays alive but
  inert: no new grants, no plan movement, no spend path (dispatch
  remains independently halt-fenced in any case).
- **Layer 2 — chain stop (flag set + operator action).** While the
  flag is set, the coordinator's re-arm paths are gated: `_armAlarm()`
  (the base `finally`) and `_armAlarmIfEarlier()`/`wake()` check the
  same flag and skip `setAlarm` when it is set. An operator route
  (`POST /v2/d6-containment`, operator-gated like the other d6
  operator routes, credential-less calls refused) then performs
  `deleteAlarm()` — with the wake paths gated, no later command or
  report can resurrect the registration. The chain is fully stopped:
  no registration, no passes, no schedule processing. Pending
  schedule rows are **left in place** (evidence preserved; they are
  inert without passes, and their disposition is a separate,
  later decision).

**Setting/clearing the flag** is the same operator route
(`action: "set" | "clear" | "stop_chain"`), each call an auditable
mutation with a caller-supplied authorization reference, mirroring
the shipped operator-route discipline. Clearing the flag does **not**
itself re-arm anything: the next wake or pass re-arms through the
ordinary paths (under revised R5a, a stale armed value is exactly
what the recovery design handles). Containment deployment therefore
does not create a new revival path.

**Interaction with the holds.** The flag is independent of
`GENERATION_HALT` and the queue pause: it works if the holds are
lifted, works while they stand, and its verification (§4) does not
rely on them. The holds remain in force for their own purposes;
containment is the mechanism the ruling asked for *in addition*.

## 3. Precision table — what containment does and does not do

| chain activity | contained (Layer 1) | chain-stopped (Layer 2) | bounded how |
|---|---|---|---|
| alarm registration (`setAlarm` by wake paths) | continues (ordinary arming) | **stopped** — re-arm paths gated by the flag | flag check inside `_armAlarm`/`_armAlarmIfEarlier` |
| alarm registration (base `finally` re-arm) | continues | **stopped** — same gate | same flag |
| pending schedule processing (per pass) | continues — leases expire, rows advance | stops (no passes run) | rows preserved in place either way |
| in-flight grant closure (lease-expiry void) | continues — closure proceeds | frozen mid-state until a pass runs again | the shipped lease path (`LEASE_MS` 900,000) |
| new grant issuance (`driveOnce`) | **stopped** — drive skipped | stopped | flag check before `driveOnce` |
| plan advancement / occurrence transitions | **stopped** | stopped | drive is the only advancer |
| provider dispatch | stopped (already halt-fenced; drive also stopped) | stopped | `GENERATION_HALT` wiring + drive skip — two independent fences |
| a pass already inside `driveOnce` when the flag is set | **cannot be interrupted** — runs to completion | same | worst case = the §7.3 pre-classified set for one pass: ≤1 grant issued, derived reserved 0→12, ≤12 attempts for the occurrence (`SEGMENT_ATTEMPT_BUDGET`), per-attempt upper 12,803 units, occurrence ceiling 153,636 units ≈ $0.154; dispatched stays 0 while the halt wiring stands |
| a provider dispatch already sent | cannot be recalled | cannot be recalled | unreachable under current holds (dispatch is halt-fenced); if holds were lifted, bounded by the same per-occurrence ceiling |
| recorder rows | continue — contained passes recorded at stage `contained` | stop (no passes) | 288-row cap unchanged |
| wake traffic (commands/reports) | processed normally; no drive effect | processed normally; cannot resurrect the registration | flag gate on the re-arm paths |

## 4. Verification of containment

Containment is verified from shipped surfaces, not asserted:

1. **Recorder rows:** after the flag is set, every subsequent drive
   pass row reads stage `contained` with `driveInvoked = 0` — read
   via `drive=1` on `GET /v2/d6-diagnostics`. Passes continuing to
   arrive at the contained stage prove the chain is alive-but-inert
   (Layer 1).
2. **Registration state:** `drive=1` exposes `getAlarm()` and
   pending-schedule counts. After a Layer 2 stop: `getAlarm()` reads
   null and stays null across a deliberate ordinary command (a
   read-only-safe command is *not* sufficient — commands wake; the
   verification uses a commands-row readback + a subsequent `drive=1`
   read showing armed still null, proving the wake gate held).
3. **Grant state:** `GET /v2/d6-plans` + jobs reads show the
   preserved plan's totals, the single entry's disposition, and
   grants [] — byte-compared against the pre-containment census.
4. **Negative check:** no new rows in `d6_drive_passes` after the
   Layer 2 stop across a window longer than the watchdog period
   (10 min) — no passes are running.

## 5. Failure modes — fail-closed for drive, and why

| failure | behavior | rationale |
|---|---|---|
| flag **write** fails (set/stop call errors) | the operator call returns the error; containment is reported **not set**; verification (§4) is mandatory before anyone relies on it | a containment claim must never rest on an unverified write |
| flag **read** throws in the handler | **fail-CLOSED for drive**: treat as contained — skip `driveOnce`, record an error-stage row, return normally (no throw → no platform retry storm) | a read failure during an incident is precisely when an unstoppable drive is worst; skipping drive is reversible and loses nothing (passes are idempotent ticks); the base alarm + re-arm are NOT gated on this read, so the chain cannot be killed by a transient read error |
| flag read throws in a re-arm path (Layer 2 gate) | fail-**open** for arming (arm as shipped) | arming is the liveness path; a chain that cannot re-arm because of a storage hiccup recreates the original incident. Drive stays contained by the handler's own read |
| flag set while a pass is mid-`driveOnce` | the pass completes (§3 bound); the *next* pass is contained | no mid-pass interruption exists in this architecture |
| flag table missing (pre-bootstrap) | treated as unset; the table is created lazily by the first containment call, DDL-only and idempotent (the recorder-table pattern) | deployment must not change behavior before first use |

**Recommendation: fail-closed for drive, fail-open for arming** —
the asymmetry is deliberate: drive is where irreversible effects
(grants, spend paths) live; arming is how the system recovers.

## 6. Mutation budget (containment's own, when its gate comes)

- Build/deploy: 1 upload (+ ≤1 conditional observability PATCH);
  conditional rollback 1 upload (+ ≤1 conditional PATCH). The
  change spans the entry part (handler check + recorder stage) and
  the coordinator part (re-arm gates) plus one operator route —
  footprint to be pinned by its own spec before any gate.
- Runtime: flag set = 1 row write; stop_chain = 1 row write + 1
  `deleteAlarm()`; clear = 1 row write. No schedule rows are
  created, modified, or deleted by containment. No grants, commands,
  or plan rows are touched.
- Verification reads are GET-only.

## 7. Gate skeleton (containment's own gate — for Rowan review, not approved)

1. Census identical in form to the R5a gate's (build, holds, queue,
   preserved plan, conflicts baseline, phase figures).
2. Build verification against a pinned containment candidate +
   battery re-run on the exact tree (containment scenarios join the
   battery at build time — they are design-only in *this* round
   precisely because no containment code exists yet).
3. Deploy; ends HELD; **no stimulus of any kind in the containment
   gate.**
4. Verification: set Layer 1 via the operator route; observe ≥1
   contained recorder row **only if** a pass happens to run (none is
   provoked); Layer 2 stop is **not** exercised against the live
   chain in the deployment gate — its first live use is itself a
   gated decision, because stopping the chain is a state change the
   investigation may not want before a stimulus.
5. Sequencing rule for all later gates: **no R2 or R5a stimulus may
   be executed until containment is deployed and Layer 1 verified
   available** — a revived chain must never be without a tested
   stop.

## 8. What this design does not do

- It does not disposition the preserved plan, the exemption, any
  grant, or any schedule row — all remain under their existing
  holds and separate gates.
- It does not revive anything; clearing containment is not a wake.
- It is not built: no candidate, no tests, no pin in this round.
  Its scenarios are design-verified only and are listed as an
  evidence gap in the package summary.
