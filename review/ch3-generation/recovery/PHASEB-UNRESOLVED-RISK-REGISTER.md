# Phase B — unresolved-risk register (as of the V4 package, Nov 2, 2026)

The single list of open risks across the whole recovery
program. Every entry: {risk, basis, bounded by, what would
resolve it, owner of the decision}. Nothing here is
mitigated by being listed; listing is the discipline.
Packages cite entries as R-01…; new risks are appended,
never renumbered. Status of every entry: **OPEN** unless
marked otherwise.

**R-01 — Cross-invocation serialization inside one DO
(assumption A-3).** Basis: the design assumes invocations
of the coordinator DO do not interleave their synchronous
stretches across isolates; Cloudflare documentation
reviewed does not guarantee this in the needed form.
Bounded by: transition table + verified-read preconditions
keep a lost race REJECTED rather than corrupt; the arm
re-check (design v4 §7) removes the one proven defect.
Would resolve: a platform documentation statement or
support-case answer on DO invocation serialization. Owner:
Rowan (acceptance of the residual) — platform fact, not
executor choice.

**R-02 — Cross-invocation storage-effect ordering
(analysis v4 O-6). NEW in v4.** Basis: whether an
earlier-initiated `setAlarm` can take effect after a
later-initiated `deleteAlarm` completes is unspecified;
v3 text claimed "the last physical act wins" — withdrawn
by name in analysis v4 §3. Bounded by: the stop act rests
on its read-back, not ordering; any surviving registration
is DETECTED at the next read (`stopConfidence: contested`,
design v4 §2) — detected, not prevented. Would resolve:
platform documentation on alarm-storage operation
ordering. Owner: Rowan.

**R-03 — Retry-supersession residual (R5a).** Basis: the
stale-threshold safeguard assumes the platform's retry
envelope (≤6 attempts, backoff from 2 s) from
documentation; a registration superseded past the threshold
could in principle be re-delivered by a retry outside the
assumed envelope (the ×5-backoff case is NOT covered by
the 3,600,000 ms threshold). Bounded by: threshold ≥28×
the assumed envelope; permanent safety is NOT claimed
(spec's own wording). Would resolve: platform retry
documentation with hard bounds, or a larger ruled
threshold. Owner: Rowan (threshold ruling, R-05).

**R-04 — No traffic-independent rate bound on wake-driven
registrations.** Basis: the per-operation arm memo bounds
registrations per operation (≤1, ≤2 strictly-earlier
corrective), but nothing bounds the RATE at which foreign
wake traffic can cause operations; Rowan's ruling kept
this open as an execution risk. Bounded by: the holds
(halt + paused queue) cap the CONSEQUENCE (no spend);
containment suppresses arming in CHAIN_STOPPED. Would
resolve: a ruled rate bound or an accepted exposure
statement at the R5a-D/S1 gates. Owner: Rowan + Julie
(exposure acceptance).

**R-05 — The 3,600,000 ms stale threshold is provisional.**
Basis: candidate test value, conditionally accepted only;
not derived from a platform guarantee (see R-03). Bounded
by: it only widens the shipped condition for registrations
already ≥1 h stale; B3-future behavior past it is ruled
accepted. Would resolve: Rowan's final threshold ruling.
Owner: Rowan.

**R-06 — Recorder dual-failure blind spot.** Basis: if a
drive pass AND its recorder write both fail, the pass is
invisible on every shipped surface (`drive=1` shows the
table missing / health null, as observed Nov 2, 2026 —
V5 INCONCLUSIVE at the P2 gate). Bounded by: quota
reconcile + plan/job/phase reads bound what an invisible
pass could have done under the holds ($0, grant set
pre-classified). Would resolve: nothing on shipped
surfaces; accepted as an observability limit, or a future
instrumentation package. Owner: Rowan.

**R-07 — Containment suppression under a live chain is
unverifiable before S1.** Basis: C3 cannot observe drive
suppression, arm suppression under real wake traffic, or
the re-check against a real racing wake without a
stimulus (gates v4, C3 remainder). Bounded by: harness
proof (CT13/CT16) + C3's PARTIAL verdict discipline; S1
may not run until Rowan rules on the remainder. Would
resolve: Rowan's remainder ruling (discharge at S1, or
accept as permanently harness-grade). Owner: Rowan.

