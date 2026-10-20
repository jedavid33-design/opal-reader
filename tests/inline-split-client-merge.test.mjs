// Run: node --test tests/inline-split-client-merge.test.mjs
// Case #4 FINAL review — Rowan Blocker 1, client half. When a Worker
// generation job resolves blocks inline, its finished status carries
// the split tree. applyInlineSplits expands the chapter root into the
// tree's terminal leaves (the same chapter surgery adaptive repairs
// get), rebuilds the local record's segment mapping onto the FULL
// status array, and the ordinary or() merge then applies every leaf's
// result exactly. The integrity check (leaves' joined text must
// reproduce the original passage) runs before any mutation.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../app-256.js", import.meta.url), "utf8");
const between = (src, a, b) => {
  const i = src.indexOf(a), j = src.indexOf(b, i);
  assert.ok(i >= 0 && j > i, "missing source " + a);
  return src.slice(i, j);
};
// plainSpeech is one link of a minified const chain in the app; pin
// its exact source text, then use the identical definition here.
assert.ok(app.includes('plainSpeech=e=>String(e||"").replace(/<\\/?emphasis>/gi,"")'),
  "client plainSpeech definition is the expected one-liner");
const plainSpeech = (e) => String(e || "").replace(/<\/?emphasis>/gi, "");
const segmentPlayable = new Function(
  between(app, "function segmentPlayable(", "/* Local-only diagnostic") +
    "\nreturn segmentPlayable;",
)();
const { segIdentity, geminiRootInfo } = new Function(
  between(app, "function segIdentity(", "function recordGeminiFailure(") +
  "\nreturn {segIdentity, geminiRootInfo};",
)();
const applyInlineSplits = new Function(
  "segIdentity", "plainSpeech", "geminiRootInfo", "crypto",
  between(app, "function applyInlineSplits(", "function applyAdaptiveRepair(") +
  "\nreturn applyInlineSplits;",
)(segIdentity, plainSpeech, geminiRootInfo, crypto);
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
)(segmentPlayable, segIdentity, () => {}, chapterPlaybackReady);

const LEFT = "Alpha half of the passage stands here, word for word.";
const RIGHT = "Beta half of the passage follows now, unchanged.";
const MODEL = "gemini-3.8-flash-tts";

function makeWorld({ tamper = false, nested = false } = {}) {
  const root0 = {
    id: "root-0", text: `${LEFT} ${RIGHT}`, speechText: `${LEFT} ${RIGHT}`,
    pov: "Narrator", audioKey: null, audioStale: false,
    generationFingerprint: "fp-root0",
  };
  const root1 = {
    id: "root-1", text: "Second original segment.", speechText: "Second original segment.",
    pov: "Narrator", audioKey: null, audioStale: false,
    generationFingerprint: "fp-root1",
  };
  const ch = {
    title: "Chapter 1", pov: "Narrator", text: `${root0.text}\n\n${root1.text}`,
    segments: [root0, root1], generation: null, replacementGeneration: null,
  };
  const local = {
    jobId: "job-inline-1",
    segmentIndices: [0, 1],
    segmentKeys: [segIdentity(root0, ch.pov), segIdentity(root1, ch.pov)],
    segmentFingerprints: ["fp-root0", "fp-root1"],
  };
  let segments;
  if (nested) {
    const LL = "Alpha quarter one of the passage, intact.";
    const LR = "Alpha quarter two of the passage, intact.";
    root0.text = root0.speechText = `${LL} ${LR} ${RIGHT}`;
    segments = [
      { cache_key: "key-root0", state: "split", repair_path: "", repair_source_index: 0 },
      { cache_key: "key-L", state: "split", repair_path: "L", repair_source_index: 0 },
      { cache_key: "key-LL", state: "ready", repair_path: "LL", repair_source_index: 0, speech_text: LL, model: MODEL },
      { cache_key: "key-LR", state: "ready", repair_path: "LR", repair_source_index: 0, speech_text: LR, model: MODEL },
      { cache_key: "key-R", state: "ready", repair_path: "R", repair_source_index: 0, speech_text: RIGHT, model: MODEL },
      { cache_key: "key-root1", state: "ready", model: MODEL },
    ];
    local.segmentKeys = [segIdentity(root0, ch.pov), segIdentity(root1, ch.pov)];
  } else {
    segments = [
      { cache_key: "key-root0", state: "split", repair_path: "", repair_source_index: 0 },
      { cache_key: "key-L", state: "ready", repair_path: "L", repair_source_index: 0, speech_text: LEFT, model: MODEL },
      { cache_key: "key-R", state: "blocked", repair_path: "R", repair_source_index: 0, speech_text: tamper ? RIGHT.replace("unchanged", "tampered") : RIGHT, error: "Gemini blocked this small piece.", block_reason: "POLICY_BLOCK", finish_reason: "HTTP_400", model: MODEL },
      { cache_key: "key-root1", state: "ready", model: MODEL },
    ];
  }
  const status = {
    state: "partial", inline_split: true, job_id: "job-inline-1", segments,
  };
  return { ch, local, status, root0, root1 };
}

