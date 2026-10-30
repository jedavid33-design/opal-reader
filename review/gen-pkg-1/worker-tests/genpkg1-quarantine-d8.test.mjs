// gen-pkg-1 D8 corrections — adversarial suite (Rowan's review
// of the D7-2 quarantine build, board issue #15 comment
// 6525035570). Two blockers, both proven here against the real
// seams:
//
//   D8-1 — hold reads at every spending/execute fence are
//   STRICT. The D7-2 guard/driver/executor read holds through a
//   catch-all helper that returned null on ANY error, so an
//   arbitrary SELECT failure masqueraded as "no hold" and a held
//   plan could be granted. D8-1a..d force the hold SELECT to
//   fail (fault injection on the harness SQL facade) and assert
//   zero grants / ledger / outbox / provider calls, an unchanged
//   hold row, and clean reason-based refusal once the fault
//   clears. The catch-all read survives ONLY on read-only views,
//   and there only for a genuinely absent table.
//
//   D8-2 — plan-less work staged while halted must never become
//   spendable via a generic re-arm. (a) The real entry AND the
//   coordinator class now refuse plain SubmitJob / RequestRepair
//   at admission while halted (423 generation_halted), joining
//   RequestSynthesis / RequestResume; the D6 intent shape stays
//   admitted + birth-held. (b) Rows staged directly in the store
//   (pre-D8 shape) whose halted grant attempts are refused
//   BEFORE the guard (quota park, daily quota) are fenced after
//   re-arm by the halt-epoch ledger in the grant guard: born in
//   a recorded halt epoch, still queued, never adjudicated →
//   durably marked born_while_halted and refused until the
//   operator releases THAT job. (c) The production-class alarm
//   audit: the real OpalReaderCoordinatorProd stamps the D6
//   guard flags onto its own env, so the base alarm's schedule
//   processing runs the guard — proven with a held plan's
//   'generating'-state probe job (a state combination no real
//   path produces) that the UNGUARDED base alarm would have
//   granted, plus a positive control showing legitimate
//   pre-existing work still grants through that same path.
//
// All synthetic fixtures; no book text anywhere.

import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";

import { GenerationCoordinator } from "../worker/coordinator.mjs";
import { createGenStore } from "../worker/generation/genstore.mjs";
import { createGenerationService } from "../worker/generation/service.mjs";
import { createD6Executor } from "../worker/generation/d6-executor.mjs";
import D6Entry, * as d6Module from "../worker/worker-entry-prod-d6.js";

const D6Prod = d6Module.OpalReaderCoordinatorProd;
const D6EntryFetch = D6Entry.fetch.bind(D6Entry);
import { makeHarness, makeProbe, occ } from "./helpers/do-harness.mjs";
import { makeFakeR2Bucket } from "./helpers/d6-fakes.mjs";

const FLAG_ENV = { d6StandardOnly: true, d6HaltFence: true };

// Service/coordinator world — the same fixture planes as the
// genpkg1-quarantine suite (book-1: o1,o2 ch0 / o3 ch1; book-2:
// q1; book-3: r1).
let pos = 0;
const planeEntry = (occurrenceId, bookId, chapterIndex) => ({
  occurrenceId, bookId, chapterId: `ch-${chapterIndex}`, chapterIndex,
  position: pos++, povKey: "pov-a", charCount: 1596,
  disposition: "eligible", reason: null, revisionKey: "fp-" + occurrenceId,
});
function makePlanes() {
  pos = 0;
  const mk = (bookId, ids) => ({
    books: [{ bookId, povs: [{ key: "pov-a", name: "Vee", provider: "gemini" }] }],
    digest: "digest-" + bookId,
    builtEntries: ids.map(([id, ch]) => planeEntry(id, bookId, ch)),
  });
  return {
    "book-1": mk("book-1", [["o1", 0], ["o2", 0], ["o3", 1]]),
    "book-2": mk("book-2", [["q1", 0]]),
    "book-3": mk("book-3", [["r1", 0]]),
  };
}

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

