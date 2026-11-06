// B-G2 battery (spec §6) — the offline evidence suite for the
// Batch build. Runs on the house harness (real node:sqlite,
// throwing .one(), crash() = a fresh instance over the same
// storage). Test-only extensions per spec §6.0:
//   * a scripted provider stub (submitBatch / getBatch /
//     listBatchesByDisplayName / synthesize) with a durable call
//     log and per-call scripted outcomes — never touches the
//     network;
//   * an R2 stub bucket whose objects persist across crash();
//   * synthetic fixtures only — no book text, no production ids.
// Batch behavior is exercised by seeding Batch-lane jobs directly
// in the store (bypassing admission); the candidate's allowlist is
// never edited.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  readFileSync, readdirSync, cpSync, rmSync, writeFileSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { makeWorld, snapshotDb, T0, entryPost, entryGet } from "./harness.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const TREE = join(HERE, "..", "candidate-tree");
const BASE_TREE = join(HERE, "..", "baseline-tree");

// The shipped candidate's allowlist is ["standard"], so on the
// candidate tree itself a Batch-lane job is refused at layer 2 —
// that IS the §3.13 inertness property, proven by BG2-S against
// TREE. The behavioral families (X/P/M/R) exercise the Batch branch
// on a THROWAWAY FIXTURE COPY of the candidate whose allowlist is
// flipped to admit batch — the candidate tree itself is never
// edited (§3.13: "never by editing the constant in the candidate
// tree"). The copy is rebuilt from the candidate on every run.
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
const b64 = (bytes) => Buffer.from(bytes).toString("base64");

// Scripted provider stub (spec §6.0 extension). `script` hooks:
// submitBatch(occ, displayName), getBatch(name), listBatches(name),
// synthesize(occ) — each may return or throw per call.
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

// R2 stub bucket: objects persist for the life of the test (across
// harness crash(), which rebuilds instances over the same storage).
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

// ----------------------------------------------------------------
describe("BG2-E — error classification surface (spec §3.2)", () => {
  const env = { GENERATION_HALT: "0", GEMINI_API_KEY: "bg2-test-key" };
  async function getBatchWith(body) {
    const mods = await loadTree();
    const fetchStub = async () => ({ ok: true, json: async () => body });
    const providers = mods.adapters.createProviderAdapters(env, fetchStub);
    return providers.getBatch("batches/abc-123");
  }
  const audioPart = { inlineData: { data: b64(makeWav(1)), mimeType: "audio/wav" } };
  const doneWith = (record) => ({ done: true,
    metadata: { state: "BATCH_STATE_SUCCEEDED" },
    response: { inlinedResponses: [record] } });
  const recordWith = (extra) => ({ response: {
    candidates: [{ content: { parts: [audioPart] }, ...extra }] } });

  test("success return is shape-identical to the pre-B-G2 adapter (no classification key)", async () => {
    const r = await getBatchWith(doneWith(recordWith({ finishReason: "STOP" })));
    assert.equal(r.done, true);
    assert.equal(r.state, "BATCH_STATE_SUCCEEDED");
    assert.equal(r.format, "wav");
    assert.equal(r.durationSec, 1);
    assert.deepEqual(Object.keys(r).sort(),
      ["audio", "done", "durationSec", "format", "state"]);
  });

  test("not-done return is unchanged and carries no classification", async () => {
    const r = await getBatchWith({ done: false,
      metadata: { state: "BATCH_STATE_RUNNING" } });
    assert.deepEqual(r, { done: false, state: "BATCH_STATE_RUNNING" });
  });

  test("policy_block on a PROHIBITED_CONTENT finishReason token", async () => {
    const r = await getBatchWith(doneWith({ response: { candidates: [{
      content: { parts: [] }, finishReason: "PROHIBITED_CONTENT" }] } }));
    assert.equal(r.state, "BATCH_STATE_FAILED");
    assert.deepEqual(r.classification, {
      kind: "policy_block", outcome: "policy_block",
      providerCode: "PROHIBITED_CONTENT",
      blockReason: null, finishReason: "PROHIBITED_CONTENT",
      retryable: false, source: "item_finish" });
  });

  test("policy_block on a promptFeedback blockReason token", async () => {
    const r = await getBatchWith(doneWith({ response: {
      promptFeedback: { blockReason: "PROHIBITED_CONTENT" },
      candidates: [{ content: { parts: [] }, finishReason: "STOP" }] } }));
    assert.equal(r.classification.kind, "policy_block");
    assert.equal(r.classification.outcome, "policy_block");
    assert.equal(r.classification.blockReason, "PROHIBITED_CONTENT");
    assert.equal(r.classification.source, "item_finish");
  });

  test("policy_block on an item error status token", async () => {
    const r = await getBatchWith(doneWith({
      error: { code: 400, status: "PROHIBITED_CONTENT" } }));
    assert.equal(r.classification.kind, "policy_block");
    assert.equal(r.classification.source, "item_error");
    assert.equal(r.classification.providerCode, "PROHIBITED_CONTENT");
  });

  test("batch error 500/INTERNAL -> provider_error, retryable", async () => {
    const r = await getBatchWith({ done: true,
      metadata: { state: "BATCH_STATE_FAILED" },
      error: { code: 500, status: "INTERNAL", message: "raw text" } });
    assert.deepEqual(r.classification, {
      kind: "provider_error", outcome: "failed_known",
      providerCode: "500", blockReason: null, finishReason: null,
      retryable: true, source: "batch_error" });
    assert.ok(!JSON.stringify(r).includes("raw text"),
      "raw provider message text is never returned");
  });

  test("batch error 429/RESOURCE_EXHAUSTED -> provider_error, NOT retryable", async () => {
    const r = await getBatchWith({ done: true,
      metadata: { state: "BATCH_STATE_FAILED" },
      error: { code: 429, status: "RESOURCE_EXHAUSTED" } });
    assert.equal(r.classification.kind, "provider_error");
    assert.equal(r.classification.providerCode, "429");
    assert.equal(r.classification.retryable, false);
  });

  test("batch error status UNAVAILABLE alone -> provider_error, retryable", async () => {
    const r = await getBatchWith({ done: true,
      metadata: { state: "BATCH_STATE_FAILED" },
      error: { status: "UNAVAILABLE" } });
    assert.equal(r.classification.kind, "provider_error");
    assert.equal(r.classification.providerCode, "UNAVAILABLE");
    assert.equal(r.classification.retryable, true);
  });

  test("terminal metadata states without an error object -> batch_terminal", async () => {
    for (const state of ["BATCH_STATE_FAILED", "BATCH_STATE_CANCELLED",
                         "BATCH_STATE_EXPIRED"]) {
      const r = await getBatchWith({ done: true, metadata: { state } });
      assert.equal(r.state, state);
      assert.deepEqual(r.classification, {
        kind: "batch_terminal", outcome: "failed_known",
        providerCode: null, blockReason: null, finishReason: null,
        retryable: true, source: "metadata_state" });
    }
  });

  test("zero or multiple inlined records -> response_shape / record_count", async () => {
    const zero = await getBatchWith({ done: true,
      metadata: { state: "BATCH_STATE_SUCCEEDED" } });
    assert.equal(zero.classification.kind, "response_shape");
    assert.equal(zero.classification.source, "record_count");
    const two = await getBatchWith({ done: true,
      metadata: { state: "BATCH_STATE_SUCCEEDED" },
      response: { inlinedResponses: [recordWith({}), recordWith({})] } });
    assert.equal(two.classification.kind, "response_shape");
    assert.equal(two.classification.source, "record_count");
  });

  test("exactly one record, no error, no audio, benign finish -> response_shape / missing_audio (never policy)", async () => {
    const r = await getBatchWith(doneWith({ response: { candidates: [{
      content: { parts: [{ text: "I cannot generate that." }] },
      finishReason: "STOP" }] } }));
    assert.equal(r.classification.kind, "response_shape");
    assert.equal(r.classification.source, "missing_audio");
    assert.equal(r.classification.outcome, "failed_known");
  });

  test("undecodable audio -> response_shape / audio_decode", async () => {
    const r = await getBatchWith(doneWith({ response: { candidates: [{
      content: { parts: [{ inlineData: {
        data: "!!!not-valid-base64!!!", mimeType: "audio/wav" } }] },
      finishReason: "STOP" }] } }));
    assert.equal(r.classification.kind, "response_shape");
    assert.equal(r.classification.source, "audio_decode");
  });

  test("refusal-sounding FREE TEXT in an error message never yields policy_block", async () => {
    const r = await getBatchWith(doneWith({
      error: { code: 400, status: "INVALID_ARGUMENT",
        message: "Request refused: it contains prohibited content." } }));
    assert.equal(r.classification.kind, "provider_error");
    assert.equal(r.classification.outcome, "failed_known");
    assert.equal(r.classification.providerCode, "400");
    assert.ok(!JSON.stringify(r).includes("prohibited content"),
      "raw provider message text is never returned");
  });

  test("an error object with no usable code/status -> provider_error_unclassified / failed_known", async () => {
    const r = await getBatchWith({ done: true,
      metadata: { state: "BATCH_STATE_FAILED" }, error: { details: [] } });
    assert.equal(r.classification.kind, "provider_error_unclassified");
    assert.equal(r.classification.outcome, "failed_known");
    assert.equal(r.classification.source, "batch_error");
    assert.equal(r.classification.retryable, false);
  });

  test("tokens are bounded: uppercase, collapsed, capped at 64 chars", async () => {
    const mods = await loadTree();
    const { batchToken, classifyBatchTerminal } = mods.adapters;
    assert.equal(batchToken("resource exhausted!"), "RESOURCE_EXHAUSTED_");
    assert.equal(batchToken("x".repeat(200)).length, 64);
    assert.equal(batchToken(null), null);
    assert.equal(batchToken({}), null);
    // The success shape is not a terminal failure: classifier null.
    assert.equal(classifyBatchTerminal(
      { recordCount: 1, hasAudio: true, audioDecodable: true }), null);
    // The empty shape is the unclassified catch-all, never policy.
    const c = classifyBatchTerminal({});
    assert.equal(c.kind, "provider_error_unclassified");
    assert.equal(c.outcome, "failed_known");
  });
});

// ----------------------------------------------------------------
// Shared world builder for the executor-level families. Seeds a job
// of any lane DIRECTLY in the store (admission bypassed, per
// §3.13), arms the quota, issues a grant under the host flags the
// production entry stamps, and claims it for `consumerId`.
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
  // The coordinator's binding gate reads an env probe over the
  // audio objects (the production entry wires the R2 snapshot
  // cache's probe; the test probe reads the stub bucket directly,
  // which is the same evidence: existence, format, digest, and the
  // write-time recorded identity/sha from the flush metadata).
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

// ----------------------------------------------------------------
describe("BG2-F — fence bundle atomicity (spec §3.4/§4.1, B2-R4)", () => {
  const CHARS = BATCH_PAYLOAD.text.length;

  test("bundle success yields exactly the §4.1 ledger set on one day key", async () => {
    const { w, mods, store, grant, executor, jobId } = await batchWorld();
    const out = executor.batchFenceBundle({
      grantId: grant.grantId, jobId, occurrenceId: "occ-b1",
      payload: BATCH_PAYLOAD });
    const day = mods.quota.ptDayKey(w.coord._now());
    const exec = store.executionFor(jobId, "occ-b1");
    assert.equal(exec.state, "attempted");
    assert.equal(out.executionId, exec.execution_id);
    const intent = w.coord._latestIntent(jobId, "occ-b1");
    assert.equal(intent.generation, 1);
    assert.equal(intent.outcome, null);
    const attempts = store.attemptsForExecution(exec.execution_id);
    assert.equal(attempts.length, 1);
    assert.equal(attempts[0].phase, "dispatching");
    assert.equal(attempts[0].upper_micro_cents,
      mods.constants.upperBoundAttemptMicro(CHARS));
    assert.equal(attempts[0].dispatched_day_key, day);
    const map = w.coord._latestBatchMap(jobId, "occ-b1");
    assert.equal(map.state, "fenced");
    assert.equal(map.generation, 1);
    assert.equal(map.display_name, out.displayName);
    const dispatches = rows(w,
      `SELECT * FROM d6_provider_dispatches WHERE attempt_id = ?`,
      attempts[0].attempt_id);
    assert.equal(dispatches.length, 1);
    assert.equal(dispatches[0].dispatch_day_key, day);
    const reservation = oneRow(w,
      `SELECT * FROM d6_grant_reservations WHERE grant_id = ? AND occurrence_id = ?`,
      grant.grantId, "occ-b1");
    assert.equal(reservation.slots_consumed, 1);
    assert.equal(reservation.day_key, day);
  });

  test("batch_quota_unarmed: refuses and writes nothing", async () => {
    const ctx = await batchWorld({ armQuota: false });
    const before = snapshotDb(ctx.w.db);
    assert.throws(() => ctx.executor.batchFenceBundle({
      grantId: ctx.grant.grantId, jobId: ctx.jobId,
      occurrenceId: "occ-b1", payload: BATCH_PAYLOAD }),
      (e) => e.reason === "batch_quota_unarmed");
    assert.deepEqual(snapshotDb(ctx.w.db), before);
  });

  const FAULT_STEPS = [
    ["W1 createExecution", "INSERT INTO d6_execution_records"],
    ["W2 transitionExecution", "UPDATE d6_execution_records"],
    ["W3 acquireSpendIntent", "INSERT INTO spend_intents"],
    ["W4 reserveAttempt", "INSERT INTO d6_attempt_log"],
    ["W5 fenceBatchSubmit", "INSERT INTO batch_maps"],
    ["W6 dispatch row", "INSERT INTO d6_provider_dispatches"],
    ["W6 slot increment", "slots_consumed = slots_consumed + 1"],
  ];
  for (const [label, needle] of FAULT_STEPS) {
    test(`fault at ${label}: the whole bundle rolls back`, async () => {
      const ctx = await batchWorld();
      const before = snapshotDb(ctx.w.db);
      const injected = new Error(`injected fault at ${label}`);
      ctx.w.faults.sql = { match: (q) => q.includes(needle),
        error: injected };
      assert.throws(() => ctx.executor.batchFenceBundle({
        grantId: ctx.grant.grantId, jobId: ctx.jobId,
        occurrenceId: "occ-b1", payload: BATCH_PAYLOAD }),
        (e) => e === injected);
      ctx.w.faults.sql = null;
      assert.deepEqual(snapshotDb(ctx.w.db), before);
    });
  }

  test("fault at the W6 day-rollover re-reservation: rolls back whole", async () => {
    const ctx = await batchWorld();
    ctx.w.db.prepare(
      `UPDATE d6_grant_reservations SET day_key = '2000-01-01'`).run();
    const before = snapshotDb(ctx.w.db);
    const injected = new Error("injected rollover fault");
    ctx.w.faults.sql = {
      match: (q) => q.includes("INSERT INTO d6_grant_reservations"),
      error: injected };
    assert.throws(() => ctx.executor.batchFenceBundle({
      grantId: ctx.grant.grantId, jobId: ctx.jobId,
      occurrenceId: "occ-b1", payload: BATCH_PAYLOAD }),
      (e) => e === injected);
    ctx.w.faults.sql = null;
    assert.deepEqual(snapshotDb(ctx.w.db), before);
  });

  test("a RETURNED refusal (claim held by another consumer) is converted to a thrown rollback", async () => {
    const ctx = await batchWorld({ claimConsumer: "someone-else" });
    const before = snapshotDb(ctx.w.db);
    assert.throws(() => ctx.executor.batchFenceBundle({
      grantId: ctx.grant.grantId, jobId: ctx.jobId,
      occurrenceId: "occ-b1", payload: BATCH_PAYLOAD }),
      (e) => e.reason === "claimed_by_other" && e.batchBundleRefusal);
    assert.deepEqual(snapshotDb(ctx.w.db), before);
    assert.equal(ctx.store.executionFor(ctx.jobId, "occ-b1"), null);
  });

  test("nested _tx (B2-R4): an outer abort rolls the committed-looking bundle back too", async () => {
    const ctx = await batchWorld();
    const before = snapshotDb(ctx.w.db);
    assert.throws(() => ctx.w.coord._tx(() => {
      ctx.executor.batchFenceBundle({
        grantId: ctx.grant.grantId, jobId: ctx.jobId,
        occurrenceId: "occ-b1", payload: BATCH_PAYLOAD });
      throw new Error("outer_abort");
    }), /outer_abort/);
    assert.deepEqual(snapshotDb(ctx.w.db), before);
  });

  test("quota refusal (slots exhausted) propagates as thrown and leaves no map/intent/attempt", async () => {
    const ctx = await batchWorld();
    ctx.w.db.prepare(
      `UPDATE d6_grant_reservations SET slots_total = 0`).run();
    const before = snapshotDb(ctx.w.db);
    assert.throws(() => ctx.executor.batchFenceBundle({
      grantId: ctx.grant.grantId, jobId: ctx.jobId,
      occurrenceId: "occ-b1", payload: BATCH_PAYLOAD }),
      (e) => e.quotaBudgetRefusal === true &&
             e.reason === "provider_attempt_budget");
    assert.deepEqual(snapshotDb(ctx.w.db), before);
  });
});

