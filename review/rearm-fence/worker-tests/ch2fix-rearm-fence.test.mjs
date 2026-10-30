// CH2 PROGRAM — Workstream A re-arm dispatch fence: adversarial
// suite T1–T15 (design packet §4, Revision 1) plus focused
// assertions for Rowan's three build-detail pins (board issue
// #15 comment 6532307605, accepting the design for build):
//
//   pin 1 — when BOTH persisted job stamps (data_json.d6PlanId
//     and data_json.planId) exist, a disagreement refuses
//     (plan_link_conflict); agreement dispatches (T11/T11b/T11c).
//   pin 2 — a present-but-invalid/non-object data_json is
//     corruption (plan_state_check_failed), never evidence of a
//     plan-less job (T15/T15b).
//   pin 3 — SELECT DISTINCT plan_id returning multiple rows
//     preserves plan_link_conflict; it must NOT collapse into
//     plan_state_check_failed via a generic cardinality throw
//     (T12 asserts the exact refusal string).
//
// Every world runs the REAL pre-claim path: the real coordinator
// over the production-semantics harness (real SQLite, .one()
// throws on empty), the real genstore, and the D6 executor's
// handleMessage. For every refusal, the global pair is asserted:
// provider calls 0 AND full row sets of grants, claims,
// transitions, jobs, occurrences, d6_plans, d6_plan_jobs,
// d6_execution_records, spend_intents and d6_attempt_log are
// byte-identical before/after — a refusal opens no claim and no
// ledger entry. T10 is the single-resolution proof: the hold
// that fires is on the SERVER-RESOLVED plan while the message
// names a different, unheld, active plan — the same resolved
// identity feeds both pre-claim checks.
//
// Focused re-review corrections (Rowan, board issue #15
// comment 6532568882):
//
//   F1 — planStateFenceRefusal validates EACH present
//     message-carried plan field (planId AND d6PlanId)
//     independently against the resolved identity; the old
//     first-truthy selection let a matching planId mask a
//     conflicting d6PlanId. Malformed present fields
//     (non-string / empty) refuse plan_link_mismatch; both
//     fields matching is the positive control (T16*).
//   F2 — a PRESENT persisted stamp must be a non-empty,
//     non-whitespace string: empty/whitespace stamps are
//     invalid data (plan_state_check_failed), not absent
//     stamps; absent/null stamps keep the legitimate
//     plan-less reading. The schema's plan_id is TEXT NOT
//     NULL (NULL unstorable), but a BLANK link plan_id is
//     storable and is rejected as a corrupt link (T17*).
//
// All fixtures synthetic; no book text anywhere. This suite is
// the package's own candidate suite (Workstream A build);
// no baseline suite is touched by it.

import test from "node:test";
import assert from "node:assert/strict";
import { makeHarness } from "./helpers/do-harness.mjs";
import {
  makeFakeR2Bucket, makeFakeD6Providers, sha256HexOf,
} from "./helpers/d6-fakes.mjs";
import { createFlushStore } from "../worker/generation/flush-store.mjs";
import { createD6Executor } from "../worker/generation/d6-executor.mjs";
import { createD6WorkSource } from "../worker/generation/d6-work-source.mjs";
import { createGenStore } from "../worker/generation/genstore.mjs";
import { recordQuarantineHold } from "../worker/generation/quarantine.mjs";
import { fingerprintFor } from "../worker/executor.mjs";

const BOOK = "book-1";
const PHASE = "forever-pucked";
// The production executor's consumer identity (worker-entry-prod-d6
// default): the T1 claim is held by THIS consumer, so absent the
// fence the stale message would fall through claim discipline and
// dispatch — the refusal must come from the fence alone.
const CONSUMER = "opalreader-v2-prod-d6";

const TEXT = "Synthetic fence-fixture segment prose, invented for the harness only.";
const payloadFor = (text) => ({
  text, voice: "Zephyr", provider: "gemini", model: "gemini-3.8-flash-tts",
  styleDirection: "warm", mode: "standard",
});