function rearmed({ h, sources }) {
  const env = { ...h.env, GENERATION_HALT: "0" };
  const coord = new GenerationCoordinator(h.state, env);
  const svc = createGenerationService({
    coord, env, store: createGenStore(coord), sources,
    quarantineMode: "enforce",
  });
  return { coord, svc, env };
}

function intent(bookId, commandId) {
  return { commandId, bookId, scope: "book", keepGoing: true,
           phase: "forever-pucked", lane: "standard" };
}

function holds(h) {
  try { return h.rows("d6_quarantine_holds"); } catch { return []; }
}

// Fault injection (the harness SqlFacade pattern): every SELECT
// against the quarantine table throws, everything else passes
// through. Returns a restore function; the facade's exec is a
// prototype method, so deleting the own property restores it.
function sabotageHoldSelects(h) {
  const facade = h.state.storage.sql;
  const orig = facade.exec.bind(facade);
  facade.exec = (q, ...p) => {
    if (typeof q === "string" && /^\s*SELECT/i.test(q) &&
        q.includes("d6_quarantine_holds"))
      throw new Error("injected_hold_select_failure");
    return orig(q, ...p);
  };
  return () => { delete facade.exec; };
}

// ----------------------------------------------------------------
// D8-1a — guard fault injection, held plan (+ unmarked contrast)
// ----------------------------------------------------------------

test("D8-1a: a failing hold SELECT at the grant guard THROWS — zero spend, hold intact; an unmarked plan is refused the same way", async () => {
  const w = world("1"); const { h, svc } = w;
  const a = await svc.submitIntent(intent("book-1", "i1"));
  assert.equal(a.created, true);
  // Unmarked plan C, born unhalted (separate construction, same store).
  const env0 = { ...h.env, GENERATION_HALT: "0" };
  const coord0 = new GenerationCoordinator(h.state, env0);
  const svc0 = createGenerationService({
    coord: coord0, env: env0, store: createGenStore(coord0),
    sources: w.sources, quarantineMode: "enforce",
  });
  const c = await svc0.submitIntent(intent("book-3", "i3"));
  assert.equal(c.created, true);
  const jobA = `${a.planId}:ch0`, jobC = `${c.planId}:ch0`;

  const restore = sabotageHoldSelects(h);
  try {
    const { coord: coord2 } = rearmed(w);
    await assert.rejects(() => coord2.requestGrant(jobA),
      /injected_hold_select_failure/);
    await assert.rejects(() => coord2.requestGrant(jobC),
      /injected_hold_select_failure/);
  } finally { restore(); }
  assert.equal(h.rows("grants").length, 0, "no grant under a broken hold read");
  assert.equal(h.rows("ledger_ops").length, 0, "no ledger reservation");
  assert.equal(h.rows("outbox").length, 0, "no dispatch row");
  const holdA = holds(h).find(r => r.subject_kind === "plan" && r.subject_id === a.planId);
  assert.equal(holdA.state, "held", "no silent release — the hold row is unchanged");

  // Fault cleared: the held plan refuses by REASON, the unmarked
  // plan grants — the strict read distinguishes them correctly.
  const { coord: coord3 } = rearmed(w);
  const gA = await coord3.requestGrant(jobA);
  assert.deepEqual({ ok: gA.ok, reason: gA.reason },
    { ok: false, reason: "plan_quarantined" });
  const gC = await coord3.requestGrant(jobC);
  assert.equal(gC.ok, true);
});

// ----------------------------------------------------------------
// D8-1b — guard fault injection, held plan-less job
// ----------------------------------------------------------------

