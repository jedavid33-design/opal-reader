// Chunked Continue staging (CONTINUE-CHUNKED-STAGING.md) — full-stack
// tests driving the real worker module against the mock stores.
// Protocol under test: POST /api/generation/continue/stage stages a
// slice of a plan with every job parked; POST .../finalize verifies the
// complete plan from live statuses and activates job 1 exactly once.
// The legacy one-shot /api/generation/continue must be unchanged.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import worker from "../cloudflare-worker.js";
import {
  makeHarness,
  makeSegment,
  sha256Hex,
  RELEASE,
  CLIENT_VERSION,
} from "./support/mock-env.mjs";

const T0 = Date.UTC(2026, 9, 20, 2, 0, 0);
const BOOK = "book-test-1";
const statusKey = (id) => `generation/status/${id}.json`;
const manifestKey = (sid) => `generation/sessions/${sid}.json`;

function makePlan(n, { sessionSeed = "session-1", chapterBase = 0 } = {}) {
  const session_id = sha256Hex(sessionSeed);
  const ids = Array.from({ length: n }, (_, i) => sha256Hex(`job-${sessionSeed}-${i}`));
  const jobs = ids.map((job_id, i) => ({
    job_id,
    book_id: BOOK,
    chapter_index: chapterBase + i,
    generation_mode: "batch",
    generation_release: RELEASE,
    client_version: CLIENT_VERSION,
    segments: [makeSegment(`${sessionSeed}-${i}-a`), makeSegment(`${sessionSeed}-${i}-b`)],
  }));
  return { session_id, ids, jobs };
}

// Test-side twin of the canonical-JSON + SHA-256 recipe both the
// Worker and the Reader implement; fingerprints are computed from the
// plan's CURRENT job objects at call time, exactly as the client does.
function stableJsonStringify(value) {
  if (value === null || typeof value !== "object")
    return JSON.stringify(value === undefined ? null : value);
  if (Array.isArray(value))
    return "[" + value.map((item) => stableJsonStringify(item === undefined ? null : item)).join(",") + "]";
  return "{" + Object.keys(value).filter((k) => value[k] !== undefined).sort()
    .map((k) => JSON.stringify(k) + ":" + stableJsonStringify(value[k])).join(",") + "}";
}
const fingerprint = (job) =>
  createHash("sha256").update(stableJsonStringify(job)).digest("hex");
const planFingerprints = (plan) =>
  Object.fromEntries(plan.jobs.map((j) => [j.job_id, fingerprint(j)]));

const stage = (h, plan, slice) =>
  h.request("/api/generation/continue/stage", {
    method: "POST",
    body: {
      session_id: plan.session_id, book_id: BOOK, job_ids: plan.ids,
      job_fingerprints: planFingerprints(plan), jobs: slice,
    },
  });
const finalize = (h, plan) =>
  h.request("/api/generation/continue/finalize", {
    method: "POST",
    body: { session_id: plan.session_id, book_id: BOOK },
  });

async function r2Status(h, id) {
  const obj = await h.r2.get(statusKey(id));
  return obj ? JSON.parse(await obj.text()) : null;
}

test("slices stage every job parked; nothing is enqueued before finalize", async () => {
  const h = makeHarness(worker, { clockStart: T0 });
  const plan = makePlan(5);
  let res = await stage(h, plan, plan.jobs.slice(0, 3));
  assert.equal(res.status, 202);
  let body = await res.json();
  assert.equal(body.staged_total, 3);
  assert.equal(body.complete, false);
  for (const id of plan.ids.slice(0, 3)) {
    const s = await r2Status(h, id);
    assert.equal(s.state, "parked");
    assert.equal(s.continue_session_id, plan.session_id);
  }
  assert.equal(await r2Status(h, plan.ids[3]), null);
  assert.equal(h.queue.pending.length, 0);

  res = await stage(h, plan, plan.jobs.slice(3));
  body = await res.json();
  assert.equal(body.staged_total, 5);
  assert.equal(body.complete, true);
  for (const id of plan.ids) assert.equal((await r2Status(h, id)).state, "parked");
  assert.equal(h.queue.pending.length, 0);
  const manifest = JSON.parse(await (await h.r2.get(manifestKey(plan.session_id))).text());
  assert.equal(manifest.state, "staging");
  assert.deepEqual(manifest.job_ids, plan.ids);
});

