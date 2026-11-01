# Ch 3 Recovery — Gate 2 Grant Finalizer: AMENDMENT 1

**Responds to:** Rowan's Gate 2 source review (REVISE) — one blocking
discrepancy (same-day continuation cohort: **4 vs 7**) plus four
requested source/test mappings.
**Amends:** `BUILD-RECORD.md` (pin `c24bd4716d2ae386fcefd31a97b4a202968671a0`,
repo `jedavid33-design/opal-reader`, branch `ui1-review`) — this
amendment supersedes the specific build-record sentences identified
in §4.3. BUILD-RECORD.md itself is not edited.
**Scope:** repo-only. No production contact, no deploy, no code
change (§6). One test file added; battery re-run in full (§5d, §6).

**Resolution in one sentence:** the proposal and the code agree —
the discrepancy was a **fixture/test gap**: the continuation suite's
organic fixture dispatches 8 attempts before finalization (not
Phase A's 44), so its same-day cohort of 7 is the correct output of
the shipped formula on an 8-dispatch state, while proposal
§3.2/§9.1.9's 4 is the correct output on the 44-dispatch
live-shaped state — a scenario no test exercised until the new
suite added here (§4).

---

## 1. The discrepancy, restated precisely

**Proposal derivation** (`RECOVERY-PROPOSAL-DRAFT.md` §3.2, and the
mandatory test requirement §9.1 item 9):

- After finalization on the original PT day (2026-10-31), the day's
  derived totals are `44 dispatched + 0 reserved = 44 consumed`
  (§3.2; the after-state table §2.2).
- Headroom `100 − 44 = 56`; each fresh occurrence needs a 12-slot
  worst-case reservation; first continuation prefix =
  `floor(56 / 12) = 4` occurrences (§3.2).
- §9.1 item 9 requires a test proving exactly this: "with
  finalization on the original day (44 / 0 / 44 after closure), the
  first continuation prefix is exactly four fresh occurrences."

**Build-record assertion** (`BUILD-RECORD.md`, the check-5 summary
paragraph): "same-day cohort sizing (after finalization, cohort 2 =
**7**) and fresh-day sizing (cohort = **8**); and multi-cohort
continuation — cohorts [7, 7, 1] drive the SAME plan/job to
completion (23 provider calls…)".

Read against §9.1 item 9, the build record presents **7** where the
proposal requires **4**. Either the shipped cohort-bounding code
overshoots the proposal's formula (a production-safety defect:
Gate 4 would grant more than the day's proven headroom), or the 7
comes from a different state than the one §9.1 item 9 specifies
(a test-evidence defect). §2–§3 settle which, from source and
fixture facts only.

## 2. The exact source formula

All citations are to the build tree (`finalizer-build/worker-build/`),
whose worker files are byte-identical to the Gate 2 pin (§5d).

**Constants** (`worker/generation/gen-constants.mjs`):
`SEGMENT_ATTEMPT_BUDGET = 12` (:16); `PROVIDER_ATTEMPT_DAILY_LIMIT
= 100` (:36).

**Derived day totals** (`worker/generation/quota-budget.mjs:193-201`,
`derivedDayTotals`):

```text
dispatched = COUNT(*) of d6_provider_dispatches for the PT day
reserved   = SUM(slots_total − slots_consumed) over the day's
             reservations in state 'open'        (:197-199)
consumed   = dispatched + reserved              (:201)
```

Two consequences, both load-bearing:

- A **closed** reservation contributes **0** to `reserved` —
  settlement removes its residual from the derived total. Its
  dispatch rows are untouched and remain counted in `dispatched`
  forever. This is exactly proposal §2.3's claim, and it is what
  the code does.
- Nothing else enters the total: no stored counter is consulted
  (`slots_consumed` is used only per-reservation, and is verified
  against the derived dispatch count at dispatch time).

**Reservation size** (`quota-budget.mjs:544-552`, `reserveForGrant`):
each granted occurrence reserves `SEGMENT_ATTEMPT_BUDGET −
segmentAttemptsUsed(plan, occurrence)` — 12 for a fresh occurrence.

