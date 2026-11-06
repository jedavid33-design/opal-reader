# PHASE B — GATE C3, BRANCH (d) REVIVED-UNSTOPPED (POST-WINDOW): EXECUTION RECORD

**Gate:** C3 (operational verification of the containment stop), executed in branch (d)
REVIVED-UNSTOPPED (POST-WINDOW).
**Execution window:** 2026-11-06 — census opened 02:21:13Z; closing census opened
02:24:16Z (all times UTC; 2026-11-05 evening, America/New_York).
**Verdict:** **C3 branch (d) EXECUTED — PASS AT PARTIAL STRENGTH.** PARTIAL is this
gate's verdict cap in every branch (operative package §8); nothing in this record
claims more. The chain is stopped: containment state `CHAIN_STOPPED`, stop verified
at attempt 1, the standing alarm registration deleted, both holds standing.
**Spend:** $0.
**Raw evidence:** `~/workspace/ch2-program/ch3-recovery/c3-execution/` — census
reads `r01`–`r20`, step responses and read-backs `s1`/`s1b`/`s2`/`s3`/`s4`/`s5`,
closing-census reads `t02`–`t10`, and the step timestamp files
(`census-started.txt`, `c3-1-sent.txt`, `c3-1-resent.txt`, `c3-3-sent.txt`,
`c3-5-sent.txt`, `c3-7-started.txt`). Every value in this record is taken from
those files. This record's own pin is carried in the companion CP's
`<EXEC-PIN>` slot (a record cannot name its own commit).

---

## 1. Authority chain

The gate executed under the following chain, in order. No link was skipped, and
Julie's GO was recorded on the board **before** the execution census opened —
the ordering the corrected GO wording itself requires.

| # | Link | Reference |
|---|---|---|
| 1 | Operative C3 readiness package (rebased to the composed production build) | `PHASEB-C3-READINESS-PACKAGE-REBASED.md`, pin `46112a03…` (repo `jedavid33-design/opal-reader`, branch `ui1-review`) |
| 2 | C3-R1 correction (branch (c) strictly read-only; premise-failure classes) | `PHASEB-C3-R1-CORRECTION.md`, pin `aba681a0…` |
| 3 | C3 readiness — Rowan FINAL RULING: PASS (2026-11-02) | Board, opal-roundtable issue #15 |
| 4 | S1 window record (W-2 EXPECTED S1 EVENT; W-4 close, UNRESOLVED) | Pin `f75130c6…`; window log + tail log |
| 5 | Rowan ruling on the window record: R1 event ACCEPTED; R2 W-4 accepted as observation, NOT resolution; R3 C3 conditional branch (d) | `ROWAN-S1-WINDOW-RECORD-RULING.md` |
| 6 | Branch-(d) reconciliation/amendment (branch (d) delta D-1…D-6; movement rule §6; assumptions register) | `PHASEB-C3-BRANCH-D-RECONCILIATION.md`, pin `60da50c3…` |
| 7 | Rowan ruling on the reconciliation + OQ-1 analysis: REVISE — C3 conditionally accepted; C3-5 strikes re-census-and-continue | `ROWAN-C3D-OQ1-RULING.md` |
| 8 | Branch-(d) correction (movement rule struck to its strict form; GO wording corrected; C3-1…C3-5 dispositions) | `PHASEB-C3-BRANCH-D-CORRECTION.md`, pin `8ca683bd…` |
| 9 | Rowan ruling, corrections round 2: **PASS — C3 correction ACCEPTED; C3 DOCUMENTARY READINESS: PASS**; Wren may present the corrected GO wording to Julie | `ROWAN-CORRECTIONS2-RULING.md` |
| 10 | **Julie's GO**, in the corrected branch-(d) wording exactly as presented, given by button tap in the Coding Projects chat 2026-11-05 ~9:20 p.m. ET and **recorded on the board before the census** | Board comment **6675116603**, opal-roundtable issue #15 |
| 11 | Execution census C3-0 opened | 2026-11-06T02:21:13Z (`census-started.txt`) — after link 10 |

The GO's scope, as given: exactly ONE C3 attempt in branch (d); the contain_drive
+ reasoned clear mechanics pair; exactly one `stop_chain` act against the
then-current registration (verify retries only within the design bound of 3 if
the stop is unverified); any disqualifying movement between the accepted census
and the stop attempt **ends** the attempt (no re-census, no continuation, no
adaptation of the GO to a changed baseline); passive read-backs only — no
command, no wake provocation, no stimulus of any kind; ending HELD in
CHAIN_STOPPED. The GO expressly records Julie's understanding that the verdict
cannot exceed PARTIAL, that the W-4 stands accepted as an observation and NOT
resolved, that C3 does not restore NORMAL, and that a deleted registration
cannot be restored by this gate.

