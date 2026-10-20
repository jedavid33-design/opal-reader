// Run: node --test tests/inline-split-integration.test.mjs
// Case #4 FINAL integration review (Rowan): the unit cases in
// inline-split-client-merge.test.mjs hand-construct local.segmentIndices,
// so they cannot prove the real Generate / Continue / replacement
// workflows provide the root-to-chapter mapping applyInlineSplits
// consumes, nor that a mid-tree quota park cannot shift audio onto the
// wrong text. These tests close that gap: local state is built ONLY by
// the real init functions extracted from app-256.js (Mr = the Generate
// button, generateRestOfChapter, Wr = replacement generation), and
// reconciliation runs through the real lt()/or() wiring. The Worker is
// simulated by transforming the REAL submitted payload into a status
// exactly the way tryInlineGenerationSplit does (split parent entry,
// children spliced pre-order with repair_path / repair_source_index /
// speech_text, child cache keys = sha256(text + voice cfg JSON)).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const app = readFileSync(new URL("../app-256.js", import.meta.url), "utf8");
const between = (src, a, b) => {
  const i = src.indexOf(a), j = src.indexOf(b, i);
  assert.ok(i >= 0 && j > i, "missing source " + a);
  return src.slice(i, j);
};

// Leaf helpers whose behavior does not bear on the mapping logic are
// pinned to their exact app definitions (same treatment the unit suite
// gives plainSpeech): if the app text drifts, these assertions fail
// loudly instead of the harness silently testing a paraphrase.
assert.ok(app.includes('plainSpeech=e=>String(e||"").replace(/<\\/?emphasis>/gi,"")'),
  "client plainSpeech definition is the expected one-liner");
assert.ok(app.includes('tt=async e=>crypto.subtle.digest("SHA-256",new TextEncoder().encode(e))'),
  "client tt is the SHA-256 hex one-liner");
assert.ok(app.includes("function st(e){return a.book?.povs.find(c=>c.name===e)?.voice||a.book?.defaultVoice||null}"),
  "client st() voice lookup is the expected one-liner");
assert.ok(app.includes('function Qr(p,m){return p==="fish"?a.fishModel:p==="openai"?a.openaiModel:p==="gemini"?normalizeGeminiModel(a.geminiModel):m}'),
  "client Qr() model pick is the expected one-liner");
assert.ok(app.includes('Pe=e=>e<=0?"$0.00":e<.01?"<$0.01":`${e.toFixed(2)}`'),
  "client Pe() money format is the expected one-liner");

const PINNED = [
  'const plainSpeech=e=>String(e||"").replace(/<\\/?emphasis>/gi,"");',
  'const tt=async e=>crypto.subtle.digest("SHA-256",new TextEncoder().encode(e)).then(c=>[...new Uint8Array(c)].map(r=>r.toString(16).padStart(2,"0")).join(""));',
  "function st(e){return a.book?.povs.find(c=>c.name===e)?.voice||a.book?.defaultVoice||null}",
  'function normalizeGeminiModel(value){return value==="gemini-3.8-flash-lite-tts"?"gemini-3.8-flash-lite-tts":"gemini-3.8-flash-tts"}',
  'function Qr(p,m){return p==="fish"?a.fishModel:p==="openai"?a.openaiModel:p==="gemini"?normalizeGeminiModel(a.geminiModel):m}',
  'const Pe=e=>e<=0?"$0.00":e<.01?"<$0.01":`${e.toFixed(2)}`;',
].join("\n");