test("D8-1b: a failing hold SELECT for a held plan-less job THROWS — zero spend, hold intact", async () => {
  const w = world("1"); const { h } = w;
  const coord = h.coord;
  const sub = await coord.handleCommand({
    command_id: "s1", type: "RequestSynthesis",
    payload: { occurrenceId: "x1", revisionKey: "fp-x1", bookId: "book-1",
               chapterIndex: 0, estMicroCents: 1000 },
  });
  assert.equal(sub.outcome, "rejected");
  assert.equal(sub.reason, "generation_halted");
  const hold = holds(h).find(r => r.subject_kind === "job" && r.subject_id === "synth:s1");
  assert.equal(hold.state, "held");

  const restore = sabotageHoldSelects(h);
  try {
    const { coord: coord2 } = rearmed(w);
    await assert.rejects(() => coord2.requestGrant("synth:s1"),
      /injected_hold_select_failure/);
  } finally { restore(); }
  assert.equal(h.rows("grants").length, 0);
  assert.equal(h.rows("ledger_ops").length, 0);
  assert.equal(h.rows("outbox").length, 0);
  assert.equal(holds(h).find(r =>
    r.subject_kind === "job" && r.subject_id === "synth:s1").state, "held");

  const { coord: coord3 } = rearmed(w);
  const g = await coord3.requestGrant("synth:s1");
  assert.deepEqual({ ok: g.ok, reason: g.reason },
    { ok: false, reason: "job_quarantined" });
});

// ----------------------------------------------------------------
// D8-1c — executor fault injection
// ----------------------------------------------------------------

test("D8-1c: executor refuses a crafted message when the hold read fails — quarantine_check_failed, zero provider contact", async () => {
  const w = world("1"); const { h, svc } = w;
  const a = await svc.submitIntent(intent("book-1", "i1"));
  const jobA = `${a.planId}:ch0`;
  const { coord } = rearmed(w);
  let providerCalls = 0;
  const exec = createD6Executor({
    coord, store: createGenStore(coord),
    providers: { synthesize: async () => { providerCalls++; } },
    flushStore: {}, workSource: async () => null,
    consumerId: "d8-test",
  });
  const restore = sabotageHoldSelects(h);
  try {
    const r = await exec.handleMessage(
      { grantId: "crafted-grant", jobId: jobA, occurrences: ["o1"] });
    assert.deepEqual(r, { refused: "quarantine_check_failed" });
  } finally { restore(); }
  assert.equal(providerCalls, 0);
  try { assert.equal(h.rows("d6_execution_records").length, 0); } catch { /* table absent = no records */ }
  // Fault cleared: the held plan refuses by its real reason.
  const r2 = await exec.handleMessage(
    { grantId: "crafted-grant", jobId: jobA, occurrences: ["o1"] });
  assert.deepEqual(r2, { refused: "plan_quarantined" });
  assert.equal(providerCalls, 0);
});

// ----------------------------------------------------------------
// D8-1d — driver fault injection
// ----------------------------------------------------------------

test("D8-1d: driver treats a failed hold read as held-for-driving (quarantineCheckFailed) and never reaches a grant", async () => {
  const w = world("1"); const { h, svc } = w;
  const a = await svc.submitIntent(intent("book-1", "i1"));
  const restore = sabotageHoldSelects(h);
  let out;
  try { out = await svc.driveOnce(); } finally { restore(); }
  const o = out.find(x => x.planId === a.planId);
  assert.equal(o.quarantined, true);
  assert.equal(o.approvalRequired, true);
  assert.equal(o.quarantineCheckFailed, true,
    "the failure is surfaced, not hidden as a clean skip");
  assert.equal(h.rows("grants").length, 0);
  assert.equal(h.rows("outbox").length, 0);
  // Fault cleared: the same plan skips as an ordinary held plan.
  const out2 = await svc.driveOnce();
  const o2 = out2.find(x => x.planId === a.planId);
  assert.equal(o2.quarantined, true);
  assert.equal(o2.quarantineCheckFailed, undefined);
});

// ----------------------------------------------------------------
// Entry world (same SqlFacade pattern as genpkg1-quarantine, plus
// the fake R2 bucket the production class's alarm requires)
// ----------------------------------------------------------------

