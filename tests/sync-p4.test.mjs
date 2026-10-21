import { test } from "node:test";
import assert from "node:assert/strict";
import { makeHarness } from "./helpers/do-harness.mjs";
import { SyncClient } from "./helpers/sync-client.mjs";

const BOOK = (id, occs = ["s1", "s2", "s3"]) =>
  ({ title: `Book ${id}`, occurrenceIds: occs });

// ---------- cursor / pagination (Rowan invariant 1) ----------

test("cursor: sinceSeq is exclusive, sinceSeq=0 is a normal first pull (no spurious resync)", async () => {
  const h = makeHarness();
  const a = new SyncClient(h.coord, "dev-A");
  await a.pushBook("bk1", BOOK("bk1"));
  const page = h.coord.pullChanges({ family: "content", sinceSeq: 0 });
  assert.equal(page.resyncRequired, undefined);
  assert.equal(page.changes.length, 1);
  assert.equal(page.changes[0].seq, 1);
  // Exclusive: pulling from the delivered seq yields nothing new.
  const page2 = h.coord.pullChanges({ family: "content", sinceSeq: page.nextSeq });
  assert.equal(page2.changes.length, 0);
});

test("cursor: pinned watermark — a concurrent write mid-pagination is NOT in the window, and arrives next pull", async () => {
  const h = makeHarness();
  const a = new SyncClient(h.coord, "dev-A");
  for (const id of ["b1", "b2", "b3"]) await a.pushBook(id, BOOK(id));
  const p1 = h.coord.pullChanges({ family: "content", sinceSeq: 0, limit: 2 });
  assert.equal(p1.changes.length, 2);
  assert.equal(p1.hasMore, true);
  await a.pushBook("b4", BOOK("b4")); // concurrent write during pagination
  const p2 = h.coord.pullChanges({ family: "content", cursor: p1.cursor, limit: 2 });
  assert.deepEqual(p2.changes.map(c => c.entityKey), ["b3"]); // b4 not in the pinned window
  assert.equal(p2.hasMore, false);
  const p3 = h.coord.pullChanges({ family: "content", sinceSeq: p2.nextSeq });
  assert.deepEqual(p3.changes.map(c => c.entityKey), ["b4"]); // nothing lost
});

test("cursor: mismatched family / impossible watermarks are rejected; truncation triggers resync + snapshot convergence", async () => {
  const h = makeHarness();
  const a = new SyncClient(h.coord, "dev-A");
  await a.pushBook("bk1", BOOK("bk1"));
  const bad = h.coord.pullChanges({ family: "content", cursor: { family: "bindings", seq: 0, watermark: 1 } });
  assert.equal(bad.error, "invalid_cursor");
  const ahead = h.coord.pullChanges({ family: "content", cursor: { family: "content", seq: 0, watermark: 99 } });
  assert.equal(ahead.error, "invalid_cursor");
});

test("sequence authority survives FULL history truncation (review blocker 1): tip persists, no silent misses", async () => {
  const h = makeHarness();
  const a = new SyncClient(h.coord, "dev-A");
  await a.pushBook("bk1", BOOK("bk1"));
  await a.pushBook("bk2", BOOK("bk2"));
  await a.pushBook("bk3", BOOK("bk3")); // content seqs 1..3, tip 3
  // Truncate ALL retained history through the sanctioned prune path:
  const pruned = h.coord._pruneSyncHistory("content", 4);
  assert.deepEqual({ floor: pruned.floor, tip: pruned.tip }, { floor: 4, tip: 3 });
  assert.equal(h.coord._all(`SELECT * FROM sync_changes WHERE family = 'content'`).length, 0);
  // A device below the floor hears resync — never silence:
  const stale = h.coord.pullChanges({ family: "content", sinceSeq: 2 });
  assert.equal(stale.resyncRequired, true);
  assert.equal(stale.floorSeq, 4);
  // The next write continues the sequence — it does NOT restart at 1:
  await a.pushBook("bk4", BOOK("bk4"));
  const rows = h.coord._all(`SELECT * FROM sync_changes WHERE family = 'content'`);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].seq, 4);
  // A device whose cursor sat exactly at the old tip receives it:
  const atTip = h.coord.pullChanges({ family: "content", sinceSeq: 3 });
  assert.equal(atTip.resyncRequired, undefined);
  assert.deepEqual(atTip.changes.map(c => c.entityKey), ["bk4"]);
  // And a fresh device converges through the snapshot (entities intact):
  const b = new SyncClient(h.coord, "dev-B");
  const res = await b.pull("content");
  assert.equal(res.resynced, true);
  assert.equal(b.mirror.content.size, 4);
});

