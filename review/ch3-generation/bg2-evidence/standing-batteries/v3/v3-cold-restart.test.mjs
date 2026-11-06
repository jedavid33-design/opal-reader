// V-3 HARNESS BATTERY — OQ-2 cold-restart transition mechanics
// (Rowan OQ-2 ruling, Q-4/Q-6: V-3 must test THE EXACT cold
// transition and its reservation effects; a failed or ambiguous
// assertion blocks the gate).
//
// Scenario: a Phase-B-shaped single-occurrence job is churned
// warm through 87 grants on the real machinery (the production
// pattern: lease expiry -> safe void -> reissue, under
// GENERATION_HALT "1" throughout), stood down cold (registration
// deleted, lease left stale by 26 h of wall-clock with NO pass
// running — the post-C3/restoration posture), then driven.
//   T1  the cold transition: seg:87 safe-voids, seg:88 issues,
//       reservation continuity, zero dispatch, revision explained.
//   T2  immediate second pass: the chain idles (no early churn).
//   T3  stale successor: the warm pattern reproduces from cold.
//   T4  identity: grant ids are revision-derived, unique, and
//       seg:87 can never be reissued.
//   T5  the full snapshot series: never two live grants, never
//       reserved 24, dispatched always 0.
//
// Source under test: the deployed composed tree (Grant 1 build
// fdb02395...) at ../containment-v4/composed-tree, driven through
// the containment-v4 harness (real node:sqlite; its SqlCursor
// .one() THROWS on 0 or >1 rows — production DO semantics, NOT
// the null-returning fake of the older do-harness). No assertion
// below depends on an empty-result .one() path: the .one() calls
// on the exercised paths are aggregate COUNT/SUM queries, which
// return exactly one row by construction.
//
// Local only: no network, no production calls. The harness
// invokes alarm() directly — this battery proves TRANSITION
// MECHANICS in the harness. It does not and cannot prove
// platform alarm DELIVERY (the W-4 question), which only the
// GR-2C production observation can discharge.

import { describe, test, before } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  makeWorld, seedAttempt3Shape, OCC26,
} from "../harness.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
// B-G2 SCAFFOLDING ADAPTATION (disclosed in the implementation
// record): harness import re-pointed at the build's harness copy and
// the default tree is the B-G2 candidate tree (V3_TREE_DIR still
// overrides). Test bodies are byte-identical to the original.
const TREE = process.env.V3_TREE_DIR ||
  join(HERE, "..", "..", "candidate-tree");
const MIN = 60 * 1000;
const LEASE_MS = 15 * MIN;

const quota = await import(
  pathToFileURL(join(TREE, "v2/generation/quota-budget.mjs")).href);

// ----------------------------------------------------------------
// Read helpers (direct SQL over the harness DB — the same reads
// the production diagnostics project, at row level).
const grants = (w) => w.db.prepare(
  `SELECT * FROM grants ORDER BY created_at, grant_id`).all();
const liveGrants = (w, jobId) => w.db.prepare(
  `SELECT * FROM grants WHERE job_id = ? AND state = 'issued'
   ORDER BY grant_id`).all(jobId);
const grantById = (w, id) => w.db.prepare(
  `SELECT * FROM grants WHERE grant_id = ?`).all(id);
const suffixOf = (id) => Number(id.match(/:(\d+):full$/)[1]);
const openReserved = (w) => w.db.prepare(
  `SELECT COALESCE(SUM(slots_total - slots_consumed), 0) AS s
     FROM d6_grant_reservations WHERE state = 'open'`).get().s;
const reservationsFor = (w, grantId) => w.db.prepare(
  `SELECT * FROM d6_grant_reservations WHERE grant_id = ?`).all(grantId);
const occRow = (w, jobId) => w.db.prepare(
  `SELECT * FROM occurrences WHERE job_id = ? AND occurrence_id = ?`)
  .get(jobId, OCC26);
const jobRow = (w, jobId) => w.db.prepare(
  `SELECT * FROM jobs WHERE job_id = ?`).get(jobId);
