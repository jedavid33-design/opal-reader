# W-4 TRACK A — A-1 IMPLEMENTATION PROPOSAL: FOCUSED ADDENDUM (A1-C1 – A1-C5)

**Case:** Opal Roundtable, issue #15. **Prepared on Julie's explicit go of 2026-11-14** (button tap, Coding Projects chat), in response to Rowan's ruling of 2026-11-14 on the A-1 implementation proposal (proposal pin `4bc8b81b24ef3dfdc39a41c831ead91399f76b7e`; ruling verbatim, board comment 6878714787), which returned the proposal for a **focused addendum** resolving A1-C1 through A1-C5. **This addendum does not reproduce the proposal.** The proposal stands in full except where a section below explicitly supersedes it; §7 closes with the supersession map. **Status: PROPOSAL ONLY** — no code is authorized by the ruling, this addendum, or its acceptance. Production remains HELD.

---

## 1. A1-C1 — Concurrency: the documented input gate, and what it does and does not prove

The proposal's §5.2 is **superseded** by this section. Its boundary-stretch discipline is retained as construction (§1.4); its claim to discharge IC-3 by itself is withdrawn, and its "at worst redundant" characterization of the residual is withdrawn with it, as the ruling directs.

### 1.1 The investigation the ruling required

**(a) Alarm operations are storage operations.** Cloudflare's Durable Objects Alarms documentation states: "Alarms are modified using the Storage API, and alarm operations follow the same rules as other storage operations." The SQLite-backed storage API reference — the backend the deployed coordinator actually uses (`this.sql = state.storage.sql`, coordinator.mjs:688) — lists the Alarms API among the Storage API's method families for SQLite-backed classes, and states of those methods: "Each method is implicitly wrapped inside a transaction, such that its results are atomic and isolated from all other storage operations."

**(b) Storage operations carry input-gate protection across awaits.** The Rules of Durable Objects (updated 2026-11-05) document: "**Input gates** block new events (incoming requests, fetch responses) while synchronous JavaScript execution is in progress. Awaiting async operations like `fetch()` or KV storage methods opens the input gate, allowing other requests to interleave. However, storage operations provide special protection" — and the worked example is precisely a read-modify-write across two awaited storage operations, annotated "While these storage operations execute, no other requests can interleave — input gate blocks new events" and "This code is safe due to input gates." The boundary of the protection is stated with equal clarity: "Input gates only protect during storage operations. Non-storage I/O like `fetch()` or writing to R2 allows other requests to interleave."

**(c) The deployed compatibility configuration.** The production script's compatibility configuration (deploy record, preserved across every upload in this program) is compatibility_date `2026-08-29` with the `nodejs_compat` flag. Input/output gating is documented as unconditional runtime behavior of Durable Objects storage — not a compatibility-date behavior and not a flag — and no flag in the deployed set relates to it. The one documented concurrency override, `blockConcurrencyWhile()`, "guarantees that no other events are processed until the provided callback completes, even if the callback performs asynchronous I/O" — and the same documentation directs developers to reserve it for initialization and migrations and to "rely on input/output gates" for normal operations. It is **not adopted**: the evaluation needs no non-storage await (§1.2's construction rule), and blocking all events around every evaluation would also block the alarm event the chain depends on.

### 1.2 The demonstration

