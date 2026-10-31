# QUOTA OPERATOR ROUTES — BUILD REPORT

**Task:** add the three operator invocation routes for the quota
guard (`bootstrapQuota` / `reconcileQuota` /
`disposeBootstrapException` — until now exported with **zero
callers** anywhere in the tree), per DP1 of Rowan's operational
review (board comment **6546037460**, issue #15,
`jedavid33-design/opal-roundtable`), and fold her four binding
amendments + the Option 3 sequencing into a revised deployment
plan.
**Authority:** Julie's repo-only build approval, board comment
**6546054510**. **Setting:** local tree
`~/workspace/ch2-program/quota-routes/`, copied from the
SOURCE-PASSED `quota-fix2` tree (pin
`3e6fd3af69fc5643acaca8caf74b7dc523808bfb`) before any edit;
`quota-fix2` itself was never modified.
**Scope compliance:** repo-only. No production calls, reads, or
writes of any kind; no deploy; no GitHub posts or pins; no
generation; no provider calls anywhere (all tests run on fakes).

---

## 1. What was built

### 1.1 The three routes (all in `worker/worker-entry-prod-d6.js`)

| Public route | DO-internal route | Store function | Class |
|---|---|---|---|
| `POST /v2/d6-quota-bootstrap` | `POST /internal/d6/quota-bootstrap` | `bootstrapQuota` | operator, state-changing |
| `POST /v2/d6-quota-dispose-exception` | `POST /internal/d6/quota-dispose-exception` | `disposeBootstrapException` | operator, state-changing |
| `GET /v2/d6-quota-reconcile` | `GET /internal/d6/quota-reconcile` | `reconcileQuota` | operator, read-only |

Each handler follows the file's established operator-surface
shape exactly: a predicate const in `fetchHandler`; inclusion
in `productionGate(..., { skipClientToken })`; inclusion in the
operator-admission block; a forward block building a fresh
internal request; and a handler inside
`OpalReaderCoordinatorProd.fetch` that re-checks the
operator-admitted stamp before doing any work, builds the
coordinator the same way every sibling handler does
(`new GenerationCoordinator(this.state, d6HostEnv(this.env,
cache))`), and flushes the cache afterward.

### 1.2 The fence, mapped to the seed-storage precedent

The seed route (`POST /v2/d6-seed-storage` →
`/internal/d6/seed-storage`) decomposes into five elements.
The quota routes reproduce four of them identically and differ
in one, deliberately:

| Fence element | Seed route | Quota routes |
|---|---|---|
| Production gate (scope `production` + instance `account` headers, else 403) | yes | **identical** |
| Entry admission: `OPALREADER_MIGRATION_OPERATOR_TOKEN` must exist, `OPALREADER_ACCESS_TOKEN` must exist, and operator ≠ access token, else 503 `migration_operator_not_configured`; header mismatch → 403 `migration_operator_required`; sets `operatorAdmitted` | yes | **identical** (the three predicates are added to the same admission block) |
| Unforgeable stamp: `forward()` sets `x-opalreader-operator-admitted` **unconditionally** (`"1"`/`"0"`), overwriting any client-forged value; internal requests are constructed fresh, so no other client header rides in | yes | **identical** |
| DO class gate: internal header required (403 `internal_only`), scope match, then the handler re-checks the stamp (403 `migration_operator_required`) | yes | **identical** |
| Client token requirement | seed requires **both** tokens (its predicate is *not* in `skipClientToken`) | **differs — deliberately.** The quota routes use `skipClientToken` (operator credential alone), the class of the five existing operator POST surfaces (phase-binding, retire-halted-plan, release-quarantine, reconcile-unknown, adjudicate-estimated) and the diagnostics GET |