// The coordinator's binding gate reads env.probe; bridge it to
// the fake bucket (the d6-executor-fi pattern).
function bridgeProbe(bucket, flushStore) {
  const find = (cacheKey) => {
    for (const ext of ["wav", "mp3"]) {
      const key = flushStore.objectKeyFor(cacheKey, ext);
      const e = bucket.store.get(key);
      if (e) return { key, ...e };
    }
    return null;
  };
  return {
    exists: (k) => !!find(k),
    sniff: (k) => { const e = find(k); return e ? (e.key.endsWith(".mp3") ? "mp3" : "wav") : null; },
    recordedIdentity: (k) => { const e = find(k); return e ? (e.customMetadata?.identity ?? null) : null; },
    hash: (k) => { const e = find(k); return e ? sha256HexOf(e.bytes) : null; },
    recordedSha256: (k) => { const e = find(k); return e ? (e.customMetadata?.sha256 ?? null) : null; },
    keyFor: () => null,
  };
}

function seedContent(h, segments) {
  const data = {
    chapters: [{ chapterId: "ch-1", segments: segments.map((s) => ({
      occurrenceId: s.occurrenceId, text: s.text, pov: "pov-a" })) }],
    povs: [
      { id: "pov-a", name: "Aria", voice: { voice_id: "Zephyr", provider: "gemini", model_id: "gemini-3.8-flash-tts", style_direction: "warm" } },
    ],
  };
  h.db.prepare(`INSERT INTO sync_entities (family, entity_key, book_id, revision, deleted, data_json)
                VALUES ('content', ?, ?, 1, 0, ?)`).run(BOOK, BOOK, JSON.stringify(data));
}

function insertPlanRow(h, planId, state) {
  h.db.prepare(`INSERT OR IGNORE INTO d6_plans
                  (plan_id, intent_key, book_id, scope, keep_going, phase, lane, state, stop_reason, created_at, updated_at)
                VALUES (?, ?, ?, 'chapter', 0, ?, 'standard', ?, ?, 0, 0)`)
    .run(planId, `intent-${planId}`, BOOK, PHASE, state,
         state === "halted_unknown" ? "phase_halted_unknown_billing" : null);
}

// A world: real coordinator + genstore + executor; one plan, one
// chapter job (SubmitJob, so data_json carries exactly what the
// coordinator was given), an issued grant, and the drained
// dispatch message. Knobs select which persisted plan records
// exist — the fence's resolution inputs.
async function makeWorld({
  planId = "plan:fence-1", jobId = null, planState = "active",
  segments = [{ occurrenceId: "o1", text: TEXT }],
  stamp = true, link = true, planRow = true,
} = {}) {
  const bucket = makeFakeR2Bucket();
  const flushStore = createFlushStore(bucket, { keyPrefix: "" });
  const probe = bridgeProbe(bucket, flushStore);
  const h = makeHarness({ probe });
  const store = createGenStore(h.coord);
  store.ensureSchema();
  const theJobId = jobId ?? `${planId}:ch1`;
  if (planRow) insertPlanRow(h, planId, planState);
  seedContent(h, segments);
  const providers = makeFakeD6Providers();
  const workSource = createD6WorkSource(h.coord, { cache: null });
  const exec = createD6Executor({
    coord: h.coord, store, providers, flushStore, workSource, consumerId: CONSUMER,
  });
  const occs = segments.map((s) => ({
    occurrenceId: s.occurrenceId,
    revisionKey: fingerprintFor(payloadFor(s.text)), estMicroCents: 1000,
  }));
  const sub = await h.coord.handleCommand({
    command_id: `cmd-${theJobId}`, type: "SubmitJob",
    payload: { jobId: theJobId, bookId: BOOK, chapterIndex: 1, lane: "standard",
               occurrences: occs,
               data: { estMicroCents: 1000, ...(stamp ? { d6PlanId: planId } : {}) } },
  });
  assert.equal(sub.outcome, "applied");
  if (link)
    h.db.prepare(`INSERT INTO d6_plan_jobs (plan_id, job_id, chapter_index, seq)
                  VALUES (?, ?, 1, 0)`).run(planId, theJobId);
  const g = await h.coord.requestGrant(theJobId);
  assert.equal(g.ok, true);
  let msg = null;
  await h.coord.drainOutbox((p) => { msg = p; });
  assert.ok(msg && msg.grantId === g.grantId, "grant dispatched");
  return { bucket, flushStore, h, store, providers, exec, msg, g,
           planId, jobId: theJobId };
}

const COMPARED = ["grants", "claims", "transitions", "jobs", "occurrences",
  "d6_plans", "d6_plan_jobs", "d6_execution_records", "spend_intents",
  "d6_attempt_log"];
const snapshot = (h) => JSON.stringify(COMPARED.map((t) => [t, h.rows(t)]));