**Cohort bounding** (`quota-budget.mjs:624-641`, `boundGrantTargets`;
called from `coordinator.mjs:1689-1691` inside `_issueGrant`, whose
result replaces the grant's target set at `coordinator.mjs:1730-1734`):

```text
used = derivedDayTotals(day).consumed                 (:631)
for each pending occurrence, in the pending query's order
  (coordinator.mjs:1653: ORDER BY occurrence_id):
    slots = 12 − segmentAttemptsUsed                  (:634)
    if slots <= 0 or used + slots > 100: stop         (:635-636)
    take it; used += slots                            (:637-638)
```

So the cohort is the longest ordered prefix whose cumulative
worst-case slots fit in the day's remaining derived headroom. No
other inputs: no grant-estimate term, no remaining-plan-size term,
no cap other than the 100/day derived limit (the monthly-cap and
grant-count checks in `_issueGrant` run separately and do not
resize the cohort).

**The arithmetic, both states:**

| State at sizing time | used | Prefix computation | Cohort |
|---|---:|---|---:|
| Production, same day, post-finalization (§3.2) | 44 | 44+12k ≤ 100 → k = 4 (92; 5th → 104) | **4** |
| Fixture E, same day, post-finalization (§3) | 8 | 8+12k ≤ 100 → k = 7 (92; 8th → 104) | **7** |
| Any, fresh PT day (§3.3 / §9.1 item 10) | 0 | 12k ≤ 100 → k = 8 (96; 9th → 108) | **8** |

The shipped code therefore implements the proposal's formula
exactly. On the state §9.1 item 9 specifies, it yields **4**.

## 3. Fixture facts

### 3.1 Fixture E — the organic continuation fixture
(`tests/grant-finalizer-continuation.test.mjs`)

- **Clock:** the whole first test runs at `T_DAY1 =
  2026-10-31T19:00:00Z` = PT 2026-10-31 (:37). Finalization and
  continuation happen on that same PT day — the test *is* a
  same-day scenario. The second test moves the clock to `T_DAY2`
  (PT 2026-11-01, :38) only *after* finalization, for fresh-day
  sizing.
- **Attempt history:** the fake provider succeeds on the first
  attempt for every occurrence (:108, `providers.behavior.onCall`
  returns a synthetic WAV; no block/retry behavior is configured).
  Cohort 1 (8 occurrences) therefore makes exactly **8 provider
  calls** (:172) — one dispatch per occurrence, not Phase A's 44.
- **Reservations before finalization:** 8 open, `slots_total` 96,
  `slots_consumed` 8, residual 88; derived totals asserted in the
  test itself (:161-164): `{ dispatched: 8, reserved: 88,
  consumed: 96 }`.
- **After finalization (same PT day):** (:192-195) `{ dispatched:
  8, reserved: 0, consumed: 8 }`.
- **Why the cohorts are [7, 7, 1]:** sizing starts from `used =
  8` → 7 fit (table §2). Those 7 dispatch once each and settle →
  `used = 15` → 7 fit again (15+84 = 99; an 8th → 111). One
  occurrence remains → cohort of 1. Assertions at :212-213;
  total provider calls 23 = one per eligible occurrence (:217);
  end-of-day totals `{ dispatched: 23, reserved: 0, consumed: 23
  }` (:225).
- **Fresh-day run (second test):** finalization on PT 2026-10-31,
  clock advanced to PT 2026-11-01, first continuation cohort =
  **8** — matching §3.3/§9.1 item 10.

Fixture E proves the *succession mechanics* organically (real
driveOnce → real grant → real executor → swallowed report →
finalizer → bounded cohorts drain the same plan). It does **not**
exercise the §9.1 item 9 state: its pre-finalization dispatch
count is 8, not 44.

### 3.2 Fixture S — the live-shaped store fixture
(`tests/helpers/grant-finalizer-fixture.mjs`, used by
`tests/grant-finalizer.test.mjs`)

- **Clock/day:** `DAY = "2026-10-31"` (:17); `T0 = Date.UTC(2026,
  10, 1, 3:00)` = PT 2026-10-31 afternoon (:18). All 44 dispatch
  rows are stamped `dispatch_day_key = DAY`; all 8 reservations
  carry `day_key = DAY`, `slots_total = 12`, `slots_consumed` =
  the per-occurrence attempt counts **4/6/6/6/6/6/4/6 = 44**
  (TARGET_COUNTS, :39-48; reservation insert in
  `seedStalledState`). Derived pre-finalization totals asserted
  by the preview test (`grant-finalizer.test.mjs:76-126`):
  `{ dispatched: 44, reserved: 52, consumed: 96 }`.
- **The gap:** no Fixture S test ever sized a continuation
  cohort. `grant-finalizer.test.mjs` contains no `driveOnce`,
  `boundGrantTargets`, or cohort assertion at all (verified by
  search of the file) — its 32 tests cover
  preview/finalize/replay/refusals/atomicity only. So §9.1 item
  9's scenario (44 dispatched + finalization on the original day
  → prefix 4) was **untested in both fixtures**: Fixture E has
  the driver but the wrong dispatch count; Fixture S has the
  exact dispatch count but no driver.

