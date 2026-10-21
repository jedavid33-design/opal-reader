// P2: the atomic budget gate — quota estimate, spending cap, parks on
// evidence only, probe resume, and no clock-driven restart (F5/B5/B6, I8).
import test from "node:test";
import assert from "node:assert/strict";
import { makeHarness, makeProbe, occ, submit } from "./helpers/do-harness.mjs";

const probeOk = () => makeProbe(new Map());

test("grant: occurrences granted, attempts reserved, outbox + lease written, one transaction", () => {
  const h = makeHarness({ probe: probeOk() });
  submit(h.coord, "c1", "job-1", [occ("o1"), occ("o2")]);
  const g = h.coord.requestGrant("job-1");
  assert.equal(g.ok, true);
  assert.equal(g.count, 2);
  assert.deepEqual(h.rows("occurrences").map(o => o.state), ["granted", "granted"]);
  assert.equal(h.rows("ledger_ops").filter(r => r.kind === "attempt").length, 2);
  assert.equal(h.rows("outbox").length, 1);
  assert.equal(h.rows("schedule").filter(r => r.kind === "lease").length, 1);
  assert.equal(h.coord.jobView("job-1").state, "generating");
  const sent = h.coord.drainOutbox(x => h.sentGrants.push(x));
  assert.equal(sent, 1);
  assert.equal(h.sentGrants[0].grantId, g.grantId);
});

test("quota estimate guard: a full day blocks grants before any spend", () => {
  const h = makeHarness({ probe: probeOk() });
  const now = h.now();
  for (let i = 0; i < 100; i++)
    h.db.prepare(`INSERT INTO ledger_ops (op_key, at, day_key, month_key, kind, est_micro_cents)
                  VALUES (?, ?, '2025-10-09', '2025-10', 'attempt', 0)`).run("seed-" + i, now);
  submit(h.coord, "c1", "job-1", [occ("o1")]);
  const g = h.coord.requestGrant("job-1");
  assert.equal(g.ok, false);
  assert.equal(g.reason, "quota_estimate_exhausted");
  assert.equal(h.rows("occurrences")[0].state, "pending");
  assert.equal(h.rows("outbox").length, 0);
});

test("spending cap is adjudicated inside the grant transaction", () => {
  const h = makeHarness({ probe: probeOk() });
  h.coord.handleCommand({ command_id: "s1", type: "SetSettings",
    payload: { data: { monthlyCap: 0.001 } } }); // $0.001 -> 1000 micro-cents
  submit(h.coord, "c1", "job-a", [occ("o1")]); // est 1000 -> exactly at cap
  submit(h.coord, "c2", "job-b", [occ("o2")]);
  assert.equal(h.coord.requestGrant("job-a").ok, true);
  const g2 = h.coord.requestGrant("job-b");
  assert.equal(g2.ok, false);
  assert.equal(g2.reason, "spending_cap");
  // the rejected grant left NO partial writes behind
  assert.equal(h.rows("occurrences").find(o => o.occurrence_id === "o2").state, "pending");
  assert.equal(h.rows("ledger_ops").filter(r => r.detail_json.includes("o2")).length, 0);
  assert.equal(h.rows("outbox").length, 1);
});

test("daily-limit evidence parks; the attempted occurrence is preserved pending", () => {
  const h = makeHarness({ probe: probeOk() });
  submit(h.coord, "c1", "job-1", [occ("o1"), occ("o2")]);
  const g = h.coord.requestGrant("job-1");
  const evidence = { provider: "gemini", code: "RESOURCE_EXHAUSTED", quotaId: "daily-100" };
  const rep = h.coord.handleReport({ grantId: g.grantId, jobRevision: 2,
    results: [{ occurrenceId: "o1", outcome: "daily_limit", evidence }] });
  assert.equal(rep.ok, true);
  const view = h.coord.jobView("job-1");
  assert.equal(view.state, "paused_quota");
  assert.equal(view.occurrences.find(o => o.occurrence_id === "o1").state, "pending");
  const park = h.rows("quota_parks")[0];
  assert.deepEqual(JSON.parse(park.evidence_json), evidence);
  // an unrelated job is also refused while the account-wide park is open
  submit(h.coord, "c2", "job-2", [occ("o9")]);
  assert.equal(h.coord.requestGrant("job-2").reason, "quota_parked");
  assert.equal(h.coord.quotaView().parked.evidence.quotaId, "daily-100");
});

test("generic 429 is weather: backoff + retry, never a park (B5)", async () => {
  const h = makeHarness({ probe: probeOk() });
  submit(h.coord, "c1", "job-1", [occ("o1")]);
  const g = h.coord.requestGrant("job-1");
  h.coord.drainOutbox(x => h.sentGrants.push(x));
  const rep = h.coord.handleReport({ grantId: g.grantId, jobRevision: 2,
    results: [{ occurrenceId: "o1", outcome: "rate_limited" }] });
  assert.equal(rep.ok, true);
  assert.equal(h.rows("quota_parks").length, 0);
  assert.equal(h.coord.jobView("job-1").state, "generating");
  assert.equal(h.coord.jobView("job-1").occurrences[0].state, "pending");
  const retry = h.rows("schedule").find(r => r.kind === "retry_grant");
  assert.ok(retry, "a bounded retry step was scheduled");
  h.setNow(retry.due_at);
  await h.coord.alarm();
  assert.equal(h.coord.jobView("job-1").occurrences[0].state, "granted");
  assert.equal(h.rows("ledger_ops").filter(r => r.kind === "attempt").length, 2);
});

