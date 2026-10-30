// gen-pkg-1 D7-2 — the BIRTH-MARK + GRANT-QUARANTINE regression
// matrix (Rowan ruling, board issue #15 comment 6524426826,
// req 4; Julie's approval, comment 6524562842).
//
// The design under test (generation/quarantine.mjs +
// grant-guards.mjs + service.mjs + worker-entry-prod-d6.js):
// admission and spend authority are SEPARATE. A plan submitted
// while GENERATION_HALT !== "0" is admitted exactly as C3
// contracts (durable plan + first job, state 'active', zero
// grants) but is BORN QUARANTINED — an immutable server-stamped
// hold written atomically with the plan insert. The hold fences
// every grant path (guard, driver, executor) even after a
// generic re-arm; only the operator-only per-subject release
// clears it. Plan-less jobs that attempt a grant while halted
// (legacy RequestSynthesis / RequestResume shapes) are refused
// at the guard and durably marked; through the real entry they
// are refused at admission (423 generation_halted).
//
// This is a CANDIDATE suite (genpkg1-*): it exercises the new
// behavior only. No baseline suite is modified by this build —
// d6-correction C1–C5 incl. C3 pass UNMODIFIED on this tree
// (C3's own fixture plan is now born quarantined under the
// entry's enforce construction, and C3 asserts nothing about
// post-re-arm grants, so the mark coexists with its contract —
// verified by that suite's green run, and the mark's presence
// under the real entry is asserted directly in test Q8 below).
// Synthetic fixtures only.
import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { makeHarness, makeProbe, occ } from "./helpers/do-harness.mjs";
import { GenerationCoordinator } from "../worker/coordinator.mjs";
import { createGenStore } from "../worker/generation/genstore.mjs";
import { createGenerationService } from "../worker/generation/service.mjs";
import { createD6Executor } from "../worker/generation/d6-executor.mjs";
import { recordQuarantineHold } from "../worker/generation/quarantine.mjs";
import D6Entry, * as d6Module from "../worker/worker-entry-prod-d6.js";

const D6Prod = d6Module.OpalReaderCoordinatorProd;

// ---- service/coordinator-level world -------------------------

let pos = 0;
const entry = (occurrenceId, bookId, chapterIndex) => ({
  occurrenceId, bookId, chapterId: `ch-${chapterIndex}`, chapterIndex,
  position: pos++, povKey: "pov-a", charCount: 1596,
  disposition: "eligible", reason: null, revisionKey: "fp-" + occurrenceId,
});
function makePlanes() {
  pos = 0;
  const mk = (bookId, ids) => ({
    books: [{ bookId, povs: [{ key: "pov-a", name: "Vee", provider: "gemini" }] }],
    digest: "digest-" + bookId,
    builtEntries: ids.map(([id, ch]) => entry(id, bookId, ch)),
  });
  return {
    "book-1": mk("book-1", [["o1", 0], ["o2", 0], ["o3", 1]]),
    "book-2": mk("book-2", [["q1", 0]]),
    "book-3": mk("book-3", [["r1", 0]]),
  };
}
const FLAG_ENV = { d6StandardOnly: true, d6HaltFence: true };
function world(halt) {
  const h = makeHarness({ probe: makeProbe(new Map()),
                          extraEnv: { ...FLAG_ENV, GENERATION_HALT: halt } });
  const planes = makePlanes();
  const sources = {
    eligiblePlane: async (bookId) => planes[bookId],
    buildEligibleSet: (plane) => ({ entries: plane.builtEntries, digest: plane.digest }),
  };
  const svc = createGenerationService({
    coord: h.coord, env: h.env, store: createGenStore(h.coord),
    sources, quarantineMode: "enforce",
  });
  return { h, svc, sources };
}
// A fresh coordinator + service over the SAME store — the
// restart / re-arm shape: new constructions, durable state.
function rearmed({ h, sources }) {
  const env = { ...h.env, GENERATION_HALT: "0" };
  const coord = new GenerationCoordinator(h.state, env);
  const svc = createGenerationService({
    coord, env, store: createGenStore(coord), sources,
    quarantineMode: "enforce",
  });
  return { coord, svc, env };
}
const holds = (h) => {
  try { return h.rows("d6_quarantine_holds"); } catch { return []; }
};
const spendFor = (h, jobId) => ({
  grants: h.rows("grants").filter(g => g.job_id === jobId).length,
  ledger: h.rows("ledger_ops").length,
  outbox: h.rows("outbox").length,
});
const intent = (bookId, commandId) => ({
  commandId, bookId, scope: "book", keepGoing: true,
  phase: "forever-pucked", lane: "standard",
});

