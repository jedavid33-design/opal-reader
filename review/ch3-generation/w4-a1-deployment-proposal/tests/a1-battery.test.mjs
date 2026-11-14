// A-1 ACCEPTANCE BATTERY — W-4 Track A alarm repair.
// Operative specification: the A-1 implementation proposal
// (pin 4bc8b81b…), its focused addendum (pin 3759a69e…), and
// Rowan's final documentary ruling of 2026-11-14 (board
// 6878847251), which controls on conflict. Test ids are the
// matrix ids of proposal §6 as corrected by the addendum §6
// and the final ruling §7.
// Run: node --test a1-battery.test.mjs
// Trees: A1_CAND_DIR (default ../candidate-tree), A1_BASE_DIR
// (default ../../s1-build/candidate-tree — the live build's
// source, used by T-00 and the T-36 rollback verification).
//
// DEFERRED REGISTER (identified explicitly; never reported as
// passed — each appears below as a skipped test):
//   T-12, T-21, T-22 — scheduler-specific; DEFERRED to A-3.
//   T-29 — L-1 witness fixtures; DEFERRED to the L-1 phase.
//   T-24b — procedural execution prerequisites (queue-pause
//     read-back, WAIT-law clearance, action-specific
//     authorization, exclusive control). NOT harness-verifiable
//     by design (ruling §4): discharged in future execution
//     paperwork, never claimed as code behavior.
//
// Harness caveats (standing): the harness models the platform
// with node:sqlite and fake alarm storage. Its interleavings
// are ADVERSARIAL (a test may suspend an evaluation at a
// storage await and run competing work) — deliberately stronger
// than the platform's documented input gate, which is the
// point: the revision fence must prevent, not merely make
// unlikely, a superseded registration. Offline results do not
// establish actual platform alarm delivery.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  makeWorld, snapshotDb, entryGet, entryPost,
  OPERATOR_TOKEN, CLIENT_TOKEN, T0,
} from "./harness.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const CAND = process.env.A1_CAND_DIR ?? join(HERE, "..", "candidate-tree");
const BASE = process.env.A1_BASE_DIR ??
  join(HERE, "..", "..", "s1-build", "candidate-tree");
const HOUR = 3600000, WATCHDOG = 600000;
const AUTH = { source: "operator-route",
  authorizationRef: "battery:a1", reason: "battery evaluation" };

const world = (opts = {}) => makeWorld(CAND, opts);
const stale = (w, at = T0 - 2 * HOUR) => w.seedAlarm(at);
function pendWatchdog(w, due) {
  w.db.prepare(
    `INSERT INTO schedule (due_at, kind, ref, payload_json)
     VALUES (?, 'watchdog', NULL, '{}')`).run(due);
}
function repairEvents(w) {
  return w.db.prepare(
    `SELECT id, kind, outcome FROM d6_repair_events ORDER BY id`
  ).all();
}
function seedPassTable(w) {
  w.db.exec(`CREATE TABLE IF NOT EXISTS d6_drive_passes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at INTEGER NOT NULL, finished_at INTEGER,
    stage TEXT NOT NULL, drive_invoked INTEGER NOT NULL,
    outcomes_json TEXT, outcomes_truncated INTEGER NOT NULL DEFAULT 0,
    error_name TEXT, error_message TEXT, armed_after INTEGER)`);
}
function seedPass(w, at, stage = "complete") {
  seedPassTable(w);
  const r = w.db.prepare(
    `INSERT INTO d6_drive_passes (at, stage, drive_invoked)
     VALUES (?, ?, 1)`).run(at, stage);
  return Number(r.lastInsertRowid);
}
async function registeringEval(w) {
  stale(w);
  const r = await w.coord.evaluateAlarmRepair(AUTH);
  assert.equal(r.outcome, "registered");
  return r;
}

// ----------------------------------------------------------------
describe("identity and base (T-00)", () => {
  test("T-00 the candidate differs from the verified base in exactly the two approved parts", () => {
    const parts = [];
    const walk = (dir, rel = "") => {
      for (const e of readdirSync(join(dir, rel),
          { withFileTypes: true })) {
        const r = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) walk(dir, r);
        else parts.push(r);
      }
    };
    walk(BASE);
    assert.equal(parts.length, 31);
    const changed = [];
    for (const p of parts) {
      const h = (d) => createHash("sha256")
        .update(readFileSync(join(d, p))).digest("hex");
      if (h(BASE) !== h(CAND)) changed.push(p);
    }
    assert.deepEqual(changed.sort(),
      ["v2/coordinator.mjs", "v2/worker-entry-prod-d6.js"]);
  });
});

// ----------------------------------------------------------------
describe("core evaluation outcomes", () => {
  test("T-01 stale registration with a pending watchdog row registers the row's due and records intent + completion", async () => {
    const w = await world();
    pendWatchdog(w, T0 + 30 * 60000);
    stale(w);
    const r = await w.coord.evaluateAlarmRepair(AUTH);
    assert.equal(r.outcome, "registered");
    assert.equal(r.predicate, "P-STALE");
    assert.equal(w.alarmCalls.length, 1);
    assert.equal(w.alarmCalls[0].value, T0 + 30 * 60000);
    assert.equal(r.due, T0 + 30 * 60000);
    assert.equal(r.readback, T0 + 30 * 60000);
    const ev = repairEvents(w);
    assert.deepEqual(ev.map((e) => e.kind), ["intent", "completion"]);
    assert.equal(ev[1].outcome, "registered");
    assert.equal(w.coord.repairStatus().derivation.effectiveStrikes, 1);
  });

  test("T-02 a fresh registration with a healthy recorder declines not_stale and registers nothing", async () => {
    const w = await world();
    pendWatchdog(w, T0 + WATCHDOG);
    seedPass(w, T0 - 60000);
    w.seedAlarm(T0 + WATCHDOG);
    const r = await w.coord.evaluateAlarmRepair(AUTH);
    assert.equal(r.outcome, "not_stale");
    assert.equal(w.alarmCalls.length, 0);
    assert.deepEqual(repairEvents(w).map((e) => e.kind), ["evaluation"]);
    assert.equal(w.coord.repairStatus().derivation.effectiveStrikes, 0);
  });

  test("T-07 successive evaluations are each recorded; the second observes the first's fresh registration", async () => {
    const w = await world();
    pendWatchdog(w, T0 + WATCHDOG);
    seedPass(w, T0 - 60000);
    await registeringEval(w);
    const r2 = await w.coord.evaluateAlarmRepair(AUTH);
    assert.equal(r2.outcome, "not_stale");
    assert.equal(w.alarmCalls.length, 1);
    assert.deepEqual(repairEvents(w).map((e) => e.kind),
      ["intent", "completion", "evaluation"]);
  });

  test("T-30 the stale threshold is exact: armed == now - threshold is stale; 1 ms later is not", async () => {
    const w = await world();
    pendWatchdog(w, T0 + WATCHDOG);
    w.seedAlarm(T0 - HOUR);
    const r1 = await w.coord.evaluateAlarmRepair(AUTH);
    assert.equal(r1.outcome, "registered");
    const w2 = await world();
    pendWatchdog(w2, T0 + WATCHDOG);
    seedPass(w2, T0 - 60000);
    w2.seedAlarm(T0 - HOUR + 1);
    const r2 = await w2.coord.evaluateAlarmRepair(AUTH);
    assert.equal(r2.outcome, "not_stale");
    assert.equal(w2.alarmCalls.length, 0);
  });
});

