# For Rowan — R5a revision package (offline design + evidence; ruling 6584187105)

Rowan — your R5a revision ruling (board 6584187105) is accepted and
recorded verbatim on the board. This package is the offline design
and evidence phase you assigned. **No production action of any kind
was taken or is requested: no deploy, command, report, alarm wake,
SubmitJob, hold/queue change, or generation. The R5a execution gate
remains NOT approved. Production stays HELD under investigation
hold.** One discrepancy in the relay is flagged first, because the
design turns on it.

## ⚠️ Relay-vs-board discrepancy (B3-future)

Julie's chat relay summarized your decision 2 as "Preserve the B3
stale-A-to-future-D behavior" (the shipped behavior — no setAlarm
when D is future). **Your board text says: "Accept moving stale past
A to actual earliest pending future D, subject to proof that D is
correctly computed."** The design follows the **board text**: beyond
the safeguard threshold, the stale registration is moved to D. This
is unresolved decision (1) below — please confirm the board reading.

## What the revision changed, per directive

1. **Permanent design.** The boxed/durable-counter variant is
   removed as a recommendation and retained only as
   considered-and-rejected, citing your decision 1. The permanent
   condition change is the design.
2. **B3 + D verification.** D is **proven from source** to be the
   true earliest pending due time: `_armAlarm()` and
   `_armAlarmIfEarlier()` use the identical query
   `SELECT MIN(due_at) FROM schedule WHERE state='pending'` — no
   kind filter; every kind (`watchdog`, `lease`, `retry_grant`,
   `handoff_check`) flows through the single `_schedule()` inserter;
   `MIN()` always returns one row, so the real-DO `.one()`
   divergence cannot bite here. Named residuals: platform retry
   state is not a schedule row (that's the supersession issue, not
   a D defect); D is a query-instant snapshot.
3. **Dedupe.** A per-operation arm memo is threaded through `wake()`
   and the post-apply `_armAlarmIfEarlier()` at all three call
   sites (handleCommand, requestGrant, handleReport). Bound: **≤1
   setAlarm per wake operation**; a second fires only if the same
   operation scheduled strictly earlier work (corrective). Memo, not
   instance state, because the coordinator is constructed per
   request in api.mjs and also held long-lived in the DO entry —
   instance fields would be wrong in both directions. No durable
   writes.
4. **Retry-supersession + safeguard.** Separate document
   (PHASEB-R5A-RETRY-SUPERSESSION.md). Documented basis: ≤6 retries,
   exponential backoff from 2 s, retries apply "only to the most
   recent setAlarm() call", and a past-due getAlarm() is the
   *expected* read during a retry gap. UNSPECIFIED: the backoff
   multiplier/cap, post-exhaustion state, whether a superseded
   retry's invocation can still arrive. Safeguard, enforced **in
   the condition itself**: the past-due disjunct fires only when
   `armed <= now - ALARM_STALE_THRESHOLD_MS`, threshold
   **3,600,000 ms (60 min)** — derivation: assumed-doubling envelope
   2+4+8+16+32+64 = 126 s; threshold = ≥28× that envelope, 60× the
   documented ~1 min failover bound; robust through a ×4 multiplier
   (2,730 s), not a proof against ×5. Live incident A is ~20 h past
   due (20× the threshold) — the safeguard costs this recovery
   nothing; it protects future healthy chains. **Permanent
   production safety is NOT claimed until the retry issue is
   resolved** (your words, carried verbatim).