test("Q1: a plan born while halted is admitted per C3's contract AND born quarantined", async () => {
  const { h, svc } = world("1");
  const a = await svc.submitIntent(intent("book-1", "i1"));
  assert.equal(a.created, true);
  assert.equal(a.state, "active");
  assert.equal(h.rows("d6_plans").length, 1);
  assert.equal(h.rows("d6_plan_jobs").length, 1);
  assert.equal(h.rows("jobs").length, 1);
  assert.equal(h.rows("grants").length, 0, "zero grants at admission");
  assert.equal(h.rows("outbox").length, 0, "zero outbox at admission");
  assert.equal(h.rows("ledger_ops").length, 0, "zero ledger at admission");
  assert.equal(h.rows("d6_execution_records").length, 0, "zero executions");
  const rows = holds(h);
  assert.equal(rows.length, 1, "exactly one hold");
  assert.equal(rows[0].subject_kind, "plan");
  assert.equal(rows[0].subject_id, a.planId);
  assert.equal(rows[0].state, "held");
  assert.equal(rows[0].reason, "born_while_halted");
  assert.equal(rows[0].source, "submit_intent");
  assert.equal(typeof rows[0].marked_at, "number");
  assert.equal(rows[0].released_at, null);
  // Truthful read surfaces: state stays 'active'; the hold rides
  // BESIDE it as approvalRequired — never as a state, never
  // implying generation.
  const status = svc.planStatus(a.planId);
  assert.equal(status.state, "active");
  assert.equal(status.quarantine.held, true);
  assert.equal(status.quarantine.approvalRequired, true);
  assert.equal(status.quarantine.reason, "born_while_halted");
  const list = svc.listPlans();
  assert.equal(list.plans[0].approvalRequired, true);
});

test("Q2: duplicate submission (incl. a second service instance) converges — one plan, one hold", async () => {
  const { h, svc, sources } = world("1");
  const a = await svc.submitIntent(intent("book-1", "i1"));
  const b = await svc.submitIntent(intent("book-1", "i2"));
  assert.equal(b.created, false);
  assert.equal(b.planId, a.planId);
  // Cross-device shape: a second service over the same store.
  const svc2 = createGenerationService({
    coord: h.coord, env: h.env, store: createGenStore(h.coord),
    sources, quarantineMode: "enforce",
  });
  const c = await svc2.submitIntent(intent("book-1", "i3"));
  assert.equal(c.created, false);
  assert.equal(h.rows("d6_plans").length, 1);
  assert.equal(holds(h).length, 1, "never a second mark");
});

test("Q3: born while HALT === '0' is never marked; a MISSING halt value counts as halted", async () => {
  const open = world("0");
  const a = await open.svc.submitIntent(intent("book-1", "i1"));
  assert.equal(a.created, true);
  assert.equal(holds(open.h).length, 0, "no hold for unhalted birth");
  assert.equal(open.svc.planStatus(a.planId).quarantine.held, false);

  const h = makeHarness({ probe: makeProbe(new Map()), extraEnv: { ...FLAG_ENV } });
  const planes = makePlanes();
  const svc = createGenerationService({
    coord: h.coord, env: h.env, store: createGenStore(h.coord),
    sources: { eligiblePlane: async (b) => planes[b],
               buildEligibleSet: (p) => ({ entries: p.builtEntries, digest: p.digest }) },
    quarantineMode: "enforce",
  });
  const m = await svc.submitIntent(intent("book-1", "i1"));
  assert.equal(holds(h).length, 1, "missing GENERATION_HALT counts as halted");
  assert.equal(holds(h)[0].subject_id, m.planId);
});

