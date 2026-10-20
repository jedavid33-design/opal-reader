// KV write coalescing (design v2.1) — full-stack tests driving the real
// worker module against mock KV/R2/Queue stores with a virtual clock,
// fault injection, and async gates for ordering control.
import test from "node:test";
import assert from "node:assert/strict";
import worker from "../cloudflare-worker.js";
import {
  makeHarness,
  makeSegment,
  sha256Hex,
  RELEASE,
  CLIENT_VERSION,
  jsonResponse,
  deferred,
} from "./support/mock-env.mjs";

const T0 = Date.UTC(2026, 9, 19, 18, 0, 0); // 11:00 PDT
const statusKey = (id) => `generation/status/${id}.json`;
const metaKey = (id) => `generation/mirror-meta/${id}.json`;
const kvKey = (id) => `generation:${id}`;

async function postJob(h, jobId, segments, extra = {}) {
  return h.request("/api/generation/jobs", {
    method: "POST",
    body: {
      job_id: jobId,
      book_id: "book-test-1",
      chapter_index: 0,
      generation_release: RELEASE,
      client_version: CLIENT_VERSION,
      segments,
      ...extra,
    },
  });
}

async function postSession(h, sessionId, jobs) {
  return h.request("/api/generation/continue", {
    method: "POST",
    body: { session_id: sessionId, book_id: "book-test-1", book_title: "T", jobs },
  });
}

function batchJob(jobId, chapterIndex, seeds) {
  return {
    job_id: jobId,
    book_id: "book-test-1",
    chapter_index: chapterIndex,
    generation_mode: "batch",
    generation_release: RELEASE,
    client_version: CLIENT_VERSION,
    segments: seeds.map((s) => makeSegment(s)),
  };
}

async function getStatus(h, jobId) {
  const res = await h.request(`/api/generation/jobs/${jobId}`);
  return { status: res.status, body: await res.json() };
}

// Deliver queued messages one at a time (advancing the clock to each due
// time) until the predicate holds or the budget runs out.
async function deliverUntil(h, predicate, budget = 300) {
  for (let i = 0; i < budget; i++) {
    if (await predicate()) return true;
    if (!h.queue.pending.length) return false;
    h.queue.pending.sort((a, b) => a.due - b.due);
    const msg = h.queue.pending.shift();
    if (msg.due > h.clock.now) h.clock.set(msg.due);
    await worker.queue(
      { messages: [{ body: msg.body, attempts: 1, ack() {}, retry() {} }] },
      h.env,
    );
  }
  return predicate();
}

async function spinUntil(fn, budget = 2000) {
  for (let i = 0; i < budget; i++) {
    if (fn()) return true;
    await new Promise((r) => setImmediate(r));
  }
  return fn();
}

test("standard generation coalesces KV writes: creation, volume catch-up, terminal only", async () => {
  const h = makeHarness(worker, { clockStart: T0 });
  const jobId = sha256Hex("coalesce-standard-job");
  const segments = Array.from({ length: 30 }, (_, i) =>
    makeSegment(`coal-std-${i}`),
  );
  const res = await postJob(h, jobId, segments);
  assert.equal(res.status, 202);
  await h.drain();
  const status = await h.r2.readJson(statusKey(jobId));
  assert.equal(status.state, "ready");
  assert.equal(status.completed, 30);
  assert.equal(h.google.calls.interactions, 30);
  // 30 segments x ~4 saves each would have been ~120 KV puts before the
  // patch (plus 30 attempt keys + 30 last-success puts). Coalesced:
  // creation + one >=25-segment volume catch-up + terminal.
  const puts = h.kv.putCount("generation:");
  assert.ok(puts <= 4, `expected <=4 generation KV puts, got ${puts}`);
  assert.equal(h.kv.putCount("quota:"), 0);
  // The KV mirror converged to the exact final R2 status.
  assert.equal(
    await h.kv.get(kvKey(jobId)),
    JSON.stringify(status),
  );
  const meta = await h.r2.readJson(metaKey(jobId));
  assert.equal(meta.confirmed.state, "ready");
  assert.equal(meta.confirmed.version, status._statusVersion);
  h.restore();
});

