ROWAN RULING — A-3 OFFLINE IMPLEMENTATION REVIEW

Verdict: IMPLEMENTATION HOLD — TARGETED SOURCE AND EVIDENCE CORRECTIONS REQUIRED.

Handoff: RT-H-20261116-6731f4
Review pin: cd4b20ccbafbbb4342dcc891b7e67148f32e9a42
Case #10 / P8 · 2026-11-16

Construction B and the accepted A-3 design remain settled. No architectural redesign is requested.

The pinned candidate source, implementation notes, manifest, runner, A-3 test source and failing regression logs were independently inspected.

R1. Regression failure disposition

The four reported failures are confirmed in the pinned logs:

* Containment CT0: historical identity mismatch.
* P2 T0: historical identity mismatch and historical patch round-trip mismatch.
* R5A T0: historical coordinator identity mismatch.

These are accepted as historical assembly-fixture incompatibilities, not demonstrated behavioral regressions.

Preserve the original fixtures and raw nonzero exit codes. Do not rewrite historical evidence to manufacture a green run.

Provide a separate A-3 composition verification against the correct baseline, with explicit dispositions for the four historical assertions.

The overall runner exit remains 1. Do not describe it as an all-green run.

R2. RC-2 fail-open fallback — BLOCKER

Candidate coordinator.mjs:3150–3175.

_repairRecorderPasses() attempts the extended recorder query and falls back to the legacy SELECT on ANY exception.

The legacy rows carry no seq or entry-kind fields. deriveRepairStrikes() consequently evaluates them under the pre-A-3 qualification rules.

In a migrated database, an extended-query failure could therefore cause scheduled complete passes to be treated as native evidence.

Legacy semantics are permissible only for a positively established pre-migration schema. A generic read exception must never select legacy evidence semantics.

Required correction:

* Establish schema/migration state explicitly.
* Fail closed on extended-query failure in a migrated or uncertain world.
* Preserve historical native qualification only under the approved watermark rule.
* Preserve the full-sequence adjacency requirement.
* Demonstrate malformed and unknown-kind behavior against the complete intent window.

The current derivation merely skips candidate pairs containing unqualified rows. Demonstrate that this meets the accepted unknown-kind fail-closed requirement, or correct it.

Add a fault-injection test where an extended SELECT fails but the legacy SELECT would succeed over scheduled rows. No discharge may result.

R3. Watchdog-only classification and coverage

Candidate worker-entry-prod-d6.js:2641–2648 and 2993–3002.

The classifier labels zero pending non-watchdog work plus a pending watchdog as HEALTHY_IDLE, irrespective of whether the alarm exists or is overdue.

The admission query additionally excludes watchdog rows from earliest-due eligibility.

Consequently, a lost alarm with only an overdue watchdog can remain classified as healthy indefinitely.

This is not the accepted healthy-idle definition.

Correct the distinction between:

* Timely, consistently armed idle watchdog.
* Missing or overdue registration with an overdue watchdog.
* Missing schedule altogether.
* Read failure.

Implement the accepted intervention semantics where applicable, or explicitly report a narrower coverage limitation for review. Do not silently classify a broken idle chain as healthy.

Add the corresponding watchdog-only fixtures.

R4. Final admission revalidation — BLOCKER

Candidate worker-entry-prod-d6.js:2767–3048.

The initial observations include completePassSinceDue, but the final admission stretch rechecks only the existence and overdue age of non-watchdog work.

It does not recompute the completion-evidence component or re-evaluate the complete predicate against the fresh storage inputs.

A native pass may complete while the tick awaits getAlarm(), leaving its earlier recorder observation stale.

Required correction:

* Recompute every storage-local eligibility input after the final asynchronous observation.
* Use a consistent earliest-due definition.
* Re-evaluate the actual classifier with the fresh observations.
* Reject stale alarm observations when intervening registration or pass activity invalidates them.
* Preserve the atomic watermark and active-pass commitment.

Retain the final synchronous admission boundary.

Test a native pass completing during the asynchronous observation, with overdue work still present.

R5. WAIT hold verification — Julie’s approval remains operative

The durable WAIT hold is implemented and remains mandatory.

However, the scheduler’s initial observation and final admission checks treat wait_hold_active === 1 as the active case without positively establishing the valid inactive representation.

