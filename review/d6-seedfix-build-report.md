# D6 SEED-FIX Build Report — operator-only admission for the storage-seed route (Oct 29, 2026)

Built under Julie's explicit repo-only SEED-FIX BUILD authorization
(Oct 29, 2026) and Rowan's Option (a) DESIGN PASS WITH STRICT
CONDITIONS (board comment 6509192325). **Repo-only: no deployment,
no production mutation of any kind, no seed invocation, no arming,
no generation, no spend, no secret read or set.** The only
production contact was one read-only `GET /health` (build
`414d83540e5704409f1b3d84267b232bd9377a40`, generation "halted" —
the deployed base is live and untouched). All work in
`~/workspace/d6-build/seedfix-build/` (a copy of `impl/`; `impl/`
itself was never edited). Evidence in `seedfix-build/logs/seedfix/`.

**Headline:** the seed route's credential admission is corrected
to the operator credential ALONE — the Option D operator-route
shape — with a one-line functional delta. Everything else about
the route (operator admission block, admitted stamp, class gate,
halt fence, figurelessness, worker recount, zero-tolerance
cross-check, idempotence) is byte-for-byte the deployed G2 code.
**D6 suites 126/126 PASS; full worker battery 90/112 files exit 0
with the failing set byte-identical to the G2 baseline (22
environment/fixture failures, zero assertion failures); all six
client batteries PASS on the untouched client tree.**

## 0. Base verification — the impl tree IS the deployed G4 tree (no drift)

Per the build's gating rule, the base was established before any
change, against `deploy-evidence/g4/G4-COMPLETE.md`, the G2 build
report's pins, and the G4 D0 rollback package manifest:

- All **8 G2 delta modules** in `impl/worker/` hash-match the G2
  pins exactly (entry `88c3ae10…`, service `f9d32053…`,
  gen-constants `6922ad74…`, d6-work-source `8fa929b2…`, adapter
  `51c177dd…`, proofs `e7571e11…`, gen-schema `d7ae4936…`,
  genstore `2e1eb5bd…`).
- `coordinator.mjs` = `c31359ae…` (G2 statement + D0 archive agree).
- `p8/deploy-spec-prod-d6.json` = `e7a37cfe…` (the G2 spec pin).
- The other **17 deployed parts** are byte-identical to the G4 D0
  rollback package's manifest hashes.
- `host/build-identity.mjs` in the tree is the unstamped source
  (`BUILD_COMMIT = "UNBUILT"`, 378 B); the 26-part impl total is
  1,082,184 B, and 1,082,184 + 33 (the 40-char stamp replacing the
  7-char placeholder) = **1,082,217 B — exactly the G4 envelope
  total**. The deployed build marker `414d8354…` is the G2 review
  pin commit, stamped at envelope assembly (the G4 convention).

**Verdict: no drift.** The build proceeded on this base.

## 1. The change — exact diff against the deployed base

Two deployed files change. Full unified diffs:
`logs/seedfix/entry-diff.txt`, `logs/seedfix/spec-precondition-diff.txt`.

### 1.1 `v2/worker-entry-prod-d6.js` — SHA-256 `88c3ae10…` → `a1241e325d5ed7e678a1000470ff1a6bacda850ee4ad01f1f3ed49062ccd5fec` (21,100 → 22,261 B)

**The one functional hunk** (fetch handler): the seed-route
predicate is computed before the production gate, and the gate is
now invoked with the seed route included in the skip set —

```diff
   const isOperatorRoute = request.method === "POST" &&
     (url.pathname === "/v2/command-approvals" ||
      url.pathname === "/v2/command-reconciliation");
-  const denied = productionGate(request, env, cors, { skipClientToken: isOperatorRoute });
+  // SEED-FIX: the seed route is admitted on the operator
+  // credential alone, like the operator routes — the gate skips
+  // its client-token check for this route only (the scope checks
+  // inside the gate, and the instance check below, still run).
+  const isSeedRoute = request.method === "POST" &&
+    url.pathname === "/v2/d6-seed-storage";
+  const denied = productionGate(request, env, cors,
+    { skipClientToken: isOperatorRoute || isSeedRoute });
```

and the predicate's later duplicate definition is removed from
the operator-admission block (the block itself is unchanged).

