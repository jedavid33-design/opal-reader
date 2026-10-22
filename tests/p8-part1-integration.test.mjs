// Opal Reader v2 — Part 1 (P8 integration build) integration tests.
//
// These exercise the ASSEMBLED artifact surface, not the modules in
// isolation: the worker entry routing end-to-end into the Durable
// Object class over the real SQLite harness, the sync HTTP contracts
// round-tripping through the real client transport + assembled client,
// the provider adapters against scripted provider responses, and the
// isolation proofs Rowan required at B7.
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import workerEntry, { OpalReaderCoordinator, queueHandler, GenerationHaltedError } from "../v2/worker-entry.js";
import { createHttpTransport } from "../v2/client/http-transport.mjs";
import { createAssembledClient } from "../v2/client/assembled-client.mjs";
import { createProviderAdapters, createR2AudioCache, createContentWorkSource, sha256Hex } from "../v2/host/adapters.mjs";
import { makeHarness } from "./helpers/do-harness.mjs";

// ------------------------------------------------------------ fakes
class FakeBucket {
  constructor() { this.map = new Map(); }
  async get(key) {
    const e = this.map.get(key);
    if (!e) return null;
    return { arrayBuffer: async () => e.bytes.slice().buffer, customMetadata: e.customMetadata, httpMetadata: {} };
  }
  async head(key) { return this.map.has(key) ? { size: this.map.get(key).bytes.length } : null; }
  async put(key, bytes, opts = {}) {
    if (opts.onlyIf?.etagDoesNotMatch === "*" && this.map.has(key)) return null;
    this.map.set(key, { bytes: new Uint8Array(bytes), customMetadata: opts.customMetadata || {} });
    return { key };
  }
}

function makeDoNamespace(doEnv) {
  const instances = new Map();
  return {
    idFromName: (name) => name,
    get(id) {
      if (!instances.has(id)) {
        const h = makeHarness({});
        instances.set(id, { inst: new OpalReaderCoordinator(h.state, doEnv), harness: h });
      }
      const { inst } = instances.get(id);
      return { fetch: (req) => inst.fetch(req) };
    },
    _instances: instances,
  };
}

function makeWorkerEnv(overrides = {}) {
  const bucket = new FakeBucket();
  const doEnv = { OPALREADER_STORAGE: bucket, GENERATION_HALT: "1" };
  const env = {
    COORDINATOR: makeDoNamespace(doEnv),
    OPALREADER_ACCESS_TOKEN: "staging-token",
    OPALREADER_V2_SCOPE: "staging-smoke",
    GENERATION_HALT: "1",
    ALLOWED_ORIGIN: "https://jedavid33-design.github.io",
    OPALREADER_STORAGE: bucket,
    ...overrides,
  };
  return { env, bucket };
}

function req(path, { method = "GET", body, token = "staging-token", scope = "staging-smoke", instance = "smoke-p8" } = {}) {
  const headers = { "content-type": "application/json" };
  if (token !== null) headers["x-opalreader-token"] = token;
  if (scope !== null) headers["x-opalreader-scope"] = scope;
  if (instance !== null) headers["x-opalreader-instance"] = instance;
  return new Request("https://staging.test" + path, {
    method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}
const call = (env, r) => workerEntry.fetch(r, env);

function memStorage() {
  const map = new Map();
  return { get: async (k) => (map.has(k) ? structuredClone(map.get(k)) : undefined),
           set: async (k, v) => { map.set(k, structuredClone(v)); },
           del: async (k) => { map.delete(k); } };
}
function transportFor(env, deviceId = "itest-device") {
  return createHttpTransport({
    baseUrl: "https://staging.test", token: "staging-token", deviceId,
    fetchFn: (url, init) => workerEntry.fetch(new Request(url, init), env),
  });
}
function makeWav(seconds = 1, sampleRate = 24000) {
  const dataLen = sampleRate * 2 * seconds;
  const bytes = new Uint8Array(44 + dataLen);
  const dv = new DataView(bytes.buffer);
  const tag = (at, s) => { for (let i = 0; i < 4; i++) dv.setUint8(at + i, s.charCodeAt(i)); };
  tag(0, "RIFF"); dv.setUint32(4, 36 + dataLen, true); tag(8, "WAVE"); tag(12, "fmt ");
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, sampleRate, true); dv.setUint32(28, sampleRate * 2, true);
  dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  tag(36, "data"); dv.setUint32(40, dataLen, true);
  return bytes;
}
const b64 = (bytes) => Buffer.from(bytes).toString("base64");

// ------------------------------------------------------------ entry
test("entry: /health is public and identifies the v2 build", async () => {
  const { env } = makeWorkerEnv();
  const res = await call(env, new Request("https://staging.test/health"));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.app, "OpalReader API v2");
  assert.equal(body.version, "2.0.0");
  assert.equal(body.coordinator, "armed");
  assert.equal(body.generation, "halted");
});