function assertRefusal(h, providers, before, result, expected) {
  assert.deepEqual(result, expected);
  assert.equal(providers.calls.length, 0, "zero provider calls");
  assert.equal(snapshot(h), before, "zero row movement in every compared table");
}

// Fault injection (the harness SqlFacade pattern, as in the D8
// suite): matching SELECTs throw, everything else passes through.
function sabotageSelects(h, matches) {
  const facade = h.state.storage.sql;
  const orig = facade.exec.bind(facade);
  facade.exec = (q, ...p) => {
    if (typeof q === "string" && /^\s*SELECT/i.test(q) && matches(q))
      throw new Error("injected_fence_read_failure");
    return orig(q, ...p);
  };
  return () => { delete facade.exec; };
}

// ---------------------------------------------------------------
// T1 fixture builder — the production Ch 2 shape, at full size:
// plan halted_unknown; job generating rev 2; grant issued rev 2;
// claim claimed by the production consumer; 18 granted rows;
// 8 failed executions with noted intents; 1 unknown_billing
// execution with an open intent; 9 bare occurrences.
// ---------------------------------------------------------------

async function makeCh2World(planState) {
  const segments = Array.from({ length: 18 }, (_, i) => ({
    occurrenceId: `c${String(i + 1).padStart(2, "0")}`, text: TEXT,
  }));
  const w = await makeWorld({
    planId: "plan:ch2-shape", planState, segments,
  });
  const { h, store, g, jobId, planId } = w;

  // The claim the Oct 29 executor took (same consumer).
  const claim = h.coord.claimGrant({ grantId: g.grantId, consumerId: CONSUMER });
  assert.equal(claim.status, "claimed");

  // Shape proof, before any adjudication rows are added.
  const view = h.coord.jobView(jobId);
  assert.equal(view.state, "generating");
  assert.equal(view.revision, 2);
  assert.equal(view.grants[0].state, "issued");
  assert.equal(view.grants[0].revision, 2);
  assert.equal(view.occurrences.length, 18);
  assert.ok(view.occurrences.every((o) => o.state === "granted"));

  // 8 failed executions, each with a noted spend intent.
  for (const oid of segments.slice(0, 8).map((s) => s.occurrenceId)) {
    const intent = h.coord.acquireSpendIntent(
      { grantId: g.grantId, jobId, occurrenceId: oid, consumerId: CONSUMER });
    assert.equal(intent.acquired, true);
    const { executionId } = store.createExecution(
      { planId, jobId, occurrenceId: oid, grantId: g.grantId });
    store.transitionExecution(executionId, "attempted", {});
    const attemptId = store.reserveAttempt(executionId, { upperMicroCents: 1000 });
    store.markDispatching(attemptId);
    store.confirmAttempt(attemptId, { outcome: "failed_known", costMicroCents: 0 });
    store.failExecution(executionId, "synthesis", { httpStatus: 502 });
    const noted = h.coord.noteSpendOutcome(
      { jobId, occurrenceId: oid, outcome: "failed_known", detail: "HTTP 502" });
    assert.equal(noted.noted, true);
  }

  // 1 unknown_billing execution with an OPEN intent (never noted).
  const oid9 = segments[8].occurrenceId;
  const intent9 = h.coord.acquireSpendIntent(
    { grantId: g.grantId, jobId, occurrenceId: oid9, consumerId: CONSUMER });
  assert.equal(intent9.acquired, true);
  const { executionId: ex9 } = store.createExecution(
    { planId, jobId, occurrenceId: oid9, grantId: g.grantId });
  store.transitionExecution(ex9, "attempted", {});
  const a9 = store.reserveAttempt(ex9, { upperMicroCents: 1000 });
  store.markDispatching(a9);
  store.confirmAttempt(a9, { outcome: "unknown", costMicroCents: null });
  store.markUnknownBilling(ex9, { message: "simulated timeout", occurrenceId: oid9 });

  // Adjudication shape proof: 9 executions (8 failed + 1 unknown),
  // 9 intents (8 noted, 1 open), 9 bare occurrences untouched.
  const execs = h.rows("d6_execution_records");
  assert.equal(execs.length, 9);
  assert.equal(execs.filter((e) => e.state === "failed").length, 8);
  assert.equal(execs.filter((e) => e.state === "unknown_billing").length, 1);
  const intents = h.rows("spend_intents");
  assert.equal(intents.length, 9);
  assert.equal(intents.filter((i) => i.outcome === "failed_known").length, 8);
  assert.equal(intents.filter((i) => i.outcome === null).length, 1);
  return w;
}

