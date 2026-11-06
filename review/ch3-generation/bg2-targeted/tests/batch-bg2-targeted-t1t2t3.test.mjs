// ════════════════════════════════════════════════════════════════
// B-G2 TARGETED TEST ADDITIONS — T1 / T2 / T3
//
// Filed separately under Rowan's ruling (WS1 CANDIDATE PASS / WS2
// HOLD CLOSED, board 6690000339): three targeted offline test
// additions against the SAME B-G2 candidate identity (pin
// 9d6f6b85…, MANIFEST.md in bg2-build/). The candidate code is
// NOT changed by these additions; the original exit-run evidence
// (test-logs/exit-run/, 2026-11-06T15:43:04Z) is retained
// untouched and these results are filed separately under
// test-logs/targeted-additions/.
//
//   T1 — cohort quota refusal: a fence-time quota refusal while
//        another occurrence remains in flight. Asserts no
//        premature report, no orphaning, no duplicate submission,
//        and no lost durable custody. (Upgrades implementation-
//        record deviation 7's PARTIAL coverage of the staged
//        quota refusal to direct.)
//   T2 — immediate poll observation: an immediate queue-branch
//        poll creates no drive-pass observation row and does not
//        advance the D-4 observed-pass counter. (Upgrades
//        deviation 6's PARTIAL-narrow coverage to direct.)
//   T3 — CW-09 named case: fault injection after the W6 quota
//        slot increment and before the attempt day stamp; the
//        entire fence bundle rolls back byte-identical.
//        (Upgrades CW-09 from INDIRECT to direct.)
//
// House patterns are the battery's own (batch-bg2-battery.test
// .mjs): same harness (real node:sqlite, throwing .one(), fault
// injector, crash()), same admitted-tree mechanism (behavioral
// tests run against a throwaway copy of the candidate with the
// lane allowlist flipped in the copy only; the candidate tree is
// never edited), same helpers (batchWorld / provider stub /
// bucket copied from the battery), and the snapshotDb full-store
// comparison style of the BG2-F window cases and the S1
// battery's T-NO-MUTATION. Synthetic fixture text only.
// ════════════════════════════════════════════════════════════════

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  cpSync, readFileSync, rmSync, writeFileSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { makeWorld, snapshotDb } from "./harness.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const TREE = join(HERE, "..", "candidate-tree");

// Admitted-tree fixture copy (the battery's §3.13 mechanism,
// verbatim): the candidate tree itself is never edited.
const ADMITTED_TREE = join(HERE, "admitted-tree");
{
  rmSync(ADMITTED_TREE, { recursive: true, force: true });
  cpSync(TREE, ADMITTED_TREE, { recursive: true });
  const p = join(ADMITTED_TREE, "v2", "generation", "gen-constants.mjs");
  const src = readFileSync(p, "utf8");
  const flipped = src.replace('Object.freeze(["standard"])',
    'Object.freeze(["standard", "batch"])');
  if (flipped === src)
    throw new Error("allowlist line not found in the fixture copy");
  writeFileSync(p, flipped);
}

const imp = (tree, rel) =>
  import(pathToFileURL(join(tree, "v2", rel)).href);
async function loadTree(tree = TREE) {
  return {
    adapters: await imp(tree, "host/adapters.mjs"),
    genstore: await imp(tree, "generation/genstore.mjs"),
    d6Executor: await imp(tree, "generation/d6-executor.mjs"),
    constants: await imp(tree, "generation/gen-constants.mjs"),
    quota: await imp(tree, "generation/quota-budget.mjs"),
    flushStore: await imp(tree, "generation/flush-store.mjs"),
    service: await imp(tree, "generation/service.mjs"),
  };
}

// A minimal valid PCM WAV of the given duration (24 kHz mono 16-bit).
function makeWav(seconds = 0.5) {
  const rate = 24000, frames = Math.round(rate * seconds);
  const dataLen = frames * 2;
  const buf = new Uint8Array(44 + dataLen);
  const dv = new DataView(buf.buffer);
  const wstr = (off, s) => { for (let i = 0; i < s.length; i++) buf[off + i] = s.charCodeAt(i); };
  wstr(0, "RIFF"); dv.setUint32(4, 36 + dataLen, true); wstr(8, "WAVE");
  wstr(12, "fmt "); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true);
  dv.setUint16(22, 1, true); dv.setUint32(24, rate, true);
  dv.setUint32(28, rate * 2, true); dv.setUint16(32, 2, true);
  dv.setUint16(34, 16, true); wstr(36, "data"); dv.setUint32(40, dataLen, true);
  return buf;
}

