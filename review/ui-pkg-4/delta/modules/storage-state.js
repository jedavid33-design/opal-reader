// Opal Reader v2 — G7 storage-state module (ui-pkg-4 candidate).
//
// Implements the G7 storage design (review/g7-storage-design.md,
// Rowan DESIGN PASS WITH CONDITIONS, board comment 6506670300):
//
//  - classifyStorageError: the closed, privacy-safe failure taxonomy
//    of design section 3.2. Storage failures are never again
//    labelled network_error; that class is reserved for the
//    transport stage alone.
//  - createIndexedDbStorage: an IndexedDB adapter honouring the
//    exact storage contract the store already consumes (async
//    get/set/delete of ONE record, at-commit guard invoked
//    immediately before the write commits, supportsCommitGuard).
//    The record is stored as its JSON STRING (design 5.3): byte
//    equality is the migration's verification primitive.
//  - createStateRoutingStorage: dispatch by EXACT key equality.
//    Only cs:state:v1 can ever reach IndexedDB, and only after
//    cutover; every other key — cs:shelf-bridge:v1 (the frozen
//    Shelf bridge record), the deviceId slot, UI prefs — flows
//    through the existing localStorage adapter unchanged.
//  - runStorageMigration: the S0-S6 state machine of design 5.4,
//    plus the 5.5 boot agreement check and legacy-writer tripwire.
//    The legacy record is NEVER modified or deleted by migration;
//    retirement is a separate, later, Julie-authorized step that
//    this package does not implement.
//  - readStateRecordFromBackend: the marker-aware raw read the
//    shell's state snapshot uses before a client exists (design
//    5.6). After Connect, the snapshot comes from the runnable's
//    routed storage instead.
//
// Diagnostic records produced here carry ONLY the closed allowlist
// of design 3.3 (op/family/stage/class, error name/code, cursors,
// sizes, backend, timestamps, build). Never record bodies, titles,
// queue ids, or tokens.
import {
  STATE_KEY, SHELF_KEY, SHELL_DEVICE_ID_KEY, UI_PREFS_KEY,
  STATE_BACKEND_MARKER_KEY, STATE_META_KEY,
  STATE_DB_NAME, STATE_DB_VERSION, STATE_DB_STORE,
  CANDIDATE_BUILD_MARKER,
} from "./constants-ui4.js";

export const STORAGE_CLASSES = [
  "storage_quota_exceeded",
  "storage_unavailable",
  "storage_serialization_failed",
  "storage_write_failed",
  "network_error",
  "apply_failed",
];
const CLASS_SET = new Set(STORAGE_CLASSES);

