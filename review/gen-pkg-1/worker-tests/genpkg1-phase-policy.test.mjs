// gen-pkg-1 round-2 corrections — R2-1 (Rowan round-2 source
// review, comment 6511950562).
//
// R2-1: first-use phase must come from an AUTHORITATIVE
// server-held book→phase policy, not from the first
// caller-provided plan. The policy is the phase→book registry
// (worker/generation/phase-policy.mjs): server state in the
// coordinator's own store, recorded through the service's
// bindPhaseBook (a gated operator act — no client route reaches
// it), and consulted by admitPhase BEFORE any plan or ledger
// state moves.
//
// ESTABLISHMENT IS THE SWITCH, and these tests pin both sides:
//   * registry ESTABLISHED: the mapped book's phase is derived
//     from its registry row (missing → phase_required, different
//     → phase_mismatch); an unrelated book's forged claim on the
//     bound phase is rejected (phase_bound_to_other_book) with
//     no plan/ledger movement; no submission field can opt back
//     into legacy rules; capabilities reports the registry's
//     book for the phase even before any plan exists; and the
//     same law governs submissions arriving through the REAL
//     public entry (POST /v2/commands), not only direct service
//     calls.
//   * registry EMPTY (legacy mode): the round-1 history rules
//     stand exactly — two books may share a phase inside one
//     fixture database. That is the explicit legacy/service-
//     fixture behavior Rowan sanctioned preserving; it exists
//     only where no binding has ever been recorded.
//
// The FP book id below is the production Forever Pucked book id
// — the pair the deploy gate records — used here purely as a
// fixture identifier over synthetic content.
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
const T = (id) => `Synthetic prose for segment ${id}, invented for the phase-policy harness only.`;

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

