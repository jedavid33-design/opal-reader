# PHASE B — STANDALONE RESTORATION: EXECUTION RECORD

**Gate:** standalone restoration — the return of containment from
`CHAIN_STOPPED` to `NORMAL` by exactly one reasoned `clear`, closing
stop episode 3.
**Execution window:** 2026-11-06 — Julie's GO recorded on the board
before the census (board comment 6675499312, 2026-11-05 ~9:47 p.m. ET);
R-0 confirmation census 02:48:22Z–02:49:00Z; the single `clear`
dispatched 02:49:15Z and committed at `updatedAt` 1793933356719
(02:49:16.719Z); closing confirmation 02:49:28Z–02:49:36Z (all other
times UTC; 2026-11-05 evening, America/New_York).
**Result:** **RESTORATION EXECUTED — the single `clear` applied
first-send, exactly as the one-act ledger prescribed; the system ends
HELD in NORMAL with no alarm registration standing.** Every condition
of Rowan's readiness ruling (PASS WITH CONDITIONS) was discharged as
specified in §1. Closure of the gate awaits Rowan's documentary
execution review of this record.
**Spend:** $0.
**Raw evidence:** `~/workspace/ch2-program/ch3-recovery/restoration-execution/`
— opening confirmation reads `r01`–`r16b` (the §3 read set; read 6, the
script etag, is a header-only read with no body file — see note E-1),
the sent body `r1-body.json`, the act response `s1.json`, and the
closing confirmation reads `t01`–`t16b`. Every value in this record is
taken from those files; §8 indexes them. This record's own pin is
carried in the companion CP's `<RESTORE-EXEC-PIN>` slot (a record
cannot name its own commit).

---

## 1. Authority chain

The gate executed under the following chain, in order. No link was
skipped, and Julie's GO was recorded on the board **before** the
confirmation census opened — the ordering the GO wording itself
requires.

| # | Link | Reference |
|---|---|---|
| 1 | Containment design v4 REVISED — restoration policy (§6), episode law (§4.2), truth model (§2.3) | `PHASEB-CONTAINMENT-DESIGN-V4-REVISED.md` |
| 2 | Recovery gates v4 REVISED — "Standalone restoration authorization (NOT a gate; decision 2)" | `PHASEB-RECOVERY-GATES-V4-REVISED.md` |
| 3 | Gate C3 execution record (the episode this gate closes) | `PHASEB-C3-EXECUTION-RECORD.md`, pin `b4727c408f6c446a94466594ea2cc7c59d11de8d` |
| 4 | Rowan ruling on the C3 execution record, §A — C3 EXECUTED AND CLOSED at PARTIAL strength; restoration prerequisites stated (fresh closing-state confirmation; historical audit review covering episode 3, all four transitions, and the rejected C3-1 request); **no restoration authorized** | `ROWAN-C3-EXECUTION-OQ36-RULING.md` |
| 5 | Standalone restoration readiness package (operative §3 confirmation set + expectations; §4 ledger; §4.2 reason; §4.3 expected post-clear state) | `PHASEB-RESTORATION-READINESS-PACKAGE.md`, pin `e6359a2183d431b3598c83f11c60d61cd29d13fd` |
| 6 | **Rowan ruling: restoration readiness PASS WITH CONDITIONS** — Q-1 confirmation = execution census as one preflight act ACCEPT; Q-2 audit reconciliation ACCEPT AT DOCUMENTARY STRENGTH, qualification to be preserved in the execution record; Q-3 §4.2 reason ACCEPT verbatim; Q-4 single-act rule ACCEPT (exactly one `clear` request, no corrected re-send in any failure branch) | `ROWAN-RESTORATION-RESUME-CORR2-RULING.md` |
| 7 | **Julie's GO**, in the package's §6 wording exactly as presented, given by button tap in the Coding Projects chat 2026-11-05 ~9:47 p.m. ET and **recorded on the board before the census** | Board comment **6675499312**, opal-roundtable issue #15 |
| 8 | R-0 confirmation census opened | 2026-11-06T02:48:22Z (first evidence file, `r01`) — after link 7 |

The GO's scope, as given: the §3 fresh closing-state confirmation
census against the §2 historical audit review; then exactly one
`clear` of CHAIN_STOPPED with the §4.2 recorded reason; read-backs
only; no re-send in any failure branch; ending HELD in NORMAL with
the registration still absent. The GO expressly records Julie's
understanding that restoration does not re-arm anything, does not
lift GENERATION_HALT or the queue pause, does not touch the preserved
plan or the idx-26 exemption, and does not authorize the
generation-resume gate or any generation.

Production state entering the gate: build `fdb02395…` live;
containment `CHAIN_STOPPED`, stop verified (episode 3); no alarm
registration; GENERATION_HALT `"1"`; queue
`opalreader-generation-v2` delivery paused; the Phase B plan
`plan:19cad189fab54b9c804a74a6` and the idx-26 chapter exemption
preserved, untouched by this gate.

### 1.1 The ruling's conditions, and how each was discharged

