# UI3 — pinned source references (for Rowan's independent inspection)

All files taken byte-identical from the accepted live publish tree (ui-pkg-2,
commit `b83a6d99…`). SHA-256 values are the publish manifest's.

## 1. The confirmation function — `modules/vendor/client-store-ui1.js`
SHA-256 `778d4c33…` (full: see PACKAGE-MANIFEST of ui-pkg-1/ui-pkg-2; file pinned alongside this note).

- Lines 371–374 (design comment): "bytes: metadata is not the audio. Confirmations are version-aware: recorded against the binding's revision. A binding update (new revision or key) or a missing-bytes report invalidates them (P5 review fix 2)."
- Lines 375–394 `verifyBindingBytes(bookId, occurrenceId)`:
  - resolves the binding record; returns `false` if no cacheKey;
  - **line ~382: early return `true` with NO network call when `s.bytes[cacheKey]?.bindingRevision === rec.revision`** (the persisted per-revision guard);
  - calls `transport.byteCheck(cacheKey)`; on falsy returns `false` and records nothing;
  - records `s3.bytes[cacheKey] = { bindingRevision: rec.revision }` inside a serialized `mutate(...)` that re-compares revision + cacheKey against the live cache at record time (race-tightened).
- Lines 396–400 `bytesConfirmedFor(rec)`: the read side of the same state.
- Line 414 `chapterDisplay(bookId, chapterId)`; its count (via projection) is `ready/total`, ready = binding synced AND `bytesConfirmedFor`.
- Lines 484–492 `resolvePlayback(binding)`: pure; header comment "Playback never writes records."
- Line 498: `verifyBindingBytes` is in the store's export list — callable today; nothing calls it.

## 2. The transport — `modules/vendor/client/http-transport.js`
SHA-256 `e32b8530…` (file pinned alongside this note).

- Lines 65–68: `async byteCheck(cacheKey) { const r = await request(\`/v2/sync/byte-check/${encodeURIComponent(cacheKey)}\`); return !!r?.exists; }` — a small authenticated GET on the sync family; returns whether the object exists per the binding's key.
- Same file exposes `quotaView: () => request("/v2/quota")` — a separate route; byte-check does not touch it (build-phase proof still required by Rowan's condition 4).

## 3. The only existing byteCheck call site — `modules/composition-ui1.js`
SHA-256 `41a003df…`.

- Lines ~898–900: preflight C3 — "authenticated byte-check of the designated key", `audioTransport.byteCheck(binding.cacheKey)` for the single designated probe key. This is diagnostics, not per-segment confirmation; it records nothing into `state.bytes`.

## 4. The trigger layer — `modules/player.js` (shared module)
SHA-256 `e63e0558…`.

- Header comments (lines ~27–34): `play()` awaits the media play() promise; state becomes `"playing"` only after the promise resolves — i.e., the player already models "successful start" as a distinct, observable transition, and refused/failed starts (e.g. `restore_offset_out_of_duration`) never reach it.
- **Preservation constraint:** player.js is a SHARED module referenced by the CORR1 and UI1 service-worker shells. It must never be edited in place; any change ships as a versioned successor with importer pointers updated (the established CORR1/UI1 pattern), or the rollback closures change meaning.
