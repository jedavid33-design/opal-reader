// Run: node --test tests/repair-chain-continuation.test.mjs
// Case #4 final pass — the automatic repair chain must not stop after
// one plan. A repair plan is capped at 90 nodes, so a chapter with many
// blocked passages needs several plans back to back. Before this fix,
// applyAdaptiveRepair switched autoSplitEnabled off unconditionally
// when a pass applied — roots the cap left OUT of the plan stayed
// blocked until Julie tapped Repair by hand. Now the chain stays armed
// exactly while untouched, still-repairable blocked roots remain, and
// stops (as before) when none do.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../app-256.js", import.meta.url), "utf8");
const between = (src, a, b) => {
  const i = src.indexOf(a), j = src.indexOf(b, i);
  assert.ok(i >= 0 && j > i, "missing source " + a);
  return src.slice(i, j);
};
const helpers = new Function(
  between(app, "function segIdentity(", "function recordGeminiFailure(") +
  between(app, "function applyAdaptiveRepair(", "function effectivePauseReason(") +
  "\nreturn {segIdentity, applyAdaptiveRepair};",
)();
const { segIdentity, applyAdaptiveRepair } = helpers;

const blockedSeg = (id, text) => ({
  id, text, speechText: text, pov: null, audioKey: null, audioStale: false,
  generationBlocked: {
    error: "Gemini blocked this segment.", blockReason: "POLICY_BLOCK",
    finishReason: "HTTP_400", model: "gemini-3.8-flash-tts", jobId: "job-old",
  },
});

// A chapter whose repair plan covered root-1 ONLY (root-2 is the kind
// of leftover the 90-node plan cap produces), plus the finished repair
// status for root-1's two halves.
function makeChapter({ leftover = true, leftoverExhausted = false } = {}) {
  const ch = {
    title: "Chapter 1", pov: null, text: "",
    autoSplitEnabled: true, autoSplitPauseReason: null, autoSplitStatus: null,
    segments: [blockedSeg("root-1", "First blocked passage text.")],
  };
  if (leftover) {
    const seg = blockedSeg("root-2", "Second blocked passage text.");
    if (leftoverExhausted) seg.splitExhausted = true;
    ch.segments.push(seg);
  }
  ch.text = ch.segments.map((s) => s.text).join("\n\n");
  const nodes = [
    { text: "First half.", speechText: "First half.", cache_key: "ck-l", fingerprint: "fp-l", repair_path: "L" },
    { text: "Second half.", speechText: "Second half.", cache_key: "ck-r", fingerprint: "fp-r", repair_path: "R" },
  ];
  const local = {
    scope: "background_repair", repairApplied: false,
    repairNodes: nodes,
    repairRoots: [{
      index: 0, id: "root-1", identity: segIdentity(ch.segments[0], ch.pov),
      rootId: "root-1", begin: 0, count: 2,
    }],
  };
  const status = {
    state: "ready", job_id: "repair-job-1",
    segments: [
      { state: "ready", cache_key: "ck-l", model: "gemini-3.8-flash-tts" },
      { state: "ready", cache_key: "ck-r", model: "gemini-3.8-flash-tts" },
    ],
  };
  return { ch, local, status };
}

test("a finished pass keeps the chain armed while an untouched blocked root remains", () => {
  const { ch, local, status } = makeChapter();
  assert.equal(applyAdaptiveRepair(ch, local, status), true);
  // Root-1 was replaced by its two saved pieces...
  assert.equal(ch.segments.length, 3);
  assert.equal(ch.segments[0].audioKey, "ck-l");
  assert.equal(ch.segments[1].audioKey, "ck-r");
  // ...root-2 is untouched: still blocked, NOT marked exhausted.
  const leftover = ch.segments[2];
  assert.equal(leftover.id, "root-2");
  assert.ok(leftover.generationBlocked, "leftover root is still blocked");
  assert.ok(!leftover.splitExhausted, "leftover root was never planned, so not exhausted");
  // The chain stays armed so lt()'s scheduleAutoSplit queues the next
  // plan without a manual tap.
  assert.equal(ch.autoSplitEnabled, true);
  assert.equal(ch.autoSplitPauseReason, null);
  assert.match(ch.autoSplitStatus, /continues automatically/);
});

test("the chain still stops when no repairable blocked root remains", () => {
  const { ch, local, status } = makeChapter({ leftover: false });
  assert.equal(applyAdaptiveRepair(ch, local, status), true);
  assert.equal(ch.segments.length, 2);
  assert.equal(ch.autoSplitEnabled, false);
  assert.equal(ch.autoSplitPauseReason, "completed");
  assert.equal(ch.autoSplitStatus, "Background repair finished; all pieces saved.");
});

test("an already-exhausted leftover does not re-arm the chain (termination)", () => {
  const { ch, local, status } = makeChapter({ leftoverExhausted: true });
  assert.equal(applyAdaptiveRepair(ch, local, status), true);
  // The only remaining blocked segment is splitExhausted: it is a
  // manual-fallback candidate, not automatic work — the chain stops.
  assert.equal(ch.autoSplitEnabled, false);
  assert.equal(ch.autoSplitPauseReason, "completed");
  assert.equal(ch.autoSplitStatus, "Background repair finished with unresolved pieces.");
});