// ---------- receipts: idempotent across lost ACKs; abort isolation ----------

test("receipts: duplicate command delivery returns the SAME receipt and applies once (lost-ACK safe)", async () => {
  const h = makeHarness();
  const a = new SyncClient(h.coord, "dev-A");
  const changes = [{ family: "content", entityKey: "bk1", bookId: "bk1", baseRevision: 0, op: "upsert", payload: BOOK("bk1") }];
  const r1 = await a.push(changes, { commandId: "dev-A-push-1" });
  const r2 = await a.push(changes, { commandId: "dev-A-push-1" }); // ACK lost, re-delivered
  assert.equal(r2.replayed, true);
  assert.deepEqual(r2.outcomes, r1.outcomes);
  assert.equal(h.coord.syncSnapshot({ family: "content" }).entities[0].revision, 1); // applied once
});

test("abort isolation: a conflicted book mid-batch leaves its siblings applied and itself untouched", async () => {
  const h = makeHarness();
  const a = new SyncClient(h.coord, "dev-A");
  await a.pushBook("bkB", BOOK("bkB")); // bkB now at revision 1
  const r = await a.push([
    { family: "content", entityKey: "bkA", bookId: "bkA", baseRevision: 0, op: "upsert", payload: BOOK("bkA") },
    { family: "content", entityKey: "bkB", bookId: "bkB", baseRevision: 0, op: "upsert", payload: { title: "STALE" } }, // stale base
    { family: "content", entityKey: "bkC", bookId: "bkC", baseRevision: 0, op: "upsert", payload: BOOK("bkC") },
  ]);
  const by = Object.fromEntries(r.outcomes.map(o => [o.entityKey, o]));
  assert.equal(by.bkA.status, "applied");
  assert.equal(by.bkB.status, "conflict");
  assert.equal(by.bkB.currentRevision, 1);
  assert.ok(by.bkB.window.length >= 1); // the conflicting change is surfaced, never merged
  assert.equal(by.bkC.status, "applied");
  assert.equal(h.coord.syncSnapshot({ family: "content" }).entities
    .find(e => e.entityKey === "bkB").data.title, "Book bkB"); // stale payload never landed
});

// ---------- position journal (Rowan invariant 2) ----------

async function bookWithPosition(h) {
  const a = new SyncClient(h.coord, "dev-A");
  await a.pushBook("bk1", BOOK("bk1"));
  return a;
}

test("position: deterministic fold in receipt order; replay dedupes by eventId; same id + different payload is a conflict", async () => {
  const h = makeHarness();
  const a = await bookWithPosition(h);
  const r1 = await a.position("bk1", { kind: "seek", occurrenceId: "s2", offsetSec: 30 });
  assert.equal(r1.receipt.outcomes[0].status, "accepted");
  // Exact re-delivery of the same event (lost ACK): replay, no duplicate.
  const again = await h.coord.handleCommand({ command_id: "dev-A-pos-replay", type: "PushPositionEvents",
    payload: { deviceId: "dev-A", bookId: "bk1", events: [r1.event] } });
  assert.equal(again.outcomes[0].status, "replay");
  assert.equal(again.outcomes[0].receiptSeq, 1);
  assert.equal(h.coord.positionView("bk1").asOfReceiptSeq, 1);
  // Same eventId, different payload: a conflict, not a silent replay.
  const evil = await h.coord.handleCommand({ command_id: "dev-A-pos-evil", type: "PushPositionEvents",
    payload: { deviceId: "dev-A", bookId: "bk1", events: [{ ...r1.event, offsetSec: 99 }] } });
  assert.equal(evil.outcomes[0].status, "conflict");
  const v = h.coord.positionView("bk1");
  assert.equal(v.canonical.occurrenceId, "s2");
  assert.equal(v.canonical.offsetSec, 30);
});

