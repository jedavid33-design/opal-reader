// CONTAINMENT battery (Rowan R5a-revised-package ruling, required
// work B). Runs against a containment candidate tree (env
// CONTAINMENT_CAND_DIR; default ../candidate-tree) with the live
// instrumented tree (env CONTAINMENT_BASE_DIR; default
// ../baseline-tree) as the identity baseline. The SAME battery runs
// against the composed tree (R5a + containment) via the env vars.
// Identity assertions are FIXTURE-DRIVEN (env CONTAINMENT_IDENTITY
// -> a JSON file naming the changed parts and their SHA-256s), so
// no candidate identity is hardcoded here.
// Local scratch only: no network, no production calls.
// Run: node --test containment-battery.test.mjs
//
// Harness caveat (standing): the harness invokes alarm() directly;
// it cannot prove real platform delivery, real platform retry
// behavior, or real-DO SQLite behavior beyond its mirrored .one()
// throw semantics. "Retries" below are simulated by re-invoking
// the handler, which is all any offline test can do.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  makeWorld, seedAttempt3Shape, snapshotDb, entryGet, entryPost,
  OPERATOR_TOKEN, T0,
} from "./harness.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const CAND = process.env.CONTAINMENT_CAND_DIR || join(ROOT, "candidate-tree");
const BASE = process.env.CONTAINMENT_BASE_DIR || join(ROOT, "baseline-tree");
const IDENTITY = JSON.parse(readFileSync(
  process.env.CONTAINMENT_IDENTITY ||
  join(ROOT, "fixtures", "identity-candidate.json"), "utf8"));
const shaFile = (p) =>
  createHash("sha256").update(readFileSync(p)).digest("hex");
const MIN = 60 * 1000;

function listFiles(dir, prefix = "") {
  const out = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${name.name}` : name.name;
    if (name.isDirectory()) out.push(...listFiles(join(dir, name.name), rel));
    else out.push(rel);
  }
  return out.sort();
}
const tableExists = (w, name) => !!w.db.prepare(
  `SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
  .get(name);
const driveRows = (w) => w.db.prepare(
  `SELECT * FROM d6_drive_passes ORDER BY id`).all();
const grants = (w) => w.db.prepare(`SELECT * FROM grants`).all();
const schedSnapshot = (w) => w.db.prepare(
  `SELECT * FROM schedule ORDER BY id`).all()
  .map((r) => JSON.stringify(r, Object.keys(r).sort())).join("\n");
const REF = "battery:containment";

// ----------------------------------------------------------------
describe("CT0 — assembly & identity (fixture-driven)", () => {
  test("changed parts are exactly the fixture set; all others byte-identical to the live tree", () => {
    const cand = listFiles(CAND), base = listFiles(BASE);
    assert.equal(cand.length, 31);
    assert.deepEqual(cand, base);
    const differ = cand.filter(
      (f) => shaFile(join(CAND, f)) !== shaFile(join(BASE, f)));
    assert.deepEqual(differ,
      IDENTITY.changedParts.map((p) => p.rel).sort());
    for (const p of IDENTITY.changedParts)
      assert.equal(shaFile(join(CAND, p.rel)), p.sha256,
        `${p.rel} identity`);
  });
  test("node --check passes on every changed part", () => {
    for (const p of IDENTITY.changedParts) {
      const r = spawnSync(process.execPath,
        ["--check", join(CAND, p.rel)], { encoding: "utf8" });
      assert.equal(r.status, 0, `${p.rel}: ${r.stderr}`);
    }
  });
  test("design markers present in the candidate parts", () => {
    const coord = readFileSync(join(CAND, "v2/coordinator.mjs"), "utf8");
    assert.match(coord, /CONTAINMENT_STATES/);
    assert.match(coord, /applyContainmentTransition/);
    assert.match(coord, /containmentArmSuppressed/);
    const entry = readFileSync(
      join(CAND, "v2/worker-entry-prod-d6.js"), "utf8");
    assert.match(entry, /"contained"/);
    assert.match(entry, /internal\/d6\/containment/);
  });
});

// ----------------------------------------------------------------
describe("CT1 — NORMAL: ordinary delivery, containment inert and invisible", () => {
  test("seeded pass issues its grant exactly as shipped; reads report NORMAL-absent; no state table is created by passes or reads", async () => {
    const w = await makeWorld(CAND);
    const seed = await seedAttempt3Shape(w);
    await w.fireClassAlarm();
    assert.equal(grants(w).length, 1);
    const rows = driveRows(w);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].stage, "complete");
    const cs = w.coord.containmentState();
    assert.equal(cs.state, "NORMAL");
    assert.equal(cs.absent, true);
    assert.equal(cs.verified, true);
    assert.equal(tableExists(w, "d6_containment_state"), false,
      "passes and reads never create the containment tables");
    const diag = await entryGet(w, "/v2/d6-diagnostics?drive=1",
      { operator: true });
    assert.equal(diag.status, 200);
    assert.deepEqual(diag.body.containment, {
      state: "NORMAL", known: true, absent: true, verified: true,
      updatedAt: null, authorizationRef: null });
    const st = await entryGet(w, "/v2/d6-containment",
      { operator: true });
    assert.equal(st.status, 200);
    assert.equal(st.body.state, "NORMAL");
    assert.equal(st.body.absent, true);
    assert.equal(tableExists(w, "d6_containment_state"), false);
    const job = w.db.prepare(
      `SELECT * FROM jobs WHERE job_id = ?`).get(seed.jobId);
    assert.equal(job.state, "generating");
  });
});

