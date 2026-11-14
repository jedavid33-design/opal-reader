// A-1 REGRESSION-COPY ADAPTATION (disclosed; W-4 Track A A-1
// implementation, 2026-11-14): the A-1 candidate adds two
// additive tables (d6_repair_events, d6_repair_state) that the
// unmodified twin does not have. The twin-equivalence snapshots
// below exclude them exactly as they already exclude the
// recorder's own table (d6_drive_passes) — the candidate's new
// schema is its point, not a divergence. What the exclusion
// would otherwise hide is asserted separately by the closing
// guard group: ordinary P2 traffic writes NOTHING to the
// repair tables (zero events; the singleton at its initial
// values). No original test or assertion is modified, deleted,
// or loosened.
// T0–T10 battery for the Phase B instrumentation candidate
// (spec §9; Rowan correction 6). Runs against the EXACT candidate
// tree assembled from the deployed evidence parts with the two
// amended parts replaced (scratch/candidate-tree), with the
// unmodified deployed tree (scratch/baseline-tree) as the twin
// for equivalence groups. Local scratch only: no network, no
// production calls. Run: node --test battery.test.mjs

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  readFileSync, readdirSync, mkdirSync, cpSync, rmSync, existsSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  makeWorld, seedAttempt3Shape, snapshotDb, entryGet,
  BOOK, PHASE, OCC26, PARKED_JOB, T0,
} from "./harness.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
// B-G2 SCAFFOLDING ADAPTATION (disclosed in the implementation
// record): this copy of the P2 battery runs against the S1 build's
// trees — CAND is the S1 candidate tree, BASE/PARTS the pinned
// pre-build composed tree — and its T0 identity group is driven by
// the cured fixture tests/fixtures/identity-s1.json instead of the
// P2 package's own scratch assembly. Behavioral groups T1–T10 are
// byte-identical to the original battery.
const CAND = join(ROOT, "..", "candidate-tree");
// BASE keeps its original role: the pre-instrumentation deployed
// tree, the behavioral twin for the equivalence groups (a copy of
// instrumentation-spec/scratch/baseline-tree sits beside this file).
const BASE = join(HERE, "baseline-tree");
// PARTS takes the identity-reference role: the pinned pre-S1
// composed tree, against which the cured fixture measures the
// candidate's delta.
const PARTS = join(ROOT, "..", "baseline-tree");
const sha = (buf) =>
  createHash("sha256").update(buf).digest("hex");
const shaFile = (p) => sha(readFileSync(p));

