// Opal Reader v2 — preview DOM behavior for source-review P1/P2.
//
// This file installs a deliberately small fake DOM/localStorage before
// importing preview-app.js, so the browser bootstrap path itself runs.
// It proves the visible device identity is populated from preview-local
// storage and that connect() clears the password input only after the
// exact staging health gate has opened.
import test from "node:test";
import assert from "node:assert/strict";
const STAGING_WORKER_ORIGIN = "https://opalreader-api-v2.4d8v7jw78c.workers.dev";
const EXPECTED_STAGING_HEALTH = {
  ok: true,
  app: "OpalReader API v2",
  version: "2.0.0",
  build: "a2b0031fcba6d3cdaadb949d900a4a642da05807",
  coordinator: "armed",
  scope: "staging-smoke",
  generation: "halted",
};

const FAKE_TOKEN = "fake-ui-token-for-tests-only";

class FakeElement {
  constructor(id) {
    this.id = id;
    this.value = "";
    this.textContent = "";
    this.className = "";
    this.children = [];
  }
  addEventListener() {}
  replaceChildren() { this.children = []; }
  append(...children) { this.children.push(...children); }
}

class FakeLocalStorage {
  constructor() { this.map = new Map(); }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
}

const elements = new Map();
const element = (id) => {
  if (!elements.has(id)) elements.set(id, new FakeElement(id));
  return elements.get(id);
};

globalThis.localStorage = new FakeLocalStorage();
globalThis.document = {
  getElementById: element,
  createElement: () => new FakeElement("created"),
};

const WRONG_UI_TOKEN = "wrong-ui-token";
const SLOW_GOOD_TOKEN = "slow-good-ui-token";
const SLOW_BAD_TOKEN = "slow-bad-ui-token";
const TOKEN_ERROR = "The personal access token is missing or incorrect.";

let healthMode = "bad";
// When armed, /v2/quota for a listed token parks on a promise the
// test resolves by hand (the F-B race tests' controllable clock).
let quotaDeferrals = null;
function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
function quotaResultFor(token) {
  if (token === WRONG_UI_TOKEN || token === SLOW_BAD_TOKEN)
    return Response.json({ error: TOKEN_ERROR }, { status: 401 });
  return Response.json({
    ledgerSeq: 1,
    settingsRevision: 1,
    spentMicroCents: 0,
    attemptsToday: 0,
    dailyLimit: 100,
    monthlyCap: 50,
  });
}

const fetchCalls = [];
globalThis.fetch = async (url, init = {}) => {
  const headers = new Headers(init.headers || {});
  const call = {
    url: String(url),
    token: headers.get("x-opalreader-token"),
  };
  fetchCalls.push(call);
  if (call.url === `${STAGING_WORKER_ORIGIN}/health`) {
    if (healthMode === "bad")
      return Response.json({ ...EXPECTED_STAGING_HEALTH, build: "wrong-build" });
    return Response.json(EXPECTED_STAGING_HEALTH);
  }
  if (call.url === `${STAGING_WORKER_ORIGIN}/v2/quota`) {
    if (quotaDeferrals?.has(call.token)) return quotaDeferrals.get(call.token).promise;
    return quotaResultFor(call.token);
  }
  throw new Error(`unexpected fetch ${call.url}`);
};

const app = await import("../v2-preview/preview-app.js");

test("preview UI: failed health does not clear the token; successful gated connect clears it and shows the device ID", async () => {
  element("accessToken").value = FAKE_TOKEN;

  const badStart = fetchCalls.length;
  assert.equal(await app.connect(), false);
  const badCalls = fetchCalls.slice(badStart);
  assert.equal(badCalls.length, 1);
  assert.equal(badCalls[0].url, `${STAGING_WORKER_ORIGIN}/health`);
  assert.equal(badCalls[0].token, null);
  assert.equal(element("accessToken").value, FAKE_TOKEN,
    "clearing is a successful-connection behavior, not a failure side effect");
  assert.match(element("health").textContent, /Connection refused: staging_health_mismatch: build/);

  healthMode = "good";
  const goodStart = fetchCalls.length;
  assert.equal(await app.connect(), true);
  const goodCalls = fetchCalls.slice(goodStart);
  assert.equal(goodCalls[0].url, `${STAGING_WORKER_ORIGIN}/health`);
  assert.equal(goodCalls[0].token, null);
  const authenticated = goodCalls.filter((c) => c.token !== null);
  // F-B: two authenticated calls — the connect proof (a direct
  // transport quotaView, required before install) and renderQuota's
  // quotaModel read after install. Both carry the entered token.
  assert.equal(authenticated.length, 2);
  assert.equal(authenticated[0].url, `${STAGING_WORKER_ORIGIN}/v2/quota`);
  assert.equal(authenticated[0].token, FAKE_TOKEN);
  assert.equal(authenticated[1].url, `${STAGING_WORKER_ORIGIN}/v2/quota`);
  assert.equal(authenticated[1].token, FAKE_TOKEN);
  assert.equal(element("accessToken").value, "",
    "the token is not left in the DOM after successful connection");
  assert.match(element("deviceId").textContent, /^preview-/,
    "the visible device ID is the generated preview-local identity");
  assert.equal(JSON.parse(globalThis.localStorage.getItem("opalreader-v2-preview:device-id")), element("deviceId").textContent);
});

