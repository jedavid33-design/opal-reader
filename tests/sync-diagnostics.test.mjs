// Run: node --test tests/sync-diagnostics.test.mjs
//
// Diagnostic-only patch coverage:
// - Worker: a failing sync request logs the endpoint, book id, and the
//   error's type/message/stack to Workers Logs, without logging book
//   contents or credentials, and the error response itself is unchanged.
// - Worker: successful sync operations log nothing and store records
//   exactly as before.
// - Reader: the sync error display preserves the server's own error
//   message (sanitized) instead of always substituting the generic gloss.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import worker from "../cloudflare-worker.js";

const url = "https://reader.test";
const BOOK_ID = "reader-book-diagnostics";
const book = {
  id: BOOK_ID,
  title: "Diagnostics Sample",
  author: "Sample Author",
  updatedAt: 200,
  chapters: [
    {
      title: "Chapter 1",
      segments: [{ text: "Confidential narration text", audioKey: "audio-key-1" }],
      generation: { state: "ready", completed: 1, total: 1 },
    },
  ],
  continueSession: { id: "session-1", state: "complete", jobs: [] },
};

function mockEnvironment({ failPut = false, failGet = false } = {}) {
  const data = new Map();
  const kv = {
    async get(key, format) {
      if (failGet && key === "book:" + BOOK_ID) throw new Error("KV get failed: simulated read error");
      const value = data.get(key);
      return value == null ? null : format === "json" ? JSON.parse(value) : value;
    },
    async put(key, value) {
      if (failPut && key.startsWith("book:")) throw new Error("KV put failed: simulated storage error");
      data.set(key, value);
    },
    async list({ prefix }) {
      return {
        keys: [...data.keys()].filter((key) => key.startsWith(prefix)).map((name) => ({ name })),
        list_complete: true,
      };
    },
    async delete(key) { data.delete(key); },
  };
  const env = { OPALREADER_KV: kv, OPALREADER_STORAGE: {}, OPALREADER_ACCESS_TOKEN: "test-token" };
  const request = (path, options = {}) => new Request(url + path, {
    ...options,
    headers: { "X-OpalReader-Token": "test-token", ...(options.headers || {}) },
  });
  return { env, request, data };
}

function captureConsoleError() {
  const calls = [];
  const original = console.error;
  console.error = (...args) => { calls.push(args.map(String).join(" ")); };
  return { calls, restore() { console.error = original; } };
}

test("worker logs a failed book upload with endpoint, book id and error detail — and nothing sensitive", async () => {
  const t = mockEnvironment({ failPut: true });
  const cap = captureConsoleError();
  let response;
  try {
    response = await worker.fetch(
      t.request("/api/sync/book/" + BOOK_ID, { method: "PUT", body: JSON.stringify(book) }),
      t.env,
    );
  } finally { cap.restore(); }
  // The error response is exactly what the unpatched worker returns.
  assert.equal(response.status, 502);
  const body = JSON.parse(await response.text());
  assert.equal(body.error, "KV put failed: simulated storage error");
  // Exactly one diagnostic log line, carrying the operation and the error.
  assert.equal(cap.calls.length, 1);
  const entry = JSON.parse(cap.calls[0]);
  assert.equal(entry.event, "opalreader_sync_failure");
  assert.equal(entry.method, "PUT");
  assert.equal(entry.path, "/api/sync/book/" + BOOK_ID);
  assert.equal(entry.bookId, BOOK_ID);
  assert.equal(entry.errorName, "Error");
  assert.match(entry.errorMessage, /simulated storage error/);
  assert.ok(typeof entry.errorStack === "string" && entry.errorStack.length > 0);
  // No book contents, no credentials in the log line.
  assert.ok(!cap.calls[0].includes("Confidential narration text"));
  assert.ok(!cap.calls[0].includes("Diagnostics Sample"));
  assert.ok(!cap.calls[0].includes("test-token"));
});

