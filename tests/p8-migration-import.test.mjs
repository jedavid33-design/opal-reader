// Opal Reader v2 — P8 migration import path: design conformance +
// synthetic fault injection (v2/p8/migration-import-design.md).
//
// Rowan's ruling 6354217340 cleared D10-independence IN PRINCIPLE
// and stopped the protocol AS IMPLEMENTED on four source findings
// (I1 SyncPush does not verify bytes; I2 a cold coordinator cannot
// see pre-existing objects; I3 probe.hash can return advertised
// metadata; I4 no cross-plane atomicity). These tests exercise the
// migration-specific replacement primitive against each finding,
// on a genuinely cold coordinator, with synthetic fixtures only.
import test from "node:test";
import assert from "node:assert/strict";
import { makeHarness, makeProbe } from "./helpers/do-harness.mjs";
import { createR2AudioCache } from "../v2/host/adapters.mjs";
import { createApi } from "../v2/api.mjs";
import {
  RecordingBucket, attestationFor, gateCmd, importCmd, makeWorld,
  pinnedEntry, seedRow, sha256Hex, syntheticBytes, v1Meta,
} from "./helpers/migration-fixtures.mjs";

const MIG = "mig-rehearsal-1";
const FREEZE = "freeze-digest-synthetic";

function residue(h) {
  return {
    bindings: h.rows("bindings").length,
    cacheIndex: h.rows("cache_index").length,
    migrationBooks: h.rows("migration_books").length,
    migrationAudit: h.rows("migration_audit").length,
    gates: h.rows("migration_gates").length,
    syncEntities: h.rows("sync_entities").length,
  };
}
const NO_RESIDUE = { bindings: 0, cacheIndex: 0, migrationBooks: 0,
                     migrationAudit: 0, gates: 0, syncEntities: 0 };

// ---------------------------------------------------------------- I2
test("I2 cold DO: the migration path binds both planes where the snapshot paths cannot see the object", async () => {
  const { bucket, cache, harness: h, coord, pinBook } = makeWorld();
  const s = seedRow(bucket, { bookId: "book-a", occurrenceId: "o1" });
  pinBook("book-a", [{ row: s.row, etag: s.etag }]);
  // Genuinely cold: empty index, empty snapshot.
  assert.equal(h.rows("cache_index").length, 0);
  assert.equal(cache.probe.exists(s.cacheKey), false);
  // The general path, unchanged: AdoptAudio cannot see the object.
  const adopt = await coord.handleCommand({ command_id: "cold-adopt", type: "AdoptAudio",
    payload: { occurrenceId: "o1", revisionKey: s.revisionKey, cacheKey: s.cacheKey } });
  assert.equal(adopt.outcome, "rejected");
  assert.equal(adopt.reason, "object_missing");
  // The migration path primes inside the operation and binds.
  const res = await coord.handleCommand(importCmd("cold-mig", {
    migrationId: MIG, freezeDigest: FREEZE, bookId: "book-a",
    content: { title: "Synthetic A", occurrenceIds: ["o1", "o2"] },
    rows: [s.row],
  }));
  assert.equal(res.outcome, "applied", JSON.stringify(res));
  assert.equal(res.certificate.totals.accepted, 1);
  assert.equal(res.certificate.rows[0].computedSha256, s.row.manifest.sha256);
  assert.equal(h.rows("bindings").length, 1);
  assert.equal(h.rows("bindings")[0].provenance, "migration");
  assert.equal(h.rows("cache_index")[0].sha256, s.row.manifest.sha256);
  const syncEnt = h.rows("sync_entities").find(e => e.family === "bindings");
  assert.equal(JSON.parse(syncEnt.data_json).cacheKey, s.cacheKey);
  assert.equal(JSON.parse(syncEnt.data_json).sha256, s.row.manifest.sha256);
  assert.equal(bucket.putCalls.length, 0);
  const view = coord.migrationBookView("book-a");
  assert.equal(view.completeness.complete, true);
  assert.equal(view.gate, null);
});

