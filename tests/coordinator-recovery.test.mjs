// P2: the five-point interruption matrix (§1.2) + autonomous recovery
// (Rowan criterion 1). Crashes are instance discards; storage persists.
import test from "node:test";
import assert from "node:assert/strict";
import { makeHarness, makeProbe, occ, submit } from "./helpers/do-harness.mjs";

test("seam ii: a grant committed but never sent is delivered after a crash, exactly once", async () => {
  const h = makeHarness();
  await submit(h.coord, "c1", "job-1", [occ("o1")]);
  const g = await h.coord.requestGrant("job-1");
  assert.equal(g.ok, true);
  // crash before drainOutbox: the send never happened.
  const coord2 = h.crash();
  await coord2.wake();
  assert.equal(await coord2.drainOutbox(x => h.sentGrants.push(x)), 1);
  assert.equal(h.sentGrants[0].grantId, g.grantId);
  assert.equal(await coord2.drainOutbox(x => h.sentGrants.push(x)), 0); // not twice
});

test("seam iii: executor dies after dispatch -> lease expiry -> outcome_unknown, never re-dispatched", async () => {
  const h = makeHarness({ probe: makeProbe(new Map()) });
  await submit(h.coord, "c1", "job-1", [occ("o1"), occ("o2")]);
  const g = await h.coord.requestGrant("job-1");
  await h.coord.drainOutbox(x => h.sentGrants.push(x));
  h.coord.noteProviderRequest(g.grantId, "o1", "provider-req-1");
  // no report ever arrives; the lease (15 min) expires under the alarm.
  const lease = h.rows("schedule").find(r => r.kind === "lease");
  h.setNow(lease.due_at + 1000);
  await h.coord.alarm();
  const view = h.coord.jobView("job-1");
  assert.equal(view.state, "outcome_unknown");
  // Round 3 fix 3: o1's provider request ID was recorded at dispatch,
  // but a dispatch record is NOT proof the provider completed or
  // charged it — so the automatic reconciliation pass leaves BOTH
  // occurrences outcome_unknown (visible, never auto-replayed).
  assert.deepEqual(view.occurrences.map(o => o.state), ["outcome_unknown", "outcome_unknown"]);
  // critically: nothing new was dispatched for them
  assert.equal(h.rows("outbox").length, 1);
  assert.equal(h.rows("grants").length, 1);
});

test("seam iii-a + gap 4: lease expiry auto-adopts cached audio and the JOB completes", async () => {
  const objects = new Map([["key-o1", { format: "mp3", identity: "fp-o1", sha: "aaaa" }]]);
  const probe = makeProbe(objects, o => (o.occurrence_id === "o1" ? "key-o1" : null));
  const h = makeHarness({ probe });
  await submit(h.coord, "c1", "job-1", [occ("o1")]);
  const g = await h.coord.requestGrant("job-1");
  const lease = h.rows("schedule").find(r => r.kind === "lease");
  h.setNow(lease.due_at + 1000);
  await h.coord.alarm(); // no device, no manual reconcile call
  const view = h.coord.jobView("job-1");
  assert.equal(view.occurrences[0].state, "ready");
  assert.equal(view.occurrences[0].cache_key, "key-o1");
  assert.equal(view.state, "complete"); // gap 4: the job itself lands truthfully
  assert.equal(h.rows("bindings").length, 1);
});

test("seam iii-b: automatic reconciliation records spent-without-audio from a CONFIRMED provider outcome", async () => {
  const h = makeHarness({ probe: makeProbe(new Map(), () => null) });
  await submit(h.coord, "c1", "job-1", [occ("o1")]);
  const g = await h.coord.requestGrant("job-1");
  h.coord.noteProviderRequest(g.grantId, "o1", "provider-req-77");
  // Genuine provider evidence: a request-status lookup confirms the
  // request failed with no audio produced (round 3, fix 3).
  h.coord.noteProviderOutcome(g.grantId, "o1", "failed",
    { source: "provider_status_lookup", providerStatus: "failed" });
  const lease = h.rows("schedule").find(r => r.kind === "lease");
  h.setNow(lease.due_at + 1000);
  await h.coord.alarm();
  const o = h.coord.jobView("job-1").occurrences[0];
  assert.equal(o.state, "failed");
  const row = h.rows("occurrences")[0];
  assert.match(row.detail_json, /spent_without_audio/);
  assert.equal(h.coord.jobView("job-1").state, "failed");
});

