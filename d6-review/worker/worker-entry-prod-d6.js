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
//     POST /v2/d6-seed-storage forwards — behind the production
//     gate (scope + instance; its credential admission is the
//     SEED-FIX shape described below) — to
//     POST /internal/d6/seed-storage, where the service
//     refuses unless GENERATION_HALT is still "1" (seeding is a
//     pre-arming act only) and records the fresh recount with
//     provenance. The route was chosen over a command type
//     deliberately: it lives entirely in D6-owned files (the
//     coordinator's pinned two-hunk diff is untouched) and behind
//     the identical fence chain as the other D6 routes.
//   * G2 HARDENING (ENRICHMENT-DESIGN §3.2; Rowan review
//     6504846855) added the migration-operator credential to the
//     seed route, and the SEED-FIX CORRECTION (Rowan design pass
//     6509192325) changes that route's admission to the operator
//     credential ALONE — the same shape as the two Option D
//     operator routes: for this one route the production gate
//     skips its client-token check (the scope-config, scope-header,
//     and instance checks still run in full), and the operator
//     admission block below is the credential fence. The
//     dual-credential shape G2 shipped proved unreachable in
//     practice: the credential-exchange transport refuses any
//     request carrying two credential surrogates (HTTP 403
//     credential_ambiguity, transport-level — the Oct 29, 2026
//     arming attempt's seed call never reached this Worker; the
//     identical wall stopped the Oct 23, 2026 D4 pilot). The
//     operator credential remains mandatory: the admission block
//     stamps admission on the forward, and the DO class gate for
//     the internal seed route requires that stamp, so the route
//     cannot be reached on the internal header alone and the stamp
//     cannot be forged through public routing (the entry
//     overwrites it unconditionally). The invocation is
//     FIGURELESS (any caller-supplied figures are refused by the
//     service) and the worker recounts the bucket itself through
//     its R2 binding, cross-checked at zero tolerance against
//     RECORDED_STORAGE_BASE before any write.
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
      if (url.pathname === "/internal/d6/intent" && request.method === "POST") {
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
  // SEED-FIX: the seed route is admitted on the operator
  // credential alone, like the operator routes — the gate skips
  // its client-token check for this route only (the scope checks
  // inside the gate, and the instance check below, still run).
  const isSeedRoute = request.method === "POST" &&
    url.pathname === "/v2/d6-seed-storage";
  const denied = productionGate(request, env, cors,
    { skipClientToken: isOperatorRoute || isSeedRoute });
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
  }
  // SEED-FIX: the storage-seed route is fenced exactly like the
  // two Option D operator routes — admitted on the operator
  // header ALONE (the production gate above skipped the client
  // token for this route only; its scope checks and the instance
  // check still ran). Operator admission runs here; the client
  // token alone is refused, and so is any request without the
  // operator credential.
  let operatorAdmitted = false;
  if (isOperatorRoute || isSeedRoute) {
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
  // D6 storage seed (CORRECTION 2, hardened at G2, admission
  // corrected at SEED-FIX): POST /v2/d6-seed-storage has passed
  // the production gate's scope checks (scope config, scope
  // header — the gate's client-token check is skipped for this
  // route only), the instance check, AND the operator admission
  // block (operatorAdmitted is true here — admission failure
  // already returned), and forwards
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
