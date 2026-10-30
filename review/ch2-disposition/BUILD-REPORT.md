# CH2 DISPOSITION PACKAGE — BUILD REPORT

**Package:** the uncertainty disposition (`estimated_unverified`),
repo-only build. **Gate:** §11 step 3 of the governing design —
build + full battery, submitted for Rowan's source review. This
build authorizes nothing further: no deploy, no disposition
execution, no retirement, no re-arm, no generation, $0 spend.

- **Governing design:** `UNCERTAINTY-DISPOSITION-DESIGN.md`
  Rev 2, pin `d2daa2e544bc2588573d1777c303c9cb9c433fc8` on
  `ui1-review` (`review/ch2-adjudication/`).
- **Design PASS:** Rowan, roundtable issue #15 comment
  **6535393656** (D1/D2 cleared), including her implementation
  verification requirement (addressed in §5 below).
- **Build approval:** Julie, recorded on issue #15 as comment
  **6535417583** (repo-only build of the approved design; full
  battery incl. tests 1–15; pin for Rowan's source review).
- **Build lineage:** copied from
  `~/workspace/ch2-program/fix/worker-build/` — the source of the
  LIVE build `288508073b5218a6e0dd90b68d497a331ad872b6`
  (gen-pkg-1 + B1/B2/B3 fixes + re-arm fence) — into
  `~/workspace/ch2-program/disposition/worker-build/`. The fix
  tree, `~/workspace/gen-pkg-1/`, and `~/workspace/d6-build/impl/`
  were not edited.
- **This pin:** a clean child of `d2daa2e5` on `ui1-review`,
  adding exactly 9 paths under `review/ch2-disposition/` (see
  the manifest in §7). The worker-source delta against the live
  build's tree is exactly 4 files; the test delta is exactly 2
  new suites. No baseline file is modified anywhere.

## 1. What was built (design §2 headline)

A new, separate disposition path. `genstore.adjudicateEstimated`
disposes ONE confirmed/unknown attempt as the distinct outcome
`estimated_unverified`; `cost_micro_cents` stays NULL; the
figures and provenance live in the new `d6_billing_adjudications`
table (with the append-only `d6_billing_adjudication_amendments`
schema shipped beside it — schema only, §8/Q3). The deployed
reconcile machinery is not modified at all: `reconcileUnknown`,
`SETTLEMENT_OUTCOMES`, `KNOWN_OUTCOMES`, `ATTEMPT_OUTCOMES`, and
the confirm path are byte-identical to the live build, and the
new outcome is added to none of them (§4.3; pinned behaviorally
in test 11).

## 2. Design-conformance map (§ by §)

- **§3 invariants.** (1) Never promoted: the estimate is written
  only to `d6_billing_adjudications.estimated_cost_micro_cents`;
  the attempt UPDATE's SET list excludes `cost_micro_cents`
  (test 1 asserts it remains NULL); `settledMicro`'s SQL is
  unchanged. (2) Provisional budget math: five figures reported
  separately (§6.1); the settled bucket is labeled
  recorded/known-under-the-existing-ledger on every surface
  that labels it (test 12). (3) One-way exactly-once: the
  confirmed/unknown guard + the adjudication PRIMARY KEY
  (tests 1, 3); no function transitions out of
  `estimated_unverified` in this build. (4) This package is the
  concrete build of the concrete design.
- **§4.1 step order** — implemented verbatim in
  `genstore.adjudicateEstimated`, all checks inside one
  `coord._tx`: attempt_not_found → attempt_not_unknown (the
  duplicate refusal) → adjudication_plan_mismatch →
  adjudication_plan_not_halted_unknown → budget phase resolved
  as `plan.phase` (non-empty string, else
  adjudication_particulars_missing; the attempt row's `phase`
  column is read only as the lifecycle state in step 2) →
  authorizationRef nonblank-after-trim (trimmed value recorded)
  → particulars (exactly one `d6_plan_entries` row for
  (plan_id, occurrence_id); entry char_count safe-integer > 0;
  entry upper and attempt upper safe-integers ≥ 0; any defect
  refuses without mutation) → lazy schema ensure + UPDATE +
  INSERT → phase-flag clearing mirroring `reconcileUnknown`
  (recompute; clear `halted_unknown_billing` iff
  unknownOpen === 0; `haltCleared` reported) → return
  `{ attempt, adjudication, haltCleared }`. Writes nothing
  else (test 1's write-set exactness).
- **§4.2 mapping** — `service.adjudicateEstimatedAttempt` maps
  the six settlement reasons; `adjudication_schema_inconsistent`
  RETHROWS (surfaces as an error / guard refusal, never a
  settlement reason, never zeros).
- **§4.3 consumer audit** — performed over the whole worker
  tree: `ATTEMPT_OUTCOMES` has no consumers outside
  `genstore.mjs`; `phaseAccounting` consumers are the grant
  guard and capabilities (both updated per §6); the retire
  guard and `unknownOpen` count attempt rows by their unchanged
  definitions (both fall by exactly one after a disposition);
  executor bookkeeping only ever confirms via the unchanged
  vocabulary; recovery classification keys on execution states,
  not attempt outcomes; quota/monthly surfaces do not consume
  `phaseAccounting` (§6.2: untouched).
- **§5.1 schema** — the design's DDL verbatim, beside its only
  writer, ensured lazily inside the disposition transaction
  (both tables, one batch), NOT in `GEN_SCHEMA`, no ALTER, no
  backfill. Both tables ship with this build (Q3).
- **§5.2 figures** — server-side only, frozen at disposition:
  estimate = `expectedCostMicro(entry.char_count)` (own-length,
  deployed rate); reservation = the ATTEMPT ROW's recorded
  `upper_micro_cents` (Rev 2's sourcing, flagged by Rowan as
  redirectable at source review — implemented as designed).
  `estimate_basis` records the derivation and the source-row
  identities verbatim (attempt/plan/occurrence, entry key,
  char_count, BOTH uppers, resolved phase) and states the flat
  19,652 grant estimate was NOT used. Test fixtures prove the
  sourcing: entry upper 22,500 ≠ attempt upper 23,000, and the
  recorded reservation is 23,000; the fixture estimate (1,000
  chars) is 14,098 ≠ 19,652.
- **§5.3 rollback fence** — see §5 of this report.
- **§5.4 absent-table discipline** — one presence-checked read
  path (`adjudicationTablePresence` + `unverifiedAccounting`)
  serves `phaseAccounting`, the plan-summary sibling read, and
  the diagnostics join: read-only `sqlite_master` pair check;
  both absent ⇒ exact zeros (test 13 asserts neither table
  exists after all cold reads — reads never run the DDL); both
  present ⇒ strict sums, errors propagate unmasked (test 14b);
  exactly one ⇒ throw `adjudication_schema_inconsistent`
  (test 14a). Presence check is the mechanism; no error-text
  matching is relied on.
- **§6.1 accounting** — the three deployed definitions verbatim;
  two new sums under the design's scope rule (join on
  attempt_id, attempt outcome `estimated_unverified`,
  `current_amendment = 0`). `planSettledMicro` unchanged; plan
  summaries gain the sibling `estimatedUnverifiedMicroCents`
  under the same discipline.
- **§6.2 gating** — guard projection is now settled +
  reservation + in-flight + pending (the reservation gates; the
  estimate never does — test 7b is the discriminating case);
  zero adjudications ⇒ numerically identical to the deployed
  guard (tests 13/13b). Shape fence: `d6PhaseBudgetCheck`
  refuses `phase_accounting_incomplete` when either unverified
  field is missing or not a safe integer (test 15a); a throw
  from `phaseAccounting` itself propagates out of the grant
  transaction (no grant — test 14a). Capabilities remainder =
  max(0, budget − settled − reservation − in-flight) (Q4;
  test 7a exact; test 13 byte-equal to legacy when cold).
- **§6.3 surfaces** — capabilities gains exactly the two new
  keys (existing keys unchanged in meaning); plan summary gains
  the sibling figure + `estimatedUnverifiedStatus:
  "provider_unverified"` when the plan has any adjudication,
  persisting after retirement (tests 12, 13); diagnostics
  attempt rows join the adjudication (estimate + reservation +
  literal status; an `estimated_unverified` attempt with no
  adjudication row throws — loud, never silently rendered);
  diagnostics plan block gains the phase three-way split (see
  ambiguity note A1). No surface labels the settled bucket
  "verified" (test 12 asserts the label discipline).
- **§6.4 worked example** — the build's arithmetic is the
  design's: fixture remainder after disposition =
  13,500,000 − 17,749 − 23,000 − 5,000 = 13,454,251 (test 7a).
- **§7.1 route** — `POST /v2/d6-adjudicate-estimated` →
  `/internal/d6/adjudicate-estimated`, wired into the operator
  fence class at all four points the reconcile route occupies
  (gate skipClientToken list, operator admission block,
  forward block, class-gate stamp check). `source` stamped
  server-side (`"operator-route"`); the service handle mirrors
  `reconcileUnknownAttempt`; the `applied` response carries
  the new outcome, the frozen estimate + reservation,
  `haltCleared`, and the adjudication identifiers.
- **§7.2 closed schema** — allowlist exactly
  `{ attemptId, planId, authorizationRef, note }`, enforced at
  the route before the store is called: the six named figure
  keys ⇒ `adjudication_figure_caller_supplied`; any other key
  ⇒ `adjudication_request_key_not_allowed`; nonblank-after-trim
  field rules with the design's reason strings; note optional
  string, build-set length bound 2,000 chars, else
  `note_invalid` (test 5, incl. whitespace-only values and the
  B2 zero-movement pattern).
- **§7.3 audit** — the adjudication row is the audit; the
  evidence reference set is frozen in the entry
  (`ADJUDICATION_EVIDENCE_REFS`: Exhibit A identifier, the
  corrected research pin `06c66d45…`, Rowan's ruling
  6534423731, her design review 6534952386, her design PASS
  6535393656) and stamped server-side; the execution approval
  reference is the row's `authorization_ref` (the call's
  trimmed `authorizationRef`). Rows are never updated except
  via `current_amendment`, never deleted.
