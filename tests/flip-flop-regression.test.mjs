// Run: node --test tests/flip-flop-regression.test.mjs
// Case #4: the Oct 20, 2026 Forever Pucked flip-flop, replayed against
// the real client functions. A standard job parks at 1/26; a repair job
// is then adopted at 2/2. Before Case #4, the repair's staging write
// evicted the parked job from the chapter's single slot and repainted
// the chapter 0/2 -> 1/2 -> (slot dropped) "finished". Now: the counts
// stay at the segment truth (3/27) throughout, the quota-paused truth
// survives the repair's adoption, and neither job's progress ever
// regresses.
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
const { chapterTruth, knownChapterJobs, noteChapterJob, chapterJobWatch } = new Function(
  "segmentPlayable",
  between(app, "const chapterJobWatch=new Map();", "// Some blocked pieces are resolved") +
    "\nreturn {chapterTruth, knownChapterJobs, noteChapterJob, chapterJobWatch};",
)(segmentPlayable);
const chapterPlaybackReady = new Function(
  "segmentPlayable",
  between(app, "function chapterPlaybackReady(", "function normalizeGeminiModel(") +
    "\nreturn chapterPlaybackReady;",
)(segmentPlayable);
const orMerge = new Function(
  "segmentPlayable", "segIdentity", "recordGeminiFailure", "chapterPlaybackReady",
  between(app, "function sr(", "// v1.4.92:") +
    between(app, "function isLegacyGeminiInputBlock(", "function or(") +
    between(app, "function or(", "function ur(") +
    "\nreturn or;",
)(segmentPlayable, (s) => s.id || s.text, () => {}, chapterPlaybackReady);
const chapterQuotaBanner = new Function(
  "chapterTruth", "knownChapterJobs",
  between(app, "function chapterQuotaBanner(", "function continueQuotaHeader(") +
    "\nreturn chapterQuotaBanner;",
)(chapterTruth, knownChapterJobs);

const queueSrc = between(app, "async function queueAdaptiveRepair(", "// v1.4.79:");
const RELEASE = "1.4.43/1.4.117";
const PARKED_ID = "a".repeat(64);
const REPAIR_ID = "b".repeat(64);

function makeWorld() {
  const segments = Array.from({ length: 27 }, (_, i) => ({
    id: "seg-" + i, text: "segment " + i, pov: "Narrator",
    ...(i < 3 ? { audioKey: "audio-" + i } : {}),
    ...(i === 5 ? { generationBlocked: { error: "Gemini blocked this segment." } } : {}),
  }));
  const chapter = {
    title: "Chapter 3", pov: "Narrator", segments,
    generation: null, replacementGeneration: null,
    autoSplitEnabled: true, autoSplitPauseReason: null, autoSplitStatus: null,
  };
  const book = { id: "book1", title: "Book", chapters: [chapter] };
  const a = {
    book, monthlyCap: 0, providers: { generation: true },
    apiBase: "https://worker.test", accessToken: "tok",
  };
  const snapshots = [];
  const snap = () => snapshots.push({
    jobId: chapter.generation?.jobId, state: chapter.generation?.state,
    completed: chapter.generation?.completed, total: chapter.generation?.total,
  });
  const calls = { xt: [], lt: [] };
  // lt stub that merges like the real lt: note the job, then run the
  // real or() merge with lt's recordedCost argument.
  const lt = async (idx, status) => {
    calls.lt.push([idx, status]);
    noteChapterJob(chapter, status);
    orMerge(chapter, status, { recordedCost: Number(status.generated_cost) || 0 });
    snap();
  };
  const repairStatus = {
    state: "ready", completed: 2, total: 2, generated_cost: 0.3, segments: [],
  };
  const queueAdaptiveRepair = new Function(
    "a", "adaptiveQueueStarting", "adaptiveWorkerReady", "splitBlockedSegment", "runAutoSplit",
    "adaptiveRepairPlan", "Ve", "tt", "kr", "xt", "lt", "pe", "se", "ct", "$e",
    "GENERATION_RELEASE_ID", "confirm", "alert",
    queueSrc + "return queueAdaptiveRepair;",
  )(
    a, new Set(), async () => true,
    () => { throw new Error("local split fallback must not run"); },
    () => { throw new Error("legacy auto-split must not run"); },
    async () => ({
      nodes: [{ cache_key: "n1", estimated_cost: 0.1 }],
      roots: [{ index: 5 }],
    }),
    () => ({ month: "2026-10", spent: 0 }),
    async () => REPAIR_ID,
    async (_base, _token, id) => ({ ...repairStatus, job_id: id }),
    async (_base, _token, payload) => { calls.xt.push(payload); return { job_id: payload.job_id, state: "queued" }; },
    lt,
    async () => { snap(); }, () => {}, () => {},
    async () => {},
    RELEASE,
    () => true,
    () => {},
  );
  return { chapter, book, lt, queueAdaptiveRepair, calls, snapshots };
}

const parkedStatus = () => ({
  job_id: PARKED_ID, state: "paused_quota", completed: 1, total: 26,
  generated_cost: 0.1, segments: [], error: "Gemini daily quota reached.",
});

test("park 1/26 -> repair adopted 2/2 -> repeated merges: the card never flip-flops", async () => {
  const { chapter, lt, queueAdaptiveRepair, calls, snapshots } = makeWorld();
  const truth = () => chapterTruth(chapter, knownChapterJobs(chapter));

  // The standard job parks after 1/26 (its own status merge).
  await lt(0, parkedStatus());
  assert.equal(truth().playable, 3);
  assert.equal(truth().label, "Partial 3/27");
  assert.equal(truth().quotaPaused, true);
  assert.match(chapterQuotaBanner(chapter), /Gemini daily limit reached/);
  assert.equal(chapter.generation.completed, 1);

  // The repair is queued (Case #2 server check first): the server job
  // is adopted. NO staging write may reset the slot to 0/2 first.
  await queueAdaptiveRepair(0);
  assert.equal(calls.xt.length, 0, "adoption, not a duplicate submission");
  assert.ok(
    !snapshots.some((s) => s.state === "queued" && s.completed === 0 && s.total === 2),
    "the slot was never repainted as a fresh 0/2 staging record",
  );
  // The repair's own progress is adopted truthfully (2/2 in the slot
  // cache) while the chapter truth stays at the segment truth.
  assert.equal(chapter.generation.jobId, REPAIR_ID);
  assert.equal(chapter.generation.completed, 2);
  assert.equal(truth().playable, 3, "3/27 with a ready 2/2 repair stays 3/27");
  assert.equal(truth().label, "Partial 3/27");
  assert.equal(truth().quotaPaused, true,
    "the parked job is still known via the watchlist — quota truth survives the slot change");
  assert.match(chapterQuotaBanner(chapter), /Gemini daily limit reached/);

  // Repeated poll cycles, alternating which job's status merges last.
  await lt(0, parkedStatus());
  assert.equal(truth().playable, 3);
  assert.equal(truth().quotaPaused, true);
  await lt(0, { job_id: REPAIR_ID, state: "ready", completed: 2, total: 2, generated_cost: 0.3, segments: [] });
  assert.equal(truth().playable, 3);
  assert.match(chapterQuotaBanner(chapter), /Gemini daily limit reached/);

  // A stale lower-progress merge for the SAME repair job cannot regress
  // its displayed progress (or() monotonic guard).
  await lt(0, { job_id: REPAIR_ID, state: "generating", completed: 1, total: 2, generated_cost: 0.3, segments: [] });
  assert.equal(chapter.generation.completed, 2, "same-job progress never decreases");
  assert.equal(truth().playable, 3);
});
