# Phase B — Gate C1 READINESS PACKAGE (containment deployment)

**Status: READINESS PAPERWORK ONLY. C1 is NOT executed by
this package, and no GO is requested by it.** Rowan's
review of this package is not a GO; a production GO for
C1 remains a separate future step (Julie's explicit GO,
after Rowan's review). Production is under INVESTIGATION
HOLD and ends HELD. This package authorizes nothing.

**Assignment:** Rowan's ruling on the V4 corrections
(PASS — corrections round CLOSED; recorded at
`ROWAN-V4-CORRECTIONS-PASS.md`): "Prepare a focused C1
deployment-gate readiness package for independent Rowan
review. Include the exact pinned candidate identity,
fresh preflight requirements, mutation and rollback
bounds, observability checks, unresolved risks, and
explicit GO wording. Do not execute C1 or any other
gate."

**Gate structure:** C1 is the containment-deployment
scope of the accepted five-scope structure (C1 / C2 /
C3 / R5a-D / S1, plus standalone restoration and the
R3-V micro-scope) in `PHASEB-RECOVERY-GATES-V4-REVISED.md`
(pin `621535f0456e3d61cc7bcbc2fda04f661dc63e49`). The
design authority is `PHASEB-CONTAINMENT-DESIGN-V4-REVISED.md`
(same pin). The deploy mechanics follow the proven P2
instrumentation gate pattern (execution record
`PHASEB-INSTRUMENTATION-GATE-EXECUTION-RECORD.md`, pin
`0e8f802fbcdf842a342d876f7510c440ded57e04`): fresh census
→ fresh assembly → battery re-run → build pin → ONE
upload → read-back verification → ends HELD.

## 0. What C1 is — and is not

**C1 deploys code only.** It uploads the containment V4
candidate (§1) to the production worker
`opalreader-api-v2-prod` as a single script upload and
verifies the deploy with passive reads. It ends with:

- containment **INERT at NORMAL** — no transition is
  performed; the containment tables are created ONLY by
  a transition (verified in the candidate source, §1.4),
  so a bare deploy creates nothing and the state reads
  **absent = structurally verified NORMAL**;
- the system **HELD**: GENERATION_HALT `"1"`, queue
  `opalreader-generation-v2` delivery paused, the
  Generate button NOT live;
- the preserved Phase B plan, the idx-26 exemption, the
  parked job, and every other production fact exactly
  as at census.

**C1 is not:** a containment transition of any kind; C2
readability verification (a separate zero-mutation
scope that follows C1); C3 operational verification;
the R5a deployment (the COMPOSED tree is R5a-D's
subject and is explicitly NOT what C1 deploys); any
alarm interaction, wake, command, report, SubmitJob,
hold flip, or queue change; any generation. C1 does
not touch the preserved plan
`plan:19cad189fab54b9c804a74a6` or the live idx-26
exemption in any way.

## 1. Exact pinned candidate identity

### 1.1 The three changed parts (verified firsthand)

The candidate is the **containment V4 candidate tree**
(`containment-v4/candidate-tree/`): the current live
deployed tree plus the containment v4 code, in exactly
**3 of 31 parts**. Identities below were re-computed
from the candidate tree and re-diffed against the live
baseline during this package's preparation (Nov 2,
2026) — they match `containment-v4/CANDIDATE-IDENTITIES.md`
and `CANDIDATE-IDENTITIES-REVISED.md` exactly:

| part | bytes | SHA-256 (candidate) | SHA-256 (live) | diff vs live |
|---|---|---|---|---|
| `v2/coordinator.mjs` | 313,063 | `6c19a50e88d8bc00d357f7a5facf33ed8425b53daa20e8d700037f9fd121b2f2` | `bca88fe92bfd316c727866f7f69817e290fc8167006d32362577010c2037e20a` (276,256 B) | **+753/−0** |
| `v2/worker-entry-prod-d6.js` | 136,357 | `2bb0608b589a084ca275428c3236c24680f4a4692afe2245dfcb2880257983c1` | `45daf26ca850835c698863cb08ca39a8c6f1b2f1450488d1e710f0cd87d7c4ab` (127,131 B) | **+175/−3** |
| `v2/generation/service.mjs` | 91,500 | `5c5183e664218b9746c497e9456af45c7467a8ace66fd1b9ef0928eccb3c7c14` | `41f27492447296f25f958836a65d8e04592c2ba3cd330a2d2854ed98433eefda` (88,070 B) | **+73/−2** |

Stored unified diffs (in `containment-v4/`, `patch -p1`
-applicable): `coordinator.diff` SHA-256
`53306786125545df00d6993bfa1f28cfbefdc84e321b601e7995d38823ad224b`;
`entry.diff` SHA-256
`0d0fdf6aff6ae8126c20bb075da071fd55021936231288fc080d8e590d8fde75`;
`service.diff` SHA-256
`9b52249525bbafa84f4f640a6dc50431b2627bd80616771d61308a1be1701b65`.
Round-trips were verified byte-for-byte in the V4
package: live → candidate, parts-e0 → candidate, and
v3 candidate → v4 candidate all reproduce the candidate
parts exactly. Diff line counts were re-measured during
this package's preparation and match the table above.

