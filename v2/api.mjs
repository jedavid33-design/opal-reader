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
//
// Part 1 (P8 integration) adds the sync HTTP transport the client store
// presumes — snapshot / pullChanges / pushPosition / byteCheck /
// positionView — over the same coordinator substrate. Exact wire shapes
// live in v2/p8/sync-contracts.md. Authentication and staging-scope
// enforcement live in the worker entry (v2/worker-entry.js), NOT here:
// this module is only reachable behind that shell in production, and no
// route in it can address v1-shaped (KV/book-record) data — every route
// reads or writes the coordinator's own tables only.
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
      if (request.method === "POST" && path === "/v2/sync/position") {
        const body = await request.json();
        const bookId = body?.bookId;
        const events = Array.isArray(body?.events) ? body.events : null;
        const commandId = body?.commandId ?? body?.command_id;
        if (!bookId || !events || !commandId)
          return json(422, { error: "invalid_position_push",
                             detail: "commandId, bookId and events[] are required" });
        const coord = new GenerationCoordinator(coordinatorState, env);
        const receipt = await coord.handleCommand({
          command_id: commandId, type: "PushPositionEvents",
          payload: { deviceId: body.deviceId ?? events[0]?.deviceId ?? null, bookId, events },
        });
        if (receipt.outcome !== "applied")
          return json(409, { error: "position_push_rejected", receipt });
        const view = coord.positionView(bookId);
        const receipts = [], rejected = [];
        for (const o of receipt.outcomes || []) {
          if (o.status === "accepted" || o.status === "replay")
            receipts.push({ eventId: o.eventId, receiptSeq: o.receiptSeq, superseded: !!o.superseded });
          else
            rejected.push({ eventId: o.eventId, reason: o.reason || o.status });
        }
        return json(200, { receipt, receipts, rejected,
                           tip: view.asOfReceiptSeq, journalGaps: view.journalGaps });
      }
      if (request.method === "GET") {
        const ro = readOnlyCoordinator(coordinatorState, env);
        if (path === "/v2/sync/snapshot") {
          const family = url.searchParams.get("family");
          const snap = ro.syncSnapshot({ family });
          return snap.error ? json(400, snap) : json(200, snap);
        }
        if (path === "/v2/sync/changes") {
          const family = url.searchParams.get("family");
          const sinceSeq = Number(url.searchParams.get("sinceSeq") ?? 0);
          const limit = Number(url.searchParams.get("limit") ?? 200);
          let cursor;
          const rawCursor = url.searchParams.get("cursor");
          if (rawCursor) {
            try { cursor = JSON.parse(rawCursor); }
            catch { return json(400, { error: "invalid_cursor", reason: "not_json" }); }
          }
          const page = ro.pullChanges({ family, sinceSeq, limit, cursor });
          return page.error ? json(400, page) : json(200, page);
        }
        if (path.startsWith("/v2/sync/position/")) {
          const bookId = decodeURIComponent(path.slice("/v2/sync/position/".length));
          return json(200, ro.positionView(bookId));
        }
        if (path.startsWith("/v2/sync/byte-check/")) {
          const cacheKey = decodeURIComponent(path.slice("/v2/sync/byte-check/".length));
          if (!/^[a-f0-9]{64}$/.test(cacheKey))
            return json(400, { error: "invalid_cache_key" });
          let exists;
          if (typeof env.byteCheck === "function") exists = !!(await env.byteCheck(cacheKey));
          else if (env.probe && typeof env.probe.exists === "function") exists = !!env.probe.exists(cacheKey);
          else return json(503, { error: "byte_check_unavailable" });
          return json(200, { cacheKey, exists });
        }
        if (path.startsWith("/v2/migration/book/")) {
          const bookId = decodeURIComponent(path.slice("/v2/migration/book/".length));
          return json(200, ro.migrationBookView(bookId));
        }
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
