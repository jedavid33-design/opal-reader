# Phase B — independent containment design, V3 (stop-record, verification/retry, restoration)

**Status: DESIGN + OFFLINE IMPLEMENTATION. NOT APPROVED FOR
EXECUTION.** Prepared under Rowan's containment-correction
ruling (relayed verbatim by Julie 2026-11-02; record
`ROWAN-CONTAINMENT-CORRECTION-RULING.md`), items B, D, and the
design halves of A/C/E/F. This document **supersedes**
`PHASEB-CONTAINMENT-DESIGN-REVISED.md` (pinned at `e6e91870`,
retained as history). The three-state core Rowan accepted —
one singleton enumerated state (NORMAL / DRIVE_CONTAINED /
CHAIN_STOPPED), the two-layer arm gates, darker-branch read
semantics, the audit table, and the effects matrix — is carried
UNCHANGED except where this document explicitly revises it:
§2 (the stop record), §3 (the verification/retry action), §5
(restoration policy), §6 (the C2/C3 verification split), and
§7 (the `_armAlarmIfEarlier` gate re-check, from the async
analysis). Gates: `PHASEB-RECOVERY-GATES-V3.md`. Async
evidence: `PHASEB-CONTAINMENT-ASYNC-ANALYSIS.md`. Candidates:
`containment-v3/` (identities in
`containment-v3/CANDIDATE-IDENTITIES.md`). Production is
untouched and HELD.

Line anchors below are the containment V3 candidate tree
(`containment-v3/candidate-tree/v2/…`) unless marked *(live)*.

## 1. The state store (carried, plus the stop record)

As revised design §1: one singleton row in
`d6_containment_state`, one enumerated value, one audit table
`d6_containment_events`. V3 adds six columns to the state row
— the **stop record**, written only by stop actions (§2):

`stop_status TEXT` · `stop_verified_at INTEGER` ·
`stop_verify_action TEXT` · `stop_armed_before INTEGER` ·
`stop_armed_after INTEGER` · `stop_verify_attempts INTEGER
NOT NULL DEFAULT 0`.

The DDL is the same `CREATE TABLE IF NOT EXISTS` statement
form as v2, with the full column set: a fresh table is
created WITH the columns, and no production containment
table exists today (no transition has ever run live), so
there is no migration step. (Had a v2-shaped table existed,
the new columns would be absent and every containment read
would fail closed — unverified, darker — until the table was
recreated; that posture is stated so the deploy-time check
in Gate C1 can name it.)

## 2. The stop record — three facts, kept separate permanently

Ruling item B: the design must never let the stored enum
stand in for physical reality. The read surface therefore
exposes **three separate facts**, and no consumer may merge
them:

1. **The state enum** (`state`, with `known` / `absent` /
   `verified` read-integrity flags, as before).
2. **The last physical verification**: `stopVerifiedAt`
   (when), `stopVerifyAction` (which action: `stop_chain` or
   `verify_chain_stop`), `stopArmedBefore` /
   `stopArmedAfter` (the `getAlarm()` values that action
   observed around its delete).
3. **The stop-verification status** (`stopStatus`): one of
   `verified` / `unverified` / `re_verified`, or **NULL**.

### 2.1 Semantics

- `stop_verified_at` means exactly one thing: **the last
  time a stop action observed a null read-back.** A
  successful verification updates it; a failed one leaves it
  untouched. It is never written from inference.
- `stopStatus` is written ONLY from a `getAlarm()` null
  read-back observed inside the same action that writes it
  (`verified` when the stop_chain act itself verified;
  `re_verified` when a later `verify_chain_stop` moved an
  unverified or unrecorded stop to verified; `unverified`
  when the action's physical sequence did not produce a null
  read-back). **NULL under CHAIN_STOPPED means NOT verified**
  (no stop action has recorded an outcome — e.g., the record
  write itself failed); every consumer treats NULL as
  unverified. STOP_UNVERIFIED remains a *reported outcome*
  (the transition/verify response), never a stored state —
  the stored representation of that outcome is
  `stopStatus = 'unverified'` (or NULL) under the unchanged
  enum CHAIN_STOPPED.