// ---------------------------------------------------------------
test("T1 — headline replay: the production Ch 2 shape is refused at the fence, zero calls, zero movement", async () => {
  const w = await makeCh2World("halted_unknown");
  const before = snapshot(w.h);
  const r = await w.exec.handleMessage(w.msg);
  assertRefusal(w.h, w.providers, before, r,
    { refused: "plan_not_dispatchable", planId: w.planId, planState: "halted_unknown" });
});

test("T2 — retired plan: refused, zero calls, zero movement", async () => {
  const w = await makeCh2World("retired");
  const before = snapshot(w.h);
  const r = await w.exec.handleMessage(w.msg);
  assertRefusal(w.h, w.providers, before, r,
    { refused: "plan_not_dispatchable", planId: w.planId, planState: "retired" });
});

test("T3 — complete plan: refused, zero calls, zero movement", async () => {
  const w = await makeCh2World("complete");
  const before = snapshot(w.h);
  const r = await w.exec.handleMessage(w.msg);
  assertRefusal(w.h, w.providers, before, r,
    { refused: "plan_not_dispatchable", planId: w.planId, planState: "complete" });
});

test("T3b — partial plan (the fourth refused state): refused, zero calls, zero movement", async () => {
  const w = await makeCh2World("partial");
  const before = snapshot(w.h);
  const r = await w.exec.handleMessage(w.msg);
  assertRefusal(w.h, w.providers, before, r,
    { refused: "plan_not_dispatchable", planId: w.planId, planState: "partial" });
});

// ---------------------------------------------------------------
test("T4 — legitimate active dispatch (smoke shape): the fence passes and the commit lands", async () => {
  const w = await makeWorld({ planState: "active" });
  const r = await w.exec.handleMessage(w.msg);
  assert.equal(r.occurrences.o1.committed, true);
  assert.equal(w.providers.calls.length, 1, "synthesize called exactly once");
  assert.equal(w.h.rows("bindings").length, 1);
  assert.equal(w.h.rows("d6_execution_records")[0].plan_id, w.planId,
    "bookkeeping adopts the resolved identity");
});

test("T4b — link-only identity: resolution and bookkeeping come from d6_plan_jobs when the job carries no stamp", async () => {
  // planIdFor never reads the link: the pre-fence build stamped
  // execution records with a NULL plan here. The fence's resolved
  // identity must be the link's plan, for the checks AND the
  // post-claim bookkeeping.
  const w = await makeWorld({ planState: "active", stamp: false, link: true });
  const r = await w.exec.handleMessage(w.msg);
  assert.equal(r.occurrences.o1.committed, true);
  assert.equal(w.providers.calls.length, 1);
  assert.equal(w.h.rows("d6_execution_records")[0].plan_id, w.planId);
});

test("T4c — stamp-only identity: resolution comes from the job's data_json stamp when no link row exists", async () => {
  const w = await makeWorld({ planState: "active", stamp: true, link: false });
  const r = await w.exec.handleMessage(w.msg);
  assert.equal(r.occurrences.o1.committed, true);
  assert.equal(w.providers.calls.length, 1);
  assert.equal(w.h.rows("d6_execution_records")[0].plan_id, w.planId);
});

test("T5 — parked plan congruence: every parked_* state dispatches exactly as the pre-fence build", async () => {
  for (const state of ["parked_quota", "parked_cap", "parked_budget", "parked_storage"]) {
    const w = await makeWorld({ planId: `plan:${state}`, planState: state });
    const r = await w.exec.handleMessage(w.msg);
    assert.equal(r.occurrences.o1.committed, true, `${state} dispatches`);
    assert.equal(w.providers.calls.length, 1, `${state}: exactly one provider call`);
    assert.equal(w.h.rows("bindings").length, 1, `${state}: commit lands`);
  }
});

test("T6 — plan-less job: behavior identical to the pre-fence build", async () => {
  const w = await makeWorld({
    planId: "plan:absent", jobId: "legacy-planless-job",
    planRow: false, stamp: false, link: false,
  });
  const r = await w.exec.handleMessage(w.msg);
  assert.equal(r.occurrences.o1.committed, true);
  assert.equal(w.providers.calls.length, 1);
  assert.equal(w.h.rows("d6_plans").length, 0, "the fence created no plan");
  assert.equal(w.h.rows("d6_plan_jobs").length, 0, "the fence created no link");
  assert.equal(w.h.rows("d6_execution_records")[0].plan_id, null,
    "bookkeeping stays plan-less, as before");
});

