// Run with: node --test tests/cap-pause-rearm.test.mjs
// Case #2 (Opal Roundtable): cap-paused auto-repair re-arm.
// A chapter paused by the monthly soft cap stores WHY it paused in
// autoSplitPauseReason; the segment modal derives the cap presentation
// from live settings instead of trusting the persisted banner, which
// went stale the moment the cap changed.
//
// Review revisions (Rowan, PR #6):
//  1. Resume's duplicate protection is Worker-anchored: queueAdaptiveRepair
//     looks up the deterministic job's real status (kr) before submitting,
//     adopts/reconciles any non-failed server job, and fails closed when
//     the lookup is uncertain.
//  2. The banner never claims cap eligibility: capRepairPause reports a
//     BASE forecast (blocked passages once each) plus overCap (base alone
//     busts the cap). The full repair-tree check stays at queue time.
//  3. No Resume affordance without repairable blocked work, and the
//     derivation cannot throw on unresolvable voices.
//
// Re-review fix (Rowan, PR #6): adopting or restarting a job the Worker
// already holds seeds the local record's recordedCost from the server
// status's cumulative generated_cost, so lt()'s delta math never
// credits the same job's spend into the shared monthly ledger twice.
// The ledger tests at the bottom drive the REAL lt() to prove it.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../app-256.js", import.meta.url), "utf8");
const indexHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");

function extract(source, start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a, "Missing " + start);
  return source.slice(a, b);
}

const helpers = extract(app, "function effectivePauseReason(", "async function queueAdaptiveRepair(");

// Mutable stand-ins for the app's settings/usage so each case controls
// the cap and the month's spent ledger independently.
const settings = { monthlyCap: 50 };
const usage = { spent: 0 };
// Same shape as the app's segmentVoice: a segment whose cast entry is
// gone throws (the app's st() dereferences the book's pov list).
const segmentVoiceStub = (ch, seg) => {
  if (seg.voiceMissing) throw new Error("cast voice unavailable");
  return seg.voice || null;
};
// Same shape as the app's gemini400Blocked: blocked marker, then the
// voice is resolved INTERNALLY (so its throw escapes this function —
// the exact hazard capRepairPause must contain).
const gemini400BlockedStub = (ch, seg) => {
  if (!seg?.blocked) return false;
  const v = segmentVoiceStub(ch, seg);
  return v?.provider === "gemini" || !!seg.geminiModel;
};
const { effectivePauseReason, capRepairPause } = new Function(
  "gemini400Blocked", "segmentVoice", "He", "plainSpeech", "naturalBlockedSplitPoint", "Ve", "a",
  helpers + "return {effectivePauseReason, capRepairPause};",
)(
  gemini400BlockedStub,
  segmentVoiceStub,
  // Same shape as the app's He: chars per million at the voice's rate.
  (chars, voice) => chars / 1e6 * voice.rate,
  (s) => String(s ?? ""),
  // Same shape as the app's split-point search: a safe cut needs at
  // least 140 characters on both sides.
  (text) => (text.length >= 280 ? 140 : -1),
  () => ({ month: "2026-10", spent: usage.spent }),
  settings,
);

const CAP_BANNER = "Background repair paused at your monthly soft cap.";
const blockedSeg = (chars, rate = 15) => ({
  blocked: true,
  text: "x".repeat(chars),
  voice: { provider: "gemini", rate },
});
const capChapter = (segments) => ({
  autoSplitEnabled: false,
  autoSplitPauseReason: "cap",
  autoSplitStatus: CAP_BANNER,
  segments,
});

test("legacy cap banner (no stored reason) maps to cap and surfaces when work exists", () => {
  const legacy = { autoSplitEnabled: false, autoSplitStatus: CAP_BANNER, segments: [blockedSeg(1000)] };
  assert.equal(effectivePauseReason(legacy), "cap");
  assert.ok(capRepairPause(legacy), "legacy cap pause with repairable work must surface the derived presentation");
});

test("legacy cap banner with NO blocked work derives no affordance (migration gate)", () => {
  // Review fix 3: the agreed legacy migration requires the chapter to
  // actually have blocked segments. Reason still resolves to "cap";
  // the Resume affordance does not appear.
  const legacy = { autoSplitEnabled: false, autoSplitStatus: CAP_BANNER, segments: [] };
  assert.equal(effectivePauseReason(legacy), "cap");
  assert.equal(capRepairPause(legacy), null);
  assert.equal(capRepairPause(capChapter([])), null, "stored cap reason with an empty chapter: no affordance");
  assert.equal(capRepairPause(capChapter([{ blocked: false, text: "x".repeat(1000), voice: { provider: "gemini", rate: 15 } }])), null,
    "no blocked segments: no affordance");
});

