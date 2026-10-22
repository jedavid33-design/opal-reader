// P7 migration rehearsal machinery: transformer dispositions,
// adjudication evidence rules, §5.4 verifier (incl. negative cases),
// Shelf outbox import against the real P6 bridge, and rollback
// reverse-delta reconciliation. Synthetic fixtures only — real corpus
// data never enters the repo (it lives in ~/workspace/opal-reader-p7-data).
import { test } from "node:test";
import assert from "node:assert/strict";

import { audioObjectIndex, transformBook, transformJobs, computeOrphans,
         computeChapterTruth, CENSUS_LIVE_JOB } from "../v2/migration/transform.mjs";
import { adjudicateBook } from "../v2/migration/adjudicate.mjs";
import { verifyBook } from "../v2/migration/verify.mjs";
import { reverseDeltas, rollbackBook } from "../v2/migration/rollback.mjs";
import { importV1Outbox } from "../v2/migration/shelf-outbox-import.mjs";
import { createShelfBridge } from "../v2/client/shelf-bridge.mjs";
import { digest } from "../v2/migration/util.mjs";

const K = (c) => c.repeat(64).slice(0, 64); // 64-hex audio keys

function seg(over) {
  return { id: "s", pov: "Narr", text: "words here", speechText: "words here",
           audioKey: null, audioStale: false, ...over };
}
function book(over) {
  return { id: "book", title: "T", author: "A", povs: [{ id: "p1", name: "Narr", voice: {} }],
           chapters: [], ...over };
}

const listings = { "audio/": [
  { key: `audio/${K("a")}.wav`, size: 100 },   // legacy bound (book A)
  { key: `audio/${K("b")}.mp3`, size: 200 },   // fingerprinted bound (book B seg 1)
  { key: `audio/${K("c")}.wav`, size: 300 },   // fingerprinted bound (book B seg 3)
  { key: `audio/${K("d")}.wav`, size: 400 },   // orphan
  { key: "audio/extensionless", size: 50 },    // orphan, no extension
] };
const audioIdx = audioObjectIndex(listings);

const bookA = book({ id: "book-a", title: "Legacy", chapters: [{ id: "ca", segments: [
  seg({ id: "a1", audioKey: K("a") }),                                        // legacy, no stamps at all
  seg({ id: "a2", systemVoiceFallback: true }),                               // device voice (A4)
  seg({ id: "a3" }),                                                          // never generated
] }] });
const bookB = book({ id: "book-b", title: "Modern", chapters: [{ id: "cb", segments: [
  seg({ id: "b1", audioKey: K("b"), generationFingerprint: K("b"), generatedModel: "m1", blockRootId: "b1" }),
  seg({ id: "b2", blockRootId: "b1", generationBlocked: { blockReason: "POLICY_BLOCK", model: "m1", jobId: "j" } }),
  seg({ id: "b3", audioKey: K("c"), generationFingerprint: K("c"), generatedModel: "m1" }),
] }] });
const bookC = book({ id: "book-c", title: "Complete", chapters: [{ id: "cc", segments: [
  seg({ id: "c1", audioKey: K("a"), generationFingerprint: K("a"), generatedModel: "m1" }),
] }] });

test("transform: legacy anchoring, device-voice, blocked outcome, provenance labels", () => {
  const a = transformBook(bookA, audioIdx);
  const legacy = a.bindings.find((b) => b.occurrenceId === "a1");
  assert.equal(legacy.revision, `legacy:${K("a")}`);
  assert.equal(legacy.provenance.label, "legacy-unknown");
  const dv = a.bindings.find((b) => b.occurrenceId === "a2");
  assert.equal(dv.kind, "device-voice");
  assert.equal(dv.cacheKey, null);
  assert.equal(a.counts.unbound, 1);
  assert.equal(a.unbound[0].classification, "never-generated");

  const b = transformBook(bookB, audioIdx);
  assert.equal(b.bindings.find((x) => x.occurrenceId === "b1").revision, K("b"));
  assert.equal(b.bindings.find((x) => x.occurrenceId === "b1").provenance.label, "recorded");
  assert.equal(b.outcomes.length, 1);
  assert.equal(b.outcomes[0].outcome, "blocked_policy");
  const child = b.content.chapters[0].segments.find((s) => s.occurrenceId === "b2");
  assert.equal(child.parentSegId, "b1");
  const root = b.content.chapters[0].segments.find((s) => s.occurrenceId === "b1");
  assert.equal(root.parentSegId, null);
});

