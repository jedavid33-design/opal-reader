// D6 WS-1 — generation-plane schema (CONTRACTS.md
// "generation/gen-schema.mjs"). All tables are additive (IF NOT
// EXISTS) and live in the coordinator's Durable Object SQLite store,
// alongside — never altering — the v2 coordinator tables.
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
  updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS d6_voice_prompts (
  plan_id TEXT NOT NULL, occurrence_id TEXT NOT NULL,
  character_name TEXT, provider TEXT, recorded_mapping TEXT,
  created_at INTEGER NOT NULL, PRIMARY KEY (plan_id, occurrence_id));
`;

// ensureGenSchema(sql): run the DDL against a coordinator-shaped SQL
// facade (anything with .exec(query) accepting a multi-statement
// batch — the DO storage facade and the test harness both do).
export function ensureGenSchema(sql) {
  sql.exec(GEN_SCHEMA);
}