class SqlCursor {
  constructor(rows) { this._rows = rows; }
  toArray() { return this._rows; }
  one() {
    if (this._rows.length !== 1)
      throw new Error(`Expected exactly one result, got ${this._rows.length}`);
    return this._rows[0];
  }
}
class SqlFacade {
  constructor(db) { this.db = db; }
  exec(query, ...params) {
    if (params.length === 0 && query.includes(";")) {
      this.db.exec(query);
      return new SqlCursor([]);
    }
    const stmt = this.db.prepare(query);
    const isSelect = /^\s*(SELECT|WITH)/i.test(query);
    if (isSelect) return new SqlCursor(stmt.all(...params));
    const info = stmt.run(...params);
    return new SqlCursor([{ changes: Number(info.changes), last_row_id: Number(info.lastInsertRowid) }]);
  }
}

const TOK = "prod-client-token-synthetic";
const OPTOK = "prod-operator-token-synthetic";
const ORIGIN = "https://jedavid33-design.github.io";
const FP_ID = "5c589095-f812-48a2-8ab2-03ba2791f2b2";
const PHASE = "forever-pucked";

// Mirrors the genpkg1-quarantine suite's entryWorld (scope env,
// token names, storage alarm surface, seeded FP content row),
// plus the fake R2 bucket the class alarm's cache requires.
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
  const classEnv = (halt, extra = {}) => ({
    OPALREADER_V2_SCOPE: "production", OPALREADER_ACCESS_TOKEN: TOK,
    OPALREADER_MIGRATION_OPERATOR_TOKEN: OPTOK,
    GENERATION_HALT: halt, ALLOWED_ORIGIN: ORIGIN,
    OPALREADER_PHASE_POLICY: "enforce",
    OPALREADER_STORAGE: makeFakeR2Bucket(),
    ...extra,
  });
  const inst = new D6Prod({ storage }, classEnv("1"));
  const seg = (id) => ({ occurrenceId: id, text: "Synthetic segment text.", pov: "pov-n" });
  const data = {
    chapters: [{ chapterId: "c-0", index: 0, segments: [seg("e0"), seg("e2")] }],
    povs: [{ id: "pov-n", name: "Narrator", voice: { provider: "gemini", voice_id: "Zephyr", model_id: "gemini-3.8-flash-tts" } }],
    defaultVoice: { provider: "gemini", voiceId: "Zephyr" },
  };
  db.prepare(`INSERT INTO sync_entities (family, entity_key, book_id, revision, deleted, data_json)
              VALUES ('content', ?, ?, 1, 0, ?)`).run(FP_ID, FP_ID, JSON.stringify(data));
  const ns = { idFromName: (n) => n, get: () => ({ fetch: (req) => inst.fetch(req) }) };
  const entryEnv = {
    OPALREADER_V2_SCOPE: "production", OPALREADER_ACCESS_TOKEN: TOK,
    OPALREADER_MIGRATION_OPERATOR_TOKEN: OPTOK,
    GENERATION_HALT: "1", COORDINATOR: ns, ALLOWED_ORIGIN: ORIGIN,
    OPALREADER_PHASE_POLICY: "enforce",
  };
  const call = (path, { method = "GET", body, token = TOK, operator = null } = {}) =>
    D6EntryFetch(new Request(`https://w.test${path}`, {
      method,
      headers: {
        ...(token === null ? {} : { "x-opalreader-token": token }),
        ...(operator === null ? {} : { "x-opalreader-operator-token": operator }),
        "x-opalreader-scope": "production", "x-opalreader-instance": "account",
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }), entryEnv);
  const directCall = async (body) => inst.fetch(new Request("https://do.internal/v2/commands", {
    method: "POST",
    headers: { "x-opalreader-internal": "1", "x-opalreader-scope": "production",
               "content-type": "application/json" },
    body: JSON.stringify(body),
  }));
  const bindPhase = async () => {
    const res = await call("/v2/d6-phase-binding", { method: "POST",
      token: null, operator: OPTOK, body: { phase: PHASE, bookId: FP_ID } });
    assert.equal(res.status, 200);
  };
  let seq = 0;
  const submitFP = async () => {
    const res = await call("/v2/commands", { method: "POST", body: {
      command_id: `d8-int-${++seq}`, type: "SubmitJob",
      payload: { bookId: FP_ID, lane: "standard",
                 data: { d6Intent: { scope: "book", keepGoing: true, phase: PHASE } } },
    }});
    return { res, body: await res.json() };
  };
  return { db, storage, inst, entryEnv, classEnv, call, directCall, bindPhase, submitFP };
}

