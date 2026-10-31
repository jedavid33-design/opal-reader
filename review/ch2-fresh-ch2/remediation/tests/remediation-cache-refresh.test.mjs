// Remediation suite — Gate-8 reliability diagnosis, Signature B.
//
// The defect: in ONE invocation, the D6 work source primes a fresh
// occurrence's fingerprint key before synthesis; hydrateKey memoizes
// the miss as snapshot null; flushAndVerify then writes the object
// directly to R2; validateAndBind's probe reads the stale null and
// returns object_missing. The fix under test is the narrow one: the
// executor's commit gate calls cache.refreshKey, which discards ONLY
// a memoized miss and rehydrates the same snapshot the probe reads.
// Global miss memoization is deliberately unchanged.
//
// These tests wire the executor the way production does (worker-entry
// _execute): ONE R2 audio cache instance is shared by the work source
// (prime), the executor (commit-gate refresh), and the coordinator's
// probe (validateAndBind). The older d6-executor-fi suite bridges its
// probe straight to the bucket, which is why it could not see this
// defect. Synthetic text only. Run:
//   node --test tests/remediation-cache-refresh.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { makeHarness } from "./helpers/do-harness.mjs";
import {
  makeFakeR2Bucket, makeFakeD6Providers, sha256HexOf, syntheticWav, pcmToWav,
} from "./helpers/d6-fakes.mjs";
import { createFlushStore } from "../worker/generation/flush-store.mjs";
import { createD6Executor } from "../worker/generation/d6-executor.mjs";
import { createD6WorkSource } from "../worker/generation/d6-work-source.mjs";
import { createGenStore } from "../worker/generation/genstore.mjs";
import { createR2AudioCache } from "../worker/host/adapters.mjs";
import { fingerprintFor } from "../worker/executor.mjs";

const JOB = "job-remed-1";
const BOOK = "book-remed";
const PLAN = "plan-remed";
const PHASE = "forever-pucked";
const TEXT1 = "Synthetic remediation segment one, invented prose used only by this fixture.";
const payloadFor = (text) => ({
  text, voice: "Zephyr", provider: "gemini", model: "gemini-3.8-flash-tts",
  styleDirection: "warm", mode: "standard",
});

function countingBucket() {
  const bucket = makeFakeR2Bucket();
  const counts = { get: 0, head: 0, put: 0 };
  const origGet = bucket.get, origHead = bucket.head, origPut = bucket.put;
  bucket.get = async (...a) => { counts.get++; return origGet(...a); };
  bucket.head = async (...a) => { counts.head++; return origHead(...a); };
  bucket.put = async (...a) => { counts.put++; return origPut(...a); };
  return { bucket, counts };
}

function seedContent(h, segments) {
  const data = {
    chapters: [{ chapterId: "ch-1", segments: segments.map((s) => ({
      occurrenceId: s.occurrenceId, text: s.text, pov: "pov-a" })) }],
    povs: [{ id: "pov-a", name: "Aria", voice: {
      voice_id: "Zephyr", provider: "gemini",
      model_id: "gemini-3.8-flash-tts", style_direction: "warm" } }],
  };
  h.db.prepare(`INSERT INTO sync_entities (family, entity_key, book_id, revision, deleted, data_json)
                VALUES ('content', ?, ?, 1, 0, ?)`)
    .run(BOOK, BOOK, JSON.stringify(data));
}