// Scripted provider stub (the battery's, verbatim).
function makeProviderStub(script = {}) {
  const calls = [];
  let seq = 0;
  const batches = new Map();
  const stub = {
    calls, batches,
    async synthesize(occ) {
      calls.push({ method: "synthesize", occurrenceId: occ?.occurrenceId });
      if (script.synthesize) return script.synthesize(occ, stub);
      return { audio: makeWav(0.5), format: "wav", durationSec: 0.5 };
    },
    async submitBatch(occ, displayName) {
      calls.push({ method: "submitBatch",
        occurrenceId: occ?.occurrenceId, displayName });
      if (script.submitBatch) return script.submitBatch(occ, displayName, stub);
      const name = `batches/stub-${++seq}`;
      batches.set(name, { displayName });
      return { name };
    },
    async getBatch(name) {
      calls.push({ method: "getBatch", name });
      if (script.getBatch) return script.getBatch(name, stub);
      const b = batches.get(name);
      if (!b) throw Object.assign(new Error("batch not found"), { httpStatus: 404 });
      if (script.poll) return script.poll(name, b, stub);
      return { done: true, state: "BATCH_STATE_SUCCEEDED",
        audio: makeWav(0.5), format: "wav", durationSec: 0.5 };
    },
    async listBatchesByDisplayName(displayName) {
      calls.push({ method: "listBatchesByDisplayName", displayName });
      if (script.listBatches) return script.listBatches(displayName, stub);
      return [...batches.entries()]
        .filter(([, b]) => b.displayName === displayName)
        .map(([name]) => ({ name, displayName, nameValid: true }));
    },
    verifyNeverAcceptedEvidence() {
      throw new Error("never_accepted_evidence_unverifiable");
    },
  };
  return stub;
}

// R2 stub bucket (the battery's, verbatim).
function makeBucket() {
  const objects = new Map();
  let etagSeq = 0;
  return {
    objects,
    async put(key, value, opts) {
      if (opts?.onlyIf?.etagDoesNotMatch === "*" && objects.has(key))
        return null;
      const bytes = value instanceof Uint8Array
        ? value : new Uint8Array(value);
      const etag = `stub-etag-${++etagSeq}`;
      objects.set(key, { bytes, etag,
        customMetadata: opts?.customMetadata || {} });
      return { etag, size: bytes.byteLength,
        customMetadata: opts?.customMetadata || {} };
    },
    async head(key) {
      const o = objects.get(key);
      return o ? { size: o.bytes.byteLength, etag: o.etag,
        customMetadata: o.customMetadata } : null;
    },
    async get(key) {
      const o = objects.get(key);
      return o ? { arrayBuffer: async () => o.bytes.slice().buffer,
        etag: o.etag, size: o.bytes.byteLength,
        customMetadata: o.customMetadata } : null;
    },
  };
}

const stubCache = {
  async prime() {}, async hydrateKey() { return false; },
  async refreshKey() { return false; },
};

const BATCH_PAYLOAD = Object.freeze({
  text: "Synthetic segment text for offline B-G2 tests.",
  voice: "Charon", provider: "gemini",
  model: "gemini-3.8-flash-tts", styleDirection: "", mode: "batch",
});