### 1.2 The basis: the current live tree (full 31-part manifest)

The deploy basis is the **CURRENT live tree**: the P2
instrumented build, build stamp
`86ad06aba6083f7ea84d64b08eac1788d5bf570c`, script etag
`ba80e81fc301b3ff001e8ebf4eab11189221d21471261729c28e509a7ce0d7af`
(both observed Nov 2, 2026 at the P2 gate; etag re-read
fresh at any C1 census). The candidate derives from
this tree and from no other. `containment-v4/baseline-tree/`
is a byte copy of it, spot-verified at copy time; the
P2 gate's census-downloaded parts are the same bytes.

The other **28 parts are byte-identical** between live
and candidate, including `v2/host/build-identity.mjs`
(411 B, SHA-256
`5d80fe5a6604b1e5ba5649b3853e293e1827b4de2048e5d093980218d52a227c`,
stamping `86ad06ab…` in both trees — see §1.3 for the
gate-time stamp). Full manifest (SHA-256 / bytes; the
three changed parts appear with their candidate values
in §1.1 and their live values here):

| part | bytes (live) | SHA-256 (live) |
|---|---|---|
| `v2/api.mjs` | 13,632 | `9b1d0eba128c972b5329020018fefc10b0db9250f3134393de190d54e4e3237d` |
| `v2/audio-route.mjs` | 15,965 | `b6383d21be32f119271e1d39f3894bd7f84b15ac1be4c38655601d1dee20d616` |
| `v2/coordinator.mjs` | 276,256 | `bca88fe92bfd316c727866f7f69817e290fc8167006d32362577010c2037e20a` |
| `v2/executor.mjs` | 13,974 | `5c6db175e68abdf727bf2e1d1a23626be0651db3c6eb48dd4af9e7f7d4ee14c9` |
| `v2/generation/binding-projection.mjs` | 12,818 | `d100f02ce199bbcd6935569c8daabadbd6783d79b0bf1abd41f811e5763d8654` |
| `v2/generation/content-plane-adapter.mjs` | 8,150 | `d8db2cbab33f16a5909fae0e74af672eed93b77b4f917f63d332cd3a221ba9c7` |
| `v2/generation/d6-executor.mjs` | 46,660 | `c3613a818f598a2fc9f0f975312ad76879edab6bdffcdd06fe3fb2e3b123984c` |
| `v2/generation/d6-work-source.mjs` | 5,981 | `8fa929b2d283084542d9dc76c1e75278d9f5ea4ed7a8d94540e55bef45e05006` |
| `v2/generation/eligible-set.mjs` | 7,284 | `a9932a82ab3a81eeca38a80d3a555b56951a1d4dcef02fcf686bd9a9a264d1f7` |
| `v2/generation/flush-store.mjs` | 8,497 | `e8f622bf4ed8745dd342cdbdd8d66f2a59a586ce034e8e1b1e21d68a2460f325` |
| `v2/generation/gen-constants.mjs` | 4,936 | `9af664fafc61dff1c16de8f94d06c0097271313bae7327d2a9a9d16efe14c77d` |
| `v2/generation/gen-schema.mjs` | 5,307 | `d7ae4936b11fe0d01c9ff8a6e1ccbb7364541ecad7d012b8fc3e712a453aacc5` |
| `v2/generation/genstore.mjs` | 48,703 | `811b6b15b790097ad0010be3c71881c5024331143b4b0e2031392287bb839c2a` |
| `v2/generation/grant-finalizer.mjs` | 40,172 | `0da45d8e6d156d1fc7441ce97e3338aa2a9e143a5560d640ee909c5727f8c076` |
| `v2/generation/grant-guards.mjs` | 12,936 | `9249539fb867fb086338c72840539dcd130062772631a523e2b4373fc5487629` |
| `v2/generation/park-release.mjs` | 29,126 | `ba2952af66ee64f81491b003b7e8f225af7ccbafb15adeedeff34e41ac87f6bd` |
| `v2/generation/phase-policy.mjs` | 7,299 | `09883c40e365815f48cc9cb9d3bfdf1908f994b809c73ba27535638c7607f37f` |
| `v2/generation/policy-split.mjs` | 15,074 | `61dc00148c803cb7f6b2eead2ca12caf707a3653bb3d0f7f5c97c9d8fa997876` |
| `v2/generation/prefix-range.mjs` | 3,628 | `a6546b3e94247adcd4215aa1ed4ab691a2595520a2783dd67849056a498da514` |
| `v2/generation/quarantine.mjs` | 15,752 | `64a491f3b1345219cb8816b80252908df9aaaadbd67e910547658aa9ade0fe62` |
| `v2/generation/quota-budget.mjs` | 42,048 | `2b39924579e5af2d5d20eea01122d2323ccedac9fe9ff9f7026c49af14770820` |
| `v2/generation/service.mjs` | 88,070 | `41f27492447296f25f958836a65d8e04592c2ba3cd330a2d2854ed98433eefda` |
| `v2/host/adapters.mjs` | 39,224 | `f8ac357e3ca4d23bb9edd46dab1843257d26c6fafe6a52b3fffaff676a749368` |
| `v2/host/build-identity.mjs` | 411 | `5d80fe5a6604b1e5ba5649b3853e293e1827b4de2048e5d093980218d52a227c` |
| `v2/p8/approved-freeze-carry.mjs` | 57,703 | `24ddc8ee428e6e161fc2114af9a572f348db5959977402090539163cacb5bb46` |
| `v2/p8/approved-freeze-chunks.mjs` | 6,101 | `b49cfcfcaf656d957f0c828566d390d6b2bc4b25238885fa60c3e3293563f06a` |
| `v2/p8/approved-freeze-manifest.mjs` | 467,075 | `e59ab3d37245cc049d23215e0538933d633621ceb3fd29e48afdcda07e519edd` |
| `v2/p8/migration-chunk-limits.mjs` | 4,733 | `886c8ea6d79dd6d2014976c50e23fe6553fd3d0ff81dd1f5f2337bf109b0fe41` |
| `v2/worker-entry-prod-d6.js` | 127,131 | `45daf26ca850835c698863cb08ca39a8c6f1b2f1450488d1e710f0cd87d7c4ab` |
| `v2/worker-entry-prod.js` | 14,480 | `1d2f333a75a3ffff3d4e7c9454f218ba8a8042fab179fcd4f50031c6d80a27c5` |
| `v2/worker-entry.js` | 21,520 | `91daefdd4778599db83024b074a5c4e78ef4d396a5d815712b381d40f72bd6e5` |