test("Q4: after re-arm, EVERY grant path refuses the held plans; unmarked work proceeds", async () => {
  const w = world("1");
  const { h, svc } = w;
  const a = await svc.submitIntent(intent("book-1", "i1"));   // held
  const b = await svc.submitIntent(intent("book-2", "i2"));   // held
  // Unmarked pre-existing work: plan C born under an unhalted
  // construction over the same store, before the halt.
  const openSvc = (() => {
    const env = { ...h.env, GENERATION_HALT: "0" };
    const coord = new GenerationCoordinator(h.state, env);
    return createGenerationService({ coord, env, store: createGenStore(coord),
      sources: w.sources, quarantineMode: "enforce" });
  })();
  const c = await openSvc.submitIntent(intent("book-3", "i3"));
  assert.equal(holds(h).length, 2, "only A and B are held");

  const { coord, svc: svc2 } = rearmed(w);
  const jobA = `${a.planId}:ch0`, jobB = `${b.planId}:ch0`, jobC = `${c.planId}:ch0`;

  // (i) driver: skips A and B, grants C normally.
  const outcomes = await svc2.driveOnce();
  const outA = outcomes.find(o => o.planId === a.planId);
  const outB = outcomes.find(o => o.planId === b.planId);
  assert.equal(outA.quarantined, true);
  assert.equal(outA.approvalRequired, true);
  assert.equal(outB.quarantined, true);
  assert.equal(h.rows("grants").filter(g => g.job_id === jobA).length, 0);
  assert.equal(h.rows("grants").filter(g => g.job_id === jobB).length, 0);
  assert.equal(h.rows("grants").filter(g => g.job_id === jobC).length, 1,
    "pre-existing unmarked work grants normally after re-arm");
  assert.ok(h.sentGrants.some(m => m.jobId === jobC));
  assert.ok(!h.sentGrants.some(m => m.jobId === jobA || m.jobId === jobB),
    "nothing for a held plan ever reaches the queue seam");

  // (ii) direct coordinator grant path.
  const g = await coord.requestGrant(jobA);
  assert.deepEqual({ ok: g.ok, reason: g.reason },
    { ok: false, reason: "plan_quarantined" });

  // (iii) watchdog/alarm pass over the same store.
  await coord.alarm();
  assert.equal(h.rows("grants").filter(g2 => g2.job_id === jobA).length, 0);
  assert.equal(h.rows("grants").filter(g2 => g2.job_id === jobB).length, 0);

  // (iv) executor: a crafted/replayed message for a held job is
  // refused BEFORE claim or provider contact.
  let providerCalls = 0;
  const executor = createD6Executor({
    coord, store: createGenStore(coord),
    providers: { synthesize: async () => { providerCalls++; } },
    flushStore: {},
    workSource: async () => null,
    consumerId: "quarantine-test",
  });
  const res = await executor.handleMessage(
    { grantId: "crafted-grant", jobId: jobA, occurrences: ["o1"] });
  assert.deepEqual(res, { refused: "plan_quarantined" });
  assert.equal(providerCalls, 0, "the executor never reaches a provider for a held job");
  assert.equal(h.rows("d6_execution_records").length, 0);
});

test("Q5: release is per-plan, idempotent, audited — and the ONLY clearance", async () => {
  const w = world("1");
  const { h, svc } = w;
  const a = await svc.submitIntent(intent("book-1", "i1"));
  const b = await svc.submitIntent(intent("book-2", "i2"));
  const { svc: svc2 } = rearmed(w);

  // Refusals: nothing named / both named / unknown / unmarked.
  assert.deepEqual(svc2.releaseQuarantine({}),
    { outcome: "rejected", reason: "subject_required" });
  assert.deepEqual(svc2.releaseQuarantine({ planId: a.planId, jobId: "x" }),
    { outcome: "rejected", reason: "subject_ambiguous" });
  assert.deepEqual(svc2.releaseQuarantine({ planId: "plan:nope" }),
    { outcome: "rejected", reason: "plan_not_found" });
  const c = await svc2.submitIntent(intent("book-3", "i3")); // born unhalted now
  assert.deepEqual(svc2.releaseQuarantine({ planId: c.planId }),
    { outcome: "rejected", reason: "subject_not_quarantined" });

  // A generic re-arm already happened (svc2 is the re-armed
  // construction) and the holds stand — release A explicitly.
  const before = holds(h).find(r => r.subject_id === a.planId);
  const rel = svc2.releaseQuarantine({ planId: a.planId, source: "operator-route" });
  assert.equal(rel.outcome, "applied");
  assert.equal(rel.alreadyReleased, false);
  assert.equal(rel.quarantine.state, "released");
  assert.equal(rel.quarantine.held, false);
  const after = holds(h).find(r => r.subject_id === a.planId);
  assert.equal(after.marked_at, before.marked_at, "birth stamp immutable");
  assert.equal(after.reason, "born_while_halted", "birth reason immutable");
  assert.equal(after.release_source, "operator-route");
  assert.equal(after.release_actor_class, "operator");
  assert.equal(typeof after.released_at, "number");

  // Idempotent second release: applied no-op, same audit stamp.
  const rel2 = svc2.releaseQuarantine({ planId: a.planId, source: "operator-route" });
  assert.equal(rel2.outcome, "applied");
  assert.equal(rel2.alreadyReleased, true);
  assert.equal(holds(h).find(r => r.subject_id === a.planId).released_at,
    after.released_at);

  // A now grants; B remains fenced.
  const outcomes = await svc2.driveOnce();
  assert.equal(outcomes.find(o => o.planId === b.planId).quarantined, true);
  assert.equal(h.rows("grants").filter(g => g.job_id === `${a.planId}:ch0`).length, 1);
  assert.equal(h.rows("grants").filter(g => g.job_id === `${b.planId}:ch0`).length, 0);
  assert.equal(svc2.planStatus(b.planId).quarantine.held, true);
});

