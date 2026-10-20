// Run: node --test tests/poller-review-fixes.test.mjs
// Case #4 — Rowan's review corrections to the poller/discovery client:
//  (1) terminal jobs are never polled from the watchlist, and a stale
//      terminal response can never merge into an unrelated active slot;
//  (2) ct() derives "active" from every known job, so an evicted
//      generating job keeps its polling timer;
//  (3) the discovery throttle is per book, so opening another book
//      always discovers its jobs.
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

function makeWorld({ discoveryJobs = [] } = {}) {
  const chapter = {
    title: "Chapter 1", segments: [], autoSplitEnabled: false,
    generation: null, replacementGeneration: null,
  };
  const a = {
    book: { id: "book1", chapters: [chapter], continueSession: null },
    apiBase: "https://worker.test", accessToken: "tok", generationPoll: null,
  };
  const beCalls = [], krCalls = [], ltCalls = [], timers = [];
  const krResponses = new Map();
  const be = async (_base, _token, path) => {
    beCalls.push(path);
    return { json: async () => ({ quota_park: null, jobs: discoveryJobs }) };
  };
  const kr = async (_base, _token, id) => {
    krCalls.push(id);
    const r = krResponses.get(id);
    if (!r) { const e = new Error("not found"); e.status = 404; throw e; }
    return r;
  };
  const lt = async (idx, status, opts) => { ltCalls.push([idx, status, opts]); };
  const region = between(app, "const watchPollAt=new Map();", "async function Mr(");
  const { Ye, ct, refreshChapterJobDiscovery } = new Function(
    "a", "document", "be", "kr", "lt", "pe", "se", "refreshContinueSession",
    "scheduleAutoSplit", "scheduleQuotaBadgeRefresh",
    "noteChapterJob", "knownChapterJobs", "chapterJobWatch",
    "setTimeout", "clearTimeout",
    region + "\nreturn {Ye, ct, refreshChapterJobDiscovery};",
  )(
    a, { visibilityState: "visible" }, be, kr, lt,
    async () => {}, () => {}, async () => {}, () => {}, () => {},
    noteChapterJob, knownChapterJobs, chapterJobWatch,
    (fn, delay) => { timers.push({ fn, delay }); return timers.length; },
    () => {},
  );
  return { a, chapter, beCalls, krCalls, ltCalls, timers, krResponses, Ye, ct, refreshChapterJobDiscovery };
}

test("many historical terminal jobs from discovery are never polled", async () => {
  const states = ["ready", "partial", "failed"];
  const jobs = [];
  for (let n = 0; n < 12; n++) {
    jobs.push({
      job_id: String(n + 1).padStart(64, "0"), chapter_index: 0, kind: "chapter",
      state: states[n % 3], completed: 4, total: 4, continue_session_id: null,
    });
  }
  const w = makeWorld({ discoveryJobs: jobs });
  await w.Ye();
  await w.Ye();
  assert.equal(w.krCalls.length, 0,
    "no status GETs for terminal jobs, across repeated poll cycles");
  assert.equal(w.ltCalls.length, 0, "nothing terminal merges anywhere");
  assert.equal(knownChapterJobs(w.chapter).filter((j) => j.state !== "unknown").length, 12,
    "the jobs are still KNOWN (watchlist/truth) — just never polled");
});

