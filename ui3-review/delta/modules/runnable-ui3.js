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
import { createCandidate } from "./composition-ui3.js";
import { createBrowserStorage } from "./storage-adapter.js";
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
  const storage = createBrowserStorage(storageLike);
  const mgr = lockManager ?? browserLockManager();
  const owner = new SingleWriterOwner({ lockManager: mgr });
  await owner.acquire();
  let candidate;
  try {
    candidate = await createCandidate({
      token, storage, shellStorage: storageLike, owner, fetchFn, shelf, idGen, baseUrl, probeBinding,
    });
  } catch (e) {
    await owner.release();
    throw e;
  }
  if (candidate.stopped) return { stopped: true, candidate, owner };
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
    // Controlled release: close the Shelf lifecycle (timers
    // cancelled, checkpoints stopped, in-flight bridge work drained)
    // first; only then free the ownership lock.
    async release() {
      await candidate.closeShelfLifecycle();
      await owner.release();
    },
  };
}
