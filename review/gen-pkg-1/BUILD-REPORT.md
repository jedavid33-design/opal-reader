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
  section below); **round-2 corrected tree**
  `6685e7f91f219b80b935883be1a7bdf23f7bad169cc05e42c9bac2892fdac66c` (372 files;
  the delta vs round 1 is exactly the round-2 correction set in the Round-2
  section below: `service.mjs` corrected, `phase-policy.mjs` new, two new
  test suites)
- Entry: `worker/worker-entry-prod-d6.js` (the tree's `v2/` symlink mirrors `worker/`)
- Changed-file SHA-256 prefixes: entry `3b377d25eecddfa9…`,
  `generation/service.mjs` `8d3912bbcebd0bfb…` (round-2 corrected; round-1
  corrected was `2ae2031dbe04f5357…`; round 0 was `9b4079232cb9cb2c…`),
  `generation/phase-policy.mjs` (new, round 2) `f9c858b826303060…`,
  `generation/binding-projection.mjs` (new) `d100f02ce199bbcd…`,
  `generation/d6-executor.mjs` `df7e0003f76177a4…`

### Client candidate (base: ui-pkg-4, live `main` @ `7f443ffe`, build `d5b-v2-playback-client-15`)

- Working tree: `~/workspace/gen-pkg-1/client-build/gen/` (`base/` = ui-pkg-4 publish tree, 73 paths)
- Publish tree: `package/publish/`, 81 paths, tree hash (same digest method
  as the worker tree above): **round-1 corrected tree**
  `558d090676c510e705e37acedeae4ff768443b70823263665188626b1c22ca2c`
  (round 0 was `bbbf6bb3e1251c453a48da5e2730690c36d1a5e889178e4dbb8e0b40c33179c8`);
  **round-2 corrected tree**
  `a84344d43b12b17d47763e8ada1f119609a91c5a1a510dac34ea8355de9321d5`.
  Round-1 changed delta files: `app-268.js` `dc44b698c3b511384d…`,
  `modules/generation-surface.js` `6ce61c18ea9af0613f66…`,
  `modules/entry-genpkg1.js` `f882feb17932a53603a8…` (export list only);
  the other six delta paths are byte-identical to round 0. Round 2 changed
  exactly one delta file: `modules/generation-surface.js`
  `82677469add174d6…` (rejection wording for the three round-2 server
  reasons); the other eight delta paths are byte-identical to round 1.
  **Entry name and build marker unchanged** (`app-268.js` /
  `d5b-v2-generation-client-2`) — content-only corrections.
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
  view test): a stub halted_unknown plan renders "Stopped — a charge
  needs checking before it can continue", the settled line with its
  unconfirmed-charge qualifier, its lane, no retry/resume control, and
  zero submissions. *(Round-2 correction R2-3: the round-1 fixture
  reused the production Ch 2 halt's numbers and called itself that
  halt's "exact shape", presenting the $0.3537 grant-time estimate as
  a settled figure; the fixture is now clearly synthetic — see the
  Round-2 section. The round-1 run below passed with the old fixture;
  the corrected fixture passes in the round-2 runs.)* The stub now
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

## Round-2 corrections (Rowan round-2 source review, comment 6511950562)

Applied locally to the round-1 trees; **no deploy, no publication, no
production contact.** Rowan withheld round-2 sign-off on two residual
admission blockers (R2-1, R2-2) plus a test-fixture accuracy correction
(R2-3). This section is the correction record. Everything not named here
is untouched: the adapters, the 120 s timeout, `reconcileUnknown`
wiring, the parked Ch 3 fence logic, the entry, and the Shelf bridge
(re-verified `bc0a5879…` in the round-2 publish tree).

### R2-1 — phase authority derives from a server-held registry, not from caller history

**The defect.** Round 1's `admitPhase` derived a book's binding from the
phase of plans earlier callers had admitted. For an unbound book, first
use still originated with the caller: any book could claim the
`forever-pucked` envelope, and a book could run once unbudgeted and then
again under the phase (the round-1 suite asserted both as behavior).

**The mechanism (new module `worker/generation/phase-policy.mjs`).** A
server-held registry in the coordinator's own store — `d6_phase_bindings
(phase PRIMARY KEY, book_id, source, created_at, updated_at)` — one row
per budgeted phase naming the ONE book authorized to ride it. Following
the round-0 binding-projection precedent, the DDL lives in the module
(not in `GEN_SCHEMA` — the correction suites pin the bootstrap's table
set) and is ensured lazily: DDL-only, idempotent, no bootstrap reads.
The only writer is `recordPhaseBinding`, exposed on the service as
`bindPhaseBook`: insert-if-absent (same pair re-recorded = idempotent
no-op; a phase already bound to a different book =
`phase_binding_conflict` and the recorded binding stands; a
non-budgeted phase can never acquire a binding). **No client route
reaches the writer in this build, and nothing was recorded anywhere
outside test fixtures.**

**Establishment is the switch — the boundary, stated exactly.**
`admitPhase` reads the mode from SERVER STATE, never from the
submission:

- **Registry established (≥1 binding recorded):** the registry is the
  complete authority for every budgeted phase, on every path (direct
  service calls and the public entry alike — proven at entry level).
  A bound book's phase is DERIVED from its row: missing →
  `phase_required`; different → `phase_mismatch`. A book with no row
  cannot claim a budgeted phase: bound to another book →
  `phase_bound_to_other_book`; budgeted but unrecorded →
  `phase_unbound` (fail-closed; unreachable with today's single-phase
  registry once the FP binding is recorded, and the standing rule is
  that a phase enters the budget registry and the binding registry
  together). Invented phase → `phase_not_budgeted`; no phase →
  unbudgeted. First-use binding ceases to exist, and there is **no
  input field that selects the legacy rules** (adversarially tested
  with spoofed mode fields).
- **Registry empty (legacy mode):** the round-1 history derivation,
  preserved verbatim as `admitPhaseLegacy`. This is the explicit
  legacy/service-fixture behavior Rowan sanctioned: the existing D6
  suites stage two books under one phase inside registry-free fixture
  databases (`d6-service`, and `d6-correction` through the real DO
  route and the real entry — both verified by reading their flows
  before choosing this boundary), and a hardcoded production-book
  rule enforced in `submitIntent` would have broken them. No
  baseline suite was changed.

**Why state, not a code constant or an admission flag.** A constant
binding enforced on any path the fixtures exercise breaks
`d6-correction` (its C2/C3 fixtures submit fixture books under
`forever-pucked` through the real route/entry and expect admission);
an input-carried admission flag would be caller-spoofable through
the entry's intent forward. Server state is the only boundary that
is both fixture-preserving and unforgeable. **Deploy-gate obligation
(recorded here, not performed):** the gen-pkg-1 deploy gate records
the production pair — `forever-pucked` ↔
`5c589095-f812-48a2-8ab2-03ba2791f2b2` — BEFORE the client build is
published. Until that act, production admission remains under the
legacy rules, where Forever Pucked is already history-bound by its
admitted plans (the G10 smoke + Ch 2 plans); the registry replaces
that derivation with an independent one and widens nothing.
`capabilities()` now reports a phase's book from the registry when
established (even before any plan exists), falling back to the
round-1 plan-derived link in legacy mode.

### R2-2 — the active overlapping-occurrence fence

**The defect.** B2's semantics-in-identity stops silent substitution,
but two LIVE plans over the same eligible occurrences could both be
granted and both pay for the same content (the round-1 phase-authority
suite asserted keepGoing true/false submissions both creating active
plans over one set).

**The fence (`activeOverlapConflict`, inside `submitIntent`).**
Admission order: lane gate → phase admission → eligible-set build →
intent identity → **convergence** (a byte-identical retry returns its
own plan and never fences itself) → **fence** → plan insert. The
convergence lookup, the fence check, and the insert sit in one
synchronous stretch with no intervening await, so two racing
submissions cannot both pass (proven by the concurrency test). A new
intent whose eligible set intersects the eligible entries of any
non-terminal plan for the same book is rejected:

```json
{ "outcome": "rejected", "reason": "plan_overlap_conflict",
  "conflict": { "planId": "...", "bookId": "...", "scope": "chapter",
                "lane": "standard", "keepGoing": true,
                "phase": null, "overlapCount": 2 } }
