// A-3 ACCEPTANCE BATTERY — the scheduled drive entry.
// Operative specification: the A-3 design package (pin
// b5ef92c8…), the amended design (pin d3de2def…; battery §11,
// T-A3-01…25), the addendum C1–C8 (pin 51f0158c…; battery §C8,
// T-A3-26…38), and Rowan's DESIGN PASS with binding conditions
// I1–I8 (board 6921985393), which controls on conflict. Built
// under Julie's offline implementation GO (board 6922008740).
// House harness, real node:sqlite, synthetic fixtures only.
//
// Standing caveat (the A-1 battery's, carried): offline results
// do not establish actual platform alarm delivery, cron
// delivery, or Durable Object runtime retry behavior. Where a
// test models a platform behavior (instance replacement,
// transport loss), the model is named in the test.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  makeWorld, seedAttempt3Shape, entryGet, entryPost,
  OPERATOR_TOKEN, CLIENT_TOKEN, T0,
} from "./harness.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const CAND = process.env.A3_CAND_DIR ?? join(HERE, "..", "candidate-tree");
// The pre-A-3 build: the A-1 candidate (live build 8a16def4),
// held pristine in pre-a3-tree/ (hash-verified against
// BASELINE-MANIFEST.txt). NOT baseline-tree/ — that is the
// pre-A-1 tree the A-1 battery diffs against.
const BASE = process.env.A3_BASE_DIR ?? join(HERE, "..", "pre-a3-tree");
const CRON = "*/30 * * * *";
const HOUR = 3600000, MIN = 60000;
const BOOK = "book-battery";
const PHASE = "forever-pucked";

const world = (opts = {}) => makeWorld(CAND, opts);
const liveWorld = (opts = {}) => makeWorld(CAND,
  { envOverrides: { GENERATION_HALT: "0" }, ...opts });

// A queue stub the test owns. The house harness's classEnv
// carries no queue binding, so a pass in a stock world can
// issue grants but can never drain the outbox (the A-1
// batteries never needed a drain). Worlds that must observe
// an actual send wire this stub as the V2 queue binding.
function makeQueueStub() {
  const stub = { sendCalls: 0, sent: [], _deferred: null,
    deferNext() {
      let release;
      stub._deferred = new Promise((r) => { release = r; });
      return release;
    },
    async send(message) {
      stub.sendCalls++;
      if (stub._deferred) {
        const p = stub._deferred;
        stub._deferred = null;
        await p;
      }
      stub.sent.push(message);
    } };
  return stub;
}
const liveWorldWithQueue = (stub) => makeWorld(CAND,
  { envOverrides: { GENERATION_HALT: "0",
      OPALREADER_GENERATION_V2: stub } });

async function act(w, action, ref = "battery:a3") {
  return entryPost(w, "/v2/d6-scheduler-activation",
    { action, authorizationRef: ref, reason: `battery ${action}` },
    { operator: true, client: false });
}
async function activate(w, ref) {
  const r = await act(w, "activate", ref);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.outcome, "applied", JSON.stringify(r.body));
  return r.body;
}
// Drive the DO-internal tick handler directly (the same call
// the scheduled() stub makes) and read the outcome object.
// Needed where the observable is the tick RESPONSE rather
// than a new log row: a re-delivered admitted tick is
// idempotent in the log (tick_identity is unique), so its
// refusal is visible only in the response.
async function tickDirect(w, scheduledTime) {
  const res = await w.inst.fetch(new Request(
    "https://do.internal/internal/d6-scheduler-tick", {
      method: "POST",
      headers: { "x-opalreader-internal": "1",
        "x-opalreader-scope": "production",
        "content-type": "application/json" },
      body: JSON.stringify({ cron: CRON, scheduledTime }) }),
    w.inst.env);
  return { status: res.status, body: await res.json() };
}

async function status(w) {
  const r = await entryGet(w, "/v2/d6-scheduler-status",
    { operator: true, client: false });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body;
}
function schedRow(w, kind, due, ref = null, payload = {}) {
  w.db.prepare(
    `INSERT INTO schedule (due_at, kind, ref, payload_json)
     VALUES (?, ?, ?, ?)`).run(due, kind, ref, JSON.stringify(payload));
}
function passes(w) {
  return w.db.prepare(
    `SELECT * FROM d6_drive_passes ORDER BY id`).all();
}
function lastLog(w) {
  return w.db.prepare(
    `SELECT * FROM d6_scheduler_log ORDER BY id DESC LIMIT 1`).get();
}
function schedState(w) {
  return w.db.prepare(
    `SELECT * FROM d6_scheduler_state WHERE id = 1`).get();
}
function schedEvents(w, kind) {
  return kind
    ? w.db.prepare(
        `SELECT * FROM d6_scheduler_events WHERE kind = ?
           ORDER BY id`).all(kind)
    : w.db.prepare(
        `SELECT * FROM d6_scheduler_events ORDER BY id`).all();
}
// Wait until a condition over durable state holds. Used where
// a pass/tick is started without awaiting it: its progress to
// the parking point is pure microtasks, so event-loop turns
// make the interleavings deterministic.
async function until(fn, turns = 200) {
  for (let i = 0; i < turns; i++) {
    if (fn()) return;
    await new Promise((r) => setImmediate(r));
  }
  throw new Error("until: condition never held");
}
const settle = async () => {
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
};

// A repair evaluation that registers, on a halted lane —
// the A-1 registering flow, reused as a fixture builder.
// The HELD check reads the DO instance's env (a
// construction-time copy), so the flip lands there.
async function registeringEval(w) {
  const prev = w.inst.env.GENERATION_HALT;
  const prevClass = w.classEnv.GENERATION_HALT;
  w.inst.env.GENERATION_HALT = "1";
  w.classEnv.GENERATION_HALT = "1";
  w.seedAlarm(T0 - 2 * HOUR);
  const r = await entryPost(w, "/v2/d6-repair-evaluate",
    { action: "evaluate_repair", authorizationRef: "battery:a3",
      reason: "battery evaluation" },
    { operator: true, client: false });
  w.inst.env.GENERATION_HALT = prev;
  w.classEnv.GENERATION_HALT = prevClass;
  assert.equal(r.body.outcome, "registered",
    JSON.stringify(r.body));
  return r.body;
}

// Repair intents are identified by their intent-event row id
// (evaluations also persist discharge events, so the second
// intent is not id 2). Read the id from the durable record.
const latestIntentId = (w) => w.db.prepare(
  `SELECT MAX(id) AS id FROM d6_repair_events
    WHERE kind = 'intent'`).get().id;

// The S-3 stall shape as a tick fixture: an overdue lease row
// for a nonexistent grant (its processing is a safe no-op) plus
// the chain's watchdog row; registration absent.
function stallFixture(w, { armed = null } = {}) {
  schedRow(w, "lease", T0 - 2 * HOUR, "grant:missing:fixture");
  schedRow(w, "watchdog", T0 - 2 * HOUR);
  if (armed === null) w.seedAlarm(null);
  else w.seedAlarm(armed);
}

// ----------------------------------------------------------------
describe("activation and surfaces (T-A3-09, T-A3-20)", () => {
  test("T-A3-09 activation semantics: transitions, epoch, four-stage disablement record, route contract", async () => {
    const w = await liveWorld();
    // Route contract: closed allowlist, both text fields
    // required nonblank on EVERY action.
    const bad = [
      ["extra key", { action: "activate", authorizationRef: "r",
        reason: "x", bogus: 1 }],
      ["missing reason", { action: "activate",
        authorizationRef: "r" }],
      ["blank reason", { action: "activate", authorizationRef: "r",
        reason: "  " }],
      ["blank ref", { action: "activate", authorizationRef: " ",
        reason: "x" }],
      ["bad action", { action: "explode", authorizationRef: "r",
        reason: "x" }],
    ];
    for (const [name, body] of bad) {
      const r = await entryPost(w, "/v2/d6-scheduler-activation",
        body, { operator: true, client: false });
      assert.equal(r.body.outcome, "rejected", name);
    }
    // Client token alone is refused; no token is refused.
    const clientOnly = await entryPost(w,
      "/v2/d6-scheduler-activation",
      { action: "activate", authorizationRef: "r", reason: "x" },
      { operator: false, client: true });
    assert.equal(clientOnly.status, 403);
    // Dormant: the read-only status surface creates nothing —
    // a never-touched world reports no schema and no state.
    let st = await status(w);
    assert.equal(st.schemaReady, false);
    assert.equal(st.state, null);
    assert.equal(st.waitHold, null);
    // Deactivate while inactive is a policy decline.
    assert.equal((await act(w, "deactivate")).body.outcome,
      "rejected");
    // Activate: epoch 1, cron constant recorded, watermark null.
    const a1 = await activate(w);
    assert.equal(a1.epoch, 1);
    assert.equal(a1.cron, CRON);
    st = await status(w);
    assert.equal(st.state.state, "active");
    assert.equal(st.state.admittedWatermark, null);
    // Second activation declines.
    assert.equal((await act(w, "activate")).body.outcome,
      "rejected");
    // Trigger-removal note while active declines.
    assert.equal((await act(w, "note_trigger_removed")).body
      .outcome, "rejected");
    // Deactivate with nothing in flight: drained_normally,
    // stages (1)(2)(3) recorded in order.
    const d1 = await act(w, "deactivate");
    assert.equal(d1.body.outcome, "applied");
    assert.equal(d1.body.disposition, "drained_normally");
    const kinds = schedEvents(w).map((e) => e.kind);
    assert.deepEqual(kinds.slice(-3),
      ["admission_disabled", "in_flight_noted", "drained"]);
    // Trigger removal is stage (4), after deactivation.
    const n1 = await act(w, "note_trigger_removed");
    assert.equal(n1.body.outcome, "applied");
    assert.equal(schedEvents(w).at(-1).kind,
      "trigger_removal_confirmed");
    // Reactivation: epoch increments, watermark resets.
    const a2 = await activate(w);
    assert.equal(a2.epoch, 2);
    st = await status(w);
    assert.equal(st.state.admittedWatermark, null);
    assert.equal(st.state.triggerRemovedAt, null);
  });

  test("T-A3-20 public-surface rejection: the internal tick path is refused through the public dispatcher under every credential; the same path via scheduled() is admitted", async () => {
    const w = await liveWorld();
    await activate(w);
    stallFixture(w);
    const tickBody = JSON.stringify(
      { cron: CRON, scheduledTime: T0 });
    const attempts = [
      ["no credential", {}],
      ["client token", { "x-opalreader-token": CLIENT_TOKEN }],
      ["operator token", { "x-opalreader-operator-token":
        OPERATOR_TOKEN }],
    ];
    for (const [name, extra] of attempts) {
      const res = await w.entry.fetch(new Request(
        "https://opalreader.invalid/internal/d6-scheduler-tick", {
          method: "POST",
          headers: { "x-opalreader-scope": "production",
            "x-opalreader-instance": "account",
            "content-type": "application/json",
            Origin: "https://opalreader.invalid", ...extra },
          body: tickBody }), w.entryEnv);
      assert.equal(res.status, 404, name);
    }
    // No tick was logged and no pass ran for any attempt.
    assert.equal(w.db.prepare(
      `SELECT COUNT(*) AS n FROM d6_scheduler_log`).get().n, 0);
    assert.equal(passes(w).length, 0);
    // The same handler via the tree's own scheduled() export:
    // admitted, one fallback pass, work processed.
    await w.fireScheduled(CRON, T0);
    assert.equal(passes(w).length, 1);
    assert.equal(passes(w)[0].entry_kind, "scheduled_fallback");
    assert.equal(lastLog(w).action, "fallback_completed");
  });

  test("retry configuration: the tick's stub is created with retry { maxRetries: 0 } (I1/C3 transport discipline)", async () => {
    const w = await liveWorld();
    await activate(w);
    stallFixture(w);
    await w.fireScheduled(CRON, T0);
    const tickGets = w.coordinatorGetCalls;
    assert.ok(tickGets.length >= 1);
    const last = tickGets.at(-1);
    assert.deepEqual(last.options, { retry: { maxRetries: 0 } });
  });
});

// ----------------------------------------------------------------
describe("predicate and observation discipline (T-A3-01, T-A3-12, T-A3-19)", () => {
  test("T-A3-01 healthy skip: idle watchdog classifies HEALTHY_IDLE; timely registration for future work classifies ARMED_TIMELY; no pass, no effects", async () => {
    const w = await liveWorld();
    await activate(w);
    schedRow(w, "watchdog", T0 + 10 * MIN);
    w.seedAlarm(T0 + 10 * MIN);
    await w.fireScheduled(CRON, T0);
    let log = lastLog(w);
    assert.equal(log.classification, "HEALTHY_IDLE");
    assert.equal(log.action, "skip_healthy");
    assert.equal(passes(w).length, 0);
    // Timely active work: a future lease row, registration at
    // the earliest due (the watchdog's, which is earlier).
    schedRow(w, "lease", T0 + 30 * MIN, "grant:future:fixture");
    w.advance(1 * MIN);
    await w.fireScheduled(CRON, T0 + 1 * MIN);
    log = lastLog(w);
    assert.equal(log.classification, "ARMED_TIMELY");
    assert.equal(passes(w).length, 0);
    assert.equal(w.queue.sendCalls, 0);
  });

  test("T-A3-12 WAIT-law tick: failed reads admit nothing and record READ_FAILURE, never an absence", async () => {
    const w = await liveWorld();
    await activate(w);
    stallFixture(w);
    // Branch (a): the registration read throws.
    w.faults.getAlarm = new Error("platform read fault");
    await w.fireScheduled(CRON, T0);
    let log = lastLog(w);
    assert.equal(log.classification, "READ_FAILURE");
    assert.equal(log.reason, "getalarm_failed");
    assert.equal(passes(w).length, 0);
    assert.equal(schedState(w).admitted_watermark, null);
    w.faults.getAlarm = null;
    // Branch (b): the schedule observation itself fails.
    w.faults.sql = { match: (q) =>
      q.includes("FROM schedule WHERE state = 'pending'"),
      error: new Error("storage fault") };
    await w.fireScheduled(CRON, T0 + 30 * MIN);
    log = lastLog(w);
    assert.equal(log.classification, "READ_FAILURE");
    assert.equal(passes(w).length, 0);
    assert.equal(schedState(w).admitted_watermark, null);
    w.faults.sql = null;
  });

  test("T-A3-19 predicate anomalies: future-dated registration is ANOMALOUS (report-only); missing watchdog with no rows is NO_SCHEDULE_OBSERVED; a complete pass without progress is a named coverage limitation with a persistent count", async () => {
    const w = await liveWorld();
    await activate(w);
    // ANOMALOUS: overdue work, registration far in the future.
    schedRow(w, "lease", T0 - 2 * HOUR, "grant:missing:fixture");
    w.seedAlarm(T0 + 2 * HOUR);
    await w.fireScheduled(CRON, T0);
    assert.equal(lastLog(w).classification, "ANOMALOUS");
    assert.equal(lastLog(w).action, "report_only");
    assert.equal(passes(w).length, 0);

    const w2 = await liveWorld();
    await activate(w2);
    // NO_SCHEDULE_OBSERVED: no schedule rows at all.
    await w2.fireScheduled(CRON, T0);
    assert.equal(lastLog(w2).classification, "NO_SCHEDULE_OBSERVED");
    assert.equal(passes(w2).length, 0);
    // HOLD ruling R3 (corrections round): HEALTHY_IDLE now
    // requires a timely, consistently armed idle watchdog. A
    // watchdog pending with NO registration is not healthy; its
    // due here is still in the future relative to the tick, so
    // the classification is ABSENT_NOT_OVERDUE (the
    // pre-corrections build returned HEALTHY_IDLE here; the
    // ruling withdrew that reading).
    schedRow(w2, "watchdog", T0 + 10 * MIN);
    w2.seedAlarm(null);
    await w2.fireScheduled(CRON, T0 + 30 * MIN);
    assert.equal(lastLog(w2).classification, "ABSENT_NOT_OVERDUE");

    // PASS_WITHOUT_PROGRESS + escalation at 48 (§C4): a complete
    // pass finished after the earliest due, work still pending,
    // registration absent.
    const w3 = await liveWorld();
    await activate(w3);
    w3.inst._ensureA3Schema();
    schedRow(w3, "lease", T0 - 2 * HOUR, "grant:missing:fixture");
    w3.db.prepare(
      `INSERT INTO d6_drive_passes
         (at, finished_at, stage, drive_invoked, entry_kind, seq)
       VALUES (?, ?, 'complete', 1, 'native_alarm', 1)`)
      .run(T0 - HOUR, T0 - HOUR + 1000);
    w3.seedAlarm(null);
    for (let i = 0; i < 49; i++) {
      await w3.fireScheduled(CRON, T0 + i * 30 * MIN);
      assert.equal(lastLog(w3).classification,
        "PASS_WITHOUT_PROGRESS", `tick ${i}`);
      assert.equal(passes(w3).length, 1,
        "report-only: the seeded pass is the only pass");
    }
    assert.equal(schedState(w3).stall_ticks, 49);
    assert.equal(schedState(w3).last_classification,
      "PASS_WITHOUT_PROGRESS");
    const esc = schedEvents(w3, "coverage_limitation_escalated");
    assert.equal(esc.length, 1,
      "escalation fires exactly once, at 48 consecutive ticks");
  });
});

