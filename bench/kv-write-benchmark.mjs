// KV write benchmark for the coalescing patch (design v2.1).
//
// Imports BOTH the pre-patch worker (commit 1ad64946, extracted from git
// into a temp file outside the repo tree) and the patched worker in this
// tree, runs identical workloads against identical mock stores, and
// counts KV puts before/after.
//
//   node bench/kv-write-benchmark.mjs
//
// Workloads:
//   A — Finding-Home-shaped Batch session: 30 jobs, 152 segments,
//       chained activation, Batch ops completing on the second poll
//       (the harness's 60s poll cadence matches GEMINI_BATCH_WAIT_MS).
//   B — a 300-segment Standard-path book driven the way Reader actually
//       drives it: a Continue session (30 chapter jobs x 10 segments,
//       chained activation, one job active at a time), with the worker's
//       real Gemini pacing (7s global / 12s segment) on a virtual clock.
//   B-stress — the same book as 30 independent jobs submitted at once
//       through the single-chapter endpoint. Not a real usage pattern
//       (the simultaneous jobs convoy on the global pace stamp), kept as
//       an upper bound.
// Projection: a heavy generation day = A + B + ~10 ordinary
// sync/settings writes; design target band is 150-300 KV writes/day
// (free-plan cap is 1,000/day; Oct 19 measured 1,403 actual).
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  makeHarness,
  makeSegment,
  sha256Hex,
  RELEASE,
  CLIENT_VERSION,
} from "../tests/support/mock-env.mjs";

const T0 = Date.UTC(2026, 9, 19, 18, 0, 0);
const BASELINE_COMMIT = "1ad64946";

const baselineSource = execSync(
  `git show ${BASELINE_COMMIT}:cloudflare-worker.js`,
  { cwd: new URL("..", import.meta.url).pathname, maxBuffer: 16 * 1024 * 1024 },
);
const baselinePath = join(tmpdir(), "kv-bench-baseline-worker.mjs");
writeFileSync(baselinePath, baselineSource);
const baselineWorker = (await import(pathToFileURL(baselinePath).href)).default;
const patchedWorker = (await import("../cloudflare-worker.js")).default;

function breakdown(kv) {
  const byPrefix = {};
  for (const call of kv.putCalls) {
    const prefix = call.key.startsWith("generation:")
      ? "generation:<job>"
      : call.key.startsWith("quota:")
        ? "quota:*"
        : call.key.split(":")[0] + ":*";
    byPrefix[prefix] = (byPrefix[prefix] || 0) + 1;
  }
  return { total: kv.putCalls.length, byPrefix };
}

async function runBatchSession(worker) {
  const h = makeHarness(worker, { clockStart: T0 });
  // 152 segments across 30 jobs: [6, 6, then 5 x 28].
  const sizes = [6, 6, ...Array(28).fill(5)];
  const jobs = sizes.map((count, j) => ({
    job_id: sha256Hex(`bench-batch-job-${j}`),
    book_id: "book-bench-1",
    chapter_index: j,
    generation_mode: "batch",
    generation_release: RELEASE,
    client_version: CLIENT_VERSION,
    segments: Array.from({ length: count }, (_, i) =>
      makeSegment(`bench-batch-${j}-${i}`),
    ),
  }));
  const res = await h.request("/api/generation/continue", {
    method: "POST",
    body: {
      session_id: sha256Hex("bench-batch-session"),
      book_id: "book-bench-1",
      book_title: "Bench",
      jobs,
    },
  });
  if (res.status !== 202) throw new Error(`staging failed: ${res.status}`);
  await h.drain(100000);
  let ready = 0;
  for (const job of jobs) {
    const s = await h.r2.readJson(`generation/status/${job.job_id}.json`);
    if (s?.state === "ready") ready++;
  }
  const result = {
    kv: breakdown(h.kv),
    r2StatusPuts: h.r2.putCount("generation/status/"),
    google: { ...h.google.calls },
    jobsReady: ready,
    jobsTotal: jobs.length,
  };
  h.restore();
  return result;
}

