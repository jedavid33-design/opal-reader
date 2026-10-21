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

import { createClientStore } from "../client-store.mjs";
import { createFunnel } from "./funnel.mjs";
import { chapterModel, surfaceModel, SURFACES } from "./projection.mjs";

export function createAssembledClient({ deviceId, storage, transport }) {
  const store = createClientStore({ deviceId, storage, transport });
  const funnel = createFunnel({ store, storage });
  const projection = {
    SURFACES,
    chapterModel: (bookId, chapterId) => chapterModel(store, bookId, chapterId),
    surfaceModel: (surface, bookId, chapterId) => surfaceModel(store, surface, bookId, chapterId),
  };
  return { store, funnel, projection };
}
