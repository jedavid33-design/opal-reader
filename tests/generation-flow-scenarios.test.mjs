// Run: node --test tests/generation-flow-scenarios.test.mjs
// Case #4 final pass — Rowan §5 generation-flow verification against
// the REAL Worker module. Julie's required sequence: generate in
// order; on POLICY_BLOCK split at safe boundaries and resolve the
// ENTIRE split tree before advancing to the next original segment;
// an irreducible piece is marked blocked (never faked complete); a
// genuine daily 429 parks everything with the tree and audio intact;
// a temporary 429 is NOT a daily quota; Resume during a park spends
// exactly one test call; Batch and Standard share one audio cache.
import test from "node:test";
import assert from "node:assert/strict";
import worker from "../cloudflare-worker.js";
import {
  makeHarness, makeSegment, sha256Hex, jsonResponse, RELEASE, CLIENT_VERSION,
} from "./support/mock-env.mjs";

const T0 = Date.UTC(2026, 9, 20, 15, 0, 0); // Oct 20, 08:00 PDT
const PARK_KEY = "quota/gemini-park.json";

const policy400 = () => jsonResponse({
  error: {
    message: "Request blocked: the input was blocked because it violates the Generative AI Prohibited Use Policy.",
    status: "INVALID_ARGUMENT",
  },
}, 400);
const daily429 = () => jsonResponse({
  error: {
    message: "Quota exceeded for quota metric 'GenerateRequestsPerDayPerProjectPerModel' and limit: 100 for project.",
    status: "RESOURCE_EXHAUSTED",
    details: [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "3600s" }],
  },
}, 429);
const temporary429 = () => jsonResponse({
  error: {
    message: "Rate limit exceeded. Please retry later.",
    status: "RESOURCE_EXHAUSTED",
    details: [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "5s" }],
  },
}, 429);

// Records the narration text of every Interactions call, in order, and
// lets a script decide per-text responses (return a Response to
// override, undefined for the default success).
function scripted(script) {
  const calls = [];
  const onInteractions = async (_n, init) => {
    let text = "";
    try {
      const body = JSON.parse(init?.body || "{}");
      text = body?.input?.[0]?.content?.[0]?.text || "";
    } catch { /* leave empty */ }
    calls.push(text);
    return script(text, calls.length);
  };
  return { calls, onInteractions };
}

async function postJob(h, jobId, segments, extra = {}) {
  const res = await h.request("/api/generation/jobs", {
    method: "POST",
    body: {
      job_id: jobId, book_id: "book-test-1", chapter_index: 0,
      generation_release: RELEASE, client_version: CLIENT_VERSION,
      segments, ...extra,
    },
  });
  return { status: res.status, body: await res.json() };
}
const getStatus = async (h, jobId) =>
  (await h.request(`/api/generation/jobs/${jobId}`)).json();
const seg = (seed, text, extra = {}) =>
  makeSegment(seed, { text, ...extra });
// Adaptive-repair plan nodes in the exact shape the client builds and
// validateAdaptiveRepairPayload enforces: per original segment
// (repair_source_index), roots are the "L"/"R" halves (repair_parent
// -1); children extend the path ("LL", "LR", ...) and point at their
// parent's payload index.
const anode = (seed, text, { parent, path, source }) => makeSegment(seed, {
  text, repair_parent: parent, repair_path: path,
  segment_index: source, repair_source_index: source,
});
const hasAudio = (h, segment) => h.r2.store.has(`audio/${segment.cache_key}.wav`);

test("§5.1 clean chapter: segments generate sequentially, in order, no intervention", async () => {
  const s = scripted(() => undefined);
  const h = makeHarness(worker, { clockStart: T0, fetchBehavior: { onInteractions: s.onInteractions } });
  const jobId = sha256Hex("flow-clean");
  const segs = [seg("c1", "clean segment one"), seg("c2", "clean segment two"), seg("c3", "clean segment three")];
  await postJob(h, jobId, segs);
  await h.drain();
  const status = await getStatus(h, jobId);
  assert.equal(status.state, "ready");
  assert.equal(status.completed, 3);
  assert.deepEqual(s.calls, ["clean segment one", "clean segment two", "clean segment three"],
    "strictly sequential, in chapter order");
  assert.ok(segs.every((x) => hasAudio(h, x)), "every segment's audio is saved");
  h.restore();
});