function listFiles(dir, prefix = "") {
  const out = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${name.name}` : name.name;
    if (name.isDirectory()) out.push(...listFiles(join(dir, name.name), rel));
    else out.push(rel);
  }
  return out.sort();
}

// The spec §5.2 projection, implemented independently in the test
// from the spec text (allowlist order, sweep tallies numeric
// only, sweep-error presence flag). Used by T2 to check the
// recorded outcomes against driveOnce's actual return value.
const OUTCOME_KEYS = [
  "planId", "state", "stopReason", "grantId", "grantRefused",
  "skipped", "quarantined", "approvalRequired",
  "quarantineCheckFailed", "advanced",
];
const SWEEP_KEYS = ["scanned", "published", "noop", "conflicts", "pending"];
function projectOutcomes(outcomes) {
  const entries = [];
  for (const entry of outcomes) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry))
      continue;
    if (entry.bindingProjection &&
        typeof entry.bindingProjection === "object") {
      const sweep = {};
      for (const k of SWEEP_KEYS)
        if (typeof entry.bindingProjection[k] === "number")
          sweep[k] = entry.bindingProjection[k];
      entries.push({ bindingProjection: sweep });
      continue;
    }
    if ("bindingProjectionError" in entry) {
      entries.push({ bindingProjectionError: true });
      continue;
    }
    const o = {};
    for (const k of OUTCOME_KEYS) {
      const v = entry[k];
      if (typeof v === "string" || typeof v === "number" ||
          typeof v === "boolean") o[k] = v;
    }
    entries.push(o);
  }
  return entries;
}

const driveRows = (w) => w.db.prepare(
  `SELECT * FROM d6_drive_passes ORDER BY id`).all();
const tableExists = (w, name) => !!w.db.prepare(
  `SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
  .get(name);
const stripVolatile = (v) => {
  if (Array.isArray(v)) return v.map(stripVolatile);
  if (v && typeof v === "object") {
    const o = {};
    for (const [k, x] of Object.entries(v)) {
      if (k === "asOf" || k === "quotedAt") continue;
      o[k] = stripVolatile(x);
    }
    return o;
  }
  return v;
};

// ----------------------------------------------------------------
describe("T0 — assembly & identity (cured fixture, S1 regeneration)", () => {
  const FIXTURE = JSON.parse(readFileSync(
    join(ROOT, "fixtures", "identity-s1.json"), "utf8"));
  const CHANGED = FIXTURE.changedParts.map((p) => p.rel.replace(/^v2\//, ""));
  test("candidate tree: 31 parts; differ set == fixture changed parts; changed parts match fixture hashes; all others byte-identical to the pre-build tree", () => {
    const candFiles = listFiles(join(CAND, "v2"));
    const partFiles = listFiles(join(PARTS, "v2"));
    assert.equal(candFiles.length, 31);
    assert.deepEqual(candFiles, partFiles);
    const differ = partFiles.filter((rel) =>
      shaFile(join(PARTS, "v2", rel)) !== shaFile(join(CAND, "v2", rel)));
    assert.deepEqual(differ, CHANGED);
    for (const p of FIXTURE.changedParts)
      assert.equal(shaFile(join(CAND, p.rel)), p.sha256, p.rel);
  });

  test("patch round-trip: combined.diff applied to pristine parts reproduces the candidate byte-for-byte", () => {
    const tmp = "/tmp/battery-t0-roundtrip";
    rmSync(tmp, { recursive: true, force: true });
    for (const rel of CHANGED) {
      mkdirSync(dirname(join(tmp, "v2", rel)), { recursive: true });
      cpSync(join(PARTS, "v2", rel), join(tmp, "v2", rel));
    }
    if (CHANGED.length)
      execFileSync("patch", ["-s", "-p1",
        "-i", join(HERE, "combined.diff")], { cwd: tmp });
    for (const rel of CHANGED)
      assert.equal(shaFile(join(tmp, "v2", rel)),
        shaFile(join(CAND, "v2", rel)), rel);
  });

  test("node --check passes on every changed candidate part", () => {
    for (const rel of CHANGED)
      execFileSync("node", ["--check", join(CAND, "v2", rel)]);
  });

  test("identity-reference tree is the pinned pre-build tree (31/31 byte-identical to the fixture manifest)", () => {
    assert.equal(FIXTURE.baselineParts.length, 31);
    for (const p of FIXTURE.baselineParts)
      assert.equal(shaFile(join(PARTS, p.rel)), p.sha256, p.rel);
  });
});

// ----------------------------------------------------------------
describe("T1 — harness bring-up", () => {
  test("T1(a) empty store: class construction + first alarm resolve; no .one() bootstrap deadlock", async () => {
    const w = await makeWorld(CAND);
    await w.fireClassAlarm();
    assert.equal(tableExists(w, "d6_drive_passes"), true,
      "the recorder's lazy DDL creates the table on the first pass");
    const rows = driveRows(w);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].stage, "complete");
    assert.equal(rows[0].drive_invoked, 1);
    const diag = await w.service.drivePassDiagnostics({ drive: "1" });
    assert.equal(diag.tableState, "populated");
    assert.equal(diag.drivePasses.length, 1);
  });

  test("T1(b) seeded attempt-3 shape: plan/job/parked/conflicts/phase figures exact", async () => {
    const w = await makeWorld(CAND);
    const seed = await seedAttempt3Shape(w);
    const ps = w.service.planStatus(seed.planId);
    assert.equal(ps.state, "active");
    assert.deepEqual(ps.totals, { eligible: 1, done: 0, failed: 0,
      blocked: 0, prompts: 0 });
    assert.equal(ps.entries.length, 1);
    assert.equal(ps.entries[0].charCount, 569);
    assert.equal(ps.entries[0].disposition, "eligible");
    const job = w.db.prepare(
      `SELECT * FROM jobs WHERE job_id = ?`).get(seed.jobId);
    assert.equal(job.state, "queued");
    assert.equal(job.revision, 1);
    const occ = w.db.prepare(
      `SELECT state FROM occurrences WHERE job_id = ?`).get(seed.jobId);
    assert.equal(occ.state, "pending");
    const q = w.service.getQuarantine({ planId: seed.planId });
    assert.equal(q.held, false);
    const parked = w.db.prepare(
      `SELECT state, revision FROM jobs WHERE job_id = ?`)
      .get(PARKED_JOB);
    assert.deepEqual({ state: parked.state, revision: parked.revision },
      { state: "parked_policy", revision: 1 });
    const conflicts = w.db.prepare(
      `SELECT COUNT(*) AS n FROM binding_conflicts
        WHERE reason = 'schedule_dead'`).get();
    assert.equal(conflicts.n, 4);
    const pa = w.store.phaseAccounting(PHASE);
    assert.deepEqual(pa, { settledMicro: 1029420,
      inFlightUpperMicro: 0, unknownOpen: 0,
      estimatedUnverifiedMicro: 19018, reservedUnverifiedMicro: 5648 });
  });
});

// ----------------------------------------------------------------
describe("T2 — normal recording (twin equivalence)", () => {
  test("six alarm passes: candidate records each; all non-recorder state identical to the unmodified build", async () => {
    const a = await makeWorld(CAND);
    const b = await makeWorld(BASE);
    const seedA = await seedAttempt3Shape(a);
    const seedB = await seedAttempt3Shape(b);
    assert.equal(seedA.planId, seedB.planId,
      "intent-derived plan ids are deterministic across twins");
    assert.equal(
      snapshotDb(a.db, { exclude: ["d6_drive_passes", "d6_repair_events", "d6_repair_state"] }),
      snapshotDb(b.db, { exclude: ["d6_drive_passes", "d6_repair_events", "d6_repair_state"] }),
      "seeded twins start identical");
    // Shadow world for the pass-1 outcome comparison: base alarm
    // + recover + driveOnce composed manually (the class alarm's
    // own composition), capturing driveOnce's actual return.
    const s = await makeWorld(CAND);
    await seedAttempt3Shape(s);
    s.advance(10 * 60 * 1000);
    await s.coord.alarm();
    await s.service.recover();
    const returned = await s.service.driveOnce();
    for (let i = 1; i <= 6; i++) {
      a.advance(10 * 60 * 1000);
      b.advance(10 * 60 * 1000);
      await a.fireClassAlarm();
      await b.fireClassAlarm();
      assert.equal(
        snapshotDb(a.db, { exclude: ["d6_drive_passes", "d6_repair_events", "d6_repair_state"] }),
        snapshotDb(b.db, { exclude: ["d6_drive_passes", "d6_repair_events", "d6_repair_state"] }),
        `state diverged after pass ${i}`);
      const rows = driveRows(a);
      assert.equal(rows.length, i, `row count after pass ${i}`);
      const row = rows[i - 1];
      assert.equal(row.stage, "complete");
      assert.equal(row.drive_invoked, 1);
      assert.equal(row.error_name, null);
      assert.equal(row.error_message, null);
      assert.equal(row.outcomes_truncated, 0);
      assert.equal(typeof row.armed_after, "number");
      assert.equal(row.armed_after, a.alarmAt(),
        "armed_after is the post-pass getAlarm() readback");
      if (i === 1) {
        assert.deepEqual(JSON.parse(row.outcomes_json),
          projectOutcomes(returned),
          "recorded outcomes equal driveOnce's actual return, projected");
        const first = JSON.parse(row.outcomes_json)[0];
        assert.equal(first.grantId,
          `grant:${seedA.jobId}:1:full`,
          "pass 1 issues the grant under halt (the live trigger), recorded");
      }
    }
    const health = await a.storage.get("d6DrivePassRecorderHealth");
    assert.equal(health.recordingFailures, 0);
    assert.equal(typeof health.lastRecordedAt, "number");
    assert.equal(await b.storage.get("d6DrivePassRecorderHealth"),
      null, "the unmodified build has no health channel");
    assert.equal(tableExists(b, "d6_drive_passes"), false,
      "the unmodified build never creates the recorder table");
  });
});

// ----------------------------------------------------------------
describe("T2b — clock seam fallback (R-4)", () => {
  test("without env.now, recorded times track wall Date.now()", async () => {
    const w = await makeWorld(CAND, { envOverrides: { now: undefined } });
    const before = Date.now();
    await w.fireClassAlarm();
    const after = Date.now();
    const rows = driveRows(w);
    assert.equal(rows.length, 1);
    assert.ok(rows[0].at >= before && rows[0].at <= after,
      `at=${rows[0].at} within [${before}, ${after}]`);
  });
});

// ----------------------------------------------------------------
describe("T3 — stage capture & record-then-rethrow", () => {
  const named = (name, msg) => {
    const e = new Error(msg); e.name = name; return e;
  };
  async function faultCase({ fault, envOverrides, expectStage,
      expectName, identity, expectDriveInvoked = 0 }) {
    const w = await makeWorld(CAND, { envOverrides });
    await seedAttempt3Shape(w);
    if (fault) w.faults.sql = fault;
    let caught = null;
    try { await w.fireClassAlarm(); } catch (e) { caught = e; }
    assert.ok(caught, "the alarm must reject (record-then-rethrow)");
    if (identity) assert.equal(caught, fault.error,
      "the rethrown error is the identical object that was thrown");
    assert.equal(caught.name, expectName);
    const rows = driveRows(w);
    assert.equal(rows.length, 1);
    const row = rows[0];
    assert.equal(row.stage, expectStage);
    assert.equal(row.drive_invoked, expectDriveInvoked);
    // Twin equivalence: the SAME fault on the unmodified build
    // rejects identically and leaves identical durable state
    // (the instrumentation changes no fault behavior).
    const bw = await makeWorld(BASE, { envOverrides });
    await seedAttempt3Shape(bw);
    if (fault) bw.faults.sql = fault;
    let bCaught = null;
    try { await bw.fireClassAlarm(); } catch (e) { bCaught = e; }
    assert.ok(bCaught, "the unmodified build also rejects");
    assert.equal(bCaught.name, expectName);
    assert.equal(
      snapshotDb(w.db, { exclude: ["d6_drive_passes", "d6_repair_events", "d6_repair_state"] }),
      snapshotDb(bw.db, { exclude: ["d6_drive_passes", "d6_repair_events", "d6_repair_state"] }),
      "fault-pass state identical to the unmodified build");
    assert.equal(w.alarmAt(), bw.alarmAt(),
      "the base chain's re-arm behavior is unchanged");
    assert.equal(row.outcomes_json, null);
    assert.equal(row.error_name, expectName);
    assert.ok(row.error_message &&
      !/https?:\/\//.test(row.error_message),
      "the recorded message is scrubbed");
    // The recorder is not wedged: the next healthy pass records.
    w.faults.sql = null;
    w.advance(10 * 60 * 1000);
    if (!envOverrides) await w.fireClassAlarm();
    if (!envOverrides) {
      const rows2 = driveRows(w);
      assert.equal(rows2.length, 2);
      assert.equal(rows2[1].stage, "complete");
    }
    return w;
  }

  test("T3(i) throw in the base alarm's schedule processing -> stage base_alarm, identical object rethrown", async () => {
    const error = named("BatteryBaseError", "battery base fault");
    await faultCase({
      fault: { match: (q) => /FROM schedule/i.test(q), error },
      expectStage: "base_alarm", expectName: "BatteryBaseError",
      identity: true });
  });

  test("T3(ii) throw at cache construction -> stage construct", async () => {
    // The base alarm (OpalReaderCoordinator.alarm, worker-entry.js)
    // constructs the cache FIRST, inside super.alarm(); the
    // subclass's own construction step is the second construction.
    // A namespace fault present from the start therefore lands at
    // base_alarm (asserted in T3(iib)); the construct stage is
    // exercised by a fault that ARRIVES between the two
    // constructions — a counting env getter: first read (the base
    // alarm's) is clean, the second (the subclass's) throws.
    const w = await makeWorld(CAND);
    await seedAttempt3Shape(w);
    let reads = 0;
    Object.defineProperty(w.inst.env, "R2_KEY_PREFIX", {
      configurable: true,
      get() { reads++; return reads <= 1 ? "" : "bogus/"; },
    });
    let caught = null;
    try { await w.fireClassAlarm(); } catch (e) { caught = e; }
    assert.ok(caught, "the alarm must reject");
    assert.equal(caught.name, "ProductionR2NamespaceError");
    const rows = driveRows(w);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].stage, "construct");
    assert.equal(rows[0].drive_invoked, 0);
    assert.equal(rows[0].error_name, "ProductionR2NamespaceError");
  });

  test("T3(iib) a cache-namespace fault present from the start is recorded at base_alarm (the base alarm constructs the cache first)", async () => {
    await faultCase({
      fault: null,
      envOverrides: { R2_KEY_PREFIX: "bogus/" },
      expectStage: "base_alarm",
      expectName: "ProductionR2NamespaceError",
      identity: false });
  });

  test("T3(iii) throw in recover() -> stage recover, identical object rethrown", async () => {
    const error = named("BatteryRecoverError", "battery recover fault");
    await faultCase({
      fault: { match: (q) => /FROM d6_execution_records/i.test(q),
               error },
      expectStage: "recover", expectName: "BatteryRecoverError",
      identity: true });
  });

  test("T3(iv) throw in driveOnce -> stage drive, identical object rethrown", async () => {
    const error = named("BatteryDriveError", "battery drive fault");
    await faultCase({
      fault: { match: (q) => /FROM d6_plans/i.test(q), error },
      expectStage: "drive", expectName: "BatteryDriveError",
      identity: true, expectDriveInvoked: 1 });
  });
});