test("isolation (i): unauthenticated and non-staging requests are rejected", async () => {
  const { env } = makeWorkerEnv();
  const noToken = await call(env, req("/v2/settings", { token: null }));
  assert.equal(noToken.status, 401);
  assert.deepEqual(await noToken.json(), { error: "The personal access token is missing or incorrect." });
  const wrongToken = await call(env, req("/v2/settings", { token: "nope" }));
  assert.equal(wrongToken.status, 401);
  const noScope = await call(env, req("/v2/settings", { scope: null }));
  assert.equal(noScope.status, 403);
  assert.equal((await noScope.json()).error, "staging_scope_required");
  const wrongScope = await call(env, req("/v2/settings", { scope: "production" }));
  assert.equal(wrongScope.status, 403);
  // Worker not configured for staging at all: deny, never open.
  const { env: prodEnv } = makeWorkerEnv({ OPALREADER_V2_SCOPE: "production" });
  assert.equal((await call(prodEnv, req("/v2/settings"))).status, 403);
  // Token not configured on the script: 503, still denied.
  const { env: bareEnv } = makeWorkerEnv({ OPALREADER_ACCESS_TOKEN: undefined });
  const bare = await call(bareEnv, req("/v2/settings"));
  assert.equal(bare.status, 503);
  assert.equal((await bare.json()).error, "staging_token_not_configured");
});

test("isolation (ii): no route can read or write v1-shaped data", async () => {
  const { env } = makeWorkerEnv();
  for (const [method, path] of [
    ["GET", "/api/books"], ["POST", "/api/books"], ["GET", "/api/library"],
    ["PUT", "/book/smoke"], ["GET", "/v1/settings"], ["POST", "/sync"],
  ]) {
    const res = await call(env, req(path, { method, body: method === "GET" ? undefined : {} }));
    assert.equal(res.status, 404, `${method} ${path}`);
    assert.equal((await res.json()).error, "route_not_found");
  }
  // Unknown /v2 routes also 404 inside the API — no side doors.
  const res = await call(env, req("/v2/books"));
  assert.equal(res.status, 404);
});

// ------------------------------------------------- end-to-end sync
test("entry + DO + sync contracts round-trip through the real transport and assembled client", async () => {
  const { env } = makeWorkerEnv();
  const transport = transportFor(env);
  const client = createAssembledClient({ deviceId: "itest-device", storage: memStorage(), transport });

  const set = await transport.sendCommand({
    command_id: "itest-settings-1", type: "SetSettings",
    payload: { baseRevision: 0, data: { monthlyCap: 50 } },
  });
  assert.equal(set.outcome, "applied");
  const snap = await transport.snapshot("settings");
  assert.equal(snap.family, "settings");
  assert.equal(snap.entities[0].data.monthlyCap, 50);

  const book = {
    title: "Smoke Book", occurrenceIds: ["o1"],
    chapters: [{ id: "ch1", title: "Chapter 1", segments: [{ occurrenceId: "o1", text: "synthetic smoke words" }] }],
    povs: [{ id: "p1", name: "Narrator", voice: { provider: "gemini", voice_id: "Kore" } }],
  };
  const push = await transport.sendCommand({
    command_id: "itest-sync-1", type: "SyncPush",
    payload: { deviceId: "itest-device", changes: [{
      family: "content", entityKey: "smoke-book", bookId: "smoke-book",
      baseRevision: 0, op: "upsert", payload: book }] },
  });
  assert.equal(push.outcome, "applied");

  // Client store sync + position journal over the HTTP transport.
  const results = await client.funnel.syncNow();
  assert.equal(results.content.applied, true);
  const pos = await client.surfaces.reportPosition("smoke-book",
    { kind: "play", occurrenceId: "o1", offsetSec: 3 });
  assert.equal(pos.pushed, 1);
  const model = await client.surfaces.positionModel("smoke-book");
  assert.equal(model.canonical.occurrenceId, "o1");
  assert.equal(model.canonical.offsetSec, 3);

  // pullChanges page shape + cursor discipline.
  const page = await transport.pullChanges("content", 0, 10);
  assert.equal(page.family, "content");
  assert.ok(page.changes.length >= 1);
  assert.equal(page.cursor.family, "content");
  const bad = await call(env, req("/v2/sync/changes?family=content&cursor=not-json"));
  assert.equal(bad.status, 400);

  // Quota view (F8) through the transport.
  const quota = await transport.quotaView();
  assert.equal(quota.dailyLimit, 100);
});