test("other legacy banners do not map to cap", () => {
  for (const status of [
    "Automatic splitting stopped. Any queued request will finish, but Reader will not queue further splits.",
    // The legacy split path's cap banner is a different string; per the
    // approved design only the exact repair banner is migrated.
    "Automatic splitting paused at your spending cap. Continue manually if desired.",
    "Automatic splitting paused: Gemini request quota reached.",
    "Generation paused for update. Saved audio is intact; restart manually.",
  ]) {
    const ch = { autoSplitEnabled: false, autoSplitStatus: status, segments: [] };
    assert.equal(effectivePauseReason(ch), null, status);
    assert.equal(capRepairPause(ch), null, status);
  }
});

test("stored reason wins over the banner text", () => {
  const ch = { autoSplitEnabled: false, autoSplitPauseReason: "user", autoSplitStatus: CAP_BANNER, segments: [] };
  assert.equal(effectivePauseReason(ch), "user");
});

test("base forecast sums repairable blocked segments only", () => {
  settings.monthlyCap = 50; usage.spent = 16.43;
  const ch = capChapter([
    blockedSeg(500_000),            // $7.50
    blockedSeg(500_000),            // $7.50
    { blocked: false, text: "x".repeat(900_000), voice: { provider: "gemini", rate: 15 } }, // not blocked: excluded
    { blocked: true, text: "x".repeat(400_000), voice: null },                              // no voice: not repairable
  ]);
  const pause = capRepairPause(ch);
  assert.ok(pause);
  assert.equal(pause.forecast, 15);
  assert.equal(pause.spent, 16.43);
  assert.equal(pause.cap, 50);
  assert.equal(pause.overCap, false);
  assert.ok(!("eligible" in pause), "the helper must not assert cap eligibility (review fix 2)");
});

test("base forecast alone over the cap reports overCap", () => {
  settings.monthlyCap = 20; usage.spent = 16.43;
  const pause = capRepairPause(capChapter([blockedSeg(500_000), blockedSeg(500_000)]));
  assert.ok(pause);
  assert.equal(pause.overCap, true);
});

test("spent plus base forecast exactly at the cap is not overCap", () => {
  settings.monthlyCap = 31.43; usage.spent = 16.43;
  const pause = capRepairPause(capChapter([blockedSeg(500_000), blockedSeg(500_000)]));
  assert.equal(pause.overCap, false);
});

test("cap of zero disables the cap check (never overCap)", () => {
  settings.monthlyCap = 0; usage.spent = 999;
  const pause = capRepairPause(capChapter([blockedSeg(500_000)]));
  assert.equal(pause.overCap, false);
});

test("base forecast can fit the cap while the repair tree does not — helper reports base only", () => {
  // Review fix 2's example, helper half: one blocked passage whose base
  // cost ($10) fits the remaining headroom ($15). The queue-behavior
  // test below drives the same boundary with a repair tree of $20 and
  // shows the queue-time guard — not this helper — making the call.
  settings.monthlyCap = 50; usage.spent = 35;
  const pause = capRepairPause(capChapter([blockedSeg(1_000_000, 10)]));
  assert.ok(pause);
  assert.equal(pause.forecast, 10);
  assert.equal(pause.overCap, false);
});

test("blocked segment whose voice cannot resolve: no throw, no affordance", () => {
  settings.monthlyCap = 50; usage.spent = 0;
  // gemini400Blocked resolves the voice internally, so the throw
  // surfaces there first; the derivation must contain it (review fix 3).
  const missing = { blocked: true, geminiModel: "gemini-3.8-flash-tts", text: "x".repeat(1000), voiceMissing: true };
  let pause;
  assert.doesNotThrow(() => { pause = capRepairPause(capChapter([missing])); });
  assert.equal(pause, null);
});

