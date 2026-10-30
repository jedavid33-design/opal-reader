// CH2 FIX PACKAGE — fix 3: long-segment timeout incidence
// reduction. The Ch 2 unknown-billing attempt is most likely
// the 120 s fetch ceiling (AbortSignal.timeout(120000) in the
// Gemini adapter) firing on a long segment: at the realized
// Ch 2 rate a ~1,394-char segment is ~87 s of audio, and
// provider latency can exceed the audio's own duration, so the
// fetch can die client-side with the provider's billing
// genuinely unknowable. Unknown billing stays FAIL-CLOSED —
// nothing here reclassifies a timeout. What changes is
// incidence: a segment over PRE_SPLIT_MAX_CHARS is split
// through the existing exact-concat machinery BEFORE its first
// provider attempt, so each call's expected generation time
// sits far below the fetch ceiling; and fix 2's operator route
// is the settlement path for any unknown that still occurs.
//
// B3 (Rowan HOLD, Oct 30, 2026): the threshold is NOT a
// completion guarantee and this suite asserts none. 1,200
// chars bounds only the audio-duration component (≤120 s at
// the pinned 10 chars/s — zero margin at that bound; ~75 s at
// the realized rate, ~45 s of headroom); end-to-end latency
// adds provider queueing/processing, time-to-first-byte, and
// network time that no chars model bounds, so a ≤1,200-char
// call can still time out. The threshold is kept at 1,200 as
// incidence reduction (Rowan's option (b)); the residual is
// carried by the fail-closed unknown-billing classification
// plus fix 2's reconcile path. Full analysis: the
// PRE_SPLIT_MAX_CHARS comment in policy-split.mjs and
// BUILD-REPORT §8.3.
//
// SEAM (decided by the baseline battery, disclosed here and in
// the build report): the pre-split lives at the EXECUTOR's
// pre-dispatch seam (synthesizeLongSegment, called from
// d6-executor runFresh only for over-ceiling segments), NOT
// inside synthesizeSegment. The baseline suite
// d6-policy-split.test.mjs pins synthesizeSegment's
// whole-segment semantics — exact split-tree call counts and
// depth measured from the segment root, on fixtures over
// 1,200 chars — and an in-splitter pre-split perturbs both
// (verified: 30 != 31 calls; a depth-terminal fixture resolving
// instead of throwing). synthesizeSegment is therefore
// byte-identical to the gen-pkg-1 baseline in this package;
// the composition happens above its contract.
import test from "node:test";
import assert from "node:assert/strict";
import {
  synthesizeSegment, synthesizeLongSegment, preSplitText,
  PRE_SPLIT_MAX_CHARS, TerminalBlock,
} from "../worker/generation/policy-split.mjs";
import { syntheticWav, policyBlockError } from "./helpers/d6-fakes.mjs";
import { makeHarness } from "./helpers/do-harness.mjs";
import {
  makeFakeR2Bucket, makeFakeD6Providers, sha256HexOf,
} from "./helpers/d6-fakes.mjs";
import { createFlushStore } from "../worker/generation/flush-store.mjs";
import { createD6Executor } from "../worker/generation/d6-executor.mjs";
import { createD6WorkSource } from "../worker/generation/d6-work-source.mjs";
import { createGenStore } from "../worker/generation/genstore.mjs";
import { fingerprintFor } from "../worker/executor.mjs";

function longText(targetChars, marker = null) {
  const sentences = [];
  let n = 0, len = 0;
  while (len < targetChars) {
    const s = `Synthetic sentence ${n} carries ordinary invented prose for splitting checks.`;
    sentences.push(s);
    len += s.length + 1;
    n += 1;
  }
  let text = sentences.join(" ");
  if (marker) text = text.replace("Synthetic sentence 1", `${marker} Synthetic sentence 1`);
  return text;
}

