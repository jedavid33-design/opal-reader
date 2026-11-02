# Phase B — independent containment design, REVISED (explicit state semantics)

**Status: DESIGN + OFFLINE IMPLEMENTATION + OFFLINE EVIDENCE.
NOT APPROVED FOR DEPLOYMENT.** Prepared under Rowan's
R5a-revised-package ruling (relayed verbatim by Julie 2026-11-02;
record `ROWAN-R5A-REVISED-PACKAGE-RULING.md`), required work A:
*"Correct containment state semantics… Demonstrate that a
flag-read failure cannot silently defeat a verified chain stop."*
Ruling decision 4: *"REVISE. The two-layer architecture is a valid
design direction, but the current one-flag specification does not
consistently distinguish contained from chain-stopped operation."*

Nothing here authorizes any production action. Production remains
under INVESTIGATION HOLD.

**Supersedes:** `PHASEB-CONTAINMENT-DESIGN.md` (v1, the one-flag
spec). Two v1 positions are **changed** by this revision, openly:
(1) the single boolean flag is replaced by an enumerated state
(§1); (2) v1's "fail-open for arming" on a flag-read failure is
**reversed** — an unverified read now suppresses arming too (§4),
because Rowan's requirement (a read failure must not defeat a
verified stop) cannot be met under fail-open arming: the arm paths
are precisely the resurrection paths. The cost of the reversal is
stated in §4.4 and bounded by the absent-table structural rule.

**Source basis:** the containment candidate tree (live
instrumented build `86ad06ab…` + containment; identities in
`containment/CANDIDATE-IDENTITIES.md`). All line citations are to
the CANDIDATE parts unless marked *(live)*. setAlarm census
(verified firsthand on the live tree): `setAlarm` exists at
exactly two sites in the whole tree — coordinator.mjs
`_armAlarm()` (live :2462) and `_armAlarmIfEarlier()` (live
:2486); `deleteAlarm()` is called nowhere in the shipped tree
(its only mention is the storage-interface comment,
coordinator.mjs *(live)* :19). Every registration the system can
ever make flows through those two functions, which is what makes
a complete arm gate possible.

---

## 1. The state store: one singleton row, one enumerated value

**Choice: ONE state field with an enumerated value set** —
not two independent booleans, not two flags.

- Table `d6_containment_state` (coordinator.mjs candidate :181,
  `CONTAINMENT_SCHEMA`): a singleton row (`id INTEGER PRIMARY KEY
  CHECK (id = 1)`) carrying `state TEXT NOT NULL`,
  `updated_at INTEGER NOT NULL`, `authorization_ref TEXT`.
- Audit table `d6_containment_events` (same DDL block): one
  append-only row per applied transition, per idempotent
  re-application, and per unverified-stop verification failure.
- Values: **`NORMAL`**, **`DRIVE_CONTAINED`**, **`CHAIN_STOPPED`**
  (exported frozen enum `CONTAINMENT_STATES`, candidate :178).

**Why one enumerated field, not two independent fields:** the two
v1 "layers" are not independent dimensions — chain-stopped is
drive-contained *plus* registration stopped; there is no
meaningful state "registration gated but drive running" in this
design, and two booleans would admit exactly that fourth,
undefined combination (and invite a reader to combine them
wrongly). With one field, the contained-vs-stopped distinction is
**structural**: every consumer switches on one value read in one
query; an inconsistent pair is unrepresentable. The transition
table (§2) is a function of one current value.

**`STOP_UNVERIFIED` is deliberately NOT a stored state.** It is a
*reported outcome* of the stop transition (and a classification
in gate paperwork): the stored state after a failed verification
is `CHAIN_STOPPED` — the darker state — while `stopVerified:
false` in the transition response and an `unverified` audit event
record that the physical act was not confirmed. Making it a
stored value would create a state whose drive/arm semantics would
have to be invented; keeping it as an outcome keeps exactly three
behaviors and one honest report. (If Rowan prefers it stored, the
enum is the single place to add it — flagged as an open item in
the copy-paste.)