Production state entering the gate: build `fdb02395…` live; GENERATION_HALT
`"1"`; queue `opalreader-generation-v2` delivery paused; production
INVESTIGATION HELD; the Phase B plan `plan:19cad189fab54b9c804a74a6` and the
idx-26 chapter exemption preserved, untouched by this gate.

---

## 2. C3-0 — execution census

Census opened 2026-11-06T02:21:13Z. Baseline source for the branch-(d) delta:
the tail log's latest completed check, **2026-11-05T23:28:42Z**
(TAIL-W4-CONTINUING) — **2h 52m 31s old at C3-0**, inside the 48-hour freshness
rule (amendment §5.1); no re-baseline was required. The census is fresh reads at
gate time; tail-adopted values were expectations to match, not inherited facts.

**Result: every core item and every branch-(d) delta item matched. No movement
anywhere. The gate proceeded to C3-1 on this census.**

### 2.1 Branch-invariant core (operative package §4.0)

| # | Item | Expected | Read (evidence) | ✓ |
|---|---|---|---|---|
| 1 | Health | build `fdb02395b3775dc945baa395591a73060ab146c4`; generation `halted`; coordinator `armed` | `r01`: build `fdb02395b3775dc945baa395591a73060ab146c4`, `"generation":"halted"`, `"coordinator":"armed"`, scope `production` | ✓ |
| 2 | Script identity | etag `bb90f18223e1802e1c417f17359f344499dc2d29c78e54db259f6f9ae4ac5c9e` | Not separately read in this round's evidence set — see Evidence note E-1. Identity for this gate rests on item 1's build marker and item 3's settings surface | noted |
| 3 | Bindings / holds / observability | exactly 10 bindings; GENERATION_HALT `"1"`; `OPALREADER_PHASE_POLICY` `"enforce"`; observability enabled + `logs.persist: true` | `r15` (script settings): 10 bindings — `ALLOWED_ORIGIN`, `COORDINATOR`, `GEMINI_API_KEY`, `GENERATION_HALT` (plain_text `"1"`), `OPALREADER_ACCESS_TOKEN`, `OPALREADER_GENERATION_V2`, `OPALREADER_MIGRATION_OPERATOR_TOKEN`, `OPALREADER_PHASE_POLICY` (plain_text `"enforce"`), `OPALREADER_STORAGE`, `OPALREADER_V2_SCOPE`; observability `enabled: true`, `logs.enabled: true`, `logs.persist: true`; `compatibility_date` `2026-08-29` + `nodejs_compat` | ✓ |
| 4 | Settings | revision **1** (lane standard, cap $50) | `r05`: `"settingsRevision": 1` | ✓ |
| 5 | Queue | `delivery_paused: true`; exactly 1 consumer `f260f2188d80426bb0588685e9d084eb` | `r14`: queue `93b6a35fb8cf4788a91a2c90b748ae66` (`opalreader-generation-v2`), `delivery_paused: true`, `consumers_total_count: 1`, consumer `f260f2188d80426bb0588685e9d084eb` (script `opalreader-api-v2-prod`); retention 86,400 s | ✓ |
| 6 | Capabilities | standard admitted; Batch `batch_not_armed`; registry `forever-pucked` ↔ `5c589095-f812-48a2-8ab2-03ba2791f2b2` | Not re-read as a capabilities GET in this round's evidence set — see Evidence note E-2. The registry binding is corroborated in-set by `r11`/`r13` (eligibility for bookId `5c589095-f812-48a2-8ab2-03ba2791f2b2` returning the phase definition digest) and by `r04`/`r18` (`"phase":"forever-pucked"` on that book's plans) | noted |
| 7 | Phase accounting — BOTH surfaces | settled **1,029,420**; estimatedUnverified **19,018**; reservedUnverified **5,648**; inFlightUpper **0**; unknownOpen **0**; remaining **12,464,932** of 13,500,000 | Surface (b) plan-diagnostics body, read on **two** plan targets, exact and agreeing: `r04` (Phase B plan) and `r18` (Ch 3 plan) both carry `phaseAccounting`: `settledMicroCents 1029420`, `estimatedUnverifiedMicroCents 19018`, `reservedUnverifiedMicroCents 5648`, `inFlightUpperMicroCents 0`, `unknownOpen 0`, `remainingMicroCents 12464932`, `budgetMicroCents 13500000`, `unverifiedStatus "provider_unverified"`. The capabilities phase block (surface (a)) was not separately captured this round — see Evidence note E-2 | ✓ (see E-2) |
| 8 | Quota | reconcile `ok: true`, drift empty, sole exception the adjudicated straddler `att-37d63768-db4b-447d-8150-580b7c6ee257`; PT dispatched 57 / 79 / 44 / 76 (10-29…11-01) and 0 thereafter; derived reserved exactly **12** in branch (d) (amendment §5.2) | `r12`: `"ok": true`, `"armed": true`, `drift: []`, `driftCount: 0`, `censusComplete: true`, `exceptionCount: 1` — the sole exception `att-37d63768-db4b-447d-8150-580b7c6ee257` (`estimated_unverified`, the known straddler); dayTotals dispatched 2026-10-29 = 57, 10-30 = 79, 10-31 = 44, 11-01 = 76, 11-03 = 0, 11-04 = 0; current day (2026-11-05) dispatched 0 / reserved 0 / consumed 0; **2026-11-04 reserved 12 / consumed 12** — the standing grant's derived reservation on the rolled PT day, exactly the branch-(d) expectation. `r05`: `attemptsToday 0`, `providerDispatchesToday 0`, dayKey `2026-11-05`, `spentMicroCents 302292`, `ledgerSeq 329` | ✓ |
| 9 | Plans (registry level) | 5 plans: smoke `complete`; old Ch 2 `retired`; fresh Ch 2 `complete`; Ch 3 `complete`; Phase B `active` | Read directly in-set: Phase B plan (`r06`: `active`, §2.2/D-1) and Ch 3 plan (`r19`: `complete`, totals {eligible 23, done 23, failed 0, blocked 0}). The remaining three plan records were not individually re-read in this round's set — see Evidence note E-3; zero-movement cross-checks (items 8, 10, 12) bound them | noted |
| 10 | Conflicts | exact match to the pinned four-row `schedule_dead` lease baseline (ids 1–4, all fields) | `r08`: exactly 4 rows, all `cache_key "lease"`, `expected "7"`, `found "LIKE or GLOB pattern too complex: SQLITE_ERROR"`, `reason "schedule_dead"` — id 1 @ 1793318054808 `grant:plan:3183ecbf2ac4bf50bbc6166e:seg:1:full`; id 2 @ 1793319854632 `grant:plan:603ab416bd67ab1b25de97be:ch1:1:full`; id 3 @ 1793423664089 `grant:plan:b2dc2a3d1cd367a0245b9102:ch1:1:full`; id 4 @ 1793495070364 `grant:plan:e377a5559961b294154276b6:ch2:1:full` | ✓ |
| 11 | Parked job | `1832c21f…` `parked_policy` rev 1, fingerprint `b991f18a…`, grants [] | `r17`: state `parked_policy`, revision **1**, grants **[]**; occurrence composition as read: 27 occurrences enumerated — 24 `pending`, 3 `ready` (the 3 carrying binding revision keys); corroborated against the Ch 3 plan surface (`r19` dispositions: 23 `eligible`, 3 `bound_already`, 1 `excluded_parked` — the excluded one being idx 26, occurrence `2a85f74f-353d-4c25-a86a-4a4db392868b`). **Fingerprint: not byte-compared — see the honest note in §2.3** | ✓ (see §2.3) |
| 12 | Watermarks + occupancy | content **18**; bindings **1841** with 0 changes since; idx-26 R2 key FREE | `r09`: content `highWatermark 18`, changes [] · `r10`: bindings `highWatermark 1841`, changes [], `hasMore false` — zero changes since seq 1841; idx 26 remains unbound (its plan entry carries no binding; bindings watermark unmoved). No separate R2 LIST read is in this round's evidence set — see Evidence note E-4 | ✓ (see E-4) |

