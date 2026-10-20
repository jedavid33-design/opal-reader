// Run: node --test tests/chapter-truth-projection.test.mjs
// Case #4 (Rowan S1): chapterTruth is an AUDIO-FIRST pure projection.
// Complete N/N whenever every current leaf has valid playable audio —
// regardless of historical job states; otherwise Partial N/N or Not
// started 0/N. Generating / Quota paused / Blocked are current
// annotations that only appear where they still block missing work.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../app-256.js", import.meta.url), "utf8");
const between = (src, a, b) => {
  const i = src.indexOf(a), j = src.indexOf(b, i);
  assert.ok(i >= 0 && j > i, "missing source " + a);
  return src.slice(i, j);
};
const segmentPlayableSrc = between(app, "function segmentPlayable(", "/* Local-only diagnostic");
const truthSrc = between(app, "const chapterJobWatch=new Map();", "// Some blocked pieces are resolved");
const { chapterTruth, knownChapterJobs, noteChapterJob } = new Function(
  "segmentPlayable",
  segmentPlayableSrc + "\n" + truthSrc +
    "\nreturn {chapterTruth, knownChapterJobs, noteChapterJob};",
)(new Function(segmentPlayableSrc + "\nreturn segmentPlayable;")());

const seg = (over = {}) => ({ text: "x", ...over });
const ready = () => seg({ audioKey: "k" });

test("complete chapter: every leaf playable -> Complete N/N", () => {
  const ch = { segments: [ready(), ready(), ready()] };
  const t = chapterTruth(ch, []);
  assert.equal(t.label, "Complete 3/3");
  assert.equal(t.complete, true);
  assert.equal(t.playable, 3);
  assert.equal(t.blocked, 0);
});

test("S1: complete-with-stale-park — a parked job record cannot un-complete a finished chapter", () => {
  const ch = { segments: [ready(), ready()] };
  const jobs = [
    { jobId: "old-parked", state: "paused_quota" },
    { jobId: "old-blocked-job", state: "partial" },
  ];
  const t = chapterTruth(ch, jobs);
  assert.equal(t.label, "Complete 2/2");
  assert.equal(t.quotaPaused, false, "no quota annotation on a complete chapter");
  assert.equal(t.generating, false);
  assert.equal(t.quotaParkedJobId, null);
});

test("partial with blocked: blocked counts MISSING leaves only", () => {
  const ch = {
    segments: [
      ready(),
      seg({ generationBlocked: { error: "Gemini blocked this segment." } }), // missing + blocked
      seg({ audioKey: "k2", generationBlocked: { error: "was blocked" } }), // blocked record but playable audio
      seg({}), // plain missing
      ready(),
    ],
  };
  const t = chapterTruth(ch, []);
  assert.equal(t.playable, 3);
  assert.equal(t.blocked, 1, "the leaf with saved playable audio is not blocked");
  assert.equal(t.missing, 2);
  assert.equal(t.label, "Partial 3/5");
});

test("device-fallback segments count as playable; stale audio does not", () => {
  const ch = {
    segments: [
      seg({ systemVoiceFallback: true }),
      seg({ audioKey: "k", audioStale: true }),
      ready(),
    ],
  };
  const t = chapterTruth(ch, []);
  assert.equal(t.playable, 2);
  assert.equal(t.complete, false);
});

test("annotations reflect CURRENT blockers of missing work", () => {
  const ch = { segments: [ready(), seg({}), seg({})] };
  const parked = chapterTruth(ch, [{ jobId: "p", state: "paused_quota" }]);
  assert.equal(parked.quotaPaused, true);
  assert.equal(parked.quotaParkedJobId, "p");
  const active = chapterTruth(ch, [{ jobId: "q", state: "generating" }]);
  assert.equal(active.generating, true);
  assert.equal(active.quotaPaused, false);
  const none = chapterTruth(ch, [{ jobId: "r", state: "ready" }]);
  assert.equal(none.generating, false);
  assert.equal(none.quotaPaused, false);
});

test("not started: no audio yet", () => {
  const t = chapterTruth({ segments: [seg({}), seg({})] }, []);
  assert.equal(t.label, "Not started 0/2");
  assert.equal(t.playable, 0);
});

test("the Forever Pucked shape: 3/27 with a ready 2/2 repair stays 3/27", () => {
  const segments = Array.from({ length: 27 }, (_, i) =>
    i < 3 ? ready() : seg({}));
  const ch = { segments };
  const jobs = [
    { jobId: "standard-parked", state: "paused_quota" },
    { jobId: "repair-ready", state: "ready" },
  ];
  const t = chapterTruth(ch, jobs);
  assert.equal(t.playable, 3);
  assert.equal(t.total, 27);
  assert.equal(t.label, "Partial 3/27");
  assert.equal(t.quotaPaused, true, "the parked standard job still annotates the missing work");
});

test("knownChapterJobs unions slots and the watchlist (watch wins on fresher state)", () => {
  const ch = {
    segments: [],
    generation: { jobId: "slot-job", state: "queued" },
    replacementGeneration: null,
  };
  noteChapterJob(ch, { job_id: "discovered", state: "paused_quota", chapter_index: 0 });
  noteChapterJob(ch, { job_id: "slot-job", state: "paused_quota", chapter_index: 0 });
  const jobs = knownChapterJobs(ch);
  const byId = new Map(jobs.map((j) => [j.jobId, j]));
  assert.equal(byId.size, 2);
  assert.equal(byId.get("discovered").state, "paused_quota");
  assert.equal(byId.get("slot-job").state, "paused_quota",
    "a watchlist merge can freshen the slot job's known state");
});
