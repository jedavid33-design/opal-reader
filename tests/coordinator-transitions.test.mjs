// P2: transition-table exhaustiveness + single-applier discipline.
// Every (state, event) pair is either a declared transition or an
// explicit, logged rejection — there is no third outcome.
import test from "node:test";
import assert from "node:assert/strict";
import { JOB_STATES, JOB_EVENTS, JOB_TRANSITIONS,
         OCC_STATES, OCC_EVENTS, OCC_TRANSITIONS } from "../v2/coordinator.mjs";
import { makeHarness } from "./helpers/do-harness.mjs";

function seedJob(h, state) {
  h.db.prepare(`INSERT INTO jobs (job_id, kind, book_id, chapter_index, lane, state, revision, data_json, created_at, updated_at)
                VALUES ('j', 'job', 'b', 0, 'standard', ?, 3, '{}', 1, 1)`).run(state);
  h.db.prepare(`INSERT INTO occurrences (job_id, occurrence_id, revision_key, state)
                VALUES ('j', 'o', 'fp-o', 'pending')`).run();
}
function seedOcc(h, state) {
  h.db.prepare(`INSERT INTO jobs (job_id, kind, book_id, chapter_index, lane, state, revision, data_json, created_at, updated_at)
                VALUES ('j', 'job', 'b', 0, 'standard', 'generating', 3, '{}', 1, 1)`).run();
  h.db.prepare(`INSERT INTO occurrences (job_id, occurrence_id, revision_key, state)
                VALUES ('j', 'o', 'fp-o', ?)`).run(state);
}

test("job transition table is exhaustive: declared or rejected, always logged", () => {
  for (const state of JOB_STATES) {
    for (const event of JOB_EVENTS) {
      const h = makeHarness();
      seedJob(h, state);
      const before = h.rows("transitions").length;
      const r = h.coord._tx(() => h.coord.applyJobEvent("j", event, "matrix-test"));
      const declared = (JOB_TRANSITIONS[state] || {})[event];
      const job = h.rows("jobs")[0];
      if (declared) {
        assert.equal(r.ok, true, `${state} --${event}--> should apply`);
        assert.equal(job.state, declared, `${state} --${event}--> ${declared}`);
        assert.equal(job.revision, 4);
      } else {
        assert.equal(r.ok, false, `${state} --${event}--> should reject`);
        assert.equal(r.reason, "illegal_transition");
        assert.equal(job.state, state, "rejection must not move the state");
        assert.equal(job.revision, 3, "rejection must not bump the revision");
      }
      assert.ok(h.rows("transitions").length > before,
        `every outcome is logged (I12): ${state}/${event}`);
    }
  }
});

test("occurrence transition table is exhaustive", () => {
  for (const state of OCC_STATES) {
    for (const event of OCC_EVENTS) {
      const h = makeHarness();
      seedOcc(h, state);
      const r = h.coord._tx(() => h.coord.applyOccEvent("j", "o", event, "matrix-test"));
      const declared = (OCC_TRANSITIONS[state] || {})[event];
      const o = h.rows("occurrences")[0];
      if (declared) {
        assert.equal(r.ok, true, `${state} --${event}--> should apply`);
        assert.equal(o.state, declared);
      } else {
        assert.equal(r.ok, false, `${state} --${event}--> should reject`);
        assert.equal(o.state, state);
      }
    }
  }
});

test("single applier: a stale expected revision is a conflict, never a write", () => {
  const h = makeHarness();
  seedJob(h, "queued");
  const r = h.coord._tx(() => h.coord.applyJobEvent("j", "grant", "test", null, 99));
  assert.equal(r.ok, false);
  assert.equal(r.reason, "revision_conflict");
  assert.equal(h.rows("jobs")[0].state, "queued");
  const ok = h.coord._tx(() => h.coord.applyJobEvent("j", "grant", "test", null, 3));
  assert.equal(ok.ok, true);
  assert.equal(ok.revision, 4);
});

test("outcome_unknown has no re-dispatch exit in the table", () => {
  // §1.2 rule 4: the only exits are reconcile_adopt / reconcile_spent /
  // resolve_resynthesize (all reconciliation decisions, none a retry).
  assert.deepEqual(Object.keys(OCC_TRANSITIONS.outcome_unknown).sort(),
    ["reconcile_adopt", "reconcile_spent", "resolve_resynthesize"]);
  assert.equal(OCC_TRANSITIONS.granted.lease_expired, "outcome_unknown");
});
