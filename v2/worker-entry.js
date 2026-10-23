// Opal Reader v2 — worker entry shell (Part 1, B1/B2).
//
// The executable host the merged tree lacked: an ES-module Worker entry
// exporting the fetch handler, the queue handler, and the coordinator
// Durable Object class. The frozen v1 worker is a different script and
// is never touched by this module; this entry exposes NO v1-shaped
// route — every non-/health, non-/v2/* path is a 404 by construction.
//
// Access model (Part 1 decision, v2/p8/part1-decisions.md): deny by
// default. /health is public and identifies the build only. Every
// /v2/* route requires (a) the worker's configured scope to be exactly
// "staging-smoke", (b) the request to declare that same scope, and
// (c) the staging access token (a distinct value Julie sets on this
// script at Part 2 time — never copied from the v1 script). A missing
// token configuration denies access; it never opens it.
//
// Instance routing (B7 revision, Rowan 6345016639): while this script
// is scoped staging-smoke, the ONLY routable coordinator instance is
// the synthetic smoke instance "smoke-p8", and it must be named
// explicitly. There is no "account" default and "account" is not
// accepted: no request reaching this script can instantiate — let
// alone write to — the future production DO. Production-instance
// routing is a deliberate, separately authorized routing change that
// belongs to migration/cutover (see decisions doc, D2 amendment); it
// is not a header value or config flip available to the staging
// script.
//
// R2 namespace (B7 safety round, Rowan 6346291349): the smoke
// instance's `smoke-p8/` key prefix is enforced in code, not only in
// the deploy spec. While scoped staging-smoke, _cache() refuses to
// construct the audio cache unless R2_KEY_PREFIX is exactly
// "smoke-p8/", failing closed with StagingR2NamespaceError before
// any R2 contact — so an omitted or misconfigured binding can never
// silently fall back to the production `audio/<key>` namespace in
// the shared bucket. Unprefixed cache behavior remains only for a
// future, deliberately authorized production build.
//
// Generation is fail-closed: while GENERATION_HALT is set (the staging
// value), the queue handler refuses with a named error before any
// coordinator or provider contact, the coordinator is constructed
// WITHOUT a queue delivery function (outbox rows stay visibly unsent),
// and the provider adapters refuse again at the synthesis seam.
import { createApi } from "./api.mjs";
import { GenerationCoordinator, MIGRATION_COMMAND_TYPES } from "./coordinator.mjs";
import { createExecutor } from "./executor.mjs";
import {
  GenerationHaltedError, assertGenerationEnabled,
  createProviderAdapters, createR2AudioCache, createContentWorkSource,
} from "./host/adapters.mjs";
import { BUILD_VERSION, BUILD_COMMIT } from "./host/build-identity.mjs";

export const STAGING_SCOPE = "staging-smoke";
export const SMOKE_INSTANCE = "smoke-p8";
export const SMOKE_R2_KEY_PREFIX = "smoke-p8/";

// Named fail-closed error for the staging R2 namespace (B7 safety
// round, Rowan 6346291349). Thrown by OpalReaderCoordinator._cache()
// BEFORE the audio cache is constructed — hence before any R2 bucket
// operation can occur — whenever this script is scoped staging-smoke
// but R2_KEY_PREFIX is anything other than exactly "smoke-p8/". The
// isolation claim must not depend on error-free upload metadata: a
// staging upload with the binding omitted or misconfigured refuses
// all R2 contact instead of silently reading/writing the production
// `audio/<key>` namespace in the shared bucket.
export class StagingR2NamespaceError extends Error {
  constructor(actual) {
    super(`staging scope requires R2_KEY_PREFIX "${SMOKE_R2_KEY_PREFIX}" (got ${
      actual === undefined || actual === "" ? "unset" : JSON.stringify(actual)
    }); refusing all R2 contact`);
    this.name = "StagingR2NamespaceError";
    this.code = "staging_r2_namespace_required";
  }
}
const INTERNAL_HEADER = "x-opalreader-internal";
const TOKEN_ERROR_BODY = { error: "The personal access token is missing or incorrect." };

