# A-3 STAGING / PLATFORM VERIFICATION PACKAGE — TARGETED CORRECTION ADDENDUM C1–C6

Case #10 / P8 (issue #15). Prepared by Wren, 2026-11-16, under Julie's
preparation GO for this addendum only. This addendum answers Rowan's
ruling **RT-H-20261116-95d02b** (SUBSTANTIAL DOCUMENTARY ACCEPTANCE
WITH TARGETED CORRECTIONS REQUIRED; review pin
`91bf4f3a9ad5580cc8c34606479c9607d6950d74`) and amends the **A-3
Staging / Platform Verification Package — Consolidated Amended**
(the operative package, itself superseding original pin
`22f0b238136e90b71b897310ff2383c95c43e7da`). Handoff: RT-H-20261116-6e199f.
Review pin: PIN-SLOT (repo `jedavid33-design/opal-reader`, branch `ui1-review`;
the Dropbox copy carries the filled pin — the only difference between copies). Together, the Consolidated Amended package and this
addendum constitute the operative package identity; where this
addendum and the Consolidated Amended package conflict, this
addendum governs. Provisions of the Consolidated Amended package
not touched below stand unchanged. The provisions Rowan accepted
(ruling §D) are not reopened by this addendum.

**This addendum authorizes nothing.** No staging execution,
credential mutation, trigger creation, deployment, or activation is
authorized by it. Execution remains subject to Rowan's review of
this addendum and then Julie's separate execution GO. Julie is the
only authorizer.

Correction map: C1 → §5R (replaces §5 in full). C2 → §4.0R/§4.1R
(replaces §4.0 and the V1/V2 rows of §4.1). C3 → §1.2R + §2R
(amends §1.2's descriptive discipline; replaces §2's
shared-surface paragraph and adds the queue-consumer and R2
boundary constructions). C4 → §4.2R (new; governs V3 sampling and
the V4/V7 evidence constructions). C5 → §6R/§7R (amends the S-A4
and S-A9 rows of §6; replaces two rows of §7 and adds the
failure-before-activation branch). C6 → §8R (replaces §8 in full)
+ act S-A0 added to §6's inventory.

---

## C1 — §5R. Usage envelope (replaces §5 in full)

### 5R.1 Platform allowances, verified
Account, Workers Free plan, verified 2026-11-16 against
Cloudflare's published Workers limits and Durable Objects pricing
documentation: Workers requests **100,000/day**; Durable Objects
requests **100,000/day**; Durable Objects (SQLite) rows written
**100,000/day**; Durable Objects rows read **5,000,000/day**. All
daily allowances reset at **00:00 UTC**. Daily caps below are
measured per UTC day; window caps are measured over the trial
window (S-A3 landing → S-A10 landing). Where both apply, the
stricter binds. Storage is not a trial resource (no trial act
writes R2/KV/D1 objects; §2R governs the storage boundary).

### 5R.2 Capped resources: measurement source or upper bound
No capped resource is metered by account analytics. Each resource
below names its contemporaneous measurement source — the
coordinator's own durable records or the observer's own act/read
log — or an explicit conservative upper-bound calculation. A
resource whose measurement source becomes unavailable is accounted
at its upper bound, never at zero; if no upper bound can be
computed, §5R.5's suspension applies.

1. **Scheduled-handler invocations.** Source: the durable
   scheduler log (`d6_scheduler_log` rows, one per tick that
   reaches the coordinator) plus, where Workers Logs access is
   available, observable `scheduled()` entries. Upper bound for
   any interval: *expected opportunities in the interval +
   duplicate receipts observed in it*. (An invocation that reaches
   the coordinator leaves a log row; an invocation that does not
   reach it is bounded by the opportunities the `*/30` expression
   can generate — the platform cannot invoke the handler for an
   opportunity that does not exist, and retries of an existing
   opportunity appear as duplicate receipts or fall inside the
   unaccounted count of §4.0R, which is itself bounded by expected
   opportunities.) Failed or unaccounted invocations are therefore
   inside the bound, not outside it.
