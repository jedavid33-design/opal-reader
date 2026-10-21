import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { makeHarness } from "./helpers/do-harness.mjs";
import { SyncClient } from "./helpers/sync-client.mjs";
import { createAssembledClient } from "../v2/client/assembled-client.mjs";
import { SURFACES } from "../v2/client/projection.mjs";

// Stage 2 evidence: ONE chapter projection, consumed identically by every
// surface; twin occurrences stay independent; splits re-derive from the
// children; a second device projects identically.
function makeWorld() {
  const h = makeHarness();
  const coord = h.coord;
  const mkStorage = () => {
    const map = new Map();
    return { get: async (k) => (map.has(k) ? structuredClone(map.get(k)) : undefined), set: async (k, v) => { map.set(k, structuredClone(v)); }, del: async (k) => { map.delete(k); } };
  };
  const byteWorld = new Set();
  const transport = {
    sendCommand: async ({ command_id, type, payload }) => coord.handleCommand({ command_id, type, payload }),
    pullChanges: async (family, sinceSeq, limit) => coord.pullChanges({ family, sinceSeq, limit }),
    snapshot: async (family) => coord.syncSnapshot({ family }),
    pushPosition: async () => { throw new Error("unused"); },
    quotaView: async () => coord.quotaView(),
    byteCheck: async (key) => byteWorld.has(key),
  };
  const device = (deviceId) => createAssembledClient({ deviceId, storage: mkStorage(), transport });
  return { coord, byteWorld, device };
}

const TWIN_BOOK = {
  title: "Twins", occurrenceIds: ["t1", "t2"],
  chapters: [{ id: "ch1", segments: [{ occurrenceId: "t1", text: "identical words" }, { occurrenceId: "t2", text: "identical words" }] }],
};
async function seedTwins(coord, { bindT2 = true } = {}) {
  const seed = new SyncClient(coord, "seed");
  await seed.pushBook("bk", TWIN_BOOK);
  await seed.push([{ family: "bindings", entityKey: "bk:t1", bookId: "bk", baseRevision: 0, op: "upsert", payload: { cacheKey: "k-t1", outcome: "ready" } }]);
  if (bindT2) await seed.push([{ family: "bindings", entityKey: "bk:t2", bookId: "bk", baseRevision: 0, op: "upsert", payload: { cacheKey: "k-t2", outcome: "ready" } }]);
}
async function syncAll(client) { await client.funnel.syncNow(); }

test("stage2: all four surfaces render the SAME model for the same chapter, across the state battery", async () => {
  const w = makeWorld();
  await seedTwins(w.coord);
  const a = w.device("devA");
  await syncAll(a);
  // Uncertain (bindings complete, bytes unverified):
  let models = await Promise.all(SURFACES.map((s) => a.projection.surfaceModel(s, "bk", "ch1")));
  for (const m of models) assert.deepEqual(m, models[0]);
  assert.equal(models[0].label, "Uncertain");
  // Complete (bytes verified):
  w.byteWorld.add("k-t1"); w.byteWorld.add("k-t2");
  await a.store.verifyBindingBytes("bk", "t1");
  await a.store.verifyBindingBytes("bk", "t2");
  models = await Promise.all(SURFACES.map((s) => a.projection.surfaceModel(s, "bk", "ch1")));
  for (const m of models) assert.deepEqual(m, models[0]);
  assert.equal(models[0].label, "Complete");
  assert.equal(models[0].text, "Complete 2/2");
});

test("stage2 twins: identical text, independent fates — no text-keyed confusion", async () => {
  const w = makeWorld();
  await seedTwins(w.coord, { bindT2: false });
  const a = w.device("devA");
  await syncAll(a);
  w.byteWorld.add("k-t1");
  await a.store.verifyBindingBytes("bk", "t1");
  let m = await a.projection.chapterModel("bk", "ch1");
  assert.equal(m.label, "Partial"); // t1 ready, t2 missing — despite identical text
  assert.deepEqual(m.counts, { ready: 1, unverified: 0, blocked: 0, missing: 1, total: 2 });
  const seed = new SyncClient(w.coord, "seed2");
  await seed.push([{ family: "bindings", entityKey: "bk:t2", bookId: "bk", baseRevision: 0, op: "upsert", payload: { cacheKey: "k-t2", outcome: "ready" } }]);
  await syncAll(a);
  w.byteWorld.add("k-t2");
  await a.store.verifyBindingBytes("bk", "t2");
  m = await a.projection.chapterModel("bk", "ch1");
  assert.equal(m.label, "Complete");
});

test("stage2 split: a content revision replacing a segment with two children re-derives from the children", async () => {
  const w = makeWorld();
  await seedTwins(w.coord);
  const a = w.device("devA");
  await syncAll(a);
  const SPLIT = {
    title: "Twins", occurrenceIds: ["t1", "t2a", "t2b"],
    chapters: [{ id: "ch1", segments: [{ occurrenceId: "t1", text: "identical words" }, { occurrenceId: "t2a", text: "first half" }, { occurrenceId: "t2b", text: "second half" }] }],
  };
  const seed = new SyncClient(w.coord, "seed3");
  await seed.push([{ family: "content", entityKey: "bk", bookId: "bk", baseRevision: 1, op: "upsert", payload: SPLIT }]);
  await seed.push([{ family: "bindings", entityKey: "bk:t2a", bookId: "bk", baseRevision: 0, op: "upsert", payload: { cacheKey: "k-t2a", outcome: "ready" } }]);
  await syncAll(a);
  w.byteWorld.add("k-t1"); w.byteWorld.add("k-t2a");
  await a.store.verifyBindingBytes("bk", "t1");
  await a.store.verifyBindingBytes("bk", "t2a");
  const m = await a.projection.chapterModel("bk", "ch1");
  assert.equal(m.label, "Partial");
  assert.deepEqual(m.counts, { ready: 2, unverified: 0, blocked: 0, missing: 1, total: 3 }); // t2's old binding plays no part
});

test("stage2: a second device projects the identical model after sync + its own byte verification", async () => {
  const w = makeWorld();
  await seedTwins(w.coord);
  const a = w.device("devA"), b = w.device("devB");
  await syncAll(a);
  await syncAll(b);
  w.byteWorld.add("k-t1"); w.byteWorld.add("k-t2");
  for (const dev of [a, b]) {
    await dev.store.verifyBindingBytes("bk", "t1");
    await dev.store.verifyBindingBytes("bk", "t2");
  }
  const ma = await a.projection.chapterModel("bk", "ch1");
  const mb = await b.projection.chapterModel("bk", "ch1");
  assert.deepEqual(mb, ma);
  assert.equal(ma.label, "Complete");
});

test("stage2 guard: the assembled client defines none of the v1 derivations; the projection is the only chapter-truth source", async () => {
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  for (const p of ["../v2/client/projection.mjs", "../v2/client/funnel.mjs", "../v2/client/assembled-client.mjs", "../v2/client-store.mjs"]) {
    const src = strip(await readFile(new URL(p, import.meta.url), "utf8"));
    assert.equal(/function\s+(chapterTruth|normalizeCompletedChapterStatus|chapterPlaybackReady)\b/.test(src), false, p);
    assert.equal(/\bchapterTruth\s*\(/.test(src), false, p);
  }
  const proj = await readFile(new URL("../v2/client/projection.mjs", import.meta.url), "utf8");
  assert.match(proj, /store\.chapterDisplay/); // the projection reads the store's model — it does not re-derive
});