5. **Alarm-mutation budget.** Per wake operation ≤1 (≤2 corrective,
   strictly-earlier only). Under adversarial/replayed wakes with an
   undeliverable past D: exactly 1 per wake operation, all values
   identical (= D), zero schedule/state growth (battery: 10 wakes →
   10 registrations, schedule count unchanged, watchdog count 1,
   grants 0). After any delivered pass: 0 further registrations
   (the base finally leaves a future armed value). **Stated
   plainly: no code-level rate bound independent of wake traffic
   exists without durable state** — the trade you set aside in
   decision 1 is named in the spec rather than smoothed over, and
   the gate budget reconciles registrations as *expected* alarm
   mutations (the v1 skeleton's implicit zero was wrong).
6. **No safety overclaims.** Self-grep over all five new documents
   for safe/safety/safely/guarantee: every occurrence is the
   safeguard's name, a negated claim, or the platform's documented
   at-least-once wording attributed as such.

## Containment design (separate document; design only, no code)

Chosen: **one durable flag in the DO's own SQLite, two layers.**
Layer 1 (drive containment): the subclass handler checks the flag
after `super.alarm()` and before `recover()`/`driveOnce()` — when
set, passes record at stage `contained`, schedule processing and
lease-driven grant closure **continue**, the finally re-arm
continues, but no new grants are issued. Layer 2 (chain stop): the
same flag gates `_armAlarm()`/`_armAlarmIfEarlier()` re-arms, and
an operator route performs `deleteAlarm()` — with wake paths gated,
nothing resurrects the registration; pending schedule rows are left
in place as evidence. Rejected with reasons: schedule draining
(re-arms anyway at the watchdog fallback, repopulates on next wake,
and destroys the B-question evidence); deleteAlarm alone (wake
resurrects it); grant-level tools (treat one grant, chain issues
the next). **Cannot interrupt:** a pass already inside driveOnce
(worst case = the §7.3 pre-classified set: ≤1 grant, reserved
0→12, ≤12 attempts, occurrence ceiling 153,636 units ≈ $0.154,
dispatched 0 under the halt wiring). **Failure-mode recommendation:
fail-CLOSED for drive** (flag-read error → skip drive, record error
stage, return normally — no retry storm), **fail-open for arming**.
Verification: recorder rows at the contained stage; getAlarm() null
and staying null across a wake after a Layer 2 stop; grant-state
reads byte-compared to census. Its own gate skeleton is included;
**containment must be deployed and Layer 1 verified before any
stimulus** under its sequencing rule.

## Offline build + battery (true strength)

Candidate: live tree with **only `v2/coordinator.mjs`** changed
(278,396 B, SHA-256 `d3d9005b…`); diff **+51/−12**; patch round-trip
byte-exact; `node --check` passes. No containment code in this
candidate (independently gated; mixing builds would conflate two
gates).

One combined run on the exact candidate tree (log pinned):
**55 tests, 53 pass, 2 fail, exit code 1.** The R5a battery is
**23/23**. Both failures are the P2 suite's T0 *candidate-identity*
assertions for the superseded P2 candidate (they assert exactly 2
amended parts; this tree intentionally has 3 vs the
pre-instrumentation basis) — R5A-T0 carries the replacement
identity assertions and passes; **all P2 behavioral groups (T1–T10,
incl. twin equivalence and mode rejection) pass** against the
revised tree. Scenarios covered: normal future alarms; stale
re-registration at D; retry-gap threshold (5 and 59 min → none; 60
min boundary → fires; 61 min → fires; shipped build at 61 min →
none); dedupe incl. corrective-second and the handleReport path;
B3 ordering (beyond threshold → moved to future D; inside threshold
→ untouched); revival under holds (exactly the §7.3 grant set, no
dispatch, then the branch goes quiet); 10-wake churn bound;
stop-state/preserved-plan byte-integrity after a stimulus with no
delivery; diagnostics reads never wake.

## Evidence gaps (cannot be closed offline)

Real platform retry behavior/timing; real delivery after
re-registration; post-exhaustion registration state; whether a
superseded retry invocation can still arrive; real-DO divergences
beyond the harness's mirrored `.one()` semantics; **containment —
design-only this round, no code, no tests.**

## Gate paperwork (both proposals only, neither approved)

- **Revised R5a gate:** deploy-only scope (stimulus is a separate
  gate), census re-based to the live build, mandatory battery
  re-run on the gate-assembled tree, reconciled mutation budget
  (1 upload + ≤1 conditional PATCH; conditional rollback likewise;
  registrations as classified findings, 0 expected), correction 6
  verbatim, ends HELD, exact GO wording included.
- **R2 gate:** one RequestPause, fresh command_id, target
  `alarm-wake-probe:nonexistent` verified nonexistent at preflight,
  exactly 1 commands row, ≤1 conditional setAlarm, and the mandated
  negative-result wording — "**no observed revival within the tested
  window, subject to recorder limitations**" — never a proof that
  B2 is impossible. Correction 6 verbatim. Ends HELD.

## Unresolved decisions requiring your ruling

1. **Confirm the B3-future reading** (board text: move A→D) over
   the relay's "preserve" summary.
2. **Threshold value/margin:** 3,600,000 ms as proposed, or another
   bound.
3. **Mutation-budget numbers** as specified (≤1/op, ≤2 corrective;
   churn = wake count, disclosed) — accepted as the enforceable
   budget, or is a durable rate bound required after all?
4. **Containment mechanism choice** (two-layer flag) + its gate +
   the fail-closed-for-drive / fail-open-for-arming recommendation.
5. **Sequencing:** containment → R5a deploy → R2 stimulus, as
   proposed — or another order.
6. Whether the R2 gate should be re-scoped as the R5a gate's
   stimulus (post-R5a form) instead of the shipped-build probe.

Documents (pinned in opal-reader `ui1-review` under
review/ch3-generation/recovery/; the pin and hashes ride the board
summary): PHASEB-R5A-REVISED-SPEC.md ·
PHASEB-R5A-RETRY-SUPERSESSION.md · PHASEB-CONTAINMENT-DESIGN.md ·
PHASEB-R5A-REVISED-GATE-PROPOSAL.md · PHASEB-R2-GATE-PROPOSAL.md.

**Turn: Rowan's.** No GO is requested — documentary review only.
