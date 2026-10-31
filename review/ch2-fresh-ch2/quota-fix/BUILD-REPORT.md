# Quota guard corrections — the three SOURCE HOLD fixes (repo-only)

**Status: BUILT repo-only. No deploy. No production call, read, or
write was made by this build.** This tree is `quota-fix/`, copied
from the reviewed `quota-build/` tree; the baseline tree is
untouched, and every before/after hash below is against it.
Behavior outside the quota surface is unchanged: the accepted
cache-refresh code (`host/adapters.mjs`, `generation/d6-executor.mjs`)
and the fail-closed unknown-billing protections
(`generation/genstore.mjs`, `generation/gen-constants.mjs`) are
**byte-identical** to the quota-build tree (verified by `cmp` and
by the hashes in §5).

The corrections answer Rowan's SOURCE HOLD on the quota
implementation (roundtable issue #15, comment **6545387295**).
Her ruling that correcting these three points fits Julie's
recorded quota implementation build scope is the authority for
this build; nothing here approves merge, deploy, bootstrap,
arming, or generation.

---

## Correction 1 — cohort-bounded grants — **IMPLEMENTED** (CONFIRMED)

### The defect (as held)

`_issueGrant` passed **all** pending occurrences to
`reserveForGrant`, which budgets 12 worst-case slots per fresh
occurrence and refuses when the total exceeds the 100 daily
cap. An 18-fresh-segment job needs 216 slots: refused forever,
parked `parked_quota` daily, no progress possible.

### Why partial grants are safe here (source evidence, not assumption)

The fixed job/grant contracts **do** support them, so the
constraint branch of the hold was not needed:

- `_issueGrant` derives the grant's occurrence set at issue
  time from the job's live pending rows
  (`rowsForGrant(coord, jobId)` — occurrences in state
  `pending`). Nothing in the grant, job, or plan contract fixes
  a grant to the whole pending set; the grant message carries
  exactly the set it was issued for
  (`enqueueGrant` sends `[...grantSet]`).
- The service already re-requests a grant whenever a job has
  pending occurrences and no live grant (`driveOnce`'s
  `grantStep`: "a job that still has pending occurrences and
  no issued grant gets one"). A cohort-granted job stays in
  state `generating` — plan completion derivation requires
  zero pending **and** zero granted occurrences — so when a
  cohort's grant settles, the next drive requests the next
  cohort. No new continuation state was needed; the remaining
  pending entries **are** the durable continuation.
- Plan/intent identity is untouched: cohorting changes only
  which pending rows a grant names. The regression test
  asserts the plan row's `intent_key` and the single
  `d6_plan_jobs` row are unchanged after three grants.

### What changed

- **`generation/quota-budget.mjs`** — new exported
  `boundGrantTargets(coord, {planId, pending, dayKey})`:
  unarmed ⇒ returns the pending set unchanged (pre-quota
  behavior byte-for-byte). Armed: a bootstrap-blocked day or an
  already over-limit day (Correction 3) yields an empty cohort
  with the named reason; otherwise it returns the longest
  **prefix** of the pending list, in pending order, whose
  worst-case slots (`ATTEMPT_BUDGET_PER_SEGMENT` −
  `segmentAttemptsUsed`, the same figure `reserveForGrant`
  charges) fit the day's derived headroom
  (`PROVIDER_ATTEMPT_DAILY_LIMIT` − dispatched − open
  reserved). It stops at the first occurrence it cannot fund
  (never skips one to reach a later, cheaper one), and an
  exhausted occurrence (0 remaining slots) stops the cohort
  rather than being under-reserved. `reserveForGrant` then
  re-verifies the exact cohort inside the grant transaction —
  the bound and the reservation cannot disagree.
- **`coordinator.mjs`** — in `_issueGrant`, non-probe grants
  pass their targets through `boundGrantTargets`; an empty
  cohort returns the bound's reason (the ordinary budget
  refusal, the bootstrap hold, or the over-limit hold) and
  mints nothing.
- **`generation/service.mjs`** — one `GRANT_STOP_MAP` entry so
  the new over-limit refusal parks as `parked_quota` (see
  Correction 3).

**Two deliberate non-changes, stated for review.** (a) The
monthly-cap check above the hook keeps full-set semantics: a
job whose *total* estimate exceeds the monthly cap still parks
on cap exactly as before — cohorting is about the daily
attempt budget, not about slicing a job under the money cap.
(b) The daily grant counter likewise still gates on the full
pending count; it resets daily and an 18-occurrence job (18 ≤
100) always fits a fresh day, so it was never the permanent
refusal — the slot math was. If Rowan wants either check
cohort-scoped as well, that is a one-line follow-up, but it is
not required to unblock progress and changing it silently
would widen the correction.

### Proofs (tests/quota-corrections.test.mjs + revised T1)

- **Store:** with 60 slots already committed, an 18-segment
  job receives a cohort of exactly 3 (96 ≤ 100; a 4th would
  reach 108); the granted set is the ordered prefix, the other
  15 stay pending, every granted occurrence holds a full
  12-slot reservation, plan/intent identity unchanged. A day
  with only 4 slots of headroom refuses the next grant whole
  (ordinary budget reason — the day is not over limit) with no
  grant row, no reservations, nothing skipped.
- **Executor regression (the required 18-occurrence proof):**
  one job of 18 fresh segments completes through **three**
  bounded grants. The cohorts are **8 / 7 / 3**, not 8/8/2:
  each round's headroom is the day's *derived* total, which
  permanently counts the dispatches already made (8 consumed ⇒
  7 fresh fit; 15 consumed ⇒ the last 3 fit). After each round
  exactly the un-granted remainder is pending; the three
  grant payloads are pairwise disjoint, ordered, and their
  union is all 18; exactly 18 provider calls happen (fake
  provider); a fourth grant request mints nothing.
- **Rollover:** a 10-segment job grants 8 on day D; midnight
  passes; the 2 remaining are asserted still pending (not
  skipped, not dropped); day D+1 funds exactly the remainder;
  day D's dispatched count stays on day D.
- **T1 revised** (in `tests/quota-budget.test.mjs`): the old
  second half asserted the 216-slot whole-set refusal — the
  very behavior Correction 1 removes. It now asserts the
  bounded grant (job-b receives 3 of 5 with 60 already
  committed), and the atomicity proof T1 existed for is
  preserved by a third job whose first occurrence cannot be
  funded at all: the refusal leaves **no** grant row, **no**
  ledger rows, **no** reservations. (The ledger-row check was
  also repaired to filter on the real `op_key` column; the
  original filtered on a nonexistent `op_id` and so was
  vacuous.)

## Correction 2 — disposition day validation — **IMPLEMENTED** (CONFIRMED)

`disposeBootstrapException` (in `generation/quota-budget.mjs`)
now, **before any write**, inside the same single transaction
(so a refusal is a rollback of nothing — nothing was written):

1. Validates the day as a **real calendar date**: shape
   `YYYY-MM-DD` plus a UTC round-trip (`2026-02-30` is refused
   as `quota_disposition_day_invalid`, as are malformed
   shapes).
2. Derives the row's evidenced PT-day interval from its own
   stored `created_at`/`updated_at` and **refuses any assigned
   day outside `[lo, hi]`** with
   `quota_disposition_day_outside_evidence_interval`. No
   evidence-exception path was invented; evidence-less
   straddles remain exceptions and keep failing closed, exactly
   as the hold requires.
3. The disposition record now also stores
   `evidenceInterval: [lo, hi]` alongside the existing
   `authorizationRef`, `source`, and `note` — the basis the
   day was validated against is preserved on the record.

**Proof** (`tests/quota-corrections.test.mjs`): for a straddler
with interval [2026-03-11, 2026-03-12] blocking today
(2026-03-12), a disposition to 2026-03-10 and to 2026-03-13
both throw the interval refusal, and to `2026-02-30` /
`2026-3-12` the invalid refusal — and after **each** attempt a
full snapshot (attempt rows byte-for-byte including
`detail_json`, dispatch rows, reservations, blocked flag,
exception count) is asserted **identical** to before: the
wrong-day attempt changed nothing. The in-interval day
2026-03-11 then succeeds, records the interval + authorization
+ source, unblocks the current day, and cannot be repeated.

## Correction 3 — reconciliation truth + day-wide cap — **IMPLEMENTED** (CONFIRMED)

### 3a. `reconcileQuota.ok` means safe to rearm

`ok` is now `drift.length === 0 && !currentDayBlocked`, and
the drift detail additionally reports any day whose derived
consumed total exceeds the cap as a
`{kind: "day_over_limit", dayKey, consumed, limit}` entry.
`totals`, per-day `dayTotals`, `exceptions`, and
`currentDayBlocked` are still reported separately, unchanged
in shape. **T8 revised** accordingly: at the floor-dispatch
state it now asserts `ok === false` with `drift` empty (the
details still reported separately); after the in-interval
disposition it asserts `ok === true` again — the case there
has no drift, no exception, and consumed 12 ≤ 100, so the
stronger meaning holds.

### 3b/3c. The day-wide cap binds dispositions and pre-authorized dispatches

- New refusal `provider_attempt_budget_day_over_limit`
  (`QUOTA_REFUSALS.DAY_OVER_LIMIT`). Once a day's derived
  consumed (dispatched + open reserved) exceeds 100, the
  hold surfaces at every layer, by name:
  - **the disposition record itself**: a disposition that
    leaves its day over the cap returns and records
    `dayOverLimit: {dayKey, consumed, limit}` on the
    disposition (the historical dispatch row is inserted and
    preserved — never erased to fit the cap);
  - **grants**: `boundGrantTargets` yields an empty cohort
    with the over-limit reason, and `reserveForGrant` refuses
    it outright as defense in depth;
  - **dispatches**: `applyDispatchQuota` refuses
    `DAY_OVER_LIMIT` whenever the dispatch's day is already
    over the cap — on **every** path, including the
    existing-open-reservation path the hold named (3c). This
    is safe for legitimate in-flight work: binding under an
    existing reservation never *raises* the day's consumed, so
    the check can only fire on a day that is already over —
    in-flight dispatches on a within-cap day are unaffected;
  - **status**: `quotaBudgetView` gains a `dayOverLimit`
    boolean for the viewed day;
  - **parking**: the service maps the refusal to
    `parked_quota` with the over-limit reason, so a run that
    meets the hold parks under its name.
- One interaction worth naming: when the executor's run meets
  the hold, the resulting quota park settles the parked
  grant's reservations (`quota_park`, the addendum §1.5 shape —
  dispatch under them is impossible once parked, and resume is
  a new grant). The day's forward total then drops to the real
  dispatched count. That is a settlement of reservations, not
  an erasure: the dispatch rows and disposition records remain
  fully on the record, and re-arm still requires the halt +
  probe path. The fixture test asserts both halves.

