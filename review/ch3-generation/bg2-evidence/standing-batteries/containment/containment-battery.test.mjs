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
//
// V3 BATTERY (containment-v3 package; Rowan's containment-
// correction ruling, items B/C/D/F). Env vars renamed to
// CONTAINMENT_V3_* so a v3 run can never silently pick up a v2
// tree. Adaptations from the v2 battery — all disclosed, none a
// deletion or loosening; each is a contract STRENGTHENING forced
// by a v3 contract change or an assertion extended over a larger
// read surface:
//   * CT1: the drive=1 containment projection carries the six
//     v3 stop-record fields (design v3 §2.3); the deep-equal
//     expectation is extended with their empty values.
//   * CT9/CT10: clear transitions now REQUIRE a recorded reason
//     (design v3 §5.1); clear calls pass one. CT12 refuses
//     reason-less clears at method and route.
//   * CT0: marker set extended with the v3 vocabulary.
//   * CT3/CT6: stop-record assertions added alongside the
//     existing ones.
// New groups: CT11 (verify_chain_stop — ruling item B), CT12
// (restoration discipline — item D), CT13 (async races — item C;
// CT13a/CT13b FAIL against the v2 candidate tree, demonstrating
// the _armAlarmIfEarlier re-arm race defect the v3 gate re-check
// fixes — see PHASEB-CONTAINMENT-ASYNC-ANALYSIS.md).
//
// V4 BATTERY (containment-v4 package; Rowan's V3 ruling, corrections
// R1/R3/R4/R6). Env vars renamed to CONTAINMENT_V4_*. Adaptations
// from the v3 battery — all disclosed, none a deletion or loosening:
//   * CT1: the drive=1 containment projection carries the v4
//     episode + confidence fields (design v4 §2/§4); the deep-equal
//     expectation is extended with their empty values.
//   * CT0: marker set extended with the v4 vocabulary.
// New groups: CT14 (R1 stop-record truth table — every displayed
// confidence combination exercised), CT15 (R3 exhaustion law —
// refusal, audit-recorded exhaustion, counter persistence across
// clear, new-episode minting), CT16 (R4 C3 ledger dry-run —
// partial failures, ambiguous responses, resume with no duplicate
// physical acts). R2 contributes no new tests: platform storage-
// effect ordering is NOT harness-expressible and is marked, not
// tested (async analysis v4).
//
// V4 CORRECTIONS BATTERY (Rowan's containment-V4 ruling,
// correction V4-3). NO candidate code changed: the derivation
// already branches unreadable-before-enum (design v4 §2.3's
// proof-by-construction order (1)/(2)); what was missing was
// a test pinning row 1's READABLE-RECORD precondition. New
// group member: CT14d (unreadable record x every enum x every
// fresh shape -> "unknown", never row 1's "not_applicable";
// readable non-stopped records as the control). No existing
// test or assertion was modified, deleted, or loosened; the
// battery count rises 41 -> 42 on both v4 trees.

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
const CAND = process.env.CONTAINMENT_V4_CAND_DIR || join(ROOT, "candidate-tree");
const BASE = process.env.CONTAINMENT_V4_BASE_DIR || join(ROOT, "baseline-tree");
const IDENTITY = JSON.parse(readFileSync(
  process.env.CONTAINMENT_V4_IDENTITY ||
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
// V3 helpers: settle pending work so a fire-and-forget invocation
// reaches its deferred-getAlarm park; read the audit trail.
const flush = async (n = 4) => {
  for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r));
};
const events = (w) => tableExists(w, "d6_containment_events")
  ? w.db.prepare(`SELECT * FROM d6_containment_events ORDER BY id`).all()
  : [];

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
    // v3 vocabulary (design v3 §2/§3/§5):
    assert.match(coord, /verify_chain_stop/);
    assert.match(coord, /MAX_STOP_VERIFY_ATTEMPTS/);
    assert.match(coord, /stop_status/);
    assert.match(coord, /containment_reason_required/);
    // v4 vocabulary (design v4 §2/§4; async analysis v4):
    assert.match(coord, /CONTAINMENT_STOP_CONFIDENCES/);
    assert.match(coord, /deriveStopConfidence/);
    assert.match(coord, /containmentConfidence/);
    assert.match(coord, /stop_episode_exhausted/);
    assert.match(coord, /stop_episode_closed/);
    assert.match(coord, /stop_episode_id/);
    const entry = readFileSync(
      join(CAND, "v2/worker-entry-prod-d6.js"), "utf8");
    assert.match(entry, /"contained"/);
    assert.match(entry, /internal\/d6\/containment/);
    assert.match(entry, /verify_chain_stop/);
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
      updatedAt: null, authorizationRef: null,
      // v3: the stop-record fields ride the same projection
      // (design v3 §2.3); empty before any stop episode.
      stopStatus: null, stopVerifiedAt: null, stopVerifyAction: null,
      stopArmedBefore: null, stopArmedAfter: null,
      stopVerifyAttempts: 0,
      // v4: episode bookkeeping + derived confidence (design v4
      // §2/§4); empty / not applicable before any stop episode.
      stopEpisodeId: null, stopEpisodeExhausted: false,
      prevEpisodeId: null, prevEpisodeAttempts: null,
      prevEpisodeExhausted: null, prevEpisodeClosedAt: null,
      stopConfidence: "not_applicable" });
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
    // v3: the persistent stop record corroborates the response —
    // three separate facts: enum, physical verification, status.
    assert.equal(r2.body.stateRead.stopStatus, "verified");
    assert.equal(r2.body.stateRead.stopVerifyAction, "stop_chain");
    assert.equal(r2.body.stateRead.stopArmedAfter, null);
    assert.equal(r2.body.stateRead.stopVerifyAttempts, 1);
    assert.ok(r2.body.stateRead.stopVerifiedAt !== null);
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
    // v3: the stop record itself says unverified (attempt 1) —
    // the enum alone never claims a physical stop (design v3 §2).
    const cs = w.coord.containmentState();
    assert.equal(cs.state, "CHAIN_STOPPED");
    assert.equal(cs.stopStatus, "unverified");
    assert.equal(cs.stopVerifyAttempts, 1);
    assert.equal(cs.stopArmedBefore, armedBefore);
    assert.equal(cs.stopVerifiedAt, null);
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
    const clr = await w.coord.applyContainmentTransition("clear", REF,
      { reason: "battery CT9: restore after stop assertions" });
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
    const clr2 = await w.coord.applyContainmentTransition("clear", REF,
      { reason: "battery CT9: idempotent clear re-apply" });
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
    await w.coord.applyContainmentTransition("clear", REF,
      { reason: "battery CT10: close the containment sweep" });
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