// ----------------------------------------------------------------
describe("predicate totality (T-A3-33, I4/I8)", () => {
  test("T-A3-33 exhaustive matrix over the observation space: every consistent combination yields a named classification; named cells exact", async () => {
    const w = await liveWorld();
    const KNOWN = new Set([
      "ACTIVE_ENTRY", "READ_FAILURE", "INELIGIBLE", "WAIT_HOLD",
      "HEALTHY_IDLE", "NO_SCHEDULE_OBSERVED", "ARMED_TIMELY",
      "DELAYED_ARMED", "ABSENT_NOT_OVERDUE", "ANOMALOUS",
      "PASS_WITHOUT_PROGRESS", "INTERVENE", "UNMATCHED"]);
    const base = {
      guardHeld: false, armedReadFailed: false,
      observationFailed: false, activationActive: true,
      activationReason: null, waitHoldActive: false,
      duplicateWatermark: false, cronMismatch: false,
      containmentVerified: true, containmentNormal: true,
      generationEnabled: true, pendingWork: 0,
      watchdogPending: false, earliestDue: null, armed: null,
      overdue: false, completePassSinceDue: false,
      finishedAt: T0 };
    let cells = 0;
    for (const pendingWork of [0, 2])
      for (const watchdogPending of [false, true])
        for (const overdue of [false, true])
          for (const completePassSinceDue of [false, true])
            for (const armedKind of
              ["null", "timely", "skewed", "grace", "future",
               "watchdog-window"]) {
              const obs = { ...base, pendingWork, watchdogPending,
                overdue, completePassSinceDue,
                earliestDue: pendingWork > 0 || watchdogPending
                  ? (overdue ? T0 - 2 * HOUR : T0 + 30 * MIN)
                  : null,
                armed: armedKind === "null" ? null
                  : armedKind === "timely" ? T0 - 2 * HOUR + 5 * MIN
                  : armedKind === "skewed" ? T0 - 2 * HOUR + 20 * MIN
                  : armedKind === "grace" ? T0 - 50 * MIN
                  : armedKind === "future" ? T0 + 2 * HOUR
                  : T0 + 5 * MIN };
              if (pendingWork === 0 && !watchdogPending)
                obs.earliestDue = null;
              const r = w.inst._classifyTick(obs);
              assert.ok(KNOWN.has(r.classification),
                JSON.stringify(obs));
              assert.equal(typeof r.reason, "string");
              cells++;
            }
    assert.equal(cells, 96);
    // Named cells, exact.
    const cell = (over) => w.inst._classifyTick({ ...base, ...over });
    // I4(a): pending work not yet overdue, verified absent
    // registration — report-only, never intervention.
    assert.equal(cell({ pendingWork: 2, watchdogPending: true,
      earliestDue: T0 + 30 * MIN, armed: null, overdue: false })
      .classification, "ABSENT_NOT_OVERDUE");
    // I4(b) boundary: overdue work, registration within SKEW
    // (5 min) of earliestDue and after now - GRACE (10 min) —
    // consistent with a registration for the most recent due
    // row; the native firing is imminent-or-just-due.
    assert.equal(cell({ pendingWork: 2, watchdogPending: true,
      earliestDue: T0 - 12 * MIN, armed: T0 - 8 * MIN,
      overdue: true }).classification, "DELAYED_ARMED");
    // The other side of that boundary: the same skew-edge
    // registration, but stale (older than GRACE) — the table's
    // anomalous row, since it was armed implausibly late for
    // the due row and never fired.
    assert.equal(cell({ pendingWork: 2, watchdogPending: true,
      earliestDue: T0 - 2 * HOUR, armed: T0 - 90 * MIN,
      overdue: true }).classification, "ANOMALOUS");
    // The pre-I4 hole shape: overdue, armed within GRACE in the
    // past but older than earliestDue + SKEW — row 7's second
    // disjunct covers it as DELAYED_ARMED.
    assert.equal(cell({ pendingWork: 2, watchdogPending: true,
      earliestDue: T0 - 2 * HOUR, armed: T0 - 5 * MIN,
      overdue: true }).classification, "DELAYED_ARMED");
    // Verified absence over overdue work: intervene.
    const absent = cell({ pendingWork: 2, watchdogPending: true,
      earliestDue: T0 - 2 * HOUR, armed: null, overdue: true });
    assert.deepEqual([absent.classification, absent.reason],
      ["INTERVENE", "verified_absent"]);
    // Stale registration over overdue work: intervene.
    const stale = cell({ pendingWork: 2, watchdogPending: true,
      earliestDue: T0 - 2 * HOUR, armed: T0 - 2 * HOUR,
      overdue: true });
    assert.deepEqual([stale.classification, stale.reason],
      ["INTERVENE", "overdue_registration"]);
    // Complete pass since due converts absence to the named
    // coverage limitation, never intervention.
    assert.equal(cell({ pendingWork: 2, watchdogPending: true,
      earliestDue: T0 - 2 * HOUR, armed: null, overdue: true,
      completePassSinceDue: true }).classification,
      "PASS_WITHOUT_PROGRESS");
    // An inconsistent combination reaches the conservative
    // catch-all rather than throwing or intervening.
    const un = cell({ pendingWork: 2, watchdogPending: false,
      earliestDue: null, armed: null, overdue: false });
    assert.equal(un.classification, "UNMATCHED");
    assert.equal(un.action ?? "report_only", "report_only");
  });
});

// ----------------------------------------------------------------
describe("intervention (T-A3-02, T-A3-03, T-A3-04, T-A3-06, T-A3-30)", () => {
  test("T-A3-02 verified-absent recovery (the S-3 shape): the tick admits one fallback pass, the stalled work is processed, the registration is re-armed, the watermark advances", async () => {
    const w = await liveWorld();
    await activate(w);
    stallFixture(w);
    await w.fireScheduled(CRON, T0);
    const log = lastLog(w);
    assert.equal(log.classification, "INTERVENE");
    assert.equal(log.reason, "verified_absent");
    assert.equal(log.action, "fallback_completed");
    const rows = passes(w);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].entry_kind, "scheduled_fallback");
    assert.equal(rows[0].stage, "complete");
    assert.equal(rows[0].seq, 1);
    assert.equal(rows[0].admitted_at != null, true);
    // The lease row was processed by the pass's base machinery.
    assert.equal(w.db.prepare(
      `SELECT state FROM schedule WHERE kind = 'lease'`)
      .get().state, "done");
    // Registration restored for the watchdog's next due.
    assert.notEqual(w.alarmAt(), null);
    assert.equal(schedState(w).admitted_watermark, T0);
  });

  test("T-A3-03 stale registration (P-STALE via the tick): intervention re-drives and refreshes the registration", async () => {
    const w = await liveWorld();
    await activate(w);
    stallFixture(w, { armed: T0 - 2 * HOUR });
    await w.fireScheduled(CRON, T0);
    const log = lastLog(w);
    assert.equal(log.classification, "INTERVENE");
    assert.equal(log.reason, "overdue_registration");
    assert.equal(log.action, "fallback_completed");
    assert.equal(passes(w).length, 1);
    assert.ok(w.alarmAt() > T0,
      "the pass re-armed the registration into the future");
  });

  test("T-A3-04 independence: due work is processed by the fallback pass with zero native passes recorded", async () => {
    const w = await liveWorld();
    await activate(w);
    stallFixture(w);
    await w.fireScheduled(CRON, T0);
    const rows = passes(w);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].entry_kind, "scheduled_fallback");
    assert.equal(w.db.prepare(
      `SELECT COUNT(*) AS n FROM schedule
        WHERE state = 'pending' AND kind != 'watchdog'`)
      .get().n, 0);
  });

  test("T-A3-06 duplicate and delayed ticks: re-delivery and older ticks are refused at the watermark; the next logical tick evaluates fresh state", async () => {
    const w = await liveWorld();
    await activate(w);
    stallFixture(w);
    await w.fireScheduled(CRON, T0);
    assert.equal(lastLog(w).action, "fallback_completed");
    // Re-delivery of the admitted tick: refused at the
    // watermark; the log keeps the original admission row
    // (tick_identity is unique — the refusal is in the
    // response, and no second row appears).
    const dup = await tickDirect(w, T0);
    assert.equal(dup.body.action, "skip_duplicate");
    assert.equal(dup.body.classification, "INELIGIBLE");
    assert.equal(w.db.prepare(
      `SELECT COUNT(*) AS n FROM d6_scheduler_log`).get().n, 1);
    // An older tick, delivered late.
    await w.fireScheduled(CRON, T0 - 30 * MIN);
    assert.equal(lastLog(w).action, "skip_duplicate");
    assert.equal(passes(w).length, 1);
    // A new stall + the next logical tick: fresh admission.
    // (The new row is due after the first pass finished —
    // a row due before it would be PASS_WITHOUT_PROGRESS
    // evidence, not a fresh stall.)
    schedRow(w, "lease", T0 + 15 * MIN, "grant:missing:second");
    w.seedAlarm(null);
    w.advance(30 * MIN);
    await w.fireScheduled(CRON, T0 + 30 * MIN);
    assert.equal(lastLog(w).action, "fallback_completed");
    assert.equal(passes(w).length, 2);
  });

  test("T-A3-30 an older duplicate arriving after a newer admission is rejected even though the predicate would qualify", async () => {
    const w = await liveWorld();
    await activate(w);
    stallFixture(w);
    // The NEWER tick is admitted first (delayed delivery of the
    // older one is still in flight).
    w.advance(30 * MIN);
    await w.fireScheduled(CRON, T0 + 30 * MIN);
    assert.equal(lastLog(w).action, "fallback_completed");
    // A second stall forms (due strictly after the first
    // pass finished); the predicate would qualify — but the
    // older tick is at/below the admitted watermark.
    schedRow(w, "lease", T0 + 45 * MIN, "grant:missing:second");
    w.seedAlarm(null);
    await w.fireScheduled(CRON, T0);
    assert.equal(lastLog(w).action, "skip_duplicate");
    assert.equal(passes(w).length, 1);
    // The next logical tick admits on the fresh state.
    w.advance(HOUR);
    await w.fireScheduled(CRON, T0 + HOUR);
    assert.equal(lastLog(w).action, "fallback_completed");
    assert.equal(passes(w).length, 2);
  });
});

// Write the containment state row directly (the storage-layer
// equivalent of an operator transition landing at that instant;
// the drive gate reads only this row).
function forceContainment(w, state) {
  // The shipped table, created lazily by the coordinator —
  // ensure it exists (full shipped shape) before the write.
  w.db.exec(`CREATE TABLE IF NOT EXISTS d6_containment_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    state TEXT NOT NULL, updated_at INTEGER NOT NULL,
    authorization_ref TEXT, stop_status TEXT,
    stop_verified_at INTEGER, stop_verify_action TEXT,
    stop_armed_before INTEGER, stop_armed_after INTEGER,
    stop_verify_attempts INTEGER NOT NULL DEFAULT 0,
    stop_episode_id INTEGER,
    stop_episode_exhausted INTEGER NOT NULL DEFAULT 0,
    prev_episode_id INTEGER, prev_episode_attempts INTEGER,
    prev_episode_exhausted INTEGER, prev_episode_closed_at INTEGER)`);
  w.db.prepare(
    `INSERT INTO d6_containment_state
       (id, state, updated_at, authorization_ref)
     VALUES (1, ?, ?, 'battery:a3')
     ON CONFLICT(id) DO UPDATE SET state = excluded.state,
       updated_at = excluded.updated_at,
       authorization_ref = excluded.authorization_ref`)
    .run(state, w.clock.now);
}