### Proof — the required over-cap fixture (`tests/quota-corrections.test.mjs`)

96 slots of outstanding reservations (an 8-segment grant, not
yet run) plus five historical straddlers dispositioned onto
the same day: dispositions 1–4 leave the day at 97–100 (no
over-limit flag); the 5th crosses to **101** and its record
carries `dayOverLimit {consumed: 101, limit: 100}`.
Reconciliation reports `ok: false` with the `day_over_limit`
drift entry; the historical count (5 dispatches) is preserved.
A new grant refuses `provider_attempt_budget_day_over_limit`.
The pre-authorized grant's message then runs through the
executor: **zero provider calls** (fake-provider call count
asserted 0), no new dispatch rows, every refused attempt
released undispatched, and the run takes the quota stop shape.

## 4. Test inventory (mapping each required proof to a test)

| Required proof | Test |
|---|---|
| 18 eligible fresh occurrences: one bounded grant runs | `quota-corrections` C1 store + C1 regression (grant 1: 8) |
| Remainder stays pending | C1 store (15 pending, ordered) + C1 regression (per-round pending assertions) |
| Subsequent grants progress the same job, no scope widening | C1 regression (3 grants, disjoint ordered union = 18, exactly 18 calls, 4th grant mints nothing, intent_key unchanged) |
| No silent skip on rollover | C1 rollover (remainder pending after midnight; day counts stay on their days) |
| No under-reservation / no partial grant on an unfundable cohort | C1 store (full 12-slot reservations) + revised T1 (atomic refusal, zero partial rows) |
| Wrong-day disposition changes NOTHING | C2 (byte-identical snapshot after each refused attempt) |
| Real-calendar-date validation | C2 (`2026-02-30`, `2026-3-12` refused) |
| Authorization/source/basis preserved | C2 (record carries authorizationRef, source, evidenceInterval) |
| reconcileQuota.ok = safe to rearm | C3 reconcile test + revised T8 (ok false with empty drift; ok true after disposition) |
| Post-disposition over-cap: named hold, history preserved | C3 fixture (disposition `dayOverLimit`, reconcile drift entry, view flag, grant refusal) |
| Over-cap ⇒ ZERO additional provider calls | C3 fixture (fake-provider calls === 0, attempts released, no new dispatch rows) |

