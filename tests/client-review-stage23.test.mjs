import { test } from "node:test";
import assert from "node:assert/strict";
import { makeHarness } from "./helpers/do-harness.mjs";
import { createAssembledClient } from "../v2/client/assembled-client.mjs";

// Rowan's Stage 2/3 review asks (6327860569): (1) two funnel instances
// sharing one storage; (2) a restart during retry setup; (3) settings
// success claimed ONLY from the matching command's applied receipt —
// pending and outcome-unknown reported as themselves.
function makeWorld() {
  const h = makeHarness();
  const coord = h.coord;
  let pushCounter = 0, failSettingsSend = false, unknownSettings = false;
  const mkStorage = () => {
    const map = new Map();
    return { map, get: async (k) => (map.has(k) ? structuredClone(map.get(k)) : undefined), set: async (k, v) => { map.set(k, structuredClone(v)); }, del: async (k) => { map.delete(k); } };
  };
  const transport = {
    sendCommand: async ({ command_id, type, payload }) => {
      if (type === "SetSettings" && failSettingsSend) throw new Error("send failed");
      if (type === "SetSettings" && unknownSettings) return { command_id, outcome: "outcome_unknown" };
      return coord.handleCommand({ command_id, type, payload });
    },
    pullChanges: async (family, sinceSeq, limit) => coord.pullChanges({ family, sinceSeq, limit }),
    snapshot: async (family) => coord.syncSnapshot({ family }),
    pushPosition: async (bookId, events) => {
      pushCounter += 1;
      const r = await coord.handleCommand({ command_id: `push-${pushCounter}`, type: "PushPositionEvents", payload: { bookId, events } });
      const receipts = [], rejected = [];
      for (const o of r.outcomes ?? []) {
        if (o.receiptSeq) receipts.push({ eventId: o.eventId, receiptSeq: o.receiptSeq, superseded: o.superseded });
        else rejected.push({ eventId: o.eventId, reason: o.reason });
      }
      const view = coord.positionView(bookId);
      return { receipts, rejected, tip: view.asOfReceiptSeq, journalGaps: view.journalGaps };
    },
    positionView: async (bookId) => coord.positionView(bookId),
    quotaView: async () => coord.quotaView(),
    byteCheck: async () => true,
  };
  const storageB = mkStorage(); // devB is ONE persistent device across the whole world
  const device = (deviceId, storage) => createAssembledClient({ deviceId, storage: storage ?? (deviceId === "devB" ? storageB : mkStorage()), transport });
  return { coord, device, mkStorage, setFailSettingsSend: (v) => { failSettingsSend = v; }, setUnknownSettings: (v) => { unknownSettings = v; } };
}

const BOOK = (t) => ({ title: t, occurrenceIds: ["s1"], chapters: [{ id: "ch1", segments: [{ occurrenceId: "s1", text: t }] }] });
async function parkOn(storageHolder, w, bookId) {
  const a = w.device("devA", storageHolder);
  const b = w.device("devB");
  a.funnel.setWorking(bookId, BOOK("v1"));
  await a.funnel.saveBook(bookId);
  await a.funnel.settle();
  await b.funnel.syncNow();
  await b.funnel.refreshWorking(bookId);
  b.funnel.setWorking(bookId, BOOK("B v2"));
  await b.funnel.saveBook(bookId);
  await b.funnel.settle();
  a.funnel.setWorking(bookId, BOOK("A edit"));
  await a.funnel.saveBook(bookId);
  await a.funnel.settle();
  assert.equal((await a.funnel.parkedEdit(bookId)).payload.title, "A edit");
  return { a, b };
}

test("review (1): two funnel instances sharing one storage serialize their durable writes — concurrent discards on different books BOTH survive", async () => {
  const w = makeWorld();
  const shared = w.mkStorage();
  await parkOn(shared, w, "bk1");
  await parkOn(shared, w, "bk2");
  const f1 = w.device("devA", shared); // second live instance, same storage + device
  const f2 = w.device("devA", shared); // third
  await Promise.all([
    f1.funnel.resolveParked("bk1", "discard"),
    f2.funnel.resolveParked("bk2", "discard"),
  ]);
  const check = w.device("devA", shared);
  assert.equal(await check.funnel.parkedEdit("bk1"), null); // neither discard was lost to an interleaved write
  assert.equal(await check.funnel.parkedEdit("bk2"), null);
  await Promise.all([f1.funnel.settle(), f2.funnel.settle()]); // concurrent settles converge too
  assert.equal(await check.funnel.parkedEdit("bk1"), null);
  assert.equal(await check.funnel.parkedEdit("bk2"), null);
});

