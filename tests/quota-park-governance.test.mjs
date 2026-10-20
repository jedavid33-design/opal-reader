// Run: node --test tests/quota-park-governance.test.mjs
// Case #4 (§3.3): a daily-scope Gemini 429 writes the project-wide park;
// while it is active, automatic routes spend ZERO provider calls; cached
// segments still finish for free (invariant I7); Batch submissions are
// gated but Batch polls are not.
import test from "node:test";
import assert from "node:assert/strict";
import worker from "../cloudflare-worker.js";
import {
  makeHarness, makeSegment, sha256Hex, jsonResponse, RELEASE, CLIENT_VERSION,
} from "./support/mock-env.mjs";

const T0 = Date.UTC(2026, 9, 20, 15, 0, 0); // Oct 20, 08:00 PDT
const PARK_KEY = "quota/gemini-park.json";
const daily429 = () => jsonResponse({
  error: {
    message: "Quota exceeded for quota metric 'GenerateRequestsPerDayPerProjectPerModel' and limit: 100 for project.",
    status: "RESOURCE_EXHAUSTED",
    details: [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "3600s" }],
  },
}, 429);

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
async function postSession(h, sessionId, jobs) {
  return h.request("/api/generation/continue", {
    method: "POST",
    body: { session_id: sessionId, book_id: "book-test-1", book_title: "T", jobs },
  });
}
function batchJob(jobId, chapterIndex, seeds) {
  return {
    job_id: jobId, book_id: "book-test-1", chapter_index: chapterIndex,
    generation_mode: "batch", generation_release: RELEASE,
    client_version: CLIENT_VERSION, segments: seeds.map((s) => makeSegment(s)),
  };
}

test("a daily 429 writes the project park and parks the job, manual-only", async () => {
  const h = makeHarness(worker, {
    clockStart: T0,
    fetchBehavior: { onInteractions: async () => daily429() },
  });
  const jobId = sha256Hex("park-first-job");
  const posted = await postJob(h, jobId, [makeSegment("pg-0"), makeSegment("pg-1")]);
  assert.equal(posted.status, 202);
  assert.equal(posted.body.state, "queued");
  await h.drain();
  const status = await getStatus(h, jobId);
  assert.equal(status.state, "paused_quota");
  assert.equal(status.next_retry_at, null);
  // Exactly one provider call: the job parked instead of retrying or
  // moving on to burn segment 2 against the same wall.
  assert.equal(h.google.calls.interactions, 1);
  const park = await h.r2.readJson(PARK_KEY);
  assert.ok(park, "park object written");
  assert.equal(park.scope, "daily");
  assert.equal(park.job_id, jobId);
  assert.equal(park.route, "interactions");
  assert.ok(park.parked_until > T0, "park extends into the future");
  assert.deepEqual(park.quota_metrics, ["GenerateRequestsPerDayPerProjectPerModel"]);
  h.restore();
});

test("while parked, other jobs are gated at the consumer with zero provider calls", async () => {
  const h = makeHarness(worker, {
    clockStart: T0,
    fetchBehavior: { onInteractions: async () => daily429() },
  });
  const jobA = sha256Hex("park-gate-a");
  const jobB = sha256Hex("park-gate-b");
  await postJob(h, jobA, [makeSegment("ga-0")]);
  await postJob(h, jobB, [makeSegment("gb-0"), makeSegment("gb-1")]);
  await h.drain();
  // A's delivery hit the daily 429 and wrote the park (1 call). B's
  // deliveries then met the consumer gate: parked, no call spent.
  assert.equal(h.google.calls.interactions, 1);
  const b = await getStatus(h, jobB);
  assert.equal(b.state, "paused_quota");
  assert.match(b.error, /parked until/);
  h.restore();
});

test("cached segments still finish for free during a park (consumer gate sits after cache checks)", async () => {
  const h = makeHarness(worker, {
    clockStart: T0,
    fetchBehavior: { onInteractions: async () => daily429() },
  });
  const jobA = sha256Hex("park-cache-a");
  const jobF = sha256Hex("park-cache-f");
  const segsF = [makeSegment("cf-0"), makeSegment("cf-1")];
  await postJob(h, jobA, [makeSegment("ca-0")]);
  const postedF = await postJob(h, jobF, segsF);
  assert.equal(postedF.body.state, "queued");
  // Audio for both of F's segments lands in the cache AFTER staging
  // (e.g. generated earlier by another path) but before delivery.
  for (const seg of segsF)
    await h.r2.put(`audio/${seg.cache_key}.wav`, new Uint8Array([1, 2, 3]));
  await h.drain();
  assert.equal(h.google.calls.interactions, 1, "only A's 429 call was spent");
  const f = await getStatus(h, jobF);
  assert.equal(f.state, "ready");
  assert.equal(f.completed, 2);
  h.restore();
});

test("Batch submissions are gated during a park; Batch polls are not", async () => {
  // Part 1: a fresh Batch job staged after the park never submits.
  const h = makeHarness(worker, {
    clockStart: T0,
    fetchBehavior: { onInteractions: async () => daily429() },
  });
  const jobA = sha256Hex("park-batch-a");
  await postJob(h, jobA, [makeSegment("ba-0")]);
  await h.drain();
  assert.ok(await h.r2.readJson(PARK_KEY), "park is active");
  const batchId = sha256Hex("park-batch-job");
  await postSession(h, sha256Hex("park-batch-session"), [batchJob(batchId, 1, ["bb-0"])]);
  await h.drain();
  assert.equal(h.google.calls.batchSubmit, 0, "no Batch submission while parked");
  const gated = await getStatus(h, batchId);
  assert.equal(gated.state, "paused_quota");
  h.restore();

  // Part 2: a Batch job submitted BEFORE the park keeps polling during
  // the park — a poll spends no generation quota and can only deliver
  // already-paid audio.
  const h2 = makeHarness(worker, {
    clockStart: T0,
    fetchBehavior: { onInteractions: async () => daily429() },
  });
  const batchId2 = sha256Hex("park-batch-job-2");
  await postSession(h2, sha256Hex("park-batch-session-2"), [batchJob(batchId2, 0, ["bb2-0"])]);
  await h2.deliverDue(); // submission delivery only; poll is due in 60s
  assert.equal(h2.google.calls.batchSubmit, 1);
  const jobA2 = sha256Hex("park-batch-a2");
  await postJob(h2, jobA2, [makeSegment("ba2-0")]);
  await h2.deliverDue(); // A's delivery 429s and writes the park
  assert.ok(await h2.r2.readJson(PARK_KEY), "park is active");
  h2.clock.advance(61_000);
  await h2.deliverDue(); // the Batch poll runs despite the park
  assert.equal(h2.google.calls.batchSubmit, 1, "still no second submission");
  assert.ok(h2.google.calls.batchPoll >= 1, "poll was not gated");
  h2.clock.advance(61_000);
  await h2.deliverDue(); // second poll: Batch succeeded, audio delivered
  const done = await getStatus(h2, batchId2);
  assert.equal(done.state, "ready");
  assert.equal(done.completed, 1);
  h2.restore();
});
