// Opal Reader v2 — preview source-review corrections P1 + P2
// (Rowan 6351482794).
//
// P1 is proven with an instrumented fetch: every request is recorded,
// and any request carrying x-opalreader-token is counted as an
// authenticated request. Bad staging health must produce exactly one
// unauthenticated /health probe, no transport construction, and zero
// authenticated requests. P2 uses two independent preview-local
// storage instances and one shared recording transport to prove that
// independently generated device identities allocate disjoint command
// and position-event IDs, with no ID presented to the server twice.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHttpTransport } from "../v2/client/http-transport.mjs";
import { createAssembledClient } from "../v2/client/assembled-client.mjs";
import {
  EXPECTED_STAGING_BUILD,
  EXPECTED_STAGING_HEALTH,
  STAGING_WORKER_ORIGIN,
  assertPreviewDeviceIdentity,
  bookNotFoundLines,
  connectPreviewClient,
  createPreviewStorage,
  ensurePreviewDeviceId,
} from "../v2-preview/preview-app.js";

const FAKE_TOKEN = "fake-staging-token-for-tests-only";

function instrumentedFetch(handler) {
  const calls = [];
  const fetchFn = async (url, init = {}) => {
    const headers = new Headers(init.headers || {});
    calls.push({
      url: String(url),
      method: init.method || "GET",
      token: headers.get("x-opalreader-token"),
      scope: headers.get("x-opalreader-scope"),
      instance: headers.get("x-opalreader-instance"),
    });
    return handler(String(url), init, calls);
  };
  return {
    calls,
    fetchFn,
    authenticatedCalls: () => calls.filter((c) => c.token !== null),
  };
}

function healthResponse(overrides = {}) {
  return Response.json({ ...EXPECTED_STAGING_HEALTH, ...overrides });
}

function quotaResponse() {
  return Response.json({
    ledgerSeq: 1,
    settingsRevision: 1,
    spentMicroCents: 0,
    attemptsToday: 0,
    dailyLimit: 100,
    monthlyCap: 50,
  });
}

function memAsyncStorage() {
  const map = new Map();
  return {
    get: async (key) => (map.has(key) ? structuredClone(map.get(key)) : undefined),
    set: async (key, value) => { map.set(key, structuredClone(value)); },
    del: async (key) => { map.delete(key); },
    _map: map,
  };
}

function transportSpy() {
  let constructions = 0;
  return {
    create(opts) {
      constructions += 1;
      return createHttpTransport(opts);
    },
    constructions: () => constructions,
  };
}

function clientSpy() {
  let constructions = 0;
  return {
    create(opts) {
      constructions += 1;
      return createAssembledClient(opts);
    },
    constructions: () => constructions,
  };
}

test("preview P1/P2 source: no editable worker origin and no shared default device ID", () => {
  const html = readFileSync(new URL("../v2-preview/index.html", import.meta.url), "utf8");
  const app = readFileSync(new URL("../v2-preview/preview-app.js", import.meta.url), "utf8");
  assert.ok(!html.includes('id="workerBase"'));
  assert.ok(!app.includes("workerBase"));
  assert.ok(html.includes(STAGING_WORKER_ORIGIN));
  assert.ok(app.includes(`"${STAGING_WORKER_ORIGIN}"`));
  assert.ok(app.includes(`"${EXPECTED_STAGING_BUILD}"`),
    "the health gate is bound to the deployed staging build");
  assert.ok(!html.includes('value="preview-device"'));
  assert.ok(!html.includes('<input id="deviceId"'));
  assert.ok(html.includes('<strong id="deviceId"'));
});

