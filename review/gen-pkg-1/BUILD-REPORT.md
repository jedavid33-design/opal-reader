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
- Tree hash (SHA-256 over sorted `relpath\n<file-sha256-hex>\n` lines, logs
  excluded, symlinks not followed): **round-1 corrected tree**
  `401971edfdaccd5ad313c62f886835d9fb486af5a35af324fd7893d1c8d823d1` (369 files;
  round 0 was `c5240489558a760424287e521159df0d8442c62eb6ff12ef517a840e136fed0d`,
  368 files, under the round-0 builder's ad-hoc serialization — the delta
  between the trees is exactly the round-1 correction set in the Round-1
  section below)
- Entry: `worker/worker-entry-prod-d6.js` (the tree's `v2/` symlink mirrors `worker/`)
- Changed-file SHA-256 prefixes: entry `3b377d25eecddfa9…`,
  `generation/service.mjs` `2ae2031dbe04f5357…` (round-1 corrected; round 0
  was `9b4079232cb9cb2c…`),
  `generation/binding-projection.mjs` (new) `d100f02ce199bbcd…`,
  `generation/d6-executor.mjs` `df7e0003f76177a4…`

### Client candidate (base: ui-pkg-4, live `main` @ `7f443ffe`, build `d5b-v2-playback-client-15`)

- Working tree: `~/workspace/gen-pkg-1/client-build/gen/` (`base/` = ui-pkg-4 publish tree, 73 paths)
- Publish tree: `package/publish/`, 81 paths, tree hash (same digest method
  as the worker tree above): **round-1 corrected tree**
  `558d090676c510e705e37acedeae4ff768443b70823263665188626b1c22ca2c`
  (round 0 was `bbbf6bb3e1251c453a48da5e2730690c36d1a5e889178e4dbb8e0b40c33179c8`).
  Round-1 changed delta files: `app-268.js` `dc44b698c3b511384d…`,
  `modules/generation-surface.js` `6ce61c18ea9af0613f66…`,
  `modules/entry-genpkg1.js` `f882feb17932a53603a8…` (export list only);
  the other six delta paths are byte-identical to round 0. **Entry name and
  build marker unchanged** (`app-268.js` / `d5b-v2-generation-client-2`) —
  content-only corrections.
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
  `~/workspace/gen-pkg-1/client-build/gen/logs/client-unit-battery.log`
- Generation-surface unit battery: **10/10** (request shapes + gate headers,
  the exact SubmitJob contract, pagination, lane/exclusion/status renderers,
  active-plan matching, phase lookup, money formatting) —
  `~/workspace/gen-pkg-1/client-build/gen/logs/client-generation-unit.log`
- Chromium proof with a loopback stub coordinator implementing the new
  surfaces: **13/13 PASS, 0 page exceptions** —
  `~/workspace/gen-pkg-1/client-build/gen/logs/client-chromium-proof.log`
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
...[truncated 5880 chars]potency` (newly-eligible distinction).
3. **Intent idempotency: cross-device convergence, lost-response retry,
   later-run distinction.** Server intent identity (unchanged machinery) proven
   by `genpkg1-intent-idempotency` 4/4; client side proven by GP-3 (double-tap
   = one command), GP-4 (active-plan rerouting), and GP-10 (dropped responses:
   one logical command, one plan, one client-minted `command_id` across all
   wire copies).
4. **Read surfaces: existing gates, stable pagination, no leakage, server
   amounts only, no invented budgets.** All surfaces ride the entry's existing
   production gate chain (scope config + header, client token, instance);
   listPlans keyset pagination; capabilities reports only budgeted phases.
   Proven by `genpkg1-surfaces` 5/5 (incl. no-text payload assertions and
   settled == ledger SQL) and client GU1–GU10 + GP-2/GP-5.
5. **Deploy gate (recorded pre/post state, in-flight assessment, pinned
   envelope, rollback; prefer quiescent).** NOT part of this build — nothing
   deploy-like was done, no production contact made. The candidate identities
   and tree hashes above are the pinned envelope inputs for that future gate.
6. **Test law, incl. throw-safe empty-result paths.** The harness `.one()`
   throws on empty results (real-DO semantics); empty-store/unknown-target
   tests exist for every new read surface (`genpkg1-surfaces`,
   `genpkg1-diagnostics` Svc-4/Ent-5); the full battery's failing set equals
   the base baseline exactly (see Test results).

**Diagnostics instrument note (item 5):** the attempt-diagnostics surface is
the instrument that will confirm the Ch 2 halt diagnosis findings against
production attempt records after the deploy gate — specifically (a) the
suspected 3.8-branch block-signal mapping gap in `worker/host/adapters.mjs`
(a no-audio/blocked 200 on the interactions branch failing as a 502 provider
error at stage `synthesis` after exactly one call, vs `policy_block` split
detail), and (b) the 120 s fetch-timeout class for the unknown-billing attempt
(its stored detail message + the attempt row's created→updated span). This
build deliberately does **NOT** change the adapters or the timeout behavior —
the fix package is separate and not yet scoped. `reconcileUnknown` also
remains without an invocation path in this build (the diagnosis flagged the
gap; surfacing it is a separate decision).

## Deviations and open items, stated plainly

- **Baseline count discrepancy:** brief said 90/22; the base tree's own
  recorded run says 89/22 (111 files). The recorded set was used; the final
  failing set matches it exactly. No new failures.
- **Tree-layout note:** the worker tree carries the accepted `v2 -> worker`
  symlink; the candidate's real paths are under `worker/` (the entry's
  deployed path convention is unchanged).
- **Client log locations:** the three Chromium/unit logs live under
  `~/workspace/gen-pkg-1/client-build/gen/logs/`; the package-check log is at
  `~/workspace/gen-pkg-1/logs/client-package.log`; worker logs under
  `~/workspace/gen-pkg-1/logs/worker-final/`.
- **Report assembly note:** the first pinned copy of this report was
  truncated mid-obligation-2 by a write failure and pinned as-is in
  `93d04f0a…`; an interim commit (`ea22a98b…`) re-pinned the same truncated
  text under a correction message that the truncation prevented from taking
  effect. THIS copy is the complete report; a follow-up pin commit on
  `ui1-review` supersedes the report file at the same path. No artifact
  (worker/client/test) file is affected — only this report was truncated.
- **Not authorized by this build (unchanged gates):** worker deploy, client
  publication, Batch arming, parked Ch 3 resume, the rest of Forever Pucked
  beyond Ch 2, any generation/spend beyond the already-approved Ch 2
  follow-on, the adapters/timeout fix package, and any `reconcileUnknown`
  invocation path.

## Round-1 corrections (Rowan source review, comment 6511518715)

Applied locally to the round-0 trees; **no deploy, no publication, no
production contact.** This section supersedes two round-0 statements: the
worker delta's "Deliberately unchanged: `submitIntent`…" line and proof
obligation 3's "unchanged machinery" — `submitIntent` DID change, narrowly,
as follows. Everything else in the round-0 delta is untouched (adapters,
the 120 s timeout, `reconcileUnknown` wiring, the parked Ch 3 fence, the
Shelf bridge — re-verified `bc0a5879…` in the corrected publish tree).

### B1 — server-side phase authority (`worker/generation/service.mjs`)

New `admitPhase(bookId, callerPhase)` runs inside `submitIntent` after the
lane gate and before any plan/ledger state moves. The grounded model: the
registry `PHASE_BUDGET_MICRO_CENTS` defines which phase strings carry a
budget at all, and a book's binding to a budgeted phase is server state —
the phase of the plans already admitted for that book (the same
`d6_plans` record `capabilities()` reads its phase→book link from).
Rules:

- **Bound book** (an earlier admitted plan carries a registry phase):
  caller phase missing/null → rejected `phase_required`; any different
  phase → rejected `phase_mismatch`; the exact bound phase → admitted.
  No plan is created and no ledger/attempt/grant state moves on a
  rejection (asserted by test).
- **Unbound book**: a caller phase outside the registry → rejected
  `phase_not_budgeted` (an invented phase string is never stored); a
  registry phase → admitted and establishes the book's binding with the
  created plan; no phase → admitted unbudgeted (phase null).
- The plan stores the **server-admitted** phase, never the raw caller
  value. The client's capabilities-derived phase remains a hint; a
  disagreement is the rejection above, never a silent override.

**Disclosure for round 2:** cross-book phase *exclusivity* is deliberately
NOT enforced (a second book presenting `forever-pucked` first would bind
itself to that phase). Grounds: the D6 system's own passing suites treat a
phase as an accounting bucket a book binds to on first use —
`tests/d6-service.test.mjs` admits two different books under
`forever-pucked` in one database (quota parking depends on the shared
bucket), and `tests/d6-correction.test.mjs` does the same through the
public route; a hardcoded production-book binding or exclusivity rule
would break both suites and the battery constraint. In production the
Forever Pucked ↔ `forever-pucked` binding already exists in server state
(the G10 smoke + Ch 2 plans), so every B1 attack against the budgeted
book — null, wrong, or forged phase — is rejected by the rule above.

### B2 — intent identity covers execution semantics (same function)

`intentKey` now hashes `{bookId, scope, chapterIndex, occurrenceId,
eligibleIds, lane, keepGoing, phase}` where `phase` is the B1-admitted
(server-derived) value. Byte-identical retries still converge (the
round-0 idempotency suite stays green, plus a new full-semantics
convergence test); a semantics change mints its own plan. Note on lanes:
the allowlist admits only `standard` today, so a lane change is exercised
as the explicit `lane_not_allowed` rejection — the existing plan is never
returned for a different-lane request; with lane inside the identity,
arming Batch later makes a differing lane mint its own plan the same way
`keepGoing` does now. Read surface: `planSummary` now also returns
`keepGoing` (from `d6_plans.keep_going`) so the client can name a plan's
own semantics.

### Client corrections (`gen/src/modules/generation-surface.js`, `gen/new-sheet.js.txt`)

- New pure helpers in `generation-surface.js`, exported via
  `entry-genpkg1.js`: `rejectionText(reason)` (plain "nothing was
  started" wording for `phase_required` / `phase_mismatch` /
  `phase_not_budgeted` / `lane_not_allowed` / `scope_invalid` + a safe
  default), `planSemanticsText(plan)` (the plan's own lane +
  continuation: book scope honours `keepGoing`, chapter/segment are
  scope-bounded), `planMoneyText(plan)` (below).
- Sheet (`genSheetSubmit`): the intent route answers HTTP 200 with the
  service result, so a rejection arrives as data with no `planId` — it
  is now treated as a rejection (note = `rejectionText`, Start
  re-enabled, never "Started"). The round-0 code reported "Started" for
  any non-throwing receipt; that defect is fixed.
- Lost-response recovery: the re-read now matches on the request's
  semantics (lane + keepGoing) before claiming "Started"; if only a
  different-semantics active plan matches, the sheet names THAT plan's
  semantics and states this sheet's start wasn't submitted.
- Active-plan rerouting (`prepareGenSheet`): the note names the
  existing plan's `planSemanticsText` — never a bare "already running".
- Plan lines (`genPlanLine`): meta is now `planMoneyText` + the plan's
  semantics + publication counts (applies to the book screen's
  Generation section and the Generation view alike).

### Money/status accuracy (Rowan's required distinction)

The client now speaks the server's three distinct figures distinctly:
(a) the quote is an **estimate** (sheet labels it "(estimate)" — round 0,
unchanged); (b) **known-settled accounting** — `settledMicroCents`, the
attempt-log sum over confirmed outcomes, rendered "Settled $X"; (c) a
phase's in-flight upper bound is **reserved** — the Generation view phase
line appends "reserved up to $Y" when `inFlightUpperMicroCents > 0`. The
grant-time estimated ledger debit (the Ch 2 $0.3537 class of figure) is
server-internal and **no client surface displays it**; nothing anywhere
calls any figure a bill or provider charge. For a `halted_unknown` plan,
`planMoneyText` renders "Settled $X so far — plus a charge that isn't
confirmed yet": the unconfirmed charge is called out, never folded into
the settled figure, and the plan line carries no retry/resume affordance
(there is none anywhere in the client, by design).

### New and extended tests (all on the corrected final trees)

- **Worker** `tests/genpkg1-phase-authority.test.mjs` — **8/8**: bound
  book null/omitted phase → `phase_required` with plan/ledger/attempt/
  grant counts provably unchanged; wrong phase → `phase_mismatch`;
  correct phase admitted + converges; unbudgeted book admitted with
  phase null; invented phase → `phase_not_budgeted`, nothing created;
  registry phase establishes a binding (distinct plan under B2, book
  budgeted thereafter); keepGoing-only change at book scope → distinct
  plan, identical retry converges; different-lane request → explicit
  rejection, never the existing plan; concurrent identical
  full-semantics submissions → one plan.
- **Client unit** GU11–GU13 added to `generation-unit.mjs` — **13/13**
  (rejection wording, semantics text, money text incl. the
  halted_unknown qualifier and a no-bill-language assertion).
- **Chromium proof** — GP-4 additionally asserts the reroute note names
  the existing plan's lane + continuation; new **GP-14** (halted_unknown
  view test): a stub plan in the production Ch 2 halt's exact shape
  renders "Stopped — a charge needs checking before it can continue",
  "Settled $0.35 so far — plus a charge that isn't confirmed yet",
  its lane, no retry/resume control, and zero submissions. The stub now
  carries `keepGoing` on plans (seeded + intent-created), mirroring the
  corrected worker surface. **14/14 PASS, 0 page exceptions** on tree-a
  and on `package/publish`. Disclosure: the first tree-a run failed
  GP-2→GP-5 on a null click inside the proof harness's own `openBook`
  helper (a library-row element replaced between its wait and click —
  code untouched by these corrections); the identical tree then passed
  14/14 twice (tree-a re-run + package tree). First-run log preserved at
  `~/workspace/gen-pkg-1/logs/round1/client-chromium-tree-a.log`.
- **Store unit battery** (ui-pkg-4 battery vs the candidate tree):
  **13/13**, unchanged.

### Battery (corrected final trees)

- Worker: **116 suite files: 94 pass / 22 fail** — the failing set is
  byte-identical to the recorded 22-name baseline (20 legacy-fixture
  ENOENT + 2 git-required envelope suites); zero assertion failures
  anywhere. The one new file is the phase-authority suite (8/8, inside
  the 94). Logs: `~/workspace/gen-pkg-1/logs/round1/worker-final/`.
- Client package static checks: **ALL PASS** on the corrected tree
  (publish = base + 9-path delta exact; bridge SHA pinned — independently
  re-verified `bc0a5879fbf4a6f455170ead8e0fbe1aa19d82126df4eb631bd0ebad9112ec8e`).

## Pin

Pinned to `jedavid33-design/opal-reader` branch `ui1-review` (review only;
no production branch touched), parent `ac451df8b772ddc3f64d4c6418678ce78b243d58`,
under `review/gen-pkg-1/` (this report, the four worker files, the four worker
test suites, the nine client delta files at final paths, the three client test
sources, and the key logs). Artifacts pin commit:
**`93d04f0ab5bfc1aa6eccf2d9f0a34b568370906f`** (tree
`7fb7443a87be374ca4671979d0a85600d37297f4`, 27 files). The completed-report
follow-up commit SHA is recorded in the builder's completion message (a
commit cannot contain its own SHA).

**Round-1 re-pin:** the corrected trees were re-pinned on the same branch
with parent `d4deb2d0ef58f49e1d6d4b6bf51001d843792540` (the round-0
completed-report head), same `review/gen-pkg-1/` layout, plus the new
worker suite and the round-1 logs. The re-pin commit SHA is recorded in
the builder's completion message, and the branch head was verified by
independent read-back after the push.
