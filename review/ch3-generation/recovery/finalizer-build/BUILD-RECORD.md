# GATE 2 BUILD RECORD — Option A operator-only grant finalizer

Repo-only build under Julie's Gate 2 GO (board comment 6551447689,
Oct 31, 2026). Design authority: `RECOVERY-PROPOSAL-DRAFT.md` §4
(Option A) + §9 (test plan), reviewed by Rowan (board 6551435961:
diagnosis PASS, design CONDITIONAL PASS with six acceptance
checks). **No deploy, no production contact, no pins, no board
posts in this build.** The parent pins and files.

Build tree: `~/workspace/ch2-program/ch3-recovery/finalizer-build/worker-build/`,
copied from `~/workspace/ch2-program/ch3-build/worker-build/` (the
tree live build `63d7260e` was assembled from; `diff -rq` against
the source at copy time: 0 differences; the `v2/` symlink to
`worker/` preserved — one file, two paths, not double-counted).

## 1. Diff surface (exact)

Production code — 2 files:

| File | Change | Lines |
|---|---|---|
| `worker/generation/grant-finalizer.mjs` | NEW module: derivation, preview, finalize, lazy audit-table DDL | 830 |
| `worker/worker-entry-prod-d6.js` | import + 2 public route predicates + fence-list membership (×2 lists) + 2 public forwards + 2 class-gate handlers | +122 / −2 (the 2 deletions are the fence-list lines extended in place) |

Tests — 4 files, all new:

| File | Tests | Content |
|---|---|---|
| `tests/grant-finalizer.test.mjs` | 32 | Fixture S store-level: exact finalization, replay, 18 named precondition refusals, atomicity, empty store |
| `tests/grant-finalizer-routes.test.mjs` | 7 | Both routes through the real entry + class: fence denials, spoofing, closed-body matrix, happy path |
| `tests/grant-finalizer-continuation.test.mjs` | 2 | Fixture E: organic stall reproduction → finalizer → multi-cohort continuation; fresh-day sizing |
| `tests/helpers/grant-finalizer-fixture.mjs` | — | Shared Fixture S seeder (565 lines; exact live shapes incl. the 44 real attempt rows) |

`worker/generation/gen-schema.mjs` is **byte-identical** to the
source tree (verified with `cmp`): the audit table is NOT a
genesis table — `d6_grant_finalizations` bootstraps lazily,
DDL-only and idempotent, inside the new module (the
park-release/quarantine/dispatches pattern). No other production
file changed.

Public routes added (operator fence class, no halt fence):
`GET /v2/d6-grant-finalization-preview`,
`POST /v2/d6-finalize-grant`; class routes
`/internal/d6/grant-finalization-preview`,
`/internal/d6/finalize-grant`.

## 2. Design decisions, mapped to the proposal (§4) and Rowan's six checks

**One derivation, two surfaces (§4.2/§4.3).**
`deriveGrantFinalizationState` re-derives every fact server-side
from durable records; preview and action share it. The action
derives **inside** its single transaction, so the state it proves
is the state it acts on. The request body is the closed allowlist
`{ grantId, planId, jobId, authorizationRef,
expectedPreconditionDigest }` — there is deliberately **no
results array**: the caller can never supply outcomes. The digest
(canonical JSON, sorted keys recursively, SHA-256) is a
concurrency check only; any post-preview movement either trips a
named precondition refusal on re-derivation or refuses
`grant_finalization_digest_mismatch`, zero writes either way.

**Check 1 — one transaction, atomic, fail-closed.** The action's
writes run in one `coord._tx`: (1) audit INSERT into
`d6_grant_finalizations` (grant_id PRIMARY KEY — a duplicate is
impossible, and an INSERT fault aborts everything); (2) the
fail-safe re-assertion that zero targets are `granted` (the
proposal §4.4 note's branch (b): the generic closure's defer step
is a *proved* no-op here, asserted rather than silently reused);
(3) `grants → 'reported'` with a **labeled** report_json
(`{ grantId, results: [], detail: { finalization:
"operator_grant_finalization", authorizationRef,
preconditionDigest } }` — never an impersonated executor report);
(4) `_completeClaim`, verified by read-back; (5)
`settleReservationsForGrant` with its result **required** to be
exactly the expected reservation ids in `closed` and an empty
`blocked` list — stricter than `handleReport`, which ignores the
return; (6) `_deriveJobCompletion(jobId,
"operator_finalization")`, verified to leave the job
`generating` at the same revision. Post-write, still inside the
transaction, the state must re-derive as exactly
`already_finalized` with phase settled money and attempt/dispatch
counts unchanged; any divergence throws a `FinalizeAbort` and
rolls the whole transaction back. Tests: "finalize applies
exactly the §4.4 writes, atomically"; "atomicity: a settlement
block aborts the whole transaction" (a shadow dispatch-capable
execution makes the settle sweep block *after* derivation passed
— grant, claim, reservations, and audit all provably unchanged);
"atomicity: an audit-write fault rolls back and throws (never
laundered)".

