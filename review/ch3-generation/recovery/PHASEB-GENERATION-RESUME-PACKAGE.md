# Phase B — GENERATION-RESUME gate readiness package: ONE resume of the preserved plan for the final Chapter 3 segment (idx 26)

**PRE-DRAFT — READINESS ONLY. This package authorizes nothing, requests
no GO, and was written with ZERO production calls of any kind (not even
reads). Every production value quoted below is cited from the records
named in §11 and is labeled the OPENING BASELINE: the execution census
in §4 is taken fresh at gate time and supersedes anything quoted here.**

- **Prepared:** Nov 3, 2026, during the live S1 observation window, at
  Julie's direction ("prep the generation-resume package now" — her
  instruction in the Coding Projects chat, Nov 3, 2026), so that
  Rowan's readiness review can begin **before** C3 executes and the
  gate can move the moment its dependencies land. Pre-drafting changes
  no dependency: execution remains fully gated behind the S1
  disposition + Rowan's review of it, C3 execution and closure, the
  standalone restoration, Rowan's PASS on this package, and Julie's
  separate explicit GO for this gate (§0).
- **Production state at writing:** INVESTIGATION HELD; generation
  HALTED; queue PAUSED; S1 window OPEN (opened 2026-11-02T23:28:41Z,
  closes 2026-11-05T23:28:41Z). No S1 disposition exists yet; C3 has
  not executed; no restoration has been authorized or performed.
- **NO SPOILERS:** this package carries structural metadata and
  digests only. No segment text is read, printed, or quoted anywhere
  in it.

---

## 0. Dependency state — what stands between this package and an execution

This gate may open only when **all** of the following hold. Each leg
is separate; none is bundled into another's authorization, and no
leg's satisfaction is inferred from another's.

1. **An eligible S1 disposition exists and Rowan has reviewed the
   window (and, where applicable, tail) record.** The eligible forms
   are C3's (§4 of the rebased C3 package, pin `46112a03…` as amended
   by `aba681a0…`): EXPECTED-REVIVED; EXPECTED-REVIVED (POST-WINDOW);
   NEGATIVE with verified coverage; STOPPED-BY-S1X-VERIFIED. A
   blocker state (WINDOW-FAILED, W-4 unresolved,
   UNRESOLVED-AT-EXPIRY, STOPPED-BY-S1X-EXHAUSTED/UNVERIFIED without
   an R3-V disposition) leaves this gate closed until Rowan rules
   otherwise. — **OPEN** (window live at writing).
2. **C3 has EXECUTED and CLOSED under its own GO, ending
   CHAIN_STOPPED / verified.** C3's four branches all end there on
   their no-failure paths — (a)/(b)/(d) by C3's own stop act, (c) by
   verified corroboration of S1-X's stop. A C3 execution ending
   STOP_UNVERIFIED, or stopped at a premise failure (C-PF1..C-PF4),
   or never executed, does **not** satisfy this leg: this package may
   not open, and the state returns to Rowan (R3-V or a fresh ruling)
   before anything here is rebased. — **OPEN.**
3. **The standalone RESTORATION has been authorized, executed, and
   closed under its own separate authorization** (Rowan ruling +
   Julie GO + fresh census at its start + recorded reason in the
   `clear` audit event + the mandatory historical audit review of the
   full append-only `d6_containment_events` history, per gates v4
   REVISED and C3 §2), ending with containment **NORMAL** and the
   system otherwise HELD (GENERATION_HALT `"1"`, queue paused).
   **Restoration is a PRECONDITION of this gate, never a step inside
   it.** This package contains no `clear`, no containment transition
   of any kind, and no budget for one (§3, §10). If the restoration's
   closing state differs from the opening-baseline form §4 expects,
   this package stops and is rebased — the executor never adapts it.
   — **OPEN.**
4. **Rowan's PASS on this package** (readiness), including her ruling
   on the open questions in §9 — at minimum **OQ-1** (the wake slot,
   §5 step GR-2) in all cases, and **OQ-2** additionally if the
   executing branch is GR-B (§4.2). — **OPEN** (this filing requests
   exactly this review).
5. **Julie's separate explicit GO for THIS gate**, in the
   branch-aware wording of §6, recorded before the execution census.
   — **OPEN** (not requested by this filing).

**Execution-census supremacy:** the census in §4 is executed fresh
after legs 1–5 are satisfied, and its reads — not any value quoted in
this package — are the gate's preflight facts. Between package time
and gate time the state **will** move, by design: the window will
disposition, C3 will stop the chain, the restoration will clear it.
That movement is what selects this package's branch (§4.1/§4.2), and
the branched census is written to expect exactly it. Movement outside
every branch's expectations is a §7 STOP — the executor never
rationalizes a difference (executor STOP law).

---

## 1. Purpose and scope — exactly one resume, of exactly one plan, for exactly one segment

This gate exists to do one thing: **lift the two holds once, under
observation, and let the PRESERVED Phase B plan generate its single
remaining segment** — the final segment of *Forever Pucked* Chapter 3:

- Plan: `plan:19cad189fab54b9c804a74a6` (segment scope, lane standard,
  phase `forever-pucked`), created by the single SubmitJob of Phase B
  attempt 3 (2026-11-02T01:23:15Z) and preserved untouched since its
  §7.3 stall.
- Job: `plan:19cad189fab54b9c804a74a6:seg`.
- Single entry: chapterIndex 2, idx 26, occurrence
  `2a85f74f-353d-4c25-a86a-4a4db392868b`, 569 chars, recorded cast
  voice Alex → Gemini Charon, live quote **8,022 units ≈ $0.008**,
  covered by the live idx-26 chapter exemption (applied in attempt 3,
  preserved, never revoked).

### 1.1 HARD LAW — resume rides the preserved plan; there is no resubmission

