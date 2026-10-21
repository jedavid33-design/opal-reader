// Run: node --test tests/shelf-bridge-replay.test.mjs
// P6 proof (Roundtable Case #8, requirement F12): DIFFERENTIAL REPLAY.
// Identical scripted scenarios run through (a) the extracted shipped v1
// shelf functions (the P1 harness, unchanged) and (b) the v2 adapter
// (v2/client/shelf-bridge.mjs), asserting after EVERY step: identical
// outbox contents, identical fetch call sequences (URL + exact body
// bytes), identical flush outcomes.
//
// Determinism alignment (Wren's spec, issue #13): both sides draw ids
// from the SAME seeded sequence — one instance of the seeded generator
// per side (same seed, same algorithm): the v1 side via a stubbed
// globalThis.crypto.randomUUID (the exact call shelfNewQueueId makes),
// the v2 side via its injected idGen, both fresh per scenario. The
// sequences align only if both sides create ids in the same order and
// count; a divergence fails the test and nothing is normalized away. Wall clock: fixed epoch ms on both sides; local_date uses v1's
// LOCAL timezone getters, so the replay process pins one TZ (below) and
// a near-local-midnight scenario is required coverage.
//
// No live Shelf contact of any kind: fetch is a script on both sides.
process.env.TZ = "America/New_York";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createShelfBridge } from "../v2/client/shelf-bridge.mjs";

const app = readFileSync(new URL("../app-256.js", import.meta.url), "utf8");
const fixture = (n) => JSON.parse(readFileSync(new URL("./fixtures/shelf/" + n, import.meta.url), "utf8"));
const between = (src, a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i);
  assert.ok(i >= 0 && j > i, "missing source " + a); return src.slice(i, j); };
// Extracted verbatim from the shipped bundle — declarations, not ports. (P1 harness, unchanged.)
const code = [
  between(app, "function shelfNewQueueId", "function shelfOutbox"),
  between(app, "function shelfOutbox", "function shelfQueue"),
  between(app, "function shelfQueue", "function shelfLocalDate"),
  between(app, "function shelfLocalDate", "function shelfOverlapParts"),
  between(app, "function shelfOverlapParts", "function shelfReplaceQueueItem"),
  between(app, "function shelfReplaceQueueItem", "let shelfFlushAgain"),
  between(app, "let shelfFlushAgain", "function shelfLinkOpen"),
].join("\n");
const sessionCode = [
  between(app, "function shelfActive", "function shelfNewQueueId"),
].join("\n");

function makeShelf(fetchImpl, store = new Map()) {
  const localStorage = {
    getItem: (k) => store.has(k) ? store.get(k) : null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k) };
  const a = { shelfApiBase: "https://shelf.test" };
  const factory = new Function("localStorage", "fetch", "a",
    "let shelfFlushing=false;\n" + code +
    "\nreturn {shelfQueue,shelfFlush,shelfOutbox,shelfOverlapParts,shelfLocalDate};");
  return { api: factory(localStorage, fetchImpl, a), store };
}
function fakeClock(startMs) {
  let now = startMs, seq = 1; const timers = new Map();
  const arm = (fn, ms, interval) => { const id = seq++; timers.set(id, { fn, at: now + ms, interval }); return id; };
  return { now: () => now,
    setTimeout: (fn, ms) => arm(fn, ms, 0), setInterval: (fn, ms) => arm(fn, ms, ms),
    clearTimeout: (id) => timers.delete(id), clearInterval: (id) => timers.delete(id),
    advance(ms) { const end = now + ms;
      for (;;) { let due = null;
        for (const [id, t] of timers) if (t.at <= end && (!due || t.at < due.at)) due = { id, at: t.at, t };
        if (!due) break;
        now = due.at;
        if (due.t.interval) due.t.at = now + due.t.interval; else timers.delete(due.id);
        due.t.fn(); }
      now = end; } };
}
function makeShelfTimed(fetchImpl, startMs, readId) {
  const clock = fakeClock(startMs);
  class FakeDate extends Date { static now() { return clock.now(); } }
  const store = new Map();
  const localStorage = {
    getItem: (k) => store.has(k) ? store.get(k) : null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k) };
  const a = { shelfApiBase: "https://shelf.test", shelfLogEnabled: true,
    book: { id: "book-1", shelfReadId: readId } };
  const ee = { _singleSegmentPreview: false };
  const factory = new Function("localStorage", "fetch", "a", "ee",
    "setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date",
    "let shelfListenWallStart=0,shelfListenBookId=null,shelfListenReadId=null,shelfListenTimer=null,shelfFlushing=false;\n" +
    sessionCode + "\n" + code +
    "\nreturn {shelfListenStart,shelfListenPaused,shelfListenStop,shelfOutbox,shelfFlush};");
  const api = factory(localStorage, fetchImpl, a, ee,
    clock.setTimeout, clock.clearTimeout, clock.setInterval, clock.clearInterval, FakeDate);
  return { api, clock, store };
}

