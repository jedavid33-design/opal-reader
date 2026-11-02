# Phase B — Gate C2 readiness package: PASSIVE deployment/readability verification (zero mutations)

**Status: READINESS PACKAGE — for Rowan's independent review. Nothing in this package is an execution, and nothing in it requests a GO. C2 executes only under Julie's separate explicit GO, after Rowan's review of this package.**

**Predecessor state:** Gate C1 is **CLOSED** — Rowan's execution review PASS (relayed by Julie Nov 2, 2026) accepted the C1 execution record (pin `43642bd865e77a588edf4e8d6fd4f93fae37499b` on `ui1-review`, repo `jedavid33-design/opal-reader`). The containment-v4 build is the deployed production script: build `27b2b3a9f1e7070ef243ee017703246744d57d5c`, script etag `adb8e5a5b104858a20835a17ffd714a70f72cea5e066c6d61c4b80a49adac46f`, deployed inert at NORMAL. System **HELD**: GENERATION_HALT `"1"`, queue `opalreader-generation-v2` delivery paused.

**What C2 is:** a **reads-only** gate. It re-reads the deployed containment build's state on both read surfaces, across an observation window, and certifies that the containment state is **readable, consistently reported, and still NORMAL/absent with the design's empty stop-record projection** — nothing more. C2 performs **zero mutations of every class** (§2). It exercises no transition, deletes nothing, suppresses nothing, provokes no alarm, and sends no command. Its PASS must never be cited as evidence that containment *works* — only that the deployed code *reports its inert state truthfully and consistently*. That limitation is inherited verbatim from the accepted gates text (PHASEB-RECOVERY-GATES-V4-REVISED.md, Gate C2), which Rowan's rulings relabeled **readability-only**; every effectiveness claim is stripped from this package on purpose.

**What Rowan's review of this package is and is not:** it is a documentary review of scope, census, expected results, STOP conditions, and GO wording. It is **not a GO**, and it authorizes no reads. Julie's GO is **not requested** in this package.

**Pin:** this package is pinned on `ui1-review` at `<READINESS-PIN>` (the pin value is resolved in the board filing for this package, per the established pin-slot pattern; the Dropbox copy of the companion cp carries the filled value, disclosed there and on the board).

---

## 1. Exact read-only scope — every read a C2 execution performs

A C2 execution performs **only** the reads enumerated here, in three capture sets (§4). No other production call of any kind is in scope. All reads are GETs or storage LISTs. On the shipped code this read set is provocation-free by construction: `wake()` is called only from the command and report paths (`handleCommand`, `requestGrant`, `handleReport` in the deployed coordinator); **no GET/read path calls `wake()`**, so no read in this set can re-arm the alarm, issue a grant, or alter any state (source-proven in the Phase B stall diagnostic and the alarm-semantics assessment, and unchanged by the containment candidate).

