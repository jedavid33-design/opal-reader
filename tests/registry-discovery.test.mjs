// Run: node --test tests/registry-discovery.test.mjs
// Case #4 (§3.1/§3.2 + Rowan S2): every job registers a keyspace marker at
// creation; discovery returns live summaries for the whole book; legacy
// jobs are backfilled by a bounded scan that runs whenever the
// scan-done marker is absent (even if new markers exist), never marks
// done on incomplete/failed writes, and surfaces pending registrations.
import test from "node:test";
import assert from "node:assert/strict";
import worker from "../cloudflare-worker.js";
import {
  makeHarness, makeSegment, sha256Hex, RELEASE, CLIENT_VERSION,
} from "./support/mock-env.mjs";

const T0 = Date.UTC(2026, 9, 20, 15, 0, 0);
const BOOK = "book-test-1";

async function postJob(h, jobId, segments, extra = {}) {
  const res = await h.request("/api/generation/jobs", {
    method: "POST",
    body: {
      job_id: jobId, book_id: BOOK, chapter_index: 0,
      generation_release: RELEASE, client_version: CLIENT_VERSION,
      segments, ...extra,
    },
  });
  return { status: res.status, body: await res.json() };
}
async function postSession(h, sessionId, jobs) {
  return h.request("/api/generation/continue", {
    method: "POST",
    body: { session_id: sessionId, book_id: BOOK, book_title: "T", jobs },
  });
}
function continueJob(jobId, chapterIndex, seeds) {
  return {
    job_id: jobId, book_id: BOOK, chapter_index: chapterIndex,
    generation_release: RELEASE, client_version: CLIENT_VERSION,
    segments: seeds.map((s) => makeSegment(s)),
  };
}
const discover = async (h, book = BOOK, chapter) =>
  (await h.request(`/api/generation/books/${book}/jobs${chapter === undefined ? "" : `?chapter_index=${chapter}`}`)).json();
const markerKey = (book, chapter, jobId) =>
  `generation/registry/${book}/${chapter}/${jobId}.json`;

test("POST /jobs and Continue staging write registry markers; discovery returns live summaries", async () => {
  const h = makeHarness(worker, { clockStart: T0 });
  const chapterJobId = sha256Hex("registry-chapter-job");
  await postJob(h, chapterJobId, [makeSegment("rj-0")]);
  const marker = await h.r2.readJson(markerKey(BOOK, 0, chapterJobId));
  assert.ok(marker, "marker written at POST creation");
  assert.equal(marker.kind, "chapter");
  assert.equal(marker.job_id, chapterJobId);

  const c1 = sha256Hex("registry-continue-1");
  const c2 = sha256Hex("registry-continue-2");
  await postSession(h, sha256Hex("registry-session"), [
    continueJob(c1, 1, ["rc-0"]), continueJob(c2, 2, ["rc-1"]),
  ]);
  assert.equal((await h.r2.readJson(markerKey(BOOK, 1, c1))).kind, "continue");
  assert.equal((await h.r2.readJson(markerKey(BOOK, 2, c2))).kind, "continue");

  const found = await discover(h);
  assert.equal(found.book_id, BOOK);
  assert.equal(found.truncated, false);
  assert.equal(found.registry_pending, 0);
  const byId = new Map(found.jobs.map((j) => [j.job_id, j]));
  // Simultaneous jobs for one book (different chapters) are ALL
  // discoverable — keyspace writes, no list to tear (invariant I3).
  assert.deepEqual([...byId.keys()].sort(), [chapterJobId, c1, c2].sort());
  assert.equal(byId.get(c1).kind, "continue");
  assert.equal(byId.get(c2).chapter_index, 2);
  assert.ok(byId.get(c1).continue_session_id, "session id surfaced for the client's Continue ownership check");

  const onlyCh2 = await discover(h, BOOK, 2);
  assert.deepEqual(onlyCh2.jobs.map((j) => j.job_id), [c2], "chapter filter works");
  h.restore();
});

test("legacy backfill: a marker-less parked job (FP Chapter 3 shape) is discovered and the scan runs once", async () => {
  const h = makeHarness(worker, { clockStart: T0 });
  const legacyId = sha256Hex("legacy-parked-job");
  // A pre-registry job: only its status object exists (the client lost
  // this ID when a repair evicted the chapter's slot).
  await h.r2.put(`generation/status/${legacyId}.json`, JSON.stringify({
    job_id: legacyId, book_id: "legacy-book-1", chapter_index: 3,
    state: "paused_quota", completed: 1, total: 26, segments: [],
    updated_at: T0 - 1000,
  }));
  const otherBookId = sha256Hex("legacy-other-book-job");
  await h.r2.put(`generation/status/${otherBookId}.json`, JSON.stringify({
    job_id: otherBookId, book_id: "someone-elses-book", chapter_index: 0,
    state: "ready", completed: 4, total: 4, segments: [], updated_at: T0,
  }));
  const first = await discover(h, "legacy-book-1");
  assert.equal(first.legacy_scan, "complete");
  assert.deepEqual(first.jobs.map((j) => j.job_id), [legacyId]);
  assert.equal(first.jobs[0].state, "paused_quota");
  assert.equal(first.jobs[0].completed, 1);
  assert.ok(await h.r2.readJson(markerKey("legacy-book-1", 3, legacyId)),
    "backfill wrote the marker");
  assert.ok(await h.r2.readJson(`generation/registry/legacy-book-1/_scan.json`),
    "scan-done marker written after a complete scan");
  const second = await discover(h, "legacy-book-1");
  assert.equal(second.legacy_scan, "not_needed", "the scan does not repeat");
  assert.deepEqual(second.jobs.map((j) => j.job_id), [legacyId]);
  h.restore();
});