// ------------------------------------------------------------ harness
// One seeded id generator shared by BOTH sides of a scenario.
function makeIdGen() {
  let n = 0;
  const gen = () => "00000000-0000-4000-8000-" + String(++n).padStart(12, "0");
  gen.reset = () => { n = 0; };
  return gen;
}
const cryptoDesc = Object.getOwnPropertyDescriptor(globalThis, "crypto");
function stubCrypto(gen) {
  Object.defineProperty(globalThis, "crypto", { value: { randomUUID: gen }, configurable: true, writable: true });
}
function restoreCrypto() {
  if (cryptoDesc) Object.defineProperty(globalThis, "crypto", cryptoDesc);
  else delete globalThis.crypto;
}
// A scripted fetch: each call consumes the next script entry
// ({status, data} or {throw: message}); the last entry repeats. Every
// call is logged with its exact body bytes, plus — via hooks.onCall —
// the head item's attempts count at POST time (persisted-before-POST).
function makeFetch(script, hooks = {}) {
  const log = [];
  let i = 0;
  const fetchFn = async (url, opts) => {
    const entry = { url, method: opts.method, headers: opts.headers, body: opts.body, attemptsAtPost: hooks.onCall ? hooks.onCall() : null };
    log.push(entry);
    const step = script.length ? script[Math.min(i++, script.length - 1)] : { status: 200, data: {} };
    if (step.throw) throw new Error(step.throw);
    return { ok: step.status >= 200 && step.status < 300, status: step.status, json: async () => step.data ?? {} };
  };
  return { fetchFn, log };
}
function makeBridgeStorage() {
  const map = new Map();
  const storage = {
    get: async (k) => (map.has(k) ? structuredClone(map.get(k)) : undefined),
    set: async (k, v) => { map.set(k, structuredClone(v)); },
    del: async (k) => { map.delete(k); },
  };
  return { storage, map };
}
const tick = () => new Promise((r) => setImmediate(r));
async function settleV1() { for (let i = 0; i < 6; i++) await tick(); }
async function settleV2(w) {
  let prev = "";
  for (let i = 0; i < 40; i++) {
    await tick();
    const cur = JSON.stringify(await w.bridge.outbox()) + "|" + w.f2.log.length;
    if (cur === prev) break;
    prev = cur;
  }
}
const normRes = (r) => ({ pending: r.pending, sent: r.sent, covered: r.covered ?? 0, error: r.error, relinkNeeded: r.relinkNeeded, busy: !!r.busy });