// ---------------------------------------------------------------- I1
test("I1 contrast: SyncPush still lands a bindings entity with NO byte verification — only the migration path verifies", async () => {
  const { harness: h, coord } = makeWorld();
  const push = (id, changes) => coord.handleCommand({ command_id: id, type: "SyncPush",
    payload: { deviceId: "d1", changes } });
  const c = await push("i1-c", [{ family: "content", entityKey: "book-x", bookId: "book-x",
    baseRevision: 0, op: "upsert", payload: { title: "X", occurrenceIds: ["o1"] } }]);
  assert.equal(c.outcome, "applied");
  // A bindings entity naming an object that does not exist anywhere:
  // SyncPush accepts it (revision/identity validation only). This is
  // the documented general-path behavior the migration path replaces
  // FOR IMPORT — it is not changed here.
  const b = await push("i1-b", [{ family: "bindings", entityKey: "book-x:o1", bookId: "book-x",
    baseRevision: 0, op: "upsert", payload: { cacheKey: "ghost-key" } }]);
  assert.equal(b.outcomes[0].status, "applied");
  assert.equal(h.rows("bindings").length, 0); // the SQL plane never heard of it
});

test("missing object: the whole book is rejected and leaves zero residue", async () => {
  const { bucket, harness: h, coord, pinBook } = makeWorld();
  const a = seedRow(bucket, { bookId: "book-b", occurrenceId: "o1" });
  const ghostBytes = syntheticBytes("book-b:o2");
  const ghost = { occurrenceId: "o2", revisionKey: sha256Hex(ghostBytes),
    cacheKey: sha256Hex(ghostBytes),
    manifest: { sha256: sha256Hex(ghostBytes), size: ghostBytes.length, format: "mp3" } };
  const c = seedRow(bucket, { bookId: "book-b", occurrenceId: "o3" });
  pinBook("book-b", [{ row: a.row, etag: a.etag },
    { row: ghost, etag: `"etag:audio/${ghost.cacheKey}.mp3"` },
    { row: c.row, etag: c.etag }]);
  const res = await coord.handleCommand(importCmd("miss-1", {
    migrationId: MIG, freezeDigest: FREEZE, bookId: "book-b",
    content: { title: "B", occurrenceIds: ["o1", "o2", "o3"] },
    rows: [a.row, ghost, c.row],
  }));
  assert.equal(res.outcome, "rejected");
  assert.equal(res.reason, "object_missing");
  const cert = Object.fromEntries(res.certificate.rows.map(r => [r.occurrenceId, r]));
  assert.equal(cert.o2.reason, "object_missing");
  assert.equal(cert.o1.verified, true);          // verified, but NOT applied
  assert.equal(cert.o1.status, "blocked");
  assert.equal(cert.o1.reason, "book_rejected");
  assert.deepEqual(residue(h), NO_RESIDUE);
  assert.equal(h.coord.receipt("miss-1").outcome, "rejected");
});

// ---------------------------------------------------------------- I3
test("I3 negative 1: tampered customMetadata (forged sha label, bytes unchanged) is refused", async () => {
  const { bucket, harness: h, coord, pinBook } = makeWorld();
  const s = seedRow(bucket, { bookId: "book-c", occurrenceId: "o1",
    meta: { ...v1Meta("mp3"), sha256: "f".repeat(64) } });
  pinBook("book-c", [{ row: s.row, etag: s.etag }]);
  // The old snapshot path would surface the FORGED value as the hash.
  assert.equal(s.row.manifest.sha256 !== "f".repeat(64), true);
  const res = await coord.handleCommand(importCmd("i3-1", {
    migrationId: MIG, freezeDigest: FREEZE, bookId: "book-c",
    content: { title: "C", occurrenceIds: ["o1"] }, rows: [s.row],
  }));
  assert.equal(res.outcome, "rejected");
  assert.equal(res.reason, "metadata_digest_mismatch");
  assert.equal(res.certificate.rows[0].computedSha256, s.row.manifest.sha256); // bytes were fine
  assert.equal(res.certificate.rows[0].metadataSha256, "f".repeat(64));        // label was not
  assert.deepEqual(residue(h), NO_RESIDUE);
});

