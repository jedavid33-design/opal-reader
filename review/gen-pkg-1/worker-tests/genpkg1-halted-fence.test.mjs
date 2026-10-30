// gen-pkg-1 round-3 corrections — R3-2 (Rowan round-3 source
// review, comment 6512804398).
//
// R3-2: round 2's fence treated a 'halted_unknown' plan as
// terminal/non-fencing, so a fresh intent could mint a NEW paid
// plan over the halted plan's occurrences while its billing was
// still unresolved. Round 3 reverses that (the round-2 premise
// is amended in place in genpkg1-overlap-fence.test.mjs):
//
//   * a halted_unknown plan FENCES its overlapping eligible
//     occurrences exactly like an active plan — rejection
//     plan_overlap_conflict naming the halted plan and its
//     semantics — for same- and different-semantics submissions
//     alike, from any command context ("two devices" = two
//     service instances over one coordinator, as elsewhere);
//   * clearance is an explicit OPERATOR act in two steps, never
//     an inference: (1) reconcile the plan's unknown attempts
//     (the pre-existing genstore.reconcileUnknown, exposed on
//     the service as reconcileUnknownAttempt — this also clears
//     the PHASE halt when the last unknown resolves), then
//     (2) retireHaltedPlan, which refuses while any of the
//     plan's attempts is still unknown (unknown_billing_open),
//     and on success moves the plan to the terminal state
//     'retired' with an audit row written in the same
//     transaction. Neither a fresh submission, nor a keepGoing
//     change, nor the phase halt clearing performs or implies
//     retirement — proven below by fencing that SURVIVES the
//     reconciliation + halt flip and ends only at retirement;
//   * retirement in the pinned production entry is reachable
//     only through the operator-only POST
//     /v2/d6-retire-halted-plan route (same operator fence class
//     as the phase-binding route; entry-level fencing of that
//     class is proven in genpkg1-phase-enforce.test.mjs). Its
//     USE against any production plan remains Julie's separate
//     authorization — here it is exercised only in fixtures;
//   * the halted plan is never resumed or mutated by any of
//     this (byte-identical rows asserted), driveOnce never
//     selects a retired plan, and the parked Ch 3 JOB
//     (coordinator-level, parked_policy) stays byte-identical
//     throughout.
//
// The halted plan below is built through the REAL machinery —
// submit → drive (grant) → execution → reserved → dispatching →
// confirmed/unknown attempt → markUnknownBilling (phase halt) →
// drive (plan halts) — mirroring the production Ch 2 halt's
// structure with synthetic data only.
import test from "node:test";
import assert from "node:assert/strict";
import { createGenStore } from "../worker/generation/genstore.mjs";
import { createGenerationService } from "../worker/generation/service.mjs";
import { createCoordinatorPlaneSource } from "../worker/generation/content-plane-adapter.mjs";
import { makeHarness } from "./helpers/do-harness.mjs";

const BOOK = "book-halt-mini";
const PARKED_JOB = "job-parked-fixture";
const T = (id) => `Synthetic prose for segment ${id}, invented for the halted-fence harness only.`;

function bookData({ parked = false } = {}) {
  const seg = (occurrenceId, text) => ({ occurrenceId, text, pov: "pov-a" });
  const chapters = [
    { chapterId: "ch-1", index: 1, segments: [seg("e0", T("e0")), seg("e2", T("e2"))] },
    { chapterId: "ch-2", index: 2, segments: [seg("e3", T("e3")), seg("e4", T("e4"))] },
  ];
  if (parked)
    chapters.push({ chapterId: "ch-3", index: 3, segments: [seg("p0", T("p0")), seg("p1", T("p1"))] });
  return {
    chapters,
    povs: [{ id: "pov-a", name: "Aria", voice: { voice_id: "Zephyr", provider: "gemini", model_id: "gemini-3.8-flash-tts", style_direction: "warm" } }],
    defaultVoice: { provider: "gemini", voice_id: "Zephyr" },
  };
}