const BODY = [
  PINNED,
  between(app, "function segIdentity(", "function recordGeminiFailure("),
  between(app, "function zt(e){", "function bookCostEstimate("),
  between(app, "function chapterTruth(", "function normalizeCompletedChapterStatus("),
  between(app, "async function qe(", "async function lt("),
  between(app, "function sr(", "// v1.4.92:"),
  between(app, "function isLegacyGeminiInputBlock(", "function or("),
  between(app, "function or(", "function ur("),
  between(app, "function inlineRootEntries(", "function applyInlineSplits("),
  between(app, "function applyInlineSplits(", "function applyAdaptiveRepair("),
  between(app, "async function lt(", "const adaptiveQueueStarting="),
  between(app, "async function Mr(", "async function generateRestOfChapter("),
  between(app, "async function generateRestOfChapter(", "async function Wr("),
  between(app, "async function Wr(", "function queuedSegmentPayload("),
].join("\n");

const LEFT = "Alpha half of the passage stands here, word for word.";
const RIGHT = "Beta half of the passage follows now, unchanged.";
const B_TEXT = "Second original segment.";
const C_TEXT = "Third original segment, not part of the job.";
const MODEL = "gemini-3.8-flash-tts";

const seg = (id, text, extra = {}) => ({
  id, text, speechText: text, pov: "Narrator",
  audioKey: null, audioStale: false, generationFingerprint: null, ...extra,
});

function buildWorld(segments) {
  const voice = {
    provider: "gemini", voice_id: "Zephyr", name: "Zephyr", locale: "en-US",
    model_id: MODEL, style_direction: "",
  };
  const chapter = {
    title: "Chapter 1", pov: "Narrator",
    text: segments.map((s) => s.text).join("\n\n"), segments,
    generation: null, replacementGeneration: null,
    autoSplitEnabled: false, autoSplitPauseReason: null, autoSplitStatus: null,
  };
  const book = {
    id: "book-test", title: "Test Book",
    povs: [{ name: "Narrator", voice }], defaultVoice: voice, chapters: [chapter],
  };
  const a = {
    book, providers: { generation: true }, monthlyCap: 0,
    geminiLane: "standard", geminiModel: MODEL,
    fishModel: "s2.1-pro", openaiModel: "gpt-4o-mini-tts",
    apiBase: "https://worker.test", accessToken: "tok",
  };
  const ledger = { month: "2026-10", spent: 0 };
  const alerts = [];
  let xtBehavior = async () => { throw new Error("xt not configured"); };
  const fns = new Function(
    "a", "crypto", "Ve", "Ae", "pe", "se", "ct", "$e", "xt", "confirm", "alert",
    "recordGeminiFailure", "quotaQueueFailure", "scheduleAutoSplit",
    "GENERATION_RELEASE_ID", "generationReleaseStamp",
    BODY + "\nreturn {Mr,generateRestOfChapter,Wr,lt,or,qe,applyInlineSplits,ensureInlineMapping,chapterTruth,segIdentity};",
  )(
    a, globalThis.crypto,
    () => ledger, async () => {}, async () => {}, () => {}, () => {},
    async () => {}, (...args) => xtBehavior(...args), () => true,
    (m) => alerts.push(String(m)), () => {}, () => false, () => {},
    "test-release/1", () => ({}),
  );
  return {
    a, book, chapter, ledger, alerts, ...fns,
    setXt(fn) { xtBehavior = fn; },
  };
}

// Mirror of the Worker's inline split, applied to the real payload the
// client submitted: root A (payload segment 0) blocked and split into
// LEFT/RIGHT; root B (payload segment 1) is a plain entry.
const sha256 = (s) => createHash("sha256").update(s).digest("hex");
function inlineStatus(payload, { state = "ready", left = "ready", right = "ready", b = "ready" } = {}) {
  const [pA, pB] = payload.segments;
  const cfg = JSON.stringify({
    provider: pA.provider, voice: pA.voice_id, model: pA.model_id,
    rate: 1, style: pA.style_direction || "",
  });
  const fpL = sha256(LEFT + cfg), fpR = sha256(RIGHT + cfg);
  const entries = [
    { cache_key: pA.cache_key, state: "split", repair_path: "", repair_source_index: 0 },
    { cache_key: fpL, state: left, repair_path: "L", repair_source_index: 0, speech_text: LEFT, ...(left === "ready" ? { model: MODEL } : {}) },
    { cache_key: fpR, state: right, repair_path: "R", repair_source_index: 0, speech_text: RIGHT, ...(right === "ready" ? { model: MODEL } : {}) },
    { cache_key: pB.cache_key, state: b, ...(b === "ready" ? { model: MODEL } : {}) },
  ];
  return {
    fpL, fpR, fpA: pA.cache_key, fpB: pB.cache_key,
    status: {
      job_id: payload.job_id, state, inline_split: true,
      completed: entries.filter((x) => x.state === "ready").length, total: 3,
      generated_cost: 0.01, segments: entries,
    },
  };
}