test("I3 negative 2: swapped bytes under a stale (manifest-matching) metadata label are refused", async () => {
  const { bucket, harness: h, coord, pinBook } = makeWorld();
  const s = seedRow(bucket, { bookId: "book-d", occurrenceId: "o1",
    meta: { ...v1Meta("mp3") } });
  pinBook("book-d", [{ row: s.row, etag: s.etag }]);
  // Another writer's bytes land under the key; the metadata still
  // advertises the ORIGINAL digest (which equals the manifest).
  const swapped = syntheticBytes("book-d:o1:swapped");
  bucket.seed(s.objectKey, swapped, { ...v1Meta("mp3"), sha256: s.row.manifest.sha256 });
  const res = await coord.handleCommand(importCmd("i3-2", {
    migrationId: MIG, freezeDigest: FREEZE, bookId: "book-d",
    content: { title: "D", occurrenceIds: ["o1"] }, rows: [s.row],
  }));
  assert.equal(res.outcome, "rejected");
  assert.equal(res.reason, "content_hash_mismatch"); // computed-from-bytes governs
  assert.equal(res.certificate.rows[0].computedSha256, sha256Hex(swapped));
  assert.deepEqual(residue(h), NO_RESIDUE);
});

test("honest metadata: a correct recorded sha is accepted alongside the v1 no-sha shape", async () => {
  const { bucket, harness: h, coord, pinBook } = makeWorld();
  const plain = seedRow(bucket, { bookId: "book-e", occurrenceId: "o1" });
  const bytes2 = syntheticBytes("book-e:o2");
  const sha2 = sha256Hex(bytes2);
  bucket.seed(`audio/${sha2}.wav`, bytes2, { ...v1Meta("wav"), sha256: sha2 });
  const honest = { occurrenceId: "o2", revisionKey: sha2, cacheKey: sha2,
    manifest: { sha256: sha2, size: bytes2.length, format: "wav" } };
  pinBook("book-e", [{ row: plain.row, etag: plain.etag },
    { row: honest, etag: `"etag:audio/${sha2}.wav"` }]);
  const res = await coord.handleCommand(importCmd("i3-3", {
    migrationId: MIG, freezeDigest: FREEZE, bookId: "book-e",
    content: { title: "E", occurrenceIds: ["o1", "o2"] }, rows: [plain.row, honest],
  }));
  assert.equal(res.outcome, "applied", JSON.stringify(res));
  assert.equal(res.certificate.totals.accepted, 2);
});

// ------------------------------------------------------- shared key
test("shared key: two occurrences bound to one object; one index row, two bindings, both planes agree", async () => {
  const { bucket, harness: h, coord, pinBook } = makeWorld();
  const a = seedRow(bucket, { bookId: "book-f", occurrenceId: "s17" });
  const bRow = { occurrenceId: "s19", revisionKey: a.revisionKey, cacheKey: a.cacheKey,
                 manifest: a.row.manifest };
  pinBook("book-f", [{ row: a.row, etag: a.etag }, { row: bRow, etag: a.etag }]);
  const res = await coord.handleCommand(importCmd("shared-1", {
    migrationId: MIG, freezeDigest: FREEZE, bookId: "book-f",
    content: { title: "F", occurrenceIds: ["s17", "s19"] }, rows: [a.row, bRow],
  }));
  assert.equal(res.outcome, "applied", JSON.stringify(res));
  assert.equal(h.rows("bindings").length, 2);
  assert.equal(h.rows("cache_index").length, 1);
  assert.equal(coord.migrationBookView("book-f").completeness.complete, true);
});