**Creation discipline (load-bearing):** the tables are created
**only** by a transition (`applyContainmentTransition`,
candidate :2620, runs the DDL first). Reads never write and never
create. Passes never create. Therefore **an absent table is a
structurally verified NORMAL**: no transition has ever been
recorded on this object, so no stop exists that anything could
defeat. Battery CT1 pins this: after passes and reads on a fresh
world, the table still does not exist.

## 2. States and transitions

Actors: ONLY the operator route (`POST /v2/d6-containment`,
public entry forward candidate entry :2457; class handler entry
:1703; closed allowlist `{action, authorizationRef}`; the
coordinator method `applyContainmentTransition` candidate :2620)
can move the state. No command, report, pass, wake, or read can.
Each transition writes: the state row (upsert of the singleton)
and one audit event row, in one coordinator transaction; the stop
transition additionally performs its physical act after commit
(§2.1). `authorizationRef` is required, nonblank, ≤2000 chars —
every transition is attributable, mirroring the shipped operator
discipline.

| action | from → to | preconditions | writes |
|---|---|---|---|
| `contain_drive` | NORMAL → DRIVE_CONTAINED | state reads NORMAL (incl. absent) | state row + event |
| `contain_drive` | DRIVE_CONTAINED → (same) | — | event only (`idempotent: true`); outcome `applied` |
| `contain_drive` | CHAIN_STOPPED → — | — | **rejected** `containment_transition_refused`, NO writes (no silent downgrade of a stop) |
| `stop_chain` | NORMAL → CHAIN_STOPPED; DRIVE_CONTAINED → CHAIN_STOPPED | state reads NORMAL or DRIVE_CONTAINED | state row + event, then `deleteAlarm()` + verification read-back (§2.1) |
| `stop_chain` | CHAIN_STOPPED → (same) | — | event only (idempotent); **no second deleteAlarm** — verification status is reported from the state, not re-attempted implicitly |
| `clear` | DRIVE_CONTAINED → NORMAL; CHAIN_STOPPED → NORMAL | state reads contained or stopped | state row + event. **Clearing never re-arms anything itself**; the registration stays absent until an ordinary wake/pass re-arms through the (now ungated) paths |
| `clear` | NORMAL → (same) | — | event only (idempotent) |
| any | unreadable/corrupt current value → — | — | **rejected** `containment_transition_refused` with `verified: false` reported; NO writes except — none. An operator who cannot read the current state cannot move it; the remedy is diagnosis, not a forced write |
| any action not in the allowlist | — | — | **rejected** `containment_action_not_allowed` at the method; the route's closed allowlist rejects earlier with `containment_request_key_not_allowed` / `containment_action_not_allowed` |

### 2.1 The stop transition's physical act + verification

`stop_chain` commits the state row FIRST, then, in order:
`deleteAlarm()`, then `getAlarm()`. The stop is **verified** iff
the read-back is null/undefined. On a throw from either call, or
a non-null read-back: an audit event (`action:
'stop_chain_verify'`, `outcome: 'unverified'`, with the error
name) is appended, and the response is `outcome: "rejected",
reason: "containment_stop_unverified", state: "CHAIN_STOPPED",
stopVerified: false`. The state row is NOT rolled back: if the
physical act failed, the arm gates (§3) are what hold the line —
every later wake evaluates the gate against `CHAIN_STOPPED` and
registers nothing — and the report never calls the stop a
success. Battery CT6 pins this end-to-end, including that the
surviving registration value cannot be renewed by wakes.

### 2.2 Return path

The only return to NORMAL is the operator `clear` transition
above — itself an auditable operator act under its own gate
paperwork (Gate C2/Gate S1 sequencing in
`PHASEB-RECOVERY-GATES-V2.md` treats any live use of a transition
as gated; this design names the mechanism, not its authorization).
There is no automatic expiry, no pass-driven clearing, and no
return path inside a build other than the route. Whether a
*production* clear should ever be permitted outside a stimulus
gate is Rowan's to rule (open item).

