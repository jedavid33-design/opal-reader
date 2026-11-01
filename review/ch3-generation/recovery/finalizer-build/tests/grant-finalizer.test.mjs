// Ch 3 Phase A RECOVERY — Option A grant finalizer, store level
// (RECOVERY-PROPOSAL-DRAFT §4 + §9.1/§9.3; Rowan 6551435961
// acceptance checks 1, 2, 4, 5).
//
// Fixture S: the LIVE-SHAPED stalled state, seeded by direct SQL
// with the exact production identities and values from the Phase
// A execution record (plan plan:e377a5559961b294154276b6; grant
// grant:plan:e377a5559961b294154276b6:ch2:1:full, issued rev 2;
// the eight committed executions with their real attempt ids,
// outcomes, and costs — 44 confirmed attempts, pattern
// 4/6/6/6/6/6/4/6 in chapter order, summing to 152,964; eight
// open reservations qres:<grant>:<occurrence>:2026-10-31 with
// slots 12 and consumption equal to the attempt counts, residual
// 52; phase settled 732,303 including the adjudicated straddler's
// 19,018 / 5,648 unverified pair; watermarks 1826 / 18).
// Structural metadata only — no segment text anywhere.

import { test } from "node:test";
import assert from "node:assert/strict";
import { makeHarness } from "./helpers/do-harness.mjs";
import { createGenStore } from "../worker/generation/genstore.mjs";
import { derivedDayTotals } from "../worker/generation/quota-budget.mjs";
import {
  BOOK, PLAN, JOB, GRANT, PARKED_JOB, DAY, T0, AUTH_REF, BOUND3, ELIGIBLE,
  FINAL26, TARGETS, PENDING, EXECUTIONS, seedStalledState,
} from "./helpers/grant-finalizer-fixture.mjs";
import {
  previewGrantFinalization, finalizeGrant, deriveGrantFinalizationState,
} from "../worker/generation/grant-finalizer.mjs";

// Fixture S lives in the shared helper (the routes suite seeds
// the identical state through the real entry's storage).
function seedStalledWorld(opts = {}) {
  const h = makeHarness({
    startMs: T0,
    extraEnv: { OPALREADER_V2_SCOPE: "production", GENERATION_HALT: "0" },
  });
  const coord = h.coord;
  const store = createGenStore(coord);
  seedStalledState(coord, store, opts);
  return { coord, store, harness: h, setNow: (ms) => h.setNow(ms) };
}

// A compact full-state snapshot for zero-write assertions.
function snapshot(coord) {
  const one = (q, ...p) => coord._one(q, ...p);
  const tables = coord._all(
    `SELECT name FROM sqlite_master WHERE type = 'table'`).map(r => r.name);
  return {
    grant: coord._oneOrNull(`SELECT state, revision, report_json FROM grants WHERE grant_id = ?`, GRANT),
    claim: coord._oneOrNull(`SELECT state FROM claims WHERE grant_id = ?`, GRANT),
    job: coord._oneOrNull(`SELECT state, revision FROM jobs WHERE job_id = ?`, JOB),
    reservations: coord._all(
      `SELECT reservation_id, state, close_reason FROM d6_grant_reservations
        WHERE grant_id = ? ORDER BY reservation_id`, GRANT),
    attempts: one(`SELECT COUNT(*) AS n FROM d6_attempt_log`).n,
    dispatches: one(`SELECT COUNT(*) AS n FROM d6_provider_dispatches`).n,
    executions: one(`SELECT COUNT(*) AS n FROM d6_execution_records`).n,
    // The audit table's DDL bootstrap is lazy schema creation
    // (the house pattern), not a data write: zero-write
    // assertions compare ROWS, and the preview test separately
    // proves the preview does not even create the table.
    auditRows: tables.includes("d6_grant_finalizations")
      ? one(`SELECT COUNT(*) AS n FROM d6_grant_finalizations`).n : 0,
    dayTotals: derivedDayTotals(coord, DAY),
  };
}

