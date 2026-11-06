# V-3 HARNESS BATTERY — RESULTS

**Commission:** Rowan's OQ-2 cold-restart assessment ruling
(`ROWAN-OQ2-RULING.md`), Q-1/Q-4/Q-6 — V-3 is the mandatory
pre-execution evidence annex to the GR-2C in-gate checkpoint. It
must test **the exact cold transition** — the next grant after
`grant:plan:19cad189fab54b9c804a74a6:seg:87:full` is
`seg:88:full` (grant id = job revision at issuance), `seg:87`
must not be reissued — **and its reservation effects**.

**Verdict of this battery: PASS — 5/5 tests, exit code 0**, on
one complete run of the final test file (full log:
`v3-final-run.log`). Per Q-6, this PASS proves transition
mechanics in the harness only. It does **not** prove platform
alarm delivery, and it does not discharge OQ-2 — that happens,
if at all, at the GR-2C production observation.

Local work only. No production calls of any kind were made.

---

## 1. Source / build identity

- **Tree under test:**
  `~/workspace/ch2-program/ch3-recovery/containment-v4/composed-tree/`
  — the deployed composed tree, **build
  `fdb02395b3775dc945baa395591a73060ab146c4`** (the Grant 1
  build: R5a + containment v4 composition), 31 files.
- **Full per-file SHA-256 manifest:** `tree-manifest.sha256`
  (31 entries, captured at run time from the tree as tested).
- **Modules exercised, SHA-256:**
  - `v2/coordinator.mjs` —
    `5303cb6323da01c21a5ebe9a7983f87abe08e14945660daaebce99734849e1ed`
  - `v2/worker-entry-prod-d6.js` —
    `2bb0608b589a084ca275428c3236c24680f4a4692afe2245dfcb2880257983c1`
  - `v2/generation/service.mjs` —
    `5c5183e664218b9746c497e9456af45c7467a8ace66fd1b9ef0928eccb3c7c14`
  - `v2/generation/genstore.mjs` —
    `811b6b15b790097ad0010be3c71881c5024331143b4b0e2031392287bb839c2a`
  - `v2/generation/quota-budget.mjs` —
    `2b39924579e5af2d5d20eea01122d2323ccedac9fe9ff9f7026c49af14770820`
  - `v2/generation/gen-constants.mjs` —
    `9af664fafc61dff1c16de8f94d06c0097271313bae7327d2a9a9d16efe14c77d`
    (`SEGMENT_ATTEMPT_BUDGET = 12`, `:16`)