const driveRows = (w) => w.db.prepare(
  `SELECT * FROM d6_drive_passes ORDER BY id`).all();
const dispatched = (w) => w.db.prepare(
  `SELECT COUNT(*) AS n FROM d6_provider_dispatches`).get().n;
const outboxRow = (w, id) => w.db.prepare(
  `SELECT * FROM outbox WHERE id = ?`).all(id);
const transitionsSince = (w, id) => w.db.prepare(
  `SELECT * FROM transitions WHERE id > ? ORDER BY id`).all(id);
const maxTransitionId = (w) => w.db.prepare(
  `SELECT COALESCE(MAX(id), 0) AS m FROM transitions`).get().m;

// Snapshot series (T5): every observable state this battery
// drives through, in order.
const series = [];
function snap(w, jobId, label) {
  const s = {
    label,
    live: liveGrants(w, jobId).map((g) => g.grant_id),
    openReserved: openReserved(w),
    dispatched: dispatched(w),
    occ: occRow(w, jobId).state,
    jobRev: jobRow(w, jobId).revision,
  };
  series.push(s);
  return s;
}

// Drive passes until the job settles with exactly one live grant
// (the void and the successor issuance may land in the same pass
// or in consecutive passes — assessment M-6). Returns the index
// of the pass at which the live grant was FIRST observed.
async function driveUntilLive(w, jobId, label) {
  for (let i = 0; i < 3; i++) {
    await w.fireClassAlarm();
    snap(w, jobId, `${label}/pass${i + 1}`);
    if (liveGrants(w, jobId).length === 1) return i;
    w.advance(31 * 1000); // cross the +30 s retry_grant row
  }
  return -1;
}

