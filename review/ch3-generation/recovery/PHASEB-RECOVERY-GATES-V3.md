# Phase B — recovery gates v3 (five independently scoped proposals + one standalone authorization)

**Status: PROPOSALS ONLY — NONE APPROVED, NONE TO BE EXECUTED.**
Prepared under Rowan's containment-correction ruling (relayed
verbatim by Julie 2026-11-02; record
`ROWAN-CONTAINMENT-CORRECTION-RULING.md`), items A and E, and
decisions 1–5. This file **supersedes**
`PHASEB-RECOVERY-GATES-V2.md` (pinned at `e6e91870`, retained
as history). Changes from v2: the gate set is FIVE (C3 is
new); C2 is relabeled deployment/readability verification
with its classification limit stated in its own text
(decision 1); the containment readiness pair is REMOVED from
S1 and its substance moved to C3 (item E); a standalone
restoration authorization (decision 2) is named as its own
step between C3 and S1; all identities are the containment
V3 candidates (`containment-v3/CANDIDATE-IDENTITIES.md`);
design references are to `PHASEB-CONTAINMENT-DESIGN-V3.md`.

**Sequence, if all are eventually approved: C1 → C2 →
R5a-D → C3 → standalone restoration authorization → S1.**
(R5a-D precedes C3 so that C3's operational verification
runs against the final composed build — the build any later
stimulus would meet. C3 operating on the containment-only
build would leave the composed build's transition path
live-unexercised.) Execution of ANY gate requires (a)
Rowan's approval of THAT gate as a separate ruling and (b)
a fresh explicit Julie GO in that gate's exact GO wording.
Approval of one gate approves no other. Production remains
under INVESTIGATION HOLD: GENERATION_HALT "1", queue
delivery paused, preserved plan and idx-26 exemption
untouched.

**Common census (referenced as CENSUS below; any deviation
= STOP before any mutation, executor STOP law):** /health
build stamp as expected for the gate; script etag exact;
31/31 parts vs the operative manifest; observability
enabled + persisted; 10 bindings; GENERATION_HALT "1";
policy enforce; settings revision 1; queue paused, 1
consumer; standard admitted / Batch not armed; registry FP
↔ `5c589095-f812-48a2-8ab2-03ba2791f2b2`; phase figures
exact (settled 1,029,420 / estimatedUnverified 19,018 /
reservedUnverified 5,648 / unknownOpen 0 / remaining
12,464,932); reconcile `ok: true` with the sole straddler
(`att-37d63768-db4b-447d-8150-580b7c6ee257`,
estimated_unverified); current PT day dispatched 0; exactly
5 plans with the preserved plan `plan:19cad189fab54b9c804a74a6`
active {eligible 1, done 0, failed 0, blocked 0}, entry
pending, job queued rev 1, quarantine unheld, grants [];
eligibility digests consistent at `cdef2c7e…`; conflicts
exactly the 4-row `schedule_dead` baseline; parked
fingerprint `b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282`;
watermarks content 18 / bindings 1841; idx-26 R2 key FREE;
and a `drive=1` read recording armedAt, pendingSchedule,
pendingWatchdog, tableState, recorderHealth (and, on a
containment-capable build, the containment projection) as
the gate's baseline.