test("blocked segment with a non-Gemini voice is not repairable work", () => {
  settings.monthlyCap = 50; usage.spent = 0;
  // Blocked under Gemini, voice has since been switched: the repair
  // plan skips it, so the affordance gate must too.
  const switched = { blocked: true, geminiModel: "gemini-3.8-flash-tts", text: "x".repeat(1000), voice: { provider: "openai", rate: 15 } };
  assert.equal(capRepairPause(capChapter([switched])), null);
});

test("blocked segment with no safe split point is not repairable work", () => {
  settings.monthlyCap = 50; usage.spent = 0;
  assert.equal(capRepairPause(capChapter([blockedSeg(100)])), null,
    "a passage too short to split safely never reaches the repair plan");
});

test("user-stopped chapter never gets a Resume, even under the cap", () => {
  settings.monthlyCap = 50; usage.spent = 0;
  const ch = { autoSplitEnabled: false, autoSplitPauseReason: "user", autoSplitStatus: CAP_BANNER, segments: [blockedSeg(1000)] };
  assert.equal(capRepairPause(ch), null);
});

test("non-cap reasons never get a Resume", () => {
  settings.monthlyCap = 50; usage.spent = 0;
  for (const reason of ["quota", "error", "update", "exhausted", "completed", "continue"]) {
    const ch = { autoSplitEnabled: false, autoSplitPauseReason: reason, segments: [blockedSeg(1000)] };
    assert.equal(capRepairPause(ch), null, reason);
  }
});

test("armed chapter (flag true) has no pause UI state, even with a stored cap reason", () => {
  settings.monthlyCap = 50; usage.spent = 0;
  const ch = { autoSplitEnabled: true, autoSplitPauseReason: "cap", autoSplitStatus: CAP_BANNER, segments: [blockedSeg(1000)] };
  assert.equal(capRepairPause(ch), null);
});

test("helpers are null-safe", () => {
  assert.equal(effectivePauseReason(null), null);
  assert.equal(effectivePauseReason(undefined), null);
  assert.equal(capRepairPause(null), null);
  assert.equal(capRepairPause({}), null);
});

test("every autoSplitEnabled assignment in the client also assigns the pause reason", () => {
  const assignments = [...app.matchAll(/(\w+)\.autoSplitEnabled=(?:true|false);/g)];
  // 21 audited sites + 2 paired pins added by the review fix (the
  // server-adopt reconciliation for paused_quota and parked jobs)
  // + 1 paired site added by Case #4 (the no-staging-write adoption
  // branch in queueAdaptiveRepair re-arms before lt() merges)
  // + 1 paired site added by the Case #4 final pass (applyAdaptiveRepair
  // re-arms when untouched blocked roots remain after a capped plan).
  // The invariant under guard is the pairing, not the count.
  assert.equal(assignments.length, 25, "21 audited assignments + 2 review-fix pins + 1 Case #4 adoption site + 1 final-pass chain site, all reason-paired");
  for (const m of assignments) {
    const after = app.slice(m.index + m[0].length, m.index + m[0].length + 40);
    assert.ok(
      after.startsWith(`${m[1]}.autoSplitPauseReason=`),
      `assignment at ${m.index} is not paired with a reason: ...${app.slice(Math.max(0, m.index - 60), m.index + 80)}`,
    );
  }
});

test("cap pause sites store the cap reason; the true sites clear it", () => {
  assert.equal(app.split('autoSplitPauseReason="cap"').length - 1, 2, "repair-path and legacy-split cap trips");
  assert.equal(app.split("autoSplitPauseReason=null").length - 1, 10, "all ten re-arm sites clear the reason (incl. Case #4's adoption branch and the final-pass chain continuation)");
  assert.equal(app.split('autoSplitPauseReason="quota"').length - 1, 2, "queue-failure site + server-adopt pin");
});

test("banner never claims cap eligibility; Resume defers to the queue-time plan check", () => {
  assert.ok(!app.includes("Repair available at your current cap"),
    "the old eligibility claim is gone (review fix 2)");
  assert.match(app, /check the full repair plan against your cap before queueing anything/,
    "banner defers eligibility to the real plan check");
  assert.match(app, /the blocked passages alone are estimated at/,
    "over-cap presentation keeps live numbers and marks the estimate as a floor");
  assert.match(app, /data-resume-cap-repair/, "Resume button is rendered when the base fits");
  assert.match(app, /capPause\.overCap\?"":/, "Resume button is withheld when even the base busts the cap");
});

