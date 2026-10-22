// Opal Reader v2 — Part 1 B7 REVISION tests (Rowan 6345016639).
//
// Focused regression coverage for the two pre-upload fixes:
//
//   Fix 1 — staging routing fails closed to the smoke instance. While
//   the script is scoped "staging-smoke", x-opalreader-instance must
//   be explicitly "smoke-p8": a missing header, "account", or any
//   other value is denied BEFORE the DO namespace is touched, so the
//   staging script can never instantiate the future production DO.
//
//   Fix 2 — R2 flush write safety. A failed conditional PUT is never
//   retried unconditionally; indeterminate errors and unverifiable or
//   digest-mismatched winners fail closed with R2FlushError; a
//   verified winner is adopted (with the hydrate-ordering bug fixed);
//   and the smoke instance's R2 keys live under a non-overlapping
//   "smoke-p8/" prefix while production key shapes stay unchanged.
//
// Each Fix-2 scenario and the Fix-1 "account" scenario fail against
// the pre-revision code (unconditional fallback / winner dropped /
// account routable); that was verified during the revision round.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import workerEntry, { OpalReaderCoordinator } from "../v2/worker-entry.js";
import { createHttpTransport } from "../v2/client/http-transport.mjs";
import { createR2AudioCache, R2FlushError, sha256Hex } from "../v2/host/adapters.mjs";
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

// A bucket that records every PUT (key, bytes, options) and can be
// scripted: failNextPut throws once; onPut may intercept a PUT (e.g.
// simulate a competing writer winning the race) and return a result.
class CountingBucket extends FakeBucket {
  constructor() { super(); this.puts = []; this.failNextPut = null; this.onPut = null; }
  async put(key, bytes, opts = {}) {
    this.puts.push({ key, bytes: new Uint8Array(bytes), opts });
    if (this.failNextPut) { const e = this.failNextPut; this.failNextPut = null; throw e; }
    if (this.onPut) { const r = await this.onPut(key, bytes, opts, this); if (r !== undefined) return r; }
    return super.put(key, bytes, opts);
  }
  seed(key, bytes, meta = {}) { this.map.set(key, { bytes: new Uint8Array(bytes), customMetadata: meta }); }
}

// A DO namespace that records every idFromName call, so a test can
// prove a denied request never instantiated ANY instance — above all
// not "account".
function makeInstrumentedDoNamespace(doEnv) {
  const idFromNameCalls = [];
  const instances = new Map();
  return {
    idFromNameCalls, instances,
    idFromName(name) { idFromNameCalls.push(name); return name; },
    get(id) {
      if (!instances.has(id)) {
        const h = makeHarness({});
        instances.set(id, new OpalReaderCoordinator(h.state, doEnv));
      }
      const inst = instances.get(id);
      return { fetch: (r) => inst.fetch(r) };
    },
  };
}

function makeWorkerEnv({ doOverrides = {}, envOverrides = {} } = {}) {
  const bucket = new FakeBucket();
  const doEnv = { OPALREADER_STORAGE: bucket, GENERATION_HALT: "1", ...doOverrides };
  const coordinator = makeInstrumentedDoNamespace(doEnv);
  const env = {
    COORDINATOR: coordinator,
    OPALREADER_ACCESS_TOKEN: "staging-token",
    OPALREADER_V2_SCOPE: "staging-smoke",
    GENERATION_HALT: "1",
    ALLOWED_ORIGIN: "https://jedavid33-design.github.io",
    OPALREADER_STORAGE: bucket,
    ...envOverrides,
  };
  return { env, bucket, coordinator };
}

