# PHASE B — STANDALONE RESTORATION: READINESS PACKAGE

**Gate:** standalone restoration — the return of containment from
`CHAIN_STOPPED` to `NORMAL` by exactly one reasoned `clear`.
**Status:** READINESS ONLY. This package authorizes nothing, executes
nothing, and was prepared with no production calls. It seeks (i) Rowan's
ruling on restoration readiness and (ii), only after that ruling, Julie's
separate GO in the wording at §6.
**Production state at drafting:** HELD in `CHAIN_STOPPED` (Gate C3,
branch (d), EXECUTED AND CLOSED at PARTIAL strength); GENERATION_HALT
`"1"`; queue `opalreader-generation-v2` delivery paused; the preserved
Phase B plan and the idx-26 chapter exemption untouched.
**This package's pin** is carried in the companion CP's `<RESTORE-PIN>`
slot (a document cannot name its own commit).

**Authority chain for this gate:**

| # | Link | Reference |
|---|---|---|
| 1 | Containment design v4 REVISED — restoration policy (§6), episode law (§4.2), truth model (§2.3) | `PHASEB-CONTAINMENT-DESIGN-V4-REVISED.md` |
| 2 | Recovery gates v4 REVISED — "Standalone restoration authorization (NOT a gate; decision 2)" | `PHASEB-RECOVERY-GATES-V4-REVISED.md` |
| 3 | V4 corrections round — Rowan PASS (V4-1 historical-review strengthening accepted) | `ROWAN-V4-CORRECTIONS-PASS.md`; corrections package pin `621535f0456e3d61cc7bcbc2fda04f661dc63e49` |
| 4 | Gate C3 execution record (the episode this gate closes) | `PHASEB-C3-EXECUTION-RECORD.md`, pin `b4727c408f6c446a94466594ea2cc7c59d11de8d` |
| 5 | Rowan ruling on the C3 execution record, §A — restoration prerequisites stated; **no restoration authorized** | `ROWAN-C3-EXECUTION-OQ36-RULING.md` (board verbatim comment 6675293356) |

---

## 1. Scope and separateness

### 1.1 What restoration is

Restoration is exactly one operator act: a reasoned `clear`
(`POST /v2/d6-containment {action:"clear", authorizationRef, reason}`)
that takes the containment state from `CHAIN_STOPPED` to `NORMAL` and,
inside the same commit transaction, **closes stop episode 3** — copying
its summary into the state row's `prevEpisode*` fields and appending the
`stop_episode_closed` audit event before the current-episode fields
reset (design v4 revised §4.2; the deployed composed source implements
exactly this sequence). It is the only exit from `CHAIN_STOPPED` the
design provides: "no automatic clear anywhere; NORMAL return only via an
explicit standalone authorization, a fresh census, and a demonstrated
reason" (design v4 revised §6, carrying v3 §5).

### 1.2 What restoration is NOT