// Queue/flush worlds: extracted v1 (localStorage) vs the v2 adapter.
// Each side gets its own instance of the SAME seeded generator (same
// seed, same algorithm): the sequences align only if both sides create
// ids in the same order and count — a divergence fails the comparisons.
async function makeWorlds(script = []) {
  const gen1 = makeIdGen(); stubCrypto(gen1);
  const gen2 = makeIdGen();
  const h1 = {}, h2 = {};
  const f1 = makeFetch(script, h1);
  const v1 = makeShelf(f1.fetchFn);
  const f2 = makeFetch(script, h2);
  const bs = makeBridgeStorage();
  const bridge = createShelfBridge({ storage: bs.storage, fetchFn: f2.fetchFn, shelfApiBase: "https://shelf.test", idGen: gen2 });
  h1.onCall = () => v1.api.shelfOutbox()[0]?.attempts ?? null;
  h2.onCall = () => bs.map.get("cs:shelf-bridge:v1")?.outbox?.[0]?.attempts ?? null;
  const w = { gen1, gen2, v1, bridge, f1, f2, bs };
  w.synced = async (label) => {
    await settleV1(); await settleV2(w);
    assert.deepEqual(await bridge.outbox(), v1.api.shelfOutbox(), label + ": outbox");
    assert.deepEqual(f2.log, f1.log, label + ": fetch log");
  };
  w.flushBoth = async (label) => {
    const r1 = await v1.api.shelfFlush();
    const r2 = await bridge.flush();
    assert.deepEqual(normRes(r2), normRes(r1), label + ": flush outcome");
    await w.synced(label);
    return r2;
  };
  return w;
}
// Timed worlds: extracted v1 sessionizer (fake clock + FakeDate) vs the
// adapter sessionizer on an identical fake clock.
async function makeTimedWorlds(script = [], startMs = 1760000000000, readId = "read-1") {
  const gen1 = makeIdGen(); stubCrypto(gen1);
  const gen2 = makeIdGen();
  const f1 = makeFetch(script);
  const v1 = makeShelfTimed(f1.fetchFn, startMs, readId);
  const f2 = makeFetch(script);
  const bs = makeBridgeStorage();
  const c2 = fakeClock(startMs);
  const bridge = createShelfBridge({ storage: bs.storage, fetchFn: f2.fetchFn, shelfApiBase: "https://shelf.test", idGen: gen2,
    clock: { now: c2.now, setTimeout: c2.setTimeout, clearTimeout: c2.clearTimeout, setInterval: c2.setInterval, clearInterval: c2.clearInterval } });
  const w = { gen1, gen2, v1, bridge, f1, f2, bs, c1: v1.clock, c2 };
  w.synced = async (label) => {
    await settleV1(); await settleV2(w);
    assert.deepEqual(await bridge.outbox(), v1.api.shelfOutbox(), label + ": outbox");
    assert.deepEqual(f2.log, f1.log, label + ": fetch log");
  };
  w.advance = async (ms, label) => { v1.clock.advance(ms); c2.advance(ms); await w.synced(label ?? ("advance " + ms)); };
  return w;
}
const T0 = 1760000000000;

// ------------------------------------------------- queue/flush replay
test("replay: simple queue + flush 2xx — identical bytes, attempts persisted before POST", async () => {
  try {
    const w = await makeWorlds([{ status: 200, data: {} }]);
    const f = fixture("queue-merge.case.json");
    await w.bridge.sessionEnded({ readId: f.base.readId, startedAtMs: f.base.startedMs, durationSeconds: f.base.secs });
    w.v1.api.shelfQueue(f.base.readId, f.base.startedMs, f.base.secs);
    await w.synced("queued");
    const r2 = await w.flushBoth("flushed");
    assert.equal(r2.sent, 1);
    assert.equal(w.f1.log.length, 1);
    assert.equal(w.f1.log[0].attemptsAtPost, 1); // incremented + persisted BEFORE the POST
    assert.equal(w.f2.log[0].attemptsAtPost, 1);
    assert.equal(w.f1.log[0].url, "https://shelf.test/api/sessions");
    assert.equal(w.f1.log[0].body, w.f2.log[0].body); // exact body bytes
    assert.deepEqual(JSON.parse(w.f2.log[0].body), { ...fixture("session-payload.simple.json"), client_session_id: JSON.parse(w.f2.log[0].body).client_session_id });
  } finally { restoreCrypto(); }
});