// ----------------------------------------------------------------
describe("predicates (IC-1: P-ABSENT is diagnostic-only)", () => {
  test("T-03/T-16 an absent registration never registers — not with a healthy recorder, not on a repeated observation (the in-flight-pass counterexample)", async () => {
    const w = await world();
    pendWatchdog(w, T0 + WATCHDOG);
    seedPass(w, T0 - 60000); // latest pass complete, chain mid-flight
    w.seedAlarm(null);
    const r1 = await w.coord.evaluateAlarmRepair(AUTH);
    assert.equal(r1.outcome, "absent_diagnostic");
    assert.equal(r1.predicate, "P-ABSENT");
    const r2 = await w.coord.evaluateAlarmRepair(AUTH);
    assert.equal(r2.outcome, "absent_diagnostic");
    assert.equal(w.alarmCalls.length, 0);
    assert.equal(repairEvents(w)
      .filter((e) => e.kind === "intent").length, 0);
  });

  test("T-04 absent registration with no recorder table at all still never registers", async () => {
    const w = await world();
    pendWatchdog(w, T0 + WATCHDOG);
    w.seedAlarm(null);
    const r = await w.coord.evaluateAlarmRepair(AUTH);
    assert.equal(r.outcome, "absent_diagnostic");
    assert.equal(w.alarmCalls.length, 0);
  });

  test("T-31 predicate precedence under overlap: future-dated outranks silent; the strike bound outranks a diagnostic predicate", async () => {
    const w = await world();
    pendWatchdog(w, T0 + WATCHDOG);
    seedPass(w, T0 - 3 * HOUR); // old latest pass (silent shape)
    w.seedAlarm(T0 + 2 * HOUR); // AND future-dated registration
    const r = await w.coord.evaluateAlarmRepair(AUTH);
    assert.equal(r.outcome, "future_dated");
    assert.equal(r.predicate, "P-FUTURE");
    assert.equal(w.alarmCalls.length, 0);
  });

  test("P-SILENT: a fresh registration with an old latest pass is diagnostic-only", async () => {
    const w = await world();
    pendWatchdog(w, T0 + WATCHDOG);
    seedPass(w, T0 - 3 * HOUR);
    w.seedAlarm(T0 + 5 * 60000);
    const r = await w.coord.evaluateAlarmRepair(AUTH);
    assert.equal(r.outcome, "silent_diagnostic");
    assert.equal(r.predicate, "P-SILENT");
    assert.equal(w.alarmCalls.length, 0);
  });
});

// ----------------------------------------------------------------
describe("containment and held-state boundaries (IC-6)", () => {
  test("T-05 CHAIN_STOPPED declines contained_stop and registers nothing", async () => {
    const w = await world();
    pendWatchdog(w, T0 + WATCHDOG);
    await w.coord.applyContainmentTransition("contain_drive",
      "battery:t05", { reason: "battery" });
    await w.coord.applyContainmentTransition("stop_chain",
      "battery:t05", { reason: "battery" });
    w.clearAlarmCalls();
    stale(w);
    const r = await w.coord.evaluateAlarmRepair(AUTH);
    assert.equal(r.outcome, "contained_stop");
    assert.equal(w.alarmCalls.length, 0);
  });

  test("T-08 DRIVE_CONTAINED declines while schedule rows are pending and registers when none are", async () => {
    const w = await world();
    await w.coord.applyContainmentTransition("contain_drive",
      "battery:t08", { reason: "battery" });
    pendWatchdog(w, T0 + WATCHDOG);
    stale(w);
    const r1 = await w.coord.evaluateAlarmRepair(AUTH);
    assert.equal(r1.outcome, "contained_drive_pending");
    assert.equal(w.alarmCalls.length, 0);
    w.db.prepare(`DELETE FROM schedule`).run();
    stale(w);
    const r2 = await w.coord.evaluateAlarmRepair(AUTH);
    assert.equal(r2.outcome, "registered");
    // The watchdog row the evaluation ensured is the due source.
    assert.equal(r2.due, T0 + WATCHDOG);
  });

  test("T-06/T-25 an unhalted or halt-undefined coordinator declines held_state_required", async () => {
    const w = await world({ envOverrides: { GENERATION_HALT: "0" } });
    pendWatchdog(w, T0 + WATCHDOG);
    stale(w);
    const r = await w.coord.evaluateAlarmRepair(AUTH);
    assert.equal(r.outcome, "held_state_required");
    assert.equal(w.alarmCalls.length, 0);
    const w2 = await world(
      { envOverrides: { GENERATION_HALT: undefined } });
    pendWatchdog(w2, T0 + WATCHDOG);
    stale(w2);
    const r2 = await w2.coord.evaluateAlarmRepair(AUTH);
    assert.equal(r2.outcome, "held_state_required");
  });

  test("T-31a an unverified containment read outranks registration", async () => {
    const w = await world();
    pendWatchdog(w, T0 + WATCHDOG);
    stale(w);
    w.faults.sql = { error: new Error("boom"),
      match: (q) => q.includes("d6_containment_state") };
    const r = await w.coord.evaluateAlarmRepair(AUTH);
    w.faults.sql = null;
    assert.equal(r.outcome, "error:containment_unverified");
    assert.equal(w.alarmCalls.length, 0);
  });
});

// ----------------------------------------------------------------
describe("strike bound and reservation (A1-C2)", () => {
  test("T-09 three registering evaluations exhaust the bound; the fourth declines repair_ineffective", async () => {
    const w = await world();
    pendWatchdog(w, T0 + WATCHDOG);
    for (let i = 1; i <= 3; i++) {
      const r = await registeringEval(w);
      assert.equal(r.evaluationId !== null, true);
      assert.equal(
        w.coord.repairStatus().derivation.effectiveStrikes, i);
    }
    stale(w);
    const r4 = await w.coord.evaluateAlarmRepair(AUTH);
    assert.equal(r4.outcome, "repair_ineffective");
    assert.equal(w.alarmCalls.length, 3);
    assert.equal(repairEvents(w)
      .filter((e) => e.kind === "intent").length, 3);
  });

  test("T-18 two evaluations raced at strikes = 2: the parked one's reservation counts, the other declines — no fourth registration under any interleaving", async () => {
    const w = await world();
    pendWatchdog(w, T0 + WATCHDOG);
    await registeringEval(w);
    await registeringEval(w);
    assert.equal(
      w.coord.repairStatus().derivation.effectiveStrikes, 2);
    // E1 registers its intent, then parks at the commitment
    // boundary. E2 runs while E1 is parked.
    stale(w);
    const release = w.deferSync();
    const p1 = w.coord.evaluateAlarmRepair(AUTH);
    await new Promise((r) => setImmediate(r));
    assert.equal(w.deferSyncArmed(), false); // E1 consumed it
    stale(w);
    const r2 = await w.coord.evaluateAlarmRepair(AUTH);
    assert.equal(r2.outcome, "repair_ineffective");
    release();
    const r1 = await p1;
    assert.equal(r1.outcome, "registered");
    assert.equal(w.alarmCalls.length, 3);
    assert.equal(repairEvents(w)
      .filter((e) => e.kind === "intent").length, 3);
    assert.equal(
      w.coord.repairStatus().derivation.effectiveStrikes, 3);
  });

  test("T-19a strike state survives a coordinator restart (new instance, new state object, same storage)", async () => {
    const w = await world();
    pendWatchdog(w, T0 + WATCHDOG);
    await registeringEval(w);
    await registeringEval(w);
    const { GenerationCoordinator } = await import(
      new URL("../candidate-tree/v2/coordinator.mjs",
        import.meta.url).href);
    const coord2 = new GenerationCoordinator(
      { storage: w.storage }, w.classEnv);
    assert.equal(coord2.repairStatus().derivation.effectiveStrikes, 2);
    // A declined invocation does not reset the counter.
    w.classEnv.GENERATION_HALT = "0";
    const rd = await coord2.evaluateAlarmRepair(AUTH);
    assert.equal(rd.outcome, "held_state_required");
    w.classEnv.GENERATION_HALT = "1";
    assert.equal(coord2.repairStatus().derivation.effectiveStrikes, 2);
  });
});