**Correction 6 (standing, governs every STOP in every gate
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

**Scope:** deploy the containment V3 candidate (live build
`86ad06ab…` + containment v3; 3 changed parts: coordinator
`c953ff2b…`, entry `f746c632…`, service `bccda909…`;
identities in `containment-v3/CANDIDATE-IDENTITIES.md`)
and verify the deploy. The gate ends with containment
**INERT**: no transition is performed; the containment
state remains absent/NORMAL. **No stimulus of any kind** —
no command, report, wake provocation, SubmitJob, hold or
queue change.

**Preflight:** CENSUS re-based to build `86ad06ab…` / etag
`ba80e81f…`. Battery re-run on the gate-assembled tree is
mandatory (parameterized P2 suite + containment battery
against the containment V3 fixture identities; the pinned
logs are evidence about the pinned tree, the gate records
its own). Build pin of the assembled tree before upload
(build-marker rule; the stamped `build-identity.mjs` is
counted in assembly verification as in the P2 gate).

**Mutation budget:** forward upload **1**; observability
PATCH ≤1, only if the post-upload read shows observability
reset; conditional rollback upload ≤1 + PATCH ≤1 (rollback
triggers below only). Commands/reports/SubmitJob/hold
flips/queue changes: **0**. Alarm registrations caused by
this gate: **0 expected** (a deploy is not a wake; both
prior deploys left the armed value bit-identical — any
change is a finding to classify, not a budget item).
Recorder rows: 0 expected. Spend: $0.

**Observability required during the gate:** post-upload
script-settings read (observability enabled + persisted);
`drive=1` read (the `containment` projection must be
present and report state NORMAL / absent / verified, with
the v3 stop-record fields null/0); state route read
(`GET /v2/d6-containment`: state NORMAL, absent true);
/health on the new build stamp with generation halted.

**STOP behavior:** before upload — any census deviation,
battery mismatch, assembly hash mismatch. After upload —
rollback evaluation fires on: read-back parts not
byte-identical to the stamped manifest; /health wrong; any
change vs census in the preserved plan, conflicts
baseline, phase figures, watermarks, hold/queue state, or
the recorded armedAt that is not fully explained. STOP in
this gate prevents the upload or triggers the rollback
evaluation; per correction 6 it is not represented as
affecting any alarm chain (none is provoked).

**Rollback limits:** rollback = re-upload of the live
build `86ad06ab…`'s byte-identical preserved parts (+ ≤1
conditional PATCH), then read-back. Rollback removes the
containment CODE. It cannot: un-create the containment
tables if any transition had run (none does in C1 — the
tables are never created by the deploy or by reads);
un-fire any alarm (none is provoked); un-issue any grant
(none can issue — drive behavior in NORMAL is unchanged
and the system is held). Any rollback after the gate
closes needs its own authorization. The permanent rollback
floor (`6a73d962…`) is untouched.

**Postflight evidence:** execution record with census
transcript, assembly + battery logs (hashes), upload
response, D2 read-back (31/31 byte-identical),
observability read, both containment reads (state route +
drive=1 projection), closing CENSUS repeat, ends-HELD
certification.