**Why the divergence is the right reading of DP1:** the DP1
text Rowan accepted describes this class ("existing
migration-operator token class, production scope + instance
headers, operator-admitted stamp"), and the two most recent
operator acts in this program (gate 5's adjudication, gate 6's
retirement) were executed through the operator connector with
the operator credential alone. The seed route's both-tokens
requirement predates that class. The divergence is recorded
here and in the revised plan (§7.1) so the source review can
rule on it explicitly; flipping it is a two-line change
(remove the three predicates from `skipClientToken`) if Rowan
prefers the seed's stricter shape.

### 1.3 Per-route contracts

**Bootstrap — halt-only + figureless.**
- The handler refuses `{ outcome: "rejected", reason:
  "generation_not_halted" }` (HTTP 200 — the seed service's
  refusal vocabulary) unless `this.env.GENERATION_HALT ===
  "1"`, checked before any store contact.
- **Figureless means the allowlist is empty.** `bootstrapQuota`
  takes no parameters beyond the coordinator — there is no
  legitimate key to accept. The handler therefore refuses:
  any figure key (the adjudicate route's FIGURE_KEYS plus
  count/day/limit-shaped keys: `assigned`, `assignedCount`,
  `exceptionCount`, `limit`, `dayKey`, `dispatchDayKey`,
  `dispatched`, `reserved`, `consumed`) as
  `quota_bootstrap_figure_caller_supplied`; any other key as
  `quota_bootstrap_request_key_not_allowed`; a bare JSON
  number body as a figure; any other non-object shape as
  `quota_bootstrap_request_not_figureless`. An absent/empty
  body and `{}` are the only admissible shapes. All refusals
  happen before the store is touched — a refused bootstrap
  does not even create the quota tables (proven in QROUTE-8).
- Store errors are **not** caught: a bootstrap failure is a
  fault, not a refusal, and surfaces through the class's outer
  catch (500), exactly like the seed surface's faults.
- The response carries the bounded exception projection
  (≤ `QUOTA_ROUTE_DETAIL_LIMIT` = 100 entries of
  `{attemptId, phase, intervalDays}`, plus `exceptionCount`
  and `exceptionsTruncated`) and
  `providerAttemptDailyLimit: 100` (imported from the store
  module — the pinned constant, never a route-side literal).
- Idempotence is the store's and is preserved untouched: a
  second invocation returns `alreadyArmed: true, assigned: 0`
  and never rewrites the bootstrap record (QROUTE-9 proves the
  record byte-identical).

**Dispose — closed allowlist, store law untouched.**
- Halt-only, same refusal shape and position as bootstrap.
- The route enforces the closed allowlist
  `{ attemptId, dayKey, authorizationRef, source, note }`
  (exactly the store function's input shape) before calling:
  figure keys → `quota_disposition_figure_caller_supplied`;
  any other foreign key →
  `quota_disposition_request_key_not_allowed`; the three
  required fields must be nonblank strings
  (`attempt_id_required` / `day_key_required` /
  `authorization_ref_required`, mirroring the adjudicate
  handler's code style — `attemptId` and `authorizationRef`
  proceed trimmed, `dayKey` proceeds verbatim because the
  store's real-calendar validation owns its shape);
  `source`/`note` are optional strings bounded at 2000 chars
  (the adjudicate route's note bound) else
  `source_invalid` / `note_invalid`. One deliberate difference
  from adjudicate: `source` here comes from the **caller's
  body**, because the task's allowlist names it as a caller
  field (the store records it as provenance); at adjudicate
  the source is server-stamped because that route's contract
  does not include it.
- The store call is wrapped: store refusals surface as
  `{ outcome: "rejected", reason: <the store's named error
  code> }` (the code is the message's first colon-delimited
  segment — the store's codes are the contract). **The Hold-B
  law stays entirely in the store**: multi-day intervals
  refuse `quota_disposition_ambiguous_interval`, checked in
  the store before the interval bounds; no route input can
  weaken it (QROUTE-12 proves both days of a straddle refuse,
  with byte-identical state).
- No route-side ID format is imposed: real attempt IDs are
  `att-<uuid>`, repo fixtures use short IDs, so "malformed"
  follows the codebase discipline — non-string/blank → route
  refusal; well-formed-but-unknown → the store's
  `attempt_not_found`.

**Reconcile — SELECT-only, bounded, auditable.**
- No halt fence (a read changes nothing in either halt state;
  the diagnostics-read precedent). The handler adds no write
  of any kind around the store's SELECT-only function.
- Pre-bootstrap, the store's floor shape
  `{ armed: false, ok: false, reason: "not_armed" }` passes
  through untouched (this is the exact shape gate (a)'s D4
  will verify live).
- When armed, the identity-bearing detail arrays (`drift`,
  `exceptions`) are capped at 100 entries with **exact counts
  and explicit truncation flags** (`driftCount`,
  `driftTruncated`, `exceptionCount`, `exceptionsTruncated`)
  added alongside — bounded and auditable per DP1, never
  silently cut (QROUTE-15 proves the bound with 107
  exceptions). Aggregates (`totals`, `dayTotals` — counts per
  day, no identities) pass through whole. Nothing is logged.

### 1.4 Queue-pause: what the code can and cannot check (explicit finding)

DP1 requires halt **and** queue-pause verification around
state-changing production calls. The halt half is enforced in
code (above). **The queue-pause half cannot be checked from
inside the Worker**: the tree's queue binding is used
send-only, and no binding, env value, or DO surface in the
tree exposes a queue's `delivery_paused` state — that state
exists only on the Cloudflare API side (the cf-api reads this
program has used at every gate). Inventing an in-code proxy
(e.g. trusting an env flag) would be weaker than the real
check and is not done. Instead, per the task brief, the
revised plan encodes queue-pause as an **execution-time
precondition of gate (b)**: step B0 re-verifies halt + pause
by cf-api read-back immediately before the bootstrap call and
again before any disposition call, in the same session, and a
failed re-verification is a STOP (§4.0/§4.1 of the revised
plan).

### 1.5 What was NOT changed

- **`quota-budget.mjs` needed no export change** (flagged per
  the task's constraint): `bootstrapQuota`,
  `disposeBootstrapException`, `reconcileQuota`, and
  `PROVIDER_ATTEMPT_DAILY_LIMIT` were already exported; the
  entry imports them. The file is byte-identical (§2).
- The store functions' accounting logic, the cache-refresh
  code, and all unknown-billing protections are untouched —
  route wiring only.
- No deploy spec, no client file, no other worker file.

---

## 2. File-by-file before/after SHA-256 (vs quota-fix2)

Recursive diff of the whole tree (excluding `logs/`,
`logs-baseline/`, this report, and `run-battery.sh`'s comment
line) shows **exactly two** differing paths: the entry file and
the new test file. `worker/` and `v2/` are one physical tree
(symlink); byte-identity between the mirror layers is
automatic and was also verified by direct recursive compare.

| File | quota-fix2 (before) | quota-routes (after) |
|---|---|---|
| `worker-build/worker/worker-entry-prod-d6.js` (1,182 → 1,472 lines) | `079e982bee8135a95240cd1ac4f22d5a02b28f65b945f3b2a8050c702403c154` (64,548 B) | `91ab9d5c3ef1afc1a9d45fb74e66691a24c93d4298ba53ae962ee372b9898e51` (80,488 B) |
| `worker-build/tests/quota-operator-routes.test.mjs` (NEW, 597 lines, 15 tests) | — | `f68eaed8dcbb7580000c4fe631ad2fa7cf92290f92a9644b83062455329c6fdc` |
| `worker-build/worker/generation/quota-budget.mjs` | `2b39924579e5af2d5d20eea01122d2323ccedac9fe9ff9f7026c49af14770820` | **identical** |
| `worker-build/worker/coordinator.mjs` | `5d0727638b24e497c7b7ca73d6deead411a5ebc8e475163f78aa0b01d72a3de5` | **identical** |
| `worker-build/worker/generation/d6-executor.mjs` | `c3613a818f598a2fc9f0f975312ad76879edab6bdffcdd06fe3fb2e3b123984c` | **identical** |
| `worker-build/worker/generation/genstore.mjs` | `811b6b15b790097ad0010be3c71881c5024331143b4b0e2031392287bb839c2a` | **identical** |
| `worker-build/worker/generation/gen-constants.mjs` | `9af664fafc61dff1c16de8f94d06c0097271313bae7327d2a9a9d16efe14c77d` | **identical** |
| `worker-build/worker/generation/service.mjs` | `aeeee06c8af9789426ae8135bd020be77e8ef3ea350de744472743e3dd14bd1d` | **identical** |
| `worker-build/worker/host/adapters.mjs` (cache refresh) | `f8ac357e3ca4d23bb9edd46dab1843257d26c6fafe6a52b3fffaff676a749368` | **identical** |
| `REVISED-DEPLOY-PLAN.md` (NEW, 695 lines) | — | `3303d3e70353dfa38edb2d72a85ceca0c7c322bbe74db79d6abd8b40bc775235` |
| `run-battery.sh` | comment line only ("quota-routes tree") | — |

Inside the entry file, the diff is: **292 added lines, 2
modified lines** — and the 2 modified lines are exactly the
two fence-wiring lists (the `productionGate` skip list and the
operator-admission condition), each extended with the three
new predicates. Everything else is pure addition: the header
package note, the quota-budget import, the
`QUOTA_ROUTE_DETAIL_LIMIT` constant, the three class handlers,
the three predicates, the three forward blocks.

**Envelope consequence** (stated as this tree produces it):
28 module parts — the entry part moves from byte-identical to
**CHANGED**, so vs live the envelope is now **7 changed + 1 new
(quota-budget) + 1 assembly-stamped + 19 identical**, total
module bytes **1,327,787** at tree stamp size (was 1,311,847).
The revised plan's D1 regenerates all of this from the pinned
tree as harness output (Amendment 4).

---

## 3. Test inventory — every DP1-required case, mapped

New suite: `worker-build/tests/quota-operator-routes.test.mjs`
— 15 tests, all passing, deterministic fakes only
(throwing-`.one()` `node:sqlite` facade in the
`ch2disp-route.test.mjs` house shape, inert R2 — no provider
surface exists in the fixture at all). Fixture history: four
floor-build attempts — a `dispatching` row (assignable), a
same-day confirmed row (assignable), a PT-straddling confirmed
row (exception), and a confirmed row whose execution record is
missing (unattributable exception); a fifth same-day
attributable row is seeded *after* bootstrap in disposition
tests, simulating a floor-build dispatch during a rollback
window.

| DP1-required test | Case(s) |
|---|---|
| Happy paths, all three endpoints | **QROUTE-1** (bootstrap classifies 2 assigned / 2 exceptions; reconcile armed + clean; a late exception disposes and leaves the exception list) · **QROUTE-2** (reconcile pre-bootstrap floor shape) |
| Absent credential | QROUTE-3 ("absent" arm, all three routes, zero writes) |
| Wrong credential | QROUTE-3 ("wrong" arm) · QROUTE-2 (reconcile without credential) |
| No client-facing access | QROUTE-3 ("client token alone" arm) · QROUTE-2 (client-token-only reconcile → 403) |
| Spoofed admitted header | **QROUTE-4** — (a) stamp forged on the public request without the operator credential → 403; (b) direct DO-class calls to all three internal paths without the stamp → 403 each; (c) stamp without the internal marker → 403 `internal_only` |
| Wrong scope / instance | **QROUTE-5** — staging scope → `production_scope_required`; foreign instance → `production_instance_required`; class-level scope mismatch → 403 |
| Method mismatch | **QROUTE-6** — GET on the public POST surface and POST on the public GET surface fall to the client gate (401, never admitted); class-level POST-to-GET-path → 405 and GET-to-POST-path → 404 fall-throughs; zero state change throughout |
| Absent operator secret | **QROUTE-7** — secret binding unset → 503 `migration_operator_not_configured`; secret aliased to the client token → 503 |
| Figure injection into bootstrap | **QROUTE-8** — nine shapes (assigned/limit/dayKey/cost keys, a foreign key, bare number/string/array bodies), each refused by name, no tables created; the empty body then applies |
| Malformed attempt IDs | **QROUTE-11** — numeric `42` and blank `"   "` attemptIds (and a missing one) → `attempt_id_required`, zero movement |
| Duplicate attempt IDs | **QROUTE-13** — the same attempt disposed twice: the second refuses `quota_disposition_not_an_exception`, state byte-identical |
| Unknown-interval disposition refusal | **QROUTE-12** — unknown attempt → `attempt_not_found`; a day outside the evidence interval → `quota_disposition_day_outside_evidence_interval`; a non-calendar day → `quota_disposition_day_invalid` |
| Straddling-interval refusal | **QROUTE-12** — the straddler refuses `quota_disposition_ambiguous_interval` naming *either* of its days (Hold B intact at the route) |
| Bootstrap idempotence | **QROUTE-9** — second invocation `alreadyArmed: true, assigned: 0`, bootstrap record byte-identical, full state snapshot identical |
| Halt fence on state-changing routes | **QROUTE-10** (bootstrap) · **QROUTE-14** (dispose, refusal precedes store contact) |
| Closed disposition allowlist | **QROUTE-11** — foreign key, two figure keys, required-field and type/bound validation, array body; every refusal with a byte-identical state snapshot |
| Bounded reconcile output (DP1's bounded/auditable term) | **QROUTE-15** — 107 exceptions: detail capped at 100, counts exact, truncation flags true; plus the route-inventory assertions over the entry source |

No existing suite was edited. No baseline failing suite
changed status (§4).

---

## 4. Battery — before / after

Full battery on the final tree (`run-battery.sh`; per-file
`node --test` over `tests/*.test.mjs`; complete log + runner
exit code in `quota-routes/logs/`; the quota-fix2 battery
preserved in `quota-routes/logs-baseline/`):

| | Suites | Tests |
|---|---|---|
| quota-fix2 (baseline) | 134 total — **112 pass / 22 fail** | 1,079 total — **1,057 pass / 22 fail** |
| quota-routes (this build) | 135 total — **113 pass / 22 fail** | 1,094 total — **1,072 pass / 22 fail** |
| **Delta** | **+1 suite, passing** | **+15 tests, all passing** |

- The delta is **exactly** the new suite
  (`quota-operator-routes.test.mjs`, 15/15, per-file exit 0).
- The 22 failing suites are **set-identical** to the baseline
  (`diff logs/failing-files.txt logs-baseline/failing-files.txt`
  — clean; same known v1-freeze-harness baseline set, untouched
  by this build, as in every prior build in this program).
- **Zero `AssertionError`** in the full log; runner exit code
  **0** (`RUNNER_EXIT=0`).

---

## 5. The revised deployment plan (companion deliverable)

`REVISED-DEPLOY-PLAN.md` in this directory supersedes
`deploy-proposal/DEPLOY-PROPOSAL.md` for execution purposes:

- **Option 3** (DP2 as Rowan resolved it): one combined code
  deploy of this tree; the P1 metadata halt PUT and the D2 code
  PUT both remain and are named as two PUT-class acts.
- **Amendment 1:** read-only **P0** census + race fence before
  P1, with named STOP conditions; P3 re-proves the census
  identical across the halt transition; the plan states
  plainly that a late halt is not proof a pre-P1 request was
  canceled.
- **Amendment 2:** the old "listening drift" rule is struck in
  the plan's §2.2.1 — bindings/content drift needs a per-entity
  provenance diff; unexplained = STOP; Ch 2 / Ch 3 keep strict
  identity.
- **Amendment 3:** an explained `ok === false` closes gate (b)
  only as a **documented accounting hold**; §4.5 states the
  re-arm law (guarded build + `ok === true` read at the re-arm
  moment + Julie's separate GO; multi-day holds expire only
  when the clock leaves the interval and a fresh `ok: true`
  reads; missing route / failed bootstrap = do not re-arm);
  §5.3 conforms the rollback section to it.
- **Amendment 4:** D1 rewritten against the **final combined
  tree** (fresh pin/inventory, all changed/new hashes, stamp
  exactly once, counts as harness outputs, negative mutations
  including a **spoofed-operator-route** source assertion, and
  the fake/harness rehearsal record as a D1 deliverable); D4
  verifies the downloaded parts, the floor-shaped **unarmed**
  quota view via the now-live reconcile route, and data
  integrity — no smoke claimed.
- Gate (b) is rewritten around the real routes (§4.0–4.4),
  including the B0 halt+pause re-verification that substitutes
  for the in-code queue check the Worker cannot perform (§1.4
  above).
- The 8/7/3 cohort correction is carried (§7.3 of the plan).

---

## 6. CONFIRMED / INFERRED / OPEN

**CONFIRMED (by direct check in this build):**
- The three store functions had zero callers before this build
  (repo-wide grep over `worker/`, both mirror layers) and
  exactly one caller set now (this entry file).
- Change surface is exactly the entry file + the new suite
  (whole-tree recursive diff; §2 hashes).
- `worker/` ≡ `v2/` byte-identical after the build.
- Battery delta is exactly the new suite; failing set
  identical; zero assertion failures; runner exit 0.
- The Worker cannot read queue pause state from any binding
  or surface in this tree (source-level check of the queue
  binding's uses — send-only).
- The seed route's fence decomposes as §1.2's table states
  (read from the entry source, this tree).

**INFERRED (reasoned, labeled as such):**
- The operator-alone fence class (vs the seed's both-tokens
  shape) is the class DP1 intended — from the DP1 text and
  the gates 5–6 execution precedent (§1.2). Rowan's source
  review is the ruling that settles it; the flip is two lines
  if she rules otherwise.
- The dispose route's refusal-vocabulary split (route-shaped
  refusals returned as 200 `{outcome:"rejected", reason}`,
  store codes passed through) matches the adjudicate/reconcile
  precedent; no spec names these strings for the quota routes,
  so they are this build's proposal, open to rename at review
  without behavioral change.

**OPEN (unchanged by this build):**
- Winner provenance (Signature A) — unresolved; no R2 read
  taken or proposed here.
- First real-DO execution of everything in this program
  remains gate (b)'s bootstrap. Harness proof — including
  this suite's throwing-`.one()` facade — is not real-DO
  proof; the DDL-only lazy-bootstrap pattern is the standing
  mitigation, and gate (b) is itself a single, halt-held,
  read-back-verified act for exactly that reason.
- The project's Google-side limit and any outside-Reader usage
  of the same project remain unknown; the counter enforces
  the application's own cap only.

---

## 7. Honest limitations

- All route proof is harness proof against fakes. The
  production fence's live behavior (connector surrogate,
  header handling at the edge) is exercised for the first time
  by gate (a)'s D4 reconcile read — a read-only surface,
  chosen for exactly that reason.
- The internal method-mismatch fall-through statuses (405 /
  404) are the base class's own dispatch answers, pinned as
  observed in QROUTE-6; a future base-class change could move
  them without weakening the fence (the fence assertions are
  the 403s and the zero-state-change checks).
- The bounded-output cap (100) is a route-level constant.
  Gate (b)'s B2 law (enumerate ALL exceptions before the gate
  closes) is a runbook obligation the cap makes visible, not
  one the code discharges by itself.

— End of report —