test("replay: merge inside 90s merges, exactly 90s does not, 89.999s merges into the newest", async () => {
  try {
    const w = await makeWorlds();
    const f = fixture("queue-merge.case.json");
    const T = f.base.startedMs;
    const queueBoth = async (startedMs, secs, label) => {
      w.v1.api.shelfQueue(f.base.readId, startedMs, secs);
      await w.bridge.sessionEnded({ readId: f.base.readId, startedAtMs: startedMs, durationSeconds: secs });
      await w.synced(label);
    };
    await queueBoth(T, f.base.secs, "first");
    await queueBoth(T + f.insideWindow.secondStartOffsetMs, f.insideWindow.secondSecs, "inside window merges");
    let q = await w.bridge.outbox();
    assert.equal(q.length, 1); assert.equal(q[0].duration_seconds, 2100);
    const endAfterMerge = T + 2100 * 1000;
    await queueBoth(endAfterMerge + 90000, 600, "exactly 90s gap: no merge (shipped rule is strict <)");
    q = await w.bridge.outbox();
    assert.equal(q.length, 2); assert.equal(q[1].duration_seconds, 600);
    const secondEnd = endAfterMerge + 90000 + 600 * 1000;
    await queueBoth(secondEnd + 89999, 60, "89.999s gap merges into the newest item");
    q = await w.bridge.outbox();
    assert.equal(q.length, 2); assert.equal(q[1].duration_seconds, 660);
    assert.equal(w.f1.log.length, 0);
  } finally { restoreCrypto(); }
});

test("replay: 409 partial carve — item replaced by uncovered intervals, parts delivered", async () => {
  try {
    const f = fixture("overlap-carve.case.json");
    const w = await makeWorlds([
      { status: 409, data: { error: f.serverMessage } },
      { status: 200, data: {} },
      { status: 200, data: {} },
    ]);
    w.v1.api.shelfQueue(f.item.readId, Date.parse(f.item.startedAt), f.item.duration_seconds);
    await w.bridge.sessionEnded({ readId: f.item.readId, startedAtMs: Date.parse(f.item.startedAt), durationSeconds: f.item.duration_seconds });
    await w.synced("queued");
    const r2 = await w.flushBoth("carved + delivered");
    assert.equal(r2.sent, 2);
    assert.equal(w.f1.log.length, 3);
    assert.deepEqual(w.f2.log.slice(1).map((c) => { const b = JSON.parse(c.body); return { started_at: b.started_at, duration_seconds: b.duration_seconds }; }),
      f.expectedParts.map((p) => ({ started_at: p.startedAt, duration_seconds: p.duration_seconds })));
    const carved = r2.outcomes.find((o) => o.outcome === "carved");
    assert.ok(carved && carved.parts.length === 2);
    assert.notEqual(JSON.parse(w.f2.log[1].body).client_session_id, JSON.parse(w.f2.log[0].body).client_session_id);
  } finally { restoreCrypto(); }
});

test("replay: 409 fully covered — item dropped, counted covered, nothing resent", async () => {
  try {
    const f = fixture("overlap-carve.case.json");
    const w = await makeWorlds([{ status: 409, data: { error: f.fullyCoveredMessage } }]);
    w.v1.api.shelfQueue(f.item.readId, Date.parse(f.item.startedAt), f.item.duration_seconds);
    await w.bridge.sessionEnded({ readId: f.item.readId, startedAtMs: Date.parse(f.item.startedAt), durationSeconds: f.item.duration_seconds });
    const r2 = await w.flushBoth("fully covered");
    assert.equal(r2.covered, 1);
    assert.equal(r2.sent, 0);
    assert.equal(w.f1.log.length, 1);
    assert.deepEqual(r2.outcomes.map((o) => o.outcome), ["covered"]);
  } finally { restoreCrypto(); }
});

