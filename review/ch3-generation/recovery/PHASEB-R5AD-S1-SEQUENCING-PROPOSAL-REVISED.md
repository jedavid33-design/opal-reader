# Phase B — REVISED R5a-D/S1 sequencing and readiness proposal (Option (ii)) — REVISED per Rowan's sequencing ruling

**Status: READINESS PAPERWORK ONLY. Nothing in this
proposal is executed by it, and no GO is requested by
it.** Rowan's review of this proposal is not a GO; a
production GO remains a separate future step (Julie's
explicit authorization, in the §6 forms, after Rowan's
review). Production is under INVESTIGATION HOLD and
ends HELD. This proposal authorizes nothing.

**Assignment:** Rowan's ruling on the R5a-D/S1
sequencing proposal (Nov 2, 2026; pin
`5325cb56c9741ce0318d1a1e53ea5e141dcfa3a5`; recorded
at `ROWAN-R5AD-S1-SEQUENCING-RULING.md`): verdict
**REVISE — PRODUCTION HOLD CONTINUES**. The central
Option-(ii) sequencing is **ACCEPTED IN PRINCIPLE**:
S1 safety arrangements precede R5a-D deployment;
R5a-D closes independently; S1 disposition precedes
separately authorized C3. Ruling Items **A–E** are
decided (§0.1) and corrections **RS-1..RS-5** are
required (§0.2). The candidate identity, census
requirements, test batteries, mutation budgets, STOP
discipline, rollback classification, and
runtime-adoption caveats from the readiness package
are **accepted and carry forward unchanged** (§5).
This revision changes sequencing, authorization,
monitoring, and disposition law only. It does not
execute the revised plan.

**Gate structure (unchanged):** C1 (CLOSED) → C2
(CLOSED, readability verified) → **R5a-D + S1 (this
proposal: one deployment, one observation window, one
owned first-wake event, one owned post-window tail)**
→ C3 (readiness held; census re-based after R5a-D
closes AND the S1 event is dispositioned, §4.3) →
standalone restoration (separate, unchanged) → R3-V
micro-scope (unchanged).

---

## 0.1 Ruling Items A–E — dispositions applied

| Item | Rowan's ruling | Where applied | Status |
|---|---|---|---|
| **A** | Variant D selected **CONDITIONALLY**: the +24-hour fallback stimulus is a **separately authorized, single-use act**, subject to a clean preflight and the revised safety arrangements | §2 Stage 3b; §6.1 dependency law; **§6.3 Grant 2** (the separate Part D authorization) | **SETTLED by ruling** — implemented as a separate grant, not a folded-in consequence (RS-3) |
| **B** | S1-X re-binding structure accepted **in principle**; correct its **operational coverage and expiry consequences** before approval | **§3.6** (coverage/expiry law, cases (i)–(v)) | Corrected; **confirmation requested** (§7 Item B′) |
| **C** | DV-2 sequencing supersession and the two-part C3 dependency **ACCEPTED** | §4.1, §4.3 — recorded as settled law of this sequence | **SETTLED** — removed from ruling items |
| **D** | Revise the 72-hour observation arrangements: enforceable check coverage, missed-check handling, post-window disposition | **§3.2** (monitoring mechanics, RS-2) and **§3.7** (post-window ownership, RS-1) | Corrected; parameters **confirmation requested** (§7 Item D′) |
| **E** | Layer-1 `contain_drive` retained as **optional, single-use** contingency for natural or deliberate events; **not a chain stop, never represented as one** | §3.4, §6.2 Part (B2) — strikable; not-a-chain-stop discipline applied at every mention (§0.3) | **SETTLED** |

## 0.2 Corrections banner — where RS-1..RS-5 are answered

| Correction | Requirement | Answered in |
|---|---|---|
| **RS-1** | Address indefinite expected chain activity after window expiry: continued observation, authorized stop sequencing, or another explicit safety disposition — **no silent unowned interval** | **§3.7** — the post-window ownership regime (REVIVED-UNSTOPPED / OWNED and DEPLOYED-STALE / OWNED branches): named owner, named cadence, named next decision for every interval; expiry changes the regime, never ends ownership |
| **RS-2** | Establish how scheduled monitoring is actually performed and verified: missed checks, unavailable reads, escalation, a stop/hold decision rule | **§3.2** — agent-executed logged check-ins; a check with no log entry is MISSED by definition; verified-vs-unobserved coverage accounting; failed checks; the escalation ladder; the WINDOW-FAILED decision rule and its effects |
| **RS-3** | Correct the authorization dependency: Part A **requires** Parts B and C; Part D is conditional and **separately authorized** under Variant D | **§6** — §6.1 dependency law (A is **void** without B and C together); §6.2 Grant 1 (combined A+B+C, drafted); **§6.3 Grant 2** (Part D alone: its own authorization moment at/before the +24 h read, on a clean preflight reported to Julie) |
| **RS-4** | Resolve W-3/W-4 uncertainty handling, recorder errors, failed reads, unverified trigger cases — the strict S1-X evidence standard preserved | **§3.3** (taxonomy revised: W-3e recorder-error class, W-3u unverified-trigger class) and **§3.4** (per-case handling table: unverified **never** fires S1-X; unverified = tighten + escalate + preserve; classification stays UNRESOLVED until verification or window disposition) |
| **RS-5** | Distinguish verified S1-X stop from exhausted/unverified stop in C3 eligibility; preserve R3-V's exclusive post-exhaustion role | **§4.3** — the eligibility table: STOPPED-BY-S1X-VERIFIED vs STOPPED-BY-S1X-EXHAUSTED/UNVERIFIED (not a C3 disposition; R3-V first; `clear` never substitutes), plus the REVIVED-UNSTOPPED post-window path into C3 |

**Carried corrections (prior round, unchanged):**
R5AD-1 → §2 (sequence); R5AD-2 → §3
(detection/observation/classification/response);
R5AD-3 → §4 (boundaries); R5AD-4 → §6 (the §11
replacement, now restructured by RS-3).

## 0.3 Deviations — identified explicitly

Carried from the prior proposal (status updated):

- **DV-1 — Readiness §11 GO wording replaced in
  full;** the Option-(i) acceptance paragraph
  removed. **Superseded in form by DV-7**: §6 is now
  two grants, not one four-part decision.
