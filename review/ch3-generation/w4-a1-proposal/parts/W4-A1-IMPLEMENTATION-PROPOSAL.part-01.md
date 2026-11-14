# W-4 TRACK A — A-1 IMPLEMENTATION PROPOSAL

**Case:** Opal Roundtable, issue #15. **Round:** W-4 diagnostic round, fourth filing. **Prepared on Julie's explicit go of 2026-11-14** (button tap, Coding Projects chat), in response to Rowan's ruling of 2026-11-14 on the amended recovery design (handoff `RT-H-20261113-ccf694` chain; ruling verbatim on the board, comment 6878516410), which accepted the amended design with implementation conditions **IC-1–IC-7** and named this proposal as the next approved documentary direction, subject to Julie's go for its preparation. **Status: PROPOSAL ONLY.** No code has been written under this proposal's preparation, and none is authorized by it. Implementation — if ever approved — requires Rowan's documentary acceptance of this proposal, Julie's GO, and its own deploy gate, in that sequence. Production remains HELD (GENERATION_HALT `"1"`, queue paused, live build `ef69b8f91dad3acbed0b9c36cf3c11e238e27f72`).

**Language law** (unchanged): "no handler execution was recorded"; a `getAlarm()` value is a **reported registration** (P-REG); P-REC / P-REG / P-DEL kept distinct; a post-evaluation recorder row establishes *later observed delivery*, never causation by that evaluation (IC-7).

---

## 1. Implementation base and minimal change surface

**Base:** the S1 candidate tree, `~/workspace/ch2-program/s1-build/candidate-tree/` — the deployed source of the live build `ef69b8f91dad3acbed0b9c36cf3c11e238e27f72` (deployed 2026-11-07T01:25:44Z; 31 parts; manifest at `s1-build/MANIFEST.md`, recomputed and verified at the S1 gate). The implementation, when authorized, is built as a **new candidate tree copied from this base**, never by editing the base in place (the S1/B-G2 construction pattern).

**Change surface — exactly two parts change; the other 29 remain byte-identical**, verified at implementation by full-manifest diff against the base (the S1 precedent: one differing part; here two, both enumerated in advance — any third differing part is a STOP under the standing executor law):

| Part (base SHA-256) | Change |
|---|---|
| `v2/coordinator.mjs` (`5303cb63…`) | **Additive only.** (a) Two new tables in the schema DDL block, after the containment DDL (which ends at :300): `d6_repair_state`, `d6_repair_events` (§2.2). (b) An exported `readRepairState(sql)` helper mirroring `readContainmentState` (:318) — never throws, never writes, unverified reads default darker. (c) Two new methods on `GenerationCoordinator`: `evaluateAlarmRepair(...)` (§2) and `acknowledgeRepairCounter(...)` (§2.5). **No existing function is modified** — in particular `_armAlarm` (:2790–2817), `_armAlarmIfEarlier` (:3220–3270), `wake()` (:3200–3205), and `alarm()` (:3272–3305) are byte-untouched. |
| `v2/worker-entry-prod-d6.js` (`2bb0608b…`) | **Additive, plus list insertions.** (a) A route-classification constant for `POST /v2/d6-repair-evaluate`, added to the production gate's `skipClientToken` expression (:2146–2155) and to the operator-admission block's route list (:2194–2202) — insertions into existing expressions; no existing route's classification changes. (b) A class-gate branch in `OpalReaderCoordinatorProd.fetch` for the new route, following the phase-binding/containment pattern (operator-admitted stamp re-checked at :821/:879 pattern; recorded source stamped by the handler, never caller-supplied). (c) A named `WorkerEntrypoint` export, `RepairSchedulerEntrypoint`, inert by construction (§4). (d) No existing route's behavior changes. |

**Bindings/deploy spec:** the A-1 deploy carries the base's bindings unchanged, with **no** `REPAIR_SCHEDULER_ENABLED` binding defined (absent ⇒ the entrypoint is disabled, §4) and **no** scheduler Worker, trigger, or binding created. Observability is preserved through the deploy and re-verified after (the standing post-upload settings check). The script's part count stays 31; the entry remains the main module.

## 2. The shared evaluation algorithm (IC-1–IC-7 incorporated)

