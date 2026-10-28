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
// DURABILITY MODEL (P5 review fix 1): all durable state lives in ONE storage
// record, and every mutation is load → mutate → a single atomic set of that
// record, serialized per storage object by a shared promise-chain mutex.
// Id allocation (command ids, journal localSeqs) happens INSIDE the same
// write as the record it names — a crash keeps both or neither, so an id
// can never be reissued to a different intent or event, even across
// simultaneous store instances over the same storage. (In production the
// single record maps to one IndexedDB transaction; the injected storage
// contract is: set of one key is atomic.)
//
// BYTE VERIFICATION (P5 review fix 2): a byte confirmation is recorded
// against (cacheKey, bindingRevision). If the binding's revision advances
// or its cache key changes, prior confirmations no longer apply and the
// chapter falls back to Uncertain until re-verified; a playback/diagnostics
// report of missing bytes invalidates the confirmation immediately.

const REMOVED_PROVIDERS = new Set(['azure', 'fish']); // not carried over; existing audio still plays
const STATE_KEY = 'cs:state:v1';
const locks = new WeakMap(); // storage object -> promise chain (serializes all instances sharing it)
const flushLocks = new WeakMap(); // storage object -> in-flight flush promise (module-level: shared across instances)

const emptyState = () => ({
  deviceId: null,               // bound on first write: one stable device id per persistent storage
  commandCounter: 0,
  journalCounters: {},          // bookId -> last localSeq allocated
  outbox: [],                   // {command_id, type, payload, status, receipt}
  journals: {},                 // bookId -> [event...]
  caches: {},                   // family -> {floor, tip, cursor, entities: {key: {payload, revision}}, tombstones}
  bytes: {},                    // cacheKey -> {bindingRevision}
  money: { view: null, asOfLedgerSeq: null, asOfSettingsRevision: null, stale: true },
});

