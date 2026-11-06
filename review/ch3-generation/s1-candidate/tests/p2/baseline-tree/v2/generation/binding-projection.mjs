// gen-pkg-1 — server-side binding projection (DESIGN BRIEF v2 §3;
// Rowan design review 6510730060 pt 1 + sign-off 6510767252
// obligation 1).
//
// A D6 commit binds only the coordinator's SQL plane (bindings +
// cache_index, written atomically by genstore.commitVerified via
// coord.validateAndBind). The client learns audio from the SYNC
// bindings family. This module is the durable bridge between the
// two planes:
//
//   * COMMIT FIRST, THEN PROJECT. The projection never runs inside
//     the commit transaction and never presumes one atomic
//     transaction spans the SQL binding row and the sync entity.
//   * A per-occurrence marker row (d6_binding_projections) records
//     the publication state: pending -> published | conflict. The
//     marker is written BEFORE the publish attempt, so a crash
//     between commit and publication leaves a retryable pending
//     state, never a silent gap.
//   * RECONCILE UNTIL PUBLISHED. The watchdog-driven sweep retries
//     pending markers and discovers committed executions that have
//     no marker at all (the commit itself raced a crash/deploy).
//   * IDEMPOTENT, VERIFY-BEFORE-OVERWRITE. The desired payload is a
//     pure function of the committed SQL rows (binding row +
//     cache_index anchor + the committed execution record). A sync
//     entity already carrying the same cache key IS the same audio:
//     publication is a no-op. A sync entity carrying a DIFFERENT
//     cache key is a different legitimate binding (e.g. written by
//     the migration plane): the projection records a conflict and
//     NEVER overwrites it blindly.
//   * The payload's provenance is written by the server ("d6"),
//     never reconstructed by a client.
//
// Structural data only: occurrence ids, cache keys, formats, sizes,
// digests. Book text never enters this module.

const PROJECTION_SCHEMA = `
CREATE TABLE IF NOT EXISTS d6_binding_projections (
  occurrence_id TEXT PRIMARY KEY, book_id TEXT, job_id TEXT,
  execution_id TEXT, state TEXT NOT NULL, detail_json TEXT,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS d6_binding_projections_state_idx
  ON d6_binding_projections (state, updated_at);
`;

// DDL-only idempotent bootstrap (the proven throw-safe pattern: no
// reads, no .one()).
export function ensureBindingProjectionSchema(coord) {
  coord.sql.exec(PROJECTION_SCHEMA);
}

function markerRow(coord, occurrenceId) {
  return coord._oneOrNull(
    `SELECT * FROM d6_binding_projections WHERE occurrence_id = ?`, occurrenceId);
}

function writeMarker(coord, { occurrenceId, bookId = null, jobId = null,
                              executionId = null, state, detail = null }) {
  const t = coord._now();
  coord.sql.exec(
    `INSERT INTO d6_binding_projections
       (occurrence_id, book_id, job_id, execution_id, state, detail_json,
        created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(occurrence_id) DO UPDATE SET
       book_id = COALESCE(excluded.book_id, d6_binding_projections.book_id),
       job_id = COALESCE(excluded.job_id, d6_binding_projections.job_id),
       execution_id = COALESCE(excluded.execution_id,
                               d6_binding_projections.execution_id),
       state = excluded.state, detail_json = excluded.detail_json,
       updated_at = excluded.updated_at`,
    occurrenceId, bookId, jobId, executionId, state,
    detail === null ? null : JSON.stringify(detail), t, t);
}

// The latest committed D6 execution for an occurrence, if any.
function committedExecution(coord, occurrenceId) {
  return coord._oneOrNull(
    `SELECT * FROM d6_execution_records
      WHERE occurrence_id = ? AND state = 'committed'
      ORDER BY updated_at DESC, execution_id DESC LIMIT 1`, occurrenceId);
}

