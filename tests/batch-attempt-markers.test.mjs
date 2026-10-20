// Run: node --test tests/batch-attempt-markers.test.mjs
// Case #4 (§3.4/§7 + Rowan S5): a Batch submission writes the same
// pre-dispatch attempt marker as a Standard call — BEFORE the provider
// POST, with route "batch" — so a rejected submission still counts, and
// geminiQuotaReport's attempted-request totals cover both routes. Batch
// polls write nothing. (Markers count ATTEMPTED requests, not proven
// quota units; the report says so via counting:"attempted_provider_requests".)
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
const attemptMarkers = async (h) => {
  const listed = await h.r2.list({ prefix: "usage/gemini-attempts/" });
  return Promise.all(listed.objects.map((o) => h.r2.readJson(o.key)));
};
const quotaReport = async (h) => (await h.request("/api/quota/gemini")).json();

test("a Batch submission writes a route:'batch' marker BEFORE the provider POST; polls write nothing", async () => {
  let h;
  const seenAtSubmit = [];
  h = makeHarness(worker, {
    clockStart: T0,
    fetchBehavior: {
      onBatchSubmit: async () => {
        // Observed from inside the provider call: the marker must
        // already exist — it is written pre-dispatch.
        const listed = await h.r2.list({ prefix: "usage/gemini-attempts/" });
        seenAtSubmit.push(listed.objects.length);
        return undefined;
      },
    },
  });
  const jobId = sha256Hex("batch-marker-job");
  await postSession(h, sha256Hex("batch-marker-session"), [batchJob(jobId, 0, ["bm-0"])]);
  await h.drain(); // submit + two polls to completion
  assert.equal(h.google.calls.batchSubmit, 1);
  assert.ok(h.google.calls.batchPoll >= 2, "polls happened");
  assert.deepEqual(seenAtSubmit, [1], "marker existed before the submission POST");
  const markers = await attemptMarkers(h);
  assert.equal(markers.length, 1, "polls wrote no markers");
  assert.equal(markers[0].route, "batch");
  assert.equal(markers[0].job_id, jobId);
  assert.equal(markers[0].book_id, "book-test-1");
  assert.equal(markers[0].chapter_index, 0);
  assert.equal(markers[0].segment_index, 0);
  assert.equal(markers[0].provider, "gemini");
  h.restore();
});

test("a rejected Batch submission is still counted, and its daily evidence parks the job + writes the park", async () => {
  const h = makeHarness(worker, {
    clockStart: T0,
    fetchBehavior: { onBatchSubmit: async () => daily429() },
  });
  const jobId = sha256Hex("batch-rejected-job");
  await postSession(h, sha256Hex("batch-rejected-session"), [batchJob(jobId, 0, ["br-0"])]);
  await h.drain();
  const markers = await attemptMarkers(h);
  assert.equal(markers.length, 1, "the rejected submission still counted");
  assert.equal(markers[0].route, "batch");
  const status = await (await h.request(`/api/generation/jobs/${jobId}`)).json();
  assert.equal(status.state, "paused_quota",
    "a Batch 429 with daily evidence parks the job (shared quota pool)");
  const park = await h.r2.readJson("quota/gemini-park.json");
  assert.ok(park, "the Batch 429 wrote the project park");
  assert.equal(park.route, "batch");
  h.restore();
});

test("the quota report's daily attempted total includes Standard + Batch", async () => {
  const h = makeHarness(worker, { clockStart: T0 });
  // One Standard job (one segment) via POST.
  const stdId = sha256Hex("report-standard-job");
  const posted = await h.request("/api/generation/jobs", {
    method: "POST",
    body: {
      job_id: stdId, book_id: "book-test-1", chapter_index: 0,
      generation_release: RELEASE, client_version: CLIENT_VERSION,
      segments: [makeSegment("rs-0")],
    },
  });
  assert.equal(posted.status, 202);
  // One Batch job (one segment) via a Continue session.
  const batchId = sha256Hex("report-batch-job");
  await postSession(h, sha256Hex("report-batch-session"), [batchJob(batchId, 1, ["rb-0"])]);
  await h.drain();
  const report = await quotaReport(h);
  assert.equal(report.used_today, 2, "1 Standard dispatch + 1 Batch submission");
  assert.equal(report.counting, "attempted_provider_requests",
    "S5: the report labels its totals as attempted requests");
  const markers = await attemptMarkers(h);
  assert.deepEqual(markers.map((m) => m.route).sort(), ["batch", "interactions"]);
  h.restore();
});
