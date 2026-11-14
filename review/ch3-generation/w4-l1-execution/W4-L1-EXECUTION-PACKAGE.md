# W-4 TRACK B — L-1 CHAIN-LIVENESS WITNESS GATE: EXECUTION PACKAGE

**Case:** Opal Roundtable, issue #15 · **Handoff:** `RT-H-20261114-338a9f`
**Prepared:** 2026-11-14, under Julie's preparation GO (board 6880904065).
**Specification basis:** the accepted L-1 specification (amended design §7, accepted by Rowan's design ruling), as refined by Rowan's deployment execution ruling §5 (board 6880501262) — A-1 evaluation as the **sole** permitted stimulus; one invocation; the conjunctive witness criteria carried forward unchanged.
**Review pin** (repo `jedavid33-design/opal-reader`, branch `ui1-review`): `<PIN>`

**This package authorizes nothing.** Sequence: Rowan's documentary acceptance of this package → Julie's execution GO naming the window → execution. Production remains HELD throughout; the gate closes HELD regardless of outcome.

## 0. What L-1 is, and is not

L-1 succeeds the retired P-12 condition. It administers **one authorized stimulus** — a single A-1 repair evaluation, the first production use of the mechanism deployed this morning — and witnesses whether the drive/recorder chain then **continues on its own**: a qualifying complete pass within 15 minutes, then three further consecutive complete passes within the following 40 minutes, at cadence-consistent intervals. **SUCCESS establishes time-bounded observed chain liveness only.** It does not authorize generation turn-on, does not close W-4, and does not prove anything about why the chain stopped in November. A completed maintenance call alone is not success: setAlarm completion, the reported registration afterward, subsequent observed delivery (P-DEL), and independently observed continuation are four distinct evidentiary steps and are recorded separately.

**Frozen baseline** (re-established at the A-1 deployment gate's terminal reads, 2026-11-14 ~16:00Z, and unchanged at the last weekly peek before it): latest recorder pass **451** at 1794024228557 (2026-11-07T04:03:48Z), stage complete, hash chain intact, `recordingFailures` 0; reported registration (`armedAt`) **1794024828557**; pendingSchedule 1, pendingWatchdog 1. The execution census re-establishes the live state fresh; checkpoint 0 compares against this baseline.

## 1. The stimulus — exactly one A-1 evaluation

**Counted acts ceiling for the gate: ONE.** The invocation below is the gate's only mutation-class act. Everything else in the gate is reads. The stimulus is consumed once exercised, regardless of outcome (B-R4).

**The exact request** (operator connector, production scope/instance headers):

```
POST /v2/d6-repair-evaluate
{
  "action": "evaluate",
  "authorizationRef": "L-1 execution — Julie GO, board comment <GO-COMMENT-ID>",
  "reason": "L-1 first-use liveness witness: single authorized A-1 evaluation as the gate's sole stimulus, execution package RT-H RT-H-20261114-338a9f as accepted by Rowan."
}
```

The body is written in full here, per standing law. `<GO-COMMENT-ID>` is filled at gate time from Julie's execution GO record; the gate does not proceed if the GO record does not exist. Both text fields are within the route's 2,000-character limits. No other body, action, or route is permitted.

**Expected behavior on the diagnosed state** (from the accepted implementation, stated so the record can judge it): the evaluation observes the stale registration, reserves one intent inside the protected boundary, synchronizes, re-verifies, and registers the alarm at the earliest pending due — the pending watchdog row's due, 1794024828557, which is in the past. Two honest consequences: (i) the evaluation's read-back registration may therefore **equal** the pre-stimulus reported value — the witness is the subsequent *delivery*, not a change in that number; (ii) a past-due registration is expected to be delivered promptly, which is why checkpoint 3's bound is 15 minutes rather than a full cadence. Expected outcome string: `registered`. Any other outcome is handled by §4 — **no acknowledgment, no retry, no second evaluation, and no alternative stimulus may follow any outcome under this gate's authorization**, including a decline, an error, or an ambiguous response (an ambiguous response is reconciled read-only; the gate then ends for disposition).

**Strike accounting, stated in advance:** the invocation records one intent. If the chain revives and produces two consecutive complete passes after the intent's completion record, the strike discharges by the accepted rule (routine observed continuation — labeled as such, never as L-1 certification of the accounting). If it does not, the intent remains unresolved and counts as one of the three strikes until discharged or acknowledged under separate authorization. This consequence is accepted as part of the gate's design and is named in the execution record either way.

## 2. Gate sequence

**Phase 0 — fresh complete census (reads only).** The deployment gate's 15-item census, with expectations updated for the current state: build `8a16def42e941790ef2eeb460366bb19ef977801` on /health, generation halted; script etag `611a23c8aa326160441a33a4b83c0c1a32f6cf2b81c6ad0a53978e9bf29131fb` captured per R4; settings 10 bindings with halt `"1"` and phase policy `"enforce"`, observability intact; queue paused with sole consumer `f260f2188d80426bb0588685e9d084eb`; containment NORMAL/verified with `updatedAt` 1793933356719 and the episode-3 summary; capabilities halted / batch not armed; quota reconcile `ok` with the known adjudicated exception (`att-37d63768…`, `estimated_unverified`); phase accounting at settled 1,406,466 / estimatedUnverified 19,018 / reservedUnverified 5,648 / remaining 12,087,886; exactly the four preserved conflicts; exactly six plans at their standing states plus the parked job `parked_policy` rev 1; settings revision 1; recorder at the §0 baseline; watermarks content 18 / bindings 1861; **repair-status: initialized true, zero strikes, no intents, no events** (the A-1 surface joins the census for this gate). Any deviation stops the gate under the executor STOP law, GO unconsumed if the stimulus has not been exercised.

**Checkpoint 0 — pre-stimulus liveness exclusion (B-R1).** Immediately after the census, before the invocation: if any recorder pass exists beyond 451, or the reported registration has advanced from 1794024828557, **the stimulus is not administered.** The gate ends before it begins; the observation is returned for documentary disposition (movement alone does not establish sustained recovery). GO unconsumed.

**Witness-independence establishment (B-R2).** No scheduler exists (A-3 is unbuilt), and no automatic recovery caller of any kind is deployed — the deployed A-1 route is operator-invoked only. Pre-existing read-only instrumentation (the weekly peek, Saturdays ~9:47 a.m. ET; the retired-plan monitor, every 20 minutes) performs reads only; reads never arm and cannot produce a pass, so neither can account for continuation. The execution window is nevertheless chosen outside the weekly peek's minute, and the execution record notes the monitor's read times during the window. If independence cannot be established, pre-gate STOP, GO unconsumed.

**Final pre-invocation checks (execution ruling §5):** queue-pause read-back (Cloudflare API) **within 15 minutes** of the invocation; WAIT-law clearance (no 1101 signature on any gate read); Julie's GO confirmed still valid and the exclusive-control window open; halt verified; containment NORMAL (permitted); strike eligibility verified (0 outstanding, per the census repair-status).

**Phase 1 — the stimulus.** The single invocation of §1. **T0 = the moment the invocation's response is received** (or, on an ambiguous response, the moment it was sent — and the gate then ends per §4). The response is recorded in full: outcome, evaluation id, intent id, read-back registration, timestamps.

**Phase 2 — observation (reads only).** Diagnostics (`drive=1`) reads at ~2-minute intervals, each logged with its timestamp, until the outcome is determined:
- **Checkpoint 3:** a new recorder row (id 452) with `at` within **15 minutes** of T0, stage `complete`, hash chain intact, `recordingFailures` 0, and the row's `armedAfter` advanced beyond 1794024828557.
- **Checkpoint 4:** rows 453, 454, 455 — **three further consecutive complete passes** within **40 minutes** of row 452's `at`; each inter-row gap within **[5, 20] minutes** (conjunctive with the window); rows consecutive (no gaps, no interleaved error rows); each row's `armedAfter` advancing; no external intervention of any kind during the window.
- Repair-status is read after checkpoint 3 and at the close: the intent's completion record, the discharge derivation, and strike state are recorded at their actual strength.

**Phase 3 — terminal census (checkpoint 5).** The protected accounting and hold surfaces re-read and compared to the gate-entry census: halt, queue, containment, capabilities, quota reconcile, phase accounting, conflicts, plans, settings revision, watermarks — expected **unchanged** (zero dispatches, zero provider attempts, $0 spend), plus the repair surface showing the gate's own intent and its disposition, and the recorder/alarm state at its observed end position. If terminal verification becomes unavailable: **HELD BY LAST VERIFIED STATE; TERMINAL VERIFICATION UNAVAILABLE** — no closing census is claimed that did not occur.

## 3. Outcomes (B-R4, refined — the ruling's criteria verbatim in effect)

- **SUCCESS** — checkpoint 3 and all of checkpoint 4 established; checkpoint 5 clean. Establishes bounded observed chain liveness only (§0).
- **FAILURE** — no qualifying recorder row within the 15-minute bound, with observation surfaces available and the stimulus outcome established. This is failure to demonstrate revival under the gate conditions — not proof the handler never ran.
- **INCONCLUSIVE** — checkpoint 3 satisfied but continuation not established; or the evidence cannot distinguish continuation from externally assisted recovery (including any witness-independence breach discovered after the stimulus).
- **TIMEOUT/STOP** — a 1101 signature at any read, a safety deviation, unreadable required evidence, or inability to complete required verification: suspend under the fault law (WAIT) and the standing STOP law. Ends HELD.

## 4. Declines, errors, and ambiguity — the one-shot law

Whatever the invocation returns ends the gate's active phase: `registered` proceeds to observation; every decline (`not_stale`, `contained_drive`, `contained_stop`, `halt_not_asserted`, `strike_bound_reached`, `reservation_invalidated`, `observation_superseded`, `alarm_not_stale_after_sync`, …) and every `error:*` outcome is recorded and returned for disposition — **no second evaluation, no acknowledgment, no alternative stimulus, no retry** under this authorization. An ambiguous response (no readable outcome) is reconciled by read-only repair-status and diagnostics reads only; if the outcome cannot be established, the gate closes as TIMEOUT/STOP with the ambiguity recorded. A new attempt is a new gate under a new GO.

## 5. What success leaves behind (stated in advance)

On SUCCESS the chain is **live again**: watchdog passes resume at the ~10-minute cadence and continue indefinitely (the normal pre-November state). Generation remains HELD (halt asserted, queue paused) — a live chain dispatches nothing while halted, as the November idle passes demonstrated. Consequences noted for the record: the weekly peek's next run will report the new pass (its designed report condition (a)); the standing monitors' expectations of a silent recorder are superseded by the gate record. No part of this gate authorizes anything further: generation turn-on remains a future, separately-gated question, and A-3 remains separate.

## 6. Execution-record contents (for Rowan's documentary review)

Gate-entry census; checkpoint-0 comparison; witness-independence establishment; the invocation (request as sent, response in full, T0); the complete observation log with every read's timestamp and values; the checkpoint 3/4 evidence per row (id, `at`, stage, chain status, `armedAfter`, gaps); the repair-status reads; the outcome classification with its reasoning; the terminal census and comparison; every deviation, STOP, or unresolved observation. Pinned and filed as in prior gates, with the combined Rowan CP.

## 7. Exclusions

No acknowledgment (any intent disposition is a separate authorization); no second evaluation; no scheduler or automatic caller; no containment transition; no settings, queue, or halt change; no generation release; no rollback question (the deployment is accepted and closed). WS2/Batch untouched. W-4 remains an **open historical deviation** regardless of outcome.

**Turn: Rowan's** (documentary review of this package). Then Julie's (the execution GO). Production remains HELD.
