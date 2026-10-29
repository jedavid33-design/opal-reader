# Inventory — legacy `chapter-audio/` namespace, R2 bucket `opalreader-storage`

Produced Oct 29, 2026. **Read-only**: a full paginated object listing plus
source-code reading. Nothing was deleted, written, moved, or downloaded;
no audio was played and no book text was read (structural metadata only).
This inventory informs a future decision by Julie; it makes none.

---

## 1. Contents

**Recomputed independently** (full cursor-paginated listing of the
`chapter-audio/` prefix, 13 pages, Oct 29, 2026):

- **257 objects, 3,746,296,158 bytes (3.7463 GB)** — byte-for-byte
  identical to the figure in `PINS.md` (§3). ✔
- **One single key pattern** for all 257 objects:
  `chapter-audio/<64 lowercase hex chars>.<ext>` — the hex stem is a
  SHA-256 derivation (see §3), **not** a book or chapter identifier.
  No object carries custom metadata; content type matches extension
  throughout.
- **Formats:** WAV — 216 objects, 3,131,861,514 B · MP3 — 41 objects,
  614,434,644 B.
- **Sizes:** 2.61 MB min, 12.12 MB median, 14.58 MB mean, 46.95 MB max.
- **Last-modified:** 2026-09-11 → 2026-10-20 (50 objects in September,
  207 in October) — the v1 era. The frozen P8 snapshot listing
  (Oct 22, `opal-reader-p8-data/listings.json`) also counts exactly 257:
  **the namespace has not changed since the freeze.**

**What the objects are** (from the shipped v1 worker source, §2c): each
object is a **whole-chapter composite** — the concatenation (WAV path:
PCM merge + re-wrap) of one chapter's per-segment audio objects from
`audio/`, built on demand the first time Julie played that chapter (or
a from-this-segment slice of it) in the v1 app, then served from cache
on later plays. The composite key is
`SHA-256("wav-data-chunks-v2|" + bookId + "|" + chapterOrdinal + "|" +
segmentKeys.join("|"))`. An earlier generation of the same function
used the bare input `bookId|chapterOrdinal|segmentKeys` with no prefix
string; both schemes are attested in the bucket.

**Attribution.** Because the key is a hash of (book, chapter, ordered
segment-key list), each object can be attributed by recomputing the
hash over candidate lists from the frozen census
(`~/workspace/opal-reader-p8-data/books/*.json`: full chapter lists,
prefixes, and contiguous slices — the v1 client requested composites
for `segments.slice(startSegment)`, so slices are expected). A hash
match is cryptographic proof of the exact constituent list. Result:
**247 of 257 objects (3,397,565,050 B, 90.7%) positively attributed**:

| Book | Objects | MB | Notes |
|---|---|---|---|
| Pucked Over | 153 | 1,977.0 | incl. many partial-chapter slices from its generation period |
| Pucked Up | 43 | 754.7 | |
| In Her Own League | 36 | 523.2 | all MP3, earlier key scheme |
| Forever Pucked | 11 | 71.1 | |
| Pucked | 3 | 67.2 | |
| The Goal | 1 | 4.4 | MP3, earlier scheme |
| Finding Home | 0 | — | no composite reproduced from its census key lists |
| **Unidentified** | **10** | **348.7** | see below |

At least 46 distinct chapters are identified under the current key
scheme alone. The **10 unidentified objects** (5 MP3 dated Sep 16–26,
5 WAV dated Sep 26–29, and the largest objects in the namespace at
36–47 MB) match no key list reconstructible from the frozen census —
consistent with composites built from segment-key lists that later
changed at individual positions (v1's repair/regeneration history
replaced segment keys after composition). Their provenance is not
provable object-by-object, but §2c's mechanism guarantees they were
built the same way: concatenations of `audio/` segment objects of the
v1 library. No evidence points to any book outside the 7-book census
(the freeze snapshot's library is exactly those 7 books).

## 2. Is anything still reading it?

### (a) The v2 worker — NO
`grep` for `chapter-audio` across the entire v2 source of record
(`~/workspace/d5-worker-work/v2/`): the runtime modules
(`coordinator.mjs`, `api.mjs`, `audio-route.mjs`, `executor.mjs`,
entries, `host/`, `client/`, `migration/`) contain **zero** references.
The v2 audio route serves exactly `audio/<64-hex>.(mp3|wav)`
(`audio-route.mjs`). The only hits in the tree are in
`v2/p8/freeze-worker.js` — which is not v2 code at all (see (c)).

### (b) The accepted v2 client — NO
Zero references anywhere in `~/workspace/d5c-wrapper-gate/wrapper-a/`
(the accepted client source the live ui-pkg-3 client descends from).
The v2 client plays per-segment audio only.

### (c) The frozen v1 system — YES, as a derived playback cache
The v1 worker source **is present** in the workspace:
`~/workspace/d5-worker-work/v2/p8/freeze-worker.js` is, per its own
header, *"a full copy of the shipped cloudflare-worker.js (1.4.43,
byte-identical to origin/main at copy time) with the P8 freeze
applied"* — freeze changes are marked in-file; everything else is
shipped v1 code. In shipped v1 code:

- Route `POST /api/playback/chapter` → `chapterCompositeAudio`
  (freeze-worker.js ~L1416–1527): HEAD-verifies every segment object
  under `audio/`, serves `chapter-audio/<composite>.<fmt>` on a cache
  **hit**; on a **miss** it concatenates the segment objects, PUTs the
  composite to `chapter-audio/`, and serves it. (The freeze variant's
  one change here, D3: a miss refuses 423 instead of composing; hits
  still serve.)
- `purgeBookAudio` (~L1393) deletes a book's composites when the book
  is purged — the only deleter the namespace ever had.