```

The conflict names the EXISTING plan and its immutable semantics —
never the request's. **Which states fence:** every state the driver
can still grant against without a fresh operator decision — `active`
and the `parked_*` family (quota/cap/storage parks resume on their
own in `driveOnce`; tested for `parked_quota`). **Terminal states do
not fence:** `complete`, `partial`, and `halted_unknown` — a halted
plan grants again only after a gated unknown-billing reconciliation,
so it must not block a fresh intent; the fence only reads it, and the
suite asserts the halted plan's row and job links are byte-identical
after a fresh intent is admitted over its set (never resumed, never
altered, no grants). Non-overlapping sets still admit — including
beside an active plan — so later runs over newly eligible segments
stay possible once prior owners are terminal. The parked Ch 3 JOB is
a different mechanism: its occurrences never enter an eligible set
(the builder's `excluded_parked`/`excluded_ch3` dispositions are
unchanged), so they can neither fence nor be fenced; the suite
asserts the parked job's rows are byte-identical across an admission
and a fenced rejection, with its state still `parked_policy`. A
batch-shaped request meets the `lane_not_allowed` gate before the
fence ever sees it (documented ordering, tested both with and without
an active overlapping plan).

**Client wording.** `rejectionText` gains entries for the three new
reasons (`phase_bound_to_other_book`, `phase_unbound`,
`plan_overlap_conflict`) — each ends "Nothing was started." GU11
covers all eight reasons.

**Round-1 genpkg1 suites amended where round-2 law superseded their
premises** (candidate suites, not baseline suites; each amendment is
commented in place):

- `genpkg1-phase-authority` — the binding-establishment and
  keepGoing tests asserted second same-set plans minting beside an
  active first plan. They now assert the fence rejection first
  (naming the first plan's semantics), then mint the distinct plan
  once the first is terminal; their B1/B2 subjects are unchanged.
- `genpkg1-intent-idempotency` — the newly-eligible-segments test
  asserted an expanded set minting a new plan while the first plan
  was still active over the shared segment. It now asserts the
  fence's named conflict while the first plan is active, drives the
  first plan to a REAL completion (executor path), and then mints
  the new plan whose eligible work is the newly eligible segment
  (the completed plan's segment reads `bound_already`). Obligation
  3's guarantee — a later intentional run is never swallowed by a
  stale plan — is preserved; what changed is that an overlapping
  run waits for the active owner to finish instead of duplicating
  its spend surface.

All pre-existing (baseline) suites were read before the design was
chosen and needed no changes: their multi-plan flows are
same-intent convergences, different books, or post-completion runs.

### R2-3 — GP-14 fixture accuracy

The round-1 GP-14 fixture reused the production Ch 2 halt's numbers —
`settledMicroCents: 353736` — and called itself that halt's "exact
shape". Per the Ch 2 diagnosis, $0.3537 was the GRANT-TIME
ESTIMATE/debit, not known-settled spend; presenting it as settled was
wrong. The fixture is now clearly synthetic: plan id
`plan-halted-synthetic`, totals `{eligible: 12, done: 4, failed: 2}`,
and `settledMicroCents: 300000` (a round $0.30), with the unconfirmed
charge represented separately — by the `halted_unknown` state and its
qualifier text — never folded into the settled figure. GU13's
halted_unknown case uses the same synthetic figure. GP-14 renders
"Settled $0.30 so far — plus a charge that isn't confirmed yet". A
repo-wide grep confirms no test or report text presents $0.3537 as
settled/provider spend anywhere (its two remaining mentions — the
GP-14 correction comment and the round-1 money section — both frame
it explicitly as the grant-time estimate). A real Ch 2 display waits
on the attempt-log accounting the diagnostics surface reads; nothing
here fabricates it.

### New and amended tests (all on the round-2 final trees)

- **Worker** `tests/genpkg1-phase-policy.test.mjs` — **10/10**:
  capabilities derives the phase→book link from the registry before
  any plan exists; mapped book + correct phase admitted (plan stores
  the registry phase); mapped book + null → `phase_required`, +
  different → `phase_mismatch`, both with plan/ledger/attempt/grant
  counts provably unchanged; unrelated book's forged `forever-pucked`
  → `phase_bound_to_other_book` (counts unchanged, binding stands);
  unbound book unbudgeted admitted / invented phase →
  `phase_not_budgeted`; spoofed mode fields change nothing;
  `bindPhaseBook` idempotence, conflict, budget and shape validation;
  legacy mode preserved (two books share a phase in a registry-free
  database; history binding governs afterwards); and an entry-level
  test through the REAL public path (production entry + D6 class,
  halt="1"): after the binding row is recorded in the DO store, the
  mapped book is admitted and both the forged claim and the
  missing-phase submission are rejected over the wire, creating
  nothing.
- **Worker** `tests/genpkg1-overlap-fence.test.mjs` — **10/10**:
  keepGoing change fenced with the existing plan's semantics named;
  identical retry converges; non-overlapping segment run admits
  beside an active chapter plan and then fences the overlapping
  chapter run; book scope fenced by an active chapter plan;
  batch-shaped requests meet the lane gate first (with and without
  an active plan); `complete`/`partial` do not fence;
  `halted_unknown` does not fence and is byte-identical afterwards;
  `parked_quota` fences; two racing different-semantics submissions
  create exactly one plan and one job set; the parked Ch 3 job is
  byte-identical across an admission and a fenced rejection and is
  never resumed.
- **Client unit** — store battery **13/13**; generation unit
  **13/13** (GU11 extended to all eight rejection reasons; GU13 on
  the synthetic figure).
- **Chromium proof** — **14/14 PASS, 0 page exceptions** on tree-a
  AND on `package/publish` (GP-14 on the corrected synthetic
  fixture). Disclosure: the builder's first two package-tree
  attempts served the WRONG tree (`GEN_TREE=../package/publish`
  resolves outside `gen/` — the ui-pkg-4 package tree — so the app
  under test was the old playback build and every row failed at
  boot); both logs are preserved
  (`logs/round2/client-chromium-package-first-run.log`,
  `client-chromium-package-wrong-tree-run.log`) and the corrected
  invocation (`GEN_TREE=package/publish`) passed 14/14 in 24 s.
  The trees themselves are byte-identical (verified by recursive
  diff), so no product behavior was ever in question.
- **Package static checks: ALL PASS** on the round-2 tree (publish =
  base + 9-path delta exact; the round-2 delta within the delta is
  `modules/generation-surface.js` only; bridge SHA pinned and
  independently re-verified
  `bc0a5879fbf4a6f455170ead8e0fbe1aa19d82126df4eb631bd0ebad9112ec8e`).

### Battery (round-2 final trees)

- Worker: **118 suite files: 96 pass / 22 fail** — the failing set is
  byte-identical to the recorded 22-name baseline (20 legacy-fixture
  ENOENT + 2 git-required envelope suites); zero assertion failures
  anywhere (896/918 tests pass; the two new suites add 20 tests,
  all passing, inside the 96). Logs:
  `~/workspace/gen-pkg-1/logs/round2/worker-final/`.
- Tree hashes (same digest method as round 1): worker
  `6685e7f91f219b80b935883be1a7bdf23f7bad169cc05e42c9bac2892fdac66c`
  (372 files); client publish
  `a84344d43b12b17d47763e8ada1f119609a91c5a1a510dac34ea8355de9321d5`
  (81 paths).

## Round-3 corrections (Rowan round-3 source review, comment 6512804398)

Rowan's round-3 review resolved R2-1-after-binding, R2-2's
active/parked fence, and R2-3, and withheld sign-off on two
blockers. Both are corrected here. Nothing in this round was
deployed, published, or recorded against production: the FP
binding exists only in test fixtures, and no production plan
was reconciled, retired, retried, or driven.

### R3-1 — the phase-policy bootstrap fails CLOSED in production, and the recording path is operable

**The hole.** Round 2 selected the permissive legacy history
rules whenever `d6_phase_bindings` was empty — a state reachable
through the public production `/v2/commands` route — and the
only writer (`bindPhaseBook`) had no route in the pinned entry,
so the planned recording act was not operable as written and
the legacy window would have been open exactly while it was
performed.

**The boundary mechanism.** Enforcement is now a CONSTRUCTION
property of the service. `createGenerationService` takes a
`phasePolicyMode` option (default `"legacy"`). The production
entry's single service-construction site (`d6Service` in
`worker/worker-entry-prod-d6.js`) derives it from the deployment
configuration: `phasePolicyMode: env.OPALREADER_PHASE_POLICY ===
"enforce" ? "enforce" : "legacy"`, and the pinned deploy spec
(`worker/p8/deploy-spec-prod-d6.json`) gains the plain-text
binding `OPALREADER_PHASE_POLICY = "enforce"` (plus a `d6_delta`
entry and a deploy-gate arming precondition recording the
sequence below). This is the trusted server-side boundary
Rowan required, and it is the same kind of boundary this
codebase already uses for every other production property —
scope, instance, the halt flag, the storage base, and both
credentials are all deploy-configuration, never request data.
No request, command, or intent field can select the mode:
`submitIntent` destructures its known inputs only, and the mode
is fixed at construction from the server's own configuration.
Direct construction (every test fixture, the legacy D6 suites)
keeps the `"legacy"` default, which is exactly what preserves
the baselines: the fixture envs that submit through the real
entry (d6-correction C2/C3/C5) never set the var, so they run
the legacy construction they were written against, unchanged.

**Enforce-mode semantics.** In an enforcement-bound
construction the registry rules govern from the first served
request, registry empty included (`admitPhase` consults the
legacy rules only when the construction is non-enforce AND the
registry is unestablished):

- a submission naming a budgeted phase (per
  `PHASE_BUDGET_MICRO_CENTS`) with NO recorded binding for that
  phase is rejected `phase_unbound` — fail closed, no plan, no
  ledger/attempt/grant movement, and no binding written by the
  submission (first-use binding does not exist under
  enforcement, for the production book itself included);
- a binding naming a different book → `phase_bound_to_other_book`;
- the bound book with a missing/null phase → `phase_required`;
  with a different phase → `phase_mismatch`;
- an invented phase → `phase_not_budgeted`;
- a null phase with no budgeted claim keeps the round-1/2
  unbudgeted behavior (genuinely unbudgeted work is not
  blocked);
- `capabilities()` in enforce mode reports a phase's book from
  the registry row ONLY — the round-1/2 plan-history fallback is
  never presented as the phase's book under enforcement, so the
  capabilities view and admission cannot disagree in the
  carried-state window (production plans exist, binding not yet
  recorded): the phase reports `bookId: null` until the
  operator records the binding.

**The recording route.** `POST /v2/d6-phase-binding` (body
`{phase, bookId}`) is wired in the pinned entry in the
diagnostics/Option-D fence class, exactly: the production gate
skips the client token for it (admission is on the
migration-operator credential ALONE); the entry's operator
admission block refuses an unconfigured operator secret with
503 `migration_operator_not_configured` and a missing/wrong
operator credential with 403 `migration_operator_required`
(stamping `x-opalreader-operator-admitted` only on success, and
overwriting any client-supplied stamp unconditionally); the
internal `POST /internal/d6/phase-binding` refuses any request
without that stamp (403 `migration_operator_required`) — the
internal header + scope alone do not suffice, proven by direct
call. The route invokes `bindPhaseBook` with a SERVER-STAMPED
source (`"operator-route"`; a caller-supplied source is
ignored) and every response — applied, idempotent re-record,
and conflict refusal alike — carries the READ-BACK binding read
from the store via the new `getPhaseBinding` handle, so a
recording is verified from the server's own state and a refusal
shows the binding that stands. Same pair → success no-op
(`changed:false, idempotent:true`); different book for a bound
phase → `phase_binding_conflict`, original stands. No client
route reaches it: the everyday client token alone is refused
403, proven at entry level.

**The deploy-time sequence this enables.** New Worker (with
`OPALREADER_PHASE_POLICY=enforce` in its bindings) serves →
budgeted admission fails closed from the FIRST request → the
operator records `forever-pucked` ↔
`5c589095-f812-48a2-8ab2-03ba2791f2b2` through the route under
Julie's separate deploy authorization, verified by read-back →
client publication follows. There is no window — before,
during, or after the recording — in which a production
construction applies the legacy rules. (The upload envelope is
re-derived from the updated spec at that gate, as always; the
spec's binding count is now seven.)

### R3-2 — halted_unknown fences until explicitly cleared

**The fence change.** `PLAN_FENCE_TERMINAL` is now
`["complete", "partial", "retired"]`: a `halted_unknown` plan
fences its overlapping eligible occurrences exactly like an
active/parked plan — rejection `plan_overlap_conflict` naming
the halted plan and its semantics (the round-2 conflict shape
is unchanged: planId, bookId, scope, lane, keepGoing, phase,
overlapCount). Convergence still runs first, so the halted
plan's own identical resubmission returns the halted plan
(`created:false, state:"halted_unknown"`) rather than a
conflict. Non-overlapping submissions remain admissible.
`complete`/`partial` remain non-fencing.

**The clearance mechanism.** Clearance is an explicit
two-step operator act, never an inference:

1. **Reconcile** the plan's unknown attempts — the pre-existing
   `genstore.reconcileUnknown`, now also exposed on the service
   as `reconcileUnknownAttempt` (applied/rejected shapes like
   `bindPhaseBook`). When the phase's last open unknown
   resolves, the PHASE halt clears in the same transaction —
   and that is ALL it does: the plan stays `halted_unknown` and
   keeps fencing (proven: submissions after reconciliation +
   halt flip are still rejected).
2. **Retire** the plan — `retireHaltedPlan({planId, note,
   source})`: refuses a missing plan (`plan_not_found`), any
   non-halted state (`plan_not_halted_unknown`), and —
   critically — any plan whose own confirmed/unknown attempt
   rows are still open (`unknown_billing_open` + count), so
   retirement can never paper over an unresolved charge. On
   success, ONE transaction writes the audit row (new
   lazily-ensured table `d6_plan_retirements`, the
   phase-bindings precedent — deliberately not in GEN_SCHEMA,
   and ensured only on the retire path so store snapshots in
   the correction suites are unaffected) and moves the plan to
   the new terminal state `retired` with stop reason
   `retired_unknown_billing`. `driveOnce` never selects a
   retired plan.

The retirement IS routed — `POST /v2/d6-retire-halted-plan` →
internal `/internal/d6/retire-halted-plan` under the identical
operator fence class as the binding route — so this round
cannot repeat the "mechanism unreachable in the pinned entry"
defect; the per-attempt reconciliation handle is service-level
only, because per-attempt reconciliation is pre-existing D6
machinery with its own suites and operator surface decisions
belong to the fix-package gate, whereas plan-ownership
clearance was the missing operable act. Exercising either
against any production plan remains Julie's separate
authorization; both are exercised here only in fixtures.

**Client (one small correctness change).** The client must not
treat a retired plan as live: `TERMINAL_PLAN_STATES` gains
`"retired"` (it drives live-plan detection/rerouting in the
shell), `planStatusText` renders it as a closed run, and
`STOP_REASON_TEXT` gains `retired_unknown_billing`
("the charge was checked and the run was closed"). GU8 asserts
all three.

### New and amended tests (round-3 final trees)

- **`genpkg1-phase-enforce.test.mjs` (new, 11/11)** — service
  level: enforce + registry absent → `phase_unbound` for the
  production book's own claim and an unrelated book's claim,
  `phase_not_budgeted` for an invented phase, zero state
  movement; null-phase unbudgeted admission preserved; the
  legacy-construction contrast (same claim admitted); enforce
  `capabilities` reports registry-or-null against a store whose
  plans carry the phase. Entry level, through the REAL
  `D6Entry.fetch` + production DO class with the enforce
  deployment configuration: registry absent → client claims on
  `forever-pucked` rejected fail-closed over `/v2/commands`
  (0 plans / 0 ledger / 0 grants in the DO store); the
  recording route refuses no-credential, client-token-only, and
  wrong-operator calls (403), fails closed when the operator
  secret is unconfigured (503), and refuses a direct internal
  call without the stamp (403); the operator records
  `forever-pucked` → `5c589095-f812-48a2-8ab2-03ba2791f2b2`
  (the real production book id, as a fixture identifier over
  synthetic content) → read-back matches with the server-stamped
  source; re-record is idempotent; a conflicting book is refused
  with the standing binding shown; after binding, the mapped
  book is admitted and the phase is closed to everyone else
  (`phase_bound_to_other_book`, `phase_required`); and the
  no-enforce contrast world keeps the legacy bootstrap through
  the same entry.
- **`genpkg1-halted-fence.test.mjs` (new, 6/6)** — the halted
  plan is built through the REAL machinery (submit → drive →
  grant → execution → reserved → dispatching →
  confirmed/unknown → `markUnknownBilling` → drive →
  `halted_unknown`/`phase_halted_unknown_billing`, the Ch 2
  shape with synthetic data): identical resubmission converges
  on the halted plan; different-keepGoing and different-scope
  submissions from a second service instance ("two devices")
  are both rejected `plan_overlap_conflict` naming the halted
  plan, with zero new plans/grants/attempts and the halted
  plan's rows + the execution record byte-identical;
  non-overlapping segment admission still works beside a halted
  chapter plan; retirement before reconciliation is refused
  (`unknown_billing_open`); after reconciliation the fence
  SURVIVES (clearance not inferred from reconciliation or the
  phase-halt flip); retirement then applies with its audit row;
  retirement refuses unknown/non-halted plans by name; after
  retirement a fresh submission over the same occurrences is
  admitted and drives, and the retired plan's row stays
  byte-identical across further drives; the parked Ch 3 job and
  its occurrence rows are byte-identical throughout the whole
  lifecycle, still `parked_policy`, never in any plan's eligible
  set.
- **`genpkg1-overlap-fence.test.mjs` (amended, 10/10)** — the
  round-2 halted test's premise is REVERSED per R3-2, with the
  reversal disclosed in place (header bullet + amendment note
  on the test): it now asserts the fresh different-semantics
  intent is rejected `plan_overlap_conflict` naming the halted
  plan, while keeping round 2's other half — the halted plan's
  row/jobs byte-identical, no grants for it. This is a
  candidate suite, not a baseline suite; no baseline suite was
  edited.
- **`generation-unit.mjs` GU8 (extended)** — retired terminal
  membership + closed-run status text, as above.

### Battery (round-3 final trees)

- Worker: **120 suite files: 98 pass / 22 fail** — the failing
  set is BYTE-IDENTICAL to the recorded 22-name baseline (same
  file, same order: 20 legacy-fixture ENOENT + 2 git-required
  envelope suites); **zero assertion failures** anywhere
  (913/935 tests pass; the two new suites add 17 tests, all
  passing, inside the 98; the amended fence suite stays 10/10).
  Logs: `~/workspace/gen-pkg-1/logs/round3/worker-final/`.
- Client: store unit battery **13/13**; generation unit
  **13/13**; Chromium proof **14/14 with 0 page exceptions** on
  tree-a AND on `gen/package/publish` (the canonical publish
  tree). Logs: `~/workspace/gen-pkg-1/logs/round3/`.
- Shelf bridge SHA-256 re-verified in the publish tree after
  the client rebuild: `modules/vendor/client/shelf-bridge.js` =
  `bc0a5879fbf4a6f455170ead8e0fbe1aa19d82126df4eb631bd0ebad9112ec8e`,
  byte-identical, as required.
- Tree hashes (same digest method as rounds 1–2): worker
  `5a40c0c935aa1042c1cc8dc729e15ebe97f014864e9ef4b9948181c5106e18fe`
  (374 files — 372 + the two new suites); client publish
  `365ecbddf0bc17066c1eed5a6349735a290070482a50cddccda96c7a1e31dbd8`
  (81 paths; moved from round 2 only by the
  `modules/generation-surface.js` retired handling).

### Disclosures

- The deploy-spec edit adds a seventh binding; no baseline
  suite asserts this spec's binding count (d6-correction's spec
  assertions are targeted and pass unchanged), and the two
  envelope suites that validate emitted upload metadata fail at
  baseline for an unrelated environmental reason (they require
  a git repository) — unchanged by this round.
- Two assertions in the new halted-fence suite were corrected
  during authoring before first green — both were test-premise
  errors, not code defects: the non-overlap probe must carry
  the book's phase (a null-phase submission for a history-bound
  book is `phase_required` by design), and parked segments
  appear in plan entries as EXCLUDED rows (the fence/driver
  read eligible entries only), so the parked assertion checks
  eligibility, not row absence.
- `retireHaltedPlan`'s audit table is created lazily inside
  the retire path only; a store that never retires a plan
  never grows it, and the correction suites' schema snapshots
  (taken at construction) are unaffected — verified by the
  battery above.
- Nothing was deployed, published, or recorded against
  production in this round; the production registry remains
  unwritten, the Ch 2 halt and the parked Ch 3 job are exactly
  as they were, and the deploy-gate sequence above still
  requires Julie's separate authorization at each step.

## Round-4 corrections (Rowan round-4 source review, comment 6513553263)

Rowan's round-4 review verified the round-3 corrections and
withheld sign-off on two remaining blockers. **R4-1 is
corrected and fully verified below. R4-2 is NOT implemented:
both shapes Rowan specified were tested empirically and both
break the baseline D6 continuity suite, so the work STOPPED
at that fix under the standing constraint (a fix that breaks
a baseline suite stops and reports; baseline suites are never
edited silently) — the evidence and the decision required are
recorded in full.** Nothing in this round was deployed,
published, or recorded against production; no production plan
was reconciled, retired, retried, or driven; the entry file
is byte-identical to round 3.

### R4-1 — halted_unknown is an enduring driver-level stop

**The defect (as Rowan found it).** Round 3 made
`halted_unknown` fence at ADMISSION, but the DRIVER still
selected halted plans: `driveOnce()` picked every plan whose
state was not complete/partial/retired, and once
`reconcileUnknownAttempt` cleared the phase's last
unknown-billing flag, the driver's phase-halt check passed
and it flipped the plan back to `active`
(`plan.state === "halted_unknown"` → `setPlanState(...,
"active", null)`) and continued into grant/outbox dispatch —
silently ending the halt on the next alarm, without
`retireHaltedPlan` or any explicit act, and potentially
making a later retirement fail `plan_not_halted_unknown`.
The round-3 halted-fence suite never invoked `driveOnce`
between reconcile and retire, so the gap was invisible to it.

**The fix** (`worker/generation/service.mjs`, `driveOnce`
only). `halted_unknown` is excluded at SELECTION:
`WHERE state NOT IN ('complete', 'partial', 'retired',
'halted_unknown')`, and the reactivation flip is deleted —
there is no code path in the driver that selects, mutates,
reactivates, grants for, or dispatches a halted plan, on any
pass, however often the alarm fires. The ONLY transition out
of `halted_unknown` remains `retireHaltedPlan` (to `retired`,
itself terminal in the driver); any later restart over the
plan's occurrences requires a fresh approved intent under all
fences. Phase-level handling for OTHER plans is unchanged: a
selected plan whose phase is halted still transitions INTO
`halted_unknown` and stops — the exclusion governs plans
already halted, never the act of halting. `recover()` needed
no change (an unknown_billing execution classifies as
`reconcile_hold`; recovery performs no action on it).

**The test** (`genpkg1-halted-fence.test.mjs`, one ADDITIVE
test + a header amendment note — a candidate suite; now
7/7). The halted plan is built through the real machinery
(chapter scope over ch-1), then, in the exact interleaving
round 3 missed: reconcile the final unknown (phase halt
clears — the dangerous window) → `driveOnce()` three times
plus one full alarm cycle (`recover()` + `driveOnce()`) →
the halted plan is not even present in any drive's outcomes;
its plan row, plan jobs, grants, attempt log, execution
records, outbox, and phase accounting are BYTE-IDENTICAL /
unchanged; the admission fence still rejects an overlapping
submission naming it → a non-overlapping plan in the SAME
(now un-halted) phase is admitted and DRIVES normally in the
same window, with the halted plan still byte-identical →
retirement AFTER the drives APPLIES (no
`plan_not_halted_unknown`) → the retired plan remains inert
under further drives → the parked Ch 3 job and its
occurrences are byte-identical throughout.

**Negative control.** With the round-3 driver shape
temporarily restored (selection without the exclusion + the
flip), exactly the new R4-1 test fails and all six round-3
tests still pass — which is precisely how the defect
survived round 3. The fix was then restored and the suite
re-verified 7/7.

### R4-2 — STOPPED: both specified shapes break the baseline continuity suite (decision required)

**The requirement.** The production entry's `d6Service`
selects the phase-policy mode from
`env.OPALREADER_PHASE_POLICY === "enforce"`, so a missing,
changed, or omitted binding at deploy time silently restores
legacy admission. Rowan's shapes: enforce unconditionally in
production construction, OR reject all D6 submission with a
503/configuration error whenever the value is not exactly
`"enforce"`.

**The experiment (performed, then fully reverted).**
Unconditional enforcement was implemented in `d6Service`
(shape 1) and the entry-touching suites were run:

- **`d6-correction` (BASELINE): 3 of 5 tests FAIL — C2, C3,
  C5.** All three stage a budgeted `forever-pucked` intent
  through the REAL production entry/class against an EMPTY
  registry and assert admission (`created: true`; C2 via the
  class's `/internal/d6/intent` route, C3 via the public
  `/v2/commands` route, C5 via the public route + the real
  class alarm, which then dispatches 0 grants instead of 1).
  Under enforcement the submissions are rejected
  `phase_unbound` — first-use admission is exactly what these
  tests exercise. C2/C3/C5 are the D6 CONTINUITY proofs over
  carried, production-shaped state; they predate phase policy
  entirely, and their fixture envs carry no
  `OPALREADER_PHASE_POLICY`.
- `genpkg1-phase-enforce` (candidate): its round-3
  fixture-contrast test fails, as expected — that suite is
  amendable, and is not the blocker.
- Everything else entry-touching passes unchanged
  (d6-correction2 10/10, d6-seed-hardening 12/12,
  genpkg1-phase-policy 10/10, genpkg1-diagnostics 9/9).

Shape 2 (503 on submission whenever the flag is not exactly
`"enforce"`) refuses the IDENTICAL submissions — C2/C3 assert
HTTP 200 + `created: true` on them and C5 asserts the
dispatch — so the same three baseline tests fail; a
construction-throwing variant breaks strictly more (every
flag-less fixture world that constructs the service for any
route). The experiment was reverted completely: the entry is
byte-identical to round 3 (SHA-256 `9bfe48e404fbdf0bb741…`),
and d6-correction + genpkg1-phase-enforce re-verified green
after the revert.

**Why an env flag on the fixtures would not fix C5.** C5
submits TWO books (`book-a`, `book-b`) claiming the SAME
budgeted phase through the entry. Registry law binds one
phase to ONE book: even with a binding recorded in-fixture,
the second book's claim is `phase_bound_to_other_book` (and
`phase_unbound` before any recording). C5's premise — two
books sharing one budgeted phase via legacy history rules —
is the behavior the registry law exists to forbid, so C5
needs re-staging (distinct phases, or unbudgeted intents),
not just a deployment flag.

**The decision required (Rowan's / Julie's).** Either
(a) authorize a DISCLOSED amendment of the d6-correction
fixture worlds (record the binding in-fixture for C2/C3;
re-stage C5's phase usage) as an explicit baseline-suite
change owned by that authorization — the suites would then
stage the enforce deployment shape they currently omit; or
(b) Rowan specifies a different production-construction
boundary that pre-policy fixture worlds do not trip. Until
one is chosen, the round-3 construction stands, with its
known residual, stated plainly: runtime admission depends on
the deployment carrying `OPALREADER_PHASE_POLICY=enforce`.
The mitigations already in place are the ones the deploy
gate owns: the pinned spec carries the binding, and the
spec's arming preconditions require confirming `enforce` in
the deployed bindings by read-back BEFORE the binding
recording and client publication. Rowan's request to update
deploy-envelope validation for the binding is noted as part
of whichever resolution is chosen (the validator,
`tools/validate-prod-envelope.mjs`, has no phase-policy
handling today). The deploy-spec binding itself is unchanged
this round, as instructed.

### Battery (round-4 final trees)

- Targeted: `genpkg1-halted-fence` **7/7** (incl. the new
  R4-1 interleaving test + negative control above);
  entry-experiment tallies as recorded under R4-2.
- Worker full battery, one complete clean run on the exact
  final tree: **120 suite files: 98 pass / 22 fail — the
  failing set is BYTE-IDENTICAL to the recorded 22-name
  baseline; 936 tests: 914 pass; zero assertion failures.**
  (936 = round 3's 935 + the one new R4-1 test.) Logs:
  `~/workspace/gen-pkg-1/logs/round4/worker-final/`.
  DISCLOSED FLAKE: the first round-4 battery run failed one
  additional suite, `p8-d3-resource-proofs`, on its RSS-delta
  assertion (129.6 MiB measured vs the pinned 128 MiB
  threshold — a memory-pressure artifact of the long
  sequential run; the suite exercises the pre-D6 migration
  import path, untouched by this round). It passes 2/2 in
  isolation and passed in the clean re-run; the flaked run's
  summary + failing list are preserved at
  `~/workspace/gen-pkg-1/logs/round4/worker-run1-flaked/` and
  pinned alongside the final logs.
- Client: NO client change this round. Batteries re-run on
  the unchanged trees: store unit **13/13**; generation unit
  **13/13**; Chromium proof **14/14 with 0 page exceptions**
  on tree-a AND on `gen/package/publish`. Logs:
  `~/workspace/gen-pkg-1/logs/round4/`. Shelf bridge
  re-verified in the publish tree: `bc0a5879…`, byte-identical.
- Tree hashes (established digest method): worker
  `1dc883adc71661e31cb6a510a1a87ab9272ccfd3eb91556f79072433662a3056`
  (374 files — same count as round 3; the delta is exactly
  `worker/generation/service.mjs` (R4-1; SHA-256
  `b5c644043eb4199147…`) and
  `tests/genpkg1-halted-fence.test.mjs` (SHA-256
  `0f0227113c97229d1f…`)); client publish
  `365ecbddf0bc17066c1eed5a6349735a290070482a50cddccda96c7a1e31dbd8`
  (81 paths — IDENTICAL to round 3, proving the client tree
  is untouched).

### Disclosures

- **R4-2 is unresolved and needs a decision (above).** The
  pinned build therefore still contains the round-3
  env-selected phase-policy construction Rowan flagged; it
  is pinned unchanged deliberately, with the evidence, rather
  than with a silent baseline edit or a red battery.
- The only candidate-suite amendment this round is the
  halted-fence suite's additive R4-1 test + header note. No
  baseline suite was edited.
- Nothing was deployed, published, or recorded against
  production in this round; the production registry remains
  unwritten, the Ch 2 halt and the parked Ch 3 job are
  exactly as they were.

## Round-5 corrections (R4-2) (Rowan round-5 ruling, comment 6514899384; Julie's approval, comment 6522602149)

Applied locally to the round-4 trees under Julie's explicit
approval of Rowan's option (a) — the repo-only R4-2 correction,
including the disclosed `d6-correction` fixture modernization
and the bootstrap gate. **No deploy, no publication, no
production contact, no production binding recorded, no
reconciliation/retirement, no Ch 2 retry, no Batch arming, no
generation, no spending.** The R4-1 correction (round 4) is
untouched and remains in the tree. The client is UNCHANGED
(publish tree hash identical to rounds 3/4 — see Battery).

### Item 1 — unconditional enforcement at the production entry

**Where it lives.** `worker/worker-entry-prod-d6.js`:

- `d6Service` now constructs the generation service with
  `phasePolicyMode: "enforce"` UNCONDITIONALLY. The round-3
  derivation (`env.OPALREADER_PHASE_POLICY === "enforce" ?
  "enforce" : "legacy"`) is deleted: no missing, omitted, or
  mistyped deployment value can silently select legacy
  admission through the real production entry, ever. Direct
  service construction (fixtures, the legacy D6 suites) keeps
  its explicit `"legacy"` default for historical-compatibility
  tests — that path never reaches this entry.
- The class's `/internal/d6/intent` route — the one route
  that creates generation work — additionally returns an
  explicit configuration failure, HTTP **503
  `{error: "phase_policy_not_configured"}`**, whenever
  `OPALREADER_PHASE_POLICY` is not exactly `"enforce"`,
  before any service call. A misconfigured deployment fails
  loudly at submission time instead of admitting under the
  wrong rules. All other D6 routes (reads, diagnostics, the
  operator surfaces, the seed) are unaffected by the check.
  Both halves of Rowan's item 1 are implemented (unconditional
  enforcement AND the explicit failure), not just one.

### Item 2 — the bootstrap gate (all intents refused while the required binding is absent)

**Where it lives.** `worker/generation/service.mjs`,
`admitPhase`, ahead of both the legacy and registry paths:

```js
if (enforcePhasePolicy && !phaseRegistryEstablished(coord))
  return { ok: false, reason: "phase_binding_required" };