test("Q6: plan-less legacy work — halted grant attempts are refused AND durably marked", async () => {
  const w = world("1");
  const { h } = w;
  const coord = h.coord; // halted, flagged construction
  // RequestSynthesis shape: one occurrence, job + immediate
  // grant in one command (the job id is synth:<commandId>).
  const syn = await coord.handleCommand({
    command_id: "s1", type: "RequestSynthesis",
    payload: { occurrenceId: "x1", revisionKey: "fp-x1", bookId: "book-1",
               chapterIndex: 0, estMicroCents: 1000 },
  });
  assert.equal(syn.outcome, "rejected");
  assert.equal(syn.reason, "generation_halted");
  assert.equal(syn.jobId, "synth:s1");
  assert.equal(h.rows("grants").length, 0);
  assert.equal(h.rows("ledger_ops").length, 0);
  assert.equal(h.rows("outbox").length, 0);
  const jobHold = holds(h).find(r => r.subject_kind === "job" && r.subject_id === "synth:s1");
  assert.ok(jobHold, "the staged job is durably marked");
  assert.equal(jobHold.reason, "grant_attempt_while_halted");
  assert.equal(jobHold.source, "grant_guard");

  // Plain SubmitJob staging while halted creates no grant; its
  // first grant ATTEMPT while halted is refused + marked.
  const sub = await coord.handleCommand({
    command_id: "s2", type: "SubmitJob",
    payload: { jobId: "legacy-2", bookId: "book-1", chapterIndex: 0,
               lane: "standard", occurrences: [occ("x2")],
               data: { estMicroCents: 1000 } },
  });
  assert.equal(sub.outcome, "applied");
  const g0 = await coord.requestGrant("legacy-2");
  assert.deepEqual({ ok: g0.ok, reason: g0.reason },
    { ok: false, reason: "generation_halted" });
  assert.ok(holds(h).some(r => r.subject_kind === "job" && r.subject_id === "legacy-2"));

  // After re-arm both jobs stay fenced until individually
  // released; a FRESH post-re-arm synthesis is normal work.
  const { coord: coord2, svc: svc2 } = rearmed(w);
  for (const jobId of ["synth:s1", "legacy-2"]) {
    const g = await coord2.requestGrant(jobId);
    assert.deepEqual({ ok: g.ok, reason: g.reason },
      { ok: false, reason: "job_quarantined" });
  }
  const rel = svc2.releaseQuarantine({ jobId: "synth:s1", source: "operator-route" });
  assert.equal(rel.outcome, "applied");
  const g1 = await coord2.requestGrant("synth:s1");
  assert.equal(g1.ok, true, "a released job grants normally");
  const g2 = await coord2.requestGrant("legacy-2");
  assert.equal(g2.ok, false, "the sibling job's hold is untouched");
  const syn2 = await coord2.handleCommand({
    command_id: "s3", type: "RequestSynthesis",
    payload: { occurrenceId: "x3", revisionKey: "fp-x3", bookId: "book-1",
               chapterIndex: 0, estMicroCents: 1000 },
  });
  assert.equal(syn2.outcome, "applied", "post-re-arm legacy synthesis is normal work");
});