test("interrupted generation resumes from R2 state and completes", async () => {
  const h = makeHarness(worker, { clockStart: T0 });
  const jobId = sha256Hex("interrupted-job");
  await postJob(
    h,
    jobId,
    Array.from({ length: 6 }, (_, i) => makeSegment(`int-${i}`)),
  );
  // Process only part of the job, then "crash" (stop delivering).
  await deliverUntil(
    h,
    async () => (await h.r2.readJson(statusKey(jobId)))?.completed >= 3,
  );
  const mid = await h.r2.readJson(statusKey(jobId));
  assert.equal(mid.completed, 3);
  assert.ok(["queued", "generating"].includes(mid.state));
  // Resume: the remaining queue messages finish the job from R2 state.
  await h.drain();
  const status = await h.r2.readJson(statusKey(jobId));
  assert.equal(status.state, "ready");
  assert.equal(status.completed, 6);
  assert.equal(h.google.calls.interactions, 6);
  h.restore();
});

test("duplicate Queue deliveries synthesize each segment once", async () => {
  const h = makeHarness(worker, { clockStart: T0 });
  const jobId = sha256Hex("duplicate-job");
  await postJob(
    h,
    jobId,
    [0, 1].map((i) => makeSegment(`dup-${i}`)),
  );
  const first = h.queue.pending[0];
  assert.ok(first, "expected an initial queue message");
  const deliver = (body) =>
    worker.queue(
      { messages: [{ body, attempts: 1, ack() {}, retry() {} }] },
      h.env,
    );
  await deliver(first.body);
  await deliver(first.body); // exact duplicate delivery
  await h.drain();
  const status = await h.r2.readJson(statusKey(jobId));
  assert.equal(status.state, "ready");
  assert.equal(status.completed, 2);
  assert.equal(h.google.calls.interactions, 2);
  h.restore();
});

test("Batch recovery: op assigned, restart, completes without resubmission; assignment mirrored", async () => {
  const h = makeHarness(worker, { clockStart: T0 });
  const jobId = sha256Hex("batch-recovery-job");
  const sessionId = sha256Hex("batch-recovery-session");
  const res = await postSession(h, sessionId, [batchJob(jobId, 0, ["br-0", "br-1"])]);
  assert.equal(res.status, 202);
  // Drive until the first Batch op is assigned in the authoritative store.
  await deliverUntil(
    h,
    async () =>
      Boolean(
        (await h.r2.readJson(statusKey(jobId)))?.segments?.[0]?.batch_job_name,
      ),
  );
  assert.equal(h.google.calls.batchSubmit, 1);
  // The assignment was mirrored to KV (critical transition).
  const mirrored = await h.kv.get(kvKey(jobId), "json");
  assert.ok(mirrored.segments[0].batch_job_name, "op assignment must be mirrored");
  // Simulate a Worker restart: a long gap, state only in the stores.
  h.clock.advance(30 * 60 * 1000);
  await h.drain();
  const status = await h.r2.readJson(statusKey(jobId));
  assert.equal(status.state, "ready");
  assert.equal(status.completed, 2);
  // Exactly one submission per segment — recovery polled, never resubmitted.
  assert.equal(h.google.calls.batchSubmit, 2);
  h.restore();
});

