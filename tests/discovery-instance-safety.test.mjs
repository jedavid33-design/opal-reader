// Run: node --test tests/discovery-instance-safety.test.mjs
// Case #4 final pass — Rowan's R1/R2 findings on registry discovery:
//  R1: reopening a book builds NEW chapter objects; if the per-book
//      discovery throttle (45s) suppresses a fresh fetch, the new
//      objects' watchlists are empty and a remotely parked job
//      disappears again. Cached results must be rehydrated onto the
//      new instance (and/or discovery forced on instance change), so
//      the parked job remains discoverable AND monitored.
//  R2: a discovery request started for Book A must never apply its
//      results after the user has switched to Book B.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../app-256.js", import.meta.url), "utf8");
const between = (src, a, b) => {
  const i = src.indexOf(a), j = src.indexOf(b, i);
  assert.ok(i >= 0 && j > i, "missing source " + a);
  return src.slice(i, j);
};
const segmentPlayable = new Function(
  between(app, "function segmentPlayable(", "/* Local-only diagnostic") +
    "\nreturn segmentPlayable;",
)();
const { knownChapterJobs, noteChapterJob, chapterJobWatch } = new Function(
  "segmentPlayable",
  between(app, "const chapterJobWatch=new Map();", "// Some blocked pieces are resolved") +
    "\nreturn {knownChapterJobs, noteChapterJob, chapterJobWatch};",
)(segmentPlayable);

const hex = (ch) => ch.repeat(64);

function makeWorld({ jobsByBook = {} } = {}) {
  const mkChapter = (title) => ({
    title, segments: [], autoSplitEnabled: false,
    generation: null, replacementGeneration: null,
  });
  const a = {
    book: null, apiBase: "https://worker.test", accessToken: "tok",
    generationPoll: null,
  };
  const beCalls = [], timers = [];
  let beHandler = null;
  const be = async (_base, _token, path) => {
    beCalls.push(path);
    if (beHandler) return beHandler(path);
    const bookId = decodeURIComponent(
      path.split("/books/")[1].split("/")[0]);
    return { json: async () => ({ quota_park: null, jobs: jobsByBook[bookId] || [] }) };
  };
  const kr = async () => { const e = new Error("not found"); e.status = 404; throw e; };
  const region = between(app, "const watchPollAt=new Map();", "async function Mr(");
  const { Ye, ct, refreshChapterJobDiscovery } = new Function(
    "a", "document", "be", "kr", "lt", "pe", "se", "refreshContinueSession",
    "scheduleAutoSplit", "scheduleQuotaBadgeRefresh",
    "noteChapterJob", "knownChapterJobs", "chapterJobWatch",
    "setTimeout", "clearTimeout",
    region + "\nreturn {Ye, ct, refreshChapterJobDiscovery};",
  )(
    a, { visibilityState: "visible" }, be, kr, async () => {}, async () => {},
    () => {}, async () => {}, () => {}, () => {},
    noteChapterJob, knownChapterJobs, chapterJobWatch,
    (fn, delay) => { timers.push({ fn, delay }); return timers.length; },
    () => {},
  );
  return {
    a, mkChapter, beCalls, timers, Ye, ct, refreshChapterJobDiscovery,
    setBeHandler: (fn) => { beHandler = fn; },
  };
}

test("R1: reopening a book with fresh chapter objects restores its parked job inside the throttle window", async () => {
  const PARKED = hex("f");
  const jobsA = [{
    job_id: PARKED, chapter_index: 0, kind: "chapter",
    state: "paused_quota", completed: 1, total: 26, continue_session_id: null,
  }];
  const w = makeWorld({ jobsByBook: { bookA: jobsA, bookB: [] } });

  // Open Book A (first instance) and discover the remote parked job.
  const chA1 = w.mkChapter("A · Chapter 1");
  w.a.book = { id: "bookA", chapters: [chA1], continueSession: null };
  await w.refreshChapterJobDiscovery();
  assert.ok(
    knownChapterJobs(chA1).some((j) => j.jobId === PARKED && j.state === "paused_quota"),
    "first open discovers the parked job");

  // Wander to Book B.
  const chB = w.mkChapter("B · Chapter 1");
  w.a.book = { id: "bookB", chapters: [chB], continueSession: null };
  await w.refreshChapterJobDiscovery();

  // Reopen Book A from IndexedDB: a brand-new book object with brand-new
  // chapter objects, still inside the 45s throttle window (this harness
  // never advances the wall clock).
  const chA2 = w.mkChapter("A · Chapter 1");
  w.a.book = { id: "bookA", chapters: [chA2], continueSession: null };
  assert.equal(knownChapterJobs(chA2).length, 0,
    "fresh chapter objects start with an empty watchlist (the R1 setup)");

  await w.refreshChapterJobDiscovery();
  const known = knownChapterJobs(chA2);
  assert.ok(
    known.some((j) => j.jobId === PARKED && j.state === "paused_quota"),
    "the remotely parked job is discoverable again on the new objects");

  // Discoverable is not enough — it must stay MONITORED: ct() schedules
  // the 60s parked slow poll for a book whose only known job is parked.
  w.timers.length = 0;
  w.ct();
  assert.ok(w.timers.some((t) => t.delay === 60000),
    "the parked slow poll is scheduled for the reopened book");
});

test("R2: a discovery response landing after a book switch is dropped whole", async () => {
  const JOB_A = hex("a");
  const w = makeWorld();
  const chA = w.mkChapter("A · Chapter 1");
  w.a.book = { id: "bookA", chapters: [chA], continueSession: null };

  // Hold Book A's discovery response until the test releases it.
  let release = null;
  w.setBeHandler(() => new Promise((resolve) => {
    release = () => resolve({
      json: async () => ({
        quota_park: null,
        jobs: [{
          job_id: JOB_A, chapter_index: 0, kind: "chapter",
          state: "paused_quota", completed: 0, total: 3,
          continue_session_id: null,
        }],
      }),
    });
  }));
  const inFlight = w.refreshChapterJobDiscovery();
  assert.ok(release, "discovery request is in flight");

  // The user switches to Book B before A's response arrives.
  const chB = w.mkChapter("B · Chapter 1");
  w.a.book = { id: "bookB", chapters: [chB], continueSession: null };
  release();
  await inFlight;

  assert.equal(knownChapterJobs(chB).length, 0,
    "Book B's chapters carry none of Book A's jobs");
  assert.equal(knownChapterJobs(chA).length, 0,
    "the stale response is not applied to the old instance either");

  // And Book B's own discovery still works afterwards.
  w.setBeHandler(null);
  await w.refreshChapterJobDiscovery();
  assert.deepEqual(w.beCalls, [
    "/api/generation/books/bookA/jobs",
    "/api/generation/books/bookB/jobs",
  ]);
});
