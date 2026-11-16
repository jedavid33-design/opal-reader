// Opal Reader v2 — PRODUCTION D6 worker entry (repo-only build;
// proposal §6.2 + CONTRACTS.md "Entry + config (WS-1)").
//
// This is the D6 successor of v2/worker-entry-prod.js: the same
// production surface (scope "production", instance "account",
// unprefixed R2 namespace enforced fail-closed, Option D operator
// fences, GENERATION_HALT still "1" in the deploy spec) PLUS the
// generation shape D6 adds:
//
//   * hostEnv adds `d6StandardOnly: true` (arming the two gated
//     coordinator patches: the lane allowlist on SubmitJob and the
//     plan guard in _issueGrant) and wires `sendGrant` to the new
//     v2-dedicated queue (binding OPALREADER_GENERATION_V2, queue
//     opalreader-generation-v2) — ONLY when GENERATION_HALT === "0".
//     The v1 queue (opalreader-generation, frozen v1 consumer,
//     delivery paused) is never produced to, consumed, or resumed.
//   * The coordinator is exported under the EXISTING production
//     class name, OpalReaderCoordinatorProd — the same class the
//     live production script binds as COORDINATOR, in the same
//     Durable Object namespace, over the same account instance and
//     its persisted SQLite state (CORRECTION, Rowan source-review
//     block 6501450683: a newly named class/namespace would NOT
//     inherit that state, and an empty coordinator is not an
//     upgrade). D6 behavior arrives through overrides ON THAT
//     CLASS (internal D6 routes POST /internal/d6/intent and
//     GET /internal/d6/plan, a D6 _execute built on
//     createD6Executor, and an alarm that runs the coordinator
//     alarm, then the generation service's recover() + driveOnce()
//     — server-owned continuation, §6.5), through the flag-gated
//     coordinator patches, and through the generation modules.
//     The generation schema bootstraps IN PLACE inside the
//     existing instance's SQLite at class construction
//     (ensureGenSchema: CREATE TABLE IF NOT EXISTS only — no
//     pre-existing table is created, altered, or dropped, and the
//     bootstrap never reads through `.one()`, so it is throw-safe
//     against real DO SQLite semantics). The deploy spec binds
//     COORDINATOR to OpalReaderCoordinatorProd and applies NO new
//     Durable Object class and NO new-class migration.
//   * The public fetch forwards generation intents: a SubmitJob
//     command whose payload carries data.d6Intent goes to
//     /internal/d6/intent instead of /v2/commands, and
//     GET /v2/d6-plans/<id> is served from /internal/d6/plan.
//   * CORRECTION 2 adds the storage-seed route (arming sub-step 0
//     found genstore.setStorageBaseBytes unreachable in production):
//     POST /v2/d6-seed-storage forwards — behind the same production
//     gate (scope + client token + instance) as every other public
//     route — to POST /internal/d6/seed-storage, where the service
//     refuses unless GENERATION_HALT is still "1" (seeding is a
//     pre-arming act only) and records the fresh recount with
//     provenance. The route was chosen over a command type
//     deliberately: it lives entirely in D6-owned files (the
//     coordinator's pinned two-hunk diff is untouched) and behind
//     the identical fence chain as the other D6 routes.
//   * G2 HARDENING (ENRICHMENT-DESIGN §3.2; Rowan review
//     6504846855): the seed route ADDITIONALLY requires the
//     migration-operator credential — the client gate still runs in
//     full (the client token is necessary but NOT sufficient), the
//     operator admission block below stamps admission on the
//     forward, and the DO class gate for the internal seed route
//     requires that stamp, so the route cannot be reached on the
//     internal header alone and the stamp cannot be forged through
//     public routing (the entry overwrites it unconditionally).
//     The invocation is FIGURELESS (any caller-supplied figures are
//     refused by the service) and the worker recounts the bucket
//     itself through its R2 binding, cross-checked at zero
//     tolerance against RECORDED_STORAGE_BASE before any write.
//   * gen-pkg-1 adds three read-only generation surfaces behind
//     the same gate chain (GET /v2/d6-plans list, GET
//     /v2/generation/capabilities, GET /v2/d6-eligibility), served
//     from internal D6 routes on the class, plus the server-side
//     binding projection that publishes committed audio to the
//     sync plane (generation/binding-projection.mjs, driven from
//     the executor's commit sites and the alarm's driveOnce sweep).
//   * gen-pkg-1 ROUND 3 (Rowan round-3 review 6512804398) adds:
//     (a) phase-policy ENFORCEMENT — d6Service derives
//     phasePolicyMode "enforce" from the deployment configuration
//     (OPALREADER_PHASE_POLICY, set to "enforce" by the pinned
//     deploy spec), so this entry's admission applies the
//     phase→book registry rules from the first served request and
//     a budgeted-phase claim with no recorded binding fails
//     CLOSED (phase_unbound) — no legacy window between deploy
//     and binding recording. ROUND 5 (R4-2, Rowan ruling
//     6514899384; Julie's approval 6522602149) hardens this
//     further: d6Service now constructs enforcement
//     UNCONDITIONALLY, the intent route returns an explicit
//     503 phase_policy_not_configured whenever the deployment
//     var is not exactly "enforce", and while the registry is
//     empty the service's bootstrap gate refuses EVERY intent
//     (phase_binding_required — null-phase included) until the
//     operator records the binding; and (b) two OPERATOR-ONLY POST
//     surfaces in the diagnostics fence class (admitted on the
//     migration-operator credential alone — the production gate
//     skips the client token for them — with the entry's
//     operator-admitted stamp required again at the class gate):
//     POST /v2/d6-phase-binding (record the phase→book binding,
//     idempotent, with read-back; the deploy gate's recording
//     path for forever-pucked ↔ the Forever Pucked book) and
//     POST /v2/d6-retire-halted-plan (the R3-2 clearance: retire
//     a halted_unknown plan after its unknown attempts are
//     reconciled). Neither surface is reachable on the client
//     token, and neither has been exercised against production —
//     each USE is a separate Julie authorization.
//   * gen-pkg-1 D7-2 (Rowan ruling 6524426826; Julie's approval
//     6524562842) adds the BIRTH-MARK + GRANT-QUARANTINE:
//     d6Service constructs quarantineMode "enforce"
//     UNCONDITIONALLY, so a plan submitted while GENERATION_HALT
//     is not exactly "0" is birth-marked atomically with its plan
//     insert (generation/quarantine.mjs — an additive, lazily
//     ensured table, never part of the pinned bootstrap set);
//     the grant guard refuses held subjects absolutely (and, via
//     d6HostEnv's d6HaltFence, refuses + marks plan-less jobs
//     attempting grants while halted); driveOnce skips held
//     plans; the D6 executor refuses held jobs pre-claim. The
//     ONLY clearance is the operator-only POST
//     /v2/d6-release-quarantine (same fence class as the
//     phase-binding / retirement routes), per subject,
//     idempotent, audited on the hold row itself, with read-back.
//     Admission while halted is unchanged (C3's contract);
//     SPEND AUTHORITY is what is fenced. No deploy, binding,
//     publication, or re-arm path releases a hold, and each
//     production release remains a separate Julie approval.
//   * gen-pkg-1 D8 (Rowan review of the D7-2 build, comment
//     6525035570) corrects two grant-safety blockers in the
//     quarantine build. D8-1: every hold read at a spending /
//     execute fence is now STRICT (generation/quarantine.mjs) —
//     a SQL fault throws and refuses before any grant, ledger,
//     outbox, or provider effect; the catch-all "error means no
//     hold" read survives only on read-only views, and there only
//     for a genuinely absent table. D8-2: (i) the admission fence
//     — public + class level — now refuses EVERY generation-
//     producing legacy command while halted: plain SubmitJob
//     (WITHOUT data.d6Intent) and RequestRepair join
//     RequestSynthesis / RequestResume at 423 generation_halted,
//     because a plan-less job staged while halted carried no
//     birth mark and a generic re-arm could make it spendable;
//     the D6 intent shape (SubmitJob + data.d6Intent) is still
//     admitted and birth-marked, exactly as C3 contracts, and
//     reads/sync/settings commands are untouched; (ii) the
//     production class stamps the D6 guard flags (d6StandardOnly,
//     d6HaltFence) onto its own env after construction, so every
//     coordinator the class builds for its post-construction
//     operations — the /v2/commands API dispatch and, critically,
//     the BASE alarm's schedule processing (super.alarm() runs a
//     coordinator built from this env) — runs the D6 grant guard:
//     no base-machinery path (watchdog retry_grant, repair
//     chains, command handlers) can issue a grant the guard never
//     sees. The constructor's own coordinator (this.coordinator)
//     deliberately keeps the plain construction env — it is a
//     schema/settings handle no production grant path uses, and
//     the baseline suites pin its plain behavior; and (iii) the
//     grant guard additionally fences, via the halt-epoch ledger
//     (generation/quarantine.mjs), plan-less jobs born inside a
//     recorded halt epoch — the durable answer for rows staged
//     in the store despite the admission fence, whose halt-era
//     grant attempts may have been refused before the guard
//     (quota park / daily quota / monthly cap) ever ran.
//   * CH2 FIX PACKAGE (Julie's Oct 30, 2026 Chapter 2 program
//     authorization) fix 2 adds the missing invocation path for
//     the pre-existing unknown-billing reconciliation
//     (genstore.reconcileUnknown): the OPERATOR-ONLY POST
//     /v2/d6-reconcile-unknown, in the same fence class as the
//     phase-binding / retirement / release routes (production
//     gate skips the client token; admission on the
//     migration-operator credential alone; the operator-admitted
//     stamp required again at the class gate). The settlement
//     terms are explicit and validated (attemptId required;
//     knownCostMicro present and either a finite number >= 0 or
//     exactly null — a proven no-charge; outcome REQUIRED, one
//     of the settlement outcomes "success" / "failed_known" /
//     "no_charge", with the (cost, outcome) pair consistent —
//     B2: null never settles as "success"; planId REQUIRED and
//     verified against the attempt's plan), the store refuses any attempt
//     that is not confirmed/unknown and moves nothing on a
//     refusal, and an audit row is written in the settlement
//     transaction (genstore d6_reconcile_audit). The route is
//     safe in BOTH halt states by construction: it settles a
//     cost record and at most clears the phase's
//     unknown-billing flag — it creates no plan, grant, or
//     execution, and a halted_unknown plan stays halted (driver
//     selection excludes it, R4-1) until the separate
//     retireHaltedPlan clearance. Its USE against any
//     production attempt remains Julie's separate
//     authorization.
//   * CH2 DISPOSITION PACKAGE (UNCERTAINTY-DISPOSITION-DESIGN
//     Rev 2; Rowan DESIGN PASS 6535393656; Julie's build
//     approval 6535417583) adds the uncertainty disposition:
//     the OPERATOR-ONLY POST /v2/d6-adjudicate-estimated, in the
//     same fence class as the reconcile / retirement / release
//     routes (production gate skips the client token; admission
//     on the migration-operator credential alone; the
//     operator-admitted stamp required again at the class
//     gate). It disposes ONE confirmed/unknown attempt as
//     estimated_unverified: the request schema is a CLOSED
//     allowlist ({ attemptId, planId, authorizationRef, note })
//     — a caller-supplied figure key refuses the whole request
//     (adjudication_figure_caller_supplied), as does any other
//     non-allowlisted key (adjudication_request_key_not_allowed)
//     — because both money figures are derived server-side from
//     persisted records (the attempt's own-length
//     expectedCostMicro; the attempt row's recorded upper as the
//     budget reservation), the attempt's cost_micro_cents stays
//     NULL, and the provenance lands in the d6_billing_
//     adjudications audit row with the call's authorizationRef
//     recorded. The disposition creates no plan, grant,
//     execution, or queue message, never touches
//     d6_execution_records, and the plan stays halted_unknown
//     until the separately gated retirement; it is safe in BOTH
//     halt states by the same construction as reconcile. The
//     amendment OPERATION and route (§8) do NOT ship in this
//     build — schema only. Its USE against any production
//     attempt remains Julie's separate authorization, recorded
//     as the call's authorizationRef.
//   * QUOTA ROUTES PACKAGE (QUOTA-ADDENDUM §3 + DP1; Rowan
//     operational review 6546037460 — Option 1 ACCEPTED at
//     design level, Option 3 sequencing; Julie's repo-only
//     build approval 6546054510) adds the three OPERATOR-ONLY
//     quota invocation surfaces, in the same fence class as
//     the phase-binding / retirement / release / reconcile /
//     adjudicate surfaces above (production gate skips the
//     client token; admission on the migration-operator
//     credential alone; the operator-admitted stamp required
//     again at the class gate): POST /v2/d6-quota-bootstrap
//     (the one-time bootstrapQuota — HALT-ONLY and FIGURELESS:
//     the internal handler refuses unless GENERATION_HALT is
//     exactly "1", and the request body may carry no keys at
//     all), POST /v2/d6-quota-dispose-exception (ONE bootstrap
//     exception's disposition under a CLOSED allowlist
//     { attemptId, dayKey, authorizationRef, source, note };
//     HALT-ONLY like the bootstrap; the store re-validates
//     everything, and the Hold-B law lives in the store — a
//     multi-day interval refuses
//     quota_disposition_ambiguous_interval and no route input
//     can override it), and GET /v2/d6-quota-reconcile
//     (reconcileQuota — SELECT-only by construction; the
//     handler returns a BOUNDED report: the identity-bearing
//     detail arrays are capped with exact counts and explicit
//     truncation flags, never silently cut). Before this
//     package the three store functions had NO caller
//     anywhere (deployment proposal §4): these routes are the
//     invocation mechanism, and they are the ONLY one.
//     Exercising any of them against production is gate (b)
//     of the revised deployment plan — a separate Julie
//     authorization per act (and per disposition) — nothing
//     here performs it.
//   * A queue handler consumes the v2 queue into /internal/execute.
//     GENERATION_HALT still gates queue + execute via
//     assertGenerationEnabled, independently at each layer.
//
// This module authorizes nothing by existing: deployment, the
// provider secret (GEMINI_API_KEY, set by Julie herself by name
// only — §6.3), and arming are each separate gates. The deploy spec
// (p8/deploy-spec-prod-d6.json) keeps GENERATION_HALT at "1".
import {
  GenerationHaltedError, json, corsHeaders,
} from "./worker-entry.js";
import {
  OpalReaderCoordinatorProd as ProductionCoordinatorBase,
  PRODUCTION_SCOPE, PRODUCTION_INSTANCE,
} from "./worker-entry-prod.js";
import {
  GenerationCoordinator, readContainmentState,
  containmentDriveSuppressed,
} from "./coordinator.mjs";
import { BUILD_VERSION, BUILD_COMMIT } from "./host/build-identity.mjs";
import { handleAudioRequest, isAudioPath, AUDIO_EXPOSE_HEADERS } from "./audio-route.mjs";
import {
  assertGenerationEnabled, createProviderAdapters,
} from "./host/adapters.mjs";
import { createGenStore } from "./generation/genstore.mjs";
import { createGenerationService } from "./generation/service.mjs";
import { createD6Executor } from "./generation/d6-executor.mjs";
import { createFlushStore } from "./generation/flush-store.mjs";
import { createD6WorkSource } from "./generation/d6-work-source.mjs";
import { QUEUE_BINDING, RECORDED_STORAGE_BASE } from "./generation/gen-constants.mjs";
import { ensureGenSchema } from "./generation/gen-schema.mjs";
import { createCoordinatorPlaneSource } from "./generation/content-plane-adapter.mjs";
import {
  bootstrapQuota, disposeBootstrapException, reconcileQuota,
  PROVIDER_ATTEMPT_DAILY_LIMIT,
} from "./generation/quota-budget.mjs";
import {
  releasePark, revokeParkRelease, exemptChapterOccurrence,
  revokeChapterExemption,
} from "./generation/park-release.mjs";
import {
  previewGrantFinalization, finalizeGrant,
} from "./generation/grant-finalizer.mjs";

const INTERNAL_HEADER = "x-opalreader-internal";
const TOKEN_ERROR_BODY = { error: "The personal access token is missing or incorrect." };

// D7-2 + D8-2 ADMISSION FENCE predicate, shared by the public
// fetch and the coordinator class (which carries the same
// refusal as a bypass backup): the command types that PRODUCE
// generation work — a job and/or an immediate grant — and so are
// refused while GENERATION_HALT !== "0". D7-2 refused
// RequestSynthesis (job + immediate grant) and RequestResume
// (paused_quota grant probe). D8-2 (Rowan review 6525035570)
// adds the two staging shapes the D7-2 build still admitted:
// plain SubmitJob — a plan-less job with NO birth mark, whose
// first grant attempt might happen only after a generic re-arm
// (or be refused before the guard by the park/quota/cap checks,
// leaving it unmarked) — and RequestRepair, which is the same
// staging shape under a repair kind. The D6 intent shape
// (SubmitJob carrying payload.data.d6Intent) is NOT refused: it
// routes to the intent surface, where admission is C3's contract
// and the plan is birth-marked. Every other command type —
// sync, settings, reads, migration fences — is untouched.
function isHaltRefusedCommand(peek) {
  if (!peek || typeof peek.type !== "string") return false;
  if (peek.type === "RequestSynthesis" || peek.type === "RequestResume" ||
      peek.type === "RequestRepair") return true;
  if (peek.type === "SubmitJob")
    return !(peek.payload && peek.payload.data && peek.payload.data.d6Intent);
  return false;
}

// The D6 coordinator environment for one DO operation: the staging
// hostEnv's seams (request-scoped R2 cache probe / hydration /
// migration prime / byte check) PLUS the two D6 additions —
// d6StandardOnly (always on for this entry; it arms the coordinator
// patches) and sendGrant from the v2 queue binding, wired only when
// generation is explicitly enabled. While halted there is NO queue
// delivery function: outbox rows stay visibly unsent.
function d6HostEnv(env, cache) {
  const generationEnabled = env.GENERATION_HALT === "0";
  const queue = env[QUEUE_BINDING];
  return {
    ...env,
    d6StandardOnly: true,
    // D7-2: the halt fence for plan-less jobs (grant-guards.mjs):
    // wired ONLY here, in the D6 production entry's coordinator
    // environment, so a grant attempt for a job with no D6 plan
    // while GENERATION_HALT !== "0" is refused and the job durably
    // quarantined. Direct coordinator constructions (fixtures,
    // legacy suites) never set it and keep the pre-D7-2 unguarded
    // behavior for plan-less jobs exactly.
    d6HaltFence: true,
    probe: cache ? cache.probe : undefined,
    hydrateCacheKey: cache ? (key) => cache.hydrateKey(key) : undefined,
    migrationPrime: cache ? (key) => cache.primeForMigration(key) : undefined,
    byteCheck: cache ? (key) => cache.byteCheck(key) : async () => false,
    sendGrant: generationEnabled && queue?.send
      ? async (payload) => { await queue.send(payload); }
      : undefined,
  };
}

// CH2 DISPOSITION PACKAGE (UNCERTAINTY-DISPOSITION-DESIGN Rev 2
// §7.3): the evidence reference set frozen for the disposition's
// audit row — Exhibit A (Julie's AI Studio billing screenshot,
// Oct 24–30, 2026), the corrected billing-attribution research
// pin, Rowan's ruling approving the estimated_unverified class
// for design, her design review, and her design PASS. The
// execution's own approval reference is recorded separately, in
// the row's authorization_ref (it is the call's
// authorizationRef). Stamped server-side by the route below,
// never taken from the caller's body. These are CITATIONS, not
// verification: no per-attempt charge is proven by any of them
// (design §8, clarification 3).
const ADJUDICATION_EVIDENCE_REFS = Object.freeze([
  "exhibit-a:julie-aistudio-billing-2026-10-30",
  "research-pin:06c66d45b6931b1e304b3313b7404bc20bd0d76f",
  "rowan-ruling:6534423731",
  "rowan-design-review:6534952386",
  "rowan-design-pass:6535393656",
]);

// QUOTA ROUTES PACKAGE: the bound on identity-bearing detail
// arrays in the quota operator routes' responses (DP1:
// reconcile output must be bounded and auditable). Counts are
// always exact and truncation is always flagged — a truncated
// report is itself a finding for the gate-(b) runbook, never
// a silent cut.
const QUOTA_ROUTE_DETAIL_LIMIT = 100;

// The generation service for one DO operation. sources.eligiblePlane
// is the production adapter of the coordinator content plane
// (generation/content-plane-adapter.mjs; proposal §5: the named source
// is the coordinator content plane). It fails closed with a named
// error for an unknown book rather than planning over an unverified
// set.
function d6Service(coord, env) {
  return createGenerationService({
    coord, env, store: createGenStore(coord),
    sources: createCoordinatorPlaneSource(coord),
    // G2 seed hardening: the cross-check base is pinned in code
    // (RECORDED_STORAGE_BASE), and the recount runs against the
    // worker's own R2 binding — the invocation supplies neither.
    expectedStorageBase: RECORDED_STORAGE_BASE,
    recountBucket: env.OPALREADER_STORAGE,
    // R3-1 made phase-policy enforcement a deployment property;
    // R5 / R4-2 (Rowan round-5 ruling, comment 6514899384, item
    // 1; Julie's approval, comment 6522602149) makes it
    // UNCONDITIONAL: this entry — the real production entry —
    // constructs every generation service enforcement-bound,
    // whatever the deployment var says, so no missing, omitted,
    // or mistyped OPALREADER_PHASE_POLICY value can silently
    // restore legacy admission. The var remains a required
    // deployment binding (pinned to "enforce" by the deploy
    // spec, and now gated by tools/validate-prod-envelope.mjs):
    // the intent route below refuses D6 submission with an
    // explicit 503 configuration failure whenever the var is
    // not exactly "enforce". Direct service construction in
    // fixtures keeps its explicit legacy default — that path
    // never reaches this entry.
    phasePolicyMode: "enforce",
    // D7-2 (Rowan ruling 6524426826; Julie's approval
    // 6524562842): the birth-mark quarantine, likewise
    // UNCONDITIONAL in this entry — every service this entry
    // constructs birth-marks plans submitted while halted. The
    // fence (guard/driver/executor) is data-driven and needs no
    // mode; the mode governs only the marking act, and only this
    // trusted construction enables it.
    quarantineMode: "enforce",
  });
}

// PHASE B INSTRUMENTATION (P2; design
// PHASEB-INSTRUMENTATION-DESIGN.md as approved with refinements,
// spec PHASEB-INSTRUMENTATION-SPEC.md): one durable row per
// subclass alarm pass, written by the recorder below, so a drive
// stall can be told apart from a silent alarm chain. The recorder
// is the table's ONLY writer and sanitizes at write time
// (allowlist projection + grammar-or-scrub discipline, spec
// §5.1–§5.2); the read surface (service.mjs
// drivePassDiagnostics) trusts nothing it reads back and
// re-validates every stored value before returning it (spec
// §5.5). Nothing here changes what a pass DOES: recording is
// last, best-effort, and a drive error is rethrown unchanged by
// alarm() after recording, so platform alarm-retry semantics are
// exactly the shipped ones.
const DRIVE_PASS_SCHEMA = `
CREATE TABLE IF NOT EXISTS d6_drive_passes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL,
  finished_at INTEGER,
  stage TEXT NOT NULL,
  drive_invoked INTEGER NOT NULL,
  outcomes_json TEXT,
  outcomes_truncated INTEGER NOT NULL DEFAULT 0,
  error_name TEXT,
  error_message TEXT,
  armed_after INTEGER,
  entry_kind TEXT,
  seq INTEGER,
  admitted_at INTEGER,
  exit_armed INTEGER,
  assurance_fired INTEGER NOT NULL DEFAULT 0
);
`;
// The recorder-health channel: the one record of recording ITSELF
// failing, kept in DO key-value storage under this key — a storage
// facet the SQL table does not share, so a SQL-layer fault cannot
// hide its own trace. service.mjs drivePassDiagnostics reads the
// same literal key (a cross-part contract, pinned by the spec's
// round-trip test). Shape:
// { recordingFailures, lastFailureAt, lastFailureStep,
//   lastFailureName, lastRecordedAt }.
const DRIVE_PASS_HEALTH_KEY = "d6DrivePassRecorderHealth";
// Retention is a COUNT cap (Rowan's ruling): the newest 288 rows
// are kept; at the 10-minute watchdog cadence that is an ESTIMATE
// of ~2 days, never a guaranteed duration.
const DRIVE_PASS_RETENTION = 288;