## 3. Effects matrix (state × activity)

Anchors: base schedule processing = coordinator `alarm()`
(candidate :2739) called from the base entry class's `alarm()`
(worker-entry.js *(live)* :270) inside the subclass handler's
`super.alarm()` (entry :1902). The `finally` re-arm inside
coordinator `alarm()` calls `_armAlarm()` (candidate :2578; gate
at :2586). Wake-path arming = `_armAlarmIfEarlier()` (candidate
:2722; gate at :2727), called from `wake()` (:2711) and directly
after handleCommand (:643), requestGrant (:1929), handleReport
(:2339), plus `wake()` itself (:2711) — the complete caller census. Drive gate = subclass
handler (entry :1938), after `super.alarm()`, before
recover()/driveOnce(). `recover()` = service.recover();
`driveOnce` = service.mjs *(live)* :1008, sole caller entry.

| activity | NORMAL | DRIVE_CONTAINED | CHAIN_STOPPED |
|---|---|---|---|
| `_armAlarmIfEarlier` (wake paths) | unchanged (shipped/R5a condition) | unchanged — registration is not the drive; the chain must stay armed to keep closing leases | **suppressed** — gate returns before any evaluation; no setAlarm |
| `_armAlarm` (base `finally` re-arm) | unchanged | unchanged | **suppressed** — a delivered pass does not renew the registration |
| `deleteAlarm` | never called | never called | called ONLY by the stop transition itself (§2.1) |
| base schedule processing in `super.alarm()` | runs | runs — leases expire, rows advance/back off, watchdog is re-scheduled | runs **if a pass is delivered** (an in-flight or retried pass cannot be prevented from starting); bounded to that pass; its finally cannot re-arm |
| `recover()` | runs | **skipped** (drive gate) | **skipped** |
| `driveOnce()` invocation | runs | **skipped** — recorder row at stage `contained`, `driveInvoked 0` | **skipped** — same |
| grant issuance | as shipped (not halt-fenced; delivery halt-fenced) | **none** — drive never runs | **none** |
| grant closure (lease-expiry void / outcome paths in `super.alarm()`) | as shipped | **continues** — closure is base schedule processing, deliberately NOT gated (a contained chain still settles its in-flight grant; battery CT2) | continues within any delivered pass; with no passes delivered, closure is **frozen** until a pass runs — stated plainly: a stopped chain leaves an in-flight grant mid-state (the shipped lease path is the only closer, and it needs a pass) |
| queue delivery (outbox drain / sendGrant) | as shipped (halt-fenced today) | unchanged from NORMAL — containment does not touch delivery wiring; while GENERATION_HALT stands, nothing sends in any state | unchanged |
| preserved plan lifecycle | as shipped | frozen at its recorded state (active, entry pending, job queued rev 1, grants only via lease closure) — no advancement, no disposition | frozen identically; the plan, its job, and its occurrence rows are never written by containment in any state (battery CT10 byte-check) |
| pending schedule rows | as shipped | processed normally; never created/modified/deleted BY containment | **preserved in place, untouched** — evidence; they are inert without passes |
| recorder rows | one per pass, as shipped | one per pass at stage `contained` (service read vocabulary extended: `contained` added to DP_READ_STAGES, service candidate :111) | one per DELIVERED pass at stage `contained`; with no delivery, no rows — and that absence, next to `armedAt: null`, is itself the verification signal |
| commands/reports (wake traffic) | processed normally | processed normally | processed normally (commands rows accrue, outcomes on their own merits) but **cannot resurrect the registration** (arm gate) |

## 4. Flag-read failure semantics — the demonstration

### 4.1 Where the state is read

Exactly three consuming places, all through
`readContainmentState(sql)` (candidate :207), which **never
throws and never writes**:

1. the subclass handler's drive gate — once per alarm pass
   (entry :1938);
2. `_armAlarmIfEarlier()` — once per wake evaluation
   (coordinator :2727);
3. `_armAlarm()` — once per delivered pass's finally
   (coordinator :2586).