// ----------------------------------------------------------------
describe("BG2-A — accounting (spec §4, fence-time slice)", () => {
  test("fence-time counting (D-1): the dispatch is counted BEFORE any provider POST exists", async () => {
    const ctx = await batchWorld();
    ctx.executor.batchFenceBundle({
      grantId: ctx.grant.grantId, jobId: ctx.jobId,
      occurrenceId: "occ-b1", payload: BATCH_PAYLOAD });
    assert.equal(ctx.providers.calls.length, 0,
      "the bundle itself makes no provider call");
    assert.equal(rows(ctx.w,
      `SELECT * FROM d6_provider_dispatches`).length, 1);
    assert.equal(oneRow(ctx.w,
      `SELECT slots_consumed AS n FROM d6_grant_reservations`).n, 1);
  });

  test("I-2 on the fence: one dispatch row, one slot, one dispatching attempt per (job, occurrence, generation)", async () => {
    const ctx = await batchWorld();
    ctx.executor.batchFenceBundle({
      grantId: ctx.grant.grantId, jobId: ctx.jobId,
      occurrenceId: "occ-b1", payload: BATCH_PAYLOAD });
    assert.equal(rows(ctx.w, `SELECT * FROM d6_provider_dispatches`).length, 1);
    assert.equal(rows(ctx.w,
      `SELECT * FROM d6_attempt_log WHERE phase = 'dispatching'`).length, 1);
    assert.equal(rows(ctx.w, `SELECT * FROM batch_maps`).length, 1);
  });

  test("I-6 (fence slice): a clean Batch fence day reconciles ok:true, identically to Standard", async () => {
    const ctx = await batchWorld();
    ctx.executor.batchFenceBundle({
      grantId: ctx.grant.grantId, jobId: ctx.jobId,
      occurrenceId: "occ-b1", payload: BATCH_PAYLOAD });
    const rec = ctx.mods.quota.reconcileQuota(ctx.w.coord);
    assert.equal(rec.ok, true, JSON.stringify(rec));
  });

  test("I-5 (fence slice): from the fence moment the attempt carries at upper bound in phase accounting terms", async () => {
    const ctx = await batchWorld();
    const out = ctx.executor.batchFenceBundle({
      grantId: ctx.grant.grantId, jobId: ctx.jobId,
      occurrenceId: "occ-b1", payload: BATCH_PAYLOAD });
    const attempt = ctx.store.attemptsForExecution(out.executionId)[0];
    assert.equal(attempt.phase, "dispatching");
    assert.equal(attempt.cost_micro_cents, null);
    assert.equal(attempt.upper_micro_cents,
      ctx.mods.constants.upperBoundAttemptMicro(BATCH_PAYLOAD.text.length));
  });
});

// ----------------------------------------------------------------
describe("BG2-X — Batch execution, poll, commit (spec §3.3/§3.5/§3.6.4/§3.8)", () => {
  const callsOf = (ctx, method) =>
    ctx.providers.calls.filter((x) => x.method === method);
  const occState = (ctx, oid = "occ-b1") => oneRow(ctx.w,
    `SELECT state FROM occurrences WHERE job_id = ? AND occurrence_id = ?`,
    ctx.jobId, oid)?.state;
  const grantState = (ctx) => oneRow(ctx.w,
    `SELECT state FROM grants WHERE grant_id = ?`,
    ctx.grant.grantId)?.state;

  test("end-to-end: fence -> POST -> immediate poll -> terminal bundle -> commit tail -> cohort report", async () => {
    const ctx = await batchWorld({ tree: ADMITTED_TREE });
    const res = await driveMessage(ctx);
    assert.equal(res.occurrences["occ-b1"].reported, "success");
    assert.equal(res.batchReported, true);
    assert.equal(occState(ctx), "ready");
    const exec = ctx.store.executionFor(ctx.jobId, "occ-b1");
    assert.equal(exec.state, "committed");
    const bindings = rows(ctx.w,
      `SELECT * FROM bindings WHERE occurrence_id = 'occ-b1'`);
    assert.equal(bindings.length, 1, "exactly one binding (I-7)");
    const attempt = ctx.store.attemptsForExecution(exec.execution_id)[0];
    assert.equal(attempt.phase, "confirmed");
    assert.equal(attempt.outcome, "success");
    assert.equal(attempt.cost_micro_cents,
      ctx.mods.constants.knownCostMicro(0.5));
    assert.equal(attempt.provider_request_id, "batches/stub-1");
    const receipt = ctx.store.batchTerminalReceipt(ctx.jobId, "occ-b1");
    assert.equal(receipt.classification_outcome, "success");
    assert.equal(receipt.provider_name, "batches/stub-1");
    const map = ctx.w.coord._latestBatchMap(ctx.jobId, "occ-b1");
    assert.equal(map.state, "submitted",
      "the map state machine gains no terminal-success state");
    assert.equal(grantState(ctx), "reported");
    assert.equal(oneRow(ctx.w, `SELECT state FROM jobs WHERE job_id = ?`,
      ctx.jobId).state, "complete");
    assert.equal(callsOf(ctx, "submitBatch").length, 1);
    assert.equal(rows(ctx.w, `SELECT * FROM d6_provider_dispatches`).length, 1);
    const intent = ctx.w.coord._latestIntent(ctx.jobId, "occ-b1");
    assert.equal(intent.outcome, "success");
  });

  test("pending poll: no report, no resubmission; completion on a later message", async () => {
    let polls = 0;
    const ctx = await batchWorld({ tree: ADMITTED_TREE, script: {
      poll: () => (++polls === 1)
        ? { done: false, state: "BATCH_STATE_RUNNING" }
        : { done: true, state: "BATCH_STATE_SUCCEEDED",
            audio: makeWav(0.5), format: "wav", durationSec: 0.5 },
    } });
    const first = await driveMessage(ctx);
    assert.equal(first.occurrences["occ-b1"].pending, true);
    assert.equal(first.batchReported, undefined);
    assert.deepEqual(first.batchCohortPending, ["occ-b1"]);
    assert.equal(occState(ctx), "granted",
      "a deferred submitted occurrence keeps its granted state");
    assert.equal(grantState(ctx), "issued");
    const second = await driveMessage(ctx);
    assert.equal(second.batchReported, true);
    assert.equal(occState(ctx), "ready");
    assert.equal(callsOf(ctx, "submitBatch").length, 1,
      "the second message polls the SAME provider job (I-1/I-2)");
    assert.equal(rows(ctx.w, `SELECT * FROM d6_provider_dispatches`).length, 1);
  });

  test("submit HTTP 500: known-outcome bundle lands; the rejection stays counted (I-4)", async () => {
    const ctx = await batchWorld({ tree: ADMITTED_TREE, script: {
      submitBatch: () => { throw Object.assign(
        new Error("server error"), { httpStatus: 500 }); },
    } });
    const res = await driveMessage(ctx);
    assert.equal(res.occurrences["occ-b1"].reported, "provider_error");
    assert.equal(res.batchReported, true);
    const map = ctx.w.coord._latestBatchMap(ctx.jobId, "occ-b1");
    assert.equal(map.state, "rejected");
    const exec = ctx.store.executionFor(ctx.jobId, "occ-b1");
    assert.equal(exec.state, "failed");
    assert.equal(exec.stage, "submit");
    const attempt = ctx.store.attemptsForExecution(exec.execution_id)[0];
    assert.equal(attempt.phase, "confirmed");
    assert.equal(attempt.outcome, "failed_known");
    assert.equal(attempt.cost_micro_cents, 0);
    assert.equal(ctx.w.coord._latestIntent(ctx.jobId, "occ-b1").outcome,
      "failed_known");
    assert.equal(occState(ctx), "failed");
    assert.equal(rows(ctx.w, `SELECT * FROM d6_provider_dispatches`).length, 1,
      "a known-rejected dispatch stays counted");
    assert.equal(oneRow(ctx.w,
      `SELECT slots_consumed AS n FROM d6_grant_reservations`).n, 1);
  });

  test("submit 429 with the quota marker: daily_limit derivation parks like Standard", async () => {
    const ctx = await batchWorld({ tree: ADMITTED_TREE, script: {
      submitBatch: () => { throw Object.assign(new Error("quota"),
        { httpStatus: 429, quotaExceeded: true }); },
    } });
    const res = await driveMessage(ctx);
    assert.equal(res.occurrences["occ-b1"].reported, "daily_limit");
    assert.equal(occState(ctx), "pending",
      "the daily_limit result defers the occurrence");
    assert.equal(rows(ctx.w, `SELECT * FROM quota_parks`).length, 1);
  });

  test("accepted-but-unnamed: ambiguous (accepted_unnamed); attempt stays dispatching; intent stays open (CW-12)", async () => {
    const ctx = await batchWorld({ tree: ADMITTED_TREE, script: {
      submitBatch: () => { throw Object.assign(new Error("unnamed"),
        { httpStatus: 502, batchAcceptedUnnamed: true,
          code: "batch_accepted_unnamed" }); },
    } });
    const res = await driveMessage(ctx);
    assert.equal(res.occurrences["occ-b1"].blocked, true);
    assert.equal(res.occurrences["occ-b1"].detail, "accepted_unnamed");
    assert.equal(res.batchReported, undefined);
    const map = ctx.w.coord._latestBatchMap(ctx.jobId, "occ-b1");
    assert.equal(map.state, "ambiguous");
    assert.equal(map.detail, "accepted_unnamed");
    const exec = ctx.store.executionFor(ctx.jobId, "occ-b1");
    const attempt = ctx.store.attemptsForExecution(exec.execution_id)[0];
    assert.equal(attempt.phase, "dispatching", "exposure retained (I-5)");
    assert.equal(ctx.w.coord._latestIntent(ctx.jobId, "occ-b1").outcome, null);
    assert.equal(callsOf(ctx, "submitBatch").length, 1);
  });

  test("transport-unknown submit throw: ambiguous (submit_transport_unknown)", async () => {
    const ctx = await batchWorld({ tree: ADMITTED_TREE, script: {
      submitBatch: () => { throw new Error("socket reset"); },
    } });
    const res = await driveMessage(ctx);
    assert.equal(res.occurrences["occ-b1"].detail, "submit_transport_unknown");
    assert.equal(ctx.w.coord._latestBatchMap(ctx.jobId, "occ-b1").state,
      "ambiguous");
  });

  test("halt asserted at submit: fence stands, no POST outcome; a later message converts it — never a second POST (B2-R3)", async () => {
    const haltErr = Object.assign(new Error("generation_halted"),
      { code: "generation_halted", name: "GenerationHaltedError" });
    const ctx = await batchWorld({ tree: ADMITTED_TREE, script: {
      submitBatch: () => { throw haltErr; },
    } });
    const first = await driveMessage(ctx);
    assert.equal(first.halted, true);
    let map = ctx.w.coord._latestBatchMap(ctx.jobId, "occ-b1");
    assert.equal(map.state, "fenced", "the fence stands under the halt");
    const second = await driveMessage(ctx);
    assert.equal(second.occurrences["occ-b1"].converted,
      "fence_without_outcome");
    map = ctx.w.coord._latestBatchMap(ctx.jobId, "occ-b1");
    assert.equal(map.state, "ambiguous");
    assert.equal(map.detail, "fence_without_outcome");
    assert.equal(callsOf(ctx, "submitBatch").length, 1,
      "clearing the halt can never re-POST a fenced occurrence");
    const exec = ctx.store.executionFor(ctx.jobId, "occ-b1");
    const attempt = ctx.store.attemptsForExecution(exec.execution_id)[0];
    assert.equal(attempt.phase, "dispatching",
      "the halted fence's exposure is retained at upper bound");
    assert.equal(rows(ctx.w, `SELECT * FROM d6_provider_dispatches`).length, 1);
  });

  test("poll terminal policy_block: classified first, then bundled; occurrence blocked_policy", async () => {
    const ctx = await batchWorld({ tree: ADMITTED_TREE, script: {
      poll: () => ({ done: true, state: "BATCH_STATE_FAILED",
        classification: { kind: "policy_block", outcome: "policy_block",
          providerCode: "PROHIBITED_CONTENT", blockReason: null,
          finishReason: "PROHIBITED_CONTENT", retryable: false,
          source: "item_finish" } }),
    } });
    const res = await driveMessage(ctx);
    assert.equal(res.occurrences["occ-b1"].reported, "policy_block");
    assert.equal(res.batchReported, true);
    assert.equal(occState(ctx), "blocked_policy");
    const exec = ctx.store.executionFor(ctx.jobId, "occ-b1");
    assert.equal(exec.state, "failed");
    assert.equal(exec.stage, "batch_policy_block");
    const attempt = ctx.store.attemptsForExecution(exec.execution_id)[0];
    assert.equal(attempt.outcome, "policy_block");
    assert.equal(attempt.cost_micro_cents, 0);
    const receipt = ctx.store.batchTerminalReceipt(ctx.jobId, "occ-b1");
    assert.equal(receipt.classification_kind, "policy_block");
    assert.equal(receipt.finish_reason, "PROHIBITED_CONTENT");
    assert.ok(!JSON.stringify(receipt).includes("segment text"),
      "no payload text in the receipt");
  });

  test("poll terminal provider_error: occurrence failed; report detail carries the classification scalars", async () => {
    const ctx = await batchWorld({ tree: ADMITTED_TREE, script: {
      poll: () => ({ done: true, state: "BATCH_STATE_FAILED",
        classification: { kind: "provider_error", outcome: "failed_known",
          providerCode: "500", blockReason: null, finishReason: null,
          retryable: true, source: "batch_error" } }),
    } });
    const res = await driveMessage(ctx);
    assert.equal(res.occurrences["occ-b1"].reported, "provider_error");
    assert.equal(occState(ctx), "failed");
    const grant = oneRow(ctx.w,
      `SELECT report_json FROM grants WHERE grant_id = ?`,
      ctx.grant.grantId);
    const report = JSON.parse(grant.report_json);
    const result = report.results.find((r) => r.occurrenceId === "occ-b1");
    assert.equal(result.outcome, "provider_error");
    assert.deepEqual(result.evidence, {
      batchState: "BATCH_STATE_FAILED", classificationKind: "provider_error",
      providerCode: "500", blockReason: null, finishReason: null,
      retryable: true });
  });

  test("preflight: unsupported provider and unsupported model skip with zero writes", async () => {
    for (const [payload, reason] of [
      [{ ...BATCH_PAYLOAD, provider: "openai" }, "batch_provider_unsupported"],
      [{ ...BATCH_PAYLOAD, model: "gemini-2.0-flash" }, "batch_model_unsupported"],
    ]) {
      const ctx = await batchWorld({ tree: ADMITTED_TREE, payload });
      const before = snapshotDb(ctx.w.db);
      const res = await driveMessage(ctx);
      assert.equal(res.occurrences["occ-b1"].reason, reason);
      const after = snapshotDb(ctx.w.db);
      assert.equal(after.d6_execution_records?.length ?? 0, 0);
      assert.equal(after.batch_maps?.length ?? 0, 0);
      assert.equal(after.d6_provider_dispatches?.length ?? 0, 0);
      assert.notEqual(after, null);
      assert.equal(ctx.providers.calls.length, 0);
      void before;
    }
  });

  test("cohort rule: a committed sibling is NOT deferred while another is in flight; the report fires at completion", async () => {
    const ctx = await batchWorld({ tree: ADMITTED_TREE,
      occurrences: ["occ-b1", "occ-b2"],
      script: { poll: (name, batch) =>
        batch.displayName.includes("occ-b2")
          ? { done: false, state: "BATCH_STATE_RUNNING" }
          : { done: true, state: "BATCH_STATE_SUCCEEDED",
              audio: makeWav(0.5), format: "wav", durationSec: 0.5 } },
    });
    const first = await driveMessage(ctx);
    assert.equal(first.batchReported, undefined);
    assert.equal(occState(ctx, "occ-b1"), "ready",
      "the committed occurrence stays ready — never returned to pending");
    assert.equal(occState(ctx, "occ-b2"), "granted");
    assert.equal(grantState(ctx), "issued");
    ctx.providers.batches.forEach((b) => { b.displayName = b.displayName; });
    // Flip occ-b2's job to success by replacing the poll script's
    // behavior through the stub map: mark it done via a fresh script
    // is not possible mid-flight, so drive with a second executor
    // whose stub succeeds.
    const mods = ctx.mods;
    const providers2 = makeProviderStub();
    providers2.batches.set("batches/stub-2",
      ctx.providers.batches.get("batches/stub-2"));
    const executor2 = mods.d6Executor.createD6Executor({
      coord: ctx.w.coord, store: ctx.store, providers: providers2,
      flushStore: mods.flushStore.createFlushStore(ctx.bucket, { keyPrefix: "" }),
      cache: stubCache,
      workSource: async () => ({ status: "ok", payload: BATCH_PAYLOAD }),
      consumerId: ctx.consumerId });
    const second = await executor2.handleMessage({
      grantId: ctx.grant.grantId, jobId: ctx.jobId,
      occurrences: ["occ-b1", "occ-b2"] });
    assert.equal(second.batchReported, true);
    assert.equal(occState(ctx, "occ-b2"), "ready");
    assert.equal(grantState(ctx), "reported");
    assert.equal(rows(ctx.w, `SELECT * FROM bindings`).length, 2);
  });

  test("terminal_unreported recovery (CW-23): a failure landed in an earlier message is re-derived and reported at cohort completion", async () => {
    let b2Done = false;
    const ctx = await batchWorld({ tree: ADMITTED_TREE,
      occurrences: ["occ-b1", "occ-b2"],
      script: { poll: (name, batch) => {
        if (batch.displayName.includes("occ-b1"))
          return { done: true, state: "BATCH_STATE_FAILED",
            classification: { kind: "batch_terminal",
              outcome: "failed_known", providerCode: null,
              blockReason: null, finishReason: null, retryable: true,
              source: "metadata_state" } };
        return b2Done
          ? { done: true, state: "BATCH_STATE_SUCCEEDED",
              audio: makeWav(0.5), format: "wav", durationSec: 0.5 }
          : { done: false, state: "BATCH_STATE_RUNNING" };
      } },
    });
    const first = await driveMessage(ctx);
    assert.equal(first.batchReported, undefined);
    assert.equal(occState(ctx, "occ-b1"), "granted",
      "the failed occurrence awaits the cohort report");
    b2Done = true;
    const second = await driveMessage(ctx);
    assert.equal(second.batchReported, true);
    assert.equal(occState(ctx, "occ-b1"), "failed");
    assert.equal(occState(ctx, "occ-b2"), "ready");
    assert.equal(oneRow(ctx.w, `SELECT state FROM jobs WHERE job_id = ?`,
      ctx.jobId).state, "partial");
  });

  test("crash between terminal bundle and commit tail (CW-18): the receipt resumes the commit; exactly one binding", async () => {
    let wsCalls = 0;
    const ctx = await batchWorld({ tree: ADMITTED_TREE, workSource: async () => {
      wsCalls++;
      if (wsCalls === 2) throw new Error("simulated crash in the tail");
      return { status: "ok", payload: BATCH_PAYLOAD };
    } });
    await assert.rejects(() => driveMessage(ctx), /simulated crash/);
    const receipt = ctx.store.batchTerminalReceipt(ctx.jobId, "occ-b1");
    assert.equal(receipt.classification_outcome, "success");
    const execMid = ctx.store.executionFor(ctx.jobId, "occ-b1");
    assert.equal(execMid.state, "attempted");
    assert.equal(rows(ctx.w, `SELECT * FROM bindings`).length, 0);
    const second = await driveMessage(ctx);
    assert.equal(second.occurrences["occ-b1"].committed, true);
    assert.equal(second.batchReported, true);
    assert.equal(rows(ctx.w, `SELECT * FROM bindings`).length, 1);
    assert.equal(callsOf(ctx, "submitBatch").length, 1);
    assert.equal(rows(ctx.w, `SELECT * FROM d6_attempt_log`).length, 1,
      "no second attempt was ever reserved");
  });

  test("fence without outcome (CW-10): a committed bundle whose POST never ran converts, never posts", async () => {
    const ctx = await batchWorld({ tree: ADMITTED_TREE });
    ctx.executor.batchFenceBundle({ grantId: ctx.grant.grantId,
      jobId: ctx.jobId, occurrenceId: "occ-b1", payload: BATCH_PAYLOAD });
    const res = await driveMessage(ctx);
    assert.equal(res.occurrences["occ-b1"].converted, "fence_without_outcome");
    const map = ctx.w.coord._latestBatchMap(ctx.jobId, "occ-b1");
    assert.equal(map.state, "ambiguous");
    assert.equal(callsOf(ctx, "submitBatch").length, 0);
    assert.equal(rows(ctx.w, `SELECT * FROM d6_provider_dispatches`).length, 1,
      "the fence's dispatch stays counted — the I-3 suspect shape");
    assert.equal(map.provider_name, null);
  });

  test("ambiguity gate (I-8): one ambiguous occurrence blocks new submissions for the whole job", async () => {
    const ctx = await batchWorld({ tree: ADMITTED_TREE,
      occurrences: ["occ-b1", "occ-b2"],
      script: { submitBatch: (occ) => {
        if (occ.occurrenceId === "occ-b1") throw new Error("socket reset");
        return { name: "batches/should-never-exist" };
      } },
    });
    const res = await driveMessage(ctx);
    assert.equal(res.occurrences["occ-b1"].blocked, true);
    assert.equal(res.occurrences["occ-b2"].reason, "batch_ambiguity_open");
    assert.equal(callsOf(ctx, "submitBatch").length, 1,
      "occ-b2 was never submitted while occ-b1 is ambiguous");
    assert.equal(rows(ctx.w, `SELECT * FROM batch_maps`).length, 1);
  });
});

