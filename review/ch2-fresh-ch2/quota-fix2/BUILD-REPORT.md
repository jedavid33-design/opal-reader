# Quota-fix2 build report — re-review holds A and B (Rowan 6545597263)

**Scope.** Repo-only narrow source fix for the two holds in Rowan's
re-review PARTIAL PASS of the quota corrections (roundtable issue #15,
board comment **6545597263**). Rowan confirmed both fixes sit inside
Julie's existing approved quota build scope. **No production calls,
no deploy, no GitHub posts or pins were made by this build.** The
reviewed baseline `~/workspace/ch2-program/quota-fix/` is untouched
(its hashes below still verify); all work is in
`~/workspace/ch2-program/quota-fix2/`, copied from that baseline.
(This file replaces the copied quota-fix build report that came with
the tree copy; that report remains at `quota-fix/BUILD-REPORT.md`.)

Labels: **CONFIRMED** = read in source / executed in this build;
**INFERRED** = follows from the cited code but not separately
executed; **OPEN** = not decided or not provable from here.

---

## Hold A — the 100-grant daily guard saw the FULL pending set before cohorting

### Defect (CONFIRMED, quota-fix baseline)

In `worker-build/v2/coordinator.mjs` `_issueGrant`, the grant-count
check ran on the un-cohorted set:

```js
targets = probe ? pending.slice(0, 1) : pending
...
if (attempts + targets.length > DAILY_QUOTA_LIMIT) return quota_estimate_exhausted
```

`boundGrantTargets` (which computes the fundable cohort) was only
consulted later, inside the D6 reservation block. For a job with 101
fresh occurrences, `0 + 101 > 100` on every PT day, forever: the job
could never start, no matter that a cohort of 8 was well inside every
budget. Rowan's words: the guard "works for ordinary jobs and fails
only at this scale," and a fresh >100-occurrence job "would fail
forever, though silently labeled as quota exhaustion."

### Fix (CONFIRMED)

In `_issueGrant`, on the **armed D6 non-probe** path only
(`this.env.d6StandardOnly && !probe`), the bounded cohort is now
resolved **before** the count check, read-only, and the check is
evaluated against it:

```js
let countTargets = targets;
let quotaBound = null;
if (this.env.d6StandardOnly && !probe) {
  const planId = d6PlanForJob(this, jobId);
  quotaBound = boundGrantTargets(this, { planId, pending, dayKey: day });
  countTargets = quotaBound.targets;
}
if (attempts + countTargets.length > DAILY_QUOTA_LIMIT)
  return this._grantRefusal(job, "quota_estimate_exhausted");
```

The D6 reservation block below **reuses the same `quotaBound`
result** (`const bound = quotaBound;`) instead of calling
`boundGrantTargets` a second time, so the set that was *counted* is
byte-for-byte the set that gets *reserved and granted* — the count
can never be gamed by drift between two computations.

### Exact semantics

- **Armed D6, non-probe:** the count check is
  `attemptsToday + cohortSize > 100`, where `cohortSize` is the
  existing cohort computation (ordered prefix of the pending set,
  first occurrence always included, later occurrences only while
  their full worst-case reservation of 12 slots fits the day's
  remaining slot headroom). Since the check passes only when
  `attemptsToday + cohortSize ≤ 100`, the day's granted count can
  never exceed `DAILY_QUOTA_LIMIT` — the limit itself is **not**
  weakened, moved, or made configurable.
- **Unarmed / non-D6 callers:** `boundGrantTargets` returns the
  pending set unchanged for unarmed stores, and the branch is
  skipped entirely for non-D6 callers — the old full-set semantics
  are preserved exactly. (Verified safe against the three external
  suites that assert `quota_estimate_exhausted`:
  `coordinator-grants`, `coordinator-round3` run without
  `d6StandardOnly`; `genpkg1-quarantine-d8` never arms its store,
  and its case also trips the earlier `attempts >= DAILY_QUOTA_LIMIT`
  pre-check first. All three pass in the battery below.)
- **Probe grants:** untouched (`pending.slice(0, 1)` path; the new
  branch excludes probes).
- **Monthly money guard:** untouched, per Rowan — the
  `spending_cap` check above keeps its full-set semantics. A job
  whose full pending set exceeds the monthly cap arithmetic may
  still park on cap; that is a money-guard outcome, **not** a
  daily-quota refusal, and no test in this build presents it as one.
- The pre-existing `attempts >= DAILY_QUOTA_LIMIT` pre-check is
  unchanged.

## Hold B — an in-interval bootstrap-disposition day was an assertion, not proof

### Defect (CONFIRMED, quota-fix baseline)