- **§8 amendment** — schema only, as decided (Q3): both tables
  ship; NO `amendAdjudication` function, NO service handle, NO
  route (test 10 asserts all three absences, incl. a
  route-inventory read of the entry source). Behavioral
  amendment tests are deferred with the package, per the
  design — they are not part of this battery.
- **§9 retirement** — `retireHaltedPlan` is unmodified (source
  byte-identical except where this package's four files
  differ — the retire function itself is untouched): after a
  disposition both unknown counts fall by exactly one and
  retirement proceeds under its existing contract (test 8);
  the disposed attempt's execution record remains
  `unknown_billing` permanently — asserted byte-identical in
  test 1 and still `unknown_billing` after retirement in
  test 8 (§9.2: expected provenance, not a STOP condition).
- **§9.3 / Q1** — flag clearing at disposition, plan unmoved;
  test 2 proves halted-plan ownership / zero resumption with
  the global halt ON and OFF, including the admission-fence
  leg (test 2b: byte-identical retry converges on the halted
  plan; a different-semantics intent refuses
  `plan_overlap_conflict` naming it).
- **Q2** — both figures recorded; the reservation is described
  in code and surfaces as a modeled internal allowance, never
  a provider ceiling (basis string + surface labels).
- **Q4** — remainder subtracts the reservation (above).

