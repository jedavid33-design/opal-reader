// Run: node --test tests/repair-chain-foreground-gate.test.mjs
// Case #4 FINAL review — Rowan Blocker 2: multi-plan repairs are
// foreground-dependent. DETERMINATION (see the review packet): the
// follow-on repair PLAN cannot safely be produced by the Worker. The
// plan is computed by the client's adaptiveRepairPlan from the
// chapter state AFTER applyAdaptiveRepair has spliced the previous
// job's pieces in — piece ids are crypto.randomUUID()s minted during
// that client-side splice, the next plan's roots and the
// deterministic job id (tt() over the plan's node cache keys) derive
// from them, the monthly soft-cap gate reads the client-side ledger
// (Ve().spent + a.monthlyCap, with confirm() dialogs on the manual
// path), and the Case #2 server-check adoption assumes ONE
// outstanding repair plan per chapter (the local record stores a
// single repairNodes/repairRoots set; applyAdaptiveRepair refuses a
// status whose segment count differs). The Worker has no book
// mutation path (books sync client -> KV, last-writer-wins) and no
// repair planner. Moving continuation server-side means building
// that planner + book application + ledger on the Worker — the
// larger architectural change, not a focused fix.
//
// These tests DOCUMENT the current behavior precisely:
//  1. Client: while the document is hidden, scheduleAutoSplit does
//     not submit the next plan (the stall); the moment Reader is
//     visible again, the chain submits it (the recovery).
//  2. Worker: job EXECUTION is not the bottleneck — two repair jobs
//     for the same chapter, both submitted up front, complete
//     back-to-back with no client involvement between completions.
// What stalls is plan SUBMISSION, and only for the separate repair
// lane. New generation jobs no longer use this chain at all: since
// Blocker 1, their blocks resolve inline on the Worker.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import worker from "../cloudflare-worker.js";
import {
  makeHarness, makeSegment, sha256Hex, RELEASE, CLIENT_VERSION,
} from "./support/mock-env.mjs";

const app = readFileSync(new URL("../app-256.js", import.meta.url), "utf8");
const between = (src, a, b) => {
  const i = src.indexOf(a), j = src.indexOf(b, i);
  assert.ok(i >= 0 && j > i, "missing source " + a);
  return src.slice(i, j);
};

function makeChainWorld() {
  const queueCalls = [];
  const documentStub = { visibilityState: "hidden" };
  const a = {
    book: {
      id: "book-1",
      chapters: [{
        autoSplitEnabled: true, generation: null,
        replacementGeneration: null, segments: [],
      }],
    },
  };
  const region = between(app,
    "async function runAutoSplitSmart(", "async function runAutoSplit(");
  const { scheduleAutoSplit } = new Function(
    "a", "document", "queueAdaptiveRepair", "knownChapterJobs",
    "setTimeout", "console",
    region + "\nreturn {scheduleAutoSplit};",
  )(
    a, documentStub,
    async (chapterIndex) => { queueCalls.push(chapterIndex); },
    () => [],
    (fn) => { fn(); return 0; },
    console,
  );
  const flush = async () => {
    for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
  };
  return { queueCalls, documentStub, scheduleAutoSplit, flush };
}

test("documented behavior: while Reader is hidden, the next repair plan is NOT submitted", async () => {
  const w = makeChainWorld();
  w.scheduleAutoSplit(0);
  await w.flush();
  assert.deepEqual(w.queueCalls, [],
    "scheduleAutoSplit returns early when document.visibilityState is 'hidden' — " +
    "a repair job can finish on the Worker while its follow-on plan waits");
});

test("documented behavior: when Reader is visible again, the chain submits the next plan", async () => {
  const w = makeChainWorld();
  w.documentStub.visibilityState = "visible";
  w.scheduleAutoSplit(0);
  await w.flush();
  assert.deepEqual(w.queueCalls, [0],
    "the recovery is automatic on the next visible poll/merge cycle — no manual tap needed, " +
    "but Reader must be open and in the foreground");
});

// --- Worker half: execution never needed the client ---------------
const T0 = Date.UTC(2026, 9, 20, 15, 0, 0);
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
const anode = (seed, text, { parent, path, source }) => makeSegment(seed, {
  text, repair_parent: parent, repair_path: path,
  segment_index: source, repair_source_index: source,
});

test("Worker: two repair jobs for one chapter complete back-to-back with NO client involvement between completions", async () => {
  const h = makeHarness(worker, { clockStart: T0 });
  const job1 = sha256Hex("chain-job-1");
  const job2 = sha256Hex("chain-job-2");
  const nodes1 = [
    anode("cj1-l", "chain one left", { parent: -1, path: "L", source: 0 }),
    anode("cj1-r", "chain one right", { parent: -1, path: "R", source: 0 }),
  ];
  const nodes2 = [
    anode("cj2-l", "chain two left", { parent: -1, path: "L", source: 1 }),
    anode("cj2-r", "chain two right", { parent: -1, path: "R", source: 1 }),
  ];
  await postJob(h, job1, nodes1, { adaptive_repair: true, diagnostic_job_kind: "adaptive_repair" });
  await postJob(h, job2, nodes2, { adaptive_repair: true, diagnostic_job_kind: "adaptive_repair" });
  // One drain, no client round-trips in between: both jobs run to
  // completion purely on the Worker. The foreground dependency is in
  // producing/submitting job 2's PLAN (client-side), never in
  // executing an already-submitted job.
  await h.drain();
  assert.equal((await getStatus(h, job1)).state, "ready");
  assert.equal((await getStatus(h, job2)).state, "ready");
  assert.equal(h.google.calls.interactions, 4);
  for (const n of [...nodes1, ...nodes2])
    assert.ok(h.r2.store.has(`audio/${n.cache_key}.wav`), `audio saved for ${n.text}`);
  h.restore();
});
