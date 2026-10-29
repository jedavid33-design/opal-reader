# gen-pkg-1 — LOCAL BUILD REPORT (Oct 29, 2026)

Built locally under Julie's approval `JULIE-APPROVAL:GEN-PKG-1-BUILD-20261029`
(board comment 6510800950), to Rowan's design sign-off (board comment
6510767252) on design brief v2 (filed 6510748653). **Nothing was deployed,
nothing was published, no production call or write of any kind was made.**
The only network use during the build was a GitHub READ of board comments.
Candidate commits are pinned to the review branch `ui1-review` ONLY (see
"Pin" at the end).

## Candidate identities

### Worker candidate (base: live build `ac451df8…`, tree `~/workspace/d6-build/impl/`)

- Working tree: `~/workspace/gen-pkg-1/worker-build/`
- Tree hash (SHA-256 over sorted relative paths + contents, logs excluded):
  `c5240489558a760424287e521159df0d8442c62eb6ff12ef517a840e136fed0d` (368 files)
- Entry: `worker/worker-entry-prod-d6.js` (the tree's `v2/` symlink mirrors `worker/`)
- Changed-file SHA-256 prefixes: entry `3b377d25eecddfa9…`,
  `generation/service.mjs` `9b4079232cb9cb2c…`,
  `generation/binding-projection.mjs` (new) `d100f02ce199bbcd…`,
  `generation/d6-executor.mjs` `df7e0003f76177a4…`

### Client candidate (base: ui-pkg-4, live `main` @ `7f443ffe`, build `d5b-v2-playback-client-15`)

- Working tree: `~/workspace/gen-pkg-1/client-build/gen/` (`base/` = ui-pkg-4 publish tree, 73 paths)
- Publish tree: `package/publish/`, 81 paths, tree hash
  `bbbf6bb3e1251c453a48da5e2730690c36d1a5e889178e4dbb8e0b40c33179c8`
- Entry `app-268.js`, service worker `sw-genpkg1.js`, stylesheet `styles-155.css`
- Build marker **`d5b-v2-generation-client-2`** (the `-2` distinguishes this build
  from the WS-4 `d5b-v2-generation-client-1` candidate, which sat on the superseded
  ui-pkg-3 base and was never published), packaging marker `gen-pkg-1`,
  cache `opalreader-shell-genpkg1`
- Frozen Shelf bridge in the final tree: SHA-256
  `bc0a5879fbf4a6f455170ead8e0fbe1aa19d82126df4eb631bd0ebad9112ec8e` — verified byte-identical
- Diagnostics reports THIS build's marker (constants/composition/runnable were
  advanced as genpkg1 successors precisely so there is no marker split of the
  kind the WS-4 candidate had to disclose); GP-1 of the Chromium proof reads
  `d5b-v2-generation-client-2` from the live introspection handle.

## Delta manifests (exact path lists)

### Worker delta vs `ac451df8…` (verified by recursive diff — nothing else differs)

Changed:
- `worker/generation/service.mjs` — plan list, capabilities, eligibility quote, attempt diagnostics (item 5)
- `worker/generation/d6-executor.mjs` — binding-projection commit hook at both commit sites
- `worker/worker-entry-prod-d6.js` — internal + public forwards for the new surfaces; operator fence for diagnostics

New:
- `worker/generation/binding-projection.mjs` — commit-then-project binding publication + reconciliation
- `tests/genpkg1-projection.test.mjs` (7 tests)
- `tests/genpkg1-surfaces.test.mjs` (5 tests)
- `tests/genpkg1-intent-idempotency.test.mjs` (4 tests)
- `tests/genpkg1-diagnostics.test.mjs` (9 tests)

Deliberately unchanged: `genstore.commitVerified` (the hook lives in the executor,
so direct-genstore behavior is untouched), `submitIntent` (it already builds a
fresh eligible set per submission; its intent hash includes the eligible ID set —
proven, not assumed, by the idempotency suite), settings/halt/queue/grants/budgets,
and the parked Ch 3 fence + fingerprint semantics (the D6 suites are the regression proof).