**Explicitly NOT the C1 candidate:** the composed tree
(coordinator `5303cb63…`) carries the R5a arming change
in addition to containment. It is R5a-D's subject.
Deploying it under C1 would exceed this gate's scope.

### 1.3 Gate-time assembly, build pin, and stamp (P2 pattern)

A C1 execution assembles its upload tree fresh, exactly
as the P2 gate did (its §4, steps B1–B5):

1. **Fresh assembly.** All 31 parts are downloaded from
   the live script at census and verified byte-for-byte
   against §1.2. The three stored diffs (§1.1) are
   applied (`patch -p1`). The executor asserts: exactly
   3 parts differ from the downloaded live parts, each
   hashing exactly to its §1.1 identity; the other 28
   byte-identical; part count 31; `node --check` clean
   on the three changed parts.
2. **Battery re-run** on the gate-assembled tree (§8) —
   complete runs, logs + exit codes captured.
3. **Build pin.** The unstamped assembled manifest + the
   battery re-run logs are pinned as ONE commit on
   `ui1-review` (repo `jedavid33-design/opal-reader`).
   Per the standing build-marker convention, that pin
   becomes the deployed build stamp.
4. **Stamp.** `v2/host/build-identity.mjs`'s
   `BUILD_COMMIT` is replaced with the build pin (same
   40-character length; the part stays 411 B). The
   deployed tree therefore differs from live in exactly
   **4 parts**: the 3 candidate parts + the stamped
   identity part. The full stamped manifest is computed
   and recorded before upload; `/health`'s build stamp
   == the build pin is verification item V1 (§5). This
   is the same convention the P2 gate disclosed and
   executed; the §1.1 identities are verified on the
   assembled (unstamped) candidate.
5. **Envelope.** Upload metadata is read fresh from the
   live `/settings` surface at build time and carried
   forward unchanged: all 10 bindings, existing secrets
   as `{"type":"inherit"}`, `compatibility_date`
   `2026-08-29` + `nodejs_compat`, `main_module`
   `v2/worker-entry-prod-d6.js`, GENERATION_HALT `"1"`
   (no setting flipped). The multipart envelope is
   round-trip parsed and verified byte-identical (31
   parts + metadata) before upload. Any metadata drift
   vs the live read beyond the two documented GET
   -projection artifacts (the DO binding's
   `namespace_id` projection; secrets projected as
   `secret_text` where uploads carry `inherit`) is a
   STOP (§7).
6. **Rollback basis preserved.** The census-downloaded
   live parts (build `86ad06ab…`, §1.2) are preserved
   byte-identical as the rollback upload source (§3).
   The permanent rollback floor (`6a73d962…`) is NOT a
   rollback target for this gate and remains untouched.

### 1.4 Why a bare deploy ends inert (source-verified)

