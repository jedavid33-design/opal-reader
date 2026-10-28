// Candidate-owned storage adapters.
//
// createAsyncStorage: async adapter over a Map (test harness). One
// key's set is atomic, matching the client-store contract. Its set()
// accepts an optional `guard` callback invoked IMMEDIATELY BEFORE the
// backing write commits (after any configured delay/failure seam): if
// the guard throws, the write never lands. The ownership boundary uses
// this to re-check the ownership epoch at write time (B2).
//
// createBrowserStorage (B5): the persistent adapter for the runnable
// browser composition. It wraps a Storage-like object (getItem /
// setItem / removeItem — e.g. window.localStorage) with REAL browser
// storage semantics: values are string-serialized (JSON), reads/writes
// are async from the caller's perspective, and no Map methods are used
// anywhere. It exposes the same delay/failure seams as the test
// adapter so ownership-loss-during-write can be exercised against it,
// and the same at-commit guard contract.
//
// Gated wrappers: createOwnershipGatedStorage /
// createOwnershipGatedShellStorage put EVERY set/removeItem of the
// wrapped adapter behind a boundary object
// { captureEpoch(), assertEpoch(epoch), assertMutation() }.
// Reads pass through; writes capture the epoch at call start and
// re-assert it at commit time via the adapter guard hook.
// Follow-up 3: when the boundary also exposes
// assertStorageMutation() (the composition's does), storage writes
// assert THAT instead of assertMutation(): it is the bookkeeping
// tier, which during a lifecycle drain admits only writes belonging
// to operations admitted before close-start — never new work, whose
// entry points assert assertMutation()/assertAdmission() themselves.
//
// SUPPORTED ADAPTERS ONLY (follow-up correction 4): the gated wrapper
// accepts ONLY adapters implementing the at-commit guard contract
// (supportsCommitGuard === true, with set/delete accepting a guard).
// An adapter without a commit guard is REFUSED at construction
// (unsupported_storage_adapter, fail closed). There is deliberately
// NO check-before/check-after fallback with a compensating restore:
// a restore after ownership loss can overwrite the new owner's state,
// and the unguarded delete branch had no epoch protection at all —
// best-effort restoration is not the single-writer guarantee.
export function createAsyncStorage(backing = new Map()) {
  let failNext = false; let delayMs = 0;
  const clone = (v) => (v === undefined ? undefined : structuredClone(v));
  return {
    backing,
    kind: "map-test-adapter",
    supportsCommitGuard: true,
    setFailureOnce() { failNext = true; },
    setDelay(ms) { delayMs = ms; },
    async get(key) { if (delayMs) await new Promise(r=>setTimeout(r,delayMs)); return clone(backing.get(key)); },
    async set(key, value, guard) {
      if (delayMs) await new Promise(r=>setTimeout(r,delayMs));
      if (failNext) { failNext = false; const e = new Error("storage_set_failed"); e.code="storage_set_failed"; throw e; }
      if (guard) guard(); // at-commit ownership re-check: throws -> nothing lands
      backing.set(key, clone(value));
    },
    async delete(key, guard) {
      if (delayMs) await new Promise(r=>setTimeout(r,delayMs));
      if (guard) guard();
      backing.delete(key);
    },
  };
}

export function createBrowserStorage(storageLike) {
  if (!storageLike || typeof storageLike.getItem !== "function" || typeof storageLike.setItem !== "function" || typeof storageLike.removeItem !== "function") {
    const e = new Error("browser_storage_required"); e.code = "browser_storage_required"; throw e;
  }
  let failNext = false; let delayMs = 0;
  const tick = async () => { if (delayMs) await new Promise(r=>setTimeout(r,delayMs)); };
  return {
    storage: storageLike,
    kind: "browser-storage-adapter",
    supportsCommitGuard: true,
    setFailureOnce() { failNext = true; },
    setDelay(ms) { delayMs = ms; },
    async get(key) {
      await tick();
      const raw = storageLike.getItem(key);
      if (raw === null || raw === undefined) return undefined;
      return JSON.parse(raw);
    },
    async set(key, value, guard) {
      await tick();
      if (failNext) { failNext = false; const e = new Error("storage_set_failed"); e.code="storage_set_failed"; throw e; }
      if (guard) guard(); // at-commit ownership re-check: throws -> nothing lands
      storageLike.setItem(key, JSON.stringify(value === undefined ? null : value));
    },
    async delete(key, guard) {
      await tick();
      if (guard) guard();
      storageLike.removeItem(key);
    },
  };
}

