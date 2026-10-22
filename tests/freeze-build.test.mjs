// Run: node --test tests/freeze-build.test.mjs
// P8 freeze build proof (Roundtable Case #10, issue #15).
//
// The freeze variant (v2/p8/freeze-worker.js) is a full copy of the
// shipped Worker 1.4.43 with the P8 freeze applied per the mutation
// audit (v2/p8/freeze-audit.md) and Rowan's fence rulings D1–D4
// (issue #15, comment 6330405829). These tests drive the REAL variant
// module (and, for differential checks, the REAL shipped module) against
// the shared mock stores, and prove:
//   (1) every mutating census route returns 423 with zero writes;
//  (1b) auth order (Rowan 6330658336): the shipped authentication runs
//       BEFORE the freeze refusal — unauthenticated requests get the
//       shipped 401, byte-identical to the shipped worker; only an
//       authenticated request meets the 423;
//   (2) the D1 job GETs serve their stored reads with zero writes, zero
//       queue sends, zero waitUntil registrations, zero blocked-write
//       attempts (the reconciliations are skipped, not merely blocked);
//   (3) the D2 export GET: shipped failure responses keep precedence
//       (malformed token 400, unknown token 410 — auth first); a valid
//       link returns 423 and does NOT consume its token, and the same
//       link downloads normally once the freeze lifts;
//   (4) D3: a chapter-composite cache hit serves with zero writes, a
//       miss returns 423 and creates nothing, per-segment playback is
//       untouched;
//   (5) the queue consumer under freeze RETRIES without processing
//       (preservation redelivery, Rowan 6330658336) — never acks;
//  (5b) a job delivered while frozen resumes and completes after the
//       freeze lifts, its segment generated exactly once;
//   (6) the freeze engaging mid-job blocks every subsequent write, and
//       the in-flight message is retried, not acked;
//  (6b) mid-job resumption: after the lift, the interrupted job
//       completes exactly once in effect — no provider call repeats
//       for a completed segment, no output is duplicated;
//   (7) the mirror family is inert under freeze (catch-up never
//       scheduled; its writer is gated at its entry — source-pinned);
//   (8) recordTtsUsage is unreachable under freeze from both the speech
//       route and the job path (and works when the freeze is lifted,
//       proving the fence is the gate, not a broken recorder);
//   (9) every READ-ONLY census route is byte-identical between the
//       shipped Worker and the frozen variant on identical stored state;
//  (10) fail-closed completeness: the shipped route census (mechanically
//       re-extracted) has a freeze disposition for every key, and the
//       variant source carries every fence the dispositions require.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import shipped from "../cloudflare-worker.js";
import variant, { __freezeControl } from "../v2/p8/freeze-worker.js";
import {
  makeHarness,
  makeSegment,
  sha256Hex,
  wavBase64,
  RELEASE,
  CLIENT_VERSION,
} from "./support/mock-env.mjs";

const T0 = Date.UTC(2026, 9, 19, 18, 0, 0); // fixed virtual clock
const BOOK = "book-test-1";
const statusKey = (id) => `generation/status/${id}.json`;
const payloadKey = (id) => `generation/jobs/${id}.json`;
const markerKey = (bookId, ch, jobId) =>
  `generation/registry/${bookId}/${ch}/${jobId}.json`;

// ---- shared helpers -------------------------------------------------------

