# Phase B — Gate C3 readiness package: OPERATIONAL containment verification (PARTIAL by construction)

**Status: READINESS PACKAGE — for Rowan's independent review. Nothing in this package is an execution, and nothing in it requests a GO. C3 executes only under Julie's separate explicit GO, after Rowan's review of this package.**

**PARTIAL BY CONSTRUCTION — stated first, unhedged:** C3's verdict, if it executes perfectly, is **PARTIAL**. C3 can verify containment's transition mechanics and the full physical stop act live, against the existing stale alarm registration, without provoking anything. C3 **cannot** verify drive suppression under a live revived chain, arm-gate suppression under genuine wake traffic, or the re-check against a real racing wake — those are observable only when a pass would otherwise run, and manufacturing one would make the gate a stimulus, which C3 is not. That remainder is **not** absorbed into this package, not discharged by C3, and not claimed anywhere below: it is returned for Rowan's separate ruling (§8), and S1 may not be proposed for execution until she rules on it.

**Predecessor state:**

- **Gate C1 is CLOSED** — containment deployed, execution PASS accepted by Rowan (record pin `43642bd865e77a588edf4e8d6fd4f93fae37499b`). Live build `27b2b3a9f1e7070ef243ee017703246744d57d5c`, script etag `adb8e5a5b104858a20835a17ffd714a70f72cea5e066c6d61c4b80a49adac46f`, containment inert at NORMAL.
- **Gate C2 is CLOSED** — execution PASS WITH QUALIFICATION (readability verified), record pin `13375e8d8c3d6d5ff26be84d99b878fc22adfa12`; D-1 accepted; D-2 documentary exception corrected in the companion document `PHASEB-C2-RECORD-CORRECTION.md` filed with this package (14 items fully verified; item 7 partially verified; the second-surface requirement recorded as UNFULFILLED). C2's GO is consumed.
- System **HELD**: GENERATION_HALT `"1"`, queue `opalreader-generation-v2` delivery paused. Production remains under INVESTIGATION HOLD.

**What Rowan's review of this package is and is not:** a documentary review of scope, census, the mutation ledger, expected results, STOP conditions, and GO wording — plus two rulings this package explicitly requests (§1.1 the build-basis question; §8 the unverifiable remainder). It is **not a GO** and authorizes no production act. Julie's GO is **not requested** in this package.

**Pin:** this package is pinned on `ui1-review` at `<READINESS-PIN>` (the pin value is resolved in the board filing for this package, per the established pin-slot pattern; the Dropbox copy of the companion cp carries the filled value, disclosed there and on the board).

---

## 1. Scope — what C3 does

C3 is the first live exercise of the containment transition path. It performs **operator transitions only** (state writes via the operator route `POST /v2/d6-containment` plus passive read-backs) and **one physical stop act against the CURRENT stale alarm registration** — `armedAt` **1793562576104** (2026-11-01T19:49:36.104Z, observed Nov 2, 2026), the registration left over from the attempt-3 stall, still current at every read since. The stop act is **subtractive**: it observes the registration, deletes it, and reads back. C3 **sends no command, induces no wake, delivers no pass, and manufactures no traffic of any kind.** An operator containment transition is not an alarm wake: it does not deliver a pass, does not evaluate the schedule, and registers nothing — `contain_drive` and `clear` touch no alarm API at all, and `stop_chain`'s only alarm-API acts are the subtractive `deleteAlarm()` and `getAlarm()` reads.

In order, C3 (ledger §3):

1. **C3-0** — full preflight census (§4), including the armedAt expectation.
2. **C3-1 / C3-2** — `contain_drive`, read back on both surfaces: transition mechanics end-to-end on the production build (applies, persists, projects identically).
3. **C3-3 / C3-4** — a reasoned `clear` back to NORMAL under design §5.2, restoring the gate's own opening state. This clear is the ONLY clear inside C3 and applies only to the DRIVE_CONTAINED mechanics leg — it is **not** a restoration (see §2).
4. **C3-5** — `stop_chain`: the full physical stop act against the stale registration — state commit (enum + episode minted), physical act (observe → `deleteAlarm()` → read-back), stop-record write — ending, on the no-failure path, with the stop **verified** (`getAlarm()` read back null).
5. **C3-6** — `verify_chain_stop` retries, ONLY if C3-5 ended unverified, within the episode bound (§3.2).
6. **C3-7** — closing census repeat + both-surface stop-record read-back, delta checked against the ledger.

**C3 ends CHAIN_STOPPED / verified** (no-failure path). It does not end at NORMAL, and it does not restore anything (§2).

### 1.1 Build-basis question — RULING REQUESTED (read this first)

