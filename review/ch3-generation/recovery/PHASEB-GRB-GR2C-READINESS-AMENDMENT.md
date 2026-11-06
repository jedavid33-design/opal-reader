# Phase B — GENERATION-RESUME gate: GR-B / GR-2C READINESS AMENDMENT and REVISED GO PROPOSAL

**What this document is.** The consolidated amendment commissioned by
Rowan's OQ-2 cold-restart assessment ruling (`ROWAN-OQ2-RULING.md`;
verdict **PASS WITH CONDITIONS ON DESIGN — OQ-2 REMAINS OPEN PENDING
OBSERVATION**). It does four things: **(1)** incorporates the
gate-internal cold-restart checkpoint **GR-2C** into the operative
resume protocol, at an exact slot in the execution sequence, enacting
the ruling's required protocol correction and failure law, with
Q-3's conditions carried as operative predicates; **(2)** carries the
V-3 harness annex the ruling makes mandatory (Q-1, Q-6) — a
completion slot at §4, because the battery had not run when this
amendment was drafted; its results are inserted verbatim at filing
from `v3-harness/RESULTS.md`, and no number in §4 is asserted here;
**(3)** answers the OQ-5 feasibility condition from Rowan's final
readiness ruling (its item 4) at §5; and **(4)** returns the
**revised, adopted-GR-B GO proposal** at §6 for Rowan's final review
under Q-7 — **for Rowan only; it is expressly NOT presented to Julie
by this filing**, and may be presented only after Rowan accepts it
(and only with the V-3 annex standing completed at PASS — §4.3).

**Documents amended.** The final consolidated readiness confirmation
(pin `ad42c9e9b961944df25ad29c0e487ceb0ad0f939`, repo
`jedavid33-design/opal-reader`, branch `ui1-review`) — its §6
sequence, its §4.3 branch consequence, and its §9 GO wording — as
that confirmation itself consolidated the generation-resume package
(pin `0946f9f2fb978a46b562c738d8ac6d9d4ee977a6`), correction 1 (pin
`8ca683bdfe2967b1e23a99b9eded99b065478a00`), and correction 2 (pin
`91bb9c44b8b6a1a80310b14c2668e85cf110ad98`). The GR-2C design
incorporated here is §5.1 of the OQ-2 cold-restart assessment (pin
`91c0731e9044db701a4dd2ced792dd3badc1347b`), with its §6 stop rules,
§7 recorder evidence specification, and §8 conditional-discharge
construction as ruled on. **Branch GR-B stands determined** under
reading (i) of the final readiness ruling (its item 1): the adopted
predicates are the confirmation §3.2 baseline values — plan
`active`, totals {eligible 1, done 0, failed 0, blocked 0, prompts
0}, sole entry and occurrence `granted`; job `generating` revision
**88**; 87 grants, `seg:1`–`seg:86` voided,
`grant:plan:19cad189fab54b9c804a74a6:seg:87:full` **issued** and
live; derived reserved
**12**; dispatched 0, provider attempts 0, settled delta 0; phase
figures at the §4.0 item 5 frozen values; containment NORMAL;
`armedAt` null. GR-A is foreclosed (final readiness ruling item 1)
and must not be manufactured by resetting or replacing the job.

**Pin:** `<AMEND-PIN>` (this amendment and its companion CP ride in
one pin commit; Rowan reads the Dropbox copy, whose CP carries the
pin filled).

**Non-authorizations.** This amendment authorizes nothing: no probe,
wake, hold lift, SubmitJob, grant mutation, generation, deployment,
or Batch activation (the OQ-2 ruling's own bar, carried verbatim in
substance). OQ-2 remains **OPEN PENDING OBSERVATION**; nothing in
this filing discharges it, presumes a GR-2C outcome, or requests a
GO from Julie.

---

## 1. Status — what changes, and what does not

**Changes, exhaustively:**

1. **A new named checkpoint step, GR-2C,** is inserted into the
   confirmation §6 execution sequence — exact slot at §2.1 below.
   GR-3 (halt lift) may not be entered until GR-2C is declared met.
2. **The ruling's protocol correction is enacted** (§2.3): the first
   successful recorder row and the settled successor-grant
   observations are **separately evidenced**; a completed drive pass
   is never equated with proof that the successor has issued;
   intermediate polls are preserved; the void and reissue
   transitions are identified; the two-complete-poll rule applies
   to the final accounting state.
3. **Q-3's conditions are operative predicates** of GR-2C (§2.2):
   the five observations as checkpoint exit criteria; the
   two-consecutive-complete-polls rule; the transient-reserved-0
   rule; the revision 89/90 rule; the hard 15-minute bound with no
   discretionary extension.