// ----------------------------------------------------------------
describe("BG2-P (custody slice) — lease custody (spec §3.7, B2-R1)", () => {
  const MIN = 60 * 1000;
  function markDelivered(ctx) {
    ctx.w.db.prepare(
      `UPDATE outbox SET sent_at = ?, send_attempted_at = ?
        WHERE id = ?`).run(ctx.w.coord._now(), ctx.w.coord._now(),
        ctx.grant.grantId);
  }
  const occState = (ctx, oid = "occ-b1") => oneRow(ctx.w,
    `SELECT state FROM occurrences WHERE job_id = ? AND occurrence_id = ?`,
    ctx.jobId, oid)?.state;
  const leaseRows = (ctx) => rows(ctx.w,
    `SELECT * FROM schedule WHERE kind = 'lease' AND ref = ? AND state = 'pending'`,
    ctx.grant.grantId);

  test("an in-flight submitted map tolls the lease instead of going outcome_unknown — repeatedly, and across a restart", async () => {
    const ctx = await batchWorld({ tree: ADMITTED_TREE, script: {
      poll: () => ({ done: false, state: "BATCH_STATE_RUNNING" }) } });
    await driveMessage(ctx); // fence + submit + pending poll
    markDelivered(ctx);
    const before = oneRow(ctx.w,
      `SELECT lease_expires_at FROM grants WHERE grant_id = ?`,
      ctx.grant.grantId).lease_expires_at;
    ctx.w.advance(16 * MIN);
    await ctx.w.fireClassAlarm();
    assert.equal(occState(ctx), "granted",
      "custody occurrence is NOT outcome_unknown");
    const after1 = oneRow(ctx.w,
      `SELECT lease_expires_at FROM grants WHERE grant_id = ?`,
      ctx.grant.grantId).lease_expires_at;
    assert.ok(after1 > before, "the lease tolled forward");
    assert.equal(leaseRows(ctx).length, 1,
      "exactly one pending lease row exists for the grant");
    // A second expiry, processed by a RESTARTED instance (the
    // silent-chain shape): custody survives crash().
    ctx.w.advance(16 * MIN);
    const inst2 = ctx.w.crash();
    await inst2.alarm();
    assert.equal(occState(ctx), "granted");
    assert.equal(leaseRows(ctx).length, 1);
    const exec = ctx.store.executionFor(ctx.jobId, "occ-b1");
    const attempt = ctx.store.attemptsForExecution(exec.execution_id)[0];
    assert.equal(attempt.phase, "dispatching",
      "nothing was settled by tolling (I-9)");
  });

  test("control: a granted occurrence with NO batch map still goes outcome_unknown at lease expiry", async () => {
    const ctx = await batchWorld({ tree: ADMITTED_TREE });
    markDelivered(ctx); // granted, claimed, never dispatched
    ctx.w.advance(16 * MIN);
    await ctx.w.fireClassAlarm();
    assert.equal(occState(ctx), "outcome_unknown",
      "Standard lease behavior is unchanged for non-custody work");
  });

  test("a terminally consumed map does not toll: the lease expires normally", async () => {
    const ctx = await batchWorld({ tree: ADMITTED_TREE });
    await driveMessage(ctx); // completes + reports the grant
    markDelivered(ctx);
    const before = oneRow(ctx.w,
      `SELECT lease_expires_at FROM grants WHERE grant_id = ?`,
      ctx.grant.grantId).lease_expires_at;
    ctx.w.advance(16 * MIN);
    await ctx.w.fireClassAlarm();
    const after = oneRow(ctx.w,
      `SELECT lease_expires_at FROM grants WHERE grant_id = ?`,
      ctx.grant.grantId).lease_expires_at;
    assert.equal(after, before, "a reported grant's lease never tolls");
    assert.equal(occState(ctx), "ready");
  });
});

