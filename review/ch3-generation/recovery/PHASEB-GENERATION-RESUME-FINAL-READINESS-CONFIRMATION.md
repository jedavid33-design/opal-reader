# Phase B — GENERATION-RESUME gate: FINAL CONSOLIDATED READINESS CONFIRMATION

**Prepared by Wren, 2026-11-05, under Rowan's standalone restoration
execution ruling** (local record `ROWAN-RESTORATION-EXECUTION-RULING.md`;
board comment 6675637721): "Wren shall prepare the final consolidated
generation-resume readiness confirmation against the actual
post-restoration baseline, incorporating all accepted corrections and
the three-hour checkpoint. … No generation-resume execution is
authorized by this ruling. The final readiness review must return to
Rowan before any separate GO is requested from Julie."

- **What this document is.** A CONSOLIDATION, not another correction.
  It restates the generation-resume gate exactly as it now stands
  after every ruling in its chain — the package, the OQ-1 analysis as
  corrected, both corrections, the OQ-3–OQ-6 disposition as ruled and
  as corrected — measured against a fresh post-restoration baseline
  census captured for this filing (§3, artifacts saved). Rowan's
  final readiness review reads this one document; the underlying
  documents remain the operative texts, and where any summary here
  and an operative text differ, **the operative text governs**.
- **What it is not.** It authorizes nothing, requests no GO, and
  performs no production act. The baseline census of §3 was a
  read-only capture under the standing read discipline; nothing else
  in this filing touched production. Production remains **HELD**:
  containment NORMAL, GENERATION_HALT `"1"`, queue paused, no alarm
  registration standing, the preserved plan and the idx-26 exemption
  untouched.
- **NO SPOILERS:** structural metadata and digests only. No segment
  text is read, printed, or quoted anywhere in this filing.

Pin (this document, the companion cp, and the baseline census
artifacts ride one pin commit): `<CONFIRM-PIN>` — repo
`jedavid33-design/opal-reader`, branch `ui1-review`. (Pin-slot
pattern, as established: a commit cannot name itself; the pinned
copy carries the slot.)

---

## 1. Authority and status map

### 1.1 The operative documents, with pins

| Document | Pin (`ui1-review`) | Status |
|---|---|---|
| Generation-resume package (`PHASEB-GENERATION-RESUME-PACKAGE.md`) | `0946f9f2fb978a46b562c738d8ac6d9d4ee977a6` | Base design; amended by both corrections below |
| OQ-1 analysis (`PHASEB-GENERATION-RESUME-OQ1-ANALYSIS.md`) | `60da50c3a6da36e42dd8e93fa67bc8673737613e` | The wake design; amended by correction 1 |
| Correction 1 (`PHASEB-GENERATION-RESUME-CORRECTION.md`, with the companion C3 correction) | `8ca683bdfe2967b1e23a99b9eded99b065478a00` | GR-1…GR-7 as ruled; **accepted** (corrections-round-2 ruling) |
| OQ-3–OQ-6 disposition (`PHASEB-GENERATION-RESUME-OQ3-OQ6-DISPOSITION.md`) | `f83568de7b288748d7246933f9fc7821ed5d4ac5` | As ruled; amended by correction 2 at OQ-3/OQ-6 |
| Correction 2 (`PHASEB-GENERATION-RESUME-CORRECTION-2.md`) | `91bb9c44b8b6a1a80310b14c2668e85cf110ad98` | OQ-3/OQ-6 as ruled; **PASS** (restoration-readiness + correction-2 ruling) |
| C3 execution record | `b4727c408f6c446a94466594ea2cc7c59d11de8d` | C3 EXECUTED AND CLOSED, PASS AT PARTIAL STRENGTH |
| Restoration readiness package | `e6359a2183d431b3598c83f11c60d61cd29d13fd` | Readiness PASS WITH CONDITIONS (Q-1…Q-4 accepted) |
| Restoration execution record | `304e030948aac998ef278daf221ab9aae6497970` | RESTORATION EXECUTED AND CLOSED, PASS |

### 1.2 The rulings in the chain (relayed by Julie; verbatim on the board)

1. **S1 window record ruling** (board 6672659161): S1 event ACCEPTED
   (W-2); W-4 accepted as observation, root cause UNCONFIRMED; C3
   branch (d); resume documentary review permitted, OQ-1 OPEN.
2. **C3-(d)/OQ-1 ruling** (board 6674941519): GR-1 ACCEPT IN
   PRINCIPLE; GR-2 ACCEPT WITH QUALIFICATION; GR-3/GR-4/GR-6 REVISE;
   GR-5 OQ-2 REMAINS OPEN, GR-B blocked; GR-7 PASS WITH CONDITIONS.
3. **Corrections-round-2 ruling** (board 6675099399): PASS — both
   corrections accepted; OQ-1 accepted as a readiness design.
4. **C3 execution + OQ-3…OQ-6 ruling** (board 6675293356): C3
   EXECUTED AND CLOSED at PARTIAL strength; OQ-3 REVISE; OQ-4
   ACCEPT; OQ-5 ACCEPT WITH CONDITIONS; OQ-6 REVISE.
5. **Restoration readiness + correction-2 ruling** (board
   6675488303): restoration readiness PASS WITH CONDITIONS;
   correction 2 PASS (OQ-3 as corrected; the three-hour checkpoint
   ADOPTED as policy).
6. **Restoration execution ruling** (board 6675637721): PASS —
   RESTORATION EXECUTED AND CLOSED; R4's forward requirement (a
   captured build-identity observation wherever the script etag is a
   mandatory predicate) is discharged by design at §3.3 of this
   confirmation.

### 1.3 Disposition of the open questions

| Question | Disposition | Where it stands in this confirmation |
|---|---|---|
| **OQ-1** — the wake mechanism | **CLOSED as a readiness design** (GR-1…GR-7 as corrected and accepted) | §5 |
| **OQ-2** — re-issuance after a void (cold restart) | **OPEN** — GR-B blocked | §4 |
| **OQ-3** — recorder expectations | **RULED as corrected** (correction 2 §1; abort condition A-7) | §6.2 |
| **OQ-4** — the D-value at the wake | **ACCEPT** — no additional pre-lift observation; the 15-minute bound is a failure-decision rule, not a latency guarantee; the B-family remains unresolved | §5.2 |
| **OQ-5** — post-completion chain behavior | **ACCEPT WITH CONDITIONS** — closing census suffices as closing evidence; the named post-gate observation duty is specified here | §7 |
| **OQ-6** — completion timing bound | **RULED as corrected** (correction 2 §2; the three-hour checkpoint ADOPTED as operational safety policy) | §6.1 |

### 1.4 The package §0 dependency legs — all satisfied but two