4. **The §4.3 branch consequence is superseded as ruled.** The
   confirmation's §4.3 rule (proceed only on an exact GR-A census;
   a churn-state census stops and returns) is overtaken by the
   final readiness ruling's branch determination: the execution
   census now verifies the **adopted GR-B predicates** (§0 above),
   and on an exact match the sequence proceeds GR-1 → GR-2 →
   **GR-2C** → lifts. Any other census state — GR-A's form
   included, should it impossibly appear — is a deviation: STOP
   before any mutation and return for ruling. (Rowan's final
   readiness ruling item 5 already held the GR-A-only GO wording
   NOT APPROVED as inconsistent with the known GR-B baseline; this
   amendment's §6 replaces it.)
5. **The confirmation §9 GO wording is superseded** by the revised
   proposal at §6 of this amendment, in full. No other wording may
   be presented to Julie for this gate.
6. **The V-3 annex (§4) is a mandatory component** of this gate's
   readiness evidence. The confirmation's readiness position is
   incomplete until the annex stands completed; a failed or
   ambiguous V-3 assertion blocks the gate until separately
   reviewed (Q-6).

**Unchanged, and not re-opened by this amendment:** the execution
census specification (confirmation §3.3, including the R4 captured
etag artifact `g06-etag.json`, saved before the wake decision); the
GR-3 provenance record (§2 of the confirmation) and its application
(a non-null `armedAt` at census is an unexplained deviation and a
STOP — final readiness ruling item 3); the wake mechanism and its
verification discipline (§5 of the confirmation, GR-1…GR-7 as
corrected); the two timing controls (§6.1 — the sliding ≥35-minute
stall test and the adopted three-hour checkpoint from T0); abort
conditions A-1…A-7 (§6.2, including A-7 and its
completed-with-discrepancy carve-out); the completion set and
closure evidence (§6.3); the counted-command ledger (≤ 5 production
commands on every path, the probe counted as one — §7.1), the money
figures at their true scope (§7.2 — the 12,808-unit forecast line
and the 25,000-unit detection threshold are deviation signals,
never caps; the 12-slot cohort reservation bounds attempts), quota
(§7.3), and scope (§7.4 — one segment, the preserved plan only, no
Batch, no rest-of-book, **no second SubmitJob ever**); and the OQ-5
observation duty as specified (confirmation §8), whose feasibility
condition §5 of this amendment answers.

---

## 2. GR-2C — the cold-restart checkpoint, incorporated

### 2.1 The exact slot

In the confirmation §6 sequence (GR-0 fresh execution census →
GR-1 voice checkpoint → GR-2 the wake → GR-3 halt lift → GR-4 queue
unpause → GR-5 monitored generation → GR-6a success close → GR-7
closing census), **GR-2C is inserted immediately after GR-2 and
immediately before GR-3**. No existing step is renumbered, renamed,
or re-ordered; the steps after the insertion point keep their
names, and every cross-reference to GR-3 in the operative documents
now reads subject to this insertion. The lift decision is GR-3:
**neither hold may lift until GR-2C is declared met**, and GR-2C
itself sits entirely inside the holds-on phase — at its every
moment GENERATION_HALT stands `"1"` and the queue stands paused,
so the cold transition it observes is exposure-free by construction
(assessment §2, M-9: under the holds a drive pass can churn; it
cannot dispatch — `sendGrant` is wired only when GENERATION_HALT
is `"0"`).

### 2.2 Exit criteria — observations GR-2C(a)…(e) (Q-3, ACCEPT WITH CONDITIONS)

GR-2C is declared met only when **all five** observations below are
in hand, from the gate's existing read set, each with its evidence
preserved raw. The observations discharge the cold-restart
sub-questions as mapped (assessment §3).

- **GR-2C(a) — Valid new recorder row** *(CR-1, delivery).* A
  recorder row with id ≥ **297**, `stage complete`, `drive_invoked`
  1, error fields null, whose `at` falls within the 15-minute
  bound of the GR-2 probe's dispatch (assessment §7's row-quality
  set). **This observation is evidenced separately** (§2.3): the
  row's own poll capture stands as the delivery evidence, on its
  own, before any successor-grant observation is taken.
- **GR-2C(b) — Confirmed registration** *(CR-1, creation re-verified
  post-pass).* The row's `armed_after` is non-null and in the
  future relative to the row's `at`, corroborated at the same poll
  by the diagnostics alarm block (`armedAt`, `pendingSchedule`,
  `pendingWatchdog`) — the chain stands armed after the pass. (A
  registration value alone never proves delivery — item 3 of the
  final readiness ruling; (b) is read only alongside (a).)
- **GR-2C(c) — Safe void and sequential reissue** *(CR-2; CR-4
  ordering).* At the settling polls: `seg:87:full` reads
  **voided**; exactly **one** live grant stands —
  `grant:plan:19cad189fab54b9c804a74a6:seg:88:full`, `issued`, for
  occurrence `2a85f74f-353d-4c25-a86a-4a4db392868b`; the occurrence
  reads `granted`; and **no second live grant appears at any
  poll** of the checkpoint. `seg:87` must not be reissued (Q-4:
  the successor's identity is accepted at source-derived strength
  — the grant id is the job revision at issuance, so the next
  issuable grant on this job is `seg:88:full`; any production
  discrepancy returns for review). The void and the reissue are
  **separately identified transitions** (§2.3), not inferred from
  the settled state alone.
