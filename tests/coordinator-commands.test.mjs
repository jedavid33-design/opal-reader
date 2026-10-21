// P2: durable commands — acceptance, receipts, idempotent replay, freeze,
// settings versioning, and the RequestSynthesis gate (§1.1/§1.2).
import test from "node:test";
import assert from "node:assert/strict";
import { makeHarness, makeProbe, occ, submit } from "./helpers/do-harness.mjs";

test("submit applies once; the same command_id replays the original outcome", async () => {
  const h = makeHarness();
  const r1 = await submit(h.coord, "cmd-1", "job-1", [occ("o1"), occ("o2")]);
  assert.equal(r1.outcome, "applied");
  assert.equal(r1.state, "queued");
  const r2 = await submit(h.coord, "cmd-1", "job-1", [occ("o1"), occ("o2")]);
  assert.equal(r2.outcome, "applied");
  assert.equal(r2.replayed, true);
  assert.equal(h.rows("jobs").length, 1);
  assert.equal(h.rows("commands").length, 1);
  const receipt = h.coord.receipt("cmd-1");
  assert.equal(receipt.outcome, "applied");
  assert.equal(receipt.type, "SubmitJob");
});

test("a lost acknowledgement is recoverable: crash, re-send, same outcome (seam i)", async () => {
  const h = makeHarness();
  const r1 = await submit(h.coord, "cmd-crash", "job-9", [occ("o1")]);
  assert.equal(r1.outcome, "applied");
  const coord2 = h.crash(); // instance discarded; storage survives
  const r2 = await submit(coord2, "cmd-crash", "job-9", [occ("o1")]);
  assert.equal(r2.replayed, true);
  assert.equal(r2.outcome, "applied");
  assert.equal(h.rows("jobs").length, 1);
  assert.equal(coord2.receipt("cmd-crash").outcome, "applied");
});

test("duplicate job under a new command id is a recorded rejection", async () => {
  const h = makeHarness();
  await submit(h.coord, "c1", "job-1", [occ("o1")]);
  const r = await submit(h.coord, "c2", "job-1", [occ("o9")]);
  assert.equal(r.outcome, "rejected");
  assert.equal(r.reason, "job_exists");
  assert.equal(h.coord.receipt("c2").outcome, "rejected");
  assert.equal(h.rows("occurrences").length, 1);
});

test("unknown command types are refused before recording", async () => {
  const h = makeHarness();
  const r = await h.coord.handleCommand({ command_id: "x", type: "Nuke", payload: {} });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "unknown_command_type");
  assert.equal(h.rows("commands").length, 0);
});

test("freeze directive: mutations reject as frozen, unfreeze restores", async () => {
  const h = makeHarness();
  const f = await h.coord.handleCommand({ command_id: "fz1", type: "FreezeDirective", payload: { freeze: true } });
  assert.equal(f.outcome, "applied");
  const r = await submit(h.coord, "c1", "job-1", [occ("o1")]);
  assert.equal(r.outcome, "rejected");
  assert.equal(r.reason, "frozen");
  assert.equal(h.rows("jobs").length, 0); // rejection applied nothing
  // the rejection itself is durable and queryable
  assert.equal(h.coord.receipt("c1").reason, "frozen");
  const f2 = await h.coord.handleCommand({ command_id: "fz2", type: "FreezeDirective", payload: { freeze: false } });
  assert.equal(f2.outcome, "applied");
  assert.equal((await submit(h.coord, "c2", "job-1", [occ("o1")])).outcome, "applied");
});

test("pause / resume / cancel flow through the transition table", async () => {
  const h = makeHarness();
  await submit(h.coord, "c1", "job-1", [occ("o1")]);
  await h.coord.requestGrant("job-1");
  const p = await h.coord.handleCommand({ command_id: "c2", type: "RequestPause", payload: { jobId: "job-1" } });
  assert.equal(p.state, "paused_user");
  const bad = await h.coord.handleCommand({ command_id: "c3", type: "RequestPause", payload: { jobId: "job-1" } });
  assert.equal(bad.outcome, "rejected");
  assert.equal(bad.reason, "illegal_transition");
  const r = await h.coord.handleCommand({ command_id: "c4", type: "RequestResume", payload: { jobId: "job-1" } });
  assert.equal(r.state, "queued");
  const x = await h.coord.handleCommand({ command_id: "c5", type: "RequestCancel", payload: { jobId: "job-1" } });
  assert.equal(x.state, "cancelled");
});

test("settings: versioned updates, stale base revision conflicts", async () => {
  const h = makeHarness();
  const s1 = await h.coord.handleCommand({ command_id: "s1", type: "SetSettings",
    payload: { data: { monthlyCap: 25 } } });
  assert.equal(s1.outcome, "applied");
  assert.equal(s1.revision, 1);
  assert.equal(h.coord.settingsView().monthlyCap, 25);
  const stale = await h.coord.handleCommand({ command_id: "s2", type: "SetSettings",
    payload: { baseRevision: 0, data: { monthlyCap: 10 } } });
  assert.equal(stale.outcome, "rejected");
  assert.equal(stale.reason, "settings_conflict");
  assert.equal(stale.revision, 1);
  assert.equal(h.coord.settingsView().monthlyCap, 25); // unchanged
  const s3 = await h.coord.handleCommand({ command_id: "s3", type: "SetSettings",
    payload: { baseRevision: 1, data: { geminiLane: "standard" } } });
  assert.equal(s3.outcome, "applied");
  assert.equal(h.coord.settingsView().geminiLane, "standard");
  assert.equal(h.coord.settingsView().monthlyCap, 25); // merged, not replaced
});

test("RequestSynthesis: cached answer first, otherwise a gated grant", async () => {
  const objects = new Map([["key-a", { format: "mp3", identity: "fp-o1" }]]);
  const h = makeHarness({ probe: makeProbe(objects) });
  const adopt = await h.coord.handleCommand({ command_id: "a1", type: "AdoptAudio",
    payload: { occurrenceId: "o1", revisionKey: "fp-o1", cacheKey: "key-a" } });
  assert.equal(adopt.outcome, "applied");
  const cached = await h.coord.handleCommand({ command_id: "q1", type: "RequestSynthesis",
    payload: { occurrenceId: "o1", revisionKey: "fp-o1" } });
  assert.equal(cached.answer, "cached");
  assert.equal(cached.cacheKey, "key-a");
  assert.equal(h.rows("ledger_ops").length, 0); // a cached answer spends nothing
  const granted = await h.coord.handleCommand({ command_id: "q2", type: "RequestSynthesis",
    payload: { occurrenceId: "o2", revisionKey: "fp-o2", estMicroCents: 500 } });
  assert.equal(granted.answer, "granted");
  assert.ok(granted.grantId);
  assert.equal(h.rows("ledger_ops").length, 1); // the grant reserved its attempt
});