test("§5.2 single block: the split tree fully resolves before the next original segment is attempted", async () => {
  const s = scripted((text) => text === "beta left" ? policy400() : undefined);
  const h = makeHarness(worker, { clockStart: T0, fetchBehavior: { onInteractions: s.onInteractions } });
  const jobId = sha256Hex("flow-single-block");
  // Pre-order repair tree for original segment 1 (left half blocks and
  // splits), then original segment 2's two halves.
  const nodes = [
    anode("b-l", "beta left", { parent: -1, path: "L", source: 0 }),
    anode("b-l1", "beta left one", { parent: 0, path: "LL", source: 0 }),
    anode("b-l2", "beta left two", { parent: 0, path: "LR", source: 0 }),
    anode("b-r", "beta right", { parent: -1, path: "R", source: 0 }),
    anode("b-n", "gamma next root", { parent: -1, path: "L", source: 1 }),
    anode("b-n2", "gamma next root right", { parent: -1, path: "R", source: 1 }),
  ];
  await postJob(h, jobId, nodes, { adaptive_repair: true, diagnostic_job_kind: "adaptive_repair" });
  await h.drain();
  const status = await getStatus(h, jobId);
  assert.deepEqual(s.calls,
    ["beta left", "beta left one", "beta left two", "beta right", "gamma next root", "gamma next root right"],
    "children are generated before ANY later piece — no jumping ahead");
  assert.equal(status.state, "ready");
  assert.equal(status.segments[0].state, "split");
  assert.ok(status.segments.slice(1).every((x) => x.state === "ready"));
  h.restore();
});

test("§5.3 nested block: a blocked child subdivides and completes before generation advances", async () => {
  const s = scripted((text) =>
    text === "delta left" || text === "delta mid" ? policy400() : undefined);
  const h = makeHarness(worker, { clockStart: T0, fetchBehavior: { onInteractions: s.onInteractions } });
  const jobId = sha256Hex("flow-nested-block");
  const nodes = [
    anode("d-l", "delta left", { parent: -1, path: "L", source: 0 }),
    anode("d-m", "delta mid", { parent: 0, path: "LL", source: 0 }),
    anode("d-a", "delta leaf a", { parent: 1, path: "LLL", source: 0 }),
    anode("d-b", "delta leaf b", { parent: 1, path: "LLR", source: 0 }),
    anode("d-r2", "delta right child", { parent: 0, path: "LR", source: 0 }),
    anode("d-r", "delta right", { parent: -1, path: "R", source: 0 }),
  ];
  await postJob(h, jobId, nodes, { adaptive_repair: true, diagnostic_job_kind: "adaptive_repair" });
  await h.drain();
  const status = await getStatus(h, jobId);
  assert.deepEqual(s.calls,
    ["delta left", "delta mid", "delta leaf a", "delta leaf b", "delta right child", "delta right"],
    "depth-first: grandchildren finish before the parent's sibling subtree");
  assert.equal(status.state, "ready");
  assert.equal(status.segments[0].state, "split");
  assert.equal(status.segments[1].state, "split");
  assert.ok(status.segments.slice(2).every((x) => x.state === "ready"));
  h.restore();
});

