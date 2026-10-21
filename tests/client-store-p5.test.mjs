import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { makeHarness } from "./helpers/do-harness.mjs";
import { SyncClient } from "./helpers/sync-client.mjs";
import { createClientStore } from "../v2/client-store.mjs";
import { censusClientBundle } from "./helpers/writer-census.mjs";

// The store talks to the REAL P2–P4 coordinator through a fake transport
// that can drop ACKs and take byte checks offline — the client half is
// proven against the actual server, not a mock of it.
function makeWorld() {
  const h = makeHarness();
  const coord = h.coord;
  const map = new Map();
  const storage = {
    get: async (k) => (map.has(k) ? structuredClone(map.get(k)) : undefined),
    set: async (k, v) => { map.set(k, structuredClone(v)); },
    del: async (k) => { map.delete(k); },
  };
  const byteWorld = new Set();
  let dropAck = false, pushCounter = 0, quotaDown = false;
  const transport = {
    sendCommand: async ({ command_id, type, payload }) => {
      const r = await coord.handleCommand({ command_id, type, payload });
      if (dropAck) { dropAck = false; throw new Error("ack lost"); }
      return r;
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
    quotaView: async () => { if (quotaDown) throw new Error("offline"); return coord.quotaView(); },
    byteCheck: async (key) => byteWorld.has(key),
  };
  const store = (deviceId = "devA") => createClientStore({ deviceId, storage, transport });
  return { h, coord, storage, transport, byteWorld, store, setDropAck: (v) => { dropAck = v; }, setQuotaDown: (v) => { quotaDown = v; } };
}

const CONTENT = { title: "T", occurrenceIds: ["o1", "o2"], chapters: [{ id: "ch1", segments: [{ occurrenceId: "o1", text: "hello needle world" }, { occurrenceId: "o2", text: "second segment" }] }] };
async function seedBook(coord, { blocked = false, secondBinding = true } = {}) {
  const seed = new SyncClient(coord, "seed");
  await seed.pushBook("bk", CONTENT);
  await seed.push([{ family: "bindings", entityKey: "bk:o1", bookId: "bk", baseRevision: 0, op: "upsert", payload: { cacheKey: "k1", outcome: blocked ? "policy_block" : "ready" } }]);
  if (secondBinding) await seed.push([{ family: "bindings", entityKey: "bk:o2", bookId: "bk", baseRevision: 0, op: "upsert", payload: { cacheKey: "k2", outcome: "ready" } }]);
}

// ---------- census (Rowan check 2: every writer accounted for) ----------

test("census: the shipped bundle's writers match the inventory exactly — 94 pe() sites + fallback writers", async () => {
  const src = await readFile(new URL("../app-256.js", import.meta.url), "utf8");
  const c = censusClientBundle(src);
  assert.equal(c.peCallSites, 94);
  assert.equal(c.localStorageSetItem, 7);
  assert.equal(c.audioKeyAssignments, 11);
  assert.equal(c.releaseOldPlaybackRefs, 3);
  assert.equal(c.derivations.chapterTruth, 700);
  assert.ok(c.derivations.normalizeCompletedChapterStatus >= 100);
  assert.ok(c.derivations.chapterPlaybackReady >= 200);
});

// ---------- outbox (persist-before-dispatch; lost ACK replays the same id) ----------

test("outbox: intent + idempotency key are durable BEFORE any dispatch", async () => {
  const w = makeWorld();
  const s = w.store();
  const id = await s.intent("SetSettings", { baseRevision: 0, data: { monthlyCap: 50 } });
  const raw = (await w.storage.get("cs:state:v1")).outbox;
  assert.equal(raw.length, 1);
  assert.equal(raw[0].command_id, id);
  assert.equal(raw[0].status, "queued");
  assert.equal(w.coord._all("SELECT * FROM commands").length, 0); // nothing dispatched yet
  const r = await s.flushOutbox();
  assert.deepEqual(r, { sent: 1, pending: 0 });
  assert.equal(w.coord._all("SELECT * FROM commands").length, 1);
});

test("outbox: a lost ACK replays the SAME command id — the coordinator sees exactly one command", async () => {
  const w = makeWorld();
  const s = w.store();
  const id = await s.intent("SetSettings", { baseRevision: 0, data: { monthlyCap: 42 } });
  w.setDropAck(true);
  const r1 = await s.flushOutbox();
  assert.equal(r1.pending, 1);
  assert.equal((await s.outboxState()).pending[0].status, "sent_unacked");
  const r2 = await s.flushOutbox();
  assert.equal(r2.pending, 0);
  const rows = w.coord._all("SELECT * FROM commands WHERE command_id = ?", id);
  assert.equal(rows.length, 1); // deduped by id — no second command was minted
  const st = await s.outboxState();
  assert.equal(st.outcomes[0].outcome, "applied");
  assert.equal(w.coord.quotaView().monthlyCap, 42); // applied exactly once
});

test("outbox: conflicts are surfaced as outcomes, never dressed as completion", async () => {
  const w = makeWorld();
  const s = w.store();
  await s.intent("SetSettings", { baseRevision: 99, data: { monthlyCap: 1 } });
  await s.flushOutbox();
  const st = await s.outboxState();
  assert.equal(st.outcomes[0].outcome, "rejected");
  assert.equal(st.outcomes[0].receipt.reason, "settings_conflict"); // the reason rides the receipt, visible to the UI
  assert.equal(st.pending.length, 0);
});

// ---------- removed providers: generation rejected, playback preserved ----------

test("providers: azure/fish generation intents are rejected locally before persistence; their existing audio still plays", async () => {
  const w = makeWorld();
  const s = w.store();
  await assert.rejects(() => s.intent("SubmitJob", { provider: "azure", bookId: "bk" }), /provider_not_carried_over/);
  await assert.rejects(() => s.intent("SubmitJob", { provider: "fish", bookId: "bk" }), /provider_not_carried_over/);
  assert.deepEqual(await s.outboxState(), { pending: [], outcomes: [] });
  assert.deepEqual(s.resolvePlayback({ cacheKey: "old-azure-key", provider: "azure" }), { ok: true, cacheKey: "old-azure-key", provider: "azure" });
  assert.deepEqual(s.resolvePlayback({ cacheKey: "old-fish-key", provider: "fish" }), { ok: true, cacheKey: "old-fish-key", provider: "fish" });
});

// ---------- cache: atomic pages, torn pages, resync ----------

test("cache: sync pulls coordinator deltas; a torn page is rejected whole and changes nothing", async () => {
  const w = makeWorld();
  await seedBook(w.coord);
  const s = w.store();
  const r = await s.syncFamily("content");
  assert.equal(r.applied, true);
  assert.equal((await s.cacheState("content")).entities, 1);
  const before = await s.cacheState("content");
  const torn = { family: "content", changes: [{ seq: before.cursor + 2, entityKey: "x", bookId: "x", revision: 1, op: "upsert", payload: {} }], nextSeq: before.cursor + 2, highWatermark: before.cursor + 2 };
  const bad = await s.applyPullPage("content", torn);
  assert.equal(bad.applied, false);
  assert.deepEqual(await s.cacheState("content"), before); // byte-identical state
});

test("cache: truncated server history triggers resync; snapshot converges incl. tombstones", async () => {
  const w = makeWorld();
  const seed = new SyncClient(w.coord, "seed");
  await seed.pushBook("bk1", { title: "One", occurrenceIds: [] });
  await seed.pushBook("bk2", { title: "Two", occurrenceIds: [] });
  await w.coord.handleCommand({ command_id: "del-bk2", type: "DeleteBook", payload: { bookId: "bk2" } });
  const s = w.store();
  await s.syncFamily("content");
  assert.equal((await s.cacheState("content")).tombstones, 1);
  const seed2 = new SyncClient(w.coord, "seed2"); // distinct id: reusing "seed" would collide command ids and dedupe the pushes away
  await seed2.pushBook("bk3", { title: "Three", occurrenceIds: [] }); // seq 4 — client never pulls it
  await seed2.pushBook("bk4", { title: "Four", occurrenceIds: [] }); // seq 5 — client never pulls it
  w.coord._pruneSyncHistory("content", 5); // both are pruned before the client returns: cursor 3 < floor-1
  const r = await s.syncFamily("content");
  assert.equal(r.resync, true);
  const st = await s.cacheState("content");
  assert.equal(st.entities, 3); // bk1 + bk3 + bk4, converged from the snapshot
  assert.equal(st.tombstones, 1); // bk2 still a tombstone after resync
});

// ---------- chapter display: metadata is not bytes (Rowan check 1) ----------

test("chapter display: bindings without confirmed bytes read Uncertain — never a false Complete; verification earns Complete", async () => {
  const w = makeWorld();
  await seedBook(w.coord);
  const s = w.store();
  await s.syncFamily("content");
  await s.syncFamily("bindings");
  let d = await s.chapterDisplay("bk", "ch1");
  assert.equal(d.label, "Uncertain");
  assert.equal(d.certain, false);
  assert.equal(d.reason, "audio_unverified");
  w.byteWorld.add("k1"); w.byteWorld.add("k2"); // bytes become reachable
  assert.equal(await s.verifyBindingBytes("bk", "o1"), true);
  assert.equal(await s.verifyBindingBytes("bk", "o2"), true);
  d = await s.chapterDisplay("bk", "ch1");
  assert.equal(d.label, "Complete");
  assert.equal(d.certain, true);
});

test("chapter display: a policy-blocked binding reads Blocked; a missing binding reads Partial", async () => {
  const w1 = makeWorld();
  await seedBook(w1.coord, { blocked: true });
  const s1 = w1.store();
  await s1.syncFamily("content"); await s1.syncFamily("bindings");
  assert.equal((await s1.chapterDisplay("bk", "ch1")).label, "Blocked");
  const w2 = makeWorld();
  await seedBook(w2.coord, { secondBinding: false });
  const s2 = w2.store();
  await s2.syncFamily("content"); await s2.syncFamily("bindings");
  assert.equal((await s2.chapterDisplay("bk", "ch1")).label, "Partial");
});

// ---------- position journal: stable sequence across restart ----------

test("journal: offline events keep stable device sequence across a restart and reconcile from receipts", async () => {
  const w = makeWorld();
  await seedBook(w.coord);
  const s1 = w.store();
  await s1.notePosition("bk", { kind: "seek", occurrenceId: "o1", offsetSec: 10 });
  await s1.notePosition("bk", { kind: "seek", occurrenceId: "o1", offsetSec: 20 });
  const s2 = w.store(); // restart: new store, same durable storage
  assert.deepEqual(await s2.journalState("bk"), { total: 2, unacked: 2, superseded: [], rejected: [] });
  const e3 = await s2.notePosition("bk", { kind: "seek", occurrenceId: "o2", offsetSec: 0 });
  assert.equal(e3.eventId, "devA:3"); // sequence continued, not restarted
  const r = await s2.flushJournal("bk", 0);
  assert.equal(r.pushed, 3);
  assert.equal((await s2.journalState("bk")).unacked, 0);
  assert.equal(w.coord.positionView("bk").canonical.occurrenceId, "o2");
  assert.equal(w.coord.positionView("bk").asOfReceiptSeq, 3);
});

// ---------- review fixes: atomic allocation + version-aware bytes ----------

test("atomicity: a crash inside the persistence write leaves NO partial state — no burned id, no orphan intent", async () => {
  const w = makeWorld();
  let armed = true;
  const flaky = {
    get: w.storage.get, del: w.storage.del,
    set: async (k, v) => { if (armed) { armed = false; throw new Error("crash during write"); } return w.storage.set(k, v); },
  };
  const s = createClientStore({ deviceId: "devA", storage: flaky, transport: w.transport });
  await assert.rejects(() => s.intent("SetSettings", { baseRevision: 0, data: { monthlyCap: 33 } }), /crash during write/);
  const st = await s.outboxState();
  assert.deepEqual(st, { pending: [], outcomes: [] }); // nothing half-persisted
  const id = await s.intent("SetSettings", { baseRevision: 0, data: { monthlyCap: 33 } });
  assert.equal(id, "devA-cmd-1"); // the id was not burned by the crashed attempt
  await s.flushOutbox();
  assert.equal(w.coord._all("SELECT * FROM commands WHERE command_id = ?", id).length, 1);
  assert.equal(w.coord.quotaView().monthlyCap, 33);
});

test("atomicity: simultaneous store instances over one storage allocate disjoint command + event ids", async () => {
  const w = makeWorld();
  await seedBook(w.coord);
  const a = w.store(), b = w.store();
  const ids = await Promise.all([
    a.intent("SetSettings", { baseRevision: 0, data: { monthlyCap: 40 } }),
    b.intent("SetSettings", { baseRevision: 0, data: { monthlyCap: 41 } }),
    a.intent("SetSettings", { baseRevision: 0, data: { monthlyCap: 42 } }),
    b.intent("SetSettings", { baseRevision: 0, data: { monthlyCap: 43 } }),
  ]);
  assert.equal(new Set(ids).size, 4); // no collisions despite the race
  const evts = await Promise.all([
    a.notePosition("bk", { kind: "seek", occurrenceId: "o1", offsetSec: 1 }),
    b.notePosition("bk", { kind: "seek", occurrenceId: "o1", offsetSec: 2 }),
  ]);
  assert.notEqual(evts[0].eventId, evts[1].eventId);
  assert.deepEqual(evts.map((e) => e.localSeq).sort(), [1, 2]);
});

test("bytes: a binding revision change invalidates prior confirmations; a missing-bytes report does too", async () => {
  const w = makeWorld();
  await seedBook(w.coord);
  const s = w.store();
  await s.syncFamily("content");
  await s.syncFamily("bindings");
  w.byteWorld.add("k1"); w.byteWorld.add("k2");
  await s.verifyBindingBytes("bk", "o1");
  await s.verifyBindingBytes("bk", "o2");
  assert.equal((await s.chapterDisplay("bk", "ch1")).label, "Complete");
  // The binding for o1 is republished at a new revision (same cache key):
  const seed = new SyncClient(w.coord, "seed9");
  await seed.push([{ family: "bindings", entityKey: "bk:o1", bookId: "bk", baseRevision: 1, op: "upsert", payload: { cacheKey: "k1", outcome: "ready" } }]);
  await s.syncFamily("bindings");
  const d = await s.chapterDisplay("bk", "ch1");
  assert.equal(d.label, "Uncertain"); // the rev-1 confirmation does not carry to rev 2
  assert.equal(d.reason, "audio_unverified");
  await s.verifyBindingBytes("bk", "o1"); // re-verify at the new revision
  assert.equal((await s.chapterDisplay("bk", "ch1")).label, "Complete");
  await s.reportBytesMissing("k1"); // playback found the audio gone
  assert.equal((await s.chapterDisplay("bk", "ch1")).label, "Uncertain");
});

// ---------- follow-up races (Rowan P5 follow-up) ----------

test("race: overlapping flushOutbox calls dispatch each pending command exactly once", async () => {
  const w = makeWorld();
  let sends = 0;
  const slowTransport = { ...w.transport, sendCommand: async (cmd) => { sends += 1; await new Promise((r) => setTimeout(r, 25)); return w.transport.sendCommand(cmd); } };
  const s = createClientStore({ deviceId: "devA", storage: w.storage, transport: slowTransport });
  await s.intent("SetSettings", { baseRevision: 0, data: { monthlyCap: 44 } });
  const [r1, r2] = await Promise.all([s.flushOutbox(), s.flushOutbox()]);
  assert.equal(sends, 1); // the second caller joined the in-flight flush
  assert.equal(r1.pending, 0);
  assert.equal(r2.pending, 0);
  assert.equal(w.coord.quotaView().monthlyCap, 44);
});

test("race: a binding change DURING byte verification discards the confirmation", async () => {
  const w = makeWorld();
  await seedBook(w.coord);
  let hijack = true;
  const transport = { ...w.transport, byteCheck: async (key) => {
    if (hijack && key === "k1") {
      hijack = false;
      const seed = new SyncClient(w.coord, "seed7");
      await seed.push([{ family: "bindings", entityKey: "bk:o1", bookId: "bk", baseRevision: 1, op: "upsert", payload: { cacheKey: "k1", outcome: "ready" } }]);
      await store.syncFamily("bindings"); // the new revision lands mid-check
    }
    return w.byteWorld.has(key);
  } };
  const store = createClientStore({ deviceId: "devA", storage: w.storage, transport });
  await store.syncFamily("content");
  await store.syncFamily("bindings");
  w.byteWorld.add("k1"); w.byteWorld.add("k2");
  assert.equal(await store.verifyBindingBytes("bk", "o1"), false); // checked rev 1, binding moved to rev 2: discarded
  assert.equal(await store.verifyBindingBytes("bk", "o2"), true);
  assert.equal((await store.chapterDisplay("bk", "ch1")).label, "Uncertain");
  assert.equal(await store.verifyBindingBytes("bk", "o1"), true); // fresh verify against rev 2 records
  assert.equal((await store.chapterDisplay("bk", "ch1")).label, "Complete");
});

test("stable device id: a second device id over the same storage cannot write", async () => {
  const w = makeWorld();
  const a = w.store("devA");
  await a.intent("SetSettings", { baseRevision: 0, data: { monthlyCap: 40 } });
  const b = w.store("devB");
  await assert.rejects(() => b.intent("SetSettings", { baseRevision: 1, data: { monthlyCap: 41 } }), /device_id_mismatch/);
  await assert.rejects(() => b.notePosition("bk", { kind: "seek", occurrenceId: "o1", offsetSec: 0 }), /device_id_mismatch/);
  const st = await a.outboxState();
  assert.equal(st.pending.length, 1); // only devA's intent exists
});

// ---------- money: revisioned read with as-of/stale (F8) ----------

test("money: Settings view carries its as-of revisions; a failed refresh marks stale and keeps the last view", async () => {
  const w = makeWorld();
  const s = w.store();
  const m1 = await s.refreshMoney();
  assert.equal(m1.stale, false);
  assert.equal(typeof m1.asOfLedgerSeq, "number");
  assert.equal(typeof m1.asOfSettingsRevision, "number");
  w.setQuotaDown(true);
  const m2 = await s.refreshMoney();
  assert.equal(m2.stale, true);
  assert.deepEqual(m2.view, m1.view); // last known view, honestly labeled stale
});

// ---------- find: standalone, no lab (F10) ----------

test("find: works over the content cache with Prosody Lab entirely absent", async () => {
  const w = makeWorld();
  await seedBook(w.coord);
  const s = w.store();
  await s.syncFamily("content");
  const hits = await s.findText("needle");
  assert.equal(hits.length, 1);
  assert.equal(hits[0].occurrenceId, "o1");
  const storeSrc = await readFile(new URL("../v2/client-store.mjs", import.meta.url), "utf8");
  assert.equal(/^import /m.test(storeSrc), false); // the layer imports nothing — no lab, no generation surface
  assert.equal(/credit/i.test(storeSrc), false); // and no client money-credit path (inventory G)
});
