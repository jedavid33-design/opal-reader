// P2 review round 5 (Rowan): two dispatch-seam qualifications.
//  A. "Not ACKed" is not "never left": durable intent before invocation
//     splits never-invoked from attempted-uncertain. Uncertain handoffs
//     never void, never release, never re-grant — the queue's own
//     acceptance record (probeQueue) or an executor report settles them.
//  B. A safe void re-advances a generating job on its own: the durable
//     scheduler enqueues a bounded retry_grant — no client required.
import test from "node:test";
import assert from "node:assert/strict";
import { makeHarness, makeProbe, occ, submit } from "./helpers/do-harness.mjs";

const pendingLease = h => h.rows("schedule").find(r => r.kind === "lease" && r.state === "pending");
const grantOf = (h, jobId) => h.rows("grants").find(g => g.job_id === jobId);

// ---------- qualification A: attempted is not never-invoked ------------

test("A1: queue accepted, ACK lost -> uncertain (no void, no release, no re-grant); queue probe confirms -> delivered exactly once", async () => {
  const objects = new Map([["key-o1", { format: "mp3", identity: "fp-o1", sha: "aaaa" }]]);
  const h = makeHarness({ probe: makeProbe(objects) });
  const queue = [];
  await submit(h.coord, "c1", "job-1", [occ("o1")]);
  const g = await h.coord.requestGrant("job-1");
  const ackLost = p => { queue.push(p); throw new Error("ack lost"); };
  assert.equal(await h.coord.drainOutbox(ackLost), 0);
  assert.equal(queue.length, 1); // the queue HAS the message
  assert.ok(h.rows("outbox")[0].send_attempted_at !== null);
  assert.equal(h.rows("outbox")[0].sent_at, null);
  // No drain ever re-invokes an attempted row.
  assert.equal(await h.coord.drainOutbox(p => queue.push(p)), 0);
  assert.equal(queue.length, 1);
  // Lease expiry: NOT the round-4 void — uncertainty instead.
  h.setNow(pendingLease(h).due_at + 1000);
  await h.coord.alarm();
  assert.equal(grantOf(h, "job-1").state, "handoff_uncertain");
  assert.equal(h.coord.jobView("job-1").occurrences[0].state, "granted"); // still granted
  assert.equal(h.coord.jobView("job-1").grants[0].state, "handoff_uncertain"); // visible
  assert.equal(h.coord.quotaView().attemptsToday, 1); // reservation NOT released
  assert.equal((await h.coord.requestGrant("job-1")).ok, false); // no re-grant over it
  // The queue's own record settles it: accepted.
  h.env.probeQueue = gid => (queue.some(p => p.grantId === gid) ? "accepted" : "not_accepted");
  const expiryBefore = grantOf(h, "job-1").lease_expires_at;
  h.advance(31000);
  await h.coord.alarm(); // handoff_check
  assert.equal(grantOf(h, "job-1").state, "issued");
  assert.ok(h.rows("outbox")[0].sent_at !== null);
  assert.ok(grantOf(h, "job-1").lease_expires_at > expiryBefore); // lease anchored to confirmation
  const rep = await h.coord.handleReport({ grantId: g.grantId, jobRevision: 2,
    results: [{ occurrenceId: "o1", outcome: "success", revisionKey: "fp-o1", cacheKey: "key-o1" }] });
  assert.equal(rep.ok, true);
  assert.equal(h.coord.jobView("job-1").state, "complete");
  assert.equal(queue.length, 1); // exactly one queue message, ever
  assert.equal(h.coord.quotaView().attemptsToday, 1); // exactly one charge
});

