// Opal Reader v2 — HTTP transport for the client store (Part 1, B3/B5).
//
// Implements the transport contract the client store and surfaces were
// built against (sendCommand / snapshot / pullChanges / pushPosition /
// byteCheck / quotaView / positionView) over the sync HTTP routes in
// v2/p8/sync-contracts.md. The token lives only in memory on the client
// (entered by the user); it is never persisted by this module.
export function createHttpTransport({
  baseUrl, token, deviceId,
  scope = "staging-smoke", instance = "smoke-p8",
  fetchFn, idGen,
} = {}) {
  if (!baseUrl) throw new Error("transport baseUrl required");
  const base = String(baseUrl).replace(/\/+$/, "");
  const fetchImpl = fetchFn ?? ((...args) => globalThis.fetch(...args));
  const newId = () => (idGen ? idGen()
    : (globalThis.crypto?.randomUUID?.() || `cmd-${Date.now()}-${Math.random().toString(36).slice(2)}`));

  async function request(path, { method = "GET", body } = {}) {
    const headers = {
      "x-opalreader-token": token ?? "",
      "x-opalreader-scope": scope,
      "x-opalreader-instance": instance,
    };
    if (body !== undefined) headers["content-type"] = "application/json";
    const res = await fetchImpl(base + path, {
      method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch { data = null; }
    if (!res.ok) {
      const err = new Error(data?.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.body = data;
      throw err;
    }
    return data;
  }

  return {
    sendCommand: (cmd) => request("/v2/commands", { method: "POST", body: cmd }),

    snapshot: (family) => request(`/v2/sync/snapshot?family=${encodeURIComponent(family)}`),

    // The store calls pullChanges(family, cursorOrSeq, limit): a number
    // is a bare sequence; an object is the coordinator's pinned cursor.
    pullChanges(family, cursorOrSeq = 0, limit = 200) {
      const q = new URLSearchParams({ family, limit: String(limit) });
      if (cursorOrSeq && typeof cursorOrSeq === "object") q.set("cursor", JSON.stringify(cursorOrSeq));
      else q.set("sinceSeq", String(cursorOrSeq ?? 0));
      return request(`/v2/sync/changes?${q.toString()}`);
    },

    // Maps the coordinator's PushPositionEvents outcomes into the
    // store's { receipts, rejected, tip, journalGaps } shape (the route
    // performs the same mapping server-side; this is a pass-through).
    async pushPosition(bookId, events, knownTip) {
      void knownTip; // causal base travels on each event (baseSeq)
      return request("/v2/sync/position", {
        method: "POST",
        body: { commandId: newId(), deviceId, bookId, events },
      });
    },

    async byteCheck(cacheKey) {
      const r = await request(`/v2/sync/byte-check/${encodeURIComponent(cacheKey)}`);
      return !!r?.exists;
    },

    quotaView: () => request("/v2/quota"),

    positionView: (bookId) => request(`/v2/sync/position/${encodeURIComponent(bookId)}`),
  };
}