// ============================================================
// A-3 — THE SCHEDULED DRIVE ENTRY (design package pin
// b5ef92c8e53527a40d2a3f2d4bddcbf442bbd5a1; amended design pin
// d3de2def69b1a45c01ec2072015f350ecdbea9b4; addendum C1–C8 pin
// 51f0158cbed153d43f27ffadec429a8fd946115c; Rowan's DESIGN PASS
// with binding implementation conditions I1–I8, board
// 6921985393; Julie's offline implementation GO, board
// 6922008740).
//
// A Cron Trigger (platform configuration, NOT this file —
// cadence is deployment configuration, never activated by this
// code) invokes the worker's scheduled() export, which calls the
// coordinator's internal tick handler exactly once. The tick
// OBSERVES the native alarm chain; only on a verified stall
// classification (INTERVENE) does it admit ONE drive pass through
// the same _drivePass implementation the native alarm() runs,
// under the per-instance guard. The scheduler is dormant as
// shipped: no activation record exists until the separately
// gated activation step, and deployment alone changes no native
// behavior (the recorder gains columns and every native pass
// gains the exit-assurance READ; registrations on healthy
// passes are byte-for-byte the shipped ones — addendum §C2).
// ============================================================
const ENTRY_KIND_NATIVE = "native_alarm";
const ENTRY_KIND_SCHEDULED = "scheduled_fallback";
// The one cron expression this scheduler admits (addendum §C5:
// verified at admission — a misconfigured or additional trigger
// cannot become the scheduler).
const SCHEDULER_CRON_EXPRESSION = "*/30 * * * *";
// Predicate constants (amended design §7; addendum §C4). GRACE is
// the overdue threshold for the earliest pending due; SKEW bounds
// clock disagreement when comparing the registration to the
// earliest due — future-ness is never judged against now alone.
const SCHEDULER_GRACE_MS = 600000;
const SCHEDULER_SKEW_MS = 300000;
// The native chain's watchdog period (coordinator.mjs
// WATCHDOG_PERIOD_MS), restated for the predicate's
// delayed/anomalous bounds — a value the tick compares against,
// never a cadence it sets.
const SCHEDULER_WATCHDOG_MS = 600000;
// Tick-log retention mirrors the recorder's count cap.
const SCHEDULER_LOG_RETENTION = 288;
// PASS_WITHOUT_PROGRESS escalation threshold (addendum §C4):
// 48 consecutive ticks at the 30-minute cadence is ~24 hours.
const SCHEDULER_STALL_ESCALATION_TICKS = 48;

const SCHEDULER_SCHEMA = `
CREATE TABLE IF NOT EXISTS d6_scheduler_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  state TEXT NOT NULL,
  epoch INTEGER NOT NULL,
  cron_expression TEXT,
  admitted_watermark INTEGER,
  activated_at INTEGER,
  updated_at INTEGER NOT NULL,
  authorization_ref TEXT,
  reason TEXT,
  wait_hold_active INTEGER NOT NULL DEFAULT 0,
  wait_hold_declared_at INTEGER,
  wait_hold_ref TEXT,
  trigger_removed_at INTEGER,
  deactivated_at INTEGER,
  stall_ticks INTEGER NOT NULL DEFAULT 0,
  last_classification TEXT,
  last_tick_at INTEGER,
  in_flight_identity TEXT,
  disablement_disposition TEXT
);
CREATE TABLE IF NOT EXISTS d6_scheduler_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL, kind TEXT NOT NULL, detail_json TEXT
);
CREATE TABLE IF NOT EXISTS d6_scheduler_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL, finished_at INTEGER,
  cron TEXT, scheduled_time INTEGER,
  tick_identity TEXT UNIQUE,
  activation_epoch INTEGER,
  classification TEXT, action TEXT, reason TEXT,
  drive_pass_id INTEGER, pass_stage TEXT,
  error_name TEXT, error_message TEXT
);
CREATE TABLE IF NOT EXISTS d6_active_pass (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  identity TEXT NOT NULL, entry_kind TEXT NOT NULL,
  admitted_at INTEGER NOT NULL, tick_identity TEXT
);
CREATE TABLE IF NOT EXISTS d6_recorder_meta (
  key TEXT PRIMARY KEY, value INTEGER NOT NULL
);
`;
// The singleton row's initial shape (INSERT OR IGNORE at schema
// ensure): state 'inactive', epoch 0 — the dormant deployment
// state. Activation is the only writer of 'active'.
const SCHEDULER_STATE_SEED = `
INSERT OR IGNORE INTO d6_scheduler_state
  (id, state, epoch, cron_expression, admitted_watermark,
   activated_at, updated_at, authorization_ref, reason,
   wait_hold_active, wait_hold_declared_at, wait_hold_ref,
   trigger_removed_at, deactivated_at, stall_ticks,
   last_classification, last_tick_at, in_flight_identity,
   disablement_disposition)
VALUES (1, 'inactive', 0, NULL, NULL, NULL, 0, NULL, NULL, 0,
        NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, NULL)`;
const DRIVE_PASS_OUTCOMES_CAP = 8000; // chars, on outcomes_json
const DRIVE_PASS_FIELD_CAP = 200;     // chars, per outcome string field
const DRIVE_PASS_ERROR_CAP = 500;     // chars, on error_message
const DRIVE_PASS_NAME_CAP = 100;      // chars, on error_name
// The outcomes allowlist: exactly the scalar fields driveOnce
// writes on its per-plan outcome objects (service.mjs driveOnce),
// plus the binding-projection sweep's numeric tallies. Anything
// else a future outcome grows is dropped at record time, never
// stored — segment text, detail payloads, and provider data have
// no path into this table.
const DRIVE_PASS_OUTCOME_KEYS = Object.freeze([
  "planId", "state", "stopReason", "grantId", "grantRefused",
  "skipped", "quarantined", "approvalRequired",
  "quarantineCheckFailed", "advanced",
]);
const DRIVE_PASS_SWEEP_KEYS = Object.freeze([
  "scanned", "published", "noop", "conflicts", "pending",
]);

// Scrub one free-text field (an error name or message) for durable
// storage: non-strings and empties become NULL; control characters
// are flattened; URL-shaped and long identifier-shaped runs are
// redacted (an error message in this codebase can embed a provider
// request id or a storage detail); the result is length-bounded.
// The diagnostic shape survives — the error's name and its prose —
// never the raw string, and never a stack trace (only .name and
// .message are ever passed here).
function scrubDrivePassText(value, cap) {
  if (typeof value !== "string" || value.length === 0) return null;
  let s = value.replace(/[\x00-\x1f\x7f]+/g, " ");
  s = s.replace(/https?:\/\/\S+/g, "[url]");
  s = s.replace(/\b[A-Za-z0-9_\-]{24,}\b/g, "[redacted]");
  s = s.trim();
  if (s.length === 0) return null;
  return s.length > cap ? s.slice(0, cap) : s;
}

// Write-time discipline for allowlisted outcome strings (Rowan
// correction 5 — hostile-input coverage): a stored string is safe
// BY CONSTRUCTION, via exactly one of two paths.
//   * GRAMMAR path: planId / grantId are machine
//     identifiers from closed alphabets the shipped code itself
//     generates (`plan:<hex>`,
//     `grant:<jobId>:<revision>:full|probe` — coordinator.mjs
//     grant issuance). A value matching the field's
//     grammar cannot contain whitespace, control characters, or a
//     URL (the alphabet excludes '/', ' ', and every control), so
//     it is stored as-is, length-capped. A value NOT matching its
//     grammar is not an identifier at all — it is hostile or
//     corrupt free text and takes the scrub path.
//   * TOKEN path: state / stopReason are code vocabulary
//     (lowercase snake_case constants from the shipped stop maps
//     and state writes). A value matching /^[a-z0-9_]+$/ is such a
//     token by shape and is stored as-is, length-capped; anything
//     else takes the scrub path.
//   * NAME path: error names (the row's error_name, the health
//     channel's lastFailureName) are bare class identifiers
//     (Error, SqliteError, ProductionR2NamespaceError). A value
//     matching the identifier grammar cannot contain a URL,
//     whitespace, or control characters, so it is stored as-is,
//     length-capped — the prose scrub's >=24-char redaction would
//     otherwise destroy exactly the long class names this
//     recorder exists to surface (a battery finding: the prose
//     scrub reduced ProductionR2NamespaceError to "[redacted]").
//     A non-identifier name takes the scrub path.
//   * SCRUB path: the full prose scrub (scrubDrivePassText) —
//     control characters flattened, URL-shaped runs replaced,
//     >=24-char identifier-shaped runs redacted, capped. Any value
//     changed by scrubbing (or by the length cap) is reported via
//     fieldsScrubbed / fieldsSliced so the record never pretends
//     to be a naive copy.
const DRIVE_PASS_PLAN_ID_GRAMMAR = /^plan:[A-Za-z0-9_-]+$/;
const DRIVE_PASS_GRANT_ID_GRAMMAR = /^grant:[A-Za-z0-9_:\-.]+$/;
const DRIVE_PASS_TOKEN_GRAMMAR = /^[a-z0-9_]+$/;

const DRIVE_PASS_NAME_GRAMMAR = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

// The NAME path for error names (see the discipline comment
// above): identifier-grammar values are stored as-is
// (length-capped); anything else takes the full prose scrub.
function sanitizeDrivePassName(value) {
  if (typeof value !== "string" || value.length === 0) return null;
  if (DRIVE_PASS_NAME_GRAMMAR.test(value))
    return value.length > DRIVE_PASS_NAME_CAP
      ? value.slice(0, DRIVE_PASS_NAME_CAP) : value;
  return scrubDrivePassText(value, DRIVE_PASS_NAME_CAP);
}

function sanitizeDrivePassOutcomeString(key, value, flags) {
  if (value.length > DRIVE_PASS_FIELD_CAP) flags.fieldsSliced = true;
  const grammar = key === "planId" ? DRIVE_PASS_PLAN_ID_GRAMMAR
    : key === "grantId" ? DRIVE_PASS_GRANT_ID_GRAMMAR
    : DRIVE_PASS_TOKEN_GRAMMAR;
  if (grammar.test(value) && value.length <= DRIVE_PASS_FIELD_CAP)
    return value;
  if (grammar.test(value)) { // grammatical but oversized: cap only
    flags.fieldsSliced = true;
    return value.slice(0, DRIVE_PASS_FIELD_CAP);
  }
  const scrubbed = scrubDrivePassText(value, DRIVE_PASS_FIELD_CAP);
  flags.fieldsScrubbed = true;
  // scrubDrivePassText returns null only for empty-after-scrub;
  // the stored form is the empty string in that case (the field
  // was present; its content did not survive sanitization).
  return scrubbed === null ? "" : scrubbed;
}

// Project driveOnce's outcomes array onto the recording allowlist.
// Only scalar values survive; string fields pass through
// sanitizeDrivePassOutcomeString (grammar-or-scrub, above — any
// slicing is reported via fieldsSliced, any scrubbing via
// fieldsScrubbed); the binding-projection entry keeps only its
// numeric tallies, and its error variant keeps only a presence
// flag — the raw sweep error string is NOT recorded (the row's
// error fields are the exception channel, and they belong to the
// handler's own throw).
function projectDrivePassOutcomes(outcomes) {
  if (!Array.isArray(outcomes)) return null;
  const entries = [];
  const flags = { fieldsSliced: false, fieldsScrubbed: false };
  for (const entry of outcomes) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry))
      continue;
    if (entry.bindingProjection &&
        typeof entry.bindingProjection === "object") {
      const sweep = {};
      for (const k of DRIVE_PASS_SWEEP_KEYS)
        if (typeof entry.bindingProjection[k] === "number")
          sweep[k] = entry.bindingProjection[k];
      entries.push({ bindingProjection: sweep });
      continue;
    }
    if ("bindingProjectionError" in entry) {
      entries.push({ bindingProjectionError: true });
      continue;
    }
    const o = {};
    for (const k of DRIVE_PASS_OUTCOME_KEYS) {
      const v = entry[k];
      if (typeof v === "string")
        o[k] = sanitizeDrivePassOutcomeString(k, v, flags);
      else if (typeof v === "number" || typeof v === "boolean")
        o[k] = v;
    }
    entries.push(o);
  }
  return { entries, fieldsSliced: flags.fieldsSliced,
           fieldsScrubbed: flags.fieldsScrubbed };
}

// Serialize the projected outcomes under the 8,000-char cap with
// EXPLICIT truncation (Rowan's condition): entries are kept whole,
// from the front (drive order — the earliest-selected plan's
// outcome is the most diagnostic); the first entry that would
// cross the cap and everything after it is dropped, and a terminal
// marker entry states exactly what was kept, what was dropped, and
// whether any field was sliced or scrubbed. After the per-field cap
// a single entry is ~2.3 KB worst case, so at least one whole entry
// plus the marker always fits; the stored value is always valid JSON.
function serializeDrivePassOutcomes(outcomes) {
  const projected = projectDrivePassOutcomes(outcomes);
  if (projected === null) return { json: null, truncated: 0 };
  const full = JSON.stringify(projected.entries);
  if (!projected.fieldsSliced && !projected.fieldsScrubbed &&
      full.length <= DRIVE_PASS_OUTCOMES_CAP)
    return { json: full, truncated: 0 };
  // Entry-granular truncation (spec §5.3), also entered whenever
  // a field was sliced or scrubbed: the marker is appended so the
  // invariant holds — outcomes_truncated is 1 exactly when a
  // marker is present, and the marker discloses kept/dropped
  // counts plus slicing and scrubbing. The stored form is never
  // a silently altered copy of the outcomes array.
  const kept = [];
  let dropped = 0;
  for (let i = 0; i < projected.entries.length; i++) {
    const marker = { truncated: {
      keptEntries: kept.length,
      droppedEntries: projected.entries.length - i,
      fieldsSliced: projected.fieldsSliced,
      fieldsScrubbed: projected.fieldsScrubbed } };
    if (JSON.stringify([...kept, projected.entries[i], marker]).length
        <= DRIVE_PASS_OUTCOMES_CAP) {
      kept.push(projected.entries[i]);
    } else {
      dropped = projected.entries.length - i;
      break;
    }
  }
  const marker = { truncated: {
    keptEntries: kept.length, droppedEntries: dropped,
    fieldsSliced: projected.fieldsSliced,
    fieldsScrubbed: projected.fieldsScrubbed } };
  return { json: JSON.stringify([...kept, marker]), truncated: 1 };
}

// The D6 production coordinator: the EXISTING production class
// (same export name the live script's COORDINATOR binding names),
// carrying the D6 overrides. Continuity is the design: this class
// is instantiated by the platform over the account instance's
// EXISTING Durable Object storage — the constructor's schema
// bootstrap evolves that store in place and touches nothing else.
export class OpalReaderCoordinatorProd extends ProductionCoordinatorBase {
  constructor(state, env) {
    super(state, env);
    // D8-2 PRODUCTION-CLASS FENCE (Rowan review 6525035570, path
    // audit): the base class builds every post-construction
    // coordinator from THIS env through a host-env spread — the
    // /v2/commands API dispatch in fetch(), and the coordinator
    // whose alarm() runs inside this class's super.alarm()
    // (schedule processing: watchdog retry_grant, lease handling,
    // repair follow-ups). The raw platform env carries neither
    // D6 guard flag, so before this correction those coordinators
    // ran _issueGrant with the D6 grant guard DISABLED — the
    // guard existed only on the separately constructed D6 service
    // coordinators (d6HostEnv). Stamping both flags onto the
    // class's own env here makes the guard — plan/phase checks,
    // the quarantine hold fence, the halt fence, the epoch fence —
    // apply on EVERY coordinator this class operates: no
    // base-machinery grant path can issue a grant, ledger
    // reservation, or outbox row the guard never sees. Deliberately
    // NOT done by decorating the constructor ARGUMENT: the base
    // constructor builds this.coordinator from that argument, and
    // this.coordinator is a plain schema/settings handle that no
    // production grant path uses (its only production use is the
    // ensureGenSchema call below) — the baseline suites pin its
    // plain behavior (d6-correction C2/C4), so it keeps the
    // construction env exactly as before. The spread preserves
    // every platform binding (GENERATION_HALT, tokens, storage,
    // queue) untouched; only the two D6 flags are added.
    this.env = { ...this.env, d6StandardOnly: true, d6HaltFence: true };
    // In-place, idempotent generation-schema bootstrap inside the
    // existing coordinator's SQLite (CORRECTION 6501450683). The
    // DDL is CREATE TABLE IF NOT EXISTS throughout: on the live
    // instance it adds the empty d6_* tables alongside the
    // production tables and rewrites nothing; on any later wake it
    // is a no-op. It performs no `.one()` reads, so the P8
    // empty-result throw cannot deadlock it.
    ensureGenSchema(this.coordinator.sql);
    // A-3: the per-instance drive-pass guard (amended design §3)
    // is MEMORY ONLY — a promise chain plus a holder record on
    // this instance. It is deliberately NOT durable: durability
    // would recreate the expiring-lease failure M1 rejected. The
    // durable d6_active_pass row is evidence of an in-flight
    // pass, never a lock. No scheduler DDL runs here: the schema
    // ensure is lazy (first pass / tick / activation use), so
    // construction stays byte-identical in effect to the shipped
    // build and dormant deployment changes nothing until used.
    this._passGuardState = { holder: null, waiters: [] };
    this._a3Ensured = false;
    this._a3EnsureError = null;
  }