### Client delta vs ui-pkg-4 publish tree (9 paths; all other 72 publish paths byte-identical to base)

- `index.html` (changed: app/styles pointers advanced)
- `app-268.js` (new: live generation sheet, book Generation section, Generation view)
- `sw-genpkg1.js` (new)
- `styles-155.css` (new: styles-154 + appended generation section only)
- `modules/constants-genpkg1.js`, `modules/entry-genpkg1.js`,
  `modules/composition-genpkg1.js`, `modules/runnable-genpkg1.js` (new identity successors)
- `modules/generation-surface.js` (new: the generation API client + plain-language renderers)

Note: `modules/constants-ui4.js` remains in the publish tree and in the SW SHELL —
`storage-state.js` (byte-identical, G7) still imports it. The gen SW carries both.

## Worker delta — what was built

1. **Binding projection at commit + reconciliation.** After an execution commits,
   `noteCommitted` (called from both executor commit sites) writes a retryable
   pending marker in `d6_binding_projections`, then projects: the sync bindings
   entity is upserted by CAS from the committed SQL rows (payload `{cacheKey,
   revisionKey, format, size, sha256, provenance: "d6"}` — a pure function of the
   committed rows). Publication equality is judged on **cacheKey** (the audio
   identity): same cacheKey = no-op "published" (a revisionKey variance — e.g. the
   hand-pushed G10 smoke entity — is recorded in the marker detail, never
   rewritten); a different cacheKey = a `conflict` marker with existing/desired
   detail, **never overwritten**. A bounded sweep on the existing drive cycle
   retries pending markers, re-checks conflicts, and discovers committed
   executions with no marker (LEFT JOIN) — reconcile-until-published.
2. **`GET /v2/d6-plans`** — read-only plan list, keyset pagination
   `(created_at DESC, plan_id DESC)`, limit clamped 1..100, undecodable cursor
   reads from the top. Per plan: planId, bookId, scope, chapterIndex, lane, phase,
   state, stopReason, totals, settledMicroCents (the ledger's own settled
   definition), bindingsPublished/Pending, createdAt, updatedAt. No book text.
3. **`GET /v2/generation/capabilities`** — `{generationState, lanes, configuredLane,
   phases, asOf}` from the halt flag, the pinned lane allowlist (`["standard"]`;
   batch reports `batch_not_armed`), and `phaseAccounting`. Phases appear ONLY
   where a budget exists (`PHASE_BUDGET_MICRO_CENTS`); no invented data.
4. **`GET /v2/d6-eligibility`** — advisory quote from the SAME `buildEligibleSet`
   the executor path uses, freshly built per call, scoped exactly as
   `submitIntent` scopes: `{eligibleCount, totalChars, expectedCostMicroCents,
   exclusions {bound_already, voice_prompt, parked, other}, digest, quotedAt,
   advisory: true}`.
5. **`GET /v2/d6-diagnostics` — OPERATOR-ONLY attempt diagnostics** — *added under
   Julie's Oct 29, 2026 diagnostics approval (board comment 6511269658), following
   the Forever Pucked Ch 2 halt diagnosis* (`~/workspace/d6-build/deploy-evidence/
   followon-fp/ch2-halt-diagnosis.md`). Reads `d6_execution_records` (per-occurrence
   state/stage/detail) and `d6_attempt_log` (per-call phase/outcome/cost/timestamps)
   for one planId or jobId. Fence: the seed route's class — the production gate
   skips the client token for this route, the migration-operator credential admits,
   the entry stamps admission, and the DO-internal route requires the stamp; the
   everyday client token alone is refused (403 `migration_operator_required`),
   fail-closed 503 when the operator credential is unset or equals the client
   token. Detail payloads pass a scalar whitelist (message / httpStatus / code /
   reason / detail / depth / outcome / blockReason / finishReason, strings
   truncated to 500 chars) — segment text or any other stored field can never ride
   this surface. Bounded and paginated (executions keyset over
   `(created_at, execution_id)`, page ≤ 100; attempts embedded per execution in
   seq order, capped at 200 with a truncated flag); unknown plan/job returns
   `found: false` with empty pages — no throw on any empty path. **No client UI
   exists for this surface, and none was added.**

