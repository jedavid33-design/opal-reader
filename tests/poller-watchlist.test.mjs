// Run: node --test tests/poller-watchlist.test.mjs
// Case #4 (§4.3): Ye() follows every known job — slot records plus the
// registry-discovered watchlist — with GETs only. Parked jobs are polled
// (throttled), Continue-session jobs are left to their owner, and ct()
// keeps a 60s slow poll alive when the only known jobs are parked.
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

const ACTIVE_ID = "a".repeat(64);
const PARKED_ID = "b".repeat(64);
const SESSION_JOB_ID = "c".repeat(64);

function makeWorld() {
  const chapter = {
    title: "Chapter 1", segments: [], autoSplitEnabled: false,
    generation: null, replacementGeneration: null,
  };
  const a = {
    book: { id: "book1", chapters: [chapter], continueSession: null },
    apiBase: "https://worker.test", accessToken: "tok", generationPoll: null,
  };
  const beCalls = [], krCalls = [], ltCalls = [], timers = [];
  const krResponses = new Map([
    [ACTIVE_ID, { job_id: ACTIVE_ID, state: "generating", completed: 1, total: 4, error: null }],
    [PARKED_ID, { job_id: PARKED_ID, state: "paused_quota", completed: 1, total: 26, error: "Gemini daily quota reached." }],
  ]);
  const be = async (_base, _token, path) => {
    beCalls.push(path);
    return {
      json: async () => ({
        quota_park: { parked_until: Date.now() + 3600000 },
        jobs: [
          { job_id: ACTIVE_ID, chapter_index: 0, kind: "chapter", state: "queued", completed: 0, total: 4, continue_session_id: null },
          { job_id: PARKED_ID, chapter_index: 0, kind: "chapter", state: "paused_quota", completed: 1, total: 26, continue_session_id: null },
        ],
      }),
    };
  };
  const kr = async (_base, _token, id) => {
    krCalls.push(id);
    const r = krResponses.get(id);
    if (!r) { const e = new Error("not found"); e.status = 404; throw e; }
    return r;
  };
  const lt = async (idx, status, opts) => { ltCalls.push([idx, status, opts]); };
  const region = between(app, "const watchPollAt=new Map();", "async function Mr(");
  const { Ye, ct } = new Function(
    "a", "document", "be", "kr", "lt", "pe", "se", "refreshContinueSession",
    "scheduleAutoSplit", "scheduleQuotaBadgeRefresh",
    "noteChapterJob", "knownChapterJobs", "chapterJobWatch",
    "setTimeout", "clearTimeout",
    region + "\nreturn {Ye, ct};",
  )(
    a, { visibilityState: "visible" }, be, kr, lt,
    async () => {}, () => {}, async () => {}, () => {}, () => {},
    noteChapterJob, knownChapterJobs, chapterJobWatch,
    (fn, delay) => { timers.push({ fn, delay }); return timers.length; },
    () => {},
  );
  return { a, chapter, beCalls, krCalls, ltCalls, timers, krResponses, Ye, ct };
}

test("Ye polls registry-discovered jobs (GET only), merges changes, and leaves Continue jobs alone", async () => {
  const w = makeWorld();
  // A Continue-session job is also in the watchlist: Ye must not touch it.
  noteChapterJob(w.chapter, { job_id: SESSION_JOB_ID, state: "queued", chapter_index: 0, continue_session_id: "sess" });
  w.a.book.continueSession = {
    state: "running",
    jobs: [{ jobId: SESSION_JOB_ID, chapterIndex: 0, state: "queued" }],
  };
  await w.Ye();
  assert.deepEqual(w.beCalls, ["/api/generation/books/book1/jobs"],
    "discovery fetched once; every network call in Ye is a GET");
  assert.ok(w.krCalls.includes(ACTIVE_ID), "discovered active job polled");
  assert.ok(w.krCalls.includes(PARKED_ID), "discovered parked job polled");
  assert.ok(!w.krCalls.includes(SESSION_JOB_ID), "Continue-session job untouched");
  // The active job changed state (queued -> generating): merged via lt.
  assert.ok(w.ltCalls.some(([, s]) => s.job_id === ACTIVE_ID && s.state === "generating"));

  // Second cycle: the parked job is throttled (60s), the active job is
  // followed every cycle and its completion merges.
  w.krResponses.set(ACTIVE_ID, { job_id: ACTIVE_ID, state: "ready", completed: 4, total: 4, error: null });
  const parkedPollsBefore = w.krCalls.filter((id) => id === PARKED_ID).length;
  await w.Ye();
  assert.equal(w.krCalls.filter((id) => id === PARKED_ID).length, parkedPollsBefore,
    "parked jobs poll at most once a minute");
  assert.ok(w.ltCalls.some(([, s]) => s.job_id === ACTIVE_ID && s.state === "ready"),
    "the later state change merged");
  assert.equal(w.beCalls.length, 1, "discovery itself is throttled too");
});

test("ct keeps a 60s slow poll alive when the only known jobs are parked", async () => {
  const w = makeWorld();
  noteChapterJob(w.chapter, { job_id: PARKED_ID, state: "paused_quota", chapter_index: 0 });
  w.ct();
  assert.equal(w.timers.length, 1, "a timer was scheduled (previously the poller simply died)");
  assert.equal(w.timers[0].delay, 60000, "slow poll for parked-only books");
  assert.equal(w.timers[0].fn, w.Ye, "the timer runs the poller");
});

test("ct schedules nothing when nothing is known and nothing is active", async () => {
  const w = makeWorld();
  w.ct();
  assert.equal(w.timers.length, 0);
});