### 2.2 Branch-(d) delta (amendment §5.2, D-1…D-6)

| # | Item | Expected (branch (d) as dispositioned) | Read (evidence) | ✓ |
|---|---|---|---|---|
| D-1 | Phase B plan execution state | plan `active` {1,0,0,0}; entry `granted`; job `generating` rev **88**; exactly one live grant `grant:plan:19cad189fab54b9c804a74a6:seg:87:full` issued; seg:1–86 voided; quarantine `held: false` | `r06`: plan `plan:19cad189fab54b9c804a74a6` `active`, totals {eligible 1, done 0, failed 0, blocked 0}, sole entry occurrence `2a85f74f-353d-4c25-a86a-4a4db392868b` (chapterIndex 2, 569 chars) `occurrenceState "granted"`, quarantine `{"held": false}`. `r07`: job `plan:19cad189fab54b9c804a74a6:seg` `generating`, revision **88**; grants list 87 entries — 86 `voided` (seg:1–seg:86, sequential) and exactly one live: `grant:plan:19cad189fab54b9c804a74a6:seg:87:full`, state `issued`, revision 88; the single occurrence `granted` | ✓ |
| D-2 | Eligibility surface | the scope digests exactly `cdef2c7ec7bb8434b4e2fac66af49983ac7fa4b4e65bb0eda40354be51ff52d1` | `r11` (chapter scope, chapterIndex 2): digest `cdef2c7ec7bb8434b4e2fac66af49983ac7fa4b4e65bb0eda40354be51ff52d1`, eligibleCount 1, totalChars 569, expectedCost 8022, exclusions {bound_already 26}. `r13` (book scope): the identical digest `cdef2c7e…`, eligibleCount 315. Both scopes read this round returned the expected definition digest | ✓ |
| D-3 | `drive=1` baseline — non-delivering chain | recorder table exists; latest pass **id 296** @ **1793825819071**, stage complete, no row after 296; `recordingFailures` 0; pendingSchedule **2** / pendingWatchdog **1** | `r03` (`drive=1`): `tableState "populated"`; latest 50 rows returned, ids 296 → 247, **all** stage `complete`, `driveInvoked true`, no error fields; first (latest) row id **296**, `at 1793825819071` (2026-11-04T20:56:59.071Z); `recorderHealth`: `recordingFailures 0`, `lastFailureAt null`, `lastRecordedAt 1793825819071`; alarm block `pendingSchedule 2`, `pendingWatchdog 1` | ✓ |
| D-4 | armedAt — ADOPTED standing value | exactly **1793826389431**, identical across the paired reads; null = STOP (D-PF2); any other value = movement | `r02` (containment route): `alarm.armedAt 1793826389431` · `r03` (`drive=1` surface): `alarm.armedAt 1793826389431` — identical on both surfaces (due 2026-11-04T21:06:29.431Z; ~29h15m past due at census). Recorded verbatim as the pre-stop value | ✓ |
| D-5 | Containment projection (both surfaces) | `NORMAL`; `absent: true`; `verified: true`; `stopConfidence "not_applicable"`; stop/episode fields empty; audit history empty | `r02`: state `NORMAL`, `known true`, `absent true`, `verified true`, `updatedAt null`, `authorizationRef null`, all stop fields null/empty, `stopVerifyAttempts 0`, `stopEpisodeExhausted false`, `stopConfidence "not_applicable"`. `r03` containment projection: identical in every field | ✓ |
| D-6 | Disposition evidence | window record + Rowan's R1/R2/R3; Rowan's acceptance of the amendment (corrections round 2 PASS); tail standing REVIVED-UNSTOPPED / OWNED, latest check < 48 h; S1-X expired, never fired | Documentary: §1 links 4–9 all on file; tail latest completed check 2026-11-05T23:28:42Z (2h 52m before C3-0); S1-X never fired (no FIRING DECISION entry exists in the window log) | ✓ |