Plus two non-consuming readers: the operator state route and the
drive=1 diagnostics projection (service), which report the read
(including `verified: false`) and gate nothing. There is **no
caching**: every decision reads the durable row at the moment of
the decision, so a transition is effective at the very next pass
or wake — no stale instance state can outlive it. (The
coordinator is constructed per-request on the API paths and
long-lived in the entry; a cached value would be wrong in both
directions — the same reasoning as the R5a arm memo's rejection
of instance state.)

### 4.2 What a read produces

| read outcome | returned | drive gate | arm gates |
|---|---|---|---|
| table absent / no row | `state: NORMAL, absent: true, verified: true` | runs | arms |
| row = NORMAL | verified | runs | arms |
| row = DRIVE_CONTAINED | verified | **suppressed** | arms |
| row = CHAIN_STOPPED | verified | **suppressed** | **suppressed** |
| row = unrecognized value | `known: false, verified: false` | **suppressed** | **suppressed** |
| SELECT throws "no such table" | treated as absent (structurally verified NORMAL) | runs | arms |
| SELECT throws anything else | `state: null, verified: false, errorName` | **suppressed** | **suppressed** |

### 4.3 The claim, demonstrated

**Claim: a flag-read failure cannot silently defeat a verified
chain stop.** Proof shape, in three layers:

1. **The stop is physical, not just a flag.** A *verified* stop
   means §2.1 completed: the registration was deleted and read
   back null. After that, passes stop arriving *regardless of any
   future read* — there is nothing left for a read failure to
   "defeat" in the delivery path. The flag's remaining job is
   only to prevent *resurrection*.
2. **Resurrection requires a setAlarm, and every setAlarm path
   consults the read with a darker default.** Both arm sites gate
   on `containmentArmSuppressed(read)` (candidate :248): any
   unverified read — a throw, a corrupt value — suppresses. For a
   wake to resurrect the chain after a verified stop, the read
   would have to *succeed and return a wrong NORMAL* — that is a
   storage-integrity failure, not a read failure, and no
   flag-design can survive its storage returning lies; it is
   named here as the residual (§4.5), not papered over.
3. **Suppression is not silent.** Each suppressed arm evaluation
   writes a `containment / arm_suppressed` transitions-ledger row
   (best-effort — a failed note never re-enables registration,
   candidate `_noteContainmentArmSuppressed`), and the next
   delivered pass's recorder row shows the containment stage and
   the un-renewed `armed_after`. A read failure in the DRIVE gate
   is likewise visible: the contained recorder row carries the
   read error's (sanitized) name and a fixed explanatory message
   (entry :1938 block). Battery CT4a/CT4b pin both behaviors,
   including the case Rowan named: **CHAIN_STOPPED + read fault →
   wakes register nothing** (CT4b), and **NORMAL + read fault →
   the pass is contained rather than driving blind** (CT4c).

### 4.4 The cost of fail-closed arming, stated

v1 chose fail-open arming so a storage hiccup could not recreate
the stall incident (a chain that cannot re-arm). This revision
accepts the opposite trade, bounded three ways: (i) the common
case is structurally exempt — absent table verifies as NORMAL, so
containment code can never wedge a pre-containment system;
(ii) a genuine read failure while a stop is recorded leaves the
system stopped-or-darker, which is the safe direction for an
*incident-response* mechanism whose entire purpose is stopping;
(iii) the failure is loud (ledger + recorder + diagnostics report
`verified: false`), and the remedy is an operator diagnosis, not
a mystery stall. The asymmetry from v1 survives for DRIVE in the
same direction (fail-closed both places now), and this paragraph
is the disclosure that the direction changed and why.

### 4.5 Residuals (not claimed away)

- **The stop ACT failing** (state write throws, or deleteAlarm
  throws): the write failure surfaces as the route's HTTP 500
  with the transaction rolled back — reported, state unchanged
  (CT5). The deleteAlarm failure is §2.1's unverified stop —
  reported, state darker, gates holding (CT6). There is no path
  on which a failed act reports success.