test("seam iii-c: no cache, no provider record -> stays unknown until Julie authorizes", async () => {
  const h = makeHarness({ probe: makeProbe(new Map(), () => null) });
  await submit(h.coord, "c1", "job-1", [occ("o1")]);
  await h.coord.requestGrant("job-1");
  const lease = h.rows("schedule").find(r => r.kind === "lease");
  h.setNow(lease.due_at + 1000);
  await h.coord.alarm();
  const r = h.coord.reconcileUnknown("job-1", "o1");
  assert.equal(r.exit, "still_unknown");
  assert.equal(h.coord.jobView("job-1").state, "outcome_unknown");
  // a fresh grant is NOT a legal way out on its own
  assert.equal((await h.coord.requestGrant("job-1")).ok, false);
  // Julie's explicit command is
  const res = await h.coord.handleCommand({ command_id: "fix-1", type: "ResolveOutcomeUnknown",
    payload: { jobId: "job-1", occurrenceId: "o1" } });
  assert.equal(res.outcome, "applied");
  assert.equal(h.coord.jobView("job-1").occurrences[0].state, "pending");
  assert.equal(h.coord.jobView("job-1").state, "queued");
  assert.equal((await h.coord.requestGrant("job-1")).ok, true); // new operation, new grant identity
});

test("seam iv + finding 1: unvalidated success -> outcome_unknown (never stuck), reconciliation recovers it", async () => {
  const objects = new Map();
  const probe = makeProbe(objects, o => (o.occurrence_id === "o1" ? "ghost-key" : null));
  const h = makeHarness({ probe }); // probe: nothing exists yet
  await submit(h.coord, "c1", "job-1", [occ("o1")]);
  const g = await h.coord.requestGrant("job-1");
  const rep = await h.coord.handleReport({ grantId: g.grantId, jobRevision: 2,
    results: [{ occurrenceId: "o1", outcome: "success", revisionKey: "fp-o1", cacheKey: "ghost-key" }] });
  assert.equal(rep.ok, true);
  // NOT ready, NOT stuck in granted behind the reported grant: the claim
  // is unproven, so the occurrence is outcome_unknown and the job follows.
  assert.equal(h.rows("bindings").length, 0);
  let view = h.coord.jobView("job-1");
  assert.equal(view.occurrences[0].state, "outcome_unknown");
  assert.equal(view.state, "outcome_unknown");
  const log = h.rows("transitions").find(t => t.detail_json && t.detail_json.includes("object_missing"));
  assert.ok(log, "the binding rejection is on the transition log");
  // the guaranteed recovery path: the audio lands late (the executor was
  // just slow), reconciliation adopts it, the job completes.
  objects.set("ghost-key", { format: "mp3", identity: "fp-o1", sha: "aaaa" });
  const r = h.coord.reconcileUnknown("job-1", "o1");
  assert.deepEqual([r.ok, r.exit], [true, "adopted"]);
  view = h.coord.jobView("job-1");
  assert.equal(view.occurrences[0].state, "ready");
  assert.equal(view.occurrences[0].cache_key, "ghost-key");
});

test("seam v: a crash mid-report rolls the whole report back; re-report applies cleanly", async () => {
  const objects = new Map([["key-o1", { format: "mp3", identity: "fp-o1", sha: "aaaa" }]]);
  const probe = makeProbe(objects);
  const h = makeHarness({ probe });
  await submit(h.coord, "c1", "job-1", [occ("o1")]);
  const g = await h.coord.requestGrant("job-1");
  const report = { grantId: g.grantId, jobRevision: 2,
    results: [{ occurrenceId: "o1", outcome: "success", revisionKey: "fp-o1", cacheKey: "key-o1" }] };
  const realSniff = probe.sniff;
  probe.sniff = () => { throw new Error("storage exploded"); };
  await assert.rejects(h.coord.handleReport(report), /storage exploded/);
  // nothing half-applied
  assert.equal(h.rows("grants")[0].state, "issued");
  assert.equal(h.coord.jobView("job-1").occurrences[0].state, "granted");
  assert.equal(h.rows("bindings").length, 0);
  probe.sniff = realSniff;
  assert.equal((await h.coord.handleReport(report)).ok, true);
  assert.equal(h.coord.jobView("job-1").state, "complete");
});

