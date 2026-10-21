// Opal Reader v2 — assembled client, Stage 1: the save funnel.
//
// In the shipped client, EVERY book-record save flows through one funnel —
// `function pe()` in app-256.js (94 call sites, census-pinned) — which
// stamps `updatedAt` and pushes the whole record into a last-writer-wins
// merge. Stage 1 substitutes that seam: this module is the funnel's v2
// contract. Screens keep a local working copy; the funnel diffs it against
// the store's cached read model and expresses the change as durable
// commands (SyncPush / DeleteBook) through the store's outbox. Outcomes
// come back as receipts — a stale device's save returns a conflict naming
// the current revision, never a silent overwrite. There is no whole-record
// upload, no timestamp stamp, and no merge logic anywhere in this layer.

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  const ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
  if (ka.length !== kb.length) return false;
  return ka.every((k, i) => k === kb[i] && deepEqual(a[k], b[k]));
}

export function createFunnel({ store }) {
  if (!store) throw new Error("store required");
  const working = new Map(); // bookId -> working-copy payload (what screens edit)
  // The funnel's own revision ledger: what THIS device last saw or saved,
  // learned from receipts and cache refreshes. A save bases its CAS on the
  // ledger — never on 0 for a book the device already knows (base 0 means
  // "genuinely new"; basing a stale save on it would bypass the conflict
  // check entirely, which is exactly the v1 loss mode in new clothes).
  const knownRevisions = new Map(); // bookId -> revision

  function setWorking(bookId, payload) { working.set(bookId, structuredClone(payload)); }
  function getWorking(bookId) { const w = working.get(bookId); return w ? structuredClone(w) : null; }

  // The pe() replacement: persist the working copy of one book as intents.
  // Returns { skipped } when nothing changed, otherwise the command id;
  // outcomes are read from the store's outbox after flush (receipts only).
  async function saveBook(bookId) {
    const w = working.get(bookId);
    if (!w) return { skipped: true, reason: "no_working_copy" };
    const cached = await store.cachedEntity("content", bookId);
    if (cached && deepEqual(cached.payload, w)) return { skipped: true, reason: "unchanged" };
    const baseRevision = Math.max(knownRevisions.get(bookId) ?? 0, cached ? cached.revision : 0);
    const change = {
      family: "content", entityKey: bookId, bookId,
      baseRevision,
      op: "upsert", payload: structuredClone(w),
    };
    const commandId = await store.intent("SyncPush", { deviceId: store.deviceId, changes: [change] });
    return { skipped: false, commandId };
  }

  async function deleteBook(bookId) {
    const commandId = await store.intent("DeleteBook", { bookId });
    working.delete(bookId);
    knownRevisions.delete(bookId);
    return { commandId };
  }

  // Flush pending intents, fold receipt revisions into the ledger, and
  // return the per-command outcomes (receipts).
  async function settle() {
    await store.flushOutbox();
    const st = await store.outboxState();
    for (const o of st.outcomes) {
      for (const eo of o.receipt?.outcomes ?? []) {
        if (eo.status === "applied" && eo.entityKey && typeof eo.revision === "number") knownRevisions.set(eo.entityKey, eo.revision);
      }
    }
    return st;
  }

  // Pull every entity family (position converges via the journal +
  // positionView, not entity pulls). Working copies refresh per book via
  // refreshWorking, driven by what the screens actually show.
  async function syncNow() {
    const results = {};
    for (const family of ["content", "bindings", "settings"]) results[family] = await store.syncFamily(family);
    return results;
  }

  // Refresh one book's working copy from the store cache (post-sync).
  async function refreshWorking(bookId) {
    const cached = await store.cachedEntity("content", bookId);
    if (cached) { working.set(bookId, structuredClone(cached.payload)); knownRevisions.set(bookId, cached.revision); }
    else { working.delete(bookId); knownRevisions.delete(bookId); }
    return getWorking(bookId);
  }

  return { setWorking, getWorking, saveBook, deleteBook, settle, syncNow, refreshWorking };
}
