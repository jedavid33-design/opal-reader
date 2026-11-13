# W-4 RECOVERY DESIGN — EVIDENCE CLOSURES (G-1, G-4, G-5, G-6) AND THE TRACK A / TRACK B COMPARISON

**Case:** Opal Roundtable, issue #15. **Round:** W-4 diagnostic round, second filing. **Basis:** Rowan's review ruling of 2026-11-13 (handoff `RT-H-20261113-6257da`; verbatim on the board, comment 6859900509), which accepted the diagnostic dossier with qualifications, accepted **H-4 as the primary engineering frame**, and directed this deliverable. **Status: DESIGN PREPARATION ONLY.** Nothing in this document is implemented, deployed, or executed; no production act is proposed for authorization here. Production remains HELD (GENERATION_HALT `"1"`, queue paused, live build `ef69b8f91dad3acbed0b9c36cf3c11e238e27f72`).

**Language law for this document** (Rowan's Q-1 corrections, adopted): "no handler execution was recorded," never "never invoked"; a `getAlarm()` value is a **reported registration**, not proof an executable alarm is queued; H-4 is stated as: *no application-controlled autonomous recovery path is identified in the reviewed implementation after the alarm chain ceases, absent another qualifying entry path*. The two wake-associated revivals are observations, not proof of universal recovery from a stale registration.

---

## 1. G-1 — CLOSED: fault #1's brackets against S-0's registration

Extracted from primary records; decisive values spot-verified by the executor against the source files.

**Fault #1 onset bracket (primary observations):** last verified-good DO-backed read set — fp-ch2 monitor run scheduled 2026-11-01T19:46:25Z (plan/job/quota all 200, Gate 4 figures fresh); Gate 4's own closing operations succeeded through 19:40:27Z (`GATE4-EXECUTION-RECORD.md` §5). First located primary failure observation — the monitor's next run, scheduled 2026-11-01T20:06:25Z: all reads HTTP 500 / 1101; Phase B attempt 1's E0 census at 20:08:13Z reads identically. **Strict bracket: onset in (19:46:25Z, 20:06:25Z].** The project's adopted characterization stands alongside: watch state `onset_utc: 2026-11-01T19:46:00Z`; diagnosis "first known fault 19:46–19:59Z" (`PROD-1101-DIAGNOSIS.md` §4; `prod-1101-watch-state.json`). No primary observation between 19:46:25Z and 20:06:25Z exists in the records.

**Fault #1 recovery bracket:** last 500 — recovery-watch check 2026-11-02T00:16:03Z (prod and staging); first clean monitor run 2026-11-02T00:26:25Z ("RECOVERED after 13 consecutive 1101 failing runs"); verified-recovery form (quota + settings + staging all 200) at 2026-11-02T00:31:08Z. **Bracket: (00:16:03Z, 00:26:25Z], verified at 00:31:08Z.** The fault was sustained and continuous at every observation between the brackets — no transient recovery or flicker is recorded.

**Comparison verdict:** the S-0 reported registration's due time, **2026-11-01T19:49:36.104Z, falls inside the onset bracket** — 3m11s after the last verified-good reads, at the fault window's leading edge — and the fault then remained continuously present for ~4h41m past the due time, spanning the entire period in which a delivery or any retry could have occurred. The project's Nov 2 log noted the same relationship contemporaneously ("inside the 1101 onset window"). **Indeterminate residue, marked per the ruling and not smoothed:** no record resolves whether the fault had physically begun at 19:49:36Z exactly or in the minutes immediately after; the verdict is therefore *inside the onset window*, not *proven fault-caused*. The registration was set by Gate 4's closing activity (last grant `reported` 19:37:12Z; holds landed 19:40:20–27Z): a watchdog (10 min) or lease (15 min) row scheduled from activity at ~19:31–19:44Z matures into the onset window; **which row's `due_at` the registration was set from remains UNVERIFIED** (pending rows' `due_at` values are exposed on no read surface — assessment §5/§10 item 1). The diagnosis itself recorded this alarm-maturation correlation as coincidence-grade, not a cause, and noted a throwing alarm cannot produce the fetch fault and staging faulted identically with no such activity.

