// Run: node --test tests/generation-inline-ordering.test.mjs
// Case #4 FINAL review — Rowan Blocker 1: strict split-before-advance
// in the REAL generation path (not the separate repair lane). An
// ordinary generation job that hits a POLICY_BLOCK now splits the
// segment inline, on the Worker, and drains the whole split tree
// depth-first BEFORE the next original segment is attempted — for
// Standard and Batch jobs alike. These are behavior-level proofs
// against the real Worker module: the provider-call ORDER is the
// assertion, exactly as Rowan specified.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import worker from "../cloudflare-worker.js";
import {
  makeHarness, makeSegment, sha256Hex, jsonResponse, RELEASE, CLIENT_VERSION,
} from "./support/mock-env.mjs";

const T0 = Date.UTC(2026, 9, 20, 15, 0, 0);
const PARK_KEY = "quota/gemini-park.json";
const workerSrc = readFileSync(new URL("../cloudflare-worker.js", import.meta.url), "utf8");
const appSrc = readFileSync(new URL("../app-256.js", import.meta.url), "utf8");

// The split helpers the Worker uses, extracted from the Worker source
// itself, so expected pieces always track the shipped implementation.
const grabSplits = (src) => {
  const i = src.indexOf("function naturalBlockedSplitPoint");
  assert.ok(i >= 0, "split functions present");
  const j = src.indexOf("[left.trim(),right.trim()];", i);
  const k = src.indexOf("\n}", j) + 2;
  return src.slice(i, k);
};
const { naturalBlockedSplitPoint, splitSpeechMarkup } = new Function(
  grabSplits(workerSrc) +
  "\nreturn {naturalBlockedSplitPoint, splitSpeechMarkup};",
)();
const plain = (t) => String(t || "").replace(/<\/?emphasis>/gi, "");
const halvesOf = (text) => {
  const cut = naturalBlockedSplitPoint(plain(text));
  assert.ok(cut >= 0, "test text must be splittable");
  return splitSpeechMarkup(text, cut);
};

const policy400 = () => jsonResponse({
  error: {
    message: "Request blocked: the input was blocked because it violates the Generative AI Prohibited Use Policy.",
    status: "INVALID_ARGUMENT",
  },
}, 400);
const daily429 = () => jsonResponse({
  error: {
    message: "Quota exceeded for quota metric 'GenerateRequestsPerDayPerProjectPerModel' and limit: 100 for project.",
    status: "RESOURCE_EXHAUSTED",
    details: [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "3600s" }],
  },
}, 429);

function scripted(script) {
  const calls = [];
  const onInteractions = async (_n, init) => {
    let text = "";
    try {
      const body = JSON.parse(init?.body || "{}");
      text = body?.input?.[0]?.content?.[0]?.text || "";
    } catch { /* leave empty */ }
    calls.push(text);
    return script(text, calls.length);
  };
  return { calls, onInteractions };
}
async function postJob(h, jobId, segments, extra = {}) {
  const res = await h.request("/api/generation/jobs", {
    method: "POST",
    body: {
      job_id: jobId, book_id: "book-test-1", chapter_index: 0,
      generation_release: RELEASE, client_version: CLIENT_VERSION,
      segments, ...extra,
    },
  });
  return { status: res.status, body: await res.json() };
}
const getStatus = async (h, jobId) =>
  (await h.request(`/api/generation/jobs/${jobId}`)).json();
// Standard generation segments exactly as the client's qe() builds
// them (segment_index = chapter position).
const seg = (seed, text, index, extra = {}) =>
  makeSegment(seed, { text, segment_index: index, ...extra });

// One sentence of ~97 chars; roots are built from whole sentences so
// natural boundaries land on sentence breaks.
const sent = (tag, words = 15) =>
  `${tag} ${Array.from({ length: words }, () => "lorem").join(" ")}. `;
const passage = (tag, sentences) =>
  Array.from({ length: sentences }, (_, i) => sent(`${tag}${i}`)).join("");

test("parity: the Worker's split functions are the client's, verbatim", () => {
  assert.equal(grabSplits(workerSrc), grabSplits(appSrc),
    "naturalBlockedSplitPoint + splitSpeechMarkup match the client planner exactly");
});