test("worker logs a failed book download the same way", async () => {
  const t = mockEnvironment({ failGet: true });
  const cap = captureConsoleError();
  let response;
  try {
    response = await worker.fetch(t.request("/api/sync/book/" + BOOK_ID), t.env);
  } finally { cap.restore(); }
  assert.equal(response.status, 502);
  assert.equal(cap.calls.length, 1);
  const entry = JSON.parse(cap.calls[0]);
  assert.equal(entry.method, "GET");
  assert.equal(entry.bookId, BOOK_ID);
  assert.match(entry.errorMessage, /simulated read error/);
});

test("successful book upload logs nothing and stores the record unchanged", async () => {
  const t = mockEnvironment();
  const cap = captureConsoleError();
  let response;
  try {
    response = await worker.fetch(
      t.request("/api/sync/book/" + BOOK_ID, { method: "PUT", body: JSON.stringify(book) }),
      t.env,
    );
  } finally { cap.restore(); }
  assert.equal(response.status, 200);
  const body = JSON.parse(await response.text());
  assert.equal(body.accepted, true);
  assert.equal(cap.calls.length, 0);
  // The stored record round-trips byte-for-byte semantically: generation
  // state, session, chapters and audio keys are all preserved as sent.
  const stored = JSON.parse(t.data.get("book:" + BOOK_ID));
  assert.deepEqual(stored, book);
  const index = JSON.parse(t.data.get("library:index"));
  assert.deepEqual(index, [{ id: BOOK_ID, title: book.title, author: book.author, updatedAt: 200 }]);
  const got = await worker.fetch(t.request("/api/sync/book/" + BOOK_ID), t.env);
  assert.equal(got.status, 200);
  assert.deepEqual(JSON.parse(await got.text()).book, book);
});

test("non-sync failures and auth rejections produce no sync diagnostic logs", async () => {
  const t = mockEnvironment();
  const cap = captureConsoleError();
  try {
    // Auth rejection happens before any sync handling.
    const unauth = await worker.fetch(
      new Request(url + "/api/sync/book/" + BOOK_ID, { method: "PUT", body: JSON.stringify(book) }),
      t.env,
    );
    assert.equal(unauth.status, 401);
    // A failing non-sync route (no Gemini key configured) still errors,
    // but it is outside the sync diagnostics scope.
    const provider = await worker.fetch(
      t.request("/api/providers/gemini/speech", { method: "POST", body: JSON.stringify({ text: "hi" }) }),
      t.env,
    );
    assert.ok(provider.status >= 400);
  } finally { cap.restore(); }
  assert.equal(cap.calls.length, 0);
});

const app = readFileSync(new URL("../app-255.js", import.meta.url), "utf8");
const page = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const span = (s, start, end) => {
  const a = s.indexOf(start), b = s.indexOf(end, a);
  assert.ok(a >= 0 && b > a);
  return s.slice(a, b);
};

test("reader sync errors preserve the server's message instead of the generic gloss", () => {
  assert.ok(app.includes('status>=500?`HTTP ${status}: ${syncServerMessage(err)||"server or storage request failed."}`'));
  assert.ok(!app.includes("status>=500?`HTTP ${status}: server or storage request failed.`"));
  const helper = span(app, "function syncServerMessage(", "async function syncReadWithRetry(");
  const syncServerMessage = new Function(helper + "return syncServerMessage;")();
  // A real server message is preserved.
  assert.equal(syncServerMessage({ message: "KV put failed: too many writes" }), "KV put failed: too many writes");
  // The fetch layer's placeholder (no server body) falls back to the gloss.
  assert.equal(syncServerMessage({ message: "Request failed (502)" }), "");
  // Whitespace is collapsed and the result is length-capped for display.
  assert.equal(syncServerMessage({ message: "  multi\n line\t error  " }), "multi line error");
  assert.equal(syncServerMessage({ message: "x".repeat(300) }).length, 240);
  // Missing or non-string messages yield the fallback.
  assert.equal(syncServerMessage({}), "");
  assert.equal(syncServerMessage({ message: 42 }), "");
  assert.equal(syncServerMessage(null), "");
});

test("generation release compatibility is untouched by the diagnostic patch", () => {
  assert.match(app, /const APP_UI_VERSION="1\.4\.116"/);
  assert.match(app, /const GENERATION_WORKER_VERSION="1\.4\.42"/);
  assert.match(page, /app-256\.js\?v=case4-truthful-status/);
});
