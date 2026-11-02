# Phase B — recovery gates v4 REVISED (five independently scoped proposals + standalone restoration + R3 micro-scope + S1-X companion)

**Status: PROPOSALS ONLY — NONE APPROVED, NONE TO BE EXECUTED.**

**REVISED EDITION (Nov 2, 2026)** — this edition answers
Rowan's ruling on the V4 package (verdict: REVISE BEFORE
GATE APPROVAL; record `ROWAN-CONTAINMENT-V4-RULING.md`).
R3 and R4 were CONDITIONALLY ACCEPTED subject to the
corrections below; R5's S1-X design was ACCEPTED subject
to V4-4 (an acceptance of the design shape, NOT an
execution authorization). The corrections applied in THIS
document are:

- **V4-1 (standalone restoration; micro-scope R3-V):**
  a **historical audit review** of the full append-only
  containment audit history is now a MANDATORY precondition
  for both restoration authorization and R3-V
  post-exhaustion authorization. The `prevEpisode*` summary
  alone is explicitly insufficient: it holds only the most
  recent closed episode and can have been overwritten
  (design v4 revised §4.2/§6).
- **V4-2 (C3 ledger, §R, restoration):** RECORDED LOGICAL
  COMPLETION is separated from PHYSICAL VERIFICATION
  throughout C3 re-entry. An audit row or a stop-record
  field proves only that a step was RECORDED; a physical
  step is credited as physically complete only when a fresh
  live read at re-entry re-establishes the physical fact.
  Ambiguous responses remain UNRESOLVED until a physical
  read resolves them. §R is rewritten in these terms, and
  the ledger cells and restoration text that treated a
  record as physical proof are corrected.
- **V4-4 (§S1-X):** the standing conditional S1-X
  authorization is now BOUND — to this pinned package
  (named below by document hash and package pin), to a
  specific observation window (defined in §S1-X), to a
  verified-trigger-evidence standard, to SINGLE USE, and
  to EXPIRATION at window close with no carry-over.

The unrevised V4 text is `PHASEB-RECOVERY-GATES-V4.md`
(SHA-256 `cc935d53…`, V4 package pin `b818f5b3…`); this
edition supersedes it for proposal purposes and is
otherwise identical except where a correction above names
a change.
Prepared under Rowan's V3 ruling (verdict: REVISE BEFORE GATE
APPROVAL; relayed verbatim by Julie in chat Nov 2, 2026;
record `ROWAN-CONTAINMENT-V3-RULING.md`), corrections
**R4** (C3 accounting), **R5** (S1 containment), **R3**
(exhaustion authorization), and **R6** (census discipline).
This file **supersedes** `PHASEB-RECOVERY-GATES-V3.md`
(SHA-256 `e2a0663e…`, pin `89dca999…`) for proposal purposes;
the v3 file is retained as history. Changes from v3:

1. **C3 carries an exact action-by-action mutation ledger**
   (R4): every act with its durable writes counted, failure
   modes, ambiguous-response handling, verification retries
   counted against `MAX_STOP_VERIFY_ATTEMPTS = 3`, worst-case
   totals, and a STOP/re-entry procedure that cannot
   duplicate a physical act. The exact accounting RAISES two
   of v3's prose bounds (state-row writes ≤3 → ≤6; audit
   rows ≤5 → ≤7): v3 undercounted the stop act, which is TWO
   transactions (the commit, then the stop-record write after
   the physical act), and each verify is a further
   transaction. The physical-act bound is unchanged
   (`deleteAlarm` ≤3, `setAlarm` 0).
2. **S1's contingency is redesigned** (R5): `contain_drive`
   alone does not stop a chain, and the gates now say so in
   S1's own text. A separately authorized companion scope,
   **S1-X** (emergency chain stop), is added with its own GO
   wording; S1's GO explicitly does NOT include it (§S1-X).
3. **A new micro-scope, R3-V** (post-exhaustion verification
   authorization), names the ONLY path to further stop
   verification after an episode is exhausted (R3).
4. **Every census expectation carries its observation date**
   (R6): all values in CENSUS were observed **Nov 2, 2026**.
   They are hard preflight expectations to be RE-READ at
   execution — never presumed current facts.
5. Identities are the containment **V4** candidates
   (`containment-v4/CANDIDATE-IDENTITIES.md`); design
   references are to `PHASEB-CONTAINMENT-DESIGN-V4.md`;
   C3's read-backs now include `stopConfidence` and the
   episode fields (design v4 §2/§4).

**Sequence, if all are eventually approved: C1 → C2 →
R5a-D → C3 → standalone restoration authorization → S1,
with S1-X authorized separately alongside S1 (before S1
executes) if Julie adopts the recommended shape.** Execution
of ANY scope requires (a) Rowan's approval of THAT scope as
a separate ruling and (b) a fresh explicit Julie GO in that
scope's exact GO wording. Approval of one scope approves no
other. Production remains under INVESTIGATION HOLD:
GENERATION_HALT "1", queue delivery paused, preserved plan
and idx-26 exemption untouched.

**Common census (referenced as CENSUS below; any deviation
= STOP before any mutation, executor STOP law).** *R6
dating: every value in this block was observed on **Nov 2,
2026** by live read during package preparation. At any
gate's execution they must be re-read fresh; a value that
differs is a deviation, and a value that matches is a fact
of the execution day, not of Nov 2.* /health build stamp as
expected for the gate; script etag exact; 31/31 parts vs the
operative manifest; observability enabled + persisted; 10
bindings; GENERATION_HALT "1"; policy enforce; settings
revision 1; queue paused, 1 consumer; standard admitted /
Batch not armed; registry FP ↔
`5c589095-f812-48a2-8ab2-03ba2791f2b2`; phase figures exact
(settled 1,029,420 / estimatedUnverified 19,018 /
reservedUnverified 5,648 / unknownOpen 0 / remaining
12,464,932); reconcile `ok: true` with the sole straddler
(`att-37d63768-db4b-447d-8150-580b7c6ee257`,
estimated_unverified); current PT day dispatched 0;
exactly 5 plans with the preserved plan
`plan:19cad189fab54b9c804a74a6` active {eligible 1, done 0,
failed 0, blocked 0}, entry pending, job queued rev 1,
quarantine unheld, grants []; eligibility digests
consistent at `cdef2c7e…`; conflicts exactly the 4-row
`schedule_dead` baseline; parked fingerprint
`b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282`;
watermarks content 18 / bindings 1841; idx-26 R2 key FREE;
and a `drive=1` read recording armedAt, pendingSchedule,
pendingWatchdog, tableState, recorderHealth (and, on a
containment-capable build, the containment projection) as
the gate's baseline. *The Nov 2, 2026 `drive=1` observation
specifically recorded: armedAt **1793562576104** =
2026-11-01T19:49:36.104Z; pendingSchedule **2**;
pendingWatchdog **1**; recorder table `missing`, zero rows,
`recorderHealth: null`.*