async function makeWorld(opts = {}) {
  const h = makeHarness({});
  const store = createGenStore(h.coord);
  store.ensureSchema();
  h.db.prepare(`INSERT INTO sync_entities (family, entity_key, book_id, revision, deleted, data_json)
                VALUES ('content', ?, ?, 1, 0, ?)`).run(BOOK, BOOK, JSON.stringify(bookData(opts)));
  if (opts.parked) {
    const now = h.now();
    h.db.prepare(`INSERT INTO jobs (job_id, kind, book_id, chapter_index, lane, state,
                    revision, data_json, created_at, updated_at)
                  VALUES (?, 'chapter', ?, 3, 'standard', 'parked_policy', 1, ?, ?, ?)`)
      .run(PARKED_JOB, BOOK, JSON.stringify({ carried: "migration" }), now, now);
    const ins = h.db.prepare(`INSERT INTO occurrences (job_id, occurrence_id, revision_key, state, cache_key)
                              VALUES (?, ?, ?, 'pending', NULL)`);
    ins.run(PARKED_JOB, "p0", "fp-p0");
    ins.run(PARKED_JOB, "p1", "fp-p1");
  }
  const sources = createCoordinatorPlaneSource(h.coord);
  const mkService = () => createGenerationService({ coord: h.coord, env: h.env, store, sources });
  return { h, store, mkService, service: mkService() };
}

const planRow = (h, planId) => h.rows("d6_plans").find(p => p.plan_id === planId);
const snap = (v) => JSON.stringify(v);

// Drive one submitted plan into the REAL halted_unknown state:
// grant → execution → attempt confirmed/unknown →
// markUnknownBilling (phase halt) → next drive flips the plan.
async function haltPlan(w, intent, occurrenceId) {
  const a = await w.service.submitIntent(intent);
  assert.equal(a.created, true, "the plan to halt is admitted");
  await w.service.driveOnce();
  const link = w.h.rows("d6_plan_jobs").find(r => r.plan_id === a.planId);
  const grant = w.h.rows("grants").find(g => g.job_id === link.job_id);
  assert.ok(grant, "the first drive issued a grant for the plan's job");
  const { executionId } = w.store.createExecution({
    planId: a.planId, jobId: link.job_id, occurrenceId, grantId: grant.grant_id,
  });
  const attemptId = w.store.reserveAttempt(executionId, { upperMicroCents: 19652 });
  w.store.markDispatching(attemptId);
  const confirmed = w.store.confirmAttempt(attemptId, { outcome: "unknown", costMicroCents: null });
  assert.equal(confirmed.outcome, "unknown");
  assert.equal(confirmed.cost_micro_cents, null, "an unknown outcome is never zeroed");
  w.store.markUnknownBilling(executionId, { fixture: "synthetic-timeout-shape" });
  const execRow = w.h.rows("d6_execution_records").find(r => r.execution_id === executionId);
  assert.equal(execRow.state, "unknown_billing", "a REAL unknown-billing execution record");
  assert.equal(w.store.phaseAccounting(intent.phase).unknownOpen, 1);
  await w.service.driveOnce();
  const plan = planRow(w.h, a.planId);
  assert.equal(plan.state, "halted_unknown");
  assert.equal(plan.stop_reason, "phase_halted_unknown_billing");
  return { planId: a.planId, jobId: link.job_id, executionId, attemptId };
}

const bookIntent = (over = {}) => ({
  commandId: "h-book", bookId: BOOK, scope: "book", keepGoing: true,
  phase: "forever-pucked", lane: "standard", ...over,
});