test("position: validation — base ahead of tip, unknown occurrence, bad offset all rejected, nothing appended", async () => {
  const h = makeHarness();
  const a = await bookWithPosition(h);
  const mk = (ev, id) => h.coord.handleCommand({ command_id: id, type: "PushPositionEvents",
    payload: { deviceId: "dev-A", bookId: "bk1", events: [ev] } });
  const base = { eventId: "dev-A:x1", deviceId: "dev-A", localSeq: 1, kind: "seek", occurrenceId: "s1", offsetSec: 0, baseSeq: 0 };
  assert.equal((await mk({ ...base, baseSeq: 5 }, "v1")).outcomes[0].reason, "base_ahead");
  assert.equal((await mk({ ...base, eventId: "dev-A:x2", occurrenceId: "nope" }, "v2")).outcomes[0].reason, "unknown_occurrence");
  assert.equal((await mk({ ...base, eventId: "dev-A:x3", offsetSec: -1 }, "v3")).outcomes[0].reason, "invalid_offset");
  assert.equal(h.coord.positionView("bk1").asOfReceiptSeq, 0);
});

test("position: fresh backward seek applies; stale backward is superseded (recorded, surfaced); stale forward folds; gaps surface", async () => {
  const h = makeHarness();
  const a = await bookWithPosition(h);
  const b = new SyncClient(h.coord, "dev-B");
  await a.position("bk1", { kind: "checkpoint", occurrenceId: "s3", offsetSec: 10 }); // tip 1
  await a.pull("position");
  // B never synced: stale base (0). B listened FORWARD offline — wait,
  // B has nothing further than canonical; instead B seeks BACKWARD stale:
  const staleBack = await b.position("bk1", { kind: "seek", occurrenceId: "s1", offsetSec: 5 });
  assert.equal(staleBack.receipt.outcomes[0].status, "accepted");
  assert.equal(staleBack.receipt.outcomes[0].superseded, true);
  let v = h.coord.positionView("bk1");
  assert.equal(v.canonical.occurrenceId, "s3"); // NOT rewound by the stale device
  assert.equal(v.supersededCount, 1);
  // B catches up, then listens forward past canonical and syncs late:
  await b.pull("position");
  const fwd = await b.position("bk1", { kind: "checkpoint", occurrenceId: "s3", offsetSec: 55 });
  assert.equal(fwd.receipt.outcomes[0].superseded, false);
  v = h.coord.positionView("bk1");
  assert.equal(v.canonical.offsetSec, 55);
  // A deliberate re-read on a SYNCED device (fresh base) applies backward:
  await a.pull("position");
  const freshBack = await a.position("bk1", { kind: "seek", occurrenceId: "s1", offsetSec: 0 });
  assert.equal(freshBack.receipt.outcomes[0].superseded, false);
  v = h.coord.positionView("bk1");
  assert.equal(v.canonical.occurrenceId, "s1");
  // Journal gaps: B's localSeqs are 1,2 — forge a gap by pushing localSeq 5 directly.
  const gap = await h.coord.handleCommand({ command_id: "gap-1", type: "PushPositionEvents",
    payload: { deviceId: "dev-B", bookId: "bk1", events: [
      { eventId: "dev-B:5", deviceId: "dev-B", localSeq: 5, kind: "pause", occurrenceId: "s1", offsetSec: 0, baseSeq: v.asOfReceiptSeq }] } });
  assert.equal(gap.outcomes[0].status, "accepted");
  v = h.coord.positionView("bk1");
  assert.deepEqual(v.journalGaps, [{ deviceId: "dev-B", missing: [3, 4] }]);
});

// ---------- tombstones + sweep (Rowan invariant 3) ----------

test("tombstones: deletion syncs, post-tombstone writes are rejected in EVERY family, resync keeps the tombstone", async () => {
  const h = makeHarness();
  const a = new SyncClient(h.coord, "dev-A");
  const b = new SyncClient(h.coord, "dev-B");
  await a.pushBook("bk1", BOOK("bk1"));
  await b.pullAll();
  const del = await a.deleteBook("bk1");
  assert.equal(del.outcome, "applied");
  await b.pull("content");
  assert.equal(b.mirror.content.has("bk1"), false); // deletion learned as a delta
  // Writes from the stale device are fenced in every family:
  const w1 = await b.push([{ family: "content", entityKey: "bk1", bookId: "bk1", baseRevision: 2, op: "upsert", payload: BOOK("bk1") }]);
  assert.equal(w1.outcomes[0].status, "rejected_tombstoned");
  const w2 = await b.push([{ family: "bindings", entityKey: "bk1:s1", bookId: "bk1", baseRevision: 0, op: "upsert", payload: { cacheKey: "k1" } }]);
  assert.equal(w2.outcomes[0].status, "rejected_tombstoned");
  const w3 = await b.position("bk1", { kind: "play", occurrenceId: "s1", offsetSec: 0 });
  assert.equal(w3.receipt.outcomes[0].reason, "tombstoned");
  // A fresh device resyncing from scratch still sees the tombstone:
  const snap = h.coord.syncSnapshot({ family: "content" });
  assert.equal(snap.entities.find(e => e.entityKey === "bk1").tombstone, true);
});