**Correction 6 (standing, governs every STOP in every scope
below):** STOP prevents additional operator stimuli but
cannot itself stop an already-revived alarm chain. A
successful recovery may continue watchdog and grant/void
activity beyond the observation window, indefinitely under
the holds; containment of a revived chain is an
independently gated procedure, and that continuing effect
must be explicitly addressed before any production
stimulus.

---

## Gate C1 — Containment deployment (code only; ends inert)

**Scope:** deploy the containment V4 candidate (live build
`86ad06ab…` + containment v4; 3 changed parts: coordinator
`6c19a50e…`, entry `2bb0608b…`, service `5c5183e6…`;
identities in `containment-v4/CANDIDATE-IDENTITIES.md`) and
verify the deploy. The gate ends with containment **INERT**:
no transition is performed; the containment state remains
absent/NORMAL. **No stimulus of any kind** — no command,
report, wake provocation, SubmitJob, hold or queue change.

**Preflight:** CENSUS re-based to build `86ad06ab…` / etag
`ba80e81f…` (both observed Nov 2, 2026; re-read fresh).
Battery re-run on the gate-assembled tree is mandatory
(parameterized P2 suite + containment battery v4 against
the containment V4 fixture identities; the pinned logs are
evidence about the pinned tree, the gate records its own).
Build pin of the assembled tree before upload.

**Mutation budget — ledger-lite (named write classes):**

| Write class | Bound | Notes |
|---|---|---|
| Worker script uploads (forward) | 1 | 31 parts, byte-identical to the stamped manifest |
| Script-settings PATCH | ≤1 | ONLY if the post-upload read shows observability reset |
| Rollback uploads | ≤1 | Only on the rollback triggers below; + ≤1 conditional PATCH |
| Containment transitions / commands / reports / SubmitJob | 0 | — |
| Hold flips / queue changes | 0 | — |
| Alarm registrations caused by this gate | 0 expected | A deploy is not a wake; both prior deploys left the armed value bit-identical — any change is a finding to classify, not a budget item |
| Recorder rows | 0 expected | — |
| Spend | $0 | — |

**Observability required during the gate:** post-upload
script-settings read (observability enabled + persisted);
`drive=1` read (the `containment` projection present,
state NORMAL / absent / verified, v4 stop-record and
episode fields null/0/false, `stopConfidence:
"not_applicable"`); state route read (`GET
/v2/d6-containment`: state NORMAL, absent true); /health on
the new build stamp with generation halted.

**STOP behavior:** before upload — any census deviation,
battery mismatch, assembly hash mismatch. After upload —
rollback evaluation fires on: read-back parts not
byte-identical to the stamped manifest; /health wrong; any
change vs census in the preserved plan, conflicts
baseline, phase figures, watermarks, hold/queue state, or
the recorded armedAt that is not fully explained. Per
correction 6, STOP here is not represented as affecting any
alarm chain (none is provoked).

**Rollback limits:** rollback = re-upload of the live build
`86ad06ab…`'s byte-identical preserved parts (+ ≤1
conditional PATCH), then read-back. Rollback removes the
containment CODE. It cannot un-create the containment
tables if any transition had run (none does in C1); un-fire
any alarm (none is provoked); un-issue any grant (none can
issue — drive behavior in NORMAL is unchanged and the
system is held). Any rollback after the gate closes needs
its own authorization. The permanent rollback floor
(`6a73d962…`) is untouched.

**Postflight evidence:** execution record with census
transcript, assembly + battery logs (hashes), upload
response, D2 read-back (31/31 byte-identical),
observability read, both containment reads, closing CENSUS
repeat, ends-HELD certification.

