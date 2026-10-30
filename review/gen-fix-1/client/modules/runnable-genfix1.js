// GEN-FIX-1: runnable-genpkg1.js with ONLY the composition
// pointer advanced to composition-genfix1.js. Behaviour
// unchanged.
// UI4 candidate runnable (ui-pkg-4). Delta from runnable-ui3.js,
// and ONLY this: the G7 storage wiring (design 5.1/5.4) — the
// candidate is constructed over the key-scoped routing adapter
// (IndexedDB for the state record after the verified one-time
// migration, localStorage for everything else), migration runs
// under the ownership lock before construction, and the handle
// exposes the storage health / state snapshot / frozen-record
// guard the shell's Diagnostics reads. Everything else is the
// accepted UI3 runnable, byte-identical.
//
// Runnable browser composition (B5): the off-main candidate as an
// actually-constructible browser client — still local/review-branch
// only, NOT referenced by index.html, no service worker registered.
//
// It builds the candidate over the persistent BROWSER storage adapter
// (createBrowserStorage over a Storage-like object — real browser
// storage semantics, string-serialized values), constructs the player
// AND the authenticated audio fetch transport (via createCandidate's
// createPlayback default fetchSegment), wires media events and the
// reporter's playback checkpoint timer (inside createPlayback), and
// wires pagehide to the best-effort tail (never treated as ended).
// All write paths start disabled until runPreflight() — the FULL
// Table C orchestrator (C1–C6) — passes for a designated probe
// binding; verifyAccess() alone is only the single-request access
// check and never opens the gate (follow-up correction 1).
// release() is the controlled lifecycle close: it closes the Shelf
// lifecycle (bridge timers cancelled, checkpoints stopped, in-flight
// bridge work drained) BEFORE the ownership lock is freed
// (correction 3).
import { createCandidate } from "./composition-genfix1.js";
import { createBrowserStorage } from "./storage-adapter.js";
import { createIndexedDbStorage, createStateRoutingStorage, runStorageMigration } from "./storage-state.js";
import { CANDIDATE_BUILD_MARKER, STATE_KEY } from "./constants-ui4.js";
import { browserLockManager, SingleWriterOwner } from "./ownership.js";

export async function createRunnableClient({
  token,
  storageLike,                 // Storage-like (e.g. window.localStorage)
  media,                       // a real (or fake) media element
  fetchFn,
  shelf = {},
  idGen,
  baseUrl,
  lockManager,
  urlFactory,
  readIdFor,
  resolveBinding,
  nextSelection,
  probeBinding,                // designated Table C probe binding for runPreflight()
  eventTarget,                 // pagehide target (e.g. window); defaults to globalThis when it has addEventListener
} = {}) {
  if (!storageLike) { const e = new Error("browser_storage_required"); e.code = "browser_storage_required"; throw e; }
  // UI4 (G7): the store's storage is the key-scoped routing
  // adapter — IndexedDB for cs:state:v1 after migration, the
  // existing localStorage adapter for every other key. Migration
  // runs under the single-writer lock, after acquire and before
  // the candidate exists (design 5.4), so device identity, the
  // store, and the Shelf bridge are all constructed over the
  // already-decided backend. A migration stop (legacy writer
  // detected, backend agreement failure, identity mismatch)
  // releases the lock and propagates with its stable code.
  const legacy = createBrowserStorage(storageLike);
  const idb = createIndexedDbStorage({});
  const router = createStateRoutingStorage({ idb, legacy });
  const rawAccess = {
    getRaw: (k) => storageLike.getItem(k),
    setRaw: (k, v) => storageLike.setItem(k, v),
    removeRaw: (k) => storageLike.removeItem(k),
  };
  const mgr = lockManager ?? browserLockManager();
  const owner = new SingleWriterOwner({ lockManager: mgr });
  await owner.acquire();
  let migration;
  try {
    migration = await runStorageMigration({ legacy, idb, router, rawAccess, build: CANDIDATE_BUILD_MARKER });
  } catch (e) {
    await owner.release();
    throw e;
  }
  const storage = router;
  const storageHealth = () => {
    const rh = router.storageHealth();
    return {
      backend: rh.backend, state: migration.state, migratedAt: migration.migratedAt,
      sourceChars: migration.sourceChars, markerWriteFailed: migration.markerWriteFailed,
      estimate: migration.estimate, persist: migration.persist,
      lastDiag: migration.lastDiag ?? rh.lastDiag ?? idb.storageHealth().lastDiag ?? null,
    };
  };
  let candidate;
  try {
    candidate = await createCandidate({
      token, storage, shellStorage: storageLike, owner, fetchFn, shelf, idGen, baseUrl, probeBinding,
    });
  } catch (e) {
    await owner.release();
    throw e;
  }
  if (candidate.stopped) return { stopped: true, candidate, owner, storageHealth, stateSnapshot: () => router.get(STATE_KEY), verifyStorageGuard: migration.verifyGuard };
  const target = eventTarget ?? (typeof globalThis.addEventListener === "function" ? globalThis : null);
  const player = candidate.createPlayback({
    media,
    urlFactory: urlFactory ?? {
      create: (blob) => globalThis.URL.createObjectURL(blob),
      revoke: (u) => globalThis.URL.revokeObjectURL(u),
    },
    readIdFor: readIdFor ?? ((tok) => tok.bookId),
    resolveBinding, nextSelection,
    pagehideTarget: target,
  });
  return {
    candidate, player, owner,
    buildMarker: candidate.buildMarker,
    deviceId: candidate.deviceId,
    verifyAccess: candidate.verifyAccess,
    runPreflight: candidate.runPreflight,
    invalidatePreflight: candidate.invalidatePreflight,
    writeGateState: candidate.writeGateState,
    shelfLifecycleState: candidate.shelfLifecycleState,
    diagnostics: candidate.diagnostics,
    storageHealth,
    stateSnapshot: () => router.get(STATE_KEY),
    verifyStorageGuard: migration.verifyGuard,
    // Controlled release: close the Shelf lifecycle (timers
    // cancelled, checkpoints stopped, in-flight bridge work drained)
    // first; only then free the ownership lock.
    async release() {
      await candidate.closeShelfLifecycle();
      await owner.release();
    },
  };
}