// ----------------------------------------------------------------
describe("CT11 — verify_chain_stop: the auditable re-verification / retry mechanism (ruling item B)", () => {
  test("CT11a delete failed at the stop: verify retries the delete, lands it, and marks the record re_verified", async () => {
    const w = await makeWorld(CAND);
    await seedAttempt3Shape(w);
    await w.fireClassAlarm();
    const armedBefore = w.alarmAt();
    assert.ok(armedBefore !== null);
    w.faults.deleteAlarm = new Error("battery deleteAlarm fault");
    const stop = await w.coord.applyContainmentTransition(
      "stop_chain", REF);
    assert.equal(stop.outcome, "rejected");
    assert.equal(stop.reason, "containment_stop_unverified");
    assert.equal(w.alarmAt(), armedBefore);
    w.faults.deleteAlarm = null;
    const v = await entryPost(w, "/v2/d6-containment",
      { action: "verify_chain_stop", authorizationRef: REF },
      { operator: true });
    assert.equal(v.status, 200);
    assert.equal(v.body.outcome, "applied");
    assert.equal(v.body.stopVerified, true);
    assert.equal(v.body.state, "CHAIN_STOPPED",
      "verification never moves the enum");
    assert.equal(v.body.stateRead.stopStatus, "re_verified");
    assert.equal(v.body.stateRead.stopVerifyAction, "verify_chain_stop");
    assert.equal(v.body.stateRead.stopVerifyAttempts, 2);
    assert.equal(v.body.stateRead.stopArmedBefore, armedBefore);
    assert.equal(v.body.stateRead.stopArmedAfter, null);
    assert.ok(v.body.stateRead.stopVerifiedAt !== null);
    assert.equal(w.alarmAt(), null, "the retried delete landed");
    assert.equal(w.alarmDeletes.length, 1,
      "exactly one delete ever landed (the verify's)");
    const evs = events(w).map((e) => `${e.action}:${e.outcome}`);
    assert.deepEqual(evs, [
      "stop_chain:applied", "stop_chain_verify:unverified",
      "verify_chain_stop:verified"]);
    const detail = JSON.parse(events(w)[2].detail_json);
    assert.equal(detail.attempt, 2);
    assert.equal(detail.deleteAttempted, true);
    assert.equal(detail.armedBefore, armedBefore);
    assert.equal(detail.armedAfter, null);
  });
  test("CT11b the delete landed but the read-back failed: verify confirms from the null read-back WITHOUT re-deleting", async () => {
    const w = await makeWorld(CAND);
    await seedAttempt3Shape(w);
    await w.fireClassAlarm();
    assert.equal(w.alarmDeletes.length, 0);
    w.faults.getAlarm = new Error("battery getAlarm fault");
    const stop = await w.coord.applyContainmentTransition(
      "stop_chain", REF);
    assert.equal(stop.outcome, "rejected");
    assert.equal(stop.reason, "containment_stop_unverified");
    assert.equal(w.alarmAt(), null,
      "the delete physically landed; only the reads failed");
    assert.equal(w.alarmDeletes.length, 1);
    w.faults.getAlarm = null;
    const v = await w.coord.applyContainmentTransition(
      "verify_chain_stop", REF);
    assert.equal(v.outcome, "applied");
    assert.equal(v.stateRead.stopStatus, "re_verified");
    assert.equal(v.stateRead.stopArmedBefore, null);
    assert.equal(w.alarmDeletes.length, 1,
      "no second delete: the registration was already absent");
    const detail = JSON.parse(events(w).at(-1).detail_json);
    assert.equal(detail.deleteAttempted, false);
  });
  test("CT11c verify is refused unless the state is CHAIN_STOPPED", async () => {
    const w = await makeWorld(CAND);
    await seedAttempt3Shape(w);
    const v1 = await w.coord.applyContainmentTransition(
      "verify_chain_stop", REF);
    assert.equal(v1.outcome, "rejected");
    assert.equal(v1.reason, "containment_verify_not_stopped");
    await w.coord.applyContainmentTransition("contain_drive", REF);
    const v2 = await w.coord.applyContainmentTransition(
      "verify_chain_stop", REF);
    assert.equal(v2.outcome, "rejected");
    assert.equal(v2.reason, "containment_verify_not_stopped");
    assert.equal(events(w).filter(
      (e) => e.action === "verify_chain_stop").length, 0,
      "a refused verify appends no verification event");
  });
  test("CT11d the attempts bound is enforced; a fresh stop episode (after a reasoned clear) resets it", async () => {
    const w = await makeWorld(CAND);
    await seedAttempt3Shape(w);
    await w.fireClassAlarm();
    w.faults.deleteAlarm = new Error("battery deleteAlarm fault");
    const stop = await w.coord.applyContainmentTransition(
      "stop_chain", REF); // attempt 1
    assert.equal(stop.outcome, "rejected");
    const v2 = await w.coord.applyContainmentTransition(
      "verify_chain_stop", REF); // attempt 2
    assert.equal(v2.outcome, "rejected");
    assert.equal(v2.stateRead.stopVerifyAttempts, 2);
    const v3 = await w.coord.applyContainmentTransition(
      "verify_chain_stop", REF); // attempt 3
    assert.equal(v3.outcome, "rejected");
    assert.equal(v3.stateRead.stopVerifyAttempts, 3);
    w.faults.deleteAlarm = null; // the platform fault clears...
    const v4 = await w.coord.applyContainmentTransition(
      "verify_chain_stop", REF);
    assert.equal(v4.outcome, "rejected");
    assert.equal(v4.reason, "containment_verify_attempts_exhausted",
      "...but the bound still binds: further retries need fresh authorization (a new episode)");
    assert.equal(w.coord.containmentState().state, "CHAIN_STOPPED",
      "exhaustion never downgrades or clears");
    assert.ok(w.alarmAt() !== null,
      "the registration still physically survives, and the record says so");
    const clr = await w.coord.applyContainmentTransition("clear", REF,
      { reason: "battery CT11d: abandon episode 1 for a fresh stop" });
    assert.equal(clr.outcome, "applied");
    assert.equal(clr.stateRead.stopVerifyAttempts, 0,
      "clear resets the stop record (fresh episode bookkeeping)");
    assert.equal(clr.stateRead.stopStatus, null);
    const stop2 = await w.coord.applyContainmentTransition(
      "stop_chain", REF);
    assert.equal(stop2.outcome, "applied");
    assert.equal(stop2.stateRead.stopVerifyAttempts, 1);
    assert.equal(stop2.stateRead.stopStatus, "verified");
    assert.equal(w.alarmAt(), null);
  });
  test("CT11e a failed verify never downgrades: state, suppression, and the unverified record all stand", async () => {
    const w = await makeWorld(CAND);
    await seedAttempt3Shape(w);
    await w.fireClassAlarm();
    w.faults.deleteAlarm = new Error("battery deleteAlarm fault");
    await w.coord.applyContainmentTransition("stop_chain", REF);
    w.faults.deleteAlarm = null;
    const gaError = new Error("battery getAlarm fault");
    gaError.name = "BatteryGetAlarmError";
    w.faults.getAlarm = gaError;
    const v = await w.coord.applyContainmentTransition(
      "verify_chain_stop", REF);
    assert.equal(v.outcome, "rejected");
    assert.equal(v.reason, "containment_stop_unverified");
    w.faults.getAlarm = null;
    const cs = w.coord.containmentState();
    assert.equal(cs.state, "CHAIN_STOPPED");
    assert.equal(cs.stopStatus, "unverified",
      "failure leaves the record unverified — never worse, never better");
    assert.equal(cs.stopVerifyAttempts, 2);
    w.clearAlarmCalls();
    await w.coord.wake();
    await w.fireClassAlarm();
    assert.equal(w.alarmCalls.length, 0,
      "suppression is undiminished after a failed verify");
    assert.equal(driveRows(w).at(-1).stage, "contained");
    const detail = JSON.parse(events(w).at(-1).detail_json);
    assert.equal(detail.verifyError, "BatteryGetAlarmError",
      "the audit detail records the error's name (the codebase's convention at both stop-verification sites)");
  });
  test("CT11f verify on an already-verified stop is an idempotent confirmation (status stays 'verified', no delete)", async () => {
    const w = await makeWorld(CAND);
    await seedAttempt3Shape(w);
    const stop = await w.coord.applyContainmentTransition(
      "stop_chain", REF);
    assert.equal(stop.outcome, "applied");
    assert.equal(w.alarmDeletes.length, 1);
    const v = await w.coord.applyContainmentTransition(
      "verify_chain_stop", REF);
    assert.equal(v.outcome, "applied");
    assert.equal(v.idempotent, true);
    assert.equal(v.stateRead.stopStatus, "verified",
      "an already-verified record is confirmed, not relabeled");
    assert.equal(v.stateRead.stopVerifyAttempts, 2);
    assert.equal(w.alarmDeletes.length, 1, "no redundant delete");
  });
});