`disposeBootstrapException` in
`worker-build/v2/generation/quota-budget.mjs` accepted **either** day
of a two-PT-day `[created_at, updated_at]` interval whenever a
nonblank `authorizationRef` was supplied; `source`/`note` were
optional and unchecked. For an attempt dispatched across a PT
midnight, choosing the prior day vs the dispatch day changed which
day's count absorbed the call, and nothing in the surviving evidence
could prove either choice — the reference attested that an operator
*asserted* a day, not that the day was true.

### Fix (CONFIRMED) — Rowan's simple safe route

Immediately after the evidence interval is computed and **before**
the in-interval bounds check, multi-day intervals now refuse
outright:

```js
if (interval[0] !== interval[1])
  throw new Error(
    `quota_disposition_ambiguous_interval: [${interval[0]}, ${interval[1]}] ` +
    `spans more than one PT day for ${attemptId}; no dispatch day is provable ` +
    `from the surviving evidence`);
```

The function's header comment was rewritten to state the rule:
assertions are not proof; no evidence procedure was invented; no
operator HTTP route was added (disposition remains a store-level
operator function, as before).

### Exact semantics

- **Multi-day interval ⇒ always refused**, for *any* requested day —
  prior day, current day, or out-of-interval (ambiguity is checked
  first, so the refusal reason is uniform and no day is ever
  assigned). The refusal writes nothing: the attempt row, the
  dispatch and reservation ledgers, and the exception record are
  byte-for-byte unchanged (proven by full-snapshot assertions in C2
  and the reconcile test).
- **The exception stays in place.** Its current-day blocking effect
  (`currentDayBootstrapBlocked`) ends **naturally with time**: once
  the PT day advances past the interval, the exception no longer
  covers the current day, grants proceed, and the exception remains
  on the record — never erased, never absorbed, never guessed
  (proven in C2, C3-reconcile, and T3).
- **Same-day intervals ⇒ disposition path unchanged.** When
  `created_at` and `updated_at` fall on one PT day, that day is
  genuinely provable from the surviving evidence; the existing
  validations (real-calendar day, in-interval, auditable record
  carrying `authorizationRef`, `source`, and `evidenceInterval`)
  still apply, and an out-of-interval day still refuses
  `quota_disposition_day_outside_evidence_interval`.
- A nonempty `source` string or `authorizationRef` is **never**
  treated as proof of a day; for multi-day intervals they no longer
  cure anything.

---

## Files changed (SHA-256, quota-fix → quota-fix2)

| File | Before (quota-fix) | After (quota-fix2) |
|---|---|---|
| `worker-build/v2/coordinator.mjs` (5,013 → 5,042 lines) | `a817d89e9be538db2d329e6420fe08d84f06a60324e1334f38ac2064146da772` | `5d0727638b24e497c7b7ca73d6deead411a5ebc8e475163f78aa0b01d72a3de5` |
| `worker-build/v2/generation/quota-budget.mjs` (817 → 841 lines) | `990b7327ca3d9d1dbb59fce8c45cf8c2006488b46d60ef4e4b4aecbfb49051b0` | `2b39924579e5af2d5d20eea01122d2323ccedac9fe9ff9f7026c49af14770820` |
| `worker-build/tests/quota-corrections.test.mjs` (487 → 568 lines) | `459dfabe644accacd15359b3c4063b88564ba6a925f04485f318f6fefa36f608` | `7a8e4f489b949c7d004b23a782fe861c1bf8bdca8c3cd5e3970944275e8ca65b` |
| `worker-build/tests/quota-budget.test.mjs` (622 → 644 lines) | `29285bdf37ff43148cf38a6597475ceccdd4c3d69ce612287bc5f38411d4a21d` | `23519319fe03b87d401e085fd2aacaf0b6fb1b88f5f04e5210471a92f193cc82` |
| `worker-build/tests/quota-rereview.test.mjs` (new, 331 lines) | — | `925564f9b116825990936dd5029e7ac618dfe4ffbc3d33406e8c1fe6e803c97d` |
| `run-battery.sh` | comment line only (tree name) | — |

`worker-build/worker/…` mirrors `worker-build/v2/…` (same inode in
this tree); the two source files above are the only source changes,
and the tree diff (`diff -rq`, logs excluded) shows **exactly**:
the two source files, the two revised test files, the one new test
file, and the battery script's comment line. Nothing else.

### Protected files — byte-identical to the quota-fix tree (CONFIRMED, hash verified)