async function makeWorld({ segments }) {
  const { bucket, counts } = countingBucket();
  const flushStore = createFlushStore(bucket, { keyPrefix: "" });
  const cache = createR2AudioCache(bucket);
  const h = makeHarness({ probe: cache.probe });
  const store = createGenStore(h.coord);
  store.ensureSchema();
  h.db.prepare(`INSERT OR IGNORE INTO d6_plans (plan_id, intent_key, book_id, scope, keep_going, phase, lane, state, created_at, updated_at)
                VALUES (?, ?, ?, 'book', 1, ?, 'standard', 'active', 0, 0)`)
    .run(PLAN, `intent-${PLAN}`, BOOK, PHASE);
  seedContent(h, segments);
  const providers = makeFakeD6Providers();
  const workSource = createD6WorkSource(h.coord, { cache });
  const mkExec = (over = {}) => createD6Executor({
    coord: h.coord, store, providers, flushStore, cache, workSource,
    consumerId: "exec-A", ...over,
  });
  const occs = segments.map((s) => ({
    occurrenceId: s.occurrenceId,
    revisionKey: fingerprintFor(payloadFor(s.text)), estMicroCents: 1000,
  }));
  await h.coord.handleCommand({
    command_id: `cmd-${JOB}`, type: "SubmitJob",
    payload: { jobId: JOB, bookId: BOOK, chapterIndex: 0, lane: "standard",
               occurrences: occs, data: { estMicroCents: 1000, d6PlanId: PLAN } },
  });
  const g = await h.coord.requestGrant(JOB);
  let msg = null;
  await h.coord.drainOutbox((p) => { msg = p; });
  assert.ok(msg && msg.grantId === g.grantId, "grant dispatched");
  return { bucket, counts, flushStore, cache, h, store, providers, workSource, mkExec, msg, g };
}

const bindings = (h) => h.rows("bindings");
const attempts = (h) => h.rows("d6_attempt_log");
const executions = (h) => h.rows("d6_execution_records");

// ------------------------------------------------------------- (a)

test("(a) single-invocation first-pass commit: prime -> synthesize -> flush -> commit in ONE invocation", async () => {
  const w = await makeWorld({ segments: [{ occurrenceId: "o1", text: TEXT1 }] });
  const cacheKey = fingerprintFor(payloadFor(TEXT1));
  const exec = w.mkExec();
  const r = await exec.handleMessage(w.msg);
  assert.equal(r.occurrences.o1.reported, "success");
  assert.equal(r.occurrences.o1.committed, true,
    "the fresh occurrence commits on the first pass, in the same invocation that primed its key");
  assert.equal(w.providers.calls.length, 1, "exactly one provider call");
  assert.equal(w.cache.probe.exists(cacheKey), true,
    "the refreshed object is visible in the SAME snapshot validateAndBind reads");
  assert.equal(bindings(w.h).length, 1);
  assert.equal(executions(w.h)[0].state, "committed");
  assert.equal(attempts(w.h).length, 1);
  assert.equal(attempts(w.h)[0].outcome, "success");
});

// ------------------------------------------------------------- (b)

test("(b) genuine preexisting winner with identical bytes is adopted and commits first-pass", async () => {
  const w = await makeWorld({ segments: [{ occurrenceId: "o1", text: TEXT1 }] });
  const cacheKey = fingerprintFor(payloadFor(TEXT1));
  const synth = syntheticWav(TEXT1);
  const objectKey = w.flushStore.objectKeyFor(cacheKey, "wav");
  await w.bucket.put(objectKey, synth.audio, {
    customMetadata: { sha256: sha256HexOf(synth.audio), identity: cacheKey,
                      duration_seconds: String(synth.durationSec) },
  });
  const r = await w.mkExec().handleMessage(w.msg);
  assert.equal(r.occurrences.o1.committed, true);
  assert.equal(w.providers.calls.length, 1,
    "current design still synthesizes once; flush adopts the digest-equal winner");
  assert.equal(bindings(w.h).length, 1);
  assert.equal(executions(w.h)[0].state, "committed");
  const stored = w.bucket.store.get(objectKey);
  assert.deepEqual([...stored.bytes], [...synth.audio], "winner bytes untouched");
});

// ------------------------------------------------------------- (c)