test("preview P1: correct health identity opens the gate before authenticated quota traffic", async () => {
  const instrumented = instrumentedFetch(async (url) => {
    if (url === `${STAGING_WORKER_ORIGIN}/health`) return healthResponse();
    if (url === `${STAGING_WORKER_ORIGIN}/v2/quota`) return quotaResponse();
    throw new Error(`unexpected URL ${url}`);
  });
  const transports = transportSpy();
  const clients = clientSpy();
  const connected = await connectPreviewClient({
    token: FAKE_TOKEN,
    deviceId: "preview-p1-success",
    fetchFn: instrumented.fetchFn,
    createTransportFn: transports.create,
    createClientFn: clients.create,
    clientStorage: memAsyncStorage(),
  });

  assert.equal(connected.health.build, EXPECTED_STAGING_BUILD);
  assert.equal(transports.constructions(), 1);
  assert.equal(clients.constructions(), 1);
  // The health probe is still first and unauthenticated. F-B (Rowan
  // 6353186341) then makes exactly ONE authenticated call during
  // connect: the candidate transport's direct quotaView() proof,
  // which must succeed before the assembled client is composed.
  assert.equal(instrumented.calls.length, 2);
  assert.equal(instrumented.calls[0].url, `${STAGING_WORKER_ORIGIN}/health`);
  assert.equal(instrumented.calls[0].token, null);
  assert.equal(instrumented.authenticatedCalls().length, 1,
    "the only authenticated call during connect is the transport-level proof");
  assert.equal(instrumented.authenticatedCalls()[0].url, `${STAGING_WORKER_ORIGIN}/v2/quota`);
  assert.equal(instrumented.authenticatedCalls()[0].token, FAKE_TOKEN);
  assert.equal(instrumented.authenticatedCalls()[0].scope, "staging-smoke");
  assert.equal(instrumented.authenticatedCalls()[0].instance, "smoke-p8");

  const quota = await connected.client.surfaces.quotaModel();
  assert.equal(quota.view.dailyLimit, 100);
  assert.equal(instrumented.authenticatedCalls().length, 2);
  assert.equal(instrumented.authenticatedCalls()[1].url, `${STAGING_WORKER_ORIGIN}/v2/quota`);
  assert.equal(instrumented.authenticatedCalls()[1].token, FAKE_TOKEN);
});

test("preview P1: a poisoned arbitrary origin is ignored; requests stay on the pinned staging origin", async () => {
  const instrumented = instrumentedFetch(async (url) => {
    assert.ok(url.startsWith(STAGING_WORKER_ORIGIN), `request escaped the pin: ${url}`);
    if (url.endsWith("/health")) return healthResponse();
    if (url.endsWith("/v2/quota")) return quotaResponse();
    throw new Error(`unexpected URL ${url}`);
  });
  const transports = transportSpy();
  const connected = await connectPreviewClient({
    // Extra caller input must have no effect: connectPreviewClient has
    // no caller-selected origin in its connection contract.
    baseUrl: "https://evil.example",
    token: FAKE_TOKEN,
    deviceId: "preview-p1-poisoned-origin",
    fetchFn: instrumented.fetchFn,
    createTransportFn: transports.create,
    createClientFn: clientSpy().create,
    clientStorage: memAsyncStorage(),
  });
  await connected.client.surfaces.quotaModel();
  assert.equal(transports.constructions(), 1);
  assert.ok(instrumented.calls.every((c) => c.url.startsWith(STAGING_WORKER_ORIGIN)));
  // Two authenticated calls, both pinned: the F-B connect proof and
  // the quotaModel read.
  assert.equal(instrumented.authenticatedCalls().length, 2);
  assert.ok(instrumented.authenticatedCalls().every((c) => c.url.startsWith(STAGING_WORKER_ORIGIN)));
});

const badHealthCases = [
  ["wrong build", async () => healthResponse({ build: "0000000000000000000000000000000000000000" })],
  ["wrong scope", async () => healthResponse({ scope: "production" })],
  ["generation active", async () => healthResponse({ generation: "enabled" })],
  ["coordinator unbound", async () => healthResponse({ coordinator: "unbound" })],
  ["wrong app", async () => healthResponse({ app: "OpalReader API" })],
  ["malformed JSON", async () => new Response("{not-json", { status: 200, headers: { "content-type": "application/json" } })],
  ["HTTP failure", async () => Response.json({ error: "nope" }, { status: 500 })],
  ["fetch failure", async () => { throw new Error("network down"); }],
];