async function runStandardSession(worker) {
  const h = makeHarness(worker, { clockStart: T0 });
  const jobs = Array.from({ length: 30 }, (_, j) => ({
    job_id: sha256Hex(`bench-std-session-job-${j}`),
    book_id: "book-bench-3",
    chapter_index: j,
    generation_release: RELEASE,
    client_version: CLIENT_VERSION,
    segments: Array.from({ length: 10 }, (_, i) =>
      makeSegment(`bench-std-session-${j}-${i}`),
    ),
  }));
  const res = await h.request("/api/generation/continue", {
    method: "POST",
    body: {
      session_id: sha256Hex("bench-std-session"),
      book_id: "book-bench-3",
      book_title: "Bench",
      jobs,
    },
  });
  if (res.status !== 202) throw new Error(`staging failed: ${res.status}`);
  await h.drain(100000);
  let ready = 0;
  for (const job of jobs) {
    const s = await h.r2.readJson(`generation/status/${job.job_id}.json`);
    if (s?.state === "ready") ready++;
  }
  const result = {
    kv: breakdown(h.kv),
    r2StatusPuts: h.r2.putCount("generation/status/"),
    google: { ...h.google.calls },
    jobsReady: ready,
    jobsTotal: jobs.length,
  };
  h.restore();
  return result;
}

async function runStandardBook(worker) {
  const h = makeHarness(worker, { clockStart: T0 });
  const jobIds = [];
  for (let j = 0; j < 30; j++) {
    const jobId = sha256Hex(`bench-std-job-${j}`);
    jobIds.push(jobId);
    const res = await h.request("/api/generation/jobs", {
      method: "POST",
      body: {
        job_id: jobId,
        book_id: "book-bench-2",
        chapter_index: j,
        generation_release: RELEASE,
        client_version: CLIENT_VERSION,
        segments: Array.from({ length: 10 }, (_, i) =>
          makeSegment(`bench-std-${j}-${i}`),
        ),
      },
    });
    if (res.status !== 202) throw new Error(`job ${j} failed: ${res.status}`);
  }
  await h.drain(100000);
  let ready = 0;
  for (const jobId of jobIds) {
    const s = await h.r2.readJson(`generation/status/${jobId}.json`);
    if (s?.state === "ready") ready++;
  }
  const result = {
    kv: breakdown(h.kv),
    r2StatusPuts: h.r2.putCount("generation/status/"),
    google: { ...h.google.calls },
    jobsReady: ready,
    jobsTotal: jobIds.length,
  };
  h.restore();
  return result;
}

const rows = [];
for (const [label, worker] of [
  ["pre-patch (1ad64946)", baselineWorker],
  ["patched (branch)", patchedWorker],
]) {
  const a = await runBatchSession(worker);
  const b = await runStandardSession(worker);
  const stress = await runStandardBook(worker);
  rows.push({ label, a, b, stress });
  console.log(
    `${label}: A ready ${a.jobsReady}/${a.jobsTotal}, B ready ${b.jobsReady}/${b.jobsTotal}, B-stress ready ${stress.jobsReady}/${stress.jobsTotal}`,
  );
}

console.log("\nKV puts by workload (identical mock stores, identical traffic):");
for (const { label, a, b, stress } of rows) {
  console.log(`\n${label}`);
  console.log(
    `  A batch session (30 jobs/152 segs):  total ${String(a.kv.total).padStart(5)}  ${JSON.stringify(a.kv.byPrefix)}  (R2 status puts ${a.r2StatusPuts}, submits ${a.google.batchSubmit}, polls ${a.google.batchPoll})`,
  );
  console.log(
    `  B standard session (30 jobs/300 segs): total ${String(b.kv.total).padStart(5)}  ${JSON.stringify(b.kv.byPrefix)}  (R2 status puts ${b.r2StatusPuts}, interactions ${b.google.interactions})`,
  );
  console.log(
    `  B-stress (30 simultaneous jobs):       total ${String(stress.kv.total).padStart(5)}  ${JSON.stringify(stress.kv.byPrefix)}  (R2 status puts ${stress.r2StatusPuts}, interactions ${stress.google.interactions})`,
  );
}
const [before, after] = rows;
const SYNC_WRITES = 10;
const day = (r, w) => r[w].kv.total + SYNC_WRITES;
console.log(
  `\nProjected generation days (+ ~${SYNC_WRITES} ordinary sync/settings writes; target band 150-300, cap 1,000):`,
);
console.log(
  `  Finding-Home day (A):      pre-patch ${day(before, "a")} -> patched ${day(after, "a")} KV writes`,
);
console.log(
  `  Standard-book day (B):     pre-patch ${day(before, "b")} -> patched ${day(after, "b")} KV writes`,
);
console.log(
  `  Both books in one day:     pre-patch ${day(before, "a") + day(before, "b") - SYNC_WRITES} -> patched ${day(after, "a") + day(after, "b") - SYNC_WRITES} KV writes`,
);
console.log(
  `  Stacked stress day (A + B-stress): patched ${day(after, "a") + day(after, "stress") - SYNC_WRITES} KV writes`,
);