  async fetch(request) {
    if (request.headers.get(INTERNAL_HEADER) !== "1")
      return json(403, { error: "internal_only" });
    if (request.headers.get("x-opalreader-scope") !== this._expectedScope())
      return json(403, { error: this._scopeRequiredError() });
    const url = new URL(request.url);
    try {
      // D7-2 + D8-2 ADMISSION FENCE (class level; the public
      // entry carries the same refusal — this is the D3-1-style
      // backup for a direct internal request that bypassed it):
      // while GENERATION_HALT !== "0", the grant-PRODUCING legacy
      // command types are refused HERE, before the API dispatch.
      // D7-2 refused RequestSynthesis (job + immediate grant in
      // one command) and RequestResume (paused_quota grant
      // probe): the /v2/commands dispatch historically ran on a
      // coordinator the D6 guard flag never reached, so either
      // could issue a grant/ledger/outbox spend the guard seam
      // never saw — Rowan's named hole (6524426826), closed at
      // its admission point as the ruling allows. (Since D8-2 the
      // dispatch coordinator is flagged too — see the constructor
      // — but admission remains the first, cheapest fence.)
      // D8-2 (review 6525035570) extends the refusal to plain
      // SubmitJob and RequestRepair: both stage plan-less jobs
      // with NO birth mark, and the D7-2 build's answer — the
      // guard marks the job at its first halted grant ATTEMPT —
      // is unreachable when that attempt is refused before the
      // guard (quota park / daily quota / monthly cap, all
      // checked earlier in _issueGrant) or only happens after a
      // generic re-arm. Staging is therefore refused outright
      // while halted; the guard's halt-epoch fence remains as the
      // durable layer for rows already in the store. The refusal
      // is the codebase's halt vocabulary (423, the
      // GenerationHaltedError shape). Everything else is
      // untouched: D6 intents arrive on their own internal route
      // (admitted + birth-marked, C3's contract), and sync/read/
      // settings/other commands behave exactly as before.
      if (request.method === "POST" && url.pathname === "/v2/commands" &&
          this.env.GENERATION_HALT !== "0") {
        let peek = null;
        try { peek = await request.clone().json(); } catch { peek = null; }
        if (isHaltRefusedCommand(peek))
          return json(423, { error: "generation_halted" });
      }
      if (url.pathname === "/internal/d6/intent" && request.method === "POST") {
        // R5 / R4-2 explicit configuration failure (Rowan
        // round-5 ruling, comment 6514899384, item 1): D6
        // submission is refused with a 503 whenever the
        // deployment's OPALREADER_PHASE_POLICY binding is not
        // exactly "enforce" — a missing or mistyped flag is a
        // visible release defect, never a silent legacy
        // fallback. (Construction is unconditional-enforce in
        // d6Service above regardless; this check makes the
        // misconfiguration itself fail loudly at the one route
        // that creates generation work. All other D6 routes —
        // reads, diagnostics, the operator surfaces, the seed —
        // are unaffected.)
        if (this.env.OPALREADER_PHASE_POLICY !== "enforce")
          return json(503, { error: "phase_policy_not_configured" });
        const cache = await this._cache();
        const coord = new GenerationCoordinator(this.state, d6HostEnv(this.env, cache));
        const result = await d6Service(coord, d6HostEnv(this.env, cache))
          .submitIntent(await request.json());
        await cache.flush();
        return json(200, result);
      }
      if (url.pathname === "/internal/d6/plan" && request.method === "GET") {
        const cache = await this._cache();
        const coord = new GenerationCoordinator(this.state, d6HostEnv(this.env, cache));
        const status = d6Service(coord, d6HostEnv(this.env, cache))
          .planStatus(url.searchParams.get("planId"));
        await cache.flush();
        return status
          ? json(200, status)
          : json(404, { error: "plan_not_found" });
      }
      // gen-pkg-1 read surfaces (brief §6 items 2–4): the plan
      // list, the capabilities view, and the eligibility quote.
      // Read-only service methods behind the same class gate
      // (internal header + production scope) as every D6 route.
      if (url.pathname === "/internal/d6/plans" && request.method === "GET") {
        const cache = await this._cache();
        const coord = new GenerationCoordinator(this.state, d6HostEnv(this.env, cache));
        const limitRaw = url.searchParams.get("limit");
        const result = d6Service(coord, d6HostEnv(this.env, cache))
          .listPlans({
            limit: limitRaw === null ? undefined : Number(limitRaw),
            cursor: url.searchParams.get("cursor"),
          });
        await cache.flush();
        return json(200, result);
      }
      if (url.pathname === "/internal/d6/capabilities" && request.method === "GET") {
        const cache = await this._cache();
        const coord = new GenerationCoordinator(this.state, d6HostEnv(this.env, cache));
        const result = d6Service(coord, d6HostEnv(this.env, cache)).capabilities();
        await cache.flush();
        return json(200, result);
      }
      if (url.pathname === "/internal/d6/eligibility" && request.method === "GET") {
        const cache = await this._cache();
        const coord = new GenerationCoordinator(this.state, d6HostEnv(this.env, cache));
        const chRaw = url.searchParams.get("chapterIndex");
        const result = await d6Service(coord, d6HostEnv(this.env, cache))
          .eligibilityQuote({
            bookId: url.searchParams.get("bookId"),
            scope: url.searchParams.get("scope"),
            chapterIndex: chRaw === null ? null : Number(chRaw),
            occurrenceId: url.searchParams.get("occurrenceId"),
          });
        await cache.flush();
        return result && result.outcome === "rejected"
          ? json(400, result) : json(200, result);
      }
      if (url.pathname === "/internal/d6/diagnostics" && request.method === "GET") {
        // gen-pkg-1 item 5 (Julie's Oct 29, 2026 diagnostics
        // approval, board 6511269658): the operator-only attempt
        // diagnostics read. Same fence as the seed route below —
        // the OPERATOR-ADMITTED STAMP is required; the internal
        // header and production scope alone do not suffice, and
        // the stamp is stamped by the public entry only after the
        // migration-operator credential has been presented.
        if (request.headers.get("x-opalreader-operator-admitted") !== "1")
          return json(403, { error: "migration_operator_required" });
        const cache = await this._cache();
        const coord = new GenerationCoordinator(this.state, d6HostEnv(this.env, cache));
        const limRaw = url.searchParams.get("limit");
        const service = d6Service(coord, d6HostEnv(this.env, cache));
        // PHASE B INSTRUMENTATION (P2): the presence of a drive
        // parameter selects the drive-pass read INSTEAD of attempt
        // diagnostics. The service validates the mode strictly
        // (drive must be exactly "1", and no attempt target —
        // planId / jobId / cursor — may ride along) and rejects
        // every ambiguous combination as diagnostics_mode_ambiguous;
        // the modes never blend into one response. A repeated
        // mode parameter is itself ambiguous (searchParams.get
        // would silently take the first), so the class counts
        // occurrences and reports them via repeatedModeParam.
        const repeatedModeParam =
          url.searchParams.getAll("drive").length > 1 ||
          url.searchParams.getAll("planId").length > 1 ||
          url.searchParams.getAll("jobId").length > 1 ||
          url.searchParams.getAll("cursor").length > 1 ||
          // The public entry forwards repetition on the public
          // query explicitly (its per-parameter copy collapses
          // repeats to the first value; see the forward site).
          url.searchParams.get("repeated") === "1";
        const result = url.searchParams.get("drive") !== null
          ? await service.drivePassDiagnostics({
              drive: url.searchParams.get("drive"),
              planId: url.searchParams.get("planId"),
              jobId: url.searchParams.get("jobId"),
              limit: limRaw === null ? undefined : Number(limRaw),
              cursor: url.searchParams.get("cursor"),
              repeatedModeParam,
            })
          : await service.attemptDiagnostics({
              planId: url.searchParams.get("planId"),
              jobId: url.searchParams.get("jobId"),
              limit: limRaw === null ? undefined : Number(limRaw),
              cursor: url.searchParams.get("cursor"),
            });
        await cache.flush();
        return result && result.outcome === "rejected"
          ? json(400, result) : json(200, result);
      }
      if (url.pathname === "/internal/d6/phase-binding" && request.method === "POST") {
        // gen-pkg-1 round 3 (R3-1): the phase→book binding
        // recording path Rowan required to be OPERABLE in the
        // pinned entry. Same fence as the seed/diagnostics
        // routes: the OPERATOR-ADMITTED STAMP is required — the
        // public entry stamps it only after the
        // migration-operator credential has been presented, and
        // overwrites any client-supplied value unconditionally.
        // The recorded source is stamped HERE ("operator-route"),
        // never taken from the caller's body, and the response
        // carries the READ-BACK binding from the store itself:
        // on success it proves what was recorded (and that a
        // re-record was an idempotent no-op); on a conflict
        // refusal it shows the binding that stands.
        if (request.headers.get("x-opalreader-operator-admitted") !== "1")
          return json(403, { error: "migration_operator_required" });
        const cache = await this._cache();
        const coord = new GenerationCoordinator(this.state, d6HostEnv(this.env, cache));
        const body = await request.json().catch(() => null);
        const service = d6Service(coord, d6HostEnv(this.env, cache));
        const result = service.bindPhaseBook({
          phase: body ? body.phase : undefined,
          bookId: body ? body.bookId : undefined,
          source: "operator-route",
        });
        const binding = body && typeof body.phase === "string"
          ? service.getPhaseBinding(body.phase) : null;
        await cache.flush();
        return json(200, { ...result, binding });
      }
      if (url.pathname === "/internal/d6/retire-halted-plan" && request.method === "POST") {
        // gen-pkg-1 round 3 (R3-2): the halted-plan clearance.
        // Same operator fence as the phase-binding route above
        // (operator-admitted stamp required at this class gate).
        // The service refuses unless the plan is halted_unknown
        // AND its unknown attempts have been reconciled first;
        // the transition writes its audit row in the same
        // transaction. Exercising this route against any
        // production plan is a separate Julie authorization —
        // nothing here performs it.
        if (request.headers.get("x-opalreader-operator-admitted") !== "1")
          return json(403, { error: "migration_operator_required" });
        const cache = await this._cache();
        const coord = new GenerationCoordinator(this.state, d6HostEnv(this.env, cache));
        const body = await request.json().catch(() => null);
        const result = await d6Service(coord, d6HostEnv(this.env, cache))
          .retireHaltedPlan({
            planId: body ? body.planId : undefined,
            note: body && typeof body.note === "string" ? body.note : null,
            source: "operator-route",
          });
        await cache.flush();
        return json(200, result);
      }
      if (url.pathname === "/internal/d6/release-quarantine" && request.method === "POST") {
        // D7-2 (Rowan ruling 6524426826 req 3; Julie's approval
        // 6524562842): the quarantine release — the ONLY clearance
        // a birth-mark / grant-guard hold has. Same operator fence
        // as the phase-binding and retirement routes above
        // (operator-admitted stamp required at this class gate).
        // The service checks its preconditions server-side
        // (subject named exactly once, plan exists, hold exists,
        // halted_unknown refused — release is not a reconcile),
        // and the response carries the READ-BACK hold record from
        // the store itself. A duplicate release is an idempotent
        // applied no-op (alreadyReleased: true). Exercising this
        // route against any production subject is a separate,
        // per-plan Julie authorization — nothing here performs it.
        if (request.headers.get("x-opalreader-operator-admitted") !== "1")
          return json(403, { error: "migration_operator_required" });
        const cache = await this._cache();
        const coord = new GenerationCoordinator(this.state, d6HostEnv(this.env, cache));
        const body = await request.json().catch(() => null);
        const service = d6Service(coord, d6HostEnv(this.env, cache));
        const isStr = (v) => typeof v === "string" && v.length > 0;
        const subject = {
          planId: body && isStr(body.planId) ? body.planId : null,
          jobId: body && isStr(body.jobId) ? body.jobId : null,
        };
        const result = service.releaseQuarantine({
          ...subject, source: "operator-route",
        });
        const quarantine = service.getQuarantine(subject);
        await cache.flush();
        return json(200, { ...result, quarantine });
      }
      if (url.pathname === "/internal/d6/reconcile-unknown" && request.method === "POST") {
        // CH2 FIX PACKAGE (fix 2): the unknown-billing
        // reconciliation invocation path. Same operator fence
        // as the phase-binding / retirement / release routes
        // above (operator-admitted stamp required at this class
        // gate). Preconditions, enforced HERE and in the store:
        //   * the caller is operator-admitted (the stamp);
        //   * attemptId names one attempt (required, non-empty
        //     string) — anything else is refused, moving
        //     nothing;
        //   * the settlement is EXPLICIT: knownCostMicro must
        //     be present and either a finite number >= 0 or
        //     exactly null (a proven no-charge). An absent or
        //     malformed value is refused (known_cost_required /
        //     known_cost_invalid) — a malformed request can
        //     never silently become a no-charge settlement;
        //   * outcome is REQUIRED and must be one of the
        //     settlement outcomes "success" / "failed_known" /
        //     "no_charge" (outcome_required / outcome_invalid
        //     otherwise), and the (cost, outcome) PAIR must be
        //     consistent — null cost only with "no_charge", a
        //     numeric cost never with "no_charge", and "success"
        //     only with a finite known cost (B2: the store
        //     refuses contradictions as
        //     reconcile_settlement_inconsistent; in particular
        //     null + "success" can never settle);
        //   * planId is REQUIRED (plan_id_required) and must
        //     own the attempt — the store verifies it against
        //     the attempt's server-stamped plan linkage and
        //     refuses reconcile_plan_mismatch;
        //   * the attempt must be confirmed/unknown (the store
        //     refuses attempt_not_found / attempt_not_unknown).
        // On success the store settles the attempt and writes
        // the d6_reconcile_audit row in the same transaction;
        // the recorded source is stamped HERE ("operator-route"),
        // never taken from the caller's body. Halt-state safety:
        // this handler performs no halt check because none is
        // needed — settling a cost record cannot create work in
        // either halt state (see the header note). Exercising
        // this route against any production attempt is a
        // separate Julie authorization — nothing here performs
        // it.
        if (request.headers.get("x-opalreader-operator-admitted") !== "1")
          return json(403, { error: "migration_operator_required" });
        const cache = await this._cache();
        const coord = new GenerationCoordinator(this.state, d6HostEnv(this.env, cache));
        const body = await request.json().catch(() => null);
        const reject = (reason) => json(200, { outcome: "rejected", reason });
        if (!body || typeof body.attemptId !== "string" || body.attemptId.length === 0)
          return reject("attempt_id_required");
        if (typeof body.planId !== "string" || body.planId.length === 0)
          return reject("plan_id_required");
        if (!("knownCostMicro" in body))
          return reject("known_cost_required");
        const kcm = body.knownCostMicro;
        if (!(kcm === null || (typeof kcm === "number" && Number.isFinite(kcm) && kcm >= 0)))
          return reject("known_cost_invalid");
        if (body.outcome === undefined || body.outcome === null)
          return reject("outcome_required");
        if (body.outcome !== "success" && body.outcome !== "failed_known"
            && body.outcome !== "no_charge")
          return reject("outcome_invalid");
        const result = d6Service(coord, d6HostEnv(this.env, cache))
          .reconcileUnknownAttempt(body.attemptId, {
            knownCostMicro: kcm,
            outcome: body.outcome,
            planId: body.planId,
            note: typeof body.note === "string" ? body.note : null,
            source: "operator-route",
          });
        await cache.flush();
        return json(200, result);
      }
      if (url.pathname === "/internal/d6/adjudicate-estimated" && request.method === "POST") {
        // CH2 DISPOSITION PACKAGE: the uncertainty disposition
        // (genstore.adjudicateEstimated). Same operator fence as
        // the reconcile / phase-binding / retirement / release
        // routes above (operator-admitted stamp required at this
        // class gate). The request contract is a CLOSED ALLOWLIST
        // (design §7.2), enforced HERE, before the store is
        // called, with zero state movement on any refusal:
        //   * permitted keys are exactly { attemptId, planId,
        //     authorizationRef, note };
        //   * a caller-supplied FIGURE key (knownCostMicro,
        //     estimatedCostMicro, estimated_cost_micro_cents,
        //     reservedCostMicro, reserved_cost_micro_cents,
        //     costMicroCents) refuses the whole request as
        //     adjudication_figure_caller_supplied — money figures
        //     are derived server-side from persisted records
        //     (§5.2); a request that tries to name one is
        //     malformed by definition;
        //   * any other non-allowlisted key refuses as
        //     adjudication_request_key_not_allowed;
        //   * attemptId / planId / authorizationRef are required
        //     strings, NONBLANK after trimming (the trimmed values
        //     are what proceed; the trimmed authorizationRef is
        //     recorded verbatim in the audit row);
        //   * note is an optional string (build-set length bound:
        //     2000 chars); a non-string or over-length note
        //     refuses as note_invalid.
        // The store then enforces the §4.1 chain (attempt exists,
        // confirmed/unknown, plan ownership, plan halted_unknown,
        // budget phase from the PLAN row, particulars validated
        // before any figure is derived) and writes the outcome +
        // audit row in one transaction. The recorded source and
        // evidence references are stamped HERE (server-side),
        // never taken from the caller's body. Halt-state safety:
        // no halt check, because none is needed — disposing a
        // cost record cannot create work in either halt state.
        // Exercising this route against any production attempt
        // is a separate Julie authorization, recorded as the
        // call's authorizationRef — nothing here performs it.
        if (request.headers.get("x-opalreader-operator-admitted") !== "1")
          return json(403, { error: "migration_operator_required" });
        const cache = await this._cache();
        const coord = new GenerationCoordinator(this.state, d6HostEnv(this.env, cache));
        const body = await request.json().catch(() => null);
        const reject = (reason) => json(200, { outcome: "rejected", reason });
        if (!body || typeof body !== "object" || Array.isArray(body))
          return reject("adjudication_request_key_not_allowed");
        const FIGURE_KEYS = [
          "knownCostMicro", "estimatedCostMicro", "estimated_cost_micro_cents",
          "reservedCostMicro", "reserved_cost_micro_cents", "costMicroCents",
        ];
        const ALLOWED_KEYS = ["attemptId", "planId", "authorizationRef", "note"];
        for (const key of Object.keys(body)) {
          if (FIGURE_KEYS.includes(key))
            return reject("adjudication_figure_caller_supplied");
          if (!ALLOWED_KEYS.includes(key))
            return reject("adjudication_request_key_not_allowed");
        }
        const nonblank = (v) => typeof v === "string" && v.trim().length > 0;
        if (!nonblank(body.attemptId)) return reject("attempt_id_required");
        if (!nonblank(body.planId)) return reject("plan_id_required");
        if (!nonblank(body.authorizationRef))
          return reject("authorization_ref_required");
        if (body.note !== undefined && body.note !== null &&
            (typeof body.note !== "string" || body.note.length > 2000))
          return reject("note_invalid");
        const result = d6Service(coord, d6HostEnv(this.env, cache))
          .adjudicateEstimatedAttempt(body.attemptId.trim(), {
            planId: body.planId.trim(),
            authorizationRef: body.authorizationRef.trim(),
            note: typeof body.note === "string" ? body.note : null,
            source: "operator-route",
            evidenceRefs: [...ADJUDICATION_EVIDENCE_REFS],
          });
        await cache.flush();
        return json(200, result);
      }
      if (url.pathname === "/internal/d6/quota-bootstrap" && request.method === "POST") {
        // QUOTA ROUTES PACKAGE: the one-time quota bootstrap
        // (quota-budget.bootstrapQuota) — the invocation path
        // DP1 approved (Rowan operational review 6546037460).
        // Same operator fence as every operator surface above
        // (operator-admitted stamp required at this class
        // gate). Two further fences, both enforced HERE before
        // the store is touched:
        //   * HALT-ONLY: bootstrap is a state-changing operator
        //     act; it refuses unless GENERATION_HALT is exactly
        //     "1" (the seed precedent — seeding is likewise a
        //     pre-arming act only). Queue-pause cannot be
        //     checked from inside the Worker (the queue binding
        //     is send-only; there is no pause-state read on
        //     it), so it is an execution-time precondition of
        //     gate (b), verified by the operator runbook's
        //     P2/P3 read-backs before this route is invoked.
        //   * FIGURELESS: bootstrapQuota takes no caller
        //     figures — there is nothing to pass. The body
        //     allowlist is therefore EMPTY: any key at all
        //     refuses the request (a figure key as
        //     quota_bootstrap_figure_caller_supplied, any
        //     other as quota_bootstrap_request_key_not_
        //     allowed), and a bare numeric body refuses as a
        //     figure. A missing/empty body and {} are the only
        //     admissible shapes.
        //   * STRICT BODY HANDLING (Rowan source hold
        //     6546277727 item 1): the body is read as TEXT and
        //     parsed HERE, so a genuinely absent/empty body is
        //     distinguished from malformed JSON and from an
        //     explicit JSON null. Malformed JSON refuses as
        //     quota_bootstrap_body_malformed and an explicit
        //     null as quota_bootstrap_body_null — both BEFORE
        //     any quota schema, attempt stamp, dispatch row,
        //     or bootstrap marker exists. Operator admission
        //     must never turn malformed input into the one
        //     irreversible accounting write; enforcement lives
        //     at this handler so a direct internal call is
        //     held to the same contract.
        // The store function is itself idempotent: a second
        // invocation assigns nothing twice and never rewrites
        // the original bootstrap record (alreadyArmed: true).
        // The response's exception detail is bounded exactly
        // as the reconcile report's (QUOTA_ROUTE_DETAIL_LIMIT,
        // exact count, explicit truncation flag).
        if (request.headers.get("x-opalreader-operator-admitted") !== "1")
          return json(403, { error: "migration_operator_required" });
        const reject = (reason) => json(200, { outcome: "rejected", reason });
        if (this.env.GENERATION_HALT !== "1")
          return reject("generation_not_halted");
        // A body READ failure is never equivalent to an
        // intentionally empty request (Rowan 6546431837):
        // refuse by name before the store is touched.
        let rawBody;
        try { rawBody = await request.text(); }
        catch { return reject("quota_bootstrap_body_read_error"); }
        let body = null;
        if (rawBody.trim() !== "") {
          try { body = JSON.parse(rawBody); }
          catch { return reject("quota_bootstrap_body_malformed"); }
          if (body === null) return reject("quota_bootstrap_body_null");
        }
        if (body !== null) {
          if (typeof body === "number")
            return reject("quota_bootstrap_figure_caller_supplied");
          if (typeof body !== "object" || Array.isArray(body))
            return reject("quota_bootstrap_request_not_figureless");
          const FIGURE_KEYS = [
            "knownCostMicro", "estimatedCostMicro", "estimated_cost_micro_cents",
            "reservedCostMicro", "reserved_cost_micro_cents", "costMicroCents",
            "assigned", "assignedCount", "exceptionCount", "limit",
            "dayKey", "dispatchDayKey", "dispatched", "reserved", "consumed",
          ];
          for (const key of Object.keys(body)) {
            if (FIGURE_KEYS.includes(key))
              return reject("quota_bootstrap_figure_caller_supplied");
            return reject("quota_bootstrap_request_key_not_allowed");
          }
        }
        const cache = await this._cache();
        const coord = new GenerationCoordinator(this.state, d6HostEnv(this.env, cache));
        const result = bootstrapQuota(coord);
        await cache.flush();
        const exceptions = result.exceptions ?? [];
        return json(200, {
          outcome: "applied",
          bootstrapped: true,
          alreadyArmed: result.alreadyArmed === true,
          assigned: result.assigned,
          providerAttemptDailyLimit: PROVIDER_ATTEMPT_DAILY_LIMIT,
          exceptionCount: exceptions.length,
          exceptions: exceptions.slice(0, QUOTA_ROUTE_DETAIL_LIMIT).map((e) => ({
            attemptId: e.attemptId, phase: e.phase, intervalDays: e.intervalDays,
          })),
          exceptionsTruncated: exceptions.length > QUOTA_ROUTE_DETAIL_LIMIT,
        });
      }
      if (url.pathname === "/internal/d6/quota-dispose-exception" && request.method === "POST") {
        // QUOTA ROUTES PACKAGE: ONE bootstrap exception's
        // disposition (quota-budget.disposeBootstrapException).
        // Same operator fence (stamp required at this class
        // gate) + HALT-ONLY like the bootstrap above (a
        // state-changing operator act; queue-pause is the
        // gate-(b) runbook's execution-time precondition, for
        // the reason stated there). The request contract is a
        // CLOSED ALLOWLIST enforced HERE, before the store is
        // called, with zero state movement on any refusal:
        //   * permitted keys are exactly { attemptId, dayKey,
        //     authorizationRef, source, note } — the store
        //     function's own input shape;
        //   * a caller-supplied FIGURE key refuses as
        //     quota_disposition_figure_caller_supplied (the
        //     disposition records history; it takes no money
        //     or count figure from the caller — the day is the
        //     only caller-named value, and the store proves it
        //     against the row's own surviving evidence);
        //   * any other non-allowlisted key refuses as
        //     quota_disposition_request_key_not_allowed;
        //   * attemptId / dayKey / authorizationRef are
        //     required NONBLANK strings (attemptId and
        //     authorizationRef proceed trimmed, as at the
        //     adjudicate route; dayKey proceeds verbatim —
        //     the store's real-calendar validation owns its
        //     shape);
        //   * source / note are optional strings bounded at
        //     2000 chars (the adjudicate route's note bound);
        //     a non-string or over-length value refuses.
        // The store then re-validates EVERYTHING itself —
        // authorization nonblank, real calendar day, attempt
        // exists and is an exception, the Hold-B law (a
        // multi-day interval refuses
        // quota_disposition_ambiguous_interval, checked before
        // the interval bounds; no input to this route can
        // weaken it), in-interval bounds, attribution — inside
        // one transaction, so a store refusal changes nothing.
        // Store refusals surface here as { outcome:
        // "rejected", reason: <the store's named error code> }:
        // they are refusals, not faults. HARDENING (Rowan
        // 6546277727): only the store's NAMED domain refusals
        // (quota_* reason codes and attempt_not_found) take
        // that path — an unexpected SQLite/runtime fault is
        // RETHROWN and surfaces as a real fault (the class
        // catch's HTTP 500), never laundered into an ordinary
        // rejected outcome. Exercising this route
        // against any production attempt is a named B3
        // sub-decision of gate (b) — nothing here performs it.
        if (request.headers.get("x-opalreader-operator-admitted") !== "1")
          return json(403, { error: "migration_operator_required" });
        const reject = (reason) => json(200, { outcome: "rejected", reason });
        if (this.env.GENERATION_HALT !== "1")
          return reject("generation_not_halted");
        const body = await request.json().catch(() => null);
        if (!body || typeof body !== "object" || Array.isArray(body))
          return reject("quota_disposition_request_key_not_allowed");
        const FIGURE_KEYS = [
          "knownCostMicro", "estimatedCostMicro", "estimated_cost_micro_cents",
          "reservedCostMicro", "reserved_cost_micro_cents", "costMicroCents",
        ];
        const ALLOWED_KEYS = ["attemptId", "dayKey", "authorizationRef", "source", "note"];
        for (const key of Object.keys(body)) {
          if (FIGURE_KEYS.includes(key))
            return reject("quota_disposition_figure_caller_supplied");
          if (!ALLOWED_KEYS.includes(key))
            return reject("quota_disposition_request_key_not_allowed");
        }
        const nonblank = (v) => typeof v === "string" && v.trim().length > 0;
        if (!nonblank(body.attemptId)) return reject("attempt_id_required");
        if (!nonblank(body.dayKey)) return reject("day_key_required");
        if (!nonblank(body.authorizationRef))
          return reject("authorization_ref_required");
        if (body.source !== undefined && body.source !== null &&
            (typeof body.source !== "string" || body.source.length > 2000))
          return reject("source_invalid");
        if (body.note !== undefined && body.note !== null &&
            (typeof body.note !== "string" || body.note.length > 2000))
          return reject("note_invalid");
        const cache = await this._cache();
        const coord = new GenerationCoordinator(this.state, d6HostEnv(this.env, cache));
        let result;
        try {
          result = disposeBootstrapException(coord, body.attemptId.trim(), {
            dayKey: body.dayKey,
            authorizationRef: body.authorizationRef.trim(),
            source: typeof body.source === "string" ? body.source : null,
            note: typeof body.note === "string" ? body.note : null,
          });
        } catch (e) {
          const code = String((e && e.message) || e).split(":")[0].trim();
          if (code === "attempt_not_found" || /^quota_[a-z0-9_]+$/.test(code))
            return reject(code);
          throw e;
        }
        await cache.flush();
        return json(200, { outcome: "applied", ...result });
      }
      if (url.pathname === "/internal/d6/quota-reconcile" && request.method === "GET") {
        // QUOTA ROUTES PACKAGE: the read-only reconciliation
        // report (quota-budget.reconcileQuota — SELECT-only by
        // construction, verified in source; this handler adds
        // no write of any kind). Same operator fence (stamp
        // required at this class gate). NO halt fence: a read
        // changes nothing in either halt state, exactly as the
        // diagnostics read above. Output discipline (DP1: the
        // output must be bounded and auditable — attempt
        // identities and history are sensitive): the report's
        // identity-bearing detail arrays (drift, exceptions)
        // are PAGINATED (Rowan source hold 6546277727 item
        // 2): a fixed page of QUOTA_ROUTE_DETAIL_LIMIT entries
        // at a strictly validated integer offset per array
        // (exceptionOffset / driftOffset, default 0), with
        // EXACT total counts and a nextOffset signal (null on
        // the last page) — so a census larger than one page is
        // fully enumerable in disjoint, deterministic pages.
        // Exceptions arrive in the store's own deterministic
        // order (created_at, attempt_id); drift is sorted
        // here by a stable key before paging, since the store
        // assembles it from several queries. A truncated page
        // is never presented as the complete census: the
        // response always carries both totals and both next
        // offsets, and censusComplete is true only when one
        // response holds both arrays whole. The aggregates
        // (totals, dayTotals) pass through whole (they carry
        // counts per day, no identities). READ PURITY (item
        // 3): this handler performs NO cache flush — flush()
        // carries a conditional R2 bucket.put path, and a
        // read's purity must hold independent of any cache
        // state. Nothing is logged here. Pre-bootstrap the
        // store answers its floor shape ({ armed: false, ok:
        // false, reason: "not_armed" }), passed through
        // untouched — the unarmed view gate (a)'s D4 verifies.
        if (request.headers.get("x-opalreader-operator-admitted") !== "1")
          return json(403, { error: "migration_operator_required" });
        const cache = await this._cache();
        const coord = new GenerationCoordinator(this.state, d6HostEnv(this.env, cache));
        const report = reconcileQuota(coord);
        if (!report.armed) return json(200, report);
        const parseOffset = (raw) => {
          if (raw === null) return 0;
          if (!/^(0|[1-9]\d*)$/.test(raw)) return null;
          const n = Number(raw);
          return Number.isSafeInteger(n) ? n : null;
        };
        const exceptionOffset = parseOffset(url.searchParams.get("exceptionOffset"));
        const driftOffset = parseOffset(url.searchParams.get("driftOffset"));
        if (exceptionOffset === null || driftOffset === null)
          return json(400, { error: "quota_reconcile_offset_invalid" });
        const page = (items, offset) => {
          const slice = items.slice(offset, offset + QUOTA_ROUTE_DETAIL_LIMIT);
          const nextOffset = offset + slice.length < items.length
            ? offset + slice.length : null;
          return { slice, nextOffset,
                   truncated: offset + slice.length < items.length };
        };
        const driftAll = [...(report.drift ?? [])].sort((a, b) => {
          const ka = [a.kind ?? "", a.reservationId ?? "", a.attemptId ?? "",
                      a.dayKey ?? "", JSON.stringify(a)].join("|");
          const kb = [b.kind ?? "", b.reservationId ?? "", b.attemptId ?? "",
                      b.dayKey ?? "", JSON.stringify(b)].join("|");
          return ka < kb ? -1 : ka > kb ? 1 : 0;
        });
        const exceptionsAll = report.exceptions ?? [];
        const driftPage = page(driftAll, driftOffset);
        const exceptionsPage = page(exceptionsAll, exceptionOffset);
        return json(200, {
          ...report,
          drift: driftPage.slice,
          driftCount: driftAll.length,
          driftOffset,
          driftNextOffset: driftPage.nextOffset,
          driftTruncated: driftPage.truncated,
          exceptions: exceptionsPage.slice,
          exceptionCount: exceptionsAll.length,
          exceptionsOffset: exceptionOffset,
          exceptionsNextOffset: exceptionsPage.nextOffset,
          exceptionsTruncated: exceptionsPage.truncated,
          censusComplete: driftOffset === 0 && exceptionOffset === 0 &&
            driftPage.nextOffset === null && exceptionsPage.nextOffset === null,
        });
      }
      if (url.pathname === "/internal/d6/release-park" && request.method === "POST") {
        // CH3 MECHANISMS (§5A): the park release
        // (park-release.releasePark). Same operator fence as
        // every operator surface above (operator-admitted stamp
        // required at this class gate). NO halt fence: unlike
        // the quota bootstrap/dispose (pre-arming accounting
        // acts), the release is an EXECUTION-time fence
        // adjustment — gate (c) has already re-armed the system,
        // and the release itself creates no plan, job, or grant;
        // generation still flows only through submitIntent's
        // builder and every downstream guard (the adjudicate
        // route's reasoning applies). The request contract is a
        // CLOSED ALLOWLIST enforced HERE, before the store is
        // called, with zero state movement on any refusal:
        // permitted keys are exactly { jobId, occurrenceIds,
        // authorizationRef, source, note }; jobId and
        // authorizationRef are required nonblank strings;
        // occurrenceIds must be an array (its contents — set
        // shape, membership, definition containment — are the
        // store's fences); source / note are optional strings
        // bounded at 2000 chars. The store then re-validates
        // EVERYTHING itself (job parked; definition derived
        // mechanically from the pinned carry + live identity,
        // never from the caller; every id a pending row of the
        // job AND inside the definition set —
        // park_release_outside_definition refuses idx 26 by
        // construction; mutual exclusion with live exemptions;
        // idempotent identical re-release; conflicting
        // re-release refused) inside one transaction, so a
        // store refusal changes nothing. Store domain refusals
        // return as { outcome: "rejected", reason }; an
        // unexpected fault THROWS and surfaces as the class
        // catch's HTTP 500 — never laundered into a rejection.
        if (request.headers.get("x-opalreader-operator-admitted") !== "1")
          return json(403, { error: "migration_operator_required" });
        const reject = (reason) => json(200, { outcome: "rejected", reason });
        const body = await request.json().catch(() => null);
        if (!body || typeof body !== "object" || Array.isArray(body))
          return reject("park_release_request_key_not_allowed");
        const ALLOWED_KEYS = ["jobId", "occurrenceIds", "authorizationRef", "source", "note"];
        for (const key of Object.keys(body)) {
          if (!ALLOWED_KEYS.includes(key))
            return reject("park_release_request_key_not_allowed");
        }
        const nonblank = (v) => typeof v === "string" && v.trim().length > 0;
        if (!nonblank(body.jobId)) return reject("park_release_job_required");
        if (!Array.isArray(body.occurrenceIds))
          return reject("park_release_set_invalid");
        if (!nonblank(body.authorizationRef))
          return reject("authorization_ref_required");
        if (body.source !== undefined && body.source !== null &&
            (typeof body.source !== "string" || body.source.length > 2000))
          return reject("source_invalid");
        if (body.note !== undefined && body.note !== null &&
            (typeof body.note !== "string" || body.note.length > 2000))
          return reject("note_invalid");
        const cache = await this._cache();
        const coord = new GenerationCoordinator(this.state, d6HostEnv(this.env, cache));
        const result = releasePark(coord, {
          jobId: body.jobId.trim(),
          occurrenceIds: body.occurrenceIds,
          authorizationRef: body.authorizationRef.trim(),
          source: typeof body.source === "string" ? body.source : null,
          note: typeof body.note === "string" ? body.note : null,
        });
        await cache.flush();
        return json(200, result);
      }
      if (url.pathname === "/internal/d6/revoke-park-release" && request.method === "POST") {
        // CH3 MECHANISMS (§5A tombstone): revoke the park
        // release (park-release.revokeParkRelease) — tombstones
        // the job's live release row (never deletes it), which
        // restores the parked fence for the released ids
        // EXACTLY on the next plane build. Same operator fence
        // (stamp at this class gate), no halt fence (same
        // reasoning as the release). Closed allowlist {
        // jobId, authorizationRef, source, note }; the store
        // refuses park_release_not_found when no release row
        // exists and answers an idempotent no-op for an
        // already-tombstoned row.
        if (request.headers.get("x-opalreader-operator-admitted") !== "1")
          return json(403, { error: "migration_operator_required" });
        const reject = (reason) => json(200, { outcome: "rejected", reason });
        const body = await request.json().catch(() => null);
        if (!body || typeof body !== "object" || Array.isArray(body))
          return reject("park_release_request_key_not_allowed");
        const ALLOWED_KEYS = ["jobId", "authorizationRef", "source", "note"];
        for (const key of Object.keys(body)) {
          if (!ALLOWED_KEYS.includes(key))
            return reject("park_release_request_key_not_allowed");
        }
        const nonblank = (v) => typeof v === "string" && v.trim().length > 0;
        if (!nonblank(body.jobId)) return reject("park_release_job_required");
        if (!nonblank(body.authorizationRef))
          return reject("authorization_ref_required");
        if (body.source !== undefined && body.source !== null &&
            (typeof body.source !== "string" || body.source.length > 2000))
          return reject("source_invalid");
        if (body.note !== undefined && body.note !== null &&
            (typeof body.note !== "string" || body.note.length > 2000))
          return reject("note_invalid");
        const cache = await this._cache();
        const coord = new GenerationCoordinator(this.state, d6HostEnv(this.env, cache));
        const result = revokeParkRelease(coord, {
          jobId: body.jobId.trim(),
          authorizationRef: body.authorizationRef.trim(),
          source: typeof body.source === "string" ? body.source : null,
          note: typeof body.note === "string" ? body.note : null,
        });
        await cache.flush();
        return json(200, result);
      }
      if (url.pathname === "/internal/d6/exempt-chapter-occurrence" && request.method === "POST") {
        // CH3 MECHANISMS (§5B): the chapter-occurrence
        // exemption (park-release.exemptChapterOccurrence).
        // Same operator fence (stamp at this class gate), no
        // halt fence (same reasoning as the release: an
        // execution-time fence adjustment that creates no work
        // by itself). The body is a SINGLETON by design — the
        // §5B.2 allowlist is exactly { jobId, occurrenceId,
        // authorizationRef, source, note }; there is no set
        // form, so no call can exempt more than one occurrence.
        // The store re-validates everything (job parked;
        // definition derived mechanically; the occurrence a
        // row of THIS job; a definition member refuses
        // chapter_exemption_inside_definition — the mutual-
        // exclusion mirror of the release's idx-26 refusal;
        // the occurrence unbound; not covered by a live
        // release; idempotent duplicate) inside one
        // transaction. Domain refusals return as rejections;
        // unexpected faults throw to the class catch (500).
        if (request.headers.get("x-opalreader-operator-admitted") !== "1")
          return json(403, { error: "migration_operator_required" });
        const reject = (reason) => json(200, { outcome: "rejected", reason });
        const body = await request.json().catch(() => null);
        if (!body || typeof body !== "object" || Array.isArray(body))
          return reject("chapter_exemption_request_key_not_allowed");
        const ALLOWED_KEYS = ["jobId", "occurrenceId", "authorizationRef", "source", "note"];
        for (const key of Object.keys(body)) {
          if (!ALLOWED_KEYS.includes(key))
            return reject("chapter_exemption_request_key_not_allowed");
        }
        const nonblank = (v) => typeof v === "string" && v.trim().length > 0;
        if (!nonblank(body.jobId)) return reject("chapter_exemption_job_required");
        if (!nonblank(body.occurrenceId))
          return reject("chapter_exemption_occurrence_required");
        if (!nonblank(body.authorizationRef))
          return reject("authorization_ref_required");
        if (body.source !== undefined && body.source !== null &&
            (typeof body.source !== "string" || body.source.length > 2000))
          return reject("source_invalid");
        if (body.note !== undefined && body.note !== null &&
            (typeof body.note !== "string" || body.note.length > 2000))
          return reject("note_invalid");
        const cache = await this._cache();
        const coord = new GenerationCoordinator(this.state, d6HostEnv(this.env, cache));
        const result = exemptChapterOccurrence(coord, {
          jobId: body.jobId.trim(),
          occurrenceId: body.occurrenceId.trim(),
          authorizationRef: body.authorizationRef.trim(),
          source: typeof body.source === "string" ? body.source : null,
          note: typeof body.note === "string" ? body.note : null,
        });
        await cache.flush();
        return json(200, result);
      }
      if (url.pathname === "/internal/d6/revoke-chapter-exemption" && request.method === "POST") {
        // CH3 MECHANISMS (§5B tombstone): revoke the chapter
        // exemption (park-release.revokeChapterExemption) —
        // tombstones the singleton row (never deletes it),
        // restoring BOTH parked fences for the occurrence
        // exactly. Same operator fence (stamp at this class
        // gate), no halt fence. Closed allowlist { jobId,
        // occurrenceId, authorizationRef, source, note }; the
        // store refuses chapter_exemption_not_found when no
        // row exists for the named job + occurrence and
        // answers an idempotent no-op for an
        // already-tombstoned row.
        if (request.headers.get("x-opalreader-operator-admitted") !== "1")
          return json(403, { error: "migration_operator_required" });
        const reject = (reason) => json(200, { outcome: "rejected", reason });
        const body = await request.json().catch(() => null);
        if (!body || typeof body !== "object" || Array.isArray(body))
          return reject("chapter_exemption_request_key_not_allowed");
        const ALLOWED_KEYS = ["jobId", "occurrenceId", "authorizationRef", "source", "note"];
        for (const key of Object.keys(body)) {
          if (!ALLOWED_KEYS.includes(key))
            return reject("chapter_exemption_request_key_not_allowed");
        }
        const nonblank = (v) => typeof v === "string" && v.trim().length > 0;
        if (!nonblank(body.jobId)) return reject("chapter_exemption_job_required");
        if (!nonblank(body.occurrenceId))
          return reject("chapter_exemption_occurrence_required");
        if (!nonblank(body.authorizationRef))
          return reject("authorization_ref_required");
        if (body.source !== undefined && body.source !== null &&
            (typeof body.source !== "string" || body.source.length > 2000))
          return reject("source_invalid");
        if (body.note !== undefined && body.note !== null &&
            (typeof body.note !== "string" || body.note.length > 2000))
          return reject("note_invalid");
        const cache = await this._cache();
        const coord = new GenerationCoordinator(this.state, d6HostEnv(this.env, cache));
        const result = revokeChapterExemption(coord, {
          jobId: body.jobId.trim(),
          occurrenceId: body.occurrenceId.trim(),
          authorizationRef: body.authorizationRef.trim(),
          source: typeof body.source === "string" ? body.source : null,
          note: typeof body.note === "string" ? body.note : null,
        });
        await cache.flush();
        return json(200, result);
      }
      if (url.pathname === "/internal/d6/grant-finalization-preview" && request.method === "GET") {
        // RECOVERY (Option A) PREVIEW: derives the full
        // precondition state for one grant (grant-finalizer.
        // previewGrantFinalization) and its precondition digest.
        // READ-ONLY — the store function writes nothing and does
        // not even bootstrap the audit schema. Same operator
        // fence (stamp at this class gate), no halt fence.
        // Identity arrives in the query: grantId (required) plus
        // optional planId/jobId corroboration.
        if (request.headers.get("x-opalreader-operator-admitted") !== "1")
          return json(403, { error: "migration_operator_required" });
        const grantId = url.searchParams.get("grantId");
        if (!grantId)
          return json(400, { error: "grant_id_required" });
        const cache = await this._cache();
        const coord = new GenerationCoordinator(this.state, d6HostEnv(this.env, cache));
        const store = createGenStore(coord);
        const result = previewGrantFinalization(coord, store, {
          grantId,
          planId: url.searchParams.get("planId") || null,
          jobId: url.searchParams.get("jobId") || null,
        });
        await cache.flush();
        return json(200, result);
      }
      if (url.pathname === "/internal/d6/finalize-grant" && request.method === "POST") {
        // RECOVERY (Option A): the operator-only grant finalizer
        // (grant-finalizer.finalizeGrant) — the truthful manual
        // closure for a grant whose occurrences committed but
        // whose executor report never landed. Same operator fence
        // (stamp at this class gate), no halt fence. Closed
        // allowlist { grantId, planId, jobId, authorizationRef,
        // expectedPreconditionDigest }: there is deliberately NO
        // results array — the caller can never supply outcomes;
        // the store re-derives every fact inside one transaction
        // and refuses on any divergence. The action performs no
        // provider call, no submission, and no wake.
        if (request.headers.get("x-opalreader-operator-admitted") !== "1")
          return json(403, { error: "migration_operator_required" });
        const reject = (reason) => json(200, { outcome: "rejected", reason });
        const body = await request.json().catch(() => null);
        if (!body || typeof body !== "object" || Array.isArray(body))
          return reject("grant_finalization_request_key_not_allowed");
        const ALLOWED_KEYS = ["grantId", "planId", "jobId", "authorizationRef",
          "expectedPreconditionDigest"];
        for (const key of Object.keys(body)) {
          if (!ALLOWED_KEYS.includes(key))
            return reject("grant_finalization_request_key_not_allowed");
        }
        const nonblank = (v) => typeof v === "string" && v.trim().length > 0;
        if (!nonblank(body.grantId)) return reject("grant_finalization_grant_required");
        if (body.planId !== undefined && body.planId !== null && !nonblank(body.planId))
          return reject("grant_finalization_plan_required");
        if (body.jobId !== undefined && body.jobId !== null && !nonblank(body.jobId))
          return reject("grant_finalization_job_required");
        if (!nonblank(body.authorizationRef))
          return reject("grant_finalization_authorization_ref_required");
        if (!nonblank(body.expectedPreconditionDigest)
            || !/^[0-9a-f]{64}$/.test(body.expectedPreconditionDigest.trim()))
          return reject("grant_finalization_digest_required");
        const cache = await this._cache();
        const coord = new GenerationCoordinator(this.state, d6HostEnv(this.env, cache));
        const store = createGenStore(coord);
        const result = finalizeGrant(coord, store, {
          grantId: body.grantId.trim(),
          planId: nonblank(body.planId) ? body.planId.trim() : null,
          jobId: nonblank(body.jobId) ? body.jobId.trim() : null,
          authorizationRef: body.authorizationRef.trim(),
          expectedPreconditionDigest: body.expectedPreconditionDigest.trim(),
        });
        await cache.flush();
        return json(200, result);
      }
      if (url.pathname === "/internal/d6/containment" && request.method === "GET") {
        // CONTAINMENT state read (Phase B containment design,
        // revised semantics). Same operator fence as every
        // operator surface above (operator-admitted stamp required
        // at this class gate). Read-only and side-effect-free: the
        // state read (coordinator.mjs readContainmentState — no
        // DDL, no writes), one getAlarm() read-back, and the
        // pending-schedule counts. This is the passive verification
        // surface for a containment transition: state row +
        // registration + schedule, without any command or wake.
        if (request.headers.get("x-opalreader-operator-admitted") !== "1")
          return json(403, { error: "migration_operator_required" });
        const cache = await this._cache();
        const coord = new GenerationCoordinator(this.state, d6HostEnv(this.env, cache));
        const state = coord.containmentState();
        let armedAt = null;
        let armedReadFailed = false;
        try {
          const armed = await this.state.storage.getAlarm();
          armedAt = typeof armed === "number" ? armed : null;
        } catch { armedAt = null; armedReadFailed = true; }
        const pending = coord._oneOrNull(
          `SELECT COUNT(*) AS n FROM schedule WHERE state = 'pending'`);
        const pendingWd = coord._oneOrNull(
          `SELECT COUNT(*) AS n FROM schedule
            WHERE state = 'pending' AND kind = 'watchdog'`);
        await cache.flush();
        return json(200, {
          state: state.known ? state.state : null,
          known: state.known, absent: state.absent,
          verified: state.verified,
          updatedAt: state.updatedAt,
          authorizationRef: state.authorizationRef,
          // CONTAINMENT v3: the durable physical-stop record,
          // projected beside the enum — three facts kept separate
          // (design v3 §2.3). stopStatus null (or "unverified")
          // under CHAIN_STOPPED means the physical stop is NOT
          // verified; never infer it from the enum.
          stopStatus: state.stopStatus,
          stopVerifiedAt: state.stopVerifiedAt,
          stopVerifyAction: state.stopVerifyAction,
          stopArmedBefore: state.stopArmedBefore,
          stopArmedAfter: state.stopArmedAfter,
          stopVerifyAttempts: state.stopVerifyAttempts,
          // CONTAINMENT v4: episode bookkeeping (design v4 §4)
          // and the derived CURRENT PHYSICAL CONFIDENCE (§2) —
          // derived from the stored record and THIS request's
          // own registration read; a failed read is passed as
          // failed, never collapsed to "absent".
          stopEpisodeId: state.stopEpisodeId,
          stopEpisodeExhausted: state.stopEpisodeExhausted,
          prevEpisodeId: state.prevEpisodeId,
          prevEpisodeAttempts: state.prevEpisodeAttempts,
          prevEpisodeExhausted: state.prevEpisodeExhausted,
          prevEpisodeClosedAt: state.prevEpisodeClosedAt,
          stopConfidence: coord.containmentConfidence(
            armedReadFailed ? { kind: "failed" }
              : { kind: "value", armed: armedAt }),
          alarm: { armedAt,
            pendingSchedule: pending ? pending.n : null,
            pendingWatchdog: pendingWd ? pendingWd.n : null },
        });
      }
      if (url.pathname === "/internal/d6/containment" && request.method === "POST") {
        // CONTAINMENT transitions (Phase B containment design v3):
        // the ONLY writer of the containment state. Same operator
        // fence as every operator surface above. The request
        // contract is a CLOSED ALLOWLIST enforced HERE: permitted
        // keys are exactly { action, authorizationRef, reason };
        // action must be one of contain_drive | stop_chain |
        // verify_chain_stop | clear; authorizationRef is a
        // required nonblank string bounded at 2000 chars; reason
        // is optional in the envelope and REQUIRED (nonblank,
        // <= 2000 chars) for clear — the restoration discipline of
        // design v3 §5, enforced again inside the coordinator.
        // The coordinator then enforces the transition table
        // itself (coordinator.mjs applyContainmentTransition):
        // refused transitions write nothing; write failures throw
        // to the class catch (HTTP 500) — never a silent success;
        // a stop_chain whose physical act cannot be verified
        // returns outcome "rejected" / containment_stop_unverified
        // with the state left at CHAIN_STOPPED and the stop record
        // at 'unverified'. NOT halt-fenced: containment is the
        // stop that must remain reachable while generation is
        // halted (and while it is not).
        if (request.headers.get("x-opalreader-operator-admitted") !== "1")
          return json(403, { error: "migration_operator_required" });
        const reject = (reason) => json(200, { outcome: "rejected", reason });
        const body = await request.json().catch(() => null);
        if (!body || typeof body !== "object" || Array.isArray(body))
          return reject("containment_request_key_not_allowed");
        const ALLOWED_KEYS = ["action", "authorizationRef", "reason"];
        for (const key of Object.keys(body)) {
          if (!ALLOWED_KEYS.includes(key))
            return reject("containment_request_key_not_allowed");
        }
        if (!["contain_drive", "stop_chain", "verify_chain_stop",
              "clear"].includes(body.action))
          return reject("containment_action_not_allowed");
        if (typeof body.authorizationRef !== "string" ||
            body.authorizationRef.trim().length === 0 ||
            body.authorizationRef.length > 2000)
          return reject("authorization_ref_required");
        if (body.reason !== undefined &&
            (typeof body.reason !== "string" ||
             body.reason.length > 2000))
          return reject("containment_reason_invalid");
        const cache = await this._cache();
        const coord = new GenerationCoordinator(this.state, d6HostEnv(this.env, cache));
        const result = await coord.applyContainmentTransition(
          body.action, body.authorizationRef.trim(),
          { reason: typeof body.reason === "string"
              ? body.reason.trim() : undefined });
        await cache.flush();
        return json(200, result);
      }
      if (url.pathname === "/internal/d6/repair-evaluate" && request.method === "POST") {
        // W-4 TRACK A / A-1: the alarm-repair maintenance route —
        // the ONLY invocation source for the shared repair
        // evaluation in this build (no scheduler wiring exists;
        // A-3 is separately gated). Same operator fence as every
        // operator surface above (operator-admitted stamp required
        // at this class gate). The request contract is a CLOSED
        // ALLOWLIST enforced HERE, before any state is read for
        // action: evaluate_repair takes exactly { action,
        // authorizationRef, reason }; acknowledge_repair_counter
        // takes exactly those plus { boundaryEventId }, which
        // must be a true integer (a numeric string is refused —
        // Rowan's final ruling §5). Both text fields are required,
        // nonblank after trimming, and bounded at 2000 chars; the
        // recorded source is stamped HERE ("operator-route"),
        // never taken from the caller's body. Outcomes: a recorded
        // policy decline returns 200 with the evaluation record;
        // EVERY execution-error outcome (error:*) returns 500
        // with the record's audit identity (implementation
        // review I-C4 — an unreadable prerequisite is not a
        // successful policy evaluation). An ambiguous response
        // is NOT authority to retry: the unresolved intent in
        // the record is the state to be dispositioned.
        if (request.headers.get("x-opalreader-operator-admitted") !== "1")
          return json(403, { error: "migration_operator_required" });
        const reject = (reason) =>
          json(400, { error: "repair_body_not_allowed", reason });
        const body = await request.json().catch(() => null);
        if (!body || typeof body !== "object" || Array.isArray(body))
          return reject("repair_body_not_allowed");
        const isAck = body.action === "acknowledge_repair_counter";
        if (body.action !== "evaluate_repair" && !isAck)
          return reject("repair_action_not_allowed");
        const ALLOWED_KEYS = isAck
          ? ["action", "authorizationRef", "reason", "boundaryEventId"]
          : ["action", "authorizationRef", "reason"];
        for (const key of Object.keys(body)) {
          if (!ALLOWED_KEYS.includes(key))
            return reject("repair_body_not_allowed");
        }
        if (typeof body.authorizationRef !== "string" ||
            body.authorizationRef.trim().length === 0 ||
            body.authorizationRef.length > 2000)
          return reject("authorization_ref_required");
        if (typeof body.reason !== "string" ||
            body.reason.trim().length === 0 ||
            body.reason.length > 2000)
          return reject("repair_reason_required");
        if (isAck && (typeof body.boundaryEventId !== "number" ||
            !Number.isInteger(body.boundaryEventId) ||
            body.boundaryEventId <= 0))
          return reject("acknowledgment_boundary_invalid");
        const cache = await this._cache();
        const coord = new GenerationCoordinator(this.state, d6HostEnv(this.env, cache));
        const stamped = { source: "operator-route",
          authorizationRef: body.authorizationRef.trim(),
          reason: body.reason.trim() };
        const result = isAck
          ? coord.acknowledgeRepairCounter(
              { ...stamped, boundaryEventId: body.boundaryEventId })
          : await coord.evaluateAlarmRepair(stamped);
        await cache.flush();
        if (typeof result.outcome === "string" &&
            result.outcome.startsWith("error:"))
          return json(500,
            { error: "repair_evaluation_failed", ...result });
        return json(200, result);
      }
      if (url.pathname === "/internal/d6/repair-status" && request.method === "GET") {
        // W-4 TRACK A / A-1: the read-only repair audit surface.
        // Same operator fence as every operator surface above.
        // The handler performs zero writes and no wake: it
        // reports the authoritative strike derivation (never the
        // projection alone), the unresolved intents, and a
        // bounded page of recent repair events. Missing or
        // unverified repair state is reported, never repaired
        // here: the coordinator is constructed through the
        // read-surface pattern (ASSUME_SCHEMA), so this handler
        // cannot create the repair tables or the singleton
        // (implementation review I-C4). Object initialization
        // occurring through other paths remains separately
        // accounted (addendum §5.5).
        if (request.headers.get("x-opalreader-operator-admitted") !== "1")
          return json(403, { error: "migration_operator_required" });
        const cache = await this._cache();
        const coord = new GenerationCoordinator(this.state,
          { ...d6HostEnv(this.env, cache), ASSUME_SCHEMA: true });
        const result = coord.repairStatus();
        await cache.flush();
        return json(200, result);
      }
      if (url.pathname === "/internal/d6-scheduler-tick" && request.method === "POST") {
        // A-3: the scheduler tick — the ONLY entry to the tick
        // algorithm. It carries NO operator-admitted requirement:
        // its authority is its reachability. This class's fetch is
        // reachable only through a direct stub call from this
        // script's own scheduled() export (the public dispatcher
        // refuses every /internal/* path before routing, whatever
        // credentials ride along), and the class gate above has
        // already required the internal header + production scope,
        // exactly as for /internal/execute. The body is data, not
        // authority: { cron, scheduledTime } — the tick verifies
        // the cron expression and the watermark itself, inside the
        // admission stretch. Execution-error outcomes return 500
        // with the tick record (the repair route's precedent).
        const body = await request.json().catch(() => null);
        const result = await this._schedulerTick(
          body && typeof body === "object" && !Array.isArray(body)
            ? body : {});
        if (typeof result.outcome === "string" &&
            result.outcome.startsWith("error:"))
          return json(500, { error: "scheduler_tick_failed",
            ...result });
        return json(200, result);
      }
      if (url.pathname === "/internal/d6/scheduler-activation" && request.method === "POST") {
        // A-3: scheduler activation transitions — the ONLY writer
        // of the scheduler activation state and the WAIT hold.
        // Same operator fence as every operator surface above.
        // The request contract is a CLOSED ALLOWLIST enforced
        // HERE: exactly { action, authorizationRef, reason };
        // action one of activate | deactivate |
        // note_trigger_removed | set_wait_hold | clear_wait_hold;
        // authorizationRef AND reason are BOTH required nonblank
        // on EVERY action (the WAIT-hold discipline of addendum
        // §C5 / ruling I5 rides the same contract), each bounded
        // at 2000 chars. Policy declines return 200 with the
        // outcome record; execution errors return 500.
        if (request.headers.get("x-opalreader-operator-admitted") !== "1")
          return json(403, { error: "migration_operator_required" });
        const reject = (reason) =>
          json(200, { outcome: "rejected", reason });
        const body = await request.json().catch(() => null);
        if (!body || typeof body !== "object" || Array.isArray(body))
          return reject("scheduler_request_key_not_allowed");
        const ALLOWED_KEYS = ["action", "authorizationRef", "reason"];
        for (const key of Object.keys(body)) {
          if (!ALLOWED_KEYS.includes(key))
            return reject("scheduler_request_key_not_allowed");
        }
        if (!["activate", "deactivate", "note_trigger_removed",
              "set_wait_hold", "clear_wait_hold"].includes(body.action))
          return reject("scheduler_action_not_allowed");
        if (typeof body.authorizationRef !== "string" ||
            body.authorizationRef.trim().length === 0 ||
            body.authorizationRef.length > 2000)
          return reject("authorization_ref_required");
        if (typeof body.reason !== "string" ||
            body.reason.trim().length === 0 ||
            body.reason.length > 2000)
          return reject("scheduler_reason_required");
        const result = this._schedulerActivation({
          action: body.action,
          authorizationRef: body.authorizationRef.trim(),
          reason: body.reason.trim() });
        if (typeof result.outcome === "string" &&
            result.outcome.startsWith("error:"))
          return json(500, { error: "scheduler_activation_failed",
            ...result });
        return json(200, result);
      }
      if (url.pathname === "/internal/d6/scheduler-status" && request.method === "GET") {
        // A-3: the read-only scheduler status surface. Same
        // operator fence as every operator surface above. The
        // handler performs zero writes (see _schedulerStatus):
        // dormant or missing scheduler state reports as absent,
        // never created or repaired here.
        if (request.headers.get("x-opalreader-operator-admitted") !== "1")
          return json(403, { error: "migration_operator_required" });
        return json(200, this._schedulerStatus());
      }
      if (url.pathname === "/internal/d6/seed-storage" && request.method === "POST") {
        // CORRECTION 2 + G2 HARDENING: the storage seed. Beyond the
        // class gate above (internal header + production scope),
        // this route requires the OPERATOR-ADMITTED STAMP — the
        // public entry stamps it only after the migration-operator
        // credential has been presented, and overwrites any
        // client-supplied value unconditionally, so the stamp
        // cannot be forged through public routing and the internal
        // header alone does not suffice. The service then fences
        // the seed itself (halt-only, figureless, worker recount,
        // zero-tolerance cross-check) and the store records
        // provenance.
        if (request.headers.get("x-opalreader-operator-admitted") !== "1")
          return json(403, { error: "migration_operator_required" });
        const cache = await this._cache();
        const coord = new GenerationCoordinator(this.state, d6HostEnv(this.env, cache));
        const body = await request.json().catch(() => null);
        const result = await d6Service(coord, d6HostEnv(this.env, cache))
          .seedStorageBase(body);
        await cache.flush();
        return json(200, result);
      }
    } catch (e) {
      if (e instanceof GenerationHaltedError)
        return json(423, { error: e.code, detail: e.message });
      return json(500, { error: String(e && e.message || e) });
    }
    // Everything else (the API dispatch, /internal/execute, the
    // D3-1 migration fence) is the production surface, verbatim.
    return super.fetch(request);
  }