test("review (2a): restart DURING retry setup — setup marked, command issued, id-marking never written: settle still clears the park by payload identity", async () => {
  const w = makeWorld();
  const shared = w.mkStorage();
  const { a } = await parkOn(shared, w, "bk");
  // Recreate exactly the durable state a crash mid-setup leaves behind:
  const rec = await shared.get("cs:funnel:v1");
  rec.parks.bk.resolution = { how: "retry-setup" };
  rec.knownRevisions.bk = 2; // resolveParked's rebase read had already landed
  await shared.set("cs:funnel:v1", rec);
  // ...and the replacement save HAD been issued (outbox is durable too):
  await a.funnel.syncNow();
  const park = await a.funnel.parkedEdit("bk");
  a.funnel.setWorking("bk", park.payload);
  const sv = await a.funnel.saveBook("bk");
  assert.equal(sv.skipped, false);
  // CRASH before the command-id marking. Restart with a fresh instance:
  const a2 = w.device("devA", shared);
  await a2.funnel.settle();
  assert.equal(await a2.funnel.parkedEdit("bk"), null); // cleared by payload identity, not by the (never-written) command id
  const snap = w.coord.syncSnapshot({ family: "content" });
  assert.equal(snap.entities.find((e) => e.entityKey === "bk").data.title, "A edit");
});

test("review (2b): restart during retry setup BEFORE any command was issued — the park is not stuck; an explicit retry still lands it", async () => {
  const w = makeWorld();
  const shared = w.mkStorage();
  await parkOn(shared, w, "bk");
  const rec = await shared.get("cs:funnel:v1");
  rec.parks.bk.resolution = { how: "retry-setup" }; // crash between the setup marking and saveBook
  await shared.set("cs:funnel:v1", rec);
  const a2 = w.device("devA", shared);
  const p = await a2.funnel.parkedEdit("bk");
  assert.equal(p.payload.title, "A edit"); // still parked, payload intact
  await a2.funnel.syncNow();
  await a2.funnel.refreshWorking("bk");
  const rr = await a2.funnel.resolveParked("bk", "retry"); // not stuck on the stale setup marker
  assert.equal(rr.resolved, true);
  await a2.funnel.settle();
  assert.equal(await a2.funnel.parkedEdit("bk"), null);
});

test("review (3a): settings PENDING — a failed send reports pending (not success, not conflict); the durable command lands after healing", async () => {
  const w = makeWorld();
  const a = w.device("devA");
  w.setFailSettingsSend(true);
  const r = await a.surfaces.updateSettings({ monthlyCap: 33 });
  assert.equal(r.applied, false);
  assert.equal(r.pending, true);
  assert.equal(r.conflict, false);
  w.setFailSettingsSend(false);
  await a.store.flushOutbox(); // the SAME durable command flushes — no duplicate was minted
  const m = await a.surfaces.settingsModel();
  assert.equal(m.data.monthlyCap, 33);
});

test("review (3b): settings OUTCOME UNKNOWN — reported as unknown, never dressed as applied; the standing value is untouched", async () => {
  const w = makeWorld();
  const a = w.device("devA");
  const seedWrite = await a.surfaces.updateSettings({ monthlyCap: 50 }); // establish a known standing value first
  assert.equal(seedWrite.applied, true);
  const before = await a.surfaces.settingsModel();
  assert.equal(before.data.monthlyCap, 50);
  w.setUnknownSettings(true);
  const r = await a.surfaces.updateSettings({ monthlyCap: 99 });
  assert.equal(r.applied, false);
  assert.equal(r.unknown, true);
  w.setUnknownSettings(false);
  const after = await a.surfaces.settingsModel();
  assert.equal(after.data.monthlyCap, before.data.monthlyCap); // the fabricated transport never applied it, and the surface never claimed it did
  assert.equal(after.revision, before.revision);
});