// ----------------------------------------------------------------
describe("CT12 — restoration discipline (ruling item D)", () => {
  test("CT12a clear without a recorded reason is refused at the method AND the route; with a reason it applies and the reason is audited", async () => {
    const w = await makeWorld(CAND);
    await seedAttempt3Shape(w);
    await w.coord.applyContainmentTransition("contain_drive", REF);
    const noReason = await w.coord.applyContainmentTransition(
      "clear", REF);
    assert.equal(noReason.outcome, "rejected");
    assert.equal(noReason.reason, "containment_reason_required");
    const blank = await w.coord.applyContainmentTransition(
      "clear", REF, { reason: "   " });
    assert.equal(blank.reason, "containment_reason_required");
    const route = await entryPost(w, "/v2/d6-containment",
      { action: "clear", authorizationRef: REF }, { operator: true });
    assert.equal(route.body.outcome, "rejected");
    assert.equal(route.body.reason, "containment_reason_required");
    assert.equal(w.coord.containmentState().state, "DRIVE_CONTAINED",
      "refused clears change nothing");
    const ok = await entryPost(w, "/v2/d6-containment",
      { action: "clear", authorizationRef: REF,
        reason: "battery CT12a: restoration demonstration" },
      { operator: true });
    assert.equal(ok.body.outcome, "applied");
    assert.equal(ok.body.state, "NORMAL");
    const clearEv = events(w).filter((e) => e.action === "clear");
    assert.equal(clearEv.length, 1);
    assert.equal(JSON.parse(clearEv[0].detail_json).reason,
      "battery CT12a: restoration demonstration");
  });
  test("CT12b clearing CHAIN_STOPPED never re-arms: the registration stays absent until an ordinary wake under NORMAL", async () => {
    const w = await makeWorld(CAND);
    await seedAttempt3Shape(w);
    await w.fireClassAlarm();
    const schedBefore = schedSnapshot(w);
    const stop = await w.coord.applyContainmentTransition(
      "stop_chain", REF);
    assert.equal(stop.outcome, "applied");
    const clr = await w.coord.applyContainmentTransition("clear", REF,
      { reason: "battery CT12b: standalone restoration" });
    assert.equal(clr.outcome, "applied");
    assert.equal(w.alarmAt(), null,
      "clear does NOT silently re-register an alarm");
    assert.equal(clr.stateRead.stopStatus, null);
    assert.equal(schedSnapshot(w), schedBefore,
      "pending schedule rows were preserved through stop and clear");
    w.clearAlarmCalls();
    await w.coord.wake();
    assert.equal(w.alarmCalls.length, 1,
      "the first subsequent wake re-arms per the ordinary rules");
    assert.ok(w.alarmAt() !== null);
  });
  test("CT12c NO automatic clear anywhere: an unverified stop persists across time, passes, wakes, commands, and reads", async () => {
    const w = await makeWorld(CAND);
    await seedAttempt3Shape(w);
    await w.fireClassAlarm();
    w.faults.deleteAlarm = new Error("battery deleteAlarm fault");
    await w.coord.applyContainmentTransition("stop_chain", REF);
    w.faults.deleteAlarm = null;
    w.advance(24 * 60 * MIN); // a full day passes
    await w.fireClassAlarm();
    await w.coord.wake();
    await w.coord.handleCommand({
      command_id: "ct12-cmd", type: "RequestPause",
      payload: { jobId: "alarm-wake-probe:nonexistent" } });
    await entryGet(w, "/v2/d6-containment", { operator: true });
    await entryGet(w, "/v2/d6-diagnostics?drive=1", { operator: true });
    const cs = w.coord.containmentState();
    assert.equal(cs.state, "CHAIN_STOPPED",
      "nothing — time, traffic, or reads — restores NORMAL on its own");
    assert.equal(cs.stopStatus, "unverified");
    assert.equal(cs.stopVerifyAttempts, 1,
      "no background process retried the verification either");
  });
});