// ----------------------------------------------------------------
describe("CT2 — Layer 1 (DRIVE_CONTAINED): drive suppressed, chain alive, leases close", () => {
  test("contained passes record stage 'contained'; the in-flight grant is voided by the lease path; no new grant; registration continues", async () => {
    const w = await makeWorld(CAND);
    const seed = await seedAttempt3Shape(w);
    await w.fireClassAlarm(); // NORMAL pass: grant issued
    assert.equal(grants(w).length, 1);
    const r = await entryPost(w, "/v2/d6-containment",
      { action: "contain_drive", authorizationRef: REF },
      { operator: true });
    assert.equal(r.status, 200);
    assert.equal(r.body.outcome, "applied");
    assert.equal(r.body.state, "DRIVE_CONTAINED");
    // Advance past the 15-minute lease and deliver a pass.
    w.advance(16 * MIN);
    await w.fireClassAlarm();
    const rows = driveRows(w);
    const last = rows[rows.length - 1];
    assert.equal(last.stage, "contained");
    assert.equal(last.drive_invoked, 0);
    const g = grants(w);
    assert.equal(g.length, 1, "no new grant under containment");
    assert.equal(g[0].state, "voided",
      "lease-driven closure proceeds while contained");
    const occ = w.db.prepare(
      `SELECT * FROM occurrences WHERE job_id = ?`).get(seed.jobId);
    assert.equal(occ.state, "pending",
      "the voided occurrence returns to pending (re-advance)");
    assert.ok(w.alarmAt() !== null && w.alarmAt() > w.clock.now - 16 * MIN,
      "the base finally re-armed: the chain stays alive");
    const st = await entryGet(w, "/v2/d6-containment",
      { operator: true });
    assert.equal(st.body.state, "DRIVE_CONTAINED");
    assert.ok(st.body.alarm.armedAt !== null);
    const ps = w.service.planStatus(seed.planId);
    assert.equal(ps.state, "active");
    assert.deepEqual(ps.totals, { eligible: 1, done: 0, failed: 0,
      blocked: 0, prompts: 0 });
  });
});