test("a stale terminal response cannot disturb an active slot job", async () => {
  const SLOT_ID = hex("a"), STALE_ID = hex("b");
  const w = makeWorld();
  w.chapter.generation = { jobId: SLOT_ID, state: "generating", completed: 1, total: 6, error: null };
  noteChapterJob(w.chapter, { job_id: SLOT_ID, state: "generating", chapter_index: 0 });
  // The watchlist thinks this old job is still generating (its summary
  // omits `error`, exactly like a discovery summary); the server has
  // long since finished it.
  noteChapterJob(w.chapter, { job_id: STALE_ID, state: "generating", chapter_index: 0 });
  w.krResponses.set(SLOT_ID, { job_id: SLOT_ID, state: "generating", completed: 2, total: 6, error: null });
  w.krResponses.set(STALE_ID, { job_id: STALE_ID, state: "ready", completed: 9, total: 9, error: null });

  await w.Ye();
  assert.ok(w.ltCalls.some(([, s]) => s.job_id === SLOT_ID),
    "the slot job's own progress still merges normally");
  assert.ok(!w.ltCalls.some(([, s]) => s.job_id === STALE_ID),
    "the stale job's terminal status never merges into the active slot");
  assert.equal(w.chapter.generation.jobId, SLOT_ID, "the slot still belongs to the active job");

  // Once noted terminal, the stale job is never fetched again.
  const stalePolls = w.krCalls.filter((id) => id === STALE_ID).length;
  assert.equal(stalePolls, 1, "fetched once while its summary was nonterminal");
  await w.Ye();
  assert.equal(w.krCalls.filter((id) => id === STALE_ID).length, stalePolls,
    "terminal after the note: zero further GETs");
});

test("ct keeps polling for an evicted generating job that is in neither slot", async () => {
  const EVICTED_ID = hex("e"), DONE_ID = hex("d");
  const w = makeWorld();
  // A later, already-finished job occupies the generation slot; the
  // evicted job survives only in the watchlist.
  w.chapter.generation = { jobId: DONE_ID, state: "ready", completed: 5, total: 5, error: null };
  noteChapterJob(w.chapter, { job_id: EVICTED_ID, state: "generating", chapter_index: 0 });
  w.ct();
  assert.equal(w.timers.length, 1, "a polling timer is scheduled for the evicted job");
  assert.equal(w.timers[0].delay, 2500, "active cadence, not the parked slow poll");
  assert.equal(w.timers[0].fn, w.Ye);
});

test("ct does not schedule for the evicted job once it is gone, nor for Continue-owned jobs", async () => {
  const DONE_ID = hex("d"), SESSION_ID = hex("c");
  const w = makeWorld();
  w.chapter.generation = { jobId: DONE_ID, state: "ready", completed: 5, total: 5, error: null };
  w.ct();
  assert.equal(w.timers.length, 0, "finished slot job alone: nothing to poll");

  // A generating job owned by a Continue session does not count as
  // poller-active either — its owner (refreshContinueSession) polls it.
  noteChapterJob(w.chapter, { job_id: SESSION_ID, state: "generating", chapter_index: 0, continue_session_id: "sess" });
  w.a.book.continueSession = {
    state: "paused",
    jobs: [{ jobId: SESSION_ID, chapterIndex: 0, state: "generating" }],
  };
  w.ct();
  assert.equal(w.timers.length, 0, "Continue-owned active jobs stay with their owner");
});

test("opening a different book discovers its jobs immediately (per-book throttle)", async () => {
  const w = makeWorld();
  const chapterB = {
    title: "B Chapter 1", segments: [], autoSplitEnabled: false,
    generation: null, replacementGeneration: null,
  };
  await w.refreshChapterJobDiscovery();
  assert.deepEqual(w.beCalls, ["/api/generation/books/book1/jobs"]);

  // Switch books a second later — far inside the old global 45s window.
  w.a.book = { id: "book2", chapters: [chapterB], continueSession: null };
  await w.refreshChapterJobDiscovery();
  assert.deepEqual(w.beCalls, [
    "/api/generation/books/book1/jobs",
    "/api/generation/books/book2/jobs",
  ], "Book B's first discovery is NOT suppressed by Book A's");

  // The throttle still applies within the same book.
  await w.refreshChapterJobDiscovery();
  assert.equal(w.beCalls.length, 2, "same-book rediscovery stays throttled");

  // And switching back to Book A inside its own window stays throttled too.
  w.a.book = { id: "book1", chapters: [w.chapter], continueSession: null };
  await w.refreshChapterJobDiscovery();
  assert.equal(w.beCalls.length, 2, "per-book windows are independent, not reset on switch");
});