test("Resume click path delegates to the guarded queue entry", () => {
  assert.match(app, /\[data-resume-cap-repair\]/, "click wiring present");
  assert.match(app, /queueAdaptiveRepair\(idx,\{manual:true\}\)/, "Resume queues through queueAdaptiveRepair, manual mode");
});

test("queue entry performs the Worker status lookup before any submission", () => {
  const queue = extract(app, "async function queueAdaptiveRepair(", "async function runAutoSplitSmart(");
  const lookup = queue.indexOf("kr(a.apiBase");
  const submit = queue.indexOf("xt(a.apiBase");
  assert.ok(lookup >= 0, "server status lookup (kr) present in queueAdaptiveRepair");
  assert.ok(submit > lookup, "lookup happens before the submit call (xt)");
  assert.match(queue, /err\?\.status!==404/, "uncertain lookups fail closed; only a confirmed 404 proceeds");
});

test("index.html cache-busts the client for this branch", () => {
  assert.match(indexHtml, /app-258\.js\?v=q2-adapter/);
});

// ---------------------------------------------------------------------
// Behavior: queueAdaptiveRepair's Worker-anchored duplicate check.
// The function is extracted and driven with stubbed dependencies, in
// the repo's established harness style. "Server" scenarios key off the
// deterministic job id the function computes from the plan.
// ---------------------------------------------------------------------
const queueSrc = extract(app, "async function queueAdaptiveRepair(", "async function runAutoSplitSmart(");
const RELEASE = "1.4.43/1.4.117";

function makeQueueEnv({ server = "404", monthlyCap = 0, spent = 0, plan, localGeneration, confirmAnswers } = {}) {
  const chapter = {
    title: "Chapter 1",
    segments: [],
    autoSplitEnabled: false,
    autoSplitPauseReason: "cap",
    autoSplitStatus: CAP_BANNER,
  };
  if (localGeneration !== undefined) chapter.generation = localGeneration;
  const book = { id: "book1", title: "Book", chapters: [chapter] };
  const a = { book, monthlyCap, providers: { generation: true }, apiBase: "https://worker.test", accessToken: "tok" };
  const usePlan = plan || {
    nodes: [{ cache_key: "k1", estimated_cost: 1 }, { cache_key: "k2", estimated_cost: 1 }],
    roots: [{ index: 0 }],
  };
  const jobId = "H[" + JSON.stringify({
    book: "book1", chapter: 0, release: RELEASE, kind: "adaptive_repair",
    keys: usePlan.nodes.map((n) => n.cache_key),
  }) + "]";
  const calls = { kr: [], xt: [], lt: [], confirm: [], alert: [] };
  const answers = confirmAnswers ? [...confirmAnswers] : null;
  const queueAdaptiveRepair = new Function(
    "a", "adaptiveQueueStarting", "adaptiveWorkerReady", "splitBlockedSegment", "runAutoSplit",
    "adaptiveRepairPlan", "Ve", "tt", "kr", "xt", "lt", "pe", "se", "ct", "$e",
    "GENERATION_RELEASE_ID", "confirm", "alert",
    queueSrc + "return queueAdaptiveRepair;",
  )(
    a, new Set(), async () => true,
    () => { throw new Error("local split fallback must not run"); },
    () => { throw new Error("legacy auto-split must not run"); },
    async () => usePlan,
    () => ({ month: "2026-10", spent }),
    async (s) => "H[" + s + "]",
    async (_base, _token, id) => {
      calls.kr.push(id);
      if (server === "404") { const e = new Error("Generation job not found."); e.status = 404; throw e; }
      if (server === "network") throw new Error("Failed to fetch");
      if (server === "weird") return {};
      return { ...server, job_id: id };
    },
    async (_base, _token, payload) => { calls.xt.push(payload); return { job_id: payload.job_id, state: "queued" }; },
    async (idx, status) => { calls.lt.push([idx, status]); },
    async () => {}, () => {}, () => {},
    async () => {},
    RELEASE,
    (msg) => { calls.confirm.push(msg); return answers ? answers.shift() : true; },
    (msg) => { calls.alert.push(msg); },
  );
  return { queueAdaptiveRepair, chapter, calls, jobId };
}

