// gen-pkg-1 — server intent identity (Rowan obligation 3).
//
// submitIntent keys a plan by a hash of (book, scope, chapter,
// segment, THE ELIGIBLE ID SET ITSELF), computed from a FRESH
// builder pass on every submission. These tests prove:
//   * identical simultaneous submissions (two service instances =
//     two devices over one coordinator) converge on ONE plan and
//     ONE job set — no double creation, no double spend surface;
//   * a retry after a lost response returns the same plan;
//   * a later intentional run over a CHANGED eligible set (segments
//     newly eligible after a voice mapping lands; segments bound by
//     an earlier completed plan) is a NEW plan — the identity never
//     swallows new work behind a stale completed plan;
//   * resubmitting the identical (now-empty) set is stable: it
//     returns the same completed plan rather than minting plans
//     forever.
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

const BOOK = "book-fp-mini";
const T = (id) => `Synthetic prose for segment ${id}, invented for the idempotency harness only.`;

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

function fpBookData() {
  const seg = (occurrenceId, text) => ({ occurrenceId, text, pov: "pov-a" });
  return {
    chapters: [
      { chapterId: "ch-1", index: 1, segments: [seg("e0", T("e0")), seg("e2", T("e2"))] },
    ],
    povs: [{ id: "pov-a", name: "Aria", voice: { voice_id: "Zephyr", provider: "gemini", model_id: "gemini-3.8-flash-tts", style_direction: "warm" } }],
    defaultVoice: { provider: "gemini", voice_id: "Zephyr" },
  };
}

async function makeWorld(bookData, bookId = BOOK) {
  const bucket = makeFakeR2Bucket();
  const flushStore = createFlushStore(bucket, { keyPrefix: "" });
  const probe = bridgeProbe(bucket, flushStore);
  const h = makeHarness({ probe });
  const store = createGenStore(h.coord);
  store.ensureSchema();
  h.db.prepare(`INSERT INTO sync_entities (family, entity_key, book_id, revision, deleted, data_json)
                VALUES ('content', ?, ?, 1, 0, ?)`).run(bookId, bookId, JSON.stringify(bookData));
  const sources = createCoordinatorPlaneSource(h.coord);
  const mkService = () => createGenerationService({ coord: h.coord, env: h.env, store, sources });
  const providers = makeFakeD6Providers();
  const workSource = createD6WorkSource(h.coord, { cache: null });
  const exec = createD6Executor({ coord: h.coord, store, providers, flushStore, workSource, consumerId: "exec-idem" });
  return { bucket, flushStore, h, store, mkService, service: mkService(), providers, exec };
}

test("simultaneous identical submissions from two devices converge on one plan", async () => {
  const w = await makeWorld(fpBookData());
  const { h } = w;
  const deviceA = w.mkService();
  const deviceB = w.mkService();
  const intent = { bookId: BOOK, scope: "chapter", chapterIndex: 1,
                   phase: "forever-pucked", lane: "standard" };
  const [ra, rb] = await Promise.all([
    deviceA.submitIntent({ commandId: "dev-a-1", ...intent }),
    deviceB.submitIntent({ commandId: "dev-b-1", ...intent }),
  ]);
  assert.equal(ra.planId, rb.planId, "both devices land on the same plan");
  assert.equal([ra.created, rb.created].filter(Boolean).length, 1,
    "exactly one of them created it");
  assert.equal(h.rows("d6_plans").length, 1, "one plan row");
  assert.equal(h.rows("d6_plan_jobs").length, 1, "one job link");
  assert.equal(h.rows("jobs").filter(j => j.job_id.startsWith(ra.planId)).length, 1,
    "one chapter job — no double spend surface");
});

test("retry after a lost response returns the same plan, still one job", async () => {
  const w = await makeWorld(fpBookData());
  const { h, service } = w;
  const intent = { bookId: BOOK, scope: "book", keepGoing: true,
                   phase: "forever-pucked", lane: "standard" };
  const first = await service.submitIntent({ commandId: "try-1", ...intent });
  // The response is "lost": the client retries with a NEW command id.
  const retry = await service.submitIntent({ commandId: "try-2", ...intent });
  assert.equal(retry.planId, first.planId);
  assert.equal(retry.created, false);
  assert.equal(h.rows("d6_plans").length, 1);
  assert.equal(h.rows("d6_plan_jobs").length, 1);
});