- **DV-2 — Gates-v4 S1 hard dependency superseded
  in order** (S1's event precedes C3). **SETTLED —
  accepted by Rowan (Item C).** No longer a ruling
  item; stated as the sequence's law.
- **DV-3 — S1-X re-bound** to this sequence's pin
  and window. Structure accepted in principle
  (Item B); coverage/expiry law corrected in §3.6
  and presented for confirmation (Item B′).
- **DV-4 — T5/T6 wake-signature disposition**
  (early S1 event inside the armed window; class-B
  rollback discipline unchanged). Unchanged.
- **DV-5 — Scheduled observation reads as a named
  activity.** Extended by RS-2: the checks are now
  logged, coverage-accounted, and failure-ruled
  (§3.2), and by DV-8's post-window tail.
- **DV-6 — Two C3 census items change form.**
  Extended by DV-9 (eligibility forms).

New in this revision:

- **DV-7 — Part D leaves the combined
  authorization.** Under Item A as conditioned and
  RS-3, the +24 h fallback stimulus is **not** a
  part of the combined grant: it is a separate,
  single-use authorization (Grant 2, §6.3) that
  Julie gives — or does not — at or before the
  +24 h read, on a clean preflight reported to her.
  The prior proposal's part (D) text is withdrawn.
- **DV-8 — A post-window ownership regime exists**
  (§3.7), including a Part B **tail** of read-only
  checks after window close. The prior proposal
  named the continuing chain honestly but left its
  post-window observation to C3's arrival; RS-1
  requires a named owner and cadence for every
  interval, so the tail is new, named, and inside
  Part B's authorization (§6.2).
- **DV-9 — C3's S1-disposition forms are
  refined** (§4.3): STOPPED-BY-S1X splits into
  VERIFIED (a disposition) and EXHAUSTED/UNVERIFIED
  (not a disposition — R3-V first), and
  EXPECTED-REVIVED gains the post-window form
  REVIVED-UNSTOPPED. This refines DV-6/§4.3 of the
  prior proposal under RS-5; the two-part
  dependency itself is settled (Item C) and does
  not change.
- **DV-10 — WINDOW-FAILED is a named window
  outcome** (§3.2): a coverage failure state with
  its own disposition (or non-disposition)
  consequences for S1 and C3. The prior proposal's
  cadence had no failure semantics.

**Layer-1 discipline (Item E), applied globally:**
every mention of `contain_drive` in this proposal
carries its limit with it — `contain_drive`
suppresses future drive passes; **it is not a chain
stop and is never represented as one**:
registrations continue while it is applied, and the
chain is stopped only by a verified `stop_chain`
(S1-X or C3) or not at all.

Nothing else in the accepted basis changes (§5).

---

## 1. The problem, restated at ruling strength

Unchanged from the prior proposal §1, at the same
strength: deployment itself performs no alarm
action; the deployed R5a semantic changes what the
**next wake** does; a wake is **expected** in
ordinary operations while HELD (`POST
/v2/sync/position` constructs a fresh
`PushPositionEvents` command per push and reaches
`wake()`); on the first wake the past-due disjunct
fires (the live registration `armedAt`
**1793562576104** = 2026-11-01T19:49:36.104Z is ~26×
beyond the provisional 3,600,000 ms threshold) →
exactly one `setAlarm(D)` (memo-bounded); D
unobservable until that moment (B1 leading, **not
proven**; B2/B3 open); under B1/B2 the past-due
registration delivers promptly → a drive pass under
the holds → exactly the pre-classified §7.3 set
(grant `grant:plan:19cad189fab54b9c804a74a6:seg:1:full`
issued; occurrence `pending` → `granted`; job
`queued` rev 1 → `generating` rev 2; derived
reserved 0 → 12; **dispatched 0, attempts 0, $0,
all five phase figures frozen**) — and the watchdog
re-arms, so the chain **revives** into the bounded
grant/void churn indefinitely (≤1 live grant;
reserved ∈ {0, 12}) until a stop act or another
authorized disposition. Under B3, registration
re-bases to a future D and the chain revives when D
arrives.

Rowan's Option (ii) ruling assigns ownership of
that event to **S1's scope**, and her sequencing
ruling adds the condition this revision implements:
the event's safety arrangements are not complete
until their **coverage, expiry, monitoring, and
post-window ownership** are defined to the standard
of §§3.2, 3.6, 3.7. The first-wake consequence
remains a **one-incident phenomenon** (this stale
registration, this first wake); the disjunct remains
a permanent semantic for any future registration
that itself goes stale (R-03/R-05 residuals stand).

---

## 2. R5AD-1 — The sequence (authorization structure revised per RS-3)

Five stages. No stage begins until the prior
stage's exit condition is met. Holds are invariant
throughout (GENERATION_HALT `"1"`, queue paused,
containment NORMAL until and unless S1-X fires;
§4.2).

### Stage 0 — Paperwork and rulings (now)

This revised proposal is reviewed by Rowan. The
remaining confirmation items (§7: B′ S1-X
coverage/expiry law; D′ monitoring and post-window
parameters) are ruled on. Items A, C, E are settled
(§0.1). **No production step of any kind occurs in
Stage 0**, and no GO is requested until Rowan's
rulings are on record.

### Stage 1 — Arrangements authorized (no production step)

Julie grants **Grant 1** (§6.2): parts (A) R5a-D
execution, (B) window arrangements (including the
(B2) Layer-1 contingency and the §3.7 post-window
tail), and (C) S1-X standing chain stop — one
decision, three separately named parts, under the
§6.1 dependency law: **(A) is void unless (B) and
(C) are granted with it.** Granting performs
nothing: it arms the arrangements so deployment and
event are never separated by an unowned interval.
Part (D) is **not** in Grant 1 (DV-7): the fallback
stimulus is authorized separately, later, under
**Grant 2** (§6.3), if at all. As part of Stage 1,
Wren creates the window's check schedule (a local
agent scheduling act under Part B; no production
effect) so the §3.2 cadence exists before the
window can open.

### Stage 2 — R5a-D executes and CLOSES (deployment only)

Exactly the accepted readiness package: GO recorded
on the board before census → 16-item fresh census
→ fresh assembly → battery re-run (containment 42
+ R5a 23 + P2 32 on the gate-assembled tree) →
build pin → **exactly one upload** → observability
check (≤1 conditional PATCH) → V1–V8 verification →
execution record → Rowan's independent execution
review → **CLOSED**. R5a-D's close is **documentary
and independent of the wake** (unchanged). DV-4
stands: a T5/T6 wake signature during verification
STOPs the gate and is simultaneously an early S1
event inside the already-open window; class-B
rollback discipline unchanged — **no rollback
answers a wake**.

**The S1 window opens at the completion of the
upload's D2 read-back.** The gate's own V-reads are
the window's first scheduled checks (§3.2 coverage
accounting starts there).

### Stage 3 — The S1 observation window (72 hours from window open)

The window is the S1 scope under Option (ii): the
first-wake event — natural or, under a separately
granted Part D, deliberately completed — is
detected, classified, and dispositioned inside it,
under the §3 arrangements and the §6 authorizations.
S1-X is armed for the window's duration under the
§3.6 coverage law (part (C)). Layer-1
`contain_drive` is available exactly as part (B2)
provides — a drive-pass suppressor, **not a chain
stop** (§0.3). Observation mechanics and failure
law are §3.2; taxonomy §3.3; responses §3.4.

**Stage 3a — natural event.** Ordinary traffic
wakes the coordinator; §3 detects and classifies;
an EXPECTED event (W-2) is recorded and reported,
and observation continues to window close (the
revived chain is a continuing state; later checks
classify against the churn invariants).

**Stage 3b — deliberate completion (Variant D, as
conditioned).** If **no natural wake has been
observed by the +24-hour scheduled check**, Wren
prepares the **Part D preflight report** (§6.3):
the window log through +24 h, the current
classification, the recorder baseline re-read, and
target nonexistence re-verified. Wren presents it
to Julie. **Only if Julie then grants Grant 2** —
a separate decision, at or before the +24 h point
as §6.3 defines — may the executor send the
original S1 stimulus: exactly one `RequestPause`
command, fresh `command_id` generated and recorded
**before** sending, targeting the reserved
nonexistent job `alarm-wake-probe:nonexistent`.
Expected response: outcome `rejected`, reason
`job_not_found`. **No re-send under any
circumstance** — a timeout or ambiguous response is
a STOP-and-classify event. If the preflight is not
clean, Grant 2 may not be requested or granted
until the anomaly is dispositioned (§6.3). If
Julie does not grant Grant 2, no stimulus is sent
and the window runs on natural traffic to close —
the post-window regime of §3.7 (no-event branch)
then owns the tail. A no-revival outcome is
reported **only** as "**no observed revival within
the tested window, subject to recorder
limitations**" — the mandated wording, unchanged.

### Stage 4 — Window close, S1 disposition, post-window regime

At +72 hours the executor performs the **closing
census** (the §3.1 read set, in full) and files the
**window record**: every scheduled check (performed,
missed, failed — §3.2 accounting), the coverage
table (verified vs unobserved intervals), every
classification, the event's disposition in exactly
one of the §4.3 forms (or the named non-disposition
that blocks C3), the S1-X state (fired / expired /
spent — §3.6), the Layer-1 state (applied / not —
`contain_drive`, if applied, bounds drive passes
only and has **not** stopped the chain), the Part D
state (granted+used / granted+unexercised-lapsed /
never granted / never requested), and the
ends-HELD certification. **S1-X expires at window
close, fired or unfired (§3.6) — after expiry it is
DEAD.** Rowan reviews the window record; the S1
scope is then CLOSED (event dispositioned or
expressly undispositioned), and **ownership passes
to the §3.7 post-window regime without a gap**: the
regime's first tail check is scheduled at the
closing census itself.

