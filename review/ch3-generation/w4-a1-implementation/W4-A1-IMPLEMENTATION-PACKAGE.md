# W-4 TRACK A — A-1 IMPLEMENTATION PACKAGE

**Case:** Opal Roundtable, issue #15 · **Handoff:** `RT-H-20261114-a58bcb`
**Date:** 2026-11-14
**Implementation base:** the S1 candidate tree — the live build `ef69b8f91dad3acbed0b9c36cf3c11e238e27f72`'s source, manifest-verified at `s1-build/MANIFEST.md` (31 parts).
**Operative specification:** the A-1 implementation proposal (pin `4bc8b81b24ef3dfdc39a41c831ead91399f76b7e`), its focused addendum (pin `3759a69e1c25c21ca7c04002d2f4cb5eef972c7f`), and Rowan's final documentary ruling of 2026-11-14 (board 6878847251), which controls on conflict.
**Authorization:** Julie's offline implementation GO, 2026-11-14 (board 6878879682). Offline work only; **no production contact of any kind was made** — no production read, no deploy, no evaluation, no stimulus. Production remains HELD.

Review pin (repo `jedavid33-design/opal-reader`, branch `ui1-review`): `<PIN>`

---

## 1. Identities (ruling §9 item 1)

| | Identity |
|---|---|
| Base tree | S1 candidate tree, 31 parts, per-part SHA-256 at `s1-build/MANIFEST.md` (the candidate manifest block; the A-1 build copy was verified against it 31/31 before any edit) |
| Candidate tree | `a1-build/candidate-tree/`, 31 parts; full manifest in §2 and pinned as `A1-CANDIDATE-MANIFEST.md` |
| Candidate `v2/coordinator.mjs` | SHA-256 `4a65eef5bd8f69a450ba6b590a693f63cc1f06bf08cc7a636ac603d99a8ea169` (base: `5303cb63…`) |
| Candidate `v2/worker-entry-prod-d6.js` | SHA-256 `33af32767d93f2b193c86bf90ea1d3abcb96ff7af3050bbbd3895ce31a3a8091` (base: `2bb0608b…`) |
| A-1 battery | `a1-build/tests/a1-battery.test.mjs` + `a1-build/tests/harness.mjs` (pinned in full) |
| Final run | `a1-build/test-logs/final-run/` — one complete run of every suite on the exact final tree, overall exit 0 (logs pinned) |

## 2. Manifest and two-part diff verification (item 2)

The candidate differs from the base in **exactly two parts** — `v2/coordinator.mjs` and `v2/worker-entry-prod-d6.js`. The other 29 parts are byte-identical to the base; the part count stays 31; deploy bindings are unchanged; **no `REPAIR_SCHEDULER_ENABLED` binding is defined and no scheduler Worker, trigger, or binding was created**. Verified three independent ways: the battery's T-00 (hash comparison over all 31 parts), the manifest generation script, and the regression identity fixture (which additionally measures the candidate against the deeper composed baseline and finds exactly the two A-1 parts plus the inherited S1 `service.mjs` delta — the expected composition). Unified diffs against the base are pinned (`diffs/coordinator.diff`, 672 lines; `diffs/worker-entry-prod-d6.diff`, 163 lines).

## 3. What the two parts contain (item 3 — full sources pinned)

**`v2/coordinator.mjs`** (the engineering surface):
- `REPAIR_SCHEMA`: `d6_repair_state` (singleton projection) + `d6_repair_events` (append-only), mirroring the containment shapes; executed in the `GenerationCoordinator` constructor beside the main SCHEMA (when not ASSUME_SCHEMA), including the singleton's `INSERT OR IGNORE` — a schema-initialization effect, accounted separately from per-evaluation writes (addendum §5.5).
- `readRepairState(sql)` (exported): mirrors `readContainmentState`; **absence is unverified** (fail closed, addendum §5.2).
- `deriveRepairStrikes(sql, passes)` (exported): the one authoritative strike derivation (§5 below).
- The registration-revision fence: a module-level `WeakMap` keyed by the Durable Object state object (`ALARM_REVISIONS`), with `_alarmRevision()` / `_bumpAlarmRevision()` on the coordinator; a bump was added in the same synchronous stretch as **every** registration/deletion initiation in the part: `_armAlarm`, both `_armAlarmIfEarlier` initiation sites (memo branch and main branch), the containment stop's `deleteAlarm`, the verify path's re-issued `deleteAlarm`, and the evaluation's own act. These are the only modifications to existing functions; each is a single added line.
- `GenerationCoordinator.evaluateAlarmRepair({ source, authorizationRef, reason })`, `acknowledgeRepairCounter({ source, authorizationRef, reason, boundaryEventId })`, `repairStatus()`, and their private helpers.

