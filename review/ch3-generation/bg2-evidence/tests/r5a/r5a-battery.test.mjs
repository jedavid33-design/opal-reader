// R5A revised-design battery (Rowan ruling 6584187105 assignment,
// offline evidence phase). Runs against the EXACT offline candidate
// tree in ../candidate-tree (the live instrumented build's 31 parts
// with v2/coordinator.mjs revised: permanent past-due disjunct with
// stale-age threshold + per-operation arm-memo dedupe), with the
// unmodified live tree in ../baseline-tree as twin. Local scratch
// only: no network, no production calls.
// Run: node --test r5a-battery.test.mjs
//
// Harness caveat (standing): the harness invokes alarm() directly;
// it cannot prove real platform delivery, real platform retry
// behavior, or real-DO SQLite behavior beyond its mirrored .one()
// throw semantics.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  readFileSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import {
  makeWorld, seedAttempt3Shape, snapshotDb, entryGet, T0,
} from "./harness.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
// B-G2 SCAFFOLDING ADAPTATION (disclosed in the implementation
// record): this copy runs against the B-G2 build's trees — CAND is
// the B-G2 candidate tree, BASE the pinned pre-build composed tree —
// and its identity expectations come from the cured fixture
// tests/fixtures/identity-bg2.json (the original battery pinned the
// R5A candidate's coordinator hash, which is stale on any later
// tree). Behavioral groups R5A-T1+ are byte-identical to the
// original battery.
const CAND = join(ROOT, "..", "candidate-tree");
// BASE keeps its original role: the live instrumented build, the
// behavioral twin (a copy of r5a-revision/baseline-tree sits beside
// this file). PARTS is the identity reference: the pinned pre-B-G2
// composed tree, against which the cured fixture measures the
// candidate's delta.
const BASE = join(HERE, "baseline-tree");
const PARTS = join(ROOT, "..", "baseline-tree");
const DIFF = join(HERE, "coordinator.diff");
const shaFile = (p) =>
  createHash("sha256").update(readFileSync(p)).digest("hex");
const FIXTURE = JSON.parse(readFileSync(
  join(ROOT, "fixtures", "identity-bg2.json"), "utf8"));
const CHANGED_RELS = FIXTURE.changedParts.map((p) => p.rel);
const CAND_COORD_SHA = (FIXTURE.changedParts.find(
  (p) => p.rel === "v2/coordinator.mjs") || FIXTURE.baselineParts.find(
  (p) => p.rel === "v2/coordinator.mjs")).sha256;
const HOUR = 60 * 60 * 1000;
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

// Boot a world: one class alarm on the empty store creates the full
// schema (coordinator + subclass), the first watchdog row, and the
// first registration. Tests then reshape the schedule directly.
async function boot(tree) {
  const w = await makeWorld(tree);
  await w.fireClassAlarm();
  w.clearAlarmCalls();
  return w;
}
function setSchedule(w, rows) {
  w.db.prepare(`DELETE FROM schedule`).run();
  const ins = w.db.prepare(
    `INSERT INTO schedule (due_at, kind, ref, payload_json, attempts, state)
     VALUES (?, ?, NULL, '{}', 0, 'pending')`);
  for (const [due, kind] of rows) ins.run(due, kind);
}
const schedCount = (w) =>
  w.db.prepare(`SELECT COUNT(*) AS n FROM schedule`).get().n;
const minDue = (w) =>
  w.db.prepare(`SELECT MIN(due_at) AS d FROM schedule WHERE state='pending'`).get().d;
const grants = (w) => w.db.prepare(`SELECT * FROM grants`).all();