function json(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status, headers: { "content-type": "application/json", ...extraHeaders },
  });
}

function corsHeaders(request, env) {
  const origin = request.headers.get("origin");
  if (origin && env.ALLOWED_ORIGIN && origin === env.ALLOWED_ORIGIN)
    return { "access-control-allow-origin": origin, vary: "Origin" };
  return {};
}

// The coordinator's environment for one DO operation. `cache` is the
// request-scoped R2 snapshot (see adapters.mjs for why the snapshot
// exists and what its limits are). sendGrant is wired ONLY when
// generation is explicitly enabled; in the staging configuration the
// coordinator's outbox simply has no delivery function, so grants stay
// unsent and visible rather than leaking toward the queue.
function hostEnv(env, cache) {
  const generationEnabled = env.GENERATION_HALT === "0";
  return {
    ...env,
    probe: cache ? cache.probe : undefined,
    // G1 scoped hydration seam: the API layer hydrates exactly the
    // keys a command names (its payload cache key; its job's
    // recorded occurrence keys) before the coordinator's
    // synchronous probe paths run. Nothing hydrates the index.
    hydrateCacheKey: cache ? (key) => cache.hydrateKey(key) : undefined,
    // Migration prime seam (design §2): bound to THIS request's
    // cache, hence to this script's enforced key prefix — under
    // the staging scope the prime can only ever see smoke-p8/
    // objects, so a migration import of real books fails closed
    // (object_missing) rather than validating production audio.
    migrationPrime: cache ? (key) => cache.primeForMigration(key) : undefined,
    byteCheck: cache ? (key) => cache.byteCheck(key) : async () => false,
    sendGrant: generationEnabled && env.OPALREADER_GENERATION?.send
      ? async (payload) => { await env.OPALREADER_GENERATION.send(payload); }
      : undefined,
  };
}

