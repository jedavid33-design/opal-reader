// P2 review round 6 (Rowan): two races inside round 5's new machinery.
//  1. A queue-probe verdict must act on the CURRENT grant state, not
//     the read taken before the await — a report or late ACK settling
//     the grant mid-probe makes the verdict stale, and a stale verdict
//     is a logged no-op (never a resurrection, never a void).
//  2. A freeze at verdict time must not strand a safely voided job:
//     the handoff decision defers across the freeze, and exactly one
//     durable deferred retry carries the job through thaw.
import test from "node:test";
import assert from "node:assert/strict";
import { makeHarness, makeProbe, occ, submit } from "./helpers/do-harness.mjs";

const OBJECTS = new Map([["key-o1", { format: "mp3", identity: "fp-o1", sha: "aaaa" }]]);
const SUCCESS = [{ occurrenceId: "o1", outcome: "success", revisionKey: "fp-o1", cacheKey: "key-o1" }];

// Drive a job into handoff_uncertain: dispatched, ACK lost, lease expired.
async function uncertain(h) {
  await submit(h.coord, "c1", "job-1", [occ("o1")]);
  const g = await h.coord.requestGrant("job-1");
  assert.equal(await h.coord.drainOutbox(() => { throw new Error("ack lost"); }), 0);
  const lease = h.rows("schedule").find(r => r.kind === "lease" && r.state === "pending");
  h.setNow(lease.due_at + 1000);
  await h.coord.alarm();
  assert.equal(h.rows("grants")[0].state, "handoff_uncertain");
  return g;
}

// Start an alarm whose handoff_check blocks on a deferred probe; wait
// (microtasks only — the harness has no real timers) until the probe
// has actually been invoked, so the interleaving is deterministic.
async function probeInFlight(h) {
  let resolveProbe, probeCalled = false;
  h.env.probeQueue = () => { probeCalled = true; return new Promise(res => { resolveProbe = res; }); };
  h.advance(31000);
  const alarmP = h.coord.alarm();
  for (let i = 0; i < 500 && !probeCalled; i++) await Promise.resolve();
  assert.ok(probeCalled, "handoff_check reached the probe");
  return { alarmP, settle: v => resolveProbe(v) };
}

test("race 1a: probe says ACCEPTED after a report already settled the grant -> stale, logged, grant stays reported", async () => {
  const h = makeHarness({ probe: makeProbe(OBJECTS) });
  const g = await uncertain(h);
  const { alarmP, settle } = await probeInFlight(h);
  // While the probe is in flight, the executor's report settles it all.
  const rep = await h.coord.handleReport({ grantId: g.grantId, jobRevision: 2, results: SUCCESS });
  assert.equal(rep.ok, true);
  assert.equal(h.rows("grants")[0].state, "reported");
  assert.equal(h.coord.jobView("job-1").state, "complete");
  settle("accepted");
  await alarmP;
  // The stale verdict resurrected nothing and opened no new lease.
  assert.equal(h.rows("grants")[0].state, "reported");
  assert.equal(h.coord.jobView("job-1").state, "complete");
  assert.equal(h.coord.jobView("job-1").occurrences[0].state, "ready");
  assert.equal(h.rows("schedule").filter(r => r.kind === "lease" && r.state === "pending").length, 0);
  assert.ok(h.rows("transitions").some(t => t.cause === "handoff_verdict_stale"));
});

test("race 1b: probe says NOT_ACCEPTED after a report already settled the grant -> stale, nothing voided or released", async () => {
  const h = makeHarness({ probe: makeProbe(OBJECTS) });
  const g = await uncertain(h);
  const { alarmP, settle } = await probeInFlight(h);
  const rep = await h.coord.handleReport({ grantId: g.grantId, jobRevision: 2, results: SUCCESS });
  assert.equal(rep.ok, true);
  assert.equal(h.rows("grants")[0].state, "reported");
  settle("not_accepted");
  await alarmP;
  // A delivered, completed grant was NOT voided by the stale verdict.
  assert.equal(h.rows("grants")[0].state, "reported");
  assert.equal(h.coord.jobView("job-1").occurrences[0].state, "ready");
  assert.equal(h.coord.jobView("job-1").state, "complete");
  assert.equal(h.rows("ledger_ops").filter(r => r.kind === "attempt_release").length, 0);
  assert.equal(h.coord.quotaView().attemptsToday, 1); // the real attempt still counts, once
  assert.ok(h.rows("transitions").some(t => t.cause === "handoff_verdict_stale"));
});

test("race 2: freeze at verdict time -> decision defers; thaw -> void + exactly one durable retry -> fresh grant, alarms only", async () => {
  const h = makeHarness({ probe: makeProbe(new Map(), () => null) });
  await uncertain(h);
  await h.coord.handleCommand({ command_id: "fz", type: "FreezeDirective", payload: { freeze: true } });
  h.env.probeQueue = () => "not_accepted"; // terminal proof, ready whenever it's asked
  h.advance(31000);
  await h.coord.alarm(); // the check comes due mid-freeze
  // Nothing was decided mid-freeze: still uncertain, still granted, and
  // the check itself is durably deferred — not consumed, not lost.
  assert.equal(h.rows("grants")[0].state, "handoff_uncertain");
  assert.equal(h.coord.jobView("job-1").occurrences[0].state, "granted");
  assert.equal(h.rows("schedule").filter(r => r.kind === "handoff_check" && r.state === "pending").length, 1);
  assert.equal(h.rows("ledger_ops").filter(r => r.kind === "attempt_release").length, 0);
  // Thaw. From here: alarms only, no client calls.
  await h.coord.handleCommand({ command_id: "fz2", type: "FreezeDirective", payload: { freeze: false } });
  h.advance(61000);
  await h.coord.alarm(); // deferred check runs: terminal verdict -> safe void + re-advance
  assert.equal(h.rows("grants")[0].state, "voided");
  assert.equal(h.coord.jobView("job-1").occurrences[0].state, "pending");
  assert.equal(h.coord.quotaView().attemptsToday, 0); // released exactly once
  assert.equal(h.rows("schedule").filter(r => r.kind === "retry_grant" && r.state === "pending").length, 1);
  h.advance(31000);
  await h.coord.alarm(); // the durable retry grants fresh work
  assert.equal(h.rows("grants").length, 2);
  assert.equal(h.coord.jobView("job-1").occurrences[0].state, "granted");
  h.advance(10 * 60000);
  await h.coord.alarm(); // watchdog delivers it
  assert.equal(h.sentGrants.filter(p => p.jobId === "job-1").length, 1);
  assert.equal(h.coord.quotaView().attemptsToday, 1); // one real attempt, counted once
});
