// P3 (Case #5): the executor against the coordinator, fake providers,
// fake cache — the zero-spend definition of done. The properties that
// matter are all spend-shaped: exactly one paid call per occurrence
// across redelivery, crashes at every seam, re-grants, and ambiguity.
import test from "node:test";
import assert from "node:assert/strict";
import { makeHarness, occ, submit } from "./helpers/do-harness.mjs";
import { makeFakeProviders, makeFakeCache } from "./helpers/fakes.mjs";
import { createExecutor, fingerprintFor } from "../v2/executor.mjs";

const TEXT = "Hello world, this is a test segment.";
const STD = { text: TEXT, voice: "v1", provider: "gemini" };
const BATCH = { ...STD, mode: "batch", text: "A different segment entirely, spoken later." };
const FP_STD = fingerprintFor(STD);
const FP_BATCH = fingerprintFor(BATCH);

function world(payloads) {
  const cache = makeFakeCache();
  const providers = makeFakeProviders();
  const h = makeHarness({ probe: cache.probe });
  const content = new Map(Object.entries(payloads));
  const workSource = (jobId, oid) => content.get(`${jobId}/${oid}`) || null;
  const exec = createExecutor({ coordinator: h.coord, providers, cache, consumerId: "exec-A", workSource });
  return { h, cache, providers, exec, content };
}

async function dispatch(h, jobId, cmdId, occs) {
  await submit(h.coord, cmdId, jobId, occs);
  const g = await h.coord.requestGrant(jobId);
  let msg = null;
  await h.coord.drainOutbox(p => { msg = p; });
  assert.ok(msg && msg.grantId === g.grantId);
  return { g, msg };
}

test("standard end-to-end: claim -> one call -> verified store -> report -> job complete, claim completed", async () => {
  const { h, cache, providers, exec } = world({ "job-1/o1": STD });
  const { g, msg } = await dispatch(h, "job-1", "c1", [occ("o1", { revisionKey: FP_STD })]);
  const r = await exec.handleMessage(msg);
  assert.equal(r.occurrences.o1.reported, "success");
  assert.equal(providers.calls.synthesize, 1);
  assert.equal(h.coord.jobView("job-1").state, "complete");
  assert.equal(h.coord.jobView("job-1").occurrences[0].state, "ready");
  assert.equal(h.coord.claimView(g.grantId).state, "completed");
  const key = fingerprintFor(STD);
  assert.equal(cache.store.size, 1);
  assert.ok(cache.store.has(key));
  assert.equal(h.coord.jobView("job-1").occurrences[0].cache_key, key);
});

test("redelivery of the same message never re-spends (condition 1)", async () => {
  const { h, providers, exec } = world({ "job-1/o1": STD });
  const { msg } = await dispatch(h, "job-1", "c1", [occ("o1", { revisionKey: FP_STD })]);
  await exec.handleMessage(msg);
  const again = await exec.handleMessage(msg); // duplicate delivery
  assert.equal(providers.calls.synthesize, 1);
  assert.equal(again.dropped, "completed"); // the claim ledger drops it
  assert.equal(h.coord.jobView("job-1").state, "complete");
});

test("crash after the provider call, before the report: recovery re-reports from the paid intent — still one call", async () => {
  const { h, providers, exec } = world({ "job-1/o1": STD });
  const { g, msg } = await dispatch(h, "job-1", "c1", [occ("o1", { revisionKey: FP_STD })]);
  const orig = h.coord.handleReport.bind(h.coord);
  let bomb = true;
  h.coord.handleReport = async (...a) => {
    if (bomb) { bomb = false; throw new Error("executor died mid-report"); }
    return orig(...a);
  };
  await assert.rejects(() => exec.handleMessage(msg)); // the crash
  assert.equal(providers.calls.synthesize, 1);
  assert.equal(h.coord.workView("job-1").intents[0].outcome, "success"); // the spend is on record
  assert.equal(h.coord.jobView("job-1").state, "generating"); // unreported
  // The redelivery (a fresh pass; the executor is stateless): intent
  // recovery re-reports from the verified cache — no new provider call.
  const r = await exec.handleMessage(msg);
  assert.equal(r.occurrences.o1.via, "intent_recovery");
  assert.equal(providers.calls.synthesize, 1); // STILL exactly one paid call
  assert.equal(h.coord.jobView("job-1").state, "complete");
});

test("ambiguous standard call: no report, no outcome note, redelivery cannot re-spend", async () => {
  const { h, providers, exec } = world({ "job-1/o1": STD });
  providers.behavior.synth = () => { throw new Error("socket reset"); }; // transport, not an answer
  const { msg } = await dispatch(h, "job-1", "c1", [occ("o1", { revisionKey: FP_STD })]);
  const r1 = await exec.handleMessage(msg);
  assert.equal(r1.occurrences.o1.ambiguous, true);
  assert.equal(providers.calls.synthesize, 1);
  assert.equal(h.rows("grants")[0].state, "issued"); // unreported — no knowledge claimed
  assert.equal(h.rows("grants")[0].report_json, null);
  assert.equal(h.coord.workView("job-1").intents[0].outcome, null);
  const r2 = await exec.handleMessage(msg);
  assert.equal(r2.occurrences.o1.skipped, true);
  assert.equal(providers.calls.synthesize, 1); // the fence held
});