export function createClientStore({ deviceId, storage, transport }) {
  if (!deviceId || !storage || !transport) throw new Error('deviceId, storage, transport required');

  async function load() {
    const s = await storage.get(STATE_KEY);
    return s === undefined || s === null ? emptyState() : s;
  }
  // Serialize mutations per storage object: fn receives the state, mutates
  // it, and the whole state is written back in ONE atomic set.
  function mutate(fn) {
    const prev = locks.get(storage) ?? Promise.resolve();
    const run = prev.then(async () => {
      const s = await load();
      if (s.deviceId === null || s.deviceId === undefined) s.deviceId = deviceId;
      else if (s.deviceId !== deviceId) {
        const err = new Error(`device_id_mismatch: storage belongs to ${s.deviceId}, not ${deviceId}`);
        err.code = 'device_id_mismatch';
        throw err;
      }
      const r = await fn(s);
      await storage.set(STATE_KEY, s);
      return r;
    });
    locks.set(storage, run.catch(() => {}));
    return run;
  }
  const familyCache = (s, family) => (s.caches[family] ??= { floor: 0, tip: 0, cursor: 0, entities: {}, tombstones: {} });

  // ------------------------------------------------------------- outbox
  // Intent-only writes: the intent AND its idempotency key (the command id)
  // are allocated and persisted in the same atomic write, before any
  // dispatch. A lost ACK never mints a new command — the same id replays
  // and the coordinator returns the original receipt (P2 command log).
  async function intent(type, payload = {}) {
    if (payload && typeof payload.provider === 'string' && REMOVED_PROVIDERS.has(payload.provider)) {
      const err = new Error(`provider_not_carried_over: ${payload.provider}`);
      err.code = 'provider_not_carried_over';
      throw err;
    }
    // Generation gate (Stage 4 review): a job whose BOOK carries an
    // unmapped removed-provider voice is rejected before persistence —
    // the voice-mapping flag is an enforcement, not a warning. The guard
    // does NOT trust caller-supplied voice data alone: voice data comes
    // from the payload's book copy or the SAVED book in this device's
    // content cache (a bare { bookId } request is fully checked),
    // covering POV voices and the default voice, for both SubmitJob and
    // RepairJob. A named book that is not on this device is FETCHED
    // first; if it still cannot be verified, the gate FAILS CLOSED.
    // Mappings must select a supported replacement provider + voice.
    // A mapping is a job-level directive (payload.voiceMapping[povId] /
    // .defaultVoice); the book itself is never rewritten by it.
    if (type === 'SubmitJob' || type === 'RepairJob') {
      const mapping = payload?.voiceMapping ?? {};
      const SUPPORTED_MAPPING_PROVIDERS = ['gemini', 'openai'];
      // A mapping clears a voice only by SELECTING a supported replacement:
      // a provider + a concrete voice. Anything else (a removed provider,
      // an unknown one, a missing voice) is itself an error, never a pass.
      const mappingClears = (key) => {
        const m = mapping[key];
        if (!m) return false;
        if (!SUPPORTED_MAPPING_PROVIDERS.includes(m.provider) || typeof m.voice_id !== 'string' || !m.voice_id) {
          const err = new Error(`unsupported_voice_mapping: ${key} -> ${m.provider ?? '?'}`);
          err.code = 'unsupported_voice_mapping';
          throw err;
        }
        return true;
      };
      // Authoritative voice data is checked as a UNION of every
      // representation: the payload's inline book copy AND — whenever a
      // bookId is named — the SAVED book, so a stale or incomplete
      // inline copy can never launder a voice the saved book carries.
      // A named book that is not on this device is FETCHED first; if it
      // still cannot be verified (offline, or absent), the gate FAILS
      // CLOSED. And a job with no book reference and no voice data of
      // its own has nothing verifiable at all: it may not enqueue.
      const inlineBook = payload?.book ?? null;
      let savedBook = null;
      if (payload?.bookId) {
        const read = async () => (await load()).caches.content?.entities?.[payload.bookId]?.payload ?? null;
        savedBook = await read();
        if (!savedBook) {
          try { await syncFamily('content'); } catch { /* offline: the read below decides */ }
          savedBook = await read();
        }
        if (!savedBook) {
          const err = new Error(`book_voice_data_unavailable: ${payload.bookId}`);
          err.code = 'book_voice_data_unavailable';
          throw err;
        }
      }
      if (!payload?.bookId && !inlineBook && !Array.isArray(payload?.povs)) {
        const err = new Error('book_voice_data_unavailable: no book reference or voice data');
        err.code = 'book_voice_data_unavailable';
        throw err;
      }
      const povLists = [inlineBook?.povs, savedBook?.povs, payload?.povs];
      const defaultProviders = [inlineBook?.defaultVoice?.provider, savedBook?.defaultVoice?.provider, payload?.defaultVoice?.provider];
      // Sufficiency means VOICES, not shapes: the resolved data must
      // contain at least one actual voice (a POV voice or a default
      // voice) — there is nothing to synthesize with otherwise. An
      // explicitly empty POV list is missing data in a data costume and
      // fails closed like any other absence.
      let voiceCount = 0;
      for (const list of povLists) for (const pov of Array.isArray(list) ? list : []) if (pov?.voice?.provider) voiceCount += 1;
      for (const dp of defaultProviders) if (dp) voiceCount += 1;
      if (voiceCount === 0) {
        const err = new Error('book_voice_data_unavailable: no voices in the resolved book data');
        err.code = 'book_voice_data_unavailable';
        throw err;
      }
      for (const list of povLists) {
        for (const pov of Array.isArray(list) ? list : []) {
          const provider = pov?.voice?.provider;
          if (provider && REMOVED_PROVIDERS.has(provider) && !mappingClears(pov.id)) {
            const err = new Error(`unmapped_removed_provider_voice: ${pov.name ?? pov.id ?? '?'} (${provider})`);
            err.code = 'unmapped_removed_provider_voice';
            throw err;
          }
        }
      }
      for (const dp of defaultProviders) {
        if (dp && REMOVED_PROVIDERS.has(dp) && !mappingClears('defaultVoice')) {
          const err = new Error(`unmapped_removed_provider_voice: (default voice) (${dp})`);
          err.code = 'unmapped_removed_provider_voice';
          throw err;
        }
      }
    }
    return mutate((s) => {
      s.commandCounter += 1;
      const commandId = `${deviceId}-cmd-${s.commandCounter}`;
      s.outbox.push({ command_id: commandId, type, payload, status: 'queued', receipt: null });
      return commandId;
    });
  }

  // Flush singularity (P5 follow-up race 1): concurrent flushOutbox callers
  // join the ONE in-flight flush for this storage instead of dispatching the
  // same pending command twice. Server idempotency is the second line of
  // defense, not the mechanism.
  function flushOutbox() {
    const existing = flushLocks.get(storage);
    if (existing) return existing;
    const run = flushOutboxOnce();
    flushLocks.set(storage, run);
    run.finally(() => { if (flushLocks.get(storage) === run) flushLocks.delete(storage); });
    return run;
  }

  async function flushOutboxOnce() {
    let sent = 0;
    for (;;) {
      const next = await mutate((s) => {
        const e = s.outbox.find((x) => x.status !== 'acked');
        return e ? { command_id: e.command_id, type: e.type, payload: e.payload } : null;
      });
      if (!next) break;
      let receipt = null, failed = false;
      try { receipt = await transport.sendCommand({ ...next, actor: deviceId }); } catch { failed = true; }
      await mutate((s) => {
        const e = s.outbox.find((x) => x.command_id === next.command_id);
        if (e) { e.status = failed ? 'sent_unacked' : 'acked'; if (!failed) e.receipt = receipt; }
      });
      if (failed) break; // head-of-line, like the Shelf outbox
      sent += 1;
    }
    const s = await load();
    return { sent, pending: s.outbox.filter((e) => e.status !== 'acked').length };
  }

  // Non-applied outcomes (conflicts, rejections) are surfaced, never
  // dressed as completion.
  async function outboxState() {
    const s = await load();
    return {
      pending: s.outbox.filter((e) => e.status !== 'acked').map((e) => ({ command_id: e.command_id, type: e.type, status: e.status })),
      outcomes: s.outbox.filter((e) => e.status === 'acked').map((e) => ({ command_id: e.command_id, type: e.type, payload: e.payload, outcome: e.receipt?.outcome ?? null, receipt: e.receipt })),
    };
  }

  // ------------------------------------------------------------- cache (P4)
  // Apply one pull page atomically: the WHOLE page is validated (contiguity
  // from the cursor, inside the pinned watermark) before anything mutates,
  // and the mutation itself is the store's single atomic write — a torn or
  // stale page leaves the cache byte-identical.
  async function applyPullPage(family, page) {
    if (page.family !== family) return { applied: false, reason: 'family_mismatch' };
    if (page.resyncRequired) {
      const snap = await transport.snapshot(family);
      return mutate((s) => {
        const fresh = { floor: 0, tip: snap.watermark, cursor: snap.watermark, entities: {}, tombstones: {} };
        for (const e of snap.entities ?? []) {
          if (e.tombstone) fresh.tombstones[e.bookId] = e.revision;
          else fresh.entities[e.entityKey] = { payload: e.data, revision: e.revision };
        }
        s.caches[family] = fresh;
        return { applied: true, resync: true, cursor: fresh.cursor };
      });
    }
    return mutate((s) => {
      const cache = familyCache(s, family);
      const changes = [...(page.changes ?? [])].sort((a, b) => a.seq - b.seq);
      let expect = cache.cursor + 1;
      for (const c of changes) {
        if (c.seq !== expect || c.seq > page.highWatermark) return { applied: false, reason: 'non_contiguous_page' };
        expect += 1;
      }
      if (page.nextSeq !== (changes.length ? changes[changes.length - 1].seq : cache.cursor)) return { applied: false, reason: 'next_seq_mismatch' };
      for (const c of changes) {
        if (c.op === 'delete' || c.op === 'tombstone') { delete cache.entities[c.entityKey]; cache.tombstones[c.bookId] = c.revision; }
        else cache.entities[c.entityKey] = { payload: c.payload, revision: c.revision };
      }
      cache.cursor = page.nextSeq;
      cache.tip = Math.max(cache.tip, page.highWatermark);
      return { applied: true, cursor: cache.cursor };
    });
  }

  async function syncFamily(family, limit = 100) {
    const s = await load();
    const cursor = s.caches[family]?.cursor ?? 0;
    const page = await transport.pullChanges(family, cursor, limit);
    return applyPullPage(family, page);
  }

  async function cacheState(family) {
    const s = await load();
    const c = s.caches[family] ?? { floor: 0, tip: 0, cursor: 0, entities: {}, tombstones: {} };
    return { floor: c.floor, tip: c.tip, cursor: c.cursor, entities: Object.keys(c.entities).length, tombstones: Object.keys(c.tombstones).length };
  }

  async function cachedEntity(family, key) {
    const s = await load();
    return s.caches[family]?.entities[key] ?? null; // {payload, revision} | null
  }

  // ------------------------------------------------- position journal (P4)
  // Events are appended with a stable per-book device sequence allocated in
  // the same atomic write as the append (survives restart; cannot collide
  // with a simultaneous instance). They are pushed as events and reconciled
  // from the coordinator's receipts — the client never folds its own truth.
  async function notePosition(bookId, evt) {
    return mutate((s) => {
      const localSeq = (s.journalCounters[bookId] ?? 0) + 1;
      s.journalCounters[bookId] = localSeq;
      const event = { eventId: `${deviceId}:${localSeq}`, deviceId, localSeq, bookId, ...evt };
      (s.journals[bookId] ??= []).push({ ...event, receiptSeq: null, superseded: false, rejected: null });
      return event;
    });
  }

  async function flushJournal(bookId, knownTip) {
    const s0 = await load();
    const pendingEvts = (s0.journals[bookId] ?? []).filter((e) => e.receiptSeq === null && !e.rejected);
    if (!pendingEvts.length) return { pushed: 0 };
    const res = await transport.pushPosition(bookId, pendingEvts.map(({ receiptSeq, superseded, rejected, ...e }) => ({ ...e, baseSeq: knownTip })), knownTip);
    await mutate((s) => {
      const byId = new Map((res.receipts ?? []).map((r) => [r.eventId, r]));
      const rejById = new Map((res.rejected ?? []).map((r) => [r.eventId, r]));
      for (const e of s.journals[bookId] ?? []) {
        const r = byId.get(e.eventId);
        if (r) { e.receiptSeq = r.receiptSeq; e.superseded = !!r.superseded; }
        const rej = rejById.get(e.eventId);
        if (rej) e.rejected = rej.reason; // terminal for this event; surfaced, never silently retried
      }
    });
    return { pushed: (res.receipts ?? []).length, rejected: (res.rejected ?? []).length, tip: res.tip, gaps: res.journalGaps,
             receipts: res.receipts ?? [], rejectedEvents: res.rejected ?? [] };
  }

  async function journalState(bookId) {
    const s = await load();
    const journal = s.journals[bookId] ?? [];
    // CANDIDATE REPAIR (D5-B B3, justified vendored addition): `events`
    // exposes the PERSISTED per-event receipt state (receiptSeq /
    // superseded / rejected, exactly as stored in the journal) so the
    // candidate reporter's diagnostics can derive acknowledgment from
    // per-event receipts instead of guessing from aggregate counts.
    // Additive only: every pre-existing field is unchanged.
    return { total: journal.length, unacked: journal.filter((e) => e.receiptSeq === null && !e.rejected).length, superseded: journal.filter((e) => e.superseded).map((e) => e.eventId), rejected: journal.filter((e) => e.rejected).map((e) => ({ eventId: e.eventId, reason: e.rejected })),
             events: journal.map((e) => ({ eventId: e.eventId, localSeq: e.localSeq, kind: e.kind ?? null, occurrenceId: e.occurrenceId ?? null, offsetSec: e.offsetSec ?? null, receiptSeq: e.receiptSeq ?? null, superseded: !!e.superseded, rejected: e.rejected ?? null })) };
  }

  // --------------------------------------- bytes: metadata is not the audio
  // Confirmations are version-aware: recorded against the binding's
  // revision. A binding update (new revision or key) or a missing-bytes
  // report invalidates them (P5 review fix 2).
  async function verifyBindingBytes(bookId, occurrenceId) {
    const s = await load();
    const rec = s.caches.bindings?.entities[`${bookId}:${occurrenceId}`];
    if (!rec?.payload?.cacheKey) return false;
    const { cacheKey } = rec.payload;
    if (s.bytes[cacheKey]?.bindingRevision === rec.revision) return true;
    const ok = await transport.byteCheck(cacheKey);
    if (!ok) return false;
    // Race 2 (P5 follow-up, tightened in the Stage-1 review): the binding
    // may change DURING the async byte check — or between the recheck and
    // the record. So the recheck happens INSIDE the same serialized
    // mutation that records the confirmation: revision + key are compared
    // against the live cache at the moment of recording, atomically.
    return mutate((s3) => {
      const now = s3.caches.bindings?.entities[`${bookId}:${occurrenceId}`];
      if (!now || now.revision !== rec.revision || now.payload?.cacheKey !== cacheKey) return false;
      s3.bytes[cacheKey] = { bindingRevision: rec.revision };
      return true;
    });
  }

  async function bytesConfirmedFor(rec) {
    if (!rec?.payload?.cacheKey) return false;
    const s = await load();
    return s.bytes[rec.payload.cacheKey]?.bindingRevision === rec.revision;
  }

  // Playback/diagnostics: the audio was NOT there. Invalidate immediately —
  // the chapter must stop claiming certainty until bytes are re-verified.
  // Playback itself writes nothing else; this is a diagnostics report about
  // the client's own confirmations, not a record edit (inventory D).
  async function reportBytesMissing(cacheKey) {
    await mutate((s) => { delete s.bytes[cacheKey]; });
  }

  // Chapter display state from cached read models ONLY (inventory A/D).
  // 'Complete' requires: a binding for every occurrence AND byte-confirmed
  // audio for every binding AT ITS CURRENT REVISION. Anything less is
  // Uncertain/Partial/Blocked — never a false completion (Rowan check 1).
  async function chapterDisplay(bookId, chapterId) {
    const s = await load();
    const content = s.caches.content?.entities[bookId]?.payload;
    if (!content) return { label: 'Unknown', certain: false, reason: 'not_cached' };
    const chapter = (content.chapters ?? []).find((c) => c.id === chapterId);
    if (!chapter) return { label: 'Unknown', certain: false, reason: 'no_chapter' };
    const bindings = s.caches.bindings ?? { entities: {} };
    let ready = 0, unverified = 0, blocked = 0, missing = 0;
    for (const seg of chapter.segments) {
      const rec = bindings.entities[`${bookId}:${seg.occurrenceId}`];
      if (!rec) { missing += 1; continue; }
      if (rec.payload?.outcome === 'policy_block') { blocked += 1; continue; }
      if (rec.payload?.cacheKey && s.bytes[rec.payload.cacheKey]?.bindingRevision === rec.revision) ready += 1; else unverified += 1;
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
      return mutate((s) => {
        s.money = { view, asOfLedgerSeq: view.ledgerSeq, asOfSettingsRevision: view.settingsRevision, stale: false };
        return s.money;
      });
    } catch {
      return mutate((s) => { s.money.stale = true; return s.money; });
    }
  }
  async function moneyDisplay() { return (await load()).money; }

  // -------------------------------------------------------- find (F10)
  // Standalone search over the Content cache. Pure read of read models; no
  // dependency on any lab/generation surface — verified with Prosody Lab
  // absent (its code simply is not part of this layer).
  async function findText(query, { bookId = null } = {}) {
    const s = await load();
    const q = String(query).toLowerCase();
    const hits = [];
    for (const [key, rec] of Object.entries(s.caches.content?.entities ?? {})) {
      const book = rec.payload;
      if (bookId && key !== bookId) continue;
      for (const ch of book?.chapters ?? []) {
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
  // identically). Playback never writes records.
  function resolvePlayback(binding) {
    if (!binding || !binding.cacheKey) return { ok: false, reason: 'no_binding' };
    return { ok: true, cacheKey: binding.cacheKey, provider: binding.provider ?? null };
  }

  return {
    deviceId,
    intent, flushOutbox, outboxState,
    syncFamily, applyPullPage, cacheState, cachedEntity,
    notePosition, flushJournal, journalState,
    verifyBindingBytes, bytesConfirmedFor, reportBytesMissing, chapterDisplay,
    refreshMoney, moneyDisplay,
    findText, resolvePlayback,
  };
}
