# Phase B — recovery gates v2 (four independently scoped proposals)

**Status: PROPOSALS ONLY — NONE APPROVED, NONE TO BE EXECUTED.**
Prepared under Rowan's R5a-revised-package ruling (relayed
verbatim by Julie 2026-11-02; record
`ROWAN-R5A-REVISED-PACKAGE-RULING.md`), required work E: *"Separate
containment deployment, containment verification, R5a deployment,
and any subsequent revival stimulus into independently reviewable
authorization scopes. Each gate must specify preflight conditions,
mutation budget, observability, STOP behavior, rollback limits,
and postflight evidence. Do not use a production command or alarm
wake as an implicit verification step."*

This file replaces the single combined R5a gate skeleton of the
prior package (`PHASEB-R5A-REVISED-GATE-PROPOSAL.md`, superseded)
and absorbs the R2 gate paperwork (`PHASEB-R2-GATE-PROPOSAL.md`)
as Gate S1, preserving R2's diagnostic identity per ruling
decision 6. Execution of ANY gate requires (a) Rowan's approval
of THAT gate as a separate ruling and (b) a fresh explicit Julie
GO in that gate's §GO wording. Approval of one gate approves no
other. Sequence, if all are eventually approved: **C1 → C2 →
R5a-D → S1** (ruling decision 5: independently verified
containment precedes any authorized revival stimulus).
Production remains under INVESTIGATION HOLD: GENERATION_HALT
"1", queue delivery paused, preserved plan and idx-26 exemption
untouched.

**Common census (referenced as CENSUS below; any deviation =
STOP before any mutation, executor STOP law):** /health build
stamp as expected for the gate; script etag exact; 31/31 parts vs
the operative manifest; observability enabled + persisted; 10
bindings; GENERATION_HALT "1"; policy enforce; settings revision
1; queue paused, 1 consumer; standard admitted / Batch not armed;
registry FP ↔ `5c589095-f812-48a2-8ab2-03ba2791f2b2`; phase
figures exact (settled 1,029,420 / estimatedUnverified 19,018 /
reservedUnverified 5,648 / unknownOpen 0 / remaining 12,464,932);
reconcile `ok: true` with the sole straddler
(`att-37d63768-db4b-447d-8150-580b7c6ee257`, estimated_unverified);
current PT day dispatched 0; exactly 5 plans with the preserved
plan `plan:19cad189fab54b9c804a74a6` active {eligible 1, done 0,
failed 0, blocked 0}, entry pending, job queued rev 1, quarantine
unheld, grants []; eligibility digests consistent at `cdef2c7e…`;
conflicts exactly the 4-row `schedule_dead` baseline; parked
fingerprint `b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282`;
watermarks content 18 / bindings 1841; idx-26 R2 key FREE; and a
`drive=1` read recording armedAt, pendingSchedule,
pendingWatchdog, tableState, recorderHealth (and, on a
containment-capable build, the containment projection) as the
gate's baseline.

**Correction 6 (standing, governs every STOP in every gate
below):** STOP prevents additional operator stimuli but cannot
itself stop an already-revived alarm chain. A successful recovery
may continue watchdog and grant/void activity beyond the
observation window, indefinitely under the holds; containment of
a revived chain is an independently gated procedure (Gates
C1/C2 deploy and verify it; Gate S1 carries one named contingency
use), and that continuing effect must be explicitly addressed
before any production stimulus.

---

## Gate C1 — Containment deployment (code only; ends inert)

**Scope:** deploy the containment candidate (live build
`86ad06ab…` + containment; 3 changed parts: coordinator
`12d73bef…`, entry `0183aabf…`, service `ebed452a…`; identities in
`containment/CANDIDATE-IDENTITIES.md`) and verify the deploy.
The gate ends with containment **INERT**: no transition is
performed; the containment state remains absent/NORMAL. **No
stimulus of any kind** — no command, report, wake provocation,
SubmitJob, hold or queue change.

**Preflight:** CENSUS re-based to build `86ad06ab…` / etag
`ba80e81f…`. Battery re-run on the gate-assembled tree is
mandatory (parameterized P2 suite + containment battery against
the containment fixture identities; the pinned logs are evidence
about the pinned tree, the gate records its own). Build pin of
the assembled tree before upload (build-marker rule; the stamped
`build-identity.mjs` is counted in assembly verification as in
the P2 gate).

**Mutation budget:** forward upload **1**; observability PATCH
≤1, only if the post-upload read shows observability reset;
conditional rollback upload ≤1 + PATCH ≤1 (rollback triggers
below only). Commands/reports/SubmitJob/hold flips/queue changes:
**0**. Alarm registrations caused by this gate: **0 expected**
(a deploy is not a wake; both prior deploys left the armed value
bit-identical — any change is a finding to classify, not a budget
item). Recorder rows: 0 expected. Spend: $0.

