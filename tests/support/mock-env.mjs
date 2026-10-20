// Shared mock environment for the KV write-coalescing tests and the
// write-count benchmark. Drives the REAL worker module (fetch + queue
// exports) against in-memory KV/R2/Queue mocks with a virtual clock,
// conditional-put semantics, fault injection, and async gates for
// ordering control.
import { createHash } from "node:crypto";

export function createClock(startMs) {
  let now = startMs;
  return {
    get now() {
      return now;
    },
    set(t) {
      now = t;
    },
    advance(ms) {
      now += ms;
    },
  };
}

// Patch Date.now to the virtual clock. `new Date(ts)` with an explicit
// timestamp is unaffected, which is all the worker's timezone helpers use.
export function installClock(clock) {
  const realNow = Date.now;
  Date.now = () => clock.now;
  return () => {
    Date.now = realNow;
  };
}

export function deferred() {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const byteSize = (raw) =>
  typeof raw === "string" ? raw.length : raw?.byteLength || 0;

export class MockKV {
  constructor(hooks = {}) {
    this.store = new Map(); // key -> string
    this.putCalls = []; // [{key, value}]
    this.hooks = hooks; // { onPut(key, value) } may throw or return a gate promise
  }
  async get(key, format) {
    const raw = this.store.get(key);
    if (raw === undefined) return null;
    return format === "json" ? JSON.parse(raw) : raw;
  }
  async put(key, value) {
    this.putCalls.push({ key, value: String(value) });
    if (this.hooks.onPut) await this.hooks.onPut(key, String(value));
    this.store.set(key, String(value));
  }
  async delete(key) {
    this.store.delete(key);
  }
  async list({ prefix = "", cursor, limit = 1000 } = {}) {
    const names = [...this.store.keys()]
      .filter((k) => k.startsWith(prefix))
      .sort();
    let from = 0;
    if (cursor) {
      const idx = names.findIndex((k) => k > cursor);
      from = idx < 0 ? names.length : idx;
    }
    const page = names.slice(from, from + limit);
    const complete = from + page.length >= names.length;
    return {
      keys: page.map((name) => ({ name })),
      list_complete: complete,
      cursor: complete ? undefined : page[page.length - 1],
    };
  }
  putCount(prefix) {
    return this.putCalls.filter((c) => c.key.startsWith(prefix)).length;
  }
}

function makeR2Object(key, entry) {
  const raw = entry.raw;
  const text =
    typeof raw === "string" ? raw : new TextDecoder().decode(raw);
  return {
    key,
    etag: entry.etag,
    uploaded: new Date(entry.uploadedMs),
    size: byteSize(raw),
    body: raw,
    text: async () => text,
    json: async () => JSON.parse(text),
    arrayBuffer: async () =>
      typeof raw === "string"
        ? new TextEncoder().encode(raw).buffer
        : raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength),
  };
}