for (const [name, handler] of badHealthCases) {
  test(`preview P1: bad health identity (${name}) stops with zero authenticated requests`, async () => {
    const instrumented = instrumentedFetch(handler);
    const transports = transportSpy();
    const clients = clientSpy();
    await assert.rejects(
      () => connectPreviewClient({
        token: FAKE_TOKEN,
        deviceId: `preview-p1-${name.replaceAll(" ", "-")}`,
        fetchFn: instrumented.fetchFn,
        createTransportFn: transports.create,
        createClientFn: clients.create,
        clientStorage: memAsyncStorage(),
      }),
      /staging_health_/,
    );
    assert.equal(instrumented.calls.length, 1);
    assert.equal(instrumented.calls[0].url, `${STAGING_WORKER_ORIGIN}/health`);
    assert.equal(instrumented.calls[0].token, null);
    assert.equal(instrumented.authenticatedCalls().length, 0);
    assert.equal(transports.constructions(), 0);
    assert.equal(clients.constructions(), 0);
  });
}

class FakeLocalStorage {
  constructor() { this.map = new Map(); }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
}

test("preview P2: device identity is generated once per fresh storage and then reused", async () => {
  const storageA = createPreviewStorage(new FakeLocalStorage());
  const storageB = createPreviewStorage(new FakeLocalStorage());
  let generated = 0;
  const randomId = () => `preview-test-${++generated}`;

  const a1 = await ensurePreviewDeviceId(storageA, randomId);
  const a2 = await ensurePreviewDeviceId(storageA, randomId);
  const b1 = await ensurePreviewDeviceId(storageB, randomId);

  assert.equal(a1, "preview-test-1");
  assert.equal(a2, a1, "the same device reuses its stored identity");
  assert.equal(b1, "preview-test-2");
  assert.notEqual(a1, b1);
  assert.equal(generated, 2, "reuse must not mint a replacement identity");
  assert.equal(await storageA.get("device-id"), a1);
  assert.equal(await storageB.get("device-id"), b1);
});

test("preview P2: identity mismatch is surfaced before any network or transport creation", async () => {
  const previewStorage = createPreviewStorage(new FakeLocalStorage());
  const deviceId = await ensurePreviewDeviceId(previewStorage, () => "preview-mismatch-device");
  await previewStorage.set("cs:state:v1", { deviceId: "preview-belonging-to-another-device" });
  const instrumented = instrumentedFetch(async () => healthResponse());
  const transports = transportSpy();

  await assert.rejects(
    () => connectPreviewClient({
      token: FAKE_TOKEN,
      deviceId,
      fetchFn: instrumented.fetchFn,
      createTransportFn: transports.create,
      createClientFn: clientSpy().create,
      clientStorage: previewStorage,
    }),
    (e) => e.code === "device_id_mismatch",
  );
  assert.equal(instrumented.calls.length, 0);
  assert.equal(instrumented.authenticatedCalls().length, 0);
  assert.equal(transports.constructions(), 0);
  assert.equal(await previewStorage.get("device-id"), deviceId,
    "the stored identity was not silently mutated");
  await assert.rejects(
    () => assertPreviewDeviceIdentity(previewStorage, "preview-someone-else"),
    (e) => e.code === "device_id_mismatch",
  );
});

class RecordingTransport {
  constructor() {
    this.commandReceipts = new Map();
    this.eventReceipts = new Map();
    this.duplicateCommandIds = [];
    this.duplicateEventIds = [];
    this.nextReceiptSeq = 1;
  }
  async sendCommand(cmd) {
    if (this.commandReceipts.has(cmd.command_id)) {
      this.duplicateCommandIds.push(cmd.command_id);
      return { ...this.commandReceipts.get(cmd.command_id), replayed: true };
    }
    const receipt = { outcome: "applied", replayed: false };
    this.commandReceipts.set(cmd.command_id, receipt);
    return receipt;
  }
  async snapshot() { throw new Error("not used by this regression"); }
  async pullChanges() { throw new Error("not used by this regression"); }
  async positionView() {
    return {
      canonical: null,
      asOfReceiptSeq: this.eventReceipts.size,
      supersededCount: 0,
      journalGaps: [],
    };
  }
  async pushPosition(_bookId, events) {
    const receipts = [];
    for (const event of events) {
      if (this.eventReceipts.has(event.eventId)) {
        this.duplicateEventIds.push(event.eventId);
        receipts.push({ eventId: event.eventId, receiptSeq: this.eventReceipts.get(event.eventId), superseded: false, replayed: true });
      } else {
        const receiptSeq = this.nextReceiptSeq++;
        this.eventReceipts.set(event.eventId, receiptSeq);
        receipts.push({ eventId: event.eventId, receiptSeq, superseded: false, replayed: false });
      }
    }
    return { receipts, rejected: [], tip: this.eventReceipts.size, journalGaps: [] };
  }
  async byteCheck() { return false; }
  async quotaView() { throw new Error("not used by this regression"); }
}

