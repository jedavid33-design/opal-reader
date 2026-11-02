# Phase B — REVISED R5a-D/S1 sequencing and readiness proposal (Option (ii))

**Status: READINESS PAPERWORK ONLY. Nothing in this
proposal is executed by it, and no GO is requested by
it.** Rowan's review of this proposal is not a GO; a
production GO remains a separate future step (Julie's
explicit authorization, in the §6 form, after Rowan's
review and her rulings on §7's items). Production is
under INVESTIGATION HOLD and ends HELD. This proposal
authorizes nothing.

**Assignment:** Rowan's ruling on the R5a-D readiness
package (Nov 2, 2026; recorded at
`ROWAN-R5AD-READINESS-RULING.md`): verdict REVISE —
**Ruling Item 1 = Option (ii)**: the first-wake
consequence belongs to the S1 stimulus scope; R5a-D
may not execute as an isolated code-only deployment;
options (i) and (iii) declined ((iii) as a sole
mitigation: app-use restrictions cannot reliably
prevent delayed or queued synchronization). The
readiness package's candidate definition, live-build
comparison, battery evidence, fresh census structure,
mutation limits, rollback classification, STOP
conditions, and runtime-adoption caveat are ACCEPTED
as the basis for this revision and carry forward
unchanged (§5). Corrections **R5AD-1..R5AD-4** are
answered in §§2, 3, 4, 6 respectively. The revised
plan is not to be executed under that ruling; this
proposal does not execute it.

**Gate structure (as sequenced by Rowan's rulings):**
C1 (CLOSED) → C2 (CLOSED, readability verified) →
**R5a-D + S1 (this proposal: one deployment, one
observation window, one owned first-wake event)** →
C3 (readiness held; census re-based after R5a-D
closes AND the S1 event is dispositioned, §4.3) →
standalone restoration (separate, unchanged) →
R3-V micro-scope (unchanged).

---

## Corrections banner — where R5AD-1..R5AD-4 are answered

| Correction | Requirement | Answered in |
|---|---|---|
| **R5AD-1** | Resolve S1 readiness and R5a-D sequencing without violating the requirement that R5a-D close before C3 | **§2** — the five-stage sequence: arrangements authorized first (paperwork + one combined authorization), R5a-D executes and closes on its own documentary terms, the S1 window spans the first-wake event, C3 follows only after both closure and disposition |
| **R5AD-2** | Define first-wake detection, observation, classification, and authorized response | **§3** — detection surfaces (§3.1), observation mechanics and cadence (§3.2), classification taxonomy W-0..W-4 (§3.3), authorized response per class (§3.4) |
| **R5AD-3** | Reconcile R5a-D, S1, C3, and separately authorized stop/restoration boundaries | **§4** — boundary map (§4.1), state sequence (§4.2), C3 dependency and census-form changes (§4.3), S1-X / restoration / R3-V boundaries (§4.4) |
| **R5AD-4** | Replace the readiness package's §11 GO wording with an authorization proposal consistent with Option (ii) | **§6** — one Julie decision in four separately named parts (A: R5a-D; B: window arrangements incl. B2 Layer-1; C: S1-X standing chain stop, re-bound; D: conditional deliberate stimulus), with the dependency rule, the NOT-authorized list, and draft GO texts |

**Deviations from the previous package and from the
gates-v4 text — identified explicitly (Rowan's
instruction).** Nothing else in the accepted package
changes (§5).

- **DV-1 — §11 GO wording replaced in full.** The
  Option-(i) acceptance paragraph ("I accept that
  consequence as part of this GO") is **removed**.
  Under Option (ii) the consequence is not accepted
  bare; it is governed by the window arrangements,
  the response authorizations, and the disposition
  rules of this proposal (§6).
- **DV-2 — The gates-v4 S1 hard dependency is
  superseded in order.** Gates v4 placed S1 strictly
  after C3 + remainder ruling + standalone
  restoration. That order cannot survive Option (ii):
  the first-wake event is triggered by the deployment
  plus ordinary traffic, not by the calendar, so an
  S1 that waits behind C3 leaves the event unowned
  for exactly the interval Rowan declined. The S1
  *event* therefore moves to immediately after R5a-D,
  inside a pre-authorized window. The deliberate
  probe's identity (one `RequestPause`, fresh
  `command_id`, reserved nonexistent target, mandated
  negative wording) is preserved — under the
  recommended variant it becomes the window's
  conditional fallback (§2, Stage 3b) instead of the
  primary stimulus. **This supersession is Ruling
  Item C (§7): it is proposed, not assumed.**
- **DV-3 — S1-X is re-bound.** The gates-v4 S1-X
  binding attached to the gates package pin and to a
  window opening at a stimulus dispatch. Under this
  sequence there may be no dispatch; the standing
  authorization in §6 part (C) is a **fresh binding**
  to THIS proposal's pin and to the window defined in
  §2 (opening at the R5a-D upload read-back). The
  gates-v4 authorization text arms nothing under this
  sequence. **Ruling Item B (§7).**
- **DV-4 — Wake-signature findings inside R5a-D's own
  verification change disposition.** The readiness
  package's triggers T5/T6 (wake signature) were, in
  every branch, a class-B STOP + escalate with the
  gate's outcome left for Rowan to classify. Under
  this sequence the window is already armed when the
  upload lands (it opens at the read-back), so a
  T5/T6 signature observed at a §7 verification read
  is an **early S1 event**: R5a-D still STOPs its
  remaining steps and ends HELD (unchanged), but
  classification proceeds under the S1 arrangements
  (§3.3) instead of as an orphan escalation, and
  S1-X is armed against it. Class-B rollback
  discipline is unchanged: no rollback in any branch.
- **DV-5 — Scheduled observation reads are a new
  named activity.** No prior gate ran a multi-day
  window. The §3.2 read-only check-ins are inside
  authorization part (B) (§6), are GET-only, and are
  the window's detection mechanism (the readiness
  package §1.4 step 5 recorded that nothing otherwise
  reads on a schedule).
- **DV-6 — C3's census changes form in two items**
  (armedAt expectation; recorder/§7.3-marker
  baselines), derived in §4.3. C3's ledger, budget,
  and PARTIAL character do not change.

---

## 1. The problem, restated at ruling strength

The readiness package established (accepted as the
basis for revision): deployment itself performs no
alarm action; the deployed R5a semantic changes what
the **next wake** does; a wake is **expected** in
ordinary operations while HELD — `POST
/v2/sync/position` constructs a fresh
`PushPositionEvents` command per push and reaches
`wake()` (package §1.2–§1.3); on the first wake the
past-due disjunct fires (the live registration
`armedAt` **1793562576104** = 2026-11-01T19:49:36.104Z
is ~26× beyond the provisional 3,600,000 ms threshold,
so the threshold affords no protection in this
incident) → exactly one `setAlarm(D)` (memo-bounded);
D unobservable until that moment (B1 leading, **not
proven**; B2/B3 open); under B1/B2 the past-due
registration delivers promptly → a drive pass under
the holds → exactly the pre-classified §7.3 set
(grant `grant:plan:19cad189fab54b9c804a74a6:seg:1:full`
issued; occurrence `pending` → `granted`; job
`queued` rev 1 → `generating` rev 2; derived reserved
0 → 12; **dispatched 0, attempts 0, $0, all five
phase figures frozen**) — and the watchdog re-arms,
so the chain **revives** into the bounded grant/void
churn indefinitely (≤1 live grant; reserved ∈ {0, 12})
until a stop act or another authorized disposition.
Under B3, registration re-bases to a future D and the
chain revives when D arrives.

Rowan's Option (ii) ruling assigns ownership of that
event to **S1's scope**: it may occur only with S1's
observation and response arrangements in place. The
design problem this proposal solves is that S1, as
previously scoped, was a *deliberate* stimulus (one
sent command inside a short window), while under
Option (ii) the stimulus may arrive as *unplanned
ordinary traffic* at an uncontrolled time. §§2–4
reconcile the two without violating either of
Rowan's fixed points: **R5a-D closes before C3**, and
**no wake consequence is ever unowned**.

One further fact shapes the sequence and is stated
here so the stages below need no re-derivation: the
first-wake consequence is a **one-incident
phenomenon**. It exists because a specific stale
registration (1793562576104) is sitting in the store
when the semantic deploys. Once that registration is
deleted (C3's stop act) or consumed by delivery, no
stale value remains for the disjunct to act on; the
post-restoration clear does not re-arm, and the first
wake after restoration arms a fresh registration by
the ordinary rules. The disjunct remains a permanent
semantic for any *future* registration that itself
goes stale beyond the threshold (the R-03/R-05
residuals stand), but the governed event of this
program is singular: **this** stale registration,
**this** first wake.

---

## 2. R5AD-1 — The sequence

Five stages. No stage begins until the prior stage's
exit condition is met. Holds are invariant throughout
(GENERATION_HALT `"1"`, queue paused, containment
NORMAL until and unless S1-X fires; §4.2).

### Stage 0 — Paperwork and rulings (now)

This proposal is reviewed by Rowan. The §7 ruling
items (variant choice, S1-X re-binding, gates-v4
dependency supersession, window parameters, Layer-1
inclusion) are ruled on. **No production step of any
kind occurs in Stage 0**, and no GO is requested
until Rowan's rulings are on record.

### Stage 1 — Arrangements authorized (no production step)

Julie grants the combined authorization of §6 —
parts (A) R5a-D execution, (B) window arrangements,
(C) S1-X standing chain stop, and (D) the conditional
deliberate stimulus if Ruling Item A selects Variant
D — as **one decision with separately named parts**.
The dependency rule (§6.1) applies: (A) is
inoperative unless (B) and (C) are granted with it;
striking (B) or (C) does not produce a leaner deploy,
it produces no deploy. Granting the authorization
performs nothing: it arms the arrangements so that
the deployment and the event it makes possible are
never separated by an unowned interval.

### Stage 2 — R5a-D executes and CLOSES (deployment only)

Exactly the accepted readiness package: GO recorded
on the board before census → 16-item fresh census
(package §4) → fresh assembly → battery re-run
(containment 42 + R5a 23 + P2 32 on the
gate-assembled tree) → build pin → **exactly one
upload** → observability check (≤1 conditional
PATCH) → V1–V8 verification → execution record →
Rowan's independent execution review → **CLOSED**.

R5a-D's close is **documentary and independent of
the wake**: it closes when Rowan accepts the
execution record (or rules otherwise on it), whether
or not any wake has occurred by then. Class A /
class B discipline is the package's, unchanged —
with the single DV-4 refinement: a T5/T6 wake
signature found during verification STOPs the gate
(unchanged) and is simultaneously the S1 event
arriving early inside the already-open window (§3);
its classification proceeds under §3.3, and S1-X is
armed against it from the window's opening.

**The S1 window opens at the completion of the
upload's D2 read-back** — the first moment the
deployed tree is verified. The interval between the
upload response and the D2 completion is covered by
the gate's own V-reads, which are scheduled reads for
classification purposes; a wake signature in them is
an early event under DV-4, not a gap.

### Stage 3 — The S1 observation window (72 hours from window open)

The window is the S1 scope under Option (ii): the
first-wake event — natural or, under Variant D,
deliberately completed — occurs, is detected,
classified, and dispositioned inside it, under the
§3 arrangements and the §6 authorizations. S1-X is
armed for the window's whole duration (part (C));
Layer-1 `contain_drive` is available exactly as
part (B2) provides. Observation mechanics, cadence,
and taxonomy are §3.

**Stage 3a — natural event.** The expected path:
ordinary traffic (most plausibly a position push)
wakes the coordinator; §3 detects and classifies;
an EXPECTED event (§3.3, W-2) is recorded and
reported, and observation continues at cadence to
window close (the revived chain is a continuing
state, and later reads continue to classify against
the churn invariants — §3.3).

**Stage 3b — deliberate completion (Variant D;
Ruling Item A).** If **no natural wake has been
observed by the +24-hour scheduled read**, the
executor may — under part (D), and only then — send
the original S1 stimulus: exactly one
`RequestPause` command, fresh `command_id` generated
and recorded **before** sending, targeting the
reserved nonexistent job `alarm-wake-probe:nonexistent`,
after re-verifying at that moment (fresh reads) that
the target does not exist and re-reading the recorder
baseline. Expected response: outcome `rejected`,
reason `job_not_found`. **No re-send under any
circumstance** — a timeout or ambiguous response is
a STOP-and-classify event. The stimulus command's
own wake evaluates the composed condition, so the
wake *evaluation* is guaranteed inside the window;
its outcome is then classified under §3.3 like any
wake (delivery → W-2; future re-base → W-1f;
evaluation without observed delivery → W-4). The
post-stimulus reads follow S1's cadence (≈ +2, +12,
+37 minutes from dispatch) folded into the window
cadence (§3.2). A no-revival outcome is reported
**only** as "**no observed revival within the tested
window, subject to recorder limitations**" — the
mandated wording, unchanged, and never as proof
that B2 is impossible.

**Variant N (the alternative for Ruling Item A):**
no deliberate stimulus exists; the window runs on
natural traffic alone. Its expiry state is analyzed
honestly in §2.1.

**Wren's recommendation: Variant D.** Reasons:
(1) it bounds the unowned tail — the substance of
Rowan's Option (i) objection was the absence of
operational controls around the event, and Variant N
either lapses into the declined state at expiry or
requires serial window renewals with authorization
gaps between them; (2) the deliberate stimulus is
the already-designed, already-bounded S1 probe (one
commands row; wake precedes an apply that refuses
`job_not_found`; its identity and negative wording
are preserved verbatim); (3) it puts C3's start on a
defined schedule instead of an open-ended wait on
Julie's listening habits; (4) by +24 hours the
natural event — expected from ordinary use — has had
a full day to arrive on its own, so the deliberate
completion is a fallback, not a shortcut. The
recommendation is Wren's; the choice is Rowan's
(Ruling Item A), and part (D) of §6 is drafted to be
struck cleanly if she rules N.

### Stage 4 — Window close and S1 disposition

At +72 hours the executor performs the **closing
census** (the §3.1 read set, in full) and files the
**window record**: every scheduled read, every
classification, the event's disposition in exactly
one of the §4.3 forms, the S1-X state (fired /
unfired-expired), the Layer-1 state (applied / not),
and the ends-HELD certification. S1-X **expires at
window close, fired or unfired** — no carry-over.
Rowan reviews the window record. The S1 scope is
then CLOSED (its event dispositioned), and only then
does the program move on.

### Stage 5 — C3 (separate package revision, separate GO)

C3's readiness package is revised to re-base its
census to the composed build and to the window
closing census (§4.3), is reviewed by Rowan, and is
executed only under its own Julie GO — exactly as
Rowan's sequencing ruling already provides
("after R5a-D is separately authorized, executed,
and accepted, rebase C3's build and etag
expectations"), with the addition this proposal
makes explicit: the S1 disposition is a second
precondition (§4.3). C3 is **not** authorized by
anything in this proposal (§6.4).

### 2.1 Window expiry without an event (Variant N), stated plainly

If Variant N is ruled and no natural wake occurs
within 72 hours: the arrangements lapse, S1-X
expires unfired, and the system is left in the state
Rowan declined under Option (i) — composed semantic
deployed, stale registration still in place, a wake
still expected eventually, detection again
incidental (register R-02's bound: the next
successful dual read that actually occurs). This
proposal does not pretend otherwise. The mitigations
available inside Variant N are exactly two, both
named so Rowan rules with them in view: (a) **C3
remains blocked** — no further program step proceeds
into an unowned event (§4.3); (b) **renewal** of the
window (a fresh Julie authorization re-arming the
observation cadence and, under a fresh binding, a
new S1-X) may be sought — each renewal is a new
authorization, never an extension of this one, and
the intervals between windows remain unowned by
construction. Under Variant D this state cannot
arise silently: the +24-hour stimulus guarantees a
wake evaluation inside the window, and every outcome
of that evaluation (W-1f, W-2, W-4) is a disposition,
not an expiry.

---

## 3. R5AD-2 — First-wake detection, observation, classification, response

### 3.1 Detection surfaces (the scheduled read set)

Every scheduled window check performs the same read
set. All are GET surfaces or external read-backs; no
read in the set sends a command, and no GET path
calls `wake()` (package §1.2, source-verified; the
assessment's standing finding). The set is built so
that every element of the §7.3 pre-classified set
and every S1-X trigger has at least one surface that
observes it, and the load-bearing facts have two.

| # | Read | What it detects |
|---|---|---|
| 1 | `GET /v2/d6-diagnostics` with `drive=1` (operator) | **Primary wake surface.** Recorder: `tableState` (missing → present), `drivePasses` rows (stage reached, whether `driveOnce` was invoked, outcomes, recorded error, `armed_after`), `recorderHealth`. Alarm: live `getAlarm()` value (`armedAt`), `pendingSchedule`, `pendingWatchdog` |
| 2 | `GET /v2/d6-containment` (operator) | Containment state projection: state, absence, verified flag, `stopConfidence`, stop-record/episode fields — the second surface for the containment facts, and the surface that reports an S1-X firing's result |
| 3 | `GET /v2/d6-diagnostics?planId=plan:19cad189fab54b9c804a74a6` | The preserved plan: state, totals, the idx-26 entry's disposition and `executionState`, grants projection, and `phaseAccounting` (both-surfaces rule: phase figures are read here AND at #5) |
| 4 | `GET /v2/jobs/plan:19cad189fab54b9c804a74a6:seg` | The preserved job: state, revision, **grants [] → [the one grant]** — the §7.3 issuance marker |
| 5 | `GET /v2/generation/capabilities` | Phase block (second phase surface), standard admitted / Batch `batch_not_armed`, phase registry binding |
| 6 | `GET /v2/d6-quota-reconcile` (operator) | Reconcile `ok`, drift, the sole straddler; derived totals incl. **reserved 0 → 12** and per-PT-day dispatched (must stay 0) |
| 7 | `GET /v2/conflicts` | The four-row `schedule_dead` baseline, exact-match (trigger T4 surface) |
| 8 | `GET /v2/sync/changes?family=bindings&sinceSeq=1841` | 0 changes expected; any binding change is outside the §7.3 set |
| 9 | cf-api queue read-back, `opalreader-generation-v2` | `delivery_paused: true`, exactly 1 consumer — the delivery fence, verified externally (the Worker cannot read it) |
| 10 | `GET /health` | Build stamp unchanged across the window (no redeploy has occurred), generation `halted`, coordinator `armed` |

The **window-open baseline** is the R5a-D closing
census (the gate's §7 closing values), incorporated
by reference as the window record's first entry:
`armedAt` 1793562576104 (or its census-observed
value), recorder missing/empty, preserved plan
`active` {1,0,0,0,0} with entry `pending`, job
`queued` rev 1 with grants [], derived reserved 0,
dispatched 0, phase figures frozen, conflicts
baseline exact, watermarks 18/1841, containment
NORMAL/absent/verified.

### 3.2 Observation mechanics and cadence

**Vehicle:** Wren performs the scheduled checks as
read-only check-ins for the window's duration (the
activity authorized by §6 part (B)). Each check:
performs the §3.1 set, appends the raw values with
timestamps to the **window log** (evidence, filed
with the window record), classifies under §3.3, and
**reports to Julie immediately on any classification
other than W-0** (and on any W-1 → W-2/W-3/W-4
transition). W-0 checks are silent — logged, not
reported — so the window does not become noise.
Wren's checks are the *only* scheduled reads; they
send nothing, and by §3.1's source basis they cannot
wake the coordinator.

**Cadence** (times from window open; Ruling Item D —
Wren's proposal, Rowan's to amend):

| Interval | Cadence | Notes |
|---|---|---|
| Open → +2 h | The gate's own V-sets (≈ +10, ≈ +25 min), then window reads at +1 h, +2 h | The gate's verification doubles as the window's first coverage (DV-4) |
| +2 h → +12 h | Hourly | |
| +12 h → +72 h | Every 6 h | |
| On W-1 (wake observed, pass pending) | Every 10 min until a pass is observed, the value resolves as future (→ W-1f track), or 2 h elapse without a pass (→ W-4) | Aligns checks with the ~10-minute watchdog cadence so a revived chain's early passes are each observable |
| On Variant-D stimulus dispatch | ≈ +2, +12, +37 min from dispatch (S1's own cadence), then rejoin the window cadence | |
| +72 h | **Closing census** (full §3.1 set) and window record (§2, Stage 4) | |

**Why these numbers:** the event is expected from
ordinary use, which clusters in Julie's waking
hours; hourly coverage for the first half-day makes
a same-day event's detection lag ≤ ~1 h, and the
10-minute tightening on W-1 bounds the
wake-to-pass observation gap to roughly one watchdog
period. The 72-hour length gives three full days of
ordinary use for the natural event, and the +24-hour
stimulus point (Variant D) sits one full day in —
late enough that the natural event has had its
chance, early enough that two full days of window
remain to observe whatever the stimulus sets in
motion. All three numbers are proposals, named as
Ruling Item D.

### 3.3 Classification taxonomy

Every scheduled read is classified into exactly one
class. Classification uses the same standard as the
evidence rule in §3.4: paired surfaces must agree; a
value that cannot be freshly read is not evidence.

- **W-0 — NO EVENT.** Every read at its window-open
  baseline value: `armedAt` bit-identical, recorder
  still missing/empty (or present only with rows
  already classified), grants [], occurrence
  `pending`, job `queued` rev 1, reserved 0.
  *Continue cadence.*
- **W-1 — WAKE OBSERVED, PASS PENDING.** `armedAt`
  has changed from the baseline to a new value V
  (the wake's `setAlarm(D)` made D observable: V IS
  D), and no drive pass has yet been observed (no
  new recorder row, no §7.3 marker). Two tracks:
  **W-1p** — V is past-due or near: delivery is
  expected promptly (B1/B2); the tightened cadence
  applies. **W-1f** — V is in the future (B3): the
  registration has re-based; the chain revives when
  V arrives. W-1f is recorded with V's value; the
  window does **not** treat it as a completed event
  (see §3.5).
- **W-2 — EXPECTED S1 EVENT.** A drive pass has been
  observed (a new recorder row whose stage shows the
  pass ran) **and** every state marker sits exactly
  inside the §7.3 pre-classified set: grants = [the
  one grant `grant:plan:19cad189fab54b9c804a74a6:seg:1:full`]
  (or its lease-expired void state, within the churn
  invariants), occurrence `granted` (or its
  then-current §7.3-consistent value), job
  `generating` rev ≥ 2, reserved ∈ {0, 12},
  dispatched 0 on every PT day, attempts 0, all five
  phase figures frozen **on both surfaces**, conflicts
  baseline exact, watermarks frozen, parked job
  exact, containment NORMAL, and no recorder row
  carrying an unexplained error. After the first
  W-2, subsequent reads classify against the **churn
  baseline** (the §7.3 invariants), not the pre-wake
  census: movement inside the invariants is W-2
  continuing; movement outside them is W-3.
- **W-3 — ANOMALOUS.** Anything outside the above:
  any S1-X trigger candidate (T1–T4, §3.4); a
  recorder row with a non-null recorded error or a
  stage showing the pass died before `driveOnce`
  (an error-stage row is a finding requiring
  classification, never absorbed into W-2 on the
  strength of matching state alone); dispatched > 0;
  any phase or quota movement beyond the §7.3
  predictions; a second grant or any grant other
  than the one; conflicts/watermark/parked movement;
  containment state ≠ NORMAL for any reason other
  than an authorized part-(B2)/(C) act; paired
  surfaces disagreeing; a §3.1 value that errors or
  cannot be read. *Response per §3.4.*
- **W-4 — WAKE OBSERVED, DELIVERY NOT OBSERVED.**
  A W-1p registration (past-due V) stands for 2
  hours of tightened observation with no pass
  observed: the original stall's signature recurring
  on a fresh registration. Not an S1-X trigger (no
  T1–T4 element is present: no grant activity, no
  dispatch, no phase movement) — *report and escalate
  (§3.4); the disposition is Rowan's.* The window
  continues at the hourly cadence after the W-4
  report unless Rowan rules otherwise.

### 3.4 Authorized response per class

| Class | Authorized response (complete) |
|---|---|
| W-0 | Log; continue cadence. Nothing else. |
| W-1 (p/f) | Log with V's value; tighten cadence (W-1p); report to Julie at the next scheduled report point — **immediately** if V's arrival was via the Variant-D stimulus reads. No intervention of any kind: a pending registration is not acted on. |
| W-2 | Log; report to Julie (first W-2 immediately; continuing W-2 in the window record and at close); continue cadence against the churn baseline. **No intervention** — the revived chain under the holds is the accepted, bounded state ($0, no dispatch); nothing in the window's authorization acts on an expected event. |
| W-3 | **STOP the observation-only posture and report to Julie and (via the board) Rowan immediately**, with the raw values recorded in the window log **before** any act. Then, and only then: **(a)** if a T1–T4 trigger is **verified** to the §3.4 evidence standard → S1-X fires under part (C) (exactly one `stop_chain` + in-bound verifies); **(b)** else, if part (B2) was granted → the executor may apply `contain_drive` **exactly once** to bound drive accumulation while classification completes; **(c)** else → HOLD, preserve evidence, escalate; no act. A W-3 that is a trigger candidate is never "waited out." |
| W-4 | Log; report to Julie immediately and file for Rowan's disposition; continue hourly observation. No act is authorized by a W-4: no stop (no trigger), no second stimulus (the single stimulus, if used, is spent; a natural wake needs none), no re-send of anything. |
| W-1f at window close | §3.5. |

**S1-X triggers (carried from gates v4, unchanged):**
(T1) recorder or plan/job evidence of grant activity
beyond the §7.3 pre-classified set; (T2) any dispatch
observed while GENERATION_HALT is `"1"`; (T3) phase
or quota movement beyond the §7.3 predictions in any
amount not in the set; (T4) a second grant, a second
plan/job movement, or any movement in the conflicts
baseline, watermarks, or parked job outside the set.

**Evidence standard for a verified trigger
(V4-4 (c), carried):** the observation was made by a
scheduled §3.1 read; the raw observed values and
timestamps are written into the window log **before**
the stop act fires; the movement is outside the
§7.3 set under the same classification standard the
window reports under; **where paired surfaces
disagree, or a value cannot be freshly read, the
trigger is NOT verified** — the response is (b)/(c),
never the stop. An impression, an unrecorded
observation, or a single uncorroborated surface
reading never arms S1-X.

**S1-X budget when fired (carried):** exactly one
`stop_chain` act + `verify_chain_stop` attempts
within the episode bound (≤3 total). State writes
≤4, audit rows ≤5, `deleteAlarm` ≤3, `setAlarm` 0,
commands 0, all else 0. Ends HELD in CHAIN_STOPPED;
immediate report with the trigger, the firing reads,
and the stop record incl. `stopConfidence`. If the
episode exhausts unverified, S1-X is spent and any
further verification is R3-V territory (fresh Rowan
ruling + Julie authorization) — not a window act.

**Layer-1 `contain_drive` (part (B2), carried from
gates v4 S1 Layer 1):** one application (+1 state
write, +1 audit row) on out-of-set movement, to
bound drive accumulation while reporting proceeds.
It suppresses future drive passes; it does **not**
stop the alarm chain — registrations continue and
grant/void churn continues between passes. If S1-X
later fires, the stop proceeds from DRIVE_CONTAINED
(a legal transition). If (B2) is struck from the
authorization, the W-3 response is report + (a)/(c)
only. **Ruling Item E** asks Rowan to confirm (B2)
rides in this authorization for a natural event, as
it did for the deliberate one.

**Continuing-effect honesty (correction 6, carried):**
absent an S1-X stop, a revived chain continues its
~10-minute passes and §7.3 churn **beyond the window
close** — the window bounds observation, not the
chain. Window close does not quiet it, C3 (when it
comes) is the next authorized actor on it, and the
interim state is bounded ($0, no dispatch, delivery
fenced) but unbounded in duration. The window record
states this in its closing certification rather than
letting a clean close imply a quiet system.

### 3.5 W-1f (future re-base) at window close

If the event stands at W-1f when the window closes
(a wake re-based the registration to a future D, and
D has not arrived): the window record records the
disposition as **WAKE OBSERVED — DELIVERY PENDING
AT <D>**, with D now a known, observed value. This
is **not** a completed S1 disposition for C3
purposes (§4.3): the chain's delivery at D is a
known future event whose §7.3 arrival will be
unobserved once the window lapses. C3 does not
start until Rowan dispositions the W-1f end-state
(her options include extending observation to D
under a fresh authorization, or re-deriving C3's
stop-act expectations against a live future
registration — the stop act deletes whatever
registration is present, so a C3 against W-1f is
mechanically the stale-registration case with a
different `armedAt` value; the choice is hers, not
this proposal's).

---

## 4. R5AD-3 — Boundary reconciliation

### 4.1 Boundary map

| Scope | Owns | Begins | Ends | Explicitly does NOT include |
|---|---|---|---|---|
| **R5a-D** | The deployment: census, assembly, battery, one upload, verification (§5 carries the accepted package) | Julie's part-(A) GO, recorded before census | Rowan's acceptance of the execution record (**CLOSED**) | Any wake, command, transition, or the event the deployment makes possible. Its close never depends on the wake |
| **S1 (this sequence)** | The first-wake **event**: the window, detection, classification, disposition (§§2–3) | Window open = the upload's D2 read-back completion | Window close + Rowan's review of the window record (**CLOSED**, event dispositioned) | The deployment (R5a-D's), the stop (S1-X's, or C3's), any generation. Under Variant D it also owns the single conditional stimulus |
| **S1-X** | The emergency chain stop, if a verified T1–T4 trigger fires inside the window | Armed at window open (part (C)) | Fired (once) or expired at window close | The event itself; any second firing; any use outside this window, this pin |
| **C3** | Operational containment verification against the composed build: the mechanics pair + the physical stop act, PARTIAL verdict | Its own revised readiness + its own Julie GO, after §4.3's preconditions | CHAIN_STOPPED/verified (or STOPPED-unverified), record accepted | The first-wake event (already dispositioned before it starts); restoration; any stimulus |
| **Standalone restoration** | CHAIN_STOPPED → NORMAL, once, on its own authorization (fresh census + demonstrated reason + episode disclosure + **historical audit review**, gates v4 text unchanged) | After C3, on Rowan's review of C3's record and Julie's separate GO | NORMAL, registration still absent, episode closed | Re-arming (the clear does not re-arm); any verification work (that is R3-V's); any place inside R5a-D/S1/C3's GOs |
| **R3-V** | Post-exhaustion verification continuation, per exhausted episode (gates v4 text unchanged) | A Rowan ruling on an exhaustion record + Julie's authorization | One new episode's stop attempts, bounded as pinned | Any informal retry; any reset via `clear`; any scope beyond the named episode |

No scope's GO includes another scope. The §6
authorization is one *decision* containing four
*named parts* for two scopes (R5a-D; S1 incl. its
S1-X companion) because Option (ii) forbids
separating them in time — the parts remain
individually strikable in drafting (§6.1 states the
consequence of each strike).

### 4.2 State sequence (holds invariant throughout)

| State | Description | Reached by |
|---|---|---|
| **S-0 HELD-STALE** (today) | C1 build live; containment NORMAL/inert; stale registration 1793562576104 in place; chain not delivering (causation unproven, R-09) | — |
| **S-1 HELD-DEPLOYED-STALE** | Composed build live and verified; semantic armed; no wake yet; window running | R5a-D upload + read-back |
| **S-1n HELD-DEPLOYED-STALE, TESTED** | As S-1, but the deliberate stimulus (Variant D) has evaluated the wake with **no observed revival** within the tested window, subject to recorder limitations; `armedAt` at its stimulus-observed value (D, or unchanged, as recorded) | Variant-D stimulus + W-0/W-1f-free observation to close — W-1f routes to §3.5 instead |
| **S-2 HELD-REVIVED-CHURNING** | Chain live: ~10-min passes, §7.3 grant/void churn, recorder rows accruing; dispatched 0, $0; event dispositioned EXPECTED | W-2 inside the window |
| **S-2x HELD-STOPPED-BY-S1X** | S1-X fired on a verified trigger: CHAIN_STOPPED (verified, or unverified/exhausted as recorded) before C3 | W-3 + verified T1–T4 |
| **S-WX WINDOW-EXPIRED-UNRESOLVED** | Variant N only: window closed with no event; arrangements lapsed; semantic live; event unowned. **A named non-resting state** — C3 blocked; renewal or Rowan disposition required (§2.1) | Variant-N expiry |
| **S-3 HELD-CHAIN_STOPPED/VERIFIED** | C3's stop act performed and verified against the then-current registration | C3 (its own GO) |
| **S-4 HELD-NORMAL, REGISTRATION ABSENT** | Restoration's clear executed; episode closed; no registration in place | Standalone restoration (its own GO) |

From S-4, the first subsequent wake arms a **fresh**
registration by the ordinary rules — S-0's stale
condition does not recur from the restoration
itself (§1). What follows S-4 (any future S1-class
deliberate work under gates v4's original remainder
program) is outside this proposal.

### 4.3 C3 dependency and census-form changes

**Dependency (proposed, for Rowan's confirmation as
part of Ruling Item C's supersession):** C3's
preflight may open only when **all** of the
following hold:

1. R5a-D is CLOSED (Rowan's execution acceptance) —
   Rowan's standing requirement, unchanged.
2. The S1 window is CLOSED and the event stands
   **dispositioned** in exactly one of these forms:
   **EXPECTED-REVIVED** (state S-2), **NEGATIVE**
   (state S-1n; the mandated wording on record),
   or **STOPPED-BY-S1X** (state S-2x). W-1f-pending
   (§3.5), W-4 (undispositioned), and S-WX are
   **not** dispositions: C3 stays blocked until
   Rowan rules on the end-state.
3. Rowan has reviewed the window record.

**What changes in C3, by branch** (C3's revised
package owns the details; this proposal fixes the
forms):

- **Build/etag expectations** re-base to the
  composed production build (its build pin and etag
  as verified at R5a-D close) — in every branch,
  per Rowan's existing instruction.
- **EXPECTED-REVIVED (S-2):** the stop act targets a
  **live chain**, not the stale registration. The
  C3-0 `armedAt` hard expectation changes **form**:
  from the fixed value 1793562576104 to a
  **consistency expectation** — the value read at
  C3-0, identical across C3-0's paired reads,
  recorded as the stop act's `stopArmedBefore`
  expectation. The recorder baseline becomes the
  accrued rows/health as read; the preservation
  baselines for the preserved plan, its job, grants,
  and derived reserved become the **window closing
  census** values (the churn state), which the C3
  package must adopt as its census basis document.
  The ledger is unchanged in shape and budget. Two
  honest consequences: passes may occur during C3's
  own execution (background, within the churn
  invariants — a movement outside them is a C3 STOP
  as before), and the C3-1 `contain_drive` leg gains
  live meaning — a pass arriving after it will
  record drive suppressed, which is live
  drive-suppression evidence arising *inside* C3
  without C3 manufacturing it. C3 does not stage
  that arrival and its verdict remains **PARTIAL**
  unless Rowan rules otherwise on C3's record; the
  remainder is not silently discharged.
- **NEGATIVE (S-1n):** the stop act targets the
  stale registration exactly as C3's current package
  designs. Census values adopt the window closing
  census (`armedAt` = its recorded stimulus-observed
  value — D if the stimulus re-based it, else
  1793562576104; recorder as observed). No other
  form change.
- **STOPPED-BY-S1X (S-2x):** the physical stop has
  already been performed by S1-X. C3's stop act is
  not re-performed; C3 re-scopes (in its revised
  package, for Rowan's ruling) to verification of
  the existing stop record against fresh reads plus
  the mechanics legs that remain meaningful. If
  S1-X's episode stands exhausted/unverified, R3-V
  — not C3 — owns further verification, and C3's
  precondition (2) is met only with Rowan's express
  disposition of that record.

### 4.4 What does not move

The standalone restoration's authorization shape,
preconditions (including the V4-1 historical audit
review), budget, and GO text are **unchanged**; it
remains reachable only after C3, on its own
decision. R3-V is **unchanged**. The Phase B
preserved plan and the idx-26 exemption are
untouched by every stage of this proposal: the
§7.3 grant the event issues against the preserved
plan is a system effect of the wake under the holds
(already pre-classified and accepted as the
consequence set), not an operator act on the plan,
and no stage retires, releases, revokes, or
resubmits anything.

---

## 5. Carried forward unchanged (accepted basis)

From the R5a-D readiness package (pin
`74b7120ee7073ba2df3544a98991819a89cf0420`), **without
alteration**: candidate identity on both bases (§2
there: coordinator `5303cb63…`, +66/−36 vs the live
C1 build; entry `2bb0608b…` and service `5c5183e6…`
byte-identical to live; deployed delta at gate time
= coordinator + re-stamped identity, 29/31 identical);
gate-time assembly, build pin, and stamp (§3 there);
the 16-item fresh census (§4 there — the window-open
baseline of §3.1 is its closing repeat, not a new
census); mutation bounds and triggers T1–T6 (§5
there — with the DV-4 disposition refinement for
T5/T6 only); the class A / class B rollback
classification and §5.2 safety conditions (§5.1–5.2
there — the T5/T6 wake signature remains class B for
rollback purposes in every branch: **no rollback
answers a wake**); observability procedure (§6
there); V1–V8 verification at C1-2 claim strength
(§7 there — script deployment verified, runtime
adoption NOT claimed, RD-R2's adoption edge standing);
battery requirements and standing results (§8 there:
containment 42/42, R5a 23/23, P2 32/32, exit 0 on the
composed tree; gate-time re-run on the assembled tree
required); STOP conditions (§9 there); unresolved
risks (§10 there, register at corrected strength,
incl. R-02/R-03/R-04/R-05/R-06/R-09/R-11/R-12/R-13
and RD-R1..R3 — RD-R1's governance gap is what this
proposal closes; its consequence set is unchanged).
From gates v4 REVISED: the containment design's
stop/verify/episode law (bound 3, exhaustion =
STOP, clear ≠ retry reset), §R's recorded-vs-physical
discipline, S1's stimulus identity and mandated
negative wording, S1-X's triggers, budget, and
evidence standard, the standalone restoration, and
R3-V. Candidate code is untouched by this proposal;
no battery re-run is proposed or needed for
paperwork.

---

## 6. R5AD-4 — Authorization proposal (replaces readiness §11)

### 6.1 Structure and the dependency rule

One Julie decision, four separately named parts.
Parts are severable **in drafting** — Julie or Rowan
may strike any part before the decision is given —
but the sequence imposes one hard dependency, stated
rather than hidden: **part (A) is inoperative unless
parts (B) and (C) are granted with it.** Striking (B)
or (C) does not yield a leaner deployment; it yields
no deployment, because a deployment whose first-wake
consequence has no observation arrangements (B) or
no verified-trigger stop standing by (C) is Option
(i) under another name. Part (B2) may be struck
independently (the W-3 response narrows to report +
S1-X/escalate). Part (D) is genuinely optional: its
absence selects Variant N for the window's tail,
with §2.1's expiry consequences accepted knowingly.
The whole authorization is revocable by Julie at any
time before the upload; part (C) is additionally
revocable at any time before it fires.

### 6.2 Draft GO texts

**Part (A) — R5a-D execution** (the readiness
package's bounds; its Option-(i) acceptance
paragraph replaced by the governing-parts sentence):

> "GO — execute exactly one Gate R5a-D attempt as
> pinned in the R5a-D readiness package (pin
> `74b7120ee7073ba2df3544a98991819a89cf0420`) as
> sequenced by the R5a-D/S1 sequencing proposal (pin
> `<PIN — inserted at filing>`): fresh census,
> battery re-run (containment 42 + R5a 23 + P2 32)
> on the gate-assembled composed tree, build pin,
> exactly one upload of the composed candidate
> (coordinator `5303cb63…`; entry `2bb0608b…` and
> service `5c5183e6…` byte-identical to the live C1
> build) to `opalreader-api-v2-prod`, at most one
> conditional observability PATCH, and — ONLY for a
> confirmed deployment defect (class A) and ONLY
> after the package's rollback-safety conditions are
> all verified — conditionally one rollback upload
> of the preserved C1 build `27b2b3a9…` parts plus
> at most one conditional PATCH; any external or
> causally unresolved movement (class B, including a
> wake signature) authorizes NO rollback under this
> GO — the response is HOLD, preserve evidence, and
> escalate; passive reads only; NO containment
> transition, NO command, NO wake or stimulus **by
> the executor**, NO hold or queue change; ending
> HELD with containment inert at NORMAL. The
> first-wake consequence of this deploy is not
> accepted as an unowned outcome: it is governed by
> parts (B), (C) and (D) of this same authorization,
> granted together with this part. If any of parts
> (B)–(D) as applicable is not granted, this part
> does not authorize execution."

**Part (B) — S1 observation window (incl. B2):**

> "GO — S1 observation window: from the completion
> of the R5a-D upload's read-back, for 72 hours,
> Wren will perform the read-only observation checks
> of §3 of the sequencing proposal (pin `<PIN>`) at
> its stated cadence, recording every read's raw
> values in the window log, reporting any
> classification other than W-0 to me immediately,
> and filing the window record at close. Reads only:
> no command, no stimulus except part (D), no
> transition except part (B2). **(B2)** Layer-1
> contingency: on movement outside the §7.3
> pre-classified set that does not meet a verified
> S1-X trigger, Wren may apply `contain_drive`
> exactly once (+1 state write, +1 audit row),
> reporting immediately; I understand `contain_drive`
> bounds drive passes but does not stop the alarm
> chain."

**Part (C) — S1-X standing conditional authorization
(re-bound to this proposal and this window, per
V4-4's five conditions):**

> "GO — standing conditional authorization for Gate
> S1-X under the R5a-D/S1 sequencing proposal, pin
> `<PIN — inserted at filing>`, armed only during
> the single S1 observation window defined there
> (from the R5a-D upload's read-back completion to
> the window's closing census at +72 hours): if any
> S1-X trigger (T1–T4, as carried in §3.4 of the
> proposal) is observed at a scheduled window read
> AND verified to the proposal's evidence standard
> (scheduled reads; raw values and timestamps
> recorded in the window log before firing; paired
> surfaces in agreement; movement outside the §7.3
> pre-classified set), execute exactly one
> `stop_chain` with in-bound `verify_chain_stop`
> attempts (≤3), report immediately, and end HELD in
> CHAIN_STOPPED. This authorization is single-use,
> expires at window close whether or not it fires,
> carries over to no other window, package, or gate,
> is revocable by me at any time before it fires,
> covers no other act, and does not extend part
> (A)'s GO."

**Part (D) — conditional deliberate stimulus
(operative only if Ruling Item A selects Variant
D):**

> "GO — conditional S1 stimulus: if no natural wake
> has been observed by the +24-hour scheduled window
> read, Wren may send exactly one `RequestPause`
> command with a fresh `command_id` (generated and
> recorded before sending) targeting the reserved
> nonexistent job `alarm-wake-probe:nonexistent`,
> after re-verifying on fresh reads at that moment
> that the target does not exist and re-reading the
> recorder baseline. Expected response: `rejected` /
> `job_not_found`. NO re-send under any circumstance
> — an ambiguous response is a STOP-and-classify
> event. Post-stimulus reads follow §3.2's cadence.
> A no-revival outcome is reported only as 'no
> observed revival within the tested window, subject
> to recorder limitations.'"

### 6.3 What the combined authorization spends

Production writes, worst case across all parts:
R5a-D — 1 upload (+ ≤1 conditional PATCH; + ≤1
class-A rollback upload and ≤1 conditional PATCH);
window — reads 0 writes; (B2) ≤1 state write + ≤1
audit row; (C) if fired: state writes ≤4, audit rows
≤5, `deleteAlarm` ≤3, `setAlarm` 0; (D) if used: 1
commands row, `setAlarm` ≤1 from the stimulus's own
wake evaluation (the composed build's memo bound),
plus per-pass `finally` registrations only if passes
are delivered (system behavior, classified — not
operator stimuli). Plus the event's own §7.3 system
effects (grant issuance and churn), which are
consequences under the holds, not operator writes.
Spend **$0** in every branch while the holds stand.

### 6.4 NOT authorized by §6, in any combination

C3 (any part of it); the standalone restoration;
R3-V; a second stimulus; a second S1-X firing;
window renewal or extension; any SubmitJob or
generation; any hold flip or queue change; any
rollback for a class-B finding; any command other
than part (D)'s one; any containment transition
other than (B2)'s single `contain_drive` and (C)'s
single `stop_chain` with its in-bound verifies.

---

## 7. Ruling items for Rowan

- **Item A — Window tail variant.** Variant D
  (conditional deliberate stimulus at +24 h;
  Wren-recommended, §2 Stage 3b) or Variant N
  (natural only; §2.1's expiry state accepted)?
  Part (D) of §6 stands or falls with this ruling.
- **Item B — S1-X re-binding (DV-3).** Is the §6
  part-(C) binding — this proposal's pin, this
  window definition (upload read-back → +72 h
  closing census), the carried triggers/evidence
  standard/budget — the V4-4-compliant form for this
  sequence?
- **Item C — Gates-v4 S1 dependency supersession
  (DV-2) and the C3 dependency (§4.3).** Confirm
  that the S1 event precedes C3 in this sequence
  (the gates text's S1-after-restoration order does
  not survive Option (ii)), and that C3's preflight
  requires R5a-D CLOSED **and** the §4.3 disposition
  in one of its three named forms.
- **Item D — Window parameters.** 72-hour duration;
  the §3.2 cadence (hourly to +12 h, 6-hourly to
  close, 10-minute tightening on W-1); the +24-hour
  stimulus point (Variant D). Accept or amend.
- **Item E — Layer-1 `contain_drive` (part (B2)).**
  Confirm it rides in this authorization for a
  natural first-wake event, as gates v4 placed it
  inside S1's GO for the deliberate one — or strike
  it to report-only.

---

## 8. Package contents and turn

This proposal is a single consolidated document,
pinned with the ruling record
(`ROWAN-R5AD-READINESS-RULING.md`) and the companion
cp (`PHASEB-R5AD-S1-SEQUENCING-ROWAN-CP.md`). The
documents it carries forward are cited by pin and
hash in §5 and remain in the GitHub archive; the
Dropbox review folder carries this proposal and its
cp only (plus the standing instructions file), per
the rotation.

**Production remains under INVESTIGATION HOLD.
Nothing in this proposal deploys, transitions, wakes,
stimulates, or mutates anything, and no GO is
requested by it. Turn: Rowan's — review of this
revised sequencing and readiness proposal, including
Ruling Items A–E (§7).**