function storeSnapshot(h) {
  const kv = [...h.kv.store.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const r2 = [...h.r2.store.entries()]
    .map(([k, e]) => [
      k,
      typeof e.raw === "string"
        ? `s:${e.raw}`
        : `b:${Buffer.from(
            e.raw instanceof Uint8Array ? e.raw : new Uint8Array(e.raw),
          ).toString("base64")}`,
      e.etag,
      e.uploadedMs,
    ])
    .sort((a, b) => (a[0] < b[0] ? -1 : 1));
  return { kv, r2 };
}

function counters(h) {
  return {
    kvPuts: h.kv.putCalls.length,
    r2Puts: h.r2.putCalls.length,
    sends: h.queue.sentLog.length,
    waitUntil: h.background.length,
  };
}

function assertUnchanged(h, snap, counts, what) {
  assert.deepEqual(storeSnapshot(h), snap, `${what}: store contents changed`);
  assert.deepEqual(counters(h), counts, `${what}: write counters moved`);
}

async function bodyBytes(res) {
  return Buffer.from(await res.arrayBuffer()).toString("base64");
}

function seedJob(h, jobId, { state = "queued", segmentStates = ["queued"], updatedAt = T0 } = {}) {
  const segments = segmentStates.map((s, i) => ({
    cache_key: sha256Hex(`seg-${jobId}-${i}`),
    state: s,
  }));
  const status = {
    job_id: jobId,
    book_id: BOOK,
    chapter_index: 0,
    state,
    completed: 0,
    total: segments.length,
    segments,
    updated_at: updatedAt,
    generation_release: RELEASE,
    client_version: CLIENT_VERSION,
  };
  const payload = {
    job_id: jobId,
    book_id: BOOK,
    chapter_index: 0,
    generation_release: RELEASE,
    client_version: CLIENT_VERSION,
    segments: segmentStates.map((s, i) => ({
      ...makeSegment(`payload-${jobId}-${i}`),
      cache_key: segments[i].cache_key,
    })),
  };
  return { status, payload };
}

async function putJob(h, jobId, opts) {
  const { status, payload } = seedJob(h, jobId, opts);
  await h.r2.put(statusKey(jobId), JSON.stringify(status));
  await h.r2.put(payloadKey(jobId), JSON.stringify(payload));
  return { status, payload };
}

// ---- (1) 423 for every mutating route -------------------------------------

test("(1) every mutating census route returns 423 and writes nothing", async () => {
  assert.equal(__freezeControl.engaged(), true, "variant boots frozen");
  __freezeControl.resetBlockedWrites();
  const h = makeHarness(variant, { clockStart: T0 });
  try {
    const jobId = sha256Hex("freeze-423-job");
    await putJob(h, jobId, {});
    await h.kv.put(`book:${BOOK}`, JSON.stringify({ id: BOOK, title: "T" }));
    const snap = storeSnapshot(h);
    const counts = counters(h);
    const seg = makeSegment("freeze-423");
    const routes = [
      ["PUT", `/api/sync/book/${BOOK}`, { id: BOOK, title: "Changed" }],
      ["DELETE", `/api/sync/book/${BOOK}`],
      ["DELETE", `/api/sync/deleted/${BOOK}`],
      ["PUT", "/api/sync/settings", { settings: { theme: "dark" } }],
      ["PUT", `/api/sync/epub/${BOOK}`, { data: "x" }],
      ["POST", "/api/export/audio-url", { key: seg.cache_key }],
      ["DELETE", "/api/audio/purge", { book_id: BOOK }],
      ["POST", "/api/generation/jobs", {
        job_id: sha256Hex("freeze-423-new"),
        book_id: BOOK,
        chapter_index: 0,
        generation_release: RELEASE,
        client_version: CLIENT_VERSION,
        segments: [seg],
      }],
      ["POST", `/api/generation/jobs/${jobId}/resume`],
      ["POST", "/api/generation/continue", { session_id: sha256Hex("s"), book_id: BOOK, jobs: [] }],
      ["POST", "/api/generation/continue/stage", { session_id: sha256Hex("s"), book_id: BOOK, jobs: [] }],
      ["POST", "/api/generation/continue/finalize", { session_id: sha256Hex("s"), book_id: BOOK }],
      ["POST", "/api/providers/azure/speech", seg],
      ["POST", "/api/providers/fish/speech", seg],
      ["POST", "/api/providers/openai/speech", seg],
      ["POST", "/api/providers/gemini/speech", seg],
      // The D2 export GET is deliberately NOT in this sweep: under
      // auth-first its refusal lives inside its handler (test (3)),
      // and an unknown token now correctly gets the shipped 410.
    ];
    for (const [method, path, body] of routes) {
      const res = await h.request(path, { method, body });
      assert.equal(res.status, 423, `${method} ${path} must return 423`);
      const parsed = await res.json();
      assert.equal(typeof parsed.error, "string", `${method} ${path} returns an error body`);
    }
    assertUnchanged(h, snap, counts, "423 sweep");
    assert.equal(
      __freezeControl.blockedWrites().count,
      0,
      "423s are refused at the route, before any write is attempted",
    );
    // D4 corollary: no usage events were recorded by the refused speech POSTs.
    assert.equal(
      [...h.r2.store.keys()].filter((k) => k.startsWith("usage/")).length,
      0,
      "no usage ledger objects created",
    );
  } finally {
    h.restore();
  }
});

// ---- (1b) auth order: shipped authentication precedes the 423 ---------------

test("(1b) unauthenticated requests get the shipped 401 — the refusal never precedes auth", async () => {
  assert.equal(__freezeControl.engaged(), true, "variant boots frozen");
  __freezeControl.resetBlockedWrites();
  const seg = makeSegment("freeze-auth");
  const jobId = sha256Hex("freeze-auth-job");
  const routes = [
    ["PUT", `/api/sync/book/${BOOK}`, { id: BOOK, title: "Changed" }],
    ["POST", "/api/generation/jobs", {
      job_id: jobId,
      book_id: BOOK,
      chapter_index: 0,
      generation_release: RELEASE,
      client_version: CLIENT_VERSION,
      segments: [seg],
    }],
    ["POST", "/api/providers/gemini/speech", seg],
    ["POST", "/api/export/audio-url", { key: seg.cache_key }],
    ["DELETE", "/api/audio/purge", { book_id: BOOK }],
  ];
  const raw = (worker, h, path, { method, body, token } = {}) =>
    worker.fetch(
      new Request(`https://reader.test${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token !== undefined ? { "X-OpalReader-Token": token } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      }),
      h.env,
      h.ctx,
    );

  // Differential: for every refused-route representative, the frozen
  // variant's unauthenticated response is the SHIPPED 401 — same
  // status, same body bytes — with and without a (wrong) token header.
  // (Shipped responses are collected first: harnesses patch globals
  // and cannot be alive at the same time.)
  const expected401 = new Map();
  const hs = makeHarness(shipped, { clockStart: T0 });
  try {
    for (const [method, path, body] of routes) {
      for (const token of [undefined, "wrong-token"]) {
        const res = await raw(shipped, hs, path, { method, body, token });
        assert.equal(res.status, 401, "shipped sanity: the same request 401s unfrozen");
        expected401.set(`${method} ${path} ${token}`, await bodyBytes(res));
      }
    }
  } finally {
    hs.restore();
  }

  const h = makeHarness(variant, { clockStart: T0 });
  try {
    await h.kv.put(`book:${BOOK}`, JSON.stringify({ id: BOOK, title: "T" }));
    const snap = storeSnapshot(h);
    const counts = counters(h);
    for (const [method, path, body] of routes) {
      for (const token of [undefined, "wrong-token"]) {
        const res = await raw(variant, h, path, { method, body, token });
        assert.equal(res.status, 401, `${method} ${path} (token: ${token}) must 401, not 423`);
        assert.equal(
          await bodyBytes(res),
          expected401.get(`${method} ${path} ${token}`),
          `${method} ${path}: 401 body is byte-identical to shipped`,
        );
      }
      // The authenticated counterpart meets the refusal: auth first,
      // then — and only then — the 423.
      const authed = await h.request(path, { method, body });
      assert.equal(authed.status, 423, `${method} ${path} authenticated must 423`);
    }
    assertUnchanged(h, snap, counts, "auth-order sweep");
    assert.equal(
      __freezeControl.blockedWrites().count,
      0,
      "unauthenticated requests never reach a handler write attempt",
    );
  } finally {
    h.restore();
  }
});

// ---- (2) D1: the mutating status GET serves read-only ----------------------

test("(2) D1 status GET: stored status served, watchdog/marker/catch-up all disabled", async () => {
  __freezeControl.resetBlockedWrites();
  const jobId = sha256Hex("freeze-d1-status");
  // Scenario: a stale "generating" job whose registry marker is absent.
  // On the shipped worker this single poll creates the marker (PUT),
  // and — with a stale updated_at — runs the poll-time watchdog (status
  // save + queue send) and schedules the mirror catch-up on waitUntil.
  const seed = (h) =>
    putJob(h, jobId, {
      state: "generating",
      segmentStates: ["queued"],
      updatedAt: T0 - 10 * 60 * 1000,
    });

  // Sanity: the shipped worker really is side-effecting on this seed.
  const hs = makeHarness(shipped, { clockStart: T0 });
  try {
    const { status } = await seed(hs);
    const res = await hs.request(`/api/generation/jobs/${jobId}`);
    assert.equal(res.status, 200);
    assert.ok(
      hs.r2.putCalls.length > 0 || hs.queue.sentLog.length > 0,
      "shipped status poll performed writes/sends on this seed (scenario is live)",
    );
    assert.ok(hs.background.length > 0, "shipped poll scheduled the waitUntil catch-up");
    void status;
  } finally {
    hs.restore();
  }

  const h = makeHarness(variant, { clockStart: T0 });
  try {
    const { status } = await seed(h);
    const snap = storeSnapshot(h);
    const counts = counters(h);
    const res = await h.request(`/api/generation/jobs/${jobId}`);
    assert.equal(res.status, 200);
    assert.deepEqual(
      await res.json(),
      status,
      "the frozen read returns the stored status, unreconciled",
    );
    assertUnchanged(h, snap, counts, "D1 status GET");
    assert.equal(h.background.length, 0, "no waitUntil catch-up was scheduled");
    assert.equal(
      __freezeControl.blockedWrites().count,
      0,
      "reconciliations were skipped surgically — no write was even attempted",
    );
    assert.ok(
      !h.r2.store.has(markerKey(BOOK, 0, jobId)),
      "the registry marker was NOT created by the frozen poll",
    );
  } finally {
    h.restore();
  }
});

test("(2b) D1 status GET on a terminal job: mirror catch-up is never scheduled", async () => {
  const jobId = sha256Hex("freeze-d1-terminal");
  const seedTerminal = async (h) => {
    const { status } = await putJob(h, jobId, {
      state: "ready",
      segmentStates: ["ready"],
    });
    // Steady state: registry marker exists; KV mirror does not (the
    // exact situation the shipped catch-up exists to converge).
    await h.r2.put(
      markerKey(BOOK, 0, jobId),
      JSON.stringify({
        job_id: jobId,
        book_id: BOOK,
        chapter_index: 0,
        kind: "chapter",
        continue_session_id: null,
        generation_release: RELEASE,
        created_at: T0,
      }),
    );
    return status;
  };

  const hs = makeHarness(shipped, { clockStart: T0 });
  try {
    await seedTerminal(hs);
    const res = await hs.request(`/api/generation/jobs/${jobId}`);
    assert.equal(res.status, 200);
    assert.ok(hs.background.length > 0, "shipped poll scheduled the catch-up");
    await hs.flushBackground();
    assert.ok(
      hs.kv.store.has(`generation:${jobId}`),
      "shipped catch-up wrote the KV mirror (scenario is live)",
    );
  } finally {
    hs.restore();
  }

  const h = makeHarness(variant, { clockStart: T0 });
  try {
    const status = await seedTerminal(h);
    const snap = storeSnapshot(h);
    const counts = counters(h);
    const res = await h.request(`/api/generation/jobs/${jobId}`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), status);
    assert.equal(h.background.length, 0, "frozen poll scheduled no catch-up");
    assertUnchanged(h, snap, counts, "D1 terminal status GET");
    assert.ok(!h.kv.store.has(`generation:${jobId}`), "no KV mirror was written");
  } finally {
    h.restore();
  }
});

// ---- (2c) D1: discovery GET serves read-only --------------------------------

test("(2c) D1 books/jobs GET: discovery from stored state, backfill/reconcile deferred", async () => {
  const jobId = sha256Hex("freeze-d1-discovery");
  const seedDiscovery = async (h, { withScan = true } = {}) => {
    await putJob(h, jobId, { state: "ready", segmentStates: ["ready"] });
    await h.r2.put(
      markerKey(BOOK, 0, jobId),
      JSON.stringify({
        job_id: jobId,
        book_id: BOOK,
        chapter_index: 0,
        kind: "chapter",
        continue_session_id: null,
        generation_release: RELEASE,
        created_at: T0,
      }),
    );
    if (withScan)
      await h.r2.put(
        `generation/registry/${BOOK}/_scan.json`,
        JSON.stringify({ book_id: BOOK, scanned_at: T0, pages: 1 }),
      );
  };

  // Steady state (scan done, no pending): the frozen response must be
  // the shipped response, byte for byte in structure.
  const hs = makeHarness(shipped, { clockStart: T0 });
  let shippedBody;
  try {
    await seedDiscovery(hs);
    const res = await hs.request(`/api/generation/books/${BOOK}/jobs`);
    assert.equal(res.status, 200);
    shippedBody = await res.json();
  } finally {
    hs.restore();
  }

  const h = makeHarness(variant, { clockStart: T0 });
  try {
    await seedDiscovery(h);
    const snap = storeSnapshot(h);
    const counts = counters(h);
    const res = await h.request(`/api/generation/books/${BOOK}/jobs`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), shippedBody, "frozen discovery matches shipped in steady state");
    assertUnchanged(h, snap, counts, "D1 discovery GET");
  } finally {
    h.restore();
  }

  // Unreconciled state (a durable pending record, no scan marker): the
  // frozen read must still write nothing — the pending record is
  // counted, not drained, and the backfill reports "deferred".
  const h2 = makeHarness(variant, { clockStart: T0 });
  try {
    await seedDiscovery(h2, { withScan: false });
    const pendingId = sha256Hex("freeze-d1-pending");
    await h2.r2.put(
      `generation/registry-pending/${pendingId}.json`,
      JSON.stringify({
        job_id: pendingId,
        book_id: BOOK,
        chapter_index: 1,
        kind: "chapter",
        continue_session_id: null,
        generation_release: RELEASE,
        created_at: T0,
        failed_at: T0,
      }),
    );
    const snap = storeSnapshot(h2);
    const counts = counters(h2);
    const res = await h2.request(`/api/generation/books/${BOOK}/jobs`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.registry_pending, 1, "pending record counted, not drained");
    assert.equal(body.legacy_scan, "deferred", "backfill deferred by the freeze");
    assertUnchanged(h2, snap, counts, "D1 discovery GET (unreconciled seed)");
    assert.ok(
      h2.r2.store.has(`generation/registry-pending/${pendingId}.json`),
      "pending record left in place",
    );
  } finally {
    h2.restore();
  }
});

// ---- (3) D2: export GET --------------------------------------------------------

test("(3) D2 export GET: shipped auth failures precede the 423; a valid link is refused unconsumed", async () => {
  const token = "a".repeat(32);
  const cacheKey = sha256Hex("freeze-d2-audio");
  const wav = new Uint8Array(Buffer.from(wavBase64(0.2), "base64"));
  const seedExport = async (h) => {
    await h.kv.put(
      `audio-export:${token}`,
      JSON.stringify({ key: cacheKey, filename: "seg.wav" }),
    );
    await h.r2.put(`audio/${cacheKey}.wav`, wav);
  };

  // Shipped reference behavior: a valid link downloads AND consumes
  // the token; a malformed token gets the shipped 400; an unknown
  // token gets the shipped 410.
  const shippedFailures = {};
  const hs = makeHarness(shipped, { clockStart: T0 });
  try {
    await seedExport(hs);
    const res = await hs.request(`/api/export/audio/${token}`);
    assert.equal(res.status, 200, "shipped export link downloads");
    assert.ok(
      !hs.kv.store.has(`audio-export:${token}`),
      "shipped GET consumed (deleted) the token — scenario is live",
    );
    const bad = await hs.request(`/api/export/audio/not-a-token`);
    shippedFailures.malformed = { status: bad.status, body: await bodyBytes(bad) };
    const unknown = await hs.request(`/api/export/audio/${"b".repeat(32)}`);
    shippedFailures.unknown = { status: unknown.status, body: await bodyBytes(unknown) };
    assert.equal(shippedFailures.malformed.status, 400);
    assert.equal(shippedFailures.unknown.status, 410);
  } finally {
    hs.restore();
  }

  const h = makeHarness(variant, { clockStart: T0 });
  try {
    await seedExport(h);
    // Auth first: the shipped failure responses keep precedence over
    // the freeze refusal, byte-identical — the freeze never turns a
    // bad link into a 423.
    const bad = await h.request(`/api/export/audio/not-a-token`);
    assert.equal(bad.status, shippedFailures.malformed.status, "malformed token: shipped 400, not 423");
    assert.equal(await bodyBytes(bad), shippedFailures.malformed.body);
    const unknown = await h.request(`/api/export/audio/${"b".repeat(32)}`);
    assert.equal(unknown.status, shippedFailures.unknown.status, "unknown token: shipped 410, not 423");
    assert.equal(await bodyBytes(unknown), shippedFailures.unknown.body);

    // A VALID link meets the refusal — and the token is not consumed.
    const snap = storeSnapshot(h);
    const counts = counters(h);
    const res = await h.request(`/api/export/audio/${token}`);
    assert.equal(res.status, 423);
    assert.ok(h.kv.store.has(`audio-export:${token}`), "token NOT consumed while frozen");
    assertUnchanged(h, snap, counts, "D2 export GET");

    // Preservation: because the frozen refusal left the token intact,
    // the very same link downloads once the freeze lifts.
    __freezeControl.disengage();
    const after = await h.request(`/api/export/audio/${token}`);
    assert.equal(after.status, 200, "the same link works after the freeze lifts");
    assert.ok(!h.kv.store.has(`audio-export:${token}`), "and is consumed then, as shipped");
  } finally {
    __freezeControl.engage();
    h.restore();
  }
});

// ---- (4) D3: chapter composite --------------------------------------------------

test("(4) D3 composite POST: hit serves read-only, miss 423s, segment fallback intact", async () => {
  const k1 = sha256Hex("freeze-d3-seg-1");
  const k2 = sha256Hex("freeze-d3-seg-2");
  const compositeKey = sha256Hex(`wav-data-chunks-v2|${BOOK}|0|${k1}|${k2}`);
  const segWav = new Uint8Array(Buffer.from(wavBase64(0.2), "base64"));
  const compositeWav = new Uint8Array(Buffer.from(wavBase64(0.5), "base64"));
  const body = { book_id: BOOK, chapter_index: 0, audio_keys: [k1, k2] };
  const seedSegments = async (h, { withComposite }) => {
    await h.r2.put(`audio/${k1}.wav`, segWav);
    await h.r2.put(`audio/${k2}.wav`, segWav);
    if (withComposite)
      await h.r2.put(`chapter-audio/${compositeKey}.wav`, compositeWav);
  };

  // HIT: the frozen variant serves the stored composite, zero writes —
  // and the shipped worker serves the identical bytes as a HIT too.
  const hs = makeHarness(shipped, { clockStart: T0 });
  let shippedHit;
  try {
    await seedSegments(hs, { withComposite: true });
    const res = await hs.request("/api/playback/chapter", { method: "POST", body });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("X-OpalReader-Cache"), "HIT");
    shippedHit = await bodyBytes(res);
  } finally {
    hs.restore();
  }

  const h = makeHarness(variant, { clockStart: T0 });
  try {
    await seedSegments(h, { withComposite: true });
    const snap = storeSnapshot(h);
    const counts = counters(h);
    const res = await h.request("/api/playback/chapter", { method: "POST", body });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("X-OpalReader-Cache"), "HIT");
    assert.equal(await bodyBytes(res), shippedHit, "frozen HIT serves the shipped bytes");
    assertUnchanged(h, snap, counts, "D3 composite HIT");

    // Fallback: per-segment playback is a read and keeps working.
    const seg = await h.request(`/api/sync/audio/${k1}`);
    assert.equal(seg.status, 200);
    assert.equal(
      await bodyBytes(seg),
      Buffer.from(segWav).toString("base64"),
      "segment GET serves the segment bytes under freeze",
    );
    assertUnchanged(h, snap, counts, "D3 segment fallback GET");
  } finally {
    h.restore();
  }

  // MISS: the frozen variant refuses (423) and creates nothing; the
  // shipped worker on the same seed composes and caches (sanity).
  const hs2 = makeHarness(shipped, { clockStart: T0 });
  try {
    await seedSegments(hs2, { withComposite: false });
    const res = await hs2.request("/api/playback/chapter", { method: "POST", body });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("X-OpalReader-Cache"), "MISS");
    assert.ok(
      hs2.r2.store.has(`chapter-audio/${compositeKey}.wav`),
      "shipped miss composed + cached the composite (scenario is live)",
    );
  } finally {
    hs2.restore();
  }

  const h2 = makeHarness(variant, { clockStart: T0 });
  try {
    await seedSegments(h2, { withComposite: false });
    const snap = storeSnapshot(h2);
    const counts = counters(h2);
    const res = await h2.request("/api/playback/chapter", { method: "POST", body });
    assert.equal(res.status, 423, "frozen miss is refused, not composed");
    assert.ok(
      !h2.r2.store.has(`chapter-audio/${compositeKey}.wav`),
      "no composite was created",
    );
    assertUnchanged(h2, snap, counts, "D3 composite MISS");
  } finally {
    h2.restore();
  }
});

// ---- (5) queue consumer under freeze ---------------------------------------------

test("(5) queue consumer under freeze retries (preservation) without processing or writing", async () => {
  const h = makeHarness(variant, { clockStart: T0 });
  try {
    const jobId = sha256Hex("freeze-queue-job");
    await putJob(h, jobId, { state: "queued", segmentStates: ["queued"] });
    const snap = storeSnapshot(h);
    const counts = counters(h);
    let acked = 0;
    const retryOpts = [];
    await variant.queue(
      {
        messages: [
          {
            body: { job_id: jobId, segment_index: 0 },
            attempts: 1,
            ack() { acked++; },
            retry(opts) { retryOpts.push(opts); },
          },
        ],
      },
      h.env,
    );
    assert.equal(acked, 0, "a frozen delivery is never acked — acking would drop the work");
    assert.equal(retryOpts.length, 1, "the delivery is retried for redelivery after the freeze");
    assert.equal(
      retryOpts[0].delaySeconds,
      900,
      "redelivery carries the documented preservation delay (FREEZE_RETRY_DELAY_SECONDS)",
    );
    assertUnchanged(h, snap, counts, "frozen queue delivery");
    assert.equal(h.google.calls.interactions, 0, "no provider call was made");
    const status = await h.r2.readJson(statusKey(jobId));
    assert.equal(status.state, "queued", "the job did not advance");
  } finally {
    h.restore();
  }
});

test("(5b) a job delivered while frozen resumes and completes after the lift — segment generated exactly once", async () => {
  __freezeControl.disengage();
  const h = makeHarness(variant, { clockStart: T0 });
  try {
    const jobId = sha256Hex("freeze-resume-frozen-job");
    const created = await h.request("/api/generation/jobs", {
      method: "POST",
      body: {
        job_id: jobId,
        book_id: BOOK,
        chapter_index: 0,
        generation_release: RELEASE,
        client_version: CLIENT_VERSION,
        segments: [makeSegment("resume-frozen-1")],
      },
    });
    assert.equal(created.status, 202, "job creation works on the variant while unfrozen");
    assert.equal(h.queue.pending.length, 1);
    const msg = h.queue.pending.shift();

    // Deliver while frozen: retried with the preservation delay; the
    // job is left exactly as created.
    __freezeControl.engage();
    const snap = storeSnapshot(h);
    const counts = counters(h);
    let acked = 0;
    const retryOpts = [];
    await variant.queue(
      { messages: [{ body: msg.body, attempts: 1, ack() { acked++; }, retry(o) { retryOpts.push(o); } }] },
      h.env,
    );
    assert.equal(acked, 0);
    assert.equal(retryOpts.length, 1);
    assert.equal(retryOpts[0].delaySeconds, 900);
    assertUnchanged(h, snap, counts, "frozen delivery (5b)");
    assert.equal(h.google.calls.interactions, 0, "no provider call while frozen");
    assert.equal((await h.r2.readJson(statusKey(jobId))).state, "queued", "job untouched");

    // Lift the freeze and redeliver the SAME message: the job resumes
    // from its checkpoint and completes; its one segment is generated
    // exactly once (the frozen delivery spent no provider call).
    __freezeControl.disengage();
    h.clock.advance(120000);
    let acked2 = 0;
    const retryOpts2 = [];
    await variant.queue(
      { messages: [{ body: msg.body, attempts: 2, ack() { acked2++; }, retry(o) { retryOpts2.push(o); } }] },
      h.env,
    );
    assert.equal(acked2, 1, "redelivered work is processed and acked after the lift");
    assert.equal(retryOpts2.length, 0);
    await h.drain();
    const status = await h.r2.readJson(statusKey(jobId));
    assert.equal(status.state, "ready", "the job completed after resumption");
    assert.equal(status.segments[0].state, "ready");
    assert.equal(h.google.calls.interactions, 1, "the segment was generated exactly once");
  } finally {
    __freezeControl.engage();
    h.restore();
  }
});

// ---- (6) the race: freeze engages mid-job ---------------------------------------

test("(6) freeze engaging mid-job blocks every subsequent write from that job", async () => {
  __freezeControl.disengage();
  const H = { h: null };
  let armed = false;
  let atEngagement = null;
  const flip = () => {
    if (!armed || atEngagement || !H.h) return;
    // Snapshot INSIDE the first write hook: MockKV/MockR2 record the
    // call before invoking the hook, so the counters below include the
    // one admitted in-flight write — and nothing after it may land.
    atEngagement = {
      kvPuts: H.h.kv.putCalls.length,
      r2Puts: H.h.r2.putCalls.length,
      sends: H.h.queue.sentLog.length,
      usageObjects: [...H.h.r2.store.keys()].filter((k) => k.startsWith("usage/")).length,
    };
    __freezeControl.engage();
  };
  const h = makeHarness(variant, {
    clockStart: T0,
    kvHooks: { onPut: flip },
    r2Hooks: { onPut: flip },
  });
  H.h = h;
  try {
    const jobId = sha256Hex("freeze-race-job");
    const created = await h.request("/api/generation/jobs", {
      method: "POST",
      body: {
        job_id: jobId,
        book_id: BOOK,
        chapter_index: 0,
        generation_release: RELEASE,
        client_version: CLIENT_VERSION,
        segments: [makeSegment("race-1")],
      },
    });
    assert.equal(created.status, 202, "job creation works on the variant while unfrozen");
    assert.equal(h.queue.pending.length, 1, "creation dispatched the first queue message");

    __freezeControl.resetBlockedWrites();
    armed = true;
    let acked = 0;
    const retryOpts = [];
    const msg = h.queue.pending.shift();
    await variant.queue(
      {
        messages: [
          {
            body: msg.body,
            attempts: 1,
            ack() { acked++; },
            retry(opts) { retryOpts.push(opts); },
          },
        ],
      },
      h.env,
    );
    assert.ok(atEngagement, "the job attempted at least one write (scenario is live)");
    assert.equal(acked, 0, "mid-flight frozen work is never acked — it must survive the freeze");
    assert.equal(retryOpts.length, 1, "the in-flight message is retried for redelivery");
    assert.equal(retryOpts[0].delaySeconds, 900, "with the preservation delay");
    assert.equal(h.kv.putCalls.length, atEngagement.kvPuts, "no KV write landed after engagement");
    assert.equal(h.r2.putCalls.length, atEngagement.r2Puts, "no R2 write landed after engagement");
    assert.equal(h.queue.sentLog.length, atEngagement.sends, "no queue send landed after engagement");
    assert.equal(
      [...h.r2.store.keys()].filter((k) => k.startsWith("usage/")).length,
      atEngagement.usageObjects,
      "(8) no usage-ledger write landed from the job path after engagement",
    );
    assert.ok(
      __freezeControl.blockedWrites().count >= 1,
      "the gate actively refused at least one post-engagement write",
    );
  } finally {
    __freezeControl.engage();
    h.restore();
  }
});

// ---- (6b) mid-job resumption: exactly once in effect -----------------------------

test("(6b) freeze engaging mid-job: message preserved, resumption completes the job exactly once in effect", async () => {
  __freezeControl.disengage();
  const H = { h: null };
  let armed = false;
  let atEngagement = null;
  const flip = () => {
    if (!armed || atEngagement || !H.h) return;
    atEngagement = {
      kvPuts: H.h.kv.putCalls.length,
      r2Puts: H.h.r2.putCalls.length,
      sends: H.h.queue.sentLog.length,
    };
    __freezeControl.engage();
  };
  // Per-segment provider accounting: the interactions request body
  // carries the segment's narration text, which names its seed.
  const providerBodies = [];
  const h = makeHarness(variant, {
    clockStart: T0,
    kvHooks: { onPut: flip },
    r2Hooks: { onPut: flip },
    fetchBehavior: {
      onInteractions: (n, init) => {
        providerBodies.push(String(init?.body || ""));
      },
    },
  });
  H.h = h;
  const deliver = async (msg, attempts) => {
    const rec = { acked: 0, retryOpts: [] };
    await variant.queue(
      {
        messages: [
          {
            body: msg.body,
            attempts,
            ack() { rec.acked++; },
            retry(o) { rec.retryOpts.push(o); },
          },
        ],
      },
      h.env,
    );
    return rec;
  };
  try {
    const jobId = sha256Hex("freeze-resume-mid-job");
    const segs = [makeSegment("resume-a"), makeSegment("resume-b"), makeSegment("resume-c")];
    const created = await h.request("/api/generation/jobs", {
      method: "POST",
      body: {
        job_id: jobId,
        book_id: BOOK,
        chapter_index: 0,
        generation_release: RELEASE,
        client_version: CLIENT_VERSION,
        segments: segs,
      },
    });
    assert.equal(created.status, 202, "job creation works on the variant while unfrozen");
    assert.equal(h.queue.pending.length, 1);

    // Delivery 1 (unfrozen): segment A completes; the job chains the
    // segment-B message.
    const r1 = await deliver(h.queue.pending.shift(), 1);
    assert.equal(r1.acked, 1);
    assert.equal(providerBodies.length, 1, "one provider call so far");
    assert.ok(providerBodies[0].includes("resume-a"), "and it was segment A's");
    assert.equal(h.queue.pending.length, 1, "the job chained the next message");
    let status = await h.r2.readJson(statusKey(jobId));
    assert.equal(status.segments[0].state, "ready", "segment A is checkpointed complete");

    // Delivery 2: the freeze engages on the job's first write (its
    // processing lease, ahead of any dispatch for segment B). The
    // lease write itself lands (it is the write the engagement hooks
    // fire on); every write after it is refused — including the
    // finally-block lease release, whose delete the guard blocks and
    // releaseProcessingLease swallows — so the lease is ORPHANED.
    __freezeControl.resetBlockedWrites();
    armed = true;
    const msgB = h.queue.pending.shift();
    const r2 = await deliver(msgB, 1);
    assert.ok(atEngagement, "the job attempted at least one write (scenario is live)");
    assert.equal(r2.acked, 0, "the interrupted message is NOT acked");
    assert.equal(r2.retryOpts.length, 1, "it is retried for redelivery");
    assert.equal(r2.retryOpts[0].delaySeconds, 900, "with the preservation delay");
    assert.equal(h.kv.putCalls.length, atEngagement.kvPuts, "no KV write landed after engagement");
    assert.equal(h.r2.putCalls.length, atEngagement.r2Puts, "no R2 write landed after engagement");
    assert.equal(h.queue.sentLog.length, atEngagement.sends, "no queue send landed after engagement");
    assert.ok(
      __freezeControl.blockedWrites().count >= 1,
      "the gate actively refused the job's next write",
    );
    assert.equal(providerBodies.length, 1, "no provider call was spent on segment B");
    status = await h.r2.readJson(statusKey(jobId));
    assert.equal(status.segments[0].state, "ready", "segment A stays complete");
    assert.notEqual(status.segments[1].state, "ready", "segment B did not advance — no partial state");
    const leaseKey = `generation/locks/${jobId}/job.lock`;
    assert.ok(
      h.r2.store.has(leaseKey),
      "the interrupted delivery's lease is orphaned (its release was frozen out)",
    );

    // Lift the freeze and redeliver the SAME message on its own retry
    // schedule: the 900s preservation delay outlasts the shipped
    // lease's 5-minute staleness window, so the redelivery's acquire
    // deletes the orphaned lease and takes over (shipped
    // acquireProcessingLease behavior) — then let the chain drain.
    // The job must now complete.
    __freezeControl.disengage();
    h.clock.advance(960000);
    const r3 = await deliver(msgB, 2);
    assert.equal(r3.acked, 1, "the redelivered message is processed and acked");
    assert.equal(r3.retryOpts.length, 0);
    await h.drain();
    status = await h.r2.readJson(statusKey(jobId));
    assert.equal(status.state, "ready", "the job completed after resumption");
    assert.deepEqual(
      status.segments.map((s) => s.state),
      ["ready", "ready", "ready"],
      "every segment completed exactly once",
    );
    // Exactly once in effect, provider side: the completed segment A
    // was never re-called (its saved state + the content-addressed
    // cache carry it), and B and C were each called exactly once —
    // B's single call is the post-lift one; the frozen delivery spent
    // none.
    for (const seed of ["resume-a", "resume-b", "resume-c"])
      assert.equal(
        providerBodies.filter((b) => b.includes(seed)).length,
        1,
        `provider called exactly once for ${seed}`,
      );
    // Exactly once in effect, output side: one cached audio object per
    // segment, each written by exactly one successful put.
    for (const seg of segs) {
      assert.ok(h.r2.store.has(`audio/${seg.cache_key}.wav`), `audio cached for ${seg.cache_key}`);
      assert.equal(
        h.r2.putCount(`audio/${seg.cache_key}.wav`),
        1,
        "the audio object was written exactly once",
      );
    }
    assert.ok(!h.r2.store.has(leaseKey), "the job lease is released at the end, as shipped");
  } finally {
    __freezeControl.engage();
    h.restore();
  }
});

// ---- (8) recordTtsUsage: speech path -----------------------------------------------

test("(8) recordTtsUsage: speech records usage unfrozen, and is fenced at 423 frozen", async () => {
  __freezeControl.disengage();
  const h = makeHarness(variant, { clockStart: T0 });
  try {
    const seg = makeSegment("freeze-d4");
    const res = await h.request("/api/providers/gemini/speech", { method: "POST", body: seg });
    assert.equal(res.status, 200, "direct speech works on the variant while unfrozen");
    const usageKeys = [...h.r2.store.keys()].filter((k) => k.startsWith("usage/events/"));
    assert.ok(usageKeys.length >= 1, "the unfrozen speech call recorded a usage event");
    assert.ok(h.r2.store.has(`audio/${seg.cache_key}.wav`), "audio was cached");

    __freezeControl.engage();
    const snap = storeSnapshot(h);
    const counts = counters(h);
    const seg2 = makeSegment("freeze-d4-b");
    const refused = await h.request("/api/providers/gemini/speech", { method: "POST", body: seg2 });
    assert.equal(refused.status, 423);
    assertUnchanged(h, snap, counts, "frozen speech POST");
    assert.equal(
      [...h.r2.store.keys()].filter((k) => k.startsWith("usage/events/")).length,
      usageKeys.length,
      "no new usage event while frozen",
    );
  } finally {
    __freezeControl.engage();
    h.restore();
  }
});

// ---- copy fidelity: disengaged variant writes exactly like shipped -------------------

test("copy fidelity: with the freeze lifted, a mutating route behaves as shipped", async () => {
  const book = { id: BOOK, title: "Fidelity", author: "A", chapters: [] };
  const run = async (workerModule, disengage) => {
    if (disengage) __freezeControl.disengage();
    const h = makeHarness(workerModule, { clockStart: T0 });
    try {
      const res = await h.request(`/api/sync/book/${BOOK}`, { method: "PUT", body: book });
      return { status: res.status, body: await res.json(), stored: h.kv.store.get(`book:${BOOK}`) };
    } finally {
      if (disengage) __freezeControl.engage();
      h.restore();
    }
  };
  const fromShipped = await run(shipped, false);
  const fromVariant = await run(variant, true);
  assert.equal(fromVariant.status, 200);
  assert.deepEqual(fromVariant.body, fromShipped.body, "same response as shipped");
  assert.equal(fromVariant.stored, fromShipped.stored, "same stored record as shipped");
});

// ---- (9) differential reads ------------------------------------------------------------

async function seedReadState(h) {
  const cacheKey = sha256Hex("freeze-diff-audio");
  await h.kv.put(
    `book:${BOOK}`,
    JSON.stringify({ id: BOOK, title: "Diff Book", author: "A", chapters: [{ title: "One", segments: [] }] }),
  );
  await h.kv.put(
    "library:index",
    JSON.stringify([{ id: BOOK, title: "Diff Book", author: "A", updatedAt: T0 - 1000 }]),
  );
  await h.kv.put("settings:shared", JSON.stringify({ theme: "dark", geminiLane: "standard" }));
  await h.kv.put(
    "deleted:book-gone-1",
    JSON.stringify({ id: "book-gone-1", title: "Gone", deletedAt: T0 - 2000 }),
  );
  await h.r2.put(`epubs/${BOOK}.epub`, "EPUB-CONTENT-BYTES");
  await h.r2.put(
    `audio/${cacheKey}.wav`,
    new Uint8Array(Buffer.from(wavBase64(0.2), "base64")),
  );
  await h.r2.put(
    "quota/gemini-park.json",
    JSON.stringify({ parked_until: T0 - 1000, model: "gemini-3.8-flash-tts" }),
  );
  await h.r2.put(
    "usage/events/0000000001000-11111111-1111-4111-8111-111111111111.json",
    JSON.stringify({
      id: "e1",
      timestamp: T0 - 5000,
      provider: "gemini",
      usage_type: "book_generation",
      provider_call: true,
      request_status: "succeeded",
      input_tokens: 10,
      output_tokens: 20,
      calculated_cost: 0.01,
      character_count_sent: 42,
    }),
  );
  return { cacheKey };
}

test("(9) every READ-ONLY census route is byte-identical shipped vs frozen variant", async () => {
  const readPaths = (cacheKey) => [
    "/health",
    "/health/",
    "/api/providers/status",
    "/api/providers/openai/voices",
    "/api/providers/gemini/voices",
    "/api/providers/azure/voices",
    "/api/providers/fish/voices",
    "/api/sync/manifest",
    `/api/sync/book/${BOOK}`,
    "/api/sync/library",
    "/api/sync/settings",
    `/api/sync/epub/${BOOK}`,
    `/api/sync/audio/${cacheKey}`,
    "/api/quota/gemini",
    "/api/usage/report?from=2026-10-01T00:00:00.000Z&to=2026-11-01T00:00:00.000Z",
  ];

  const hs = makeHarness(shipped, { clockStart: T0 });
  const shippedResponses = new Map();
  let cacheKey;
  try {
    ({ cacheKey } = await seedReadState(hs));
    for (const path of readPaths(cacheKey)) {
      const res = await hs.request(path);
      shippedResponses.set(path, { status: res.status, body: await bodyBytes(res) });
    }
  } finally {
    hs.restore();
  }

  const h = makeHarness(variant, { clockStart: T0 });
  try {
    await seedReadState(h);
    const snap = storeSnapshot(h);
    const counts = counters(h);
    for (const path of readPaths(cacheKey)) {
      const res = await h.request(path);
      const expected = shippedResponses.get(path);
      assert.equal(res.status, expected.status, `${path}: status differs`);
      assert.equal(await bodyBytes(res), expected.body, `${path}: body bytes differ`);
    }
    assertUnchanged(h, snap, counts, "differential read sweep (frozen variant wrote nothing)");
  } finally {
    h.restore();
  }
});

// ---- (10) fail-closed completeness -------------------------------------------------------

const DISPOSITIONS = new Map([
  ["GET /health", "READ"],
  ["GET /health/", "READ"],
  ["GET /api/usage/report", "READ"],
  ["GET /api/quota/gemini", "READ"],
  ["GET /api/providers/status", "READ"],
  ["GET /api/sync/manifest", "READ"],
  ["GET /api/sync/book/*", "READ"],
  ["GET /api/sync/library", "READ"],
  ["GET /api/sync/settings", "READ"],
  ["GET /api/sync/epub/*", "READ"],
  ["GET /api/sync/audio/*", "READ"],
  ["GET /api/providers/azure/voices", "READ"],
  ["GET /api/providers/fish/voices", "READ"],
  ["GET /api/providers/openai/voices", "READ"],
  ["GET /api/providers/gemini/voices", "READ"],
  ["GET /api/export/audio/*", "D2"],
  ["GET /api/generation/books/*/jobs", "D1"],
  ["GET /api/generation/jobs/*", "D1"],
  ["POST /api/playback/chapter", "D3"],
  ["PUT /api/sync/book/*", "423"],
  ["DELETE /api/sync/book/*", "423"],
  ["DELETE /api/sync/deleted/*", "423"],
  ["PUT /api/sync/settings", "423"],
  ["PUT /api/sync/epub/*", "423"],
  ["POST /api/export/audio-url", "423"],
  ["DELETE /api/audio/purge", "423"],
  ["POST /api/generation/jobs", "423"],
  ["POST /api/generation/jobs/*/resume", "423"],
  ["POST /api/generation/continue", "423"],
  ["POST /api/generation/continue/stage", "423"],
  ["POST /api/generation/continue/finalize", "423"],
  ["POST /api/providers/azure/speech", "423"],
  ["POST /api/providers/fish/speech", "423"],
  ["POST /api/providers/openai/speech", "423"],
  ["POST /api/providers/gemini/speech", "423"],
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

// Same mechanical extraction as tests/freeze-route-census.test.mjs.
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
      const bOpen = region.indexOf("{", pClose);
      const bClose = bOpen > 0 ? balanced(region, bOpen, "{", "}") : -1;
      if (bClose < 0) continue;
      const block = region.slice(bOpen, bClose);
      useMethods = [...block.matchAll(/request\.method\s*===\s*"([A-Z]+)"/g)].map((x) => x[1]);
    }
    if (!useMethods.length) continue;
    for (const method of useMethods)
      for (const pattern of patterns) keys.add(`${method} ${pattern}`);
  }
  return keys;
}

test("(10) fail-closed: every census route has a freeze disposition; every fence is present in the variant", () => {
  const shippedSrc = readFileSync(new URL("../cloudflare-worker.js", import.meta.url), "utf8");
  const variantSrc = readFileSync(new URL("../v2/p8/freeze-worker.js", import.meta.url), "utf8");

  const extracted = extractRouteKeys(shippedSrc);
  const disposed = new Set(DISPOSITIONS.keys());
  assert.deepEqual(
    [...extracted].filter((k) => !disposed.has(k)),
    [],
    "census routes with no freeze disposition",
  );
  assert.deepEqual(
    [...disposed].filter((k) => !extracted.has(k)),
    [],
    "freeze dispositions for routes that do not exist",
  );
  const counts = {};
  for (const v of DISPOSITIONS.values()) counts[v] = (counts[v] || 0) + 1;
  assert.deepEqual(counts, { READ: 15, D1: 2, D2: 1, D3: 1, "423": 16 });

  // The variant is the shipped 1.4.43 code, boots frozen, has no
  // scheduled handler, and carries every fence the dispositions name.
  assert.match(variantSrc, /APP_VERSION = "1\.4\.43"/);
  assert.ok(!variantSrc.includes("async scheduled"), "no scheduled handler");
  const pins = [
    "const freezeState = { engaged: true };",
    "freezeRefusedRoute(request.method, url.pathname)",
    "if (freezeEngaged()) return json(status, 200, origin, env);", // D1 status read
    'if (freezeEngaged()) return { mirrored: false, reason: "frozen" };', // N2 mirror entry
    "if (freezeEngaged()) return;\n  if (!env.OPALREADER_STORAGE) return;", // D4 recorder
    "error.status = 423;", // D3 composite miss
    "const FREEZE_RETRY_DELAY_SECONDS = 900;", // N1 preservation delay
    "countJobRegistryPending", // D1 discovery count-only
    'legacyScan = freezeEngaged() ? "deferred"', // D1 backfill deferred
  ];
  for (const pin of pins)
    assert.ok(variantSrc.includes(pin), `variant is missing fence: ${pin}`);
  // Redelivery semantics (Rowan 6330658336): BOTH frozen-consumer
  // paths — the at-entry refusal and the mid-job refusal — retry with
  // the preservation delay; neither acks.
  assert.equal(
    (variantSrc.match(/message\.retry\(\{ delaySeconds: FREEZE_RETRY_DELAY_SECONDS \}\)/g) || [])
      .length,
    2,
    "at-entry and mid-job frozen deliveries both retry with the preservation delay",
  );
  assert.ok(
    !variantSrc.includes("for (const message of batch.messages) message.ack();"),
    "the frozen consumer no longer acks at entry",
  );
  assert.ok(
    !variantSrc.includes("if (error?.freezeBlocked) message.ack();"),
    "mid-flight frozen work is no longer acked",
  );
  // Auth order (Rowan 6330658336): the shipped token gate precedes the
  // freeze refusal in fetch; the D2 refusal sits inside the export
  // handler, ahead of the token-consuming delete it exists to prevent.
  const gateIdx = variantSrc.indexOf(
    'request.headers.get("X-OpalReader-Token") !== env.OPALREADER_ACCESS_TOKEN',
  );
  const refusalIdx = variantSrc.indexOf("freezeRefusedRoute(request.method, url.pathname)");
  assert.ok(
    gateIdx > 0 && refusalIdx > gateIdx,
    "the token gate runs before the freeze refusal",
  );
  const d2Idx = variantSrc.indexOf("P8 FREEZE (D2): the one-time token has now been validated");
  const deleteIdx = variantSrc.indexOf("OPALREADER_KV.delete(`audio-export:");
  assert.ok(
    d2Idx > 0 && deleteIdx > d2Idx,
    "the D2 refusal precedes (and prevents) the token-consuming delete",
  );
  assert.equal(
    (variantSrc.match(/env = freezeGuardEnv\(env\);/g) || []).length,
    2,
    "the binding guard wraps env in BOTH fetch and queue",
  );
});
