# W-4 TRACK A — A-1 FOCUSED CORRECTION SUPPLEMENT (RC-1 – RC-3)

**Case:** Opal Roundtable, issue #15 · **Handoff:** `RT-H-20261114-668886`
**Date:** 2026-11-14
**Corrects:** the I-C corrections package, pin `c6930dcf0038c6b35f098dc6e2999f161428b1ee`, per Rowan's corrected implementation review of 2026-11-14 (board 6879389928), §§3, 4, 6 (RC-1, RC-2, RC-3).
**Closed and not reopened:** I-C1 (commitment boundary), I-C4 (audit surface and HTTP outcomes), the WeakMap revision fence, the two-part manifest evidence, rollback compatibility, scheduler exclusion, and the B-G2 tree-bound deferral (accepted and dispositioned; carried forward at §5).
**Authorization:** the existing offline implementation authorization (Julie's GO, board 6878879682; the corrected review's §8). Exactly two changed production source parts preserved. **No production contact of any kind was made.** Production remains HELD.

Review pin (repo `jedavid33-design/opal-reader`, branch `ui1-review`): `<PIN>`

## 1. Corrected identities

| Part | SHA-256 (this candidate) | Previous corrections candidate |
|---|---|---|
| `v2/coordinator.mjs` | `39486a7078c6b162520161064613b7488d762067d8e62ba9f9da1b6d933fbf81` | `a3dce297…` |
| `v2/worker-entry-prod-d6.js` | `4e2bed3c7e976db7f514e7d43a92af7d1c6a2a8afcd6d98c62c980aa2d54858b` | unchanged — the RC corrections touch only the coordinator and the test sources |

Same manifest-verified S1 base; exactly two changed parts; 29 byte-identical; part count 31; bindings unchanged; no scheduler wiring (T-00 and T-23 re-verified on this tree). Full manifest pinned as `A1-CANDIDATE-MANIFEST.md`; diffs pinned (`diffs/coordinator.diff`, 779 lines; `diffs/worker-entry-prod-d6.diff`, 166 lines); both complete sources pinned.

## 2. RC-1 — Final reservation validation (disposition: implemented as required)

The complete Phase B2 re-verification now runs **inside the final synchronous stretch, after the last `getAlarm()` call**: the fresh registration observation is taken first (it is the method's final storage call before the act), and the stretch then performs, with no asynchronous step before registration initiation: verified repair state → verified authoritative derivation → this evaluation's own reservation existing, valid, and outstanding → three-strike eligibility on competing reservations → revision fence → containment → halt → P-STALE re-established on the fresh observation → drive-pending → watchdog ensure → due → revision bump → `setAlarm` initiation.

New coverage — **T-37d**: the T-37b variant the review specified. The evaluation is parked at synchronization; the fresh-observation call is then parked via the deferred-read seam; an acknowledgment covering the intent lands **during that observation**; on release, the final stretch's derivation sees the reservation acknowledged away and suppresses it: outcome `reservation_invalidated`, zero registrations, and the schedule-row count is asserted unchanged (zero watchdog-ensure mutation). T-37b (acknowledgment during synchronization) is preserved and still passes.

## 3. RC-2 — Discharge evidence ordering (disposition: implemented as required)

The derivation's recorder-discharge rule now carries the review's conservative lower boundary: an intent is automatically dischargeable only when **both** qualifying consecutive complete passes have handler-entry timestamps (`at`) **strictly later than the intent's completion event timestamp**, in addition to the previously accepted requirements (completion record exists; pass ids strictly after the intent's `latestPassIdBefore`; pass timestamps after the intent; adjacency in id order). A completion-less intent remains conservatively counted unless explicitly acknowledged; a completed attempt whose only pass pairs precede its completion likewise remains counted until a post-completion pair or an acknowledgment. The durable discharge-event architecture is unchanged.

**T-40 revised** to demonstrate the required sequence with honest timestamps: two passes land during I2's park at handler-entry times inside the park window; I2 resumes after further time passes, so its completion timestamp is strictly after both; a subsequent evaluation's derivation leaves I2 **completed-but-ineffective** (the parked-period pair cannot discharge the act it precedes); a qualifying post-completion pair then discharges it; total recorder pruning leaves both durable discharges standing; the historical incomplete-intent visibility (acknowledged orphan) is asserted as before.

## 4. RC-3 — T-27 completed (disposition: test evidence completed; no production change resulted)

T-27 now first exercises **a successful A-1 registration against the representative held fixture** (the attempt-3 shape: preserved plan, parked job, four conflicts baseline; stale reported registration; held state) and asserts `registered`. It then models the first delivery and a duplicate delivery of the same alarm and compares, between the two deliveries: grant identities and states; plan and job progression (state and revision); reservation and quota accounting (ledger op keys, phase state, quota parks, attempt-log count); **outbox contents** (id, kind, sent_at — compared directly, replacing the vacuous count assertion); schedule-processing invariants (every row processed by the first delivery remains in its processed state after the duplicate; continuation may add rows but reprocesses none); queue sends; and the recorder (exactly one additional pass per delivery — the permitted ordinary continuation). All comparisons are exact-equality. **The stronger test exposed no defect**; no production code change was required or made for RC-3.

## 5. B-G2 disposition (carried forward, as accepted)

A-1 applicability: incompatible fixture; no substantive B-G2 test executed. Existing WS2 evidence: 110/110 and the separate 4/4 additions, as previously recorded (pins `4a924a7c…`, `6014babe…`). Future obligation: rerun the applicable complete B-G2 battery against the separately authorized composed candidate. Neither an A-1 regression failure nor a B-G2 pass on A-1. The scratch-tree incident stands recorded as an offline fixture-isolation deviation, corrected before that round's final run; no mutating harness has been pointed at a candidate or base tree through a writable symlink since (the one B-G2 attempt this round — none was made; the disposition required no retry).

## 6. Complete rerun on this tree (one run; overall exit 0; logs pinned)

| Suite | Result |
|---|---|
| A-1 acceptance battery (52 tests) | **47 pass, 0 fail, 5 skipped** (deferred register unchanged: T-12/T-21/T-22 → A-3; T-29 → L-1; T-24b procedural) |
| S1 enforcement | 9/9 pass |
| Containment | 42/42 pass |
| P2 recorder | 33/33 pass (32 standing + the A-1 guard) |
| R5A | 23/23 pass |
| V-3 cold restart | 5/5 pass |

Rollback compatibility (T-36) re-executed on this tree inside the battery. No earlier result is represented as a result from this tree.

## 7. Exclusions and next step

No deployment proposal has been prepared; none is cleared. No production read or write, evaluation, acknowledgment, stimulus, containment transition, queue or settings change, or generation act occurred. W-4 remains an **OPEN HISTORICAL DEVIATION**. L-1 separately gated. WS2/Batch untouched.

**Next step:** Rowan's focused review of RC-1–RC-3. If that review clears the candidate for deployment-proposal preparation, the proposal will be presented to Julie for her separate decision; deployment itself remains separately gated on her further GO.

**Turn: Rowan's** (focused review of the three localized corrections). Then Julie's.