  async _execute(message) {
    // Halt layer 2 (the queue handler is layer 1, the provider seam
    // layer 3): a hand-delivered internal execute refuses while the
    // flag is set.
    assertGenerationEnabled(this.env);
    if (!message || !message.grantId || !message.jobId || !Array.isArray(message.occurrences))
      return json(422, { error: "invalid_grant_message" });
    const cache = await this._cache();
    await cache.hydrateKeys(this._jobCacheKeys(message.jobId));
    const coord = new GenerationCoordinator(this.state, d6HostEnv(this.env, cache));
    const executor = createD6Executor({
      coord,
      store: createGenStore(coord),
      providers: createProviderAdapters(this.env),
      flushStore: createFlushStore(this.env.OPALREADER_STORAGE, { keyPrefix: "" }),
      cache,
      workSource: createD6WorkSource(coord, { cache }),
      consumerId: this.env.EXECUTOR_CONSUMER_ID || "opalreader-v2-prod-d6",
    });
    const result = await executor.handleMessage(message);
    await cache.flush();
    return json(200, result);
  }

  // The recorder's clock: the coordinator's own seam
  // (GenerationCoordinator._now(), coordinator.mjs) — env.now()
  // when a harness provides one, Date.now() in production, where
  // the platform env carries no now function. Testable, with
  // production semantics unchanged (Rowan's clock ruling).
  _drivePassNow() {
    return typeof this.env.now === "function"
      ? this.env.now() : Date.now();
  }