const twoSegWorld = () => buildWorld([
  seg("seg-A", `${LEFT} ${RIGHT}`),
  seg("seg-B", B_TEXT),
]);

// ---------------------------------------------------------------------
// Test A — real client initialization (ordinary Generate via Mr).
// ---------------------------------------------------------------------
test("Test A: ordinary Generate stages segmentIndices itself; the finished inline tree expands with correct per-leaf audio", async () => {
  const world = twoSegWorld();
  let staged = null, built = null;
  world.setXt(async (_base, _token, payload) => {
    staged = JSON.parse(JSON.stringify(world.chapter.generation));
    built = inlineStatus(payload);
    return built.status;
  });
  await world.Mr(0);
  assert.deepEqual(world.alerts, [], "Generate completed without an error alert");
  assert.ok(staged, "Mr staged the record before submitting");
  assert.deepEqual(staged.segmentIndices, [0, 1],
    "the REAL Mr init writes segmentIndices from the payload — the test supplied none");
  assert.equal(staged.segmentKeys.length, 2);
  assert.equal(staged.total, 2);

  const ch = world.chapter;
  assert.equal(ch.segments.length, 3, "root A expanded into its two leaves; B kept its place");
  assert.deepEqual(ch.segments.map((s) => s.text), [LEFT, RIGHT, B_TEXT], "reading order preserved");
  assert.equal(ch.segments[0].id, "seg-A", "first piece keeps the root's stable id");
  assert.equal(ch.segments[0].audioKey, built.fpL, "left leaf carries the left child's audio");
  assert.equal(ch.segments[1].audioKey, built.fpR, "right leaf carries the right child's audio");
  assert.equal(ch.segments[2].audioKey, built.fpB, "B carries B's own audio");
  assert.equal(ch.segments[0].generationFingerprint, built.fpL);
  assert.equal(ch.segments[1].generationFingerprint, built.fpR);
  assert.equal(ch.generation.inlineApplied, true);
  assert.deepEqual(ch.generation.segmentIndices, [0, 0, 1, 2],
    "mapping rebuilt aligned to the full grown status array");
  const truth = world.chapterTruth(ch, [{ jobId: ch.generation.jobId, state: ch.generation.state }]);
  assert.equal(truth.complete, true);
  assert.equal(truth.label, "Complete 3/3", "final count is truthful");

  // Exactly once: reconciling the same finished status again is a no-op.
  const snapshot = JSON.stringify(ch.segments.map((s) => [s.id, s.text, s.audioKey]));
  await world.lt(0, built.status);
  assert.equal(ch.segments.length, 3, "no second expansion");
  assert.equal(JSON.stringify(ch.segments.map((s) => [s.id, s.text, s.audioKey])), snapshot);
});