async function makeWorld() {
  const h = makeHarness({});
  const store = createGenStore(h.coord);
  store.ensureSchema();
  for (const bookId of [FP_ID, OTHER]) {
    h.db.prepare(`INSERT INTO sync_entities (family, entity_key, book_id, revision, deleted, data_json)
                  VALUES ('content', ?, ?, 1, 0, ?)`).run(bookId, bookId, JSON.stringify(bookData()));
  }
  const sources = createCoordinatorPlaneSource(h.coord);
  const service = createGenerationService({ coord: h.coord, env: h.env, store, sources });
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

// Record the production-shaped binding through the service API
// (the gated operator act, at fixture scale).
async function establishRegistry(w) {
  const r = w.service.bindPhaseBook({ phase: PHASE, bookId: FP_ID, source: "phase-policy-test" });
  assert.deepEqual(r, { outcome: "applied", phase: PHASE, bookId: FP_ID, changed: true, idempotent: false });
  return r;
}

test("R2-1: capabilities derives the phase's book from the registry — before any plan exists", async () => {
  const w = await makeWorld();
  const before = w.service.capabilities();
  assert.equal(before.phases.find(p => p.phase === PHASE).bookId, null,
    "legacy mode, no plans: no phase→book link is claimed");
  await establishRegistry(w);
  const caps = w.service.capabilities();
  assert.equal(caps.phases.find(p => p.phase === PHASE).bookId, FP_ID,
    "the link is the registry row, not plan history");
  assert.equal(w.h.rows("d6_plans").length, 0, "still no plans — derivation is from the registry alone");
});

test("R2-1: the mapped book with its registry phase is admitted; the plan stores the registry phase", async () => {
  const w = await makeWorld();
  await establishRegistry(w);
  const r = await w.service.submitIntent({
    commandId: "fp-1", bookId: FP_ID, scope: "book", keepGoing: true,
    phase: PHASE, lane: "standard",
  });
  assert.equal(r.created, true);
  const row = w.h.rows("d6_plans").find(p => p.plan_id === r.planId);
  assert.equal(row.phase, PHASE);
  assert.equal(row.book_id, FP_ID);
});

test("R2-1: the mapped book with a missing/null phase is rejected (phase_required), nothing moves", async () => {
  const w = await makeWorld();
  await establishRegistry(w);
  const before = ledgerCounts(w.h);
  const omitted = await w.service.submitIntent({
    commandId: "fp-omit", bookId: FP_ID, scope: "book", keepGoing: true, lane: "standard",
  });
  assert.deepEqual(omitted, { outcome: "rejected", reason: "phase_required" });
  const explicitNull = await w.service.submitIntent({
    commandId: "fp-null", bookId: FP_ID, scope: "book", keepGoing: true,
    phase: null, lane: "standard",
  });
  assert.deepEqual(explicitNull, { outcome: "rejected", reason: "phase_required" });
  assert.deepEqual(ledgerCounts(w.h), before, "no plan, no ledger/attempt/grant movement");
});

test("R2-1: the mapped book with a different phase is rejected (phase_mismatch), nothing moves", async () => {
  const w = await makeWorld();
  await establishRegistry(w);
  const before = ledgerCounts(w.h);
  const wrong = await w.service.submitIntent({
    commandId: "fp-wrong", bookId: FP_ID, scope: "book", keepGoing: true,
    phase: "some-other-phase", lane: "standard",
  });
  assert.deepEqual(wrong, { outcome: "rejected", reason: "phase_mismatch" });
  assert.deepEqual(ledgerCounts(w.h), before);
});

test("R2-1: an unrelated book's forged claim on the bound phase is rejected (phase_bound_to_other_book)", async () => {
  const w = await makeWorld();
  await establishRegistry(w);
  const before = ledgerCounts(w.h);
  const forged = await w.service.submitIntent({
    commandId: "forge-1", bookId: OTHER, scope: "book", keepGoing: true,
    phase: PHASE, lane: "standard",
  });
  assert.deepEqual(forged, { outcome: "rejected", reason: "phase_bound_to_other_book" },
    "another book cannot claim the Forever Pucked envelope");
  assert.deepEqual(ledgerCounts(w.h), before, "the forged claim creates nothing and moves nothing");
  const binding = w.h.rows("d6_phase_bindings").find(r => r.phase === PHASE);
  assert.equal(binding.book_id, FP_ID, "the recorded binding stands");
});

test("R2-1: an unbound book runs unbudgeted with no phase; an invented phase is rejected (registry mode)", async () => {
  const w = await makeWorld();
  await establishRegistry(w);
  const ok = await w.service.submitIntent({
    commandId: "oth-1", bookId: OTHER, scope: "book", keepGoing: true,
    phase: null, lane: "standard",
  });
  assert.equal(ok.created, true);
  assert.equal(w.h.rows("d6_plans").find(p => p.plan_id === ok.planId).phase, null);
  const w2 = await makeWorld();
  await establishRegistry(w2);
  const invented = await w2.service.submitIntent({
    commandId: "oth-2", bookId: OTHER, scope: "book", keepGoing: true,
    phase: "my-invented-phase", lane: "standard",
  });
  assert.deepEqual(invented, { outcome: "rejected", reason: "phase_not_budgeted" });
  assert.equal(w2.h.rows("d6_plans").length, 0);
});

test("R2-1: no submission field opts out of the registry — spoofed mode fields change nothing", async () => {
  const w = await makeWorld();
  await establishRegistry(w);
  const forged = await w.service.submitIntent({
    commandId: "spoof-1", bookId: OTHER, scope: "book", keepGoing: true,
    phase: PHASE, lane: "standard",
    // Fields a caller might hope select friendlier rules. The
    // service destructures its known inputs only, and the mode is
    // read from server state — none of these can matter.
    admission: "service", phasePolicy: "legacy", registry: false, bindPhase: false,
  });
  assert.deepEqual(forged, { outcome: "rejected", reason: "phase_bound_to_other_book" });
  assert.equal(w.h.rows("d6_plans").length, 0);
});

test("R2-1: bindPhaseBook — idempotent re-record, conflict keeps the original, shape/budget validation", async () => {
  const w = await makeWorld();
  await establishRegistry(w);
  const again = w.service.bindPhaseBook({ phase: PHASE, bookId: FP_ID, source: "phase-policy-test" });
  assert.deepEqual(again, { outcome: "applied", phase: PHASE, bookId: FP_ID, changed: false, idempotent: true },
    "re-recording the same pair is an idempotent no-op");
  const conflict = w.service.bindPhaseBook({ phase: PHASE, bookId: OTHER, source: "hostile-rebind" });
  assert.deepEqual(conflict, { outcome: "rejected", reason: "phase_binding_conflict" });
  assert.equal(w.h.rows("d6_phase_bindings").find(r => r.phase === PHASE).book_id, FP_ID,
    "a rebind is never a silent overwrite — the original binding stands");
  const unbudgeted = w.service.bindPhaseBook({ phase: "no-such-phase", bookId: OTHER });
  assert.deepEqual(unbudgeted, { outcome: "rejected", reason: "phase_not_budgeted" },
    "an invented phase can never acquire a binding");
  const malformed = w.service.bindPhaseBook({ phase: PHASE, bookId: "" });
  assert.deepEqual(malformed, { outcome: "rejected", reason: "phase_binding_shape" });
  assert.equal(w.h.rows("d6_phase_bindings").length, 1, "exactly one binding row exists");
});

test("R2-1 legacy mode: with NO binding recorded, the round-1 first-use rules stand (explicit fixture behavior)", async () => {
  const w = await makeWorld();
  // Two books share the phase inside one registry-free database —
  // the behavior the existing D6 suites (d6-service,
  // d6-correction) stage, preserved deliberately.
  const a = await w.service.submitIntent({
    commandId: "leg-a", bookId: FP_ID, scope: "book", keepGoing: true,
    phase: PHASE, lane: "standard",
  });
  const b = await w.service.submitIntent({
    commandId: "leg-b", bookId: OTHER, scope: "book", keepGoing: true,
    phase: PHASE, lane: "standard",
  });
  assert.equal(a.created, true);
  assert.equal(b.created, true, "legacy mode: the second book's first use is admitted (fixture behavior)");
  assert.equal(w.h.rows("d6_plans").filter(p => p.phase === PHASE).length, 2);
  // And the round-1 history binding governs from there: FP is
  // history-bound, so a null-phase submission is rejected.
  const c = await w.service.submitIntent({
    commandId: "leg-c", bookId: FP_ID, scope: "chapter", chapterIndex: 1,
    phase: null, lane: "standard",
  });
  assert.deepEqual(c, { outcome: "rejected", reason: "phase_required" });
  assert.equal(w.h.rows("d6_phase_bindings")?.length ?? 0, 0,
    "no binding was recorded at any point — legacy mode throughout");
});

// ---------------------------------------------------------------------------
// Entry level: the registry governs the REAL public submission
// path (POST /v2/commands through the production entry + the D6
// coordinator class), not only direct service calls. Modeled on
// the d6-correction C3 / genpkg1-diagnostics entry fixtures:
// the real entry module and the real DO class over node:sqlite.
// GENERATION_HALT="1" keeps the intents durable-state-only.
// ---------------------------------------------------------------------------

class SqlCursor {
  constructor(rows) { this._rows = rows; }
  one() {
    if (this._rows.length === 0) throw new Error("Expected exactly one result from SQL query, but got no results.");
    if (this._rows.length > 1) throw new Error(`Expected exactly one result from SQL query, but got ${this._rows.length} results.`);
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

const TOK = "prod-client-token-synthetic";
const ORIGIN = "https://jedavid33-design.github.io";

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
  const state = { storage };
  const inst = new D6Prod(state, {
    OPALREADER_V2_SCOPE: "production", OPALREADER_ACCESS_TOKEN: TOK,
    GENERATION_HALT: "1", ALLOWED_ORIGIN: ORIGIN,
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
  return { db, inst, submit };
}

test("R2-1 entry level: once the binding is recorded, the public path enforces it", async () => {
  const w = entryWorld();
  // Bootstrap through the public path in legacy mode (registry
  // still empty): the unrelated book's unbudgeted intent is
  // admitted, and the service's first admission creates the
  // (empty) registry table inside the DO store.
  const boot = await (await w.submit("ent-boot", OTHER, { scope: "book", keepGoing: true, phase: null })).json();
  assert.equal(boot.created, true, "legacy-mode bootstrap intent admitted");
  // The recorded operator act (fixture scale: the row itself,
  // written into the same store the service reads).
  w.db.prepare(`INSERT INTO d6_phase_bindings (phase, book_id, source, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)`)
    .run(PHASE, FP_ID, "entry-test-recorded-binding", 1793315400000, 1793315400000);
  // The mapped book with its registry phase: admitted.
  const fp = await (await w.submit("ent-fp", FP_ID, { scope: "book", keepGoing: true, phase: PHASE })).json();
  assert.equal(fp.created, true, "the mapped book is admitted through the public entry");
  // The unrelated book's forged claim on the bound phase:
  // rejected by the same law, over the wire. (Segment scope: the
  // phase gate runs before any overlap consideration.)
  const forged = await (await w.submit("ent-forge", OTHER,
    { scope: "segment", occurrenceId: "e0", phase: PHASE })).json();
  assert.deepEqual(forged, { outcome: "rejected", reason: "phase_bound_to_other_book" });
  // The mapped book with NO phase: rejected too.
  const missing = await (await w.submit("ent-missing", FP_ID,
    { scope: "segment", occurrenceId: "e0", phase: null })).json();
  assert.deepEqual(missing, { outcome: "rejected", reason: "phase_required" });
  const plans = w.db.prepare(`SELECT book_id, COUNT(*) AS n FROM d6_plans GROUP BY book_id`).all();
  assert.deepEqual(Object.fromEntries(plans.map(r => [r.book_id, r.n])), { [OTHER]: 1, [FP_ID]: 1 },
    "exactly the two admitted plans exist — every rejection created nothing");
});