test("adaptive splits activate children, mirror the split, and complete", async () => {
  const h = makeHarness(worker, {
    clockStart: T0,
    fetchBehavior: {
      onInteractions: async (_n, init) => {
        const body = JSON.parse(init.body);
        const text = body.input?.[0]?.content?.[0]?.text || "";
        if (text.includes("BLOCKME"))
          return jsonResponse(
            { error: { message: "Request blocked due to policy reasons." } },
            400,
          );
        return undefined;
      },
    },
  });
  const jobId = sha256Hex("adaptive-job");
  // Adaptive payload shape: every part carries the SOURCE segment's
  // index (segment_index === repair_source_index); parts are told apart
  // by array position, repair_parent (an array index), and repair_path.
  const seg = (i, parent, path, text) => ({
    segment_index: 0,
    repair_source_index: 0,
    repair_parent: parent,
    repair_path: path,
    cache_key: sha256Hex(`adaptive-cache-${i}`),
    text,
    voice_id: "Algieba",
    provider: "gemini",
    model_id: "gemini-3.8-flash-tts",
    usage_type: "book_generation",
  });
  const res = await postJob(h, jobId, [
    seg(0, -1, "", "BLOCKME root passage."),
    seg(1, 0, "L", "BLOCKME left child."),
    seg(2, 0, "R", "Right child passage."),
    seg(3, 1, "LL", "Left left passage."),
    seg(4, 1, "LR", "Left right passage."),
  ], {
    adaptive_repair: true,
    diagnostic_job_kind: "adaptive_repair",
    adaptive_source_mode: "full",
  });
  assert.equal(res.status, 202);
  await h.drain();
  const status = await h.r2.readJson(statusKey(jobId));
  assert.equal(status.state, "ready");
  const splits = status.segments.filter((s) => s.state === "split");
  assert.equal(splits.length, 2, "root and left child should be split");
  const meta = await h.r2.readJson(metaKey(jobId));
  assert.equal(meta.confirmed.state, "ready");
  assert.ok(
    meta.confirmed.split_count >= 1,
    "a confirmed mirror must have observed the split",
  );
  h.restore();
});

test("KV quota exhaustion: generation completes on R2; mirror catches up after recovery", async () => {
  let kvDown = true;
  const h = makeHarness(worker, {
    clockStart: T0,
    kvHooks: {
      onPut: async (key) => {
        if (kvDown && key.startsWith("generation:"))
          throw new Error("KV put() limit exceeded for the day.");
      },
    },
  });
  const jobId = sha256Hex("kv-exhausted-job");
  const res = await postJob(
    h,
    jobId,
    [0, 1, 2].map((i) => makeSegment(`kve-${i}`)),
  );
  assert.equal(res.status, 202, "staging must not fail when KV is down");
  await h.drain();
  const status = await h.r2.readJson(statusKey(jobId));
  assert.equal(status.state, "ready");
  assert.equal(status.completed, 3);
  assert.equal(h.google.calls.interactions, 3);
  assert.equal(await h.kv.get(kvKey(jobId)), null, "no KV mirror while down");
  // KV recovers: after the bounded attempt floor, the next status poll
  // catches the mirror up.
  kvDown = false;
  h.clock.advance(61_000);
  const poll = await getStatus(h, jobId);
  assert.equal(poll.status, 200);
  assert.equal(await h.kv.get(kvKey(jobId)), JSON.stringify(status));
  const meta = await h.r2.readJson(metaKey(jobId));
  assert.equal(meta.confirmed.state, "ready");
  h.restore();
});

test("R2 write failure surfaces the error and leaves no ghost KV progress", async () => {
  const jobId = sha256Hex("r2-failure-job");
  const h = makeHarness(worker, {
    clockStart: T0,
    r2Hooks: {
      onPut: async (key) => {
        if (key === statusKey(jobId)) throw new Error("R2 unavailable");
      },
    },
  });
  const res = await postJob(
    h,
    jobId,
    [0].map((i) => makeSegment(`r2f-${i}`)),
  );
  assert.ok(res.status >= 500, `expected 5xx, got ${res.status}`);
  assert.equal(
    h.kv.putCount("generation:"),
    0,
    "KV must never be written when the authoritative R2 save failed",
  );
  assert.equal(await h.kv.get(kvKey(jobId)), null);
  // No ghost progress: the authoritative status object was never
  // written, and the API honestly reports the staging as incomplete
  // rather than inventing a job state.
  assert.equal(await h.r2.readJson(statusKey(jobId)), null);
  const poll = await getStatus(h, jobId);
  assert.equal(poll.status, 200);
  assert.equal(poll.body.state, "staging_incomplete");
  h.restore();
});