test("preview P2: two fresh-storage clients allocate disjoint command and position IDs with no replay", async () => {
  const localA = new FakeLocalStorage();
  const localB = new FakeLocalStorage();
  const storageA = createPreviewStorage(localA);
  const storageB = createPreviewStorage(localB);
  const deviceA = await ensurePreviewDeviceId(storageA, () => "preview-client-a");
  const deviceB = await ensurePreviewDeviceId(storageB, () => "preview-client-b");
  assert.notEqual(deviceA, deviceB);

  const sharedTransport = new RecordingTransport();
  const clientA = createAssembledClient({ deviceId: deviceA, storage: storageA, transport: sharedTransport });
  const clientB = createAssembledClient({ deviceId: deviceB, storage: storageB, transport: sharedTransport });

  const commandA = await clientA.store.intent("SetSettings", { baseRevision: 0, data: { monthlyCap: 50 } });
  const commandB = await clientB.store.intent("SetSettings", { baseRevision: 0, data: { monthlyCap: 51 } });
  assert.equal(commandA, `${deviceA}-cmd-1`);
  assert.equal(commandB, `${deviceB}-cmd-1`);
  assert.notEqual(commandA, commandB);
  await clientA.store.flushOutbox();
  await clientB.store.flushOutbox();

  const positionA = await clientA.surfaces.reportPosition("smoke-p8-book",
    { kind: "play", occurrenceId: "o1", offsetSec: 1 });
  const positionB = await clientB.surfaces.reportPosition("smoke-p8-book",
    { kind: "pause", occurrenceId: "o1", offsetSec: 2 });
  assert.equal(positionA.event.eventId, `${deviceA}:1`);
  assert.equal(positionB.event.eventId, `${deviceB}:1`);
  assert.notEqual(positionA.event.eventId, positionB.event.eventId);

  assert.deepEqual([...sharedTransport.commandReceipts.keys()].sort(), [commandA, commandB].sort());
  assert.deepEqual([...sharedTransport.eventReceipts.keys()].sort(), [positionA.event.eventId, positionB.event.eventId].sort());
  assert.ok([...sharedTransport.commandReceipts.values()].every((r) => r.replayed === false));
  assert.deepEqual(sharedTransport.duplicateCommandIds, []);
  assert.deepEqual(sharedTransport.duplicateEventIds, []);
});

// ------------------------------------------------------------ F-B
// Rowan 6353186341 (mandatory correction): the candidate proof is a
// DIRECT transport quotaView() that throws on non-2xx and requires a
// well-formed payload — never surfaces.quotaModel(), whose store
// path (client-store refreshMoney) catches every quotaView()
// rejection and returns cached money (stale: true / view: null), so
// a refused token could appear to pass. Below, no rejected candidate
// ever reaches client composition.
const TOKEN_ERROR = "The personal access token is missing or incorrect.";
const GOOD_QUOTA = {
  dayKey: "2026-10-22", monthKey: "2026-10", basis: "Reader estimate (server attempt ledger)",
  attemptsToday: 0, dailyLimit: 100, spentMicroCents: 0,
  monthlyCap: 50, ledgerSeq: 1, settingsRevision: 1, parked: null,
};

function quotaGateFetch(behavior) {
  // behavior(token) -> Response (or throws) for /v2/quota.
  return instrumentedFetch(async (url, init) => {
    if (url === `${STAGING_WORKER_ORIGIN}/health`) return healthResponse();
    if (url === `${STAGING_WORKER_ORIGIN}/v2/quota`) {
      const token = new Headers(init.headers || {}).get("x-opalreader-token");
      return behavior(token);
    }
    throw new Error(`unexpected URL ${url}`);
  });
}