// ----------------------------------------------------------------
describe("T4 — recorder-fault injection (the recorder may never break the alarm)", () => {
  async function baseWorld() {
    const w = await makeWorld(CAND);
    const seed = await seedAttempt3Shape(w);
    return { w, seed };
  }
  const grantCount = (w, jobId) => w.db.prepare(
    `SELECT COUNT(*) AS n FROM grants WHERE job_id = ?`).get(jobId).n;
  const healthOf = (w) => w.kv.get("d6DrivePassRecorderHealth");

  test("T4 DDL fault: alarm resolves, drive effects happen, health notes step 'ddl', no row", async () => {
    const { w, seed } = await baseWorld();
    const error = new Error("battery ddl fault");
    w.faults.sql = {
      match: (q) => /CREATE TABLE IF NOT EXISTS d6_drive_passes/i.test(q),
      error };
    await w.fireClassAlarm(); // must resolve
    assert.equal(grantCount(w, seed.jobId), 1,
      "the drive pass still issued its grant");
    assert.equal(tableExists(w, "d6_drive_passes"), false);
    const health = healthOf(w);
    assert.equal(health.recordingFailures, 1);
    assert.equal(health.lastFailureStep, "ddl");
  });

  test("T4 INSERT fault: alarm resolves, health notes step 'insert', zero rows", async () => {
    const { w, seed } = await baseWorld();
    const error = new Error("battery insert fault");
    w.faults.sql = {
      match: (q) => /INSERT INTO d6_drive_passes/i.test(q), error };
    await w.fireClassAlarm();
    assert.equal(grantCount(w, seed.jobId), 1);
    assert.equal(tableExists(w, "d6_drive_passes"), true);
    assert.equal(driveRows(w).length, 0);
    const health = healthOf(w);
    assert.equal(health.recordingFailures, 1);
    assert.equal(health.lastFailureStep, "insert");
  });

  test("T4 PRUNE fault: count exceeds the cap for exactly one pass, then recovers to <= cap", async () => {
    const { w } = await baseWorld();
    for (let i = 0; i < 288; i++)
      await w.inst._recordDrivePass({
        at: T0 + i, stage: "complete", driveInvoked: true,
        outcomes: [], errorName: null, errorMessage: null });
    assert.equal(driveRows(w).length, 288);
    const error = new Error("battery prune fault");
    w.faults.sql = {
      match: (q) => /DELETE FROM d6_drive_passes/i.test(q), error };
    await w.fireClassAlarm();
    assert.equal(driveRows(w).length, 289,
      "one un-pruned pass above the cap");
    const health = healthOf(w);
    assert.equal(health.recordingFailures, 1);
    assert.equal(health.lastFailureStep, "prune");
    w.faults.sql = null;
    w.advance(10 * 60 * 1000);
    await w.fireClassAlarm();
    assert.equal(driveRows(w).length, 288,
      "the next healthy pass prunes back to the cap");
  });

  test("T4 getAlarm fault: row written with armed_after NULL and NO health increment (the shipped coordinator itself reads getAlarm, so the base chain — not the recorder — is what fails)", async () => {
    const { w, seed } = await baseWorld();
    const error = new Error("battery getalarm fault");
    w.faults.getAlarm = error;
    // GenerationCoordinator._armAlarmIfEarlier (coordinator.mjs)
    // reads storage.getAlarm() — and requestGrant's wake() calls
    // it on the grant path, inside driveOnce. The fault therefore
    // surfaces as a DRIVE-stage error row (the grant step's wake
    // throws before issuance) and the alarm rejects with the
    // identical object. The RECORDER's guarantees are what this
    // case pins: the row is still written, its armed_after is
    // NULL (the recorder's own isolated read), no recording
    // failure is counted, and no grant issued (zero spend).
    await assert.rejects(w.fireClassAlarm(), (e) => e === error);
    const rows = driveRows(w);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].stage, "drive");
    assert.equal(rows[0].drive_invoked, 1);
    assert.equal(rows[0].armed_after, null);
    assert.equal(grantCount(w, seed.jobId), 0,
      "the wake threw before grant issuance");
    const health = healthOf(w);
    assert.ok(health && health.recordingFailures === 0,
      "a getAlarm failure is not a recording failure");
  });

  test("T4 KV get fault (health read): alarm resolves, row written, drive effects normal; the channel self-heals on the next pass", async () => {
    const { w, seed } = await baseWorld();
    w.faults.kvGet = new Error("battery kv get fault");
    await w.fireClassAlarm();
    assert.equal(grantCount(w, seed.jobId), 1);
    assert.equal(driveRows(w).length, 1);
    assert.equal(driveRows(w)[0].stage, "complete");
    assert.equal(healthOf(w), undefined,
      "the health note could not complete; nothing was written");
    w.faults.kvGet = null;
    w.advance(10 * 60 * 1000);
    await w.fireClassAlarm();
    const health = healthOf(w);
    assert.ok(health && typeof health.lastRecordedAt === "number",
      "the next healthy pass's health note lands");
  });

  test("T4 KV put fault (health write): alarm resolves, row written, drive effects normal; the channel self-heals on the next pass", async () => {
    const { w, seed } = await baseWorld();
    w.faults.kvPut = new Error("battery kv put fault");
    await w.fireClassAlarm();
    assert.equal(grantCount(w, seed.jobId), 1);
    assert.equal(driveRows(w).length, 1);
    assert.equal(driveRows(w)[0].stage, "complete");
    assert.equal(healthOf(w), undefined);
    w.faults.kvPut = null;
    w.advance(10 * 60 * 1000);
    await w.fireClassAlarm();
    const health = healthOf(w);
    assert.ok(health && typeof health.lastRecordedAt === "number",
      "the next healthy pass's health note lands");
  });

  test("T4 serialize-step fault (wrapper level): the catch discipline names the step 'serialize'", async () => {
    const { w } = await baseWorld();
    // The projected structure is plain scalars by construction,
    // so serialization has no production failure mode; the step
    // is fault-injected at the wrapper level via a throwing
    // outcomes getter, proving a throw inside the serialize step
    // is caught and named, and never reaches the alarm.
    const error = new Error("battery serialize fault");
    const rec = { at: T0, stage: "complete", driveInvoked: true,
                  errorName: null, errorMessage: null };
    Object.defineProperty(rec, "outcomes", {
      get() { throw error; } });
    await w.inst._recordDrivePass(rec); // must not throw
    const health = healthOf(w);
    assert.equal(health.recordingFailures, 1);
    assert.equal(health.lastFailureStep, "serialize");
  });
});

