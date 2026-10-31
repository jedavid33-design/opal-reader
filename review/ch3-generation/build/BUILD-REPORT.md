# Ch 3 build — BUILD REPORT (repo-only)

**Task.** Build both Chapter 3 mechanisms from `CH3-GENERATION-PROPOSAL-v2.md`
(§5A release, §5A.2 definition invariant, §5B exemption incl. §5B.2, §5C
one-build scope, §11 invariants) under Julie's recorded GO (board
6548743249), within Rowan's DESIGN PASS conditions (board 6548728089).

**Scope compliance.** Local source + tests only. NO production contact of
any kind. NO pin, NO board post (the parent verifies, pins, files). The base
tree was never edited: all work is in the copy at
`~/workspace/ch2-program/ch3-build/worker-build/`, copied from
`~/workspace/ch2-program/quota-routes-fix2/worker-build/` and verified
byte-identical to it before editing (805 files, per-file SHA-256).

**Diff surface (complete).** Three modified files + one new module + two new
test files; every other file in the 808-file tree is byte-identical to the
base (verified by full-tree SHA-256 comparison):

| File | Change |
|---|---|
| `worker/generation/park-release.mjs` | NEW (584 lines) — both stores + definition derivation |
| `worker/worker-entry-prod-d6.js` | 4 public routes + 4 internal handlers + fence wiring (1564 → 1844 lines) |
| `worker/generation/content-plane-adapter.mjs` | `parkedJobOf` loads the fence records (import :17; consumption :124–133) |
| `worker/generation/eligible-set.mjs` | Builder consumes `releasedIds`/`exemptIds` (:81–103 + header rules) |
| `tests/ch3-park-release.test.mjs` | NEW — 23 tests (stores, derivation, builder, adapter, service) |
| `tests/ch3-park-routes.test.mjs` | NEW — 9 tests (entry + class end to end) |

Untouched, as required: the parked FSM (`parked_policy: {}` in
coordinator.mjs), submitIntent semantics beyond the builder change, the
quota guard, grant guards, the executor, the phase guard, all client code,
and `gen-schema.mjs` (see "Schema placement" below).

---

## 1. Route / store specs as built

All four routes are in the **operator-alone fence class**, byte-for-byte the
quota-route pattern: the public gate skips the client token for these paths;
the entry's operator-admission block requires the dedicated
migration-operator credential (403 `migration_operator_required`; 503
`migration_operator_not_configured` when unset or equal to the access
token); `forward()` stamps `x-opalreader-operator-admitted`, and each
internal handler in `OpalReaderCoordinatorProd.fetch` re-checks the stamp
(403 without it). The everyday client token alone is refused.

**No halt fence** on any of the four routes — deliberate, and the inverse of
the quota bootstrap/dispose: those are pre-arming accounting acts
(halt-only), while the release/exemption are *execution-time* fence
adjustments (gate (c) has already re-armed the system), and neither act
creates a plan, job, or grant — generation still flows only through
submitIntent's builder and every downstream guard. This mirrors the
adjudicate route's reasoning. Test CH3R-2 exercises the release in BOTH
halt states.

| Public route | Internal route | Store function | Body allowlist (closed) |
|---|---|---|---|
| `POST /v2/d6-release-park` | `/internal/d6/release-park` | `releasePark` (park-release.mjs:328) | `{jobId, occurrenceIds, authorizationRef, source, note}` |
| `POST /v2/d6-revoke-park-release` | `/internal/d6/revoke-park-release` | `revokeParkRelease` (:421) | `{jobId, authorizationRef, source, note}` |
| `POST /v2/d6-exempt-chapter-occurrence` | `/internal/d6/exempt-chapter-occurrence` | `exemptChapterOccurrence` (:467) | `{jobId, occurrenceId, authorizationRef, source, note}` |
| `POST /v2/d6-revoke-chapter-exemption` | `/internal/d6/revoke-chapter-exemption` | `revokeChapterExemption` (:550) | `{jobId, occurrenceId, authorizationRef, source, note}` |