- **Episode semantics:** `stop_verify_attempts` counts the
  physical stop-verification attempts of the CURRENT stop
  episode: `stop_chain`'s own act is attempt 1; each
  `verify_chain_stop` adds one. A `clear` resets all six
  fields (NULL / 0) — the next stop opens a fresh episode at
  attempt 1 (battery CT11d).
- `stop_chain` persists its record **inside its state-commit
  transaction** (status, observed values, attempts = 1, and —
  on failure — the `stop_chain_verify` audit event). If that
  persistence itself fails, the transition surfaces the
  failure (HTTP 500 at the route) and the row keeps a NULL
  status, which §2.1 reads as unverified: there is no path
  where a stop is recorded as verified without the null
  read-back having been observed and durably written.

### 2.2 Read surfaces (all three facts, both surfaces)

- `GET /v2/d6-containment` returns the state fields plus
  `stopStatus`, `stopVerifiedAt`, `stopVerifyAction`,
  `stopArmedBefore`, `stopArmedAfter`, `stopVerifyAttempts`.
- The `drive=1` diagnostics `containment` projection carries
  the same six fields (allowlist-projected; a pre-v3
  coordinator read projects them as null/0).
- Battery CT3/CT6/CT11 assert the record on both surfaces and
  against the audit trail.

## 3. `verify_chain_stop` — the re-verification / retry mechanism

A fourth operator action on the same route and method
(coordinator candidate :2871), answering: *state ==
CHAIN_STOPPED, but the physical deletion was unverified —
how is that ever resolved, audibly?*

**Sequence** (each step's outcome lands in the audit event's
`detail_json`): read state (refuse unless a VERIFIED read
shows CHAIN_STOPPED — otherwise `containment_verify_not_
stopped`, or `containment_transition_refused` on an
unverifiable read; a refused verify appends NO event) → check
the attempts bound (below) → observe `getAlarm()` → **iff a
registration is present, `deleteAlarm()`** → read back
`getAlarm()` → persist the stop record + one audit event
(action `verify_chain_stop`, outcome `verified` /
`unverified`, detail `{attempt, armedBefore, armedAfter,
deleteAttempted, verifyError}`) in one transaction → respond
with the outcome and the full state read.

**Properties:**

- **Never infers.** The verified flag is written only from
  the null read-back observed in THIS action (§2.1). If the
  observe read itself throws, no delete is attempted (the
  action does not delete blind) and the attempt records
  unverified with the error's name.
- **Idempotent.** Safe to repeat: with the registration
  already absent it performs no delete, appends its audit
  event, and confirms; on an already-`verified` record the
  status stays `verified` (it is not relabeled
  `re_verified`), and the response reports `idempotent:
  true` (CT11f).
- **No downgrade, no clear.** The action NEVER changes the
  enum, NEVER clears, and a failed attempt leaves everything
  exactly as it was except the audit append and the attempts
  counter (CT11e). The state remains CHAIN_STOPPED until a
  §5 clear.
- **Bounded.** Attempts per stop episode are bounded by
  `MAX_STOP_VERIFY_ATTEMPTS = 3` (the stop_chain act counts
  as attempt 1, so at most two `verify_chain_stop` calls per
  episode). At the bound, further calls are refused
  `containment_verify_attempts_exhausted` BEFORE any physical
  act and write nothing; more retries then require a fresh
  episode — which itself requires a §5 clear and a new stop,
  i.e., fresh authorization (CT11d). **The bound's value (3)
  is a design choice flagged for Rowan's ruling** (§9), not a
  derived constant.
- **Race posture** (analysis §4.3): a verify delete racing a
  wake that already passed its gate — the LAST PHYSICAL ACT
  wins; with the §7 re-check, a wake resuming after the
  verify's delete reads the post-verify state at its re-check
  and cannot re-register over it; the audit then shows the
  verify's verified event and the wake's suppression note,
  and the stop record still matches physical reality
  (CT13c).