test("preview F-B: a blank token is refused before identity, health, transport, or client", async () => {
  for (const blank of ["", "   ", undefined, null]) {
    const instrumented = quotaGateFetch(() => quotaResponse());
    const transports = transportSpy();
    const clients = clientSpy();
    await assert.rejects(
      () => connectPreviewClient({
        token: blank,
        deviceId: "preview-fb-blank",
        fetchFn: instrumented.fetchFn,
        createTransportFn: transports.create,
        createClientFn: clients.create,
        clientStorage: memAsyncStorage(),
      }),
      /Enter the staging token to connect/,
    );
    assert.equal(instrumented.calls.length, 0, "not even the health probe is sent");
    assert.equal(transports.constructions(), 0);
    assert.equal(clients.constructions(), 0);
  }
});

test("preview F-B: a wrong token fails the transport proof with the server's verbatim refusal; no client is composed", async () => {
  const instrumented = quotaGateFetch(() =>
    Response.json({ error: TOKEN_ERROR }, { status: 401 }));
  const transports = transportSpy();
  const clients = clientSpy();
  await assert.rejects(
    () => connectPreviewClient({
      token: "wrong-token",
      deviceId: "preview-fb-wrong",
      fetchFn: instrumented.fetchFn,
      createTransportFn: transports.create,
      createClientFn: clients.create,
      clientStorage: memAsyncStorage(),
    }),
    (e) => e.message === TOKEN_ERROR && e.status === 401,
  );
  assert.equal(transports.constructions(), 1, "the candidate existed as a transport only");
  assert.equal(clients.constructions(), 0, "no assembled client was composed around a refused token");
  assert.equal(instrumented.authenticatedCalls().length, 1, "exactly one authenticated call: the proof");
  assert.equal(instrumented.authenticatedCalls()[0].token, "wrong-token");
});

test("preview F-B: an expired token is refused identically — every non-2xx proof fails the same way", async () => {
  const instrumented = quotaGateFetch(() =>
    Response.json({ error: TOKEN_ERROR }, { status: 401 }));
  const clients = clientSpy();
  await assert.rejects(
    () => connectPreviewClient({
      token: "expired-token",
      deviceId: "preview-fb-expired",
      fetchFn: instrumented.fetchFn,
      createTransportFn: transportSpy().create,
      createClientFn: clients.create,
      clientStorage: memAsyncStorage(),
    }),
    (e) => e.message === TOKEN_ERROR && e.status === 401,
  );
  assert.equal(clients.constructions(), 0);
});

test("preview F-B: a transport/network failure during the proof composes no client", async () => {
  const instrumented = quotaGateFetch(() => { throw new Error("network down"); });
  const clients = clientSpy();
  await assert.rejects(
    () => connectPreviewClient({
      token: FAKE_TOKEN,
      deviceId: "preview-fb-network",
      fetchFn: instrumented.fetchFn,
      createTransportFn: transportSpy().create,
      createClientFn: clients.create,
      clientStorage: memAsyncStorage(),
    }),
    /network down/,
  );
  assert.equal(clients.constructions(), 0);
});

test("preview F-B: a malformed 200 from quotaView is not proof", async () => {
  for (const junk of [{ ok: true }, [], { ...GOOD_QUOTA, ledgerSeq: "1" }, { ...GOOD_QUOTA, settingsRevision: undefined }]) {
    const instrumented = quotaGateFetch(() => Response.json(junk));
    const clients = clientSpy();
    await assert.rejects(
      () => connectPreviewClient({
        token: FAKE_TOKEN,
        deviceId: "preview-fb-malformed",
        fetchFn: instrumented.fetchFn,
        createTransportFn: transportSpy().create,
        createClientFn: clients.create,
        clientStorage: memAsyncStorage(),
      }),
      /preview_quota_proof_malformed/,
    );
    assert.equal(clients.constructions(), 0, `payload ${JSON.stringify(junk)} must not install a client`);
  }
});