test("Q7: release is NOT a reconcile — halted_unknown is refused; Ch2/Ch3 fixture shapes stay byte-identical", async () => {
  const w = world("1");
  const { h, svc } = w;
  // Ch 2 shape: a halted_unknown plan (no hold — it predates the
  // mechanism), plus an open unknown attempt row.
  const t = h.now();
  h.db.prepare(`INSERT INTO d6_plans (plan_id, intent_key, book_id, scope, keep_going,
                  phase, lane, state, stop_reason, created_at, updated_at)
                VALUES ('plan:ch2shape', 'ik-ch2', 'book-1', 'chapter', 0,
                        'forever-pucked', 'standard', 'halted_unknown',
                        'phase_halted_unknown_billing', ?, ?)`).run(t, t);
  // Ch 3 shape: a parked_policy job.
  h.db.prepare(`INSERT INTO jobs (job_id, kind, book_id, chapter_index, lane, state,
                  revision, data_json, created_at, updated_at)
                VALUES ('ch3shape', 'job', 'book-1', 2, 'standard', 'parked_policy',
                        1, '{}', ?, ?)`).run(t, t);
  const planBefore = h.rows("d6_plans").find(p => p.plan_id === "plan:ch2shape");
  const jobBefore = h.rows("jobs").find(j => j.job_id === "ch3shape");

  const rel = svc.releaseQuarantine({ planId: "plan:ch2shape", source: "operator-route" });
  assert.deepEqual(rel, { outcome: "rejected",
    reason: "release_refused_halted_unknown", state: "halted_unknown" });

  // Even with a hold recorded against it, release stays refused
  // and the hold stays held — billing state is never papered over.
  recordQuarantineHold(h.coord, { subjectKind: "plan", subjectId: "plan:ch2shape",
    reason: "born_while_halted", source: "submit_intent" });
  const rel2 = svc.releaseQuarantine({ planId: "plan:ch2shape", source: "operator-route" });
  assert.equal(rel2.reason, "release_refused_halted_unknown");
  assert.equal(svc.getQuarantine({ planId: "plan:ch2shape" }).held, true);

  // The driver never selects either shape; both rows are
  // byte-identical after driver passes and release attempts.
  const { svc: svc2 } = rearmed(w);
  await svc2.driveOnce();
  assert.deepEqual(h.rows("d6_plans").find(p => p.plan_id === "plan:ch2shape"), planBefore);
  assert.deepEqual(h.rows("jobs").find(j => j.job_id === "ch3shape"), jobBefore);
  assert.equal(h.rows("grants").length, 0);
});

// ---- real-entry world ----------------------------------------

const TOK = "prod-client-token-synthetic";
const OPTOK = "prod-operator-token-synthetic";
const ORIGIN = "https://jedavid33-design.github.io";
const FP_ID = "5c589095-f812-48a2-8ab2-03ba2791f2b2";
const PHASE = "forever-pucked";

class SqlCursor {
  constructor(rows) { this._rows = rows; }
  toArray() { return this._rows; }
  one() {
    if (this._rows.length !== 1)
      throw new Error(`Expected exactly one result, got ${this._rows.length}`);
    return this._rows[0];
  }
  [Symbol.iterator]() { return this._rows[Symbol.iterator](); }
}
class SqlFacade {
  constructor(db) { this.db = db; }
  exec(query, ...params) {
    if (params.length === 0 && query.includes(";")) { this.db.exec(query); return new SqlCursor([]); }
    const stmt = this.db.prepare(query);
    const verb = query.trimStart().slice(0, 6).toUpperCase();
    if (verb.startsWith("SELECT") || verb.startsWith("WITH")) return new SqlCursor(stmt.all(...params));
    const info = stmt.run(...params);
    return new SqlCursor([{ changes: Number(info.changes), lastInsertRowid: Number(info.lastInsertRowid) }]);
  }
}

