// Run: node --test tests/freeze-route-census.test.mjs
// P8 preparation (Roundtable Case #10, issue #15): mechanical completeness
// proof for the freeze mutation audit (v2/p8/freeze-audit.md).
//
// The audit classifies every HTTP route of the SHIPPED v1 Worker
// (1.4.43, cloudflare-worker.js — byte-identical to origin/main) as
// READ-ONLY, MUTATING, or SIDE-EFFECTING GET. This test re-extracts the
// route table from the shipped source and asserts it matches the audit's
// classification EXACTLY, in both directions: an unclassified route in
// the source fails, and a classified route that no longer exists in the
// source fails. It also asserts every classified route key appears in
// the audit document, and that the document carries the Correction-C
// coverage table and the non-route write-path inventory.
//
// Extraction scope: dispatch conditions are the `if` conditions inside
// the fetch handler that test `url.pathname`. A condition contributes
// (method x pattern) keys from its `request.method ===` literals and its
// pathname literals (=== exact, startsWith prefix, endsWith suffix).
// The one method-less dispatch block (/api/sync/epub/) takes its methods
// from the method tests inside its block. The error-path `if` in the
// fetch catch (pathname prefix, no method test, not a dispatch) is
// excluded by the method rule.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const worker = readFileSync(new URL("../cloudflare-worker.js", import.meta.url), "utf8");
const client = readFileSync(new URL("../app-256.js", import.meta.url), "utf8");
const audit = readFileSync(new URL("../v2/p8/freeze-audit.md", import.meta.url), "utf8");

const CLASSIFICATION = new Map([
  // READ-ONLY — no state change anywhere downstream (15 keys)
  ["GET /health", "READ-ONLY"],
  ["GET /health/", "READ-ONLY"],
  ["GET /api/usage/report", "READ-ONLY"],
  ["GET /api/quota/gemini", "READ-ONLY"],
  ["GET /api/providers/status", "READ-ONLY"],
  ["GET /api/sync/manifest", "READ-ONLY"],
  ["GET /api/sync/book/*", "READ-ONLY"],
  ["GET /api/sync/library", "READ-ONLY"],
  ["GET /api/sync/settings", "READ-ONLY"],
  ["GET /api/sync/epub/*", "READ-ONLY"],
  ["GET /api/sync/audio/*", "READ-ONLY"],
  ["GET /api/providers/azure/voices", "READ-ONLY"],
  ["GET /api/providers/fish/voices", "READ-ONLY"],
  ["GET /api/providers/openai/voices", "READ-ONLY"],
  ["GET /api/providers/gemini/voices", "READ-ONLY"],
  // SIDE-EFFECTING GET — a GET that writes (3 keys)
  ["GET /api/export/audio/*", "SIDE-EFFECTING GET"],
  ["GET /api/generation/books/*/jobs", "SIDE-EFFECTING GET"],
  ["GET /api/generation/jobs/*", "SIDE-EFFECTING GET"],
  // MUTATING — non-GET routes that write (17 keys)
  ["PUT /api/sync/book/*", "MUTATING"],
  ["DELETE /api/sync/book/*", "MUTATING"],
  ["DELETE /api/sync/deleted/*", "MUTATING"],
  ["PUT /api/sync/settings", "MUTATING"],
  ["PUT /api/sync/epub/*", "MUTATING"],
  ["POST /api/export/audio-url", "MUTATING"],
  ["DELETE /api/audio/purge", "MUTATING"],
  ["POST /api/playback/chapter", "MUTATING"],
  ["POST /api/generation/jobs", "MUTATING"],
  ["POST /api/generation/jobs/*/resume", "MUTATING"],
  ["POST /api/generation/continue", "MUTATING"],
  ["POST /api/generation/continue/stage", "MUTATING"],
  ["POST /api/generation/continue/finalize", "MUTATING"],
  ["POST /api/providers/azure/speech", "MUTATING"],
  ["POST /api/providers/fish/speech", "MUTATING"],
  ["POST /api/providers/openai/speech", "MUTATING"],
  ["POST /api/providers/gemini/speech", "MUTATING"],
]);