### 2.3 Evidence notes — where this round's read set is thinner than the package's enumeration

These notes narrow the documentary claim only; none of them is a census
deviation (the executor's STOP law keys on read values, and every value read
matched). They are recorded so Rowan's review sees exactly what the evidence
set does and does not contain.

- **E-1 (core item 2, script etag).** The census set contains no script-content
  GET, so the etag was not re-read this round. The build is identified by the
  `/health` build marker (item 1: `fdb02395…`, the Grant 1 build) and the
  settings surface (item 3). No deploy occurred between the Grant 1 upload and
  this gate.
- **E-2 (core items 6–7, capabilities surface).** No `GET
  /v2/generation/capabilities` response is in this round's evidence set. The
  phase figures (item 7) were read on the plan-diagnostics surface on **two**
  plan targets (`r04`, `r18`), exact and agreeing — the C2 lesson (a census
  item naming two surfaces must enumerate reads covering both) is noted: this
  round's set covers the diagnostics surface twice and the capabilities
  surface not at all. The capabilities facts (halted; `batch_not_armed`;
  registry binding) stand as read at the tail check 2026-11-05T23:28:42Z,
  under 3 hours before C3-0, and are corroborated in-set per items 6–7 above.
- **E-3 (core item 9, registry-level plans).** The smoke, old-Ch 2, and fresh
  Ch 2 plan records were not individually re-read in this round's set. Their
  immobility is bounded by the zero-movement cross-checks that were read:
  quota reconcile `ok: true` with the sole known exception (item 8), the
  four-row conflicts baseline exact (item 10), and both sync watermarks
  unmoved with zero changes (item 12).
- **E-4 (core item 12, idx-26 R2 occupancy).** No R2 LIST read is in the set.
  The occupancy claim carried by this census is the one the reads establish:
  the bindings watermark stands at 1841 with zero changes since, and idx 26's
  plan entry remains unbound and `granted` — no binding (and therefore no new
  occupancy) was created.