test("replay: 404 read-through not found — relinkNeeded, head blocked, next item untouched", async () => {
  try {
    const w = await makeWorlds([{ status: 404, data: { error: "read-through not found" } }]);
    const f = fixture("queue-merge.case.json");
    w.v1.api.shelfQueue(f.base.readId, f.base.startedMs, 300);
    await w.bridge.sessionEnded({ readId: f.base.readId, startedAtMs: f.base.startedMs, durationSeconds: 300 });
    w.v1.api.shelfQueue("other_read_99", f.base.startedMs + 86400000, 300);
    await w.bridge.sessionEnded({ readId: "other_read_99", startedAtMs: f.base.startedMs + 86400000, durationSeconds: 300 });
    await w.synced("queued two");
    const r2 = await w.flushBoth("404");
    assert.equal(r2.relinkNeeded, true);
    assert.equal(r2.error, "read-through not found");
    assert.equal(w.f1.log.length, 1); // second item never attempted
    const q = await w.bridge.outbox();
    assert.equal(q.length, 2);
    assert.equal(q[0].attempts, 1); assert.equal(q[0].lastStatus, 404); assert.equal(q[0].lastError, "read-through not found");
    assert.equal(q[1].attempts, 0);
  } finally { restoreCrypto(); }
});

test("replay: 500 then network throw — head-of-line blocking, attempts persisted, error stamps", async () => {
  try {
    const w = await makeWorlds([
      { status: 500, data: { error: "Shelf boom" } },
      { throw: "net down" },
    ]);
    const f = fixture("queue-merge.case.json");
    w.v1.api.shelfQueue(f.base.readId, f.base.startedMs, 300);
    await w.bridge.sessionEnded({ readId: f.base.readId, startedAtMs: f.base.startedMs, durationSeconds: 300 });
    w.v1.api.shelfQueue("other_read_99", f.base.startedMs + 86400000, 300);
    await w.bridge.sessionEnded({ readId: "other_read_99", startedAtMs: f.base.startedMs + 86400000, durationSeconds: 300 });
    const r1 = await w.flushBoth("500 blocks");
    assert.equal(r1.error, "Shelf boom");
    let q = await w.bridge.outbox();
    assert.equal(q[0].attempts, 1); assert.equal(q[0].lastStatus, 500); assert.equal(q[0].lastError, "Shelf boom");
    assert.equal(q[1].attempts, 0);
    const r2 = await w.flushBoth("throw blocks");
    assert.equal(r2.error, "net down");
    q = await w.bridge.outbox();
    assert.equal(q[0].attempts, 2); assert.equal(q[0].lastStatus, 0); assert.equal(q[0].lastError, "net down");
    assert.equal(w.f1.log.length, 2); // the second item was never attempted in either flush
    assert.equal(w.f1.log[1].attemptsAtPost, 2);
  } finally { restoreCrypto(); }
});

test("replay: restart mid-queue — a fresh bridge over the same storage flushes the durable outbox", async () => {
  try {
    const w = await makeWorlds([{ status: 200, data: {} }]);
    const f = fixture("queue-merge.case.json");
    for (let i = 0; i < 3; i++) {
      const start = f.base.startedMs + i * 86400000;
      w.v1.api.shelfQueue(f.base.readId, start, 300 + i);
      await w.bridge.sessionEnded({ readId: f.base.readId, startedAtMs: start, durationSeconds: 300 + i });
    }
    await w.synced("queued three");
    // Restart BOTH sides: v1 rebuilt over the same localStorage store,
    // v2 rebuilt over the same client storage.
    const v1b = makeShelf(w.f1.fetchFn, w.v1.store);
    const bridgeB = createShelfBridge({ storage: w.bs.storage, fetchFn: w.f2.fetchFn, shelfApiBase: "https://shelf.test", idGen: w.gen2 });
    assert.deepEqual(await bridgeB.outbox(), v1b.api.shelfOutbox(), "restart: outbox survives");
    const r1 = await v1b.api.shelfFlush();
    const r2 = await bridgeB.flush();
    assert.deepEqual(normRes(r2), normRes(r1), "restart: flush outcome");
    assert.equal(r2.sent, 3);
    await settleV1(); await settleV2(w);
    assert.deepEqual(w.f2.log, w.f1.log, "restart: fetch log");
    assert.deepEqual(await bridgeB.outbox(), [], "restart: drained");
  } finally { restoreCrypto(); }
});