test("behavior: confirmed-absent server job (404) submits exactly once, with the deterministic id", async () => {
  const { queueAdaptiveRepair, chapter, calls, jobId } = makeQueueEnv({ server: "404" });
  await queueAdaptiveRepair(0, { manual: true });
  assert.deepEqual(calls.kr, [jobId], "the Worker was asked about the deterministic job first");
  assert.equal(calls.xt.length, 1, "exactly one submission");
  assert.equal(calls.xt[0].job_id, jobId);
  assert.equal(chapter.generation.jobId, jobId);
  assert.equal(calls.lt.length, 1, "the submit response is applied through lt");
});

test("behavior: cross-device stale snapshot — server already runs the job; adopt, never submit", async () => {
  // This device's book predates the other device's repair: no local
  // generation record at all. The deterministic id still finds it.
  const { queueAdaptiveRepair, chapter, calls, jobId } = makeQueueEnv({
    server: { state: "generating", completed: 1, total: 4, generated_cost: 0.5 },
  });
  await queueAdaptiveRepair(0, { manual: true });
  assert.deepEqual(calls.kr, [jobId]);
  assert.equal(calls.xt.length, 0, "no duplicate submission");
  assert.equal(calls.lt.length, 1, "server status adopted through lt");
  assert.equal(calls.lt[0][1].state, "generating");
  assert.equal(chapter.generation.jobId, jobId);
  assert.match(chapter.autoSplitStatus, /already queued on the Worker/);
});

test("behavior: unknown submission (submitUnconfirmed) reconciles with the server, never blind-resubmits", async () => {
  const { queueAdaptiveRepair, chapter, calls } = makeQueueEnv({
    localGeneration: { jobId: "an-earlier-local-id", state: "failed", submitUnconfirmed: true, error: null },
    server: { state: "queued", completed: 0, total: 4, generated_cost: 0 },
  });
  await queueAdaptiveRepair(0, { manual: true });
  assert.equal(calls.xt.length, 0, "the unconfirmed job is not submitted again");
  assert.equal(calls.lt.length, 1, "the server's truth replaces the uncertain local record");
  assert.ok(!chapter.generation.submitUnconfirmed, "local record no longer claims an unconfirmed submit");
});

test("behavior: finished server job is adopted through lt (results path), not resubmitted", async () => {
  const { queueAdaptiveRepair, calls } = makeQueueEnv({
    server: { state: "ready", completed: 4, total: 4, generated_cost: 2.5, segments: [] },
  });
  await queueAdaptiveRepair(0, { manual: true });
  assert.equal(calls.xt.length, 0);
  assert.equal(calls.lt.length, 1);
  assert.equal(calls.lt[0][1].state, "ready");
});

test("behavior: server paused_quota blocks the queue and re-pins the quota pause", async () => {
  const { queueAdaptiveRepair, chapter, calls } = makeQueueEnv({
    server: { state: "paused_quota", completed: 1, total: 4, generated_cost: 0.5 },
  });
  await queueAdaptiveRepair(0, { manual: true });
  assert.equal(calls.xt.length, 0, "a quota-paused server job is not blind-restarted");
  assert.equal(chapter.autoSplitEnabled, false);
  assert.equal(chapter.autoSplitPauseReason, "quota");
});

test("behavior: server parked job is reconciled, not duplicated", async () => {
  const { queueAdaptiveRepair, chapter, calls } = makeQueueEnv({
    server: { state: "parked", completed: 0, total: 4, generated_cost: 0 },
  });
  await queueAdaptiveRepair(0, { manual: true });
  assert.equal(calls.xt.length, 0);
  assert.equal(chapter.autoSplitEnabled, false);
  assert.equal(chapter.autoSplitPauseReason, "error");
  assert.match(chapter.autoSplitStatus, /will not queue a duplicate/);
});