## Client delta — what was built

- The confirm sheet is live: on open it fetches capabilities + the eligibility
  quote for the exact scope + the plan list in parallel. Start is offered only
  when the server says generation is enabled, the scope has eligible segments,
  and no active plan already covers the scope. The dialog shows server numbers
  only (count, characters, expected cost labelled "(estimate)", exclusions in
  plain words). Lane picker renders from capabilities; Batch is disabled WITH
  its server reason until admitted. Phase is looked up from capabilities by
  bookId — never hard-coded.
- Submit is `POST /v2/commands` SubmitJob carrying `data.d6Intent`, with the
  `command_id` minted once per sheet opening (double-tap/retry stable). If the
  submit's answer is lost, the sheet re-reads the plan list before reporting
  anything — found means "Started", and there is no blind resubmission. An
  already-active plan reroutes the sheet to the Generation view instead.
- Book screen gains a Generation section (this book's plans, display only); the
  Generation view lists ALL account plans — including operator-submitted ones —
  with per-plan progress, plain-language stop reasons, settled cost and phase
  remaining from server amounts only. **No resume control exists anywhere.**
  Parked content and voice_prompt content render their server-driven wording
  with no start control.
- No binding authorship anywhere; no new localStorage/IndexedDB records
  (transient state in memory only); the token lives only in transport closures,
  as everywhere else in this shell.

## Test results (all on the exact final trees; full logs cited)

### Worker — full battery, one clean complete run on the final tree

- **115 suite files: 93 pass / 22 fail.** The failing set is byte-for-byte the
  recorded baseline set of the untouched base tree (20 legacy-fixture ENOENT
  suites + the 2 git-required envelope suites; zero assertion failures).
  Baseline note: the task brief said "90 pass / 22 fail"; the base tree's own
  recorded full run (`~/workspace/d6-build/impl/logs/g2/worker-suites-summary.txt`,
  111 files) says **89 pass / 22 fail** — the recorded set was used as the
  baseline, and the final failing set equals it exactly.
- Summary + per-file logs: `~/workspace/gen-pkg-1/logs/worker-final/`
  (`summary.txt` carries the full PASS/FAIL list and totals).
- New suites, all green in that same run:
  - `genpkg1-projection` **7/7** — happy path; crash-between-commit-and-publish
    recovered by the sweep; drive-cycle sweep republishes; duplicate/racing
    projectors produce exactly one entity revision and one change row; G10-style
    equal binding is a no-op; conflicting binding never overwritten across two
    sweeps; incomplete metadata stays pending, then publishes when restored.
  - `genpkg1-surfaces` **5/5** — empty-store reads on the throwing-`.one()`
    harness; capabilities truthfulness (enabled vs halted, batch not armed,
    phase remaining from the ledger); quote == executed set for book/chapter/
    segment scopes incl. parked and voice_prompt fixtures and no cross-book
    leakage; plan-list pagination stability, settled == direct SQL ledger sum,
    no text fields anywhere in payloads.
  - `genpkg1-intent-idempotency` **4/4** — simultaneous submits from two service
    instances converge on one plan/job; lost-response retry returns the same
    plan; newly-eligible content mints a NEW plan (a stale completed plan never
    swallows a later intentional run); the shrunk set mints a `nothing_eligible`
    plan and then stays stable.
  - `genpkg1-diagnostics` **9/9** — fixture records read back (incl. an unknown
    attempt with NULL cost and a 120,000 ms span — the timeout signature);
    text sentinels in detail payloads never appear in any response while
    whitelisted error fields do; keyset pagination + jobId targeting;
    unknown/missing targets safe on the throwing-`.one()` harness; entry-level
    fence: operator admitted with no client token, client token alone refused,
    wrong/absent operator refused, fail-closed 503s, forged stamp refused,
    class gate requires the stamp, unknown plan -> 200 `found: false` end to end.
    Log: `~/workspace/gen-pkg-1/logs/worker-final/genpkg1-diagnostics.log`.

### Client

- Store unit battery (ui-pkg-4 battery against the candidate tree): **13/13** —
  `~/workspace/gen-pkg-1/logs/client-unit-battery.log`
- Generation-surface unit battery: **10/10** (request shapes + gate headers,
  the exact SubmitJob contract, pagination, lane/exclusion/status renderers,
  active-plan matching, phase lookup, money formatting) —
  `~/workspace/gen-pkg-1/logs/client-generation-unit.log`
- Chromium proof with a loopback stub coordinator implementing the new
  surfaces: **13/13 PASS, 0 page exceptions** —
  `~/workspace/gen-pkg-1/logs/client-chromium-proof.log`
  - GP-1 boot under `sw-genpkg1.js` + connect; GP-2 server quote rendered
    (3 segments · 3,992 chars · $0.06 estimate · exclusions), Batch disabled
    with its reason; GP-3 double-tap = exactly one SubmitJob of the pinned
    shape (phase null for an unbudgeted book); GP-4 active-plan rerouting;
    GP-5 Generation view discovers the pre-seeded operator-submitted plan and
    renders the phase budget from server amounts ($13.50 / $0.02 / $13.48 left),
    no resume control present; GP-6 chapter scope (chapterIndex, keepGoing
    false); GP-7 parked chapter — no Start, parked wording, no submit; GP-8
    voice_prompt segment — "needs a voice choice first", no submit; GP-9 FP
    book submit carries phase `forever-pucked` from capabilities; GP-10
    timeout-after-accepted-submit: every response copy dropped, sheet re-reads
    the plan list and reports Started — exactly one logical command, one plan,
    all wire copies carrying the single client-minted `command_id` (the browser
    re-delivers a socket-killed POST; the coordinator's command_id dedupe +
    intent identity absorb it — the client never resubmits); GP-11 state record
    + Shelf record byte-stable across all generation flows; GP-12 halted
    capabilities — Start never offered; GP-13 rollback: the ui-pkg-4 build
    boots on the same profile/state and the gen build boots after it, with no
    storage migration in either direction (the ONLY cross-build difference in
    the state record is the shell's own sync-run `at` timestamps, rewritten on
    every connect by both builds — bookkeeping, not migration; record length
    identical).
- Package static checks: **ALL PASS** (publish = base + the 9-path delta exact;
  non-delta byte-identical; bridge SHA pinned; import closure of 26 modules
  inside the SW SHELL of 33 paths; PURGE stays `[]`; rollback SW SHELL fully
  resolvable) — `~/workspace/gen-pkg-1/logs/client-package.log`

## Rowan's six implementation proof obligations -> implementation + proving test

1. **Projection is commit-then-project, retryable, verify-before-overwrite,
   equal = no-op; crash/duplicate/racing tested.** `worker/generation/
   binding-projection.mjs` (marker-first `noteCommitted`, CAS upsert from
   committed rows, cacheKey equality, conflict marker never overwritten,
   bounded reconcile sweep on the drive cycle) + hooks in `d6-executor.mjs` at
   both commit sites. Proven by `genpkg1-projection` 7/7 (crash recovery,
   racing projectors -> one revision/one change row, G10-style no-op, conflict
   held across sweeps, incomplete-metadata pending -> publish).
2. **Quote advisory; submission revalidates transactionally.** `eligibilityQuote`
   (service.mjs) builds a fresh set with the executor's own builder on every
   call; `submitIntent` was already fresh-set-per-submission and its intent
   hash binds the eligible ID set — left unchanged and proven, not assumed, by
   `genpkg1-surfaces` (quote == executed set on fixtures) and
   `genpkg1-intent-idem
...[truncated 5880 chars]