test("T7 — Ch 3 shape: a parked_policy coordinator job with no plan and no grant dies at claim discipline; the fence neither engages nor is needed", async () => {
  const w = await makeWorld({
    planId: "plan:absent", jobId: "ch3-parked-job",
    planRow: false, stamp: false, link: false,
  });
  // The parked Ch 3 job's durable shape: state parked_policy,
  // and NO grant was ever issued for it.
  w.h.db.prepare(`UPDATE jobs SET state = 'parked_policy' WHERE job_id = ?`)
    .run(w.jobId);
  w.h.db.prepare(`DELETE FROM grants WHERE job_id = ?`).run(w.jobId);
  w.h.db.prepare(`DELETE FROM outbox`).run();
  const before = snapshot(w.h);
  const r = await w.exec.handleMessage(
    { grantId: "grant:never-issued", jobId: w.jobId, occurrences: ["o1"] });
  assert.deepEqual(r, { dropped: "unknown_grant" });
  assert.equal(w.providers.calls.length, 0);
  assert.equal(snapshot(w.h), before, "zero movement — claim discipline, untouched by the fence");
});

// ---------------------------------------------------------------
test("T8 — fault injection at EACH resolution step: a database fault never reads as dispatchable and never as 'no plan'", async () => {
  const w = await makeWorld({ planState: "active" });
  const steps = [
    ["(a) the d6_plan_jobs link read", (q) => q.includes("d6_plan_jobs")],
    ["(b) the jobs-row stamp read", (q) => q.includes("SELECT data_json FROM jobs")],
    ["(c) the d6_plans state read", (q) => q.includes("FROM d6_plans")],
  ];
  for (const [label, matches] of steps) {
    const before = snapshot(w.h);
    const restore = sabotageSelects(w.h, matches);
    let r;
    try { r = await w.exec.handleMessage(w.msg); }
    finally { restore(); }
    assert.deepEqual(r, { refused: "plan_state_check_failed" }, label);
    assert.equal(w.providers.calls.length, 0, `${label}: zero provider calls`);
    assert.equal(snapshot(w.h), before, `${label}: zero movement`);
  }
  // Control: with the faults cleared the SAME world dispatches —
  // each refusal above was the injected fault, not the fixture.
  const r = await w.exec.handleMessage(w.msg);
  assert.equal(r.occurrences.o1.committed, true);
  assert.equal(w.providers.calls.length, 1);
});

// ---------------------------------------------------------------
test("T9 — mislabelled payload: a message-carried planId naming a different, active plan never steers the fence", async () => {
  const w = await makeCh2World("halted_unknown");
  insertPlanRow(w.h, "plan:other-active", "active");
  const before = snapshot(w.h);
  const r = await w.exec.handleMessage({ ...w.msg, planId: "plan:other-active" });
  // The design accepts plan_link_mismatch OR the server-resolved
  // halted state; this implementation refuses the mismatch.
  assertRefusal(w.h, w.providers, before, r, { refused: "plan_link_mismatch" });
});

test("T10 — foreign planId against BOTH fences: one resolution feeds the quarantine read and the state fence", async () => {
  const w = await makeWorld({ planState: "halted_unknown", segments: [
    { occurrenceId: "o1", text: TEXT }, { occurrenceId: "o2", text: TEXT },
  ] });
  // The job's REAL plan is both HELD and halted_unknown; the
  // message will name a third plan that is unheld and active.
  // The only hold in the store is on the real plan — a refusal
  // can therefore only come from the resolved identity.
  recordQuarantineHold(w.h.coord, {
    subjectKind: "plan", subjectId: w.planId,
    reason: "submitted_while_halted", source: "ch2fix-rearm-fence-test",
  });
  insertPlanRow(w.h, "plan:third-unheld", "active");
  const before = snapshot(w.h);
  const r = await w.exec.handleMessage({ ...w.msg, planId: "plan:third-unheld" });
  assertRefusal(w.h, w.providers, before, r, { refused: "plan_quarantined" });
  // And with no message dressing at all, the same hold fires.
  const r2 = await w.exec.handleMessage(w.msg);
  assertRefusal(w.h, w.providers, before, r2, { refused: "plan_quarantined" });
});

