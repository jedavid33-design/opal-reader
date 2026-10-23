// Opal Reader v2 — P8 migration import: the synthetic cold-DO
// rehearsal at audit scale (design §6 certificate discipline).
//
// Seven synthetic books mirror the binding audit's PUBLISHED shape
// — 1,799 rows over 7 books; 1,148 fingerprinted, 31
// fingerprinted-distinct (29 + 2 in the two affected books), 620
// legacy anchors; 1,798 unique objects with one shared key — but
// every key, digest, and byte here is synthetic. The rehearsal
// imports all seven books into a genuinely cold coordinator,
// assembles the per-book certificates with the three evidence
// classes kept distinct, records every flip gate only after
// read-back set-equality through the read-only facade, and proves
// zero writes to the storage surface throughout.
import test from "node:test";
import assert from "node:assert/strict";
import { createApi } from "../v2/api.mjs";
import {
  attestationFor, gateCmd, importCmd, makeWorld, seedRow, sha256Hex,
} from "./helpers/migration-fixtures.mjs";

const MIG = "mig-rehearsal-scale";
const FREEZE = "freeze-digest-synthetic-scale";

// Per-book shapes from the audit's published rollup: rows, with
// legacy/fingerprinted splits summing to the audit's class totals
// (620 legacy, 1,148 fingerprinted, 31 distinct).
const BOOKS = [
  { bookId: "syn-finding-home",    rows: 152, legacy: 52,  distinct: 0 },
  { bookId: "syn-forever-pucked",  rows: 50,  legacy: 17,  distinct: 0 },
  { bookId: "syn-in-her-own-league", rows: 203, legacy: 70, distinct: 0 },
  { bookId: "syn-pucked",          rows: 307, legacy: 106, distinct: 0 },
  { bookId: "syn-pucked-over",     rows: 510, legacy: 176, distinct: 2 },
  { bookId: "syn-pucked-up",       rows: 467, legacy: 161, distinct: 29 },
  { bookId: "syn-the-goal",        rows: 110, legacy: 38,  distinct: 0 },
];

function buildBook(bucket, spec) {
  const rows = [], listing = [], seededByOcc = new Map();
  let sharedSeeded = null;
  for (let i = 0; i < spec.rows; i++) {
    // Occurrence ids are globally unique in the coordinator's data
    // model (the bindings table is occurrence-keyed with no book
    // context; the audited corpus uses UUIDs) — the G4 gate's
    // bidirectional check relies on exactly that invariant, so the
    // fixture honors it too.
    const occurrenceId = `${spec.bookId}-seg-${String(i + 1).padStart(3, "0")}`;
    const form = i < spec.distinct ? "distinct"
      : i < spec.distinct + spec.legacy ? "legacy" : "fingerprinted";
    const format = i % 5 === 4 ? "wav" : "mp3";
    // The audit's one shared object: in the largest distinct book,
    // the final two fingerprinted rows share a single object.
    let seeded;
    if (spec.bookId === "syn-pucked-up" && i === spec.rows - 1 && sharedSeeded) {
      seeded = sharedSeeded;
    } else {
      seeded = seedRow(bucket, { bookId: spec.bookId, occurrenceId, form, format });
      if (spec.bookId === "syn-pucked-up" && i === spec.rows - 2) sharedSeeded = seeded;
    }
    const row = { ...seeded.row, occurrenceId };
    if (form === "distinct")
      row.provenanceAttestation = attestationFor(
        { ...seeded, row }, { bookId: spec.bookId, freezeDigest: FREEZE });
    rows.push(row);
    seededByOcc.set(occurrenceId, seeded);
    // Class A: the freeze-time listing facts for this binding.
    listing.push({ occurrenceId, objectKey: seeded.objectKey,
                   size: seeded.row.manifest.size, etag: seeded.etag });
  }
  // Books also carry occurrences with no audio yet (the real
  // corpus' shape: segments outnumber bindings).
  const unbound = [`${spec.bookId}-unbound-1`, `${spec.bookId}-unbound-2`];
  const content = { title: spec.bookId,
    occurrenceIds: [...rows.map(r => r.occurrenceId), ...unbound] };
  return { rows, content, listing };
}

