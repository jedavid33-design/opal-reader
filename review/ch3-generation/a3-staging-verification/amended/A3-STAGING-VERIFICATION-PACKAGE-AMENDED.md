# A-3 STAGING / PLATFORM VERIFICATION PACKAGE — CONSOLIDATED AMENDED

Case #10 / P8 (issue #15). Prepared by Wren, 2026-11-16, under Julie's
preparation GO (board 6926457271), consolidating the original package
(pin `22f0b238136e90b71b897310ff2383c95c43e7da`) with the amendments
A1–A6 required by Rowan's package ruling (PASS WITH REQUIRED
AMENDMENTS; verbatim board 6926589020). This document supersedes the
original package as the operative text. Handoff: RT-H-20261116-95d02b
Review pin: PIN-SLOT (repo `jedavid33-design/opal-reader`, branch `ui1-review`;
the Dropbox copy carries the filled pin — the only difference between copies).

Amendment map: A1 → §5 (usage envelope, now numerical). A2 → §4.0
(delivery-vs-receipt accounting, epochs). A3 → §1.2 (TWO tree deltas,
fully enumerated) + §2 (binding-contract reconciliation, call-path
boundary). A4 → §3 (baselines) + §4 (V3 correlation, V4 preservation
comparison, V7 outcome classes). A5 → §6 (act dependencies and
landing proofs) + §7 (cleanup matrix, restoration compatibility).
A6 → §8 (supervision). §9–§11 carry forward the evidence list, the
E8 contingency, and the authorization boundary unchanged in substance.

## 1. Identities and the staging variant

### 1.1 Identities
- Source candidate: the accepted A-3 implementation, pin
  `7f8b98d4a82f2fb41a88caf0e7a03be5e9a0148b` (now also the live
  production build, dormant).
- Staging worker: `opalreader-api-v2`, current build
  `2fe71b5f3194f0c022a5959f1206c57e7a3240f2`, ETag `61553a07…`
  (888,430 B), scope `staging-smoke`, instance `smoke-p8`,
  generation halted (census §3.1 of the original filing).

### 1.2 The staging variant — TWO tree deltas (A3, corrected)
The variant is the accepted candidate tree with exactly TWO tree
deltas, both in entry/configuration files, established from source
and mechanically proven by a complete diff filed before upload:

- **Delta 1 — build identity** (`v2/host/build-identity.mjs`):
  BUILD_COMMIT → this package's review pin as accepted.
- **Delta 2 — staging environment constants and class identity**,
  confined to `v2/worker-entry-prod.js` and
  `v2/worker-entry-prod-d6.js`:
  - `worker-entry-prod.js:72` PRODUCTION_SCOPE `"production"` →
    `"staging-smoke"`; `:73` PRODUCTION_INSTANCE `"account"` →
    `"smoke-p8"` (staging's connector contract: scope
    `staging-smoke`, instance `smoke-p8`).
  - The coordinator class name `OpalReaderCoordinatorProd` →
    `OpalReaderCoordinator` at its definition
    (`worker-entry-prod.js:100`) and at the import alias and export
    in `worker-entry-prod-d6.js` (:257, :773, and code references;
    comment occurrences are listed in the diff proof either way).
  No other file changes; no logic, provider-routing, queue-routing,
  or storage-routing edit. The pre-upload proof is a full-tree diff
  against the accepted candidate whose every hunk is one of the
  enumerated substitutions; **any additional hunk stops the gate**
  and is filed for review per the ruling's §C rather than absorbed.
  GENERATION_HALT is not a tree delta: it comes from the staging
  settings (`"1"`) and remains `"1"` throughout.

## 2. Isolation and the binding contract (A3)

Staging facts are as filed in the original census (separate DO
namespace `40873aba…`; no `GEMINI_API_KEY`; schedules []). The
candidate's binding contract, read from source, reconciles against
staging's configuration as follows — compatibility is established
per row, not inferred:

| Candidate reads | Production | Staging | Consequence on staging |
|---|---|---|---|
| `COORDINATOR` (DO) | ns `005ba6f8…`, class …Prod | ns `40873aba…`, class `OpalReaderCoordinator` | Isolated object; Delta 2 aligns the class name |
| `GENERATION_HALT` | `"0"` | `"1"` | Send path never wired; scheduled admission independently refused (LIVE-only scope) |
| `OPALREADER_V2_SCOPE` | `"production"` | `"staging-smoke"` | Delta 2 aligns the entry's expectation |
| `OPALREADER_ACCESS_TOKEN` | prod secret | staging's own secret | Client surfaces gated by staging's token only |
| `OPALREADER_MIGRATION_OPERATOR_TOKEN` | prod secret | ABSENT → added by S-A1 (staging-only value) | Operator reads on staging only |
| `QUEUE_BINDING = "OPALREADER_GENERATION_V2"` (gen-constants.mjs:65; entry :327 `env[QUEUE_BINDING]`) | queue `opalreader-generation-v2` | **name absent** (staging's queue binding is named `OPALREADER_GENERATION`) | `env[QUEUE_BINDING]` is undefined → the queue send path is structurally inert on staging, independent of halt |
| `OPALREADER_STORAGE` (R2) | bucket `opalreader-storage`, prefix from `R2_KEY_PREFIX ?? ""` → `""` | same bucket, `R2_KEY_PREFIX` `"smoke-p8/"` | Shared bucket, prefix-scoped; the trial writes no R2 objects (no generation) |
| `OPALREADER_PHASE_POLICY` | `"enforce"` | ABSENT | Read once (entry); absence on staging = the non-enforcing branch — recorded as a known staging/prod divergence; immaterial under halt with no submissions, and no trial act submits work |
| `GEMINI_API_KEY` | prod secret | ABSENT | Provider call path closed (below) |
| `ALLOWED_ORIGIN` | Pages origin | same value | CORS only |

**Provider call-path boundary (documented, not asserted absolute):**
a provider call from this codebase requires (i) a synthesis path in
the generation service, which requires admitted work, which requires
the drive machinery to issue a grant; (ii) grant delivery, wired
only when `GENERATION_HALT !== "1"`; and (iii) an adapter holding
`GEMINI_API_KEY`. On staging all three are closed independently:
halt `"1"` (no wiring, no scheduled admission), the queue binding
name absent (no send target), and no key (no adapter credential).
The package claims exactly this: three independent, source-verified
closures — not a metaphysical impossibility.

**Shared-surface affirmative evidence:** the v1 queue
(`opalreader-generation`, staging's `OPALREADER_GENERATION` binding)
is send-inert for the reason above and is read (paused state,
consumer) at trial start and end; the shared R2 bucket receives no
trial writes, verified at trial end by the production census
(bindings watermark and phase figures unchanged apart from
independently explained production activity).

Binding inventory verification: the complete staging inventory
(8 bindings today; 9 after S-A1) is verified by identity, type, and
non-secret configuration before upload and after landing, per the
deployment gate's E2 discipline — including halt `"1"`, namespace
`40873aba…`, queue identity, `smoke-p8/` prefix, and observability
enabled.

## 3. Baselines (A4)

- **Before S-A1 (client + CF surfaces, available now):** staging
  /health (build, scope, halted), capabilities, quota, settings,
  schedules [], script settings + ETag — the original census stands
  as this baseline's first capture and is refreshed at execution.
- **After S-A1, before S-A2 (earliest operator baseline):**
  diagnostics drive=1 (latest pass id/at, armedAt, pendingSchedule,
  pendingWatchdog, recordingFailures), repair status, conflicts, and
  the pre-A-3 recorder census for V4: **the full retained pass-row
  set as (id, at, stage, drive_invoked, armed_after) tuples**, plus
  row count and max id. The scheduler-status route does not exist on
  the pre-A-3 staging build; its 404/refusal is recorded as the
  baseline fact, not treated as a defect. **Limitation, stated:**
  no operator baseline exists before S-A1 because staging binds no
  operator token today; the client-surface baseline above is the
  pre-S-A1 record, and nothing is reconstructed beyond it.

## 4. Objectives, accounting, and acceptance (A2, A4)

### 4.0 Delivery-vs-receipt accounting (A2)
The scheduler's event stream is the RECEIPT record; it is not
treated as proof of platform delivery. The trial accounts, per
epoch, six separate quantities:
1. **Expected opportunities** — computed from the cron expression
   and the epoch's wall-clock boundaries (recorded at each act).
2. **Observable handler invocations** — scheduled() entries visible
   in Workers Logs (observability persisted on staging). KNOWN
   LIMIT: the account's telemetry query route is not available to
   the operator credential (403, established); where log access is
   unavailable, this quantity is recorded as UNOBSERVABLE and the
   accounting proceeds on (1), (3)–(6) with the gap named.
3. **Tick receipts** — durable scheduler log rows (one per delivered
   tick that reaches the coordinator, admitted or skipped).
4. **Admissions** — receipts with action admitted.
5. **Classified skips** — receipts by reason (incl.
   `duplicate_or_stale_tick`).
6. **Unaccounted** — expected − distinct received opportunities,
   reported as a number with its possible causes (pre-receipt
   platform loss, pre-coordinator handler failure) stated as
   indistinguishable with current surfaces.
**Epochs:** E-propagation (trigger creation → activation),
E-active (activation → hold set), E-held (hold set → hold clear),
E-active-2 (hold clear → deactivation), E-cleanup (deactivation →
trigger deletion). **The 96-tick minimum counts DISTINCT scheduled
opportunities with a receipt in E-active + E-held + E-active-2** —
duplicates never inflate it (a duplicate receipts against an
already-counted opportunity). Observed duplicate handling supports
no claim about platform retries beyond the observation window.

### 4.1 Objectives (V1–V7, amended)
- **V1 delivery:** per §4.0; acceptance: ≥ 96 distinct accounted
  opportunities; unaccounted ≤ 2% of expected in the active epochs,
  each unexplained gap > 2 cadence periods individually reported;
  propagation time (creation → first receipt) measured and stated
  against the documented ≤ 15-minute bound.
- **V2 duplicates:** admissions ≤ receipts ≤ distinct + duplicates;
  every duplicate classified a skip. Acceptance as before, with
  §4.0's no-beyond-window caveat.
- **V3 healthy classification (correlation-defined):** a
  classification sample counts only when paired with a diagnostics
  read taken within 60 seconds of the tick's scheduled time showing
  the staging chain's state. Coverage required: ≥ 20 correlated
  samples across the active epochs, including ≥ 5 whose diagnostics
  show a native pass recorded within the preceding 12 minutes.
  Acceptance: zero INTERVENE classifications among correlated
  samples whose diagnostics show a healthy chain (registration
  present or a pass inside the watchdog period, no overdue work).
  Uncorrelated rows are reported but prove nothing.
- **V4 migration (preservation-defined):** post-migration, the §3
  tuple set is re-read. Preservation holds iff every pre-migration
  tuple inside the retention window (newest 288 by id —
  DRIVE_PASS_RETENTION) is present with identical fields, and any
  absent tuple is exclusively from beyond the retention bound, in
  id order (legitimate pruning). Any other absence or field change
  = migration-induced loss, a trial defect. Plus: migration marker
  durable (watermark = pre-migration max id), new rows well-formed
  extended, derivation clean over staging's initialized repair
  surface, recordingFailures 0.
- **V5 WAIT-hold round trip:** as before (set via the activation
  route with authorizationRef + reason; status projection shows the
  hold; E-held ticks all skip on the hold; clear; resumption).
- **V6 intervention:** opportunistic only; never manufactured; not
  required.
- **V7 guard contention (two outcome classes):** (a) contention
  OBSERVED (a tick and a native pass overlapping per the guard
  record) and safely resolved (exactly one drive, the other
  skipped/waited, no error) — full pass; or (b) NO contention
  observed — recorded as a limitation, not a pass and not a failure.
  **Early closure requires V7 in class (a), or class (b) explicitly
  accepted as a limitation in the trial report presented to Julie.**

## 5. Usage envelope (A1 — numerical)

Free allowances (account, daily, UTC reset): Workers requests
100,000/day; Durable Objects requests 100,000/day; DO rows written
100,000/day. (Storage is not a trial resource: the trial writes
nothing to R2/KV/D1; context only — R2 stands at ≈ 9.48 GB of the
10 GB free tier per the last full pagination, which is precisely
why no trial act touches storage.)

- **Expected opportunities:** 336 ticks (7 days × 48) + propagation
  epoch ticks (≤ 48 before activation if the trigger is created a
  day early — the plan creates it at activation time, so nominal
  total stays 336 + cleanup-epoch ticks ≤ 4).
- **Trial-attributable hard caps (window totals):** scheduled
  handler invocations ≤ 400 (336 + 10% duplicate allowance +
  cleanup); coordinator (DO) requests ≤ 25,000 (≈ 3,600/day —
  ticks, native staging passes at the ~10-minute watchdog cadence
  (≤ 1,100 over the window), observation reads, interventions);
  DO rows written ≤ 10,000 (tick log/state/event ≤ 3 per tick,
  1 per native pass, prune-bounded); Worker invocations total
  ≤ 1,500 (ticks + client/operator reads).
- **Production reserve:** production's standing operations have
  first claim. Trial consumption must not push any account daily
  total above **50%** of its free allowance; production's own daily
  usage is read at the execution census and at each daily
  observation, and the trial's caps above sit far below the reserve
  line in every projected case.
- **Metering and delay:** primary metering is the scheduler's own
  durable counters (receipts, watermark, log counts) — no reporting
  delay. Account analytics are corroboration only, with a tolerated
  lag of 24 hours; stop thresholds are set on the durable counters
  (conservative by construction), never on the lagging analytics.
- **Stop thresholds:** any cap in this section reached → §7 matrix
  (envelope breach). **If durable metering becomes unavailable**
  (status/diagnostics unreadable for two consecutive observations),
  the trial SUSPENDS: no new acts, the trial clock stops, Julie is
  informed within one observation cycle; the trigger is NOT deleted
  under suspension (a stop condition does not authorize a
  compensating mutation), and resumption requires restored metering
  or Julie's express direction. Non-delivery of the weekly free-tier
  check does not by itself suspend the trial, since primary metering
  is durable and local.
- **Rollover:** caps are stated per UTC day AND per window; the
  stricter binds. The application's own PT-day quota is untouched
  by the trial (halt; no submissions).

## 6. Acts — dependencies and landing proofs (A5)

| Act | Prerequisite | Landing proof (independent read-back) |
|---|---|---|
| S-A1 staging operator-token binding | Execution GO; §3 client baseline captured | Settings GET shows the binding present (name/type); an operator read (diagnostics) succeeds with it |
| S-A2 variant upload (1 attempt; attempt counts) | S-A1 landed; §3 operator baseline captured; variant diff proof filed (§1.2) | Deployments list + ETag change + /health build = package pin + scope staging-smoke + generation halted; binding inventory re-verified (§2) |
| S-A3 trigger create | S-A2 landed | Schedules GET shows exactly the one `*/30` trigger on the staging worker; production schedules still [] |
| S-A4 activation (route write, authorizationRef + reason) | S-A3 landed; propagation epoch open | Scheduler status: state active, epoch 1, activated_at set, authorizationRef recorded. **A failed/ambiguous response is NOT evidence of activation** — state is taken only from the status read; an ambiguous outcome leaves the trial un-activated until a status read establishes the truth |
| S-A5 hold set | S-A4 landed | Status projection: waitHold active with the recorded ref BEFORE the next tick boundary; E-held opens at that read |
| S-A6 hold clear | V5 evidence complete | Status projection: waitHold inactive; E-active-2 opens |
| S-A7 deactivation | Window criteria met, or a §7 matrix row invokes it | Status: state inactive, deactivated_at set, disposition recorded |
| S-A8 trigger delete | S-A7 landed | Schedules GET: [] on staging; production [] re-verified |
| S-A9 restore upload (1 attempt) OR leave-dormant | S-A8 landed; §7 compatibility (below) | /health build = `2fe71b5f…` (restore) or the variant's pin (leave-dormant), per Julie's decision; post-restore diagnostics read succeeds |
| S-A10 token removal | ALL reads requiring the token complete, incl. the trial report's evidence export | Settings GET shows the binding absent |

No automatic retries; no act beyond this inventory; every ambiguous
write resolves by read-back before any dependent act proceeds.

**Restoration compatibility (A5) — established from source:** the
A-3 recorder migration is additive-only: `_ensureA3Schema()` adds
seven columns to `d6_drive_passes` (entry_kind, seq, admitted_at,
exit_armed, assurance_fired [NOT NULL DEFAULT 0], assurance_outcome,
assurance_armed_after — entry :2390–2410, duplicate-column tolerant)
and creates new tables; nothing is dropped, renamed, or retyped.
The pre-A-3 build's pass INSERT names its nine columns explicitly
(pre-a3 entry :2005), so it executes unchanged against the migrated
table, its rows landing in legacy shape (NULL kind/seq). The old
build never touches the scheduler/recorder-meta tables (inert), and
its count-based prune (288) is shape-agnostic. **S-A9 restoration is
therefore mechanically executable after migration**, with two
recorded caveats: post-restore legacy rows in a migrated staging
database are evidentiarily legacy (if A-3 were ever redeployed on
staging, derivations over windows containing them fail closed —
safe direction, staging-only, no intents exist); and post-restore
verification (health + diagnostics + one naturally recorded native
pass in legacy shape) is part of S-A9's landing proof. If execution
prep contradicts any premise here, S-A9 is not executable and the
leave-dormant branch (Julie's explicit authorization, verified
deactivation + trigger removal) is the cleanup default.

## 7. Cleanup decision matrix (A5)

| Situation | Disposition |
|---|---|
| Normal completion | S-A7 → S-A8 → S-A9 (or leave-dormant) → S-A10, in order, each on its landing proof |
| Classification or guard failure (V3/V7 breach) | Stop admitting evidence; S-A7 at the next reachable moment; then the normal chain; the failure is reported to Julie the same observation cycle; no resumption without her direction |
| Usage-envelope breach (§5 cap) | S-A7 + S-A8 immediately (these are trial-internal acts, not production mutations); report; S-A9/S-A10 follow normally |
| Unreachable coordinator / account-wide 1101-class fault | **WAIT law governs:** all acts pause, including cleanup; the trial clock suspends (§5); the trigger remains (its ticks under halt can do no generation harm, and deleting it is a mutation WAIT forbids while the fault signature persists); on clearance, resume the matrix row that was interrupted, on Julie's notification |
| Ambiguous mutation (any act) | Resolve by read-back only; no dependent act until the truth is established; if the truth cannot be established, treat as the failure row for that act and report |
| Failed or ambiguous restoration (S-A9) | The variant remains deployed; verify its scheduler is inactive and the trigger is gone (S-A7/S-A8 proofs stand independently); report to Julie; a second restore attempt requires her fresh authorization — it is not in this inventory |

## 8. Supervision (A6)

- **Observer:** Wren, via a dedicated trial-watch cron created
  under the execution GO (owner: this case), plus attended checks
  at every act.
- **Cadence:** one observation every **6 hours** (the maximum
  unattended interval), each exporting: scheduler status (state,
  epoch, watermark, guard, hold), the full recent log/event arrays,
  diagnostics drive=1, the §4.0 epoch counters as durable totals,
  the §5 durable usage counters, and a production spot-check
  (/health build, Chapter 6 plan totals, quota ledgerSeq — any
  change is classified against independently explained production
  activity under the standing release, and an unexplained change is
  a stop-and-report event).
- **Retention sufficiency:** the scheduler log retains 288 rows
  (SCHEDULER_LOG_RETENTION) ≈ 6 days of ticks at cadence — longer
  than the 6-hour export interval by two orders of magnitude, so no
  row can scroll off unexported; exports append to the trial log in
  the case workspace, and the watermark + counters make any gap
  detectable arithmetically.
- **Interrupted observation:** a missed or failed observation is
  itself logged; the next successful one reconciles from the
  durable counters and declares any unobservable interval in the
  trial report; two consecutive failures invoke §5's metering
  suspension.
- **Hard expiry:** the trial authorization ends 7 days after S-A4
  (plus any WAIT-suspended time, which extends the CLOCK but never
  the act inventory). At expiry with criteria unmet, the cleanup
  chain runs as the matrix directs; **any extension requires
  Julie's express authorization** — silence never extends it.

## 9. Evidence for the activation proposal
Unchanged from the original §6 (delivery statistics per §4.0,
correlated classification samples, migration evidence, hold
transcript, any intervention in full, §5 measurements +
extrapolation, the complete act log with landing proofs, the
deviations register) — plus the V7 outcome class and any §7 matrix
rows invoked.

## 10. The WAIT-hold installation contingency (E8 — carried forward)
Unchanged from the original §7, verbatim in substance: a failed or
ambiguous WAIT-hold write does not establish an active hold; the
activation proposal must state the operational rule for the
unverifiable interval. The staging round trip (V5) proves mechanics
on a reachable coordinator only and does not narrow it.

## 11. Authorization requested
None by this package. After Rowan's review of this amendment,
Julie's execution GO for §6's acts inside one trial window under
§§5–8. Production activation remains a further separate gate.

Turn: Rowan's (amendment review).