## 3. Tests 1–15 — individual results

New suites (this package's own; zero baseline suites edited):
`tests/ch2disp-disposition.test.mjs` (16 tests) and
`tests/ch2disp-route.test.mjs` (7 tests) — 23 tests, all pass.

1. **Happy path + write-set exactness** — PASS (disp-1):
   outcome set, cost NULL, one adjudication row with
   own-length estimate 14,098 ≠ 19,652, reservation = attempt
   row's 23,000, flag cleared, plan still `halted_unknown`,
   execution record byte-identical, zero new
   executions/grants/plans/jobs, all other snapshot tables
   byte-identical.
2. **Non-resumption, both halt states** — PASS (disp-2 ×2 via
   the route + disp-2b): halt ON (legacy commands still 423)
   and halt OFF; driver + alarm never select the plan; plan
   and attempt byte-identical after drives; no execution
   created; queue untouched; fresh intent still fenced
   (converge + `plan_overlap_conflict`).
3. **Exactly-once** — PASS (disp-3): second call
   `attempt_not_unknown`; one adjudication row; attempt
   unchanged.
4. **Refusal matrix** — PASS (disp-4): plan mismatch,
   non-halted plan, unknown attempt, blank authorization, and
   11 particulars variants (no entry; char_count NULL / 0 /
   negative / non-integer; entry upper NULL / negative;
   attempt upper NULL / negative; plan phase NULL / empty) —
   all zero movement, no audit rows, adjudication tables never
   created.
5. **Route negatives** — PASS (disp-5 ×2): all six figure keys
   ⇒ `adjudication_figure_caller_supplied`; foreign keys
   (incl. `source`, `phase`) ⇒
   `adjudication_request_key_not_allowed`; missing/blank/
   whitespace fields ⇒ the §7.2 reasons; non-string note ⇒
   `note_invalid`; client token alone / no operator / wrong
   operator / unstamped internal ⇒ 403; zero movement
   throughout.
6. **Fault injection** — PASS (disp-6): throw on the
   adjudication INSERT (after the attempt UPDATE) rolls back
   whole — attempt still unknown, no adjudication row, flag
   unchanged; the store then applies cleanly.
7. **Accounting exactness** — PASS (disp-7a, disp-7b): five
   figures exact; remainder per §6.2; real guard admits under;
   discriminating case — estimate-projection admits,
   reservation-projection refuses `phase_budget`, real guard
   refuses, zero grants.
8. **Retirement after disposition** — PASS (disp-8): retire
   applies + audit row + plan terminal; retire with the
   attempt still unknown refuses `unknown_billing_open`
   (guard unchanged); retirement note references the
   disposition.
9. **Stale message after retirement** — PASS (disp-9): the
   fence suite's world extended through disposition +
   retirement; the drained grant message resolves to the
   retired plan ⇒ `plan_not_dispatchable` refusal, zero
   provider calls, zero movement across the fence suite's
   compared tables.
10. **Amendment schema-only** — PASS (disp-10 in both
    suites): both tables exist post-disposition, amendments
    empty, `current_amendment` 0; no `amendAdjudication` on
    the store or in its module exports; no amendment handle
    on the service; route inventory shows no
    `adjudicate-amend` path anywhere in the entry.
11. **Legacy regression** — PASS (disp-11 + the full
    battery): `ATTEMPT_OUTCOMES` byte-identical;
    `confirmAttempt` refuses `estimated_unverified`;
    reconcile refuses it as a settlement outcome
    (`reconcile_outcome_invalid`) and still applies a
    `no_charge` settlement exactly as deployed; the existing
    reconcile / retire / fence / grant-guard suites pass
    unmodified (battery, §4).
12. **Read-surface honesty** — PASS (disp-12): diagnostics,
    capabilities, plan summary — estimate only under its own
    keys with `provider_unverified`; settled excludes it
    everywhere; settled labeled
    `recorded_known_existing_ledger`, never "verified"; the
    status persists in the phase read and the retired plan's
    summary after retirement.
13. **COLD pre-disposition integration** — PASS (disp-13,
    disp-13b): fresh GEN_SCHEMA-only store with known +
    in-flight activity — capabilities returns the budgeted
    phase with both new keys 0 and the remainder byte-equal
    to the legacy computation; phaseAccounting zeros with
    legacy figures unchanged; diagnostics renders with zero
    unverified figures and no join keys on legacy rows; plan
    summary sibling 0 with no status; guard admits and
    refuses (`phase_budget`, disp-13b) on legacy figures
    alone; after all reads, NEITHER adjudication table
    exists. Post-write leg: one disposition ⇒ all five
    surfaces show the frozen figures. Post-retirement leg:
    retire ⇒ all surfaces still show them, with the status.
14. **Presence discrimination** — PASS (disp-14a, disp-14b):
    exactly-one-table ⇒ `phaseAccounting` throws
    `adjudication_schema_inconsistent`, capabilities surfaces
    it (never zeros), the guard refuses (throw, zero grants);
    both-present with a missing summed column ⇒ the genuine
    SQL error propagates (not zeros, not the inconsistency
    error), guard refuses. Both-absent ⇒ test 13's zeros.
15. **Rollback fence** — PASS (disp-15a, disp-15b): (a) the
    genstore test double's legacy-shaped accounting (exactly
    the three legacy keys) fed to the guard's verdict path
    refuses `phase_accounting_incomplete` — never coerced to
    0 — with zero grants / zero ledger movement; the complete
    shape admits on the same figures (control). (b) The
    §5.3 Decision-3 comparison fixture: a legacy-shaped
    capabilities payload (keys absent) FAILS against the
    archived post-disposition read-back; a mismatched
    reservation FAILS; a summary missing the status FAILS;
    the matching adjudication-aware payload PASSES.

