// Opal Reader v2 — Part 1 B7 SAFETY-ROUND tests (Rowan 6346291349).
//
// The final two staging-safety items before B7 can close:
//
//   Item 1 — the smoke R2 namespace is enforced IN CODE, not only in
//   the deploy spec. OpalReaderCoordinator._cache() is the single
//   construction gate for the audio cache; while the script scope is
//   "staging-smoke" it may only construct the cache with
//   R2_KEY_PREFIX exactly "smoke-p8/". A missing, empty, or wrong
//   prefix throws the named StagingR2NamespaceError BEFORE the cache
//   exists — the instrumented bucket below proves zero get/head/put
//   calls on every violation, so a misconfigured staging upload can
//   never silently touch the production `audio/<key>` namespace in
//   the shared bucket. Non-staging scopes keep the previous
//   unprefixed-or-configured behavior unchanged.
//
//   Item 2 — the preview's Shelf bridge is dry-run/local-only BY
//   CONSTRUCTION. The user-entered "Shelf API base" input and every
//   code path that could POST to an arbitrary external Shelf are
//   gone; the preview composes the bridge with a local fixture
//   transport (v2-preview/fake-shelf-transport.js) as its only fetch
//   seam. Flushing exercises the bridge's FIFO discipline against
//   the fixture and records what WOULD be sent. (The artifact build
//   byte-copies v2-preview/, so assertions on these sources bind the
//   assembled preview artifact.)
//
// Pre-round verification: the Item 1 denial tests and the Item 2
// source assertions fail against the pre-round tree (a7cd2113) —
// _cache() had no scope check (requests succeeded and the bucket
// recorded operations), and the preview still carried the shelfBase
// input and live-flush wiring. Verified during this round with a
// scratch worktree; the scratch copy is not committed.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import workerEntry, {
  OpalReaderCoordinator, StagingR2NamespaceError, SMOKE_R2_KEY_PREFIX,
} from "../v2/worker-entry.js";
import { createHttpTransport } from "../v2/client/http-transport.mjs";
import { createAssembledClient } from "../v2/client/assembled-client.mjs";
import { createFakeShelfTransport, FAKE_SHELF_BASE } from "../v2-preview/fake-shelf-transport.js";
import { makeHarness } from "./helpers/do-harness.mjs";

// ------------------------------------------------------------ fakes
// A bucket that records EVERY operation (op + key) so a test can
// assert zero bucket contact, not merely a wrong-looking result.
class InstrumentedBucket {
  constructor() { this.map = new Map(); this.calls = []; }
  async get(key) {
    this.calls.push({ op: "get", key });
    const e = this.map.get(key);
    if (!e) return null;
    return { arrayBuffer: async () => e.bytes.slice().buffer, customMetadata: e.customMetadata, httpMetadata: {} };
  }
  async head(key) {
    this.calls.push({ op: "head", key });
    return this.map.has(key) ? { size: this.map.get(key).bytes.length } : null;
  }
  async put(key, bytes, opts = {}) {
    this.calls.push({ op: "put", key });
    if (opts.onlyIf?.etagDoesNotMatch === "*" && this.map.has(key)) return null;
    this.map.set(key, { bytes: new Uint8Array(bytes), customMetadata: opts.customMetadata || {} });
    return { key };
  }
  seed(key, bytes, meta = {}) { this.map.set(key, { bytes: new Uint8Array(bytes), customMetadata: meta }); }
}

function makeDo(bucket, envOverrides = {}) {
  const h = makeHarness({});
  const env = {
    OPALREADER_STORAGE: bucket,
    OPALREADER_V2_SCOPE: "staging-smoke",
    GENERATION_HALT: "1",
    ...envOverrides,
  };
  return new OpalReaderCoordinator(h.state, env);
}

// ============================================================ Item 1
test("ns: staging scope + missing R2_KEY_PREFIX — named error before any bucket operation", async () => {
  const bucket = new InstrumentedBucket();
  const inst = makeDo(bucket); // no R2_KEY_PREFIX in env at all
  await assert.rejects(() => inst._cache(),
    (e) => e instanceof StagingR2NamespaceError && e.code === "staging_r2_namespace_required");
  assert.deepEqual(bucket.calls, [], "zero bucket operations on violation");
});

test("ns: staging scope + wrong prefixes — named error, zero bucket operations, every time", async () => {
  for (const wrong of ["", "audio/", "smoke-p8", "smoke-p9/", "SMOKE-P8/", "/", "smoke-p8//"]) {
    const bucket = new InstrumentedBucket();
    const inst = makeDo(bucket, { R2_KEY_PREFIX: wrong });
    await assert.rejects(() => inst._cache(),
      (e) => e instanceof StagingR2NamespaceError && e.code === "staging_r2_namespace_required",
      `prefix ${JSON.stringify(wrong)} must be refused`);
    assert.deepEqual(bucket.calls, [], `zero bucket operations for prefix ${JSON.stringify(wrong)}`);
  }
});