// ----------------------------------------------------------------
describe("T5 — sanitization (write-time discipline + hostile storage on read)", () => {
  const SECRET = "S3cr3tT0kenValue0123456789abcdef";
  test("T5 write: hostile outcome values are grammar-checked or scrubbed; nothing raw is stored", async () => {
    const w = await makeWorld(CAND);
    await w.inst._recordDrivePass({
      at: T0, stage: "complete", driveInvoked: true,
      outcomes: [
        { planId: `https://evil.example/${SECRET}`,
          state: "active now",
          stopReason: `see https://x.example/${SECRET}`,
          grantId: "grant:job-battery:1:full",
          grantRefused: "quota_denied",
          jobId: "drop-me", grants: 5,
          nested: { a: 1 }, list: [1, 2],
          advanced: true, quarantined: false },
        { bindingProjection: { scanned: 3, published: "x", bogus: 9 } },
        { bindingProjectionError: `RAW ${SECRET}` },
        "not-an-object", 42, null,
      ],
      errorName: null, errorMessage: null });
    const row = driveRows(w)[0];
    const raw = row.outcomes_json;
    assert.ok(!raw.includes("evil.example"), "no URL survives");
    assert.ok(!raw.includes(SECRET), "no token-shaped run survives");
    assert.ok(!raw.includes("drop-me"), "non-allowlisted key dropped");
    assert.ok(!raw.includes("bogus"), "non-allowlisted sweep key dropped");
    assert.ok(!/[\u0000-\u001f]/.test(raw.replace(/\\./g, "")),
      "no control characters in the stored JSON");
    const parsed = JSON.parse(raw);
    assert.equal(parsed[0].grantId, "grant:job-battery:1:full",
      "a grammatical grantId is stored exactly");
    assert.equal(parsed[0].advanced, true);
    assert.equal(parsed[0].quarantined, false);
    assert.equal(parsed[0].grantRefused, "quota_denied",
      "a grammatical code token is stored exactly");
    assert.ok(!("jobId" in parsed[0]) && !("grants" in parsed[0]) &&
      !("nested" in parsed[0]) && !("list" in parsed[0]),
      "only scalar allowlisted values survive");
    assert.ok(parsed[0].planId.length <= 200);
    assert.deepEqual(parsed[1], { bindingProjection: { scanned: 3 } },
      "sweep entry: numeric allowlisted tallies only");
    assert.deepEqual(parsed[2], { bindingProjectionError: true },
      "the sweep error is a presence flag, never the raw string");
    const marker = parsed[parsed.length - 1];
    assert.ok(marker.truncated && marker.truncated.fieldsScrubbed === true,
      "scrubbing is disclosed by the terminal marker");
    assert.equal(row.outcomes_truncated, 1);
  });

  test("T5 write: error name/message scrubbed (URL, token run, control chars, caps)", async () => {
    const w = await makeWorld(CAND);
    await w.inst._recordDrivePass({
      at: T0, stage: "drive", driveInvoked: true, outcomes: null,
      errorName: `Error https://evil.example/x ${SECRET}`,
      errorMessage: (`boom ${SECRET} https://evil.example/leak` +
        " and\nnewline\ttab").repeat(6) });
    const row = driveRows(w)[0];
    assert.ok(!row.error_name.includes("evil.example"));
    assert.ok(!row.error_name.includes(SECRET));
    assert.ok(row.error_name.includes("[url]"));
    assert.ok(row.error_name.includes("[redacted]"));
    assert.ok(row.error_name.length <= 100);
    assert.ok(!row.error_message.includes("evil.example"));
    assert.ok(!row.error_message.includes(SECRET));
    assert.ok(!/[\u0000-\u001f]/.test(row.error_message),
      "control characters are flattened");
    assert.ok(row.error_message.length <= 500);
  });

  test("T5 write: an oversized grammatical identifier is sliced, and the slice is disclosed", async () => {
    const w = await makeWorld(CAND);
    await w.inst._recordDrivePass({
      at: T0, stage: "complete", driveInvoked: true,
      outcomes: [{ planId: `plan:${"a".repeat(500)}`, state: "active" }],
      errorName: null, errorMessage: null });
    const row = driveRows(w)[0];
    const parsed = JSON.parse(row.outcomes_json);
    assert.equal(parsed[0].planId.length, 200);
    assert.ok(parsed[0].planId.startsWith("plan:"));
    const marker = parsed[parsed.length - 1];
    assert.ok(marker.truncated && marker.truncated.fieldsSliced === true);
    assert.equal(row.outcomes_truncated, 1);
  });

  test("T5 read: hostile stored rows and a hostile health object never escape raw", async () => {
    const w = await makeWorld(CAND);
    await seedAttempt3Shape(w);
    await w.fireClassAlarm(); // creates the table (one clean row)
    const ins = w.db.prepare(`INSERT INTO d6_drive_passes
      (at, finished_at, stage, drive_invoked, outcomes_json,
       outcomes_truncated, error_name, error_message, armed_after)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    ins.run(T0 + 1, T0 + 1, "complete", 1,
      `NOT-JSON https://evil.example/${SECRET}`, 0, null, null, null);
    ins.run(T0 + 2, T0 + 2, "complete", 1,
      JSON.stringify([{ planId: `https://evil.example/${SECRET}`,
        hacker: "yes", state: "active" },
        { bindingProjection: { scanned: 1, evil: 2 } }]),
      0, null, null, null);
    ins.run(T0 + 3, T0 + 3, "complete", 1, '{"x":1}', 0, null, null, null);
    ins.run(T0 + 4, T0 + 4, "weird stage!", 1, null, 0,
      `Err https://evil.example/${SECRET}`,
      `msg ${SECRET} https://evil.example/x`, null);
    w.kv.set("d6DrivePassRecorderHealth", {
      recordingFailures: "lots", lastFailureAt: "whenever",
      lastFailureStep: "evil-step",
      lastFailureName: `https://evil.example/${SECRET}`,
      lastRecordedAt: 123, smuggled: "SMUGGLED-VALUE-9" });
    const diag = await w.service.drivePassDiagnostics({ drive: "1" });
    const whole = JSON.stringify(diag);
    assert.ok(!whole.includes("evil.example"), "no URL escapes");
    assert.ok(!whole.includes(SECRET), "no token-shaped run escapes");
    assert.ok(!whole.includes("SMUGGLED-VALUE-9"), "no smuggled key");
    assert.ok(!whole.includes("hacker"), "no non-allowlisted key");
    const byAt = new Map(diag.drivePasses.map((p) => [p.at, p]));
    const h1 = byAt.get(T0 + 1);
    assert.equal(h1.outcomes, null);
    assert.equal(h1.outcomesMalformed, true);
    assert.ok(!("outcomesRaw" in h1),
      "the response shape has no raw fallback field");
    const h2 = byAt.get(T0 + 2);
    assert.equal(h2.outcomesMalformed, false);
    assert.equal(h2.outcomesRevalidated, true,
      "re-projection changed the stored value and says so");
    assert.deepEqual(h2.outcomes[1], { bindingProjection: { scanned: 1 } });
    assert.ok(!("hacker" in h2.outcomes[0]));
    const h3 = byAt.get(T0 + 3);
    assert.equal(h3.outcomes, null);
    assert.equal(h3.outcomesMalformed, true,
      "valid JSON that is not an array is malformed for this shape");
    const h4 = byAt.get(T0 + 4);
    assert.equal(h4.stage, "unrecognized",
      "an out-of-vocabulary stage is reported as unrecognized");
    assert.ok(!h4.errorName.includes("evil.example"));
    assert.ok(!h4.errorMessage.includes(SECRET));
    assert.deepEqual(diag.recorderHealth, {
      recordingFailures: null, lastFailureAt: null,
      lastFailureStep: null, lastFailureName: "[url]",
      lastRecordedAt: 123 },
      "the health object is projected onto its five known fields");
  });
});

describe("T5b — identifier fidelity (real id shapes survive sanitization exactly)", () => {
  test("plan/grant ids and code tokens are stored byte-exact, with no marker", async () => {
    const w = await makeWorld(CAND);
    const planId = "plan:19cad189fab54b9c804a74a6";
    const grantId = `grant:${planId}:seg:1:full`;
    await w.inst._recordDrivePass({
      at: T0, stage: "complete", driveInvoked: true,
      outcomes: [{ planId, grantId, state: "active",
        stopReason: "phase_halted_unknown_billing",
        skipped: "execution_in_flight", advanced: true }],
      errorName: null, errorMessage: null });
    const row = driveRows(w)[0];
    assert.equal(row.outcomes_truncated, 0,
      "clean identifier outcomes need no marker");
    assert.deepEqual(JSON.parse(row.outcomes_json),
      [{ planId, grantId, state: "active",
         stopReason: "phase_halted_unknown_billing",
         skipped: "execution_in_flight", advanced: true }]);
    // And the read path returns them identically (no revalidation
    // churn on clean rows).
    const diag = await w.service.drivePassDiagnostics({ drive: "1" });
    assert.deepEqual(diag.drivePasses[0].outcomes,
      JSON.parse(row.outcomes_json));
    assert.equal(diag.drivePasses[0].outcomesRevalidated, false);
    assert.equal(diag.drivePasses[0].outcomesMalformed, false);
  });
});

// ----------------------------------------------------------------
describe("T6 — truncation at the 8,000-char cap", () => {
  const entry = (i) => ({
    planId: `plan:${String(i).padStart(24, "0")}`,
    grantId: `grant:plan:${String(i).padStart(24, "0")}:seg:1:full`,
    grantRefused: "r".repeat(150),
    state: "active", advanced: true });

  test("T6 over-cap: whole entries only, terminal marker, kept+dropped = submitted", async () => {
    const w = await makeWorld(CAND);
    const outcomes = Array.from({ length: 60 }, (_, i) => entry(i));
    await w.inst._recordDrivePass({
      at: T0, stage: "complete", driveInvoked: true, outcomes,
      errorName: null, errorMessage: null });
    const row = driveRows(w)[0];
    assert.ok(row.outcomes_json.length <= 8000,
      `stored length ${row.outcomes_json.length} <= 8000`);
    assert.equal(row.outcomes_truncated, 1);
    const parsed = JSON.parse(row.outcomes_json); // always valid JSON
    const marker = parsed[parsed.length - 1];
    assert.ok(marker.truncated, "terminal entry is the marker");
    assert.equal(marker.truncated.keptEntries, parsed.length - 1);
    assert.equal(
      marker.truncated.keptEntries + marker.truncated.droppedEntries,
      60);
    assert.ok(marker.truncated.keptEntries >= 1,
      "at least one whole entry always fits");
    assert.deepEqual(parsed[0], entry(0),
      "kept entries are whole and unaltered");
  });

  test("T6 under-cap: no marker, no flag, entries unaltered", async () => {
    const w = await makeWorld(CAND);
    const outcomes = [entry(1), entry(2), entry(3)];
    await w.inst._recordDrivePass({
      at: T0, stage: "complete", driveInvoked: true, outcomes,
      errorName: null, errorMessage: null });
    const row = driveRows(w)[0];
    assert.equal(row.outcomes_truncated, 0);
    assert.deepEqual(JSON.parse(row.outcomes_json), outcomes);
  });
});

// ----------------------------------------------------------------
describe("T7 — mode rejection (the read that can never blend modes)", () => {
  test("T7 ambiguous drive modes -> 400 diagnostics_mode_ambiguous; attempt mode unchanged; 403 without the operator stamp", async () => {
    const w = await makeWorld(CAND);
    const seed = await seedAttempt3Shape(w);
    await w.fireClassAlarm();
    const bad = [
      `/v2/d6-diagnostics?drive=1&planId=${seed.planId}`,
      `/v2/d6-diagnostics?drive=1&jobId=${seed.jobId}`,
      "/v2/d6-diagnostics?drive=1&cursor=abc",
      "/v2/d6-diagnostics?drive=1&drive=1",
      "/v2/d6-diagnostics?drive=2",
      "/v2/d6-diagnostics?drive=0",
      "/v2/d6-diagnostics?drive=true",
      "/v2/d6-diagnostics?drive=",
    ];
    for (const path of bad) {
      const r = await entryGet(w, path, { operator: true });
      assert.equal(r.status, 400, path);
      assert.equal(r.body?.reason, "diagnostics_mode_ambiguous", path);
      assert.ok(!("drivePasses" in (r.body ?? {})),
        "a rejected read carries no blended payload");
    }
    const noOperator = await entryGet(w, "/v2/d6-diagnostics?drive=1",
      { operator: false });
    assert.equal(noOperator.status, 403,
      "client credential alone never reaches the drive read");
    const noOperatorAttempt = await entryGet(w,
      `/v2/d6-diagnostics?planId=${seed.planId}`, { operator: false });
    assert.equal(noOperatorAttempt.status, 403,
      "attempt mode carries the same operator fence");
    const ok = await entryGet(w, "/v2/d6-diagnostics?drive=1",
      { operator: true });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.mode, "drive_passes");
    // Attempt mode is byte-shape unchanged: same keys as the
    // unmodified build serves for the same store state.
    const a = await entryGet(w,
      `/v2/d6-diagnostics?planId=${seed.planId}`, { operator: true });
    assert.equal(a.status, 200);
    const bw = await makeWorld(BASE);
    const bseed = await seedAttempt3Shape(bw);
    assert.equal(bseed.planId, seed.planId);
    const b = await entryGet(bw,
      `/v2/d6-diagnostics?planId=${bseed.planId}`, { operator: true });
    assert.equal(b.status, 200);
    assert.deepEqual(Object.keys(a.body).sort(),
      Object.keys(b.body).sort(),
      "attempt-mode response keys identical to the unmodified build");
    // The unmodified build has no drive mode at all.
    const bb = await entryGet(bw, "/v2/d6-diagnostics?drive=1",
      { operator: true });
    assert.ok(!("drivePasses" in (bb.body ?? {})));
  });
});

