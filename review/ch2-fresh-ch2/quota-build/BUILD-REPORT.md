# D6 Quota Guard — BUILD REPORT (repo-only)

**Scope of this build:** implementation + tests + this report, in the
local tree only. No production calls, no deploy, no GitHub posts or
pins. Deploy remains separately gated (Rowan source review → deploy
proposal → Julie's approval), exactly as before this build.

**Design sources:** `~/workspace/ch2-program/remediation/QUOTA-PROPOSAL.md`
as amended by `~/workspace/ch2-program/remediation/QUOTA-ADDENDUM.md`
(the addendum wins on conflict). Design PASS: board issue #15,
comment 6544950778 (Rowan), including her six binding acceptance
invariants. Build approval: comment 6545090525 (Julie, 2026-10-31).

**Base tree:** a byte copy of `~/workspace/ch2-program/remediation/worker-build`
(the cache-refresh remediation tree, Rowan repo-only SOURCE PASS
6544821907). The remediation tree was not modified — its file hashes
were re-verified against the values recorded before this build began
and are unchanged. `worker-build/v2` is a symlink to `worker-build/worker`
(one physical tree; the deployed envelope's `v2/` paths are these files).

---

## 1. Change surface (file by file, SHA-256 before → after)

| File | Before (base) | After (this build) | Change |
|---|---|---|---|
| `worker/generation/quota-budget.mjs` | — (new file) | `7c0d48dec73b598f41231b0a727e22f051e426f07f06b685dda36afa822604f4` | NEW, 668 lines: the entire quota module (§2) |
| `worker/generation/genstore.mjs` | `8602e45e270e40889dd1cfb91c8a7e380c8708a071a7cec3bb1f5b33533764a3` | `811b6b15b790097ad0010be3c71881c5024331143b4b0e2031392287bb839c2a` | `markDispatching` wrapped in one `coord._tx`; quota hook inside the transaction |
| `worker/generation/gen-constants.mjs` | `6922ad7402bcc369bbd48b12d859ccdf93964dbd94ab593ce126aa7af0a2e4ee` | `9af664fafc61dff1c16de8f94d06c0097271313bae7327d2a9a9d16efe14c77d` | `PROVIDER_ATTEMPT_DAILY_LIMIT = 100` appended, labeled an app-selected Reader policy cap, NOT a verified Google limit |
| `worker/coordinator.mjs` | `c31359ae87cf0271c2186a579e6540461089e0ffaa181e00c732ceed649d8eb3` | `1efe84823db97e5257688131e0ca0c1b9b01d566de53ecb5516615e29ded249b` | `dayKeyPT` exported; reservation hooks in `_issueGrant`, `handleReport` (park + settle), `_voidDispatch`; provider fields on `quotaView` when armed |
| `worker/generation/d6-executor.mjs` | `9cc90fe9c4f2acbe9c17b49464ce11ad38743244aa77ad7db8c71fa6bf46e9a8` | `c3613a818f598a2fc9f0f975312ad76879edab6bdffcdd06fe3fb2e3b123984c` | `wrappedSynthesize` refusal handling; `runFresh` quota-budget refusal branch. The cache-refresh remediation code (`hydrateProbeKey` etc.) is untouched |
| `worker/generation/service.mjs` | `c4008d982981076629b54c45461cbffbb8ffa53b605a3597a0b19fc066da0708` | `3e9b6421aba54cd1f2ca82df0027d27b0a549a496950824defdcf9d1003436c2` | Two `GRANT_STOP_MAP` entries; `retireHaltedPlan` closes the plan's reservations as `halt_settled` inside its existing transaction |
| `tests/quota-budget.test.mjs` | — (new file) | `9ebb7a22d864658545ff6191fdda4a57e6cd1abd7544ff4e5c93c8447547fff1` | NEW: 13 tests (store/coordinator level) |
| `tests/quota-executor.test.mjs` | — (new file) | `5000be69e7f1a03e2a33700f80b060c61f239fcc8c56d39b7f7db5d6c48605de` | NEW: 10 tests (executor level) |

A recursive diff of the two trees (`diff -rq`) shows exactly these
files and nothing else: 5 modified, 1 new module, 2 new test files.
No other file — including all cache-refresh remediation code — differs.

## 2. The mechanism as implemented

All quota logic lives in `worker/generation/quota-budget.mjs`; the
other files carry only hooks at the points the addendum names.

**Arming.** Enforcement is active exactly when a durable bootstrap
record exists (coordinator `meta` key `d6_quota_bootstrapped_at`,
written only by `bootstrapQuota()`). Before bootstrap, every hook is a
no-op and behavior is byte-equivalent to the floor build: no quota
tables exist, grants create no reservations, `markDispatching` runs
its original statement, `quotaView` carries no provider fields. This
is the addendum §3 framing (bootstrap is a distinct migration event;
the floor build does not enforce the quota).

**Schema (additive DDL only, lazily ensured by `bootstrapQuota`).**
Two new tables — `d6_provider_dispatches` (per-dispatch ledger keyed
by `attempt_id`, with `dispatch_day_key` + `dispatched_at`) and
`d6_grant_reservations` (reservation ledger; `reservation_id` =
`qres:${grantId}:${occurrenceId}:${day_key}`; `slots_total`,
`slots_consumed`, `state` open/closed, `close_reason`) — plus one
guarded `ALTER TABLE` adding `dispatched_day_key` to
`d6_attempt_log`. The DDL deliberately does **not** live in
`GEN_SCHEMA`: an existing suite (`tests/d6-correction.test.mjs`)
asserts the D6 entry bootstrap adds exactly the eight `GEN_SCHEMA`
tables; the adjudication build set the precedent of keeping new DDL
in its own module with lazy ensure. Presence discipline: both tables
present or neither; exactly one present throws
`provider_attempt_budget_schema_inconsistent` rather than guessing.

**Reservations (grant time).** Inside `_issueGrant`'s existing
transaction, after the `grant_exists` duplicate check and only when
`env.d6StandardOnly` is set (the same gate as the existing D6 guard),
`reserveForGrant` creates one reservation per granted occurrence with
`slots_total = 12 − segmentAttemptsUsed(plan, occurrence)` at grant
time. It refuses — rolling back the whole grant, leaving zero partial
rows — when the day is bootstrap-blocked
(`provider_attempt_budget_bootstrap_incomplete`), when slots would be
≤ 0, or when the day's derived total plus the new reservation would
exceed the pinned limit (`provider_attempt_budget`). Replay of an
existing grant can never create a second reservation (identity is the
primary key; the base path refuses the replayed grant first anyway).
Multiple grants are independent rows; retries reserve the *remaining*
budget (12 − attempts used so far) under the new grant. The existing
grant counter (`DAILY_QUOTA_LIMIT`, on grants) is untouched and
remains a distinct figure from dispatch authorizations everywhere.

**Dispatch (the transaction).** `genstore.markDispatching` — the only
path that may precede a provider call — now runs inside one
`coord._tx`. On an armed store, `applyDispatchQuota` runs inside that
transaction and: proves the attempt is still `reserved` (the base
transition guard, unchanged); resolves the attempt's execution and
requires a grant; refuses if the dispatch day is bootstrap-blocked;
binds a current-day OPEN reservation of the exact grant+occurrence —
or, if only another day's open reservation exists, atomically creates
the re-reservation for the dispatch day inside the same transaction
(slots recomputed as 12 − attempts used *now*; refusal
`provider_attempt_budget_day_rollover` if the new day cannot fund it);
refuses `provider_attempt_budget_unreserved` when no open reservation
exists at all (the recovery defect case fails closed here); verifies
the reservation's stored `slots_consumed` against its derived count
(mismatch → `provider_attempt_budget_counter_drift`); enforces
`slots_consumed < slots_total` and the day budget; inserts exactly
one dispatch row; increments `slots_consumed`; and stamps the
attempt's `dispatched_day_key` in the same UPDATE that transitions it
to `dispatching`. Any refusal throws inside the transaction — the
attempt stays `reserved`, no slot is consumed, no dispatch row
exists, and the executor never reaches the provider call.

**Executor surfacing.** `wrappedSynthesize` (verified by grep to be
the sole production caller of `markDispatching`) catches a
`QuotaBudgetRefusal`, releases the attempt (it provably never
dispatched; released attempts count zero in every accounting view,
like the other provably-never-dispatched paths), and rethrows an
error carrying the refusal reason — explicitly *not* a quota-429
shape. `runFresh` classifies it before the provider-429 branch:
execution failed at stage `quota`, occurrence reported `daily_limit`
(so the coordinator records the standard park), with evidence
`{ quotaBudgetRefusal: <reason> }` — an honest record that no request
was sent and no 429 was received.

**Reservation lifecycle (§1.5).** Close reasons: `grant_settled`
(a grant's report closes it — settle sweep in `handleReport` after
`_completeClaim`), `quota_park` (the daily-limit report branch closes
the grant's reservations in the same flow that writes the park),
`halt_settled` (only from `retireHaltedPlan`, whose existing fence
has already proven no unknown attempt remains open for the plan), and
`grant_voided` — **a documented extension** for the coordinator's
provably-never-dispatched void path (`_voidDispatch`); it is more
auditable than reusing `grant_settled` for a grant that never
settled, and it never fires while a claim is live in a way the fence
would block. Closure is fenced in `closeReservation`: executions of
the (grant, occurrence) in `granted`/`attempted` block every reason
(dispatch is still reachable); `unknown_billing` blocks every reason
except `halt_settled`, which additionally requires zero open unknown
attempts for the (plan, occurrence); `synthesized`/`flushed`/
`verified` never block (no provider call remains — the commit path
only); terminal or absent executions never block. A blocked close is
reported in the sweep result, never thrown and never forced; a second
close is a no-op, so no reservation can ever be freed twice. An
unknown-billing stop makes no report at all (existing executor law),
so its reservations stay frozen open — visible via `openReservations`
and the quota view, freed only by the halt-settlement path. A park
whose execution is still non-terminal likewise leaves its reservation
open (the fence decides per reservation at park time).

**Totals are derived.** `derivedDayTotals(day)` =
dispatch-row count for the day (dispatched) + Σ over the day's OPEN
reservations of (slots_total − slots_consumed) (reserved); consumed =
dispatched + reserved. The one stored counter, `slots_consumed`, is
verified against its derived count at every consumption and in
`reconcileQuota`; drift refuses loudly. There is no summary cache.

**Bootstrap (§3).** `bootstrapQuota` runs in one transaction: ensures
the schema, backfills historic attempts — `dispatching` rows are
assigned their `updated_at` PT day exactly (updated_at *is* the
dispatch moment for that phase); `confirmed` rows whose
[created_at, updated_at] PT-day interval is a single day are assigned
that day exactly; straddling intervals are **exceptions**, never
guessed — and writes matching dispatch-ledger rows for every
assignable attempt (otherwise derived totals would undercount
history). It then writes the arming marker. It is idempotent.
Exceptions are derived state (phase dispatching/confirmed with a NULL
day stamp — after bootstrap, every genuine dispatch stamps the column
atomically, so NULL always means pre-bootstrap history or a
floor-build dispatch during a rollback window). If any exception's
interval includes the current PT day, the day starts **refused**:
grants and dispatches both fail with
`provider_attempt_budget_bootstrap_incomplete` until an operator
disposition (`disposeBootstrapException`, requiring a non-blank
authorization reference) assigns the day and records itself on the
attempt row. **Disposition counter realignment** (a mechanism detail
that testing forced into the open, documented here rather than
hidden): when the dispositioned dispatch belongs to an existing
reservation (same grant+occurrence+day) — precisely the
floor-dispatched-during-rollback case — the disposition realigns that
reservation's `slots_consumed` to its derived count inside the same
auditable transaction and records `{ from, to }` on the disposition.
That dispatch really did consume one of the reservation's slots;
without the realignment the reservation would refuse
`counter_drift` forever and §3.3.4 reconciliation could never go
green. It is a recorded reconciliation under an operator
authorization, never a silent reset. `reconcileQuota` reports slots
drift, over-consumption, dispatch-row/attempt mismatches in both
directions, exceptions, current-day blockage, and derived totals;
stored day keys are never rewritten by clock movement, re-bootstrap,
or rollback.

**Labeling (§4 / invariant 5).** `PROVIDER_ATTEMPT_DAILY_LIMIT = 100`
is a pinned constant in `gen-constants.mjs`, commented as an
app-selected Reader policy cap, **not** a verified Google limit, and
not a client-editable setting. `quotaView` (armed stores only) adds
`providerDispatchesToday`, `providerReservedToday`,
`providerAttemptDailyLimit`, `providerBasis` ("Reader D6 provider
requests today, app-counted"), and `providerLimitProvenance`
alongside — never merged with — the existing grant figure
`attemptsToday`. Service stop mapping: `provider_attempt_budget` and
`provider_attempt_budget_bootstrap_incomplete` grant refusals park the
plan as `parked_quota` with the reason preserved.

## 3. Rowan's six acceptance invariants — where each is met

1. **Authorized/potential dispatch, not proof of arrival.** The
   dispatch row is written in the markDispatching transaction,
   immediately before the provider call; a crash after that commit
   but before the fetch counts conservatively and permanently. The
   crash-window failure-injection test (quota-executor) proves: zero
   provider calls, dispatch row stands, slot stays consumed,
   execution lands in `reconcile_hold`, reservation stays open. No
   text in this report (or the code) claims a dispatch row proves
   the provider received the call; the unknown-charge distinction is
   preserved (the attempt is never confirmed or released by the
   crash path).
2. **One atomic transaction.** §2 "Dispatch" above; implemented in
   `genstore.mjs` (`coord._tx` around the base transition guard +
   `applyDispatchQuota`) and `quota-budget.mjs`. Cross-day
   re-reservation is created inside the same transaction. Failure
   legs in T2, the counter-drift test, the T6 store leg, and T4 all
   assert the rollback is whole (attempt still `reserved`, no row,
   no slot).
3. **Conservative stop on ALL dispatch paths; closure impossible
   while dispatch is reachable.** Every dispatch — first pass,
   split leaves, repair retries, recovery resumes — funnels through
   the single `wrappedSynthesize` → `markDispatching` path (grep-
   verified sole caller). The closure fence is asserted in tests,
   not prose: the closure-fence test (dispatch-capable blocks,
   unknown blocks, halt_settled gating, post-synthesis does not
   block), the T5 transport-unknown leg (frozen open), the T4 park
   leg, and both recovery legs (resume binds the original
   reservation; a closed reservation fails the resume closed with
   zero provider calls).
4. **Bootstrap exactness + refusal on current-day ambiguity; no
   silent resets.** T3 (both legs), T8 (rollback window: floor
   writes leave the ledgers byte-identical; a floor dispatch is
   *detected* as an exception and blocks the day until disposition;
   totals then reproduce exactly; bootstrap re-runs and clock swings
   change nothing), plus the crash-window test. Unique historic
   attempt IDs are counted exactly once because the ledger is keyed
   by `attempt_id` and bootstrap is idempotent (asserted).
5. **Pinned constant, honestly labeled.** §2 "Labeling"; the
   labeling test asserts the constant is 100, the view exposes it
   with the app-selected provenance string, and grants vs dispatches
   are distinct fields.
6. **Reports distinguish guard success from provider-limit
   verification.** §5 below, and the header of
   `tests/quota-executor.test.mjs`, state this explicitly.

## 4. Test inventory (23 new tests, all passing)

`tests/quota-budget.test.mjs` (13) — store/coordinator level:
- ptDayKey ≡ coordinator `dayKeyPT` across 1,200 instants incl. DST
  boundaries; pinned PDT midnight facts.
- Unarmed store: no quota tables, no reservations, legacy dispatch
  (floor equivalence).
- **T1** parallel grants: one passes, the other refuses
  `provider_attempt_budget` with no partial rows; derived totals
  equal the ledgers; grant replay creates no second reservation.
- **T2** duplicate/out-of-order `markDispatching`: duplicate throws,
  confirm-before-dispatch throws, dispatch-after-release throws;
  exactly one dispatch row and one slot throughout.
- Counter-drift refusal (corrupted `slots_consumed` →
  `provider_attempt_budget_counter_drift`, nothing consumed,
  `reconcileQuota` reports the drift).
- Closure fence assertions (invariant 3) incl. `halt_settled`
  gating on open unknowns and the recorded disposition of an
  unknown attempt.
- Recovery with a closed reservation fails closed at dispatch
  (`provider_attempt_budget_unreserved`).
- **T3** bootstrap, past-day leg: intra-day and dispatching rows
  assigned exactly; a past-day straddler is a reported exception
  and does not block; reserved rows stay NULL; idempotence.
- **T3** bootstrap, current-day leg: a straddle whose interval
  includes today refuses grants *and* dispatches until an
  authorized disposition unblocks the day.
- **T7** orphans: void closes exactly once (`grant_voided`), second
  void/settle are no-ops; an aborted-after-grant reservation stays
  open and is enumerated by identity; a crash between grant and
  dispatch preserves the reservation and its accounting.
- **T8** rollback/re-arm (see invariant 4 above), incl. the
  disposition's recorded `slotsReconciled` realignment and the
  reserved→dispatched conversion arithmetic.
- **T6** store leg: cross-day re-reservation is atomic and reused
  by a second dispatch; the day-D row is untouched and still
  counted; a full day D+1 refuses with
  `provider_attempt_budget_day_rollover` and the attempt stays
  `reserved`.
- Labeling: `quotaView` distinguishes grants (1) from dispatches
  (2); unarmed view is floor-identical.

`tests/quota-executor.test.mjs` (10) — executor level, fake
bucket/providers, zero real calls:
- **T5** success / policy_block / failed_known (HTTP 500) /
  provider 429 / transport-unknown: each counts exactly one
  dispatch once dispatch began; success settles `grant_settled`
  and stays counted; 429 closes `quota_park` at the park;
  transport-unknown leaves the reservation frozen open with no
  park recorded. (Released-without-dispatch counting zero is
  asserted in T2 and in T4's refused leaf.)
- **T4** exhaustion mid-split across midnight: whole + left half
  dispatch on day D; the clock crosses midnight inside the second
  provider call and a filler grant reserves 96 of day D+1; the
  right leaf's re-reservation check (0 + 96 + 10 > 100) refuses
  `provider_attempt_budget_day_rollover`; the provider saw exactly
  2 calls; earlier attempts keep confirmed outcomes; the refused
  attempt is released; the park's evidence carries the app-side
  refusal (no fabricated 429); the day-D reservation closes
  `quota_park` with its remainder freed exactly once.
- **T6** executor leg: grant on day D, first delivery on day D+1 —
  dispatch stamped D+1 via a second reservation row; the day-D
  row's `slots_consumed` stays 0.
- Crash-window failure injection (invariant 4): a store wrapper
  throws after the real `markDispatching` commits; zero provider
  calls; the dispatch counts; restart + `recoveryScan` →
  `reconcile_hold`.
- Recovery legs: a pre-created `granted` execution resumes under
  its original reservation (no new row); with the reservation
  force-closed, the resume fails closed (quota outcome, attempt
  released, zero provider calls).

All deterministic: harness-injected clock, in-memory SQLite with
the tree's throwing-`.one()` harness semantics, fake R2 bucket and
fake providers. Existing suites were not modified.

## 5. Battery (full run on the exact final tree)

Runner: the remediation battery's pattern — per-file
`node --test --test-timeout=120000` over `tests/*.test.mjs`
(`~/workspace/ch2-program/quota-build/run-battery.sh`). Complete log:
`logs/full-battery.log` (per-suite sections with exit codes);
per-file logs in `logs/per-file/`; the wrapper's own completion in
`logs/battery-exit-code.txt` (`RUNNER_EXIT=0` — the wrapper
completed; it is not a claim that all suites passed).

| | Baseline (remediation battery) | This build | Delta |
|---|---|---|---|
| Suites | 130 (108 pass / 22 fail) | 132 (110 pass / 22 fail) | +2 suites, both new, both passing |
| Tests | 1,047 (1,025 pass / 22 fail) | 1,070 (1,048 pass / 22 fail) | +23 tests, all new, all passing |

**Failing-suite set: verified identical to baseline,
programmatically.** `logs/failing-files.txt` (this run) was diffed
against the baseline failing list
(`~/workspace/ch2-program/disposition/logs/final/failing-files.txt`)
after normalizing the baseline's `.test.mjs` suffixes: 22 names,
name-for-name equal, zero additions, zero removals — no regression,
and no baseline failure was masked or fixed incidentally. The 22
failures are the pre-existing set (they fail on the base tree for
reasons unrelated to this build, e.g. missing app-bundle fixtures),
unchanged by the quota work.

## 6. Honest limitations

- **These tests are NOT provider-limit verification.** They prove
  the guard's accounting and refusal behavior against fake
  providers. The daily cap (100) is an app-selected Reader policy
  constant, not a measured or verified Google limit; nothing here
  establishes what Google actually enforces for the project.
- **Outside-Reader traffic is invisible to the counter.** The
  counter sees only dispatches made through Reader's D6 executor.
  Any other client of the same Google Cloud project consumes real
  provider quota this guard cannot observe; the day's true headroom
  can therefore be smaller than the guard's accounting suggests.
- **Bootstrap is store-level only.** `bootstrapQuota`,
  `disposeBootstrapException`, and `reconcileQuota` are operator
  functions in `quota-budget.mjs`; no HTTP route or service wrapper
  was added. Wiring an operator route (and the deploy-time bootstrap
  step itself) is a separate gate, not part of this build.
- **The floor build does not enforce the quota.** Rollback safety
  continues to rest on the halt + pause holds, unchanged. A dispatch
  made by the floor build during a rollback window is not prevented
  by this code — it is *detected* on re-arm as a bootstrap exception
  and blocks its day until dispositioned (T8), which is detection
  and accounting, not prevention.
- **`grant_voided` is an extension** to the addendum's close-reason
  vocabulary (§1.5 names `grant_settled`, `quota_park`,
  `halt_settled`), added for the coordinator's void path because
  reusing `grant_settled` for a voided grant would misrecord
  history. It closes strictly fewer reservations than a looser
  reading would (the fence still applies; live claims refuse the
  void upstream), and it is called out here for Rowan's review
  rather than folded in silently.
- **Disposition counter realignment** (§2) adjusts a stored counter
  in exactly one place — inside the authorized disposition
  transaction, recorded on the disposition record. Everywhere else,
  a stored/derived mismatch refuses (`counter_drift`) instead of
  self-healing.
- **Harness ≠ production Durable Object.** The suite runs on the
  tree's node:sqlite harness, which mimics the real DO `.one()`
  throw-on-empty semantics, but harness-green is not a production
  smoke; the deploy gate still needs its own real-DO verification
  steps, as with every prior package.
- **Unarmed after deploy is the default.** Shipping this code
  changes no production behavior until an operator runs the
  bootstrap; the bootstrap itself, its day-1 exception handling,
  and any disposition of real history are operational decisions for
  the deploy proposal, not this build.

## 7. Conclusions

- **CONFIRMED:** The quota guard is implemented as designed
  (proposal + addendum), in the change surface of §1 and nowhere
  else; all 23 new tests pass; existing behavior on unarmed stores
  is unchanged (the suites that exercise the touched files —
  d6-genstore, d6-grant-guards, coordinator-grants, d6-executor-fi,
  remediation-cache-refresh, d6-correction, d6-integration — all
  pass unmodified, and the full battery is §5).
- **CONFIRMED:** Every Rowan acceptance invariant has a named code
  location and at least one asserting test (§3, §4).
- **INFERRED:** The disposition counter-realignment and the
  `grant_voided` reason are consistent with the addendum's intent
  (auditable accounting; §3.3.4 reconciliation must be able to go
  green) — both are flagged for Rowan's source review as the two
  judgment calls in this build.
- **OPEN:** Deploy sequencing (halted/paused pattern, bootstrap
  timing, operator route for bootstrap/disposition/reconcile,
  real-DO smoke) — for the deploy proposal and Julie's separate
  approval. Nothing in this build authorizes or performs any of it.
