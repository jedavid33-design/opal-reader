// gen-pkg-1 round-3 corrections — R3-1 (Rowan round-3 source
// review, comment 6512804398).
//
// R3-1: the round-2 phase registry had two production holes.
// (a) While the registry was EMPTY, admission applied the
// permissive legacy history rules — and that state is reachable
// through the public production /v2/commands route, so a
// deployment of the round-2 build would serve a window in
// which a budgeted phase could be claimed by first use.
// (b) bindPhaseBook existed only on the service: the pinned
// production entry had NO route to it, so the planned deploy
// sequence (record the Forever Pucked binding after the worker
// deploy, before client publication) was not operable as
// written — and the window in (a) would have been open exactly
// while it was performed.
//
// The round-3 corrections, proven here:
//   * ENFORCEMENT IS A CONSTRUCTION PROPERTY. The production
//     entry (worker-entry-prod-d6.js d6Service) derives
//     phasePolicyMode "enforce" from the deployment
//     configuration (OPALREADER_PHASE_POLICY, set to "enforce"
//     by the pinned deploy spec). In an enforcement-bound
//     construction the registry rules govern from the first
//     served request — registry empty included: a budgeted-
//     phase claim with no recorded binding fails CLOSED
//     (phase_unbound), a binding naming another book rejects,
//     the bound book without its phase rejects, an invented
//     phase rejects. Direct construction (every fixture) keeps
//     the default "legacy" mode — the trusted boundary is the
//     server's own construction/configuration, and no request
//     or intent field can select it (submitIntent destructures
//     its known inputs only).
//   * THE RECORDING PATH IS OPERABLE AND FENCED. POST
//     /v2/d6-phase-binding sits in the diagnostics/Option-D
//     fence class: the production gate skips the client token
//     for it (admission is on the migration-operator credential
//     ALONE), the entry's operator admission block requires that
//     credential, and the internal route requires the entry's
//     operator-admitted stamp. The route stamps the recorded
//     source itself and answers with the READ-BACK binding from
//     the store — success, idempotent re-record, and conflict
//     refusal alike. No client route reaches it.
//   * The FP book id below is the production Forever Pucked
//     book id — the pair the deploy gate records — used here
//     purely as a fixture identifier over synthetic content.
//     NOTHING in this suite (or this build) records anything in
//     production.
//
// ROUND-5 AMENDMENT (R4-2; Rowan round-5 ruling, comment
// 6514899384, items 1–2; Julie's approval, comment 6522602149):
// this candidate suite's round-3 premises are superseded in
// exactly three places, each amended in place below and marked
// R5: (1) under enforcement with an EMPTY registry, every
// intent — budgeted, invented, or null-phase — is now refused
// by the service's bootstrap gate as phase_binding_required
// (round 3 expected phase_unbound / phase_not_budgeted for the
// named claims and still admitted null-phase work in that
// window; that null-phase admission was the hole Rowan's
// item 2 closes); (2) the unbudgeted-admission behavior is now
// asserted AFTER the binding is recorded, where the registry
// rules still admit genuinely unbudgeted work; (3) the
// round-3 contrast test ("without the enforce setting the
// entry keeps the legacy bootstrap") is REPLACED by two tests
// proving the new law: a missing flag and a mistyped flag each
// make the real entry's intent route return an explicit 503
// phase_policy_not_configured for the whole submission matrix,
// with zero state movement — the production entry constructs
// enforcement unconditionally and never falls back to legacy.
// Test count: 11 (round 3/4) → 12 (the contrast split in two);
// no assertion was deleted or lowered — each replaced premise
// is asserted in its stronger round-5 form.
import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { createGenStore } from "../worker/generation/genstore.mjs";
import { createGenerationService } from "../worker/generation/service.mjs";
import { createCoordinatorPlaneSource } from "../worker/generation/content-plane-adapter.mjs";
import { makeHarness } from "./helpers/do-harness.mjs";
import D6Entry, * as d6Module from "../worker/worker-entry-prod-d6.js";

