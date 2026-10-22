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

let healthMode = "bad";
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
    return Response.json({
      ledgerSeq: 1,
      settingsRevision: 1,
      spentMicroCents: 0,
      attemptsToday: 0,
      dailyLimit: 100,
      monthlyCap: 50,
    });
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
  assert.equal(authenticated.length, 1);
  assert.equal(authenticated[0].url, `${STAGING_WORKER_ORIGIN}/v2/quota`);
  assert.equal(authenticated[0].token, FAKE_TOKEN);
  assert.equal(element("accessToken").value, "",
    "the token is not left in the DOM after successful connection");
  assert.match(element("deviceId").textContent, /^preview-/,
    "the visible device ID is the generated preview-local identity");
  assert.equal(JSON.parse(globalThis.localStorage.getItem("opalreader-v2-preview:device-id")), element("deviceId").textContent);
});