test("Test A2: replacement generation (real Wr init) stages segmentIndices itself and expands the tree", async () => {
  const world = buildWorld([
    seg("seg-A", `${LEFT} ${RIGHT}`, { audioKey: "old-audio-A", generationFingerprint: "old-fp-A" }),
    seg("seg-B", B_TEXT, { audioKey: "old-audio-B", generationFingerprint: "old-fp-B" }),
  ]);
  let staged = null, built = null;
  world.setXt(async (_base, _token, payload) => {
    staged = JSON.parse(JSON.stringify(world.chapter.replacementGeneration));
    built = inlineStatus(payload);
    return built.status;
  });
  await world.Wr(0);
  assert.ok(staged, "Wr staged the replacement record before submitting");
  assert.deepEqual(staged.segmentIndices, [0, 1],
    "the REAL Wr init writes segmentIndices — the test supplied none");
  const ch = world.chapter;
  assert.equal(ch.generation, null, "the ordinary slot was not touched");
  assert.equal(ch.segments.length, 3);
  assert.deepEqual(ch.segments.map((s) => s.text), [LEFT, RIGHT, B_TEXT]);
  assert.equal(ch.segments[0].audioKey, built.fpL);
  assert.equal(ch.segments[1].audioKey, built.fpR);
  assert.equal(ch.segments[2].audioKey, built.fpB, "B receives the replacement audio, not a child's");
  assert.equal(ch.replacementGeneration.inlineApplied, true);
  assert.deepEqual(ch.replacementGeneration.segmentIndices, [0, 0, 1, 2]);
});

test("Test A3: generate-rest-of-chapter stages the subset mapping (non-contiguous roots)", async () => {
  const world = twoSegWorld();
  const payload = await world.qe(0);
  // Segment A already has current audio, so the real rest-of-chapter
  // path selects only B (chapter index 1).
  world.chapter.segments[0].audioKey = payload.segments[0].cache_key;
  world.chapter.segments[0].generationFingerprint = payload.segments[0].fingerprint;
  let staged = null;
  world.setXt(async (_base, _token, p) => {
    staged = JSON.parse(JSON.stringify(world.chapter.generation));
    return {
      job_id: p.job_id, state: "ready", completed: 1, total: 1, generated_cost: 0.005,
      segments: [{ cache_key: p.segments[0].cache_key, state: "ready", model: MODEL }],
    };
  });
  await world.generateRestOfChapter(0, 0);
  assert.deepEqual(world.alerts, []);
  assert.deepEqual(staged.segmentIndices, [1],
    "the subset job maps its single root to chapter index 1");
  assert.equal(staged.total, 1);
  assert.equal(world.chapter.segments[1].audioKey, payload.segments[1].cache_key,
    "B received its audio through the subset mapping");
  assert.equal(world.chapter.segments[0].audioKey, payload.segments[0].cache_key,
    "A's existing audio untouched");
});

// ---------------------------------------------------------------------
// Test B — mid-tree quota park through the real lt()/or() wiring.
// ---------------------------------------------------------------------
test("Test B: a quota park mid-tree never shifts audio onto the wrong text; Resume rebuilds the tree", async () => {
  const world = twoSegWorld();
  let built = null, submitted = null;
  world.setXt(async (_base, _token, payload) => {
    submitted = payload;
    built = inlineStatus(payload, { state: "paused_quota", left: "ready", right: "queued", b: "queued" });
    return built.status;
  });
  await world.Mr(0);
  const ch = world.chapter;
  assert.equal(ch.generation.state, "paused_quota");
  assert.equal(ch.segments.length, 2, "the tree is NOT expanded while the job is parked");
  assert.equal(ch.segments[0].audioKey, null,
    "the split root must not claim its ready child's audio as its own");
  assert.equal(ch.segments[1].audioKey, null,
    "Rowan's case: B must NEVER receive A-left's audio via the shifted status index");
  assert.ok(!ch.segments.some((s) => s.audioKey === built.fpL),
    "A-left's audio is attributed to no chapter segment while the tree is pending");
  // The saved child audio remains recoverable: its cache key stays
  // bound to its own text on the parked job's stored status.
  const parkedEntry = ch.generation.segments.find((s) => s.repair_path === "L");
  assert.equal(parkedEntry.cache_key, built.fpL);
  assert.equal(parkedEntry.speech_text, LEFT);
  const parkedTruth = world.chapterTruth(ch, [{ jobId: ch.generation.jobId, state: ch.generation.state }]);
  assert.equal(parkedTruth.complete, false, "never a false Complete during the park");
  assert.equal(parkedTruth.playable, 0);
  assert.equal(parkedTruth.total, 2);
  assert.equal(parkedTruth.quotaPaused, true);

  // Resume: the same job finishes. The finished status is rebuilt from
  // the same submitted payload, so its child cache keys are provably
  // the SAME keys whose audio was saved during the park.
  const done = inlineStatus(submitted);
  assert.equal(done.fpL, built.fpL);
  assert.equal(done.fpR, built.fpR);
  await world.lt(0, done.status);
  assert.equal(ch.segments.length, 3);
  assert.deepEqual(ch.segments.map((s) => s.text), [LEFT, RIGHT, B_TEXT]);
  assert.equal(ch.segments[0].audioKey, built.fpL, "the parked child's audio lands on its own text");
  assert.equal(ch.segments[1].audioKey, built.fpR);
  assert.equal(ch.segments[2].audioKey, built.fpB, "B gets B's audio — not A-left's");
  const truth = world.chapterTruth(ch, [{ jobId: ch.generation.jobId, state: ch.generation.state }]);
  assert.equal(truth.complete, true);
  assert.equal(truth.label, "Complete 3/3");
});

