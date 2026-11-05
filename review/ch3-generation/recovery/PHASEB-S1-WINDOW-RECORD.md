# PHASE B S1 WINDOW RECORD — the 72-hour observation window: W-2 EXPECTED S1 EVENT, then W-4 (UNRESOLVED) at close

Date: 2026-11-05
Window record pin: <WINDOW-RECORD-PIN>
Pin target: repo `jedavid33-design/opal-reader`, branch `ui1-review`, `review/ch3-generation/recovery/PHASEB-S1-WINDOW-RECORD.md`

**Window identity.** The Phase B S1 observation window opened **2026-11-02T23:28:41Z** (2026-11-02 18:28:41 EST), at completion of the Stage-2 (Grant 1 Part A, R5a-D) upload's D2 read-back, and closed **2026-11-05T23:28:41Z** (2026-11-05 18:28:41 EST). Authorization: Grant 1 (Parts A+B+C), Julie's GO recorded on the Roundtable board, issue #15 comment `6590949982`. Operative package: R5a-D/S1 sequencing proposal REVISED-2, pin `11a296e79f0963fc005a23edd3e2a9dffbf012fd`, as amended by RM-1-c, pin `f374ee740eb871b6799518935b15aa5dfd8f9dfa`. Production build throughout the window: `fdb02395b3775dc945baa395591a73060ab146c4`.

Every fact, timestamp, count, and value in this record is taken from the window log (§12 names it); raw values are quoted exactly as the log records them. Where a figure comes from a board comment rather than the log, the comment is named.

## 2. Executive summary for Rowan

- **The S1 event OCCURRED and was classified W-2 EXPECTED S1 EVENT.** At the +24h checkpoint there had been no natural wake; the Part D preflight was CLEAN and Julie gave her separate Grant 2 GO. Exactly one fallback stimulus was sent in session by Wren at **2026-11-03T23:26:13Z** (`command_id` `s1-stimulus-20261103232613`, a `RequestPause` against the confirmed-nonexistent job `alarm-wake-probe:nonexistent`); it was refused as designed (`{"outcome":"rejected","reason":"job_not_found"}`), and a drive pass was recorded **~1.9 s later**. Exactly one grant was issued, for the preserved plan's single occurrence; **$0** was spent; **dispatched 0**. The chain revived into the §7.3 pre-classified churn and stayed exactly inside it at every completed check.
- **The chain then stopped delivering.** It delivered **296** recorded passes in total. The last pass is #296 at **2026-11-04T20:56:59.071Z**. Later on 2026-11-04 the **second 1101 platform fault** was observed: at the +48h check every DO-backed `/v2` read surface returned HTTP 500 / error code 1101 (the front-door surfaces — health and the queue read — still answered). The reads had recovered by the +54h check, but no pass has been recorded since 20:56:59.071Z.
- **Closing classification: W-4 WAKE OBSERVED, DELIVERY NOT OBSERVED (continuing), UNRESOLVED.** The standing registration `armedAt` **1793826389431** (due **2026-11-04T21:06:29.431Z**) stood **26h14m37s past due** at the closing census with no delivery. The W-4 is carried to you unresolved — §6 states the evidence set and, explicitly, what is *not* claimed. It is a listed C3 blocker (§4.5 of the C3 package), so your disposition is on the critical path.
- **Contingencies never fired.** S1-X never fired — no FIRING DECISION entry exists anywhere in the log, and no verified T1–T4 trigger was ever recorded. Layer-1 (`contain_drive`) was never applied. **WINDOW-FAILED was never declared**: the window's single failed check (+48h, the 1101 fault) left one unobserved interval of 11h59m18s, inside the 12h10m bound. The watch jobs' production mutation tally is **ZERO** — observation only; the only production command sent in the window was the Grant 2 stimulus itself.
- **Ends HELD.** Generation halted on both surfaces, queue delivery paused with exactly 1 consumer, containment NORMAL, $0 spent across the window, dispatched 0 throughout (§8).

Four questions for your ruling are at §10. Nothing in this filing executes or requests execution (§11).

## 3. Window chronology

### 3.1 WINDOW OPEN — 2026-11-02T23:28:41Z (baseline)

Verified D2 values recorded in the log's WINDOW-OPEN entry (Grant 1 execution verify(d2) 7/7 PASS):