// ------------------------------------------------------------- legacy
test("legacy anchors bind by their own rule; a wrong anchor is refused", async () => {
  const { bucket, harness: h, coord, pinBook } = makeWorld();
  const leg = seedRow(bucket, { bookId: "book-g", occurrenceId: "o1", form: "legacy" });
  pinBook("book-g", [{ row: leg.row, etag: leg.etag }]);
  const ok = await coord.handleCommand(importCmd("leg-1", {
    migrationId: MIG, freezeDigest: FREEZE, bookId: "book-g",
    content: { title: "G", occurrenceIds: ["o1"] }, rows: [leg.row],
  }));
  assert.equal(ok.outcome, "applied", JSON.stringify(ok));
  const bad = seedRow(bucket, { bookId: "book-h", occurrenceId: "o1", form: "legacy" });
  const badRow = { ...bad.row, revisionKey: "legacy:some-other-key" };
  pinBook("book-h", [{ row: badRow, etag: bad.etag }]);
  const res = await coord.handleCommand(importCmd("leg-2", {
    migrationId: MIG, freezeDigest: FREEZE, bookId: "book-h",
    content: { title: "H", occurrenceIds: ["o1"] }, rows: [badRow],
  }));
  assert.equal(res.outcome, "rejected");
  assert.equal(res.reason, "legacy_anchor_mismatch");
});

// ---------------------------------------------------- the 31 (typed)
function distinctBook(bucket, bookId, n, { attest = true } = {}) {
  const seeded = [], rows = [];
  for (let i = 1; i <= n; i++) {
    const s = seedRow(bucket, { bookId, occurrenceId: `d${i}`, form: "distinct" });
    seeded.push(s);
    rows.push(attest ? { ...s.row, provenanceAttestation: attestationFor(s, { bookId, freezeDigest: FREEZE }) }
                     : s.row);
  }
  return { seeded, rows,
           content: { title: bookId, occurrenceIds: rows.map(r => r.occurrenceId) } };
}

test("the 31: provenance acceptance binds all fingerprinted-distinct rows with an auditable trail", async () => {
  const { bucket, harness: h, coord, pinBook } = makeWorld();
  const { seeded, rows, content } = distinctBook(bucket, "book-distinct", 31);
  pinBook("book-distinct", seeded.map((s, i) => ({ row: rows[i], etag: s.etag })));
  const res = await coord.handleCommand(importCmd("prov-1", {
    migrationId: MIG, freezeDigest: FREEZE, bookId: "book-distinct", content, rows }));
  assert.equal(res.outcome, "applied", JSON.stringify(res.certificate?.rows?.find(r => r.status === "blocked")));
  assert.equal(res.certificate.totals.acceptedProvenance, 31);
  assert.equal(h.rows("migration_audit").length, 31);
  assert.ok(h.rows("bindings").every(b => b.provenance === "migration:freeze_snapshot_attestation"));
  assert.ok(h.rows("migration_audit").every(a => a.outcome === "accepted_provenance" &&
    a.recorded_identity === a.cache_key)); // the v1 default is what was recorded
  assert.equal(coord.migrationBookView("book-distinct").completeness.complete, true);
  const gate = await coord.handleCommand(gateCmd("prov-gate", {
    migrationId: MIG, bookId: "book-distinct",
    certificateSha256: res.certificate.certificateSha256 }));
  assert.equal(gate.outcome, "applied");
});

test("the 31: a missing attestation refuses the whole book as identity_mismatch, zero residue", async () => {
  const { bucket, harness: h, coord, pinBook } = makeWorld();
  const { seeded, rows, content } = distinctBook(bucket, "book-noatt", 3, { attest: false });
  pinBook("book-noatt", seeded.map((s, i) => ({ row: rows[i], etag: s.etag })));
  const res = await coord.handleCommand(importCmd("prov-2", {
    migrationId: MIG, freezeDigest: FREEZE, bookId: "book-noatt", content, rows }));
  assert.equal(res.outcome, "rejected");
  assert.equal(res.reason, "identity_mismatch");
  assert.deepEqual(residue(h), NO_RESIDUE);
});