## 4. Effects matrix (delta only)

The revised design §3 matrix stands, with two changed cells:

| activity | NORMAL | DRIVE_CONTAINED | CHAIN_STOPPED |
|---|---|---|---|
| `deleteAlarm` | never called | never called | called by `stop_chain` (§2.1 of the revised design) AND by `verify_chain_stop` when it observes a surviving registration (§3) — these are the only call sites in the build (source census, analysis §2) |
| `_armAlarmIfEarlier` (wake paths) | unchanged shipped/R5a condition, **plus the §7 re-check** | unchanged, plus the §7 re-check | **suppressed** — at the first gate read OR at the §7 re-check, whichever observes the state first |

Everything else — drive gate placement, finally re-arm gate,
base processing, grant closure, schedule-row preservation,
recorder rows, command/report processing — is as the revised
design §3 states, and the v3 battery re-proves it (CT1–CT10
carried; CT2/CT8 pin grant closure under containment on the
v3 tree).

## 5. Restoration policy (ruling item D)

### 5.1 Rules (no exceptions in the build)

- **No automatic clear exists anywhere.** No expiry, no
  pass-driven or wake-driven clearing, no background retry of
  verification, no state change from any read. The ONLY
  return to NORMAL is the operator `clear` transition.
  (Source census: `clear` is reachable only from
  `applyContainmentTransition` via the operator route;
  battery CT12c advances a full day across passes, wakes,
  commands, and reads over an unverified stop — state and
  record stand untouched.)
- **Every clear requires a recorded reason.** `clear`
  without a nonblank `reason` (≤2000 chars) is rejected
  `containment_reason_required` at the method and therefore
  at the route (route allowlist: `{action, authorizationRef,
  reason}`; a non-string or over-length reason is
  `containment_reason_invalid`). The reason is stored in
  the clear audit event's `detail_json` (CT12a).
- **Authorization + census + reason are gate paperwork, not
  code** — the code enforces the reason's presence and the
  transition table; WHICH authorization a clear needs, and
  the fresh census that must precede it, are specified per
  path in §5.2/§5.3 and enforced by the gates document
  (Gates v3, Gate C3 and the standalone restoration
  authorization). The design records the requirement here so
  no future gate can quietly treat a clear as cleanup.

### 5.2 DRIVE_CONTAINED → NORMAL

