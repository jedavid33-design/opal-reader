# P8 Part 2 — Finding F1 fix addendum (decisions record)

*Implements Rowan's F1 ruling (board 6349288135; Wren's acceptance +
attribution correction 6349342416) on branch `v2/p8-integration`,
based at the B7/preflight pin `f9c05cae`. Repo-only: nothing was
uploaded; the live `opalreader-api-v2` script is untouched. The
corrected artifact replaces it only under Julie's fresh, separate
upload authorization.*

## The defect (confirmed analysis)

Cloudflare's SQLite-backed Durable Object cursor `.one()` throws on
zero rows and on more than one row. The coordinator's `_one()` helper
delegates to it, and dozens of its call sites are deliberately
optional lookups whose `if (!row)` fallbacks therefore never ran in
production — while the Node test harness's fake cursor returned
`null` on zero rows and silently the first row on >1, so 563 green
tests hid the defect completely. Proven live in the Part 2 smoke: a
brand-new instance's first `GET /v2/settings` and its first
`SetSettings` both returned 500 `Expected exactly one result from
SQL query, but got no results.` Per Rowan's refinement, the 500 body
does not locate the precise throwing call: `handleCommand` reads the
commands table through `_one` before `wake()`/`_frozen()`/
`_setSettings()`, so a first-ever command is explained at that first
lookup; the settings read/write and many other lookups carry the
same independent defect.

## What changed