test("the 31: attestation field disagreements are attestation_invalid, never a silent pass", async () => {
  const { bucket, harness: h, coord, pinBook } = makeWorld();
  for (const [i, mutate] of [
    ["sha", a => { a.sha256 = "0".repeat(64); }],
    ["etag", a => { a.r2Etag = '"etag:forged"'; }],
    ["digest", a => { a.snapshotDigest = "some-other-freeze"; }],
    ["limitation", a => { a.identityLimitation = "unspecified"; }],
  ]) {
    const bookId = `book-att-${i}`;
    const s = seedRow(bucket, { bookId, occurrenceId: "d1", form: "distinct" });
    pinBook(bookId, [{ row: s.row, etag: s.etag }]);
    const att = attestationFor(s, { bookId, freezeDigest: FREEZE });
    mutate(att);
    const res = await coord.handleCommand(importCmd(`prov-bad-${i}`, {
      migrationId: MIG, freezeDigest: FREEZE, bookId,
      content: { title: bookId, occurrenceIds: ["d1"] },
      rows: [{ ...s.row, provenanceAttestation: att }] }));
    assert.equal(res.outcome, "rejected", i);
    assert.equal(res.reason, "attestation_invalid", i);
  }
  assert.equal(h.rows("bindings").length, 0);
});

test("the 31: a POSITIVE foreign identity in metadata is never rescued by an attestation", async () => {
  const { bucket, harness: h, coord, pinBook } = makeWorld();
  const s = seedRow(bucket, { bookId: "book-foreign", occurrenceId: "d1", form: "distinct",
    meta: { ...v1Meta("mp3"), identity: "fp-someone-else" } });
  pinBook("book-foreign", [{ row: s.row, etag: s.etag }]);
  const res = await coord.handleCommand(importCmd("prov-foreign", {
    migrationId: MIG, freezeDigest: FREEZE, bookId: "book-foreign",
    content: { title: "F", occurrenceIds: ["d1"] },
    rows: [{ ...s.row, provenanceAttestation: attestationFor(s, { bookId: "book-foreign", freezeDigest: FREEZE }) }] }));
  assert.equal(res.outcome, "rejected");
  assert.equal(res.reason, "identity_mismatch");
  assert.equal(h.rows("bindings").length, 0);
});

test("the 31: AdoptAudio (non-migration) keeps strict refusal of the same rows", async () => {
  const objects = new Map();
  const sBytes = syntheticBytes("strict:d1");
  const sha = sha256Hex(sBytes);
  objects.set(sha, { format: "mp3", identity: sha, sha }); // recorded identity = cache key (v1 shape)
  const h = makeHarness({ probe: makeProbe(objects) });
  const res = await h.coord.handleCommand({ command_id: "strict-1", type: "AdoptAudio",
    payload: { occurrenceId: "d1", revisionKey: sha256Hex("resliced:strict:d1"), cacheKey: sha } });
  assert.equal(res.outcome, "rejected");
  assert.equal(res.reason, "identity_mismatch");
});

// ------------------------------------------------- idempotency (I4)
test("idempotency: replay returns the stored receipt; a fresh command id converges with no churn", async () => {
  const { bucket, harness: h, coord, pinBook } = makeWorld();
  const s = seedRow(bucket, { bookId: "book-i", occurrenceId: "o1" });
  pinBook("book-i", [{ row: s.row, etag: s.etag }]);
  const cmd = importCmd("idem-1", { migrationId: MIG, freezeDigest: FREEZE, bookId: "book-i",
    content: { title: "I", occurrenceIds: ["o1"] }, rows: [s.row] });
  const first = await coord.handleCommand(cmd);
  assert.equal(first.outcome, "applied");
  const syncRev = h.rows("sync_entities").find(e => e.family === "bindings").revision;
  const replay = await coord.handleCommand(cmd);
  assert.equal(replay.replayed, true);
  assert.equal(replay.outcome, "applied");
  const again = await coord.handleCommand({ ...cmd, command_id: "idem-2" });
  assert.equal(again.outcome, "applied");
  assert.equal(again.certificate.totals.acceptedIdempotent, 1);
  assert.equal(h.rows("bindings").length, 1);
  assert.equal(h.rows("sync_entities").find(e => e.family === "bindings").revision, syncRev);
  assert.equal(bucket.putCalls.length, 0);
});

