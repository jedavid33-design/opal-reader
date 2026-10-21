// P2 round 3: Rowan's four final interaction fixes.
//  1. A voided (never-sent) dispatch releases its quota/cap reservation.
//  2. Audio digests: every authoritative prior digest must agree; a
//     stated hash cannot bless silently swapped bytes, not even via the
//     idempotent re-bind path, and not for legacy revisions either.
//  3. A dispatch record (provider request ID) is not proven spend; only
//     a confirmed provider outcome settles spent-without-audio.
//  4. In-flight completions settle a paused/queued job truthfully
//     through the single applier — the job ends Complete, nothing new
//     is dispatched.
import test from "node:test";
import assert from "node:assert/strict";
import { makeHarness, makeProbe, occ, submit } from "./helpers/do-harness.mjs";

// ---------- fix 1: voided dispatch must not consume quota/cap ----------

test("fix 1: pause -> void -> resume cycles at the cap release every reservation; one sent request counts once", async () => {
  const h = makeHarness({ probe: makeProbe(new Map()) });
  // Cap = exactly one occurrence's estimate (1000 micro-cents).
  await h.coord.handleCommand({ command_id: "s1", type: "SetSettings",
    payload: { data: { monthlyCap: 0.001 } } });
  await submit(h.coord, "c1", "job-1", [occ("o1")]);
  for (let cycle = 0; cycle < 3; cycle++) {
    const g = await h.coord.requestGrant("job-1");
    assert.equal(g.ok, true, `cycle ${cycle}: grant fits under the cap`);
    assert.equal(h.coord.quotaView().spentMicroCents, 1000);
    assert.equal(h.coord.quotaView().attemptsToday, 1);
    await h.coord.handleCommand({ command_id: "p" + cycle, type: "RequestPause",
      payload: { jobId: "job-1" } });
    assert.equal(await h.coord.drainOutbox(x => h.sentGrants.push(x)), 0); // voided, never sent
    // The reservation is RELEASED: quota and cap are whole again, and
    // the audit trail keeps both the attempt and its release.
    assert.equal(h.coord.quotaView().spentMicroCents, 0, `cycle ${cycle}: cap restored`);
    assert.equal(h.coord.quotaView().attemptsToday, 0, `cycle ${cycle}: quota restored`);
    assert.equal(h.rows("ledger_ops").filter(r => r.kind === "attempt").length, cycle + 1);
    assert.equal(h.rows("ledger_ops").filter(r => r.kind === "attempt_release").length, cycle + 1);
    const r = await h.coord.handleCommand({ command_id: "r" + cycle, type: "RequestResume",
      payload: { jobId: "job-1" } });
    assert.equal(r.outcome, "applied");
  }
  // The fourth grant is the one real dispatch: sent exactly once, and
  // counted exactly once against both quota and cap.
  const g = await h.coord.requestGrant("job-1");
  assert.equal(g.ok, true);
  assert.equal(await h.coord.drainOutbox(x => h.sentGrants.push(x)), 1);
  assert.equal(h.sentGrants.length, 1);
  assert.equal(h.coord.quotaView().attemptsToday, 1);
  assert.equal(h.coord.quotaView().spentMicroCents, 1000);
  assert.equal(h.rows("grants").filter(x => x.state === "voided").length, 3);
});

test("fix 1: voided dispatches release the 100/day estimate at the threshold", async () => {
  const h = makeHarness({ probe: makeProbe(new Map()) });
  const { dayKey, monthKey } = h.coord.quotaView();
  for (let i = 0; i < 99; i++)
    h.db.prepare(`INSERT INTO ledger_ops (op_key, at, day_key, month_key, kind, est_micro_cents)
                  VALUES (?, ?, ?, ?, 'attempt', 0)`)
      .run("seed-" + i, h.now(), dayKey, monthKey);
  await submit(h.coord, "c1", "job-1", [occ("o1")]);
  assert.equal((await h.coord.requestGrant("job-1")).ok, true); // the 100th attempt
  assert.equal(h.coord.quotaView().attemptsToday, 100);
  await h.coord.handleCommand({ command_id: "p1", type: "RequestPause", payload: { jobId: "job-1" } });
  await h.coord.drainOutbox(x => h.sentGrants.push(x)); // voids the unsent dispatch
  assert.equal(h.coord.quotaView().attemptsToday, 99); // released, not burned
  await h.coord.handleCommand({ command_id: "r1", type: "RequestResume", payload: { jobId: "job-1" } });
  assert.equal((await h.coord.requestGrant("job-1")).ok, true); // fits again
  assert.equal(h.coord.quotaView().attemptsToday, 100);
  // ...and the ceiling is real: a second job cannot also squeeze in.
  await submit(h.coord, "c2", "job-2", [occ("o9")]);
  const blocked = await h.coord.requestGrant("job-2");
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, "quota_estimate_exhausted");
});