test("A2: send pending while the alarm runs -> uncertain, not voided; the late ACK resolves it; a second drain never double-invokes", async () => {
  const h = makeHarness({ probe: makeProbe(new Map()) });
  h.env.sendGrant = undefined; // the watchdog must not compete for this row
  const sendCalls = [];
  let resolveSend;
  const send = p => { sendCalls.push(p); return new Promise(res => { resolveSend = res; }); };
  await submit(h.coord, "c1", "job-1", [occ("o1")]);
  await h.coord.requestGrant("job-1");
  const drainP = h.coord.drainOutbox(send); // intent is durable before the await
  assert.ok(h.rows("outbox")[0].send_attempted_at !== null);
  assert.equal(sendCalls.length, 1);
  // A concurrent drain sees the attempted row and invokes nothing.
  assert.equal(await h.coord.drainOutbox(send), 0);
  assert.equal(sendCalls.length, 1);
  // The alarm fires mid-send, past the lease: uncertain — NOT voided.
  h.setNow(pendingLease(h).due_at + 1000);
  await h.coord.alarm();
  assert.equal(grantOf(h, "job-1").state, "handoff_uncertain");
  assert.equal(h.coord.jobView("job-1").occurrences[0].state, "granted");
  assert.equal(h.coord.quotaView().attemptsToday, 1);
  // The ACK finally lands: the continuation resolves the uncertainty —
  // delivered, lease anchored — and reactivates nothing else.
  resolveSend();
  assert.equal(await drainP, 1);
  assert.equal(grantOf(h, "job-1").state, "issued");
  assert.ok(h.rows("outbox")[0].sent_at !== null);
  assert.equal(sendCalls.length, 1);
});

test("A2b: pause lands while a send is in flight -> the in-flight dispatch settles by report, exactly once", async () => {
  const objects = new Map([["key-o1", { format: "mp3", identity: "fp-o1", sha: "aaaa" }]]);
  const h = makeHarness({ probe: makeProbe(objects) });
  const sendCalls = [];
  let resolveSend;
  const send = p => { sendCalls.push(p); return new Promise(res => { resolveSend = res; }); };
  await submit(h.coord, "c1", "job-1", [occ("o1")]);
  const g = await h.coord.requestGrant("job-1");
  const drainP = h.coord.drainOutbox(send);
  const pause = await h.coord.handleCommand({ command_id: "pz", type: "RequestPause",
    payload: { jobId: "job-1" } });
  assert.equal(pause.outcome, "applied");
  resolveSend();
  assert.equal(await drainP, 1); // it had already left: in flight settles normally
  assert.equal(grantOf(h, "job-1").state, "issued");
  const rep = await h.coord.handleReport({ grantId: g.grantId, jobRevision: 3,
    results: [{ occurrenceId: "o1", outcome: "success", revisionKey: "fp-o1", cacheKey: "key-o1" }] });
  assert.equal(rep.ok, true);
  assert.equal(h.coord.jobView("job-1").state, "complete"); // round-3 fix-4 semantics
  assert.equal(sendCalls.length, 1);
});

test("A3: crash after the queue accepted but before the ACK was processed -> new instance reconciles from the queue record", async () => {
  const h = makeHarness({ probe: makeProbe(new Map(), () => null) });
  const queue = [];
  // The send records queue acceptance, then the DO dies mid-RPC: the
  // promise never settles and the instance is discarded.
  const dyingSend = p => { queue.push(p); return new Promise(() => {}); };
  h.env.sendGrant = dyingSend;
  await submit(h.coord, "c1", "job-1", [occ("o1")]);
  await h.coord.requestGrant("job-1");
  const abandoned = h.coord.drainOutbox(dyingSend); // intentionally never awaited
  assert.equal(queue.length, 1);
  const coord2 = h.crash();
  h.setNow(pendingLease(h).due_at + 1000);
  await coord2.alarm();
  assert.equal(grantOf(h, "job-1").state, "handoff_uncertain");
  assert.equal(queue.length, 1); // the watchdog never re-sent it
  h.env.probeQueue = gid => (queue.some(p => p.grantId === gid) ? "accepted" : "not_accepted");
  h.advance(31000);
  await coord2.alarm(); // handoff_check on the new instance
  assert.equal(grantOf(h, "job-1").state, "issued");
  assert.ok(h.rows("outbox")[0].sent_at !== null);
  assert.equal(h.coord.jobView("job-1").occurrences[0].state, "granted");
  assert.equal(h.coord.quotaView().attemptsToday, 1);
  void abandoned;
});