test("ns: staging scope + exactly 'smoke-p8/' — cache works and every bucket key carries the prefix", async () => {
  const bucket = new InstrumentedBucket();
  const key = "a".repeat(64);
  bucket.seed(`smoke-p8/audio/${key}.mp3`, new Uint8Array([1, 2, 3]), {});
  bucket.seed(`audio/${key}.mp3`, new Uint8Array([4, 5, 6]), {}); // production twin must stay invisible
  const inst = makeDo(bucket, { R2_KEY_PREFIX: SMOKE_R2_KEY_PREFIX });
  const cache = await inst._cache();
  assert.equal(await cache.byteCheck(key), true, "smoke object visible through the enforced namespace");
  assert.ok(bucket.calls.length > 0, "the allowed path really did consult the bucket");
  for (const c of bucket.calls)
    assert.ok(c.key.startsWith("smoke-p8/"), `bucket ${c.op} escaped the namespace: ${c.key}`);
});

test("ns: non-staging scopes keep the unprefixed-or-configured behavior unchanged", async () => {
  const key = "b".repeat(64);
  const audio = new Uint8Array([7, 7, 7]);
  // Scope absent (the harness/legacy shape): no prefix → production key shape.
  const bucket1 = new InstrumentedBucket();
  const inst1 = makeDo(bucket1, { OPALREADER_V2_SCOPE: undefined });
  const cache1 = await inst1._cache();
  cache1.putIfAbsent(key, { audio, format: "mp3", durationSec: 1 });
  await cache1.flush();
  assert.ok(bucket1.map.has(`audio/${key}.mp3`), "unprefixed production shape preserved");
  // A future production scope with a configured prefix: honored as configured.
  const bucket2 = new InstrumentedBucket();
  const inst2 = makeDo(bucket2, { OPALREADER_V2_SCOPE: "production", R2_KEY_PREFIX: "audio-v2/" });
  const cache2 = await inst2._cache();
  cache2.putIfAbsent(key, { audio, format: "mp3", durationSec: 1 });
  await cache2.flush();
  assert.ok(bucket2.map.has(`audio-v2/audio/${key}.mp3`), "configured prefix honored outside staging scope");
});

// Entry-level: the DO env is the script env in production, so a
// staging upload that omits the binding reaches _cache() through the
// public fetch surface too — and must fail the request with the
// bucket untouched.
function makeEntryEnv(bucket, doEnvOverrides = {}) {
  const doEnv = {
    OPALREADER_STORAGE: bucket,
    OPALREADER_V2_SCOPE: "staging-smoke",
    GENERATION_HALT: "1",
    ...doEnvOverrides,
  };
  const instances = new Map();
  const coordinator = {
    idFromName: (name) => name,
    get(id) {
      if (!instances.has(id)) {
        const h = makeHarness({});
        instances.set(id, new OpalReaderCoordinator(h.state, doEnv));
      }
      const inst = instances.get(id);
      return { fetch: (r) => inst.fetch(r) };
    },
  };
  return {
    COORDINATOR: coordinator,
    OPALREADER_ACCESS_TOKEN: "staging-token",
    OPALREADER_V2_SCOPE: "staging-smoke",
    GENERATION_HALT: "1",
    ALLOWED_ORIGIN: "https://jedavid33-design.github.io",
    OPALREADER_STORAGE: bucket,
  };
}

test("ns: through the entry, a staging DO missing the prefix fails closed — request denied, bucket untouched", async () => {
  const bucket = new InstrumentedBucket();
  const env = makeEntryEnv(bucket); // DO env has NO R2_KEY_PREFIX
  const transport = createHttpTransport({
    baseUrl: "https://staging.test", token: "staging-token", deviceId: "safety-device",
    fetchFn: (url, init) => workerEntry.fetch(new Request(url, init), env),
  });
  await assert.rejects(() => transport.byteCheck("c".repeat(64)),
    (e) => e.status === 500 && /staging_r2_namespace_required|R2_KEY_PREFIX/.test(String(e.body?.error || e.message)));
  assert.deepEqual(bucket.calls, [], "zero bucket operations through the whole entry path");
});

test("ns: through the entry, a correctly bound staging DO serves byte-checks inside the namespace only", async () => {
  const bucket = new InstrumentedBucket();
  const env = makeEntryEnv(bucket, { R2_KEY_PREFIX: "smoke-p8/" });
  const transport = createHttpTransport({
    baseUrl: "https://staging.test", token: "staging-token", deviceId: "safety-device",
    fetchFn: (url, init) => workerEntry.fetch(new Request(url, init), env),
  });
  const key = "d".repeat(64);
  bucket.seed(`smoke-p8/audio/${key}.mp3`, new Uint8Array([1]), {});
  assert.equal(await transport.byteCheck(key), true);
  bucket.seed(`audio/${"e".repeat(64)}.mp3`, new Uint8Array([1]), {});
  assert.equal(await transport.byteCheck("e".repeat(64)), false, "production twin invisible");
  for (const c of bucket.calls)
    assert.ok(c.key.startsWith("smoke-p8/"), `bucket ${c.op} escaped the namespace: ${c.key}`);
});