**Register effect:** all three silences are now fault-associated at their own strengths — S-0 inside fault #1's onset bracket; S-1 era-consistent with fault #2, onset unbracketed; S-2 due time inside fault #3's sustained window. Association is not mechanism; H-1 remains the leading event-specific explanation for S-2 and is now *supported by association* for S-0; H-2 remains preserved (the ruling's direction), not least because S-1's bracket cannot exclude a clear-weather start and the onset-minute residue in S-0 is formally indeterminate.

## 2. G-4 — Evidence index (compact)

All paths under `~/workspace/` unless noted. Code ranges are the live build's tree (`ch2-program/s1-build/candidate-tree/`, parts verified byte-identical to the deployed build at deploy).

| Claim | Primary source |
|---|---|
| Chain mechanics: `_armAlarm` min-due/watchdog; `alarm()` finally re-arms unconditionally | `v2/coordinator.mjs:2790` (`_armAlarm`), `alarm()` at ~:3275; `WATCHDOG_PERIOD_MS` :133 |
| R5a as deployed: registration iff unarmed, stale (`armed <= now − ALARM_STALE_THRESHOLD_MS`, 3,600,000 at :144), or `due < armed`; memo + containment recheck | `v2/coordinator.mjs:3220–3272`, condition at :3265 |
| `wake()` callers (operations only); replay fence precedes `wake()`; no read path wakes | `v2/coordinator.mjs:3200` (`wake`), arm calls :853/:2140/:2551; assessment §2 items 5–6 |
| Recorder: one row per pass, `armedAfter`, record-then-rethrow, 288-row prune, health object | `v2/worker-entry-prod-d6.js:434` (table), :455 (health key), :1888–1927 (recording) |
| S-0: registration 1793562576104 standing, recorder missing, deploy non-effect | `goals/opal-roundtable/hidden_files/phaseb-s1-window-log.md` (window open + checks); assessment §4/Q2 |
| S-0 revival: Grant 2 stimulus 2026-11-03T23:26:13Z → pass 1 within seconds | window log, STIMULUS + OBSERVATION entries |
| S-1: last pass 296 at 2026-11-04T20:56:59Z; due 21:06:29Z; 26h14m past due at close | window log, +54h/+60h/+66h/close entries |
| S-1 revival: resume wake probe → row 297 at 2026-11-06T03:43:37Z, 1.38 s after dispatch | `ch3-recovery/PHASEB-GENERATION-RESUME-EXECUTION-RECORD.md` §3, §4(a) |
| S-2: passes 430–451; park row 438; fault bracket 04:00:59Z→04:08Z; close acts | `ch3-recovery/turnon-execution/EXECUTION-LOG.md` |
| S-2 silence: 67 hourly reads, reported registration frozen 1794024828557, pending 1/1, failures 0 | `goals/opal-roundtable/hidden_files/turnon2-recorder-watch-log.md` |
| Fault #1 brackets + S-0 comparison | `PROD-1101-DIAGNOSIS.md` §4–§5; `prod-1101-watch-state.json`; `fp-ch2-monitor-log.md` (runs of 2026-11-01 14:46 / 15:06 / 19:26 ET); `gate3/GATE4-EXECUTION-RECORD.md` §5; `~/memory/2026-11-01.md`, `~/memory/2026-11-02.md` |
| Platform semantics (guaranteed vs unspecified) | assessment §3.1/§3.2, §10 (five official Cloudflare pages, crawled 2026-11-02) |
| Nov 9 census values (predicates, phase accounting, conflicts) | `ch3-recovery/turnon2-execution/census/` |

## 3. G-5 — Platform guarantees vs assumptions, separated