// ---------------------------------------------------------------
test("T11 — conflicting persisted links: the d6_plan_jobs link and the job stamp disagree — neither wins, the conflict refuses", async () => {
  const w = await makeWorld({ planId: "plan:link-a", planState: "active" });
  insertPlanRow(w.h, "plan:stamp-b", "active");
  w.h.db.prepare(`UPDATE jobs SET data_json = ? WHERE job_id = ?`)
    .run(JSON.stringify({ estMicroCents: 1000, d6PlanId: "plan:stamp-b" }), w.jobId);
  const before = snapshot(w.h);
  const r = await w.exec.handleMessage(w.msg);
  assertRefusal(w.h, w.providers, before, r, { refused: "plan_link_conflict" });
});

test("T11b — Rowan pin 1: BOTH persisted stamps present and disagreeing refuse (plan_link_conflict)", async () => {
  const w = await makeWorld({
    planId: "plan:stamp-a", planState: "active", link: false,
  });
  insertPlanRow(w.h, "plan:stamp-b", "active");
  w.h.db.prepare(`UPDATE jobs SET data_json = ? WHERE job_id = ?`)
    .run(JSON.stringify({ estMicroCents: 1000,
                          d6PlanId: "plan:stamp-a", planId: "plan:stamp-b" }),
         w.jobId);
  const before = snapshot(w.h);
  const r = await w.exec.handleMessage(w.msg);
  assertRefusal(w.h, w.providers, before, r, { refused: "plan_link_conflict" });
});

test("T11c — Rowan pin 1 (agreement control): both stamps present and AGREEING dispatch normally", async () => {
  const w = await makeWorld({ planId: "plan:agreed", planState: "active" });
  w.h.db.prepare(`UPDATE jobs SET data_json = ? WHERE job_id = ?`)
    .run(JSON.stringify({ estMicroCents: 1000,
                          d6PlanId: "plan:agreed", planId: "plan:agreed" }),
         w.jobId);
  const r = await w.exec.handleMessage(w.msg);
  assert.equal(r.occurrences.o1.committed, true);
  assert.equal(w.providers.calls.length, 1);
});

test("T12 — multiple link rows: two DISTINCT plan_ids for one job preserve plan_link_conflict (Rowan pin 3)", async () => {
  const w = await makeWorld({
    planId: "plan:link-a", planState: "active", stamp: false, link: true,
  });
  insertPlanRow(w.h, "plan:link-b", "active");
  w.h.db.prepare(`INSERT INTO d6_plan_jobs (plan_id, job_id, chapter_index, seq)
                  VALUES ('plan:link-b', ?, 1, 1)`).run(w.jobId);
  const before = snapshot(w.h);
  const r = await w.exec.handleMessage(w.msg);
  // The exact string is the assertion: a generic cardinality
  // throw would have collapsed this into plan_state_check_failed.
  assertRefusal(w.h, w.providers, before, r, { refused: "plan_link_conflict" });
});

test("T13 — missing referenced plan: a dangling link never reads as plan-less", async () => {
  const w = await makeWorld({
    planId: "plan:ghost", planRow: false, stamp: true, link: true,
  });
  const before = snapshot(w.h);
  const r = await w.exec.handleMessage(w.msg);
  assertRefusal(w.h, w.providers, before, r, { refused: "plan_state_check_failed" });
});

test("T14 — unrecognized plan state: a state outside the closed vocabulary fails closed", async () => {
  const w = await makeWorld({ planId: "plan:weird", planState: "some_future_state" });
  const before = snapshot(w.h);
  const r = await w.exec.handleMessage(w.msg);
  assertRefusal(w.h, w.providers, before, r, { refused: "plan_state_check_failed" });
});

test("T15 — malformed job data: unparseable data_json refuses (plan_state_check_failed)", async () => {
  const w = await makeWorld({ planState: "active" });
  w.h.db.prepare(`UPDATE jobs SET data_json = ? WHERE job_id = ?`)
    .run("{not json", w.jobId);
  const before = snapshot(w.h);
  const r = await w.exec.handleMessage(w.msg);
  assertRefusal(w.h, w.providers, before, r, { refused: "plan_state_check_failed" });
});

test("T16a — Rowan F1: BOTH message fields validated — a matching planId cannot mask a conflicting d6PlanId", async () => {
  const w = await makeWorld({ planState: "active" });
  insertPlanRow(w.h, "plan:other-active", "active");
  const before = snapshot(w.h);
  // planId = P_resolved (matching), d6PlanId = P_other
  // (conflicting). The old first-truthy guard checked only
  // planId and DISPATCHED this (the resolved plan is active);
  // per-field validation must refuse it.
  const r = await w.exec.handleMessage(
    { ...w.msg, planId: w.planId, d6PlanId: "plan:other-active" });
  assertRefusal(w.h, w.providers, before, r, { refused: "plan_link_mismatch" });
});