- **GR-2C(d) — Reservation continuity** *(CR-3).* Derived reserved
  reads exactly **12** at the settling polls. A transient value of
  **0** is permissible **only** as an observed, explainable
  intermediate in polls strictly between the identified void
  transition and the identified reissue transition of (c). A value
  of **24 at any poll**, any other reservation value, or any
  unexplained reservation movement is a **STOP**.
- **GR-2C(e) — Zero dispatch / spend** *(CR-4; E-4 re-verified
  cold).* Dispatched **0** and provider attempts **0** on every
  surface, at every checkpoint poll; phase figures frozen at the
  §4.0 item 5 values (settled 1,029,420; estimatedUnverified
  19,018; reservedUnverified 5,648; remaining 12,464,932 of
  13,500,000); `recorderHealth.recordingFailures` still **0**.

**Poll discipline (Q-3; the protocol correction).** Polls run at
the GR-2 paired cadence — complete polls at most 5 minutes apart —
with executor-recorded timestamps, and **every intermediate poll is
preserved raw**. GR-2C may be declared met only on **two
consecutive complete accounting polls** — full checkpoint read set
(job read, quota and phase surfaces, diagnostics) — both showing
the settled state (a)–(e) above, **before either hold lifts**.

**Job-revision rule (Q-3).** The job revision at the settling
polls may read **89 or 90**, and is accepted **only** when the
recorded event sequence (the recorder rows and the identified
void/reissue transitions) explains the count **and** the exact
grant, occurrence, and reservation predicates of (c)–(d) match.
Revision alone is not evidence of success; an unexplained 89 or
90, or any other revision value, is a STOP.

**The bound (Q-3).** The 15-minute recorder verification remains
the **hard failure-decision bound**: the full checkpoint — the row
of (a) and both settling polls — must be verified **within the
authorized observation window** (15 minutes from the probe's
dispatch). If it cannot, **STOP with both holds standing. No
discretionary extension**, under any wording.

