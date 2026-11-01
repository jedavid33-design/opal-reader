// Ch 3 Phase A RECOVERY — Option A grant finalizer, SAME-DAY
// sizing on the exact live-shaped state (RECOVERY-PROPOSAL-DRAFT
// §3.2 + §9.1 item 9; AMENDMENT-1).
//
// The gap this suite closes: the continuation suite
// (grant-finalizer-continuation.test.mjs, Fixture E) builds its
// stall ORGANICALLY with a fake provider that succeeds on the
// first attempt for every occurrence, so its cohort 1 dispatches
// 8 attempts — not Phase A's 44 — and its post-finalization
// same-day state is 8 / 0 / 8, whose correct bounded prefix is 7.
// Proposal §9.1 item 9 requires the sizing proof on the EXACT
// live-shaped state: finalization on the original PT day with
// 44 dispatched and the reservations closed by finalization
// (44 / 0 / 44), where the first continuation prefix is exactly
// FOUR fresh occurrences (floor((100 − 44) / 12) = 4).
//
// This suite seeds Fixture S (the exact Phase A state: 44
// dispatch rows on PT 2026-10-31, eight open reservations with
// the 4/6/6/6/6/6/4/6 consumption pattern, residual 52), runs
// the real finalizer with the harness clock still on PT
// 2026-10-31, and then exercises BOTH real sizing layers:
// boundGrantTargets (the function coordinator._issueGrant
// calls) and service.driveOnce -> requestGrant -> _issueGrant
// (the production driver path). Synthetic fixture only; the
// seeded book carries structural metadata and no segment text.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeHarness } from "./helpers/do-harness.mjs";
import { createGenStore } from "../worker/generation/genstore.mjs";
import { createGenerationService } from "../worker/generation/service.mjs";
import { createCoordinatorPlaneSource } from "../worker/generation/content-plane-adapter.mjs";
import {
  derivedDayTotals, boundGrantTargets, ptDayKey, currentDayBootstrapBlocked,
} from "../worker/generation/quota-budget.mjs";
import {
  PLAN, JOB, GRANT, DAY, T0, AUTH_REF, PENDING, seedStalledState,
} from "./helpers/grant-finalizer-fixture.mjs";
import {
  previewGrantFinalization, finalizeGrant,
} from "../worker/generation/grant-finalizer.mjs";

