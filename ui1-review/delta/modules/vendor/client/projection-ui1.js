// UI1: identical to the accepted projection except the added
// "Sync incomplete" chapter label (Rowan amendment 2: a segment whose
// binding has not been synced yet must never be projected as
// "Not generated").
// Opal Reader v2 — assembled client, Stage 2: the chapter projection.
//
// THE one chapter-truth projection. In v1, chapter completion was derived
// by ~10 client functions (inventory A) and a single card (Pr()) consulted
// four of them at once — the mechanism behind "Complete in the list, 1/26
// on the card." Here there is exactly one model builder, fed by the
// store's cached read models, and every surface — chapter list, book card,
// Review POV modal, player — renders THIS model verbatim. The surfaces
// differ in layout only; the truth they show cannot diverge because there
// is nothing else to diverge from.
//
// The model embodies the audio-fact rule (Case #4 / P2 deriveChapterState):
// completeness is a fact about verified audio — bindings are paperwork,
// bytes are truth. A chapter whose bindings are complete but whose bytes
// are unverified on this device reads Uncertain on every surface.

export const SURFACES = ["list", "card", "modal", "player"];

export async function chapterModel(store, bookId, chapterId) {
  const d = await store.chapterDisplay(bookId, chapterId);
  const c = d.counts ?? { ready: 0, unverified: 0, blocked: 0, missing: 0, total: 0 };
  const have = c.ready + c.unverified;
  let text;
  switch (d.label) {
    case "Complete": text = `Complete ${c.total}/${c.total}`; break;
    case "Partial": text = `Partial ${have}/${c.total}`; break;
    case "Blocked": text = `Blocked ${c.blocked}/${c.total}`; break;
    case "Not generated": text = `Not started 0/${c.total}`; break;
    case "Sync incomplete": text = `Sync incomplete — audio index still loading (${have}/${c.total} loaded)`; break;
    case "Uncertain": text = `Uncertain — audio not verified on this device (${c.ready}/${c.total} confirmed)`; break;
    default: text = "Unknown";
  }
  return { label: d.label, certain: d.certain, reason: d.reason ?? null, counts: c, text };
}

// Every surface reads through this single entry point. The surface name is
// accepted (call sites stay self-describing) and deliberately unused: the
// model must not depend on who is asking.
export async function surfaceModel(store, surface, bookId, chapterId) {
  void surface;
  return chapterModel(store, bookId, chapterId);
}