export class MockR2 {
  constructor(nowFn, hooks = {}) {
    this.store = new Map(); // key -> {raw, etag, uploadedMs}
    this.etagSeq = 0;
    this.putCalls = []; // [{key}]
    this.getCounts = new Map();
    this.nowFn = nowFn;
    this.hooks = hooks; // { onPut(key, value, options), onGet(key, occurrence) }
  }
  async get(key) {
    const n = (this.getCounts.get(key) || 0) + 1;
    this.getCounts.set(key, n);
    if (this.hooks.onGet) await this.hooks.onGet(key, n);
    const entry = this.store.get(key);
    return entry ? makeR2Object(key, entry) : null;
  }
  async head(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    return {
      key,
      etag: entry.etag,
      uploaded: new Date(entry.uploadedMs),
      size: byteSize(entry.raw),
    };
  }
  async put(key, value, options = {}) {
    this.putCalls.push({ key });
    if (this.hooks.onPut) await this.hooks.onPut(key, value, options);
    const existing = this.store.get(key);
    const onlyIf = options?.onlyIf;
    if (onlyIf?.get?.("if-none-match") === "*" && existing) return null;
    const ifMatch = onlyIf?.get?.("if-match");
    if (ifMatch && (!existing || existing.etag !== ifMatch)) return null;
    const raw =
      typeof value === "string"
        ? value
        : value instanceof ArrayBuffer
          ? new Uint8Array(value)
          : value;
    const etag = `etag-${++this.etagSeq}`;
    this.store.set(key, { raw, etag, uploadedMs: this.nowFn() });
    return { key, etag, uploaded: new Date(this.nowFn()) };
  }
  async delete(key) {
    this.store.delete(key);
  }
  async list({ prefix = "", cursor, limit = 1000 } = {}) {
    const keys = [...this.store.keys()]
      .filter((k) => k.startsWith(prefix))
      .sort();
    let from = 0;
    if (cursor) {
      const idx = keys.findIndex((k) => k > cursor);
      from = idx < 0 ? keys.length : idx;
    }
    const pageKeys = keys.slice(from, from + limit);
    const truncated = from + pageKeys.length < keys.length;
    return {
      objects: pageKeys.map((k) => {
        const e = this.store.get(k);
        return {
          key: k,
          etag: e.etag,
          uploaded: new Date(e.uploadedMs),
          size: byteSize(e.raw),
        };
      }),
      truncated,
      cursor: truncated ? pageKeys[pageKeys.length - 1] : undefined,
    };
  }
  async readJson(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    return JSON.parse(
      typeof entry.raw === "string"
        ? entry.raw
        : new TextDecoder().decode(entry.raw),
    );
  }
  putCount(prefix) {
    return this.putCalls.filter((c) => c.key.startsWith(prefix)).length;
  }
}

export class MockQueue {
  constructor(clock) {
    this.clock = clock;
    this.pending = []; // [{body, due}]
    this.sentLog = [];
  }
  async send(body, options = {}) {
    const entry = {
      body,
      due: this.clock.now + (options.delaySeconds || 0) * 1000,
    };
    this.pending.push(entry);
    this.sentLog.push(entry);
  }
}

// Minimal valid RIFF/WAVE payload (header + a little silence).
export function wavBase64(seconds = 0.1) {
  const sampleRate = 24000;
  const samples = Math.floor(sampleRate * seconds);
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  const writeStr = (offset, s) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples * 2, true);
  writeStr(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, samples * 2, true);
  return Buffer.from(buffer).toString("base64");
}

export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Fetch stub for the Google APIs the worker calls. behavior hooks may
// return a Response to override a call (e.g. a 429 or a 400 block), or
// undefined to fall through to the default success behavior.
export function makeGoogleFetch(behavior = {}) {
  const audio = wavBase64();
  const calls = { batchSubmit: 0, batchPoll: 0, interactions: 0 };
  const pollCounts = new Map();
  const fetchImpl = async (url, init = {}) => {
    const u = String(url);
    if (u.includes(":batchGenerateContent")) {
      calls.batchSubmit++;
      if (behavior.onBatchSubmit) {
        const r = await behavior.onBatchSubmit(calls.batchSubmit, init);
        if (r) return r;
      }
      return jsonResponse({ name: `batches/op${calls.batchSubmit}` });
    }
    if (u.includes("/v1beta/batches/")) {
      calls.batchPoll++;
      const name = u.split("/v1beta/")[1];
      const n = (pollCounts.get(name) || 0) + 1;
      pollCounts.set(name, n);
      if (behavior.onBatchPoll) {
        const r = await behavior.onBatchPoll(name, n, init);
        if (r) return r;
      }
      if (n < 2)
        return jsonResponse({
          name,
          done: false,
          metadata: { state: "BATCH_STATE_RUNNING" },
        });
      return jsonResponse({
        name,
        done: true,
        metadata: { state: "BATCH_STATE_SUCCEEDED" },
        response: {
          inlinedResponses: {
            inlinedResponses: [
              {
                response: {
                  candidates: [
                    {
                      content: {
                        parts: [
                          { inlineData: { data: audio, mimeType: "audio/wav" } },
                        ],
                      },
                    },
                  ],
                  usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20 },
                },
              },
            ],
          },
        },
      });
    }
    if (u.includes("generativelanguage.googleapis.com")) {
      calls.interactions++;
      if (behavior.onInteractions) {
        const r = await behavior.onInteractions(calls.interactions, init);
        if (r) return r;
      }
      return jsonResponse({
        id: `req-${calls.interactions}`,
        usage: { promptTokenCount: 10, candidatesTokenCount: 20 },
        steps: [
          { type: "model_output", content: [{ type: "audio", data: audio }] },
        ],
      });
    }
    throw new Error(`Unexpected fetch in harness: ${u}`);
  };
  return { fetchImpl, calls };
}