// ----------------------------------------------------------------
describe("CT13 — async races at the await boundaries (ruling item C)", () => {
  test("CT13a a wake parked at getAlarm() cannot resurrect the chain after a stop lands mid-wake (stale-value branch)", async () => {
    const w = await makeWorld(CAND);
    await seedAttempt3Shape(w);
    const stale = T0 + 30 * MIN;
    w.seedAlarm(stale); // armed 30 min out; a watchdog is due sooner
    w.clearAlarmCalls();
    const release = w.deferGetAlarm();
    const wakeP = w.coord.wake();
    await flush();
    assert.equal(w.deferArmed(), false,
      "the wake consumed the deferred read: it is parked at getAlarm()");
    const stop = await w.coord.applyContainmentTransition(
      "stop_chain", REF);
    assert.equal(stop.outcome, "applied");
    assert.equal(stop.stopVerified, true);
    assert.equal(w.alarmAt(), null);
    release(stale); // the parked read observes the PRE-STOP value
    await wakeP;
    assert.equal(w.alarmCalls.length, 0,
      "the v3 gate re-check suppresses the parked wake's re-arm");
    assert.equal(w.alarmAt(), null);
  });
  test("CT13b the same race, null branch: the parked read resolves after the delete and STILL cannot re-arm", async () => {
    const w = await makeWorld(CAND);
    await seedAttempt3Shape(w);
    const stale = T0 + 30 * MIN;
    w.seedAlarm(stale);
    w.clearAlarmCalls();
    const release = w.deferGetAlarm();
    const wakeP = w.coord.wake();
    await flush();
    assert.equal(w.deferArmed(), false);
    const stop = await w.coord.applyContainmentTransition(
      "stop_chain", REF);
    assert.equal(stop.outcome, "applied");
    assert.equal(w.alarmAt(), null);
    release(null); // the read was processed after the delete
    await wakeP;
    assert.equal(w.alarmCalls.length, 0,
      "pre-fix code re-registered here via its re-arm-if-unarmed branch");
    assert.equal(w.alarmAt(), null);
  });
  test("CT13c a verify_chain_stop landing while a wake is parked: the last physical act wins and the record stays truthful", async () => {
    const w = await makeWorld(CAND);
    await seedAttempt3Shape(w);
    await w.fireClassAlarm();
    const armed = w.alarmAt();
    assert.ok(armed !== null);
    w.clearAlarmCalls();
    const release = w.deferGetAlarm();
    const wakeP = w.coord.wake(); // parks under NORMAL, pre-stop
    await flush();
    assert.equal(w.deferArmed(), false);
    w.faults.deleteAlarm = new Error("battery deleteAlarm fault");
    const stop = await w.coord.applyContainmentTransition(
      "stop_chain", REF);
    assert.equal(stop.outcome, "rejected");
    assert.equal(stop.stateRead.stopStatus, "unverified");
    assert.equal(w.alarmAt(), armed, "the registration survived");
    w.faults.deleteAlarm = null;
    const v = await w.coord.applyContainmentTransition(
      "verify_chain_stop", REF);
    assert.equal(v.outcome, "applied");
    assert.equal(v.stateRead.stopStatus, "re_verified");
    assert.equal(w.alarmAt(), null, "the verify's delete landed last");
    release(armed); // the parked wake now resumes with a stale read
    await wakeP;
    assert.equal(w.alarmCalls.length, 0,
      "the parked wake cannot undo the verified stop");
    assert.equal(w.alarmAt(), null);
    const cs = w.coord.containmentState();
    assert.equal(cs.stopStatus, "re_verified",
      "the audit record still matches physical reality");
  });
  test("CT13d contain_drive lands mid-pass: the running pass completes under its gate-time state; the NEXT pass is contained", async () => {
    const w = await makeWorld(CAND);
    await seedAttempt3Shape(w);
    const release = w.deferGetAlarm();
    const passP = w.fireClassAlarm();
    await flush();
    assert.equal(w.deferArmed(), false,
      "the pass is parked inside driveOnce -> requestGrant -> wake");
    assert.equal(grants(w).length, 0,
      "no grant yet: the pass is suspended before issuance");
    const r = await w.coord.applyContainmentTransition(
      "contain_drive", REF);
    assert.equal(r.outcome, "applied");
    release(w.alarmAt());
    await passP;
    assert.equal(grants(w).length, 1,
      "the already-running pass was NOT interrupted: it issued its grant under the state it read at its gate");
    assert.equal(driveRows(w).at(-1).stage, "complete");
    await w.fireClassAlarm();
    assert.equal(driveRows(w).at(-1).stage, "contained",
      "the next pass observes the new state");
    assert.equal(grants(w).length, 1);
  });
  test("CT13e stop_chain lands mid-pass: the pass completes, its post-grant arm is suppressed, and the stop record survives", async () => {
    const w = await makeWorld(CAND);
    await seedAttempt3Shape(w);
    const release = w.deferGetAlarm();
    const passP = w.fireClassAlarm();
    await flush();
    assert.equal(w.deferArmed(), false);
    assert.equal(grants(w).length, 0);
    const armedAtPark = w.alarmAt();
    const stop = await w.coord.applyContainmentTransition(
      "stop_chain", REF);
    assert.equal(stop.outcome, "applied");
    assert.equal(stop.stopVerified, true);
    assert.equal(w.alarmAt(), null);
    release(armedAtPark); // stale read for the parked wake in the pass
    await passP;
    assert.equal(grants(w).length, 1,
      "the running pass completed and issued its grant (the stop is not retroactive)");
    assert.equal(w.alarmAt(), null,
      "the pass's own arm paths did not resurrect the registration");
    const cs = w.coord.containmentState();
    assert.equal(cs.state, "CHAIN_STOPPED");
    assert.equal(cs.stopStatus, "verified");
    await w.fireClassAlarm();
    assert.equal(driveRows(w).at(-1).stage, "contained");
    assert.equal(w.alarmAt(), null);
  });
  test("CT13f state-read failure at the parked wake's re-check: unverified means suppressed (darker branch at the new boundary too)", async () => {
    const w = await makeWorld(CAND);
    await seedAttempt3Shape(w);
    const stale = T0 + 30 * MIN;
    w.seedAlarm(stale);
    w.clearAlarmCalls();
    const release = w.deferGetAlarm();
    const wakeP = w.coord.wake();
    await flush();
    assert.equal(w.deferArmed(), false);
    const stop = await w.coord.applyContainmentTransition(
      "stop_chain", REF);
    assert.equal(stop.outcome, "applied");
    const error = new Error("battery containment read fault");
    error.name = "BatteryContainmentReadError";
    w.faults.sql = {
      match: (q) => /FROM d6_containment_state/i.test(q), error };
    release(stale);
    await wakeP;
    assert.equal(w.alarmCalls.length, 0,
      "a re-check that cannot verify the state suppresses the arm");
    assert.equal(w.alarmAt(), null);
    w.faults.sql = null;
    assert.equal(w.coord.containmentState().state, "CHAIN_STOPPED");
  });
});