function recordingSynthesize(blockWhen = null) {
  const calls = [];
  const synthesize = async (payload) => {
    const blocked = blockWhen ? blockWhen(payload.text) : false;
    calls.push({ text: payload.text, blocked });
    if (blocked) throw policyBlockError();
    return syntheticWav(payload.text);
  };
  return { calls, synthesize };
}

const payload = (text) => ({
  provider: "gemini", model: "gemini-3.8-flash-tts",
  voice: "Zephyr", styleDirection: "", text,
});

test("fix3/B3: the threshold is the fetch ceiling at the pinned slowest rate (120 s × 10 chars/s = 1200) — a duration bound, NOT a completion guarantee", () => {
  assert.equal(PRE_SPLIT_MAX_CHARS, 1200);
});

test("fix3: preSplitText — identity at and under the ceiling; exact-concat chunks above it", () => {
  const exact = "word ".repeat(240).slice(0, PRE_SPLIT_MAX_CHARS);
  assert.equal(exact.length, PRE_SPLIT_MAX_CHARS);
  assert.deepEqual(preSplitText(exact), [exact], "at the ceiling: untouched, one chunk");

  const over = "word ".repeat(241).slice(0, PRE_SPLIT_MAX_CHARS + 1);
  assert.equal(over.length, PRE_SPLIT_MAX_CHARS + 1);
  const chunks = preSplitText(over);
  assert.ok(chunks.length >= 2, "one char over the ceiling already splits");
  assert.equal(chunks.join(""), over, "chunks concatenate EXACTLY, in order");
  for (const c of chunks) assert.ok(c.length <= PRE_SPLIT_MAX_CHARS);

  const long = longText(2600);
  const longChunks = preSplitText(long);
  assert.ok(longChunks.length >= 3, `2600 chars -> several chunks (got ${longChunks.length})`);
  assert.equal(longChunks.join(""), long);
  for (const c of longChunks) assert.ok(c.length <= PRE_SPLIT_MAX_CHARS, `chunk of ${c.length} chars is within the ceiling`);
});

test("fix3: an under-threshold segment passes through untouched — one call, the original text", async () => {
  const text = longText(800);
  const { calls, synthesize } = recordingSynthesize();
  const budget = { remaining: 12 };
  const r = await synthesizeLongSegment({ synthesize, payload: payload(text), budget });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].text, text, "the provider sees the segment exactly as before");
  assert.equal(r.parts.length, 1);
  assert.equal(r.attemptsUsed, 1);
});

test("fix3: an over-threshold segment is pre-split before its first attempt", async () => {
  const text = longText(2600);
  const { calls, synthesize } = recordingSynthesize();
  const budget = { remaining: 12 };
  const r = await synthesizeLongSegment({ synthesize, payload: payload(text), budget });
  assert.ok(calls.length >= 3, `pre-split produced multiple provider calls (got ${calls.length})`);
  for (const c of calls)
    assert.ok(c.text.length <= PRE_SPLIT_MAX_CHARS,
      `no provider call exceeds the ceiling (saw ${c.text.length} chars)`);
  assert.equal(calls.map((c) => c.text).join(""), text,
    "the calls' texts concatenate to the segment EXACTLY, in reading order");
  assert.equal(r.parts.length, calls.length, "one audio part per call, in order");
  assert.equal(r.attemptsUsed, calls.length);
  assert.equal(budget.remaining, 12 - calls.length, "the shared budget paid exactly the calls made");
});

test("fix3: pre-split composes with the policy path — a blocked chunk still splits further, order preserved", async () => {
  const text = longText(1500, "BLOCKME");
  // Blocks while a call still carries the marker in a long chunk;
  // small enough pieces pass.
  const { calls, synthesize } = recordingSynthesize(
    (t) => t.includes("BLOCKME") && t.length > 250);
  const budget = { remaining: 12 };
  const r = await synthesizeLongSegment({ synthesize, payload: payload(text), budget });
  assert.ok(calls.some((c) => c.blocked), "the policy path engaged inside a pre-split chunk");
  const leaves = calls.filter((c) => !c.blocked).map((c) => c.text);
  assert.equal(leaves.join(""), text, "successful leaves concatenate to the segment EXACTLY, in order");
  assert.equal(r.parts.length, leaves.length);
  assert.ok(r.attemptsUsed <= 12, "the whole segment stayed inside the pinned attempt ceiling");
  for (const c of calls) assert.ok(c.text.length <= PRE_SPLIT_MAX_CHARS);
});