test("a later run for newly eligible segments is a NEW plan, not the stale one", async () => {
  // One live-voice segment + one azure segment (voice_prompt).
  const data = {
    chapters: [{ chapterId: "g-0", index: 0, segments: [
      { occurrenceId: "g0", text: T("g0"), pov: "pov-s" },
      { occurrenceId: "g2", text: T("g2"), pov: "pov-a" },
    ] }],
    povs: [
      { id: "pov-s", name: "Sabrina", voice: { voice_id: "en-US-SaraNeural", provider: "azure", model_id: "azure-tts", style_direction: "" } },
      { id: "pov-a", name: "Aria", voice: { voice_id: "Zephyr", provider: "gemini", model_id: "gemini-3.8-flash-tts", style_direction: "" } },
    ],
    defaultVoice: { provider: "gemini", voice_id: "Zephyr" },
  };
  const w = await makeWorld(data, "book-goal-mini");
  const { h, service, exec } = w;
  const a = await service.submitIntent({
    commandId: "map-1", bookId: "book-goal-mini", scope: "book",
    phase: null, lane: "standard",
  });
  const statusA = service.planStatus(a.planId);
  assert.deepEqual(
    statusA.entries.map(e => [e.occurrenceId, e.disposition]).sort(),
    [["g0", "voice_prompt"], ["g2", "eligible"]]);
  // Julie records a mapping: the cast voice now resolves to a live
  // provider in the book's content (the mapping DECISION is hers;
  // here it is fixture data).
  const updated = JSON.parse(JSON.stringify(data));
  updated.povs[0].voice = { voice_id: "Aoede", provider: "gemini", model_id: "gemini-3.8-flash-tts", style_direction: "" };
  h.db.prepare(`UPDATE sync_entities SET data_json = ? WHERE family = 'content' AND entity_key = 'book-goal-mini'`)
    .run(JSON.stringify(updated));
  // Round 2 (R2-2): while plan A is still ACTIVE, the expanded
  // set still overlaps A's eligible entry (g2), so the fence —
  // not the stale plan, and not a duplicate plan — answers: a
  // named conflict. (Round 1 minted the new plan immediately;
  // Rowan's round-2 fence supersedes that for overlapping sets.)
  const fenced = await service.submitIntent({
    commandId: "map-2a", bookId: "book-goal-mini", scope: "book",
    phase: null, lane: "standard",
  });
  assert.equal(fenced.outcome, "rejected");
  assert.equal(fenced.reason, "plan_overlap_conflict");
  assert.equal(fenced.conflict.planId, a.planId);
  assert.equal(h.rows("d6_plans").length, 1, "the fenced attempt created nothing");
  // Drive plan A to completion for real: its one eligible segment
  // is generated and bound.
  await service.driveOnce();
  await exec.handleMessage(h.sentGrants[h.sentGrants.length - 1]);
  await service.driveOnce();
  assert.equal(service.planStatus(a.planId).state, "complete");
  // Now the later run mints its NEW plan (never the stale one):
  // the newly eligible segment is its work; the segment plan A
  // bound reads bound_already, so the sets no longer overlap.
  const b = await service.submitIntent({
    commandId: "map-2", bookId: "book-goal-mini", scope: "book",
    phase: null, lane: "standard",
  });
  assert.equal(b.created, true, "the changed set mints a new plan");
  assert.notEqual(b.planId, a.planId);
  const statusB = service.planStatus(b.planId);
  assert.deepEqual(
    statusB.entries.filter(e => e.disposition === "eligible").map(e => e.occurrenceId).sort(),
    ["g0"], "the newly eligible segment is the new plan's eligible work");
  assert.deepEqual(
    statusB.entries.map(e => [e.occurrenceId, e.disposition]).sort(),
    [["g0", "eligible"], ["g2", "bound_already"]],
    "the segment the completed plan bound is not re-planned");
  // Plan A is untouched by the new submission.
  assert.equal(service.planStatus(a.planId).entries.length, 2);
  assert.equal(service.planStatus(a.planId).state, "complete");
});

test("after completion, resubmission over the shrunk set is a new plan; the empty set is then stable", async () => {
  const w = await makeWorld(fpBookData());
  const { h, service, exec } = w;
  const intent = { bookId: BOOK, scope: "chapter", chapterIndex: 1,
                   phase: "forever-pucked", lane: "standard" };
  const a = await service.submitIntent({ commandId: "done-1", ...intent });
  await service.driveOnce();
  await exec.handleMessage(h.sentGrants[h.sentGrants.length - 1]);
  await service.driveOnce();
  assert.equal(service.planStatus(a.planId).state, "complete");
  // Both segments are bound now: the eligible set is empty, so the
  // identity differs from plan A's — a NEW plan records that there
  // is nothing to do (it does NOT resurrect or re-run plan A).
  const b = await service.submitIntent({ commandId: "done-2", ...intent });
  assert.equal(b.created, true);
  assert.notEqual(b.planId, a.planId);
  assert.equal(b.state, "complete");
  assert.equal(service.planStatus(b.planId).stopReason, "nothing_eligible");
  assert.equal(h.rows("d6_plan_jobs").filter(r => r.plan_id === b.planId).length, 0,
    "no jobs minted for an empty set");
  // And the empty-set identity is itself stable.
  const c = await service.submitIntent({ commandId: "done-3", ...intent });
  assert.equal(c.planId, b.planId);
  assert.equal(c.created, false);
  assert.equal(h.rows("d6_plans").length, 2, "exactly two plans total");
});