## 4. Resolution

### 4.1 Branch taken: fixture/test gap

- The **code is correct**: `boundGrantTargets` on the §9.1.9
  state yields exactly 4 (proven by the new test, §4.2).
- The **proposal is correct**: §3.2/§9.1.9's arithmetic is the
  shipped formula evaluated on the production state (§2 table).
- The **build record's presentation was wrong**: it listed
  Fixture E's 7 under "same-day cohort sizing" in the check-5
  evidence summary without stating that Fixture E's
  pre-finalization state is 8 dispatched (8/0/8 after closure),
  not the §9.1.9 state (44/0/44). A reader — Rowan — correctly
  measured it against item 9 and found a contradiction that the
  record, as written, could not resolve.

### 4.2 The missing test, added and passing

New file: `tests/grant-finalizer-sameday.test.mjs` (one test):

> "same-day sizing (§9.1.9): finalize on the original PT day
> (44/0/44) -> first continuation prefix is exactly 4"

It seeds Fixture S, runs the real finalizer with the harness
clock on PT 2026-10-31, and asserts the full chain:

1. `ptDayKey(T0) === "2026-10-31"` — no day boundary is crossed
   anywhere in the test.
2. Pre-finalization derived totals `{ 44, 52, 96 }`.
3. Preview classifies `finalizable`; `finalizeGrant` returns
   `applied`.
4. Post-finalization derived totals `{ dispatched: 44, reserved:
   0, consumed: 44 }` — §3.2's after-state, verbatim.
5. `boundGrantTargets` over the pending set (the coordinator's
   own query order, `coordinator.mjs:1653`) returns exactly the
   first **4** pending occurrence ids.
6. The production driver path — `service.driveOnce()` →
   `coord.requestGrant` → `_issueGrant` — dispatches exactly one
   grant, `grant:<job>:2:full`, whose message carries exactly
   those same 4 ids, in order.
7. The new grant's 4 reservations are open on DAY at 12 slots
   each; day totals after issuance `{ 44, 48, 92 }`; the other
   11 occurrences remain `pending`, the 8 remain `ready`.

**One test-local fidelity note, stated plainly:** Fixture S's SQL
seed leaves `d6_attempt_log.dispatched_day_key` NULL for the 44
(the finalizer never reads that column — `grant-finalizer.mjs`
contains no reference to it, verified by search — so the 32 store
tests are unaffected). In production those rows are stamped:
Phase A ran post-bootstrap, and `markDispatching` writes the
stamp atomically with each dispatch row (the §3.2 note at the
head of `bootstrapExceptions`, `quota-budget.mjs:231-239`).
Unstamped, the seeded rows read as bootstrap exceptions and the
quota guard fail-closes the day (`boundGrantTargets` returns the
bootstrap-incomplete refusal before sizing) — a state production
never had. The new test therefore stamps exactly the attempts
that have dispatch rows (the 44; their dispatch rows already
carry DAY) with a single UPDATE before driving, and asserts
`currentDayBootstrapBlocked(coord, DAY) === false`. No shared
fixture file was modified.

### 4.3 Corrected build-record language (superseding text)

The build record's check-5 sentence — "same-day cohort sizing
(after finalization, cohort 2 = **7**) and fresh-day sizing
(cohort = **8**); and multi-cohort continuation — cohorts
[7, 7, 1]…" — is superseded by:

> Same-day cohort sizing is proven at the two distinct states
> the formula distinguishes. On Fixture E's organic state (8
> dispatches before finalization; 8/0/8 after), the first
> continuation cohort is 7 and cohorts [7, 7, 1] complete the
> plan. On the exact live-shaped state (Fixture S: 44 dispatched;
> finalization on the original PT day; 44/0/44 after closure),
> the first continuation prefix is exactly **4**, at both the
> `boundGrantTargets` layer and the `driveOnce` grant layer
> (`tests/grant-finalizer-sameday.test.mjs`) — the §3.2/§9.1.9
> figure, and the one Gate 4 must quote for production.
> Fresh-day first cohort is 8 in both fixtures.

**Derived (arithmetic, not a test result):** if Gate 4 continues
on the original day and each occurrence dispatches once per
cohort, the same formula gives the succession **[4, 4, 4, 3]**
(44→48: 48+48 = 96 ≤ 100, a 5th → 108; 52: 52+48 = 100 exactly;
then 3 remain). Quoted here only as the formula's consequence;
the test proves the first prefix, which is what §9.1 item 9
requires.

## 5. Requested source/test mappings

### 5a. Operator admission — public entry AND Durable Object class

Both finalizer surfaces (`GET /v2/d6-grant-finalization-preview`,
`POST /v2/d6-finalize-grant`) sit in the shipped operator fence
class, in `worker/worker-entry-prod-d6.js`:

- **Public entry — route recognition:** :1591-1594
  (`isGrantFinalizationPreviewRoute`, `isGrantFinalizeRoute`);
  both are in the production gate's `skipClientToken` list
  (:1595-1604), so no client token admits them.
- **Public entry — credential check:** the operator-admission
  block (:1636-1658) includes both routes in its condition
  (:1638-1648) and requires header `x-opalreader-operator-token`
  to equal the dedicated migration-operator credential, which
  must be configured and distinct from the client access token
  — misconfiguration returns 503 `migration_operator_not_
  configured`, a wrong/absent credential 403
  `migration_operator_required` (:1650-1656).
- **Public entry — stamp:** only after that check does the
  internal forward set `x-opalreader-operator-admitted: "1"`
  (:1665-1667; `"0"` otherwise — the entry overwrites the header
  on the internal request, so a client-supplied stamp never
  survives). Route forwards: preview :1901-1915, action
  :1917-1927.
- **DO class gate — re-check:** the internal handlers
  (`/internal/d6/grant-finalization-preview` :1326, stamp check
  :1335-1336; `/internal/d6/finalize-grant` :1351, stamp check
  :1363) each refuse 403 `migration_operator_required` unless
  the stamp is exactly `"1"`. The action handler additionally
  enforces the closed body allowlist { grantId, planId, jobId,
  authorizationRef, expectedPreconditionDigest } (:1368-1389).
  Neither route is halt-fenced (finalization is bookkeeping, not
  generation).
- **Tests** (`tests/grant-finalizer-routes.test.mjs`, all through
  the real entry + class): FINR-3 (:195) — no credential and
  client-token-alone refuse on **both** routes, zero writes;
  FINR-5 (:236) — a spoofed stamp admits neither publicly nor on
  direct class calls; FINR-4 (:222) — wrong scope/instance
  refuse at the entry; FINR-1 (:139) — happy path (preview →
  finalize → replay); FINR-6 (:276) — closed-allowlist matrix;
  FINR-7 (:313) — class-gate 400s and named store refusals.

### 5b. Audit/replay identity and unexpected grant-state refusals

In `worker/generation/grant-finalizer.mjs`, classification is
derived fresh on every call (`deriveGrantFinalizationState`,
reported-grant branch :320-358):

- Grant `reported` **with** a matching finalizer audit row and
  all 8 reservations closed `grant_settled` →
  `already_finalized` (:344). The action maps this to outcome
  `already_finalized` with **zero writes** (:713-714).
- Grant `reported` **without** the audit row (a real executor
  report landed) → `already_reported_not_finalizer` (:339;
  action :717-718) — and the reservations are **not** settled on
  replay, by design.
- Grant `reported` + audit row + any reservation not in the
  exact closed shape → refusal `grant_finalization_reported_
  inconsistent` (:349) — a STOP, never a success.
- Audit row present beside a grant **not** `reported` → refusal
  `grant_finalization_audit_mismatch` (:358).

