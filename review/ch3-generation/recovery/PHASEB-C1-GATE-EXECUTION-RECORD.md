# C1 CONTAINMENT GATE — EXECUTION RECORD: PASS, ends HELD, exactly 1 mutation; containment deployed INERT at NORMAL (script deployment verified; runtime adoption NOT claimed)

**Executed 2026-11-02, census 20:02:07Z → closing capture
~20:31Z**, under the revised C1 readiness package
(`PHASEB-C1-READINESS-PACKAGE-REVISED.md`), pinned at
`0e19d37116f6b36da02623a85d66aeb7dfcf7d6d` (repo
`jedavid33-design/opal-reader`, branch `ui1-review`).

**Authorization chain:**

- Rowan's PASS of the corrected C1 readiness package:
  board comment **6587099516** (issue #15,
  `jedavid33-design/opal-roundtable`).
- **Julie's GO** for exactly one C1 attempt, recorded on
  the board BEFORE execution: comment **6587119104**,
  Handoff ID `RT-H-20261102-c10001`.
- Execution-start comment **6587141217**, Handoff ID
  `RT-H-20261102-53f8a1` (read back byte-identical).
- The GO is consumed by this attempt.

**Outcome in one paragraph:** the fresh census passed
all 16 package §2 items with zero deviations; the
candidate assembled fresh from the census-downloaded
live parts + the three stored containment-v4 diffs
hashed exactly to the §1.1 identities (exactly 3 parts
differ, 28 byte-identical); the gate-time battery
re-run on the assembled tree passed **42/42 containment
(exit 0)** and **32/32 P2 regression (exit 0)**; exactly
**one** worker upload was made (HTTP 200,
unambiguous); observability survived the upload so the
conditional PATCH was **not** spent; the deployed parts
verify byte-for-byte against the stamped manifest and
`/health` reports the build pin; the containment
surfaces read **NORMAL / absent / verified** with
`stopConfidence: "not_applicable"` — containment is
deployed **inert**, exactly as the gate intends; no
containment transition was performed (budget 0, spent
0); preservation and no-movement checks passed at the
immediate read-back and at both observation windows;
**the gate ENDS HELD**. Mutations spent: **1 forward
upload + 0 PATCH** (rollback not fired — no trigger of
either class occurred). **$0 spent.** No generation,
no SubmitJob, no command, no halt lift, no queue
operation, no alarm interaction.

**Claim strength (package C1-2, stated plainly):** this
record establishes **script deployment verification**
only — the uploaded script's parts match the stamped
manifest byte-for-byte, `/health` reports the build
pin, and the read surfaces exercised during
verification answered on the new build where observed.
It does **NOT** establish **Durable Object runtime
adoption**: existing DO instances adopt new code on
their own lifecycle, no check in this gate observes
per-instance adoption, and the containment code paths
were not exercised operationally (that is C2's
readability scope and C3's operational scope, C3
remaining PARTIAL). No claim in this record should be
read as "the containment code is running" on every
instance.

## 1. Census (package §2) — 16/16 PASS, zero deviations

Census window 2026-11-02T20:02:07Z → 20:02:27Z; all 26
core capture envelopes HTTP 200 with bodies (plus the
item-15 absence probe). Evidence:
`c1-gate-execution/evidence/` (suffix `c0`).

1. **Health** — build
   `86ad06aba6083f7ea84d64b08eac1788d5bf570c`;
   generation `halted`; coordinator `armed`.
2. **Script** — etag
   `ba80e81fc301b3ff001e8ebf4eab11189221d21471261729c28e509a7ce0d7af`
   exact; **31/31 parts byte-identical** to the §1.2
   manifest; observability enabled, `logs.persist:
   true`.
3. **Bindings/settings surface** — exactly 10
   bindings; GENERATION_HALT `"1"`;
   `OPALREADER_PHASE_POLICY` `"enforce"`.
4. **Settings** — revision **1** (lane standard,
   cap $50).
5. **Queue** `opalreader-generation-v2` —
   `delivery_paused: true`; exactly 1 consumer
   (`f260f2188d80426bb0588685e9d084eb`).
6. **Capabilities** — standard admitted; Batch
   `batch_not_armed`; registry binds `forever-pucked`
   ↔ `5c589095-f812-48a2-8ab2-03ba2791f2b2`.
7. **Phase accounting, exact on both surfaces**
   (capabilities + diagnostics): settled **1,029,420**;
   estimatedUnverified **19,018**; reservedUnverified
   **5,648**; inFlightUpper **0**; unknownOpen **0**;
   remaining **12,464,932** of 13,500,000.