  // One best-effort note on the recorder-health channel (DO
  // key-value storage, DRIVE_PASS_HEALTH_KEY). Never throws: the
  // channel is itself best-effort, and its failure is part of the
  // residual blind spot the spec names (a pass whose SQL write AND
  // health note both fail leaves no trace of its recording
  // failure; the handler's absence is still distinguishable from a
  // recorded failure whenever at least one channel works).
  async _noteDrivePassHealth({ failure = null, recordedAt = null } = {}) {
    try {
      const rawPrev = await this.state.storage.get(DRIVE_PASS_HEALTH_KEY);
      // Project the previously stored value onto the five known
      // fields before carrying anything forward: a corrupt or
      // foreign-written health object must not smuggle extra keys
      // (or hostile values) into this write.
      const prev = (rawPrev && typeof rawPrev === "object" &&
                    !Array.isArray(rawPrev)) ? rawPrev : {};
      const health = {
        recordingFailures:
          typeof prev.recordingFailures === "number" &&
          prev.recordingFailures >= 0 ? prev.recordingFailures : 0,
        lastFailureAt:
          typeof prev.lastFailureAt === "number" ? prev.lastFailureAt : null,
        lastFailureStep:
          typeof prev.lastFailureStep === "string" ? prev.lastFailureStep : null,
        lastFailureName:
          sanitizeDrivePassName(prev.lastFailureName),
        lastRecordedAt:
          typeof prev.lastRecordedAt === "number" ? prev.lastRecordedAt : null };
      if (failure) {
        health.recordingFailures += 1;
        health.lastFailureAt = this._drivePassNow();
        health.lastFailureStep = failure.step;
        health.lastFailureName =
          sanitizeDrivePassName(failure.name);
      }
      if (recordedAt !== null) health.lastRecordedAt = recordedAt;
      await this.state.storage.put(DRIVE_PASS_HEALTH_KEY, health);
    } catch { /* best-effort by design; see the spec §5 */ }
  }