test("byteCheck route answers from the R2 cache namespace", async () => {
  const { env, bucket } = makeWorkerEnv();
  const transport = transportFor(env);
  const key = "a".repeat(64);
  await bucket.put(`audio/${key}.mp3`, new Uint8Array([1, 2, 3]), {});
  assert.equal(await transport.byteCheck(key), true);
  assert.equal(await transport.byteCheck("b".repeat(64)), false);
  await assert.rejects(() => transport.byteCheck("not-a-key"), (e) => e.status === 400);
});

// ------------------------------------------------- generation halt
test("isolation (iii): queue handler and DO execute refuse while halted; spec has no consumer or provider secrets", async () => {
  const { env } = makeWorkerEnv();
  let acked = false, retried = false;
  await assert.rejects(
    () => queueHandler({ messages: [{ body: { grantId: "g1", jobId: "j1", occurrences: ["o1"] },
      ack() { acked = true; }, retry() { retried = true; } }] }, env),
    (e) => e instanceof GenerationHaltedError && e.code === "generation_halted");
  assert.equal(acked, false); assert.equal(retried, false);

  // Layer 2: a hand-delivered internal execute is refused too.
  const stub = env.COORDINATOR.get("smoke-p8");
  const res = await stub.fetch(new Request("https://do.internal/internal/execute", {
    method: "POST",
    headers: { "content-type": "application/json", "x-opalreader-internal": "1", "x-opalreader-scope": "staging-smoke" },
    body: JSON.stringify({ grantId: "g1", jobId: "j1", occurrences: ["o1"] }),
  }));
  assert.equal(res.status, 423);
  assert.equal((await res.json()).error, "generation_halted");

  const spec = JSON.parse(readFileSync(new URL("../v2/p8/deploy-spec.json", import.meta.url), "utf8"));
  assert.deepEqual(spec.queue_consumers, []);
  // Preflight (Rowan 6347245912): the emitted metadata conforms to the
  // documented Script Upload schema — the queue binding carries ONLY the
  // documented {type, name, queue_name} keys (no producer_only, which is
  // not a documented metadata field), and the migrations object names
  // its migration with new_tag, as the documented migrations flow
  // requires. Producer-only / no-consumer intent lives in the spec's
  // queue_producers + queue_consumers records and is verified live.
  const queueBinding = spec.bindings.find((b) => b.name === "OPALREADER_GENERATION");
  assert.deepEqual(Object.keys(queueBinding).sort(), ["name", "queue_name", "type"]);
  assert.equal(spec.durable_object_migrations.new_tag, "v1");
  assert.deepEqual(spec.durable_object_migrations.new_sqlite_classes, ["OpalReaderCoordinator"]);
  assert.deepEqual(spec.kv_bindings, []);
  assert.deepEqual(spec.provider_secrets_present, []);
  assert.ok(spec.provider_secrets_absent_by_design.includes("GEMINI_API_KEY"));
  assert.ok(!JSON.stringify(spec).includes("staging-token"));
});

