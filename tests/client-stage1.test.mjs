import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { makeHarness } from "./helpers/do-harness.mjs";
import { createAssembledClient } from "../v2/client/assembled-client.mjs";

// Stage 1 evidence: the funnel seam. Two assembled clients (two devices)
// over the REAL coordinator; the v1 failure mode (stale device's whole-
// record save silently winning by timestamp) is replayed and shown gone.
function makeWorld() {
  const h = makeHarness();
  const coord = h.coord;
  const mkStorage = () => {
    const map = new Map();
    return { get: async (k) => (map.has(k) ? structuredClone(map.get(k)) : undefined), set: async (k, v) => { map.set(k, structuredClone(v)); }, del: async (k) => { map.delete(k); } };
  };
  const transport = {
    sendCommand: async ({ command_id, type, payload }) => coord.handleCommand({ command_id, type, payload }),
    pullChanges: async (family, sinceSeq, limit) => coord.pullChanges({ family, sinceSeq, limit }),
    snapshot: async (family) => coord.syncSnapshot({ family }),
    pushPosition: async () => { throw new Error("not used in stage 1"); },
    quotaView: async () => coord.quotaView(),
    byteCheck: async () => false,
  };
  const device = (deviceId) => createAssembledClient({ deviceId, storage: mkStorage(), transport });
  return { h, coord, device };
}

const BOOK = (title) => ({ title, occurrenceIds: ["o1"], chapters: [{ id: "ch1", segments: [{ occurrenceId: "o1", text: "x" }] }] });

test("stage1 write path: a funnel save lands on the coordinator and converges to a second device", async () => {
  const w = makeWorld();
  const a = w.device("devA"), b = w.device("devB");
  a.funnel.setWorking("bk", BOOK("Alpha"));
  const r = await a.funnel.saveBook("bk");
  assert.equal(r.skipped, false);
  const st = await a.funnel.settle();
  assert.equal(st.outcomes[0].outcome, "applied");
  await b.funnel.syncNow();
  const wb = await b.funnel.refreshWorking("bk");
  assert.deepEqual(wb, BOOK("Alpha"));
});

test("stage1: the v1 LWW data-loss scenario replays as a surfaced conflict — the newer content survives", async () => {
  const w = makeWorld();
  const a = w.device("devA"), b = w.device("devB");
  a.funnel.setWorking("bk", BOOK("v1"));
  await a.funnel.saveBook("bk");
  await a.funnel.settle();
  await b.funnel.syncNow();
  await b.funnel.refreshWorking("bk");
  b.funnel.setWorking("bk", BOOK("v2 — B's newer edit"));
  await b.funnel.saveBook("bk");
  await b.funnel.settle();
  // A is stale (its cache still holds revision 1) and saves its own edit:
  a.funnel.setWorking("bk", BOOK("A's stale overwrite attempt"));
  await a.funnel.saveBook("bk");
  const st = await a.funnel.settle();
  const receipt = st.outcomes.at(-1).receipt;
  const bookOutcome = (receipt.outcomes ?? []).find((o) => o.entityKey === "bk") ?? receipt;
  assert.equal(bookOutcome.status ?? bookOutcome.outcome, "conflict"); // surfaced, with the current revision attached
  // The coordinator's truth is still B's version — nothing was overwritten:
  const snap = w.coord.syncSnapshot({ family: "content" });
  assert.equal(snap.entities.find((e) => e.entityKey === "bk").data.title, "v2 — B's newer edit");
});

test("stage1: saving an unchanged book enqueues nothing (the funnel diffs honestly)", async () => {
  const w = makeWorld();
  const a = w.device("devA");
  a.funnel.setWorking("bk", BOOK("Same"));
  await a.funnel.saveBook("bk");
  await a.funnel.settle();
  await a.funnel.syncNow();
  await a.funnel.refreshWorking("bk");
  const r = await a.funnel.saveBook("bk");
  assert.deepEqual(r, { skipped: true, reason: "unchanged" });
  assert.equal((await a.store.outboxState()).outcomes.length, 1); // still just the first save
});

test("stage1 delete path: funnel delete tombstones; a later stale save is rejected_tombstoned, surfaced", async () => {
  const w = makeWorld();
  const a = w.device("devA"), b = w.device("devB");
  a.funnel.setWorking("bk", BOOK("Doomed"));
  await a.funnel.saveBook("bk");
  await a.funnel.settle();
  await b.funnel.syncNow();
  await b.funnel.refreshWorking("bk");
  await a.funnel.deleteBook("bk");
  await a.funnel.settle();
  await b.funnel.syncNow();
  assert.equal(await b.funnel.refreshWorking("bk"), null); // gone from B's working copies
  assert.equal((await b.store.cacheState("content")).tombstones, 1);
  b.funnel.setWorking("bk", BOOK("zombie edit"));
  // B's cache no longer holds the entity, so its funnel save bases at 0 and
  // the coordinator's tombstone fence answers:
  await b.funnel.saveBook("bk");
  const st = await b.funnel.settle();
  const receipt = st.outcomes.at(-1).receipt;
  const bookOutcome = (receipt.outcomes ?? []).find((o) => o.entityKey === "bk") ?? receipt;
  assert.equal(bookOutcome.status, "rejected_tombstoned");
});

test("stage1 seam + no old writers: pe is ONE definition in the shipped bundle; the assembled client contains no v1 write machinery", async () => {
  const bundle = await readFile(new URL("../app-256.js", import.meta.url), "utf8");
  assert.equal((bundle.match(/function pe\(/g) ?? []).length, 1); // the single funnel seam Stage 1 substitutes
  const funnelSrc = await readFile(new URL("../v2/client/funnel.mjs", import.meta.url), "utf8");
  const storeSrc = await readFile(new URL("../v2/client-store.mjs", import.meta.url), "utf8");
  const assembledSrc = await readFile(new URL("../v2/client/assembled-client.mjs", import.meta.url), "utf8");
  const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  for (const src of [funnelSrc, storeSrc, assembledSrc].map(stripComments)) {
    assert.equal(/\/api\/sync/.test(src), false); // no v1 sync endpoint
    assert.equal(/updatedAt/.test(src), false); // no timestamp stamping
    assert.equal(/\bEe\(/.test(src), false); // no v1 tombstone-race path
    assert.equal(/localStorage/.test(src), false); // no localStorage truth layers
  }
});