### Stage 5 — C3 (separate package revision, separate GO)

C3's readiness package is revised to re-base its
census to the composed build and to the §4.3
eligibility state, is reviewed by Rowan, and is
executed only under its own Julie GO. C3's
preconditions are the two-part dependency as
refined by RS-5 (§4.3): R5a-D CLOSED **and** a valid
S1 disposition in one of the eligible forms. C3 is
**not** authorized by anything in this proposal
(§6.4).

---

## 3. R5AD-2 — First-wake detection, observation, classification, response (revised per Items B, D, E and RS-1, RS-2, RS-4)

### 3.1 Detection surfaces (the scheduled read set) — unchanged

Every scheduled check performs the same read set.
All are GET surfaces or external read-backs; no
read in the set sends a command, and no GET path
calls `wake()` (source-verified; the assessment's
standing finding). Every element of the §7.3
pre-classified set and every S1-X trigger has at
least one observing surface; load-bearing facts
have two.

| # | Read | What it detects |
|---|---|---|
| 1 | `GET /v2/d6-diagnostics` with `drive=1` (operator) | **Primary wake surface.** Recorder: `tableState`, `drivePasses` rows (stage, `driveOnce` invoked?, outcomes, recorded error, `armed_after`), `recorderHealth`. Alarm: live `getAlarm()` (`armedAt`), `pendingSchedule`, `pendingWatchdog` |
| 2 | `GET /v2/d6-containment` (operator) | Containment projection: state, absence, verified flag, `stopConfidence`, stop-record/episode fields — second surface for containment facts; reports an S1-X firing's result |
| 3 | `GET /v2/d6-diagnostics?planId=plan:19cad189fab54b9c804a74a6` | Preserved plan: state, totals, idx-26 entry disposition/`executionState`, grants projection, `phaseAccounting` (phase read here AND at #5) |
| 4 | `GET /v2/jobs/plan:19cad189fab54b9c804a74a6:seg` | Preserved job: state, revision, **grants [] → [the one grant]** — the §7.3 issuance marker |
| 5 | `GET /v2/generation/capabilities` | Phase block (second phase surface), standard admitted / Batch `batch_not_armed`, registry binding |
| 6 | `GET /v2/d6-quota-reconcile` (operator) | Reconcile `ok`, drift, sole straddler; derived totals incl. **reserved 0 → 12**; per-PT-day dispatched (must stay 0) |
| 7 | `GET /v2/conflicts` | Four-row `schedule_dead` baseline, exact-match (trigger T4 surface) |
| 8 | `GET /v2/sync/changes?family=bindings&sinceSeq=1841` | 0 changes expected; any binding change is outside the §7.3 set |
| 9 | cf-api queue read-back, `opalreader-generation-v2` | `delivery_paused: true`, exactly 1 consumer — the delivery fence, verified externally |
| 10 | `GET /health` | Build stamp unchanged, generation `halted`, coordinator `armed` |

The **window-open baseline** is the R5a-D closing
census, incorporated by reference as the window
record's first entry (values as in the prior
proposal: `armedAt` 1793562576104 or its
census-observed value, recorder missing/empty, plan
`active` {1,0,0,0,0} entry `pending`, job `queued`
rev 1 grants [], reserved 0, dispatched 0, phase
frozen, conflicts exact, watermarks 18/1841,
containment NORMAL/absent/verified).

### 3.2 Monitoring mechanics — how checks are performed and verified (RS-2; Item D)

Rowan's Item D requires the monitoring to be
**enforceable**: coverage defined, missed checks
handled, post-window disposition named (§3.7).
This section is the mechanism.

**Vehicle (stated honestly).** The scheduled checks
are **agent-executed check-ins performed by Wren**
under Part B: a local schedule (created in Stage 1)
wakes Wren at each cadence point; Wren performs the
§3.1 set, classifies, logs, and reports per §3.4.
There is no other monitoring machinery and this
proposal invents none: the checks happen because
Wren runs them, and their performance is proven by
the window log — not assumed from the schedule's
existence. The schedule's creation is a local agent
act with no production effect, authorized as part
of Part B (§6.2). GET-only: a check sends nothing
and cannot wake the coordinator (§3.1 basis).

**Per-check logging (the coverage rule).** Every
check, at execution time, appends one entry to the
**window log**: scheduled time, actual time, the
full raw §3.1 values, the classification, and any
report made. The window log is evidence, filed with
the window record. **A check that left no log entry
is a MISSED check by definition** — performance is
the log, not the intention. A check whose entry
exists but whose §3.1 set is incomplete (any read
errored or unavailable) is a **FAILED check**,
logged as failed with the failing surfaces named;
a failed check is **not a negative observation**
(it observed nothing about those surfaces) and
counts as a missed check for gap purposes, with
the distinction recorded.

**Coverage accounting.** An interval between two
consecutive completed logged checks is a **VERIFIED
interval**: classifications may span it. Any span
containing a missed or failed check is an
**UNOBSERVED interval**, named as such in the
window record with its bounds. Consequences:

- **W-0 ("no event") may be claimed only over
  verified intervals.** A window whose close is
  otherwise W-0 but which contains unobserved
  intervals closes with the W-0 claim **qualified to
  the verified intervals**, the gaps named; the
  NEGATIVE disposition (§4.3) is unavailable on
  gapped coverage unless Rowan dispositions the
  gaps expressly.
- An event whose first evidence appears at the
  check ending an unobserved interval is classified
  on its observed values, with its **arrival time
  recorded as unknown-within the gap**.

**Cadence** (times from window open; parameters
presented for confirmation, §7 Item D′):

| Interval | Cadence |
|---|---|
| Open → +2 h | The gate's V-sets (≈ +10, ≈ +25 min) count as the window's first checks; then +1 h, +2 h |
| +2 h → +12 h | Hourly |
| +12 h → +72 h | Every 6 h |
| On W-1p | Every 10 min until a pass is observed, the value resolves as future (→ W-1f), or 2 h elapse without a pass (→ W-4) |
| On W-3u (unverified trigger candidate) | Every 10 min until verified, resolved, or window disposition (§3.4) |
| On Variant-D stimulus dispatch (Grant 2) | ≈ +2, +12, +37 min from dispatch, then rejoin the window cadence |
| +72 h | **Closing census** (full §3.1 set) + window record |

**Missed-check detection and the escalation
ladder.** A missed check is **detected at the next
performed check** by the log gap (scheduled points
are fixed in advance by the cadence table; the
performing check compares the log against them).
On detection, Wren (a) logs the gap as an
unobserved interval, (b) performs the current check
in full, and (c) applies the ladder:

- **One missed/failed check, gap within bound**
  (bound = 2× the scheduled interval for that
  phase: >2 h in the hourly phase, >12 h in the
  6-hourly phase, >30 min in a tightened phase):
  logged and reported to Julie at the next report
  point; cadence continues; coverage qualification
  per above.
- **Escalation bound breached** — two consecutive
  missed/failed checks, **or** any single gap
  exceeding its bound, **or** reads unavailable
  across two consecutive performed checks: Wren
  **reports to Julie immediately and files for
  Rowan**, and declares the window **HELD**
  (below) without waiting for instruction.

**The stop/hold decision rule — WINDOW-FAILED.**
Wren **must** declare the window WINDOW-FAILED when
the escalation bound is breached and coverage
cannot be re-established by the next scheduled
check, or when performed checks show the §3.1 set
persistently unreadable (two consecutive failed
checks on the same surface). The declaration is
Wren's duty under this rule, not a discretionary
judgment; Julie may also declare it at any time,
and Rowan may rule it on the record. Effects of
WINDOW-FAILED:

- The window's observation posture is **hold**: no
  classification is upgraded on the strength of
  failed coverage; the event, if any, stands
  **undispositioned**.
- **C3 is blocked** (§4.3): WINDOW-FAILED is not a
  disposition.
- S1-X is **not** extended by the failure: its
  binding is time-based (§3.6) and expires at
  window close regardless. During unobserved
  intervals S1-X is in practice blind (it fires
  only on a scheduled read's verified observation,
  §3.4) — named here so no one mistakes an armed
  S1-X for coverage.
