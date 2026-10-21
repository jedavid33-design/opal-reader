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
  // Parked edits: when a save comes back conflicted/rejected, the user's
  // unsent local edit is PARKED — never silently discarded (Rowan Stage-1
  // follow-up caution). Refreshing the working copy from the server does
  // not touch parked edits; only an explicit resolveParked (retry on top
  // of the current revision, or discard) clears one.
  const parkedEdits = new Map(); // bookId -> { payload, baseRevision, currentRevision, status }

  function setWorking(bookId, payload) { working.set(bookId, structuredClone(payload)); }
  function getWorking(bookId) { const w = working.get(bookId); return w ? structuredClone(w) : null; }
  function parkedEdit(bookId) { const p = parkedEdits.get(bookId); return p ? structuredClone(p) : null; }

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

  // Flush pending intents, fold receipt revisions into the ledger, park
  // any conflicted/rejected edits, and return the outcomes (receipts).
  let settledThrough = 0; // outcomes already folded/parked — settle is incremental, never a replay
  async function settle() {
    await store.flushOutbox();
    const st = await store.outboxState();
    const fresh = st.outcomes.slice(settledThrough);
    settledThrough = st.outcomes.length;
    for (const o of fresh) {
      for (const eo of o.receipt?.outcomes ?? []) {
        if (eo.status === "applied" && eo.entityKey && typeof eo.revision === "number") knownRevisions.set(eo.entityKey, eo.revision);
        if ((eo.status === "conflict" || eo.status === "rejected_tombstoned" || eo.status === "rejected_stale") && eo.entityKey) {
          // The edit that was sent lives in the persisted command payload —
          // park THAT (it survives restarts; the volatile working copy may not).
          const sent = (o.payload?.changes ?? []).find((c) => c.entityKey === eo.entityKey)?.payload ?? (working.has(eo.entityKey) ? working.get(eo.entityKey) : null);
          if (sent) parkedEdits.set(eo.entityKey, {
            payload: structuredClone(sent),
            baseRevision: knownRevisions.get(eo.entityKey) ?? 0,
            currentRevision: eo.currentRevision ?? null,
            status: eo.status,
          });
        }
      }
    }
    return st;
  }

  // Resolve a parked edit explicitly. 'retry' re-applies the user's edit
  // on top of the CURRENT server revision (their content wins, knowingly,
  // as a new revision); 'discard' drops it. Either way the choice is the
  // user's — the funnel never resolves a park on its own.
  async function resolveParked(bookId, how) {
    const p = parkedEdits.get(bookId);
    if (!p) return { resolved: false, reason: "no_parked_edit" };
    if (how === "discard") { parkedEdits.delete(bookId); return { resolved: true, how }; }
    if (how === "retry") {
      const cached = await store.cachedEntity("content", bookId);
      if (!cached) return { resolved: false, reason: "book_gone" }; // tombstoned: retry has nothing to rebase onto
      knownRevisions.set(bookId, cached.revision);
      working.set(bookId, structuredClone(p.payload));
      parkedEdits.delete(bookId);
      const r = await saveBook(bookId);
      return { resolved: true, how, ...r };
    }
    return { resolved: false, reason: "unknown_resolution" };
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

  return { setWorking, getWorking, parkedEdit, resolveParked, saveBook, deleteBook, settle, syncNow, refreshWorking };
}
