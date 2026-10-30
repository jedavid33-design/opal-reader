// Opal Reader v2 — command API (P2 skeleton).
//
// POST /v2/commands forwards a durable command to the coordinator and
// returns its receipt. GET routes serve coordinator read models and are
// PURE (invariant I2): the coordinator instance they receive is wrapped
// so its SQL facade accepts SELECT statements only — a GET handler holds
// no write capability in scope, and the I2 test snapshots the whole
// store across every GET route to prove it.

import { GenerationCoordinator, MIGRATION_COMMAND_TYPES, deriveChapterState } from "./coordinator.mjs";

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
        // D3-1 fail-closed backup (Rowan D3 re-review 6356184643):
        // on the PRODUCTION surface the legacy whole-book command
        // MigrateImportBindings is refused outright — chunking is
        // the D1-mandated execution shape, and the whole-book path
        // would prime without row/byte limits. The surface mark is
        // the scope header the worker entries set from their own
        // surface and the DO class validates against its
        // _expectedScope() hook before dispatching here
        // ("production" is PRODUCTION_SCOPE in
        // v2/worker-entry-prod.js); a request carrying that mark
        // is refused before any coordinator state is touched,
        // before preparing/priming, and before any command is
        // recorded. The production entry fence and the DO class's
        // _migrationChunkRequired hook refuse the same type ahead
        // of this layer; this is the last fence, not the only one.
        // Staging-marked and unmarked requests are unaffected:
        // staging keeps the whole-book command exactly as reviewed.
        if (cmd && cmd.type === "MigrateImportBindings" &&
            request.headers.get("x-opalreader-scope") === "production")
          return json(403, { error: "migration_chunk_required" });
        // Option D admission (design §3.3.1): a migration command
        // on this route is SUBMITTED, not executed — the
        // coordinator validates it (shape + pins) and stores it
        // inert as pending_operator under a server-computed hash.
        // No operator mark is consulted here: submission is a
        // client-credential act, and a client-supplied mark header
        // admits nothing on this route (the entry overwrites it
        // unconditionally in any case). Execution happens only
        // through the operator-only approval route below. Submit
        // does zero R2 work, so the G1 hydration seam does not
        // run for migration commands.
        if (cmd && MIGRATION_COMMAND_TYPES.includes(cmd.type)) {
          const coord = new GenerationCoordinator(coordinatorState, env);
          const view = coord.submitMigrationCommand(cmd);
          return json(view && view.ok === false ? 400 : 200, view);
        }
        // G1 scoped hydration: the synchronous probe paths
        // (AdoptAudio, outcome reconciliation) consult the request
        // snapshot. Hydrate exactly the keys this command names —
        // its payload cache key, and the cache keys recorded for
        // its job's occurrences — never the whole index.
        if (typeof env.hydrateCacheKey === "function" && cmd) {
          const keys = new Set();
          const p = cmd.payload || {};
          if (typeof p.cacheKey === "string" && p.cacheKey) keys.add(p.cacheKey);
          if (typeof p.jobId === "string" && p.jobId) {
            try {
              for (const r of coordinatorState.storage.sql.exec(
                  `SELECT cache_key FROM occurrences WHERE job_id = ?`, p.jobId).toArray())
                if (r.cache_key) keys.add(r.cache_key);
            } catch { /* schema not yet created: nothing to hydrate */ }
          }
          for (const k of keys) await env.hydrateCacheKey(k);
        }
        const coord = new GenerationCoordinator(coordinatorState, env);
        return json(200, await coord.handleCommand(cmd));
      }
      // Option D operator routes (design §3.3.1): the ONLY two
      // operator surfaces. Each is an exact path + method
      // allowlist entry, admitted solely under the server-set
      // forwarded approval mark (the worker entry checks the
      // operator credential and overwrites the mark header
      // unconditionally; a client-supplied mark is worthless).
      // Their bodies are schema-fenced to carry NO command
      // content: an approval names an existing command id + its
      // hash; a reconciliation names an existing record + a
      // requested outcome + an evidence citation. Anything else
      // is a malformed refusal, storing nothing.
      if (request.method === "POST" &&
          (path === "/v2/command-approvals" || path === "/v2/command-reconciliation")) {
        if (request.headers.get("x-opalreader-operator-admitted") !== "1")
          return json(403, { error: "migration_operator_required" });
        let body;
        try { body = await request.json(); }
        catch { return json(422, { error: "malformed_operator_request" }); }
        const isObj = body && typeof body === "object" && !Array.isArray(body);
        const keys = isObj ? Object.keys(body) : [];
        const coord = new GenerationCoordinator(coordinatorState, env);
        if (path === "/v2/command-approvals") {
          if (!isObj || keys.some(k => !["commandId", "payloadSha256", "action"].includes(k)) ||
              typeof body.commandId !== "string" || !body.commandId ||
              typeof body.payloadSha256 !== "string" ||
              !/^[a-f0-9]{64}$/.test(body.payloadSha256) ||
              (body.action !== undefined && body.action !== "approve" && body.action !== "reject"))
            return json(422, { error: "malformed_approval" });
          const r = await coord.approveMigrationCommand(body);
          return r && r.ok === false ? json(404, r) : json(200, r);
        }
        if (!isObj || keys.some(k => !["commandId", "outcome", "evidence"].includes(k)) ||
            typeof body.commandId !== "string" || !body.commandId ||
            (body.outcome !== "applied" && body.outcome !== "refused") ||
            !body.evidence || typeof body.evidence !== "object" || Array.isArray(body.evidence))
          return json(422, { error: "malformed_reconciliation" });
        const r = coord.reconcileMigrationCommand(body);
        if (r && r.ok === false)
          return json(r.error === "pending_command_not_found" ? 404 : 409, r);
        return json(200, r);
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
          // Option D read contract (§3.3.4): a two-phase record
          // answers with its state VIEW (projected, never
          // persisted — this facade is SELECT-only, so the read
          // cannot write by construction); legacy commands keep
          // the pre-existing receipt shape.
          const receipt = ro.commandReceiptView(id);
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