// ----------------------------------------------------------------
describe("guard and ownership (T-A3-05, T-A3-13, T-A3-14, T-A3-27)", () => {
  test("T-A3-05 guard overlap: a tick during an in-flight native pass classifies ACTIVE_ENTRY and admits nothing; exactly one pass runs", async () => {
    const w = await liveWorld();
    await activate(w);
    stallFixture(w);
    const realCache = w.inst._cache.bind(w.inst);
    let release;
    const parked = new Promise((r) => { release = r; });
    let calls = 0;
    w.inst._cache = async (...a) => {
      calls++;
      if (calls === 1) await parked;
      return realCache(...a);
    };
    const alarmP = w.fireClassAlarm();
    // The native pass holds the guard, parked in its base phase.
    await settle();
    await w.fireScheduled(CRON, T0);
    assert.equal(lastLog(w).classification, "ACTIVE_ENTRY");
    assert.equal(lastLog(w).action, "skip_guard_held");
    release();
    await alarmP;
    const rows = passes(w);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].entry_kind, "native_alarm");
    assert.equal(rows[0].stage, "complete");
  });

  test("T-A3-13 the guard has no expiry: an 11-minute pass (past the rejected 10-minute lease) still excludes the tick", async () => {
    const w = await liveWorld();
    await activate(w);
    stallFixture(w);
    const realCache = w.inst._cache.bind(w.inst);
    let release;
    const parked = new Promise((r) => { release = r; });
    let calls = 0;
    w.inst._cache = async (...a) => {
      calls++;
      if (calls === 1) await parked;
      return realCache(...a);
    };
    const alarmP = w.fireClassAlarm();
    await settle();
    w.advance(11 * MIN);
    await w.fireScheduled(CRON, T0 + 30 * MIN);
    assert.equal(lastLog(w).classification, "ACTIVE_ENTRY");
    release();
    await alarmP;
    assert.equal(passes(w).length, 1);
    assert.equal(passes(w)[0].stage, "complete");
  });

  test("T-A3-14 exit collision assurance (M2): a base handler consuming the pass's own registration is repaired at exit, narrowly — one read, one conditional re-arm", async () => {
    const w = await liveWorld();
    stallFixture(w);
    const realCache = w.inst._cache.bind(w.inst);
    let calls = 0;
    w.inst._cache = async (...a) => {
      calls++;
      // Call 1 is inside super.alarm(); call 2 is the body's
      // construction, AFTER the base handler armed. Consume
      // that registration, simulating the M2 collision.
      if (calls === 2) await w.inst.state.storage.deleteAlarm();
      return realCache(...a);
    };
    await w.fireClassAlarm();
    const rows = passes(w);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].stage, "complete");
    assert.equal(rows[0].assurance_fired, 1);
    assert.equal(rows[0].exit_armed, null,
      "the exit read observed the consumed registration");
    assert.ok(w.alarmAt() > T0,
      "assurance re-armed for the pending watchdog");
  });

  test("T-A3-27 assurance failure discipline: the original handler error is rethrown unchanged, the failure is visible in its own channel, the guard is released", async () => {
    const w = await liveWorld();
    schedRow(w, "watchdog", T0 - HOUR);
    w.seedAlarm(T0 - HOUR);
    const boom = new Error("exit read fault");
    w.faults.getAlarm = boom;
    const cacheBoom = new Error("cache construction fault");
    cacheBoom.name = "CacheBoomError";
    const realCache = w.inst._cache.bind(w.inst);
    let calls = 0;
    w.inst._cache = async (...a) => {
      calls++;
      if (calls === 2) throw cacheBoom;
      return realCache(...a);
    };
    let caught = null;
    try { await w.fireClassAlarm(); }
    catch (e) { caught = e; }
    assert.equal(caught, cacheBoom,
      "the original error object, not the assurance failure");
    const rows = passes(w);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].error_name, "CacheBoomError");
    // I2's distinction, asserted both ways: the assurance
    // failure is visible in the scheduler event stream, and
    // the recorder-health channel counts NOTHING for it (the
    // recording itself succeeded; a getAlarm fault is not a
    // recording failure — the standing suites pin that).
    assert.ok(schedEvents(w, "assurance_failed").length >= 1);
    const health = w.kv.get("d6DrivePassRecorderHealth");
    assert.equal(health.recordingFailures, 0);
    assert.equal(health.lastFailureStep, null);
    // Guard released: a later pass runs.
    w.faults.getAlarm = null;
    w.inst._cache = realCache;
    await w.fireClassAlarm();
    assert.equal(passes(w).length, 2);
    assert.equal(passes(w)[1].stage, "complete");
  });
});

// ----------------------------------------------------------------
describe("instance replacement (T-A3-07, T-A3-15, T-A3-26, T-A3-31)", () => {
  test("T-A3-07 replacement: an admitted pass whose instance is revoked mid-flight is superseded by the next tick; the work is completed exactly once by the replacement", async () => {
    const w = await liveWorld();
    const A = w.spawnInstance();
    w.setCurrentInstance(A.inst);
    await activate(w);
    stallFixture(w);
    const realCache = A.inst._cache.bind(A.inst);
    let release;
    const parked = new Promise((r) => { release = r; });
    let calls = 0;
    A.inst._cache = async (...a) => {
      calls++;
      if (calls === 1) await parked;
      return realCache(...a);
    };
    const tickP = w.fireScheduled(CRON, T0);
    // A admitted (watermark + log row are durable), then parked.
    await until(() => schedState(w)?.admitted_watermark === T0);
    A.revoke();
    const B = w.spawnInstance();
    w.setCurrentInstance(B.inst);
    release();
    await tickP; // A's pass fails on revoked storage; tick ends.
    // B's next tick supersedes the stale record and completes
    // the work exactly once.
    w.advance(30 * MIN);
    await w.fireScheduled(CRON, T0 + 30 * MIN);
    assert.equal(lastLog(w).action, "fallback_completed");
    const sup = schedEvents(w, "active_pass_superseded");
    assert.equal(sup.length, 1);
    assert.equal(JSON.parse(sup[0].detail_json).disposition,
      "interrupted_or_unknown");
    const lease = w.db.prepare(
      `SELECT state, attempts FROM schedule WHERE kind = 'lease'`)
      .get();
    assert.deepEqual([lease.state, lease.attempts], ["done", 0]);
    const rows = passes(w);
    assert.equal(rows.length, 1,
      "only the replacement's pass is recorded");
    assert.equal(rows[0].entry_kind, "scheduled_fallback");
    assert.equal(w.queue.sendCalls, 0);
  });

  test("T-A3-15 immediate termination: the first instance never resumes; the replacement completes the work; effects happen exactly once", async () => {
    const w = await liveWorld();
    const A = w.spawnInstance();
    w.setCurrentInstance(A.inst);
    await activate(w);
    stallFixture(w);
    const realCache = A.inst._cache.bind(A.inst);
    let calls = 0;
    A.inst._cache = async (...a) => {
      calls++;
      if (calls === 1) await new Promise(() => {}); // never
      return realCache(...a);
    };
    const tickP = w.fireScheduled(CRON, T0);
    tickP.catch(() => {}); // never settles; silence the watcher
    await until(() => schedState(w)?.admitted_watermark === T0);
    A.revoke();
    const B = w.spawnInstance();
    w.setCurrentInstance(B.inst);
    w.advance(30 * MIN);
    await w.fireScheduled(CRON, T0 + 30 * MIN);
    assert.equal(lastLog(w).action, "fallback_completed");
    assert.equal(schedEvents(w, "active_pass_superseded").length, 1);
    assert.equal(w.db.prepare(
      `SELECT state FROM schedule WHERE kind = 'lease'`)
      .get().state, "done");
    assert.equal(passes(w).length, 1);
    assert.equal(w.queue.sendCalls, 0);
  });

  test("T-A3-26 resumed continuation with an outstanding effect (I8): a queue send initiated by a revoked instance completes once; the replacement's pass converges the grant to handoff_uncertain without re-sending", async () => {
    const stub = makeQueueStub();
    const w = await liveWorldWithQueue(stub);
    const { jobId } = await seedAttempt3Shape(w);
    // The seed submits under a briefly lifted halt and leaves
    // the shared classEnv re-halted (its documented mirror of
    // attempt 3's R1). Instances constructed before the seed
    // keep their copied env; a spawned replacement copies the
    // classEnv as it stands — restore the live value first.
    w.classEnv.GENERATION_HALT = "0";
    const A = w.spawnInstance();
    w.setCurrentInstance(A.inst);
    const releaseSend = stub.deferNext();
    const alarmP = A.inst.alarm();
    // The pass issued the grant and is parked inside the send.
    await until(() => stub.sendCalls === 1);
    assert.equal(w.db.prepare(
      `SELECT COUNT(*) AS n FROM grants`).get().n, 1);
    assert.equal(stub.sendCalls, 1);
    assert.equal(stub.sent.length, 0);
    A.revoke();
    releaseSend();
    let caught = null;
    try { await alarmP; } catch (e) { caught = e; }
    assert.ok(caught, "the revoked continuation fails");
    assert.equal(stub.sent.length, 1, "the send itself landed once");
    const outbox = w.db.prepare(`SELECT * FROM outbox`).all();
    assert.equal(outbox.length, 1);
    assert.ok(outbox[0].send_attempted_at != null);
    assert.equal(outbox[0].sent_at, null,
      "the completion bookkeeping never landed: the send is " +
      "durably ambiguous, by design");
    // The replacement's pass, after the lease expires, treats
    // the ambiguity as handoff_uncertain — no second send, no
    // second grant, no spend.
    const B = w.spawnInstance();
    w.setCurrentInstance(B.inst);
    w.advance(20 * MIN);
    await B.inst.alarm();
    assert.equal(stub.sendCalls, 1);
    assert.equal(w.db.prepare(
      `SELECT COUNT(*) AS n FROM grants`).get().n, 1);
    assert.equal(w.db.prepare(
      `SELECT state FROM grants`).get().state, "handoff_uncertain");
    void jobId;
  });

  test("T-A3-31 interruption between admission commit and the first drive effect: the tick is consumed, the next tick evaluates fresh state", async () => {
    const w = await liveWorld();
    const A = w.spawnInstance();
    w.setCurrentInstance(A.inst);
    await activate(w);
    stallFixture(w);
    const boom = new Error("killed before first effect");
    A.inst._drivePassBody = async () => { throw boom; };
    await w.fireScheduled(CRON, T0);
    assert.equal(lastLog(w).action, "fallback_failed");
    assert.equal(schedState(w).admitted_watermark, T0,
      "the logical tick is consumed by the admission");
    assert.equal(w.db.prepare(
      `SELECT state FROM schedule WHERE kind = 'lease'`)
      .get().state, "pending");
    const B = w.spawnInstance();
    w.setCurrentInstance(B.inst);
    w.advance(30 * MIN);
    await w.fireScheduled(CRON, T0 + 30 * MIN);
    assert.equal(lastLog(w).action, "fallback_completed");
    assert.equal(w.db.prepare(
      `SELECT state FROM schedule WHERE kind = 'lease'`)
      .get().state, "done");
    assert.equal(passes(w).length, 2);
  });
});

// ----------------------------------------------------------------
describe("containment interplay (T-A3-08, T-A3-17, T-A3-32)", () => {
  test("T-A3-08 containment matrix: contained and unverified states classify INELIGIBLE with no pass and no registration write; native behavior is the shipped gate", async () => {
    for (const [action, to] of [
        ["contain_drive", "DRIVE_CONTAINED"],
        ["stop_chain", "CHAIN_STOPPED"]]) {
      const w = await liveWorld();
      await activate(w);
      stallFixture(w);
      await w.coord.applyContainmentTransition(action,
        "battery:a3", { reason: "matrix" });
      const armsBefore = w.alarmCalls.length;
      await w.fireScheduled(CRON, T0);
      assert.equal(lastLog(w).classification, "INELIGIBLE", to);
      assert.equal(lastLog(w).reason, "contained", to);
      assert.equal(passes(w).length, 0, to);
      assert.equal(w.db.prepare(
        `SELECT COUNT(*) AS n FROM schedule
          WHERE state = 'pending'`).get().n, 2, to);
      assert.equal(w.alarmCalls.length, armsBefore, to);
    }
    // Unverified read: darker still, distinctly named.
    const w = await liveWorld();
    await activate(w);
    stallFixture(w);
    w.faults.sql = { match: (q) =>
      q.includes("FROM d6_containment_state"),
      error: new Error("containment read fault") };
    await w.fireScheduled(CRON, T0);
    assert.equal(lastLog(w).classification, "INELIGIBLE");
    assert.equal(lastLog(w).reason, "containment_unverified");
    assert.equal(passes(w).length, 0);
    w.faults.sql = null;
    // Native under DRIVE_CONTAINED: the shipped contained pass.
    const w2 = await liveWorld();
    stallFixture(w2);
    await w2.coord.applyContainmentTransition("contain_drive",
      "battery:a3", { reason: "matrix" });
    await w2.fireClassAlarm();
    const rows = passes(w2);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].stage, "contained");
    assert.equal(rows[0].drive_invoked, 0);
  });

  test("T-A3-17 admission races: state changes inside the admission window refuse admission; a change mid-flight is obeyed by the NEXT tick", async () => {
    // (i) Deactivation lands during the observation window.
    {
      const w = await liveWorld();
      await activate(w);
      stallFixture(w);
      const release = w.deferGetAlarm();
      const tickP = w.fireScheduled(CRON, T0);
      await settle(); // the tick is parked at its final read
      await act(w, "deactivate");
      release(null);
      await tickP;
      assert.equal(lastLog(w).action, "skip_stale_epoch");
      assert.equal(lastLog(w).reason, "activation_changed");
      assert.equal(passes(w).length, 0);
    }
    // (ii) Containment lands during the observation window.
    {
      const w = await liveWorld();
      await activate(w);
      stallFixture(w);
      const release = w.deferGetAlarm();
      const tickP = w.fireScheduled(CRON, T0);
      await settle(); // the tick is parked at its final read
      await w.coord.applyContainmentTransition("contain_drive",
        "battery:a3", { reason: "race" });
      release(null);
      await tickP;
      assert.equal(lastLog(w).action, "skip_revalidation");
      assert.equal(lastLog(w).reason, "contained");
      assert.equal(passes(w).length, 0);
    }
    // (iii) Containment lands mid-flight, during drive: the
    // admitted pass completes under the shipped in-flight rule;
    // the next tick obeys the new state.
    {
      const w = await liveWorld();
      await activate(w);
      await seedAttempt3Shape(w);
      // A stall fixture so the tick admits and the pass runs
      // (the seeded job alone presents no due schedule work).
      schedRow(w, "lease", T0 - HOUR, "grant:missing:fixture");
      w.seedAlarm(null);
      let fired = false;
      w.faults.sql = {
        match: (q) => {
          if (!fired && q.includes("INSERT INTO grants")) {
            fired = true;
            forceContainment(w, "DRIVE_CONTAINED");
          }
          return false;
        },
        error: new Error("unused") };
      await w.fireScheduled(CRON, T0);
      assert.equal(fired, true);
      assert.equal(lastLog(w).action, "fallback_completed");
      assert.equal(w.db.prepare(
        `SELECT COUNT(*) AS n FROM grants`).get().n, 1);
      w.faults.sql = null;
      w.advance(30 * MIN);
      await w.fireScheduled(CRON, T0 + 30 * MIN);
      assert.equal(lastLog(w).classification, "INELIGIBLE");
      assert.equal(lastLog(w).reason, "contained");
    }
  });

  test("T-A3-21 ambiguous transport: the stub invocation fails after the DO admitted and completed the pass; the admission happened exactly once and the next tick does not double-admit", async () => {
    const w = await liveWorld();
    await activate(w);
    stallFixture(w);
    const real = w.inst;
    w.setCurrentInstance({
      fetch: async (req, ...rest) => {
        const res = await real.fetch(req, ...rest);
        if (String(req.url).includes("d6-scheduler-tick"))
          throw new Error("transport lost after admission");
        return res;
      } });
    let caught = null;
    try { await w.fireScheduled(CRON, T0); }
    catch (e) { caught = e; }
    assert.ok(caught);
    assert.equal(passes(w).length, 1);
    assert.equal(schedState(w).admitted_watermark, T0);
    w.setCurrentInstance(real);
    // The chain continues on its own: the watchdog's alarm
    // delivers at its due (T0+10m), recording a native pass and
    // re-arming at the next watchdog due. A later tick then
    // finds a timely armed idle watchdog (HEALTHY_IDLE under
    // the R3-corrected rows) and admits nothing. (Under the
    // pre-corrections classifier the second tick was HEALTHY_IDLE
    // even with the watchdog's registration overdue and
    // undelivered; R3 withdrew that reading, so this fixture now
    // delivers the watchdog alarm to model the recovered state.)
    w.advance(10 * MIN);
    await w.fireClassAlarm();
    w.advance(5 * MIN);
    await w.fireScheduled(CRON, T0 + 15 * MIN);
    assert.equal(lastLog(w).classification, "HEALTHY_IDLE");
    assert.equal(
      passes(w).filter((p) => p.entry_kind === "scheduled_fallback")
        .length, 1, "no second admission for the recovered state");
  });

  test("T-A3-32 containment between recovery stages (I3/I8): a transition landing after cache construction — and one landing during recover() — stops a SCHEDULED pass before drive, with native semantics untouched", async () => {
    // (a) During cache construction: caught by the first
    // scheduled-only recheck.
    {
      const w = await liveWorld();
      await activate(w);
      stallFixture(w);
      const realCache = w.inst._cache.bind(w.inst);
      let calls = 0;
      w.inst._cache = async (...a) => {
        calls++;
        const c = await realCache(...a);
        if (calls === 2)
          await w.coord.applyContainmentTransition(
            "contain_drive", "battery:a3", { reason: "stage" });
        return c;
      };
      await w.fireScheduled(CRON, T0);
      const rows = passes(w);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].stage, "contained");
      assert.equal(rows[0].drive_invoked, 0);
      assert.equal(w.queue.sendCalls, 0);
    }
    // (b) During recover(): the transition lands inside the
    // recovery scan; the post-recover recheck stops the pass.
    {
      const w = await liveWorld();
      await activate(w);
      stallFixture(w);
      let fired = false;
      w.faults.sql = {
        match: (q) => {
          // The recovery scan's own query — distinct from the
          // schema DDL that also names the table.
          if (!fired && q.includes(
              "state NOT IN ('committed', 'failed')")) {
            fired = true;
            forceContainment(w, "DRIVE_CONTAINED");
          }
          return false;
        },
        error: new Error("unused") };
      await w.fireScheduled(CRON, T0);
      assert.equal(fired, true,
        "the seam fired inside the recovery scan");
      const rows = passes(w);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].stage, "contained");
      assert.equal(rows[0].drive_invoked, 0);
      w.faults.sql = null;
    }
    // (c) Source-level: both scheduled-only recheck points
    // exist in the shipped body (the recover-stage point is
    // additionally covered behaviorally above; this pins that
    // the two guards were not merged or dropped).
    const src = readFileSync(
      join(CAND, "v2", "worker-entry-prod-d6.js"), "utf8");
    const body = src.slice(src.indexOf("async _drivePassBody"));
    const rechecks = body
      .slice(0, body.indexOf("async _drivePass("))
      .split("if (kind === ENTRY_KIND_SCHEDULED) {").length - 1;
    assert.equal(rechecks, 2,
      "exactly two scheduled-only containment rechecks");
  });
});

