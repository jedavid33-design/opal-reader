// Opal Reader v2 — P8 D3: the migration chunk limits and the chunk
// partitioner (single source of truth for derivation AND enforcement).
//
// The cutover plan (corrected document, Rowan D1 sign-off 6355565715)
// sets a PLANNING cap for import chunks — at most 250 MiB and at
// most 100 rows per chunk, whichever binds first — and requires D3
// to (a) measure the real resource shape through the Worker path,
// (b) DERIVE a conservative fail-closed limit from those
// measurements, and (c) ENFORCE it in code. The D3 resource proofs
// (tests/p8-d3-resource-proofs.test.mjs; numbers in the D3 build
// report) measure the worst shapes of the approved freeze:
//
//   * largest single object in the corpus: 5,787,234 bytes. The
//     migration prime buffers exactly ONE object at a time
//     (primeForMigration -> arrayBuffer), so the per-object buffer
//     term is bounded by the largest single object, never by the
//     chunk total: measured peak ArrayBuffers during a worst-book
//     chunk stayed within a small multiple of one object.
//   * largest book (Pucked Over: 510 rows, 1,555,992,872 bytes):
//     chunked priming holds no chunk-resident byte state — facts
//     are digests/metadata only — so peak resident memory is
//     essentially flat in chunk size; what grows with chunk size
//     is sequential GET count, hashing wall/CPU, and the size of
//     one command transaction.
//
// The derived limits below therefore keep the plan's planning cap
// as the (measured-conservative) chunk bound and add the missing
// per-item bound the measurements motivate:
//
//   maxItemBytes   16 MiB — one primed object, fully buffered,
//                  peaks at roughly 2x its size (ArrayBuffer +
//                  digest pass); 16 MiB keeps a single item's
//                  transient footprint at ~1/4 or less of the
//                  128 MB isolate ceiling with wide margin, and
//                  is 2.9x the largest object the approved freeze
//                  actually contains (5,787,234 bytes).
//   maxChunkBytes  250 MiB — the plan cap, confirmed conservative:
//                  a full 250 MiB chunk hashes locally in well
//                  under a second of CPU (node:crypto SHA-256 at
//                  several hundred MB/s; even an order of
//                  magnitude slower stays far inside the 30 s DO
//                  CPU budget), and its transaction writes at most
//                  maxRowsPerChunk rows per plane.
//   maxRowsPerChunk 100 — the plan cap: bounds one chunk to at
//                  most 200 R2 GET calls (a WAV row costs a missed
//                  MP3 probe + the WAV hit), at most 100 rows of
//                  per-chunk SQL writes, and a small evidence
//                  record.
//
// ENFORCEMENT lives in the coordinator (v2/coordinator.mjs,
// _migrationChunkState): a chunk whose pinned rows breach any of
// these limits is refused BEFORE priming (zero R2 GETs) with
// migration_item_oversize / migration_chunk_oversize. The limits
// enforced are THESE code constants — a pinned chunk manifest
// records the limits it was derived under for audit, but can never
// raise the enforced bound.

export const MIGRATION_CHUNK_LIMITS = Object.freeze({
  maxRowsPerChunk: 100,
  maxChunkBytes: 250 * 1024 * 1024, // 262,144,000
  maxItemBytes: 16 * 1024 * 1024, // 16,777,216
});

// Partition one book's pinned rows (in pinned order) into chunks
// under the limits: greedy fill — a row joins the current chunk
// unless adding it would breach the row cap or the byte cap, in
// which case it opens the next chunk. Partitions are therefore
// exact, ordered, contiguous slices of the pinned row order:
// chunk k covers rows [start, start + rowCount).
//
// Throws on a row larger than the item cap: such a book cannot be
// chunked at all, and derivation must fail loudly rather than emit
// a pin the coordinator would refuse.
export function partitionBookRows(rows, limits = MIGRATION_CHUNK_LIMITS) {
  const chunks = [];
  let cur = null;
  rows.forEach((row, i) => {
    if (typeof row.size !== "number" || row.size < 0)
      throw new Error(`partitionBookRows: row ${i} has no valid size`);
    if (row.size > limits.maxItemBytes)
      throw new Error(
        `partitionBookRows: row ${i} is ${row.size} bytes, over the ` +
        `${limits.maxItemBytes}-byte item limit — this book cannot be chunked`);
    if (!cur || cur.rowCount >= limits.maxRowsPerChunk ||
        cur.totalBytes + row.size > limits.maxChunkBytes) {
      cur = { index: chunks.length, start: i, rowCount: 0, totalBytes: 0 };
      chunks.push(cur);
    }
    cur.rowCount += 1;
    cur.totalBytes += row.size;
  });
  return chunks;
}