**Discharge semantics (Q-2).** On GR-2C declared met, **OQ-2 is
discharged for this specific GR-B attempt only** — the conditional
discharge construction the ruling accepts. No success is presumed
from source analysis, harness results, registration creation, or
command receipt alone (Q-2, verbatim in substance); the discharge
rests on the observations and on nothing else. Any GR-2C failure
voids the discharge for the attempt: the gate ends HELD and the
question returns (assessment §8's drafted language, as ruled on).

### 2.3 The protocol correction, enacted (ruling, required)

> The first successful recorder row and the settled successor-grant
> observations must be separately evidenced. Do not equate a
> completed drive pass with proof that the successor has issued.
> Preserve intermediate polls, identify the void and reissue
> transitions, and apply the two-complete-poll rule to the final
> accounting state.

Operatively: the execution record must present, as distinct
evidence items, **(i)** the poll capture carrying the first new
recorder row (GR-2C(a)/(b)); **(ii)** the first poll at which
`seg:87:full` reads voided (the void transition); **(iii)** the
first poll at which `seg:88:full` reads issued (the reissue
transition); and **(iv)** the two consecutive complete settling
polls of §2.2. A record that shows only a completed pass and a
settled state, without (ii) and (iii) identified, has **not**
discharged GR-2C, however clean the settled state reads.

### 2.4 Failure law at the checkpoint (ruling, failure law)

> Any unexpected probe receipt, recorder discrepancy, grant state,
> reservation value, dispatch, phase movement, or hold deviation
> stops progression. If the checkpoint fails before the lifts, both
> holds remain standing. If a later step fails after lifting,
> execute the already-ruled re-pause/re-halt sequence and verify
> it. Every close retains the post-gate observation duty.

Operatively at GR-2C, each of the following is a STOP (the
assessment §6 stop rules S-1…S-8 stand incorporated by reference
and are applied under these heads): a probe receipt other than
the expected `{"outcome":"rejected","reason":"job_not_found"}`
(S-8); no new recorder row within the bound (S-1); `seg:87` still
`issued` after a recorded pass, or the occurrence in
`outcome_unknown` (S-2); a second live grant, or any grant other
than the standing member and its single sequential successor
(S-3); reserved 24, settled at other than exactly 12, or any phase
movement (S-4); dispatched > 0, provider attempts > 0, or any
settled movement (S-5 — under the holds, a structural impossibility
made real); a recorder row of non-`complete` stage or with non-null
error fields, or `recordingFailures` > 0 (S-6). On any GR-2C STOP:
the raw polls are preserved exactly as taken; no corrective or
further act is taken under the gate's authorization; **both holds
remain standing** (they never lifted — there is nothing to
re-hold); the attempt is consumed; and the gate returns to Rowan
and Julie for review, with the §8 post-gate observation duty
attaching to the close (§3).

---

## 3. GR-2C in the gate's failure law as a whole

GR-2C governs only the holds-on phase. The rest of the failure law
stands exactly as ruled, and this amendment states the joins
expressly so no reading can blur them:

- **Pre-lift failures (GR-0, GR-1, GR-2, GR-2C)** end the attempt
  with **both holds standing**; there is nothing to re-hold, and
  no re-hold act may be improvised. The closing capture is taken,
  the raw evidence preserved, and the gate returns for review.
- **Post-lift failures (GR-5 onward)** run the **already-ruled
  re-pause / re-halt sequence** (package §2.3.3, in its exact
  order: re-pause and read back; re-halt and read back; closing
  capture; ends HELD; three-line exposure report), and the
  sequence is **verified** by its read-backs — an unverified
  re-hold escalates at once, it is never retried silently
  (correction 2's checkpoint discipline, applied by analogy).
  Abort conditions **A-1…A-7** (confirmation §6.2) are unchanged;
  A-7's post-lift R-06 rule and its completed-with-discrepancy
  carve-out apply from the lifts onward exactly as corrected.
  GR-2C neither extends nor dilutes A-7: the checkpoint's
  two-complete-poll discipline is a **pre-lift** gate on the lift
  decision, and A-7's two-poll observation definition remains the
  **post-lift** discrepancy rule.
- **The timing controls** (confirmation §6.1) are unchanged: the
  sliding ≥35-minute stall test and the adopted three-hour
  checkpoint from T0 govern GR-5; the 15-minute bound governs
  GR-2/GR-2C. No control substitutes for another.
- **Every close retains the post-gate observation duty** (the
  ruling's failure law, final clause): success, abort,
  checkpoint-escalation, wake failure, and GR-2C failure closes
  alike open the §8-of-the-confirmation duty at close (§5 below
  answers its feasibility condition).

---

## 4. Annex V-3 — the offline harness battery (mandatory; Q-1, Q-4, Q-6)

### 4.1 Role

V-3 is the offline Durable Object harness complement the ruling
selects alongside V-1 (Q-1): it tests the **transition
mechanics** of the cold restart — the source-behavior halves of
CR-2, CR-3, and CR-4 (assessment §5.3) — against the deployed
composed source, seeded to the adopted GR-B state: grants
`seg:1`–`seg:86` voided plus `seg:87` issued with a past
`lease_expires_at` and an unsent outbox row; occurrence `granted`;
job `generating` rev 88; the pending `lease` and `watchdog`
schedule rows, both past due; the containment row NORMAL in its
post-restoration form; `seg:87`'s 12 quota reservations open;
GENERATION_HALT `"1"` in env. Per Q-4, the battery must test
**this exact transition** — `seg:87` voided, `seg:88:full`
sequentially issued, with its reservation effects — and
`seg:87` must not be reissued in any assertion.

### 4.2 Limits (stated at the ruling's strength; not to be smoothed)

- **Harness PASS does not prove platform alarm delivery** (Q-6).
  The harness invokes `alarm()` directly; CR-1's delivery half —
  the sub-question with the live W-4 counterexample — is exactly
  the part it cannot touch. **OQ-2 does not discharge on harness
  results** (Q-2: no success presumed from harness results); the
  discharge vehicle is GR-2C's observation, §2.
- The standing harness limitation carries: harness-green is no
  evidence for platform behavior on empty-result paths (the DO
  `.one()` divergence — the harness fake returns null where real
  DO SQLite throws — is the program's standing example). The
  annex's assertions are transition-mechanics evidence at harness
  strength, and are reported as such.
- **A failed or ambiguous assertion blocks the gate until
  separately reviewed** (Q-6). The block is not curable by the
  executor's own tracing, by re-running until green, or by
  narrowing an assertion after the fact; any assertion change
  after a run is itself filed and ruled on.

### 4.3 Required contents — and the completion slot

Per Q-6, the annex must file: the battery's **assertions** (each
named, with its expected transition), its **results**, its
**exit codes**, its **source/build identity** (the composed tree
under test — the Grant 1 build tree at
`containment-v4/composed-tree/`, build
`fdb02395b3775dc945baa395591a73060ab146c4` — and the harness
identity), and **any limitations** beyond §4.2 that the run itself
surfaces. The assertions the battery must report on include, at
minimum, the assessment §5.3 set: `seg:87` voided with a
`lease_expired_undelivered` transition record; `seg:88:full`
issued as the sole live grant; the occurrence standing `granted`
through the void→pending→granted path; derived reserved exactly
12 after the transition (released exactly once, re-derived to the
successor, no double-count, no leak); job revision advanced
monotonically from 88; dispatched 0 under the seeded holds.

### 4.4 V-3 results — as run

_Inserted at filing from `v3-harness/RESULTS.md`, verbatim in
substance: assertions, per-test results, exit codes,
source/build identity, and the limitations the run itself
surfaces._

**Battery verdict: V-3 PASS — 5/5 tests, exit code 0**, on one
complete run of the final test file, `v3-cold-restart.test.mjs`
(SHA-256
`51283341a757ed0bc63a79deae0c3352c774d594f8772aa4d17ba88a57245291`;
full log `v3-final-run.log`). That was **run 2 (final)**.
**Run 1** (initial test file; log `v3-run-1.log`) returned
**2/5, exit 1** — T2 and T3 passed; T1/T4/T5 failed on
**test-side assertion plumbing**, disclosed here rather than
discarded: (i) occurrence transitions are keyed by aggregate
id `<jobId>/<occurrenceId>`, not the bare occurrence id —
T1's event filter matched nothing; (ii) the issuance job
transition is identified by its detail's grant id (its logged
cause is `requestGrant`), not by cause `grant`; (iii)
`requestGrant` lives on the coordinator (the service's own
path), not on the entry class instance. The fixes changed
only the test file's observation code; no assertion was
loosened, and **no source file was touched at any point**.
The complete final run — fresh process, full churn from
seg:1 — is run 2, whose log is the battery's evidence. Per
Q-6, this PASS proves transition mechanics in the harness
only; it does not prove platform alarm delivery, and it does
not discharge OQ-2 (§4.2).

**T1 — the cold transition (the ruling's observations
(a)–(e) and the §4.3 assertion set).** The fixture stood at
the adopted GR-B predicates — job revision 88, `seg:87:full`
`issued`, occurrence `granted`, reservation 12 open against
seg:87, dispatched 0 — reached by 87 cycles of warm churn on
the tree's own machinery; the alarm registration was then
deleted (mirroring C3's verified `deleteAlarm`) and the clock
advanced 26 hours with no pass running, seg:87's lease going
stale unobserved. The single cold pass then showed:

- **(a) Recorder:** exactly one new `d6_drive_passes` row
  (row id **88** in the run), `stage = "complete"`,
  `drive_invoked = 1` — evidenced separately from the grant
  state, per the ruling's protocol correction (the recorder
  row and the successor-grant observations are separately
  evidenced; a completed drive pass is not equated with proof
  that the successor has issued).
- **(b) Safe void:** `seg:87` transitioned to `voided` via
  exactly one `dispatch_voided` grant transition whose detail
  names `voidReason = "lease_expired_undelivered"` (the M-4
  never-invoked branch — its outbox row had `sent_at` and
  `send_attempted_at` null). `seg:87` exists exactly once in
  the grants table and is never reissued (also T4).
- **(c) Successor identity:** exactly one live grant after
  settling, id **`seg:88:full`**, state `issued`, first
  observed at **cold pass 1** — the same pass's drive sweep
  re-granted after the base alarm's void (the M-6/M-8
  same-pass shape; the retry-pass shape was not needed, and
  T1's transient-state branch was therefore not taken — no
  pass-boundary snapshot in this run shows the void→reissue
  intermediate).
- **(d) No coexistence:** across all 94 snapshots in the
  series, live-grant count never exceeds 1.
- **(e) Reservation continuity:** seg:87's reservation (12
  slots, `qres:` row) is `closed` with `close_reason =
  "grant_voided"`; a second `closeReservationsForVoidedGrant`
  sweep closes nothing (exactly-once, asserted directly);
  exactly one `rel:op:<seg:87>:<occ>` attempt-ledger release
  row exists; seg:88's fresh reservation stands `open` at 12;
  derived open reserved = **12** at settle; never 24 anywhere
  in the series; two consecutive accounting polls (reads
  only) agree field-for-field on the settled state (Q-3's
  two-complete-poll rule, in harness form).