test("transform: cast-inferred provenance when the pov has exactly one stamped model", () => {
  const bk = book({ id: "book-d", chapters: [{ id: "cd", segments: [
    seg({ id: "d1", audioKey: K("a"), generatedModel: "azure-x" }),
    seg({ id: "d2", audioKey: K("b") }),
  ] }] });
  const t = transformBook(bk, audioIdx);
  assert.equal(t.bindings.find((x) => x.occurrenceId === "d1").provenance.label, "recorded-partial");
  const d2 = t.bindings.find((x) => x.occurrenceId === "d2");
  assert.equal(d2.provenance.label, "cast-inferred");
  assert.equal(d2.provenance.model, "azure-x");
});

test("jobs: census-live carries parked, complete-book remnants supersede, drift is held for review", () => {
  const statuses = [
    { job_id: CENSUS_LIVE_JOB, book_id: "book-b", chapter_index: 0, state: "paused_update", segments: [{ id: "x" }], total: 1, completed: 0 },
    { job_id: "inert1", book_id: "book-c", chapter_index: 0, state: "paused_quota", segments: [], total: 0, completed: 0 },
    { job_id: "drift1", book_id: "book-b", chapter_index: 0, state: "queued", segments: [], total: 0, completed: 0 },
    { job_id: "term1", book_id: "book-b", chapter_index: 0, state: "ready", segments: [], total: 0, completed: 0 },
  ];
  const { aggregates, inventory } = transformJobs(statuses, new Set(["book-c"]));
  assert.equal(inventory.total, 4);
  assert.equal(inventory.nonTerminal, 3);
  const byId = new Map(aggregates.map((a) => [a.jobId, a]));
  assert.equal(byId.get(CENSUS_LIVE_JOB).v2State, "parked_policy");
  assert.equal(byId.get(CENSUS_LIVE_JOB).disposition, "carry-live");
  assert.equal(byId.get("inert1").disposition, "superseded");
  assert.equal(byId.get("drift1").disposition, "carry-held-manual-review");
  assert.match(byId.get(CENSUS_LIVE_JOB).definitionDigest, /^[a-f0-9]{64}$/);
});

test("orphans: unreferenced audio is inventoried, never assigned", () => {
  const all = [transformBook(bookA, audioIdx), transformBook(bookB, audioIdx), transformBook(bookC, audioIdx)];
  const orphans = computeOrphans(audioIdx, all.flatMap((t) => t.bindings));
  const keys = orphans.map((o) => o.audioKey).sort();
  assert.deepEqual(keys, [K("d"), "extensionless"].sort());
  assert.equal(orphans.find((o) => o.audioKey === "extensionless").ext, null);
});

test("chapter truth: playable counts r2 + device-voice; blocked counted separately", () => {
  const a = transformBook(bookA, audioIdx);
  const truthA = computeChapterTruth(a, []);
  assert.deepEqual([truthA[0].total, truthA[0].playable, truthA[0].blocked], [3, 2, 0]);
  const b = transformBook(bookB, audioIdx);
  const truthB = computeChapterTruth(b, []);
  assert.deepEqual([truthB[0].total, truthB[0].playable, truthB[0].blocked], [3, 2, 1]);
});

// ------------------------------------------------------------- adjudication
const graph = [["a", "b", "c"], ["d", "e", "f"], ["g", "h", "i"]];
const cloudAt = (ci, si) => ({ position: { chapterIndex: ci, segmentIndex: si },
                               checkpoints: [{ chapterIndex: 0, segmentIndex: 0 }] });

test("adjudication: checkpoint history that passes the rival explains it — furthest wins", () => {
  const r = adjudicateBook({ bookId: "x", graph, cloud: cloudAt(0, 1), devices: [
    { device: "iphone", position: { chapterIndex: 0, segmentIndex: 2 }, checkpoints: [{ chapterIndex: 0, segmentIndex: 0 }] },
    { device: "ipad", position: { chapterIndex: 1, segmentIndex: 1 },
      checkpoints: [{ chapterIndex: 0, segmentIndex: 2 }, { chapterIndex: 1, segmentIndex: 0 }] },
  ] });
  assert.equal(r.source, "ipad");
  assert.equal(r.manualReview, false);
  assert.equal(r.conflicts[0].resolution, "resolved-by-evidence");
});

test("adjudication: a rival claim the winner's history cannot explain is flagged, winner stands on evidence", () => {
  const r = adjudicateBook({ bookId: "x", graph, cloud: cloudAt(0, 1), devices: [
    // iphone claims (1,0) but its checkpoint runs ahead of its own
    // position — internally inconsistent, uncorroborated.
    { device: "iphone", position: { chapterIndex: 1, segmentIndex: 0 }, checkpoints: [{ chapterIndex: 2, segmentIndex: 2 }] },
    // ipad is corroborated but its history never passes (1,0).
    { device: "ipad", position: { chapterIndex: 2, segmentIndex: 0 }, checkpoints: [{ chapterIndex: 0, segmentIndex: 2 }] },
  ] });
  assert.equal(r.source, "ipad");
  assert.equal(r.manualReview, true);
  const div = r.conflicts.find((c) => c.kind === "divergent-positions");
  assert.equal(div.resolution, "flag-manual-review");
});

