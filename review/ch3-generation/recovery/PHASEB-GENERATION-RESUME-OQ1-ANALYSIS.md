# Phase B — GENERATION-RESUME gate: OQ-1 ANALYSIS — an explicit, verifiable wake mechanism after a C3 stop and a restoration clear

_Analysis filed by Wren, 2026-11-05, under Rowan's ruling on the Phase B S1 window record (R4), as a companion to `PHASEB-C3-BRANCH-D-RECONCILIATION.md`. It amends nothing by itself: it proposes the fill for the generation-resume package's GR-2 slot and asks Rowan to rule. Documentary only — no production act is performed, requested, or authorized by this filing. Production remains HELD (ruling R5)._

OQ-1 analysis pin: `<PACKAGE-PIN>` — repo `jedavid33-design/opal-reader`, branch `ui1-review` (one pin commit carries this analysis, the C3 branch-(d) reconciliation, and the companion cp; the slot is shared accordingly).

---

## 1. OQ-1, restated precisely — and why it blocks every branch

The generation-resume package (`PHASEB-GENERATION-RESUME-PACKAGE.md`, pin `0946f9f2fb978a46b562c738d8ac6d9d4ee977a6`) states the question at its §9:

> **OQ-1 (blocking, all branches) — the wake mechanism.** §5.3: after a verified stop + a non-re-arming clear, which single act legitimately re-registers the alarm? Sub-questions: (a) does a replayed command `wake()` or short-circuit on the composed build (the records conflict — diagnostic P1 text vs later ladder source summaries)? (b) If a fresh command is required, which command is fresh, well-formed, and side-effect-free on its expected refusal, in every state this gate can open into? (c) If GR-0 reads a non-null, restoration-accounted `armedAt`, is GR-2 satisfied without any act? (d) What mutation accounting does the ruled mechanism carry into §3?

**Why a wake is needed at all** (resume package §5.3, restated): the resume gate opens, by construction, into a state no earlier gate has produced. C3's stop **deleted** the alarm registration (`deleteAlarm()` + null read-back). The standalone restoration's `clear` — by design law (containment design §5.2; battery CT12) — **never re-arms**. Neither hold lift reaches the coordinator: the halt flip (GR-3) is a Cloudflare-side metadata act and the queue unpause (GR-4) is a queue act. At GR-0 the expected `getAlarm()` is therefore **null**, and the deployed source is unambiguous about the consequence: `driveOnce` has exactly one caller — the DO alarm handler — so **without a registration there is no drive pass, no grant, and no generation**: the Phase B attempt-3 stall shape, this time by construction rather than by fault.

**Why it blocks every branch:** the gate's branches (GR-A / GR-B) differ in the preserved plan's execution state, not in the alarm state — both open after the same stop + clear sequence, into the same null registration. The execution sequence (§5 of the resume package) places the wake at **GR-2**, before both hold lifts, and states in terms: "Until OQ-1 is ruled, GR-2 is an unfilled slot and this gate cannot execute." R4 keeps OQ-1 **OPEN** and names what an answer must contain: "an explicit, verifiable wake mechanism after C3 stop and restoration clear, **including failure behavior when alarm delivery does not occur**," with the standing caution: "**Do not treat persisted `armedAt` as proof of delivery.**"

This analysis supplies that answer in the form R4 requires: a named mechanism (§2), its verification protocol (§3), its failure behavior (§4), the rejected alternatives (§5), its interaction with OQ-2 (§6), the residual unprovables (§7), and the specific rulings requested (§8).

---

## 2. The proposed mechanism — a fresh probe command (the Grant 2 precedent, generalized)

### 2.1 The mechanism

**Exactly one fresh, well-formed client command whose apply-path refusal is total and side-effect-free by construction: a `RequestPause` against a job that does not exist.**

