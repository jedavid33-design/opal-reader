// gen-pkg-1 — binding projection (brief §3; Rowan obligations 1 + 6).
//
// The D6 commit binds only the SQL plane; the sync bindings family
// is what clients read. These tests prove, on the real harness
// (production .one() semantics):
//   * a committed segment's binding appears on the sync plane with
//     the server-derived payload, no client/manual push involved;
//   * crash between commit and publication -> the reconciliation
//     sweep publishes it (retryable pending state, never a gap);
//   * duplicate sweeps / racing projectors are idempotent (one
//     entity revision, one change row);
//   * an existing EQUAL binding (the G10 hand-published shape) is a
//     no-op, including its revision-key variance;
//   * a DIFFERENT binding at the destination is never overwritten —
//     a conflict is recorded and survives repeat sweeps;
//   * incomplete commit metadata stays pending until repaired.
import test from "node:test";
import assert from "node:assert/strict";
import { makeHarness } from "./helpers/do-harness.mjs";
import { makeFakeR2Bucket, makeFakeD6Providers, sha256HexOf } from "./helpers/d6-fakes.mjs";
import { createGenStore } from "../worker/generation/genstore.mjs";
import { createGenerationService } from "../worker/generation/service.mjs";
import { createCoordinatorPlaneSource } from "../worker/generation/content-plane-adapter.mjs";
import { createD6Executor } from "../worker/generation/d6-executor.mjs";
import { createFlushStore } from "../worker/generation/flush-store.mjs";
import { createD6WorkSource } from "../worker/generation/d6-work-source.mjs";
import {
  projectBinding, reconcileBindingProjections, isBindingPublished,
  bindingProjectionMarker,
} from "../worker/generation/binding-projection.mjs";

const BOOK = "book-fp-mini";
const PARKED_JOB = "1832c21fcf0425454227c4736048a8a632f422abca4a2685ddb775bb1681406a";
const T = (id) => `Synthetic prose for segment ${id}, invented for the projection harness only.`;

function bridgeProbe(bucket, flushStore) {
  const find = (cacheKey) => {
    for (const ext of ["wav", "mp3"]) {
      const key = flushStore.objectKeyFor(cacheKey, ext);
      const e = bucket.store.get(key);
      if (e) return { key, ...e };
    }
    return null;
  };
  return {
    exists: (k) => !!find(k),
    sniff: (k) => { const e = find(k); return e ? (e.key.endsWith(".mp3") ? "mp3" : "wav") : null; },
    recordedIdentity: (k) => { const e = find(k); return e ? (e.customMetadata?.identity ?? null) : null; },
    hash: (k) => { const e = find(k); return e ? sha256HexOf(e.bytes) : null; },
    recordedSha256: (k) => { const e = find(k); return e ? (e.customMetadata?.sha256 ?? null) : null; },
    keyFor: () => null,
  };
}

function seedBook(h) {
  const seg = (occurrenceId, text) => ({ occurrenceId, text, pov: "pov-a" });
  const data = {
    chapters: [
      { chapterId: "ch-0", index: 0, segments: [seg("b0", T("b0")), seg("b1", T("b1"))] },
      { chapterId: "ch-1", index: 1, segments: [seg("e0", T("e0")), seg("e2", T("e2"))] },
      { chapterId: "ch-2", index: 2, segments: [seg("p0", T("p0")), seg("p1", T("p1"))] },
    ],
    povs: [{ id: "pov-a", name: "Aria", voice: { voice_id: "Zephyr", provider: "gemini", model_id: "gemini-3.8-flash-tts", style_direction: "warm" } }],
    defaultVoice: { provider: "gemini", voice_id: "Zephyr" },
  };
  h.db.prepare(`INSERT INTO sync_entities (family, entity_key, book_id, revision, deleted, data_json)
                VALUES ('content', ?, ?, 1, 0, ?)`).run(BOOK, BOOK, JSON.stringify(data));
  const bind = h.db.prepare(`INSERT INTO bindings (occurrence_id, revision_key, cache_key, provenance, bound_at)
                             VALUES (?, ?, ?, 'migration', 1)`);
  bind.run("b0", "legacy:aa", "a".repeat(64));
  bind.run("b1", "legacy:bb", "b".repeat(64));
  bind.run("p0", "legacy:pp", "c".repeat(64));
  const now = Date.now();
  h.db.prepare(`INSERT INTO jobs (job_id, kind, book_id, chapter_index, lane, state, revision, data_json, created_at, updated_at)
                VALUES (?, 'job', ?, 2, 'standard', 'parked_policy', 1, '{}', ?, ?)`).run(PARKED_JOB, BOOK, now, now);
  const occ = h.db.prepare(`INSERT INTO occurrences (job_id, occurrence_id, revision_key, state) VALUES (?, ?, ?, ?)`);
  occ.run(PARKED_JOB, "p0", "legacy:pp", "ready");
  occ.run(PARKED_JOB, "p1", "fp-p1", "pending");
}