// The projection's desired state, derived ONLY from committed SQL
// rows: the execution record (cache key, size), the bindings row
// the commit wrote (revision key), and the cache_index anchor
// (format + digest written by validateAndBind itself).
function desiredProjection(coord, occurrenceId) {
  const exec = committedExecution(coord, occurrenceId);
  if (!exec) return { ready: false, reason: "no_committed_execution" };
  if (!exec.cache_key) return { ready: false, reason: "execution_missing_cache_key" };
  const binding = coord._oneOrNull(
    `SELECT * FROM bindings WHERE occurrence_id = ? AND cache_key = ?`,
    occurrenceId, exec.cache_key);
  if (!binding) return { ready: false, reason: "binding_row_missing" };
  const idx = coord._oneOrNull(
    `SELECT * FROM cache_index WHERE cache_key = ?`, exec.cache_key);
  const format = idx ? idx.format : null;
  const size = exec.size_bytes;
  if (!format || !Number.isSafeInteger(size) || size < 0)
    return { ready: false, reason: "binding_metadata_incomplete",
             detail: { format, size } };
  const job = coord._oneOrNull(
    `SELECT * FROM jobs WHERE job_id = ?`, exec.job_id);
  if (!job || !job.book_id) return { ready: false, reason: "job_book_unknown" };
  return {
    ready: true, bookId: job.book_id, jobId: exec.job_id,
    executionId: exec.execution_id,
    payload: {
      cacheKey: exec.cache_key,
      revisionKey: binding.revision_key,
      format,
      size,
      sha256: (idx && idx.sha256) || exec.sha256 || null,
      provenance: "d6",
    },
  };
}

function readEntityData(coord, bookId, occurrenceId) {
  const ent = coord._syncEntity("bindings", `${bookId}:${occurrenceId}`);
  if (!ent || ent.deleted) return { ent: null, data: null };
  let data = null;
  try { data = JSON.parse(ent.data_json || "{}"); } catch { data = null; }
  return { ent, data };
}

// One projection attempt for an occurrence. Runs in ONE transaction
// of its own (marker + entity are decided from a single consistent
// read), strictly AFTER the commit transaction has completed.
// Returns { status: "published" | "noop" | "conflict" | "pending", ... }.
export function projectBinding(coord, occurrenceId) {
  ensureBindingProjectionSchema(coord);
  return coord._tx(() => {
    const d = desiredProjection(coord, occurrenceId);
    if (!d.ready) {
      writeMarker(coord, { occurrenceId, state: "pending",
        detail: { reason: d.reason, ...(d.detail || {}) } });
      return { status: "pending", reason: d.reason };
    }
    const { ent, data } = readEntityData(coord, d.bookId, occurrenceId);
    if (data && data.cacheKey === d.payload.cacheKey) {
      // Same audio identity: already published. A revisionKey
      // variance (e.g. the hand-published G10 smoke binding, whose
      // revision key follows the migration convention while the
      // commit's SQL row carries the payload fingerprint) is noted,
      // never "repaired" by overwriting a legitimate binding.
      writeMarker(coord, { occurrenceId, bookId: d.bookId, jobId: d.jobId,
        executionId: d.executionId, state: "published",
        detail: { via: "existing_entity",
                  revisionKeyVariance: data.revisionKey !== d.payload.revisionKey,
                  projectedRevisionKey: d.payload.revisionKey,
                  entityRevisionKey: data.revisionKey ?? null } });
      return { status: "noop", bookId: d.bookId };
    }
    if (data && data.cacheKey !== d.payload.cacheKey) {
      // A DIFFERENT binding already lives at the destination:
      // verify and record — never overwrite blindly.
      writeMarker(coord, { occurrenceId, bookId: d.bookId,
        jobId: d.jobId, executionId: d.executionId, state: "conflict",
        detail: {
          existing: { cacheKey: data.cacheKey,
                      revisionKey: data.revisionKey ?? null,
                      provenance: data.provenance ?? null },
          desired: { cacheKey: d.payload.cacheKey,
                     revisionKey: d.payload.revisionKey,
                     provenance: d.payload.provenance },
        } });
      return { status: "conflict", bookId: d.bookId };
    }
    // Destination empty (or tombstoned): publish. _upsertSyncEntity
    // assigns the next revision; the decision and the write share
    // this transaction, so two racing projectors cannot both pass
    // the empty check — the second sees the first's entity and
    // no-ops on the equality branch above.
    coord._upsertSyncEntity("bindings", `${d.bookId}:${occurrenceId}`,
      d.bookId, d.payload);
    writeMarker(coord, { occurrenceId, bookId: d.bookId, jobId: d.jobId,
      executionId: d.executionId, state: "published",
      detail: { via: "projection" } });
    return { status: "published", bookId: d.bookId };
  });
}