export function sha256Hex(text) {
  return createHash("sha256").update(text).digest("hex");
}

export const RELEASE = "1.4.42/1.4.116";
export const CLIENT_VERSION = "1.4.116";

export function makeSegment(seed, overrides = {}) {
  return {
    cache_key: sha256Hex(`cache-${seed}`),
    text: `Narration text for segment ${seed}.`,
    voice_id: "Algieba",
    provider: "gemini",
    model_id: "gemini-3.8-flash-tts",
    usage_type: "book_generation",
    ...overrides,
  };
}

// Builds a complete test environment + request helpers bound to one
// imported worker module.
export function makeHarness(worker, { clockStart, kvHooks, r2Hooks, fetchBehavior } = {}) {
  const clock = createClock(clockStart);
  const kv = new MockKV(kvHooks);
  const r2 = new MockR2(() => clock.now, r2Hooks);
  const queue = new MockQueue(clock);
  const google = makeGoogleFetch(fetchBehavior);
  const env = {
    OPALREADER_KV: kv,
    OPALREADER_STORAGE: r2,
    OPALREADER_GENERATION: queue,
    OPALREADER_ACCESS_TOKEN: "test-token",
    GEMINI_API_KEY: "test-gemini-key",
    GEMINI_DAILY_REQUEST_LIMIT: "100",
  };
  const restoreClock = installClock(clock);
  const realFetch = globalThis.fetch;
  globalThis.fetch = google.fetchImpl;

  const request = (path, { method = "GET", body } = {}) =>
    worker.fetch(
      new Request(`https://reader.test${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-OpalReader-Token": "test-token",
        },
        body: body ? JSON.stringify(body) : undefined,
      }),
      env,
    );

  // Deliver queued messages in due order, advancing the virtual clock to
  // each message's due time. Stops when the queue is empty.
  async function drain(maxSteps = 20000) {
    let steps = 0;
    while (queue.pending.length) {
      if (++steps > maxSteps) throw new Error("drain step limit exceeded");
      queue.pending.sort((a, b) => a.due - b.due);
      const msg = queue.pending.shift();
      if (msg.due > clock.now) clock.set(msg.due);
      await worker.queue(
        {
          messages: [
            { body: msg.body, attempts: 1, ack() {}, retry() {} },
          ],
        },
        env,
      );
    }
    return steps;
  }

  // Deliver only the currently-due messages (no clock advance).
  async function deliverDue(limit = 1000) {
    let delivered = 0;
    for (;;) {
      const idx = queue.pending.findIndex((m) => m.due <= clock.now);
      if (idx < 0 || delivered >= limit) return delivered;
      const [msg] = queue.pending.splice(idx, 1);
      delivered++;
      await worker.queue(
        {
          messages: [
            { body: msg.body, attempts: 1, ack() {}, retry() {} },
          ],
        },
        env,
      );
    }
  }

  return {
    clock,
    kv,
    r2,
    queue,
    google,
    env,
    request,
    drain,
    deliverDue,
    restore() {
      restoreClock();
      globalThis.fetch = realFetch;
    },
  };
}