Leg 1 (eligible S1 disposition, reviewed): **satisfied** (ruling 1;
correction 1 §7's reconciliation). Leg 2 (C3 executed and closed,
CHAIN_STOPPED / verified): **satisfied** (ruling 4). Leg 3
(restoration executed and closed, ending NORMAL, system otherwise
HELD): **satisfied** (ruling 6). Leg 4 (Rowan's PASS on the package
as corrected, including the open questions): OQ-1, OQ-3, OQ-4, OQ-5,
OQ-6 are ruled; **the leg completes only with Rowan's final
readiness ruling on this confirmation** — and for branch GR-B it
additionally requires OQ-2's resolution, which stands OPEN (§4).
Leg 5 (Julie's separate GO): **not requested by this filing**; the
exact proposed wording stands at §8 for the decision that follows
Rowan's ruling.

---

## 2. The GR-3 provenance record — the alarm registration's documented history

GR-3 (correction 1 §2, as ruled) makes the no-probe branch depend on
provenance **documented in the restoration record**. This section
writes the provenance facts into this gate's record, from the C3 and
restoration records, so the wake decision rules of §5 have their
predicate in one place.

1. **The standing registration and its deletion.** Before C3, one
   alarm registration stood: `armedAt` **1793826389431** (due
   2026-11-04T21:06:29Z) — the registration whose delivery was never
   observed in the W-4 period (an UNRESOLVED observation; its root
   cause is UNCONFIRMED and nothing in this filing attributes it).
   C3's single `stop_chain` act (2026-11-06T02:24:06Z) **deleted**
   it: the act's own read-back recorded `stopArmedBefore`
   1793826389431 and `stopArmedAfter` **null**, `stopStatus`
   verified at attempt 1, episode 3. The registration the W-4
   concerned no longer exists.
2. **The restoration re-armed nothing.** Restoration's single
   `clear` (2026-11-06T02:49:15Z, Julie GO board 6675499312) returned
   containment CHAIN_STOPPED → NORMAL. By design law a `clear` never
   re-arms, and none occurred: the restoration closing census read
   `armedAt` **null**, and the execution ruling (R2) accepts that
   state.
3. **Every read since reads null.** The restoration preflight
   census, its closing census, and this confirmation's baseline
   census (§3) all read `armedAt` **null** on the `drive=1` surface,
   with `pendingSchedule` 2 / `pendingWatchdog` 1 (the schedule rows
   a stop preserves) unchanged throughout.

**Consequence for §5.** There is **no standing registration whose
provenance needs explaining**: the documented history accounts for
the registration's deletion and for the absence that followed. The
wake decision at execution therefore starts from `armedAt` null at
census, and **the probe branch is the expected path**. The GR-3
no-probe branch is addressed at §5.3, including what this record
means for its first condition.

---

## 3. The post-restoration baseline census — and the execution census it specifies

### 3.1 The baseline capture

Captured **2026-11-06T02:58Z**, read-only, in one session, after the
restoration execution ruling — the first complete read set taken
against the post-restoration state for this gate. Artifacts are
saved in `resume-confirmation-baseline/` (18 files, enumerated with
sizes and SHA-256 in the companion cp) and are pinned with this
confirmation. The read set is the restoration package §3.1 set,
unchanged — the same surfaces the execution census (§3.3) re-reads.

### 3.2 Baseline values (verified from the artifacts)

| Item | Baseline value (artifact) |
|---|---|
| Containment, surface 1 (operator route, b01) | state **NORMAL**; `known: true`; `absent: false`; `verified: true`; `updatedAt` **1793933356719**; `authorizationRef` "Standalone restoration — Julie GO, board comment 6675499312"; all current-episode stop fields reset (`stopStatus`/`stopVerifiedAt`/`stopVerifyAction`/`stopArmedBefore`/`stopArmedAfter` null, `stopVerifyAttempts` 0, `stopEpisodeId` null, `stopEpisodeExhausted` false); `prevEpisodeId` **3**, `prevEpisodeAttempts` **1**, `prevEpisodeExhausted` **false**, `prevEpisodeClosedAt` **1793933356719**; `stopConfidence` **"not_applicable"** |
| Containment, surface 2 (`drive=1` projection, b02) | Field-agreeing with surface 1 (projection-shape note: surface 1 nests the alarm block inside the containment object; surface 2 carries it top-level — values identical, as at every prior census) |
| Alarm (b01/b02) | `armedAt` **null**; `pendingSchedule` **2**; `pendingWatchdog` **1** |
| Recorder (b02) | Table populated; latest row id **296** @ **1793825819071** (the pass list is a 50-row descending window, ids 296→247); `recordingFailures` **0**; `recorderHealth.lastRecordedAt` 1793825819071 |
| Health (b04) | build **`fdb02395b3775dc945baa395591a73060ab146c4`**; generation `halted`; coordinator `armed`; scope `production` |
| Script settings (b05) | GENERATION_HALT **`"1"`**; exactly **10** bindings; `OPALREADER_PHASE_POLICY` `"enforce"`; observability enabled, logs enabled + persisted |
| **Script etag (b06-etag.json)** | **`bb90f18223e1802e1c417f17359f344499dc2d29c78e54db259f6f9ae4ac5c9e`** — CAPTURED AS A SAVED ARTIFACT: the §3.2 in-process surrogate GET, response header recorded raw and stripped, `capturedAt` 2026-11-06T02:58:34Z (restoration ruling R4 discharged for this census) |
| Queue (b07) | `delivery_paused: true`; exactly 1 consumer (`f260f2188d80426bb0588685e9d084eb`) |
| Phase accounting, BOTH surfaces (b08 capabilities + b03 plan diagnostics) | settled **1,029,420**; estimatedUnverified **19,018**; reservedUnverified **5,648**; inFlightUpper **0**; unknownOpen **0**; remaining **12,464,932** of 13,500,000; `provider_unverified` (the surfaces' projections carry different field sets — capabilities omits `settledBasis`/`unknownOpen`/`unverifiedStatus`, plan diagnostics omits `bookId` — compared on the shared fields, all equal; the C2 two-surface discipline) |
| Capabilities (b08) | Standard admitted; Batch **`batch_not_armed`**; registry `forever-pucked` ↔ bookId `5c589095-f812-48a2-8ab2-03ba2791f2b2` |
| Preserved plan (b09) | `plan:19cad189fab54b9c804a74a6` **active**, totals {eligible 1, done 0, failed 0, blocked 0, prompts 0}; sole entry (chapterIndex 2, occurrence `2a85f74f-353d-4c25-a86a-4a4db392868b`) `occurrenceState` **granted**; quarantine `held: false` |
| Phase B job (b10) | `generating`, revision **88**; 87 grants: **86 voided** (seg:1–86) + exactly one live, `grant:plan:19cad189fab54b9c804a74a6:seg:87:full` **issued**; derived reserved **12** |
| Parked Ch 3 job (b11) | `parked_policy`, revision **1**, grants [] (the stored fingerprint string is not exposed on this surface — the standing narrowed strength; no fingerprint byte-compare is claimed) |
| Quota (b12, b13) | reconcile `ok: true`, `armed: true`, drift empty, sole exception the adjudicated straddler `att-37d63768-db4b-447d-8150-580b7c6ee257`; settings revision **1**; PT day 2026-11-05 attempts 0, provider dispatches 0 |
| Conflicts (b14) | exactly the **4** baseline `schedule_dead` lease rows (ids 1–4) |
| Watermarks (b15a/b15b) | content **18**, bindings **1841**, zero changes on both |
| Eligibility (b16a chapter / b16b book) | digest **`cdef2c7ec7bb8434b4e2fac66af49983ac7fa4b4e65bb0eda40354be51ff52d1`** on both scopes; chapter: eligible 1, 569 chars, expected cost **8,022** units, exclusions {bound_already 26, voice_prompt 0, parked 0, other 0} |

Nothing in the baseline deviates from the restoration closing
census: the post-restoration state is the state the restoration
record left, unchanged — as it must be, since no act of any kind has
been authorized or taken between the two captures.

### 3.3 The execution census specification (GR-0)

At execution — after Rowan's final readiness ruling (§1.4 leg 4) and
Julie's GO (§8), recorded before the census (the established
ordering) — the executor re-runs **this same read set** fresh. Its
specification:

- **Expected values = §3.2's baseline, item for item.** The baseline
  supersedes every older quoted value in the package's §4 (whose
  opening baseline predates the window, C3, and the restoration);
  package §4's *forms* — the branch-invariant core's structure, the
  two-surface phase discipline, the adopt-and-verify recorder
  treatment (§4.0 item 11: the recorder's adopted state is now
  **populated, latest row 296 @ 1793825819071, failures 0**, and the
  live read must match it) — stand as written.
