// Opal Reader v2 — preview Shelf transport: LOCAL FIXTURE ONLY.
//
// B7 safety round (Rowan 6346291349). The preview previously offered
// a user-entered "Shelf API base" and a live "Flush outbox", which
// could have POSTed synthetic smoke sessions to Julie's real Shelf
// if its actual URL were entered — inconsistent with the staging
// premise of smoke-only, no live Shelf contact. That capability is
// removed BY CONSTRUCTION:
//
//   * There is no Shelf URL input anywhere in the preview, and no
//     configurable Shelf base URL in the bundle. The only base is
//     this module's fixed fixture label, used solely so the bridge
//     will run its flush discipline at all.
//   * The bridge's fetch seam is the function below. It performs NO
//     network I/O: it answers the Shelf POST /api/sessions contract
//     from an in-memory fixture (accept, 200) and records every
//     session payload the bridge hands it, in order, so the preview
//     can display exactly what WOULD have been sent.
//
// FIFO behavior, merge rules, overlap carving and the rest of the
// frozen bridge contract are untouched — they live in the bridge and
// stay covered by the harness replay tests. A live Shelf integration
// is a separate, later, explicitly authorized gate; nothing in this
// bundle can reach one.

export const FAKE_SHELF_BASE = "local-fixture://shelf";

export function createFakeShelfTransport() {
  const sent = []; // session payloads, in the order the bridge flushed them
  async function fetchFn(url, init = {}) {
    const target = String(url);
    const method = String(init.method || "GET").toUpperCase();
    if (method !== "POST" || !target.endsWith("/api/sessions"))
      return Response.json(
        { error: "local fixture: only POST /api/sessions exists here" },
        { status: 404 });
    let payload = null;
    try { payload = JSON.parse(init.body || "null"); } catch { payload = null; }
    if (!payload || typeof payload !== "object")
      return Response.json(
        { error: "local fixture: session payload must be a JSON object" },
        { status: 400 });
    sent.push(structuredClone(payload));
    return Response.json({ ok: true, fixture: true, recorded: sent.length }, { status: 200 });
  }
  return { fetchFn, sent, base: FAKE_SHELF_BASE };
}
