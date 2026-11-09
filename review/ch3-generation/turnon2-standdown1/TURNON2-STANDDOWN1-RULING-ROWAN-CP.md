# ROWAN-CP — TURN-ON 2, GATE MORNING 1: STAND-DOWN #1 — RULING REQUEST

Handoff `RT-H-20261109-dc9b02` · 2026-11-09 · From Wren via Julie · Pin (opal-reader, branch `ui1-review`): `<PIN-SLOT>`

Rowan — start here. The folder also carries the full ruling request (`TURNON2-STANDDOWN1-RULING-REQUEST.md`) and the gate-morning execution record as filed (`EXECUTION-RECORD-STANDDOWN1.md`, board comment 6738551947). This CP is self-contained for the ruling; the record carries the full census table. Reply in ChatGPT via Julie, as usual. Production is HELD; nothing in this round authorizes or requests any production act. Please end by naming whose turn it is.

## What happened

Gate morning 1 ran today (Nov 9) under Julie's GO (board 6708714801; package pin `0404a2b8…`; your FINAL DOCUMENTARY READINESS PASS `RT-H-20261107-6479c7`).

- **FC-1 PASSED at full strength:** 34.27 elapsed fault-free hours (last 1101 run Nov 7, 19:26 ET; clean from 19:46 ET), 103 consecutive clean monitor runs, no gap >40 min, hash-preserved excerpt filed.
- **Census: 13 of 15 predicates PASS, plus FC-2/FC-4/FC-5 PASS** — build and etag exact, holds and queue as papered, containment NORMAL, the four preserved conflicts rows, exactly six plans with the inherited Chapter 4 plan parked at 19/20, settings rev 1, reconcile ok (adjudicated straddler only), phase accounting exact (settled 1,406,466; remaining 12,087,886), watermarks 18 / 1861, fresh PT day with zero dispatches, authority chain and GO verified.
- **P-12 and P-13 FAILED → PRE-LIFT STAND-DOWN #1 (§4.13 (i)). Zero counted acts.** No lift attempted, nothing mutated; GENERATION_HALT still `"1"`, queue still paused. Exposure: $0.00 verified charges; no ledger movement; 12,087,886 units of phase room remain.
- **FC-3 was NOT RUN** (the census STOPs intervened; a confirmation cannot cure a failed census predicate) — recorded as superseded by the stand-down, not as a pass.
- **GO fate:** stand-down #1 under Julie's ADOPTED OQ-6 reuse rule → the GO survives for **one re-run within 72 hours; window ends Thu Nov 12, 11:08Z**. A second stand-down, or the window lapsing, consumes the GO.

## D-1 (P-13) — the quote digest — ruling ask R-A

P-13's STOP conditions include: the named chapter's book digest differs from `7d76a053…` (full: `7d76a0538d8156a050eab0c34ecdb584d92da0c39f6d97a2589fc16ad5e5247f`).

Fresh Chapter 5 quote at census: **21 eligible, 29,145 chars, expected 410,880 units, exclusions all zero**, digest **`831e456db0d82373d2f408fd9e37d6d9a3dd46e9f2419153be7d2d9755b60f94`**. It differs; the STOP fired.

Executor's proposed explanation (**tracing only — it does not clear the stop**): in the live build's `eligible-set.mjs`, the digest is sha256 over the canonical whole-book list `[[occurrenceId, disposition], …]` — disposition-sensitive by construction. `7d76a053…` was the digest **before Chapter 4 generated** (every quote of record through the first attempt's census, Nov 7 01:23Z). The first attempt bound **19 new Chapter 4 occurrences** (positions 93–106, 108–112), flipping eligible → bound_already, which necessarily changes the whole-book digest. Today's reads are consistent with exactly that change and nothing else: the digest is uniformly `831e456d…` at chapterIndex 2, 3, 4, and 5; the Chapter 4 quote shows bound_already 20 / eligible 1 (position 107) — the post-generation state independently verified at P-5/P-10. (Advisory fit test, OQ-8 report-only: 20·8 = 160 vs 76 — does not fit the advisory figure; no predicate effect; no ruling requested.)

**R-A: Is `831e456d…` the correct post-Chapter-4 expectation — the mismatch fully explained by the first attempt's 19 bindings — so a re-run census may take it as the P-13 expected digest? If the tracing is insufficient, what further evidence is required?**

## D-2 (P-12) — the silent recorder — ruling ask R-B

P-12 requires (operative part, verbatim): an alarm registration standing (`armedAt` non-null), a latest drive pass complete with hash chain intact, `recordingFailures` 0, **and the latest pass's recency judged fresh — "a registration whose passes stopped long before the census is not a pass — it is the silent-chain question arriving early, and the run stands down: §4.8's bounded window governs only a chain that was alive at census."**

Observed: registration **standing** (`armedAt` 1794024828557); latest pass **id 451, complete, chain intact, `recordingFailures` 0** — but at **2026-11-07T04:03:48Z, 55.0 hours before census**. Passes ran ~every 10 minutes through the first attempt (ids 430–451, Nov 7 01:23Z–04:03Z), then ceased; none since, including through the 34+ fault-free hours after the 1101 cleared. The cessation began ~10 minutes before the verified 1101 onset window and before the suspension close. It is the open **W-4**: undiagnosed; causation with any fault **not claimed**. No explanation is proposed beyond the record, and the executor does not assume the chain would or would not resume on the lifts — P-12 forbids that assumption.

**R-B: How should a re-run inside this GO treat P-12?** The space, without the executor advocating a clearance:
(i) The predicate stands as written — no re-run can pass until the chain is observed alive again, and no stimulus of any kind is authorized to make that happen; the GO would likely be consumed by lapse or a second stand-down. Coherent, if chosen knowingly.
(ii) A documentary disposition on these facts (registration standing, pass complete, chain intact, failures 0, cessation coincident with a since-cleared platform fault) under which the re-run census judges P-12 by a re-anchored observation the ruling names exactly, the 55-hour silence carried on record as a dispositioned deviation.
(iii) Any other treatment you specify, stated exactly enough to apply mechanically.
**Whatever the disposition, please state exactly what the re-run census must observe for P-12 to pass — or that it cannot pass on any observation available under this GO.**

## R-C — re-run mechanics + FC-3

Confirm or correct: (1) a re-run inside the window proceeds under the same package and Julie's same GO, applying your R-A/R-B dispositions as the corrected census expectations, with this stand-down and your ruling on the record — no new package, no new GO. (2) The FC-3 treatment (not run; superseded by the stand-down) is accepted as recorded.

## Timing

The gate watch evaluates daily at 11:02Z and the fault is still clear, so **tomorrow (Nov 10) is a qualifying morning**: without a ruling recorded before that run, the re-run would meet the same two predicates in the same state and would very likely stand down again — consuming the GO two days early. **Julie's decision today: poke you now** (she did not elect the HALT flag; the 72-hour clock runs to Nov 12, 11:08Z regardless, and a lapse consumes the GO too). If your ruling is that no re-run can pass, that is a complete answer — the GO is consumed on the record, production stays HELD, zero acts and zero spend stand, and a fresh GO is Julie's to give when she chooses.

**Turn: Rowan's** — ruling on R-A, R-B, R-C. Then Julie's, if the ruling leaves her a choice. Production remains HELD.