async function sweepFixture(h, { incompleteOwn = false, incompleteCross = false } = {}) {
  const a = new SyncClient(h.coord, "dev-A");
  await a.pushBook("bk1", BOOK("bk1"));
  await a.pushBook("bk2", BOOK("bk2"));
  const rows = [
    { family: "bindings", entityKey: "bk1:s1", bookId: "bk1", baseRevision: 0, op: "upsert", payload: { cacheKey: "shared-key" } },
    { family: "bindings", entityKey: "bk1:s2", bookId: "bk1", baseRevision: 0, op: "upsert", payload: { cacheKey: "bk1-only" } },
    { family: "bindings", entityKey: "bk2:s1", bookId: "bk2", baseRevision: 0, op: "upsert", payload: { cacheKey: "shared-key" } },
  ];
  if (incompleteOwn) rows.push({ family: "bindings", entityKey: "bk1:s3", bookId: "bk1", baseRevision: 0, op: "upsert", payload: {} });
  if (incompleteCross) rows.push({ family: "bindings", entityKey: "bk2:s2", bookId: "bk2", baseRevision: 0, op: "upsert", payload: {} });
  await a.push(rows);
  await a.deleteBook("bk1");
  return a;
}

test("sweep dry-run (clean): proves references, keeps shared audio, complete manifest, deletes NOTHING", async () => {
  const h = makeHarness();
  await sweepFixture(h);
  const before = h.coord.syncSnapshot({ family: "bindings" }).entities.length;
  const r = h.coord.sweepDryRun("bk1");
  assert.equal(r.dryRun, true);
  assert.equal(r.deletedAnything, false);
  assert.equal(r.conservative, false);
  assert.deepEqual(r.sharedKept, ["shared-key"]); // referenced by bk2 — kept
  assert.ok(r.wouldRemove.some(x => x.cacheKey === "bk1-only"));
  assert.ok(!r.wouldRemove.some(x => x.cacheKey === "shared-key"));
  assert.equal(h.coord.syncSnapshot({ family: "bindings" }).entities.length, before); // nothing deleted
  assert.equal(h.coord.sweepDryRun("bk2").error, "not_tombstoned");
});

test("sweep dry-run FAILS CLOSED: incomplete own binding, incomplete cross-book binding, or a live job each withhold the whole manifest (review blocker 2)", async () => {
  { // incomplete binding in the book itself
    const h = makeHarness();
    await sweepFixture(h, { incompleteOwn: true });
    const r = h.coord.sweepDryRun("bk1");
    assert.equal(r.conservative, true);
    assert.deepEqual(r.wouldRemove, []);
    assert.ok(r.blockedBy.some(b => b.startsWith("incomplete_own_binding")));
  }
  { // incomplete binding in ANOTHER book could hide a reference — blocks too
    const h = makeHarness();
    await sweepFixture(h, { incompleteCross: true });
    const r = h.coord.sweepDryRun("bk1");
    assert.equal(r.conservative, true);
    assert.deepEqual(r.wouldRemove, []);
    assert.ok(r.blockedBy.some(b => b.startsWith("incomplete_cross_book_binding")));
  }
  { // a live (non-terminal) job naming the book blocks removal outright
    const h = makeHarness();
    await sweepFixture(h);
    await h.coord.handleCommand({ command_id: "job-live-1", type: "SubmitJob",
      payload: { jobId: "job-bk1", bookId: "bk1", chapterIndex: 0,
        occurrences: [{ occurrenceId: "s1", chapterIndex: 0, revisionKey: "rk1" }] } });
    const r = h.coord.sweepDryRun("bk1");
    assert.equal(r.conservative, true);
    assert.deepEqual(r.wouldRemove, []);
    assert.ok(r.blockedBy.some(b => b.startsWith("live_jobs")));
  }
});