- The v1 client (`~/workspace/github-repos/opal-reader/app-185.js`,
  UI 1.4.47) calls this route via `chapterComposite()` during chapter
  playback when the chapter is ready, with a 45 s timeout; on
  timeout/error it returns null and playback proceeds **per-segment**
  (the worker's own error text states the same fallback).

**Rollback consequence (evidence-based, high confidence):**
`chapter-audio/` *is* part of the v1 working set, but only as a
**cache of derived artifacts whose entire content also exists as
segment objects under `audio/`**. If the namespace were gone, a v1
rollback would still play every chapter: the first whole-chapter play
of each chapter would re-compose from `audio/` (worker time + an R2
write per chapter; all 257 composites are under the worker's 64 MB
composition cap) — under today's *frozen* v1, misses refuse and the
client falls back to per-segment playback until an unfreeze. What
deletion would permanently lose is only the prebuilt files themselves:
composites built from since-replaced segment key lists (the 10
unidentified, and historical slices) could not be re-requested in
their exact old form, though every constituent sound exists as a
segment object under `audio/` (replaced keys' objects persist among
the 193 preserved `audio/` orphans).

## 3. Relationship to the v2 library

These are whole-chapter renders **of the same migrated books** — 6 of
the 7 census books positively identified (§1); Finding Home simply
has no *reproducible* composite (Julie's listening pattern, not
missing content: a composite exists only for a chapter actually played
in whole-chapter mode in v1). Their audio content is, by construction,
the same segment audio the v2 library holds under `audio/` — the v2
migration did not need them, did not transform them, and left the
namespace untouched. They are **not** an additional or alternate copy
of any book's text or narration in a different rendition: same
segments, concatenated.

## 4. Redundancy / orphan check

- **Census bindings:** every binding in the frozen census points at an
  `audio/` object (`audio-results.jsonl`, 1,798 bound objects). **No
  binding references a `chapter-audio/` key.**
- **v2 coordinator / migration:** zero references (§2a). The P8
  snapshot and drift report list the namespace only as a counted,
  preserved family (257 = 257, zero drift). The 193-orphan count from
  the census is an `audio/`-only population; the 257 chapter-audio
  objects are a **separate, wholly unreferenced** population.
- **Backup manifests:** the device backup packages inventory
  device-local stores (IndexedDB/localStorage), not R2; the P8
  packages in `~/workspace/your_files/` mention `chapter-audio/` only
  as a preserved family ("Chapter composites are derived artifacts…
  stored under `chapter-audio/<key>`" — pre-implementation package).
  **No index anywhere enumerates these keys individually** — the only
  way to address one is to recompute its derivation, which is what §1
  did.
- Verdict: **fully redundant as content** (every byte derives from
  `audio/` segment objects that remain in the bucket), **referenced
  by nothing** in the v2 system, the census, or any backup — its sole
  consumer, historical and potential, is the v1 rollback path in §2c.

## 5. Options sketch (facts only — no recommendation)

Bucket today: **9.4828 GB of 10 GB**. D6 projections from `PINS.md`:
FP phase adds 1.4249 GB (1.5674 with the 10% retries/orphans
allowance); all-books adds 3.1224 GB (3.4347 with allowance). D6's
fail-closed rule refuses any job whose projection crosses 10 GB.

| Option | Frees | Bucket after | D6 effect | Risk / cost |
|---|---|---|---|---|
| **Keep all 257** | 0 | 9.4828 GB | FP phase projection 10.9077 GB — **cannot arm** until ≥ ~0.91 GB (1.05 with allowance) is freed by some means | None to any data; v1 rollback keeps its full composite cache |
| **Delete the 247 identified** | 3.3976 GB | 6.0852 GB | FP 7.5101 GB (7.6526 w/ allowance) ✔ · all-books 9.2076 GB (9.5199 w/ allowance) ✔ — both fit | Loses prebuilt composites for 6 books; all are provably re-derivable from current `audio/` segment lists under a v1 rollback (§2c). The 10 unattributed objects (348.7 MB) stay preserved |
| **Delete all 257** | 3.7463 GB | 5.7365 GB | FP 7.1614 GB (7.3039) ✔ · all-books 8.8589 GB (9.1712) ✔ | As above, plus the 10 unattributed composites — content still exists as `audio/` segments, but those exact composite files are not re-requestable in their historical form (§2c) |
| **Archive off R2, then delete** | 3.7463 GB (once removed) | 5.7365 GB | Same as delete-all | One-time download of 3.7463 GB (257 objects, largest 47 MB; R2 egress is unmetered) to storage outside the bucket — e.g. Julie's device/local storage; verifiable object-by-object against this inventory's sizes and ETags before any deletion; re-upload is 257 writes if ever wanted. After deletion the archive is the only copy of the composite files, with whatever durability its home has |

Deletion of any R2 object is irreversible from within R2 (no versioning
on this bucket was observed in the listing metadata). Any disposition
is a separate decision outside the D6 build authorization.

---

*Sources: live paginated R2 listing of `opalreader-storage`
(prefix `chapter-audio/`), Oct 29, 2026; frozen census + listings in
`~/workspace/opal-reader-p8-data/`; v1 worker source of record
`~/workspace/d5-worker-work/v2/p8/freeze-worker.js` (shipped 1.4.43
copy); v1 client `~/workspace/github-repos/opal-reader/app-185.js`;
v2 source `~/workspace/d5-worker-work/v2/`; accepted v2 client
`~/workspace/d5c-wrapper-gate/wrapper-a/`; projections from
`~/workspace/d6-build/PINS.md` §3. No segment text was read or quoted —
book data is titles, IDs, chapter ordinals, and key hashes only.*