```

Under an enforcement-bound construction, while the phase→book
registry is EMPTY, **every** new generation intent is refused
with reason **`phase_binding_required`** — budgeted phase,
invented phase, and null phase alike, for any book, including
the budgeted book itself — with zero plan/ledger/attempt/
grant movement. Round 3's enforce mode admitted a null-phase
intent in that window, which could have created an unbudgeted
plan for the real Forever Pucked book before its binding was
recorded; that hole is closed. The gate is narrow: the moment
any binding is recorded, the registry rules govern as before
(bound book held to its phase: `phase_required` /
`phase_mismatch`; another book claiming the bound phase:
`phase_bound_to_other_book`; an unrecorded budgeted phase:
`phase_unbound`; invented phase: `phase_not_budgeted`;
genuinely unbudgeted books: admitted with phase null). The
operator-only binding writer (`bindPhaseBook` /
`POST /v2/d6-phase-binding`) never passes through `admitPhase`
and remains fully usable while admission is gated — proven at
entry level (the recording route answers 200 and the binding
lands while every submission is refused).

**Entry-level proof** (`tests/genpkg1-phase-enforce.test.mjs`,
amended candidate suite, **12/12** — see the suite-amendment
note under Item 3's sibling list below): (a) missing flag →
the whole matrix (FP budgeted / FP null / other budgeted /
other null / invented) fails **503
`phase_policy_not_configured`**, zero plans/ledger/grants;
(b) mistyped flag (`"enfore"`) → the identical matrix, the
identical 503, zero movement; (c) exact `enforce` + empty
registry → **all** submissions refused
`phase_binding_required`, zero movement, then the operator
records the binding through the gated window and unbudgeted
work flows; (d) after the (synthetic, in-fixture) binding:
FP + correct phase admitted, FP + null phase →
`phase_required`, unrelated unbudgeted work admitted,
another book claiming FP's phase →
`phase_bound_to_other_book`. The service-level half of the
same matrix runs against direct enforce construction in the
same suite.

### Item 3 — d6-correction fixture modernization (the disclosed baseline change)

ONLY `tests/d6-correction.test.mjs` among baseline suites was
changed, exactly as authorized. **Test count unchanged: 5
tests (C1–C5) before and after. No assertion was deleted,
skipped, or lowered** — replacements are asserted in stronger
form (details below). A shared fixture helper,
`recordFixtureBinding(storage, db, phase, bookId)`, records
the authorized binding in the synthetic DO setup: the
production module's own `ensurePhaseBindingSchema` DDL plus
one row (source `"d6-correction-fixture-r5"`), the same
fixture-scale pattern the round-2 candidate suite established.

- **C1 — unchanged.** (Class identity + deploy-spec
  assertions; it submits nothing.)
- **C2 — before:** the post-D6 class was constructed with a
  flag-less env, and the book intent (`book-fix`,
  `phase: "forever-pucked"`) was admitted by first use under
  the legacy history rules against an empty registry.
  **After:** the post-D6 env carries
  `OPALREADER_PHASE_POLICY: "enforce"`, and the binding
  `forever-pucked ↔ book-fix` is recorded in the DO setup
  AFTER the bootstrap snapshot/table-set assertions (so the
  D6-bootstrap assertions are untouched) and BEFORE the
  intent. Every continuity assertion — pre-existing rows
  byte-identical, the eight added tables empty, settings
  still revision 0, plan job granted against carried state,
  parked rows untouched — stands exactly as before.
- **C3 — before:** flag-less class env and entry env; the
  `book-host` intent with `phase: "forever-pucked"` admitted
  by first use. **After:** both envs carry
  `OPALREADER_PHASE_POLICY: "enforce"` and the binding
  `forever-pucked ↔ book-host` is recorded in setup before
  any submission. All preservation assertions (401/403 gate
  bodies, halted admission as durable state only, zero
  grants/dispatches/executions, 423 on internal execute,
  queue handler halting before the namespace) unchanged.
- **C4 — unchanged fixtures.** (It submits no D6 intent; its
  crafted-grant and batch-lane proofs are unaffected.)
- **C5 — before:** BOTH `book-a` and `book-b` submitted book
  intents claiming the SAME budgeted phase `forever-pucked`
  through the real entry — the two-books-one-phase premise
  the registry law exists to forbid — and the suite asserted
  plan B's dispatch, quota parking, restart continuity, and
  rollover on that basis. **After:** class envs (initial +
  restart) and the entry env carry
  `OPALREADER_PHASE_POLICY: "enforce"`; the binding
  `forever-pucked ↔ book-a` (the ONE authorized book) is
  recorded in setup. Plan A is unchanged (book-a under its
  phase). Book-b's claim on the phase is now asserted
  REJECTED over the real public route —
  `{outcome: "rejected", reason: "phase_bound_to_other_book"}`
  with exactly one plan in the store afterwards — and book-b's
  real plan is submitted UNBUDGETED (`phase: null`, admitted
  under the registry rules once established), with a new
  assertion that plan B's stored phase is null (it does not
  consume book-a's envelope). **C5's real proof obligations
  are preserved at full strength on plan B's unbudgeted
  plan**: one grant + exactly one dispatch for A; B parks at
  exactly 100 daily attempts with zero dispatches; a fresh
  class instance (worker restart) reads B's carried
  `parked_quota` state through the real entry; after the day
  boundary the alarm resumes B with exactly one dispatch,
  never re-sends a settled A occurrence, and B's plan row
  ends `active`. Nothing about the grant/alarm/continuity
  assertions was weakened — the phase each plan rides is the
  only premise that changed, plus the added theft-rejection
  assertions.

**Candidate-suite amendments required by the new law**
(disclosed; candidate suites only — the round-2/3 precedent;
no other baseline suite was touched):

- `genpkg1-phase-enforce` — **11/11 → 12/12.** Three premises
  superseded by Rowan's items 1–2, each amended in place and
  marked R5: the empty-registry enforce expectations
  (`phase_unbound` / `phase_not_budgeted` for named claims,
  null-phase admitted) are now the bootstrap gate's single
  `phase_binding_required` refusal for the whole matrix; the
  unbudgeted-admission behavior is asserted AFTER recording
  (plus FP-null → `phase_required`, FP-correct admitted,
  forged → `phase_bound_to_other_book`); the round-3 contrast
  test ("no enforce setting → legacy bootstrap through the
  entry") is replaced by two tests (missing flag, mistyped
  flag) asserting the 503 matrix. The legacy-construction
  service test (direct construction keeps legacy rules) is
  retained unchanged.
- `genpkg1-phase-policy` — **10/10, count unchanged.** Its
  entry fixture now carries the deployment flag (both envs),
  its boot step asserts the round-5 gated refusal instead of
  a legacy admission, and the unrelated book's unbudgeted
  admission is asserted after the binding is recorded; the
  final plan-count assertion is unchanged.
- `genpkg1-envelope-policy` — **NEW, 5/5** (Item 4 below).

Every other entry/service-touching suite passed UNCHANGED
against the new construction (verified in the targeted run:
`genpkg1-diagnostics` 9/9, `d6-seed-hardening` 12/12,
`d6-correction2` 10/10, `genpkg1-phase-authority`,
`genpkg1-overlap-fence`, `genpkg1-halted-fence` 7/7 — the
R4-1 proof intact — `genpkg1-intent-idempotency`,
`genpkg1-projection`, `genpkg1-surfaces`, `d6-service`,
`d6-integration`). No STOP condition arose: nothing outside
the authorized fixture set needed editing.

### Item 4 — the seventh binding is gated in the envelope validator

`tools/validate-prod-envelope.mjs` gains two checks that run
BEFORE the dist inputs (so a bad spec fails the gate even
with no dist present), reading the D6 successor's deploy spec
(`worker/p8/deploy-spec-prod-d6.json`, overridable via the new
`--d6-spec <file>` argument) — the spec the gen-pkg-1 deploy
gate will re-derive the actual upload envelope from, so
gating the spec gates every envelope derived from it:

- **P6** — the spec carries exactly **7 bindings**, with
  `OPALREADER_PHASE_POLICY` present **exactly once**, as
  `plain_text` with text exactly `"enforce"` and no extra
  keys.
- **P7** — the binding set is exactly the specced seven
  (names + types; no duplicates, no extras).

The deploy spec itself gains one `d6_delta.changes` entry
recording the round-5 law (bindings unchanged — still the
same seven). **Failure proof, captured in
`~/workspace/gen-pkg-1/logs/round5/`:** the full validator
run against a real built dist (built from a throwaway git
copy of this exact tree, because the builder requires a git
worktree — the same environmental reason the two envelope
suites sit in the baseline failing set) **PASSES 26/26**
(`envelope-validator-full.log`; the 24 pre-existing
assertions + P6/P7); the same dist with a spec copy MISSING
the seventh binding **FAILS** (exit 1, `[FAIL] P6` +
`[FAIL] P7`, `envelope-validator-missing-binding.log`); with
a MALFORMED value (`"enfore"`) it **FAILS** (exit 1,
`[FAIL] P6`, `envelope-validator-malformed-binding.log`).
The new candidate suite `genpkg1-envelope-policy` (5/5)
exercises the same gate in the battery: real spec passes
P6/P7; missing, mistyped-value, wrong-type, and extra-eighth-
binding specs each fail with the expected check ids.

### Battery (round-5 final trees)

- Worker full battery, one complete run on the exact final
  tree (runner + logs:
  `~/workspace/gen-pkg-1/logs/round5/worker-final/`):
  **121 suite files: 99 pass / 22 fail — the failing set is
  BYTE-IDENTICAL to the recorded 22-name baseline**
  (verified by diff against the round-4 failing list; the
  baseline change is INSIDE `d6-correction`, which PASSES
  5/5 in its modernized form — it was never in the failing
  set). **942 tests: 920 pass; zero assertion failures.**
  Test-count delta vs round 4 (936): +6 = phase-enforce
  11→12 (+1) and the new envelope-policy suite (+5);
  `d6-correction` contributes the same 5 tests as before.
  No flakes this round; the single run is the clean run.
- Client: NO client change this round (as required — nothing
  in items 1–4 touches the client; the new server rejection
  reason `phase_binding_required` and the 503
  `phase_policy_not_configured` are submission-path shapes
  the client's existing safe-default rejection wording
  already covers). Batteries re-run on the unchanged trees:
  store unit **13/13**; generation unit **13/13**; Chromium
  proof **14/14 with 0 page exceptions** on tree-a AND on
  `gen/package/publish`. Logs: `~/workspace/gen-pkg-1/logs/round5/`.
- Shelf bridge re-verified in the publish tree:
  `modules/vendor/client/shelf-bridge.js` =
  `bc0a5879fbf4a6f455170ead8e0fbe1aa19d82126df4eb631bd0ebad9112ec8e`,
  byte-identical, as required.
- Tree hashes (established digest method): worker
  `2d16fe291dfa8d067fae82110089e501ca28bd93e80a047ac5efd0ffee840fb2`
  (375 files — round 4's 374 + the new envelope suite). The
  delta vs round 4 is exactly nine files: `worker/generation/
  service.mjs` (bootstrap gate; SHA-256 `700b8a8d67a813d3…`),
  `worker/worker-entry-prod-d6.js` (unconditional enforce +
  intent-route config check; `9cfd4c40a2549fc9…`),
  `worker/generation/phase-policy.mjs` (header note only;
  `09883c40e365815f…`), `worker/p8/deploy-spec-prod-d6.json`
  (one `d6_delta` line; `0dafd14c63d420f4…`),
  `tools/validate-prod-envelope.mjs` (P6/P7 + `--d6-spec`;
  `8ad59914d1f2a1934…`), `tests/d6-correction.test.mjs`
  (Item 3; `2ad7c7fc023db99b…`), `tests/genpkg1-phase-enforce.
  test.mjs` (amended; `fb23359f9313686a…`), `tests/genpkg1-
  phase-policy.test.mjs` (amended; `4071e38c47c3a2a96…`),
  `tests/genpkg1-envelope-policy.test.mjs` (new;
  `9dd890ee933317ea…`). Client publish
  `365ecbddf0bc17066c1eed5a6349735a290070482a50cddccda96c7a1e31dbd8`
  (81 paths — IDENTICAL to rounds 3/4, proving the client
  tree is untouched).

### Disclosures

- The intent-route configuration check reads the DO class's
  own env (`this.env`) — in production the entry env and the
  class env are one Worker env, and every fixture here sets
  both consistently. The check guards SUBMISSION only, by
  design: a misconfigured deployment still serves reads and
  the operator surfaces (including the binding writer, which
  is how the misconfiguration's companion defect — a missing
  binding — is repaired), while creating no generation work.
- The bootstrap gate's reason (`phase_binding_required`) and
  the config failure's error (`phase_policy_not_configured`)
  are new names introduced by this round; Rowan's ruling
  specified the behavior, not the strings. Both are asserted
  verbatim in the amended suites.
- Nothing was deployed, published, or recorded against
  production in this round; the production registry remains
  unwritten, the Ch 2 halt and the parked Ch 3 job are
  exactly as they were (parked-Ch-3 fixture rows remained
  byte-identical across the halted-fence suite in this
  round's battery, as in every prior round).

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

**Round-2 re-pin:** the round-2 corrected artifacts were re-pinned on
the same branch with parent `b8fe8c0ee496332ea059cb05686ba7e73cb793eb`
(the round-1 completed-report head), same `review/gen-pkg-1/` layout,
plus the two new worker suites, the amended round-1 suites, and the
round-2 logs. The re-pin commit SHA is recorded in the builder's
completion message, and the branch head was verified by independent
read-back after the push.

**Round-3 re-pin:** the round-3 artifacts were re-pinned on the same
branch with parent `cba2625c8ae1275fd7168c7dc155356d67ffbd56`, same
`review/gen-pkg-1/` layout, plus the two new worker suites and the
round-3 logs. Head `58b4af076c4a28e71c60471bd9433ddc7e2778f9`,
verified by independent read-back.

**Round-4 re-pin:** the round-4 artifacts were re-pinned on the same
branch with parent `58b4af076c4a28e71c60471bd9433ddc7e2778f9` (the
round-3 head), same `review/gen-pkg-1/` layout: the updated report,
the R4-1-corrected `worker/generation/service.mjs`, the extended
`worker-tests/genpkg1-halted-fence.test.mjs`, and the round-4 logs
(incl. the disclosed flaked battery run's summary + failing list).
The entry, deploy spec, and all client blobs are carried forward
unchanged. The re-pin commit SHA is recorded in the builder's
completion message, and the branch head was verified by independent
read-back after the push.

**Round-5 re-pin:** the round-5 artifacts were re-pinned on the same
branch with parent `ac9558f46bfe5a62e5ecc9e7842ad93bbffd225e` (the
round-4 head), same `review/gen-pkg-1/` layout: the updated report,
the nine round-5 worker-tree delta files (service, entry,
phase-policy, deploy spec, envelope validator, the modernized
`d6-correction`, the amended phase-enforce + phase-policy suites,
and the new envelope-policy suite), and the round-5 logs (worker
battery summary + failing list, the targeted-suite per-file logs
for `d6-correction` and `genpkg1-phase-enforce`, the three
envelope-validator demonstration logs, and the client battery
logs). All client blobs are carried forward unchanged (the client
publish tree is hash-identical to rounds 3/4). The re-pin commit
SHA is recorded in the builder's completion message, and the
branch head was verified by independent read-back after the push.

## D7-2 code fence — STOPPED: the fence breaks baseline d6-correction C3 (decision required)

Attempted Oct 30, 2026 under Julie's approval of the code-fence
option (board comment 6524181512), answering Rowan's D7-2 in
the deploy-evidence re-review (comment 6524120231): during the
deploy plan's Gate 2/3 halted interval, `submitIntent` admits
a durable `active` plan + first job once the phase registry is
established — GENERATION_HALT gates dispatch only, not
admission — so an authenticated request could stage paid work
a later re-arm might grant. **The correction STOPPED at the
targeted-baseline stage and was fully reverted, under the
standing stop rule (Julie's D7-2 approval does not cover
baseline-suite edits — the R4-2 precedent, round 4).** The
candidate remains EXACTLY at the signed round-5 pin
`5ae38942e493a4b53f541b5e1f589060d58d158d`. No re-pin, no
client change, no deploy, no production contact. Full record:
`~/workspace/gen-pkg-1/logs/d7-2/experiment-summary.txt` +
the experiment logs in the same directory.

### The fence as built (experiment; two production files)

- `worker/generation/service.mjs`: new construction option
  `haltFenceMode` (default `"legacy"`, mirroring
  `phasePolicyMode`); under `"enforce"`, `submitIntent`
  refuses — after the lane check, BEFORE `admitPhase` and any
  plan/job/ledger/attempt/grant movement — with
  `{outcome: "rejected", reason: "generation_halted"}` whenever
  `env.GENERATION_HALT !== "0"` (fail-closed: only an exact
  `"0"` admits; `"1"`, missing, or mistyped all refuse).
- `worker/worker-entry-prod-d6.js`: `d6Service` constructs
  `haltFenceMode: "enforce"` UNCONDITIONALLY (the round-5
  pattern), and the class `/internal/d6/intent` route returns
  HTTP **423 `{error: "generation_halted"}`** while halted,
  after the round-5 503 config check and before any service
  call (defense in depth). The reason string and status are
  the codebase's OWN halt vocabulary
  (`GenerationHaltedError.code` = `"generation_halted"`, HTTP
  423 at the class catch) — no new strings were coined.
  Operator surfaces (phase-binding write, retire/reconcile,
  seed — whose law REQUIRES the halt — diagnostics) and all
  reads were untouched, as were the driver/dispatch path and
  R4-1's `halted_unknown` driver exclusion.

### Why it stopped: baseline C3 IS the D7-2 exposure, staged as law

Targeted runs against the fenced tree (experiment digest
`210c0d23…`): `d6-correction2` 10/10, `d6-seed-hardening`
12/12, `d6-service` 5/5, `d6-integration` 3/3,
`d6-parked-inertness` 1/1 — and **`d6-correction` 4/5: C3
FAILS** at line 393 (`assert.equal(ok.status, 200)` — actual
423). C3's staged premise, in its own header: through the
REAL production entry at `GENERATION_HALT="1"`, an intent is
"admitted as durable state only (zero grants, zero
dispatches, zero executions)" — it asserts HTTP 200,
`created: true`, exactly one `d6_plan_jobs` row, and plan
status `active` for a halted SubmitJob whose fixture binding
was recorded in setup. That is precisely the Gate 2/3 shape
D7-2 declares an exposure (registry established + halted +
admitted). No fence keyed on the real GENERATION_HALT binding
at the entry or service can refuse that submission without
failing C3; shapes keyed on anything else violate D7-2's own
terms (unconditional wiring, fail-closed) or leave the
exposure open. C3's dispatch-side proofs (zero grants, 423 on
`/internal/execute`, queue handler halting before the
namespace) are orthogonal and unaffected by the fence — only
its admission premise embodies the pre-D7-2 law. Candidate
suites also fail under the fence, as expected and as would
have been disclosed/re-staged had the round proceeded:
`genpkg1-phase-enforce` 10/12 and `genpkg1-phase-policy`
9/10 (their entry fixtures stage admission at HALT="1");
`genpkg1-diagnostics` 9/9 and `genpkg1-halted-fence` 7/7
(R4-1) pass. The full battery, envelope re-proof, and the
Gate 2/3 simulation were NOT run — the stop rule fired first,
exactly as at the round-4 R4-2 stop.

### Revert (complete, verified)

Both production files restored byte-identical (service
`700b8a8d67a813d3…`, entry `9cfd4c40a2549fc9…`); the worker
tree digest is back to the signed round-5 value
`2d16fe291dfa8d067fae82110089e501ca28bd93e80a047ac5efd0ffee840fb2`
(375 files); the reverted tree re-passes `d6-correction` 5/5
and `genpkg1-phase-enforce` 12/12.

### Decision required (Rowan's D7-2 framing + the R4-2 precedent)

Either (a) Julie explicitly approves a disclosed
`d6-correction` C3 fixture modernization — the exact shape of
her round-5 R4-2 approval: re-stage C3's admission assertions
at `GENERATION_HALT="0"`, preserve its dispatch-halt proofs at
full strength, and add halted-refusal assertions; the fence
then lands as built above, with the candidate-suite
re-stagings disclosed — or (b) a different production
boundary Rowan accepts (she has already characterized
plan-only controls as weaker than the requested fence). The
`DEPLOY-PLAN-ADDENDUM-D7.md` representation fix was NOT
written: its specified content ("admission is now fenced
while halted") is true only if the fence lands; until the
decision, the plan's Gate 2/3 wording remains understated, as
Rowan found, and this section is the record of why.

## D7-2 quarantine — birth-mark + grant-quarantine (Rowan ruling, comment 6524426826; Julie's approval, comment 6524562842)

Julie declined the C3 modernization (comment 6524334455) and
approved instead the boundary Rowan accepted in principle in her
D7 ruling: plans submitted while halted are ADMITTED exactly as
C3 contracts, but BORN QUARANTINED; spend authority, not
admission, is what is fenced. **Zero baseline suites were
edited.** `d6-correction` C1–C5 pass UNMODIFIED on this tree —
including C3, whose fixture plan (real entry, HALT="1", binding
recorded) is now born quarantined and still satisfies every C3
assertion (created:true, durable plan + first job, state
`active`, zero grants/outbox/executions): C3 asserts nothing
about grants after a re-arm, so the mark coexists with its
contract, and the mark's presence under the real entry is
asserted directly by the new suite's Q8.

### Design as built

- **Quarantine record** (`worker/generation/quarantine.mjs`,
  new): table `d6_quarantine_holds` — `(subject_kind, subject_id)`
  primary key (`plan` | `job`), `state` (`held` | `released`),
  `reason`, `source`, `marked_at`, and the release audit fields
  `released_at`, `release_source`, `release_actor_class`. Birth
  fields are written once (INSERT OR IGNORE) and never updated;
  the row is never deleted. The table is ADDITIVE and LAZILY
  ENSURED (DDL beside its writers, the phase-policy /
  plan-retirements precedent) — it is NOT in `gen-schema.mjs`,
  so C2's pinned eight-table bootstrap set is untouched; a store
  that never marks never grows it. All reads are throw-safe
  (`_oneOrNull` / try-caught), never a bare `.one()`.
- **Birth-mark** (service `submitIntent`): only in an
  enforcement-bound construction (`quarantineMode: "enforce"`,
  selected UNCONDITIONALLY by `worker-entry-prod-d6.js`
  `d6Service`, exactly the round-5 phase-policy pattern; direct
  constructions default to `"legacy"` = no marking, pre-D7-2
  behavior byte for byte). When `GENERATION_HALT !== "0"`
  (missing/malformed counts as halted), the hold
  (`reason: "born_while_halted"`, `source: "submit_intent"`) is
  inserted INSIDE the same coordinator transaction as the plan +
  entries insert — atomic, server-stamped from the service's own
  halt reading, independent of the submission's payload.
  Admission is otherwise unchanged. Resubmission converges on the
  existing plan BEFORE the insert path and is never retro-marked;
  plans born at HALT === "0" are never marked; pre-existing plans
  (incl. the halted Ch 2 plan's space) are never marked.
- **Exposure**: `planStatus` gains a `quarantine` object
  (`held`, `approvalRequired`, `state`, `reason`, `source`,
  `markedAt`, `releasedAt`, `releaseSource`,
  `releaseActorClass`); `planSummary` (list view) gains
  `approvalRequired`. Plan `state` is never rewritten by the
  hold — a born-held plan reads `active` + `approvalRequired:
  true`, which does not imply audio is generating.
- **Central enforcement** (`d6GrantGuard`, the proven seam —
  `coordinator.mjs` is NOT touched by this build): after the
  plan lookup (whose missing-table throw preserves the
  fail-loud contract), the guard lazily ensures the quarantine
  table and refuses, FIRST, any held subject:
  plan hold → `{ ok: false, reason: "plan_quarantined" }`;
  job hold → `reason: "job_quarantined"`. Only then do the
  existing phase-budget/storage checks run, unchanged.
- **Driver skip**: `driveOnce` checks the hold before ANY
  per-plan work (before even the phase-halt transition INTO
  `halted_unknown`) and reports `{ quarantined: true,
  approvalRequired: true }` — a held plan is never granted,
  advanced, finished, or state-transitioned by the driver.
- **Executor defense**: `createD6Executor.handleMessage` refuses
  `{ refused: "plan_quarantined" }` BEFORE claim, execution
  records, or provider contact when the job's plan (message /
  job-data / `d6_plan_jobs` link) or the job itself is held.
  Throw-safe reads: on a store without the table there is no
  hold to find and claim discipline proceeds exactly as before.
- **Release** (service `releaseQuarantine` + operator route
  `POST /v2/d6-release-quarantine` → internal
  `/internal/d6/release-quarantine`): the migration-operator
  fence class (production gate skips the client token, operator
  admission block requires the credential, class gate requires
  the stamped admission; the route stamps its own recorded
  source `"operator-route"`). Per-subject (exact `planId`, or
  exact `jobId` for guard-marked plan-less jobs — exactly one,
  else `subject_required` / `subject_ambiguous`), idempotent
  (a re-release returns `applied` + `alreadyReleased: true` +
  the standing record), audited on the hold row, with the
  read-back hold on every response. Refusals: `plan_not_found`,
  `subject_not_quarantined`, and — the billing fence —
  `release_refused_halted_unknown`: release is NOT a reconcile;
  a `halted_unknown` plan's only path remains
  reconcileUnknownAttempt + retireHaltedPlan under their own
  gates. NO other code path calls the release: deploy, binding,
  publication, re-arm, settings, and retry paths were audited
  (inventory below) and none clears a hold.

### Grant-path inventory (Rowan req 2 — every path, and its closure)

| # | Path | Closure |
|---|------|---------|
| 1 | Service `driveOnce` grant step (plan jobs) | Driver skip (held plans never reach the grant step) + guard refusal inside `requestGrant`. |
| 2 | Coordinator `requestGrant` (direct) | Guard inside `_issueGrant`'s transaction (flagged constructions). |
| 3 | `RequestSynthesis` command (job + immediate grant) | Real entry: refused at ADMISSION while halted (423 `generation_halted`, public + class level). Flagged coordinator: guard refuses the immediate grant AND durably marks the job (`grant_attempt_while_halted`) in the same transaction. |
| 4 | `RequestResume` (paused_quota grant probe) | Same as (3): entry admission refusal while halted; guard refusal + job mark on flagged paths. (A merely-queued job's resume issues no grant.) |
| 5 | Plain `SubmitJob` (stages a queued job, no grant) | Creates no grant/ledger/outbox in any state. The staged job becomes grantable only through paths 2–4/6 — and its first halted grant ATTEMPT marks it durably at the guard, so it stays fenced after re-arm (`job_quarantined`) until individually released. Behavior of the command itself is unchanged (proven Q9). |
| 6 | Watchdog `retry_grant` schedule → `requestGrant` | Guard (flagged constructions). Additionally inert for held subjects by state: `retry_grant` acts only on `generating` jobs, and a held job can never have been granted, hence never `generating`. |
| 7 | Repair chain (report-driven follow-up job + grant) | The follow-up grant runs through `_issueGrant` (guard on flagged constructions). A repair chain can only originate from a job that already executed; held subjects never execute, so no chain can originate from them. |
| 8 | Queue delivery (`drainOutbox`) | Delivers only grants ALREADY ISSUED. Held subjects can never be issued a grant (guard), so no held work can exist in the outbox. While halted the D6 entry wires no `sendGrant` at all (unchanged). |
| 9 | Queue consumer → `/internal/execute` → D6 executor | Halt layers unchanged (`assertGenerationEnabled` at queue + execute) + the executor's pre-claim quarantine refusal for replayed/crafted messages (Q4). |
| 10 | `/v2/commands` API dispatch (base coordinator, guard flag unreachable there) | The grant-PRODUCING command types (3)/(4) are refused at the D6 entry's admission while halted — the closure Rowan's ruling names for exactly this hole. All other command types (sync, settings, reads, migration fences) behave exactly as before. |
| 11 | Coordinator alarm (base-class schedule processing) | Processes leases/parks/retries for work that already has grants; held subjects have none. The D6 continuation (recover + driveOnce) runs on the flagged construction (paths 1/6). |

### Files changed (worker tree, vs the signed round-5 candidate)

- `worker/generation/quarantine.mjs` — NEW (record, schema,
  throw-safe reads, release write, read-surface view).
- `worker/generation/grant-guards.mjs` — the guard gains the
  quarantine fence + the plan-less halt fence (below).
- `worker/generation/service.mjs` — `quarantineMode`
  construction option; birth-mark in `submitIntent`;
  driver skip; `planStatus`/`planSummary` exposure;
  `releaseQuarantine` + `getQuarantine` + exports.
- `worker/generation/d6-executor.mjs` — pre-claim quarantine
  refusal (defense layer).
- `worker/worker-entry-prod-d6.js` — `d6HostEnv` gains
  `d6HaltFence: true`; `d6Service` gains
  `quarantineMode: "enforce"` (unconditional); the release
  route pair (public + internal); the admission fence for
  grant-producing legacy commands while halted (public peek +
  class-level backup, the D3-1 pattern).
- `tests/genpkg1-quarantine.test.mjs` — NEW candidate suite
  (the regression matrix, Q1–Q10).
- `coordinator.mjs` — NOT TOUCHED. The guard seam sufficed for
  every closure above; nothing in this build edits the frozen
  coordinator.

### The plan-less hole, and the flag that closes it

Rowan's named hole: `d6GrantGuard` returned `ok: true` for jobs
WITHOUT a D6 plan. The closure is flag-gated on the SAME pattern
as `d6StandardOnly`: `d6HostEnv` (production entry only) sets
`d6HaltFence: true`; with that flag on, a grant attempt for a
plan-less job while `GENERATION_HALT !== "0"` is refused
(`reason: "generation_halted"`) and the job is durably marked
inside the grant transaction. Direct constructions never set
the flag — so the baseline `d6-grant-guards` assertion
"plan-less jobs are unguarded" (a fixture without the flag, and
without `GENERATION_HALT` in its env) passes UNMODIFIED, and no
baseline suite's semantics moved. The production entry ALSO
refuses the two grant-producing command types at admission
while halted (inventory #10), because the `/v2/commands`
dispatch never reaches a flagged coordinator.

### New strings (Wren's choices, disclosed)

Guard reasons: `plan_quarantined`, `job_quarantined`,
`generation_halted` (the last reuses the codebase's halt
vocabulary; the entry admission refusal is HTTP 423
`{ error: "generation_halted" }`, the `GenerationHaltedError`
shape). Hold reasons: `born_while_halted`,
`grant_attempt_while_halted`. Hold sources: `submit_intent`,
`grant_guard`. Release refusals: `subject_required`,
`subject_ambiguous`, `plan_not_found`,
`subject_not_quarantined`, `release_refused_halted_unknown`.
Read fields: `quarantine` object on plan status;
`approvalRequired` on plan status + list summaries; driver
outcome fields `quarantined` / `approvalRequired`. Client
wording for a held plan: "Waiting — needs approval before it
can start". Table: `d6_quarantine_holds`. Route:
`POST /v2/d6-release-quarantine` (internal
`/internal/d6/release-quarantine`). Env flag: `d6HaltFence`.
Construction option: `quarantineMode`.

### Candidate-suite amendments (one by one)

- `genpkg1-quarantine.test.mjs` — NEW suite (Q1–Q10, below).
  No existing suite file was amended.
- Client `gen/tests/generation-unit.mjs` — ADDITIVE ONLY: three
  assertions appended inside GU8 (held summary shape, held
  status shape, unheld active unchanged). No assertion deleted,
  skipped, or lowered; GU8's pre-existing assertions are
  byte-identical.
- Client `gen/src/modules/generation-surface.js` — the one
  client change (below).
- `genpkg1-phase-enforce` (12/12) and `genpkg1-phase-policy`
  (10/10) pass UNAMENDED on this tree — unlike the stopped
  admission-fence experiment, the quarantine needs no candidate
  re-staging anywhere.

### Regression matrix results (new suite `genpkg1-quarantine`, 10/10)

Logs: `~/workspace/gen-pkg-1/logs/d7-2q/`.

- Q1 born-marked admission = C3's contract + hold row shape +
  truthful surfaces. Q2 convergence incl. a second service
  instance (one plan, one hold). Q3 unhalted birth unmarked;
  missing HALT counts as halted. Q4 post-re-arm matrix: driver
  skip, direct `requestGrant` refusal, alarm pass, crafted
  executor message refused pre-claim with ZERO provider calls —
  zero grants/ledger/outbox for held plans throughout — while a
  pre-existing unmarked plan grants normally. Q5 release:
  per-plan, idempotent, audited (birth stamp immutable),
  sibling untouched; refusal shapes. Q6 the plan-less hole:
  halted `RequestSynthesis` rejected + job marked; plain
  `SubmitJob` staged halted → first halted grant attempt refused
  + marked; post-re-arm both stay fenced until individually
  released; fresh post-re-arm synthesis is normal work. Q7
  release refuses `halted_unknown` (with and without a hold);
  Ch 2-shape plan row and Ch 3-shape `parked_policy` job row
  BYTE-IDENTICAL after driver passes + release attempts, never
  driven, zero grants. Q8 real entry: halted intent admitted +
  born quarantined (the C3 coexistence proof); plan view shows
  `active` + `approvalRequired`. Q9 real entry: legacy
  grant-producing commands 423 at admission while halted (and
  stage nothing); plain `SubmitJob` + other commands unchanged.
  Q10 real entry release route: client token alone 403, forged
  operator 403, absent credential 403, correct operator 200
  applied with server-stamped source + read-back, duplicate =
  idempotent no-op, unknown plan refused, direct internal call
  without the stamp 403.

### Batteries

- Targeted: `d6-correction` **5/5 UNMODIFIED**;
  `d6-grant-guards` 7/7; `d6-service` 5/5; `d6-integration`
  3/3; `d6-executor-fi` 21/21; `d6-seed-hardening` 12/12;
  `d6-parked-inertness` 1/1; all `genpkg1-*` suites green
  (phase-enforce 12/12, phase-policy 10/10, surfaces 5/5,
  diagnostics 9/9, projection 7/7, intent-idempotency 4/4,
  quarantine 10/10).
- Full worker battery, ONE complete run on the final tree:
  **122 suite files, 100 pass / 22 fail — the failing set is
  BYTE-IDENTICAL to the recorded 22-name baseline** (round-5
  `failing-files.txt`); 952 tests, 930 pass, **zero assertion
  failures**. Logs: `logs/d7-2q/worker-final/`.
- Client (one minimal change, genuinely required — below):
  store unit battery **13/13**, generation units **13/13**
  (incl. the three additive GU8 assertions), Chromium proof
  **14/14, 0 page exceptions**; twin trees byte-identical;
  package checks PASS; Shelf bridge in the publish tree
  byte-identical (`bc0a5879…`). Logs: `logs/d7-2q/client-*`.

### Client impact (one minimal change, disclosed)

`planStatusText` rendered state `active` as "Working — X of Y
done". For a born-quarantined plan that is false: nothing is
working; spend is fenced pending approval. The server surfaces
now carry the truth (`approvalRequired` / `quarantine.held`),
and `generation-surface.js` `planStatusText` gained ONE leading
branch: a held plan reads **"Waiting — needs approval before
it can start"** on both server shapes. Nothing else in the
client changed. New client publish tree digest:
`97e280948341e0d993975f46ebf089c10e9a2dfdc74487783ff80dd2069cc398`
(81 files; previously `365ecbdd…` — the delta is exactly the
`generation-surface.js` publish path + its tree copies, with
package-assemble proving every non-delta path byte-identical).

### Envelope

The revised candidate still assembles to the pinned spec (7
bindings, `OPALREADER_PHASE_POLICY` `enforce`, HALT spec value
"1"): NO new bindings — the release route rides the existing
operator fence, and the admission fence adds no surface the
spec counts. The actual-D6-envelope proof harness was re-run
against the revised tree with the new pin stamped (module bytes
differ from the round-5 candidate as expected — quarantine.mjs
joins the closure); the new envelope SHA-256 and part table are
recorded in `logs/d7-2q/envelope-hashes.txt` and in the
builder's completion message (a proof stamped with a commit's
own SHA can only be run after that commit exists — the D7-1
pattern). Deploy-gate D1 must re-verify against THAT hash.

### Tree digests + pin

- Worker tree (established digest method): SIGNED round-5
  `2d16fe291dfa8d067fae82110089e501ca28bd93e80a047ac5efd0ffee840fb2`
  (375 files) → D7-2 `d454c220def9832cff32a828324f60b8ee657b7d622671f40f1712ad24aa6b45`
  (377 files: + `generation/quarantine.mjs`,
  + `tests/genpkg1-quarantine.test.mjs`).
- The `DEPLOY-PLAN-ADDENDUM-D7.md` representation fix IS written
  in this round (the STOPPED section above recorded why it could
  not be written for the admission fence): admission allowed
  while halted; spend authority is what is fenced; per-plan
  release = Julie's separate approvals; the pre-re-arm
  exhaustive inventory retained as the second layer.
- Re-pin: new commit on `ui1-review`, parent = the fresh-read
  head at pin time (the D7-1 evidence head `1c7f0530…`), changing
  ONLY `review/gen-pkg-1/**`; `review/gen-pkg-1-deploy/**`
  preserved byte-identical. The pin SHA is recorded in the
  builder's completion message (a commit cannot contain its own
  SHA), with ref + parents + recursive tree diff read back after
  the push.

### NOT authorized / NOT done (unchanged gates)

No deploy, no production contact, no board posts by the builder,
no production registry/binding write, no client publication, no
re-arm, no plan release, no Ch 2 reconciliation/retirement/
retry, no Ch 3 resume, no Batch arming, no generation, no
spending. The release route has never been invoked against
production; its tests use synthetic operator auth only.

## D8 corrections — fail-closed hold reads + plan-less staging fence (Rowan review 6525035570)

Repo-only, under Julie's existing D7-2 approval (comment
6524562842). Rowan accepted the D7-2 proof replay (D7-1) and
the birth-mark architecture, and withheld implementation
sign-off on two blockers. This round corrects both, re-runs the
proofs, and re-pins. Deploy Gates 1–3 are untouched and remain
Julie's separate decisions behind Rowan's re-review.

### D8-1 — quarantine lookups FAIL CLOSED

The defect: `quarantineHoldRowSafe` swallowed ANY error into
null, and `heldQuarantine` (built on it) fed the grant guard,
the driver skip, and the executor defense — an arbitrary SELECT
failure masqueraded as "no hold" and a held plan could be
granted on a sick store.

The correction (`worker/generation/quarantine.mjs`,
`grant-guards.mjs`, `service.mjs`, `d6-executor.mjs`):

- New `heldQuarantineStrict`: the hold read used at every
  spending/execute fence. It never swallows; callers ensure the
  schema first, so a genuinely absent table is created and then
  read (absence after ensure = no hold, legitimately); any
  ERROR propagates.
- `quarantineHoldRowSafe` is tightened, not deleted: it now
  returns null ONLY for a genuine "no such table" error
  (`isNoSuchTableError`) and rethrows everything else. Its only
  remaining consumers are the read-only views (`planStatus`,
  `getQuarantine`), where Rowan permits the pre-bootstrap
  "no hold" rendering.
- Grant guard: schema ensured, then STRICT plan/job hold reads
  inside `_issueGrant`'s transaction — a failure throws and the
  transaction rolls the attempt back: no grant, no ledger, no
  outbox mutation is possible past a broken read.
- Driver: the skip check ensures + reads strictly; a failure is
  treated as held-for-driving and surfaced on the outcome as
  `quarantineCheckFailed: true` (never a silent clean skip, and
  the plan is never driven to a grant — the guard is the
  documented backstop regardless).
- Executor: on a store-backed coordinator the pre-claim defense
  ensures + reads strictly; a failure refuses the message with
  the NEW, disclosed reason `{ refused: "quarantine_check_failed" }`
  BEFORE claim, execution record, or provider contact. The
  throw-safe read survives only for store-less coordinator
  doubles (unit fixtures with no store a hold could live in).

Fault-injection proof (new suite `genpkg1-quarantine-d8`,
D8-1a–d, sabotage = the harness SqlFacade wrapped so every
SELECT on `d6_quarantine_holds` throws): held plan grant
attempt THROWS with zero grants/ledger/outbox and the hold row
unchanged; an UNMARKED plan under the same fault also throws
(an error is never "no hold" for anyone) and grants cleanly
once the fault clears; held plan-less job identical; executor
refuses `quarantine_check_failed` with zero provider calls and
zero execution records, then `plan_quarantined` after the fault
clears; driver reports `quarantineCheckFailed` and never
reaches a grant.

### D8-2 — plan-less work staged while halted can never become spendable via a generic re-arm

Rowan's two sub-findings: (i) the D7-2 entry still ADMITTED
plain `SubmitJob` / `RequestRepair` while halted — plan-less
jobs with NO birth mark; the guard-time mark was the only
fence, and (ii) that mark is unreachable when the halted
attempt is refused BEFORE the guard (quota park / daily quota
/ monthly cap all run earlier in `_issueGrant`).

Three layered mechanisms (`worker/worker-entry-prod-d6.js`,
`grant-guards.mjs`, `quarantine.mjs`, `service.mjs`):

1. **Admission refusal (Rowan's focused option).** A shared
   predicate (`isHaltRefusedCommand`) now refuses, at BOTH the
   public entry and the coordinator class, while
   GENERATION_HALT !== "0": `RequestSynthesis`, `RequestResume`,
   `RequestRepair`, and plain `SubmitJob` WITHOUT
   `payload.data.d6Intent` — 423 `{ error: "generation_halted" }`.
   `SubmitJob` WITH `data.d6Intent` is NOT refused: it forwards
   to the intent route, admitted + birth-marked (C3 intact).
   All reads/sync/settings/other commands are unchanged.
2. **Halt-epoch ledger (the durable answer to (b)).** New
   lazily ensured tables `d6_halt_epochs` + `d6_quarantine_meta`
   in `quarantine.mjs` (NOT in `gen-schema.mjs` — C2's pinned
   bootstrap set is untouched). Halt-state observations are
   noted at the three authoritative surfaces (the grant guard,
   inside its transaction; `driveOnce`; `submitIntent`), closing
   the "the guard never ran during the halt" gap for any halt
   the machinery witnessed. An epoch's suspect window runs from
   the last observed unhalted moment (0 if none — fail-closed)
   to the last observed halted moment. Guard fence: a plan-less
   job that is still `queued`, was born inside a suspect window,
   and has NEVER been adjudicated (no hold row in any state) is
   durably marked (`reason: "born_while_halted"`,
   `source: "halt_epoch"`) and refused `job_quarantined` in the
   same transaction. A held row already refused it above; a
   RELEASED row is the operator's completed clearance and is
   never re-imposed (this exemption is itself pinned by Q6).
   Honest scope, stated plainly: client-reachable staging is
   refused unconditionally by (1); store-staged rows are fenced
   for every halt the machinery observed — in production every
   halt, since the class alarm fires each watchdog cycle and
   intent/grant traffic notes observations too. A row staged AND
   granted entirely inside a halt window the machinery never
   observed is reachable only from the operator plane, whose
   holder also holds the release credential. Observation
   boundaries cut fail-closed: births after the last unhalted
   observation but before the halt physically began are
   over-fenced (operator-releasable); births after the last
   halted observation are indistinguishable from legitimate
   post-re-arm births and are not fenced.
3. **Retained defense-in-depth.** The D7-2 guard-time durable
   job-mark for plan-less jobs reaching the guard while halted
   is unchanged, and the guard's held checks still run first.

Adversarial results: (a) D8-2a — real-entry plain SubmitJob +
RequestRepair refused at HALT=1 at BOTH levels, intent admitted
+ born held, generic re-arm before any grant attempt, then
class alarm + direct flagged requestGrant → zero
grants/ledger/outbox/dispatches. (b) D8-2b — store-staged jobs
whose halted attempts died at the quota park and at the daily
quota (premise asserted: NO mark exists after either attempt)
are epoch-fenced after re-arm + limit reset; a pre-halt job in
the same store grants normally; operator release clears one
job and not the other. (c) d6-correction C3 + Q1/Q8 + D8-2a's
intent leg. (d) battery proof below. (e) Q2/Q5 unmodified;
D8-2b's release-A-not-B at job level; Q6's release flow
(exemption above).

### Production-class alarm audit (Rowan's path audit) — BYPASS REACHABLE IN PRINCIPLE; FENCED

The audit question: the real `OpalReaderCoordinatorProd`
constructs its superclass with the raw env; `super.alarm()`
runs FIRST; the base alarm and the `/v2/commands` dispatch
build their coordinators from that env via a host-env spread
carrying NO D6 flags — so did any base `_issueGrant` path run
unguarded?

Verdict: **yes, the path was unguarded.** The guard flags
existed only on the separately constructed D6 service
coordinators (`d6HostEnv`). The base alarm's coordinator could
issue grants the guard never saw. Reachability of HARM today
was limited by job state (watchdog `retry_grant` acts only on
'generating' jobs; a held plan's jobs are never granted, hence
never 'generating'; the production deploy spec does not bind
the base alarm's outbox sendGrant) — but the unguarded path
itself was real, proven by counterfactual: the pre-D6 base
class's alarm fired over the audit store grants the held
plan's probe job (grants/ledger/outbox 0 → 1;
`logs/d8/alarm-counterfactual.mjs` + output).

The fence (no `coordinator.mjs` edit): the D6 production class
now stamps `d6StandardOnly` + `d6HaltFence` onto its own env
AFTER `super(state, env)`:
`this.env = { ...this.env, d6StandardOnly: true, d6HaltFence: true }`.
Every coordinator the class builds for post-construction
operations — base alarm schedule processing, API dispatch —
inherits the flags through the existing host-env spreads, so
the guard (plan/phase checks, hold fence, halt fence, epoch
fence) runs on every grant path the class operates. The
constructor ARGUMENT is deliberately not decorated:
`this.coordinator` is built from it, is a plain schema/settings
handle no production grant path uses (its only production use
is the constructor's `ensureGenSchema` call), and the baseline
suites pin its plain behavior (C2's construction snapshot,
C4's batch-lane premise) — decorating it breaks C4, verified:
the seam chosen is the minimal one that fences every real path
and no pinned handle.

Proof (D8-2c, the REAL production class throughout): env flags
present on the class, absent on `this.coordinator`; staged
queued job + held plan + due retry_grant/watchdog rows inert
across a halted real-class alarm; the 'generating' probe linked
to the held plan refused INSIDE `super.alarm()` (zero movement,
halted and re-armed); positive control — a legitimate plan-less
'generating' job born before the halt grants through the same
base-alarm path and drains via the D6 queue wiring (the path is
guarded, not broken).

### Files changed (worker only; client untouched)

- `worker/generation/quarantine.mjs` — strict hold read +
  no-such-table-only safe read + halt-epoch ledger.
- `worker/generation/grant-guards.mjs` — strict reads in the
  guard; halt observation; epoch fence.
- `worker/generation/service.mjs` — driver strict skip with
  `quarantineCheckFailed`; halt observations at `driveOnce` /
  `submitIntent`.
- `worker/generation/d6-executor.mjs` — strict pre-claim reads;
  `quarantine_check_failed` refusal.
- `worker/worker-entry-prod-d6.js` — shared admission predicate
  (SubmitJob/RequestRepair refused while halted, both levels);
  production-class env fence.
- `coordinator.mjs` NOT edited. No new bindings. No client
  change (publish digest unchanged:
  `97e280948341e0d993975f46ebf089c10e9a2dfdc74487783ff80dd2069cc398`).

### Candidate-suite amendments (disclosed, one by one)

1. `tests/genpkg1-quarantine.test.mjs` Q9 — the plain-SubmitJob
   block's D7-2-era expectation (admitted, 200/applied) is
   REPLACED by the D8-2 behavior (423 `generation_halted`,
   nothing staged); a RequestRepair 423 case and a
   non-generation-command (SetSettings, 200) case are added.
   No assertion deleted: the replaced assertion asserted the
   exact behavior Rowan's D8-2 ordered removed.
2. `tests/genpkg1-quarantine.test.mjs` Q6 — one fixture line
   added (`h.advance(60_000)` across the re-arm) with an
   explanatory comment; NO assertion changed. The epoch fence
   is timestamp-based by design; Q6's scenario ("fresh
   post-re-arm synthesis is normal work") is a real-time
   premise that a single frozen fake millisecond cannot
   express. The run also exposed — and the guard now pins — the
   rule that an operator-RELEASED subject is never re-fenced by
   the epoch.
3. NEW sibling suite `tests/genpkg1-quarantine-d8.test.mjs`
   (7 tests: D8-1a–d, D8-2a–c) — additive only.
No baseline suite edited; no assertion anywhere deleted,
skipped, or lowered outside amendment 1's disclosed replacement.

### Batteries

- Targeted: d6-correction 5/5 UNMODIFIED; d6-correction2 10/10;
  d6-grant-guards 7/7; d6-seed-hardening 12/12; d6-executor-fi
  21/21; genpkg1-quarantine 10/10 (amendments above);
  genpkg1-quarantine-d8 7/7; genpkg1-phase-enforce 12/12;
  genpkg1-phase-policy 10/10; genpkg1-diagnostics 9/9;
  genpkg1-surfaces 5/5; genpkg1-projection 7/7;
  genpkg1-intent-idempotency 4/4; d6-service 5/5;
  d6-integration 3/3; d6-parked-inertness 1/1.
- Full worker battery on the final tree (`logs/d8/worker-final/`):
  123 suite files, 101 pass / 22 fail; 959 tests, 937 pass;
  failing set BYTE-IDENTICAL to the recorded 22-name baseline
  (`logs/d7-2q/baseline-22.txt`); ZERO assertion failures (all
  22 are the pre-existing infrastructure failures).
- Client: untouched — batteries not re-run (no client delta).

### Digests / pin

- Worker tree: 377 → 378 files (one new test file; no new
  worker source files). Digest method (documented; the D7-2
  lineage digest used a method not reproducible from its
  record, so this round states its own): sorted relative
  paths, lines `${sha256(content)} ${path}`, SHA-256 of the
  manifest — pre-D8 tree (reconstructed byte-exact from the
  D7-2 pin's delta blobs + untouched files)
  `5e03071ab765dc82e5978e37e0a926af645586494ff03ffda67dcbfa1e0d6904`;
  D8 tree
  `30a954c45831e4c95f596b8eb6442944b35e11c19bfadce59d27b712dffec84a`.
  The pin's git tree diff below is the authoritative delta.
- Envelope: re-proven against the corrected candidate after
  the pin (the proof stamps the pin SHA); result + new
  envelope SHA-256 recorded in `logs/d8/envelope-hashes.txt`
  and in the builder's completion message. No new bindings.
- Re-pin: new commit on `ui1-review`, parent = the fresh-read
  head at pin time, changing ONLY `review/gen-pkg-1/**`;
  `review/gen-pkg-1-deploy/**` preserved byte-identical. Pin
  SHA + read-back proof in the builder's completion message.

### NOT authorized / NOT done (unchanged gates)

No deploy, no production contact, no board posts by the
builder, no production registry/binding write, no client
publication, no re-arm, no quarantine release against
production, no Ch 2 reconciliation/retirement/retry, no Ch 3
resume, no Batch arming, no generation, no spending.