function entryWorld() {
  const db = new DatabaseSync(":memory:");
  let alarmAt = null;
  const storage = {
    sql: new SqlFacade(db),
    transactionSync(fn) {
      db.exec("BEGIN IMMEDIATE");
      try { const r = fn(); db.exec("COMMIT"); return r; }
      catch (e) { try { db.exec("ROLLBACK"); } catch { /* noop */ } throw e; }
    },
    async setAlarm(ms) { alarmAt = ms; },
    async getAlarm() { return alarmAt; },
    async deleteAlarm() { alarmAt = null; },
  };
  const inst = new D6Prod({ storage }, {
    OPALREADER_V2_SCOPE: "production", OPALREADER_ACCESS_TOKEN: TOK,
    OPALREADER_MIGRATION_OPERATOR_TOKEN: OPTOK,
    GENERATION_HALT: "1", ALLOWED_ORIGIN: ORIGIN,
    OPALREADER_PHASE_POLICY: "enforce",
  });
  const seg = (id) => ({ occurrenceId: id, text: "Synthetic segment text.", pov: "pov-n" });
  const data = {
    chapters: [{ chapterId: "c-0", index: 0, segments: [seg("e0"), seg("e2")] }],
    povs: [{ id: "pov-n", name: "Narrator", voice: { provider: "gemini", voice_id: "Zephyr", model_id: "gemini-3.8-flash-tts" } }],
    defaultVoice: { provider: "gemini", voiceId: "Zephyr" },
  };
  db.prepare(`INSERT INTO sync_entities (family, entity_key, book_id, revision, deleted, data_json)
              VALUES ('content', ?, ?, 1, 0, ?)`).run(FP_ID, FP_ID, JSON.stringify(data));
  const ns = { idFromName: n => n, get: () => ({ fetch: (req) => inst.fetch(req) }) };
  const entryEnv = {
    OPALREADER_V2_SCOPE: "production", OPALREADER_ACCESS_TOKEN: TOK,
    OPALREADER_MIGRATION_OPERATOR_TOKEN: OPTOK,
    GENERATION_HALT: "1", COORDINATOR: ns, ALLOWED_ORIGIN: ORIGIN,
    OPALREADER_PHASE_POLICY: "enforce",
  };
  const call = (path, { method = "GET", body, token = TOK, operator = null } = {}) =>
    D6Entry.fetch(new Request(`https://w.test${path}`, {
      method,
      headers: {
        ...(token === null ? {} : { "x-opalreader-token": token }),
        ...(operator === null ? {} : { "x-opalreader-operator-token": operator }),
        "x-opalreader-scope": "production", "x-opalreader-instance": "account",
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }), entryEnv);
  const submitFP = () => call("/v2/commands", { method: "POST", body: {
    command_id: "q8-int-1", type: "SubmitJob",
    payload: { bookId: FP_ID, lane: "standard",
               data: { d6Intent: { scope: "book", keepGoing: true, phase: PHASE } } },
  }});
  return { db, inst, entryEnv, call, submitFP };
}

test("Q8: real entry — halted intent is admitted + born quarantined; the plan view tells the truth", async () => {
  const w = entryWorld();
  const bind = await w.call("/v2/d6-phase-binding", { method: "POST",
    token: null, operator: OPTOK, body: { phase: PHASE, bookId: FP_ID } });
  assert.equal(bind.status, 200);
  // New-client shape (SubmitJob + data.d6Intent) at HALT=1.
  const res = await w.submitFP();
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.created, true);
  const rows = w.db.prepare(`SELECT * FROM d6_quarantine_holds`).all();
  assert.equal(rows.length, 1, "the entry-born plan is marked");
  assert.equal(rows[0].subject_id, body.planId);
  assert.equal(rows[0].state, "held");
  assert.equal(rows[0].reason, "born_while_halted");
  assert.equal(w.db.prepare(`SELECT COUNT(*) AS n FROM grants`).get().n, 0);
  // Old-client shape (plain reads) still work; the plan view
  // shows state 'active' + the approval-required hold.
  const status = await (await w.call(`/v2/d6-plans/${body.planId}`)).json();
  assert.equal(status.state, "active");
  assert.equal(status.quarantine.held, true);
  assert.equal(status.quarantine.approvalRequired, true);
});