test("group fences: duplicate entity targets and mixed delete+update groups are rejected whole (re-review blocker)", async () => {
  const h = makeHarness();
  const a = new SyncClient(h.coord, "dev-A");
  await a.pushBook("bk1", BOOK("bk1")); // bk1 at revision 1
  // (a) Two writes to the SAME entity in one group: both would have
  // validated against revision 1 — the group is rejected instead.
  const dup = await a.push([
    { family: "content", entityKey: "bk1", bookId: "bk1", baseRevision: 1, op: "upsert", payload: { ...BOOK("bk1"), title: "first" } },
    { family: "content", entityKey: "bk1", bookId: "bk1", baseRevision: 1, op: "upsert", payload: { ...BOOK("bk1"), title: "second" } },
    { family: "content", entityKey: "bk2", bookId: "bk2", baseRevision: 0, op: "upsert", payload: BOOK("bk2") },
  ]);
  const dupBy = Object.fromEntries(dup.outcomes.map(o => [o.entityKey + o.status, o]));
  assert.equal(dup.outcomes[0].status, "rejected");
  assert.equal(dup.outcomes[0].reason, "duplicate_entity_in_group");
  assert.equal(dup.outcomes[1].status, "rejected");
  assert.equal(dup.outcomes[2].status, "applied"); // other book unaffected
  let snap = h.coord.syncSnapshot({ family: "content" });
  assert.equal(snap.entities.find(e => e.entityKey === "bk1").revision, 1); // neither write landed
  assert.equal(snap.entities.find(e => e.entityKey === "bk1").data.title, "Book bk1");
  // (b) Delete mixed with a binding update for the same book: the
  // update could land AFTER the tombstone — rejected whole, and
  // crucially the delete does NOT happen either.
  const mixed = await a.push([
    { family: "content", entityKey: "bk1", bookId: "bk1", baseRevision: 1, op: "delete" },
    { family: "bindings", entityKey: "bk1:s1", bookId: "bk1", baseRevision: 0, op: "upsert", payload: { cacheKey: "k" } },
  ]);
  assert.equal(mixed.outcomes[0].status, "rejected");
  assert.equal(mixed.outcomes[0].reason, "mixed_delete_group");
  assert.equal(mixed.outcomes[1].status, "rejected");
  snap = h.coord.syncSnapshot({ family: "content" });
  assert.equal(snap.entities.find(e => e.entityKey === "bk1").tombstone, false); // not deleted
  assert.equal(h.coord.syncSnapshot({ family: "bindings" }).entities.length, 0); // no post-tombstone write
  // (c) A LONE delete still works fine:
  const lone = await a.push([
    { family: "content", entityKey: "bk1", bookId: "bk1", baseRevision: 1, op: "delete" },
  ]);
  assert.equal(lone.outcomes[0].status, "applied");
  assert.equal(h.coord.syncSnapshot({ family: "content" }).entities.find(e => e.entityKey === "bk1").tombstone, true);
});

test("pushes are atomic PER BOOK: one conflict in a book commits NONE of that book, other books succeed (review concern)", async () => {
  const h = makeHarness();
  const a = new SyncClient(h.coord, "dev-A");
  await a.pushBook("bk1", BOOK("bk1")); // bk1 content at revision 1
  const r = await a.push([
    { family: "content", entityKey: "bk1", bookId: "bk1", baseRevision: 1, op: "upsert", payload: { ...BOOK("bk1"), title: "bk1 edited" } },
    { family: "bindings", entityKey: "bk1:s1", bookId: "bk1", baseRevision: 99, op: "upsert", payload: { cacheKey: "k" } }, // conflict
    { family: "content", entityKey: "bk2", bookId: "bk2", baseRevision: 0, op: "upsert", payload: BOOK("bk2") },
  ]);
  const by = Object.fromEntries(r.outcomes.map(o => [o.entityKey, o]));
  assert.equal(by["bk1:s1"].status, "conflict");
  assert.equal(by["bk1"].status, "aborted_book_conflict"); // valid, but the book aborted
  assert.equal(by["bk2"].status, "applied");               // other books unaffected
  const snap = h.coord.syncSnapshot({ family: "content" });
  const bk1 = snap.entities.find(e => e.entityKey === "bk1");
  assert.equal(bk1.revision, 1);                            // nothing of bk1 committed
  assert.equal(bk1.data.title, "Book bk1");
  assert.equal(h.coord.syncSnapshot({ family: "bindings" }).entities.length, 0);
});

