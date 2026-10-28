// SAFEGUARD 2: single-writer ownership over ALL shared-storage mutations.
// Mechanism: an exclusive lock (Web Locks API shape). The lock itself --
// not a heartbeat -- is the mutual-exclusion proof: while one context
// holds the request callback open, a second request for the same name
// cannot enter its callback. If no lock manager is available, this
// module FAILS CLOSED: it never falls back to unowned writes. The
// in-process manager below implements the same exclusive semantics for
// the local Node harness (one shared manager = one shared lock space);
// it does NOT prove cross-tab behaviour in a real browser, and the
// candidate summary states that plainly.
//
// Repair pass (Rowan finding 1, B2): ownership is additionally carried
// by an EPOCH TOKEN. Every acquire/loss/release advances the epoch;
// every mutating operation captures the epoch when it starts, and the
// storage boundary re-checks the captured epoch AT WRITE TIME (inside
// the storage adapter, immediately before the backing write commits).
// Ownership therefore cannot be "released" out from under an in-flight
// async operation: if ownership is lost or released while the operation
// is awaiting a delayed storage write, the epoch check at commit time
// refuses and the write never lands. release() is draining: it refuses
// new mutations immediately (epoch advanced, isOwner false), waits for
// tracked in-flight mutations to settle, and only then frees the lock.
export function createMemoryLockManager() {
  const held = new Map(); // name -> {queue: []}
  return {
    kind: "memory-lock-manager (local harness only)",
    request(name, options, callback) {
      if (typeof options === "function") { callback = options; options = {}; }
      return new Promise((resolve, reject) => {
        const slot = held.get(name) ?? { busy:false, waiters:[] };
        held.set(name, slot);
        const attempt = () => {
          if (slot.busy) { slot.waiters.push(attempt); return; }
          slot.busy = true;
          Promise.resolve().then(() => callback({ name })).then(
            (v) => { slot.busy=false; slot.waiters.shift()?.(); resolve(v); },
            (e) => { slot.busy=false; slot.waiters.shift()?.(); reject(e); });
        };
        attempt();
      });
    },
  };
}
export function browserLockManager() {
  return globalThis.navigator?.locks ?? null;
}
export class SingleWriterOwner {
  constructor({ lockManager, name = "opalreader-v2-single-writer" } = {}) {
    this.lockManager = lockManager ?? null; this.name = name;
    this._owner = false; this._releaseGate = null; this._heldPromise = null; this.lostHandlers = [];
    this._epoch = 0; this._inflight = new Set(); this._releasePromise = null;
  }
  get isOwner() { return this._owner; }
  // The current ownership epoch. Mutations capture this when they start
  // and the storage boundary compares it at commit time.
  get epoch() { return this._epoch; }
  // Number of operations currently tracked as in-flight (runTracked /
  // guardMutation). The composition's lifecycle drain permit scopes
  // bookkeeping permission to exactly this set (follow-up 3).
  get inflightCount() { return this._inflight.size; }
  onLost(fn) { this.lostHandlers.push(fn); }
  _track(p) {
    this._inflight.add(p);
    const done = () => { this._inflight.delete(p); };
    p.then(done, done);
    return p;
  }
  // Run fn as a tracked in-flight mutation: release() drains these
  // before freeing the lock.
  async runTracked(fn) {
    this.assertOwner();
    const p = (async () => fn())();
    this._track(p);
    return p;
  }
  captureEpoch() { this.assertOwner(); return this._epoch; }
  assertEpoch(epoch) {
    if (!this._owner || epoch !== this._epoch) {
      const e = new Error("not_single_writer_owner"); e.code = "not_single_writer_owner"; throw e;
    }
  }
  async acquire() {
    if (!this.lockManager) { const e=new Error("ownership_unavailable"); e.code="ownership_unavailable"; throw e; }
    if (this._owner) return true;
    if (this._releasePromise) await this._releasePromise;
    let releaseFn; const gate = new Promise(r => { releaseFn = r; });
    const session = {};
    this._session = session;
    this._releaseGate = () => { if (this._session === session) { this._owner=false; } releaseFn(); };
    let enteredResolve; const entered = new Promise(r=>{enteredResolve=r;});
    this._heldPromise = this.lockManager.request(this.name, { mode:"exclusive" }, async () => {
      this._epoch += 1; // a new holding is a new epoch: older in-flight work can never land under it
      this._owner = true; enteredResolve();
      await gate; // hold the lock until release()
      if (this._session === session) this._owner = false;
    });
    // If the lock is contended, `entered` resolves only when granted.
    await entered; return true;
  }
  async tryAcquire() {
    if (!this.lockManager) return false;
    // Web Locks ifAvailable semantics are approximated by the memory
    // manager only in-process; in a browser, navigator.locks.request
    // with {ifAvailable:true} returns null when contended.
    if (typeof this.lockManager.requestIfAvailable === "function") return this.lockManager.requestIfAvailable(this.name, async()=>{});
    return this.acquire();
  }
  // Draining release: refuse new mutations NOW (epoch advance), wait
  // for tracked in-flight mutations to settle, then free the lock.
  // Returns a promise; callers that do not await it still get the
  // refusal semantics synchronously, and the lock frees once drained.
  release() {
    if (this._releasePromise) return this._releasePromise;
    if (!this._owner && !this._releaseGate) return Promise.resolve();
    this._epoch += 1;
    this._owner = false;
    const gateFn = this._releaseGate; this._releaseGate = null;
    this._releasePromise = (async () => {
      while (this._inflight.size) await Promise.allSettled([...this._inflight]);
      if (gateFn) gateFn();
      if (this._heldPromise) { try { await this._heldPromise; } catch {} }
      this._releasePromise = null;
    })();
    return this._releasePromise;
  }
  simulateLoss() { // harness only: models lock loss (tab killed / lock dropped)
    const was = this._owner;
    this._epoch += 1;
    this._owner = false;
    const gateFn = this._releaseGate; this._releaseGate = null;
    if (gateFn) gateFn();
    if (was) for (const fn of this.lostHandlers) fn();
  }
  assertOwner() { if (!this._owner) { const e=new Error("not_single_writer_owner"); e.code="not_single_writer_owner"; throw e; } }
  async guardMutation(fn) {
    this.assertOwner();
    const p = (async () => fn())();
    this._track(p);
    return p;
  }
  // Secondary contexts: genuinely non-writing, or relay to the owner.
  readOnlyView(api) {
    const owner=this;
    return new Proxy(api, { get(t,p){ const v=t[p]; if (typeof v==="function") return (...a)=>{ if (String(p).match(/^(note|flush|sync|apply|intent|mutate|set|save|delete)/)) { const e=new Error("read_only_context"); e.code="read_only_context"; throw e; } return v.apply(t,a); }; return v; } });
  }
  relayToOwner(fn) { return async (...a) => { this.assertOwner(); return fn(...a); }; }
}
export async function withOwnership(owner, fn) { await owner.acquire(); try { return await fn(owner); } finally { await owner.release(); } }