const D6Prod = d6Module.OpalReaderCoordinatorProd;
const FP_ID = "5c589095-f812-48a2-8ab2-03ba2791f2b2";
const OTHER = "book-other-mini";
const PHASE = "forever-pucked";
const TOK = "prod-client-token-synthetic";
const OPTOK = "prod-operator-token-synthetic";
const ORIGIN = "https://jedavid33-design.github.io";
const T = (id) => `Synthetic prose for segment ${id}, invented for the phase-enforce harness only.`;

function bookData() {
  const seg = (occurrenceId, text) => ({ occurrenceId, text, pov: "pov-a" });
  return {
    chapters: [
      { chapterId: "ch-1", index: 1, segments: [seg("e0", T("e0")), seg("e2", T("e2"))] },
    ],
    povs: [{ id: "pov-a", name: "Aria", voice: { voice_id: "Zephyr", provider: "gemini", model_id: "gemini-3.8-flash-tts", style_direction: "warm" } }],
    defaultVoice: { provider: "gemini", voice_id: "Zephyr" },
  };
}

async function makeWorld(mode) {
  const h = makeHarness({});
  const store = createGenStore(h.coord);
  store.ensureSchema();
  for (const bookId of [FP_ID, OTHER]) {
    h.db.prepare(`INSERT INTO sync_entities (family, entity_key, book_id, revision, deleted, data_json)
                  VALUES ('content', ?, ?, 1, 0, ?)`).run(bookId, bookId, JSON.stringify(bookData()));
  }
  const sources = createCoordinatorPlaneSource(h.coord);
  const service = createGenerationService({
    coord: h.coord, env: h.env, store, sources, phasePolicyMode: mode,
  });
  return { h, store, service };
}

function ledgerCounts(h) {
  return {
    plans: h.rows("d6_plans").length,
    ledger: h.rows("ledger_ops").length,
    attempts: h.rows("d6_attempt_log").length,
    grants: h.rows("grants").length,
  };
}

// ---- Service level: the enforce construction ----------------

test("R3-1+R5: enforce construction, registry ABSENT — the bootstrap gate refuses EVERY intent (phase_binding_required), nothing moves", async () => {
  const w = await makeWorld("enforce");
  const before = ledgerCounts(w.h);
  // R5: round 3 expected phase_unbound for the two named claims
  // and phase_not_budgeted for the invented one; the round-5
  // bootstrap gate (Rowan ruling 6514899384 item 2) refuses the
  // whole matrix with one reason while the registry is empty.
  const fpClaim = await w.service.submitIntent({
    commandId: "e-1", bookId: FP_ID, scope: "book", keepGoing: true,
    phase: PHASE, lane: "standard",
  });
  assert.deepEqual(fpClaim, { outcome: "rejected", reason: "phase_binding_required" },
    "the production book itself cannot first-use its phase under enforcement");
  const otherClaim = await w.service.submitIntent({
    commandId: "e-2", bookId: OTHER, scope: "book", keepGoing: true,
    phase: PHASE, lane: "standard",
  });
  assert.deepEqual(otherClaim, { outcome: "rejected", reason: "phase_binding_required" });
  const invented = await w.service.submitIntent({
    commandId: "e-3", bookId: OTHER, scope: "book", keepGoing: true,
    phase: "phase-invented", lane: "standard",
  });
  assert.deepEqual(invented, { outcome: "rejected", reason: "phase_binding_required" });
  const nullPhase = await w.service.submitIntent({
    commandId: "e-3b", bookId: FP_ID, scope: "book", keepGoing: true,
    phase: null, lane: "standard",
  });
  assert.deepEqual(nullPhase, { outcome: "rejected", reason: "phase_binding_required" },
    "R5: even the budgeted book's own NULL-phase intent is refused while its binding is absent — no unbudgeted plan can slip into the deployment window");
  assert.deepEqual(ledgerCounts(w.h), before,
    "fail-closed rejections move no plan, ledger, attempt, or grant state");
  assert.equal(w.h.rows("d6_phase_bindings").length, 0,
    "no submission wrote a binding — first-use binding does not exist under enforcement");
});