test("gap 2: pause/cancel void a queued dispatch before it can spend; freeze only holds it", async () => {
  const h = makeHarness();
  await submit(h.coord, "c1", "job-1", [occ("o1")]);
  const g = await h.coord.requestGrant("job-1"); // outbox row exists, never drained
  await h.coord.handleCommand({ command_id: "c2", type: "RequestPause", payload: { jobId: "job-1" } });
  assert.equal(await h.coord.drainOutbox(x => h.sentGrants.push(x)), 0);
  assert.equal(h.sentGrants.length, 0); // the provider never hears about it
  assert.equal(h.rows("grants").find(x => x.grant_id === g.grantId).state, "voided");
  assert.equal(h.rows("outbox").length, 0);
  assert.equal(h.coord.jobView("job-1").occurrences[0].state, "pending"); // returned, not orphaned
  // resume + a fresh grant delivers normally
  await h.coord.handleCommand({ command_id: "c3", type: "RequestResume", payload: { jobId: "job-1" } });
  const g2 = await h.coord.requestGrant("job-1");
  assert.equal(g2.ok, true);
  assert.notEqual(g2.grantId, g.grantId);
  assert.equal(await h.coord.drainOutbox(x => h.sentGrants.push(x)), 1);

  const h2 = makeHarness();
  await submit(h2.coord, "c1", "job-1", [occ("o1")]);
  await h2.coord.requestGrant("job-1");
  await h2.coord.handleCommand({ command_id: "c2", type: "RequestCancel", payload: { jobId: "job-1" } });
  assert.equal(await h2.coord.drainOutbox(x => h2.sentGrants.push(x)), 0);
  assert.equal(h2.rows("grants")[0].state, "voided");

  const h3 = makeHarness();
  await submit(h3.coord, "c1", "job-1", [occ("o1")]);
  await h3.coord.requestGrant("job-1");
  await h3.coord.handleCommand({ command_id: "fz", type: "FreezeDirective", payload: { freeze: true } });
  assert.equal(await h3.coord.drainOutbox(x => h3.sentGrants.push(x)), 0);
  assert.equal(h3.rows("outbox").length, 1); // held, NOT voided
  assert.equal(h3.rows("grants")[0].state, "issued");
  await h3.coord.handleCommand({ command_id: "fz2", type: "FreezeDirective", payload: { freeze: false } });
  assert.equal(await h3.coord.drainOutbox(x => h3.sentGrants.push(x)), 1);
});

test("gap 5: scheduling a 30s retry advances an alarm that was 10 minutes out", async () => {
  const h = makeHarness({ probe: makeProbe(new Map()) });
  await submit(h.coord, "c1", "job-1", [occ("o1")]);
  const g = await h.coord.requestGrant("job-1");
  const armedBefore = h.alarmAt();
  assert.ok(armedBefore > h.now() + 30000, "alarm starts out beyond the retry horizon");
  await h.coord.handleReport({ grantId: g.grantId, jobRevision: 2,
    results: [{ occurrenceId: "o1", outcome: "rate_limited" }] });
  const retry = h.rows("schedule").find(r => r.kind === "retry_grant");
  assert.ok(retry);
  assert.equal(h.alarmAt(), retry.due_at); // advanced to the earlier work
  assert.ok(h.alarmAt() < armedBefore);
});

test("finding 2: unacknowledged deliveries are never marked sent", async () => {
  const h = makeHarness();
  await submit(h.coord, "c1", "job-1", [occ("o1")]);
  await h.coord.requestGrant("job-1");
  // a synchronously throwing handler: nothing is marked sent
  assert.equal(await h.coord.drainOutbox(() => { throw new Error("queue down"); }), 0);
  assert.equal(h.rows("outbox")[0].sent_at, null);
  // an asynchronously rejecting handler: same
  assert.equal(await h.coord.drainOutbox(async () => { throw new Error("queue down async"); }), 0);
  assert.equal(h.rows("outbox")[0].sent_at, null);
  // a missing handler: not a success either
  assert.equal(await h.coord.drainOutbox(undefined), 0);
  assert.equal(h.rows("outbox")[0].sent_at, null);
  // and when delivery finally works, exactly that drain marks it
  assert.equal(await h.coord.drainOutbox(x => h.sentGrants.push(x)), 1);
  assert.ok(h.rows("outbox")[0].sent_at !== null);
});

test("finding 2/5: the watchdog drain with no delivery handler leaves grants visibly unsent", async () => {
  const h = makeHarness();
  await submit(h.coord, "c1", "job-1", [occ("o1")]);
  await h.coord.requestGrant("job-1");
  h.env.sendGrant = undefined; // no delivery path configured
  await h.coord.wake();
  const wd = h.rows("schedule").filter(r => r.kind === "watchdog" && r.state === "pending");
  assert.ok(wd.length >= 1);
  h.setNow(wd[0].due_at + 1);
  await h.fireAlarm();
  assert.equal(h.rows("outbox")[0].sent_at, null); // still unsent, not faked
  assert.ok(h.alarmAt() !== null); // and the chain itself is healthy
});

test("autonomous recovery: a poison schedule row backs off, dies visibly, and never kills the chain", async () => {
  const h = makeHarness();
  await h.coord.wake();
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
  await submit(h.coord, "c1", "job-1", [occ("o1")]);
  assert.equal((await h.coord.requestGrant("job-1")).ok, true);
});

test("autonomous recovery: alarm handler throwing wholesale still re-arms (finally)", async () => {
  const h = makeHarness();
  await h.coord.wake();
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