**Check 2 — exact live values, every closed row read back.**
Fixture S carries the production identities and values verbatim
(plan `plan:e377a5559961b294154276b6`; grant
`grant:plan:e377a5559961b294154276b6:ch2:1:full` issued rev 2; the
eight committed executions with their real attempt ids, outcomes,
and costs — 44 confirmed attempts, pattern 4/6/6/6/6/6/4/6 in
chapter order, summing to 152,964; the eight reservation ids
`qres:<grant>:<occurrence>:2026-10-31` with slots_total 12,
consumption equal to attempt counts, residual 52; phase settled
732,303 including the adjudicated straddler's 19,018/5,648 pair;
watermarks 1826/18; releaseId 1). The derivation proves the
reservation set from the ledger/outbox/executions/reservations
agreement — it does not hard-code 44/52/8; those numbers are
asserted by the fixture tests. The happy-path test reads back
**each** of the eight closed reservation rows individually
(state `closed`, reason `grant_settled`, day `2026-10-31`), the
claim, the grant's report_json, the day totals (44/52/96 →
44/0/44), and phase money unchanged. No ledger, binding,
occurrence, or phase-money row is written (snapshot comparisons).

*One correction the executor-world tests forced:* §4.3.23's
binding proof matches on **cache_key only**. D6 commits bind
under the payload fingerprint as revision key (the
d6-integration identity rule), not under the job row's
`fp-<id>` request revision key; an early draft of the check
keyed the binding lookup by the occurrence's revision_key and
the Fixture E world correctly refused it. Fixture S's seeded
bindings were corrected to the same production truth
(revision_key == cache_key == fingerprint). **Rowan: worth a
look — Gate 3's census should confirm the eight production
bindings carry revision_key == cache_key.**

**Check 3 — operator fence on both surfaces, both layers.**
Both routes join the shipped operator-alone fence class exactly
as the park-release/quota routes do: the public gate skips the
client token for them, the admission block requires the
dedicated migration-operator credential (503 when unconfigured
or aliased to the access token), and the class gate re-checks
the unforgeable `x-opalreader-operator-admitted` stamp (publicly
forged stamps and direct class calls without it refuse 403
`migration_operator_required`). Neither route is halt-fenced
(finalization is bookkeeping: no provider call, no submission,
no wake — the happy-path route test asserts the queue is never
touched). The identity binding (grant/plan/job/book/chapter) is
derived from the grant and cross-checked against any
caller-supplied plan/job ids; the authorization reference is a
required closed-body field and lands in the audit row. Preview
is read-only to the point of not bootstrapping the audit table's
DDL. Route tests prove: no-credential, client-token-alone, and
wrong-operator denials with zero writes; scope/instance refusal;
spoof matrix; the closed-body matrix (including a
caller-supplied `results` array refused **by shape**).

**Check 4 — replay is audit-bound and byte-stable.** Replay
classification is by state recognition, never repeated effects:
`reported` + audit row + claim `completed` + every reservation
`closed`/`grant_settled` → `already_finalized` (zero writes,
byte-identical repeat responses); `reported` **without** an
audit row → `already_reported_not_finalizer` (a real executor
report landed; the still-open reservations are NOT silently
settled); `reported` + audit row + anything else divergent
(e.g., a reopened reservation) → refusal
`grant_finalization_reported_inconsistent`. An audit row beside
an `issued` grant refuses `grant_finalization_audit_mismatch`.
All four cases are tested with zero-write snapshots.

**Check 5 — production-faithful semantics + the required
battery.** All absence-legitimate reads use `_oneOrNull`/`_all`
or throw-safe safe-read helpers for the lazy tables (only
`/no such table/` is caught — the D1/D8-1 discipline); `_one()`
is used only for SQLite-guaranteed aggregate rows. The battery
includes: the live-shaped lost-report fixture (Fixture S) AND an
**organic** reproduction (Fixture E: real service driveOnce →
real coordinator grant → real D6 executor, exactly one
`handleReport` swallowed — commits land, the closure never
does); redelivery of the stalled message (zero provider calls,
no report, nothing moves); driver refusal while the grant reads
`issued`; stale-state cases (claim completed between preview and
action → re-derivation refusal; watermark moved → digest
mismatch); interruption/atomicity cases (above); the full
negative/no-write refusal battery (18 named precondition
refusals, each with a byte-identical snapshot); same-day cohort
sizing (after finalization, cohort 2 = **7**) and fresh-day
sizing (cohort = **8**); and multi-cohort continuation — cohorts
[7, 7, 1] drive the SAME plan/job to completion (23 provider
calls, plan + job complete, the excluded final segment never
executed). Full regression results in §3 below. Anchors stay
green inside the full battery: quota-corrections (8/7/3),
quota-rereview (101-occurrence rollover),
coordinator-recovery (report-throw rollback), quota-budget
settlement idempotency, ch3-park-release, ch3-park-routes,
d6-integration.