test("finalize before the plan is complete refuses and activates nothing", async () => {
  const h = makeHarness(worker, { clockStart: T0 });
  const plan = makePlan(5);
  await stage(h, plan, plan.jobs.slice(0, 3));
  const res = await finalize(h, plan);
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /incomplete: 3 of 5/);
  for (const id of plan.ids.slice(0, 3))
    assert.equal((await r2Status(h, id)).state, "parked");
  assert.equal(h.queue.pending.length, 0);
  // The session is still resumable afterwards.
  await stage(h, plan, plan.jobs.slice(3));
  const ok = await finalize(h, plan);
  assert.equal(ok.status, 202);
  assert.equal(h.queue.pending.length, 1);
});

test("finalize activates exactly the first job, exactly once", async () => {
  const h = makeHarness(worker, { clockStart: T0 });
  const plan = makePlan(5);
  await stage(h, plan, plan.jobs.slice(0, 3));
  await stage(h, plan, plan.jobs.slice(3));
  const res = await finalize(h, plan);
  assert.equal(res.status, 202);
  const body = await res.json();
  assert.equal(body.jobs.length, 5);
  assert.equal(body.jobs[0].state, "queued");
  assert.equal(body.jobs[1].state, "parked");
  const first = await r2Status(h, plan.ids[0]);
  assert.equal(first.state, "queued");
  assert.equal(first.continue_started, true);
  assert.equal(h.queue.pending.length, 1);
  assert.equal(h.queue.pending[0].body.job_id, plan.ids[0]);
  assert.equal(h.queue.pending[0].body.segment_index, 0);
  const manifest = JSON.parse(await (await h.r2.get(manifestKey(plan.session_id))).text());
  assert.equal(manifest.state, "active");

  // Duplicate finalize (e.g. the first response was lost): no new send,
  // no state churn on the first job.
  const v = first._statusVersion;
  const again = await finalize(h, plan);
  assert.equal(again.status, 202);
  assert.equal(h.queue.pending.length, 1);
  assert.equal((await r2Status(h, plan.ids[0]))._statusVersion, v);
});

test("interrupted setup resumes idempotently; re-staged jobs are not rewritten", async () => {
  const h = makeHarness(worker, { clockStart: T0 });
  const plan = makePlan(4);
  await stage(h, plan, plan.jobs.slice(0, 2));
  const before = await r2Status(h, plan.ids[0]);
  // Simulate the lost acknowledgement: the client re-sends the slice.
  const res = await stage(h, plan, plan.jobs.slice(0, 2));
  assert.equal(res.status, 202);
  const body = await res.json();
  assert.deepEqual(body.accepted, plan.ids.slice(0, 2));
  assert.equal(body.staged_total, 2);
  const after = await r2Status(h, plan.ids[0]);
  assert.equal(after._statusVersion, before._statusVersion);
  assert.equal(after.state, "parked");
  await stage(h, plan, plan.jobs.slice(2));
  const fin = await finalize(h, plan);
  assert.equal(fin.status, 202);
  assert.equal(h.queue.pending.length, 1);
});

test("a job already owned by another session cannot be claimed", async () => {
  const h = makeHarness(worker, { clockStart: T0 });
  const planA = makePlan(2, { sessionSeed: "session-A" });
  const legacy = await h.request("/api/generation/continue", {
    method: "POST",
    body: { session_id: planA.session_id, book_id: BOOK, jobs: planA.jobs },
  });
  assert.equal(legacy.status, 202);
  const planB = makePlan(2, { sessionSeed: "session-B" });
  planB.ids[0] = planA.ids[0]; // attempt to reuse A's first job
  planB.jobs[0] = { ...planB.jobs[0], job_id: planA.ids[0] };
  const res = await stage(h, planB, [planB.jobs[0]]);
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /different session/);
});

test("the plan cannot change mid-staging", async () => {
  const h = makeHarness(worker, { clockStart: T0 });
  const plan = makePlan(4);
  await stage(h, plan, plan.jobs.slice(0, 2));
  const swappedId = sha256Hex("job-swapped");
  const otherIds = [...plan.ids.slice(0, 3), swappedId]; // same session, new tail
  const swappedJob = { ...plan.jobs[3], job_id: swappedId };
  const res = await h.request("/api/generation/continue/stage", {
    method: "POST",
    body: { session_id: plan.session_id, book_id: BOOK, job_ids: otherIds, jobs: [swappedJob] },
  });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /does not match/);
});