// ----------------------------------------------------------------
describe("CT3 — Layer 2 (CHAIN_STOPPED): registration removed and cannot resurrect", () => {
  test("verified stop: deleteAlarm read back null; schedule rows untouched; commands and wakes register nothing; a delivered pass is contained and does not re-arm", async () => {
    const w = await makeWorld(CAND);
    const seed = await seedAttempt3Shape(w);
    await w.fireClassAlarm();
    const schedBefore = schedSnapshot(w);
    const r1 = await entryPost(w, "/v2/d6-containment",
      { action: "contain_drive", authorizationRef: REF },
      { operator: true });
    assert.equal(r1.body.outcome, "applied");
    const schedMid = schedSnapshot(w);
    assert.equal(schedMid, schedBefore,
      "contain_drive touches no schedule rows");
    const r2 = await entryPost(w, "/v2/d6-containment",
      { action: "stop_chain", authorizationRef: REF },
      { operator: true });
    assert.equal(r2.status, 200);
    assert.equal(r2.body.outcome, "applied");
    assert.equal(r2.body.state, "CHAIN_STOPPED");
    assert.equal(r2.body.stopVerified, true);
    assert.equal(w.alarmDeletes.length, 1);
    assert.equal(w.alarmAt(), null);
    assert.equal(schedSnapshot(w), schedBefore,
      "stop_chain preserves pending schedule rows as evidence");
    // A command arriving after the stop: recorded, rejected on its
    // own merits, and — the point — registers NOTHING.
    const callsBefore = w.alarmCalls.length;
    const res = await w.coord.handleCommand({
      command_id: "ct3-cmd", type: "RequestPause",
      payload: { jobId: "alarm-wake-probe:nonexistent" } });
    assert.equal(res.outcome, "rejected");
    assert.equal(res.reason, "job_not_found");
    assert.equal(w.alarmCalls.length, callsBefore,
      "no setAlarm after a verified stop");
    assert.equal(w.alarmAt(), null);
    await w.coord.wake();
    assert.equal(w.alarmCalls.length, callsBefore);
    assert.equal(w.alarmAt(), null);
    // A pass delivered anyway (in-flight / platform retry): base
    // processing runs once, drive is contained, and the finally
    // does NOT re-arm.
    await w.fireClassAlarm();
    const rows = driveRows(w);
    assert.equal(rows[rows.length - 1].stage, "contained");
    assert.equal(w.alarmAt(), null);
    const diag = await entryGet(w, "/v2/d6-diagnostics?drive=1",
      { operator: true });
    assert.equal(diag.body.containment.state, "CHAIN_STOPPED");
    assert.equal(diag.body.alarm.armedAt, null);
    const cmds = w.db.prepare(`SELECT * FROM commands`).all();
    assert.equal(cmds.filter((c) => c.command_id === "ct3-cmd").length, 1);
    assert.equal(seed.planId.length > 0, true);
  });
});

// ----------------------------------------------------------------
describe("CT4 — state READ failures default darker at every consuming path", () => {
  const readFault = (w) => {
    const error = new Error("battery containment read fault");
    error.name = "BatteryContainmentReadError";
    w.faults.sql = {
      match: (q) => /FROM d6_containment_state/i.test(q), error };
    return error;
  };
  test("CT4a DRIVE_CONTAINED + read fault: drive stays suppressed (contained row carries the error); arming also suppresses", async () => {
    const w = await makeWorld(CAND);
    await seedAttempt3Shape(w);
    const r = await w.coord.applyContainmentTransition(
      "contain_drive", REF);
    assert.equal(r.outcome, "applied");
    readFault(w);
    w.clearAlarmCalls();
    await w.fireClassAlarm();
    const rows = driveRows(w);
    const last = rows[rows.length - 1];
    assert.equal(last.stage, "contained");
    assert.equal(last.drive_invoked, 0);
    assert.equal(last.error_name, "BatteryContainmentReadError");
    assert.equal(grants(w).length, 0);
    await w.coord.wake();
    assert.equal(w.alarmCalls.length, 0,
      "an unverified read suppresses arming too (darker default)");
  });
  test("CT4b CHAIN_STOPPED + read fault: the verified stop is NOT defeated — wakes register nothing", async () => {
    const w = await makeWorld(CAND);
    await seedAttempt3Shape(w);
    await w.fireClassAlarm();
    const r = await w.coord.applyContainmentTransition(
      "stop_chain", REF);
    assert.equal(r.outcome, "applied");
    assert.equal(r.stopVerified, true);
    assert.equal(w.alarmAt(), null);
    readFault(w);
    w.clearAlarmCalls();
    await w.coord.wake();
    assert.equal(w.alarmCalls.length, 0);
    assert.equal(w.alarmAt(), null);
    const res = await w.coord.handleCommand({
      command_id: "ct4b-cmd", type: "RequestPause",
      payload: { jobId: "alarm-wake-probe:nonexistent" } });
    assert.equal(res.outcome, "rejected");
    assert.equal(w.alarmCalls.length, 0,
      "with the state unreadable, no path re-registers");
    assert.equal(w.alarmAt(), null);
  });
  test("CT4c NORMAL (table absent) + non-table read error: fail-closed — the pass is contained, nothing issues", async () => {
    const w = await makeWorld(CAND);
    await seedAttempt3Shape(w);
    readFault(w);
    await w.fireClassAlarm();
    const rows = driveRows(w);
    assert.equal(rows[rows.length - 1].stage, "contained");
    assert.equal(grants(w).length, 0);
    assert.equal(tableExists(w, "d6_containment_state"), false,
      "the read path created nothing even under fault");
  });
});

