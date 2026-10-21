// Opal Reader v2 — client state layer (P5).
//
// One cohesive store between the screens and the network (Rowan P5 Q1):
// family-partitioned cache, a durable command outbox, and the client half of
// the position journal, behind explicit interfaces. The store holds NO truth
// of its own: the cache is a revision-stamped copy of coordinator read models
// (P4), intents become durable commands whose receipts are the only outcomes,
// and position is an append-only event journal folded by the coordinator.
// Screens render what this store returns — verbatim, with uncertainty shown
// where certainty has not been earned (Rowan P5 check 1: a binding's metadata
// is not confirmed audio bytes; offline or unverified never reads "Complete").
//
// Storage and transport are injected. Storage is a durable async KV
// (get/set/del); everything the store must survive a restart with — outbox
// intents + idempotency keys, journal counters + unacked events, cache
// cursors — is persisted BEFORE any network dispatch (Rowan's invariant).
// Transport speaks the frozen P4 surface: sendCommand / pullChanges /
// snapshot / pushPosition / quotaView / byteCheck.

const REMOVED_PROVIDERS = new Set(['azure', 'fish']); // not carried over (F-removals); existing audio still plays

export function createClientStore({ deviceId, storage, transport }) {
  if (!deviceId || !storage || !transport) throw new Error('deviceId, storage, transport required');
  const K = {
    meta: 'cs:meta',
    outbox: 'cs:outbox',
    bytes: 'cs:bytes',
    money: 'cs:money',
    cache: (f) => `cs:cache:${f}`,
    journal: (b) => `cs:journal:${b}`,
  };
  const get = async (k, dflt) => { const v = await storage.get(k); return v === undefined || v === null ? dflt : v; };
  const set = (k, v) => storage.set(k, v);

  async function meta() { return get(K.meta, { commandCounter: 0, journalCounters: {} }); }

  // ------------------------------------------------------------- outbox
  // Intent-only writes: screens express intents; the store persists the
  // intent AND its idempotency key (the command id) before any dispatch.
  // A lost ACK never mints a new command — the same id is replayed and the
  // coordinator returns the original receipt (P2 command log).
  async function intent(type, payload = {}) {
    if (payload && typeof payload.provider === 'string' && REMOVED_PROVIDERS.has(payload.provider)) {
      // Rejected locally, before persistence or dispatch: generation on a
      // removed provider is not carried over. (Playback is unaffected —
      // resolvePlayback below never consults this set.)
      const err = new Error(`provider_not_carried_over: ${payload.provider}`);
      err.code = 'provider_not_carried_over';
      throw err;
    }
    const m = await meta();
    m.commandCounter += 1;
    const commandId = `${deviceId}-cmd-${m.commandCounter}`;
    const outbox = await get(K.outbox, []);
    outbox.push({ command_id: commandId, type, payload, status: 'queued', receipt: null });
    await set(K.meta, m);
    await set(K.outbox, outbox); // durable BEFORE dispatch — flush is a separate step
    return commandId;
  }

  async function flushOutbox() {
    const outbox = await get(K.outbox, []);
    let sent = 0;
    for (const entry of outbox) {
      if (entry.status === 'acked') continue;
      try {
        const receipt = await transport.sendCommand({ command_id: entry.command_id, type: entry.type, payload: entry.payload, actor: deviceId });
        entry.status = 'acked';
        entry.receipt = receipt;
        sent += 1;
        await set(K.outbox, outbox);
      } catch {
        entry.status = 'sent_unacked'; // ACK unknown: replay the SAME id later, never a new one
        await set(K.outbox, outbox);
        break; // head-of-line, like the Shelf outbox
      }
    }
    return { sent, pending: outbox.filter((e) => e.status !== 'acked').length };
  }

  // Non-applied outcomes (conflicts, rejections) are surfaced, never dressed
  // as completion.
  async function outboxState() {
    const outbox = await get(K.outbox, []);
    return {
      pending: outbox.filter((e) => e.status !== 'acked').map((e) => ({ command_id: e.command_id, type: e.type, status: e.status })),
      outcomes: outbox.filter((e) => e.status === 'acked').map((e) => ({ command_id: e.command_id, type: e.type, outcome: e.receipt?.outcome ?? null, receipt: e.receipt })),
    };
  }

  // ------------------------------------------------------------- cache (P4)
  async function familyCache(family) { return get(K.cache(family), { floor: 0, tip: 0, cursor: 0, entities: {}, tombstones: {} }); }

  // Apply one pull page atomically: the WHOLE page is validated (pinned
  // watermark, family, contiguity from the cursor) before anything mutates,
  // and the cursor advances only with the page — a torn or stale page leaves
  // the cache byte-identical and can never override newer data.
  async function applyPullPage(family, page) {
    const cache = await familyCache(family);
    if (page.family !== family) return { applied: false, reason: 'family_mismatch' };
    if (page.resyncRequired) {
      const snap = await transport.snapshot(family);
      const fresh = { floor: 0, tip: snap.watermark, cursor: snap.watermark, entities: {}, tombstones: {} };
      for (const e of snap.entities ?? []) {
        if (e.tombstone) fresh.tombstones[e.bookId] = e.revision;
        else fresh.entities[e.entityKey] = e.data;
      }
      await set(K.cache(family), fresh);
      return { applied: true, resync: true, cursor: fresh.cursor };
    }
    // Validate the WHOLE page before mutating: changes contiguous from the
    // cursor, all inside the pinned watermark window.
    const changes = [...(page.changes ?? [])].sort((a, b) => a.seq - b.seq);
    let expect = cache.cursor + 1;
    for (const c of changes) {
      if (c.seq !== expect || c.seq > page.highWatermark) return { applied: false, reason: 'non_contiguous_page' };
      expect += 1;
    }
    if (page.nextSeq !== (changes.length ? changes[changes.length - 1].seq : cache.cursor)) return { applied: false, reason: 'next_seq_mismatch' };
    for (const c of changes) {
      if (c.op === 'delete' || c.op === 'tombstone') { delete cache.entities[c.entityKey]; cache.tombstones[c.bookId] = c.revision; }
      else cache.entities[c.entityKey] = c.payload;
    }
    cache.cursor = page.nextSeq;
    cache.tip = Math.max(cache.tip, page.highWatermark);
    await set(K.cache(family), cache);
    return { applied: true, cursor: cache.cursor };
  }

  async function syncFamily(family, limit = 100) {
    const cache = await familyCache(family);
    const page = await transport.pullChanges(family, cache.cursor, limit);
    return applyPullPage(family, page);
  }

  async function cacheState(family) {
    const c = await familyCache(family);
    return { floor: c.floor, tip: c.tip, cursor: c.cursor, entities: Object.keys(c.entities).length, tombstones: Object.keys(c.tombstones).length };
  }

  async function cachedEntity(family, key) { return (await familyCache(family)).entities[key] ?? null; }

  // ------------------------------------------------- position journal (P4)
  // Events are appended locally with a stable per-book device sequence that
  // persists across restarts; they are pushed as events and reconciled from
  // the coordinator's receipts — the client never folds its own resume truth.
  async function notePosition(bookId, evt) {
    const m = await meta();
    const localSeq = (m.journalCounters[bookId] ?? 0) + 1;
    m.journalCounters[bookId] = localSeq;
    const event = { eventId: `${deviceId}:${localSeq}`, deviceId, localSeq, bookId, ...evt };
    const journal = await get(K.journal(bookId), []);
    journal.push({ ...event, receiptSeq: null, superseded: false });
    await set(K.meta, m);
    await set(K.journal(bookId), journal); // durable before any push attempt
    return event;
  }

  async function flushJournal(bookId, knownTip) {
    const journal = await get(K.journal(bookId), []);
    const pendingEvts = journal.filter((e) => e.receiptSeq === null && !e.rejected);
    if (!pendingEvts.length) return { pushed: 0 };
    const res = await transport.pushPosition(bookId, pendingEvts.map(({ receiptSeq, superseded, rejected, ...e }) => ({ ...e, baseSeq: knownTip })), knownTip);
    const byId = new Map((res.receipts ?? []).map((r) => [r.eventId, r]));
    const rejById = new Map((res.rejected ?? []).map((r) => [r.eventId, r]));
    for (const e of journal) {
      const r = byId.get(e.eventId);
      if (r) { e.receiptSeq = r.receiptSeq; e.superseded = !!r.superseded; }
      const rej = rejById.get(e.eventId);
      if (rej) e.rejected = rej.reason; // terminal for this event; surfaced, never silently retried
    }
    await set(K.journal(bookId), journal);
    return { pushed: (res.receipts ?? []).length, rejected: (res.rejected ?? []).length, tip: res.tip, gaps: res.journalGaps };
  }

  async function journalState(bookId) {
    const journal = await get(K.journal(bookId), []);
    return { total: journal.length, unacked: journal.filter((e) => e.receiptSeq === null && !e.rejected).length, superseded: journal.filter((e) => e.superseded).map((e) => e.eventId), rejected: journal.filter((e) => e.rejected).map((e) => ({ eventId: e.eventId, reason: e.rejected })) };
  }

  // --------------------------------------- bytes: metadata is not the audio
  async function confirmBytes(cacheKey) { const b = await get(K.bytes, {}); b[cacheKey] = true; await set(K.bytes, b); }
  async function bytesConfirmed(cacheKey) { return !!(await get(K.bytes, {}))[cacheKey]; }

  // When online, ask the transport to verify a binding's bytes and record the
  // confirmation. Offline or unverified → no confirmation is recorded, and
  // chapterDisplay below says so.
  async function verifyBindingBytes(binding) {
    if (await bytesConfirmed(binding.cacheKey)) return true;
    const ok = await transport.byteCheck(binding.cacheKey);
    if (ok) await confirmBytes(binding.cacheKey);
    return ok;
  }

  // Chapter display state from cached read models ONLY (inventory A/D).
  // 'Complete' requires: a binding for every occurrence AND confirmed bytes
  // for every binding. Bindings without confirmed bytes → 'Uncertain',
  // never a false completion (Rowan check 1).
  async function chapterDisplay(bookId, chapterId) {
    const content = await cachedEntity('content', bookId);
    if (!content) return { label: 'Unknown', certain: false, reason: 'not_cached' };
    const chapter = (content.chapters ?? []).find((c) => c.id === chapterId);
    if (!chapter) return { label: 'Unknown', certain: false, reason: 'no_chapter' };
    const bindings = await familyCache('bindings');
    let ready = 0, unverified = 0, blocked = 0, missing = 0;
    for (const seg of chapter.segments) {
      const b = bindings.entities[`${bookId}:${seg.occurrenceId}`];
      if (!b) { missing += 1; continue; }
      if (b.outcome === 'policy_block') { blocked += 1; continue; }
      if (await bytesConfirmed(b.cacheKey)) ready += 1; else unverified += 1;
    }
    const total = chapter.segments.length;
    if (blocked > 0) return { label: 'Blocked', certain: true, counts: { ready, unverified, blocked, missing, total } };
    if (missing > 0) return { label: ready + unverified > 0 ? 'Partial' : 'Not generated', certain: true, counts: { ready, unverified, blocked, missing, total } };
    if (unverified > 0) return { label: 'Uncertain', certain: false, reason: 'audio_unverified', counts: { ready, unverified, blocked, missing, total } };
    return { label: 'Complete', certain: true, counts: { ready, unverified, blocked, missing, total } };
  }

  // ------------------------------------------------------------- money (F8)
  // The client's only money surface is a READ of the coordinator's
  // revisioned view, rendered in Settings with its as-of stamp. A failed
  // refresh keeps the last view and marks it stale; the view authorizes
  // nothing (no code path here gates on it).
  async function refreshMoney() {
    try {
      const view = await transport.quotaView();
      const money = { view, asOfLedgerSeq: view.ledgerSeq, asOfSettingsRevision: view.settingsRevision, stale: false };
      await set(K.money, money);
      return money;
    } catch {
      const money = await get(K.money, { view: null, asOfLedgerSeq: null, asOfSettingsRevision: null, stale: true });
      money.stale = true;
      await set(K.money, money);
      return money;
    }
  }
  async function moneyDisplay() { return get(K.money, { view: null, asOfLedgerSeq: null, asOfSettingsRevision: null, stale: true }); }

  // -------------------------------------------------------- find (F10)
  // Standalone search over the Content cache. Pure read of read models; no
  // dependency on any lab/generation surface — verified with Prosody Lab
  // absent (its code simply is not part of this layer).
  async function findText(query, { bookId = null } = {}) {
    const content = await familyCache('content');
    const q = String(query).toLowerCase();
    const hits = [];
    for (const [key, book] of Object.entries(content.entities)) {
      if (bookId && key !== bookId) continue;
      for (const ch of book.chapters ?? []) {
        for (const seg of ch.segments ?? []) {
          const idx = (seg.text ?? '').toLowerCase().indexOf(q);
          if (idx >= 0) hits.push({ bookId: key, chapterId: ch.id, occurrenceId: seg.occurrenceId, snippet: seg.text.slice(Math.max(0, idx - 20), idx + q.length + 20) });
        }
      }
    }
    return hits;
  }

  // ------------------------------------------------------- playback (all providers)
  // Playback of existing audio is provider-agnostic and preserved for every
  // former provider (azure/fish/speechify/elevenlabs bindings resolve
  // identically). Playback never writes: a missing object is reported via
  // diagnostics, not edited into a record (inventory D).
  function resolvePlayback(binding) {
    if (!binding || !binding.cacheKey) return { ok: false, reason: 'no_binding' };
    return { ok: true, cacheKey: binding.cacheKey, provider: binding.provider ?? null };
  }

  return {
    deviceId,
    intent, flushOutbox, outboxState,
    syncFamily, applyPullPage, cacheState, cachedEntity,
    notePosition, flushJournal, journalState,
    confirmBytes, bytesConfirmed, verifyBindingBytes, chapterDisplay,
    refreshMoney, moneyDisplay,
    findText, resolvePlayback,
  };
}