An unreadable state is correctly refused; a malformed or unknown hold value must also fail closed.

Require verified inactive state before admission.

Preserve the hold across activation and deactivation. Successful connectivity never clears it.

Retain the failed or ambiguous hold-write contingency for the activation proposal: a failed write does not establish an active hold, and an unreachable coordinator may prevent immediate hold installation.

No new production mitigation authority is granted.

The candidate also refuses scheduled admission when GENERATION_HALT is not “0”. This narrower initial LIVE-only behavior is acceptable in principle, but must be expressly documented as an operating-scope decision.

R6. Exit assurance, disablement evidence and rollback

Exit assurance

At worker-entry-prod-d6.js:2498–2521, assuranceFired is set true after _armAlarm() returns.

The coordinator’s _armAlarm() may return normally because containment suppresses registration.

Distinguish an assurance attempt, suppressed registration, initiated registration, verified read-back and failure. A normal method return alone proves none of the latter outcomes.

Confirm that dormant deployment does not introduce an unintended recovery act through the new exit assurance.

Disablement evidence

At lines 3353–3387, pass recording may fail, after which active-pass evidence can still be cleared and the disposition marked drained_normally.

Distinguish observed in-memory completion from a durably recorded normal drain. Preserve sufficient evidence for the rollback gate even if recording or cleanup fails.

Make owner clearing and disposition recording interruption-safe.

Rollback

The supplied test demonstrates why rollback to the original A-1 build is unsafe after migration.

It does not supply the genuine evidence-compatible code rollback candidate required by I6.

Scheduler-disabled A-3 is an operational disablement configuration, not a rollback of defective shared A-3 code.

Produce a separately identified rollback candidate retaining the new recorder and RC-2 semantics while reverting or removing the affected scheduler and shared-drive mechanism.

Pin its source, manifest and regression evidence before deployment approval.

R7. Cross-instance effect proof and pre-existing adoption limitation

The content-addressed, conditional R2 PUT behavior is supported by the inspected host adapter.

Accept immutable create-if-absent publication as a relevant protection, not a blanket proof for every external effect.

Complete the I1 effect census across recover(), driveOnce(), cache.flush(), alarm registration and queue delivery. Trace the authority or durable-intent boundary relative to each asynchronous continuation.

Exercise both resumed publication after replacement and an external effect already outstanding when replacement occurs.

The pre-existing keyFor() = null finding is accepted. Automatic cache adoption through the cited reconciliation path is not available in the shipped implementation.

Track this as a separate defect. Do not silently repair it within A-3.

The predicted S-3 outcome remains 10 ready + 1 outcome_unknown + 3 pending, conditional on successful revival and lease adjudication.

R8. Reproducible review evidence

The pin includes the candidate tree, A-1/A-3 test sources, runner and captured logs.

However, the runner references additional baseline trees, regression sources and fixtures that were not retrievable at the supplied pin. Direct retrieval of the referenced P2 regression source and baseline paths returned not found.

Provide the missing inputs at an immutable pin, or an exact immutable reference and mechanical reconstruction procedure for each.

Do not rely on workspace-only copies as the sole evidence for a reproducible review.

Return:

* Corrected candidate and complete manifest.
* Exact source diffs against the live-build baseline.
* Complete runnable test sources, fixtures and dependencies.
* Expanded battery covering R2–R7.
* Unabridged final-run logs and raw exit codes.
* Genuine evidence-compatible rollback candidate.

Preserve every standing deferred test disposition.

Gate decision

Implementation is not yet accepted for deployment proposal.

Targeted offline corrections and synthetic-fixture testing are the next step, within the existing authorized offline scope. Any required implementation-boundary expansion must return for review.

Do not reopen Construction B, the cadence, grace, WAIT-hold decision or containment architecture.

No staging contact, production action, deployment, activation, trigger configuration, re-hold, resynthesis, provider call or subsequent chapter submission is authorized.

Review limitation: this is an independent source and documentary test-evidence review, not an independent execution of the complete battery. Some runner inputs were unavailable at the supplied pin. Cloudflare runtime behavior and usage measurement remain later, separately gated obligations.

Turn: Wren’s. Targeted offline implementation corrections R2–R8.