  // Record one alarm pass in d6_drive_passes. NEVER throws: any
  // failure of the recording steps (DDL, serialization, insert,
  // prune) is noted on the health channel and discarded here, so a
  // recorder fault can never break the alarm chain, mask the
  // original drive error, or alter any outcome — the shipped
  // best-effort noting discipline (driveOnce's noteHaltObservation
  // call, service.mjs). The getAlarm() readback is defined as
  // nullable (armed_after), so its failure records NULL and is NOT
  // counted as a recording failure. The recorder performs no
  // setAlarm, no schedule read or write, and no wake: it observes
  // the chain and does not participate in it.
  //
  // A-3 additions (addendum §C2/§C6; ruling I6): the row carries
  // entry_kind ('native_alarm' | 'scheduled_fallback'; NULL only
  // for pre-A-3 rows), admitted_at (guard acquisition; the
  // pre-existing `at` stays handler entry), exit_armed and
  // assurance_fired from the owner-exit assurance, and seq from
  // the INDEPENDENTLY DURABLE monotonic counter in
  // d6_recorder_meta — incremented inside the SAME transaction as
  // the row write, never derived from the prunable table, never
  // reused (pruning preserves gaps). When the exiting pass took
  // its own exit read (rec.exitArmed present), that read IS the
  // armed_after value: it is the final registration the exiting
  // pass itself observed, and a second read here could observe a
  // newer registration the pass did not leave. Returns the new
  // row's id, or null when recording failed.
  async _recordDrivePass(rec) {
    let step = "ddl";
    let passId = null;
    try {
      this._ensureA3Schema();
      const sql = this.state.storage.sql;
      sql.exec(DRIVE_PASS_SCHEMA);
      step = "serialize";
      const ser = serializeDrivePassOutcomes(rec.outcomes);
      step = "getalarm";
      let armedAfter = null;
      if (rec.exitArmed !== undefined) {
        armedAfter = typeof rec.exitArmed === "number"
          ? rec.exitArmed : null;
      } else {
        try {
          const armed = await this.state.storage.getAlarm();
          armedAfter = typeof armed === "number" ? armed : null;
        } catch { armedAfter = null; }
      }
      step = "insert";
      this.state.storage.transactionSync(() => {
        sql.exec(
          `INSERT OR IGNORE INTO d6_recorder_meta (key, value)
             VALUES ('seq_counter', 0)`);
        sql.exec(
          `UPDATE d6_recorder_meta SET value = value + 1
             WHERE key = 'seq_counter'`);
        const seqRows = sql.exec(
          `SELECT value FROM d6_recorder_meta
             WHERE key = 'seq_counter'`).toArray();
        const seq = seqRows.length ? seqRows[0].value : null;
        sql.exec(
          `INSERT INTO d6_drive_passes
             (at, finished_at, stage, drive_invoked, outcomes_json,
              outcomes_truncated, error_name, error_message,
              armed_after, entry_kind, seq, admitted_at, exit_armed,
              assurance_fired)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          rec.at, this._drivePassNow(), rec.stage,
          rec.driveInvoked ? 1 : 0, ser.json, ser.truncated,
          sanitizeDrivePassName(rec.errorName),
          scrubDrivePassText(rec.errorMessage, DRIVE_PASS_ERROR_CAP),
          armedAfter,
          typeof rec.entryKind === "string" ? rec.entryKind : null,
          seq,
          typeof rec.admittedAt === "number" ? rec.admittedAt : null,
          typeof rec.exitArmed === "number" ? rec.exitArmed : null,
          rec.assuranceFired ? 1 : 0);
        const idRows = sql.exec(
          `SELECT last_insert_rowid() AS id`).toArray();
        passId = idRows.length ? idRows[0].id : null;
      });
    } catch (e) {
      await this._noteDrivePassHealth({ failure: {
        step, name: e && e.name ? String(e.name) : "Error" } });
      return null;
    }
    await this._noteDrivePassHealth(
      { recordedAt: this._drivePassNow() });
    step = "prune";
    try {
      this._pruneDrivePasses();
    } catch (e) {
      await this._noteDrivePassHealth({ failure: {
        step, name: e && e.name ? String(e.name) : "Error" } });
    }
    return passId;
  }

  // Retention prune (addendum §C6): the newest DRIVE_PASS_RETENTION
  // rows are kept, EXCEPT that a row which could still form part
  // of a qualifying RC-2 pair for an UNRESOLVED repair intent is
  // never pruned: stage complete, qualifying-native (entry_kind
  // 'native_alarm', or NULL kind at/below the migration
  // watermark), handler-entry and completion ordering satisfied
  // against the intent's completion record, and a seq-adjacent
  // neighbour row that is itself complete, qualifying-native, and
  // completion-ordered. Pruning therefore can never manufacture
  // or destroy RC-2 adjacency. When the repair tables do not
  // exist yet (no evaluation has ever run), the plain count prune
  // applies — there is no intent anything could qualify for.
  _pruneDrivePasses() {
    const sql = this.state.storage.sql;
    const repairTables = sql.exec(
      `SELECT name FROM sqlite_master WHERE type = 'table'
         AND name = 'd6_repair_events'`).toArray();
    if (repairTables.length === 0) {
      sql.exec(
        `DELETE FROM d6_drive_passes
          WHERE id NOT IN
            (SELECT id FROM d6_drive_passes
              ORDER BY id DESC LIMIT ?)`,
        DRIVE_PASS_RETENTION);
      return;
    }
    const nativeQualified = (alias) =>
      `(${alias}.entry_kind = 'native_alarm'
        OR (${alias}.entry_kind IS NULL
            AND ${alias}.id <= COALESCE(
              (SELECT value FROM d6_recorder_meta
                WHERE key = 'migration_watermark'), -1)))`;
    const completionAt = (intentAlias) =>
      `(SELECT MIN(c.at) FROM d6_repair_events c
         WHERE c.kind = 'completion'
           AND CAST(json_extract(c.detail_json, '$.intentId')
                 AS INTEGER) = ${intentAlias}.id)`;
    sql.exec(
      `DELETE FROM d6_drive_passes
        WHERE id NOT IN
          (SELECT id FROM d6_drive_passes
            ORDER BY id DESC LIMIT ?)
          AND NOT EXISTS (
            SELECT 1 FROM d6_repair_events intent
            WHERE intent.kind = 'intent'
              AND NOT EXISTS (
                SELECT 1 FROM d6_repair_events d
                WHERE d.kind = 'discharge'
                  AND CAST(json_extract(d.detail_json, '$.intentId')
                        AS INTEGER) = intent.id)
              AND NOT EXISTS (
                SELECT 1 FROM d6_repair_events a
                WHERE a.kind = 'acknowledgment'
                  AND CAST(json_extract(a.detail_json,
                        '$.boundaryEventId') AS INTEGER) >= intent.id)
              AND EXISTS (
                SELECT 1 FROM d6_repair_events c0
                WHERE c0.kind = 'completion'
                  AND CAST(json_extract(c0.detail_json, '$.intentId')
                        AS INTEGER) = intent.id)
              AND d6_drive_passes.stage = 'complete'
              AND ${nativeQualified("d6_drive_passes")}
              AND d6_drive_passes.seq IS NOT NULL
              AND d6_drive_passes.id > COALESCE(CAST(
                    json_extract(intent.detail_json,
                      '$.latestPassIdBefore') AS INTEGER), 0)
              AND d6_drive_passes.at > intent.at
              AND d6_drive_passes.at > ${completionAt("intent")}
              AND EXISTS (
                SELECT 1 FROM d6_drive_passes nb
                WHERE (nb.seq = d6_drive_passes.seq - 1
                       OR nb.seq = d6_drive_passes.seq + 1)
                  AND nb.stage = 'complete'
                  AND ${nativeQualified("nb")}
                  AND nb.at > intent.at
                  AND nb.at > ${completionAt("intent")})
          )`,
      DRIVE_PASS_RETENTION);
  }

  // A-3 schema ensure — LAZY and idempotent (see the constructor
  // note): creates the scheduler tables and the recorder meta
  // table, seeds the scheduler singleton, and runs the recorder
  // migration. The migration (addendum §C6) is ONE synchronous
  // transaction: add the A-3 columns if absent, backfill seq for
  // pre-migration rows in id order CONTINUING the durable counter
  // (existing seqs are never renumbered; reruns recompute the
  // identical result), and record the migration watermark (the
  // greatest pass id at migration). A crash before commit rolls
  // the whole migration back; the next ensure redoes it
  // identically. Once the watermark row exists, the migration
  // never runs again — rows a rolled-back build later writes
  // with NULL seq/kind stay NULL and fail the RC-2 derivation
  // closed, by design. A failure is captured (this._a3EnsureError)
  // and retried on the next use; scheduler paths fail closed
  // while unready, and the recorder notes its own failure on the
  // health channel as it always has.
  _ensureA3Schema() {
    if (this._a3Ensured) return true;
    const sql = this.state.storage.sql;
    try {
      sql.exec(SCHEDULER_SCHEMA);
      sql.exec(SCHEDULER_STATE_SEED);
      this.state.storage.transactionSync(() => {
        sql.exec(DRIVE_PASS_SCHEMA);
        const additions = [
          ["entry_kind", "TEXT"], ["seq", "INTEGER"],
          ["admitted_at", "INTEGER"], ["exit_armed", "INTEGER"],
          ["assurance_fired", "INTEGER NOT NULL DEFAULT 0"],
        ];
        for (const [col, decl] of additions) {
          try {
            sql.exec(
              `ALTER TABLE d6_drive_passes ADD COLUMN ${col} ${decl}`);
          } catch (e) {
            if (!/duplicate column/i.test(
                  String(e && e.message || e))) throw e;
          }
        }
        const wm = sql.exec(
          `SELECT value FROM d6_recorder_meta
             WHERE key = 'migration_watermark'`).toArray();
        if (wm.length === 0) {
          const maxRows = sql.exec(
            `SELECT COALESCE(MAX(id), 0) AS m FROM d6_drive_passes`
          ).toArray();
          const watermark = maxRows.length
            ? Number(maxRows[0].m) : 0;
          sql.exec(
            `INSERT OR IGNORE INTO d6_recorder_meta (key, value)
               VALUES ('seq_counter', 0)`);
          const counterRows = sql.exec(
            `SELECT value FROM d6_recorder_meta
               WHERE key = 'seq_counter'`).toArray();
          let counter = counterRows.length
            ? Number(counterRows[0].value) : 0;
          const legacy = sql.exec(
            `SELECT id FROM d6_drive_passes
               WHERE seq IS NULL ORDER BY id`).toArray();
          for (const row of legacy) {
            counter += 1;
            sql.exec(
              `UPDATE d6_drive_passes SET seq = ? WHERE id = ?`,
              counter, row.id);
          }
          sql.exec(
            `UPDATE d6_recorder_meta SET value = ?
               WHERE key = 'seq_counter'`, counter);
          sql.exec(
            `INSERT INTO d6_recorder_meta (key, value)
               VALUES ('migration_watermark', ?)`, watermark);
        }
      });
      this._a3Ensured = true;
      this._a3EnsureError = null;
      return true;
    } catch (e) {
      this._a3EnsureError = e;
      return false;
    }
  }

  // The pass guard (amended design §3, as corrected by addendum
  // §C2): a per-instance, NON-EXPIRING promise chain. Acquisition
  // is a synchronous check-and-set; release transfers ownership
  // to the longest-waiting waiter inside the same synchronous
  // stretch — atomic transfer, no gap a third entry can slip
  // into, no waiter bypass. There is no guard timeout (a timeout
  // would recreate the discarded-delivery problem the guard
  // exists to prevent). The holder record is evidence for the
  // ACTIVE_ENTRY classification, never a durable lock.
  _passGuard() {
    if (!this._passGuardState)
      this._passGuardState = { holder: null, waiters: [] };
    return this._passGuardState;
  }

  _passGuardTryAcquire(kind, tickIdentity = null) {
    const g = this._passGuard();
    if (g.holder) return null;
    const token = { kind, tickIdentity,
      admittedAt: this._drivePassNow() };
    g.holder = token;
    return token;
  }

  _passGuardWaitAcquire(kind) {
    const immediate = this._passGuardTryAcquire(kind, null);
    if (immediate) return Promise.resolve(immediate);
    const g = this._passGuard();
    return new Promise((resolve, reject) => {
      g.waiters.push({ resolve, reject, kind });
    });
  }

  _passGuardRelease(token) {
    const g = this._passGuard();
    if (g.holder !== token) return;
    g.holder = null;
    const next = g.waiters.shift();
    if (next) {
      const waiterToken = { kind: next.kind, tickIdentity: null,
        admittedAt: this._drivePassNow() };
      g.holder = waiterToken;
      next.resolve(waiterToken);
    }
  }

  // Owner-exit collision assurance (addendum §C2), narrowly
  // triggered: ONE getAlarm() read at pass exit; the coordinator's
  // existing _armAlarm() is called ONLY IF pending schedule rows
  // exist AND the read returns null (a registration was consumed
  // during the pass, or never survived it). On a healthy pass the
  // read returns the numeric registration and NOTHING is written —
  // native registration behavior is preserved exactly. A failed
  // read or a failed _armAlarm() THROWS out of this method into
  // the exit path's capture, which notes it as an ASSURANCE
  // failure in the scheduler event stream — visible, and
  // distinguished from recorder failures (ruling I2), which
  // live on the recorder-health channel this note never
  // touches; no restoration is claimed from a failed assurance.
  async _exitAssurance(rec) {
    let armed = null;
    try {
      const a = await this.state.storage.getAlarm();
      armed = typeof a === "number" ? a : null;
    } catch (e) {
      rec.exitArmed = null;
      rec.assuranceFired = false;
      throw e;
    }
    rec.exitArmed = armed;
    rec.assuranceFired = false;
    if (armed !== null) return;
    const pending = this.state.storage.sql.exec(
      `SELECT COUNT(*) AS n FROM schedule WHERE state = 'pending'`
    ).toArray();
    if (!pending.length || !(pending[0].n > 0)) return;
    // _armAlarm() reads only the schedule table and storage; the
    // cache seams in its host env are unused on this path.
    const coord = new GenerationCoordinator(this.state,
      d6HostEnv(this.env, null));
    await coord._armAlarm();
    rec.assuranceFired = true;
  }

  async _noteSchedulerAssuranceFailure(e) {
    // The scheduler event stream is the assurance failure's
    // channel — deliberately NOT the recorder-health channel:
    // ruling I2 requires assurance failures DISTINGUISHED from
    // recorder failures, and the recorder-health contract
    // (pinned by the standing suites) counts recorder failures
    // only; a getAlarm fault must never increment it.
    try {
      this._schedulerEvent("assurance_failed", {
        name: e && e.name ? String(e.name) : "Error",
        message: scrubDrivePassText(
          e && e.message ? String(e.message) : String(e),
          DRIVE_PASS_ERROR_CAP),
      });
    } catch { /* best-effort visibility; nothing else claimed */ }
  }

  // Scheduler audit events (append-only). Best-effort at the
  // call sites that must never throw (the pass exit path); the
  // activation and tick paths call it inside their own error
  // discipline.
  _schedulerEvent(kind, detail = {}) {
    this.state.storage.sql.exec(
      `INSERT INTO d6_scheduler_events (at, kind, detail_json)
       VALUES (?, ?, ?)`,
      this._drivePassNow(), kind, JSON.stringify(detail ?? {}));
  }

  _readSchedulerState() {
    try {
      const rows = this.state.storage.sql.exec(
        `SELECT * FROM d6_scheduler_state WHERE id = 1`).toArray();
      return rows.length ? rows[0] : null;
    } catch { return null; }
  }

  _readActivePass() {
    try {
      const rows = this.state.storage.sql.exec(
        `SELECT * FROM d6_active_pass WHERE id = 1`).toArray();
      return rows.length ? rows[0] : null;
    } catch { return null; }
  }

  // Owner-safe clearing (ruling I7): a pass clears the durable
  // active-pass record ONLY when the record's identity is its
  // own — an old invocation can never clear a newer owner's
  // evidence. Returns true when this call cleared the record.
  // (The two sanctioned non-owner removals are the admission
  // supersede, which records the interruption, and nothing else:
  // deactivation in particular never clears the record.)
  _clearActivePass(identity) {
    const sql = this.state.storage.sql;
    const before = sql.exec(
      `SELECT identity FROM d6_active_pass WHERE id = 1`).toArray();
    const owned = before.length > 0 &&
      before[0].identity === identity;
    if (!owned) return false;
    sql.exec(
      `DELETE FROM d6_active_pass WHERE id = 1 AND identity = ?`,
      identity);
    return true;
  }

  // The tick predicate (addendum §C4 as corrected by ruling I4):
  // an ordered decision table, first match wins. The table is
  // TOTAL and deterministic — rows 7a and 8b are the I4 additions
  // (pending work not yet overdue with a verified absent alarm;
  // overdue work whose registration is only slightly past due and
  // consistent with earliestDue), row 9's anomalous test applies
  // in any pending state, and row 12 is the final conservative
  // report-only catch-all (UNMATCHED): any observation combination
  // not covered above classifies UNMATCHED and never intervenes.
  // Completion evidence uses the latest QUALIFYING COMPLETE pass
  // (a complete pass with finished_at >= earliestDue), per I4 —
  // never merely the latest row. All comparisons use the
  // observation finish time (obs.finishedAt) as "now", so the
  // classification is a pure function of the observations.
  // Classifications PASS_WITHOUT_PROGRESS / ANOMALOUS /
  // NO_SCHEDULE_OBSERVED / ABSENT_NOT_OVERDUE / DELAYED_ARMED /
  // UNMATCHED are report-only: A-3 does not intervene in them.
  _classifyTick(obs) {
    const now = obs.finishedAt;
    const overdue = obs.earliestDue !== null &&
      obs.earliestDue <= now - SCHEDULER_GRACE_MS;
    // 1. A pass is in flight on THIS instance (amended design
    // §8: ACTIVE_ENTRY is guardHeld, exactly). The durable
    // active-pass record never classifies and never blocks: it
    // is evidence (design §3) — a later admission supersedes a
    // stale record and records the interruption (§C7).
    if (obs.guardHeld)
      return { classification: "ACTIVE_ENTRY", reason: "guard_held" };
    // 2. A failed observation is never an absence.
    if (obs.armedReadFailed || obs.observationFailed)
      return { classification: "READ_FAILURE",
        reason: obs.armedReadFailed ? "getalarm_failed"
          : obs.observationFailed };
    // 3. Eligibility family (addendum §C4 row 3 + §C5 + amended
    // §8): activation, epoch, watermark, cron identity, WAIT
    // hold, containment, generation enablement.
    if (!obs.activationActive)
      return { classification: "INELIGIBLE",
        reason: obs.activationReason || "scheduler_not_active" };
    if (obs.waitHoldActive)
      return { classification: "WAIT_HOLD", reason: "wait_hold_active" };
    if (obs.duplicateWatermark)
      return { classification: "INELIGIBLE",
        reason: "duplicate_or_stale_tick" };
    if (obs.cronMismatch)
      return { classification: "INELIGIBLE", reason: "cron_mismatch" };
    if (!obs.containmentVerified)
      return { classification: "INELIGIBLE",
        reason: "containment_unverified" };
    if (!obs.containmentNormal)
      return { classification: "INELIGIBLE", reason: "contained" };
    if (!obs.generationEnabled)
      return { classification: "INELIGIBLE",
        reason: "generation_not_enabled" };
    // 4/5. No pending WORK rows (the watchdog row is counted
    // separately — rows 4/5 of §C4).
    if (obs.pendingWork === 0) {
      if (obs.watchdogPending)
        return { classification: "HEALTHY_IDLE",
          reason: "watchdog_pending" };
      return { classification: "NO_SCHEDULE_OBSERVED",
        reason: "no_schedule_rows" };
    }
    // Pending work from here; earliestDue is the minimum due over
    // ALL pending rows (the chain's own arming target).
    const armed = obs.armed;
    // 6. Timely registration for not-yet-overdue work.
    if (armed !== null && armed <= obs.earliestDue + SCHEDULER_SKEW_MS &&
        obs.earliestDue > now - SCHEDULER_GRACE_MS)
      return { classification: "ARMED_TIMELY",
        reason: "registration_timely" };
    // 7. A registration exists later than the earliest due (by
    // more than SKEW) but within one watchdog period: the native
    // chain fires at `armed` and processes all due rows.
    if (armed !== null && armed > obs.earliestDue + SCHEDULER_SKEW_MS &&
        armed <= now + SCHEDULER_WATCHDOG_MS &&
        (obs.earliestDue > now - SCHEDULER_GRACE_MS ||
         armed > now - SCHEDULER_GRACE_MS))
      return { classification: "DELAYED_ARMED",
        reason: "registration_delayed" };
    // 7a (I4). Pending work not yet overdue, registration
    // verified absent: report-only — the grace window has not
    // elapsed, and wake paths may still register. (A pending
    // count with NO earliest due is not this row: real pending
    // rows always carry a due time, so that combination is an
    // observation inconsistency and falls to the catch-all.)
    if (armed === null && !overdue && obs.earliestDue !== null)
      return { classification: "ABSENT_NOT_OVERDUE",
        reason: "registration_absent_work_not_overdue" };
    // 8. A complete pass finished at/after the earliest due, yet
    // the work is still pending and the registration is absent
    // or itself overdue: the pass ran and the work did not
    // progress. COVERAGE LIMITATION — report-only (addendum §C4).
    if (overdue && obs.completePassSinceDue &&
        (armed === null || armed <= now))
      return { classification: "PASS_WITHOUT_PROGRESS",
        reason: "complete_pass_without_progress" };
    // 8b (I4). Overdue work whose registration is only slightly
    // past due and consistent with earliestDue (within SKEW):
    // the native chain's firing is imminent-or-just-due; not a
    // verified stall.
    if (overdue && armed !== null &&
        armed <= obs.earliestDue + SCHEDULER_SKEW_MS &&
        armed > now - SCHEDULER_GRACE_MS)
      return { classification: "DELAYED_ARMED",
        reason: "registration_consistent_recently_due" };
    // 9. A registration inconsistent with earliest-due arming.
    if (armed !== null &&
        (armed > obs.earliestDue + SCHEDULER_GRACE_MS ||
         armed > now + SCHEDULER_WATCHDOG_MS))
      return { classification: "ANOMALOUS",
        reason: "registration_inconsistent_with_earliest_due" };
    // 10. Verified absent registration, overdue work, no
    // complete pass since the earliest due: the S-3 shape.
    if (overdue && armed === null && !obs.completePassSinceDue)
      return { classification: "INTERVENE",
        reason: "verified_absent" };
    // 11. A registration whose own due is older than GRACE,
    // overdue work, no complete pass since the earliest due.
    if (overdue && armed !== null &&
        armed <= now - SCHEDULER_GRACE_MS && !obs.completePassSinceDue)
      return { classification: "INTERVENE",
        reason: "overdue_registration" };
    // 12. Final conservative catch-all (I4): report-only.
    return { classification: "UNMATCHED",
      reason: "observation_combination_unmatched" };
  }

  // One tick log row. Non-admitted ticks write at tick end with
  // ON CONFLICT DO NOTHING (a duplicate delivery of a skip tick
  // is idempotent in the log). The ADMITTED tick's row is written
  // inside the admission transaction (action 'fallback_admitted')
  // and completed by _completeTickLog after the pass.
  _writeTickLog(row, { admitted = false } = {}) {
    const sql = this.state.storage.sql;
    const cols = `(at, finished_at, cron, scheduled_time,
      tick_identity, activation_epoch, classification, action,
      reason, drive_pass_id, pass_stage, error_name, error_message)`;
    const vals = [row.at, row.finishedAt ?? null, row.cron ?? null,
      row.scheduledTime ?? null, row.tickIdentity,
      row.epoch ?? null, row.classification, row.action,
      row.reason ?? null, row.drivePassId ?? null,
      row.passStage ?? null,
      sanitizeDrivePassName(row.errorName),
      scrubDrivePassText(row.errorMessage, DRIVE_PASS_ERROR_CAP)];
    if (admitted) {
      sql.exec(`INSERT INTO d6_scheduler_log ${cols}
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, ...vals);
    } else {
      sql.exec(`INSERT INTO d6_scheduler_log ${cols}
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(tick_identity) DO NOTHING`, ...vals);
    }
    sql.exec(
      `DELETE FROM d6_scheduler_log
        WHERE id NOT IN
          (SELECT id FROM d6_scheduler_log
            ORDER BY id DESC LIMIT ?)`,
      SCHEDULER_LOG_RETENTION);
  }

  _completeTickLog(tickIdentity, { finishedAt, drivePassId,
      passStage, action, errorName = null, errorMessage = null }) {
    this.state.storage.sql.exec(
      `UPDATE d6_scheduler_log
         SET finished_at = ?, drive_pass_id = ?, pass_stage = ?,
             action = ?, error_name = ?, error_message = ?
       WHERE tick_identity = ?`,
      finishedAt, drivePassId ?? null, passStage ?? null, action,
      sanitizeDrivePassName(errorName),
      scrubDrivePassText(errorMessage, DRIVE_PASS_ERROR_CAP),
      tickIdentity);
  }

  // The tick (amended design §7; addendum §C3/§C5; ruling I3/I5).
  // Observations first (the getAlarm() read is the LAST async
  // observation); classification is a pure function of them;
  // intervention requires the admission stretch. Returns a result
  // record; execution-error outcomes carry outcome 'error:*' and
  // the route answers 500, per the repair route's precedent.
  async _schedulerTick(body) {
    const startedAt = this._drivePassNow();
    const cron = typeof body?.cron === "string" ? body.cron : null;
    const scheduledTime =
      typeof body?.scheduledTime === "number" &&
      Number.isFinite(body.scheduledTime) ? body.scheduledTime : null;
    const tickIdentity = `${cron}|${scheduledTime}`;
    if (!this._ensureA3Schema()) {
      return { outcome: "error:scheduler_schema_unverified",
        tickIdentity, classification: "READ_FAILURE",
        reason: "scheduler_schema_unverified" };
    }
    const sql = this.state.storage.sql;
    const state = this._readSchedulerState();
    if (!state) {
      return { outcome: "error:scheduler_state_unverified",
        tickIdentity, classification: "READ_FAILURE",
        reason: "scheduler_state_unverified" };
    }
    // ---- Observations (no writes) ----
    let observationFailed = null;
    let pendingRows = [];
    try {
      pendingRows = sql.exec(
        `SELECT kind, due_at FROM schedule WHERE state = 'pending'`
      ).toArray();
    } catch { observationFailed = "schedule_unreadable"; }
    let completePassSinceDue = false;
    let earliestDue = null;
    let pendingWork = 0;
    let watchdogPending = false;
    for (const r of pendingRows) {
      if (r.kind === "watchdog") watchdogPending = true;
      else pendingWork += 1;
      if (typeof r.due_at === "number" &&
          (earliestDue === null || r.due_at < earliestDue))
        earliestDue = r.due_at;
    }
    if (earliestDue !== null) {
      try {
        const rows = sql.exec(
          `SELECT COUNT(*) AS n FROM d6_drive_passes
            WHERE stage = 'complete' AND finished_at >= ?`,
          earliestDue).toArray();
        completePassSinceDue = rows.length > 0 && rows[0].n > 0;
      } catch { observationFailed = "recorder_unreadable"; }
    }
    const containment = readContainmentState(sql);
    // The registration read is the FINAL async observation
    // (addendum §C3): after it, the admission stretch is
    // synchronous through the commit.
    let armed = null;
    let armedReadFailed = false;
    try {
      const a = await this.state.storage.getAlarm();
      armed = typeof a === "number" ? a : null;
    } catch { armedReadFailed = true; }
    const finishedAt = this._drivePassNow();
    const watermark = typeof state.admitted_watermark === "number"
      ? state.admitted_watermark : null;
    const obs = {
      finishedAt,
      guardHeld: this._passGuard().holder !== null,
      armedReadFailed, observationFailed,
      armed,
      activationActive: state.state === "active",
      activationReason: state.state === "active" ? null
        : "scheduler_not_active",
      waitHoldActive: state.wait_hold_active === 1,
      duplicateWatermark: watermark !== null &&
        scheduledTime !== null && scheduledTime <= watermark,
      cronMismatch: cron !== SCHEDULER_CRON_EXPRESSION,
      containmentVerified: containment.verified === true,
      containmentNormal: containment.verified === true &&
        containment.state === "NORMAL",
      generationEnabled: this.env.GENERATION_HALT === "0",
      pendingWork, watchdogPending, earliestDue,
      completePassSinceDue,
    };
    let { classification, reason } = this._classifyTick(obs);
    let admission = null;
    if (classification === "INTERVENE") {
      // ---- Admission stretch (addendum §C3): ONE synchronous
      // stretch after the final async observation. Every
      // condition is re-read synchronously here; the commit
      // (watermark + admission log row + active-pass record) and
      // the guard acquisition complete before any drive effect
      // is initiated. A refusal REPLACES the tick's classification
      // with the stretch's own (the log and the standing
      // classification both record the refusal, never a phantom
      // admission).
      admission = this._admitScheduledTick({
        state, cron, scheduledTime, tickIdentity, startedAt,
        reason });
      if (!admission.admitted) {
        classification = admission.classification;
        reason = admission.reason;
      }
    }
    // Standing classification bookkeeping: the status surface
    // persists the last classification and the PASS_WITHOUT_
    // PROGRESS consecutive-tick count (addendum §C4), escalating
    // once at 48.
    const stallTicks = classification === "PASS_WITHOUT_PROGRESS"
      ? (typeof state.stall_ticks === "number" ? state.stall_ticks : 0) + 1
      : 0;
    try {
      sql.exec(
        `UPDATE d6_scheduler_state
           SET stall_ticks = ?, last_classification = ?,
               last_tick_at = ? WHERE id = 1`,
        stallTicks, classification, finishedAt);
      if (stallTicks === SCHEDULER_STALL_ESCALATION_TICKS)
        this._schedulerEvent("coverage_limitation_escalated", {
          classification, consecutiveTicks: stallTicks,
          tickIdentity });
    } catch { /* bookkeeping never masks the classification */ }
    if (!admission || !admission.admitted) {
      const action = admission && reason === "duplicate_or_stale_tick"
          ? "skip_duplicate"
        : admission && (reason === "activation_changed" ||
            reason === "tick_predates_activation") ? "skip_stale_epoch"
        : admission ? "skip_revalidation"
        : classification === "INELIGIBLE" &&
          reason === "duplicate_or_stale_tick" ? "skip_duplicate"
        : classification === "ACTIVE_ENTRY" ? "skip_guard_held"
        : classification === "HEALTHY_IDLE" ||
          classification === "ARMED_TIMELY" ? "skip_healthy"
        : classification === "INELIGIBLE" &&
          reason === "scheduler_not_active" ? "skip_inactive"
        : classification === "READ_FAILURE" ||
          classification === "WAIT_HOLD" ||
          classification === "INELIGIBLE" ? "skip_ineligible"
        : "report_only";
      try {
        this._writeTickLog({ at: startedAt,
          finishedAt: this._drivePassNow(), cron, scheduledTime,
          tickIdentity,
          epoch: typeof state.epoch === "number" ? state.epoch : null,
          classification, action, reason });
      } catch { /* the classification stands even if logging fails */ }
      return { outcome: "logged", tickIdentity, classification,
        reason, action };
    }
    // ---- Initiation: exactly one fallback pass ----
    const pass = await this._drivePass(ENTRY_KIND_SCHEDULED, {
      entryAt: this._drivePassNow(), token: admission.token,
      tickCtx: { activePassIdentity: admission.activePassIdentity,
        tickIdentity } });
    const passError = pass.error ?? null;
    try {
      this._completeTickLog(tickIdentity, {
        finishedAt: this._drivePassNow(),
        drivePassId: pass.passId, passStage: pass.stage,
        action: passError ? "fallback_failed" : "fallback_completed",
        errorName: passError && passError.name
          ? String(passError.name) : null,
        errorMessage: passError && passError.message
          ? String(passError.message) : null });
    } catch { /* the pass record is the primary evidence */ }
    return { outcome: "admitted", tickIdentity,
      classification: "INTERVENE", reason,
      action: passError ? "fallback_failed" : "fallback_completed",
      drivePassId: pass.passId, passStage: pass.stage };
  }

  // The admission stretch, synchronous end to end (addendum §C3;
  // rulings I3/I5): re-reads activation + epoch, containment,
  // the WAIT hold, watermark eligibility (addendum §C5: strictly
  // greater than the watermark, at/after the epoch's activation,
  // not beyond now + SKEW, the configured cron expression),
  // guard ownership, and the predicate's storage inputs (pending
  // work still present and still overdue; no active-pass record).
  // On success it commits — in ONE transaction — the watermark,
  // the admission log row, and the active-pass record, with the
  // guard acquired inside the same stretch. Any failed check
  // refuses with a named classification and commits nothing.
  _admitScheduledTick({ state, cron, scheduledTime, tickIdentity,
      startedAt, reason }) {
    const sql = this.state.storage.sql;
    const refuse = (classification, reason) =>
      ({ admitted: false, classification, reason });
    const fresh = this._readSchedulerState();
    if (!fresh) return refuse("READ_FAILURE", "state_reread_failed");
    if (fresh.state !== "active" ||
        fresh.epoch !== state.epoch)
      return refuse("INELIGIBLE", "activation_changed");
    // I5: an active OR UNVERIFIABLE hold suppresses admission.
    if (fresh.wait_hold_active === 1)
      return refuse("WAIT_HOLD", "hold_set_before_admission");
    const containment = readContainmentState(sql);
    if (!containment.verified)
      return refuse("INELIGIBLE", "containment_unverified");
    if (containment.state !== "NORMAL")
      return refuse("INELIGIBLE", "contained");
    if (this.env.GENERATION_HALT !== "0")
      return refuse("INELIGIBLE", "generation_not_enabled");
    const now = this._drivePassNow();
    const watermark = typeof fresh.admitted_watermark === "number"
      ? fresh.admitted_watermark : null;
    if (scheduledTime === null ||
        (watermark !== null && scheduledTime <= watermark))
      return refuse("INELIGIBLE", "duplicate_or_stale_tick");
    if (typeof fresh.activated_at === "number" &&
        scheduledTime < fresh.activated_at)
      return refuse("INELIGIBLE", "tick_predates_activation");
    if (scheduledTime > now + SCHEDULER_SKEW_MS)
      return refuse("INELIGIBLE", "tick_from_future");
    if (cron !== SCHEDULER_CRON_EXPRESSION)
      return refuse("INELIGIBLE", "cron_mismatch");
    // A pre-existing active-pass record does NOT refuse the
    // admission (design §3: the record is evidence, never a
    // lock). With this instance's guard free, a standing record
    // names a pass that is dead, finished-without-clearing, or
    // running on an instance being replaced; the admission
    // SUPERSEDES it in the commit below and records the
    // interruption (addendum §C7: a record cleared by a later
    // admission's observation is interrupted_or_unknown, never a
    // safe drain). The superseded pass's own exit clear is
    // identity-matched (ruling I7), so it can never clear THIS
    // admission's record.
    const previousPass = this._readActivePass();
    // Predicate storage inputs, re-read: pending work must still
    // exist and its earliest due must still be overdue.
    let earliestDue = null;
    try {
      const rows = sql.exec(
        `SELECT MIN(due_at) AS due FROM schedule
           WHERE state = 'pending' AND kind != 'watchdog'`).toArray();
      earliestDue = rows.length && typeof rows[0].due === "number"
        ? rows[0].due : null;
    } catch { return refuse("READ_FAILURE", "schedule_reread_failed"); }
    if (earliestDue === null)
      return refuse("UNMATCHED", "pending_work_cleared");
    if (earliestDue > now - SCHEDULER_GRACE_MS)
      return refuse("UNMATCHED", "pending_work_no_longer_overdue");
    // Guard ownership, inside the stretch (try mode).
    const token = this._passGuardTryAcquire(
      ENTRY_KIND_SCHEDULED, tickIdentity);
    if (!token)
      return refuse("ACTIVE_ENTRY", "guard_held");
    const activePassIdentity = `${tickIdentity}@${token.admittedAt}`;
    try {
      this.state.storage.transactionSync(() => {
        sql.exec(
          `UPDATE d6_scheduler_state
             SET admitted_watermark = ? WHERE id = 1`,
          scheduledTime);
        if (previousPass) {
          sql.exec(`DELETE FROM d6_active_pass WHERE id = 1`);
          this._schedulerEvent("active_pass_superseded", {
            previousIdentity: previousPass.identity,
            disposition: "interrupted_or_unknown",
            supersededBy: tickIdentity });
          // If a deactivation had noted THIS record in flight,
          // the supersede resolves its disposition (addendum
          // §C7) — interrupted_or_unknown, never a safe drain.
          if (fresh.in_flight_identity === previousPass.identity)
            sql.exec(
              `UPDATE d6_scheduler_state
                 SET disablement_disposition =
                       'interrupted_or_unknown'
               WHERE id = 1`);
        }
        sql.exec(
          `INSERT INTO d6_active_pass
             (id, identity, entry_kind, admitted_at, tick_identity)
           VALUES (1, ?, ?, ?, ?)`,
          activePassIdentity, ENTRY_KIND_SCHEDULED,
          token.admittedAt, tickIdentity);
        this._writeTickLog({ at: startedAt, finishedAt: null,
          cron, scheduledTime, tickIdentity,
          epoch: fresh.epoch, classification: "INTERVENE",
          action: "fallback_admitted", reason },
          { admitted: true });
      });
    } catch (e) {
      this._passGuardRelease(token);
      return refuse("READ_FAILURE",
        `admission_commit_failed:${e && e.name ? e.name : "Error"}`);
    }
    return { admitted: true, token, activePassIdentity };
  }

  // Scheduler activation transitions (amended design §9; addendum
  // §C5; ruling I5). The route has already enforced the closed
  // allowlist {action, authorizationRef, reason} with both text
  // fields nonblank. Every transition is recorded in the state
  // row AND the append-only events table. Activation NEVER clears
  // the WAIT hold and never touches the recorder, the repair
  // state, containment, or any schedule row. Deactivation is the
  // four-stage disablement (see the deactivate branch): admission
  // stops with the write; an in-flight pass is noted, never
  // cancelled, and its disposition resolves by how its record
  // ends (its own exit = drained_normally; stale or superseded =
  // interrupted_or_unknown); the active-pass record is NOT
  // cleared by deactivation (owner-safe clearing only); trigger
  // removal is platform configuration, recorded afterwards by
  // note_trigger_removed.
  _schedulerActivation({ action, authorizationRef, reason }) {
    if (!this._ensureA3Schema())
      return { outcome: "error:scheduler_schema_unverified",
        action };
    const sql = this.state.storage.sql;
    const now = this._drivePassNow();
    const state = this._readSchedulerState();
    if (!state)
      return { outcome: "error:scheduler_state_unverified", action };
    const reject = (reason) => ({ outcome: "rejected", reason });
    const stamp = (extraSql, params, eventKind, detail) => {
      this.state.storage.transactionSync(() => {
        sql.exec(
          `UPDATE d6_scheduler_state
             SET updated_at = ?, authorization_ref = ?, reason = ?
             ${extraSql} WHERE id = 1`,
          now, authorizationRef, reason, ...params);
        this._schedulerEvent(eventKind, {
          authorizationRef, reason, ...detail });
      });
    };
    if (action === "activate") {
      if (state.state === "active") return reject("already_active");
      const epoch = (typeof state.epoch === "number"
        ? state.epoch : 0) + 1;
      stamp(`, state = 'active', epoch = ?, cron_expression = ?,
              admitted_watermark = NULL, activated_at = ?,
              deactivated_at = NULL, trigger_removed_at = NULL`,
        [epoch, SCHEDULER_CRON_EXPRESSION, now],
        "activated", { epoch, cron: SCHEDULER_CRON_EXPRESSION });
      return { outcome: "applied", action, epoch,
        cron: SCHEDULER_CRON_EXPRESSION,
        waitHoldPreserved: state.wait_hold_active === 1 };
    }
    if (action === "deactivate") {
      if (state.state !== "active") return reject("not_active");
      // The four disablement stages (amended design §9): (1)
      // admission_disabled — this write; (2) in_flight_noted —
      // the durable record's identity, or this instance's guard
      // holder, or none; (3) drained — written by the noted
      // pass's own exit when it clears its record, or HERE,
      // immediately, when nothing is in flight; (4)
      // trigger_removal_confirmed — the separate
      // note_trigger_removed action. The DISPOSITION (addendum
      // §C7) is resolved by how the noted pass's record ends:
      // its own exit clearing it = drained_normally; a stale
      // record or a later admission's supersede =
      // interrupted_or_unknown. While a noted pass is still in
      // flight the disposition is UNRESOLVED (null) — never
      // reported as a safe drain.
      const activePass = this._readActivePass();
      const guard = this._passGuard();
      const inFlight = activePass !== null || guard.holder !== null ||
        guard.waiters.length > 0;
      const identity = activePass ? activePass.identity
        : guard.holder ? `guard:${guard.holder.kind}` : null;
      this.state.storage.transactionSync(() => {
        sql.exec(
          `UPDATE d6_scheduler_state
             SET updated_at = ?, authorization_ref = ?, reason = ?,
                 state = 'inactive', deactivated_at = ?,
                 in_flight_identity = ?,
                 disablement_disposition = ?
             WHERE id = 1`,
          now, authorizationRef, reason, now, identity,
          inFlight ? null : "drained_normally");
        this._schedulerEvent("admission_disabled",
          { authorizationRef, reason });
        this._schedulerEvent("in_flight_noted",
          { identity, inFlight });
        if (!inFlight)
          this._schedulerEvent("drained",
            { identity: null, disposition: "drained_normally" });
      });
      return { outcome: "applied", action,
        disposition: inFlight ? "in_flight_noted"
          : "drained_normally",
        inFlightIdentity: identity };
    }
    if (action === "note_trigger_removed") {
      if (state.state === "active")
        return reject("still_active");
      stamp(`, trigger_removed_at = ?`, [now],
        "trigger_removal_confirmed", {});
      return { outcome: "applied", action, triggerRemovedAt: now };
    }
    if (action === "set_wait_hold") {
      stamp(`, wait_hold_active = 1, wait_hold_declared_at = ?,
              wait_hold_ref = ?`,
        [now, authorizationRef], "wait_hold_set", {});
      return { outcome: "applied", action, waitHoldActive: true,
        declaredAt: now };
    }
    if (action === "clear_wait_hold") {
      stamp(`, wait_hold_active = 0, wait_hold_declared_at = NULL,
              wait_hold_ref = NULL`, [], "wait_hold_cleared", {});
      return { outcome: "applied", action, waitHoldActive: false };
    }
    return reject("scheduler_action_not_allowed");
  }

  // The read-only scheduler status surface (amended design §9):
  // activation state, epoch, watermark, WAIT hold, the durable
  // active-pass record, the standing PASS_WITHOUT_PROGRESS count,
  // recent tick log rows, and recent events. Zero writes: missing
  // tables (a build that has never run a pass, tick, or
  // activation) report as absent, never created here.
  _schedulerStatus() {
    const sql = this.state.storage.sql;
    const readRows = (q, ...params) => {
      try { return sql.exec(q, ...params).toArray(); }
      catch { return null; }
    };
    const stateRows = readRows(
      `SELECT * FROM d6_scheduler_state WHERE id = 1`);
    const state = stateRows && stateRows.length ? stateRows[0] : null;
    const activeRows = readRows(`SELECT * FROM d6_active_pass`);
    const activePass = activeRows && activeRows.length
      ? activeRows[0] : null;
    const logRows = readRows(
      `SELECT * FROM d6_scheduler_log ORDER BY id DESC LIMIT 10`);
    const eventRows = readRows(
      `SELECT * FROM d6_scheduler_events ORDER BY id DESC LIMIT 20`);
    const scrub = (v, cap) => typeof v === "string"
      ? scrubDrivePassText(v, cap) : null;
    return {
      schemaReady: stateRows !== null,
      state: state ? {
        state: state.state,
        epoch: state.epoch,
        cronExpression: state.cron_expression,
        admittedWatermark: state.admitted_watermark,
        activatedAt: state.activated_at,
        deactivatedAt: state.deactivated_at,
        triggerRemovedAt: state.trigger_removed_at,
        updatedAt: state.updated_at,
        authorizationRef: scrub(state.authorization_ref, 200),
        stallTicks: state.stall_ticks,
        lastClassification: state.last_classification,
        lastTickAt: state.last_tick_at,
        inFlightIdentity: state.in_flight_identity,
        disablementDisposition: state.disablement_disposition,
      } : null,
      waitHold: state ? {
        active: state.wait_hold_active === 1,
        declaredAt: state.wait_hold_declared_at,
        ref: scrub(state.wait_hold_ref, 200),
      } : null,
      activePass: activePass ? {
        identity: activePass.identity,
        entryKind: activePass.entry_kind,
        admittedAt: activePass.admitted_at,
        tickIdentity: activePass.tick_identity,
      } : null,
      guard: {
        held: this._passGuard().holder !== null,
        holderKind: this._passGuard().holder
          ? this._passGuard().holder.kind : null,
        waiters: this._passGuard().waiters.length,
      },
      recentLog: (logRows ?? []).map((r) => ({
        id: r.id, at: r.at, finishedAt: r.finished_at,
        cron: r.cron, scheduledTime: r.scheduled_time,
        tickIdentity: r.tick_identity, epoch: r.activation_epoch,
        classification: r.classification, action: r.action,
        reason: scrub(r.reason, 200),
        drivePassId: r.drive_pass_id, passStage: r.pass_stage,
        errorName: sanitizeDrivePassName(r.error_name),
      })),
      recentEvents: (eventRows ?? []).map((r) => ({
        id: r.id, at: r.at, kind: r.kind,
      })),
    };
  }

  // The drive-pass body — the shipped alarm() sequence, extracted
  // verbatim (amended design §5) so the native entry and the
  // scheduled fallback run ONE implementation. Stage discipline is
  // the shipped one: rec.stage names the step IN PROGRESS, so a
  // throw records the step that threw; "complete" means the
  // handler ran end to end. The containment gate is the shipped
  // one. SCHEDULED passes additionally re-check the containment
  // gate after cache construction and after recover(), before
  // driveOnce() (ruling I3: admission in NORMAL does not authorize
  // later stages after containment changes); a re-check that finds
  // suppression stops the pass at stage "contained" with
  // driveInvoked 0 — a policy stop, not an error. Native passes
  // make NO such re-checks: their semantics are the shipped ones,
  // unchanged (a transition landing mid-pass does not interrupt a
  // native pass; the next pass is contained).
  async _drivePassBody(kind, rec) {
    // The coordinator's own alarm first (schedule, leases, parks),
    // then the D6 driver's recovery + continuation. While halted,
    // d6HostEnv wires no sendGrant, so driveOnce can settle plan
    // state and re-derive grants but nothing can leave the outbox.
    await super.alarm();
    // CONTAINMENT (Phase B containment design, revised state
    // semantics): after the base alarm's schedule processing —
    // which continues in EVERY state, so leases still close
    // in-flight grants — and before recover()/driveOnce(), the
    // durable containment state gates the DRIVE. In
    // DRIVE_CONTAINED or CHAIN_STOPPED, and on ANY unverified
    // state read (fail-closed for drive), the pass is recorded
    // at stage "contained" with driveInvoked 0 and the handler
    // returns normally: no new grants, no plan advancement, no
    // throw (hence no platform retry storm). A pass already
    // inside driveOnce when a transition lands is NOT
    // interrupted — it completes; the next pass is contained.
    const containmentRead =
      readContainmentState(this.state.storage.sql);
    if (containmentDriveSuppressed(containmentRead)) {
      rec.stage = "contained";
      if (!containmentRead.verified && containmentRead.errorName) {
        rec.errorName = containmentRead.errorName;
        rec.errorMessage =
          "containment state read failed; drive suppressed (fail-closed)";
      }
      return;
    }
    rec.stage = "construct";
    const cache = await this._cache();
    const coord = new GenerationCoordinator(this.state, d6HostEnv(this.env, cache));
    const service = d6Service(coord, d6HostEnv(this.env, cache));
    if (kind === ENTRY_KIND_SCHEDULED) {
      const recheck = readContainmentState(this.state.storage.sql);
      if (containmentDriveSuppressed(recheck)) {
        rec.stage = "contained";
        if (!recheck.verified && recheck.errorName) {
          rec.errorName = recheck.errorName;
          rec.errorMessage =
            "containment changed after cache construction; scheduled drive suppressed (I3)";
        }
        return;
      }
    }
    rec.stage = "recover";
    await service.recover();
    if (kind === ENTRY_KIND_SCHEDULED) {
      const recheck = readContainmentState(this.state.storage.sql);
      if (containmentDriveSuppressed(recheck)) {
        rec.stage = "contained";
        if (!recheck.verified && recheck.errorName) {
          rec.errorName = recheck.errorName;
          rec.errorMessage =
            "containment changed after recover(); scheduled drive suppressed (I3)";
        }
        return;
      }
    }
    rec.stage = "drive";
    rec.driveInvoked = 1;
    rec.outcomes = await service.driveOnce();
    rec.stage = "flush";
    await cache.flush();
    rec.stage = "complete";
  }

  // One drive pass under the guard (amended design §5; addendum
  // §C2/§C3). The caller has ALREADY acquired the guard (native:
  // wait mode at alarm() entry; scheduled: try mode inside the
  // tick's admission stretch) and hands the token here. Exit
  // discipline is the captured-error discipline: the body's error
  // is captured, never replaced; assurance and recording run
  // after capture, each in its own try/catch that cannot throw
  // out of the exit path; the active-pass record is cleared
  // owner-safely (scheduled passes only); the guard is released
  // in the innermost finally, so release is guaranteed even if
  // assurance or recording fails. For the NATIVE kind the
  // ORIGINAL error is then rethrown unchanged (Rowan's
  // record-then-rethrow requirement — platform alarm-retry
  // behavior identical to the shipped build). For the SCHEDULED
  // kind the error is recorded, not rethrown (cron deliveries
  // carry no platform retries to preserve).
  async _drivePass(kind, { entryAt, token, tickCtx = null }) {
    const rec = { at: entryAt, entryKind: kind,
      admittedAt: token ? token.admittedAt : null,
      stage: "base_alarm", driveInvoked: 0, outcomes: null,
      errorName: null, errorMessage: null,
      exitArmed: undefined, assuranceFired: false };
    let originalError = null;
    try {
      await this._drivePassBody(kind, rec);
    } catch (e) {
      originalError = e;
      rec.errorName = e && e.name ? String(e.name) : "Error";
      rec.errorMessage = e && e.message ? String(e.message) : String(e);
    }
    let passId = null;
    try {
      try {
        await this._exitAssurance(rec);
      } catch (e) {
        await this._noteSchedulerAssuranceFailure(e);
      }
      try {
        passId = await this._recordDrivePass(rec);
      } catch { passId = null; }
      if (tickCtx && tickCtx.activePassIdentity) {
        try {
          const cleared = this._clearActivePass(
            tickCtx.activePassIdentity);
          // Disablement stage (3) (amended design §9; addendum
          // §C7): when a deactivation noted THIS pass in flight,
          // its own exit clearing the record resolves the
          // disposition as drained_normally — recorded as the
          // 'drained' event and on the state row. The identity
          // stays on the state row as evidence.
          if (cleared) {
            const st = this._readSchedulerState();
            if (st && st.in_flight_identity ===
                tickCtx.activePassIdentity) {
              this.state.storage.sql.exec(
                `UPDATE d6_scheduler_state
                   SET disablement_disposition = 'drained_normally'
                 WHERE id = 1`);
              this._schedulerEvent("drained", {
                identity: tickCtx.activePassIdentity,
                disposition: "drained_normally" });
            }
          }
        } catch { /* a stale record is evidence; it stays */ }
      }
    } finally {
      if (token) this._passGuardRelease(token);
    }
    if (kind === ENTRY_KIND_NATIVE && originalError)
      throw originalError;
    return { passId, stage: rec.stage, error: originalError,
      driveInvoked: rec.driveInvoked === 1 };
  }

  async alarm() {
    // PHASE B INSTRUMENTATION (P2) + A-3: the native alarm entry.
    // The handler-entry timestamp is taken BEFORE the guard wait
    // (addendum §C2: `at` is handler entry, pre-guard;
    // `admitted_at` is guard acquisition — evidence can therefore
    // distinguish delivery time from admission time after a
    // wait). The native entry acquires the guard in WAIT mode:
    // platform alarm retries and duplicate deliveries queue FIFO
    // instead of discarding work (amended design §3/§5). A waiter
    // interrupted before acquisition records stage
    // 'wait_interrupted' if it can still write, and its error
    // propagates unchanged; if it cannot write, nothing is
    // recorded and nothing is claimed.
    this._ensureA3Schema();
    const entryAt = this._drivePassNow();
    let token;
    try {
      token = await this._passGuardWaitAcquire(ENTRY_KIND_NATIVE);
    } catch (e) {
      try {
        await this._recordDrivePass({
          at: entryAt, entryKind: ENTRY_KIND_NATIVE,
          admittedAt: null, stage: "wait_interrupted",
          driveInvoked: 0, outcomes: null,
          errorName: e && e.name ? String(e.name) : "Error",
          errorMessage: e && e.message ? String(e.message) : String(e),
          exitArmed: undefined, assuranceFired: false });
      } catch { /* cannot write: nothing recorded, nothing claimed */ }
      throw e;
    }
    return this._drivePass(ENTRY_KIND_NATIVE, { entryAt, token });
  }
}

// The production gate, verbatim from worker-entry-prod.js (deny by
// default; the allowlisted CORS headers ride every refusal).
function productionGate(request, env, cors, { skipClientToken = false } = {}) {
  if (env.OPALREADER_V2_SCOPE !== PRODUCTION_SCOPE)
    return json(403, { error: "production_scope_required" }, cors);
  if (request.headers.get("x-opalreader-scope") !== PRODUCTION_SCOPE)
    return json(403, { error: "production_scope_required" }, cors);
  if (skipClientToken) return null;
  if (!env.OPALREADER_ACCESS_TOKEN)
    return json(503, { error: "production_token_not_configured" }, cors);
  if (request.headers.get("x-opalreader-token") !== env.OPALREADER_ACCESS_TOKEN)
    return json(401, TOKEN_ERROR_BODY, cors);
  return null;
}

async function fetchHandler(request, env) {
  const url = new URL(request.url);
  const cors = corsHeaders(request, env);
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: {
      ...cors,
      "access-control-allow-methods": "GET, HEAD, POST, OPTIONS",
      "access-control-allow-headers": "content-type, x-opalreader-token, x-opalreader-scope, x-opalreader-instance, range, if-range, if-none-match",
      "access-control-expose-headers": AUDIO_EXPOSE_HEADERS,
    } });
  }
  if (request.method === "GET" && (url.pathname === "/health" || url.pathname === "/health/")) {
    return json(200, {
      ok: true, app: "OpalReader API v2", version: BUILD_VERSION, build: BUILD_COMMIT,
      coordinator: env.COORDINATOR ? "armed" : "unbound",
      scope: env.OPALREADER_V2_SCOPE || null,
      generation: env.GENERATION_HALT === "0" ? "enabled" : "halted",
    }, cors);
  }
  // A-3 (amended design §2): the DO-internal surface is NEVER
  // publicly routable. Every /internal/* path is refused here,
  // explicitly, before any credential check or gate — the refusal
  // does not depend on which headers ride along, and the response
  // is indistinguishable from any other unknown route. The tick
  // handler is reachable only by a direct stub call from this
  // script's own scheduled() export.
  if (url.pathname.startsWith("/internal/"))
    return json(404, { error: "route_not_found" }, cors);
  if (!url.pathname.startsWith("/v2/"))
    return json(404, { error: "route_not_found" }, cors);
  const isOperatorRoute = request.method === "POST" &&
    (url.pathname === "/v2/command-approvals" ||
     url.pathname === "/v2/command-reconciliation");
  // gen-pkg-1 item 5: the attempt-diagnostics read is an
  // OPERATOR surface (GET /v2/d6-diagnostics) — the production
  // gate skips the client token for it exactly as for the Option
  // D operator routes, and the operator-admission block below
  // requires the migration-operator credential in addition. The
  // everyday client token alone is refused there. The client
  // build has no path to this surface.
  const isDiagnosticsRoute = request.method === "GET" &&
    url.pathname === "/v2/d6-diagnostics";
  // gen-pkg-1 round 3: the two operator write surfaces — the
  // phase-binding recording (R3-1) and the halted-plan
  // retirement (R3-2) — join the diagnostics route's fence
  // class: the production gate skips the client token for them
  // (admission is on the migration-operator credential ALONE,
  // exactly as for the Option D operator routes), the operator
  // admission block below requires that credential in addition,
  // and the class gate requires the stamped admission again.
  // The everyday client token alone is refused on both.
  const isPhaseBindingRoute = request.method === "POST" &&
    url.pathname === "/v2/d6-phase-binding";
  const isRetirePlanRoute = request.method === "POST" &&
    url.pathname === "/v2/d6-retire-halted-plan";
  // D7-2: the quarantine release joins the same operator fence
  // class (gate skips the client token; the operator admission
  // block below requires the migration-operator credential; the
  // class gate requires the stamped admission again).
  const isReleaseQuarantineRoute = request.method === "POST" &&
    url.pathname === "/v2/d6-release-quarantine";
  // CH2 FIX PACKAGE (fix 2): the unknown-billing reconciliation
  // joins the same operator fence class (gate skips the client
  // token; the operator admission block below requires the
  // migration-operator credential; the class gate requires the
  // stamped admission again). The everyday client token alone
  // is refused, exactly as on the surfaces above.
  const isReconcileRoute = request.method === "POST" &&
    url.pathname === "/v2/d6-reconcile-unknown";
  // CH2 DISPOSITION PACKAGE: the uncertainty disposition joins
  // the same operator fence class (gate skips the client token;
  // the operator admission block below requires the
  // migration-operator credential; the class gate requires the
  // stamped admission again). The everyday client token alone
  // is refused, exactly as on the surfaces above.
  const isAdjudicateRoute = request.method === "POST" &&
    url.pathname === "/v2/d6-adjudicate-estimated";
  // QUOTA ROUTES PACKAGE: the three quota invocation surfaces
  // join the same operator fence class (gate skips the client
  // token; the operator admission block below requires the
  // migration-operator credential; the class gate requires the
  // stamped admission again). The everyday client token alone
  // is refused, exactly as on the surfaces above. The
  // reconcile read is a GET in the diagnostics fence's shape.
  const isQuotaBootstrapRoute = request.method === "POST" &&
    url.pathname === "/v2/d6-quota-bootstrap";
  const isQuotaDisposeRoute = request.method === "POST" &&
    url.pathname === "/v2/d6-quota-dispose-exception";
  const isQuotaReconcileRoute = request.method === "GET" &&
    url.pathname === "/v2/d6-quota-reconcile";
  // CH3 MECHANISMS (§5A / §5B): the park release, its revoke,
  // the chapter-occurrence exemption, and its revoke join the
  // same operator fence class (gate skips the client token; the
  // operator admission block below requires the
  // migration-operator credential; the class gate requires the
  // stamped admission again). The everyday client token alone
  // is refused, exactly as on the surfaces above.
  const isParkReleaseRoute = request.method === "POST" &&
    url.pathname === "/v2/d6-release-park";
  const isParkReleaseRevokeRoute = request.method === "POST" &&
    url.pathname === "/v2/d6-revoke-park-release";
  const isChapterExemptionRoute = request.method === "POST" &&
    url.pathname === "/v2/d6-exempt-chapter-occurrence";
  const isChapterExemptionRevokeRoute = request.method === "POST" &&
    url.pathname === "/v2/d6-revoke-chapter-exemption";
  // RECOVERY (Option A): the grant finalizer's two surfaces join
  // the same fence class — the production gate skips the client
  // token for them and the operator-admission block below
  // requires the migration-operator credential in addition; the
  // class gate re-checks the unforgeable operator-admitted
  // stamp. The preview is a GET (read-only derivation); the
  // action is a POST with a closed allowlist body enforced at
  // the class gate. NEITHER is halt-fenced: finalization is
  // bookkeeping closure, not generation — it performs no
  // provider call, no submission, and no wake.
  const isGrantFinalizationPreviewRoute = request.method === "GET" &&
    url.pathname === "/v2/d6-grant-finalization-preview";
  const isGrantFinalizeRoute = request.method === "POST" &&
    url.pathname === "/v2/d6-finalize-grant";
  // CONTAINMENT (Phase B containment design, revised semantics):
  // the transition write (POST /v2/d6-containment) and the state
  // read (GET /v2/d6-containment) join the same operator fence
  // class — the production gate skips the client token for them,
  // the operator admission block below requires the
  // migration-operator credential in addition, and the class gate
  // requires the stamped admission again. The everyday client
  // token alone is refused on both. The GET is a passive read
  // (state + getAlarm + schedule counts): it is the verification
  // surface for containment and performs no wake and no write.
  const isContainmentRoute = request.method === "POST" &&
    url.pathname === "/v2/d6-containment";
  const isContainmentStateRoute = request.method === "GET" &&
    url.pathname === "/v2/d6-containment";
  // W-4 TRACK A / A-1 (Rowan's final ruling, 2026-11-14): the
  // alarm-repair maintenance route (POST /v2/d6-repair-evaluate)
  // and its read-only audit surface (GET /v2/d6-repair-status)
  // join the same operator fence class — the production gate
  // skips the client token for them, the operator admission
  // block below requires the migration-operator credential in
  // addition, and the class gate requires the stamped admission
  // again. The everyday client token alone is refused on both.
  const isRepairEvaluateRoute = request.method === "POST" &&
    url.pathname === "/v2/d6-repair-evaluate";
  const isRepairStatusRoute = request.method === "GET" &&
    url.pathname === "/v2/d6-repair-status";
  // A-3: the scheduler activation write (POST
  // /v2/d6-scheduler-activation) and the read-only status surface
  // (GET /v2/d6-scheduler-status) join the same operator fence
  // class — the production gate skips the client token for them,
  // the operator admission block below requires the
  // migration-operator credential in addition, and the class gate
  // requires the stamped admission again. The everyday client
  // token alone is refused on both.
  const isSchedulerActivationRoute = request.method === "POST" &&
    url.pathname === "/v2/d6-scheduler-activation";
  const isSchedulerStatusRoute = request.method === "GET" &&
    url.pathname === "/v2/d6-scheduler-status";
  const denied = productionGate(request, env, cors,
    { skipClientToken: isOperatorRoute || isDiagnosticsRoute
        || isPhaseBindingRoute || isRetirePlanRoute
        || isReleaseQuarantineRoute || isReconcileRoute
        || isAdjudicateRoute || isQuotaBootstrapRoute
        || isQuotaDisposeRoute || isQuotaReconcileRoute
        || isParkReleaseRoute || isParkReleaseRevokeRoute
        || isChapterExemptionRoute || isChapterExemptionRevokeRoute
        || isGrantFinalizationPreviewRoute || isGrantFinalizeRoute
        || isContainmentRoute || isContainmentStateRoute
        || isRepairEvaluateRoute || isRepairStatusRoute
        || isSchedulerActivationRoute || isSchedulerStatusRoute });
  if (denied) return denied;
  const instance = request.headers.get("x-opalreader-instance");
  if (instance !== PRODUCTION_INSTANCE)
    return json(403, { error: "production_instance_required" }, cors);
  if (isAudioPath(url.pathname))
    return handleAudioRequest(request, {
      bucket: env.OPALREADER_STORAGE, cors,
      scope: env.OPALREADER_V2_SCOPE, r2KeyPrefix: env.R2_KEY_PREFIX ?? "",
    });
  // Peeked bodies (read once, reused below): the whole-book
  // migration refusal, and the D6 intent forward.
  let peek = null;
  if (request.method === "POST" && url.pathname === "/v2/commands") {
    try { peek = await request.clone().json(); } catch { peek = null; }
    if (peek && peek.type === "MigrateImportBindings")
      return json(403, { error: "migration_chunk_required" }, cors);
    // D7-2 + D8-2 ADMISSION FENCE (public level; the coordinator
    // class carries the same refusal as a bypass backup): while
    // halted, EVERY generation-producing legacy command type is
    // refused 423 generation_halted — RequestSynthesis /
    // RequestResume (D7-2) and plain SubmitJob / RequestRepair
    // (D8-2; see isHaltRefusedCommand and the class-level comment
    // in OpalReaderCoordinatorProd.fetch). D6 intents (SubmitJob
    // + data.d6Intent) are NOT refused: they forward to the
    // intent route below and are admitted + birth-marked,
    // exactly as C3 contracts.
    if (env.GENERATION_HALT !== "0" && isHaltRefusedCommand(peek))
      return json(423, { error: "generation_halted" }, cors);
  }
  // G2: the storage-seed route joins the operator fence. Unlike
  // the two Option D operator routes (admitted on the operator
  // header ALONE — the production gate above skipped their client
  // token), the seed requires BOTH: the full client gate chain has
  // already run for it, and operator admission runs here in
  // addition. The client token alone is refused.
  const isSeedRoute = request.method === "POST" &&
    url.pathname === "/v2/d6-seed-storage";
  let operatorAdmitted = false;
  if (isOperatorRoute || isSeedRoute || isDiagnosticsRoute
      || isPhaseBindingRoute || isRetirePlanRoute
      || isReleaseQuarantineRoute || isReconcileRoute
      || isAdjudicateRoute || isQuotaBootstrapRoute
      || isQuotaDisposeRoute || isQuotaReconcileRoute
      || isParkReleaseRoute || isParkReleaseRevokeRoute
      || isChapterExemptionRoute || isChapterExemptionRevokeRoute
      || isGrantFinalizationPreviewRoute || isGrantFinalizeRoute
      || isContainmentRoute || isContainmentStateRoute
      || isRepairEvaluateRoute || isRepairStatusRoute
      || isSchedulerActivationRoute || isSchedulerStatusRoute) {
    const operatorToken = env.OPALREADER_MIGRATION_OPERATOR_TOKEN;
    if (!operatorToken || !env.OPALREADER_ACCESS_TOKEN ||
        operatorToken === env.OPALREADER_ACCESS_TOKEN)
      return json(503, { error: "migration_operator_not_configured" }, cors);
    if (request.headers.get("x-opalreader-operator-token") !== operatorToken)
      return json(403, { error: "migration_operator_required" }, cors);
    operatorAdmitted = true;
  }
  if (!env.COORDINATOR)
    return json(503, { error: "coordinator_not_bound" }, cors);
  const stub = env.COORDINATOR.get(env.COORDINATOR.idFromName(instance));
  const forward = async (req) => {
    req.headers.set(INTERNAL_HEADER, "1");
    req.headers.set("x-opalreader-scope", PRODUCTION_SCOPE);
    req.headers.set("x-opalreader-operator-admitted", operatorAdmitted ? "1" : "0");
    const response = await stub.fetch(req);
    const headers = new Headers(response.headers);
    for (const [k, v] of Object.entries(cors)) headers.set(k, v);
    return new Response(response.body, { status: response.status, headers });
  };
  // D6 intent forward: a SubmitJob whose payload carries
  // data.d6Intent is an INTENT, not a job — it goes to the service,
  // which creates the durable plan and its first job itself.
  if (peek && peek.type === "SubmitJob" && peek.payload?.data?.d6Intent) {
    const intent = {
      commandId: peek.command_id,
      bookId: peek.payload.bookId ?? null,
      lane: peek.payload.lane ?? "standard",
      ...peek.payload.data.d6Intent,
    };
    return forward(new Request("https://do.internal/internal/d6/intent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(intent),
    }));
  }
  // D6 plan status: GET /v2/d6-plans/<planId> reads the service's
  // plan view (display only — the client never drives the work).
  const planMatch = request.method === "GET"
    && url.pathname.match(/^\/v2\/d6-plans\/([^/]+)$/);
  if (planMatch) {
    const planUrl = new URL("https://do.internal/internal/d6/plan");
    planUrl.searchParams.set("planId", decodeURIComponent(planMatch[1]));
    return forward(new Request(planUrl.toString(), { method: "GET" }));
  }
  // gen-pkg-1 read surfaces: the plan LIST (exact path — the
  // single-plan route above owns /v2/d6-plans/<id>), the admitted-
  // lanes capabilities view, and the advisory eligibility quote.
  // All three ride the full production gate chain that has already
  // run for this request (scope config + scope header + client
  // token + instance), exactly like the plan-status forward.
  if (request.method === "GET" && url.pathname === "/v2/d6-plans") {
    const listUrl = new URL("https://do.internal/internal/d6/plans");
    for (const k of ["limit", "cursor"])
      if (url.searchParams.get(k) !== null)
        listUrl.searchParams.set(k, url.searchParams.get(k));
    return forward(new Request(listUrl.toString(), { method: "GET" }));
  }
  if (request.method === "GET" && url.pathname === "/v2/generation/capabilities") {
    return forward(new Request("https://do.internal/internal/d6/capabilities",
      { method: "GET" }));
  }
  // gen-pkg-1 item 5: attempt diagnostics (operator-admitted
  // above; forward() stamps the admission the class gate checks).
  if (isDiagnosticsRoute) {
    const dUrl = new URL("https://do.internal/internal/d6/diagnostics");
    for (const k of ["planId", "jobId", "limit", "cursor", "drive"])
      if (url.searchParams.get(k) !== null)
        dUrl.searchParams.set(k, url.searchParams.get(k));
    // PHASE B INSTRUMENTATION (P2): the copy above takes each
    // parameter singly, which would silently collapse a REPEATED
    // parameter to its first value before the class gate could
    // see it. Repetition of any diagnostics parameter is
    // forwarded explicitly so the drive-mode ambiguity rejection
    // (diagnostics_mode_ambiguous) can fire on it.
    if (["planId", "jobId", "limit", "cursor", "drive"]
        .some((k) => url.searchParams.getAll(k).length > 1))
      dUrl.searchParams.set("repeated", "1");
    return forward(new Request(dUrl.toString(), { method: "GET" }));
  }
  if (request.method === "GET" && url.pathname === "/v2/d6-eligibility") {
    const qUrl = new URL("https://do.internal/internal/d6/eligibility");
    for (const k of ["bookId", "scope", "chapterIndex", "occurrenceId"])
      if (url.searchParams.get(k) !== null)
        qUrl.searchParams.set(k, url.searchParams.get(k));
    return forward(new Request(qUrl.toString(), { method: "GET" }));
  }
  // D6 storage seed (CORRECTION 2, hardened at G2):
  // POST /v2/d6-seed-storage has passed the full production gate
  // above (scope config, scope header, client token, instance
  // header) AND the operator admission block (operatorAdmitted is
  // true here — admission failure already returned), and forwards
  // to the internal seed route; forward() stamps the admission on
  // the internal request, and the class gate requires the stamp.
  // The service refuses while generation is not halted, so this
  // surface can only ever act pre-arming.
  if (isSeedRoute) {
    let seedBody = null;
    try { seedBody = await request.json(); } catch { seedBody = null; }
    return forward(new Request("https://do.internal/internal/d6/seed-storage", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(seedBody ?? {}),
    }));
  }
  // gen-pkg-1 round 3 operator surfaces (admitted above;
  // forward() stamps the admission the class gate checks). The
  // bodies pass through minus any pretense of authority: the
  // internal phase-binding route stamps its own recorded source
  // and answers with the store's read-back binding, and the
  // retirement route's service fences (halted state + reconciled
  // attempts) run inside the coordinator regardless.
  if (isPhaseBindingRoute) {
    let bindBody = null;
    try { bindBody = await request.json(); } catch { bindBody = null; }
    return forward(new Request("https://do.internal/internal/d6/phase-binding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(bindBody ?? {}),
    }));
  }
  if (isRetirePlanRoute) {
    let retireBody = null;
    try { retireBody = await request.json(); } catch { retireBody = null; }
    return forward(new Request("https://do.internal/internal/d6/retire-halted-plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(retireBody ?? {}),
    }));
  }
  if (isReleaseQuarantineRoute) {
    let releaseBody = null;
    try { releaseBody = await request.json(); } catch { releaseBody = null; }
    return forward(new Request("https://do.internal/internal/d6/release-quarantine", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(releaseBody ?? {}),
    }));
  }
  // CH2 FIX PACKAGE (fix 2): the reconciliation surface
  // (operator-admitted above; forward() stamps the admission
  // the class gate checks). The body passes through minus any
  // pretense of authority: the internal route validates the
  // settlement terms, stamps its own recorded source, and the
  // store's fences (confirmed/unknown only, plan match, audit
  // in the settlement transaction) run inside the coordinator
  // regardless.
  if (isReconcileRoute) {
    let reconcileBody = null;
    try { reconcileBody = await request.json(); } catch { reconcileBody = null; }
    return forward(new Request("https://do.internal/internal/d6/reconcile-unknown", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(reconcileBody ?? {}),
    }));
  }
  // CH2 DISPOSITION PACKAGE: the uncertainty-disposition surface
  // (operator-admitted above; forward() stamps the admission the
  // class gate checks). The body passes through minus any
  // pretense of authority: the internal route enforces the
  // closed allowlist schema, stamps its own recorded source and
  // evidence references, and the store's §4.1 fences run inside
  // the coordinator regardless.
  if (isAdjudicateRoute) {
    let adjudicateBody = null;
    try { adjudicateBody = await request.json(); } catch { adjudicateBody = null; }
    return forward(new Request("https://do.internal/internal/d6/adjudicate-estimated", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(adjudicateBody ?? {}),
    }));
  }
  // QUOTA ROUTES PACKAGE: the quota invocation surfaces
  // (operator-admitted above; forward() stamps the admission
  // the class gate checks). The bodies pass through minus any
  // pretense of authority: the internal bootstrap route
  // enforces halt-only + figureless itself, the disposition
  // route enforces its closed allowlist and the store the
  // Hold-B law, and the reconcile route is a read whose
  // handler bounds its own output. The bootstrap body is
  // forwarded as RAW TEXT, never parsed-and-rewritten here
  // (Rowan source hold 6546277727 item 1): the DO handler
  // owns the strict absent/empty vs malformed vs explicit-
  // null distinction, and coercing a parse failure into {}
  // at this entry would silently bless malformed input.
  if (isQuotaBootstrapRoute) {
    // A body READ failure must never be forwarded as the
    // empty string that authorizes bootstrap (Rowan
    // 6546431837): refuse here as a named fault; the DO
    // handler enforces the same rule bypass-safely.
    let quotaBootstrapText;
    try { quotaBootstrapText = await request.text(); }
    catch { return json(400, { error: "quota_bootstrap_body_read_error" }, cors); }
    return forward(new Request("https://do.internal/internal/d6/quota-bootstrap", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: quotaBootstrapText,
    }));
  }
  if (isQuotaDisposeRoute) {
    let quotaDisposeBody = null;
    try { quotaDisposeBody = await request.json(); } catch { quotaDisposeBody = null; }
    return forward(new Request("https://do.internal/internal/d6/quota-dispose-exception", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(quotaDisposeBody ?? {}),
    }));
  }
  if (isQuotaReconcileRoute) {
    const quotaReconcileUrl = new URL("https://do.internal/internal/d6/quota-reconcile");
    for (const k of ["exceptionOffset", "driftOffset"])
      if (url.searchParams.get(k) !== null)
        quotaReconcileUrl.searchParams.set(k, url.searchParams.get(k));
    return forward(new Request(quotaReconcileUrl.toString(),
      { method: "GET" }));
  }
  // CH3 MECHANISMS (§5A / §5B): the park release + exemption
  // surfaces (operator-admitted above; forward() stamps the
  // admission the class gate checks). The bodies pass through
  // minus any pretense of authority: the internal routes
  // enforce the closed allowlists and the store derives the
  // definition set mechanically from the pinned carry + live
  // identity — caller-supplied ids are only ever intersected
  // with the derived sets, never believed.
  if (isParkReleaseRoute) {
    let parkReleaseBody = null;
    try { parkReleaseBody = await request.json(); } catch { parkReleaseBody = null; }
    return forward(new Request("https://do.internal/internal/d6/release-park", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parkReleaseBody ?? {}),
    }));
  }
  if (isParkReleaseRevokeRoute) {
    let parkRevokeBody = null;
    try { parkRevokeBody = await request.json(); } catch { parkRevokeBody = null; }
    return forward(new Request("https://do.internal/internal/d6/revoke-park-release", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parkRevokeBody ?? {}),
    }));
  }
  if (isChapterExemptionRoute) {
    let exemptionBody = null;
    try { exemptionBody = await request.json(); } catch { exemptionBody = null; }
    return forward(new Request("https://do.internal/internal/d6/exempt-chapter-occurrence", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(exemptionBody ?? {}),
    }));
  }
  if (isChapterExemptionRevokeRoute) {
    let exemptionRevokeBody = null;
    try { exemptionRevokeBody = await request.json(); } catch { exemptionRevokeBody = null; }
    return forward(new Request("https://do.internal/internal/d6/revoke-chapter-exemption", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(exemptionRevokeBody ?? {}),
    }));
  }
  // RECOVERY (Option A): the grant-finalization preview. GET
  // carrying identity only in the query; forwards ONLY grantId
  // (required — the class gate refuses without it) plus the
  // optional plan/job corroboration ids. The class handler is
  // read-only: it derives, never writes.
  if (isGrantFinalizationPreviewRoute) {
    const finalizationPreviewUrl = new URL(
      "https://do.internal/internal/d6/grant-finalization-preview");
    const gp = url.searchParams.get("grantId");
    if (gp !== null && gp !== "") finalizationPreviewUrl.searchParams.set("grantId", gp);
    const pp = url.searchParams.get("planId");
    if (pp !== null && pp !== "") finalizationPreviewUrl.searchParams.set("planId", pp);
    const jp = url.searchParams.get("jobId");
    if (jp !== null && jp !== "") finalizationPreviewUrl.searchParams.set("jobId", jp);
    return forward(new Request(finalizationPreviewUrl.toString(), { method: "GET" }));
  }
  // RECOVERY (Option A): the grant finalizer action. Passes the
  // JSON body through untouched; the closed allowlist and every
  // precondition are enforced at the class gate + store.
  if (isGrantFinalizeRoute) {
    let finalizeBody = null;
    try { finalizeBody = await request.json(); } catch { finalizeBody = null; }
    return forward(new Request("https://do.internal/internal/d6/finalize-grant", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(finalizeBody ?? {}),
    }));
  }
  if (isContainmentRoute) {
    let containmentBody = null;
    try { containmentBody = await request.json(); } catch { containmentBody = null; }
    return forward(new Request("https://do.internal/internal/d6/containment", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(containmentBody ?? {}),
    }));
  }
  if (isContainmentStateRoute) {
    return forward(new Request("https://do.internal/internal/d6/containment",
      { method: "GET" }));
  }
  // W-4 TRACK A / A-1: the repair surfaces (operator-admitted
  // above; forward() stamps the admission the class gate
  // checks). The body passes through minus any pretense of
  // authority: the class gate enforces the closed allowlist,
  // stamps the recorded source itself, and the coordinator's
  // held-state, containment, strike, and fence checks run
  // inside regardless.
  if (isRepairEvaluateRoute) {
    let repairBody = null;
    try { repairBody = await request.json(); } catch { repairBody = null; }
    return forward(new Request("https://do.internal/internal/d6/repair-evaluate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(repairBody ?? {}),
    }));
  }
  if (isRepairStatusRoute) {
    return forward(new Request("https://do.internal/internal/d6/repair-status",
      { method: "GET" }));
  }
  // A-3: the scheduler surfaces (operator-admitted above;
  // forward() stamps the admission the class gate checks). The
  // activation body passes through minus any pretense of
  // authority: the class gate enforces the closed allowlist and
  // the state machine's own transition rules run inside the
  // coordinator regardless.
  if (isSchedulerActivationRoute) {
    let schedulerBody = null;
    try { schedulerBody = await request.json(); }
    catch { schedulerBody = null; }
    return forward(new Request("https://do.internal/internal/d6/scheduler-activation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(schedulerBody ?? {}),
    }));
  }
  if (isSchedulerStatusRoute) {
    return forward(new Request("https://do.internal/internal/d6/scheduler-status",
      { method: "GET" }));
  }
  return forward(new Request(url.toString(), request));
}