const preview = (w, extra = {}) =>
  previewGrantFinalization(w.coord, w.store, { grantId: GRANT, ...extra });
const finalize = (w, digest, extra = {}) => finalizeGrant(w.coord, w.store, {
  grantId: GRANT, planId: PLAN, jobId: JOB,
  authorizationRef: AUTH_REF, expectedPreconditionDigest: digest, ...extra,
});

test("preview derives the exact live-shaped precondition state (Rowan check 2)", () => {
  const w = seedStalledWorld();
  const before = snapshot(w.coord);
  const p = preview(w);
  assert.equal(p.outcome, "preview");
  assert.equal(p.classification, "finalizable");
  assert.match(p.preconditionDigest, /^[0-9a-f]{64}$/);
  const v = p.state;
  assert.equal(v.grant.state, "issued");
  assert.equal(v.grant.revision, 2);
  assert.equal(v.job.state, "generating");
  assert.equal(v.plan.state, "active");
  assert.deepEqual(v.plan.totals, { eligible: 23, done: 8, failed: 0, blocked: 0, prompts: 0 });
  assert.equal(v.claim.state, "claimed");
  assert.equal(v.outbox.acked, true);
  assert.deepEqual(v.outbox.targetIds, [...TARGETS].sort());
  // Targets in plan order with the exact consumed-slot pattern.
  assert.deepEqual(v.targets.map(t => t.occurrenceId), TARGETS);
  assert.deepEqual(v.targets.map(t => t.attempts.total), [4, 6, 6, 6, 6, 6, 4, 6]);
  assert.deepEqual(v.targets.map(t => t.reservation.reservationId),
    TARGETS.map(id => `qres:${GRANT}:${id}:${DAY}`));
  assert.ok(v.targets.every(t => t.reservation.dayKey === DAY));
  assert.ok(v.targets.every(t => t.reservation.slotsTotal === 12));
  assert.ok(v.targets.every(t => t.executionState === "committed"));
  assert.equal(v.attemptsTotal, 44);
  assert.equal(v.dispatchTotal, 44);
  assert.deepEqual(v.reservations,
    { count: 8, dayKey: DAY, slotsTotal: 96, slotsConsumed: 44, residual: 52 });
  assert.deepEqual(v.dayTotals, { dayKey: DAY, dispatched: 44, reserved: 52, consumed: 96 });
  assert.deepEqual(v.partition, { ready: 8, pending: 15 });
  assert.deepEqual(v.pendingIds, PENDING);
  assert.equal(v.phase, "forever-pucked");
  assert.equal(v.phaseAccounting.settledMicro, 732303);
  assert.equal(v.phaseAccounting.estimatedUnverifiedMicro, 19018);
  assert.equal(v.phaseAccounting.reservedUnverifiedMicro, 5648);
  assert.equal(v.phaseAccounting.unknownOpen, 0);
  assert.deepEqual(v.watermarks, { bindings: 1826, content: 18 });
  assert.equal(v.parkRelease.releaseId, 1);
  assert.equal(v.parkRelease.coversEligible, true);
  assert.equal(v.exemptionForFinalOccurrence, false);
  // Preview is read-only: identical snapshot, and it does not
  // even bootstrap the audit table.
  assert.deepEqual(snapshot(w.coord), before);
  assert.equal(w.coord._all(
    `SELECT name FROM sqlite_master WHERE type = 'table'
      AND name = 'd6_grant_finalizations'`).length, 0);
  // Byte-stable: a second derivation is identical.
  const p2 = preview(w);
  assert.equal(p2.preconditionDigest, p.preconditionDigest);
  assert.equal(JSON.stringify(p2.state), JSON.stringify(p.state));
});

