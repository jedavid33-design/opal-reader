// P2 review round 4 (Rowan): two recovery/fencing blockers.
//  1. An UNDELIVERED grant must never expire into outcome_unknown, and
//     expired/voided work must never be delivered late. The execution
//     lease anchors to the acknowledged handoff; pre-delivery expiry
//     has its own semantics (void + release + re-pend).
//  2. Unknown reconciliation reads ONLY the exact grant that made the
//     occurrence unknown — never another job's, or an earlier grant's,
//     provider evidence.
import test from "node:test";
import assert from "node:assert/strict";
import { makeHarness, makeProbe, occ, submit } from "./helpers/do-harness.mjs";

const pendingLease = h => h.rows("schedule").find(r => r.kind === "lease" && r.state === "pending");

// ---------- blocker 1: undelivered grants never go unknown -------------

test("blocker 1a: absent queue handler for >15 min -> no phantom unknown; dispatch voided, reservation released, work re-grantable", async () => {
  const h = makeHarness({ probe: makeProbe(new Map(), () => null) });
  h.env.sendGrant = undefined; // the queue handler is simply not there
  await submit(h.coord, "c1", "job-1", [occ("o1")]);
  const g = await h.coord.requestGrant("job-1");
  assert.equal(g.ok, true);
  const lease = pendingLease(h);
  h.setNow(lease.due_at + 1000); // >15 min with no delivery at all
  await h.coord.alarm();
  const view = h.coord.jobView("job-1");
  assert.equal(view.occurrences[0].state, "pending");      // NOT outcome_unknown
  assert.equal(view.state, "generating");                  // job never went unknown
  assert.equal(h.rows("grants")[0].state, "voided");
  assert.equal(h.rows("outbox").length, 0);                // nothing left to send late
  assert.equal(h.coord.quotaView().attemptsToday, 0);      // reservation released
  assert.equal(h.coord.quotaView().spentMicroCents, 0);
  assert.equal(h.rows("transitions").filter(t => t.to_state === "outcome_unknown").length, 0);
  // The work is simply grantable again once a handler exists.
  h.env.sendGrant = x => h.sentGrants.push(x);
  const g2 = await h.coord.requestGrant("job-1");
  assert.equal(g2.ok, true);
  assert.equal(await h.coord.drainOutbox(x => h.sentGrants.push(x)), 1);
  assert.equal(h.coord.quotaView().attemptsToday, 1);     // one real send, counted once
});

test("blocker 1b: freeze for >15 min holds the dispatch (no void, no unknown); thaw delivers it, lease anchored to handoff", async () => {
  const objects = new Map([["key-o1", { format: "mp3", identity: "fp-o1", sha: "aaaa" }]]);
  const h = makeHarness({ probe: makeProbe(objects) });
  await submit(h.coord, "c1", "job-1", [occ("o1")]);
  const g = await h.coord.requestGrant("job-1");
  const createdLeaseExpiry = h.rows("grants")[0].lease_expires_at;
  await h.coord.handleCommand({ command_id: "fz", type: "FreezeDirective", payload: { freeze: true } });
  h.advance(20 * 60 * 1000); // frozen straight through the lease window
  await h.coord.alarm();
  assert.equal(h.rows("grants")[0].state, "issued");               // not voided mid-freeze
  assert.equal(h.coord.jobView("job-1").occurrences[0].state, "granted"); // not unknown, not re-pended
  assert.equal(h.rows("outbox").filter(r => !r.sent_at).length, 1);       // still queued
  assert.equal(h.coord.quotaView().attemptsToday, 1);                     // reservation intact
  await h.coord.handleCommand({ command_id: "fz2", type: "FreezeDirective", payload: { freeze: false } });
  assert.equal(await h.coord.drainOutbox(x => h.sentGrants.push(x)), 1);  // thaw: it delivers
  const grantRow = h.rows("grants")[0];
  assert.ok(grantRow.lease_expires_at > createdLeaseExpiry,
    "execution lease re-anchored to the acknowledged handoff");
  const rep = await h.coord.handleReport({ grantId: g.grantId, jobRevision: 2,
    results: [{ occurrenceId: "o1", outcome: "success", revisionKey: "fp-o1", cacheKey: "key-o1" }] });
  assert.equal(rep.ok, true);
  assert.equal(h.coord.jobView("job-1").state, "complete");
});

test("blocker 1c: a send attempted after the delivery window closed is fenced — never sent, reservation released, fresh grant works", async () => {
  const objects = new Map([["key-o1", { format: "mp3", identity: "fp-o1", sha: "aaaa" }]]);
  const h = makeHarness({ probe: makeProbe(objects) });
  await submit(h.coord, "c1", "job-1", [occ("o1")]);
  const g = await h.coord.requestGrant("job-1");
  h.advance(16 * 60 * 1000); // window closed; no alarm has processed the lease yet
  assert.equal(await h.coord.drainOutbox(x => h.sentGrants.push(x)), 0); // fenced at drain time
  assert.equal(h.sentGrants.length, 0);                                  // never left
  assert.equal(h.rows("grants")[0].state, "voided");
  assert.equal(h.coord.jobView("job-1").occurrences[0].state, "pending");
  assert.equal(h.coord.quotaView().attemptsToday, 0);
  const g2 = await h.coord.requestGrant("job-1");
  assert.equal(g2.ok, true);
  assert.equal(await h.coord.drainOutbox(x => h.sentGrants.push(x)), 1);
  const rep = await h.coord.handleReport({ grantId: g2.grantId, jobRevision: 3,
    results: [{ occurrenceId: "o1", outcome: "success", revisionKey: "fp-o1", cacheKey: "key-o1" }] });
  assert.equal(rep.ok, true);
  assert.equal(h.coord.jobView("job-1").state, "complete");
  assert.equal(h.coord.quotaView().attemptsToday, 1); // exactly one real send ever counted
});

