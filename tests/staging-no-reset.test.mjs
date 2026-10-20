// Run: node --test tests/staging-no-reset.test.mjs
// Case #4 (§4.2): two cooperating rules keep displayed progress honest.
// (1) queueAdaptiveRepair adoption performs NO staging write — the slot
// is only overwritten by lt()'s merge of the server's real status.
// (2) or()'s merge guard: for the same jobId, completed/total never
// decrease.
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

test("or() guard: same jobId never decreases completed/total; increases pass through", () => {
  const ch = {
    pov: "Narrator", segments: [],
    generation: { jobId: "job-1", state: "generating", completed: 5, total: 10 },
  };
  orMerge(ch, { job_id: "job-1", state: "generating", completed: 2, total: 8, segments: [] });
  assert.equal(ch.generation.completed, 5, "completed held against a stale lower merge");
  assert.equal(ch.generation.total, 10, "total held too");
  orMerge(ch, { job_id: "job-1", state: "generating", completed: 7, total: 10, segments: [] });
  assert.equal(ch.generation.completed, 7, "real progress still lands");
});

test("or() guard: a different jobId may still replace the slot (it is only a display cache)", () => {
  const ch = {
    pov: "Narrator", segments: [],
    generation: { jobId: "job-1", state: "ready", completed: 10, total: 10 },
  };
  orMerge(ch, { job_id: "job-2", state: "queued", completed: 0, total: 2, segments: [] });
  assert.equal(ch.generation.jobId, "job-2");
  assert.equal(ch.generation.completed, 0, "the guard is per-job, not global");
});

test("queueAdaptiveRepair adoption: no staging overwrite, ever", async () => {
  const queueSrc = between(app, "async function queueAdaptiveRepair(", "// v1.4.79:");
  const REPAIR_ID = "c".repeat(64);
  const chapter = {
    title: "Chapter 1", pov: "Narrator",
    segments: [{ id: "s0", text: "t", generationBlocked: { error: "x" } }],
    // The slot currently holds the chapter's PARKED standard job.
    generation: {
      jobId: "d".repeat(64), state: "paused_quota", completed: 1, total: 26,
      recordedCost: 0.05,
    },
    replacementGeneration: null,
    autoSplitEnabled: true, autoSplitPauseReason: null, autoSplitStatus: null,
  };
  const book = { id: "book1", title: "Book", chapters: [chapter] };
  const a = {
    book, monthlyCap: 0, providers: { generation: true },
    apiBase: "https://worker.test", accessToken: "tok",
  };
  const peSnapshots = [];
  const calls = { xt: [], lt: [] };
  const queueAdaptiveRepair = new Function(
    "a", "adaptiveQueueStarting", "adaptiveWorkerReady", "splitBlockedSegment", "runAutoSplit",
    "adaptiveRepairPlan", "Ve", "tt", "kr", "xt", "lt", "pe", "se", "ct", "$e",
    "GENERATION_RELEASE_ID", "confirm", "alert",
    queueSrc + "return queueAdaptiveRepair;",
  )(
    a, new Set(), async () => true,
    () => { throw new Error("local split fallback must not run"); },
    () => { throw new Error("legacy auto-split must not run"); },
    async () => ({ nodes: [{ cache_key: "n1", estimated_cost: 0.1 }], roots: [{ index: 0 }] }),
    () => ({ month: "2026-10", spent: 0 }),
    async () => REPAIR_ID,
    async (_base, _token, id) => ({
      job_id: id, state: "generating", completed: 1, total: 2, generated_cost: 0.2, segments: [],
    }),
    async (_base, _token, payload) => { calls.xt.push(payload); throw new Error("must not submit"); },
    async (idx, status) => { calls.lt.push([idx, status]); },
    async () => { peSnapshots.push({ ...chapter.generation }); },
    () => {}, () => {},
    async () => {},
    "1.4.42/1.4.116",
    () => true,
    () => {},
  );
  await queueAdaptiveRepair(0);
  assert.equal(calls.xt.length, 0, "adopted, not submitted");
  assert.equal(calls.lt.length, 1, "the server status was adopted through lt");
  // No pe() snapshot may show a staging record: the parked job's slot
  // fields (state/completed/total) were never reset by queueAdaptiveRepair
  // itself. (The mapping-context merge touches scope/nodes/roots only.)
  for (const snap of peSnapshots) {
    assert.notEqual(snap.state, "queued", "no staging state was written before adoption");
    assert.equal(snap.completed, 1, "completed was never reset to 0");
    assert.equal(snap.total, 26, "total was never reset to roots*2");
  }
  // The repair mapping context IS present for applyAdaptiveRepair.
  assert.equal(chapter.generation.scope, "background_repair");
  assert.equal(chapter.generation.jobId, REPAIR_ID);
  assert.equal(chapter.generation.recordedCost, 0.2, "Case #2's ledger seed rode along");
});