// ----------------------------------------------------------------
describe("T8 — retention & bursts", () => {
  test("T8 300 records prune to exactly the newest 288", async () => {
    const w = await makeWorld(CAND);
    for (let i = 0; i < 300; i++)
      await w.inst._recordDrivePass({
        at: T0 + i, stage: "complete", driveInvoked: true,
        outcomes: [], errorName: null, errorMessage: null });
    const rows = driveRows(w);
    assert.equal(rows.length, 288);
    assert.equal(rows[0].at, T0 + 12, "the oldest retained is #13");
    assert.equal(rows[rows.length - 1].at, T0 + 299,
      "the newest record is retained");
  });

  test("T8 burst of seven throwing passes: every pass recorded, cap holds throughout", async () => {
    const w = await makeWorld(CAND);
    await seedAttempt3Shape(w);
    for (let i = 0; i < 288; i++)
      await w.inst._recordDrivePass({
        at: T0 + i, stage: "complete", driveInvoked: true,
        outcomes: [], errorName: null, errorMessage: null });
    assert.equal(driveRows(w).length, 288);
    const error = new Error("battery burst fault");
    w.faults.sql = {
      match: (q) => /FROM d6_plans/i.test(q), error };
    for (let i = 0; i < 7; i++) {
      w.advance(60 * 1000);
      await assert.rejects(w.fireClassAlarm(),
        (e) => e === error);
      assert.equal(driveRows(w).length, 288,
        `cap holds after throwing pass ${i + 1}`);
    }
    const newest = w.db.prepare(
      `SELECT stage, error_name FROM d6_drive_passes
        ORDER BY id DESC LIMIT 7`).all();
    assert.ok(newest.every((r) => r.stage === "drive" &&
      r.error_name === "Error"),
      "all seven throwing passes are the newest records");
  });
});