**Exact Julie GO scope for a future execution:**
> "GO — execute exactly one Gate C1 attempt as pinned:
> census, battery re-run, one upload of the containment V4
> candidate (+ at most one conditional observability PATCH,
> and conditionally one rollback upload + at most one
> conditional PATCH on the gate's named triggers), passive
> reads only, NO containment transition, NO stimulus of any
> kind, ending HELD with containment inert."

---

## Gate C2 — Passive deployment/readability verification (zero mutations)

**Scope and classification limit (inherited from v3,
restated in full because the ruling required it in the
gate's own text):** C2 performs READS ONLY against the
deployed containment build and verifies that the
containment state is READABLE and consistently reported on
both surfaces (state route + `drive=1` projection), that
the state is NORMAL/absent, and that the v4 stop-record,
episode, and `stopConfidence` fields project with their
empty values. **C2 is READABILITY-ONLY verification. It is
not operational proof of containment**: it exercises no
transition, deletes nothing, suppresses nothing, and its
PASS must never be cited as evidence that containment
WORKS — only that the deployed code reports its (inert)
state truthfully. Operational verification is C3's, and
even C3 is PARTIAL.

**Mutation budget:** 0 of every class. Any response that
implies a write occurred = STOP and classify.

**Exact Julie GO scope for a future execution:**
> "GO — execute Gate C2 as pinned: passive reads only,
> zero mutations, ending HELD. I understand C2 verifies
> readability only and is not operational proof."

---

## Gate R5a-D — Composed recovery deployment (containment + R5a; deploy only)

**Scope:** deploy the composed V4 candidate (live +
R5a + containment v4; 3 changed parts: coordinator
`5303cb63…`, entry `2bb0608b…`, service `5c5183e6…`) and
verify the deploy. Ends with containment INERT (NORMAL/
absent) and the R5a arming semantics live but unexercised:
no wake is provoked, no command or report is sent, and the
existing stale registration is left exactly as read.
Deploying R5a changes what a FUTURE wake would do; this
gate creates no wake.

**Preflight:** C1 and C2 closed. CENSUS re-based to the C1
build. Battery re-run on the gate-assembled composed tree
(P2 + R5a + containment v4 suites against the V4 fixtures).

**Mutation budget — ledger-lite (named write classes):**

| Write class | Bound | Notes |
|---|---|---|
| Worker script uploads (forward) | 1 | 31 parts, byte-identical to the stamped manifest |
| Script-settings PATCH | ≤1 | Only if observability read shows a reset |
| Rollback uploads | ≤1 | To the C1 build's preserved parts, on the triggers below; + ≤1 conditional PATCH |
| Containment transitions / commands / reports / SubmitJob | 0 | — |
| Hold flips / queue changes | 0 | — |
| Alarm registrations caused by this gate | 0 expected | Deploy is not a wake (the P2 deploy left armedAt bit-identical, observed Nov 2, 2026) — any change is a finding |
| Spend | $0 | — |

**STOP / rollback:** as C1, with the rollback target being
the C1 build. Rollback removes R5a + containment code; it
does not touch the registration, the holds, or any data.

**Exact Julie GO scope for a future execution:**
> "GO — execute exactly one Gate R5a-D attempt as pinned:
> census, battery re-run, one upload of the composed V4
> candidate (+ at most one conditional observability PATCH,
> and conditionally one rollback upload + at most one
> conditional PATCH on the gate's named triggers), passive
> reads only, NO containment transition, NO wake, NO
> stimulus of any kind, ending HELD with containment
> inert."

---

## Gate C3 — Operational containment verification (PARTIAL by construction)

**Scope:** the first live exercise of the containment
transition path, on the composed build, scoped to what can
be verified **without provoking an alarm or a command**.
C3 performs operator transitions only (state writes via
the operator route + passive read-backs) and the physical
stop act against the CURRENT stale registration. **C3
sends no command, induces no wake, delivers no pass, and
manufactures no traffic of any kind.**

**The boundary, analyzed (carried from v3; the ruling
accepted this placement):** an operator containment
transition is a state-row write plus a route call. It is
not an alarm wake: it does not deliver a pass, does not
evaluate the schedule, and does not register anything —
`contain_drive` and `clear` touch no alarm API at all, and
`stop_chain`'s only alarm-API acts are the subtractive
`deleteAlarm()` and `getAlarm()` reads. Exercising the
transitions therefore does not "provoke an alarm or
command" in the prohibited sense. **But:** what
`DRIVE_CONTAINED` *does* — suppressing a drive — can only
be OBSERVED at the moment a pass would otherwise run. With
no pass delivered, there is no drive to suppress, and C3
cannot manufacture one without becoming a stimulus gate.
The same holds for arm-gate suppression under live wake
traffic, and for the re-check under a real racing wake
(offline, CT13/CT16 prove the mechanisms at harness
strength; live, the interleaving cannot be staged without
traffic). **Those claims are NOT verified by C3 and are
returned for Rowan's separate ruling (§Unverifiable
remainder). C3's verdict is PARTIAL, and must be reported
with that word.**

What C3 CAN and does verify live, without any stimulus:
(1) transition mechanics end-to-end on the production
build (`contain_drive` applies, persists, reads back
identically on both surfaces); (2) the DRIVE_CONTAINED →
NORMAL return under design §5.2 (reasoned `clear`),
restoring the gate's own opening state; (3) **the full
physical stop act against the existing registration** —
read, `deleteAlarm`, read-back null, record `verified`,
and the v4 `stopConfidence` reading `verified_current` on
both surfaces; (4) stop-record + episode durability: the
recorded facts and the episode id read back consistently.

**Preflight (hard):** Gates C1, C2 (READABILITY VERIFIED),
R5a-D all closed. CENSUS re-based to the composed build,
PLUS: containment reads show state NORMAL / absent /
verified with the stop record empty; the `drive=1`
baseline records `armedAt` and it EQUALS **1793562576104**
(observed Nov 2, 2026; any other value at execution =
STOP: the registration state has moved, and the stop act's
expectations must be re-derived, not improvised); recorder
baseline (tableState + health + row count) recorded.
Battery re-run is NOT repeated here (no code changes in
this gate; C1/R5a-D records stand).

### The C3 mutation ledger (R4 — exact, action by action)

Reads (preflight, per-step read-backs on both surfaces,
closing census) are passive and are not mutations; they
are listed where a step's DECISION rests on one. "State
write" = one committed transaction touching the
`d6_containment_state` singleton row. "Audit row" = one
append to `d6_containment_events`. Alarm ops are physical
platform acts.

| Step | Action | Durable writes (exact) | Alarm ops | Failure modes → resulting state | Ambiguous-response handling |
|---|---|---|---|---|---|
| C3-0 | Preflight census incl. armedAt expectation | none | none | Any deviation → STOP before any mutation (executor STOP law) | n/a (reads are repeatable) |
| C3-1 | `POST /v2/d6-containment {action:"contain_drive"}` | state write ×1; audit row ×1 (`contain_drive:applied`) | 0 | Rejected (illegal transition / unreadable state) → NO writes occur; STOP and classify. Response shows non-applied → read back both surfaces before any next step | Response lost: re-entry (§R) reads state + audit; the `contain_drive` audit row is the idempotency key — if present AND the state reads back DRIVE_CONTAINED consistently on both surfaces, the step is RECORDED-complete and is not re-sent (a state-write step has no separate physical fact; its completion criterion is the recorded state itself, §R step 3). Audit row present but surfaces disagree → UNRESOLVED, STOP |
| C3-2 | Read back both surfaces | none | `getAlarm` reads (passive) | Surfaces disagree → STOP | n/a |
| C3-3 | `POST … {action:"clear", reason:"Gate C3 mechanics leg: restore opening state"}` | state write ×1; audit row ×1 (`clear:applied`, reason recorded). NO episode event: no stop episode is open (design v4 §4.2 fires the close only when a stop record exists) | 0 | Reason missing/blank → rejected `containment_reason_required`, NO writes; STOP. Other rejection → STOP and classify | Response lost: re-entry reads state + audit; if the `clear` audit row is present AND the state reads back NORMAL consistently on both surfaces, the step is RECORDED-complete, not re-sent (state-write step; §R step 3). Surfaces disagree → UNRESOLVED, STOP |
| C3-4 | Read back both surfaces (state NORMAL, opening state restored) | none | passive reads | Disagreement → STOP | n/a |
| C3-5 | `POST … {action:"stop_chain"}` — the physical stop act | state write ×1 (commit: enum + audit row ×1 `stop_chain:applied`; this commit MINTS the episode, id = that audit row's id); THEN the physical act; THEN, only if the act's outcome must be recorded (always): state write ×1 (stop record) + audit row ×1 (`stop_chain_verify:verified` or `:unverified`) | observe `getAlarm` ×1; `deleteAlarm` ×1 (a registration is expected — the C3-0 expectation); read-back `getAlarm` ×1 | Delete throws → nothing deleted; record written `unverified`, outcome `rejected/containment_stop_unverified`; state REMAINS CHAIN_STOPPED; proceed ONLY to C3-6 within the bound. Read-back throws or non-null → same unverified recording. Commit succeeds but the executor dies before the record write → record absent/stale; re-entry classifies from state + audit + a fresh read (the design's §4.6 posture) | The act's own read-back resolves the physical truth (a delete that landed reads null). Whole-response loss: re-entry reads the stop record + audit AND makes a fresh `getAlarm()` read (V4-2: the record alone is never physical proof). If `stopStatus` is recorded, the step is RECORDED-complete; it is credited PHYSICALLY complete only if the fresh read CORROBORATES the recorded outcome (fresh null against a recorded verified outcome). If the fresh read CONTRADICTS the record (e.g. recorded verified, registration present), or no fresh read can be obtained, the step is UNRESOLVED — STOP and classify; the only resumption act is `verify_chain_stop` (C3-6). If `stopStatus` is not recorded, re-entry classifies per the death-between-commit-and-record posture and the ONLY permitted resumption act is `verify_chain_stop` (C3-6) — `stop_chain` is never re-sent |
| C3-6 | `POST … {action:"verify_chain_stop"}` — ONLY if C3-5 ended unverified; ≤2 calls (attempts 2 and 3 of the episode) | per call: state write ×1 (record) + audit row ×1 (`verify_chain_stop:verified` or the verify outcome event); PLUS, on the call that reaches attempt 3 unverified: audit row ×1 more (`stop_episode_exhausted`) and the state write carries `stopEpisodeExhausted: 1` | per call: observe `getAlarm` ×1; `deleteAlarm` ≤1 (ONLY if a registration is observed); read-back ×1 if a delete was attempted | Each failure leaves CHAIN_STOPPED, record `unverified`, attempts incremented — no other state change. At attempt 3 unverified: the episode is EXHAUSTED (durable flag + audit event); further calls are refused BEFORE any physical act and write nothing; C3 ends STOPPED-unverified and the package returns for ruling (the R3-V micro-scope is the only path onward) | Response lost on a verify call: the attempt WAS consumed if its audit row exists (re-entry counts attempts from the record, never from the executor's memory — attempt counting is a RECORD fact and counting a possibly-unlanded attempt as consumed errs in the conservative direction). But the attempt's PHYSICAL effect is not established by its audit row (V4-2): whether its delete landed is re-established at re-entry only by a fresh `getAlarm()` read; a fresh read showing a surviving registration means the stop remains physically incomplete whatever the recorded attempt count says. A re-sent verify that the code refuses as exhausted is the expected, safe outcome — never an error to retry around |
| C3-7 | Closing CENSUS repeat + both-surface stop-record read-back | none | passive reads | Any delta beyond the ledger's own = STOP and classify | n/a |

**Worst-case totals for C3 (all steps, all failure
branches):** state writes **≤6** (C3-1 ×1, C3-3 ×1, C3-5
×2, C3-6 ×2); audit rows **≤7** (C3-1 ×1, C3-3 ×1, C3-5
×2, C3-6 ×3 incl. the exhaustion event); `deleteAlarm`
**≤3** (C3-5 ×1 + C3-6 ≤2); `setAlarm` **0** (any
registration appearing during C3 that C3 did not delete
is a STOP-and-classify event — nothing in C3 arms);
commands / reports / SubmitJob / uploads / PATCHes / hold
flips / queue changes: **0**. Recorder rows: 0 expected
(no pass is provoked; a spontaneous row is classified and
reported as opportunistic evidence, never budgeted).
Spend: $0. Expected (no-failure) totals: state writes 4,
audit rows 4, `deleteAlarm` 1.

**Expected closing state (no-failure path):** containment
CHAIN_STOPPED, `stopStatus: "verified"`,
`stopArmedBefore: 1793562576104`, `stopArmedAfter: null`,
`stopVerifyAttempts: 1`, episode open (not exhausted),
`stopConfidence: "verified_current"` on both surfaces;
`armedAt` null; pendingSchedule/pendingWatchdog UNCHANGED
from the Nov-2-observed baseline as re-read at C3-0 (the
stop preserves schedule rows); every other census value
identical.

### §R — C3 STOP and re-entry procedure (no duplicate physical acts)

**Rewritten in the corrections round (V4-2).** The v4 text
marked a step DONE from its audit row / stop-record fields
alone. That conflated two different facts, and this
procedure now keeps them separate at every step:

- **RECORDED LOGICAL COMPLETION** — the record (audit rows,
  stop-record fields) shows the code path ran and committed
  its account of the step. A record proves a step was
  RECORDED. It never, by itself, proves a physical act
  landed.
- **PHYSICAL VERIFICATION** — a fresh live read, made at
  re-entry, re-establishes the physical fact the step
  exists to produce: for the stop act and the verifies,
  a `getAlarm()` observation (present/absent), read against
  the stop record's verification fields (`stopStatus`,
  `stopArmedBefore`, `stopArmedAfter`, `stopVerifiedAt`).
  A physical step is credited as physically complete ONLY
  when the fresh read corroborates the recorded outcome.
- **UNRESOLVED** — any step whose record and fresh physical
  read disagree, or whose physical state cannot be freshly
  read, is UNRESOLVED. An ambiguous response (a request
  whose reply was lost) leaves its step UNRESOLVED until a
  physical read resolves it — never resolved by the
  executor's memory of what it sent, and never by the
  audit row alone.

On any STOP mid-ledger, or before resuming after ANY
interruption (including an executor restart):

1. STOP all further acts. Preserve the gate record as-is.
2. Re-read, in this order: the containment state route,
   the `drive=1` projection, and the audit event listing.
   These three reads — never the executor's memory of what
   it sent — determine what has been RECORDED. (They do not
   yet determine what has physically happened; that is
   step 4.)
3. Mark each ledger step RECORDED-complete iff its
   idempotency key is present in the record: the step's
   audit row (`contain_drive`, `clear`, `stop_chain`,
   `verify_chain_stop`) and, for C3-5/C3-6, the stop
   record fields (`stopVerifyAttempts` is the authoritative
   RECORDED attempt count — counting is a record fact, and
   counting a possibly-unlanded attempt as consumed errs
   conservatively). Pure state-write steps (C3-1, C3-3)
   have no separate physical fact beyond the state the
   record itself holds: for them, recorded completion read
   back consistently on both surfaces IS their completion
   criterion.
4. For each physical step (C3-5, each C3-6 call), make a
   FRESH `getAlarm()` read at re-entry and classify:
   (a) fresh read corroborates the recorded outcome (a
   recorded verified stop and a fresh null; a recorded
   unverified outcome and the stop's physical incompleteness
   already priced into the ledger) → the step is PHYSICALLY
   VERIFIED to the recorded extent; (b) fresh read
   CONTRADICTS the record (a recorded verified stop with a
   registration now present; a recorded outcome whose
   `stopArmedAfter` the fresh read cannot reproduce) → the
   step is UNRESOLVED: STOP and classify — the physical
   truth, not the record, governs what remains to be done,
   and the only permitted resumption act for the stop is
   `verify_chain_stop` within the episode bound; (c) no
   fresh read can be obtained → UNRESOLVED; the gate does
   not resume on the record's word.
5. Resume ONLY at the first step that is neither
   RECORDED-complete nor PHYSICALLY VERIFIED to the extent
   its ledger row requires, with two hard rules: a
   `stop_chain` whose audit row exists is NEVER re-sent
   (an unverified or unresolved stop resumes exclusively
   through `verify_chain_stop`); a `deleteAlarm` is only
   ever issued by the code paths that first observe a
   registration in the same act, so a resume cannot delete
   blindly or twice (harness-proven: CT16b/CT16c assert the
   landed-delete count across stop + resume).
6. If the reads cannot establish what was recorded
   (surfaces disagree, record unreadable), or a physical
   step remains UNRESOLVED after step 4, the gate does NOT
   resume: it returns for ruling with the reads attached.

**Rollback limits:** the mechanics leg is reversed by its
own C3-3 step. The stop act has NO rollback inside this
gate: a deleted registration cannot be un-deleted by an
operator act — re-registration happens only through the
ordinary wake paths under NORMAL, i.e., only after the
standalone restoration. That irreversibility-without-
restoration is accepted as the gate's design (it is the
point of a stop), and it is why the stop's preconditions
(the armedAt expectation) are census-hard.

**Restoration rules (decision 2 + design v4 §6):** C3
ends CHAIN_STOPPED **by design**. The C3-3 clear is the
only clear this gate contains, and it applies only to the
DRIVE_CONTAINED mechanics leg. **Returning from
CHAIN_STOPPED to NORMAL is NOT in C3's scope, budget, or
GO** — it requires the standalone restoration
authorization below, which must additionally disclose the
episode summary (design v4 §6).

**Postflight evidence:** execution record: preflight
census (incl. the armedAt expectation and its observation
date), each ledger step's request/response + both-surface
read-backs, the stop record and `stopConfidence` as read
on both surfaces, the audit event listing, closing census
with the delta table checked against the ledger's
worst-case totals, the PARTIAL verdict with its basis,
ends-HELD certification (halt "1", queue paused, preserved
plan and exemption untouched).

**Unverifiable remainder (returned for Rowan's separate
ruling; NOT claimed by C3):** drive suppression during a
live chain (observable only when a pass would otherwise
run); arm-gate suppression under genuine concurrent wake
traffic; the re-check against a real racing wake; any
property of a REVIVED chain's behavior under containment.
S1 may not be proposed for execution until Rowan rules on
how (or whether) this remainder is to be discharged.

**Exact Julie GO scope for a future execution:**
> "GO — execute exactly one Gate C3 attempt as pinned:
> preflight census including the armedAt expectation, the
> contain_drive + reasoned clear mechanics pair, and
> exactly one stop_chain act against the current
> registration (with verify_chain_stop retries only within
> the design's attempts bound if the stop is unverified),
> passive read-backs only, NO command, NO wake provocation,
> NO stimulus of any kind, ending HELD in CHAIN_STOPPED.
> I understand C3's verification is PARTIAL, that the
> return to NORMAL needs its own separate authorization,
> and that the deleted registration cannot be restored by
> this gate."

---

## Standalone restoration authorization (NOT a gate; decision 2)

Between C3 and S1, exactly once in this sequence, the
return CHAIN_STOPPED → NORMAL is authorized **on its
own**: a named approval by Julie (after Rowan's review of
C3's record), a fresh CENSUS executed at its start, and a
demonstrated reason — what changed / why containment is
no longer needed — recorded in the `clear` audit event
(design §5.3 preconditions, including the stop-record
precondition: C3 ended `verified`). **V4-2 correction:**
that precondition is satisfied by the restoration's fresh
census — its `drive=1`/state-route reads re-observe the
registration (`armedAt` absent) and derive
`stopConfidence` fresh — CORROBORATING the record at
execution time. The C3 record alone does not carry the
physical stop into this authorization; if the fresh census
read contradicts the record (a registration present, or
confidence below `verified_current`), the restoration does
not proceed on the record's word: STOP and classify.
**V4 addition (design v4 §6): the restoration
request must disclose the episode summary — current
episode id + exhausted flag, and the previous-episode
summary if any. If either is exhausted, the restoration
must name the R3-V authorization (below) under which any
later stop/verify work would proceed; a restoration that
omits an exhausted episode is incomplete on its face.**
**V4-1 strengthening (this revision): the episode
disclosure is NOT sufficient on its own.** Because the
previous-episode summary holds only the most recent closed
episode and can have been overwritten by a later clear
(design v4 revised §4.2), the restoration authorization
additionally REQUIRES a **historical audit review**: the
full append-only audit history (`d6_containment_events`)
is read and attached to the authorization request, EVERY
stop episode in that history (open or closed) is
enumerated with its exhaustion status taken from the
history, and the R3-V naming requirement applies to any
exhausted episode the HISTORY contains — whether or not
it still appears in the summary. A restoration request
that discloses only the summary is incomplete on its face.

The act is exactly one `POST /v2/d6-containment
{action: "clear", authorizationRef: <restoration record
ref>, reason: <demonstrated reason>}` plus read-backs.
V4 note: that clear also CLOSES C3's episode inside its
own transaction (summary preserved to `prevEpisode*` +
`stop_episode_closed` audit row — design v4 §4.2); the
budget below counts it. **The clear does not re-arm**:
the registration stays absent; the first subsequent wake
(which, in this sequence, is S1's stimulus command)
re-arms per the ordinary composed-build rules. Mutation
budget: state writes 1, audit rows 2 (the clear + the
episode close), all else 0. If the census deviates, the
restoration does not proceed and the system remains
CHAIN_STOPPED.

**Exact Julie GO scope for a future execution:**
> "GO — execute the standalone restoration as pinned:
> fresh census including the episode disclosure and the
> historical audit review of the full containment audit
> history, then exactly one clear of CHAIN_STOPPED with
> the recorded reason, read-backs only, ending HELD in
> NORMAL with the registration still absent."

---

## Micro-scope R3-V — Post-exhaustion verification authorization (NEW; R3)

**Purpose:** the ONLY path to further stop-verification
work after a stop episode has been recorded EXHAUSTED
(design v4 §4). It exists so that exhaustion is a hard
stop with a named, separately authorized continuation —
never an informal retry, and never a fresh budget smuggled
through a clear.

**Preconditions (all required):** (i) an exhausted episode
on record, named by episode id in the authorization
request, with its `stop_episode_exhausted` audit event and
the episode's full audit trail attached — **established by
a historical audit review of the FULL append-only audit
history (V4-1)**: the review enumerates every stop episode
the history contains with its exhaustion status, because
the exhausted episode's presence CANNOT be established
from the `prevEpisode*` summary (a later clear may have
overwritten the summary with a newer episode's, leaving
the exhausted episode visible only in the history); an
R3-V request grounded in the summary alone is incomplete;
(ii) a Rowan
ruling on that exhaustion record; (iii) a fresh CENSUS at
execution; (iv) the standalone restoration executed first
if the state is still CHAIN_STOPPED (the code refuses
`verify_chain_stop` on an exhausted episode even after
the physical fault clears — CT15c — so the executable
path is: restoration clear (separately authorized, with
the §6 disclosure and its own historical audit review),
THEN one new `stop_chain` minting a
new episode under THIS scope).

**Scope of the authorization:** exactly one new
`stop_chain` act against the then-current registration
(whose value the fresh census records as the expectation)
plus its in-bound `verify_chain_stop` attempts (≤3 total
for the new episode, the same law). Mutation budget:
state writes ≤4, audit rows ≤5 (incl. a possible new
exhaustion event), `deleteAlarm` ≤3, `setAlarm` 0, all
else 0. If the new episode also exhausts, R3-V is spent:
a further continuation needs a NEW R3-V authorization
under a new Rowan ruling.

**Exact Julie GO scope for a future execution:**
> "GO — execute micro-scope R3-V as pinned for exhausted
> episode <id>: fresh census, then exactly one new
> stop_chain (new episode) with in-bound verify attempts
> only, read-backs only, NO other stimulus, ending HELD
> in CHAIN_STOPPED."

---

## Gate S1 — Revival stimulus (the R2 stimulus, in sequence)

**Identity (preserved verbatim from v3):** this gate IS
the R2 stimulus gate, sequenced after
C1/C2/R5a-D/C3 + the standalone restoration. The stimulus
is exactly one `RequestPause` command with a fresh
`command_id` targeting the reserved nonexistent job
`alarm-wake-probe:nonexistent` — a wake probe of whether
the platform reacts, observed through the recorder. A
negative result is reported ONLY as "**no observed
revival within the tested window, subject to recorder
limitations**" and never as proof that B2 is impossible.
Do not rename or re-scope the probe in execution
reporting. R2-identity negative wording is unchanged.

**Hard dependency (item E): S1 is NOT the first test of
containment.** S1 may not be proposed for execution until
ALL of: Gate C3 complete with its PARTIAL verdict
recorded; Rowan has reviewed C3's record AND ruled on
C3's unverifiable remainder; the standalone restoration
executed and read back (state NORMAL, episode closed,
registration absent). S1 contains no containment
transition in its preflight at all.

**Preflight (hard):** as v3 (gates closed; remainder
ruling + restoration on record; CENSUS re-based to the
composed build with containment NORMAL; target
nonexistence verified on live job/plan reads; fresh
command_id generated and recorded BEFORE the stimulus;
recorder state known — any recorder row or armedAt
different from the restoration's closing read = STOP).

**The stimulus (exactly this, once):** one
`POST /v2/commands` `{command_id: <fresh>, type:
"RequestPause", payload: {jobId:
"alarm-wake-probe:nonexistent"}}`. Expected response:
outcome `rejected`, reason `job_not_found`. **No re-send**
under any circumstance — a timeout or ambiguous response
is a STOP-and-classify event.

**Mutation budget (complete, S1 proper):** commands rows
**exactly 1** (the stimulus); `setAlarm` registrations
≤1 from the stimulus command's own wake evaluation
(composed build, R5a memo bound), plus per-pass `finally`
registrations ONLY if passes are delivered (shipped
behavior, recorded and classified — not operator
stimuli); schedule rows 0 expected from the stimulus;
containment transitions in preflight **0**; uploads /
PATCHes / hold flips / queue changes / SubmitJob **0**.
Spend: $0 in every branch while the holds stand.

**Contingency — REVISED (R5).** V3's contingency was a
single executor-applied `contain_drive`. The ruling is
correct that this is insufficient, and S1 now says so in
its own text: **`contain_drive` suppresses future drive
passes; it does NOT stop an alarm chain** — a revived
chain keeps registering (watchdog), and grant/void churn
continues between passes. S1's contingency is therefore
TWO-LAYERED and separately authorized:

- **Layer 1 (inside S1's GO):** if any post-stimulus
  movement falls OUTSIDE the §7.3 pre-classified set, the
  executor applies `contain_drive` once (+1 state write,
  +1 audit row) to bound drive accumulation while
  reporting immediately. This layer bounds; it does not
  stop.
- **Layer 2 (NOT in S1's GO):** the chain-stop response is
  **Gate S1-X** (§S1-X below) — a separate scope with its
  own GO, which Julie authorizes separately (recommended:
  in advance, as a standing conditional authorization that
  S1-X's triggers arm — BOUND to the pinned package, the
  S1 observation window, verified trigger evidence,
  single use, and expiration at window close, per §S1-X
  as revised under V4-4). **S1's GO does not include
  `stop_chain` in any form.** If S1-X has not been
  authorized when a Layer-1 trigger fires, the executor's
  complete contingency is: `contain_drive` once, immediate
  report to Julie, and STOP — with the record stating
  plainly that the chain remains live under the holds
  (bounded churn, $0 spend) until S1-X or an equivalent
  scope is authorized.

**Observability:** `drive=1` + state-route + plan/job
reads at ≈ +2, +12, and +37 minutes, then a closing
census. No further stimulus during the window, whatever
the reads show.

**Result classification:** as v3 (revival → classify every
movement against the §7.3 pre-classified set; anything
outside = STOP + report + the contingency above; no
revival → the mandated wording and nothing stronger).

**STOP behavior:** correction 6 governs, verbatim: once
the single command is sent, there is nothing left for a
STOP to prevent — the remaining steps are reads, the
contingency, and reporting; if the chain revives, STOP
does not quiet it. STOP before the stimulus on any
preflight failure (v3 list, unchanged).

**Rollback limits:** there is no rollback for a sent
command — the commands row stands as the audit record of
the probe. A revived chain is not "rolled back"; it is
contained (Layer 1) and, if authorized, stopped (S1-X).

**Exact Julie GO scope for a future execution:**
> "GO — execute exactly one Gate S1 attempt as pinned:
> preflight, exactly one RequestPause stimulus command
> against the reserved nonexistent job, the observation
> reads, classification against the §7.3 set, and — only
> on out-of-set movement — one contain_drive as the
> Layer-1 contingency. NO stop_chain: the chain-stop
> response is Gate S1-X, which this GO does not include."

---

## Gate S1-X — Emergency chain stop (companion to S1; NEW; R5)

**Purpose:** the separately authorized chain-stop response
for a chain revived by S1's stimulus (or observed live at
S1's reads). It is the C3-verified stop procedure
(`stop_chain` + in-bound `verify_chain_stop`) executed as
an emergency measure, under its own authorization —
structurally and textually separate from S1: **S1's GO
does not include S1-X; S1-X's GO does not include S1; the
two are approved, or not, independently.**

**The authorization-shape decision (for Rowan's ruling
and Julie's choice).** Two shapes were considered:

- **(i) Standing conditional pre-authorization
  (RECOMMENDED):** Julie authorizes S1-X in advance,
  conditioned on enumerated, mechanically checkable
  triggers (§Triggers) AND bound per §Binding (V4-4):
  pinned package, the one S1 observation window, the
  verified-trigger-evidence standard, single use, and
  expiration at window close. When a trigger is observed
  at an S1 read and verified to that standard, the
  executor performs the stop act without waiting for a
  further GO, reports immediately, and the system ends
  CHAIN_STOPPED (return to NORMAL then needs the
  standalone restoration, as always).
- **(ii) At-trigger-time authorization:** S1-X is
  authorized only when a trigger has fired and Julie gives
  a fresh GO then. Honest cost: between the trigger and
  Julie's GO — she may be asleep or unreachable for hours —
  the revived chain keeps running under the holds. The
  exposure during that window is bounded (Layer-1
  `contain_drive` bounds drive accumulation; the holds
  keep spend at $0; the churn is grant/void cycling
  against the preserved plan plus watchdog registrations),
  but it is UNBOUNDED IN DURATION, and correction 6
  requires the continuing effect to be addressed by the
  plan, not merely observed. Shape (ii) leaves the
  addressing to a future, possibly delayed, human action.

**Why (i) is recommended:** the stop act is the procedure
C3 verifies live beforehand; its outcome space is small
and fully recorded; its end state (CHAIN_STOPPED) is the
safest state the system has and is itself gated on the
way back (standalone restoration); the triggers are
checkable against reads, not judgment calls; and the
standing authorization is SINGLE-USE (one stop act; see
budget), EXPIRES at the S1 window's close whether or not
it fires, and is revocable by Julie at any time before it
fires (§Binding, V4-4). The residual risk of (i) — a physical stop executed
on a trigger that later classification would have called
benign — is accepted knowingly: every trigger below is
defined as movement already outside the §7.3
pre-classified set, i.e., movement S1's own rules treat as
STOP-and-report; stopping the chain in that circumstance
is the conservative direction, and the cost of a
false-positive stop is a restoration cycle, not spend or
data.

**Triggers (any ONE, observed at a scheduled S1 read or
the closing census, arms S1-X under shape (i)):** (T1) a
recorder row or plan/job read showing grant activity
beyond the §7.3 pre-classified set; (T2) any dispatch
observed while GENERATION_HALT is "1" (a drive row or
dispatch evidence under the halt); (T3) phase or quota
movement beyond the §7.3 predictions (settled / reserved /
dispatched totals changed in any amount not in the set);
(T4) a second grant, a second plan/job movement, or any
movement in the conflicts baseline, watermarks, or parked
job outside the set. Trigger evaluation uses the same
reads S1 already takes; S1-X adds no stimulus and no
extra reads of its own before the stop act.

**Scope and budget (when fired):** exactly one
`stop_chain` act (against whatever registration the
pre-act read observes) + `verify_chain_stop` attempts
within the episode bound (≤3 total; design v4 §4 — if
the episode EXHAUSTS unverified, S1-X is spent: the state
remains CHAIN_STOPPED/unverified, the exhaustion is
recorded, and any further verification requires the R3-V
micro-scope under a fresh Rowan ruling + Julie
authorization). State writes ≤4, audit rows ≤5,
`deleteAlarm` ≤3, `setAlarm` 0, commands 0, all else 0.
Ends HELD in CHAIN_STOPPED; immediate report to Julie
with the trigger, the reads that fired it, and the stop
record incl. `stopConfidence`.

**Binding (V4-4 — the standing authorization is valid
ONLY under all five of these).** The v4 text left the
standing conditional authorization floating: it named
triggers and a budget but was not tied to a specific
pinned text, window, or evidence standard. As revised,
a standing S1-X authorization under shape (i):

- **(a) is bound to ONE pinned package.** It exists only
  as part of the package pinned at the commit recorded
  here — PACKAGE PIN: «PIN — inserted at filing; the
  authoritative value is the pin named in this package's
  board filing comment and in the corrections cp as
  delivered via Dropbox» — on branch `ui1-review` of
  `jedavid33-design/opal-reader`, and only for the gates
  text whose SHA-256 is quoted in that same filing. An
  authorization that quotes no pin, a different pin, or a
  superseded gates text arms nothing. If this gates
  document is superseded by a later pin, any standing
  authorization under the old pin lapses with it.
- **(b) is bound to ONE specific observation window: the
  S1 observation window it attaches to** — defined as the
  interval that OPENS at the dispatch of S1's single
  stimulus command and CLOSES at the completion of S1's
  closing census read (the final read of S1's
  observability sequence: the ≈ +37-minute reads plus the
  closing census). The authorization is armed only inside
  that window, for that one S1 execution. It does not
  attach to any other window, any re-run, or any later S1
  attempt.
- **(c) fires only on VERIFIED trigger evidence.** A
  T1–T4 trigger counts as verified only when ALL of the
  following hold: (i) the observation was made by one of
  S1's scheduled reads (the `drive=1` projection, the
  containment state route, and the plan/job reads S1's
  classification already takes — S1-X adds no reads of its
  own); (ii) the raw observed values and the read
  timestamps are written into the S1 execution record
  BEFORE the stop act fires, so the firing is auditable
  against the evidence that caused it; (iii) the movement
  is outside the §7.3 pre-classified set under the same
  classification standard S1 itself reports under — where
  the paired surfaces disagree, or a value cannot be
  freshly read, the trigger is NOT verified: the executor
  reports and STOPs under S1's ordinary contingency (Layer
  1 + report), and S1-X does not fire. An executor
  impression, an unrecorded observation, or a single
  uncorroborated surface reading never arms S1-X.
- **(d) is SINGLE USE.** It is consumed by exactly one
  `stop_chain` invocation (with its in-bound verifies).
  Whether it fires or not, it cannot fire twice; a second
  chain-stop response requires a new authorization under
  a then-current pin.
- **(e) EXPIRES at window close.** At the closing census
  read's completion the authorization lapses, fired or
  unfired. There is NO carry-over: not to a later window,
  not to a different gate, not to a superseding package.
  If it never fired, nothing about it survives to be
  reused, and its lapse is recorded in S1's execution
  record.

**Exact Julie GO scope — standing conditional shape (i),
for a future authorization (V4-4 bound form):**
> "GO — standing conditional authorization for Gate S1-X
> under the V4-corrections gates package, pin «PIN —
> inserted at filing», armed only during the single S1
> observation window defined in §S1-X (from the stimulus
> dispatch to the closing census read): if any S1-X
> trigger (T1–T4) is observed AND verified to the §S1-X
> evidence standard (scheduled reads, recorded verbatim
> in the execution record before firing, outside the
> §7.3 set), execute exactly one stop_chain with in-bound
> verify attempts, report immediately, and end HELD in
> CHAIN_STOPPED. This authorization is single-use, expires
> at window close whether or not it fires, carries over
> to no other window or package, covers no other act, and
> does not extend Gate S1's GO."

**Exact Julie GO scope — at-trigger-time shape (ii), for
a future authorization:**
> "GO — execute Gate S1-X now, as pinned: exactly one
> stop_chain with in-bound verify attempts against the
> revived chain, read-backs only, ending HELD in
> CHAIN_STOPPED."