// ---------- fix 2: hashes cannot bypass previously anchored bytes ------

test("fix 2a: an identical re-bind after a silent byte swap is a conflict, not idempotent success", () => {
  const objects = new Map([["k1", { format: "mp3", identity: "fp-a", sha: "aaaa" }]]);
  const h = makeHarness({ probe: makeProbe(objects) });
  assert.equal(h.coord.validateAndBind(
    { occurrenceId: "o1", revisionKey: "fp-a", cacheKey: "k1" }).bound, true);
  assert.equal(h.rows("cache_index")[0].sha256, "aaaa"); // digest anchored at bind
  // Bytes silently swapped under the same key; the write-time record
  // still says what was written (aaaa), the bytes now hash to bbbb.
  objects.set("k1", { format: "mp3", identity: "fp-a", sha: "bbbb", recordedSha: "aaaa" });
  const v = h.coord.validateAndBind(
    { occurrenceId: "o1", revisionKey: "fp-a", cacheKey: "k1" }); // identical binding
  assert.equal(v.bound, false);
  assert.equal(v.reason, "content_hash_mismatch");
  assert.equal(h.rows("bindings").length, 1); // no NEW success declared
  assert.ok(h.coord.conflictsView().some(c => c.reason === "content_hash_mismatch"));
});

test("fix 2b: an executor-supplied digest matching swapped bytes cannot bless them over the anchored digest", () => {
  const objects = new Map([["k1", { format: "mp3", identity: "fp-a", sha: "aaaa" }]]);
  const h = makeHarness({ probe: makeProbe(objects) });
  assert.equal(h.coord.validateAndBind(
    { occurrenceId: "o1", revisionKey: "fp-a", cacheKey: "k1" }).bound, true);
  objects.set("k1", { format: "mp3", identity: "fp-a", sha: "bbbb", recordedSha: "aaaa" });
  // A different occurrence arrives with a digest that honestly matches
  // the CURRENT (swapped) bytes — it still must not bind: the anchored
  // digest disagrees with the bytes now under the key.
  const v = h.coord.validateAndBind(
    { occurrenceId: "o2", revisionKey: "fp-a", cacheKey: "k1", expectedSha256: "bbbb" });
  assert.equal(v.bound, false);
  assert.equal(v.reason, "content_hash_mismatch");
  assert.equal(h.rows("bindings").length, 1);
});

test("fix 2c: the legacy exemption never ignores a known digest", () => {
  const objects = new Map([["legkey", { format: "mp3", identity: null, sha: "aaaa" }]]);
  const h = makeHarness({ probe: makeProbe(objects) });
  assert.equal(h.coord.validateAndBind(
    { occurrenceId: "o1", revisionKey: "legacy:legkey", cacheKey: "legkey" }).bound, true);
  objects.set("legkey", { format: "mp3", identity: null, sha: "bbbb", recordedSha: "aaaa" });
  const same = h.coord.validateAndBind(
    { occurrenceId: "o1", revisionKey: "legacy:legkey", cacheKey: "legkey" });
  assert.equal(same.bound, false);
  assert.equal(same.reason, "content_hash_mismatch");
  const stated = h.coord.validateAndBind(
    { occurrenceId: "o2", revisionKey: "legacy:legkey", cacheKey: "legkey", expectedSha256: "bbbb" });
  assert.equal(stated.bound, false);
  assert.equal(stated.reason, "content_hash_mismatch");
  assert.equal(h.rows("bindings").length, 1);
});

// ---------- fix 3: dispatch record is not proven spend ------------------