export class OpalReaderCoordinator {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    // Constructing once proves the schema self-creates on first use
    // (the coordinator's DDL is CREATE TABLE IF NOT EXISTS).
    this.coordinator = new GenerationCoordinator(state, hostEnv(env, null));
  }

  async _cache() {
    // B7 revision: the staging deploy spec sets R2_KEY_PREFIX to
    // "smoke-p8/", a non-overlapping namespace in the shared bucket,
    // so no staging write can land on a production audio key. The
    // future production configuration sets no prefix and keeps the
    // production key shape.
    //
    // B7 safety round (Rowan 6346291349): the namespace is enforced
    // HERE, in code — this method is the single construction gate
    // every R2 access in this DO flows through (fetch, _execute,
    // alarm). While the scope is staging-smoke, the cache may only
    // be constructed with R2_KEY_PREFIX exactly "smoke-p8/"; any
    // other value (missing, empty, wrong) throws
    // StagingR2NamespaceError before createR2AudioCache runs, so no
    // bucket operation — get, head, or put — can occur on violation.
    // Any other scope (a future, deliberately authorized production
    // build) keeps the unprefixed-or-configured behavior unchanged.
    const keyPrefix = this.env.R2_KEY_PREFIX || "";
    if (this.env.OPALREADER_V2_SCOPE === STAGING_SCOPE && keyPrefix !== SMOKE_R2_KEY_PREFIX)
      throw new StagingR2NamespaceError(this.env.R2_KEY_PREFIX);
    // G1 (Rowan re-review 6354569652): NO eager index hydration.
    // The pre-correction cache downloaded EVERY indexed object's
    // bytes on EVERY request; at the approved freeze's scale
    // (1,798 objects, ≈5.35 GB) the first post-import request
    // would fetch and hold the entire corpus to answer a settings
    // read. The snapshot now starts empty per request and fills
    // only with keys a surface names: the migration prime (its own
    // rows), byteCheck (its one key), and the API's scoped command
    // hydration (a command's payload key + its job's keys).
    return createR2AudioCache(this.env.OPALREADER_STORAGE, { keyPrefix });
  }

  // The cache keys a job's occurrences have recorded — the whole
  // set an executor message for that job can legitimately touch.
  _jobCacheKeys(jobId) {
    try {
      return this.state.storage.sql.exec(
        `SELECT DISTINCT cache_key FROM occurrences WHERE job_id = ?`, jobId)
        .toArray().map(r => r.cache_key).filter(Boolean);
    } catch { return []; }
  }

  async fetch(request) {
    if (request.headers.get(INTERNAL_HEADER) !== "1")
      return json(403, { error: "internal_only" });
    if (request.headers.get("x-opalreader-scope") !== STAGING_SCOPE)
      return json(403, { error: "staging_scope_required" });
    const url = new URL(request.url);
    try {
      if (url.pathname === "/internal/execute" && request.method === "POST")
        return await this._execute(await request.json());
      const cache = await this._cache();
      const api = createApi(hostEnv(this.env, cache));
      const response = await api(request, this.state);
      await cache.flush();
      return response;
    } catch (e) {
      if (e instanceof GenerationHaltedError)
        return json(423, { error: e.code, detail: e.message });
      return json(500, { error: String(e && e.message || e) });
    }
  }

  async _execute(message) {
    // Layer 2 of the halt: even a hand-delivered internal execute
    // refuses while the flag is set (layer 1 is the queue handler,
    // layer 3 is the provider seam).
    assertGenerationEnabled(this.env);
    if (!message || !message.grantId || !message.jobId || !Array.isArray(message.occurrences))
      return json(422, { error: "invalid_grant_message" });
    const cache = await this._cache();
    // Scoped hydration (G1): the executor's synchronous cache
    // phase may only touch this message's job — hydrate its
    // recorded occurrence keys; synthesis keys are primed per
    // occurrence by the work source, as before.
    await cache.hydrateKeys(this._jobCacheKeys(message.jobId));
    const coord = new GenerationCoordinator(this.state, hostEnv(this.env, cache));
    const executor = createExecutor({
      coordinator: coord,
      providers: createProviderAdapters(this.env),
      cache,
      consumerId: this.env.EXECUTOR_CONSUMER_ID || "opalreader-v2-worker",
      workSource: createContentWorkSource(coord, { cache }),
    });
    const result = await executor.handleMessage(message);
    await cache.flush();
    return json(200, result);
  }

  async alarm() {
    const cache = await this._cache();
    const coord = new GenerationCoordinator(this.state, hostEnv(this.env, cache));
    await coord.alarm();
    await cache.flush();
  }
}