// ----------------------------------------------------------------
// The Chapter 6 (S-3) adjudication fixture, built at the
// storage layer: plan job generating rev 4, 14 occurrences
// (10 ready, 1 granted, 3 pending), the grant issued with an
// expired lease, its dispatch outbox row, the due lease row,
// and the in-flight attempt stuck at 'dispatching' — the exact
// durable shape the live stall presents. Synthetic ids only.
function buildS3Fixture(w, { outboxSent = true } = {}) {
  const jobId = "job:ch6-fixture";
  const grantId = `grant:${jobId}:4:full`;
  const occIds = Array.from({ length: 14 },
    (_, i) => `occ-ch6-${String(i).padStart(2, "0")}`);
  const grantedOcc = occIds[10];
  const defs = occIds.map((occurrenceId, i) => ({
    occurrenceId, revisionKey: `rk-ch6-${i}`,
    state: i < 10 ? "ready" : i === 10 ? "granted" : "pending" }));
  w.db.prepare(
    `INSERT INTO jobs (job_id, kind, book_id, chapter_index,
       lane, state, revision, data_json, created_at, updated_at)
     VALUES (?, 'job', ?, 5, 'standard', 'generating', 4, ?, ?, ?)`)
    .run(jobId, BOOK, JSON.stringify({
      kind: "job", bookId: BOOK, chapterIndex: 5,
      lane: "standard", total: 14, occurrences: defs }),
      T0 - 3 * HOUR, T0 - 3 * HOUR);
  const insOcc = w.db.prepare(
    `INSERT INTO occurrences (job_id, occurrence_id,
       revision_key, state, cache_key, detail_json)
     VALUES (?, ?, ?, ?, ?, NULL)`);
  for (const [i, d] of defs.entries())
    insOcc.run(jobId, d.occurrenceId, d.revisionKey, d.state,
      i < 10 ? "ab".repeat(32) : null);
  w.db.prepare(
    `INSERT INTO grants (grant_id, job_id, revision, state,
       created_at, lease_expires_at, report_json)
     VALUES (?, ?, 4, 'issued', ?, ?, NULL)`)
    .run(grantId, jobId, T0 - HOUR, T0 - 15 * MIN);
  w.db.prepare(
    `INSERT INTO outbox (id, kind, payload_json, created_at,
       sent_at, send_attempted_at)
     VALUES (?, 'dispatch', ?, ?, ?, ?)`)
    .run(grantId, JSON.stringify({ grantId, jobId }),
      T0 - HOUR, outboxSent ? T0 - HOUR + 1000 : null,
      T0 - HOUR + 500);
  // The grant's attempt reservation — the lease adjudication
  // marks exactly the occurrences named by these ops.
  w.db.prepare(
    `INSERT INTO ledger_ops (op_key, at, day_key, month_key,
       kind, est_micro_cents, detail_json)
     VALUES (?, ?, '2025-11-01', '2025-11', 'attempt', 16808, ?)`)
    .run(`op:${grantId}:${grantedOcc}`, T0 - HOUR,
      JSON.stringify({ jobId, occurrenceId: grantedOcc,
        grantId }));
  schedRow(w, "lease", T0 - 15 * MIN, grantId);
  schedRow(w, "watchdog", T0 - 2 * HOUR);
  w.db.prepare(
    `INSERT INTO d6_execution_records (execution_id, plan_id,
       job_id, occurrence_id, grant_id, state, stage, created_at,
       updated_at)
     VALUES ('exec-ch6-1', NULL, ?, ?, ?, 'attempted', NULL,
       ?, ?)`)
    .run(jobId, grantedOcc, grantId, T0 - HOUR, T0 - HOUR);
  w.db.prepare(
    `INSERT INTO d6_attempt_log (attempt_id, execution_id,
       plan_id, occurrence_id, seq, phase, outcome,
       cost_micro_cents, upper_micro_cents, provider_request_id,
       detail_json, created_at, updated_at)
     VALUES ('att-ch6-1', 'exec-ch6-1', NULL, ?, 1,
       'dispatching', NULL, NULL, 16808, NULL, NULL, ?, ?)`)
    .run(grantedOcc, T0 - HOUR, T0 - HOUR);
  w.seedAlarm(null);
  return { jobId, grantId, grantedOcc, occIds };
}
const occState = (w, jobId, occId) => w.db.prepare(
  `SELECT state FROM occurrences
    WHERE job_id = ? AND occurrence_id = ?`).get(jobId, occId).state;
const jobState = (w, jobId) => w.db.prepare(
  `SELECT state FROM jobs WHERE job_id = ?`).get(jobId).state;

// ----------------------------------------------------------------
describe("replay convergence (T-A3-16, T-A3-29)", () => {
  test("T-A3-16 replay after effect, per schedule-row kind: a failed completion write never duplicates the row's effect", async () => {
    const doneFault = () => ({ match: (q) =>
      q.includes("UPDATE schedule") && q.includes("'done'"),
      error: new Error("done-write fault") });
    // Watchdog kind: its pass-level effect is the outbox drain
    // (in this build the v2 drain runs inside driveOnce; the
    // base watchdog case is unwired in the D6 host env — the
    // property asserted is dispatch-once under replay). The
    // world wires a test-owned queue stub, since the stock
    // harness env carries no queue binding.
    {
      const stub = makeQueueStub();
      const w = await liveWorldWithQueue(stub);
      await seedAttempt3Shape(w);
      schedRow(w, "watchdog", T0 - HOUR);
      w.faults.sql = doneFault();
      await w.fireClassAlarm();
      assert.equal(stub.sendCalls, 1);
      assert.equal(w.db.prepare(
        `SELECT state, attempts FROM schedule
          WHERE kind = 'watchdog'`).get().state, "pending");
      w.faults.sql = null;
      w.advance(2 * HOUR);
      await w.fireClassAlarm();
      assert.equal(stub.sendCalls, 1,
        "the replayed pass does not re-dispatch");
      assert.equal(w.db.prepare(
        `SELECT COUNT(*) AS n FROM outbox
          WHERE sent_at IS NOT NULL`).get().n, 1);
    }
    // Lease kind: the adjudication lands exactly once even when
    // the completion write fails and the row is replayed.
    {
      const w = await liveWorld();
      const f = buildS3Fixture(w);
      w.faults.sql = doneFault();
      await w.fireClassAlarm();
      w.faults.sql = null;
      assert.equal(occState(w, f.jobId, f.grantedOcc),
        "outcome_unknown");
      w.advance(2 * HOUR);
      await w.fireClassAlarm();
      assert.equal(w.db.prepare(
        `SELECT COUNT(*) AS n FROM transitions
          WHERE aggregate_id = ? AND to_state = 'outcome_unknown'`)
        .get(`${f.jobId}/${f.grantedOcc}`).n, 1);
      assert.equal(occState(w, f.jobId, f.grantedOcc),
        "outcome_unknown");
    }
    // retry_grant kind: a grant issued by a pass whose
    // completion write failed is not re-issued on replay.
    {
      const w = await liveWorld();
      const { jobId } = await seedAttempt3Shape(w);
      const grantId = `grant:${jobId}:1:full`;
      await w.fireClassAlarm(); // G1 issued; job generating
      // Model G1's report landing (storage-layer equivalent):
      // grant reported, occurrence back to pending, job rev 2.
      w.db.prepare(
        `UPDATE grants SET state = 'reported'
          WHERE grant_id = ?`).run(grantId);
      const occId = w.db.prepare(
        `SELECT occurrence_id FROM occurrences
          WHERE job_id = ?`).get(jobId).occurrence_id;
      w.db.prepare(
        `UPDATE occurrences SET state = 'pending'
          WHERE occurrence_id = ?`).run(occId);
      w.db.prepare(
        `UPDATE jobs SET revision = 2 WHERE job_id = ?`)
        .run(jobId);
      schedRow(w, "retry_grant", T0 - HOUR, jobId);
      w.faults.sql = doneFault();
      await w.fireClassAlarm();
      w.faults.sql = null;
      assert.equal(w.db.prepare(
        `SELECT COUNT(*) AS n FROM grants`).get().n, 2);
      // G2's dispatch is delivered before the replay (the
      // storage-layer equivalent of the drain landing — an
      // UNDELIVERED dispatch would legitimately void at lease
      // expiry and re-grant, which is a different property).
      w.db.prepare(
        `UPDATE outbox SET send_attempted_at = ?, sent_at = ?
          WHERE id = 'grant:' || ? || ':2:full'`)
        .run(T0 + 1000, T0 + 2000, jobId);
      w.advance(2 * HOUR);
      await w.fireClassAlarm();
      assert.equal(w.db.prepare(
        `SELECT COUNT(*) AS n FROM grants`).get().n, 2,
        "replay issues no second successor grant");
      assert.equal(w.db.prepare(
        `SELECT COUNT(*) AS n FROM outbox`).get().n, 2);
    }
  });

  test("T-A3-29 retry_grant replay cannot double-issue (M5): no state change, no second grant; a genuinely new revision gets exactly one successor", async () => {
    const w = await liveWorld();
    const { jobId } = await seedAttempt3Shape(w);
    const grantId = `grant:${jobId}:1:full`;
    await w.fireClassAlarm(); // G1
    assert.equal(w.db.prepare(
      `SELECT COUNT(*) AS n FROM grants`).get().n, 1);
    // A second retry row, no state change: the occurrence is
    // granted, not pending — nothing to issue.
    schedRow(w, "retry_grant", T0 - HOUR, jobId);
    await w.fireClassAlarm();
    assert.equal(w.db.prepare(
      `SELECT COUNT(*) AS n FROM grants`).get().n, 1);
    assert.equal(w.db.prepare(
      `SELECT COUNT(*) AS n FROM outbox`).get().n, 1);
    // The report lands; the job's revision advances; one retry
    // produces exactly one successor carrying the new revision.
    w.db.prepare(
      `UPDATE grants SET state = 'reported' WHERE grant_id = ?`)
      .run(grantId);
    const occId = w.db.prepare(
      `SELECT occurrence_id FROM occurrences WHERE job_id = ?`)
      .get(jobId).occurrence_id;
    w.db.prepare(
      `UPDATE occurrences SET state = 'pending'
        WHERE occurrence_id = ?`).run(occId);
    w.db.prepare(
      `UPDATE jobs SET revision = 2 WHERE job_id = ?`).run(jobId);
    schedRow(w, "retry_grant", T0 - HOUR, jobId);
    await w.fireClassAlarm();
    const grants = w.db.prepare(
      `SELECT grant_id FROM grants ORDER BY created_at`).all();
    assert.equal(grants.length, 2);
    assert.equal(grants[1].grant_id, `grant:${jobId}:2:full`);
  });
});