test("R3-1+R5: enforce construction — null-phase work is refused while the registry is empty, and admitted once the binding is recorded", async () => {
  const w = await makeWorld("enforce");
  // R5: the round-3 form of this test asserted null-phase
  // admission with the registry still empty; that admission is
  // precisely the deployment-window hole the bootstrap gate
  // closes, so the premise is asserted in its round-5 form.
  const early = await w.service.submitIntent({
    commandId: "e-4a", bookId: OTHER, scope: "book", keepGoing: true,
    phase: null, lane: "standard",
  });
  assert.deepEqual(early, { outcome: "rejected", reason: "phase_binding_required" });
  assert.equal(w.h.rows("d6_plans").length, 0, "the gated refusal created nothing");
  // The operator-side writer is NOT gated: recording works
  // while admission is closed.
  const bound = w.service.bindPhaseBook({ phase: PHASE, bookId: FP_ID, source: "enforce-test" });
  assert.equal(bound.outcome, "applied");
  // After the registry is established, genuinely unbudgeted
  // work flows again (Rowan ruling item 2: the gate is narrow).
  const r = await w.service.submitIntent({
    commandId: "e-4", bookId: OTHER, scope: "book", keepGoing: true,
    phase: null, lane: "standard",
  });
  assert.equal(r.created, true, "genuinely unbudgeted work is not blocked once the binding is recorded");
  const row = w.h.rows("d6_plans").find(p => p.plan_id === r.planId);
  assert.equal(row.phase, null);
  // And the budgeted book is held to its phase from here on.
  const fpNull = await w.service.submitIntent({
    commandId: "e-4b", bookId: FP_ID, scope: "segment", occurrenceId: "e0",
    phase: null, lane: "standard",
  });
  assert.deepEqual(fpNull, { outcome: "rejected", reason: "phase_required" });
  const fpOk = await w.service.submitIntent({
    commandId: "e-4c", bookId: FP_ID, scope: "book", keepGoing: true,
    phase: PHASE, lane: "standard",
  });
  assert.equal(fpOk.created, true, "the bound book with its correct phase is admitted");
  const forged = await w.service.submitIntent({
    commandId: "e-4d", bookId: OTHER, scope: "segment", occurrenceId: "e0",
    phase: PHASE, lane: "standard",
  });
  assert.deepEqual(forged, { outcome: "rejected", reason: "phase_bound_to_other_book" },
    "another book cannot steal the bound book's budget");
});

test("R3-1: legacy construction, registry ABSENT — the same claim is admitted (the boundary is construction, not the request)", async () => {
  const w = await makeWorld("legacy");
  const claim = await w.service.submitIntent({
    commandId: "e-5", bookId: FP_ID, scope: "book", keepGoing: true,
    phase: PHASE, lane: "standard",
  });
  assert.equal(claim.created, true,
    "direct/fixture construction keeps the round-1/2 legacy rules — this is what preserves the baseline suites");
});

test("R3-1: enforce capabilities never derives the phase's book from plan history — registry row or null", async () => {
  const w = await makeWorld("enforce");
  // A plan carrying the phase exists in the store (the carried
  // production shape: plans admitted under the legacy rules
  // before the registry existed).
  const legacy = await makeWorld("legacy");
  const admitted = await legacy.service.submitIntent({
    commandId: "e-6", bookId: FP_ID, scope: "book", keepGoing: true,
    phase: PHASE, lane: "standard",
  });
  assert.equal(admitted.created, true);
  const legacyCaps = legacy.service.capabilities();
  assert.equal(legacyCaps.phases.find(p => p.phase === PHASE).bookId, FP_ID,
    "legacy construction reports the history-derived link, as in round 1/2");
  // The SAME store read through an enforcement-bound service
  // reports no link until the registry says so.
  const enforceView = createGenerationService({
    coord: legacy.h.coord, env: legacy.h.env, store: legacy.store,
    sources: createCoordinatorPlaneSource(legacy.h.coord),
    phasePolicyMode: "enforce",
  });
  assert.equal(enforceView.capabilities().phases.find(p => p.phase === PHASE).bookId, null,
    "enforcement never presents plan history as the phase's book");
  enforceView.bindPhaseBook({ phase: PHASE, bookId: FP_ID, source: "enforce-test" });
  assert.equal(enforceView.capabilities().phases.find(p => p.phase === PHASE).bookId, FP_ID,
    "after recording, the link is the registry row");
  void w;
});

// ---- Entry level: the REAL deployed entry --------------------