- **Storage returning a wrong value successfully** (corruption
  below the SQL layer): out of scope for any flag design; the
  audit events + read-back verification in §5 are the detection
  surface.
- **A pass already inside `driveOnce` when a transition lands**
  is NOT interrupted (§6).

## 5. Verification of containment (passive surfaces only)

Per ruling E, verification must not use a production command or
an alarm wake as an implicit verification step. The design's
verification rests on reads:

1. **State read** — `GET /v2/d6-containment` (operator): the state
   row (`state`, `known`, `absent`, `verified`, `updatedAt`,
   `authorizationRef`), the live `getAlarm()` value, and the
   pending-schedule / pending-watchdog counts. After a stop:
   `state: "CHAIN_STOPPED"`, `verified: true`, `armedAt: null`.
2. **Recorder read** — `drive=1` diagnostics now projects the same
   containment read (`containment` field, service candidate) next
   to the pass rows: after Layer 1, delivered passes appear at
   stage `contained` with `driveInvoked: false`; after a verified
   Layer 2 stop, rows stop accruing and `alarm.armedAt` reads
   null.
3. **Plan/grant reads** — the shipped plan/job surfaces: the
   preserved plan's totals, entry disposition, and grants,
   byte-compared to the pre-containment census.
4. **Audit read-back** — the transition response itself carries a
   fresh `stateRead` (a post-write read of the row, not the
   write's echo), and `d6_containment_events` is inspectable in
   the store.

A containment claim in any gate is made ONLY from (1)+(2) after
the fact — never from a transition response alone, and never by
provoking a pass or a wake to "see if it works".

## 6. What containment cannot do (restated at full strength)

- **It cannot interrupt an already-running operation.** A pass
  inside `driveOnce` when `contain_drive` or `stop_chain` lands
  runs to completion. Worst case for that one pass, from source
  constants: ≤1 grant issued for the preserved plan's occurrence,
  derived reserved 0 → 12, ≤12 attempts for the occurrence
  (`SEGMENT_ATTEMPT_BUDGET`, gen-constants.mjs:16), per-attempt
  upper 12,803 units, occurrence ceiling 153,636 units ≈ $0.154
  (gen-constants.mjs:95); dispatched stays 0 while the halt wiring
  stands. A provider dispatch already sent cannot be recalled —
  unreachable under current holds (dispatch is halt-fenced).
- **It cannot disposition anything.** The preserved plan, the
  exemption, any grant, and any schedule row keep their existing
  holds and gates; containment writes none of them (CT10).
- **It cannot revive anything.** Clearing is not a wake; the
  registration stays absent until ordinary traffic re-arms
  (CT9's return-path assertions).
- **STOP (the operator's gate-level stop) still binds stimuli
  only** — correction 6 stands verbatim in the gate paperwork;
  containment is the mechanism that gives a *future* stop a chain
  effect, and it exists only once deployed under Gate C1 and
  verified under Gate C2.

## 7. Interaction with R5a

- Registration and drive are separate axes: in DRIVE_CONTAINED,
  the R5a condition operates exactly as specified (its
  registrations continue; only drive is gated). In CHAIN_STOPPED,
  the containment arm gate precedes the R5a evaluation in
  `_armAlarmIfEarlier` (composed coordinator): a suppressed
  evaluation is not a registration and never touches the arm memo.
- The R5a mutation budget is unaffected in NORMAL and
  DRIVE_CONTAINED, and is zero-by-suppression in CHAIN_STOPPED.
  The unresolved traffic-bound item (ruling decision 3) is
  unchanged by containment; containment bounds its *consequences*
  (a revived chain can be contained/stopped), not its rate.
- Deployment composition: the composed tree (containment +
  R5a on the live build) is built and tested offline
  (`containment/CANDIDATE-IDENTITIES.md`); the gate sequence
  deploys containment first and verifies it (Gates C1/C2) before
  the R5a deployment (Gate R5a-D), per ruling decision 5.