In the candidate, the containment DDL
(`CONTAINMENT_SCHEMA`: tables `d6_containment_state`,
`d6_containment_events`) is executed at exactly two
call sites, both inside transition methods of
`v2/coordinator.mjs` — `applyContainmentTransition`
(line 2872) and `_verifyChainStop` (line 3068).
`readContainmentState` never writes and never creates
tables. A deploy invokes no DO method; ordinary reads
on the new build therefore create nothing, and the
containment state reads **absent**, which the read
discipline defines as structurally verified NORMAL
(design v4 revised). The tables come into existence
only when a transition runs — and no transition runs
in C1 (budget: 0, §3).

## 2. Fresh preflight census (hard expectations)

A C1 execution begins with a fresh census. **Every
value below is a hard expectation to be re-read fresh
at execution time — never a presumed current fact.**
Values observed on Nov 2, 2026 (at the P2 gate census
and its verification windows) are labeled with that
date per the R6 evidence discipline. Any deviation on
any item = **STOP before upload**; the executor's own
tracing never clears its own stop, and no deviation is
self-cleared or retried inside the same GO.

Items 1–13 mirror the P2 gate census, re-based to the
current live build. Items 14–16 are containment
-specific to C1.

1. **Health** — build
   `86ad06aba6083f7ea84d64b08eac1788d5bf570c`;
   generation `halted`; coordinator `armed`.
2. **Script** — etag
   `ba80e81fc301b3ff001e8ebf4eab11189221d21471261729c28e509a7ce0d7af`;
   **31/31 parts byte-identical** to the §1.2 manifest;
   observability enabled, `logs.persist: true`.
3. **Bindings / settings surface** — exactly **10**
   bindings; GENERATION_HALT `"1"`;
   `OPALREADER_PHASE_POLICY` `"enforce"`.
4. **Settings** — revision **1** (lane standard,
   cap $50).
5. **Queue** `opalreader-generation-v2` (id
   `93b6a35fb8cf4788a91a2c90b748ae66`) —
   `delivery_paused: true`; exactly **1** consumer
   (`f260f2188d80426bb0588685e9d084eb`). (The queue
   state cannot be read by the Worker; cf-api read-back
   is the proof, as at every prior census.)
6. **Capabilities** — standard admitted; Batch
   `batch_not_armed` (`d6StandardOnly`); phase registry
   binds `forever-pucked` ↔ bookId
   `5c589095-f812-48a2-8ab2-03ba2791f2b2`.
7. **Phase accounting, exact on both surfaces**
   (capabilities + diagnostics): settled **1,029,420**;
   estimatedUnverified **19,018**; reservedUnverified
   **5,648**; inFlightUpper **0**; unknownOpen **0**;
   remaining **12,464,932** of 13,500,000;
   `unverifiedStatus: provider_unverified`.
8. **Quota** — reconcile `ok: true`, drift empty,
   totals stable across pages; sole exception the known
   adjudicated straddler
   `att-37d63768-db4b-447d-8150-580b7c6ee257`
   (`estimated_unverified`, never dispositionable). PT
   dispatched totals (PT day rolls 07:00Z): 2026-10-29
   = **57**, 2026-10-30 = **79**, 2026-10-31 = **44**,
   2026-11-01 = **76**, 2026-11-02 = **0** (observed
   Nov 2, 2026); **no dispatches on any PT day after
   2026-11-01** — if the gate runs on a later day, that
   day must read 0 and every intervening day 0.
   Derived reserved **0**.
9. **Plans — exactly 5:** smoke
   `plan:3183ecbf2ac4bf50bbc6166e` `complete`; old Ch 2
   `plan:603ab416bd67ab1b25de97be` `retired`; fresh
   Ch 2 `plan:b2dc2a3d1cd367a0245b9102` `complete`;
   Ch 3 `plan:e377a5559961b294154276b6` `complete`;
   **preserved Phase B plan
   `plan:19cad189fab54b9c804a74a6` `active`**, totals
   {eligible 1, done 0, failed 0, blocked 0, prompts
   0}, single entry (FP chapterIndex 2, idx 26,
   occurrenceId
   `2a85f74f-353d-4c25-a86a-4a4db392868b`, 569 chars)
   `pending` / `executionState: null`; its job
   `plan:19cad189fab54b9c804a74a6:seg` `queued` rev 1,
   quarantine `held: false`, **grants []**. No other
   non-terminal plan; no live grant.
10. **Eligibility** — chapter bound **26** / parked
    **0** / eligible **1**; segment eligible **1** /
    **569** chars / **8,022** units; the chapter,
    segment, and book scopes' digests mutually
    consistent at
    `cdef2c7ec7bb8434b4e2fac66af49983ac7fa4b4e65bb0eda40354be51ff52d1`
    (the post-exemption digest standing since Phase B
    attempt 3).
