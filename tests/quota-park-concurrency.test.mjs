// Run: node --test tests/quota-park-concurrency.test.mjs
// Case #4 + Rowan S4: the concurrency bound, stated and tested honestly.
// Per-job leases + the monotone CAS park + the pace reservation do NOT
// serialize project-wide dispatch (the pace lease is released before the
// provider fetch). The guarantee is: no NEW automatic dispatch after its
// gate observes the active park, and no unbounded retry loop — worst
// case, one already-in-flight dispatch per concurrent job across routes.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import worker from "../cloudflare-worker.js";
import {
  makeHarness, makeSegment, sha256Hex, jsonResponse, deferred,
  RELEASE, CLIENT_VERSION,
} from "./support/mock-env.mjs";

const workerSrc = readFileSync(new URL("../cloudflare-worker.js", import.meta.url), "utf8");
const T0 = Date.UTC(2026, 9, 20, 15, 0, 0);
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
  return res.json();
}
async function deliverOne(h) {
  h.queue.pending.sort((a, b) => a.due - b.due);
  const msg = h.queue.pending.shift();
  assert.ok(msg, "a queue message is pending");
  if (msg.due > h.clock.now) h.clock.set(msg.due);
  await worker.queue(
    { messages: [{ body: msg.body, attempts: 1, ack() {}, retry() {} }] },
    h.env,
  );
}

test("simultaneous cross-route sends + a park landing: in-flight calls finish, nothing new dispatches", async () => {
  // Job A (Queue/Standard) and job B (Queue/Standard, other chapter)
  // dispatch concurrently; the direct speech route fires too. A's call
  // stalls in flight; B completes (a success — the audio is real and
  // kept); a direct speech call also completes. THEN A's 429 lands and
  // writes the park. From that moment: job C (queued) and a fresh
  // direct call are both refused by their gates — zero further spend.
  const fetchGate = deferred();
  let call = 0;
  const h = makeHarness(worker, {
    clockStart: T0,
    fetchBehavior: {
      onInteractions: async () => {
        call++;
        if (call === 1) {
          await fetchGate.promise; // A stays in flight
          return daily429();
        }
        return undefined; // everyone else succeeds
      },
    },
  });
  const jobA = sha256Hex("conc-a");
  const jobB = sha256Hex("conc-b");
  const jobC = sha256Hex("conc-c");
  await postJob(h, jobA, [makeSegment("ca-0")]);
  await postJob(h, jobB, [makeSegment("cb-0")]);
  await postJob(h, jobC, [makeSegment("cc-0")]);

  h.queue.pending.sort((a, b) => a.due - b.due);
  const msgA = h.queue.pending.shift();
  const deliveryA = worker.queue(
    { messages: [{ body: msgA.body, attempts: 1, ack() {}, retry() {} }] },
    h.env,
  );
  await new Promise((r) => setTimeout(r, 25)); // A is in flight
  h.clock.advance(8000);
  await deliverOne(h); // B (pace-wait first if needed)
  if (h.google.calls.interactions < 2) await deliverOne(h);
  assert.equal(h.google.calls.interactions, 2, "B dispatched while A was in flight (not serialized)");

  // A direct speech call in the same window: also in flight class —
  // completes normally because no park exists yet.
  const direct = await h.request("/api/providers/gemini/speech", {
    method: "POST",
    body: {
      text: "Direct segment.", voice_id: "Algieba",
      model_id: "gemini-3.8-flash-tts", cache_key: sha256Hex("conc-direct"),
      usage_type: "book_audition",
    },
  });
  assert.equal(direct.status, 200);
  assert.equal(h.google.calls.interactions, 3);

  // A's 429 finally lands: the park is written now.
  fetchGate.resolve();
  await deliveryA;
  const park = await h.r2.readJson("quota/gemini-park.json");
  assert.ok(park, "A's late 429 wrote the park");
  const bStatus = await (await h.request(`/api/generation/jobs/${jobB}`)).json();
  assert.equal(bStatus.state, "ready", "B's in-flight success was kept (audio is real)");

  // Everything after the park is gated — Queue job C and direct alike.
  await deliverOne(h); // C's delivery
  assert.equal(h.google.calls.interactions, 3, "no new dispatch after the gate observed the park");
  const cStatus = await (await h.request(`/api/generation/jobs/${jobC}`)).json();
  assert.equal(cStatus.state, "paused_quota");
  const direct2 = await h.request("/api/providers/gemini/speech", {
    method: "POST",
    body: {
      text: "Direct segment two.", voice_id: "Algieba",
      model_id: "gemini-3.8-flash-tts", cache_key: sha256Hex("conc-direct-2"),
      usage_type: "book_audition",
    },
  });
  assert.equal(direct2.status, 429, "direct route gated too");
  assert.equal(h.google.calls.interactions, 3, "still no spend");
  h.restore();
});

test("the code states the bound honestly (S4): the pace reservation does not claim to serialize dispatch", () => {
  const paceIdx = workerSrc.indexOf("async function reserveGeminiQueuePace");
  assert.ok(paceIdx > 0);
  const note = workerSrc.slice(Math.max(0, paceIdx - 1200), paceIdx);
  assert.match(note, /does not serialize|does NOT serialize|NOT serialize/);
  assert.match(note, /in flight|in-flight/);
  const parkIdx = workerSrc.indexOf("async function recordGeminiQuotaPark");
  const parkNote = workerSrc.slice(Math.max(0, parkIdx - 1600), parkIdx);
  assert.match(parkNote, /no NEW automatic dispatch after its gate observes/);
});
