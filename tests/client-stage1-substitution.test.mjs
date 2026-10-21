import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { makeHarness } from "./helpers/do-harness.mjs";
import { createAssembledClient } from "../v2/client/assembled-client.mjs";

// FU1 sharpened (Rowan): a static map of the pe -> Er -> Ee -> _r seam is
// not a substitution. This test extracts the bundle's ACTUAL pe() source,
// unmodified, and executes it with its sync dependency (Er) bound to the
// v2 bridge — the original call path, terminating in the new funnel and
// the real coordinator. The remaining literal step (binding this bridge
// into a shipped bundle) is the documented integration gate for cutover.

test("substituted extracted path: the bundle's own pe() drives a save that lands via the funnel", async () => {
  const src = await readFile(new URL("../app-256.js", import.meta.url), "utf8");
  const i = src.indexOf("async function pe()");
  const j = src.indexOf("async function delIDB", i);
  assert.ok(i >= 0 && j > i, "pe extraction anchors");
  const peSrc = src.slice(i, j);
  assert.match(peSrc, /updatedAt=Date\.now\(\)/); // extraction integrity: this is the real funnel

  const h = makeHarness();
  const coord = h.coord;
  const map = new Map();
  const storage = { get: async (k) => (map.has(k) ? structuredClone(map.get(k)) : undefined), set: async (k, v) => { map.set(k, structuredClone(v)); }, del: async (k) => { map.delete(k); } };
  const transport = {
    sendCommand: async ({ command_id, type, payload }) => coord.handleCommand({ command_id, type, payload }),
    pullChanges: async (family, sinceSeq, limit) => coord.pullChanges({ family, sinceSeq, limit }),
    snapshot: async (family) => coord.syncSnapshot({ family }),
    pushPosition: async () => { throw new Error("unused"); },
    quotaView: async () => coord.quotaView(),
    byteCheck: async () => false,
  };
  const client = createAssembledClient({ deviceId: "devA", storage, transport });

  // v1 local environment for the extracted pe: a = app state, ke/Be =
  // local persistence, normalizeCompletedChapterStatus = the derivation
  // (Stage 2's concern, stubbed as a no-op counter here).
  const book = { id: "bk", title: "Extracted", occurrenceIds: ["o1"], chapters: [{ id: "ch1", segments: [] }] };
  const a = { book, books: [] };
  const persisted = [];
  let normalizeCalls = 0;
  const ke = async (storeName, rec) => { persisted.push([storeName, rec]); };
  const Be = async () => [a.book];
  // THE SUBSTITUTION: Er (v1's debounce-to-LWW-engine) is bound to the
  // bridge that hands the book to the v2 funnel.
  let bridgeDone = null;
  const Er = (b) => {
    bridgeDone = (async () => {
      client.funnel.setWorking(b.id, { title: b.title, occurrenceIds: b.occurrenceIds, chapters: b.chapters });
      await client.funnel.saveBook(b.id);
      await client.funnel.settle();
    })();
  };
  const pe = new Function("a", "normalizeCompletedChapterStatus", "ke", "Be", "Er",
    `${peSrc}\nreturn pe;`)(a, () => { normalizeCalls += 1; }, ke, Be, Er);

  await pe();
  await bridgeDone;

  // v1 local behavior happened (stamp + local persist, via the real pe):
  assert.equal(persisted.length, 1);
  assert.equal(typeof persisted[0][1].updatedAt, "number");
  assert.equal(normalizeCalls, 1);
  // ...and the save LANDED through the new path: the coordinator holds the
  // book at revision 1, applied via a SyncPush receipt — no PUT, no LWW.
  const snap = coord.syncSnapshot({ family: "content" });
  const bk = snap.entities.find((e) => e.entityKey === "bk");
  assert.equal(bk.data.title, "Extracted");
  assert.equal(bk.revision, 1);
  const st = await client.store.outboxState();
  assert.equal(st.outcomes[0].type, "SyncPush");
  assert.equal(st.outcomes[0].outcome, "applied");
});