// The battery's shared world builder, verbatim: seeds a job of
// any lane DIRECTLY in the store (admission bypassed, per
// §3.13), arms the quota, issues a grant under the host flags
// the production entry stamps, and claims it.
async function batchWorld({
  lane = "batch", jobId = "bg2-job-1", occurrences = ["occ-b1"],
  payload = BATCH_PAYLOAD, kind = "job", armQuota = true,
  consumerId = "bg2-consumer", claimConsumer = null,
  script = {}, envOverrides = {}, workSource = null, tree = TREE,
} = {}) {
  const w = await makeWorld(tree, {
    envOverrides: { GENERATION_HALT: "0", ...envOverrides } });
  const mods = await loadTree(tree);
  const store = mods.genstore.createGenStore(w.coord);
  store.ensureSchema();
  const sub = w.coord._submitJob(
    { jobId, bookId: "book-bg2", chapterIndex: 0, lane,
      occurrences: occurrences.map((id) => typeof id === "string"
        ? { occurrenceId: id, revisionKey: `rev-${id}` } : id),
      data: {} }, `bg2-seed-${jobId}`, kind);
  assert.equal(sub.outcome, "applied", JSON.stringify(sub));
  if (armQuota) mods.quota.bootstrapQuota(w.coord);
  w.coord.env = { ...w.coord.env,
    d6StandardOnly: true, d6HaltFence: true };
  const grant = await w.coord.requestGrant(jobId, { cause: "bg2-test" });
  assert.equal(grant.ok, true, JSON.stringify(grant));
  const claim = w.coord.claimGrant(
    { grantId: grant.grantId, consumerId: claimConsumer || consumerId });
  assert.equal(claim.status, "claimed", JSON.stringify(claim));
  const bucket = makeBucket();
  const probe = {
    _obj(key) {
      for (const ext of ["wav", "mp3"]) {
        const o = bucket.objects.get(`audio/${key}.${ext}`);
        if (o) return { ...o, ext };
      }
      return null;
    },
    exists(key) { return !!this._obj(key); },
    sniff(key) { const o = this._obj(key); return o ? o.ext : null; },
    hash(key) {
      const o = this._obj(key);
      return o ? createHash("sha256").update(o.bytes).digest("hex") : null;
    },
    recordedSha256(key) {
      const o = this._obj(key);
      return o?.customMetadata?.sha256 || null;
    },
    recordedIdentity(key) {
      const o = this._obj(key);
      return o?.customMetadata?.identity || null;
    },
  };
  w.coord.env = { ...w.coord.env, probe };
  const providers = makeProviderStub(script);
  const executor = mods.d6Executor.createD6Executor({
    coord: w.coord, store, providers,
    flushStore: mods.flushStore.createFlushStore(bucket, { keyPrefix: "" }),
    cache: stubCache,
    workSource: workSource || (async () => ({ status: "ok", payload })),
    consumerId });
  return { w, mods, store, grant, executor, providers, bucket, probe,
           jobId, occurrences, payload, consumerId };
}

const driveMessage = (ctx, occurrences = ctx.occurrences) =>
  ctx.executor.handleMessage({ grantId: ctx.grant.grantId,
    jobId: ctx.jobId, occurrences });

const rows = (w, sql, ...args) => w.db.prepare(sql).all(...args);
const oneRow = (w, sql, ...args) => w.db.prepare(sql).get(...args);
const callsOf = (ctx, method) =>
  ctx.providers.calls.filter((x) => x.method === method).length;
const occState = (ctx, oid) => oneRow(ctx.w,
  `SELECT state FROM occurrences WHERE job_id = ? AND occurrence_id = ?`,
  ctx.jobId, oid)?.state;
const grantState = (ctx) => oneRow(ctx.w,
  `SELECT state FROM grants WHERE grant_id = ?`,
  ctx.grant.grantId)?.state;
const attemptOf = (ctx, oid) => {
  const exec = ctx.store.executionFor(ctx.jobId, oid);
  return exec ? ctx.store.attemptsForExecution(exec.execution_id)[0] : null;
};

