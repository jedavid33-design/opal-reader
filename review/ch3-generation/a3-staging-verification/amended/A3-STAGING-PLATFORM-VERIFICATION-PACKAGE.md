# A-3 STAGING / PLATFORM VERIFICATION PACKAGE

Case #10 / P8 (issue #15). Prepared by Wren, 2026-11-16, under Julie's
preparation GO (board 6926457271) and §D of Rowan's dormant-deployment
execution ruling (DOCUMENTARY EXECUTION PASS; verbatim board
6926432176). Handoff: RT-H-20261116-e87bf5
Review pin: PIN-SLOT (repo `jedavid33-design/opal-reader`, branch `ui1-review`;
the Dropbox copy carries the filled pin — the only difference between copies).

**What this package is:** the documentary plan for the separately
gated staging/platform verification step that must precede any A-3
activation proposal. It authorizes nothing. Execution requires its
own GO from Julie after Rowan's review of this package.

## 1. Identities

- **Source candidate:** the accepted A-3 implementation, pin
  `7f8b98d4a82f2fb41a88caf0e7a03be5e9a0148b` — now also the live
  production build (dormant deployment executed 2026-11-16,
  deployment `48d8fd7d…`, ETag `00bc4f90…`).
- **Staging worker:** `opalreader-api-v2`, current build
  `2fe71b5f3194f0c022a5959f1206c57e7a3240f2`, ETag
  `61553a072a162db80c606f9f3c03aea1c1344d57b0fefe11675acd470d200e81`
  (888,430 bytes), scope `staging-smoke`, generation **halted**
  (verified by reads, 2026-11-16).
- **Staging variant (to be prepared offline under the execution
  gate):** the accepted candidate tree with exactly three deltas,
  each mechanically verified by diff and filed with the trial
  evidence:
  1. **Build identity:** BUILD_COMMIT stamped to THIS package's
     review pin as accepted (a distinguishable identity for the
     staging deployment, per the E2 principle — never the production
     deployment's identity, never the rollback candidate's).
  2. **Coordinator class name:** the staging Durable Object binding
     names class `OpalReaderCoordinator`; the candidate entry exports
     `OpalReaderCoordinatorProd`. The variant renames the class and
     its in-tree references mechanically — identifier occurrences
     only, no logic change — verified by a diff showing no other
     delta.
  3. Nothing else. GENERATION_HALT is NOT a tree property: it comes
     from the staging settings (`"1"`) and remains `"1"` throughout
     the trial.
- **Rollback candidate:** unchanged, pin `7f8b98d4…` (`rollback-tree/`),
  production-only; not used on staging. Staging's own restore target
  is its current build `2fe71b5f…`, whose tree is already of record in
  the review lineage (the pre-A-1 composed candidate).

## 2. Isolation from production

Verified from the staging settings GET (2026-11-16):

- **Durable Object:** staging COORDINATOR namespace
  `40873aba35a24de0a79f7bad03b9077d`, class `OpalReaderCoordinator` —
  a different namespace from production (`005ba6f8…`). All scheduler,
  recorder, and generation state in the trial lives in the staging
  object. No code path in the candidate crosses namespaces.
- **Credentials:** staging binds NO `GEMINI_API_KEY` (the standing
  B-3 finding, re-verified) and no migration-operator token. Its only
  secret is its own `OPALREADER_ACCESS_TOKEN`. **No provider call is
  possible from staging, at any halt state.**
- **Halt:** staging GENERATION_HALT is `"1"` and stays `"1"` for the
  whole trial; the grant-send path is therefore never wired, and the
  scheduler's LIVE-only admission scope (accepted in the corrections
  round) independently refuses scheduled admission while halted —
  the trial exercises delivery, classification, guard, hold, and
  migration behavior, NOT staging generation.
- **Queue:** staging's queue binding names `opalreader-generation`
  (the paused v1 queue). With the send path unwired under halt, the
  trial sends nothing to it; queue state is read at trial start and
  end to prove it.