| Element | Value |
|---|---|
| Route | `POST /v2/commands`, via the **client connector** `~/workspace/custom-connectors/custom.opalreader-v2-prod/bin/v2prod-api`, with headers `X-OpalReader-Scope: production` and `X-OpalReader-Instance: account` |
| Body | `{"command_id":"<FRESH-ID>","type":"RequestPause","payload":{"jobId":"alarm-wake-probe:nonexistent"}}` |
| `<FRESH-ID>` | A **new** command_id, minted for this gate, never previously used. (The precedent's was `s1-stimulus-20261103232613`; reusing that id — or any previously used id — would make the command a **replay**, which short-circuits before `wake()` — §5. Freshness is not a formality; it is the mechanism.) |
| Expected response | HTTP 200, `{"outcome":"rejected","reason":"job_not_found"}` — the refusal **is** the success criterion at the command layer. Any other outcome is a STOP-and-classify event (an `applied` outcome would mean the target existed — a contradiction of the gate's census, not a variation) |
| Count | **Exactly one.** Never re-sent blindly; never followed by a second, improvised wake (§4) |

**Why it wakes (the source facts, as established):** `wake()`'s call sites in the deployed source are exactly three — `handleCommand` (`coordinator.mjs:521`), `requestGrant` (:1806), and `handleReport` (:2064). `handleCommand` calls `wake()` **before** apply runs, on every fresh well-formed command — including commands apply will refuse. Replayed commands are the exception: they short-circuit at the receipt check **before** `wake()`. GETs and reads never call `wake()` at all. A fresh `RequestPause` for a nonexistent job therefore traverses exactly the path needed — receipt check passes (fresh id), `wake()` runs (the coordinator ensures a pending watchdog row exists and calls `_armAlarmIfEarlier()`, which sets the alarm when `getAlarm()` returns null — the precise condition the resume gate opens into), and then apply refuses `job_not_found` because there is no such job to pause. The refusal is total: `RequestPause` against a nonexistent job has no state to change, and the probe target is nonexistent **by construction**, in every state this gate can open into (OQ-1(b)'s requirement) — no census outcome makes `alarm-wake-probe:nonexistent` a real job.

**A note on OQ-1(a) — the replay conflict does not need resolving for this mechanism.** The records conflict on replayed commands (the diagnostic's P1 text says "even a rejected or replayed command wakes first"; later ladder source summaries record the receipt-check short-circuit). The proposal depends on **neither** side: both records agree that a **fresh** command wakes (`handleCommand` wakes before apply), and the mechanism uses only a fresh command. The conflict is recorded here as it stands — unresolved in the records — because a future executor must never be tempted to "re-send" the probe under the P1 reading: under the short-circuit reading, a re-send does nothing at all, and under either reading a re-send is outside this mechanism's discipline (§4).

### 2.2 The evidence — Grant 2, accepted by R1

This mechanism is not a construction from source alone. It has been executed once, live, under authorization, and its review is closed:

- **Grant 2 (Julie's separate GO, board comment 6618087797), 2026-11-03T23:26:13Z:** exactly one stimulus of exactly this shape — `command_id` `s1-stimulus-20261103232613`, `RequestPause`, `{"jobId":"alarm-wake-probe:nonexistent"}` — sent via the client connector after a fresh complete pre-send census at baseline with NO DEVIATION (window record §5).
- **Response:** HTTP 200 `{"command_id":"s1-stimulus-20261103232613","outcome":"rejected","reason":"job_not_found"}` — the expected refusal.
- **Effect:** recorder row **id 1** at **1793748374899** (2026-11-03T23:26:14.899Z) — a drive pass **~1.9 s after dispatch**, stage complete, `driveInvoked` true, no error — issuing exactly the pre-classified grant `grant:plan:19cad189fab54b9c804a74a6:seg:1:full`; job `queued` rev 1 → `generating` rev 2; occurrence `pending` → `granted`; derived reserved 0 → 12; `armedAt` 1793562576104 → **1793748974899** (the pass time + the 600 s watchdog period); dispatched 0; phase frozen; containment NORMAL (window record §5).
- **Rowan's R1 (2026-11-05)** accepts the event: "The single authorized fallback stimulus produced the expected rejected command and subsequent drive activity… This establishes **successful wake and observed drive activity**."

**The differences between the precedent and the proposed use — stated, not smoothed over.** (i) *Platform state:* the Grant 2 wake acted on a chain that had **never been stopped** — a stale registration stood (`armedAt` 1793562576104), and the wake's delivery produced a pass against a coordinator whose alarm machinery had never been deleted-and-cleared. The resume use acts after a **verified stop** (registration deleted) and a **restoration clear** (no re-arm): `getAlarm()` null by a different route. The source path is the same (`wake()` arms when `getAlarm()` returns null — resume package §5.3), but **no live precedent exists for the wake in the post-stop, post-clear state** (§7). (ii) *What stood behind the wake:* under Grant 2, both holds stood and stayed standing; the pass could only churn the grant. Under the resume gate the same is true **at GR-2** (both holds still stand — §2.3), which is the point of the slot's placement. (iii) *Authorization:* Grant 2 was a separately granted, single-use stimulus inside an observation window; this proposal is a step inside the resume gate's own execution sequence, under that gate's GO. The precedent evidences the **mechanism**; it does not authorize the **use** — authorization is the resume gate's GO, after Rowan rules here.

### 2.3 The slot — where the wake belongs in the resume sequence

**GR-2, exactly where the resume package already places it:** after GR-0 (fresh execution census) and GR-1 (voice checkpoint), **before** GR-3 (halt lift) and GR-4 (queue unpause). No reordering is proposed. Three reasons, each grounded:

1. **The package's own design.** §2.3's protocol note: "The wake step (GR-2) precedes the lifts (§5), so the alarm chain is expected to be registered before the system opens; the protocol nonetheless keys all timing to the unpause read-back." The step-0 resolution (§2.2 of the package) rests pre-lift containment on the holds and attaches verification to the first observable effect; GR-2-before-lifts is that design's shape.
2. **The wake's effect is fenced at GR-2.** With GENERATION_HALT `"1"` and the queue paused, a delivered pass can do exactly what the window's passes did: cycle the preserved plan's grant inside the §7.3 invariants — dispatch is halt-fenced, delivery is queue-fenced, spend is $0 (window record §§5–6: 296 passes, dispatched 0 throughout). Waking **before** lifting anything means the wake is *tested while nothing can run away*: if delivery does not occur, the failure is discovered with the system exactly as held as it was (§4) — no hold has to be re-applied to recover from a failed wake.
3. **The wake's verification is separable at GR-2.** The first pass is observable on the `drive=1` surface (P-6) while the plan's grant state is at its census values, so the wake's effect is attributable to the wake alone — not confounded with the lifts' effects, which the §2.3 protocol then verifies from the unpause read-back forward.

**Ordering assumptions flagged:** (a) the analysis assumes the restoration has completed and its record stands (GR-0's census reads containment NORMAL — §4.0 of the resume package keys on the restoration record where it names one; a GR-0 that reads anything else stops before GR-2 is reached, under the package's own §7). (b) It assumes GR-2's single command is sent by the executor in session (as Grant 2's was), not by any scheduled job — the tail watch is read-only and no job carries command authority. (c) It assumes no other wake intervenes between the restoration and GR-2; if one has (OQ-1(c), §2.4), the census sees its effect first.

### 2.4 OQ-1(c) — if GR-0 reads a non-null `armedAt`

The sub-question: if the GR-0 census reads a **non-null** `armedAt`, accounted for by the restoration record, is GR-2 satisfied without any act?

**Proposal: yes, conditionally — and the condition is evidentiary, not formal.** A non-null `armedAt` at GR-0 after a verified stop + clear can only have arisen from a wake reaching the coordinator in the interval (the clear does not re-arm; the stop deleted what stood). Candidate sources exist in the record — ordinary app use reaches `wake()` (a fresh `PushPositionEvents` command per position push; resume package §5.3) — but the source is not the executor's to certify. What GR-2 exists to establish is not "a command was sent" but "**a registration stands from which delivery can proceed**," and that is exactly what the §3 verification protocol tests. The proposal is therefore:

- If GR-0 reads non-null `armedAt`, GR-2 is recorded **satisfied-by-observation** — no probe is sent (sending one would add a second wake whose only certain effect is noise in the evidence; the mechanism's discipline is *exactly one wake act by this gate*, and an act whose precondition is absent is not performed) — **provided** the restoration record accounts for the state (the value is consistent with a registration re-armed against the surviving schedule rows, i.e. a past-due or imminent due under R5a's past-due disjunct) **and** the §3 verification still runs in full: the observed-effect proof (a pass, or the in-set grant transition) is **not waived** by satisfaction-by-observation. If no delivery follows within the §3 bound, the gate treats the case under §4 exactly as a failed wake — the registration, however it arose, did not deliver.
- If GR-0 reads non-null `armedAt` that the restoration record does **not** account for, that is a census deviation under the resume package's own law (STOP at GR-0, §7.1) — not a GR-2 question at all.

This disposes of OQ-1(c) as a proposal; Rowan's ruling is requested on it (§8, Q3), including what accounting suffices.

### 2.5 OQ-1(d) — mutation accounting for the mechanism

Proposed ledger treatment for the resume package's §3, for Rowan's ruling (Q4): the wake is **one client command** (the GR-2 ledger line), with these expected effects and no others:

- **Alarm:** one re-registration (the platform's `setAlarm` inside `_armAlarmIfEarlier`, initiated by the coordinator's `wake()`, not by the executor directly) — the act the slot exists for.
- **Coordinator state:** the wake's own ensures (a pending watchdog row exists — the schedule rows **survive the stop** per the C3 package §8, so in the expected case the row already exists and nothing is written) and, on delivery, the pass's own effects (recorder row; the grant cycle), which the §2.3 protocol — not the wake's ledger line — accounts.
- **Everything else: zero.** No plan/job/phase/quota/conflict/binding movement is attributable to the command itself; the Grant 2 precedent's read set confirms the command's refusal changed nothing on any of those surfaces (window record §5).
- **Accounting note, flagged honestly:** commands are receipted by the coordinator (the receipt check is what makes replays short-circuit), so the command's receipt is a durable internal record by design. The window record neither reads nor quantifies the receipt store, and no read surface in the gate's set exposes it; the proposal counts the wake as the one command it is and names the receipt as part of that command's ordinary machinery — if Rowan requires the receipt store accounted differently in §3, the ruling should say so.

---

## 3. Verification protocol — the wake is proven by its effect, or not at all

**Governing rule (R4, adopted verbatim as the protocol's standard): persisted `armedAt` is NOT proof of delivery.** A changed `armedAt` after the probe is a **consistency marker** — it corroborates; it never satisfies. The wake is verified only by an **observed effect** on the drive path.

### 3.1 The satisfying evidence (either form, both in-set)

- **Primary — a drive-pass recorder row.** A new row in `d6_drive_passes` on the P-6 surface (`GET /v2/d6-diagnostics?drive=1`) with id greater than GR-0's latest recorded row, timestamped after the probe's dispatch, `stage` complete, `driveInvoked` true, error fields null. This is the Grant 2 signature (row id 1, ~1.9 s after dispatch) and the direct observation that the alarm was **delivered** and `driveOnce` ran.
- **Secondary cross-check — the in-set grant transition.** The P-1/P-5 surfaces showing the preserved plan's grant cycle move exactly inside the branch's expected set (GR-A: the named grant appears, reserved 0 → 12; GR-B: as §6 leaves it for Rowan's OQ-2 ruling). A pass moves the grant state whether or not its recorder row survives — the recorder has a known dual-failure blind spot (register R-06: a pass and its recording failing together is invisible on the row surface). The cross-check exists so the protocol does not declare a wake failed on a recording failure; **whether the cross-check alone satisfies GR-2 is a question for Rowan (Q6)** — the conservative default this analysis proposes is: row **or** cross-check satisfies, and a cross-check-only satisfaction is recorded **as an R-06-class observation** in the gate record, at that strength, never silently as a clean pass.

### 3.2 The observation bound (proposal — Rowan rules, Q2)

- **Probe-to-first-effect bound: 15 minutes**, polled on the P-6 + P-1 read pair at a cadence of at least one complete poll every 5 minutes (the §2.3 protocol's cadence discipline), starting at the probe's dispatch.
- Justification from the evidence: the one live precedent delivered in **~1.9 s**. The chain's watchdog period is **600 s** (window record §5: the re-arm is the pass time + 600 s), so 15 minutes covers one full watchdog period beyond the wake with margin, while remaining far inside the window the W-4 made familiar (the W-4 classification threshold is 2 h; the standing registration's actual overdue age reached 26h14m37s). A bound must exist — an unbounded wait is a stall by another name — and it must be short enough that its expiry is a *decision point inside the gate*, before any hold lifts. 15 minutes is proposed at exactly that reasoning; **it is a proposal, not a settled constant** — no record fixes it, and Rowan's ruling sets it.
- **The bound is pre-lift only.** It governs GR-2's verification, while both holds stand. It does not replace the resume package's post-unpause controls: once GR-3/GR-4 lift the holds, the §2.3 protocol runs from the unpause read-back, and its sliding ≥35-minute stall test (Gate 4's durable ruling) governs the generation phase (OQ-4/OQ-6 territory, untouched by this analysis).

### 3.3 What the protocol does not do

It does not poll the alarm into existence (reads never wake — §5); it does not treat the probe's HTTP 200 as evidence about the alarm (the 200 evidences the refusal, i.e. that `handleCommand` ran — the wake's *initiation* — and nothing about delivery); and it does not extend, retry, or escalate on its own (§4).

---

## 4. Failure behavior — when alarm delivery does not occur (R4's explicit requirement)

The W-4 is the standing lesson: a wake can be sent, a registration can stand, and delivery can simply not occur — for more than a day, with no surface explaining why. The resume gate's failure behavior is written for that world, not for the 1.9-second world.

### 4.1 Failure at GR-2 (no observed effect within the §3.2 bound)

1. **The gate STOPS at GR-2.** GR-3 and GR-4 are never reached. **No hold has been lifted**, so there is nothing to re-apply: the queue stands paused, GENERATION_HALT stands `"1"`, containment stands NORMAL (post-restoration), the preserved plan and exemption stand untouched. The gate ends **HELD** — in the precise sense that its end state is identical to its opening state on every surface the census reads.
2. **Exactly one wake was sent, and no second wake is sent.** Not a re-send of the same command_id (a replay — it would short-circuit before `wake()` on the ladder source summaries, and under the P1 reading it is still outside discipline); not a fresh second probe; not any other command improvised as a wake. **One wake per gate attempt is the mechanism's whole discipline** — a second wake would convert a clean negative observation into an uncontrolled variable (if delivery then occurred, the record could not attribute it; if it did not, nothing further would have been learned that a ruling needs).
3. **No deploy-as-stimulus, no restart, no manual drive, no queue/halt touch** — §5's rejected alternatives stay rejected under failure pressure; failure is not a scope expansion.
4. **The failure is recorded as a new W-4-class observation** — wake sent (command_id, dispatch timestamp, the refusal response), registration state as read (`armedAt` value or null, per surface), no pass and no grant transition within the bound, polls preserved raw — and the gate's record **returns to Rowan and Julie**. The observation is UNRESOLVED in the same posture as the window's W-4: it does not classify its own cause, presumes neither that a later delivery will arrive nor that none will, and proposes no remedy. What happens next — a revised mechanism, a fresh window, platform escalation, or nothing — is a ruling, not an executor improvisation.
5. **A late delivery after the bound** (a pass arriving after the gate has ended HELD on the §4.1 failure) is a **tail-observation fact**, handled exactly as the post-window regime handles the chain's behavior: observed, logged, reported — the pass can only churn the grant under the standing holds ($0, no dispatch), and it does not retroactively satisfy GR-2 for a gate attempt that has ended. A new attempt is a new authorization.

### 4.2 Failure after the lifts (distinct case — the package's existing law, unchanged)

If the wake verified at GR-2 (a pass was observed) but the §2.3 protocol then stalls or aborts after GR-3/GR-4, the failure is **not** a §4.1 case: the resume package's §2.3.3 governs — abort conditions A-1…A-6, and the **exact re-hold sequence: (1) re-pause the queue** (cf-api PUT `delivery_paused: true`, read back), **(2) re-halt generation** (restore the envelope with GENERATION_HALT `"1"`; read back halted, build and etag unchanged, observability intact), **(3) closing capture** of the full P-1..P-9 set — ending HELD, with any revived-churn state named REVIVED-UNSTOPPED / OWNED in the record, never silently absorbed. This analysis changes nothing in §2.3.3; it names the boundary so the two failure shapes are never conflated: **pre-lift wake failure ends where it started; post-lift failure re-holds in the package's order (re-pause, then re-halt).**

### 4.3 What failure never triggers

No containment transition is performed by the resume gate on any path (resume package §3); a failed wake does not manufacture a reason to stop a chain that is not running. No R3-V, no restoration-reversal, no C3 re-entry arises from a GR-2 failure — the system is already in the state those instruments exist to reach or leave.

---

## 5. Alternatives considered and rejected

Each alternative is rejected **from the record**, with the reason named. None is rejected on preference.

| # | Alternative | Why rejected |
|---|---|---|
| 1 | **A replayed command** (re-send a previously used command_id, e.g. Grant 2's own) | Source: replayed commands short-circuit at the receipt check **before** `wake()` (ladder source summaries; the diagnostic's P1 text conflicts — "even a rejected or replayed command wakes first" — and the conflict is in the records, unresolved). A mechanism that works only if one side of an unresolved record conflict is right is not a mechanism. Rejected; the proposal needs no replay |
| 2 | **A GET or read** (poll a route; read diagnostics until something moves) | Source: no GET/read path calls `wake()`; reads never re-arm (diagnostic §§1–2; resume package §5.3). Proven empirically as well: two weeks of read-only watches (the window, the tail) moved nothing — the only wake in the entire record is Grant 2's command. Rejected |
| 3 | **Deploy / redeploy as stimulus** | The accepted alarm-semantics record struck redeploy-as-stimulus (its R3) from the escalation sequence, retaining it only as a considered speculative alternative. A deploy is also a production mutation with its own gate weight — grotesquely disproportionate as a doorbell — and the resume package proposes no deploy anywhere. Rejected as a mechanism; retained in this table only as the record retains it |
| 4 | **`SubmitJob` as the wake** | It would very likely wake (`handleCommand` runs for it), and it is forbidden for an independent reason that has nothing to do with waking: resume rides the **preserved plan only** — a SubmitJob would submit a new intent and duplicate the plan (resume package §1.1, HARD LAW; the attempt-3 disposition: resume rides the preserved plan, never a resubmission). Rejected absolutely |
| 5 | **A real command against a real job** (e.g. `RequestPause` on the preserved job or the parked job) | Side effects: a real command's apply can succeed, and success here means mutating the very state the gate exists to preserve (pausing the preserved job; touching the parked Ch 3 job, which is never a target). The probe target must be **nonexistent by construction** so that refusal is guaranteed in every state — that guarantee is what makes the wake side-effect-free, and only the nonexistent-target form has it. Rejected |
| 6 | **Relying on Julie's app use** (a position push constructing a fresh `PushPositionEvents` command) | It does reach `wake()` (resume package §5.3), and §2.4 of this analysis accepts its possible *effect* if the census finds one. As the gate's *mechanism* it is rejected on the package's own ground: Julie's app use "is not an executor-controlled step, and this gate does not schedule her behavior." A gate step must be performable by the executor, on the record, at its point in the sequence. Rejected as a mechanism; preserved as a census contingency (OQ-1(c)) |
| 7 | **Relying on the GR-3 halt flip or the GR-4 unpause to wake** | Rejected on source (resume package §5.3, candidate (iii)): the flip is Cloudflare metadata and the unpause is a queue act; neither reaches the coordinator. Carried here so the rejection set matches the package's |
| 8 | **Doing nothing — accept the stall shape** (lift the holds and let the §2.3.4 stall test discover the missing registration) | This is Phase B attempt 3's exact shape, whose disposition is the reason step-0 had to be resolved by design: verification would attach only after the system had been opened, the stall would burn the attempt's exposure window, and the record would show a gate that proceeded knowing its drive path was unregistered. R4 requires an explicit mechanism; "discover it in the stall test" is the absence of one. Rejected |

---

## 6. Interaction with OQ-2 — re-issuance after a void, as now observed

OQ-2 (resume package §9) asks, for branch GR-B: when the §7.3 grant stands voided and the holds later lift, does a drive pass issue a **new** grant for the occurrence — with what id, by what occurrence state path, and what job revision path? At package time "the records establish the void state… but do not establish re-issuance mechanics." **The window has since established the mechanics at observation strength, for the delivering-chain case.** What the window record (§5) shows, at every completed check from set 4 onward:

- When the live grant reached its **lease-expired void state**, a later pass issued its **sequential successor for the same single occurrence**: `seg:1:full` → `seg:2:full` → … → `seg:87:full` — **87 grants total**, each predecessor voided, never two live at any read (the log's cross-check: a concurrent second grant would have read reserved 24; reserved held at exactly **12** throughout).
- The **occurrence remained `granted` continuously** — at no completed read did it leave `granted` between a void and its successor's issuance.
- The **job revision incremented in lockstep with issuance**: rev 2 ↔ seg:1 issued; rev 3 ↔ seg:2; rev 25 ↔ seg:24 live; rev 49 ↔ seg:48; rev 73 ↔ seg:72; **rev 88 ↔ seg:87** — job revision = live grant's sequence number + 1 at every observation.
- The grant ids are therefore an **incremented sequence on the same stem** (`grant:plan:19cad189fab54b9c804a74a6:seg:N:full`), never re-used.

**What this establishes for the resume context — and what it does not:**

- **Established (observation strength, delivering chain):** OQ-2's three mechanics questions have observed answers — a new grant **is** issued after a void; its id **increments the sequence**; the occurrence's path is **stays `granted`** (no intermediate state was ever observed); the job's revision **increments by one per issuance**. §2.3.2's expectations can be written from these values without inventing any of them.
- **Not established — the context differences, named:** (i) every observed void→re-issuance transition happened **between two delivered passes of an already-delivering chain**, under both holds, with the queue paused. The resume context contains a transition the window never produced: a **cold restart** — the chain stopped (registration deleted), restored, and woken by GR-2 — whose **first** pass may find the standing grant (seg:87, issued at pass 294, 2026-11-04T20:57:49Z) already voided on its lease, or still live. Whether the first post-restart pass treats a pre-stop void exactly as the churning passes treated theirs is an **extension of the observed pattern, not an observation**. (ii) No observed churn pass ever **dispatched** (halt-fenced throughout), so the state path from re-issuance **to dispatch and completion** is unobserved in the churn context; the §2.3.1 completion values rest on the Gate 4 / Phase A records for other plans, as the resume package already carries them — the window adds nothing there, in either direction. (iii) The standing grant's lease state **at resume-gate time** is a census fact (GR-0 reads it fresh); this analysis predicts neither that seg:87 still stands nor that it will have voided by then.
- **Proposed disposition (Rowan rules — Q5):** OQ-2 is **NARROWED to the extension point**. This analysis proposes Rowan close OQ-2 for branch GR-B by adopting the observed pattern as §2.3.2's expectations — new grant, incremented id (`seg:88:full` if the standing grant has voided by the gate's first delivered pass, the exact number being a census/protocol observation, not a prediction), occurrence `granted` throughout, job revision incrementing per issuance — **with the cold-restart extension named in the package as an assumption at exactly that strength**, so the executor at GR-B knows which expectation is observed and which is extended. If Rowan instead holds OQ-2 open for the cold-restart sub-case, GR-B may not execute until the extension is otherwise evidenced, and GR-A (if its census form obtains) is unaffected. **This analysis does not close OQ-2; it reports the narrowing and proposes the disposition.**

---

## 7. Residual unprovables — named, not absorbed

- **Alarm delivery is platform behavior and cannot be proven in advance.** R1's limit is the analysis's limit: Grant 2 "establishes successful wake and observed drive activity, **not durable alarm-delivery reliability**." The proposed mechanism is therefore defined by its observed effect and its failure behavior (§§3–4), never by a promise: it is a mechanism whose success is *checkable* and whose failure is *survivable by construction* (discovered pre-lift, ends HELD), which is the strongest form an answer to OQ-1 can take on this record.
- **The post-stop / post-clear platform state has no live precedent.** C3 has never executed; restoration has never executed; no containment transition of any kind has ever run in production. The sequence stop → clear → wake has been run only in the harness (containment battery) and in design. The wake precedent (§2.2) is from a **never-stopped** chain. Source analysis says `wake()` arms on a null `getAlarm()` regardless of how the null arose (resume package §5.3) — that is a source claim about the composed build, and the composed build's R5a amendment "changes the past-due rule, not the wake paths" (§5.3) — but the end-to-end live sequence remains unrun, and this analysis does not represent it as run.
- **The unspecified region.** Post-retry-exhaustion `getAlarm()` semantics are UNSPECIFIED (register R-12): the registration state the restoration leaves, and the platform's treatment of registrations around a stop, sit partly in that region. GR-0's census reads what the surfaces show; the protocol's effect-based verification (§3) is designed to need nothing more.
- **Storage-effect ordering (R-02).** Whether a wake-initiated `setAlarm`'s effect could land after a later act's effect is unspecified; the protocol keys on observed effects, so an ordering surprise presents as a §4 failure or a §2.3 abort — detected, never assumed away.
- **The recorder blind spot (R-06).** A pass and its recording failing together is invisible on the row surface; §3.1's cross-check is the mitigation, and Q6 asks Rowan to fix its evidentiary weight. The blind spot cuts both ways, as the resume package's OQ-3 already notes; this analysis takes no position on OQ-3.
- **The D-value family (OQ-4's territory).** Prompt delivery after the wake is *expected* under R5a's past-due disjunct (the pending watchdog row is long past due), but D remains unobservable until the wake and the B-family (B1 leading) is not closed. The §3.2 bound absorbs any D inside 15 minutes; a D beyond it is a §4 failure by design, and OQ-4's question (whether any additional pre-lift observation is required) remains Rowan's to answer alongside Q2.

---

## 8. Questions for Rowan — the rulings requested

- **Q1 — the mechanism in principle.** Do you accept the fresh probe command — `RequestPause` against `alarm-wake-probe:nonexistent`, a newly minted command_id, via the client connector, exactly one per attempt, expected refusal `job_not_found` — as OQ-1's answer (the GR-2 fill), on the §2 evidence?
- **Q2 — the observation bound.** Do you rule the §3.2 bound (proposed: **15 minutes**, ≥1 complete poll / 5 min, pre-lift) — or set another? (And, with OQ-4: is any additional pre-lift observation required?)
- **Q3 — OQ-1(c).** Do you accept §2.4's satisfaction-by-observation (non-null, restoration-accounted `armedAt` at GR-0 ⇒ no probe sent, verification unwaived)? What accounting suffices?
- **Q4 — OQ-1(d).** Do you accept §2.5's ledger treatment (one command; the receipt named as ordinary command machinery; all other effects zero) for the resume package's §3?
- **Q5 — OQ-2's status.** Do you close OQ-2 on §6's observed pattern with the cold-restart extension named as an assumption — or hold it open for that sub-case (GR-B blocked meanwhile)?
- **Q6 — the R-06 cross-check.** Does an in-set grant transition without a recorder row satisfy wake verification (recorded as an R-06-class observation), or is the recorder row strictly required?
- **Q7 — the failure behavior.** Do you confirm §4's sequence (single wake; no retry in any form; pre-lift failure ends HELD with no re-hold needed; the failure recorded as a new W-4-class observation returning to you and Julie; a late delivery is a tail fact, not retroactive satisfaction)?

**What this analysis does not do:** it fills no slot by its own authority — GR-2 remains unfilled until Rowan rules; it authorizes no execution of the resume gate, of C3, or of restoration; it performs and requests no production act. On Rowan's rulings, the resume package's §5.3/§9 text is amended to carry them, as a separate filing.

**Contents of this filing:** the C3 branch-(d) reconciliation (`PHASEB-C3-BRANCH-D-RECONCILIATION.md`) + this analysis (`PHASEB-GENERATION-RESUME-OQ1-ANALYSIS.md`) + the companion cp (`PHASEB-C3D-OQ1-ROWAN-CP.md`), under one pin (`<PACKAGE-PIN>`), with verbatim sequential parts for any document exceeding ~30 KB (exact-concat verified).

**Turn: Rowan's.**

— Wren