11. **Conflicts** — exact-match to the pinned four-row
    `schedule_dead` lease baseline: id 1 @
    2026-10-29T23:54:14.808Z (`grant:plan:3183ecbf…:seg:1:full`);
    id 2 @ 2026-10-30T00:24:14.632Z
    (`grant:plan:603ab416…:ch1:1:full`); id 3 @
    2026-10-31T05:14:24.089Z (`grant:plan:b2dc2a3d…:ch1:1:full`);
    id 4 @ 2026-11-01T01:04:30.364Z
    (`grant:plan:e377a555…:ch2:1:full`); all cache_key
    `lease`, expected `7`, found `LIKE or GLOB pattern
    too complex: SQLITE_ERROR`, reason `schedule_dead`.
12. **Parked job** —
    `1832c21fcf0425454227c4736048a8a632f422abca4a2685ddb775bb1681406a`
    `parked_policy` rev 1, definition fingerprint
    `b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282`
    exact, grants [].
13. **Watermarks + occupancy** — content **18**;
    bindings **1841**, **0** binding rows for the
    idx-26 occurrence, **0** changes since seq 1841;
    the idx-26 R2 key
    (`audio/07d145f7b87b9621497d3b8a2c5828141592b94425fd5696fffedde9957d9590`)
    **FREE** (LIST empty).
14. **`drive=1` recorder baseline** (last observed
    Nov 2, 2026 at the P2 gate, reads at 15:42:57Z and
    15:58:02Z, identical): `tableState: "missing"`,
    `drivePasses: []`, `recorderHealth: null`; alarm
    block: `armedAt` **1793562576104** =
    2026-11-01T19:49:36.104Z, `pendingSchedule` **2**,
    `pendingWatchdog` **1**. Hard expectations: the
    recorder fields exact; **`armedAt` bit-identical**
    — both prior deploys (range-fix, P2) left the armed
    value unchanged, and a deploy is not a wake; an
    `armedAt` that already differs at census means
    something else moved first = STOP and classify
    before anything else. On the live (pre-containment)
    build the `drive=1` containment projection reads
    `null` (the shipped service duck-types the absent
    coordinator method to null) — that null is the
    expected pre-deploy value.
15. **Containment absence pre-deploy** — the live build
    contains no containment code and no containment
    surface: `GET /v2/d6-containment` is not a route on
    it, and no code path that could create the
    containment tables exists on it. The expectation is
    the mechanism's ABSENCE, proven by census item 1
    (the live build stamp). There is no containment
    state to inspect pre-deploy; post-deploy absence is
    verified through the new build's read surfaces (§5,
    V5).
16. **No work in flight** — no gate executing, no GO
    outstanding or partially consumed, no operator
    action pending; the executor records the GO
    (§7) on the board BEFORE the census begins, as at
    prior gates.

## 3. Mutation bounds and rollback

| Write class | Bound | Notes |
|---|---|---|
| Forward worker script uploads | **exactly 1** | 31 parts, byte-identical to the stamped manifest (§1.3) |
| Observability PATCH after forward upload | **≤1, conditional** | ONLY if the post-upload read shows observability reset (§4) |
| Rollback uploads | **≤1, conditional** | ONLY on the named triggers below; the byte-identical preserved live parts (§1.3 item 6) |
| Observability PATCH after rollback | **≤1, conditional** | Same condition, after a rollback upload |
| Containment transitions | **0** | No `contain_drive`, no `stop_chain`, no `clear`, no `verify_chain_stop` |
| Commands / reports / SubmitJob | **0** | — |
| Hold flips / settings flips / queue changes | **0** | GENERATION_HALT stays `"1"`; queue stays paused |
| Alarm registrations caused by this gate | **0 expected** | A deploy is not a wake; any `armedAt` change is a finding to classify (trigger T6), not a budget item |
| Recorder rows | **0 expected** | The recorder writes only from the alarm handler |
| Spend | **$0** | No dispatch is possible under the holds; dispatched must remain 0 (§5, V7) |

**Rollback triggers (named; any one fires rollback
evaluation inside the same GO):**

- **T1** — post-upload read-back parts not
  byte-identical to the stamped manifest.
- **T2** — `/health` build stamp ≠ the build pin, or
  generation not `halted`, or coordinator not `armed`.
- **T3** — settings/bindings regression: settings
  revision ≠ 1, bindings ≠ 10, GENERATION_HALT ≠ `"1"`,
  phase policy ≠ `enforce`, or observability not
  restorable within the §4 budget.
- **T4** — containment surface misbehavior: the state
  route or the `drive=1` containment projection errors,
  reports any state other than NORMAL, reports
  `verified: false` against an absent store, or
  `stopConfidence` ≠ `"not_applicable"` at rest.
- **T5** — any §5 preservation item fails: a change vs
  census in the preserved plan, its job, the exemption
  projection, the parked job, the conflicts baseline,
  any phase figure, quota, or the watermarks that is
  not fully explained by the deploy itself (the deploy
  explains ONLY the script etag and build stamp
  changing).
- **T6** — `armedAt` changed across the upload
  (unexplained alarm-registration movement).