- **E-5 (parked-job fingerprint, core item 11).** The parked job's stored
  fingerprint string (`b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282`
  in the pinned baseline) is **not exposed on the read surfaces used this
  round**, and no fingerprint byte-compare was performed. The census verified
  the job's state (`parked_policy`), revision (1), empty grants, and its full
  occurrence composition as read. Any statement that the fingerprint was
  re-verified this round would be false, and this record does not make it.
- **E-6 (audit history at census).** D-5's "audit history empty" rests on the
  containment projections themselves (state row absent, all episode fields at
  their empty values, on both surfaces): the audit table has no separate read
  surface in the read set, at census or at closing (§4 carries the same note
  for the gate's own audit rows).
- **E-7 (a rejected probe read).** `r16` records a diagnostics GET issued
  without a target, rejected HTTP 400 `diagnostics_target_required`. It read
  nothing and wrote nothing; the targeted diagnostics reads (`r04`, `r18`,
  `r20`) followed in the same census set. Recorded here for completeness of
  the read set; it is not a census item and not a deviation.

**Movement check across the census:** none. Recorder latest row 296 with no
successor; `armedAt` bit-identical on paired reads; job revision 88; the
single live grant at seg:87; phase figures frozen; conflicts, watermarks,
quota all at baseline. The corrected §6 movement rule was therefore never
engaged — and, per the correction, had anything moved, the attempt would have
ended on the movement with no re-census.

---

## 3. Step-by-step ledger execution (operative §3, as amended for branch (d))

All acts went to the operator containment route on the live composed build.
Every transition carried `authorizationRef` `"Gate C3 branch (d) — Julie GO,
board comment 6675116603"` once the C3-1 correction (§3.1) established the
required form. No command, report, SubmitJob, wake provocation, or stimulus of
any kind was sent at any point in the gate.

### 3.1 C3-1 — `contain_drive` (mechanics leg, sent form)

The census read containment NORMAL (D-5), so C3-1 ran in its **sent form** (the
RB-6 pre-satisfied form did not arise).

- **First send — 2026-11-06T02:23:12Z** (`c3-1-sent.txt`; response `s1`):
  HTTP 200, `{"outcome":"rejected","reason":"authorization_ref_required"}`.
  **The send wrote nothing.** Classification, stated exactly: this was a
  **pre-act envelope validation rejection**. The deployed route's closed
  allowlist requires a nonblank `authorizationRef` on every containment
  transition (deployed source: the worker-entry containment POST handler;
  the design v3 §5 discipline the build implements). The operative ledger's
  abbreviated body notation for C3-1 (`{action:"contain_drive"}`) omitted the
  field. The executor verified the requirement against the deployed source
  **before** re-sending, supplied the `authorizationRef` naming Julie's GO
  (above), and re-sent. The rejection is **not** a ledger mutation (zero
  writes occurred), **not** a §6 movement (the system did not change), and did
  not touch the census (which remained the accepted census). It is recorded
  here, in the C3-1 row, at full transparency — neither hidden nor inflated:
  a request-form defect in the paperwork's abbreviation, caught by the
  route's own validation before any act.
- **Re-send — 2026-11-06T02:23:44Z** (`c3-1-resent.txt`; response `s1b`):
  HTTP 200, `{"outcome":"applied","action":"contain_drive","state":"DRIVE_CONTAINED","idempotent":false}`.
  The response's state read: state `DRIVE_CONTAINED`, `absent: false` (the
  state row now exists — created by this transition, as designed), `verified:
  true`, `updatedAt 1793931825315`, the `authorizationRef` recorded verbatim,
  stop/episode fields still empty. **State writes 1; audit rows 1**
  (`contain_drive:applied`).

### 3.2 C3-2 — read back both surfaces

`r`-series-equivalent reads after C3-1 (`s2` containment route; `s2` `drive=1`
surface):

- Both surfaces: `DRIVE_CONTAINED`, `absent: false`, `verified: true`,
  `updatedAt 1793931825315`, identical `authorizationRef`, stop fields empty,
  `stopConfidence "not_applicable"` — **agreeing in every field**.
- Alarm block unchanged: `armedAt 1793826389431`, pendingSchedule 2,
  pendingWatchdog 1 (the transition touches no alarm API — operative §5.1).
- Recorder: latest row still **296** @ 1793825819071; `recordingFailures 0`.
  No pass in the interval; no §6 movement.

### 3.3 C3-3 — reasoned `clear` (mechanics leg reversal)