// ----------------------------------------------------------------
describe("T9 — round-trip & cross-part contract (end-to-end diagnostics forwarding)", () => {
  test("T9 route read returns exactly the recorded rows; health key contract holds; crash-instance records", async () => {
    const w = await makeWorld(CAND);
    // Before any pass: the table is missing, honestly reported.
    const before = await entryGet(w, "/v2/d6-diagnostics?drive=1",
      { operator: true });
    assert.equal(before.status, 200);
    assert.equal(before.body.tableState, "missing");
    assert.equal(before.body.found, false);
    assert.equal(before.body.recorderHealth, null);
    await seedAttempt3Shape(w);
    w.advance(10 * 60 * 1000);
    await w.fireClassAlarm();
    // One throwing pass (drive fault) for an error row.
    const error = new Error("battery t9 drive fault");
    w.faults.sql = {
      match: (q) => /FROM d6_plans/i.test(q), error };
    w.advance(10 * 60 * 1000);
    await assert.rejects(w.fireClassAlarm(), (e) => e === error);
    w.faults.sql = null;
    // A fresh instance over the same storage (crash/restart)
    // records the next pass.
    const inst2 = w.crash();
    w.advance(10 * 60 * 1000);
    await inst2.alarm();
    const stored = w.db.prepare(
      `SELECT * FROM d6_drive_passes ORDER BY id DESC`).all();
    assert.equal(stored.length, 3);
    assert.equal(stored[1].stage, "drive");
    const r = await entryGet(w, "/v2/d6-diagnostics?drive=1",
      { operator: true });
    assert.equal(r.status, 200);
    assert.equal(r.body.mode, "drive_passes");
    assert.equal(r.body.tableState, "populated");
    assert.equal(r.body.found, true);
    assert.equal(r.body.drivePasses.length, 3);
    for (let i = 0; i < 3; i++) {
      const p = r.body.drivePasses[i];
      const s = stored[i];
      assert.equal(p.id, s.id);
      assert.equal(p.at, s.at);
      assert.equal(p.stage, s.stage);
      assert.equal(p.driveInvoked, s.drive_invoked === 1);
      assert.deepEqual(p.outcomes,
        s.outcomes_json === null ? null : JSON.parse(s.outcomes_json),
        "clean stored rows round-trip exactly");
      assert.equal(p.outcomesMalformed, false);
      assert.equal(p.outcomesRevalidated, false);
      assert.equal(p.outcomesTruncated, s.outcomes_truncated === 1);
      assert.equal(p.armedAfter, s.armed_after);
    }
    // Alarm block agrees with the harness's own state.
    assert.equal(r.body.alarm.armedAt, w.alarmAt());
    const pending = w.db.prepare(
      `SELECT COUNT(*) AS n FROM schedule WHERE state = 'pending'`)
      .get().n;
    assert.equal(r.body.alarm.pendingSchedule, pending);
    // Health round-trips exactly, and the key literal in the
    // entry part is the key the service reads (cross-part
    // contract, pinned by source inspection + behavior).
    const health = await w.storage.get("d6DrivePassRecorderHealth");
    assert.deepEqual(r.body.recorderHealth, health);
    const entrySrc = readFileSync(
      join(CAND, "v2", "worker-entry-prod-d6.js"), "utf8");
    const m = entrySrc.match(/DRIVE_PASS_HEALTH_KEY = "([^"]+)"/);
    assert.ok(m, "health key constant present in the entry part");
    assert.equal(m[1], "d6DrivePassRecorderHealth");
    assert.ok(w.kv.has(m[1]), "the recorder wrote under that key");
    const serviceSrc = readFileSync(
      join(CAND, "v2", "generation", "service.mjs"), "utf8");
    assert.ok(serviceSrc.includes(`"d6DrivePassRecorderHealth"`),
      "the service reads the same literal key");
  });
});