const LEGACY_JOB = (jobId) => ({
  command_id: `d8-${jobId}`, type: "SubmitJob",
  payload: { jobId, bookId: FP_ID, chapterIndex: 0, lane: "standard",
             occurrences: [{ occurrenceId: "e0", revisionKey: "fp-e0" }],
             data: { estMicroCents: 1000 } },
});
const LEGACY_REPAIR = (jobId) => ({
  command_id: `d8-${jobId}`, type: "RequestRepair",
  payload: { jobId, bookId: FP_ID, chapterIndex: 0, lane: "standard",
             occurrences: [{ occurrenceId: "e0", revisionKey: "fp-e0" }],
             data: { estMicroCents: 1000 } },
});

// ----------------------------------------------------------------
// D8-2a — Rowan (a): admission refusal at HALT=1, then a generic
// re-arm BEFORE any grant attempt: zero spend effects.
// ----------------------------------------------------------------

test("D8-2a: real entry refuses plain SubmitJob + RequestRepair while halted (public AND class level); re-arm spends nothing on the held intent plan", async () => {
  const w = entryWorld();
  await w.bindPhase();

  // Public-entry refusals: the full legacy staging set.
  for (const [mk, jobId] of [[LEGACY_JOB, "legacy-a1"], [LEGACY_REPAIR, "legacy-a2"]]) {
    const res = await w.call("/v2/commands", { method: "POST", body: mk(jobId) });
    assert.equal(res.status, 423, `${jobId} refused at the public entry`);
    assert.deepEqual(await res.json(), { error: "generation_halted" });
  }
  const synth = await w.call("/v2/commands", { method: "POST", body: {
    command_id: "d8-synth", type: "RequestSynthesis",
    payload: { occurrenceId: "e0", revisionKey: "fp-e0", bookId: FP_ID,
               chapterIndex: 0, estMicroCents: 1000 },
  }});
  assert.equal(synth.status, 423);

  // Class-level refusals (the bypass backup): same vocabulary.
  for (const [mk, jobId] of [[LEGACY_JOB, "legacy-a3"], [LEGACY_REPAIR, "legacy-a4"]]) {
    const res = await w.directCall(mk(jobId));
    assert.equal(res.status, 423, `${jobId} refused at the class level`);
    assert.deepEqual(await res.json(), { error: "generation_halted" });
  }
  assert.equal(w.db.prepare(`SELECT COUNT(*) AS n FROM jobs`).get().n, 0,
    "refused staging wrote no job rows");

  // The D6 intent shape is still admitted — and born held (C3's
  // contract, Rowan (c) at the real entry).
  const sub = await w.submitFP();
  assert.equal(sub.res.status, 200);
  assert.equal(sub.body.created, true);
  const planId = sub.body.planId;
  const planJob = w.db.prepare(
    `SELECT job_id FROM d6_plan_jobs WHERE plan_id = ?`).get(planId).job_id;
  const hold = w.db.prepare(
    `SELECT * FROM d6_quarantine_holds WHERE subject_kind = 'plan' AND subject_id = ?`
  ).get(planId);
  assert.equal(hold.state, "held");

  // Generic re-arm BEFORE any grant attempt; then drive every
  // grant surface: the re-armed class alarm and a direct flagged
  // requestGrant. Zero spend effects without an individual release.
  const sends = [];
  const inst2 = new D6Prod({ storage: w.storage }, w.classEnv("0", {
    OPALREADER_GENERATION_V2: { send: async (m) => { sends.push(m); } },
  }));
  await inst2.alarm();
  const coord2 = new GenerationCoordinator({ storage: w.storage }, {
    ...FLAG_ENV, GENERATION_HALT: "0",
  });
  const g = await coord2.requestGrant(planJob);
  assert.deepEqual({ ok: g.ok, reason: g.reason },
    { ok: false, reason: "plan_quarantined" });
  assert.equal(w.db.prepare(`SELECT COUNT(*) AS n FROM grants`).get().n, 0);
  assert.equal(w.db.prepare(`SELECT COUNT(*) AS n FROM ledger_ops`).get().n, 0);
  assert.equal(w.db.prepare(`SELECT COUNT(*) AS n FROM outbox`).get().n, 0);
  assert.equal(sends.length, 0, "no dispatch left the worker");
});

