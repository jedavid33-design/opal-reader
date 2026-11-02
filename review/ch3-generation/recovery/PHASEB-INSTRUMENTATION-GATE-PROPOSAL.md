# Phase B Instrumentation — PROPOSED BUILD/DEPLOY GATE (P2)

- **Status: PROPOSAL ONLY — NOT AUTHORIZED.** This gate executes
  only on Rowan's review PASS of this proposal **and** Julie's
  explicit GO, both recorded on the Roundtable board before
  execution (§9). Rowan's design approval and the specification's
  existence do not authorize it. No production change of any kind
  has been made for this document.
- **AMENDED — HOLD FOR CORRECTIONS implemented.** Rowan's review
  of the original spec + gate returned "HOLD FOR CORRECTIONS.
  NOT APPROVED FOR DEPLOYMENT" with six required corrections
  (C1–C6). All six are implemented in the companion spec and in
  this proposal (§6 V5 and §12 for C1/C4; §5, §9, §10 for C2;
  §7.3 for C3 — rewritten from a firsthand trace of the deployed
  source, withdrawing the original draft's `reservedUnverified`
  prediction, which the deployed accounting derivation disproves;
  §4 B3 for C6 — the battery has been EXECUTED against the exact
  candidate tree: 32/32 tests, exit code 0, log
  `instrumentation-spec/BATTERY-RUN-LOG.txt`, SHA-256
  `1fcacefa8e60062a87e9a3ecff47a59667346a1450d9282daf818bffbb85c2ce`).
  The full compliance record is
  `PHASEB-INSTRUMENTATION-AMENDMENT-NOTES.md`. This amended
  proposal again requires Rowan's PASS and Julie's GO before any
  execution.
- **Companion document:** `PHASEB-INSTRUMENTATION-SPEC.md`
  (SHA-256 `a805b473f293073cad5fd97bbdba05f30c12d76b3b41d78b3742fc0b1e34110e`),
  whose Appendix A is the expected two-part diff and whose §2.2
  pins the candidate part hashes this gate builds and verifies:
  - candidate `v2/worker-entry-prod-d6.js`:
    `45daf26ca850835c698863cb08ca39a8c6f1b2f1450488d1e710f0cd87d7c4ab`
  - candidate `v2/generation/service.mjs`:
    `41f27492447296f25f958836a65d8e04592c2ba3cd330a2d2854ed98433eefda`
- **Target:** production worker `opalreader-api-v2-prod` only.
  Staging is not read, built, or touched by this gate.
- **Governing record for expectations:** the Phase B attempt-3
  execution record (`PHASEB-ATTEMPT3-EXECUTION-RECORD.md`, pin
  `ee8562b9d3eaa0e6f4eabbf5ffb32245125c8aad`) and the diagnostic
  report (`PHASEB-STALL-DIAGNOSTIC-REPORT.md`, pin
  `cccfea62d96bfc5a15a269f9455b169980c0226b`).

## 1. Scope

Build the instrumented candidate from the pinned deployed tree
(the 31 parts preserved in `phaseb-attempt3/evidence/parts-e0/`)
plus the spec's Appendix A diff and nothing else; run the spec's
test battery on that candidate tree; upload the candidate to the
production worker exactly once; verify; observe the first
drive-pass records; file the execution record. The system is
HELD (GENERATION_HALT `"1"`, queue paused) before, during, and
after every step. No generation is involved at any point.

## 2. Stage order

1. **Census** (§3) — fresh reads against every expectation; any
   deviation is a STOP (S-1).
2. **Build** (§4) — assemble, patch, hash-verify, battery, pin.
3. **Deploy** (§5) — exactly one upload + read-backs (+ the
   conditional observability PATCH).
4. **Observation + preservation verification** (§6, §7).
5. **Record** — execution record filed on the board and
   summarized to Julie, ending with whose turn it is (Rowan's
   documentary review).

## 3. Pre-flight census expectations