// Map a caught error to the closed taxonomy (design 3.2). Matching
// is by err.name first, then legacy err.code — never by message
// text (except the cyclic-structure TypeError, whose class of
// failure is only distinguishable that way). Returns null for
// errors that are not storage/transport failures at all (e.g. the
// ownership guard's refusals): those propagate unlabelled, exactly
// as before.
export function classifyStorageError(err, stage) {
  if (!err) return null;
  // The ownership gate's refusals are control flow, not storage
  // failures: never classified, never re-labelled (the gated
  // storage contract depends on their codes surviving intact).
  if (typeof err.code === "string" && (err.code.startsWith("ownership_") || err.code === "storage_write_in_progress")) return null;
  if (typeof err.code === "string" && CLASS_SET.has(err.code)) return err.code;
  const name = err.name || "";
  const code = err.code;
  if (name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED" || code === 22 || code === 1014)
    return "storage_quota_exceeded";
  if (name === "SecurityError" || name === "InvalidStateError" || name === "UnknownError" || name === "VersionError"
      || code === "browser_storage_required")
    return "storage_unavailable";
  if (name === "SyntaxError") return "storage_serialization_failed";
  if ((name === "TypeError" && /cycl|circular/i.test(err.message || "")) || name === "RangeError")
    return "storage_serialization_failed";
  if (code === "storage_set_failed") return "storage_write_failed";
  if (stage === "transport") return "network_error";
  if (typeof stage === "string" && stage.startsWith("storage")) return "storage_write_failed";
  return null;
}

// Wrap an error with a taxonomy class WITHOUT mutating the original
// (DOMException properties are read-only; modules are strict mode).
function tagError(err, cls, diag) {
  const e = new Error(err?.message || cls);
  e.name = err?.name || "Error";
  e.code = cls;
  if (diag) e.diag = diag;
  e.cause = err;
  return e;
}

function diagOf(err, stage, extra = {}) {
  const cls = classifyStorageError(err, stage);
  if (!cls) return null;
  return {
    class: cls, stage,
    errorName: err?.name ?? null,
    errorCode: typeof err?.code === "number" ? err.code : null,
    ...extra,
  };
}

const safeJsonLength = (v) => {
  try { const s = JSON.stringify(v); return typeof s === "string" ? s.length : null; }
  catch { return null; }
};

export async function sha256Hex(text) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle?.digest) {
    const e = new Error("crypto_subtle_unavailable"); e.code = "storage_unavailable"; throw e;
  }
  const buf = await subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Field-level invariant counts for a state record (design 5.4/S4 +
// section 8): the preservation checklist, computed identically on
// the source and on the read-back so equality is meaningful.
export function recordInvariantCounts(rec) {
  const counts = {
    deviceId: rec?.deviceId ?? null,
    commandCounter: rec?.commandCounter ?? 0,
    outboxLength: Array.isArray(rec?.outbox) ? rec.outbox.length : 0,
    outboxStatus: {},
    journals: {},
    journalCounters: rec?.journalCounters ?? {},
    families: {},
    bytesCount: rec?.bytes && typeof rec.bytes === "object" ? Object.keys(rec.bytes).length : 0,
  };
  for (const e of Array.isArray(rec?.outbox) ? rec.outbox : []) {
    const k = e?.status ?? "unknown";
    counts.outboxStatus[k] = (counts.outboxStatus[k] ?? 0) + 1;
  }
  for (const [b, evs] of Object.entries(rec?.journals ?? {}))
    counts.journals[b] = Array.isArray(evs) ? evs.length : 0;
  for (const [fam, c] of Object.entries(rec?.caches ?? {}))
    counts.families[fam] = {
      floor: c?.floor ?? 0, tip: c?.tip ?? 0, cursor: c?.cursor ?? 0,
      entities: c?.entities ? Object.keys(c.entities).length : 0,
      tombstones: c?.tombstones ? Object.keys(c.tombstones).length : 0,
    };
  return counts;
}
export const countsEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---------------------------------------------------------- IDB adapter
// One database, one object store, one row per key: {key, value}
// with value the JSON string. set() is ONE readwrite transaction;
// the at-commit guard runs immediately before the first put — if
// it throws, the transaction aborts and nothing lands (the IDB
// analogue of the localStorage adapter's pre-setItem guard, so the
// ownership epoch guarantee survives the backend swap: Rowan
// condition (a)).
export function createIndexedDbStorage({
  dbName = STATE_DB_NAME, dbVersion = STATE_DB_VERSION, storeName = STATE_DB_STORE,
  factory, openTimeoutMs = 2500,
} = {}) {
  const idbFactory = factory ?? (typeof globalThis !== "undefined" ? globalThis.indexedDB : undefined);
  let db = null;
  let dbPromise = null;
  let versionChanged = false;
  let failNext = false;
  let delayMs = 0;
  let lastDiag = null;
  const tick = async () => { if (delayMs) await new Promise((r) => setTimeout(r, delayMs)); };
  const unavailable = (msg) => { const e = new Error(msg); e.code = "storage_unavailable"; return e; };

  async function open() {
    if (db) return db;
    if (versionChanged) throw unavailable("indexeddb_version_changed");
    if (!idbFactory || typeof idbFactory.open !== "function") throw unavailable("indexeddb_unavailable");
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        let settled = false;
        let req;
        try { req = idbFactory.open(dbName, dbVersion); }
        catch (e) { reject(tagError(e, classifyStorageError(e, "storage_open") ?? "storage_unavailable")); return; }
        const timer = setTimeout(() => {
          if (!settled) { settled = true; reject(unavailable("indexeddb_open_blocked_timeout")); }
        }, openTimeoutMs);
        req.onupgradeneeded = () => {
          const d = req.result;
          if (d && !d.objectStoreNames.contains(storeName)) d.createObjectStore(storeName, { keyPath: "key" });
        };
        req.onsuccess = () => {
          if (settled) { try { req.result?.close?.(); } catch {} return; }
          settled = true; clearTimeout(timer);
          db = req.result;
          if (db) db.onversionchange = () => {
            // Another context wants a version change: close and
            // surface storage_unavailable rather than fighting the
            // upgrade (design 5.3).
            versionChanged = true;
            try { db.close(); } catch {}
            db = null; dbPromise = null;
          };
          resolve(db);
        };
        req.onerror = () => {
          if (settled) return;
          settled = true; clearTimeout(timer);
          reject(tagError(req.error ?? new Error("indexeddb_open_failed"),
            classifyStorageError(req.error, "storage_open") ?? "storage_unavailable"));
        };
        req.onblocked = () => { /* bounded wait: the timeout above rejects */ };
      }).catch((e) => { dbPromise = null; throw e; });
    }
    return dbPromise;
  }

  // Run one transaction. body(store, setValue, fail) issues the
  // requests; the promise resolves on tx.oncomplete (atomic commit)
  // and rejects — classified — on error/abort. A body throw (the
  // at-commit guard) aborts the transaction and propagates AS-IS:
  // guard refusals are ownership semantics, never reclassified.
  async function runTx(mode, body) {
    const d = await open();
    return new Promise((resolve, reject) => {
      let settled = false;
      let value;
      const done = () => { if (!settled) { settled = true; resolve(value); } };
      const failRaw = (e) => { if (!settled) { settled = true; reject(e); } };
      const failClassified = (e, stage) => {
        const cls = classifyStorageError(e, stage);
        failRaw(cls ? tagError(e, cls) : e);
      };
      let t;
      try { t = d.transaction(storeName, mode); }
      catch (e) { failClassified(e, "storage_open"); return; }
      t.oncomplete = done;
      t.onerror = () => failClassified(t.error ?? new Error("transaction_error"), "storage_write");
      t.onabort = () => failClassified(t.error ?? new Error("transaction_aborted"), "storage_write");
      try {
        body(t.objectStore(storeName),
          (v) => { value = v; },
          (e) => { try { t.abort(); } catch {} failRaw(e); });
      } catch (e) {
        try { t.abort(); } catch {}
        failRaw(e);
      }
    });
  }

  async function getRaw(key) {
    await tick();
    return runTx("readonly", (store, set, fail) => {
      const r = store.get(key);
      r.onsuccess = () => set(r.result ? r.result.value : undefined);
      r.onerror = () => fail(r.error ?? new Error("idb_get_failed"));
    });
  }

  async function setEntries(entries, guard) {
    await tick();
    if (failNext) {
      failNext = false;
      const e = new Error("storage_set_failed"); e.code = "storage_set_failed"; throw e;
    }
    return runTx("readwrite", (store, _set, fail) => {
      if (guard) guard(); // at-commit ownership re-check: throws -> abort, nothing lands
      for (const { key, value } of entries) {
        const r = store.put({ key, value });
        r.onerror = () => fail(r.error ?? new Error("idb_put_failed"));
      }
    });
  }

  async function deleteEntries(keys, guard) {
    await tick();
    return runTx("readwrite", (store, _set, fail) => {
      if (guard) guard();
      for (const key of keys) {
        const r = store.delete(key);
        r.onerror = () => fail(r.error ?? new Error("idb_delete_failed"));
      }
    });
  }

  return {
    kind: "indexeddb-storage-adapter",
    supportsCommitGuard: true,
    setFailureOnce() { failNext = true; },
    setDelay(ms) { delayMs = ms; },
    open, getRaw, setEntries, deleteEntries,
    async get(key) {
      const raw = await getRaw(key);
      if (raw === undefined) return undefined;
      try { return JSON.parse(raw); }
      catch (e) { throw tagError(e, "storage_serialization_failed"); }
    },
    async set(key, value, guard) {
      let raw;
      try { raw = JSON.stringify(value === undefined ? null : value); }
      catch (e) {
        const cls = classifyStorageError(e, "storage_write") ?? "storage_serialization_failed";
        lastDiag = diagOf(e, "storage_write");
        throw tagError(e, cls);
      }
      try { return await setEntries([{ key, value: raw }], guard); }
      catch (e) {
        if (classifyStorageError(e, "storage_write")) {
          lastDiag = diagOf(e, "storage_write", { attemptedChars: raw.length, recordChars: raw.length });
          if (!e.diag) e.diag = lastDiag;
        }
        throw e;
      }
    },
    async delete(key, guard) { return deleteEntries([key], guard); },
    close() { try { db?.close?.(); } catch {} db = null; dbPromise = null; },
    async reopen() { this.close(); return open(); },
    storageHealth() { return { backend: "indexeddb", lastDiag }; },
  };
}