- Resumption (a renewed window, a re-based
  disposition, or any onward step) requires
  **Rowan's ruling + a fresh Julie authorization**.
  Nothing in Part B self-heals a failed window.

**Reporting duty (unchanged in substance).** Wren
reports to Julie **immediately** on any
classification other than W-0, on any missed/failed
check that breaches a bound, on any W-1 → W-2/W-3/
W-4 transition, and on any declaration under this
section. W-0 checks are silent — logged, not
reported.

### 3.3 Classification taxonomy (RS-4: uncertainty classes resolved)

Every performed check is classified into exactly
one class. Paired surfaces must agree; a value that
cannot be freshly read is not evidence (§3.2's
failed-check rule governs check-level read
failures; this taxonomy classifies what completed
reads show).

- **W-0 — NO EVENT.** Every read at baseline.
  *Continue cadence.* (Span claims per §3.2
  coverage accounting.)
- **W-1 — WAKE OBSERVED, PASS PENDING.** `armedAt`
  changed to a new value V (V **is** D, made
  observable by the wake), no pass yet observed.
  **W-1p** — V past-due or near: tightened cadence.
  **W-1f** — V in the future (B3 re-base): recorded
  with V; not a completed event (§3.5).
- **W-2 — EXPECTED S1 EVENT.** A drive pass
  observed (new recorder row, pass ran) **and**
  every marker exactly inside the §7.3 set (the one
  grant or its lease-expired void state within the
  churn invariants; occurrence `granted` or its
  §7.3-consistent value; job `generating` rev ≥ 2;
  reserved ∈ {0, 12}; dispatched 0; attempts 0;
  phase frozen **on both surfaces**; conflicts
  exact; watermarks frozen; parked exact;
  containment NORMAL; and **no recorder row
  carrying an unexplained error** — see W-3e).
  Later checks classify against the **churn
  baseline** (the §7.3 invariants).
- **W-3e — RECORDER ERROR ROW (RS-4).** A new
  recorder row carries a non-null recorded error,
  or its stage shows the pass died before
  `driveOnce` completed, or `recorderHealth`
  reports a recorder failure. An error-stage row is
  a **finding requiring classification, never
  absorbed into W-2** on the strength of matching
  state alone. Handling (§3.4): report immediately;
  if every state marker nevertheless sits exactly
  inside the §7.3 set and the error is classifiable
  against the design's known recorder failure modes
  (recorder write failure with the pass itself
  evidenced on the state surfaces), the event may
  be dispositioned EXPECTED **with the error row
  carried as a named exception in the window
  record**; if the error is not so classifiable, or
  any marker is out of set, the class is W-3u or
  W-3 as applicable. A recorder failure also
  degrades detection (§3.1 surface 1): subsequent
  checks rely on the state surfaces, and the
  degradation is named in every later report until
  a clean row or the closing census resolves it.
- **W-3u — ANOMALOUS, UNVERIFIED (RS-4).** Evidence
  is suggestive of an out-of-set condition or of a
  T1–T4 trigger, but the §3.4 evidence standard is
  **not met**: paired surfaces disagree, a needed
  value cannot be freshly read, or the movement's
  membership in/out of the §7.3 set cannot be
  established from completed reads. **An unverified
  trigger NEVER fires S1-X.** Handling (§3.4):
  tighten cadence to 10 minutes, escalate to Julie
  immediately and file for Rowan, preserve the raw
  values, and hold the classification **UNRESOLVED**
  until a later performed check verifies it (→ the
  verified class), resolves it as in-set (→ W-2 or
  W-0 as the values establish), or the window
  closes with it outstanding (§3.6 case (ii) /
  §4.3 non-disposition).
- **W-3 — ANOMALOUS, VERIFIED.** Any condition
  outside W-0/W-1/W-2 established on completed,
  agreeing reads: any **verified** T1–T4 trigger
  (§3.4); dispatched > 0; phase/quota movement
  beyond §7.3; a second or wrong grant; conflicts/
  watermark/parked movement; containment ≠ NORMAL
  for any reason other than an authorized
  (B2)/(C) act. *Response per §3.4.*
- **W-4 — WAKE OBSERVED, DELIVERY NOT OBSERVED.**
  A W-1p registration stands 2 hours of tightened
  observation with no pass: the original stall's
  signature on a fresh registration. Not a trigger.
  *Report and escalate; disposition is Rowan's;
  hourly cadence continues unless she rules
  otherwise.* W-4 is UNRESOLVED until Rowan
  dispositions it (§4.3).

### 3.4 Authorized response per class (Item E discipline applied)

| Class | Authorized response (complete) |
|---|---|
| W-0 | Log; continue cadence. Nothing else. |
| W-1 (p/f) | Log with V; tighten (W-1p); report to Julie — **immediately** if V arrived via the Grant-2 stimulus reads. No intervention: a pending registration is not acted on. |
| W-2 | Log; report to Julie (first W-2 immediately; continuing W-2 in the window record and at close); continue against the churn baseline. **No intervention** — the revived chain under the holds is the accepted, bounded state ($0, no dispatch). |
| W-3e | Log the raw row; report to Julie immediately and file for Rowan. Classify per §3.3's rule (EXPECTED-with-exception only under its two conditions; else W-3u/W-3 handling). No act of any kind is authorized by a W-3e alone. |
| W-3u | Log the raw values **before** any act; tighten to 10-min cadence; report to Julie immediately and file for Rowan. **S1-X does not fire** (unverified). If (B2) was granted, the executor may apply `contain_drive` **exactly once** while classification completes — `contain_drive` suppresses future drive passes; **it is not a chain stop**: registrations and churn continue under it. Otherwise: HOLD, preserve evidence, escalate. The classification stays UNRESOLVED until verified or dispositioned. |
| W-3 (verified) | **STOP the observation-only posture; report to Julie and Rowan immediately**, raw values already logged. Then, only: **(a)** a T1–T4 trigger verified to the §3.4 evidence standard → S1-X fires under Part (C) within §3.6's coverage law (exactly one `stop_chain` + in-bound verifies); **(b)** else, if (B2) granted and not yet used → `contain_drive` exactly once (drive-pass suppression only — **not a chain stop**), while reporting proceeds; **(c)** else → HOLD, preserve evidence, escalate; no act. A verified trigger is never "waited out." |
| W-4 | Log; report to Julie immediately; file for Rowan's disposition; continue hourly. No act: no stop (no trigger), no second stimulus (the single Part D stimulus, if used, is spent; a natural wake needs none), no re-send of anything. |
| WINDOW-FAILED (§3.2) | Declaration logged and reported immediately; posture hold; resumption only on Rowan's ruling + fresh Julie authorization. |

**S1-X triggers (carried from gates v4,
unchanged):** (T1) grant activity beyond the §7.3
set; (T2) any dispatch while GENERATION_HALT is
`"1"`; (T3) phase/quota movement beyond the §7.3
predictions in any amount not in the set; (T4) a
second grant, a second plan/job movement, or any
conflicts/watermark/parked movement outside the set.

**Evidence standard for a verified trigger (V4-4
(c)) — carried at full strength, verbatim in
effect:** the observation was made by a scheduled
§3.1 read; the raw observed values and timestamps
are written into the window log **before** the stop
act fires; the movement is outside the §7.3 set
under the window's classification standard; **where
paired surfaces disagree, or a value cannot be
freshly read, the trigger is NOT verified** — the
response is the W-3u row, never the stop. An
impression, an unrecorded observation, or a single
uncorroborated surface reading never arms S1-X.

**S1-X budget when fired (carried):** exactly one
`stop_chain` act + `verify_chain_stop` attempts
within the episode bound (≤3 total). State writes
≤4, audit rows ≤5, `deleteAlarm` ≤3, `setAlarm` 0,
commands 0, all else 0. Ends HELD in CHAIN_STOPPED;
immediate report with the trigger, the firing
reads, and the stop record incl. `stopConfidence`.
If the episode exhausts unverified, S1-X is spent
and further verification is **R3-V territory**
(fresh Rowan ruling + Julie authorization) — not a
window act, not a tail act, and never effected by
clearing CHAIN_STOPPED (§4.3, RS-5).