// ----------------------------------------------------------------
describe("Chapter 6 adjudication (T-A3-11, T-A3-25)", () => {
  test("T-A3-11 / T-A3-25(a) the fallback pass resolves the granted occurrence to outcome_unknown; everything else is untouched; expected expenditure zero", async () => {
    const w = await liveWorld();
    await activate(w);
    const f = buildS3Fixture(w);
    await w.fireScheduled(CRON, T0);
    assert.equal(lastLog(w).action, "fallback_completed");
    assert.equal(occState(w, f.jobId, f.grantedOcc),
      "outcome_unknown");
    assert.equal(jobState(w, f.jobId), "outcome_unknown");
    for (let i = 0; i < 10; i++)
      assert.equal(occState(w, f.jobId, f.occIds[i]), "ready");
    for (let i = 11; i < 14; i++)
      assert.equal(occState(w, f.jobId, f.occIds[i]), "pending");
    // No new grants, no sends, no new attempts, no spend.
    assert.equal(w.db.prepare(
      `SELECT COUNT(*) AS n FROM grants`).get().n, 1);
    assert.equal(w.queue.sendCalls, 0);
    assert.equal(w.db.prepare(
      `SELECT COUNT(*) AS n FROM d6_attempt_log`).get().n, 1);
    const att = w.db.prepare(
      `SELECT phase, outcome FROM d6_attempt_log`).get();
    assert.deepEqual([att.phase, att.outcome],
      ["dispatching", null]);
    // The only ledger row is the fixture's pre-existing
    // reservation: no release, no settlement, no new spend.
    assert.equal(w.db.prepare(
      `SELECT COUNT(*) AS n FROM ledger_ops`).get().n, 1);
  });

  test("T-A3-25(b) adoption boundary: with the shipped probe the pass leaves the occurrence unknown even with audio present; a keyFor-capable probe adopts it exactly once", async () => {
    const w = await liveWorld({ richBucket: true });
    await activate(w);
    const f = buildS3Fixture(w);
    const key = "cd".repeat(32);
    w.db.prepare(
      `UPDATE occurrences SET cache_key = ?
        WHERE occurrence_id = ?`).run(key, f.grantedOcc);
    const bytes = new Uint8Array([9, 8, 7, 6, 5]);
    await w.bucket.put(`audio/${key}.wav`, bytes);
    await w.fireScheduled(CRON, T0);
    // The shipped request-cache probe's keyFor returns null:
    // branch (a) cannot fire through ANY pass in this build —
    // the occurrence stays unknown, nothing is bound, nothing
    // is spent. (Identical on the pre-A-3 build; not an A-3
    // regression. See IMPLEMENTATION-NOTES.)
    assert.equal(occState(w, f.jobId, f.grantedOcc),
      "outcome_unknown");
    assert.equal(w.db.prepare(
      `SELECT COUNT(*) AS n FROM bindings`).get().n, 0);
    assert.equal(w.queue.sendCalls, 0);
    // A coordinator whose probe can name the key adopts the
    // present object exactly once, through the same
    // reconcileUnknown path the pass invoked.
    const { createHash } = await import("node:crypto");
    const sha = createHash("sha256").update(bytes).digest("hex");
    const { GenerationCoordinator } = await import(
      "file://" + join(CAND, "v2", "coordinator.mjs"));
    const probe = {
      keyFor: () => key,
      exists: () => true,
      sniff: () => "wav",
      hash: () => sha,
      recordedSha256: () => sha,
      recordedIdentity: () => "rk-ch6-10",
    };
    const coord2 = new GenerationCoordinator(w.state,
      { ...w.classEnv, probe }, w.kv);
    const r = coord2.reconcileUnknown(f.jobId, f.grantedOcc);
    assert.deepEqual([r.ok, r.exit], [true, "adopted"]);
    assert.equal(occState(w, f.jobId, f.grantedOcc), "ready");
    assert.equal(w.db.prepare(
      `SELECT COUNT(*) AS n FROM bindings
        WHERE occurrence_id = ?`).get(f.grantedOcc).n, 1);
    assert.equal(jobState(w, f.jobId), "queued",
      "the job resumes once its unknown occurrence resolves " +
      "(the resolver's own mapping: bound work with pending " +
      "occurrences and no live grant is queued for drive)");
  });

  test("T-A3-25(c) handoff-uncertain: an attempted-but-unconfirmed dispatch converges without spend or resynthesis", async () => {
    const w = await liveWorld();
    await activate(w);
    const f = buildS3Fixture(w, { outboxSent: false });
    await w.fireScheduled(CRON, T0);
    assert.equal(lastLog(w).action, "fallback_completed");
    assert.equal(w.db.prepare(
      `SELECT state FROM grants WHERE grant_id = ?`)
      .get(f.grantId).state, "handoff_uncertain");
    assert.equal(occState(w, f.jobId, f.grantedOcc), "granted");
    assert.equal(w.db.prepare(
      `SELECT COUNT(*) AS n FROM grants`).get().n, 1);
    assert.equal(w.queue.sendCalls, 0);
    assert.equal(w.db.prepare(
      `SELECT COUNT(*) AS n FROM ledger_ops`).get().n, 1,
      "only the fixture's pre-existing reservation");
  });
});

// ----------------------------------------------------------------
describe("RC-2 under mixed evidence (T-A3-10, T-A3-22, T-A3-35)", () => {
  test("T-A3-10 scheduled passes never discharge an A-1 strike: two fallback passes leave the intent standing; two native passes discharge it", async () => {
    const w = await liveWorld();
    await activate(w);
    await registeringEval(w);
    // Two admitted scheduled passes over stall fixtures.
    // (The second stall is due after the first pass finished;
    // an earlier due would read as PASS_WITHOUT_PROGRESS.)
    for (let i = 0; i < 2; i++) {
      schedRow(w, "lease",
        i === 0 ? T0 - 2 * HOUR : T0 + 15 * MIN,
        "grant:missing:fixture");
      w.seedAlarm(null);
      w.advance(i === 0 ? 0 : 30 * MIN);
      await w.fireScheduled(CRON, T0 + i * 30 * MIN);
      assert.equal(lastLog(w).action, "fallback_completed");
    }
    let repair = w.coord.repairStatus();
    assert.equal(repair.derivation.effectiveStrikes, 1,
      "the strike stands: scheduled passes never count");
    assert.deepEqual(repair.derivation.dischargedIntentIds, []);
    // Two native passes: the derivation discharges.
    await w.fireClassAlarm();
    await w.fireClassAlarm();
    repair = w.coord.repairStatus();
    assert.equal(repair.derivation.effectiveStrikes, 0);
    assert.deepEqual(repair.derivation.dischargedIntentIds, [1]);
    const rows = passes(w);
    assert.deepEqual(rows.map((r) => r.entry_kind),
      ["scheduled_fallback", "scheduled_fallback",
       "native_alarm", "native_alarm"]);
    assert.deepEqual(rows.map((r) => r.seq), [1, 2, 3, 4]);
  });

  test("T-A3-22 migration: a pre-A-3 recorder migrates in one transaction; derivations are identical across it; post-migration windows fail closed on scheduled and unknown kinds", async () => {
    const w = await makeWorld(CAND, {});
    await registeringEval(w);
    // The pre-A-3 recorder shape, written by hand.
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
    const before = w.coord.repairStatus();
    assert.deepEqual(before.derivation.dischargedIntentIds, [1],
      "legacy derivation discharges on the old shape");
    // Migrate.
    assert.equal(w.inst._ensureA3Schema(), true);
    const cols = w.db.prepare(
      `PRAGMA table_info(d6_drive_passes)`).all()
      .map((c) => c.name);
    for (const c of ["entry_kind", "seq", "admitted_at",
        "exit_armed", "assurance_fired"])
      assert.ok(cols.includes(c), c);
    assert.deepEqual(passes(w).map((r) => r.seq), [1, 2]);
    const after = w.coord.repairStatus();
    assert.deepEqual(after.derivation.dischargedIntentIds, [1],
      "the derivation is identical across the migration");
    // A scheduled row inside a later intent's window blocks it.
    await registeringEval(w);
    const intent2 = latestIntentId(w);
    const insKind = w.db.prepare(
      `INSERT INTO d6_drive_passes (at, finished_at, stage,
         drive_invoked, entry_kind, seq)
       VALUES (?, ?, 'complete', 1, ?, ?)`);
    const bump = (n) => w.db.prepare(
      `UPDATE d6_recorder_meta SET value = ?
        WHERE key = 'seq_counter'`).run(n);
    insKind.run(T0 + 3000, T0 + 3500, "scheduled_fallback", 3);
    insKind.run(T0 + 4000, T0 + 4500, "native_alarm", 4);
    bump(4);
    let repair = w.coord.repairStatus();
    assert.ok(!repair.derivation.dischargedIntentIds
      .includes(intent2),
      "no discharge: the only pair includes a scheduled row");
    insKind.run(T0 + 5000, T0 + 5500, "native_alarm", 5);
    bump(5);
    repair = w.coord.repairStatus();
    assert.ok(repair.derivation.dischargedIntentIds
      .includes(intent2),
      "the native pair after it discharges");
    // An unknown kind inside a window fails that window closed.
    await registeringEval(w);
    const intent3 = latestIntentId(w);
    insKind.run(T0 + 6000, T0 + 6500, "cron", 6);
    insKind.run(T0 + 7000, T0 + 7500, "native_alarm", 7);
    bump(7);
    repair = w.coord.repairStatus();
    assert.ok(!repair.derivation.dischargedIntentIds
      .includes(intent3));
    // The pre-A-3 build still operates over the migrated store
    // (its recorder read is the legacy projection).
    const wb = await makeWorld(BASE, { db: w.db });
    const baseRepair = wb.coord.repairStatus();
    assert.ok(Array.isArray(
      baseRepair.derivation.dischargedIntentIds));
  });

  test("T-A3-35 pruning can never manufacture adjacency: a seq gap left by a pruned scheduled row still blocks the pair; rows in an unresolved intent's window survive pruning", async () => {
    const w = await liveWorld();
    await registeringEval(w);
    // RC-2 counts only passes strictly after the intent's
    // completion timestamp: step the clock past it first.
    w.advance(1000);
    // native, scheduled, native — seqs 1, 2, 3. The tick's
    // stall is due after the first pass finished (an earlier
    // due would read as PASS_WITHOUT_PROGRESS, not a stall).
    await w.fireClassAlarm();
    schedRow(w, "lease", T0 + 5 * MIN, "grant:missing:fixture");
    w.seedAlarm(null);
    w.advance(20 * MIN);
    await activate(w);
    await w.fireScheduled(CRON, T0 + 20 * MIN + 1000);
    await w.fireClassAlarm();
    let repair = w.coord.repairStatus();
    assert.deepEqual(repair.derivation.dischargedIntentIds, [],
      "the scheduled row breaks the pair");
    // Delete the scheduled row (as pruning eventually would):
    // the natives become array-adjacent but keep their seq gap.
    w.db.prepare(
      `DELETE FROM d6_drive_passes
        WHERE entry_kind = 'scheduled_fallback'`).run();
    repair = w.coord.repairStatus();
    assert.deepEqual(repair.derivation.dischargedIntentIds, [],
      "adjacency is by seq, never manufactured by deletion");
    // A genuinely adjacent native pair discharges. By fixture
    // construction the pair is pass ids 3 and 4 (native passes
    // recorded third and fourth in this world).
    await w.fireClassAlarm();
    repair = w.coord.repairStatus();
    assert.deepEqual(repair.derivation.dischargedIntentIds, [1]);
    // Pruning protection: the pair that discharged intent 1 is
    // retained while the intent is unresolved-by-event (the
    // discharge here is derived, not persisted).
    for (let i = 0; i < 300; i++) await w.fireClassAlarm();
    const remaining = passes(w).map((r) => r.id);
    for (const id of [3, 4])
      assert.ok(remaining.includes(id),
        `qualifying pair row ${id} survives pruning`);
    repair = w.coord.repairStatus();
    assert.deepEqual(repair.derivation.dischargedIntentIds, [1]);
  });
});

