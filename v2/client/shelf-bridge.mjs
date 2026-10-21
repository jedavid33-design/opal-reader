// Opal Reader v2 — Shelf bridge adapter (P6, Roundtable Case #8).
//
// Requirement F12: the Reader -> Shelf bridge is FROZEN. This adapter
// reproduces the shipped v1 wire contract (pinned by P1 in
// tests/fixtures/shelf/ + tests/shelf-bridge-contract.test.mjs) exactly —
// same outbox item shape, same queue-id format, same merge rule, same
// FIFO flush discipline, same 409 overlap carving, same 404 relink flag,
// same session timing. What changed is only the plumbing: the outbox
// lives in the assembled client's storage as ONE atomic record per
// mutation (the P5 pattern) under a v2 key, and fetch / clock / id
// generation are injected seams so the behavior is replayable.
//
// The sessionizer is IN scope (Rowan, P6 design review): it determines
// the wire-visible durations. It is a faithful port of the shipped
// shelfListen* functions: wall-clock from listen start, 30s checkpoints,
// a pause starts a 4s grace timer — resume inside the grace keeps the
// session, otherwise the session ends BACKDATED to the pause moment —
// and a confirmed stop arms a flush 95s out that a resume inside 90s
// cancels. duration_seconds is whole wall-clock seconds, never audio
// length; chunks under 5s never reach the queue (the shipped floor).
//
// Proof is differential replay only (tests/shelf-bridge-replay.test.mjs):
// identical scripted scenarios through the extracted shipped functions
// and this adapter, comparing outbox state, fetch call sequences (URL +
// exact body bytes) and outcomes after every step. No live Shelf contact
// of any kind — fetch is a script in every test.

const BRIDGE_KEY = "cs:shelf-bridge:v1";
const MAX_OUTBOX = 300;          // outbox capped to the last 300 (shipped)
const MERGE_WINDOW_MS = 90000;   // merge when |start - lastEnd| < 90s (shipped: strict <)
const CHECKPOINT_MS = 30000;     // session checkpoint interval (shipped)
const PAUSE_GRACE_MS = 4000;     // pause grace before a stop is confirmed (shipped)
const RESUME_WINDOW_MS = 90000;  // resume inside 90s of a stop cancels the armed flush (shipped)
const FLUSH_DELAY_MS = 95000;    // confirmed stop arms a flush 95s out (shipped)
const MIN_SESSION_SECS = 5;      // chunks shorter than 5s never queue (shipped)

// Mutation chains are keyed by STORAGE, not by bridge instance (the P5
// funnel pattern): two bridges over one storage — e.g. a restart —
// serialize against each other, so load -> mutate -> one atomic set can
// never interleave and lose a queue write.
const chains = new WeakMap();

