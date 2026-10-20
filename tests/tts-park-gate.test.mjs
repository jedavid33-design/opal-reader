// Run: node --test tests/tts-park-gate.test.mjs
// Case #4 + Rowan S3: the direct speech endpoint spends the same Gemini
// project quota as the Queue (in this Worker the plan's "/api/tts/*" is
// /api/providers/gemini/speech), so the shared park governs it too.
// During a park: unlabeled calls are refused with an honest 429; the
// labeled one-call override (quota_override: "explicit_single") makes
// exactly one call; an override that meets a daily 429 re-parks. The
// client audit holds gt() — whose only callers are explicit user taps —
// as the sole setter of the override. And a Continue-to-quota action
// consumes at most one probe total.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import worker from "../cloudflare-worker.js";
import {
  makeHarness, makeSegment, sha256Hex, jsonResponse, RELEASE, CLIENT_VERSION,
} from "./support/mock-env.mjs";

const app = readFileSync(new URL("../app-256.js", import.meta.url), "utf8");
const T0 = Date.UTC(2026, 9, 20, 15, 0, 0);
const daily429 = () => jsonResponse({
  error: {
    message: "Quota exceeded for quota metric 'GenerateRequestsPerDayPerProjectPerModel' and limit: 100 for project.",
    status: "RESOURCE_EXHAUSTED",
    details: [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "3600s" }],
  },
}, 429);
const daily429Long = () => new Response(JSON.stringify({
  error: {
    message: "Quota exceeded for quota metric 'GenerateRequestsPerDayPerProjectPerModel' and limit: 100 for project.",
    status: "RESOURCE_EXHAUSTED", details: [],
  },
}), { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "86400" } });

async function makePark(h) {
  const jobA = sha256Hex("tts-park-maker");
  const res = await h.request("/api/generation/jobs", {
    method: "POST",
    body: {
      job_id: jobA, book_id: "book-test-1", chapter_index: 0,
      generation_release: RELEASE, client_version: CLIENT_VERSION,
      segments: [makeSegment("tm-0")],
    },
  });
  assert.equal(res.status, 202);
  await h.drain();
  return h.r2.readJson("quota/gemini-park.json");
}
const speech = (h, body) => h.request("/api/providers/gemini/speech", {
  method: "POST",
  body: {
    text: "A single segment to voice.", voice_id: "Algieba",
    model_id: "gemini-3.8-flash-tts", cache_key: sha256Hex("tts-speech-seg"),
    usage_type: "book_audition", ...body,
  },
});

test("during a park, unlabeled direct speech is refused; the labeled override makes exactly one call", async () => {
  let phase = "park-maker";
  const h = makeHarness(worker, {
    clockStart: T0,
    fetchBehavior: {
      onInteractions: async () => (phase === "park-maker" ? daily429() : undefined),
    },
  });
  const park = await makePark(h);
  assert.ok(park);
  assert.equal(h.google.calls.interactions, 1);
  phase = "after-park";

  const blocked = await speech(h, {});
  assert.equal(blocked.status, 429, "unlabeled call refused during the park");
  const blockedBody = await blocked.json();
  assert.equal(blockedBody.code, "quota_parked");
  assert.match(blockedBody.error, /parked until/);
  assert.equal(h.google.calls.interactions, 1, "no provider call spent");

  const allowed = await speech(h, { quota_override: "explicit_single" });
  assert.equal(allowed.status, 200, "the labeled one-call override goes through");
  assert.equal(h.google.calls.interactions, 2, "exactly one call for the override");
  h.restore();
});

test("an override call that meets a daily 429 re-parks from the new evidence", async () => {
  let phase = "park-maker";
  const h = makeHarness(worker, {
    clockStart: T0,
    fetchBehavior: {
      onInteractions: async () => {
        if (phase === "park-maker") return daily429();
        if (phase === "override-429") return daily429Long();
        return undefined;
      },
    },
  });
  const park = await makePark(h);
  phase = "override-429";
  const res = await speech(h, { quota_override: "explicit_single" });
  assert.ok(res.status >= 400, "the provider's 429 surfaces as an error, not a retry");
  const after = await h.r2.readJson("quota/gemini-park.json");
  assert.ok(after.parked_until > park.parked_until,
    "the park was extended (monotone) from the override's 429 evidence");
  assert.equal(after.route, "direct");
  h.restore();
});

test("with no park, direct speech is unaffected", async () => {
  const h = makeHarness(worker, { clockStart: T0 });
  const res = await speech(h, {});
  assert.equal(res.status, 200);
  assert.equal(h.google.calls.interactions, 1);
  h.restore();
});

test("client audit: gt() is the only override setter and has only explicit-tap callers", () => {
  // Exactly one place in the client sets the override label...
  const setters = [...app.matchAll(/quota_override:"explicit_single"/g)];
  assert.equal(setters.length, 1);
  const gtStart = app.indexOf("async function gt(");
  const gtEnd = app.indexOf("async function br(", gtStart);
  assert.ok(gtStart >= 0 && gtEnd > gtStart);
  assert.ok(app.slice(gtStart, gtEnd).includes('quota_override:"explicit_single"'),
    "the setter lives inside gt()");
  // ...and gt() has exactly two call sites: the voice audition and the
  // prosody compare — both explicit user taps, no automatic caller.
  const callSites = [...app.matchAll(/[^A-Za-z0-9_$]gt\(a\.apiBase/g)];
  assert.equal(callSites.length, 2, "gt() keeps exactly its two user-tap callers");
});

test("Continue-to-quota consumes at most one probe: the paused branch resumes one job and handles the probe answer", () => {
  const start = app.indexOf("async function continueToQuota(");
  const end = app.indexOf("async function resumeChapterQuota(", start);
  assert.ok(start >= 0 && end > start);
  const fn = app.slice(start, end);
  const branchStart = fn.indexOf('session?.state==="paused"');
  const branchEnd = fn.indexOf('session?.state==="running"', branchStart);
  assert.ok(branchStart >= 0 && branchEnd > branchStart);
  const branch = fn.slice(branchStart, branchEnd);
  const resumes = [...branch.matchAll(/\/resume/g)];
  assert.equal(resumes.length, 1, "the paused branch resumes exactly one job");
  assert.match(branch, /result\.probe/, "the probe outcome is handled explicitly");
  assert.match(branch, /Quota still full/, "and reported honestly, not as a silent re-park");
});