// ----------------------------------------------------------------
// V4 groups (Rowan's V3 ruling, corrections R1/R3/R4).
// ----------------------------------------------------------------
describe("CT14 — R1: stop-record truth — derived CURRENT PHYSICAL CONFIDENCE (design v4 §2)", () => {
  test("CT14a the exported derivation: the full truth table, cell by cell", async () => {
    const coord = await import(
      join(CAND, "v2/coordinator.mjs"));
    const d = coord.deriveStopConfidence;
    assert.equal(typeof d, "function");
    const verifiedRec = { state: "CHAIN_STOPPED", verified: true,
      known: true, stopStatus: "verified", stopVerifiedAt: 123 };
    const reverifiedRec = { ...verifiedRec, stopStatus: "re_verified" };
    const unverifiedRec = { state: "CHAIN_STOPPED", verified: true,
      known: true, stopStatus: "unverified", stopVerifiedAt: null };
    const failedAfterRec = { state: "CHAIN_STOPPED", verified: true,
      known: true, stopStatus: "unverified", stopVerifiedAt: 123 };
    const nullStatusRec = { state: "CHAIN_STOPPED", verified: true,
      known: true, stopStatus: null, stopVerifiedAt: null };
    const unreadableRec = { state: "CHAIN_STOPPED", verified: false,
      known: false, stopStatus: null, stopVerifiedAt: null };
    const V = (armed) => ({ kind: "value", armed });
    // Not stopped: confidence does not apply, whatever the read.
    for (const st of ["NORMAL", "DRIVE_CONTAINED"]) {
      for (const f of [V(null), V(999), { kind: "failed" },
                       { kind: "unavailable" }, null]) {
        assert.equal(d({ state: st, verified: true, known: true,
          stopStatus: null, stopVerifiedAt: null }, f),
          "not_applicable", `${st} / ${JSON.stringify(f)}`);
      }
    }
    // Verified + this read observes absence: verified_current.
    assert.equal(d(verifiedRec, V(null)), "verified_current");
    assert.equal(d(reverifiedRec, V(null)), "verified_current");
    // Verified, no fresh observation: verified_recorded (no more).
    assert.equal(d(verifiedRec, { kind: "unavailable" }),
      "verified_recorded");
    assert.equal(d(verifiedRec, null), "verified_recorded");
    // Verified + surviving registration observed: contested —
    // for BOTH derivations and for an unverifiable read surface.
    assert.equal(d(verifiedRec, V(999)), "contested");
    assert.equal(d(reverifiedRec, V(999)), "contested");
    // A failed read cannot confirm currency: unknown, never
    // verified_anything.
    assert.equal(d(verifiedRec, { kind: "failed" }), "unknown");
    // Unverified records never display verified_*.
    assert.equal(d(unverifiedRec, V(null)), "unverified");
    assert.equal(d(unverifiedRec, V(999)), "contested");
    assert.equal(d(unverifiedRec, { kind: "failed" }), "unknown");
    assert.equal(d(nullStatusRec, V(null)), "unverified");
    // Earlier success + LATER FAILED action (status flipped to
    // unverified by _verifyChainStop's failure write while
    // stopVerifiedAt survives): unknown — NOT verified_recorded.
    assert.equal(d(failedAfterRec, { kind: "unavailable" }),
      "unknown");
    assert.equal(d(failedAfterRec, V(null)), "unknown");
    assert.equal(d(failedAfterRec, V(999)), "contested");
    // Unreadable record: unknown under every derivation.
    assert.equal(d(unreadableRec, V(null)), "unknown");
    // Exhaustiveness: no other value is ever produced.
    const vocab = new Set(coord.CONTAINMENT_STOP_CONFIDENCES);
    assert.deepEqual([...vocab].sort(), ["contested",
      "not_applicable", "unknown", "unverified",
      "verified_current", "verified_recorded"]);
  });

  test("CT14b surfaces: verified stop shows verified_current; enum and last-verified fact are immutable under degradation", async () => {
    const w = await makeWorld(CAND);
    await seedAttempt3Shape(w);
    await w.fireClassAlarm();
    const stop = await w.coord.applyContainmentTransition(
      "stop_chain", REF);
    assert.equal(stop.outcome, "applied");
    const verifiedAt = stop.stateRead.stopVerifiedAt;
    assert.ok(verifiedAt !== null);
    const diag = await entryGet(w, "/v2/d6-diagnostics?drive=1",
      { operator: true });
    assert.equal(diag.body.containment.stopConfidence,
      "verified_current");
    const st = await entryGet(w, "/v2/d6-containment",
      { operator: true });
    assert.equal(st.body.stopConfidence, "verified_current");
    // A LATER SURVIVING REGISTRATION (a registration that
    // re-appears after the verified stop — simulated by seeding
    // one directly) degrades the DISPLAYED confidence to
    // contested; the enum does not move and the last-successful-
    // verification fact is not erased.
    w.seedAlarm(T0 + 60 * MIN);
    const diag2 = await entryGet(w, "/v2/d6-diagnostics?drive=1",
      { operator: true });
    assert.equal(diag2.body.containment.stopConfidence, "contested");
    assert.equal(diag2.body.containment.state, "CHAIN_STOPPED");
    assert.equal(diag2.body.containment.stopStatus, "verified",
      "the stored record is untouched by derivation");
    assert.equal(diag2.body.containment.stopVerifiedAt, verifiedAt,
      "the last-successful-verification fact survives degradation");
    const st2 = await entryGet(w, "/v2/d6-containment",
      { operator: true });
    assert.equal(st2.body.stopConfidence, "contested");
    assert.equal(w.coord.containmentState().state, "CHAIN_STOPPED");
  });

  test("CT14c surfaces: a failed registration read degrades confidence to unknown; an unverified stop never displays verified", async () => {
    const w = await makeWorld(CAND);
    await seedAttempt3Shape(w);
    await w.fireClassAlarm();
    w.faults.deleteAlarm = new Error("battery deleteAlarm fault");
    const stop = await w.coord.applyContainmentTransition(
      "stop_chain", REF);
    assert.equal(stop.outcome, "rejected");
    const diag = await entryGet(w, "/v2/d6-diagnostics?drive=1",
      { operator: true });
    assert.equal(diag.body.containment.stopConfidence, "contested",
      "never verified AND the failed delete left a surviving "
      + "registration: the display shows the worse truth (contested), "
      + "never a verified claim");
    w.faults.deleteAlarm = null;
    const v = await w.coord.applyContainmentTransition(
      "verify_chain_stop", REF);
    assert.equal(v.outcome, "applied");
    // Now verified; break the READ: confidence must degrade to
    // unknown — a failed read is never displayed as absence.
    w.faults.getAlarm = new Error("battery getAlarm fault");
    const diag2 = await entryGet(w, "/v2/d6-diagnostics?drive=1",
      { operator: true });
    assert.equal(diag2.body.containment.stopConfidence, "unknown");
    const st2 = await entryGet(w, "/v2/d6-containment",
      { operator: true });
    assert.equal(st2.body.stopConfidence, "unknown");
    w.faults.getAlarm = null;
    const diag3 = await entryGet(w, "/v2/d6-diagnostics?drive=1",
      { operator: true });
    assert.equal(diag3.body.containment.stopConfidence,
      "verified_current", "the read recovers; so does confidence");
  });

  test("CT14d truth-table row 1's READABLE-RECORD precondition (Rowan V4 ruling, V4-3): an unreadable record never yields row 1's not_applicable, whatever the enum", async () => {
    const coord = await import(
      join(CAND, "v2/coordinator.mjs"));
    const d = coord.deriveStopConfidence;
    const V = (armed) => ({ kind: "value", armed });
    const freshSet = [V(null), V(999), { kind: "failed" },
      { kind: "unavailable" }, null];
    // Row 1 (design v4 revised §2.3) applies ONLY to a record
    // that was actually read successfully. Every unreadable
    // shape — failed read (verified:false), unknown record
    // (known:false), or a null read — falls under row 2's
    // precedence and yields "unknown" for EVERY enum, including
    // the non-stopped enums whose READABLE records yield
    // "not_applicable". A read failure must never produce row
    // 1's output.
    const unreadableShapes = [
      { verified: false, known: true },
      { verified: true, known: false },
      { verified: false, known: false },
    ];
    for (const st of ["NORMAL", "DRIVE_CONTAINED",
                      "CHAIN_STOPPED"]) {
      for (const shape of unreadableShapes) {
        for (const f of freshSet) {
          assert.equal(d({ state: st, ...shape,
            stopStatus: "verified", stopVerifiedAt: 123 }, f),
            "unknown",
            `${st} / ${JSON.stringify(shape)} / ` +
            `${JSON.stringify(f)}`);
        }
      }
      // A null read is unreadable under every enum too.
      for (const f of freshSet) {
        assert.equal(d(null, f), "unknown",
          `null read / ${JSON.stringify(f)}`);
      }
    }
    // Control: the SAME non-stopped enums with a READABLE
    // record DO yield row 1's "not_applicable" — the
    // precondition, not the enum alone, decides the branch.
    for (const st of ["NORMAL", "DRIVE_CONTAINED"]) {
      for (const f of freshSet) {
        assert.equal(d({ state: st, verified: true, known: true,
          stopStatus: null, stopVerifiedAt: null }, f),
          "not_applicable", `${st} readable / ${JSON.stringify(f)}`);
      }
    }
  });
});

