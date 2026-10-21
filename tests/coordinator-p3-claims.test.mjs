// P3 (Case #5): the acceptance ledger, the spend-intent fence, and
// the Batch mapping — the coordinator side of the executor contracts.
// Gate-2 condition 1 lives here: claim returns are read-only; only
// AcquireSpendIntent permits a provider call, exactly once, ever.
import test from "node:test";
import assert from "node:assert/strict";
import { makeHarness, makeProbe, occ, submit } from "./helpers/do-harness.mjs";

const OBJECTS = new Map([["key-o1", { format: "mp3", identity: "fp-o1", sha: "aaaa" }]]);
const SUCCESS = [{ occurrenceId: "o1", outcome: "success", revisionKey: "fp-o1", cacheKey: "key-o1" }];

async function granted(h) {
  await submit(h.coord, "c1", "job-1", [occ("o1")]);
  const g = await h.coord.requestGrant("job-1");
  await h.coord.drainOutbox(); // -> delivered
  return g;
}

test("claim lifecycle: claim -> read-only re-claims -> probe accepted -> report completes the claim", async () => {
  const h = makeHarness({ probe: makeProbe(OBJECTS) });
  const g = await granted(h);
  // No row yet: the probe's answer is UNKNOWN — absence is not a verdict.
  assert.deepEqual(h.coord.probeVerdict(g.grantId), { verdict: "unknown" });
  const c1 = h.coord.claimGrant({ grantId: g.grantId, consumerId: "exec-A" });
  assert.equal(c1.status, "claimed");
  assert.equal(c1.claim.consumer_id, "exec-A");
  // Same consumer, other consumer: identical read-only answer, no change.
  const c2 = h.coord.claimGrant({ grantId: g.grantId, consumerId: "exec-A" });
  const c3 = h.coord.claimGrant({ grantId: g.grantId, consumerId: "exec-B" });
  assert.equal(c2.status, "already_claimed");
  assert.equal(c3.status, "already_claimed");
  assert.equal(c3.claim.consumer_id, "exec-A");
  const v = h.coord.probeVerdict(g.grantId);
  assert.equal(v.verdict, "accepted");
  assert.equal(typeof v.claimedAt, "number");
  // The report completes the claim in the same transaction.
  const rep = await h.coord.handleReport({ grantId: g.grantId, jobRevision: 2, results: SUCCESS });
  assert.equal(rep.ok, true);
  assert.equal(h.coord.claimView(g.grantId).state, "completed");
  assert.equal(h.coord.claimGrant({ grantId: g.grantId, consumerId: "exec-C" }).status, "completed");
  assert.equal(h.coord.probeVerdict(g.grantId).verdict, "accepted");
});

test("a voided grant claims as CLOSED; terminal closure refuses a claimed grant and rejects later claims", async () => {
  const h = makeHarness();
  await submit(h.coord, "c1", "job-1", [occ("o1")]);
  const g = await h.coord.requestGrant("job-1"); // issued, never delivered
  const lease = h.rows("schedule").find(r => r.kind === "lease" && r.state === "pending");
  h.setNow(lease.due_at + 1000);
  await h.coord.alarm(); // undelivered -> voided
  assert.equal(h.rows("grants")[0].state, "voided");
  assert.equal(h.coord.claimGrant({ grantId: g.grantId, consumerId: "exec-A" }).status, "closed");
  assert.equal(h.coord.probeVerdict(g.grantId).verdict, "not_accepted");

  // Closure with terminal evidence, racing claims both ways:
  const g2 = await granted(h); // job complete? no — job-1 completed via void/retry; use a fresh job
  void g2;
  await submit(h.coord, "c2", "job-2", [occ("o9")]);
  const gB = await h.coord.requestGrant("job-2");
  const closed = h.coord.closeAcceptance({ grantId: gB.grantId, evidence: "queue_terminal_no_accept" });
  assert.equal(closed.closed, true);
  assert.equal(h.coord.claimGrant({ grantId: gB.grantId, consumerId: "exec-A" }).status, "closed");
  assert.equal(h.coord.probeVerdict(gB.grantId).verdict, "not_accepted");
  // ...and a claimed grant refuses closure outright:
  await submit(h.coord, "c3", "job-3", [occ("o7")]);
  const gC = await h.coord.requestGrant("job-3");
  assert.equal(h.coord.claimGrant({ grantId: gC.grantId, consumerId: "exec-A" }).status, "claimed");
  const refused = h.coord.closeAcceptance({ grantId: gC.grantId, evidence: "queue_terminal_no_accept" });
  assert.equal(refused.closed, false);
  assert.equal(refused.reason, "claimed");
  assert.equal(h.coord.probeVerdict(gC.grantId).verdict, "accepted");
});