- **Deviation = STOP before any mutation** (executor STOP law;
  package §7.1). A failed or unreadable read on either containment
  surface, a surface disagreement, or any value differing in any
  field stops the gate; the deviation is preserved with its raw
  reads and returns for ruling. There is no re-read-until-it-matches.
- **Build identity, R4 discharged by design.** The script etag is a
  mandatory predicate of this census (package §4.0 item 1). The
  execution capture therefore includes the etag read by the
  restoration package §3.2 method (in-process surrogate GET; the raw
  response header and the stripped value both recorded), **saved as
  an artifact in the gate's evidence set before the wake decision is
  taken**: file `g06-etag.json` in the execution evidence directory
  (`resume-execution/`, mirroring `b06-etag.json`'s fields:
  purpose, capturedAt, method, etagHeaderRaw, etagStripped). The
  restoration record's E-1 gap — an etag value carried at
  executor-assertion strength for want of a saved artifact — does
  not recur in this gate: an execution census whose etag artifact
  was not captured and saved is an incomplete census, and the gate
  does not proceed on it.
- **Quota-day check (package GR-0/§5.4).** The census names the
  executing PT day (rolls 07:00Z), reads its dispatched count, and
  verifies **headroom ≥ 12** against the 100/day cap; if the PT day
  rolls before GR-4, the check is re-read immediately before the
  unpause (package GR-4 note). Headroom < 12 defers the gate that
  day (package §4.3) — a deferral, recorded as such, not a failure.
- **The census selects the branch** (§4) — by the plan/job values it
  reads, never by executor choice.

---

## 4. Branch determination — GR-A / GR-B, decided only at the execution census

### 4.1 The predicates, exactly as the package defines them

**GR-A (package §4.1)** is selected when the census reads the
preserved plan/job **exactly at their attempt-3 closing values**:

> - Plan `active`, totals {eligible 1, done 0, failed 0, blocked 0,
>   prompts 0}, `updatedAt` at its creation value; entry disposition
>   `eligible`, `occurrenceState: pending`, `executionState: null`;
>   quarantine `held: false`.
> - Job `queued` rev 1, **grants []**; occurrence `pending`,
>   `cache_key: null`.
> - In-set protocol values: §2.3.1 verbatim.

**GR-B (package §4.2)** is selected when the window/C3 records
establish — and the census confirms — that the pre-classified §7.3
set was entered:

> grant `grant:plan:19cad189fab54b9c804a74a6:seg:1:full` issued and
> standing in its lease-expired **void** state; occurrence
> `granted`; job `generating` rev ≥ 2; derived reserved returned to
> **0** …; phase figures otherwise exactly §4.0 item 5; dispatched
> for every window day **0**; provider attempts **0**; settled delta
> across the window **0**.

with §4.2's own adoption clause: "The branch's delta values are
**adopted from the C3 closing census and the restoration census**,
quoted in the execution record with their sources; values those
records do not establish are not estimated here." And its standing
bar: "Execution in GR-B additionally requires Rowan's ruling on
OQ-2" — which GR-5 declined to give (OQ-2 REMAINS OPEN; correction 1
§4).

### 4.2 The baseline measured against both branches — stated factually

| Predicate element | GR-A (§4.1) | GR-B (§4.2 as pinned) | **Baseline as censused (§3.2)** |
|---|---|---|---|
| Plan state / totals | active / {1,0,0,0,0} | (§4.0 core) | **active / {1,0,0,0, prompts 0}** |
| Entry / occurrence state | `eligible` / `pending` | `granted` | **`granted`** |
| Job state / revision | `queued` rev 1 | `generating` rev ≥ 2 | **`generating` rev 88** |
| Grants | [] | the one §7.3 grant, void | **87 grants: seg:1–86 voided; seg:87:full ISSUED (live)** |
| Derived reserved | (n/a; 0 at issuance) | **0** (void released it) | **12** |
| Phase figures | §4.0 item 5 | §4.0 item 5 | **§4.0 item 5 exactly** |
| Dispatched / attempts / settled delta across the window | — | 0 / 0 / 0 | **0 / 0 / 0** |

Three conclusions follow from the records, stated at their exact
strength:

1. **GR-A's census form cannot obtain on this plan.** Its predicates
   are the attempt-3 closing values, and the state moved off them
   irreversibly on 2026-11-03T23:26:14Z, when the Grant 2 wake's
   first drive pass issued `seg:1:full` (job `queued` rev 1 →
   `generating` rev 2; occurrence `pending` → `granted`). Grants,
   once issued and later voided, remain in the job's `grants[]`; no
   act in any operative document returns the plan/job to §4.1's
   values, and every operative document forbids the plan/job
   mutations that could. GR-A's expectations (§2.3.1 — an *initial*
   issuance, needing no OQ-2) remain exactly as specified and would
   govern if a census ever read §4.1's form; on the preserved plan
   as it stands, it cannot. (Stated for Rowan's confirmation as part
   of the branch question, §4.3 — the confirmation asserts the
   record arithmetic, not a ruling.)