test("§5.4 irreducible block: piece is marked blocked, surrounding audio retained, chapter NOT complete", async () => {
  const s = scripted((text) => text === "epsilon stuck" ? policy400() : undefined);
  const h = makeHarness(worker, { clockStart: T0, fetchBehavior: { onInteractions: s.onInteractions } });
  const jobId = sha256Hex("flow-irreducible");
  // The stuck piece has NO children in the plan: no safe split remains.
  const nodes = [
    anode("e-s", "epsilon stuck", { parent: -1, path: "L", source: 0 }),
    anode("e-f", "epsilon free", { parent: -1, path: "R", source: 0 }),
  ];
  await postJob(h, jobId, nodes, { adaptive_repair: true, diagnostic_job_kind: "adaptive_repair" });
  await h.drain();
  const status = await getStatus(h, jobId);
  assert.equal(status.state, "partial", "never faked ready/complete");
  assert.equal(status.blocked, 1);
  assert.equal(status.segments[0].state, "blocked");
  assert.equal(status.segments[0].block_reason, "POLICY_BLOCK");
  assert.equal(status.segments[1].state, "ready", "generation continued past the blocked piece");
  assert.ok(hasAudio(h, nodes[1]), "the successful piece's audio is preserved");
  assert.ok(!hasAudio(h, nodes[0]), "the blocked piece has no audio and claims none");
  h.restore();
});

test("§5.5 quota during splitting: a daily 429 parks the job with the split tree and audio intact", async () => {
  const s = scripted((text) => {
    if (text === "alpha root left") return policy400();
    if (text === "alpha child two") return daily429();
    return undefined;
  });
  const h = makeHarness(worker, { clockStart: T0, fetchBehavior: { onInteractions: s.onInteractions } });
  const jobId = sha256Hex("flow-quota-split");
  const nodes = [
    anode("a-l", "alpha root left", { parent: -1, path: "L", source: 0 }),
    anode("a-c1", "alpha child one", { parent: 0, path: "LL", source: 0 }),
    anode("a-c2", "alpha child two", { parent: 0, path: "LR", source: 0 }),
    anode("a-r", "alpha root right", { parent: -1, path: "R", source: 0 }),
  ];
  await postJob(h, jobId, nodes, { adaptive_repair: true, diagnostic_job_kind: "adaptive_repair" });
  await h.drain();
  const status = await getStatus(h, jobId);
  assert.equal(status.state, "paused_quota");
  assert.deepEqual(s.calls, ["alpha root left", "alpha child one", "alpha child two"],
    "the park stopped the process — the next root was never attempted");
  assert.equal(status.segments[0].state, "split", "tree structure preserved");
  assert.equal(status.segments[1].state, "ready");
  assert.ok(hasAudio(h, nodes[1]), "audio generated before the 429 is preserved");
  assert.equal(status.segments[2].state, "queued", "the 429'd piece waits, undamaged");
  assert.equal(status.segments[3].state, "queued", "later work is untouched, not lost");
  const park = await h.r2.readJson(PARK_KEY);
  assert.ok(park && park.scope === "daily", "the shared project park was written");
  h.restore();
});

test("§5.5b a temporary 429 is NOT treated as exhausted daily quota", async () => {
  let first = true;
  const s = scripted(() => {
    if (first) { first = false; return temporary429(); }
    return undefined;
  });
  const h = makeHarness(worker, { clockStart: T0, fetchBehavior: { onInteractions: s.onInteractions } });
  const jobId = sha256Hex("flow-temporary-429");
  await postJob(h, jobId, [seg("t1", "temporary limit segment")]);
  await h.drain();
  const status = await getStatus(h, jobId);
  assert.equal(status.state, "ready", "the job retried after a bounded wait and finished");
  assert.equal(h.google.calls.interactions, 2, "one 429 + one successful retry");
  assert.equal(await h.r2.readJson(PARK_KEY), null, "no project park was written");
  assert.equal(status.quota_diagnostics?.at(-1)?.cooldown_scope, "temporary");
  assert.equal(status.quota_diagnostics?.at(-1)?.manual_resume_required, false);
  h.restore();
});