test("Q9: real entry — legacy grant-producing commands are refused at admission while halted; other commands unchanged", async () => {
  const w = entryWorld();
  const syn = await w.call("/v2/commands", { method: "POST", body: {
    command_id: "q9-s1", type: "RequestSynthesis",
    payload: { occurrenceId: "e0", revisionKey: "fp-e0", bookId: FP_ID,
               chapterIndex: 0, estMicroCents: 1000 },
  }});
  assert.equal(syn.status, 423);
  assert.deepEqual(await syn.json(), { error: "generation_halted" });
  const resume = await w.call("/v2/commands", { method: "POST", body: {
    command_id: "q9-s2", type: "RequestResume", payload: { jobId: "synth:q9-s1" },
  }});
  assert.equal(resume.status, 423);
  assert.equal(w.db.prepare(`SELECT COUNT(*) AS n FROM jobs`).get().n, 0,
    "the refused synthesis staged nothing");
  assert.equal(w.db.prepare(`SELECT COUNT(*) AS n FROM grants`).get().n, 0);
  // A plain SubmitJob (stages a queued job; produces no grant)
  // and ordinary commands are NOT refused — behavior unchanged.
  const sub = await w.call("/v2/commands", { method: "POST", body: {
    command_id: "q9-s3", type: "SubmitJob",
    payload: { jobId: "legacy-e2", bookId: FP_ID, chapterIndex: 0, lane: "standard",
               occurrences: [{ occurrenceId: "e0", revisionKey: "fp-e0" }],
               data: { estMicroCents: 1000 } },
  }});
  assert.equal(sub.status, 200);
  assert.equal((await sub.json()).outcome, "applied");
  assert.equal(w.db.prepare(`SELECT COUNT(*) AS n FROM grants`).get().n, 0);
});

test("Q10: real entry — the release route is operator-only, audited, idempotent, read-back verified", async () => {
  const w = entryWorld();
  await w.call("/v2/d6-phase-binding", { method: "POST",
    token: null, operator: OPTOK, body: { phase: PHASE, bookId: FP_ID } });
  const body = await (await w.submitFP()).json();
  const release = (opts) => w.call("/v2/d6-release-quarantine",
    { method: "POST", body: { planId: body.planId }, ...opts });

  const noCred = await release({ token: null });
  assert.equal(noCred.status, 403);
  assert.deepEqual(await noCred.json(), { error: "migration_operator_required" });
  const clientOnly = await release({}); // client token, no operator
  assert.equal(clientOnly.status, 403, "the client token alone cannot release");
  const forged = await release({ token: null, operator: "forged-operator" });
  assert.equal(forged.status, 403);
  assert.equal(w.db.prepare(`SELECT state FROM d6_quarantine_holds`).get().state, "held",
    "no refused attempt moved the hold");

  const ok = await release({ token: null, operator: OPTOK });
  assert.equal(ok.status, 200);
  const okBody = await ok.json();
  assert.equal(okBody.outcome, "applied");
  assert.equal(okBody.alreadyReleased, false);
  assert.equal(okBody.quarantine.state, "released");
  assert.equal(okBody.quarantine.held, false);
  assert.equal(okBody.quarantine.releaseSource, "operator-route",
    "the recorded source is stamped by the server, not the caller");
  assert.equal(okBody.quarantine.releaseActorClass, "operator");
  const row = w.db.prepare(`SELECT * FROM d6_quarantine_holds`).get();
  assert.equal(row.state, "released");
  assert.equal(row.reason, "born_while_halted", "birth record immutable across release");

  const again = await release({ token: null, operator: OPTOK });
  const againBody = await again.json();
  assert.equal(againBody.outcome, "applied");
  assert.equal(againBody.alreadyReleased, true, "duplicate release is a safe no-op");

  const unknown = await w.call("/v2/d6-release-quarantine", { method: "POST",
    token: null, operator: OPTOK, body: { planId: "plan:missing" } });
  assert.equal((await unknown.json()).reason, "plan_not_found");

  // The internal route refuses a direct call without the stamp.
  const direct = await w.inst.fetch(new Request("https://do.internal/internal/d6/release-quarantine", {
    method: "POST",
    headers: { "x-opalreader-internal": "1", "x-opalreader-scope": "production",
               "content-type": "application/json" },
    body: JSON.stringify({ planId: body.planId }),
  }));
  assert.equal(direct.status, 403);
  assert.deepEqual(await direct.json(), { error: "migration_operator_required" });
});