// ------------------------------------------------------- providers
test("providers: halt refuses before any network call; removed providers refuse by name", async () => {
  let calls = 0;
  const fetchFn = async () => { calls++; throw new Error("must not be called"); };
  const halted = createProviderAdapters({ GENERATION_HALT: "1", GEMINI_API_KEY: "x" }, fetchFn);
  await assert.rejects(() => halted.synthesize({ occurrenceId: "o1", payload: { text: "t", voice: "Kore" } }),
    (e) => e.code === "generation_halted");
  assert.equal(calls, 0);
  const enabled = createProviderAdapters({ GENERATION_HALT: "0", GEMINI_API_KEY: "x" }, fetchFn);
  await assert.rejects(() => enabled.synthesize({ occurrenceId: "o1", payload: { text: "t", voice: "v", provider: "fish" } }),
    (e) => e.code === "provider_not_carried_over" && e.httpStatus === 422);
  assert.equal(calls, 0);
});

test("providers: Gemini legacy + OpenAI + Batch kernels behind the executor seam (scripted fetch)", async () => {
  const wav = makeWav(1);
  const mp3 = new Uint8Array(417 * 12);
  mp3[0] = 0xff; mp3[1] = 0xfb; mp3[2] = 0x90; mp3[3] = 0x00;
  const seen = [];
  const fetchFn = async (url, init) => {
    seen.push(String(url));
    if (String(url).includes(":generateContent"))
      return Response.json({ candidates: [{ content: { parts: [{ inlineData: { data: b64(new Uint8Array(48000)), mimeType: "audio/L16;rate=24000" } }] } }] });
    if (String(url).includes("api.openai.com"))
      return new Response(mp3, { status: 200 });
    if (String(url).includes(":batchGenerateContent"))
      return Response.json({ name: "batches/abc123" });
    if (String(url).includes("/batches/abc123"))
      return Response.json({ done: true, metadata: { state: "BATCH_STATE_SUCCEEDED" },
        response: { inlinedResponses: [{ response: { candidates: [{ content: { parts: [{ inlineData: { data: b64(wav), mimeType: "audio/wav" } }] } }] } }] } });
    if (String(url).includes("/batches?"))
      return Response.json({ batches: [{ name: "batches/abc123", displayName: "opalreader-x-o1" }] });
    throw new Error("unexpected url " + url);
  };
  const providers = createProviderAdapters(
    { GENERATION_HALT: "0", GEMINI_API_KEY: "gk", OPENAI_API_KEY: "ok" }, fetchFn);
  const g = await providers.synthesize({ occurrenceId: "o1", payload: { text: "hello", voice: "Kore", provider: "gemini", model: "gemini-2.5-flash-tts" } });
  assert.equal(g.format, "wav"); assert.equal(g.durationSec, 1);
  const o = await providers.synthesize({ occurrenceId: "o2", payload: { text: "hello", voice: "alloy", provider: "openai" } });
  assert.equal(o.format, "mp3"); assert.ok(o.durationSec > 0);
  const sub = await providers.submitBatch({ occurrenceId: "o1", payload: { text: "hello", voice: "Kore", provider: "gemini", model: "gemini-3.8-flash-tts" } }, "opalreader-x-o1");
  assert.equal(sub.name, "batches/abc123");
  const polled = await providers.getBatch(sub.name);
  assert.equal(polled.done, true); assert.equal(polled.state, "BATCH_STATE_SUCCEEDED");
  assert.equal(polled.format, "wav");
  const listed = await providers.listBatchesByDisplayName("opalreader-x-o1");
  assert.deepEqual(listed, [{ name: "batches/abc123", displayName: "opalreader-x-o1" }]);
  assert.throws(() => providers.verifyNeverAcceptedEvidence(),
    (e) => e.code === "never_accepted_evidence_unverifiable");
});

// ------------------------------------------------------------ cache
test("cache adapter: putIfAbsent/probe/flush/hydrate round-trip over a fake R2 bucket", async () => {
  const bucket = new FakeBucket();
  const key = "c".repeat(64);
  const cache = createR2AudioCache(bucket);
  const bytes = new Uint8Array([9, 8, 7, 6]);
  const put = cache.putIfAbsent(key, { audio: bytes, format: "mp3", durationSec: 2 });
  assert.equal(put.stored, true);
  assert.equal(cache.probe.exists(key), true);
  assert.equal(cache.probe.recordedSha256(key), sha256Hex(bytes));
  assert.equal(cache.putIfAbsent(key, { audio: bytes, format: "mp3", durationSec: 2 }).stored, false);
  await cache.flush();
  assert.ok(bucket.map.has(`audio/${key}.mp3`));
  const cache2 = createR2AudioCache(bucket);
  assert.equal(await cache2.byteCheck(key), true);
  assert.equal(cache2.probe.hash(key), sha256Hex(bytes));
});