export function createShellStorage(backing = new Map()) {
  return {
    backing,
    getItem: (k) => (backing.has(k) ? backing.get(k) : null),
    setItem: (k,v) => { backing.set(k,String(v)); },
    removeItem: (k) => { backing.delete(k); },
  };
}

// A Storage-like (localStorage-shaped) object backed by a Map, for
// exercising the BROWSER adapter in Node without a Map-backed client
// adapter anywhere in the path.
export function createStorageLike(backing = new Map()) {
  return {
    backing,
    getItem: (k) => (backing.has(k) ? backing.get(k) : null),
    setItem: (k,v) => { backing.set(k,String(v)); },
    removeItem: (k) => { backing.delete(k); },
  };
}

export function createOwnershipGatedStorage({ storage, boundary }) {
  if (!storage) { const e = new Error("storage_required"); e.code = "storage_required"; throw e; }
  if (!boundary) { const e = new Error("owner_required"); e.code = "owner_required"; throw e; }
  // Fail closed: only adapters with the at-commit guard contract are
  // supported. Refusing here means a composition over a foreign
  // adapter never starts, rather than degrading the single-writer
  // guarantee to best-effort restoration.
  if (storage.supportsCommitGuard !== true || typeof storage.set !== "function" || typeof storage.delete !== "function") {
    const e = new Error("unsupported_storage_adapter"); e.code = "unsupported_storage_adapter"; throw e;
  }
  return {
    kind: "ownership-gated-storage",
    supportsCommitGuard: true,
    get backing() { return storage.backing; },
    setDelay: storage.setDelay ? (ms) => storage.setDelay(ms) : undefined,
    setFailureOnce: storage.setFailureOnce ? () => storage.setFailureOnce() : undefined,
    async get(key) { return storage.get(key); }, // reads are not mutations
    async set(key, value, outerGuard) {
      // Bookkeeping tier when the boundary provides it (follow-up 3);
      // boundaries without it keep the original assertMutation tier.
      if (typeof boundary.assertStorageMutation === "function") boundary.assertStorageMutation();
      else boundary.assertMutation(); // owner (+ write-enable) at call start
      const epoch = boundary.captureEpoch();
      const guard = () => { boundary.assertEpoch(epoch); if (outerGuard) outerGuard(); };
      return storage.set(key, value, guard);
    },
    async delete(key, outerGuard) {
      if (typeof boundary.assertStorageMutation === "function") boundary.assertStorageMutation();
      else boundary.assertMutation();
      const epoch = boundary.captureEpoch();
      const guard = () => { boundary.assertEpoch(epoch); if (outerGuard) outerGuard(); };
      return storage.delete(key, guard);
    },
  };
}

export function createOwnershipGatedShellStorage({ shellStorage, boundary, tier = "owner" }) {
  if (!shellStorage) { const e = new Error("shell_storage_required"); e.code = "shell_storage_required"; throw e; }
  if (!boundary) { const e = new Error("owner_required"); e.code = "owner_required"; throw e; }
  const check = tier === "owner"
    ? () => boundary.assertOwnerTier()
    : () => boundary.assertMutation();
  return {
    get backing() { return shellStorage.backing; },
    getItem: (k) => shellStorage.getItem(k), // read
    setItem: (k, v) => { check(); shellStorage.setItem(k, v); },
    removeItem: (k) => { check(); shellStorage.removeItem(k); },
  };
}