describe("CT15 — R3: retry-exhaustion law — episodes persist across clear (design v4 §4)", () => {
  test("CT15a exhaustion is recorded in the audit + state at the moment the bound is reached; refusal writes nothing further", async () => {
    const w = await makeWorld(CAND);
    await seedAttempt3Shape(w);
    await w.fireClassAlarm();
    w.faults.deleteAlarm = new Error("battery deleteAlarm fault");
    const stop = await w.coord.applyContainmentTransition(
      "stop_chain", REF); // attempt 1
    assert.equal(stop.outcome, "rejected");
    const ep = stop.stateRead.stopEpisodeId;
    assert.ok(typeof ep === "number",
      "the episode is keyed by the stop_chain audit event id");
    await w.coord.applyContainmentTransition(
      "verify_chain_stop", REF); // attempt 2
    const v3 = await w.coord.applyContainmentTransition(
      "verify_chain_stop", REF); // attempt 3 — bound reached
    assert.equal(v3.stateRead.stopVerifyAttempts, 3);
    assert.equal(v3.stateRead.stopEpisodeExhausted, true,
      "exhaustion is durable state, not an inference");
    const exh = events(w).filter(
      (e) => e.action === "stop_episode_exhausted");
    assert.equal(exh.length, 1,
      "exactly one exhaustion event is appended");
    assert.equal(JSON.parse(exh[0].detail_json).episodeId, ep);
    assert.equal(JSON.parse(exh[0].detail_json).attempts, 3);
    const before = events(w).length;
    const v4 = await w.coord.applyContainmentTransition(
      "verify_chain_stop", REF);
    assert.equal(v4.outcome, "rejected");
    assert.equal(v4.reason, "containment_verify_attempts_exhausted");
    assert.equal(events(w).length, before,
      "a refused verify appends nothing — no informal reset path");
  });

  test("CT15b clear CLOSES the episode (summary persists); a new stop mints a NEW episode; the exhausted history stays disclosed", async () => {
    const w = await makeWorld(CAND);
    await seedAttempt3Shape(w);
    await w.fireClassAlarm();
    w.faults.deleteAlarm = new Error("battery deleteAlarm fault");
    const stop = await w.coord.applyContainmentTransition(
      "stop_chain", REF);
    const ep1 = stop.stateRead.stopEpisodeId;
    await w.coord.applyContainmentTransition(
      "verify_chain_stop", REF);
    await w.coord.applyContainmentTransition(
      "verify_chain_stop", REF); // exhausted at 3
    w.faults.deleteAlarm = null;
    const clr = await w.coord.applyContainmentTransition("clear",
      REF, { reason: "battery CT15b: close exhausted episode 1" });
    assert.equal(clr.outcome, "applied");
    assert.equal(clr.stateRead.stopEpisodeId, null,
      "the current-episode fields reset with the stop record");
    assert.equal(clr.stateRead.prevEpisodeId, ep1,
      "the closed episode's identity PERSISTS across the clear");
    assert.equal(clr.stateRead.prevEpisodeAttempts, 3);
    assert.equal(clr.stateRead.prevEpisodeExhausted, true);
    assert.ok(clr.stateRead.prevEpisodeClosedAt !== null);
    const closed = events(w).filter(
      (e) => e.action === "stop_episode_closed");
    assert.equal(closed.length, 1);
    assert.equal(JSON.parse(closed[0].detail_json).episodeId, ep1);
    assert.equal(JSON.parse(closed[0].detail_json).exhausted, true);
    // A genuinely new stop mints a NEW episode — and the surfaces
    // still disclose the exhausted predecessor (the paperwork
    // anti-circumvention rule reads exactly these fields).
    const stop2 = await w.coord.applyContainmentTransition(
      "stop_chain", REF);
    assert.equal(stop2.outcome, "applied");
    assert.ok(stop2.stateRead.stopEpisodeId !== null);
    assert.notEqual(stop2.stateRead.stopEpisodeId, ep1);
    assert.equal(stop2.stateRead.prevEpisodeExhausted, true,
      "disclosure survives into the new episode");
    const diag = await entryGet(w, "/v2/d6-diagnostics?drive=1",
      { operator: true });
    assert.equal(diag.body.containment.prevEpisodeExhausted, true);
    assert.equal(diag.body.containment.stopConfidence,
      "verified_current");
  });

  test("CT15c verify on the SAME episode still refuses after exhaustion even when the physical fault clears (code-enforced half of the law)", async () => {
    const w = await makeWorld(CAND);
    await seedAttempt3Shape(w);
    await w.fireClassAlarm();
    w.faults.deleteAlarm = new Error("battery deleteAlarm fault");
    await w.coord.applyContainmentTransition("stop_chain", REF);
    await w.coord.applyContainmentTransition(
      "verify_chain_stop", REF);
    await w.coord.applyContainmentTransition(
      "verify_chain_stop", REF);
    w.faults.deleteAlarm = null;
    const v = await w.coord.applyContainmentTransition(
      "verify_chain_stop", REF);
    assert.equal(v.outcome, "rejected");
    assert.equal(v.reason, "containment_verify_attempts_exhausted");
    assert.equal(w.alarmDeletes.length, 0,
      "no physical act is attempted by a refused verify");
  });
});