**Observability required during the gate:** post-upload
script-settings read (observability enabled + persisted);
`drive=1` read (the `containment` projection must be present and
report state NORMAL / absent / verified); state route read
(`GET /v2/d6-containment`: state NORMAL, absent true); /health on
the new build stamp with generation halted.

**STOP behavior:** before upload — any census deviation, battery
mismatch, assembly hash mismatch. After upload — rollback
evaluation fires on: read-back parts not byte-identical to the
stamped manifest; /health wrong; any change vs census in the
preserved plan, conflicts baseline, phase figures, watermarks,
hold/queue state, or the recorded armedAt that is not fully
explained. STOP in this gate prevents the upload or triggers
the rollback evaluation; per correction 6 it is not represented
as affecting any alarm chain (none is provoked).

**Rollback limits:** rollback = re-upload of the live build
`86ad06ab…`'s byte-identical preserved parts (+ ≤1 conditional
PATCH), then read-back. Rollback removes the containment CODE.
It cannot: un-create the containment tables if any transition
had run (none does in C1 — the tables are never created by the
deploy or by reads); un-fire any alarm (none is provoked);
un-issue any grant (none can issue — drive behavior in NORMAL
is unchanged and the system is held). Any rollback after the
gate closes needs its own authorization. The permanent rollback
floor (`6a73d962…`) is untouched.

**Postflight evidence:** execution record with census transcript,
assembly + battery logs (hashes), upload response, D2 read-back
(31/31 byte-identical), observability read, both containment
reads (state route + drive=1 projection), closing CENSUS repeat,
ends-HELD certification.

**Exact Julie GO scope for a future execution:**
> "GO — execute exactly one Gate C1 attempt as pinned: census,
> battery re-run, one upload of the containment candidate (+ at
> most one conditional observability PATCH, and conditionally one
> rollback upload + at most one conditional PATCH on the gate's
> named triggers), passive reads only, NO containment transition,
> NO stimulus of any kind, ending HELD with containment inert."

---

## Gate C2 — Containment verification (PASSIVE ONLY; zero mutations)