**Tombstone call shape (my specification, per the task).** Revokes are
*separate routes*, not an action field on the primary routes — this keeps
the two primary allowlists exactly as §5A/§5B.2 specify them (neither
carries an action field) and keeps every route single-purpose. Each revoke
carries its own authorizationRef/source/note audit.

**Validation split.** The internal handler enforces the closed allowlist +
required-nonblank + source/note bounds (≤2000 chars) before the store is
touched (the quota-dispose discipline); the store then re-validates
everything itself and owns all semantic fences. Domain refusals return
HTTP 200 `{outcome:"rejected", reason}`; unexpected faults throw and
surface as the class catch's HTTP 500 — never laundered into a rejection.
Responses carry the store result plus the post-write read-back view
(`release` / `exemption`), the phase-binding pattern.

**Release fences, in order, all before any write** (validate + write inside
one `coord._tx`, the bootstrapQuota shape): job exists
(`park_release_job_not_found`) → job is `parked_policy`
(`park_release_job_not_parked`) → definition derivable (§5A.2 reasons) →
set non-empty (`park_release_set_empty`), string items
(`park_release_set_invalid`), duplicate-free (`park_release_set_duplicate`)
→ every id a row of THIS job (`park_release_occurrence_not_in_job`) → every
id a `pending` row (`park_release_occurrence_not_pending`; the bound idx
0–2 are `ready`, so they can never be released) → **every id inside the
definition set (`park_release_outside_definition`)** → no id under a live
exemption (`park_release_occurrence_exempted`) → no live release with a
different set (`park_release_conflict`). Identical re-release (any input
order) = idempotent no-op success (`alreadyReleased: true`); the stored set
is normalized to definition order.

**Exemption fences, in order:** job exists / parked
(`chapter_exemption_job_not_found` / `_job_not_parked`) → definition
derivable → occurrence is a row of THIS job
(`chapter_exemption_occurrence_not_in_job`) → **occurrence outside the
definition set (`chapter_exemption_inside_definition`)** → occurrence
unbound (`chapter_exemption_occurrence_bound`) → not covered by a live
release (`chapter_exemption_occurrence_released`) → duplicate live
exemption = idempotent no-op (`alreadyExempted: true`). Revokes refuse
`park_release_not_found` / `chapter_exemption_not_found` when no row
exists for the named job (+occurrence); double-revoke is an idempotent
no-op (`alreadyRevoked: true`).

**Tables** (park-release.mjs:56 `PARK_RELEASE_SCHEMA`):
`d6_park_releases` — append-only audited rows (`release_id` AUTOINCREMENT;
job/book/chapter; `occurrence_ids_json`; authorization_ref/source/note;
released_at; `state` live|tombstoned + tombstone audit fields). At most one
LIVE row per job, enforced transactionally; a re-release after a tombstone
is a new row, so the full history survives.
`d6_chapter_exemptions` — one row per occurrence (`occurrence_id` PRIMARY
KEY, per §5B.2's stated shape; job/book/chapter; audit fields; `tombstoned`
flag + tombstone audit fields). Tombstone flips the flag; re-exemption of a
tombstoned row reactivates it under the new authorization and KEEPS the
prior tombstone audit fields on the row as the most-recent-reversal record
(the flag alone carries current state).

