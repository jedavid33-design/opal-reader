# D6 Build — Report (repo-only build under Julie's BUILD Go, Oct 29, 2026)

**Scope discipline held throughout:** repo-only. Nothing was deployed, no
production state was read or written by the build (the only account access
was the earlier PINS package's read-only queries), no secret value was
touched, nothing was spent, and `GENERATION_HALT` remains `"1"` in every
configuration in the tree. No board contact. Book data was handled as
structural metadata only; every test fixture uses synthetic text.

## 1. Tree layout

```
~/workspace/d6-build/impl/
  CONTRACTS.md            the shared build contracts all workstreams built against
  worker/                 copy of the v2 worker source (deployed pin 1bee2490…)
    coordinator.mjs       ONLY modified copied source file (see §3)
    generation/           all D6 code (14 modules, new)
    worker-entry-prod-d6.js   new production entry variant
    p8/deploy-spec-prod-d6.json  new deploy spec (repo config only)
  tests/                  copied repo suites (imports re-pointed) + 11 new D6 suites
  client/                 copy of the accepted ui-pkg-3 publish tree + successors
  client-package/         assembled gen-pkg-1 publish-shaped tree (68 paths)
  client-tests/           adapted UI3 batteries + the new gen-client proof
  logs/final/             complete battery logs + exit codes from the final runs
  v2 -> worker            symlink shim so copied legacy tooling (tools/,
                          v2-preview) resolves its repo-shaped ../v2 imports
```
Completing the original copy required adding repo-root files the suites
read (`cloudflare-worker.js`, `app-256.js`, `index.html`, `tools/`,
`v2-preview/`) — all byte-identical to the source (md5-verified for the
three root files), none edited.

## 2. What was built

**Coordinator core (WS-1 + integration)**
- `generation/gen-constants.mjs`, `gen-schema.mjs` (8 new tables:
  `d6_plans`, `d6_plan_jobs`, `d6_plan_entries`, `d6_execution_records`,
  `d6_attempt_log`, `d6_phase_state`, `d6_storage_state`,
  `d6_voice_prompts`), `genstore.mjs` — execution records with the §4
  state machine (`granted → attempted → synthesized → flushed →
  verified → committed`, plus `failed` / `unknown_billing`), the
  append-only attempt log, the atomic commit, phase/storage accounting,
  the recovery scan, and the unknown-billing reconciliation mechanism.
- `generation/grant-guards.mjs` — the grant-gate enforcement (phase
  budget incl. in-flight uppers, unknown-billing halt, storage
  boundary), reused by the service.
- `generation/service.mjs` — durable work plans: intent submission with
  canonical-intent dedupe, chapter-batched jobs, the server-owned
  driver (`driveOnce`: grant → outbox drain; stop-reason mapping to
  parked_quota / parked_cap / parked_budget / parked_storage /
  halted_unknown; next-chapter jobs created in the same pass),
  `planStatus`, `recover()` (release-and-fail for never-dispatched
  records).
- `generation/settings-reconcile.mjs` — the arming settings mechanism
  (SetSettings with `baseRevision: 0`, lane → standard). **Implemented
  and tested; never performed** — arming is a separate gate.
- `worker-entry-prod-d6.js` — production entry variant: D6 coordinator
  subclass (`/internal/d6/intent`, `/internal/d6/plan`, D6 `_execute`,
  alarm = coordinator alarm → recover + drive), queue producer wiring
  (`sendGrant` from the new queue binding, only when the halt is "0")
  and a queue consumer handler under the production fences, both still
  gated by `assertGenerationEnabled`. Imports cleanly; exports
  `{fetch, queue}`.
- `generation/content-plane-adapter.mjs` — **integration deliverable**
  closing the one cross-workstream gap: the production
  `sources.eligiblePlane` for the service, derived from the
  coordinator's own content sync plane + bindings table + parked-job
  rows (the proposal §5 named source). Fails closed with named errors
  (`d6_content_plane_book_missing`) rather than planning over an
  unverified set.

**Executor (WS-2)**
- `generation/flush-store.mjs` — direct-R2 store: conditional PUT
  (`onlyIf: etagDoesNotMatch "*"`) capturing the PUT response's etag +
  size, then HEAD verify (existence + size + ETag equality), then a
  full-byte digest check via GET + SHA-256 (the migration-prime path).
  Winner adoption on digest equality only; an indeterminate PUT throws
  `flush_indeterminate` — never an unconditional retry.
- `generation/policy-split.mjs` — recursive POLICY_BLOCK splitting:
  sentence→word→char split points, `concat(parts) === original` exact,
  depth ≤ 4, 50-char floor, voice/model/style passed through unchanged;
  `stitchWav` (PCM concat + rewrap, format-checked).
- `generation/d6-work-source.mjs` — discriminated work source
  (`ok | no_content | removed_provider | unmapped_pov`); removed
  providers surface the recorded mapping, never a silent skip.
- `generation/d6-executor.mjs` — the §4 executor: claim discipline
  mirrored from the accepted kernel; per occurrence — execution record
  → spend-intent fence → every provider call wrapped
  reserve→dispatch→confirm → synthesize (split path) → flush → verify
  → atomic commit; recovery per classification with **zero
  re-synthesis** for flushed/verified records; batch refused at three
  layers (dispatch payload, job lane, work payload) with zero provider
  contact; unknown outcome → execution `unknown_billing`, phase halt,
  whole message stops fail-closed; retryable failures return repair
  markers (the executor never loops — the service's repair chain owns
  continuation).

**Proofs (WS-3)**
- `generation/eligible-set.mjs` — the §5 eligible-set builder (pure;
  every occurrence dispositioned exactly once; digest over the
  canonical entry list).
- `generation/proofs.mjs` — the five §5 proofs with named offenders,
  including the exact 27-row Ch 3 reconciliation.

**Client (WS-4)** — gen-pkg-1, build `d5b-v2-generation-client-1`.
Delta vs the accepted ui-pkg-3 tree is **exactly 6 paths** (verified by
recursive diff; the other 62 paths are byte-identical, including the
frozen Shelf bridge — SHA-256 `bc0a5879…` re-verified in the final
package): `app-267.js` (new), `modules/constants-gen1.js`,
`modules/entry-gen1.js`, `sw-gen1.js` (cache `opalreader-shell-gen1`),
`styles-154.css` (styles-153 + one appended `.ui-genstatus` section),
`index.html` (3 pointer diffs). The confirm sheet is live: Standard
selected; **Batch disabled with its reason shown and no lane state
anywhere** (the submission builder hardcodes `lane:"standard"` — the
gen-client proof force-enables the Batch button programmatically and
still observes zero batch submissions); the Keep-going toggle is
functional (intent scope); Start submits exactly one `SubmitJob`
carrying `data.d6Intent` {intentKey, scope, keepGoing, phase} with the
eligible occurrences in reading order and **Forever Pucked Ch 3
excluded in every scope**; plan status is polled from
`GET /v2/d6-plans/<planId>` and rendered in plain words (Working /
Stopped — quota / budget / charge / Done / A voice needs your choice /
Status unavailable on any error — never invented state). Composition,
store, player, and the W-4 hook are the accepted ui3 modules, reused
unchanged. The voice sheet stays as accepted (auditions not wired —
separate surface).

## 3. The only edit to a copied source file

`worker/coordinator.mjs` differs from the deployed source by **17 diff
lines**: two imports plus two hunks, both gated on
`env.d6StandardOnly` (set only by the D6 entry):
1. `_submitJob` rejects a lane outside `D6_LANE_ALLOWLIST`
   (`lane_not_allowed`) — the coordinator layer of the Batch-disabled
   proofs.
2. `_issueGrant`, immediately after the existing monthly-cap check,
   calls `d6GrantGuard` — phase-budget / unknown-billing-halt /
   storage-boundary refusals for plan-owned jobs.
With the flag absent, behavior is byte-equivalent — proven by the full
existing battery (§6) passing against the patched file.

**Integration correction (parent, during integration):** the D6
executor originally passed the job row's *request* revision key to
`commitVerified`; the accepted kernel binds recordings under the
payload **fingerprint** (`executor.mjs` reports `revisionKey: key`),
and the binding gate's identity check compares against the stored
object's recorded identity (= its cache key = the fingerprint), so any
other key fails every commit with `identity_mismatch`. Both commit
sites now pass `revisionKey = cacheKey`. The integration suite proves
it: job request keys are `fp-<id>` while bindings land under 64-hex
fingerprints.

## 4. TO-BE-PINNED items — all pinned

| Item | Pinned value |
|---|---|
| Queue name / binding | `opalreader-generation-v2` / `OPALREADER_GENERATION_V2` (deploy-spec + wrangler-style config in `generation/wrangler-queues.md`); producer = v2 coordinator outbox drain; consumer = the v2 worker itself; 3 ops/message vs 10,000 ops/day free allowance. The queue is **not created** (repo config only). Queue ID: assigned by Cloudflare at creation — a deploy-gate artifact, not a build value. |
| Output format | WAV PCM 16-bit mono 24 kHz (PINS); projection rate 3,012.6 B/char. |
| Repair-chain bound | **REPAIR_MAX_RETRIES = 3** retries per occurrence per repair chain (retryable known failures only), inside the ≤12-attempt segment budget. |
| Split values | depth ≤ 4 (≤16 leaves), floor 50 chars, ≤ 12 attempts/segment — adopted exactly at the Amendment A-1 ceilings. |
| R2 verify path (PINS §5.1) | **Resolved:** the binding's `head()` returns `{size, etag}` and `put()` returns the created object's etag — the flush store verifies existence + size + ETag from those, plus a full-byte SHA-256 via the prime GET path. No re-download is needed for the §4 triple check; the digest check exceeds it deliberately. |
| Lane allowlist representation | `export const D6_LANE_ALLOWLIST = Object.freeze(["standard"])` in `gen-constants.mjs`; membership test is the single check used by service, executor, coordinator patch, and (mirrored) the client. |
| Phase budget | $13.50 = 13,500,000 micro-cents for phase `forever-pucked`, enforced on settled known cost **plus in-flight reservations at upper-bound estimates** (per-attempt upper = chars/10 sec × 225 µ¢/sec; per-occurrence upper = 12 × per-attempt). |
| Cost model | known cost = round(durationSec × 225) µ¢ (intro $0.81/audio hr); expected est = round(chars / 15.96 × 225) µ¢. |
| Client identities | entry `app-267.js`, SW `sw-gen1.js`, cache `opalreader-shell-gen1`, styles `styles-154.css`, build `d5b-v2-generation-client-1`, packaging `gen-pkg-1`. |
| Settings reconciliation | mechanism = SetSettings CAS `baseRevision: 0` → `{geminiLane:"standard"}`, revision 0→1, cap untouched (tested; not performed). |

## 5. Storage fail-closed — implemented; the FP phase still cannot arm

The guard computes `baseBytes (d6_storage_state) + committed D6 bytes
(execution records in flushed|verified|committed) + Σ remaining
eligible chars × 3,012.6 × 1.10` and refuses (grant gate:
`storage_boundary`; driver: plan → `parked_storage`) at ≥
10,000,000,000 bytes. Proven in tests at a seeded base of
9,999,999,999 (refusal) and at fitting bases (grants proceed).

**The PINS blocker stands unchanged:** against the actual bucket
(9.4828 GB used, of which 3.7463 GB is legacy v1 `chapter-audio/`), the
Forever Pucked phase projects to 10.9077 GB (11.0501 GB with the
allowance) — the implemented rule will refuse it at arming, exactly as
designed. Disposition of the legacy data is Julie's separate decision;
nothing in this build touches it. One correction to the eligible-set
arithmetic the storage discussion should use (WS-3, from the census):
of the 811 unbound occurrences, **688 are eligible and 99 are
voice_prompt** — all 99 of The Goal's unbound segments resolve to
removed-provider cast voices (Sabrina/azure, Tucker/elevenlabs) and
stop at mapping prompts, so they project **zero** new audio until Julie
resolves the prompts. Forever Pucked's 333 eligible are unaffected.

## 6. Battery results (complete runs, final tree; logs in `impl/logs/final/`)

**New D6 worker suites — 72 tests, all pass, every exit code 0:**
| Suite | Tests | Backing |
|---|---|---|
| d6-genstore | 9 | real SQLite harness (production `.one()` semantics) |
| d6-service | 5 | real harness (incl. PT quota rollover + crash between drive passes) |
| d6-grant-guards | 7 | real harness (exact-boundary $13.50 grant; +1 µ¢ refuses; storage refusal) |
| d6-settings-cas | 2 | real harness |
| d6-policy-split | 11 | stub adapter (synthetic text) |
| d6-executor-fi | 21 | **real genstore** (suite attests its backing; also passes 21/21 against the test double in a scratch run — never blurred) + fake R2 bucket |
| d6-eligible-set | 8 | real frozen census (structural) |
| d6-proofs | 5 | real census + synthetic negatives |
| d6-parked-inertness | 1 | real harness, coordinator path (see below) |
| d6-integration | 3 | **full loop**: real adapter + builder + service + executor + genstore on the real harness |

FI coverage: FI-1…FI-6 all present, including FI-3 size **and** ETag
variants, FI-4's duplicate-commit idempotency (exactly one binding),
crash-recovery at every execution state, kill-after-verify committing
without re-synthesis, binding-absence asserted at every kill point,
and the ordering proof (no binding/report precedes flush+verify).
Rowan's conditions: (a) atomicity/recovery/rollover run against the
real SQLite-backed coordinator with real `transactionSync` semantics —
not state-machine mocks; (b) the attempt log's reserved phase is
provably not-a-call (a reserved attempt released after a crash counts
as no call) and dispatching-without-confirmation routes to
reconciliation, never retry; (c) the phase budget counts in-flight
upper bounds; (d) Ch 3 inertness + zero duplicate synthesis across
restart are asserted in d6-parked-inertness, d6-integration (parked
rows byte-identical across the full loop; zero Ch 3 dispatches), and
the service/executor suites.

**Existing worker suites — 44 files reference the worker tree: 43 pass
in the impl tree** (including all coordinator-*, executor-p3,
generation-flow-scenarios, quota-*, p8 part1/b7/preview suites after
the copy was completed). The one exception, `p8-upload-envelope`,
**passes 14/14 on the pristine source tree** and cannot run in any
plain copy: its build tool requires the real git history (it refuses a
dirty worktree and pins artifacts to the repo's HEAD commit). That is
an environment artifact of the copy, verified by the pristine control —
not a regression; the D6 diff cannot affect it (it builds the P8
Part-1 envelope from unchanged sources).

**Client batteries (gen-pkg-1 tree) — all exit 0** (logs +
`run-exit-codes.json` in `impl/client-tests/`; unit, W-4, and the
gen-client proof also re-run by the parent on the final tree):
unit 13/13 · cast census PASS · Chromium 14/14 · phone-width 11/11 ·
W-4 proof 7/7 · **gen-client proof 6/6** (Batch unselectable incl.
programmatically; exactly one correctly-shaped SubmitJob; FP Ch 3
excluded; zero submissions from every other affordance; all seven
plan-status wordings incl. "Status unavailable"; state byte-stability
apart from the submission).

## 7. Ch 3 reconciliation (from the census, WS-3 — verified)

27 rows exactly: idx 0–2 bound + parked-ready; idx 3–25 unbound +
parked-pending (23); idx 26 unbound + **absent** from the parked job
(occurrence `2a85f74f-353d-4c25-a86a-4a4db392868b`). The one Ch 3
POLICY_BLOCK-record occurrence (idx 0, `6bd358a7-f590-4c49-8c07-dacf558c2721`)
is named in the proof report. Audio cross-check: per-book bound counts
equal the audio-results `uses` counts for all 7 books (1,799 = 1,799).
Eligible totals: FP 333 (incl. Ch 2's 18 POLICY_BLOCK-flagged, all
eligible via the splitting path); all-books 688 eligible + 99
voice_prompt + 23 excluded_parked + 1 excluded_ch3 + 1,799
bound_already = 2,610.

## 8. Open items / unverified — stated plainly

1. **DO class continuity (deploy-gate question, recorded in the spec):**
   the D6 spec adds class `OpalReaderCoordinatorProdD6` under migration
   tag `v2`; a class swap does not carry the old class's per-instance
   SQLite storage. How the account instance's state plane carries into
   the D6 surface must be resolved at the deploy gate (the likely
   shape — binding the D6 coordinator under the existing class name —
   is a deploy decision, not taken here).
2. **Production content-plane shape:** the adapter reads the work
   source's entity shape (`chapters[].segments[]` with text/pov, cast
   under `povs` or `cast`). It is proven against fixture entities in
   that shape and against the census-derived plane; it has **not**
   been run against the live production coordinator (repo-only scope)
   — the arming precondition (§5 proofs on deployment-bound data)
   remains the gate that proves it there.
3. **Client transport path (WS-4 flag):** composition-ui3 exposes no
   command path to the shell by its accepted design, so app-267 builds
   the client's own transport from the byte-identical reused
   http-transport module and calls `sendCommand` directly; submissions
   therefore bypass the store outbox (the proof shows the outbox stays
   empty) and command-id stability is per sheet-open, as specified.
4. **Diagnostics marker split (WS-4 flag):** composition-ui3 reads
   constants-ui3, so the Diagnostics build-marker row reports
   `d5b-v2-playback-client-14` while the shell/index/SW report the
   gen1 identity. The Chromium proof asserts this split explicitly;
   fixing it would require a composition successor the reuse pin
   forbids.
5. **reconcileUnknown default:** with a numeric cost and no explicit
   outcome it records `success` (a charged call); the null-cost path is
   pinned to proven-no-charge (`failed_known`, 0). Operator mechanism
   only; no production reconciliation was performed.
6. **Queue ID** is unassigned by construction (creation is a deploy
   step); the v1 queue was verified untouched by the PINS package and
   is untouched here.
7. Nothing in this build arms, deploys, or generates: the smoke test,
   the secret step, the halted deploy, arming, and the storage
   disposition decision all remain separate gates ahead.
