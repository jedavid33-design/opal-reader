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
  const denied = productionGate(request, env, cors,
    { skipClientToken: isOperatorRoute || isDiagnosticsRoute
        || isPhaseBindingRoute || isRetirePlanRoute
        || isReleaseQuarantineRoute });
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
      || isReleaseQuarantineRoute) {
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