test("finalize applies exactly the §4.4 writes, atomically (Rowan checks 1 + 2)", () => {
  const w = seedStalledWorld();
  const p = preview(w);
  const r = finalize(w, p.preconditionDigest);
  assert.equal(r.outcome, "applied");
  assert.equal(r.audit.authorizationRef, AUTH_REF);
  assert.equal(r.audit.preconditionDigest, p.preconditionDigest);
  assert.equal(r.audit.beforeTotals.dispatched, 44);
  assert.equal(r.audit.beforeTotals.reserved, 52);
  assert.equal(r.audit.beforeTotals.consumed, 96);
  assert.equal(r.audit.beforeTotals.phaseSettledMicro, 732303);
  // Grant reported with the labeled operator record.
  const grant = w.coord._oneOrNull(`SELECT * FROM grants WHERE grant_id = ?`, GRANT);
  assert.equal(grant.state, "reported");
  const report = JSON.parse(grant.report_json);
  assert.deepEqual(report.results, []);
  assert.equal(report.detail.finalization, "operator_grant_finalization");
  assert.equal(report.detail.authorizationRef, AUTH_REF);
  assert.equal(report.detail.preconditionDigest, p.preconditionDigest);
  // Claim completed.
  assert.equal(w.coord._oneOrNull(`SELECT state FROM claims WHERE grant_id = ?`, GRANT).state,
    "completed");
  // Every closed reservation read back individually.
  const rows = w.coord._all(
    `SELECT * FROM d6_grant_reservations WHERE grant_id = ? ORDER BY reservation_id`, GRANT);
  assert.equal(rows.length, 8);
  for (const row of rows) {
    assert.equal(row.state, "closed");
    assert.equal(row.close_reason, "grant_settled");
    assert.equal(row.day_key, DAY);
  }
  assert.deepEqual(rows.map(r => r.reservation_id),
    TARGETS.map(id => `qres:${GRANT}:${id}:${DAY}`).sort());
  // Day totals: reserved released, dispatched/consumed untouched.
  assert.deepEqual(derivedDayTotals(w.coord, DAY),
    { dayKey: DAY, dispatched: 44, reserved: 0, consumed: 44 });
  // No money moved: settled identical, attempts/dispatches intact.
  const after = preview(w);
  assert.equal(after.classification, "already_finalized");
  assert.equal(w.coord._one(`SELECT COUNT(*) AS n FROM d6_attempt_log`).n, 44 + 18 + 1);
  assert.equal(w.coord._one(`SELECT COUNT(*) AS n FROM d6_provider_dispatches`).n, 44);
  // Job and plan untouched; occurrences untouched.
  const job = w.coord._oneOrNull(`SELECT state, revision FROM jobs WHERE job_id = ?`, JOB);
  assert.deepEqual({ state: job.state, revision: job.revision },
    { state: "generating", revision: 2 });
  assert.equal(w.coord._all(`SELECT occurrence_id FROM occurrences
    WHERE job_id = ? AND state = 'ready'`, JOB).length, 8);
  assert.equal(w.coord._all(`SELECT occurrence_id FROM occurrences
    WHERE job_id = ? AND state = 'pending'`, JOB).length, 15);
});

test("replay is audit-bound, byte-stable, and write-free (Rowan check 4)", () => {
  const w = seedStalledWorld();
  const p = preview(w);
  assert.equal(finalize(w, p.preconditionDigest).outcome, "applied");
  const settled = snapshot(w.coord);
  const replay = finalize(w, p.preconditionDigest);
  assert.equal(replay.outcome, "already_finalized");
  assert.deepEqual(snapshot(w.coord), settled);
  const replay2 = finalize(w, p.preconditionDigest);
  assert.equal(JSON.stringify(replay2), JSON.stringify(replay));
  assert.deepEqual(snapshot(w.coord), settled);
});

test("a grant reported without the finalizer audit refuses as not-finalizer, zero writes", () => {
  const w = seedStalledWorld();
  // Simulate a genuine executor report landing late.
  w.coord.sql.exec(
    `UPDATE grants SET state = 'reported', report_json = ? WHERE grant_id = ?`,
    JSON.stringify({ grantId: GRANT, results: [] }), GRANT);
  const before = snapshot(w.coord);
  const p = preview(w);
  assert.equal(p.classification, "already_reported_not_finalizer");
  const r = finalize(w, "0".repeat(64));
  assert.equal(r.outcome, "already_reported_not_finalizer");
  assert.deepEqual(snapshot(w.coord), before);
  // The still-open reservations were NOT silently settled.
  assert.ok(snapshot(w.coord).reservations.every(x => x.state === "open"));
});