test("out-of-order chapters assembled across slices fail at finalize; all stay parked", async () => {
  const h = makeHarness(worker, { clockStart: T0 });
  const plan = makePlan(2);
  plan.jobs[0].chapter_index = 7;
  plan.jobs[1].chapter_index = 3;
  await stage(h, plan, [plan.jobs[0]]);
  await stage(h, plan, [plan.jobs[1]]);
  const res = await finalize(h, plan);
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /out of chapter order/);
  for (const id of plan.ids) assert.equal((await r2Status(h, id)).state, "parked");
  assert.equal(h.queue.pending.length, 0);
});

test("stage rejects oversize slices and oversize plans", async () => {
  const h = makeHarness(worker, { clockStart: T0 });
  const plan = makePlan(11);
  const bigSlice = await stage(h, plan, plan.jobs); // 11 jobs in one request
  assert.equal(bigSlice.status, 400);
  assert.match((await bigSlice.json()).error, /1–10 jobs/);
  const bigPlan = makePlan(30);
  bigPlan.ids.push(sha256Hex("one-too-many"));
  const res = await h.request("/api/generation/continue/stage", {
    method: "POST",
    body: { session_id: bigPlan.session_id, book_id: BOOK, job_ids: bigPlan.ids, jobs: [bigPlan.jobs[0]] },
  });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /1–30 unique job IDs/);
});

test("a payload-only partial job is re-staged, not skipped", async () => {
  const h = makeHarness(worker, { clockStart: T0 });
  const plan = makePlan(2);
  // Pre-seed ONLY the payload object for job 1 (a staging write that was
  // interrupted before its status landed — the staging_incomplete case).
  const payload = { ...plan.jobs[0], continue_session_id: plan.session_id, continue_next_job_id: plan.ids[1] };
  await h.r2.put(`generation/jobs/${plan.ids[0]}.json`, JSON.stringify({ ...payload, status: { job_id: plan.ids[0], state: "parked" } }));
  const probe = await h.request(`/api/generation/jobs/${plan.ids[0]}`);
  assert.equal((await probe.json()).state, "staging_incomplete");
  const res = await stage(h, plan, [plan.jobs[0]]);
  assert.equal(res.status, 202);
  const s = await r2Status(h, plan.ids[0]);
  assert.equal(s.state, "parked");
  assert.equal(s.continue_session_id, plan.session_id);
});

test("legacy one-shot continue is unchanged", async () => {
  const h = makeHarness(worker, { clockStart: T0 });
  const plan = makePlan(2, { sessionSeed: "session-legacy" });
  const res = await h.request("/api/generation/continue", {
    method: "POST",
    body: { session_id: plan.session_id, book_id: BOOK, jobs: plan.jobs },
  });
  assert.equal(res.status, 202);
  assert.equal((await r2Status(h, plan.ids[0])).state, "queued");
  assert.equal((await r2Status(h, plan.ids[1])).state, "parked");
  assert.equal(h.queue.pending.length, 1);
  // No chunked manifest is created by the legacy path.
  assert.equal(await h.r2.get(manifestKey(plan.session_id)), null);
});

test("lost finalize acknowledgement: stage on an active session reconciles without re-staging or re-activating", async () => {
  const h = makeHarness(worker, { clockStart: T0 });
  const plan = makePlan(4);
  await stage(h, plan, plan.jobs.slice(0, 3));
  await stage(h, plan, plan.jobs.slice(3));
  const fin = await finalize(h, plan);
  assert.equal(fin.status, 202);
  assert.equal(h.queue.pending.length, 1);
  const versions = new Map();
  for (const id of plan.ids) versions.set(id, (await r2Status(h, id))._statusVersion);

  // The finalize response never reached the Reader, so the client
  // checks the same setup again, starting with a stage request.
  const res = await stage(h, plan, plan.jobs.slice(0, 3));
  assert.equal(res.status, 202);
  const body = await res.json();
  assert.equal(body.already_active, true);
  assert.deepEqual(body.accepted, []);
  assert.equal(body.complete, true);
  // Nothing was rewritten and nothing was sent again.
  for (const id of plan.ids)
    assert.equal((await r2Status(h, id))._statusVersion, versions.get(id));
  assert.equal(h.queue.pending.length, 1);
  // Finalize returns the reconciling summary with the original job IDs.
  const summary = await (await finalize(h, plan)).json();
  assert.deepEqual(summary.jobs.map((j) => j.job_id), plan.ids);
  assert.equal(summary.jobs[0].state, "queued");
  assert.equal(h.queue.pending.length, 1);

  // An active session still refuses a DIFFERENT plan under its ID.
  const other = await h.request("/api/generation/continue/stage", {
    method: "POST",
    body: {
      session_id: plan.session_id, book_id: BOOK,
      job_ids: [...plan.ids.slice(0, 3), sha256Hex("intruder")],
      jobs: [plan.jobs[0]],
    },
  });
  assert.equal(other.status, 400);
  assert.match((await other.json()).error, /does not match the plan/);
});