// ════════════════════════════════════════════════════════════════
// T1 — COHORT QUOTA REFUSAL (direct; upgrades deviation 7 PARTIAL)
// ════════════════════════════════════════════════════════════════
describe("BG2-T1 — cohort quota refusal (targeted addition T1)", () => {
  test("T1: a fence-time quota refusal with an in-flight sibling stages without reporting, orphaning, duplicating, or losing custody — and the refused occurrence re-fences when the cohort completes", async () => {
    const completion = { open: false };
    const ctx = await batchWorld({
      tree: ADMITTED_TREE, occurrences: ["occ-b1", "occ-b2"],
      script: { poll: () => completion.open
        ? { done: true, state: "BATCH_STATE_SUCCEEDED",
            audio: makeWav(0.5), format: "wav", durationSec: 0.5 }
        : { done: false, state: "BATCH_STATE_RUNNING" } },
    });

    // Leg 1: occ-b1 alone fences, submits, and remains IN FLIGHT
    // (its immediate poll returns RUNNING). occ-b2 is untouched.
    const first = await driveMessage(ctx, ["occ-b1"]);
    assert.equal(first.occurrences["occ-b1"].pending, true);
    assert.equal(first.batchReported, undefined);
    assert.equal(callsOf(ctx, "submitBatch"), 1);
    assert.equal(
      ctx.w.coord._latestBatchMap(ctx.jobId, "occ-b1").state, "submitted");

    // Baselines for the refusal leg.
    const resB2Before = oneRow(ctx.w,
      `SELECT * FROM d6_grant_reservations
        WHERE grant_id = ? AND occurrence_id = 'occ-b2'`,
      ctx.grant.grantId);
    assert.equal(resB2Before.slots_consumed, 0);
    const jobBefore = oneRow(ctx.w,
      `SELECT state FROM jobs WHERE job_id = ?`, ctx.jobId).state;
    assert.equal(grantState(ctx), "issued");

    // Stage the fence-time quota refusal for occ-b2 ONLY (the
    // BG2-F technique: zero the reservation's cohort slots, so
    // its W6 check refuses provider_attempt_budget).
    ctx.w.db.prepare(
      `UPDATE d6_grant_reservations SET slots_total = 0
        WHERE occurrence_id = 'occ-b2'`).run();

    // Leg 2: the cohort message. occ-b1 polls (still RUNNING);
    // occ-b2's fence refuses at W6 and the refusal STAGES.
    const second = await driveMessage(ctx, ["occ-b1", "occ-b2"]);
    assert.equal(second.occurrences["occ-b2"].reported, "daily_limit");
    assert.equal(second.occurrences["occ-b2"].quotaBudgetRefusal,
      "provider_attempt_budget");
    assert.equal(second.occurrences["occ-b1"].pending, true);

    // (a) NO PREMATURE REPORT: the staged refusal does not ride
    // a report while occ-b1 is in flight; nothing is reported,
    // parked, or deferred.
    assert.equal(second.batchReported, undefined,
      "no cohort report while a sibling is in flight");
    assert.ok(second.batchCohortPending?.includes("occ-b1"));
    assert.equal(grantState(ctx), "issued");
    assert.equal(oneRow(ctx.w,
      `SELECT state FROM jobs WHERE job_id = ?`, ctx.jobId).state,
      jobBefore);
    assert.equal(occState(ctx, "occ-b2"), "granted");
    assert.equal(rows(ctx.w, `SELECT * FROM quota_parks`).length, 0,
      "the refusal never reached handleReport's park path");

    // (b) NO ORPHANING: occ-b1's durable custody is exactly as
    // leg 1 left it; occ-b2 was not half-created by its rolled-
    // back fence bundle.
    const mapB1 = ctx.w.coord._latestBatchMap(ctx.jobId, "occ-b1");
    assert.equal(mapB1.state, "submitted");
    assert.equal(mapB1.provider_name, "batches/stub-1");
    assert.equal(occState(ctx, "occ-b1"), "granted");
    assert.equal(ctx.w.coord._latestBatchMap(ctx.jobId, "occ-b2"), null);
    assert.equal(ctx.store.executionFor(ctx.jobId, "occ-b2"), null);
    assert.equal(ctx.w.coord._latestIntent(ctx.jobId, "occ-b2"), null);

    // (c) NO DUPLICATE SUBMISSION: exactly one provider POST in
    // the whole scenario so far, and one dispatch row.
    assert.equal(callsOf(ctx, "submitBatch"), 1);
    assert.equal(
      rows(ctx.w, `SELECT * FROM d6_provider_dispatches`).length, 1);

    // (d) NO LOST DURABLE CUSTODY: occ-b1's accounting chain is
    // undisturbed (attempt dispatching, intent open, one slot
    // consumed); occ-b2's reservation consumed nothing.
    assert.equal(attemptOf(ctx, "occ-b1").phase, "dispatching");
    assert.equal(ctx.w.coord._latestIntent(ctx.jobId, "occ-b1").outcome,
      null);
    assert.equal(oneRow(ctx.w,
      `SELECT slots_consumed AS n FROM d6_grant_reservations
        WHERE occurrence_id = 'occ-b1'`).n, 1);
    assert.equal(oneRow(ctx.w,
      `SELECT slots_consumed AS n FROM d6_grant_reservations
        WHERE occurrence_id = 'occ-b2'`).n, 0);

    // Leg 3: custody and non-loss proved constructively. Restore
    // occ-b2's cohort slots; let the provider complete. The
    // cohort finishes: occ-b1 lands its terminal outcome from
    // its ORIGINAL submission, occ-b2 re-fences and submits
    // exactly once, and the report fires exactly at completion.
    ctx.w.db.prepare(
      `UPDATE d6_grant_reservations SET slots_total = ?
        WHERE occurrence_id = 'occ-b2'`).run(resB2Before.slots_total);
    completion.open = true;
    const third = await driveMessage(ctx, ["occ-b1", "occ-b2"]);
    assert.equal(third.batchReported, true);
    assert.equal(grantState(ctx), "reported");
    assert.equal(occState(ctx, "occ-b1"), "ready");
    assert.equal(occState(ctx, "occ-b2"), "ready");
    assert.equal(callsOf(ctx, "submitBatch"), 2,
      "one POST per occurrence across the whole scenario");
    assert.equal(
      rows(ctx.w, `SELECT * FROM d6_provider_dispatches`).length, 2);
    assert.equal(
      ctx.store.attemptsForExecution(
        ctx.store.executionFor(ctx.jobId, "occ-b1").execution_id).length,
      1, "occ-b1 never re-attempted");
    assert.equal(
      ctx.store.attemptsForExecution(
        ctx.store.executionFor(ctx.jobId, "occ-b2").execution_id).length,
      1, "occ-b2 attempted exactly once, on its re-fence");
    assert.equal(rows(ctx.w,
      `SELECT * FROM bindings WHERE occurrence_id = 'occ-b1'`).length, 1);
    assert.equal(rows(ctx.w,
      `SELECT * FROM bindings WHERE occurrence_id = 'occ-b2'`).length, 1);
  });
});