- **Not a re-arm.** The `clear` touches no alarm API. C3's `stop_chain`
  deleted the standing registration; after restoration `armedAt` remains
  **null** — no registration exists, and none is created by this gate.
  The first subsequent wake can occur only through the ordinary wake
  paths under NORMAL, inside a future authorized gate (gates v4 revised,
  standalone restoration section: "The clear does not re-arm: the
  registration stays absent").
- **Not a hold lift.** GENERATION_HALT (a Worker binding) and the queue
  delivery pause (a Cloudflare queue setting) are separate states that
  this gate reads as preconditions and never touches. The system ends
  restoration exactly as held as it began: HELD at NORMAL.
- **Not generation, and not the resume gate's wake.** No SubmitJob, no
  command, no stimulus, no probe of any kind is sent by this gate. The
  generation-resume gate's wake remains that gate's own ruled mechanism
  (the GR-1 probe design, accepted in principle, executed only under
  that gate), and restoration neither performs it nor substitutes for it.
- **Not part of C3, and not bundled with anything.** C3 ended
  CHAIN_STOPPED **by design**; its in-gate `clear` (C3-3) applied only to
  the DRIVE_CONTAINED mechanics leg and was expressly not a restoration
  (C3 package §2; gates v4 revised, "Restoration rules"). Restoration is
  a standalone authorization in the gate ladder — after C3, before the
  generation-resume gate — and is never a step inside either.

### 1.3 Preconditions, and where each is discharged

| Precondition | Source | Discharged by |
|---|---|---|
| Rowan's ruling on this readiness package | Ruling §A ("No restoration is authorized by this ruling") + gates v4 revised | Rowan's review of this package — **sought here** |
| Julie's separate explicit GO | Gates v4 revised (named approval by Julie after Rowan's review) | §6 wording, presented only after Rowan's ruling |
| Fresh census at execution start | Gates v4 revised; design v4 revised §6 | §3 (the fresh closing-state confirmation, run as this gate's preflight census — see §7, Q-1 for the proposed reading) |
| The fresh census CORROBORATES the stop record — registration absent, `stopConfidence` derived fresh at `verified_current`; a contradiction stops the gate on the record's word alone never sufficing | Gates v4 revised (V4-2 correction) | §3 STOP rules |
| A demonstrated reason, recorded in the `clear` audit event | Design v3 §5 as carried by design v4 revised §6; gates v4 revised | §4.2 (drafted reason, quoted in the GO) |
| **Mandatory historical audit review**, enumerating EVERY stop episode in the append-only history with its exhaustion status; R3-V naming for any exhausted episode | Design v4 revised §6 (V4-1); C3 package §2; ruling §A | **§2 of this package** (performed documentarily here; re-confirmed against the fresh surfaces at execution) |
| Stop-record precondition: the stop stands `verified` | Design §5.3 preconditions via C3 package §2 | C3 record §3.5 (`stopStatus "verified"`, attempt 1) + §3 fresh derivation |
| Episode disclosure: current episode id + exhausted flag, previous-episode summary if any | Design v4 revised §6; gates v4 revised | §2.2 — current episode **3**, `stopEpisodeExhausted: false`; previous-episode summary **none** (all `prevEpisode*` fields null — no episode has ever closed) |

**Exhaustion / R3-V check, stated expressly:** no episode in the history
is exhausted (episode 3 verified at attempt 1 of a bound of 3;
`stopEpisodeExhausted: false`). The design §6 requirement to name an
R3-V authorization therefore **does not arise** for this restoration.
If the §3 confirmation were to read any exhaustion fact differently,
that would be a deviation and a STOP under §3.3, not a detail to absorb.

---

## 2. Historical audit review — the mandatory precondition, performed

Design v4 revised §6 makes this review a precondition of the
authorization itself: the restoration request must rest on a review of
the FULL append-only audit history (`d6_containment_events`), enumerating
every stop episode the history contains. Rowan's ruling (§A) fixes this
review's required contents for this gate: **episode 3, all four reported
transitions, and the rejected C3-1 request.** This section performs the
review documentarily, at exactly the strength the evidence supports.

### 2.1 What the review rests on — and what it cannot independently show

The review rests on three mutually corroborating sources:

1. **The transition responses in the C3 execution record** (record pin
   `b4727c40…`; raw evidence `c3-execution/` files `s1`, `s1b`, `s2`,
   `s3`, `s4`, `s5`). Each applied transition's response carries the
   post-transition state read, including `updatedAt` and the recorded
   `authorizationRef` — so each audit row's existence and position is
   evidenced by the act that wrote it, not merely asserted.
2. **The state row's stop-record fields**, read at C3-7 on both surfaces
   and agreeing in every field (record §3.7), and to be re-read at this
   gate's §3 confirmation: `stopEpisodeId 3`, `stopVerifyAttempts 1`,
   `stopEpisodeExhausted false`, `stopStatus "verified"`.
3. **The episode arithmetic.** Episode 3 is keyed by its `stop_chain`
   audit-event row id (design §4.1: the episode id is captured from
   `last_insert_rowid()` in the committing transaction). The stop commit
   therefore IS audit row 3 — which requires exactly two prior rows in
   the table. The C3 census (record §2.2, D-5) established the state row
   **absent** on both surfaces immediately before C3-1; under the design
   the tables bootstrap lazily (DDL-only, at first touch — read or
   transition) but reads never write rows or state, so the table's
   entire row contents at gate end were exactly the rows C3's own
   transitions wrote.

**The limitation, at the strength Rowan accepted.** No read surface in
the established read set enumerates `d6_containment_events` rows
directly (C3 record E-6). This review therefore reconciles the four rows
by the transition responses, the `updatedAt` chain, the episode
arithmetic, and both-surface agreement at every step read-back and at
closing — it does **not** present a literal row-by-row audit-table
listing, and no sentence in this package claims one. Rowan accepted the
audit-table accounting at exactly this narrowed strength (ruling §A:
the narrowed claims "were not independently verified by the submitted
evidence" and are not to be represented as directly audited). Whether
Rowan requires a literal audit read before ruling on THIS package —
for which no established surface exists — is put to her as Q-2 (§7)
rather than papered over.

### 2.2 Episode enumeration (from the history as reconciled)

| Episode | Opened by | Attempts | Exhausted | Status at drafting |
|---|---|---|---|---|
| **3** | `stop_chain:applied`, audit row 3, 2026-11-06T02:24:06Z send | **1** of bound 3 (the stop act itself; no `verify_chain_stop` was ever called) | **No** | **OPEN** — no `stop_episode_closed` event exists; the only `clear` in history precedes the episode |

**This is the only episode the history contains.** No episode 1 or 2
exists (the id 3 is the audit-row id of the stop commit, not an episode
counter — the two earlier rows are the mechanics-leg transitions). No
episode has ever been exhausted, closed, or overwritten in the
`prevEpisode*` summary (all `prevEpisode*` fields read null at C3-7).
The R3-V naming requirement (design §6) is therefore not triggered —
stated here expressly, as §6 requires the disclosure either way.

### 2.3 The four reported transitions

All four carried `authorizationRef` `"Gate C3 branch (d) — Julie GO,
board comment 6675116603"` (record §3 preamble). Times are the send
times in the execution evidence; `updatedAt` values are the state row's
as returned in each response.

| Audit row | Event | Sent (UTC) | Transition | Evidence |
|---|---|---|---|---|
| 1 | `contain_drive:applied` | 2026-11-06T02:23:44Z (the re-send — §2.4) | NORMAL → DRIVE_CONTAINED; state row + audit table created by this transition; `updatedAt 1793931825315` | Record §3.1; evidence `s1b`; read back agreeing on both surfaces at C3-2 (record §3.2) |
| 2 | `clear:applied` | 2026-11-06T02:23:53Z | DRIVE_CONTAINED → NORMAL; `updatedAt 1793931834501`; **reason recorded: "Gate C3 mechanics leg: restore opening state"** (the operative ledger's exact string); no episode event — no stop episode was open | Record §3.3; evidence `s3`; read back at C3-4 (record §3.4) — this clear was a mechanics-leg reversal inside C3, **not** a restoration |
| 3 | `stop_chain:applied` | 2026-11-06T02:24:06Z | NORMAL → CHAIN_STOPPED; **mints episode 3** (episode id = this row's id) | Record §3.5; evidence `s5` |
| 4 | `stop_chain_verify:verified` | inside the C3-5 act (same send) | The act's verification record: observed `stopArmedBefore 1793826389431` (the adopted standing value), `deleteAlarm()` ×1, read-back null → `stopArmedAfter null`; `stopStatus "verified"`, `stopVerifiedAt 1793931847431`, `stopVerifyAction "stop_chain"` | Record §3.5 |

Totals reconciled against the C3 record §4: state writes 4, audit rows
4, `deleteAlarm` 1, `setAlarm` 0, $0 — the §3.1 no-failure expectation,
exact.

### 2.4 The rejected C3-1 request — part of the historical record

Per ruling §A, the review includes it expressly:

- **Sent 2026-11-06T02:23:12Z** — the first C3-1 send, body
  `{action:"contain_drive"}` in the operative ledger's abbreviated
  notation. **Rejected pre-act, HTTP 200
  `{"outcome":"rejected","reason":"authorization_ref_required"}`,
  writing nothing** (evidence `s1`; record §3.1). The deployed route's
  closed allowlist requires a nonblank `authorizationRef` on every
  containment transition; the abbreviation omitted it. Rowan accepted
  the classification — a pre-act request-form rejection, not a state
  mutation or intervening drive movement (ruling §A).
- It is **not an audit row**: route validation refused it before any
  store touch, and refused transitions append nothing (design:
  rejection paths are write-free). Its place in the history is as a
  route act with no audit event, evidenced by the response and the
  executor's timestamp files — accounted here so the history's
  completeness claim (§2.5) covers every containment-route act, not
  only the applied ones.
- The corrected re-send (02:23:44Z, 32 s later) carried the
  `authorizationRef` and applied as audit row 1. Both sends remain part
  of the historical record; neither is edited out of this review.

### 2.5 Completeness argument

The containment state row **did not exist** before
2026-11-06T02:23:44Z (census D-5: state row absent on both surfaces).
If the tables themselves already existed — they bootstrap lazily on
first touch, reads included — they held no rows: no containment
transition of any kind had ever run in production before C3 (C1
deployed the machinery and verified it inert; it ran no transition). Every
containment-route act since creation is therefore one of the acts
enumerated in §§2.3–2.4: one rejected send (no write), four applied
transitions (four audit rows), and no other act — in particular **no
`verify_chain_stop` call** (its absence is itself reconciled:
`stopVerifyAttempts` reads 1, the stop act alone) and **no second
`stop_chain`** (a second stop would have minted a second episode; the
state row carries exactly one, id 3). The §3 confirmation re-reads the
state row before execution; any fact there inconsistent with this
review (a different episode id, an attempt count other than 1, an
exhaustion flag set, a `prevEpisode*` field populated) would falsify
the completeness claim and is a STOP under §3.3 — the review is
falsifiable at execution, not merely archival.

### 2.6 Reconciliation statement

**The audit history, as it can be read today, is COMPLETE and
CONSISTENT.** Episode 3, all four reported transitions, and the rejected
C3-1 request account for every containment-route act since the tables
were created. Timestamps, `updatedAt` values, authorizationRefs, the
clear's reason, and the episode arithmetic agree across the transition
responses, the execution record, and both read surfaces at closing. **No
inconsistency was found.** The single structural limitation — no direct
audit-table read surface exists in the established read set — is carried
at the narrowed strength Rowan accepted in ruling §A and is put to her
again as Q-2 for this gate.

### 2.7 Forward accounting — what restoration will add to the history

So Rowan can see the history's expected post-restoration shape before
ruling: the §4 `clear` appends **audit row 5** (`clear:applied`, detail
carrying the restoration reason) and **audit row 6**
(`stop_episode_closed`, outcome `closed`, detail carrying
`{episodeId: 3, attempts: 1, exhausted: false, finalStopStatus:
"verified", reason}`) inside its single commit transaction (design
§4.2; gates v4 revised budget, §4.4 below). After restoration, the
history's enumeration for any future review is: rows 1–4 as above, row
5–6 the restoration close of episode 3, and the `prevEpisode*` summary
holding episode 3 until a future authorized clear overwrites it
(Tier 2) — the full history remaining permanent in Tier 1 regardless.

---

## 3. Fresh closing-state confirmation — preflight read set and expectations

Ruling §A requires, before restoration execution, "a fresh read-only
closing-state confirmation, including both containment surfaces, alarm
registration, production holds, plan and job state, and available build
identity." The gates text requires "a fresh CENSUS executed at its
start." This package reads the two together (§7, Q-1): **the
confirmation IS this gate's preflight census** — one complete read-only
set, run in the execution session immediately before the `clear`, whose
values the §4 ledger's R-0 step checks item by item. No value in this
section is inherited from the C3 record as fact; every expected value
below is the C3 closing value stated as an **expectation to match**,
and the confirmation re-reads each one fresh.

All `/v2/*` reads carry the production scope and instance headers.
Operator reads use the operator connector; client reads the client
connector; Cloudflare reads use `cf-api` (account
`b35ff435ff24d134ff640e0099dd13fc`). Every read is a GET; no read in
this set wakes, writes, or creates tables.

### 3.1 The read set

**Containment + alarm (the ruling's core):**

| # | Read | Surface |
|---|---|---|
| 1 | `GET /v2/d6-containment` (operator) | Containment surface 1 — state row projection |
| 2 | `GET /v2/d6-diagnostics?drive=1` (operator) | Containment surface 2 — drive projection + alarm block + recorder |
| 3 | `GET /v2/d6-diagnostics?planId=plan:19cad189fab54b9c804a74a6` (operator) | Phase B plan + phase accounting (surface b) |

**Holds, build identity, queue:**

| # | Read | Surface |
|---|---|---|
| 4 | `GET /health` | Build marker, generation state, coordinator state |
| 5 | `cf-api GET /client/v4/accounts/{acct}/workers/scripts/opalreader-api-v2-prod/settings` | Bindings (GENERATION_HALT), observability |
| 6 | `cf-api` script GET — **etag method at §3.2** | Script identity (closes C3 note E-1) |
| 7 | `cf-api GET /client/v4/accounts/{acct}/queues/93b6a35fb8cf4788a91a2c90b748ae66` | Queue `delivery_paused`, consumers |

**Plan, job, money, registry:**

| # | Read | Surface |
|---|---|---|
| 8 | `GET /v2/generation/capabilities` (client) | Phase accounting (surface a) + Batch state (closes C3 note E-2's surface gap for this gate) |
| 9 | `GET /v2/d6-plans/plan:19cad189fab54b9c804a74a6` (client) | Preserved plan state |
| 10 | `GET /v2/jobs/plan:19cad189fab54b9c804a74a6:seg` (client) | Phase B job + grants |
| 11 | `GET /v2/jobs/1832c21fcf0425454227c4736048a8a632f422abca4a2685ddb775bb1681406a` (client) | Parked Ch 3 job |
| 12 | `GET /v2/d6-quota-reconcile` (operator) | Reconcile ok, exceptions, dispatched totals |
| 13 | `GET /v2/quota` (client) | Settings revision, today's attempts |
| 14 | `GET /v2/conflicts` (client) | Conflicts baseline |
| 15 | `GET /v2/sync/changes?family=content&sinceSeq=18` and `?family=bindings&sinceSeq=1841` (client) | Watermarks |
| 16 | `GET /v2/d6-eligibility?bookId=5c589095-f812-48a2-8ab2-03ba2791f2b2&scope=chapter&chapterIndex=2` and `&scope=book` (client) | Definition-digest corroboration |

### 3.2 Build identity — the etag method (closing E-1)

C3's census identified the build by the `/health` marker and the
settings surface only, because its read set contained no script-content
GET (record E-1). This gate's confirmation closes that gap:

- The `/health` build marker must read
  `fdb02395b3775dc945baa395591a73060ab146c4` (read 4).
- The script etag is read from the **response headers** of
  `GET /client/v4/accounts/{acct}/workers/scripts/opalreader-api-v2-prod`.
  The stock `cf-api` envelope prints only `{status, body}` and does not
  surface headers, so this read is made with the connector's own
  credential mechanism — an in-process GET built with
  `dynamic_credentials.add_surrogate_to_request(..., "custom.cloudflare",
  entry_name="access_token", allowed_hosts=("api.cloudflare.com",))`,
  the same surrogate pattern the connector CLIs use — taking the
  `etag` response header (quoted; quotes stripped before comparison).
  Expected: **`bb90f18223e1802e1c417f17359f344499dc2d29c78e54db259f6f9ae4ac5c9e`**
  (the Grant 1 build's etag, the value C3's census carried as its
  expectation). A different etag is a deviation and a STOP: it would
  mean the deployed script changed since C3, which no authorized act
  since C3 can explain.

### 3.3 Expected values — and the STOP rule

Every item below must match **exactly**; the values are the C3 closing
census values (record §§3.7, 6) restated as expectations.

| Item | Expected |
|---|---|
| Containment (reads 1 AND 2, agreeing in every field) | state `CHAIN_STOPPED`; `known: true`; `absent: false`; `verified: true`; `updatedAt 1793931847431`; `authorizationRef` "Gate C3 branch (d) — Julie GO, board comment 6675116603"; `stopStatus "verified"`; `stopVerifiedAt 1793931847431`; `stopVerifyAction "stop_chain"`; `stopArmedBefore 1793826389431`; `stopArmedAfter null`; `stopVerifyAttempts 1`; `stopEpisodeId 3`; `stopEpisodeExhausted false`; all `prevEpisode*` fields null |
| Derived confidence (both surfaces, from read 1/2's own fresh alarm observation) | `stopConfidence "verified_current"` — the V4-2 corroboration: the fresh reads re-observe the registration absent and derive confidence fresh; the C3 record alone does not carry the stop into this gate |
| Alarm block (read 2) | `armedAt null`; `pendingSchedule 2`; `pendingWatchdog 1` (schedule rows preserved) |
| Recorder (read 2) | table populated; latest row id **296** @ `1793825819071`; no row after 296; `recordingFailures 0` |
| Health (read 4) | build `fdb02395b3775dc945baa395591a73060ab146c4`; generation `halted`; coordinator `armed`; scope `production` |
| Script settings (read 5) | GENERATION_HALT `"1"`; exactly 10 bindings (the C3 census set); `OPALREADER_PHASE_POLICY "enforce"`; observability enabled with logs enabled + persisted; `compatibility_date 2026-08-29` + `nodejs_compat` |
| Script etag (read 6) | `bb90f18223e1802e1c417f17359f344499dc2d29c78e54db259f6f9ae4ac5c9e` |
| Queue (read 7) | `delivery_paused: true`; exactly 1 consumer (`f260f2188d80426bb0588685e9d084eb`); retention 86,400 s |
| Phase accounting (reads 8 AND 3 — BOTH surfaces, enumerated per the C2 lesson) | settled **1,029,420**; estimatedUnverified **19,018**; reservedUnverified **5,648**; inFlightUpper **0**; unknownOpen **0**; remaining **12,464,932** of 13,500,000; `provider_unverified` |
| Capabilities (read 8) | Standard admitted; Batch `batch_not_armed`; registry `forever-pucked` ↔ bookId `5c589095-f812-48a2-8ab2-03ba2791f2b2` |
| Preserved plan (read 9) | `plan:19cad189fab54b9c804a74a6` `active`, totals {eligible 1, done 0, failed 0, blocked 0}; sole entry (chapterIndex 2, occurrence `2a85f74f-353d-4c25-a86a-4a4db392868b`, 569 chars) `granted`; quarantine `held: false` |
| Phase B job (read 10) | `generating`, revision **88**; 87 grants — 86 `voided` (seg:1–86) and exactly one live: `grant:plan:19cad189fab54b9c804a74a6:seg:87:full` `issued` |
| Parked job (read 11) | `parked_policy`, revision **1**, grants `[]`, occurrence composition as at C3 (the stored fingerprint string is not exposed on this surface — C3 note E-5's narrowed strength carries; this gate does not claim a fingerprint byte-compare either) |
| Quota (reads 12, 13) | reconcile `ok: true`, `armed: true`, drift empty, sole exception the adjudicated straddler `att-37d63768-db4b-447d-8150-580b7c6ee257`; dispatched 0 for every PT day after 2026-11-01; settings revision **1** |
| Conflicts (read 14) | exactly the 4 baseline `schedule_dead` lease rows (ids 1–4, all fields as pinned) |
| Watermarks (read 15) | content **18**, bindings **1841**, zero changes on both |
| Eligibility (read 16) | definition digest `cdef2c7ec7bb8434b4e2fac66af49983ac7fa4b4e65bb0eda40354be51ff52d1` on both scopes read |

**STOP rule.** Any deviation from any item — a value different in any
field, a surface disagreement, a failed or unreadable read on either
containment surface, or an unreadable record of any kind — **stops the
gate before the `clear` is sent.** The system remains CHAIN_STOPPED;
the deviation is preserved with its raw reads and returns for ruling.
Two deviations are named in the governing texts and are stated here at
full strength:

- **A registration present** (`armedAt` non-null on any fresh read) or
  **`stopConfidence` below `verified_current`** on either surface: the
  fresh census contradicts the C3 record, and the restoration "does not
  proceed on the record's word: STOP and classify" (gates v4 revised,
  V4-2). In particular, `contested` (truth-table row 4) would mean a
  registration physically survives or reappeared — a finding for Rowan,
  not a restoration input.
- **Any §2 falsifier**: an episode fact inconsistent with the historical
  review (§2.5) ends the gate on the review, before any act.

There is no re-read-until-it-matches: a confirmation that fails is a
finding, and a new attempt requires a new ruling and a new GO.

---

## 4. Execution ledger

Exactly one state-changing act exists in this gate. The ledger is:

| Step | Act | Writes |
|---|---|---|
| R-0 | Fresh closing-state confirmation (§3 read set, all 16 reads) — preflight census | 0 |
| R-1 | `POST /v2/d6-containment {action:"clear", authorizationRef: <§4.1>, reason: <§4.2>}` — **sent exactly once** | §4.4 |
| R-2 | Read-backs on both surfaces (reads 1 and 2 repeated) | 0 |
| R-3 | Closing confirmation (the full §3 read set repeated) — delta check against R-0 | 0 |

### 4.1 The authorizationRef

Per the gates text, the act is `{action: "clear", authorizationRef:
<restoration record ref>, reason: <demonstrated reason>}`. Following
the C3 pattern, the ref names Julie's authorization as recorded:
**`"Standalone restoration — Julie GO, board comment <GO comment id>"`**,
with the comment id filled at execution from the board record of the
§6 GO (the GO is recorded on the board before execution, as C3's was).
The ref is part of the audit event and of the state row's recorded
`authorizationRef` after the act; it is not a free-text field to
improvise at send time.

### 4.2 The recorded reason — DRAFTED, for Rowan's and Julie's visibility

The reason is a Julie-visible decision artifact: it is stored verbatim
in the `clear:applied` audit event and in the `stop_episode_closed`
event's detail, permanently. The route requires it nonblank and ≤ 2,000
characters (design: reason-required clear, enforced at route and method
level). **Drafted text** (presented to Julie inside the §6 GO wording;
Rowan is asked to review it as part of this package):

> "Standalone restoration of containment after Gate C3 (branch (d)),
> executed and closed with the stop verified (episode 3, verified at
> attempt 1; Rowan documentary review PASS AT PARTIAL STRENGTH). The
> stop's purpose is complete: the standing W-4 registration is deleted
> and read back null, no drive pass has occurred since pass 296, and
> the chain stands frozen under a verified stop record. CHAIN_STOPPED
> is no longer needed: the generation-resume gate requires NORMAL as
> its opening state and carries its own separately ruled wake. This
> clear returns containment to NORMAL only — it re-arms nothing (no
> alarm registration stands after it), lifts no hold (GENERATION_HALT
> remains "1"; the generation queue remains paused), and authorizes no
> generation."

Drafted length ≈ 750 characters, inside the route bound. If Rowan or
Julie amends the reason, the amended text is what R-1 sends and what
the GO names — the executor does not edit it at send time.

### 4.3 Expected result of R-1 and the post-clear state, field by field

Expected response: HTTP 200, `{"outcome":"applied","action":"clear",
"state":"NORMAL","idempotent":false}`, with the post-clear state read.
Inside the single commit transaction (design §4.2; deployed composed
source), the act: sets the state row to NORMAL with the new
`updatedAt` and the §4.1 `authorizationRef`; appends `clear:applied`
(detail: the reason); copies the episode summary into `prevEpisode*`
and appends `stop_episode_closed`; then resets the current-episode
stop-record fields — atomically, so no read can observe a reset record
without the preserved summary.

Expected post-clear state, as R-2/R-3 must read it on **both** surfaces:

| Field | Expected after R-1 | Basis |
|---|---|---|
| `state` | `NORMAL` | the act |
| `known` / `absent` / `verified` | `true` / `false` / `true` | the row persists (a clear restores the state, it does not un-create the row) |
| `updatedAt` | the clear's timestamp (new; after 1793931847431) | the commit |
| `authorizationRef` | the §4.1 restoration ref | the commit records the last transition's ref |
| `stopStatus` | `null` | stop-record reset inside the commit (design §4.2) |
| `stopVerifiedAt` | `null` | reset — the verified fact survives in the audit history and in `prevEpisode*`/the C3 record, not in the current-episode fields |
| `stopVerifyAction` | `null` | reset |
| `stopArmedBefore` | `null` | reset |
| `stopArmedAfter` | `null` | reset |
| `stopVerifyAttempts` | `0` | reset |
| `stopEpisodeId` | `null` | reset — episode 3 is closed, not current |
| `stopEpisodeExhausted` | `false` | reset |
| `prevEpisodeId` | **3** | episode-close summary copy |
| `prevEpisodeAttempts` | **1** | summary copy |
| `prevEpisodeExhausted` | **false** | summary copy |
| `prevEpisodeClosedAt` | the clear's timestamp | written inside the same transaction from its own `now()` call — expected at the clear's time; bit-equality with `updatedAt` is **not** asserted (the source takes the timestamp per statement, so a millisecond difference would not be a deviation) |
| `stopConfidence` | **`not_applicable`** on both surfaces | truth-table row 1: a readable record with a non-stopped enum — no stop exists for a present-tense confidence to describe. The historical fact "episode 3 was verified" lives in Tier 1 (audit), Tier 2 (`prevEpisode*`, until a future authorized clear overwrites it), and the C3 record |
| Alarm block | `armedAt null`; `pendingSchedule 2`; `pendingWatchdog 1` | the clear touches no alarm API; schedule rows preserved |
| Everything else (R-3 vs R-0) | bit-identical: recorder 296 rows, plan/job/grant frozen as censused, phase, quota, conflicts, watermarks, holds, queue, build, etag | the gate's only delta is the containment row and its two audit rows |

### 4.4 Mutation budget

**Expected (no-failure path), per gates v4 revised:** **state writes 1**
(the single commit transaction on the singleton row — state to NORMAL,
summary preserved, record reset, as one atomic fact), **audit rows 2**
(`clear:applied` + `stop_episode_closed`), `deleteAlarm` 0, `setAlarm`
0, commands/reports/SubmitJob/uploads/hold flips/queue changes 0,
**$0**.

**Worst case is the same bound.** R-1 is sent exactly once and is never
re-sent in any branch (§4.5); the transaction is atomic — it either
committed once (1 write / 2 rows) or not at all (0 / 0). No failure
branch of this gate can multiply writes.

### 4.5 Failure branches

- **Confirmation deviation (R-0):** STOP before any POST (§3.3). Zero
  writes; the system remains CHAIN_STOPPED; return for ruling.
- **R-1 rejected:** refused transitions write nothing (validation and
  the transition table refuse before the commit). The expected refusal
  shapes are named so they are recognized, not retried: a blank or
  over-long reason → `containment_reason_required` /
  `containment_reason_too_long` (cannot arise if §4.2 is sent as
  drafted); a state other than CHAIN_STOPPED at send time →
  `containment_transition_refused` (itself a deviation finding — the
  confirmation read CHAIN_STOPPED minutes earlier). Any rejection:
  STOP, classify, return for ruling. **No corrected re-send inside this
  gate** — if the paperwork's form is again at fault (the C3-1 lesson),
  that is a finding for a new ruling, not an in-gate repair.
- **The idempotent-applied trap:** if the state were already NORMAL at
  send time, the source returns `{"outcome":"applied",
  "idempotent":true}` **and appends an audit row** for the no-op. That
  response is **not** this gate's clear: it would mean the §3
  confirmation was contradicted between R-0 and R-1. It is classified
  as a deviation, the gate STOPs, and the extra row is reported as part
  of the finding. The expected R-1 response has `idempotent: false`.
- **R-1 response lost or ambiguous** (timeout, HTTP 500, response not
  captured): the §R re-entry rule applies (gates V4-2: recorded logical
  completion ≠ physical verification; an ambiguous outcome stays
  UNRESOLVED until a fresh live read resolves it). Re-enter by reading
  both surfaces fresh: if the state reads NORMAL on both, with
  `prevEpisodeId 3` and the §4.1 `authorizationRef` recorded, the clear
  is RECORDED-complete (a pure state-write step's completion criterion
  is the recorded state itself, read back consistently — the C3 §R
  step-3 rule) and the gate proceeds to R-3 without any second send. If
  the state still reads CHAIN_STOPPED, the transaction did not commit
  — the gate is STOPPED-unresolved and returns for ruling; **R-1 is not
  re-sent** (a re-send after a possibly-committed act is how duplicate
  rows happen, and a re-send landing on NORMAL would write the
  idempotent row of the trap above). If the surfaces disagree, the step
  is UNRESOLVED: STOP and classify.
- **Post-clear read-back deviation (R-2/R-3):** any field in §4.3's
  table reading otherwise — a `prevEpisode*` field wrong, a stop-record
  field not reset, `armedAt` non-null, any out-of-gate delta — STOPs
  the gate and classifies. **No corrective act exists inside this
  gate**: a clear cannot be un-done here, `verify_chain_stop` belongs
  to episodes and R3-V, and a re-stop is a different authorization.
  The finding returns for ruling with the raw reads attached.

### 4.6 Ends state

Ends **HELD in NORMAL**: containment NORMAL with episode 3 closed and
summarized; no alarm registration; GENERATION_HALT `"1"`; queue paused;
preserved plan, job, and exemption exactly as censused; $0. Restoration
changes exactly one thing in the world: the containment enum and its
episode bookkeeping.

---

## 5. What restoration does not do — and the standing posture after it

Restoration does not authorize, perform, or imply: any re-arm or alarm
registration; any hold change (GENERATION_HALT, queue pause); any plan,
job, grant, exemption, or conflicts action; any generation, SubmitJob,
command, or wake of any kind; any deployment or settings change; the
generation-resume gate or any part of its readiness. The resume gate
remains behind its own corrected package, Rowan's ruling on it
(including the OQ-3/OQ-6 correction now in preparation), and Julie's
separate GO.

**The standing posture after restoration, named honestly.** With
containment at NORMAL and no registration standing, the system is
inert: no alarm exists to deliver a drive pass, reads never wake, and
the coordinator's gated paths stand open-but-untriggered — the holds
(halt + queue pause) are the containment in this interval, exactly as
the accepted design intends between restoration and the resume gate.
The preserved plan remains a **live trigger only in the documented
sense**: it could execute only if BOTH holds lifted AND a drive pass
occurred. Neither lift is any part of this gate, and no drive pass can
occur without a registration — and no registration can appear except
through a wake under NORMAL, which happens only inside a future
authorized gate's own acts (in the resume gate's design, its single
ruled probe). Nothing about restoration makes an accidental execution
possible; it removes the stop, and leaves the holds standing in its
place.

One bookkeeping consequence to name now: after this clear, episode 3's
summary sits in Tier 2 (`prevEpisode*`). A **future** authorized clear
would overwrite that summary with a newer episode's (design §4.2) —
the complete history is unaffected (Tier 1 is append-only and
permanent), and the historical-audit-review precondition applies to
every future restoration or R3-V request precisely so that no summary
overwrite can hide an episode.

---

## 6. GO wording for Julie — DRAFTED

Following the gates v4 revised ancestor wording ("GO — execute the
standalone restoration as pinned: fresh census including the episode
disclosure and the historical audit review of the full containment
audit history, then exactly one clear of CHAIN_STOPPED with the
recorded reason, read-backs only, ending HELD in NORMAL with the
registration still absent"), adapted to this package and presented
only after Rowan's ruling on it:

> "GO — execute the standalone restoration as pinned at
> `<RESTORE-PIN>`: the fresh closing-state confirmation census of §3
> (both containment surfaces, the alarm registration, the production
> holds, plan and job state, and build identity including the script
> etag), against the historical audit review of §2 (episode 3
> disclosed: verified at attempt 1, not exhausted; all four C3
> transitions and the rejected C3-1 request accounted; no exhausted
> episode anywhere in the history, so no R3-V naming arises); then
> exactly one `clear` of CHAIN_STOPPED with the recorded reason quoted
> in §4.2 of the package, read-backs only, no re-send in any failure
> branch, ending HELD in NORMAL with the registration still absent. I
> understand this restoration does not re-arm anything, does not lift
> GENERATION_HALT or the queue pause, does not touch the preserved
> plan or the idx-26 exemption, and does not authorize the
> generation-resume gate or any generation."

The GO is recorded on the board before the §3 confirmation runs (the
C3 ordering), and the §4.1 `authorizationRef` takes its comment id from
that record.

---

## 7. Assumptions register and open questions for Rowan

### Assumptions

| # | Assumption | Basis / strength |
|---|---|---|
| A-1 | The §3 confirmation's expected values are the C3 closing values, unchanged since 2026-11-06T02:24:16Z | No authorized act since C3 can have changed them (no containment transition, deploy, hold, or queue change is authorized or recorded); the confirmation itself falsifies this if wrong — it is an expectation, not an inheritance |
| A-2 | Audit rows 5 and 6 will be the restoration's `clear:applied` and `stop_episode_closed`, in that order | The deployed composed source's clear path (state commit insert, then episode-close insert, one transaction); the row ids follow from §2's reconciled count of 4 — they are predictions the R-2/R-3 reads partially corroborate (the surfaces expose the summary fields, not row ids), and the execution record must state them at that strength |
| A-3 | Row ids in §2.3 (1–4) are as the episode arithmetic + responses establish | C3 record §4's counting basis, accepted by Rowan at its narrowed strength (ruling §A) |
| A-4 | `stopConfidence` after the clear reads `not_applicable` on both surfaces | Truth-table row 1 applied to a readable NORMAL record; no post-clear production read exists yet to confirm the surfaces' behavior (the only production clear so far, C3-3, read back `not_applicable` at NORMAL — record §3.2/§3.4 pattern, corroborating) |

### Open questions

- **Q-1 — Confirmation vs census.** Proposed reading: the ruling's
  "fresh read-only closing-state confirmation" and the gates text's
  "fresh CENSUS executed at its start" are **one act** — the §3 set,
  run in the execution session immediately before R-1, valid only
  within that session (if execution slips to a later session, the
  confirmation is re-run in full; it is never carried across sessions).
  Rowan is asked to accept or correct this reading.
- **Q-2 — Audit-review surface.** This review rests on the reconciled
  record (§2.1) because no established read surface enumerates the
  audit table. Does Rowan accept the review at that strength for
  restoration (as she accepted the accounting's narrowed strength for
  C3's record), or does she require a literal audit-table read — which
  would need a surface that does not exist in the current build and is
  **not** proposed here?
- **Q-3 — The §4.2 reason text.** Is the drafted reason accepted as the
  demonstrated reason for this clear (what changed / why containment is
  no longer needed), at its drafted length and visibility?
- **Q-4 — The no-re-send rule.** §4.5 forbids any corrected re-send of
  R-1 inside the gate, including for a paperwork-form defect of the
  C3-1 kind. Rowan is asked to confirm this stricter-than-C3 posture is
  the intended one for a single-act gate (C3's correction proceeded
  inside its gate because C3's census and multi-step ledger framed it;
  this gate's position is that a failed single act returns for ruling).

---

## 8. Turn

**Turn: Rowan's** — review of this readiness package (via Julie's poke;
the companion CP rides with it). On Rowan's ruling, the §6 GO wording is
presented to Julie for her separate decision. Nothing in this package
is an execution request, and no production act is pending or implied.