test("an unstaged job cannot be staged with altered contents under its original ID", async () => {
  const h = makeHarness(worker, { clockStart: T0 });
  const plan = makePlan(3);
  const pins = planFingerprints(plan); // pinned from the ORIGINAL jobs
  await stage(h, plan, plan.jobs.slice(0, 2));
  const tampered = {
    ...plan.jobs[2],
    segments: plan.jobs[2].segments.map((s, i) =>
      i === 0 ? { ...s, text: "Completely different narration." } : s),
  };
  const res = await h.request("/api/generation/continue/stage", {
    method: "POST",
    body: {
      session_id: plan.session_id, book_id: BOOK, job_ids: plan.ids,
      job_fingerprints: pins, jobs: [tampered],
    },
  });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /contents do not match the plan pinned/);
  assert.equal(await r2Status(h, plan.ids[2]), null); // never staged
  const fin = await finalize(h, plan);
  assert.equal(fin.status, 400);
  assert.match((await fin.json()).error, /incomplete: 2 of 3/);
  assert.equal(h.queue.pending.length, 0);
  // The genuine job still stages cleanly afterwards.
  const ok = await stage(h, plan, [plan.jobs[2]]);
  assert.equal(ok.status, 202);
  assert.equal((await finalize(h, plan)).status, 202);
});

test("fingerprints are required, and a later slice cannot re-pin the plan", async () => {
  const h = makeHarness(worker, { clockStart: T0 });
  const plan = makePlan(3);
  const noPins = await h.request("/api/generation/continue/stage", {
    method: "POST",
    body: { session_id: plan.session_id, book_id: BOOK, job_ids: plan.ids, jobs: [plan.jobs[0]] },
  });
  assert.equal(noPins.status, 400);
  assert.match((await noPins.json()).error, /job_fingerprints must pin/);

  await stage(h, plan, [plan.jobs[0]]);
  const repinned = planFingerprints(plan);
  repinned[plan.ids[2]] = sha256Hex("forged-pin");
  const res = await h.request("/api/generation/continue/stage", {
    method: "POST",
    body: {
      session_id: plan.session_id, book_id: BOOK, job_ids: plan.ids,
      job_fingerprints: repinned, jobs: [plan.jobs[1]],
    },
  });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /fingerprints do not match/);
  assert.equal(await r2Status(h, plan.ids[1]), null);
});

test("the complete 30-job plan stages in client-sized slices and activates once", async () => {
  const h = makeHarness(worker, { clockStart: T0 });
  const plan = makePlan(30);
  for (let at = 0; at < 30; at += 3) {
    const res = await stage(h, plan, plan.jobs.slice(at, at + 3));
    assert.equal(res.status, 202);
    const body = await res.json();
    assert.equal(body.staged_total, at + 3);
    assert.equal(body.complete, at + 3 === 30);
    assert.equal(h.queue.pending.length, 0);
  }
  for (const id of plan.ids) assert.equal((await r2Status(h, id)).state, "parked");
  const manifest = JSON.parse(await (await h.r2.get(manifestKey(plan.session_id))).text());
  assert.equal(Object.keys(manifest.job_fingerprints).length, 30);
  const fin = await finalize(h, plan);
  assert.equal(fin.status, 202);
  const body = await fin.json();
  assert.equal(body.jobs.length, 30);
  assert.equal((await r2Status(h, plan.ids[0])).state, "queued");
  assert.equal((await r2Status(h, plan.ids[0])).continue_started, true);
  for (const id of plan.ids.slice(1))
    assert.equal((await r2Status(h, id)).state, "parked");
  assert.equal(h.queue.pending.length, 1);
  assert.equal(h.queue.pending[0].body.job_id, plan.ids[0]);
});