test("fix 3: dispatch recorded right before a crash, no provider outcome -> stays outcome_unknown, never replayed; confirmed outcome settles spent", async () => {
  const h = makeHarness({ probe: makeProbe(new Map(), () => null) });
  await submit(h.coord, "c1", "job-1", [occ("o1")]);
  const g = await h.coord.requestGrant("job-1");
  await h.coord.drainOutbox(x => h.sentGrants.push(x)); // dispatch left the building
  h.coord.noteProviderRequest(g.grantId, "o1", "provider-req-crash"); // ...and then the crash
  const coord2 = h.crash();
  const lease = h.rows("schedule").find(r => r.kind === "lease");
  h.setNow(lease.due_at + 1000);
  await coord2.alarm(); // lease expiry + automatic reconciliation pass
  let view = coord2.jobView("job-1");
  assert.equal(view.state, "outcome_unknown");
  assert.equal(view.occurrences[0].state, "outcome_unknown"); // NOT failed/spent
  // No automatic replay: still exactly one grant, one (sent) outbox row.
  assert.equal(h.rows("grants").length, 1);
  assert.equal(h.rows("outbox").length, 1);
  const r = coord2.reconcileUnknown("job-1", "o1");
  assert.deepEqual([r.ok, r.exit], [true, "still_unknown"]);
  // Genuine provider evidence arrives later (status lookup): NOW the
  // spent-without-audio outcome is representable and settles the job.
  const noted = coord2.noteProviderOutcome(g.grantId, "o1", "spent_without_audio",
    { source: "provider_status_lookup", providerStatus: "completed_no_audio" });
  assert.equal(noted.ok, true);
  const r2 = coord2.reconcileUnknown("job-1", "o1");
  assert.deepEqual([r2.ok, r2.exit], [true, "spent_without_audio"]);
  view = coord2.jobView("job-1");
  assert.equal(view.occurrences[0].state, "failed");
  assert.match(h.rows("occurrences")[0].detail_json, /spent_without_audio/);
  assert.equal(view.state, "failed");
});

// ---------- fix 4: paused in-flight completions settle truthfully ------

const twoKeyProbe = () => makeProbe(new Map([
  ["key-o1", { format: "mp3", identity: "fp-o1", sha: "a1" }],
  ["key-o2", { format: "mp3", identity: "fp-o2", sha: "a2" }],
]));

test("fix 4: pause -> delivered grant reports full success -> resume ends Complete, nothing new dispatched", async () => {
  const h = makeHarness({ probe: twoKeyProbe() });
  await submit(h.coord, "c1", "job-1", [occ("o1"), occ("o2")]);
  const g = await h.coord.requestGrant("job-1");
  assert.equal(await h.coord.drainOutbox(x => h.sentGrants.push(x)), 1); // dispatch DELIVERED
  const p = await h.coord.handleCommand({ command_id: "c2", type: "RequestPause",
    payload: { jobId: "job-1" } });
  assert.equal(p.state, "paused_user");
  // The in-flight work finishes and reports while the job is paused.
  const rep = await h.coord.handleReport({ grantId: g.grantId,
    jobRevision: h.coord.jobView("job-1").revision,
    results: [
      { occurrenceId: "o1", outcome: "success", revisionKey: "fp-o1", cacheKey: "key-o1" },
      { occurrenceId: "o2", outcome: "success", revisionKey: "fp-o2", cacheKey: "key-o2" }] });
  assert.equal(rep.ok, true);
  let view = h.coord.jobView("job-1");
  assert.deepEqual(view.occurrences.map(o => o.state), ["ready", "ready"]);
  assert.equal(view.state, "complete"); // settled truthfully, via the applier
  const logged = h.rows("transitions").find(t =>
    t.aggregate === "job" && t.cause === "report" && t.to_state === "complete");
  assert.ok(logged, "the settling transition is on the log");
  const r = await h.coord.handleCommand({ command_id: "c3", type: "RequestResume",
    payload: { jobId: "job-1" } });
  assert.equal(r.outcome, "applied");
  assert.equal(r.state, "complete");
  view = h.coord.jobView("job-1");
  assert.equal(view.state, "complete");
  // No new synthesis was dispatched anywhere in the flow.
  assert.equal(h.rows("grants").length, 1);
  assert.equal(h.rows("outbox").length, 1);
  assert.equal(h.rows("ledger_ops").filter(x => x.kind === "attempt").length, 2);
  assert.equal(h.sentGrants.length, 1);
});

test("fix 4 (queued): resume lands in queued before the in-flight report arrives -> the report still settles Complete", async () => {
  const h = makeHarness({ probe: twoKeyProbe() });
  await submit(h.coord, "c1", "job-1", [occ("o1")]);
  const g = await h.coord.requestGrant("job-1");
  await h.coord.drainOutbox(x => h.sentGrants.push(x));
  await h.coord.handleCommand({ command_id: "c2", type: "RequestPause", payload: { jobId: "job-1" } });
  const r = await h.coord.handleCommand({ command_id: "c3", type: "RequestResume",
    payload: { jobId: "job-1" } });
  assert.equal(r.state, "queued"); // occurrences still granted/in flight
  const rep = await h.coord.handleReport({ grantId: g.grantId,
    results: [{ occurrenceId: "o1", outcome: "success", revisionKey: "fp-o1", cacheKey: "key-o1" }] });
  assert.equal(rep.ok, true);
  assert.equal(h.coord.jobView("job-1").state, "complete");
  assert.equal(h.rows("grants").length, 1); // nothing re-dispatched
});