test("scale rehearsal: 1,799 synthetic bindings import cold, certify in three evidence classes, gate — with zero storage writes", async () => {
  const { bucket, harness: h, coord, pinBook } = makeWorld({ freezeDigest: FREEZE });
  const world = BOOKS.map(spec => ({ spec, ...buildBook(bucket, spec) }));
  const totalRows = world.reduce((n, b) => n + b.rows.length, 0);
  assert.equal(totalRows, 1799);
  assert.equal(bucket.map.size, 1798); // one shared object, as audited
  const bucketDigestBefore = bucket.digestAll();
  assert.equal(h.rows("cache_index").length, 0); // genuinely cold

  const api = createApi(h.env);
  const certificates = [];
  let accepted = 0, provenance = 0;
  for (const [idx, book] of world.entries()) {
    // G2: the approved freeze pins this book's exact row set.
    pinBook(book.spec.bookId, book.rows.map(r => ({
      row: r, etag: book.listing.find(l => l.occurrenceId === r.occurrenceId).etag })));
    const res = await coord.handleCommand(importCmd(`scale-${book.spec.bookId}`, {
      migrationId: MIG, freezeDigest: FREEZE, bookId: book.spec.bookId,
      content: book.content, rows: book.rows }));
    assert.equal(res.outcome, "applied",
      `${book.spec.bookId}: ${JSON.stringify(res.certificate?.rows?.find(r => r.status === "blocked") ?? res)}`);
    accepted += res.certificate.totals.accepted + res.certificate.totals.acceptedIdempotent;
    provenance += res.certificate.totals.acceptedProvenance;
    // Assemble the certificate: class A (listing) + class B
    // (manifest) joined with class C (the outcome's import-time
    // raw verification) — the classes stay distinct columns.
    const listingByOcc = new Map(book.listing.map(l => [l.occurrenceId, l]));
    const cert = { bookId: book.spec.bookId, migrationId: MIG, freezeDigest: FREEZE,
      commandId: `scale-${book.spec.bookId}`,
      evidenceClasses: {
        A: "snapshot-era listing facts (key/size/etag at freeze)",
        B: "freeze byte-pass raw SHA-256 (manifest expectation)",
        C: "import-time per-object raw verification (SHA-256 recomputed from bytes downloaded inside this import operation)",
      },
      rows: res.certificate.rows.map(r => ({
        occurrenceId: r.occurrenceId, revisionKey: r.revisionKey, cacheKey: r.cacheKey,
        listing: listingByOcc.get(r.occurrenceId),                  // A
        manifestSha256: r.manifestSha256,                           // B
        computedSha256: r.computedSha256, metadataSha256: r.metadataSha256,
        etagAtImport: r.etag,                                       // C
        status: r.status, reason: r.reason,
      })),
      totals: res.certificate.totals };
    certificates.push(cert);
    // Class discipline: EVERY row carries a class-C digest computed
    // in this operation, and it equals class B. A row with only
    // A/B evidence would read blocked — none does.
    for (const r of cert.rows) {
      assert.equal(r.status === "blocked", false, `${book.spec.bookId}/${r.occurrenceId}`);
      assert.equal(r.computedSha256, r.manifestSha256);
      assert.equal(r.listing.etag, r.etagAtImport);
    }
    // Read-back through the SELECT-only facade BEFORE the gate.
    const viewRes = await api(new Request(`https://x.test/v2/migration/book/${book.spec.bookId}`), h.state);
    assert.equal(viewRes.status, 200);
    const view = await viewRes.json();
    assert.equal(view.completeness.complete, true, book.spec.bookId);
    assert.equal(view.gate, null);
    // G3: the gate takes the coordinator's own anchored
    // certificate digest for this import (the evidence certificate
    // assembled above stays a distinct artifact of this rehearsal).
    const gate = await coord.handleCommand(gateCmd(`scale-gate-${book.spec.bookId}`, {
      migrationId: MIG, bookId: book.spec.bookId,
      certificateSha256: res.certificate.certificateSha256 }));
    assert.equal(gate.outcome, "applied", book.spec.bookId);
    if (idx === 2) h.crash(); // durability mid-sequence: nothing above is lost
  }
  assert.equal(accepted + provenance, 1799);
  assert.equal(provenance, 31);
  assert.equal(h.rows("bindings").length, 1799);
  assert.equal(h.rows("cache_index").length, 1798); // shared key anchored once
  assert.equal(h.rows("migration_audit").length, 31);
  assert.equal(h.rows("migration_gates").length, 7);
  for (const book of world)
    assert.equal(coord.migrationBookView(book.spec.bookId).gate.flipped, true);
  // Zero writes to the storage surface, start to finish: no puts,
  // and the bucket's contents are bit-for-bit what was seeded.
  assert.equal(bucket.putCalls.length, 0);
  assert.equal(bucket.digestAll(), bucketDigestBefore);
  // Certificate scale sanity: the assembled certificates account
  // for every audited row exactly once.
  assert.equal(certificates.reduce((n, c) => n + c.rows.length, 0), 1799);
});