// ------------------------------------------------------------ F-B
// Module-level connect() behavior (Rowan 6353186341). The module's
// installed client is private, so these tests observe what a user
// (and the page) can observe: connect()'s result, the health line,
// the token field, the fetch log, and the diagnostics log. The
// structural half of the guarantee — a candidate is composed only
// after its transport proof — is covered in p8-preview-p1-p2.
const connectedLines = () =>
  (element("diagLog").textContent.match(/connected to pinned staging worker/g) || []).length;

async function until(fn, tries = 500) {
  for (let i = 0; i < tries; i++) {
    if (fn()) return;
    await new Promise((r) => setTimeout(r, 1));
  }
  throw new Error("until: condition never met");
}

test("preview F-B UI: a second Connect tap on the cleared field is a visible no-op; the working connection survives", async () => {
  healthMode = "good";
  element("accessToken").value = FAKE_TOKEN;
  assert.equal(await app.connect(), true);
  assert.equal(element("accessToken").value, "", "the field was cleared by the successful connect");

  const callsBefore = fetchCalls.length;
  const connectedBefore = connectedLines();
  assert.equal(await app.connect(), false, "the repeat tap is refused — it does not report 'connected'");
  assert.equal(element("health").textContent, "Enter the staging token to connect.");
  assert.equal(fetchCalls.length, callsBefore, "no request of any kind was issued for the blank tap");
  assert.equal(connectedLines(), connectedBefore, "no replacement connection was installed or logged");

  element("accessToken").value = FAKE_TOKEN;
  assert.equal(await app.connect(), true, "the page still connects cleanly afterwards");
  assert.equal(connectedLines(), connectedBefore + 1);
});

test("preview F-B UI: a wrong token surfaces the server's refusal verbatim and keeps the prior connection's state", async () => {
  healthMode = "good";
  element("accessToken").value = FAKE_TOKEN;
  assert.equal(await app.connect(), true);
  const connectedBefore = connectedLines();

  element("accessToken").value = WRONG_UI_TOKEN;
  assert.equal(await app.connect(), false);
  assert.equal(element("health").textContent, `Connection refused: ${TOKEN_ERROR}`,
    "the refusal body is surfaced verbatim (readable since F-A), never a bare network error");
  assert.equal(element("accessToken").value, WRONG_UI_TOKEN,
    "clearing the field remains a successful-connection behavior only");
  assert.equal(connectedLines(), connectedBefore, "the failed candidate was never presented as connected");

  element("accessToken").value = FAKE_TOKEN;
  assert.equal(await app.connect(), true, "a following good connect still succeeds");
});

test("preview F-B UI: a slower successful attempt cannot overwrite a newer connection", async () => {
  healthMode = "good";
  quotaDeferrals = new Map([[SLOW_GOOD_TOKEN, deferred()]]);
  try {
    element("accessToken").value = SLOW_GOOD_TOKEN;
    const slow = app.connect();
    await until(() => fetchCalls.some((c) => c.url.endsWith("/v2/quota") && c.token === SLOW_GOOD_TOKEN));

    element("accessToken").value = FAKE_TOKEN;
    const connectedBefore = connectedLines();
    assert.equal(await app.connect(), true, "the newer attempt installs");
    assert.equal(connectedLines(), connectedBefore + 1);

    quotaDeferrals.get(SLOW_GOOD_TOKEN).resolve(quotaResultFor(SLOW_GOOD_TOKEN));
    assert.equal(await slow, false, "the superseded attempt does not install its candidate");
    assert.equal(connectedLines(), connectedBefore + 1, "exactly one connection was installed across both attempts");
    assert.match(element("health").textContent, /^Worker: OpalReader API v2/,
      "the health line still describes the newer connection");
    assert.match(element("diagLog").textContent, /superseded attempt was discarded/);
  } finally {
    quotaDeferrals = null;
  }
});

test("preview F-B UI: a slower failing attempt cannot relabel or replace a newer connection", async () => {
  healthMode = "good";
  quotaDeferrals = new Map([[SLOW_BAD_TOKEN, deferred()]]);
  try {
    element("accessToken").value = SLOW_BAD_TOKEN;
    const slow = app.connect();
    await until(() => fetchCalls.some((c) => c.url.endsWith("/v2/quota") && c.token === SLOW_BAD_TOKEN));

    element("accessToken").value = FAKE_TOKEN;
    assert.equal(await app.connect(), true, "the newer attempt installs");

    quotaDeferrals.get(SLOW_BAD_TOKEN).resolve(quotaResultFor(SLOW_BAD_TOKEN));
    assert.equal(await slow, false);
    assert.match(element("health").textContent, /^Worker: OpalReader API v2/,
      "the stale failure did not overwrite the newer connection's health line");
    assert.match(element("diagLog").textContent, /superseded attempt failed/);
  } finally {
    quotaDeferrals = null;
  }
});