test("abort, crash, resume: an interrupted import never promotes the book; the gate is durable across crashes", async () => {
  const { bucket, harness: h, coord, pinBook } = makeWorld();
  // Gate before any import: refused.
  const early = await coord.handleCommand(gateCmd("abort-g0", {
    migrationId: MIG, bookId: "book-j", certificateSha256: "cert-j" }));
  assert.equal(early.outcome, "rejected");
  assert.equal(early.reason, "flip_gate_incomplete");
  const good = seedRow(bucket, { bookId: "book-j", occurrenceId: "o1" });
  const ghostBytes = syntheticBytes("book-j:o2");
  const ghost = { occurrenceId: "o2", revisionKey: sha256Hex(ghostBytes), cacheKey: sha256Hex(ghostBytes),
    manifest: { sha256: sha256Hex(ghostBytes), size: ghostBytes.length, format: "mp3" } };
  pinBook("book-j", [{ row: good.row, etag: good.etag },
    { row: ghost, etag: `"etag:audio/${ghost.cacheKey}.mp3"` }]);
  const payload = { migrationId: MIG, freezeDigest: FREEZE, bookId: "book-j",
    content: { title: "J", occurrenceIds: ["o1", "o2"] }, rows: [good.row, ghost] };
  const aborted = await coord.handleCommand(importCmd("abort-1", payload));
  assert.equal(aborted.outcome, "rejected");
  h.crash();
  assert.equal(h.coord.migrationBookView("book-j").gate, null);
  assert.deepEqual(residue(h).bindings, 0);
  // The missing object arrives (in the real world: a corrected
  // manifest); the SAME import now converges.
  bucket.seed(ghost.cacheKey === undefined ? "" : `audio/${ghost.cacheKey}.mp3`, ghostBytes, v1Meta("mp3"));
  const resumed = await h.coord.handleCommand(importCmd("abort-2", payload));
  assert.equal(resumed.outcome, "applied", JSON.stringify(resumed));
  h.crash();
  assert.equal(h.coord.migrationBookView("book-j").completeness.complete, true);
  assert.equal(h.coord.migrationBookView("book-j").gate, null); // imported, NOT flipped
  const gate = await h.coord.handleCommand(gateCmd("abort-g1", {
    migrationId: MIG, bookId: "book-j",
    certificateSha256: resumed.certificate.certificateSha256 }));
  assert.equal(gate.outcome, "applied");
  h.crash();
  assert.equal(h.coord.migrationBookView("book-j").gate.flipped, true);
});