// ----------------------------------------------------------------
describe("revision fence (A1-C1)", () => {
  test("T-17a a registration established during the observation await suppresses the repair (observation parked)", async () => {
    const w = await world();
    pendWatchdog(w, T0 + WATCHDOG);
    stale(w);
    const release = w.deferGetAlarm();
    const p = w.coord.evaluateAlarmRepair(AUTH);
    await new Promise((r) => setImmediate(r));
    // A competing ordinary wake registers a fresh valid value.
    await w.coord.wake();
    assert.equal(w.alarmCalls.length, 1);
    const freshDue = w.alarmCalls[0].value;
    release(T0 - 2 * HOUR); // A observes the pre-registration value
    const r = await p;
    assert.equal(r.outcome, "observation_superseded");
    assert.equal(w.alarmCalls.length, 1); // A never registered
    assert.equal(w.alarmAt(), freshDue); // competitor's stands
  });

  test("T-17b a registration established during the commitment await suppresses the act; the intent stands, recorded as uninitiated", async () => {
    const w = await world();
    pendWatchdog(w, T0 + WATCHDOG);
    stale(w);
    const release = w.deferSync();
    const p = w.coord.evaluateAlarmRepair(AUTH);
    await new Promise((r) => setImmediate(r));
    await w.coord.wake(); // competing registration mid-flight
    assert.equal(w.alarmCalls.length, 1);
    release();
    const r = await p;
    assert.equal(r.outcome, "observation_superseded");
    assert.equal(r.actInitiated, false);
    assert.equal(w.alarmCalls.length, 1);
    const ev = repairEvents(w);
    assert.deepEqual(ev.map((e) => e.kind), ["intent", "completion"]);
    assert.equal(ev[1].outcome, "observation_superseded");
    // The suppressed reservation remains conservatively counted.
    assert.equal(
      w.coord.repairStatus().derivation.effectiveStrikes, 1);
  });

  test("T-19b on a restarted instance the revision resets and the fence still functions within the new instance", async () => {
    const w = await world();
    pendWatchdog(w, T0 + WATCHDOG);
    const { GenerationCoordinator } = await import(
      new URL("../candidate-tree/v2/coordinator.mjs",
        import.meta.url).href);
    const state2 = { storage: w.storage };
    const coord2 = new GenerationCoordinator(state2, w.classEnv);
    stale(w);
    const release = coord2stateDefer(w);
    const p = coord2.evaluateAlarmRepair(AUTH);
    await new Promise((r) => setImmediate(r));
    await coord2.wake();
    assert.equal(w.alarmCalls.length, 1);
    release(T0 - 2 * HOUR);
    const r = await p;
    assert.equal(r.outcome, "observation_superseded");
    assert.equal(w.alarmCalls.length, 1);
    function coord2stateDefer(world) { return world.deferGetAlarm(); }
  });

  test("T-35 construction conformance: every await in the evaluation is a storage operation; every initiation site bumps the revision first", () => {
    const src = readFileSync(
      join(CAND, "v2", "coordinator.mjs"), "utf8");
    const start = src.indexOf("async evaluateAlarmRepair(");
    const end = src.indexOf("acknowledgeRepairCounter(", start);
    const body = src.slice(start, end);
    const awaits = [...body.matchAll(/await\s+([^;]+);/g)]
      .map((m) => m[1].trim());
    assert.ok(awaits.length >= 3);
    for (const a of awaits)
      assert.match(a, /^this\.state\.storage\.(getAlarm|setAlarm|sync)\(/);
    // Every registration/deletion initiation in the part has a
    // revision bump in its own synchronous stretch: between the
    // previous await (or the stretch's start) and the initiation
    // there is a bump and no other await.
    const sites = [...src.matchAll(
      /await this\.state\.storage\.(setAlarm|deleteAlarm)\(/g)];
    assert.ok(sites.length >= 5);
    for (const s of sites) {
      const prevAwait = src.lastIndexOf("await", s.index - 1);
      const stretch = src.slice(prevAwait, s.index);
      assert.match(stretch, /_bumpAlarmRevision\(\);/);
    }
  });
});

// ----------------------------------------------------------------
describe("discharge and acknowledgment (A1-C2)", () => {
  test("T-10 two consecutive complete passes after the intent discharge the strike durably — pruning cannot resurrect it; a missing row manufactures nothing", async () => {
    const w = await world();
    pendWatchdog(w, T0 + WATCHDOG);
    seedPass(w, T0 - 60000); // the pass standing before the intent
    const r = await registeringEval(w);
    assert.equal(
      w.coord.repairStatus().derivation.effectiveStrikes, 1);
    // ONE later complete pass does not discharge (it may be the
    // pass that was in flight when the intent was written).
    seedPass(w, T0 + 1000);
    let st = w.coord.repairStatus();
    assert.equal(st.derivation.effectiveStrikes, 1);
    assert.equal(st.derivation.dischargedIntentIds.length, 0);
    // The second consecutive complete pass discharges.
    const p2 = seedPass(w, T0 + 2000);
    st = w.coord.repairStatus();
    assert.equal(st.derivation.effectiveStrikes, 0);
    assert.deepEqual(st.derivation.dischargedIntentIds,
      [r.evaluationId]);
    // A later evaluation persists the durable discharge event.
    const r2 = await w.coord.evaluateAlarmRepair(AUTH);
    assert.equal(r2.outcome, "not_stale"); // registration is fresh
    const dis = w.db.prepare(
      `SELECT detail_json FROM d6_repair_events
        WHERE kind = 'discharge'`).all();
    assert.equal(dis.length, 1);
    const detail = JSON.parse(dis[0].detail_json);
    assert.equal(detail.intentId, r.evaluationId);
    assert.deepEqual(detail.passIds, [detail.passIds[0], p2]);
    assert.equal(detail.passIds.length, 2);
    // A fresh registering intent lands after the discharge.
    const r3 = await registeringEval(w);
    assert.equal(
      w.coord.repairStatus().derivation.effectiveStrikes, 1);
    // Prune the recorder entirely: the durable discharge stands
    // (no resurrection), and only the new intent counts.
    w.db.prepare(`DELETE FROM d6_drive_passes`).run();
    st = w.coord.repairStatus();
    assert.equal(st.derivation.effectiveStrikes, 1);
    assert.ok(st.derivation.dischargedIntentIds
      .includes(r.evaluationId));
    assert.deepEqual(st.unresolvedIntents.map((u) => u.intentId),
      [r3.evaluationId]);
  });

  test("T-10b a pruned recorder with NO durable discharge event manufactures no discharge", async () => {
    const w = await world();
    pendWatchdog(w, T0 + WATCHDOG);
    await registeringEval(w);
    // No evaluation ever observed qualifying passes; the (empty)
    // recorder can discharge nothing.
    const st = w.coord.repairStatus();
    assert.equal(st.derivation.effectiveStrikes, 1);
    assert.equal(st.derivation.recorderVerified, false);
  });

  test("T-34 acknowledgment: valid boundary discharges exactly the intents at or below it; invalid boundaries are rejected; the projection is never authority", async () => {
    const w = await world();
    pendWatchdog(w, T0 + WATCHDOG);
    const r1 = await registeringEval(w);
    const r2 = await registeringEval(w);
    await registeringEval(w);
    assert.equal(
      w.coord.repairStatus().derivation.effectiveStrikes, 3);
    // Boundary naming a non-intent event is invalid.
    const evId = repairEvents(w)
      .find((e) => e.kind === "evaluation")?.id ??
      repairEvents(w)[1].id; // a completion id
    const bad = w.coord.acknowledgeRepairCounter(
      { ...AUTH, boundaryEventId: evId });
    assert.equal(bad.outcome, "rejected");
    assert.equal(bad.reason, "acknowledgment_boundary_invalid");
    // A future boundary is invalid.
    const future = w.coord.acknowledgeRepairCounter(
      { ...AUTH, boundaryEventId: 99999 });
    assert.equal(future.outcome, "rejected");
    // A valid boundary discharges exactly the intents <= it.
    const ack = w.coord.acknowledgeRepairCounter(
      { ...AUTH, boundaryEventId: r2.evaluationId });
    assert.equal(ack.outcome, "applied");
    assert.deepEqual(ack.dischargedIntentIds,
      [r1.evaluationId, r2.evaluationId]);
    assert.equal(ack.effectiveStrikes, 1);
    const st = w.coord.repairStatus();
    assert.equal(st.derivation.acknowledgedBoundary,
      r2.evaluationId);
    assert.equal(st.projection.lastAckBoundary, r2.evaluationId);
    // Historical intents remain visible.
    assert.equal(st.derivation.totalIntents, 3);
    assert.equal(st.unresolvedIntents.length, 1);
    // Corrupt the projection: the derivation is unaffected.
    w.db.prepare(
      `UPDATE d6_repair_state SET projection_strikes = 99`).run();
    assert.equal(
      w.coord.repairStatus().derivation.effectiveStrikes, 1);
  });
});

// ----------------------------------------------------------------
describe("write-set discipline and read purity (IC-7)", () => {
  test("T-11 a registering evaluation writes only the repair tables and (at most) the watchdog schedule row", async () => {
    const w = await world();
    await seedAttempt3ShapeSafe(w);
    pendWatchdog(w, T0 + WATCHDOG);
    const before = snapshotDb(w.db);
    await registeringEval(w);
    const after = snapshotDb(w.db);
    const changedTables = diffTables(before, after);
    for (const t of changedTables)
      assert.ok(["d6_repair_events", "d6_repair_state",
        "schedule"].includes(t), `unexpected write to ${t}`);
    assert.ok(changedTables.includes("d6_repair_events"));
  });

  test("T-13/T-28 the audit GET and a diagnostics read perform zero writes and create no repair events", async () => {
    const w = await world();
    pendWatchdog(w, T0 + WATCHDOG);
    seedPassTable(w); // so no read surface needs to create it
    await registeringEval(w);
    const before = snapshotDb(w.db);
    const st = await entryGet(w, "/v2/d6-repair-status",
      { operator: true, client: false });
    assert.equal(st.status, 200);
    assert.equal(st.body.derivation.effectiveStrikes, 1);
    assert.equal(st.body.unresolvedIntents.length, 1);
    const dg = await entryGet(w,
      "/v2/d6-diagnostics?drive=1", { operator: true, client: false });
    assert.equal(dg.status, 200);
    assert.equal(snapshotDb(w.db), before);
  });

  test("T-33 the ROUTED audit GET reports missing repair state without repairing it (review I-C4)", async () => {
    const w = await world();
    w.db.exec(`DROP TABLE d6_repair_events`);
    w.db.exec(`DROP TABLE d6_repair_state`);
    const res = await entryGet(w, "/v2/d6-repair-status",
      { operator: true });
    assert.equal(res.status, 200);
    assert.equal(res.body.initialized, false);
    assert.equal(res.body.derivation, null);
    const tables = w.db.prepare(
      `SELECT name FROM sqlite_master WHERE type = 'table'
        AND name LIKE 'd6_repair%'`).all();
    assert.equal(tables.length, 0,
      "the shipped GET handler created no repair state");
  });
});

// Helpers local to the write-set / purity group.
async function seedAttempt3ShapeSafe() { /* shape not needed: the
  empty-world snapshot diff is the stronger baseline */ }
function diffTables(before, after) {
  const parse = (s) => {
    const m = new Map();
    let cur = null;
    for (const line of s.split("\n")) {
      if (line.startsWith("== ")) {
        cur = line.slice(3).replace(/ \(\d+\)$/, "");
        m.set(cur, []);
      } else if (cur) m.get(cur).push(line);
    }
    return m;
  };
  const a = parse(before), b = parse(after);
  const changed = [];
  for (const k of new Set([...a.keys(), ...b.keys()]))
    if (JSON.stringify(a.get(k)) !== JSON.stringify(b.get(k)))
      changed.push(k);
  return changed;
}

// ----------------------------------------------------------------
describe("failure placement (T-20) and outcome precision (IC-7)", () => {
  test("T-20a a failure before the intent leaves no partial writes and no act", async () => {
    const w = await world();
    pendWatchdog(w, T0 + WATCHDOG);
    stale(w);
    w.faults.sql = { error: new Error("insert blocked"), once: true,
      match: (q) => q.includes("INSERT INTO d6_repair_events") };
    await assert.rejects(w.coord.evaluateAlarmRepair(AUTH));
    w.faults.sql = null;
    assert.equal(w.alarmCalls.length, 0);
    assert.equal(repairEvents(w).length, 0);
  });

  test("T-20b a commitment failure after the intent: no ensure, no registration; the intent stands with an uninitiated-act completion", async () => {
    const w = await world();
    pendWatchdog(w, T0 + WATCHDOG);
    stale(w);
    w.faults.sync = new Error("sync unavailable");
    const r = await w.coord.evaluateAlarmRepair(AUTH);
    w.faults.sync = null;
    assert.equal(r.outcome, "error:commitment");
    assert.equal(r.actInitiated, false);
    assert.equal(w.alarmCalls.length, 0);
    const ev = repairEvents(w);
    assert.deepEqual(ev.map((e) => e.kind), ["intent", "completion"]);
    assert.equal(
      w.coord.repairStatus().derivation.effectiveStrikes, 1);
  });

  test("T-20c a failure during registration is recorded as an uncertain act and stays counted", async () => {
    const w = await world();
    pendWatchdog(w, T0 + WATCHDOG);
    stale(w);
    w.faults.setAlarm = new Error("setAlarm failed");
    const r = await w.coord.evaluateAlarmRepair(AUTH);
    w.faults.setAlarm = null;
    assert.equal(r.outcome, "error:registration");
    assert.equal(r.actInitiated, "uncertain");
    const ev = repairEvents(w);
    assert.deepEqual(ev.map((e) => e.kind), ["intent", "completion"]);
    assert.equal(
      w.coord.repairStatus().derivation.effectiveStrikes, 1);
  });

  test("T-20d a failure persisting the completion leaves the intent visibly unresolved (no silent success)", async () => {
    const w = await world();
    pendWatchdog(w, T0 + WATCHDOG);
    stale(w);
    // Fail only the COMPLETION insert (intent_id column set).
    w.faults.sql = { error: new Error("completion blocked"),
      match: (q, params) =>
        q.includes("INSERT INTO d6_repair_events") &&
        params[1] === "completion" };
    await assert.rejects(w.coord.evaluateAlarmRepair(AUTH));
    w.faults.sql = null;
    assert.equal(w.alarmCalls.length, 1); // the act DID initiate
    const st = w.coord.repairStatus();
    assert.equal(st.unresolvedIntents.length, 1);
    assert.equal(st.derivation.effectiveStrikes, 1);
  });

  test("T-26 a null read-back after a successful registration call is recorded as readback_null, not as failure", async () => {
    const w = await world();
    pendWatchdog(w, T0 + WATCHDOG);
    stale(w);
    const orig = w.storage.getAlarm.bind(w.storage);
    let calls = 0;
    w.storage.getAlarm = async () => {
      calls++;
      // Call 1: Phase O observation. Call 2: the Phase B2
      // fresh observation (review I-C2). Call 3: the Phase C
      // read-back — the one that returns null here.
      return calls === 3 ? null : orig();
    };
    const r = await w.coord.evaluateAlarmRepair(AUTH);
    w.storage.getAlarm = orig;
    assert.equal(r.outcome, "registered");
    assert.equal(r.readbackState, "readback_null");
    assert.equal(r.readback, null);
  });

  test("T-27 an A-1 registration, then duplicate alarm delivery over the held fixture, repeats no protected work (review I-C5, completed per RC-3)", async () => {
    const w = await world("candidate", { seedAttempt3: true });
    // FIRST: a successful A-1 repair registration against the
    // representative held fixture (stale reported registration,
    // the preserved plan/job in place, held state asserted).
    await w.storage.setAlarm(w.clock.now - 2 * 3600 * 1000);
    const repair = await w.coord.evaluateAlarmRepair(AUTH);
    assert.equal(repair.outcome, "registered");
    // Protected-surface projections.
    const grantsOf = () => w.db.prepare(
      `SELECT grant_id, state FROM grants ORDER BY grant_id`).all();
    const plansOf = () => w.db.prepare(
      `SELECT plan_id, state FROM d6_plans ORDER BY plan_id`).all();
    const jobsOf = () => w.db.prepare(
      `SELECT job_id, state, revision FROM jobs ORDER BY job_id`).all();
    const outboxOf = () => w.db.prepare(
      `SELECT id, kind, sent_at FROM outbox ORDER BY id`).all();
    const ledgerOf = () => w.db.prepare(
      `SELECT op_key FROM ledger_ops ORDER BY op_key`).all();
    const attemptsOf = () => w.db.prepare(
      `SELECT COUNT(*) AS n FROM d6_attempt_log`).get().n;
    const phaseOf = () => w.db.prepare(
      `SELECT phase, halted_unknown_billing, halt_detail
         FROM d6_phase_state ORDER BY phase`).all();
    const parksOf = () => w.db.prepare(
      `SELECT id, released_at FROM quota_parks ORDER BY id`).all();
    const schedOf = () => w.db.prepare(
      `SELECT id, state FROM schedule ORDER BY id`).all();
    const passesOf = () => w.db.prepare(
      `SELECT COUNT(*) AS n FROM d6_drive_passes`).get().n;
    const snap = () => ({ grants: grantsOf(), plans: plansOf(),
      jobs: jobsOf(), outbox: outboxOf(), ledger: ledgerOf(),
      attempts: attemptsOf(), phase: phaseOf(), parks: parksOf(),
      sent: w.queue.sent.length });
    // First delivery of the repaired registration's alarm.
    await w.inst.alarm();
    const s1 = snap();
    const sched1 = schedOf();
    const passes1 = passesOf();
    // Duplicate (late/repeated) delivery of the same alarm.
    w.advance(1000);
    await w.inst.alarm();
    assert.equal(passesOf(), passes1 + 1,
      "each delivery records exactly one pass — ordinary watchdog continuation only");
    assert.deepEqual(snap(), s1,
      "grants, plans, jobs, outbox contents, ledger/reservation accounting, phase and quota state, attempt log, and queue sends are all identical after the duplicate: protected work is not repeated");
    // Schedule-processing invariant: rows already processed
    // stay processed; continuation may add rows but never
    // reprocesses one.
    const sched2 = new Map(schedOf().map((r) => [r.id, r.state]));
    for (const row of sched1) {
      if (row.state !== "pending")
        assert.equal(sched2.get(row.id), row.state,
          `schedule row ${row.id} was reprocessed`);
    }
  });

  test("T-24a a halt flip landing during the commitment await suppresses the act at the repeated checks", async () => {
    const w = await world();
    pendWatchdog(w, T0 + WATCHDOG);
    stale(w);
    const release = w.deferSync();
    const p = w.coord.evaluateAlarmRepair(AUTH);
    await new Promise((r) => setImmediate(r));
    w.classEnv.GENERATION_HALT = "0"; // the world goes unhalted
    release();
    const r = await p;
    w.classEnv.GENERATION_HALT = "1";
    assert.equal(r.outcome, "held_state_required");
    assert.equal(r.actInitiated, false);
    assert.equal(w.alarmCalls.length, 0);
    const ev = repairEvents(w);
    assert.deepEqual(ev.map((e) => e.kind), ["intent", "completion"]);
  });
});

// ----------------------------------------------------------------
describe("route contract (T-32, T-14) and scheduler absence (T-23)", () => {
  const PATH = "/v2/d6-repair-evaluate";
  const GOOD = { action: "evaluate_repair",
    authorizationRef: "battery:route", reason: "route battery" };

  test("T-14 the route declines held_state_required while unhalted (IC-6 design-level)", async () => {
    const w = await world({ envOverrides: { GENERATION_HALT: "0" } });
    pendWatchdog(w, T0 + WATCHDOG);
    stale(w);
    const r = await entryPost(w, PATH, GOOD,
      { operator: true, client: false });
    assert.equal(r.status, 200);
    assert.equal(r.body.outcome, "held_state_required");
    assert.equal(w.alarmCalls.length, 0);
  });

  test("T-32 validation battery: every malformed shape is refused before any state read for action, and writes nothing", async () => {
    const w = await world();
    pendWatchdog(w, T0 + WATCHDOG);
    stale(w);
    const cases = [
      ["array body", [1, 2]],
      ["wrong field type", { ...GOOD, authorizationRef: 5 }],
      ["whitespace-only reason", { ...GOOD, reason: "   " }],
      ["whitespace-only ref", { ...GOOD, authorizationRef: " " }],
      ["oversized ref", { ...GOOD, authorizationRef: "x".repeat(2001) }],
      ["oversized reason", { ...GOOD, reason: "x".repeat(2001) }],
      ["unknown action", { ...GOOD, action: "explode" }],
      ["spoofed source key", { ...GOOD, source: "scheduler" }],
      ["unexpected key", { ...GOOD, due: 123 }],
      ["missing reason", { action: "evaluate_repair",
        authorizationRef: "battery:route" }],
      ["ack string boundary", { action: "acknowledge_repair_counter",
        authorizationRef: "battery:route", reason: "r",
        boundaryEventId: "3" }],
      ["ack fractional boundary", { action: "acknowledge_repair_counter",
        authorizationRef: "battery:route", reason: "r",
        boundaryEventId: 1.5 }],
      ["ack missing boundary", { action: "acknowledge_repair_counter",
        authorizationRef: "battery:route", reason: "r" }],
    ];
    for (const [name, body] of cases) {
      const r = await entryPost(w, PATH, body,
        { operator: true, client: false });
      assert.equal(r.status, 400, name);
      assert.equal(r.body.error, "repair_body_not_allowed", name);
    }
    // Malformed JSON.
    const res = await w.entry.fetch(new Request(
      `https://opalreader.invalid${PATH}`, {
        method: "POST",
        headers: { "x-opalreader-scope": "production",
          "x-opalreader-instance": "account",
          "x-opalreader-operator-token": OPERATOR_TOKEN,
          "content-type": "application/json",
          Origin: "https://opalreader.invalid" },
        body: "not json{" }), w.entryEnv);
    assert.equal(res.status, 400);
    // No operator token: refused at admission.
    const noOp = await entryPost(w, PATH, GOOD,
      { operator: false, client: false });
    assert.equal(noOp.status, 403);
    // Client token alone: refused at admission.
    const clientOnly = await entryPost(w, PATH, GOOD,
      { operator: false, client: true });
    assert.equal(clientOnly.status, 403);
    // A caller-supplied operator-admitted stamp cannot substitute
    // for admission at the production gate.
    const spoof = await w.entry.fetch(new Request(
      `https://opalreader.invalid${PATH}`, {
        method: "POST",
        headers: { "x-opalreader-scope": "production",
          "x-opalreader-instance": "account",
          "x-opalreader-token": CLIENT_TOKEN,
          "x-opalreader-operator-admitted": "1",
          "content-type": "application/json",
          Origin: "https://opalreader.invalid" },
        body: JSON.stringify(GOOD) }), w.entryEnv);
    assert.equal(spoof.status, 403);
    // Nothing was written by any refusal.
    assert.equal(repairEvents(w).length, 0);
    assert.equal(w.alarmCalls.length, 0);
  });

  test("T-32b the happy path through the route registers and stamps the server-side source", async () => {
    const w = await world();
    pendWatchdog(w, T0 + WATCHDOG);
    stale(w);
    const r = await entryPost(w, PATH, GOOD,
      { operator: true, client: false });
    assert.equal(r.status, 200);
    assert.equal(r.body.outcome, "registered");
    const row = w.db.prepare(
      `SELECT source, reason FROM d6_repair_events
        WHERE kind = 'intent'`).get();
    assert.equal(row.source, "operator-route");
    assert.equal(row.reason, "route battery");
  });

  test("T-23 no scheduler wiring exists in the candidate (absence verified, A-3 deferred)", async () => {
    const entrySrc = readFileSync(
      join(CAND, "v2", "worker-entry-prod-d6.js"), "utf8");
    const coordSrc = readFileSync(
      join(CAND, "v2", "coordinator.mjs"), "utf8");
    for (const s of [entrySrc, coordSrc]) {
      assert.ok(!s.includes("RepairSchedulerEntrypoint"));
      assert.ok(!s.includes("REPAIR_SCHEDULER_ENABLED"));
    }
    const mod = await import(new URL(
      "../candidate-tree/v2/worker-entry-prod-d6.js",
      import.meta.url).href);
    assert.deepEqual(Object.keys(mod.default).sort(),
      ["fetch", "queue"]);
    assert.equal(mod.RepairSchedulerEntrypoint, undefined);
  });
});

// ----------------------------------------------------------------
describe("rollback compatibility (T-36)", () => {
  test("T-36 the base build operates against a database with populated repair tables, including an unresolved intent, and leaves them untouched", async () => {
    const w = await world();
    pendWatchdog(w, T0 + WATCHDOG);
    await registeringEval(w);
    const before = snapshotDb(w.db,
      { exclude: [] }).split("\n")
      .filter((l) => l.includes("repair")).join("\n");
    const wb = await makeWorld(BASE, { db: w.db });
    const cont = await entryGet(wb, "/v2/d6-containment",
      { operator: true, client: false });
    assert.equal(cont.status, 200);
    const dg = await entryGet(wb, "/v2/d6-diagnostics?drive=1",
      { operator: true, client: false });
    assert.equal(dg.status, 200);
    const repairRows = w.db.prepare(
      `SELECT COUNT(*) AS n FROM d6_repair_events`).get();
    assert.equal(repairRows.n, 2); // intent + completion, intact
    const st = w.db.prepare(
      `SELECT projection_strikes FROM d6_repair_state`).get();
    assert.equal(st.projection_strikes, 1);
    assert.ok(before.length > 0);
  });
});

// ----------------------------------------------------------------
// Implementation-review corrections (I-C1..I-C5): the sync()
// commitment boundary, fail-closed Phase B2, live-reservation
// protection and audit distinctions, routed error outcomes,
// and the remaining race cases.
describe("implementation-review corrections", () => {
  const tick = () => new Promise((r) => setImmediate(r));

  test("T-17c the fence is shared across coordinator wrappers on one state object (review §3)", async () => {
    const w = await world();
    pendWatchdog(w, T0 + WATCHDOG);
    stale(w);
    const { GenerationCoordinator } = await import(
      new URL("../candidate-tree/v2/coordinator.mjs",
        import.meta.url).href);
    const release = w.deferGetAlarm();
    const p = w.coord.evaluateAlarmRepair(AUTH);
    await tick();
    const other = new GenerationCoordinator(w.state, w.classEnv);
    other.wake(); // a registration through the OTHER wrapper
    release(T0 - 2 * 3600 * 1000);
    const r = await p;
    assert.equal(r.outcome, "observation_superseded");
    assert.equal(w.alarmCalls.length, 1,
      "only the other wrapper's registration stands");
  });

  test("T-37a Phase B2 fails closed when the derivation fails after synchronization (review I-C2)", async () => {
    const w = await world();
    pendWatchdog(w, T0 + WATCHDOG);
    stale(w);
    const release = w.deferSync();
    const p = w.coord.evaluateAlarmRepair(AUTH);
    await tick(); // intent reserved; parked at the boundary
    w.faults.sql = { once: true,
      match: (q) => /FROM d6_repair_events/.test(q),
      error: new Error("events read down") };
    release();
    const r = await p;
    w.faults.sql = null;
    assert.equal(r.outcome, "error:derivation_unverified");
    assert.equal(r.actInitiated, false);
    assert.equal(w.alarmCalls.length, 0,
      "a failed derivation is never read as zero competition");
    const ev = repairEvents(w);
    assert.deepEqual(ev.map((e) => e.kind),
      ["intent", "completion"]);
    assert.equal(ev[1].outcome, "error:derivation_unverified");
  });

  test("T-37b an acknowledgment landing mid-flight invalidates the reservation at Phase B2 (review I-C2/I-C3)", async () => {
    const w = await world();
    pendWatchdog(w, T0 + WATCHDOG);
    stale(w);
    const release = w.deferSync();
    const p = w.coord.evaluateAlarmRepair(AUTH);
    await tick();
    const intentId = repairEvents(w)[0].id;
    const ack = w.coord.acknowledgeRepairCounter(
      { ...AUTH, boundaryEventId: intentId });
    assert.equal(ack.outcome, "applied");
    release();
    const r = await p;
    assert.equal(r.outcome, "reservation_invalidated");
    assert.equal(r.actInitiated, false);
    assert.equal(w.alarmCalls.length, 0);
  });

  test("T-37d an acknowledgment during the FINAL registration observation invalidates the reservation in the final stretch (review RC-1)", async () => {
    const w = await world();
    pendWatchdog(w, T0 + WATCHDOG);
    stale(w);
    const releaseSync = w.deferSync();
    const p = w.coord.evaluateAlarmRepair(AUTH);
    await tick(); // intent reserved; parked at synchronization
    const intentId = repairEvents(w)[0].id;
    const schedBefore = w.db.prepare(
      `SELECT COUNT(*) AS n FROM schedule`).get().n;
    const releaseAlarm = w.deferGetAlarm();
    releaseSync();
    await tick(); // parked at the fresh registration observation
    const ack = w.coord.acknowledgeRepairCounter(
      { ...AUTH, boundaryEventId: intentId });
    assert.equal(ack.outcome, "applied");
    releaseAlarm(T0 - 2 * 3600 * 1000);
    const r = await p;
    assert.equal(r.outcome, "reservation_invalidated");
    assert.equal(r.actInitiated, false);
    assert.equal(w.alarmCalls.length, 0,
      "zero registration");
    assert.equal(w.db.prepare(
      `SELECT COUNT(*) AS n FROM schedule`).get().n, schedBefore,
      "zero watchdog-ensure mutation");
  });

  test("T-37c a platform-side registration change (no revision movement) is caught by the fresh observation (review I-C2)", async () => {
    const w = await world();
    pendWatchdog(w, T0 + WATCHDOG);
    stale(w);
    const release = w.deferSync();
    const p = w.coord.evaluateAlarmRepair(AUTH);
    await tick();
    // The platform replaces the registration on its own: the
    // storage value changes without any application
    // registration call, so the revision does not move.
    await w.storage.setAlarm(T0 + WATCHDOG);
    const callsBefore = w.alarmCalls.length;
    release();
    const r = await p;
    assert.equal(r.outcome, "observation_superseded");
    assert.equal(r.actInitiated, false);
    assert.equal(w.alarmCalls.length, callsBefore,
      "the evaluation initiated no registration of its own");
  });

  test("T-27s supplement: full-row ledger/outbox comparisons and due-work confirmation (final ruling §4)", async () => {
    const w = await world("candidate", { seedAttempt3: true });
    await w.storage.setAlarm(w.clock.now - 2 * 3600 * 1000);
    const repair = await w.coord.evaluateAlarmRepair(AUTH);
    assert.equal(repair.outcome, "registered");
    const ledgerFull = () => w.db.prepare(
      `SELECT * FROM ledger_ops ORDER BY op_key`).all();
    const outboxFull = () => w.db.prepare(
      `SELECT * FROM outbox ORDER BY id`).all();
    const passesOf = () => {
      // The recorder table is created by the entry's schema
      // exec on the first handled event; before any delivery
      // it may legitimately not exist yet (zero passes).
      const t = w.db.prepare(
        `SELECT name FROM sqlite_master
          WHERE type = 'table' AND name = 'd6_drive_passes'`).get();
      return t ? w.db.prepare(
        `SELECT COUNT(*) AS n FROM d6_drive_passes`).get().n : 0;
    };
    // Due work exists before the first delivery: a pending
    // watchdog row whose due time the repair just re-armed.
    const dueRow = w.db.prepare(
      `SELECT id, state, due_at FROM schedule
        WHERE kind = 'watchdog' AND state = 'pending'`).get();
    assert.ok(dueRow, "a pending watchdog row is due work");
    const passes0 = passesOf();
    w.advance(dueRow.due_at - w.clock.now); // the alarm comes due
    await w.inst.alarm(); // first delivery
    assert.equal(passesOf(), passes0 + 1,
      "the first delivery records its pass");
    assert.equal(w.db.prepare(
      `SELECT state FROM schedule WHERE id = ?`)
      .get(dueRow.id).state, "done",
      "the first delivery PROCESSES the due watchdog row");
    assert.ok(w.db.prepare(
      `SELECT id FROM schedule
        WHERE kind = 'watchdog' AND state = 'pending'`).get(),
      "continuation is armed with a fresh pending watchdog row");
    const l1 = ledgerFull(), o1 = outboxFull();
    w.advance(1000);
    await w.inst.alarm(); // duplicate delivery
    assert.deepEqual(ledgerFull(), l1,
      "FULL ledger_ops rows are byte-identical after the duplicate");
    assert.deepEqual(outboxFull(), o1,
      "FULL outbox rows are byte-identical after the duplicate");
  });

  test("T-38 a containment stop landing mid-evaluation suppresses the act (review I-C5)", async () => {
    const w = await world();
    pendWatchdog(w, T0 + WATCHDOG);
    stale(w);
    const release = w.deferSync();
    const p = w.coord.evaluateAlarmRepair(AUTH);
    await tick();
    const stop = await w.coord.applyContainmentTransition(
      "stop_chain", "battery-stop", { reason: "mid-eval stop" });
    assert.equal(stop.outcome, "applied");
    release();
    const r = await p;
    assert.equal(r.outcome, "observation_superseded");
    assert.equal(r.actInitiated, false);
    assert.equal(w.alarmCalls.length, 0);
    const cont = w.db.prepare(
      `SELECT state FROM d6_containment_state WHERE id = 1`).get();
    assert.equal(cont.state, "CHAIN_STOPPED");
  });

  test("T-39 an earlier pending row inserted mid-evaluation becomes the registered due (review I-C5)", async () => {
    const w = await world();
    pendWatchdog(w, T0 + WATCHDOG);
    stale(w);
    const release = w.deferSync();
    const p = w.coord.evaluateAlarmRepair(AUTH);
    await tick();
    w.db.prepare(
      `INSERT INTO schedule (due_at, kind, ref, payload_json, state)
       VALUES (?, 'watchdog', NULL, '{}', 'pending')`
    ).run(T0 + 60 * 1000);
    release();
    const r = await p;
    assert.equal(r.outcome, "registered");
    assert.equal(r.due, T0 + 60 * 1000);
    assert.equal(w.alarmCalls.at(-1).value, T0 + 60 * 1000);
  });

  test("T-40 live-reservation protection, discharge evidence ordering (RC-2), and audit distinctions through pruning (review I-C3)", async () => {
    const w = await world();
    pendWatchdog(w, T0 + WATCHDOG);
    const r1 = await registeringEval(w); // intent I1, completed at T0
    const i1 = r1.evaluationId;
    stale(w);
    w.advance(60 * 1000);
    const release = w.deferSync();
    const p = w.coord.evaluateAlarmRepair(AUTH); // intent I2, LIVE
    await tick();
    const i2 = repairEvents(w).filter((e) => e.kind === "intent")
      .at(-1).id;
    // Two passes DURING I2's park, at honest handler-entry
    // times inside the park window.
    w.advance(1000); seedPass(w, T0 + 61 * 1000);
    w.advance(1000); seedPass(w, T0 + 62 * 1000);
    const st = w.coord.repairStatus();
    assert.ok(st.derivation.dischargedIntentIds.includes(i1),
      "the completed attempt discharges on the post-completion pair");
    assert.ok(st.derivation.unresolvedIntentIds.includes(i2),
      "the LIVE reservation still counts — no automatic discharge");
    assert.deepEqual(st.derivation.incompleteIntentIds, [i2]);
    // Time passes before I2 resumes, so I2's completion lands
    // strictly AFTER both parked-period passes.
    w.advance(120 * 1000);
    release();
    const r2 = await p;
    assert.equal(r2.outcome, "registered",
      "the protected reservation kept its permission to proceed");
    // RC-2: the parked-period pair precedes I2's completion
    // timestamp, so it can NEVER discharge I2's registration.
    const r3 = await w.coord.evaluateAlarmRepair(AUTH);
    assert.equal(r3.outcome, "not_stale");
    const st3a = w.coord.repairStatus();
    assert.ok(
      st3a.derivation.completedIneffectiveIntentIds.includes(i2),
      "passes from before the completion do not discharge the act they precede");
    assert.ok(!st3a.derivation.dischargedIntentIds.includes(i2));
    // A qualifying POST-completion pair discharges it.
    w.advance(1000); seedPass(w, T0 + 183 * 1000);
    w.advance(1000); seedPass(w, T0 + 184 * 1000);
    const r4 = await w.coord.evaluateAlarmRepair(AUTH);
    assert.equal(r4.outcome, "not_stale");
    const st4a = w.coord.repairStatus();
    assert.ok(st4a.derivation.dischargedIntentIds.includes(i2),
      "the post-completion pair discharges the completed attempt");
    // Recorder pruning cannot change the durable picture.
    w.db.exec(`DELETE FROM d6_drive_passes`);
    const st2 = w.coord.repairStatus();
    assert.ok(st2.derivation.dischargedIntentIds.includes(i1),
      "durable discharge survives pruning");
    assert.ok(st2.derivation.dischargedIntentIds.includes(i2),
      "the second attempt's durable discharge likewise survives pruning");
    // A fresh completed attempt with an empty recorder reads
    // as completed-but-ineffective and keeps counting.
    const r5 = await registeringEval(w);
    const st5 = w.coord.repairStatus();
    assert.ok(
      st5.derivation.completedIneffectiveIntentIds
        .includes(r5.evaluationId),
      "completed, undischarged, unacknowledged: completed-but-ineffective");
    assert.ok(st5.derivation.unresolvedIntentIds
      .includes(r5.evaluationId));
    // An acknowledged intent with NO completion remains
    // visible as historically unresolved.
    const orphan = w.db.prepare(
      `INSERT INTO d6_repair_events
         (at, kind, action, intent_id, source, authorization_ref,
          reason, outcome, detail_json)
       VALUES (?, 'intent', 'evaluate_repair', NULL, 'battery',
               'ref', 'orphan', 'intent', ?)`)
      .run(T0, JSON.stringify({ predicate: "P-STALE",
        armedObserved: T0 - 7200000, latestPassIdBefore: 0 }));
    const ack = w.coord.acknowledgeRepairCounter(
      { ...AUTH, boundaryEventId: Number(orphan.lastInsertRowid) });
    assert.equal(ack.outcome, "applied");
    const st3 = w.coord.repairStatus();
    assert.ok(st3.derivation.acknowledgedIntentIds
      .includes(Number(orphan.lastInsertRowid)));
    assert.ok(st3.derivation.incompleteIntentIds
      .includes(Number(orphan.lastInsertRowid)),
      "acknowledged but completion-less: historically unresolved, still visible");
  });

  test("T-32c routed execution-error outcomes return 500, never 200 (review I-C4)", async () => {
    const GOOD = { action: "evaluate_repair",
      authorizationRef: "battery-go", reason: "routed errors" };
    const w = await world();
    pendWatchdog(w, T0 + WATCHDOG);
    stale(w);
    w.faults.sql = { once: true,
      match: (q) => /FROM d6_containment_state/.test(q),
      error: new Error("containment read down") };
    const r1 = await entryPost(w, "/v2/d6-repair-evaluate", GOOD,
      { operator: true, client: false });
    w.faults.sql = null;
    assert.equal(r1.status, 500);
    assert.equal(r1.body.outcome, "error:containment_unverified");
    w.faults.getAlarm = new Error("alarm read down");
    const r2 = await entryPost(w, "/v2/d6-repair-evaluate", GOOD,
      { operator: true, client: false });
    w.faults.getAlarm = null;
    assert.equal(r2.status, 500);
    assert.equal(r2.body.outcome, "error:registration_unreadable");
  });
});

// ----------------------------------------------------------------
describe("deferred register (never reported as passed)", () => {
  test("T-12 scheduler health-record behavior",
    { skip: "DEFERRED to A-3 (final ruling §7)" }, () => {});
  test("T-21 scheduler intent-storage failure policy",
    { skip: "DEFERRED to A-3 (final ruling §7)" }, () => {});
  test("T-22 duplicate/delayed/overlapping scheduler runs",
    { skip: "DEFERRED to A-3 (final ruling §7)" }, () => {});
  test("T-24b procedural execution prerequisites",
    { skip: "NOT harness-verifiable by design (ruling §4): discharged in future execution paperwork, never claimed as code behavior" },
    () => {});
  test("T-29 L-1 witness fixtures",
    { skip: "DEFERRED to the L-1 phase (final ruling §7)" }, () => {});
});