**No SubmitJob — of any scope, under any wording — is sent in this
gate, and no second intent for idx 26 is ever created by it.** This is
not a preference; it is the diagnostic's containment finding
(`PHASEB-STALL-DIAGNOSTIC-REPORT.md` §6): the preserved plan is a
**live trigger** — with the halt lifted and the queue unpaused, the
drive path picks this plan up with no further command, submission, or
approval touchpoint in code, because it is the only selectable plan.
A second SubmitJob would create a **duplicate plan** for the same
occurrence: two plans competing for one occupancy key and one phase
budget, with the duplicate's existence corrupting every exclusivity
argument this gate's verification protocol (§2) rests on. Rowan's
standing disposition of attempt 3 is the same: preserve the plan and
the exemption; resume rides **this** plan. The ledger (§3) therefore
carries a SubmitJob budget of **ZERO**, and any execution step that
appears to require one is a §7 STOP by definition.

### 1.2 What this gate is not

No other generation of any kind: no rest-of-*Forever Pucked* (a
separate fresh-quote decision), no Batch (Batch is unarmed —
`batch_not_armed` — and its arming is a separate later gate chain per
Julie's ordering: Chapter 3 first, then Batch), no other book, plan,
or job. The parked Chapter 3 job
(`1832c21fcf0425454227c4736048a8a632f422abca4a2685ddb775bb1681406a`)
is a census fact only and is never touched (§10).

---

## 2. STEP-0 RESOLUTION — the headline section

### 2.1 The variance, stated exactly as recorded

Phase B attempt 3's approved procedure required, at its step-0
(before unpause), **grant-level verification**: that a grant exists
naming this plan, that the granted set is exactly {idx 26}, and that
the reservation closes at 12. The attempt-3 execution record (§6)
records what actually happened: **no grant existed at step-0**, so the
executor substituted **deliverable-set verification** (the Phase B
plan is the only non-terminal plan; its job is queued with exactly
one pending occurrence; reconcile reserved 0) and re-applied the
grant-level checks at every poll after unpause. Rowan's review
recorded this as a **procedural variance**, and the diagnostic report
(§7) states the structural point this package is required to resolve:

> As the machinery stands, a pre-unpause grant-level verification is
> **unsatisfiable by construction**, because no grant can exist
> before the first post-unpause drive pass. (A grant issues only
> inside `driveOnce`, whose only caller is the Durable Object alarm
> handler; while both holds stand, no drive pass can run, so no grant
> can come into existence for step-0 to inspect.)

The next proposal — this one — "should say so and design its step-0
accordingly, rather than paper over it again" (diagnostic §7). C3's
package (§10) carries the same requirement forward by name.

### 2.2 The resolution: no pre-unpause grant check is claimed, required, or performed — verification attaches to the first observable effect

**This package resolves step-0 by design, as follows.**

1. **There is no pre-unpause grant verification in this gate** — not
   renamed, not substituted, not silently dropped. The execution
   sequence (§5) contains no step that inspects, expects, or asserts
   the existence of a grant before the holds lift, and the execution
   record of this gate must state that plainly, in those words.
2. **Why that is sound.** Before the holds lift, containment does not
   rest on grant inspection at all — it rests on the holds themselves:
   GENERATION_HALT `"1"` fences delivery and the paused queue fences
   dispatch, and the census (§4) verifies both holds, the plan's
   exact preserved shape, and the exclusivity facts the old step-0
   actually needed (this plan is the only non-terminal plan; its job
   carries exactly one occurrence; no other plan or job can be
   selected by a drive pass). Those are **census facts, verified
   while held** — they are not a grant check and are not presented as
   one. The grant is the **first observable effect** of the drive
   path running; verification therefore attaches where the evidence
   first exists: **after** the lift, against the grant itself, in the
   protocol of §2.3. A check moved to the first moment it can be
   satisfied is a resolution; a check performed against a state that
   cannot contain its object was the defect.
3. **What replaces it, in one sentence:** a fully specified
   **post-unpause verification protocol** (§2.3) with named poll
   targets, branch-specific in-set expected values, a sliding
   ≥35-minute stall window (Gate 4's durable ruling), exact abort
   conditions, an exact re-hold sequence, and a named evidence set
   that closes the verification.

### 2.3 The post-unpause verification protocol (normative)

**Start of protocol:** the moment the second hold lift (GR-4, queue
unpause) is read back. The wake step (GR-2) precedes the lifts
(§5), so the alarm chain is expected to be registered before the
system opens; the protocol nonetheless keys all timing to the
unpause read-back, the last executor-controlled instant.

**Poll targets** (every poll reads ALL of these; a poll with a failed
surface is a failed poll, not a negative observation):

| # | Surface | What is read |
|---|---------|--------------|
| P-1 | `GET /v2/jobs/plan:19cad189fab54b9c804a74a6:seg` | job state/revision; `grants[]` — grant id, state, revision; the occurrence's state and `cache_key` |
| P-2 | `GET /v2/d6-plans/plan:19cad189fab54b9c804a74a6` | plan state; totals {eligible, done, failed, blocked, prompts}; plan row `updatedAt` |
| P-3 | `GET /v2/d6-diagnostics?planId=plan:19cad189fab54b9c804a74a6` | `plan.phaseAccounting` — phase surface 2 |
| P-4 | `GET /v2/generation/capabilities` | phase surface 1; generationState; lanes (Batch must remain `batch_not_armed`) |
| P-5 | `GET /v2/d6-quota-reconcile` | reconcile `ok`; derived reserved; dispatched for the current PT day; sole-exception check |
| P-6 | `GET /v2/d6-diagnostics?drive=1` | drive-pass rows; live `getAlarm()` (`armedAt`); recorder health |
| P-7 | `GET /v2/conflicts` | exactly the 4 pinned rows |
| P-8 | `GET /v2/sync/changes?family=bindings&sinceSeq=1841` | binding changes (the success marker, §8.1) |
| P-9 | `GET /health` (each poll) + cf-api queue read (first, last, and any abort) | build unchanged; generation state as expected for the phase of the protocol; queue state as expected |

**Poll cadence:** at least one complete poll every 5 minutes from
unpause until the protocol closes (success, §2.3.4) or aborts
(§2.3.3). Polls are timestamped and preserved raw in the gate
evidence, as in attempt 3's 23-poll set.

#### 2.3.1 In-set expected values — branch GR-A (plan untouched; §4.1)

The grant cycle is expected to reproduce, in order, the values the
records pre-classify:

1. **Grant appearance:** `grants[]` gains exactly one grant,
   id **`grant:plan:19cad189fab54b9c804a74a6:seg:1:full`**; occurrence
   `pending` → `granted`; job `queued` rev 1 → `generating` rev ≥ 2;
   derived reserved 0 → **12** (the cohort reservation taken at
   issuance). Dispatched still 0 at this instant; provider attempts
   0; phase figures frozen except the derived-reserved movement.
2. **Dispatch and attempts:** with the queue live and the halt lifted,
   delivery proceeds: dispatched for the current PT day increments
   **only** for this grant's attempts; each attempt is attributable
   to this plan/occurrence on the reconcile and plan surfaces; the
   settled figure moves only by this segment's recorded cost (§5.4).
3. **Completion:** occurrence → `ready`; execution `committed`; plan
   totals → {eligible 1, **done 1**, failed 0, blocked 0}; derived
   reserved returns to 0 at grant close; the binding for
   `5c589095-f812-48a2-8ab2-03ba2791f2b2:2a85f74f-353d-4c25-a86a-4a4db392868b`
   appears (P-8: exactly one change, §8.1).

Any value outside this set — a different or additional grant id, a
second grant, reserved outside {0, 12} before dispatch, dispatched
movement attributable to anything else, any phase movement beyond
this segment's own accounting, any conflicts/binding/parked-job
movement outside §8.1's single expected binding — is **out-of-set**
and is an abort condition (§2.3.3), not a variation to absorb.
**Foreign generation is a STOP** (Gate 4 law), at any point, in
either branch.

#### 2.3.2 In-set expected values — branch GR-B (plan carries §7.3 churn; §4.2)

Identical in structure, with the cycle's starting values adopted from
the C3/restoration censuses: the prior grant
(`grant:plan:19cad189fab54b9c804a74a6:seg:1:full`) stands in the
terminal void state the window record establishes; job and occurrence
stand at their adopted post-churn values. The protocol then expects
**one** new grant cycle for the same occurrence, closing at the same
completion values as §2.3.1 step 3. The new grant's id form and the
occurrence's state path out of its post-void state are **OQ-2 (§9)**:
this branch may not execute until Rowan's ruling on OQ-2 fills those
expectations in writing. Nothing in this paragraph invents them.

#### 2.3.3 Abort conditions and the exact re-hold sequence

**Abort conditions** (any one, at any poll):

- A-1: the stall test of §2.3.4 is met (no grant, no progress).
- A-2: any out-of-set value (§2.3.1/§2.3.2), including any foreign
  generation signal.
- A-3: the forecast line (12,808 units) is crossed by this segment's
  cumulative settled delta before completion — a **forecast
  deviation + STOP** (attempt-3 presentation §7.1/§12 law), reported
  at exactly that strength.
- A-4: the detection threshold (25,000 units) is crossed — reported
  as a threshold crossing, never as a cap breach (§5.4).
- A-5: any hold, build, settings, observability, conflicts, or
  parked-job value moves outside its census expectation at any poll.
- A-6: a drive-pass recorder row shows an error outcome attributable
  to this plan's pass that the protocol cannot classify inside the
  in-set values (cf. the window's W-3e discipline: recorder errors
  are reported, never absorbed).

**Re-hold sequence on abort (exactly this order, mirroring attempt
3's §9.1 closing):**

1. **Re-pause the queue** (cf-api PUT `delivery_paused: true`);
   read back `delivery_paused: true`.
2. **Re-halt generation** (restore envelope: identical parts,
   GENERATION_HALT `"1"`); read back: `/health` generation `halted`,
   build unchanged, etag unchanged, observability intact.
3. **Closing capture** of the full P-1..P-9 set; the gate ends
   **HELD** (§8.2). No containment transition is performed by this
   gate on any path (§3): if the chain stands revived and churning
   after an abort, that state is **REVIVED-UNSTOPPED / OWNED** under
   the standing tail discipline until a future authorized disposition
   — named in the execution record, never silently absorbed.

**What an abort does and does not undo:** re-holding fences future
delivery and dispatch. It does not un-issue a grant already issued
(such a grant voids on lease expiry under the holds — the bounded
§7.3 churn state, $0 if no dispatch occurred), does not un-dispatch
an attempt already sent, and does not un-spend a provider cost
already incurred. Exposure on any abort is reported in the three-line
form of §8.3.

#### 2.3.4 The stall test and the evidence that closes verification

**Stall test (Gate 4's durable ruling — windows slide ≥ 35
minutes):** a **progress event** is any of: grant appearance or grant
state/revision change; an attempt recorded for this occurrence; plan
totals change; occurrence state change; dispatched increment for this
grant. If **two consecutive complete polls ≥ 35 minutes apart show no
progress event between them**, the stall is declared (abort A-1).
Any progress event **slides the window**: the 35 minutes runs from
the last observed progress, never from the unpause. (Attempt 3's
declaration is the precedent shape: first no-progress observation
>10 min after submission, second 35 min 14 s later, no progress event
between.) After grant + dispatch, the same sliding test keys on
attempt/completion progress (OQ-6, §9: no record bounds a single
segment's delivery duration, so the test — not a deadline — is the
control).

**Closure evidence (success):** the verification is closed by the
poll set itself, preserved raw: the first poll showing the grant
in-set, every intermediate poll, and the closing poll set showing
§2.3.1 step 3 complete (or §2.3.2's ruled equivalent), **plus** the
closing census of §5 step GR-7. No summary substitutes for the raw
polls; the execution record quotes the closing values from them.

---

## 3. The mutation ledger — exact, action by action

| Step | Act | Mutations |
|------|-----|-----------|
| GR-0 | Fresh execution census (§4) — reads only | 0 |
| GR-1 | Voice checkpoint (§5.2) — eligibility quotes, reads only | 0 |
| GR-2 | **Wake slot** (§5.3) — mechanism fixed by Rowan's OQ-1 ruling; accounting fixed by that ruling and recorded here by amendment before execution | per ruling |
| GR-3 | Halt lift (§5.5) — settings-only operative-envelope flip, GENERATION_HALT `"1"` → `"0"`, identical parts | 1 |
| GR-4 | Queue unpause (§5.5) — cf-api PUT `delivery_paused: false` | 1 |
| GR-5 | Post-unpause verification protocol (§2.3) — polls, reads only | 0 |
| GR-6a | Success close (§5.7): re-pause (cf-api PUT) + re-halt (restore envelope) | 2 |
| GR-6b | Abort close (§2.3.3): re-pause + re-halt, same acts | 2 |
| GR-7 | Closing census (§5.7) — reads only | 0 |

**Budget totals:** counted mutations **≤ 4** on every path (GR-3,
GR-4, and exactly one of GR-6a/GR-6b), **plus** the GR-2 wake slot at
whatever accounting Rowan's ruling assigns it. **Explicit zero
budgets:** SubmitJob **0** (§1.1); exemption calls **0** (the
exemption stands applied; §10); containment transitions **0** (no
`contain_drive`, no `stop_chain`, no `clear`, no `verify_chain_stop`
— restoration is a precondition, §0 leg 3, and re-stopping a revived
chain after an abort is a future gate, §2.3.3); settings changes
beyond the two halt envelopes **0**; deploys **0** (the halt envelopes
re-upload byte-identical parts with the single metadata value
changed — the established flip mechanism of attempt 3 §4/§9.1,
counted above as the mutations they are); queue changes beyond
GR-4/GR-6 **0**; conflicts changes **0**.

**Ambiguity law (gates v4, carried):** a step whose response is
ambiguous stays UNRESOLVED until a fresh live read resolves it;
recorded logical completion is never physical verification. The
§2.3.3 re-hold read-backs are the abort path's physical evidence;
the §5.7 closing census is the success path's.

---

## 4. Fresh census — hard preflight expectations (GR-0), BRANCHED

The census is taken **fresh at gate time**, after §0 legs 1–5, in the
§3.1-style full read set (the same surfaces as the S1 window's §3.1
set, plus both phase surfaces enumerated by name and the §5.2 quote
surfaces). **Branch-invariant core (§4.0) plus exactly one branch
delta (§4.1 or §4.2).** The branch is selected **by the census** —
specifically by the preserved plan/job values it reads — never by
executor choice. A fresh state matching neither branch, or matching
a §4.3 blocker, is a STOP before any mutation (executor STOP law).

All values below not marked "adopted" are the **opening baseline**
(cited from the Grant 1 execution record and the attempt-3 record);
the census re-reads every one live.

### 4.0 Branch-invariant core (all branches)

1. **Build:** `/health` build `fdb02395b3775dc945baa395591a73060ab146c4`
   (the composed build), generation `halted`, coordinator `armed`;
   script etag `bb90f18223e1802e1c417f17359f344499dc2d29c78e54db259f6f9ae4ac5c9e`;
   parts byte-identical to the Grant 1 stamped manifest. *Any other
   build at census = STOP and rebase (§0): a later gate that changed
   the build must name itself in an amendment to this package first.*
2. **Holds:** GENERATION_HALT `"1"`; queue `opalreader-generation-v2`
   `delivery_paused: true`, exactly 1 consumer
   (`f260f2188d80426bb0588685e9d084eb`); settings revision **1**;
   `OPALREADER_PHASE_POLICY` `"enforce"`; 10 bindings; observability
   enabled + persisted.
3. **Containment:** state **NORMAL** on both surfaces (operator route
   and the `drive=1` projection), `verified: true`,
   `stopConfidence: "not_applicable"` — the restoration's closing
   state, re-read fresh here (the restoration record alone never
   carries the state into this gate). The closed S1/C3 episode(s)
   stand in the audit history exactly as the restoration's historical
   audit review enumerated them; the census records the summary
   fields as read.
4. **Alarm:** `getAlarm()` **null** on the `drive=1` read — the
   expected post-stop, pre-wake physical state (C3's verified stop
   deleted the registration; the restoration's `clear` does not
   re-arm — design law). `pendingSchedule` / `pendingWatchdog` as
   read and recorded (baseline: 2 / 1 — schedule rows survive a stop;
   C3 §8). *A non-null `armedAt` at census is not automatically a
   STOP: it is a deviation to classify against the restoration
   record (a post-restoration wake — e.g. ordinary app use — may
   legitimately have re-registered the chain, in which case GR-2's
   form changes and Rowan's OQ-1 ruling governs how the executor
   proceeds). An `armedAt` the restoration record cannot account for
   = STOP.*
5. **Phase accounting, on BOTH surfaces by name** (the C2 item-7
   lesson — a census item naming two surfaces enumerates reads
   covering both): surface 1 = capabilities `phases[forever-pucked]`;
   surface 2 = plan diagnostics `plan.phaseAccounting`. Both must
   agree exactly: settled **1,029,420**; estimatedUnverified
   **19,018**; reservedUnverified **5,648**; inFlightUpper **0**;
   unknownOpen **0**; remaining **12,464,932** of 13,500,000;
   `unverifiedStatus: provider_unverified`.
6. **Quota:** reconcile `ok: true`, drift empty, sole exception the
   known adjudicated straddler
   `att-37d63768-db4b-447d-8150-580b7c6ee257`
   (`estimated_unverified`); current PT day dispatched recorded, with
   **headroom ≥ 12** against the 100/day cap (§5.4).
7. **Exemption projection (evidence class (b), labeled as such):**
   chapter quote bound **26** / eligible **1**; segment quote
   eligible **1** / 569 chars / expected **8,022**, `voice_prompt 0`
   (the §5.2 voice checkpoint reads these same surfaces at GR-1; a
   census/GR-1 disagreement = STOP). The exemption journal has **no
   read surface** (attempt-3 §10 class (c): UNAVAILABLE) — this
   package claims the exemption's existence from attempt 3's class
   (a) operator response and its standing effect from this
   projection, nothing more.
8. **Conflicts:** exactly the 4 pinned `schedule_dead` lease rows
   (ids 1–4, every field exact, per the attempt-3 census baseline).
9. **Bindings/content:** bindings watermark **1841**, **0** changes
   since 1841, **0** rows for occurrence `2a85f74f…`; content
   watermark **18**; the idx-26 R2 occupancy key FREE (adopted from
   the restoration-era reads if the restoration census re-read it;
   otherwise re-read here — it is a census item, not an assumption).
10. **Parked job:** `1832c21f…` `parked_policy` rev 1, fingerprint
    `b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282`,
    grants [] — untouched.
11. **Recorder:** `d6_drive_passes` state **adopted** from the
    restoration census (missing at opening baseline; the window/C3
    period may have created it). The census records the adopted state
    and verifies the live read matches it; a mismatch = STOP and
    classify (recorder dual-failure blind spot, register R-06: a
    missing table after a period in which passes are known to have
    run is a finding, not a detail).

### 4.1 Branch GR-A — plan untouched (no wake ever reached the drive path)

Selected when the census reads the preserved plan/job **exactly** at
their attempt-3 closing values:

- Plan `active`, totals {eligible 1, done 0, failed 0, blocked 0,
  prompts 0}, `updatedAt` at its creation value; entry disposition
  `eligible`, `occurrenceState: pending`, `executionState: null`;
  quarantine `held: false`.
- Job `queued` rev 1, **grants []**; occurrence `pending`,
  `cache_key: null`.
- In-set protocol values: §2.3.1 verbatim.

This is the expected branch if the S1 window dispositions NEGATIVE,
or if any revival was stopped before a drive pass could issue (§7.3
set never entered).

### 4.2 Branch GR-B — plan carries §7.3 churn (a wake issued the grant under the holds)

Selected when the window/C3 records establish — and the census
confirms — that the pre-classified §7.3 set was entered: grant
`grant:plan:19cad189fab54b9c804a74a6:seg:1:full` issued and standing
in its lease-expired **void** state; occurrence `granted`; job
`generating` rev ≥ 2; derived reserved returned to **0** (the void
released the reservation — any other reserved value at census in
this branch = STOP); phase figures otherwise exactly §4.0 item 5;
dispatched for every window day **0**; provider attempts **0**;
settled delta across the window **0**.

- The branch's delta values are **adopted from the C3 closing census
  and the restoration census**, quoted in the execution record with
  their sources; values those records do not establish are not
  estimated here.
- **Execution in GR-B additionally requires Rowan's ruling on OQ-2**
  (§0 leg 4): the re-issuance mechanics after a void. Until that
  ruling fills §2.3.2's expectations, GR-B is a census branch, not an
  executable one.

### 4.3 Preflight blockers — states in which this gate may NOT open

- Containment not NORMAL at census (any CHAIN_STOPPED, DRIVE_CONTAINED,
  unverified, or contested/`unknown` confidence) — the restoration
  leg (§0.3) has not closed; STOP.
- C3 closed in any form other than CHAIN_STOPPED / verified, or its
  execution record not yet accepted by Rowan — STOP.
- Any §4.0 item not exact, including build drift (§4.0 item 1) and
  cross-surface phase disagreement (item 5) — STOP before any
  mutation.
- Plan/job matching neither §4.1 nor §4.2 — STOP; the state goes to
  Rowan as a new branch question. The executor does not interpolate
  a branch.
- Current PT day headroom < 12 (§5.4) — the gate does not open that
  day; this is a deferral, not a failure, and is recorded as such.

---

## 5. Execution sequence

Each step names its ledger line (§3). Any §7 STOP condition, at any
step, ends the sequence where it stands; if the holds have been
lifted, the §2.3.3 re-hold sequence runs first, in its order, before
anything else.

- **GR-0 — Fresh execution census (§4).** Full read set; branch
  selected by the census; every value recorded raw. STOP on any
  deviation (§7.1). The census is also this gate's **quota-day
  check**: the current PT day is named (PT day rolls at 07:00Z —
  midnight PT), its dispatched count read, and headroom ≥ 12
  verified (§5.4). If execution is expected to span the PT boundary,
  the census states so and the pre-unpause re-check (GR-4 note)
  applies.
- **GR-1 — Voice checkpoint (§5.2, below).** Reads only.
- **GR-2 — Wake slot (§5.3, below).** The single re-arming act, in
  the form Rowan's OQ-1 ruling specifies.
- **GR-3 — Halt lift.** Settings-only operative-envelope flip:
  metadata = the live `/settings` read with only GENERATION_HALT
  `"1"` → `"0"`; identical parts. Read-backs (attempt-3 §4 pattern,
  all exact): `/health` generation `enabled`, build unchanged;
  **etag unchanged**; parts byte-identical; observability intact (if
  the flip resets observability, the standing deploy-law PATCH to
  `/workers/scripts/{name}/settings` is applied and the etag
  re-verified — that PATCH, if needed, is inside this step's single
  counted mutation, as the flip's own repair, and is reported);
  GENERATION_HALT `"0"`; 10 bindings; queue still paused.
- **GR-4 — Queue unpause.** cf-api PUT `delivery_paused: false`;
  read-back confirms. **Immediately before this step**, if the PT
  day has rolled since GR-0, the quota-day check is re-read
  (headroom ≥ 12 on the new day) — the attempt-3 step-0's legitimate
  residue: a *quota* fact, checkable while held, checked while held.
  From the unpause read-back, the §2.3 protocol runs.
- **GR-5 — Monitored generation (§2.3).** Polls per §2.3 until
  closure or abort. The executor sends **nothing** during GR-5: no
  command, no second wake, no nudge of any kind. A revived chain
  turning further passes after completion is expected machinery
  behavior and is observed, not managed, until GR-6a.
- **GR-6a — Success close.** On §2.3.4 closure: re-pause the queue
  (read-back), then re-halt (restore envelope; read-backs as GR-3
  mirrored: generation `halted`, etag unchanged, observability
  intact). The end-state alternative is Julie's alone, expressed in
  the GO (§6): the default, and the only form this package
  recommends, is **holds restored**.
- **GR-7 — Closing census.** The full §4 read set repeated. Expected
  deltas from GR-0, and **only** these: plan totals done 1 (§8.1);
  job/occurrence at their completion values; bindings watermark
  **1842** with exactly the one idx-26 binding; phase settled
  increased by exactly this segment's recorded cost, reserved figures
  returned to baseline; quota dispatched for the PT day increased by
  exactly this segment's attempt count; the alarm standing
  re-registered by the chain's own re-arm cycle (value recorded, not
  predicted). Any other delta = the record classifies it before
  anyone calls the gate closed (§7.6).

### 5.2 Voice checkpoint — re-verified fresh, read-only, no generation

Attempt 3's checkpoint (§3 of its record) PASSED: post-exemption
quotes showed the segment **eligible 1 / 569 chars / expected
8,022**, exclusions all zero, `voice_prompt 0` — the disposition is
`eligible` because the segment's POV resolves through its recorded
cast voice, **Alex → Gemini Charon**, with no prompt.

**This gate re-verifies the checkpoint fresh at GR-1**, because the
exemption's standing effect is a projection (evidence class (b)) and
months of intervening gates make a carried-forward PASS exactly the
kind of claim this ladder does not make. Method, reads only: chapter
quote (bound 26 / parked 0 / eligible 1) and segment quote (eligible
1 / 569 / 8,022), exclusions zero, `voice_prompt 0`. The checkpoint
**passes** only if all of those read exactly; the quote digest is
recorded and compared against attempt 3's post-exemption digest
(`cdef2c7e…`): agreement is corroboration; **disagreement is a STOP**
(§7.2), never a rationalization — the executor does not decide which
field's movement is innocent. No audio is generated, auditioned, or
touched by the checkpoint; it reads the same quote surfaces the
census reads.

### 5.3 The wake slot (GR-2) — why a wake is needed, and why its form is Rowan's to fix

The physical situation this gate opens into is new to the ladder:
C3's stop deleted the alarm registration, and the restoration's
`clear` — by design law (containment design §5.2; battery CT12) —
**never re-arms**. At GR-0 the expected `getAlarm()` is therefore
**null** (§4.0 item 4). Neither hold lift re-arms anything: the halt
flip is a Cloudflare-side metadata act and the unpause is a queue
act; neither reaches the coordinator. **Without a wake, there is no
registration, no drive pass, and no grant — the attempt-3 stall
shape, this time by construction rather than by fault.**

What the deployed source establishes (diagnostic §§1–2, on the
pre-R5a build; the composed build's R5a amendment changes the
past-due rule, not the wake paths):

- `wake()` ensures a pending watchdog row exists and calls
  `_armAlarmIfEarlier()`, which sets the alarm when `getAlarm()`
  returns **null** (or when the earliest due time is earlier than the
  armed time). A null registration is therefore re-armable by any
  single wake.
- `wake()`'s only callers are `handleCommand` (every command),
  `requestGrant`, and `handleReport`. **No GET or read path calls
  `wake()`.** Ordinary app use does reach it: `POST /v2/sync/position`
  constructs a fresh `PushPositionEvents` command per push
  (REVISED-2 §1) — but Julie's app use is not an executor-controlled
  step, and this gate does not schedule her behavior.
- Schedule rows survive the stop (C3 §8), so at wake time the
  earliest pending row is a long-past-due watchdog; under R5a's
  past-due disjunct the wake re-registers the alarm to that due time
  and prompt delivery is **expected — not proven** (the D-value
  family, B1 leading / B2 / B3, is unobservable until the wake; the
  §2.3.4 sliding stall test is the control that absorbs this).

**The slot:** GR-2 is exactly one wake, performed by the mechanism
Rowan names in her ruling on **OQ-1 (§9)**. The candidates the
records put in view — and their problems, stated so the ruling has
something to rule on:

- (i) *A fresh, well-formed executor command whose apply is expected
  to refuse on state grounds.* `handleCommand` calls `wake()` before
  applying, so even a refused command wakes — but no record names a
  specific command that is simultaneously fresh, well-formed, and
  guaranteed side-effect-free on refusal in all states this gate can
  open into. Naming one is a source question, not an executor choice.
- (ii) *A replayed (idempotent) command.* The diagnostic's P1 text
  says "even a rejected or replayed command wakes first
  (`coordinator.mjs:521`)"; later ladder source summaries record that
  replayed commands short-circuit at the receipt check **before**
  `wake()`. These two statements conflict, the conflict is in the
  records, and this package does not resolve it by preference.
  **OQ-1.**
- (iii) *Relying on the GR-3 halt flip or GR-4 unpause to wake.*
  Rejected on the source above: neither reaches the coordinator.

**Until OQ-1 is ruled, GR-2 is an unfilled slot and this gate cannot
execute** — that is a stated dependency (§0 leg 4), not a gap to be
improvised around at execution time. If GR-0's census instead reads
a non-null `armedAt` accounted for by the restoration record (§4.0
item 4), GR-2 may be satisfiable trivially; the ruling should say
what the executor does in that case too.

### 5.4 Cost and quota treatment (Gate 4 law, carried at full strength)

- **Expected cost of the one segment: 8,022 units ≈ $0.008** (live
  quote, attempt-3 record). **Forecast line: 12,808 units ≈ $0.013**
  (the m = 1 modeled bound). **Detection threshold: 25,000 units ≈
  $0.025.** Per Gate 4's durable ruling, carried through the
  attempt-3 presentation (§7.1): **the forecast line is a deviation
  signal and the threshold is a DETECTION THRESHOLD — neither is a
  cap, and no wording in this gate may present either as one.** A
  literally unconditional hard cap is not achievable in this
  architecture: the provider call precedes its measurement, so
  exposure is parameterized by the realized duration multiplier. The
  **physical backstop is the Gemini prepay balance** (Julie's AI
  Studio prepay; $17.83 as of her Oct 29, 2026 screenshot — a
  **historical** figure, not freshly verified, and not re-verified by
  this package, which makes no calls). No automatic top-up exists or
  is authorized.
- **Phase budget:** the segment's settled cost lands inside phase
  `forever-pucked`'s frozen $13.50 budget (remaining 12,464,932 units
  at baseline); the per-grant phase guard applies as shipped. The
  $50 settings cap is an outer backstop, untouched.
- **Quota:** the provider-attempt cap is **100/day, rolling** (PT
  day; boundary midnight PT = 07:00Z). The cohort worst case for this
  gate is **12 slots** (the single grant's reservation), so the
  census requires **headroom ≥ 12** on the executing PT day (GR-0),
  re-checked at GR-4 if the day has rolled. Expected realized
  attempts for one 569-char segment are far below the reservation;
  the reservation is a bound, not a forecast.

---

## 6. Exact GO wording (for Julie's future decision — NOT requested here; INOPERATIVE until §0's legs are all satisfied)

When Julie chooses to authorize one resume attempt, the operative
wording is:

> "GO — execute exactly one generation-resume attempt as pinned at
> `<RESUME-PIN>`, **against whichever branch the execution census
> verifies** (GR-A plan-untouched, or GR-B §7.3-churned with Rowan's
> OQ-2 ruling in hand): fresh census on both phase surfaces; fresh
> read-only voice checkpoint (Alex → Gemini Charon); exactly one wake
> in the form Rowan's OQ-1 ruling specifies; one halt lift and one
> queue unpause; the post-unpause verification protocol with its
> sliding 35-minute stall window; **NO SubmitJob of any scope, NO
> exemption call, NO containment transition, NO other generation**;
> on success or abort alike, re-pause and re-halt so the attempt ends
> HELD, with exposure reported in the three-line form. I understand
> no pre-unpause grant verification exists or is claimed — the holds
> are the pre-unpause containment and verification attaches to the
> grant as the first observable effect after the lift; that the
> dollar figures are a forecast line and a detection threshold, never
> caps, with the prepay balance as the physical backstop; that one
> GO covers one attempt and a stall consumes it; and that restoration
> was authorized and executed separately, before this GO."

The bracketed end-state alternative (§5 GR-6a): if Julie wishes the
attempt to end with the holds **lifted** on success, her GO must say
so expressly in place of the ends-HELD clause. Silence means HELD.
Rowan's review of this package is not a GO. This package requests no
GO. Production remains INVESTIGATION HELD at filing.

---

## 7. STOP conditions

Any one of these stops the execution. Beyond the §2.3.3 re-hold
sequence (when the holds stand lifted) and evidence capture, the
executor performs no further act. The GO is consumed by the attempt
either way; there is no in-gate retry.

1. **Any GR-0 census deviation** — any §4.0 item not exact, or the
   plan/job matching neither branch (§4.3) — STOP before any
   mutation (executor STOP law). The executor's own tracing never
   clears its own stop.
2. **Voice checkpoint failure** — any §5.2 value not exact, or the
   quote digest disagreeing with `cdef2c7e…` — STOP before GR-2.
3. **Wake-slot failure** — GR-2 performed in the ruled form does not
   produce a registration readable on the `drive=1` surface within
   one watchdog period (10 minutes), or OQ-1 stands unruled at
   execution time — STOP before the lifts (the system is still held;
   no re-hold is needed and none is performed).
4. **Any abort condition A-1..A-6** (§2.3.3) during GR-5 — re-hold in
   the §2.3.3 order and STOP.
5. **Any ambiguous response a fresh read cannot resolve** — the step
   stays UNRESOLVED and the gate stops on it (gates v4 law); in
   particular, an ambiguous halt-lift or unpause response is resolved
   by fresh reads of the hold surfaces before the protocol clock is
   treated as running.
6. **Closing-census surprise (GR-7)** — any delta outside §5 GR-7's
   enumerated set: the gate's record classifies it and the gate does
   not close as PASS until Rowan rules on the classification.
7. **Interruption** (executor death, lost session, infrastructure
   restart) at any point — the attempt halts where it stands. If the
   holds stand lifted at interruption, the system's state is
   **OPEN-UNOWNED** and is escalated to Julie immediately on any
   executor's return; resumption requires a fresh ruling + fresh GO.
   A stopped resume is never restarted on anyone's interpretation
   (standing rule: one GO, one attempt).

---

## 8. End states

### 8.1 Success

The segment is `committed`; the plan reads {eligible 1, done 1,
failed 0, blocked 0}; exactly one new binding exists for the idx-26
entityKey and the bindings watermark stands at **1842** (the advance
from 1841 is an expected success marker — its absence at GR-7 means
the gate does **not** close as success, whatever else reads well);
holds **restored** (re-pause + re-halt, §5 GR-6a) unless Julie's GO
expressly named the lifted alternative. **Julie's playback check is
the acceptance step, outside the executor's verdict:** she plays the
chapter end; the expected header is **"Complete 27/27"**. The
executor's record claims the generation outcome only; whether Chapter
3 is *finished* is Julie's word after playback, and Rowan's
documentary execution review follows the same pattern as every prior
gate.

### 8.2 Failure / stall

The gate ends **HELD** (re-pause + re-halt read back), the preserved
plan and exemption stand exactly as the abort left them (a grant
issued-then-voided under the re-hold is the §7.3 churn state, owned
and named, not cleaned up), the raw poll set is preserved, and the
record states the abort condition by its §2.3.3 number. **No retry
inside this GO.** A further attempt is a new decision — Julie's fresh
GO, against whatever Rowan rules on the abort record.

### 8.3 Exposure reporting (all end states, three lines, always)

1. **Verified charges:** the settled delta on both phase surfaces
   (the only figure the ledger verifies), stated in units and dollars.
2. **Unverified estimates:** any attempt whose outcome stands
   `estimated_unverified` at closing, stated separately, never merged
   into line 1.
3. **Remaining phase room:** 13,500,000 minus the closing settled /
   reserved position, from the closing census.

(Attempt 3's closing is the precedent for a zero outcome under this
form: verified $0, estimates unchanged, room 12,464,932.)

---

## 9. Open questions — for Rowan's ruling (nothing here is invented)

- **OQ-1 (blocking, all branches) — the wake mechanism.** §5.3: after
  a verified stop + a non-re-arming clear, which single act
  legitimately re-registers the alarm? Sub-questions: (a) does a
  replayed command `wake()` or short-circuit on the composed build
  (the records conflict — diagnostic P1 text vs later ladder source
  summaries)? (b) If a fresh command is required, which command is
  fresh, well-formed, and side-effect-free on its expected refusal,
  in every state this gate can open into? (c) If GR-0 reads a
  non-null, restoration-accounted `armedAt`, is GR-2 satisfied
  without any act? (d) What mutation accounting does the ruled
  mechanism carry into §3?
- **OQ-2 (blocking, branch GR-B only) — re-issuance after a void.**
  When the §7.3 grant stands voided (lease expiry under the holds)
  and the holds later lift, does a drive pass issue a **new** grant
  for the occurrence? With what id (the `:seg:1:full` sequence —
  incremented, or re-used)? What is the occurrence's state path out
  of `granted`-post-void, and the job's revision path? The records
  establish the void state (window classifications W-2) but do not
  establish re-issuance mechanics; §2.3.2's expectations wait on this
  ruling.
- **OQ-3 — recorder expectations at resume.** If passes ran during
  the window/C3 period, `d6_drive_passes` exists at this gate's
  census (§4.0 item 11 adopts its state). Is a drive-pass row for
  this gate's own passes **required** closing evidence, or is the
  P-1..P-9 grant/accounting evidence sufficient with rows as
  corroboration? (The dual-failure blind spot, R-06, cuts both ways
  and this package takes no position.)
- **OQ-4 — the D-value at this gate's wake.** Prompt delivery after
  the wake is expected under R5a's past-due disjunct (the pending
  watchdog row is long past due), but D remains unobservable until
  the wake and the B-family is not closed (B1 leading, not proven).
  The §2.3.4 sliding stall test is designed to absorb any D; Rowan
  is asked to confirm that no additional pre-lift observation is
  required, rather than this package asserting one.
- **OQ-5 — post-completion chain behavior.** After GR-6a's re-hold,
  the alarm chain stands registered and the watchdog continues to
  fire into the halt (passes under the holds, the pre-window normal).
  Is any post-gate observation of that state required (a tail check),
  or does the closing census suffice? This package proposes the
  closing census suffices and asks Rowan to rule.
- **OQ-6 — completion timing bound.** No record bounds how long one
  segment's dispatch + attempts may legitimately take; §2.3.4
  therefore keys the post-dispatch phase to the same sliding
  ≥35-minute no-progress test rather than a deadline. Rowan is asked
  to rule on whether a distinct, longer bound is required for the
  post-dispatch phase.

**Strength discipline:** every claim in this package is marked at its
true strength where it matters — source-proven (the wake paths, the
live-trigger finding), record-cited (baseline values, attempt-3
figures), expected-not-proven (prompt delivery after the wake,
re-issuance in GR-B), or open (OQ-1..OQ-6). Nothing platform-side is
asserted beyond the records.

---

## 10. What this gate does NOT do — exclusions and the meaning of "undo"

This gate, on every path: performs **no SubmitJob and creates no
plan** (§1.1); arms **no Batch** and generates **nothing** beyond the
single idx-26 segment (no rest-of-book, no other chapter, book, or
segment); takes **no action on the preserved plan or the parked job**
beyond letting the drive path run the preserved plan (no retirement,
no revocation, no release, no quarantine change); makes **no
exemption change** (no new exemption, no revocation — the standing
exemption is a census fact); performs **no containment transition**
and **no restoration** (restoration precedes this gate, §0 leg 3);
**clears no conflicts row**; changes **no settings** beyond the two
halt envelopes; performs **no deploy** and changes **no code**;
changes **no queue property** beyond the GR-4/GR-6 pause toggles;
and grants **no onward authorization** (Batch arming, rest-of-book
generation, and any second resume attempt each need their own gates).

**Rollback thinking.** There is no code change in this gate, so there
is nothing to roll back in the deployment sense. Operationally,
"undo" means exactly the **re-hold** (§2.3.3): re-pause + re-halt,
restoring the containment the holds provide. Its limits are stated,
not softened: a re-hold cannot un-issue a grant, un-dispatch an
attempt, un-spend a provider cost, un-commit a completed segment, or
un-advance the bindings watermark — nor should it: on the success
path those are the gate's product, and on an abort path they are the
exposure the three-line report (§8.3) exists to state. Build
rollback is not applicable (no build changes; the floor law is
untouched and the composed build stands).

---

## 11. Package contents, bases, and turn

**Contents of this filing:** this package
(`PHASEB-GENERATION-RESUME-PACKAGE.md`) + verbatim sequential parts
(exact-concat, if the package exceeds ~30 KB) + the companion cp
(`PHASEB-GENERATION-RESUME-ROWAN-CP.md`), pinned together on
`ui1-review` in `jedavid33-design/opal-reader` under
`review/ch3-generation/recovery/`.

**Bases (all records on disk; no production calls were made):** the
Phase B attempt-3 execution record (pin `ee8562b9…`) — census,
checkpoint, step-0 §6, stall §8, closing §9; the stall diagnostic
report `PHASEB-STALL-DIAGNOSTIC-REPORT.md` (pin `cccfea62…`) — §§1–2
(wake/alarm source facts), §6 (live-trigger finding), §7 (the step-0
variance this package resolves); the rebased C3 readiness package
(pins `46112a03…` + correction `aba681a0…`) — §0 dependency form, §2
restoration law, §4 branched census, §6 GO form, §10's step-0 charge
to this package; `PHASEB-RECOVERY-GATES-V4-REVISED.md` — ledger and
restoration law; the Grant 1 execution record (pin `f9b29543…`) —
the composed build and opening-baseline live state; the R5a-D/S1
sequencing proposal REVISED-2 (pin `11a296e7…`) — §1 (position-sync
wake), §7.3 pre-classified set; the attempt-3 final presentation
CORRECTED (pin `91826e5b…`) — §7.1 cost figures and law.

**Requested of Rowan:** a **readiness review only** — PASS / REVISE
on this package as the generation-resume readiness basis, including
rulings on OQ-1 (all branches) and OQ-2 (if GR-B is to be
executable). No execution, no GO request, no production act of any
kind is proposed or authorized by this filing. The S1 window runs
meanwhile under its own arrangements; C3, the restoration, and this
gate's GO all stand in their own dependency order (§0).

**Turn: Rowan's** — when Julie pokes her. (Julie relays; the board
watch is cancelled and wake emails are suspended, both standing.)

— Wren