test("Test B2: during a mid-tree park, an unsplit root still merges — by job order, not shifted position", async () => {
  const world = twoSegWorld();
  let built = null;
  world.setXt(async (_base, _token, payload) => {
    built = inlineStatus(payload, { state: "paused_quota", left: "ready", right: "queued", b: "ready" });
    return built.status;
  });
  await world.Mr(0);
  const ch = world.chapter;
  assert.equal(ch.segments[1].audioKey, built.fpB,
    "B (status index 3, job root 1) merges through the root mapping");
  assert.equal(ch.segments[0].audioKey, null, "the split root stays unaudioed until expansion");
  const truth = world.chapterTruth(ch, [{ jobId: ch.generation.jobId, state: ch.generation.state }]);
  assert.equal(truth.playable, 1);
  assert.equal(truth.total, 2);
  assert.equal(truth.complete, false);
  assert.equal(truth.quotaPaused, true);
});

// ---------------------------------------------------------------------
// Test C — jobs staged before segmentIndices existed (legacy records).
// ---------------------------------------------------------------------
test("Test C: a legacy record with segmentKeys but NO segmentIndices still applies its split tree", async () => {
  const world = buildWorld([
    seg("seg-A", `${LEFT} ${RIGHT}`),
    seg("seg-B", B_TEXT),
    seg("seg-C", C_TEXT, { audioKey: "key-C-existing", generationFingerprint: "key-C-existing" }),
  ]);
  const ch = world.chapter;
  const cBefore = ch.segments[2];
  const payload = await world.qe(0);
  // A pre-fix staged record: keys + fingerprints for roots A and B only
  // (a subset job), and — the point of this test — no segmentIndices.
  ch.generation = {
    jobId: payload.job_id, state: "generating", completed: 0, total: 2,
    segmentKeys: [world.segIdentity(ch.segments[0], ch.pov), world.segIdentity(ch.segments[1], ch.pov)],
    segmentFingerprints: [payload.segments[0].fingerprint, payload.segments[1].fingerprint],
    recordedCost: 0, error: null, rangeStart: 0,
  };
  assert.equal("segmentIndices" in ch.generation, false, "precondition: the legacy record lacks the mapping");
  const built = inlineStatus(payload);
  await world.lt(0, built.status);
  assert.equal(ch.segments.length, 4, "A expanded; B and C kept their places");
  assert.deepEqual(ch.segments.map((s) => s.text), [LEFT, RIGHT, B_TEXT, C_TEXT]);
  assert.equal(ch.segments[0].audioKey, built.fpL);
  assert.equal(ch.segments[1].audioKey, built.fpR);
  assert.equal(ch.segments[2].audioKey, built.fpB, "no audio discarded in the backfill path");
  assert.equal(ch.segments[3], cBefore, "the unrelated segment object was not rewritten");
  assert.equal(ch.segments[3].audioKey, "key-C-existing", "unrelated audio preserved");
  assert.deepEqual(ch.generation.segmentIndices, [0, 0, 1, 2],
    "the mapping was derived from the staged keys, then rebuilt by the expansion");
  const truth = world.chapterTruth(ch, [{ jobId: ch.generation.jobId, state: ch.generation.state }]);
  assert.equal(truth.complete, true);
  assert.equal(truth.label, "Complete 4/4");
});