- **Storage:** staging shares the R2 bucket `opalreader-storage`
  under the key prefix `smoke-p8/` (binding R2_KEY_PREFIX). Trial
  activity writes no R2 objects (no generation); the prefix boundary
  is stated for completeness, and the trial's read set does not touch
  production keys.
- **Account-shared surfaces:** Cron Triggers, Workers/DO usage, and
  the free-tier allowances are account-level. The trial's trigger is
  attached to the STAGING worker only (production's trigger set
  remains empty — read at trial start, during, and at end), and its
  usage is measured and reported (§5), not assumed negligible.

## 3. Objectives and acceptance criteria

The offline record cannot prove platform behavior (I8; R7's staging
obligations). The trial measures, on staging only:

- **V1 — Cron delivery.** One Cron Trigger (`*/30 * * * *`) on the
  staging worker. Measure: configuration propagation time (creation
  → first delivered tick); delivered tick count vs expected over the
  window; inter-arrival distribution against the 30-minute cadence.
  *Acceptance:* ≥ 96 consecutive ticks logged by the scheduler's own
  event stream with no unexplained gap > 2 cadence periods; every
  delivered tick accounted for as admitted or skipped-with-reason.
- **V2 — Duplicate suppression / retry posture.** Each platform
  delivery produces exactly one tick log row; any duplicate delivery
  must surface as a `duplicate_or_stale_tick` skip, never a second
  admission. *Acceptance:* admissions ≤ deliveries, duplicates (if
  any) all classified as skips. (This is the observable shadow of the
  `retry: { maxRetries: 0 }` posture; the package claims no more
  than the observation supports.)
- **V3 — Classification against a live native chain.** Staging's
  coordinator is armed and its watchdog cycles natively. Ticks
  during healthy native activity must classify HEALTHY_NATIVE_ACTIVE
  or HEALTHY_IDLE (timely armed watchdog), never INTERVENE.
  *Acceptance:* zero interventions while the staging chain is
  verifiably healthy; every classification sampled against the
  diagnostics read of the same moment.
- **V4 — Recorder migration (staging).** The first native pass on the
  variant build migrates staging's recorder. *Acceptance:* migration
  marker durable; all pre-migration rows preserved; new rows
  well-formed extended evidence; derivation (staging's repair
  surface, initialized by the A-3 build) reads clean with zero
  intents; recordingFailures stays 0. This is the first real-platform
  migration evidence; production migration remains NOT YET OBSERVED
  until a production native pass occurs naturally.
- **V5 — WAIT-hold round trip.** With the scheduler active on
  staging: set the WAIT hold through the activation route
  (authorizationRef + reason), observe ticks skipping on the hold and
  the status projection showing it; clear it the same way; observe
  normal classification resuming. *Acceptance:* hold visible in the
  status projection before the next tick boundary; no admission
  while held; clean resumption. This rehearses the hold mechanics —
  it does NOT discharge the E8 contingency (§7).
- **V6 — Intervention (opportunistic, not required).** If the staging
  chain genuinely stalls during the window (registration lost or
  stale beyond thresholds with overdue work), the tick's
  intervention, fallback pass, and alarm-restoration preference are
  observed end-to-end. The trial does not manufacture a stall, and
  absence of a stall is not a trial failure; the required criteria
  are V1–V5 + §5.
- **V7 — Guard behavior.** During the window, native passes and ticks
  interleave on one object. *Acceptance:* no double drive (guard
  contention resolves as skips/waits per the accepted design), no
  pass recorded with an error attributable to contention.

**Trial window:** 7 days from activation on staging, with early
closure permitted once V1's 96-tick threshold and V3–V5 are all
satisfied and the §5 measurements are complete (minimum 48 hours).

## 4. Act inventory (for the future execution gate — none authorized now)

