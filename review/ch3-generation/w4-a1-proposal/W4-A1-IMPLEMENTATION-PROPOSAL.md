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
5. **P-STALE** (the initial release's only repairable predicate, IC-1): `armed !== null && armed <= now − ALARM_STALE_THRESHOLD_MS`, with `now` re-read inside the stretch and the comparison at the deployed constant's own semantics (`<=`, coordinator.mjs:3265) — equality is stale (boundary case, T-30).
6. **Diagnostic-only classes** (recorded with full predicate values; never an act): **P-ABSENT** (`armed === null` with pending rows present — IC-1: diagnostic-only in this release; its observation fields are retained for future evidence), **P-FUTURE** (`armed > now + WATCHDOG_PERIOD_MS + 60,000`), **P-SILENT** (registration fresh but the latest recorder row — read defensively: the `d6_drive_passes` table is created by the entry part, and a construction lacking it reads as "no rows" — is older than `2 × WATCHDOG_PERIOD_MS + 300,000`, or absent). A healthy chain (registration fresh, recent pass) → decline `not_stale`.
7. **The registration act** (only from step 5, and in DRIVE_CONTAINED only for the watchdog due): inside the boundary stretch, in order — re-read containment synchronously (the v3 recheck, verbatim pattern); re-read GENERATION_HALT synchronously; compute `due` from a **fresh synchronous** `MIN(due_at)` read over pending schedule rows (watchdog-row ensure first if none is pending, the `wake()` pattern :3200–3205; fallback `now + WATCHDOG_PERIOD_MS`); write the `intent` event row (synchronous SQL — deliberately placed inside the stretch so the intent precedes the act with no intervening await, IC-5's coordinator analogue); initiate `setAlarm(due)` — the stretch's final act. Then, after the stretch: read back `getAlarm()` and write the `completion` row with the outcome and the read-back value.

### 2.4 What the act may never do

The method's complete write set is §5.1's inventory. It cannot lift the halt, unpause the queue, transition containment, submit or alter any command/job/plan, touch quota or phase ledgers, or call any provider surface — structurally: it references none of those surfaces, which the implementation verifies statically and behaviorally (T-11). In the held state a repaired chain produces drive passes only (sendGrant is not wired while GENERATION_HALT is `"1"`, entry :326/:343 pattern) — stated as an observation about the held configuration, **not** as a harmlessness argument (IC-6): the release is scoped to the held state precisely because the unhalted authority model is not yet demonstrated, and step 2's rechecks are what keep it there.

### 2.5 The strike counter (IC-2, as amended)

- **Counts** registering evaluations only: an evaluation that reaches step 7 and initiates `setAlarm` increments the counter (the increment is part of the completion write; an evaluation whose completion write fails leaves an unresolved intent, which counts as registering until resolved — conservative accounting).
- **Effective strikes at step 3** = registering evaluations (completed + unresolved) since the last **qualifying complete recorder pass** (a `d6_drive_passes` row with stage `complete` and `at` after the most recent registering evaluation), computed from the events table and the recorder table at evaluation time. A qualifying pass therefore resets the count **automatically and only** (IC-2) — no code writes a reset at pass time; the reset is a derivation, which is why a pass the evaluation cannot see (missing table, §2.3 step 6) can never reset it.
- **Manual reset** exists only as the separate coordinator verb `acknowledgeRepairCounter({ authorizationRef, reason })`, exposed on the same operator route as a distinct action (§3): it appends an `acknowledgment` event and zeroes the counter, is **never** invoked implicitly by an evaluation, and each use requires its own specific authorization, recorded with its reference (IC-2). Declined or failed evaluations never touch the counter in either direction; operator-route invocation alone never resets it (the amended design's withdrawn provision is not reintroduced).
- **Concurrency:** the counter's read and the bound check occur before the await (step 3) and the increment is a single synchronous SQL statement inside the completion write; two overlapping evaluations can both pass the bound check only if both then register — each registration increments, so the count after them reflects both acts, and the *next* evaluation sees the true total (T-18 tests exactly this; the bound is on consecutive ineffective registrations as recorded, not a lock).

### 2.6 The evaluation record (IC-7)

The completion row and the route response carry: evaluation id (the intent row's id); source; timestamps (evaluation start; registration initiation; read-back) kept separate; predicate found with its input values (reported registration, threshold, `now`, latest pass id/at, pending counts); the outcome — one of `registered`, `not_stale`, `contained_stop`, `contained_drive`, `held_state_required`, `repair_ineffective`, `diagnostic_only:<class>`, `error:<surface>`; and the ladder's first two stages kept distinct per IC-7: **`setAlarm` call completed** (the initiation resolved without throwing) versus **registration reported afterward** (the read-back value, which may be null — a null read-back is recorded as `readback_null` and proves neither success nor failure of delivery, or of the call's platform effect). Stages 3–4 (delivery observed; continuation) are **not fields this method writes**: delivery and continuation are derived and reported **externally** by read-only observation (the weekly peek, a gate census), per IC-7's linkage rule — persistent annotation inside production would require its own authorized write path, and none is proposed here. Where the amended design's ladder language survives, routine external observation of two further passes is labeled **routine observed continuation**, never L-1 certification.

## 3. Operator route contract and authorization boundary

**Route:** `POST /v2/d6-repair-evaluate`. It joins the existing operator fence class, in all three places that class is enforced (no new fence is invented):

1. **Production gate (entry fetch):** the client token is skipped for this route (admission is on the migration-operator credential alone), exactly as for the phase-binding and containment routes.
2. **Operator admission (entry fetch):** the `x-opalreader-operator-token` header must equal the configured migration-operator credential, else HTTP 403 `migration_operator_required`; a missing/misconfigured credential pair yields 503 `migration_operator_not_configured` (the :2203–2208 pattern, inherited unchanged).
3. **Class gate (DO class):** the handler re-checks the operator-admitted stamp (`x-opalreader-operator-admitted`), else 403 `migration_operator_required` (the :821/:879 pattern). Credential-less and client-token-only calls are refused; the everyday client build has no path to this surface. The production scope/instance headers are required as for every `/v2/*` route.

**Request bodies — written in full** (standing lesson of 2026-11-05: operator transition bodies are never abbreviated in gate paperwork). The body is a closed allowlist; any other key, a missing required key, or an unknown action is refused HTTP 400 `repair_body_not_allowed` **before** any coordinator state is read for action (the refusal itself writes nothing):

Evaluate (the A-1 verb):
```json
{
  "action": "evaluate_repair",
  "authorizationRef": "<nonblank string, ≤2000 chars — required>",
  "reason": "<nonblank string — required for this route>"
}
```
Acknowledge (the counter-reset verb, §2.5; each use separately authorized):
```json
{
  "action": "acknowledge_repair_counter",
  "authorizationRef": "<nonblank string, ≤2000 chars — required>",
  "reason": "<nonblank string — required>"
}
```
Both bodies are complete: there are no optional keys, no defaults, and no caller-supplied source, identity, predicate, threshold, or due fields — a body carrying any of those is refused under the allowlist rule.

**Responses:** HTTP 200 with the §2.6 evaluation record as JSON (for `acknowledge_repair_counter`: the acknowledgment event id, the counter value before and after, and the latest registering event id it resolves). Declines are 200 outcomes, not errors — a decline is a successful evaluation whose answer was no. Errors of execution (a storage surface failing mid-evaluation) return the record with outcome `error:<surface>` when a record can be written, else HTTP 500 with the same shape the containment routes use; an unresolved intent left by such a failure is a designed, visible state (§2.2), never a silent one.

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
- *Containment transitions:* a stop commits either before the stretch (seen by the re-read — the act is suppressed) or after initiation (the stop's `deleteAlarm` follows in JS order; the platform storage-effect ordering between them is **assumption family A-3**, unresolved since the containment design — and the mechanisms that surface a violation are unchanged: the stop's read-back verification and the stop-confidence derivation, which contest a surviving registration rather than hiding it).

**Named residual (not smoothed):** the reported registration cannot be re-read synchronously, so an evaluation's stale determination rests on the value returned by the `await` immediately preceding its stretch. A registration initiated by another path *during that await* is invisible to the evaluation. Its consequence is bounded: the evaluation can then initiate a registration for the current minimum due (§above) — an act that is recorded, strike-counted, and at worst redundant; it cannot register a later-than-current-minimum due, cannot act under a committed stop, and cannot dispatch (held state). T-17/T-18 exercise the modeled forms of these races; the platform's storage-effect ordering (A-3) remains an assumption, as it has been throughout the containment program.

### 5.3 Read purity (IC-7)

No read surface changes: the diagnostics GET, the containment GET, the weekly peek, and every other GET perform **zero** of §5.1's writes (T-13/T-28). Linkage of delivery/continuation evidence to an evaluation happens in the observer's own records, outside production storage.

## 6. Expanded offline acceptance matrix — with phase obligations

Base matrix T-00–T-15 (amended design §8), Rowan's additions T-16–T-29 (ruling §10), and this proposal's two completions: **T-30** (the exact-threshold boundary) and **T-31** (predicate precedence under overlap). **Phase key:** **A-1** = executed against the A-1 implementation candidate before its deploy gate; **A-3** = specified now, executed in the A-3 implementation phase (the deferral Rowan permits, identified explicitly here); no deferred test may be reported as passed, and the A-1 battery's report must list A-3-deferred rows as DEFERRED, never omitted. Standing regression suites (containment 42, P2 32, R5A 23, V-3 5, S1 9, B-G2 110 — at their current counts or reviewed successors) must remain green on the A-1 tree. Harness: the house harness (real node:sqlite, production `.one()` semantics). **Stated limit, unchanged:** offline tests establish implementation behavior under modeled conditions, never actual platform delivery.

| ID | Case (abbreviated; amended-design §8 and ruling §10 carry the full text) | Phase |
|---|---|---|
| T-00 | Implementation tree re-verified against the cited ranges/hashes; manifest diff shows exactly the §1 change surface | A-1 |
| T-01 | P-STALE → exactly one registration; intent precedes act; read-back recorded; stages 1–2 distinct | A-1 |
| T-02 | Healthy chain → decline `not_stale`, zero registrations | A-1 |
| T-03/T-04 | P-ABSENT — **superseded in part by IC-1/T-16:** in the A-1 release P-ABSENT never registers under any corroboration; T-03's registration expectation is WITHDRAWN and replaced by T-16; T-04's decline expectation stands and is subsumed by T-16 | A-1 |
| T-05 | Containment stop commits during the evaluation's await → act suppressed (CT13 pattern, both source tags) | A-1 |
| T-06 | Containment matrix: NORMAL acts; DRIVE_CONTAINED watchdog-only (`contained_drive`); CHAIN_STOPPED declines | A-1 |
| T-07 | **Replaced by T-17/T-18** (ruling: the one-effective-value expectation is insufficient); T-07 is retained only as the weaker observation that both acts are recorded | A-1 |
| T-08 | Crash between registration and completion → unresolved intent visible, counted, never auto-retried | A-1 |
| T-09 | Strike bound: three registering evaluations without an intervening pass → fourth declines `repair_ineffective`; a qualifying pass restores eligibility by derivation | A-1 |
| T-10 | P-FUTURE and P-SILENT → diagnostic records with full predicate values, zero acts | A-1 |
| T-11 | Write-set verification (static scan + behavioral): §5.1's inventory is complete; the entrypoint reaches exactly one method | A-1 |
| T-12 | Scheduler health-state machine — specified for A-3's storage; the state definitions are frozen by this proposal | A-3 (deferred, identified) |
| T-13 | Read purity across all GET surfaces against a stale chain → zero writes | A-1 |
| T-14 | No-dispatch invariant: evaluation against an unhalted fixture submits nothing itself — **scoped note (IC-6):** the A-1 release refuses to act unhalted at all (T-24), so T-14 executes as a design-level assertion on the method's references (part of T-11) until an unhalted authority model exists | A-1 (as scoped) |
| T-15 | Mid-evaluation earlier-row insertion → registered due never later than the stretch's fresh minimum | A-1 |
| T-16 | **(IC-1)** Handler in flight before its recorder write; two null reads; prior complete row unchanged → the evaluation records P-ABSENT as diagnostic-only and registers **nothing** | A-1 |
| T-17 | **(IC-3)** Competing evaluation and ordinary wake select different dues → a valid earlier registration is preserved; both acts recorded with their dues | A-1 |
| T-18 | **(IC-2/IC-3)** Concurrent evaluations cannot bypass the strike bound as recorded: combined registrations increment the counter by the number of acts | A-1 |
| T-19 | Strike state survives a coordinator restart (fresh instance over the same storage); a failed or declined operator invocation does not reset it; an invocation carrying a post-bound authorization does not reset it either | A-1 |
| T-20 | Registration succeeds, completion write fails → unresolved intent remains visible and strike-counted | A-1 |
| T-21 | Scheduler intent storage unavailable → no repair invocation occurs (fail closed, IC-5) | A-3 (deferred, identified) |
| T-22 | Duplicate, delayed, overlapping, and missing scheduler runs remain distinguishable in the health record | A-3 (deferred, identified) |
| T-23 | **(IC-4)** The entrypoint cannot be invoked via the public fetch router or any general-authority path; with the flag binding absent it returns `disabled` and performs zero coordinator interaction; it accepts no arguments | A-1 |
| T-24 | **(IC-6)** Halt lifted, queue state altered in fixture, containment transitioned, or authorization reference missing, in each case **before** the registration stretch → the act is suppressed with `held_state_required` (or the containment outcome); the same change landing **inside** the stretch's re-reads is likewise caught | A-1 |
| T-25 | Expired/ambiguous generation authority → in the A-1 release this is the held-state refusal itself (T-24's halt case): no configuration exists in this release in which an evaluation can indirectly restore dispatch, because the release never acts unhalted | A-1 |
| T-26 | Post-registration read-back returns null → the record carries `readback_null`, `setAlarm` completion stated separately, no success/failure of delivery asserted | A-1 |
| T-27 | Late original-alarm delivery after a repair → no duplicated plan advancement, reservation, or provider submission (row-state processing absorbs it) | A-1 |
| T-28 | Q-5-style observation and diagnostic linkage → zero production writes (extends T-13 to the observer pattern) | A-1 |
| T-29 | L-1 witness fixtures (cadence violations, retry-only sequences, external interference, incomplete terminal verification) → the witness predicates reject all four — executed when L-1's execution package is prepared (L-1 phase), specified here because the predicates are shared | L-1 (deferred, identified) |
| T-30 | **Boundary:** `armed === now − ALARM_STALE_THRESHOLD_MS` exactly → P-STALE (the deployed `<=` semantics, coordinator.mjs:3265); one millisecond later → not stale | A-1 |
| T-31 | **Precedence:** inputs satisfying several classes at once (e.g., CHAIN_STOPPED + P-STALE; strike-bound + P-ABSENT; P-FUTURE + P-SILENT) → the §2.3 order decides, and the record names the deciding step | A-1 |

## 7. Rollback and degradation design

**Rollback target:** the base build itself — `ef69b8f91dad3acbed0b9c36cf3c11e238e27f72` (etag `d0eb6ea9…`) — redeployed under the standing rollback law (separate Julie authorization; halted/paused pre-holds verified; post-rollback read-back). The rollback floor (`6a73d962…`) is not approached: the target is the immediately preceding build. **Schema safety:** the two new tables are additive and referenced by no prior code; the base build running against a database that contains them is unaffected (its DDL block simply doesn't create or read them — `CREATE TABLE IF NOT EXISTS` in the new build is likewise inert on re-deploy). Repair events recorded before a rollback remain in storage, readable by any future build that re-adds the code; nothing is migrated or deleted by rollback.

**Degradation (living with a defective A-1, short of rollback):** the A-1 configuration has **no automatic caller** — the entrypoint is inert (§4) and no scheduler exists — so a defective evaluation can be exercised only by a deliberate operator call, which paperwork controls; the strike bound caps consecutive ineffective registrations at 3 regardless; a containment `stop_chain` suppresses all arming system-wide, including the evaluation's, at any moment; and the route can be left uncalled indefinitely with zero effect on the chain's existing behavior (under continued silence, the weekly peek keeps observing). The system with A-1 deployed and never invoked is behaviorally the current system plus an unused route, two empty tables, and an inert export.

**Deploy-gate shape (for the future implementation, sketched not specified):** pre-deploy census at turn-on-2 grade; manifest-diff STOP (§1); observability re-application check after upload (standing rule); post-deploy read-backs (build/etag, capabilities, containment state, a credential-less 403 probe of the new route, and a stamp-less 403 probe); the first production evaluation is **not** part of the deploy gate — it is a separate, separately-authorized act under its own paperwork, or L-1's stimulus if L-1 names A-1 (§9 of the amended design, as conditioned by the ruling).

## 8. Explicit production execution exclusions

This proposal authorizes and requests **none** of the following, and its preparation involved none of them: no code written, built, or tested against production; no deploy or settings change; no production read performed for this proposal (its source citations are to the offline candidate tree, verified against the manifest that the S1 gate established as the live build's source); no evaluation invoked; no stimulus; no containment transition; no queue or halt change; no scheduler Worker, trigger, binding, or flag created or defined; no L-1 execution; no generation release. WS2/Batch untouched. The four preserved `schedule_dead` conflicts rows untouched. W-4 remains an open historical deviation. **Implementation of anything in §§1–7 requires Rowan's documentary acceptance of this proposal and Julie's GO, followed by a separately-gated deploy.**

## 9. Asked of Rowan

Documentary review of this proposal as the implementation basis, in particular: (i) §5.2's serialization demonstration — whether the boundary invariant, the per-path conformance table, and the named residual discharge IC-3 at proposal depth, or what further demonstration is required; (ii) §2.5's derivation-based strike reset and the acknowledgment verb's placement on the route; (iii) §3's body allowlists and the 200-outcome decline semantics; (iv) §4's four fences — whether the entrypoint should instead be omitted from the A-1 build entirely; (v) §6's phase obligations (T-12/T-21/T-22 deferred to A-3, T-29 to L-1, T-03/T-07 replaced as noted); and (vi) §7's rollback target and degradation claims. On acceptance, implementation still requires Julie's GO before any code is written. **Turn: Rowan's**, once Julie relays. Pin: `<W4A1-PIN>` (opal-reader, branch `ui1-review`, to be filled on the filed copy).
