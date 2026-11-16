# A-3 STAGING VERIFICATION — FINAL CORRECTION ADDENDUM (R1–R4)

Filed 2026-11-16 under Julie's filing GO (recorded on the board in this
round). Review pin: PIN-SLOT (repo `jedavid33-design/opal-reader`, branch
`ui1-review`; the Dropbox copy carries the filled pin — the only difference
between copies).

Case #10 / P8 (issue #15). This addendum resolves the four residual
correction groups of Rowan's ruling on the C1–C6 addendum (LIMITED
CORRECTION HOLD; verbatim board 6927029070). It is narrow: it
changes no accepted provision, no objective, and no source. Handoff:
RT-H-20261116-3583bb

**Operative package and precedence (immutable identities):** where
the documents conflict, the later governs —
1. this final addendum (pin assigned at filing);
2. the C1–C6 targeted correction addendum, pin
   `ed9718c738367b1b1b4417fb1aa63bf8b658f0ea`;
3. the Consolidated Amended package, pin
   `91bf4f3a9ad5580cc8c34606479c9607d6950d74`;
4. the original verification package, pin
   `22f0b238136e90b71b897310ff2383c95c43e7da`.
This addendum authorizes nothing; the execution GO remains Julie's,
separate, and is presented only after documentary closure, with the
decisions in the order Rowan's ruling specifies.

## R1 — Measurement strength and reserve policy

**R1.1 Three quantities, never conflated (replaces the C-addendum's
invocation "upper bound," which is WITHDRAWN).** (a) **Observable
receipts** — durable scheduler log rows; exact. (b) **Estimated
handler usage** — receipts plus observed duplicates plus a declared
failure-multiplicity allowance; an ESTIMATE, labeled as such
wherever used. The prior construction (expected opportunities +
duplicates as a bound) is withdrawn: repeated pre-receipt failures
of one opportunity are not bounded by the unaccounted count, and no
text in the operative package may present (b) as a proven bound on
actual invocations. (c) **Independently measured invocations** —
Workers Logs where accessible; where the telemetry limitation
applies, this quantity is recorded as UNMEASURED, not estimated
into existence. The invocation caps bind (a) + (b) as OPERATIONAL
THRESHOLDS: reaching them stops the trial (the protective purpose),
without claiming they bound (c).

