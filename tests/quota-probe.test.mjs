// Run: node --test tests/quota-probe.test.mjs
// Case #4 (§6 + Rowan S5): Resume during an active park issues a ONE-SHOT
// probe token — exactly one provider call, then the job re-parks (a
// successful test call does NOT lift the park or drain the job). A probe
// that meets a 429 re-parks with the park extended. Resume after the park
// expires is the original full resume.
import test from "node:test";
import assert from "node:assert/strict";
import worker from "../cloudflare-worker.js";
import {
  makeHarness, makeSegment, sha256Hex, jsonResponse, RELEASE, CLIENT_VERSION,
} from "./support/mock-env.mjs";

const T0 = Date.UTC(2026, 9, 20, 15, 0, 0);
const PARK_KEY = "quota/gemini-park.json";
const daily429 = (retryDelay = "3600s") => jsonResponse({
  error: {
    message: "Quota exceeded for quota metric 'GenerateRequestsPerDayPerProjectPerModel' and limit: 100 for project.",
    status: "RESOURCE_EXHAUSTED",
    details: [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay }],
  },
}, 429);
// A daily 429 whose Retry-After header (the value gemini429Cooldown
// actually consumes) reaches beyond the Pacific day end.
const daily429Long = () => new Response(JSON.stringify({
  error: {
    message: "Quota exceeded for quota metric 'GenerateRequestsPerDayPerProjectPerModel' and limit: 100 for project.",
    status: "RESOURCE_EXHAUSTED",
    details: [],
  },
}), { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "86400" } });

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
const resume = async (h, jobId) =>
  (await h.request(`/api/generation/jobs/${jobId}/resume`, { method: "POST", body: {} })).json();

test("probe success re-parks; probe 429 extends the park; expired park resumes fully", async () => {
  // One harness whose provider behavior flips by phase via call counting:
  // call 1 = park-maker 429; later calls controlled by `phase`.
  let phase = "success";
  const h = makeHarness(worker, {
    clockStart: T0,
    fetchBehavior: {
      onInteractions: async (n) => {
        if (n === 1) return daily429();
        if (phase === "429") return daily429Long();
        return undefined; // default success
      },
    },
  });
  const jobA = sha256Hex("probe2-park-maker");
  const jobB = sha256Hex("probe2-parked-job");
  await postJob(h, jobA, [makeSegment("p2a-0")]);
  await h.drain();
  const park0 = await h.r2.readJson(PARK_KEY);
  assert.ok(park0);
  const postedB = await postJob(h, jobB,
    [makeSegment("p2b-0"), makeSegment("p2b-1"), makeSegment("p2b-2")]);
  assert.equal(postedB.body.state, "paused_quota");

  // --- Probe #1: provider succeeds -> ONE call, audio saved, re-park. ---
  const r1 = await resume(h, jobB);
  assert.equal(r1.resumed, true);
  assert.equal(r1.probe, true, "resume during a park is a probe, not a full resume");
  assert.equal(r1.status.state, "queued");
  assert.ok(r1.status.quota_probe, "probe token stamped on the status");
  await h.drain();
  assert.equal(h.google.calls.interactions, 2, "park-maker call + exactly one probe call");
  let b = await getStatus(h, jobB);
  assert.equal(b.state, "paused_quota", "job re-parked after one successful test call");
  assert.equal(b.completed, 1, "the probe's audio was saved");
  assert.match(b.error, /Test call worked, but the daily limit is still parked/);
  assert.equal(b.quota_probe, undefined, "token consumed");
  const park1 = await h.r2.readJson(PARK_KEY);
  assert.equal(park1.parked_until, park0.parked_until, "a successful probe does NOT lift the park (S5)");

  // --- Probe #2: provider 429s with a longer retry -> park extends. ---
  phase = "429";
  const r2 = await resume(h, jobB);
  assert.equal(r2.probe, true);
  await h.drain();
  assert.equal(h.google.calls.interactions, 3, "exactly one more call");
  b = await getStatus(h, jobB);
  assert.equal(b.state, "paused_quota");
  const park2 = await h.r2.readJson(PARK_KEY);
  assert.ok(park2.parked_until > park1.parked_until, "park extended monotonically from the new evidence");

  // --- After expiry: resume is a full resume and the job drains. ---
  phase = "success";
  h.clock.set(park2.parked_until + 1000);
  const r3 = await resume(h, jobB);
  assert.equal(r3.resumed, true);
  assert.equal(r3.probe, undefined, "no probe once the park has expired");
  await h.drain();
  b = await getStatus(h, jobB);
  assert.equal(b.state, "ready");
  assert.equal(b.completed, 3);
  assert.equal(h.google.calls.interactions, 5, "the remaining two segments drained normally");
  h.restore();
});

test("two Resume taps mint only one probe (per-job lease + state check)", async () => {
  const h = makeHarness(worker, {
    clockStart: T0,
    fetchBehavior: { onInteractions: async (n) => (n === 1 ? daily429() : undefined) },
  });
  const jobA = sha256Hex("probe3-park-maker");
  const jobB = sha256Hex("probe3-parked-job");
  await postJob(h, jobA, [makeSegment("p3a-0")]);
  await h.drain();
  await postJob(h, jobB, [makeSegment("p3b-0"), makeSegment("p3b-1")]);
  const first = await resume(h, jobB);
  assert.equal(first.probe, true);
  const second = await resume(h, jobB);
  assert.equal(second.resumed, false, "job is no longer paused_quota — no second token");
  const sentForB = h.queue.sentLog.filter((m) => m.body.job_id === jobB);
  assert.equal(sentForB.length, 1, "exactly one delivery enqueued");
  await h.drain();
  assert.equal(h.google.calls.interactions, 2, "park-maker + the single probe call");
  const b = await getStatus(h, jobB);
  assert.equal(b.state, "paused_quota");
  assert.equal(b.completed, 1);
  h.restore();
});
