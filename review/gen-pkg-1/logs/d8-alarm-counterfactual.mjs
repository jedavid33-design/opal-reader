// One-off counterfactual for D8-2c decisiveness (NOT a suite):
// stage the exact D8-2c probe (held plan + 'generating'-state
// plan-linked job + due retry_grant row) under the D6 class,
// then fire the alarm of the PRE-D6 BASE production class
// (worker-entry-prod.js — no D6 env decoration anywhere) over
// the same store. If the base alarm grants the probe, the D8-2c
// fence is proven decisive rather than vacuous.
import { DatabaseSync } from "node:sqlite";
process.chdir("/home/hatch/workspace/gen-pkg-1/worker-build");
const D6Entry = (await import("/home/hatch/workspace/gen-pkg-1/worker-build/worker/worker-entry-prod-d6.js")).default;
const d6Module = await import("/home/hatch/workspace/gen-pkg-1/worker-build/worker/worker-entry-prod-d6.js");
const baseModule = await import("/home/hatch/workspace/gen-pkg-1/worker-build/worker/worker-entry-prod.js");
const { makeFakeR2Bucket } = await import("/home/hatch/workspace/gen-pkg-1/worker-build/tests/helpers/d6-fakes.mjs");
const D6Prod = d6Module.OpalReaderCoordinatorProd;
const BaseProd = baseModule.OpalReaderCoordinatorProd;

class SqlCursor { constructor(r) { this._rows = r; } toArray() { return this._rows; }
  one() { if (this._rows.length !== 1) throw new Error("one"); return this._rows[0]; } }
class SqlFacade { constructor(db) { this.db = db; }
  exec(q, ...p) { if (p.length === 0 && q.includes(";")) { this.db.exec(q); return new SqlCursor([]); }
    const s = this.db.prepare(q);
    if (/^\s*(SELECT|WITH)/i.test(q)) return new SqlCursor(s.all(...p));
    const i = s.run(...p);
    return new SqlCursor([{ changes: Number(i.changes), last_row_id: Number(i.lastInsertRowid) }]); } }

const TOK = "prod-client-token-synthetic", OPTOK = "prod-operator-token-synthetic";
const ORIGIN = "https://jedavid33-design.github.io";
const FP_ID = "5c589095-f812-48a2-8ab2-03ba2791f2b2";
const db = new DatabaseSync(":memory:");
let alarmAt = null;
const storage = { sql: new SqlFacade(db),
  transactionSync(fn) { db.exec("BEGIN IMMEDIATE"); try { const r = fn(); db.exec("COMMIT"); return r; } catch (e) { try { db.exec("ROLLBACK"); } catch {} throw e; } },
  async setAlarm(ms) { alarmAt = ms; }, async getAlarm() { return alarmAt; }, async deleteAlarm() { alarmAt = null; } };
const env = { OPALREADER_V2_SCOPE: "production", OPALREADER_ACCESS_TOKEN: TOK,
  OPALREADER_MIGRATION_OPERATOR_TOKEN: OPTOK, GENERATION_HALT: "1", ALLOWED_ORIGIN: ORIGIN,
  OPALREADER_PHASE_POLICY: "enforce", OPALREADER_STORAGE: makeFakeR2Bucket() };
const inst = new D6Prod({ storage }, env);
const seg = (id) => ({ occurrenceId: id, text: "Synthetic segment text.", pov: "pov-n" });
const data = { chapters: [{ chapterId: "c-0", index: 0, segments: [seg("e0"), seg("e2")] }],
  povs: [{ id: "pov-n", name: "Narrator", voice: { provider: "gemini", voice_id: "Zephyr", model_id: "gemini-3.8-flash-tts" } }],
  defaultVoice: { provider: "gemini", voiceId: "Zephyr" } };
db.prepare(`INSERT INTO sync_entities (family, entity_key, book_id, revision, deleted, data_json) VALUES ('content', ?, ?, 1, 0, ?)`)
  .run(FP_ID, FP_ID, JSON.stringify(data));
const ns = { idFromName: (n) => n, get: () => ({ fetch: (r) => inst.fetch(r) }) };
const entryEnv = { ...env, COORDINATOR: ns };
const call = (path, { method = "GET", body, token = TOK, operator = null } = {}) =>
  D6Entry.fetch(new Request(`https://w.test${path}`, { method,
    headers: { ...(token === null ? {} : { "x-opalreader-token": token }),
      ...(operator === null ? {} : { "x-opalreader-operator-token": operator }),
      "x-opalreader-scope": "production", "x-opalreader-instance": "account",
      ...(body === undefined ? {} : { "content-type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body) }), entryEnv);

const bind = await call("/v2/d6-phase-binding", { method: "POST", token: null, operator: OPTOK, body: { phase: "forever-pucked", bookId: FP_ID } });
console.log("bind:", bind.status);
const sub = await call("/v2/commands", { method: "POST", body: { command_id: "cf-1", type: "SubmitJob",
  payload: { bookId: FP_ID, lane: "standard", data: { d6Intent: { scope: "book", keepGoing: true, phase: "forever-pucked" } } } } });
const subBody = await sub.json();
console.log("intent:", sub.status, subBody.created, subBody.planId);
const planId = subBody.planId;
const now = Date.now();
db.prepare(`INSERT INTO jobs (job_id, kind, book_id, chapter_index, lane, state, revision, data_json, created_at, updated_at) VALUES ('probe-g', 'job', ?, 0, 'standard', 'generating', 1, '{}', ?, ?)`).run(FP_ID, now, now);
db.prepare(`INSERT INTO occurrences (job_id, occurrence_id, revision_key, state) VALUES ('probe-g', 'g-occ', 'fp-g-occ', 'pending')`).run();
db.prepare(`INSERT INTO d6_plan_jobs (plan_id, seq, job_id, chapter_index) VALUES (?, 99, 'probe-g', 0)`).run(planId);
db.prepare(`INSERT INTO schedule (due_at, kind, ref, payload_json, attempts, state) VALUES (1, 'retry_grant', 'probe-g', '{}', 0, 'pending')`).run();
const counts = () => ({ grants: db.prepare(`SELECT COUNT(*) AS n FROM grants`).get().n,
  ledger: db.prepare(`SELECT COUNT(*) AS n FROM ledger_ops`).get().n,
  outbox: db.prepare(`SELECT COUNT(*) AS n FROM outbox`).get().n });
console.log("before base alarm:", counts());
// The BASE production class over the same store — no D6 class,
// no decoration, GENERATION_HALT irrelevant to its alarm path.
const base = new BaseProd({ storage }, { ...env });
await base.alarm();
console.log("after BASE-class alarm:", counts());
console.log(counts().grants > 0
  ? "COUNTERFACTUAL CONFIRMED: the unguarded base alarm GRANTS the held plan's probe job — the D8-2c fence is decisive."
  : "COUNTERFACTUAL FAILED: base alarm granted nothing — D8-2c would be vacuous.");