**Schema placement — read this, Rowan.** The proposal's §5C says the DDL
bootstrap lands "where the other d6 tables bootstrap". The tree's own
evidence splits that: `GEN_SCHEMA` (gen-schema.mjs) is pinned CLOSED at
exactly eight `d6_*` tables by the accepted correction package
(tests/d6-correction.test.mjs: "The only additions: the eight generation
tables, all empty"), while EVERY post-genesis table (quarantine holds,
provider dispatches, grant reservations, reconcile audit, billing
adjudications, binding projections) bootstraps lazily via DDL-only
idempotent `CREATE TABLE IF NOT EXISTS` inside its own module. This build
follows the post-genesis pattern: the two tables bootstrap inside
park-release.mjs (`ensureParkReleaseSchema`, :92), called by every writer
before its transaction. `gen-schema.mjs` is untouched. (If Rowan prefers
the tables inside GEN_SCHEMA, that is a one-line move — but it would break
the pinned eight-table invariant the correction package established.)

**Builder/adapter consumption.** `parkedJobOf` (content-plane-adapter.mjs)
additionally loads the parked job's live release set + live exemption set
via `liveParkFenceRecords` (park-release.mjs:202) and returns them as
`parkedJob.releasedIds` / `parkedJob.exemptIds`. Those reads are
absence-tolerant: a not-yet-created table reads as an empty set (throw-safe
helper at :105 — swallows ONLY "no such table"; genuine DB errors rethrow,
the D8-1 / quota-D1 cold-start discipline), so cold start can never surface
as an eligibility error. In `buildEligibleSet` (eligible-set.mjs:81–103):
rule 2 (`excluded_parked`) is skipped for released or exempted entries;
rule 3 (`excluded_ch3`) is skipped for exempted occurrences (and, by an
entries-check that is a provable no-op for unmodified behavior, for
released entries, which rule 2 previously caught). An exempted occurrence
therefore skips BOTH parked dispositions and falls through to the normal
evaluation IN ORDER — `bound_already` (rule 1) still wins, and a
removed-provider POV surfaces as `voice_prompt` (Phase B's STOP signal,
§5B.2). Hand-built planes may omit either set (absent = empty).

## 2. Definition-derivation algorithm as implemented

`deriveParkDefinition(coord, job)` (park-release.mjs:235), re-derived at
every route call from durable records; the caller's list is only ever
intersected with the result:

1. **Pin side.** `coord._carryBook(job.book_id)` (the coordinator's own
   accessor over `worker/p8/approved-freeze-carry.mjs`) → the aggregate
   with `jobId === job.job_id`; absent → `park_definition_unpinned`.
2. **Shape.** `definition.total` N must be a safe integer, 1 ≤ N ≤ list
   length; the aggregate's `occurrences` list must be non-empty with
   unique nonblank ids; else `park_definition_malformed`.
3. **Identity cross-checks** (any failure → `park_definition_mismatch`):
   aggregate `chapterIndex`, definition `job_id`/`book_id`/`chapter_index`
   vs the live jobs row; the stored definition (jobs row `data_json`,
   parsed) agrees on job/book/chapter AND total (unparseable →
   `park_definition_malformed`); the live `occurrences` rows for the job
   are exactly the pinned list — same id set, same per-id state.
4. **Partition.** Definition set = the FIRST N ids of the pinned ordered
   list, in order; beyond-definition set = the remainder. For the live
   Chapter 3 job: N = 26, definition = idx 0–25, beyond = {idx 26
   `2a85f74f-353d-4c25-a86a-4a4db392868b`} — the partition the tests assert
   exactly.

Note (verified against the pin): `definition.segments` order does NOT
equal `occurrences` order in the pinned aggregate, so derivation uses the
`occurrences` list only (the list `occurrenceSetSha256` pins); segments
play no part.

## 3. Test inventory — mapped to Rowan's implementation-review list

