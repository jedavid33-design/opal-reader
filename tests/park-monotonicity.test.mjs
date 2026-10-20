// Run: node --test tests/park-monotonicity.test.mjs
// Case #4 (invariant I1): the project park NEVER shortens. Competing
// writers with different retry evidence — including a CAS loser whose
// conditional put lands after a longer park was written — always settle
// on the maximum parked_until.
import test from "node:test";
import assert from "node:assert/strict";
import worker from "../cloudflare-worker.js";
import {
  makeHarness, makeSegment, sha256Hex, jsonResponse, deferred,
  RELEASE, CLIENT_VERSION,
} from "./support/mock-env.mjs";

const T0 = Date.UTC(2026, 9, 20, 15, 0, 0);
const PARK_KEY = "quota/gemini-park.json";
const dailyBody = {
  error: {
    message: "Quota exceeded for quota metric 'GenerateRequestsPerDayPerProjectPerModel' and limit: 100 for project.",
    status: "RESOURCE_EXHAUSTED",
    details: [],
  },
};
const daily429 = () => jsonResponse(dailyBody, 429);
const daily429RetryAfter = (seconds) => new Response(JSON.stringify(dailyBody), {
  status: 429,
  headers: { "Content-Type": "application/json", "Retry-After": String(seconds) },
});

async function postJob(h, jobId, segments) {
  const res = await h.request("/api/generation/jobs", {
    method: "POST",
    body: {
      job_id: jobId, book_id: "book-test-1", chapter_index: 0,
      generation_release: RELEASE, client_version: CLIENT_VERSION, segments,
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

test("competing daily 429s settle on the maximum parked_until; a shorter candidate never shortens it", async () => {
  // Race R1: two jobs dispatch BEFORE either's 429 lands (the only way
  // competing candidates arise — once a park exists, later jobs are
  // gated). A's provider call stalls; B dispatches and 429s with a long
  // Retry-After, writing the longer park; A's 429 then lands with a
  // shorter (day-end) candidate and must yield.
  const fetchGate = deferred();
  let call = 0;
  const h = makeHarness(worker, {
    clockStart: T0,
    fetchBehavior: {
      onInteractions: async () => {
        call++;
        if (call === 1) {
          await fetchGate.promise; // A is in flight, response pending
          return daily429();
        }
        return daily429RetryAfter(86400); // B: strictly longer candidate
      },
    },
  });
  const jobA = sha256Hex("mono-a");
  const jobB = sha256Hex("mono-b");
  const jobC = sha256Hex("mono-c");
  await postJob(h, jobA, [makeSegment("ma-0")]);
  await postJob(h, jobB, [makeSegment("mb-0")]);
  await postJob(h, jobC, [makeSegment("mc-0")]);
  h.queue.pending.sort((a, b) => a.due - b.due);
  const msgA = h.queue.pending.shift();
  const deliveryA = worker.queue(
    { messages: [{ body: msgA.body, attempts: 1, ack() {}, retry() {} }] },
    h.env,
  );
  await new Promise((r) => setTimeout(r, 25)); // A reaches its fetch
  h.clock.advance(8000); // free the pace slot for B
  await deliverOne(h); // B pace-waits or dispatches...
  if (h.google.calls.interactions < 2) await deliverOne(h); // ...deliver the pace retry
  assert.equal(h.google.calls.interactions, 2, "B dispatched while A was in flight");
  const parkB = await h.r2.readJson(PARK_KEY);
  assert.ok(parkB, "B wrote the park");
  assert.equal(parkB.parked_until, h.clock.now + 86400 * 1000,
    "park holds B's longer candidate");
  fetchGate.resolve();
  await deliveryA; // A's shorter candidate now lands — and yields
  const parkAfterA = await h.r2.readJson(PARK_KEY);
  assert.equal(parkAfterA.parked_until, parkB.parked_until,
    "A's shorter candidate never shortened the park");
  // C arrives after the park: gated, zero calls, park untouched.
  await deliverOne(h);
  assert.equal(h.google.calls.interactions, 2, "C spent no call against the park");
  const parkC = await h.r2.readJson(PARK_KEY);
  assert.equal(parkC.parked_until, parkB.parked_until);
  h.restore();
});

test("CAS loser interleaving: a stalled shorter write cannot overwrite a longer park", async () => {
  // Writer A computes its (shorter) candidate and stalls INSIDE its
  // conditional put. Writer B writes a longer park meanwhile. When A's
  // put finally lands, R2 rejects it (etag precondition), A re-reads,
  // sees the stored value dominates, and yields.
  const gate = deferred();
  let armed = true;
  const h = makeHarness(worker, {
    clockStart: T0,
    r2Hooks: {
      onPut: async (key) => {
        if (armed && key === PARK_KEY) {
          armed = false;
          await gate.promise; // writer A stalls inside its park write
        }
      },
    },
    fetchBehavior: {
      onInteractions: async (n) =>
        n === 1 ? daily429() : daily429RetryAfter(86400),
    },
  });
  const jobA = sha256Hex("mono-cas-a");
  const jobB = sha256Hex("mono-cas-b");
  await postJob(h, jobA, [makeSegment("mca-0")]);
  await postJob(h, jobB, [makeSegment("mcb-0")]);
  // Start A's delivery WITHOUT awaiting: it will stall in the park put.
  h.queue.pending.sort((a, b) => a.due - b.due);
  const msgA = h.queue.pending.shift();
  const deliveryA = worker.queue(
    { messages: [{ body: msgA.body, attempts: 1, ack() {}, retry() {} }] },
    h.env,
  );
  // Let A reach the stalled put, then advance past the pace slot and run
  // B's delivery to completion (B writes the longer park).
  await new Promise((r) => setTimeout(r, 25));
  h.clock.advance(8000);
  await deliverOne(h);
  const parkAfterB = await h.r2.readJson(PARK_KEY);
  assert.ok(parkAfterB, "B wrote the park while A was stalled");
  gate.resolve();
  await deliveryA;
  const parkFinal = await h.r2.readJson(PARK_KEY);
  assert.equal(parkFinal.parked_until, parkAfterB.parked_until,
    "A's shorter candidate did not overwrite B's longer park");
  assert.equal(parkFinal.job_id, jobB, "the surviving park is B's write");
  h.restore();
});
