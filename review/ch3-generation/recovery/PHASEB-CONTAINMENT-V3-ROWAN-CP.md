# Phase B — containment correction package #2: for Rowan's review

Rowan — your containment-correction ruling (relayed
verbatim by Julie 2026-11-02; my record:
`ROWAN-CONTAINMENT-CORRECTION-RULING.md` — no board copy
exists; the relay is the only record, and I did not
duplicate-post it) is answered below, item by item. All
work is OFFLINE: design revision, implementation in new
scratch trees, batteries, paperwork. **No production calls
of any kind. Production remains HELD** (instrumented build
`86ad06ab…`, halt "1", queue paused, preserved plan +
exemption untouched). No GO is requested. **Turn: yours.**

Package contents: `PHASEB-CONTAINMENT-DESIGN-V3.md`
(supersedes the revised design), `PHASEB-CONTAINMENT-
ASYNC-ANALYSIS.md` (new), `PHASEB-RECOVERY-GATES-V3.md`
(supersedes gates v2), `containment-v3/` (candidates,
diffs, fixtures, battery, logs), `suites-v3/` (regression
fixtures + logs). The v2 candidates and their pinned
record at `e6e91870` are untouched.

## A — Gate restructure: five gates

`PHASEB-RECOVERY-GATES-V3.md`: **C1** (containment V3
deployment, ends inert), **C2** (passive
deployment/readability verification — relabeled everywhere;
its classification limit is stated in C2's own text:
*"A passed C2 is NOT proof of operational containment
effectiveness"*; I grepped gates v3 + design v3 for
phrasing implying otherwise — every C2 verdict reference
now reads READABILITY VERIFIED and operational claims
attach only to C3, always with PARTIAL), **C3** (new;
below), **R5a-D** (composed V3 deployment), **S1** (R2
stimulus, readiness pair REMOVED, hard dependency on C3 +
your remainder ruling + the standalone restoration).
Sequence: C1 → C2 → R5a-D → C3 → standalone restoration
authorization → S1. R5a-D precedes C3 so C3 exercises the
final composed build; C3 on the containment-only build
would leave the composed transition path live-unexercised.

## The C3 scope analysis (your hard constraint, applied)

An operator containment transition is a state-row write +
a route call. It is not an alarm wake: it delivers no
pass, evaluates no schedule, registers nothing
(`contain_drive`/`clear` touch no alarm API; `stop_chain`'s
only alarm-API acts are the subtractive `deleteAlarm()` +
`getAlarm()` reads). Exercising transitions therefore does
not provoke an alarm or command in the prohibited sense.

What C3 verifies live: (1) transition mechanics +
persistence + both-surface read-back; (2) the
DRIVE_CONTAINED → NORMAL return (§5.2, reasoned clear)
restoring the gate's own opening state; (3) **the full
physical stop act against the CURRENT stale registration**
— `armedAt` 1793562576104 is already there to be read, so
the stop is observable end-to-end (before-value → delete
→ null read-back → `stopStatus: verified`, drive=1
`armedAt: null`, schedule rows unchanged) while provoking
nothing; (4) stop-record durability.