test("a finished inline job expands the root into its leaves and or() applies every result", () => {
  const { ch, local, status } = makeWorld();
  assert.equal(applyInlineSplits(ch, local, status), true);
  assert.equal(ch.segments.length, 3, "root replaced by its two leaves; root 2 untouched in place");
  const [p0, p1, p2] = ch.segments;
  assert.equal(p0.id, "root-0", "the first piece keeps the root's stable id");
  assert.equal(p0.text, LEFT);
  assert.equal(p0.speechText, LEFT);
  assert.equal(p0.audioKey, "key-L");
  assert.equal(p0.generationFingerprint, "key-L");
  assert.equal(p0.blockRootId, "root-0");
  assert.equal(p1.text, RIGHT);
  assert.equal(p1.blockRootId, "root-0");
  assert.equal(p1.splitExhausted, true, "the blocked leaf is marked for the fallback flow");
  assert.equal(p1.generationBlocked.jobId, "job-inline-1");
  assert.equal(p1.generationBlocked.blockReason, "POLICY_BLOCK");
  assert.equal(p2.id, "root-1");
  // The local mapping is rebuilt aligned to the FULL status array.
  assert.deepEqual(local.segmentIndices, [0, 0, 1, 2]);
  assert.deepEqual(local.segmentFingerprints, ["fp-root0", "key-L", "key-R", "fp-root1"]);
  assert.deepEqual(local.segmentKeys, [
    segIdentity(p0, ch.pov), segIdentity(p0, ch.pov),
    segIdentity(p1, ch.pov), segIdentity(p2, ch.pov),
  ]);
  assert.equal(local.inlineApplied, true);
  assert.equal(applyInlineSplits(ch, local, status), false, "expansion is one-shot");

  // Now the ordinary merge must apply every leaf exactly (audio on
  // the ready leaf and on root 2; the blocked leaf stays blocked).
  ch.generation = local;
  orMerge(ch, status, {});
  assert.equal(ch.segments[0].audioKey, "key-L");
  assert.equal(ch.segments[1].generationBlocked.jobId, "job-inline-1");
  assert.equal(ch.segments[1].audioKey, null);
  assert.equal(ch.segments[2].audioKey, "key-root1");
});

test("integrity: leaves whose text does not reproduce the passage change NOTHING", () => {
  const { ch, local, status } = makeWorld({ tamper: true });
  const before = JSON.stringify(ch.segments);
  assert.equal(applyInlineSplits(ch, local, status), false);
  assert.equal(JSON.stringify(ch.segments), before, "chapter untouched on mismatch");
  assert.deepEqual(local.segmentIndices, [0, 1], "mapping untouched on mismatch");
  assert.equal(local.inlineApplied, undefined);
});

test("nested trees expand to their terminal leaves in reading order", () => {
  const { ch, local, status } = makeWorld({ nested: true });
  assert.equal(applyInlineSplits(ch, local, status), true);
  assert.equal(ch.segments.length, 4, "three leaves + the untouched second root");
  assert.deepEqual(ch.segments.slice(0, 3).map((s) => s.text), [
    "Alpha quarter one of the passage, intact.",
    "Alpha quarter two of the passage, intact.",
    "Beta half of the passage follows now, unchanged.",
  ]);
  assert.ok(ch.segments.slice(0, 3).every((s) => s.audioKey),
    "every leaf carries its audio key");
  // Status order: root(split), L(split), LL, LR, R, root1 -> the two
  // split parents point at the first piece; leaves at their pieces.
  assert.deepEqual(local.segmentIndices, [0, 0, 0, 1, 2, 3]);
  assert.deepEqual(local.segmentFingerprints,
    ["fp-root0", null, "key-LL", "key-LR", "key-R", "fp-root1"]);
  ch.generation = local;
  orMerge(ch, status, {});
  assert.equal(ch.segments[3].audioKey, "key-root1");
});

test("a non-inline status is ignored (repair jobs and legacy jobs keep their own paths)", () => {
  const { ch, local, status } = makeWorld();
  delete status.inline_split;
  assert.equal(applyInlineSplits(ch, local, status), false);
  assert.equal(ch.segments.length, 2);
});