*Why the revision lives in a WeakMap keyed by the state object:* `GenerationCoordinator` is constructed per request throughout the entry, so an instance field on it would reset per request and fence nothing. The state object is the one object whose lifetime is exactly the Durable Object instance's: the counter lives precisely as long as the instance, an in-flight observation cannot survive its instance (the event dies with it), and a reset on instance replacement therefore invalidates nothing that still exists — the lifetime/reset sufficiency the ruling (§2) requires, demonstrated by T-19b. No persistent write is added to ordinary passes.

**`v2/worker-entry-prod-d6.js`** (the route surface):
- Public gate: `isRepairEvaluateRoute` (`POST /v2/d6-repair-evaluate`) and `isRepairStatusRoute` (`GET /v2/d6-repair-status`) join the operator fence class in both lists (client-token skip + operator admission), with forwards to the internal routes.
- Class gate: `POST /internal/d6/repair-evaluate` (stamp check; closed-allowlist validation of both action bodies in full, including `boundaryEventId` validated as a true integer; source stamped `"operator-route"`; recorded declines return 200, execution failures — `error:commitment`, `error:registration`, `error:repair_state_unverified` — return 500 with `{error: "repair_evaluation_failed", evaluationId, outcome}`) and `GET /internal/d6/repair-status` (stamp check; zero-write handler).
- **No scheduler entrypoint export exists** (A1-C4): no `RepairSchedulerEntrypoint`, no activation flag, no service binding; the default export remains exactly `{fetch, queue}` (T-23).

## 4. The evaluation as implemented