// ----------------------------------------------------------------
describe("CT5 — state WRITE failures during transitions: no silent success", () => {
  test("state-row INSERT fault: the route surfaces HTTP 500 and the state is unchanged (still absent/NORMAL)", async () => {
    const w = await makeWorld(CAND);
    await seedAttempt3Shape(w);
    const error = new Error("battery containment write fault");
    w.faults.sql = {
      match: (q) => /INSERT INTO d6_containment_state/i.test(q),
      error };
    const r = await entryPost(w, "/v2/d6-containment",
      { action: "contain_drive", authorizationRef: REF },
      { operator: true });
    assert.equal(r.status, 500,
      "a failed write is a visible failure, never an applied outcome");
    w.faults.sql = null;
    const cs = w.coord.containmentState();
    assert.equal(cs.state, "NORMAL");
    assert.equal(cs.absent, true,
      "the transaction rolled back: no state row stands");
    const events = tableExists(w, "d6_containment_events")
      ? w.db.prepare(`SELECT * FROM d6_containment_events`).all() : [];
    assert.equal(events.filter((e) => e.outcome === "applied").length, 0,
      "no applied event was recorded for the failed transition");
    // And behavior is untouched: a pass drives normally.
    await w.fireClassAlarm();
    assert.equal(grants(w).length, 1);
  });
  test("DDL fault at transition time: HTTP 500, nothing recorded", async () => {
    const w = await makeWorld(CAND);
    await seedAttempt3Shape(w);
    const error = new Error("battery containment ddl fault");
    w.faults.sql = {
      match: (q) => /CREATE TABLE IF NOT EXISTS d6_containment_state/i.test(q),
      error };
    const r = await entryPost(w, "/v2/d6-containment",
      { action: "contain_drive", authorizationRef: REF },
      { operator: true });
    assert.equal(r.status, 500);
    w.faults.sql = null;
    assert.equal(w.coord.containmentState().absent, true);
  });
});

// ----------------------------------------------------------------
describe("CT6 — stop whose deleteAlarm FAILS: reported unverified, never silent, gates hold", () => {
  test("outcome rejected/containment_stop_unverified; state stands CHAIN_STOPPED; later wakes register nothing despite the surviving registration", async () => {
    const w = await makeWorld(CAND);
    await seedAttempt3Shape(w);
    await w.fireClassAlarm();
    const armedBefore = w.alarmAt();
    assert.ok(armedBefore !== null);
    const error = new Error("battery deleteAlarm fault");
    w.faults.deleteAlarm = error;
    const r = await entryPost(w, "/v2/d6-containment",
      { action: "stop_chain", authorizationRef: REF },
      { operator: true });
    assert.equal(r.status, 200);
    assert.equal(r.body.outcome, "rejected");
    assert.equal(r.body.reason, "containment_stop_unverified");
    assert.equal(r.body.state, "CHAIN_STOPPED");
    assert.equal(r.body.stopVerified, false);
    assert.equal(w.alarmAt(), armedBefore,
      "the registration physically survives (the act failed)");
    w.faults.deleteAlarm = null;
    // The arm gates are the second layer: even with a surviving
    // registration value, no wake re-registers, and a delivered
    // pass is contained and does not re-arm.
    w.clearAlarmCalls();
    await w.coord.wake();
    assert.equal(w.alarmCalls.length, 0);
    await w.fireClassAlarm();
    const rows = driveRows(w);
    assert.equal(rows[rows.length - 1].stage, "contained");
    assert.equal(w.alarmCalls.length, 0);
    const ev = w.db.prepare(
      `SELECT * FROM d6_containment_events
        WHERE action = 'stop_chain_verify'`).all();
    assert.equal(ev.length, 1);
    assert.equal(ev[0].outcome, "unverified");
  });
});