New suites: `tests/ch3-park-release.test.mjs` (23 tests) +
`tests/ch3-park-routes.test.mjs` (9 tests) = **32 new tests, all passing**.
Fixtures mirror live shapes: the jobs/occurrences rows are seeded from the
real pinned aggregate exactly as `_migrateImportJobs` wrote them
(data_json = canonicalJson of the pin definition; 27 occurrence rows with
the pin's revision keys and states); content entities are synthetic and
structural only.

| Rowan's item | Where proven |
|---|---|
| Definition-set derivation against pinned AND live identity | park-release tests 1–6 (exact 26/1 partition; unpinned; total/state/missing-row mismatch; malformed data_json) |
| No-release byte-identical behavior | "byte-identical: census builder output with fence fields absent vs empty sets" (digest + full entry pairs); "byte-identical: adapter plane with tables ABSENT vs tables EMPTY"; tombstone tests restore the pre-act digest exactly |
| idx 26 voice_prompt STOP surface | "exemption STOP surface" (azure fixture: excluded_parked → voice_prompt on exemption); routes CH3R-7 names the underlying refusals |
| Exact scope filtering | Release happy path (chapter quote 23/3/1 + segment quotes for idx 26 vs idx 5); census scope test (idx 26 `excluded_ch3` in the census plane, `excluded_parked` in the live-shaped plane — both fenced, release never reaches it) |
| Duplicate / idempotency | Release idempotent re-release + conflict; exemption duplicate; both double-revokes; CH3R-8 through the entry |
| Rollback / tombstones | Release tombstone restores fence output EXACTLY (pairs + digest); exemption tombstone likewise; re-release after tombstone = new audited row; exemption reactivation keeps tombstone audit |
| Quota / unknown-billing guards untouched | No file of the quota guard, executor, grant guards, or phase guard is in the diff (full-tree hash comparison); the full battery's failing set is unchanged (below) |
| (task) Mutual exclusion both directions | Two dedicated tests. NOTE: through the routes, the partition makes overlap impossible (the definition fence fires first by design), so both named refusals are defense-in-depth against inconsistent state; the tests seed that state directly and prove the fences hold |
| (task) Malformed-body / default-deny matrix | Store matrix (set shape, unknown job, non-parked job) + CH3R-6 entry matrix (13 shapes: extra keys incl. a figure key, missing fields, over-length note, non-string source, array body, coerced-null body) |
| (task) Operator-fence denials | CH3R-3 (no credential / client token alone / not-configured, zero state movement, schema not even bootstrapped), CH3R-4 (scope/instance), CH3R-5 (forged stamp publicly; direct class calls without stamp → 403 at the class gate; stamp without internal marker → `internal_only`; wrong class scope) |
| (task) Live-shaped end-to-end effect | Release happy path + combined test: release + exemption clear the chapter to bound 3 / eligible 24 / parked 0; the parked job row and all 27 occurrence rows verified untouched |

## 4. Full-battery result (one complete run each, exit codes captured)

Runner: `run-battery.sh` (the tree's own convention — per-file
`node --test --test-timeout=120000` over `tests/*.test.mjs`, logs in
`logs/`), RUNNER_EXIT=0 on both runs.

| Run | Suites | Tests | Pass | Fail |
|---|---|---|---|---|
| Baseline — pristine copy of the base tree, one complete run | 113 pass / 22 fail / 135 | 1,099 | 1,077 | **22** |
| Final — this build's tree, one complete run | 115 pass / 22 fail / 137 | 1,131 | 1,109 | **22** |

The failing set is **exactly** the known 22-failure baseline: the failing
suite names are identical between the two runs (adaptive-background-repair,
audio-chunk-playback, chapter-quota-banner, continue-preparation-progress,
continue-setup-recovery, continue-to-quota, cross-device-chapter-handoff,
dormant-playback-start, first-chapter-segment-joining, gemini-400-hydration,
gemini-batch-lane, gemini-quota-diagnostics, generation-manual-queue-reuse,
generation-playback-concurrency, generation-session-sync-guard,
p8-d3-prod-envelope, p8-upload-envelope, playback-bookmarks,
restore-sound-rewind, silent-audio-recovery, split-first-update-stop,
sync-diagnostics), and the failing test names extracted from the per-file
logs are identical too. Delta is exactly the +2 new suites / +32 new tests,
all passing. Baseline logs preserved in `logs-baseline/`; final logs in
`logs/`. (Method note: the baseline was run from a pristine copy at the
SAME tree depth as the base — the census fixture resolves its data dir
relative to the tree, so a deeper copy fabricates ENOENT failures; the
first scratch baseline at the wrong depth was discarded for exactly that
reason.)

## 5. Deploy-relevant facts (file list only)

Worker parts that change vs live build `945875bc` — exactly four:

- `worker/worker-entry-prod-d6.js` (modified)
- `worker/generation/park-release.mjs` (NEW)
- `worker/generation/eligible-set.mjs` (modified)
- `worker/generation/content-plane-adapter.mjs` (modified)

Everything else in the tree is byte-identical to the base (805 base files →
808 with the three additions; the two new test files are not worker parts).
Full per-file SHA-256 manifest: `manifest.json` (808 files).

**Runtime note for the deploy gate:** the new tables do not exist in
production yet and nothing creates them at deploy time — they bootstrap
lazily on the first operator write, and every read path tolerates their
absence, so the deployed-but-unused build is behaviorally identical to
`945875bc` (proven by the byte-identical tests above).

## 6. Open items / judgment calls for review

1. **Schema placement** (above): lazy module-local DDL instead of
   GEN_SCHEMA, per the tree's post-genesis pattern and the pinned
   eight-table invariant. Flagged for Rowan's explicit confirmation.
2. **Revoke call shape**: separate revoke routes (task delegated this
   choice); primary allowlists kept exactly as the proposal specifies.
3. **No halt fence** on the four routes (reasoning above; both states
   tested). If Rowan wants the release/exemption halt-gated as well, it is
   a two-line change per handler — but it would contradict the Phase A
   sequence (release happens after gate (c)'s re-arm, system live).
4. **Mutual-exclusion refusals are unreachable through the routes** given
   the definition partition (the earlier fence always fires first). They
   are implemented and tested as defense-in-depth against inconsistent
   stored state, not as reachable call shapes.
5. **Exemption reactivation** overwrites the row's live fields under the
   new authorization (the §5B.2 primary key leaves one row per occurrence);
   the prior tombstone's audit fields are preserved on the row. Release
   history, by contrast, is fully append-only.

---

## 7. REVISION — Rowan 6548945443: exemption audit journal (judgment call 5)

**Ruling applied.** Rowan's CONDITIONAL PASS (board 6548945443) accepted
judgment calls 1–4 as built and required ONE revision before deploy,
against §6 item 5 above: *"exemption reactivation must retain an
append-only durable audit trail of every authorization and reversal, not
overwrite previous live authorization in the singleton row. A separate
immutable exemption event table or equivalent append-only journal is
acceptable, preserving the singleton current-state projection. Add tests
for multiple revoke/reactivate cycles and complete audit recovery, and
rerun baseline comparison."* This section is appended; §§1–6 above are
unchanged, as filed at pin `540f6a06`.

**What changed — `worker/generation/park-release.mjs` only (584 → 686
lines; the `v2/` mirror is the same file via symlink, as in the original
build).**

- **New table `d6_chapter_exemption_events`** (park-release.mjs:105),
  added to `PARK_RELEASE_SCHEMA` under the same lazy DDL-only idempotent
  bootstrap discipline as the other two tables (not in gen-schema.mjs —
  judgment call 1, accepted). Columns: `event_id` (AUTOINCREMENT, the
  append sequence), `occurrence_id`, `job_id`, `book_id`,
  `chapter_index`, `action`, `authorization_ref`, `source`, `note`,
  `resulting_state` ('live' | 'tombstoned'), `event_at`.
- **One append helper** `appendChapterExemptionEvent` (:520) holding the
  module's ONLY statement against the journal — an INSERT (:524). It is
  called inside the same `coord._tx` as the projection write, BEFORE
  that write, so a failed projection write rolls the event back with
  it: the journal can never record a transition the projection did not
  take, nor miss one it did.
- **Wiring**: initial authorization appends action `exempted` (:619);
  reactivation appends `reactivated` (:605) and only then refreshes the
  singleton projection exactly as before (prior tombstone fields stay on
  the row as the most-recent-reversal record — the projection semantics
  of §6 item 5 are otherwise unchanged); revocation appends `revoked`
  (:668) before tombstoning the projection. Idempotent no-ops
  (duplicate exempt / duplicate revoke) change no state and append NO
  event; refusals append nothing and write nothing, as before.
- **Audit recovery read** `chapterExemptionEvents(coord, occurrenceId)`
  (:251) returns the complete ordered history from the journal alone;
  `chapterExemptionEventView` (:201) is its read-back shape. No new
  routes were added — the journal is internal audit; the adapter and
  every eligibility path are untouched, and no read path consumes the
  journal.
- **Append-only is grep-provable**: across the whole tree, the journal
  table is named in SQL only by its CREATE and the single INSERT above.
  No UPDATE or DELETE against `d6_chapter_exemption_events` exists
  anywhere in the tree (verified by grep over all .mjs/.js sources).

**New tests (+5; the prior 32 ch3 tests pass unchanged in outcome).**

- `tests/ch3-park-release.test.mjs` (23 → 27): three full
  revoke/reactivate cycles asserting the exact ordered event sequence
  (`exempted, revoked, reactivated ×3` after the initial), the
  projection matching the state at every step, every authorizationRef
  surviving, and the projection holding only the latest; complete audit
  recovery by replaying the journal alone (reconstructs every
  transition incl. the superseded authorization the projection
  overwrote, agreeing with the projection on current state); journal
  immutability (prior event rows byte-stable across later operations;
  refusals append nothing); fence byte-identity with journal history
  present once the exemption is tombstoned (builder pairs + digest).
- `tests/ch3-park-routes.test.mjs` (9 → 10): CH3R-10 — exempt / revoke /
  re-exempt through the entry appends the three ordered journal events
  with their authorizationRefs; a duplicate appends nothing.

**Battery (one complete run on the final tree; logs in `logs-fix/`,
RUNNER_EXIT=0).** 137 suites: 115 pass / 22 fail. **1,136 tests: 1,114
pass / 22 fail** — the original build's 1,131 / 1,109 / 22 plus exactly
the 5 new tests. The failing suite set is identical to the original
build's run (`logs/`), and the failing test names are identical after
stripping run durations. Baseline comparison: the pristine-baseline run
in `logs-baseline/` (135 suites, 1,099 tests, 1,077 pass / 22 fail)
still stands and was NOT rerun — this revision changed no tree layout
(no file added or removed; fileCount unchanged at 808) and touched no
baseline suite or fixture, so the baseline measurement remains valid;
the 22 failures in the fixed tree are the same baseline 22, name-for-
name, via the original build's run as the intermediate link.

**Diff surface vs the original build (pin `540f6a06` content),
complete** — verified by full-tree SHA-256 comparison against the
original `manifest.json` (805 of 808 entries identical; zero battery
churn — the tree hashes the same before and after the battery run):

| File | Change |
|---|---|
| `worker/generation/park-release.mjs` (+ its `v2/` pin blob, same file) | journal table + append helper + wiring (above) |
| `tests/ch3-park-release.test.mjs` | +4 journal tests, +3 imports |
| `tests/ch3-park-routes.test.mjs` | +1 journal test (CH3R-10) |
| `BUILD-REPORT.md` | this appended §7 only |
| `manifest.json` | regenerated (same format; 808 files) |

Deploy-relevant parts vs live build `945875bc` are unchanged from §5:
the same 4 worker parts, with `park-release.mjs` now carrying the
journal. The journal table bootstraps lazily with the other two on the
first operator write; a deployed-but-unused build remains behaviorally
identical to `945875bc`.
