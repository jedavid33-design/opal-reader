# Phase B — unresolved-risk register REVISED (V4 corrections round, Nov 2, 2026)

**REVISED EDITION** — answers correction **V4-5** of
Rowan's ruling on the V4 package (record
`ROWAN-CONTAINMENT-V4-RULING.md`), plus the V4-1
consequence for episode-history visibility. Four entries
are corrected IN PLACE, at true strength, with the
correction marked inline: **R-02** (the next-read detection
claim — the actual detection bound is narrower), **R-08**
(historical exhaustion visibility — the `prevEpisode*`
summary holds one episode only; older exhausted episodes
live only in the audit history), **R-13** (the
dual-surface corroboration implication in its bound —
same V4-5(i) family: the two surfaces read one store and
do not corroborate each other), and **R-15**
(commit-to-record uncertainty — what is and is not known
inside the window). All risk ids, entry order, and the
remaining entries are unchanged from the V4 register
(SHA-256 `6e7aefcd…`, pin `b818f5b3…`).

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
on its read-back, not ordering; a surviving registration
is DETECTED only at the next read that can actually see
it — and not prevented. **CORRECTED in the V4 corrections
round (V4-5(i)) — the previous wording ("DETECTED at the
next read") overstated the bound. The actual detection
bound is:** detection happens at a read only if (a) a
read OCCURS — no surface reads on a schedule; the
derivation runs when an operator or gate read happens,
so a divergence nobody reads for is a divergence
undetected, indefinitely; (b) the record read SUCCEEDS
and (c) the fresh registration read RETURNS A VALUE — if
either fails, that read yields `stopConfidence: unknown`,
NOT `contested`, and the divergence is NOT detected on
that read (it is, correctly, not misreported either).
Precisely: a surviving registration is detected at the
next SUCCESSFUL DUAL READ (record readable + `getAlarm()`
returning) performed by any surface, and at no earlier
moment; between the divergence and that read, the derived
display is whatever the last completed derivation said.
Would resolve:
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
v4 §4.3). Bounded by: **CORRECTED in the V4 corrections
round (V4-5(ii), the V4-1 consequence)** — the previous
wording ("the exhausted summary persists in `prevEpisode*`
on every surface") claimed more persistence than the
summary has. Precisely: `prevEpisode*` holds the summary
of exactly the MOST RECENT closed episode; the next clear
overwrites it. An exhausted episode that is no longer the
most recent closed one is visible ONLY in the append-only
audit history (`d6_containment_events`) — on no surface
summary. The enforcement therefore rests on the gates'
mandatory HISTORICAL AUDIT REVIEW (restoration and R3-V
preconditions, as revised): paperwork that reads only the
summary can miss an older exhausted episode entirely.
Presenting a re-stop as a fresh budget is a stated
violation. Would resolve:
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
designs). Bounded by: **CORRECTED in the V4 corrections
round (V4-5(i) family)** — the previous wording implied
the two read surfaces corroborate each other. They do
not: the state route and `drive=1` read the SAME state
store, so a wrong stored value presents identically on
both and dual-surface agreement detects nothing here.
The actual bound is narrower: gate-preflight census
cross-checks against facts containment does not control
(plan/job/phase/queue state) can catch a wrong NORMAL
that contradicts them, at preflight time only; between
reads, nothing detects it at all. Would resolve:
nothing available; standing accepted residual. Owner:
Rowan.

**R-14 — Truth-table row 11 is a design choice awaiting
ruling.** Basis: failed-after-success + a fresh null read
displays `unknown`, deliberately darker than the
verified + fresh-null row (design v4 §9 item 1). If Rowan
prefers the fresher observation to dominate, one function
branch changes. Bounded by: the choice errs darker, never
stronger. Would resolve: Rowan's ruling on design v4 §9.1.
Owner: Rowan. **STATUS: RESOLVED in the V4 corrections
round — Rowan's ruling on the V4 package ACCEPTED the
derived confidence model and truth-table row 11 as design
choices (ruling item R1). The entry is retained in place
for the record; it is no longer an open risk. The open
count falls from 15 to 14.**

**R-15 — Death between the stop commit and the stop-record
write (commit-to-record uncertainty).** Basis: v3 analysis
§4.6 — an executor/isolate death in that window leaves the
enum committed with the record unwritten; classification
then rests on state + audit + a fresh read at re-entry
(gates v4 revised §R). **CORRECTED AND EXPANDED in the V4
corrections round (V4-5(iii)) — what is and is not known
inside the window, stated exactly.** The stop act is not
one transaction: the ENUM commit (with its `stop_chain`
audit row, one transaction) lands FIRST; the physical act
(observe, `deleteAlarm`, read-back) happens NEXT; the
stop-record write (status, armed-before/after, attempt
count — a second transaction) lands LAST. Inside the
window between the physical act and the record write —
and permanently, if death occurs there — the following
holds. KNOWN from the record: the enum is CHAIN_STOPPED;
the episode was minted (its id is the commit's audit row);
a stop was RECORDED as logically initiated. NOT known from
the record: whether the physical act was ever initiated;
whether a `deleteAlarm` was issued; whether it landed;
what the read-back saw. A landed delete with no record
write is indistinguishable in the record from a delete
never attempted — the record is silent in exactly the
place a reader would want it to speak. The ONLY instrument
that separates those cases is a fresh physical read
(`getAlarm()`) at re-entry, which is why the revised §R
credits physical completion from live reads and treats
every such step as UNRESOLVED until one resolves it
(V4-2); conversely, the record CAN lag a physical act that
did land, so a stale-looking record is not evidence the
act failed either. Bounded by: the window is one platform
round-trip in the no-death case; the re-entry procedure
never re-sends `stop_chain`. Would
resolve: nothing structural on shipped primitives; the
posture is the mitigation. Owner: Rowan.