| # | Read | Surface / route | What it returns | Why it is in scope |
|---|---|---|---|---|
| R-1 | Health | `GET /health` (public) | Build stamp, generation state, coordinator state | Identity + held-state anchor for every set; the build stamp ties all other reads to the C1-deployed build |
| R-2 | **Containment state (surface A)** | `GET /v2/d6-containment` (operator-gated) | The containment projection: state enum, `absent`, `verified`/`known`, `stopConfidence`, stop-record and episode fields | **The C2 question, surface 1** — the dedicated state route's own projection |
| R-3 | **Diagnostics with containment projection (surface B)** | `GET /v2/d6-diagnostics` with `drive=1` (operator-gated) | The `drive=1` block: recorder baseline (`tableState`, `drivePasses`, `recorderHealth`), alarm block (`armedAt`, `pendingSchedule`, `pendingWatchdog`), the drive-mode containment projection, and phase accounting (second surface) | **The C2 question, surface 2** — cross-surface consistency is a C2 requirement, and this read also carries the recorder/alarm continuity baseline |
| R-4 | Script identity | `GET` worker script resource via cf-api | Script etag only | Identity continuity: the deployed script is still the C1-verified bytes. **Trimmed:** the full 31-part download is NOT repeated — byte-verification of the parts was C1's deploy question; C2 needs only that the etag is unchanged (etag is content-derived) |
| R-5 | Script settings | `GET /workers/scripts/{name}/settings` + `/script-settings` via cf-api | Bindings (count + names/types), GENERATION_HALT, phase policy, observability status | Held-state and observability continuity, **read-only**: C2 carries no PATCH budget — a reset finding is reported, never repaired inside C2 (remediation belongs to a deploy gate or its own authorization) |
| R-6 | Queue state | `GET` queue `opalreader-generation-v2` via cf-api | `delivery_paused`, consumer list | The queue-pause state cannot be read by the Worker (send-only binding); the cf-api read is the only proof the second hold stands |
| R-7 | Capabilities | `GET /v2/generation/capabilities` | Lane admission (standard admitted, Batch `batch_not_armed`), phase registry binding, phase accounting (first surface) | Held-state + registry + phase figures, first surface |
| R-8 | Settings revision | The operator settings read used at the C1 census | Settings revision and data (lane, cap) | Settings continuity (no flip, no CAS write) |
| R-9 | Quota | `GET /v2/quota` + `GET /v2/d6-quota-reconcile` (operator, paginated) | Derived day totals, reserved, reconcile result (`ok`, drift, exceptions) | No-movement certification for the quota books |
| R-10 | Plans + preserved plan + its job | `GET /v2/d6-plans`, `GET /v2/d6-plans/plan:19cad189fab54b9c804a74a6`, `GET /v2/jobs/plan:19cad189fab54b9c804a74a6:seg` | Plan set and states; the preserved plan's totals/entry; the job's state/revision/grants/quarantine | The preserved Phase B plan is the live trigger; its exact state is the core preservation read |
| R-11 | Eligibility | `GET /v2/d6-eligibility` (chapter, segment, and book scopes for Forever Pucked) | Bound / parked / eligible counts, chars, quote, per-scope digests | Digest consistency certifies the eligibility inputs have not moved |
| R-12 | Conflicts | `GET /v2/conflicts` | The conflict log | The pinned four-row baseline is a hard expectation; any new row is movement |
| R-13 | Parked job | `GET /v2/jobs/1832c21fcf0425454227c4736048a8a632f422abca4a2685ddb775bb1681406a` | Parked job state, revision, definition fingerprint | The parked job must remain byte-identical in state |
| R-14 | Sync watermarks | `GET /v2/sync/changes?family=content&sinceSeq=18` and `?family=bindings&sinceSeq=1841` | Change lists since the frozen watermarks (both expected empty) | Watermark continuity without a snapshot download |
| R-15 | Idx-26 occupancy | R2 LIST on the idx-26 audio key | Object list (expected empty) | The final segment's R2 key must still be FREE |

**Deliberately NOT read or done (out of scope, by design):**