class SqlCursor {
  constructor(rows) { this._rows = rows; }
  one() {
    if (this._rows.length !== 1)
      throw new Error(`Expected exactly one result row from SQL query, got ${this._rows.length}`);
    return this._rows[0];
  }
  toArray() { return [...this._rows]; }
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

// enforce: the deployment configuration the pinned spec ships
// (OPALREADER_PHASE_POLICY=enforce in BOTH the entry env and the
// class env — production is one Worker env; the class's intent
// route reads its own env). R5: the flag no longer SELECTS the
// construction (d6Service is unconditional-enforce); it is a
// required deployment binding whose absence or corruption makes
// the intent route fail with an explicit 503. Pass
// enforce:"typo" for a mistyped-flag world, enforce:false for a
// missing-flag world.
function entryWorld({ enforce = true, operator = true } = {}) {
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
  const policy = enforce === true ? { OPALREADER_PHASE_POLICY: "enforce" }
    : enforce === "typo" ? { OPALREADER_PHASE_POLICY: "enfore" } : {};
  const opEnv = operator ? { OPALREADER_MIGRATION_OPERATOR_TOKEN: OPTOK } : {};
  const inst = new D6Prod({ storage }, {
    OPALREADER_V2_SCOPE: "production", OPALREADER_ACCESS_TOKEN: TOK,
    GENERATION_HALT: "1", ALLOWED_ORIGIN: ORIGIN, ...policy, ...opEnv,
  });
  const seg = (id) => ({ occurrenceId: id, text: "Synthetic segment text.", pov: "pov-n" });
  const seedContent = (bookId) => {
    const data = {
      chapters: [{ chapterId: "c-0", index: 0, segments: [seg("e0"), seg("e2")] }],
      povs: [{ id: "pov-n", name: "Narrator", voice: { provider: "gemini", voice_id: "Zephyr", model_id: "gemini-3.8-flash-tts" } }],
      defaultVoice: { provider: "gemini", voiceId: "Zephyr" },
    };
    db.prepare(`INSERT INTO sync_entities (family, entity_key, book_id, revision, deleted, data_json)
                VALUES ('content', ?, ?, 1, 0, ?)`).run(bookId, bookId, JSON.stringify(data));
  };
  seedContent(FP_ID);
  seedContent(OTHER);
  const ns = { idFromName: n => n, get: () => ({ fetch: (req) => inst.fetch(req) }) };
  const entryEnv = {
    OPALREADER_V2_SCOPE: "production", OPALREADER_ACCESS_TOKEN: TOK,
    GENERATION_HALT: "1", COORDINATOR: ns, ALLOWED_ORIGIN: ORIGIN,
    ...policy, ...opEnv,
  };
  const submit = (commandId, bookId, d6Intent) =>
    D6Entry.fetch(new Request("https://w.test/v2/commands", {
      method: "POST",
      headers: {
        "x-opalreader-token": TOK, "x-opalreader-scope": "production",
        "x-opalreader-instance": "account", "content-type": "application/json",
      },
      body: JSON.stringify({
        command_id: commandId, type: "SubmitJob",
        payload: { bookId, lane: "standard", data: { d6Intent } },
      }),
    }), entryEnv);
  const bind = ({ token = null, operator: op = OPTOK, body } = {}) =>
    D6Entry.fetch(new Request("https://w.test/v2/d6-phase-binding", {
      method: "POST",
      headers: {
        ...(token === null ? {} : { "x-opalreader-token": token }),
        ...(op === null ? {} : { "x-opalreader-operator-token": op }),
        "x-opalreader-scope": "production", "x-opalreader-instance": "account",
        Origin: ORIGIN, "content-type": "application/json",
      },
      body: JSON.stringify(body ?? { phase: PHASE, bookId: FP_ID }),
    }), entryEnv);
  return { db, inst, entryEnv, submit, bind };
}

test("R3-1+R5 entry: registry ABSENT + enforce — EVERY submission is refused by the bootstrap gate over the public route", async () => {
  const w = entryWorld();
  // R5: round 3 expected phase_unbound for the named claims and
  // admitted the null-phase one; the bootstrap gate now refuses
  // the whole matrix (Rowan ruling 6514899384 item 2, test (c)).
  const fp = await (await w.submit("x-1", FP_ID, { scope: "book", keepGoing: true, phase: PHASE })).json();
  assert.deepEqual(fp, { outcome: "rejected", reason: "phase_binding_required" },
    "from the new Worker's first requests, the budgeted claim fails closed — no legacy window");
  const other = await (await w.submit("x-2", OTHER, { scope: "book", keepGoing: true, phase: PHASE })).json();
  assert.deepEqual(other, { outcome: "rejected", reason: "phase_binding_required" });
  const fpNull = await (await w.submit("x-2b", FP_ID, { scope: "book", keepGoing: true, phase: null })).json();
  assert.deepEqual(fpNull, { outcome: "rejected", reason: "phase_binding_required" },
    "the budgeted book cannot slip an unbudgeted plan in before its binding is recorded");
  const free = await (await w.submit("x-3", OTHER, { scope: "book", keepGoing: true, phase: null })).json();
  assert.deepEqual(free, { outcome: "rejected", reason: "phase_binding_required" },
    "null-phase work for ANY book waits for the binding while the registry is empty");
  const forged = await (await w.submit("x-3b", OTHER, { scope: "book", keepGoing: true, phase: "phase-invented" })).json();
  assert.deepEqual(forged, { outcome: "rejected", reason: "phase_binding_required" });
  assert.equal(w.db.prepare(`SELECT COUNT(*) AS n FROM d6_plans`).get().n, 0, "no plan was created");
  assert.equal(w.db.prepare(`SELECT COUNT(*) AS n FROM ledger_ops`).get().n, 0, "no ledger movement");
  assert.equal(w.db.prepare(`SELECT COUNT(*) AS n FROM grants`).get().n, 0, "no grant");
  // The operator writer remains usable while admission is
  // gated — and once the binding lands, unbudgeted work flows.
  const bindRes = await w.bind({});
  assert.equal(bindRes.status, 200, "the recording route works while generation admission is gated");
  const freeAfter = await (await w.submit("x-3c", OTHER, { scope: "book", keepGoing: true, phase: null })).json();
  assert.equal(freeAfter.created, true, "after the binding, a null-phase intent for an unbound book is admitted");
});

test("R3-1 entry: the recording route refuses everything except the operator credential", async () => {
  const w = entryWorld();
  const noCred = await w.bind({ operator: null });
  assert.equal(noCred.status, 403);
  assert.deepEqual(await noCred.json(), { error: "migration_operator_required" });
  const clientOnly = await w.bind({ token: TOK, operator: null });
  assert.equal(clientOnly.status, 403, "the everyday client token alone is refused");
  assert.deepEqual(await clientOnly.json(), { error: "migration_operator_required" });
  const wrongOp = await w.bind({ operator: "not-the-operator-token" });
  assert.equal(wrongOp.status, 403);
  assert.deepEqual(await wrongOp.json(), { error: "migration_operator_required" });
  assert.equal(w.db.prepare(`SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='d6_phase_bindings'`).get().n, 0,
    "no refusal created the registry table, let alone a binding");
});

test("R3-1 entry: operator credential unconfigured — the route fails closed (503), nothing recorded", async () => {
  const w = entryWorld({ operator: false });
  const r = await w.bind({});
  assert.equal(r.status, 503);
  assert.deepEqual(await r.json(), { error: "migration_operator_not_configured" });
});

test("R3-1 entry: the internal route refuses a direct call without the entry's operator-admitted stamp", async () => {
  const w = entryWorld();
  const direct = await w.inst.fetch(new Request("https://do.internal/internal/d6/phase-binding", {
    method: "POST",
    headers: {
      "x-opalreader-internal": "1", "x-opalreader-scope": "production",
      "content-type": "application/json",
    },
    body: JSON.stringify({ phase: PHASE, bookId: FP_ID }),
  }));
  assert.equal(direct.status, 403);
  assert.deepEqual(await direct.json(), { error: "migration_operator_required" },
    "the internal header + scope alone do not suffice — the stamp is required");
});

test("R3-1 entry: the operator records forever-pucked → the Forever Pucked book — read-back, idempotency, conflict refusal", async () => {
  const w = entryWorld();
  const first = await w.bind({});
  assert.equal(first.status, 200);
  const firstBody = await first.json();
  assert.equal(firstBody.outcome, "applied");
  assert.equal(firstBody.changed, true);
  assert.equal(firstBody.binding.phase, PHASE);
  assert.equal(firstBody.binding.bookId, FP_ID,
    "the read-back binding names the production Forever Pucked book id");
  assert.equal(firstBody.binding.source, "operator-route",
    "the recorded source is stamped by the server, not the caller");
  const row = w.db.prepare(`SELECT * FROM d6_phase_bindings WHERE phase = ?`).get(PHASE);
  assert.equal(row.book_id, FP_ID);
  const again = await (await w.bind({})).json();
  assert.equal(again.outcome, "applied");
  assert.equal(again.changed, false);
  assert.equal(again.idempotent, true, "re-recording the same pair is a success no-op");
  assert.equal(again.binding.bookId, FP_ID);
  const conflict = await (await w.bind({ body: { phase: PHASE, bookId: OTHER } })).json();
  assert.equal(conflict.outcome, "rejected");
  assert.equal(conflict.reason, "phase_binding_conflict");
  assert.equal(conflict.binding.bookId, FP_ID,
    "the refusal's read-back shows the binding that stands");
  assert.equal(w.db.prepare(`SELECT COUNT(*) AS n FROM d6_phase_bindings`).get().n, 1,
    "still exactly one binding row");
});

test("R3-1 entry: after the binding — the mapped book is admitted, the phase is closed to everyone else", async () => {
  const w = entryWorld();
  await w.bind({});
  const fp = await (await w.submit("x-4", FP_ID, { scope: "book", keepGoing: true, phase: PHASE })).json();
  assert.equal(fp.created, true, "the bound book with its registry phase is admitted");
  const forged = await (await w.submit("x-5", OTHER, { scope: "segment", occurrenceId: "e0", phase: PHASE })).json();
  assert.deepEqual(forged, { outcome: "rejected", reason: "phase_bound_to_other_book" });
  const missing = await (await w.submit("x-6", FP_ID, { scope: "segment", occurrenceId: "e0", phase: null })).json();
  assert.deepEqual(missing, { outcome: "rejected", reason: "phase_required" },
    "the bound book may not run outside its phase accounting");
});

// R5 (replaces the round-3 contrast test, whose premise —
// unset flag → legacy construction through the production
// entry — is exactly what Rowan's item 1 forbids): a missing
// or mistyped flag is an explicit configuration failure at the
// intent route, for the WHOLE submission matrix (Rowan ruling
// 6514899384 item 2, tests (a) and (b)), with zero movement.
async function assertConfigFailureMatrix(w, label) {
  const matrix = [
    ["m-1", FP_ID, { scope: "book", keepGoing: true, phase: PHASE }],
    ["m-2", FP_ID, { scope: "book", keepGoing: true, phase: null }],
    ["m-3", OTHER, { scope: "book", keepGoing: true, phase: PHASE }],
    ["m-4", OTHER, { scope: "book", keepGoing: true, phase: null }],
    ["m-5", OTHER, { scope: "book", keepGoing: true, phase: "phase-invented" }],
  ];
  for (const [cid, bookId, intent] of matrix) {
    const res = await w.submit(cid, bookId, intent);
    assert.equal(res.status, 503, `${label}: submission ${cid} fails with an explicit configuration error`);
    assert.deepEqual(await res.json(), { error: "phase_policy_not_configured" });
  }
  assert.equal(w.db.prepare(`SELECT COUNT(*) AS n FROM d6_plans`).get().n, 0, `${label}: no plan was created`);
  assert.equal(w.db.prepare(`SELECT COUNT(*) AS n FROM ledger_ops`).get().n, 0, `${label}: no ledger movement`);
  assert.equal(w.db.prepare(`SELECT COUNT(*) AS n FROM grants`).get().n, 0, `${label}: no grant`);
}

test("R5 entry: MISSING phase-policy flag — every submission fails 503 phase_policy_not_configured, zero movement", async () => {
  const w = entryWorld({ enforce: false });
  await assertConfigFailureMatrix(w, "missing flag");
});

test("R5 entry: MISTYPED phase-policy flag — every submission fails 503 phase_policy_not_configured, zero movement", async () => {
  const w = entryWorld({ enforce: "typo" });
  await assertConfigFailureMatrix(w, "mistyped flag");
});