Every figure below is **re-read fresh at execution census**; the
values stated are the expectations the fresh reads must match,
carried from the attempt-3 record's census (§1) and closing
capture (§9). Nothing here is assumed live at execution time —
a carried figure is an expectation to be verified, never a
substitute for the read. Any deviation is a STOP under the
standing executor law; the executor never self-clears.

1. **Health:** build
   `1c2d1d0fa7ebb769f68cfb327fb9fde7d4d30867`; generation
   `halted`; coordinator `armed`.
2. **Script:** etag
   `f15fb1ae40f870fc4493f3499db0b096c4d801b9fff8d20fe5538d84c69c82ed`
   exact; 31/31 parts byte-identical to the `parts-e0/` manifest;
   observability enabled with `logs.persist: true` (script-settings
   read).
3. **Bindings/settings surface:** exactly 10 bindings;
   GENERATION_HALT `"1"`; `OPALREADER_PHASE_POLICY` `"enforce"`.
4. **Settings:** revision **1** (lane standard, cap $50).
5. **Queue** `opalreader-generation-v2`: `delivery_paused: true`;
   exactly 1 consumer. (The queue's `modified_on` is NOT an
   expectation — attempt 3's own re-pause moved it; the invariant
   is the paused state and the consumer count.)
6. **Capabilities:** standard admitted; Batch `batch_not_armed`;
   phase registry binds `forever-pucked` ↔
   `5c589095-f812-48a2-8ab2-03ba2791f2b2`.
7. **Phase accounting, exact on both surfaces:** settled
   **1,029,420**; estimatedUnverified **19,018**;
   reservedUnverified **5,648**; inFlightUpper **0**; unknownOpen
   **0**; remaining **12,464,932** of 13,500,000.
8. **Quota:** reconcile `ok: true`, drift empty on all pages,
   sole exception the known adjudicated straddler
   `att-37d63768-db4b-447d-8150-580b7c6ee257`
   (`estimated_unverified`). Per-day dispatched totals for PT
   2026-10-29 / 10-30 / 10-31 / 11-01 exactly **57 / 79 / 44 / 76**
   as the attempt-3 record states; any later PT day exactly **0**;
   reserved **0**. (The current PT day's own number is
   date-dependent and is therefore expressed as this invariant —
   no dispatch can have occurred since attempt 3 closed, because
   dispatch requires an execution and no generation path has been
   open — rather than as a single carried figure.)
9. **Plans — exactly 5:** smoke `complete`; old Ch 2
   `plan:603ab416bd67ab1b25de97be` `retired`; fresh Ch 2
   `plan:b2dc2a3d1cd367a0245b9102` `complete` 18/18; Ch 3
   `plan:e377a5559961b294154276b6` `complete` {eligible 23,
   done 23, failed 0, blocked 0}; Phase B
   `plan:19cad189fab54b9c804a74a6` `active` {eligible 1, done 0,
   failed 0, blocked 0, prompts 0}, its single entry `pending`,
   its job `plan:19cad189fab54b9c804a74a6:seg` `queued` rev 1,
   quarantine `held: false`, **grants []**. No other
   non-terminal plan; no live grant.