test("reported + audit + a reopened reservation STOPs as inconsistent (Rowan check 4)", () => {
  const w = seedStalledWorld();
  const p = preview(w);
  assert.equal(finalize(w, p.preconditionDigest).outcome, "applied");
  w.coord.sql.exec(
    `UPDATE d6_grant_reservations SET state = 'open', close_reason = NULL
      WHERE reservation_id = ?`, `qres:${GRANT}:${TARGETS[0]}:${DAY}`);
  const before = snapshot(w.coord);
  const p2 = preview(w);
  assert.equal(p2.outcome, "rejected");
  assert.equal(p2.reason, "grant_finalization_reported_inconsistent");
  const r = finalize(w, p.preconditionDigest);
  assert.equal(r.outcome, "rejected");
  assert.equal(r.reason, "grant_finalization_reported_inconsistent");
  assert.deepEqual(snapshot(w.coord), before);
});

test("an audit row beside an issued grant is a mismatch and stops everything", () => {
  const w = seedStalledWorld();
  const p = preview(w); // ensures nothing; audit table still absent
  w.coord.sql.exec(`CREATE TABLE IF NOT EXISTS d6_grant_finalizations (
    grant_id TEXT PRIMARY KEY, plan_id TEXT NOT NULL, job_id TEXT NOT NULL,
    book_id TEXT NOT NULL, chapter_index INTEGER, authorization_ref TEXT NOT NULL,
    precondition_digest TEXT NOT NULL, before_totals_json TEXT NOT NULL,
    outcome TEXT NOT NULL, finalized_at INTEGER NOT NULL)`);
  w.coord.sql.exec(
    `INSERT INTO d6_grant_finalizations VALUES (?, ?, ?, ?, 2, 'x', 'y', '{}', 'applied', 1)`,
    GRANT, PLAN, JOB, BOOK);
  const r = finalize(w, p.preconditionDigest);
  assert.equal(r.outcome, "rejected");
  assert.equal(r.reason, "grant_finalization_audit_mismatch");
  assert.equal(snapshot(w.coord).grant.state, "issued");
});

test("digest mismatch (state moved since preview) refuses with zero writes", () => {
  const w = seedStalledWorld();
  const p = preview(w);
  // A watermark moves — digest-bound, not refusal-bound.
  w.coord.sql.exec(`UPDATE sync_family_state SET tip = 1827 WHERE family = 'bindings'`);
  const before = snapshot(w.coord);
  const r = finalize(w, p.preconditionDigest);
  assert.equal(r.outcome, "rejected");
  assert.equal(r.reason, "grant_finalization_digest_mismatch");
  assert.deepEqual(snapshot(w.coord), before);
});

test("stale state between preview and action refuses on re-derivation, zero writes", () => {
  const w = seedStalledWorld();
  const p = preview(w);
  w.coord.sql.exec(`UPDATE claims SET state = 'completed' WHERE grant_id = ?`, GRANT);
  const before = snapshot(w.coord);
  const r = finalize(w, p.preconditionDigest);
  assert.equal(r.outcome, "rejected");
  assert.equal(r.reason, "grant_finalization_claim_not_claimed");
  assert.deepEqual(snapshot(w.coord), before);
});

// ------------------------------------------------------------------
// Refusal battery (§9.1): every case refuses with its named reason
// and leaves the snapshot byte-identical (zero data writes).

function refusalCase(name, mutate, reason, call = "both") {
  test(`refusal: ${name}`, () => {
    const w = seedStalledWorld();
    const p = preview(w);
    if (p.outcome === "preview") mutate(w, p);
    else mutate(w, null);
    const before = snapshot(w.coord);
    if (call === "both" || call === "preview") {
      const pv = preview(w);
      assert.equal(pv.outcome, "rejected", JSON.stringify(pv));
      assert.equal(pv.reason, reason);
    }
    if (call === "both" || call === "finalize") {
      const r = finalize(w, "f".repeat(64));
      assert.equal(r.outcome, "rejected", JSON.stringify(r));
      assert.equal(r.reason, reason);
    }
    assert.deepEqual(snapshot(w.coord), before);
  });
}