test("catch-up safety (a): KV down + 100 polls in a minute makes at most one mirror attempt", async () => {
  let kvDown = false;
  const h = makeHarness(worker, {
    clockStart: T0,
    kvHooks: {
      onPut: async (key) => {
        if (kvDown && key.startsWith("generation:"))
          throw new Error("KV put() limit exceeded for the day.");
      },
    },
  });
  const jobId = sha256Hex("catchup-flood-job");
  await postJob(h, jobId, [makeSegment("flood-0")]);
  await h.drain();
  const status = await h.r2.readJson(statusKey(jobId));
  assert.equal(status.state, "ready");
  // Simulate mirror loss, then a KV outage during the poll flood. The
  // clock first moves past the last attempt, so the flood's first poll
  // is floor-eligible; the remaining 99 must be suppressed.
  h.kv.store.delete(kvKey(jobId));
  h.clock.advance(61_000);
  kvDown = true;
  const putsBefore = h.kv.putCount("generation:");
  for (let i = 0; i < 100; i++) {
    const poll = await getStatus(h, jobId);
    assert.equal(poll.status, 200, "reads keep working while KV is down");
    assert.equal(poll.body.state, "ready");
  }
  const attempts = h.kv.putCount("generation:") - putsBefore;
  assert.equal(attempts, 1, `expected exactly 1 bounded attempt, got ${attempts}`);
  // After the floor and KV recovery, one poll restores the mirror.
  h.clock.advance(61_000);
  kvDown = false;
  await getStatus(h, jobId);
  assert.equal(await h.kv.get(kvKey(jobId)), JSON.stringify(status));
  h.restore();
});

test("catch-up safety (b)+(c): stalled writer is fenced; successor's stamps stand; KV converges to newest", async () => {
  let kvDown = false;
  let gate = null;
  let gateArmed = false;
  const h = makeHarness(worker, {
    clockStart: T0,
    kvHooks: {
      onPut: async (key) => {
        if (!key.startsWith("generation:")) return;
        if (kvDown) throw new Error("KV put() limit exceeded for the day.");
        if (gateArmed) {
          gateArmed = false;
          await gate.promise; // writer A stalls inside its KV put
        }
      },
    },
  });
  const jobId = sha256Hex("catchup-reversed-job");
  const sessionId = sha256Hex("catchup-reversed-session");
  await postSession(h, sessionId, [batchJob(jobId, 0, ["rev-0", "rev-1"])]);
  // Outage: the first op assignment lands in R2 only.
  kvDown = true;
  await deliverUntil(
    h,
    async () =>
      Boolean(
        (await h.r2.readJson(statusKey(jobId)))?.segments?.[0]?.batch_job_name,
      ),
  );
  const midStatus = await h.r2.readJson(statusKey(jobId));
  assert.ok(midStatus.segments[0].batch_job_name);
  h.clock.advance(61_000);
  kvDown = false;
  // Attempt A (read-path catch-up) stalls inside its KV put.
  gate = deferred();
  gateArmed = true;
  const pollA = getStatus(h, jobId);
  assert.ok(await spinUntil(() => !gateArmed), "writer A never reached its KV put");
  // Generation runs to the terminal state in R2 while A is stalled; its
  // own mirror attempts find A's fresh lock and stay out of the way.
  await h.drain();
  const termStatus = await h.r2.readJson(statusKey(jobId));
  assert.equal(termStatus.state, "ready");
  // Successor B (another poll) steals the expired lock and mirrors the
  // terminal status.
  const pollB = await getStatus(h, jobId);
  assert.equal(pollB.status, 200);
  const metaAfterB = await h.r2.readJson(metaKey(jobId));
  assert.equal(metaAfterB.confirmed.version, termStatus._statusVersion);
  assert.equal(
    (await h.kv.get(kvKey(jobId), "json"))._statusVersion,
    termStatus._statusVersion,
  );
  // A resumes and lands its stale snapshot — but it is fenced out of the
  // bookkeeping: the successor's confirmed stamps stand.
  gate.resolve();
  await pollA;
  const metaAfterA = await h.r2.readJson(metaKey(jobId));
  assert.equal(metaAfterA.confirmed.version, termStatus._statusVersion);
  assert.equal(
    (await h.kv.get(kvKey(jobId), "json"))._statusVersion,
    midStatus._statusVersion,
    "the stale write is transiently visible but never confirmed",
  );
  // The next eligible catch-up converges KV to the newest R2 version.
  h.clock.advance(61_000);
  await getStatus(h, jobId);
  assert.equal(
    await h.kv.get(kvKey(jobId)),
    JSON.stringify(await h.r2.readJson(statusKey(jobId))),
  );
  h.restore();
});