function balanced(src, openIdx, open, close) {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === open) depth++;
    else if (src[i] === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function extractRouteKeys(src) {
  const fetchStart = src.indexOf("async fetch");
  const queueStart = src.indexOf("async queue", fetchStart);
  assert.ok(fetchStart > 0 && queueStart > fetchStart, "fetch/queue handlers located");
  const region = src.slice(fetchStart, queueStart);
  const keys = new Set();
  const ifRe = /\bif\s*\(/g;
  let m;
  while ((m = ifRe.exec(region)) !== null) {
    const pOpen = region.indexOf("(", m.index);
    const pClose = balanced(region, pOpen, "(", ")");
    if (pClose < 0) continue;
    const cond = region.slice(pOpen, pClose + 1);
    if (!cond.includes("pathname")) continue;
    const methods = [...cond.matchAll(/request\.method\s*===\s*"([A-Z]+)"/g)].map((x) => x[1]);
    const eq = [...cond.matchAll(/url\.pathname\s*===\s*"([^"]+)"/g)].map((x) => x[1]);
    const starts = cond.match(/url\.pathname\.startsWith\("([^"]+)"\)/)?.[1];
    const ends = cond.match(/url\.pathname\.endsWith\("([^"]+)"\)/)?.[1];
    let patterns = [];
    if (eq.length) patterns = eq;
    else if (starts) patterns = [starts + "*" + (ends || "")];
    if (!patterns.length) continue;
    let useMethods = methods;
    if (!useMethods.length) {
      // Method-less dispatch block (/api/sync/epub/): methods live inside.
      const bOpen = region.indexOf("{", pClose);
      const bClose = bOpen > 0 ? balanced(region, bOpen, "{", "}") : -1;
      if (bClose < 0) continue;
      const block = region.slice(bOpen, bClose);
      useMethods = [...block.matchAll(/request\.method\s*===\s*"([A-Z]+)"/g)].map((x) => x[1]);
    }
    if (!useMethods.length) continue; // not a dispatch (e.g. the catch-path log guard)
    for (const method of useMethods)
      for (const pattern of patterns) keys.add(`${method} ${pattern}`);
  }
  return keys;
}

test("audited artifacts are the shipped 1.4.43 / 1.4.117 sources", () => {
  assert.match(worker, /VERSION = "1\.4\.43"/);
  assert.ok(client.includes("1.4.117"), "client bundle carries the 1.4.117 marker");
  assert.ok(!worker.includes("async scheduled"), "shipped worker has no scheduled handler");
  assert.equal((worker.match(/async queue\(/g) || []).length, 1, "exactly one queue consumer");
});

test("route census: extraction matches the audit classification exactly", () => {
  const extracted = extractRouteKeys(worker);
  const classified = new Set(CLASSIFICATION.keys());
  const unclassified = [...extracted].filter((k) => !classified.has(k));
  const phantom = [...classified].filter((k) => !extracted.has(k));
  assert.deepEqual(unclassified, [], "routes in source with no classification");
  assert.deepEqual(phantom, [], "classified routes absent from source");
  const counts = {};
  for (const v of CLASSIFICATION.values()) counts[v] = (counts[v] || 0) + 1;
  assert.deepEqual(counts, { "READ-ONLY": 15, "SIDE-EFFECTING GET": 3, MUTATING: 17 });
});

test("every classified route key appears in the audit document", () => {
  for (const key of CLASSIFICATION.keys())
    assert.ok(audit.includes(key), `audit doc is missing route key: ${key}`);
});

test("Correction-C coverage and non-route inventory are present in the audit", () => {
  const required = [
    // Correction-C list items, named as the package names them
    "sync PUT/DELETE",
    "settings PUT",
    "generation POSTs",
    "the mutating status GET",
    "continue stage/finalize",
    "speech POSTs",
    "usage report",
    "audio purge",
    "epub/audio uploads",
    "queue paused",
    "mirror writes off",
    "reads preserved",
    // Non-route write paths inventoried in the audit
    "processGenerationJob",
    "stepGeminiBatch",
    "recordTtsUsage",
    "mirrorGenerationStatus",
    "waitUntil",
    "/api/sessions",
  ];
  for (const s of required) assert.ok(audit.includes(s), `audit doc is missing: ${s}`);
});