test("fix3: the 12-attempt ceiling binds across ALL pre-split chunks (no per-chunk budget reset)", async () => {
  // Geometry chosen so the BUDGET is the binding limit: calls
  // longer than 200 chars block, shorter ones succeed, so every
  // subtree RETURNS (no terminal leaf — a terminal block aborts
  // depth-first by design, long before any budget could bind).
  // Per ~650-char pre-split chunk the tree costs 7 calls (650
  // blocked; 325+325 blocked; 4×~162 succeed), so the chunks
  // together want far more than 12. A per-chunk budget reset
  // would let them all through; the shared segment budget must
  // stop the segment at exactly 12 with attempt_budget_exhausted.
  const text = "aaaa ".repeat(520).trimEnd();
  assert.equal(text.length, 2599);
  const { calls, synthesize } = recordingSynthesize((t) => t.length > 200);
  const budget = { remaining: 12 };
  await assert.rejects(
    synthesizeLongSegment({ synthesize, payload: payload(text), budget }),
    (err) => err instanceof TerminalBlock && err.detail === "attempt_budget_exhausted",
    "the segment terminates on the attempt budget, not on depth or floor");
  assert.equal(calls.length, 12,
    "exactly the pinned ceiling of provider calls across the whole segment — pre-splitting multiplies no budget");
  assert.ok(calls.every((c) => c.text.length <= PRE_SPLIT_MAX_CHARS));
});

test("fix3: synthesizeSegment itself is unperturbed — a >1200-char direct call keeps whole-segment semantics", async () => {
  // The pinned contract, spot-checked here (the full pin is the
  // baseline d6-policy-split suite): direct callers of
  // synthesizeSegment see ONE root call for the whole text —
  // the pre-split exists only in the executor's composition.
  const text = longText(1500);
  const { calls, synthesize } = recordingSynthesize();
  const budget = { remaining: 12 };
  const r = await synthesizeSegment({ synthesize, payload: payload(text), budget });
  assert.equal(calls.length, 1, "no pre-split inside synthesizeSegment");
  assert.equal(calls[0].text, text);
  assert.equal(r.attemptsUsed, 1);
});

// ---- executor integration (the production seam) -----------------

const JOB = "job-ch2fix", BOOK = "book-1", PLAN = "plan-ch2fix", PHASE = "forever-pucked";
const payloadFor = (text) => ({
  text, voice: "Zephyr", provider: "gemini", model: "gemini-3.8-flash-tts",
  styleDirection: "warm", mode: "standard",
});

function bridgeProbe(bucket, flushStore) {
  const find = (cacheKey) => {
    for (const ext of ["wav", "mp3"]) {
      const key = flushStore.objectKeyFor(cacheKey, ext);
      const e = bucket.store.get(key);
      if (e) return { key, ...e };
    }
    return null;
  };
  return {
    exists: (k) => !!find(k),
    sniff: (k) => { const e = find(k); return e ? (e.key.endsWith(".mp3") ? "mp3" : "wav") : null; },
    recordedIdentity: (k) => { const e = find(k); return e ? (e.customMetadata?.identity ?? null) : null; },
    hash: (k) => { const e = find(k); return e ? sha256HexOf(e.bytes) : null; },
    recordedSha256: (k) => { const e = find(k); return e ? (e.customMetadata?.sha256 ?? null) : null; },
    keyFor: () => null,
  };
}