**Rollback shape and limits.** Rollback = ONE upload
of the preserved byte-identical live parts (build
`86ad06ab…`) + D2-style read-back + ≤1 conditional
observability PATCH, then the §5 verification set
re-run against the restored build. Rollback removes
the containment CODE. It cannot un-create the
containment tables — none are created in C1, because
no transition runs (§1.4); un-fire any alarm — none is
provoked; or un-issue any grant — none can issue:
drive behavior in NORMAL is unchanged by the candidate
(the containment gates default open at NORMAL/absent)
and the system is held. If rollback itself fails or
its read-back mismatches, the executor STOPs, holds,
and reports — no second rollback attempt inside the
same GO. **Any rollback after the gate closes needs
its own authorization.** Ends HELD in every path,
including the rollback path.

## 4. Observability checks

Standing deploy law (every Worker code upload): an
upload can silently reset script-settings observability
to null; it must be checked and, if reset, re-applied —
and the settings PATCH must not touch code.

- **Pre-upload:** census item 2 records observability
  enabled + `logs.persist: true` from the
  script-settings read.
- **Post-upload:** the D2 read-back re-reads
  script-settings. Precedent: observability SURVIVED
  both the range-fix deploy and the P2 upload (PATCH
  unspent both times) — survival is the expectation,
  not an assumption.
- **If reset:** re-apply via a multipart PATCH to
  `/workers/scripts/{name}/settings` — the settings
  WRITE path (the GET path `/script-settings` accepts
  no PATCH) — with a single part named `settings`
  (Content-Type application/json) carrying ONLY the
  observability object (enabled + logs persisted).
  Then verify: observability enabled + persisted on
  re-read, AND the script etag unchanged by the PATCH
  (the settings PATCH does not touch code). The PATCH
  counts against the §3 budget (≤1 per upload leg).
- **If observability cannot be restored within
  budget:** STOP; rollback evaluation under trigger
  T3.

## 5. Post-deploy verification (read-only)

All verification is passive reads. Two observation
windows, mirroring the P2 gate's practice: an immediate
post-deploy set and a second set after a platform-slack
interval (the P2 gate used ≈ +10 min and ≈ +25 min);
preservation must pass at both.

- **V1 Health** — `/health` build stamp == the §1.3
  build pin; generation `halted`; coordinator `armed`.
- **V2 Script identity** — new etag ≠ the census etag
  (required); 31 parts; **27 byte-identical to live**,
  the 3 code parts byte-identical to their §1.1
  candidate hashes, the identity part byte-identical
  to its stamped form.
- **V3 Settings surface** — revision still **1**;
  exactly 10 bindings; GENERATION_HALT `"1"`; phase
  policy `enforce`; observability per §4.
- **V4 Queue** — `delivery_paused: true`, exactly 1
  consumer (cf-api read-back; the gate makes no queue
  call).
- **V5 Containment reads** — `GET /v2/d6-containment`:
  state **NORMAL**, `absent: true`, `verified: true`.
  `drive=1` diagnostics: the containment projection
  **present** (non-null on the new build), state
  NORMAL / absent / verified; the v4 stop-record and
  episode fields at their empty values (null / 0 /
  false); `stopConfidence: "not_applicable"`; the
  recorder fields unchanged vs census item 14
  (`tableState: "missing"`, zero rows,
  `recorderHealth: null`); `armedAt` **bit-identical**
  to census.
- **V6 Preservation** — census-to-close, every item
  exact: preserved plan `active` {1,0,0,0,0} with its
  entry `pending`; its job `queued` rev 1, grants [],
  quarantine unheld; the exemption projection (chapter
  bound 26 / parked 0 / eligible 1; segment 1 / 569 /
  8,022; digest `cdef2c7e…`); GENERATION_HALT `"1"`;
  queue paused; conflicts exact 4-row baseline;
  watermarks content 18 / bindings 1841 with 0 idx-26
  rows and 0 changes; all five phase figures frozen;
  quota reconcile `ok: true` with the sole straddler;
  parked job fingerprint exact.
- **V7 No-movement** — no grant issued (grants []),
  the occurrence still `pending`, the job still
  `queued` rev 1, derived reserved **0**, dispatched
  (current PT day) **0**, no new plans, commands, or
  conflicts rows. A code deploy invokes no DO method,
  so **any** movement in this set is unmatched movement
  = STOP and report (and rollback evaluation under T5).
- **V8 Record** — execution record with the census
  transcript, assembly + battery logs (hashes), the
  upload response, D2 read-back, observability reads,
  both containment reads, the closing census repeat,
  and the ends-HELD certification; filed on the board
  with a Rowan cp. Classification of any unexpected
  finding is Rowan's, not the executor's.

Any V-item failure = STOP + rollback evaluation under
the §3 triggers. STOP prevents further operator action
inside the gate; per the standing correction-6
discipline, STOP is never represented as affecting an
alarm chain (none is provoked by C1).