// ---------------------------------------------------------- routing adapter
// Exact-key dispatch (design 5.2). Before cutover even the state
// key goes to legacy (migration drives IDB explicitly, never
// through the router). After cutover there is NO path back: no
// flag or error branch re-enables legacy writes to the state key.
export function createStateRoutingStorage({ idb, legacy, stateKey = STATE_KEY } = {}) {
  if (!idb || !legacy) { const e = new Error("routing_adapters_required"); e.code = "routing_adapters_required"; throw e; }
  let cutover = false;
  let lastDiag = null;
  const isState = (k) => k === stateKey;
  function wrap(e, stage, value) {
    const cls = classifyStorageError(e, stage);
    if (!cls) return e; // ownership guard refusals and foreign errors pass through untouched
    const diag = diagOf(e, stage);
    if (diag && value !== undefined) {
      const len = safeJsonLength(value);
      if (len !== null) { diag.attemptedChars = len; diag.recordChars = len; }
    }
    lastDiag = diag;
    return tagError(e, cls, diag);
  }
  return {
    kind: "state-routing-storage",
    supportsCommitGuard: true,
    get backing() { return legacy.backing; },
    setFailureOnce() { legacy.setFailureOnce?.(); idb.setFailureOnce?.(); },
    setDelay(ms) { legacy.setDelay?.(ms); idb.setDelay?.(ms); },
    setCutover(v) { cutover = !!v; },
    isCutover: () => cutover,
    async get(key) {
      if (!isState(key)) return legacy.get(key);
      try { return await (cutover ? idb : legacy).get(key); }
      catch (e) { throw wrap(e, "storage_read"); }
    },
    async set(key, value, guard) {
      if (!isState(key)) return legacy.set(key, value, guard);
      try { return await (cutover ? idb : legacy).set(key, value, guard); }
      catch (e) { throw wrap(e, "storage_write", value); }
    },
    async delete(key, guard) {
      if (!isState(key)) return legacy.delete(key, guard);
      try { return await (cutover ? idb : legacy).delete(key, guard); }
      catch (e) { throw wrap(e, "storage_write"); }
    },
    storageHealth() { return { backend: cutover ? "indexeddb" : "localstorage", lastDiag }; },
  };
}

