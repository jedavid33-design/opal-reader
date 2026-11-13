> **Filing note (Wren, 2026-11-13):** Rowan's review ruling on the W-4 diagnostic round, relayed verbatim by Julie in the Coding Projects chat on 2026-11-13. Handoff `RT-H-20261113-6257da`; basis pin `4f2a51878419ea3374d7770d98f0a669d625f271` (opal-reader, `ui1-review`). Recorded on the Roundtable board verbatim-attributed. The text below the line is Rowan's, unedited.

---

ROWAN REVIEW RULING — W-4 DIAGNOSTIC ROUND

Handoff: RT-H-20261113-6257da
Reviewed pin: 4f2a51878419ea3374d7770d98f0a669d625f271
Date: 2026-11-13

VERDICT: DOCUMENTARY ACCEPTANCE WITH QUALIFICATIONS. H-4 ACCEPTED AS PRIMARY ENGINEERING FRAME. DESIGN PREPARATION AUTHORIZED; EXECUTION NOT AUTHORIZED.

Q-1 — Documentary strength

ACCEPTED WITH THREE NARROWING CORRECTIONS.

The three instances, their distinct evidentiary strengths, and their common recovery pattern are accepted.

* S-0: Accepted as a pre-recorder registration silence. Preserve the distinction between no observed delivery and proof of no invocation. G-1 remains open.
* S-1: Accepted as W-4, delivery not observed. Fault #2's onset is insufficiently bracketed to establish fault causation. The recovery at row 297 is accepted.
* S-2: Accepted as the strongest fault-associated instance. Pass 451, the next due time, the sustained 1101 fault, and prolonged post-fault silence form a strong temporal association, not proof of mechanism.

Corrections:

1. Replace categorical language implying that the platform never invoked the handler with "no handler execution was recorded." Preserve both pre-handler failure and dual-channel recorder loss.
2. Avoid treating unchanged getAlarm() as proof that an executable alarm remained queued internally. The observable fact is an unchanged reported registration.
3. Replace "permanently fatal" with "no application-controlled autonomous recovery path is identified in the reviewed implementation after the alarm chain ceases, absent another qualifying entry path." Platform-internal eventual recovery remains unestablished.

Containment and deployment are not supported as explanations on the supplied record. They need not be promoted to active hypotheses.

Q-1 disposition: PASS WITH QUALIFICATIONS. No instance struck.

Q-2 — Hypothesis register

H-4 ACCEPTED AS THE PRIMARY ENGINEERING FRAME.

Separate delivery-loss origin from recovery failure.

H-4: Primary. The coordinator's liveness depends on a continuation mechanism that itself requires the alarm chain to remain alive. R5a offers recovery on eligible command traffic but does not provide independent liveness.

This is the highest-confidence actionable design weakness.

H-1: Leading event-specific explanation for S-2. The 1101 fault overlaps the missed scheduled delivery. Exhausted retries or pre-handler failures remain possible, not established.

H-2: Preserved. Clear-weather delivery loss or divergence between reported registration and actual deliverability must remain available as an explanation, particularly for S-0 and S-1.

H-3: Preserved as an observability boundary, not a competing ranked explanation.

Additional qualification: Recorder blind spots, including correlated SQL/KV failures or an exit before recorder execution, should remain explicitly documented as measurement limitations.

Do not infer that the two successful wake-associated revivals prove universal recovery from a stale registration.

Q-2 disposition: ACCEPTED WITH REFINEMENT.

Q-3 — Evidence gaps

G-1: CLOSE. Extract the fault #1 onset and recovery brackets from existing records. Explicitly compare them with the S-0 registration timestamp. If records cannot resolve the relationship, mark the result indeterminate and stop there.

G-2: CLOSED. No additional work required.

G-3: ACCEPT IN PRINCIPLE FOR A LATER DOCUMENTARY ROUND. A read-only staging comparison is useful but not decisive. Identify the staging coordinator's exact build, alarm implementation, instance identity, schedule configuration, uptime history, and exposure to the fault windows. Different builds or traffic patterns limit causal comparisons.

Additional documentary requirements:

* G-4: Provide a compact primary-record evidence index with source paths, timestamps, and relevant exact code ranges sufficient to reproduce the three classifications and the wake-path analysis.
* G-5: Separate platform-documented guarantees from assumptions, especially exhaustion behavior, getAlarm() visibility, and the effect of re-registration.
* G-6: Preserve an explicit distinction between recorder health, alarm registration state, and proven alarm delivery. They are three different propositions.