| Condition (ruling §A) | Discharged |
|---|---|
| Julie's separate explicit GO | Link 7 — given in the pinned §6 wording, recorded on the board (comment 6675499312) before the census |
| The complete fresh matching census | §2 — the §3 read set run fresh in the execution session, immediately before the act (Q-1); every expectation matched; no deviation arose |
| Historical audit disclosure | §1.2 — the readiness package §2 review carried into this record at documentary strength (Q-2) |
| Exact one-act ledger | §3 — exactly one `clear` request sent, once; no rejection, no re-send, no second act of any kind (Q-4) |
| Read-back verification | §4 — both containment surfaces read back NORMAL and field-agreeing, with `stopConfidence "not_applicable"` on both |
| Closing census proving NORMAL, registration null, both holds standing, no unauthorized changes | §4 — NORMAL on both surfaces; `armedAt` null; GENERATION_HALT `"1"` and queue `delivery_paused: true` re-read at closing; the only delta anywhere is the ledger's own (§4.2) |
| Q-3: the reason preserved verbatim in the authorization and the audit event | §3.1 — the sent body's reason is byte-identical to the package §4.2 text (verified programmatically against `r1-body.json`); it is recorded in the act's audit events at the accounting strength of §5 |

### 1.2 Historical audit disclosure (Q-2 — documentary strength, preserved)

Per Q-2, the historical audit reconciliation is carried here at the
strength Rowan accepted. In her words (ruling §A, Q-2): the
reconciliation rests on "transition responses, state fields,
timestamps, and episode arithmetic. It accounts for episode 3, four
reported transitions, and the rejected C3-1 request. **It is not a
direct enumeration of audit-table rows.**" That qualification is
preserved in this record: no audit surface is invented, and no
stronger verification is claimed anywhere below — including for this
gate's own two audit rows (§5).

The history as reconciled (readiness package §2, performed
documentarily and re-confirmed against the fresh surfaces at R-0):

- **Episode 3 is the only episode the history contains.** It was
  opened by the `stop_chain:applied` audit row 3 on
  2026-11-06T02:24:06Z, verified at attempt 1 of a bound of 3
  (`stopVerifyAttempts 1`, the stop act itself; no
  `verify_chain_stop` was ever called), and was **not exhausted**
  (`stopEpisodeExhausted: false`). No episode 1 or 2 exists — the id
  3 is the audit-row id of the stop commit, not an episode counter —
  and no episode had ever closed before this gate (all `prevEpisode*`
  fields read null at C3 closing and again at R-0, §2). The design
  §6 R3-V naming requirement therefore did not arise.
