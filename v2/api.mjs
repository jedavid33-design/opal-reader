// Opal Reader v2 — command API (P2 skeleton).
//
// POST /v2/commands forwards a durable command to the coordinator and
// returns its receipt. GET routes serve coordinator read models and are
// PURE (invariant I2): the coordinator instance they receive is wrapped
// so its SQL facade accepts SELECT statements only — a GET handler holds
// no write capability in scope, and the I2 test snapshots the whole
// store across every GET route to prove it.

import { GenerationCoordinator, deriveChapterState } from "./coordinator.mjs";

function readOnlyCoordinator(state, env) {
  const guard = sql => ({
    exec(query, ...params) {
      if (!/^\s*(SELECT|WITH)\b/i.test(query))
        throw new Error("read-only facade: only SELECT is permitted on GET routes");
      return sql.exec(query, ...params);
    },
  });
  const roState = { storage: {
    sql: guard(state.storage.sql),
    transactionSync() { throw new Error("read-only facade: no transactions on GET routes"); },
    getAlarm() { return null; }, setAlarm() {}, deleteAlarm() {},
  } };
  return new GenerationCoordinator(roState, { ...env, ASSUME_SCHEMA: true });
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status, headers: { "content-type": "application/json" },
  });
}

// env.COORDINATOR is the account coordinator's stub-like handle:
//   { handleCommand(cmd), handleReport(r), query(name, arg) }
// In production this wraps the Durable Object stub; in tests it wraps a
// harness instance directly.
export function createApi(env) {
  return async function handle(request, coordinatorState) {
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (request.method === "POST" && path === "/v2/commands") {
        const cmd = await request.json();
        const coord = new GenerationCoordinator(coordinatorState, env);
        return json(200, await coord.handleCommand(cmd));
      }
      if (request.method === "POST" && path === "/v2/reports") {
        const report = await request.json();
        const coord = new GenerationCoordinator(coordinatorState, env);
        return json(200, await coord.handleReport(report));
      }
      if (request.method === "GET") {
        const ro = readOnlyCoordinator(coordinatorState, env);
        if (path.startsWith("/v2/commands/")) {
          const id = decodeURIComponent(path.slice("/v2/commands/".length));
          const receipt = ro.receipt(id);
          return receipt ? json(200, receipt) : json(404, { error: "command_not_found" });
        }
        if (path.startsWith("/v2/jobs/")) {
          const id = decodeURIComponent(path.slice("/v2/jobs/".length));
          const view = ro.jobView(id);
          return view ? json(200, view) : json(404, { error: "job_not_found" });
        }
        if (path === "/v2/quota") return json(200, ro.quotaView());
        if (path === "/v2/settings") return json(200, ro.settingsView());
        if (path === "/v2/conflicts") return json(200, { conflicts: ro.conflictsView() });
        if (path === "/v2/chapter-state") {
          const jobId = url.searchParams.get("job");
          const view = ro.jobView(jobId);
          if (!view) return json(404, { error: "job_not_found" });
          return json(200, { state: deriveChapterState(
            view.occurrences.map(o => o.state), [view.state]) });
        }
        return json(404, { error: "route_not_found" });
      }
      return json(405, { error: "method_not_allowed" });
    } catch (e) {
      return json(500, { error: String(e && e.message || e) });
    }
  };
}
