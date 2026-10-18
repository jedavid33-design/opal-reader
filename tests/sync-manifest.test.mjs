import test from "node:test";
import assert from "node:assert/strict";
import worker from "../cloudflare-worker.js";

const url = "https://reader.test";
function mockEnvironment() {
  const id = "reader-book-one";
  const cover = "data:image/jpeg;base64," + "A".repeat(1_000_000);
  const book = {
    id,
    title: "Sample Book",
    author: "Sample Author",
    updatedAt: 100,
    cover,
    chapters: [{ title: "Chapter 1", segments: [{ text: "Sample narration" }] }],
  };
  const data = new Map([
    ["library:index", JSON.stringify([{ id, title: book.title, author: book.author, cover, updatedAt: 100 }])],
    ["book:" + id, JSON.stringify(book)],
  ]);
  const reads = [];
  const writes = [];
  const kv = {
    async get(key, format) {
      reads.push(key);
      const value = data.get(key);
      return value == null ? null : format === "json" ? JSON.parse(value) : value;
    },
    async put(key, value) {
      writes.push(key);
      data.set(key, value);
    },
    async list({ prefix }) {
      return {
        keys: [...data.keys()].filter(key => key.startsWith(prefix)).map(name => ({ name })),
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
  return { env, request, data, reads, writes, book, id };
}

test("manifest is small and does not read the legacy cover-heavy index or book content", async () => {
  const t = mockEnvironment();
  const response = await worker.fetch(t.request("/api/sync/manifest"), t.env);
  assert.equal(response.status, 200);
  const raw = await response.text();
  const manifest = JSON.parse(raw);
  assert.deepEqual(manifest.ids, [t.id]);
  assert.deepEqual(manifest.deleted, []);
  assert.ok(raw.length < 500);
  assert.ok(!t.reads.includes("library:index"));
  assert.ok(!t.reads.includes("book:" + t.id));
});

test("individual book endpoint supplies the complete book, including its cover", async () => {
  const t = mockEnvironment();
  const response = await worker.fetch(t.request("/api/sync/book/" + t.id), t.env);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.book, t.book);
});

test("saving book progress compacts legacy index once without removing book covers", async () => {
  const t = mockEnvironment();
  const updated = { ...t.book, updatedAt: 200, position: 123 };
  const save = async (book) => worker.fetch(t.request("/api/sync/book/" + t.id, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(book),
  }), t.env);
  const first = await save(updated);
  assert.equal(first.status, 200);
  const index = JSON.parse(t.data.get("library:index"));
  assert.equal(index.length, 1);
  assert.equal(index[0].id, t.id);
  assert.ok(!Object.hasOwn(index[0], "cover"));
  assert.ok(t.data.get("library:index").length < 500);
  assert.equal(JSON.parse(t.data.get("book:" + t.id)).cover, t.book.cover);
  assert.equal(t.writes.filter(key => key === "library:index").length, 1);
  const second = await save({ ...updated, updatedAt: 300, position: 789 });
  assert.equal(second.status, 200);
  assert.equal(t.writes.filter(key => key === "library:index").length, 1);
  assert.equal(JSON.parse(t.data.get("book:" + t.id)).position, 789);
});

test("deleted books stay out of the manifest and are not returned", async () => {
  const t = mockEnvironment();
  t.data.set("deleted:" + t.id, JSON.stringify({ id: t.id, deletedAt: 12 }));
  const response = await worker.fetch(t.request("/api/sync/manifest"), t.env);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.deepEqual(result.ids, []);
  assert.equal(result.deleted[0].id, t.id);
  const bookResponse = await worker.fetch(t.request("/api/sync/book/" + t.id), t.env);
  assert.equal(bookResponse.status, 404);
});