function req(path, { method = "GET", body, token = "staging-token", scope = "staging-smoke", instance = "smoke-p8", origin = null } = {}) {
  const headers = { "content-type": "application/json" };
  if (token !== null) headers["x-opalreader-token"] = token;
  if (scope !== null) headers["x-opalreader-scope"] = scope;
  if (instance !== null) headers["x-opalreader-instance"] = instance;
  if (origin !== null) headers["origin"] = origin;
  return new Request("https://staging.test" + path, {
    method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}
const call = (env, r) => workerEntry.fetch(r, env);

// ============================================================ Fix 1
test("fix1: instance 'account' is denied in staging and the account DO is never instantiated", async () => {
  const { env, coordinator } = makeWorkerEnv();
  const res = await call(env, req("/v2/sync/snapshot?family=settings", { instance: "account" }));
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error, "staging_instance_required");
  // The namespace was never touched: no instance resolved, none built.
  assert.deepEqual(coordinator.idFromNameCalls, []);
  assert.equal(coordinator.instances.size, 0);
});

test("fix1: a missing instance header is denied in staging, no DO contact", async () => {
  const { env, coordinator } = makeWorkerEnv();
  const res = await call(env, req("/v2/sync/snapshot?family=settings", { instance: null }));
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error, "staging_instance_required");
  assert.deepEqual(coordinator.idFromNameCalls, []);
  assert.equal(coordinator.instances.size, 0);
});

test("fix1: any other instance value is denied in staging, no DO contact", async () => {
  const { env, coordinator } = makeWorkerEnv();
  for (const bogus of ["production", "acct", "smoke", "SMOKE-P8"]) {
    const res = await call(env, req("/v2/sync/snapshot?family=settings", { instance: bogus }));
    assert.equal(res.status, 403, `instance ${JSON.stringify(bogus)}`);
    assert.equal((await res.json()).error, "staging_instance_required");
  }
  assert.deepEqual(coordinator.idFromNameCalls, []);
  assert.equal(coordinator.instances.size, 0);
});

test("fix1: explicit instance 'smoke-p8' is allowed; only the smoke instance is ever resolved", async () => {
  const { env, coordinator } = makeWorkerEnv();
  const res = await call(env, req("/v2/sync/snapshot?family=settings", { instance: "smoke-p8" }));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.family, "settings");
  assert.deepEqual(coordinator.idFromNameCalls, ["smoke-p8"]);
  assert.ok(coordinator.instances.has("smoke-p8"));
  assert.ok(!coordinator.instances.has("account"));
});

test("fix1+2: through the entry, the staging cache cannot see production keys and can see its smoke namespace", async () => {
  const { env, bucket } = makeWorkerEnv({ doOverrides: { R2_KEY_PREFIX: "smoke-p8/" } });
  const transport = createHttpTransport({
    baseUrl: "https://staging.test", token: "staging-token", deviceId: "b7-device",
    fetchFn: (url, init) => workerEntry.fetch(new Request(url, init), env),
  });
  const key = "e".repeat(64);
  // A production-shaped object is invisible to the staging cache.
  await bucket.put(`audio/${key}.mp3`, new Uint8Array([1, 2, 3]), {});
  assert.equal(await transport.byteCheck(key), false);
  // The same key inside the smoke namespace is visible.
  await bucket.put(`smoke-p8/audio/${key}.mp3`, new Uint8Array([1, 2, 3]), {});
  assert.equal(await transport.byteCheck(key), true);
});