Operator `clear` with reason, under the authorization of the
gate that scoped the containment (or a standalone
authorization naming the clear). Preconditions: a verified
state read showing DRIVE_CONTAINED; the reason states why
drive containment is no longer needed. Effects: state row →
NORMAL, stop record untouched (none exists for this state),
audit event with the reason. The chain was never stopped, so
arming simply resumes its ordinary behavior on the next wake
(CT9's return-path assertions, carried).

### 5.3 CHAIN_STOPPED → NORMAL (the standalone path)

Per ruling decision 2, clearing CHAIN_STOPPED requires a
**STANDALONE explicit authorization** — its own named
approval, never bundled into any execution GO (not C3's, not
S1's, not a stimulus gate's). Preconditions, ALL of them:

1. a fresh census (the gates document's CENSUS block)
   taken after the authorization, showing the preserved
   plan, holds, figures, and conflicts baseline exactly as
   expected;
2. a demonstrated reason for restoration — what changed /
   why containment is no longer needed — recorded via the
   `reason` field;
3. the stop record's state is KNOWN: either
   `stopStatus ∈ {verified, re_verified}` (the physical
   stop is proven), or the reason explicitly abandons the
   stop WITH the registration's current value read and
   recorded in the same census (an operator may choose to
   restore over a surviving registration, but never
   unknowingly).

Effects: state row → NORMAL; stop record reset (fresh
episode bookkeeping, §2.1); audit event carrying the reason.
**Clear does NOT re-arm**: it writes no registration; the
registration stays absent until the first subsequent wake
re-arms per the ordinary rules (CT12b). **Pending schedule
rows are preserved** through stop and clear alike
(CT12b/CT10 byte-checks) — they were never containment's to
touch, and on restoration they are exactly the chain state
the ordinary machinery resumes from.

## 6. The verification split (ruling items A + decision 1)

Containment "verification" names two different claims, and
this design keeps them apart everywhere (the gates document
enforces the same split; any phrasing elsewhere implying
otherwise is superseded by this section):

- **Deployment/readability verification (Gate C2):** the
  deployed code is present, the state reads back consistently
  on both surfaces, the state is inert NORMAL, production is
  otherwise unchanged. C2 proves NOTHING about operational
  effectiveness — decision 1, stated in C2's own text.
- **Operational verification (Gate C3):** the transition
  mechanics exercised live — transitions apply, persist, and
  read back; the physical stop act against the CURRENT stale
  registration is observed end-to-end (`getAlarm()` value →
  delete → null read-back) without provoking anything. What
  C3 still CANNOT prove is stated in Gates v3 §C3 and the
  Rowan cp: suppression of a drive during a LIVE chain can
  only be observed when a pass would otherwise run, and
  manufacturing that pass is a stimulus. C3's result is
  therefore labeled **PARTIAL** by construction, and the
  remainder returns for separate ruling. Nothing in this
  package labels partial verification complete.

## 7. The arm-gate re-check (race fix; analysis §3–§4)

`_armAlarmIfEarlier` (candidate :2966) evaluates its gate,
then AWAITS `getAlarm()`, then maybe `setAlarm` — a stop
committed during that await was invisible to the shipped
gate, and the wake could resurrect a just-stopped chain
(harness-reproduced on the v2 candidate: analysis §4.2,
battery CT13a/CT13b failing there). The v3 fix: **after the
`getAlarm()` await, re-read the gate in the same synchronous
stretch that initiates `setAlarm`** — no await intervenes
between the re-check and the act it guards, so whichever of
{stop commit, setAlarm initiation} is later in real time is
the one whose effect stands. The memo (composed) branch
needs no re-check: no await intervenes between its gate read
and its `setAlarm` initiation. `_armAlarm` (the finally
re-arm) needed none either: its gate read and `setAlarm`
initiation are already in one synchronous stretch (analysis
§3.1). The first (pre-await) gate read is retained: it keeps
the common suppressed case free of alarm-API calls, exactly
as before.

## 8. Battery mapping (v3)

Carried groups CT0–CT10 re-prove the revised design on the
v3 trees. New: **CT11** (§3: retry success both failure
shapes, refusal off-state, bound + episode reset,
no-downgrade, idempotent confirmation), **CT12** (§5:
reason refusal at method and route, clear-never-re-arms,
no-auto-clear across a day of traffic), **CT13** (§7 +
analysis §4: parked-wake races both branches, verify-vs-wake,
transition-during-pass for both transitions, re-check read
failure). Full record:
`containment-v3/CANDIDATE-IDENTITIES.md` — containment
battery 32/32 on both v3 trees, P2 regression 32/32 on both,
R5a suite 23/23 on composed, all exit 0; CT13a/CT13b fail on
the v2 candidate by design (the defect demonstration).

## 9. Open items for Rowan's ruling

1. `MAX_STOP_VERIFY_ATTEMPTS = 3` — the bound's value is a
   judgment call (stop act + two retries per episode).
2. Gate C3's scope: whether the full stop act belongs in C3
   (recommended, Gates v3 §C3) or in S1's emergency budget.
3. Assumption A-3 (cross-invocation serialization) remains
   an ASSUMPTION (analysis §5); the design leans on it only
   where §7's re-check does not already close the gap.
4. The traffic-independent rate bound remains ABSENT and an
   open execution risk (ruling decision 4) — containment
   bounds a chain's *drive*, not its wake/pass rate; nothing
   in v3 claims otherwise.
