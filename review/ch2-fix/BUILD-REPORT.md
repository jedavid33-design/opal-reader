# Chapter 2 Fix Package — Build Report (Workstream B)

**Status: BUILD COMPLETE, battery-verified; pinned `22a849a8…` and filed for source review (issue #15 comment 6531884520). Rowan's review returned a HOLD with three focused items (B1/B2/B3); corrections are applied and recorded in §8, with a fresh battery, for an evidence-only re-pin and re-review.** (§6 records the original pin stop; the pin was subsequently made as a child of `8bd9d4ac…` on the parent agent's confirmation — see the run record.)
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

**Diagnosis basis:** the unknown-billing attempt is most likely the 120 s `AbortSignal.timeout(120000)` on the Gemini fetch. At the cost model's pinned slowest speaking rate (10 chars/s, `upperBoundAttemptMicro`), 120 s of fetch window corresponds to **1,200 chars** — that is the threshold: `PRE_SPLIT_MAX_CHARS = 1200` (`worker/generation/policy-split.mjs`; derivation comment in code). At the realized 15.96 chars/s a 1,200-char call is ~75 s of audio. **CORRECTED per B3 (§8.3): the threshold bounds only the audio-duration component of request latency; it is NOT a guarantee that a ≤1,200-char request completes within the 120 s ceiling** — end-to-end latency includes unbounded provider/network components. **Unknown billing stays fail-closed** — no timeout is reclassified; this reduces incidence, and fix 2 is the settlement path for any unknown that still occurs.

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

## 8. Corrections — Rowan HOLD B1/B2/B3 (Oct 30, 2026)

Rowan's source review of pin `22a849a8…` accepted the architecture (pre-split seam, operator fencing, driver non-resumption, unchanged baseline failure set) and held the package on three focused items. All three are corrected below; the corrected tree was re-run through the FULL battery (§8.4). Disclosed candidate-suite amendments: confined to this package's own three `ch2fix-*` suites (headers/fixtures/assertions as itemized per fix). **Zero baseline-suite edits; the failing-suite set is unchanged (§8.4).**

### 8.1 B1 — Ambiguous HTTP-200 no-audio response (adapters.mjs)

**Defect Rowan found:** fix 1 as first built marked EVERY no-audio interactions 200 `contentBlocked: true`, even with no refusal signal — spending extra provider calls splitting an ambiguous response and recording an uncertain outcome as a known zero-cost policy block.

**Correction:** the branch now applies the generateContent branch's evidence standard. It collects the structured signal fields (`finishReason`/`blockReason`/`status`, top-level and per model-output step) and any text parts, and throws `contentBlocked` ONLY on sufficiently clear policy-refusal evidence: a prohibited/policy/block signal in the structured fields, or refusal language in a text part (`blockReason` remains `PROHIBITED_CONTENT` when a prohibited signal is present, else `POLICY_BLOCK`). With NO such evidence the response is **unclassified**: the adapter throws a plain error (`code: "no_audio_unclassified"`) with NEITHER `contentBlocked` NOR `httpStatus` set — the same shape as a transport throw — so the executor confirms the attempt as unknown-billing (cost null) and halts the phase fail-closed. An ambiguous response never fuels a split and is never recorded as a known zero-cost block.

**Tests** — `tests/ch2fix-adapter-block.test.mjs` now **9/9** (+3): structured policy signal with no text → blocked; no-audio with no evidence (bare empty output; benign `STOP` + non-refusal text) → unclassified shape, exactly 1 call; splitter does NOT engage on the unclassified shape (error rethrown untouched after exactly 1 call, budget −1). Prior tests unchanged and passing: text-refusal → `POLICY_BLOCK`; `PROHIBITED_CONTENT` signal parity; clean 200 untouched; 500/400/transport classifications unchanged; end-to-end splitter engagement; `TerminalBlock` termination.

### 8.2 B2 — Reconciliation contract (genstore.mjs, service.mjs, worker-entry-prod-d6.js)

**Defects Rowan found:** (i) `knownCostMicro: null` was accepted with `outcome: "success"` (recorded as success @ 0); (ii) the route treated `planId` as optional.

**Correction — a validated settlement contract.** The settlement outcomes are now a distinct vocabulary — `"success"`, `"failed_known"`, `"no_charge"` — validated as a (cost, outcome) PAIR in the store before anything moves:
- finite number ≥ 0 (a known cost) → outcome `"success"` (default) or `"failed_known"`; `success` REQUIRES the finite known cost. A numeric cost with `"no_charge"` refuses.
- exactly `null` (proven no-charge) → the ONLY consistent outcome is the new distinct value **`"no_charge"`** (default when outcome is omitted at the store layer). Null with `"success"` or `"failed_known"` refuses as `reconcile_settlement_inconsistent`. On the attempt log a no-charge settlement records `failed_known` @ 0 (the attempt-log vocabulary has no no-charge value; phase accounting treats it as settled zero — the baseline-pinned behavior, unchanged); the distinct settlement outcome is preserved on the audit row's `final_outcome` and surfaced in the service/route result as `settlementOutcome`.
- malformed costs (non-number, NaN, infinite, negative — the latter two previously slipped the store's typeof check) refuse as `reconcile_cost_invalid`; outcomes outside the settlement vocabulary (incl. `"policy_block"`, which is an attempt classification, not a settlement) refuse as `reconcile_outcome_invalid`. All refusals throw inside the transaction: zero state movement, zero audit rows.
- **Route:** `planId` is now REQUIRED (`plan_id_required`) and `outcome` is REQUIRED (`outcome_required`); the store verifies the planId against the attempt's server-stamped `plan_id` linkage (`reconcile_plan_mismatch` — unchanged mechanism, now always exercised). The service layer keeps its prior shape for its existing callers (the gen-pkg-1 clearance flow passes explicit numeric settlements; its suite passes unmodified).

**Tests** — `tests/ch2fix-reconcile-route.test.mjs` now **9/9** (+2, fixtures amended to carry the now-required fields — disclosed in the suite header): missing/empty planId → `plan_id_required`; absent outcome → `outcome_required`; **contradictory settlements (null+success, null+failed_known, numeric+no_charge) → rejected with the attempt byte-identical, the phase halt standing, and ZERO audit rows**; applied no-charge asserts `settlementOutcome: "no_charge"` + audit `final_outcome: "no_charge"` against the attempt log's `failed_known` @ 0; known-cost success asserts audit parity. **The mandatory R4-1 regression is unchanged and passes in both halt states** (route reconcile → 3× `driveOnce()` + alarm: plan byte-identical, still `halted_unknown`, zero new attempts/executions/queue messages, `retireHaltedPlan` still applies). Baseline-pinned store defaults are preserved and verified by the unmodified baseline suites (`d6-genstore`: bare number → success, bare null → `failed_known` @ 0; `d6-grant-guards`; `genpkg1-halted-fence`).

### 8.3 B3 — Timeout threshold honesty (policy-split.mjs comments; threshold UNCHANGED)

**Rowan's point:** `PRE_SPLIT_MAX_CHARS = 1200` was justified as 120 s × 10 chars/s, but that bounds only the audio-duration component; generation has additional latency, so 1200 cannot guarantee completion within the 120 s fetch ceiling. **Decision: Rowan's option (b)** — keep 1200, correct every guarantee claim to an incidence-reduction claim, name the backstop. Justification (also recorded in the code comment at `PRE_SPLIT_MAX_CHARS`):
- Margin analysis: at the pinned slowest rate the margin is exactly ZERO (1,200 chars ⇒ up to 120 s of audio alone); at the realized 15.96 chars/s a max-size call is ~75 s of audio, leaving ~45 s of headroom for ALL non-synthesis latency (provider queueing/processing, time-to-first-byte, network) combined.
- No lower threshold can produce a guarantee either: it would widen only the duration-component margin while the other components remain unbounded by anything in the code. A guarantee claim would be false at any threshold.
- The residual risk is therefore carried by design: a call that still times out classifies unknown-billing (fail-closed, phase halts) and is settled explicitly through fix 2's reconcile path. Preserved invariants: unknown-billing fail-closed behavior; exact text concatenation; identical voice on every chunk; the shared segment-wide 12-attempt ceiling (`synthesizeSegment` remains byte-identical to base — comment-only change in this file).
- Wording corrected in: the `policy-split.mjs` pre-split comment (the former "guarantees … fits the window" sentence), §3 above, the `ch2fix-presplit` suite header + first test name (no assertion changes). The executor's existing comment already used incidence language ("make that outcome rarer") and is unchanged.

**Tests** — `tests/ch2fix-presplit.test.mjs` **9/9** (unchanged assertions).

### 8.4 Battery (corrected tree, one complete run)

Runner: `~/workspace/ch2-program/fix/logs/run-worker-battery-b1b2b3.py`; logs: `~/workspace/ch2-program/fix/logs/b1b2b3/` (+ `b1b2b3-run.out`); runner exit code 0.

- **126 suite files: 104 pass / 22 fail. 986 tests: 964 pass / 22 fail. Assertion failures: NONE.**
- The 22 failing suites are **exactly** the recorded D8 baseline set — verified by set diff against the fix package's own final run (`logs/final/failing-files.txt`), which was itself set-diffed against the D8 baseline. Delta vs the original fix-package battery reconciles exactly: +5 tests (B1 +3, B2 +2), all passing; no suite changed pass/fail status.
- **Zero baseline-suite edits.** Candidate-suite amendments: the three `ch2fix-*` suites only, as disclosed in §8.1–§8.3 and in each suite's header.

### 8.5 Delta of this correction round (vs pin `22a849a8…`)

Modified (8): `worker/host/adapters.mjs`, `worker/generation/genstore.mjs`, `worker/generation/service.mjs`, `worker/generation/policy-split.mjs` (comment-only), `worker/worker-entry-prod-d6.js`, `tests/ch2fix-adapter-block.test.mjs`, `tests/ch2fix-presplit.test.mjs` (comment/name only), `tests/ch2fix-reconcile-route.test.mjs`. Unchanged from the original package: `worker/generation/d6-executor.mjs` (byte-identical to its pinned version). SHA-256 of all nine package files: recorded in the re-review filing.

## 7. Gates that remain Julie's (unchanged by this package)

Deploy of this package; ANY production use of the reconcile route (settling the actual Ch 2 unknown attempt); retiring the halted Ch 2 plan; re-arm (queue unpause + halt flip — additionally gated on Workstream A's fence case); any generation. This build authorizes none of them.