test("preview F-B: a cached quota view in local storage cannot rescue a refused candidate (the stale-cache trap)", async () => {
  // Seed the client-store state with a healthy cached money view —
  // exactly the state in which the rejected quotaModel() proof would
  // have resolved (stale data) and let a 401 candidate "pass". The
  // transport-level proof never consults the cache.
  const storage = memAsyncStorage();
  await storage.set("cs:state:v1", {
    deviceId: "preview-fb-stale",
    money: {
      view: { ...GOOD_QUOTA, attemptsToday: 3, ledgerSeq: 9, settingsRevision: 2 },
      asOfLedgerSeq: 9, asOfSettingsRevision: 2, stale: false,
    },
  });
  const instrumented = quotaGateFetch(() =>
    Response.json({ error: TOKEN_ERROR }, { status: 401 }));
  const clients = clientSpy();
  await assert.rejects(
    () => connectPreviewClient({
      token: "wrong-token",
      deviceId: "preview-fb-stale",
      fetchFn: instrumented.fetchFn,
      createTransportFn: transportSpy().create,
      createClientFn: clients.create,
      clientStorage: storage,
    }),
    (e) => e.message === TOKEN_ERROR,
  );
  assert.equal(clients.constructions(), 0);
});

test("preview F-B: a successful re-auth composes the replacement only after its own proof passes", async () => {
  const instrumented = quotaGateFetch((token) =>
    token === "first-good-token" || token === "second-good-token"
      ? Response.json(GOOD_QUOTA)
      : Response.json({ error: TOKEN_ERROR }, { status: 401 }));
  const clients = clientSpy();
  const storage = memAsyncStorage();
  const first = await connectPreviewClient({
    token: "first-good-token", deviceId: "preview-fb-reauth",
    fetchFn: instrumented.fetchFn, createTransportFn: transportSpy().create,
    createClientFn: clients.create, clientStorage: storage,
  });
  const second = await connectPreviewClient({
    token: "second-good-token", deviceId: "preview-fb-reauth",
    fetchFn: instrumented.fetchFn, createTransportFn: transportSpy().create,
    createClientFn: clients.create, clientStorage: storage,
  });
  assert.equal(clients.constructions(), 2);
  assert.notEqual(second.client, first.client);
  const proofs = instrumented.authenticatedCalls();
  assert.deepEqual(proofs.map((c) => c.token), ["first-good-token", "second-good-token"],
    "each composition was preceded by a proof carrying that attempt's token");
});

// ------------------------------------------------------------ F-C
test("preview F-C: identifier inputs opt out of keyboard correction; all other inputs unchanged", () => {
  const html = readFileSync(new URL("../v2-preview/index.html", import.meta.url), "utf8");
  const tag = (id) => {
    const m = html.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`));
    assert.ok(m, `#${id} input present`);
    return m[0];
  };
  for (const id of ["bookId", "readId"]) {
    const t = tag(id);
    assert.ok(t.includes('autocapitalize="none"'), `#${id} autocapitalize`);
    assert.ok(t.includes('autocorrect="off"'), `#${id} autocorrect`);
    assert.ok(t.includes('spellcheck="false"'), `#${id} spellcheck`);
  }
  // A credential and a free-text search are NOT exact-match
  // identifier entries; Rowan's fix leaves them untouched.
  for (const id of ["accessToken", "findQuery"]) {
    assert.ok(!tag(id).includes("autocapitalize"), `#${id} unchanged`);
  }
});

test("preview F-C: not-found lines name the submitted ID verbatim; the exact-case hint appears only for uppercase", () => {
  assert.deepEqual(bookNotFoundLines("Smoke-p8-book"), [
    "loadBook: Smoke-p8-book not in the smoke instance",
    "loadBook: IDs are case-sensitive; check the exact case",
  ]);
  assert.deepEqual(bookNotFoundLines("smoke-p8-book"), [
    "loadBook: smoke-p8-book not in the smoke instance",
  ]);
  assert.equal(bookNotFoundLines("smoke-P8-book")[0],
    "loadBook: smoke-P8-book not in the smoke instance",
    "a mixed-case ID is reported byte-for-byte, never normalized");
  assert.equal(bookNotFoundLines("smoke-P8-book").length, 2);
  const app = readFileSync(new URL("../v2-preview/preview-app.js", import.meta.url), "utf8");
  assert.ok(app.includes("bookNotFoundLines(bookId)"), "loadBook reports through the helper");
  assert.ok(!app.includes("bookId.toLowerCase"), "the submitted ID is never rewritten");
});