test("§5.6 Resume during a park spends exactly one test dispatch, then re-parks", async () => {
  let quota = true;
  const s = scripted(() => quota ? daily429() : undefined);
  const h = makeHarness(worker, { clockStart: T0, fetchBehavior: { onInteractions: s.onInteractions } });
  const jobId = sha256Hex("flow-resume-probe");
  const segs = [seg("r1", "resume segment one"), seg("r2", "resume segment two")];
  await postJob(h, jobId, segs);
  await h.drain();
  assert.equal((await getStatus(h, jobId)).state, "paused_quota");
  assert.equal(h.google.calls.interactions, 1);

  // Quota is still exhausted in reality, but Google lets the probe
  // call through (the Oct 20 anomaly shape): exactly ONE dispatch may
  // happen, its audio is kept, and the job must re-park — not drain.
  quota = false;
  const res = await h.request(`/api/generation/jobs/${jobId}/resume`, {
    method: "POST", body: {},
  });
  const resumed = await res.json();
  assert.equal(resumed.probe, true);
  await h.drain();
  assert.equal(h.google.calls.interactions, 2, "exactly one test dispatch was spent");
  const status = await getStatus(h, jobId);
  assert.equal(status.state, "paused_quota", "re-parked instead of draining");
  assert.equal(status.segments[0].state, "ready", "the probe's audio is saved");
  assert.equal(status.segments[1].state, "queued", "no cascade into the next segment");
  h.restore();
});

test("§5.7 Batch and Standard share one cache: mode switches never regenerate existing audio", async () => {
  // Standard first, then a Batch job over the same cache key.
  const h = makeHarness(worker, { clockStart: T0 });
  const shared = seg("shared-1", "zeta shared segment");
  const stdId = sha256Hex("flow-mode-std");
  await postJob(h, stdId, [shared]);
  await h.drain();
  assert.equal((await getStatus(h, stdId)).state, "ready");
  assert.equal(h.google.calls.interactions, 1);
  const batchId = sha256Hex("flow-mode-batch-after");
  await postJob(h, batchId, [seg("shared-1", "zeta shared segment")], { generation_mode: "batch" });
  await h.drain();
  assert.equal((await getStatus(h, batchId)).state, "ready");
  assert.equal(h.google.calls.batchSubmit, 0, "cached audio: no Batch submission spent");
  assert.equal(h.google.calls.interactions, 1, "and no Standard call either");
  h.restore();

  // Batch first, then a Standard job over the same cache key.
  const h2 = makeHarness(worker, { clockStart: T0 });
  const batchId2 = sha256Hex("flow-mode-batch-first");
  await postJob(h2, batchId2, [seg("shared-2", "zeta batch-first segment")], { generation_mode: "batch" });
  await h2.drain();
  assert.equal((await getStatus(h2, batchId2)).state, "ready");
  assert.equal(h2.google.calls.batchSubmit, 1);
  const stdId2 = sha256Hex("flow-mode-std-after");
  await postJob(h2, stdId2, [seg("shared-2", "zeta batch-first segment")]);
  await h2.drain();
  assert.equal((await getStatus(h2, stdId2)).state, "ready");
  assert.equal(h2.google.calls.interactions, 0, "Batch-produced audio is reused by Standard");
  h2.restore();
});

test("§5.7b a Batch policy block marks the segment blocked and the job partial — never complete", async () => {
  const h = makeHarness(worker, {
    clockStart: T0,
    fetchBehavior: {
      onBatchPoll: async (name) => {
        if (name !== "batches/op1") return undefined;
        return jsonResponse({
          name, done: true, metadata: { state: "BATCH_STATE_SUCCEEDED" },
          response: {
            inlinedResponses: {
              inlinedResponses: [{
                error: {
                  message: "PROHIBITED_CONTENT: the prompt was blocked by safety filters.",
                  status: "INVALID_ARGUMENT",
                },
              }],
            },
          },
        });
      },
    },
  });
  const jobId = sha256Hex("flow-batch-block");
  const nodes = [seg("bb-1", "eta blocked piece"), seg("bb-2", "eta fine piece")];
  await postJob(h, jobId, nodes, { generation_mode: "batch" });
  await h.drain();
  const status = await getStatus(h, jobId);
  assert.equal(status.state, "partial");
  assert.equal(status.segments[0].state, "blocked");
  assert.equal(status.segments[0].block_reason, "POLICY_BLOCK");
  assert.equal(status.segments[1].state, "ready");
  assert.equal(h.google.calls.batchSubmit, 2, "one submission per segment, no resubmission of the blocked one");
  h.restore();
});