async function makeWorld() {
  const bucket = makeFakeR2Bucket();
  const flushStore = createFlushStore(bucket, { keyPrefix: "" });
  const probe = bridgeProbe(bucket, flushStore);
  const h = makeHarness({ probe });
  const store = createGenStore(h.coord);
  store.ensureSchema();
  seedBook(h);
  const sources = createCoordinatorPlaneSource(h.coord);
  const service = createGenerationService({ coord: h.coord, env: h.env, store, sources });
  const providers = makeFakeD6Providers();
  const workSource = createD6WorkSource(h.coord, { cache: null });
  const exec = createD6Executor({ coord: h.coord, store, providers, flushStore, workSource, consumerId: "exec-proj" });
  return { bucket, flushStore, h, store, service, providers, exec };
}

// Drive the chapter-1 plan until e0/e2 are committed.
async function generateChapter1(w) {
  const { h, service, exec } = w;
  const res = await service.submitIntent({
    commandId: "proj-int-1", bookId: BOOK, scope: "chapter", chapterIndex: 1,
    phase: "forever-pucked", lane: "standard",
  });
  assert.equal(res.created, true);
  await service.driveOnce();
  const msg = h.sentGrants[h.sentGrants.length - 1];
  assert.ok(msg, "grant dispatched");
  await exec.handleMessage(msg);
  await service.driveOnce();
  const status = service.planStatus(res.planId);
  assert.equal(status.state, "complete", `plan complete: ${JSON.stringify(status.totals)}`);
  return res.planId;
}

function syncEntity(h, occurrenceId) {
  return h.rows("sync_entities").find(
    r => r.family === "bindings" && r.entity_key === `${BOOK}:${occurrenceId}`);
}
function bindingChanges(h, occurrenceId) {
  return h.rows("sync_changes").filter(
    r => r.family === "bindings" && r.entity_key === `${BOOK}:${occurrenceId}`);
}
// Simulate "the commit landed but publication never happened":
// remove the entity, its change rows, and the projection marker.
function unpublish(h, occurrenceId) {
  h.db.prepare(`DELETE FROM sync_entities WHERE family = 'bindings' AND entity_key = ?`)
    .run(`${BOOK}:${occurrenceId}`);
  h.db.prepare(`DELETE FROM sync_changes WHERE family = 'bindings' AND entity_key = ?`)
    .run(`${BOOK}:${occurrenceId}`);
  h.db.prepare(`DELETE FROM d6_binding_projections WHERE occurrence_id = ?`)
    .run(occurrenceId);
}