2. **Coordinator (DO) requests.** Source: counted components, each
   an exact count from a durable record or the observer's log —
   tick receipts (scheduler log), native staging passes (recorder
   pass rows), sampler reads (§4.2R; the observer logs every read
   it issues), supervision exports (§8R), and act/operator reads
   (§6 act log). Native activity is counted, not estimated: the
   staging chain's own passes appear as pass rows. Observation
   overhead is the sampler + export + act reads, each logged by
   the observer at issue time. Any DO consumption visible in
   delayed account analytics in excess of the counted sum is
   reported in the trial report as unaccounted consumption with
   its size; it is not silently absorbed.
3. **DO rows written.** Source: the coordinator's durable write
   records, bounded per event from source: per tick, the tick
   path writes the tick-log row, its completion update, and the
   scheduler-state row (≤ 3 rows, per the package's §5 accounting,
   re-verified against the pinned tree during execution
   preparation — any additional write statement on the tick path
   found there revises this bound upward before S-A3, or stops the
   gate); retention pruning deletes at most one superseded row per
   inserted row in steady state (retention 288 for both the
   scheduler log and the pass log), so pruning adds ≤ 1 row-write
   per insertion; per native pass, ≤ 1 log/state row plus its
   prune. Failed invocations that write nothing count zero here
   and are carried in resource 1's bound.
