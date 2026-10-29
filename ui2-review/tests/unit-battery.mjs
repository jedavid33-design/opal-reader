// UI1 unit battery — node, no DOM. Exercises client-store-ui1.js
// (drain + chapter truth) and projection-ui1.js against fake
// storage/transport. Every row asserts; any failure exits nonzero.
import { createClientStore } from "../tree-a/modules/vendor/client-store-ui1.js";
import { chapterModel } from "../tree-a/modules/vendor/client/projection-ui1.js";

const rows = [];
function row(id, name, fn) { return Promise.resolve().then(fn).then(
  () => { rows.push([id, name, "PASS"]); console.log("PASS", id, name); },
  (e) => { rows.push([id, name, "FAIL: " + (e?.message ?? e)]); console.log("FAIL", id, name, "-", e?.message ?? e); }); }
function assert(c, m) { if (!c) throw new Error(m); }
const hex = (i) => i.toString(16).padStart(64, "0");

function fakeStorage() {
  const m = new Map();
  return { _map: m,
    get: async (k) => (m.has(k) ? structuredClone(m.get(k)) : undefined),
    set: async (k, v) => { m.set(k, structuredClone(v)); } };
}
// A scripted changes transport over a fixed change log.
function logTransport(log, { failAtPull = -1, zeroProgress = false, resync = false } = {}) {
  let pulls = 0;
  return {
    pulls: () => pulls,
    async pullChanges(family, cursor, limit) {
      pulls += 1;
      if (pulls === failAtPull) throw new Error("socket reset");
      if (resync) return { family, resyncRequired: true, changes: [], nextSeq: cursor, highWatermark: log.length };
      if (zeroProgress) return { family, changes: [], nextSeq: cursor, highWatermark: log.length };
      const slice = log.filter((c) => c.seq > cursor && c.seq <= cursor + limit);
      return { family, changes: slice, nextSeq: slice.length ? slice[slice.length - 1].seq : cursor, highWatermark: log.length };
    },
    async snapshot(family) {
      const entities = log.map((c) => ({ entityKey: c.entityKey, bookId: c.bookId, revision: c.revision, data: c.payload }));
      return { family, watermark: log.length, entities };
    },
  };
}
const bindingsLog = (n, bookId = "bookA") => Array.from({ length: n }, (_, i) => ({
  seq: i + 1, op: "upsert", entityKey: `${bookId}:occ-${i + 1}`, bookId, revision: 1,
  payload: { cacheKey: hex(i + 1), sha256: hex(i + 100000) },
}));
function seedContent(storage, chapters) {
  return storage.set("cs:state:v1", {
    deviceId: "dev-1", commandCounter: 0, journalCounters: {}, outbox: [], journals: {},
    caches: { content: { floor: 0, tip: 1, cursor: 1, entities: { bookA: { payload: { bookId: "bookA", title: "T", chapters }, revision: 1 } }, tombstones: {} } },
    bytes: {}, money: { view: null, asOfLedgerSeq: null, asOfSettingsRevision: null, stale: true },
  });
}
const mkStore = (storage, transport) => createClientStore({ deviceId: "dev-1", storage, transport });

// U1 — chapterId keying: two chapters with divergent states must not collide.
await row("U1", "chapterDisplay keys chapters by chapterId (divergent adjacent chapters)", async () => {
  const storage = fakeStorage();
  await seedContent(storage, [
    { chapterId: "ch1", index: 0, segments: [{ occurrenceId: "a1" }, { occurrenceId: "a2" }] },
    { chapterId: "ch2", index: 1, segments: [{ occurrenceId: "b1" }, { occurrenceId: "b2" }] },
  ]);
  const st = mkStore(storage, logTransport([]));
  const s = await storage.get("cs:state:v1");
  s.caches.bindings = { floor: 0, tip: 3, cursor: 3, entities: {
    "bookA:a1": { payload: { cacheKey: hex(1) }, revision: 1 },
    "bookA:a2": { payload: { cacheKey: hex(2) }, revision: 1 },
    "bookA:b1": { payload: { cacheKey: hex(3) }, revision: 1 } }, tombstones: {} };
  s.bytes = { [hex(1)]: { bindingRevision: 1 }, [hex(2)]: { bindingRevision: 1 }, [hex(3)]: { bindingRevision: 1 } };
  await storage.set("cs:state:v1", s);
  const d1 = await st.chapterDisplay("bookA", "ch1");
  const d2 = await st.chapterDisplay("bookA", "ch2");
  assert(d1.label === "Complete" && d1.counts.total === 2, `ch1 should be Complete 2/2, got ${JSON.stringify(d1)}`);
  assert(d2.label === "Partial" && d2.counts.missing === 1, `ch2 should be Partial with 1 missing, got ${JSON.stringify(d2)}`);
  const m2 = await chapterModel(st, "bookA", "ch2");
  assert(m2.text === "Partial 1/2", `projection text for ch2 should be "Partial 1/2", got "${m2.text}"`);
});