test("replay: session near local midnight — local_date from LOCAL getters (UTC date differs)", async () => {
  try {
    // Pinned TZ sanity: 2026-10-22T03:30Z is 2026-10-21 23:30 in America/New_York.
    assert.equal(new Date(Date.UTC(2026, 9, 22, 3, 30, 0)).getDate(), 21);
    const w = await makeWorlds([{ status: 200, data: {} }]);
    const startMs = Date.UTC(2026, 9, 22, 3, 30, 0);
    w.v1.api.shelfQueue("read-1", startMs, 1500);
    await w.bridge.sessionEnded({ readId: "read-1", startedAtMs: startMs, durationSeconds: 1500 });
    await w.flushBoth("midnight flush");
    const body = JSON.parse(w.f2.log[0].body);
    assert.equal(body.started_at, "2026-10-22T03:30:00.000Z");
    assert.equal(body.local_date, "2026-10-21"); // local date, NOT the UTC date
  } finally { restoreCrypto(); }
});

test("replay: outbox cap keeps the newest 300 items, oldest dropped first", async () => {
  try {
    const w = await makeWorlds();
    for (let i = 0; i < 305; i++) {
      w.v1.api.shelfQueue("cap_read", T0 + i * 120000, 10);
      await w.bridge.sessionEnded({ readId: "cap_read", startedAtMs: T0 + i * 120000, durationSeconds: 10 });
    }
    await w.synced("capped");
    const q = await w.bridge.outbox();
    assert.equal(q.length, 300);
    assert.equal(q[0].startedAt, new Date(T0 + 5 * 120000).toISOString());
    assert.equal(q[299].startedAt, new Date(T0 + 304 * 120000).toISOString());
  } finally { restoreCrypto(); }
});

// --------------------------------------------------- sessionizer replay
test("replay timing: 30s checkpoints queue chunks that merge into one session", async () => {
  try {
    const w = await makeTimedWorlds([], T0);
    w.v1.api.shelfListenStart();
    w.bridge.playbackStarted("read-1", w.c2.now());
    await w.advance(30000, "first checkpoint");
    let q = await w.bridge.outbox();
    assert.equal(q.length, 1); assert.equal(q[0].duration_seconds, 30);
    await w.advance(30000, "second checkpoint merges");
    q = await w.bridge.outbox();
    assert.equal(q.length, 1); assert.equal(q[0].duration_seconds, 60);
  } finally { restoreCrypto(); }
});

test("replay timing: pause resumed at 3.9s — session continues, checkpoint counts the pause", async () => {
  try {
    const w = await makeTimedWorlds([{ status: 200, data: {} }], T0);
    w.v1.api.shelfListenStart();
    w.bridge.playbackStarted("read-1", w.c2.now());
    await w.advance(20000, "listening 20s");
    w.v1.api.shelfListenPaused();
    w.bridge.playbackPaused(w.c2.now());
    await w.advance(3900, "inside the 4s grace: nothing queued");
    assert.equal((await w.bridge.outbox()).length, 0);
    w.v1.api.shelfListenStart(); // resume inside the grace period
    w.bridge.playbackResumed("read-1", w.c2.now());
    await w.advance(10000, "30s checkpoint crosses (wall clock, pause included)");
    let q = await w.bridge.outbox();
    assert.equal(q.length, 1); assert.equal(q[0].duration_seconds, 30);
    assert.equal(q[0].startedAt, new Date(T0).toISOString());
    w.v1.api.shelfListenPaused();
    w.bridge.playbackPaused(w.c2.now());
    await w.advance(4000, "stop confirmed; 3.9s remainder is below the 5s floor, not queued");
    q = await w.bridge.outbox();
    assert.equal(q.length, 1); assert.equal(q[0].duration_seconds, 30);
    await w.advance(90000, "armed flush (95s after the stop) has not fired yet");
    assert.equal(w.f1.log.length, 0);
    await w.advance(10000, "armed flush fires");
    assert.equal(w.f1.log.length, 1);
    const body = JSON.parse(w.f2.log[0].body);
    assert.equal(body.duration_seconds, 30);
    assert.equal(body.started_at, new Date(T0).toISOString());
    assert.equal((await w.bridge.outbox()).length, 0);
  } finally { restoreCrypto(); }
});

