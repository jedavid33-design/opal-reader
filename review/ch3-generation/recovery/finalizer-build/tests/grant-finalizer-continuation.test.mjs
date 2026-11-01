// Ch 3 Phase A RECOVERY — Option A grant finalizer, CONTINUATION
// level (RECOVERY-PROPOSAL-DRAFT §9.1; Rowan 6551435961 check 5):
// the lost-report stall reproduced ORGANICALLY through the real
// machinery (service driveOnce -> coordinator grant -> D6
// executor), the finalizer applied, and the SAME plan/job then
// driven through bounded cohorts to completion — the 8/7/…
// succession that has never run live.
//
// The stall reproduction is faithful to the diagnosis: the
// executor's per-occurrence commits land through the store
// (attempts confirmed, executions committed, occurrences ready,
// bindings written), and exactly ONE coord.handleReport call —
// the grant closure — is swallowed. Everything else is the real
// code path. Synthetic text only; fake providers; zero real
// provider calls.
import test from "node:test";
import assert from "node:assert/strict";
import { makeHarness } from "./helpers/do-harness.mjs";
import {
  makeFakeR2Bucket, makeFakeD6Providers, sha256HexOf, syntheticWav,
} from "./helpers/d6-fakes.mjs";
import { createGenStore } from "../worker/generation/genstore.mjs";
import { createGenerationService } from "../worker/generation/service.mjs";
import { createCoordinatorPlaneSource } from "../worker/generation/content-plane-adapter.mjs";
import { createD6Executor } from "../worker/generation/d6-executor.mjs";
import { createFlushStore } from "../worker/generation/flush-store.mjs";
import { createD6WorkSource } from "../worker/generation/d6-work-source.mjs";
import { ensureParkReleaseSchema } from "../worker/generation/park-release.mjs";
import {
  bootstrapQuota, derivedDayTotals, ptDayKey,
} from "../worker/generation/quota-budget.mjs";
import {
  previewGrantFinalization, finalizeGrant,
} from "../worker/generation/grant-finalizer.mjs";

const BOOK = "book-fin-e";
const PARKED_JOB = "parked-job-fin-e";
const IDS = Array.from({ length: 24 }, (_, i) => `s${String(i).padStart(2, "0")}`);
const ELIGIBLE_IDS = IDS.slice(0, 23);
const FINAL_ID = IDS[23];
const T_DAY1 = Date.parse("2026-10-31T19:00:00Z"); // PT 2026-10-31
const T_DAY2 = Date.parse("2026-11-01T20:00:00Z"); // PT 2026-11-01

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
  const seg = (occurrenceId, i) => ({
    occurrenceId,
    text: `Synthetic continuation segment ${i} with invented prose for the finalizer harness only.`,
    pov: "pov-a",
  });
  const data = {
    chapters: [{ chapterId: "ch-0", index: 0, segments: IDS.map(seg) }],
    povs: [{ id: "pov-a", name: "Aria",
             voice: { voice_id: "Zephyr", provider: "gemini", model_id: "gemini-3.8-flash-tts", style_direction: "warm" } }],
    defaultVoice: { provider: "gemini", voice_id: "Zephyr" },
  };
  h.db.prepare(`INSERT INTO sync_entities (family, entity_key, book_id, revision, deleted, data_json)
                VALUES ('content', ?, ?, 1, 0, ?)`).run(BOOK, BOOK, JSON.stringify(data));
  // The parked definition job for the same chapter (production
  // shape): all 24 occurrences pending under it; the chapter's
  // final segment is beyond its released set, so the plan will
  // carry it as excluded_parked.
  const now = T_DAY1 - 86400000;
  h.db.prepare(`INSERT INTO jobs (job_id, kind, book_id, chapter_index, lane, state, revision, data_json, created_at, updated_at)
                VALUES (?, 'job', ?, 0, 'standard', 'parked_policy', 1, '{}', ?, ?)`).run(PARKED_JOB, BOOK, now, now);
  const occ = h.db.prepare(`INSERT INTO occurrences (job_id, occurrence_id, revision_key, state) VALUES (?, ?, ?, 'pending')`);
  for (const id of IDS) occ.run(PARKED_JOB, id, `fp-${id}`);
  ensureParkReleaseSchema(h.coord.sql);
  h.db.prepare(`INSERT INTO d6_park_releases (job_id, book_id, chapter_index,
                  occurrence_ids_json, authorization_ref, source, note, released_at, state)
                VALUES (?, ?, 0, ?, 'julie-phase-a-go-fixture', 'operator', NULL, ?, 'live')`)
    .run(PARKED_JOB, BOOK, JSON.stringify(ELIGIBLE_IDS), now);
}