test("(c) different-byte conditional-PUT winner still fails closed with winner_digest_mismatch", async () => {
  const w = await makeWorld({ segments: [{ occurrenceId: "o1", text: TEXT1 }] });
  const cacheKey = fingerprintFor(payloadFor(TEXT1));
  const objectKey = w.flushStore.objectKeyFor(cacheKey, "wav");
  const winnerBytes = pcmToWav(new Uint8Array(960).fill(3));
  await w.bucket.put(objectKey, winnerBytes, {
    customMetadata: { sha256: sha256HexOf(winnerBytes), identity: cacheKey },
  });
  const r = await w.mkExec().handleMessage(w.msg);
  assert.equal(r.occurrences.o1.failed, true);
  assert.equal(r.occurrences.o1.stage, "flush");
  assert.equal(r.occurrences.o1.code, "winner_digest_mismatch",
    "Signature A stays fail-closed by design — the fix does not touch it");
  assert.equal(bindings(w.h).length, 0, "no binding over a mismatched winner");
  assert.equal(executions(w.h)[0].state, "failed");
  assert.equal(executions(w.h)[0].stage, "flush");
  const stored = w.bucket.store.get(objectKey);
  assert.deepEqual([...stored.bytes], [...winnerBytes], "winner never overwritten");
});

// ------------------------------------------------------------- (d)

test("(d) fresh-invocation intent recovery commits with ZERO new provider calls", async () => {
  const w = await makeWorld({ segments: [{ occurrenceId: "o1", text: TEXT1 }] });
  const cacheKey = fingerprintFor(payloadFor(TEXT1));
  const synth = syntheticWav(TEXT1);
  // The durable object a prior invocation's synthesis produced.
  await w.flushStore.flushAndVerify(cacheKey, synth.audio, "wav", synth.durationSec);
  // A KNOWN success was paid for under this fence (spend intent noted
  // success) but its commit never landed — the Oct 31 shape.
  const claim = w.h.coord.claimGrant({ grantId: w.msg.grantId, consumerId: "exec-A" });
  assert.ok(claim.status === "claimed" || claim.status === "already_claimed");
  const intent = w.h.coord.acquireSpendIntent({
    grantId: w.msg.grantId, jobId: JOB, occurrenceId: "o1", consumerId: "exec-A" });
  assert.equal(intent.acquired, true);
  w.h.coord.noteSpendOutcome({ jobId: JOB, occurrenceId: "o1",
    outcome: "success", detail: "synthetic intent-recovery fixture" });
  // FRESH invocation: a brand-new cache snapshot over the same bucket,
  // wired as the coordinator probe exactly as a new DO invocation's
  // _cache() would be.
  const freshCache = createR2AudioCache(w.bucket);
  w.h.env.probe = freshCache.probe;
  const execFresh = createD6Executor({
    coord: w.h.coord, store: w.store, providers: w.providers,
    flushStore: w.flushStore, cache: freshCache,
    workSource: createD6WorkSource(w.h.coord, { cache: freshCache }),
    consumerId: "exec-A",
  });
  const r = await execFresh.handleMessage(w.msg);
  assert.equal(r.occurrences.o1.committed, true);
  assert.equal(r.occurrences.o1.via, "recovery");
  assert.equal(w.providers.calls.length, 0, "ZERO provider calls on intent recovery");
  assert.equal(attempts(w.h).length, 0, "no attempt-log rows were created");
  assert.equal(bindings(w.h).length, 1);
  assert.equal(executions(w.h)[0].state, "committed");
});

// ------------------------------------------------- refreshKey unit