// ----------------------------------------------------------------
describe("R5A-T0 — assembly & identity", () => {
  test("31 parts; differ set vs the pre-build tree == the cured fixture's changed parts", () => {
    const cand = listFiles(CAND), base = listFiles(PARTS);
    assert.equal(cand.length, 31);
    assert.deepEqual(cand, base);
    const differ = cand.filter((f) => shaFile(join(CAND, f)) !== shaFile(join(PARTS, f)));
    assert.deepEqual(differ, CHANGED_RELS);
  });
  test("candidate coordinator identity + design markers", () => {
    assert.equal(shaFile(join(CAND, "v2/coordinator.mjs")), CAND_COORD_SHA);
    const src = readFileSync(join(CAND, "v2/coordinator.mjs"), "utf8");
    assert.match(src, /ALARM_STALE_THRESHOLD_MS = 60 \* 60 \* 1000/);
    assert.match(src, /armed <= now - ALARM_STALE_THRESHOLD_MS/);
    assert.match(src, /armMemo/);
    // (The original battery also asserted the markers' ABSENCE in
    // its baseline; the B-G2 baseline is the composed tree, which
    // already carries the R5A revision, so that assertion does not
    // translate — disclosed in the implementation record.)
  });
  test("patch round-trip: coordinator.diff applied to the pristine part reproduces the candidate byte-for-byte", () => {
    const tmp = mkdtempSync(join(tmpdir(), "r5a-roundtrip-"));
    mkdirSync(join(tmp, "v2"));
    writeFileSync(join(tmp, "v2/coordinator.mjs"),
      readFileSync(join(PARTS, "v2/coordinator.mjs")));
    if (readFileSync(DIFF, "utf8").length > 0) {
      const r = spawnSync("patch", ["-p1", "-i", DIFF], { cwd: tmp, encoding: "utf8" });
      assert.equal(r.status, 0, r.stdout + r.stderr);
    }
    assert.equal(shaFile(join(tmp, "v2/coordinator.mjs")), CAND_COORD_SHA);
  });
  test("node --check passes on the candidate coordinator", () => {
    const r = spawnSync(process.execPath,
      ["--check", join(CAND, "v2/coordinator.mjs")], { encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
  });
});

// ----------------------------------------------------------------
describe("R5A-T1 — normal future alarms (legacy behavior preserved)", () => {
  test("armed == due (future): wake registers nothing; earlier due advances once; then quiet", async () => {
    const w = await boot(CAND);
    const now = w.clock.now;
    setSchedule(w, [[now + 600000, "watchdog"]]);
    w.seedAlarm(now + 600000);
    await w.coord.wake();
    assert.equal(w.alarmCalls.length, 0);
    // Earlier pending work appears: the legacy advance must fire.
    setSchedule(w, [[now + 600000, "watchdog"], [now + 300000, "lease"]]);
    await w.coord.wake();
    assert.equal(w.alarmCalls.length, 1);
    assert.equal(w.alarmCalls[0].value, now + 300000);
    // Armed now equals due: quiet again.
    await w.coord.wake();
    assert.equal(w.alarmCalls.length, 1);
  });
  test("armed null: wake registers at due exactly as shipped", async () => {
    const w = await boot(CAND);
    const now = w.clock.now;
    setSchedule(w, [[now + 600000, "watchdog"]]);
    w.seedAlarm(null);
    await w.coord.wake();
    assert.equal(w.alarmCalls.length, 1);
    assert.equal(w.alarmCalls[0].value, now + 600000);
  });
});

// ----------------------------------------------------------------
describe("R5A-T2 — stale armed, B1 shape (D = A), via the R2-form command", () => {
  test("exactly one setAlarm for the whole command wake; exactly one commands row; no other movement", async () => {
    const w = await boot(CAND);
    const now = w.clock.now;
    const A = now - 20 * HOUR;
    setSchedule(w, [[A, "lease"], [A + HOUR, "watchdog"]]);
    w.seedAlarm(A);
    const before = schedCount(w);
    const res = await w.coord.handleCommand({
      command_id: "r5a-t2-cmd", type: "RequestPause",
      payload: { jobId: "alarm-wake-probe:nonexistent" },
    });
    assert.equal(res.outcome, "rejected");
    assert.equal(res.reason, "job_not_found");
    assert.equal(w.alarmCalls.length, 1,
      `expected exactly 1 setAlarm, got ${JSON.stringify(w.alarmCalls)}`);
    assert.equal(w.alarmCalls[0].value, A); // re-registered at D = A
    const cmds = w.db.prepare(`SELECT * FROM commands`).all();
    assert.equal(cmds.length, 1);
    assert.equal(cmds[0].command_id, "r5a-t2-cmd");
    assert.equal(schedCount(w), before); // no schedule growth
    assert.equal(grants(w).length, 0); // no pass ran: nothing issued
  });
});

// ----------------------------------------------------------------
describe("R5A-T3 — retry-gap safeguard (stale-age threshold)", () => {
  async function shape(w, ageMs) {
    const now = w.clock.now;
    const A = now - ageMs;
    setSchedule(w, [[A, "lease"], [A + HOUR, "watchdog"]]);
    w.seedAlarm(A);
    return A;
  }
  test("armed 5 minutes past due (inside a plausible retry gap): NO re-registration", async () => {
    const w = await boot(CAND);
    await shape(w, 5 * MIN);
    await w.coord.wake();
    assert.equal(w.alarmCalls.length, 0);
  });
  test("armed 59 minutes past due: still NO re-registration", async () => {
    const w = await boot(CAND);
    await shape(w, 59 * MIN);
    await w.coord.wake();
    assert.equal(w.alarmCalls.length, 0);
  });
  test("armed exactly at the threshold boundary (60 min): re-registers (boundary is inclusive)", async () => {
    const w = await boot(CAND);
    const A = await shape(w, 60 * MIN);
    await w.coord.wake();
    assert.equal(w.alarmCalls.length, 1);
    assert.equal(w.alarmCalls[0].value, A);
  });
  test("armed 61 minutes past due: re-registers at D", async () => {
    const w = await boot(CAND);
    const A = await shape(w, 61 * MIN);
    await w.coord.wake();
    assert.equal(w.alarmCalls.length, 1);
    assert.equal(w.alarmCalls[0].value, A);
  });
  test("baseline twin at 61 minutes: shipped condition does NOT re-register (the delta is exactly the new disjunct)", async () => {
    const w = await boot(BASE);
    await shape(w, 61 * MIN);
    await w.coord.wake();
    assert.equal(w.alarmCalls.length, 0);
  });
});

// ----------------------------------------------------------------
describe("R5A-T4 — dedupe within a single wake operation", () => {
  test("wake + post-apply evaluation with unchanged schedule: 1 registration total", async () => {
    const w = await boot(CAND);
    const now = w.clock.now;
    const A = now - 20 * HOUR;
    setSchedule(w, [[A, "lease"], [A + HOUR, "watchdog"]]);
    w.seedAlarm(A);
    const memo = { registered: false, armedAfter: null };
    await w.coord.wake(memo);
    await w.coord._armAlarmIfEarlier(memo);
    assert.equal(w.alarmCalls.length, 1);
    assert.equal(w.alarmCalls[0].value, A);
  });
  test("corrective second registration ONLY when the operation schedules strictly earlier work", async () => {
    const w = await boot(CAND);
    const now = w.clock.now;
    const A = now - 20 * HOUR;
    setSchedule(w, [[A, "lease"], [A + HOUR, "watchdog"]]);
    w.seedAlarm(A);
    const memo = { registered: false, armedAfter: null };
    await w.coord.wake(memo);
    assert.equal(w.alarmCalls.length, 1);
    // The operation schedules work strictly earlier than registered:
    setSchedule(w, [[A - 1000, "retry_grant"], [A, "lease"], [A + HOUR, "watchdog"]]);
    await w.coord._armAlarmIfEarlier(memo);
    assert.equal(w.alarmCalls.length, 2);
    assert.equal(w.alarmCalls[1].value, A - 1000);
    assert.ok(w.alarmCalls[1].value < w.alarmCalls[0].value);
    // A third evaluation with no earlier work: no third registration.
    await w.coord._armAlarmIfEarlier(memo);
    assert.equal(w.alarmCalls.length, 2);
  });
  test("handleReport path also dedupes (replayed report on a reported grant)", async () => {
    const w = await boot(CAND);
    const now = w.clock.now;
    const A = now - 20 * HOUR;
    // Minimal reported grant for the replay short-circuit.
    w.db.prepare(`INSERT INTO jobs (job_id, kind, book_id, chapter_index, lane, state, revision, data_json, created_at, updated_at)
      VALUES ('job-t4', 'job', 'book-battery', 2, 'standard', 'generating', 2, '{}', ?, ?)`)
      .run(now, now);
    w.db.prepare(`INSERT INTO grants (grant_id, job_id, revision, state, created_at)
      VALUES ('grant-t4', 'job-t4', 2, 'reported', ?)`)
      .run(now);
    setSchedule(w, [[A, "lease"], [A + HOUR, "watchdog"]]);
    w.seedAlarm(A);
    const res = await w.coord.handleReport({ grantId: "grant-t4", results: [] });
    assert.equal(res.ok, true);
    assert.equal(res.replayed, true);
    assert.equal(w.alarmCalls.length, 1);
    assert.equal(w.alarmCalls[0].value, A);
  });
});

// ----------------------------------------------------------------
describe("R5A-T5 — B3 schedule ordering", () => {
  test("B3-future beyond threshold: stale A is moved to the actual earliest future D (board ruling decision 2)", async () => {
    const w = await boot(CAND);
    const now = w.clock.now;
    const F = now + 30 * MIN;
    setSchedule(w, [[F, "lease"], [F + HOUR, "watchdog"]]);
    w.seedAlarm(now - 20 * HOUR);
    await w.coord.wake();
    assert.equal(w.alarmCalls.length, 1);
    assert.equal(w.alarmCalls[0].value, F);
    assert.equal(w.alarmAt(), F);
  });
  test("B3-future inside the retry-gap threshold: shipped behavior — no registration, future D stands untouched", async () => {
    const w = await boot(CAND);
    const now = w.clock.now;
    const F = now + 30 * MIN;
    setSchedule(w, [[F, "lease"], [F + HOUR, "watchdog"]]);
    w.seedAlarm(now - 30 * MIN); // past, but inside the safeguard window
    await w.coord.wake();
    assert.equal(w.alarmCalls.length, 0);
    assert.equal(w.alarmAt(), now - 30 * MIN);
  });
  test("D computation uses ALL pending kinds: an earlier retry_grant row, not the watchdog, sets the registration", async () => {
    const w = await boot(CAND);
    const now = w.clock.now;
    setSchedule(w, [[now + 600000, "watchdog"], [now + 30000, "retry_grant"], [now + 900000, "lease"]]);
    w.seedAlarm(now - 20 * HOUR);
    await w.coord.wake();
    assert.equal(w.alarmCalls.length, 1);
    assert.equal(w.alarmCalls[0].value, now + 30000);
  });
});

// ----------------------------------------------------------------
describe("R5A-T6 — unexpected revival under the holds (seeded preserved-plan shape)", () => {
  test("stimulus registers once; the delivered pass issues exactly the pre-classified grant set; the chain then self-terminates the 5a branch", async () => {
    const w = await makeWorld(CAND);
    const seed = await seedAttempt3Shape(w);
    assert.equal(w.classEnv.GENERATION_HALT, "1");
    const D = minDue(w);
    assert.ok(D !== null);
    w.seedAlarm(w.clock.now - 20 * HOUR); // stale A, B3-future shape (D is future)
    w.clearAlarmCalls();
    const res = await w.coord.handleCommand({
      command_id: "r5a-t6-cmd", type: "RequestPause",
      payload: { jobId: "alarm-wake-probe:nonexistent" },
    });
    assert.equal(res.outcome, "rejected");
    assert.equal(w.alarmCalls.length, 1);
    assert.equal(w.alarmCalls[0].value, D);
    // No pass has run yet: nothing issued (stop-state, see also T8).
    assert.equal(grants(w).length, 0);
    // Deliver: advance to D and fire.
    w.advance(D - w.clock.now + 1000);
    await w.fireClassAlarm();
    const g = grants(w);
    assert.equal(g.length, 1, `expected exactly 1 grant, got ${g.length}`);
    assert.equal(g[0].state, "issued");
    const job = w.db.prepare(`SELECT * FROM jobs WHERE job_id = ?`).get(seed.jobId);
    assert.equal(job.state, "generating");
    const occ = w.db.prepare(
      `SELECT * FROM occurrences WHERE job_id = ?`).get(seed.jobId);
    assert.equal(occ.state, "granted");
    // Nothing left the outbox: no queue dispatch under the halt.
    assert.equal(w.queue.sent.length, 0);
    // The pass was recorded by the P2 recorder.
    const rows = w.db.prepare(`SELECT * FROM d6_drive_passes`).all();
    assert.ok(rows.length >= 1);
    // The base finally re-armed into the future; a further wake is quiet.
    assert.ok(w.alarmAt() > w.clock.now);
    const n = w.alarmCalls.length;
    await w.coord.wake();
    assert.equal(w.alarmCalls.length, n);
  });
});

// ----------------------------------------------------------------
describe("R5A-T7 — repeated wakes, delivery never happens (churn bound)", () => {
  test("10 wakes -> exactly 10 registrations, all at D, zero schedule growth, zero watchdog duplication", async () => {
    const w = await boot(CAND);
    const now = w.clock.now;
    const A = now - 20 * HOUR;
    setSchedule(w, [[A, "watchdog"]]);
    w.seedAlarm(A);
    const before = schedCount(w);
    for (let i = 0; i < 10; i++) await w.coord.wake();
    assert.equal(w.alarmCalls.length, 10);
    assert.ok(w.alarmCalls.every((c) => c.value === A));
    assert.equal(schedCount(w), before);
    const wd = w.db.prepare(
      `SELECT COUNT(*) AS n FROM schedule WHERE kind='watchdog' AND state='pending'`).get();
    assert.equal(wd.n, 1);
    assert.equal(grants(w).length, 0);
  });
});

// ----------------------------------------------------------------
describe("R5A-T8 — stop behavior + preserved-plan integrity (stimulus with NO delivery)", () => {
  test("after the R2-form stimulus and no alarm firing: only the commands row changed; plan, job, occurrence, figures byte-identical", async () => {
    const w = await makeWorld(CAND);
    const seed = await seedAttempt3Shape(w);
    // No alarm is fired in this test at all: firing one would run a
    // drive pass and issue the grant (that is T6's subject). The
    // recorder table simply does not exist in either snapshot.
    const before = snapshotDb(w.db, { exclude: ["commands", "schedule"] });
    const schedBefore = w.db.prepare(`SELECT * FROM schedule ORDER BY id`).all()
      .map((r) => JSON.stringify(r, Object.keys(r).sort())).join("\n");
    w.seedAlarm(w.clock.now - 20 * HOUR);
    w.clearAlarmCalls();
    const cmdCountBefore = w.db.prepare(`SELECT COUNT(*) AS n FROM commands`).get().n;
    const res = await w.coord.handleCommand({
      command_id: "r5a-t8-cmd", type: "RequestPause",
      payload: { jobId: "alarm-wake-probe:nonexistent" },
    });
    assert.equal(res.outcome, "rejected");
    assert.equal(w.alarmCalls.length, 1); // the registration itself
    const after = snapshotDb(w.db, { exclude: ["commands", "schedule"] });
    assert.equal(after, before);
    const schedAfter = w.db.prepare(`SELECT * FROM schedule ORDER BY id`).all()
      .map((r) => JSON.stringify(r, Object.keys(r).sort())).join("\n");
    assert.equal(schedAfter, schedBefore); // watchdog already pending: wake inserted nothing
    const cmds = w.db.prepare(`SELECT * FROM commands`).all();
    assert.equal(cmds.length, cmdCountBefore + 1,
      "exactly one NEW commands row from the stimulus");
    assert.equal(
      cmds.filter((c) => c.command_id === "r5a-t8-cmd").length, 1);
    assert.equal(grants(w).length, 0);
    const job = w.db.prepare(`SELECT * FROM jobs WHERE job_id = ?`).get(seed.jobId);
    assert.equal(job.state, "queued");
    assert.equal(job.revision, 1);
  });
});

// ----------------------------------------------------------------
describe("R5A-T9 — shipped-surface equivalence spot checks", () => {
  test("drive=1 diagnostics read performs no wake and no registration (candidate)", async () => {
    const w = await makeWorld(CAND);
    const seed = await seedAttempt3Shape(w);
    w.seedAlarm(w.clock.now - 20 * HOUR);
    w.clearAlarmCalls();
    const r = await entryGet(w, "/v2/d6-diagnostics?drive=1",
      { operator: true });
    assert.equal(r.status, 200);
    assert.equal(w.alarmCalls.length, 0);
  });
  test("future-alarm behavior identical on baseline and candidate (call sequences match)", async () => {
    const script = async (tree) => {
      const w = await boot(tree);
      const now = w.clock.now;
      setSchedule(w, [[now + 600000, "watchdog"]]);
      w.seedAlarm(now + 600000);
      await w.coord.wake();
      setSchedule(w, [[now + 600000, "watchdog"], [now + 300000, "lease"]]);
      await w.coord.wake();
      await w.coord.wake();
      return w.alarmCalls.map((c) => c.value);
    };
    assert.deepEqual(await script(CAND), await script(BASE));
  });
});
