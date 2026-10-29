// G7 storage suite (design §9 rows T1-T6, T9, T11 at Node level,
// plus Rowan conditions (a),(b),(d),(e),(f),(g)).
// Runs against a tree: UI4_TREE=tree-a (default) or
// UI4_TREE=package/publish. Usage: node g7-suite.mjs [--json]
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createFakeIndexedDB, namedError } from "./fake-idb.mjs";
import { DEVICE_ID, PAGE_SIZES, SEED_TARGET_CHARS, seedRecordRaw, pageChanges, shelfRecordRaw, PREFS_RAW } from "./g7-fixtures.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TREE = process.env.UI4_TREE || "tree-a";
const T = (rel) => pathToFileURL(path.join(HERE, "..", TREE, rel)).href;

const SS = await import(T("modules/storage-state.js"));
const SA = await import(T("modules/storage-adapter.js"));
const K = await import(T("modules/constants-ui4.js"));
const STORE = await import(T("modules/vendor/client-store-ui4.js"));

const { STATE_KEY, SHELF_KEY, UI_PREFS_KEY, SHELL_DEVICE_ID_KEY, STATE_BACKEND_MARKER_KEY, STATE_DB_NAME, STATE_META_KEY } = K;
const ALLOWLIST = new Set(["op", "family", "stage", "class", "errorName", "errorCode", "cursor", "tip",
  "seqFrom", "seqTo", "pageCount", "pagePayloadChars", "recordChars", "attemptedChars",
  "storageBackend", "storageEstimateUsage", "storageEstimateQuota", "at", "build"]);