**Layer-1 `contain_drive` (Part (B2)):** one
application (+1 state write, +1 audit row) on
out-of-set movement, natural or deliberate event
(Item E), to bound drive accumulation while
classification and reporting proceed. It suppresses
future drive passes; **it does not stop the alarm
chain** — registrations continue and grant/void
churn continues between suppressed passes, and if
the window closes with `contain_drive` applied and
no stop, the chain stands DRIVE_CONTAINED, not
stopped (§3.7 carries this state by name). If S1-X
later fires, the stop proceeds from DRIVE_CONTAINED
(a legal transition). If (B2) is struck, the
W-3u/W-3 responses are report + (a)/(c) only.

**Continuing-effect honesty (correction 6,
carried and extended by RS-1):** absent a verified
stop, a revived chain continues its ~10-minute
passes and §7.3 churn **beyond window close** — the
window bounds observation, not the chain. §3.7 —
not the closing certification alone — now owns
that interval by name.

### 3.5 W-1f (future re-base) at window close — unchanged

If the event stands at W-1f at close (registration
re-based to a future D, D not yet arrived): the
window record records **WAKE OBSERVED — DELIVERY
PENDING AT <D>** with D a known observed value.
Not a completed S1 disposition (§4.3): C3 does not
start until Rowan dispositions the W-1f end-state.
One addition under RS-1: between close and Rowan's
disposition, the §3.7 regime (no-event branch,
cadence as there defined, with the known D as a
named observation point — a check is scheduled at
D itself) owns the interval; delivery at D inside
that regime is classified on its observed values
and escalated immediately, and it does not convert
the W-1f record into a disposition by itself.

### 3.6 S1-X operational coverage and expiry consequences (Item B — corrected)

The prior binding named a period ("armed only
during the window") without defining what coverage
means at its edges. The corrected law:

**Coverage.** S1-X covers a trigger when **all**
of the following hold: (1) the trigger's verifying
observations are made by scheduled §3.1 checks
**performed before window expiry** (expiry = the
closing census's scheduled time, +72 h from window
open; the closing census itself is an in-window
check); (2) the paired surfaces agree and every
needed value was freshly read (§3.4 standard); (3)
the raw values and timestamps are **written into
the window log before expiry**; (4) the firing
decision is **recorded in the log before expiry**.
Coverage attaches to the **decision on complete
in-window evidence**, not to the wall-clock moment
the stop act's request happens to land.

**Cases:**

- **(i) Firing decision complete before expiry;
  act lands after.** The `stop_chain` act (and its
  in-bound verifies) may execute after expiry as
  the completion of an in-window firing. The
  authorization covers the act, not merely the
  decision. The window record and the S1-X report
  record both timestamps (decision; act) and the
  straddle expressly.
- **(ii) Evidence incomplete at expiry.** A needed
  corroborating read is outstanding, paired
  surfaces disagree, or a W-3u stands unresolved at
  the closing census: the trigger is **NOT
  verified at expiry**. The candidate is
  dispositioned **UNRESOLVED-AT-EXPIRY** in the
  window record, escalated to Rowan with the raw
  values. **S1-X does not fire.** Any later stop
  requires a fresh authorization (an at-trigger
  S1-X grant, Rowan ruling + Julie GO) or proceeds
  as C3's stop act if §4.3 eligibility is otherwise
  met by Rowan's express disposition of this
  record.
- **(iii) Expiry mid-verification** — verification
  begun in-window, incomplete at expiry — **is
  case (ii)** by definition. There is no
  "substantially verified" state.
- **(iv) After expiry, S1-X is DEAD.** Fired or
  unfired, spent or unspent: no carry-over to any
  later window, package, gate, or the §3.7 tail.
  A later chain stop needs its own authorization.
  Renewal of observation (§3.7) never revives S1-X;
  a new standing authorization would be a fresh
  binding under a fresh ruling + grant.
- **(v) An event first observed after expiry** is
  not an S1 event and cannot be retroactively
  covered: it is observed under the §3.7 regime,
  classified on its values, and escalated; its
  disposition is Rowan's (or C3's, per §4.3's
  post-window form) — never S1-X's.

**In-flight decisions at expiry, stated plainly:**
the only in-flight state the authorization
recognizes is case (i) — a decision fully made and
logged on complete evidence before expiry. Every
other in-flight state collapses to case (ii) at
expiry. The executor does not race the clock: a
verification that cannot complete on performed
checks before expiry is reported as incomplete,
not hurried.

### 3.7 Post-window ownership regime (RS-1 — no silent unowned interval)