refusalCase("claim row missing",
  (w) => w.coord.sql.exec(`DELETE FROM claims WHERE grant_id = ?`, GRANT),
  "grant_finalization_claim_missing");
refusalCase("claim already completed beside an issued grant",
  (w) => w.coord.sql.exec(`UPDATE claims SET state = 'completed' WHERE grant_id = ?`, GRANT),
  "grant_finalization_claim_not_claimed");
refusalCase("outbox row missing",
  (w) => w.coord.sql.exec(`DELETE FROM outbox WHERE id = ?`, GRANT),
  "grant_finalization_outbox_missing");
refusalCase("outbox unacknowledged",
  (w) => w.coord.sql.exec(`UPDATE outbox SET sent_at = NULL WHERE id = ?`, GRANT),
  "grant_finalization_outbox_unacked");
refusalCase("outbox names a ninth occurrence",
  (w) => w.coord.sql.exec(`UPDATE outbox SET payload_json = ? WHERE id = ?`,
    JSON.stringify({ grantId: GRANT, jobId: JOB,
      occurrences: [...TARGETS, PENDING[0]].sort() }), GRANT),
  "grant_finalization_outbox_target_mismatch");
refusalCase("a target occurrence is no longer ready",
  (w) => w.coord.sql.exec(
    `UPDATE occurrences SET state = 'pending' WHERE job_id = ? AND occurrence_id = ?`,
    JOB, TARGETS[2]),
  "grant_finalization_target_not_ready");
refusalCase("an execution exists for a pending occurrence",
  (w) => w.coord.sql.exec(
    `INSERT INTO d6_execution_records (execution_id, plan_id, job_id,
       grant_id, occurrence_id, state, cache_key, detail_json, created_at,
       updated_at) VALUES ('exec-shadow-pending', ?, ?, ?, ?, 'committed', ?, '{}', ?, ?)`,
    PLAN, JOB, GRANT, PENDING[0], "e".repeat(64), T0, T0),
  "grant_finalization_pending_execution_present");
refusalCase("an attempt under a target is not confirmed-known",
  (w) => w.coord.sql.exec(
    `UPDATE d6_attempt_log SET outcome = 'unknown' WHERE attempt_id = ?`,
    EXECUTIONS[0].attempts[0].attemptId),
  "grant_finalization_attempt_mismatch");
refusalCase("unknown billing elsewhere in the phase",
  (w) => w.coord.sql.exec(
    `INSERT INTO d6_attempt_log (attempt_id, execution_id, plan_id,
       occurrence_id, seq, phase, outcome, cost_micro_cents,
       upper_micro_cents, created_at, updated_at)
     VALUES ('att-unknown-elsewhere', 'exec-prior-ch2-0',
       'plan:b2dc2a3d1cd367a0245b9102', 'ch2-occ-0', 900, 'confirmed',
       'unknown', NULL, 100, ?, ?)`, T0, T0),
  "grant_finalization_unknown_open");
refusalCase("reservation slots_consumed disagrees with attempts",
  (w) => w.coord.sql.exec(
    `UPDATE d6_grant_reservations SET slots_consumed = 5 WHERE reservation_id = ?`,
    `qres:${GRANT}:${TARGETS[0]}:${DAY}`),
  "grant_finalization_reservation_mismatch");
refusalCase("a reservation is already closed before finalization",
  (w) => w.coord.sql.exec(
    `UPDATE d6_grant_reservations SET state = 'closed',
       close_reason = 'grant_settled' WHERE reservation_id = ?`,
    `qres:${GRANT}:${TARGETS[1]}:${DAY}`),
  "grant_finalization_reservation_mismatch");