2. **The baseline is the §7.3 churn state in substance** — a wake
   issued the grant under the holds; the chain churned in-set
   (sequential lease-expired re-issuance, one live grant at a time,
   reserved pinned at 12, dispatched 0, $0) through pass 296; the
   passes then stopped with the final grant, `seg:87:full`, still
   standing **issued** (no later pass ever processed its lease
   expiry, and C3's stop and the restoration changed none of the
   plan/job state). Every §4.2 element that describes the set's
   *character* holds: occurrence `granted`, job `generating` rev
   ≥ 2, phase exact, dispatched/attempts/settled-delta all 0 across
   the window.
3. **But §4.2's pinned values do not describe the state the window
   actually produced.** §4.2 was written on 2026-11-03, before the
   window ran, against the anticipated single-grant churn: it names
   `seg:1:full` standing void and reserved returned to 0. The
   window's actual course (296 passes) produced an 87-grant
   sequence whose standing member is `seg:87:full` in state
   **issued**, with reserved **12**. Correction 1 §8 already named
   the route by which these values reach the branch question: "the
   window's churn outcome (successor grants to `seg:87:full`,
   reserved 12 at the window's close) reaches GR-B, if at all,
   through those censuses and the D-delta form" — i.e., through
   §4.2's own adoption clause, from the C3 closing census and the
   restoration census, both of which read exactly the state §3.2
   re-reads.

### 4.3 The branch rule for execution — and the question this confirmation puts to Rowan

The determination happens **only at the execution census**, by its
reads, under these rules:

- **If the census verifies §4.1's predicates exactly → GR-A**, and
  the gate proceeds under §2.3.1's expectations (no OQ-2 dependency).
- **If the census reads the churn state → the gate does NOT
  proceed.** GR-B remains **BLOCKED while OQ-2 stands open** (GR-5):
  package §2.3.2's expectations "wait on" the OQ-2 ruling, and no
  ruling has filled them. The executor does not execute on the
  delivering-chain pattern as a conditional expectation, does not
  re-characterize the census into GR-A, and does not interpolate a
  branch (package §4.3). The census reads are preserved and the
  branch question returns to Rowan.
- **Any state matching neither branch → STOP** (package §4.3),
  before any mutation.