test("known standard failure: reported once, intent marked, redelivery spends nothing", async () => {
  const { h, providers, exec } = world({ "job-1/o1": STD });
  providers.behavior.synth = () => { throw Object.assign(new Error("boom"), { httpStatus: 500 }); };
  const { msg } = await dispatch(h, "job-1", "c1", [occ("o1", { revisionKey: FP_STD })]);
  const r1 = await exec.handleMessage(msg);
  assert.equal(r1.occurrences.o1.reported, "provider_error");
  assert.equal(h.coord.workView("job-1").intents[0].outcome, "failed_known");
  await exec.handleMessage(msg);
  assert.equal(providers.calls.synthesize, 1);
});

test("two consumers, one message: the second stands down", async () => {
  const { h, cache, providers, exec } = world({ "job-1/o1": STD });
  const { msg } = await dispatch(h, "job-1", "c1", [occ("o1", { revisionKey: FP_STD })]);
  const execB = createExecutor({ coordinator: h.coord, providers, cache, consumerId: "exec-B", workSource: () => STD });
  // A has claimed and is mid-work when B's duplicate arrives:
  h.coord.claimGrant({ grantId: msg.grantId, consumerId: "exec-A" });
  const rb = await execB.handleMessage(msg);
  assert.equal(rb.stoodDown, true);
  assert.equal(providers.calls.synthesize, 0); // B spent nothing
  const ra = await exec.handleMessage(msg);
  assert.equal(ra.occurrences.o1.reported, "success");
  assert.equal(providers.calls.synthesize, 1);
});

test("batch happy path: submit once, poll to done across redeliveries, one spend", async () => {
  const { h, providers, exec } = world({ "job-1/o1": BATCH });
  const { msg } = await dispatch(h, "job-1", "c1", [occ("o1", { revisionKey: FP_BATCH })]);
  const r1 = await exec.handleMessage(msg); // submit + first poll (running)
  assert.equal(r1.occurrences.o1.pending, true);
  assert.equal(providers.calls.submitBatch, 1);
  const r2 = await exec.handleMessage(msg); // redelivery: poll the EXISTING batch
  assert.equal(r2.occurrences.o1.reported, "success");
  assert.equal(providers.calls.submitBatch, 1);
  assert.equal(h.coord.jobView("job-1").state, "complete");
});

test("batch ambiguous submit: fence stands, lookup adopts, missing lookup proves nothing (condition 2)", async () => {
  const { h, providers, exec } = world({ "job-1/o1": BATCH });
  providers.behavior.submit = (o, displayName) => {
    providers.batches.set("batches/fake-lost", { displayName, polls: 0 }); // Google HAS it…
    throw new Error("response lost"); // …we just never saw the answer
  };
  const { msg } = await dispatch(h, "job-1", "c1", [occ("o1", { revisionKey: FP_STD })]);
  const r1 = await exec.handleMessage(msg);
  assert.equal(r1.occurrences.o1.ambiguous, true);
  assert.equal(h.coord.workView("job-1").batchMaps[0].state, "ambiguous");
  assert.equal(providers.calls.submitBatch, 1);
  // Redelivery cannot resubmit:
  await exec.handleMessage(msg);
  assert.equal(providers.calls.submitBatch, 1);
  // Lookup that finds nothing changes NOTHING (not terminal, no void):
  providers.behavior.list = () => [];
  const miss = await exec.reconcileBatch(msg.grantId, "job-1", "o1");
  assert.equal(miss.resolved, false);
  assert.equal(h.coord.workView("job-1").batchMaps[0].state, "ambiguous");
  assert.equal(h.rows("grants")[0].state, "issued"); // not voided, not reported
  assert.equal(providers.calls.submitBatch, 1);
  // Lookup that finds it adopts and completes — still one POST:
  providers.behavior.list = null;
  const hit = await exec.reconcileBatch(msg.grantId, "job-1", "o1");
  assert.equal(hit.resolved, true);
  const r3 = await exec.handleMessage(msg); // final poll -> done
  assert.equal(r3.occurrences.o1.reported, "success");
  assert.equal(providers.calls.submitBatch, 1);
  assert.equal(h.coord.jobView("job-1").state, "complete");
});

