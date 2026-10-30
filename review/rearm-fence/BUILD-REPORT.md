# Workstream A Re-Arm Dispatch Fence — Build Report (Chapter 2 program)

**Status: BUILD COMPLETE, battery-verified; pinned and filed for Rowan's source review. This is an implementation for review — NOT a deploy request. Deployment remains Julie's separate gate; generic re-arm remains BLOCKED.**
Authorization: Julie, Oct 30, 2026 (Chapter 2 program; board record 6531496748, issue #15, `jedavid33-design/opal-roundtable`). Design: DESIGN-PACKET.md Revision 1 (pin `2261f8ff…`), accepted for repo-only build by Rowan's ruling, issue #15 comment 6532307605.
Base: the corrected Workstream B tree (pin `62365a82d8d401913695712d0d0648ededf7b966`) at `~/workspace/ch2-program/fix/worker-build/`, built in place as Rowan specified ("build and pin the Workstream A fence against the corrected B tree"). The gen-pkg-1 tree was never edited. **Repo-only: no production contact of any kind.**

---

## 1. What was built, and where

One production file changed: **`worker/generation/d6-executor.mjs`** (+180/−19 vs the B pin's executor blob `56ed143d…`; full unified diff preserved locally at `~/workspace/ch2-program/fence/logs/fence-delta.diff`). One candidate suite added: **`tests/ch2fix-rearm-fence.test.mjs`** (21 tests). Nothing else in the tree changed — verified by git blob id against the B pin: `genstore.mjs`, `policy-split.mjs`, `service.mjs`, `host/adapters.mjs`, `worker-entry-prod-d6.js` and all three B candidate suites are **byte-identical** to pin `62365a82…`. In particular `synthesizeSegment` remains byte-identical, and all B1/B2/B3 behavior is preserved outside the fence's own seams (the removed lines of the delta are exactly: the message-first `qPlanId` computation and its error-swallowed link fallback, the hold-read subject line, the non-store-backed refusal restructured in place, the post-claim `planIdFor` call, and two header comments).

Inside `handleMessage`, the pre-claim defense block now runs, on store-backed coordinators, in the design's §5 order:

1. **Strict resolution (`resolvePlanForFence`)** — computed ONCE per message from persisted server records only:
   - the `d6_plan_jobs` link, read as `SELECT DISTINCT plan_id` and counted locally;
   - the job's `data_json` stamp, read strictly (`SELECT data_json FROM jobs WHERE job_id = ?` via `_oneOrNull` cardinality discipline);
   - cross-check: both present and different → conflict. Resolved identity = link ?? stamp ?? null (null = genuinely plan-less).
   - The message-carried `planId`/`d6PlanId` and `planIdFor()` play NO part in any fence decision. `planIdFor` survives only as the fixture-path hold-read input and the post-claim fallback where no resolution ran.
2. **Quarantine hold read (D8-1, unchanged discipline)** — `ensureQuarantineSchema` + `heldQuarantineStrict` for the plan subject = **the resolved identity** (previously `planIdFor`'s message-first answer) and the job subject; any throw → `{ refused: "quarantine_check_failed" }`; held → `{ refused: "plan_quarantined" }`.
3. **Plan-state fence (`planStateFenceRefusal`)** — a message-carried plan field that disagrees with the resolved plan → `{ refused: "plan_link_mismatch" }`; the plan row is read strictly from `d6_plans`: no row → `plan_state_check_failed` (dangling link); state in `{complete, partial, retired, halted_unknown}` → `{ refused: "plan_not_dispatchable", planId, planState }` (a normal return — the message is ACKed and terminally consumed); state in the closed dispatchable vocabulary `{active, parked_quota, parked_cap, parked_budget, parked_storage}` → pass; any other string → `plan_state_check_failed`.

After both checks pass, the **post-claim bookkeeping adopts the resolved identity** (`const planId = resolvedPlanId !== undefined ? resolvedPlanId : planIdFor(jobId, msg)`), so no executor surface attributes work to a message-carried plan. The non-store-backed branch keeps the pre-existing fixture-only behavior verbatim (no store exists in which a plan could be persisted, so there is nothing to resolve — the same split D8-1 already drew). Fail-closed taxonomy: resolution/state read errors and malformed job data → `plan_state_check_failed`; conflicting persisted links → `plan_link_conflict`; hold-read errors → `quarantine_check_failed` (unchanged).

## 2. Rowan's three build-detail pins (comment 6532307605) — all implemented and asserted

1. **Dual-stamp disagreement.** In the resolver, when BOTH `data_json.d6PlanId` and `data_json.planId` are present (non-empty strings), they are compared; a disagreement returns the conflict (`plan_link_conflict`) rather than choosing one. Asserted by **T11b** (disagreement refuses) and **T11c** (agreement dispatches normally — mere dual presence is not refused).
2. **Non-object `data_json` is corruption.** A present `data_json` that fails to parse, or parses to a non-object (string / number / null / array), throws inside the resolver → `plan_state_check_failed` — never evidence of a plan-less job. A non-string stamp value is likewise corruption. (An absent record — no job row, or a NULL column — remains the plan-less signal, matching "present-but-invalid".) Asserted by **T15** (unparseable) and **T15b** (`"a string"`, `42`, `null`, `[1,2]` each refuse in a world that would otherwise dispatch; a valid object then dispatches as the control).
3. **Multi-row DISTINCT preserves `plan_link_conflict`.** The link read uses `SELECT DISTINCT plan_id` with a local row count (`coord._all`, falling back to the SQL cursor's `toArray()`), so multiplicity surfaces as the conflict return — it never passes through `_oneOrNull`'s cardinality throw, which would have collapsed it into `plan_state_check_failed`. Asserted by **T12**, which pins the exact refusal string.

## 3. Adversarial tests — T1–T15, 21/21 PASS

Suite: `tests/ch2fix-rearm-fence.test.mjs` — every world runs the REAL pre-claim path (real coordinator over the production-semantics harness: real SQLite, `.one()` throws on empty; real genstore; the executor's `handleMessage`). For EVERY refusal the global pair is asserted: **provider calls 0** and **full row sets byte-identical before/after** across grants, claims, transitions, jobs, occurrences, `d6_plans`, `d6_plan_jobs`, `d6_execution_records`, `spend_intents`, `d6_attempt_log` — a refusal opens no claim and no ledger entry.

- **T1 (headline replay)** — the production Ch 2 shape at full size, fixture-verified before replay: plan `halted_unknown`/`phase_halted_unknown_billing`; job `generating` rev 2; grant `issued` rev 2; claim `claimed` by `opalreader-v2-prod-d6` (the same consumer the executor runs as, so claim discipline alone would fall through); 18 `granted` rows; 8 `failed` executions with noted intents; 1 `unknown_billing` execution with an open intent; 9 bare. Replay of the exact drained dispatch message → `{ refused: "plan_not_dispatchable", planState: "halted_unknown" }`, zero calls, zero movement.
- **T2 / T3 / T3b** — the same full shape with plan `retired` / `complete` / `partial` → refused with the matching `planState`, zero calls, zero movement.
- **T4 (smoke shape)** — `active` plan dispatches: one provider call, commit + binding land, execution records carry the resolved plan id. **T4b** — link-only identity (no job stamp): resolution AND bookkeeping come from `d6_plan_jobs` (the pre-fence build stamped NULL here, since `planIdFor` never reads the link). **T4c** — stamp-only identity (no link row): dispatches, bookkeeping = the stamp's plan.
- **T5** — parked congruence: each of `parked_quota`, `parked_cap`, `parked_budget`, `parked_storage` dispatches and commits exactly as the pre-fence build.
- **T6** — genuinely plan-less job dispatches identically; the fence creates no plan/link rows; bookkeeping stays plan-less.
- **T7** — Ch 3 shape (`parked_policy` coordinator job, no plan link, no grant): a hypothetical message dies at claim discipline (`unknown_grant`); the fence neither engages nor is needed; zero movement.
- **T8** — fault injection at EACH resolution step in an otherwise-dispatchable active world: (a) link read, (b) jobs-row stamp read, (c) plan-state read → each `plan_state_check_failed`, zero calls, zero movement; faults cleared, the same world then dispatches (control).
- **T9** — T1 fixture, message carries a `planId` naming a different ACTIVE plan → refused (`plan_link_mismatch`; the design accepts this or the resolved halted state — dispatch would be a fail).
- **T10 (single-resolution proof)** — the job's real plan is BOTH under a HELD quarantine AND `halted_unknown`; the message names a third plan, unheld and `active`. The only hold in the store is on the real plan, so the `plan_quarantined` refusal can only come from the resolved identity feeding the quarantine read; a bare replay refuses identically. Zero calls, zero movement.
- **T11** — link names plan A (active), job stamp names plan B → `plan_link_conflict`; neither record wins by precedence.
- **T12 / T13 / T14 / T15 / T15b** — per §2 above (pins 3, and: dangling link → `plan_state_check_failed`; unrecognized state string → `plan_state_check_failed`; malformed/non-object job data → `plan_state_check_failed`).

## 4. Full battery (fenced tree, ONE complete run; runner exit 0)

Runner: `~/workspace/ch2-program/fence/logs/run-worker-battery-fence.py`; logs: `~/workspace/ch2-program/fence/logs/battery/` (per-file logs + summary + failing list).

- **127 suite files: 105 pass / 22 fail. 1007 tests: 985 pass / 22 fail. Assertion failures: NONE.**
- The 22 failing suites are **set-diff identical** to the recorded D8 baseline set (verified against the corrected B run's `failing-files.txt`, itself set-diffed against the D8 baseline). Delta vs the corrected B battery reconciles exactly: +1 suite file (this fence suite, passing), +21 tests (all passing); no suite changed pass/fail status.
- **Zero baseline-suite edits.** Candidate-suite changes: exactly one NEW suite (`tests/ch2fix-rearm-fence.test.mjs`); no existing suite — baseline or candidate — was amended.
- Environment note (unchanged from the B package): four suites resolve a sibling `opal-reader-p8-data/` path relative to the tree; the symlink shim at `~/workspace/ch2-program/opal-reader-p8-data` (outside the pinned tree) applies identically to baseline and final runs.

## 5. Delta vs the corrected B pin (`62365a82…`)

- Modified (1): `worker/generation/d6-executor.mjs` — SHA-256 `9896b9d5fd6a9bf3ca8931ae094583e1e3c1c270593a1e7647662acfb603f9c7`, 42,488 B (+180/−19 vs the B executor blob).
- Added (1): `tests/ch2fix-rearm-fence.test.mjs` — SHA-256 `4757933ff82a5b1aca4dcf824c9bed02ba8e08e088d0ecbbdf0706f5670e55ad`, 24,626 B.
- Everything else in the tree is byte-identical to the B pin (blob-id verified, §1).

## 6. Disclosures

- The resolver treats a stamp field present with a non-string value (e.g. a number) as malformed job data (`plan_state_check_failed`). The design names unparseable/non-object `data_json` as corruption; a non-string stamp is the same class (the server only ever writes string plan ids — service.mjs stamps `plan.plan_id`). No baseline fixture carries such a stamp (battery confirms).
- A job row that does not exist at all resolves through the link alone (a missing row contributes no stamp); a link to a missing plan still refuses. Claim discipline remains the arbiter for wholly unknown jobs, exactly as before (T7).
- T3b (partial), T4b/T4c (single-record resolution), T11c (dual-stamp agreement) and T15b (pin-2 shapes) are additions within this package's own candidate suite, beyond the design's T1–T15 numbering, each labeled in the suite.
- The fence governs the D6 executor dispatch path only, per the design's honest scope (§6 of the packet): it does not reconcile the unknown billing, retire the plan, or touch admission — and this build requests none of those.

## 7. Gates that remain Julie's (unchanged)

Deployment of the fence + B package (halted/pause-first pattern); any production use of the reconcile route; retiring the halted Ch 2 plan; re-arm (halt flip + queue unpause); any generation. This build authorizes none of them, and the filing says so.

— Wren (Workstream A build, Chapter 2 program)
