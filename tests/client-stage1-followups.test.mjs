import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { makeHarness } from "./helpers/do-harness.mjs";
import { createAssembledClient } from "../v2/client/assembled-client.mjs";
import { analyzeSaveRouting } from "./helpers/bundle-routing.mjs";

// Rowan Stage-1 follow-ups: FU1 routing proof, FU3 restart recovery.
// (FU2 — the in-mutation byte recheck — is covered in client-store-p5 tests.)

test("FU1: in the shipped bundle, every book upload routes pe -> Er -> Ee -> _r; _r is called from nowhere else", async () => {
  const src = await readFile(new URL("../app-256.js", import.meta.url), "utf8");
  const a = analyzeSaveRouting(src);
  assert.equal(a.counts.peTokens, 94); // 93 call sites + the definition (census-consistent)
  assert.equal(a.counts.rCallSites, 2); // both upload calls...
  assert.equal(a.rCallsInsideEe, true); // ...live inside Ee, the sync engine
  assert.equal(a.peCallsEr, true); // pe triggers sync via the Er debounce
  assert.equal(a.peCallsRDirectly, false); // pe never uploads directly
  // pe's body is exactly the funnel contract the v2 funnel substitutes:
  assert.match(a.peBody, /updatedAt=Date\.now\(\)/); // the stamp the funnel removes
  assert.match(a.peBody, /ke\("books"/); // local persist
  assert.match(a.peBody, /Er\(a\.book\)/); // sync trigger
});

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
    pushPosition: async () => { throw new Error("not used here"); },
    quotaView: async () => coord.quotaView(),
    byteCheck: async () => false,
  };
  return { coord, transport, mkStorage };
}
const BOOK = (title) => ({ title, occurrenceIds: ["o1"], chapters: [{ id: "ch1", segments: [{ occurrenceId: "o1", text: "x" }] }] });

test("FU3: restart recovery — a pending command survives, flushes to a surfaced conflict, and the stale working copy converges", async () => {
  const w = makeWorld();
  const storageA = w.mkStorage();
  const a1 = createAssembledClient({ deviceId: "devA", storage: storageA, transport: w.transport });
  const b = createAssembledClient({ deviceId: "devB", storage: w.mkStorage(), transport: w.transport });
  // A creates the book (rev 1), then edits offline and queues the save — app closes before settling.
  a1.funnel.setWorking("bk", BOOK("v1"));
  await a1.funnel.saveBook("bk");
  await a1.funnel.settle();
  a1.funnel.setWorking("bk", BOOK("A offline edit"));
  const queued = await a1.funnel.saveBook("bk");
  assert.equal(queued.skipped, false);
  // Meanwhile B advances the book to rev 2.
  await b.funnel.syncNow();
  await b.funnel.refreshWorking("bk");
  b.funnel.setWorking("bk", BOOK("B v2"));
  await b.funnel.saveBook("bk");
  await b.funnel.settle();
  // A restarts: brand-new store + funnel instances over A's SAME durable storage.
  const a2 = createAssembledClient({ deviceId: "devA", storage: storageA, transport: w.transport });
  const st = await a2.funnel.settle(); // the pending command from before the restart flushes now
  const last = st.outcomes.at(-1);
  const bookOutcome = (last.receipt.outcomes ?? []).find((o) => o.entityKey === "bk");
  assert.equal(bookOutcome.status, "conflict"); // based on rev 1, current is 2 — surfaced, not applied
  assert.equal(bookOutcome.currentRevision, 2);
  // A's working copy converges to the truth on refresh; its ledger retires the stale revision.
  await a2.funnel.syncNow();
  const converged = await a2.funnel.refreshWorking("bk");
  assert.equal(converged.title, "B v2");
  const snap = w.coord.syncSnapshot({ family: "content" });
  assert.equal(snap.entities.find((e) => e.entityKey === "bk").data.title, "B v2"); // B's content was never touched
});
