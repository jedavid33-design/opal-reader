// Opal Reader v2 — assembled client composition root (P5).
//
// The assembled client is exactly these modules and nothing else:
//   client-store.mjs  — cache / outbox / journal / read models (no truth of its own)
//   client/funnel.mjs — the save funnel (Stage 1): working copies in, durable commands out
// plus, in later stages, the projection + surface modules. The shipped
// v1 bundle is NOT part of the assembled client; it remains frozen as the
// census baseline. Screens bind to this surface:
//
//   writes:  funnel.setWorking / saveBook / deleteBook / settle, store.intent
//   sync:    funnel.syncNow / refreshWorking, store.syncFamily
//   reads:   store.chapterDisplay / findText / moneyDisplay / cachedEntity
//   position: store.notePosition / flushJournal / journalState
//
// Evidence class (stated plainly, per Rowan): everything here is proven in
// the node extraction/behavior harness against the real coordinator. This
// is NOT DOM or on-device acceptance — that remains the §7 device gate.

import { createClientStore } from "../client-store.js";
import { createFunnel } from "./funnel.js";
import { chapterModel, surfaceModel, SURFACES } from "./projection.js";
import { createSurfaces } from "./surfaces.js";
import { createShelfBridge } from "./shelf-bridge.js";
import { REMOVED_GENERATION_PROVIDERS, LEGACY_PLAYABLE_PROVIDERS, voiceStatus } from "./removals.js";

export function createAssembledClient({ deviceId, storage, transport, shelf = {} }) {
  const store = createClientStore({ deviceId, storage, transport });
  const funnel = createFunnel({ store, storage });
  const projection = {
    SURFACES,
    chapterModel: (bookId, chapterId) => chapterModel(store, bookId, chapterId),
    surfaceModel: (surface, bookId, chapterId) => surfaceModel(store, surface, bookId, chapterId),
  };
  const surfaces = createSurfaces({ store, transport });
  const removals = { REMOVED_GENERATION_PROVIDERS, LEGACY_PLAYABLE_PROVIDERS, voiceStatus };
  // Part 1 (B5): the Shelf bridge is composed here at last. It keeps its
  // own storage key (cs:shelf-bridge:v1), isolated from the shipped v1
  // outbox, and its wire/session behavior is the frozen F12 behavior —
  // with ONE bounded exception (Julie, Oct 24 2026): the bridge
  // observes rejections at its fire-and-forget call sites, reported
  // through the optional onAsyncRefusal config forwarded here. This
  // is composition only, proven by the existing replay tests plus the
  // Part 1 composition test. `shelf` may carry { shelfApiBase, fetchFn,
  // clock, idGen, onAsyncRefusal }; with no shelfApiBase the bridge still queues
  // sessions locally and flush() reports the missing URL, exactly as
  // the shipped bridge does.
  const shelfBridge = createShelfBridge({
    storage,
    fetchFn: shelf.fetchFn,
    shelfApiBase: shelf.shelfApiBase,
    clock: shelf.clock,
    idGen: shelf.idGen,
    onAsyncRefusal: shelf.onAsyncRefusal,
  });
  return { store, funnel, projection, surfaces, removals, shelfBridge,
           findText: (q, opts) => store.findText(q, opts) };
}