test("adjudication: nothing corroborated — the cloud claim stands as fail-safe, flagged", () => {
  const cloud = { position: { chapterIndex: 0, segmentIndex: 1 },
                  checkpoints: [{ chapterIndex: 2, segmentIndex: 2 }] }; // ahead of itself
  const r = adjudicateBook({ bookId: "x", graph, cloud, devices: [
    { device: "iphone", position: { chapterIndex: 1, segmentIndex: 0 }, checkpoints: [{ chapterIndex: 2, segmentIndex: 2 }] },
    { device: "ipad", position: { chapterIndex: 2, segmentIndex: 0 }, checkpoints: [{ chapterIndex: 1, segmentIndex: 9 }] }, // invalid target
  ] });
  assert.equal(r.source, "cloud-failsafe");
  assert.equal(r.manualReview, true);
  assert.deepEqual([r.openingPosition.chapterIndex, r.openingPosition.segmentIndex], [0, 1]);
  assert.ok(r.conflicts.some((c) => c.kind === "no-corroborated-position"));
});

test("adjudication: invalid device position is discarded with evidence; tombstone flags but migrates", () => {
  const r = adjudicateBook({ bookId: "x", graph, cloud: cloudAt(1, 2), devices: [
    { device: "iphone", tombstone: true },
    { device: "ipad", position: { chapterIndex: 9, segmentIndex: 0 }, checkpoints: [] },
  ] });
  assert.equal(r.source, "cloud");
  assert.equal(r.manualReview, true);
  assert.deepEqual(r.conflicts.map((c) => c.kind).sort(), ["invalid-position", "tombstone-vs-live"]);
});

// ---------------------------------------------------------------- verifier
function corpusFor(bookRec, adjudication) {
  const t = transformBook(bookRec, audioIdx);
  return { ...t, position: { opening: adjudication.openingPosition, checkpoints: adjudication.checkpoints } };
}

test("verifier: a faithful transform passes all seven §5.4 checks", () => {
  const adj = adjudicateBook({ bookId: "book-b", graph: [["b1", "b2", "b3"]],
    cloud: { position: { chapterIndex: 0, segmentIndex: 0 }, checkpoints: [] }, devices: [] });
  const corpusBook = corpusFor(bookB, adj);
  const rep = verifyBook({ snapshotBook: bookB, corpusBook, audioIdx, adjudication: adj,
    aggregates: [], snapshotStatuses: [],
    truthSeeds: { "book-b": [{ chapterIndex: 0, total: 3, playable: 2, blocked: 1 }] } });
  assert.equal(rep.pass, true, JSON.stringify(rep.problems));
  assert.equal(rep.checks.length, 7);
});

test("verifier: a missing R2 object is a STOP (check 2), a wrong blocked set is a STOP (check 4)", () => {
  const adj = adjudicateBook({ bookId: "book-b", graph: [["b1", "b2", "b3"]],
    cloud: { position: { chapterIndex: 0, segmentIndex: 0 }, checkpoints: [] }, devices: [] });
  const corpusBook = corpusFor(bookB, adj);
  const shrunk = new Map(audioIdx);
  shrunk.delete(K("b"));
  const rep1 = verifyBook({ snapshotBook: bookB, corpusBook, audioIdx: shrunk, adjudication: adj,
    aggregates: [], snapshotStatuses: [], truthSeeds: {} });
  assert.equal(rep1.pass, false);
  assert.ok(rep1.problems.some((p) => p.startsWith("bindings-resolve")));

  const tampered = JSON.parse(JSON.stringify(bookB));
  tampered.chapters[0].segments[1].generationBlocked = null;
  const rep2 = verifyBook({ snapshotBook: tampered, corpusBook, audioIdx, adjudication: adj,
    aggregates: [], snapshotStatuses: [], truthSeeds: {} });
  assert.equal(rep2.pass, false);
  assert.ok(rep2.problems.some((p) => p.startsWith("blocked-equality")));
});

// ------------------------------------------------------------- outbox import
function memStorage() {
  const m = new Map();
  return { get: async (k) => m.get(k), set: async (k, v) => m.set(k, v), _map: m };
}
const v1Item = (over) => ({ queueId: "shelf_r1_1000_u1", clientSessionId: "shelf_r1_1000_u1",
  readId: "r1", startedAt: "2026-10-01T00:00:00.000Z", duration_seconds: 600, attempts: 0, ...over });

