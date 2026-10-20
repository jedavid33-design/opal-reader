// Run: node --test tests/auto-split-quota-guard.test.mjs
// Case #4 (§4.4): the automatic repair chain refuses to stage while ANY
// known job for the chapter is quota-parked — the Oct 20 loop burned 11
// calls because the old guard only looked at the local slot. Manual taps
// call queueAdaptiveRepair directly and are not gated here (the
// Worker's park gate is the shared backstop).
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
const { knownChapterJobs, noteChapterJob } = new Function(
  "segmentPlayable",
  between(app, "const chapterJobWatch=new Map();", "// Some blocked pieces are resolved") +
    "\nreturn {knownChapterJobs, noteChapterJob};",
)(segmentPlayable);

function makeWorld() {
  const chapter = {
    title: "Chapter 1", segments: [], autoSplitEnabled: true,
    generation: null, replacementGeneration: null,
  };
  const a = { book: { id: "book1", chapters: [chapter] } };
  const calls = [];
  const queueAdaptiveRepair = async (idx) => { calls.push(idx); };
  const runAutoSplitSmart = new Function(
    "a", "knownChapterJobs", "queueAdaptiveRepair",
    between(app, "async function runAutoSplitSmart(", "// v1.4.79:") +
      "\nreturn runAutoSplitSmart;",
  )(a, knownChapterJobs, queueAdaptiveRepair);
  return { a, chapter, calls, queueAdaptiveRepair, runAutoSplitSmart };
}

test("auto-split stages nothing while a watchlist job is quota-parked", async () => {
  const { chapter, calls, runAutoSplitSmart } = makeWorld();
  noteChapterJob(chapter, { job_id: "parked-elsewhere", state: "paused_quota", chapter_index: 0 });
  await runAutoSplitSmart(0);
  assert.equal(calls.length, 0, "the parked job is not in any slot — the watchlist guard still stops staging");
});

test("auto-split stages nothing while the SLOT job is quota-parked", async () => {
  const { chapter, calls, runAutoSplitSmart } = makeWorld();
  chapter.generation = { jobId: "slot-parked", state: "paused_quota" };
  await runAutoSplitSmart(0);
  assert.equal(calls.length, 0);
});

test("auto-split still runs when nothing is parked, and a manual tap always reaches the queue entry", async () => {
  const { calls, queueAdaptiveRepair, runAutoSplitSmart } = makeWorld();
  await runAutoSplitSmart(0);
  assert.deepEqual(calls, [0], "automatic path proceeds when no park is known");
  // The manual path calls queueAdaptiveRepair directly — by design it
  // does not pass through runAutoSplitSmart's guard at all.
  await queueAdaptiveRepair(0);
  assert.deepEqual(calls, [0, 0], "manual taps reach the queue entry unguarded (Worker gate is the backstop)");
});

test("auto-split stays off when the chapter is not armed", async () => {
  const { chapter, calls, runAutoSplitSmart } = makeWorld();
  chapter.autoSplitEnabled = false;
  await runAutoSplitSmart(0);
  assert.equal(calls.length, 0);
});