| File | SHA-256 (unchanged) |
|---|---|
| `worker-build/v2/host/adapters.mjs` | `f8ac357e3ca4d23bb9edd46dab1843257d26c6fafe6a52b3fffaff676a749368` |
| `worker-build/v2/generation/genstore.mjs` | `811b6b15b790097ad0010be3c71881c5024331143b4b0e2031392287bb839c2a` |
| `worker-build/v2/generation/gen-constants.mjs` | `9af664fafc61dff1c16de8f94d06c0097271313bae7327d2a9a9d16efe14c77d` |
| `worker-build/v2/generation/d6-executor.mjs` | `c3613a818f598a2fc9f0f975312ad76879edab6bdffcdd06fe3fb2e3b123984c` |
| `worker-build/v2/generation/service.mjs` | `aeeee06c8af9789426ae8135bd020be77e8ef3ea350de744472743e3dd14bd1d` |
| `worker-build/tests/quota-executor.test.mjs` | `5000be69e7f1a03e2a33700f80b060c61f239fcc8c56d39b7f7db5d6c48605de` |

The cache-refresh code and the unknown-billing
(`estimated_unverified`) protections are therefore untouched, as
required.

---

## Test inventory — each required proof, and where it lives

All tests are deterministic (harness-injected clock, fake bucket,
fake providers) with **zero real provider calls**. Quota suites:
quota-budget 13/13, quota-corrections 7/7, quota-executor 10/10,
quota-rereview 2/2, plus quota-park-concurrency, quota-park-governance,
quota-probe, and remediation-cache-refresh 6/6 — all exit 0 in the
battery below.

### Hold A proofs — `tests/quota-rereview.test.mjs` (new)

- **A1 (store, preload 92):** the day's grant ledger is preloaded to
  92 *granted* rows with the slot budget returned to full headroom
  (filler grants settled via `settleReservationsForGrant`, which the
  closure fence permits because no executions exist). A
  101-occurrence job then grants: `ok`, count **8** (the bounded
  cohort); `_attemptsOn(day)` lands on **exactly 100**; the granted
  set is the ordered prefix `ids[0..8)`; the other 93 stay pending;
  all 8 reservations are open at 12 slots. Full-set semantics would
  refuse this grant (92 + 101 > 100) — this is the discriminating
  proof that the cohort, not the full set, is what is counted.
- **A1 (store, preload 96):** the same job refuses
  `quota_estimate_exhausted` — the count check still binds, against
  the cohort (96 + 8 > 100) — and the refusal is clean: no grant row,
  no reservations, all 101 occurrences still pending, ledger
  unchanged at 96.
- **A2 (executor, 101 fresh occurrences):** first grant `ok`, count
  8, cohort = ordered prefix (the pending set's own order is the
  coordinator's `ORDER BY occurrence_id`, lexicographic — the test
  tracks exactly that order); the other 93 stay pending in order.
  Rounds continue within day 1; the refusal that ends the day is
  `QUOTA_REFUSALS.BUDGET` (the provider-attempt **slot** budget),
  **never** `quota_estimate_exhausted`. Day-1 outcome: **89**
  dispatched, each granted occurrence dispatched exactly once
  (provider-call count == granted count == `_attemptsOn(day1)` ≤
  100 == `derivedDayTotals(day1).dispatched`); the pending remainder
  is exactly the ordered suffix — **no silent skip**. After midnight
  the remainder survives untouched; day-2 grants continue (each
  asserted `ok`) and the job reaches `complete`; totals: 101
  provider calls overall, `_attemptsOn(day2)` = 12 ≤ 100, day-1
  dispatches still counted on day 1.

### Hold B proofs — revised tests

- **quota-corrections C2 (revised):** on the current-day-straddling
  fixture (created PT 2026-03-11 23:30, updated PT 2026-03-12 00:30),
  Rowan's required proof: **choosing the prior day (2026-03-11) —
  with a nonblank `authorizationRef` and a `source` supplied —
  refuses `quota_disposition_ambiguous_interval` and leaves ALL
  ledgers and the hold completely unchanged** (full snapshot:
  attempt rows byte-for-byte, dispatch ledger, reservation ledger,
  blocked flag, exception count). The current day and out-of-interval
  days refuse identically (ambiguity precedes bounds); malformed
  days still refuse `quota_disposition_day_invalid` first. In the
  same test, a **same-day** fixture (interval [03-12, 03-12]) keeps
  the disposition path: out-of-interval day refuses, the provable
  day succeeds with the auditable record intact, double disposition
  refuses. The test ends by advancing past the straddler's interval:
  the block is gone, the exception and its null
  `dispatched_day_key` remain.
- **quota-corrections C3 reconcile (revised):** while the straddler
  stands, `reconcileQuota.ok` is false with empty drift; disposition
  attempts to **both** in-interval days throw
  `quota_disposition_ambiguous_interval` with snapshots unchanged and
  `ok` still false; after midnight, `ok` is true,
  `currentDayBlocked` false, and the exception is **preserved, not
  absorbed** (count still 1, day still null).
