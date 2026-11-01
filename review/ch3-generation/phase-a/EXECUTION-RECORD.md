# Chapter 3 PHASE A — Execution Record

**Outcome: STALLED at 8 of 23 segments — plan `active`, not complete, not parked.**
Cohort 1 (8 segments) generated, committed, and bound cleanly. The plan then
stopped advancing: the cohort-1 grant was never closed, and on the shipped
code no path exists that closes it or issues a further grant for the job.
No STOP-law (§8) trigger occurred — no unknown billing, no partial /
TerminalBlock, no ambiguity about what was mutated. No repair, resubmission,
second release, or second submission was attempted (none is authorized).
Phase A is **not complete**; the §10A completion criteria are not met.
Phase B was not touched (no exemption call under any circumstance).

- Authorization: Julie's Phase A GO, opal-roundtable issue #15 comment
  **6550733265** (Oct 31, 2026 ~7:44 p.m. ET), recorded before any step.
- Governing proposal: CH3-GENERATION-PROPOSAL-v2 (pin `8f522593`), §5/§6/§8/§10A.
- Live build throughout: `63d7260ef0c87c45cdcb88c7007643bb90e1631c`.
- Execution window: 2026-10-31T23:47:04Z → 2026-11-01T00:29:57Z (closing capture).
- Evidence: `evidence/` (77 files) beside this record.
- Mutations in this phase, total: **one** park-release write (E1) and **one**
  plan submission (E2, second envelope shape — see E2 note; the first shape
  was rejected pre-write and created nothing). Everything else was reads.

---

## Preconditions — ALL PASS (capture 2026-10-31T23:47:04Z)

`evidence/*-pre.json`, `evidence/census-page-*-pre.json`.

- `/health`: build `63d7260e…`, generation `"enabled"`, coordinator `"armed"`.
- Queue `opalreader-generation-v2`: `delivery_paused: false`, sole consumer
  `f260f2188d80426bb0588685e9d084eb` unchanged.
- Fresh COMPLETE reconcile census: armed `true`, `ok === true`, drift empty,
  `currentDayBlocked: false`; sole exception the known adjudicated straddler;
  day totals PT 2026-10-29 = 57, PT 2026-10-30 = 79, PT 2026-10-31 = **0**
  before this phase.
- Conflicts: exactly the 3 known `schedule_dead` rows (ids 1/2/3).
- Ch 3 job `1832c21fcf0425454227c4736048a8a632f422abca4a2685ddb775bb1681406a`:
  `parked_policy` rev 1, fingerprint
  `b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282` exact;
  27 rows (3 ready / 24 pending).
- Chapter eligibility (bookId `5c589095-f812-48a2-8ab2-03ba2791f2b2`,
  chapterIndex 2): eligible 0, exclusions {bound_already 3, parked 24},
  digest `12930307b7bda4cb438e2f981a62e052f40ede5dd5533be1a3b5c3fc67b4e71d`.