Window expiry changes the regime; it never ends
ownership. Every post-window interval has a named
**owner** (Wren), a named **cadence**, and a named
**next decision**. The regime is authorized as the
**tail of Part B** (§6.2): read-only §3.1 checks,
logged to the **post-window log** (appended to the
window record's evidence), under the same
logging/coverage discipline as §3.2 (a tail check
with no log entry is missed; gaps are named
unobserved intervals in the tail log and reported
on detection). The tail runs from the closing
census until the **earliest** of: C3's execution
under its own GO; a fresh Rowan disposition that
supersedes the regime; or **14 days** after window
close — at which point, if none of the former has
occurred, Wren files the tail record for Rowan's
ruling and the regime **renews only on her ruling**
(it does not lapse into unownership: the filing
itself is the owned act, and checks continue at
the tail cadence pending her ruling, reported as
such).

**Branch 1 — REVIVED-UNSTOPPED / OWNED.** The
window closed with the chain live (W-2 continuing;
no verified trigger fired S1-X; whether or not
`contain_drive` was applied — if applied, the
state is DRIVE_CONTAINED under a live registration
and the tail log says so: drive suppressed, chain
**not** stopped). Cadence: **one logged check
daily**, plus an immediate check on any
Julie-visible anomaly report. Classification
continues against the churn invariants; any
out-of-set observation is escalated the same day
(a verified trigger in the tail is **not** S1-X's
to answer — S1-X is dead, §3.6 (iv) — it goes to
Rowan + Julie for a fresh at-trigger authorization
or is carried into C3's preflight as its
classification input). **Next decision:** C3,
whose stop act is the authorized stop vehicle for
this state (§4.3, form EXPECTED-REVIVED
(POST-WINDOW)); or a fresh chain-stop authorization
if Rowan/Julie choose to stop sooner. The state is
carried **by name** — REVIVED-UNSTOPPED / OWNED —
in every subsequent report, filing, and census
until it changes. Bounded in effect ($0, no
dispatch, delivery fenced), unbounded in duration,
and owned for exactly that duration.

**Branch 2 — DEPLOYED-STALE / OWNED (no event).**
The window closed W-0/W-1f-free with no wake
observed (Grant 2 never granted, or granted and
unexercised — Variant D's stimulus never sent), or
stands W-1f-pending: the composed semantic is
live, the stale (or re-based) registration sits in
place, and a wake is still expected eventually.
Cadence: **one logged check weekly**, plus a check
at any known pending D (§3.5). A wake observed in
this branch is escalated **immediately**: the S1
event has arrived unowned by any window, C3 is
blocked, and Rowan dispositions it (a fresh window,
a revised S1, or a C3 package that owns the event)
— the tail never classifies it into a disposition
by itself. **Next decision:** Grant 2 under a
fresh window authorization, or Rowan's revised
disposition, or C3 sequencing as she rules. Named
in every subsequent report as DEPLOYED-STALE /
OWNED until it changes.

**Branch 3 — STOPPED.** S1-X fired and verified,
or its episode stands exhausted/unverified: the
tail's object is the stop record, not a chain.
Cadence: daily checks until C3's preflight opens
or R3-V is authorized, verifying the registration
stays absent and `stopConfidence` as freshly read.
**Next decision:** §4.3's eligibility path
(VERIFIED → C3; EXHAUSTED/UNVERIFIED → R3-V
first). Named as STOPPED-BY-S1X-VERIFIED or
STOPPED-BY-S1X-UNVERIFIED in every report, per
§4.3's distinction.

In every branch the invariant is the one RS-1
states: **no silent unowned interval** — expiry,
failure, and delay all change the regime's terms,
never its existence.

---

## 4. R5AD-3 — Boundary reconciliation (C3 dependency refined per RS-5)

### 4.1 Boundary map

| Scope | Owns | Begins | Ends | Explicitly does NOT include |
|---|---|---|---|---|
| **R5a-D** | The deployment: census, assembly, battery, one upload, verification | Julie's Grant 1 (Part A), recorded before census | Rowan's acceptance of the execution record (**CLOSED**) | Any wake, command, transition, or the event. Its close never depends on the wake |
| **S1 (this sequence)** | The first-wake **event**: the window, detection, classification, disposition (§§2–3), and the §3.7 post-window regime until its tail exit | Window open = the upload's D2 read-back completion | Window close + Rowan's review of the window record; the §3.7 tail then runs to its own named exit | The deployment; the stop (S1-X's, or C3's); any generation. The fallback stimulus is **not** S1's to self-grant — it is Julie's Grant 2 (§6.3) |
| **S1-X** | The emergency chain stop, if a verified T1–T4 trigger is covered under §3.6 | Armed at window open (Grant 1 Part C) | Fired (once), spent, or **DEAD at window expiry** (§3.6 (iv)) | The event itself; any second firing; any use outside this window and pin; any post-expiry coverage |
| **C3** | Operational containment verification against the composed build: the mechanics pair + the physical stop act, PARTIAL verdict | Its own revised readiness + its own Julie GO, after §4.3's eligibility is met | CHAIN_STOPPED/verified (or STOPPED-unverified), record accepted | The first-wake event (dispositioned before it starts, or owned under §3.7 Branch 1 with C3 as its stop vehicle); restoration; any stimulus |
| **Standalone restoration** | CHAIN_STOPPED → NORMAL, once, on its own authorization (fresh census + demonstrated reason + episode disclosure + **historical audit review**, gates v4 text unchanged) | After C3, on Rowan's review of C3's record and Julie's separate GO | NORMAL, registration still absent, episode closed | Re-arming; any verification work (R3-V's); any place inside Grant 1, Grant 2, or C3's GO |
| **R3-V** | Post-exhaustion verification continuation, per exhausted episode (gates v4 text unchanged) | A Rowan ruling on an exhaustion record + Julie's authorization | One new episode's stop attempts, bounded as pinned | Any informal retry; any reset via `clear`; any scope beyond the named episode; any substitution by C3 |

No scope's authorization includes another scope.
Grant 1 contains three named parts for two scopes
(R5a-D; S1 incl. its S1-X companion) because Option
(ii) forbids separating them in time; Grant 2 is a
later, separate decision for the single fallback
act (RS-3). Parts remain individually strikable in
drafting, under §6.1's dependency law.

### 4.2 State sequence (holds invariant throughout)

| State | Description | Reached by |
|---|---|---|
| **S-0 HELD-STALE** (today) | C1 build live; containment NORMAL/inert; stale registration 1793562576104 in place; chain not delivering (causation unproven, R-09) | — |
| **S-1 HELD-DEPLOYED-STALE** | Composed build live and verified; semantic armed; no wake yet; window running | R5a-D upload + read-back |
| **S-1n HELD-DEPLOYED-STALE, TESTED** | As S-1, but the Grant-2 stimulus has evaluated the wake with **no observed revival** within the tested window, subject to recorder limitations; coverage verified (§3.2) | Grant-2 stimulus + clean observation to close |
| **S-2 HELD-REVIVED-CHURNING** | Chain live: ~10-min passes, §7.3 churn, recorder rows accruing; dispatched 0, $0; event dispositioned EXPECTED | W-2 inside the window |
| **S-2p REVIVED-UNSTOPPED / OWNED** | As S-2 at and after window close: chain live, S1-X expired, §3.7 Branch 1 owns the interval; C3 is the standing stop vehicle | Window close over S-2 |
| **S-2s DEPLOYED-STALE / OWNED** | As S-1 at and after window close with no event: semantic live, registration in place, §3.7 Branch 2 owns the interval | Window close over S-1 |
| **S-2x HELD-STOPPED-BY-S1X** | S1-X fired on a covered verified trigger: CHAIN_STOPPED — **VERIFIED** or **EXHAUSTED/UNVERIFIED** as the stop record + fresh reads establish (§4.3) | W-3 + covered verified T1–T4 |
| **S-WF WINDOW-FAILED** | Coverage failure declared under §3.2: event undispositioned; C3 blocked; resumption only on Rowan's ruling + fresh authorization | §3.2 decision rule |
| **S-3 HELD-CHAIN_STOPPED/VERIFIED** | C3's stop act performed and verified against the then-current registration | C3 (its own GO) |
| **S-4 HELD-NORMAL, REGISTRATION ABSENT** | Restoration's clear executed; episode closed; no registration in place | Standalone restoration (its own GO) |

From S-4, the first subsequent wake arms a **fresh**
registration by the ordinary rules — S-0's stale
condition does not recur from the restoration
itself. What follows S-4 is outside this proposal.

### 4.3 C3 dependency and eligibility (RS-5)

**Dependency (settled — Item C; refined by RS-5):**
C3's preflight may open only when **all** hold:

1. R5a-D is CLOSED (Rowan's execution acceptance) —
   unchanged.
2. The S1 event stands **dispositioned** in exactly
   one of the **eligible forms** in the table
   below, on the window record (and, where named,
   the tail log) as reviewed by Rowan.
3. Rowan has reviewed the window record.

| S1 disposition form | System state | C3 eligible? | C3's shape on this basis |
|---|---|---|---|
| **EXPECTED-REVIVED** | S-2 (window closed over a live chain, or the chain stopped since by a separate authorized act Rowan has accepted) | **Yes** | Stop act targets a **live chain**. `armedAt` expectation changes **form**: fixed value → **consistency expectation** (the value read at C3-0, identical across paired reads, recorded as `stopArmedBefore`). Baselines = the window closing census (churn state). Ledger/budget unchanged; passes may occur during C3 within the churn invariants (outside = C3 STOP); the C3-1 `contain_drive` leg gains live meaning — drive suppression only; **not a chain stop** and not staged evidence; verdict remains **PARTIAL** unless Rowan rules otherwise on C3's record |
| **EXPECTED-REVIVED (POST-WINDOW)** | S-2p (REVIVED-UNSTOPPED / OWNED under §3.7 Branch 1) | **Yes** | As EXPECTED-REVIVED, with baselines = the tail log's latest completed check and the tail record as evidence. C3 is this state's standing stop vehicle — its stop act needs no further S1-side disposition |
| **NEGATIVE** | S-1n | **Yes** | Stop act targets the stale registration exactly as C3's current package designs. Census adopts the window closing census (`armedAt` = its recorded stimulus-observed value; recorder as observed). Requires **verified coverage** (§3.2): gapped coverage makes NEGATIVE unavailable unless Rowan dispositions the gaps expressly |
| **STOPPED-BY-S1X-VERIFIED** | S-2x, stop record's physical verification stands: last successful verification recorded **and** current physical confidence `verified` on fresh corroborating reads (`getAlarm()` null) at the C3 preflight census — recorded completion alone is never physical proof (V4-2 discipline) | **Yes** | The physical stop is **not re-performed**. C3 re-scopes (its revised package, Rowan's ruling) to verification of the existing stop record against fresh reads plus the mechanics legs that remain meaningful |
| **STOPPED-BY-S1X-EXHAUSTED/UNVERIFIED** | S-2x, episode EXHAUSTED (attempts = 3, durable flag + audit event) or verification failed/unresolved | **NO — not a disposition for C3** | **R3-V first**: further verification runs only under the R3-V micro-scope (fresh Rowan ruling + Julie authorization, per exhausted episode, historical audit review required — never the `prevEpisode*` summary alone). C3's dependency leg (2) is met on this branch only when R3-V has resolved the episode to verified, or Rowan expressly dispositions the exhaustion record otherwise. **Clearing CHAIN_STOPPED is not a retry reset and never substitutes for R3-V** (design paperwork rule; an exhausted episode may not be circumvented by clear + re-stop) |
| **UNRESOLVED-AT-EXPIRY** (§3.6 (ii)) | A trigger candidate stood unverified at expiry | **No** | Rowan dispositions the record (fresh at-trigger authorization, or an express ruling feeding one of the forms above); C3 blocked meanwhile |
| **W-1f-pending** (§3.5) | Registration re-based to a known future D | **No** | Rowan dispositions the end-state (observation extended to D under fresh authorization, or C3 re-derived against the future registration); §3.7 Branch 2 owns the interval meanwhile |
| **W-4 undispositioned** | Wake observed, delivery not observed | **No** | Rowan's disposition required; hourly/tail observation continues meanwhile |
| **WINDOW-FAILED** (§3.2) | Coverage failure declared | **No** | Rowan's ruling + fresh Julie authorization before any onward step |
| **No event; no disposition** (incl. S-2s standing alone) | DEPLOYED-STALE / OWNED | **No** | §3.7 Branch 2's next decisions govern (Grant 2 under a fresh window, Rowan's revised disposition, or C3 sequencing as she rules) |