// ---------------------------------------------------------- migration
function countShelfPending(raw) {
  try { const r = JSON.parse(raw || "null"); return Array.isArray(r?.outbox) ? r.outbox.length : 0; }
  catch { return 0; }
}

// The S0-S6 machine (design 5.4) + the 5.5 boot agreement check.
// Runs under the caller's single-writer lock, before the candidate
// is constructed. Stop conditions THROW with a stable .code
// (legacy_writer_detected / storage_unavailable /
// device_id_mismatch / storage_serialization_failed): fail closed,
// never guess. Non-stop failures (IDB open refused pre-cutover,
// verify mismatch, marker-write failure) return a legacy-mode
// health object: the client runs on legacy exactly as today and
// migration retries next launch — legacy is authoritative until
// the marker lands.
export async function runStorageMigration({
  legacy, idb, router, rawAccess,
  build = CANDIDATE_BUILD_MARKER, now = () => new Date(),
} = {}) {
  if (!idb || !router || !rawAccess) { const e = new Error("migration_arguments_required"); e.code = "migration_arguments_required"; throw e; }
  const at = () => now().toISOString();
  const health = {
    backend: "localstorage", state: "S0", migratedAt: null, sourceChars: null,
    lastDiag: null, markerWriteFailed: false, verifyGuard: async () => ({ applicable: false }),
    estimate: null, persist: null,
  };
  const stop = (code, message, diag) => {
    const e = new Error(message || code); e.code = code; if (diag) e.diag = diag; return e;
  };
  async function guardBaseline() {
    const shelfRaw = rawAccess.getRaw(SHELF_KEY);
    const prefsRaw = rawAccess.getRaw(UI_PREFS_KEY);
    return {
      shelf: shelfRaw == null ? "absent" : await sha256Hex(shelfRaw),
      prefs: prefsRaw == null ? "absent" : await sha256Hex(prefsRaw),
      shelfPending: countShelfPending(shelfRaw),
    };
  }
  async function verifyGuard(meta) {
    if (!meta?.guard) return { applicable: false };
    const nowG = await guardBaseline();
    return {
      applicable: true,
      shelfMatch: nowG.shelf === meta.guard.shelf,
      prefsMatch: nowG.prefs === meta.guard.prefs,
      shelfPending: nowG.shelfPending,
    };
  }
  async function platformInfo() {
    try {
      const st = typeof navigator !== "undefined" ? navigator.storage : undefined;
      if (st?.estimate) { const est = await st.estimate(); health.estimate = { usage: est.usage ?? null, quota: est.quota ?? null }; }
      if (st?.persist) health.persist = await st.persist();
    } catch { /* best-effort diagnostics only (design 5.3) */ }
  }
  async function cutover(meta) {
    const markerObj = { backend: "indexeddb", version: 1, stateSha256: meta.stateSha256, at: at() };
    try { rawAccess.setRaw(STATE_BACKEND_MARKER_KEY, JSON.stringify(markerObj)); }
    catch (e) {
      // Marker-write failure: no flip. The IDB rows stay as a
      // resumable S3/S4 remnant; next boot re-verifies and retries
      // the marker. Legacy remains authoritative and untouched.
      health.lastDiag = diagOf(e, "storage_write");
      health.markerWriteFailed = true;
      return health;
    }
    router.setCutover(true);
    health.backend = "indexeddb";
    health.state = "S6";
    health.migratedAt = meta.migratedAt ?? null;
    health.sourceChars = meta.sourceChars ?? null;
    health.verifyGuard = () => verifyGuard(meta);
    await platformInfo();
    return health;
  }
  async function verifyWritten(meta, sourceRaw, sourceParsed) {
    try {
      await idb.reopen(); // fresh connection for the read-back (design S4)
      const back = await idb.getRaw(STATE_KEY);
      if (back !== sourceRaw) return false;
      if ((await sha256Hex(back)) !== meta.stateSha256) return false;
      const backParsed = JSON.parse(back);
      return countsEqual(recordInvariantCounts(sourceParsed), recordInvariantCounts(backParsed));
    } catch { return false; }
  }

  // ---- marker present: boot agreement check (design 5.5) ----
  const markerRaw = rawAccess.getRaw(STATE_BACKEND_MARKER_KEY);
  if (markerRaw != null) {
    let marker;
    try { marker = JSON.parse(markerRaw); }
    catch { throw stop("storage_unavailable", "state_backend_marker_unparseable"); }
    if (!marker || marker.backend !== "indexeddb" || marker.version !== 1)
      throw stop("storage_unavailable", "state_backend_marker_invalid");
    let metaRaw, idbStateRaw;
    try {
      metaRaw = await idb.getRaw(STATE_META_KEY);
      idbStateRaw = await idb.getRaw(STATE_KEY);
    } catch (e) {
      throw stop(classifyStorageError(e, "storage_open") ?? "storage_unavailable", "state_backend_unreadable", diagOf(e, "storage_open"));
    }
    if (metaRaw == null) throw stop("storage_unavailable", "state_meta_missing");
    let meta;
    try { meta = JSON.parse(metaRaw); }
    catch { throw stop("storage_unavailable", "state_meta_unparseable"); }
    if (meta.schema !== 1) throw stop("storage_unavailable", "state_meta_schema_mismatch");
    if (idbStateRaw != null) {
      try { JSON.parse(idbStateRaw); }
      catch { throw stop("storage_unavailable", "state_record_unparseable"); }
    }
    // Legacy-writer tripwire: the retained legacy snapshot must be
    // byte-identical to the migrated source. Any difference means
    // a legacy writer (an old-build tab) touched it after cutover:
    // stop-and-report, no merge, no replay; IDB stays authoritative
    // and untouched. Absence is the authorized-retirement posture
    // and is skipped gracefully.
    const legacyRaw = rawAccess.getRaw(STATE_KEY);
    if (legacyRaw != null && typeof meta.sourceSha256 === "string") {
      if ((await sha256Hex(legacyRaw)) !== meta.sourceSha256)
        throw stop("legacy_writer_detected", "legacy_state_record_changed_after_cutover");
    }
    router.setCutover(true);
    health.backend = "indexeddb";
    health.state = "S6";
    health.migratedAt = meta.migratedAt ?? null;
    health.sourceChars = meta.sourceChars ?? null;
    health.verifyGuard = () => verifyGuard(meta);
    await platformInfo();
    return health;
  }

  // ---- no marker: S1 (prepare). An IDB that will not open leaves
  // the client on legacy, truthful and capped (design S1). ----
  let existingMetaRaw = null;
  try { existingMetaRaw = await idb.getRaw(STATE_META_KEY); }
  catch (e) {
    health.lastDiag = diagOf(e, "storage_open");
    return health;
  }

  const sourceRaw = rawAccess.getRaw(STATE_KEY);

  // ---- crashed mid-S3/S4 (meta present, marker absent): resume
  // verification against the CURRENT legacy source. A mismatch
  // means the remnant is stale (e.g. a legacy writer moved first):
  // delete the two rows this machine wrote and restart clean. ----
  if (existingMetaRaw != null) {
    let resumed = false;
    try {
      const meta = JSON.parse(existingMetaRaw);
      const idbState = await idb.getRaw(STATE_KEY);
      if (sourceRaw != null && idbState === sourceRaw && meta.stateSha256 === (await sha256Hex(sourceRaw))) {
        const parsed = JSON.parse(sourceRaw);
        if (await verifyWritten(meta, sourceRaw, parsed)) {
          resumed = true;
          return await cutover(meta);
        }
      }
    } catch { resumed = false; }
    if (!resumed) {
      try { await idb.deleteEntries([STATE_KEY, STATE_META_KEY]); }
      catch (e) { health.lastDiag = diagOf(e, "storage_write"); return health; }
    }
  }

  // ---- fresh install: nothing to migrate (design S0). ----
  if (sourceRaw == null) {
    const meta = {
      schema: 1, migratedFrom: "none", sourceChars: 0, sourceSha256: null,
      stateSha256: null, migratedAt: at(), migratedByBuild: build,
      guard: await guardBaseline(),
    };
    try { await idb.setEntries([{ key: STATE_META_KEY, value: JSON.stringify(meta) }]); }
    catch (e) { health.lastDiag = diagOf(e, "storage_write"); return health; }
    return cutover(meta);
  }

  // ---- S2: source snapshot + validation. ----
  let parsed;
  try { parsed = JSON.parse(sourceRaw); }
  catch { throw stop("storage_serialization_failed", "legacy_state_record_unparseable"); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw stop("storage_serialization_failed", "legacy_state_record_not_an_object");
  const slot = rawAccess.getRaw(SHELL_DEVICE_ID_KEY);
  if (parsed.deviceId != null && slot != null && parsed.deviceId !== slot)
    throw stop("device_id_mismatch", "state_record_device_mismatch");
  const sourceSha256 = await sha256Hex(sourceRaw);
  const meta = {
    schema: 1, source: "localStorage", sourceChars: sourceRaw.length,
    sourceSha256, stateSha256: sourceSha256,
    migratedAt: at(), migratedByBuild: build,
    guard: await guardBaseline(),
  };

  // ---- S3: one atomic transaction, both rows. ----
  try {
    await idb.setEntries([
      { key: STATE_KEY, value: sourceRaw },
      { key: STATE_META_KEY, value: JSON.stringify(meta) },
    ]);
  } catch (e) {
    health.lastDiag = diagOf(e, "storage_write");
    return health;
  }

  // ---- S4: verify on a fresh connection; any mismatch aborts
  // losslessly (the only delete in the machine, of rows it just
  // wrote; legacy was never modified). ----
  if (!(await verifyWritten(meta, sourceRaw, parsed))) {
    try { await idb.deleteEntries([STATE_KEY, STATE_META_KEY]); } catch {}
    health.lastDiag = { class: "storage_write_failed", stage: "verify", errorName: null, errorCode: null };
    return health;
  }

  // ---- S5/S6: marker last, then steady state. ----
  return cutover(meta);
}

// Marker-aware raw read for the shell's pre-Connect snapshot
// (design 5.6): with no marker the legacy record is the record;
// with a marker the IDB row is. Errors read as "no record" here —
// the Connect path itself classifies and stops properly; this
// read only feeds pre-Connect rendering.
export async function readStateRecordFromBackend({ storageLike, factory, dbName } = {}) {
  if (!storageLike) return { record: null, backend: "localstorage" };
  const getRaw = (k) => { try { return storageLike.getItem(k); } catch { return null; } };
  if (getRaw(STATE_BACKEND_MARKER_KEY) == null) {
    const raw = getRaw(STATE_KEY);
    if (raw == null) return { record: null, backend: "localstorage" };
    try { return { record: JSON.parse(raw), backend: "localstorage" }; }
    catch { return { record: null, backend: "localstorage" }; }
  }
  const idb = createIndexedDbStorage({ factory, dbName });
  try {
    const rec = await idb.get(STATE_KEY);
    return { record: rec ?? null, backend: "indexeddb" };
  } catch { return { record: null, backend: "indexeddb" }; }
  finally { try { idb.close(); } catch {} }
}