### 2.1 Shape and sources

One coordinator method, `evaluateAlarmRepair({ source, authorizationRef })`, where `source` ∈ `"operator-route" | "scheduler-entrypoint"` is **stamped by the calling handler in code** — it is never read from a request body, a header, or an entrypoint argument (IC-4). In the A-1 release the only reachable source is `"operator-route"` (§4 fences the other). The method returns an evaluation record (§2.6); it never throws to its caller (errors are outcomes, mirroring the recorder's discipline).

### 2.2 Persistence (write-set preview; full inventory at §5.1)

Two tables, created by the same schema DDL block that creates every coordinator table (`CREATE TABLE IF NOT EXISTS`, executed at coordinator construction as the existing tables are):

```sql
CREATE TABLE IF NOT EXISTS d6_repair_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  strike_count INTEGER NOT NULL DEFAULT 0,
  last_registering_event_id INTEGER,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS d6_repair_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL,
  kind TEXT NOT NULL,            -- 'intent' | 'completion' | 'acknowledgment'
  source TEXT NOT NULL,          -- stamped by the handler, never caller-supplied
  authorization_ref TEXT,
  predicate TEXT,                -- P-STALE | P-ABSENT | P-FUTURE | P-SILENT | NONE
  outcome TEXT,                  -- completion rows: the §2.6 outcome, or NULL on intent rows
  detail_json TEXT
);
```

Events are **append-only**: an evaluation writes an `intent` row before any act and a `completion` row after it, linked by the intent's id carried in the completion's `detail_json`. An intent with no completion is an **unresolved intent** — visible forever, counted conservatively (§2.5), never silently resolved (IC-2, IC-5's coordinator-side analogue, T-20). The strike counter lives in `d6_repair_state` and survives coordinator restarts because it is storage, not memory (IC-2).

### 2.3 Predicate precedence and the eligibility sequence

Each evaluation executes in this exact order; the first matching terminal condition ends it. (Predicate precedence, required by the ruling §10, is steps 4–8's order.)

1. **Containment read** (synchronous, `readContainmentState(this.sql)`): unverified read → decline `error:containment_unverified` (default darker, the house pattern). CHAIN_STOPPED → decline `contained_stop`. (DRIVE_CONTAINED does not decline; it constrains step 7.)
2. **HELD-state boundary conditions (IC-6)** — the initial release operates only in the held state; each condition is rechecked here and again inside the registration stretch (step 7): GENERATION_HALT binding is `"1"` (synchronous env read — the same value the entry consults at :326); containment permits (step 1); an authorization reference is present (for the operator source: the route's validated `authorizationRef`, §3; the scheduler source cannot reach this method in the A-1 release at all, §4). **Queue pause** is the one IC-6 condition with no in-Worker read surface (the queue binding is send-only — established at the first turn-on gate); it is discharged structurally: no code path in the Worker can unpause the queue (pause changes are cf-api acts outside the script), the A-1 deploy gate's census verifies the pause, and the evaluation has no interaction with the queue in either direction. The proposal names this rather than pretending a recheck exists. **Fault-response prohibition:** the operator source is invoked attended, under gate paperwork that attests no fault response is in progress; if a fault is in fact in progress the coordinator is unreachable and the call fails visibly before any of this runs — the evaluation cannot act during a fault, and no outcome it returns asserts anything about fault clearance (Julie's WAIT law).
   Any failed condition → decline `held_state_required` (with the failed condition named in `detail_json`).
3. **Strike bound (IC-2):** compute effective strikes (§2.5). If the source is not a specifically-authorized operator invocation and effective strikes ≥ 3 → decline `repair_ineffective`. (In the A-1 release there is no scheduler; the bound binds operator invocations too, except that an operator invocation carrying an authorization reference that the gate paperwork has specifically approved as a post-bound evaluation proceeds — and is recorded as such. It does **not** reset the counter by being invoked.)
4. **Registration read:** `armed = await getAlarm()` — the evaluation's **only** await before the registration stretch (all other reads are synchronous SQL/env). Everything after this await, through the `setAlarm` initiation, is the **boundary stretch** (§5.2): no further awaits occur inside it.
