ROWAN RULING — A-3 IMPLEMENTATION CORRECTIONS R1–R8

Verdict: CONDITIONAL IMPLEMENTATION PASS WITH ONE REMAINING ADMISSION BLOCKER.

Handoff: RT-H-20261116-corr01
Review pin: d733c26e3666d186dfb379fd30a618fb5b304ee3
Case #10 / P8 · 2026-11-16

The architecture and design remain accepted. No further architectural review is requested.

R1, R2, R3, R5 — ACCEPTED

The composition verification and historical fixture dispositions are accepted.

The unsafe generic legacy fallback has been removed from the RC-2 recorder reader. The corrected intent-window qualification is accepted.

Watchdog-only overdue work now participates in intervention eligibility. The healthy-idle classification no longer automatically follows from the existence of a watchdog row.

The WAIT hold requires the verified inactive representation at admission. Julie’s hold-enabled decision remains operative.

The initial LIVE-only scheduler scope is accepted.

R4 — REMAINING BLOCKER: REGISTRATION REVISION FENCE

The revised admission stretch correctly recomputes the storage-local classifier inputs.

However, the stale-alarm-observation protection at worker-entry-prod-d6.js:3133–3145 depends upon a newly recorded pass with a changed armed_after value.

This does not cover all alarm-registration writers.

The existing coordinator’s command/report wake paths can initiate registration without adding a drive-pass row.

The relevant mechanism already exists in the candidate coordinator:

* Lines 3156–3164: _alarmRevision() and _bumpAlarmRevision().
* Lines 3308, 3361 and 3489: A-1’s capture and re-verification discipline.
* Lines 4040–4109: wake and _armAlarmIfEarlier.
* The existing registration and deletion sites participate in the revision fence.

Reuse the existing alarm revision mechanism.

Capture the revision before the asynchronous getAlarm() observation and compare it again at final synchronous admission. A changed revision must invalidate the observation and suppress admission without consuming the tick watermark.

Retain the fresh classifier evaluation and existing recorder-activity protections.

Also account for a native pass completing without a successful recorder write. Recorder availability must not be the sole concurrency witness.

Required targeted tests:

1. Command wake registers an alarm during the scheduled tick’s observation, with no new pass row.
2. Executor-report wake does the same.
3. Native pass activity occurs with recorder failure.
4. Unchanged revision and qualifying fresh observations retain the intended intervention behavior.

This is a narrowly scoped correction, not a new design.

R6 — ACCEPTED WITH DEPLOYMENT-GATE QUALIFICATIONS

The separate assurance outcome fields and atomic disablement disposition are accepted.

Treat a numeric assurance read-back as evidence that a registration was observed, not independently as proof of native delivery or correct registration identity.

One dormant-behavior qualification remains: the candidate’s exit assurance can attempt an arm whenever its read returns null and pending rows exist. A healthy numeric-registration equivalence test does not establish equivalence for every dormant failure case.

Before dormant deployment approval, demonstrate or explicitly delimit the additional assurance behavior when the scheduler has never been activated, including null registration and failed native-pass cases.

The genuine recorder-compatible rollback candidate is accepted in construction. It removes the scheduler and shared-drive mechanism while preserving revised recorder and RC-2 semantics.

The original A-1 build is not the approved rollback target after A-3 migration.

R7 — CONDITIONAL ACCEPTANCE

Accept the documented durable-intent and conditional content-addressed publication protections, with the offline replacement fixtures as synthetic evidence.

Actual Cloudflare runtime replacement and transport behavior remain separately gated platform-verification obligations.

Track keyFor() returning null as a separate pre-existing defect. It is not part of the A-3 correction boundary.

R8 — DOCUMENTARY PASS

The previously unavailable baseline and regression inputs are now included in the pinned package inventory. The reproducibility procedure is accepted.

The reported overall runner exit remains 1, with the historical assembly assertions separately dispositioned against both candidate and rollback trees.

Do not modify historical fixtures merely to obtain green exits.

NEXT RETURN

Return a narrowly scoped R4 closure package containing:

* The registration-revision correction.
* The targeted admission-race tests.
* The dormant exit-assurance qualification.
* Updated source, manifests, composition verification and complete final-run evidence.

No other accepted correction is reopened absent a demonstrated regression.

The deployment proposal may be drafted in parallel but must remain non-operative until the corrected implementation is accepted.

The later activation proposal must still address the failed or ambiguous WAIT-hold installation contingency.

Review limitation: the corrected pin, key source locations, rollback entrypoint, composition documentation and runner summary were independently inspected. The entire battery was not independently executed by Rowan. Platform tests and measurements remain outstanding.

No deployment, staging contact, activation, production stimulus, trigger configuration, re-hold, resynthesis, provider call or additional chapter submission is authorized.

Turn: Wren’s. Targeted R4 closure, followed by implementation acceptance review.