async function makeWorld({ startMs = T_DAY1 } = {}) {
  const bucket = makeFakeR2Bucket();
  const flushStore = createFlushStore(bucket, { keyPrefix: "" });
  const probe = bridgeProbe(bucket, flushStore);
  const h = makeHarness({ probe, startMs, extraEnv: { d6StandardOnly: true } });
  const store = createGenStore(h.coord);
  store.ensureSchema();
  seedBook(h);
  bootstrapQuota(h.coord);
  const sources = createCoordinatorPlaneSource(h.coord);
  const service = createGenerationService({ coord: h.coord, env: h.env, store, sources });
  const providers = makeFakeD6Providers();
  providers.behavior.onCall = (occ) => syntheticWav(occ.payload.text);
  const workSource = createD6WorkSource(h.coord, { cache: null });
  const exec = createD6Executor({
    coord: h.coord, store, providers, flushStore, workSource, consumerId: "exec-fin",
  });
  const res = await service.submitIntent({
    commandId: "intent-fin-e", bookId: BOOK, scope: "chapter", chapterIndex: 0,
    phase: "forever-pucked", lane: "standard", keepGoing: false,
  });
  assert.equal(res.created, true, `intent creates the plan: ${JSON.stringify(res)}`);
  const planId = res.planId;
  const jobRow = h.rows("jobs").find(j => j.job_id.startsWith(planId) && j.state === "generating")
    || h.rows("jobs").find(j => j.job_id.startsWith(planId));
  return { bucket, h, store, service, providers, exec, planId, jobId: jobRow.job_id };
}

// Drive cohort 1 with the executor's report swallowed: the
// organic stall. Returns the grant message.
async function stallCohort1(w) {
  const { h, service, exec } = w;
  const sentBefore = h.sentGrants.length;
  await service.driveOnce();
  assert.equal(h.sentGrants.length, sentBefore + 1, "cohort 1 dispatched");
  const msg = h.sentGrants[h.sentGrants.length - 1];
  assert.equal(msg.occurrences.length, 8, "cohort 1 is the bounded prefix of 8");
  const original = h.coord.handleReport.bind(h.coord);
  let swallowed = 0;
  h.coord.handleReport = async (...args) => { swallowed++; return { ok: true }; };
  try {
    await exec.handleMessage(msg);
  } finally {
    h.coord.handleReport = original;
  }
  assert.equal(swallowed, 1, "exactly one report was swallowed");
  return msg;
}

function assertStalledShape(w, msg) {
  const { h } = w;
  const grant = h.rows("grants").find(g => g.grant_id === msg.grantId);
  assert.equal(grant.state, "issued", "the grant never closed");
  assert.equal(h.rows("claims").find(c => c.grant_id === msg.grantId).state, "claimed");
  const res = h.rows("d6_grant_reservations").filter(r => r.grant_id === msg.grantId);
  assert.equal(res.length, 8);
  assert.ok(res.every(r => r.state === "open"), "all eight reservations leaked open");
  const view = h.coord.jobView(w.jobId);
  assert.equal(view.occurrences.filter(o => o.state === "ready").length, 8);
  assert.equal(view.occurrences.filter(o => o.state === "pending").length, 15);
  assert.equal(w.providers.calls.length, 8, "eight provider calls, all committed");
}