test("same-day sizing (§9.1.9): finalize on the original PT day (44/0/44) -> first continuation prefix is exactly 4", async () => {
  const h = makeHarness({
    startMs: T0,
    extraEnv: {
      OPALREADER_V2_SCOPE: "production", GENERATION_HALT: "0",
      d6StandardOnly: true,
    },
  });
  const coord = h.coord;
  const store = createGenStore(coord);
  seedStalledState(coord, store);

  // Production fidelity for the DRIVER path: Phase A ran
  // post-bootstrap, so in production its 44 attempts carry the
  // dispatched_day_key stamp that markDispatching writes
  // atomically with each dispatch-ledger row (quota-budget.mjs
  // §3.2: "Post-bootstrap, every genuine dispatch stamps the
  // column atomically, so a NULL here is always pre-bootstrap
  // history"). Fixture S's SQL seed leaves that column NULL —
  // the finalizer never reads it — but unstamped the 44 read as
  // bootstrap exceptions and the quota guard fail-closes the
  // day as bootstrap-incomplete, a state production never had.
  // Stamp exactly the attempts that have dispatch rows (the
  // 44, whose rows already carry DAY); the prior plans' rows
  // stay untouched, and their intervals (PT 2026-10-30) do not
  // block the original day in any case.
  coord.sql.exec(
    `UPDATE d6_attempt_log SET dispatched_day_key = ?
      WHERE attempt_id IN (SELECT attempt_id FROM d6_provider_dispatches)`,
    DAY);
  assert.equal(currentDayBootstrapBlocked(coord, DAY), false,
    "the original day is not bootstrap-blocked, as in production");

  // Same-day premise: the harness clock sits on the original
  // grant's PT day — the day all 44 dispatches and all eight
  // reservations belong to. No day boundary is crossed anywhere
  // in this test.
  assert.equal(ptDayKey(T0), DAY, "fixture clock is on the original PT day");
  assert.deepEqual(derivedDayTotals(coord, DAY),
    { dayKey: DAY, dispatched: 44, reserved: 52, consumed: 96 },
    "pre-finalization: the exact §9.1 fixture totals");

  // The real finalizer, on that same day.
  const p = previewGrantFinalization(coord, store, { grantId: GRANT });
  assert.equal(p.outcome, "preview", JSON.stringify(p));
  assert.equal(p.classification, "finalizable");
  const fin = finalizeGrant(coord, store, {
    grantId: GRANT, planId: PLAN, jobId: JOB,
    authorizationRef: AUTH_REF,
    expectedPreconditionDigest: p.preconditionDigest,
  });
  assert.equal(fin.outcome, "applied", JSON.stringify(fin));
  assert.deepEqual(derivedDayTotals(coord, DAY),
    { dayKey: DAY, dispatched: 44, reserved: 0, consumed: 44 },
    "§3.2 after-state: the 44 real dispatches stay counted; the 52 leaked slots are released");

  // The pending set in the coordinator's own order — the exact
  // query coordinator._issueGrant runs (coordinator.mjs,
  // pending SELECT ... ORDER BY occurrence_id).
  const pendingRows = coord._all(
    `SELECT * FROM occurrences WHERE job_id = ? AND state = 'pending'
      ORDER BY occurrence_id`, JOB);
  assert.equal(pendingRows.length, 15);
  assert.deepEqual(
    pendingRows.map(r => r.occurrence_id).sort(), [...PENDING].sort(),
    "the pending set is exactly Fixture S's 15");
  const expectedIds = pendingRows.slice(0, 4).map(r => r.occurrence_id);

  // Sizing layer 1: boundGrantTargets itself — used = 44, each
  // fresh occurrence reserves its full 12-slot worst case:
  // 44 + 12*4 = 92 <= 100; a fifth would make 104 > 100.
  const bound = boundGrantTargets(coord, { planId: PLAN, pending: pendingRows, dayKey: DAY });
  assert.equal(bound.bounded, true);
  assert.deepEqual(bound.targets.map(o => o.occurrence_id), expectedIds,
    "the bounded cohort is exactly the first 4 pending occurrences");

  // Sizing layer 2: the production driver path. driveOnce ->
  // grant step -> coord.requestGrant -> _issueGrant must issue
  // a grant for exactly those 4, on the same plan/job, and for
  // nothing else.
  const service = createGenerationService({
    coord, env: h.env, store, sources: createCoordinatorPlaneSource(coord),
  });
  const outcomes = await service.driveOnce();
  assert.equal(h.sentGrants.length, 1,
    `exactly one grant dispatched: ${JSON.stringify(outcomes)}`);
  const msg = h.sentGrants[0];
  assert.equal(msg.grantId, `grant:${JOB}:2:full`);
  const msgIds = msg.occurrences.map(
    o => (typeof o === "string" ? o : (o.occurrenceId ?? o.occurrence_id)));
  assert.deepEqual(msgIds, expectedIds,
    "the issued continuation grant covers exactly the 4-occurrence prefix");

  // The new grant reserved exactly its cohort's worst case on
  // the same day, and the day total reflects it truthfully.
  const newRes = coord._all(
    `SELECT * FROM d6_grant_reservations WHERE grant_id = ? ORDER BY occurrence_id`,
    msg.grantId);
  assert.equal(newRes.length, 4);
  assert.ok(newRes.every(r => r.state === "open" && r.day_key === DAY
    && r.slots_total === 12 && r.slots_consumed === 0));
  assert.deepEqual(derivedDayTotals(coord, DAY),
    { dayKey: DAY, dispatched: 44, reserved: 48, consumed: 92 },
    "after issuance: 44 counted dispatches + 48 newly reserved slots");

  // The other 11 stay pending under the same job, ungranted.
  const view = coord.jobView(JOB);
  assert.equal(view.occurrences.filter(o => o.state === "granted").length, 4);
  assert.equal(view.occurrences.filter(o => o.state === "pending").length, 11);
  assert.equal(view.occurrences.filter(o => o.state === "ready").length, 8);
});