**Build/etag expectations** re-base to the composed
production build (its build pin and etag as verified
at R5a-D close) in every eligible branch — Rowan's
standing instruction, unchanged. C3's own revised
package owns the per-branch census documents; this
proposal fixes the eligibility law it must implement.

### 4.4 What does not move

The standalone restoration's authorization shape,
preconditions (including the V4-1 historical audit
review), budget, and GO text are **unchanged**;
reachable only after C3, on its own decision. R3-V
is **unchanged** — and RS-5 re-anchors it here: it
is the **exclusive** post-exhaustion path, for
S1-X episodes exactly as for C3 episodes. The
Phase B preserved plan and idx-26 exemption are
untouched by every stage: the §7.3 grant the event
issues against the preserved plan is a system
effect of the wake under the holds (pre-classified,
accepted), not an operator act on the plan; no
stage retires, releases, revokes, or resubmits
anything.

---

## 5. Carried forward unchanged (accepted basis)

From the R5a-D readiness package (pin
`74b7120ee7073ba2df3544a98991819a89cf0420`), **without
alteration**: candidate identity on both bases
(coordinator `5303cb63…`, +66/−36 vs the live C1
build; entry `2bb0608b…` and service `5c5183e6…`
byte-identical to live; deployed delta at gate time
= coordinator + re-stamped identity, 29/31
identical); gate-time assembly, build pin, and
stamp; the 16-item fresh census (the window-open
baseline of §3.1 is its closing repeat, not a new
census); mutation bounds and triggers T1–T6 (with
the DV-4 disposition refinement for T5/T6 only);
the class A / class B rollback classification and
safety conditions (the T5/T6 wake signature remains
class B for rollback purposes in every branch: **no
rollback answers a wake**); observability procedure;
V1–V8 verification at C1-2 claim strength (script
deployment verified, runtime adoption NOT claimed);
battery requirements and standing results
(containment 42/42, R5a 23/23, P2 32/32, exit 0 on
the composed tree; gate-time re-run required); STOP
conditions; unresolved risks (register at corrected
strength, incl. R-02/R-03/R-04/R-05/R-06/R-09/R-11/
R-12/R-13 and RD-R1..R3 — RD-R1's governance gap is
what this sequence closes; its consequence set is
unchanged). From gates v4 REVISED: the containment
design's stop/verify/episode law (bound 3,
exhaustion = STOP, clear ≠ retry reset), §R's
recorded-vs-physical discipline, S1's stimulus
identity and mandated negative wording, S1-X's
triggers and budget, the V4-4 binding conditions as
corrected by §3.6, the standalone restoration, and
R3-V. Candidate code is untouched by this proposal;
no battery re-run is proposed or needed for
paperwork.

---

## 6. Authorization proposal (RS-3: Grant 1 = A+B+C; Grant 2 = D, separate)

### 6.1 Dependency law

Two Julie decisions, at two different times.

**Grant 1** is one decision containing three
separately named parts — (A) R5a-D execution, (B)
window arrangements, (C) S1-X standing chain stop.
The dependency is hard and stated as law, not
preference: **Part (A) requires Parts (B) and (C).
(A) is void unless (B) and (C) are granted with
it.** Granting (B) and/or (C) without (A) records
the arrangements as approved in principle and arms
nothing (the window is defined by (A)'s upload;
there is nothing to observe and nothing to stand
by for) — but (A) may never be granted, recorded,
or executed alone: a deployment whose first-wake
consequence has no observation arrangements (B) or
no verified-trigger stop standing by (C) is Option
(i) under another name, and this proposal does not
draft it. Part (B2) (Layer-1 `contain_drive`, a
drive-pass suppressor — **not a chain stop**) may
be struck from (B) independently; the W-3u/W-3
responses then narrow to report + S1-X/escalate.

**Grant 2** is Part (D), the fallback stimulus —
**conditional and separately authorized** under
Variant D as Rowan conditioned it (Item A). It is
not a part of Grant 1, not implied by it, and not
automatic at +24 h. Its authorization moment,
preflight, and lapse are §6.3.

Both grants are revocable by Julie at any time
before the act they authorize is performed (Grant
1 before the upload; Part (C) additionally at any
time before it fires; Grant 2 before the stimulus
is sent).

### 6.2 Grant 1 — draft GO text (Parts A + B + C)

**Part (A) — R5a-D execution** (the readiness
package's bounds; no acceptance paragraph — the
consequence is governed, §6.1):

> "GO — execute exactly one Gate R5a-D attempt as
> pinned in the R5a-D readiness package (pin
> `74b7120ee7073ba2df3544a98991819a89cf0420`) as
> sequenced by the R5a-D/S1 sequencing proposal,
> REVISED (pin `<PIN — inserted at filing>`): fresh
> census, battery re-run (containment 42 + R5a 23 +
> P2 32) on the gate-assembled composed tree, build
> pin, exactly one upload of the composed candidate
> (coordinator `5303cb63…`; entry `2bb0608b…` and
> service `5c5183e6…` byte-identical to the live C1
> build) to `opalreader-api-v2-prod`, at most one
> conditional observability PATCH, and — ONLY for a
> confirmed deployment defect (class A) and ONLY
> after the package's rollback-safety conditions
> are all verified — conditionally one rollback
> upload of the preserved C1 build `27b2b3a9…`
> parts plus at most one conditional PATCH; any
> external or causally unresolved movement (class
> B, including a wake signature) authorizes NO
> rollback under this GO — the response is HOLD,
> preserve evidence, and escalate; passive reads
> only; NO containment transition, NO command, NO
> wake or stimulus **by the executor**, NO hold or
> queue change; ending HELD with containment inert
> at NORMAL. The first-wake consequence of this
> deploy is governed by parts (B) and (C) of this
> same grant and by the post-window regime of §3.7
> of that proposal. **This part is void unless
> parts (B) and (C) are granted with it.**"

**Part (B) — S1 observation window, monitoring,
and post-window tail (incl. B2):**

> "GO — S1 observation window and post-window
> regime: from the completion of the R5a-D upload's
> read-back, for 72 hours, Wren will perform the
> read-only observation checks of §§3.1–3.2 of the
> REVISED sequencing proposal (pin `<PIN>`) at its
> stated cadence — agent-executed check-ins, each
> logged with its raw values at execution time in
> the window log (a check with no log entry counts
> as missed), coverage accounted as verified vs
> unobserved intervals, missed/failed checks and
> the WINDOW-FAILED rule applied as written —
> reporting any classification other than W-0, any
> bound-breaching gap, and any declaration to me
> immediately, and filing the window record at
> close. From window close, Wren will continue the
> post-window ownership regime of §3.7 of that
> proposal (daily logged checks in the
> revived-unstopped and stopped branches; weekly
> in the deployed-stale branch) until C3 executes,
> Rowan supersedes the regime, or the 14-day tail
> record is filed. Reads only: no command, no
> stimulus (the fallback stimulus is not in this
> grant), no transition except part (B2). **(B2)**
> Layer-1 contingency: on movement outside the
> §7.3 pre-classified set that is unverified, or
> verified but not an S1-X trigger, Wren may apply
> `contain_drive` exactly once (+1 state write, +1
> audit row), reporting immediately; I understand
> `contain_drive` bounds drive passes but **does
> not stop the alarm chain**."

