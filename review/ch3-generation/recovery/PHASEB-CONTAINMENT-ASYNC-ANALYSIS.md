# Phase B — containment async-safety analysis (await boundaries, races, evidence classes)

**Status: OFFLINE ANALYSIS + HARNESS EVIDENCE. NOT AN
EXECUTION APPROVAL.** Prepared under Rowan's
containment-correction ruling (relayed verbatim by Julie
2026-11-02), item C. Method: every boundary below was traced
in the ACTUAL candidate source — the containment V3 candidate
tree (`containment-v3/candidate-tree/v2/…`; the composed
tree's containment code is byte-identical) — and each claim
is labeled with its evidence class (§1). The centerpiece
(§4.2) is a REAL DEFECT found by this trace in the v2
candidate (and in the shipped code it derives from),
reproduced in the harness against the v2 tree, and fixed in
v3. Design consequences are in
`PHASEB-CONTAINMENT-DESIGN-V3.md` §3/§7. Production is
untouched and HELD.

## 1. Evidence classes (used consistently, nothing upgraded silently)

- **SOURCE-PROVEN** — follows from the candidate source text
  plus JavaScript semantics (a synchronous stretch of code
  cannot be interleaved; an `await` is a suspension point).
  No platform fact is needed.
- **PLATFORM-DOCUMENTED** — rests on the Cloudflare platform
  documentation items already established in the alarm
  assessment package (D-1/D-2/D-4/D-7, §5). Cited, not
  re-derived.
- **HARNESS-ONLY** — demonstrated in the offline harness
  only. Every harness-only claim is ALSO listed in §6 as a
  platform uncertainty for Rowan. The harness invokes
  `alarm()` directly, serializes invocations the way the
  test drives them, and mirrors real-DO `.one()` throw
  semantics; it cannot prove platform delivery, retry, or
  cross-invocation scheduling behavior.

**Explicitly NOT upgraded:** assumption **A-3** (the
platform serializes invocations of one Durable Object such
that storage operations of two invocations do not interleave
arbitrarily) remains an **ASSUMPTION**, exactly as the
accepted retry/assessment package left it. Where a v3
property holds ONLY under A-3, this document says so. The
§7 gate re-check exists precisely to make the headline stop
property hold WITHOUT leaning on A-3 for the wake path (§4.2).

## 2. Call-site census (v3 candidate; complete)

`setAlarm` is called from exactly two coordinator sites:
`_armAlarm` (coordinator :2658; from the base `alarm()`
finally, :3034) and `_armAlarmIfEarlier` (:2966; callers
`wake()` :2955, `handleCommand` :723, `requestGrant` :2009,
`handleReport` :2419 — plus `wake()`'s internal call :2959).
`deleteAlarm` is called from exactly two sites: the
`stop_chain` physical act and `_verifyChainStop` (:2871) —
both inside the containment transition path; nothing else in
the build deletes a registration. `getAlarm` is read at:
`_armAlarmIfEarlier` (:2966 region), the stop/verify physical
sequences, the drive-pass recorder (end of the subclass
handler), and the drive=1 diagnostics read
(service :1779 region). Containment state is READ at: the
subclass drive gate (entry :1959), both arm gates and their
re-check, every transition, the state route, and the drive=1
projection (service :1819). Containment state is WRITTEN
only inside `applyContainmentTransition` /
`_verifyChainStop`. [SOURCE-PROVEN: grep census over the
candidate tree; the containment battery CT0 marker set pins
the vocabulary.]

## 3. The boundary inventory

### 3.1 The subclass alarm handler (entry :1924), step by step

1. `await super.alarm()` (:~1945) → base entry `alarm()`
   (worker-entry.js *(live)* :270) → coordinator `alarm()`
   (:3003): due schedule rows processed one at a time
   (`_processScheduleRow` :3038; its head carries the
   `env.scheduleHook` fault seam :3040); **`finally` →
   `_armAlarm()`** (:3034). Inside `_armAlarm` (:2658): the
   containment gate read and the `setAlarm` initiation are
   in ONE synchronous stretch after the due computation —
   no `await` intervenes — so a transition cannot commit
   between this gate read and the act it guards.
   [SOURCE-PROVEN] A transition committed BEFORE the stretch
   is seen; one committed after the `setAlarm` initiation
   lands its `deleteAlarm` after it (§4.1).
2. **Drive gate read** (:1959): synchronous SQL read of the
   singleton. What a concurrent operator transition can
   change: nothing DURING the read (synchronous); a
   transition committed before it is fully seen; one
   committed after it is invisible to THIS pass (§4.4).
3. `await service.recover()` (:1975): synchronous internally
   (a store scan; no awaits, no alarm API). Skipped entirely
   when the gate suppresses.
4. `await service.driveOnce()` (:1978): the long pole.
   Awaits inside include the grant path:
   `requestGrant` (:2005) → `await this.wake()` → `_armAlarm
   IfEarlier`'s `getAlarm()` await (:2966 region) — **the
   suspension point CT13d/CT13e park at** — then grant
   issuance (one transaction), then a post-grant
   `_armAlarmIfEarlier` (:2009). A transition landing
   anywhere in here does not interrupt the pass (§4.4); its
   arm paths meet the gate (first read or §7 re-check) like
   any wake's.
5. `await cache.flush()` and the recorder write close the
   handler; the recorder's `getAlarm()` read observes the
   registration as it stands at pass end — after any racing
   transition's delete — which is why a contained-later pass
   can record `armedAfter: null` truthfully.

### 3.2 Other boundaries

- **Transition writes** (`applyContainmentTransition`): DDL
  → state read → state+audit commit (`_tx`, synchronous SQL)
  → for `stop_chain`, the physical sequence AFTER commit:
  `getAlarm()` await → `deleteAlarm()` await → `getAlarm()`
  await → record persistence (`_tx`). The window between
  commit and delete completion is §4.5's subject. For
  `verify_chain_stop` (:2871): read → bound check → the same
  physical sequence → record+audit persistence; no state-row
  write precedes its physical act, so its window differs
  (§4.3).
- **Command/report fetches** (`handleCommand` :675,
  `handleReport` :2262): each ends with a wake/arm path
  (:723 / :2419), so every boundary statement about wakes
  applies to them unchanged. They never write containment
  state. [SOURCE-PROVEN]
- **A second alarm invocation** (platform retry or a fresh
  delivery) starts at §3.1 step 1 and reads the gate fresh;
  nothing carries gate state between invocations except the
  durable row itself. [SOURCE-PROVEN for the code side;
  whether two invocations of one DO can be CONCURRENT is
  A-3 territory — §5.]

## 4. Centerpiece traces

### 4.1 The finally re-arm vs a racing stop — SOUND (no defect)

Question (ruling's formulation): if the base handler's
`finally` re-arms unconditionally, a stop racing a running
pass could be undone by the pass's own re-arm. Trace: the
finally calls `_armAlarm()` (:3034 → :2658), which reads
the containment gate FIRST, synchronously, immediately
before initiating `setAlarm` in the same stretch (§3.1.1).
A stop committed before that stretch → gate suppresses, no
re-arm. A stop committed after the `setAlarm` initiation →
its `deleteAlarm()` is the later physical act and removes
what the finally registered. Either ordering ends stopped.
**No defect; no fix needed; the design gates the finally
re-arm and the gate's placement is load-bearing.**
[SOURCE-PROVEN. Battery: CT3 (delivered pass after a stop
does not re-arm), CT13e (mid-pass stop; the pass's arm paths
leave `alarmAt` null).]

### 4.2 `_armAlarmIfEarlier` vs a racing stop — **DEFECT (v2), FIXED (v3)**

The shipped/v2 shape (composed candidate :2966 region,
pre-fix): gate read (sync) → `await getAlarm()` →
due computed (sync) → `await setAlarm(due)` if
`armed === null || due < armed`. The gate verdict is taken
BEFORE the await; the act happens AFTER it. Interleaving:

1. A wake (command, report, grant path — §2 callers) reads
   the gate: NORMAL. It awaits `getAlarm()`.
2. While it is suspended, `stop_chain` runs to completion:
   state commits CHAIN_STOPPED, `deleteAlarm()` lands,
   read-back null — a VERIFIED stop.
3. The wake resumes. Branch (a): its read was processed
   before the delete → it holds the stale armed value A;
   the earliest pending due D < A (a watchdog is almost
   always earlier) → condition true → `setAlarm(D)`:
   **the chain is resurrected over a verified stop.**
   Branch (b): its read was processed after the delete →
   `armed === null` → the re-arm-if-unarmed branch fires →
   `setAlarm(D)`: **same resurrection.**

In both branches the ONLY record of the event is the
transitions-ledger suppression note — which is not written,
because the gate was never re-evaluated; and the stop record
still says `verified` while a registration physically
exists: the record and reality diverge silently.
[SOURCE-PROVEN from the code shape; HARNESS-REPRODUCED:
battery CT13a/CT13b run against the v2 candidate tree FAIL
at exactly the resurrection assertion — `alarmCalls` 1 ≠ 0
in both branches (log `containment-v3/logs/containment-v3-
races-on-v2-tree.log`, exit 1).]

**Fix (v3, design §7):** after the `getAlarm()` await,
re-read the gate in the same synchronous stretch that
initiates `setAlarm` (candidate :2985–2999, comment +
`containmentArmSuppressed` re-check). Now: any stop
committed before the re-check is seen and the arm is
suppressed (with the ledger note, path
`_armAlarmIfEarlier#recheck`); a stop committed after the
`setAlarm` initiation deletes after it — last physical act
wins, as in §4.1. The fix does not depend on which branch
of step 3 the platform takes for an in-flight read.
[SOURCE-PROVEN for the post-fix code shape; HARNESS-ONLY
for the interleaving's executability — CT13a/CT13b pass on
both v3 trees; §6 lists the platform question.]

### 4.3 `verify_chain_stop`'s delete vs a parked wake

Interleaving: wake parked at its `getAlarm()` (gate read:
NORMAL, pre-stop) → `stop_chain` with a faulted delete →
UNVERIFIED stop, registration surviving → `verify_chain_
stop` observes the registration, deletes, reads back null
→ `re_verified` → the wake resumes with a stale read. With
the §7 re-check the wake sees CHAIN_STOPPED and registers
nothing; the audit shows stop_chain (applied) →
stop_chain_verify (unverified) → verify_chain_stop
(verified), and the stop record matches physical reality.
Without the re-check this is §4.2 branch (a) again — which
is why the fix is in the wake path, not in verify.
[HARNESS-ONLY demonstration: CT13c, passing on v3.]

### 4.4 A transition racing an ALREADY-RUNNING pass

The pass's drive gate is read ONCE, at §3.1 step 2, before
`recover()`/`driveOnce()`. Consequences, stated exactly:

- **The running pass completes under the state it read.**
  A `contain_drive` or `stop_chain` landing mid-pass does
  NOT interrupt it: if it read NORMAL, it proceeds —
  including issuing its grant if the grant step comes —
  because drive suppression is a gate on pass START, not a
  mid-pass abort. (CT13d: grant issued, recorder stage
  `complete`. CT13e: grant issued under a mid-pass stop.)
  [SOURCE-PROVEN from gate placement; HARNESS-ONLY for the
  interleaving execution.]
- **The NEXT pass observes the new state** (fresh read at
  its own gate). [SOURCE-PROVEN; CT13d/CT13e assert the
  next pass records `contained`.]
- A mid-pass stop's delete races the pass's arm paths
  exactly as §4.1/§4.2 describe; post-fix, the final
  physical state is stopped and the stop record stands.
  (CT13e asserts `alarmAt` null and `stopStatus: verified`
  after the pass completes.)
- What the running pass can still DO under the holds:
  base schedule processing and its one grant cycle — the
  §7.3 pre-classified effects. Containment never claimed
  to retroactively cancel in-flight work (revised design
  §6, carried).

### 4.5 A pass delivered DURING the stop act (commit → delete window)

Between `stop_chain`'s state commit and its delete/read-
back completing, the state already reads CHAIN_STOPPED: a
pass delivered in the window is contained at its drive
gate and its finally/wake arms are suppressed (§4.1/§4.2
post-fix) — the gates hold BEFORE the physical delete
lands; the delete is what makes the stop durable against
FUTURE platform deliveries, not what makes suppression
true. If the delete then fails, the outcome is the CT6
posture (unverified record, gates holding, registration
surviving but unrenewable). [SOURCE-PROVEN for gate
ordering; HARNESS-ONLY for the window's existence — CT6 +
CT13e bound it from both sides.]

### 4.6 Death between commit and delete

If the invocation dies after the state commit but before
(or during) the physical sequence, the stop record's
persistence — which happens after the read-back — never
runs: the row stands CHAIN_STOPPED with a NULL stop record
= unverified-by-absence (design §2.1), the registration may
or may not survive, and NO component retries on its own.
The remedy is exactly `verify_chain_stop` (§3 of the
design), whose observe-first sequence resolves both
sub-cases (registration present → delete + read-back;
absent → confirm from the read-back) without ever
inferring. [SOURCE-PROVEN for the write ordering;
HARNESS-ONLY analogue: CT11b (delete landed, read-back
failed) and CT6 (delete failed) are the two reachable
sub-postures, both resolved by CT11's verify flows. A
literal mid-sequence process death is not expressible in
the harness — §6.]

## 5. Platform facts relied on (documented; A-3 stays an assumption)

- **D-1** (assessment census): an alarm registration, once
  set, is what `getAlarm()` returns until replaced or
  deleted; a past-due value persists as set while delivery
  is pending/failed. Used by: §4.2 branch (a) — a suspended
  read CAN return the pre-delete value only if the platform
  processed it before the delete; the fix is branch-
  independent, so no claim leans on which branch is real.
- **D-2 / D-7**: platform retries apply to the most recent
  `setAlarm` call (≤6 attempts, backoff from 2 s); a fresh
  `setAlarm` supersedes a pending retry. Used by: the R5a
  package (unchanged); §4 statements about "a delivered
  pass" include retried deliveries.
- **D-4**: `deleteAlarm` removes the registration such that
  a subsequent `getAlarm()` reads null. Used by: every
  verification read-back in the design.
- **A-3 (ASSUMPTION, not upgraded):** cross-invocation
  serialization inside one DO. The v3 properties that hold
  WITHOUT A-3: the stop-vs-wake properties of §4.1/§4.2
  (they rest on synchronous-stretch atomicity within one
  invocation plus last-physical-act ordering across
  invocations). Properties that still lean on A-3: that
  two transitions cannot interleave their `_tx` commits
  (the transition table + verified-read preconditions make
  a lost race REJECTED rather than corrupt even then, but
  the neat audit ordering is A-3-flavored), and that a
  transition and a pass cannot be inside their synchronous
  stretches truly simultaneously (on a single-threaded
  isolate this is language semantics; across isolates it
  is A-3).

## 6. Platform uncertainties (harness-only claims, for Rowan)

1. Whether the platform can actually suspend one invocation
   at an alarm-API await while another invocation of the
   same DO runs to completion (the CT13 interleavings
   assume it for the sake of the worst case; if the
   platform strictly serializes invocations, §4.2's defect
   is latent rather than live — the fix is harmless either
   way, and the analysis does not claim to know).
2. Which branch an in-flight `getAlarm()` takes when a
   `deleteAlarm` lands while the read is outstanding
   (§4.2 step 3) — the fix is branch-independent by
   construction.
3. Whether a process death can strand the stop act between
   commit and record persistence exactly as §4.6 models
   (the harness cannot kill an invocation mid-sequence).
4. Alarm delivery/retry behavior generally (standing
   caveat): the harness re-invokes the handler; real
   platform retry timing and coalescing are D-2/D-7
   documentation, not measurement.
5. Real-DO SQLite behavior beyond the mirrored `.one()`
   throw (standing caveat for every package).

## 7. Battery mapping (item C tests)

CT13a/CT13b (§4.2, both branches; FAIL on v2, pass on v3) ·
CT13c (§4.3) · CT13d/CT13e (§4.4, both transitions) ·
CT13f (re-check under a state-read fault: unverified →
suppressed — the darker branch at the new boundary) ·
CT3/CT6/CT8 (carried; §4.1, §4.5 postures). Full record:
`containment-v3/CANDIDATE-IDENTITIES.md`.