// --------------------------------------------------------- the fence
test("read-back divergence: a deleted SQL row / a tampered sync row blocks the flip gate and shows in the view", async () => {
  const { bucket, harness: h, coord, pinBook } = makeWorld();
  const s = seedRow(bucket, { bookId: "book-k", occurrenceId: "o1" });
  pinBook("book-k", [{ row: s.row, etag: s.etag }]);
  await coord.handleCommand(importCmd("fence-1", { migrationId: MIG, freezeDigest: FREEZE,
    bookId: "book-k", content: { title: "K", occurrenceIds: ["o1"] }, rows: [s.row] }));
  h.db.prepare(`DELETE FROM bindings WHERE occurrence_id = 'o1'`).run();
  const view = coord.migrationBookView("book-k");
  assert.equal(view.completeness.complete, false);
  assert.ok(view.completeness.missing.includes("sql:o1"));
  const gate = await coord.handleCommand(gateCmd("fence-g1", {
    migrationId: MIG, bookId: "book-k", certificateSha256: "cert-k" }));
  assert.equal(gate.outcome, "rejected");
  assert.equal(gate.reason, "flip_gate_incomplete");

  const s2 = seedRow(bucket, { bookId: "book-l", occurrenceId: "o1l" });
  pinBook("book-l", [{ row: s2.row, etag: s2.etag }]);
  await coord.handleCommand(importCmd("fence-2", { migrationId: MIG, freezeDigest: FREEZE,
    bookId: "book-l", content: { title: "L", occurrenceIds: ["o1l"] }, rows: [s2.row] }));
  h.db.prepare(`UPDATE sync_entities SET data_json = ? WHERE family = 'bindings' AND book_id = 'book-l'`)
    .run(JSON.stringify({ cacheKey: "swapped-key", revisionKey: s2.revisionKey, sha256: s2.row.manifest.sha256 }));
  const view2 = coord.migrationBookView("book-l");
  assert.equal(view2.completeness.complete, false);
  assert.ok(view2.completeness.divergences.some(d => d.plane === "sync"));
  const gate2 = await coord.handleCommand(gateCmd("fence-g2", {
    migrationId: MIG, bookId: "book-l", certificateSha256: "cert-l" }));
  assert.equal(gate2.outcome, "rejected");
});

test("flip gate: the anchored certificate replays idempotently; an arbitrary string is refused (G3)", async () => {
  const { bucket, harness: h, coord, pinBook } = makeWorld();
  const s = seedRow(bucket, { bookId: "book-m", occurrenceId: "o1" });
  pinBook("book-m", [{ row: s.row, etag: s.etag }]);
  const imp = await coord.handleCommand(importCmd("gc-1", { migrationId: MIG, freezeDigest: FREEZE,
    bookId: "book-m", content: { title: "M", occurrenceIds: ["o1"] }, rows: [s.row] }));
  const cert = imp.certificate.certificateSha256;
  assert.match(cert, /^[0-9a-f]{64}$/);
  const g1 = await coord.handleCommand(gateCmd("gc-g1", { migrationId: MIG, bookId: "book-m", certificateSha256: cert }));
  assert.equal(g1.outcome, "applied");
  const g2 = await coord.handleCommand(gateCmd("gc-g2", { migrationId: MIG, bookId: "book-m", certificateSha256: cert }));
  assert.equal(g2.outcome, "applied");
  assert.equal(g2.idempotent, true);
  // G3: the pre-correction tests gated with exactly such caller
  // literals; they no longer certify anything.
  const g3 = await coord.handleCommand(gateCmd("gc-g3", { migrationId: MIG, bookId: "book-m", certificateSha256: "cert-B" }));
  assert.equal(g3.outcome, "rejected");
  assert.equal(g3.reason, "flip_gate_certificate_mismatch");
  const wrongMig = await coord.handleCommand(gateCmd("gc-g4", { migrationId: "mig-other", bookId: "book-m", certificateSha256: cert }));
  assert.equal(wrongMig.outcome, "rejected");
  assert.equal(wrongMig.reason, "flip_gate_incomplete");
});

// ------------------------------------------------------- fail closed
test("no prime seam wired: the migration path fails closed and writes nothing", async () => {
  const bytes = syntheticBytes("noprim:o1");
  const sha = sha256Hex(bytes);
  const row = { occurrenceId: "o1", revisionKey: sha, cacheKey: sha,
    manifest: { sha256: sha, size: bytes.length, format: "mp3" } };
  // The book IS pinned (G2) so the refusal isolates the prime seam.
  const h = makeHarness({ extraEnv: { approvedFreezeManifest: {
    snapshotDigest: FREEZE, books: { "book-np": pinnedEntry([{ row, etag: "etag:noprim" }]) } } } }); // no migrationPrime, no probe
  const res = await h.coord.handleCommand(importCmd("np-1", {
    migrationId: MIG, freezeDigest: FREEZE, bookId: "book-np",
    content: { title: "NP", occurrenceIds: ["o1"] }, rows: [row] }));
  assert.equal(res.outcome, "rejected");
  assert.equal(res.reason, "migration_prime_unavailable");
  assert.deepEqual(residue(h), NO_RESIDUE);
});