test("A4: queue probe stays unknown -> bounded checks, then the uncertainty simply stays VISIBLE (no void, no release, no spin)", async () => {
  const h = makeHarness({ probe: makeProbe(new Map(), () => null) });
  await submit(h.coord, "c1", "job-1", [occ("o1")]);
  await h.coord.requestGrant("job-1");
  assert.equal(await h.coord.drainOutbox(() => { throw new Error("ack lost"); }), 0);
  h.env.probeQueue = () => "unknown";
  h.setNow(pendingLease(h).due_at + 1000);
  await h.coord.alarm();
  assert.equal(grantOf(h, "job-1").state, "handoff_uncertain");
  for (let i = 0; i < 7; i++) { h.advance(600000); await h.coord.alarm(); }
  assert.equal(grantOf(h, "job-1").state, "handoff_uncertain"); // still visible, unresolved
  assert.equal(h.coord.jobView("job-1").occurrences[0].state, "granted");
  assert.equal(h.coord.quotaView().attemptsToday, 1); // never released
  assert.equal(h.rows("schedule").filter(r => r.kind === "handoff_check" && r.state === "pending").length, 0);
  assert.ok(h.rows("transitions").some(t => t.cause === "handoff_unresolved"));
});

// ---------- qualification B: safe voids re-advance unattended ----------

test("B1: undelivered grant expires and voids -> the scheduler re-grants and delivers with NO client call", async () => {
  const h = makeHarness({ probe: makeProbe(new Map(), () => null) });
  h.env.sendGrant = undefined; // queue handler absent
  await submit(h.coord, "c1", "job-1", [occ("o1")]);
  await h.coord.requestGrant("job-1");
  h.setNow(pendingLease(h).due_at + 1000);
  await h.coord.alarm(); // safe void happens here — plus its re-advance
  assert.equal(h.coord.jobView("job-1").occurrences[0].state, "pending");
  assert.equal(grantOf(h, "job-1").state, "voided");
  assert.equal(h.coord.quotaView().attemptsToday, 0); // released
  assert.equal(h.rows("schedule").filter(r => r.kind === "retry_grant" && r.state === "pending").length, 1);
  // From here the TEST makes no client calls at all — alarms only.
  h.env.sendGrant = p => h.sentGrants.push(p);
  h.advance(31000);
  await h.coord.alarm(); // retry_grant fires: a fresh grant exists
  assert.equal(h.rows("grants").length, 2);
  h.advance(10 * 60000);
  await h.coord.alarm(); // watchdog delivers it
  assert.equal(h.sentGrants.length, 1);
  assert.equal(h.sentGrants[0].jobId, "job-1");
  assert.equal(h.coord.jobView("job-1").occurrences[0].state, "granted");
  assert.equal(h.coord.quotaView().attemptsToday, 1); // one real attempt, counted once
});

test("B2: the re-advance respects a freeze — it defers while frozen and fires after thaw", async () => {
  const h = makeHarness({ probe: makeProbe(new Map(), () => null) });
  h.env.sendGrant = undefined;
  await submit(h.coord, "c1", "job-1", [occ("o1")]);
  await h.coord.requestGrant("job-1");
  h.setNow(pendingLease(h).due_at + 1000);
  await h.coord.alarm(); // void + re-advance scheduled
  assert.equal(h.rows("grants").length, 1);
  await h.coord.handleCommand({ command_id: "fz", type: "FreezeDirective", payload: { freeze: true } });
  h.advance(31000);
  await h.coord.alarm(); // retry comes due mid-freeze: defers, grants nothing
  assert.equal(h.rows("grants").length, 1);
  assert.equal(h.rows("schedule").filter(r => r.kind === "retry_grant" && r.state === "pending").length, 1);
  await h.coord.handleCommand({ command_id: "fz2", type: "FreezeDirective", payload: { freeze: false } });
  h.advance(61000);
  await h.coord.alarm(); // thawed: the deferred retry grants
  assert.equal(h.rows("grants").length, 2);
  assert.equal(h.coord.jobView("job-1").occurrences[0].state, "granted");
});
