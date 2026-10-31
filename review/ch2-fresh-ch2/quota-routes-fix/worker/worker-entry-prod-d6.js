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
import { GenerationCoordinator } from "./coordinator.mjs";
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
        const result = await d6Service(coord, d6HostEnv(this.env, cache))
          .attemptDiagnostics({
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
        const rawBody = await request.text().catch(() => "");
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

  async alarm() {
    // The coordinator's own alarm first (schedule, leases, parks),
    // then the D6 driver's recovery + continuation. While halted,
    // d6HostEnv wires no sendGrant, so driveOnce can settle plan
    // state and re-derive grants but nothing can leave the outbox.
    await super.alarm();
    const cache = await this._cache();
    const coord = new GenerationCoordinator(this.state, d6HostEnv(this.env, cache));
    const service = d6Service(coord, d6HostEnv(this.env, cache));
    await service.recover();
    await service.driveOnce();
    await cache.flush();
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
  const denied = productionGate(request, env, cors,
    { skipClientToken: isOperatorRoute || isDiagnosticsRoute
        || isPhaseBindingRoute || isRetirePlanRoute
        || isReleaseQuarantineRoute || isReconcileRoute
        || isAdjudicateRoute || isQuotaBootstrapRoute
        || isQuotaDisposeRoute || isQuotaReconcileRoute });
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
      || isQuotaDisposeRoute || isQuotaReconcileRoute) {
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
    for (const k of ["planId", "jobId", "limit", "cursor"])
      if (url.searchParams.get(k) !== null)
        dUrl.searchParams.set(k, url.searchParams.get(k));
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
    const quotaBootstrapText = await request.text().catch(() => "");
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

export default { fetch: fetchHandler, queue: queueHandler };
export { fetchHandler, queueHandler, GenerationHaltedError };