- **Send — 2026-11-06T02:23:53Z** (`c3-3-sent.txt`; response `s3`):
  `POST {action:"clear", reason:"Gate C3 mechanics leg: restore opening state"}`
  — the ledger's exact reason string. HTTP 200,
  `{"outcome":"applied","action":"clear","state":"NORMAL","idempotent":false}`;
  state read: `NORMAL`, `absent: false` (the row persists, as designed — the
  clear restores the opening *state*, it does not un-create the row),
  `verified: true`, `updatedAt 1793931834501`, stop/episode fields empty.
  **State writes 1; audit rows 1** (`clear:applied`, reason recorded). No
  episode event: no stop episode was open (operative §3, C3-3 row). This
  clear is the only clear inside C3 and is **not** a restoration.

### 3.4 C3-4 — read back both surfaces

Reads after C3-3 (`s4` containment route; `s4` `drive=1` surface):

- Both surfaces: `NORMAL`, `verified: true`, `updatedAt 1793931834501`,
  agreeing in every field — the gate's opening state restored.
- Alarm block unchanged (`armedAt 1793826389431`); recorder still 296 rows;
  no movement. The gate proceeded to the stop act on the accepted census,
  which remained bit-identical outside the ledger's own writes.

### 3.5 C3-5 — `stop_chain` (the physical stop act)

- **Send — 2026-11-06T02:24:06Z** (`c3-5-sent.txt`; response `s5`):
  HTTP 200, `{"outcome":"applied","action":"stop_chain","state":"CHAIN_STOPPED","idempotent":false,"stopVerified":true}`.
  The act ran in the ledger's order — state commit (enum + episode minted),
  physical act (observe → `deleteAlarm()` → read-back), stop-record write —
  and **verified at attempt 1**. The stop record, exactly as read back in the
  response's state read and confirmed at C3-7:

  | Field | Value |
  |---|---|
  | `state` | `CHAIN_STOPPED` |
  | `stopStatus` | `"verified"` |
  | `stopVerified` | `true` |
  | `stopVerifiedAt` | 1793931847431 |
  | `stopVerifyAction` | `"stop_chain"` |
  | `stopArmedBefore` | **1793826389431** — the adopted standing value (D-4), exactly |
  | `stopArmedAfter` | **null** — the act's `getAlarm()` read-back returned null: the registration is deleted |
  | `stopVerifyAttempts` | 1 |
  | `stopEpisodeId` | 3 |
  | `stopEpisodeExhausted` | `false` |
  | `updatedAt` | 1793931847431 |
  | `prevEpisode*` fields | all null (no prior episode exists) |

  **State writes 2** (commit + stop record); **audit rows 2**
  (`stop_chain:applied` — the row whose id mints the episode, id **3** — and
  `stop_chain_verify:verified`); **`deleteAlarm` 1**; `setAlarm` 0.

### 3.6 C3-6 — `verify_chain_stop` retries

**NOT RUN.** C3-5 ended verified at attempt 1, so the C3-6 condition (only if
C3-5 ends unverified) never arose. The episode's verification budget stands
unspent: attempts used 1 of the bound of 3; `stopEpisodeExhausted: false`.

### 3.7 C3-7 — closing census

Closing census opened 2026-11-06T02:24:16Z (`c3-7-started.txt`), ten seconds
after the stop act. Reads `t02`–`t10`:

- **Containment, both surfaces:** `CHAIN_STOPPED`, `verified: true`,
  `stopStatus "verified"`, and every stop-record field from §3.5 agreeing
  between the containment route (`t02`) and the `drive=1` projection (`t03`),
  including `stopConfidence "verified_current"` on both surfaces — the
  recorded verified outcome corroborated by the closing reads' own alarm
  observation: **`armedAt: null`** on the closing surfaces, pendingSchedule 2
  / pendingWatchdog 1 preserved (the stop preserved the schedule rows).
- **Recorder:** still **296 rows**; latest row 296 @ 1793825819071; health
  clean (`recordingFailures 0`). **No row is timestamped after the stop's
  verification** — no movement at or after the stop.
- **Everything else bit-identical to the opening census:** the closing files
  `t04` (plan diagnostics), `t05` (quota), `t06` (Phase B plan), `t07` (job),
  `t08` (conflicts), and `t10` (bindings watermark) are **byte-identical** to
  their opening counterparts `r04`, `r05`, `r06`, `r07`, `r08`, `r10`
  respectively (verified by direct file comparison). Plan still `active`
  {1,0,0,0} with the entry `granted`; job still `generating` rev 88 with the
  single live grant `seg:87:full` issued; phase figures frozen at
  1029420 / 19018 / 5648 / 0; conflicts exactly the four baseline rows;
  watermarks 18 / 1841, zero changes.
- **Delta check:** the only deltas in the entire gate are the ledger's own
  writes (§4) and the deleted registration. No delta beyond the ledger's own
  — no STOP-and-classify arose at closing.

---