// ════════════════════════════════════════════════════════════════
// T2 — IMMEDIATE POLL OBSERVATION (direct; upgrades deviation 6)
// ════════════════════════════════════════════════════════════════
describe("BG2-T2 — immediate poll observation (targeted addition T2)", () => {
  const observationCount = (ctx) => {
    const present = rows(ctx.w,
      `SELECT name FROM sqlite_master
        WHERE type = 'table' AND name = 'd6_batch_poll_observations'`);
    return present.length === 0 ? 0
      : rows(ctx.w, `SELECT * FROM d6_batch_poll_observations`).length;
  };

  test("T2: immediate polls create zero drive-pass observation rows and never advance the D-4 counter; a drive pass (control) records exactly one", async () => {
    const ctx = await batchWorld({
      tree: ADMITTED_TREE,
      script: { poll: () => ({ done: false, state: "BATCH_STATE_RUNNING" }) },
    });

    // Leg A: one message = fence + submit + the queue branch's
    // immediate poll of the just-submitted job.
    const first = await driveMessage(ctx);
    assert.equal(first.occurrences["occ-b1"].pending, true);
    assert.equal(callsOf(ctx, "getBatch"), 1,
      "the immediate poll really ran (control against a vacuous pass)");
    assert.equal(observationCount(ctx), 0,
      "no drive-pass observation row from the immediate poll");
    assert.equal(ctx.store.batchPollState(ctx.jobId, "occ-b1", 1), null,
      "no poll-state row exists: the D-4 counter was not created, let alone advanced");

    // Its durable accounting is the §3.5 shape (deviation 6's
    // accounting identity, asserted here directly).
    assert.equal(
      ctx.w.coord._latestBatchMap(ctx.jobId, "occ-b1").state, "submitted");
    assert.equal(attemptOf(ctx, "occ-b1").phase, "dispatching");
    assert.equal(ctx.w.coord._latestIntent(ctx.jobId, "occ-b1").outcome,
      null);

    // Leg B: a second message polls the in-flight job immediately
    // again — still no observation, still no counter.
    const second = await driveMessage(ctx);
    assert.equal(second.occurrences["occ-b1"].pending, true);
    assert.equal(callsOf(ctx, "getBatch"), 2);
    assert.equal(observationCount(ctx), 0);
    assert.equal(ctx.store.batchPollState(ctx.jobId, "occ-b1", 1), null);

    // Control: a drive-pass poll DOES record — exactly one
    // observation and the counter at 1 — proving the zeros above
    // are the §3.5 scoping property, not a broken table (the
    // BG2-P driver's own assertions, repeated as the control).
    await ctx.executor.pollBatchPass({ passToken: "t2-p1" });
    assert.equal(callsOf(ctx, "getBatch"), 3);
    assert.equal(observationCount(ctx), 1);
    const state = ctx.store.batchPollState(ctx.jobId, "occ-b1", 1);
    assert.equal(state.consecutive_no_progress_passes, 1);
    assert.equal(state.classification, "BATCH-IN-FLIGHT");
  });
});

