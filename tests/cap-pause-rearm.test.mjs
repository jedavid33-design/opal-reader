// Run with: node --test tests/cap-pause-rearm.test.mjs
// Case #2 (Opal Roundtable): cap-paused auto-repair re-arm.
// A chapter paused by the monthly soft cap stores WHY it paused in
// autoSplitPauseReason; the segment modal derives the cap presentation
// (and Resume eligibility) from live settings instead of trusting the
// persisted banner, which went stale the moment the cap changed.
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
const { effectivePauseReason, capRepairPause } = new Function(
  "gemini400Blocked", "segmentVoice", "He", "plainSpeech", "Ve", "a",
  helpers + "return {effectivePauseReason, capRepairPause};",
)(
  // Blocked test: test segments carry an explicit marker.
  (ch, seg) => !!seg.blocked,
  (ch, seg) => seg.voice || null,
  // Same shape as the app's He: chars per million at the voice's rate.
  (chars, voice) => chars / 1e6 * voice.rate,
  (s) => String(s ?? ""),
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

test("legacy cap banner (no stored reason) maps to cap", () => {
  const legacy = { autoSplitEnabled: false, autoSplitStatus: CAP_BANNER, segments: [] };
  assert.equal(effectivePauseReason(legacy), "cap");
  assert.ok(capRepairPause(legacy), "legacy cap pause must surface the derived presentation");
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

test("cap pause under the cap is Resume-eligible; forecast sums blocked segments only", () => {
  settings.monthlyCap = 50; usage.spent = 16.43;
  const ch = capChapter([
    blockedSeg(500_000),            // $7.50
    blockedSeg(500_000),            // $7.50
    { blocked: false, text: "x".repeat(900_000), voice: { provider: "gemini", rate: 15 } }, // excluded
    { blocked: true, text: "x".repeat(400_000), voice: null },                              // no voice: skipped
  ]);
  const pause = capRepairPause(ch);
  assert.ok(pause);
  assert.equal(pause.forecast, 15);
  assert.equal(pause.spent, 16.43);
  assert.equal(pause.cap, 50);
  assert.equal(pause.eligible, true);
});

test("cap pause over the cap is not Resume-eligible", () => {
  settings.monthlyCap = 20; usage.spent = 16.43;
  const pause = capRepairPause(capChapter([blockedSeg(500_000), blockedSeg(500_000)]));
  assert.ok(pause);
  assert.equal(pause.eligible, false);
});

test("spent plus forecast exactly at the cap is eligible", () => {
  settings.monthlyCap = 31.43; usage.spent = 16.43;
  const pause = capRepairPause(capChapter([blockedSeg(500_000), blockedSeg(500_000)]));
  assert.equal(pause.eligible, true);
});

test("cap of zero disables the cap check (always eligible)", () => {
  settings.monthlyCap = 0; usage.spent = 999;
  const pause = capRepairPause(capChapter([blockedSeg(500_000)]));
  assert.equal(pause.eligible, true);
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
  assert.equal(assignments.length, 21, "the audited inventory is 21 direct assignments");
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
  assert.equal(app.split("autoSplitPauseReason=null").length - 1, 8, "all eight re-arm sites clear the reason");
  assert.match(app, /data-resume-cap-repair/, "Resume button is rendered for eligible cap pauses");
  assert.match(app, /Repair available at your current cap — tap Resume\./, "derived eligible presentation");
});

test("index.html cache-busts the client for this branch", () => {
  assert.match(indexHtml, /app-256\.js\?v=cap-pause-rearm/);
});