refusalCase("plan no longer active",
  (w) => w.coord.sql.exec(`UPDATE d6_plans SET state = 'complete' WHERE plan_id = ?`, PLAN),
  "grant_finalization_plan_not_active");
refusalCase("a second grant exists for the job",
  (w) => w.coord.sql.exec(
    `INSERT INTO grants (grant_id, job_id, revision, state, created_at,
       lease_expires_at, report_json)
     VALUES ('grant:extra', ?, 1, 'issued', ?, NULL, NULL)`, JOB, T0),
  "grant_finalization_multiple_grants");
refusalCase("a Phase B exemption row exists for the final occurrence",
  (w) => w.coord.sql.exec(
    `INSERT INTO d6_chapter_exemptions (occurrence_id, job_id, book_id,
       chapter_index, authorization_ref, source, note, created_at)
     VALUES (?, ?, ?, 2, 'x', 'operator', NULL, ?)`, FINAL26, PARKED_JOB, BOOK, T0),
  "grant_finalization_exemption_present");
refusalCase("the park release is no longer live",
  (w) => w.coord.sql.exec(`UPDATE d6_park_releases SET state = 'tombstoned'`),
  "grant_finalization_park_release_mismatch");
refusalCase("the phase is halted on unknown billing",
  (w) => w.coord.sql.exec(
    `UPDATE d6_phase_state SET halted_unknown_billing = 1 WHERE phase = 'forever-pucked'`),
  "grant_finalization_phase_halted");
refusalCase("a spend intent exists for a pending occurrence",
  (w) => w.coord.sql.exec(
    `INSERT INTO spend_intents (job_id, occurrence_id, grant_id,
       consumer_id, acquired_at, outcome) VALUES (?, ?, NULL, 'test', ?, NULL)`,
    JOB, PENDING[0], T0),
  "grant_finalization_pending_spend_intent");
refusalCase("a target binding disagrees with its execution",
  (w) => w.coord.sql.exec(
    `UPDATE bindings SET cache_key = ? WHERE occurrence_id = ?`,
    "f".repeat(64), TARGETS[1]),
  "grant_finalization_binding_mismatch");

test("refusal: identity mismatch and unknown grant", () => {
  const w = seedStalledWorld();
  const before = snapshot(w.coord);
  const pv = preview(w, { planId: "plan:someone-else" });
  assert.equal(pv.outcome, "rejected");
  assert.equal(pv.reason, "grant_finalization_identity_mismatch");
  const pv2 = previewGrantFinalization(w.coord, w.store, { grantId: "grant:nope" });
  assert.equal(pv2.outcome, "rejected");
  assert.equal(pv2.reason, "grant_finalization_grant_not_found");
  const r = finalizeGrant(w.coord, w.store, {
    grantId: GRANT, planId: PLAN, jobId: "job:someone-else",
    authorizationRef: AUTH_REF, expectedPreconditionDigest: "f".repeat(64),
  });
  assert.equal(r.reason, "grant_finalization_identity_mismatch");
  assert.deepEqual(snapshot(w.coord), before);
});

test("refusal: quota guard unarmed", () => {
  const w = seedStalledWorld({ armQuota: false });
  const pv = preview(w);
  assert.equal(pv.outcome, "rejected");
  assert.equal(pv.reason, "grant_finalization_quota_unarmed");
  assert.equal(w.coord._oneOrNull(
    `SELECT state FROM grants WHERE grant_id = ?`, GRANT).state, "issued");
});

test("refusal: missing authorization reference / digest at the store", () => {
  const w = seedStalledWorld();
  const p = preview(w);
  const r1 = finalizeGrant(w.coord, w.store, {
    grantId: GRANT, planId: PLAN, jobId: JOB,
    authorizationRef: "  ", expectedPreconditionDigest: p.preconditionDigest,
  });
  assert.equal(r1.reason, "grant_finalization_authorization_ref_required");
  const r2 = finalizeGrant(w.coord, w.store, {
    grantId: GRANT, planId: PLAN, jobId: JOB,
    authorizationRef: AUTH_REF, expectedPreconditionDigest: "",
  });
  assert.equal(r2.reason, "grant_finalization_digest_required");
  const r3 = previewGrantFinalization(w.coord, w.store, {});
  assert.equal(r3.reason, "grant_finalization_grant_required");
});