**R-08 — Exhausted-episode circumvention is
paperwork-enforced only.** Basis: the code cannot
distinguish a legitimate new stop from a clear + re-stop
intended to reset an exhausted episode's budget (design
v4 §4.3). Bounded by: the exhausted summary persists in
`prevEpisode*` on every surface; restoration and R3-V
paperwork must disclose it; presenting a re-stop as a
fresh budget is a stated violation. Would resolve:
nothing in code (by construction); a future design could
hard-block re-stop after exhaustion, at the cost of
blocking legitimate stops — a trade-off for Rowan if she
wants it. Owner: Rowan (accept paperwork enforcement) +
Julie (authorizations).

**R-09 — The attempt-3 stall's causation is unproven
(H1/H4).** Basis: the diagnostic (pin `cccfea62…`)
supports alarm-delivery failure as the highest-ranked
hypothesis; the 1101 link is unproven; no drive pass
reaching grant issuance is the supported negative, not a
root cause. Bounded by: the recovery program does not
depend on the cause (containment + R5a proceed under any
of H1–H4). Would resolve: platform-side alarm-delivery
evidence (unavailable on the dashboard surface — P1
INCONCLUSIVE BY UNAVAILABILITY). Owner: Rowan
(acceptance that the program proceeds cause-unproven).

**R-10 — Wake-arithmetic branch B2 remains open.**
Basis: in attempt 3, the wake's computed due D is
unobservable on shipped surfaces; B1 (D = A, no-op) is the
leading branch, B2 (D < A, registration set but lost)
cannot be excluded (B3 is CLOSED per the V3 ruling line —
the B3-future behavior is accepted and CLOSED as a design
question). Bounded by: R1/R2-class stimuli are designed
to pay off exactly in B2 and are harmless in B1. Would
resolve: nothing pre-R5a (D stays unobservable); S1's
outcome narrows it empirically. Owner: Rowan.

**R-11 — D (earliest pending due) is unobservable
pre-R5a.** Basis: no shipped surface exposes the wake's
computed D; R5a's correctness argument proves D from
source instead (identical `MIN(due_at)` query, single
inserter). Bounded by: the source proof + battery. Would
resolve: the R5a deployment itself (behavior under S1 is
the empirical check). Owner: Rowan.

**R-12 — `getAlarm()` semantics after retry exhaustion
are UNSPECIFIED.** Basis: the alarm-semantics assessment
(Q1): documented behavior covers transient past-due
states; what `getAlarm()` returns after delivery retries
are exhausted is not documented — and the live value
**1793562576104** (2026-11-01T19:49:36.104Z, observed
Nov 2, 2026) sits ~20 h past due, inside that unspecified
region. Bounded by: every gate treats the value as a
hard re-read expectation, never an assumption (R6
discipline). Would resolve: platform documentation or a
support case. Owner: Rowan.

**R-13 — The lying-read residual.** Basis: the gate rules
take the darker branch on any UNVERIFIABLE read, but a
storage read that successfully returns a WRONG NORMAL
cannot be detected by construction (named in the v2/v3
designs). Bounded by: dual-surface reads (state route +
`drive=1`) would need to lie identically; census
cross-checks bound the blast radius. Would resolve:
nothing available; standing accepted residual. Owner:
Rowan.

**R-14 — Truth-table row 11 is a design choice awaiting
ruling.** Basis: failed-after-success + a fresh null read
displays `unknown`, deliberately darker than the
verified + fresh-null row (design v4 §9 item 1). If Rowan
prefers the fresher observation to dominate, one function
branch changes. Bounded by: the choice errs darker, never
stronger. Would resolve: Rowan's ruling on design v4 §9.1.
Owner: Rowan.

**R-15 — Death between the stop commit and the stop-record
write.** Basis: v3 analysis §4.6 — an executor/isolate
death in that window leaves the enum committed with the
record unwritten; classification then rests on state +
audit + a fresh read at re-entry (gates v4 §R step 2–3).
Bounded by: the window is one platform round-trip; the
re-entry procedure never re-sends `stop_chain`. Would
resolve: nothing structural on shipped primitives; the
posture is the mitigation. Owner: Rowan.
