# TURN-ON 2 — GATE MORNING 1: PRE-LIFT STAND-DOWN #1 — RULING REQUEST (D-1 / D-2)

**Handoff:** `RT-H-20261109-dc9b02`
**Date:** 2026-11-09.
**From:** Wren (executor), via Julie.
**To:** Rowan — documentary ruling requested on two census deviations. This request authorizes nothing and executes nothing; production remains HELD.
**Pin:** this package is pinned in `jedavid33-design/opal-reader`, branch `ui1-review`, at commit `<PIN-SLOT>` (the pinned copy carries this slot; the Dropbox copy carries the filled pin). Package contents: this ruling request; `EXECUTION-RECORD-STANDDOWN1.md` (the gate-morning execution record, as filed on the board, comment 6738551947); the ROWAN-CP for this round.

## 1. Authority chain (unchanged)

- Julie's GO of record: board issue #15, comment **6708714801** (handoff `RT-H-20261107-8eb579`) — the corrected second-attempt execution package adopted at pin `0404a2b87c8c7b1d871724423d51d7a6db0b614e`; smoke chapter Forever Pucked Chapter 5 (chapterIndex 4); the OQ-6 72-hour pre-lift reuse rule **ADOPTED**.
- Rowan's FINAL DOCUMENTARY READINESS PASS on that package: `RT-H-20261107-6479c7`, in force.
- The gate ran under that GO on the first qualifying morning, 2026-11-09, executed by the armed gate watch.

## 2. What happened on gate morning 1 (2026-11-09)

- **FC-1 PASSED, at full strength.** Last 1101-observed monitor run 2026-11-07 19:26 ET; first clean run 19:46 ET; **34.27 elapsed fault-free hours** to the 11:02Z census start, 103 consecutive clean runs, max gap 20 minutes, no gap >40 minutes. Hash-preserved excerpt filed (`evidence/fc1-monitor-excerpt.md`, SHA-256 `aa64de10929377d4e44d489461f7c5ae0641cb3fd9f70c837367108894c3d4f9`).
- **Census P-1…P-15 + FC-2, FC-4, FC-5: PASS** — build `ef69b8f9…` and etag `d0eb6ea9…` exact (P-1); holds and queue exactly as papered (P-2); containment NORMAL both surfaces (P-3); exactly the four preserved `schedule_dead` rows (P-4); exactly six plans, the inherited Chapter 4 plan `plan:8f14c8885548b9c5ddd6b8df` at `parked_quota` 19/20 with position 107 pending (P-5); parked Ch 3 job untouched (P-6); settings revision 1 (P-7); reconcile ok with only the adjudicated straddler (P-8); phase accounting exact (settled 1,406,466; remaining 12,087,886) (P-9); watermarks content 18 / bindings 1861 (P-10); fresh PT day, zero dispatches (P-11); authority chain and GO verified (P-14, P-15).
- **Two predicates FAILED and the run stood down pre-lift under §4.13 (i) and the STOP law — zero counted acts, no lift attempted, nothing mutated.** GENERATION_HALT remains `"1"`, queue paused. The deviations are D-1 and D-2 below (P-13 and P-12 in census order).
- **FC-3 (confirmation set) was NOT RUN** — the census itself produced the STOPs, and a confirmation cannot cure a failed census predicate. Recorded at its true strength (superseded by the stand-down), not as a pass. Ruling ask R-C covers this treatment.
- **GO fate:** stand-down #1, pre-lift → under the adopted OQ-6 rule the GO **survives for exactly one re-run within 72 hours**; the window ends **2026-11-12T11:08Z** (06:08 ET). A second stand-down, or the window lapsing, consumes the GO.
- **Exposure, three lines:** (1) verified provider-confirmed charges — $0.00; (2) unverified ledger estimates — no movement (settled stands at 1,406,466; dispatches on the day 0); (3) remaining phase room — 12,087,886 units of the $13.50 Forever Pucked budget.

## 3. D-1 — P-13: the smoke quote's book digest differs from the package's expectation

**The predicate (package §4.3, P-13), in its operative part:** the chapter Julie named is quoted fresh (eligible count N, total chars, expected cost, exclusions, and the book digest `7d76a053…` — "the Forever Pucked identity digest of record"). **STOP conditions:** the named chapter quotes zero eligible, **or its book digest differs from `7d76a053…`**.

**Observed (2026-11-09 ~11:05Z, fresh client read, quote recorded verbatim in the execution record):** Forever Pucked chapterIndex 4 — eligibleCount **21**, totalChars **29,145**, expectedCostMicroCents **410,880**, exclusions {bound_already 0, voice_prompt 0, parked 0, other 0}, digest **`831e456db0d82373d2f408fd9e37d6d9a3dd46e9f2419153be7d2d9755b60f94`**. The digest of record is `7d76a0538d8156a050eab0c34ecdb584d92da0c39f6d97a2589fc16ad5e5247f`. They differ; the STOP fired. (Advisory fit test, OQ-8 report-only: (N−1)·w = 20·8 = 160 vs 88 − R = 76 — does not fit the advisory figure; no predicate effect; no ruling requested on it.)

**The executor's proposed explanation — tracing only; under §4.4 and the STOP law it does NOT clear the stop, and it is not presented as doing so:**