// The v2 queue consumer. Layer 1 of the halt: refuse before touching
// the coordinator, the queue binding, or any provider. Production
// fences (scope + instance) are declared on every internal execute,
// exactly as on the public surface; the coordinator class behind
// the COORDINATOR binding on this script is
// OpalReaderCoordinatorProd as exported by THIS entry — the
// existing production class name (deploy-spec-prod-d6.json).
async function queueHandler(batch, env) {
  assertGenerationEnabled(env);
  if (!env.COORDINATOR) throw new Error("coordinator_not_bound");
  const stub = env.COORDINATOR.get(env.COORDINATOR.idFromName(PRODUCTION_INSTANCE));
  for (const message of batch.messages) {
    try {
      const response = await stub.fetch(new Request("https://do.internal/internal/execute", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          [INTERNAL_HEADER]: "1",
          "x-opalreader-scope": PRODUCTION_SCOPE,
        },
        body: JSON.stringify(message.body),
      }));
      if (!response.ok) throw new Error(`executor_http_${response.status}`);
      if (typeof message.ack === "function") message.ack();
    } catch (e) {
      if (typeof message.retry === "function") message.retry();
      else throw e;
    }
  }
}

// The A-3 scheduler entry (amended design §2). A Cron Trigger —
// platform configuration, set by the separately gated trigger
// step, NEVER by this code — invokes this export; it creates the
// coordinator stub with runtime retries DISABLED for this call
// (retry: { maxRetries: 0 }: a tick must never be silently
// re-delivered by the runtime inside the same logical tick; the
// tick handler itself is not marked retryable) and calls the
// DO-internal tick handler exactly once, awaiting its completion
// so the invocation's lifetime covers the tick. The tick's
// result is not acted on here: every decision lives inside the
// coordinator, behind the admission stretch. The trigger's
// cadence is deployment configuration; this code carries only
// the cron-expression CONSTANT the admission stretch verifies.
async function scheduledHandler(controller, env, ctx) {
  if (!env.COORDINATOR) throw new Error("coordinator_not_bound");
  const stub = env.COORDINATOR.get(
    env.COORDINATOR.idFromName(PRODUCTION_INSTANCE),
    { retry: { maxRetries: 0 } });
  const response = await stub.fetch(
    new Request("https://do.internal/internal/d6-scheduler-tick", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [INTERNAL_HEADER]: "1",
        "x-opalreader-scope": PRODUCTION_SCOPE,
      },
      body: JSON.stringify({
        cron: controller && controller.cron,
        scheduledTime: controller && controller.scheduledTime,
      }),
    }));
  // Drain the body so the invocation's completion reflects the
  // tick's completion; the content is the tick's own record,
  // already durable in the scheduler log.
  await response.text().catch(() => "");
}

export default { fetch: fetchHandler, queue: queueHandler,
  scheduled: scheduledHandler };
export { fetchHandler, queueHandler, scheduledHandler,
  GenerationHaltedError };