test("R3-2: a halted_unknown plan fences same- and different-semantics submissions from two devices — zero new plans or grants", async () => {
  const w = await makeWorld();
  const halted = await haltPlan(w, bookIntent({ commandId: "h-1" }), "e0");
  const haltedRow = snap(planRow(w.h, halted.planId));
  const haltedJobs = snap(w.h.rows("d6_plan_jobs").filter(r => r.plan_id === halted.planId));
  const execRow = snap(w.h.rows("d6_execution_records").find(r => r.execution_id === halted.executionId));
  const counts = () => ({
    plans: w.h.rows("d6_plans").length,
    grants: w.h.rows("grants").length,
    attempts: w.h.rows("d6_attempt_log").length,
  });
  const before = counts();

  // The halted plan's OWN intent, resubmitted (a retry after a
  // lost response): converges on the halted plan — no new plan,
  // and the halt is reported, not hidden.
  const retry = await w.service.submitIntent(bookIntent({ commandId: "h-2" }));
  assert.equal(retry.planId, halted.planId);
  assert.equal(retry.created, false);
  assert.equal(retry.state, "halted_unknown");

  // A different-semantics submission from a SECOND device
  // (second service instance, same coordinator).
  const deviceB = w.mkService();
  const diff = await deviceB.submitIntent(bookIntent({ commandId: "h-3", keepGoing: false }));
  assert.equal(diff.outcome, "rejected");
  assert.equal(diff.reason, "plan_overlap_conflict");
  assert.equal(diff.conflict.planId, halted.planId, "the rejection names the halted plan");
  assert.equal(diff.conflict.phase, "forever-pucked");
  assert.equal(diff.conflict.keepGoing, true, "...and its immutable semantics");

  // A different SCOPE overlapping the halted plan's set.
  const scoped = await deviceB.submitIntent({
    commandId: "h-4", bookId: BOOK, scope: "chapter", chapterIndex: 1,
    keepGoing: true, phase: "forever-pucked", lane: "standard",
  });
  assert.equal(scoped.reason, "plan_overlap_conflict");
  assert.equal(scoped.conflict.planId, halted.planId);

  assert.deepEqual(counts(), before, "zero new plans, grants, or attempts across every fenced submission");
  assert.equal(snap(planRow(w.h, halted.planId)), haltedRow, "the halted plan's row is byte-identical");
  assert.equal(snap(w.h.rows("d6_plan_jobs").filter(r => r.plan_id === halted.planId)), haltedJobs);
  assert.equal(snap(w.h.rows("d6_execution_records").find(r => r.execution_id === halted.executionId)), execRow,
    "the unknown-billing execution record is untouched");
});

test("R3-2: non-overlapping submissions remain admissible beside a halted plan", async () => {
  const w = await makeWorld();
  const halted = await haltPlan(w, {
    commandId: "h-5", bookId: BOOK, scope: "chapter", chapterIndex: 1,
    keepGoing: false, phase: "forever-pucked", lane: "standard",
  }, "e0");
  const seg = await w.service.submitIntent({
    commandId: "h-6", bookId: BOOK, scope: "segment", occurrenceId: "e3",
    keepGoing: false, phase: "forever-pucked", lane: "standard",
  });
  assert.equal(seg.created, true, "a segment outside the halted plan's set is not fenced by it");
  assert.notEqual(seg.planId, halted.planId);
});

test("R3-2: clearance is never inferred — the fence survives reconciliation and the phase-halt flip; only retirement clears it", async () => {
  const w = await makeWorld();
  const halted = await haltPlan(w, bookIntent({ commandId: "h-7" }), "e0");

  // Retirement BEFORE reconciliation: refused — retirement
  // never papers over an unresolved charge.
  const early = w.service.retireHaltedPlan({ planId: halted.planId, note: "too soon", source: "test" });
  assert.deepEqual(early, { outcome: "rejected", reason: "unknown_billing_open", openUnknown: 1 });
  assert.equal(planRow(w.h, halted.planId).state, "halted_unknown");

  // Step 1 of clearance: reconcile the unknown attempt (the
  // operator learns the real outcome/cost from the provider's
  // records). The phase halt clears with it.
  const rec = w.service.reconcileUnknownAttempt(halted.attemptId,
    { knownCostMicro: 12000, outcome: "failed_known" });
  assert.equal(rec.outcome, "applied");
  assert.equal(rec.haltCleared, true);
  assert.equal(w.store.phaseAccounting("forever-pucked").unknownOpen, 0);
  assert.equal(w.h.rows("d6_phase_state").find(r => r.phase === "forever-pucked").halted_unknown_billing, 0,
    "the phase halt has flipped off...");

  // ...but the PLAN still owns its occurrences: a fresh
  // submission is STILL fenced. Clearance was not inferred from
  // the reconciliation or the halt flip.
  assert.equal(planRow(w.h, halted.planId).state, "halted_unknown");
  const still = await w.service.submitIntent(bookIntent({ commandId: "h-8", keepGoing: false }));
  assert.equal(still.reason, "plan_overlap_conflict");
  assert.equal(still.conflict.planId, halted.planId);

  // Step 2: the explicit retirement.
  const retired = w.service.retireHaltedPlan({
    planId: halted.planId, note: "unknown reconciled as failed_known at 12000 micro-cents (fixture)",
    source: "test-operator",
  });
  assert.equal(retired.outcome, "applied");
  assert.equal(retired.fromState, "halted_unknown");
  assert.equal(retired.state, "retired");
  const plan = planRow(w.h, halted.planId);
  assert.equal(plan.state, "retired");
  assert.equal(plan.stop_reason, "retired_unknown_billing");
  const audit = w.h.rows("d6_plan_retirements").find(r => r.plan_id === halted.planId);
  assert.ok(audit, "the retirement wrote its audit row in the same transaction");
  assert.match(audit.note, /reconciled/);
  assert.equal(audit.source, "test-operator");
});

