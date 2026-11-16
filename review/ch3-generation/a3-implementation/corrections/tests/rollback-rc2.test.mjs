// Rollback candidate evidence (HOLD ruling R6(c)): the
// rollback tree (pre-A-3 build + the A-3 recorder + the
// corrected RC-2 derivation, scheduler and shared-drive
// machinery removed) against the RC-2-focused cases.
//
//   RB-1  the tree carries no scheduler surface (no scheduled
//         export, no scheduler tables are ever created);
//   RB-2  on a positively established pre-migration store the
//         corrected derivation applies legacy semantics;
//   RB-3  the rollback recorder runs the migration itself
//         (watermark + seq backfill) and writes well-formed
//         extended rows (native kind, durable seq,
//         assurance_outcome 'not_required' — this build has no
//         exit assurance and claims none);
//   RB-4  derivations are identical across the migration, and
//         the A-3 CANDIDATE's derivation accepts evidence the
//         rollback recorder wrote (the evidence-compatibility
//         proof I6 requires of a rollback candidate);
//   RB-5  the corrected fail-closed read (R2) is the one in
//         this tree: an injected extended-read failure yields
//         no discharge and an unverified recorder.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { makeWorld, entryPost } from "./harness.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROLLBACK = join(HERE, "..", "rollback-tree");
const CAND = process.env.A3_CAND_DIR ?? join(HERE, "..", "candidate-tree");
const T0 = 1762000000000;

async function registeringEval(w) {
  const prev = w.inst.env.GENERATION_HALT;
  const prevClass = w.classEnv.GENERATION_HALT;
  w.inst.env.GENERATION_HALT = "1";
  w.classEnv.GENERATION_HALT = "1";
  w.seedAlarm(T0 - 2 * 3600000);
  const r = await entryPost(w, "/v2/d6-repair-evaluate",
    { action: "evaluate_repair", authorizationRef: "battery:rollback",
      reason: "rollback battery evaluation" },
    { operator: true, client: false });
  w.inst.env.GENERATION_HALT = prev;
  w.classEnv.GENERATION_HALT = prevClass;
  assert.equal(r.body.outcome, "registered", JSON.stringify(r.body));
  return r.body;
}
const latestIntentId = (w) => w.db.prepare(
  `SELECT MAX(id) AS id FROM d6_repair_events
    WHERE kind = 'intent'`).get().id;
const passes = (w) => w.db.prepare(
  `SELECT * FROM d6_drive_passes ORDER BY id`).all();