test("S2: the legacy scan runs even when the book already has a new marker", async () => {
  const h = makeHarness(worker, { clockStart: T0 });
  // One job registered the new way...
  const newJobId = sha256Hex("s2-new-job");
  await postJob(h, newJobId, [makeSegment("s2-0")], {});
  // ...and one legacy job with only a status object, same book. (postJob
  // above used BOOK; write the legacy status for the same book id.)
  const legacyId = sha256Hex("s2-legacy-job");
  await h.r2.put(`generation/status/${legacyId}.json`, JSON.stringify({
    job_id: legacyId, book_id: BOOK, chapter_index: 5,
    state: "paused_quota", completed: 2, total: 9, segments: [],
    updated_at: T0 - 5000,
  }));
  const found = await discover(h);
  assert.equal(found.legacy_scan, "complete",
    "scan ran despite the existing new marker (scan-done was absent)");
  assert.ok(found.jobs.some((j) => j.job_id === legacyId), "legacy job backfilled");
  assert.ok(found.jobs.some((j) => j.job_id === newJobId), "new job still listed");
  h.restore();
});

test("Rowan review: a failing registry list reports incomplete coverage, never false completeness", async () => {
  const h = makeHarness(worker, {
    clockStart: T0,
    r2Hooks: {
      onList: async ({ prefix }) => {
        // Only the registry marker enumeration fails; the pending
        // reconcile and the legacy status scan list other prefixes.
        if (prefix.startsWith("generation/registry/"))
          throw new Error("simulated R2 list failure");
      },
    },
  });
  const jobId = sha256Hex("listfail-job");
  await postJob(h, jobId, [makeSegment("lf-0")]);
  assert.ok(await h.r2.readJson(markerKey(BOOK, 0, jobId)),
    "the marker exists in storage — only enumerating it fails");
  const found = await discover(h);
  assert.equal(found.registry_incomplete, true,
    "the listing failure is explicitly reported as incomplete coverage");
  assert.equal(found.truncated, true,
    "coverage is never claimed complete when the listing failed");
  assert.deepEqual(found.jobs, [], "no jobs can be enumerated through a failed listing");
  h.restore();
});

test("healthy discovery reports registry_incomplete: false", async () => {
  const h = makeHarness(worker, { clockStart: T0 });
  const jobId = sha256Hex("listok-job");
  await postJob(h, jobId, [makeSegment("lo-0")]);
  const found = await discover(h);
  assert.equal(found.registry_incomplete, false);
  assert.equal(found.truncated, false);
  assert.ok(found.jobs.some((j) => j.job_id === jobId));
  h.restore();
});

test("S2: a failed marker PUT leaves a durable pending record; discovery reconciles it and never marks the scan done early", async () => {
  const control = { failRegistry: true };
  const h = makeHarness(worker, {
    clockStart: T0,
    r2Hooks: {
      onPut: async (key) => {
        if (control.failRegistry &&
          key.startsWith("generation/registry/") &&
          !key.endsWith("/_scan.json"))
          throw new Error("simulated R2 marker failure");
      },
    },
  });
  const jobId = sha256Hex("s2-failing-job");
  const posted = await postJob(h, jobId, [makeSegment("s2f-0")]);
  assert.equal(posted.status, 202, "registration failure never fails generation");
  assert.equal(await h.r2.readJson(markerKey(BOOK, 0, jobId)), null, "marker write failed");
  const pending = await h.r2.readJson(`generation/registry-pending/${jobId}.json`);
  assert.ok(pending, "a durable pending record was left instead");
  assert.equal(pending.job_id, jobId);

  const during = await discover(h);
  assert.ok(during.registry_pending >= 1, "discovery reports the unreconciled registration");
  assert.equal(during.legacy_scan, "deferred",
    "scan is NOT marked done while marker writes are failing");

  // Storage recovers: the next discovery reconciles the pending record.
  control.failRegistry = false;
  const after = await discover(h);
  assert.equal(after.registry_pending, 0);
  assert.ok(after.jobs.some((j) => j.job_id === jobId), "job discoverable after reconcile");
  assert.equal(await h.r2.readJson(`generation/registry-pending/${jobId}.json`), null,
    "pending record drained");
  h.restore();
});