1. **Harness contract** (`tests/helpers/do-harness.mjs`): the fake
   cursor is now an explicit `SqlCursor` whose `.one()` emulates
   Cloudflare exactly — throws `…but got no results.` on zero rows
   and `…but got multiple results.` on >1; `.toArray()` unchanged.
   The DDL-batch return uses the same cursor (its `.one()` on an
   empty result throws, as production's would).
2. **Coordinator optional-row operation** (`v2/coordinator.mjs`):
   `_oneOrNull(q, ...params)` implemented over
   `cursor.toArray()` with an explicit cardinality check —
   0 rows → `null`, 1 row → the row, >1 rows → throw
   (`Expected at most one result…`). No `.one()` exceptions are
   caught anywhere, and no site silently takes `rows[0]`.
3. **Call-site audit** (below): every `_one` call site in the
   coordinator was classified. 59 sites converted to `_oneOrNull`
   (absence is a legitimate, expected state and the code already
   branches on it); 16 sites stayed strict `_one` (scalar aggregates,
   which return exactly one row by construction, and re-reads of rows
   a live invariant in the same flow guarantees). No other module
   used the helper (`grep` over `v2/`: only `coordinator.mjs`).
4. **Regression tests** (`tests/p8-part2-f1-fix.test.mjs`, 7 tests):
   harness 0/1/2-row contract; fresh-instance direct-API defaults and
   intended not-found states; first-SetSettings lifecycle (applies at
   revision 1, replay-once, read-back, stale-baseRevision conflict);
   cardinality discipline for both helpers; and the same sequence
   through the worker entry → DO transport in the §5 smoke order,
   including missing `meta.frozen` not being a 500.

**Ambiguities:** none required a guess. Every call site either
already null-checks its result (optional — converted) or is a scalar
aggregate / invariant-guaranteed re-read (strict — unchanged). No
site was found whose semantics are genuinely unclear.

## Audit table

Line numbers are the PINNED file (`f9c05cae`) Rowan reviewed.
"Converted" = now `_oneOrNull`; "Strict" = remains `_one`.

### Converted (59) — absence is legitimate and already branched on

| Pinned line | Site | Reason |
|---|---|---|
| 271 | `_frozen()` meta lookup | a fresh instance has no `frozen` row: not frozen |
| 281 | `applyJobEvent` job lookup | returns `job_not_found` |
| 302 | `applyOccEvent` occurrence lookup | returns `occurrence_not_found` |
| 327 | `handleCommand` command-log lookup | a first-ever command has no row — the F1 first throw |
| 392 | `_submitJob` duplicate check | absence is the apply path |
| 410 | `_resume` job lookup | returns `job_not_found` |
| 443 | `_requestSynthesis` binding lookup | `if (b)` cached-answer branch |
| 451 | `_requestSynthesis` in-flight join lookup (LIMIT 1) | `if (dupe && …)` branches |
| 484 | `_issueGrant` job lookup | returns `job_not_found` |
| 486 | `_issueGrant` open-park lookup (LIMIT 1) | `if (park && !bypassPark)` |
| 505 | `_issueGrant` grant-dupe check | absence is the apply path |
| 560 | `_scheduleReAdvance` job lookup | `if (!job \|\| …) return` |
| 603 | `drainOutbox` job lookup | null-checked downstream (`!grant` debris path uses the same pattern) |
| 605 | `drainOutbox` grant lookup | `!grant` is an handled debris state |
| 660 | `drainOutbox` settled-grant re-read | `settled && …` guarded |
| 737 | `_voidDispatch` claim-fence lookup | `if (claim && claimed)` |
| 751 | `_voidDispatch` release-exists check | `if (!…)` insert-if-absent |
| 763 | `_voidDispatch` occurrence lookup | `if (o && granted)` |
| 785 | `noteProviderRequest` ledger-op lookup | returns `op_not_found` |
| 803 | `noteProviderOutcome` ledger-op lookup | returns `op_not_found` |
| 820 | `handleReport` grant lookup | returns `grant_not_found` |
| 833 | `handleReport` job lookup | returns `job_not_found` |
| 900 | `handleReport` grant-closed occurrence loop | `if (o && granted)` |
| 921 | `handleReport` follow-on job re-read | `if (jobRow && …)` guarded |
| 986 | `validateAndBind` cache-index lookup | `(idx && idx.sha256)` guarded |
| 997 | `validateAndBind` existing-binding lookup | `existing && …` branches |
| 1031 | `reconcileUnknown` occurrence lookup | returns `not_unknown` |
| 1062 | `reconcileUnknown` latest unknown-transition (LIMIT 1) | ternary on presence |
| 1069 | `reconcileUnknown` source-grant lookup | ternary + `sourceGrant && …` |
| 1071 | `reconcileUnknown` attempt-row lookup | `if (spend)` guarded |
| 1094 | `_resolveUnknown` occurrence lookup | returns `not_unknown` |
| 1124 | `_deriveJobCompletion` job re-read | `job ? … : null` guarded |
| 1142 | `_settings()` settings row | returns defaults — core F1 site |
| 1148 | `_setSettings()` settings row | `cur ? … : 0` — core F1 site |
| 1271 | `alarm` lease-case grant lookup | `if (!grant \|\| …) break` |
| 1280 | `alarm` lease-case outbox lookup | `if (!outRow \|\| …)` branches |
| 1353 | `alarm` retry-case job lookup | `if (job && …)` guarded |
| 1376 | `alarm` handoff-case grant pre-read | `if (!before \|\| …) break` |
| 1398 | `alarm` handoff-case grant re-read (in tx) | `if (!grant \|\| …)` stale-verdict path |
| 1399 | `alarm` handoff-case outbox re-read (in tx) | same condition |
| 1431 | `alarm` handoff claim-fence lookup | `if (claim && claimed)` |
| 1472 | `receipt()` command lookup | returns `null` → API 404 |
| 1480 | `jobView()` job lookup | returns `null` → API 404 |
| 1500 | `quotaView()` open-park lookup (LIMIT 1) | `park ? … : null` |
| 1537 | `claimGrant` grant lookup | returns `unknown_grant` |
| 1539 | `claimGrant` existing-claim lookup | `if (existing)` branches |
| 1570 | `probeVerdict` claim lookup | absence IS the `unknown` verdict |
| 1584 | `closeAcceptance` existing-claim lookup | `if (existing)` branches |
| 1589 | `closeAcceptance` grant lookup | returns `unknown_grant` |
| 1617 | `_latestIntent()` (LIMIT 1) | every caller null-checks |
| 1623 | `_latestBatchMap()` (LIMIT 1) | every caller null-checks |
| 1633 | `acquireSpendIntent` claim lookup | returns `not_claimed` |
| 1767 | `resolveBatchNeverAccepted` grant lookup | `if (grant && …)` guarded |
| 1782 | `claimView()` | `… \|\| null` by contract |
| 1812 | `_familyState()` family row | lazy-init branch on absence |
| 1851 | `_syncEntity()` | every caller null-checks |
| 2074 | `_appendPositionEvent` prior-event lookup | `if (prior)` replay/conflict branch |
| 2081 | `_appendPositionEvent` position-state lookup | `… \|\| {defaults}` |
| 2126 | `positionView()` state lookup | returns null-canonical view |

### Strict (16) — unchanged `_one`

| Pinned line | Site | Reason |
|---|---|---|
| 238 | constructor sync-family seed aggregate (MAX/MIN) | scalar aggregate: exactly one row by construction |
| 427 | `_resume` settled re-read | job proven to exist at line 410 in the same command flow; derivation never deletes jobs |
| 435 | `_resume` post-resume re-read | same invariant |
| 535 | `_issueGrant` post-transition revision re-read | job transitioned inside this same transaction |
| 562 | `_scheduleReAdvance` pending-retry COUNT | aggregate |
| 700 | `_attemptsOn` net-count expression | aggregate |
| 706 | `_spendIn` COALESCE(SUM) | aggregate |
| 926 | `handleReport` follow-on COUNT | aggregate |
| 1113 | `_deriveJobCompletion` occurrence counts (SUM/COUNT) | aggregate |
| 1186 | `_armAlarm` MIN(due_at) | aggregate |
| 1197 | `wake()` watchdog COUNT | aggregate |
| 1209 | `_armAlarmIfEarlier` MIN(due_at) | aggregate |
| 1244 | `alarm()` finally watchdog COUNT | aggregate |
| 1502 | `quotaView()` MAX(rowid) ledger sequence | aggregate |
| 1815 | `_familyState()` lazy-init aggregate (MAX/MIN) | aggregate |
| 2202 | `sweepDryRun` live-jobs COUNT | aggregate |

## Demonstration (pre-fix failure, corrected harness)

The new tests were run against the pre-fix coordinator with the
corrected harness: **6 of 7 fail** (only the harness-contract test
passes — it tests the harness alone); failures carry the production
error (`Expected exactly one result from SQL query, but got no
results.`, e.g. thrown at pinned `coordinator.mjs:327` from
`handleCommand`, exactly Rowan's predicted first site) and, for the
cardinality test, the absence of `_oneOrNull` itself.

Interplay, recorded precisely: harness correction ALONE (old
coordinator, whole suite) turns the suite red — 149 of the 563
pre-existing tests fail individually (409 pass / 155 fail of 564
counted; the envelope test file additionally fails at load in that
demonstration copy because its top-level builder invocation refuses
the copy's dirty worktree — a cleanliness guard, unrelated to cursor
semantics). The coordinator fix is what makes them pass again: with
both halves applied, the full suite is green (see the fix report
for counts). No pre-existing test's intent was changed; no test was
adapted to the faithful harness — the production code was wrong,
not the tests.

## Boundaries for the resumed smoke (Rowan's instruction, carried)

On the future re-smoke under Julie's fresh upload authorization:
read back `smoke-p8`'s existing partial state first (no settings or
command effects landed in the stopped run), reuse only if clean with
all effects recorded, then restart S8 from the beginning with
stop-on-first-failure. The staging token is preserved on the script
via the `inherit` secret mechanism at upload time — never copied or
logged. D10 / migrated-text / never-accepted-Batch production
blockers and the seven manual-review ledger findings remain open
and untouched by this fix.