- In the live build's `eligible-set.mjs` (build `ef69b8f9…`, the build the census verified), the eligibility digest is a sha256 over the canonical whole-book list `[[occurrenceId, disposition], …]` — it is **disposition-sensitive by construction**.
- The value `7d76a053…` was the digest **before Chapter 4 generated**: every quote of record through the first attempt's census (2026-11-07T01:23Z) shows it, including the Chapter 4 quote the first-attempt package carried forward into this package's P-13 as the standing expectation.
- The first attempt then bound **19 new Chapter 4 occurrences** (positions 93–106, 108–112), flipping their dispositions eligible → bound_already. That change necessarily changes the whole-book digest. No other book-state drift was observed at census.
- Today's reads are internally consistent with exactly that change and nothing else: the digest is uniformly `831e456d…` at chapterIndex 2, 3, 4, and 5; the chapterIndex-3 (Chapter 4) quote shows bound_already 20 / eligible 1 — position 107, the parked segment — precisely the post-generation state the census independently verified at P-5 (bindings watermark 1861, P-10).

**Ruling ask R-A:** Is the observed digest `831e456d…` the **correct post-Chapter-4 expectation** — i.e., is the mismatch fully explained as the necessary consequence of the first attempt's 19 bindings, so that a re-run census inside this GO may take `831e456d…` as the P-13 expected digest? If the tracing is insufficient, what further evidence is required before a re-run could pass P-13?

## 4. D-2 — P-12: the recorder chain has been silent since 2026-11-07

**The predicate (package §4.3, P-12), verbatim in its operative part:** "Recorder healthy (R-06): `drive=1` projection shows an alarm registration standing (`armedAt` non-null), a latest drive pass complete with its hash chain intact, `recordingFailures` 0; **the latest pass's recency is judged fresh (a registration whose passes stopped long before the census is not a pass — it is the silent-chain question arriving early, and the run stands down: §4.8's bounded window governs only a chain that was alive at census)**."

**Observed (2026-11-09 ~11:05Z):** alarm registration **standing** (`armedAt` 1794024828557, non-null); latest drive pass **id 451, complete, hash chain intact, `recordingFailures` 0** — but timestamped **2026-11-07T04:03:48Z, 55.0 hours before the census**. Passes ran at a ~10-minute cadence through the first attempt (ids 430–451, 2026-11-07 01:23Z–04:03Z) and then ceased. No pass has been recorded since — including through the ~34 fault-free hours after the 1101 fault cleared (first clean monitor run 2026-11-07 19:46 ET).

**What is and is not claimed:** the cessation began ~10 minutes before the first attempt's verified 1101 onset window and before its suspension close. It is the already-open **W-4** (the S1 window's late drive-pass cessation; diagnosis UNRESOLVED; causation with any 1101 fault **not claimed** — the package's own W-4 note stands). The executor proposes **no explanation** beyond this record, and does not propose that the chain would or would not resume on the lifts: P-12 exists precisely to forbid that assumption, because §4.8's bounded 60-minute window governs only a chain that was alive at census.

**Ruling ask R-B:** How should a re-run inside this GO treat P-12? The executor lays out the space without advocating a clearance:

- **(i) The predicate stands exactly as written.** Then no re-run can pass until the chain is observed alive again. No wake act, command, stimulus, deploy, or other provocation is authorized under this GO, so "alive again" may not occur before the window ends — the GO would likely be consumed by lapse or by a second stand-down. This is a coherent ruling; its consequence should be chosen knowingly.
- **(ii) A documentary disposition on these facts** — registration standing, latest pass complete with intact hash chain, `recordingFailures` 0, cessation coincident with a platform fault that has since cleared and stayed clear 34+ hours — under which the re-run census may judge P-12 by a re-anchored observation the ruling names exactly (for example: what specific pass evidence, observed at census or inside §4.8's window after the lifts, counts as the chain being alive), with the 55-hour silence carried on the record as a deviation dispositioned, not erased.
- **(iii) Any other treatment Rowan specifies**, stated exactly enough that an executor can apply it mechanically at a re-run census.

Whatever the disposition: the executor asks that the ruling state **exactly what the re-run census must observe for P-12 to pass** (or state that it cannot pass on any observation available under this GO), so the re-run's executor is applying a rule, not exercising judgment.

## 5. Ruling ask R-C — re-run mechanics and the FC-3 treatment

- Confirm (or correct) that a re-run inside the 72-hour window proceeds under **this same package and Julie's same GO**, applying Rowan's R-A / R-B dispositions as the corrected census expectations, with this stand-down and her ruling on the record — no new package and no new GO required.
- Confirm (or correct) the FC-3 treatment recorded in §2: **not run, superseded by the stand-down**, rather than failed or passed.

## 6. Timing — why this ruling is time-critical

- The gate watch remains armed and evaluates daily at 11:02Z. The fault remains clear, so **tomorrow (Nov 10) is a qualifying morning**: absent a ruling recorded before that run, the re-run census would meet the same two predicates in the same state and would very likely stand down again — **a second stand-down consumes the GO**, two days before the window's own end (Nov 12, 11:08Z).
- Julie's decision (2026-11-09, in chat): **poke Rowan today for this ruling** (she did not elect the HALT-flag option). If a ruling cannot land before tomorrow's run, Julie may still set the HALT flag — but the 72-hour clock runs regardless, and a lapse consumes the GO just as a second stand-down would. The ruling's speed is therefore part of its substance.
- If no re-run can pass under the ruling, that is also a complete answer: the GO will be consumed on the record, production stays HELD, and a fresh GO (Julie's, when she chooses) is the path — no harm has been done at any point: zero acts, zero spend, across both attempts' stand-down/suspension handling.

## 7. What is NOT asked

No production authorization of any kind. No Batch, no onboarding, no deploy, no wake act, no containment transition, no settings write. The ruling is documentary: it disposes two deviations and states the re-run's census expectations. Julie's re-run decision, if any is needed beyond her GO and this ruling, remains hers.

**Turn: Rowan's** — ruling on R-A (D-1 / P-13), R-B (D-2 / P-12), and R-C (re-run mechanics + FC-3 treatment). Then Julie's, if the ruling leaves her a choice. Production remains HELD.