**Documented guarantees** (assessment §3.1, from Cloudflare's Durable Objects documentation): one alarm per DO, `setAlarm` overwrites; at-least-once execution with automatic retries on handler throw (exponential backoff from 2 s, up to 6 retries, applying to the most recent `setAlarm` call); `getAlarm()` returns the alarm time or null — the alarm counts as set if it has not started, or has failed with a retry not yet begun — and returns null while a handler is running unless `setAlarm` was called since it started; `setAlarm` at a past time executes asynchronously, usually within milliseconds, delayable up to ~a minute under maintenance/failover; alarm operations are storage operations; code updates discard in-memory state only.

**Unspecified** (assessment §3.2 — the documentation is silent; nothing in this program may treat these as settled): what `getAlarm()` returns after an alarm's retries are exhausted, and whether the registration is then cleared, retained, or reconciled; any catch-up delivery for an overdue alarm on instantiation, restart, eviction recovery, or code adoption; any periodic reconciliation or revival for an alarm that was never invoked; whether a Worker script upload preserves, drops, or retimestamps a pending alarm (general proposition).

**Incident observations** (not guarantees; each exactly one or two instances): a deploy over a pending registration neither dropped, retimestamped, nor revived it (S-0); in two instances, delivery followed a wake-path re-registration within seconds (Grant 2 stimulus; resume wake probe) — consistent with "a fresh `setAlarm` issued after the fault is delivered," which remains **unverified as a general proposition** (assessment §10 item 3), per the ruling's caution.

**Operating assumptions** (labeled as such wherever relied on): storage-effect ordering between a containment stop's `deleteAlarm()` and a concurrent `setAlarm()` (assumption family A-3; surfaced if violated by the stop's read-back verification and the confidence derivation); that the reported registration corresponds to the platform's internal queue state at all (H-2's divergence family denies exactly this).

## 4. G-6 — Three propositions, kept distinct

- **P-REC — recorder health:** the recorder's own write path functions. Established by: recent rows present, `recordingFailures` 0, health object's `lastRecordedAt` advancing. Says nothing about delivery except when rows exist (see P-DEL). Its known blind spot: a pass whose SQL row **and** KV health write both fail leaves no trace (preserved caveat).
- **P-REG — reported registration:** `getAlarm()` reports value X. A report *about* platform state from one read surface; H-2 preserves the possibility that report and deliverability diverge. All three silences exhibited a standing P-REG throughout — P-REG alone never establishes liveness.
- **P-DEL — proven delivery:** a recorder row for a pass exists, i.e., the handler ran and recorded. The only direct delivery evidence available to us. **Chain liveness is a P-DEL claim**: a sequence of rows at the expected cadence with advancing `armedAfter`. Every liveness predicate in this program (the retired P-12, and Track B below) is, or must be, stated in P-DEL terms, with P-REG and P-REC reported alongside but never substituted.

## 5. Track A — Durable independent liveness: mechanism comparison

Design constraint set (from the ruling): preserve read-only diagnostic GET semantics by default — no silent mutation from an existing diagnostic read; an operator-invoked mechanism is never described as autonomous recovery; every mechanism is assessed on containment/halt authority, races, idempotence and bounded re-registration, duplicate-delivery and retry safety, stale thresholds, inadvertent generation dispatch, cost/quota exposure, and its own failure behavior. All three mechanisms below share one inner operation — the **repair evaluation**: read containment state and the reported registration; if containment permits arming and the reported registration is stale (past-due by more than the threshold) — or absent while pending rows exist — issue exactly one `setAlarm(due)` at the current minimum pending `due_at` (watchdog fallback as in `_armAlarm`), with the containment gate re-checked in the same synchronous stretch that initiates the registration (the v3 race pattern), and write an audit record of the evaluation and its outcome. The mechanisms differ only in **what invokes the evaluation**.

### A-1 — Dedicated operator maintenance route (invoked; NOT autonomous)

A new operator-fenced POST route (shape precedent: the containment and phase-binding routes; `authorizationRef` required, audited) that runs the repair evaluation once per call.