test("replay timing: pause not resumed — session ends BACKDATED to the pause moment (25s, not 29s)", async () => {
  try {
    const w = await makeTimedWorlds([{ status: 200, data: {} }], T0);
    w.v1.api.shelfListenStart();
    w.bridge.playbackStarted("read-1", w.c2.now());
    await w.advance(25000, "listening 25s");
    w.v1.api.shelfListenPaused();
    w.bridge.playbackPaused(w.c2.now());
    await w.advance(4000, "grace expires: stop confirmed, backdated to the pause");
    const q = await w.bridge.outbox();
    assert.equal(q.length, 1);
    assert.equal(q[0].duration_seconds, 25); // NOT 29: the 4s grace is excluded
    assert.equal(q[0].startedAt, new Date(T0).toISOString());
    await w.advance(95000, "armed flush delivers the backdated session");
    assert.equal(w.f1.log.length, 1);
    assert.equal(JSON.parse(w.f2.log[0].body).duration_seconds, 25);
    assert.equal((await w.bridge.outbox()).length, 0);
  } finally { restoreCrypto(); }
});

test("replay timing: resume within 90s of a stop cancels the flush and continues the same session", async () => {
  try {
    const w = await makeTimedWorlds([{ status: 200, data: {} }], T0);
    w.v1.api.shelfListenStart();
    w.bridge.playbackStarted("read-1", w.c2.now());
    await w.advance(20000, "listening 20s");
    w.v1.api.shelfListenPaused();
    w.bridge.playbackPaused(w.c2.now());
    await w.advance(4000, "stopped; 20s queued; flush armed for +95s");
    assert.equal((await w.bridge.outbox())[0].duration_seconds, 20);
    await w.advance(80000, "84s after the pause: inside the 90s resume window");
    w.v1.api.shelfListenStart(); // cancels the pending flush; the session continues
    w.bridge.playbackStarted("read-1", w.c2.now());
    await w.advance(120000, "checkpoints merge into the still-queued session");
    assert.equal(w.f1.log.length, 0); // the armed flush never fired
    const q = await w.bridge.outbox();
    assert.equal(q.length, 1);
    assert.equal(q[0].duration_seconds, 140); // 20 + 4x30 checkpoint chunks, merged
    await w.advance(10000, "10s past the last checkpoint");
    w.v1.api.shelfListenStop();
    w.bridge.playbackStopped(w.c2.now());
    await w.synced("stop queues the >=5s remainder (merged: +10) and flushes");
    assert.equal(w.f1.log.length, 1);
    assert.equal(JSON.parse(w.f2.log[0].body).duration_seconds, 150);
    assert.equal((await w.bridge.outbox()).length, 0);
  } finally { restoreCrypto(); }
});

// ------------------------------------------- golden fixtures vs adapter
test("fixtures: golden outbox item and session payload against the adapter directly", async () => {
  const f = fixture("queue-merge.case.json");
  const item = fixture("outbox-item.simple.json");
  const golden = fixture("session-payload.simple.json");
  const f2 = makeFetch([{ status: 200, data: {} }]);
  const bs = makeBridgeStorage();
  const bridge = createShelfBridge({ storage: bs.storage, fetchFn: f2.fetchFn, shelfApiBase: "https://shelf.test", idGen: () => item.queueId.split("_").pop() });
  await bridge.sessionEnded({ readId: f.base.readId, startedAtMs: f.base.startedMs, durationSeconds: f.base.secs });
  assert.deepEqual(await bridge.outbox(), [item]);
  const r = await bridge.flush();
  assert.equal(r.sent, 1);
  assert.deepEqual(JSON.parse(f2.log[0].body), golden);
  assert.equal(f2.log[0].url, "https://shelf.test/api/sessions");
  assert.equal(await bridge.pendingCount(), 0);
});

