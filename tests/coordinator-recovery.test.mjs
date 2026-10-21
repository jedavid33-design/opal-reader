// P2: the five-point interruption matrix (§1.2) + autonomous recovery
// (Rowan criterion 1). Crashes are instance discards; storage persists.
import test from "node:test";
import assert from "node:assert/strict";
import { makeHarness, makeProbe, occ, submit } from "./helpers/do-harness.mjs";

test("seam ii: a grant committed but never sent is delivered after a crash, exactly once", () => {
  const h = makeHarness();
  submit(h.coord, "c1", "job-1", [occ("o1")]);
  const g = h.coord.requestGrant("job-1");
  assert.equal(g.ok, true);
  // crash before drainOutbox: the send never happened.
  const coord2 = h.crash();
  coord2.wake();
  assert.equal(coord2.drainOutbox(x => h.sentGrants.push(x)), 1);
  assert.equal(h.sentGrants[0].grantId, g.grantId);
  assert.equal(coord2.drainOutbox(x => h.sentGrants.push(x)), 0); // not twice
});

test("seam iii: executor dies after dispatch -> lease expiry -> outcome_unknown, never re-dispatched", async () => {
  const h = makeHarness({ probe: makeProbe(new Map()) });
  submit(h.coord, "c1", "job-1", [occ("o1"), occ("o2")]);
  const g = h.coord.requestGrant("job-1");
  h.coord.drainOutbox(x => h.sentGrants.push(x));
  h.coord.noteProviderRequest(g.grantId, "o1", "provider-req-1");
  // no report ever arrives; the lease (15 min) expires under the alarm.
  const lease = h.rows("schedule").find(r => r.kind === "lease");
  h.setNow(lease.due_at + 1000);
  await h.coord.alarm();
  const view = h.coord.jobView("job-1");
  assert.equal(view.state, "outcome_unknown");
  assert.deepEqual(view.occurrences.map(o => o.state), ["outcome_unknown", "outcome_unknown"]);
  // critically: nothing new was dispatched for them
  assert.equal(h.rows("outbox").length, 1);
  assert.equal(h.rows("grants").length, 1);
});

test("seam iii-a: reconciliation adopts audio that did land in the cache", async () => {
  const objects = new Map([["key-o1", { format: "mp3", identity: "fp-o1" }]]);
  const probe = makeProbe(objects, o => (o.occurrence_id === "o1" ? "key-o1" : null));
  const h = makeHarness({ probe });
  submit(h.coord, "c1", "job-1", [occ("o1")]);
  const g = h.coord.requestGrant("job-1");
  const lease = h.rows("schedule").find(r => r.kind === "lease");
  h.setNow(lease.due_at + 1000);
  await h.coord.alarm();
  assert.equal(h.coord.jobView("job-1").occurrences[0].state, "outcome_unknown");
  const r = h.coord.reconcileUnknown("job-1", "o1");
  assert.deepEqual([r.ok, r.exit], [true, "adopted"]);
  const view = h.coord.jobView("job-1");
  assert.equal(view.occurrences[0].state, "ready");
  assert.equal(view.occurrences[0].cache_key, "key-o1");
  assert.equal(h.rows("bindings").length, 1);
});

test("seam iii-b: reconciliation records spent-without-audio from the provider request id", async () => {
  const h = makeHarness({ probe: makeProbe(new Map(), () => null) });
  submit(h.coord, "c1", "job-1", [occ("o1")]);
  const g = h.coord.requestGrant("job-1");
  h.coord.noteProviderRequest(g.grantId, "o1", "provider-req-77");
  const lease = h.rows("schedule").find(r => r.kind === "lease");
  h.setNow(lease.due_at + 1000);
  await h.coord.alarm();
  const r = h.coord.reconcileUnknown("job-1", "o1");
  assert.deepEqual([r.ok, r.exit], [true, "spent_without_audio"]);
  const o = h.coord.jobView("job-1").occurrences[0];
  assert.equal(o.state, "failed");
});

test("seam iii-c: no cache, no provider record -> stays unknown until Julie authorizes", async () => {
  const h = makeHarness({ probe: makeProbe(new Map(), () => null) });
  submit(h.coord, "c1", "job-1", [occ("o1")]);
  h.coord.requestGrant("job-1");
  const lease = h.rows("schedule").find(r => r.kind === "lease");
  h.setNow(lease.due_at + 1000);
  await h.coord.alarm();
  const r = h.coord.reconcileUnknown("job-1", "o1");
  assert.equal(r.exit, "still_unknown");
  assert.equal(h.coord.jobView("job-1").state, "outcome_unknown");
  // a fresh grant is NOT a legal way out on its own
  assert.equal(h.coord.requestGrant("job-1").ok, false);
  // Julie's explicit command is
  const res = h.coord.handleCommand({ command_id: "fix-1", type: "ResolveOutcomeUnknown",
    payload: { jobId: "job-1", occurrenceId: "o1" } });
  assert.equal(res.outcome, "applied");
  assert.equal(h.coord.jobView("job-1").occurrences[0].state, "pending");
  assert.equal(h.coord.jobView("job-1").state, "queued");
  assert.equal(h.coord.requestGrant("job-1").ok, true); // new operation, new grant identity
});