**Exact Julie GO scope for a future execution:**
> "GO — execute exactly one Gate C1 attempt as pinned:
> census, battery re-run, one upload of the containment V3
> candidate (+ at most one conditional observability PATCH,
> and conditionally one rollback upload + at most one
> conditional PATCH on the gate's named triggers), passive
> reads only, NO containment transition, NO stimulus of any
> kind, ending HELD with containment inert."

---

## Gate C2 — Passive deployment/readability verification (zero mutations)

**Scope:** verify, from passive evidence alone, that the
containment deployed by Gate C1 is present, readable, and
inert — and that production state is exactly as C1 left
it. **C2 performs NO transition.**

**Classification limit (decision 1, stated in this gate's
own text): C2 is deployment/readability verification
ONLY. A passed C2 is NOT proof of operational containment
effectiveness — it does not show that a transition works,
that drive suppression engages, or that a stop holds
against a live chain. Operational verification is Gate
C3's separate, partial scope (§C3), and no C2 verdict may
be cited as covering it.** Verification here rests on:
deploy-time read-backs (C1's record), the state route and
drive=1 reads (the containment projection + armedAt +
schedule counts), plan/job/conflict/phase reads, and the
offline battery evidence for transition behavior.

**Preflight:** C1's postflight record exists and its
closing census is the expected opening state; live build
stamp == C1's pin; a fresh CENSUS (all items, incl. the
containment reads: state route reports state NORMAL,
absent true, verified true; drive=1 containment projection
agrees, stop-record fields null/0).

**Mutation budget:** **0.** No uploads, no PATCHes, no
transitions, no commands, no reports, no wakes. Reads
only.

**Observability:** the evidence set itself: (1) state
route read — state NORMAL/absent/verified, armedAt equals
the C1 closing value, pendingSchedule/pendingWatchdog
equal closing values; (2) drive=1 read — containment
projection consistent with (1), recorder table state and
health as at C1 close (no new rows: no pass has been
provoked and none is needed — spontaneous rows, if any
appeared between gates, are classified, not ignored);
(3) plan/job reads byte-compared to C1 close; (4) /health.

**STOP behavior:** any contradiction among the reads, any
unexplained delta from C1's close, or an unavailable read
= STOP: C2 reports the verification as FAILED/INCONCLUSIVE
with the specific contradiction; it attempts no repair, no
retry beyond one repeated read of the same surface, and no
other gate may open on a failed C2. (An inconclusive C2
leaves containment "deployed, readability-unverified" —
Gate R5a-D's precondition is a PASSED C2.)

**Rollback limits:** none applicable and none available —
C2 changes nothing, so there is nothing to roll back. If
C2 fails, remediation is a new ruling, not a rollback.

**Postflight evidence:** verification record: the four
read transcripts with timestamps, the delta table vs C1
close (all zero), and the verdict (READABILITY VERIFIED /
FAILED / INCONCLUSIVE) with its basis. The verdict word is
deliberately not "operational": see the classification
limit above.

**Exact Julie GO scope for a future execution:**
> "GO — execute Gate C2 as pinned: passive reads only,
> zero mutations of any kind, ending HELD, and report the
> deployment/readability verification verdict. I understand
> a passed C2 is not proof of operational containment
> effectiveness."

---

## Gate R5a-D — Composed recovery deployment (containment + R5a; deploy only)

**Scope:** deploy the COMPOSED V3 candidate (live + R5a +
containment v3; coordinator `8ad74a93…`, entry
`f746c632…`, service `bccda909…` vs the live build — i.e.,
exactly one part, coordinator, changes vs the C1 tree) and
verify. **No stimulus:** the deployment changes the
semantics under which any LATER wake acts; this gate sends
no wake. Ends HELD.

**Preflight (hard):** Gates C1 and C2 both closed with
C2's verdict READABILITY VERIFIED. CENSUS re-based to the
C1 build (build stamp = C1 pin; containment reads show
NORMAL/absent/verified). Battery re-run on the
gate-assembled composed tree: parameterized P2 suite +
R5a suite + containment battery, composed V3 fixture
identities; own logs recorded. Julie's GO (§ below) naming
this gate. **Carried limitation (verbatim in the GO):
permanent production safety is not claimed until the retry
issue is resolved** — the 3,600,000 ms threshold is a
provisional candidate value only (correction ruling
decision 3), and the absence of a traffic-independent rate
bound remains an unresolved execution risk (decision 4).

**Mutation budget:** forward upload **1**; observability
PATCH ≤1 (same condition as C1); conditional rollback
upload ≤1 + PATCH ≤1 (to the C1 containment tree's
preserved parts). Commands/reports/SubmitJob/hold/queue:
**0**. Alarm registrations caused by this gate: **0
expected** (deploy is not a wake; any armedAt change vs
census is a finding to classify before anything else
proceeds). Recorder rows: 0 expected. Spend: $0.

**Alarm-mutation accounting (reconciled with the shipped +
R5a write paths):** the only `setAlarm` sites in the
composed tree are coordinator `_armAlarm` (one per
delivered pass, in its `finally`) and `_armAlarmIfEarlier`
(≤1 per wake operation, ≤2 only with a strictly-earlier
corrective second; the containment gate precedes it, and
the v3 re-check follows its `getAlarm()` await). This gate
performs no wake and delivers no pass, so its expected
count at both sites is 0; the budget lines above are the
complete accounting for the gate. The standing per-wake
bounds govern Gate S1, where wakes occur.

**Observability:** as C1, plus two `drive=1` observation
reads (~+10 and ~+25 minutes, the P2 cadence) classified
exactly as in the P2 gate: no rows + unchanged armedAt =
inconclusive (not proof of non-delivery); rows present =
classify each pass against the §7.3 pre-classified set;
armedAt changed without rows = a finding requiring
classification. This gate ends HELD regardless of
classification; no classification authorizes a stimulus.

**STOP behavior:** as C1 (census/battery/assembly before
upload; rollback evaluation on the named post-upload
triggers). Carries correction 6 as standing context: the
deploy arms the semantics under which a later wake could
revive the chain; containment (C1-deployed,
C2-readability-verified) is the standing answer, and its
state is a census item at this gate's open and close.

**Rollback limits:** rollback restores the C1
(containment-only V3) build. It cannot: un-fire an alarm
or un-issue a grant (none occurs in this gate);
retroactively change the semantics under which any wake
between deploy and rollback acted (the observation reads
bound that window and no wake is sent by the gate; a wake
from outside traffic during the window would be a
STOP-and-classify event); or substitute for containment.
Post-gate rollback needs its own authorization.

**Postflight evidence:** as C1, plus the two
observation-read transcripts with classifications and the
closing containment state read.

**Exact Julie GO scope for a future execution:**
> "GO — execute exactly one Gate R5a-D attempt as pinned:
> census, battery re-run, one upload of the composed V3
> candidate (+ at most one conditional observability PATCH,
> and conditionally one rollback upload + at most one
> conditional PATCH on the gate's named triggers), passive
> observation reads, NO stimulus of any kind, ending HELD.
> I understand permanent production safety is not claimed
> until the retry issue is resolved, the 60-minute
> threshold is a provisional candidate value, and no
> traffic-independent alarm rate bound exists."

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

**The boundary, analyzed (ruling item A's hard
constraint):** an operator containment transition is a
state-row write plus a route call. It is not an alarm
wake: it does not deliver a pass, does not evaluate the
schedule, and does not register anything — `contain_drive`
and `clear` touch no alarm API at all, and `stop_chain`'s
only alarm-API acts are the subtractive `deleteAlarm()`
and `getAlarm()` reads. Exercising the transitions
therefore does not "provoke an alarm or command" in the
prohibited sense. **But:** what `DRIVE_CONTAINED` *does* —
suppressing a drive — can only be OBSERVED at the moment a
pass would otherwise run. With no pass delivered, there is
no drive to suppress, and C3 cannot manufacture one
without becoming a stimulus gate. The same holds for the
arm gates' suppression under live wake traffic, and for
the §7 gate re-check under a real racing wake (offline,
CT13 proves the mechanism at harness strength; live, the
interleaving cannot be staged without traffic). **Those
claims are NOT verified by C3 and are returned for
Rowan's separate ruling (§Unverifiable remainder). C3's
verdict is PARTIAL, and must be reported with that word.**

What C3 CAN and does verify live, without any stimulus:

1. transition mechanics end-to-end on the production
   build: `contain_drive` applies, persists across reads,
   and reads back identically on the state route and the
   drive=1 projection;
2. the DRIVE_CONTAINED → NORMAL return under design §5.2
   (operator `clear` WITH a recorded reason), restoring
   the gate's own opening state;
3. **the full physical stop act against the existing
   registration**: the stale `armedAt` (1793562576104,
   2026-11-01T19:49:36.104Z) is already there to be read —
   removing it is subtractive and observable end-to-end
   (`stopArmedBefore` == the census value, `deleteAlarm`,
   read-back null, `stopStatus: verified`, drive=1
   `armedAt: null`) without provoking anything;
4. stop-record durability: the three recorded facts
   (design §2) read back consistently on both surfaces.

**Recommendation on the stop act's placement (a Rowan
ruling item):** the full `stop_chain` act + verification
belongs in C3 (as scoped above), ending C3 in
CHAIN_STOPPED/verified. The alternative — C3 stops after
the mechanics pair and the stop act waits for S1's
emergency budget — is recorded as considered and NOT
chosen: it would leave the single most consequential
physical act unverified until the moment it is needed as
an emergency measure, and it would make S1 (a stimulus
gate) the first live test of containment, which item E
forbids in spirit and this package forbids in text. The
cost of including it is real and stated: after C3, the
registration is ABSENT (the chain is stopped, not merely
contained) until a §5.3 restoration + a later ordinary
wake re-register it under R5a semantics — which is
precisely the state the S1 sequence wants to start from,
reached deliberately instead of by accident.

**Preflight (hard):** Gates C1, C2 (READABILITY
VERIFIED), R5a-D all closed. CENSUS re-based to the
composed build, PLUS: containment reads show state
NORMAL / absent / verified with the stop record empty;
the `drive=1` baseline records `armedAt` and it EQUALS
**1793562576104** (any other value = STOP: the registration
state has moved since the package was written, and the
stop act's expectations must be re-derived, not improvised);
recorder baseline (tableState + health + row count)
recorded. Battery re-run is NOT repeated here (no code
changes in this gate; C1/R5a-D records stand).

**The sequence (exactly this):**
1. `POST /v2/d6-containment {action: "contain_drive",
   authorizationRef: <gate record ref>}` → expect
   `applied`, state DRIVE_CONTAINED. Read back on BOTH
   surfaces (state route + drive=1 projection agree).
2. `POST … {action: "clear", authorizationRef, reason:
   "Gate C3 mechanics leg: restore opening state"}` →
   expect `applied`, state NORMAL. Read back on both
   surfaces. (This clear is the design §5.2 path; it is
   inside C3's GO because it reverses C3's own first step
   and nothing else. It is NOT a precedent for clearing
   CHAIN_STOPPED — see Restoration rules.)
3. `POST … {action: "stop_chain", authorizationRef}` →
   expect `applied` with `stopVerified: true` and the
   state read showing `stopStatus: "verified"`,
   `stopArmedBefore: 1793562576104`,
   `stopArmedAfter: null`, `stopVerifyAttempts: 1`. Read
   back on both surfaces; drive=1 `armedAt` must now be
   **null**, pendingSchedule/pendingWatchdog UNCHANGED
   (the stop preserves schedule rows — design §5.3).
4. Closing CENSUS repeat (expected deltas, and only
   these: containment state CHAIN_STOPPED with the stop
   record above; audit events per the budget; armedAt
   1793562576104 → null; everything else identical).

**Mutation budget (complete):** state-row writes **≤3**
(contain, clear, stop — one per step; a rejected or
idempotency-short-circuited step consumes its write only
as the design specifies and is a STOP-and-classify event,
not a retry opportunity). Audit events **≤5** (contain 1,
clear 1, stop_chain 1, plus on a stop-verification failure
only: stop_chain_verify 1 and `verify_chain_stop` events
≤2 within the attempts bound). `deleteAlarm` calls **≤3**
(the stop's 1, plus ≤1 per `verify_chain_stop` attempt,
only if a registration is observed). `setAlarm` calls:
**0** (any registration appearing during C3 is a
STOP-and-classify event — nothing in C3 arms). Commands /
reports / SubmitJob / uploads / PATCHes / hold flips /
queue changes: **0**. Recorder rows: 0 expected (no pass
is provoked; spontaneous rows are classified, and any row
at stage `contained` during steps 1–2 would in fact be
classified as evidence FOR suppression — but C3 does not
count on one and its verdict does not improve if one
appears: opportunistic evidence is reported as such, not
budgeted). Spend: $0.

**STOP behavior:** any census deviation (incl. the
armedAt expectation); any transition outcome other than
the expected one at any step; surfaces disagreeing; the
stop unverified after the bounded verify attempts (the
state then REMAINS CHAIN_STOPPED/unverified — no clear,
no restoration attempt, no further act under this gate;
the package returns for ruling with the CT6 posture live);
any `setAlarm`, recorder row, or plan/figure/conflict
delta not caused by C3's own budgeted acts. Per
correction 6, STOP here has its ordinary meaning: it
prevents further OPERATOR acts; nothing in C3 can revive
a chain, so there is no revived-chain edge in this gate.

**Restoration rules (decision 2 + design §5):** C3 ends
CHAIN_STOPPED **by design**. The step-2 clear is the only
clear this gate contains, and it applies only to the
DRIVE_CONTAINED mechanics leg. **Returning from
CHAIN_STOPPED to NORMAL is NOT in C3's scope, budget, or
GO.** It requires the standalone restoration authorization
named below (its own approval, a fresh census at its
execution, and a demonstrated reason recorded in the
clear's audit event), executed as a separate step after
C3's record is written and reviewed. No part of C3's GO
may be read as covering it.

**Rollback limits:** the mechanics leg is reversed by its
own step 2. The stop act has NO rollback inside this gate:
a deleted registration cannot be un-deleted by an
operator act — re-registration happens only through the
ordinary wake paths under NORMAL, i.e., only after the
standalone restoration. That irreversibility-without-
restoration is accepted as the gate's design (it is the
point of a stop), and it is why the stop's preconditions
(the armedAt expectation) are census-hard.

**Postflight evidence:** execution record: preflight
census (incl. armedAt expectation), each step's request/
response + both-surface read-backs, the stop record as
read on both surfaces, audit event listing, closing
census with the delta table, the PARTIAL verdict with
its basis, ends-HELD certification (halt "1", queue
paused, preserved plan and exemption untouched).

**Unverifiable remainder (returned for Rowan's separate
ruling; NOT claimed by C3):** drive suppression during a
live chain (observable only when a pass would otherwise
run); arm-gate suppression under genuine concurrent wake
traffic; the §7 re-check against a real racing wake; any
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
(design §5.3, all three preconditions, including the
stop-record precondition: C3 ended `verified`, so the
physical stop is proven). The act is exactly one
`POST /v2/d6-containment {action: "clear",
authorizationRef: <restoration record ref>, reason:
<demonstrated reason>}` plus read-backs. **The clear does
not re-arm**: the registration stays absent; the first
subsequent wake (which, in this sequence, is S1's stimulus
command) re-arms per the ordinary composed-build rules.
Mutation budget: 1 state-row write + 1 audit event; all
else 0. If the census deviates, the restoration does not
proceed and the system remains CHAIN_STOPPED.

**Exact Julie GO scope for a future execution:**
> "GO — execute the standalone restoration as pinned:
> fresh census, then exactly one clear of CHAIN_STOPPED
> with the recorded reason, read-backs only, ending HELD
> in NORMAL with the registration still absent."

---

## Gate S1 — Revival stimulus (the R2 stimulus, in sequence)

**Identity (preserved):** this gate IS the R2 stimulus
gate, sequenced after C1/C2/R5a-D/C3 + the standalone
restoration. Its diagnostic identity is preserved: the
stimulus is exactly one `RequestPause` command with a
fresh `command_id` targeting the reserved nonexistent job
`alarm-wake-probe:nonexistent` — a wake probe of whether
the platform reacts, observed through the recorder. A
negative result is reported ONLY as "**no observed revival
within the tested window, subject to recorder
limitations**" and never as proof that B2 is impossible.
On the composed build, unlike on the shipped build, the
same command is additionally the natural revival stimulus
under R5a semantics (at S1 time the registration is absent
after the restoration; the command's own wake evaluation
is what re-registers, per the composed build's rules);
revival, if it occurs, is classified against the §7.3
pre-classified set. Do not rename or re-scope the probe in
execution reporting.

**Hard dependency (item E): S1 is NOT the first test of
containment.** S1 may not be proposed for execution until
ALL of: Gate C3 complete with its PARTIAL verdict
recorded; Rowan has reviewed C3's record AND ruled on
C3's unverifiable remainder; the standalone restoration
authorization has been executed and read back (state
NORMAL, stop record reset, registration absent). The v2
readiness pair is REMOVED from this gate — its substance
was exercised in C3, on the same build, under its own
authorization; S1 contains no containment transition in
its preflight at all.

**Preflight (hard):** Gates C1, C2 (READABILITY VERIFIED),
R5a-D, C3 all closed; the remainder ruling and the
standalone restoration on record. CENSUS re-based to the
composed build with containment state NORMAL (post-
restoration read-backs attached); PLUS the R2 preflight
(target nonexistence verified on live job/plan reads;
fresh command_id generated and recorded in the execution
record BEFORE the stimulus; recorder state known — any
recorder row or armedAt different from the restoration's
closing read = STOP, the state has already moved).

**The stimulus (exactly this, once):** one
`POST /v2/commands` `{command_id: <fresh>, type:
"RequestPause", payload: {jobId:
"alarm-wake-probe:nonexistent"}}`. Expected response:
outcome `rejected`, reason `job_not_found`. **No re-send**
under any circumstance — a timeout or ambiguous response
is a STOP-and-classify event.

**Mutation budget (complete):** Commands rows: **exactly
1** (the stimulus). `setAlarm` registrations: ≤1 from the
stimulus command's own wake evaluation (composed build,
R5a bound; the memo bounds the whole operation), plus
per-pass `finally` registrations ONLY if passes are
delivered (each is shipped behavior, recorded, and
classified — not operator stimuli). Schedule rows: 0
expected from the stimulus (watchdog already pending;
pendingWatchdog 0 at preflight = census deviation =
STOP). Containment transitions in preflight: **0** (see
the hard dependency). Uploads/PATCHes/hold flips/queue
changes/SubmitJob: **0**. **Contingency (named,
bounded):** if any post-stimulus movement falls OUTSIDE
the §7.3 pre-classified set, the executor applies
`contain_drive` once (+1 state-row write, +1 audit event)
to bound accumulation while reporting — `stop_chain` is
NOT authorized in this gate (it has its own verified
procedure and record from C3; using it here would be a
fresh act under a stimulus gate's GO). Spend: $0 in every
branch while the holds stand.

**Observability:** `drive=1` + state-route + plan/job
reads at ≈ +2, +12, and +37 minutes (the final read
beyond one full 35-minute stall-window convention), then
a closing census. No further stimulus during the window,
whatever the reads show.

**Result classification:** revival observed → classify
every movement against the §7.3 set (grants [] → [the one
grant], occurrence pending → granted, job queued rev 1 →
generating rev 2, derived reserved 0 → 12, phase figures
frozen, dispatched 0; the bounded lease-expiry/re-grant
cycle with its invariants); anything outside = STOP +
report (+ the contingency above). No revival → the
mandated wording (above) and nothing stronger.

**STOP behavior:** correction 6 governs, verbatim, with
this gate's specific edge: once the single command is
sent, there is nothing left for a STOP to prevent — the
remaining steps are reads, the contingency, and
reporting; if the chain revives, STOP does not quiet it,
containment (operationally verified to C3's PARTIAL scope
and ruled on by Rowan) is the standing answer. STOP
before the stimulus on: any preflight item failing,
target existence ambiguous, command_id collision,
restoration record incomplete, recorder state already
moved.

**Rollback limits:** there is no rollback for a sent
command — the commands row stands as the audit record of
the probe. A revived chain is not "rolled back"; it is
contained (contingency above, or a further gate for
`stop_chain` under its own authorization, informed by
C3's verified stop procedure).

**Postflight evidence:** execution record: preflight
transcripts (census, C3 + remainder-ruling + restoration
references, target-nonexistence, command_id), stimulus
request/response, the three observation transcripts with
classifications, contingency record if fired, closing
census (expected deltas, and only these: +1 commands row;
≤ the budgeted registrations; recorder rows if passes
ran; grant-cycle state ONLY if revival occurred and ONLY
within the §7.3 set), ends-HELD certification (halt "1",
queue paused, preserved plan and exemption untouched).

**Exact Julie GO scope for a future execution:**
> "GO — execute exactly one Gate S1 (R2 stimulus) attempt
> as pinned: preflight census (C3 complete and reviewed,
> remainder ruled on, standalone restoration executed),
> exactly one `RequestPause` command with the recorded
> fresh command_id targeting `alarm-wake-probe:
> nonexistent`, no re-send, observation reads only, the
> named contain_drive contingency if movement leaves the
> pre-classified set, ending HELD. I understand a negative
> result will be reported as 'no observed revival within
> the tested window, subject to recorder limitations' and
> proves nothing about B2, and that if the chain revives,
> no STOP can quiet it — containment is the standing,
> separately verified answer."

**Turn: Rowan's** (review of all five gates as separate
scopes, the C3 scope recommendation, and the standalone
restoration step). No GO is requested by this proposal.