// U2 — drain converges over 1,799 bindings in one call.
await row("U2", "syncFamilyDrain converges 1,799 bindings in one call (18 pages)", async () => {
  const storage = fakeStorage();
  const tr = logTransport(bindingsLog(1799));
  const st = mkStore(storage, tr);
  const r = await st.syncFamilyDrain("bindings");
  assert(r.complete === true && r.cursor === 1799 && r.tip === 1799, `drain result ${JSON.stringify(r)}`);
  assert(r.pages === 18, `pages should be 18, got ${r.pages}`);
  const cs = await st.cacheState("bindings");
  assert(cs.entities === 1799, `entities should be 1799, got ${cs.entities}`);
  const s = await storage.get("cs:state:v1");
  assert(s.drainStatus?.bindings?.complete === true, "drainStatus must record complete");
});

// U3 — invalid first page: truthful stop, cache untouched.
await row("U3", "drain stops truthfully on a non-contiguous first page; cache byte-identical (empty)", async () => {
  const storage = fakeStorage();
  const bad = { pullChanges: async (family, cursor) => ({ family, changes: [{ seq: 5, op: "upsert", entityKey: "bookA:x", bookId: "bookA", revision: 1, payload: {} }], nextSeq: 5, highWatermark: 10 }),
              snapshot: async () => { throw new Error("not used"); } };
  const st = mkStore(storage, bad);
  const r = await st.syncFamilyDrain("bindings");
  assert(r.complete === false && r.reason === "non_contiguous_page", `result ${JSON.stringify(r)}`);
  const cs = await st.cacheState("bindings");
  assert(cs.entities === 0 && cs.cursor === 0, `cache must be untouched, got ${JSON.stringify(cs)}`);
});

// U4 — late network failure: partial cursor preserved; labels become Sync incomplete.
await row("U4", "network failure at page 6: cursor 500 kept, chapters read Sync incomplete (never Not generated)", async () => {
  const storage = fakeStorage();
  await seedContent(storage, [{ chapterId: "ch9", index: 0, segments: [{ occurrenceId: "occ-900" }, { occurrenceId: "occ-901" }] }]);
  const tr = logTransport(bindingsLog(1799), { failAtPull: 6 });
  const st = mkStore(storage, tr);
  const r = await st.syncFamilyDrain("bindings");
  assert(r.complete === false && r.reason === "network_error" && r.cursor === 500, `result ${JSON.stringify(r)}`);
  const d = await st.chapterDisplay("bookA", "ch9");
  assert(d.label === "Sync incomplete" && d.counts.unsynced === 2 && d.counts.missing === 0, `display ${JSON.stringify(d)}`);
  const m = await chapterModel(st, "bookA", "ch9");
  assert(m.text.startsWith("Sync incomplete — audio index still loading"), `projection text "${m.text}"`);
});

// U5 — zero-progress page stops the drain.
await row("U5", "zero-progress page: drain stops with no_progress", async () => {
  const storage = fakeStorage();
  const st = mkStore(storage, logTransport(bindingsLog(50), { zeroProgress: true }));
  const r = await st.syncFamilyDrain("bindings");
  assert(r.complete === false && r.reason === "no_progress" && r.pages === 1, `result ${JSON.stringify(r)}`);
});

// U6 — page cap: stops at 40 pages, truthfully incomplete.
await row("U6", ">40-page family: drain stops at cap with page_cap, cursor 4000", async () => {
  const storage = fakeStorage();
  const st = mkStore(storage, logTransport(bindingsLog(5000)));
  const r = await st.syncFamilyDrain("bindings");
  assert(r.complete === false && r.reason === "page_cap" && r.pages === 40 && r.cursor === 4000, `result ${JSON.stringify(r)}`);
});

// U7 — restart mid-drain: a new store instance resumes from the persisted cursor, no duplicates.
await row("U7", "restart resumes from persisted cursor; entity count exact", async () => {
  const storage = fakeStorage();
  const st1 = mkStore(storage, logTransport(bindingsLog(1799), { failAtPull: 4 }));
  const r1 = await st1.syncFamilyDrain("bindings");
  assert(r1.complete === false && r1.cursor === 300, `first drain ${JSON.stringify(r1)}`);
  const st2 = mkStore(storage, logTransport(bindingsLog(1799)));
  const r2 = await st2.syncFamilyDrain("bindings");
  assert(r2.complete === true && r2.cursor === 1799, `resumed drain ${JSON.stringify(r2)}`);
  const cs = await st2.cacheState("bindings");
  assert(cs.entities === 1799, `entities must be exactly 1799, got ${cs.entities}`);
});

