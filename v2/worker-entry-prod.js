// Opal Reader v2 — PRODUCTION worker entry (P8 D3; cutover plan §S4
// as corrected, Rowan plan reviews 6355302486 / 6355404829, D1
// sign-off 6355565715).
//
// This is the entry of the NEW script `opalreader-api-v2-prod`
// (deploy spec: v2/p8/deploy-spec-prod.json). It exists because the
// plan's P1 correction disproved the earlier claim that the
// staging script could serve production through a cross-script
// Durable Object binding: the owner script's code and env are what
// run. So the production surface is its own script, and:
//
//   * It OWNS its coordinator class. `OpalReaderCoordinatorProd`
//     (below) is defined by THIS entry and bound by THIS script's
//     own Durable Object namespace, created by THIS script's own
//     migration (deploy-spec-prod.json: new_sqlite_classes
//     ["OpalReaderCoordinatorProd"], new_tag "v1" — migration
//     tags are per-script/per-namespace, so this "v1" is the first
//     migration on the production namespace and is unrelated to
//     the staging script's "v1" on its namespace). The class
//     subclasses the staging entry's class and overrides only the
//     three surface hooks (scope, scope refusal, R2 namespace
//     rule); the coordinator logic behind the fences is shared
//     verbatim. The staging script is never re-scoped, and its
//     operator credential stays unset forever.
//   * Its scope is "production" and its only routable instance is
//     "account". The staging instance "smoke-p8" is REFUSED here,
//     exactly as "account" is refused on the staging surface —
//     the fences are disjoint by construction, in both directions.
//   * Its R2 namespace is the production shape: NO key prefix
//     (audio/<cacheKey>.<ext>), and the class refuses to construct
//     its cache if a prefix is ever configured — a production
//     upload carrying an R2_KEY_PREFIX binding fails closed
//     before any R2 contact rather than silently reading a
//     prefixed namespace. (The deploy spec carries no such
//     binding; its absence IS the production shape.)
//   * GENERATION_HALT is "1" and there is NO queue binding and NO
//     queue handler export at all: nothing on this script can
//     consume `opalreader-generation` (whose single consumer
//     stays the frozen v1 worker) and nothing can deliver to it.
//     There are no provider secrets on this script.
//   * Migration commands are operator-fenced exactly as on the
//     staging surface: the distinct secret
//     OPALREADER_MIGRATION_OPERATOR_TOKEN, unset (or equal to the
//     client token) means migration is unreachable. Both secrets
//     are set by Julie herself at D2; their VALUES appear nowhere
//     in this repo — the deploy spec records names only.
//
// DO-state rollback truth (plan §S4): deleting this Worker script
// does NOT necessarily delete a created Durable Object database.
// Before any import, the production namespace's account instance
// holds no imported state and is read by no client — an empty,
// inert store — so a pre-import rollback is "delete the script";
// any storage left behind is empty and inert, and explicitly
// deleting it is a separate reviewed step. After imports begin,
// state rollback is unnecessary by design: imported books stay
// invisible until the global repoint (D5), which is Pages-side
// with its own rollback.
//
// This module authorizes nothing by existing: D2 (the upload) is
// a separate Julie-approved gate, and no upload has been performed
// from it.
import {
  OpalReaderCoordinator, GenerationHaltedError,
  json, corsHeaders,
} from "./worker-entry.js";
import { MIGRATION_COMMAND_TYPES } from "./coordinator.mjs";
import { BUILD_VERSION, BUILD_COMMIT } from "./host/build-identity.mjs";

export const PRODUCTION_SCOPE = "production";
export const PRODUCTION_INSTANCE = "account";

const INTERNAL_HEADER = "x-opalreader-internal";
const TOKEN_ERROR_BODY = { error: "The personal access token is missing or incorrect." };

// Named fail-closed error for the production R2 namespace: the
// production cache is constructed ONLY with no key prefix. Thrown
// by OpalReaderCoordinatorProd._cache() (via the surface hook)
// BEFORE the audio cache is constructed — hence before any R2
// bucket operation can occur — whenever R2_KEY_PREFIX is set to
// anything at all on this surface.
export class ProductionR2NamespaceError extends Error {
  constructor(actual) {
    super(`production scope forbids R2_KEY_PREFIX (got ${
      actual === undefined || actual === "" ? "unset" : JSON.stringify(actual)
    }); refusing all R2 contact`);
    this.name = "ProductionR2NamespaceError";
    this.code = "production_r2_prefix_forbidden";
  }
}

// The production coordinator class: the class this script's own
// Durable Object namespace binds. Only the surface hooks differ
// from the staging class — the scope internal callers must
// declare, the refusal naming a wrong one, and the namespace rule
// (no prefix, ever). See v2/worker-entry.js for the shared
// implementation.
export class OpalReaderCoordinatorProd extends OpalReaderCoordinator {
  _expectedScope() { return PRODUCTION_SCOPE; }
  _scopeRequiredError() { return "production_scope_required"; }
  _enforceR2Namespace(keyPrefix) {
    if (keyPrefix !== "") throw new ProductionR2NamespaceError(keyPrefix);
  }
}

// Deny-by-default production gate for the public fetch surface —
// the mirror of the staging gate, with the same F-A discipline:
// every refusal carries the allowlisted CORS headers (the Origin
// is echoed solely on an exact match with env.ALLOWED_ORIGIN);
// statuses, bodies, and gate order mirror the staging surface
// with production values.
function productionGate(request, env, cors) {
  if (env.OPALREADER_V2_SCOPE !== PRODUCTION_SCOPE)
    return json(403, { error: "production_scope_required" }, cors);
  if (request.headers.get("x-opalreader-scope") !== PRODUCTION_SCOPE)
    return json(403, { error: "production_scope_required" }, cors);
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
  // No v1-shaped route exists in this worker either — by
  // construction: the only surfaces are /health and /v2/*.
  if (!url.pathname.startsWith("/v2/"))
    return json(404, { error: "route_not_found" }, cors);
  const denied = productionGate(request, env, cors);
  if (denied) return denied;
  // Production routes ONLY the account instance, named explicitly.
  // "smoke-p8" (and anything else) is denied BEFORE the DO
  // namespace is touched, so no staging-shaped request can
  // instantiate — let alone write to — the production coordinator
  // through a wrong instance name, and no request can reach the
  // smoke instance from this script at all.
  const instance = request.headers.get("x-opalreader-instance");
  if (instance !== PRODUCTION_INSTANCE)
    return json(403, { error: "production_instance_required" }, cors);
  // G2 operator admission fence — identical discipline to the
  // staging surface (see v2/worker-entry.js): the migration
  // command types are operator-only; the credential is a DISTINCT
  // secret, never the client access token; unset means CLOSED.
  // Refusals happen before the coordinator namespace is touched;
  // admission is marked on the forwarded internal request
  // (overwritten unconditionally) and re-checked at the API layer.
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
  forwarded.headers.set("x-opalreader-scope", PRODUCTION_SCOPE);
  forwarded.headers.set("x-opalreader-operator-admitted", operatorAdmitted ? "1" : "0");
  const response = await stub.fetch(forwarded);
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(cors)) headers.set(k, v);
  return new Response(response.body, { status: response.status, headers });
}

// Deliberately NO queue handler: this script binds no queue (the
// deploy spec declares none), so there is no consumer to attach
// and no producer to deliver with. `opalreader-generation` keeps
// exactly one consumer — the frozen v1 worker — and stays paused.
export default { fetch: fetchHandler };
export { fetchHandler, GenerationHaltedError };