**What `skipClientToken` skips and retains for this route** (from
`productionGate`'s code, unchanged): the gate runs, in order —
(1) env scope config check (`OPALREADER_V2_SCOPE` must be
"production", else 403 `production_scope_required`) — **RETAINED**;
(2) `x-opalreader-scope` header check (else the same 403) —
**RETAINED**; (3) only under skip, it returns here, skipping —
(4) the access-token-configured 503 check and (5) the
`x-opalreader-token` header comparison (401). After the gate, the
fetch handler still applies the **instance check**
(`x-opalreader-instance` must be "account", else 403
`production_instance_required`) — **RETAINED**. Then the existing
operator admission block runs for this route exactly as before:
503 `migration_operator_not_configured` when the operator secret
is unset or equals the access token (a configuration check that
still requires the access token to be SET and distinct, though no
presented client token is consulted for this route), 403
`migration_operator_required` when the operator header does not
match; the forward stamps `x-opalreader-operator-admitted`
unconditionally. The DO-class gate for
`/internal/d6/seed-storage` (internal header + production scope +
stamp `"1"`) and every service/store fence are **unchanged code**
(genstore, service, gen-constants, gen-schema all keep their G2
hashes in this tree).

**Comment corrections (no behavior):** the header's Correction-2
bullet no longer claims the seed sits behind the client-token
gate; the G2 header paragraph is rewritten to record the G2
design, the transport wall that falsified it (HTTP 403
`credential_ambiguity`; the Oct 29, 2026 arming attempt; the
identical Oct 23, 2026 D4 pilot stop), and the SEED-FIX admission
with its rationale; the admission-block comment ("the full client
gate chain has already run for it") and the seed-forward comment
are corrected to the shipped chain.

### 1.2 `worker/p8/deploy-spec-prod-d6.json` (config) — SHA-256 `e7a37cfe…` → `8d8caff15fff16e0d9cf131929329e6b741094d5c0612923265f67ee4a27f280`

A parsed-JSON diff of the whole spec shows **exactly one changed
value**: `arming_preconditions[0]`'s seed-mechanism sentence now
records the SEED-FIX admission (operator credential alone; this
one route skips the gate's client-token check; scope and instance
checks unchanged). No binding, var, topology, or migration value
changed; **GENERATION_HALT remains `"1"`** (verified in the parsed
spec). Evidence: `logs/seedfix/spec-precondition-diff.txt`.

### 1.3 Repo-only (not deployed)

- `CONTRACTS.md` — a SEED-FIX paragraph appended to the seed-route
  contract (accretion idiom), SHA-256 `5bf8813c…`;
  diff at `logs/seedfix/contracts-diff.txt`.
- `tests/d6-seedfix.test.mjs` — NEW suite (8 tests, §3), SHA-256
  `00defcf5…`.
- `tests/d6-correction2.test.mjs` — the entry-fence test amended
  in place (G2 precedent; amendment noted in the suite header and
  at the test): the G2-era "no client token → 401" probe is
  replaced by the SEED-FIX expectation — the scope and instance
  refusals run first (rows still 0), then an operator-only call
  APPLIES the seed, and a both-credentials call re-seeds
  idempotently. SHA-256 `004206e0…`; diff at
  `logs/seedfix/correction2-test-diff.txt`.

**Nothing else in the tree differs from `impl/`** (verified by
recursive diff: worker/ — only the two files above; tests/ — only
the two above; client delta zero; the frozen Shelf bridge
re-verified at `bc0a5879fbf4a6f455170ead8e0fbe1aa19d82126df4eb631bd0ebad9112ec8e`
in both `client/` and `client-package/`). The corrected 26-part
envelope total at a future deploy would be **1,083,378 B**
(1,082,217 + 1,161 entry growth — comment text plus the gate line).

## 2. Compliance with Rowan's seven conditions (comment 6509192325)

| # | Condition | Disposition |
|---|---|---|
| 1 | ONLY this route changes admission; all other endpoints retain client authentication | **Met.** The skip set gains exactly `POST /v2/d6-seed-storage`; F8 proves operator-alone does NOT admit `GET /v2/settings` or `POST /v2/commands` (401), and the client token still admits them (200). |
| 2 | Operator credential mandatory; never logged, reflected, URL-carried, or client-embedded | **Met.** Admission still runs through the existing operator block + stamp + class gate (E1–E4 unchanged and green). The change adds no logging or reflection; F3 asserts neither credential appears in the seed response. The client is untouched (delta zero) — the operator credential is not embedded in it. No URL ever carries it (header-only, as before). |
| 3 | Halt=1, figureless, operator-only, independent recount, zero-tolerance, idempotence, no mutation on mismatch — enforced and tested | **Met.** All fences are the deployed G2 code, unmodified (service/genstore hashes unchanged); tested at F3–F7 + S1–S6 + E5/E6 (§3). |
| 4 | Explicit tests: client-only denied; no-credentials denied; operator-only admitted in a synthetic halted seed test; halted=false denied; caller figures denied; recount drift denied; replay safe | **Met, one-to-one:** F1, F2, F3, F4, F5, F6, F7 in the new suite, each through the REAL entry + class over a synthetic recorded-base bucket. |
| 5 | No cross-route authorization regression; no production write in test | **Met.** F8 covers normal routes (both directions) and both Option D operator routes (operator admitted; client-only and neither refused at the operator fence, exactly as before). All tests are synthetic/in-memory; the build's only production contact was one read-only GET /health. |
| 6 | Repo-only build + source review first; Julie's separate halted-deploy approval next, with pre/post halted + queue-paused read-backs | **This report is the build half.** Nothing is deployed. Deploy remains Julie's separate gate; the required read-backs are specified in §5 (not performed). |
| 7 | After deployment: FRESH Julie Go for G9 continuation, preflights re-run, seed → CAS → routing → halt flip → delivery LAST; parked Ch 3 untouched; G10 separate | **Preserved.** This build touches none of that sequence; the parked job is untouched (parked-inertness suite green on the final tree); no arming step was performed or simulated against production. |

## 3. Test evidence (final tree, one complete orchestrated run)

Runner: `logs/seedfix/run-worker-suites.sh` (the house idiom —
every `tests/*.test.mjs` individually under
`node --test --test-timeout=120000`), executed as ONE run on the
exact final tree; per-file logs in `logs/seedfix/worker-suites/`,
summary in `logs/seedfix/worker-suites-summary.txt`, console
record in `logs/seedfix/run-worker-suites.out`.

- **Rowan's named set** (`tests/d6-seedfix.test.mjs`, 8/8 PASS):
  F1 client-only → 403 `migration_operator_required`, no row ·
  F2 no credentials → 403 `migration_operator_required`, no row ·
  F3 operator-only halted → 200 `applied`, recounted == recorded
  base (5,736,481,302 B / 5,942 objects), stored row carries
  base/object count/`seeded_at`, provenance[0] =
  `"worker-recount"`, no credential reflected · F4 unhalted →
  `generation_not_halted`, no mutation · F5 figures →
  `caller_figures_refused`, no mutation · F6 one-byte drift →
  `recount_mismatch` (both figures reported), no mutation ·
  F7 replay → `applied` + `idempotent: true`, one row, one
  provenance entry · F8 cross-route regression ( §2 rows 1/5).
- **Neighboring seed suites, unchanged, green:**
  `d6-seed-hardening` **12/12** (S1–S6 service fences; E1–E6 entry
  matrix — E5 confirms a both-credentials call still seeds: the
  client header is simply not consulted for this route) ·
  `d6-correction2` **10/10** (including the amended entry-fence
  test of §1.3).
- **All D6 suites: 126/126 tests PASS, 17/17 files exit 0**
  (G2's 118 + the new suite's 8). Parked-inertness re-proven:
  the parked Ch 3 job stays byte-identical and unenumerated.
- **Full worker battery: 112 files — 90 exit 0, 22 exit 1.** The
  failing set is **byte-identical to the G2 baseline** (diffed):
  20 × `ENOENT` for legacy v1 client entry fixtures (`app-2XX.js`)
  never copied into this tree, and 2 × git-required tooling suites
  (`p8-d3-prod-envelope`, `p8-upload-envelope` — the build tree is
  not a git checkout). **Zero assertion failures anywhere** (no
  `AssertionError` in any failing log). Per the D5 pristine
  evidence carried through every prior build, those 22 pass in the
  pristine source-of-record checkout; this correction touches no
  file they load.
- **Client batteries** (client tree untouched; re-run for
  completeness; logs `logs/seedfix/client-*.log`): unit **13/13** ·
  cast census **PASS** · Chromium **14/14** · phone-width **11/11** ·
  W-4 **7/7** · gen-client **6/6** — all exit 0.

**Harness note (the standing `.one()` trap):** this change is
gate logic in the public fetch handler, before any coordinator
contact; it creates, removes, and relies on **no** SQL read path.
The entry-level suites run the real class over `node:sqlite` with
a facade whose `.one()` **throws** on an empty result (real DO
semantics, deliberately modeled in `d6-seed-hardening` /
`d6-seedfix`), so the seed path as exercised is not coasting on
the null-returning fake. No empty-result path is touched by this
correction.

## 4. Review pin + the build marker this tree will produce

Following the G4 convention exactly (review artifacts on
`jedavid33-design/opal-reader`, branch `ui1-review`; the artifact
commit becomes the `/health` build marker when the tree is
deployed, stamped into `build-identity.mjs` at envelope assembly):

- Pin commit: **recorded in the completion filing** (the pinned
  copy of this report is the artifact; by construction it cannot
  name its own commit — the same shape as the G2 pin
  `414d83540e5704409f1b3d84267b232bd9377a40`, "D6 G2 build report
  (pinned for G3 review)", whose SHA the G4 record then cites).
- Pin contents: this report at `review/d6-seedfix-build-report.md`;
  the corrected entry and amended spec updated in place at
  `d6-review/worker/worker-entry-prod-d6.js` and
  `d6-review/worker/deploy-spec-prod-d6.json`; `CONTRACTS.md`
  updated in place at `d6-review/CONTRACTS.md`; the new and
  amended suites at `d6-review/seedfix/tests/`; the run evidence
  (summary, per-suite logs, client logs, diffs) at
  `d6-review/seedfix/logs/`. Parent: the branch head at pin time
  (`5bd1e6375c351526f461efc671f4bcca3f30e6d2`, the ui-pkg-4 pin).
- **When this tree is deployed at the future deploy gate, its
  `/health` build will read the seedfix pin commit's SHA** — and
  nothing else about the identity changes (version stays 2.0.0).

## 5. Deploy notes (for the future, separately gated deploy — NOT performed here)

1. Halted deploy of this one-module delta (+ spec text) using the
   standard envelope assembly from the pinned artifact; the
   upload metadata keeps GENERATION_HALT `"1"`, the same bindings
   (secrets as `{"type":"inherit"}` by name), compatibility date,
   and observability settings as the G4 upload.
2. **Pre/post read-backs (Rowan condition 6):** before upload and
   after — `/health` (build flips to the seedfix pin; generation
   stays "halted"), `GET /v2/settings` (revision 0, lane batch),
   `GET /v2/quota` (zeros), queue `opalreader-generation-v2`
   re-read (delivery_paused TRUE, sole consumer
   `opalreader-api-v2-prod`), bindings by name via
   `GET /workers/scripts/{name}/settings`.
3. **Observability re-check (standing Cloudflare lesson):** a code
   upload can silently reset script-settings observability to
   null. After the upload, GET
   `/workers/scripts/opalreader-api-v2-prod/script-settings`; if
   observability is null, re-apply it with the settings-only
   multipart PATCH to `/workers/scripts/{name}/settings` (NOT
   `/script-settings`), then verify the script etag is unchanged
   by the PATCH. (At G4 observability survived via the upload
   metadata and no PATCH was needed — check anyway.)
4. Post-deploy seed-route refusal checks (non-mutating, the G4
   g-series shape): no credentials → refused; client token only →
   403 `migration_operator_required`. **The operator-only
   admission itself is NOT to be exercised at deploy** — the first
   real seed invocation is arming step 1 under the fresh G9
   continuation Go (condition 7), after the safety preflights
   re-run.
5. Rollback: the G4 package (script etag `7c09c194…`, build
   `414d8354…`) is the rollback base; re-upload of the archived
   G4 envelope restores it byte-for-byte. Nothing about this
   correction migrates data, so rollback is a pure code restore
   at any point before the seed is invoked.

## 6. What did not change; what could not be proven here

Unchanged: the coordinator and its two gated hunks; the operator
admission block, stamp, and class gate; the generation service,
genstore, schema, executor, grant guards, eligible-set logic,
policy split, and settings CAS; the client in any byte; the
parked Ch 3 job; the frozen Shelf bridge; production in any way
(one read-only `/health` only).

Not provable inside a repo-only build, stated plainly:

- **The end-to-end transport fix against production** — that an
  operator-only request now traverses the credential exchange and
  reaches the Worker — can only be proven by the gated deploy +
  the arming continuation's seed call. It is strongly grounded
  (the Option D operator routes have crossed this same transport
  with a single surrogate throughout the P8 migration), but it is
  not proven by anything in this build.
- **Envelope assembly/validation** for the corrected spec was not
  re-run: the two envelope suites sit in the known-22 environment
  set (they require the pristine git checkout). The spec delta is
  one precondition string in parsed JSON (diffed above); bindings,
  vars, and topology are byte-identical values. Envelope
  validation belongs to the deploy gate's D1 step, as at G4.
- **Real-DO behavior of the seed write** is exercised here against
  a throwing-`.one()` facade over `node:sqlite`, not a live
  Durable Object; the live proof is the gated arming run's seed
  read-back, as designed.