New/changed suites: `tests/quota-corrections.test.mjs` (new, 7
tests), `tests/quota-budget.test.mjs` (T1 + T8 revised, still
13 tests). `tests/quota-executor.test.mjs` unchanged (10
tests). All quota suites pass; the accepted
`tests/remediation-cache-refresh.test.mjs` still passes 6/6.

## 5. Files changed (before = quota-build tree, after = quota-fix tree)

Production sources (identical in the `worker/` tree and its
`v2/` mirror — one physical tree, as in the baseline build):

| File | Before SHA-256 | After SHA-256 |
|---|---|---|
| `generation/quota-budget.mjs` | `0ec13a45…` (668 lines) | `990b7327…` (817 lines) |
| `coordinator.mjs` | `7e84c575…` | `a817d89e…` |
| `generation/service.mjs` | `5fae5397…` | `aeeee06c…` |

Unchanged, verified byte-identical (`cmp` + hashes):
`generation/genstore.mjs` `811b6b15…`,
`generation/d6-executor.mjs` `c3613a81…`,
`generation/gen-constants.mjs` `9af664fa…`,
`host/adapters.mjs` `f8ac357e…` (the accepted cache-refresh
code), and every other file in the tree — a recursive `diff -rq`
against the baseline shows exactly the three sources above,
the one revised test file, and the one new test file differing
or added.