test("outbox import: ids, attempts, order and failure stamps preserved byte-for-byte", () => {
  const items = [
    v1Item({}),
    v1Item({ queueId: "shelf_r1_2000_u2", clientSessionId: "shelf_r1_2000_u2",
             startedAt: "2026-10-01T00:11:00.000Z", attempts: 2, lastStatus: 500, lastError: "Shelf 500" }),
  ];
  const { record, report } = importV1Outbox(items);
  assert.deepEqual(record.outbox, items);
  assert.equal(report.preservedAttempts, 2);
  assert.throws(() => importV1Outbox([v1Item({ clientSessionId: "different" })]), /clientSessionId/);
  assert.throws(() => importV1Outbox([v1Item({ attempts: -1 })]), /attempts/);
});

test("outbox import + P6 bridge: FIFO flush, attempts continue from imported values, merge honors attempts", async () => {
  const items = [
    v1Item({}),
    v1Item({ queueId: "shelf_r1_2000_u2", clientSessionId: "shelf_r1_2000_u2",
             startedAt: "2026-10-01T00:11:00.000Z", duration_seconds: 300, attempts: 2 }),
  ];
  const { record } = importV1Outbox(items);
  const storage = memStorage();
  await storage.set("cs:shelf-bridge:v1", record);
  const calls = [];
  let fail = true;
  const fetchFn = async (url, opts) => {
    calls.push(JSON.parse(opts.body));
    if (fail) return { ok: false, status: 500, json: async () => ({ error: "boom" }) };
    return { ok: true, status: 200, json: async () => ({}) };
  };
  const bridge = createShelfBridge({ storage, fetchFn, shelfApiBase: "https://shelf.example",
                                     idGen: () => "newuuid" });
  const r1 = await bridge.flush();
  assert.equal(r1.sent, 0);
  const afterFail = await bridge.outbox();
  assert.equal(afterFail[0].attempts, 1);            // head blocked, incremented from imported 0
  assert.equal(afterFail[1].attempts, 2);            // untouched behind the blocked head
  fail = false;
  const r2 = await bridge.flush();
  assert.equal(r2.sent, 2);
  assert.deepEqual(calls.map((c) => c.client_session_id),
    ["shelf_r1_1000_u1", "shelf_r1_1000_u1", "shelf_r1_2000_u2"]); // FIFO, retry keeps the id

  // merge after import: a fresh session ending within 90s of the tail's
  // end merges into the tail only while its attempts are still 0.
  const storage2 = memStorage();
  await storage2.set("cs:shelf-bridge:v1", importV1Outbox(items).record);
  const bridge2 = createShelfBridge({ storage: storage2, fetchFn, shelfApiBase: "https://shelf.example",
                                      idGen: () => "newuuid" });
  const tailEnd = new Date("2026-10-01T00:11:00.000Z").getTime() + 300 * 1000;
  await bridge2.sessionEnded({ readId: "r1", startedAtMs: tailEnd + 30_000, durationSeconds: 60 });
  let q = await bridge2.outbox();
  assert.equal(q.length, 3);                          // tail has attempts 2 -> NO merge; new item appended
  assert.equal(q[2].duration_seconds, 60);
});

// ---------------------------------------------------------------- rollback
test("rollback: reverse deltas are computed from state and every one is reconciled", () => {
  const adj = { openingPosition: { chapterIndex: 0, segmentIndex: 0, occurrenceId: "b1" }, checkpoints: [] };
  const before = { books: { "book-b": corpusFor(bookB, adj) }, jobs: {}, inventory: {} };
  const after = JSON.parse(JSON.stringify(before));
  const bb = after.books["book-b"];
  bb.position = { opening: { chapterIndex: 0, segmentIndex: 2, occurrenceId: "b3" }, checkpoints: [] };
  bb.bindings.push({ occurrenceId: "b2", chapterIndex: 0, segmentIndex: 1, kind: "r2",
                     revision: K("e"), cacheKey: K("e"),
                     provenance: { model: "m1", providerRequestId: null, label: "recorded" }, staleFlag: false });
  bb.content.cast[0].voice = { style_direction: "warm and close" };

  const deltas = reverseDeltas(before.books["book-b"], bb);
  assert.deepEqual(deltas.map((d) => d.kind).sort(), ["binding-added", "content-revision", "position"]);

  const { rolled, reconciliation } = rollbackBook(after, before, "book-b");
  assert.equal(digest(rolled.books["book-b"]), digest(before.books["book-b"]));
  assert.deepEqual(reconciliation.map((r) => r.deltaId).sort(), deltas.map((d) => d.deltaId).sort());
  assert.ok(reconciliation.every((r) => r.disposition === "carry-back"));
  const posRec = reconciliation.find((r) => r.kind === "position");
  assert.equal(posRec.export.type, "v1-position-update");
});