test("refreshKey: only a memoized miss is invalidated; positive and pending entries cost no read", async () => {
  const { bucket, counts } = countingBucket();
  const cache = createR2AudioCache(bucket);
  const key = "a".repeat(64);
  // Prime the miss: mp3 GET + wav GET, memoized null.
  assert.equal(await cache.hydrateKey(key), null);
  assert.equal(counts.get, 2);
  assert.equal(await cache.hydrateKey(key), null);
  assert.equal(counts.get, 2, "the miss stays memoized for ordinary consumers");
  // The object lands directly in R2 (the flushAndVerify shape).
  const synth = syntheticWav("synthetic refresh fixture");
  await bucket.put(`audio/${key}.wav`, synth.audio, {
    customMetadata: { sha256: sha256HexOf(synth.audio), identity: key } });
  const before = counts.get;
  const entry = await cache.refreshKey(key);
  assert.ok(entry, "refresh returns the now-durable entry");
  assert.equal(counts.get - before, 2,
    "refresh of a stale miss costs at most one GET per extension tried (mp3 miss + wav hit)");
  assert.equal(cache.probe.exists(key), true, "the probe sees the refreshed entry");
  assert.equal(cache.probe.hash(key), sha256HexOf(synth.audio));
  const before2 = counts.get;
  assert.equal(await cache.refreshKey(key), entry);
  assert.equal(counts.get - before2, 0, "a positive entry is never re-read by refresh");
  // A pending (write-behind) entry is not evicted either.
  const pendingKey = "b".repeat(64);
  cache.putIfAbsent(pendingKey, { audio: synth.audio, format: "wav", durationSec: 1 });
  const before3 = counts.get;
  const pendingEntry = await cache.refreshKey(pendingKey);
  assert.equal(pendingEntry.pending, true);
  assert.equal(counts.get - before3, 0, "pending entries cost no refresh read");
});

// ------------------------------------------------------------- (e)

test("(e) read-heavy behavior unchanged: hydrateKeys / byteCheck / primeForMigration read counts stay at baseline bounds", async () => {
  const { bucket, counts } = countingBucket();
  const cache = createR2AudioCache(bucket);
  const keyOf = (i) => i.toString(16).padStart(64, "0");
  const present = [], absent = [];
  const synth = syntheticWav("synthetic read-bound fixture");
  for (let i = 1; i <= 12; i++) {
    const k = keyOf(i);
    present.push(k);
    await bucket.put(`audio/${k}.wav`, synth.audio, {
      customMetadata: { sha256: sha256HexOf(synth.audio), identity: k } });
  }
  for (let i = 101; i <= 112; i++) absent.push(keyOf(i));
  const all = [...present, ...absent];
  // Baseline bound (unpatched hydrateKey semantics, unchanged by this
  // patch): each key costs exactly one GET per extension tried —
  // present wav keys: mp3 miss + wav hit = 2; absent keys: 2 misses.
  const start = counts.get;
  await cache.hydrateKeys(all);
  assert.equal(counts.get - start, 48, "24 keys x 2 GETs — exactly the baseline bound");
  const again = counts.get;
  await cache.hydrateKeys(all);
  assert.equal(counts.get - again, 0,
    "repeat hydration is fully memoized (hits AND misses) — no amplification");
  // byteCheck on an already-memoized miss stays free; a new miss
  // costs the same 2 GETs it cost before the patch, once.
  assert.equal(await cache.byteCheck(absent[0]), false);
  assert.equal(counts.get - again, 0);
  const freshAbsent = keyOf(999);
  assert.equal(await cache.byteCheck(freshAbsent), false);
  assert.equal(counts.get - again, 2);
  assert.equal(await cache.byteCheck(freshAbsent), false);
  assert.equal(counts.get - again, 2, "the second byteCheck is served by the memoized miss");
  // Migration prime bypasses the snapshot entirely (pre-existing
  // design): each call re-reads directly, and the snapshot is
  // neither consulted nor mutated by it.
  const entriesBefore = cache.stats().entries;
  const migStart = counts.get;
  const p1 = await cache.primeForMigration(present[0]);
  const p2 = await cache.primeForMigration(present[0]);
  assert.equal(p1.computedSha256, sha256HexOf(synth.audio));
  assert.deepEqual(p2, p1);
  assert.equal(counts.get - migStart, 4, "two direct primes x (mp3 miss + wav hit)");
  assert.equal(cache.stats().entries, entriesBefore,
    "primeForMigration does not mutate the snapshot");
});