// Deny-by-default staging gate for the public fetch surface. Returns a
// Response when access is denied, null when the request may proceed.
//
// F-A (preview session finding; Rowan close review 6353069802, fix
// shape approved 6353186341): every refusal carries the SAME
// allowlisted CORS headers fetchHandler puts on its other public
// responses. Without them, a browser at the allowlisted origin cannot
// read a refusal at all — the fetch rejects as a network error
// ("Load failed") and the real 401/403/503 is undisplayable, which is
// what the device-acceptance session hit. The headers come ONLY from
// corsHeaders(request, env): the Origin is echoed solely on an exact
// match with env.ALLOWED_ORIGIN, never a wildcard; for any other or
// absent Origin the refusal is byte-for-byte what it was before this
// change. Statuses, bodies, gate order, and fail-closed behavior are
// unchanged — a refusal simply becomes readable.
function stagingGate(request, env, cors) {
  if (env.OPALREADER_V2_SCOPE !== STAGING_SCOPE)
    return json(403, { error: "staging_scope_required" }, cors);
  if (request.headers.get("x-opalreader-scope") !== STAGING_SCOPE)
    return json(403, { error: "staging_scope_required" }, cors);
  if (!env.OPALREADER_ACCESS_TOKEN)
    return json(503, { error: "staging_token_not_configured" }, cors);
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
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type, x-opalreader-token, x-opalreader-scope, x-opalreader-instance",
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
  // No v1-shaped route exists in this worker — by construction, not by
  // filtering: the only surfaces are /health and /v2/*.
  if (!url.pathname.startsWith("/v2/"))
    return json(404, { error: "route_not_found" }, cors);
  const denied = stagingGate(request, env, cors);
  if (denied) return denied;
  // B7 revision (6345016639): staging fails closed to the smoke
  // instance. The header must be explicitly "smoke-p8"; a missing
  // header, "account", or any other value is denied BEFORE the DO
  // namespace is touched, so no probe can instantiate the future
  // production instance from this script.
  const instance = request.headers.get("x-opalreader-instance");
  if (instance !== SMOKE_INSTANCE)
    return json(403, { error: "staging_instance_required" }, cors);
  // G2 operator admission fence (server entry; Rowan re-review
  // 6354569652): the migration command types are operator-only.
  // The credential is a DISTINCT secret (OPALREADER_MIGRATION_
  // OPERATOR_TOKEN), never the client access token — if the two
  // are configured to the same value the fence treats the operator
  // credential as not configured at all. Unset means CLOSED: in
  // every deployment built from the current deploy spec the secret
  // is absent, so migration commands are unreachable, full stop.
  // Refusals happen here, before the coordinator namespace is
  // touched; admission is marked on the forwarded internal request
  // (overwritten unconditionally below, so a client-supplied mark
  // is worthless) and re-checked at the API layer.
  let operatorAdmitted = false;
  if (request.method === "POST" && url.pathname === "/v2/commands") {
    let peek = null;
    try { peek = await request.clone().json(); } catch { peek = null; }
    if (peek && MIGRATION_COMMAND_TYPES.includes(peek.type)) {
      const operatorToken = env.OPALREADER_MIGRATION_OPERATOR_TOKEN;
      if (!operatorToken || operatorToken === env.OPALREADER_ACCESS_TOKEN)
        return json(503, { error: "migration_operator_not_configured" }, cors);
      if (request.headers.get("x-opalreader-operator-token") !== operatorToken)
        return json(403, { error: "migration_operator_required" }, cors);
      operatorAdmitted = true;
    }
  }
  if (!env.COORDINATOR)
    return json(503, { error: "coordinator_not_bound" }, cors);
  const stub = env.COORDINATOR.get(env.COORDINATOR.idFromName(instance));
  const forwarded = new Request(url.toString(), request);
  forwarded.headers.set(INTERNAL_HEADER, "1");
  forwarded.headers.set("x-opalreader-scope", STAGING_SCOPE);
  forwarded.headers.set("x-opalreader-operator-admitted", operatorAdmitted ? "1" : "0");
  const response = await stub.fetch(forwarded);
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(cors)) headers.set(k, v);
  return new Response(response.body, { status: response.status, headers });
}

async function queueHandler(batch, env) {
  // Layer 1 of the halt: refuse before touching the coordinator, the
  // queue binding, or any provider. The staging deploy spec registers
  // NO consumer for this handler, so in the staged configuration this
  // code is unreachable — it exists so that a future consumer attach
  // still cannot spend while the halt stands.
  assertGenerationEnabled(env);
  if (!env.COORDINATOR) throw new Error("coordinator_not_bound");
  const stub = env.COORDINATOR.get(env.COORDINATOR.idFromName("account"));
  for (const message of batch.messages) {
    try {
      const response = await stub.fetch(new Request("https://do.internal/internal/execute", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          [INTERNAL_HEADER]: "1",
          "x-opalreader-scope": STAGING_SCOPE,
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