// ----------------------------------------------------------------
// D8-2b — Rowan (b): pre-guard refusals (park, daily quota) mean
// the guard never marked the jobs; the halt-epoch fence still
// makes a post-re-arm grant impossible.
// ----------------------------------------------------------------

test("D8-2b: jobs whose halted attempts died before the guard (park, quota) are epoch-fenced after re-arm; pre-halt work is not", async () => {
  const w = world("0"); const { h, svc } = w;
  await svc.driveOnce();   // notes an UNHALTED observation (epoch baseline)
  const pre = await h.coord.handleCommand({
    command_id: "b0", type: "SubmitJob",
    payload: { jobId: "pre-halt-job", bookId: "book-1", chapterIndex: 0,
               lane: "standard", occurrences: [occ("x0")],
               data: { estMicroCents: 1000 } },
  });
  assert.equal(pre.outcome, "applied");
  h.advance(60_000);

  // Halted constructions over the same store; the driver notes
  // the halt (epoch opens: births after the last unhalted
  // observation are suspect until the last halted one).
  const envH = { ...h.env, GENERATION_HALT: "1" };
  const coordH = new GenerationCoordinator(h.state, envH);
  const svcH = createGenerationService({
    coord: coordH, env: envH, store: createGenStore(coordH),
    sources: w.sources, quarantineMode: "enforce",
  });
  await svcH.driveOnce();

  // job-b1: staged directly in the store (the pre-D8 shape) while
  // halted; its grant attempt dies at the QUOTA PARK — before the
  // guard — so no mark exists. The premise is asserted, not assumed.
  h.db.prepare(`INSERT INTO quota_parks (parked_at, evidence_json) VALUES (?, '{}')`)
    .run(h.now());
  const sub1 = await coordH.handleCommand({
    command_id: "b1", type: "SubmitJob",
    payload: { jobId: "job-b1", bookId: "book-1", chapterIndex: 0,
               lane: "standard", occurrences: [occ("x1")],
               data: { estMicroCents: 1000 } },
  });
  assert.equal(sub1.outcome, "applied");
  const gPark = await coordH.requestGrant("job-b1");
  assert.deepEqual({ ok: gPark.ok, reason: gPark.reason },
    { ok: false, reason: "quota_parked" });
  assert.equal(holds(h).filter(r => r.subject_id === "job-b1").length, 0,
    "the park refused BEFORE the guard — no durable mark (the D8-2 premise)");

  // job-b2: same staging; its attempt dies at the DAILY QUOTA.
  h.db.prepare(`UPDATE quota_parks SET released_at = ?`).run(h.now());
  const { dayKey, monthKey } = coordH.quotaView();
  const fill = h.db.prepare(
    `INSERT INTO ledger_ops (op_key, at, day_key, month_key, kind, est_micro_cents, detail_json)
     VALUES (?, ?, ?, ?, 'attempt', 0, '{}')`);
  for (let i = 0; i < 100; i++) fill.run(`fill-${i}`, h.now(), dayKey, monthKey);
  const sub2 = await coordH.handleCommand({
    command_id: "b2", type: "SubmitJob",
    payload: { jobId: "job-b2", bookId: "book-1", chapterIndex: 0,
               lane: "standard", occurrences: [occ("x2")],
               data: { estMicroCents: 1000 } },
  });
  assert.equal(sub2.outcome, "applied");
  const gQuota = await coordH.requestGrant("job-b2");
  assert.deepEqual({ ok: gQuota.ok, reason: gQuota.reason },
    { ok: false, reason: "quota_estimate_exhausted" });
  assert.equal(holds(h).filter(r => r.subject_id === "job-b2").length, 0,
    "the quota refused BEFORE the guard — no durable mark either");

  // Re-arm AND reset the limits: both jobs are STILL unspendable.
  h.db.prepare(`DELETE FROM ledger_ops WHERE op_key LIKE 'fill-%'`).run();
  h.advance(60_000);
  const { coord: coord2, svc: svc2 } = rearmed(w);
  for (const jobId of ["job-b1", "job-b2"]) {
    const g = await coord2.requestGrant(jobId);
    assert.deepEqual({ ok: g.ok, reason: g.reason },
      { ok: false, reason: "job_quarantined" }, `${jobId} epoch-fenced`);
    const row = holds(h).find(r =>
      r.subject_kind === "job" && r.subject_id === jobId);
    assert.ok(row, `${jobId} now carries a durable mark`);
    assert.equal(row.state, "held");
    assert.equal(row.reason, "born_while_halted");
    assert.equal(row.source, "halt_epoch");
  }
  assert.equal(h.rows("grants").length, 0);
  assert.equal(h.rows("ledger_ops").length, 0);
  assert.equal(h.rows("outbox").length, 0);

  // Work born BEFORE the halt is not fenced.
  const gPre = await coord2.requestGrant("pre-halt-job");
  assert.equal(gPre.ok, true, "pre-halt staged work stays spendable");

  // Operator release clears job-b1 ONLY (Rowan (e), job level).
  const rel = svc2.releaseQuarantine({ jobId: "job-b1", source: "operator-route" });
  assert.equal(rel.outcome, "applied");
  assert.equal((await coord2.requestGrant("job-b1")).ok, true);
  const gB2 = await coord2.requestGrant("job-b2");
  assert.deepEqual({ ok: gB2.ok, reason: gB2.reason },
    { ok: false, reason: "job_quarantined" });
});

