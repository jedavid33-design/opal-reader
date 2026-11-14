# STANDARD SMOKE GATE — EXECUTION RECORD

Case: Opal Roundtable, issue #15. Date: 2026-11-14.
Operative specification: the corrected Standard execution package (pin
`a6616a0d…`) as supplemented (pin `4de3121b…`) and ruled (Rowan's
census-supplement ruling, verbatim board comment 6883018057), jointly.
Authorization: Julie's execution GO, 2026-11-14 ~14:31 ET (button tap +
restated in text), recorded at board comment 6883042886.
Handoff: RT-H-20261114-stdgate (this record).

## OUTCOME: EXECUTED — COMPLETE SUCCESS. THE GATE ENDS HELD.

Both stages completed and were accepted by Julie on playback. Exactly
five administrative mutation attempts were made — the authorized five,
no more. No STOP condition arose. No deviation from the operative
specification occurred.

## Window

- Opening census: 2026-11-14 ~19:31–19:35Z (2:31–2:35 p.m. ET).
- Lift (act 2): deployment at 2026-11-14T19:37:59.427793Z.
- Re-hold (act 4): deployment at 2026-11-14T20:11:26.7363Z.
- **Live window: 33 minutes 27 seconds** of the authorized 4 hours.
  Stage 2 submission at 19:43:24Z (limit: lift + 3 h). Closing acts
  complete ~20:12Z (limit: lift + 3 h 30 m).

## Opening census — ALL ITEMS PASS (16/16)

Health: build `8a16def4…`, coordinator armed, generation halted.
Settings: GENERATION_HALT "1", policy enforce, 10 bindings; script
etag `611a23c8…`; observability enabled + persisted. Queue: paused,
sole consumer `f260f218…`, sole producer the worker; the queue object
exposes no backlog field (accepted limitation, per the supplement).
Containment NORMAL, verified, `updatedAt` 1793933356719. Phase
accounting (both surfaces): settled 1,406,466; estimatedUnverified
19,018; reservedUnverified 5,648; unknownOpen 0; remaining 12,087,886.
Quota: PT day 2026-11-14; net attempts 1; dispatches 0; reserved 12;
ledgerSeq 371 (the post-L-1 grant-cycle bookkeeping, explained per
grant below); reconcile ok, censusComplete, drift [].

Deliverable-work inventory (the ruling's §2 condition): six plans at
standing states; smoke job grants enumerated in full — 1–5 `reported`
(November), 6–15 `voided` (the L-1 revival cycles), 16 `issued` (the
single live grant, occurrence `f4b451a5…`, position 107); no
`handoff_uncertain`, no unresolved state anywhere. Parked-policy job
`1832c21f…` re-read: `parked_policy` rev 1, grants []. Plan-less or
historical deliverable work outside this inventory: none found.
Smoke plan `active` {20, 19, 0, 0, 0}, quarantine held: false;
position 107 `granted`, executionState null. Conflicts: exactly 4.
Settings revision 1. Watermarks: content 18 / bindings 1861.
Repair status: intent 1 discharged, effective strikes 0, no new
intents. Recorder: latest pass 488; the latest pass delivered 55 ms
after its predecessor's due (due-aligned); recordingFailures 0.
Quotes re-verified live: Chapter 4 remainder (chapterIndex 3) = 1
eligible / 1,461 chars; Chapter 5 (chapterIndex 4) = 21 eligible /
29,145 chars / digest `831e456d…` (the proven P-13 expectation).
Item 16: Julie confirmed the live Gemini prepay balance in-window
from AI Studio: **$16.41**, Paid Tier 1, auto-reload OFF (screenshot
archived with the gate evidence).

## Act 1 — queue unpause

cf-api PUT `delivery_paused: false` → success; read-back: paused
false, sole consumer unchanged. **Boundary census repeat** (post-
unpause, pre-lift, ~75 s observation): exactly one permitted successor
movement — grant 16 expired and was safe-voided; **grant 17 issued**
as the live grant for the same job and occurrence (job rev 18). All
other values at census: halted, net attempts 1, dispatches 0, phase
unchanged, recorder pass 490, failures 0. No unexplained movement;
proceeded to the lift.

## Act 2 — halt lift

Settings-envelope flip: multipart PUT of the live build's 31 parts
(re-verified against the candidate manifest: 30/31 byte-identical,
sole difference the stamped build-identity part) with metadata built
from the just-before live settings — 10 bindings, secrets as inherit,
observability carried verbatim, sole value change GENERATION_HALT
"1" → "0". HTTP 200. Read-backs: binding "0"; /health
`generation: "enabled"`; **etag unchanged** (`611a23c8…`);
observability intact (no reset, no restorative PATCH needed).

## Stage 1 — Chapter 4 completion

Grant 17 delivered; position 107 executed (execution
`exec-ee4935c0…`, state committed): **2 attempts, both success**
(costs 9,756 + 9,927 = **19,683 units settled**). Plan totals
20/20, failed 0. Bindings watermark 1861 → **1862** (exactly one new
binding). Quota: dispatches 2, reservations released to 0. Julie's
playback acceptance: GIVEN ("It plays — Chapter 4 accepted",
~14:43 ET). **Forever Pucked Chapter 4 COMPLETE AND ACCEPTED, 20/20.**

## Pre-submission recheck + Act 3 — Chapter 5 submission

Immediate recheck: quota (net attempts 1, dispatches 2, reserved 0;
admission arithmetic consumed 2 + 12 = 14 ≤ 100), reconcile ok /
drift [], phase settled 1,426,149 / remaining 12,068,203 — PASS.
Exactly one SubmitJob POST at 2026-11-14T19:43:24Z with the operative
body (command_id `10889ce0…`, bookId FP, lane standard, d6Intent
{chapter, chapterIndex 4, phase forever-pucked, keepGoing false}).
Response (HTTP 200): `{"planId": "plan:0bf3b812b16d95bc912e91c8",
"created": true, "state": "active"}` — landing established by the
positively matched plan identity, per the supplement ruling §4: the
legacy receipt read for the command_id returns 404
`command_not_found` (no receipt is produced on this path, as the
ruling anticipated). Plan scope verified entry-by-entry: 21 entries,
all bookId FP, all chapterIndex 4, positions 113–133, 29,145 chars
total, one job (`plan:0bf3b812b16d95bc912e91c8:ch4`) — the exact
immutable scope of the verified quote. No resubmission was made or
needed.

## Stage 2 — Chapter 5 generation

Progress (2-minute polls): 0 → 1 → 6 → 8 → 11 → 14 → 15 → 19 → 21
over ~22 minutes; failed 0, blocked 0 throughout; no stall window
engaged. Final: **21/21 done**; 21 executions, all `committed`;
**41 attempts, all `success`** (zero policy blocks); sum of attempt
costs **422,397 units**, exactly equal to the phase settled increase
(1,426,149 → 1,848,546). Bindings watermark 1862 → **1883** (+21).
Julie's playback acceptance: GIVEN ("It plays — Chapter 5 accepted",
~15:11 ET). **Forever Pucked Chapter 5 COMPLETE AND ACCEPTED, 21/21.**