- No `d6_park_releases` rows existed (no read route exists; the state was
  proven by the E1 response's `alreadyReleased: false` / `releaseId: 1`).
- Phase forever-pucked: settled **579,339**; estimatedUnverified 19,018;
  reservedUnverified 5,648; unknownOpen 0; remaining 12,915,013.
  Settings rev 1. Watermarks: content 18 / bindings **1818**.
- Plans inventory: exactly the 3 known (smoke `complete`; old Ch 2 `retired`;
  fresh Ch 2 `complete`). No Ch 3 plan. Batch unarmed (`batch_not_armed`).

## E1 — Park release — PASS (2026-10-31T23:47:35Z, one call)

`evidence/e1-request.json`, `evidence/e1-response.json`.

One `POST /v2/d6-release-park` via the operator connector, body per the
shipped module (jobId + the enumerated 23 occurrence ids at definition
indexes 3–25 + authorizationRef naming comment 6550733265). Idx 26's id
`2a85f74f-353d-4c25-a86a-4a4db392868b` was asserted absent from the set
before sending and is absent from the response set.

Response: HTTP 200, `outcome: "applied"`, `alreadyReleased: false`,
**releaseId 1**, state `"live"`, releasedAt 1793490456541, tombstonedAt null;
the returned set is exactly the 23 requested ids in definition order.

## HARD CHECKPOINT — PASS (2026-10-31T23:47:39Z)

`evidence/checkpoint-elig-ch3.json`.

Chapter eligibility immediately after E1 read **exactly eligible 23 /
bound_already 3 / parked 1** (idx 26 only), voice_prompt 0, other 0;
totalChars 32,006; expectedCostMicroCents 451,213; digest
`40143b1c664ab02f08b4239297da2609169ef1957a5df5fe13fbb42cdcbabd95`.

## E2 — One SubmitJob — PASS, with a disclosed envelope correction

First submission (23:47:45Z, `evidence/e2-request.json` /
`evidence/e2-response.json`): the `d6Intent` was placed directly under
`payload`. The shipped D6 intent forward fires only on
`payload.data.d6Intent`, so the command fell through to the coordinator's
low-level `_submitJob`, which rejected it deterministically with
`{outcome: "rejected", reason: "job_shape"}` — **pre-write; nothing was
created** (plan inventory re-read immediately after: still exactly the 3
known plans, `evidence/e2-postreject-planlist.json`).

Corrected submission (23:48:34–35Z, `evidence/e2-request-corrected.json` /
`evidence/e2b-response.json`): SAME command_id
`fresh-ch3-20261031-fp-chapter3-v1`, IDENTICAL semantics (bookId
`5c589095-f812-48a2-8ab2-03ba2791f2b2`, chapter scope, chapterIndex 2,
lane standard, phase forever-pucked, keepGoing false); only the envelope
nesting was fixed to `payload.data.d6Intent`. Result: plan
**`plan:e377a5559961b294154276b6`** created (`created: true`, state
`active`; createdAt 1793490516278).

Immediate plan read-back (`evidence/e2-plan-readback.json`) was exact per
proposal E2: 27 entries = 23 `eligible` (char sum 32,006, matching the
checkpoint quote), 3 `bound_already` (idx 0–2), 1 `excluded_parked`
(idx 26); totals {eligible 23, done 0, failed 0, blocked 0, prompts 0};
quarantine {held: false, approvalRequired: false}; chapter job id
`plan:e377a5559961b294154276b6:ch2`. This was the phase's only submission.

## E3 — Monitoring — plan STALLED at 8/23 (no terminal state)

Monitor: `tools/monitor.py`, 45 s cadence (plan + quota + capabilities +
plan diagnostics per poll). Logs: `evidence/e3-monitor.log` (polls 0–7,
23:49:00Z–23:54:31Z) and `evidence/e3-monitor-2.log` (polls 0–40,
23:57:29Z–00:28:55Z). **Disclosure:** a context compaction stopped the
first monitor process after poll 7; monitoring resumed at 23:57:29Z.
No mutation was made by either monitor (read-only GETs); the only state
change in the gap was the plan's own 8th commit (below).

Progress while generation flowed (all plan state `active`, stopReason
null, failed 0, blocked 0 throughout):

| Time (Z) | Done | Dispatches today | Phase settled | Attempt outcomes (cumulative) |
|---|---|---|---|---|
| 23:49:00 | 0 | 0 | 579,339 | — |
| 23:49:47 | 0 | 2 | 588,474 | success 1, (1 dispatching) |
| 23:50:34 | 1 | 7 | 609,462 | success 5, policy_block 2 |
| 23:51:22 | 3 | 15 | 635,976 | success 10, policy_block 4 |
| 23:52:09 | 4 | 22 | 656,262 | success 15, policy_block 7 |
| 23:52:56 | 5 | 29 | 680,184 | success 19, policy_block 9 |
| 23:53:44 | 6 | 34 | 694,764 | success 22, policy_block 11 |
| 23:54:31 | 7 | 41 | 718,569 | success 27, policy_block 13 |
| 23:57:29 | **8** | **44** | **732,303** | **success 30, policy_block 14 — all 44 confirmed** |

The 8th commit landed between 23:54:31Z and 23:57:29Z. From 23:57:29Z
through the final poll at 00:28:55Z — 41 consecutive polls, ~31 minutes,
spanning the 15-minute grant-lease fuse (~00:04Z) and three 10-minute
watchdog cycles — **every sampled value is identical**: done 8,
dispatches 44, settled 732,303, inFlightUpper 0, diagRecords 8, all
attempt phases `confirmed`. The plan row itself has not been mutated
since `updatedAt` 1793490569646 (23:49:29Z).

The 8 committed segments (chapter idx / occurrence id / attempts):
idx 7 `05941584-5669-4ea9-91e7-59a5397f46c4` (4);
idx 9 `5f6ca428-524d-448a-8fbf-a773dfc132e6` (6);
idx 11 `4e163ba6-87d6-467f-a8a7-52a0062ca69e` (6);
idx 12 `4746f9a6-9f05-4a65-a175-83b24f8d539a` (6);
idx 16 `338676cd-63fa-409d-8e42-e13c28636de3` (6);
idx 20 `203af7f9-d88a-4f2a-a0fd-3f70d0a11f07` (6);
idx 23 `0c83bc51-7fc9-4ac7-b0ca-f81f1729a38e` (4);
idx 25 `35ab06fd-8459-41ff-a8b7-ae4bf25be731` (6). Total 44 attempts ✓
(`evidence/e3-stall-diag.json`). The `policy_block` attempt outcomes are
provider refusals at cost 0 absorbed by the shipped recursive splitting
path — expected machinery, not a STOP trigger (blocked stayed 0).

### Stall mechanism — established from shipped source + live reads

1. **Cohort bounding sized grant 1 to 8.** The quota guard's
   `boundGrantTargets` (quota-budget.mjs) bounds a grant to the longest
   pending prefix whose worst case fits the day's headroom: 12 slots per
   fresh occurrence against a 100/day limit → 8 occurrences (96 slots).
   The other 15 were never grant targets; they remain `pending` on the
   job (live job read: 8 `ready` / 15 `pending`).
2. **The grant never closed.** Job view (grants table) at closing:
   `grant:plan:e377a5559961b294154276b6:ch2:1:full`, state **`issued`**,
   revision 2 (`evidence/job-ch3plan-post.json`). The only shipped path
   that closes a grant is the executor's end-of-message `handleReport`
   (coordinator.mjs: `UPDATE grants SET state = 'reported'` +
   `settleReservationsForGrant`). Independent corroboration that it
   never landed: the grant's quota reservation is **still open** —
   closing census for PT 2026-10-31 reads dispatched 44 / **reserved
   52** / consumed 96, and 52 is exactly Σ(12 − attemptsUsed) over the
   8 committed executions (8+8+6+6+6+6+6+6).
3. **The driver therefore cannot issue cohort 2.** `driveOnce`'s grant
   step (service.mjs) returns without requesting a grant while any
   grant for the job reads `issued` (the `liveGrant` check). No other
   shipped schedule path closes an issued grant whose occurrences have
   all left `granted`: the lease handler computes newly-unknown from
   occurrences still in `granted` (none remain under this grant → a
   no-op); the watchdog drains only unsent outbox rows (this grant's
   row was sent); `retry_grant` rows are scheduled only by void /
   rate-limit / report paths, none of which fired. Conflicts remained
   exactly the 3 known rows throughout — no schedule row died.
4. **The stall is doubly locked.** Even if a second grant had been
   requested during the window, the open reservation leaves derived
   day headroom of 100 − 96 = 4 slots < 12, so cohort 2 would have
   been refused `provider_attempt_budget` and the plan would have
   parked on quota instead. The unclosed grant and the reservation
   leak are the same root event.
5. **Why `handleReport` never landed is NOT determined** from the
   available read surfaces (the transitions log is not API-readable;
   Workers Logs telemetry is not accessible on the cf-api credential —
   an established limitation, not retried). Two candidate micro-causes
   are consistent with the evidence; neither is asserted as fact:
   (a) the queue invocation ended after the final commit but before or
   within the closing report (the report is transactional, so a
   failure inside it rolls back and leaves the grant `issued`);
   (b) on any redelivery, the executor skips all 8 occurrences (now
   `ready`, not `granted`) and, with zero report results and zero new
   commits in that pass, never calls `handleReport` — so a lost first
   report is not self-healing.
6. There is **no production precedent** for an inter-cohort transition:
   the Gate-8 Chapter 2 run's 18 segments were covered by a single
   grant (`grant:…:ch1:1:full`, still `issued` rev 2 on the completed
   plan — the same residue shape), so cohort succession was never
   exercised live before this phase. The 8/7/3 cohort sequence exists
   only in the harness regression.

## E4 — NOT RUN (plan not complete)

The §10A completion criteria are not met (done 8 ≠ 23; bound 11 ≠ 26).
The reads below are a **stall-state closing inventory** (capture
2026-11-01T00:29:45Z, `evidence/*-post.json`,
`evidence/census-page-*-post.json`), not an E4 close-out:

- `/health`: build `63d7260e…`, generation `enabled`, coordinator `armed`.
- Queue: `delivery_paused: false`.
- Chapter eligibility: **eligible 15 / bound_already 11 / parked 1**,
  totalChars 20,864, expectedCostMicroCents 294,137, digest
  `9453ab5dc7ee6ade7c650d14066054b965875f2ef1b65eb24bc633588d778e67`.
- Bindings watermark **1826** (1818 + 8 exactly); content watermark 18
  (unchanged).
- Phase forever-pucked: settled **732,303** — a recorded delta of
  **+152,964 units ≈ $0.1530** over the precondition 579,339, all from
  this plan's 8 commits; estimatedUnverified 19,018 (unchanged);
  reservedUnverified 5,648 (unchanged); unknownOpen **0**; remaining
  12,762,049.
- Quota: dispatches today (PT 2026-10-31) **44**, reserved **52**,
  consumed **96** of the 100/day app-selected cap.
- Fresh reconcile: armed `true`, `ok === true`, drift empty,
  `currentDayBlocked: false`; sole exception the known straddler.
- Conflicts: exactly the 3 known `schedule_dead` rows (raw set identical
  to preconditions; `evidence/e3-stall-conflicts.json`).
- Settings rev 1 (unchanged). Parked Ch 3 job: still `parked_policy`
  rev 1, fingerprint unchanged — untouched by design.
- Plan: `active`, stopReason null, totals {eligible 23, done 8,
  failed 0, blocked 0, prompts 0}. Job: `generating` rev 2; grant 1
  `issued` rev 2. Park-release row 1: `live` (its effect is visible in
  the checkpoint + closing eligibility reads; no separate read route
  exists).
- Exemption state: none — no `d6_chapter_exemptions` write of any kind
  was made (Phase B untouched).

## What was and was not mutated

Mutated: (1) one `d6_park_releases` row (releaseId 1, live, the 23 ids);
(2) one plan + its chapter job + grant 1 + 8 execution records + 44
attempt records + 8 bindings (watermark 1818 → 1826) + phase settled
+152,964 — all by the single authorized submission and the system's own
execution of it.
Not mutated: Phase B / the exemption tables; any other chapter or book;
the parked job; settings; conflicts; the queue; the worker code; the
client. No second release call, no second submission, no resubmission,
no repair, no rollback.

## Remaining steps (not this phase's to take)

- **Julie's playback check**: the 8 newly generated Chapter 3 segments
  (idx 7, 9, 11, 12, 16, 20, 23, 25) plus the 3 pre-existing (idx 0–2)
  are bound and should be playable. The other 15 released segments and
  idx 26 remain silent.
- **A decision is needed on the stalled plan** (Rowan review of this
  record, then Julie's direction): the plan will not advance on any
  shipped timer, and no continuation action was authorized under the
  Phase A GO. Phase B (idx-26 exemption) must not proceed on the
  assumption Phase A completed — it did not.