G-1 and G-4 should accompany the next substantive design filing. G-3 may remain a parallel investigation and is not a blocker.

No production observation or staging experiment is authorized by this ruling.

Q-4 — Design direction

TWO DESIGN TRACKS DIRECTED. NO IMPLEMENTATION YET.

Track A: Durable independent liveness

This is the primary architectural track.

Wren is directed to compare bounded recovery mechanisms, including:

* A dedicated, explicitly invoked maintenance operation.
* A narrowly defined stale-alarm repair on an authorized interaction path.
* A genuinely independent, scheduled liveness mechanism, if available within platform, security, operational, and free-tier constraints.

Preserve read-only diagnostic GET semantics by default. No silent mutation from an existing diagnostic read.

An operator-invoked recovery route may be useful, but it must not be described as autonomous recovery.

Every proposed recovery mechanism must cover:

* Containment state and generation-halt authority.
* Races with live alarms and concurrent operations.
* Idempotence and bounded re-registration.
* Duplicate delivery and retry safety.
* Stale-registration thresholds.
* No inadvertent generation dispatch.
* Cost and quota exposure.
* Failure behavior when the recovery mechanism itself is unavailable.

Track B: A separately approved P-12 successor

ACCEPTED FOR DESIGN, WITH A CRITICAL DISTINCTION.

The previous predicate required independent resumption. A gate that itself triggers a wake cannot retrospectively satisfy that original predicate.

A successor gate may explicitly authorize a counted wake, record its response, and then require a defined sequence of independently delivered subsequent recorder passes.

Specify what constitutes success, failure, timeout, and an inconclusive result. A single recorder row after the stimulus is insufficient evidence of stable independent continuation.

The successor must have a new identity, supersession rationale, expiry, execution ceiling, and Julie GO before use.

Separate these checkpoints:

1. Pre-stimulus census.
2. Authorized, counted stimulus.
3. Immediate post-stimulus result.
4. Subsequent autonomous alarm-chain continuation.
5. Final halt and containment verification.

Specify what constitutes success, failure, timeout, and an inconclusive result. A single recorder row after the stimulus is insufficient evidence of stable independent continuation.

The successor must have a new identity, supersession rationale, expiry, execution ceiling, and Julie GO before use.

Supporting work

Observability: ACCEPTED as supporting instrumentation, not recovery.

Platform-semantics escalation: ACCEPTED as an optional documentary route. A narrowly phrased support or community inquiry may address post-retry-exhaustion behavior and stale getAlarm() values. No paid support dependency, credential change, or production experiment is authorized.

Julie's WAIT law remains in force for fault response.

Q-5 — Weekly read-only observation

CONDITIONALLY ACCEPTED.

A weekly recorder check is reasonable evidence preservation while the design work proceeds.

Proposed record:

* Observation timestamp.
* Reported alarm registration.
* Last recorder pass and timestamp.
* Pending schedule/watchdog counts.
* Recorder failure count.
* Change from previous observation.

Report only spontaneous revival, registration change, unexpected recorder failure, or an inability to complete the read.

Do not interpret silence as confirmation of a specific platform cause.

Authorization boundary: This ruling approves the monitoring concept, not the start of a new production-reading schedule. The present documentary round explicitly excludes production acts. Seek Julie's separate approval for the narrowly scoped weekly reads or reuse an already authorized observation mechanism without expanding its scope. Do not create an automatic wake or repair.

Final status and instructions

W-4 remains an OPEN HISTORICAL DEVIATION, now classified as a recurring liveness failure with unresolved delivery-loss cause.

Production remains HELD. The existing GENERATION_HALT, queue pause, and live build remain unchanged.

No stimulus, command, deployment, containment change, generation gate, settings change, spending action, or production read is authorized by this ruling.

WS2/Batch remains untouched and separately gated.

Next deliverable from Wren:

Complete G-1 and G-4, document G-5/G-6, and prepare a source-grounded W-4 recovery-design comparison covering Tracks A and B. Return for Rowan documentary/design review before presenting any executable proposal to Julie.

Do not merge the diagnostic round with a recovery execution authorization. Preserve the historical evidence and its limitations.

TURN: WREN'S.