// Post-commit hook (called by the executor after commitVerified has
// returned — NEVER inside the commit). Writes the retryable pending
// marker FIRST, then attempts the projection. Never throws: any
// failure leaves the pending marker (or, if even that failed, the
// reconciliation discovery scan finds the committed execution).
export function noteCommitted(coord, { executionId = null, jobId = null,
                                       occurrenceId } = {}) {
  try {
    ensureBindingProjectionSchema(coord);
    const job = jobId
      ? coord._oneOrNull(`SELECT * FROM jobs WHERE job_id = ?`, jobId) : null;
    const prior = markerRow(coord, occurrenceId);
    if (!prior || prior.state !== "published")
      writeMarker(coord, { occurrenceId, bookId: job ? job.book_id : null,
        jobId, executionId, state: "pending",
        detail: { reason: "awaiting_projection" } });
    return projectBinding(coord, occurrenceId);
  } catch (e) {
    try {
      writeMarker(coord, { occurrenceId, jobId, executionId,
        state: "pending",
        detail: { reason: "projection_error", error: String(e && e.message || e) } });
    } catch { /* the discovery scan is the last resort */ }
    return { status: "pending", reason: "projection_error" };
  }
}

// Is this occurrence's committed audio visible on the sync plane?
// True when a marker says published, or when the destination entity
// already carries the committed cache key (hand-published bindings
// from before this package, e.g. the G10 smoke segment).
export function isBindingPublished(coord, occurrenceId) {
  ensureBindingProjectionSchema(coord);
  const m = markerRow(coord, occurrenceId);
  if (m && m.state === "published") return true;
  if (m && m.state === "conflict") return false;
  const exec = committedExecution(coord, occurrenceId);
  if (!exec || !exec.cache_key) return false;
  const job = coord._oneOrNull(`SELECT * FROM jobs WHERE job_id = ?`, exec.job_id);
  if (!job || !job.book_id) return false;
  const { data } = readEntityData(coord, job.book_id, occurrenceId);
  return !!(data && data.cacheKey === exec.cache_key);
}

export function bindingProjectionMarker(coord, occurrenceId) {
  ensureBindingProjectionSchema(coord);
  return markerRow(coord, occurrenceId);
}

// The reconciliation sweep (watchdog-driven; bounded per pass):
//   (a) retry every pending marker, oldest first;
//   (b) re-examine conflict markers — a conflict clears only if the
//       destination now carries the committed cache key (someone
//       resolved it deliberately); it is NEVER overwritten here;
//   (c) discover committed executions with no marker at all (the
//       commit raced a crash or a deploy) and project them.
export function reconcileBindingProjections(coord, { limit = 50 } = {}) {
  ensureBindingProjectionSchema(coord);
  const cap = Math.max(1, Math.min(500, limit | 0));
  const out = { scanned: 0, published: 0, noop: 0, conflicts: 0, pending: 0 };
  const tally = (r) => {
    out.scanned++;
    if (r.status === "published") out.published++;
    else if (r.status === "noop") out.noop++;
    else if (r.status === "conflict") out.conflicts++;
    else out.pending++;
  };
  const pending = coord._all(
    `SELECT occurrence_id FROM d6_binding_projections
      WHERE state = 'pending' ORDER BY updated_at, occurrence_id LIMIT ?`, cap);
  for (const row of pending) tally(projectBinding(coord, row.occurrence_id));
  if (out.scanned < cap) {
    const conflicts = coord._all(
      `SELECT occurrence_id FROM d6_binding_projections
        WHERE state = 'conflict' ORDER BY updated_at, occurrence_id LIMIT ?`,
      cap - out.scanned);
    for (const row of conflicts) tally(projectBinding(coord, row.occurrence_id));
  }
  if (out.scanned < cap) {
    const orphans = coord._all(
      `SELECT e.occurrence_id FROM d6_execution_records e
        LEFT JOIN d6_binding_projections p
          ON p.occurrence_id = e.occurrence_id
        WHERE e.state = 'committed' AND p.occurrence_id IS NULL
        ORDER BY e.updated_at, e.occurrence_id LIMIT ?`, cap - out.scanned);
    for (const row of orphans)
      tally(noteCommitted(coord, { occurrenceId: row.occurrence_id }));
  }
  return out;
}
