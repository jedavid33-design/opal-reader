// Minimal fake IndexedDB for the G7 Node suite. Implements ONLY
// the surface modules/storage-state.js uses: open (with upgrade),
// one object store with keyPath "key", get/put/delete requests,
// transactions that stage writes and apply them atomically on
// complete (abort discards), close, and onversionchange. Error
// injection flags let the suite drive the IDB failure battery:
//   factory.failOpenWith  — open request errors with this error
//   factory.blockOpen     — open never succeeds (fires onblocked)
//   factory.quotaOnPut    — put requests fail QuotaExceededError
//   factory.abortNextTx   — the next transaction aborts mid-flight
//   factory.evict(name)   — the database vanishes (eviction)
const later = (fn) => setTimeout(fn, 0);
const micro = (fn) => queueMicrotask(fn);

function namedError(name, code, message) {
  const e = new Error(message || name);
  e.name = name;
  if (code !== undefined) e.code = code;
  return e;
}

class FakeRequest {
  constructor() { this.result = undefined; this.error = null; this.onsuccess = null; this.onerror = null; this.onblocked = null; this.onupgradeneeded = null; }
}

class FakeObjectStore {
  constructor(tx) { this.tx = tx; }
  get(key) {
    const r = new FakeRequest();
    micro(() => {
      if (this.tx._aborted) { r.error = namedError("AbortError"); r.onerror?.(); return; }
      const staged = this.tx._staged.get(key);
      if (staged !== undefined) { r.result = staged.deleted ? undefined : staged.row; }
      else {
        const row = this.tx._storeData.get(key);
        r.result = row ? { ...row } : undefined;
      }
      r.onsuccess?.();
    });
    return r;
  }
  put(row) {
    const r = new FakeRequest();
    micro(() => {
      const f = this.tx._factory;
      if (f.quotaOnPut) {
        const err = namedError("QuotaExceededError", 22);
        r.error = err; this.tx.error = err; r.onerror?.(); return;
      }
      if (this.tx._aborted) { r.error = namedError("AbortError"); r.onerror?.(); return; }
      this.tx._staged.set(row.key, { row: { ...row } });
      r.result = row.key;
      r.onsuccess?.();
    });
    return r;
  }
  delete(key) {
    const r = new FakeRequest();
    micro(() => {
      if (this.tx._aborted) { r.error = namedError("AbortError"); r.onerror?.(); return; }
      this.tx._staged.set(key, { deleted: true });
      r.result = undefined;
      r.onsuccess?.();
    });
    return r;
  }
}

class FakeTransaction {
  constructor(factory, storeData, mode) {
    this._factory = factory;
    this._storeData = storeData;
    this.mode = mode;
    this.error = null;
    this._staged = new Map();
    this._aborted = false;
    this.oncomplete = null; this.onerror = null; this.onabort = null;
    later(() => {
      if (this._aborted) return;
      if (factory.abortNextTx) {
        factory.abortNextTx = false;
        this._aborted = true;
        this.error = namedError("AbortError");
        this.onabort?.();
        return;
      }
      for (const [k, v] of this._staged) {
        if (v.deleted) storeData.delete(k); else storeData.set(k, v.row);
      }
      this.oncomplete?.();
    });
  }
  objectStore(_name) { return new FakeObjectStore(this); }
  abort() {
    if (this._aborted) return;
    this._aborted = true;
    later(() => this.onabort?.());
  }
}

class FakeDB {
  constructor(factory, rec, name, version) {
    this._factory = factory;
    this._rec = rec;
    this.name = name;
    this.version = version;
    this.onversionchange = null;
    this._closed = false;
    const names = [...rec.stores.keys()];
    this.objectStoreNames = { _names: names, contains: (n) => names.includes(n) };
  }
  createObjectStore(name, _opts) {
    if (!this._rec.stores.has(name)) this._rec.stores.set(name, new Map());
    const names = [...this._rec.stores.keys()];
    this.objectStoreNames = { _names: names, contains: (n) => names.includes(n) };
    return {};
  }
  transaction(storeName, mode) {
    if (this._closed) throw namedError("InvalidStateError");
    if (!this._rec.stores.has(storeName)) this._rec.stores.set(storeName, new Map());
    return new FakeTransaction(this._factory, this._rec.stores.get(storeName), mode);
  }
  close() { this._closed = true; this._factory._connections.delete(this); }
}

export function createFakeIndexedDB() {
  const factory = {
    _dbs: new Map(),       // name -> {version, stores: Map}
    _connections: new Set(),
    failOpenWith: null,
    blockOpen: false,
    quotaOnPut: false,
    abortNextTx: false,
    open(name, version = 1) {
      const req = new FakeRequest();
      later(() => {
        if (factory.failOpenWith) { req.error = factory.failOpenWith; req.onerror?.(); return; }
        if (factory.blockOpen) { req.onblocked?.(); return; }
        let rec = factory._dbs.get(name);
        const isNew = !rec;
        if (isNew) { rec = { version, stores: new Map() }; factory._dbs.set(name, rec); }
        if (version < rec.version) { req.error = namedError("VersionError"); req.onerror?.(); return; }
        if (version > rec.version) {
          // version change: notify open connections, then block
          for (const c of [...factory._connections]) if (c.name === name) c.onversionchange?.();
          req.onblocked?.();
          return;
        }
        const db = new FakeDB(factory, rec, name, version);
        factory._connections.add(db);
        req.result = db;
        if (isNew) req.onupgradeneeded?.();
        req.onsuccess?.();
      });
      return req;
    },
    evict(name) { factory._dbs.delete(name); },
    has(name) { return factory._dbs.has(name); },
    // Test helper: simulate another context requesting a version
    // bump, which fires onversionchange on live connections.
    triggerVersionChange(name) {
      for (const c of [...factory._connections]) if (c.name === name) c.onversionchange?.();
    },
  };
  return factory;
}

export { namedError };