8. **Quota** — reconcile `ok: true`, drift empty on
   all pages, totals stable across pages, sole
   exception the known adjudicated straddler
   `att-37d63768-db4b-447d-8150-580b7c6ee257`
   (`estimated_unverified`); PT dispatched totals
   2026-10-29 / 10-30 / 10-31 / 11-01 exactly
   **57 / 79 / 44 / 76**; 2026-11-02 dispatched **0**;
   derived reserved **0**.
9. **Plans — exactly 5:** smoke
   `plan:3183ecbf2ac4bf50bbc6166e` `complete`; old Ch 2
   `plan:603ab416bd67ab1b25de97be` `retired`; fresh
   Ch 2 `plan:b2dc2a3d1cd367a0245b9102` `complete`;
   Ch 3 `plan:e377a5559961b294154276b6` `complete`;
   Phase B `plan:19cad189fab54b9c804a74a6` `active`
   {eligible 1, done 0, failed 0, blocked 0, prompts
   0}, single entry `pending` / `executionState:
   null`, job `plan:19cad189fab54b9c804a74a6:seg`
   `queued` rev 1, quarantine `held: false`, **grants
   []**. No other non-terminal plan; no live grant.
10. **Eligibility** — chapter bound **26** / parked
    **0** / eligible **1**; segment eligible **1** /
    **569** chars / **8,022**; the three scopes'
    digests exactly
    `cdef2c7ec7bb8434b4e2fac66af49983ac7fa4b4e65bb0eda40354be51ff52d1`.
11. **Conflicts** — exact-match to the pinned four-row
    `schedule_dead` lease baseline (ids 1–4, all
    fields).
12. **Parked job** —
    `1832c21fcf0425454227c4736048a8a632f422abca4a2685ddb775bb1681406a`
    `parked_policy` rev 1, fingerprint
    `b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282`
    exact, grants [].
13. **Watermarks + occupancy** — content **18**;
    bindings **1841** entities, **0** rows for
    occurrence `2a85f74f-353d-4c25-a86a-4a4db392868b`,
    **0** changes since seq 1841; the idx-26 R2 key
    FREE (LIST empty).
14. **`drive=1` recorder baseline** — `tableState:
    "missing"`, `drivePasses: []`, `recorderHealth:
    null`; alarm block `armedAt` **1793562576104**
    (= 2026-11-01T19:49:36.104Z), `pendingSchedule`
    **2**, `pendingWatchdog` **1** — all bit-identical
    to the Nov 2, 2026 P2-gate observations; the
    `drive=1` containment projection read `null` on
    the live build, as expected pre-deploy.