async function makeExecWorld(text) {
  const bucket = makeFakeR2Bucket();
  const flushStore = createFlushStore(bucket, { keyPrefix: "" });
  const h = makeHarness({ probe: bridgeProbe(bucket, flushStore) });
  const store = createGenStore(h.coord);
  store.ensureSchema();
  h.db.prepare(`INSERT OR IGNORE INTO d6_plans (plan_id, intent_key, book_id, scope, keep_going, phase, lane, state, created_at, updated_at)
                VALUES (?, ?, ?, 'book', 1, ?, 'standard', 'active', 0, 0)`)
    .run(PLAN, `intent-${PLAN}`, BOOK, PHASE);
  const data = {
    chapters: [{ chapterId: "ch-1", segments: [{ occurrenceId: "o1", text, pov: "pov-a" }] }],
    povs: [{ id: "pov-a", name: "Aria", voice: { voice_id: "Zephyr", provider: "gemini", model_id: "gemini-3.8-flash-tts", style_direction: "warm" } }],
  };
  h.db.prepare(`INSERT INTO sync_entities (family, entity_key, book_id, revision, deleted, data_json)
                VALUES ('content', ?, ?, 1, 0, ?)`).run(BOOK, BOOK, JSON.stringify(data));
  const providers = makeFakeD6Providers();
  const workSource = createD6WorkSource(h.coord, { cache: null });
  const exec = createD6Executor({ coord: h.coord, store, providers, flushStore, workSource, consumerId: "exec-ch2fix" });
  await h.coord.handleCommand({
    command_id: `cmd-${JOB}`, type: "SubmitJob",
    payload: { jobId: JOB, bookId: BOOK, chapterIndex: 0, lane: "standard",
               occurrences: [{ occurrenceId: "o1", revisionKey: fingerprintFor(payloadFor(text)), estMicroCents: 1000 }],
               data: { estMicroCents: 1000, d6PlanId: PLAN } },
  });
  const g = await h.coord.requestGrant(JOB);
  let msg = null;
  await h.coord.drainOutbox((p) => { msg = p; });
  assert.ok(msg && msg.grantId === g.grantId, "grant dispatched");
  return { bucket, flushStore, h, store, providers, exec, msg };
}

test("fix3 executor: an over-threshold segment commits from pre-split chunks — every call within the ceiling, stitched in order", async () => {
  const text = longText(2600);
  const w = await makeExecWorld(text);
  const r = await w.exec.handleMessage(w.msg);
  assert.equal(r.occurrences.o1.committed, true, "the long segment COMMITTED");
  assert.ok(w.providers.calls.length >= 3,
    `the executor pre-split the segment (calls: ${w.providers.calls.length})`);
  for (const c of w.providers.calls)
    assert.ok(c.text.length <= PRE_SPLIT_MAX_CHARS,
      `every provider call within the ceiling (saw ${c.text.length})`);
  assert.equal(w.providers.calls.map((c) => c.text).join(""), text,
    "provider call texts concatenate to the segment EXACTLY, in reading order");
  assert.ok(w.providers.calls.every((c) => c.voice === "Zephyr"),
    "same cast voice on every chunk call — never substituted");
  const atts = w.h.rows("d6_attempt_log");
  assert.equal(atts.length, w.providers.calls.length, "one logged attempt per provider call");
  assert.ok(atts.every((a) => a.outcome === "success"));
  const stored = [...w.bucket.store.values()][0];
  assert.equal(stored.bytes.byteLength, 44 + 480 * w.providers.calls.length,
    "the committed object is the stitched WAV of all chunk parts, in order");
  assert.equal(w.h.rows("bindings").length, 1, "one binding written by the commit");
});

test("fix3 executor: an under-threshold segment is the unchanged single call", async () => {
  const text = "Synthetic segment one carries a plain opening line of invented prose for testing.";
  const w = await makeExecWorld(text);
  const r = await w.exec.handleMessage(w.msg);
  assert.equal(r.occurrences.o1.committed, true);
  assert.equal(w.providers.calls.length, 1, "exactly one provider call — the pre-split branch is inert");
  assert.equal(w.providers.calls[0].text, text);
});
