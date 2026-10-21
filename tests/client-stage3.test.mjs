import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { makeHarness } from "./helpers/do-harness.mjs";
import { SyncClient } from "./helpers/sync-client.mjs";
import { createAssembledClient } from "../v2/client/assembled-client.mjs";

// Stage 3 evidence: position / settings / quota surfaces, each with one
// truth source — the coordinator's journal fold, the revisioned settings
// aggregate, and the revisioned money view with as-of/stale.
function makeWorld() {
  const h = makeHarness();
  const coord = h.coord;
  let quotaDown = false, pushCounter = 0;
  const mkStorage = () => {
    const map = new Map();
    return { get: async (k) => (map.has(k) ? structuredClone(map.get(k)) : undefined), set: async (k, v) => { map.set(k, structuredClone(v)); }, del: async (k) => { map.delete(k); } };
  };
  const transport = {
    sendCommand: async ({ command_id, type, payload }) => coord.handleCommand({ command_id, type, payload }),
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
    quotaView: async () => { if (quotaDown) throw new Error("offline"); return coord.quotaView(); },
    byteCheck: async () => true,
  };
  const device = (deviceId) => createAssembledClient({ deviceId, storage: mkStorage(), transport });
  return { coord, device, setQuotaDown: (v) => { quotaDown = v; } };
}

const BOOK = { title: "T", occurrenceIds: ["o1", "o2"], chapters: [{ id: "ch1", segments: [{ occurrenceId: "o1", text: "one" }, { occurrenceId: "o2", text: "two" }] }] };
async function seed(coord) { const s = new SyncClient(coord, "seed"); await s.pushBook("bk", BOOK); }

test("stage3 position: the surface reads the coordinator's fold — a second device sees the position with no local state of its own", async () => {
  const w = makeWorld();
  await seed(w.coord);
  const a = w.device("devA"), b = w.device("devB");
  const r = await a.surfaces.reportPosition("bk", { kind: "seek", occurrenceId: "o2", offsetSec: 42 });
  assert.equal(r.pushed, 1);
  const mb = await b.surfaces.positionModel("bk");
  assert.deepEqual(mb.canonical, { occurrenceId: "o2", offsetSec: 42, playing: false });
  assert.equal(mb.pendingLocal, 0);
  const ma = await a.surfaces.positionModel("bk");
  assert.deepEqual(ma.canonical, mb.canonical);
});

test("stage3 position: a stale backward event is recorded but superseded — and the surface SHOWS it instead of hiding it", async () => {
  const w = makeWorld();
  await seed(w.coord);
  const a = w.device("devA"), b = w.device("devB");
  await a.surfaces.reportPosition("bk", { kind: "seek", occurrenceId: "o2", offsetSec: 42 }); // tip 1
  // B, which never learned the tip, reports an earlier spot with baseSeq 0:
  const ev = await b.store.notePosition("bk", { kind: "seek", occurrenceId: "o1", offsetSec: 5 });
  const res = await b.store.flushJournal("bk", 0);
  assert.equal(res.pushed, 1);
  const js = await b.store.journalState("bk");
  assert.deepEqual(js.superseded, [ev.eventId]); // recorded, marked superseded — not dropped, not canonical
  const mb = await b.surfaces.positionModel("bk");
  assert.equal(mb.canonical.occurrenceId, "o2"); // the fold did not move backward
  assert.equal(mb.supersededCount, 1);
});

test("stage3 position: journal gaps are surfaced, not smoothed over", async () => {
  const w = makeWorld();
  await seed(w.coord);
  // devG's events 1 and 3 arrive; event 2 never did (lost on the device):
  await w.coord.handleCommand({ command_id: "gap-1", type: "PushPositionEvents", payload: { bookId: "bk", events: [
    { eventId: "devG:1", deviceId: "devG", localSeq: 1, kind: "seek", occurrenceId: "o1", offsetSec: 3, baseSeq: 0 },
    { eventId: "devG:3", deviceId: "devG", localSeq: 3, kind: "seek", occurrenceId: "o1", offsetSec: 7, baseSeq: 0 },
  ] } });
  const a = w.device("devA");
  const m = await a.surfaces.positionModel("bk");
  assert.deepEqual(m.journalGaps, [{ deviceId: "devG", missing: [2] }]);
});

test("stage3 settings: one writer path; a stale writer gets a surfaced conflict — never a merge, never a silent win", async () => {
  const w = makeWorld();
  const a = w.device("devA"), b = w.device("devB");
  const r1 = await a.surfaces.updateSettings({ monthlyCap: 42 });
  assert.equal(r1.applied, true);
  const mb = await b.surfaces.settingsModel();
  assert.equal(mb.data.monthlyCap, 42);
  assert.equal(mb.revision, r1.revision);
  // B now writes from what it knows; meanwhile A writes again first:
  const r2 = await a.surfaces.updateSettings({ monthlyCap: 77 });
  assert.equal(r2.applied, true);
  const stale = await b.surfaces.updateSettings({ monthlyCap: 1 }); // B's cache still holds r1's revision
  assert.equal(stale.applied, false);
  assert.equal(stale.conflict, true);
  assert.equal(stale.currentData.monthlyCap, 77); // A's value stands; B is told, not merged
  const after = await b.surfaces.settingsModel();
  assert.equal(after.data.monthlyCap, 77);
});

test("stage3 quota (F8): Settings-resident, as-of stamped; a failed refresh keeps the last view and marks it STALE — never zeros", async () => {
  const w = makeWorld();
  const a = w.device("devA");
  const q1 = await a.surfaces.quotaModel();
  assert.equal(q1.stale, false);
  assert.equal(q1.view.dailyLimit, 100);
  assert.equal(q1.view.attemptsToday, 0);
  assert.equal(typeof q1.asOfLedgerSeq, "number");
  w.setQuotaDown(true);
  const q2 = await a.surfaces.quotaModel();
  assert.equal(q2.stale, true);
  assert.deepEqual(q2.view, q1.view); // last good view, honestly labeled
  assert.match(q2.text, /STALE/);
});

test("stage3 guard: the surfaces write only through the store's journal and the SetSettings intent — no hand-rolled commands, no local position truth", async () => {
  const src = (await readFile(new URL("../v2/client/surfaces.mjs", import.meta.url), "utf8"))
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  assert.match(src, /store\.notePosition/);
  assert.match(src, /store\.intent\("SetSettings"/);
  assert.match(src, /transport\.positionView/);
  assert.equal(/PushPositionEvents/.test(src), false);
  assert.equal(/localStorage/.test(src), false);
});