## 4. Battery

Full worker battery on the final tree, ONE complete run,
runner `~/workspace/ch2-program/disposition/logs/run-worker-battery-final.py`,
per-file logs + summary under
`~/workspace/ch2-program/disposition/logs/final/` (summary and
failing list pinned with this package):

- **129 suites: 107 pass / 22 fail** (baseline 127: the delta
  is exactly this package's 2 new suites, both green).
- **1,038 tests: 1,016 pass / 22 fail** (baseline 1,015: +23,
  all new, all passing).
- **Zero assertion failures.**
- The failing set is **byte-identical to the D8 baseline**
  (the same 22 known-failing suites as the live build's
  b1b2b3 battery — `diff` verified): adaptive-background-repair,
  audio-chunk-playback, chapter-quota-banner,
  continue-preparation-progress, continue-setup-recovery,
  continue-to-quota, cross-device-chapter-handoff,
  dormant-playback-start, first-chapter-segment-joining,
  gemini-400-hydration, gemini-batch-lane,
  gemini-quota-diagnostics, generation-manual-queue-reuse,
  generation-playback-concurrency, generation-session-sync-guard,
  p8-d3-prod-envelope, p8-upload-envelope, playback-bookmarks,
  restore-sound-rewind, silent-audio-recovery,
  split-first-update-stop, sync-diagnostics.
- **Zero baseline suites edited** (verified by tree diff
  against the fix tree: only the 4 worker files differ and
  only the 2 new test files are added).

## 5. Rollback-floor support (§5.3) + Rowan's implementation verification requirement

Rowan (6535393656): "at or above the floor" must mean PROVEN
adjudication compatibility of the exact target build, not a
newer SHA/date/branch position. Build-side provisions:

- The floor is a property of the EXECUTION record (a later
  gate): it will name this build by its exact review pin +
  the deployed script etag. This report is the build-identity
  surface for the source side: the pin manifest (§7) lets any
  reviewer verify byte-for-byte that a candidate build carries
  the adjudication-aware accounting (the four worker files at
  their pinned blob SHAs).
- The compatibility test is executable, not positional: a
  target build is at-or-above the floor iff its capabilities
  phase object exposes `estimatedUnverifiedMicroCents` +
  `reservedUnverifiedMicroCents` exactly equal to the archived
  read-back AND the disposed plan's summary still shows
  `provider_unverified` (the Decision-3 comparison, pinned as
  test 15b), and its grant guard carries the shape fence
  (test 15a). A build that merely postdates this pin but lacks
  the fields FAILS that comparison — by design.
- The guard's no-grant result on incomplete/malformed
  accounting is test-pinned (tests 14a, 15a): incomplete
  shape ⇒ `phase_accounting_incomplete`; split/corrupt schema
  ⇒ throw ⇒ no grant.
- Pre-disposition rollback remains clean (the tables are
  additive and unread by prior code; no disposition data
  exists). The pre-rollback holds (archived external
  read-back, verified GENERATION_HALT=1, verified queue
  PAUSED, re-arm blocked for the window) and the exit gate
  are operator runbook procedure for the execution/rollback
  gates — recorded here so the later operational plan can
  cite them; nothing in this build performs them.

## 6. Disclosed ambiguities, resolutions, and harness caveats

- **A1 — §6.3's "diagnostics phase view".** The deployed
  diagnostics payload had no phase-accounting block (it
  returns a plan block + executions). Resolution: the plan
  block gains a `phaseAccounting` object carrying the
  three-way split under the corrected labels (settled +
  `settledBasis: "recorded_known_existing_ledger"`; estimate
  + reservation + `unverifiedStatus: "provider_unverified"`;
  remaining authorization budget, null for unbudgeted
  phases). No existing diagnostics key changed; legacy
  payloads gain only this block. Flagged for Rowan's source
  review as the one place the design named a surface the
  deployed payload did not have.
- **A2 — test 15a's construction.** The guard constructs its
  own store internally, so a legacy-shaped accounting object
  cannot be injected into `d6GrantGuard(coord, job)` from
  outside. Resolution: the shape fence + projection live in
  the exported pure verdict function `d6PhaseBudgetCheck`,
  which `d6GrantGuard` itself calls for every budgeted grant
  decision; test 15a feeds it the genstore test double's real
  output. No production signature changed; the guard's own
  behavior on complete/incomplete accounting is additionally
  pinned end-to-end in tests 7a/7b/13/13b/14a.
- **A3 — §7.2's build-set note bound.** Set at 2,000 chars
  (`note_invalid` beyond, and for non-strings).
- **A4 — §7.3's frozen evidence set.** Frozen as the five
  references listed in §2/§7.3 above (the design named four
  items plus the execution approval reference; the approval
  reference is the row's `authorization_ref`, and Rowan's
  design PASS 6535393656 was added to the stamped set as the
  disposition's authorizing review).
- **Harness caveat (standing law, stated precisely).** This
  tree's `tests/helpers/do-harness.mjs` implements PRODUCTION
  `.one()` semantics (it throws on empty results — the F1
  fix; verified in the harness header), and the route suite's
  facade likewise. The new code is nevertheless written
  throw-safe throughout: adjudication reads use only
  `_all` / `_oneOrNull` / aggregate `_one` (SUM/COUNT always
  return a row), and absence is detected by the §5.4 presence
  check, never by catching a null or matching error text.
  What the harness still cannot prove: the disposition's
  lazy-DDL-inside-the-transaction path runs here against
  node:sqlite (real SQLite, real transactional DDL — test 6's
  rollback is genuine), but its first execution against the
  production Durable Object's storage is necessarily the
  execution gate itself — the same posture as the
  reconcile-audit and retirements lazy-DDL precedents, which
  are live-proven in the deployed build. No other
  harness-unprovable path is known to this package: every
  other read/write runs identically against the harness's
  production-semantics store.
- **Diagnostics join strictness (disclosed choice).** An
  attempt row carrying `estimated_unverified` with NO
  adjudication row (reachable only out-of-band) makes
  diagnostics throw `adjudication_schema_inconsistent`
  rather than render the attempt without its provenance —
  the D8-1 law applied to the join.

## 7. Pin manifest (paths added by this pin, all under `review/ch2-disposition/`)

- `BUILD-REPORT.md` — this report.
- `logs/summary.txt`, `logs/failing-files.txt` — the battery
  record (full per-file logs in the local build workspace,
  `~/workspace/ch2-program/disposition/logs/final/per-file/`).
- `worker/generation/genstore.mjs` — disposition store
  function, adjudication schema, presence-checked accounting
  reads (§4/§5/§6.1).
- `worker/generation/service.mjs` — `adjudicateEstimatedAttempt`
  handle; capabilities + plan-summary + diagnostics surfaces
  (§6.2/§6.3).
- `worker/generation/grant-guards.mjs` — shape fence +
  reservation projection (§6.2).
- `worker/worker-entry-prod-d6.js` — the operator route +
  fence-class wiring + frozen evidence set (§7).
- `worker-tests/ch2disp-disposition.test.mjs`,
  `worker-tests/ch2disp-route.test.mjs` — the §10 suites.

## 8. Focused corrections — Rowan source review 6535697368 (S1 + S2)

Rowan's source review of the candidate pin `76a9df55` returned
a **FOCUSED SOURCE HOLD on S1 + S2 only** (core valid-path
implementation sound; candidate not yet approved for a
deployment proposal). Both are fail-closed validations, made
repo-only inside the existing build scope — no redesign of the
disposition, budget formula, evidence contract, or rollback
floor; no baseline suite touched. This pin is the candidate's
one clean child carrying exactly these corrections.

- **S1 — NULL cost guarded before reclassification**
  (`worker/generation/genstore.mjs`, `adjudicateEstimated`,
  new step 2b): the source-row check now ALSO requires
  `row.cost_micro_cents === null` (precisely NULL). A
  confirmed/unknown row carrying a numeric cost — a malformed
  pre-state the schema does not forbid and the valid writer
  never produces — refuses with the distinct reason
  **`adjudication_cost_inconsistent`** before any
  DDL/UPDATE/INSERT (the service maps it to a rejected outcome
  with that reason, in the `adjudication_*` family). The
  UPDATE still never writes `cost_micro_cents`; valid legacy
  behavior unchanged. New test **disp-16**: the anomalous row
  refuses at store and service level with zero changes to
  attempt, plan, phase, and audit (no adjudication tables even
  created), and a NULL-restored control then applies cleanly.
- **S2 — orphaned unverified attempt fails closed on the
  accounting read path** (`genstore.mjs`,
  `unverifiedAccounting`): before the strict sums, an orphan
  check counts in-scope `estimated_unverified` attempts with
  NO linked unamended adjudication row (`NOT EXISTS` on
  `attempt_id` with `current_amendment = 0`); any such attempt
  throws **`adjudication_row_missing`** instead of being
  silently dropped by the inner JOIN. Because every accounting
  read surface funnels through this one function, the throw
  propagates through `phaseAccounting`, capabilities, plan
  summaries, and diagnostics — and at the grant guard the
  throw propagates out of the grant transaction, so no grant
  issues. Normal zero-on-truly-empty behavior is unchanged
  (both tables absent still returns exact zeros before the
  check; disp-13 stands). New test **disp-17**: valid linked
  control sums correctly on every surface; after the
  adjudication row is deleted out of band (both tables
  present), `phaseAccounting`, `planUnverifiedAccounting`,
  `capabilities`, `listPlans`, and `d6GrantGuard` all throw
  `adjudication_row_missing`, with zero grants issued.
- **S2 (second half) — negative unverified figures rejected**
  (`worker/generation/grant-guards.mjs`,
  `d6PhaseBudgetCheck`): the shape fence now also requires
  both unverified fields to be **non-negative**; a negative
  estimate or reservation refuses
  `phase_accounting_incomplete` identically to a missing or
  non-integer field, so a negative reservation can never
  decrease projected spend. New test **disp-18**: negative
  estimate/reservation refuse; the discriminating case
  (reservation −100, pending 100, budget 50 — which the old
  shape-only fence would have projected as 0 and admitted)
  refuses `phase_accounting_incomplete`; lawful controls still
  admit / hit the ordinary `phase_budget` fence.

**Corrections battery** (full battery rerun on the corrected
tree, ONE complete run, same runner; full log at
`~/workspace/ch2-program/disposition/logs/battery-corrections-full.log`,
exit code 0):

- **129 suites: 107 pass / 22 fail** (unchanged suite count —
  the 3 new tests live in the existing candidate suite).
- **1,041 tests: 1,019 pass / 22 fail** (candidate 1,038:
  +3, all new — disp-16/17/18 — all passing).
- **Zero assertion failures.**
- The failing set is **byte-identical** to the candidate
  run's pinned `logs/failing-files.txt` — i.e. still exactly
  the D8 baseline 22, `diff`-verified (candidate record
  preserved locally at `logs/candidate-76a9df55/`). No delta
  was absorbed; there is none.
- Paths changed vs the candidate pin `76a9df55`, all under
  `review/ch2-disposition/`: `BUILD-REPORT.md` (this section),
  `logs/summary.txt` (corrections battery),
  `worker/generation/genstore.mjs` (S1 + S2),
  `worker/generation/grant-guards.mjs` (S2 nonnegativity),
  `worker-tests/ch2disp-disposition.test.mjs` (disp-16/17/18).
  `logs/failing-files.txt` is byte-identical to the
  candidate's (same blob); `service.mjs`,
  `worker-entry-prod-d6.js`, and `ch2disp-route.test.mjs` are
  unchanged.

**Requested of Rowan:** focused source re-review of S1 + S2
against the candidate. Deploy / adjudication / retire /
re-arm remain separate Julie gates; nothing here performs or
implies them.

**Requested of Rowan (original build):** source review of this pin against the
Rev 2 design at `d2daa2e5`. The judgment call flagged in Rev 2
(reservation sourced from the attempt row's recorded upper,
with the entry's upper validated and recorded in
`estimate_basis`) is implemented as designed; this review is
where it can be redirected. The halted deploy of this build,
the adjudication execution, retirement, and re-arm remain
separate gates (§11 steps 4–7), each requiring Julie's own
approval; nothing in this package performs or implies them.

— Wren