- **The four reported transitions** (all carrying
  `authorizationRef` "Gate C3 branch (d) — Julie GO, board comment
  6675116603"): audit row 1 `contain_drive:applied`
  (2026-11-06T02:23:44Z, NORMAL → DRIVE_CONTAINED, `updatedAt
  1793931825315`); row 2 `clear:applied` (2026-11-06T02:23:53Z,
  DRIVE_CONTAINED → NORMAL, `updatedAt 1793931834501`, reason recorded
  "Gate C3 mechanics leg: restore opening state" — a mechanics-leg
  reversal inside C3, **not** a restoration; no episode event, as no
  stop episode was open); row 3 `stop_chain:applied`
  (2026-11-06T02:24:06Z, NORMAL → CHAIN_STOPPED, minting episode 3);
  row 4 `stop_chain_verify:verified` (inside the same act: observed
  `stopArmedBefore 1793826389431`, `deleteAlarm()` ×1, read-back null
  → `stopArmedAfter null`, `stopStatus "verified"`, `stopVerifiedAt
  1793931847431`).
- **The rejected C3-1 request is part of the historical record.** The
  first C3-1 send (2026-11-06T02:23:12Z, body `{action:
  "contain_drive"}` in the operative ledger's abbreviated notation)
  was rejected pre-act, HTTP 200 `{"outcome":"rejected","reason":
  "authorization_ref_required"}`, writing nothing. Rowan accepted its
  classification (a pre-act request-form rejection, not a state
  mutation or intervening drive movement). It is **not an audit
  row** — route validation refused it before any store touch. The
  corrected re-send (02:23:44Z) applied as audit row 1. Both sends
  remain in the history; neither is edited out.
- **Reconciliation statement (package §2.6):** the audit history, as
  it can be read, is COMPLETE and CONSISTENT; no inconsistency was
  found. The containment state row did not exist before C3-1; every
  containment-route act since creation is one of the acts enumerated
  above. The R-0 confirmation (§2) re-read the state row before this
  gate's act and found every episode fact exactly as this review
  states — the review was falsifiable at execution, and it was not
  falsified.
- **Forward accounting:** this gate's `clear` appends audit row 5
  (`clear:applied`, detail carrying the §4.2 reason) and audit row 6
  (`stop_episode_closed`, outcome `closed`, detail carrying
  `{episodeId: 3, attempts: 1, exhausted: false, finalStopStatus:
  "verified", reason}`) inside its single commit transaction — stated
  here, as in the package (assumption A-2), at documentary accounting
  strength: the row ids follow from the reconciled count of 4 and the
  deployed source's clear path; the read surfaces expose the summary
  fields, not row ids (§5).

---

## 2. R-0 — Fresh closing-state confirmation (the preflight census)

Per Q-1, the ruling's fresh read-only closing-state confirmation and
the gate's execution census are **one act**: the readiness package §3
read set, run in the execution session immediately before the act,
every expectation verified from fresh reads. The set ran
2026-11-06T02:48:22Z–02:49:00Z (evidence file timestamps; the reads'
own `asOf` stamps agree — e.g. `r02` at 02:48:23.274Z). The act
followed 15 seconds after the last opening read. No value was
inherited from the C3 record as fact; every expected value below was
the C3 closing value stated as an expectation, re-read fresh.

**Result: every §3.3 expectation matched exactly. No deviation arose;
the STOP rule was never engaged. The gate proceeded to R-1 on this
confirmation.**

| # (§3.1) | Item | Expected | Read (evidence) | ✓ |
|---|---|---|---|---|
| 1 | Containment, surface 1 (`GET /v2/d6-containment`, operator) | `CHAIN_STOPPED`; stop record exact (below); `stopConfidence "verified_current"` | `r01`: state `CHAIN_STOPPED`, `known true`, `absent false`, `verified true`, `updatedAt 1793931847431`, `authorizationRef` "Gate C3 branch (d) — Julie GO, board comment 6675116603"; `stopStatus "verified"`, `stopVerifiedAt 1793931847431`, `stopVerifyAction "stop_chain"`, `stopArmedBefore 1793826389431`, `stopArmedAfter null`, `stopVerifyAttempts 1`, `stopEpisodeId 3`, `stopEpisodeExhausted false`; all four `prevEpisode*` fields null; `stopConfidence "verified_current"` | ✓ |
| 2 | Containment, surface 2 (`GET /v2/d6-diagnostics?drive=1`, operator) + alarm + recorder | Surface agreement with read 1; `armedAt null`; recorder latest 296, failures 0 | `r02`: containment projection **identical to `r01` in every shared field** (projection-shape note E-4); alarm block `armedAt null`, `pendingSchedule 2`, `pendingWatchdog 1`; recorder `tableState "populated"`, the 50-row descending window ids **296 → 247**, all stage `complete`, latest row id 296 @ `1793825819071`; `recorderHealth`: `recordingFailures 0`, `lastRecordedAt 1793825819071` | ✓ |
| 3 | Phase B plan diagnostics (`GET /v2/d6-diagnostics?planId=…`, operator) | plan `active`; phase accounting (surface b) as item 8 | `r03`: `found true`, plan `plan:19cad189fab54b9c804a74a6` `active`, `phase "forever-pucked"`, bookId `5c589095-f812-48a2-8ab2-03ba2791f2b2`; phase accounting per item 8 | ✓ |
| 4 | Health | build `fdb02395b3775dc945baa395591a73060ab146c4`; generation `halted`; coordinator `armed` | `r04`: build `fdb02395b3775dc945baa395591a73060ab146c4`, `"generation":"halted"`, `"coordinator":"armed"`, scope `production` | ✓ |
| 5 | Script settings (cf-api) | 10 bindings; GENERATION_HALT `"1"`; `OPALREADER_PHASE_POLICY "enforce"`; observability enabled + logs persisted; `compatibility_date 2026-08-29` + `nodejs_compat` | `r05`: exactly 10 bindings — `ALLOWED_ORIGIN`, `COORDINATOR`, `GEMINI_API_KEY`, `GENERATION_HALT` (plain_text `"1"`), `OPALREADER_ACCESS_TOKEN`, `OPALREADER_GENERATION_V2`, `OPALREADER_MIGRATION_OPERATOR_TOKEN`, `OPALREADER_PHASE_POLICY` (plain_text `"enforce"`), `OPALREADER_STORAGE`, `OPALREADER_V2_SCOPE`; observability `enabled: true`, logs `enabled: true`, `persist: true`; `compatibility_date "2026-08-29"`, `compatibility_flags ["nodejs_compat"]` | ✓ |
| 6 | Script etag (§3.2 in-process surrogate GET, response header) | `bb90f18223e1802e1c417f17359f344499dc2d29c78e54db259f6f9ae4ac5c9e` | Read by the §3.2 method (header, quotes stripped): `bb90f18223e1802e1c417f17359f344499dc2d29c78e54db259f6f9ae4ac5c9e` — the Grant 1 build's etag, matching. **Evidence strength: see note E-1** | ✓ (see E-1) |
| 7 | Queue (cf-api) | `delivery_paused: true`; exactly 1 consumer `f260f2188d80426bb0588685e9d084eb`; retention 86,400 s | `r07`: queue `93b6a35fb8cf4788a91a2c90b748ae66` (`opalreader-generation-v2`), `delivery_paused: true`, `message_retention_period 86400`, `consumers_total_count 1`, consumer `f260f2188d80426bb0588685e9d084eb` (script `opalreader-api-v2-prod`) | ✓ |
| 8 | Phase accounting — BOTH surfaces (reads 8 and 3) | settled **1,029,420**; estimatedUnverified **19,018**; reservedUnverified **5,648**; inFlightUpper **0**; unknownOpen **0**; remaining **12,464,932** of 13,500,000; `provider_unverified` | Surface (a) capabilities (`r08`, `asOf 1793933304962`) and surface (b) plan diagnostics (`r03`): **every shared field equal** — settled 1029420, estimatedUnverified 19018, reservedUnverified 5648, inFlightUpper 0, remaining 12464932, budget 13500000. The projections carry different field sets, stated exactly: the capabilities phase object carries `bookId` and omits `settledBasis` / `unknownOpen` / `unverifiedStatus`; the diagnostics object carries those three (`settledBasis "recorded_known_existing_ledger"`, `unknownOpen 0`, `unverifiedStatus "provider_unverified"`) and omits `bookId`. The comparison is on the shared fields, per the C2 lesson | ✓ |
| 9 | Capabilities (client) | Standard admitted; Batch `batch_not_armed`; registry `forever-pucked` ↔ `5c589095-f812-48a2-8ab2-03ba2791f2b2` | `r08`: `generationState "halted"`; lanes standard `admitted: true`, batch `admitted: false`, reason `"batch_not_armed"`; phase registry `forever-pucked` ↔ bookId `5c589095-f812-48a2-8ab2-03ba2791f2b2` | ✓ |
| 10 | Preserved plan (client) | `plan:19cad189fab54b9c804a74a6` `active` {1,0,0,0}; sole entry `granted`; quarantine `held: false` | `r09`: `active`, `stopReason null`; totals eligible 1 / done 0 / failed 0 / blocked 0 (the totals object additionally carries a `prompts: 0` field — note E-4); sole entry occurrence `2a85f74f-353d-4c25-a86a-4a4db392868b`, chapterIndex 2, 569 chars, `occurrenceState "granted"`; quarantine `held: false` | ✓ |
| 11 | Phase B job (client) | `generating` rev **88**; 86 voided + exactly one issued (`seg:87:full`) | `r10`: job `plan:19cad189fab54b9c804a74a6:seg` `generating`, revision **88**; 87 grants — 86 `voided` (seg:1–86) and exactly one live: `grant:plan:19cad189fab54b9c804a74a6:seg:87:full`, state `issued`, its revision 88; the single occurrence `granted` | ✓ |
| 12 | Parked Ch 3 job (client) | `parked_policy` rev 1; grants `[]` | `r11`: job `1832c21fcf0425454227c4736048a8a632f422abca4a2685ddb775bb1681406a` `parked_policy`, revision **1**, grants `[]`; 27 occurrences as read — 24 `pending`, 3 `ready`. **Fingerprint: not byte-compared — C3 note E-5's narrowed strength carries (see E-5)** | ✓ (see E-5) |
| 13 | Quota reconcile (operator) | `ok: true`, armed, drift empty, sole exception the adjudicated straddler; dispatched 0 for every PT day after 2026-11-01 | `r12`: `"ok": true`, `"armed": true`, `drift []`, `driftCount 0`, `exceptionCount 1` — the sole exception `att-37d63768-db4b-447d-8150-580b7c6ee257` (`estimated_unverified`); dayTotals dispatched 2026-10-29 = 57, 10-30 = 79, 10-31 = 44, 11-01 = 76, 11-03 = 0, 11-04 = 0, current day 2026-11-05 dispatched 0 / reserved 0 / consumed 0 (2026-11-04 carries reserved 12 / consumed 12 — the standing grant's derived reservation accounting on the rolled PT day, exactly as at C3) | ✓ |
| 14 | Quota (client) | settings revision **1**; attempts today 0; provider dispatches today 0 | `r13`: `settingsRevision 1`, `attemptsToday 0`, `providerDispatchesToday 0`, dayKey `2026-11-05` | ✓ |
| 15 | Conflicts (client) | exactly the 4 baseline `schedule_dead` lease rows (ids 1–4) | `r14`: exactly 4 rows (returned in descending id order 4 → 1), all `cache_key "lease"`, `expected "7"`, `found "LIKE or GLOB pattern too complex: SQLITE_ERROR"`, `reason "schedule_dead"` — id 1 @ 1793318054808 `grant:plan:3183ecbf2ac4bf50bbc6166e:seg:1:full`; id 2 @ 1793319854632 `grant:plan:603ab416bd67ab1b25de97be:ch1:1:full`; id 3 @ 1793423664089 `grant:plan:b2dc2a3d1cd367a0245b9102:ch1:1:full`; id 4 @ 1793495070364 `grant:plan:e377a5559961b294154276b6:ch2:1:full` — the pinned baseline, exact in every field | ✓ |
| 16 | Watermarks (client) | content **18**, bindings **1841**, zero changes on both | `r15a`: content `highWatermark 18`, changes []; `r15b`: bindings `highWatermark 1841`, changes []; idx 26 remains unbound (its plan entry carries no binding; the bindings watermark is unmoved) | ✓ |
| 17 | Eligibility (client, both scopes) | digest `cdef2c7ec7bb8434b4e2fac66af49983ac7fa4b4e65bb0eda40354be51ff52d1` on both scopes | `r16a` (chapter, chapterIndex 2): digest `cdef2c7e…` (full value as expected), eligibleCount 1, totalChars 569, expectedCost 8022, exclusions `bound_already 26`; `r16b` (book): the identical digest, eligibleCount 315, totalChars 414,619, expectedCost 5,845,190, exclusions `bound_already 92` | ✓ |

**Confirmation notes — projection shapes and evidence strength, stated
honestly.** None of these is a deviation: every value read matched its
expectation. They record exactly what the evidence set does and does
not contain, so Rowan's review sees the set as it is.

- **E-1 (read 6, script etag — the C3 E-1 gap, closed in method, thin
  in artifact).** The §3.2 read was performed as specified — an
  in-process GET via the connector's `dynamic_credentials` surrogate
  mechanism, etag taken from the response header, quotes stripped —
  at R-0 and again at closing (§4), returning
  `bb90f18223e1802e1c417f17359f344499dc2d29c78e54db259f6f9ae4ac5c9e`
  both times. **No raw evidence file for this read exists in
  `restoration-execution/`** (there is no `r06`/`t06` file: the read
  yields a header, not a body, and no header dump was saved). The etag
  value in this record therefore stands at executor-assertion
  strength, corroborated by (i) the `/health` build marker
  `fdb02395…` read in-set on both passes, (ii) the settings surface
  read in-set, and (iii) the value being the Grant 1 build's etag as
  established in earlier gates' records. The method gap C3's E-1
  named is closed; the artifact gap is disclosed, not papered over.
- **E-2 (parked-job fingerprint).** As at C3 (its note E-5): the
  parked job's stored fingerprint string is **not exposed on the read
  surfaces used**, and no fingerprint byte-compare was performed. The
  confirmation verified the job's state (`parked_policy`), revision
  (1), empty grants, and its full occurrence composition as read.
- **E-3 (audit history at confirmation).** The §1.2 review's
  falsifiability check (§2.5 of the package) rested on the state row
  re-read at R-0 (episode 3, attempts 1, not exhausted, `prevEpisode*`
  all null) — the audit table itself has no separate read surface in
  the read set, at confirmation or at closing (§5 carries the same
  note for this gate's own audit rows).
- **E-4 (projection shapes).** Three shape facts, none substantive:
  (i) `r01`'s containment response nests the alarm block inside the
  containment object, while `r02`'s drive projection omits the alarm
  key from its containment sub-object and carries the alarm block as a
  top-level sibling — the containment fields are identical on the
  shared field set, and the alarm values are equal on both files;
  (ii) the phase-accounting projections' field sets differ as item 8
  states (the comparison is on shared fields); (iii) the plan totals
  object (item 10) carries a fifth field, `prompts: 0`, alongside the
  four §3.3 figures; the conflicts read (item 15) returns its rows in
  descending id order. The recorder read (item 2) is a 50-row
  descending window (ids 296 → 247), not a full-table dump: "latest
  pass 296, no row after 296" is established by the window's head, the
  row count the window implies against the established total, and
  `recorderHealth.lastRecordedAt 1793825819071` corroborating.

**Movement check across the confirmation:** none. Recorder latest row
296 with no successor; `armedAt` null on both containment reads; job
revision 88; the single live grant at seg:87; phase figures frozen;
conflicts, watermarks, quota all at baseline. The gate proceeded to
R-1 on this confirmation, in the same session, as Q-1 requires.

---

## 3. R-1 — The single `clear` (the gate's only act)

Exactly one state-changing act exists in this gate, and exactly one
request was sent. No command, report, SubmitJob, wake provocation, or
stimulus of any kind was sent at any point.

### 3.1 The request

**Dispatched 2026-11-06T02:49:15Z** (evidence `r1-body.json`, file
stamp 02:49:15.607Z) to the operator containment route on the live
composed build:

```json
{"action":"clear","authorizationRef":"Standalone restoration — Julie GO, board comment 6675499312","reason":"Standalone restoration of containment after Gate C3 (branch (d)), executed and closed with the stop verified (episode 3, verified at attempt 1; Rowan documentary review PASS AT PARTIAL STRENGTH). The stop's purpose is complete: the standing W-4 registration is deleted and read back null, no drive pass has occurred since pass 296, and the chain stands frozen under a verified stop record. CHAIN_STOPPED is no longer needed: the generation-resume gate requires NORMAL as its opening state and carries its own separately ruled wake. This clear returns containment to NORMAL only — it re-arms nothing (no alarm registration stands after it), lifts no hold (GENERATION_HALT remains \"1\"; the generation queue remains paused), and authorizes no generation."}
```

- The `authorizationRef` is the package §4.1 form, with the GO comment
  id filled from the board record of Julie's GO (link 7).
- The `reason` is the package §4.2 text **verbatim** — 751 characters,
  inside the route's 2,000-character bound — verified byte-identical
  against §4.2 programmatically after drafting this record (Q-3). The
  executor did not edit it at send time.

### 3.2 The response

**Response** (evidence `s1.json`; envelope HTTP 200):

```json
{"outcome":"applied","action":"clear","state":"NORMAL","idempotent":false,"stopVerified":null}
```

— the package §4.3 expected response exactly, including
`idempotent: false` (the §4.5 idempotent-applied trap did not arise).
The response's `stateRead` (the post-clear state as the act returned
it), field by field against §4.3's expectations:

| Field | Expected (§4.3) | `s1` stateRead | ✓ |
|---|---|---|---|
| `state` | `NORMAL` | `NORMAL` | ✓ |
| `known` / `absent` / `verified` | `true` / `false` / `true` | `true` / `false` / `true` — the row persists, as designed | ✓ |
| `updatedAt` | the clear's timestamp | **1793933356719** (2026-11-06T02:49:16.719Z) | ✓ |
| `authorizationRef` | the §4.1 restoration ref | "Standalone restoration — Julie GO, board comment 6675499312" | ✓ |
| `stopStatus` | `null` | `null` | ✓ |
| `stopVerifiedAt` | `null` | `null` | ✓ |
| `stopVerifyAction` | `null` | `null` | ✓ |
| `stopArmedBefore` | `null` | `null` | ✓ |
| `stopArmedAfter` | `null` | `null` | ✓ |
| `stopVerifyAttempts` | `0` | `0` | ✓ |
| `stopEpisodeId` | `null` | `null` — episode 3 is closed, not current | ✓ |
| `stopEpisodeExhausted` | `false` | `false` | ✓ |
| `prevEpisodeId` | **3** | **3** | ✓ |
| `prevEpisodeAttempts` | **1** | **1** | ✓ |
| `prevEpisodeExhausted` | **false** | **false** | ✓ |
| `prevEpisodeClosedAt` | the clear's timestamp | **1793933356719** — bit-equal to `updatedAt` in the event (the package did not assert bit-equality; it is observed here) | ✓ |

One shape note, stated plainly: the POST response's `stateRead` does
**not** carry `stopConfidence` or an alarm block (it carries an
`errorName: null` field instead). The §4.3 `stopConfidence
"not_applicable"` expectation is therefore discharged not by `s1` but
by the R-2 read-backs (§4.1), where both surfaces carry it. Nothing in
`s1` contradicts §4.3; the field simply is not on this projection.

### 3.3 The one-act ledger ran clean (Q-4)

**The `clear` was sent exactly once.** There was no rejection, no
ambiguous or lost response, no §R re-entry, and **no re-send of any
kind** — the Q-4 rule (no corrected re-send, including after a
request-form rejection) was never engaged because no failure branch
arose. The contrast with C3 is recorded for the history's
completeness, not hidden: C3's ledger contained one pre-act
request-form rejection (zero writes) followed by a corrected re-send
inside that gate's multi-step framing; this gate's stricter
single-act ledger ran without any such event. The §4.1
`authorizationRef` and §4.2 reason were in the body from the first
and only send, in the forms the readiness package prescribed.

---

## 4. R-2 / R-3 — Read-backs and closing confirmation

### 4.1 Read-backs and the closing set

The closing confirmation ran 2026-11-06T02:49:28Z–02:49:36Z as one
continuous read series (`t01`–`t16b`), its first two reads being the
R-2 pair (both containment surfaces) and the remainder the R-3 full
§3 set repeated. (Evidence-shape note: the set contains this single
closing series, not two separately captured passes; `t01`/`t02` lead
it and discharge R-2, and the full series discharges R-3.)

- **Containment, both surfaces:** `NORMAL`, `known true`, `absent
  false`, `verified true`, `updatedAt 1793933356719`, the restoration
  `authorizationRef`, and every post-clear field exactly as in §3.2's
  table — `t01` (containment route) and `t02`'s containment
  projection **agreeing in every shared field**, and **`stopConfidence
  "not_applicable"` on both surfaces** — §4.3's expectation, and
  package assumption A-4 confirmed by observation.
- **Alarm block (both closing files):** `armedAt null`,
  `pendingSchedule 2`, `pendingWatchdog 1` — the clear touched no
  alarm API, no registration stands, and the schedule rows are
  preserved.
- **Recorder:** the 50-row window is **content-identical** to the
  opening window (`t02`'s `drivePasses` equals `r02`'s exactly);
  latest row still 296 @ 1793825819071; `recordingFailures 0`. No pass
  was provoked by the clear; no row is timestamped at or after the
  act.
- **Script etag (closing re-read, §3.2 method):** identical to the
  opening read — `bb90f18223e1802e1c417f17359f344499dc2d29c78e54db259f6f9ae4ac5c9e`
  (same evidence strength as note E-1).

### 4.2 Delta analysis — closing vs opening

- **Byte-identical closing files (12):** `t03` = `r03` (plan
  diagnostics + phase surface b), `t04` = `r04` (health), `t05` =
  `r05` (script settings — GENERATION_HALT still `"1"`, observability
  standing), `t07` = `r07` (queue — `delivery_paused: true`, one
  consumer), `t09` = `r09` (preserved plan), `t10` = `r10` (Phase B
  job), `t11` = `r11` (parked job), `t12` = `r12` (quota reconcile),
  `t13` = `r13` (quota), `t14` = `r14` (conflicts), `t15a` = `r15a`
  and `t15b` = `r15b` (sync watermarks) — verified by direct file
  comparison.
- **Timestamp-only differences (3):** `t08` vs `r08` (capabilities)
  differ **only** in the `asOf` field (1793933304962 →
  1793933371489); `t16a` vs `r16a` and `t16b` vs `r16b` (eligibility)
  differ **only** in `quotedAt` (1793933309609 → 1793933376042;
  1793933310074 → 1793933376792). Every substantive field — phase
  figures, lanes, registry, digests, eligible counts, costs,
  exclusions — is identical, verified field by field.
- **The act's own delta (2 files):** `t01` vs `r01` and `t02` vs
  `r02` differ exactly in the containment state the `clear` wrote
  (§3.2's field table) plus `t02`'s read-time `asOf` stamp. No other
  field anywhere in the set moved.

**Delta verdict:** the only deltas in the entire gate are the
ledger's own writes (§5) and read-time timestamp fields. No
out-of-gate delta exists; no STOP-and-classify arose at closing.

---

## 5. Totals reconciliation (package §4.4, expected no-failure path)

| Measure | §4.4 expected | This execution | ✓ |
|---|---|---|---|
| State writes | **1** (the single commit transaction: state → NORMAL, episode summary preserved, current-episode record reset, atomically) | **1** — the `clear` commit, `updatedAt 1793933356719` | ✓ |
| Audit rows | **2** (`clear:applied` + `stop_episode_closed`) | **2** — at the accounting strength stated below | ✓ |
| `deleteAlarm` | **0** | **0** — the clear touches no alarm API; no registration existed to delete | ✓ |
| `setAlarm` | **0** | **0** — nothing in this gate arms; `armedAt` read null at opening, in the act's aftermath, and at closing | ✓ |
| Commands / reports / SubmitJob | **0** | **0** | ✓ |
| Uploads / PATCHes / hold flips / queue changes | **0** | **0** — GENERATION_HALT stood `"1"` and the queue stood paused throughout, read at confirmation and at closing | ✓ |
| Recorder rows created by the gate | 0 | **0** — 296 rows at opening and at closing, window content-identical | ✓ |
| Spend | $0 | **$0** | ✓ |

**Counting basis, stated honestly (Q-2's qualification applied to
this gate's own rows).** The state-write count is established by the
single applied transition's response and the `updatedAt` it left
(1793933356719). The audit-row count and names follow the package
§4.4 budget and the deployed composed source's clear path — the
state-commit insert (`clear:applied`, detail carrying the reason),
then the episode-close insert (`stop_episode_closed`), in one
transaction — corroborated by the state row's outcome: the
`prevEpisode*` summary (episode 3, attempts 1, not exhausted, closed
at the commit's timestamp) is exactly the state the episode-close
half of that transaction writes, and no other act in the gate could
have written it. **The audit table itself has no separate read
surface in the read set** (note E-3): the two-row count (rows 5 and 6
of the history, per §1.2's forward accounting) is established by the
transition response plus the source-defined commit shape plus the
resulting state, not by a direct audit-table read, and this record
claims it on exactly that basis — the same documentary strength Q-2
accepted for the C3 history.

**Worst case was the same bound, as designed:** R-1 was sent exactly
once and the transaction is atomic — it either committed once
(1 write / 2 rows) or not at all (0 / 0). No failure branch arose,
and none could have multiplied writes.

---

## 6. End state

The system ends **HELD in NORMAL**, exactly as the GO prescribed:

- **Containment:** `NORMAL` on both surfaces, row present and
  verified, `stopConfidence "not_applicable"` (no stop exists for a
  present-tense confidence to describe). Episode 3 is **closed**: its
  summary stands in `prevEpisodeId 3`, `prevEpisodeAttempts 1`,
  `prevEpisodeExhausted false`, `prevEpisodeClosedAt 1793933356719`
  (Tier 2, until a future authorized clear overwrites it); the full
  history stands in Tier 1 — six audit rows as reconciled at
  documentary strength (C3's four + this gate's two). The verified
  fact of the stop survives in the audit history, the `prevEpisode*`
  summary, and the C3 record — not in the current-episode fields,
  which stand reset.
- **Alarm:** no registration stands (`armedAt: null` on both closing
  surfaces). Schedule rows preserved (pendingSchedule 2 /
  pendingWatchdog 1). The `clear` re-armed nothing, and nothing will
  wake the coordinator except the ordinary wake paths under NORMAL
  inside a future authorized gate.
- **Holds:** GENERATION_HALT still `"1"` (generation `halted`); queue
  `opalreader-generation-v2` still `delivery_paused: true`, one
  consumer. **Restoration lifted no hold at any point.**
- **Preserved work, untouched:** Phase B plan
  `plan:19cad189fab54b9c804a74a6` `active` {1,0,0,0}, entry `granted`;
  job `generating` rev 88; the single live grant
  `grant:plan:19cad189fab54b9c804a74a6:seg:87:full` stands `issued` —
  frozen exactly as censused; the idx-26 chapter exemption stands as
  it stood (this gate neither consulted nor touched it). Phase
  accounting frozen; conflicts at the four-row baseline; watermarks
  18 / 1841.
- **Recorder:** 296 rows, latest 2026-11-04T20:56:59.071Z, health
  clean — unchanged across the gate.
- **Spend:** $0 across the gate. No deployment, no code change, no
  settings change was made at any point.

---

## 7. What this record does NOT establish

- **No re-arm occurred, and none was tested.** Restoration deleted
  nothing and created no registration; `armedAt` is null because the
  registration C3 deleted stays absent, not because any arm path was
  exercised. This record is evidence about the *absence* of a
  registration at confirmation and closing — it says nothing about
  whether a future wake under NORMAL will deliver. **The W-4 remains
  UNRESOLVED** (its root cause unconfirmed; neither 1101 fault is
  attributed), the **racing-wake recheck remains
  PLATFORM-UNVERIFIED**, and **post-retry-exhaustion `getAlarm()`
  semantics remain UNSPECIFIED** — all carried at full strength from
  the C3 record. The generation-resume gate's wake design already
  assumes delivery cannot be presumed; nothing here weakens that
  assumption.
- **Runtime adoption generally remains unproven.** This gate proves
  the deployed `clear` path executed its designed transaction on the
  production build for this singleton row at this moment, read back
  identically on both surfaces. It does not prove adoption of any
  build by every Durable Object instance, and no claim of that scope
  is made (the standing C1-2 limitation).
- **The audit rows are accounted, not enumerated.** Per Q-2 and §5:
  rows 5 and 6 are established by the transition response, the
  source-defined commit shape, and the resulting state — not by a
  direct audit-table read, which no established surface provides.
- **The script etag stands at the strength of note E-1** (method
  closed, artifact thin), and the parked job's fingerprint was not
  byte-compared (note E-2).

## 8. What this record does not authorize

This record is evidence, not authority. It authorizes nothing, and
nothing in it advances any other gate:

- **The generation-resume gate remains CLOSED.** Its remaining
  preconditions are Rowan's documentary review of **this** record,
  the final readiness confirmation, and **Julie's separate GO**. The
  corrected resume package stands as ruled (package pin `0946f9f2…`,
  OQ-1 analysis at `60da50c3…`, correction at `8ca683bd…`, correction
  2 at `91bb9c44…` — OQ-3/OQ-6 as corrected, OQ-4 ACCEPT, OQ-5 ACCEPT
  WITH CONDITIONS); GR-B remains blocked on OQ-2. No wake command,
  hold lift, plan action, or generation dispatch is authorized by
  this record or by the consumed GO.
- **No further containment transition** of any kind (no
  `verify_chain_stop`, no `stop_chain`, no `contain_drive`, no second
  `clear`) is authorized. A future clear would overwrite episode 3's
  Tier-2 summary and would require its own standalone authorization
  with its own historical audit review.
- **The GO is consumed.** Julie's restoration GO (board comment
  6675499312) authorized exactly this one gate; it executed and is
  spent.
- No plan action, no exemption action, no queue or halt change, no
  deployment, no Batch work — none was performed and none is
  authorized.

## 9. Evidence index

Raw evidence: `~/workspace/ch2-program/ch3-recovery/restoration-execution/`.
The envelope `status` of every response file is 200. Opening reads are
the R-0 confirmation (package §3.1 numbering); closing reads repeat
the same set in the same order.

| File | Read / content | Bytes |
|---|---|---|
| `r01.json` | §3.1 read 1 — containment surface 1 (with nested alarm block) | 1,326 |
| `r02.json` | read 2 — `drive=1` projection: containment, alarm, recorder window | 47,643 |
| `r03.json` | read 3 — plan diagnostics (Phase B plan; phase surface b) | 1,581 |
| `r04.json` | read 4 — `/health` | 423 |
| `r05.json` | read 5 — cf-api script settings | 2,152 |
| — | read 6 — script etag: header-only in-process read; **no body file exists** (note E-1) | — |
| `r07.json` | read 7 — cf-api queue | 994 |
| `r08.json` | read 8 — capabilities (phase surface a) | 995 |
| `r09.json` | read 9 — preserved plan | 1,340 |
| `r10.json` | read 10 — Phase B job | 18,525 |
| `r11.json` | read 11 — parked Ch 3 job | 7,802 |
| `r12.json` | read 12 — quota reconcile | 2,689 |
| `r13.json` | read 13 — quota | 1,037 |
| `r14.json` | read 14 — conflicts | 1,906 |
| `r15a.json` / `r15b.json` | read 15 — sync changes, content / bindings | 350 / 370 |
| `r16a.json` / `r16b.json` | read 16 — eligibility, chapter / book scope | 822 / 838 |
| `r1-body.json` | R-1 — the sent `clear` body, exactly as dispatched | 879 |
| `s1.json` | R-1 — the response (applied; `stateRead` post-clear state) | 1,324 |
| `t01.json` … `t16b.json` | R-2/R-3 closing confirmation — same set, same order as the `r` series (sizes: t01 1,262; t02 47,579; t03 1,581; t04 423; t05 2,152; t07 994; t08 995; t09 1,340; t10 18,525; t11 7,802; t12 2,689; t13 1,037; t14 1,906; t15a 350; t15b 370; t16a 822; t16b 838) | — |

## 10. Turn

**Turn: Rowan's** — documentary execution review of this record (via
Julie's poke; the companion CP rides with the record). On Rowan's
acceptance that restoration is executed and closed, the
generation-resume gate's remaining steps are its final readiness
confirmation and Julie's separate GO — both still ahead, neither
implied by this record. Julie retains every execution authorization
that remains. No production act of any kind is pending or implied.