**Check 6 — Gate 3 surface.** The preview exposes everything
Gate 3's census (§8.1 of the proposal) must re-derive for this
grant: identity + states + revisions (grant/job/plan), plan
totals, claim state, outbox ack + target set, per-target
execution ids/states, per-target attempt counts by outcome,
per-reservation id/day/slots/consumption, partition + pending
ids, derived day totals, phase accounting (settled, in-flight
upper, unknownOpen, estimated/reserved unverified), sync
watermarks, park-release id/state/coverage, exemption presence,
and (on replay) the audit row. **Not** in the preview, by design:
the conflicts count (served by the existing `/v2/conflicts`
surface), GENERATION_HALT (the `/health` surface), and queue
pause state (not readable by the Worker at all — cf-api
read-back is the established proof). Nothing Gate 3 needs is
missing from the union of existing surfaces.

## 3. Battery results (baseline vs new tree)

One complete run on the exact final tree:
`node --test --test-timeout=120000 tests/*.test.mjs`, full log at
`finalizer-build/logs/full-battery.log`, `RUNNER_EXIT=1` (the
runner exits 1 whenever any test fails; the 22 baseline file
failures drive it — the baseline's recorded exit 0 came from its
per-file aggregation script, not the raw runner).

| | Baseline (ch3-build tree) | New tree (finalizer) |
|---|---|---|
| Tests | 1,131 as logged; **1,136 like-for-like** (note 2) | 1,177 |
| Pass | 1,109 as logged; **1,114 like-for-like** | 1,155 |
| Fail | 22 | 22 |
| Failing files | 22 (list below) | **verbatim identical 22** |
| Individual failing tests beyond file-level | 0 | 0 |

New suites: 41/41 pass (32 store + 7 routes + 2 continuation) —
exactly the like-for-like delta (1,136 + 41 = 1,177).

The 22 failing files (whole-file failures at 1:1, identical in
both runs): adaptive-background-repair, audio-chunk-playback,
chapter-quota-banner, continue-preparation-progress,
continue-setup-recovery, continue-to-quota,
cross-device-chapter-handoff, dormant-playback-start,
first-chapter-segment-joining, gemini-400-hydration,
gemini-batch-lane, gemini-quota-diagnostics,
generation-manual-queue-reuse, generation-playback-concurrency,
generation-session-sync-guard, p8-d3-prod-envelope,
p8-upload-envelope, playback-bookmarks, restore-sound-rewind,
silent-audio-recovery, split-first-update-stop,
sync-diagnostics. No baseline failure was relabeled; no new
failure was introduced.

Two run notes, stated plainly:
1. **First full run** (`logs/full-battery-run1-depth-artifact.log`):
   29 fails — the 22 baseline plus d6-eligible-set,
   d6-parked-inertness, d6-proofs. Cause: NOT the code. Those
   suites read the real census data via a relative path
   (`../../../../opal-reader-p8-data`) that resolves one level
   short from this build tree's extra depth
   (`ch3-recovery/finalizer-build/`), hitting ENOENT at load.
   With the path resolvable (a symlink at
   `~/workspace/ch2-program/ch3-recovery/opal-reader-p8-data` →
   `~/workspace/opal-reader-p8-data`, outside the build tree),
   all 14 of their tests pass, and the re-run above is the clean
   record. At pin/review time the tree sits at the canonical
   depth where the path resolves unaided, as it did for every
   prior build in this chain.
2. **Count delta, fully accounted**: the raw delta is +46
   (1,131 → 1,177) while the new suites add 41. Per-file counts
   on both trees (`logs/per-file-counts.txt`) isolate the
   residual +5 to the two Ch 3 suites: the baseline's per-file
   logs record ch3-park-release = 23 and ch3-park-routes = 9,
   but the untouched source tree itself runs 27 and 10 today —
   the baseline battery was captured before the Ch 3
   append-only-journal revision added those tests. Corrected
   like-for-like baseline: 1,136 tests / 1,114 pass / 22 fail;
   the new tree is that + exactly the 41 new tests, with the
   failing set verbatim identical.

## 4. Scope notes and open questions

- **Fully-granted jobs refuse.** The derivation requires a
  non-empty pending remainder (the stalled-cohort shape this
  recovery is for): a grant covering a whole job would move the
  job's completion derivation, which is a different case and
  refuses `grant_finalization_partition_mismatch`
  (`no_pending_remainder`). Gate 3's target grant has 15 pending,
  so this does not affect the planned use.
- **Phase-accounting / plan-totals queries are duplicated**
  inside the module (genstore.phaseAccounting / service.planStatus
  semantics) so the module imports neither the store nor the
  service — the quota-budget `segmentAttemptsUsed` precedent.
  The fixture tests pin the agreement (732,303 settled; totals
  23/8/0/0/0).
- **`failed_known` attempts** are admissible in a target's
  confirmed set (a known-cost failure is a truthful confirmed
  outcome; the live grant has none — its 44 are success +
  policy_block, asserted exactly in Fixture S).
- No deviation from the proposal's §4 shape was needed. The one
  implementation correction (§2, check 2: binding match on
  cache_key only) follows §4.3.23's own wording and the shipped
  executor's identity rule.
- Gate 2D (deploy), Gate 3 (production finalization), and Gate 4
  (resume) are untouched by this build and remain separately
  gated, as designed.