**R1.2 Every threshold classified (amends §5R).** Each capped
resource's threshold is labeled exactly one of: **ENFORCED**
(a durable counter on the same resource gates it contemporaneously
— the receipts caps), **ESTIMATED** (computed from durable counters
× declared per-unit bounds), or **RETROSPECTIVELY VERIFIED**
(checked after the fact against account analytics; a contradiction
is a defect, discovered late and recorded as such). The DO
rows-written and requests calculations are extended to include, at
their declared per-unit bounds: migration/schema-ensure writes,
activation / hold-set / hold-clear / deactivation writes (state +
event rows per transition), scheduler event rows, fallback passes
(counted as passes), failed operations that partially write (a
declared per-failure allowance of one full operation's bound), and
cleanup-related database activity (deactivation, restore-era
passes, pending-watch reads are reads — counted as requests, not
rows). DO **rows read** is monitored as ESTIMATED (returned rows
are a lower bound on rows read, stated as such). DO **duration** is
RETROSPECTIVELY VERIFIED only, with a contemporaneous PROXY
reported alongside: the sum of (finished_at − at) over tick and
pass log rows — a proxy for coordinator execution time, not billed
duration, and never presented as an enforced bound.

**R1.3 The reserve is a planning and risk-acceptance policy
(replaces §5R's contemporaneous-guarantee framing).** The
seven-day-maximum formula is a historical PLANNING ESTIMATE, not a
bound on current-day consumption. The operative policy: at the
execution census, the planning test must hold — planning basis
(max of production's worst of the preceding 7 complete days and
3 × its trailing 7-day average) + the trial's daily caps + an
OTHER-ACCOUNT-USAGE allowance (a single declared figure covering
the account's other standing consumers — the S-3 and weekly
watches, the widget refresh, and attended work — populated at the
census from their observed profiles) ≤ 50% of each daily free
allowance. During the trial, protection is the trial's own
classified thresholds (R1.2) plus retrospective analytics
corroboration; if corroboration ever shows the account above the
reserve line, that is a retrospectively discovered breach, handled
by the breach row and recorded at that strength. **Residual
metering limitations, stated for Julie's acceptance at the
execution GO:** actual handler invocations and billed DO duration
cannot be contemporaneously enforced with the available telemetry;
the reserve is a conservative planning policy, not a guarantee.
No telemetry access is invented and the accepted implementation is
not changed to chase one.

## R2 — Evidence interpretation

**R2.1 Propagation, three quantities reported separately (amends
§4.0R).** (i) **Control-plane visibility**: trigger creation → the
trigger's presence in a schedules GET. (ii) **Observed delivery
latency**: the first eligible scheduled timestamp → its first
receipt. (iii) **Configuration propagation** (control-plane write
→ platform-effective scheduling): **NOT MEASURED by this trial** —
no available surface separates it from (ii). The published
≤ 15-minute propagation figure is documentation context for the
plausibility of (i)–(ii) timings and is never applied as a bound to
either measured quantity. E-propagation's acceptance rests on (i)
and (ii) as measured, with (iii) named as unmeasured.

**R2.2 Ambiguous samples; the actual migration marker (amends
§4.2R).** A correlation sample is **AMBIGUOUS** — excluded from V3
coverage and reported in its own count — if the paired diagnostics
snapshot shows state movement attributable to the tick itself, or
the ordering between the tick's recorded decision inputs and the
snapshot cannot be resolved (e.g., the snapshot's latest pass is
the tick's own fallback pass, or the registration changed across
the sample window). An ambiguous sample establishes nothing about
pre-decision state; only samples whose snapshot is consistent with
the log row's recorded inputs count as valid. For V4: the
preservation window is computed from the **durable migration
marker's actual value** (read from `d6_recorder_meta`
post-migration); the pre-upload capture (M_cap) is a BASELINE, not
the watermark. Rows with ids in (M_cap, actual watermark] are the
INTERVENING set: their post-migration presence and shape are
verified, but their pre-migration field values were never captured,
so **field-level preservation across the intervening interval is
not independently established** — the trial report states this as
an evidence limitation at exactly that scope, rather than asserting
equality. Baseline-set preservation (tuples captured before upload,
inside the actual window) remains tuple-exact as before.

## R3 — Cleanup under unknown state

**The failure-before-activation branch splits (amends §7R).**
(a) **Activation ESTABLISHED NOT LANDED** (a status read shows no
active state, epoch unstarted): cleanup proceeds as the C-addendum
specifies — trigger deleted, token removed after final reads,
variant restored or left per Julie's decision — and dormancy may
be claimed on the status read's strength.
(b) **Activation UNKNOWN**: the scheduler is classified **UNKNOWN**
in every record. Trigger deletion may proceed (a control-plane act
on a known object) but establishes NOTHING about the scheduler;
no record may claim restoration to the pre-trigger state or
verified dormancy from it. Resolution is by status read-back at
each observation until established; if ACTIVE is established, the
authorized deactivation path runs then (subject to WAIT); if the
state cannot be established, the outcome is **CLEANUP PENDING —
scheduler state UNKNOWN**, with no manufactured disposition.

**Retained observation for pending evidence (resolves the
lifecycle conflict).** When CLEANUP PENDING is recorded with
pending evidence outstanding (an unresolved scheduler state, or a
post-restore legacy pass not yet observed), the retained mechanism
is the **PENDING-WATCH**: the trial-watch job is NOT removed at
cleanup; it continues read-only at a reduced cadence (every 12
hours), performing only the pending-evidence reads (scheduler
status and/or staging diagnostics) plus its export to this case's
chat. **Credential dependency:** it uses the staging operator
token, so **S-A10 (token removal) is deferred while the
pending-watch lives** — token removal's prerequisite becomes
"pending-watch terminated." **Bounded termination:** the earlier
of (pending evidence resolved + final export filed) or **14 days**
after CLEANUP PENDING is recorded; at the bound, the watch stops,
the token is removed, and any still-unresolved state is handed to
Julie as a standing recorded limitation. The SAMPLER job is always
removed at cleanup regardless (its purpose is trial-bound).
Pending-watch removal, when it occurs, is verified by cron listing
like every other removal (R4.2). Julie's execution GO authorizes
this bounded continuation explicitly as part of S-A0 (R4.1), so no
post-expiry improvisation is involved.

## R4 — Supervision bootstrap and bounded lifecycle

**R4.1 Creation ≠ readiness (amends §8R / S-A0).** S-A0's landing
proof is redefined as a BOOTSTRAP proof on pre-installation
surfaces only: both jobs exist (cron listing) AND one manual run of
the watch produces a well-formed observation export using only the
production spot-check reads and the staging CLIENT surfaces
(/health, capabilities) — no operator token, no scheduler surface.
**Operational readiness** is a separate, named checkpoint AFTER
S-A1 and S-A2 land and BEFORE S-A3: the watch completes one full
observation cycle against the landed staging build (diagnostics +
scheduler status + production spot-check), filed as the readiness
record. **S-A3 (trigger creation) is prohibited until the readiness
record exists.** The sampler's readiness is established by its
first on-schedule export inside the sampling period, reported in
the first trial observation.

**R4.2 Automation lifecycle, inventoried separately.** Creation
and removal of both observer jobs are **external automation
operations**, inventoried in their own table in the trial record
(create watch / create sampler / remove sampler / remove watch or
pending-watch), distinguished from counted Cloudflare/staging
mutations (they consume none of the staging envelope; their read
consumption is inside the observation bounds). Every removal is
VERIFIED by a cron listing quoted in the trial report — never
assumed. **Observer-failure detection, honestly stated:** the
missed-observation deadlines, usage thresholds, and expiry are
detected BY the observer when it runs. If the observer itself
fails completely (the cron system or Wren's runtime), **there is
no automatic detection** — this limitation is disclosed, not
papered over. The attended fallback: the trial's schedule and
deadline are on record in this case's chat, and Wren checks the
trial state at the next interaction in this chat and at every
subsequent one until the trial closes; Julie is likewise a
detector of last resort (silence beyond the 12-hour deadline + the
stated grace is itself reportable by her at any contact). Any
interval of complete observer failure is recorded in the trial
report as an OBSERVATION GAP with qualification time suspended for
it, and any deadline falling inside a gap is dispositioned at
recovery on the facts then established — never backdated as met.

**R4.3 Cleanup budget (amends §5R).** The envelope distinguishes:
(i) **QUALIFICATION stop thresholds** — the daily/window caps as
classified in R1.2; reaching one stops qualification. (ii) A
**CLEANUP RESERVE**, held outside the qualification caps and usable
ONLY for the cleanup acts, their verification reads, and the
pending-watch's bounded reads: DO requests ≤ 2,000, rows written
≤ 500, Worker invocations ≤ 100 (window totals). (iii) The
**TOTAL envelope** = qualification caps + cleanup reserve, the
bounded total consumption of the trial. Cleanup therefore never
breaches the total by drawing on its reserve; a cleanup need
beyond the reserve is reported to Julie, not executed.

Turn: Rowan's (final addendum review), after Julie's filing GO.