- **quota-corrections C3 over-cap fixture (revised per Rowan):** the
  five historical unstamped floor-build calls are now **provably
  same-day** (created and updated both inside PT 2026-03-12,
  interval [03-12, 03-12]) instead of unevidenced midnight guesses.
  The guard still holds end-to-end: 96 reserved slots + 5
  dispositioned dispatches = 101 consumed; the fifth disposition
  carries `dayOverLimit {consumed: 101, limit: 100}`; reconcile
  reports the `day_over_limit` drift; a new grant still refuses
  `DAY_OVER_LIMIT`; the executor run on the filled grant makes
  **zero additional provider calls** (cumulative dispatches stay at
  exactly the 5 historical) and releases every reservation; history
  is preserved.
- **quota-budget T3 (revised):** the current-day straddle still
  refuses grants (`BOOTSTRAP_INCOMPLETE`, no reservations) and
  dispatches; dispositions to both in-interval days now throw
  `quota_disposition_ambiguous_interval`, changing nothing (block
  stands, exception count 1, straddler day still null, the reserved
  attempt still `reserved`); after the clock advances a day, the
  block has expired naturally, the exception is still on record, and
  a fresh grant succeeds.
- **quota-budget T8 (unchanged, still passing):** verified
  unaffected by construction — its floor dispatch is simulated with
  `created_at == updated_at` (the same instant), a same-day
  interval, so its disposition to today remains the provable path
  and every `slotsReconciled` assertion stands. (CONFIRMED by the
  green suite, not assumed.)
- **quota-corrections C1 regression (unchanged):** the 18-occurrence
  job still cohorts 8/8/2 in order, completes on its own grants with
  18 calls and 18 same-day dispatches, plan/intent identity
  unaltered.

## Battery — before / after (CONFIRMED, programmatic comparison)

Runner: `quota-fix2/run-battery.sh` (copied from quota-fix, comment
line updated), per-file `node --test --test-timeout=120000`, complete
log + exit code captured in `quota-fix2/logs/`
(`full-battery.log`, `battery-exit-code.txt`, `battery-summary.txt`,
`failing-files.txt`, `per-file/`).

| | quota-fix (baseline) | quota-fix2 |
|---|---|---|
| Suites | 133 — 111 pass / 22 fail | **134 — 112 pass / 22 fail** |
| Tests | 1,077 — 1,055 pass / 22 fail | **1,079 — 1,057 pass / 22 fail** |
| Runner exit | 0 | 0 |

- The **22 failing suites are set-identical** to the quota-fix
  baseline (`diff` of the sorted failing-files lists: no
  differences). They are the known pre-existing baseline failures
  (ENOENT-class environment failures in this harness; **zero**
  `AssertionError` occurrences in either combined log).
- The delta is **exactly** the new suite (`quota-rereview`, +1 suite,
  +2 tests). The revised suites keep their test counts
  (quota-budget 13, quota-corrections 7) — revisions replaced
  assertions inside existing tests rather than adding or removing
  tests.
- No other suite changed result.

## Honest limitations

- **Harness proof only.** Everything above is proven against the DO
  test harness with fakes. Per this workspace's standing rule, the
  harness is no evidence for real-DO empty-result behavior; nothing
  here was run against production or a real Durable Object, and
  nothing in this build authorizes doing so.
- **The 89/12 day split in A2 is a fixture outcome**, not a
  throughput claim: it follows deterministically from the slot model
  (12 slots per reservation, 100 per day, reservations closing as
  cohorts settle) on synthetic ~85-character segments. Real jobs
  with different reservation behavior will split differently; the
  invariant proven is the *bound* (≤ 100/day) and the *continuation*,
  not the split point.
- **Multi-day bootstrap exceptions are now permanently
  un-dispositionable by design.** Their dispatch day stays uncounted
  forever; the cost is conservative undercounting of a past day that
  can no longer accept grants anyway, and a current-day block that
  lasts until the interval rolls off. That is Rowan's chosen trade
  (fail closed over asserting a day), implemented as specified — not
  a gap this build may paper over with an invented evidence
  procedure.
- **INFERRED:** the hold-A branch adds one read-only
  `boundGrantTargets` evaluation per armed non-probe grant where the
  reservation block previously computed it later; net evaluations per
  grant are unchanged (the later call was replaced by reuse), so no
  new per-grant query cost is expected. Not benchmarked.
- **OPEN (unchanged by this build, each still its own gate):**
  deploying the quota guard (and/or the cache fix), production quota
  bootstrap/disposition/reconcile, arming, any generation, Batch
  arming, and the Chapter 3 resume. This report is a source-fix
  deliverable for Rowan's re-review of holds A and B only.