The finalization itself runs in **one** coordinator transaction
(`coord._tx`, :711): audit INSERT (:743) → grant →
`reported` with a labeled operator-finalization `report_json`,
never an impersonated executor report (:761-773) →
`_completeClaim` (:777) → settlement sweep whose result must be
**exactly** the expected 8 ids with an **empty** blocked list,
else `FinalizeAbort` rolls everything back (:786-792) —
stricter than `handleReport`, which ignores the blocked list →
`_deriveJobCompletion` verified to leave the job `generating`
at the same revision (:796-801) → post-write re-derivation must
classify `already_finalized` with phase money and
attempt/dispatch counts untouched, else rollback (:805-815).

**Tests** (`tests/grant-finalizer.test.mjs`): "replay is
audit-bound, byte-stable, and write-free" (:179); "a grant
reported without the finalizer audit refuses as not-finalizer,
zero writes" (:192); "reported + audit + a reopened reservation
STOPs as inconsistent" (:208); "an audit row beside an issued
grant is a mismatch and stops everything" (:225); "finalize
applies exactly the §4.4 writes, atomically" (:128);
atomicity pair (:421, :447).

### 5c. The production binding revision_key / cache_key correction

**Where D6 commits write bindings:** the executor commits via
`store.commitVerified` with **`revisionKey: facts.cacheKey`**
(`worker/generation/d6-executor.mjs:344-352` — its comment:
"The binding's revision key is the payload fingerprint (the
cache key)… The job row's revision_key is the REQUEST key, not
the recording's"). The fingerprint is
`fingerprintFor(payload)` over the work source's payload
(`worker/generation/d6-work-source.mjs:105-117`;
`d6-executor.mjs:456`), and it *is* the cache key.
`commitVerified` (`worker/generation/genstore.mjs:257-272`)
passes it to `coord.validateAndBind`, which inserts the binding
row with that value as `revision_key`
(`worker/coordinator.mjs:2273-2275`) and stamps the occurrence's
own `cache_key` (`genstore.mjs:278-279`). The occurrence row's
`revision_key` remains the request key (`fp-<occurrenceId>`).

**Consequence:** a binding proof keyed on the occurrence's
`revision_key` can never match a genuine D6 commit's binding.
The only stable join is `cache_key`. The finalizer's §4.3.23
proof therefore matches on cache_key alone
(`worker/generation/grant-finalizer.mjs:623-637`): the binding
lookup is `WHERE occurrence_id = ? AND cache_key = ?`
(:631-633), cross-checked against the occurrence's stamped
`cache_key` (:634), refusing `grant_finalization_binding_
mismatch` (:635). Its comment (:625-629) records exactly this
reasoning.

**Fixture correction:** Fixture S originally risked seeding
bindings under the `fp-` request key; as built, its bindings
are seeded with `revision_key == cache_key ==` the execution's
cache key (`tests/helpers/grant-finalizer-fixture.mjs:437-443`,
comment :437-439), while the chapter job's occurrence rows keep
`revision_key = fp-<id>`.

**Tests:** the store suite's refusal case "a target binding
disagrees with its execution" (`grant-finalizer.test.mjs:372-376`)
flips a binding's `cache_key` and requires
`grant_finalization_binding_mismatch` with zero writes; the
preview test (:76-126) derives all eight targets' binding state
from the corrected shape; Fixture E exercises the real path end
to end — its bindings are written by the actual executor commit
(fingerprint keys), and the finalizer preview classifies that
state `finalizable` (`grant-finalizer-continuation.test.mjs`,
first test). **Gate 3 note (unchanged from the build record):**
the census should confirm the eight production bindings carry
`revision_key == cache_key`.

### 5d. Battery evidence

Command (build tree root): `node --test --test-timeout=120000
tests/*.test.mjs`. RUNNER_EXIT is 1 in every full run because the
22 baseline file failures drive it (noted in BUILD-RECORD §3).

| Run | Tests | Pass | Fail | Log |
|---|---:|---:|---:|---|
| Baseline (ch3-build tree, like-for-like per BUILD-RECORD §3) | 1,136 | 1,114 | 22 | (build record §3) |
| Gate 2 build tree (original) | 1,177 | 1,155 | 22 | `logs/full-battery.log` |
| **Amendment final tree (this amendment)** | **1,178** | **1,156** | **22** | `logs/full-battery-amendment1.log` |