10. **Eligibility (the exemption's projection):** chapter quote
    bound **26** / parked **0** / eligible **1**; segment quote
    eligible **1** / **569** chars / **8,022**. The attempt-3
    closing record carries the closing digest only as the prefix
    `cdef2c7e…` — the full digest is therefore **not** carried as
    an expectation; the census instead requires the three scopes'
    (chapter / segment / book) digests to be mutually consistent
    on the fresh read, with the counts above exact.
11. **Conflicts — exact-match to the pinned four-row baseline:**
    id 1 @ 2026-10-29T23:54:14.808Z
    `grant:plan:3183ecbf2ac4bf50bbc6166e:seg:1:full`; id 2 @
    2026-10-30T00:24:14.632Z
    `grant:plan:603ab416bd67ab1b25de97be:ch1:1:full`; id 3 @
    2026-10-31T05:14:24.089Z
    `grant:plan:b2dc2a3d1cd367a0245b9102:ch1:1:full`; id 4 @
    2026-11-01T01:04:30.364Z
    `grant:plan:e377a5559961b294154276b6:ch2:1:full` — every field
    (cache_key `lease`, expected `7`, found `LIKE or GLOB pattern
    too complex: SQLITE_ERROR`, reason `schedule_dead`) exact.
12. **Parked job:** `1832c21fcf0425454227c4736048a8a632f422abca4a2685ddb775bb1681406a`
    `parked_policy` rev 1, fingerprint
    `b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282`
    exact, grants [].
13. **Watermarks + occupancy:** content watermark **18**;
    bindings **1841** entities, **0** rows for occurrence
    `2a85f74f-353d-4c25-a86a-4a4db392868b`, **0** changes since
    seq 1841; the idx-26 R2 key
    `audio/07d145f7b87b9621497d3b8a2c5828141592b94425fd5696fffedde9957d9590`
    **FREE** (LIST empty).

**Exemption evidence note:** the exemption's standing is
evidenced as in every prior record — class (a) the E1 operator
response on file (`applied`, `alreadyExempted: false`) and class
(b) the eligibility projection in item 10. The exemption journal
has no read surface (§9.2A(c) of the attempt-3 record:
UNAVAILABLE); this gate does not claim a journal read.

## 4. Build stage + verification (before any upload)

- **B1 — Assemble:** copy all 31 parts from `parts-e0/` into the
  candidate tree; SHA-256-verify every part against the
  `parts-e0/` originals (31/31).
- **B2 — Apply + identity:** apply the spec's Appendix A diff
  (`patch -p1`). Verify: the entry and service parts hash to the
  spec §2.2 candidate SHA-256s exactly; the other 29 parts remain
  byte-identical to `parts-e0/`; the part count is still **31**
  (the diff adds no part and removes none).
- **B3 — Battery:** run the spec §9 battery (T0–T10) on the
  candidate tree. The FULL log and the exit code are captured;
  both are pinned with the gate record. Any failure, and any
  incomplete log, is a STOP (S-3). **Amendment evidence:** this
  battery was already executed once, during the
  HOLD-FOR-CORRECTIONS amendment, against a candidate tree
  assembled exactly this way and hash-verified to the §2.2 pins —
  32/32 tests passing, exit code 0, full log at
  `instrumentation-spec/BATTERY-RUN-LOG.txt` (SHA-256
  `1fcacefa8e60062a87e9a3ecff47a59667346a1450d9282daf818bffbb85c2ce`).
  The build-stage run here is a RE-run on the gate's own
  assembled tree; its log must also be complete and green, and
  any divergence from the amendment run is a STOP (S-3).
- **B4 — Pin the candidate:** the candidate manifest (31 part
  hashes) + the battery log are pinned in the code repo
  (`jedavid33-design/opal-reader`, branch `ui1-review`) before
  the upload. Per the program's build-marker convention, the
  deployed candidate's `/health` build stamp must equal that pin
  commit; the gate record names the pin before the upload step.
  (Repo pins and board filings are bookkeeping, not production
  mutations; §8.)
- **B5 — Envelope:** the upload envelope is built from the
  candidate tree's 31 parts with the LIVE script's upload
  metadata read fresh at build time and carried forward
  unchanged: all 10 bindings (existing secrets as
  `{"type": "inherit", "name": …}`), `compatibility_date`
  `2026-08-29` + the `nodejs_compat` flag, `main_module` naming
  the entry part with its module content type and filename
  attributes — per the standing deploy law. GENERATION_HALT
  remains `"1"` in the carried-forward metadata: **this gate
  flips no setting.** The envelope digest is recorded in the
  gate record before upload. Any metadata drift between the
  build-time read and the census read, beyond the documented
  GET-projection artifacts (the `namespace_id` projection on the
  DO binding and secrets projected as `secret_text` where
  uploads carry `inherit` — the artifacts the attempt-3 record
  §4 documents), is a STOP (S-4).

## 5. Deploy step + mutation budget

- **D1:** exactly **ONE** multipart upload (PUT) of the §4
  envelope to `opalreader-api-v2-prod`.
- **D2 — immediate read-backs:** script GET (etag + part
  hashes); script-settings GET (observability). If the upload
  reset observability to null — the known upload side effect —
  re-apply it with the standing settings-only multipart PATCH to
  `/workers/scripts/{name}/settings` (observability object
  only), then re-read script-settings AND the script etag: the
  PATCH must leave the code etag unchanged.
- **D3 — ambiguous upload:** if the upload errors without a
  readable outcome, STOP. Verify live state by reads only. No
  re-upload without fresh authorization naming the retry.

**Mutation budget (complete; correction C2 — each PATCH is
counted separately, including the rollback's):**

| Kind | Budget |
|---|---|
| Script uploads (forward, D1) | **1** |
| Settings-only observability PATCH after the forward upload | **≤1, conditional** (only if D2 finds observability reset; settings-only; the code etag must be unchanged across it) |
| Rollback upload (§8, conditional) | **≤1, conditional** (only on a named §8 condition during this execution) |
| Settings-only observability PATCH after the rollback upload | **≤1, conditional** (only if the rollback upload reset observability; settings-only; the code etag must be unchanged across it) |
| Commands (`POST /v2/commands` or any operator POST) | **0** |
| Settings flips (incl. GENERATION_HALT) | **0** |
| Queue operations | **0** |
| Plan / job / exemption operations | **0** |
| Operator R2 writes | **0** |
| Spend | **$0** (halt on, queue paused, no `sendGrant` wired; the instrumentation calls no provider) |

In words, the complete write envelope is: **1 forward upload +
≤1 conditional observability PATCH after it; PLUS, conditionally,
1 rollback upload + ≤1 conditional observability PATCH after the
rollback.** Nothing else writes.

**Code effects, not operator mutations:** on the first alarm
pass after the upload, the deployed build itself lazily creates
`d6_drive_passes` and writes its first row, and the recorder
writes the health key. These are the deployed code's own
behavior — the observation this gate exists to make — named here
so they are never mistaken for operator acts. The table's
creation is a code effect of the approved build; no operator
call creates it.

## 6. Post-deploy verification

- **V1 — Health:** `/health` build stamp equals the §4 pin
  commit; generation `halted`; coordinator `armed`.
- **V2 — Script identity:** the etag DIFFERS from
  `f15fb1ae…` (a change is expected and required — an unchanged
  etag means the upload did not take, a STOP); 31 parts; 29
  byte-identical to `parts-e0/`; the entry and service parts
  byte-identical to the candidate hashes (§4 B2).
- **V3 — Settings surface:** observability enabled +
  `logs.persist: true` (after the conditional PATCH if it was
  needed); settings revision still **1**; GENERATION_HALT still
  `"1"`; exactly 10 bindings.
- **V4 — Queue (read-back only):** `delivery_paused: true`;
  exactly 1 consumer. This gate makes no queue call.
- **V5 — First drive-pass observation:** read
  `GET /v2/d6-diagnostics?drive=1` (operator connector, with the
  production scope/instance headers) at approximately +12
  minutes and +25 minutes after the upload (the watchdog period
  is 10 minutes; the times are estimates allowing platform
  slack). Readings are classified per the spec's §8.4 matrix and
  §8.5 classification table (corrections C1 + C4): **diagnostic
  capture success and coordinator health are separate findings,
  and neither kind of finding is, by itself, a gate failure.**
  The possible readings:
  - **Rows present, newest stage `complete`:** capture is
    working AND the chain delivered at least one invocation that
    ran end-to-end. `tableState` `"populated"`; `armedAfter`
    non-null and consistent with the read's live
    `alarm.armedAt`. The row's outcomes show the preserved plan
    considered; a `grantId` may or may not be present — see
    §7.3. `recorderHealth` is read and reported on its own terms
    (below), not folded into this verdict.
  - **Rows present with an error stage** (`base_alarm` /
    `construct` / `recover` / `drive` / `flush`): **capture
    succeeded; the coordinator pass failed at the named stage.**
    This is a FINDING REQUIRING CLASSIFICATION, not failed
    instrumentation and not a deploy failure by itself: the
    executor reports the row(s) verbatim in the gate record and
    Rowan classifies (pre-existing coordinator fault vs
    build-attributable change — RB-1 turns on that
    classification, and the executor never makes it alone).
  - **`recorderHealth.recordingFailures > 0`:** a FINDING
    REQUIRING CLASSIFICATION in the same way: the recorder
    failed to write on that many passes, at the named steps; it
    says nothing directly about coordinator health. Executor
    reports; Rowan classifies. Not a deploy failure by itself.
  - **No rows (nothing captured):** `tableState` `"missing"`,
    `recorderHealth` null. **Classification: INCONCLUSIVE —
    consistent with H1 (the chain is not delivering invocations)
    but NOT proof of it.** The identical absence is produced by
    (a) H1, (b) every pass failing BOTH channels — the SQL table
    write and the KV health note together, which would coincide
    with storage faults visible on other surfaces — and (c) a
    constructor/platform failure before handler invocation,
    which leaves no trace in either channel (§12). This is the
    very datum the instrumentation exists to produce, stated at
    its correct strength. The executor reports it and the gate's
    verification ends there: the instrumented build is verified
    live by V1–V4, it is the observation instrument, and it is
    LEFT IN PLACE. **No alarm kick, no wake command, no replay,
    and no other active probe is authorized by this gate** — a
    manufactured wake would contaminate the observation and was
    already refused as a method in Rowan's P1 ruling.
- **V6 — Preservation reads:** §7 in full.
- **V7 — Record:** the execution record (census capture, build
  manifest + battery log pins, envelope digest, upload +
  read-back envelopes, observation reads, preservation verdicts)
  is filed on the board and summarized to Julie.

## 7. Preservation checks

Each check names its read surface; all are read at V6 against
the §3 census values (which were themselves freshly verified at
census — so preservation is judged census-to-close, not
record-to-close).

- **P-1 — The preserved plan:** `plan:19cad189fab54b9c804a74a6`
  `active`, totals {eligible 1, done 0, failed 0, blocked 0,
  prompts 0}, entry `pending`. Read: `GET /v2/d6-plans/<planId>`.
- **P-2 — Its job:** `plan:19cad189fab54b9c804a74a6:seg`
  `queued` rev 1, quarantine `held: false`. Read:
  `GET /v2/jobs/<jobId>`. (State, revision, and grants are
  subject to §7.3: under the verified issuance cycle the job may
  instead read `generating` rev 2 with exactly the §7.3 grant
  live, or a post-void state satisfying every §7.3 invariant.
  Anything outside §7.3's itemization fails this check.)
- **P-3 — The exemption stands:** eligibility chapter bound 26 /
  parked 0 / eligible 1; segment eligible 1 / 569 / 8,022.
  Read: `GET /v2/d6-eligibility` (chapter + segment scopes).
- **P-4 — Halt:** GENERATION_HALT `"1"`; `/health` generation
  `halted`. Reads: `/health`, capabilities, settings surface.
- **P-5 — Queue paused:** `delivery_paused: true`. Read: cf-api
  queue GET.
- **P-6 — Conflicts:** exact-match the §3 item-11 four rows.
  Read: `GET /v2/conflicts`.
- **P-7 — Watermarks:** bindings 1841 entities, 0 idx-26 rows, 0
  changes since seq 1841; content watermark 18. Reads: sync
  snapshot/changes walks.
- **P-8 — Money figures:** phase accounting and quota exactly as
  §3 items 7–8, subject only to §7.3.
- **P-9 — Parked job:** fingerprint
  `b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282`
  exact; `parked_policy` rev 1; grants []. Read: job view.

### 7.3 The single named nuance — a drive-pass grant issuance (VERIFIED, correction C3)

A drive pass of the PRE-EXISTING mechanism may issue the
preserved plan's grant at any time the alarm chain runs —
including during this gate's verification window. That was true
before this gate existed (diagnostic report §6a/§6b: the
preserved plan is a live trigger contained by the two holds;
issuance is not halt-fenced, delivery is), and the
instrumentation neither causes nor prevents it — the recorder
issues nothing, and the unmodified build would behave
identically on the same pass.

**The transition below was verified firsthand against the
deployed source for this amendment** (parts-e0, build
`1c2d1d0f`; line anchors are to those parts), and the battery
observed it live in the harness (T2: pass 1 issued the grant
under halt; all other state evolved identically to the
unmodified build). **ONLY this transition is pre-classified as
expected live-trigger behavior. ANY other or unmatched state
movement — any at all — is a preservation failure: STOP, and
evaluate rollback under §8. The executor never self-clears a
deviation from this itemization.**

The issuance transition, exactly:

- **Selection and grant step.** `driveOnce`
  (`generation/service.mjs:888`) selects the plan (state `active`
  is not in the selection exclusion at `service.mjs:923`); the
  strict quarantine check passes on the census state (the plan
  was born unmarked); with exactly one pending occurrence, no
  live grant, and no in-flight execution record, the grant step
  calls `coord.requestGrant(jobId)` (`service.mjs:992`), which
  wakes and calls `_issueGrant` (`coordinator.mjs:1805`,
  `coordinator.mjs:1636`). The issuance writes: one `grants` row,
  state `issued`, lease = now + 15 minutes (`LEASE_MS`,
  `coordinator.mjs:134`; insert at `coordinator.mjs:1743`); the
  grant id is `grant:plan:19cad189fab54b9c804a74a6:seg:1:full`
  (grammar `grant:${jobId}:${job.revision}:full`,
  `coordinator.mjs:1696`, revision as read at issuance); one
  occurrence event `grant` (pending → granted); one `ledger_ops`
  `attempt` row; one UNSENT outbox `dispatch` row
  (`coordinator.mjs:1755`); one pending `lease` schedule row; and
  one `d6_grant_reservations` row via `reserveForGrant`
  (`generation/quota-budget.mjs:544`), slots_total 12, state
  `open`.
- **Derived-surface movements (the complete set):** the job's
  grants go [] → exactly [`grant:plan:19cad189fab54b9c804a74a6:seg:1:full`,
  `issued`]; the occurrence goes `pending` → `granted`; the job
  goes `queued` rev 1 → `generating` rev 2; the derived quota
  reserved figure for the issuance PT day goes 0 → **12**
  (`derivedDayTotals`, `quota-budget.mjs:193` — the sum of
  `slots_total − slots_consumed` over open reservations). The
  12 is the occurrence's full attempt budget:
  `SEGMENT_ATTEMPT_BUDGET = 12` (`generation/gen-constants.mjs:16`),
  bounded as a cohort by `boundGrantTargets`
  (`quota-budget.mjs:624`); the per-attempt upper bound for 569
  chars is `upperBoundAttemptMicro(569) = 12,803` micro
  (`gen-constants.mjs:88`), and the occurrence ceiling
  `12 × 12,803 = 153,636` (`gen-constants.mjs:95`) — the same
  figures the Phase B record carries.
- **Phase accounting does NOT move.** The prior draft of this
  section predicted phase `reservedUnverified` would increase by
  the grant's reservation. **That prediction is withdrawn: it is
  disproven by the deployed derivation.** `phaseAccounting`
  (`generation/genstore.mjs:403`) derives `reservedUnverifiedMicro`
  ONLY from `d6_billing_adjudications` joined to
  `estimated_unverified` attempt-log rows, and `inFlightUpperMicro`
  ONLY from attempt-log rows in phase `reserved`/`dispatching`,
  which are written only by `reserveAttempt`
  (`genstore.mjs:129`) on the execution path. Grant issuance
  writes NEITHER table. Therefore settled (1,029,420),
  estimatedUnverified (19,018), **reservedUnverified (5,648)**,
  inFlightUpper (0), and unknownOpen (0) must ALL read EXACTLY as
  at census; any movement in any of them is unmatched → STOP.
- **No delivery, no spend.** `sendGrant` is `undefined` unless
  `GENERATION_HALT === "0"` (`worker-entry-prod-d6.js:323`,
  `:340`); `driveOnce` drains the outbox only
  `if (typeof env.sendGrant === "function")`
  (`service.mjs:1034`). Under halt `"1"` the outbox row stays
  unsent: zero `d6_provider_dispatches` rows, bindings remain
  1841, spend remains $0. Plan totals remain {eligible 1, done
  0, failed 0, blocked 0} and plan state remains `active`.
- **The bounded lease-expiry cycle (also pre-classified, with
  its invariants).** Fifteen minutes after issuance, the base
  alarm's schedule processing (`case "lease"`,
  `coordinator.mjs:2536`) finds the outbox row unsent and never
  attempted and voids it (`_voidDispatch(...,
  "lease_expired_undelivered")`, `coordinator.mjs:2589`): the
  occurrence returns `granted` → `pending`, the grant becomes
  `voided`, the reservation closes, the derived reserved figure
  returns 12 → 0, and a `retry_grant` is scheduled at +30 s
  (`coordinator.mjs:1801`); its handler
  (`case "retry_grant"`, `coordinator.mjs:2625`) calls
  `requestGrant` again (`coordinator.mjs:2636`), re-issuing
  under the grant-id grammar at the then-current job revision.
  Across any observation window the cycle's invariants are: at
  most one live `issued` grant for this job at any instant;
  derived reserved ∈ {0, 12}; dispatched always 0; every phase
  figure frozen at census; bindings and watermarks frozen. A
  reading that catches the cycle mid-flight (grant `issued`, or
  grant `voided` with re-issuance pending, or no live grant with
  the occurrence back at `pending`) is expected IF AND ONLY IF
  it satisfies every invariant; anything else is unmatched →
  STOP. (A quota-reconcile read turning non-ok is likewise
  unmatched movement → STOP; reconcile internals were not
  separately traced and are not pre-classified.)

If observed, the executor itemizes the transition in the gate
record as a first-class observation for Rowan and Julie. It is
**not** a preservation failure, **not** a rollback trigger, and
**not** attributable to the instrumentation.

## 8. Rollback — conditions and procedure

**Conditions (any one fires rollback evaluation; RB-1…RB-3 also
STOP the gate):**

- **RB-1 — Behavior change attributable to the build:** e.g. a
  recorded row whose drive error is thrown by the recorder's own
  code reaching the drive path (proof the swallow discipline
  failed in production), or shipped-surface responses differing
  from the census captures beyond timestamps and the new mode.
- **RB-2 — Observability:** the upload reset observability and
  the settings PATCH fails to restore it, or the PATCH changes
  the code etag.
- **RB-3 — Preservation failure attributable to the build:**
  bindings moved, settings revision changed, queue unpaused,
  conflicts changed, halt flipped.
- **RB-4 — Direction:** Julie or Rowan directs a rollback.

**Explicitly NOT rollback triggers:** absence of drive-pass rows
in the observation window (§6 V5 — the INCONCLUSIVE no-rows
outcome, consistent with H1 but not proof of it; the build is
verified live and is the instrument); a §7.3 grant issuance or
its bounded lease-expiry cycle; an error-stage row or a
recorder-health failure that Rowan has classified as not
build-attributable (§6 V5 / spec §8.5 — unclassified findings
STOP the gate record at V7 for classification, they do not fire
rollback on the executor's own call).

**Procedure:** re-upload the byte-identical `parts-e0/` 31 parts
(preserved in the attempt-3 evidence; all 31 re-hashed before
the upload) with the then-live metadata carried forward —
verifying GENERATION_HALT `"1"` in it before the upload. Read
back: etag equals `f15fb1ae…` again; 31/31 parts byte-identical;
observability re-checked and, if reset, re-applied via the
settings-only PATCH (the rollback's own conditional PATCH in the
§5 budget — settings-only, with the code etag verified unchanged
across it); ends HELD verified (health, queue, settings,
conflicts spot reads). The
`d6_drive_passes` table and the health key remain in the DO's
storage, unreferenced by the rolled-back build and ignored by
it; no cleanup is performed or needed. **Floor law:** the
rollback target `1c2d1d0f` is above the permanent rollback floor
`6a73d962…`; nothing in this gate ever rolls back to the floor.
**Authorization:** a rollback fired by a named condition during
this gate's execution (through the filing of its record) is
inside the same GO; a rollback decision after the gate closes
requires fresh authorization.

## 9. STOP conditions (explicit, complete for this gate)

- **S-1** Any census item (§3) deviates from its expectation —
  any figure, any state, the digest-consistency invariant, the
  dispatch invariant.
- **S-2** Candidate assembly: any part-hash mismatch (the 29
  unchanged parts or the 2 candidate hashes), part count ≠ 31,
  or the diff does not apply cleanly.
- **S-3** The battery fails in any group, or its full log + exit
  code cannot be captured.
- **S-4** Metadata drift at build time beyond the documented
  GET-projection artifacts (§4 B5).
- **S-5** The upload's outcome is ambiguous — STOP; reads-only
  verification; no re-upload.
- **S-6** Post-deploy identity failure: the etag does not change,
  the parts do not match the candidate hashes, or `/health`'s
  build stamp is not the §4 pin.
- **S-7** Observability is null after the forward upload and
  the settings PATCH fails, or that PATCH changes the code etag;
  or, after a rollback upload, observability is null and the
  rollback's settings PATCH fails, or that PATCH changes the
  code etag. (Both PATCHes are inside the §5 budget; a third
  PATCH of any kind is outside it and is itself a STOP.)
- **S-8** Any preservation check (§7) fails outside the §7.3
  nuance.
- **S-9** First-row content shows recorder-caused behavior change
  (RB-1 evidence).
- **S-10** A 1101-class platform fault, or a connector/transport
  failure, at any point mid-gate.

On any STOP: preserve the state exactly as found, file what was
observed, and wait for Rowan/Julie. The executor never
self-clears a STOP, never retries a step on its own call, and
the GO is consumed by the attempt.

## 10. Authorization block

This gate executes **only** when BOTH are on the Roundtable
board record before execution begins:

1. **Rowan's review PASS** of this gate proposal — which
   incorporates the companion spec by its SHA-256 and the
   candidate parts by their §2.2 hashes, so her PASS covers the
   exact bytes this gate would deploy; and
2. **Julie's explicit GO** for this gate.

The GO covers exactly: the §3 census, the §4 build, **one**
deploy attempt (§5 D1), the conditional observability PATCH
after the forward upload, the §6 verification, and a conditional
rollback (§8) fired by a named condition during the same
execution — including, if that rollback fires, the rollback
upload and its own conditional observability PATCH after it
(the complete §5 budget, and nothing beyond it). It does not
cover a second upload for any other reason, any generation, or
any change to the preserved plan, the exemption, or the holds —
each of those requires fresh authorization. The GO is consumed
by the attempt, including a STOPPED attempt.

## 11. Explicitly out of scope

- **The Step-0 procedural correction** (verifying an issued
  grant before unpause) — it belongs to the next generation
  proposal (spec §10.1; Rowan's attempt-3 review). This gate
  neither implements nor prejudges it, and nothing in the build
  touches an unpause sequence — there is no unpause in this gate
  at all.
- **Attempt 4 / any generation** of any segment, and any second
  SubmitJob for idx 26 (never — diagnostic report §11).
- Any change to the preserved Phase B plan, its job, or the
  idx-26 exemption (no retirement, revocation, release,
  finalizer, or manual drive).
- Any halt lift or queue unpause, for any purpose, however
  brief.
- Batch arming or batch work. Staging. Client changes. Clearing
  or altering any conflicts row.

## 12. Limitation restated (spec §10.2)

**Constructor/platform failures preceding handler invocation
remain unobservable** by the instrumentation this gate deploys:
if the platform cannot instantiate the DO or never delivers the
alarm, no recorder code runs, and the post-deploy observation
(§6 V5, no-rows outcome) is classified **INCONCLUSIVE** —
consistent with H1 (a dead alarm chain) but not proof of it,
because a pre-handler failure and a dual-channel storage failure
produce the identical absence; it is not a named platform root
cause. The gate's verification is written so that this outcome
is a successful observation, not a failed gate.

— Wren (proposal only; no production contact of any kind was
made for this document)