// ============================================================ Fix 2
const KEY = "f".repeat(64);
const OBJ = `audio/${KEY}.mp3`;
const AUDIO = new Uint8Array([9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);

test("fix2(a): conditional PUT precondition failure with a matching winner — adopted, no second PUT, no overwrite", async () => {
  const bucket = new CountingBucket();
  // The race: between flush's head (absent) and its conditional PUT,
  // a competing writer lands the SAME bytes and the PUT reports the
  // unmet precondition (null), exactly like the real R2 binding.
  bucket.onPut = async (key, bytes, opts, self) => {
    self.seed(key, bytes, { sha256: sha256Hex(bytes), identity: KEY });
    return null;
  };
  const cache = createR2AudioCache(bucket);
  cache.putIfAbsent(KEY, { audio: AUDIO, format: "mp3", durationSec: 2 });
  const result = await cache.flush();
  assert.equal(result.flushed, 1);
  assert.equal(bucket.puts.length, 1, "exactly one PUT — the conditional one; no retry of any kind");
  assert.equal(bucket.puts[0].opts.onlyIf?.etagDoesNotMatch, "*");
  assert.deepEqual([...bucket.map.get(OBJ).bytes], [...AUDIO], "winner's object untouched");
  const entry = cache.get(KEY);
  assert.ok(entry, "winner adopted into the snapshot");
  assert.equal(entry.pending, false);
  assert.equal(entry.sha256, sha256Hex(AUDIO));
  assert.deepEqual([...entry.audio], [...AUDIO]);
});

test("fix2(b): a winner whose digest mismatches fails closed and is never overwritten", async () => {
  const bucket = new CountingBucket();
  const winnerBytes = new Uint8Array([1, 1, 1, 1]);
  bucket.seed(OBJ, winnerBytes, { sha256: sha256Hex(winnerBytes), identity: KEY });
  const cache = createR2AudioCache(bucket);
  cache.putIfAbsent(KEY, { audio: AUDIO, format: "mp3", durationSec: 2 });
  await assert.rejects(() => cache.flush(),
    (e) => e instanceof R2FlushError && e.code === "r2_winner_digest_mismatch");
  assert.equal(bucket.puts.length, 0, "no PUT was attempted against the winner");
  assert.deepEqual([...bucket.map.get(OBJ).bytes], [...winnerBytes], "winner's bytes intact");
});

test("fix2(c): an indeterminate PUT error fails closed — one conditional attempt, no unconditional retry", async () => {
  const bucket = new CountingBucket();
  bucket.failNextPut = new Error("simulated network failure");
  const cache = createR2AudioCache(bucket);
  cache.putIfAbsent(KEY, { audio: AUDIO, format: "mp3", durationSec: 2 });
  await assert.rejects(() => cache.flush(),
    (e) => e instanceof R2FlushError && e.code === "r2_flush_indeterminate");
  assert.equal(bucket.puts.length, 1, "the failed PUT was the only PUT — no fallback retry");
  assert.equal(bucket.puts[0].opts.onlyIf?.etagDoesNotMatch, "*", "the only PUT carried the condition");
  assert.equal(bucket.map.has(OBJ), false, "nothing was written by a fallback");
});

test("fix2(d): winner adoption hydrates the snapshot with the winner's bytes (evict-before-hydrate ordering)", async () => {
  const bucket = new CountingBucket();
  // A redelivery wrote the object before this request's flush runs;
  // head() finds it. Pre-fix, flush called hydrateKey() while the
  // pending entry still occupied the snapshot (a no-op) and then
  // deleted the key — the winner was never adopted and get() was null.
  bucket.seed(OBJ, AUDIO, { sha256: sha256Hex(AUDIO), identity: KEY, duration_seconds: "2" });
  const cache = createR2AudioCache(bucket);
  cache.putIfAbsent(KEY, { audio: AUDIO, format: "mp3", durationSec: 2 });
  const result = await cache.flush();
  assert.equal(result.flushed, 1);
  assert.equal(bucket.puts.length, 0, "winner already durable — no PUT at all");
  const entry = cache.get(KEY);
  assert.ok(entry, "the winner's entry is in the snapshot (pre-fix: null)");
  assert.deepEqual([...entry.audio], [...AUDIO], "the snapshot holds the winner's bytes");
  assert.equal(entry.pending, false);
  assert.equal(entry.durationSec, 2);
  assert.equal(cache.probe.exists(KEY), true);
  assert.equal(cache.probe.hash(KEY), sha256Hex(AUDIO));
});

test("fix2: smoke keyPrefix namespaces every key; the default cache keeps production key shapes", async () => {
  const bucket = new CountingBucket();
  const smoke = createR2AudioCache(bucket, { keyPrefix: "smoke-p8/" });
  smoke.putIfAbsent(KEY, { audio: AUDIO, format: "mp3", durationSec: 2 });
  await smoke.flush();
  assert.ok(bucket.map.has(`smoke-p8/${OBJ}`), "smoke write landed under the prefix");
  assert.ok(!bucket.map.has(OBJ), "no smoke write touched the production key");
  for (const k of bucket.map.keys()) assert.ok(k.startsWith("smoke-p8/"), k);
  // Hydration respects the same namespace boundary.
  const smoke2 = createR2AudioCache(bucket, { keyPrefix: "smoke-p8/" });
  assert.equal(await smoke2.byteCheck(KEY), true);
  const prod = createR2AudioCache(bucket);
  assert.equal(await prod.byteCheck(KEY), false, "production view does not see smoke objects");
  // And the unprefixed shape is exactly the production shape.
  const bucket2 = new CountingBucket();
  const plain = createR2AudioCache(bucket2);
  plain.putIfAbsent(KEY, { audio: AUDIO, format: "mp3" });
  await plain.flush();
  assert.ok(bucket2.map.has(OBJ), "default cache writes audio/<key>.<ext>");
});

test("fix2: the deploy spec carries the smoke namespace binding (R2_KEY_PREFIX=smoke-p8/)", async () => {
  const spec = JSON.parse(readFileSync(new URL("../v2/p8/deploy-spec.json", import.meta.url), "utf8"));
  const binding = spec.bindings.find((b) => b.name === "R2_KEY_PREFIX");
  assert.ok(binding, "R2_KEY_PREFIX binding present");
  assert.equal(binding.type, "plain_text");
  assert.equal(binding.text, "smoke-p8/");
  assert.equal(spec.smoke_r2_namespace?.key_prefix, "smoke-p8/");
});

// ============================================================ F-A
// Preview-session finding F-A (Rowan close review 6353069802; fix
// shape approved 6353186341): stagingGate's refusals must carry the
// same allowlisted CORS headers as every other public response, so
// a browser at the allowlisted origin can READ a refusal instead of
// surfacing a network "Load failed". For a non-allowlisted or absent
// Origin the refusal must stay exactly what it was (no ACAO, no
// leak); statuses, bodies, and gate order are unchanged throughout.
// The env-scope and token-not-configured legs are harness-only (they
// cannot be produced on the live worker without breaking its
// configuration).
const PAGES_ORIGIN = "https://jedavid33-design.github.io";
const EVIL_ORIGIN = "https://evil.example";

const gateDenials = [
  ["bad token → 401", (origin) => ({
    ...makeWorkerEnv(),
    request: req("/v2/quota", { token: "wrong-token-value", origin }),
  }), 401, "The personal access token is missing or incorrect."],
  ["bad request scope → 403", (origin) => ({
    ...makeWorkerEnv(),
    request: req("/v2/quota", { scope: "bogus-scope", origin }),
  }), 403, "staging_scope_required"],
  ["bad env scope → 403 (harness-only leg)", (origin) => ({
    ...makeWorkerEnv({ envOverrides: { OPALREADER_V2_SCOPE: "production" } }),
    request: req("/v2/quota", { origin }),
  }), 403, "staging_scope_required"],
  ["token not configured → 503 (harness-only leg)", (origin) => ({
    ...makeWorkerEnv({ envOverrides: { OPALREADER_ACCESS_TOKEN: undefined } }),
    request: req("/v2/quota", { origin }),
  }), 503, "staging_token_not_configured"],
];

for (const [name, setup, status, errorText] of gateDenials) {
  test(`F-A: gate refusal (${name}) is CORS-readable only from the allowlisted origin`, async () => {
    // Allowlisted Origin: refusal carries the echoed ACAO + Vary,
    // status and body unchanged.
    {
      const { env, request } = setup(PAGES_ORIGIN);
      const res = await call(env, request);
      assert.equal(res.status, status);
      assert.equal((await res.json()).error, errorText);
      assert.equal(res.headers.get("access-control-allow-origin"), PAGES_ORIGIN);
      assert.equal(res.headers.get("vary"), "Origin");
    }
    // Non-allowlisted Origin: NO ACAO (fail-closed, nothing leaks to
    // an unapproved origin); status/body identical.
    {
      const { env, request } = setup(EVIL_ORIGIN);
      const res = await call(env, request);
      assert.equal(res.status, status);
      assert.equal((await res.json()).error, errorText);
      assert.equal(res.headers.get("access-control-allow-origin"), null);
    }
    // No Origin (non-browser clients): byte-for-byte the pre-fix
    // behavior — same status, same body, no ACAO.
    {
      const { env, request } = setup(null);
      const res = await call(env, request);
      assert.equal(res.status, status);
      assert.equal((await res.json()).error, errorText);
      assert.equal(res.headers.get("access-control-allow-origin"), null);
    }
  });
}

test("F-A: no gate refusal leaks a token value in body or headers", async () => {
  const { env } = makeWorkerEnv();
  const res = await call(env, req("/v2/quota", { token: "wrong-token-value", origin: PAGES_ORIGIN }));
  assert.equal(res.status, 401);
  const text = await res.text();
  assert.ok(!text.includes("wrong-token-value"), "the presented token is not echoed");
  assert.ok(!text.includes("staging-token"), "the configured token never appears");
  for (const [, v] of res.headers) {
    assert.ok(!v.includes("wrong-token-value") && !v.includes("staging-token"),
      "no credential material in any response header");
  }
});

test("F-A: browser-shaped sequence — preflight, then a denied request whose refusal is readable verbatim", async () => {
  const { env } = makeWorkerEnv();
  // The preflight a browser sends before a token-bearing request.
  const pre = await call(env, new Request("https://staging.test/v2/quota", {
    method: "OPTIONS",
    headers: {
      origin: PAGES_ORIGIN,
      "access-control-request-method": "GET",
      "access-control-request-headers": "x-opalreader-token, x-opalreader-scope, x-opalreader-instance",
    },
  }));
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get("access-control-allow-origin"), PAGES_ORIGIN);
  assert.ok(pre.headers.get("access-control-allow-headers").includes("x-opalreader-token"));
  // The actual request, denied at the gate: with ACAO present the
  // browser exposes status + body to the page — this is the exact
  // sequence that surfaced only "Load failed" on Julie's phone.
  const res = await call(env, req("/v2/quota", { token: "wrong-token-value", origin: PAGES_ORIGIN }));
  assert.equal(res.status, 401);
  assert.equal(res.headers.get("access-control-allow-origin"), PAGES_ORIGIN);
  assert.equal((await res.json()).error, "The personal access token is missing or incorrect.");
});