## 4. Totals reconciliation (operative §3.1, expected no-failure path)

| Measure | §3.1 expected (no-failure, sent form) | This execution | ✓ |
|---|---|---|---|
| State writes | **4** (C3-1 ×1, C3-3 ×1, C3-5 ×2) | **4** — contain_drive commit, clear, stop commit, stop record | ✓ |
| Audit rows | **4** (C3-1 ×1, C3-3 ×1, C3-5 ×2) | **4** — `contain_drive:applied`, `clear:applied`, `stop_chain:applied`, `stop_chain_verify:verified` (the design's names for the rows these transitions write) | ✓ |
| `deleteAlarm` | **1** (C3-5) | **1** | ✓ |
| `setAlarm` | **0** | **0** — nothing in this gate arms; no registration appeared that the gate did not delete | ✓ |
| `verify_chain_stop` calls | 0 on the no-failure path (budget ≤2 held in reserve) | **0** — budget unspent | ✓ |
| Commands / reports / SubmitJob | **0** | **0** | ✓ |
| Uploads / PATCHes / hold flips / queue changes | **0** | **0** — GENERATION_HALT stood `"1"` and the queue stood paused throughout, read at census and closing | ✓ |
| Recorder rows created by the gate | 0 (branch (d) expects no accrual; accrual would be §6 movement) | **0** — 296 rows at opening, step read-backs, and closing | ✓ |
| Spend | $0 | **$0** | ✓ |

**Counting basis, stated honestly.** The state-write count is established by
the four applied transitions' responses and the `updatedAt` sequence they left
(1793931825315 → 1793931834501 → 1793931847431, the last carrying both C3-5
writes). The audit-row count and names follow the operative ledger's
accounting for the transitions performed (§3.1: each transition writes its
named row), corroborated by the episode accounting: the stop commit minted
**episode id 3** — the id of its own `stop_chain:applied` audit row — which is
consistent with exactly two prior audit rows in the table (this gate's
`contain_drive:applied` and `clear:applied`), in a table D-5 established as
empty at census. **The audit table itself has no separate read surface in the
read set** (E-6): the four-row count is established by the transition
responses plus the `updatedAt`/episode accounting, not by a direct audit-table
read, and this record claims it on exactly that basis.

**The C3-1 first send is not in these totals.** It wrote nothing (rejected
pre-act, §3.1) and is not a ledger mutation; it is accounted in §3.1's row,
not in the mutation ledger.

---

## 5. Verdict — and what was NOT demonstrated

**C3 branch (d): EXECUTED — PASS AT PARTIAL STRENGTH.**

What the execution establishes:

- The containment machinery works end-to-end on the production composed
  build: `contain_drive` applies and persists; the reasoned `clear` restores
  NORMAL; `stop_chain` commits, deletes, and verifies; both read surfaces
  project every state identically at every step.
- **The stop is operationally verified for THIS registration at THIS
  moment.** The standing registration `armedAt 1793826389431` — the W-4
  registration, past due ~29h18m by the stop act — was observed by the act,
  deleted by it (`stopArmedBefore 1793826389431`, `stopArmedAfter null`), and
  the closing census's own fresh alarm observation on both surfaces reads
  `armedAt: null` against the recorded verified stop record
  (`stopConfidence "verified_current"` on both surfaces). The stop procedure
  required no alarm delivery at any step: it acted on the registration as it
  stood, which is the independence Rowan's R3 required demonstrated.
- The stop's blast radius was exactly the ledger's: four state writes, four
  audit rows, one `deleteAlarm`, nothing else — plan, job, grant, phase,
  conflicts, watermarks, quota, holds, and queue all bit-identical across the
  gate.

What remains unproven, carried at full strength (this is why the verdict is
PARTIAL, and why PARTIAL is not a shortfall of this execution but the gate's
designed cap):

- **Live drive suppression of a running chain was NOT demonstrated.** The
  chain was not delivering at gate time — that is the W-4. C3 stopped a
  standing, undelivered registration; it did not suppress a chain in motion,
  and no branch of this gate, on this evidence, could have shown that.
- **The racing-wake recheck stays PLATFORM-UNVERIFIED.** The v3+ gate
  re-check is harness-proven; no live race occurred or was provoked, and none
  of this gate's evidence bears on the platform behavior.
- **Post-retry-exhaustion `getAlarm()` semantics stay UNSPECIFIED**
  (reconciliation A-2). The null read-back is evidence about **this**
  registration at **that** moment — which is all the gate claims — and
  documents nothing about the platform's general behavior in this region. A
  null readback establishes the observed registration state, not a guarantee
  about future platform behavior (correction, C3-3 condition).
- **The W-4 remains UNRESOLVED.** Its root cause is unconfirmed; this gate
  neither attributes it to the 1101 fault nor presumes anything about
  delivery behavior generally. The registration the W-4 concerned **no longer
  exists** — deleted by this gate's stop act under Julie's GO. The W-4
  blocker stands discharged at disposition strength for C3 eligibility
  (Rowan R1/C3-1, corrections round 2); the underlying alarm-delivery failure
  remains an open fact of the platform record, preserved for whatever gate
  next needs it — in particular the generation-resume gate's wake question,
  whose design already assumes delivery cannot be presumed.

---

## 6. End state

The system ends **HELD in CHAIN_STOPPED**, exactly as the GO prescribed:

- **Containment:** `CHAIN_STOPPED` on both surfaces, `verified: true`,
  `stopConfidence "verified_current"`; stop record as §3.5 (episode id **3**,
  verified at attempt 1, budget unspent, `stopEpisodeExhausted: false`); the
  containment state row and audit table now exist, created by this gate's
  transitions — the first containment transitions ever run in production.
  The audit history contains exactly this gate's episode (four rows, §4) —
  the history the standalone restoration's mandatory historical audit review
  must cover.
- **Alarm:** no registration stands (`armedAt: null` on both closing
  surfaces). Schedule rows preserved (pendingSchedule 2 / pendingWatchdog 1).
  Nothing will wake the coordinator until a future authorized act re-arms
  through the ordinary wake paths under NORMAL — which requires restoration
  first.
- **Holds:** GENERATION_HALT still `"1"` (generation `halted`); queue
  `opalreader-generation-v2` still `delivery_paused: true`, one consumer.
  **C3 restored nothing** — no hold was lifted at any point.
- **Preserved work, untouched:** Phase B plan `plan:19cad189fab54b9c804a74a6`
  `active` {1,0,0,0}, entry `granted`; job `generating` rev 88; the single
  live grant `grant:plan:19cad189fab54b9c804a74a6:seg:87:full` stands
  `issued` — frozen mid-churn by the stop, exactly as censused; the idx-26
  chapter exemption stands as it stood (this gate neither consulted nor
  touched it). Phase accounting frozen; conflicts at the four-row baseline;
  watermarks 18 / 1841.
- **Recorder:** 296 rows, latest 2026-11-04T20:56:59.071Z, health clean — the
  frozen tail of the revived chain's activity, now a closed record.
- **Tail watch:** the post-window regime **REVIVED-UNSTOPPED / OWNED is
  closed by this execution** — C3 execution was the tail watch's exit
  condition, and Wren disabled `phaseb-s1-tail-watch` in session after the
  closing census (job history preserved). The tail log stands as the
  regime's record. Ownership of the stopped chain passes to the standing
  gates: restoration next, separately authorized (§7).
- **Spend:** $0 across the gate. No deployment, no code change, no settings
  change was made at any point.

---

## 7. What this record does not authorize

This record is evidence, not authority. It authorizes nothing, and nothing in
it advances any other gate:

- **Standalone restoration** (CHAIN_STOPPED → NORMAL) remains a separate
  gate requiring its own Rowan ruling, Julie's separate GO, a fresh census, a
  recorded reason, and the mandatory **historical audit review** — which must
  cover the episode this gate created (episode id 3; the four audit rows of
  §4). Restoration is never bundled with anything else, and `clear` inside
  this gate (§3.3) was a mechanics-leg reversal, not a restoration.
- **The generation-resume gate** remains behind restoration: the corrected
  resume package (pins `0946f9f2…` + `60da50c3…`, as corrected at `8ca683bd…`)
  with OQ-1 accepted as a readiness design only; the OQ-3…OQ-6 consolidated
  disposition is still in preparation; GR-B remains blocked on OQ-2. No wake
  command, hold lift, or generation dispatch is authorized.
- **No further containment transition** of any kind (no `verify_chain_stop`
  against episode 3 outside its own gate, no second `stop_chain`, no
  `contain_drive`, no `clear`) is authorized by this record or by the
  consumed GO.
- **The GO is consumed.** Julie's branch-(d) GO (board comment 6675116603)
  authorized exactly one attempt; it executed and is spent. Any further C3
  attempt, on any baseline, requires a new Rowan ruling and a new Julie GO.
- No plan action, no exemption action, no queue or halt change, no
  deployment, no Batch work — none was performed and none is authorized.

---

## 8. Turn

**Turn: Rowan's** — documentary execution review of this record (via Julie's
poke; the companion CP rides with the record). Julie retains every execution
authorization that remains: restoration and the generation-resume gate are
hers to open, separately, after Rowan's reviews. Wren's next work on this
chain is the OQ-3…OQ-6 readiness disposition already in preparation; no
production act of any kind is pending or implied.
