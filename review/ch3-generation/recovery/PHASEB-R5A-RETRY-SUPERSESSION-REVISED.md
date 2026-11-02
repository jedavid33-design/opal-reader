# Phase B — R5a retry-supersession analysis, REVISED (documented vs assumed, residual risk, consequence limits)

**Status: OFFLINE ANALYSIS ONLY.** Prepared under Rowan's
R5a-revised-package ruling (relayed verbatim by Julie 2026-11-02;
record `ROWAN-R5A-REVISED-PACKAGE-RULING.md`), required work D and
decisions 2–3:

- Decision 2: the 60-minute threshold is **CONDITIONAL** —
  retained as the candidate test value; it must not be
  represented as a proven upper bound on platform retries.
- Decision 3: the mutation budget is **CONDITIONAL** — the memo
  and the strictly-earlier corrective exception are retained; the
  **lack of a traffic-independent rate bound is explicitly
  preserved as an unresolved execution risk** (restated in §5.3).

Nothing in this document authorizes any production action.
Production remains under INVESTIGATION HOLD.

**Supersedes:** `PHASEB-R5A-RETRY-SUPERSESSION.md` (v1). The
revision restructures the analysis into two strictly separated
parts — **Part I: documented platform behavior** (each claim
carries its documentation basis from the accepted
alarm-semantics assessment) and **Part II: assumptions** (each
labeled, with what breaks if it is false) — and adds the residual
risk walk-through and the containment/gate consequence limits
the ruling requires. The safeguard mechanism itself is unchanged
from v1 and as implemented in the pinned R5a candidate
(`ALARM_STALE_THRESHOLD_MS = 3,600,000`, coordinator candidate
:144 of the R5a tree): the past-due disjunct fires only when
`armed <= now - ALARM_STALE_THRESHOLD_MS`.

---

## Part I — DOCUMENTED platform behavior

Each claim below is documented in the sources the accepted
assessment reviewed (Cloudflare Durable Objects documentation,
as cited there); the assessment's finding tags are carried so
Rowan can re-check provenance without re-reading it.

- **D-1 (assessment D1). At-least-once with bounded retries.**
  Durable Object alarms have guaranteed at-least-once execution.
  When an `alarm()` invocation throws, the platform retries it
  automatically, with exponential backoff starting at a
  2-second delay, **up to 6 retries**.
- **D-2 (assessment D1). Retries attach to the most recent
  registration.** Retries apply "only to the most recent
  `setAlarm()` call." A new `setAlarm()` therefore re-bases the
  retry chain: the pending retry sequence of the previous
  registration is superseded by the new registration.
- **D-3 (assessment D1). Retry fires only on uncaught exception.**
  A handler that returns normally ends the chain; there is no
  retry of a successful invocation.
- **D-4 (assessment D2). The retry-gap read.** `getAlarm()`
  returns the scheduled time while an alarm "is considered to be
  set if it has not started, or if it has failed and any retry
  has not begun." A past-due armed value is therefore the
  *expected* read during the gap between a failed invocation and
  the start of its next retry.
- **D-5 (assessment D2). Ordinary delivery delay.** Apart from
  retries, delivery delay is documented as milliseconds, up to
  about a minute during maintenance or failover.
- **D-6 (assessment, Q2 as amended). No documented catch-up
  scan, no documented self-healing.** No self-healing mechanism
  was identified in the reviewed documentation for an alarm that
  is never invoked; no documented mechanism delivers an overdue
  alarm on object re-instantiation.
- **D-7 (assessment D1/refinement). One registration per object.**
  `setAlarm()` replaces the single alarm registration for the
  Durable Object; `deleteAlarm()` removes it; `getAlarm()` reads
  it.

## Part II — ASSUMPTIONS (labeled; what breaks if false)

- **A-1. The backoff multiplier is doubling (×2).** The
  documentation says "exponential" and a 2-second start; it does
  not state the base. *If false:* the total retry envelope in
  §4 changes by the true multiplier's arithmetic (×4 → 2,730 s;
  ×5 → 7,810 s). The threshold derivation is presented as an
  envelope over this assumption, never as a bound.
- **A-2. The retry sequence is the only platform source of a
  legitimate past-due-but-pending armed value lasting more than
  ~a minute.** Rests on D-5 (ordinary delay ≤ ~1 min). *If
  false* (some undocumented platform state holds a registration
  past-due for longer), a wake past the threshold could supersede
  that state too; the consequence analysis in §5 covers the
  general shape — the superseded thing is a drive pass.