test("F-A: success and already-readable paths are unchanged (health, route 404, instance 403, DO 200)", async () => {
  const { env } = makeWorkerEnv();
  const health = await call(env, req("/health", { token: null, scope: null, instance: null, origin: PAGES_ORIGIN }));
  assert.equal(health.status, 200);
  assert.equal((await health.json()).app, "OpalReader API v2");
  assert.equal(health.headers.get("access-control-allow-origin"), PAGES_ORIGIN);

  const missing = await call(env, req("/nope", { token: null, scope: null, instance: null, origin: PAGES_ORIGIN }));
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).error, "route_not_found");
  assert.equal(missing.headers.get("access-control-allow-origin"), PAGES_ORIGIN);

  const inst = await call(env, req("/v2/sync/snapshot?family=settings", { instance: "account", origin: PAGES_ORIGIN }));
  assert.equal(inst.status, 403);
  assert.equal((await inst.json()).error, "staging_instance_required");
  assert.equal(inst.headers.get("access-control-allow-origin"), PAGES_ORIGIN);

  const okRes = await call(env, req("/v2/sync/snapshot?family=settings", { origin: PAGES_ORIGIN }));
  assert.equal(okRes.status, 200);
  assert.equal((await okRes.json()).family, "settings");
  assert.equal(okRes.headers.get("access-control-allow-origin"), PAGES_ORIGIN,
    "the DO-forwarded response keeps its merged CORS headers");
});