test("atomicity: a settlement block aborts the whole transaction (Rowan check 1)", () => {
  const w = seedStalledWorld();
  // A dispatch-capable execution for (grant, target) under a
  // DIFFERENT plan: invisible to the finalizer's plan-scoped
  // derivation, but closeReservation's block rule sees it — the
  // settle sweep reports it blocked and the finalizer must roll
  // EVERYTHING back (audit row included).
  w.coord.sql.exec(
    `INSERT INTO d6_execution_records (execution_id, plan_id, job_id,
       grant_id, occurrence_id, state, cache_key, detail_json, created_at,
       updated_at) VALUES ('exec-shadow-attempted', 'plan:other', ?, ?, ?,
       'attempted', NULL, '{}', ?, ?)`,
    JOB, GRANT, TARGETS[0], T0, T0);
  const p = preview(w);
  assert.equal(p.classification, "finalizable");
  const before = snapshot(w.coord);
  const r = finalize(w, p.preconditionDigest);
  assert.equal(r.outcome, "rejected");
  assert.equal(r.reason, "grant_finalization_settlement_blocked");
  assert.deepEqual(snapshot(w.coord), before);
  assert.equal(snapshot(w.coord).auditRows, 0);
  assert.equal(snapshot(w.coord).grant.state, "issued");
  assert.equal(snapshot(w.coord).claim.state, "claimed");
  assert.ok(snapshot(w.coord).reservations.every(x => x.state === "open"));
});

test("atomicity: an audit-write fault rolls back and throws (never laundered)", () => {
  const w = seedStalledWorld();
  // A pre-existing audit table whose shape makes the INSERT fail
  // (extra NOT NULL column): the lazy DDL no-ops against it, the
  // write throws inside the transaction, and the fault surfaces
  // as a throw — with every other write rolled back.
  w.coord.sql.exec(`CREATE TABLE d6_grant_finalizations (
    grant_id TEXT PRIMARY KEY, plan_id TEXT NOT NULL, job_id TEXT NOT NULL,
    book_id TEXT NOT NULL, chapter_index INTEGER, authorization_ref TEXT NOT NULL,
    precondition_digest TEXT NOT NULL, before_totals_json TEXT NOT NULL,
    outcome TEXT NOT NULL, finalized_at INTEGER NOT NULL,
    bogus TEXT NOT NULL)`);
  const p = preview(w);
  assert.equal(p.classification, "finalizable");
  assert.throws(() => finalize(w, p.preconditionDigest));
  assert.equal(w.coord._oneOrNull(
    `SELECT state FROM grants WHERE grant_id = ?`, GRANT).state, "issued");
  assert.equal(w.coord._oneOrNull(
    `SELECT state FROM claims WHERE grant_id = ?`, GRANT).state, "claimed");
  assert.equal(w.coord._all(
    `SELECT reservation_id FROM d6_grant_reservations WHERE state = 'open'`).length, 8);
});

test("empty store: preview and finalize answer sanely (§9.3)", () => {
  const h = makeHarness({ startMs: T0, extraEnv: {} });
  const store = createGenStore(h.coord);
  store.ensureSchema();
  const pv = previewGrantFinalization(h.coord, store, { grantId: "grant:missing" });
  assert.equal(pv.outcome, "rejected");
  assert.equal(pv.reason, "grant_finalization_grant_not_found");
  const r = finalizeGrant(h.coord, store, {
    grantId: "grant:missing", authorizationRef: AUTH_REF,
    expectedPreconditionDigest: "f".repeat(64),
  });
  assert.equal(r.outcome, "rejected");
  assert.equal(r.reason, "grant_finalization_grant_not_found");
  // The derivation itself classifies cleanly on an empty store.
  const d = deriveGrantFinalizationState(h.coord, store, { grantId: "grant:missing" });
  assert.equal(d.classification, "refused");
});