describe("rollback candidate (R6(c))", () => {
  test("RB-1 no scheduler surface: the module's default export has no scheduled handler", async () => {
    const mod = await import(
      join(ROLLBACK, "v2/worker-entry-prod-d6.js"));
    assert.ok(mod.default && typeof mod.default.fetch === "function");
    assert.ok(!("scheduled" in mod.default),
      "no scheduled() export — the trigger has nothing to call");
  });

  test("RB-2..RB-5 migration, evidence compatibility, fail-closed read", async () => {
    const w = await makeWorld(ROLLBACK, {});
    await registeringEval(w);
    // The pre-A-3 recorder shape, written by hand (the store
    // as the live build leaves it today).
    w.db.exec(`CREATE TABLE IF NOT EXISTS d6_drive_passes (
      id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL,
      finished_at INTEGER, stage TEXT, drive_invoked INTEGER,
      outcomes_json TEXT, outcomes_truncated INTEGER,
      error_name TEXT, error_message TEXT, armed_after INTEGER)`);
    const ins = w.db.prepare(
      `INSERT INTO d6_drive_passes (at, finished_at, stage,
         drive_invoked) VALUES (?, ?, 'complete', 1)`);
    ins.run(T0 + 1000, T0 + 1500);
    ins.run(T0 + 2000, T0 + 2500);
    // RB-2: positively pre-migration → legacy semantics.
    let repair = w.coord.repairStatus();
    assert.deepEqual(repair.derivation.dischargedIntentIds, [1],
      "legacy derivation discharges on the old shape");
    // RB-3: one native pass — the rollback recorder migrates
    // and writes a well-formed extended row.
    w.advance(60000);
    await w.fireClassAlarm();
    const rows = passes(w);
    assert.equal(rows.length, 3);
    assert.deepEqual(rows.map((r) => r.seq), [1, 2, 3],
      "backfill continues into the new row's seq");
    const mine = rows[2];
    assert.equal(mine.entry_kind, "native_alarm");
    assert.equal(mine.assurance_fired, 0);
    assert.equal(mine.assurance_outcome, "not_required");
    assert.equal(mine.admitted_at, mine.at);
    const wm = w.db.prepare(
      `SELECT value FROM d6_recorder_meta
        WHERE key = 'migration_watermark'`).get();
    assert.equal(wm.value, 2, "the watermark is the pre-migration max id");
    // RB-1 (durable half): no scheduler table was created.
    const schedTables = w.db.prepare(
      `SELECT name FROM sqlite_master WHERE type = 'table'
         AND (name LIKE 'd6_scheduler%' OR name = 'd6_active_pass')`)
      .all();
    assert.deepEqual(schedTables, [],
      "the rollback build creates no scheduler state");
    // RB-4: identical derivation across the migration, under
    // this build's coordinator AND the A-3 candidate's.
    repair = w.coord.repairStatus();
    assert.deepEqual(repair.derivation.dischargedIntentIds, [1],
      "the derivation is identical across the migration");
    const wc = await makeWorld(CAND, { db: w.db });
    assert.deepEqual(
      wc.coord.repairStatus().derivation.dischargedIntentIds, [1],
      "the candidate derivation accepts the rollback evidence");
    // A second intent discharged by rollback-written passes,
    // read identically by both derivations.
    await registeringEval(w);
    const intent2 = latestIntentId(w);
    w.advance(60000);
    await w.fireClassAlarm();
    w.advance(1000);
    await w.fireClassAlarm();
    assert.deepEqual(
      w.coord.repairStatus().derivation.dischargedIntentIds,
      [1, intent2]);
    assert.deepEqual(
      wc.coord.repairStatus().derivation.dischargedIntentIds,
      [1, intent2],
      "rollback-written native pairs discharge under the candidate too");
    // RB-5: the R2 fail-closed read, in this tree. A FRESH
    // intent (intents 1–2 stand discharged on recorded events,
    // which no read fault rewrites) with only scheduled
    // evidence in its window must not discharge while the
    // extended read is faulted — the pre-corrections fallback
    // discharged exactly this shape through the legacy SELECT.
    await registeringEval(w);
    const intent3 = latestIntentId(w);
    const maxSeq = w.db.prepare(
      `SELECT value FROM d6_recorder_meta
        WHERE key = 'seq_counter'`).get().value;
    const insSched = w.db.prepare(
      `INSERT INTO d6_drive_passes (at, finished_at, stage,
         drive_invoked, entry_kind, seq)
       VALUES (?, ?, 'complete', 1, 'scheduled_fallback', ?)`);
    insSched.run(T0 + 200000, T0 + 200500, maxSeq + 1);
    insSched.run(T0 + 201000, T0 + 201500, maxSeq + 2);
    w.faults.sql = {
      match: (q) => q.includes("seq, entry_kind"),
      error: new Error("injected extended-read failure") };
    const faulted = w.coord.repairStatus();
    assert.equal(faulted.derivation.recorderVerified, false);
    assert.ok(!faulted.derivation.dischargedIntentIds
      .includes(intent3),
      "no discharge is derived from the failed read");
    w.faults.sql = null;
    // With reads healthy the scheduled rows still do not
    // discharge it (the standing RC-2 rule).
    assert.ok(!w.coord.repairStatus().derivation
      .dischargedIntentIds.includes(intent3));
  });
});