The amendment delta is exactly +1 test / +1 pass (the new
same-day suite) — no other movement. Finalizer suites together:
**42/42 pass, exit 0** (`logs/finalizer-suites-amendment1.log`;
was 41/41). New suite alone: 1/1, exit 0
(`logs/sameday-suite.log`).

The 22 failing files — **verbatim identical in the original and
amendment full runs** (machine-diffed, sets equal):

```text
tests/adaptive-background-repair.test.mjs
tests/audio-chunk-playback.test.mjs
tests/chapter-quota-banner.test.mjs
tests/continue-preparation-progress.test.mjs
tests/continue-setup-recovery.test.mjs
tests/continue-to-quota.test.mjs
tests/cross-device-chapter-handoff.test.mjs
tests/dormant-playback-start.test.mjs
tests/first-chapter-segment-joining.test.mjs
tests/gemini-400-hydration.test.mjs
tests/gemini-batch-lane.test.mjs
tests/gemini-quota-diagnostics.test.mjs
tests/generation-manual-queue-reuse.test.mjs
tests/generation-playback-concurrency.test.mjs
tests/generation-session-sync-guard.test.mjs
tests/p8-d3-prod-envelope.test.mjs
tests/p8-upload-envelope.test.mjs
tests/playback-bookmarks.test.mjs
tests/restore-sound-rewind.test.mjs
tests/silent-audio-recovery.test.mjs
tests/split-first-update-stop.test.mjs
tests/sync-diagnostics.test.mjs
```

All 22 are whole-file failures at 1:1 (load/envelope suites
outside the generation path), present identically on the
pre-finalizer baseline. No baseline failure was relabeled; no
new failure was introduced.

**Final tree state:** the tree's diff against the ch3-build
source tree is exactly the Gate 2 surface plus the one added
test file. Hashes unchanged from the Gate 2 pin:
`worker/generation/grant-finalizer.mjs` SHA-256
`15dd575f77efb0d5159f3674162728662b102891cd95cd7b680bf4a8bd0794ee`;
`worker/worker-entry-prod-d6.js` SHA-256
`292ca83e892d5d675f1c107ea4adf1fed34cca6c054fcd068c51b403f79f8a31`;
`worker/generation/gen-schema.mjs` SHA-256
`d7ae4936b11fe0d01c9ff8a6e1ccbb7364541ecad7d012b8fc3e712a453aacc5`
(byte-identical to the source tree).

## 6. What changed

- **No code changed.** No file under `worker/` was modified
  (hashes in §5d match the Gate 2 pin). The proposal was not
  edited either — its §3.2/§9.1.9 derivations stand as written.
- **Added:** `tests/grant-finalizer-sameday.test.mjs` (1 test,
  §4.2) — the only new file in the tree.
- **Not edited:** `BUILD-RECORD.md` (this amendment supersedes
  the sentences named in §4.3), the shared fixture helper, and
  every existing test.
- **Re-runs on the exact final tree:** new suite 1/1 (exit 0);
  finalizer suites 42/42 (exit 0); full battery 1,178 / 1,156 /
  22 with the failing set identical to baseline (RUNNER_EXIT=1,
  driven by those 22). Logs in `finalizer-build/logs/`
  (`sameday-suite.log`, `finalizer-suites-amendment1.log`,
  `full-battery-amendment1.log`).

**For Rowan's hardest look:** (1) the new test's stamp step
(§4.2) — it is test-local and production-faithful, but it is the
one place this amendment touches seeded state, and its premise
(production's 44 rows carry the stamp) rests on the
`markDispatching` atomic-write contract cited there; (2) that
§9.1 item 9 is a *sizing* requirement — the new test proves the
prefix at both sizing layers and the grant's issuance, while
execution of a 44-shaped cohort remains covered organically by
Fixture E at its own dispatch counts; (3) the [4, 4, 4, 3]
succession in §4.3 is labeled derivation, not evidence.

**Turn:** Rowan's re-review of the Gate 2 build as amended.
Gate 2D remains Julie's separate decision.

— Wren (build coordinator)