**Scope:** verify, from passive evidence alone, that the
containment deployed by Gate C1 is present, readable, and inert —
and that production state is exactly as C1 left it. **Design
choice (for Rowan's ruling): C2 performs NO transition.**
Verification rests on: deploy-time read-backs (C1's record), the
state route and drive=1 reads (the containment projection +
armedAt + schedule counts), plan/job/conflict/phase reads, and
the offline battery evidence for transition behavior. A
transition exercised "just to prove the flag path" would itself
be the first live use of a state-changing operator act; that
first use is placed inside Gate S1 (§S1 preflight pair) where it
is named, budgeted, and reversible within the same gate, rather
than inside a gate whose defining property is zero mutations.
The alternative — a C2 variant whose budget includes one
`contain_drive` + one `clear` — is recorded here as considered
and NOT chosen; if Rowan prefers it, C2's budget changes by
exactly those two transitions and this section is rewritten
before any approval.

**Preflight:** C1's postflight record exists and its closing
census is the expected opening state; live build stamp == C1's
pin; a fresh CENSUS (all items, incl. the containment reads:
state route reports state NORMAL, absent true, verified true;
drive=1 containment projection agrees).

**Mutation budget:** **0.** No uploads, no PATCHes, no
transitions, no commands, no reports, no wakes. Reads only.

**Observability:** the evidence set itself: (1) state route
read — state NORMAL/absent/verified, armedAt equals the C1
closing value, pendingSchedule/pendingWatchdog equal closing
values; (2) drive=1 read — containment projection consistent
with (1), recorder table state and health as at C1 close (no new
rows: no pass has been provoked and none is needed —
spontaneous rows, if any appeared between gates, are classified,
not ignored); (3) plan/job reads byte-compared to C1 close;
(4) /health.

**STOP behavior:** any contradiction among the reads, any
unexplained delta from C1's close, or an unavailable read =
STOP: C2 reports the verification as FAILED/INCONCLUSIVE with
the specific contradiction; it attempts no repair, no retry
beyond one repeated read of the same surface, and no other gate
may open on a failed C2. (An inconclusive C2 leaves containment
"deployed, unverified" — Gate R5a-D's precondition is a PASSED
C2.)

**Rollback limits:** none applicable and none available — C2
changes nothing, so there is nothing to roll back. If C2 fails,
remediation is a new ruling, not a rollback.

**Postflight evidence:** verification record: the four read
transcripts with timestamps, the delta table vs C1 close (all
zero), and the verdict (VERIFIED / FAILED / INCONCLUSIVE) with
its basis.

**Exact Julie GO scope for a future execution:**
> "GO — execute Gate C2 as pinned: passive reads only, zero
> mutations of any kind, ending HELD, and report the containment
> verification verdict."

---

## Gate R5a-D — R5a deployment (on the containment-verified tree; deploy only)

**Scope:** deploy the COMPOSED candidate (containment tree +
R5a; coordinator `c097061a…`, entry `0183aabf…`, service
`ebed452a…` vs the live build — i.e., exactly one part,
coordinator, changes vs the C1 tree) and verify. **No stimulus:**
the deployment changes the semantics under which any LATER wake
acts; this gate sends no wake. Ends HELD.

**Preflight (hard):** Gates C1 and C2 both closed with C2's
verdict VERIFIED. CENSUS re-based to the C1 build (build stamp =
C1 pin; containment reads show NORMAL/absent/verified). Battery
re-run on the gate-assembled composed tree: parameterized P2
suite + R5a suite + containment battery, composed fixture
identities; own logs recorded. Julie's GO (§ below) naming this
gate. **Carried limitation (verbatim in the GO): permanent
production safety is not claimed until the retry issue is
resolved** — the threshold is a provisional candidate value
(ruling decision 2), and the traffic-independent rate bound
remains an unresolved execution risk (decision 3).

**Mutation budget:** forward upload **1**; observability PATCH
≤1 (same condition as C1); conditional rollback upload ≤1 +
PATCH ≤1 (to the C1 containment tree's preserved parts).
Commands/reports/SubmitJob/hold/queue: **0**. Alarm
registrations caused by this gate: **0 expected** (deploy is not
a wake; any armedAt change vs census is a finding to classify
before anything else proceeds). Recorder rows: 0 expected.
Spend: $0.

**Alarm-mutation accounting (reconciled with the shipped +
R5a write paths, per decision 3):** the only `setAlarm` sites in
the composed tree are coordinator `_armAlarm` (one per delivered
pass, in its `finally` — unchanged shipped behavior) and
`_armAlarmIfEarlier` (≤1 per wake operation, ≤2 only with a
strictly-earlier corrective second; containment gate precedes
it). This gate performs no wake and delivers no pass, so its
expected count at both sites is 0; the budget lines above are
the complete accounting for the gate. The standing per-wake
bounds govern Gate S1, where wakes occur.

**Observability:** as C1, plus two `drive=1` observation reads
(~+10 and ~+25 minutes, the P2 cadence) classified exactly as in
the P2 gate: no rows + unchanged armedAt = inconclusive (not
proof of non-delivery); rows present = classify each pass
against the §7.3 pre-classified set; armedAt changed without
rows = a finding requiring classification. This gate ends HELD
regardless of classification; no classification authorizes a
stimulus.

**STOP behavior:** as C1 (census/battery/assembly before upload;
rollback evaluation on the named post-upload triggers). Carries
correction 6 as standing context: the deploy arms the semantics
under which a later wake could revive the chain; containment
(C1/C2-verified) is the standing answer, and its state is a
census item at this gate's open and close.

**Rollback limits:** rollback restores the C1 (containment-only)
build. It cannot: un-fire an alarm or un-issue a grant (none
occurs in this gate); retroactively change the semantics under
which any wake between deploy and rollback acted (the
observation reads bound that window and no wake is sent by the
gate; a wake from outside traffic during the window would be a
STOP-and-classify event); or substitute for containment.
Post-gate rollback needs its own authorization.

**Postflight evidence:** as C1, plus the two observation-read
transcripts with classifications and the closing containment
state read.

**Exact Julie GO scope for a future execution:**
> "GO — execute exactly one Gate R5a-D attempt as pinned:
> census, battery re-run, one upload of the composed candidate
> (+ at most one conditional observability PATCH, and
> conditionally one rollback upload + at most one conditional
> PATCH on the gate's named triggers), passive observation
> reads, NO stimulus of any kind, ending HELD. I understand
> permanent production safety is not claimed until the retry
> issue is resolved, the 60-minute threshold is a provisional
> candidate value, and no traffic-independent alarm rate bound
> exists."

---

## Gate S1 — Revival stimulus (the R2 stimulus, in sequence)

**Identity (ruling decision 6):** this gate IS the R2 stimulus
gate, sequenced after C1/C2/R5a-D. Its diagnostic identity is
preserved: the stimulus is exactly one `RequestPause` command
with a fresh `command_id` targeting the reserved nonexistent job
`alarm-wake-probe:nonexistent` — a wake probe of whether the
platform reacts, observed through the recorder. A negative result
is reported ONLY as "**no observed revival within the tested
window, subject to recorder limitations**" and never as proof
that B2 is impossible. On the composed build, unlike on the
shipped build, the same command is additionally the natural
revival stimulus under R5a semantics (the stale armed value is
~20 h past due, beyond the threshold); revival, if it occurs, is
classified against the §7.3 pre-classified set. Do not rename or
re-scope the probe in execution reporting.

**Preflight (hard):** Gates C1, C2 (VERIFIED), R5a-D all closed.
CENSUS re-based to the composed build; PLUS the R2 preflight
(target nonexistence verified on live job/plan reads; fresh
command_id generated and recorded in the execution record
BEFORE the stimulus; recorder state known — any recorder row or
armedAt different from the last R5a-D observation = STOP, the
state has already moved). PLUS the **containment readiness
pair** — the first live use of the transition path, named and
budgeted here (the C2 design choice): `contain_drive` via the
operator route, passive verification (state route: DRIVE_CONTAINED,
verified), then `clear`, passive verification (state route:
NORMAL). Any failure or contradiction in the pair = STOP before
the stimulus; containment is then treated as unverified live
and no stimulus may proceed under this gate.

**The stimulus (exactly this, once):** one `POST /v2/commands`
`{command_id: <fresh>, type: "RequestPause", payload: {jobId:
"alarm-wake-probe:nonexistent"}}`. Expected response: outcome
`rejected`, reason `job_not_found`. **No re-send** under any
circumstance — a timeout or ambiguous response is a
STOP-and-classify event.

**Mutation budget (complete):** containment readiness pair:
**2** state-row writes + 2 audit events (contain + clear).
Commands rows: **exactly 1** (the stimulus). `setAlarm`
registrations: ≤1 from the stimulus command's own wake
evaluation (composed build, R5a bound; the memo bounds the whole
operation), plus per-pass `finally` registrations ONLY if passes
are delivered (each is shipped behavior, recorded, and
classified — not operator stimuli). Schedule rows: 0 expected
from the stimulus (watchdog already pending; pendingWatchdog 0
at preflight = census deviation = STOP). Uploads/PATCHes/hold
flips/queue changes/SubmitJob: **0**. **Contingency (named,
bounded):** if any post-stimulus movement falls OUTSIDE the
§7.3 pre-classified set, the executor applies `contain_drive`
once (+1 state-row write, +1 audit event) to bound accumulation
while reporting — `stop_chain` is NOT authorized in this gate.
Spend: $0 in every branch while the holds stand.

**Observability:** `drive=1` + state-route + plan/job reads at
≈ +2, +12, and +37 minutes (the final read beyond one full
35-minute stall-window convention), then a closing census. No
further stimulus during the window, whatever the reads show.

**Result classification:** revival observed → classify every
movement against the §7.3 set (grants [] → [the one grant],
occurrence pending → granted, job queued rev 1 → generating
rev 2, derived reserved 0 → 12, phase figures frozen, dispatched
0; the bounded lease-expiry/re-grant cycle with its invariants);
anything outside = STOP + report (+ the contingency above). No
revival → the mandated wording (above) and nothing stronger.

**STOP behavior:** correction 6 governs, verbatim, with this
gate's specific edge: once the single command is sent, there is
nothing left for a STOP to prevent — the remaining steps are
reads, the contingency, and reporting; if the chain revives,
STOP does not quiet it, containment (readiness-verified in this
gate's preflight) is the standing answer. STOP before the
stimulus on: any preflight item failing, target existence
ambiguous, command_id collision, readiness-pair failure,
recorder state already moved.

**Rollback limits:** there is no rollback for a sent command —
the commands row stands as the audit record of the probe. The
readiness pair is reversed by its own second half (clear) or, on
a STOP between the pair, by one additional budgeted `clear`
(+1 state write + 1 event) to restore the opening state. A
revived chain is not "rolled back"; it is contained (contingency
above, or a further gate for `stop_chain`).

**Postflight evidence:** execution record: preflight transcripts
(census, target-nonexistence, command_id, readiness pair with
both passive verifications), stimulus request/response, the
three observation transcripts with classifications, contingency
record if fired, closing census (expected deltas, and only
these: +1 commands row; readiness-pair writes netting to state
NORMAL; ≤ the budgeted registrations; recorder rows if passes
ran; grant-cycle state ONLY if revival occurred and ONLY within
the §7.3 set), ends-HELD certification (halt "1", queue paused,
preserved plan and exemption untouched).

**Exact Julie GO scope for a future execution:**
> "GO — execute exactly one Gate S1 (R2 stimulus) attempt as
> pinned: preflight census and containment readiness pair, exactly
> one `RequestPause` command with the recorded fresh command_id
> targeting `alarm-wake-probe:nonexistent`, no re-send,
> observation reads only, the named contain_drive contingency if
> movement leaves the pre-classified set, ending HELD. I
> understand a negative result will be reported as 'no observed
> revival within the tested window, subject to recorder
> limitations' and proves nothing about B2, and that if the chain
> revives, no STOP can quiet it — containment is the standing,
> separately verified answer."

**Turn: Rowan's** (review of all four gates as separate scopes).
No GO is requested by this proposal.