**Part (C) — S1-X standing conditional
authorization (re-bound to this proposal and this
window; coverage and expiry per §3.6):**

> "GO — standing conditional authorization for
> Gate S1-X under the R5a-D/S1 sequencing proposal,
> REVISED, pin `<PIN — inserted at filing>`, armed
> only during the single S1 observation window
> defined there (from the R5a-D upload's read-back
> completion to the window's closing census at
> +72 hours), and covering exactly the §3.6 cases
> of that proposal: if any S1-X trigger (T1–T4, as
> carried in §3.4) is observed at a scheduled
> window check AND verified to the proposal's
> evidence standard (scheduled reads; raw values
> and timestamps recorded in the window log before
> firing; paired surfaces in agreement; movement
> outside the §7.3 pre-classified set) AND the
> firing decision is recorded in the window log
> before window expiry, execute exactly one
> `stop_chain` with in-bound `verify_chain_stop`
> attempts (≤3), report immediately, and end HELD
> in CHAIN_STOPPED. A firing decision completed on
> complete in-window evidence is covered even if
> the act lands after expiry; evidence incomplete
> at expiry is not verified, does not fire, and is
> dispositioned UNRESOLVED-AT-EXPIRY. This
> authorization is single-use, **expires at window
> close whether or not it fires and is thereafter
> DEAD** — it carries over to no other window,
> package, gate, or the post-window tail — is
> revocable by me at any time before it fires,
> covers no other act, and does not extend part
> (A)'s GO."

### 6.3 Grant 2 — Part (D), the fallback stimulus (separate authorization)

**Authorization moment.** At the +24-hour scheduled
check, if no natural wake has been observed, Wren
performs the **Part D preflight** and reports it to
Julie. The preflight is **clean** only if all hold
on fresh reads at that moment: (1) every scheduled
check from window open to +24 h is logged and
completed — no missed or failed check outstanding
(unobserved intervals, if any, are named in the
report and make the preflight **not clean** unless
Rowan has expressly accepted them); (2) the current
classification is W-0 on completed reads; (3) the
recorder baseline is re-read (table state, rows,
`recorderHealth`) and matches the window-open
baseline in substance; (4) the stimulus target
`alarm-wake-probe:nonexistent` is re-verified
nonexistent on fresh reads; (5) the holds verify
(HALT `"1"`, queue paused, containment NORMAL).
**If the preflight is not clean, Grant 2 may not
be requested or granted** until the anomaly is
dispositioned (by classification completing,
Rowan's ruling, or a renewed preflight on a later
check that Rowan accepts as the D point for this
window — the +24 h point moves only by her ruling,
never by the executor's convenience).

**Draft GO text (Grant 2 — given separately, at or
before the +24 h read, on the clean preflight
report):**

> "GO — S1 fallback stimulus (single use): on the
> clean Part D preflight reported to me at the
> +24-hour window check under the R5a-D/S1
> sequencing proposal, REVISED (pin `<PIN>`), Wren
> may send exactly one `RequestPause` command with
> a fresh `command_id` (generated and recorded
> before sending) targeting the reserved
> nonexistent job `alarm-wake-probe:nonexistent`.
> Expected response: `rejected` / `job_not_found`.
> NO re-send under any circumstance — an ambiguous
> response is a STOP-and-classify event.
> Post-stimulus reads follow §3.2's cadence. A
> no-revival outcome is reported only as 'no
> observed revival within the tested window,
> subject to recorder limitations.' This grant
> expires unexercised if not given by the +24-hour
> check or, on a renewed-preflight ruling, at the
> point Rowan names; it authorizes no other act."

**Lapse.** Grant 2 ungiven by its point lapses for
this window; the window continues on natural
traffic and §3.7 Branch 2 owns the tail. A later
stimulus is a fresh Grant 2 under a fresh window
authorization — never a revival of this one.

### 6.4 What the grants spend (worst case)

R5a-D — 1 upload (+ ≤1 conditional PATCH; + ≤1
class-A rollback upload and ≤1 conditional PATCH);
window + tail — reads, 0 writes; (B2) ≤1 state
write + ≤1 audit row; (C) if fired: state writes
≤4, audit rows ≤5, `deleteAlarm` ≤3, `setAlarm` 0;
(D) if granted and used: 1 commands row, `setAlarm`
≤1 from the stimulus's own wake evaluation, plus
per-pass `finally` registrations only if passes
are delivered (system behavior, classified — not
operator stimuli). Plus the event's own §7.3
system effects (consequences under the holds, not
operator writes). Spend **$0** in every branch
while the holds stand.

### 6.5 NOT authorized by either grant, in any combination

C3 (any part of it); the standalone restoration;
R3-V (incl. any post-exhaustion verification for
an S1-X episode); a second stimulus; a second S1-X
firing; any S1-X act after window expiry other
than §3.6 case (i)'s completion; window renewal or
extension; the §3.7 tail beyond its named exit; any
SubmitJob or generation; any hold flip or queue
change; any rollback for a class-B finding; any
command other than Grant 2's one; any containment
transition other than (B2)'s single `contain_drive`
and (C)'s single `stop_chain` with its in-bound
verifies.

---

## 7. Ruling items for Rowan

Settled by the sequencing ruling and **not**
re-presented: **Item A** (Variant D, conditional —
implemented as Grant 2, §6.3), **Item C** (DV-2
supersession + two-part C3 dependency — accepted;
§4.3's refinement under RS-5 is noted there, not
re-opened), **Item E** (Layer-1 retained, optional,
single-use, not-a-chain-stop discipline applied).

Confirmation requested on the corrections:

- **Item B′ — S1-X coverage/expiry law (§3.6).**
  Confirm the corrected form: coverage attaches to
  a firing decision recorded before expiry on
  complete in-window evidence (case (i) act may
  land after expiry); incomplete-at-expiry is
  UNRESOLVED-AT-EXPIRY and never fires (cases
  (ii)/(iii)); after expiry S1-X is DEAD (iv);
  post-expiry events are never retroactively
  covered (v). Or amend.
- **Item D′ — Monitoring and post-window
  parameters.** Confirm or amend: the §3.2 cadence
  and gap bounds (2× interval), the WINDOW-FAILED
  rule and its effects, the §3.7 tail cadences
  (daily / weekly) and the 14-day tail-record
  point, and §3.5's check at a known pending D.

No other decisions are outstanding from this
proposal. If B′ and D′ are confirmed, the proposal
stands ready for Julie's Grant 1 decision (Stage
1) — which this document does not request.

---

## 8. Package contents and turn

This revised proposal is a single consolidated
document, pinned with the ruling record
(`ROWAN-R5AD-S1-SEQUENCING-RULING.md`) and the
companion cp
(`PHASEB-R5AD-S1-SEQUENCING-REVISED-ROWAN-CP.md`).
It supersedes `PHASEB-R5AD-S1-SEQUENCING-PROPOSAL.md`
(pin `5325cb56c9741ce0318d1a1e53ea5e141dcfa3a5`) as
the operative sequencing proposal; the superseded
text remains in the archive. The documents carried
forward in §5 are cited by pin and hash and remain
in the GitHub archive; the Dropbox review folder
carries this revised proposal and its cp only (plus
the standing instructions file), per the rotation.

**Production remains under INVESTIGATION HOLD.
Nothing in this proposal deploys, transitions,
wakes, stimulates, or mutates anything, and no GO
is requested by it. Turn: Rowan's — review of this
corrected sequencing/readiness proposal, including
confirmation Items B′ and D′ (§7).**