test("catch-up safety (c): writer stalled before its fence check writes nothing after a steal", async () => {
  let gate = null;
  let gateArmed = false;
  const jobId = sha256Hex("catchup-fenced-job");
  const h = makeHarness(worker, {
    clockStart: T0,
    r2Hooks: {
      onPut: async (key) => {
        // Stall writer A on its mirror-meta claim write: it holds the
        // lock but has not yet evaluated or written anything.
        if (gateArmed && key === metaKey(jobId)) {
          gateArmed = false;
          await gate.promise;
        }
      },
    },
  });
  const sessionId = sha256Hex("catchup-fenced-session");
  await postSession(h, sessionId, [batchJob(jobId, 0, ["fen-0", "fen-1"])]);
  // Drive the first op assignment; its mirror attempt A stalls on claim.
  gate = deferred();
  gateArmed = true;
  const delivery = (async () => {
    h.queue.pending.sort((a, b) => a.due - b.due);
    const msg = h.queue.pending.shift();
    await worker.queue(
      { messages: [{ body: msg.body, attempts: 1, ack() {}, retry() {} }] },
      h.env,
    );
  })();
  assert.ok(await spinUntil(() => !gateArmed), "writer A never reached its claim");
  // Successor B steals the expired lock via a status poll and mirrors.
  h.clock.advance(21_000);
  const pollB = await getStatus(h, jobId);
  assert.equal(pollB.status, 200);
  const kvAfterB = await h.kv.get(kvKey(jobId));
  const metaAfterB = await h.r2.readJson(metaKey(jobId));
  assert.ok(
    JSON.parse(kvAfterB).segments[0].batch_job_name,
    "successor mirrored the op assignment",
  );
  // A resumes: fenced — it must write nothing at all.
  const kvPutsBefore = h.kv.putCalls.length;
  gate.resolve();
  await delivery;
  assert.equal(h.kv.putCalls.length, kvPutsBefore, "stale writer wrote to KV");
  assert.equal(await h.kv.get(kvKey(jobId)), kvAfterB);
  const metaAfterA = await h.r2.readJson(metaKey(jobId));
  assert.equal(
    metaAfterA.confirmed.version,
    metaAfterB.confirmed.version,
    "successor's confirmed stamps survive the stale writer's resume",
  );
  // Bookkeeping self-heals: a later poll re-confirms cleanly.
  h.clock.advance(61_000);
  await getStatus(h, jobId);
  const metaFinal = await h.r2.readJson(metaKey(jobId));
  const status = await h.r2.readJson(statusKey(jobId));
  assert.equal(metaFinal.confirmed.version, status._statusVersion);
  h.restore();
});