test("happy path: commit publishes the binding to the sync plane, server-derived", async () => {
  const w = await makeWorld();
  const { h } = w;
  await generateChapter1(w);
  for (const oid of ["e0", "e2"]) {
    const ent = syncEntity(h, oid);
    assert.ok(ent, `sync binding entity exists for ${oid}`);
    assert.equal(ent.revision, 1);
    const data = JSON.parse(ent.data_json);
    const binding = h.rows("bindings").find(r => r.occurrence_id === oid);
    const exec = h.rows("d6_execution_records").find(
      r => r.occurrence_id === oid && r.state === "committed");
    const idx = h.rows("cache_index").find(r => r.cache_key === binding.cache_key);
    assert.equal(data.cacheKey, binding.cache_key);
    assert.match(data.cacheKey, /^[a-f0-9]{64}$/);
    assert.equal(data.revisionKey, binding.revision_key);
    assert.equal(data.format, idx.format);
    assert.equal(data.size, exec.size_bytes);
    assert.ok(data.size > 0);
    assert.equal(data.sha256, idx.sha256);
    assert.equal(data.provenance, "d6", "provenance is server-written");
    const marker = bindingProjectionMarker(h.coord, oid);
    assert.equal(marker.state, "published");
    assert.equal(isBindingPublished(h.coord, oid), true);
  }
  // Parked chapter: nothing projected, nothing published.
  assert.equal(syncEntity(h, "p1"), undefined);
  assert.equal(isBindingPublished(h.coord, "p1"), false);
});

test("crash between commit and publication: reconciliation publishes", async () => {
  const w = await makeWorld();
  const { h } = w;
  await generateChapter1(w);
  unpublish(h, "e0");
  assert.equal(syncEntity(h, "e0"), undefined);
  assert.equal(isBindingPublished(h.coord, "e0"), false);
  const sweep = reconcileBindingProjections(h.coord, { limit: 50 });
  assert.ok(sweep.published >= 1, `sweep published: ${JSON.stringify(sweep)}`);
  const ent = syncEntity(h, "e0");
  assert.ok(ent, "entity republished by the sweep");
  assert.equal(JSON.parse(ent.data_json).provenance, "d6");
  assert.equal(bindingProjectionMarker(h.coord, "e0").state, "published");
});

test("watchdog integration: driveOnce sweep republishes and reports the outcome", async () => {
  const w = await makeWorld();
  const { h, service } = w;
  await generateChapter1(w);
  unpublish(h, "e2");
  const outcomes = await service.driveOnce();
  const sweep = outcomes.find(o => o.bindingProjection);
  assert.ok(sweep, "driveOnce reports the projection sweep");
  assert.ok(sweep.bindingProjection.published >= 1);
  assert.ok(syncEntity(h, "e2"), "entity republished via the watchdog cycle");
});

test("duplicate sweeps and racing projectors: exactly one publication", async () => {
  const w = await makeWorld();
  const { h } = w;
  await generateChapter1(w);
  unpublish(h, "e0");
  // Interleaved duplicate attempts, then repeated sweeps.
  projectBinding(h.coord, "e0");
  projectBinding(h.coord, "e0");
  reconcileBindingProjections(h.coord, { limit: 50 });
  reconcileBindingProjections(h.coord, { limit: 50 });
  const ent = syncEntity(h, "e0");
  assert.equal(ent.revision, 1, "entity written exactly once");
  assert.equal(bindingChanges(h, "e0").length, 1, "exactly one change row");
  assert.equal(bindingProjectionMarker(h.coord, "e0").state, "published");
});