test("seam iv: a success report whose audio never landed does NOT mark the occurrence ready", () => {
  const h = makeHarness({ probe: makeProbe(new Map()) }); // probe: nothing exists
  submit(h.coord, "c1", "job-1", [occ("o1")]);
  const g = h.coord.requestGrant("job-1");
  const rep = h.coord.handleReport({ grantId: g.grantId, jobRevision: 2,
    results: [{ occurrenceId: "o1", outcome: "success", revisionKey: "fp-o1", cacheKey: "ghost-key" }] });
  assert.equal(rep.ok, true);
  const o = h.coord.jobView("job-1").occurrences[0];
  assert.equal(o.state, "granted"); // unvalidated -> not ready, lease path still owns it
  assert.equal(h.rows("bindings").length, 0);
  const log = h.rows("transitions").find(t => t.detail_json && t.detail_json.includes("object_missing"));
  assert.ok(log, "the binding rejection is on the transition log");
});

test("seam v: a crash mid-report rolls the whole report back; re-report applies cleanly", () => {
  const objects = new Map([["key-o1", { format: "mp3", identity: "fp-o1" }]]);
  const probe = makeProbe(objects);
  const h = makeHarness({ probe });
  submit(h.coord, "c1", "job-1", [occ("o1")]);
  const g = h.coord.requestGrant("job-1");
  const report = { grantId: g.grantId, jobRevision: 2,
    results: [{ occurrenceId: "o1", outcome: "success", revisionKey: "fp-o1", cacheKey: "key-o1" }] };
  const realSniff = probe.sniff;
  probe.sniff = () => { throw new Error("storage exploded"); };
  assert.throws(() => h.coord.handleReport(report), /storage exploded/);
  // nothing half-applied
  assert.equal(h.rows("grants")[0].state, "issued");
  assert.equal(h.coord.jobView("job-1").occurrences[0].state, "granted");
  assert.equal(h.rows("bindings").length, 0);
  probe.sniff = realSniff;
  assert.equal(h.coord.handleReport(report).ok, true);
  assert.equal(h.coord.jobView("job-1").state, "complete");
});

test("autonomous recovery: a poison schedule row backs off, dies visibly, and never kills the chain", async () => {
  const h = makeHarness();
  h.coord.wake();
  assert.ok(h.alarmAt() !== null, "watchdog armed from a cold wake");
  // a row whose processing always throws
  h.db.prepare(`INSERT INTO schedule (due_at, kind, ref, payload_json) VALUES (?, 'lease', 'grant:ghost', '{}')`)
    .run(h.now());
  h.env.scheduleHook = row => { if (row.ref === "grant:ghost") throw new Error("poison"); };
  for (let i = 0; i < 10; i++) {
    await h.fireAlarm();
    assert.ok(h.alarmAt() !== null, `chain still armed after firing ${i + 1}`);
    const row = h.rows("schedule").find(r => r.ref === "grant:ghost");
    if (row.state === "dead") break;
    h.setNow(row.due_at + 1);
  }
  const dead = h.rows("schedule").find(r => r.ref === "grant:ghost");
  assert.equal(dead.state, "dead");
  assert.ok(dead.attempts >= 8);
  const vis = h.coord.conflictsView().find(c => c.reason === "schedule_dead");
  assert.ok(vis, "the dead row is surfaced, not silently dropped");
  // and the chain still processes honest work afterwards
  h.env.scheduleHook = null;
  submit(h.coord, "c1", "job-1", [occ("o1")]);
  assert.equal(h.coord.requestGrant("job-1").ok, true);
});

test("autonomous recovery: alarm handler throwing wholesale still re-arms (finally)", async () => {
  const h = makeHarness();
  h.coord.wake();
  const realProcess = h.coord._processScheduleRow.bind(h.coord);
  let calls = 0;
  h.coord._processScheduleRow = row => {
    if (row.kind === "watchdog" && calls++ < 2) throw new Error("alarm exploded");
    return realProcess(row);
  };
  await h.fireAlarm(); // watchdog row threw -> backed off, chain re-armed in finally
  assert.ok(h.alarmAt() !== null);
  const wd = h.rows("schedule").filter(r => r.kind === "watchdog" && r.state === "pending");
  assert.ok(wd.length >= 1);
  h.setNow(Math.max(...wd.map(r => r.due_at)) + 1);
  await h.fireAlarm(); // throws again (2nd)
  assert.ok(h.alarmAt() !== null);
  const wd2 = h.rows("schedule").filter(r => r.kind === "watchdog" && r.state === "pending");
  h.setNow(Math.max(...wd2.map(r => r.due_at)) + 1);
  await h.fireAlarm(); // now it processes
  assert.ok(h.alarmAt() !== null);
});