test("Test C2: a record with neither keys nor indices backfills from the status cache keys (qe fingerprint match)", async () => {
  const world = twoSegWorld();
  const ch = world.chapter;
  const payload = await world.qe(0);
  // Discovery-shaped record: rebuilt from a status alone, so it holds
  // no staged mapping material at all.
  ch.generation = {
    jobId: payload.job_id, state: "generating", completed: 1, total: 3,
    recordedCost: 0, error: null,
  };
  assert.equal(ch.generation.segmentKeys, undefined);
  assert.equal(ch.generation.segmentIndices, undefined);
  const built = inlineStatus(payload);
  await world.lt(0, built.status);
  assert.equal(ch.segments.length, 3, "the tree still applies via the fingerprint backfill");
  assert.deepEqual(ch.segments.map((s) => s.text), [LEFT, RIGHT, B_TEXT]);
  assert.equal(ch.segments[0].audioKey, built.fpL);
  assert.equal(ch.segments[1].audioKey, built.fpR);
  assert.equal(ch.segments[2].audioKey, built.fpB);
  assert.deepEqual(ch.generation.segmentIndices, [0, 0, 1, 2]);
});

// ---------------------------------------------------------------------
// Test D — or() in isolation: the shift guard holds even without lt().
// ---------------------------------------------------------------------
test("Test D: or() never positionally maps a grown inline status through stale root keys", () => {
  const world = twoSegWorld();
  const ch = world.chapter;
  ch.generation = {
    jobId: "job-d", state: "generating", completed: 0, total: 2,
    segmentKeys: [world.segIdentity(ch.segments[0], ch.pov), world.segIdentity(ch.segments[1], ch.pov)],
    segmentFingerprints: ["fpA", "fpB"], recordedCost: 0, error: null,
  };
  const status = {
    job_id: "job-d", state: "paused_quota", inline_split: true, completed: 2, total: 3,
    segments: [
      { cache_key: "fpA", state: "split", repair_path: "", repair_source_index: 0 },
      { cache_key: "key-L", state: "ready", repair_path: "L", repair_source_index: 0, speech_text: LEFT, model: MODEL },
      { cache_key: "key-R", state: "queued", repair_path: "R", repair_source_index: 0, speech_text: RIGHT },
      { cache_key: "key-B", state: "ready", model: MODEL },
    ],
  };
  world.or(ch, status, {});
  assert.equal(ch.segments[1].audioKey, "key-B", "the unsplit root merges by job-order identity");
  assert.equal(ch.segments[0].audioKey, null);
  assert.ok(!ch.segments.some((s) => s.audioKey === "key-L"),
    "the ready child's audio is deferred, not misattributed");

  // With no mapping material at all, the guard defers everything
  // rather than guessing positions.
  const world2 = twoSegWorld();
  const ch2 = world2.chapter;
  ch2.generation = { jobId: "job-d2", state: "generating", recordedCost: 0 };
  world2.or(ch2, { ...status, job_id: "job-d2" }, {});
  assert.equal(ch2.segments[0].audioKey, null);
  assert.equal(ch2.segments[1].audioKey, null, "no positional guesswork without a mapping");
});