test("T16b — Rowan F1: field order confers nothing — a conflicting planId with a matching d6PlanId also refuses", async () => {
  const w = await makeWorld({ planState: "active" });
  insertPlanRow(w.h, "plan:other-active", "active");
  const before = snapshot(w.h);
  const r = await w.exec.handleMessage(
    { ...w.msg, planId: "plan:other-active", d6PlanId: w.planId });
  assertRefusal(w.h, w.providers, before, r, { refused: "plan_link_mismatch" });
});

test("T16c — Rowan F1 (positive control): both message fields present and BOTH matching the resolved plan dispatch normally", async () => {
  const w = await makeWorld({ planState: "active" });
  const r = await w.exec.handleMessage(
    { ...w.msg, planId: w.planId, d6PlanId: w.planId });
  assert.equal(r.occurrences.o1.committed, true);
  assert.equal(w.providers.calls.length, 1);
  assert.equal(w.h.rows("d6_execution_records")[0].plan_id, w.planId);
});

test("T16d — Rowan F1: malformed present message fields refuse — no fallback is ever selected", async () => {
  const w = await makeWorld({ planState: "active" });
  const variants = [
    ["empty planId beside a matching d6PlanId", { planId: "", d6PlanId: w.planId }],
    ["empty d6PlanId beside a matching planId", { planId: w.planId, d6PlanId: "" }],
    ["non-string planId", { planId: 42 }],
    ["non-string d6PlanId", { d6PlanId: { id: w.planId } }],
    ["null planId beside a matching d6PlanId", { planId: null, d6PlanId: w.planId }],
  ];
  for (const [label, fields] of variants) {
    const before = snapshot(w.h);
    const r = await w.exec.handleMessage({ ...w.msg, ...fields });
    assert.deepEqual(r, { refused: "plan_link_mismatch" }, label);
    assert.equal(w.providers.calls.length, 0, `${label}: zero provider calls`);
    assert.equal(snapshot(w.h), before, `${label}: zero movement`);
  }
  // Control: with no malformed dressing the same world dispatches.
  const r = await w.exec.handleMessage(w.msg);
  assert.equal(r.occurrences.o1.committed, true);
  assert.equal(w.providers.calls.length, 1);
});

// ---------------------------------------------------------------
test("T17a — Rowan F2: an EMPTY persisted stamp is invalid data, not an absent stamp (link-absent, active-grant shape)", async () => {
  const w = await makeWorld({ planState: "active", link: false, stamp: true });
  w.h.db.prepare(`UPDATE jobs SET data_json = ? WHERE job_id = ?`)
    .run(JSON.stringify({ estMicroCents: 1000, d6PlanId: "" }), w.jobId);
  const before = snapshot(w.h);
  // The old stampOf converted "" to null; with no link row the
  // job then read as genuinely plan-less and DISPATCHED.
  const r = await w.exec.handleMessage(w.msg);
  assertRefusal(w.h, w.providers, before, r, { refused: "plan_state_check_failed" });
});

test("T17b — Rowan F2: whitespace-only and empty stamps refuse, in either stamp field", async () => {
  const w = await makeWorld({ planState: "active", link: false, stamp: true });
  const variants = [
    ["whitespace-only d6PlanId", { estMicroCents: 1000, d6PlanId: "   " }],
    ["empty planId stamp", { estMicroCents: 1000, planId: "" }],
    ["whitespace-only planId stamp", { estMicroCents: 1000, planId: " \t " }],
  ];
  for (const [label, data] of variants) {
    w.h.db.prepare(`UPDATE jobs SET data_json = ? WHERE job_id = ?`)
      .run(JSON.stringify(data), w.jobId);
    const before = snapshot(w.h);
    const r = await w.exec.handleMessage(w.msg);
    assert.deepEqual(r, { refused: "plan_state_check_failed" }, label);
    assert.equal(w.providers.calls.length, 0, `${label}: zero provider calls`);
    assert.equal(snapshot(w.h), before, `${label}: zero movement`);
  }
});

