// Run: node --test tests/post-jobs-park-adoption.test.mjs
// Case #4 (§3.3 submission gate): POSTing a job that already exists in
// paused_quota returns it UNCHANGED and enqueues nothing (an automatic
// re-stage can no longer resurrect a parked job); a NEW Gemini job
// submitted during a park is created parked + registered, enqueues
// nothing; an all-cached job still completes for free; a non-Gemini job
// is unaffected by the Gemini park.
import test from "node:test";
import assert from "node:assert/strict";
import worker from "../cloudflare-worker.js";
import {
  makeHarness, makeSegment, sha256Hex, jsonResponse, RELEASE, CLIENT_VERSION,
} from "./support/mock-env.mjs";

const T0 = Date.UTC(2026, 9, 20, 15, 0, 0);
const daily429 = () => jsonResponse({
  error: {
    message: "Quota exceeded for quota metric 'GenerateRequestsPerDayPerProjectPerModel' and limit: 100 for project.",
    status: "RESOURCE_EXHAUSTED",
    details: [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "3600s" }],
  },
}, 429);

async function postJobRaw(h, jobId, segments, extra = {}) {
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

test("existing paused_quota job is adopted unchanged during a park; new Gemini job is created parked; neither enqueues", async () => {
  const h = makeHarness(worker, {
    clockStart: T0,
    fetchBehavior: { onInteractions: async () => daily429() },
  });
  const jobA = sha256Hex("adopt-parked-job");
  const segsA = [makeSegment("ap-0"), makeSegment("ap-1")];
  await postJobRaw(h, jobA, segsA);
  await h.drain(); // A 429s daily and parks itself + the project
  const parked = await h.r2.readJson(`generation/status/${jobA}.json`);
  assert.equal(parked.state, "paused_quota");
  const sentBefore = h.queue.sentLog.length;
  h.clock.advance(10 * 60 * 1000); // well past the stale-heartbeat window

  // Re-POST the same plan (what an automatic re-stage does): adopted
  // unchanged — NOT restarted, NOT re-enqueued, error text untouched.
  const repost = await postJobRaw(h, jobA, segsA);
  assert.equal(repost.status, 200);
  assert.equal(repost.body.state, "paused_quota");
  assert.equal(repost.body.error, parked.error);
  assert.equal(repost.body.completed, parked.completed);
  assert.equal(h.queue.sentLog.length, sentBefore, "nothing re-enqueued");

  // A brand-new Gemini job during the park: created parked, registered,
  // nothing enqueued, no provider call.
  const jobB = sha256Hex("adopt-new-job");
  const created = await postJobRaw(h, jobB, [makeSegment("an-0")]);
  assert.equal(created.status, 202);
  assert.equal(created.body.state, "paused_quota");
  assert.match(created.body.error, /parked until/);
  assert.equal(h.queue.sentLog.length, sentBefore, "nothing enqueued for the parked creation");
  assert.equal(h.google.calls.interactions, 1, "no provider call spent");
  const marker = await h.r2.readJson(`generation/registry/book-test-1/0/${jobB}.json`);
  assert.ok(marker, "the parked creation is registered/discoverable");
  h.restore();
});

test("during a park: an all-cached Gemini job still completes as ready; a non-Gemini job stages normally", async () => {
  const h = makeHarness(worker, {
    clockStart: T0,
    fetchBehavior: { onInteractions: async () => daily429() },
  });
  const jobA = sha256Hex("adopt2-park-maker");
  await postJobRaw(h, jobA, [makeSegment("a2-0")]);
  await h.drain();
  assert.ok(await h.r2.readJson("quota/gemini-park.json"));

  const cachedSeg = makeSegment("a2-cached");
  await h.r2.put(`audio/${cachedSeg.cache_key}.wav`, new Uint8Array([1, 2, 3]));
  const jobC = sha256Hex("adopt2-cached-job");
  const cachedPost = await postJobRaw(h, jobC, [cachedSeg]);
  assert.equal(cachedPost.body.state, "ready", "cache hits are never gated (I7)");

  const jobD = sha256Hex("adopt2-openai-job");
  const openaiSeg = makeSegment("a2-openai", { provider: "openai", model_id: "gpt-4o-mini-tts" });
  const sentBefore = h.queue.sentLog.length;
  const openaiPost = await postJobRaw(h, jobD, [openaiSeg]);
  assert.equal(openaiPost.body.state, "queued", "the Gemini park does not gate other providers");
  assert.equal(h.queue.sentLog.length, sentBefore + 1, "non-Gemini job enqueued normally");
  h.restore();
});