test("probe resume: one occurrence, success releases the park, no clock restart (B6)", () => {
  const objects = new Map([["key-o1", { format: "wav", identity: "fp-o1" }],
                           ["key-o2", { format: "wav", identity: "fp-o2" }]]);
  const h = makeHarness({ probe: makeProbe(objects) });
  submit(h.coord, "c1", "job-1", [occ("o1"), occ("o2")]);
  const g = h.coord.requestGrant("job-1");
  h.coord.handleReport({ grantId: g.grantId, jobRevision: 2,
    results: [{ occurrenceId: "o1", outcome: "daily_limit", evidence: { quotaId: "daily-100" } }] });
  assert.equal(h.coord.jobView("job-1").state, "paused_quota");
  // 25 hours pass (past any reset): nothing moves on its own.
  h.advance(25 * 3600 * 1000);
  assert.equal(h.coord.jobView("job-1").state, "paused_quota");
  assert.equal(h.rows("outbox").filter(r => !r.sent_at).length, 1); // only the original grant
  // Julie resumes: exactly one probe occurrence is dispatched.
  const r = h.coord.handleCommand({ command_id: "c9", type: "RequestResume", payload: { jobId: "job-1" } });
  assert.equal(r.outcome, "applied");
  assert.equal(r.probe, true);
  const granted = h.coord.jobView("job-1").occurrences.filter(o => o.state === "granted");
  assert.equal(granted.length, 1);
  const probeGrant = h.rows("grants").find(x => x.grant_id === r.grantId);
  assert.ok(probeGrant.grant_id.endsWith(":probe"));
  const rep = h.coord.handleReport({ grantId: r.grantId,
    results: [{ occurrenceId: granted[0].occurrence_id, outcome: "success",
                revisionKey: "fp-" + granted[0].occurrence_id,
                cacheKey: "key-" + granted[0].occurrence_id }] });
  assert.equal(rep.ok, true);
  assert.equal(h.rows("quota_parks")[0].released_at !== null, true);
  assert.equal(h.rows("quota_parks")[0].release_cause, "probe_success");
  // ...and the rest of the job can now be granted.
  assert.equal(h.coord.requestGrant("job-1").ok, true);
});

test("stale reports are rejected for state; replays are harmless", () => {
  const objects = new Map([["key-o1", { format: "mp3", identity: "fp-o1" }]]);
  const h = makeHarness({ probe: makeProbe(objects) });
  submit(h.coord, "c1", "job-1", [occ("o1")]);
  const g = h.coord.requestGrant("job-1");
  const stale = h.coord.handleReport({ grantId: g.grantId, jobRevision: 99,
    results: [{ occurrenceId: "o1", outcome: "success", revisionKey: "fp-o1", cacheKey: "key-o1" }] });
  assert.equal(stale.ok, false);
  assert.equal(stale.reason, "stale_revision");
  assert.equal(h.coord.jobView("job-1").occurrences[0].state, "granted");
  const good = { grantId: g.grantId, jobRevision: 2,
    results: [{ occurrenceId: "o1", outcome: "success", revisionKey: "fp-o1", cacheKey: "key-o1" }] };
  assert.equal(h.coord.handleReport(good).ok, true);
  assert.equal(h.coord.jobView("job-1").state, "complete");
  const replay = h.coord.handleReport(good);
  assert.equal(replay.ok, true);
  assert.equal(replay.replayed, true);
  assert.equal(h.rows("bindings").length, 1);
});

test("repair chains: a finished plan spawns its follow-on server-side (B7)", () => {
  const objects = new Map([["key-o1", { format: "mp3", identity: "fp-o1" }]]);
  const h = makeHarness({ probe: makeProbe(objects) });
  h.coord.handleCommand({ command_id: "r1", type: "RequestRepair",
    payload: { jobId: "repair-1", bookId: "book-1", chapterIndex: 2, lane: "standard",
               occurrences: [occ("o1")], data: { estMicroCents: 1000 } } });
  const g = h.coord.requestGrant("repair-1");
  const rep = h.coord.handleReport({ grantId: g.grantId, jobRevision: 2,
    results: [{ occurrenceId: "o1", outcome: "success", revisionKey: "fp-o1", cacheKey: "key-o1" }],
    detail: { followOn: { occurrences: [occ("o2"), occ("o3")] } } });
  assert.equal(rep.ok, true);
  const follow = h.coord.jobView("repair-1:follow:1");
  assert.ok(follow, "follow-on plan exists without any client command");
  assert.equal(follow.state, "queued");
  assert.equal(follow.kind, "repair");
  assert.equal(follow.occurrences.length, 2);
});
