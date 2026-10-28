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
//
// DURABILITY (Stage-1 durability fix, Rowan): everything the funnel must
// remember across restarts — the revision ledger, the outcome-consumption
// watermark (settledThrough), and parked edits with their resolution
// state — lives in ONE durable record in the same storage, written
// atomically per mutation. A restart can neither resurrect a resolved
// park (the watermark is durable) nor lose an unresolved one (the park
// payload is durable). A park in 'retrying' resolution clears ONLY when
// settle folds a successful replacement receipt for the retry's own
// command; a failed retry returns the park to 'conflict' with its payload
// intact. Working copies stay volatile — they are edit buffers, and their
// durable counterparts are the outbox payloads and the parks.

const FUNNEL_KEY = "cs:funnel:v1";

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  const ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
  if (ka.length !== kb.length) return false;
  return ka.every((k, i) => k === kb[i] && deepEqual(a[k], b[k]));
}

// Durable-write chains are keyed by STORAGE, not by funnel instance: two
// funnel instances over one storage (e.g. a composition rebuilt without a
// restart of the underlying store) serialize against each other, exactly
// like the store's own per-storage mutex. A per-instance chain would let
// two live funnels interleave load-mutate-set and lose each other's parks.
const funnelChains = new Map();

export function createFunnel({ store, storage }) {
  if (!store || !storage) throw new Error("store and storage required");
  const working = new Map(); // volatile edit buffers

  const emptyRecord = () => ({ settledThrough: 0, knownRevisions: {}, parks: {} });
  async function load() {
    const r = await storage.get(FUNNEL_KEY);
    return r === undefined || r === null ? emptyRecord() : r;
  }
  function mutate(fn) {
    const prev = funnelChains.get(storage) ?? Promise.resolve();
    const run = prev.then(async () => {
      const rec = await load();
      const out = await fn(rec);
      await storage.set(FUNNEL_KEY, rec);
      return out;
    });
    funnelChains.set(storage, run.catch(() => {}));
    return run;
  }

  function setWorking(bookId, payload) { working.set(bookId, structuredClone(payload)); }
  function getWorking(bookId) { const w = working.get(bookId); return w ? structuredClone(w) : null; }
  async function parkedEdit(bookId) {
    const rec = await load();
    const p = rec.parks[bookId];
    return p ? structuredClone(p) : null;
  }

  // The pe() replacement: persist the working copy of one book as intents.
  async function saveBook(bookId) {
    const w = working.get(bookId);
    if (!w) return { skipped: true, reason: "no_working_copy" };
    const cached = await store.cachedEntity("content", bookId);
    if (cached && deepEqual(cached.payload, w)) return { skipped: true, reason: "unchanged" };
    const rec = await load();
    const baseRevision = Math.max(rec.knownRevisions[bookId] ?? 0, cached ? cached.revision : 0);
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
    await mutate((rec) => { delete rec.knownRevisions[bookId]; });
    return { commandId };
  }

  // Flush pending intents and fold ONLY the outcomes beyond the durable
  // watermark — incrementally, in one durable write with the fold itself.
  async function settle() {
    await store.flushOutbox();
    const st = await store.outboxState();
    await mutate((rec) => {
      const fresh = st.outcomes.slice(rec.settledThrough);
      rec.settledThrough = st.outcomes.length;
      for (const o of fresh) {
        for (const eo of o.receipt?.outcomes ?? []) {
          if (eo.status === "applied" && eo.entityKey && typeof eo.revision === "number") rec.knownRevisions[eo.entityKey] = eo.revision;
          const park = eo.entityKey ? rec.parks[eo.entityKey] : null;
          if (park && eo.status === "applied") {
            const appliedPayload = (o.payload?.changes ?? []).find((c) => c.entityKey === eo.entityKey)?.payload;
            // The parked edit IS what just landed, in one of the two ways
            // the USER set in motion: the retry's own command id, or — the
            // restart-during-setup case — payload identity for a park the
            // user had already marked 'retry-setup'. A park with NO
            // resolution is an undecided user decision: an unrelated
            // applied save with identical bytes must NOT dismiss it.
            if ((park.resolution?.how === "retry" && park.resolution.commandId === o.command_id) ||
                (park.resolution?.how === "retry-setup" && appliedPayload !== undefined && deepEqual(appliedPayload, park.payload))) {
              delete rec.parks[eo.entityKey];
              continue;
            }
          }
          if (park?.resolution?.how === "retry" && park.resolution.commandId === o.command_id) {
            // The retry's own command came back non-applied: payload preserved.
            park.resolution = null; park.status = eo.status; park.currentRevision = eo.currentRevision ?? park.currentRevision;
            continue;
          }
          if ((eo.status === "conflict" || eo.status === "rejected_tombstoned" || eo.status === "rejected_stale") && eo.entityKey) {
            const sent = (o.payload?.changes ?? []).find((c) => c.entityKey === eo.entityKey)?.payload ?? (working.has(eo.entityKey) ? working.get(eo.entityKey) : null);
            if (sent) rec.parks[eo.entityKey] = {
              payload: structuredClone(sent),
              baseRevision: rec.knownRevisions[eo.entityKey] ?? 0,
              currentRevision: eo.currentRevision ?? null,
              status: eo.status,
              resolution: null,
            };
          }
        }
      }
    });
    return st;
  }

  // Resolve a parked edit explicitly. 'discard' deletes the park durably
  // in this write. 'retry' marks the park 'retrying' (durably, with the
  // retry's command id) and issues the replacement save — the park itself
  // clears later, in settle, only on that command's applied receipt.
  async function resolveParked(bookId, how) {
    const rec = await load();
    const p = rec.parks[bookId];
    if (!p) return { resolved: false, reason: "no_parked_edit" };
    if (how === "discard") {
      await mutate((r) => { delete r.parks[bookId]; });
      return { resolved: true, how };
    }
    if (how === "retry") {
      let cached = await store.cachedEntity("content", bookId);
      if (!cached) { await store.syncFamily("content"); cached = await store.cachedEntity("content", bookId); }
      if (!cached) return { resolved: false, reason: "book_gone" };
      // Mark the setup DURABLY before the command exists: a restart
      // anywhere after this write leaves a park that knows a retry was
      // begun. If the restart lands before the command-id marking below,
      // settle still clears the park — by payload identity — when the
      // replacement's applied outcome folds (see settle).
      await mutate((r) => {
        r.knownRevisions[bookId] = cached.revision;
        if (r.parks[bookId]) r.parks[bookId].resolution = { how: "retry-setup" };
      });
      working.set(bookId, structuredClone(p.payload));
      const r = await saveBook(bookId);
      if (r.skipped) {
        await mutate((r2) => { if (r2.parks[bookId]?.resolution?.how === "retry-setup") r2.parks[bookId].resolution = null; });
        return { resolved: false, reason: r.reason };
      }
      await mutate((rec2) => {
        if (rec2.parks[bookId]?.resolution?.how === "retry-setup") rec2.parks[bookId].resolution = { how: "retry", commandId: r.commandId };
      });
      return { resolved: true, how, ...r };
    }
    return { resolved: false, reason: "unknown_resolution" };
  }

  // Pull every entity family (position converges via the journal +
  // positionView, not entity pulls).
  async function syncNow() {
    const results = {};
    for (const family of ["content", "bindings", "settings"]) results[family] = await store.syncFamily(family);
    return results;
  }

  // Refresh one book's working copy from the store cache (post-sync).
  // Never touches parked edits.
  async function refreshWorking(bookId) {
    const cached = await store.cachedEntity("content", bookId);
    if (cached) {
      working.set(bookId, structuredClone(cached.payload));
      await mutate((rec) => { rec.knownRevisions[bookId] = cached.revision; });
    } else {
      working.delete(bookId);
      await mutate((rec) => { delete rec.knownRevisions[bookId]; });
    }
    return getWorking(bookId);
  }

  return { setWorking, getWorking, parkedEdit, resolveParked, saveBook, deleteBook, settle, syncNow, refreshWorking };
}