// ════════════════════════════════════════════════════════════════
// T3 — CW-09 NAMED CASE (direct; upgrades CW-09 from INDIRECT)
// Fault after the W6 quota slot increment, before the attempt
// day stamp, inside the fence bundle.
// ════════════════════════════════════════════════════════════════
describe("BG2-T3 — CW-09 (targeted addition T3)", () => {
  test("CW-09 (T3): the injection fires on the first statement after the slot increment and the entire bundle rolls back byte-identical", async () => {
    const ctx = await batchWorld();
    const before = snapshotDb(ctx.w.db);
    const writes = [];
    const injected = new Error("injected CW-09 fault (attempt day stamp)");
    const isWrite = (q) => /^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(q);
    ctx.w.faults.sql = {
      error: injected,
      match: (q) => {
        if (isWrite(q)) writes.push(q);
        // The day-stamp statement is unique in the tree:
        // genstore.markDispatching's armed UPDATE carrying both
        // the phase flip and dispatched_day_key (genstore.mjs).
        // The quota bootstrap's stamp has a different shape.
        return q.includes("phase = 'dispatching', dispatched_day_key");
      },
    };
    assert.throws(
      () => ctx.executor.batchFenceBundle({
        grantId: ctx.grant.grantId, jobId: ctx.jobId,
        occurrenceId: "occ-b1", payload: BATCH_PAYLOAD }),
      (e) => e === injected);
    ctx.w.faults.sql = null;

    // The window is exactly CW-09: at fault time, the final
    // three writes attempted inside the bundle are, in order,
    // the W6 dispatch-row insert, the W6 quota slot increment,
    // and the attempt day stamp (the faulted statement itself).
    const tail = writes.slice(-3);
    assert.ok(tail[0].includes("INSERT INTO d6_provider_dispatches"),
      `expected the dispatch insert third-from-last, got: ${tail[0]}`);
    assert.ok(tail[1].includes("slots_consumed = slots_consumed + 1"),
      `expected the slot increment second-from-last, got: ${tail[1]}`);
    assert.ok(tail[2].includes("phase = 'dispatching', dispatched_day_key"),
      `expected the day stamp last, got: ${tail[2]}`);

    // Byte-identical rollback of the ENTIRE bundle (full-store
    // comparison, the T-NO-MUTATION pattern).
    assert.deepEqual(snapshotDb(ctx.w.db), before);

    // Explicit witnesses under the snapshot.
    assert.equal(ctx.store.executionFor(ctx.jobId, "occ-b1"), null);
    assert.equal(
      rows(ctx.w, `SELECT * FROM d6_provider_dispatches`).length, 0);
    assert.equal(oneRow(ctx.w,
      `SELECT slots_consumed AS n FROM d6_grant_reservations
        WHERE occurrence_id = 'occ-b1'`).n, 0);
    assert.equal(ctx.w.coord._latestIntent(ctx.jobId, "occ-b1"), null);
    assert.equal(ctx.w.coord._latestBatchMap(ctx.jobId, "occ-b1"), null);
  });

  test("CW-09 control (T3): the identical bundle unfaulted lands the stamp and the slot together", async () => {
    const ctx = await batchWorld();
    const out = ctx.executor.batchFenceBundle({
      grantId: ctx.grant.grantId, jobId: ctx.jobId,
      occurrenceId: "occ-b1", payload: BATCH_PAYLOAD });
    assert.equal(out.executionId,
      ctx.store.executionFor(ctx.jobId, "occ-b1").execution_id,
      JSON.stringify(out));
    const day = ctx.mods.quota.ptDayKey(ctx.w.coord._now());
    const attempt = attemptOf(ctx, "occ-b1");
    assert.equal(attempt.phase, "dispatching");
    assert.equal(attempt.dispatched_day_key, day);
    assert.equal(oneRow(ctx.w,
      `SELECT slots_consumed AS n FROM d6_grant_reservations
        WHERE occurrence_id = 'occ-b1'`).n, 1);
    assert.equal(
      rows(ctx.w, `SELECT * FROM d6_provider_dispatches`).length, 1);
  });
});