Sequence (storage-only awaits are the method's only awaits — T-35): **fail closed** on unverified repair state (no write is possible or attempted) → Phase O observation (revision capture, the single `getAlarm()`, recorder snapshot) → Phase B1 synchronous boundary (revision recheck → `observation_superseded`; containment; DRIVE_CONTAINED pending check; halt; strike derivation; predicate — P-STALE the only repairable one) → the **intent INSERT + projection update in one `transactionSync`** — the reservation and the evaluation's first persistent action (any recorder-established discharges from the same derivation are persisted as durable discharge events in the same transaction) → **commitment boundary**: `await state.storage.getCurrentBookmark()` → Phase B2 synchronous stretch repeating the final revision, eligibility (other outstanding intents), halt, containment, and due checks, then watchdog ensure, fresh MIN(due_at), revision bump, `setAlarm(due)` initiation → Phase C read-back + completion in one transaction. A post-boundary suppression writes a completion recording `actInitiated: false`; a failed `setAlarm` records `actInitiated: "uncertain"` and stays counted; a null read-back is recorded as `readback_null` and proves neither success nor failure of the call (IC-7).

**The commitment boundary choice (ruling §6).** The ruling required the intent's independent durability to be established *explicitly*, by documented storage synchronization or an equivalent proven boundary, and prescribed the consequence if an additional storage await is introduced (reservation preserved; final checks repeated). The implementation uses the SQLite storage's PITR witness, `getCurrentBookmark()`: it is a documented Storage API operation on this SQLite-backed object, and the bookmark it returns identifies a point in the object's durable history — a resolved bookmark after the intent write witnesses that the history including the intent is durable. The structure does not depend on the choice: any documented synchronization operation could replace it without redesign, and the repeated-checks discipline (which the ruling mandated for exactly this shape) is implemented regardless. If the bookmark call fails, nothing follows the intent: the intent stands, conservatively counted, with a completion recording `error:commitment` / `actInitiated: false` when the store still accepts writes (T-20b).

**Discharge durability choice (ruling §3).** The first of the ruling's two routes was implemented: when an evaluation's derivation establishes a recorder-based discharge (two consecutive complete passes after the intent, ids and `at` both later — T-10), the evaluation persists a `discharge` event carrying the intent id and both pass ids, in the same transaction as its own outcome. The derivation thereafter reads discharge from the durable event; recorder pruning cannot resurrect the strike (T-10, pruning step), and a missing row never manufactures discharge (T-10b). The conservative acknowledgment-only alternative was therefore not needed; scope was not expanded.

## 5. Implementation-condition disposition map (item 4)

| Condition | Disposition | Evidence |
|---|---|---|
| A1-C1 documentary bridge | Accepted as filed; construction discipline kept: the method's only awaits are `getAlarm` / `getCurrentBookmark` / `setAlarm` (storage operations) | T-35 static scan |
| A1-C1 revision fence (selected) | Implemented (§3): all 5 pre-existing initiation sites + the repair site; capture before the observation; rechecks at B1 and after the commitment boundary; changed revision → `observation_superseded`, act suppressed | T-17a (observation window), T-17b (commitment window), T-19b (restart lifetime) |
| A1-C2 Phase B reservation | Eligibility derivation + intent inside the synchronous boundary; the intent is the reservation; a competing evaluation's derivation counts it before it can initiate | T-18 (adversarial interleaving at strikes = 2: no fourth registration) |
| A1-C2 counting law | Intents count once; completions never count; unresolved counted; no post-bound exception (the verb set contains no such path); projection recomputed in the same transaction, never read for eligibility | T-09, T-18, T-34 (corrupted-projection case) |
| A1-C2 discharge | Two-consecutive-complete-pass criterion; durable discharge events (§4); pruning-safe; no manufactured discharge | T-10, T-10b |
| A1-C2 acknowledgment | Separate verb on the same fenced POST; required `boundaryEventId` validated as a true integer identifying an actual existing intent (nonexistent, future, and non-intent boundaries rejected); event + projection in one transaction; historical intents remain visible | T-34, T-32 (string/fractional/missing boundary refusals) |
| A1-C3 machine/external split | Machine-enforced in code: halt, containment, strike eligibility, admission + validation, P-STALE. Externally enforced (unchanged from the addendum, carried as execution-paperwork predicates): queue-pause read-back ≤15 min, WAIT-law clearance, action-specific authorization, exclusive control, post-operation verification | T-24a (machine side, incl. mid-flight halt flip); T-24b in the deferred register (§7) — procedural by design, never claimed as code behavior |
| Route corrections | Closed allowlists for both bodies written in full; both text fields required, trimmed-nonblank, ≤2,000; `reason` carried into the audit record (T-32b verifies it lands on the intent row); server-stamped source; inbound stamp cannot substitute for admission; declines 200 / execution failures 500; no automatic retry — an ambiguous response leaves the recorded intent as the state to disposition | T-32 (13 malformed shapes + malformed JSON + admission cases), T-32b |
| A1-C4 entrypoint omitted | No entrypoint, flag, binding, trigger, or caller anywhere in the candidate | T-23 (absence verified in source and in the built module's exports) |
| A1-C5 intent-first + durability | Intent precedes watchdog ensure and registration; commitment boundary per §4; singleton initialized only at construction; missing/unverified state fails closed and is never repaired by a request path | T-20b, T-33 |
| A1-C5 audit surface | `GET /v2/d6-repair-status` reports the derivation (inputs shown), unresolved intents with ages' inputs, and a bounded recent-events page; zero writes, no wake | T-13/T-28 (snapshot-identical around the reads), T-33 |
| IC-1 P-ABSENT diagnostic-only | Registration requires P-STALE; absent/future/silent are recorded diagnostics | T-03/T-16, T-04, P-FUTURE/P-SILENT cases, T-31 precedence |

## 6. Acceptance results (items 5–6)

One complete run on the exact final tree (`run-all.sh`, overall exit 0; full logs pinned):

| Suite | Result |
|---|---|
| **A-1 acceptance battery** (43 tests) | **38 pass, 0 fail, 5 skipped** — the 5 skips are exactly the deferred register (§7) |
| S1 enforcement | 9/9 pass |
| Containment | 42/42 pass |
| P2 recorder | **33/33 pass** (32 standing + 1 A-1 guard, see below) |
| R5A | 23/23 pass |
| V-3 cold restart | 5/5 pass |

**Disclosed battery adaptation (P2 copy only):** the A-1 candidate adds two tables the unmodified twin lacks, so the P2 twin-equivalence snapshots in the A-1 regressions copy exclude `d6_repair_events` / `d6_repair_state` exactly as they already exclude the recorder's own table — with the adaptation disclosed in that file's header, and the safety content the exclusion would hide asserted by a new guard test (six ordinary alarm passes write zero repair events and leave the singleton initial; it passes). No original P2 test or assertion was modified, deleted, or loosened; the A-1 battery itself (T-11) independently pins the evaluation's write-set against a full-database snapshot. The identity fixture was regenerated from the trees by the standing regen script (changed parts vs the composed baseline: the two A-1 parts + the inherited S1 part).

The A-1 battery's harness is the house harness with additive, marked extensions (the bookmark commitment seam — fault switch + one-shot deferral — a setAlarm fault switch, params-aware one-shot SQL faults, and db injection for T-36), copied, not modified in place.

## 7. Deferred-test register (item 7)

| Test | Deferred to | Reason |
|---|---|---|
| T-12 (scheduler health record) | A-3 | No scheduler exists in A-1 (A1-C4) |
| T-21 (scheduler intent-storage failure) | A-3 | Same |
| T-22 (duplicate/delayed scheduler runs) | A-3 | Same |
| T-29 (L-1 witness fixtures) | L-1 phase | L-1 is separately gated |
| T-24b (procedural prerequisites) | Future execution paperwork | Not harness-verifiable by design (ruling §4); never claimed as code behavior |

No deferred test is reported as passed; each appears in the battery as an explicitly skipped test naming its deferral. Scheduler-specific and L-1 obligations remain exactly as the rulings left them.

## 8. Write-set and rollback verification (item 8)

**Complete write-set of the new code:** `d6_repair_events` INSERTs (discharge / evaluation / intent / completion / acknowledgment kinds); `d6_repair_state` UPDATEs (projection, same transactions); `schedule` watchdog-ensure INSERT (registering path only, when no watchdog row is pending); one `setAlarm` (registering path only). Schema initialization (two tables + singleton row) is a construction/deploy effect, accounted separately. **Negative inventory (T-11, snapshot-verified):** no writes to ledger, quota, jobs, grants, outbox, settings, commands, containment, or recorder tables; no queue interaction; no R2; no `deleteAlarm` in the new code. **Read purity:** no read surface gains writes (T-13/T-28/T-33).

**Rollback (T-36, executed):** the rollback target is the base build `ef69b8f9…` itself, under the standing rollback law (the floor is not approached). The base build was run against a database with populated repair tables including an unresolved intent: its containment and drive-diagnostics reads returned 200 and the repair rows were untouched — the additive schema is inert under the old build. Per the ruling's qualifications, stated plainly: rollback does not undo a prior registration or watchdog-row insertion; deployment plus schema initialization are not literally zero effects; the route-uncalled degradation claim holds while the standing holds are preserved. A deployed-but-never-invoked A-1 is behaviorally the current system plus an unused route, two empty tables, and a singleton row. Rollback itself requires its own authorization; the first production evaluation remains outside any deployment gate.

## 9. Exclusions and next step

No code was deployed; no production surface was read or written for this package; no evaluation, acknowledgment, stimulus, containment transition, queue or settings change, or generation act occurred. W-4 remains an **OPEN HISTORICAL DEVIATION**. WS2/Batch untouched.

**Next step (ruling §8–§9):** this package returns for Rowan's implementation review. No deployment proposal will be presented before that review, and deployment remains separately gated on Julie's further GO.

**Turn: Rowan's** (implementation review). Then Julie's, for any deployment question.