- **A-3. Durable Object invocations for one object are
  serialized.** Relied on in scenario S3 (an in-flight retry
  racing a re-registration can produce at most sequential
  passes). *If false,* two passes could interleave; the shipped
  pass semantics (revision-checked grants, idempotent schedule
  processing) bound the damage, but concurrency at that layer is
  not something this analysis can retire — it is listed as
  residual.
- **A-4. Post-exhaustion registration state.** UNSPECIFIED in the
  documentation (v1 §2.3, unchanged): after the 6th retry fails,
  whether the registration persists, is dropped, or keeps reading
  as set is not documented. No assumption is made; the live
  incident (armed value unchanged for ~20 hours, then unchanged
  again across the P2 deploy) is incident evidence, not a
  platform guarantee.

## §3 Supersession scenarios (re-based on Part I/II)

A = armed value read by a wake; D = earliest pending due time
(proven the true MIN over all pending schedule rows — revised
spec §2.2); suppose A is past-due beyond the threshold at the
wake.

- **S1 — retry pending, would have succeeded.** Per D-2 the new
  registration supersedes the retry chain; the alarm fires at D
  instead. The pass that runs is the shipped `alarm()`; which
  trigger delivered it does not change pass semantics. Harm: none
  identified in pass behavior.
- **S2 — retry pending, would have failed again.** The fresh
  registration carries its own retry budget (D-1): more delivery
  attempts than the platform alone would have made. Passes remain
  the shipped semantics.
- **S3 — in-flight retry races the re-registration
  (UNSPECIFIED).** Whether a retry already dispatched when
  `setAlarm()` re-bases the registration is cancelled or may
  still arrive is not documented. Under A-3 the worst case is an
  extra sequential pass running the shipped semantics.
- **S4 — no retry pending (delivery genuinely lost).** The
  incident hypothesis (B1/B2 family): re-registration is the only
  recovery, and in the live incident A is ~20 hours past due —
  20× the threshold — so the safeguard costs this case nothing.
- **S5 — healthy chain, transient retry gap, heavy wake
  traffic.** The case the threshold exists for: inside the
  threshold, a past-due A is treated exactly as shipped; no wake
  re-registers, so a struggling alarm keeps its own retry cadence
  (D-1/D-2) instead of being churned by unrelated traffic.

## §4 The threshold, at its true strength

`ALARM_STALE_THRESHOLD_MS = 3,600,000` (60 minutes) — **a
provisional candidate test value** (ruling decision 2), chosen
against the Part I/II envelope:

- Under A-1 (doubling), the full retry sequence spans
  2+4+8+16+32+64 = **126 s** from first failure to the last
  retry's start; adding D-5's ~60 s documented failover delay
  gives a documented-plus-assumed envelope of ≈ 186 s.
- 3,600 s is ≈ 19× that envelope, ≥ 28× the assumed retry
  envelope alone, and 60× the D-5 delay.
- Sensitivity (arithmetic, not assurance): the value stays above
  the envelope for multipliers up to ×4 (2,730 s) and is exceeded
  at ×5 (7,810 s).

**What is NOT claimed:** that 60 minutes bounds platform retry
behavior; that no legitimate retry can be pending beyond it;
that the permanent condition is proven safe. The wording
discipline of this package: the threshold is a named design
constant whose value is Rowan's to rule, presented with its
derivation and its sensitivity — nothing stronger. (Self-check:
this document and the companion documents use "upper bound" /
"proven" about the threshold only in negated sentences like this
one.)

## §5 Residual supersession risk — named, bounded, and limited by design

### 5.1 The risk, named

**Residual supersession risk:** a wake that fires the past-due
disjunct while the platform still holds a genuinely pending
retry of a failed alarm invocation, superseding that retry
(per D-2) before it can run. This can happen only if reality
exceeds the §4 envelope: a backoff shape beyond the ×5 sensitivity
point (against A-1), an undocumented hold state (against A-2),
or post-exhaustion behavior (A-4) that keeps a retry notionally
alive far longer than the documented cadence suggests.

### 5.2 What the superseded invocation carried — worst case walked through