test("catch-up safety (d): stamp persistence racing a concurrent watchdog save keeps both", async () => {
  let gate = null;
  let gateHit = null;
  let armed = false;
  let metaPutsAfterArm = 0;
  const jobId = sha256Hex("catchup-race-job");
  const h = makeHarness(worker, {
    clockStart: T0,
    r2Hooks: {
      onPut: async (key) => {
        if (!armed || key !== metaKey(jobId)) return;
        metaPutsAfterArm++;
        if (metaPutsAfterArm === 2) {
          // The mirror writer is persisting its confirmed stamps.
          gateHit.resolve();
          await gate.promise;
        }
      },
    },
  });
  const sessionId = sha256Hex("catchup-race-session");
  await postSession(h, sessionId, [batchJob(jobId, 0, ["race-0", "race-1"])]);
  // First op assigned and mirrored normally.
  await deliverUntil(
    h,
    async () =>
      Boolean(
        (await h.r2.readJson(statusKey(jobId)))?.segments?.[0]?.batch_job_name,
      ),
  );
  // Complete segment 0, then arm the gate for the SECOND op assignment's
  // mirror (claim write = meta put 1, confirm write = meta put 2).
  await deliverUntil(
    h,
    async () =>
      (await h.r2.readJson(statusKey(jobId)))?.segments?.[0]?.state === "ready",
  );
  gate = deferred();
  gateHit = deferred();
  armed = true;
  const delivery = (async () => {
    await deliverUntil(
      h,
      async () =>
        Boolean(
          (await h.r2.readJson(statusKey(jobId)))?.segments?.[1]?.batch_job_name,
        ),
      50,
    );
  })();
  assert.ok(await spinUntil(() => gateHit.promise && metaPutsAfterArm >= 2),
    "mirror writer never reached its confirm write");
  // Concurrent generation save: the poll-time watchdog bumps the status
  // (new version + updated_at) while the stamps are mid-persist.
  const beforeWatchdog = await h.r2.readJson(statusKey(jobId));
  h.clock.advance(6 * 60 * 1000);
  const poll = await getStatus(h, jobId);
  assert.equal(poll.status, 200);
  const afterWatchdog = await h.r2.readJson(statusKey(jobId));
  assert.ok(
    afterWatchdog._statusVersion > beforeWatchdog._statusVersion,
    "watchdog save landed during stamp persistence",
  );
  // Release the stamps: both writes survive — progress in the status
  // object, stamps in the separate meta object.
  gate.resolve();
  await delivery;
  const status = await h.r2.readJson(statusKey(jobId));
  assert.equal(status._statusVersion, afterWatchdog._statusVersion);
  assert.ok(!("confirmed" in status) && !("attempt_at" in status),
    "mirror bookkeeping must never live inside the status object");
  const meta = await h.r2.readJson(metaKey(jobId));
  assert.ok(
    meta.confirmed.batch_names.some((n) =>
      n === beforeWatchdog.segments[1].batch_job_name,
    ),
    "confirmed stamps recorded the second op assignment",
  );
  await h.drain();
  const final = await h.r2.readJson(statusKey(jobId));
  assert.equal(final.state, "ready");
  assert.equal(await h.kv.get(kvKey(jobId)), JSON.stringify(final));
  h.restore();
});

// --- Gemini quota accounting (design v2.1 accounting matrix) ----------

async function quotaReport(h) {
  const res = await h.request("/api/quota/gemini");
  assert.equal(res.status, 200);
  return res.json();
}

async function usageEvents(h) {
  const page = await h.r2.list({ prefix: "usage/events/", limit: 1000 });
  return Promise.all(page.objects.map((o) => h.r2.readJson(o.key)));
}

test("quota: standard success counts one attempt and sets last-success from the ledger", async () => {
  const h = makeHarness(worker, { clockStart: T0 });
  const jobId = sha256Hex("quota-std-success");
  await postJob(h, jobId, [makeSegment("qs-0")]);
  await h.drain();
  const report = await quotaReport(h);
  assert.equal(report.tracking_available, true);
  assert.equal(report.used_today, 1);
  assert.equal(report.used_calendar_day, 1);
  assert.equal(report.used_24h, 1);
  assert.ok(report.last_success_ms >= T0);
  assert.ok(report.last_request_ms >= T0);
  assert.equal(h.kv.putCount("quota:"), 0, "no KV quota writes remain");
  const markers = await h.r2.list({ prefix: "usage/gemini-attempts/" });
  assert.equal(markers.objects.length, 1);
  const pointer = await h.r2.readJson("usage/gemini-last-success.json");
  assert.equal(pointer.timestamp, report.last_success_ms);
  // The usage report derives last-success from events and never writes KV.
  const putsBefore = h.kv.putCalls.length;
  const usageRes = await h.request("/api/usage/report");
  const usage = await usageRes.json();
  assert.ok(usage.last_success_ms >= T0);
  assert.equal(h.kv.putCalls.length, putsBefore, "usage report must be read-only");
  h.restore();
});