// ----------------------------------------------------------------
describe("epochs, soak, disablement, rollback, WAIT hold (T-A3-18, T-A3-23, T-A3-24, T-A3-28, T-A3-34, T-A3-36, T-A3-37, T-A3-38)", () => {
  test("T-A3-18 epoch-spanning ticks: a tick from a dead epoch is refused as stale; a duplicate of the new epoch's admitted tick is refused at the watermark", async () => {
    const w = await liveWorld();
    await activate(w); // epoch 1
    stallFixture(w);
    await w.fireScheduled(CRON, T0);
    assert.equal(lastLog(w).action, "fallback_completed");
    await act(w, "deactivate");
    w.advance(HOUR);
    const a2 = await activate(w); // epoch 2 at T0 + 1h
    assert.equal(a2.epoch, 2);
    // A new stall forms in epoch 2 (due after the epoch-1
    // pass finished, so the predicate genuinely qualifies).
    schedRow(w, "lease", T0 + 15 * MIN, "grant:missing:epoch2");
    w.seedAlarm(null);
    // The epoch-1 tick (T0 + 30m) arrives late: it predates
    // the current activation and is refused as stale, even
    // though the predicate would qualify.
    await w.fireScheduled(CRON, T0 + 30 * MIN);
    assert.equal(lastLog(w).action, "skip_stale_epoch");
    assert.equal(lastLog(w).reason, "tick_predates_activation");
    assert.equal(passes(w).length, 1);
    // The new epoch's own tick admits; its duplicate does not.
    await w.fireScheduled(CRON, T0 + HOUR);
    assert.equal(lastLog(w).action, "fallback_completed");
    const dup = await tickDirect(w, T0 + HOUR);
    assert.equal(dup.body.action, "skip_duplicate");
    assert.equal(passes(w).length, 2);
  });

  test("T-A3-23 mixed-evidence soak: alternating native and scheduled passes across the pruning boundary keep derivations correct, the log bounded, and seq values unreused", async () => {
    const w = await liveWorld();
    await registeringEval(w); // intent 1, completion at T0
    w.advance(1000);
    await w.fireClassAlarm(); // pair, part 1 (id 1)
    await w.fireClassAlarm(); // pair, part 2 (id 2)
    assert.deepEqual(
      w.coord.repairStatus().derivation.dischargedIntentIds, [1]);
    await activate(w);
    // 40 rounds of stalls recovered by ticks, with a native
    // pass every fourth round.
    for (let i = 0; i < 40; i++) {
      // Due after the previous round's pass finished and
      // overdue by this round's tick: a genuine fresh stall
      // each round, never PASS_WITHOUT_PROGRESS evidence.
      schedRow(w, "lease", w.clock.now + 10 * MIN,
        "grant:missing:soak");
      w.seedAlarm(null);
      w.advance(30 * MIN);
      await w.fireScheduled(CRON, w.clock.now);
      assert.equal(lastLog(w).action, "fallback_completed",
        `round ${i}`);
      if (i % 4 === 3) await w.fireClassAlarm();
    }
    // Bulk native passes push the recorder well past its
    // 288-row retention: pruning engages during the soak.
    for (let i = 0; i < 260; i++) await w.fireClassAlarm();
    const rows = passes(w);
    assert.ok(rows.length <= 288 + 2,
      `retention holds (${rows.length} rows)`);
    // The original qualifying pair survived pruning (the
    // intent is unresolved by any persisted event).
    assert.ok(rows.some((r) => r.id === 1));
    assert.ok(rows.some((r) => r.id === 2));
    assert.deepEqual(
      w.coord.repairStatus().derivation.dischargedIntentIds, [1]);
    // Seq: strictly increasing with id, never reused — the
    // durable counter equals the number of passes ever
    // recorded (2 + 40 + 10 + 260 = 312).
    const seqs = rows.map((r) => r.seq);
    assert.equal(new Set(seqs).size, seqs.length);
    assert.deepEqual(seqs, [...seqs].sort((a, b) => a - b));
    assert.equal(w.db.prepare(
      `SELECT value FROM d6_recorder_meta
        WHERE key = 'seq_counter'`).get().value, 312);
    // The scheduler log is bounded at its own retention.
    assert.ok(w.db.prepare(
      `SELECT COUNT(*) AS n FROM d6_scheduler_log`).get().n <= 288);
  });

  test("T-A3-24 in-flight deactivation: the four stages land in order and the disposition resolves when the noted pass drains", async () => {
    const w = await liveWorld();
    await activate(w);
    stallFixture(w);
    const realCache = w.inst._cache.bind(w.inst);
    let release;
    const parked = new Promise((r) => { release = r; });
    let calls = 0;
    w.inst._cache = async (...a) => {
      calls++;
      if (calls === 1) await parked;
      return realCache(...a);
    };
    const tickP = w.fireScheduled(CRON, T0);
    await until(() => schedState(w)?.admitted_watermark === T0);
    const activeRow = w.db.prepare(
      `SELECT identity FROM d6_active_pass`).get();
    assert.ok(activeRow);
    const d = await act(w, "deactivate");
    assert.equal(d.body.outcome, "applied");
    assert.equal(d.body.disposition, "in_flight_noted");
    let st = schedState(w);
    assert.equal(st.in_flight_identity, activeRow.identity);
    assert.equal(st.disablement_disposition, null,
      "unresolved while the noted pass is in flight — never " +
      "reported as a safe drain");
    let kinds = schedEvents(w).map((e) => e.kind);
    assert.deepEqual(kinds.slice(-2),
      ["admission_disabled", "in_flight_noted"]);
    release();
    await tickP;
    st = schedState(w);
    assert.equal(st.disablement_disposition, "drained_normally");
    await act(w, "note_trigger_removed");
    kinds = schedEvents(w).map((e) => e.kind);
    const order = ["admission_disabled", "in_flight_noted",
      "drained", "trigger_removal_confirmed"]
      .map((k) => kinds.indexOf(k));
    assert.deepEqual(order, [...order].sort((a, b) => a - b));
    assert.ok(order.every((i) => i >= 0));
  });

  test("T-A3-28 dormant native equivalence: with the scheduler never activated, native passes are indistinguishable from the pre-A-3 build, and a stray tick is inert", async () => {
    const fixture = async (tree) => {
      const w = await makeWorld(tree,
        { envOverrides: { GENERATION_HALT: "0" } });
      schedRow(w, "watchdog", T0 - HOUR);
      schedRow(w, "lease", T0 - HOUR, "grant:missing:fixture");
      w.seedAlarm(T0 - HOUR);
      await w.fireClassAlarm();
      w.advance(10 * MIN);
      await w.fireClassAlarm();
      return w;
    };
    const wc = await fixture(CAND);
    const wb = await fixture(BASE);
    assert.deepEqual(wc.alarmCalls, wb.alarmCalls,
      "identical registration write sequences");
    const core = (rows) => rows.map((r) => ({
      at: r.at, stage: r.stage, drive_invoked: r.drive_invoked,
      error_name: r.error_name, armed_after: r.armed_after }));
    assert.deepEqual(core(passes(wc)), core(passes(wb)));
    for (const r of passes(wc)) {
      assert.equal(r.entry_kind, "native_alarm");
      assert.equal(r.assurance_fired, 0);
      assert.equal(r.exit_armed, r.armed_after);
    }
    // A stray tick on the dormant candidate changes nothing.
    const before = passes(wc).length;
    await wc.fireScheduled(CRON, T0);
    assert.equal(lastLog(wc).classification, "INELIGIBLE");
    assert.equal(lastLog(wc).reason, "scheduler_not_active");
    assert.equal(passes(wc).length, before);
  });

  test("T-A3-34 interrupted migration: a kill inside the migration transaction rolls back completely; a rerun lands byte-identical schema state to a clean run", async () => {
    const buildOld = async () => {
      const w = await makeWorld(CAND, {});
      await registeringEval(w);
      w.db.exec(`CREATE TABLE IF NOT EXISTS d6_drive_passes (
        id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL,
        finished_at INTEGER, stage TEXT, drive_invoked INTEGER,
        outcomes_json TEXT, outcomes_truncated INTEGER,
        error_name TEXT, error_message TEXT,
        armed_after INTEGER)`);
      const ins = w.db.prepare(
        `INSERT INTO d6_drive_passes (at, finished_at, stage,
           drive_invoked) VALUES (?, ?, 'complete', 1)`);
      ins.run(T0 + 1000, T0 + 1500);
      ins.run(T0 + 2000, T0 + 2500);
      return w;
    };
    const w = await buildOld();
    w.faults.sql = {
      match: (q) => {
        if (q.includes("INSERT INTO d6_recorder_meta")) {
          w.faults.sql = null; // one-shot
          return true;
        }
        return false;
      },
      error: new Error("migration kill") };
    assert.equal(w.inst._ensureA3Schema(), false);
    const cols = w.db.prepare(
      `PRAGMA table_info(d6_drive_passes)`).all()
      .map((c) => c.name);
    assert.ok(!cols.includes("seq"),
      "the interrupted migration left no partial schema");
    assert.deepEqual(
      w.coord.repairStatus().derivation.dischargedIntentIds, [1],
      "the legacy derivation still works on the un-migrated shape");
    assert.equal(w.inst._ensureA3Schema(), true);
    // Clean-run control: identical seq assignment + watermark.
    const wc = await buildOld();
    assert.equal(wc.inst._ensureA3Schema(), true);
    const shape = (x) => ({
      seqs: passes(x).map((r) => r.seq),
      watermark: x.db.prepare(
        `SELECT value FROM d6_recorder_meta
          WHERE key = 'migration_watermark'`).get().value });
    assert.deepEqual(shape(w), shape(wc));
    assert.deepEqual(shape(w), { seqs: [1, 2], watermark: 2 });
  });

  test("T-A3-36 rollback gate (procedural fixture, addendum §C6/I6): scheduled evidence refuses the original build outright; migration alone demands a compatibility proof, never a bare permit; the scheduler-disabled candidate preserves derivations", async () => {
    // The gate as a census over durable state — the procedure
    // a rollback would have to pass. It is a fixture of the
    // procedure, not shipped code.
    const gate = (w) => {
      const scheduled = w.db.prepare(
        `SELECT COUNT(*) AS n FROM d6_drive_passes
          WHERE entry_kind = 'scheduled_fallback'`).get().n;
      let migrated = false;
      try {
        migrated = !!w.db.prepare(
          `SELECT value FROM d6_recorder_meta
            WHERE key = 'migration_watermark'`).get();
      } catch { migrated = false; }
      return scheduled > 0 ? "refused_scheduled_evidence"
        : migrated ? "requires_compatibility_proof"
        : "permitted_never_migrated";
    };
    // (1) Scheduled evidence exists: refused.
    const w1 = await liveWorld();
    await activate(w1);
    stallFixture(w1);
    await w1.fireScheduled(CRON, T0);
    assert.equal(gate(w1), "refused_scheduled_evidence");
    // (2) Dormant but migrated: no scheduled rows, yet the
    // gate still refuses a bare permit — and the candidate
    // with the scheduler never activated preserves the
    // derivation exactly.
    const w2 = await liveWorld();
    await registeringEval(w2);
    w2.advance(1000);
    await w2.fireClassAlarm();
    await w2.fireClassAlarm();
    assert.equal(gate(w2), "requires_compatibility_proof");
    const dBefore =
      w2.coord.repairStatus().derivation.dischargedIntentIds;
    assert.deepEqual(dBefore, [1]);
    // (3) A pre-A-3 build writing into the migrated store
    // leaves NULL-seq rows that can never form a qualifying
    // pair: the derivation fails closed around them.
    await registeringEval(w2); // intent 2, window opens here
    const intent2 = latestIntentId(w2);
    w2.advance(1000); // pair rows must postdate the completion
    const wb = await makeWorld(BASE, { db: w2.db });
    await wb.fireClassAlarm(); // old recorder: seq stays NULL
    const nullRow = w2.db.prepare(
      `SELECT seq FROM d6_drive_passes ORDER BY id DESC LIMIT 1`)
      .get();
    assert.equal(nullRow.seq, null);
    await w2.fireClassAlarm(); // one native pass after it
    assert.deepEqual(
      w2.coord.repairStatus().derivation.dischargedIntentIds,
      [1], "intent 2 cannot discharge through the NULL-seq row");
    await w2.fireClassAlarm(); // a genuinely adjacent pair
    // HOLD ruling R2 (corrections round): the NULL-seq row is
    // IN intent 2's evaluation window, and the design of record
    // (§8) fails the intent CLOSED for any window containing a
    // post-migration NULL-kind row — a later adjacent pair does
    // not rescue it; the intent is surfaced as fail-closed and
    // its disposition is the operator acknowledgment path, not
    // recorder evidence. (The pre-corrections pair-skipping
    // derivation discharged intent 2 here; the ruling withdrew
    // that semantics.)
    const dAfter = w2.coord.repairStatus().derivation;
    assert.deepEqual(dAfter.dischargedIntentIds, [1],
      "the poisoned window never discharges by recorder rows");
    assert.ok(dAfter.failClosedIntentIds.includes(intent2),
      "the poisoned intent is surfaced as fail-closed");
  });

  test("T-A3-37 disablement dispositions: drained_normally only on evidence; a killed in-flight pass resolves to interrupted_or_unknown at supersede, never before", async () => {
    // Nothing in flight: immediate drained_normally.
    const w = await liveWorld();
    await activate(w);
    const d = await act(w, "deactivate");
    assert.equal(d.body.disposition, "drained_normally");
    assert.equal(schedState(w).disablement_disposition,
      "drained_normally");
    // In flight, then killed: unresolved at deactivation,
    // still unresolved while the record stands, resolved by
    // the next admission's supersede.
    const w2 = await liveWorld();
    const A = w2.spawnInstance();
    w2.setCurrentInstance(A.inst);
    await activate(w2);
    stallFixture(w2);
    const realCache = A.inst._cache.bind(A.inst);
    let calls = 0;
    A.inst._cache = async (...a) => {
      calls++;
      if (calls === 1) await new Promise(() => {});
      return realCache(...a);
    };
    const tickP = w2.fireScheduled(CRON, T0);
    tickP.catch(() => {});
    await until(() => schedState(w2)?.admitted_watermark === T0);
    const d2 = await act(w2, "deactivate");
    assert.equal(d2.body.disposition, "in_flight_noted");
    assert.equal(schedState(w2).disablement_disposition, null);
    A.revoke();
    assert.equal(schedState(w2).disablement_disposition, null,
      "a dead instance's pass is never reported drained");
    const B = w2.spawnInstance();
    w2.setCurrentInstance(B.inst);
    await act(w2, "activate");
    w2.advance(30 * MIN);
    await w2.fireScheduled(CRON, T0 + 30 * MIN);
    assert.equal(schedState(w2).disablement_disposition,
      "interrupted_or_unknown");
  });

  test("T-A3-38 / T-A3-09b the WAIT hold (I5): set only by the operator action, never cleared by ticks or activation changes, and a failed hold write is not a hold", async () => {
    const w = await liveWorld();
    await activate(w);
    const set = await act(w, "set_wait_hold");
    assert.equal(set.body.outcome, "applied");
    assert.equal(set.body.waitHoldActive, true);
    stallFixture(w);
    // Ticks with fully successful observations admit nothing.
    await w.fireScheduled(CRON, T0);
    assert.equal(lastLog(w).classification, "WAIT_HOLD");
    assert.equal(lastLog(w).action, "skip_ineligible");
    assert.equal(passes(w).length, 0);
    assert.equal(schedState(w).admitted_watermark, null);
    w.advance(30 * MIN);
    await w.fireScheduled(CRON, T0 + 30 * MIN);
    assert.equal(lastLog(w).classification, "WAIT_HOLD");
    // Activation changes never clear it (I5).
    await act(w, "deactivate");
    await activate(w);
    assert.equal((await status(w)).waitHold.active, true);
    await w.fireScheduled(CRON, T0 + HOUR);
    assert.equal(lastLog(w).classification, "WAIT_HOLD");
    // Clear it; the next tick admits.
    const cleared = await act(w, "clear_wait_hold");
    assert.equal(cleared.body.waitHoldActive, false);
    w.advance(90 * MIN);
    await w.fireScheduled(CRON, T0 + 2 * HOUR);
    assert.equal(lastLog(w).action, "fallback_completed");
    // A failed hold-setting write leaves no hold behind.
    w.faults.sql = { match: (q) =>
      q.includes("UPDATE d6_scheduler_state"),
      error: new Error("hold write fault") };
    const failed = await entryPost(w,
      "/v2/d6-scheduler-activation",
      { action: "set_wait_hold", authorizationRef: "battery:a3",
        reason: "hold write fault" },
      { operator: true, client: false });
    assert.equal(failed.status, 500);
    w.faults.sql = null;
    assert.equal((await status(w)).waitHold.active, false,
      "a failed or ambiguous hold write is never confirmation");
  });
});