Tests:

| File | Before | After |
|---|---|---|
| `tests/quota-budget.test.mjs` | `0e1eed11…` | `29285bdf…` |
| `tests/quota-executor.test.mjs` | `5000be69…` | `5000be69…` (unchanged) |
| `tests/quota-corrections.test.mjs` | — | `459dfabe…` (new, 487 lines) |

## 6. Battery (full run on the final quota-fix tree)

`quota-fix/run-battery.sh` (the baseline runner, unchanged):
per-file `node --test --test-timeout=120000` over
`tests/*.test.mjs`. Complete log: `logs/full-battery.log`;
per-file logs: `logs/per-file/`; exit code:
`logs/battery-exit-code.txt` (**RUNNER_EXIT=0** — the runner
completed; per the review's own note this does not by itself
mean all suites passed); summary: `logs/battery-summary.txt`;
failing files: `logs/failing-files.txt`.

| | Suites | Tests |
|---|---|---|
| quota-build baseline | 132 — 110 pass / 22 fail | 1,070 — 1,048 pass / 22 fail |
| quota-fix (this build) | **133 — 111 pass / 22 fail** | **1,077 — 1,055 pass / 22 fail** |

The delta is exactly the new `quota-corrections` suite (+1
suite, +7 tests, all passing); the two revised tests keep
their suite's counts unchanged. The failing-suite set is
**verified programmatically identical** (sorted diff of the
baseline snapshot in `logs-baseline/failing-files.txt` against
`logs/failing-files.txt`: no differences, 22 = 22 — the known
pre-existing baseline failures, ENOENT-class fixture issues
untouched by this build). The combined battery log contains
zero `AssertionError` occurrences.

## 7. Limitations and evidence labels

- **CONFIRMED** (by the tests above, all with fakes): the
  three corrections' behavior, the cohort continuation
  mechanism, the byte-identical non-quota surface, and the
  battery delta.
- These tests are **NOT** provider-limit verification: the
  fake providers never contact Google; 100 remains the
  **app-selected Reader policy cap** pinned in code, not a
  verified provider limit; provider traffic from outside this
  Reader project remains invisible to the counter (unchanged
  from the baseline build's stated limitations).
- **INFERRED**: the mid-job rollover behavior relies on the
  service's existing grant re-request step (read in source,
  exercised end-to-end by the rollover test at the
  coordinator/executor seam; the full alarm-driven drive loop
  in production remains, as before, a deploy-time smoke
  question, not something this repo-only build can prove).
- **OPEN** (unchanged from the quota build, not addressed
  here): bootstrap/disposition/reconcile remain store-level
  operator functions (no HTTP route added — separately
  gated); deploy of the quota guard (with or without these
  corrections) remains a separate gated decision; the monthly
  cap and grant counter keep full-set semantics pending any
  contrary ruling (§Correction 1, deliberate non-changes).

## 8. What this build did NOT do

No production calls, reads, or writes; no deploy; no GitHub
posts or pins; no changes outside the quota surface listed in
§5; the `quota-build/` baseline tree was not modified (the
battery's baseline artifacts used for comparison are preserved
under `logs-baseline/`).