test("spend intent: exactly once, holder-only, and a claim alone never suffices (condition 1)", async () => {
  const h = makeHarness();
  const g = await granted(h);
  // No claim yet:
  assert.equal(h.coord.acquireSpendIntent({ grantId: g.grantId, jobId: "job-1", occurrenceId: "o1", consumerId: "exec-A" }).reason, "not_claimed");
  h.coord.claimGrant({ grantId: g.grantId, consumerId: "exec-A" });
  // Claimed by another consumer:
  assert.equal(h.coord.acquireSpendIntent({ grantId: g.grantId, jobId: "job-1", occurrenceId: "o1", consumerId: "exec-B" }).reason, "claimed_by_other");
  // The holder acquires — once:
  const a1 = h.coord.acquireSpendIntent({ grantId: g.grantId, jobId: "job-1", occurrenceId: "o1", consumerId: "exec-A" });
  assert.equal(a1.acquired, true);
  // THE condition-1 case: the SAME consumer re-acquiring (redelivery,
  // crash replay) gets the existing intent and NO second permit.
  const a2 = h.coord.acquireSpendIntent({ grantId: g.grantId, jobId: "job-1", occurrenceId: "o1", consumerId: "exec-A" });
  assert.equal(a2.acquired, false);
  assert.equal(a2.intent.consumer_id, "exec-A");
  assert.equal(a2.intent.outcome, null); // spent-or-unknown: reconcile, never re-spend
  // A known outcome records exactly once:
  assert.equal(h.coord.noteSpendOutcome({ jobId: "job-1", occurrenceId: "o1", outcome: "failed_known", detail: "HTTP 500" }).noted, true);
  assert.equal(h.coord.noteSpendOutcome({ jobId: "job-1", occurrenceId: "o1", outcome: "success" }).reason, "already_noted");
});

test("batch map: fence needs the intent; fenced -> submitted; ambiguous -> adopted by lookup", async () => {
  const h = makeHarness();
  const g = await granted(h);
  h.coord.claimGrant({ grantId: g.grantId, consumerId: "exec-A" });
  // No intent yet -> no fence:
  assert.equal(h.coord.fenceBatchSubmit({ grantId: g.grantId, jobId: "job-1", occurrenceId: "o1", displayName: "opalreader-x-o1", consumerId: "exec-A" }).reason, "no_spend_intent");
  h.coord.acquireSpendIntent({ grantId: g.grantId, jobId: "job-1", occurrenceId: "o1", consumerId: "exec-A" });
  const f = h.coord.fenceBatchSubmit({ grantId: g.grantId, jobId: "job-1", occurrenceId: "o1", displayName: "opalreader-x-o1", consumerId: "exec-A" });
  assert.equal(f.fenced, true);
  // Exactly-once: a second fence attempt returns the existing map.
  assert.equal(h.coord.fenceBatchSubmit({ grantId: g.grantId, jobId: "job-1", occurrenceId: "o1", displayName: "opalreader-x-o1", consumerId: "exec-A" }).fenced, false);
  // Lost response -> ambiguous; lookup finds it -> adopted as submitted.
  assert.equal(h.coord.noteBatchAmbiguous({ jobId: "job-1", occurrenceId: "o1" }).ok, true);
  const ad = h.coord.adoptBatchByLookup({ jobId: "job-1", occurrenceId: "o1", providerName: "batches/abc", evidence: "display_name match" });
  assert.equal(ad.ok, true);
  assert.equal(ad.map.state, "submitted");
  assert.equal(ad.map.provider_name, "batches/abc");
  // Illegal transitions refuse rather than corrupt:
  assert.equal(h.coord.noteBatchAmbiguous({ jobId: "job-1", occurrenceId: "o1" }).ok, false);
});