// ----------------------------------------------------------------
describe("T10 — shipped-surface equivalence smoke", () => {
  test("twin stores: every shipped read surface answers field-for-field identically", async () => {
    const a = await makeWorld(CAND);
    const b = await makeWorld(BASE);
    const seedA = await seedAttempt3Shape(a);
    const seedB = await seedAttempt3Shape(b);
    a.advance(10 * 60 * 1000);
    b.advance(10 * 60 * 1000);
    await a.fireClassAlarm();
    await b.fireClassAlarm();
    const paths = [
      "/v2/generation/capabilities",
      "/v2/d6-plans",
      `/v2/d6-plans/${seedA.planId}`,
      `/v2/d6-eligibility?bookId=${BOOK}&scope=chapter&chapterIndex=2`,
      `/v2/d6-eligibility?bookId=${BOOK}&scope=segment&occurrenceId=${OCC26}`,
      `/v2/d6-eligibility?bookId=${BOOK}&scope=book`,
      "/v2/quota",
      "/v2/conflicts",
    ];
    for (const path of paths) {
      const ra = await entryGet(a, path);
      const rb = await entryGet(b, path);
      assert.equal(ra.status, rb.status, `${path} status`);
      assert.deepEqual(stripVolatile(ra.body), stripVolatile(rb.body),
        `${path} body`);
    }
    const da = await entryGet(a,
      `/v2/d6-diagnostics?planId=${seedA.planId}`, { operator: true });
    const db2 = await entryGet(b,
      `/v2/d6-diagnostics?planId=${seedB.planId}`, { operator: true });
    assert.equal(da.status, db2.status);
    assert.deepEqual(stripVolatile(da.body), stripVolatile(db2.body),
      "attempt-mode diagnostics body");
  });
});

// ----------------------------------------------------------------
// A-1 GUARD (see the adaptation note at the head of this file):
// the repair machinery is inert under ordinary P2 traffic.
describe("A-1 guard — repair tables untouched by ordinary traffic", () => {
  test("six alarm passes write no repair events and leave the singleton initial", async () => {
    const w = await makeWorld(CAND);
    await seedAttempt3Shape(w);
    for (let i = 0; i < 6; i++) {
      w.advance(10 * 60 * 1000);
      await w.fireClassAlarm();
    }
    const ev = w.db.prepare(
      "SELECT COUNT(*) AS n FROM d6_repair_events").get();
    assert.equal(ev.n, 0);
    const st = w.db.prepare(
      "SELECT projection_strikes, last_evaluation_id FROM d6_repair_state WHERE id = 1").get();
    assert.equal(st.projection_strikes, 0);
    assert.equal(st.last_evaluation_id, null);
  });
});