test("batch rejection is a KNOWN outcome: fence clears, failure reported, no resubmit", async () => {
  const { h, providers, exec } = world({ "job-1/o1": BATCH });
  providers.behavior.submit = () => { throw Object.assign(new Error("bad request"), { httpStatus: 400 }); };
  const { msg } = await dispatch(h, "job-1", "c1", [occ("o1", { revisionKey: FP_STD })]);
  const r1 = await exec.handleMessage(msg);
  assert.equal(r1.occurrences.o1.reported, "provider_error");
  assert.equal(h.coord.workView("job-1").batchMaps[0].state, "rejected");
  await exec.handleMessage(msg);
  assert.equal(providers.calls.submitBatch, 1);
});

test("the re-grant trap: a deferred batch occurrence meets its SAME map under a new grant — no second POST", async () => {
  const { h, providers, exec } = world({ "job-1/o1": STD, "job-1/o2": BATCH });
  const { msg } = await dispatch(h, "job-1", "c1", [occ("o1", { revisionKey: FP_STD }), occ("o2", { revisionKey: FP_BATCH })]);
  const r1 = await exec.handleMessage(msg);
  // o1 reported success (grant closes; o2 defers to pending mid-pass):
  assert.equal(r1.occurrences.o1.reported, "success");
  assert.equal(r1.occurrences.o2.skipped, true);
  assert.equal(providers.calls.submitBatch, 0); // o2 not yet submitted — correctly
  // The job re-grants the pending occurrence under a NEW grant:
  const g2 = await h.coord.requestGrant("job-1");
  let msg2 = null;
  await h.coord.drainOutbox(p => { msg2 = p; });
  assert.equal(msg2.grantId, g2.grantId);
  const r2 = await exec.handleMessage(msg2); // submits the batch (first and only POST)
  assert.equal(r2.occurrences.o2.pending, true);
  assert.equal(providers.calls.submitBatch, 1);
  const r3 = await exec.handleMessage(msg2); // poll to done under the same grant
  assert.equal(r3.occurrences.o2.reported, "success");
  assert.equal(providers.calls.submitBatch, 1);
  assert.equal(providers.calls.synthesize, 1);
  assert.equal(h.coord.jobView("job-1").state, "complete");
});

test("after an evidenced never-accepted resolution, the re-grant is REALLY processed: audited generation-2 attempt completes the job (review fix 2)", async () => {
  const { h, providers, exec } = world({ "job-1/o1": BATCH });
  providers.behavior.submit = (o, displayName) => {
    providers.batches.set("batches/fake-lost", { displayName, polls: 0 });
    throw new Error("response lost");
  };
  const { msg } = await dispatch(h, "job-1", "c1", [occ("o1", { revisionKey: FP_BATCH })]);
  const r1 = await exec.handleMessage(msg);
  assert.equal(r1.occurrences.o1.ambiguous, true);
  assert.equal(providers.calls.submitBatch, 1);
  // Authoritative evidence arrives; a human/coordinator resolution
  // retires generation 1 — claim untouched, intent+map superseded:
  const res = h.coord.resolveBatchNeverAccepted({ jobId: "job-1", occurrenceId: "o1", evidence: "provider ops audit #4471" });
  assert.equal(res.ok, true);
  // Alarms only from here: the re-advance grants fresh work…
  h.advance(31000);
  await h.coord.alarm();
  let msg2 = null;
  await h.coord.drainOutbox(p => { msg2 = p; });
  assert.ok(msg2 && msg2.grantId !== msg.grantId);
  // …and the executor ACTUALLY processes it: a fresh intent (gen 2)
  // and a second — audited — submission, then poll to completion.
  providers.behavior.submit = null;
  const r2 = await exec.handleMessage(msg2);
  assert.equal(r2.occurrences.o1.pending, true);
  assert.equal(providers.calls.submitBatch, 2); // exactly the one audited retry
  const intents = h.rows("spend_intents").sort((a, b) => a.generation - b.generation);
  assert.equal(intents.length, 2);
  assert.ok(intents[0].superseded_at);
  assert.match(intents[0].superseded_reason, /batch_never_accepted/);
  assert.equal(intents[1].generation, 2);
  assert.equal(intents[1].superseded_at, null);
  assert.ok(h.rows("transitions").some(t => t.cause === "spend_intent_superseded"));
  const r3 = await exec.handleMessage(msg2); // poll -> done
  assert.equal(r3.occurrences.o1.reported, "success");
  assert.equal(providers.calls.submitBatch, 2); // never a third
  assert.equal(h.coord.jobView("job-1").state, "complete");
});

test("cache verification failure is reported as failure, never as playable audio", async () => {
  const { h, providers, exec } = world({ "job-1/o1": STD });
  providers.behavior.synth = () => ({ audio: "AUDIO:o1", format: "mp3", durationSec: 100000 }); // absurd duration
  const { msg } = await dispatch(h, "job-1", "c1", [occ("o1", { revisionKey: FP_STD })]);
  const r = await exec.handleMessage(msg);
  assert.equal(r.occurrences.o1.reported, "verification_failed");
  assert.notEqual(h.coord.jobView("job-1").occurrences[0].state, "ready");
});