const rows = [];
function row(id, name, fn) { rows.push({ id, name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || "assertion failed"); }
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg || "not equal"}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`); }

function rawAccessOf(storageLike) {
  return {
    getRaw: (k) => { const v = storageLike.getItem(k); return v === null || v === undefined ? undefined : String(v); },
    setRaw: (k, v) => { storageLike.setItem(k, String(v)); },
    removeRaw: (k) => { storageLike.removeItem(k); },
  };
}

function freshLegacy(seed = true) {
  const storageLike = SA.createStorageLike();
  const legacy = SA.createBrowserStorage(storageLike);
  const raw = rawAccessOf(storageLike);
  if (seed) {
    raw.setRaw(STATE_KEY, seedRecordRaw());
    raw.setRaw(SHELF_KEY, shelfRecordRaw(7));
    raw.setRaw(UI_PREFS_KEY, PREFS_RAW);
    raw.setRaw(SHELL_DEVICE_ID_KEY, DEVICE_ID);
  }
  return { storageLike, legacy, raw };
}

function session(factory, legacyCtx, opts = {}) {
  globalThis.indexedDB = factory;
  const idb = SS.createIndexedDbStorage(opts.idbOpts || {});
  const migrationIdb = opts.idbWrap ? opts.idbWrap(idb) : idb;
  const router = SS.createStateRoutingStorage({ idb: migrationIdb, legacy: legacyCtx.legacy });
  return { idb, router, migrationIdb };
}

async function migrate(factory, ctx, s, rawOverride) {
  return SS.runStorageMigration({
    legacy: ctx.legacy, idb: s.migrationIdb, router: s.router,
    rawAccess: rawOverride || ctx.raw, build: "test-build",
  });
}

// ---------------------------------------------------------------- G1 classifier (T2)
row("G1", "classifier: every taxonomy member maps to its class; foreign errors unclassified", async () => {
  const C = SS.classifyStorageError;
  eq(C(namedError("QuotaExceededError", 22), "storage_write"), "storage_quota_exceeded");
  eq(C({ name: "DOMException", code: 22 }, "storage_write"), "storage_quota_exceeded");
  eq(C({ name: "DOMException", code: 1014 }, "storage_write"), "storage_quota_exceeded");
  eq(C(namedError("NS_ERROR_DOM_QUOTA_REACHED"), "storage_write"), "storage_quota_exceeded");
  eq(C(namedError("SecurityError"), "storage_read"), "storage_unavailable");
  eq(C(namedError("InvalidStateError"), "storage_write"), "storage_unavailable");
  eq(C(namedError("UnknownError"), "storage_write"), "storage_unavailable");
  const cyclic = new TypeError("Converting circular structure to JSON --> starting at object");
  eq(C(cyclic, "storage_write"), "storage_serialization_failed");
  eq(C(new RangeError("Invalid string length"), "storage_write"), "storage_serialization_failed");
  eq(C(new Error("disk gone"), "storage_write"), "storage_write_failed");
  eq(C(new Error("boom"), "storage_delete"), "storage_write_failed");
  eq(C(new Error("boom"), "transport"), "network_error", "network_error is the transport-stage class, and only there");
  eq(C({ name: "Error", code: "ownership_epoch_lost" }, "storage_write"), null, "guard refusals stay unlabelled");
});

// ---------------------------------------------------------------- G2 router (T1)
row("G2", "router: exact-key dispatch; non-state keys never reach IDB; state key never reaches localStorage post-cutover", async () => {
  const factory = createFakeIndexedDB();
  const ctx = freshLegacy();
  const s = session(factory, ctx);
  // pre-cutover: state key still legacy
  await s.router.set(STATE_KEY, { probe: 1 });
  eq(JSON.parse(ctx.raw.getRaw(STATE_KEY)).probe, 1, "pre-cutover state write went to legacy");
  eq(await s.idb.getRaw(STATE_KEY), undefined, "pre-cutover state write did not touch IDB");
  const health = await migrate(factory, ctx, s);
  eq(health.backend, "indexeddb");
  eq(s.router.isCutover(), true);
  // post-cutover: state -> IDB only
  const legacyBefore = ctx.raw.getRaw(STATE_KEY);
  await s.router.set(STATE_KEY, { probe: 2, deviceId: DEVICE_ID });
  eq(ctx.raw.getRaw(STATE_KEY), legacyBefore, "post-cutover state write did not touch legacy");
  eq(JSON.parse(await s.idb.getRaw(STATE_KEY)).probe, 2, "post-cutover state landed in IDB");
  // non-state keys -> legacy only, even post-cutover
  await s.router.set(SHELF_KEY, { outbox: [] });
  eq(await s.idb.getRaw(SHELF_KEY), undefined, "shelf key never reached IDB");
  assert(ctx.raw.getRaw(SHELF_KEY).includes("outbox"), "shelf key landed in legacy");
  await s.router.set(UI_PREFS_KEY, { theme: "dark" });
  eq(await s.idb.getRaw(UI_PREFS_KEY), undefined, "prefs key never reached IDB");
  await s.router.set("some:unknown:key", { x: 1 });
  eq(await s.idb.getRaw("some:unknown:key"), undefined, "unknown key never reached IDB");
  eq((await s.router.get(STATE_KEY)).probe, 2, "router get reads IDB post-cutover");
});

// ---------------------------------------------------------------- G3 migration happy path (T3)
row("G3", "migration S0->S6: byte equality, meta, marker last, legacy + shelf + prefs untouched, guard verifies, §8 inventory", async () => {
  const factory = createFakeIndexedDB();
  const ctx = freshLegacy();
  const seedRaw = ctx.raw.getRaw(STATE_KEY);
  eq(seedRaw.length, SEED_TARGET_CHARS, "seed is the measured 1,871,025 chars");
  const s = session(factory, ctx);
  const health = await migrate(factory, ctx, s);
  eq(health.backend, "indexeddb"); eq(health.state, "S6");
  eq(await s.idb.getRaw(STATE_KEY), seedRaw, "IDB state row byte-identical to the legacy source");
  const meta = JSON.parse(await s.idb.getRaw(STATE_META_KEY));
  eq(meta.schema, 1); eq(meta.source, "localStorage");
  eq(meta.sourceChars, seedRaw.length);
  eq(meta.sourceSha256, await SS.sha256Hex(seedRaw));
  eq(meta.stateSha256, meta.sourceSha256, "state digest equals source digest before steady-state writes");
  const marker = JSON.parse(ctx.raw.getRaw(STATE_BACKEND_MARKER_KEY));
  eq(marker.backend, "indexeddb"); eq(marker.stateSha256, meta.sourceSha256, "marker written last, carries the verified digest");
  eq(ctx.raw.getRaw(STATE_KEY), seedRaw, "legacy record retained byte-identical (forensic snapshot)");
  eq(ctx.raw.getRaw(SHELF_KEY), shelfRecordRaw(7), "shelf record untouched");
  eq(ctx.raw.getRaw(UI_PREFS_KEY), PREFS_RAW, "prefs untouched");
  const guard = await health.verifyGuard();
  eq(guard.applicable, true); eq(guard.shelfMatch, true); eq(guard.prefsMatch, true);
  eq(guard.shelfPending, 7, "all 7 pending shelf outbox items preserved");
  // §8 preservation inventory on the migrated record
  const rec = await s.router.get(STATE_KEY);
  const counts = SS.recordInvariantCounts(rec);
  eq(counts.deviceId, DEVICE_ID);
  eq(counts.commandCounter, 41, "commandCounter migrated as data (no command id can be reissued)");
  eq(counts.outboxLength, 2); eq(counts.outboxStatus.pending, 1); eq(counts.outboxStatus.acked, 1);
  eq(counts.journals["book-fh"], 2); eq(counts.journalCounters["book-fh"], 2);
  eq(counts.families.content.cursor, 12); eq(counts.families.content.tip, 12); eq(counts.families.content.entities, 7);
  eq(counts.families.bindings.cursor, 1799); eq(counts.families.bindings.entities, 1799);
  eq(counts.bytesCount, 1);
});

// ---------------------------------------------------------------- G4 fresh install
row("G4", "fresh install: no legacy record -> straight to cutover with migratedFrom none", async () => {
  const factory = createFakeIndexedDB();
  const ctx = freshLegacy(false);
  const s = session(factory, ctx);
  const health = await migrate(factory, ctx, s);
  eq(health.backend, "indexeddb"); eq(health.state, "S6");
  eq(JSON.parse(await s.idb.getRaw(STATE_META_KEY)).migratedFrom, "none", "meta records the fresh-install origin");
  await s.router.set(STATE_KEY, { deviceId: DEVICE_ID, fresh: true });
  eq(JSON.parse(await s.idb.getRaw(STATE_KEY)).fresh, true, "first record lands in IDB");
  eq(ctx.raw.getRaw(STATE_KEY), undefined, "no legacy record created");
});

// ---------------------------------------------------------------- G5 IDB unavailable pre-cutover (T6)
row("G5", "IDB open failure pre-cutover: stay on legacy, classified storage_unavailable, legacy untouched", async () => {
  const factory = createFakeIndexedDB();
  factory.failOpenWith = namedError("SecurityError");
  const ctx = freshLegacy();
  const seedRaw = ctx.raw.getRaw(STATE_KEY);
  const s = session(factory, ctx);
  const health = await migrate(factory, ctx, s);
  eq(health.backend, "localstorage"); eq(health.state, "S0");
  eq(health.lastDiag.class, "storage_unavailable");
  eq(s.router.isCutover(), false);
  eq(ctx.raw.getRaw(STATE_KEY), seedRaw, "legacy record intact");
  eq(ctx.raw.getRaw(STATE_BACKEND_MARKER_KEY), undefined, "no marker written");
});

// ---------------------------------------------------------------- G6 crash boundaries (T4)
row("G6a", "crash after S1 (empty IDB, no meta/marker): next launch completes migration", async () => {
  const factory = createFakeIndexedDB();
  const ctx = freshLegacy();
  const s1 = session(factory, ctx);
  await s1.idb.storageHealth(); // S1 happened, then "crash"
  const s2 = session(factory, ctx);
  const health = await migrate(factory, ctx, s2);
  eq(health.state, "S6"); eq(await s2.idb.getRaw(STATE_KEY), ctx.raw.getRaw(STATE_KEY));
});

row("G6b", "crash after S3/S4 (rows+meta in IDB, marker absent): resume verifies and cuts over, no double migration", async () => {
  const factory = createFakeIndexedDB();
  const ctx = freshLegacy();
  const seedRaw = ctx.raw.getRaw(STATE_KEY);
  const s1 = session(factory, ctx);
  await migrate(factory, ctx, s1);
  const metaBefore = await s1.idb.getRaw(STATE_META_KEY);
  ctx.raw.removeRaw(STATE_BACKEND_MARKER_KEY); // crash before S5's marker landed
  const s2 = session(factory, ctx);
  const health = await migrate(factory, ctx, s2);
  eq(health.state, "S6");
  eq(await s2.idb.getRaw(STATE_META_KEY), metaBefore, "resume did not re-run the migration (meta untouched)");
  eq(await s2.idb.getRaw(STATE_KEY), seedRaw, "state row unchanged by the resume");
  assert(ctx.raw.getRaw(STATE_BACKEND_MARKER_KEY), "marker rewritten on resume");
});

row("G6c", "steady state: evolved IDB record survives relaunch agreement; legacy snapshot not re-served", async () => {
  const factory = createFakeIndexedDB();
  const ctx = freshLegacy();
  const s1 = session(factory, ctx);
  await migrate(factory, ctx, s1);
  const evolved = await s1.router.get(STATE_KEY);
  evolved.caches.content.cursor = 18; evolved.caches.content.tip = 18;
  await s1.router.set(STATE_KEY, evolved);
  const s2 = session(factory, ctx);
  const health = await migrate(factory, ctx, s2);
  eq(health.state, "S6");
  eq((await s2.router.get(STATE_KEY)).caches.content.cursor, 18, "evolved record is the live one");
});

row("G6d", "S3 transaction failure is atomic: nothing staged lands; retry migrates cleanly", async () => {
  const factory = createFakeIndexedDB();
  factory.quotaOnPut = true;
  const ctx = freshLegacy();
  const s1 = session(factory, ctx);
  const h1 = await migrate(factory, ctx, s1);
  eq(h1.backend, "localstorage"); eq(h1.lastDiag.class, "storage_quota_exceeded");
  eq(await s1.idb.getRaw(STATE_KEY), undefined, "aborted transaction left no state row");
  eq(await s1.idb.getRaw(STATE_META_KEY), undefined, "aborted transaction left no meta row");
  factory.quotaOnPut = false;
  const s2 = session(factory, ctx);
  const h2 = await migrate(factory, ctx, s2);
  eq(h2.state, "S6");
});

row("G6e", "aborted IDB transaction on set: prior record intact", async () => {
  const factory = createFakeIndexedDB();
  const ctx = freshLegacy();
  const s = session(factory, ctx);
  await migrate(factory, ctx, s);
  const before = await s.idb.getRaw(STATE_KEY);
  factory.abortNextTx = true;
  let threw = false;
  try { await s.router.set(STATE_KEY, { deviceId: DEVICE_ID, replaced: true }); } catch { threw = true; }
  eq(threw, true, "aborted set rejects");
  eq(await s.idb.getRaw(STATE_KEY), before, "prior record intact after abort");
});

// ---------------------------------------------------------------- G7 marker-write failure (T4/Rowan b)
row("G7", "marker-write failure: stay on legacy, IDB remnant resumable, cutover completes next launch", async () => {
  const factory = createFakeIndexedDB();
  const ctx = freshLegacy();
  const seedRaw = ctx.raw.getRaw(STATE_KEY);
  let failMarker = true;
  const raw = {
    ...ctx.raw,
    setRaw: (k, v) => { if (failMarker && k === STATE_BACKEND_MARKER_KEY) throw namedError("QuotaExceededError", 22); ctx.raw.setRaw(k, v); },
  };
  const s1 = session(factory, ctx);
  const h1 = await migrate(factory, ctx, s1, raw);
  eq(h1.backend, "localstorage"); eq(h1.markerWriteFailed, true);
  eq(h1.lastDiag.class, "storage_quota_exceeded");
  eq(s1.router.isCutover(), false, "router did not flip without the marker");
  eq(ctx.raw.getRaw(STATE_KEY), seedRaw, "legacy untouched");
  eq(await s1.idb.getRaw(STATE_KEY), seedRaw, "verified IDB rows remain as a resumable remnant");
  failMarker = false;
  const s2 = session(factory, ctx);
  const h2 = await migrate(factory, ctx, s2, raw);
  eq(h2.state, "S6"); eq(s2.router.isCutover(), true);
});

// ---------------------------------------------------------------- G8 verify failure (T3/T9)
row("G8", "S4 verify mismatch: abort to legacy, IDB rows deleted (the only delete), legacy never modified", async () => {
  const factory = createFakeIndexedDB();
  const ctx = freshLegacy();
  const seedRaw = ctx.raw.getRaw(STATE_KEY);
  const s = session(factory, ctx, {
    idbWrap: (idb) => ({ ...idb, setEntries: (entries) => idb.setEntries(entries.map((e) => e.key === STATE_KEY ? { ...e, value: `${e.value} ` } : e)) }),
  });
  const health = await migrate(factory, ctx, s);
  eq(health.backend, "localstorage"); eq(health.state, "S0");
  eq(health.lastDiag.class, "storage_write_failed"); eq(health.lastDiag.stage, "verify", "the failure is attributed to the S4 verify stage");
  eq(await s.idb.getRaw(STATE_KEY), undefined, "unverified state row deleted");
  eq(await s.idb.getRaw(STATE_META_KEY), undefined, "unverified meta row deleted");
  eq(ctx.raw.getRaw(STATE_KEY), seedRaw, "legacy never modified");
});

// ---------------------------------------------------------------- G9 tripwire (T5/Rowan d)
row("G9", "legacy-writer tripwire: post-cutover legacy mutation stops the next launch; IDB untouched", async () => {
  const factory = createFakeIndexedDB();
  const ctx = freshLegacy();
  const s1 = session(factory, ctx);
  await migrate(factory, ctx, s1);
  const idbBefore = await s1.idb.getRaw(STATE_KEY);
  const tampered = ctx.raw.getRaw(STATE_KEY).replace("x", "z");
  ctx.raw.setRaw(STATE_KEY, tampered); // a stale ui-pkg-3 tab wrote
  const s2 = session(factory, ctx);
  let err = null;
  try { await migrate(factory, ctx, s2); } catch (e) { err = e; }
  assert(err, "boot must stop on legacy divergence");
  eq(err.code, "legacy_writer_detected");
  eq(s2.router.isCutover(), false, "no state served from either backend");
  eq(await s2.idb.getRaw(STATE_KEY), idbBefore, "IDB record untouched by the tripwire stop");
});

// ---------------------------------------------------------------- G10 eviction (T11/Rowan e)
row("G10", "IDB evicted post-cutover: fail closed storage_unavailable; stale legacy NOT resurrected", async () => {
  const factory = createFakeIndexedDB();
  const ctx = freshLegacy();
  const seedRaw = ctx.raw.getRaw(STATE_KEY);
  const s1 = session(factory, ctx);
  await migrate(factory, ctx, s1);
  factory.evict(STATE_DB_NAME);
  const s2 = session(factory, ctx);
  let err = null;
  try { await migrate(factory, ctx, s2); } catch (e) { err = e; }
  assert(err, "boot must stop when IDB vanished under a cutover marker");
  eq(err.code, "storage_unavailable");
  eq(s2.router.isCutover(), false);
  eq(ctx.raw.getRaw(STATE_KEY), seedRaw, "legacy snapshot preserved for attended recovery, never served");
});

// ---------------------------------------------------------------- G11 IDB full (T6/Rowan e)
row("G11", "IDB quota on steady-state set: classified storage_quota_exceeded, prior record intact", async () => {
  const factory = createFakeIndexedDB();
  const ctx = freshLegacy();
  const s = session(factory, ctx);
  await migrate(factory, ctx, s);
  const before = await s.idb.getRaw(STATE_KEY);
  factory.quotaOnPut = true;
  let err = null;
  try { await s.router.set(STATE_KEY, { deviceId: DEVICE_ID, big: true }); } catch (e) { err = e; }
  factory.quotaOnPut = false;
  assert(err, "quota set must reject");
  eq(err.code, "storage_quota_exceeded");
  eq(await s.idb.getRaw(STATE_KEY), before, "prior record intact");
});

// ---------------------------------------------------------------- G12 blocked open (T6/Rowan e)
row("G12", "blocked IDB open pre-cutover: bounded wait, stay on legacy classified storage_unavailable", async () => {
  const factory = createFakeIndexedDB();
  factory.blockOpen = true;
  const ctx = freshLegacy();
  const s = session(factory, ctx, { idbOpts: { openTimeoutMs: 60 } });
  const health = await migrate(factory, ctx, s);
  eq(health.backend, "localstorage");
  eq(health.lastDiag.class, "storage_unavailable");
});

// ---------------------------------------------------------------- G13 versionchange (T6/Rowan e)
row("G13", "versionchange in steady state: subsequent storage ops fail classified storage_unavailable", async () => {
  const factory = createFakeIndexedDB();
  const ctx = freshLegacy();
  const s = session(factory, ctx);
  await migrate(factory, ctx, s);
  factory.triggerVersionChange(STATE_DB_NAME);
  let err = null;
  try { await s.router.get(STATE_KEY); } catch (e) { err = e; }
  assert(err, "get after versionchange must fail");
  eq(err.code, "storage_unavailable");
});

// ---------------------------------------------------------------- G14 full-size drain over IDB (T7 at Node level)
row("G14", "full-size: migration then content drain 12->18 lands ~8.28M chars in IDB; preservation inventory holds; legacy frozen", async () => {
  const factory = createFakeIndexedDB();
  const ctx = freshLegacy();
  const seedRaw = ctx.raw.getRaw(STATE_KEY);
  const s = session(factory, ctx);
  await migrate(factory, ctx, s);
  const changes = pageChanges();
  let contentPulls = 0;
  const transport = {
    async pullChanges(family, cursor) {
      if (family === "content") { contentPulls += 1; const cs = changes.filter((c) => c.seq > cursor); return { family, changes: cs, nextSeq: cs.length ? cs[cs.length - 1].seq : cursor, highWatermark: 18 }; }
      return { family, changes: [], nextSeq: cursor, highWatermark: 1799 };
    },
    async getSyncStatus() { return { content: { highWatermark: 18 }, bindings: { highWatermark: 1799 } }; },
  };
  const store = STORE.createClientStore({ deviceId: DEVICE_ID, storage: s.router, transport });
  const drain = await store.syncFamilyDrain("content");
  eq(drain.complete, true, "drain completes at full size over IDB");
  eq(drain.cursor, 18);
  const idbRaw = await s.idb.getRaw(STATE_KEY);
  assert(idbRaw.length > 8000000 && idbRaw.length < 8600000, `IDB record is the full enriched size (got ${idbRaw.length})`);
  eq(ctx.raw.getRaw(STATE_KEY), seedRaw, "legacy snapshot byte-identical after the drain");
  const rec = JSON.parse(idbRaw);
  const counts = SS.recordInvariantCounts(rec);
  eq(counts.families.content.cursor, 18); eq(counts.families.content.entities, 7);
  eq(counts.families.bindings.entities, 1799, "bindings inventory preserved through migration + drain");
  eq(counts.outboxLength, 2, "outbox preserved (never re-executed by migration)");
  eq(counts.journals["book-fh"], 2, "journal preserved");
  eq(counts.commandCounter, 41, "commandCounter preserved");
  assert(contentPulls >= 1, "content pulled from cursor 12 only");
});

// ---------------------------------------------------------------- G15 quota classification on legacy path (T8 at Node level)
row("G15", "forced legacy path with real quota cap: drain classifies storage_quota_exceeded, never network_error; diag allowlist-clean", async () => {
  const cap = 5000000;
  const backing = new Map();
  const storageLike = {
    getItem: (k) => (backing.has(k) ? backing.get(k) : null),
    setItem: (k, v) => { const s = String(v); if (s.length > cap) throw namedError("QuotaExceededError", 22); backing.set(k, s); },
    removeItem: (k) => backing.delete(k),
  };
  const legacy = SA.createBrowserStorage(storageLike);
  storageLike.setItem(STATE_KEY, seedRecordRaw());
  globalThis.indexedDB = createFakeIndexedDB();
  const idb = SS.createIndexedDbStorage({});
  const router = SS.createStateRoutingStorage({ idb, legacy }); // no migration: pre-cutover legacy path
  const changes = pageChanges();
  const diags = [];
  const transport = {
    async pullChanges(family, cursor) {
      if (family === "content") { const cs = changes.filter((c) => c.seq > cursor); return { family, changes: cs, nextSeq: cs.length ? cs[cs.length - 1].seq : cursor, highWatermark: 18 }; }
      return { family, changes: [], nextSeq: cursor, highWatermark: 1799 };
    },
    async getSyncStatus() { return { content: { highWatermark: 18 }, bindings: { highWatermark: 1799 } }; },
  };
  const store = STORE.createClientStore({ deviceId: DEVICE_ID, storage: router, transport, onStageError: (d) => diags.push(d) });
  const drain = await store.syncFamilyDrain("content");
  eq(drain.complete, false);
  eq(drain.reason, "storage_quota_exceeded", "the G7 mislabel is fixed: quota is named, not network_error");
  eq(drain.cursor, 12, "cursor did not advance past the failed apply");
  const persisted = (await router.get(STATE_KEY)).drainStatus.content;
  eq(persisted.reason, "storage_quota_exceeded", "the persisted drain status (what Diagnostics reads) carries the class");
  assert(persisted.diag, "drain status carries the classified diagnostic");
  for (const k of Object.keys(persisted.diag)) assert(ALLOWLIST.has(k), `diag field ${k} is outside the §3.3 allowlist`);
  eq(persisted.diag.class, "storage_quota_exceeded");
  assert(persisted.diag.recordChars > 8000000, `attempted record size reported (got ${persisted.diag.recordChars})`);
  eq(diags.length, 1, "onStageError hook fired once");
  eq(diags[0].class, "storage_quota_exceeded");
});

// ---------------------------------------------------------------- G16 transport failure stays network_error
row("G16", "transport failure still classifies network_error with stage transport", async () => {
  const storage = SA.createBrowserStorage(SA.createStorageLike());
  await storage.set(STATE_KEY, JSON.parse(seedRecordRaw()));
  const diags = [];
  const transport = { async pullChanges() { throw new Error("socket closed"); }, async getSyncStatus() { return { content: { highWatermark: 18 } }; } };
  const store = STORE.createClientStore({ deviceId: DEVICE_ID, storage, transport, onStageError: (d) => diags.push(d) });
  const drain = await store.syncFamilyDrain("content");
  eq(drain.complete, false); eq(drain.reason, "network_error");
  const persisted = (await storage.get(STATE_KEY)).drainStatus.content;
  eq(persisted.diag.stage, "transport"); eq(persisted.diag.class, "network_error");
});

// ---------------------------------------------------------------- G17 epoch guard + two writers (Rowan a)
row("G17", "single-writer epoch guard holds at the async IDB commit; concurrent writers never tear the record", async () => {
  const factory = createFakeIndexedDB();
  const ctx = freshLegacy();
  const s = session(factory, ctx);
  await migrate(factory, ctx, s);
  const before = await s.idb.getRaw(STATE_KEY);
  const epoch = { v: 1 };
  const boundary = {
    assertStorageMutation() {},
    captureEpoch: () => epoch.v,
    assertEpoch(e) { if (e !== epoch.v) { const err = new Error("epoch lost"); err.code = "ownership_epoch_lost"; throw err; } },
  };
  const gated = SA.createOwnershipGatedStorage({ storage: s.router, boundary });
  s.idb.setDelay(40);
  const pending = gated.set(STATE_KEY, { deviceId: DEVICE_ID, epochTest: true });
  setTimeout(() => { epoch.v = 2; }, 10); // ownership lost mid-flight
  let err = null;
  try { await pending; } catch (e) { err = e; }
  assert(err && err.code === "ownership_epoch_lost", "guard refusal propagates unlabelled");
  eq(await s.idb.getRaw(STATE_KEY), before, "guard stopped the commit: nothing landed");
  s.idb.setDelay(0);
  // two adapters, one database: interleaved commits stay whole
  globalThis.indexedDB = factory;
  const a = SS.createIndexedDbStorage({});
  const b = SS.createIndexedDbStorage({});
  await Promise.all([a.set(STATE_KEY, { writer: "a" }), b.set(STATE_KEY, { writer: "b" })]);
  const final = JSON.parse(await a.getRaw(STATE_KEY));
  assert(final.writer === "a" || final.writer === "b", "final record is one writer's whole value");
});

// ---------------------------------------------------------------- G18 guard tamper detection (Rowan f)
row("G18", "hash guard detects a post-cutover prefs change; shelf count still reported", async () => {
  const factory = createFakeIndexedDB();
  const ctx = freshLegacy();
  const s = session(factory, ctx);
  const health = await migrate(factory, ctx, s);
  ctx.raw.setRaw(UI_PREFS_KEY, JSON.stringify({ theme: "dark" }));
  const guard = await health.verifyGuard();
  eq(guard.applicable, true); eq(guard.prefsMatch, false, "prefs divergence detected");
  eq(guard.shelfMatch, true); eq(guard.shelfPending, 7);
});

// ---------------------------------------------------------------- G19 serialization classification
row("G19", "cyclic record on the legacy path classifies storage_serialization_failed", async () => {
  const factory = createFakeIndexedDB();
  const ctx = freshLegacy(false);
  const s = session(factory, ctx);
  const cyclic = { a: 1 }; cyclic.self = cyclic;
  let err = null;
  try { await s.router.set(STATE_KEY, cyclic); } catch (e) { err = e; }
  assert(err, "cyclic set must reject");
  eq(err.code, "storage_serialization_failed");
});

// ---------------------------------------------------------------- runner
let failures = 0;
for (const r of rows) {
  try { await r.fn(); console.log(`PASS ${r.id} ${r.name}`); }
  catch (e) { failures += 1; console.log(`FAIL ${r.id} ${r.name} :: ${e.message}`); }
}
console.log(`g7-suite tree=${TREE}: ${rows.length - failures}/${rows.length} passed`);
process.exit(failures ? 1 : 0);
