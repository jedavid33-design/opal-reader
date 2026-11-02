# P2 INSTRUMENTATION GATE — EXECUTION RECORD: PASS, ends HELD, exactly 1 mutation; observation INCONCLUSIVE (instrument left in place)

**Executed 2026-11-02, census 15:30:32Z → closing capture
~16:00Z**, under the amended P2 instrumentation gate
(`PHASEB-INSTRUMENTATION-GATE-PROPOSAL.md`, SHA-256
`d1e954ea1c6321e6782f1f892529c0c24c7bc042c3d68f5548aff10df69a5b9c`)
and its companion spec (`PHASEB-INSTRUMENTATION-SPEC.md`,
SHA-256
`a805b473f293073cad5fd97bbdba05f30c12d76b3b41d78b3742fc0b1e34110e`),
pinned at `385debd95c040e73e355666a156f70c545e4246a` (repo
`jedavid33-design/opal-reader`, branch `ui1-review`).

**Authorization chain:**

- Rowan's PASS of the amended spec + gate: board comment
  **6580925820** (issue #15, `jedavid33-design/opal-roundtable`).
- **Julie's GO** for exactly one attempt of this gate, recorded
  on the board BEFORE execution: comment **6581036168**,
  Handoff ID `RT-H-20261102-e5b98c`.
- Execution-start comment **6581071143**, Handoff ID
  `RT-H-20261102-abd01e` (read back byte-identical).
- The GO is consumed by this attempt.

**Outcome in one paragraph:** the fresh census passed all 13
gate §3 items with zero deviations; the candidate assembled
from the pinned deployed tree + the Appendix A diff hashed
exactly to the spec §2.2 candidate identities; the T0–T10
battery re-run on the gate-assembled tree passed **32/32, exit
code 0**; exactly **one** worker upload was made (HTTP 200,
unambiguous); observability survived the upload so the
conditional PATCH was **not** spent; the deployed parts verify
byte-for-byte against the stamped manifest and `/health`
reports the build pin; both observation reads returned **no
drive-pass rows and no recorder-health record**, which the gate
classifies **INCONCLUSIVE** (correction C1) — the instrumented
build is verified live, is the observation instrument, and is
**LEFT IN PLACE**; preservation checks passed 11/11 at both
observation windows; **the gate ENDS HELD**. Mutations spent:
**1 forward upload + 0 PATCH** (rollback not fired). **$0
spent.** No generation, no SubmitJob, no halt lift, no queue
operation, no command, no alarm wake.

## 1. Census (gate §3) — 13/13 PASS, zero deviations

Census window 2026-11-02T15:30:32Z → 15:31:08Z; all 25 capture
envelopes HTTP 200 with bodies. Evidence:
`p2-gate-execution/evidence/` (suffix `c0`).

1. **Health** — build
   `1c2d1d0fa7ebb769f68cfb327fb9fde7d4d30867`, generation
   `halted`, coordinator `armed`.
2. **Script** — etag
   `f15fb1ae40f870fc4493f3499db0b096c4d801b9fff8d20fe5538d84c69c82ed`
   exact; **31/31 parts byte-identical** to the `parts-e0/`
   manifest; observability enabled, `logs.persist: true`.
3. **Bindings/settings surface** — exactly 10 bindings;
   GENERATION_HALT `"1"`; `OPALREADER_PHASE_POLICY` `"enforce"`.
4. **Settings** — revision **1** (lane standard, cap $50).
5. **Queue** `opalreader-generation-v2` — `delivery_paused:
   true`; exactly 1 consumer.
6. **Capabilities** — standard admitted; Batch
   `batch_not_armed`; registry binds `forever-pucked` ↔
   `5c589095-f812-48a2-8ab2-03ba2791f2b2`.
7. **Phase accounting, exact on both surfaces** (capabilities +
   diagnostics): settled **1,029,420**; estimatedUnverified
   **19,018**; reservedUnverified **5,648**; inFlightUpper
   **0**; unknownOpen **0**; remaining **12,464,932** of
   13,500,000.
8. **Quota** — reconcile `ok: true`, drift empty on all pages,
   totals stable across pages, sole exception the known
   adjudicated straddler
   `att-37d63768-db4b-447d-8150-580b7c6ee257`
   (`estimated_unverified`); PT dispatched totals 2026-10-29 /
   10-30 / 10-31 / 11-01 exactly **57 / 79 / 44 / 76**; current
   PT day 2026-11-02 dispatched **0**; reserved **0**.
9. **Plans — exactly 5:** smoke `plan:3183ecbf2ac4bf50bbc6166e`
   `complete`; old Ch 2 `plan:603ab416bd67ab1b25de97be`
   `retired`; fresh Ch 2 `plan:b2dc2a3d1cd367a0245b9102`
   `complete`; Ch 3 `plan:e377a5559961b294154276b6` `complete`;
   Phase B `plan:19cad189fab54b9c804a74a6` `active` {eligible 1,
   done 0, failed 0, blocked 0, prompts 0}, single entry
   `pending`, job `plan:19cad189fab54b9c804a74a6:seg` `queued`
   rev 1, quarantine `held: false` (read on the plan body),
   **grants []**. No other non-terminal plan; no live grant.
10. **Eligibility** — chapter bound **26** / parked **0** /
    eligible **1**; segment eligible **1** / **569** chars /
    **8,022**; the three scopes' digests mutually consistent at
    `cdef2c7ec7bb8434b4e2fac66af49983ac7fa4b4e65bb0eda40354be51ff52d1`
    (the attempt-3 closing digest, full form now on record).
11. **Conflicts** — exact-match to the pinned four-row baseline
    (ids 1–4, all fields: cache_key `lease`, expected `7`, found
    `LIKE or GLOB pattern too complex: SQLITE_ERROR`, reason
    `schedule_dead`).
12. **Parked job** — `1832c21fcf0425454227c4736048a8a632f422abca4a2685ddb775bb1681406a`
    `parked_policy` rev 1, fingerprint
    `b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282`
    exact, grants [].
13. **Watermarks + occupancy** — content **18**; bindings
    **1841** entities, **0** rows for occurrence
    `2a85f74f-353d-4c25-a86a-4a4db392868b`, **0** changes since
    seq 1841; the idx-26 R2 key FREE (LIST empty).

*Census tooling note (disclosed):* the first checker run
reported items 9–10 as FAIL on field-name assumptions in the
checker itself (quarantine is carried on the plan body, not the
job body; the segment quote's fields are `totalChars` /
`expectedCostMicroCents`). The raw reads were inspected
firsthand, the checker corrected, and the corrected run over
the SAME captured reads passes 13/13. No live figure differed
from its expectation at any point.

## 2. Build stage (gate §4) — PASS

- **B1/B2** — all 31 parts copied fresh from `parts-e0/`; the
  Appendix A diff (`patch -p1`, the pinned `combined.diff`)
  applied cleanly. Exactly **2 parts differ** from `parts-e0/`:
  - entry `v2/worker-entry-prod-d6.js` — 127,131 B, SHA-256
    `45daf26ca850835c698863cb08ca39a8c6f1b2f1450488d1e710f0cd87d7c4ab`
    (spec §2.2 candidate, exact);
  - service `v2/generation/service.mjs` — 88,070 B, SHA-256
    `41f27492447296f25f958836a65d8e04592c2ba3cd330a2d2854ed98433eefda`
    (spec §2.2 candidate, exact).
  The other **29 parts are byte-identical** to `parts-e0/`;
  part count still **31**; `node --check` clean on both edited
  parts.
- **B3 battery re-run** — the battery was re-run on the
  gate-assembled tree (fresh copy of the harness structure with
  the gate-assembled candidate tree and a pristine baseline
  twin): **32/32 tests pass, exit code 0**, matching the
  amendment run with no divergence. Re-run log:
  `PHASEB-INSTRUMENTATION-GATE-BATTERY-RERUN-LOG.txt`, SHA-256
  `1768aa7c711c1be7713bcd3c563b6683af1eac5be81bdcb7ef0b6328a8088d6b`.
- **B4 pin** — the unstamped candidate manifest (SHA-256
  `762818cff5f326355bfc7b7adff5a83e8258d54b4fe4963d5b3a8e0d40f7ad1f`)
  + the battery re-run log pinned in `jedavid33-design/opal-reader`,
  branch `ui1-review`, as commit
  **`86ad06aba6083f7ea84d64b08eac1788d5bf570c`** (single parent
  `385debd9…`; read back verified). Per the build-marker
  convention, this pin is the deployed build stamp (§3 below).
- **B5 envelope** — upload metadata read fresh from the live
  `/settings` surface at build time and carried forward: all 10
  bindings, secrets as `inherit`, `compatibility_date`
  `2026-08-29` + `nodejs_compat`, `main_module`
  `v2/worker-entry-prod-d6.js`, GENERATION_HALT `"1"` (no
  setting flipped). The only differences from the GET
  projection are the two documented artifacts (the DO binding's
  `namespace_id` projection; secrets projected as `secret_text`
  where uploads carry `inherit`) — **no S-4 drift**. Envelope:
  **1,468,164 bytes**, SHA-256
  `c30be0773e9a472cbc40320dcf1ed95e318f764855ea42a39ac9705529ae99ff`;
  multipart round-trip parse verified byte-identical (31 parts
  + metadata).

*Stamp disclosure (the standing convention, named plainly):*
the §4 B2 identity above is verified on the assembled
candidate. The deployed tree then stamps
`v2/host/build-identity.mjs`'s `BUILD_COMMIT` with the B4 pin
(`86ad06ab…`, same byte length, 411 B; stamped part SHA-256
`5d80fe5a6604b1e5ba5649b3853e293e1827b4de2048e5d093980218d52a227c`),
so the deployed tree differs from `parts-e0/` in exactly 3
parts: the 2 candidate parts + the stamped identity part. This
is the operative-manifest practice of every prior deploy in
this program (range-fix record D4), and it is what makes V1
(health stamp == pin) checkable. The full stamped manifest is
in the execution evidence (`deploy-manifest-stamped.json`,
SHA-256
`cfeb0814e9369d1a546149592edb78baf04597288bc991ee58efec08fc622fd2`).

## 3. Deploy (gate §5) — exactly 1 upload; PATCH not needed

- **D1** — ONE multipart PUT of the §2 envelope to
  `opalreader-api-v2-prod` at **2026-11-02T15:32:31Z**:
  **HTTP 200**, `success: true`. Exactly one upload attempt.
- **D2 read-backs** — new script etag
  `ba80e81fc301b3ff001e8ebf4eab11189221d21471261729c28e509a7ce0d7af`
  (changed from `f15fb1ae…`, as required); **31/31 deployed
  parts byte-identical to the stamped manifest**;
  `/script-settings` observability **enabled + `logs.persist:
  true`** — the upload did NOT reset it, so the conditional
  observability PATCH was **not spent** (0 of ≤1).
- **D3** — no ambiguity arose; no re-upload was made or needed.

## 4. Verification (gate §6)

- **V1 Health** — `/health` build
  **`86ad06aba6083f7ea84d64b08eac1788d5bf570c`** == the B4 pin;
  generation `halted`; coordinator `armed`. PASS.
- **V2 Script identity** — etag differs from `f15fb1ae…`
  (required); 31 parts; 28 byte-identical to `parts-e0/`, the
  entry + service parts byte-identical to the §2.2 candidate
  hashes, and the identity part byte-identical to the stamped
  form (§2 disclosure). PASS.
- **V3 Settings surface** — observability enabled +
  `logs.persist: true` (no PATCH needed); settings revision
  still **1**; GENERATION_HALT still `"1"`; exactly 10
  bindings. PASS.
- **V4 Queue** — `delivery_paused: true`; exactly 1 consumer.
  No queue call was made. PASS.
- **V5 First drive-pass observation** — `GET
  /v2/d6-diagnostics?drive=1` (operator surface) read twice:
  - **Obs 1 — 2026-11-02T15:42:57Z** (≈ +10.5 min after the
    upload; the gate's ~+12 min estimate, within platform
    slack): HTTP 200, `mode: "drive_passes"`, `found: false`,
    **`tableState: "missing"`, `drivePasses: []`,
    `recorderHealth: null`**, `alarm: { armedAt:
    1793562576104, pendingSchedule: 2, pendingWatchdog: 1 }`.
  - **Obs 2 — 2026-11-02T15:58:02Z** (≈ +25.5 min): identical
    in every field (only `asOf` advanced).
  - **Classification (C1, stated at its correct strength):
    INCONCLUSIVE.** No rows + no health record is consistent
    with H1 (the alarm chain is not delivering invocations)
    but is **NOT proof** of it: the identical absence is
    produced by (a) H1, (b) every pass failing BOTH recording
    channels together, and (c) a constructor/platform failure
    before handler invocation. Per gate §6 V5, the
    instrumented build is verified live by V1–V4, it is the
    observation instrument, and it is **LEFT IN PLACE**. No
    alarm kick, wake, replay, or other active probe was made
    or is authorized.
  - **One further datum, reported without classification:**
    the read surface's live `getAlarm()` value at both reads
    was **1793562576104 ms = 2026-11-01T19:49:36.104Z** — an
    armed time roughly 20 hours in the past at observation,
    falling inside the diagnostic memo's 1101 onset window
    (~19:46–19:59Z on Nov 1). The executor reports this as an
    observation for Rowan's classification; it is not, by
    itself, proof of any single cause (gate §12).
- **V6 Preservation** — §5 below: 11/11 PASS at both
  observation windows (captures `v1` and `v2`).
- **V7 Record** — this record, its board filing, and the Rowan
  cp.

## 5. Preservation (gate §7) — 11/11 PASS at both windows

Judged census-to-close (census §1 above; captures `v1` ≈ obs 1
and `v2` ≈ obs 2, identical verdicts):

- **P-1** Preserved plan `active`, totals {eligible 1, done 0,
  failed 0, blocked 0, prompts 0}, entry `pending`. PASS.
- **P-2** Its job `queued` rev 1, grants [], quarantine
  `held: false` — the **no-issuance point** of the §7.3
  itemization. PASS.
- **P-3** Exemption projection stands: chapter bound 26 /
  parked 0 / eligible 1; segment 1 / 569 / 8,022. PASS.
- **P-4** GENERATION_HALT `"1"`; `/health` generation
  `halted`. PASS.
- **P-5** Queue `delivery_paused: true`, 1 consumer. PASS.
- **P-6** Conflicts exact-match the 4-row baseline. PASS.
- **P-7** Watermarks: bindings 1841, 0 idx-26 rows, 0 changes
  since seq 1841; content 18. PASS.
- **P-8** Money figures: all five phase figures **frozen
  exact** at census values; quota reconcile `ok: true`, PT
  2026-11-02 dispatched **0**, derived reserved **0**. PASS.
- **P-9** Parked job fingerprint exact, `parked_policy` rev 1,
  grants []. PASS.

### §7.3 movement report

**None.** No grant was issued during the verification window:
grants remained [], the occurrence remained `pending`, the job
remained `queued` rev 1, derived reserved remained 0,
dispatched remained 0, and every phase figure remained frozen.
The pre-classified transition was therefore neither observed
nor needed; no unmatched movement occurred. (Consistent with
the V5 observation: no drive pass observably ran in the
window.)

## 6. Rollback (gate §8)

**Not fired.** No named condition occurred: no RB-1 evidence
(the shipped surfaces answered identically to census, modulo
the new `drive=1` mode itself; no recorder-caused behavior
change is observable — indeed no recorder row exists); RB-2
did not arise (observability survived; no PATCH); no RB-3
preservation failure (11/11 PASS); no RB-4 direction. The
no-rows outcome is explicitly NOT a rollback trigger (§8).
The instrumented build remains deployed as the observation
instrument.

## 7. Mutation tally + ends-HELD certification

| Kind | Budget | Spent |
|---|---|---|
| Forward script uploads | 1 | **1** |
| Observability PATCH after forward upload | ≤1 conditional | **0** (not needed) |
| Rollback upload | ≤1 conditional | **0** (not fired) |
| Observability PATCH after rollback | ≤1 conditional | **0** |
| Commands / settings flips / queue ops / plan-job-exemption ops | 0 | **0** |
| Spend | $0 | **$0** (dispatched 0; provider dispatches today 0) |

**Ends HELD, certified at the closing capture (~16:00Z):**
GENERATION_HALT `"1"`; `/health` generation `halted`,
coordinator `armed`, build `86ad06ab…`; queue
`delivery_paused: true`; settings revision 1; observability
enabled + persisted; preserved plan + job + exemption exactly
as at census; conflicts baseline exact; watermarks frozen.

**Deviations: NONE against the gate.** Two disclosed items are
recorded above at their true strength: the §2 build-stamp
convention (the standing operative-manifest practice, required
by B4/V1) and the §1 census-checker field-name correction
(executor tooling only; no live figure ever differed). Obs 1
was taken at ≈ +10.5 min against the gate's ~+12 min estimate
(the gate's times are estimates allowing platform slack; obs 2
landed at ≈ +25.5 min).

**Next:** Rowan's documentary execution review of this record.
No further production action is authorized by this gate. The
instrumented build stays in place as the observation
instrument; any future reading of `drive=1`, and any
disposition of its INCONCLUSIVE outcome, is for Rowan/Julie
under a fresh decision — this gate's GO is consumed.

— Wren (executor)