## 6. Unresolved risks bearing on C1

From the corrected register
(`PHASEB-UNRESOLVED-RISK-REGISTER-REVISED.md`, pin
`621535f0…`): **14 of 15 entries remain open** (R-14
resolved by Rowan's R1 acceptance). The entries that
bear on C1, at their corrected strength:

- **R-01 — Cross-invocation serialization (A-3) is
  assumed, not documented.** The candidate's containment
  gates are written against this assumption; C1 deploys
  that code. C1 does not resolve it; nothing in C1
  exercises a transition, so its exposure in this gate
  is limited to read paths.
- **R-02 — Storage-effect ordering is unspecified.**
  Detection of a divergence happens only at the next
  successful dual read that actually occurs; no surface
  reads on a schedule. Bears on future stop acts, not
  on this deploy — C1 performs no alarm operation —
  but it is why §5 treats post-act read-backs, not
  ordering, as ground truth throughout.
- **R-06 — Recorder dual-failure blind spot.** If a
  drive pass and its recorder write both fail, the pass
  is invisible on shipped surfaces (the P2 gate's V5
  outcome was INCONCLUSIVE for exactly this reason).
  The containment build does not close this blind spot;
  §5's V5/V7 checks bound what an invisible pass could
  have done under the holds ($0, the pre-classified
  grant set), they do not eliminate the blindness.
- **R-07 — Containment suppression under a live chain
  is unverifiable before S1.** C1 deploys containment
  code whose OPERATIONAL verification is C3's job and
  remains PARTIAL by construction; C2 after it proves
  readability only. **Deploying the code is not
  verifying it**, and no C1 result may be cited as
  evidence that containment works — only that the code
  is live and reports its inert state.
- **R-09 — The attempt-3 stall's causation is
  unproven (H1/H4).** The recovery program proceeds
  cause-unproven; C1 does not depend on the cause and
  does not advance it.
- **R-12 — `getAlarm()` semantics after retry
  exhaustion are UNSPECIFIED.** The live `armedAt`
  (1793562576104, ~20 h past due at last observation)
  sits inside that unspecified region. Every gate value
  here is a re-read expectation, never an assumption;
  C1 neither relies on nor tests delivery.
- **R-13 — The lying-read residual.** A storage read
  that successfully returns a WRONG NORMAL cannot be
  detected by construction; the state route and
  `drive=1` read the SAME store, so their agreement
  corroborates nothing. §2/§5 cross-checks against
  facts containment does not control (plan / job /
  phase / queue state) bound this at census and
  postflight time only; between reads, nothing detects
  it.

Entries that do **not** bear on C1 itself (they attach
to mechanisms C1 never exercises) but remain open for
later gates: **R-03 / R-05** (retry supersession and
the provisional 3,600,000 ms threshold — R5a arming
semantics, absent from this candidate), **R-04** (no
traffic-independent rate bound on wake-driven
registrations — no wake occurs), **R-08** (exhausted
-episode circumvention is paperwork-enforced — no stop
episode exists or can be minted in C1), **R-10 / R-11**
(wake-arithmetic branch B2 and the unobservability of
D — both pre-R5a questions), **R-15** (commit-to-record
uncertainty in the stop act — no stop act occurs).

**C1-specific risks:**

- **C1-R1 — First production execution of the
  containment code is read-only, and that cuts both
  ways.** The transition writer paths stay unexecuted
  until C3; a latent defect in a READ path could
  misreport state at §5 V5. Bounded by: the census
  cross-checks (V6/V7 cover facts containment does not
  control), trigger T4 (any containment surface
  misbehavior fires rollback evaluation), and the
  harness battery (§8).
- **C1-R2 — Platform code-adoption timing is
  undocumented.** When a script upload's new code takes
  over DO instantiations is UNSPECIFIED in the reviewed
  documentation. Bounded by: D2 read-back of the
  deployed parts, V1's stamp check, and the dual
  observation windows (§5).
- **C1-R3 — The deployed tree is assembled at gate
  time.** The build-pin/stamp convention (§1.3) means
  the exact uploaded bytes exist only from the gate's
  assembly step. Bounded by: hash assertions against
  §1 at assembly, the battery re-run on the assembled
  tree (§8), and the stamped-manifest read-back (V2).

**What C1 does NOT resolve, stated plainly:** whether
containment works operationally (C3, partial); whether
the alarm chain can be revived (R5a-D + S1); why the
alarm stalled (R-09); the recorder blind spot (R-06);
any generation question. After a fully successful C1,
the system differs from today in exactly one respect:
the containment code is live and inert.

## 7. Explicit GO wording and STOP conditions

**The GO this package contemplates** (for a future
execution, only after Rowan's review of this package;
NOT requested here):

> "GO — execute exactly one Gate C1 attempt as pinned
> in the C1 readiness package (pin `<READINESS-PIN>`):
> fresh census, battery re-run on the gate-assembled
> tree, build pin, exactly one upload of the
> containment V4 candidate (coordinator `6c19a50e…`,
> entry `2bb0608b…`, service `5c5183e6…`) to
> `opalreader-api-v2-prod`, at most one conditional
> observability PATCH, and conditionally one rollback
> upload of the preserved live build `86ad06ab…` parts
> plus at most one conditional PATCH on the package's
> named triggers T1–T6; passive reads only; NO
> containment transition, NO command, NO SubmitJob, NO
> hold or queue change, NO stimulus of any kind;
> ending HELD with containment inert at NORMAL."

**STOP conditions** (any one stops the attempt; the
GO is consumed; no retry without a fresh GO):

- any §2 census item deviates from its hard
  expectation;
- assembly mismatch: the gate-assembled tree differs
  from §1 in any part, count, or hash;
- battery re-run failure or divergence from §8's
  standing results;
- envelope/metadata drift vs the fresh live read
  beyond the two documented projection artifacts
  (§1.3 item 5);
- an ambiguous upload response — no re-upload is made
  until a read-back classifies the first attempt;
- any §3 rollback trigger (T1–T6) post-upload →
  rollback evaluation inside the same GO; a failed or
  mismatched rollback → STOP, hold, report;
- any movement in the §5 V7 no-movement set;
- observability unrestorable within the §3/§4 budget.

**Authorization discipline:** Rowan's review of this
package is not a GO. Julie's GO is not requested by
this package. If given later, the GO covers exactly
one C1 attempt in the wording above and nothing else:
not C2, not any transition, not R5a-D, not S1.

## 8. Battery and evidence status

**Standing results for this exact candidate tree**
(complete runs; full logs + exit codes captured;
hashes re-verified during this package's preparation):

| suite | tree | result | exit | log SHA-256 |
|---|---|---|---|---|
| Containment battery v4 + CT14d (`containment-v4/tests/containment-battery.test.mjs`, `2b2befa5…`, 67,037 B) | v4 candidate | **42/42 pass** | 0 | `96c76d17446b9821f519bdbb5ed9673c7c205d8769eac35c8a6f66794bf9fd8b` (`containment-v4/logs/containment-v4-corrections-candidate.log`) |
| Containment battery v4 (41 tests, pre-CT14d file) | v4 candidate | **41/41 pass** | 0 | `40bed0eeb250d8778aafb110e981dee021f1f4db6e43fa28735431e87a2c2c6c` (`containment-v4/logs/containment-v4-candidate.log`) |
| P2 parameterized regression (`suites/p2-battery.test.mjs`, unmodified) | v4 candidate | **32/32 pass** | 0 | `4548c21f0457172a04a283d085427f2948e449b70e4ed6d9eec0a39b5689274f` (`suites-v4/logs/p2-v4-containment.log`) |

The 42-test run supersedes the 41-test run on the same
tree: CT14d (truth-table row 1's readable-record
precondition, added in the V4 corrections round) is the
only difference; no existing assertion was modified,
deleted, or loosened in either round (identities
records, §1.1). The R5a suite is **not applicable** to
this tree — it exercises the R5a change, which exists
only in the composed tree (R5a-D's subject); it ran
23/23 exit 0 on the composed tree in the V4 package
and is cited here only to keep it out of C1's evidence
set. Harness caveats stand: the harness invokes
`alarm()` directly and cannot prove real platform
delivery, platform retry behavior, platform
storage-effect ordering, or real-DO SQLite behavior
beyond its mirrored `.one()` throw semantics.

**Gate-time re-run requirement.** Before any upload, a
C1 execution re-runs on the **gate-assembled tree**
(the §1.3 fresh assembly, not the scratch candidate
tree):

1. the containment battery (42 tests incl. CT14d)
   against the containment-v4 fixture identities; and
2. the P2 parameterized regression (32 tests) against
   the `suites-v4` containment fixture.

Both must pass in complete runs with exit code 0; the
logs are pinned with the build pin (§1.3 item 3) and
cited in the execution record. Why: the pinned logs
above are evidence about the pinned scratch tree; the
gate uploads a fresh assembly, and the P2 gate's B3
precedent (32/32 re-run on its gate-assembled tree) is
the standing pattern — the assembly that ships is the
assembly that was tested. Any divergence = STOP before
upload (§7).

## 9. Package contents and turn

This package is a single consolidated document.
Candidate identities are carried in full in §1 (the
standalone identities addendum remains in the GitHub
archive at `containment-v4/CANDIDATE-IDENTITIES-REVISED.md`,
pin `621535f0…`; it does not ride in the review folder
because §1 supersedes it for review purposes). The
companion cp (`PHASEB-C1-READINESS-ROWAN-CP.md`)
summarizes this package for the folder.

**Production remains under INVESTIGATION HOLD. Nothing
in this package executes, deploys, transitions, wakes,
or mutates anything. Turn: Rowan's — independent review
of this C1 readiness package.**