test("existing equal binding (G10 hand-published shape) is a no-op", async () => {
  const w = await makeWorld();
  const { h } = w;
  await generateChapter1(w);
  // Rewrite e0's entity to the G10 manual-push shape: same cache
  // key, revision key in the migration convention ("fp-<id>").
  const binding = h.rows("bindings").find(r => r.occurrence_id === "e0");
  const manual = { cacheKey: binding.cache_key, revisionKey: "fp-e0",
                   format: "wav", size: 4197164, provenance: "d6" };
  h.db.prepare(`UPDATE sync_entities SET data_json = ? WHERE family = 'bindings' AND entity_key = ?`)
    .run(JSON.stringify(manual), `${BOOK}:e0`);
  h.db.prepare(`DELETE FROM d6_binding_projections WHERE occurrence_id = 'e0'`).run();
  const revBefore = syncEntity(h, "e0").revision;
  const changesBefore = bindingChanges(h, "e0").length;
  const sweep = reconcileBindingProjections(h.coord, { limit: 50 });
  assert.equal(sweep.conflicts, 0, "no false conflict");
  const ent = syncEntity(h, "e0");
  assert.equal(ent.revision, revBefore, "entity not rewritten");
  assert.equal(bindingChanges(h, "e0").length, changesBefore, "no new change rows");
  assert.deepEqual(JSON.parse(ent.data_json), manual, "hand-published payload untouched");
  const marker = bindingProjectionMarker(h.coord, "e0");
  assert.equal(marker.state, "published");
  assert.equal(JSON.parse(marker.detail_json).revisionKeyVariance, true,
    "the revision-key variance is recorded, not repaired");
});

test("a different binding at the destination is never overwritten", async () => {
  const w = await makeWorld();
  const { h } = w;
  await generateChapter1(w);
  const alien = { cacheKey: "f".repeat(64), revisionKey: "legacy:zz",
                  format: "wav", size: 123, provenance: "migration" };
  h.db.prepare(`UPDATE sync_entities SET data_json = ? WHERE family = 'bindings' AND entity_key = ?`)
    .run(JSON.stringify(alien), `${BOOK}:e0`);
  h.db.prepare(`DELETE FROM d6_binding_projections WHERE occurrence_id = 'e0'`).run();
  const revBefore = syncEntity(h, "e0").revision;
  const sweep1 = reconcileBindingProjections(h.coord, { limit: 50 });
  assert.ok(sweep1.conflicts >= 1, "conflict recorded");
  let marker = bindingProjectionMarker(h.coord, "e0");
  assert.equal(marker.state, "conflict");
  const detail = JSON.parse(marker.detail_json);
  const binding = h.rows("bindings").find(r => r.occurrence_id === "e0");
  assert.equal(detail.existing.cacheKey, "f".repeat(64));
  assert.equal(detail.desired.cacheKey, binding.cache_key);
  // A second sweep still does not overwrite.
  reconcileBindingProjections(h.coord, { limit: 50 });
  const ent = syncEntity(h, "e0");
  assert.equal(ent.revision, revBefore);
  assert.deepEqual(JSON.parse(ent.data_json), alien, "alien binding untouched");
  marker = bindingProjectionMarker(h.coord, "e0");
  assert.equal(marker.state, "conflict");
  assert.equal(isBindingPublished(h.coord, "e0"), false,
    "a conflicted binding does not read as published");
});

test("incomplete commit metadata stays pending, then publishes when repaired", async () => {
  const w = await makeWorld();
  const { h } = w;
  await generateChapter1(w);
  const binding = h.rows("bindings").find(r => r.occurrence_id === "e0");
  unpublish(h, "e0");
  // Break the metadata: remove the cache_index anchor (format lost).
  const idxRow = h.rows("cache_index").find(r => r.cache_key === binding.cache_key);
  h.db.prepare(`DELETE FROM cache_index WHERE cache_key = ?`).run(binding.cache_key);
  const r = projectBinding(h.coord, "e0");
  assert.equal(r.status, "pending");
  assert.equal(bindingProjectionMarker(h.coord, "e0").state, "pending");
  assert.equal(syncEntity(h, "e0"), undefined, "nothing half-published");
  // Repair and sweep.
  h.db.prepare(`INSERT INTO cache_index (cache_key, identity, format, sha256, recorded_at)
                VALUES (?, ?, ?, ?, ?)`).run(idxRow.cache_key, idxRow.identity,
    idxRow.format, idxRow.sha256, idxRow.recorded_at);
  const sweep = reconcileBindingProjections(h.coord, { limit: 50 });
  assert.ok(sweep.published >= 1);
  assert.ok(syncEntity(h, "e0"), "published after repair");
  assert.equal(bindingProjectionMarker(h.coord, "e0").state, "published");
});