// ----------------------------------------------------------------
// Corrections round (Rowan's IMPLEMENTATION HOLD ruling,
// R2–R7). These tests are additive: every pre-corrections test
// above stands, with three ruling-driven expectation corrections
// disclosed in place (T-A3-19, T-A3-21, T-A3-36).
describe("corrections round (HOLD ruling R2–R7)", () => {
  const insPass = (w, at, kind, seq) => w.db.prepare(
    `INSERT INTO d6_drive_passes (at, finished_at, stage,
       drive_invoked, entry_kind, seq)
     VALUES (?, ?, 'complete', 1, ?, ?)`).run(at, at + 500, kind, seq);
  const bumpSeq = (w, n) => w.db.prepare(
    `UPDATE d6_recorder_meta SET value = ?
      WHERE key = 'seq_counter'`).run(n);

  test("T-A3-39 R2 fault injection: in a migrated world, a failed extended recorder read fails CLOSED — the legacy SELECT never substitutes, and scheduled rows under it yield no discharge", async () => {
    const w = await world();
    await registeringEval(w);
    const intent = latestIntentId(w);
    w.inst._ensureA3Schema();
    // Two scheduled complete passes inside the intent's
    // window. Under the pre-corrections fallback, a failed
    // extended read re-read these rows WITHOUT kind/seq (the
    // legacy SELECT) and the pair discharged the strike.
    insPass(w, T0 + 1000, "scheduled_fallback", 1);
    insPass(w, T0 + 2000, "scheduled_fallback", 2);
    bumpSeq(w, 2);
    // Control: with reads healthy, scheduled rows do not
    // discharge (the standing RC-2 rule).
    let repair = w.coord.repairStatus();
    assert.equal(repair.derivation.recorderVerified, true);
    assert.deepEqual(repair.derivation.dischargedIntentIds, []);
    // Inject the failure into the extended SELECT only (the
    // schema probes and the legacy SELECT do not match).
    w.faults.sql = {
      match: (q) => q.includes("seq, entry_kind"),
      error: new Error("injected extended-read failure") };
    repair = w.coord.repairStatus();
    assert.equal(repair.derivation.recorderVerified, false,
      "fail closed: the recorder read is reported unverified");
    assert.deepEqual(repair.derivation.dischargedIntentIds, [],
      "and no discharge is derived from it — under the " +
      "pre-corrections fallback this read discharged the " +
      "strike from the two scheduled rows");
    // With the fault cleared, the same world discharges on
    // genuine native evidence — the fault, not the evidence,
    // was the blocker.
    w.faults.sql = null;
    w.advance(60 * 1000); // pass timestamps must postdate the
    // intent's completion (the RC-2 evidence-ordering rule)
    await w.fireClassAlarm();
    await w.fireClassAlarm();
    repair = w.coord.repairStatus();
    assert.deepEqual(repair.derivation.dischargedIntentIds,
      [intent]);
  });

  test("T-A3-40 R2 window fail-closed: an unqualified row inside an intent's window poisons it (unknown kind; post-watermark NULL kind; NULL seq) — a well-formed scheduled row does not", async () => {
    const build = async (seed) => {
      const w = await world();
      await registeringEval(w);
      const intent = latestIntentId(w);
      w.inst._ensureA3Schema();
      seed(w);
      return { w, intent };
    };
    // (a) An unrecognized kind between native rows.
    {
      const { w, intent } = await build((w) => {
        insPass(w, T0 + 1000, "native_alarm", 1);
        insPass(w, T0 + 2000, "cron", 2);
        insPass(w, T0 + 3000, "native_alarm", 3);
        insPass(w, T0 + 4000, "native_alarm", 4);
        bumpSeq(w, 4);
      });
      const d = w.coord.repairStatus().derivation;
      assert.deepEqual(d.dischargedIntentIds, []);
      assert.ok(d.failClosedIntentIds.includes(intent));
    }
    // (b) A post-watermark NULL kind ahead of a native pair.
    {
      const { w, intent } = await build((w) => {
        insPass(w, T0 + 1000, null, 1);
        insPass(w, T0 + 2000, "native_alarm", 2);
        insPass(w, T0 + 3000, "native_alarm", 3);
        bumpSeq(w, 3);
      });
      const d = w.coord.repairStatus().derivation;
      assert.deepEqual(d.dischargedIntentIds, []);
      assert.ok(d.failClosedIntentIds.includes(intent));
    }
    // (c) A native-kind row with a NULL seq (the shape a
    // rolled-back build writes) ahead of a native pair.
    {
      const { w, intent } = await build((w) => {
        insPass(w, T0 + 1000, "native_alarm", null);
        insPass(w, T0 + 2000, "native_alarm", 1);
        insPass(w, T0 + 3000, "native_alarm", 2);
        bumpSeq(w, 2);
      });
      const d = w.coord.repairStatus().derivation;
      assert.deepEqual(d.dischargedIntentIds, []);
      assert.ok(d.failClosedIntentIds.includes(intent));
    }
    // (d) Control: a well-formed scheduled row in the window
    // breaks adjacency but does NOT poison — a later native
    // pair discharges.
    {
      const { w, intent } = await build((w) => {
        insPass(w, T0 + 1000, "scheduled_fallback", 1);
        insPass(w, T0 + 2000, "native_alarm", 2);
        insPass(w, T0 + 3000, "native_alarm", 3);
        bumpSeq(w, 3);
      });
      const d = w.coord.repairStatus().derivation;
      assert.deepEqual(d.dischargedIntentIds, [intent]);
      assert.deepEqual(d.failClosedIntentIds, []);
    }
  });

  test("T-A3-41 R3 watchdog-only worlds: timely armed idle is HEALTHY_IDLE; an overdue watchdog is overdue work (INTERVENE, or PASS_WITHOUT_PROGRESS when a complete pass postdates its due); unarmed not-yet-due is ABSENT_NOT_OVERDUE", async () => {
    // (a2) Watchdog pending, no registration, due in the
    // future: absent but not overdue.
    {
      const w = await liveWorld();
      await activate(w);
      schedRow(w, "watchdog", T0 + 10 * MIN);
      w.seedAlarm(null);
      await w.fireScheduled(CRON, T0);
      assert.equal(lastLog(w).classification, "ABSENT_NOT_OVERDUE");
      assert.equal(passes(w).length, 0);
    }
    // (b1) Overdue watchdog, registration absent, no complete
    // pass since its due: the watchdog row IS overdue work —
    // INTERVENE, and the fallback pass re-arms the chain.
    {
      const w = await liveWorld();
      await activate(w);
      schedRow(w, "watchdog", T0 - 2 * HOUR);
      w.seedAlarm(null);
      await w.fireScheduled(CRON, T0);
      assert.equal(lastLog(w).classification, "INTERVENE");
      assert.equal(lastLog(w).action, "fallback_completed");
      assert.equal(passes(w).length, 1);
      assert.equal(passes(w)[0].entry_kind, "scheduled_fallback");
      assert.ok(w.alarmAt() > T0, "the chain is re-armed");
    }
    // (b2) Overdue watchdog, but a complete pass finished
    // after its due: PASS_WITHOUT_PROGRESS, report-only.
    {
      const w = await liveWorld();
      await activate(w);
      w.inst._ensureA3Schema();
      schedRow(w, "watchdog", T0 - 2 * HOUR);
      insPass(w, T0 - HOUR, "native_alarm", 1);
      bumpSeq(w, 1);
      w.seedAlarm(null);
      await w.fireScheduled(CRON, T0);
      assert.equal(lastLog(w).classification,
        "PASS_WITHOUT_PROGRESS");
      assert.equal(passes(w).length, 1,
        "report-only: no fallback pass was admitted");
    }
    // (b3) Overdue watchdog with its registration standing at
    // its due (also overdue): INTERVENE / overdue_registration.
    {
      const w = await liveWorld();
      await activate(w);
      schedRow(w, "watchdog", T0 - 2 * HOUR);
      w.seedAlarm(T0 - 2 * HOUR);
      await w.fireScheduled(CRON, T0);
      assert.equal(lastLog(w).classification, "INTERVENE");
      assert.equal(lastLog(w).reason, "overdue_registration");
      assert.equal(lastLog(w).action, "fallback_completed");
    }
  });

  test("T-A3-42 R4 stale observation: a native pass completes during the tick's registration await and leaves a different registration — the tick refuses as stale and admits nothing, though overdue work remains", async () => {
    const w = await liveWorld();
    await activate(w);
    stallFixture(w);
    const release = w.deferGetAlarm();
    const tickP = w.fireScheduled(CRON, T0);
    tickP.catch(() => {});
    await settle(); // the tick is parked at its final read
    // The native pass completes during the await: it processes
    // the due rows, records a complete pass, and leaves a
    // registration (the advanced watchdog's due) where the
    // tick observed none.
    await w.fireClassAlarm();
    assert.equal(passes(w).length, 1);
    assert.equal(passes(w)[0].entry_kind, "native_alarm");
    // Overdue work is still present when the stretch runs.
    schedRow(w, "lease", T0 - 2 * HOUR, "grant:missing:fixture-2");
    release(null); // the tick's read: the pre-pass registration
    await tickP;
    assert.equal(lastLog(w).action, "skip_stale_observation");
    assert.equal(lastLog(w).reason, "stale_alarm_observation");
    assert.equal(passes(w).length, 1,
      "the tick admitted no fallback pass on stale evidence");
    assert.equal(schedState(w).admitted_watermark, null);
  });

  test("T-A3-43 R5 malformed WAIT hold: a hold value that is neither the valid active nor the valid inactive representation fails closed — at the initial observation and inside the admission stretch", async () => {
    // Initial observation.
    {
      const w = await liveWorld();
      await activate(w);
      stallFixture(w);
      w.db.prepare(
        `UPDATE d6_scheduler_state SET wait_hold_active = 2
          WHERE id = 1`).run();
      await w.fireScheduled(CRON, T0);
      assert.equal(lastLog(w).classification, "READ_FAILURE");
      assert.equal(lastLog(w).reason, "wait_hold_unverifiable");
      assert.equal(passes(w).length, 0);
      assert.equal(schedState(w).admitted_watermark, null);
    }
    // Inside the stretch: the hold is corrupted while the tick
    // is parked at its registration read.
    {
      const w = await liveWorld();
      await activate(w);
      stallFixture(w);
      const release = w.deferGetAlarm();
      const tickP = w.fireScheduled(CRON, T0);
      tickP.catch(() => {});
      await settle();
      w.db.prepare(
        `UPDATE d6_scheduler_state SET wait_hold_active = 2
          WHERE id = 1`).run();
      release(null);
      await tickP;
      assert.equal(lastLog(w).action, "skip_revalidation");
      assert.equal(lastLog(w).reason, "wait_hold_unverifiable");
      assert.equal(passes(w).length, 0);
      assert.equal(schedState(w).admitted_watermark, null);
    }
  });

  test("T-A3-44 R6(a) assurance outcomes: the pass record distinguishes verified (read-back armed), suppressed (containment returns normally, read-back still null), and failed (the re-arm itself throws) — a normal _armAlarm return is never itself the evidence", async () => {
    // (i) Verified: the consumed registration is re-armed and
    // the read-back observes it.
    {
      const w = await liveWorld();
      schedRow(w, "lease", T0 + 10 * MIN, "grant:future:fixture");
      schedRow(w, "watchdog", T0 + 10 * MIN);
      w.seedAlarm(T0 + 10 * MIN);
      const realSet = w.storage.setAlarm.bind(w.storage);
      let consumed = false;
      w.storage.setAlarm = async (t) => {
        await realSet(t);
        if (!consumed) {
          consumed = true;
          await w.storage.deleteAlarm();
        }
      };
      await w.fireClassAlarm();
      const [row] = passes(w);
      assert.equal(row.assurance_fired, 1);
      assert.equal(row.assurance_outcome, "verified");
      assert.equal(row.exit_armed, null,
        "exit_armed stays the exit read's own value");
      assert.equal(row.assurance_armed_after, w.alarmAt());
      assert.ok(row.assurance_armed_after > T0);
    }
    // (ii) Suppressed: CHAIN_STOPPED — _armAlarm returns
    // normally having registered nothing; the read-back is
    // still null and the outcome is recorded as suppressed,
    // never as a success.
    {
      const w = await liveWorld();
      schedRow(w, "lease", T0 + 10 * MIN, "grant:future:fixture");
      w.seedAlarm(null);
      await w.coord.applyContainmentTransition("stop_chain",
        "battery:a3", { reason: "assurance outcome" });
      await w.fireClassAlarm();
      const [row] = passes(w);
      assert.equal(row.stage, "contained");
      assert.equal(row.assurance_fired, 1);
      assert.equal(row.assurance_outcome, "suppressed");
      assert.equal(row.assurance_armed_after, null);
      assert.equal(w.alarmAt(), null);
    }
    // (iii) Failed: the assurance's own re-arm write throws —
    // the failure is captured, noted on the scheduler event
    // stream, and recorded as the outcome.
    {
      const w = await liveWorld();
      schedRow(w, "lease", T0 + 10 * MIN, "grant:future:fixture");
      schedRow(w, "watchdog", T0 + 10 * MIN);
      w.seedAlarm(T0 + 10 * MIN);
      const realSet = w.storage.setAlarm.bind(w.storage);
      let setCalls = 0;
      w.storage.setAlarm = async (t) => {
        setCalls++;
        if (setCalls === 2)
          throw new Error("re-arm write lost");
        await realSet(t);
        if (setCalls === 1) await w.storage.deleteAlarm();
      };
      await w.fireClassAlarm();
      const [row] = passes(w);
      assert.equal(row.assurance_fired, 1);
      assert.equal(row.assurance_outcome, "failed");
      assert.ok(schedEvents(w, "assurance_failed").length >= 1);
    }
  });

  test("T-A3-45 R6(b) unrecorded drain: when the admitted pass's own recording fails, the disposition is interrupted_or_unknown, the active-pass evidence is preserved, and no 'drained' is claimed", async () => {
    const w = await liveWorld();
    const A = w.spawnInstance();
    w.setCurrentInstance(A.inst);
    await activate(w);
    stallFixture(w);
    const realCache = A.inst._cache.bind(A.inst);
    let calls = 0;
    let releaseCache;
    A.inst._cache = async (...a) => {
      calls++;
      if (calls === 2)
        await new Promise((r) => { releaseCache = r; });
      return realCache(...a);
    };
    const tickP = w.fireScheduled(CRON, T0);
    tickP.catch(() => {});
    await until(() => schedState(w)?.admitted_watermark === T0);
    const d = await act(w, "deactivate");
    assert.equal(d.body.disposition, "in_flight_noted");
    // The pass completes in memory, but its pass-row write
    // fails: the completion was never durably recorded.
    w.faults.sql = {
      match: (q) => q.includes("INSERT INTO d6_drive_passes"),
      error: new Error("recorder write lost") };
    releaseCache();
    await tickP;
    w.faults.sql = null;
    assert.equal(passes(w).length, 0,
      "no pass row landed — the premise of the case");
    assert.equal(schedState(w).disablement_disposition,
      "interrupted_or_unknown");
    assert.ok(w.db.prepare(
      `SELECT * FROM d6_active_pass WHERE id = 1`).get(),
      "the active-pass evidence is preserved for the rollback gate");
    assert.ok(schedEvents(w, "drain_unrecorded").length >= 1);
    assert.equal(schedEvents(w, "drained").length, 0,
      "no normal drain was claimed");
  });

  test("T-A3-46 R7 effect boundaries: a continuation resumed after instance replacement initiates no new external effect; resumed publication adopts a digest-equal winner and refuses a differing one", async () => {
    // (a) The delivery path: instance A is parked inside its
    // pass (after base schedule processing, before the drive
    // stage) and revoked. Its continuation initiates nothing —
    // no grant, no outbox row, no queue send. The replacement's
    // pass converges the same durable intent exactly once.
    {
      const stub = makeQueueStub();
      const w = await liveWorldWithQueue(stub);
      await seedAttempt3Shape(w);
      w.classEnv.GENERATION_HALT = "0";
      const A = w.spawnInstance();
      const realCache = A.inst._cache.bind(A.inst);
      let calls = 0;
      let releaseCache;
      A.inst._cache = async (...a) => {
        calls++;
        if (calls === 2)
          await new Promise((r) => { releaseCache = r; });
        return realCache(...a);
      };
      const alarmP = A.inst.alarm();
      alarmP.catch(() => {});
      await until(() => calls === 2);
      A.revoke();
      releaseCache();
      let caught = null;
      try { await alarmP; } catch (e) { caught = e; }
      assert.ok(caught, "the revoked continuation fails");
      assert.equal(w.db.prepare(
        `SELECT COUNT(*) AS n FROM grants`).get().n, 0,
        "no grant was issued by the revoked continuation");
      assert.equal(w.db.prepare(
        `SELECT COUNT(*) AS n FROM outbox`).get().n, 0);
      assert.equal(stub.sendCalls, 0, "no send was initiated");
      const B = w.spawnInstance();
      w.setCurrentInstance(B.inst);
      await B.inst.alarm();
      assert.equal(w.db.prepare(
        `SELECT COUNT(*) AS n FROM grants`).get().n, 1);
      assert.equal(stub.sendCalls, 1,
        "the replacement sends exactly once");
    }
    // (b) The publication path (flush-store, the module the
    // census names): a resumed publication of the same bytes
    // adopts the existing object; a resumed publication of
    // different bytes for the same content key fails closed
    // and the winner's bytes stand.
    {
      const w = await world({ richBucket: true });
      const { createFlushStore, sha256Hex } = await import(
        join(CAND, "v2/generation/flush-store.mjs"));
      const bytes = new TextEncoder().encode(
        "synthetic audio bytes");
      const key = sha256Hex(bytes);
      const first = await createFlushStore(w.bucket, {})
        .flushAndVerify(key, bytes, "wav", 1);
      assert.ok(!first.adopted);
      const resumed = await createFlushStore(w.bucket, {})
        .flushAndVerify(key, bytes, "wav", 1);
      assert.equal(resumed.adopted, true,
        "the resumed publication adopts the digest-equal winner");
      assert.equal(w.bucket.objects.size, 1,
        "no second object was created");
      const other = new TextEncoder().encode("different bytes");
      await assert.rejects(
        createFlushStore(w.bucket, {})
          .flushAndVerify(key, other, "wav", 1),
        (e) => e && e.code === "winner_digest_mismatch");
      const winner = await w.bucket.get(first.objectKey);
      assert.equal(
        new TextDecoder().decode(await winner.arrayBuffer()),
        "synthetic audio bytes", "the winner's bytes stand");
    }
  });
});

