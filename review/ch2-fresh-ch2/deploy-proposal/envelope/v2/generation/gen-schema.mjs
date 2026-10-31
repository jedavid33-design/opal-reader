// D6 WS-1 — generation-plane schema (CONTRACTS.md
// "generation/gen-schema.mjs"). All tables are additive (IF NOT
// EXISTS) and live in the coordinator's Durable Object SQLite store,
// alongside — never altering — the v2 coordinator tables.
//
// CORRECTION (Rowan source-review block 6501450683): this DDL is the
// continuity-preserving schema evolution for the EXISTING
// production coordinator instance. It is invoked from the D6
// entry's OpalReaderCoordinatorProd constructor (the same class
// name/namespace the live script binds), so the d6_* tables appear
// IN PLACE inside the account instance's persisted SQLite store on
// the first D6 wake — no new DO class, no migration, no state
// carry. The bootstrap is DDL-only (no reads at all, hence no
// `.one()` empty-result hazard against real DO SQLite semantics)
// and idempotent: every later wake re-runs it as a no-op.
//
// CORRECTION 2 (arming sub-step 0 finding): the first such column
// evolution, exactly as prescribed above — guarded, idempotent
// ALTERs beside the DDL, never a table rebuild. d6_storage_state
// gains object_count / seeded_at / provenance_json for the storage
// seed (genstore.seedStorageBase). Stores created by the deployed
// build carry the original 3-column table (the D6 worker IS
// deployed, halted — the earlier "never deployed" premise no
// longer holds for the tables themselves); the CREATE below
// carries the full column set for fresh stores, and
// ensureGenSchema applies the ALTERs to pre-existing tables,
// swallowing only the duplicate-column outcome that proves a
// column is already present. Rows and values are never touched.
//
// Vocabulary (Amendment A-1, Rowan clarification 1 / Q5): reserved
// grants are not spend; attempted calls are recorded in the
// append-only attempt log at attempt time; only actual KNOWN cost
// settles against a phase budget; an UNKNOWN billing outcome halts
// its phase pending reconciliation.

export const GEN_SCHEMA = `
CREATE TABLE IF NOT EXISTS d6_plans (
  plan_id TEXT PRIMARY KEY, intent_key TEXT UNIQUE NOT NULL,
  book_id TEXT, scope TEXT, keep_going INTEGER NOT NULL DEFAULT 0,
  phase TEXT, lane TEXT, state TEXT NOT NULL, stop_reason TEXT,
  eligible_digest TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS d6_plan_jobs (
  plan_id TEXT NOT NULL, job_id TEXT NOT NULL, chapter_index INTEGER,
  seq INTEGER NOT NULL, PRIMARY KEY (plan_id, job_id));
CREATE TABLE IF NOT EXISTS d6_plan_entries (
  plan_id TEXT NOT NULL, occurrence_id TEXT NOT NULL,
  book_id TEXT, chapter_id TEXT, chapter_index INTEGER, position INTEGER,
  pov_key TEXT, char_count INTEGER, upper_micro_cents INTEGER,
  disposition TEXT, job_id TEXT,
  PRIMARY KEY (plan_id, occurrence_id));
CREATE TABLE IF NOT EXISTS d6_execution_records (
  execution_id TEXT PRIMARY KEY, plan_id TEXT, job_id TEXT NOT NULL,
  occurrence_id TEXT NOT NULL, grant_id TEXT, state TEXT NOT NULL,
  stage TEXT, cache_key TEXT, object_key TEXT, etag TEXT,
  size_bytes INTEGER, sha256 TEXT, detail_json TEXT,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS d6_attempt_log (
  attempt_id TEXT PRIMARY KEY, execution_id TEXT NOT NULL,
  plan_id TEXT, occurrence_id TEXT NOT NULL, seq INTEGER NOT NULL,
  phase TEXT NOT NULL, outcome TEXT, cost_micro_cents INTEGER,
  upper_micro_cents INTEGER, provider_request_id TEXT, detail_json TEXT,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS d6_phase_state (
  phase TEXT PRIMARY KEY, halted_unknown_billing INTEGER NOT NULL DEFAULT 0,
  halt_detail TEXT, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS d6_storage_state (
  id INTEGER PRIMARY KEY CHECK (id = 1), base_bytes INTEGER NOT NULL,
  object_count INTEGER, seeded_at INTEGER, provenance_json TEXT,
  updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS d6_voice_prompts (
  plan_id TEXT NOT NULL, occurrence_id TEXT NOT NULL,
  character_name TEXT, provider TEXT, recorded_mapping TEXT,
  created_at INTEGER NOT NULL, PRIMARY KEY (plan_id, occurrence_id));
`;

// CORRECTION 2 — the guarded column evolution for d6_storage_state
// (see the header). Each ALTER is attempted unconditionally after
// the DDL; the ONLY swallowed failure is SQLite's duplicate-column
// error, which is the proof the column already exists (fresh stores
// are born with the full column set via the CREATE above). Any
// other failure rethrows — a half-evolved table must stay loud.
// Read-free, like the rest of the bootstrap: no `.one()` hazard.
const STORAGE_STATE_EVOLUTION = Object.freeze([
  ["object_count", "INTEGER"],
  ["seeded_at", "INTEGER"],
  ["provenance_json", "TEXT"],
]);

// ensureGenSchema(sql): run the DDL against a coordinator-shaped SQL
// facade (anything with .exec(query) accepting a multi-statement
// batch — the DO storage facade and the test harness both do), then
// apply the guarded column evolution.
export function ensureGenSchema(sql) {
  sql.exec(GEN_SCHEMA);
  for (const [column, type] of STORAGE_STATE_EVOLUTION) {
    try {
      sql.exec(`ALTER TABLE d6_storage_state ADD COLUMN ${column} ${type}`);
    } catch (e) {
      if (!/duplicate column/i.test(String((e && e.message) || e))) throw e;
    }
  }
}
