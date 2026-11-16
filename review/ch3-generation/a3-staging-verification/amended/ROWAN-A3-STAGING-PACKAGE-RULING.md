ROWAN — A-3 STAGING / PLATFORM VERIFICATION PACKAGE RULING

Handoff: RT-H-20261116-e87bf5
Review pin: 22f0b238136e90b71b897310ff2383c95c43e7da
Case #10 / P8

VERDICT: PASS WITH REQUIRED AMENDMENTS. EXECUTION GATE NOT YET APPROVED.

The verification architecture, staging-first approach, natural-event observation policy, and separation of deployment from activation are accepted.

The following amendments are required before the package is presented to Julie for execution GO.

A1 — Define the actual usage envelope

Section 4 establishes usage beyond the §5 envelope as a stop condition, but §5 supplies no numerical envelope.

Establish before execution:

* Current account-wide consumption and available headroom.
* Maximum trial consumption by applicable metered resource.
* Minimum headroom reserved for standing production operations.
* Observation cadence and maximum tolerated analytics reporting delay.
* Conservative stop thresholds accounting for that delay.
* Account billing or allowance rollover handling.

Include the nominal 336 scheduled tick opportunities across seven days, plus applicable native activity, duplicate deliveries, interventions, and cleanup overhead.

If reliable metering is unavailable, do not infer that the trial remains within budget. Specify the resulting stop or suspension disposition.

A2 — Separate platform delivery from scheduler receipt

V1 and V2 currently depend primarily on the scheduler’s own event stream. That stream cannot independently establish that every platform invocation reached the scheduler or produced its expected record.

Record separately:

* Expected scheduled opportunities.
* Observable Worker scheduled-handler invocations.
* Scheduler tick receipts.
* Admissions and classified skips.
* Duplicate deliveries.
* Failed, missing, or unaccounted-for deliveries.

Define the accounting epoch precisely. Separate trigger propagation, pre-activation deliveries, active observation, WAIT-held observation, and cleanup.

The 96-tick minimum must represent distinct scheduled opportunities successfully accounted for, not merely 96 rows potentially inflated by duplicates.

Clarify that observed duplicate handling cannot prove the absence of platform retries beyond the observation window.

A3 — Tighten environment isolation and deployment proof

The staging variant has TWO actual tree deltas, not three. Correct the description.

Before upload, mechanically establish:

* Exact accepted source tree.
* Build-identity substitution.
* Coordinator identifier substitutions only.
* No logic, provider routing, queue-routing, or storage-routing delta.

Verify the complete staging binding inventory before upload and after landing, including halt, namespace, queue identity, storage prefix, credentials, and observability.

Explicitly reconcile the accepted candidate’s binding contract with staging’s configuration, including the queue binding name and R2 prefix behavior. Do not infer compatibility merely from the presence of a binding.

The shared queue and bucket require affirmative isolation evidence. Missing Gemini credentials and halt are strong independent safeguards, but the package shall not claim absolute impossibility of provider contact without documenting the relevant call-path boundary.

A4 — Establish evidence baselines and observation sufficiency

Before S-A1, establish staging’s recorder, repair, native registration, watchdog, and outstanding-work baseline using available read surfaces.

Where operator authorization is required, capture the earliest accessible baseline after S-A1 and before S-A2. Document the limitation rather than reconstructing an unavailable baseline.

For V4, define the preservation comparison and how legitimate retention or pruning behavior will be distinguished from migration-induced loss.

For V3, define contemporaneous diagnostic correlation and required classification coverage. Uncorrelated samples cannot establish healthy-native classification correctness.

For V7, distinguish:

* No contention-related failure observed.
* Actual contention observed and safely resolved.

If no contention occurs, record that limitation. Do not manufacture contention.

V7’s required observational criteria must also be explicit in early-closure eligibility.

A5 — Define act dependencies, cleanup, and restoration

The ten-act inventory is accepted in principle, subject to explicit dependency and ambiguity rules.

Specify landing proofs and prerequisites for each act, including credential installation, trigger creation, activation, hold transitions, deactivation, trigger deletion, restoration, and credential removal.

A failed or ambiguous activation, hold, or deactivation write is not evidence of the intended state.

Provide a cleanup decision matrix covering:

* Normal completion.
* Classification or guard failure.
* Usage-envelope breach.
* Unreachable coordinator or account-wide 1101-class fault.
* Ambiguous mutation.
* Failed or ambiguous restoration.

Reconcile cleanup obligations with WAIT law. A stop condition does not automatically authorize a compensating mutation when WAIT prohibits it.

Also establish recorder-schema compatibility of the staging restore target after migration. If compatibility cannot be demonstrated, S-A9 restoration is not executable after migration.

Julie may instead explicitly authorize leaving the variant deployed dormant on staging, with verified deactivation and trigger removal.

Token removal must follow completion of all reads requiring that token.

No automatic retries or replacement cleanup acts beyond the authorized inventory.

A6 — Establish supervision for an extended trial

A two-to-seven-day trial requires an operational observation policy rather than merely start and end censuses.

Define:

* Who observes the trial.
* Observation and evidence-export cadence.
* Maximum unattended interval.
* Event-log retention and pagination sufficiency.
* How production-impact indications are detected during the trial.
* What happens if observation is interrupted.
* Hard trial expiry and the applicable cleanup disposition.

The trial clock may be suspended for WAIT-governed faults, but suspension must not silently extend authorization or permit indefinite trigger operation.

Any extension requires express authorization.

B. Accepted boundaries

The following remain binding and unchanged:

* Production generation remains LIVE under the standing release.
* Production scheduler remains dormant.
* Production Cron Trigger inventory remains empty.
* Staging generation remains halted throughout.
* No manufactured native pass, stall, provider dispatch, or contention.
* V6 intervention is opportunistic and not a mandatory pass criterion.
* Staging WAIT-hold verification does not discharge E8.
* Production recorder migration remains NOT YET OBSERVED until supported by independent production evidence.
* Existing authorized S-3 watches continue unchanged.

C. Disposition

Return one consolidated amended verification package addressing A1–A6.

No implementation redesign is requested by this ruling. If an amendment exposes a substantive implementation defect, file it separately for review rather than silently altering the accepted candidate.

This review is documentary and based on the submitted package. Rowan has not independently retrieved the pinned tree, queried Cloudflare, or verified current account allowances.

No staging execution, trigger creation, credential mutation, deployment, or production activation is authorized by this ruling.

Verification design: ACCEPTED IN PRINCIPLE.
Execution package: AMENDMENT REQUIRED.
Production: LIVE. Scheduler: DORMANT.

Turn: Wren’s — consolidated package amendment.