test("blocker 1d: watchdog and lease due in the same alarm, work DELIVERED -> truthful unknown, no double-send; creation lease superseded at handoff", async () => {
  const h = makeHarness({ probe: makeProbe(new Map(), () => null) });
  await submit(h.coord, "c1", "job-1", [occ("o1")]);
  await h.coord.requestGrant("job-1");
  assert.equal(await h.coord.drainOutbox(x => h.sentGrants.push(x)), 1);
  const leases = h.rows("schedule").filter(r => r.kind === "lease");
  assert.equal(leases.filter(r => r.state === "void").length, 1);    // creation-anchored, superseded
  assert.equal(leases.filter(r => r.state === "pending").length, 1); // handoff-anchored
  h.advance(16 * 60 * 1000); // past the handoff lease AND a watchdog tick
  await h.coord.alarm();     // both kinds process inside this one alarm
  const view = h.coord.jobView("job-1");
  assert.equal(view.occurrences[0].state, "outcome_unknown"); // delivered work: genuinely uncertain
  assert.equal(view.state, "outcome_unknown");
  assert.equal(h.sentGrants.length, 1);                       // never re-sent
  assert.equal(h.rows("outbox").length, 1);
  assert.equal(h.rows("grants").length, 1);
});

// ---------- blocker 2: reconciliation never borrows evidence -----------

test("blocker 2a: two jobs share an occurrenceId — the other job's confirmed spent evidence settles nothing here", async () => {
  const h = makeHarness({ probe: makeProbe(new Map(), () => null) });
  // Job A: dispatched, provider CONFIRMS spent-without-audio, lease expires.
  await submit(h.coord, "ca", "job-a", [occ("o1")]);
  const ga = await h.coord.requestGrant("job-a");
  await h.coord.drainOutbox(x => h.sentGrants.push(x));
  h.coord.noteProviderRequest(ga.grantId, "o1", "req-A");
  h.coord.noteProviderOutcome(ga.grantId, "o1", "spent_without_audio",
    { source: "provider_status_lookup", providerStatus: "completed_no_audio" });
  h.setNow(pendingLease(h).due_at + 1000);
  await h.coord.alarm();
  // Control: A's own exact-grant evidence settles A.
  assert.equal(h.coord.jobView("job-a").occurrences[0].state, "failed");
  assert.equal(h.coord.jobView("job-a").state, "failed");
  // Job B: SAME occurrenceId, dispatched, only a request id — no outcome.
  await submit(h.coord, "cb", "job-b", [occ("o1")]);
  const gb = await h.coord.requestGrant("job-b");
  await h.coord.drainOutbox(x => h.sentGrants.push(x));
  h.coord.noteProviderRequest(gb.grantId, "o1", "req-B");
  h.setNow(pendingLease(h).due_at + 1000);
  await h.coord.alarm();
  // B must NOT borrow A's evidence: still unknown, visibly, unsettled.
  assert.equal(h.coord.jobView("job-b").occurrences[0].state, "outcome_unknown");
  assert.equal(h.coord.jobView("job-b").state, "outcome_unknown");
  const r = h.coord.reconcileUnknown("job-b", "o1");
  assert.equal(r.exit, "still_unknown");
  assert.equal(h.coord.jobView("job-b").occurrences[0].state, "outcome_unknown");
});

test("blocker 2b: same job, earlier grant — a confirmed outcome under grant A does not settle grant B's unknown", async () => {
  const h = makeHarness({ probe: makeProbe(new Map(), () => null) });
  await submit(h.coord, "c1", "job-1", [occ("o1")]);
  const ga = await h.coord.requestGrant("job-1");
  await h.coord.drainOutbox(x => h.sentGrants.push(x));
  // Evidence lands against grant A — then A's report closes it as a
  // rate-limit deferral (the occurrence returns to pending).
  h.coord.noteProviderOutcome(ga.grantId, "o1", "spent_without_audio",
    { source: "provider_status_lookup", providerStatus: "completed_no_audio" });
  const rep = await h.coord.handleReport({ grantId: ga.grantId, jobRevision: 2,
    results: [{ occurrenceId: "o1", outcome: "rate_limited" }] });
  assert.equal(rep.ok, true);
  assert.equal(h.coord.jobView("job-1").occurrences[0].state, "pending");
  // Grant B: dispatched, executor dies with only a request id recorded.
  const gb = await h.coord.requestGrant("job-1");
  assert.equal(gb.ok, true);
  await h.coord.drainOutbox(x => h.sentGrants.push(x));
  h.coord.noteProviderRequest(gb.grantId, "o1", "req-B");
  h.setNow(pendingLease(h).due_at + 1000);
  await h.coord.alarm();
  assert.equal(h.coord.jobView("job-1").occurrences[0].state, "outcome_unknown");
  // A's confirmed outcome is in the ledger — under A's op key. B's
  // unknown is B's: reconciliation must leave it unknown.
  const r = h.coord.reconcileUnknown("job-1", "o1");
  assert.equal(r.exit, "still_unknown");
  assert.equal(h.coord.jobView("job-1").occurrences[0].state, "outcome_unknown");
  assert.equal(h.coord.jobView("job-1").state, "outcome_unknown");
});