// ---------- money boundary ----------

test("money: no client-writable money family; settings CAS conflict is non-silent; money reads are revisioned", async () => {
  const h = makeHarness();
  const a = new SyncClient(h.coord, "dev-A");
  const b = new SyncClient(h.coord, "dev-B");
  const bad = await a.push([{ family: "money", entityKey: "ledger", baseRevision: 0, op: "upsert", payload: { spent: 0 } }]);
  assert.equal(bad.outcomes[0].status, "invalid"); // money is not a sync family
  const s1 = await a.push([{ family: "settings", entityKey: "settings", baseRevision: 0, op: "upsert", payload: { monthlyCap: 60 } }]);
  assert.equal(s1.outcomes[0].status, "applied");
  // B, working from the stale base, conflicts — with the CURRENT revision attached:
  const s2 = await b.push([{ family: "settings", entityKey: "settings", baseRevision: 0, op: "upsert", payload: { monthlyCap: 10 } }]);
  assert.equal(s2.outcomes[0].status, "conflict");
  assert.equal(s2.outcomes[0].currentRevision, 1);
  assert.equal(h.coord.settingsView().monthlyCap, 60); // no auto-merge, no silent overwrite
  const q = h.coord.quotaView();
  assert.equal(q.settingsRevision, 1);
  assert.equal(typeof q.ledgerSeq, "number");
  // Settings deltas pull like any family:
  await b.pull("settings");
  assert.equal(b.mirror.settings.monthlyCap, 60);
});

// ---------- two-device convergence (exit criteria) ----------

test("two-device convergence: interleaved edits, position events and a conflict converge to the coordinator's read models", async () => {
  const h = makeHarness();
  const a = new SyncClient(h.coord, "dev-A");
  const b = new SyncClient(h.coord, "dev-B");
  await a.pushBook("bk1", BOOK("bk1"));
  await b.pullAll();
  // Interleave: B edits bk1 while A adds bk2; A seeks in bk1; B checkpoints further.
  const edit = await b.pushBook("bk1", { ...BOOK("bk1"), title: "Edited by B" });
  assert.equal(edit.outcomes[0].status, "applied");
  await a.pushBook("bk2", BOOK("bk2"));
  await a.position("bk1", { kind: "seek", occurrenceId: "s2", offsetSec: 12 });
  await b.position("bk1", { kind: "checkpoint", occurrenceId: "s2", offsetSec: 40 });
  await a.pullAll(); await b.pullAll();
  for (const c of [a, b]) {
    assert.equal(c.mirror.content.get("bk1").title, "Edited by B");
    assert.equal(c.mirror.content.get("bk2").title, "Book bk2");
    assert.equal(c.bookTips.get("bk1"), 2);
  }
  const v = h.coord.positionView("bk1");
  assert.equal(v.canonical.offsetSec, 40); // receipt order: A's seek, then B's checkpoint
  // A stale edit from A (base revision 1, current 2) conflicts and converges after rebase:
  const stale = await a.push([{ family: "content", entityKey: "bk1", bookId: "bk1", baseRevision: 1, op: "upsert", payload: { title: "A stale" } }]);
  assert.equal(stale.outcomes[0].status, "conflict");
  await a.pullAll();
  assert.equal(a.mirror.content.get("bk1").title, "Edited by B");
});

test("large library: 60 books paginate and converge on a second device", async () => {
  const h = makeHarness();
  const a = new SyncClient(h.coord, "dev-A");
  const b = new SyncClient(h.coord, "dev-B");
  const batch = [];
  for (let i = 1; i <= 60; i++)
    batch.push({ family: "content", entityKey: `bk${i}`, bookId: `bk${i}`, baseRevision: 0, op: "upsert", payload: BOOK(`bk${i}`) });
  const r = await a.push(batch);
  assert.equal(r.outcomes.filter(o => o.status === "applied").length, 60);
  await b.pull("content");
  assert.equal(b.mirror.content.size, 60);
  assert.equal(b.seqs.content, 60);
});