4. **Worker invocations (total).** Source: scheduled-handler
   invocations (resource 1's count) + every fetch issued by the
   observer or an act (observer's log). No other trial-origin
   fetch path exists.
5. **DO rows read (monitored, not hard-capped).** Upper bound:
   each sampler/export/diagnostics read returns at most the
   retained log arrays (≤ 288 scheduler rows + ≤ 288 pass rows);
   at the maximum read rate in this package (48 sampler + 4
   exports + ≤ 20 act reads per day) the bound is ≤ 72 × 576 =
   41,472 rows/day, under 1% of the 5,000,000/day allowance. It is
   named here so it is accounted, not assumed zero.
6. **DO duration (monitored, explicitly not contemporaneously
   enforceable).** No operator-accessible per-object duration
   meter exists. Duration is bounded in shape by the invocation
   caps above (each counted invocation performs the bounded
   storage work enumerated in resource 3) and corroborated by
   delayed analytics; the trial report states the analytics
   duration figure when it lands. This is a named limitation, not
   a zero: if analytics ever show duration consumption
   inconsistent with the counted invocations, that discrepancy is
   a trial-report defect item.

### 5R.3 Numerical caps — daily AND window
Expected opportunities: 48/day; 336 over the 7-day active window,
plus propagation-epoch ticks (≤ 48 if the trigger is created a day
early — but see §8R.5: the pre-activation interval is now bounded
at 24 hours) and cleanup-epoch ticks (≤ 4).

| Resource | Daily cap (per UTC day) | Window cap | Derivation |
|---|---|---|---|
| Scheduled-handler invocations | **≤ 53** | **≤ 400** | 48 opportunities + 5 duplicate allowance (10% of 48, rounded up); window: 336 + 34 (10%) + cleanup ≤ 4 = 374, capped at the package's 400 |
| Coordinator (DO) requests | **≤ 5,000** | **≤ 25,000** | Stop threshold above the package's ≈ 3,600/day projection (≈ 1.39×); window retained from the package (7 × 5,000 = 35,000 > 25,000, so the window binds across the trial) |
| DO rows written | **≤ 2,000** | **≤ 10,000** | Counted-component maximum ≈ 600/day by §5R.2(3); cap is a stop threshold with headroom; window retained (7 × 2,000 = 14,000 > 10,000, window binds) |
| Worker invocations (total) | **≤ 250** | **≤ 1,500** | Counted maximum ≈ 120/day (48 ticks + 48 sampler + 4 exports + ≤ 20 act/client reads); window retained (7 × 250 = 1,750 > 1,500, window binds) |

The daily caps in this table are NEW provisions of this addendum
(the Consolidated Amended package specified window totals only);
they are Wren-proposed figures for review, derived as shown, not
previously accepted numbers.

### 5R.4 The account-wide reserve rule, re-founded
The package's 50% rule is retained as a ceiling but is no longer
tested against the lagging analytics total. Analytics lag (up to
24 hours, per the package) means the current UTC day's production
consumption is unobservable contemporaneously; the test therefore
substitutes a conservative allowance for unobserved consumption:

> **Reserve test, per resource, per UTC day:**
> P_worst + T_cap ≤ 50,000 (50% of the 100,000 daily allowance),
> where **P_worst** = production's consumption of that resource on
> its largest of the seven preceding UTC days (analytics-anchored;
> the lag covers all seven in full), read at the execution census
> and refreshed at each daily observation, and **T_cap** = the
> trial's daily cap for that resource from §5R.3.

Production's current-day consumption is thus assumed, worst-case,
to equal its worst recent day in full, entirely unobserved — the
ceiling holds contemporaneously without depending on the delayed
total. If the test fails at the execution census for any resource,
the trial does not start. If a refreshed P_worst during the trial
makes the test fail, no new §6 act is performed and Julie is
informed within one observation cycle; acts already landed are
governed by §7R. Production's standing operations retain first
claim in all cases.

### 5R.5 Stop thresholds and metering suspension
Any cap in §5R.3 reached, on its contemporaneous source in
§5R.2 → §7R envelope-breach row. If durable metering becomes
unavailable (status/diagnostics unreadable for two consecutive
observations), the trial SUSPENDS as the package already provides:
no new acts, the trial clock stops for qualification purposes
(but see §8R.4: suspension does not extend the wall-clock
authorization), Julie informed within one observation cycle, the
trigger is NOT deleted under suspension, and resumption requires
restored metering or Julie's express direction. Non-delivery of
the weekly free-tier check does not by itself suspend the trial.
The application's own PT-day quota is untouched by the trial
(halt; no submissions).

---

## C2 — §4.0R / §4.1R. Delivery accounting (replaces §4.0; amends V1/V2)

### 4.0R Opportunity identity
An opportunity is identified by its **tick identity
`cron|scheduledTime`**, where `scheduledTime` is the platform's
scheduled timestamp for that tick, delivered to the worker's
`scheduled()` export and recorded by the coordinator in the
scheduler log row (`scheduled_time`, `tick_identity` columns).
Receipt time is never an identity component and is used for
nothing except latency measurements. Two receipts carrying the
same tick identity are one distinct opportunity plus duplicates,
however far apart they arrive.

### 4.0R.1 Quantities and exact reconciliation
Per epoch (epochs as in the package: E-propagation, E-active,
E-held, E-active-2, E-cleanup), the trial accounts: (1) expected
opportunities, computed from the cron expression and the epoch's
wall-clock boundaries; (2) observable handler invocations —
recorded as UNOBSERVABLE where the telemetry route remains
inaccessible (403, as established), never estimated; (3) tick
receipts (durable log rows); (4) admissions; (5) classified skips,
by reason (including `duplicate_or_stale_tick`); (6) unaccounted
= expected − distinct received opportunities.

Where the log evidence permits, the following identities must
hold **exactly**, per epoch:

- Receipts = Admissions + ClassifiedSkips
- Receipts = DistinctReceived + DuplicateReceipts
- Expected = DistinctReceived + Unaccounted

If an identity does not reconcile exactly, the size and direction
of the discrepancy is reported as an accounting defect in the
trial report; no category is adjusted to force a balance. The
96-tick minimum counts DISTINCT opportunities with a receipt in
E-active + E-held + E-active-2; duplicates never inflate it.

### 4.0R.2 What the result establishes — limitation, verbatim in substance
Observed scheduler receipts are not platform invocations. Where
handler telemetry remains inaccessible, **the trial's result
establishes observed end-to-end receipt reliability only — the
proportion of expected opportunities for which a durable receipt
exists — and does not establish complete platform-delivery
accounting.** Within "unaccounted," pre-receipt platform loss and
pre-coordinator handler failure remain indistinguishable with
current surfaces. This limitation must appear, in substance, in
the activation proposal's evidence section (§9R below).

### 4.1R V1/V2 acceptance (replaces the V1 and V2 rows)
- **V1 delivery:** acceptance requires BOTH, separately:
  (i) unaccounted ≤ 2% of expected in the active epochs; AND
  (ii) **no unexplained gap exceeding two cadence periods
  (60 minutes at the `*/30` cadence) in the active epochs.**
  Criterion (ii) is a requirement, not a reporting duty: a gap
  exceeding it is a V1 failure even if individually reported and
  even if criterion (i) holds. Plus ≥ 96 distinct accounted
  opportunities per §4.0R.1.
- **V2 duplicates:** admissions ≤ receipts ≤ distinct +
  duplicates; every duplicate classified a skip; §4.0R.1's second
  identity holds exactly. No claim about platform retries beyond
  the observation window.
- **Propagation, three separate measurements:** (a) *configuration
  propagation* — S-A3 act completion → the trigger visible in the
  schedules GET read-back; (b) *eligibility wait* — that read-back
  → the first scheduledTime at or after installation, a computed
  quantity of the `*/30` expression and the wall clock, reported
  as arithmetic, not as platform behavior; (c) *first receipt* —
  the first tick log row. The documented ≤ 15-minute bound is
  asserted only against propagation latency measured as (first
  receipt's receipt time − first eligible scheduledTime); the
  eligibility wait (b) is reported separately and is neither
  counted as propagation delay nor hidden inside it.

---

## C3 — §1.2R / §2R. Environment substitutions and shared-resource boundaries

### 1.2R Descriptive discipline (amends §1.2)
The staging variant is described only as **the accepted candidate
tree with exactly the two tree deltas enumerated in §1.2**,
mechanically proven by the pre-upload full-tree diff. It is NOT
described as behaviorally identical to production. In four areas
its behavior diverges from production by construction: (1) the
staging environment constants (`PRODUCTION_SCOPE`
`"staging-smoke"`, `PRODUCTION_INSTANCE` `"smoke-p8"`); (2)
`GENERATION_HALT` `"1"` (production `"0"`); (3) the absent
`OPALREADER_GENERATION_V2` binding; (4) the absent
`OPALREADER_PHASE_POLICY`, which selects the non-enforcing branch
on staging. Every behavioral claim in the package is scoped to
the paths the trial actually exercises under those conditions.
The provider-path safeguards stand as accepted at documentary
strength (the package's three independent, source-verified
closures), unchanged.

### 2R.1 Shared storage (R2) boundary — call paths + prefix evidence
The production quota/plan census is corroboration only and is no
longer cited as proof of absence of staging writes. The boundary
is established by:
- **(i) Call-path enumeration (from the pinned candidate tree).**
  The only `bucket.put` call sites against the R2 binding are
  `host/adapters.mjs:669` (audio-cache flush of pending records)
  and `generation/flush-store.mjs:90` (reached via the D6
  executor's flush-and-verify path, `generation/d6-executor.mjs`).
  Both sit downstream of the generation executor's execute path,
  which requires admitted work and a delivered grant. The
  scheduler tick path, the recorder, and the scheduler-state code
  write only to Durable Object storage (`state.storage`), never
  to the R2 binding. Execution preparation re-runs this
  enumeration against the pinned tree and files it; any
  additional R2 write site found stops the gate.
- **(ii) Prefix-scoped object evidence.** At trial start and at
  trial end, the shared bucket is listed under the staging prefix
  `smoke-p8/` with full pagination; the two listings must be
  identical. Any object appearing under the prefix during the
  window is a trial defect.
- **Stated limit of (ii):** one coordinator-side store is
  constructed with `keyPrefix: ""` (`worker-entry-prod-d6.js`,
  flush-store construction), so a hypothetical flush write would
  not be captured by the prefix listing. The boundary therefore
  rests on (i), with (ii) as corroboration for the cache path —
  stated as such, not papered over. Under halt, no grant can be
  delivered and no execute path can run, so neither put site is
  reachable on staging regardless of prefix.

### 2R.2 Shared queue boundary — incoming consumer path
Outgoing-send inertness (package §2: `env[QUEUE_BINDING]`
undefined on staging) is retained but is no longer the sole basis
for the queue boundary. The incoming path is established by:
- **(i) Source.** The candidate's only queue export is
  `queueHandler` (d6 entry, default export). Its first operation
  is `assertGenerationEnabled(env)`: under staging's
  `GENERATION_HALT` `"1"` it refuses before touching the
  coordinator, any queue binding, or any provider. (The plain
  production entry carries no queue handler at all and records
  that the v1 queue keeps exactly one consumer — the frozen v1
  worker — and stays paused.)
- **(ii) Configuration census.** A queue handler receives
  messages only if the platform registers the script as a
  consumer of that queue. Execution preparation obtains the
  consumer census for the shared v1 queue
  (`opalreader-generation`) and for `opalreader-generation-v2`
  at trial start and at trial end: the staging script must appear
  as a consumer of neither, and the v1 queue's consumer set and
  paused state must be unchanged.
- **(iii) No trial act creates, modifies, or deletes any queue,
  consumer registration, or queue configuration, shared or
  otherwise.** No exception.

---

## C4 — §4.2R. Correlation and evidence construction (new)

### 4.2R.1 Tick-aligned sampling mechanism (V3)
The six-hour supervision cadence (§8R) cannot serve V3's
60-second correlation window. A separate sampler, part of the
trial-watch automation (§8R.2, act S-A0), operates during
E-active and E-active-2:

- The sampler attempts one diagnostics read per tick, as soon
  after the tick's scheduled time as the mechanism can run it.
  Alignment is never assumed: each attempt records its own
  completion timestamp.
- A sample is **valid** iff (a) a scheduler log row exists for
  the tick identity `cron|scheduledTime`; (b) the diagnostics
  read's completion timestamp is within 60 seconds after that
  scheduledTime; and (c) the sample's classification is taken
  from that log row's own recorded classification/action/reason
  — the actual classification decision, durably recorded — not
  inferred from timing. The diagnostics snapshot supplies the
  chain state (latest recorded pass id/at; the armed registration
  as reported by that read). A nearby scheduled timestamp alone
  establishes nothing about coordinator state.
- The sampler runs at every tick in the active epochs until the
  coverage requirement is banked, then stands down to the §8R
  cadence. Coverage required (unchanged from the package):
  **≥ 20 valid samples across the active epochs, including ≥ 5
  whose diagnostics show a native pass recorded within the
  preceding 12 minutes.** Attempts that miss the window are
  invalid samples: they are counted and reported, and prove
  nothing. If the mechanism's latency makes valid samples rare,
  sampling continues for the whole active epochs (≤ 336 attempts)
  and any shortfall is reported as an evidence limitation — it is
  not cured by relaxing the 60-second rule.
- Sampler reads are counted in §5R.2's envelope (each: 1 Worker
  invocation, 1 DO request, ≤ 576 rows read).
- **WAIT exclusion:** samples from E-held, and any sample whose
  log row records the hold as its skip reason, are excluded from
  V3 healthy-classification coverage; where the hold bypasses
  classification there is no classification to correlate. Such
  samples count only toward V5 evidence.

### 4.2R.2 V4 retention boundary (amends §4.1 V4)
The post-migration comparison is defined against the **actual
observed recorder state**, as follows. The §3 baseline capture
(after S-A1) records the tuple set and **M_cap**, its maximum id.
Immediately before S-A2, the tuple set is re-captured (the
refreshed baseline) and **M_mig**, the maximum id at that moment,
is recorded; M_mig — not M_cap — is the migration watermark the
comparison uses (the package's "migration marker durable
(watermark = pre-migration max id)" is read as M_mig). Pass rows
with M_cap < id ≤ M_mig are naturally occurring intervening
passes (the staging chain's ~10-minute watchdog cadence bounds
their expected count at ⌈elapsed minutes / 10⌉ + 1); they belong
to the comparison set and their absence post-migration is a
defect like any other — they are never mistaken for migration
defects, and never excused as defects either. Post-migration,
preservation holds iff every tuple in the refreshed set inside
the retention window (newest 288 by id at M_mig,
DRIVE_PASS_RETENTION) is present with identical fields, where the
only legitimate absences are (a) tuples beyond that retention
bound, in ascending id order, and (b) further oldest-first prunes
bounded in count by the number of passes recorded after M_mig.
Any other absence or field change is migration-induced loss, a
trial defect. Recording failures must be 0 and the derivation
clean, as the package already requires.

### 4.2R.3 V7 outcome classes (amends §4.1 V7)
Classes (a) OBSERVED-and-safely-resolved and (b) NO contention
observed stand as the package defines them. Class (b) is an
**evidence limitation requiring Julie's explicit acceptance
before any activation proposal may proceed** — whether the trial
ends early or runs its full duration. The trial report must
present class (b) as a limitation requiring that acceptance,
never as a pass and never as a failure.

---

## C5 — §6R / §7R. Mutation ambiguity and cleanup (amends §6; replaces rows of §7)

### 6R.1 Ambiguity dispositions (binding on all §6 acts)
- An ambiguous **activation** (S-A4) leaves the scheduler state
  **UNKNOWN** — not unactivated, and not activated. §6's S-A4 row
  is amended accordingly: no dependent act proceeds, and the state
  is established only by the status read-back. If read-back
  cannot resolve the state before the pre-activation bound
  (§8R.5) expires, the failure-before-activation branch (§7R.2)
  runs on the UNKNOWN state as its input.
- An ambiguous **restoration** (S-A9) does **not** establish that
  the variant remains deployed. The actual deployed identity and
  state are determined by independent read-back (deployments list
  + ETag + /health build) before any statement about what is
  deployed is made or acted on. §7's failed-restoration row is
  replaced to read exactly this.
- Every other ambiguous write likewise resolves by read-back
  only; no dependent act proceeds until the truth is established;
  if the truth cannot be established, the act is treated under
  its failure row and reported.

### 6R.2 Restoration compatibility
The package's §6 restoration-compatibility argument (additive-only
migration; the pre-A-3 build's explicit-column INSERT; inert
scheduler tables under the old build) stands as accepted at
documentary strength, **subject to source verification during
execution preparation**: each premise is re-checked against the
pinned tree and the pre-A-3 tree at preparation, and if any
premise is contradicted, S-A9's restore branch is not executable
and the leave-dormant branch (§7R.3) is the cleanup default.

### 7R.1 Usage breach — two phases, distinguished
On an envelope breach (§5R.5): **(1) immediate cessation of
trial observation work** — the sampler and the supervision
exports stop at once; cessation requires no writes and is not
gated on coordinator reachability or on any cleanup step.
**(2) Cleanup writes** (S-A7, S-A8) execute when the coordinator
is reachable, within the already-authorized act inventory; if
the coordinator is unreachable, WAIT law governs, cleanup is
recorded **CLEANUP PENDING** (§8R.4) with its exact unresolved
state, and cessation under (1) is not delayed by cleanup's
pending state. S-A9/S-A10 follow per the matrix once reachable.

### 7R.2 Failure before activation — cleanup branch (new matrix row)
If any of S-A1–S-A3 has landed and activation (S-A4) has not
landed — by failure, by ambiguity unresolved at the
pre-activation bound, or by abandonment — cleanup runs in
reverse order over **what was actually installed**: trigger
delete (S-A8-equivalent) if a trigger exists; restore-or-leave
per §7R.3 if the variant was uploaded; token removal
(S-A10-equivalent) after the evidence export of whatever state
exists. Each step lands on its own read-back proof. A step whose
object was never installed is recorded NOT INSTALLED and skipped:
**a missing prerequisite never forces an otherwise unnecessary
mutation merely to follow the normal cleanup sequence** — in
particular, activation is never performed in order to deactivate.

### 7R.3 Leave-dormant branch — Julie's decision (flagged)
Leaving the verified-inactive variant deployed on staging
(scheduler deactivated, trigger removed, both proven by
read-back) is an acceptable cleanup alternative **only with
Julie's express authorization**. It is not assumed by this
addendum and is listed as Decision Point 1 (§10R). Absent that
authorization, restoration (S-A9) is the cleanup path, subject
to §6R.2.

### 7R.4 Post-restore legacy pass vs authorization expiry
S-A9's landing proof includes one naturally recorded native pass
in legacy shape after restoration. If that pass has not been
recorded by the authorization expiry (§8R.4), the restoration
stands on its read-back proofs (deployments/ETag/health build =
`2fe71b5f…`, diagnostics read succeeds) and the pass observation
is recorded as **PENDING EVIDENCE**: owner Wren, under the
surviving read-only observation authority (§8R.4), reported to
Julie when it lands. Expiry does not extend to complete it. If
no legacy pass is recorded within 24 hours of restoration, the
pending item is reported to Julie as an unresolved evidence
limitation rather than carried silently. WAIT supremacy governs
throughout: no provision of this section authorizes any act
during a WAIT hold that WAIT forbids.

---

## C6 — §8R. Supervision, automation, and hard expiry (replaces §8 in full)

### 8R.1 The trial-watch automation enters the act inventory
The dedicated trial-watch automation is **not** presently in the
authorized act inventory. It enters it only as a new act:

| Act | Prerequisite | Landing proof |
|---|---|---|
| **S-A0 trial-watch automation creation** | Julie's express authorization to create it (Decision Point 2, §10R), given as part of or before the execution GO | Both jobs (§8R.2) listed in the case workspace's schedule with their definitions matching this section; a first supervision export lands in the trial log |

No unattended automation is assumed to execute merely because
this package names it: S-A0's landing proof is the evidence that
it exists and runs.

### 8R.2 Mechanism, boundaries, schedules
- **Mechanism and availability:** two Wren-operated scheduled
  jobs on the same cron mechanism that runs the existing
  authorized S-3 watches today (definitions held in the case
  workspace), operated by Wren. The mechanism is in production
  use for those watches; its known failure mode is a missed or
  failed run, governed by §8R.3. The jobs run outside the staging
  worker; the trial does not depend on any in-worker scheduling
  for its supervision.
- **Jobs and schedules:** (i) a **supervision job every 6 hours**
  performing the §8 export (scheduler status, recent log/event
  arrays, diagnostics, §4.0R epoch counters, §5R durable usage
  counters, production spot-check as the package defines it);
  (ii) a **sampler job at the `*/30` cadence** during E-active
  and E-active-2 only, per §4.2R.1. Failure notification: a
  failed or missed run is itself logged by the mechanism's
  record; Julie is notified under §8R.3's deadline rule, and any
  §7R matrix event is reported the same observation cycle it is
  observed.
- **Read-only boundaries:** both jobs perform read operations
  only (scheduler status, diagnostics, log export, /health,
  schedules GET, settings GET). They hold no authority to perform
  any §6 act; every act remains attended. **Credential access:**
  the staging operator credential created by S-A1, used for
  staging reads only; for the production spot-check, only the
  pre-existing read surfaces already used by the authorized S-3
  watches. No production write credential is accessible to the
  jobs.
- **Removal/expiry:** both jobs are removed at trial close
  (cleanup complete or CLEANUP PENDING recorded), or at Julie's
  direction at any time; the sampler additionally self-stands-down
  per §4.2R.1. Removal is verified by listing the schedule.
- **Human responsibility:** Wren executes any authorized cleanup
  mutation, attended, under Julie's authorization (the execution
  GO covering the §6 inventory, or her fresh direction for
  anything outside it). Julie is the only authorizer.

### 8R.3 Missed-observation deadline (corrects the six-hour claim)
The package's "6-hour maximum unattended interval" claim is
**withdrawn**. At a 6-hour cadence, one missed observation leaves
up to ~12 hours unattended and two consecutive misses up to ~18
hours. The operative rule: the **missed-observation deadline is
12 hours after the last successful observation**. If no
successful observation has completed by that deadline: (a) the
trial is treated as unsupervised — no new §6 act may be
performed; (b) Julie is notified at the first successful contact,
and the interval is declared in the trial report as an unobserved
interval; (c) reconciliation at the next successful observation
proceeds from the durable counters and watermark, as the package
already provides. Separately, two consecutive failed observations
continue to invoke §5R.5's metering suspension. Retention
sufficiency stands as the package states it (288-row scheduler
log ≈ 6 days of ticks, far beyond any export interval), so a
supervision gap does not by itself lose log evidence.

### 8R.4 Hard expiry — fixed wall-clock; authority split
The package's §8 sentence "(plus any WAIT-suspended time, which
extends the CLOCK…)" is **replaced**. The trial authorization
ends **7 days after S-A4 lands, as a fixed wall-clock deadline**.
WAIT suspension suspends qualification and evidence counting
only; it does **not** extend the authorization. At expiry:

- Qualification activity stops.
- Only already-authorized (§6 inventory), reachable,
  WAIT-permitted cleanup acts may execute.
- If cleanup is blocked by WAIT or unreachability, **CLEANUP
  PENDING** is recorded with its exact unresolved state (which
  acts remain, the last read-back state of each object) and Julie
  is notified.
- Continued trigger operation past expiry is **not** an authorized
  extension of the trial. If the trigger remains installed past
  expiry solely because its deletion is blocked, that fact and
  its blocking cause are reported to Julie the same day.
- **Authority split:** *observation authority* (the read-only
  surfaces of §8R.2, including the §7R.4 pending-pass observation)
  survives the qualification deadline until cleanup completes or
  Julie revokes it. *Cleanup authority* covers only §6-inventory
  acts already authorized, and survives only until cleanup
  completes or is recorded CLEANUP PENDING and Julie directs
  otherwise. Neither survival creates any new act, and any
  extension of trial qualification requires Julie's express GO —
  silence never extends anything.

### 8R.5 Bounded pre-activation interval
S-A4 must land within **24 hours of S-A3 landing**. If activation
has not landed by then — including the case where S-A4's state is
UNKNOWN and unresolved — the failure-before-activation branch
(§7R.2) runs and the trial returns to its pre-trigger state. The
trigger may not remain installed indefinitely awaiting activation.

---

## §9R. Evidence for the activation proposal (amends §9)
§9's list stands, with two additions: (1) the §4.0R.2 limitation
sentence, in substance, in the evidence section; (2) the V7
outcome class, and — if class (b) — the record of Julie's
explicit acceptance of that limitation (§4.2R.3), without which
the activation proposal may not proceed.

## §10R. Decision points reserved for Julie
1. **Leave-dormant cleanup alternative (§7R.3):** if cleanup is
   reached, restore the pre-A-3 staging build (S-A9), or leave
   the verified-inactive variant deployed? Leave-dormant requires
   her express authorization at that time; this addendum does not
   assume it.
2. **Trial-watch automation creation (§8R.1, act S-A0):** express
   authorization to create the two scheduled jobs, to be given as
   part of or before any execution GO.
3. **V7 class (b) acceptance (§4.2R.3):** if the trial observes no
   contention, her explicit acceptance of that evidence limitation
   is required before any activation proposal proceeds. (Arises
   only at trial end.)
4. **Noted, not a separate decision:** the new daily caps and the
   reserve-test formula (§5R.3–§5R.4) are Wren-proposed provisions
   entering the operative package only through acceptance of this
   addendum as a whole.

## §11R. Authorization boundary (restates §11)
None requested by this addendum. After Rowan's review of this
addendum, Julie's execution GO for §6's acts (now including S-A0)
inside one trial window under §§5R–8R. Production activation
remains a further separate gate. Production: LIVE under the
standing release. Scheduler: DORMANT. WAIT law: in force and
supreme throughout.

Turn: Rowan's (addendum review).