- Build `fdb02395b3775dc945baa395591a73060ab146c4` (R5a-D composed build; coordinator part `5303cb6323da01c21a5ebe9a7983f87abe08e14945660daaebce99734849e1ed`); script etag `"bb90f18223e1802e1c417f17359f344499dc2d29c78e54db259f6f9ae4ac5c9e"`; 31/31 parts byte-identical to the stamped manifest; 29/31 identical to the pre-deploy C1 build.
- Health: generation halted, coordinator armed. Settings revision 1; `GENERATION_HALT` `"1"`; `OPALREADER_PHASE_POLICY` `"enforce"`; 10 bindings; observability enabled + persisted (the upload did not reset it; no settings PATCH was needed or made).
- Alarm: `armedAt` **1793562576104** — bit-identical to every pre-window read (the deployment performed no alarm action); `pendingSchedule` 2 / `pendingWatchdog` 1.
- Drive recorder: `tableState` `"missing"`, `drivePasses` [], `recorderHealth` null.
- Containment: NORMAL / `absent` true / `verified` true / `stopConfidence` `"not_applicable"`, stop and episode fields empty — identical on the operator route and the drive=1 projection.
- Preserved Phase B plan `plan:19cad189fab54b9c804a74a6`: `active`, totals {eligible 1, done 0, failed 0, blocked 0, prompts 0}, entry `pending` / `executionState` null, quarantine `held` false; job `plan:19cad189fab54b9c804a74a6:seg` `queued` revision 1, grants [].
- Phase accounting frozen on BOTH surfaces: settled **1029420**, estimatedUnverified **19018**, reservedUnverified **5648**, inFlightUpper 0, unknownOpen 0, remaining **12464932** (budget 13500000, `provider_unverified`).
- Quota reconcile `ok` true, drift [], sole straddler `att-37d63768-db4b-447d-8150-580b7c6ee257`; derived reserved 0; dispatched 2026-11-02 = 0.
- Conflicts: exactly the four pinned `schedule_dead` rows (ids 1–4). Watermarks content 18 / bindings 1841; idx-26 occupancy key FREE. Queue `opalreader-generation-v2` delivery paused, exactly 1 consumer `f260f2188d80426bb0588685e9d084eb`.
- Classification at open: the deployment is not a wake (`armedAt` bit-identical, recorder empty, zero §7.3-set transitions).

### 3.2 Hourly phase — nominal +1h to +12h, plus the +13h handoff check: all W-0

Checks `CHECK +0h51m` through `CHECK +11h51m` (nominal +1h … +12h; actual first reads 2026-11-03T00:20:13Z → 2026-11-03T11:20:11Z) all completed with full §3.1 read sets, all status 200, and all classified **W-0 NO EVENT** — every read an EXACT MATCH on the window baseline. A thirteenth performed check, `CHECK +12h51m` (nominal +13h, actual first read 2026-11-03T12:20:05Z), also completed W-0 and performed the handoff. Every consecutive interval was a VERIFIED interval of ≈1h, inside the hourly gap bound 2h10m. No missed or failed check in the hourly phase.

### 3.3 HANDOFF — 2026-11-03T12:20–12:21Z

The +13h run enabled `phaseb-s1-window-watch-6h` (verified enabled, next run 2026-11-03 12:19:53 EST) and disabled the hourly job `phaseb-s1-window-watch` (verified `enabled: false`, next_run null): HANDOFF COMPLETE. One logging note, recorded candidly in the log: the first 6-hourly run found no HANDOFF entry yet in the log when it read the tail — coverage at the +12h/+13h points was therefore DOUBLED (both jobs performed checks ~1 minute apart), not gapped; the HANDOFF entry was appended after that run noted it missing and is present thereafter.

### 3.4 6-hourly phase, pre-stimulus — +12h, +18h: W-0

- First 6h run (nominal +12h; actual reads 2026-11-03T12:21:49Z–12:22:04Z): **W-0 NO EVENT**, exact baseline match.
- `CHECK +17h51m` (nominal +18h; actual reads 2026-11-03T17:20:34Z–17:20:40Z): **W-0 NO EVENT**, exact baseline match. Interval from the previous check 4h58m45s, verified, inside the 6-hourly bound 12h10m.

### 3.5 +24h — W-0, and the Part D preflight: CLEAN

`CHECK +23h51m` (nominal +24h; actual reads 2026-11-03T23:20:49Z–23:21:07Z): **W-0 NO EVENT** — no W-1/W-2 anywhere in the log from WINDOW-OPEN to that point. Part D preflight (§6.3, data collection only), as logged:

- Log completeness WINDOW-OPEN → +24h: CLEAN — every scheduled check logged and completed (hourly nominal +1h to +13h: 13 checks, all W-0; HANDOFF present; 6-hourly nominal +12h and +18h: both completed W-0; the +24h check itself completed W-0). No missed/failed checks outstanding; no unobserved interval (latest consecutive interval 6h00m15s, within the 12h10m bound).
- Recorder baseline (the check's read #1): `tableState` `"missing"`, `drivePasses` [], `recorderHealth` null, `armedAt` 1793562576104, `pendingSchedule` 2, `pendingWatchdog` 1.
- Target nonexistence: probe `GET /v2/jobs/alarm-wake-probe:nonexistent` → status 404, body `{"error":"job_not_found"}` — confirmed.

### 3.6 Grant 2 and the stimulus — 2026-11-03T23:26:13Z

On the clean preflight, Julie gave her separate Grant 2 GO (Nov 3, 2026, 6:24 p.m. ET, Coding Projects chat, options-widget tap + confirming message), recorded on the board BEFORE the send — issue #15 comment `6618087797` (RT-H-20261103-7c2e91, read back byte-identical). The pre-send census was fresh, complete, and at window baseline on every value — NO DEVIATION (probe target nonexistence re-verified at send time: 404 `{"error":"job_not_found"}`).

Exactly one stimulus was sent, and it was never re-sent: `POST /v2/commands` via the client connector, `command_id` **`s1-stimulus-20261103232613`**, body `{"command_id":"s1-stimulus-20261103232613","type":"RequestPause","payload":{"jobId":"alarm-wake-probe:nonexistent"}}`. Response (HTTP 200): `{"command_id":"s1-stimulus-20261103232613","outcome":"rejected","reason":"job_not_found"}` — the expected refusal; per the design this is SUCCESS for Grant 2's purpose (handleCommand wakes the coordinator before apply refuses).

### 3.7 The four executor observation sets — W-2, then W-2 CONTINUING ×3

- **Set 1** (reads 2026-11-03T23:26:32Z–23:26:36Z): **W-2 EXPECTED S1 EVENT** — the first drive pass was already recorded (§5). NO intervention.
- **Set 2** (reads 2026-11-03T23:32:22Z–23:32:26Z): **W-2 CONTINUING** — state unchanged; still exactly one pass recorded; `armedAt` 1793748974899 (2026-11-03T23:36:14.899Z) future-dated relative to the read — the next watchdog tick, pending delivery.
- **Set 3** (reads 2026-11-03T23:38:22Z–23:38:28Z): **W-2 CONTINUING** — the second pass delivered on schedule (pass 2 at 1793748975298 = 2026-11-03T23:36:15.298Z); the single grant `seg:1:full` still `issued`, no second grant.
- **Set 4** (reads 2026-11-03T23:46:23Z–23:46:29Z, FINAL): **W-2 CONTINUING** — 5 passes recorded; grant `seg:1:full` had reached its lease-expired void state and its successor `grant:plan:19cad189fab54b9c804a74a6:seg:2:full` was issued for the SAME single occurrence (job revision 3) — the §7.3 churn baseline operating as pre-classified, expressly NOT a T4 second grant (no concurrent, foreign, or additional-occurrence grant; derived reserved held at exactly 12 throughout). The parked Ch 3 job read `parked_policy` revision 1 — unchanged. Ends HELD, $0 spent.

### 3.8 Continuing checks — +30h, +36h, +42h: W-2 CONTINUING

- **+30h** (`CHECK +29h51m`; reads 2026-11-04T05:20:38Z–05:21:10Z): 77 total passes (returned ids 28–77 of 77; latest pass id 77 at 1793769384616), all stage complete, no errors; job `generating` revision 25; live grant `seg:24:full` (seg:1–23 voided sequentially); derived reserved 12; dispatched 0; phase frozen; containment NORMAL.
- **+36h** (`CHECK +35h51m`; reads 2026-11-04T11:20:23Z–11:20:39Z): 160 total passes (returned ids 111–160 of 160; latest pass id 160 at 1793790986824); job revision 49; live grant `seg:48:full` (seg:1–47 voided); all other markers in-set.
- **+42h** (`CHECK +41h51m`; reads 2026-11-04T17:21:35Z–17:21:41Z): latest pass id 244 at 1793812588536 (= 2026-11-04T17:16:28.536Z; returned window ids 195–244, contiguous); job revision 73; live grant `seg:72:full` (seg:1–71 voided); all other markers in-set. **This is the last fully good read set before the fault.**

### 3.9 The second 1101 fault — +48h check FAILED

`CHECK +47h51m` (nominal +48h; first read pass 2026-11-04T23:20:36Z–23:20:57Z; confirmation retry of failing surfaces 2026-11-04T23:21:30Z–23:21:33Z, identical results): **8 of the 10 §3.1 surfaces FAILED with HTTP 500, body `error code: 1101`** — drive=1 diagnostics, containment, plan diagnostics, job view, capabilities, quota reconcile, conflicts, and bindings sync changes. The two readable surfaces matched the held baseline but do not establish event state: the Cloudflare queue read (status 200 — `delivery_paused` true, exactly 1 consumer) and `/health` (status 200 — build `fdb02395b3775dc945baa395591a73060ab146c4`, generation halted, coordinator armed). Classification: NONE — FAILED CHECK (read set incomplete), counting as missed for gap purposes. The log states the consequence exactly: whether the chain was still inside the §7.3 set, whether any pass had run since pass 244, and whether any T1–T4 condition existed were all UNVERIFIED as of that check; an unverified trigger never fires S1-X, and no FIRING DECISION was recorded.

Onset bracket, from the log's own timestamps only: the fault was not present at the +42h check's last good read (**2026-11-04T17:21:41Z**) and was present at the +48h check's first read (**2026-11-04T23:20:36Z**). The recorder, read retrospectively at +54h, shows drive passes continuing inside that bracket until pass 296 at 2026-11-04T20:56:59.071Z, and none after. The log does not support a tighter onset for the read-surface failures than that bracket.

### 3.10 +54h — reads recovered; W-4 first classified

`CHECK +53h51m` (nominal +54h; reads 2026-11-05T05:20:53Z–05:21:00Z): all 10 §3.1 reads status 200, complete — the 1101 outage had cleared on every previously failing surface. Every §7.3 set marker was in-set (live grant `seg:87:full`, job revision 88, reserved 12, dispatched 0, phase frozen, containment NORMAL, no recorder error). The classifying fact was the delivery stall (§6): **W-4 WAKE OBSERVED, DELIVERY NOT OBSERVED**, first classified here. The completed-to-completed span +42h → +54h (2026-11-04T17:21:35Z → 2026-11-05T05:20:53Z) is **11h59m18s**, WITHIN the 6-hourly gap bound 12h10m (deadline was 2026-11-05T05:31:35Z); because the span contains the failed +48h check it is the window's one UNOBSERVED interval, closed by this check. Missed-check ladder: one missed/failed check, gap within bound — noted, cadence continued; escalation bound NOT breached; WINDOW-FAILED NOT declared; no cron jobs disabled.

### 3.11 +60h and +66h — W-4 continuing

- **+60h** (`CHECK +59h51m`; reads 2026-11-05T11:20:22Z–11:20:42Z): **W-4 (continuing)** — registration 14h13m53s past due; job/grant state unchanged from +54h. The quota PT day had rolled at 07:00Z: current-day (2026-11-05) totals dispatched 0 / reserved 0, with 2026-11-04's reserved 12 preserved in `dayTotals` — a calendar roll, not a movement (the log states this expressly).
- **+66h** (`CHECK +65h51m`; reads 2026-11-05T17:20:47Z–17:20:53Z): **W-4 (continuing)** — registration 20h14m18s past due; state bit-identical to +54h/+60h.

### 3.12 WINDOW-CLOSE census — nominal +72h

`WINDOW-CLOSE — CHECK +71h51m` (reads 2026-11-05T23:21:06Z–23:21:18Z; entry appended 2026-11-05T23:22:03Z; window close 2026-11-05T23:28:41Z). Full §3.1 read set, all status 200. Closing classification: **W-4 WAKE OBSERVED, DELIVERY NOT OBSERVED (continuing)** — registration 26h14m37s past due, no pass delivered for 26h24m07s. Ends-HELD values at §8. The run disabled `phaseb-s1-window-watch-6h` before appending the entry (verified by cron.status immediately after: `enabled: false`, next_run null, queued 0); the hourly job was already disabled at the handoff (re-verified this run). Both window jobs are now disabled.

## 4. Checks accounting

As established by the log and the scheduler histories, per the closing entry:

- **Hourly phase** (`phaseb-s1-window-watch`): nominal points +1h through +12h = 12 scheduled points — **12 performed and completed, all W-0**; plus one additional performed check at nominal +13h (the handoff run) — 13 performed, **0 missed, 0 failed**. (The pre-window SMOKE is excluded from coverage accounting.)
- **6-hourly phase** (`phaseb-s1-window-watch-6h`): nominal points +12h, +18h, +24h, +30h, +36h, +42h, +48h, +54h, +60h, +66h, +72h = 11 points — **10 performed and completed** (+12h W-0, +18h W-0, +24h W-0 / PART D PREFLIGHT, +30h/+36h/+42h W-2 CONTINUING, +54h/+60h/+66h W-4, +72h closing census W-4) and **1 FAILED** (+48h — 8 of 10 surfaces HTTP 500 / error code 1101; run record "failed"; the window's single missed check). **0 points with no run record** — no SCHEDULER-GAP, no LOG-FAILURE.
- **Unobserved intervals: exactly ONE** — 2026-11-04T17:21:35Z (+42h check first read) → 2026-11-05T05:20:53Z (+54h check first read), **11h59m18s** actual-to-actual, containing the failed +48h check; WITHIN the 6-hourly gap bound 12h10m. No gap bound was breached anywhere in the window, and the escalation bound was never breached. All other consecutive completed-check intervals are VERIFIED intervals.
- **WINDOW-FAILED was never declared.**

## 5. The S1 event evidence set

**Stimulus dispatch and response.** Dispatch 2026-11-03T23:26:13Z (2026-11-03 18:26:13 EST), by Wren (Grant 2 executor, in session), after a fresh complete pre-send census at window baseline with NO DEVIATION. Command: `POST /v2/commands`, `command_id` `s1-stimulus-20261103232613`, type `RequestPause`, payload `{"jobId":"alarm-wake-probe:nonexistent"}`. Response (HTTP 200): `{"command_id":"s1-stimulus-20261103232613","outcome":"rejected","reason":"job_not_found"}` — the expected refusal, which per the design is success for the gate (handleCommand wakes the coordinator before apply refuses). Sent exactly once; never re-sent.

**First pass.** Recorder row **id 1**: `at` **1793748374899** (= **2026-11-03T23:26:14.899Z**, ~1.9 s after dispatch), `finishedAt` 1793748374899, `stage` `"complete"`, `driveInvoked` true, outcomes `[{"planId":"plan:19cad189fab54b9c804a74a6","state":"active","grantId":"grant:plan:19cad189fab54b9c804a74a6:seg:1:full"},{"bindingProjection":{"scanned":0,"published":0,"noop":0,"conflicts":0,"pending":0}}]`, `outcomesMalformed` false, `errorName` null, `errorMessage` null, `armedAfter` **1793748974899**. Recorder health at the same read: `recordingFailures` 0, `lastRecordedAt` 1793748374899. The recorder `tableState` moved from `"missing"` (every pre-stimulus read) to `"populated"`.

**The grant.** Exactly one grant was issued: **`grant:plan:19cad189fab54b9c804a74a6:seg:1:full`**, state `"issued"`, revision 2 — for the preserved plan's single occurrence, `2a85f74f-353d-4c25-a86a-4a4db392868b`.

**Job and occurrence transitions.** Job `plan:19cad189fab54b9c804a74a6:seg`: `queued` revision 1 → **`generating` revision 2**. Occurrence `2a85f74f-353d-4c25-a86a-4a4db392868b`: `pending` → **`granted`** (`cache_key` null throughout the window).

**armedAt transition.** `armedAt` **1793562576104 → 1793748974899** — the delivered pass's watchdog re-arm (1793748974899 = 2026-11-03T23:36:14.899Z, the pass time + the 600 s watchdog period, per the set-1 entry). `pendingSchedule` 2 / `pendingWatchdog` 1, unchanged.

**Quota and phase at the event.** Quota reconcile: `ok` true, drift [], sole straddler; PT day 2026-11-03 totals: dispatched **0**, reserved **12**, consumed **12**. Provider attempts 0. Phase frozen on both surfaces (settled 1029420 / estimatedUnverified 19018 / reservedUnverified 5648 / inFlightUpper 0 / unknownOpen 0 / remaining 12464932). Containment NORMAL on both surfaces. Classification basis, as logged: every marker exactly inside the §7.3 pre-classified set — exactly one grant issued; occurrence `granted`; job `generating` rev ≥ 2; derived reserved 12 (∈ {0, 12}); dispatched 0; attempts 0; phase frozen; containment NORMAL; no recorder error. No T1–T4 condition present.

**Second pass.** Recorder row id 2 at **1793748975298** (= 2026-11-03T23:36:15.298Z — the watchdog tick delivering on schedule), stage complete, no new grant; the chain was live and self-delivering.

**The §7.3 churn across the window.** From set 4 onward the pattern was invariant at every completed check: when the live grant reached its lease-expired void state, a later pass issued its sequential successor for the SAME single occurrence; at no read were two grants live simultaneously; derived reserved held at exactly 12 (the log's stated cross-check: a concurrent second grant would read 24); the occurrence remained singly `granted`; dispatched remained 0; phase, conflicts, and watermarks remained frozen; containment remained NORMAL; every recorder row read was stage complete with null error fields, and `recorderHealth.recordingFailures` remained 0 at every completed check. Progression as logged:

| Observation | Total passes | Latest pass | Job rev | Live grant | Voided |
|---|---|---|---|---|---|
| Set 4 (+20m), 2026-11-03T23:46:23Z | 5 | id 5 | 3 | `seg:2:full` | seg:1 |
| +30h, 2026-11-04T05:20:38Z | 77 (ids 28–77 of 77) | id 77 at 1793769384616 | 25 | `seg:24:full` | seg:1–23 |
| +36h, 2026-11-04T11:20:23Z | 160 (ids 111–160 of 160) | id 160 at 1793790986824 | 49 | `seg:48:full` | seg:1–47 |
| +42h, 2026-11-04T17:21:35Z | latest id 244 (returned ids 195–244) | id 244 at 1793812588536 | 73 | `seg:72:full` | seg:1–71 |
| +54h, 2026-11-05T05:20:53Z | 296 (returned ids 247–296) | id 296 at 1793825819071 | 88 | `seg:87:full` | seg:1–86 |
| +60h / +66h / close | 296 (unchanged) | id 296 | 88 | `seg:87:full` | seg:1–86 |

Grant-carrying passes in each returned 50-row window numbered 14 where the log states the count (+30h, +36h, +42h, +54h, +60h, +66h, close). The most recent grant-carrying pass is **id 294** at **1793825789070**, carrying `grant:plan:19cad189fab54b9c804a74a6:seg:87:full`. By close: **87 grants total** — seg:1:full through seg:86:full all voided (revisions 2–87), exactly one live grant `seg:87:full` issued at revision 88.

## 6. The W-4 evidence set

**Last pass.** Recorder row **id 296** at **1793825819071** = **2026-11-04T20:56:59.071Z**, `finishedAt` identical, stage `"complete"`, `driveInvoked` true, error fields null. Its `armedAfter` — the standing registration — is **1793826389431**.

**Standing registration.** `armedAt` **1793826389431** = due **2026-11-04T21:06:29.431Z**, read identically on both alarm surfaces (the drive=1 `alarm` block and the containment route's `alarm` block) at the +54h, +60h, +66h, and closing reads. `pendingSchedule` 2 / `pendingWatchdog` 1, unchanged. No pass has been recorded after 1793825819071.

**Past-due ages** (the log's figures, at each check's first read):

| Check | First read | Registration past due | No pass delivered for |
|---|---|---|---|
| +54h | 2026-11-05T05:20:53Z | 8h14m24s | 8h23m54s |
| +60h | 2026-11-05T11:20:22Z | 14h13m53s | 14h23m23s |
| +66h | 2026-11-05T17:20:47Z | 20h14m18s | 20h23m48s |
| Close | 2026-11-05T23:21:06Z | 26h14m37s | 26h24m07s |

Every figure is far beyond the 2-hour W-4 threshold from the first classification onward.

**Everything else stayed in-set.** At +54h, +60h, +66h, and close the job/grant state was bit-identical in substance: job `generating` revision 88; 87 grants total, seg:1–86 voided, `seg:87:full` issued; occurrence `granted`; phase frozen on both surfaces; conflicts exactly the 4 pinned rows; bindings watermark 1841, 0 changes; queue paused, 1 consumer; containment NORMAL on both surfaces; recorder rows all complete, `recorderHealth.recordingFailures` 0. The log states at each W-4 check, in substance: nothing in the read set explains the stop — no recorder error row, recorderHealth clean, containment NORMAL, health halted/armed, queue still paused.

**Timing coincidence — stated as coincidence, not causation.** The last recorded pass (2026-11-04T20:56:59.071Z) falls inside the log's onset bracket for the second 1101 fault (after the last good read at 2026-11-04T17:21:41Z; at or before the first failing read at 2026-11-04T23:20:36Z). The fault's read-surface failures were observed at +48h; the reads had recovered by +54h (2026-11-05T05:20:53Z); delivery did not resume. This record presents those facts in their temporal order only.

**What is NOT claimed:**

- **No claim that the 1101 fault caused the delivery stop.** The root cause of both 1101 faults (2026-11-01 and 2026-11-04) remains **UNCONFIRMED** — the same strength at which Rowan's earlier disposition left the Nov 1 fault — and no evidence in the window log connects the fault to the alarm-delivery stop.
- **No claim about the standing registration's future in either direction.** This record does not claim the registration will fire late, and does not claim it will never fire. Post-retry-exhaustion `getAlarm()` semantics are **UNSPECIFIED** in the accepted alarm-semantics record, so neither direction is licensed by the evidence.
- **No claim about the unobserved interval beyond what the recorder retrospectively shows.** Passes 245–296 ran inside the unobserved interval, through 2026-11-04T20:56:59.071Z (per the +54h entry's retrospective read); the interval itself was unobserved while it ran, and this record does not upgrade it to a verified interval.
- **The W-4 is not a trigger and was never treated as one.** No S1-X act, no stimulus, and no command followed from any W-4 classification — observation and escalation only, exactly as the design provides. The W-4 remains **UNRESOLVED until Rowan dispositions it**.

## 7. S1-X / Layer-1 accounting

- **S1-X (Part C): never fired.** No **FIRING DECISION** entry exists anywhere in the window log. No verified T1–T4 trigger was ever recorded at any completed check in the window: no out-of-set grant activity (T1), no dispatch while halted (T2 — dispatched was 0 at every read of the window), no phase/quota movement beyond the §7.3 predictions (T3 — the only quota figures beyond baseline are the in-set reserved/consumed 12 of the churn, and the PT-day calendar roll expressly recorded as not-a-movement), and no second/concurrent/foreign grant, second plan/job movement, or conflicts/watermark/parked movement (T4). At the one check where trigger conditions were unverifiable (+48h, FAILED), the log records the governing rule and follows it: an unverified trigger never fires S1-X; no FIRING DECISION was recorded.
- **Layer-1 (Part B2): never applied.** No `contain_drive` application is recorded anywhere in the window log.
- **Containment transitions in the window: none.** The containment state read NORMAL / absent / verified at open and at every completed check through close; the stop-record fields were empty throughout (at close: `stopStatus` null, `stopVerifiedAt` null, `stopVerifyAction` null, `stopArmedBefore` null, `stopArmedAfter` null, `stopVerifyAttempts` 0, `stopEpisodeId` null, `stopEpisodeExhausted` false, `prevEpisodeId`/`prevEpisodeAttempts`/`prevEpisodeExhausted`/`prevEpisodeClosedAt` all null).
- **Mutation tally attributable to the watch jobs: ZERO production mutations** — observation only. The watch jobs' only non-read acts were scheduler lifecycle acts inside Part B itself: the +12h handoff (enable the 6-hourly job, disable the hourly job) and the closing self-disable.
- **The only production command sent in the window was the Grant 2 stimulus itself** (§5), sent once by Wren in session under Julie's separate GO — not by a watch job.

## 8. Ends-HELD values at close

From the closing census (reads 2026-11-05T23:21:06Z–23:21:18Z), as logged:

- Generation **halted on both surfaces**: health `generation` `"halted"`; capabilities `generationState` `"halted"`, standard admitted, Batch `batch_not_armed`.
- Queue `opalreader-generation-v2`: `delivery_paused` **true**, exactly **1 consumer** (`f260f2188d80426bb0588685e9d084eb`).
- Containment: **NORMAL** / `absent: true` / `verified: true` / `stopConfidence` `"not_applicable"` on both surfaces; stop-record fields all empty (§7).
- Build **`fdb02395b3775dc945baa395591a73060ab146c4`**; coordinator `armed`.
- **$0 spent across the window; dispatched 0 throughout.**
- Phase frozen at close on both surfaces: settled 1029420 / estimatedUnverified 19018 / reservedUnverified 5648 / inFlightUpper 0 / unknownOpen 0 / remaining 12464932 (`provider_unverified`).
- Quota at close: reconcile `ok` true, drift [], sole straddler; PT day 2026-11-05 dispatched 0 / reserved 0 (calendar roll at 07:00Z), with PT day 2026-11-04's dispatched 0 / reserved 12 / consumed 12 preserved in `dayTotals`.
- Plan `plan:19cad189fab54b9c804a74a6` still `active` {eligible 1, done 0, failed 0, blocked 0}; job `generating` revision 88; the single occurrence `granted`; live grant `seg:87:full`.
- Conflicts exactly the 4 pinned `schedule_dead` rows (ids 1–4); bindings watermark 1841, 0 changes since 1841; content watermark 18 (window baseline, unchanged at every check that read it).

## 9. Post-window ownership

The window's expiry changes the regime, never the ownership. The state is carried under **§3.7 branch (1): REVIVED-UNSTOPPED / OWNED**, with the closing W-4 noted on the face of the regime: the chain revived under the holds and was never stopped by any act; it is currently not delivering, for the reasons and at the strength stated in §6, and the W-4 stands UNRESOLVED pending Rowan's disposition.

- **Tail watch:** `phaseb-s1-tail-watch`, created **2026-11-05** by Wren in session — a daily read-only check at approximately **18:28 ET**, appending to the tail log `~/workspace/goals/opal-roundtable/hidden_files/phaseb-s1-tail-log.md`. (The window log itself is closed; the closing entry records both window jobs disabled — the hourly job at the +12h handoff, the 6-hourly job by its own closing act.)
- **Tail exits** on the first of: C3 execution; a Rowan supersession; or the **14-day tail point, 2026-11-19T23:28:41Z**.
- C3 remains the standing stop vehicle. It does not execute on this record: it requires an eligible S1 disposition supported by this record, Rowan's review of that disposition, Julie's separate explicit C3 GO, and a fresh matching execution census.

## 10. Questions for Rowan — requests for ruling

**(a) Disposition of the S1 event.** The window's event classification is **W-2 EXPECTED S1 EVENT** (first classified in observation set 1, 2026-11-03T23:26:32Z; continuing through the +42h check), on the evidence at §5: the Grant 2 stimulus was refused as designed, a drive pass followed ~1.9 s later, exactly one grant issued inside the §7.3 set, and the chain churned in-set thereafter. *Please rule: accept the W-2 classification and the S1 event disposition as recorded, or correct it.*

**(b) Disposition of the W-4.** The closing classification is **W-4 WAKE OBSERVED, DELIVERY NOT OBSERVED (continuing), UNRESOLVED** (§6), and a W-4 unresolved is a listed blocker in §4.5 of the C3 package. The facts put to you are these: the chain revived on the stimulus and churned in-set from the first pass (2026-11-03T23:26:14.899Z) to the last (2026-11-04T20:56:59.071Z) — 21h30m44s of recorded delivery, 296 passes, 87 sequential grants, $0, no dispatch — and then stopped, temporally coincident with the second 1101 platform fault, whose root cause remains UNCONFIRMED; the standing registration has since stood past due to 26h14m37s at close with no delivery, and no read surface explains the stop. *Please rule: what disposition do you give the W-4 on this record?*

**(c) The C3 branch consequence.** The rebased C3 package's branch **(a) EXPECTED-REVIVED** was written for a live revived chain, under which `armedAt` is a consistency expectation (identical across paired reads; null = STOP). The chain this window leaves behind is revived-but-not-delivering, under a standing past-due registration, inside the post-window regime of §3.7 branch (1). *Please rule: does C3 proceed under branch (a) on a fresh execution census, does it move to branch **(d) REVIVED-UNSTOPPED (POST-WINDOW)** on tail-log baselines, or does the W-4 require another vehicle first (e.g. R3-V, or a fresh ruling) before any C3 branch opens?*

**(d) The generation-resume package.** The resume package stands pre-drafted at pin `0946f9f2fb978a46b562c738d8ac6d9d4ee977a6`, its dependency leg 1 being an eligible S1 disposition plus your review of this window record. *Please rule: should the resume package now be read, and what is your ruling on its **OQ-1** — the wake mechanism after a C3 stop and a restoration `clear` — in light of the W-4 evidence (§6), which now includes a registration that has stood past due for more than a day on a chain that demonstrably revived and delivered when woken?*

## 11. What this record does NOT do

This filing is a record for disposition review. It authorizes nothing and requests no execution: **no C3 execution, no restoration, no generation, no containment transition, no queue or hold change, no deployment** is authorized or requested by the filing itself. C3 still requires Julie's separate explicit GO and a fresh, matching execution census after Rowan's disposition. Production remains HELD exactly as at window close (§8).

## 12. Source index

- **Window log (source of truth for every value above):** `~/workspace/goals/opal-roundtable/hidden_files/phaseb-s1-window-log.md` — LOG OPENED, SMOKE (pre-window, excluded), WINDOW OPEN, hourly checks +0h51m…+12h51m, HANDOFF, 6-hourly checks +11h51m…+65h51m, STIMULUS, OBSERVATION sets 1–4, WINDOW-CLOSE census.
- **Grant 1 GO** (Julie; window authorization, Parts A+B+C): Roundtable board, repo `jedavid33-design/opal-roundtable`, issue #15, comment **6590949982** — also cited in the window log's own header.
- **Grant 2 GO** (Julie; the fallback stimulus): issue #15, comment **6618087797** (RT-H-20261103-7c2e91) — cited in the log's STIMULUS entry as recorded on the board before the send and read back byte-identical.
- **Grant 2 execution summary** (board filing): issue #15, comment **6618430488**.
- **Operative window package:** REVISED-2 pin `11a296e79f0963fc005a23edd3e2a9dffbf012fd` + RM-1-c pin `f374ee740eb871b6799518935b15aa5dfd8f9dfa`.
- **C3 operative package:** pins `46112a03…` + `aba681a0…` (the §4.5 blocker list cited at §10(b) is that package's).
- **Generation-resume package:** pin `0946f9f2fb978a46b562c738d8ac6d9d4ee977a6` (OQ-1 is that package's).
- Grant 1 execution evidence (D2 read-back values behind the WINDOW-OPEN entry): `~/workspace/ch2-program/ch3-recovery/grant1-execution/evidence/` (suffix `d2`), as cited in the WINDOW-OPEN entry.
- Tail log (post-window, §9): `~/workspace/goals/opal-roundtable/hidden_files/phaseb-s1-tail-log.md`.

— End of record. Production hold stands. Your turn, Rowan — when Julie pokes you.