- The composed coordinator's hash matches containment-v4's own
  `fixtures/identity-composed.json` exactly (see §3 for the one
  identity discrepancy found, in the older suites' fixtures).
- **No source file was edited.** The only code written is the
  test file in this directory.

## 2. Harness identity

- **Harness:** `containment-v4/tests/harness.mjs`, SHA-256
  `8eb4c0d6393602440cdb3e466fa4f832bbfa11734d99052573688cd0209f71b4`
  — the program's existing DO harness (the P2/containment/R5a
  batteries' harness): real SQLite via `node:sqlite`, a fake
  clock, `crash()` = new instance over the same storage.
- **`.one()` semantics — read carefully:** THIS harness's
  `SqlCursor.one()` **THROWS** on 0 or >1 rows — production DO
  semantics, deliberately mirrored ("the fake that returns null
  is exactly the divergence that hid the P8 deadlock" —
  harness header). The standing caution about a null-returning
  fake applies to the older `do-harness.mjs` lineage, **not** to
  this harness. In addition, no V-3 assertion depends on an
  empty-result `.one()` path at all: the `.one()` calls on the
  exercised paths are aggregate `COUNT(*)`/`COALESCE(SUM(...))`
  queries, which return exactly one row by construction.
- Runtime: node v24.22.1, `node --test`.
- **Test file:** `v3-cold-restart.test.mjs`, SHA-256
  `51283341a757ed0bc63a79deae0c3352c774d594f8772aa4d17ba88a57245291`.

## 3. Baseline: the existing batteries on the same tree

Run first, against the identical composed tree, to establish
that the tree under test is the known-good baseline:

| Suite | Invocation (env) | Result | Exit |
|---|---|---|---|
| Containment V4 (42) | `CONTAINMENT_V4_CAND_DIR=../composed-tree CONTAINMENT_V4_BASE_DIR=../baseline-tree CONTAINMENT_V4_IDENTITY=../fixtures/identity-composed.json` | **42/42 PASS** | 0 |
| P2 (32) | `P2_CAND_DIR=../containment-v4/composed-tree P2_BASE_DIR=../instrumentation-spec/scratch/baseline-tree P2_IDENTITY=fixtures/p2-identity-composed.json` | 31/32 | 1 |
| R5A (23) | `R5A_CAND_DIR=../containment-v4/composed-tree R5A_BASE_DIR=../r5a-revision/baseline-tree R5A_IDENTITY=fixtures/r5a-identity-composed.json` | 21/23 | 1 |

Logs: `baseline-containment-on-composed.log`,
`baseline-p2-on-composed.log`, `baseline-r5a-on-composed.log`.

**Finding (identity fixtures, reported — not repaired):** every
P2/R5A failure is a **T0 identity assertion on one file**:
`v2/coordinator.mjs`. Both suites' "composed" identity fixtures
(`suites/fixtures/p2-identity-composed.json`,
`suites/fixtures/r5a-identity-composed.json`) pin the
coordinator at SHA-256 `c097061a…`, an **earlier composition**
(pre-containment-V4-corrections). The current composed
coordinator is `5303cb63…`, which is exactly what
containment-v4's own identity fixture pins (and the containment
battery's identity tests pass against it). **All behavioral
tests pass**: P2 31/31 behavioral, R5A 21/21 behavioral. The
mismatch is fixture staleness in the two older suites, not a
behavioral or identity defect in the tree under test — but it
is recorded here at full strength because Q-6 makes failed or
ambiguous assertions gate-blocking until separately reviewed:
Rowan should note that the P2/R5A T0 identity assertions, as
fixtured, cannot pass against the current composed tree, while
every behavioral assertion in all three suites passes and the
containment suite's identity assertions pass exactly.

## 4. The V-3 scenario

The fixture reproduces the adopted GR-B state on the tree's own
machinery (no hand-inserted grant rows):

1. `seedAttempt3Shape` (the harness's shipped attempt-3 shape:
   one 569-char occurrence, phase-bound book, segment plan,
   parked job, four baseline conflicts, attempt-3 phase
   figures), then the quota guard is **armed with the tree's
   own `bootstrapQuota`** (production is armed; arming is
   fixture setup through the shipped code path). The seed's
   settled-plan attempt row makes the seed PT day a
   bootstrap-exception day — the same shape as production's
   adjudicated straddler — so the churn runs on later PT days,
   which no exception interval reaches.
2. **Warm churn, 87 grants:** each cycle lets the standing
   grant's 15-minute lease go stale (under `GENERATION_HALT
   "1"` no `sendGrant` exists, so every grant is born
   never-invoked — the production posture) and drives alarm
   passes until the void → reissue settles. Every cycle is
   asserted in the builder: exactly one live grant, suffix
   increments by exactly one, derived reserved returns to
   exactly 12, dispatched stays 0. The fixture thereby stands
   at: **job revision 88, `seg:87:full` `issued`, occurrence
   `granted`, reservation 12 open against seg:87, dispatched
   0** — the adopted GR-B predicates, on the fixture job
   (`grant:plan:<fixture-plan>:seg:87:full`; the plan id is the
   fixture's own — the revision/suffix mechanics under test are
   plan-id-independent).
3. **Cold stand-down:** the alarm registration is deleted
   (mirroring C3's verified `deleteAlarm`) and the fake clock
   advances **26 hours with no pass running** — seg:87's lease
   goes stale unobserved, the post-stop / post-restoration
   posture. (Whether a fresh registration would be *delivered*
   by the platform is precisely what a harness cannot model;
   the test invokes the pass directly, as every battery here
   does, and asserts only what the pass *does*.)

## 5. Assertions and results — all PASS

### T1 — the cold transition (ruling observations (a)–(e) + task (a)–(h))

- **(a) Recorder:** the single cold pass wrote exactly one new
  `d6_drive_passes` row (row id **88** in the run), `stage =
  "complete"`, `drive_invoked = 1`. Evidenced separately from
  the grant state, per the ruling's protocol correction.
- **(b) Safe void:** `seg:87` transitioned to `voided` via
  exactly one `dispatch_voided` grant transition whose detail
  names `voidReason = "lease_expired_undelivered"` (the M-4
  never-invoked branch — its outbox row had `sent_at` and
  `send_attempted_at` null). `seg:87` exists exactly once in
  the grants table and is never reissued (also T4).
- **(c) Successor identity:** exactly one live grant after
  settling, id **`seg:88:full`**, state `issued`. It was first
  observed at **cold pass 1** — the same pass's drive sweep
  re-granted after the base alarm's void (the M-6/M-8
  same-pass shape; the retry-pass shape was not needed, and
  T1's transient-state branch was therefore not taken — no
  pass-boundary snapshot in this run shows the void→reissue
  intermediate).
- **(d) No coexistence:** across all 94 snapshots in the
  series (§6), live-grant count never exceeds 1.
- **(e) Reservation continuity:** seg:87's reservation (12
  slots, `qres:` row) is `closed` with `close_reason =
  "grant_voided"`; a second `closeReservationsForVoidedGrant`
  sweep closes nothing (exactly-once, asserted directly);
  exactly one `rel:op:<seg:87>:<occ>` attempt-ledger release
  row exists; seg:88's fresh reservation stands `open` at 12;
  derived open reserved = **12** at settle; never 24 anywhere
  in the series; two consecutive accounting polls (reads only)
  agree field-for-field on the settled state (Q-3's
  two-complete-poll rule, in harness form).
- **(f) Occurrence path:** transitions in the cold window show
  `granted` —(cause `dispatch_voided`)→ `pending` —(cause
  `grant`)→ `granted`, in that order; the occurrence ends
  `granted`. (`outcome_unknown` never appears — refuter (b) of
  assessment CR-2 does not fire.)
- **(g) Zero dispatch/spend:** `d6_provider_dispatches` is
  empty; the queue binding received nothing; seg:87's outbox
  row was deleted by the void; seg:88's outbox row stands with
  `sent_at = null` and `send_attempted_at = null` — born
  never-invoked, because under HALT `"1"` the entry wires no
  `sendGrant` (M-9, structural).
- **(h) Revision — 89, explained:** job revision moved
  **88 → 89**, and the delta equals exactly **one** job
  transition in the cold window carrying the successor's grant
  id (the issuance event; logged cause `requestGrant`). Not
  90: in this build's event sequence the void applies **no**
  job event (its re-advance is a schedule row, not a job
  transition) and the drive sweep's issuance applies exactly
  one — so 89 is the explained value, and the transitions
  table is the explanation. (Rowan Q-3 accepts 89 or 90 only
  with the explaining sequence; here it is 89, with the
  sequence recorded in the run log's transition-level
  assertions.)

### T2 — idle second pass

A pass one minute later (inside seg:88's lease): grant set and
states byte-identical, seg:88 still the live grant,
reservation 12, occurrence `granted`, job revision unchanged,
dispatched 0, seg:88's outbox still unattempted. The chain
idles rather than churning early.

### T3 — stale successor

Past seg:88's lease: seg:88 safe-voids (`grant_voided`
closure), **`seg:89:full`** issues as the sole live grant with
a fresh open 12, occurrence `granted`, dispatched 0, seg:87
still `voided`. The warm pattern reproduces from the cold
start — the cold restart is not a one-off recovery shape.

### T4 — revision-derived identity

The grants table holds suffixes **1..89, each exactly once**.
A fresh `requestGrant` against the fully-granted job is
refused (`ok: false` — nothing pending) and creates no row;
`seg:87` still exists exactly once, `voided`; the job revision
(90 after T3) has moved permanently past 87, so the
revision-derived id `seg:87` is unreachable — reissuance is
structurally impossible, not merely unobserved (M-1).

### T5 — the observable series

94 snapshots spanning churn, cold fixture, cold pass, polls,
T2 and T3: **live grants ≤ 1 at every snapshot; open reserved
∈ {12} at every settled snapshot (the value 24 never occurs;
the permissible transient 0 was not observed at any pass
boundary in this run, because void and reissue completed
inside single passes); dispatched = 0 at every snapshot.**

Machine-readable evidence printed by the run:
`V3-EVIDENCE {"recorderRowId":88,"successorFirstSeenPass":1,"revBefore":88,"revAfter":89,"jobGrantEvents":1}`
plus the full `V3-SERIES` snapshot array — both in
`v3-final-run.log`.

## 6. Run history

| Run | Log | Result | Exit |
|---|---|---|---|
| Run 1 (initial test file) | `v3-run-1.log` | 2/5 — T2, T3 passed; T1/T4/T5 failed on **test-side assertion plumbing** (see below) | 1 |
| Run 2 (final test file) | `v3-final-run.log` | **5/5 PASS** | **0** |

Run 1's failures were in the test's own filters, not in the
source under test, and are disclosed rather than discarded:
(i) occurrence transitions are keyed by aggregate id
`<jobId>/<occurrenceId>`, not the bare occurrence id — T1's
event filter matched nothing; (ii) the issuance job transition
is identified by its detail's grant id (its logged cause is
`requestGrant`), not by cause `grant`; (iii) `requestGrant`
lives on the coordinator (the service's own path), not on the
entry class instance. The fixes changed only the test file's
observation code; no assertion was loosened, and **no source
file was touched at any point**. The complete final run —
fresh process, full churn from seg:1 — is run 2, whose log is
the battery's evidence.

## 7. Limitations

1. **Alarm delivery is not tested — at all.** The harness
   invokes `alarm()` directly. Nothing here bears on whether
   the platform delivers a fresh registration on the production
   DO after the verified stop and restoration (CR-1's delivery
   half; the W-4, whose root cause remains UNCONFIRMED). Only
   the GR-2C in-gate production observation can discharge that.
   Q-6's own words govern: harness PASS does not prove platform
   alarm delivery.
2. **Harness vs platform generally.** In-memory SQLite, one
   instance, a fake clock, simulated re-invocation instead of
   platform retries. Platform storage-effect ordering and
   post-retry-exhaustion `getAlarm()` semantics (UNSPECIFIED)
   are outside what any run here can express. This harness's
   `.one()` throws with production semantics (§2), so the
   known harness/real-DO divergence of the older fake does not
   apply — but harness-green remains no substitute for the
   production observation on any platform-behavior question.
3. **Concurrency is asserted at harness-observable snapshots
   only.** Snapshots are taken at pass boundaries; a pass's
   internal steps run inside transactions in a single-threaded
   harness invocation, so the "never two live grants" and
   "never 24" properties are verified at every observable
   state, while their within-pass atomicity rests on the
   transaction structure (and M-2's state-machine emergence),
   not on a directly observed interleaving. The racing-wake
   recheck remains platform-unverified, as before.
4. **Fixture scope.** The fixture job is the harness's own
   attempt-3 shape (its plan id differs from production's;
   grants carry the fixture prefix). What transfers is the
   revision/identity/reservation mechanics, which are
   plan-id-independent in the source (M-1/M-7). The production
   plan's other census facts (bindings, conflicts, phase
   money) are not re-litigated here; the seed reproduces their
   shapes and the baseline suites cover them.
5. **The seed-day bootstrap exception** (§4.1) mirrors
   production's straddler in shape; the churn deliberately
   runs on later PT days. A cold restart attempted *on* an
   exception-blocked day would refuse reservation on the
   bootstrap-incomplete hold — a production-day property the
   resume gate's own census/quota reads, not this battery,
   own.
6. **One cold shape is exercised:** registration deleted +
   26 h dormancy + never-invoked standing grant — the actual
   adopted GR-B posture. Attempted-but-unacknowledged
   (`handoff_uncertain`) and delivered-lease shapes are
   different branches (M-4) that production's state excludes
   and this battery does not claim to cover.

## 8. Files in this directory

- `v3-cold-restart.test.mjs` — the V-3 battery (T1–T5).
- `v3-final-run.log` — the complete final run: 5/5, exit 0.
- `v3-run-1.log` — the first run (2/5; test-plumbing failures,
  §6), retained for the record.
- `baseline-containment-on-composed.log` — containment V4
  battery on the composed tree: 42/42, exit 0.
- `baseline-p2-on-composed.log` — P2 battery: 31/32, exit 1
  (sole failure: stale T0 identity fixture, §3).
- `baseline-r5a-on-composed.log` — R5A battery: 21/23, exit 1
  (both failures: the same stale T0 identity fixture, §3).
- `tree-manifest.sha256` — SHA-256 of all 31 files of the
  composed tree as tested.
- `RESULTS.md` — this file.