The evaluation's sequence from method entry to the registration initiation contains **exactly two awaits, both storage operations**: `await getAlarm()` (observation) and the initiation of `setAlarm(due)`. Every other step is synchronous — SQL via `this.sql.exec`, synchronous env reads, in-memory computation over values already read. By (a) and (b), throughout that sequence the input gate blocks delivery of any new event — a command, a report, an alarm delivery, a containment transition — until the sequence's storage operations complete. The interleaving the ruling posits (a fresh registration established by another path *between* the evaluation's `getAlarm()` and its `setAlarm()`) requires another event to execute inside that window; under the documented semantics, no event can. The evaluation therefore acts on a registration observation that cannot have been superseded at the moment of the act — which is the authority Rowan's objection requires, established independently of due selection. Rowan's second point is accepted on its own terms: P-STALE never did imply due ≤ the observed stale value, and nothing in this demonstration relies on that relation — the due is computed fresh inside the boundary stretch from the then-current schedule, and its size relative to the stale value is immaterial once non-supersession is established.

**Construction rule (new, binding on the implementation):** `evaluateAlarmRepair` shall contain no await other than storage operations (`getAlarm`, `setAlarm`, and the post-act read-back `getAlarm`) between method entry and the registration initiation — no `fetch`, no KV, no timers, no body parsing (parsing and validation complete at the route layer before the coordinator method is invoked, and the method re-reads every value it acts on inside its own sequence). This rule is statically checkable and is added to the matrix (T-35).

**Coverage of every registration and deletion path** (ruling's requirement), under the same semantics: `_armAlarm` (:2816) performs no await before its initiation at all. `_armAlarmIfEarlier` (:3241,:3267) awaits only `getAlarm()` before its initiations — a storage operation, within the same protection; its v3 recheck is retained (§1.4). The containment stop path commits its state synchronously, then performs only storage operations (`getAlarm`:2996, `deleteAlarm`:3003, read-back:3004); the verify path's re-issued `deleteAlarm` (:3132) is likewise a storage operation. No path in the system mixes a non-storage await into a registration sequence.

### 1.3 Strength of this demonstration — stated, not smoothed

This is a **documentary** demonstration: it rests on Cloudflare's published semantics (the G-5 class of documented guarantees), not on an incident observation or a platform experiment, and the addendum claims nothing more for it. Two honest consequences. First, the harness continues to model adversarial interleavings the documentation excludes; harness results therefore cannot confirm the gate, and the construction defenses in §1.4 are retained so that the modeled races degrade safely even under the harness's scheduler. Second, the containment program's long-standing "racing-wake recheck: platform-unverified" label is refined, not reversed: the *documentary* position is now that the gate excludes the race for storage-only sequences; no incident evidence has been added either way, and the v3 recheck stays in the code regardless.

### 1.4 What is retained, and the fallback not taken

The proposal's boundary stretch is retained verbatim as a construction discipline (all final eligibility reads inside one synchronous stretch; §2 of this addendum rebuilds the strike reservation on it). The ruling released the additive-only constraint for a possible invalidation mechanism; with the demonstration above, **no existing function requires modification after all**, and the design does not spend the release — the change surface remains the proposal's §1 surface as amended by §4 below. A registration-revision fence is **not** introduced. Should Rowan judge the documentary bridge in §1.1(a) insufficient, the fallback is fully determined and needs no further design round: a monotonic revision column incremented inside every registration/deletion stretch (the three `setAlarm` sites and both `deleteAlarm` sites above), captured by the evaluation before its `getAlarm()` and re-read inside its boundary stretch, with any change aborting the evaluation as `observation_superseded`. It is sketched here so it can be mandated, not built here so it can be presumed.

## 2. A1-C2 — Strike enforcement inside the boundary

Proposal §2.3 (steps 3–7) and §2.5 are **superseded** by this section.

### 2.1 The restated sequence

- **Phase O — observation (no writes):** containment read; the machine-enforced held-state conditions (§3); `armed = await getAlarm()`; predicate snapshot, including `latestPassIdBefore` (the newest `d6_drive_passes` row id, read defensively) and the latest pass values.
- **Phase B — boundary stretch (synchronous; the only await is its terminal act):** re-read containment; re-read GENERATION_HALT; **derive effective strikes** (§2.2) from the events table; if the bound is reached, write the decline as a single `evaluation` event (§5.3) inside one `_tx` transaction and end. If P-STALE applied at observation and the stretch's fresh schedule reads still admit an act: **insert the intent row and update the state projection in one `_tx` transaction** — this insertion is the reservation, and it is the evaluation's first persistent action (§5.1); then the watchdog ensure (if no watchdog row is pending); then compute `due` from a fresh synchronous minimum-`due_at` read; then initiate `setAlarm(due)`.
- **Phase C — completion:** read back `getAlarm()`; insert the completion row and update the projection in one `_tx`.

Because Phase B is synchronous JavaScript, no scheduler — platform or harness — can interleave inside it: a second evaluation's Phase B runs wholly before or wholly after this one, and its derivation therefore counts this evaluation's intent if this one registered first. The ruling's counterexample (two evaluations passing a pre-await check) cannot occur, because the check no longer exists before the await: eligibility is derived only inside Phase B, from a table that already contains every prior reservation. The documented input gate (§1) additionally prevents a second evaluation event from beginning its storage sequence during this event's, but the enforcement does not depend on the gate — it depends only on Phase B's synchrony, which is why T-18 can be a harness test again (corrected, §6).

### 2.2 The one authoritative derivation

Authority is the derivation below, computed from the append-only events table (and a defensive recorder read) at each use. The `d6_repair_state` row is a **projection/cache** for display, updated inside the same `_tx` as its triggering event; it is never read for eligibility, so it can never become a second, contradictory authority.

- A **registering intent** is an events row of kind `intent`. Completions never add to any count — an intent and its completion are one attempt (no double-counting, by construction of the derivation, which counts only `intent` rows).
- An intent **I is discharged** when two consecutive complete rows exist in `d6_drive_passes` with ids greater than `I.latest_pass_id_before` and `at` greater than `I.at`, consecutive meaning adjacent in the table's id order with both stages `complete`. Two rows are required because a single post-intent row can belong to a pass already in flight when the intent was written (its timestamp is later, but it evidences nothing about the repaired registration); the **second** row's pass necessarily began after the first row was written — after the intent — and so evidences a delivery occurring after the registration.
- An intent is **acknowledged away** when an acknowledgment event exists whose recorded `boundary_event_id` is ≥ the intent's id (§2.3). Acknowledged intents remain fully visible; the derivation merely excludes them from the count.
- `effectiveStrikes = ` the number of `intent` rows neither discharged nor acknowledged away. If the recorder read fails or the table is absent, **no intent is discharged** (fail closed); an unverified recorder read never resets eligibility.

### 2.3 Acknowledgment, as corrected

The post-bound evaluation exception in the proposal is **omitted entirely**: once the bound is reached, the operator route declines like any other source until discharge or acknowledgment. The acknowledgment verb (same fenced route; body per §4) must name its boundary precisely: its body carries `boundaryEventId` (the id of the last intent it discharges; every intent with id ≤ that value is acknowledged away), and the acknowledgment event records that boundary and enumerates the intent ids it discharges. The event insert and the projection update execute inside one `_tx` — a single synchronous transaction via the coordinator's existing `_tx` helper (`state.storage.transactionSync`, coordinator.mjs:717–722) — and because eligibility derives from the events rather than the projection, even a torn projection is recoverably equivalent to atomicity: the derivation from events is always the authority.

## 3. A1-C3 — Machine-enforced vs. externally enforced conditions

Proposal §2.3 step 2 is **superseded** by this section. The conditions are separated exactly as the ruling requires, and the Worker claims only the first list.

**Machine-enforced** (checked in code, at the act boundary — Phase O and re-checked in Phase B): generation halt asserted (GENERATION_HALT `"1"`); containment permits the intended act; strike eligibility (§2.2); operator admission and request validation (route layer); P-STALE eligibility.

**Externally enforced** (procedural execution fence — the Worker cannot observe these and the design does not claim it can): current queue-pause verification; applicable fault-response clearance; valid, unexpired, action-specific human authorization; exclusive execution control over competing queue, settings, and operator mutations. These become a **standing requirement carried into every future execution package** for this route: the package must record, as pre-invocation predicates with named evidence, (i) a cf-api queue read-back showing `delivery_paused: true` obtained **within 15 minutes before invocation** and re-verified after the invocation completes; (ii) the operator of record's fault-response review — no 1101 signature on the pre-invocation read set, and Julie's WAIT law affirmatively reviewed for the window; (iii) the specific authorization (a GO naming this evaluation) in force at invocation time, with its window; and (iv) a named exclusive-control window during which no other actor performs queue, settings, or operator mutations. A historical deploy census satisfies none of these for a later call. Correspondingly, T-24 is split (§6): what the code refuses is harness-tested; what the paperwork must verify is specified as paperwork, and is never represented as a code property.

## 4. Route corrections (ruling §5) and the entrypoint removal (A1-C4)

**Method signature (corrected):** `evaluateAlarmRepair({ source, authorizationRef, reason})` — `reason` is now carried into the method and stored on the intent and completion records, closing the gap the ruling identified. `reason` is required, nonblank after trimming, and capped at 2,000 characters, as is `authorizationRef`.

**Acknowledge body (corrected — written in full, superseding proposal §3):** the closed allowlist gains the boundary field §2.3 requires; any other key is refused as before:
```json
{
"action": "acknowledge_repair_counter",
"authorizationRef": "<nonblank string, ≤2000 chars — required>",
"reason": "<nonblank string, ≤2000 chars — required>",
"boundaryEventId": "<positive integer — required>"
}
```

**HTTP semantics (superseding proposal §3):** a successfully evaluated **policy decline returns HTTP 200** with the evaluation record. An **execution failure returns HTTP 500** with `{ "error": "repair_evaluation_failed", "evaluationId": <intent id or null>, "outcome": "error:<surface>"}` — a decline and a failure are never the same shape. Validation refusals remain HTTP 400 `repair_body_not_allowed` / the fence's 403s, written before any state is read for action.

**Stamp integrity:** the operator-admitted stamp is set by the production gate on the request it constructs for the coordinator; an inbound `x-opalreader-operator-admitted` header from a caller is never propagated. The matrix gains an explicit spoofing case (§6, T-32): a request bearing the stamp but not the operator token is refused at the gate.

**No automatic retry:** the route contract now carries, as a term any execution paperwork must reproduce, that an ambiguous response (timeout, 5xx, lost connection) leaves the attempt **unresolved** and is not authority to issue another — the unresolved intent in the record is the state to be dispositioned, exactly as the ruling requires.

**A1-C4 — entrypoint removed.** Proposal §4 is **superseded in full**: the A-1 build contains **no** `RepairSchedulerEntrypoint` export, **no** `REPAIR_SCHEDULER_ENABLED` binding, no service binding, and no scheduler wiring of any kind. The A-1 change surface in `v2/worker-entry-prod-d6.js` reduces to the route classification insertions and the class-gate branch (plus the read surface of §5.4). The evaluation method's `source` remains a handler-stamped internal field with only `"operator-route"` reachable, so a future source can be added at A-3 without redesigning the core — the b1 topology remains the destination, with everything scheduler-related deferred to A-3's implementation, as the ruling directs.

## 5. A1-C5 — Persistence and audit precision

### 5.1 Intent first, and why it is durable

The restated sequence (§2.1) makes the **intent insert the evaluation's first persistent action** — before the watchdog ensure and before `setAlarm` is called (the proposal's placement is superseded accordingly). Durability rests on documented mechanics, not on initiation ordering alone: SQL writes issued without intervening awaits "are automatically batched into a single atomic implicit transaction"; each storage method is implicitly transactional (§1.1(a)); the intent insert and its projection update run inside one explicit `_tx` (`transactionSync`) in any case; and output gates hold any response "until pending storage writes complete", so no caller can be told an outcome whose audit record has not persisted. The failure ladder is then exact: a failure before the intent leaves nothing and no act occurred (program order — `setAlarm` is never reached); a failure after it leaves the designed unresolved intent, visible and strike-counted; a failure of the completion write leaves the same. T-20 is expanded to inject at all four points (§6).

### 5.2 Singleton initialization and fail-closed behavior

The schema-initialization block (the DDL region that creates the two repair tables) also establishes the singleton state row with `INSERT OR IGNORE` (projection zeroed) — accounted as a **schema-initialization effect of the deploy** (§5.5), not a per-evaluation write. `readRepairState` returns *unverified* on a missing table, a missing row, or an unrecognized shape; in that state every evaluation declines `error:repair_state_unverified`, the acknowledgment verb refuses identically, and the audit surface reports the state rather than repairing it. Initialization happens only at construction; no request path creates or repairs repair state.

### 5.3 Evaluation identity

Every event row's id is unique (one AUTOINCREMENT sequence). An evaluation's identity **is the id of its first event row**: for a registering evaluation, its `intent` row (the completion references it); for a non-registering evaluation, its single row of kind `evaluation`, which carries `intent_id: null` in its detail. The two kinds are discriminated by the `kind` column and presented in separate fields by the audit surface, so a diagnostic record can never be mistaken for a registering attempt or vice versa.

### 5.4 The read-only audit surface

`GET /v2/d6-repair-status` joins the operator fence's read class (the `GET /v2/d6-containment` pattern: same three-layer admission, class-gate stamp re-check). It returns: initialization state; the §2.2 derivation, shown as its inputs (total intents, discharged count with the discharging pass ids, acknowledged boundary, unresolved intent ids with ages, the resulting effective strikes); a bounded page of recent events; and the last evaluation record. It performs **zero writes** — no DDL, no lazy initialization, no projection repair (§5.2) — and no wake: it is served by a read-only coordinator method over the same tables, and a missing-table state is reported, not fixed (T-33).

### 5.5 Accounting separations

Schema initialization (two tables, one singleton row) is a **deploy effect**, enumerated in the deploy gate's census and excluded from the per-evaluation write inventory; proposal §5.1's inventory stands for per-evaluation writes with two amendments: the intent/projection pair and the completion/projection pair are each single `_tx` transactions, and the audit surface adds zero writes. Proposal §7's degradation language is tightened per the ruling's qualifications: rollback does not undo any registration or watchdog row an evaluation has made; deployment plus schema initialization are real, recorded effects (not "literally zero"); and leaving the route uncalled is a valid degradation only while the standing holds are preserved and no other introduced surface is exercised. The offline rollback verification against a populated repair database is added to the matrix (T-36).

## 6. Corrected acceptance expectations

Only the rows the ruling corrects are restated here, plus the additions. **Every other row of the proposal's §6 matrix stands as filed.** No original safety expectation is weakened: T-17 and T-18 change from retrospective counting to prevention, which is a strengthening, and the change is recorded as such rather than presented as the original meaning.

| ID | Corrected / added expectation |
|---|---|
| T-17 | **(rewritten)** An evaluation whose registration observation is superseded cannot arise under the gated sequence (§1.2); the harness form of the case is therefore run against the stretch defenses: an adversarially interleaved evaluation whose Phase O observation is stale by Phase B must re-derive from Phase B's fresh reads and must not register over a registration the interleaving established — asserted via the Phase B containment/due re-reads and the T-35 construction rule. Counting both acts is not the expectation and never was sufficient. |
| T-18 | **(rewritten)** At effective strikes = 2, two evaluations interleaved at every await the harness offers: exactly one registers (reaching 3); the other derives 3 inside its Phase B and declines. Enforcement precedes the act — the unauthorized fourth registration does not occur in any interleaving the harness can schedule. |
| T-19 | **(expanded)** Strike state persists across a coordinator restart (fresh instance over the same storage); derivation inputs survive identically; a declined or failed operator invocation changes nothing; an acknowledgment discharges exactly the intents at or below its recorded boundary and no others; unresolved intents remain counted and visible across restarts. |
| T-20 | **(expanded)** Failure injection at four points — before the intent (nothing persists, no act), after the intent but before the watchdog ensure, during registration, after registration but before completion persistence — each leaves exactly the §5.1 state: nothing, or one visible unresolved intent, strike-counted, never auto-retried. |
| T-23 | **(rewritten)** Scheduler-entrypoint **absence**: the built script exports no `RepairSchedulerEntrypoint`; the deploy spec defines no `REPAIR_SCHEDULER_ENABLED` and no service binding; scheduler-specific invocation tests are deferred to A-3 as before. |
| T-24a | **(split — machine-enforced)** Halt not asserted, containment transitioned, authorization reference missing/blank, or P-STALE absent → refusal/decline, including the change landing inside Phase B's re-reads. |
| T-24b | **(split — procedural)** Queue-pause freshness, fault-response clearance, authorization validity, and exclusive control are execution-paperwork predicates (§3). **Not harness-testable and never claimed as code behavior**; the implementation review verifies only that the route's documentation carries the requirement forward. |
| T-32 | **(new)** Route-validation battery: malformed JSON; non-object body; wrong field types; whitespace-only `authorizationRef`/`reason`; oversized fields (>2,000); unknown action; unexpected keys (including a spoofed `source`); missing admission; an externally supplied operator-admitted stamp without the operator token; client-token-only admission. Each refused before any state is read for action, and each refusal writes nothing. |
| T-33 | **(new)** Audit surface: returns the derivation as its inputs (discharging pass ids, acknowledgment boundary, unresolved intents); performs zero writes against a stale chain and against missing tables (reports uninitialized); never wakes. |
| T-34 | **(new)** Acknowledgment atomicity and boundary semantics: event + projection commit in one `_tx`; a torn projection (injected) cannot change the derivation; historical intents at or below the boundary remain listed, marked acknowledged; intents above it are untouched. |
| T-35 | **(new)** Construction conformance: a static scan of the built `evaluateAlarmRepair` shows no await other than `getAlarm`/`setAlarm` between entry and the registration initiation (§1.2's rule); the same scan confirms no existing registration path mixes a non-storage await into its sequence. |
| T-36 | **(new)** Rollback verification (offline): the base build (`ef69b8f9…` source) operates correctly against a database containing populated repair tables, including unresolved intents — reads and existing behavior unaffected; no repair surface is reachable on the base build. |

T-03 remains withdrawn; T-04 and T-16 stand (P-ABSENT never registers); T-07 remains superseded; T-12, T-21, T-22 remain deferred to A-3, identified as deferred; T-27 stands as directed; T-29 remains deferred to L-1; T-30 and T-31 stand as accepted. All standing regression suites remain required.

## 7. Supersession map and closing state

| Proposal section | Status |
|---|---|
| §1 (base, change surface) | Stands, as amended by addendum §4 (entrypoint items removed from the entry's surface) |
| §2.1–2.2 (shape, persistence) | Stand (the method signature is corrected at addendum §4) |
| §2.3 (sequence, precedence) | **Superseded** by addendum §2.1 and §3 |
| §2.4 (what the act may never do) | Stands |
| §2.5 (strike counter) | **Superseded** by addendum §2.2–2.3 |
| §2.6 (evaluation record) | Stands, as amended by addendum §5.3 (identity) |
| §3 (route contract) | Stands, as amended by addendum §4 (acknowledge body, HTTP semantics, stamp integrity, no-retry term) |
| §4 (entrypoint) | **Superseded in full** by addendum §4 (A1-C4: omitted) |
| §5.1 (write-set) | Stands, as amended by addendum §5.5 |
| §5.2 (concurrency) | **Superseded** by addendum §1 |
| §5.3 (read purity) | Stands |
| §6 (matrix) | Stands except the rows corrected at addendum §6 |
| §7 (rollback, degradation) | Stands, as qualified by addendum §5.5 and T-36 |
| §8 (exclusions) | Stands in full — nothing in this addendum authorizes code, deployment, or any production act |

**Asked of Rowan:** documentary review of this addendum as the completion of the A-1 implementation proposal — in particular whether §1's documented-gate demonstration discharges A1-C1 or whether the §1.4 fallback fence is mandated; whether §2's derivation and Phase B reservation discharge A1-C2; and whether the corrected matrix states the prevention expectations at full strength. On final documentary acceptance, implementation still requires Julie's GO before any code is written, and its own deploy gate after that. **Turn: Rowan's**, once Julie relays. Pin: `<W4A1ADD-PIN>` (opal-reader, branch `ui1-review`, to be filled on the filed copy).