- *Containment/halt:* refuses outright in CHAIN_STOPPED; in DRIVE_CONTAINED the evaluation may register only the watchdog cadence (drive remains contained by definition of that state — the containment arm gate already encodes exactly this distinction and the evaluation reuses it rather than re-deriving it). Registration never touches GENERATION_HALT, the queue pause, or `sendGrant` wiring: a repaired chain under holds produces drive passes only — the S1 window demonstrated days of passes under holds with 0 dispatches and $0.
- *Races:* v3 pattern (gate re-check in the registration stretch); concurrent operator calls collapse onto `setAlarm` overwrite semantics — the second evaluation observes the first's fresh registration and no-ops (not stale).
- *Idempotence/bounds:* at most one registration per call; a call against a healthy chain is a pure no-op returning the observed P-REG/P-REC state. No loop, no retry inside the route.
- *Duplicate/retry safety:* if the platform also delivers a supposedly lost original (the divergence family), the handler's per-row state machine and the watchdog single-row invariant absorb it — passes are idempotent by construction (rows process by state; the finally-ensure keeps exactly one pending watchdog).
- *Thresholds:* reuses `ALARM_STALE_THRESHOLD_MS` (1 h, provisional, already the deployed constant) so "stale" means one thing everywhere.
- *Cost/quota:* one DO request per call; no provider surface touched; no quota-guard interaction (passes under halt dispatch nothing).
- *Its own failure behavior:* it is an ordinary fetch path — during a sustained 1101 it fails visibly (HTTP 500) and repairs nothing; it is a **post-fault** repair tool, never a during-fault one. Julie's WAIT law is unaffected.
- *Honest label:* **operator-invoked recovery.** It converts today's improvised wake stimulus (a refused command sent for its side effect) into a purpose-built, audited, semantically honest operation — but a human (or a gate) must still invoke it.

### A-2 — Stale-alarm repair on an authorized interaction path (piggyback; semi-autonomous)