// ----------------------------------------------------------------
describe("CT7 — alarm-handler retries under containment (simulated re-invocation)", () => {
  test("a throwing base alarm under DRIVE_CONTAINED rejects identically on re-invocation; containment state and chain survive; the next healthy pass is contained", async () => {
    const w = await makeWorld(CAND);
    await seedAttempt3Shape(w);
    const r = await w.coord.applyContainmentTransition(
      "contain_drive", REF);
    assert.equal(r.outcome, "applied");
    const error = new Error("battery schedule fault");
    w.faults.sql = {
      match: (q) => /FROM schedule/i.test(q), error };
    await assert.rejects(w.fireClassAlarm(), (e) => e === error);
    // Simulated platform retry: the same fault, the same result.
    await assert.rejects(w.fireClassAlarm(), (e) => e === error);
    const rows = driveRows(w);
    assert.ok(rows.every((x) => x.stage === "base_alarm"));
    w.faults.sql = null;
    await w.fireClassAlarm();
    const rows2 = driveRows(w);
    assert.equal(rows2[rows2.length - 1].stage, "contained");
    assert.equal(w.coord.containmentState().state, "DRIVE_CONTAINED");
    assert.equal(grants(w).length, 0);
  });
});

// ----------------------------------------------------------------
describe("CT8 — in-flight grant activity at the moment of the stop", () => {
  test("the stop does not interrupt anything retroactively; a later delivered pass closes the in-flight grant by lease and issues nothing new", async () => {
    const w = await makeWorld(CAND);
    const seed = await seedAttempt3Shape(w);
    await w.fireClassAlarm(); // grant issued, lease pending
    assert.equal(grants(w).length, 1);
    assert.equal(grants(w)[0].state, "issued");
    const r = await entryPost(w, "/v2/d6-containment",
      { action: "stop_chain", authorizationRef: REF },
      { operator: true });
    assert.equal(r.body.outcome, "applied");
    assert.equal(grants(w)[0].state, "issued",
      "the stop itself changed no grant state");
    // The in-flight pass problem in reverse: a pass delivered
    // after the stop still runs base processing exactly once —
    // the lease closes the grant — and drive stays off.
    w.advance(16 * MIN);
    await w.fireClassAlarm();
    const g = grants(w);
    assert.equal(g.length, 1);
    assert.equal(g[0].state, "voided");
    const occ = w.db.prepare(
      `SELECT * FROM occurrences WHERE job_id = ?`).get(seed.jobId);
    assert.equal(occ.state, "pending");
    assert.equal(w.alarmAt(), null, "no re-arm after the stop");
    assert.equal(w.queue.sent.length, 0,
      "nothing was ever dispatched (halt fence intact throughout)");
  });
});

