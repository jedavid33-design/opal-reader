# Chapter 2 Fix Package — Build Report (Workstream B)

**Status: BUILD COMPLETE, battery-verified. PIN + BOARD FILING PENDING — `ui1-review` head moved during the build (see §6).**
Authorization: Julie, Oct 30, 2026 (Chapter 2 program; board record 6531496748, issue #15, `jedavid33-design/opal-roundtable`).
Base: copy of `~/workspace/gen-pkg-1/worker-build/` (the live gen-pkg-1 worker source; the gen-pkg-1 tree was never edited in place) at `~/workspace/ch2-program/fix/worker-build/`, verified byte-identical to the base before edits (792 files, `diff -rq` clean).
Diagnosis of record: `~/workspace/d6-build/deploy-evidence/followon-fp/ch2-halt-diagnosis.md`. Halted plan: `plan:603ab416bd67ab1b25de97be` — 8 failed, 1 unknown_billing, 9 never attempted, 0 committed.
Scope discipline: repo-only build. **No production contact. No board posts. Client tree untouched — this is a worker-only package; no client change is needed** (fix 2's route is operator-only by design; fixes 1 and 3 are worker-internal behavior).

---

## 1. Fix 1 — Gemini 3.8 block mapping (interactions branch)

**Defect (diagnosis Q5, branch (b) most likely):** in `worker/host/adapters.mjs`, the 3.8 *interactions* branch turned an HTTP-200 no-audio/blocked response into a synthesized 502 with `httpStatus` but **no** `contentBlocked`, so the executor classified each refusal as a known one-call provider failure and the recursive POLICY_BLOCK splitting path (feature law F3) never engaged. The generateContent branch already mapped block signals correctly; the interactions branch now mirrors its semantics.

**Change** — `worker/host/adapters.mjs`, comment at line 240, throw at lines 272–276: on a no-audio HTTP 200, the adapter now collects block signal text (response/step `finishReason`/`blockReason`/`status`) and any refusal text parts, and throws with `contentBlocked: true`, `blockReason: "PROHIBITED_CONTENT"` when a prohibited-content signal is present, else `"POLICY_BLOCK"` — the exact shape `policy-split.mjs` consumes. Non-200 errors keep the existing `throwProviderError` classification, untouched; a malformed-JSON 200 still throws unclassified (billing-unknown, fail-closed), untouched. **No voice substitution anywhere**: split retries carry the original payload's voice/model/style with only the text cut (asserted on recorded calls).

**Tests** — `tests/ch2fix-adapter-block.test.mjs` (6/6): text-refusal 200 → `contentBlocked`/`POLICY_BLOCK`; explicit PROHIBITED_CONTENT signal → parity `blockReason`; clean 200 → one call, audio byte-identical; HTTP 500 / non-policy 400 / transport throw → classifications unchanged (no `contentBlocked`); end-to-end through the real adapter + splitter: blocked whole → 2 halves succeed, `attemptsUsed` 3, call texts concatenate exactly, voice/model identical on every call; always-refused segment terminates as `TerminalBlock`.

## 2. Fix 2 — Reconcile invocation path (operator-only)

**Defect:** `genstore.reconcileUnknown` existed with no production caller ("built but never wired" — the 1 unknown-billing attempt could never be settled).

**Changes:**
- `worker/generation/genstore.mjs` — audit schema at line 317 (`d6_reconcile_audit`, DDL beside its only writer per the `d6_plan_retirements` precedent, deliberately NOT in `GEN_SCHEMA`); `reconcileUnknown` at line 343 extended with `{ planId, note, source }`: a supplied `planId` that does not own the attempt throws `reconcile_plan_mismatch` (line 350); the audit row is inserted at line ~385 **in the same transaction** as the settlement. Settlement preconditions unchanged (attempt must exist and be `confirmed`/`unknown`; refusals move nothing); return shape unchanged.
- `worker/generation/service.mjs` — comment at line 396 updated (the handle already passed opts through and already mapped `reconcile_*` errors to reasons; no functional change).
- `worker/worker-entry-prod-d6.js` — header note at line ~161; public route `POST /v2/d6-reconcile-unknown` defined at line 787, joined to the `skipClientToken` set and the operator-admission condition at line 832 (same fence class as phase-binding / retire / release: production gate skips the client token, admission on the migration-operator credential alone, 503 if unconfigured), forward block at line 971; class-gate handler `/internal/d6/reconcile-unknown` at line 582 requiring the `x-opalreader-operator-admitted` stamp (403 otherwise).

**Route preconditions (stated + enforced):** operator-admitted stamp only (client token alone refused; unstamped direct internal call refused); `attemptId` required (`attempt_id_required`); the settlement is **explicit** — `knownCostMicro` must be present and either a finite number ≥ 0 or exactly `null` = proven no-charge (`known_cost_required` / `known_cost_invalid` — an absent or malformed value can never silently become a no-charge settlement); `outcome` only `"success"`/`"failed_known"` (`outcome_invalid`); optional `planId` must match (store-enforced); attempt must be confirmed/unknown (`attempt_not_found` / `attempt_not_unknown`). The recorded `source` is stamped server-side (`"operator-route"`), never caller-supplied. **Safe in BOTH halt states by construction**: reconcile settles one attempt's cost record, at most clears the phase's unknown-billing flag, and writes an audit row — it creates no plan, grant, or execution, and cannot resume anything.

**R4-1 regression (mandatory, the exact sequence round 4 missed)** — `tests/ch2fix-reconcile-route.test.mjs` (7/7), entry-level worlds in **both** `GENERATION_HALT` `"1"` and `"0"`: settle the halted plan's unknown attempt **through the new route**, then 3 `driveOnce()` cycles + the production alarm shape (`inst.alarm()`): the plan row is **byte-identical**, still `halted_unknown`, never selected by the driver, zero new attempts/executions/queue messages — and `retireHaltedPlan` (the only designed exit) still applies afterwards. Also covered: all three fence refusals; malformed-settlement refusals moving nothing; plan-mismatch refusal with no audit row; applied no-charge settlement (attempt `failed_known` @ 0, `haltCleared: true`, phase halt cleared, exactly one audit row with route-stamped source); settle-exactly-once.

**Verified present in this base:** the R4-1 driver exclusion (`driveOnce` SELECT excludes `halted_unknown` at selection) — confirmed in code and exercised end-to-end by the regression above.

## 3. Fix 3 — Long-segment timeout incidence (pre-dispatch split)

**Diagnosis basis:** the unknown-billing attempt is most likely the 120 s `AbortSignal.timeout(120000)` on the Gemini fetch. At the cost model's pinned slowest speaking rate (10 chars/s, `upperBoundAttemptMicro`), 120 s of fetch window corresponds to **1,200 chars** — that is the threshold: `PRE_SPLIT_MAX_CHARS = 1200` (`worker/generation/policy-split.mjs` line 200; derivation comment in code). At the realized 15.96 chars/s a 1,200-char call is ~75 s of audio, comfortably inside the window. **Unknown billing stays fail-closed** — no timeout is reclassified; this reduces incidence, and fix 2 is the settlement path for any unknown that still occurs.

**Changes:**
- `worker/generation/policy-split.mjs` — **additions only** (+80/−0 vs base): `PRE_SPLIT_MAX_CHARS` (line 200), `preSplitText` (line 207; recursive `splitText` halving — chunks concatenate exactly, in order), `synthesizeLongSegment` (line 282; per-chunk `synthesizeSegment` over one **shared** budget object, so the pinned 12-attempt per-segment ceiling binds across the whole segment). `synthesizeSegment` itself is **byte-identical to the base** (verified by diff).
- `worker/generation/d6-executor.mjs` — import (line 59) + pre-dispatch branch (lines ~361–373): segments over the ceiling route through `synthesizeLongSegment`; at/under it, the call is the identical single `synthesizeSegment` call the executor has always made. Parts flow into the executor's existing stitch path unchanged; the cache fingerprint is still over the full segment payload.

**Seam disclosure (the one design judgment in this package):** the pre-split was first composed *inside* `synthesizeSegment`; the full battery showed that breaks two pinned baseline assertions in `tests/d6-policy-split.test.mjs` (exact split-tree call count 31 → 30; a depth-terminal fixture resolving instead of throwing), because that suite pins whole-segment semantics — exact call counts and depth from the segment root — on fixtures over 1,200 chars. Rather than edit a baseline suite (forbidden without Julie's separate authorization), the composition moved **above** the pinned contract to the executor's pre-dispatch seam, where no baseline fixture operates (no baseline suite dispatches a >1,200-char segment through the executor). The baseline suite passes unmodified; the deviation and its reason are recorded here and in the test file's header for Rowan's review.

**Tests** — `tests/ch2fix-presplit.test.mjs` (9/9): threshold value + derivation; `preSplitText` identity at/under ceiling, exact-concat above; under-threshold passthrough (1 call, original text); over-threshold pre-split (all calls ≤ 1,200 chars, exact concat, shared budget accounting); policy composition inside a chunk; the shared 12-attempt ceiling binding across chunks (`attempt_budget_exhausted` at exactly 12 calls — a per-chunk reset would allow ~28); `synthesizeSegment` whole-segment semantics unperturbed on direct calls; **executor integration**: a 2,600-char segment commits from pre-split chunks (every provider call ≤ ceiling, texts concatenate exactly, voice identical, stitched WAV = 44 + 480 × calls, one binding), and an under-threshold segment is the unchanged single call.

## 4. Full battery (corrected tree, one complete run)

Runner: `~/workspace/ch2-program/fix/logs/run-worker-battery-final.py`; logs: `~/workspace/ch2-program/fix/logs/final/` (+ `final-run.out`).

- **126 suite files: 104 pass / 22 fail. 981 tests: 959 pass / 22 fail. Assertion failures: NONE.**
- The 22 failing suites are **exactly** the recorded D8 baseline failing set on this base tree (123 files / 959 tests / 937 pass / same 22, zero assertion failures) — verified by set diff. Deltas reconcile exactly: +3 new suites (all pass), +22 new tests (all pass).
- **Zero baseline-suite edits.** Zero candidate-suite amendments were needed in the new suites (no assertion was weakened; two new-suite fixtures were corrected during development — word-salad geometry for the budget test, executor seam for fix 3 — each disclosed in the test file).
- Environment note: four suites resolve a sibling `opal-reader-p8-data/` path relative to the tree; a symlink shim at `~/workspace/ch2-program/opal-reader-p8-data` → `~/workspace/opal-reader-p8-data` (outside the pinned tree) makes them pass, identically for baseline and final runs.

## 5. Delta vs base (complete)

Modified (6): `worker/host/adapters.mjs` (+39/−1), `worker/generation/genstore.mjs` (+42/−1), `worker/generation/service.mjs` (+18/−2, comment-only), `worker/generation/policy-split.mjs` (+80/−0), `worker/generation/d6-executor.mjs` (+19/−2), `worker/worker-entry-prod-d6.js` (+112/−2). (`v2/…` paths in the tree are a symlink to `worker/` — same files.)
Added (3): `tests/ch2fix-adapter-block.test.mjs`, `tests/ch2fix-presplit.test.mjs`, `tests/ch2fix-reconcile-route.test.mjs`.
SHA-256 of the nine files: recorded in the filing (and reproducible from the pinned tree).

## 6. PIN STATUS — STOPPED per instructions (head moved)

The task specified pinning as a child of `ui1-review` head `548a0ffefdd263643506ed26fd984aa8dbb449b4`, STOP if the head moved. Verified via the GitHub API during this build: `ui1-review` lives in `jedavid33-design/opal-reader`; its head is now **`8bd9d4ac748d9d8c68fc5d9bda8af769c971f315`** — exactly one commit ahead (compare: ahead_by 1, behind_by 0), sole parent `548a0ffe…`, message *"rearm-fence: design packet + redelivery trace evidence (Chapter 2 program, Workstream A)"*, committed 2026-10-30T19:22:21Z. That is the parallel Workstream A pin landing during this build — a clean linear advance, no divergence. Per the stop condition, **no pin was made and no board filing was posted** (the filing reports the pin hash). The corrected tree + this report are complete locally and can be pinned as a child of `8bd9d4ac…` in one step on the parent's confirmation.

## 7. Gates that remain Julie's (unchanged by this package)

Deploy of this package; ANY production use of the reconcile route (settling the actual Ch 2 unknown attempt); retiring the halted Ch 2 plan; re-arm (queue unpause + halt flip — additionally gated on Workstream A's fence case); any generation. This build authorizes none of them.