// ============================================================ Item 2
test("preview: no Shelf base input and no user-supplied Shelf origin anywhere in the bundle", () => {
  const dir = new URL("../v2-preview/", import.meta.url);
  for (const name of readdirSync(dir)) {
    const text = readFileSync(new URL(name, dir), "utf8");
    // The removed input's DOM id / accessor identifier must appear
    // NOWHERE in the bundle — no element offers it, no code reads it.
    // (Prose in comments may still name the thing that was removed.)
    assert.ok(!text.includes("shelfBase"), `${name} still references the removed Shelf base input`);
  }
  const html = readFileSync(new URL("../v2-preview/index.html", import.meta.url), "utf8");
  assert.ok(!html.includes('type="url" placeholder="Leave empty to queue sessions'),
    "the old 'queue locally only' Shelf URL field is gone");
  const app = readFileSync(new URL("../v2-preview/preview-app.js", import.meta.url), "utf8");
  // The bridge's fetch seam is the local fixture, wired by name.
  assert.ok(app.includes("createFakeShelfTransport"), "preview composes the local fixture transport");
  assert.ok(app.includes("fetchFn: fakeShelf.fetchFn"), "the fixture is the bridge's fetch seam");
  assert.ok(app.includes("shelfApiBase: fakeShelf.base"), "the only Shelf base is the fixed fixture label");
});

function memStorage() {
  const map = new Map();
  return { get: async (k) => (map.has(k) ? structuredClone(map.get(k)) : undefined),
           set: async (k, v) => { map.set(k, structuredClone(v)); },
           del: async (k) => { map.delete(k); } };
}
const stubTransport = {
  sendCommand: async () => ({}), snapshot: async () => ({}), pullChanges: async () => ({}),
  pushPosition: async () => ({}), byteCheck: async () => false, quotaView: async () => ({}),
  positionView: async () => ({}),
};

test("preview fixture: a flush delivers the outbox to the fake transport in FIFO order and records the would-be sends", async () => {
  const fake = createFakeShelfTransport();
  assert.equal(fake.base, FAKE_SHELF_BASE);
  const client = createAssembledClient({
    deviceId: "safety-device", storage: memStorage(), transport: stubTransport,
    shelf: { shelfApiBase: fake.base, fetchFn: fake.fetchFn },
  });
  const t0 = 1_700_000_000_000;
  await client.shelfBridge.sessionEnded({ readId: "read-a", startedAtMs: t0, durationSeconds: 30 });
  await client.shelfBridge.sessionEnded({ readId: "read-b", startedAtMs: t0 + 3_600_000, durationSeconds: 45 });
  await client.shelfBridge.sessionEnded({ readId: "read-c", startedAtMs: t0 + 7_200_000, durationSeconds: 60 });
  assert.equal(await client.shelfBridge.pendingCount(), 3);
  const result = await client.shelfBridge.flush();
  assert.equal(result.error, null);
  assert.equal(result.sent, 3);
  assert.equal(await client.shelfBridge.pendingCount(), 0);
  // The fixture received exactly the queued sessions, head first,
  // in the frozen wire shape — these records are what the preview
  // displays as the would-be sends.
  assert.deepEqual(fake.sent.map((p) => p.read_id), ["read-a", "read-b", "read-c"]);
  assert.deepEqual(fake.sent.map((p) => p.duration_seconds), [30, 45, 60]);
  for (const p of fake.sent) {
    assert.equal(typeof p.local_date, "string");
    assert.equal(typeof p.started_at, "string");
    assert.equal(typeof p.client_session_id, "string");
  }
});

test("preview fixture: the fake is the bridge's only fetch — a poisoned global fetch is never used; non-session POSTs record nothing", async () => {
  const fake = createFakeShelfTransport();
  const realFetch = globalThis.fetch;
  let globalCalls = 0;
  globalThis.fetch = async () => { globalCalls++; throw new Error("global fetch must never be used for Shelf"); };
  try {
    const client = createAssembledClient({
      deviceId: "safety-device", storage: memStorage(), transport: stubTransport,
      shelf: { shelfApiBase: fake.base, fetchFn: fake.fetchFn },
    });
    await client.shelfBridge.sessionEnded({ readId: "read-x", startedAtMs: 1_700_000_000_000, durationSeconds: 20 });
    const result = await client.shelfBridge.flush();
    assert.equal(result.sent, 1);
    assert.equal(globalCalls, 0, "the bridge never fell back to the global fetch");
  } finally {
    globalThis.fetch = realFetch;
  }
  // The fixture answers only the sessions contract; anything else is
  // a 404 and is NOT recorded as a would-be send.
  const before = fake.sent.length;
  const wrong = await fake.fetchFn("local-fixture://shelf/api/other", { method: "POST", body: "{}" });
  assert.equal(wrong.status, 404);
  const get = await fake.fetchFn("local-fixture://shelf/api/sessions", { method: "GET" });
  assert.equal(get.status, 404);
  assert.equal(fake.sent.length, before, "rejected calls record nothing");
});