15. **Containment absence pre-deploy** — the live
    build contains no containment code (proven by
    item 1's build stamp); the `GET
    /v2/d6-containment` probe returned the live
    build's generic unknown-route refusal (HTTP 401,
    byte-identical to the response for a nonsense
    `/v2/*` path probed for comparison) and no
    containment state.
16. **No work in flight** — Julie's GO (6587119104)
    and the execution-start comment (6587141217) were
    recorded on the board before the census began; no
    other gate or operator action was outstanding.

*Census tooling note (disclosed):* the first checker
run reported item 8 as FAIL on a checker field
assumption — it looked for the current PT day in
`dayTotals`, which carries only days with ledger
history; the current day is carried in `totals`
(`dayKey: 2026-11-02`, `dispatched: 0`), the same
shape as at the P2 census. The raw reads were
inspected firsthand, the checker corrected, and the
corrected run over the SAME captured reads passes
16/16. No live figure differed from its expectation
at any point.

## 2. Build stage (package §1.3) — PASS

- **Assembly** — all 31 parts copied fresh from the
  census download (`evidence/parts-c0/`); the three
  stored containment-v4 diffs applied (`patch -p1`;
  diff SHA-256s re-verified against §1.1:
  coordinator `53306786…`, entry `0d0fdf6a…`, service
  `9b522495…`). Exactly **3 parts differ** from the
  downloaded live parts, each hashing exactly to its
  §1.1 identity:
  - coordinator `v2/coordinator.mjs` — 313,063 B,
    SHA-256 `6c19a50e…`;
  - entry `v2/worker-entry-prod-d6.js` — 136,357 B,
    SHA-256 `2bb0608b…`;
  - service `v2/generation/service.mjs` — 91,500 B,
    SHA-256 `5c5183e6…`.
  The other **28 parts are byte-identical**; part
  count **31**; `node --check` clean on all three
  changed parts. Unstamped assembled manifest SHA-256
  `34045a085d9319c32bb851805b32bbea9b092a515e59d1e54f051a80a3ba7ef9`.
- **Battery re-run** — on the gate-assembled
  (unstamped) tree, per §8:
  - containment battery v4 incl. CT14d: **42/42 pass,
    exit code 0**;
  - P2 parameterized regression against the suites-v4
    containment fixture: **32/32 pass, exit code 0**.
  Combined log: `BATTERY-RERUN-LOG.txt`, SHA-256
  `ffa4e58ab4fe347db9d577d0d716c361af252cbaecf108dddfbdc0e8a3329fda`,
  pinned with the build pin (below).
  *Disclosed:* a first P2 invocation passed
  `P2_BASE_DIR` = the live instrumented tree and
  failed 3 BASE-dependent tests (29/32, exit 1) — the
  documented harness-semantics operator error (the
  suite's BASE is the unmodified pre-instrumentation
  build; every candidate-identity assertion passed in
  that run). The log is preserved in the gate
  evidence (`build/p2-rerun.log`); the operative run
  at the suite-default BASE is the 32/32 run above,
  matching §8's standing results with no divergence.
- **Build pin** — the unstamped candidate manifest +
  the battery re-run log pinned in
  `jedavid33-design/opal-reader`, branch `ui1-review`,
  as commit **`27b2b3a9f1e7070ef243ee017703246744d57d5c`**
  (single parent `0e19d371…`; per-blob SHA assertions
  passed; read back verified). Per the build-marker
  convention, this pin is the deployed build stamp.
- **Stamp** — `v2/host/build-identity.mjs`'s
  `BUILD_COMMIT` replaced with the build pin (same
  40-character length; the part stays 411 B; stamped
  part SHA-256
  `873d6cb902e2ae275cf1ec4a6300f019ceb22bb2f804c59e2d8cecdc0670d275`).
  The deployed tree therefore differs from live in
  exactly **4 parts**: the 3 candidate parts + the
  stamped identity part. Stamped manifest SHA-256
  `a781c046111e8057df4a945bfe02b9edfab65b510cdae856ebd5688ad701cbc1`
  (evidence: `build/deploy-manifest-stamped.json`).
- **Envelope** — upload metadata read fresh from the
  live `/settings` surface at census and carried
  forward: all 10 bindings, secrets as `inherit`,
  `compatibility_date` `2026-08-29` + `nodejs_compat`,
  `main_module` `v2/worker-entry-prod-d6.js`,
  GENERATION_HALT `"1"` (no setting flipped). Content
  identical to the P2 gate's proven envelope metadata
  (the only difference is binding array order, which
  follows the fresh GET's own ordering — no drift
  beyond the two documented GET-projection artifacts:
  the DO binding's `namespace_id` projection; secrets
  projected as `secret_text` where uploads carry
  `inherit`). Envelope: **1,517,296 bytes**, SHA-256
  `b9a6177c33e1307b890ca72cbac213f71ec9cc88d65869ff5f19616fa51e56e0`;
  multipart round-trip parse verified byte-identical
  (31 parts + metadata).
- **Rollback basis preserved** — the census-downloaded
  live parts (build `86ad06ab…`) are preserved
  byte-identical in `evidence/parts-c0/` as the
  rollback upload source. The rollback was not fired
  (§4).

## 3. Deploy (package §3) — exactly 1 upload; PATCH not needed

- **D1** — ONE multipart PUT of the envelope to
  `opalreader-api-v2-prod` at **2026-11-02T20:05:27Z**:
  **HTTP 200**, `success` implied by the script
  resource response (`deployment_id
  0148a34efb0f401dbc85265624b9dd5d`). Exactly one
  upload attempt; no ambiguity arose; no re-upload
  was made or needed.
- **D2 read-backs** — new script etag
  `adb8e5a5b104858a20835a17ffd714a70f72cea5e066c6d61c4b80a49adac46f`
  (changed from `ba80e81f…`, as required); **31/31
  deployed parts byte-identical to the stamped
  manifest**; `/script-settings` observability
  **enabled + `logs.persist: true`** — the upload did
  NOT reset it, so the conditional observability
  PATCH was **not spent** (0 of ≤1).

## 4. Rollback (package §3.1/§3.2)

**Not fired.** No §3 trigger of either class occurred:
no T1 (D2 parts byte-identical to the stamped
manifest), no T2 (`/health` stamp == build pin,
`halted`, `armed`), no T3 (settings/bindings/
observability all exact at every read), no T4 (the
containment surfaces answered NORMAL / absent /
verified with `stopConfidence: "not_applicable"` at
every read), no T5 (preservation exact at every
window), no T6 (`armedAt` bit-identical at every
read). No finding required classification; the class
A/class B machinery was not exercised.

## 5. Verification (package §5) — V1–V7 PASS at the immediate set and both windows

Window 1 — capture start 2026-11-02T20:15:27Z (+10 min
after the upload), `verify_check.py evidence v1`:
**7/7 PASS, exit 0.** V1 health (build == build pin,
halted, armed); V2 etag
`adb8e5a5b104858a20835a17ffd714a70f72cea5e066c6d61c4b80a49adac46f`,
31/31 parts == stamped manifest; V3 rev 1 / 10
bindings / HALT "1" / enforce / observability
enabled+persist; V4 queue paused, sole consumer;
V5 containment NORMAL / absent: true / verified:
true, `stopConfidence: "not_applicable"`, recorder
unchanged (tableState missing, recorderHealth null),
`armedAt` 1793562576104 bit-identical, pending 2/1;
V6 preservation exact vs census (plan active {1,0,0,0},
job queued rev 1, grants [], conflicts 4, watermarks
18/1841, phase + fingerprint exact); V7 no movement
(grants [], occurrence pending, derived reserved 0,
dispatched 2026-11-02 = 0, plans exactly 5).

Window 2 (closing set) — capture
2026-11-02T20:30:45Z–20:31:36Z (+25 min after the
upload), `verify_check.py evidence v2`: **7/7 PASS,
exit 0**, every item identical in substance to window
1 (same etag, same containment read, same alarm
fields, same preservation figures).

No trigger T1–T6 fired at any capture; no finding
required §3.1 classification; rollback was not fired
(and, no Class A defect having been confirmed, the
conditional rollback budget expires unspent with the
attempt). **Ends HELD certified at the closing
capture: GENERATION_HALT "1" and queue
delivery_paused true, both by read-back.**

**What this establishes (C1-2):** script deployment
verification only, as stated in the header. Runtime
adoption by existing DO instances is **NOT** claimed
and remains unresolved (package §6, item C1-R2); the
containment code paths were not exercised
operationally — no transition was performed, and the
tables' absence on the state reads is the read
discipline's structurally verified NORMAL, observed
through the new build's read surfaces where those
surfaces were served by an instance answering on the
new build.

## 6. Mutation tally + ends-HELD certification

| Kind | Budget | Spent |
|---|---|---|
| Forward script uploads | 1 | **1** |
| Observability PATCH after forward upload | ≤1 conditional | **0** (not needed) |
| Rollback upload (class A only) | ≤1 conditional | **0** (not fired) |
| Observability PATCH after rollback | ≤1 conditional | **0** |
| Containment transitions | 0 | **0** |
| Commands / reports / SubmitJob | 0 | **0** |
| Hold flips / settings flips / queue ops | 0 | **0** |
| Alarm registrations caused by this gate | 0 expected | **0** (`armedAt` bit-identical at every read) |
| Recorder rows | 0 expected | **0** (`tableState: "missing"` at every read) |
| Spend | $0 | **$0** (dispatched 0; provider dispatches today 0) |

**Ends HELD, certified at the closing capture:**
GENERATION_HALT `"1"`; `/health` generation `halted`,
coordinator `armed`, build `27b2b3a9…`; queue
`delivery_paused: true`; settings revision 1;
observability enabled + persisted; containment
NORMAL / absent / verified; preserved plan + job +
exemption exactly as at census; conflicts baseline
exact; watermarks frozen.

**Deviations against the package: NONE.** Two
executor-tooling items are disclosed above at their
true strength: the §1 census-checker current-day
field correction and the §2 first P2 battery
invocation's BASE error — both in executor tooling
only; no live figure and no candidate byte ever
differed from its expectation, and the operative runs
pass in full. The upload response's observability
projection shows `persist: null` in its logs object;
the authoritative `/script-settings` read-back shows
`enabled + persist: true` at every capture — the same
GET-projection artifact family documented at prior
deploys, not a reset.

**Next:** Rowan's independent execution review of
this record. No further production action is
authorized by this gate. C2 (passive readability
verification), any containment transition, R5a-D, and
S1 each require their own scope and authorization —
this gate's GO is consumed.

— Wren (executor)