The accepted gates text (PHASEB-RECOVERY-GATES-V4-REVISED.md, Gate C3) scopes C3 **"on the composed build"** and sets its preflight as "Gates C1, C2 (READABILITY VERIFIED), **R5a-D all closed**. CENSUS re-based to the composed build." The build actually deployed today is the **containment-only candidate** (C1's build, `27b2b3a9…`); the composed build (containment + the R5a arming change) has **not** been deployed — R5a-D has not executed. This package is drafted, per its assignment, against the **deployed** build, and it does **not** silently decide the discrepancy. The facts Rowan needs:

- The containment code C3 exercises — the transition table, the stop act, `verify_chain_stop`, the read discipline, `deriveStopConfidence` — is **identical in both trees**. Entry (`2bb0608b…`) and service (`5c5183e6…`) parts are byte-identical across the candidate and composed trees. The composed coordinator (`5303cb63…`, 314,712 B) differs from the candidate coordinator (`6c19a50e…`, 313,063 B) by the R5a change to the `_armAlarmIfEarlier` arming condition (plus one comment line) — a code path C3 never exercises: C3's `setAlarm` budget is **0**, it issues no wake and no command, and no C3 step's outcome depends on the arming condition.
- The containment battery runs **42/42, exit 0 on BOTH trees** (logs §8), including CT16a — the C3 sequence end-to-end — on each. Nothing about C3's mechanics is untested on the deployed tree specifically.

**The two dispositions, for Rowan's ruling:**

- **(i) C3 executes on the deployed containment build.** R5a-D remains a separate later gate. Consequence, stated honestly: if R5a-D later deploys the composed build, that build's *operational* containment behavior would rest on the harness battery plus this gate's evidence by analogy — the composed build itself would not have had a live stop act performed on it, unless a further operational check is gated then.
- **(ii) R5a-D executes first** (its own readiness package, review, GO, and battery re-run on the composed tree), and this package's census is then re-based to the composed build (only §4's build/etag expectations and §8's basis note change; the ledger, STOP rules, and GO wording carry over with the basis named), exactly as the accepted gates text wrote it.

This package's census (§4) and GO wording (§7) are written on basis **(i)** — the only build that exists in production — and are **not executable until Rowan rules on this section**. If she rules (ii), the package returns with the census re-based; no other section's substance changes.

---

## 2. The restoration dependency — read before anything else in this package

**C3 ends the system CHAIN_STOPPED.** In that state the alarm chain is physically stopped: the stale registration is deleted, and on the shipped surfaces the chain cannot re-register itself (re-registration happens only through the ordinary wake paths under NORMAL). Concretely, while CHAIN_STOPPED stands:

- The 10-minute watchdog cannot run; no drive pass can occur; **no grant/void cycle can turn**.
- The preserved Phase B plan (`plan:19cad189fab54b9c804a74a6`) remains **preserved, untouched, and unexecutable** — containment changes nothing about its state; it simply has no mechanism that could drive it. The live idx-26 exemption is likewise untouched.
- Generation remains halted regardless (GENERATION_HALT `"1"` and the paused queue are independent holds and are not touched by C3 or by containment state).

**Returning to NORMAL is NOT part of C3** — not in its scope, its budget, or its GO. The return is the **standalone restoration authorization**: a separate named approval by Julie, after Rowan's review of C3's execution record, requiring ALL of: a fresh census executed at its start (whose reads re-observe the physical state and derive `stopConfidence` fresh — the C3 record alone never carries the physical stop into the restoration, per V4-2); a demonstrated reason recorded in the `clear` audit event; the design §5.3 preconditions (including that C3 ended `verified`); and the **mandatory historical audit review** (V4-1): the full append-only audit history (`d6_containment_events`) read and attached, EVERY stop episode in that history enumerated with its exhaustion status taken from the history — the `prevEpisode*` summary alone is insufficient on its face, because it holds only the most recent closed episode and is overwritten by later clears. If any episode in the history is exhausted, the restoration must additionally name the R3-V authorization (§3.2) under which any later stop/verify work would proceed.

**What Julie is deciding, when the C3 decision eventually comes to her:** to deliberately enter a stopped state whose exit is a *separate future decision* with its own review, census, and GO. The stop act itself is irreversible by any operator act inside C3 — a deleted registration cannot be un-deleted; that irreversibility-without-restoration is the gate's design (it is the point of a stop), and it is why the stop's precondition (the armedAt expectation) is census-hard.

---

## 3. The mutation ledger — exact, action by action (carried from gates v4 REVISED)

Reads (preflight, per-step read-backs on both surfaces, closing census) are passive and are not mutations; they are listed where a step's DECISION rests on one. "State write" = one committed transaction touching the `d6_containment_state` singleton row. "Audit row" = one append to `d6_containment_events`. Alarm ops are physical platform acts.

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

### 3.1 Budget totals

**Worst-case totals for C3 (all steps, all failure branches):** state writes **≤6** (C3-1 ×1, C3-3 ×1, C3-5 ×2, C3-6 ×2); audit rows **≤7** (C3-1 ×1, C3-3 ×1, C3-5 ×2, C3-6 ×3 incl. the exhaustion event); `deleteAlarm` **≤3** (C3-5 ×1 + C3-6 ≤2); `setAlarm` **0** (any registration appearing during C3 that C3 did not delete is a STOP-and-classify event — nothing in C3 arms); commands / reports / SubmitJob / uploads / PATCHes / hold flips / queue changes: **0**. Recorder rows: 0 expected (no pass is provoked; a spontaneous row is classified and reported as opportunistic evidence, never budgeted). Spend: $0. **Expected (no-failure) totals: state writes 4, audit rows 4, `deleteAlarm` 1.**

**Rollback limits:** the mechanics leg is reversed by its own C3-3 step. The stop act has **NO rollback inside this gate**: a deleted registration cannot be un-deleted by an operator act — re-registration happens only through the ordinary wake paths under NORMAL, i.e., only after the standalone restoration (§2).

### 3.2 The verify-attempt bound and the R3-V micro-scope

- `MAX_STOP_VERIFY_ATTEMPTS = 3` **per episode** (the `stop_chain` act is attempt 1; C3-6 supplies attempts 2 and 3). The bound is **provisional** (register R-05 family; Rowan's acceptance is of the mechanism, not of the number as a platform-derived constant).
- **Exhaustion is a hard stop.** When attempt 3 ends unverified, the episode is EXHAUSTED (state flag + `stop_episode_exhausted` audit event, written in the same transaction as the attempt's record). Further `verify_chain_stop` calls against that episode are refused by code BEFORE any physical act and write nothing. C3 then ends STOPPED-unverified and returns for ruling. **Exhaustion is never worked around inside C3.**
- **Clearing CHAIN_STOPPED is NOT a retry reset.** A clear + re-stop mints a new episode in code, but presenting that as a fresh verification budget is a stated violation (register R-08): the anti-circumvention rule is paperwork-enforced, resting on the mandatory historical audit review.
- **The only path onward after exhaustion is the R3-V micro-scope:** a separately scoped authorization requiring (i) the historical audit review of the full append-only history, (ii) a fresh Rowan ruling, and (iii) fresh Julie authorization. R3-V is not part of C3, is not pre-authorized by C3's GO, and is not requested here.

### 3.3 §R — STOP and re-entry procedure (no duplicate physical acts)

The two facts are kept separate at every step (V4-2):

- **RECORDED LOGICAL COMPLETION** — the record (audit rows, stop-record fields) shows the code path ran and committed its account of the step. A record proves a step was RECORDED. It never, by itself, proves a physical act landed.
- **PHYSICAL VERIFICATION** — a fresh live read, made at re-entry, re-establishes the physical fact: for the stop act and the verifies, a `getAlarm()` observation read against the stop record's verification fields. A physical step is credited physically complete ONLY when the fresh read corroborates the recorded outcome.
- **UNRESOLVED** — any step whose record and fresh physical read disagree, or whose physical state cannot be freshly read. An ambiguous response leaves its step UNRESOLVED until a physical read resolves it — never resolved by the executor's memory, never by the audit row alone.

On any STOP mid-ledger, or before resuming after ANY interruption (including an executor restart):

1. STOP all further acts. Preserve the gate record as-is.
2. Re-read, in this order: the containment state route, the `drive=1` projection, and the audit event listing. These three reads — never the executor's memory — determine what has been RECORDED. (They do not yet determine what has physically happened; that is step 4.)
3. Mark each ledger step RECORDED-complete iff its idempotency key is present in the record: the step's audit row and, for C3-5/C3-6, the stop-record fields (`stopVerifyAttempts` is the authoritative RECORDED attempt count — counting is a record fact, and counting a possibly-unlanded attempt as consumed errs conservatively). Pure state-write steps (C3-1, C3-3) have no separate physical fact beyond the state the record itself holds: for them, recorded completion read back consistently on both surfaces IS their completion criterion.
4. For each physical step (C3-5, each C3-6 call), make a FRESH `getAlarm()` read at re-entry and classify: (a) fresh read corroborates the recorded outcome → PHYSICALLY VERIFIED to the recorded extent; (b) fresh read CONTRADICTS the record → UNRESOLVED: STOP and classify — the physical truth governs what remains, and the only permitted resumption act for the stop is `verify_chain_stop` within the episode bound; (c) no fresh read can be obtained → UNRESOLVED; the gate does not resume on the record's word.
5. Resume ONLY at the first step that is neither RECORDED-complete nor PHYSICALLY VERIFIED to the extent its ledger row requires, with two hard rules: a `stop_chain` whose audit row exists is NEVER re-sent (an unverified or unresolved stop resumes exclusively through `verify_chain_stop`); a `deleteAlarm` is only ever issued by the code paths that first observe a registration in the same act, so a resume cannot delete blindly or twice (harness-proven: CT16b/CT16c assert the landed-delete count across stop + resume).
6. If the reads cannot establish what was recorded (surfaces disagree, record unreadable), or a physical step remains UNRESOLVED after step 4, the gate does NOT resume: it returns for ruling with the reads attached.

---

## 4. Fresh census — hard preflight expectations (C3-0; values observed Nov 2, 2026)

The C3-0 census must match **every** item below exactly before any mutation. These are **dated observations, not presumed current facts**: each value is labeled with where it was last observed, and any deviation at execution is a STOP (§6) — the executor never rationalizes a difference. This census deliberately repairs the C2 item-7 defect (see `PHASEB-C2-RECORD-CORRECTION.md` and its standing paperwork rule): **item 7 enumerates both phase-accounting reads by name**, so the item covers exactly the surfaces it claims.

| # | Item | Hard expectation | Last observed |
|---|---|---|---|
| 1 | Health | build `27b2b3a9f1e7070ef243ee017703246744d57d5c` *(build-basis ruling §1.1 pending — if Rowan rules (ii), this line is re-based to the composed build before execution)*; generation `halted`; coordinator `armed` | C2 closing set, 2026-11-02T21:22:19Z |
| 2 | Script identity | etag `adb8e5a5b104858a20835a17ffd714a70f72cea5e066c6d61c4b80a49adac46f` | C2, all sets (ETag header only; body never read) |
| 3 | Bindings / holds / observability | exactly 10 bindings; GENERATION_HALT `"1"`; `OPALREADER_PHASE_POLICY` `"enforce"`; observability enabled + `logs.persist: true` | C2, all sets |
| 4 | Settings | revision **1** (lane standard, cap $50) | C2, all sets |
| 5 | Queue | `delivery_paused: true`; exactly 1 consumer (`f260f2188d80426bb0588685e9d084eb`) | C2, all sets |
| 6 | Capabilities | standard admitted; Batch `batch_not_armed`; registry `forever-pucked` ↔ `5c589095-f812-48a2-8ab2-03ba2791f2b2` | C2, all sets |
| 7 | Phase accounting — **BOTH surfaces, each enumerated**: (a) the capabilities phase block (`GET /v2/generation/capabilities`); (b) the plan-diagnostics body `plan.phaseAccounting` (`GET /v2/d6-diagnostics?planId=plan:19cad189fab54b9c804a74a6`) | settled **1,029,420**; estimatedUnverified **19,018**; reservedUnverified **5,648**; inFlightUpper **0**; unknownOpen **0**; remaining **12,464,932** of 13,500,000 — exact on (a), and exact on (b) in its field names (`settledMicroCents` etc.) | (a) C2, all sets; (b) C1 census/verification (`diag-pb` reads) — **not** re-read in C2 (the D-2 gap this item repairs) |
| 8 | Quota | reconcile `ok: true`, drift empty, sole exception the adjudicated straddler `att-37d63768-db4b-447d-8150-580b7c6ee257`; PT dispatched 2026-10-29 / 10-30 / 10-31 / 11-01 = **57 / 79 / 44 / 76**; **0 for 2026-11-02 and every later PT day** at census time (any nonzero = movement); derived reserved **0** | C2, all sets |
| 9 | Plans | exactly 5 (smoke `complete`; old Ch 2 `retired`; fresh Ch 2 `complete`; Ch 3 `complete`; Phase B `plan:19cad189fab54b9c804a74a6` `active` {eligible 1, done 0, failed 0, blocked 0}, entry `pending` / `executionState: null`, job `queued` rev 1, quarantine `held: false`, grants []) | C2, all sets |
| 10 | Eligibility | chapter bound **26** / parked **0** / eligible **1**; segment eligible **1** / **569** chars / **8,022**; all three scope digests exactly `cdef2c7ec7bb8434b4e2fac66af49983ac7fa4b4e65bb0eda40354be51ff52d1` | C2, all sets |
| 11 | Conflicts | exact match to the pinned four-row `schedule_dead` lease baseline (ids 1–4, all fields) | C2, all sets |
| 12 | Parked job | `1832c21fcf0425454227c4736048a8a632f422abca4a2685ddb775bb1681406a` `parked_policy` rev 1, fingerprint `b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282`, grants [] | C2, all sets |
| 13 | Watermarks + occupancy | content **18**; bindings **1841** with 0 changes since; idx-26 R2 key FREE (LIST empty) | C2, all sets |
| 14 | `drive=1` baseline incl. the stop act's target | `tableState: "missing"`; `drivePasses: []`; `recorderHealth: null`; **`armedAt` exactly 1793562576104** (2026-11-01T19:49:36.104Z); `pendingSchedule` **2**; `pendingWatchdog` **1** | C2, all sets (bit-identical) |
| 15 | Containment projection (both surfaces) | state `NORMAL`; `absent: true`; `verified: true`; `stopConfidence: "not_applicable"`; stop-record and episode fields at their empty values | C2, all sets, both surfaces |

**The armedAt expectation is census-hard in its own right** (gates v4, Gate C3 preflight): any value other than 1793562576104 at C3-0 — including null — is a STOP. The registration state has moved, and the stop act's expectations must be re-derived under a fresh ruling, not improvised by the executor.

**Executor precondition (process, not a read):** Julie's GO recorded on the board before C3-0; Rowan's §1.1 build-basis ruling on file; no other gate or operator action outstanding.

---

## 5. Expected results, step by step

The stop record keeps its **three facts separate** at every stage (design v4 §2): (i) the **state enum**; (ii) the **physical verification record** — `stopStatus`, `stopVerifiedAt`, `stopVerifyAction`, `stopArmedBefore`, `stopArmedAfter`, `stopVerifyAttempts` — of which the `stopVerified*` fields record the most recent SUCCESSFUL verification and are never erased by a later failure; (iii) the **stop-verification status as displayed** — `stopConfidence`, derived read-side by `deriveStopConfidence(read, fresh)` from the record plus the surface's own fresh `getAlarm()` observation in the same request. No surface may display `stopStatus` alone as a present-tense claim; `stopConfidence` is the present tense.

| Stage | Expected durable result | Expected projection (both surfaces, identical in substance) | Expected `stopConfidence` (truth-table row) |
|---|---|---|---|
| C3-0 census | no writes | NORMAL / absent / verified; stop + episode fields empty; `armedAt` 1793562576104 | `not_applicable` (row 1 — readable non-stopped record) |
| C3-1 `contain_drive` applied | state write ×1; audit `contain_drive:applied` ×1 | state DRIVE_CONTAINED; `absent: false`; stop + episode fields still empty; alarm block unchanged (`armedAt` 1793562576104, pending 2/1 — the transition touches no alarm API) | `not_applicable` (row 1) |
| C3-2 read-back | no writes | as C3-1, both surfaces agreeing | `not_applicable` |
| C3-3 `clear` applied (reason recorded verbatim: "Gate C3 mechanics leg: restore opening state") | state write ×1; audit `clear:applied` ×1 (reason in the event); NO episode event (no stop episode is open) | state NORMAL; opening state restored exactly (stop + episode fields empty) | `not_applicable` (row 1) |
| C3-4 read-back | no writes | as C3-0's containment projection | `not_applicable` |
| C3-5 `stop_chain`, no-failure path | state write ×2 (commit, then stop record); audit ×2 (`stop_chain:applied` — its row id is the episode id; `stop_chain_verify:verified`); `deleteAlarm` ×1 | state CHAIN_STOPPED; `stopStatus: "verified"`; `stopVerifiedAt` = the act's timestamp; `stopVerifyAction: "stop_chain"`; `stopArmedBefore: 1793562576104`; `stopArmedAfter: null`; `stopVerifyAttempts: 1`; `stopEpisodeId` = the `stop_chain` audit row id; `stopEpisodeExhausted: false`; `armedAt: null`; `pendingSchedule` 2 / `pendingWatchdog` 1 **unchanged** (the stop preserves schedule rows) | `verified_current` (row 3 — recorded success + the surface's fresh null agree) |
| C3-5, unverified branch (delete throws, or read-back throws / non-null) | state write ×2; audit ×2 (`stop_chain:applied`; `stop_chain_verify:unverified`); outcome `rejected/containment_stop_unverified` | state CHAIN_STOPPED; `stopStatus: "unverified"`; `stopVerifiedAt: null`; `stopVerifyAttempts: 1`; episode open, not exhausted; `armedAt` as physically observed (a surviving registration reads its value) | per fresh evidence: fresh value present → `contested` (row 8); fresh null → `unverified` (row 7); fresh read failed → `unknown` (row 9); no fresh observation → `unverified` (row 10) |
| C3-6 verify, success (attempt 2 or 3) | per call: state write ×1; audit ×1 (`verify_chain_stop:verified` / re-verified event) | `stopStatus: "re_verified"`; `stopVerifiedAt` updated; `stopVerifyAttempts` = the succeeding attempt number; `stopArmedAfter: null` | `verified_current` (row 3 family — `re_verified` counts as verified) |
| C3-6 verify, failure (attempt 2) | per call: state write ×1; audit ×1 (verify outcome: unverified) | `stopStatus: "unverified"`; **`stopVerifiedAt` unchanged** (a failure never erases the last-success record — in this gate's flow C3-5 was unverified, so it remains null); attempts = 2; episode open | rows 7–10 as above, by fresh evidence |
| C3-6, attempt 3 unverified — EXHAUSTION | state write ×1 (carries `stopEpisodeExhausted: 1`); audit ×2 (verify outcome + `stop_episode_exhausted`) | state CHAIN_STOPPED; `stopEpisodeExhausted: true`; gate ends STOPPED-unverified; returns for ruling (R3-V is the only path onward) | `unverified` / `contested` / `unknown` by fresh evidence — never a verified display |
| C3-7 closing census | no writes | every census item identical to C3-0 EXCEPT the ledger's own writes: containment projection as at the final C3-5/C3-6 stage; `armedAt: null` (no-failure path); containment state + audit tables now EXIST (created by the transitions — expected, and the only table-creation in the gate); recorder baseline otherwise identical (table still `missing`, 0 rows — no pass was provoked) | as at the final stage |

**Preservation expectations across the whole gate:** every non-containment census figure (items 1–13) is identical at C3-0 and C3-7; dispatched stays 0 on every PT day; no grant, reservation, plan, job, conflict, watermark, or phase figure moves. The ledger's own writes (containment state + audit, the one registration deletion) are the ONLY deltas, and the closing delta table is checked against §3.1's worst-case totals.

---

## 6. STOP conditions

Any one of these stops the execution immediately. The executor performs no further act beyond capturing the finding itself (and the §R reads), preserves all evidence, and reports. The GO is consumed by the attempt either way. There is no in-gate recovery path for any STOP except the ledger's own C3-6 branch (condition 5) and the §R re-entry procedure under the same GO after an interruption (condition 8).

1. **Any C3-0 census deviation** — any §4 item not exact, **including any `armedAt` other than 1793562576104** — STOP before any mutation (executor STOP law).
2. **Any transition rejected or non-applied** outside the ledger's named failure branches (illegal transition, unreadable state, missing reason) — STOP and classify; no writes beyond those the rejection itself made (a rejection makes none).
3. **Cross-surface disagreement** at any read-back — the two containment surfaces disagree in substance, or a surface returns a shape outside the design's specified projections — STOP. (The surfaces read one store — register R-13 — so disagreement is itself an anomaly to classify, never something to average.)
4. **Any movement outside the ledger** — any census figure other than the containment state/audit and the deleted registration changes; a registration appears that C3 did not delete and cannot account for; a recorder row appears (a spontaneous pass is movement to classify, not evidence to use); dispatched > 0 — STOP and escalate. This is the C1 Class B rule carried into C3: unexplained movement authorizes **no** response act inside this gate — no rollback exists for the stop in any case (§3.1), and no other remediation is in scope.
5. **The stop act ends unverified and the episode bound is reached** — C3-6 attempts exhausted (§3.2): STOP; C3 ends STOPPED-unverified; the package returns for ruling. No clear, no re-stop, no further verify — R3-V or nothing.
6. **Any ambiguous response that a fresh read cannot resolve** — a step remains UNRESOLVED after the §R step-4 fresh `getAlarm()` read (the read contradicts the record, or no fresh read can be obtained) — STOP; the gate does not resume on the record's word.
7. **Verify-attempt accounting uncertainty** — the recorded attempt count cannot be established from the record (audit unreadable, surfaces disagree on the count) — STOP. Attempts are never counted from the executor's memory.
8. **Interruption** (executor death, lost session, infrastructure restart) at any point — the attempt halts where it stands; resumption is ONLY via §R under the same GO, beginning from the three §R reads. A stopped C3 is never restarted fresh on anyone's interpretation; if §R cannot establish the recorded state, the gate returns for ruling.
9. **Any hold disturbed** — GENERATION_HALT ≠ `"1"`, queue not paused, settings revision moved, observability reset — at any read-back: STOP and escalate. C3 carries no PATCH or flip budget and repairs nothing.

---

## 7. Exact GO wording (for Julie's future decision — NOT requested here)

When Julie chooses to authorize one C3 execution, the operative wording is (following the accepted gates text, with the restoration dependency stated in the GO itself):

> "GO — execute exactly one Gate C3 attempt as pinned at `<READINESS-PIN>`, on the build basis Rowan ruled under §1.1: preflight census including the armedAt expectation (1793562576104), the contain_drive + reasoned clear mechanics pair, and exactly one stop_chain act against the current registration (with verify_chain_stop retries only within the design's attempts bound of 3 if the stop is unverified), passive read-backs only, NO command, NO wake provocation, NO stimulus of any kind, ending HELD in CHAIN_STOPPED. I understand C3's verification is PARTIAL, that C3 does not restore NORMAL, that the return to NORMAL needs its own separate standalone authorization with a fresh census, a recorded reason, and a historical audit review, and that the deleted registration cannot be restored by this gate."

Rowan's review of this package is not a GO. This package requests no GO. Production remains under INVESTIGATION HOLD, ending HELD.

---

## 8. Evidence status — what is proven, what remains platform-unobserved

**No new code and no new battery belong to C3.** The deployed build is the C1-deployed containment-v4 candidate, byte-identical to the tree the battery below ran on. Per the accepted gates text, the battery re-run is NOT repeated at C3 (no code changes in this gate; the C1 gate-time records stand).

**Harness evidence for the exact paths C3 exercises** — containment battery v4 + CT14d, **42/42 pass, exit 0**, complete runs on the exact candidate tree (log SHA-256 `96c76d17446b9821f519bdbb5ed9673c7c205d8769eac35c8a6f66794bf9fd8b`) and on the composed tree (`a3b5e310720146e70a245e8a097b107abbf64fef64a252c05883b0dba595421f`), re-run again on the gate-assembled tree at C1 (42/42, exit 0, with the P2 parameterized regression 32/32, exit 0 — combined log `ffa4e58a…`). The stop-path coverage, by group:

- **CT16a** — the C3 sequence end-to-end (contain → stop against the stale registration → verified), with ledger writes asserted against the audit.
- **CT16b / CT16c** — partial failure at the delete step and ambiguous-response re-entry: resume exclusively via `verify_chain_stop`; landed-delete counts asserted across stop + resume (no blind or double delete).
- **CT11a–f** — verify semantics: retry of a failed delete; confirmation from a null read-back without re-deleting; refusal outside CHAIN_STOPPED; the attempts bound enforced; a failed verify never downgrades; verify on an already-verified stop is an idempotent confirmation.
- **CT12a–c** — clear law: reason required at method and route and audited; clearing CHAIN_STOPPED never re-arms; no automatic clear anywhere.
- **CT13a–f** — the async races: a wake parked at `getAlarm()` cannot resurrect the chain after a stop lands mid-wake (the post-await gate re-check); contain/stop landing mid-pass; darker-branch behavior on read failure at the re-check.
- **CT14a–d** — the full `deriveStopConfidence` truth table (all 14 rows), surface degradation behavior, and row 1's readable-record precondition (CT14d).
- **CT15a–c** — episode law: exhaustion recorded durably at the moment the bound is reached and refusal thereafter writes nothing; clear closes the episode with the summary preserved and the exhausted history disclosed; verify still refuses on the same episode after exhaustion even if the physical fault clears.
- **CT3/CT6 family** — the verified stop itself: `deleteAlarm` read back null, schedule rows untouched, later wakes register nothing, a delivered pass under CHAIN_STOPPED is contained and does not re-arm.

**What remains platform-unobserved even after a perfect C3** (stated, not absorbed):

- **The unverifiable remainder (returned for Rowan's separate ruling):** drive suppression during a live chain (observable only when a pass would otherwise run); arm-gate suppression under genuine concurrent wake traffic; the re-check against a real racing wake; any property of a REVIVED chain's behavior under containment. Harness-proven (CT13/CT16) is not live-proven. **S1 may not be proposed for execution until Rowan rules on how — or whether — this remainder is discharged.**
- **Platform storage-effect ordering** (register R-02): whether an earlier-initiated `setAlarm` can take effect after a later-initiated `deleteAlarm` completes is unspecified. C3's stop rests on its read-back, not on ordering — but a registration whose effect landed after the verified read-back would be detected only at the next successful dual read, and at no earlier moment.
- **Post-exhaustion `getAlarm()` semantics** (R-12): the stale value C3 deletes sits in the platform's unspecified region (~20 h past due at first observation). C3 observes the delete's read-back live, which is evidence about THIS registration; it does not document the platform's general behavior.
- **Durable Object runtime adoption-in-full** (the C1-2 limitation): C3's transitions are answered by the serving instance(s); a successful stop act is strong evidence the acting instance runs the containment code, and no more than that.
- **The recorder dual-failure blind spot** (R-06): unchanged by C3; C3 provokes no pass, so the recorder is expected to stay silent throughout — its silence in C3 is predicted, not informative.

---

## 9. Risks bearing on C3 (register, at corrected strength) + C3-specific

Register entries are cited from `PHASEB-UNRESOLVED-RISK-REGISTER-REVISED.md` (14 open of 15; R-14 resolved). Nothing here is mitigated by being listed.

- **R-07 — Containment suppression under a live chain is unverifiable before S1.** This is C3's remainder (§8). Bounded by harness proof (CT13/CT16) + C3's PARTIAL verdict discipline; S1 may not run until Rowan rules on the remainder. *C3 does not reduce this risk; it exists alongside a C3 PASS.*
- **R-02 — Cross-invocation storage-effect ordering.** JS initiation order is proven; platform storage-effect ordering is not (the v3 "last physical act wins" claim was withdrawn by name). A surviving registration is detected **only** at the next successful dual read that actually occurs — a divergence nobody reads for is a divergence undetected, indefinitely; a failed leg yields `unknown`, not detection. *For C3: the stop's verified read-back is a true observation at that moment; it is not a guarantee about any later-landing effect. The C3-7 closing census and C2-style future reads are the detection surface.*
- **R-15 — Commit-to-record uncertainty.** The stop act is not one transaction: enum commit (+ `stop_chain` audit row) lands first, the physical act next, the stop-record write last. Inside that window — permanently, if death occurs there — the record cannot say whether a `deleteAlarm` was issued or landed; a landed delete with no record write is indistinguishable in the record from a delete never attempted. Only a fresh `getAlarm()` read at re-entry separates the cases, which is why §R credits physical completion from live reads alone. *C3 carries this risk in exactly one place: a death between C3-5's commit and its record write. §R is the mitigation; the risk is not eliminable on shipped primitives.*
- **R-13 — The lying-read residual.** The darker-branch rules cover UNVERIFIABLE reads; a storage read that successfully returns a WRONG NORMAL cannot be detected by construction. The two surfaces read the SAME store and do not corroborate each other. The actual bound is narrower than "both surfaces agree": gate-preflight census cross-checks against facts containment does not control (plan/job/phase/queue state) can catch a wrong NORMAL that contradicts them, **at preflight time only**; between reads, nothing detects it at all.
- **R-01 — Cross-invocation serialization (assumption A-3).** The design assumes DO invocations do not interleave their synchronous stretches across isolates; platform documentation does not guarantee this in the needed form. Bounded by the transition table and verified-read preconditions (a lost race is REJECTED rather than corrupt) and the arm re-check, which removes the one proven defect (CT13). *For C3: C3 stages no concurrent traffic of its own, so its exposure is to foreign wakes racing its transitions — the CT13 posture, harness-proven, platform-unproven.*
- **R-12 — `getAlarm()` semantics after retry exhaustion are UNSPECIFIED.** The value C3 deletes (1793562576104, ~20 h past due at first observation) sits inside that unspecified region. Bounded by: every gate treats the value as a hard re-read expectation, never an assumption (R6 discipline). *For C3: if the platform's representation of this registration differs from what `getAlarm()` reports, the stop act's observe step is where that would surface — as an unverified stop or a STOP, not as a silent success, because success is claimed only from the post-delete read-back null.*
- **R-08 — Exhausted-episode circumvention is paperwork-enforced only.** The code cannot distinguish a legitimate new stop from a clear + re-stop intended to reset an exhausted episode's budget; the `prevEpisode*` summary holds exactly ONE closed episode and is overwritten by the next clear, so an older exhausted episode is visible **only** in the append-only audit history. Enforcement rests on the mandatory historical audit review (restoration and R3-V preconditions). *For C3: C3 mints the FIRST episode, so circumvention is not a C3-execution risk; it is the reason C3's record and the audit history it creates must be preserved intact — they are the evidence every later authorization reads.*
- **R-06 — Recorder dual-failure blind spot.** If a drive pass and its recorder write both fail, the pass is invisible on every shipped surface. *For C3: bounded by the census cross-checks — an invisible pass under the holds could have done nothing outside the pre-classified grant set, and any grant/reservation movement is a §6 condition-4 STOP.*

**C3-specific risks (not register entries):**

- **One-way door.** C3's stop act is irreversible inside the gate (§2, §3.1): if C3 verifies the stop, the chain stays stopped until the standalone restoration is authorized and executed. A C3 GO is therefore a decision to *be* stopped for an interval whose length Julie controls only through a later, separately-reviewed decision. There is no "undo" step to reach for if priorities change mid-interval.
- **STOP_UNVERIFIED is a possible end state, and here is what it means operationally.** If the physical stop cannot be verified within the bound, C3 ends with the system reporting CHAIN_STOPPED / **STOP_UNVERIFIED** (a reported outcome, not a stored state): the enum says stopped, the record says unverified, and `stopConfidence` displays `unverified`, `contested`, or `unknown` — never a verified claim. Behaviorally the system takes the **darker branch everywhere**: the drive gate treats the state as contained and the arm gate treats arming as stopped, so nothing can drive the preserved plan and nothing can re-register the chain through the gated paths — the system *behaves* stopped while *honestly reporting* that the physical stop is unproven. The schedule rows are preserved untouched. Exits from that condition are only: further verification under an R3-V authorization (if the episode is exhausted), or the standalone restoration (which itself requires its fresh-census corroboration and does not proceed on the record's word if the census contradicts it). Nobody should read STOP_UNVERIFIED as "probably stopped, carry on": it is a held, escalated end state that returns to Rowan.
- **The stale registration is the only target.** C3's stop act is written against exactly one observed registration (armedAt 1793562576104, census-hard). If anything about the registration state has changed by execution time, C3-0 stops the gate — C3 as pinned cannot be "adapted" to a different registration by the executor.

— Wren