// ----------------------------------------------------------------
describe("CT9 — transition discipline, route fences, and the return path", () => {
  test("transition table enforced; idempotent re-apply audited; downgrade refused with no writes; clear restores ordinary arming", async () => {
    const w = await makeWorld(CAND);
    await seedAttempt3Shape(w);
    const t1 = await w.coord.applyContainmentTransition("stop_chain", REF);
    assert.equal(t1.outcome, "applied");
    const evCount = () => w.db.prepare(
      `SELECT COUNT(*) AS n FROM d6_containment_events`).get().n;
    const n0 = evCount();
    const down = await w.coord.applyContainmentTransition(
      "contain_drive", REF);
    assert.equal(down.outcome, "rejected");
    assert.equal(down.reason, "containment_transition_refused");
    assert.equal(evCount(), n0, "a refused transition writes nothing");
    assert.equal(w.coord.containmentState().state, "CHAIN_STOPPED");
    const again = await w.coord.applyContainmentTransition("stop_chain", REF);
    assert.equal(again.outcome, "applied");
    assert.equal(again.idempotent, true);
    const clr = await w.coord.applyContainmentTransition("clear", REF);
    assert.equal(clr.outcome, "applied");
    assert.equal(clr.state, "NORMAL");
    // Return path: clearing did not itself register anything...
    assert.equal(w.alarmAt(), null);
    // ...but ordinary arming works again on the next wake.
    w.clearAlarmCalls();
    await w.coord.wake();
    assert.equal(w.alarmCalls.length, 1,
      "after clear, a wake re-arms through the ordinary paths");
    assert.ok(w.alarmAt() !== null);
    const clr2 = await w.coord.applyContainmentTransition("clear", REF);
    assert.equal(clr2.outcome, "applied");
    assert.equal(clr2.idempotent, true);
  });
  test("route fences: closed allowlist, operator-only admission, client token alone refused", async () => {
    const w = await makeWorld(CAND);
    await seedAttempt3Shape(w);
    const extra = await entryPost(w, "/v2/d6-containment",
      { action: "contain_drive", authorizationRef: REF, bogus: 1 },
      { operator: true });
    assert.equal(extra.status, 200);
    assert.equal(extra.body.outcome, "rejected");
    assert.equal(extra.body.reason, "containment_request_key_not_allowed");
    const badAction = await entryPost(w, "/v2/d6-containment",
      { action: "explode", authorizationRef: REF }, { operator: true });
    assert.equal(badAction.body.reason, "containment_action_not_allowed");
    const noRef = await entryPost(w, "/v2/d6-containment",
      { action: "contain_drive" }, { operator: true });
    assert.equal(noRef.body.reason, "authorization_ref_required");
    const clientOnly = await entryPost(w, "/v2/d6-containment",
      { action: "contain_drive", authorizationRef: REF },
      { operator: false });
    assert.equal(clientOnly.status, 403);
    const noOperatorState = await entryGet(w, "/v2/d6-containment",
      { operator: false });
    assert.equal(noOperatorState.status, 403);
    assert.equal(w.coord.containmentState().absent, true,
      "none of the refused calls moved any state");
  });
});

// ----------------------------------------------------------------
describe("CT10 — preserved-plan integrity across the full containment sweep", () => {
  test("contain -> passes -> stop -> command -> clear leaves plan, job, occurrence, figures, parked job, and conflicts byte-identical", async () => {
    const w = await makeWorld(CAND);
    const seed = await seedAttempt3Shape(w);
    const EXCLUDE = ["commands", "schedule", "d6_drive_passes",
      "d6_containment_state", "d6_containment_events", "transitions"];
    const before = snapshotDb(w.db, { exclude: EXCLUDE });
    await w.coord.applyContainmentTransition("contain_drive", REF);
    w.advance(11 * MIN);
    await w.fireClassAlarm();
    await w.coord.applyContainmentTransition("stop_chain", REF);
    await w.coord.handleCommand({
      command_id: "ct10-cmd", type: "RequestPause",
      payload: { jobId: "alarm-wake-probe:nonexistent" } });
    await w.fireClassAlarm();
    await w.coord.applyContainmentTransition("clear", REF);
    const after = snapshotDb(w.db, { exclude: EXCLUDE });
    assert.equal(after, before);
    const pa = w.store.phaseAccounting("forever-pucked");
    assert.deepEqual(pa, { settledMicro: 1029420,
      inFlightUpperMicro: 0, unknownOpen: 0,
      estimatedUnverifiedMicro: 19018, reservedUnverifiedMicro: 5648 });
    const conflicts = w.db.prepare(
      `SELECT COUNT(*) AS n FROM binding_conflicts
        WHERE reason = 'schedule_dead'`).get();
    assert.equal(conflicts.n, 4);
    void seed;
  });
});