test("quota: standard 429 counts the attempt, records a failed event, sets no success", async () => {
  const h = makeHarness(worker, {
    clockStart: T0,
    fetchBehavior: {
      onInteractions: async () =>
        jsonResponse(
          {
            error: {
              message: "Quota exceeded for quota metric 'GenerateRequestsPerDayPerProjectPerModel'.",
              status: "RESOURCE_EXHAUSTED",
              details: [
                {
                  "@type": "type.googleapis.com/google.rpc.QuotaFailure",
                  violations: [
                    {
                      quotaMetric:
                        "generativelanguage.googleapis.com/generate_content_free_tier_requests",
                      quotaId: "GenerateRequestsPerDayPerProjectPerModel",
                    },
                  ],
                },
              ],
            },
          },
          429,
        ),
    },
  });
  const jobId = sha256Hex("quota-std-429");
  await postJob(h, jobId, [makeSegment("q429-0")]);
  await deliverUntil(
    h,
    async () =>
      (await h.r2.readJson(statusKey(jobId)))?.state === "paused_quota",
    30,
  );
  assert.equal(
    (await h.r2.readJson(statusKey(jobId)))?.state,
    "paused_quota",
  );
  const report = await quotaReport(h);
  assert.equal(report.used_today, 1, "rejected requests still count as attempts");
  assert.equal(report.used_24h, 1);
  assert.equal(report.last_success_ms, null);
  const events = await usageEvents(h);
  assert.ok(
    events.some((e) => e.provider_call && e.request_status === "failed"),
    "a failed provider_call ledger event exists",
  );
  assert.equal(await h.r2.readJson("usage/gemini-last-success.json"), null);
  h.restore();
});

test("quota: cache hit counts no attempt and makes no provider call", async () => {
  const h = makeHarness(worker, { clockStart: T0 });
  const jobId = sha256Hex("quota-cache-hit");
  const segment = makeSegment("qcache-0");
  await postJob(h, jobId, [segment]);
  // Audio appears before the queued delivery runs (e.g. another device
  // generated it): the delivery must reuse it without any provider call.
  h.r2.store.set(`audio/${segment.cache_key}.wav`, {
    raw: new Uint8Array(128),
    etag: "seed",
    uploadedMs: T0,
  });
  await h.drain();
  const status = await h.r2.readJson(statusKey(jobId));
  assert.equal(status.state, "ready");
  assert.equal(h.google.calls.interactions, 0);
  const report = await quotaReport(h);
  assert.equal(report.used_today, 0);
  assert.equal(report.used_24h, 0);
  const events = await usageEvents(h);
  assert.ok(
    events.every((e) => !e.provider_call),
    "no provider_call event may be recorded for a cache hit",
  );
  h.restore();
});