- **(f) Occurrence path:** transitions in the cold window
  show `granted` —(cause `dispatch_voided`)→ `pending`
  —(cause `grant`)→ `granted`, in that order; the occurrence
  ends `granted`. (`outcome_unknown` never appears.)
- **(g) Zero dispatch/spend:** `d6_provider_dispatches` is
  empty; the queue binding received nothing; seg:87's outbox
  row was deleted by the void; seg:88's outbox row stands
  with `sent_at = null` and `send_attempted_at = null` —
  born never-invoked, because under HALT `"1"` the entry
  wires no `sendGrant` (M-9, structural).
- **(h) Revision — 89, explained:** job revision moved
  **88 → 89**, and the delta equals exactly **one** job
  transition in the cold window carrying the successor's
  grant id (the issuance event; logged cause `requestGrant`).
  Not 90: in this build's event sequence the void applies
  **no** job event (its re-advance is a schedule row, not a
  job transition) and the drive sweep's issuance applies
  exactly one — so 89 is the explained value, inside Rowan's
  permitted 89-or-90 band, with the explaining sequence
  recorded in the run log's transition-level assertions.

**T2 — idle second pass.** A pass one minute later (inside
seg:88's lease): grant set and states byte-identical, seg:88
still the live grant, reservation 12, occurrence `granted`,
job revision unchanged, dispatched 0, seg:88's outbox still
unattempted. The chain idles rather than churning early.

**T3 — stale successor.** Past seg:88's lease: seg:88
safe-voids (`grant_voided` closure), **`seg:89:full`** issues
as the sole live grant with a fresh open 12, occurrence
`granted`, dispatched 0, seg:87 still `voided`. The warm
pattern reproduces from the cold start — the cold restart is
not a one-off recovery shape.

**T4 — revision-derived identity.** The grants table holds
suffixes **1..89, each exactly once**. A fresh
`requestGrant` against the fully-granted job is refused
(`ok: false` — nothing pending) and creates no row; `seg:87`
still exists exactly once, `voided`; the job revision (90
after T3) has moved permanently past 87, so the
revision-derived id `seg:87` is unreachable — reissuance is
structurally impossible, not merely unobserved (M-1).

**T5 — the observable series.** 94 snapshots spanning churn,
cold fixture, cold pass, polls, T2 and T3: **live grants
≤ 1 at every snapshot; open reserved ∈ {12} at every settled
snapshot (the value 24 never occurs; the permissible
transient 0 was not observed at any pass boundary in this
run, because void and reissue completed inside single
passes); dispatched = 0 at every snapshot.**
Machine-readable evidence printed by the run: `V3-EVIDENCE
{"recorderRowId":88,"successorFirstSeenPass":1,"revBefore":88,"revAfter":89,"jobGrantEvents":1}`
plus the full `V3-SERIES` snapshot array — both in
`v3-final-run.log`.

**Baseline suites on the same composed tree** (run first,
against the identical composed tree, to establish that the
tree under test is the known-good baseline):

| Suite | Result | Exit |
|---|---|---|
| Containment V4 (42 tests) | **42/42 PASS** | 0 |
| P2 (32 tests) | 31/32 | 1 |
| R5A (23 tests) | 21/23 | 1 |

**Finding (identity fixtures, reported — not repaired):**
every P2/R5A failure is a **T0 identity assertion on one
file**: `v2/coordinator.mjs`. Both suites' "composed"
identity fixtures pin the coordinator at SHA-256
`c097061a…`, an **earlier composition**
(pre-containment-V4-corrections). The current composed
coordinator is `5303cb63…`, which is exactly what
containment-v4's own identity fixture pins (and the
containment battery's identity tests pass against it).
**All behavioral tests pass**: P2 31/31 behavioral, R5A
21/21 behavioral. The mismatch is fixture staleness in the
two older suites, not a behavioral or identity defect in the
tree under test — but it is recorded here at full strength
because Q-6 makes failed or ambiguous assertions
gate-blocking until separately reviewed: the P2/R5A T0
identity assertions, as fixtured, cannot pass against the
current composed tree, while every behavioral assertion in
all three suites passes and the containment suite's identity
assertions pass exactly. **Per Q-6, this failed/ambiguous
assertion finding is presented for Rowan's separate review
as part of this filing; this amendment does not characterize
it as discharged.**

**Source/build identity.** Tree under test:
`containment-v4/composed-tree/` — the deployed composed
tree, build `fdb02395b3775dc945baa395591a73060ab146c4` (the
Grant 1 build: R5a + containment v4 composition), 31 files;
full per-file SHA-256 manifest: `tree-manifest.sha256` (31
entries, captured at run time from the tree as tested).
Modules exercised, SHA-256: `v2/coordinator.mjs` —
`5303cb6323da01c21a5ebe9a7983f87abe08e14945660daaebce99734849e1ed`;
`v2/worker-entry-prod-d6.js` —
`2bb0608b589a084ca275428c3236c24680f4a4692afe2245dfcb2880257983c1`;
`v2/generation/service.mjs` —
`5c5183e664218b9746c497e9456af45c7467a8ace66fd1b9ef0928eccb3c7c14`;
`v2/generation/genstore.mjs` —
`811b6b15b790097ad0010be3c71881c5024331143b4b0e2031392287bb839c2a`;
`v2/generation/quota-budget.mjs` —
`2b39924579e5af2d5d20eea01122d2323ccedac9fe9ff9f7026c49af14770820`;
`v2/generation/gen-constants.mjs` —
`9af664fafc61dff1c16de8f94d06c0097271313bae7327d2a9a9d16efe14c77d`.
The composed coordinator's hash matches containment-v4's own
`fixtures/identity-composed.json` exactly. **No source file
was edited**; the only code written is the test file in the
`v3-harness/` directory.

**Harness identity and limitations (from RESULTS.md).**
Harness: `containment-v4/tests/harness.mjs`, SHA-256
`8eb4c0d6393602440cdb3e466fa4f832bbfa11734d99052573688cd0209f71b4`
— the program's existing DO harness (the P2/containment/R5a
batteries' harness): real SQLite via `node:sqlite`, a fake
clock, `crash()` = new instance over the same storage.
**`.one()` semantics:** THIS harness's `SqlCursor.one()`
**THROWS** on 0 or >1 rows — production DO semantics,
deliberately mirrored; the standing caution about a
null-returning fake applies to the older `do-harness.mjs`
lineage, **not** to this harness. In addition, no V-3
assertion depends on an empty-result `.one()` path at all:
the `.one()` calls on the exercised paths are aggregate
`COUNT(*)`/`COALESCE(SUM(...))` queries, which return
exactly one row by construction. Limitations: **alarm
delivery is not tested — at all.** The harness invokes
`alarm()` directly; nothing here bears on whether the
platform delivers a fresh registration on the production DO
after the verified stop and restoration (CR-1's delivery
half; the W-4, whose root cause remains UNCONFIRMED). Only
the GR-2C in-gate production observation can discharge that.
Concurrency is asserted at harness-observable snapshots
only: snapshots are taken at pass boundaries, and a pass's
internal steps run inside transactions in a single-threaded
harness invocation, so "never two live grants" and "never
24" are verified at every observable state, while their
within-pass atomicity rests on the transaction structure,
not on a directly observed interleaving; the racing-wake
recheck remains platform-unverified. **One cold shape is
exercised:** registration deleted + 26 h dormancy +
never-invoked standing grant — the actual adopted GR-B
posture. Attempted-but-unacknowledged (`handoff_uncertain`)
and delivered-lease shapes are different branches that
production's state excludes and this battery does not claim
to cover.

---

## 5. OQ-5 — the observation duty's feasibility (final readiness ruling, item 4)

Rowan's condition: the duty's setup "must be operationally
feasible, documented and verified without exceeding the gate's
counted-production-mutation ceiling or silently creating another
production action. If it cannot be established as specified,
return for review rather than claiming the condition discharged."
The duty itself stands as specified at confirmation §8 (name
`phaseb-resume-postgate-watch`; owner Wren; start at gate close on
every path; daily at approximately 18:28 ET; the closing-census
subset read set; POST-GATE-QUIET / POST-GATE-MOVEMENT; immediate
escalation on MOVEMENT, never an act; termination at the earlier
of Rowan's acceptance of the execution record or 14 days after
close, the job disabled with history preserved and the
termination reported). Feasibility, point by point:

- **The job is Wren-side, not production.** `phaseb-resume-postgate-watch`
  is a scheduled job in Wren's own scheduler (the same mechanism
  that ran the retired `phaseb-s1-tail-watch` on this exact
  pattern — daily, read-only, classified, disabled at termination
  with its history preserved). Creating it writes only to Wren's
  scheduler state and its local log (`phaseb-resume-postgate-log`
  under the goal's hidden files, on the tail-watch precedent). It
  sends **no** production command, performs **no** containment,
  queue, settings, or plan act, and touches no production surface
  except by reading.
- **It consumes none of the counted ceiling.** The gate's counted
  ledger (confirmation §7.1) counts production **commands** —
  the probe, the lifts, the re-holds — ≤ 5 on every path. The
  watch's creation is not a production command, and its checks
  are GET reads: the same read-only substrate as every census in
  this program, which has never been a counted act. The duty
  therefore neither exceeds the ceiling nor creates a production
  action, silently or otherwise.
- **Setup, at gate close** (the duty is created as part of the
  gate's closing acts, per confirmation §8 — it does not exist
  before the gate closes and is not created by this filing): the
  executor creates the job with its read set, cadence,
  classifications, escalation route, and termination rule as its
  standing instructions, and records the creation in the
  execution record.
- **Verification of the setup, threefold:** (i) the job's saved
  definition is read back from the scheduler and quoted in the
  execution record (name, cadence, read-only instruction set);
  (ii) at creation the executor runs the check's read set once by
  hand — a dry read, logged as the duty's check #0 with its
  classification against the closing values; (iii) the first
  **scheduled** run's log entry is confirmed at the next daily
  check-in and its presence (or absence) reported — an absent
  first run is a setup failure, not a quiet day.
- **If it cannot be established as specified** — the scheduler
  refuses the job, the read-back differs from the specified
  definition, or the dry read cannot complete — the execution
  record states the failure plainly, the condition is **not**
  claimed discharged, and the gate returns for review on that
  point. No substitute mechanism (ad-hoc manual checks, a
  differently-scoped job) may be stood up under the duty's name
  without a ruling.

---

## 6. The revised adopted-GR-B GO proposal — for Rowan's final review (Q-7)

This wording **supersedes the confirmation §9 wording in full**
(that wording stood NOT APPROVED — final readiness ruling item 5 —
as GR-A-only against a known GR-B baseline). It is returned here
for **Rowan's final review only**. Under Q-7 it may be presented
to Julie **only after Rowan accepts this revised proposal**, and
— Q-6's block — only with the §4 annex standing completed at
PASS. On acceptance and presentation, the GO is recorded on the
board before the execution census (the established ordering).

> "GO — execute exactly one generation-resume attempt under
> branch GR-B as pinned at `<AMEND-PIN>`: fresh execution census
> on both phase surfaces, with the script etag captured and saved
> as an evidence artifact before any wake decision, verifying the
> adopted GR-B predicates exactly — the preserved plan active,
> totals {eligible 1, done 0, failed 0, blocked 0}, its sole entry
> granted; the Phase B job generating at revision 88 with 87
> grants, `seg:1`–`seg:86` voided and
> `grant:plan:19cad189fab54b9c804a74a6:seg:87:full` issued and
> live; the occurrence granted;
> derived reserved 12; dispatched 0; the phase figures at their
> frozen values; containment NORMAL; the alarm registration
> absent (`armedAt` null — any non-null value stops the attempt
> before any act) — and any other census state stops the attempt
> and returns for ruling; branch GR-A is foreclosed and must not
> be manufactured; a fresh read-only voice checkpoint (Alex →
> Gemini Charon, quote digest `cdef2c7e…`); exactly one wake — a
> single fresh `RequestPause` probe against
> `alarm-wake-probe:nonexistent`, counted as one production
> command, verified only by an observed recorder-row effect
> within the ruled 15-minute bound — never a second wake, never a
> deploy-as-stimulus; then **checkpoint GR-2C, with both holds
> still standing**: the first cold pass's recorder row and the
> settled successor grant evidenced **separately**, intermediate
> polls preserved, the void of `seg:87:full` and the sequential
> issuance of `seg:88:full` each identified, derived reserved
> exactly 12 (a transient 0 only in polls between those two
> identified transitions), dispatched and provider attempts 0
> throughout, and **two consecutive complete polls** confirming
> the settled state — the full checkpoint inside the same
> 15-minute bound, with **no extension**; on GR-2C's success
> OQ-2 stands discharged **for this attempt only**; on any
> checkpoint failure the attempt ends there, both holds standing,
> and returns for review; then one halt lift and one queue
> unpause, **in that order**; the post-unpause protocol with its
> sliding 35-minute stall window, the adopted three-hour review
> checkpoint from dispatch, and abort condition A-7 (a post-lift
> recorder discrepancy re-holds and returns for review; a
> completed segment stands as completed-with-discrepancy);
> **NO SubmitJob of any scope — ever — NO exemption call, NO
> containment transition, NO Batch, NO rest-of-book, NO other
> generation**; counted production commands ≤ 5 on every path;
> the segment's expected cost ≈ $0.008, the 12,808-unit forecast
> line and the 25,000-unit detection threshold standing as
> deviation signals, never caps, the 12-slot reservation bounding
> attempts and the Gemini prepay balance as the physical
> backstop; on success, abort, checkpoint, GR-2C failure, or wake
> failure alike, the attempt ends **HELD** — re-pause and re-halt
> wherever the holds were lifted, each verified by read-back —
> with exposure reported in the three-line form, and the named
> post-gate observation duty (`phaseb-resume-postgate-watch`)
> opened at close on every path. I understand that success ends
> with exactly one new binding and the bindings watermark at
> 1842; that my playback check — the chapter header reading
> 'Complete 27/27' — is the acceptance, outside the executor's
> verdict; that one GO covers one attempt, and a stall, an abort,
> a checkpoint, or a checkpoint failure consumes it; and that
> restoration was authorized, executed, and closed separately,
> before this GO."

The end-state alternative in the package §6 form (holds left
lifted on success) is **not** carried into this wording: silence
means HELD, and any lifted end state would need Julie's express
words in place of the ends-HELD clause.

---

## 7. The remaining chain, updated

1. **This amendment, with the §4 V-3 annex completed from
   `v3-harness/RESULTS.md`, is filed for Rowan's final review**
   (Q-7). If the annex cannot complete at PASS, the filing does
   not advance (§4.3) and the block returns for separate review
   (Q-6).
2. **Rowan's final review and acceptance** of this amendment —
   GR-2C as incorporated, the annex at its stated strength, the
   §5 feasibility answer, and the §6 GO proposal. Her acceptance
   is the last documentary act before Julie's turn; it is not a
   GO and authorizes no execution.
3. **Presentation to Julie** of the accepted §6 wording — only
   then, and only in the accepted form.
4. **Julie's separate GO**, recorded on the board before the
   execution census (the established ordering).
5. **Execution** under the confirmation as amended — one attempt,
   consumed by its outcome on every path; GR-2C inside it as
   §2 specifies; OQ-2 discharging for the attempt on GR-2C's
   success and on nothing else.
6. **The execution record**, filed for Rowan's documentary
   review; the §8-of-the-confirmation observation duty runs from
   close until her acceptance or 14 days, whichever first.
7. **Julie's playback acceptance** — the chapter end, expected
   header "Complete 27/27" — outside every executor verdict.

---

## 8. What this amendment does not do

It does not authorize any wake, probe, hold lift, dispatch, or
generation; it does not execute, present, or request the GO; it
does not discharge OQ-2 (the question stands OPEN PENDING
OBSERVATION, and discharges, if at all, inside the gate on
GR-2C's observations); it does not resolve the W-4 (an unresolved
observation; the 296 warm passes do not resolve its root cause,
and no claim of general cold-restart reliability is made — the
ruling's own closing caution, carried); it does not select V-2
(Q-5 stands NOT APPLICABLE — no standing-registration disposition
or separate re-stop is authorized or proposed); and it does not
touch the preserved plan, the idx-26 exemption, the parked
Chapter 3 job, or any production state. Production remains HELD
at NORMAL.

**Turn: Rowan's** — final review of this amendment and its V-3
annex.