test("(a) Standard: segment 1 blocks -> splits -> all pieces succeed -> ONLY THEN segment 2 generates", async () => {
  const root = passage("A", 4); // ~388 chars
  const [L, R] = halvesOf(root);
  const seg2 = "Second original segment, short and clean.";
  const s = scripted((text) => text === root ? policy400() : undefined);
  const h = makeHarness(worker, { clockStart: T0, fetchBehavior: { onInteractions: s.onInteractions } });
  const jobId = sha256Hex("inline-a");
  await postJob(h, jobId, [seg("ia-1", root, 0), seg("ia-2", seg2, 1)]);
  await h.drain();
  const status = await getStatus(h, jobId);
  assert.deepEqual(s.calls, [root, L, R, seg2],
    "provider-call ORDER: the blocked root's pieces resolve before segment 2 is attempted");
  assert.equal(status.state, "ready");
  assert.equal(status.inline_split, true);
  assert.equal(status.segments[0].state, "split");
  assert.equal(status.segments[0].repair_path, "");
  assert.equal(status.segments[0].repair_source_index, 0);
  assert.equal(status.segments[1].state, "ready");
  assert.equal(status.segments[1].repair_path, "L");
  assert.equal(status.segments[1].repair_source_index, 0);
  assert.equal(status.segments[1].speech_text, L);
  assert.equal(status.segments[2].state, "ready");
  assert.equal(status.segments[2].repair_path, "R");
  assert.equal(status.segments[3].state, "ready");
  assert.equal(status.total, 3, "total counts leaves, not the split parent");
  assert.equal(status.completed, 3);
  assert.ok(h.r2.store.has(`audio/${status.segments[1].cache_key}.wav`), "left piece audio saved");
  assert.ok(h.r2.store.has(`audio/${status.segments[2].cache_key}.wav`), "right piece audio saved");
  // The split tree is durable in the job payload itself (a later
  // delivery — or a resume after a park — re-reads it from R2).
  const payload = await h.r2.readJson(`generation/jobs/${jobId}.json`);
  assert.equal(payload.inline_split, true);
  assert.equal(payload.segments.length, 4);
  assert.equal(payload.segments[1].repair_path, "L");
  assert.equal(payload.segments[2].repair_path, "R");
  h.restore();
});

test("(b) nested: a split child blocks again -> subdivides -> completes before the next original segment", async () => {
  const root = passage("B", 8); // ~776 chars
  const [L, R] = halvesOf(root); // ~388 each
  const [LL, LR] = halvesOf(L); // ~194 each
  const seg2 = "The next original segment waits its turn.";
  const blocked = new Set([root, L]);
  const s = scripted((text) => blocked.has(text) ? policy400() : undefined);
  const h = makeHarness(worker, { clockStart: T0, fetchBehavior: { onInteractions: s.onInteractions } });
  const jobId = sha256Hex("inline-b");
  // No segment_index on purpose: the Worker must still stamp a
  // consistent repair_source_index (payload-position fallback).
  await postJob(h, jobId, [
    makeSegment("ib-1", { text: root }), makeSegment("ib-2", { text: seg2 }),
  ]);
  await h.drain();
  const status = await getStatus(h, jobId);
  assert.deepEqual(s.calls, [root, L, LL, LR, R, seg2],
    "depth-first: grandchildren finish before the parent's sibling AND before segment 2");
  assert.equal(status.state, "ready");
  assert.deepEqual(status.segments.map((x) => x.state),
    ["split", "split", "ready", "ready", "ready", "ready"]);
  assert.deepEqual(status.segments.map((x) => x.repair_path),
    ["", "L", "LL", "LR", "R", undefined]);
  assert.equal(status.total, 4);
  h.restore();
});

test("(c) irreducible leaf mid-chapter: marked blocked for fallback, job advances past it only after the tree is exhausted", async () => {
  const rootA = passage("C", 5); // ~485 chars -> halves ~194 / ~291
  const [L, R] = halvesOf(rootA);
  assert.ok(plain(L).length >= 140 && plain(L).length < 280,
    "the left child is a genuine leaf: too small to split further");
  const segB = "A later original segment still generates.";
  const blocked = new Set([rootA, L]);
  const s = scripted((text) => blocked.has(text) ? policy400() : undefined);
  const h = makeHarness(worker, { clockStart: T0, fetchBehavior: { onInteractions: s.onInteractions } });
  const jobId = sha256Hex("inline-c");
  await postJob(h, jobId, [seg("ic-1", rootA, 0), seg("ic-2", segB, 1)]);
  await h.drain();
  const status = await getStatus(h, jobId);
  assert.deepEqual(s.calls, [rootA, L, R, segB],
    "the tree is exhausted (L irreducible, R done) before segment B is attempted");
  assert.equal(status.state, "partial", "chapter truth stays Partial — never faked complete");
  assert.equal(status.blocked, 1);
  assert.equal(status.segments[0].state, "split");
  const leaf = status.segments[1];
  assert.equal(leaf.state, "blocked");
  assert.equal(leaf.repair_path, "L", "the blocked leaf carries its tree position for the client");
  assert.equal(leaf.repair_source_index, 0);
  assert.equal(leaf.speech_text, L);
  assert.equal(leaf.block_reason, "POLICY_BLOCK");
  assert.equal(status.segments[2].state, "ready");
  assert.equal(status.segments[3].state, "ready", "later segments still generate");
  h.restore();
});