// ----------------------------------------------------------------
describe("V-3 — cold restart of the adopted GR-B state", () => {
  let w, seed, jobId;
  let seg87, seg88, seg89;
  let coldEvidence = {};

  before(async () => {
    w = await makeWorld(TREE);
    seed = await seedAttempt3Shape(w);
    jobId = seed.jobId;
    // Production is quota-armed; arm the guard with the tree's
    // own bootstrap (fixture setup, shipped code path). The
    // seed's settled-plan attempt rows make the SEED day a
    // bootstrap-exception day, exactly as production's straddler
    // does — so the churn starts on a later PT day, where no
    // exception interval reaches.
    const boot = quota.bootstrapQuota(w.coord);
    assert.equal(boot.bootstrapped, true);
    w.advance(48 * 60 * MIN);
    // Warm churn: seg:1 issues on the first pass; each further
    // cycle lets the lease go stale (no delivery exists under
    // HALT "1") and drives the void -> reissue pattern, exactly
    // as production passes 1..296 did.
    const first = await driveUntilLive(w, jobId, "churn/seg1");
    assert.ok(first >= 0, "first grant issued");
    let live = liveGrants(w, jobId);
    assert.equal(suffixOf(live[0].grant_id), 1);
    while (suffixOf(liveGrants(w, jobId)[0].grant_id) < 87) {
      const prev = suffixOf(liveGrants(w, jobId)[0].grant_id);
      w.advance(LEASE_MS + MIN);
      const idx = await driveUntilLive(w, jobId, `churn/seg${prev + 1}`);
      assert.ok(idx >= 0, `successor after seg:${prev} issued`);
      live = liveGrants(w, jobId);
      assert.equal(live.length, 1, "exactly one live grant per cycle");
      assert.equal(suffixOf(live[0].grant_id), prev + 1,
        "grant suffix increments by exactly one per cycle");
      assert.equal(openReserved(w), 12,
        "derived reserved returns to exactly 12 after every cycle");
      assert.equal(dispatched(w), 0, "no dispatch during warm churn");
    }
    seg87 = liveGrants(w, jobId)[0].grant_id;
    assert.match(seg87, /:87:full$/);
    assert.equal(jobRow(w, jobId).revision, 88,
      "fixture: job revision 88 with seg:87 standing issued");
    assert.equal(occRow(w, jobId).state, "granted");
    assert.equal(openReserved(w), 12);
    // THE COLD STAND-DOWN: the registration is deleted (the C3
    // stop's physical act) and 26 hours pass with NO alarm pass
    // running — seg:87's lease goes stale unobserved, exactly
    // the post-stop / post-restoration posture.
    await w.storage.deleteAlarm();
    assert.equal(w.alarmAt(), null);
    w.advance(26 * 60 * MIN);
    snap(w, jobId, "cold/fixture");
  });

  test("T1 — the cold pass safe-voids seg:87 and issues seg:88, reservation continuous, zero dispatch", async () => {
    const rowsBefore = driveRows(w).length;
    const tBefore = maxTransitionId(w);
    const revBefore = jobRow(w, jobId).revision;
    assert.equal(revBefore, 88);
    // ONE cold alarm pass.
    await w.fireClassAlarm();
    snap(w, jobId, "cold/pass1");
    const rowsAfter1 = driveRows(w);
    // (a) Recorder evidence — evidenced SEPARATELY from the
    // grant state (Rowan's protocol correction): the pass wrote
    // a recorder row, stage complete.
    assert.equal(rowsAfter1.length, rowsBefore + 1,
      "the cold pass wrote exactly one new recorder row");
    const recRow = rowsAfter1[rowsAfter1.length - 1];
    assert.equal(recRow.stage, "complete",
      "cold pass recorder row stage is complete");
    assert.equal(recRow.drive_invoked, 1);
    coldEvidence.recorderRowId = recRow.id;
    // The successor may issue in this same pass (drive sweep) or
    // in the +30 s retry pass (assessment M-6). Settle, and note
    // at which pass seg:88 is FIRST observed — do not equate the
    // completed pass with the successor's issuance.
    let live = liveGrants(w, jobId);
    let successorFirstSeenPass = live.length === 1 ? 1 : -1;
    if (live.length === 0) {
      // Permissible transient (Q-3): void landed, reissue waits
      // on the retry row. It must be exactly this shape.
      assert.equal(grantById(w, seg87)[0].state, "voided");
      assert.equal(occRow(w, jobId).state, "pending");
      assert.equal(openReserved(w), 0,
        "transient reserved 0 between void and reissue");
      w.advance(31 * 1000);
      await w.fireClassAlarm();
      snap(w, jobId, "cold/pass2-retry");
      live = liveGrants(w, jobId);
      if (live.length === 1) successorFirstSeenPass = 2;
    }
    coldEvidence.successorFirstSeenPass = successorFirstSeenPass;
    assert.equal(live.length, 1, "exactly one live grant after settling");
    seg88 = live[0].grant_id;
    // (c) The successor's identity is forced: seg:88:full.
    assert.match(seg88, /:88:full$/,
      "successor is seg:88:full (revision-derived identity)");
    assert.equal(live[0].state, "issued");
    // (b) seg:87 was safe-voided, never reissued: one row, voided.
    const g87 = grantById(w, seg87);
    assert.equal(g87.length, 1, "seg:87 exists exactly once");
    assert.equal(g87[0].state, "voided");
    // (f) Occurrence path: granted -(defer)-> pending -(grant)->
    // granted, in that order, inside the cold window.
    const win = transitionsSince(w, tBefore);
    const occEvents = win.filter(
      (t) => t.aggregate === "occurrence" &&
             t.aggregate_id === `${jobId}/${OCC26}`);
    const deferAt = occEvents.findIndex(
      (t) => t.cause === "dispatch_voided" && t.to_state === "pending");
    const grantAt = occEvents.findIndex(
      (t) => t.cause === "grant" && t.to_state === "granted");
    assert.ok(deferAt >= 0, "occurrence deferred to pending by the void");
    assert.ok(grantAt > deferAt,
      "occurrence re-granted only after the void's defer");
    assert.equal(occRow(w, jobId).state, "granted");
    // The void's own transition names the safe-void reason.
    const voidTx = win.filter(
      (t) => t.aggregate === "grant" && t.aggregate_id === seg87 &&
             t.cause === "dispatch_voided");
    assert.equal(voidTx.length, 1, "exactly one void transition for seg:87");
    assert.equal(JSON.parse(voidTx[0].detail_json).voidReason,
      "lease_expired_undelivered");
    // (e) Reservation continuity: seg:87's 12 closed exactly once
    // ('grant_voided'); seg:88's fresh 12 stand open; total 12.
    const r87 = reservationsFor(w, seg87);
    assert.equal(r87.length, 1);
    assert.equal(r87[0].state, "closed");
    assert.equal(r87[0].close_reason, "grant_voided");
    assert.equal(r87[0].slots_total, 12);
    const r88 = reservationsFor(w, seg88);
    assert.equal(r88.length, 1);
    assert.equal(r88[0].state, "open");
    assert.equal(r88[0].slots_total, 12);
    assert.equal(openReserved(w), 12, "derived reserved is exactly 12");
    // Exactly-once: a second close sweep for seg:87 is a no-op.
    const again = quota.closeReservationsForVoidedGrant(w.coord, seg87);
    assert.deepEqual(again.closed, [],
      "second close sweep closes nothing (exactly-once release)");
    assert.equal(reservationsFor(w, seg87)[0].state, "closed");
    // The attempt-ledger release for seg:87's op is also single.
    const rel = w.db.prepare(
      `SELECT * FROM ledger_ops WHERE op_key = ?`)
      .all(`rel:op:${seg87}:${OCC26}`);
    assert.equal(rel.length, 1, "exactly one attempt-ledger release row");
    // (g) Zero dispatch under HALT "1": no dispatch-ledger rows,
    // nothing reached the queue binding, seg:88's outbox row was
    // never invoked, and seg:87's outbox row is gone (void).
    assert.equal(dispatched(w), 0);
    assert.equal(w.queue.sent.length, 0);
    assert.equal(outboxRow(w, seg87).length, 0,
      "the void deleted seg:87's outbox row");
    const ob88 = outboxRow(w, seg88);
    assert.equal(ob88.length, 1);
    assert.equal(ob88[0].sent_at, null);
    assert.equal(ob88[0].send_attempted_at, null,
      "seg:88 was born never-invoked, like every grant under the halt");
    // (h) Revision: explained by the job transitions in window.
    const revAfter = jobRow(w, jobId).revision;
    const jobGrantEvents = win.filter(
      (t) => t.aggregate === "job" && t.aggregate_id === jobId &&
             (JSON.parse(t.detail_json || "{}").grantId === seg88)).length;
    coldEvidence.revBefore = revBefore;
    coldEvidence.revAfter = revAfter;
    coldEvidence.jobGrantEvents = jobGrantEvents;
    assert.equal(revAfter - revBefore, jobGrantEvents,
      "revision delta equals the recorded job 'grant' events");
    assert.equal(jobGrantEvents, 1,
      "exactly one issuance event in the cold window");
    assert.equal(revAfter, 89, "job revision is 89 after the cold pass");
    // Two consecutive complete accounting polls (Q-3): two read
    // sets, no intervening act, identical settled state.
    const poll1 = snap(w, jobId, "cold/poll1");
    const poll2 = snap(w, jobId, "cold/poll2");
    assert.deepEqual(
      { live: poll2.live, openReserved: poll2.openReserved,
        dispatched: poll2.dispatched, occ: poll2.occ,
        jobRev: poll2.jobRev },
      { live: poll1.live, openReserved: poll1.openReserved,
        dispatched: poll1.dispatched, occ: poll1.occ,
        jobRev: poll1.jobRev },
      "two consecutive accounting polls agree on the settled state");
  });

  test("T2 — an immediate second pass idles: no void, no new grant, no reservation movement", async () => {
    const grantsBefore = grants(w).map((g) => `${g.grant_id}:${g.state}`);
    const revBefore = jobRow(w, jobId).revision;
    w.advance(MIN); // past any retry row, far inside seg:88's lease
    await w.fireClassAlarm();
    snap(w, jobId, "t2/idle-pass");
    assert.deepEqual(grants(w).map((g) => `${g.grant_id}:${g.state}`),
      grantsBefore, "grant set and states unchanged");
    assert.equal(liveGrants(w, jobId)[0].grant_id, seg88);
    assert.equal(openReserved(w), 12);
    assert.equal(occRow(w, jobId).state, "granted");
    assert.equal(jobRow(w, jobId).revision, revBefore,
      "no job event applied by the idle pass");
    assert.equal(dispatched(w), 0);
    assert.equal(outboxRow(w, seg88)[0].send_attempted_at, null);
  });

  test("T3 — the stale successor voids and reissues: the warm pattern reproduces from the cold start", async () => {
    w.advance(LEASE_MS + MIN);
    const idx = await driveUntilLive(w, jobId, "t3");
    assert.ok(idx >= 0, "seg:89 issued");
    const live = liveGrants(w, jobId);
    assert.equal(live.length, 1);
    seg89 = live[0].grant_id;
    assert.match(seg89, /:89:full$/);
    assert.equal(grantById(w, seg88)[0].state, "voided");
    assert.equal(grantById(w, seg87)[0].state, "voided",
      "seg:87 remains voided — never resurrected");
    assert.equal(reservationsFor(w, seg88)[0].state, "closed");
    assert.equal(reservationsFor(w, seg88)[0].close_reason, "grant_voided");
    assert.equal(reservationsFor(w, seg89)[0].state, "open");
    assert.equal(openReserved(w), 12);
    assert.equal(occRow(w, jobId).state, "granted");
    assert.equal(dispatched(w), 0);
    assert.equal(w.queue.sent.length, 0);
  });

  test("T4 — revision-derived identity: ids unique and monotonic; seg:87 cannot be reissued", async () => {
    const all = grants(w);
    const suffixes = all.map((g) => suffixOf(g.grant_id)).sort((a, b) => a - b);
    assert.deepEqual(suffixes,
      Array.from({ length: 89 }, (_, i) => i + 1),
      "grants seg:1..seg:89 each exist exactly once");
    assert.equal(grantById(w, seg87).length, 1);
    // A fresh issuance attempt against a fully-granted job is
    // refused by the state machine and creates nothing.
    const before = grants(w).length;
    const r = await w.coord.requestGrant(jobId);
    assert.equal(r.ok, false, "issuance refused: nothing pending");
    assert.equal(grants(w).length, before, "no grant row created");
    assert.equal(grantById(w, seg87).length, 1,
      "seg:87 still exists exactly once, voided");
    assert.equal(grantById(w, seg87)[0].state, "voided");
    // The next id the machinery could ever produce is revision-
    // derived from the CURRENT revision (> 89) — never 87 again.
    assert.ok(jobRow(w, jobId).revision > 89);
  });

  test("T5 — the observable series: never two live grants, never reserved 24, dispatched always 0", () => {
    assert.ok(series.length >= 90, "series covers churn + cold + T2/T3");
    for (const s of series) {
      assert.ok(s.live.length <= 1,
        `${s.label}: at most one live grant (saw ${s.live})`);
      assert.notEqual(s.openReserved, 24,
        `${s.label}: reserved never 24 (double-count signature)`);
      assert.ok(s.openReserved === 0 || s.openReserved === 12,
        `${s.label}: reserved is 12, or the explained void->reissue transient 0 (saw ${s.openReserved})`);
      assert.equal(s.dispatched, 0,
        `${s.label}: dispatched stays 0 under the halt`);
    }
    // The evidence object is the T1 revision/observation record.
    assert.equal(coldEvidence.revBefore, 88);
    assert.equal(coldEvidence.successorFirstSeenPass >= 1, true);
    console.log("V3-EVIDENCE", JSON.stringify(coldEvidence));
    console.log("V3-SERIES", JSON.stringify(series));
  });
});