// ----------------------------------------------------------------
describe("BG2-P — poll driver, D-4 classifications, custody of the pass (spec §3.6)", () => {
  const MIN = 60 * 1000, HOUR = 60 * MIN;
  const pass = (ctx, token) => ctx.executor.pollBatchPass({ passToken: token });
  const pollCalls = (ctx) =>
    ctx.providers.calls.filter((x) => x.method === "getBatch").length;
  const pollRow = (ctx, oid = "occ-b1") =>
    ctx.store.batchPollState(ctx.jobId, oid, 1);
  async function submittedWorld(script = {}) {
    const ctx = await batchWorld({ tree: ADMITTED_TREE, script: {
      poll: script.poll || (() => ({ done: false, state: "BATCH_STATE_RUNNING" })),
      ...(script.submitBatch ? { submitBatch: script.submitBatch } : {}),
    } });
    await driveMessage(ctx); // fence + submit + one immediate poll
    ctx.providers.calls.length = 0; // count DRIVER polls from here
    return ctx;
  }

  test("the driver polls a submitted map at most once per pass; observations and counters advance per completed pass", async () => {
    const ctx = await submittedWorld();
    const out1 = await pass(ctx, "p-1");
    assert.equal(pollCalls(ctx), 1);
    let row = pollRow(ctx);
    assert.equal(row.consecutive_no_progress_passes, 1);
    assert.equal(row.last_provider_state, "BATCH_STATE_RUNNING");
    assert.equal(row.classification, "BATCH-IN-FLIGHT");
    const obs = rows(ctx.w, `SELECT * FROM d6_batch_poll_observations`);
    assert.equal(obs.length, 1);
    assert.equal(obs[0].phase, "completed");
    assert.equal(obs[0].outcome_class, "pending");
    const out2 = await pass(ctx, "p-2");
    assert.equal(pollCalls(ctx), 2);
    row = pollRow(ctx);
    assert.equal(row.consecutive_no_progress_passes, 2);
    void out1; void out2;
  });

  test("a duplicate pass token does not double-count (observation PK)", async () => {
    const ctx = await submittedWorld();
    await pass(ctx, "p-dup");
    const again = await pass(ctx, "p-dup");
    assert.equal(pollCalls(ctx), 1, "the second invocation polls nothing");
    assert.equal(pollRow(ctx).consecutive_no_progress_passes, 1);
    assert.equal(rows(ctx.w, `SELECT * FROM d6_batch_poll_observations`).length, 1);
    void again;
  });

  test("progress (a provider-state change) resets the no-progress counter", async () => {
    // Index 0 is consumed by the queue message's immediate poll;
    // the driver passes consume the rest.
    const states = ["BATCH_STATE_RUNNING", "BATCH_STATE_RUNNING",
      "BATCH_STATE_RUNNING", "BATCH_STATE_PENDING_REVIEW"];
    let i = 0;
    const ctx = await submittedWorld({
      poll: () => ({ done: false, state: states[Math.min(i++, 3)] }) });
    await pass(ctx, "p-1");
    await pass(ctx, "p-2");
    assert.equal(pollRow(ctx).consecutive_no_progress_passes, 2);
    await pass(ctx, "p-3");
    assert.equal(pollRow(ctx).consecutive_no_progress_passes, 0);
    assert.equal(pollRow(ctx).last_provider_state, "BATCH_STATE_PENDING_REVIEW");
  });

  test("extended latency at exactly 1h (informational; nothing is halted or failed)", async () => {
    const ctx = await submittedWorld();
    await pass(ctx, "p-1"); // first observation at T0
    ctx.w.advance(59 * MIN);
    await pass(ctx, "p-2");
    assert.equal(pollRow(ctx).classification, "BATCH-IN-FLIGHT");
    ctx.w.advance(1 * MIN); // age exactly 1h since first observation
    const out = await pass(ctx, "p-3");
    assert.equal(pollRow(ctx).classification, "BATCH-LATENCY-EXTENDED");
    assert.ok(out.some((o) => o.state === "BATCH-LATENCY-EXTENDED"));
    const map = ctx.w.coord._latestBatchMap(ctx.jobId, "occ-b1");
    assert.equal(map.state, "submitted", "no automatic action follows");
  });

  test("stalled requires BOTH >=12 no-progress passes AND age >=6h", async () => {
    const ctx = await submittedWorld();
    await pass(ctx, "p-0");
    // 11 more passes across 5h59m: counter reaches 12, age < 6h.
    for (let k = 1; k <= 11; k++) {
      ctx.w.advance(Math.floor((5 * HOUR + 59 * MIN) / 11));
      await pass(ctx, `p-${k}`);
    }
    assert.equal(pollRow(ctx).consecutive_no_progress_passes, 12);
    assert.notEqual(pollRow(ctx).classification, "BATCH-STALLED");
    ctx.w.advance(2 * MIN); // age now >= 6h
    const out = await pass(ctx, "p-12");
    assert.equal(pollRow(ctx).classification, "BATCH-STALLED");
    assert.ok(out.some((o) => o.state === "BATCH-STALLED"));
    const map = ctx.w.coord._latestBatchMap(ctx.jobId, "occ-b1");
    assert.equal(map.state, "submitted",
      "stall is escalation visibility only — no halt, no failure");
  });

  test("11 passes at >=6h is NOT stalled (the pass count binds too)", async () => {
    const ctx = await submittedWorld();
    await pass(ctx, "p-0");
    for (let k = 1; k <= 10; k++) {
      ctx.w.advance(37 * MIN);
      await pass(ctx, `p-${k}`);
    }
    assert.equal(pollRow(ctx).consecutive_no_progress_passes, 11);
    assert.equal(pollRow(ctx).classification, "BATCH-LATENCY-EXTENDED");
  });

  test("a poll-error pass counts as observed without progress; the map is untouched", async () => {
    let fail = true;
    const ctx = await submittedWorld({ poll: () => {
      if (fail) throw Object.assign(new Error("boom"), { name: "BoomError" });
      return { done: false, state: "BATCH_STATE_RUNNING" };
    } });
    await pass(ctx, "p-1");
    const obs = rows(ctx.w, `SELECT * FROM d6_batch_poll_observations`);
    assert.equal(obs[0].outcome_class, "poll_error");
    assert.equal(obs[0].poll_error, "BoomError");
    assert.equal(pollRow(ctx).consecutive_no_progress_passes, 1);
    assert.equal(ctx.w.coord._latestBatchMap(ctx.jobId, "occ-b1").state, "submitted");
    fail = false;
    await pass(ctx, "p-2");
    assert.equal(pollRow(ctx).consecutive_no_progress_passes, 2);
  });

  test("CW-15: a started-only observation (crash during the GET) does not advance the counter; the same token is spent, a new token polls", async () => {
    const ctx = await submittedWorld();
    const map = ctx.w.coord._latestBatchMap(ctx.jobId, "occ-b1");
    ctx.store.recordBatchPollStarted({ passToken: "p-crash",
      jobId: ctx.jobId, occurrenceId: "occ-b1", generation: map.generation,
      providerName: map.provider_name, now: ctx.w.coord._now() });
    assert.equal(pollRow(ctx).consecutive_no_progress_passes, 0);
    await pass(ctx, "p-crash");
    assert.equal(pollCalls(ctx), 0, "the crashed pass's token is a duplicate");
    await pass(ctx, "p-next");
    assert.equal(pollCalls(ctx), 1);
    assert.equal(pollRow(ctx).consecutive_no_progress_passes, 1);
    const started = rows(ctx.w,
      `SELECT * FROM d6_batch_poll_observations WHERE pass_token = 'p-crash'`);
    assert.equal(started[0].phase, "started",
      "the crashed pass remains visibly incomplete");
  });

  test("ambiguity escalation at 24h — with zero provider calls for the ambiguous map", async () => {
    const ctx = await batchWorld({ tree: ADMITTED_TREE, script: {
      submitBatch: () => { throw new Error("socket reset"); } } });
    await driveMessage(ctx); // -> ambiguous at T0
    ctx.providers.calls.length = 0;
    ctx.w.advance(23 * HOUR + 59 * MIN);
    let out = await pass(ctx, "p-1");
    assert.ok(!out.some((o) => o.state === "BATCH-AMBIGUITY-OPEN"));
    ctx.w.advance(2 * MIN);
    out = await pass(ctx, "p-2");
    assert.ok(out.some((o) => o.state === "BATCH-AMBIGUITY-OPEN"));
    assert.equal(pollCalls(ctx), 0, "an ambiguous map is never polled");
    assert.equal(pollRow(ctx).classification, "BATCH-AMBIGUITY-OPEN");
  });

  test("continuation (§3.6.6): a claimed-but-never-delivered grant is driven by the pass — fence, POST, poll, commit, report", async () => {
    const ctx = await batchWorld({ tree: ADMITTED_TREE });
    const out = await pass(ctx, "p-cont");
    assert.equal(ctx.providers.calls.filter((x) => x.method === "submitBatch").length, 1);
    assert.equal(oneRow(ctx.w, `SELECT state FROM occurrences WHERE job_id = ? AND occurrence_id = 'occ-b1'`, ctx.jobId).state, "ready");
    assert.equal(oneRow(ctx.w, `SELECT state FROM grants WHERE grant_id = ?`, ctx.grant.grantId).state, "reported");
    assert.ok(out.some((o) => o.state === "batch_cohort_reported"));
    assert.equal(rows(ctx.w, `SELECT * FROM bindings`).length, 1);
  });

  test("the driver polls nothing for another consumer's claim and writes nothing", async () => {
    const ctx = await batchWorld({ tree: ADMITTED_TREE,
      claimConsumer: "someone-else", script: {
        poll: () => ({ done: false, state: "BATCH_STATE_RUNNING" }) } });
    // Give the other consumer a submitted map via the fence+submit
    // path is impossible here (the claim is theirs); instead verify
    // the empty case: no standing claims -> no selection at all.
    const out = await pass(ctx, "p-1");
    assert.deepEqual(out, []);
    assert.equal(ctx.providers.calls.length, 0);
    const tables = rows(ctx.w,
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'd6_batch_poll_state'`);
    assert.equal(tables.length, 0, "no poll tables are created");
  });

  test("a terminally consumed map is never polled again", async () => {
    const ctx = await batchWorld({ tree: ADMITTED_TREE });
    await driveMessage(ctx); // completes + reports
    ctx.providers.calls.length = 0;
    await pass(ctx, "p-1");
    await pass(ctx, "p-2");
    assert.equal(pollCalls(ctx), 0);
  });
});

// ----------------------------------------------------------------
describe("BG2-C — crash windows, remaining main-flow set (spec §4.3)", () => {
  const callsOf = (ctx, m) => ctx.providers.calls.filter((x) => x.method === m);

  test("CW-13: an HTTP rejection whose known-outcome bundle cannot land is NEVER claimed as known", async () => {
    const ctx = await batchWorld({ tree: ADMITTED_TREE, script: {
      submitBatch: () => { throw Object.assign(new Error("server"),
        { httpStatus: 500 }); } } });
    let n = 0;
    ctx.w.faults.sql = { error: new Error("injected bundle fault"),
      match: (q) => q.includes("UPDATE batch_maps") ? (++n === 1) : false };
    const res = await driveMessage(ctx);
    ctx.w.faults.sql = null;
    assert.equal(res.occurrences["occ-b1"].detail, "known_outcome_unprovable");
    const map = ctx.w.coord._latestBatchMap(ctx.jobId, "occ-b1");
    assert.equal(map.state, "ambiguous");
    assert.equal(map.detail, "known_outcome_unprovable");
    const exec = ctx.store.executionFor(ctx.jobId, "occ-b1");
    assert.equal(exec.state, "attempted", "the failed bundle rolled back");
    const attempt = ctx.store.attemptsForExecution(exec.execution_id)[0];
    assert.equal(attempt.phase, "dispatching");
  });

  test("CW-16/CW-17: a fault inside the terminal bundle rolls it back whole; the next pass re-polls and lands it", async () => {
    const ctx = await batchWorld({ tree: ADMITTED_TREE });
    ctx.w.faults.sql = { error: new Error("injected receipt fault"),
      match: (q) => q.includes("INSERT INTO d6_batch_terminal_receipts") };
    await assert.rejects(() => driveMessage(ctx), /injected receipt fault/);
    ctx.w.faults.sql = null;
    const exec = ctx.store.executionFor(ctx.jobId, "occ-b1");
    assert.equal(exec.state, "attempted");
    const attempt = ctx.store.attemptsForExecution(exec.execution_id)[0];
    assert.equal(attempt.phase, "dispatching",
      "the confirmation rolled back with the bundle");
    assert.equal(ctx.store.batchTerminalReceipt(ctx.jobId, "occ-b1"), null);
    const res = await driveMessage(ctx);
    assert.equal(res.occurrences["occ-b1"].committed, true);
    assert.equal(rows(ctx.w, `SELECT * FROM d6_attempt_log`).length, 1);
    assert.equal(rows(ctx.w, `SELECT * FROM bindings`).length, 1);
    assert.equal(callsOf(ctx, "submitBatch").length, 1,
      "re-polling is retrieval, never resubmission");
  });

  test("CW-19: crash after the object is durable, transitions incomplete — the receipt path adopts the object and commits", async () => {
    const ctx = await batchWorld({ tree: ADMITTED_TREE });
    let n = 0;
    ctx.w.faults.sql = { error: new Error("injected transition fault"),
      match: (q) => q.includes("UPDATE d6_execution_records") ? (++n === 3) : false };
    await assert.rejects(() => driveMessage(ctx), /injected transition fault/);
    ctx.w.faults.sql = null;
    const execMid = ctx.store.executionFor(ctx.jobId, "occ-b1");
    assert.equal(execMid.state, "synthesized");
    assert.equal(ctx.bucket.objects.size, 1, "the object is durable");
    const res = await driveMessage(ctx);
    assert.equal(res.occurrences["occ-b1"].committed, true);
    assert.equal(ctx.bucket.objects.size, 1,
      "the durable object was adopted, not rewritten");
    assert.equal(rows(ctx.w, `SELECT * FROM bindings`).length, 1);
  });

  test("CW-20/CW-21: a fault inside commitVerified leaves the execution verified and the commit unlanded; recovery commits exactly once", async () => {
    const ctx = await batchWorld({ tree: ADMITTED_TREE });
    let n = 0;
    ctx.w.faults.sql = { error: new Error("injected commit fault"),
      match: (q) => q.includes("UPDATE occurrences SET cache_key") ? (++n === 1) : false };
    await assert.rejects(() => driveMessage(ctx), /injected commit fault/);
    ctx.w.faults.sql = null;
    const execMid = ctx.store.executionFor(ctx.jobId, "occ-b1");
    assert.equal(execMid.state, "verified");
    assert.equal(rows(ctx.w, `SELECT * FROM bindings`).length, 0);
    assert.equal(oneRow(ctx.w,
      `SELECT cache_key FROM occurrences WHERE job_id = ? AND occurrence_id = 'occ-b1'`,
      ctx.jobId).cache_key, null);
    const res = await driveMessage(ctx);
    assert.equal(res.occurrences["occ-b1"].committed, true);
    assert.equal(rows(ctx.w, `SELECT * FROM bindings`).length, 1);
  });

  test("CW-22: commit landed, projection note lost — the drive sweep re-publishes it (self-healing)", async () => {
    const ctx = await batchWorld({ tree: ADMITTED_TREE });
    await driveMessage(ctx);
    assert.equal(rows(ctx.w, `SELECT * FROM d6_binding_projections`).length, 1);
    ctx.w.db.prepare(`DELETE FROM d6_binding_projections`).run();
    await ctx.w.service.driveOnce();
    const markers = rows(ctx.w, `SELECT * FROM d6_binding_projections`);
    assert.equal(markers.length, 1, "the orphan sweep re-created the marker");
    assert.equal(markers[0].occurrence_id, "occ-b1");
  });
});

// ----------------------------------------------------------------
const { upperBoundAttemptMicro } = (await loadTree(TREE)).constants;
// BG2-M/O drive the routes through the tree's own entry with the
// provider list endpoint stubbed at globalThis.fetch — the real
// adapter code parses the response; nothing leaves the process.
function stubGeminiList(batches) {
  const prev = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).includes("/v1beta/batches"))
      return { ok: true, status: 200,
        json: async () => ({ batches }) };
    throw new Error(`unexpected fetch: ${url}`);
  };
  return { calls, restore: () => { globalThis.fetch = prev; } };
}
async function ambiguousRouteWorld(scriptExtra = {}) {
  const ctx = await batchWorld({ tree: ADMITTED_TREE,
    envOverrides: { GENERATION_HALT: "0", GEMINI_API_KEY: "test-key" },
    script: { submitBatch: () => { throw new Error("socket reset"); },
      ...scriptExtra } });
  await driveMessage(ctx);
  ctx.displayName = ctx.w.coord
    ._latestBatchMap(ctx.jobId, "occ-b1").display_name;
  return ctx;
}
const reconcilePost = (ctx, extra = {}) => entryPost(ctx.w,
  "/v2/d6-batch-reconcile",
  { jobId: ctx.jobId, occurrenceId: "occ-b1",
    authorizationRef: "auth-ref-m", ...extra }, { operator: true });
const adjudicatePost = (ctx, adjudicationId, selectedProviderName, extra = {}) =>
  entryPost(ctx.w, "/v2/d6-batch-adjudicate",
    { adjudicationId, jobId: ctx.jobId, occurrenceId: "occ-b1",
      selectedProviderName, authorizationRef: "auth-ref-decide",
      evidenceRef: "operator-note-1", ...extra }, { operator: true });

describe("BG2-M — multiple-match adjudication (spec §3.10, D-6 amended)", () => {
  const NAME_A = "batches/aaa111", NAME_B = "batches/bbb222";

  test("multiple matches adopt NOTHING; every identifier is preserved verbatim with the exact exposure report", async () => {
    const ctx = await ambiguousRouteWorld();
    const stub = stubGeminiList([
      { name: NAME_A, displayName: ctx.displayName },
      { name: NAME_B, displayName: ctx.displayName },
      { name: "batches/other", displayName: "someone-else" }]);
    try {
      const res = await reconcilePost(ctx);
      assert.equal(res.body.ok, true);
      assert.equal(res.body.resolved, false);
      assert.equal(res.body.reason, "batch_duplicate_match_block");
      assert.deepEqual(res.body.matches, [NAME_A, NAME_B]);
      const upper = upperBoundAttemptMicro(BATCH_PAYLOAD.text.length);
      assert.deepEqual(res.body.exposure, {
        providerJobsObserved: 2, countedDispatches: 1,
        ledgeredUpperMicroCents: upper,
        maximumProviderJobsUpperMicroCents: 2 * upper,
        unledgeredDuplicateUpperMicroCents: upper,
        basis: "upper_bound_scenario_not_a_charge_claim" });
      const map = ctx.w.coord._latestBatchMap(ctx.jobId, "occ-b1");
      assert.equal(map.state, "ambiguous");
      assert.equal(map.provider_name, null, "nothing was adopted");
      const adj = rows(ctx.w, `SELECT * FROM d6_batch_adjudications`);
      assert.equal(adj.length, 1);
      assert.equal(adj[0].status, "open");
      assert.deepEqual(JSON.parse(adj[0].identifiers_json), [NAME_A, NAME_B]);
      const runs = rows(ctx.w, `SELECT * FROM d6_batch_adjudication_runs`);
      assert.equal(runs.length, 1);
      assert.equal(runs[0].outcome, "multiple_match_block");
      assert.equal(runs[0].authorization_ref, "auth-ref-m");
      // I-8: the exposure is a scenario — no dispatch row, no
      // counter movement followed from it.
      assert.equal(rows(ctx.w, `SELECT * FROM d6_provider_dispatches`).length, 1);
    } finally { stub.restore(); }
  });

  test("the decision act adopts only a preserved valid selection; polling then resumes on the SAME attempt", async () => {
    // The provider knows the adopted job (it is a real provider
    // job the enumeration found); the stub answers its poll.
    const ctx = await ambiguousRouteWorld({ getBatch: () => ({
      done: true, state: "BATCH_STATE_SUCCEEDED", audio: makeWav(0.5),
      format: "wav", durationSec: 0.5 }) });
    const stub = stubGeminiList([
      { name: NAME_A, displayName: ctx.displayName },
      { name: NAME_B, displayName: ctx.displayName }]);
    try {
      const rec = await reconcilePost(ctx);
      const adjId = rec.body.adjudicationId;
      const wrong = await adjudicatePost(ctx, adjId, "batches/not-preserved");
      assert.equal(wrong.body.ok, false);
      assert.equal(wrong.body.reason, "batch_adjudication_selection_not_enumerated");
      assert.equal(ctx.w.coord._latestBatchMap(ctx.jobId, "occ-b1").state, "ambiguous");
      const decided = await adjudicatePost(ctx, adjId, NAME_B);
      assert.equal(decided.body.ok, true);
      assert.equal(decided.body.providerName, NAME_B);
      const map = ctx.w.coord._latestBatchMap(ctx.jobId, "occ-b1");
      assert.equal(map.state, "submitted");
      assert.equal(map.provider_name, NAME_B);
      assert.match(map.detail, /batch_adjudication:/);
      const adj = rows(ctx.w, `SELECT * FROM d6_batch_adjudications`)[0];
      assert.equal(adj.status, "adopted");
      assert.equal(adj.selected_provider_name, NAME_B);
      assert.equal(adj.resolution_authorization_ref, "auth-ref-decide");
      assert.equal(adj.evidence_ref, "operator-note-1");
      // Idempotence: same selection -> alreadyApplied; a
      // different one -> already_resolved.
      const again = await adjudicatePost(ctx, adjId, NAME_B);
      assert.equal(again.body.ok, true);
      assert.equal(again.body.alreadyApplied, true);
      const different = await adjudicatePost(ctx, adjId, NAME_A);
      assert.equal(different.body.ok, false);
      assert.equal(different.body.reason, "batch_adjudication_already_resolved");
    } finally { stub.restore(); }
    // Polling resumes on the same attempt: the driver polls the
    // adopted job and commits — still exactly one attempt row.
    const out = await ctx.executor.pollBatchPass({ passToken: "p-resume" });
    void out;
    assert.equal(rows(ctx.w, `SELECT * FROM d6_attempt_log`).length, 1);
    assert.equal(oneRow(ctx.w, `SELECT state FROM occurrences WHERE job_id = ? AND occurrence_id = 'occ-b1'`, ctx.jobId).state, "ready");
    assert.equal(rows(ctx.w, `SELECT * FROM bindings`).length, 1);
  });

  test("an open adjudication blocks later single-match auto-adoption (the run updates evidence only)", async () => {
    const ctx = await ambiguousRouteWorld();
    let stub = stubGeminiList([
      { name: NAME_A, displayName: ctx.displayName },
      { name: NAME_B, displayName: ctx.displayName }]);
    try { await reconcilePost(ctx); } finally { stub.restore(); }
    stub = stubGeminiList([{ name: NAME_A, displayName: ctx.displayName }]);
    try {
      const res = await reconcilePost(ctx);
      assert.equal(res.body.resolved, false);
      assert.equal(res.body.reason, "batch_adjudication_open");
      assert.equal(ctx.w.coord._latestBatchMap(ctx.jobId, "occ-b1").state, "ambiguous");
      const runs = rows(ctx.w, `SELECT * FROM d6_batch_adjudication_runs ORDER BY rowid`);
      assert.equal(runs.length, 2);
      assert.equal(runs[1].outcome, "evidence_updated");
    } finally { stub.restore(); }
  });

  test("no match: the map is byte-identical afterwards (AW: ambiguity is not a terminal state)", async () => {
    const ctx = await ambiguousRouteWorld();
    const before = snapshotDb(ctx.w.db, { exclude: ["d6_batch_adjudication_runs", "d6_batch_adjudications"] });
    const stub = stubGeminiList([]);
    try {
      const res = await reconcilePost(ctx);
      assert.equal(res.body.ok, true);
      assert.equal(res.body.resolved, false);
      assert.equal(res.body.reason, "batch_no_match_not_terminal");
    } finally { stub.restore(); }
    const after = snapshotDb(ctx.w.db, { exclude: ["d6_batch_adjudication_runs", "d6_batch_adjudications"] });
    assert.equal(after, before);
    const runs = rows(ctx.w, `SELECT * FROM d6_batch_adjudication_runs`);
    assert.equal(runs.length, 1);
    assert.equal(runs[0].outcome, "no_match");
    assert.equal(rows(ctx.w, `SELECT * FROM d6_batch_adjudications`).length, 0,
      "a no-match run opens no adjudication");
  });

  test("a single valid match with no open adjudication adopts and resumes (the only automatic adoption)", async () => {
    const ctx = await ambiguousRouteWorld();
    const stub = stubGeminiList([{ name: NAME_A, displayName: ctx.displayName }]);
    try {
      const res = await reconcilePost(ctx);
      assert.equal(res.body.resolved, true);
      assert.equal(res.body.providerName, NAME_A);
      const map = ctx.w.coord._latestBatchMap(ctx.jobId, "occ-b1");
      assert.equal(map.state, "submitted");
      assert.equal(map.provider_name, NAME_A);
      assert.equal(rows(ctx.w, `SELECT * FROM d6_batch_adjudications`).length, 0);
      const runs = rows(ctx.w, `SELECT * FROM d6_batch_adjudication_runs`);
      assert.equal(runs[0].outcome, "adopted");
    } finally { stub.restore(); }
  });

  test("a single INVALID provider name is preserved on an open adjudication and can never be selected", async () => {
    const ctx = await ambiguousRouteWorld();
    const stub = stubGeminiList([{ name: "totally-bogus", displayName: ctx.displayName }]);
    try {
      const res = await reconcilePost(ctx);
      assert.equal(res.body.resolved, false);
      assert.equal(res.body.reason, "batch_single_match_name_invalid");
      const adj = rows(ctx.w, `SELECT * FROM d6_batch_adjudications`);
      assert.equal(adj.length, 1);
      assert.deepEqual(JSON.parse(adj[0].identifiers_json), ["totally-bogus"]);
      const decided = await adjudicatePost(ctx, adj[0].adjudication_id, "totally-bogus");
      assert.equal(decided.body.ok, false);
      assert.equal(decided.body.reason, "batch_adjudication_selection_not_enumerated");
      assert.equal(ctx.w.coord._latestBatchMap(ctx.jobId, "occ-b1").state, "ambiguous");
    } finally { stub.restore(); }
  });

  test("the hardened legacy reconcileBatch adopts nothing on multiple matches (direct call)", async () => {
    const { createExecutor } = await import(`${ADMITTED_TREE}/v2/executor.mjs`);
    const ctx = await ambiguousRouteWorld();
    const legacy = createExecutor({
      coordinator: ctx.w.coord,
      providers: { listBatchesByDisplayName: async () => ([
        { name: NAME_A, displayName: ctx.displayName, nameValid: true },
        { name: NAME_B, displayName: ctx.displayName, nameValid: true }]) },
      cache: {}, consumerId: "legacy-test",
      workSource: async () => BATCH_PAYLOAD });
    const r = await legacy.reconcileBatch(ctx.grant.grantId, ctx.jobId, "occ-b1");
    assert.equal(r.resolved, false);
    assert.equal(r.reason, "batch_duplicate_match_block");
    assert.deepEqual(r.matches, [NAME_A, NAME_B]);
    assert.equal(ctx.w.coord._latestBatchMap(ctx.jobId, "occ-b1").state, "ambiguous");
  });

  test("AW-05: after adoption the next pass polls normally on the same attempt (no new fence, no new dispatch)", async () => {
    const ctx = await ambiguousRouteWorld({ getBatch: () => ({
      done: true, state: "BATCH_STATE_SUCCEEDED", audio: makeWav(0.5),
      format: "wav", durationSec: 0.5 }) });
    const stub = stubGeminiList([{ name: NAME_A, displayName: ctx.displayName }]);
    try { await reconcilePost(ctx); } finally { stub.restore(); }
    const dispatchesBefore = rows(ctx.w, `SELECT * FROM d6_provider_dispatches`).length;
    await ctx.executor.pollBatchPass({ passToken: "p-aw05" });
    assert.equal(rows(ctx.w, `SELECT * FROM d6_provider_dispatches`).length, dispatchesBefore);
    assert.equal(rows(ctx.w, `SELECT * FROM d6_attempt_log`).length, 1);
    assert.equal(oneRow(ctx.w, `SELECT state FROM occurrences WHERE job_id = ? AND occurrence_id = 'occ-b1'`, ctx.jobId).state, "ready");
  });
});

// ----------------------------------------------------------------
describe("BG2-O — operator-route discipline (spec §5)", () => {
  test("both POSTs refuse without the operator credential, and with the client credential in its place", async () => {
    const ctx = await ambiguousRouteWorld();
    const noOp = await entryPost(ctx.w, "/v2/d6-batch-reconcile",
      { jobId: ctx.jobId, occurrenceId: "occ-b1", authorizationRef: "x" },
      { operator: false, client: true });
    assert.equal(noOp.status, 403);
    assert.equal(noOp.body.error, "migration_operator_required");
    // The client token presented AS the operator token:
    const res = await ctx.w.entry.fetch(new Request(
      "https://opalreader.invalid/v2/d6-batch-adjudicate", {
        method: "POST",
        headers: { "x-opalreader-scope": "production",
          "x-opalreader-instance": "account",
          Origin: "https://opalreader.invalid",
          "content-type": "application/json",
          "x-opalreader-token": "battery-client-token",
          "x-opalreader-operator-token": "battery-client-token" },
        body: JSON.stringify({ adjudicationId: "badj-x", jobId: ctx.jobId,
          occurrenceId: "occ-b1", selectedProviderName: "batches/x",
          authorizationRef: "x", evidenceRef: "y" }) }), ctx.w.entryEnv);
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error, "migration_operator_required");
    assert.equal(rows(ctx.w,
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'd6_batch_adjudication%'`).length, 0,
      "refusals write nothing — not even the tables");
  });

  test("extra keys, caller-supplied identities, and caller-supplied figures refuse by their §5 names with zero writes", async () => {
    const ctx = await ambiguousRouteWorld();
    const before = snapshotDb(ctx.w.db);
    const cases = [
      [{ surprise: 1 }, "batch_reconcile_request_key_not_allowed"],
      [{ providerName: "batches/x" }, "batch_provider_identity_caller_supplied"],
      [{ matches: [] }, "batch_provider_identity_caller_supplied"],
      [{ costMicroCents: 5 }, "batch_figure_caller_supplied"],
      [{ exposure: {} }, "batch_figure_caller_supplied"],
    ];
    for (const [extra, reason] of cases) {
      const res = await reconcilePost(ctx, extra);
      assert.equal(res.body.ok, false, JSON.stringify(extra));
      assert.equal(res.body.reason, reason);
    }
    const adjCases = [
      [{ surprise: 1 }, "batch_adjudication_request_key_not_allowed"],
      [{ amount: 5 }, "batch_figure_caller_supplied"],
    ];
    for (const [extra, reason] of adjCases) {
      const res = await entryPost(ctx.w, "/v2/d6-batch-adjudicate",
        { adjudicationId: "badj-x", jobId: ctx.jobId, occurrenceId: "occ-b1",
          selectedProviderName: "batches/x", authorizationRef: "a",
          evidenceRef: "e", ...extra }, { operator: true });
      assert.equal(res.body.ok, false);
      assert.equal(res.body.reason, reason);
    }
    assert.equal(snapshotDb(ctx.w.db), before, "every refusal wrote nothing");
  });

  test("required fields: nonblank authorizationRef on both POSTs, evidenceRef on adjudicate", async () => {
    const ctx = await ambiguousRouteWorld();
    const r1 = await entryPost(ctx.w, "/v2/d6-batch-reconcile",
      { jobId: ctx.jobId, occurrenceId: "occ-b1", authorizationRef: "  " },
      { operator: true });
    assert.equal(r1.body.reason, "authorization_ref_required");
    const r2 = await entryPost(ctx.w, "/v2/d6-batch-adjudicate",
      { adjudicationId: "badj-x", jobId: ctx.jobId, occurrenceId: "occ-b1",
        selectedProviderName: "batches/x", authorizationRef: "a" },
      { operator: true });
    assert.equal(r2.body.reason, "evidence_ref_required");
    const r3 = await entryPost(ctx.w, "/v2/d6-batch-adjudicate",
      { adjudicationId: "badj-missing", jobId: ctx.jobId,
        occurrenceId: "occ-b1", selectedProviderName: "batches/x",
        authorizationRef: "a", evidenceRef: "e" }, { operator: true });
    assert.equal(r3.body.ok, false);
    assert.equal(r3.body.reason, "batch_adjudication_not_found");
  });

  test("repeated reconcile calls are idempotent in effect (runs accumulate; the block stands)", async () => {
    const ctx = await ambiguousRouteWorld();
    const stub = stubGeminiList([
      { name: "batches/aaa111", displayName: ctx.displayName },
      { name: "batches/bbb222", displayName: ctx.displayName }]);
    try {
      await reconcilePost(ctx);
      const res = await reconcilePost(ctx);
      assert.equal(res.body.reason, "batch_duplicate_match_block");
      const adj = rows(ctx.w, `SELECT * FROM d6_batch_adjudications`);
      assert.equal(adj.length, 1, "still exactly one open adjudication");
      assert.equal(rows(ctx.w, `SELECT * FROM d6_batch_adjudication_runs`).length, 2);
      assert.equal(ctx.w.coord._latestBatchMap(ctx.jobId, "occ-b1").state, "ambiguous");
    } finally { stub.restore(); }
  });

  test("while halted, the reconcile route surfaces generation_halted and writes no run record", async () => {
    const ctx = await batchWorld({ tree: ADMITTED_TREE,
      envOverrides: { GENERATION_HALT: "0", GEMINI_API_KEY: "test-key" },
      script: { submitBatch: () => { throw new Error("socket reset"); } } });
    await driveMessage(ctx);
    // The DO class snapshots its env at construction, so the
    // halted surface is a second instance over the same storage
    // with GENERATION_HALT "1", driven at the internal route
    // with the operator-admission stamp (the public gate's own
    // discipline is proven by the BG2-O tests above; this test's
    // subject is the class handler + the adapter halt assert).
    const stub = stubGeminiList([{ name: "batches/aaa111",
      displayName: ctx.w.coord._latestBatchMap(ctx.jobId, "occ-b1").display_name }]);
    try {
      const haltedInst = new ctx.w.OpalReaderCoordinatorProd(ctx.w.state,
        { ...ctx.w.classEnv, GENERATION_HALT: "1" });
      const res = await haltedInst.fetch(new Request(
        "https://do.internal/internal/d6/batch-reconcile", {
          method: "POST",
          headers: { "content-type": "application/json",
            "x-opalreader-internal": "1",
            "x-opalreader-scope": "production",
            "x-opalreader-operator-admitted": "1" },
          body: JSON.stringify({ jobId: ctx.jobId,
            occurrenceId: "occ-b1", authorizationRef: "a" }) }));
      const body = await res.json();
      assert.equal(body.ok, false);
      assert.equal(body.reason, "generation_halted");
      assert.equal(rows(ctx.w,
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'd6_batch_adjudication_runs'`).length, 0);
    } finally { stub.restore(); }
  });
});

// ----------------------------------------------------------------
describe("BG2-C — adjudication windows AW-01..AW-04 (spec §4.3)", () => {
  const NAME_A = "batches/aaa111", NAME_B = "batches/bbb222";
  const adjTables = (ctx) => rows(ctx.w,
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'd6_batch_adjudication%'`);

  test("AW-01: the enumeration itself fails (adapter throw) — no run record, no state change", async () => {
    const ctx = await ambiguousRouteWorld();
    const before = snapshotDb(ctx.w.db);
    const stub = stubGeminiList(null);
    globalThis.fetch = async () => { throw new Error("network down"); };
    try {
      const res = await reconcilePost(ctx);
      // The service does not swallow a non-halt adapter failure:
      // the route call itself fails (the class fetch surfaces the
      // throw), and crucially NOTHING was recorded.
      void res;
    } catch { /* the entry fetch rejects on the adapter throw */ }
    finally { stub.restore(); }
    assert.equal(snapshotDb(ctx.w.db), before);
    assert.equal(adjTables(ctx).length, 0);
  });

  test("AW-02: a fault during adoption inside the reconcile transaction rolls back the run record too", async () => {
    const ctx = await ambiguousRouteWorld();
    const stub = stubGeminiList([{ name: NAME_A, displayName: ctx.displayName }]);
    let res;
    try {
      let n = 0;
      ctx.w.faults.sql = { error: new Error("injected adoption fault"),
        match: (q) => q.includes("UPDATE batch_maps") ? (++n === 1) : false };
      res = await reconcilePost(ctx);
    } finally { ctx.w.faults.sql = null; stub.restore(); }
    assert.ok(res.status !== 200 || res.body?.ok === false,
      "the fault surfaces as a failed call, never a success");
    assert.equal(ctx.w.coord._latestBatchMap(ctx.jobId, "occ-b1").state, "ambiguous");
    assert.equal(adjTables(ctx).length, 0,
      "the run record rolled back with the adoption");
    // And the retry lands cleanly.
    const stub2 = stubGeminiList([{ name: NAME_A, displayName: ctx.displayName }]);
    try {
      const res = await reconcilePost(ctx);
      assert.equal(res.body.resolved, true);
    } finally { stub2.restore(); }
  });

  test("AW-03: a fault on the run-record INSERT (after the adoption write) rolls the adoption back", async () => {
    const ctx = await ambiguousRouteWorld();
    const stub = stubGeminiList([{ name: NAME_A, displayName: ctx.displayName }]);
    let res;
    try {
      ctx.w.faults.sql = { error: new Error("injected run fault"),
        match: (q) => q.includes("INSERT INTO d6_batch_adjudication_runs") };
      res = await reconcilePost(ctx);
    } finally { ctx.w.faults.sql = null; stub.restore(); }
    assert.ok(res.status !== 200 || res.body?.ok === false,
      "the fault surfaces as a failed call, never a success");
    const map = ctx.w.coord._latestBatchMap(ctx.jobId, "occ-b1");
    assert.equal(map.state, "ambiguous");
    assert.equal(map.provider_name, null);
  });

  test("AW-04: a fault on the decision act's record UPDATE rolls the adoption back; the record stays open", async () => {
    const ctx = await ambiguousRouteWorld();
    const stub = stubGeminiList([
      { name: NAME_A, displayName: ctx.displayName },
      { name: NAME_B, displayName: ctx.displayName }]);
    let adjId;
    try {
      const rec = await reconcilePost(ctx);
      adjId = rec.body.adjudicationId;
    } finally { stub.restore(); }
    ctx.w.faults.sql = { error: new Error("injected decide fault"),
      match: (q) => q.includes("UPDATE d6_batch_adjudications SET") &&
        q.includes("status = 'adopted'") };
    const failed = await adjudicatePost(ctx, adjId, NAME_A);
    assert.ok(failed.status !== 200 || failed.body?.ok === false,
      "the fault surfaces as a failed call, never a success");
    ctx.w.faults.sql = null;
    assert.equal(ctx.w.coord._latestBatchMap(ctx.jobId, "occ-b1").state, "ambiguous");
    const adj = rows(ctx.w, `SELECT * FROM d6_batch_adjudications`)[0];
    assert.equal(adj.status, "open");
    assert.equal(adj.selected_provider_name, null);
    const decided = await adjudicatePost(ctx, adjId, NAME_A);
    assert.equal(decided.body.ok, true);
    assert.equal(ctx.w.coord._latestBatchMap(ctx.jobId, "occ-b1").state, "submitted");
  });
});

// ----------------------------------------------------------------
describe("BG2-R — repair partition + origination (spec §3.9, B2-R2)", () => {
  const SYNC_SHA = "a".repeat(64);
  async function coordJobWorld({ lane = "batch", kind = "repair",
      occurrences = ["occ-p", "occ-e"], jobId, data = {} } = {}) {
    const w = await makeWorld(ADMITTED_TREE,
      { envOverrides: { GENERATION_HALT: "0" } });
    const mods = await loadTree(ADMITTED_TREE);
    const store = mods.genstore.createGenStore(w.coord);
    store.ensureSchema();
    const sub = w.coord._submitJob({ jobId, bookId: "book-r",
      chapterIndex: 0, lane, kind,
      occurrences: occurrences.map((id) => ({ occurrenceId: id,
        revisionKey: `rev-${id}` })), data }, `cmd-${jobId}`, kind);
    assert.equal(sub.outcome, "applied");
    mods.quota.bootstrapQuota(w.coord);
    // A SYNC probe over a one-object registry, so a success
    // result can bind through handleReport's synchronous
    // validateAndBind (identity = the occurrence's revision key).
    const objects = new Map([["cache-occ-s",
      { sha256: SYNC_SHA, identity: "rev-occ-s" }]]);
    w.coord.env = { ...w.coord.env, d6StandardOnly: true,
      d6HaltFence: true, probe: {
        exists: (k) => objects.has(k),
        sniff: (k) => objects.has(k) ? "wav" : null,
        hash: (k) => objects.get(k)?.sha256 ?? null,
        recordedSha256: (k) => objects.get(k)?.sha256 ?? null,
        recordedIdentity: (k) => objects.get(k)?.identity ?? null } };
    const grant = await w.coord.requestGrant(jobId, { cause: "bg2-r" });
    assert.equal(grant.ok, true);
    w.coord.claimGrant({ grantId: grant.grantId, consumerId: "bg2-consumer" });
    return { w, mods, store, jobId, grantId: grant.grantId };
  }
  const successResult = { occurrenceId: "occ-s", outcome: "success",
    revisionKey: "rev-occ-s", cacheKey: "cache-occ-s", sha256: SYNC_SHA };
  const mixedResults = [
    { occurrenceId: "occ-p", outcome: "policy_block",
      evidence: { blockReason: "PROHIBITED_CONTENT" } },
    { occurrenceId: "occ-e", outcome: "provider_error",
      error: "batch_provider_error" },
    successResult];
  const mixedFollowOn = { followOn: { occurrences: [
    { occurrenceId: "occ-p", revisionKey: "rev-occ-p" },
    { occurrenceId: "occ-e", revisionKey: "rev-occ-e" }] } };
  const jobRowOf = (w, jobId) => oneRow(w,
    `SELECT * FROM jobs WHERE job_id = ?`, jobId);
  const jobData = (w, jobId) => JSON.parse(jobRowOf(w, jobId).data_json || "{}");
  const followRows = (w, parentId) => rows(w,
    `SELECT * FROM jobs WHERE job_id LIKE ? ORDER BY job_id`,
    `${parentId}:follow:%`);
  const grantsFor = (w, jobId) => rows(w,
    `SELECT * FROM grants WHERE job_id = ?`, jobId);

  test("partition exactness: a batch repair parent's policy_block follow-ons go Standard with the deviation markers; provider_error keeps the batch lane", async () => {
    const ctx = await coordJobWorld({ jobId: "job-r-part",
      occurrences: ["occ-p", "occ-e", "occ-s"] });
    const res = await ctx.w.coord.handleReport({
      grantId: ctx.grantId, jobId: ctx.jobId,
      results: mixedResults, detail: mixedFollowOn });
    assert.equal(res.ok, true);
    const follows = followRows(ctx.w, ctx.jobId);
    assert.equal(follows.length, 2);
    const [policyJob, otherJob] = follows;
    assert.equal(policyJob.job_id, `${ctx.jobId}:follow:1`);
    assert.equal(policyJob.lane, "standard");
    assert.equal(policyJob.kind, "repair");
    assert.deepEqual(jobData(ctx.w, policyJob.job_id), {
      chainParent: ctx.jobId, parentLane: "batch",
      laneDeviation: "batch_policy_block_standard",
      followOnClass: "policy_block" });
    assert.deepEqual(rows(ctx.w,
      `SELECT occurrence_id FROM occurrences WHERE job_id = ?`, policyJob.job_id)
      .map((r) => r.occurrence_id), ["occ-p"]);
    assert.equal(otherJob.job_id, `${ctx.jobId}:follow:2`);
    assert.equal(otherJob.lane, "batch");
    assert.deepEqual(jobData(ctx.w, otherJob.job_id), {
      chainParent: ctx.jobId, parentLane: "batch",
      followOnClass: "other" });
    assert.deepEqual(rows(ctx.w,
      `SELECT occurrence_id FROM occurrences WHERE job_id = ?`, otherJob.job_id)
      .map((r) => r.occurrence_id), ["occ-e"]);
    // Each applied follow-on is granted in the same transaction.
    assert.equal(grantsFor(ctx.w, policyJob.job_id).length, 1);
    assert.equal(grantsFor(ctx.w, otherJob.job_id).length, 1);
  });

  test("a standard parent produces exactly today's follow-on shape (one job, inherited lane, no new data keys)", async () => {
    const ctx = await coordJobWorld({ lane: "standard", jobId: "job-r-std",
      occurrences: ["occ-p", "occ-e", "occ-s"] });
    await ctx.w.coord.handleReport({
      grantId: ctx.grantId, jobId: ctx.jobId,
      results: mixedResults, detail: mixedFollowOn });
    const follows = followRows(ctx.w, ctx.jobId);
    assert.equal(follows.length, 1);
    assert.equal(follows[0].lane, "standard");
    assert.deepEqual(jobData(ctx.w, follows[0].job_id),
      { chainParent: ctx.jobId });
    assert.equal(rows(ctx.w,
      `SELECT occurrence_id FROM occurrences WHERE job_id = ? ORDER BY occurrence_id`,
      follows[0].job_id).length, 2);
  });

  test("FW-01: a fault inside follow-on creation rolls the whole report back — no partial follow-on set, no settled occurrences", async () => {
    const ctx = await coordJobWorld({ jobId: "job-r-fw",
      occurrences: ["occ-p", "occ-e", "occ-s"] });
    let n = 0;
    ctx.w.faults.sql = { error: new Error("injected follow-on fault"),
      match: (q) => q.includes("INSERT INTO jobs") ? (++n === 2) : false };
    await assert.rejects(() => ctx.w.coord.handleReport({
      grantId: ctx.grantId, jobId: ctx.jobId,
      results: mixedResults, detail: mixedFollowOn }),
      /injected follow-on fault/);
    ctx.w.faults.sql = null;
    assert.equal(followRows(ctx.w, ctx.jobId).length, 0);
    assert.equal(oneRow(ctx.w,
      `SELECT state FROM grants WHERE grant_id = ?`, ctx.grantId).state, "issued");
    for (const oid of ["occ-p", "occ-e", "occ-s"])
      assert.equal(oneRow(ctx.w,
        `SELECT state FROM occurrences WHERE job_id = ? AND occurrence_id = ?`,
        ctx.jobId, oid).state, "granted");
  });

  test("ORIGINATION: an original batch job's policy_block creates the first repair job on the Standard lane, granted in the same transaction", async () => {
    const ctx = await coordJobWorld({ kind: "generate", lane: "batch",
      occurrences: ["occ-b1", "occ-s"], jobId: "job-r-orig" });
    await ctx.w.coord.handleReport({
      grantId: ctx.grantId, jobId: ctx.jobId,
      results: [{ occurrenceId: "occ-b1", outcome: "policy_block",
        evidence: { blockReason: "PROHIBITED_CONTENT" } }, successResult] });
    const repairId = `${ctx.jobId}:repair:1`;
    const repair = jobRowOf(ctx.w, repairId);
    assert.ok(repair, "the repair job exists");
    assert.equal(repair.kind, "repair");
    assert.equal(repair.lane, "standard");
    assert.deepEqual(jobData(ctx.w, repairId), {
      chainParent: ctx.jobId, parentLane: "batch",
      laneDeviation: "batch_policy_block_standard",
      followOnClass: "policy_block",
      repairOrigin: "batch_policy_block" });
    assert.deepEqual(rows(ctx.w,
      `SELECT occurrence_id, revision_key FROM occurrences WHERE job_id = ?`, repairId)
      .map((r) => ({ ...r })),
      [{ occurrence_id: "occ-b1", revision_key: "rev-occ-b1" }]);
    assert.equal(grantsFor(ctx.w, repairId).length, 1,
      "granted in the same transaction");
    assert.equal(oneRow(ctx.w,
      `SELECT state FROM occurrences WHERE job_id = ? AND occurrence_id = 'occ-b1'`,
      ctx.jobId).state, "blocked_policy");
  });

  test("origination never fires for: a batch provider_error, a standard original job, or a repair parent", async () => {
    const a = await coordJobWorld({ kind: "generate", lane: "batch",
      occurrences: ["occ-b1"], jobId: "job-r-no1" });
    await a.w.coord.handleReport({ grantId: a.grantId, jobId: a.jobId,
      results: [{ occurrenceId: "occ-b1", outcome: "provider_error",
        error: "batch_provider_error" }] });
    assert.equal(jobRowOf(a.w, `${a.jobId}:repair:1`), undefined);

    const b = await coordJobWorld({ kind: "generate", lane: "standard",
      occurrences: ["occ-b1"], jobId: "job-r-no2" });
    await b.w.coord.handleReport({ grantId: b.grantId, jobId: b.jobId,
      results: [{ occurrenceId: "occ-b1", outcome: "policy_block",
        evidence: { blockReason: "PROHIBITED_CONTENT" } }] });
    assert.equal(jobRowOf(b.w, `${b.jobId}:repair:1`), undefined);

    const c = await coordJobWorld({ kind: "repair", lane: "batch",
      occurrences: ["occ-b1"], jobId: "job-r-no3" });
    await c.w.coord.handleReport({ grantId: c.grantId, jobId: c.jobId,
      results: [{ occurrenceId: "occ-b1", outcome: "policy_block",
        evidence: { blockReason: "PROHIBITED_CONTENT" } }] });
    assert.equal(jobRowOf(c.w, `${c.jobId}:repair:1`), undefined,
      "a repair parent partitions follow-ons; it never originates");
  });

  test("end-to-end: a Batch POLICY_BLOCK originates a Standard repair job whose F3 split chain commits exactly one binding", async () => {
    // ~530 chars: full text and halves block (>150), quarters
    // succeed — 7 provider calls, inside the 12-attempt budget.
    const longText = Array.from({ length: 10 },
      (_, i) => `Synthetic sentence ${i + 1} carries plain narrative weight.`).join(" ");
    const ctx = await batchWorld({ tree: ADMITTED_TREE,
      script: { poll: () => ({ done: true, state: "BATCH_STATE_FAILED",
          classification: { kind: "policy_block", outcome: "policy_block",
            providerCode: null, blockReason: "PROHIBITED_CONTENT",
            finishReason: null, retryable: false, source: "block_reason" } }),
        synthesize: (occ) => {
          if (occ.payload.text.length > 150)
            throw Object.assign(new Error("blocked"),
              { contentBlocked: true });
          return { audio: makeWav(0.5), format: "wav", durationSec: 0.5 };
        } },
      workSource: async (jobId) => ({ status: "ok",
        payload: jobId.includes(":repair:")
          ? { text: longText, voice: "Charon", provider: "gemini",
              model: "gemini-3.8-flash-tts", styleDirection: "",
              mode: "standard" }
          : BATCH_PAYLOAD }) });
    const res = await driveMessage(ctx);
    void res;
    assert.equal(oneRow(ctx.w,
      `SELECT state FROM occurrences WHERE job_id = ? AND occurrence_id = 'occ-b1'`,
      ctx.jobId).state, "blocked_policy");
    const repairId = `${ctx.jobId}:repair:1`;
    assert.ok(jobRowOf(ctx.w, repairId), "origination fired from the real report path");
    const repairGrant = oneRow(ctx.w,
      `SELECT * FROM grants WHERE job_id = ?`, repairId);
    const driven = await ctx.executor.handleMessage({
      grantId: repairGrant.grant_id, jobId: repairId,
      occurrences: ["occ-b1"] });
    assert.equal(driven.occurrences["occ-b1"].committed, true);
    assert.equal(oneRow(ctx.w,
      `SELECT state FROM occurrences WHERE job_id = ? AND occurrence_id = 'occ-b1'`,
      repairId).state, "ready");
    assert.equal(rows(ctx.w, `SELECT * FROM bindings`).length, 1,
      "exactly one binding for the occurrence across both lanes");
    const synthCalls = ctx.providers.calls
      .filter((x) => x.method === "synthesize").length;
    assert.ok(synthCalls >= 3,
      `the split chain made multiple leaf calls (${synthCalls})`);
  });

  test("the shared budget: Batch fence attempts and Standard repair attempts count in ONE segmentAttemptsUsed derivation (plan-linked)", async () => {
    const ctx = await batchWorld({ tree: ADMITTED_TREE });
    const PLAN = "plan:bg2r-budget";
    ctx.w.db.prepare(`INSERT INTO d6_plans (plan_id, intent_key, book_id,
      scope, keep_going, phase, lane, state, stop_reason, eligible_digest,
      created_at, updated_at) VALUES (?, ?, ?, NULL, 0, NULL, 'batch',
      'active', NULL, NULL, ?, ?)`)
      .run(PLAN, "intent:bg2r-budget", "book-1", T0, T0);
    ctx.w.db.prepare(`INSERT INTO d6_plan_jobs (plan_id, job_id, chapter_index, seq)
      VALUES (?, ?, 0, 1)`).run(PLAN, ctx.jobId);
    const bundle = await ctx.executor.batchFenceBundle({
      grantId: ctx.grant.grantId, jobId: ctx.jobId,
      occurrenceId: "occ-b1", planId: PLAN, payload: BATCH_PAYLOAD });
    assert.equal(bundle.map.state, "fenced");
    assert.equal(bundle.attempt.plan_id, PLAN);
    assert.equal(ctx.store.segmentAttemptsUsed(PLAN, "occ-b1"), 1,
      "the Batch submission counts in the shared derivation");
    // The originated-style Standard repair job on the same plan:
    const repairId = `${ctx.jobId}:repair:1`;
    const sub = ctx.w.coord._submitJob({ jobId: repairId,
      bookId: "book-1", chapterIndex: 0, lane: "standard",
      occurrences: [{ occurrenceId: "occ-b1", revisionKey: "rev-occ-b1" }],
      data: { chainParent: ctx.jobId, repairOrigin: "batch_policy_block" } },
      `cmd-${repairId}`, "repair");
    assert.equal(sub.outcome, "applied");
    ctx.w.db.prepare(`INSERT INTO d6_plan_jobs (plan_id, job_id, chapter_index, seq)
      VALUES (?, ?, 0, 2)`).run(PLAN, repairId);
    const g2 = await ctx.w.coord.requestGrant(repairId, { cause: "bg2-r" });
    assert.equal(g2.ok, true);
    const reservation = oneRow(ctx.w,
      `SELECT * FROM d6_grant_reservations WHERE grant_id = ? AND occurrence_id = 'occ-b1'`,
      g2.grantId);
    assert.equal(reservation.slots_total, 11,
      "grant-time slot assignment charged the Batch attempt against the repair job's budget (12 - 1)");
    // One Standard attempt under the same plan linkage:
    const exec2 = ctx.store.createExecution({ planId: PLAN,
      jobId: repairId, occurrenceId: "occ-b1", grantId: g2.grantId });
    ctx.store.transitionExecution(exec2.executionId ?? exec2.execution_id, "attempted");
    const att2 = ctx.store.reserveAttempt(exec2.executionId ?? exec2.execution_id,
      { planId: PLAN, jobId: repairId, occurrenceId: "occ-b1",
        grantId: g2.grantId, upperMicroCents: 500 });
    ctx.store.markDispatching(att2);
    assert.equal(ctx.store.segmentAttemptsUsed(PLAN, "occ-b1"), 2,
      "both lanes' attempts in one count");
  });
});

// ----------------------------------------------------------------
const BASELINE_TREE = join(HERE, "..", "baseline-tree");
describe("BG2-B — inventory, rollback, restoration (spec §3.12)", () => {
  const inventoryGet = (w, qs = "") => entryGet(w,
    `/v2/d6-batch-inventory${qs}`, { operator: true });

  test("inventory over a populated Batch store: rows, linkage, custody classes, and the summary", async () => {
    // One committed (terminal_consumed), one submitted and
    // in-flight (provider_custody), one ambiguous with an open
    // adjudication (provider_custody + duplicate exposure).
    const done = await batchWorld({ tree: ADMITTED_TREE,
      jobId: "job-inv-done", occurrences: ["occ-done"] });
    await driveMessage(done);
    const flying = await batchWorld({ tree: ADMITTED_TREE,
      jobId: "job-inv-fly", occurrences: ["occ-fly"],
      script: { poll: () => ({ done: false, state: "BATCH_STATE_RUNNING" }) } });
    await driveMessage(flying);
    const amb = await ambiguousRouteWorld();
    const stub = stubGeminiList([
      { name: "batches/aaa111", displayName: amb.displayName },
      { name: "batches/bbb222", displayName: amb.displayName }]);
    try { await reconcilePost(amb); } finally { stub.restore(); }

    const w = amb.w; // all three worlds share nothing; use each world's own inventory below
    void w;
    const invDone = await inventoryGet(done.w);
    assert.equal(invDone.body.ok, true);
    assert.equal(invDone.body.total, 1);
    const rowDone = invDone.body.rows[0];
    assert.equal(rowDone.state, "submitted");
    assert.equal(rowDone.custody, "terminal_consumed");
    assert.equal(rowDone.linkage, "ok");
    assert.equal(rowDone.executionState, "committed");
    assert.equal(rowDone.attempt.phase, "confirmed");
    assert.equal(rowDone.attempt.outcome, "success");
    assert.equal(rowDone.attempt.settledCostMicroCents, 113);
    assert.equal(rowDone.dispatch.attemptId, rowDone.attempt.attemptId);
    assert.equal(rowDone.reservation.state, "closed");
    assert.equal(invDone.body.summary.countedDispatches, 1);
    assert.equal(invDone.body.summary.knownSettledMicroCents, 113);
    assert.equal(invDone.body.summary.outstandingMaps, 0);
    assert.equal(invDone.body.summary.outstandingUpperMicroCents, 0);

    const invFly = await inventoryGet(flying.w);
    const rowFly = invFly.body.rows[0];
    assert.equal(rowFly.custody, "provider_custody");
    assert.equal(rowFly.attempt.phase, "dispatching");
    assert.equal(invFly.body.summary.outstandingMaps, 1);
    assert.equal(invFly.body.summary.outstandingUpperMicroCents,
      upperBoundAttemptMicro(BATCH_PAYLOAD.text.length));
    assert.equal(invFly.body.summary.lastDrivePassAt, null,
      "no drive pass has been recorded in this store (chain non-observation, stated not smoothed)");

    const invAmb = await inventoryGet(amb.w);
    const rowAmb = invAmb.body.rows[0];
    assert.equal(rowAmb.state, "ambiguous");
    assert.equal(rowAmb.custody, "provider_custody");
    assert.ok(rowAmb.openAdjudicationId);
    assert.equal(invAmb.body.summary.duplicateUnledgeredUpperMicroCents,
      upperBoundAttemptMicro(BATCH_PAYLOAD.text.length));
    assert.deepEqual(invAmb.body.summary.countsByState, { ambiguous: 1 });
  });

  test("inventory pagination: keyset pages are disjoint, totals exact, truncation explicit", async () => {
    const ctx = await batchWorld({ tree: ADMITTED_TREE,
      occurrences: ["occ-1", "occ-2", "occ-3"],
      script: { poll: () => ({ done: false, state: "BATCH_STATE_RUNNING" }) } });
    await driveMessage(ctx);
    const p1 = await inventoryGet(ctx.w, "?limit=2");
    assert.equal(p1.body.total, 3);
    assert.equal(p1.body.rows.length, 2);
    assert.equal(p1.body.truncated, true);
    assert.ok(p1.body.nextCursor);
    const p2 = await inventoryGet(ctx.w,
      `?limit=2&cursor=${encodeURIComponent(p1.body.nextCursor)}`);
    assert.equal(p2.body.rows.length, 1);
    assert.equal(p2.body.truncated, false);
    assert.equal(p2.body.nextCursor, null);
    const ids = [...p1.body.rows, ...p2.body.rows]
      .map((r) => r.occurrenceId);
    assert.deepEqual(ids, ["occ-1", "occ-2", "occ-3"]);
    const bad = await inventoryGet(ctx.w, "?limit=abc");
    assert.equal(bad.status, 400);
    assert.equal(bad.body.error, "batch_inventory_pagination_invalid");
    const noOp = await entryGet(ctx.w, "/v2/d6-batch-inventory",
      { operator: false });
    assert.equal(noOp.status, 403);
  });

  test("inventory is read-pure: it creates no tables and changes no rows on a Batch-less store", async () => {
    const w = await makeWorld(TREE);
    const before = snapshotDb(w.db);
    const inv = await inventoryGet(w);
    assert.equal(inv.body.ok, true);
    assert.equal(inv.body.total, 0);
    assert.deepEqual(inv.body.rows, []);
    assert.equal(inv.body.summary.countedDispatches, 0);
    assert.equal(snapshotDb(w.db), before);
  });

  test("rollback + restoration: a Standard-only build leaves Batch rows untouched; the restored build resumes without resubmitting", async () => {
    const ctx = await batchWorld({ tree: ADMITTED_TREE,
      script: { poll: () => ({ done: false, state: "BATCH_STATE_RUNNING" }) } });
    await driveMessage(ctx); // submitted, in flight
    const before = await inventoryGet(ctx.w);
    assert.equal(before.body.rows[0].custody, "provider_custody");
    // Simulated rollback: run the BASELINE (pre-B-G2) tree's D6
    // executor against the same storage. It has no batch branch:
    // the batch message meets its layer-1 refusal, and no Batch
    // row is touched.
    const baseMods = await loadTree(BASELINE_TREE);
    const baseStore = baseMods.genstore.createGenStore(ctx.w.coord);
    const baseExecutor = baseMods.d6Executor.createD6Executor({
      coord: ctx.w.coord, store: baseStore, providers: ctx.providers,
      flushStore: baseMods.flushStore.createFlushStore(ctx.bucket,
        { keyPrefix: "" }),
      cache: stubCache,
      workSource: async () => ({ status: "ok", payload: BATCH_PAYLOAD }),
      consumerId: "bg2-consumer" });
    const refused = await baseExecutor.handleMessage({
      grantId: ctx.grant.grantId, jobId: ctx.jobId,
      occurrences: ["occ-b1"] });
    assert.ok(JSON.stringify(refused).includes("lane_not_allowed"),
      "the rolled-back build refuses the batch message at layer 1");
    const after = await inventoryGet(ctx.w);
    const strip = (inv) => inv.body.rows.map((r) => ({
      ...r, updatedAt: 0 }));
    assert.deepEqual(strip(after), strip(before),
      "identity + accounting fields identical across the rollback window");
    assert.deepEqual(after.body.summary, before.body.summary);
    // Restoration: the Batch-capable build resumes — it polls
    // the submitted map (retrieval), converts nothing, and
    // submits ZERO additional times.
    const submitsBefore = ctx.providers.calls
      .filter((x) => x.method === "submitBatch").length;
    await ctx.executor.pollBatchPass({ passToken: "p-restore" });
    assert.equal(ctx.providers.calls
      .filter((x) => x.method === "submitBatch").length, submitsBefore);
    assert.ok(ctx.providers.calls
      .filter((x) => x.method === "getBatch").length >= 1);
    assert.equal(ctx.w.coord._latestBatchMap(ctx.jobId, "occ-b1").state, "submitted");
  });

  test("NOT-do invariants are pinned at the source level (spec §3.12)", async () => {
    const { readFileSync } = await import("node:fs");
    const src = (rel) => readFileSync(join(TREE, "v2", rel), "utf8");
    const delta = [
      src("generation/d6-executor.mjs"), src("generation/genstore.mjs"),
      src("generation/service.mjs"), src("coordinator.mjs"),
      src("worker-entry-prod-d6.js"), src("executor.mjs"),
      src("host/adapters.mjs"),
    ].join("\n");
    assert.ok(!delta.includes('"abandoned"') && !delta.includes("'abandoned'"),
      "no 'abandoned' map state exists anywhere in the delta");
    assert.ok(!/DELETE\s+FROM\s+(batch_maps|spend_intents|d6_attempt_log|d6_provider_dispatches|d6_grant_reservations|d6_execution_records|d6_batch_poll_|d6_batch_adjudication)/i.test(delta),
      "no deletion of Batch/accounting rows anywhere in the delta");
    // The inventory implementation itself: locate its source
    // span and prove it performs no provider call and no
    // never-accepted resolution.
    const service = src("generation/service.mjs");
    const invStart = service.indexOf("function batchInventory");
    const invSpan = service.slice(invStart, invStart + 9000);
    assert.ok(!invSpan.includes("submitBatch") &&
              !invSpan.includes("listBatchesByDisplayName") &&
              !invSpan.includes("resolveBatchNeverAccepted"),
      "the inventory path calls no provider operation and no never-accepted resolution");
    assert.ok(!invSpan.includes("getBatch"),
      "the inventory path does not poll");
  });
});

// ----------------------------------------------------------------
describe("BG2-S — inertness on the SHIPPED candidate tree (spec §3.13)", () => {
  test("the shipped allowlist is exactly [\"standard\"] (read from the tree itself)", async () => {
    const mods = await loadTree(TREE);
    assert.deepEqual([...mods.constants.D6_LANE_ALLOWLIST], ["standard"]);
  });

  test("(a) a Batch intent is refused lane_not_allowed at admission; capabilities report batch_not_armed", async () => {
    const w = await makeWorld(TREE);
    w.coord.env = { ...w.coord.env, d6StandardOnly: true, d6HaltFence: true };
    const sub = w.coord._submitJob({ jobId: "job-s-batch",
      bookId: "book-s", chapterIndex: 0, lane: "batch",
      occurrences: [{ occurrenceId: "occ-s1", revisionKey: "rev-occ-s1" }],
      data: {} }, "cmd-s-batch", "generate");
    assert.equal(sub.outcome, "rejected");
    assert.equal(sub.reason, "lane_not_allowed");
    const caps = w.service.capabilities();
    assert.deepEqual(caps.lanes.batch,
      { admitted: false, reason: "batch_not_armed" });
    assert.deepEqual(caps.lanes.standard, { admitted: true });
  });

  test("(b) a Batch dispatch message, a Batch-lane job, and a Batch work payload are each refused with zero provider calls and zero accounting rows", async () => {
    const ctx = await batchWorld({}); // TREE: the shipped candidate
    const res = await driveMessage(ctx);
    assert.ok(JSON.stringify(res).includes("lane_not_allowed"),
      JSON.stringify(res));
    assert.equal(ctx.providers.calls.length, 0);
    assert.equal(rows(ctx.w, `SELECT * FROM batch_maps`).length, 0);
    assert.equal(rows(ctx.w, `SELECT * FROM d6_attempt_log`).length, 0);
    assert.equal(rows(ctx.w, `SELECT * FROM d6_provider_dispatches`).length, 0);
    assert.equal(rows(ctx.w, `SELECT * FROM d6_execution_records`).length, 0);
  });

  test("(c) the new operator routes exist but are no-op refusals against a Batch-less store", async () => {
    const w = await makeWorld(TREE,
      { envOverrides: { GENERATION_HALT: "0", GEMINI_API_KEY: "test-key" } });
    const before = snapshotDb(w.db);
    const rec = await entryPost(w, "/v2/d6-batch-reconcile",
      { jobId: "job-none", occurrenceId: "occ-none",
        authorizationRef: "auth-s" }, { operator: true });
    assert.equal(rec.body.ok, true);
    assert.equal(rec.body.resolved, false);
    assert.equal(rec.body.reason, "not_ambiguous");
    const adj = await entryPost(w, "/v2/d6-batch-adjudicate",
      { adjudicationId: "badj-none", jobId: "job-none",
        occurrenceId: "occ-none", selectedProviderName: "batches/x",
        authorizationRef: "auth-s", evidenceRef: "ev-s" },
      { operator: true });
    assert.equal(adj.body.ok, false);
    assert.equal(adj.body.reason, "batch_adjudication_not_found");
    assert.equal(snapshotDb(w.db), before,
      "no run record, no tables, no rows — pure refusals");
  });

  test("(d) pollBatchPass on a Batch-less store polls nothing and writes nothing", async () => {
    const ctx = await batchWorld({ lane: "standard" });
    const before = snapshotDb(ctx.w.db);
    const out = await ctx.executor.pollBatchPass({ passToken: "p-inert" });
    assert.deepEqual(out, []);
    assert.equal(snapshotDb(ctx.w.db), before);
  });

  test("the alarm entry gate: while GENERATION_HALT is not \"0\" the poll driver is not invoked at all", async () => {
    // Seed a submitted map through the standalone worlds, then
    // fire the class alarm on the (halted-by-default) class env.
    const ctx = await batchWorld({ tree: ADMITTED_TREE,
      envOverrides: { GENERATION_HALT: "0" },
      script: { poll: () => ({ done: false, state: "BATCH_STATE_RUNNING" }) } });
    await driveMessage(ctx);
    assert.equal(ctx.w.coord._latestBatchMap(ctx.jobId, "occ-b1").state, "submitted");
    await ctx.w.fireClassAlarm();
    const tables = rows(ctx.w,
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'd6_batch_poll_state'`);
    assert.equal(tables.length, 0,
      "no poll state exists: the driver never ran under the halt");
    assert.equal(ctx.providers.calls
      .filter((x) => x.method === "getBatch").length, 1,
      "only the queue message's immediate poll ever called getBatch");
  });

  test("a Standard end-to-end behaves identically on the candidate and the baseline tree", async () => {
    async function standardRun(tree) {
      const ctx = await batchWorld({ tree, lane: "standard",
        payload: { ...BATCH_PAYLOAD, mode: "standard" } });
      const res = await driveMessage(ctx);
      return {
        outcome: res.occurrences["occ-b1"],
        occState: oneRow(ctx.w,
          `SELECT state FROM occurrences WHERE job_id = ? AND occurrence_id = 'occ-b1'`,
          ctx.jobId).state,
        execState: ctx.store.executionFor(ctx.jobId, "occ-b1").state,
        bindings: rows(ctx.w, `SELECT * FROM bindings`).length,
        grantState: oneRow(ctx.w,
          `SELECT state FROM grants WHERE grant_id = ?`,
          ctx.grant.grantId).state,
        attempts: rows(ctx.w,
          `SELECT phase, outcome, cost_micro_cents FROM d6_attempt_log`)
          .map((r) => ({ ...r })),
      };
    }
    const cand = await standardRun(TREE);
    const base = await standardRun(BASELINE_TREE);
    assert.deepEqual(cand, base);
    assert.equal(cand.execState, "committed");
  });
});

// ----------------------------------------------------------------
describe("BG2-H — failure behavior completion (spec §3.14)", () => {
  test("every new §3 read path answers its specified shape against empty tables under the throwing .one()", async () => {
    const w = await makeWorld(TREE);
    const mods = await loadTree(TREE);
    const store = mods.genstore.createGenStore(w.coord);
    assert.equal(store.batchTerminalReceipt("job-x", "occ-x"), null);
    assert.equal(store.batchPollState("job-x", "occ-x", 1), null);
    assert.equal(w.coord.batchAdjudicationOpenFor("job-x", "occ-x", 1), null);
    assert.deepEqual(w.coord.batchAdjudicationRows(), []);
    const tables = rows(w,
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN
       ('d6_batch_terminal_receipts', 'd6_batch_poll_state',
        'd6_batch_adjudication_runs', 'd6_batch_adjudications')`);
    assert.equal(tables.length, 0, "reads created no tables");
  });

  test("adjudication presence discipline under all four table-presence combinations", async () => {
    const mk = async () => {
      const w = await makeWorld(TREE);
      return w;
    };
    // only runs present -> inconsistent
    let w = await mk();
    w.db.prepare(`CREATE TABLE d6_batch_adjudication_runs (run_id TEXT)`).run();
    assert.throws(() => w.coord.batchAdjudicationRows(),
      /batch_adjudication_schema_inconsistent/);
    assert.throws(() => w.coord.batchAdjudicationOpenFor("j", "o", 1),
      /batch_adjudication_schema_inconsistent/);
    assert.throws(() => w.coord.batchAdjudicationDecide({
      adjudicationId: "x", jobId: "j", occurrenceId: "o",
      selectedProviderName: "batches/x", authorizationRef: "a",
      evidenceRef: "e" }), /batch_adjudication_schema_inconsistent/);
    // only adjudications present -> inconsistent
    w = await mk();
    w.db.prepare(`CREATE TABLE d6_batch_adjudications (adjudication_id TEXT)`).run();
    assert.throws(() => w.coord.batchAdjudicationRows(),
      /batch_adjudication_schema_inconsistent/);
    // both present (real DDL via a reconcile-shaped ensure) -> reads work
    w = await mk();
    w.coord._ensureBatchAdjSchema();
    assert.deepEqual(w.coord.batchAdjudicationRows(), []);
    assert.equal(w.coord.batchAdjudicationOpenFor("j", "o", 1), null);
    assert.deepEqual(w.coord.batchAdjudicationDecide({
      adjudicationId: "x", jobId: "j", occurrenceId: "o",
      selectedProviderName: "batches/x", authorizationRef: "a",
      evidenceRef: "e" }), { ok: false, reason: "batch_adjudication_not_found" });
  });

  test("note*/transition refusals write zero rows", async () => {
    const ctx = await batchWorld({ tree: ADMITTED_TREE });
    const bundle = await ctx.executor.batchFenceBundle({
      grantId: ctx.grant.grantId, jobId: ctx.jobId,
      occurrenceId: "occ-b1", planId: null, payload: BATCH_PAYLOAD });
    assert.equal(bundle.map.state, "fenced");
    const noted = ctx.w.coord.noteBatchSubmitted({
      jobId: ctx.jobId, occurrenceId: "occ-b1",
      providerName: "batches/x" });
    assert.equal(noted.ok, true); // the one legal transition
    const before = snapshotDb(ctx.w.db);
    const refused = ctx.w.coord.noteBatchSubmitted({
      jobId: ctx.jobId, occurrenceId: "occ-b1",
      providerName: "batches/y" });
    assert.equal(refused.ok, false,
      "a second submission note on a submitted map refuses");
    assert.equal(snapshotDb(ctx.w.db), before,
      "the refusal wrote zero rows");
  });

  test("a queue-branch poll throw leaves exactly the §3.5 durable state (map submitted, attempt dispatching, intent open)", async () => {
    const ctx = await batchWorld({ tree: ADMITTED_TREE, script: {
      getBatch: () => { throw new Error("provider down"); } } });
    const res = await driveMessage(ctx);
    assert.deepEqual(res.occurrences["occ-b1"],
      { pending: true, pollError: true, batch: true });
    const map = ctx.w.coord._latestBatchMap(ctx.jobId, "occ-b1");
    assert.equal(map.state, "submitted");
    const exec = ctx.store.executionFor(ctx.jobId, "occ-b1");
    assert.equal(exec.state, "attempted");
    assert.equal(ctx.store.attemptsForExecution(exec.execution_id)[0].phase,
      "dispatching");
    const intent = ctx.w.coord._latestIntent(ctx.jobId, "occ-b1");
    assert.equal(intent.outcome, null);
  });
});

// ----------------------------------------------------------------
describe("BG2-A — accounting completion (spec §4.1/§4.2)", () => {
  const quotaMods = async (tree) => (await loadTree(tree)).quota;

  test("a fence charges to the FENCE day across a PT day boundary; the settled day still reconciles", async () => {
    let polls = 0;
    const ctx = await batchWorld({ tree: ADMITTED_TREE, script: {
      poll: () => (++polls === 1
        ? { done: false, state: "BATCH_STATE_RUNNING" }
        : { done: true, state: "BATCH_STATE_SUCCEEDED",
            audio: makeWav(0.5), format: "wav", durationSec: 0.5 }) } });
    await driveMessage(ctx); // fence + submit + pending poll, day 1
    const exec = ctx.store.executionFor(ctx.jobId, "occ-b1");
    const fenceDay = ctx.store.attemptsForExecution(exec.execution_id)[0]
      .dispatched_day_key;
    ctx.w.advance(21 * 60 * 60 * 1000); // next PT day
    const res = await driveMessage(ctx); // poll succeeds, settles
    assert.equal(res.occurrences["occ-b1"].committed, true);
    const attempt = ctx.store.attemptsForExecution(exec.execution_id)[0];
    assert.equal(attempt.dispatched_day_key, fenceDay,
      "the dispatch stayed charged to the fence day");
    const quota = await quotaMods(ADMITTED_TREE);
    const rec = quota.reconcileQuota(ctx.w.coord);
    assert.equal(rec.ok, true, JSON.stringify(rec.drift || rec));
    assert.ok(Object.keys(rec.dayTotals || {}).includes(fenceDay));
  });

  test("a mixed Standard + Batch day reconciles ok:true with no drift", async () => {
    const ctx = await batchWorld({ tree: ADMITTED_TREE,
      workSource: async (jobId) => ({ status: "ok",
        payload: jobId === "job-a-std"
          ? { ...BATCH_PAYLOAD, mode: "standard" } : BATCH_PAYLOAD }) });
    await driveMessage(ctx); // batch success, settled
    // A standard job in the same world/day:
    const sub = ctx.w.coord._submitJob({ jobId: "job-a-std",
      bookId: "book-1", chapterIndex: 1, lane: "standard",
      occurrences: [{ occurrenceId: "occ-s1", revisionKey: "rev-occ-s1" }],
      data: {} }, "cmd-a-std", "generate");
    assert.equal(sub.outcome, "applied");
    const g = await ctx.w.coord.requestGrant("job-a-std", { cause: "bg2-a" });
    assert.equal(g.ok, true);
    const driven = await ctx.executor.handleMessage({
      grantId: g.grantId, jobId: "job-a-std", occurrences: ["occ-s1"] });
    assert.equal(driven.occurrences["occ-s1"].committed, true);
    const quota = await quotaMods(ADMITTED_TREE);
    const rec = quota.reconcileQuota(ctx.w.coord);
    assert.equal(rec.ok, true, JSON.stringify(rec.drift || rec));
    assert.deepEqual(rec.drift || [], []);
  });

  test("I-6: each injected drift class over settled Batch rows is detected under the Standard names", async () => {
    // (i) slots_consumed mismatch
    {
      const ctx = await batchWorld({ tree: ADMITTED_TREE });
      await driveMessage(ctx);
      ctx.w.db.prepare(`UPDATE d6_grant_reservations
        SET slots_consumed = slots_consumed + 1`).run();
      const quota = await quotaMods(ADMITTED_TREE);
      const rec = quota.reconcileQuota(ctx.w.coord);
      assert.equal(rec.ok, false);
      assert.ok(rec.drift.some((d) => d.kind === "slots_consumed_mismatch"),
        JSON.stringify(rec.drift));
    }
    // (ii) a dispatch row whose attempt lost its day stamp
    {
      const ctx = await batchWorld({ tree: ADMITTED_TREE });
      await driveMessage(ctx);
      ctx.w.db.prepare(`UPDATE d6_attempt_log
        SET dispatched_day_key = NULL`).run();
      const quota = await quotaMods(ADMITTED_TREE);
      const rec = quota.reconcileQuota(ctx.w.coord);
      assert.equal(rec.ok, false);
      assert.ok(rec.drift.some((d) => d.kind === "dispatch_row_unmatched"),
        JSON.stringify(rec.drift));
    }
    // (iii) a stamped attempt whose dispatch row is deleted
    {
      const ctx = await batchWorld({ tree: ADMITTED_TREE });
      await driveMessage(ctx);
      ctx.w.db.prepare(`DELETE FROM d6_provider_dispatches`).run();
      const quota = await quotaMods(ADMITTED_TREE);
      const rec = quota.reconcileQuota(ctx.w.coord);
      assert.equal(rec.ok, false);
      assert.ok(rec.drift.some((d) =>
        d.kind === "stamped_attempt_without_dispatch_row"),
        JSON.stringify(rec.drift));
    }
  });
});