test("R3-2: retirement refuses unknown plans and non-halted plans, by name", async () => {
  const w = await makeWorld();
  assert.deepEqual(w.service.retireHaltedPlan({ planId: "plan:nope" }),
    { outcome: "rejected", reason: "plan_not_found" });
  const a = await w.service.submitIntent(bookIntent({ commandId: "h-9" }));
  assert.equal(a.created, true);
  const active = w.service.retireHaltedPlan({ planId: a.planId });
  assert.equal(active.outcome, "rejected");
  assert.equal(active.reason, "plan_not_halted_unknown");
  assert.equal(active.state, "active");
  assert.equal(w.h.rows("d6_plans").find(p => p.plan_id === a.planId).state, "active",
    "a refused retirement moves nothing");
});

test("R3-2: after retirement a fresh submission over the same occurrences is admitted — and the retired plan is never driven again", async () => {
  const w = await makeWorld();
  const halted = await haltPlan(w, bookIntent({ commandId: "h-10" }), "e0");
  w.service.reconcileUnknownAttempt(halted.attemptId, { knownCostMicro: 0, outcome: "failed_known" });
  const retired = w.service.retireHaltedPlan({ planId: halted.planId, note: "cleared (fixture)", source: "test" });
  assert.equal(retired.outcome, "applied");
  const retiredRow = snap(planRow(w.h, halted.planId));

  const fresh = await w.service.submitIntent(bookIntent({ commandId: "h-11", keepGoing: false }));
  assert.equal(fresh.created, true, "ownership cleared: the fresh intent is admitted by the ordinary rules");
  assert.notEqual(fresh.planId, halted.planId);
  await w.service.driveOnce();
  assert.equal(snap(planRow(w.h, halted.planId)), retiredRow,
    "the driver never selects, grants against, or mutates a retired plan");
  assert.ok(w.h.rows("grants").some(g => g.job_id.startsWith(fresh.planId)),
    "the fresh plan drives normally");
});

test("R3-2: the parked Ch 3 job is byte-identical throughout the halt → fence → reconcile → retire → re-admit lifecycle", async () => {
  const w = await makeWorld({ parked: true });
  const parkedJob = () => snap(w.h.rows("jobs").find(j => j.job_id === PARKED_JOB));
  const parkedOcc = () => snap(w.h.rows("occurrences").filter(o => o.job_id === PARKED_JOB));
  const beforeJob = parkedJob(); const beforeOcc = parkedOcc();

  const halted = await haltPlan(w, bookIntent({ commandId: "h-12" }), "e0");
  const fenced = await w.service.submitIntent(bookIntent({ commandId: "h-13", keepGoing: false }));
  assert.equal(fenced.reason, "plan_overlap_conflict");
  w.service.reconcileUnknownAttempt(halted.attemptId, { knownCostMicro: 0, outcome: "failed_known" });
  w.service.retireHaltedPlan({ planId: halted.planId, note: "cleared (fixture)", source: "test" });
  const fresh = await w.service.submitIntent(bookIntent({ commandId: "h-14", keepGoing: false }));
  assert.equal(fresh.created, true);
  // The fresh plan never takes the parked chapter's occurrences
  // as ELIGIBLE (they appear, if at all, only as excluded rows —
  // the fence and the driver read eligible entries only).
  const freshEntries = w.h.rows("d6_plan_entries").filter(r => r.plan_id === fresh.planId);
  assert.ok(freshEntries.every(r =>
    !((r.occurrence_id === "p0" || r.occurrence_id === "p1") && r.disposition === "eligible")),
    "the parked chapter never enters a plan's eligible set");
  assert.equal(parkedJob(), beforeJob, "the parked job row is byte-identical");
  assert.equal(parkedOcc(), beforeOcc, "its occurrence rows are byte-identical");
  assert.equal(w.h.rows("jobs").find(j => j.job_id === PARKED_JOB).state, "parked_policy");
});