The lost retry would have run one shipped alarm pass: base
schedule processing + (in the pre-containment build) recover +
driveOnce. Walk the worst case under the CURRENT holds and the
§7.3 pre-classified movement set (R5a paperwork):

1. The re-registration fires a pass at D instead — the same pass,
  driven by the new registration. The retry's loss is therefore
  primarily a *bookkeeping* loss inside the platform (its cadence
  bookkeeping), not a lost unit of work: the work the retry
  carried is exactly the work the new registration's pass does.
2. If the retry ALSO arrives (S3, unspecified), the extra pass
  runs the same shipped semantics sequentially (A-3). Its
  effects are bounded by the per-pass set: ≤1 grant for the
  preserved occurrence, derived reserved ∈ {0, 12}, job
  queued→generating at most once, occurrence pending→granted at
  most once — the transitions are state-machine steps, not
  per-pass accumulations; a second pass over the same state
  finds the grant already issued and the drive's own guards
  refuse a duplicate.
3. Under the holds, no pass in any of these branches dispatches
  anything (delivery is halt-fenced; `GENERATION_HALT = "1"`,
  queue paused), and spend is $0 in all branches. The grant/void
  cycle that a revived chain produces is bounded by the lease
  cadence (~15 min) and the §7.3 invariants, and the occurrence
  ceiling (153,636 units ≈ $0.154) caps the accounting exposure
  of the single preserved occurrence in every branch.
4. Duration of exposure: from the stimulus until containment is
  applied — which is why §5.4 makes containment a *precondition*,
  not a reaction.

### 5.3 The traffic-bound item (decision 3, preserved unresolved)

The R5a alarm-mutation budget remains: ≤1 `setAlarm` per wake
operation (≤2 only for a strictly-earlier corrective second),
registrations value-identical at D, self-terminating on first
delivery. **There is no traffic-independent rate bound, and none
is claimed:** registrations per unit time are bounded by wake
operations per unit time, and wakes are operator/client actions
(each an audited commands row or a report). This stays on the
record as an **unresolved execution risk** for Rowan's gate
ruling; the containment design does not retire it — it bounds
the *consequences* of the churn (a stopped chain accepts no
registrations at all), not the rate at which wakes arrive.

### 5.4 How the containment and execution gates limit the consequences

1. **Sequencing (ruling decision 5, accepted in principle):**
   independently verified containment precedes any authorized
   revival stimulus. Gates C1 (deploy) and C2 (verify) in
   `PHASEB-RECOVERY-GATES-V2.md` put a *tested* stop in place
   before Gate R5a-D deploys the condition and long before Gate
   S1 sends any stimulus. The residual risk's exposure window
   therefore opens only with a verified containment already
   standing.
2. **Layer 1 as the immediate brake:** if a stimulus (or a
   supersession side-effect) revives the chain in an unexpected
   shape, `contain_drive` stops all further grant issuance at
   the next pass while preserving schedule processing and lease
   closure — the §5.2 effects stop accumulating.
3. **Layer 2 as the full stop:** `stop_chain` removes the
   registration and gates every resurrection path; its
   verification is by passive reads (state route + drive=1),
   never by provoking traffic.
4. **Observation + STOP discipline in the gates:** Gate S1's
   observation window and classification rules (any movement
   outside the §7.3 set = STOP + report) bound how long an
   unexpected shape runs unexamined; correction 6 is carried
   verbatim — STOP binds stimuli, and containment is the named
   mechanism for the chain itself.
5. **Threshold as the first fence:** none of the above is needed
   for the ordinary S5 case, which the threshold prevents from
   arising at all — inside 60 minutes, shipped behavior stands.

### 5.5 Evidence status

Offline evidence for the threshold behavior: R5a battery group
R5A-T3 (5/59/60/61-minute cases + shipped-build twin), green on
the R5a candidate and on the composed tree (23/23 in both runs;
`suites/logs/r5a-on-r5a.log`, `suites/logs/r5a-on-composed.log`).
Real platform retry behavior, real backoff shape, and the S3
race **cannot be tested offline** and remain evidence gaps; the
harness invokes `alarm()` directly and models no platform retry
machinery. **Permanent production safety is NOT claimed until
the retry issue is resolved** (Rowan's formulation, adopted
verbatim) — this document proposes the threshold as a bounded,
reviewable risk-reduction inside a separately gated decision,
and §5.1–§5.4 are the bounds.