test("T17c — Rowan F2 (preservation control): absent and explicit-null stamps keep the legitimate plan-less / link-resolved readings", async () => {
  // (i) Explicit null stamps, no link, no plan row: genuinely
  // plan-less — dispatches exactly as the pre-F2 build.
  const w = await makeWorld({
    planId: "plan:absent", jobId: "legacy-null-stamp-job",
    planRow: false, stamp: false, link: false,
  });
  w.h.db.prepare(`UPDATE jobs SET data_json = ? WHERE job_id = ?`)
    .run(JSON.stringify({ estMicroCents: 1000, d6PlanId: null, planId: null }),
         w.jobId);
  const r = await w.exec.handleMessage(w.msg);
  assert.equal(r.occurrences.o1.committed, true);
  assert.equal(w.providers.calls.length, 1);
  assert.equal(w.h.rows("d6_execution_records")[0].plan_id, null,
    "bookkeeping stays plan-less");

  // (ii) A null stamp beside a valid link: the link resolves
  // and the null does not poison it.
  const w2 = await makeWorld({ planState: "active", stamp: false, link: true });
  w2.h.db.prepare(`UPDATE jobs SET data_json = ? WHERE job_id = ?`)
    .run(JSON.stringify({ estMicroCents: 1000, d6PlanId: null }), w2.jobId);
  const r2 = await w2.exec.handleMessage(w2.msg);
  assert.equal(r2.occurrences.o1.committed, true);
  assert.equal(w2.providers.calls.length, 1);
  assert.equal(w2.h.rows("d6_execution_records")[0].plan_id, w2.planId);
});

test("T17d — Rowan F2: a BLANK d6_plan_jobs.plan_id is a corrupt link, never 'no plan' (schema permits blank strings; NULL is NOT NULL-constrained)", async () => {
  const w = await makeWorld({
    planId: "plan:absent", jobId: "corrupt-link-job",
    planRow: false, stamp: false, link: false,
  });
  for (const blank of ["", "   "]) {
    w.h.db.prepare(`DELETE FROM d6_plan_jobs WHERE job_id = ?`).run(w.jobId);
    w.h.db.prepare(`INSERT INTO d6_plan_jobs (plan_id, job_id, chapter_index, seq)
                    VALUES (?, ?, 1, 0)`).run(blank, w.jobId);
    const before = snapshot(w.h);
    // A plan-less reading would DISPATCH here (live grant,
    // active shape — the T6 world); refusal is the only pass.
    // (The old resolver returned planId "" and the caller's
    // truthiness gate skipped the state fence entirely.)
    const r = await w.exec.handleMessage(w.msg);
    assert.deepEqual(r, { refused: "plan_state_check_failed" },
      `blank link ${JSON.stringify(blank)}`);
    assert.equal(w.providers.calls.length, 0,
      `blank link ${JSON.stringify(blank)}: zero provider calls`);
    assert.equal(snapshot(w.h), before,
      `blank link ${JSON.stringify(blank)}: zero movement`);
  }
  // Control: with the corrupt link row gone the same world is
  // genuinely plan-less and dispatches.
  w.h.db.prepare(`DELETE FROM d6_plan_jobs WHERE job_id = ?`).run(w.jobId);
  const r = await w.exec.handleMessage(w.msg);
  assert.equal(r.occurrences.o1.committed, true);
  assert.equal(w.providers.calls.length, 1);
});

test("T15b — Rowan pin 2: present-but-non-object data_json is corruption, never a plan-less pass", async () => {
  const w = await makeWorld({ planState: "active" });
  for (const bad of [`"a string"`, "42", "null", "[1,2]"]) {
    w.h.db.prepare(`UPDATE jobs SET data_json = ? WHERE job_id = ?`)
      .run(bad, w.jobId);
    const before = snapshot(w.h);
    const r = await w.exec.handleMessage(w.msg);
    // A plan-less reading would DISPATCH here (the world is an
    // active plan with a live grant); refusal is the only pass.
    assert.deepEqual(r, { refused: "plan_state_check_failed" }, `data_json ${bad}`);
    assert.equal(w.providers.calls.length, 0, `data_json ${bad}: zero provider calls`);
    assert.equal(snapshot(w.h), before, `data_json ${bad}: zero movement`);
  }
  // Control: a valid object stamp dispatches.
  w.h.db.prepare(`UPDATE jobs SET data_json = ? WHERE job_id = ?`)
    .run(JSON.stringify({ estMicroCents: 1000, d6PlanId: w.planId }), w.jobId);
  const r = await w.exec.handleMessage(w.msg);
  assert.equal(r.occurrences.o1.committed, true);
  assert.equal(w.providers.calls.length, 1);
});