test("continuation: stall -> redelivery no-op -> driver refusal -> finalize -> multi-cohort completion on the SAME plan/job", async () => {
  const w = await makeWorld();
  const { h, service, exec } = w;
  const msg = await stallCohort1(w);
  assertStalledShape(w, msg);
  const day = ptDayKey(T_DAY1);
  assert.deepEqual(derivedDayTotals(h.coord, day),
    { dayKey: day, dispatched: 8, reserved: 88, consumed: 96 },
    "the leak: 8 consumed + 88 still-reserved slots");

  // Redelivery of the same message: no provider calls, no report,
  // nothing moves — the production stall's defining property.
  await exec.handleMessage(msg);
  assert.equal(w.providers.calls.length, 8, "redelivery synthesized nothing");
  assertStalledShape(w, msg);

  // The driver refuses a second grant while one reads issued.
  const grantsBefore = h.rows("grants").length;
  await service.driveOnce();
  assert.equal(h.rows("grants").length, grantsBefore, "driveOnce issued no cohort 2");
  assert.equal(h.rows("grants").filter(g => g.state === "issued").length, 1);

  // The finalizer: preview derives finalizable against the REAL
  // machinery's records; the action closes exactly the grant.
  const p = previewGrantFinalization(h.coord, w.store,
    { grantId: msg.grantId, planId: w.planId, jobId: w.jobId });
  assert.equal(p.outcome, "preview", JSON.stringify(p));
  assert.equal(p.classification, "finalizable");
  assert.equal(p.state.attemptsTotal, 8);
  assert.deepEqual(p.state.reservations,
    { count: 8, dayKey: day, slotsTotal: 96, slotsConsumed: 8, residual: 88 });
  const fin = finalizeGrant(h.coord, w.store, {
    grantId: msg.grantId, planId: w.planId, jobId: w.jobId,
    authorizationRef: "julie-gate-4-fixture",
    expectedPreconditionDigest: p.preconditionDigest,
  });
  assert.equal(fin.outcome, "applied", JSON.stringify(fin));
  assert.deepEqual(derivedDayTotals(h.coord, day),
    { dayKey: day, dispatched: 8, reserved: 0, consumed: 8 },
    "the reservation leak is released; the 8 real dispatches stay counted");

  // Continuation: cohort 2 is sized by the day's remaining
  // headroom (consumed 8 -> 7 fit), against the SAME plan/job.
  const grantIds = [msg.grantId];
  const cohortSizes = [];
  for (let round = 0; round < 6; round++) {
    const status = service.planStatus(w.planId);
    if (status.state === "complete") break;
    const sentBefore = h.sentGrants.length;
    await service.driveOnce();
    if (h.sentGrants.length === sentBefore) continue;
    const m = h.sentGrants[h.sentGrants.length - 1];
    grantIds.push(m.grantId);
    cohortSizes.push(m.occurrences.length);
    await exec.handleMessage(m);
  }
  assert.equal(cohortSizes[0], 7, "same-day cohort 2 = 7 (the 8/7/… succession)");
  assert.deepEqual(cohortSizes, [7, 7, 1], "bounded cohorts drain the 15 remainder");
  assert.equal(new Set(grantIds).size, 4, "four distinct grants, no cycling");
  assert.ok(h.rows("grants").every(g => g.job_id === w.jobId),
    "every grant belongs to the same job");
  assert.equal(w.providers.calls.length, 23, "exactly one call per eligible segment");
  const status = service.planStatus(w.planId);
  assert.equal(status.state, "complete");
  assert.equal(status.totals.done, 23);
  assert.equal(h.coord.jobView(w.jobId).state, "complete");
  // The excluded final segment was never generated.
  assert.equal(h.rows("d6_execution_records").filter(r => r.occurrence_id === FINAL_ID).length, 0);
  assert.deepEqual(derivedDayTotals(h.coord, day),
    { dayKey: day, dispatched: 23, reserved: 0, consumed: 23 });
});

test("continuation: on a fresh day the first continuation cohort is a full 8", async () => {
  const w = await makeWorld();
  const { h, service, exec } = w;
  const msg = await stallCohort1(w);
  assertStalledShape(w, msg);
  const p = previewGrantFinalization(h.coord, w.store,
    { grantId: msg.grantId, planId: w.planId, jobId: w.jobId });
  assert.equal(p.classification, "finalizable");
  const fin = finalizeGrant(h.coord, w.store, {
    grantId: msg.grantId, planId: w.planId, jobId: w.jobId,
    authorizationRef: "julie-gate-4-fixture",
    expectedPreconditionDigest: p.preconditionDigest,
  });
  assert.equal(fin.outcome, "applied");
  // Midnight passes; the new day's derived total is zero, so the
  // continuation cohort is a full first-cohort 8 of the 15 left.
  h.setNow(T_DAY2);
  const sentBefore = h.sentGrants.length;
  await service.driveOnce();
  assert.equal(h.sentGrants.length, sentBefore + 1);
  const m2 = h.sentGrants[h.sentGrants.length - 1];
  assert.equal(m2.occurrences.length, 8, "fresh-day cohort = 8");
  await exec.handleMessage(m2);
  assert.equal(w.providers.calls.length, 16);
  const view = h.coord.jobView(w.jobId);
  assert.equal(view.occurrences.filter(o => o.state === "ready").length, 16);
  assert.equal(view.occurrences.filter(o => o.state === "pending").length, 7);
});