Run the repair evaluation inside an existing non-diagnostic path. Candidates assessed: (i) client sync reads (`GET /v2/sync/*`) — rejected as stated: they are reads, and bending them violates the read-purity law this program has relied on for census evidence; limiting the bend to client (non-diagnostic) reads narrows but does not remove the objection, and firing depends on the app being open; (ii) the queue-consumer path — fires only when the queue delivers, which is never while paused; useless for the held state; (iii) command/report paths — **already shipped**: that is precisely R5a, and S-2 is the demonstration that it is insufficient on its own. *Assessment:* no candidate adds independent liveness. **Not recommended as a track**; its analysis is recorded because the comparison was directed. (A-2's one useful residue: any future non-read write path we add for other reasons should run the evaluation, as all current ones do.)

### A-3 — Scheduled independent liveness (autonomous; the only genuinely independent mechanism)

A platform **Cron Trigger** (scheduled event — an invocation source entirely outside the alarm chain, the app, and operator traffic) invokes the repair evaluation on a slow cadence. Two implementation shapes, both requiring a code deploy (separately gated execution, not this round): (a) a `scheduled` export on the production worker calling the coordinator stub's maintenance path internally; (b) a separate minimal worker whose scheduled handler calls the production worker's A-1 route via service binding with the operator credential held as its own secret. Shape (a) is one deploy and no new credential surface; shape (b) isolates the scheduler from the generation worker's deploy cadence (a bad generation deploy cannot silently take the watchdog-of-the-watchdog down with it — though it adds a second script to keep observable).

- *Liveness guarantee (stated at true strength):* if the chain ceases and the fault (if any) has cleared, the chain is re-registered **within one cadence + the stale threshold** of the cessation becoming repairable — with no human, app, or command traffic. Proposed cadence for design discussion: every 6 hours (4 evaluations/day); worst-case silent window ≈ 7 h. This bounds blindness; it does not prevent a cessation, and during a sustained 1101 the scheduled invocation itself fails (visibly, per below) and simply retries next cadence.
- *Containment/halt:* the evaluation is the A-1 evaluation, unchanged — CHAIN_STOPPED refuses, DRIVE_CONTAINED restricts, holds make passes dispatch-free. A scheduled trigger must **never** be able to lift a halt, unpause a queue, or clear containment, and the design gives it no path to any of those surfaces.
- *Races:* identical to A-1 (single registration stretch, gate re-check); a scheduled evaluation racing a live chain no-ops (registration not stale); racing an operator A-1 call collapses by overwrite semantics.
- *Idempotence/bounds:* each scheduled run evaluates at most once and registers at most once; no catch-up storm is possible (a run that finds a fresh registration no-ops regardless of how many runs were missed).
- *Duplicate/retry safety:* as A-1; additionally the scheduled event's own delivery semantics (platform-managed, at-least-once character) are absorbed by the same idempotence.
- *No inadvertent dispatch:* the evaluation cannot submit work; it can only restore the drive cadence, which under GENERATION_HALT `"1"` + paused queue is dispatch-free by the sendGrant wiring. If generation is ever legitimately unhalted, a restored chain resumes exactly the work the plans already authorize — which is the definition of the self-resume the program has wanted since turn-on 1.
- *Cost/quota:* ~4 DO invocations/day plus a KV/health write per run — far inside free-tier bounds (Workers free: 100k requests/day; cron triggers are a free-plan feature — trigger count and the account's existing triggers to be inventoried at implementation design, a named checklist item, not assumed). No provider quota exposure.
- *Its own failure behavior:* the mechanism writes its own health note on every run (timestamp, evaluation outcome, P-REG observed) to a small storage record readable by the diagnostics surfaces — so "the scheduler ran and declined (not stale)," "the scheduler ran and repaired," and "the scheduler has not run" are three distinguishable states, and the Q-5 weekly observation (if Julie approves it) watches the watcher. If the scheduled mechanism dies silently, the weekly read shows its health note frozen — detectable, never self-concealing.

### Track A comparison and executor's leaning

| | A-1 operator route | A-2 piggyback | A-3 scheduled |
|---|---|---|---|
| Independent of chain/app/operator | No (invoked) | No (traffic-dependent) | **Yes** |
| Autonomous recovery | No — and never so described | Partial, unreliable | **Yes, cadence-bounded** |
| Read-purity law | Preserved | **Bent** | Preserved |
| New platform surface | One operator route | None new | Cron trigger (+ route/path) |
| Failure visibility | HTTP result per call | Silent by design | Own health note per run |
| Deploy required | Yes | Yes | Yes |

**Leaning, for Rowan's ruling:** adopt **A-3 built on A-1** — the repair evaluation as a single audited operation with two invocation sources (operator route for gates and manual use; scheduled trigger for autonomous liveness), since the gate use-case (Track B) needs exactly A-1's invocation anyway. A-2 is not recommended. This is a design leaning only; implementation in any form requires its own reviewed proposal and Julie's GO, and nothing here pre-decides cadence, shape (a) vs (b), or thresholds.

## 6. Track B — The P-12 successor gate (design)

**Identity:** proposed name **L-1, the chain-liveness witness gate**. **Supersession rationale:** P-12 required *independent* resumption — a passive-observation predicate. After S-2, that predicate can remain unsatisfied indefinitely through no property of the chain that a wake wouldn't cure, and a gate that wakes the chain cannot retrospectively satisfy it (the ruling's critical distinction). L-1 therefore replaces passive observation with an **authorized stimulus + autonomous-continuation witness**: it does not claim the chain resumed independently; it proves the narrower, sufficient proposition — *the chain accepts a registration and then continues delivering on its own* — which is the proposition any future generation gate actually needs.

**Checkpoints (separated, per the ruling):**
1. **Pre-stimulus census** — turn-on-2-grade census, unchanged in strength: build/etag captured, reported registration and latest pass recorded (P-REG/P-REC baseline), containment NORMAL, quota reconcile clean, conflicts exact, phase accounting frozen, queue paused, halt on. Any deviation = STOP under the standing executor law.
2. **Authorized, counted stimulus** — exactly **one** wake of the proven shape (a fresh `RequestPause` against the nonexistent probe job, refused `job_not_found` as designed) — or, if Track A-1 has by then been implemented and separately authorized, one A-1 repair call; the gate paperwork names which, never both. This is the gate's sole counted production act.
3. **Immediate post-stimulus result** — a new recorder row (P-DEL) within **15 minutes** of the stimulus (the resume gate's GR-2C bound, the one empirically observed revival latency being ~1.4 s), stage complete, `armedAfter` advanced beyond the pre-stimulus reported registration.
4. **Subsequent autonomous continuation** — with **zero** further wake-path traffic from anyone: at least **three further consecutive complete passes** (rows N+2, N+3, N+4) delivered within **40 minutes** of row N+1, hash chain intact, `recordingFailures` 0, the reported registration advancing at each observation. One row is explicitly insufficient (ruling); three further rows at the 10-minute watchdog cadence demonstrate the chain is re-arming itself, not merely answering the stimulus.
5. **Final halt and containment verification** — generationState halted, queue still paused, containment NORMAL, zero dispatches, zero provider attempts, phase accounting bit-identical to census, conflicts exact. The gate closes HELD regardless of outcome.

**Outcome definitions:** **SUCCESS** — checkpoints 3 and 4 both satisfied and checkpoint 5 clean: the chain is live at close (a P-DEL-sequence claim, time-bounded to the gate; durability beyond it is Track A's subject, not this gate's). **FAILURE** — no row within the 15-minute bound: the wake did *not* revive the chain — a materially worse datum than any silence so far; the gate ends HELD, its GO is consumed, and the result returns to the Roundtable before anything else is proposed. **INCONCLUSIVE** — checkpoint 3 satisfied but checkpoint 4 not (the chain answered and stalled again inside the window — the S-1 pattern repeating under direct observation): wake-response proven, autonomous continuation not proven; ends HELD, GO consumed, classification returns to Rowan. **TIMEOUT/STOP** — a 1101 signature at any read, or any census/checkpoint deviation: suspend under the fault law and the standing STOP law; ends HELD.

**Ceiling and expiry (for the future execution package, not set here):** exactly 1 stimulus; reads logged without bound; $0 spend; no other mutation of any kind; the authorizing GO names a single execution morning and lapses at its end; a FAILURE or INCONCLUSIVE outcome consumes the GO (no silent retry; any second attempt is a new gate under a new GO). **Julie's GO is required before any use, and Rowan's documentary acceptance of the execution package precedes the GO request** — the ordinary sequence, unshortened.

## 7. Supporting work

**Observability (Q-5):** Rowan conditionally accepted the weekly read-only recorder check as a concept; starting it requires Julie's separate approval, which has been requested and is pending at this filing. If approved, its record follows the ruling's six fields exactly, and its reports are confined to the ruling's four triggers (spontaneous revival, registration change, unexpected recorder failure, unreadable). It is instrumentation, not recovery, and is never described as either.

**Platform-semantics escalation (optional documentary route):** a narrowly phrased Cloudflare **community** inquiry (free tier; no paid support dependency, no credential change, no production experiment) is drafted here for Rowan's review and Julie's separate go before any posting: *"On a free-plan account, a Durable Object alarm whose due time passed during a period when the object's routes returned HTTP 500 (error 1101) was never subsequently delivered; getAlarm() continued to report the same past-due timestamp for days afterward, across many later instantiations. Is there documented behavior for (a) alarm delivery after such a fault clears, (b) what getAlarm() returns after an alarm's retries are exhausted, and (c) any reconciliation for alarms that were never invoked?"* — Nothing is posted under this round.

## 8. Holds, and what is asked

No stimulus, command, deployment, containment transition, settings or queue change, gate execution, production read schedule, or spend is authorized or requested by this filing. Any implementation of Track A, and any execution of Track B, each requires its own reviewed package and Julie's GO. WS2/Batch untouched. W-4 remains an open historical deviation.

**Asked of Rowan:** documentary/design review of §§1–4 (the G-closures); a ruling on the Track A comparison and the executor's leaning (A-3 on A-1; A-2 rejected); a ruling on Track B's design (identity, checkpoint set, outcome definitions, bounds); and any corrections to the §7 draft inquiry. **Turn: Rowan's.** Pin: `<W4D-PIN>` (opal-reader, branch `ui1-review`, to be filled on the filed copy).