// U8 — resyncRequired page: snapshot path completes the drain.
await row("U8", "resyncRequired page drains via snapshot to the watermark", async () => {
  const storage = fakeStorage();
  const st = mkStore(storage, logTransport(bindingsLog(250), { resync: true }));
  const r = await st.syncFamilyDrain("bindings");
  assert(r.complete === true && r.cursor === 250, `result ${JSON.stringify(r)}`);
  const cs = await st.cacheState("bindings");
  assert(cs.entities === 250, `entities ${cs.entities}`);
});

// U9 — regression: no drain ever ran -> original missing semantics preserved.
await row("U9", "pre-drain state keeps Not generated semantics (no false Sync incomplete)", async () => {
  const storage = fakeStorage();
  await seedContent(storage, [{ chapterId: "ch1", index: 0, segments: [{ occurrenceId: "zz" }] }]);
  const st = mkStore(storage, logTransport([]));
  const d = await st.chapterDisplay("bookA", "ch1");
  assert(d.label === "Not generated" && d.counts.missing === 1, `display ${JSON.stringify(d)}`);
});

// U10 — first-page network failure with tip still 0: drainStatus alone marks chapters Sync incomplete.
await row("U10", "first-page network failure (tip 0): drainStatus marks Sync incomplete", async () => {
  const storage = fakeStorage();
  await seedContent(storage, [{ chapterId: "ch1", index: 0, segments: [{ occurrenceId: "zz" }] }]);
  const tr = { pullChanges: async () => { throw new Error("offline"); }, snapshot: async () => { throw new Error("offline"); } };
  const st = mkStore(storage, tr);
  const r = await st.syncFamilyDrain("bindings");
  assert(r.complete === false && r.reason === "network_error" && r.tip === 0, `result ${JSON.stringify(r)}`);
  const d = await st.chapterDisplay("bookA", "ch1");
  assert(d.label === "Sync incomplete" && d.counts.unsynced === 1, `display ${JSON.stringify(d)}`);
});

// U11 — cross-device separation: independent storages drain independently.
await row("U11", "two devices (separate storage) keep separate cursors", async () => {
  const sa = fakeStorage(); const sb = fakeStorage();
  const sta = mkStore(sa, logTransport(bindingsLog(1799), { failAtPull: 2 }));
  const stb = mkStore(sb, logTransport(bindingsLog(1799)));
  const ra = await sta.syncFamilyDrain("bindings");
  const rb = await stb.syncFamilyDrain("bindings");
  assert(ra.complete === false && ra.cursor === 100, `device A ${JSON.stringify(ra)}`);
  assert(rb.complete === true && rb.cursor === 1799, `device B ${JSON.stringify(rb)}`);
});

// U12 — torn LATE page: earlier pages stay, cache equals exactly the applied prefix.
await row("U12", "torn page at seq 250: applied prefix intact, drain reports non_contiguous_page", async () => {
  const storage = fakeStorage();
  const log = bindingsLog(1799);
  let pulls = 0;
  const tr = { async pullChanges(family, cursor, limit) { pulls += 1;
      if (pulls === 3) return { family, changes: [{ seq: 999, op: "upsert", entityKey: "bookA:bad", bookId: "bookA", revision: 1, payload: {} }], nextSeq: 999, highWatermark: 1799 };
      const slice = log.filter((c) => c.seq > cursor && c.seq <= cursor + limit);
      return { family, changes: slice, nextSeq: slice.length ? slice[slice.length - 1].seq : cursor, highWatermark: 1799 }; },
    snapshot: async () => { throw new Error("not used"); } };
  const st = mkStore(storage, tr);
  const r = await st.syncFamilyDrain("bindings");
  assert(r.complete === false && r.reason === "non_contiguous_page" && r.cursor === 200, `result ${JSON.stringify(r)}`);
  const cs = await st.cacheState("bindings");
  assert(cs.entities === 200, `entities must be the applied prefix 200, got ${cs.entities}`);
});

// U13 — UI1-R1: findText returns the chapter's chapterId, never undefined.
await row("U13", "findText hit carries the chapter's chapterId (Rowan correction 2b)", async () => {
  const storage = fakeStorage();
  await seedContent(storage, [{ chapterId: "chX", index: 0, segments: [{ occurrenceId: "s1", text: "Hello Zebraquill world" }] }]);
  const st = mkStore(storage, logTransport([]));
  const hits = await st.findText("zebraquill");
  assert(hits.length === 1, `expected 1 hit, got ${hits.length}`);
  assert(hits[0].chapterId === "chX", `chapterId should be chX, got ${JSON.stringify(hits[0])}`);
  assert(hits[0].occurrenceId === "s1", `occurrenceId ${hits[0].occurrenceId}`);
});

const fails = rows.filter((r) => r[2] !== "PASS");
console.log(`\nUNIT BATTERY: ${rows.length - fails.length}/${rows.length} PASS`);
process.exit(fails.length ? 1 : 0);