test("behavior: unverifiable server state fails closed — no submission, clear message", async () => {
  const { queueAdaptiveRepair, chapter, calls } = makeQueueEnv({ server: "network" });
  await queueAdaptiveRepair(0, { manual: true });
  assert.equal(calls.kr.length, 1);
  assert.equal(calls.xt.length, 0, "nothing is submitted on an uncertain lookup");
  assert.match(chapter.autoSplitStatus, /could not verify this chapter's job with the Worker/);
  assert.equal(calls.alert.length, 1, "manual entry surfaces the failure");
});

test("behavior: malformed server status also fails closed", async () => {
  const { queueAdaptiveRepair, calls } = makeQueueEnv({ server: "weird" });
  await queueAdaptiveRepair(0, { manual: true });
  assert.equal(calls.xt.length, 0);
});

test("behavior: server-confirmed failed job restarts via the normal submit (a reconciled decision)", async () => {
  const { queueAdaptiveRepair, calls, jobId } = makeQueueEnv({
    server: { state: "failed", completed: 1, total: 4, generated_cost: 0.5, error: "boom" },
  });
  await queueAdaptiveRepair(0, { manual: true });
  assert.deepEqual(calls.kr, [jobId], "state was verified first");
  assert.equal(calls.xt.length, 1, "only a confirmed-failed job is resubmitted");
  assert.equal(calls.xt[0].job_id, jobId, "the resubmit targets the same deterministic job");
});

test("behavior: near-cap boundary — base fits, repair tree does not; the queue-time guard decides", async () => {
  // Headroom is $15 (cap $50, spent $35). The helper test above shows
  // the $10 base. Here the repair TREE sums to $20: the manual queue
  // must lead with the worst-case cap confirmation, and declining it
  // queues nothing.
  const plan = {
    nodes: [{ cache_key: "k1", estimated_cost: 10 }, { cache_key: "k2", estimated_cost: 10 }],
    roots: [{ index: 0 }],
  };
  const declined = makeQueueEnv({ server: "404", monthlyCap: 50, spent: 35, plan, confirmAnswers: [false] });
  await declined.queueAdaptiveRepair(0, { manual: true });
  assert.match(declined.calls.confirm[0], /Worst-case background repairs may exceed your monthly soft cap/);
  assert.equal(declined.calls.xt.length, 0, "declining the true worst-case confirmation queues nothing");

  const accepted = makeQueueEnv({ server: "404", monthlyCap: 50, spent: 35, plan, confirmAnswers: [true, true] });
  await accepted.queueAdaptiveRepair(0, { manual: true });
  assert.equal(accepted.calls.xt.length, 1, "explicit consent at the real number proceeds");
});

// ---------------------------------------------------------------------
// Ledger accounting (Rowan re-review blocker): adopting or restarting
// a job the Worker already holds must not re-credit its cumulative
// generated_cost into the shared monthly ledger. The fix seeds the
// fresh local record's recordedCost from the verified server status;
// lt() then credits only the delta accrued after that point. These
// tests drive the REAL lt() (extracted below) against a shared,
// mutable usage object standing in for the synced settings ledger.
// lt()'s own dependencies are stubbed; `or` is stubbed to its real
// record-merge line (the only part of or() the accounting reads:
// it writes the merged status and the recordedCost checkpoint).
// ---------------------------------------------------------------------
const ltSrc = extract(app, "async function lt(", "const adaptiveQueueStarting=");
const orMergeStub = (chapter, status, { replacement = false, recordedCost = 0 } = {}) => {
  const key = replacement ? "replacementGeneration" : "generation";
  const prev = chapter[key] || {};
  chapter[key] = { ...prev, ...status, jobId: status.job_id || status.jobId, recordedCost };
};

function makeLedgerEnv({ server = "404", usage, submitStatus, monthlyCap = 0, localGeneration, plan } = {}) {
  const shared = usage || { month: "2026-10", spent: 0 };
  const chapter = {
    title: "Chapter 1",
    segments: [],
    autoSplitEnabled: false,
    autoSplitPauseReason: "cap",
    autoSplitStatus: CAP_BANNER,
  };
  if (localGeneration !== undefined) chapter.generation = localGeneration;
  const book = { id: "book1", title: "Book", chapters: [chapter] };
  const a = { book, monthlyCap, providers: { generation: true }, apiBase: "https://worker.test", accessToken: "tok", usage: shared };
  const usePlan = plan || {
    nodes: [{ cache_key: "k1", estimated_cost: 1 }, { cache_key: "k2", estimated_cost: 1 }],
    roots: [{ index: 0 }],
  };
  const jobId = "H[" + JSON.stringify({
    book: "book1", chapter: 0, release: RELEASE, kind: "adaptive_repair",
    keys: usePlan.nodes.map((n) => n.cache_key),
  }) + "]";
  const calls = { kr: [], xt: [], ae: 0 };
  const Ve = () => shared;
  const lt = new Function(
    "a", "applyAdaptiveRepair", "or", "Ve", "Ae", "quotaQueueFailure", "pe", "scheduleAutoSplit",
    ltSrc + "return lt;",
  )(
    a,
    () => true, // applyAdaptiveRepair: mapping applies cleanly; accounting does not depend on it
    orMergeStub,
    Ve,
    async () => { calls.ae += 1; },
    () => false, // quotaQueueFailure
    async () => {},
    () => {},
  );
  const queueAdaptiveRepair = new Function(
    "a", "adaptiveQueueStarting", "adaptiveWorkerReady", "splitBlockedSegment", "runAutoSplit",
    "adaptiveRepairPlan", "Ve", "tt", "kr", "xt", "lt", "pe", "se", "ct", "$e",
    "GENERATION_RELEASE_ID", "confirm", "alert",
    queueSrc + "return queueAdaptiveRepair;",
  )(
    a, new Set(), async () => true,
    () => { throw new Error("local split fallback must not run"); },
    () => { throw new Error("legacy auto-split must not run"); },
    async () => usePlan,
    Ve,
    async (s) => "H[" + s + "]",
    async (_base, _token, id) => {
      calls.kr.push(id);
      if (server === "404") { const e = new Error("Generation job not found."); e.status = 404; throw e; }
      return { ...server, job_id: id };
    },
    async (_base, _token, payload) => {
      calls.xt.push(payload);
      return { job_id: payload.job_id, state: "queued", generated_cost: 0, ...(submitStatus || {}) };
    },
    lt,
    async () => {}, () => {}, () => {},
    async () => {},
    RELEASE,
    () => true,
    () => {},
  );
  // applyStatus drives the real lt() the way the poller (Ye) does when
  // a later status for this chapter's job arrives.
  return { queueAdaptiveRepair, applyStatus: (status) => lt(0, status), chapter, calls, jobId, usage: shared };
}

test("ledger: queue staging seeds recordedCost from the verified server status", () => {
  const queue = extract(app, "async function queueAdaptiveRepair(", "async function runAutoSplitSmart(");
  assert.match(queue, /recordedCostSeed=serverJob\?Number\(serverJob\.generated_cost\)\|\|0:0/,
    "the seed comes from the server job's cumulative generated_cost (0 when absent/404)");
  assert.match(queue, /recordedCost:recordedCostSeed/, "the staged record carries the seed into lt()");
});

test("ledger: Rowan repro — adopting a ready job already paid into synced usage (16.61 incl. 0.18) does not re-credit", async () => {
  // Rowan's executed reproduction: usage $16.61 already includes the
  // $0.18 device A recorded for this job; this device's cap-paused
  // chapter has no cost checkpoint. Before the seed, lt() yielded
  // $16.79 — the same $0.18 credited a second time.
  const env = makeLedgerEnv({
    usage: { month: "2026-10", spent: 16.61 },
    server: { state: "ready", completed: 4, total: 4, generated_cost: 0.18, segments: [] },
  });
  await env.queueAdaptiveRepair(0, { manual: true });
  assert.equal(env.calls.xt.length, 0, "the held job is adopted, not resubmitted");
  assert.equal(env.usage.spent, 16.61, "the already-recorded $0.18 is not credited again");
  assert.equal(env.chapter.generation.recordedCost, 0.18, "the checkpoint is seeded from the server status");
  assert.equal(env.calls.ae, 0, "no credit means no ledger sync write");
});

test("ledger (a): adopting ready/partial jobs whose spend is already in synced usage leaves spent unchanged", async () => {
  for (const state of ["ready", "partial"]) {
    const env = makeLedgerEnv({
      usage: { month: "2026-10", spent: 40 },
      server: { state, completed: 3, total: 4, generated_cost: 2.5, segments: [] },
    });
    await env.queueAdaptiveRepair(0, { manual: true });
    assert.equal(env.calls.xt.length, 0, state + ": adopted, not resubmitted");
    assert.equal(env.usage.spent, 40, state + ": the $2.50 already in the ledger is not credited again");
    assert.equal(env.chapter.generation.recordedCost, 2.5, state + ": checkpoint seeded");
  }
});

test("ledger (b): confirmed-failed restart seeds the retained generated_cost — no re-credit", async () => {
  // The Worker retains the failed job's cumulative generated_cost
  // ($0.75, already recorded into synced usage by another device).
  // The restart's submit response reports that same cumulative figure;
  // only the seed keeps lt() from crediting it a second time.
  const env = makeLedgerEnv({
    usage: { month: "2026-10", spent: 10.75 },
    server: { state: "failed", completed: 1, total: 4, generated_cost: 0.75, error: "boom" },
    submitStatus: { generated_cost: 0.75 },
  });
  await env.queueAdaptiveRepair(0, { manual: true });
  assert.equal(env.calls.xt.length, 1, "a confirmed-failed job is restarted via the normal submit");
  assert.equal(env.usage.spent, 10.75, "the retained $0.75 is not re-credited on restart");
  assert.equal(env.chapter.generation.recordedCost, 0.75, "the checkpoint survives the restart");
});

test("ledger (c): spend accruing after adoption is credited once, as the increment only", async () => {
  const env = makeLedgerEnv({
    usage: { month: "2026-10", spent: 21.25 },
    server: { state: "generating", completed: 1, total: 4, generated_cost: 1.25 },
  });
  await env.queueAdaptiveRepair(0, { manual: true });
  assert.equal(env.usage.spent, 21.25, "adoption itself credits nothing already known");
  assert.equal(env.chapter.generation.recordedCost, 1.25);
  // The job finishes with $0.50 more accrued; the poller applies it.
  await env.applyStatus({ job_id: env.jobId, state: "ready", generated_cost: 1.75, adaptive_repair: true, segments: [] });
  assert.equal(env.usage.spent, 21.75, "only the $0.50 increment is credited");
  assert.equal(env.calls.ae, 1, "exactly one ledger credit/sync for the increment");
  // Re-applying the same status (next poll) credits nothing further.
  await env.applyStatus({ job_id: env.jobId, state: "ready", generated_cost: 1.75, adaptive_repair: true, segments: [] });
  assert.equal(env.usage.spent, 21.75, "the increment is credited exactly once");
  assert.equal(env.calls.ae, 1);
});

test("ledger (d): two devices, one synced ledger — adoption adds nothing, later accrual adds only the delta", async () => {
  // The shared, synced usage object is carried between device contexts.
  const shared = { month: "2026-10", spent: 0 };
  // Device A queues the job fresh and records its cost as it runs.
  const devA = makeLedgerEnv({ usage: shared, server: "404" });
  await devA.queueAdaptiveRepair(0, { manual: true });
  assert.equal(devA.calls.xt.length, 1, "device A submits the new job");
  await devA.applyStatus({ job_id: devA.jobId, state: "generating", generated_cost: 0.5, adaptive_repair: true });
  assert.equal(shared.spent, 0.5, "device A's recording lands in the shared ledger");
  // Device B is stale: cap-paused chapter, no generation record, no
  // checkpoint — but the same deterministic plan id finds the job.
  const devB = makeLedgerEnv({
    usage: shared,
    server: { state: "ready", completed: 4, total: 4, generated_cost: 0.5, segments: [] },
  });
  assert.equal(devB.jobId, devA.jobId, "both devices derive the same deterministic job id");
  await devB.queueAdaptiveRepair(0, { manual: true });
  assert.equal(devB.calls.xt.length, 0, "device B adopts instead of submitting a duplicate");
  assert.equal(shared.spent, 0.5, "device B's adoption credits nothing a second time");
  assert.equal(devB.chapter.generation.recordedCost, 0.5, "device B now holds the checkpoint");
  // The job accrues $0.375 more; device B observes it first.
  await devB.applyStatus({ job_id: devB.jobId, state: "ready", generated_cost: 0.875, adaptive_repair: true, segments: [] });
  assert.equal(shared.spent, 0.875, "only the $0.375 increment is added");
});

test("ledger: fresh 404 submission still seeds zero and accrues normally (regression)", async () => {
  const env = makeLedgerEnv({ usage: { month: "2026-10", spent: 3 }, server: "404" });
  await env.queueAdaptiveRepair(0, { manual: true });
  assert.equal(env.calls.xt.length, 1, "a genuinely new job is submitted");
  assert.equal(env.chapter.generation.recordedCost, 0, "a new job starts with a zero checkpoint");
  assert.equal(env.usage.spent, 3, "submission alone credits nothing");
  await env.applyStatus({ job_id: env.jobId, state: "ready", generated_cost: 0.5, adaptive_repair: true, segments: [] });
  assert.equal(env.usage.spent, 3.5, "the new job's spend accrues in full");
  assert.equal(env.chapter.generation.recordedCost, 0.5);
});