// ------------------------------------------------------- work source
test("work source resolves occurrence payloads from the coordinator content plane", async () => {
  const h = makeHarness({});
  await h.coord.handleCommand({ command_id: "ws-1", type: "SyncPush", payload: {
    deviceId: "d1", changes: [{ family: "content", entityKey: "b1", bookId: "b1", baseRevision: 0, op: "upsert",
      payload: { title: "T", occurrenceIds: ["o1"],
        chapters: [{ id: "ch1", segments: [{ occurrenceId: "o1", text: "words here", pov: "Narrator" }] }],
        povs: [{ id: "p1", name: "Narrator", voice: { provider: "gemini", voice_id: "Kore", style_direction: "warm" } }] } }] } });
  await h.coord.handleCommand({ command_id: "ws-2", type: "SubmitJob", payload: {
    jobId: "job-ws", bookId: "b1", chapterIndex: 0, lane: "batch",
    occurrences: [{ occurrenceId: "o1", revisionKey: "fp-o1", estMicroCents: 1 }], data: {} } });
  const workSource = createContentWorkSource(h.coord);
  const payload = await workSource("job-ws", "o1");
  assert.equal(payload.text, "words here");
  assert.equal(payload.voice, "Kore");
  assert.equal(payload.provider, "gemini");
  assert.equal(payload.styleDirection, "warm");
  assert.equal(payload.mode, "batch");
  assert.equal(await workSource("job-ws", "missing"), null);
});

// ------------------------------------------- preview + root integrity
test("isolation (iv): preview bundle composes the client + bridge and root served files are byte-identical", async () => {
  const client = createAssembledClient({
    deviceId: "itest-device", storage: memStorage(),
    transport: { sendCommand: async () => ({}), snapshot: async () => ({}), pullChanges: async () => ({}),
                 pushPosition: async () => ({}), byteCheck: async () => false, quotaView: async () => ({}),
                 positionView: async () => ({}) },
    shelf: { shelfApiBase: "", fetchFn: async () => { throw new Error("offline"); } },
  });
  assert.equal(typeof client.shelfBridge.sessionEnded, "function");
  await client.shelfBridge.sessionEnded({ readId: "smoke-read", startedAtMs: 1_700_000_000_000, durationSeconds: 30 });
  assert.equal(await client.shelfBridge.pendingCount(), 1);

  const html = readFileSync(new URL("../v2-preview/index.html", import.meta.url), "utf8");
  for (const id of ["recoverAudio", "copyPlaybackLog", "findQuery", "styleText", "quotaModel", "shelfStart"])
    assert.ok(html.includes(`id="${id}"`), `preview missing #${id}`);
  const app = readFileSync(new URL("../v2-preview/preview-app.js", import.meta.url), "utf8");
  for (const marker of ["createAssembledClient", "createHttpTransport", "quotaModel", "findText", "style_direction", "shelfBridge", "recoverAudio"])
    assert.ok(app.includes(marker), `preview app missing ${marker}`);

  // Git blob ids pinned at the merge (fb472be8) — the branch must not
  // have moved the shipped files by a single byte.
  const blobId = (name) => {
    const bytes = readFileSync(new URL(`../${name}`, import.meta.url));
    const head = Buffer.from(`blob ${bytes.length}\0`);
    return createHash("sha1").update(Buffer.concat([head, bytes])).digest("hex");
  };
  assert.equal(blobId("index.html"), "82d82364e681dc6211e758a0370e0f2995b9c6c4");
  assert.equal(blobId("app-256.js"), "217fe3cfa2e22e7db35c03846c5390b05df68a76");
  assert.equal(blobId("cloudflare-worker.js"), "2a89a5f96dc9aa3b887bc4b8dae9051b41b14312");
});