- **No containment transition, ever.** C2 does not call `contain_drive`, `stop_chain`, `clear`, or `verify_chain_stop` — not even "just to test readability." Production today holds exactly one readable containment state (NORMAL/absent). The readability of DRIVE_CONTAINED and CHAIN_STOPPED projections in production is therefore **not** a C2 question and remains supported only by harness evidence (containment battery v4) until a future authorized transition exists to be read. C2 claims nothing about those states' live readability.
- **No alarm provocation.** No command, report, or wake of any kind; the alarm block is observed only as returned by R-3.
- **No full script download** (R-4 note), **no containment-absence probe** (the C1 census's nonsense-path comparison is dropped: post-C1 the route exists by design, so absence is no longer an expectation), **no exemption-journal read** (no read surface exists — unchanged), **no dashboard/log inspection** (P1 established alarm invocations are not recorded on that surface; it can answer nothing C2 asks).
- **No remediation of any finding.** C2's only responses to a deviation are STOP, preserve the captured reads, and report (§5). Any fix — including an observability PATCH or a rollback — is outside C2 and needs its own authorization.

## 2. Mutation budget — ZERO

| Write class | Budget |
|---|---|
| Worker script uploads | **0** |
| Script-settings PATCH | **0** |
| Containment transitions (any action) | **0** |
| Commands / reports / SubmitJob | **0** |
| Hold flips / settings flips / queue operations | **0** |
| Alarm registrations caused by this gate | **0** |
| Recorder rows caused by this gate | **0** |
| Spend | **$0** |

Any response that implies a write occurred — a changed revision, a moved watermark, a new recorder row, a dispatched request — is a STOP finding under §5, classified there; it is never something C2 "uses" or repairs.

## 3. Runtime-adoption evidence limitations (the C1-2 framing, applied to C2)

C1 established **script deployment verification**: the uploaded bytes match the pinned candidate byte-for-byte and the read surfaces exercised answered on the new build where observed. C1 did **not** establish — and Rowan's acceptance explicitly does not claim — **Durable Object runtime adoption**: that every existing DO instance has adopted the new code. Instances adopt new code on their own lifecycle (eviction, restart, fresh instantiation); no C1 check observed per-instance adoption, and **no C2 read can observe it either**. The coordinator is a single account-wide object, but a read is answered by whichever instance serves it; the response carries no per-instance adoption attestation.

**What C2 CAN conclude, if every expectation in §4 holds:**

- The containment read surface is deployed, reachable, and — on both surfaces, at every capture set in the window — returns the design-specified NORMAL/absent projection: state `NORMAL`, `absent: true`, `verified: true`, `stopConfidence: "not_applicable"`, stop-record and episode fields at their empty values.
- The two surfaces **agree** with each other at every set, and the projection is **stable across the window**.
- The preservation reads (§3 census items) are unchanged across the window: nothing in the protected state moved while containment sat deployed and inert.
- Consistency across three spaced read sets is **supportive observational evidence** that the serving path runs the containment code — stated at exactly that strength. Repeated reads sample the serving path repeatedly; they do not enumerate instances, and consistency is **not** proof of universal adoption.

**What C2 CANNOT conclude, even on a full PASS:**

- That every existing DO instance has adopted the containment build (adoption-in-full remains unresolved — §8).
- Anything about containment's behavior under a live alarm pass, a wake, or a transition (no such event occurs or is provoked in C2).
- That containment *works* — drive suppression, arm suppression, stop verification, and clear are **operational** behaviors; their verification is C3's scope, and C3 is partial by construction.
- Anything about alarm delivery (the underlying stall question is untouched by C2) or about the readability of non-NORMAL containment states in production (§1).

## 4. Fresh census — hard pre-read expectations (values observed Nov 2, 2026)

The opening capture set must match **every** item below exactly. These are **dated observations, not presumed current facts**: each value is labeled with where it was last observed, and any deviation at execution is a STOP under §5 — the executor never rationalizes a difference.

| # | Item | Hard expectation | Last observed |
|---|---|---|---|
| 1 | Health | build `27b2b3a9f1e7070ef243ee017703246744d57d5c`; generation `halted`; coordinator `armed` | C1 closing capture, 2026-11-02T20:30:45Z |
| 2 | Script identity | etag `adb8e5a5b104858a20835a17ffd714a70f72cea5e066c6d61c4b80a49adac46f` | C1 D2 read-back + both windows |
| 3 | Bindings / holds | exactly 10 bindings; GENERATION_HALT `"1"`; `OPALREADER_PHASE_POLICY` `"enforce"`; observability enabled + `logs.persist: true` | C1 closing capture |
| 4 | Settings | revision **1** (lane standard, cap $50) | C1 closing capture |
| 5 | Queue | `delivery_paused: true`; exactly 1 consumer (`f260f2188d80426bb0588685e9d084eb`) | C1 closing capture |
| 6 | Capabilities | standard admitted; Batch `batch_not_armed`; registry `forever-pucked` ↔ `5c589095-f812-48a2-8ab2-03ba2791f2b2` | C1 closing capture |
| 7 | Phase accounting (both surfaces, exact) | settled **1,029,420**; estimatedUnverified **19,018**; reservedUnverified **5,648**; inFlightUpper **0**; unknownOpen **0**; remaining **12,464,932** of 13,500,000 | C1 closing capture |
| 8 | Quota | reconcile `ok: true`, drift empty, sole exception the adjudicated straddler `att-37d63768-db4b-447d-8150-580b7c6ee257`; PT dispatched 2026-10-29 / 10-30 / 10-31 / 11-01 = **57 / 79 / 44 / 76**; 2026-11-02 = **0** (observed) and **0 for every later PT day** at census time (any nonzero = movement); derived reserved **0** | C1 closing capture |
| 9 | Plans | exactly 5: smoke `complete`; old Ch 2 `retired`; fresh Ch 2 `complete`; Ch 3 `complete`; Phase B `plan:19cad189fab54b9c804a74a6` `active` {eligible 1, done 0, failed 0, blocked 0}, entry `pending` / `executionState: null`, job `queued` rev 1, quarantine `held: false`, grants **[]** | C1 closing capture |
| 10 | Eligibility | chapter bound **26** / parked **0** / eligible **1**; segment eligible **1** / **569** chars / **8,022**; all three scope digests exactly `cdef2c7ec7bb8434b4e2fac66af49983ac7fa4b4e65bb0eda40354be51ff52d1` | C1 closing capture |
| 11 | Conflicts | exact match to the pinned four-row `schedule_dead` lease baseline (ids 1–4, all fields) | C1 closing capture |
| 12 | Parked job | `1832c21fcf0425454227c4736048a8a632f422abca4a2685ddb775bb1681406a` `parked_policy` rev 1, fingerprint `b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282`, grants [] | C1 closing capture |
| 13 | Watermarks + occupancy | content **18**; bindings **1841** with 0 changes since; idx-26 R2 key FREE (LIST empty) | C1 closing capture |
| 14 | `drive=1` baseline | `tableState: "missing"`; `drivePasses: []`; `recorderHealth: null`; `armedAt` **1793562576104** (2026-11-01T19:49:36.104Z); `pendingSchedule` **2**; `pendingWatchdog` **1** | C1 closing capture (bit-identical at every C1 capture) |
| 15 | Containment projection (both surfaces) | state `NORMAL`; `absent: true`; `verified: true`; `stopConfidence: "not_applicable"`; stop-record and episode fields at their empty values | C1 closing capture |

**Executor precondition (process, not a read):** Julie's GO recorded on the board before the first read; no other gate or operator action outstanding.

**Deviation classes (C2's response differs by class — defined here, applied in §5):**

- **Class R — readability failure.** A containment surface errors, is unavailable, returns a shape outside the design's specified projections, or the two surfaces disagree. C2 **fails its question**: the answer is "readability NOT verified at this time," reported as such. A Class R finding is not, by itself, evidence that production state moved.
- **Class M — state movement.** Any preservation figure (census items 1–14) differs from its expectation, `armedAt` changes, recorder rows appear, the containment state reads anything but NORMAL/absent, or dispatched > 0. C2 **STOPs and escalates**: movement is entirely outside C2's authority (its budget is zero — it cannot remediate); evidence is preserved and Rowan classifies. Any response to movement — including any rollback — requires separate authorization, mirroring C1's Class B rule.

## 5. Expected results and window design

**Window:** three capture sets, mirroring the C1 verification cadence — **Set 1** at execution start (the census set: every read in §1), **Set 2** at **+10 minutes**, **Set 3** (closing) at **+25 minutes**. Sets 2 and 3 repeat the full §1 read set. Rationale: the cadence is the one already proven at the P2 and C1 gates; the spacing samples the serving path at three distinct times without any provoked event, and the closing set certifies the ends state.

**Expected containment result (R-2 and the R-3 projection, every set, both surfaces identical in substance):**

- `state`: `"NORMAL"`
- `absent`: `true`
- `verified`: `true` (and `known: true`) — under the v4 read discipline, absent tables are a *structurally verified* NORMAL: reads never write and never create tables, and the tables are created only by a transition, of which none has ever run
- `stopConfidence`: `"not_applicable"` (truth-table row 1: a successfully read non-stopped record; row 2's unreadable-record precedence is not triggered because the record *is* read)
- Stop-record fields (`stopStatus`, `stopVerifiedAt`, verification fields) and episode fields (current-episode and `prevEpisode*` summaries): all at their null/empty values

**Expected `drive=1` result (R-3, every set):** `tableState: "missing"`; `drivePasses: []`; `recorderHealth: null`; `armedAt` **1793562576104**; `pendingSchedule` **2**; `pendingWatchdog` **1**.

**Expected held-state result (every set):** `/health` build `27b2b3a9…`, generation `halted`, coordinator `armed`; HALT `"1"`; queue `delivery_paused: true`; settings revision 1; observability enabled + persisted; script etag unchanged.

**Expected preservation result (every set):** census items 6–13 exact at every set — no figure moves within the window either; within-window drift is scored the same as a census deviation (Class M).

**Consistency requirement:** the containment projection must be identical in substance across both surfaces at each set, and across all three sets; the preservation figures must be identical across all three sets. A single inconsistent set fails the consistency requirement — C2 does not average, retry past the window, or pick the majority reading.

**What a PASS certifies (and only this):** the containment state of the deployed build is readable on both operator surfaces, consistently reported, stable across the window, and reads NORMAL/absent with the design's empty stop-record projection — while every protected figure stood still. Plus the §3 statement of what that does and does not mean for runtime adoption.

## 6. STOP conditions

Any one of these stops the execution immediately; the executor performs no further reads beyond capturing the finding itself, preserves all captured sets, and reports. The GO is consumed by the attempt either way.

1. **Any census deviation** at Set 1 (any §4 item not exact) — STOP before the window opens; classify per §4 (Class R or Class M).
2. **Any read erroring or unavailable** in any set — including a non-200, a refusal other than the expected operator gating, or a malformed body — STOP; Class R if it is a containment surface, otherwise report as an execution failure (the question cannot be answered on partial reads).
3. **Cross-surface inconsistency** — R-2 and R-3's containment projections disagree in substance at any set — STOP; unclassified until Rowan rules (it could be either class; the executor does not decide).
4. **Within-window movement** — any preservation figure, watermark, recorder field, or `armedAt` differs between sets — STOP; Class M; escalate.
5. **Out-of-projection shape** — any containment response field outside the design's specified projections (unknown enum, unexpected non-empty stop/episode field, `verified: false`, `stopConfidence` other than `"not_applicable"` while NORMAL is claimed) — STOP; Class R unless accompanied by movement, in which case Class M governs.
6. **Any implication of a write** — a changed revision, advanced watermark, new recorder row, new conflict row, dispatched > 0 — STOP; Class M; escalate. C2 never responds to a finding with a write of its own.
7. **Containment state ≠ NORMAL/absent** at any read — STOP; Class M; escalate. (No transition has ever been authorized; any other state is by definition unexplained.)

## 7. Evidence and battery status

**No code and no battery belong to C2.** The deployed build is the C1-deployed containment-v4 candidate, already tested on its exact tree: at the C1 gate, the battery re-run on the gate-assembled tree passed **containment v4 (incl. CT14d) 42/42, exit 0** and **P2 parameterized regression 32/32, exit 0** (combined log SHA-256 `ffa4e58ab4fe347db9d577d0d716c361af252cbaecf108dddfbdc0e8a3329fda`), on top of the design-time runs pinned with the v4 packages. The C1 execution record (pin `43642bd8…`) supplies the observational baseline §4 re-verifies. **C2 adds observational evidence only** — three consistent read sets — and its record must present them as such, with raw capture envelopes preserved as gate evidence, exactly as prior gates have done.

## 8. What C2 leaves open (the remaining ladder, plainly)

A C2 PASS closes only the readability question. Still open afterward, each with its own scope and authorization:

- **C3 — operational containment verification** (its own readiness package and GO): the only gate that exercises containment, and **PARTIAL by construction** — it can perform the full stop act against the existing stale registration (subtractive; provokes nothing), ending CHAIN_STOPPED/verified; drive-suppression under a live, waking chain remains **unverifiable without a stimulus** and stays an open remainder for Rowan's ruling.
- **R5a-D — composed deployment**: deploying the R5a arming change on top of containment; deploy-only, its own census/battery/budget.
- **S1 — single diagnostic stimulus** (the R2-identity RequestPause): the first deliberate wake; hard-depends on C3 complete plus the C3 remainder ruling plus standalone restoration being in place; carries correction-6's continuing-effect language (a revived chain cannot be stopped by revoking the GO) and the S1-X companion scope.
- **Standalone restoration** (clearing CHAIN_STOPPED to NORMAL): its own explicit authorization, fresh census, and mandatory historical audit review — never ordinary cleanup.
- **Runtime adoption-in-full**: no gate on this ladder proves universal per-instance adoption; every gate's claims stay scoped to what its reads observed. This remains an explicitly unresolved item, carried forward, not silently closed by C2.
- **Alarm delivery itself** (the stall's H1 question): untouched by C1 and C2; it is S1's diagnostic subject, under its own gate.
- **Phase B generation**: rides the preserved plan only under a future generation gate after the drive mechanism is diagnosed; that proposal must also resolve the step-0 grant-verification problem explicitly. Nothing in C2 advances it.

## 9. Exact GO wording (for Julie's future decision — NOT requested here)

When Julie chooses to authorize one C2 execution, the operative wording is:

> "GO — execute Gate C2 as pinned at `<READINESS-PIN>`: passive reads only, exactly the read set and window named in the package, zero mutations of every class, STOP on any condition in the package, ending HELD. I understand C2 verifies readability only and is not operational proof."

Rowan's review of this package is not a GO. This package requests no GO. Production remains under INVESTIGATION HOLD, ending HELD.

— Wren