**Recommendation: the full stop act belongs IN C3**, which
ends CHAIN_STOPPED/verified. The alternative (mechanics
pair only; stop act deferred to S1's emergency budget)
was considered and not chosen: it leaves the most
consequential physical act unverified until it is needed
as an emergency measure, and makes S1 the first live test
of containment — against your item E in spirit and text.
The cost is stated in the gate: after C3 the registration
is ABSENT until a standalone restoration + a later
ordinary wake re-register it. **This choice is flagged as
a ruling item for you.**

**What C3 cannot prove (labeled PARTIAL in the gate's own
title and verdict, returned for your separate ruling):**
drive suppression during a live chain — observable only
when a pass would otherwise run, and manufacturing that
pass is a stimulus; arm-gate suppression under genuine
concurrent wake traffic; the §7 re-check against a real
racing wake; any property of a revived chain under
containment. S1's text bars proposing it until you rule
on this remainder. Nothing in the package labels partial
verification complete.

## B — Stop-chain re-verification / retry

Implemented as designed (design v3 §2–§3). The stop
record is six columns on the state row; three facts are
kept separate on both read surfaces (enum /
last-physical-verification / stop-verification status);
NULL status under CHAIN_STOPPED reads as NOT verified —
the enum never stands in for physical reality.
`stop_chain` persists its own record (status, observed
armed values, attempts = 1) inside its commit transaction.
The new operator action **`verify_chain_stop`**: refuses
unless a verified read shows CHAIN_STOPPED; observes
`getAlarm()`; deletes ONLY if a registration is present;
reads back; writes the verified flag ONLY from that null
read-back; appends EVERY attempt to the audit table
(attempt #, before/after, delete attempted?, error name);
idempotent (no delete when absent; an already-verified
record is confirmed, not relabeled); NEVER moves the
enum, NEVER downgrades, NEVER clears. **Bound:
`MAX_STOP_VERIFY_ATTEMPTS = 3` per stop episode**
(stop_chain's act counts as attempt 1); at the bound,
further calls are refused `containment_verify_attempts_
exhausted` and write nothing — more retries require a
fresh episode, which requires a §5 clear + new stop, i.e.
fresh authorization. The bound's value is my judgment
call, flagged for your ruling. Battery CT11 covers both
failure shapes (delete faulted; delete landed but
read-back faulted), refusal off-state, the bound + episode
reset, no-downgrade, and idempotent confirmation.

## C — Async safety evidence: the centerpiece

Full trace: `PHASEB-CONTAINMENT-ASYNC-ANALYSIS.md`
(boundary inventory with v3 line anchors; every claim
labeled SOURCE-PROVEN / PLATFORM-DOCUMENTED /
HARNESS-ONLY; harness-only claims collected as platform
uncertainties in its §6). Headlines:

- **The finally re-arm is SOUND.** `_armAlarm` reads its
  gate synchronously, immediately before initiating
  `setAlarm`, in one stretch — a stop committed before the
  stretch is seen; one committed after lands its delete
  after the registration. Last physical act wins. No
  defect, no fix. (Your hypothesized defect does not exist
  at this site.)
- **A REAL DEFECT exists one function over, in
  `_armAlarmIfEarlier`** — in the v2 candidate AND in the
  shipped shape it derives from. The gate is read BEFORE
  `await getAlarm()`; the `setAlarm` decision is made
  AFTER it, from the pre-await verdict. A stop committed
  during that await is invisible: the wake then resurrects
  the chain over a VERIFIED stop — via the stale-value
  branch (`due < armed`) AND via the null branch
  (re-arm-if-unarmed), i.e. branch-independent. Worse, the
  stop record keeps saying `verified` while a registration
  physically exists: record and reality diverge silently.
  **Harness reproduction:** the new race tests CT13a/CT13b
  run against the v2 candidate tree FAIL at exactly the
  resurrection assertion in both branches (`alarmCalls`
  1 ≠ 0; log pinned with this package, exit 1).
- **Fix (v3):** `_armAlarmIfEarlier` re-checks the gate
  after the `getAlarm()` await, in the same synchronous
  stretch that initiates `setAlarm` (no await between
  re-check and act). The memo branch needs no re-check (no
  intervening await); `_armAlarm` needed none (above).
  CT13a/CT13b pass on both v3 trees; CT13c shows a
  verify-delete landing under a parked wake (last physical
  act wins, record stays truthful); CT13f shows the
  re-check itself failing darker on a state-read fault.
- **Transition vs an already-running pass, stated
  exactly:** the pass's drive gate is read once, before
  recover()/driveOnce(); a transition landing mid-pass
  does NOT interrupt it — the pass completes under its
  gate-time state, including issuing its grant (CT13d for
  contain, CT13e for stop); the NEXT pass observes the new
  state. A pass delivered inside the stop's commit→delete
  window is already gated by the committed state — the
  gates hold before the physical delete lands (§4.5 of the
  analysis). Death between commit and delete leaves
  CHAIN_STOPPED with a NULL record = unverified-by-absence;
  `verify_chain_stop` is the remedy, and it never infers.
- **A-3 is NOT upgraded.** Cross-invocation serialization
  remains an assumption; the analysis names exactly which
  properties rest on synchronous-stretch atomicity alone
  (the §4.1/§4.2 stop properties) and which still lean on
  A-3 (audit ordering across racing transitions).

## D — Restoration policy

Design v3 §5 + gates v3, consistently: **no automatic
clear anywhere** (source census: `clear` is reachable
only via the operator route; CT12c runs an unverified
stop across a simulated day of passes, wakes, commands,
and reads — state and record stand). Return to NORMAL
requires explicit authorization + fresh census + a
**demonstrated reason recorded in the audit event** —
`clear` now REFUSES a missing/blank reason
(`containment_reason_required`, method and route; route
allowlist gains `reason`, ≤2000 chars). Paths are
separate: DRIVE_CONTAINED → NORMAL under the scoping
gate's authorization (§5.2); **CHAIN_STOPPED → NORMAL
only under the standalone explicit authorization**
(decision 2) with the §5.3 preconditions, including that
the stop record be known (verified, or a stated reason to
abandon the stop with the registration's value read and
recorded). **Clear never re-arms** — the registration
stays absent until the first subsequent ordinary wake
(CT12b), and pending schedule rows are preserved through
stop and clear alike (CT10/CT12b byte-checks). In the
gate sequence, the standalone restoration is its own
named step between C3 and S1 with its own GO wording;
C3's GO explicitly does not cover it (C3's internal clear
applies only to its DRIVE_CONTAINED mechanics leg).

## E — Gates revised

Covered in A above and in gates v3 itself: readiness
pair removed from S1 into C3; S1 states its dependency
explicitly and contains NO containment transition in
preflight; R2 identity, the one-command limit, the
mandated negative wording ("no observed revival within
the tested window, subject to recorder limitations"),
correction 6 verbatim, and both holds are preserved.

## F — Evidence integrity

All v2 pinned identities/logs/assertions retained;
nothing overwritten (the v3 trees are new scratch). The
affected suites were rerun against the EXACT v3
candidates (fixtures in `suites-v3/fixtures/`):

| run | result | exit |
|---|---|---|
| Containment battery v3 — candidate tree | **32/32** | 0 |
| Containment battery v3 — composed tree | **32/32** | 0 |
| P2 parameterized regression — v3 candidate | **32/32** | 0 |
| P2 parameterized regression — v3 composed | **32/32** | 0 |
| R5a suite — v3 composed | **23/23** | 0 |
| CT13a/CT13b ONLY — **v2 candidate** (defect demo) | **0/2, both fail as designed** | 1 |

Battery adaptations, disclosed in the battery header:
none deleted or loosened — CT1's diagnostics deep-equal
was EXTENDED with the six new projection fields; CT9/CT10
clear calls now pass the required reason (a v3 contract
strengthening; CT12 refuses reason-less clears); CT0
markers extended; CT3/CT6 gained stop-record assertions.
One disclosure on my own process: my first P2 invocations
passed the LIVE tree as the suite's BASE (its BASE is the
unmodified pre-instrumentation build), producing 3
harness-semantics failures unrelated to the candidate;
corrected to the suite-default baseline and rerun clean,
as recorded in
`containment-v3/CANDIDATE-IDENTITIES.md`. Platform-only
uncertainties are listed in the analysis §6 — including
that the harness cannot prove the §4.2 interleaving is
executable on the real platform (if invocations strictly
serialize, the defect is latent, not live; the fix is
harmless either way, and I do not claim to know).

Standing items carried at full strength: the 3,600,000 ms
threshold remains a **provisional candidate only**; the
absent traffic-independent rate bound remains an **open
execution risk**; B3 stays **closed**; the step-0
substitution remains a procedural variance for any later
generation gate.

## Unresolved ruling items (yours)

1. Gate set v3 as separate scopes — approval per gate
   (none requested executed here).
2. C3's scope: full stop act inside C3 (recommended) vs
   mechanics-only with the stop act in S1's budget.
3. C3's unverifiable remainder — how (or whether) it is
   discharged before S1 may be proposed.
4. `MAX_STOP_VERIFY_ATTEMPTS = 3` — the bound's value.
5. The `reason`-field contract on `clear` (required,
   ≤2000, audited) — as the code-level half of your
   decision 2.
6. A-3 remains an assumption — whether the §4 analysis
   discharges your item C at that strength.

**Turn: Rowan's.** No GO requested; production HELD.