test("manifest read failure fails closed: no repin, no job rewrite, no activation", async () => {
  let failManifestReads = false;
  const h = makeHarness(worker, {
    clockStart: T0,
    r2Hooks: {
      onGet: async (key) => {
        if (failManifestReads && key.startsWith("generation/sessions/"))
          throw new Error("simulated transient R2 read failure");
      },
    },
  });
  const plan = makePlan(3);
  await stage(h, plan, plan.jobs.slice(0, 2));
  const manifestBefore = await (await h.r2.get(manifestKey(plan.session_id))).text();
  const v0 = (await r2Status(h, plan.ids[0]))._statusVersion;

  failManifestReads = true;
  // A retry carrying a different plan must not repin over the existing
  // manifest while its read is failing (the pre-fix code swallowed the
  // error, saw "no manifest", and would have done exactly that).
  const forged = makePlan(3, { sessionSeed: "forged" });
  const attack = await h.request("/api/generation/continue/stage", {
    method: "POST",
    body: {
      session_id: plan.session_id, book_id: BOOK,
      job_ids: forged.ids, job_fingerprints: planFingerprints(forged),
      jobs: [forged.jobs[0]],
    },
  });
  assert.notEqual(attack.status, 202);
  // The honest next slice is refused too, with the storage error
  // propagated rather than masked.
  const honest = await stage(h, plan, [plan.jobs[2]]);
  assert.notEqual(honest.status, 202);
  assert.match((await honest.json()).error, /simulated transient R2 read failure/);
  // Finalize cannot activate anything while the manifest is unreadable.
  const fin = await finalize(h, plan);
  assert.notEqual(fin.status, 202);

  failManifestReads = false;
  // Nothing changed underneath the outage.
  assert.equal(await (await h.r2.get(manifestKey(plan.session_id))).text(), manifestBefore);
  assert.equal((await r2Status(h, plan.ids[0]))._statusVersion, v0);
  assert.equal(await r2Status(h, plan.ids[2]), null);
  assert.equal(await r2Status(h, forged.ids[0]), null);
  assert.equal(h.queue.pending.length, 0);
  // Once reads recover, the same session resumes and completes.
  await stage(h, plan, [plan.jobs[2]]);
  assert.equal((await finalize(h, plan)).status, 202);
  assert.equal(h.queue.pending.length, 1);
});

test("worker and reader canonical JSON agree byte-for-byte", () => {
  const workerSrc = readFileSync(new URL("../cloudflare-worker.js", import.meta.url), "utf8");
  const app = readFileSync(new URL("../app-256.js", import.meta.url), "utf8");
  const extract = (src) => {
    const start = src.indexOf("function stableJsonStringify(");
    assert.ok(start >= 0, "stableJsonStringify present");
    const fn = new Function(src.slice(start, src.indexOf("\n}", start) + 2) + "\nreturn stableJsonStringify;");
    return fn();
  };
  const tricky = { b: 1, a: { d: [1, 2], c: null }, u: undefined, arr: [{ z: 1, y: 2 }, undefined, "x"] };
  const expected = '{"a":{"c":null,"d":[1,2]},"arr":[{"y":2,"z":1},null,"x"],"b":1}';
  assert.equal(extract(workerSrc)(tricky), expected);
  assert.equal(extract(app)(tricky), expected);
});

test("client submits the saved plan in acknowledged slices, then finalizes", () => {
  const app = readFileSync(new URL("../app-256.js", import.meta.url), "utf8");
  const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(index, /app-256\.js/);
  const helperStart = app.indexOf("const CONTINUE_STAGE_SLICE=");
  assert.ok(helperStart >= 0, "submitContinuePlan helper exists");
  const helper = app.slice(helperStart, app.indexOf("async function continueToQuota(", helperStart));
  assert.match(helper, /CONTINUE_STAGE_SLICE=3/);
  assert.match(helper, /\/api\/generation\/continue\/stage/);
  assert.match(helper, /\/api\/generation\/continue\/finalize/);
  assert.match(helper, /job_ids:jobIds/);
  assert.match(helper, /job_fingerprints:fingerprints/);
  assert.match(helper, /tt\(stableJsonStringify\(j\)\)/);
  assert.match(helper, /ack\?\.already_active/);
  assert.ok(app.includes("function stableJsonStringify("));
  // The staging_unconfirmed retry feeds the SAVED requests (same session,
  // same job IDs) through the helper — never a rebuilt plan.
  const retry = app.slice(app.indexOf('session.state==="staging_unconfirmed"'), app.indexOf('session.state==="staging_unconfirmed"') + 400);
  assert.match(retry, /submitContinuePlan\(session\.id,book\.id,\s*session\.requests/);
  // The initial submit uses the same helper with the freshly built jobs.
  assert.match(app, /submitContinuePlan\(sessionId,book\.id,jobs,/);
  // No one-shot continue POST remains in the client.
  assert.ok(!app.includes('"/api/generation/continue",{'), "legacy one-shot POST removed from client");
  // Release identifiers are untouched, so saved sessions stay valid.
  assert.match(app, /const APP_UI_VERSION="1\.4\.117"/);
});