test("resolveBatchNeverAccepted: explicit evidence closes the map, voids the grant, releases the spend, re-advances", async () => {
  const h = makeHarness();
  const g = await granted(h);
  h.coord.claimGrant({ grantId: g.grantId, consumerId: "exec-A" });
  h.coord.acquireSpendIntent({ grantId: g.grantId, jobId: "job-1", occurrenceId: "o1", consumerId: "exec-A" });
  h.coord.fenceBatchSubmit({ grantId: g.grantId, jobId: "job-1", occurrenceId: "o1", displayName: "opalreader-x-o1", consumerId: "exec-A" });
  h.coord.noteBatchAmbiguous({ jobId: "job-1", occurrenceId: "o1" });
  const r = h.coord.resolveBatchNeverAccepted({ jobId: "job-1", occurrenceId: "o1", evidence: "provider ops audit #4471: no such submission" });
  assert.equal(r.ok, true);
  assert.equal(h.coord.workView("job-1").batchMaps[0].state, "closed");
  assert.ok(h.coord.workView("job-1").batchMaps[0].superseded_at); // generation retired, audited
  assert.ok(h.coord.workView("job-1").intents[0].superseded_at);
  assert.match(h.coord.workView("job-1").intents[0].superseded_reason, /batch_never_accepted/);
  assert.equal(h.rows("grants")[0].state, "voided");
  // The CLAIM is not rewritten (P3 review fix 1): the dispatch WAS
  // accepted — only the batch submission resolved as never-accepted.
  assert.equal(h.coord.claimView(g.grantId).state, "claimed");
  assert.equal(h.coord.probeVerdict(g.grantId).verdict, "accepted");
  assert.equal(h.coord.jobView("job-1").occurrences[0].state, "pending");
  assert.equal(h.coord.quotaView().attemptsToday, 0); // reservation released exactly once
  assert.equal(h.rows("schedule").filter(x => x.kind === "retry_grant" && x.state === "pending").length, 1);
  // And a lookup MISS can never do this: adoption is the only exit
  // from ambiguous besides explicit evidenced resolution — there is
  // no API for 'not found, therefore never accepted'.
});

test("CLAIM FENCE: a contradictory not_accepted verdict against a claimed, spend-fenced, in-flight grant voids NOTHING (round 2)", async () => {
  const h = makeHarness({ probe: makeProbe(OBJECTS) });
  await submit(h.coord, "c1", "job-1", [occ("o1")]);
  const g = await h.coord.requestGrant("job-1");
  // The queue message reached the consumer — it claims and acquires
  // spend intent (work in flight) — while the dispatch ACK was lost.
  // The attempted handoff goes uncertain at lease expiry:
  await h.coord.drainOutbox(() => { throw new Error("ack lost"); });
  assert.equal(h.coord.claimGrant({ grantId: g.grantId, consumerId: "exec-A" }).status, "claimed");
  assert.equal(h.coord.acquireSpendIntent({ grantId: g.grantId, jobId: "job-1", occurrenceId: "o1", consumerId: "exec-A" }).acquired, true);
  const lease = h.rows("schedule").find(r => r.kind === "lease" && r.state === "pending");
  h.setNow(lease.due_at + 1000);
  await h.coord.alarm();
  assert.equal(h.rows("grants")[0].state, "handoff_uncertain");
  // The dangerous verdict: the queue's terminal record says
  // NOT_ACCEPTED, contradicting the live claim. (In production the
  // probe reads the claim ledger and cannot disagree; this stubs the
  // adversarial case to prove the coordinator enforces its own
  // invariant instead of trusting the adapter.)
  h.env.probeQueue = () => "not_accepted";
  h.advance(31000);
  await h.coord.alarm();
  // The fence held: NO void, NO quota release, NO fresh grant. The
  // handoff reconciled as ACCEPTED on the claim's evidence.
  assert.equal(h.rows("grants").length, 1);
  assert.equal(h.rows("grants")[0].state, "issued");
  assert.equal(h.coord.quotaView().attemptsToday, 1); // reservation intact
  assert.equal(h.rows("ledger_ops").filter(r => r.kind === "attempt_release").length, 0);
  assert.ok(h.rows("transitions").some(t => t.cause === "handoff_verdict_contradicts_claim"));
  assert.equal(h.coord.claimView(g.grantId).state, "claimed");
  assert.equal(h.coord.probeVerdict(g.grantId).verdict, "accepted");
  assert.equal(h.coord.jobView("job-1").occurrences[0].state, "granted"); // still the live consumer's work
  // And the in-flight consumer's LATE SUCCESS report is adopted —
  // the outcome the void would have orphaned:
  const rep = await h.coord.handleReport({ grantId: g.grantId, jobRevision: h.coord.jobView("job-1").revision, results: SUCCESS });
  assert.equal(rep.ok, true);
  assert.equal(rep.ready, 1);
  assert.equal(h.coord.jobView("job-1").state, "complete");
  assert.equal(h.coord.claimView(g.grantId).state, "completed");
});