export function createShelfBridge({ storage, fetchFn, shelfApiBase, clock, idGen } = {}) {
  if (!storage) throw new Error("storage required");
  const fetchImpl = fetchFn ?? ((...args) => globalThis.fetch(...args));
  const now = () => (clock?.now ? clock.now() : Date.now());
  const setT = clock?.setTimeout ?? ((fn, ms) => setTimeout(fn, ms));
  const clearT = clock?.clearTimeout ?? ((id) => clearTimeout(id));
  const setI = clock?.setInterval ?? ((fn, ms) => setInterval(fn, ms));
  const clearI = clock?.clearInterval ?? ((id) => clearInterval(id));

  // ------------------------------------------------------------ storage
  async function loadRaw() {
    const rec = await storage.get(BRIDGE_KEY);
    const q = rec?.outbox;
    return Array.isArray(q) ? q : [];
  }
  function enqueue(fn) {
    const prev = chains.get(storage) ?? Promise.resolve();
    const run = prev.then(fn);
    chains.set(storage, run.catch(() => {}));
    return run;
  }
  // Read through the chain so a read observes every mutation registered
  // before it, in registration order.
  function readOutbox() {
    return enqueue(async () => structuredClone(await loadRaw()));
  }
  // One atomic record per mutation: load -> mutate -> a single set of
  // the whole record, capped to the last MAX_OUTBOX exactly as the
  // shipped shelfOutboxSave caps on every save.
  function mutateOutbox(fn) {
    return enqueue(async () => {
      const q = await loadRaw();
      const r = await fn(q);
      await storage.set(BRIDGE_KEY, { outbox: q.slice(-MAX_OUTBOX) });
      return r;
    });
  }

  // ------------------------------------------------- shipped primitives
  // Ported line-for-line from app-256.js (Reader 1.4.117); the only
  // substitutions are the injected seams: idGen for crypto.randomUUID,
  // the injected clock for Date.now, storage for localStorage.
  function newQueueId(readId, startedMs) {
    const rand = (idGen ? idGen() : globalThis.crypto?.randomUUID?.())
      || Math.random().toString(36).slice(2) + now().toString(36);
    return "shelf_" + String(readId || "read").replace(/[^a-zA-Z0-9_-]/g, "").slice(-48)
      + "_" + Math.max(0, Number(startedMs) || now()) + "_" + rand;
  }
  function localDate(iso) {
    const d = new Date(iso);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function errorMessage(data, status) {
    return String(data?.error || data?.message || ("Shelf " + status));
  }
  // A 409 overlap: carve the queued item into the uncovered intervals
  // only, each with a fresh id and floored whole-second durations (<1s
  // parts dropped). Returns null for non-overlap messages, [] when the
  // item is fully covered.
  function overlapParts(it, message) {
    const m = String(message || "").match(/overlaps an existing session \((.+?)\s+[–—-]\s+(.+?)\)/i);
    if (!m) return null;
    const start = new Date(it.startedAt).getTime(), end = start + Math.max(0, Number(it.duration_seconds) || 0) * 1000;
    const os = new Date(m[1]).getTime(), oe = new Date(m[2]).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(os) || !Number.isFinite(oe) || end <= start || oe <= os) return null;
    const a = Math.max(start, os), b = Math.min(end, oe);
    if (b <= a) return null;
    if (a <= start && b >= end) return [];
    const parts = [];
    const add = (ps, pe) => {
      // Flooring (shipped rationale): rounding up can recreate the same
      // fractional overlap on the next POST and trap the queue.
      const secs = Math.floor((pe - ps) / 1000);
      if (secs < 1) return;
      const id = newQueueId(it.readId, ps);
      parts.push({ queueId: id, clientSessionId: id, readId: it.readId, startedAt: new Date(ps).toISOString(), duration_seconds: secs, attempts: 0 });
    };
    if (start < a) add(start, a);
    if (b < end) add(b, end);
    return parts;
  }

  // ------------------------------------------------------------- queue
  let activeQueueId = null; // the item currently flushing (merge guard, shipped)

  async function sessionEnded({ readId, startedAtMs, durationSeconds }) {
    await mutateOutbox((q) => {
      const last = q[q.length - 1];
      if (last && last.readId === readId && (last.attempts || 0) === 0 && last.queueId !== activeQueueId) {
        const lastEnd = new Date(last.startedAt).getTime() + Number(last.duration_seconds || 0) * 1000;
        if (Math.abs(startedAtMs - lastEnd) < MERGE_WINDOW_MS) {
          last.duration_seconds = Number(last.duration_seconds || 0) + durationSeconds;
          return;
        }
      }
      const id = newQueueId(readId, startedAtMs);
      q.push({ queueId: id, clientSessionId: id, readId, startedAt: new Date(startedAtMs).toISOString(), duration_seconds: durationSeconds, attempts: 0 });
    });
  }

  // ------------------------------------------------------------- flush
  let flushing = false, flushAgain = false;

  async function flush() {
    if (flushing) {
      flushAgain = true;
      return { busy: true, pending: (await readOutbox()).length, sent: 0, error: null, relinkNeeded: false, outcomes: [] };
    }
    const base = String(shelfApiBase || "").replace(/\/+$/, "");
    if (!base) return { pending: (await readOutbox()).length, sent: 0, covered: 0, error: "Shelf worker URL is missing.", relinkNeeded: false, outcomes: [] };
    flushing = true;
    let sent = 0, covered = 0, error = null, relinkNeeded = false, guard = 0;
    const outcomes = [];
    try {
      do {
        flushAgain = false;
        while (guard++ < 400) {
          // attempts is incremented and persisted BEFORE the POST
          // (crash-safe idempotency, shipped) — one atomic mutation.
          const it = await mutateOutbox((q) => {
            if (!q.length) return null;
            const head = q[0];
            activeQueueId = head.queueId;
            head.attempts = (Number(head.attempts) || 0) + 1;
            delete head.lastError; delete head.lastStatus;
            return structuredClone(head);
          });
          if (!it) break;
          try {
            let r = null, data = null;
            try {
              const payload = { read_id: it.readId, local_date: localDate(it.startedAt), started_at: it.startedAt, duration_seconds: it.duration_seconds };
              if (it.clientSessionId) payload.client_session_id = it.clientSessionId;
              r = await fetchImpl(base + "/api/sessions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
              try { data = await r.json(); } catch { data = null; }
            } catch (e) {
              const msg = e?.message || "Could not reach Opal Shelf.";
              await mutateOutbox((q) => {
                const cur = q.find((x) => x.queueId === it.queueId);
                if (cur) { cur.lastStatus = 0; cur.lastError = msg; }
              });
              outcomes.push({ queueId: it.queueId, outcome: "blocked", status: 0, error: msg });
              error = msg;
              break;
            }
            if (r.ok) {
              await mutateOutbox((q) => {
                const idx = q.findIndex((x) => x.queueId === it.queueId);
                if (idx >= 0) q.splice(idx, 1);
              });
              sent++;
              outcomes.push({ queueId: it.queueId, outcome: "sent" });
              continue;
            }
            const msg = errorMessage(data, r.status);
            // The Shelf Worker checks client_session_id replay BEFORE
            // overlap, so a 409 overlap here is truly unsaved by this
            // key: replace the item with the uncovered intervals under
            // new stable ids (shipped).
            if (r.status === 409) {
              const parts = overlapParts(it, msg);
              if (parts) {
                await mutateOutbox((q) => {
                  const idx = q.findIndex((x) => x.queueId === it.queueId);
                  if (idx >= 0) q.splice(idx, 1, ...parts);
                });
                if (parts.length === 0) { covered++; outcomes.push({ queueId: it.queueId, outcome: "covered" }); }
                else outcomes.push({ queueId: it.queueId, outcome: "carved", parts: parts.map((p) => p.queueId) });
                continue;
              }
            }
            await mutateOutbox((q) => {
              const cur = q.find((x) => x.queueId === it.queueId);
              if (cur) { cur.lastStatus = r.status; cur.lastError = msg; }
            });
            outcomes.push({ queueId: it.queueId, outcome: "blocked", status: r.status, error: msg });
            error = msg;
            if (r.status === 404 && /read-through not found|active read-through not found/i.test(msg)) relinkNeeded = true;
            break;
          } finally { activeQueueId = null; }
        }
      } while (flushAgain && !error);
    } finally { activeQueueId = null; flushing = false; }
    return { pending: (await readOutbox()).length, sent, covered, error, relinkNeeded, outcomes };
  }

  // -------------------------------------------------------- sessionizer
  // Faithful port of the shipped shelfListen* state machine. State is
  // per bridge instance and volatile, exactly as in v1 (module vars) —
  // only the outbox is durable.
  let wallStart = 0, listenReadId = null;
  let checkpointTimer = null, pauseTimer = null, flushTimer = null;
  let pauseAt = 0, lastPauseAt = 0;

  function checkpoint() {
    if (!wallStart || pauseTimer) return;
    const t = now(), secs = Math.max(0, Math.round((t - wallStart) / 1000));
    const readId = listenReadId;
    wallStart = t;
    if (secs >= MIN_SESSION_SECS && readId) void sessionEnded({ readId, startedAtMs: t - secs * 1000, durationSeconds: secs });
  }
  function listenStopConfirmed() {
    pauseTimer = null;
    const pAt = lastPauseAt = pauseAt || now(); pauseAt = 0;
    if (checkpointTimer) { clearI(checkpointTimer); checkpointTimer = null; }
    if (wallStart) {
      const secs = Math.max(0, Math.round((pAt - wallStart) / 1000));
      const readId = listenReadId;
      wallStart = 0; listenReadId = null;
      if (secs >= MIN_SESSION_SECS && readId) void sessionEnded({ readId, startedAtMs: pAt - secs * 1000, durationSeconds: secs });
    }
    if (flushTimer) clearT(flushTimer);
    flushTimer = setT(() => { flushTimer = null; void flush(); }, FLUSH_DELAY_MS);
  }
  function listenStop(atMs) {
    if (pauseTimer) { clearT(pauseTimer); pauseTimer = null; }
    if (flushTimer) { clearT(flushTimer); flushTimer = null; }
    pauseAt = 0;
    if (checkpointTimer) { clearI(checkpointTimer); checkpointTimer = null; }
    if (!wallStart) return;
    const t = Number.isFinite(atMs) ? atMs : now(), secs = Math.max(0, Math.round((t - wallStart) / 1000));
    const readId = listenReadId;
    wallStart = 0; listenReadId = null;
    if (secs >= MIN_SESSION_SECS && readId) {
      void sessionEnded({ readId, startedAtMs: t - secs * 1000, durationSeconds: secs });
      void flush();
    }
  }
  function listenStart(readId, atMs) {
    const t = Number.isFinite(atMs) ? atMs : now();
    if (pauseTimer) { clearT(pauseTimer); pauseTimer = null; pauseAt = 0; }
    else if (flushTimer && t - lastPauseAt < RESUME_WINDOW_MS) { clearT(flushTimer); flushTimer = null; }
    if (!readId) { listenStop(t); return; }
    if (wallStart) return;
    wallStart = t; listenReadId = readId;
    if (checkpointTimer) clearI(checkpointTimer);
    checkpointTimer = setI(checkpoint, CHECKPOINT_MS);
  }
  function listenPaused(atMs) {
    if (!wallStart || pauseTimer) return;
    pauseAt = Number.isFinite(atMs) ? atMs : now();
    pauseTimer = setT(listenStopConfirmed, PAUSE_GRACE_MS);
  }
  // playbackPaused / playbackStopped accept (atMs) or (readId, atMs);
  // v1 takes the read id from the ambient book, so it is ignored there.
  const atOf = (a, b) => (typeof a === "number" ? a : b);

  return {
    sessionEnded,
    flush,
    outbox: () => readOutbox(),
    pendingCount: async () => (await readOutbox()).length,
    playbackStarted: (readId, atMs) => listenStart(readId, atMs),
    playbackResumed: (readId, atMs) => listenStart(readId, atMs),
    playbackPaused: (a, b) => listenPaused(atOf(a, b)),
    playbackStopped: (a, b) => listenStop(atOf(a, b)),
  };
}