test("content divergence and foreign occurrences are refused", async () => {
  const { bucket, harness: h, coord, pinBook } = makeWorld();
  const s = seedRow(bucket, { bookId: "book-o", occurrenceId: "o1" });
  pinBook("book-o", [{ row: s.row, etag: s.etag }]);
  await coord.handleCommand(importCmd("cd-1", { migrationId: MIG, freezeDigest: FREEZE,
    bookId: "book-o", content: { title: "Original", occurrenceIds: ["o1"] }, rows: [s.row] }));
  const diverged = await coord.handleCommand(importCmd("cd-2", { migrationId: MIG, freezeDigest: FREEZE,
    bookId: "book-o", content: { title: "Rewritten", occurrenceIds: ["o1"] }, rows: [s.row] }));
  assert.equal(diverged.outcome, "rejected");
  assert.equal(diverged.reason, "content_divergence");
  const foreign = await coord.handleCommand(importCmd("cd-3", { migrationId: MIG, freezeDigest: FREEZE,
    bookId: "book-o", content: { title: "Original", occurrenceIds: ["o1"] },
    rows: [{ occurrenceId: "oX", revisionKey: s.revisionKey, cacheKey: s.cacheKey, manifest: s.row.manifest }] }));
  assert.equal(foreign.outcome, "rejected");
  // G2 fires first (earlier and stronger than the old
  // unknown_occurrence check): oX is not in the pinned freeze rows.
  assert.equal(foreign.reason, "migration_manifest_mismatch");
});

test("staging namespace fence: a smoke-prefixed prime cannot see production-shaped keys", async () => {
  const bucket = new RecordingBucket();
  const s = seedRow(bucket, { bookId: "book-p", occurrenceId: "o1" }); // seeds audio/<key>.mp3
  const smokeCache = createR2AudioCache(bucket, { keyPrefix: "smoke-p8/" });
  assert.equal(await smokeCache.primeForMigration(s.cacheKey), null); // looks under smoke-p8/ only
  const h = makeHarness({ extraEnv: { migrationPrime: (k) => smokeCache.primeForMigration(k),
    approvedFreezeManifest: { snapshotDigest: FREEZE,
      books: { "book-p": pinnedEntry([{ row: s.row, etag: s.etag }]) } } } });
  const res = await h.coord.handleCommand(importCmd("sf-1", { migrationId: MIG, freezeDigest: FREEZE,
    bookId: "book-p", content: { title: "P", occurrenceIds: ["o1"] }, rows: [s.row] }));
  assert.equal(res.outcome, "rejected");
  assert.equal(res.reason, "object_missing");
  assert.equal(bucket.putCalls.length, 0);
});

// ------------------------------------------------------------ facade
test("read facade: GET /v2/migration/book/<id> serves the both-plane view and writes nothing", async () => {
  const { bucket, harness: h, coord, pinBook } = makeWorld();
  const s = seedRow(bucket, { bookId: "book-q", occurrenceId: "o1" });
  pinBook("book-q", [{ row: s.row, etag: s.etag }]);
  await coord.handleCommand(importCmd("fac-1", { migrationId: MIG, freezeDigest: FREEZE,
    bookId: "book-q", content: { title: "Q", occurrenceIds: ["o1"] }, rows: [s.row] }));
  const api = createApi(h.env);
  const commandsBefore = h.rows("commands").length;
  const res = await api(new Request("https://x.test/v2/migration/book/book-q"), h.state);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.completeness.complete, true);
  assert.equal(body.sqlBindings[0].cacheKey, s.cacheKey);
  assert.equal(body.cacheAnchors[0].sha256, s.row.manifest.sha256);
  assert.equal(body.gate, null);
  assert.equal(h.rows("commands").length, commandsBefore); // the GET wrote nothing
});