test("quota: batch success counts no attempt but sets last-success; batch failure now writes a failed ledger event", async () => {
  // Success half.
  {
    const h = makeHarness(worker, { clockStart: T0 });
    const jobId = sha256Hex("quota-batch-success");
    await postSession(h, sha256Hex("quota-batch-success-session"), [
      batchJob(jobId, 0, ["qb-0"]),
    ]);
    await h.drain();
    const report = await quotaReport(h);
    assert.equal(report.used_today, 0, "Batch bypasses the request counter");
    assert.equal(report.used_24h, 0);
    assert.ok(report.last_success_ms >= T0, "Batch success still updates last-success");
    const markers = await h.r2.list({ prefix: "usage/gemini-attempts/" });
    assert.equal(markers.objects.length, 0);
    h.restore();
  }
  // Failure half: previously a silent ledger gap (no event at all).
  {
    const h = makeHarness(worker, {
      clockStart: T0,
      fetchBehavior: {
        onBatchPoll: async (name) =>
          jsonResponse({
            name,
            done: true,
            metadata: { state: "BATCH_STATE_FAILED" },
            error: { message: "Batch job failed upstream." },
          }),
      },
    });
    const jobId = sha256Hex("quota-batch-failure");
    await postSession(h, sha256Hex("quota-batch-failure-session"), [
      batchJob(jobId, 0, ["qbf-0"]),
    ]);
    await h.drain();
    const events = await usageEvents(h);
    assert.ok(
      events.some(
        (e) =>
          e.generation_mode === "batch" && e.request_status === "failed",
      ),
      "batch failure must write a failed ledger event (gap closed)",
    );
    const report = await quotaReport(h);
    assert.equal(report.used_today, 0);
    assert.equal(report.last_success_ms, null);
    h.restore();
  }
});

test("quota: Pacific-day and rolling-24h windows over R2 markers plus legacy KV keys (read-only union)", async () => {
  const h = makeHarness(worker, { clockStart: T0 });
  // T0 = 2026-10-19T18:00Z = 11:00 PDT; Pacific day starts 07:00Z.
  const A = Date.UTC(2026, 9, 19, 6, 30); // 23:30 PT yesterday; in 24h, not today
  const B = Date.UTC(2026, 9, 19, 8, 0); // 01:00 PT today; in both
  const C = Date.UTC(2026, 9, 18, 17, 0); // 25h old; in neither
  const D = Date.UTC(2026, 9, 19, 17, 59); // just now; in both
  const E = Date.UTC(2026, 9, 19, 10, 0); // legacy KV attempt, today; in both
  const F = Date.UTC(2026, 9, 18, 10, 0); // legacy KV attempt, 32h old; neither
  for (const [label, ts] of [["A", A], ["B", B], ["C", C], ["D", D]]) {
    h.r2.store.set(
      `usage/gemini-attempts/${String(ts).padStart(13, "0")}-seed${label}.json`,
      { raw: JSON.stringify({ timestamp: ts, model: "m" }), etag: "seed", uploadedMs: ts },
    );
  }
  h.kv.store.set(
    `quota:gemini:${String(E).padStart(13, "0")}:legacy-e`,
    JSON.stringify({ timestamp: E, model: "m" }),
  );
  h.kv.store.set(
    `quota:gemini:${String(F).padStart(13, "0")}:legacy-f`,
    JSON.stringify({ timestamp: F, model: "m" }),
  );
  h.r2.store.set("usage/gemini-last-success.json", {
    raw: JSON.stringify({ timestamp: T0 - 5000 }),
    etag: "seed",
    uploadedMs: T0 - 5000,
  });
  h.kv.store.set(
    "quota:gemini:last-success",
    JSON.stringify({ timestamp: T0 - 1000 }),
  );
  const report = await quotaReport(h);
  assert.equal(report.used_24h, 4, "A + B + D + legacy E");
  assert.equal(report.used_today, 3, "B + D + legacy E");
  assert.equal(report.used_calendar_day, 3);
  assert.equal(report.last_request_ms, D);
  assert.equal(report.next_expiry_ms, A + 24 * 60 * 60 * 1000);
  assert.equal(report.last_success_ms, T0 - 1000, "newer of R2 pointer and legacy KV pointer");
  assert.equal(report.reset_timezone, "America/Los_Angeles");
  assert.equal(h.kv.putCalls.length, 0, "the report never writes KV");
  h.restore();
});

test("quota: tracking reports unavailable (not zero) when R2 storage is missing", async () => {
  const h = makeHarness(worker, { clockStart: T0 });
  h.env.OPALREADER_STORAGE = undefined;
  const report = await quotaReport(h);
  assert.equal(report.tracking_available, false);
  assert.equal(report.used_24h, null);
  assert.equal(report.used_today, null);
  h.restore();
});