// ----------------------------------------------------------------
// D8-2c — the production-class alarm audit (Rowan's path audit).
// The REAL class, the REAL super.alarm(): no hand-flagged
// coordinator anywhere in this test's alarm path.
// ----------------------------------------------------------------

test("D8-2c: production-class alarm audit — the base alarm cannot grant staged or held work; the guard sees every base grant path", async () => {
  const w = entryWorld();
  // The fence placement, stated as evidence: the class's own env
  // carries both D6 flags (constructor-stamped); the base
  // constructor's coordinator deliberately keeps the plain env
  // (the baseline-pinned handle no production grant path uses).
  assert.equal(w.inst.env.d6StandardOnly, true);
  assert.equal(w.inst.env.d6HaltFence, true);
  assert.equal(w.inst.coordinator.env.d6StandardOnly, undefined);
  assert.equal(w.inst.coordinator.env.d6HaltFence, undefined);

  await w.bindPhase();
  const sub = await w.submitFP();
  assert.equal(sub.body.created, true);
  const planId = sub.body.planId;
  const planJob = w.db.prepare(
    `SELECT job_id FROM d6_plan_jobs WHERE plan_id = ?`).get(planId).job_id;
  const now = Date.now();

  // Directly staged plan-less work + the schedule preconditions
  // the base watchdog would need to touch any of it.
  w.db.prepare(
    `INSERT INTO jobs (job_id, kind, book_id, chapter_index, lane, state, revision, data_json, created_at, updated_at)
     VALUES ('staged-s', 'job', ?, 0, 'standard', 'queued', 1, '{"estMicroCents":1000}', ?, ?)`)
    .run(FP_ID, now, now);
  w.db.prepare(
    `INSERT INTO occurrences (job_id, occurrence_id, revision_key, state)
     VALUES ('staged-s', 's-occ', 'fp-s-occ', 'pending')`).run();
  const sched = w.db.prepare(
    `INSERT INTO schedule (due_at, kind, ref, payload_json, attempts, state)
     VALUES (1, ?, ?, '{}', 0, 'pending')`);
  sched.run("retry_grant", "staged-s");
  sched.run("retry_grant", planJob);
  sched.run("watchdog", null);

  const counts = () => ({
    grants: w.db.prepare(`SELECT COUNT(*) AS n FROM grants`).get().n,
    ledger: w.db.prepare(`SELECT COUNT(*) AS n FROM ledger_ops`).get().n,
    outbox: w.db.prepare(`SELECT COUNT(*) AS n FROM outbox`).get().n,
  });
  assert.deepEqual(counts(), { grants: 0, ledger: 0, outbox: 0 });

  // Halted real-class alarm: queued subjects are state-inert for
  // the base machinery; the held plan's driver is quarantine-skipped.
  await w.inst.alarm();
  assert.deepEqual(counts(), { grants: 0, ledger: 0, outbox: 0 },
    "halted class alarm moved nothing");
  assert.equal(w.db.prepare(
    `SELECT state FROM jobs WHERE job_id = 'staged-s'`).get().state, "queued");

  // The decisive probe: a plan-linked job in 'generating' state
  // with a due retry_grant row — the ONE state combination the
  // base watchdog WOULD grant (its guard check is state-based).
  // No real path produces it (a held plan's jobs are never
  // granted, hence never 'generating'); if the base alarm ran
  // unguarded, this alarm would issue a grant + ledger + outbox
  // for the held plan. With the class env fenced, the guard
  // refuses it inside super.alarm().
  w.db.prepare(
    `INSERT INTO jobs (job_id, kind, book_id, chapter_index, lane, state, revision, data_json, created_at, updated_at)
     VALUES ('probe-g', 'job', ?, 0, 'standard', 'generating', 1, '{}', ?, ?)`)
    .run(FP_ID, now, now);
  w.db.prepare(
    `INSERT INTO occurrences (job_id, occurrence_id, revision_key, state)
     VALUES ('probe-g', 'g-occ', 'fp-g-occ', 'pending')`).run();
  w.db.prepare(
    `INSERT INTO d6_plan_jobs (plan_id, seq, job_id, chapter_index) VALUES (?, 99, 'probe-g', 0)`)
    .run(planId);
  sched.run("retry_grant", "probe-g");
  await w.inst.alarm();
  assert.deepEqual(counts(), { grants: 0, ledger: 0, outbox: 0 },
    "the guarded base alarm refused the held plan's probe job");

  // Re-armed class alarm: the probe stays refused; nothing drains.
  const sends = [];
  const inst2 = new D6Prod({ storage: w.storage }, w.classEnv("0", {
    OPALREADER_GENERATION_V2: { send: async (m) => { sends.push(m); } },
  }));
  sched.run("retry_grant", "probe-g");
  sched.run("retry_grant", "staged-s");
  sched.run("watchdog", null);
  await inst2.alarm();
  assert.deepEqual(counts(), { grants: 0, ledger: 0, outbox: 0 },
    "re-armed class alarm still spends nothing on held/staged work");
  assert.equal(sends.length, 0);

  // Positive control: legitimate pre-existing work — a plan-less
  // 'generating' job born long before the halt — still gets its
  // grant through the SAME base-alarm path, now THROUGH the guard
  // (proving the path is guarded, not broken).
  w.db.prepare(
    `INSERT INTO jobs (job_id, kind, book_id, chapter_index, lane, state, revision, data_json, created_at, updated_at)
     VALUES ('legacy-h', 'job', ?, 0, 'standard', 'generating', 1, '{}', 1, 1)`)
    .run(FP_ID);
  w.db.prepare(
    `INSERT INTO occurrences (job_id, occurrence_id, revision_key, state)
     VALUES ('legacy-h', 'h-occ', 'fp-h-occ', 'pending')`).run();
  sched.run("retry_grant", "legacy-h");
  await inst2.alarm();
  const hGrants = w.db.prepare(
    `SELECT COUNT(*) AS n FROM grants WHERE job_id = 'legacy-h'`).get().n;
  assert.equal(hGrants, 1, "the legitimate job granted through the guarded base path");
  assert.equal(counts().grants, 1, "and it is the ONLY grant in the store");
  assert.equal(sends.length, 1, "its dispatch drained via the D6 queue wiring");
  assert.equal(sends[0].jobId, "legacy-h");
});