describe("CT16 — R4: the C3 ledger, dry-run in the harness (gates v4, C3)", () => {
  test("CT16a the C3 sequence end-to-end: contain (read-only gate) → stop against the stale registration → verified; ledger writes match the audit", async () => {
    const w = await makeWorld(CAND);
    await seedAttempt3Shape(w);
    // The live shape: a stale registration far in the past.
    assert.ok(w.alarmAt() !== null);
    const c = await w.coord.applyContainmentTransition(
      "contain_drive", REF);
    assert.equal(c.outcome, "applied");
    assert.equal(events(w).length, 1,
      "ledger step C3-2: exactly one state write + one audit row");
    const stop = await w.coord.applyContainmentTransition(
      "stop_chain", REF);
    assert.equal(stop.outcome, "applied");
    assert.equal(stop.stateRead.stopStatus, "verified");
    assert.equal(w.alarmDeletes.length, 1,
      "ledger step C3-4: exactly one deleteAlarm");
    assert.equal(w.alarmAt(), null);
    const diag = await entryGet(w, "/v2/d6-diagnostics?drive=1",
      { operator: true });
    assert.equal(diag.body.containment.stopConfidence,
      "verified_current");
    assert.deepEqual(events(w).map((e) => e.action),
      ["contain_drive", "stop_chain"],
      "a stop whose own act verifies appends no separate "
      + "stop_chain_verify event (that event marks an UNVERIFIED "
      + "stop outcome — cf. CT11a)");
  });

  test("CT16b partial failure at the delete step + ambiguous re-entry: resume uses verify_chain_stop, never a second stop_chain; deletes never duplicate", async () => {
    const w = await makeWorld(CAND);
    await seedAttempt3Shape(w);
    await w.coord.applyContainmentTransition("contain_drive", REF);
    // Ledger failure mode: deleteAlarm throws (nothing lands).
    w.faults.deleteAlarm = new Error("battery deleteAlarm fault");
    const stop = await w.coord.applyContainmentTransition(
      "stop_chain", REF);
    assert.equal(stop.outcome, "rejected");
    assert.equal(stop.reason, "containment_stop_unverified");
    assert.equal(w.alarmDeletes.length, 0);
    // AMBIGUOUS RESPONSE: the executor's view of the stop call is
    // lost. Re-entry (gates v4 C3 §R) reads state + audit FIRST:
    const state = w.coord.containmentState();
    assert.equal(state.state, "CHAIN_STOPPED",
      "re-entry sees the committed enum — the stop DID land");
    assert.equal(state.stopStatus, "unverified");
    const audit = events(w).map((e) => e.action);
    assert.ok(audit.includes("stop_chain"),
      "the audit row is the idempotency key: stop_chain is not re-run");
    // Resume = verify_chain_stop (the only resumption act).
    w.faults.deleteAlarm = null;
    const v = await w.coord.applyContainmentTransition(
      "verify_chain_stop", REF);
    assert.equal(v.outcome, "applied");
    assert.equal(v.stateRead.stopStatus, "re_verified");
    assert.equal(w.alarmDeletes.length, 1,
      "exactly one delete landed across stop + resume");
    assert.equal(events(w).filter(
      (e) => e.action === "stop_chain").length, 1,
      "stop_chain ran exactly once");
  });

  test("CT16c ambiguous delete (landed, response lost): the read-back resolves it; resume confirms without re-deleting", async () => {
    const w = await makeWorld(CAND);
    await seedAttempt3Shape(w);
    await w.coord.applyContainmentTransition("contain_drive", REF);
    // The delete lands but every read fails: the stop reports
    // unverified — the ambiguous case of the ledger.
    w.faults.getAlarm = new Error("battery getAlarm fault");
    const stop = await w.coord.applyContainmentTransition(
      "stop_chain", REF);
    assert.equal(stop.outcome, "rejected");
    assert.equal(w.alarmAt(), null, "the delete physically landed");
    assert.equal(w.alarmDeletes.length, 1);
    w.faults.getAlarm = null;
    // Re-entry: state + audit first, then verify — which observes
    // absence and confirms WITHOUT a second delete.
    assert.equal(w.coord.containmentState().stopStatus,
      "unverified");
    const v = await w.coord.applyContainmentTransition(
      "verify_chain_stop", REF);
    assert.equal(v.outcome, "applied");
    assert.equal(v.stateRead.stopStatus, "re_verified");
    assert.equal(w.alarmDeletes.length, 1,
      "no duplicate physical act on resume");
    const detail = JSON.parse(events(w).at(-1).detail_json);
    assert.equal(detail.deleteAttempted, false);
  });
});