## Acts 4–5 — closing

Act 4 (halt restoration): mirror envelope flip (sole change
GENERATION_HALT "0" → "1"; same verified parts; observability
carried). HTTP 200. Read-backs: binding "1"; etag unchanged;
observability intact; /health halted. Act 5 (queue pause): PUT
`delivery_paused: true` → success; read-back paused true, sole
consumer unchanged. No grant was in flight at re-hold (reservations
0; all executions committed).

## Terminal census — HELD, all values consistent

Plans: 7 total. Smoke plan `complete` {20, 20, 0, 0, 0}; Chapter 5
plan `complete` {21, 21, 0, 0, 0}; the other five at standing states
(the retired Ch 2 plan untouched). Smoke job `complete` rev 19
(grants: 6 reported, 11 voided — full lifecycle accounting). Ch 5 job
`complete` rev 6 (4 grants, all reported). Parked-policy job
unchanged. Conflicts exactly 4. Settings revision 1. Watermarks:
content 18 / bindings **1883**. Quota terminal: net attempts 22
(1 Stage 1 cohort + 21 Stage 2), dispatches 43 (2 + 41), reserved 0,
ledgerSeq 394. Reconcile ok, drift []. Phase terminal: settled
1,848,546; estimatedUnverified 19,018; reservedUnverified 5,648;
unknownOpen 0; remaining 11,645,806 of 13,500,000. Containment
NORMAL verified, `updatedAt` unchanged. Repair surface untouched
(intent 1 discharged; no new intents; no acknowledgment invoked).
Recorder: pass 498, failures 0 — the chain remains live.

## Expenditure

Gate total settled: 19,683 + 422,397 = **442,080 units ≈ $0.4421**
against the accepted estimate ≈ $0.43 (an estimate, not a ceiling —
Rowan ST-G2 / supplement ruling §3). Against Julie's confirmed
$16.41 prepay balance: ≈ **$15.97** remains (derived, not re-read).
The four accounting categories were kept distinct throughout:
server attempt-ledger net count 22; provider-attempt reservations
transient (12-slot cohorts, 0 at every rest state); actual provider
dispatches 43; settled expenditure as above. No new unresolved
billing or delivery uncertainty arose.

## Counted acts

Exactly 5 administrative mutation attempts: (1) queue unpause,
(2) halt lift, (3) one Chapter 5 SubmitJob, (4) halt restoration,
(5) queue pause restoration. No other production mutation was made.
(The lift and re-hold each carried observability in the upload
metadata; neither reset it, and no conditional settings PATCH was
needed — one fewer act than the A-1 deployment pattern required.)

## End state

**HELD** — including on success (ST-G6). Generation halt restored,
queue re-paused, both new chapters complete and accepted. Operational
release (leaving generation on for everyday use) is a separate later
proposal on this smoke evidence and is NOT authorized by this gate.
The gate's authority is exhausted.

Evidence: `~/workspace/ch2-program/std-gate/` (census captures,
boundary reads, flip ledgers + PUT responses, submission body +
response, stage poll logs, diagnostics captures, Julie's balance
screenshot).