Counted acts, each separately logged with read-back:
- **S-A1** — Add a staging-only migration-operator token binding to
  the staging worker (settings PATCH), unlocking the operator read
  surfaces (diagnostics, scheduler status, repair status) on staging.
  The secret value is generated and stored only in the staging
  binding; it never touches production.
- **S-A2** — Upload the staging variant (one attempt; same
  ambiguity-consumption rule as production deployments: the attempt
  counts, landing is proven by read-back).
- **S-A3** — Create the staging Cron Trigger (one).
- **S-A4** — Activate the staging scheduler via the activation route
  (authorizationRef + reason), recording the activation epoch.
- **S-A5 / S-A6** — Set, then clear, the staging WAIT hold (V5).
- **S-A7** — Deactivate the staging scheduler.
- **S-A8** — Delete the staging Cron Trigger; verify schedules [].
- **S-A9** — Cleanup upload restoring staging's prior build
  `2fe71b5f…` (one attempt), OR Julie's explicit decision to leave
  the variant deployed dormant on staging.
- **S-A10** — Remove the staging operator-token binding (unless Julie
  directs retention for future staging work).
Read-only observation (status, diagnostics, health, production
spot-check censuses at start/end) is uncounted.

**Stop conditions:** any indication of production impact (production
census at trial start/end must be identical apart from independently
explained native activity under the standing release); any provider
contact possibility (structurally impossible — §2 — so any contrary
indication stops the trial and is treated as a defect); an
account-wide 1101-class fault signature (WAIT law: pause the trial
clock, no compensating acts); usage beyond §5's envelope; any
classification of INTERVENE on a verifiably healthy staging chain
(V3 breach) — deactivate (S-A7) and report before continuing.

## 5. Measurement

- Tick-path usage on staging over the window: Worker invocations,
  DO requests, and DO rows written attributable to scheduled() +
  tick + fallback passes, from the scheduler status surface's
  counters and the account analytics filtered to the staging worker.
- Extrapolation to production at the accepted cadence, stated as an
  estimate with its basis: expected daily tick count (48), per-tick
  read/write profile in the healthy case (the common case) vs the
  intervention case.
- Free-tier position: the account's current headroom from the weekly
  free-tier check, with the trial's measured consumption and the
  projected production consumption both stated against it. The
  design's cost-isolation caveat stands: account usage is shared
  with native operations and reported as such.

## 6. Evidence the trial must produce (input to the activation proposal)

1. Delivery statistics (V1) and duplicate accounting (V2).
2. Classification samples with contemporaneous diagnostics (V3),
   and the guard-contention record (V7).
3. Migration evidence (V4): pre/post recorder reads, the migration
   marker, derivation output.
4. The WAIT-hold round-trip transcript (V5).
5. Any intervention, in full, if one occurred (V6).
6. The §5 usage measurements and production extrapolation.
7. The complete act log with read-backs, and the cleanup proof
   (schedules [], deactivation read, restore/leave decision).
8. A deviations register: every stop condition approached or hit,
   every unexpected classification, at true strength.

## 7. The WAIT-hold installation contingency (E8 — carried forward)

This package preserves, and the activation proposal MUST contain, the
standing contingency: **a failed or ambiguous WAIT-hold write does
not establish an active hold.** On production, if the coordinator is
unreachable (the very condition the hold exists for), setting the
hold may be impossible until reachability returns; the interval
before a hold can be installed and verified is an explicit
operational rule the activation proposal must state (including what
the scheduler does in that interval under each classification, and
the operator's verification duty on restoration of reachability).
The staging round trip (V5) proves the mechanics on a reachable
coordinator only; it does not narrow this contingency.

## 8. Authorization requested

None by this package. After Rowan's review, Julie's execution GO for
§4's acts S-A1–S-A10 inside one trial window, under §4's stop
conditions. Production activation remains a further, separate gate
requiring its own proposal (§6 evidence + §7 contingency + measured
usage) and Julie's GO.

Turn: Rowan's (package review).