// ----------------------------------------------------------------
// R4 CLOSURE (Rowan's CONDITIONAL IMPLEMENTATION PASS on the
// corrections round): the one remaining blocker was the
// admission stretch's stale-observation protection, which
// witnessed only RECORDER activity. The coordinator's alarm
// REVISION is the second, independent witness: every
// registration writer bumps it synchronously — including the
// command/report WAKE paths, which register without recording
// any pass, and including a native pass whose own pass-row
// write failed (its _armAlarm still bumped the revision). The
// tick captures the revision before its registration read; the
// admission stretch compares it and refuses WITHOUT consuming
// the tick when it moved. T-A3-47…50 exercise the fence through
// the REAL writers, per the ruling's required test list.
// T-A3-51/52 carry the R6 dormant exit-assurance qualification.
describe("R4 closure — registration revision fence (T-A3-47…50); dormant assurance qualification (T-A3-51, T-A3-52)", () => {

  test("T-A3-47 command wake: handleCommand's wake registers during the tick's observation with NO new pass row — the revision fence suppresses admission and does not consume the tick", async () => {
    const w = await liveWorld();
    await activate(w);
    stallFixture(w);
    const revBefore = w.coord._alarmRevision();
    const release = w.deferGetAlarm();
    const tickP = w.fireScheduled(CRON, T0);
    tickP.catch(() => {});
    await settle(); // parked at the final read; revision captured
    // A real command arrives. handleCommand wakes the
    // coordinator BEFORE its apply step; the wake registers
    // through _armAlarmIfEarlier — a registration writer that
    // records NO drive pass.
    const res = await w.coord.handleCommand({
      command_id: "battery-r4-command-wake",
      type: "RequestPause",
      payload: { jobId: "job:missing:fixture" } });
    assert.equal(res.outcome, "rejected",
      "the apply's business is immaterial — the wake is the act");
    assert.equal(w.alarmAt(), T0 - 2 * HOUR,
      "the wake registered at the earliest pending due");
    assert.ok(w.coord._alarmRevision() > revBefore,
      "the real wake path moved the revision fence");
    assert.equal(passes(w).length, 0,
      "no pass row exists — the recorder witness alone could " +
      "not have caught this registration");
    release(null); // the tick's read: the pre-wake registration
    await tickP;
    assert.equal(lastLog(w).action, "skip_revision_changed");
    assert.equal(lastLog(w).reason, "revision_changed");
    assert.equal(lastLog(w).classification, "UNMATCHED");
    assert.equal(schedState(w).admitted_watermark, null,
      "the tick was NOT consumed — its watermark stands");
    assert.equal(passes(w).length, 0,
      "no fallback pass was admitted on the invalidated observation");
    // Non-consumption is behavioral, not just a null watermark:
    // a LATER logical tick admits normally and the watermark
    // takes ITS time — the refused tick's slot was never
    // filled in. (The same identity is not redelivered here:
    // its skip row already occupies the log's unique identity,
    // and the admitted write is a plain INSERT — the response,
    // not the log, carries a same-identity redelivery's fate.)
    w.advance(30 * MIN);
    await w.fireScheduled(CRON, T0 + 30 * MIN);
    assert.equal(lastLog(w).action, "fallback_completed");
    assert.equal(passes(w).length, 1);
    assert.equal(passes(w)[0].entry_kind, "scheduled_fallback");
    assert.equal(schedState(w).admitted_watermark, T0 + 30 * MIN);
  });

  test("T-A3-48 report wake: handleReport's wake registers during the tick's observation with NO new pass row — same fence, same non-consumption", async () => {
    const w = await liveWorld();
    await activate(w);
    stallFixture(w);
    const revBefore = w.coord._alarmRevision();
    const release = w.deferGetAlarm();
    const tickP = w.fireScheduled(CRON, T0);
    tickP.catch(() => {});
    await settle(); // parked at the final read; revision captured
    // A real executor report arrives. handleReport wakes the
    // coordinator BEFORE it ever looks up the grant — the wake
    // registers, again with no pass row.
    const res = await w.coord.handleReport({
      grantId: "grant:missing:fixture", results: [] });
    assert.equal(res.ok, false);
    assert.equal(res.reason, "grant_not_found",
      "the report's own outcome is immaterial — the wake ran first");
    assert.equal(w.alarmAt(), T0 - 2 * HOUR,
      "the wake registered at the earliest pending due");
    assert.ok(w.coord._alarmRevision() > revBefore,
      "the real report path moved the revision fence");
    assert.equal(passes(w).length, 0);
    release(null); // the tick's read: the pre-wake registration
    await tickP;
    assert.equal(lastLog(w).action, "skip_revision_changed");
    assert.equal(lastLog(w).reason, "revision_changed");
    assert.equal(schedState(w).admitted_watermark, null,
      "the tick was NOT consumed");
    assert.equal(passes(w).length, 0,
      "no fallback pass was admitted on the invalidated observation");
  });

  test("T-A3-49 recorder failure: a native pass completes during the observation but its pass-row write FAILS — the recorder witness is blind, the revision fence still suppresses admission", async () => {
    const w = await liveWorld();
    await activate(w);
    stallFixture(w);
    const revBefore = w.coord._alarmRevision();
    const release = w.deferGetAlarm();
    const tickP = w.fireScheduled(CRON, T0);
    tickP.catch(() => {});
    await settle(); // parked at the final read; revision captured
    // The native pass runs during the await — and its own
    // recording is lost. The pass still processes the due rows
    // and still ARMS (its _armAlarm bump is independent of the
    // entry's recorder write), so the fence moved while the
    // recorder shows nothing at all.
    w.faults.sql = {
      match: (q) => q.includes("INSERT INTO d6_drive_passes"),
      error: new Error("recorder write lost") };
    await w.fireClassAlarm();
    w.faults.sql = null;
    assert.equal(passes(w).length, 0,
      "premise: no pass row landed — the recorder witness " +
      "has nothing to compare");
    assert.ok(w.alarmAt() !== null && w.alarmAt() > T0,
      "the pass armed the chain (its re-armed watchdog)");
    assert.ok(w.coord._alarmRevision() > revBefore,
      "and its arming moved the revision fence");
    // Fresh overdue work is present when the stretch runs, so
    // the fresh classifier evaluation on its own would admit —
    // the revision fence is the deciding refusal.
    schedRow(w, "lease", T0 - 2 * HOUR, "grant:missing:fixture-2");
    release(null); // the tick's read: the pre-pass registration
    await tickP;
    assert.equal(lastLog(w).action, "skip_revision_changed");
    assert.equal(lastLog(w).reason, "revision_changed");
    assert.equal(schedState(w).admitted_watermark, null,
      "the tick was NOT consumed");
    assert.equal(passes(w).length, 0,
      "no fallback pass was admitted, and none was recorded");
  });

  test("T-A3-50 control: unchanged revision and qualifying fresh observations retain the intended intervention — the fence does not over-suppress", async () => {
    const w = await liveWorld();
    await activate(w);
    stallFixture(w);
    const revBefore = w.coord._alarmRevision();
    await w.fireScheduled(CRON, T0);
    assert.equal(lastLog(w).action, "fallback_completed");
    assert.equal(passes(w).length, 1,
      "exactly one fallback pass was admitted");
    assert.equal(passes(w)[0].entry_kind, "scheduled_fallback");
    assert.equal(passes(w)[0].stage, "complete");
    assert.equal(schedState(w).admitted_watermark, T0);
    assert.ok(w.coord._alarmRevision() >= revBefore,
      "the admitted pass's own arming is after admission — " +
      "it is not evidence against the fence");
    // Exactly once: the same logical tick redelivered is a
    // duplicate against the consumed watermark, never a
    // second admission.
    const again = await tickDirect(w, T0);
    assert.equal(again.body.classification, "INELIGIBLE");
    assert.equal(again.body.reason, "duplicate_or_stale_tick");
    assert.equal(passes(w).length, 1);
  });

  test("T-A3-51 R6 dormant qualification (b): scheduler NEVER activated, a native pass loses its registration with rows still pending — the candidate's exit assurance restores it in the same pass and records the act; the pre-A-3 build leaves the loss standing", async () => {
    const fixture = async (tree) => {
      const w = await makeWorld(tree,
        { envOverrides: { GENERATION_HALT: "0" } });
      schedRow(w, "lease", T0 + 10 * MIN, "grant:future:fixture");
      schedRow(w, "watchdog", T0 + 10 * MIN);
      w.seedAlarm(T0 + 10 * MIN);
      // Registration-loss model (T-A3-44(i)'s): the pass's own
      // registration lands and is then lost before the exit
      // read — the platform consuming a registration without a
      // successor.
      const realSet = w.storage.setAlarm.bind(w.storage);
      let consumed = false;
      w.storage.setAlarm = async (t) => {
        await realSet(t);
        if (!consumed) {
          consumed = true;
          await w.storage.deleteAlarm();
        }
      };
      await w.fireClassAlarm();
      return w;
    };
    // Candidate, dormant: no activation call is ever made.
    const wc = await fixture(CAND);
    assert.equal(schedState(wc).state, "inactive",
      "the scheduler was never activated in this world");
    assert.equal(schedState(wc).epoch, 0);
    assert.equal(schedEvents(wc, "activated").length, 0);
    const [row] = passes(wc);
    assert.equal(row.assurance_fired, 1,
      "the assurance acted even though A-3 was never activated");
    assert.equal(row.assurance_outcome, "verified");
    assert.equal(row.exit_armed, null);
    assert.equal(row.assurance_armed_after, wc.alarmAt());
    assert.ok(wc.alarmAt() !== null && wc.alarmAt() > T0,
      "the chain stands re-armed out of the same pass");
    // Pre-A-3 twin: identical fixture, no exit assurance
    // exists — the identical registration loss stands.
    const wb = await fixture(BASE);
    assert.equal(wb.alarmAt(), null,
      "the pre-A-3 build leaves the lost registration absent " +
      "until some later wake — the delimited dormant delta");
  });

  test("T-A3-52 R6 dormant qualification (c): scheduler NEVER activated, a native pass FAILS with its registration lost and rows pending — assurance still runs on the failed pass's exit path, and the original error propagates unchanged", async () => {
    const fixture = async (tree) => {
      const w = await makeWorld(tree,
        { envOverrides: { GENERATION_HALT: "0" } });
      schedRow(w, "lease", T0 + 10 * MIN, "grant:future:fixture");
      schedRow(w, "watchdog", T0 + 10 * MIN);
      w.seedAlarm(null);
      const realSet = w.storage.setAlarm.bind(w.storage);
      let consumed = false;
      w.storage.setAlarm = async (t) => {
        await realSet(t);
        if (!consumed) {
          consumed = true;
          await w.storage.deleteAlarm();
        }
      };
      // The pass body fails AFTER the base alarm stage: the
      // base alarm's own cache construction (its first _cache
      // call, inside super.alarm()) succeeds — so the base
      // processing runs, and its finally-arm is the
      // registration the one-shot wrapper above loses — while
      // the pass's OWN cache construction (the second call, at
      // its construct stage) throws. The pass is recorded at
      // the throwing stage, never complete.
      const realCache = w.inst._cache.bind(w.inst);
      let cacheCalls = 0;
      w.inst._cache = async (...a) => {
        cacheCalls++;
        if (cacheCalls === 2)
          throw new Error("cache construction lost");
        return realCache(...a);
      };
      await assert.rejects(w.fireClassAlarm(),
        /cache construction lost/,
        "the native entry rethrows the original error unchanged");
      return w;
    };
    const wc = await fixture(CAND);
    assert.equal(schedState(wc).state, "inactive",
      "the scheduler was never activated in this world");
    const [row] = passes(wc);
    assert.notEqual(row.stage, "complete");
    assert.equal(row.error_name, "Error");
    assert.equal(row.assurance_fired, 1,
      "assurance runs on the FAILED pass's exit path too");
    assert.equal(row.assurance_outcome, "verified");
    assert.equal(row.exit_armed, null);
    assert.equal(row.assurance_armed_after, wc.alarmAt());
    assert.ok(wc.alarmAt() !== null,
      "the failed pass still left the chain re-armed");
    // Pre-A-3 twin: the same failure, the same lost
    // registration — and nothing restores it.
    const wb = await fixture(BASE);
    const [brow] = passes(wb);
    assert.notEqual(brow.stage, "complete");
    assert.equal(wb.alarmAt(), null,
      "the pre-A-3 build leaves the failed pass's chain unarmed");
  });
});