test("(c2) a short unsplittable segment behaves exactly as before: blocked, advance, no tree invented", async () => {
  const short = passage("S", 2); // ~194 chars but halves would be <140
  assert.equal(naturalBlockedSplitPoint(plain(short)), -1, "no safe split exists");
  const next = "Segment after the short blocked one.";
  const s = scripted((text) => text === short ? policy400() : undefined);
  const h = makeHarness(worker, { clockStart: T0, fetchBehavior: { onInteractions: s.onInteractions } });
  const jobId = sha256Hex("inline-c2");
  await postJob(h, jobId, [seg("ic2-1", short, 0), seg("ic2-2", next, 1)]);
  await h.drain();
  const status = await getStatus(h, jobId);
  assert.deepEqual(s.calls, [short, next]);
  assert.equal(status.state, "partial");
  assert.equal(status.segments[0].state, "blocked");
  assert.equal(status.segments[0].repair_path, undefined, "legacy shape: no inline metadata");
  assert.equal(status.inline_split, undefined);
  assert.equal(status.segments[1].state, "ready");
  h.restore();
});

test("(d) quota mid-tree: a daily 429 during inline splitting parks everything, tree + prior audio preserved, no further dispatches", async () => {
  const root = passage("D", 8);
  const [L, R] = halvesOf(root);
  const seg2 = "Never attempted in this run.";
  const s = scripted((text) => {
    if (text === root) return policy400();
    if (text === R) return daily429();
    return undefined;
  });
  const h = makeHarness(worker, { clockStart: T0, fetchBehavior: { onInteractions: s.onInteractions } });
  const jobId = sha256Hex("inline-d");
  await postJob(h, jobId, [seg("id-1", root, 0), seg("id-2", seg2, 1)]);
  await h.drain();
  const status = await getStatus(h, jobId);
  assert.equal(status.state, "paused_quota");
  assert.deepEqual(s.calls, [root, L, R],
    "the park stopped the process — no dispatch after the 429");
  assert.equal(h.google.calls.interactions, 3);
  assert.equal(status.segments[0].state, "split", "tree structure preserved through the park");
  assert.equal(status.segments[1].state, "ready");
  assert.ok(h.r2.store.has(`audio/${status.segments[1].cache_key}.wav`),
    "audio generated before the 429 is preserved");
  assert.equal(status.segments[2].state, "queued", "the 429'd child waits, undamaged");
  assert.equal(status.segments[2].repair_path, "R");
  assert.equal(status.segments[3].state, "queued", "the next original segment is untouched");
  const park = await h.r2.readJson(PARK_KEY);
  assert.ok(park && park.scope === "daily", "the shared project park was written");
  const payload = await h.r2.readJson(`generation/jobs/${jobId}.json`);
  assert.equal(payload.segments.length, 4, "the persisted payload carries the whole tree");
  assert.equal(payload.inline_split, true);
  h.restore();
});

test("(e) Batch: a blocked root splits inside the batch job's own lifecycle; pieces submit in order before the next segment", async () => {
  const root = passage("E", 4);
  const [L, R] = halvesOf(root);
  const seg2 = "Batch segment two, submitted last.";
  const submissions = [];
  const h = makeHarness(worker, {
    clockStart: T0,
    fetchBehavior: {
      onBatchSubmit: async (_n, init) => {
        try {
          const body = JSON.parse(init?.body || "{}");
          submissions.push(
            body?.batch?.input_config?.requests?.requests?.[0]?.request
              ?.contents?.[0]?.parts?.[0]?.text || "");
        } catch { submissions.push(""); }
        return undefined; // default: accepted as batches/opN in order
      },
      onBatchPoll: async (name) => {
        if (name !== "batches/op1") return undefined;
        return jsonResponse({
          name, done: true, metadata: { state: "BATCH_STATE_SUCCEEDED" },
          response: {
            inlinedResponses: {
              inlinedResponses: [{
                error: {
                  message: "PROHIBITED_CONTENT: the prompt was blocked by safety filters.",
                  status: "INVALID_ARGUMENT",
                },
              }],
            },
          },
        });
      },
    },
  });
  const jobId = sha256Hex("inline-e");
  await postJob(h, jobId, [seg("ie-1", root, 0), seg("ie-2", seg2, 1)],
    { generation_mode: "batch" });
  await h.drain();
  const status = await getStatus(h, jobId);
  assert.deepEqual(submissions, [root, L, R, seg2],
    "Batch submission ORDER: root, its two pieces in order, then — and only then — segment 2");
  assert.equal(h.google.calls.batchSubmit, 4);
  assert.equal(status.state, "ready");
  assert.equal(status.inline_split, true);
  assert.equal(status.segments[0].state, "split");
  assert.equal(status.segments[1].state, "ready");
  assert.equal(status.segments[1].repair_path, "L");
  assert.equal(status.segments[2].state, "ready");
  assert.equal(status.segments[2].repair_path, "R");
  assert.equal(status.segments[3].state, "ready");
  h.restore();
});