**The question for Rowan (the confirmation's central ask).** Because
§4.2's pinned values and the window's actual outcome diverge in the
particulars tabled at §4.2 — while its adoption clause and
correction 1 §8 both route the actual values into the branch — the
branch status of the actual churn state is **not resolved by the
documents' own force**, and this confirmation does not resolve it
silently. Rowan is asked to rule, as part of the final readiness
review, which of these holds:

- **(i)** The actual churn state, as adopted through §4.2's adoption
  clause from the C3 and restoration censuses (and re-read at
  §3.2), **is** GR-B's census form — with the consequence that
  stands either way: GR-B is blocked by OQ-2, and the gate cannot
  execute until OQ-2 is resolved by sufficient evidence or by a
  separately reviewed, bounded verification protocol (GR-5's two
  routes); **or**
- **(ii)** §4.2 requires amendment to describe the multi-grant churn
  state before any branch determination can be made against it —
  in which case the amendment is a further documentary round, and
  the same OQ-2 block applies to execution regardless.

Either ruling leaves the practical position identical today: **on
the baseline as censused, no branch is executable** — GR-A's form
cannot obtain, and GR-B is blocked. The GO wording at §8 is written
to that position: it authorizes proceeding **only** on an exact
GR-A census, and a stop-and-return on every other reading. If Rowan
prefers that no GO be presented until the branch question and OQ-2
resolve, the wording stands ready for the later decision; nothing
in this filing requests it now.

---

## 5. The wake decision rules (GR-2, as corrected — GR-1…GR-7)

### 5.1 The mechanism (GR-1, accepted in principle; correction 1 §§3, 7)

Exactly **one** fresh probe command, at the GR-2 slot — after the
execution census (GR-0) and the voice checkpoint (GR-1), **before
either hold lifts**, while both holds stand:

| Element | Value (analysis §2.1, as corrected) |
|---|---|
| Route | `POST /v2/commands` via the **client connector**, production scope + instance headers |
| Body | `{"command_id":"<FRESH-ID>","type":"RequestPause","payload":{"jobId":"alarm-wake-probe:nonexistent"}}` |
| `<FRESH-ID>` | Newly minted for this gate, never previously used (a reused id makes the command a replay, which short-circuits **before** `wake()` — freshness is the mechanism, not a formality) |
| Expected receipt | HTTP 200 `{"outcome":"rejected","reason":"job_not_found"}` — the refusal is the success criterion at the command layer; **any other outcome is a STOP-and-classify event** |
| Count | **Exactly one** production command (GR-4: counted as one, including its rejected receipt; §7.1). Never re-sent; never followed by an improvised second wake |

The precedent (Grant 2, 2026-11-03T23:26:13Z) supports the design;
it **does not prove the post-stop/post-clear case** — no live
precedent exists for the wake in that state, and none is claimed
(GR-1, at its ruled strength). The refusal proves `handleCommand`
ran and apply refused; it is **never** represented as proof of zero
downstream effects (GR-4; effects are accounted as observed, §7.1).

### 5.2 Verification — by observed recorder-row effect only (GR-2 as qualified; GR-6; OQ-4 ACCEPT)

**Governing rule: persisted `armedAt` is NOT proof of delivery.** A
changed `armedAt` after the probe is a consistency marker only. The
wake is verified **only** by the recorder-row route (analysis §3.1
as corrected by GR-6):

> a new `d6_drive_passes` row on the P-6 surface
> (`GET /v2/d6-diagnostics?drive=1`) with id greater than GR-0's
> latest recorded row, timestamped after the probe's dispatch,
> `stage` complete, `driveInvoked` true, error fields null —

or by an independently adequate verification route Rowan has
approved **in advance**. No other route exists by default.

- **Bound (GR-2):** **15 minutes** from the probe's dispatch, polled
  on the P-6 + P-1 pair as **complete paired polls at least every
  5 minutes** (both surfaces read at every poll; a poll with a
  failed surface is a failed poll, not a negative observation). The
  bound is a **failure-decision bound, not a latency finding** — no
  wording in this gate presents it as an upper bound on alarm
  delivery latency. No additional waiting is appended on executor
  authority; a longer bound would be a ruling. Per OQ-4 (ACCEPT),
  **no additional pre-lift observation** beyond the complete census,
  this paired-poll verification, and the §5.3 route where applicable
  is required; the B-family remains unresolved.
- **The R-06 discrepancy path (GR-6).** If, within the bound, an
  in-set grant transition is observed **without** a corresponding
  recorder row, the executor classifies an **R-06 evidence
  discrepancy** (both surfaces' raw reads recorded under that name)
  and **lifts neither hold** on that evidence; the gate does not
  proceed to the lifts, and the discrepancy returns for review. It
  is not recorded as a wake failure — the record states exactly what
  was seen and exactly what was not established. Symmetrically, a
  recorder row without its expected grant movement is classified,
  never resolved by preferring one surface.
- **The census is never shortened** by the wake's outcome: GR-0's
  full read set, the containment/restoration verification, and the
  grant-state checks remain mandatory in full whether the wake
  verifies, fails, or is not needed (correction 1 §1.1).

### 5.3 The non-null `armedAt` branch (GR-3, as ruled) — and its application to this record

GR-3 as corrected (correction 1 §2.1): a non-null `armedAt` at
GR-0, by itself, **satisfies nothing and omits nothing**. Exactly
one no-probe branch exists, opening only when **both** hold:

> **(i) Documented provenance** — the standing registration's
> provenance is documented in the **restoration record**, written at
> restoration time and standing before this gate opens, naming
> (a) that a registration stands at the restoration's close (or
> arose at an identified point the record covers), (b) its value as
> read at the restoration's closing census, and (c) the identified
> wake that produced it. A value merely consistent with a re-arm is
> not documentation; an executor inference is not documentation.
>
> **(ii) A fresh, independently observed drive effect, pre-lift** —
> after GR-0 and before either hold lifts, a drive effect
> satisfying the **same** wake-verification requirement (the §5.2
> recorder-row route), independently observed under the §5.2 polling
> discipline and bound.

If both hold, GR-2 is recorded satisfied-by-observation under GR-3
and no probe is sent. If either fails, **the default is the probe** —
unless the package's census law stops the gate first. No second
wake is ever improvised.

**Application to the actual record (§2).** The restoration record
documents the opposite of a standing registration: the prior
registration was deleted by C3's verified stop, the restoration's
closing census read `armedAt` **null**, and the clear re-arms
nothing. Two consequences, stated for Rowan's confirmation as part
of the final review (the rule is quoted above at full strength; the
application is this confirmation's reading of it against §2's
facts):

- **Condition (i) cannot be met for any registration arising after
  the restoration.** A registration that appeared post-restoration
  (e.g., through ordinary app use — a `PushPositionEvents` command
  reaching `wake()`, package §5.3) arose after the restoration
  record was written; that record contains no account of it, no
  closing-census value for it, and no identified wake that produced
  it. The no-probe branch is therefore **unavailable on this
  baseline**, however plausible such a registration's origin looks.
- **A non-null `armedAt` at the execution census is consequently a
  STOP, not a branch.** It is a value the restoration record cannot
  account for (package §4.0 item 4: "An `armedAt` the restoration
  record cannot account for = STOP"; package §7.1; correction 1
  §2.1's closing paragraph: the unaccounted case "remains what the
  package's law already made it: a census deviation, STOP at
  GR-0"). The gate preserves the reads and returns for ruling.

And the expected case needs no branch at all: **`armedAt` null at
census (the §3.2 baseline) → the single probe of §5.1**, verified
under §5.2.

### 5.4 Wake failure behavior (GR-7, PASS WITH CONDITIONS, as tightened)

- **No observed effect within the bound** → STOP **before the
  lifts**. Both holds stand (none was lifted; no re-hold is needed
  or performed). The failure is recorded as a new W-4-class
  observation — probe command_id, dispatch timestamp, the refusal
  response, the registration state as read per surface, no pass and
  no grant transition within the bound — with the **raw poll
  evidence itself preserved unedited and returned with the record**
  to Rowan and Julie (a summary of the polls is not a substitute
  for the polls).
- **Exactly one wake attempt.** No automatic retry; no
  deploy-as-stimulus (struck from the escalation sequence in the
  alarm-semantics line and never restored); no hold lift following
  failed pre-lift verification.
- **Later delivery is new evidence, not retroactive authorization:**
  a pass arriving after the attempt has ended is observed, logged,
  and reported as a tail-observation fact (under the standing holds
  it can only churn the grant — $0, no dispatch); it does not
  satisfy GR-2 for the ended attempt, does not revive the consumed
  GO, and authorizes nothing. A new attempt is a new authorization.
  (The §8 duty is the instrument that observes such a late arrival
  on this gate's paths.)
- Package §7 item 3 stands **as replaced by correction 1 §1.2**
  (the 15-minute recorder-row test above — a readable registration
  alone never satisfies it), and OQ-1 standing unruled is no longer
  a live form of that item: OQ-1 is ruled (§1.3).

---

## 6. The execution sequence, consolidated (package §5, as corrected)

Any STOP condition, at any step, ends the sequence where it stands;
if the holds have been lifted, the §2.3.3 re-hold sequence runs
first, in its order, before anything else. The executor's own
tracing never clears its own stop.

- **GR-0 — Fresh execution census** (§3.3). Branch selected by the
  census (§4.3). STOP on any deviation before any mutation.
- **GR-1 — Voice checkpoint** (package §5.2; reads only). Fresh
  re-verification: chapter quote bound **26** / parked 0 / eligible
  **1**; segment quote eligible **1** / **569** chars / expected
  **8,022**, exclusions zero, `voice_prompt 0`; the segment's POV
  resolving through its recorded cast voice (Alex → Gemini Charon,
  no prompt). The quote digest is compared against `cdef2c7e…`:
  agreement is corroboration; **disagreement is a STOP** (package
  §7.2). The §3.2 baseline eligibility reads (b16a/b16b) already
  stand at exactly these values; GR-1 re-reads them fresh in the
  gate session — a baseline reading never substitutes for the
  checkpoint.
- **GR-2 — The wake** (§5). Exactly one probe, verified by the
  recorder-row route within the 15-minute bound, or the gate stops
  pre-lift under §5.4. (Branch outcomes from §4.3 apply first: on a
  churn-state or neither-branch census the sequence never reaches
  GR-2.)
- **GR-3 — Halt lift.** Settings-only operative-envelope flip:
  metadata = the live `/settings` read with only GENERATION_HALT
  `"1"` → `"0"`; identical parts. Read-backs, all exact: `/health`
  generation `enabled`, build unchanged; **etag unchanged**; parts
  byte-identical; observability intact (if the flip resets
  observability, the standing deploy-law PATCH is applied inside
  this step's single counted mutation, as the flip's own repair,
  and reported); GENERATION_HALT `"0"`; 10 bindings; queue still
  paused.
- **GR-4 — Queue unpause.** cf-api PUT `delivery_paused: false`;
  read-back confirms. Immediately before this step, the quota-day
  re-check if the PT day has rolled since GR-0 (§3.3). **The lifts
  run in this order — halt lift, then unpause** — as the package's
  sequence fixes them; the §2.3 protocol's clock keys to the
  unpause read-back, "the second hold lift," the last
  executor-controlled instant. From that read-back, the protocol
  runs.
- **GR-5 — Monitored generation (package §2.3).** Polls of the full
  P-1..P-9 set at least every 5 minutes, preserved raw. The
  executor sends **nothing** during GR-5: no command, no second
  wake, no nudge. Controls, all live simultaneously:
  - **The sliding stall test** (§6.1);
  - **The three-hour checkpoint** (§6.1);
  - **Abort conditions A-1…A-7** (§6.2) — any one, at any poll,
    fires the §2.3.3 re-hold **in its exact order** (re-pause and
    read back; re-halt and read back; closing capture; ends HELD;
    §7.3 three-line exposure report).
- **GR-6a — Success close** (on §6.3's closure): re-pause the queue
  (read-back), then re-halt (restore envelope; read-backs mirrored
  from GR-3: generation `halted`, etag unchanged, observability
  intact). The default, and the only form proposed, is **holds
  restored**; a lifted end state would require Julie's GO to name
  it expressly (§9), and this confirmation does not propose it.
- **GR-7 — Closing census.** The full §3.3 read set repeated.
  Expected deltas from GR-0, and **only** these (package §5 GR-7):
  plan totals done 1 (§6.3); job/occurrence at their completion
  values; bindings watermark **1842** with exactly the one idx-26
  binding; phase settled increased by exactly this segment's
  recorded cost, reserved figures returned to baseline; quota
  dispatched for the PT day increased by exactly this segment's
  attempt count; the alarm standing re-registered by the chain's
  own re-arm cycle (value recorded, not predicted). Any other delta
  is classified in the record before the gate is called closed
  (package §7.6). The closing record opens the §8 observation duty.

### 6.1 The two timing controls (OQ-6 as ruled — correction 2 §2; checkpoint ADOPTED)

- **Primary — the sliding ≥35-minute no-progress test** (package
  §2.3.4; Gate 4's durable ruling). A **progress event** is any of:
  grant appearance or grant state/revision change; an attempt
  recorded for this occurrence; plan totals change; occurrence
  state change; dispatched increment for this grant. **Two
  consecutive complete polls ≥ 35 minutes apart with no progress
  event between them declare the stall** (abort A-1); any progress
  event slides the window, without limit of count; the window runs
  from the last observed progress, never from the unpause.
- **Backstop — the maximum elapsed-time review checkpoint: 3 hours
  from dispatch** (correction 2 §2.3(c), **ADOPTED as operational
  safety policy** in Rowan's correction-2 ruling — no longer a
  proposal; it is not a measured provider-latency bound and not a
  completion deadline). **T0** is the timestamp of the first
  complete P-1..P-9 poll at which P-5 records a dispatched
  increment for the current PT day attributable to this gate's
  grant above the pre-unpause baseline. If the §6.5 completion set
  has not been observed at or before **T0 + 3 hours**, the
  checkpoint fires: (1) **preserve state** — a full closing capture,
  the raw poll set preserved; (2) **stop further exposure if safe**
  — the §2.3.3 re-hold in its exact order; if any re-hold read-back
  cannot be verified, escalate at once in the same report rather
  than retrying silently; (3) **escalate** — the record classifies
  the end **CHECKPOINT-ESCALATED** (no failure and no fault
  declared) and returns to Rowan and Julie for a fresh ruling.
  **The attempt never extends past the checkpoint under the same GO
  under any wording.** If dispatch never occurs, the checkpoint
  never starts (the pre-dispatch phase is governed by the 15-minute
  bound, the sliding test, and A-1).
- **The ceilings' true scope** (correction 2 §2.2/§2.3(b), at the
  ruling's exact strength): the 12-slot cohort reservation bounds
  **attempts**; A-3 (12,808 units) and A-4 (25,000 units) bound
  **financial exposure**; **none of them bounds wall-clock
  duration**, and no passage of this gate's record may cite them as
  doing so.

### 6.2 Abort conditions — A-1…A-7 as they now stand

Package §2.3.3's A-1…A-6, **plus A-7** as inserted by correction 2
§1.5:

- **A-1:** the stall test of §6.3 is met.
- **A-2:** any out-of-set value (the branch's in-set expectations),
  including any foreign-generation signal. **Foreign generation is
  a STOP at any point** (Gate 4 law).
- **A-3:** the forecast line (12,808 units) crossed by this
  segment's cumulative settled delta before completion — a forecast
  deviation + STOP, reported at exactly that strength.
- **A-4:** the detection threshold (25,000 units) crossed —
  reported as a threshold crossing, never as a cap breach.
- **A-5:** any hold, build, settings, observability, conflicts, or
  parked-job value moves outside its census expectation at any
  poll.
- **A-6:** a drive-pass recorder row shows an error outcome
  attributable to this plan's pass that the protocol cannot
  classify inside the in-set values (recorder errors are reported,
  never absorbed).
- **A-7 (correction 2 §1.4/§1.5):** a post-lift R-06 evidence
  discrepancy — an in-set accounting transition (any §6.1
  progress-event kind) observed in a complete poll with **no
  corresponding recorder row in that poll or the next complete
  poll** — where the completion set (§6.3) has **not** already been
  observed. On detection: classify **R-06** with both surfaces' raw
  reads; **no further dispatch decision rests on the accounting
  surfaces**; run the §2.3.3 re-hold in its exact order; end HELD;
  return to Rowan and Julie for review. No continuation, no retry,
  no success close under the same GO.
  **The completion carve-out (correction 2 §1.4(e)):** if, at or
  before the detection poll, the accounting surfaces already show
  the **complete** §6.3 completion set, **completion stands as
  fact** — it is not unwound; the executor performs the GR-6a-form
  close; and the record carries **completion and the R-06
  discrepancy side by side — completed-with-discrepancy, never a
  clean success** — returning to Rowan's execution review with both
  facts stated. Closing on facts already effected is not continuing
  dispatch; continuing dispatch after the discrepancy is known is
  forbidden in all cases, the carve-out included.
  (Pre-lift, GR-6's discipline is untouched and stricter in form:
  §5.2's discrepancy path lifts neither hold at all.)

### 6.3 The completion set and closure evidence

**Completion is proven by the accounting surfaces; recorder rows
corroborate** (OQ-3 as ruled; disposition §1.4 clause 2, standing).
Success closure requires the poll set to show, complete: occurrence
`ready`; execution `committed`; plan totals {eligible 1, **done
1**, failed 0, blocked 0}; derived reserved returned to 0; and
**exactly one new binding** for
`5c589095-f812-48a2-8ab2-03ba2791f2b2:2a85f74f-353d-4c25-a86a-4a4db392868b`
with the **bindings watermark at 1842** (P-8: exactly one change)
— **plus** the P-6 discrepancy check run across the whole poll set
(a closure is recorded clean only if no A-7 detection stands; a
carve-out closure quotes the completion values **and** the
discrepancy) — **plus** the GR-7 closing census. The verification is
closed by the raw poll set itself; no summary substitutes for the
raw polls.

---

## 7. Exposure limits, consolidated

### 7.1 The counted-command ledger (package §3, as corrected by GR-4)

| Step | Act | Counted |
|---|---|---|
| GR-0 | Execution census (§3.3) — reads only | 0 |
| GR-1 | Voice checkpoint (§6) — reads only | 0 |
| GR-2 | **The wake** (§5.1) — exactly one fresh probe command (`RequestPause` vs `alarm-wake-probe:nonexistent`, fresh command_id, client connector), including its expected rejected receipt | **1** |
| GR-3 | Halt lift (§6) — settings-only envelope flip | 1 |
| GR-4 | Queue unpause (§6) — cf-api PUT | 1 |
| GR-5 | Verification protocol (§6) — polls, reads only | 0 |
| GR-6a / GR-6b | Close (exactly one of): re-pause + re-halt | 2 |
| GR-7 | Closing census — reads only | 0 |

**Ceiling: counted production commands ≤ 5 on every path** (GR-4,
as corrected). The probe's count of one is the command itself
including its receipt — never zero, never more than one.
**Observed effects are accounted separately, never as mutations and
never as zero-proof** (correction 1 §3.3): the registration state,
drive activity, and grant churn are recorded per poll with their
read sources (P-6, P-1, P-5), as observed or not claimed. The
execution record must carry the probe line (command type, target,
fresh command_id, dispatch timestamp, connector route), its receipt
verbatim, and each observed effect with its read source (GR-4's
record requirement).

**Explicit zero budgets (unchanged):** SubmitJob **0** — of any
scope, ever (§9 restates it); exemption calls **0** (the exemption
stands applied); containment transitions **0** (restoration is
closed; re-stopping a revived chain after an abort is a future
gate); settings changes beyond the two halt envelopes **0**;
deploys **0**; queue changes beyond GR-4/GR-6 **0**; conflicts
changes **0**.

### 7.2 Money (Gate 4 law, at correction 2's restated scope)

- Expected cost of the one segment: **8,022 units ≈ $0.008** (the
  eligibility surface's live quote, re-read at §3.2 b16a and again
  at GR-1). **Forecast line 12,808 units ≈ $0.013** (abort A-3);
  **detection threshold 25,000 units ≈ $0.025** (abort A-4). Per
  Gate 4's durable ruling: the forecast line is a deviation signal
  and the threshold a DETECTION THRESHOLD — **neither is a cap**,
  and no wording in this gate presents either as one. A-3/A-4 bound
  **financial exposure**; they do not bound elapsed time (§6.1).
- **Phase budget:** the segment's settled cost lands inside phase
  `forever-pucked`'s frozen 13,500,000-unit budget (remaining
  12,464,932 at baseline); the per-grant phase guard applies as
  shipped; the $50 settings cap is an outer backstop, untouched.
- **Physical backstop:** the Gemini prepay balance (Julie's AI
  Studio prepay; $17.83 as of her Oct 29, 2026 screenshot —
  HISTORICAL, not freshly verified by this filing, which makes no
  calls to it). No automatic top-up exists or is authorized.
- **Exposure reporting (package §8.3, all end states, three lines,
  always):** (1) verified charges — the settled delta on both phase
  surfaces, in units and dollars; (2) unverified estimates — any
  attempt standing `estimated_unverified` at closing, stated
  separately, never merged into line 1; (3) remaining phase room —
  13,500,000 minus the closing settled/reserved position, from the
  closing census.

### 7.3 Quota

The provider-attempt cap is **100/day** (PT day, boundary 07:00Z),
an app-selected Reader policy cap (b13's provenance line). The
cohort worst case for this gate is **12 slots** — the single
grant's reservation — which bounds **attempts**; the census
requires **headroom ≥ 12** on the executing PT day, re-checked at
GR-4 if the day rolls (§3.3). Expected realized attempts for one
569-char segment are far below the reservation; the reservation is
a bound, not a forecast.

### 7.4 Scope

Exactly **one segment**, through exactly **one** resume of the
preserved plan: no Batch (Batch stands unarmed and its arming is a
separate later gate chain), no rest-of-*Forever Pucked*, no other
book, plan, or job; no plan action (no retirement, revocation,
release, or quarantine change); no exemption change; no second
SubmitJob ever (§1.1 of the package is HARD LAW: the preserved plan
is a live trigger, and a duplicate intent would corrupt the
exclusivity this gate's verification rests on). The parked Chapter 3
job is a census fact only and is never touched.

---

## 8. OQ-5 — the named post-gate observation duty (ACCEPT WITH CONDITIONS, specified here)

Rowan's condition (ruling 4, §B): the closing census suffices as
closing evidence; **establish a named read-only post-gate
observation duty for both success and abort paths, ending at
acceptance of the execution record or 14 days after close,
whichever occurs first**, with its owner, start, read set,
classifications, escalation, and termination specified. The
disposition (§3.4) proposed the tail discipline's form; this
section specifies the duty in full. **It authorizes no production
mutation, at any point, on any path.**

- **Name:** the **Phase B resume post-gate observation duty**,
  carried out by a scheduled read-only job named
  **`phaseb-resume-postgate-watch`**, created by the executor as
  part of the gate's closing acts (its creation, schedule, and read
  set are recorded in the execution record; the job does not exist
  before the gate closes and is not created by this filing).
- **Owner:** **Wren** — the executor owns the duty: the job's
  creation at close, its daily review, its classifications'
  reporting, and its termination. The standing end-state name for
  the chain under this duty is **REVIVED-UNSTOPPED / OWNED** (the
  package §2.3.3 form), whatever the gate's closing classification.
- **Start:** at **gate close** — the GR-7 closing census timestamp
  (success path) or the abort/checkpoint/wake-failure closing
  capture timestamp (every other path). The duty attaches on
  **both** end paths and on the checkpoint and wake-failure closes:
  every close leaves a registered or registerable chain whose later
  state has twice been the material fact in this programme (the
  revival; the W-4).
- **Cadence:** **daily**, at approximately **18:28 ET** — the
  retired tail watch's slot and form (`phaseb-s1-tail-watch`, daily
  ~18:28 ET, read-only), adopted so the two regimes read alike
  across the handover. Each check is reads only.
- **Read set** (the closing-census subset): `GET
  /v2/d6-containment` (both containment facts via this surface and
  the next); `GET /v2/d6-diagnostics?drive=1` (containment surface
  2, the alarm block, the recorder — latest row, failures); `GET
  /v2/d6-diagnostics?planId=plan:19cad189fab54b9c804a74a6` (phase
  surface 2); `GET /v2/generation/capabilities` (phase surface 1,
  generation state, Batch still `batch_not_armed`); `GET
  /v2/d6-plans/plan:19cad189fab54b9c804a74a6`; `GET
  /v2/jobs/plan:19cad189fab54b9c804a74a6:seg`; `GET
  /v2/d6-quota-reconcile`; `GET /v2/quota`; `GET
  /v2/sync/changes?family=content` and `?family=bindings` since
  the closing watermarks; `GET /health`; plus the cf-api script
  settings read (GENERATION_HALT still `"1"`) and the cf-api queue
  read (still paused) — the holds verified on their own surfaces,
  as at census.
- **Classifications:**
  - **POST-GATE-QUIET** — every marker at its closing value, or
    moving only inside the in-set forms the closing record names:
    the chain registered and passes running under the holds with
    grant churn confined to the §7.3 set (one live grant at a time,
    reserved at the cohort figure, dispatched 0, $0), or the chain
    silent with every other marker frozen at the matching values
    (the W-4 form, classified as observation, never as resolution).
    Logged in the duty's log; reported briefly — in-set
    continuation is a log line, not an escalation.
  - **POST-GATE-MOVEMENT** — **any** marker outside the closing
    values and outside the in-set forms: any dispatch or settled
    movement; a binding or content change; a plan/job state change
    beyond churn; a hold, build, settings, or queue change; a
    containment transition; a recorder error row attributable to
    this plan. (A late first delivery after a wake-failure close is
    recorded under this duty as a tail-observation fact per GR-7 —
    POST-GATE-QUIET if its effects stay inside the §7.3 set, and
    reported in the check's log either way.)
- **Escalation:** a POST-GATE-MOVEMENT check is reported
  **immediately** — to Julie in the Coding Projects chat and as a
  record on the Roundtable board — with the raw reads preserved.
  The duty **never acts**: no command, no transition, no hold or
  queue change, no wake. Any response is a future authorization's
  business. A check whose reads fail (e.g., a 1101-form outage) is
  recorded as an unobserved check with its evidence, under the
  window's discipline — never read as quiet.
- **Termination:** the **earlier of** (a) Rowan's acceptance of this
  gate's execution record on documentary review, or (b) **14 days
  after gate close**. At termination the job is **disabled**
  (history preserved) and the termination — which condition fired,
  the final check's classification, and the closing marker values —
  is **reported** to Julie and recorded. Any extension is a ruling,
  not inertia.

---

## 9. Exact proposed GO wording (for Julie's future decision — NOT requested here)

This wording **supersedes the package §6 wording** for this gate:
the package's form contemplated proceeding "against whichever
branch the execution census verifies (GR-A …, or GR-B … with
Rowan's OQ-2 ruling in hand)". No OQ-2 ruling is in hand, GR-5
holds GR-B blocked, and §4.2–4.3 of this confirmation establish the
position the wording must carry. When Julie chooses to authorize
one resume attempt — after Rowan's final readiness ruling on this
confirmation — the operative wording proposed is:

> "GO — execute exactly one generation-resume attempt as pinned at
> `<CONFIRM-PIN>`: fresh execution census on both phase surfaces,
> with the script etag captured and saved as an evidence artifact
> before any wake decision, against the post-restoration baseline
> the confirmation censuses; the attempt proceeds **only if the
> census verifies branch GR-A's predicates exactly** (package
> §4.1) — if the census reads the §7.3 churn state, or any state
> matching neither branch, the attempt does not proceed and returns
> for ruling (branch GR-B remains blocked while OQ-2 stands open;
> no branch is selected in advance); a fresh read-only voice
> checkpoint (Alex → Gemini Charon, quote digest `cdef2c7e…`);
> exactly one wake — a single fresh `RequestPause` probe against
> `alarm-wake-probe:nonexistent`, counted as one production
> command, verified only by an observed recorder-row effect within
> the ruled 15-minute bound — never a second wake, never a
> deploy-as-stimulus; then one halt lift and one queue unpause, in
> that order; the post-unpause verification protocol with its
> sliding 35-minute stall window, the adopted three-hour review
> checkpoint from dispatch, and abort condition A-7 (a post-lift
> recorder discrepancy re-holds and returns for review, a completed
> segment standing as completed-with-discrepancy); **NO SubmitJob
> of any scope — ever — NO exemption call, NO containment
> transition, NO Batch, NO rest-of-book, NO other generation**;
> counted production commands ≤ 5 on every path; the segment's
> expected cost ≈ $0.008, the 12,808-unit forecast line and the
> 25,000-unit detection threshold standing as deviation signals,
> never caps, with the Gemini prepay balance as the physical
> backstop; on success, abort, checkpoint, or wake failure alike,
> re-pause and re-halt so the attempt ends HELD, exposure reported
> in the three-line form, and the named post-gate observation duty
> opened at close. I understand no pre-unpause grant verification
> exists or is claimed — the holds are the pre-unpause containment
> and verification attaches to the grant as the first observable
> effect after the lift; that success ends with exactly one new
> binding and the bindings watermark at 1842, and that my playback
> check — the chapter header reading 'Complete 27/27' — is the
> acceptance, outside the executor's verdict; that one GO covers
> one attempt, and a stall, an abort, or a checkpoint consumes it;
> and that restoration was authorized, executed, and closed
> separately, before this GO."

The GO is recorded on the board before the execution census (the
established ordering). Rowan's ruling on this confirmation is not a
GO; this filing requests no GO. The end-state alternative in the
package §6 form (holds left lifted on success) is **not** carried
into this wording: silence means HELD, and any lifted end state
would need Julie's express words in place of the ends-HELD clause.

---

## 10. What remains, and what this confirmation does not do

**The chain from here, in order:**

1. **Rowan's final readiness ruling** on this confirmation —
   including the branch question (§4.3) and the GR-3 application
   (§5.3), the observation duty (§8), and the GO wording (§9).
2. **Julie's separate GO** for this gate, in §9's wording (or her
   amendment of it), recorded on the board before the census.
3. **Execution** under §§3.3–7 — one attempt, consumed by its
   outcome on every path.
4. **The execution record**, filed for Rowan's documentary review
   (the §8 duty terminating at her acceptance or 14 days).
5. **Julie's playback acceptance** — the chapter end, expected
   header "Complete 27/27" — outside every executor verdict.

**This confirmation does not:** authorize any wake, hold lift,
dispatch, or generation; execute or request the GO; select a
branch; resolve OQ-2 (it states the question and the block);
resolve the W-4 (an unresolved observation whose registration no
longer exists); claim the wake will deliver in the post-stop,
post-clear state (no live precedent exists — GR-1's strength);
claim runtime adoption, platform alarm reliability, or any property
beyond the reads cited; or touch the preserved plan, the idx-26
exemption, the parked job, Batch, or any other book.

**Contents of this filing:** this confirmation
(`PHASEB-GENERATION-RESUME-FINAL-READINESS-CONFIRMATION.md`) +
verbatim sequential parts (exact-concat) + the companion cp
(`PHASEB-RESUME-FINAL-CONFIRMATION-ROWAN-CP.md`) + the baseline
census artifacts (`resume-confirmation-baseline/`, 18 files), under
one pin (`<CONFIRM-PIN>`).

**Turn: Rowan's** — final readiness review. Julie's GO is a later,
separate turn, unrequested here.

— Wren