test("fixtures: merge case against the adapter (inside merges, outside creates a second item)", async () => {
  const f = fixture("queue-merge.case.json");
  const gen = makeIdGen();
  { const bs = makeBridgeStorage();
    const bridge = createShelfBridge({ storage: bs.storage, fetchFn: async () => { throw new Error("no fetch expected"); }, shelfApiBase: "https://shelf.test", idGen: gen });
    await bridge.sessionEnded({ readId: f.base.readId, startedAtMs: f.base.startedMs, durationSeconds: f.base.secs });
    await bridge.sessionEnded({ readId: f.base.readId, startedAtMs: f.base.startedMs + f.insideWindow.secondStartOffsetMs, durationSeconds: f.insideWindow.secondSecs });
    const q = await bridge.outbox();
    assert.equal(q.length, f.insideWindow.expectedItems);
    assert.equal(q[0].duration_seconds, f.insideWindow.expectedDurationSeconds);
  }
  { const bs = makeBridgeStorage();
    const bridge = createShelfBridge({ storage: bs.storage, fetchFn: async () => { throw new Error("no fetch expected"); }, shelfApiBase: "https://shelf.test", idGen: gen });
    await bridge.sessionEnded({ readId: f.base.readId, startedAtMs: f.base.startedMs, durationSeconds: f.base.secs });
    await bridge.sessionEnded({ readId: f.base.readId, startedAtMs: f.base.startedMs + f.outsideWindow.secondStartOffsetMs, durationSeconds: f.outsideWindow.secondSecs });
    const q = await bridge.outbox();
    assert.equal(q.length, f.outsideWindow.expectedItems);
    assert.equal(q[1].duration_seconds, f.outsideWindow.expectedSecondDurationSeconds);
  }
});

test("fixtures: overlap carve against the adapter — exact parts, fresh ids, fully covered", async () => {
  const f = fixture("overlap-carve.case.json");
  const uuids = [f.item.queueId.split("_").pop(), "11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"];
  let ui = 0;
  const idGen = () => uuids[Math.min(ui++, uuids.length - 1)];
  const f2 = makeFetch([
    { status: 409, data: { error: f.serverMessage } },
    { status: 200, data: {} },
    { status: 200, data: {} },
  ]);
  const bs = makeBridgeStorage();
  const bridge = createShelfBridge({ storage: bs.storage, fetchFn: f2.fetchFn, shelfApiBase: "https://shelf.test", idGen });
  await bridge.sessionEnded({ readId: f.item.readId, startedAtMs: Date.parse(f.item.startedAt), durationSeconds: f.item.duration_seconds });
  const r = await bridge.flush();
  assert.equal(r.sent, 2);
  assert.deepEqual(f2.log.slice(1).map((c) => { const b = JSON.parse(c.body); return { started_at: b.started_at, duration_seconds: b.duration_seconds }; }),
    f.expectedParts.map((p) => ({ started_at: p.startedAt, duration_seconds: p.duration_seconds })));
  assert.notEqual(JSON.parse(f2.log[1].body).client_session_id, f.item.clientSessionId);
  // Fully covered variant:
  const f3 = makeFetch([{ status: 409, data: { error: f.fullyCoveredMessage } }]);
  const bs2 = makeBridgeStorage();
  ui = 0;
  const bridge2 = createShelfBridge({ storage: bs2.storage, fetchFn: f3.fetchFn, shelfApiBase: "https://shelf.test", idGen });
  await bridge2.sessionEnded({ readId: f.item.readId, startedAtMs: Date.parse(f.item.startedAt), durationSeconds: f.item.duration_seconds });
  const r2 = await bridge2.flush();
  assert.equal(r2.covered, 1);
  assert.deepEqual(await bridge2.outbox(), []);
});

test("adapter storage: the outbox lives under its own v2 key, nothing else is touched", async () => {
  const bs = makeBridgeStorage();
  const bridge = createShelfBridge({ storage: bs.storage, fetchFn: async () => ({ ok: true, status: 200, json: async () => ({}) }), shelfApiBase: "https://shelf.test", idGen: makeIdGen() });
  await bridge.sessionEnded({ readId: "read-1", startedAtMs: T0, durationSeconds: 60 });
  await bridge.flush();
  assert.deepEqual([...bs.map.keys()], ["cs:shelf-bridge:v1"]);
  assert.equal(await bridge.pendingCount(), 0);
});
