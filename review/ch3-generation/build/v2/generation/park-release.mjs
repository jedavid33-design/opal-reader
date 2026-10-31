// Ch 3 mechanisms (CH3-GENERATION-PROPOSAL-v2 §5A / §5A.2 / §5B /
// §11) — the park release and the chapter-occurrence exemption: the
// two operator-only, audited, reversible fence adjustments that let
// the parked Forever Pucked Chapter 3 job's occurrences be generated
// WITHOUT touching the parked job, its FSM, or any plan.
//
//   * d6_park_releases (§5A): one audited release row per act, naming
//     the parked job + an enumerated occurrence-id set, every id
//     provably inside the job's DEFINITION set (§5A.2). A live
//     release subtracts exactly its ids from the parked entry fence.
//   * d6_chapter_exemptions (§5B): one audited row per exempted
//     occurrence, admissible ONLY for an occurrence provably OUTSIDE
//     the definition set (the beyond-definition set). A live
//     exemption makes that occurrence skip BOTH parked dispositions
//     in the eligible-set builder.
//
// The two mechanisms PARTITION the fenced set and never overlap
// (§11): the release refuses any id outside the definition set
// (park_release_outside_definition) — idx 26 is refused by
// construction, today and under any future release call — and the
// exemption refuses every definition member
// (chapter_exemption_inside_definition). Each route also refuses
// ids the other mechanism currently covers (mutual exclusion).
//
// Schema discipline (proposal §5C + the C2 pin "GEN_SCHEMA is closed
// at exactly eight d6_* tables"): these tables are NOT in
// gen-schema.mjs. They bootstrap lazily, DDL-only and idempotent,
// inside this module — the house pattern for every post-genesis
// table (d6_quarantine_holds, d6_provider_dispatches,
// d6_billing_adjudications). With both tables absent or empty the
// generation plane is byte-identical to the unmodified build: the
// fence-consumption reads below are throw-safe on a missing table
// (absence reads as exactly "no records" — the quota design's D1
// cold-start discipline), while genuine database errors still
// surface. Writers ensure the schema first and then read strictly.
//
// Definition derivation (§5A.2): mechanical, from durable pinned
// records — never from the caller. The approved freeze pin carries,
// per job, an aggregate whose `definition.total` is N and whose
// `occurrences` list is the canonical ordered occurrence list
// (pinned by the aggregate's occurrenceSetSha256). The definition
// set is the FIRST N ids of that list, in order; the
// beyond-definition set is the remainder. The route re-derives at
// call time and cross-checks the pin against the job's live
// identity (jobs row, its stored definition in data_json, and the
// live occurrences rows: id set + states). Any disagreement refuses
// BEFORE any write. The caller's id list is only ever intersected
// with the derived sets, never believed.
//
// Store discipline mirrors quota-budget.mjs / genstore.mjs: store
// functions take `coord`, validate -> named domain refusal objects
// ({ outcome: "rejected", reason }) for every anticipated refusal,
// write inside coord._tx, and let unexpected faults THROW (the
// entry maps them to HTTP 500 — never laundered into a rejection).

export const PARK_RELEASE_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS d6_park_releases (
     release_id INTEGER PRIMARY KEY AUTOINCREMENT,
     job_id TEXT NOT NULL,
     book_id TEXT NOT NULL,
     chapter_index INTEGER NOT NULL,
     occurrence_ids_json TEXT NOT NULL,
     authorization_ref TEXT,
     source TEXT,
     note TEXT,
     released_at INTEGER NOT NULL,
     state TEXT NOT NULL DEFAULT 'live',
     tombstoned_at INTEGER,
     tombstone_authorization_ref TEXT,
     tombstone_source TEXT,
     tombstone_note TEXT
   )`,
  `CREATE TABLE IF NOT EXISTS d6_chapter_exemptions (
     occurrence_id TEXT PRIMARY KEY,
     job_id TEXT NOT NULL,
     book_id TEXT NOT NULL,
     chapter_index INTEGER NOT NULL,
     authorization_ref TEXT,
     source TEXT,
     note TEXT,
     created_at INTEGER NOT NULL,
     tombstoned INTEGER NOT NULL DEFAULT 0,
     tombstoned_at INTEGER,
     tombstone_authorization_ref TEXT,
     tombstone_source TEXT,
     tombstone_note TEXT
   )`,
];

export const PARK_RELEASE_SCHEMA_SQL = PARK_RELEASE_SCHEMA.join(";\n") + ";";

export function ensureParkReleaseSchema(sql) {
  // DDL-only + idempotent: safe to run on every write path.
  sql.exec(PARK_RELEASE_SCHEMA_SQL);
}

const rejected = (reason, extra = {}) => ({ outcome: "rejected", reason, ...extra });
const isNonblankString = (v) => typeof v === "string" && v.trim().length > 0;

// Throw-safe single-row read for READ-ONLY fence-consumption paths:
// a not-yet-created table reads as "no row" (absence is exactly
// zero/none); any other database error is rethrown (D8-1 discipline,
// mirroring quarantineHoldRowSafe in quarantine.mjs). Never use this
// on a write path — writers ensure the schema and then read strictly.
function readRowSafe(coord, query, ...params) {
  try {
    const rows = coord.sql.exec(query, ...params).toArray();
    return rows.length ? rows[0] : null;
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) return null;
    throw e;
  }
}

function readAllSafe(coord, query, ...params) {
  try {
    return coord.sql.exec(query, ...params).toArray();
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) return [];
    throw e;
  }
}

// ------------------------------------------------------------------
// Views (read-back shapes; the entry returns these verbatim).

export function parkReleaseView(row) {
  if (!row) return null;
  let occurrenceIds = [];
  try {
    const parsed = JSON.parse(row.occurrence_ids_json || "[]");
    if (Array.isArray(parsed)) occurrenceIds = parsed;
  } catch { /* a corrupt stored set reads as empty, never invented */ }
  return {
    releaseId: row.release_id,
    jobId: row.job_id,
    bookId: row.book_id,
    chapterIndex: row.chapter_index,
    occurrenceIds,
    authorizationRef: row.authorization_ref ?? null,
    source: row.source ?? null,
    note: row.note ?? null,
    releasedAt: row.released_at,
    state: row.state,
    tombstonedAt: row.tombstoned_at ?? null,
    tombstoneAuthorizationRef: row.tombstone_authorization_ref ?? null,
    tombstoneSource: row.tombstone_source ?? null,
    tombstoneNote: row.tombstone_note ?? null,
  };
}

export function chapterExemptionView(row) {
  if (!row) return null;
  return {
    occurrenceId: row.occurrence_id,
    jobId: row.job_id,
    bookId: row.book_id,
    chapterIndex: row.chapter_index,
    authorizationRef: row.authorization_ref ?? null,
    source: row.source ?? null,
    note: row.note ?? null,
    createdAt: row.created_at,
    tombstoned: !!row.tombstoned,
    tombstonedAt: row.tombstoned_at ?? null,
    tombstoneAuthorizationRef: row.tombstone_authorization_ref ?? null,
    tombstoneSource: row.tombstone_source ?? null,
    tombstoneNote: row.tombstone_note ?? null,
  };
}

// ------------------------------------------------------------------
// Reads.

// The job's most recent release row (live or tombstoned), or null.
// Strict read: callers ensure the schema first.
export function getParkRelease(coord, jobId) {
  return coord._oneOrNull(
    `SELECT * FROM d6_park_releases WHERE job_id = ?
      ORDER BY release_id DESC LIMIT 1`, jobId);
}

export function liveParkReleaseRow(coord, jobId) {
  const row = getParkRelease(coord, jobId);
  return row && row.state === "live" ? row : null;
}

export function getChapterExemption(coord, occurrenceId) {
  return coord._oneOrNull(
    `SELECT * FROM d6_chapter_exemptions WHERE occurrence_id = ?`, occurrenceId);
}

export function liveChapterExemptionRow(coord, occurrenceId) {
  const row = getChapterExemption(coord, occurrenceId);
  return row && !row.tombstoned ? row : null;
}

// Fence consumption for the content-plane adapter: the parked job's
// live released ids + live exempted ids. Absence-tolerant by design
// (see the header): with the tables absent or empty both sets are
// empty and the plane is unchanged. Reads are keyed by the parked
// job's id, matching how parkedJobOf keys the entry fence.
export function liveParkFenceRecords(coord, jobId) {
  const releasedIds = new Set();
  const release = readRowSafe(coord,
    `SELECT occurrence_ids_json FROM d6_park_releases
      WHERE job_id = ? AND state = 'live'
      ORDER BY release_id DESC LIMIT 1`, jobId);
  if (release) {
    try {
      const parsed = JSON.parse(release.occurrence_ids_json || "[]");
      if (Array.isArray(parsed))
        for (const id of parsed) if (typeof id === "string") releasedIds.add(id);
    } catch { /* corrupt set contributes nothing; writers never produce one */ }
  }
  const exemptIds = new Set(readAllSafe(coord,
    `SELECT occurrence_id FROM d6_chapter_exemptions
      WHERE job_id = ? AND tombstoned = 0`, jobId)
    .map(r => r.occurrence_id));
  return { releasedIds, exemptIds };
}

// ------------------------------------------------------------------
// Definition derivation (§5A.2). Pure with respect to the store:
// reads the pinned carry (via the coordinator's own accessor, so a
// test/env carry override is honored exactly as production reads
// it), the jobs row's stored definition, and the live occurrence
// rows — and refuses on any disagreement.
//
// Returns { ok: true, jobId, bookId, chapterIndex, total,
//   orderedIds, definitionIds, definitionSet, beyondIds, beyondSet }
// or { ok: false, reason } with reason one of:
//   park_definition_unpinned  — no pinned aggregate for this job
//   park_definition_malformed — pin/stored definition shape invalid
//   park_definition_mismatch  — pin and live identity disagree
export function deriveParkDefinition(coord, job) {
  const carry = typeof coord._carryBook === "function"
    ? coord._carryBook(job.book_id) : null;
  const aggregates = carry && carry.jobs && Array.isArray(carry.jobs.aggregates)
    ? carry.jobs.aggregates : [];
  const agg = aggregates.find(a => a && a.jobId === job.job_id) || null;
  if (!agg) return { ok: false, reason: "park_definition_unpinned" };

  const def = agg.definition || null;
  const occurrences = Array.isArray(agg.occurrences) ? agg.occurrences : null;
  if (!def || !occurrences || occurrences.length === 0)
    return { ok: false, reason: "park_definition_malformed" };
  const total = def.total;
  if (!Number.isSafeInteger(total) || total < 1 || total > occurrences.length)
    return { ok: false, reason: "park_definition_malformed" };
  const orderedIds = occurrences.map(o => (o && typeof o.occurrenceId === "string")
    ? o.occurrenceId : null);
  if (orderedIds.some(id => !id) || new Set(orderedIds).size !== orderedIds.length)
    return { ok: false, reason: "park_definition_malformed" };

  // Pin-internal identity + pin-vs-live-job agreement.
  if (agg.chapterIndex !== job.chapter_index
    || def.job_id !== job.job_id
    || def.book_id !== job.book_id
    || def.chapter_index !== job.chapter_index)
    return { ok: false, reason: "park_definition_mismatch" };

  // The stored definition (jobs.data_json) must corroborate the pin:
  // same job/book/chapter identity and the same total.
  let stored = null;
  try { stored = job.data_json ? JSON.parse(job.data_json) : null; }
  catch { return { ok: false, reason: "park_definition_malformed" }; }
  if (!stored || typeof stored !== "object"
    || stored.job_id !== job.job_id
    || stored.book_id !== job.book_id
    || stored.chapter_index !== job.chapter_index
    || stored.total !== total)
    return { ok: false, reason: "park_definition_mismatch" };

  // The live occurrence rows must be exactly the pinned list: same
  // id set, same per-id state.
  const liveRows = coord._all(
    `SELECT occurrence_id, state FROM occurrences WHERE job_id = ?`, job.job_id);
  const liveById = new Map(liveRows.map(r => [r.occurrence_id, r.state]));
  if (liveById.size !== orderedIds.length)
    return { ok: false, reason: "park_definition_mismatch" };
  for (const occ of occurrences) {
    if (!liveById.has(occ.occurrenceId)
      || liveById.get(occ.occurrenceId) !== occ.state)
      return { ok: false, reason: "park_definition_mismatch" };
  }

  const definitionIds = orderedIds.slice(0, total);
  const beyondIds = orderedIds.slice(total);
  return {
    ok: true,
    jobId: job.job_id,
    bookId: job.book_id,
    chapterIndex: job.chapter_index,
    total,
    orderedIds,
    definitionIds,
    definitionSet: new Set(definitionIds),
    beyondIds,
    beyondSet: new Set(beyondIds),
  };
}

// Shared fence preamble for both routes: the job must exist, be the
// parked job, and carry a derivable definition. Returns
// { job, derived } or { refusal }.
function parkedJobAndDefinition(coord, jobId, refusalPrefix) {
  const job = coord._oneOrNull(`SELECT * FROM jobs WHERE job_id = ?`, jobId);
  if (!job) return { refusal: rejected(`${refusalPrefix}_job_not_found`, { jobId }) };
  if (job.state !== "parked_policy")
    return { refusal: rejected(`${refusalPrefix}_job_not_parked`, { jobId }) };
  const derived = deriveParkDefinition(coord, job);
  if (!derived.ok) return { refusal: rejected(derived.reason, { jobId }) };
  return { job, derived };
}

// ------------------------------------------------------------------
// POST /v2/d6-release-park (§5A) — write the audited release.
//
// Fences, in order, all BEFORE any write: job exists + parked (§5A
// preamble); definition derivable (§5A.2); set non-empty and
// duplicate-free; every id is a row of THIS job; every id is a
// PENDING row of the job (bound/ready rows can never be released);
// every id is inside the definition set
// (park_release_outside_definition — the mechanical idx-26 refusal);
// no id is covered by a live exemption (mutual exclusion); no live
// release with a different set exists (conflict). An identical
// re-release against the live row is an idempotent no-op success.
export function releasePark(coord, { jobId, occurrenceIds, authorizationRef, source, note } = {}) {
  if (!isNonblankString(jobId))
    return rejected("park_release_job_required");
  if (!Array.isArray(occurrenceIds))
    return rejected("park_release_set_invalid");
  ensureParkReleaseSchema(coord.sql);
  // Validate + write atomically (the bootstrapQuota shape): every
  // fence reads and the insert share one transaction, so the state
  // the fences validated is the state the write lands on.
  let result = null;
  coord._tx(() => {
    const pre = parkedJobAndDefinition(coord, jobId, "park_release");
    if (pre.refusal) { result = pre.refusal; return; }
    const { job, derived } = pre;

    if (occurrenceIds.length === 0) {
      result = rejected("park_release_set_empty", { jobId }); return;
    }
    if (occurrenceIds.some(id => !isNonblankString(id))) {
      result = rejected("park_release_set_invalid", { jobId }); return;
    }
    if (new Set(occurrenceIds).size !== occurrenceIds.length) {
      result = rejected("park_release_set_duplicate", { jobId }); return;
    }

    const rowsById = new Map(coord._all(
      `SELECT occurrence_id, state FROM occurrences WHERE job_id = ?`, jobId)
      .map(r => [r.occurrence_id, r]));
    for (const id of occurrenceIds) {
      if (!rowsById.has(id)) {
        result = rejected("park_release_occurrence_not_in_job",
          { jobId, occurrenceId: id }); return;
      }
    }
    for (const id of occurrenceIds) {
      if (rowsById.get(id).state !== "pending") {
        result = rejected("park_release_occurrence_not_pending",
          { jobId, occurrenceId: id }); return;
      }
    }
    for (const id of occurrenceIds) {
      if (!derived.definitionSet.has(id)) {
        result = rejected("park_release_outside_definition",
          { jobId, occurrenceId: id }); return;
      }
    }
    for (const id of occurrenceIds) {
      if (liveChapterExemptionRow(coord, id)) {
        result = rejected("park_release_occurrence_exempted",
          { jobId, occurrenceId: id }); return;
      }
    }

    // Store the set in DEFINITION ORDER (deterministic read-back);
    // idempotency compares as sets.
    const orderedSet = derived.definitionIds.filter(id => occurrenceIds.includes(id));
    const existing = liveParkReleaseRow(coord, jobId);
    if (existing) {
      const existingIds = parkReleaseView(existing).occurrenceIds;
      if (existingIds.length === orderedSet.length
        && existingIds.every(id => orderedSet.includes(id))) {
        result = {
          outcome: "applied", alreadyReleased: true, jobId,
          occurrenceIds: orderedSet, release: parkReleaseView(existing),
        };
      } else {
        result = rejected("park_release_conflict", { jobId });
      }
      return;
    }

    coord.sql.exec(
      `INSERT INTO d6_park_releases
         (job_id, book_id, chapter_index, occurrence_ids_json,
          authorization_ref, source, note, released_at, state)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'live')`,
      jobId, job.book_id, job.chapter_index, JSON.stringify(orderedSet),
      authorizationRef ?? null, source ?? null, note ?? null, coord._now());
    result = {
      outcome: "applied", alreadyReleased: false, jobId,
      occurrenceIds: orderedSet, release: parkReleaseView(getParkRelease(coord, jobId)),
    };
  });
  return result;
}

// POST /v2/d6-revoke-park-release (§5A tombstone) — tombstone the
// job's live release. Tombstoning restores the fence EXACTLY: the
// released ids return to their parked dispositions on the next plane
// build, byte-identical to the pre-release output. The row is never
// deleted (audit). Revoking an already-tombstoned release is an
// idempotent no-op; no release row at all refuses
// park_release_not_found.
export function revokeParkRelease(coord, { jobId, authorizationRef, source, note } = {}) {
  if (!isNonblankString(jobId))
    return rejected("park_release_job_required");
  ensureParkReleaseSchema(coord.sql);
  let result = null;
  coord._tx(() => {
    const row = getParkRelease(coord, jobId);
    if (!row) { result = rejected("park_release_not_found", { jobId }); return; }
    if (row.state === "tombstoned") {
      result = {
        outcome: "applied", alreadyRevoked: true, jobId,
        release: parkReleaseView(row),
      };
      return;
    }
    coord.sql.exec(
      `UPDATE d6_park_releases
          SET state = 'tombstoned', tombstoned_at = ?,
              tombstone_authorization_ref = ?, tombstone_source = ?,
              tombstone_note = ?
        WHERE release_id = ?`,
      coord._now(), authorizationRef ?? null, source ?? null, note ?? null,
      row.release_id);
    result = {
      outcome: "applied", alreadyRevoked: false, jobId,
      release: parkReleaseView(getParkRelease(coord, jobId)),
    };
  });
  return result;
}

// ------------------------------------------------------------------
// POST /v2/d6-exempt-chapter-occurrence (§5B) — write the audited
// singleton exemption.
//
// Fences, in order, all BEFORE any write: job exists + parked;
// definition derivable; the occurrence is a row of THIS job; the
// occurrence is OUTSIDE the definition set — a definition member
// refuses chapter_exemption_inside_definition; the occurrence is
// unbound (no bindings row); the occurrence is not covered by a live
// release (mutual exclusion). A duplicate exemption against the live
// row is an idempotent no-op success; re-exempting a tombstoned row
// reactivates it under the new authorization, keeping the prior
// tombstone audit fields on the row as the record of the most
// recent reversal (the `tombstoned` flag alone carries the CURRENT
// state).
export function exemptChapterOccurrence(coord, { jobId, occurrenceId, authorizationRef, source, note } = {}) {
  if (!isNonblankString(jobId))
    return rejected("chapter_exemption_job_required");
  if (!isNonblankString(occurrenceId))
    return rejected("chapter_exemption_occurrence_required");
  ensureParkReleaseSchema(coord.sql);
  // Validate + write atomically (as releasePark above).
  let result = null;
  coord._tx(() => {
    const pre = parkedJobAndDefinition(coord, jobId, "chapter_exemption");
    if (pre.refusal) { result = pre.refusal; return; }
    const { job, derived } = pre;

    const occRow = coord._oneOrNull(
      `SELECT occurrence_id, state FROM occurrences
        WHERE job_id = ? AND occurrence_id = ?`, jobId, occurrenceId);
    if (!occRow) {
      result = rejected("chapter_exemption_occurrence_not_in_job",
        { jobId, occurrenceId }); return;
    }
    if (derived.definitionSet.has(occurrenceId)) {
      result = rejected("chapter_exemption_inside_definition",
        { jobId, occurrenceId }); return;
    }
    const bound = coord._oneOrNull(
      `SELECT occurrence_id FROM bindings WHERE occurrence_id = ?`, occurrenceId);
    if (bound) {
      result = rejected("chapter_exemption_occurrence_bound",
        { jobId, occurrenceId }); return;
    }
    const release = liveParkReleaseRow(coord, jobId);
    if (release && parkReleaseView(release).occurrenceIds.includes(occurrenceId)) {
      result = rejected("chapter_exemption_occurrence_released",
        { jobId, occurrenceId }); return;
    }

    const existing = getChapterExemption(coord, occurrenceId);
    if (existing && !existing.tombstoned) {
      if (existing.job_id !== jobId) {
        result = rejected("chapter_exemption_conflict", { jobId, occurrenceId });
      } else {
        result = {
          outcome: "applied", alreadyExempted: true, jobId, occurrenceId,
          exemption: chapterExemptionView(existing),
        };
      }
      return;
    }
    const now = coord._now();
    if (existing) {
      // Reactivation: refresh the live fields; the prior tombstone
      // audit fields stay on the row (most-recent-reversal record).
      coord.sql.exec(
        `UPDATE d6_chapter_exemptions
            SET job_id = ?, book_id = ?, chapter_index = ?,
                authorization_ref = ?, source = ?, note = ?,
                created_at = ?, tombstoned = 0
          WHERE occurrence_id = ?`,
        jobId, job.book_id, job.chapter_index,
        authorizationRef ?? null, source ?? null, note ?? null, now,
        occurrenceId);
    } else {
      coord.sql.exec(
        `INSERT INTO d6_chapter_exemptions
           (occurrence_id, job_id, book_id, chapter_index,
            authorization_ref, source, note, created_at, tombstoned)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        occurrenceId, jobId, job.book_id, job.chapter_index,
        authorizationRef ?? null, source ?? null, note ?? null, now);
    }
    result = {
      outcome: "applied", alreadyExempted: false, jobId, occurrenceId,
      exemption: chapterExemptionView(getChapterExemption(coord, occurrenceId)),
    };
  });
  return result;
}

// POST /v2/d6-revoke-chapter-exemption (§5B tombstone) — tombstone
// the singleton exemption, restoring BOTH parked fences for the
// occurrence exactly. Idempotent on an already-tombstoned row; no
// row (or a row under a different job) refuses
// chapter_exemption_not_found.
export function revokeChapterExemption(coord, { jobId, occurrenceId, authorizationRef, source, note } = {}) {
  if (!isNonblankString(jobId))
    return rejected("chapter_exemption_job_required");
  if (!isNonblankString(occurrenceId))
    return rejected("chapter_exemption_occurrence_required");
  ensureParkReleaseSchema(coord.sql);
  let result = null;
  coord._tx(() => {
    const row = getChapterExemption(coord, occurrenceId);
    if (!row || row.job_id !== jobId) {
      result = rejected("chapter_exemption_not_found", { jobId, occurrenceId });
      return;
    }
    if (row.tombstoned) {
      result = {
        outcome: "applied", alreadyRevoked: true, jobId, occurrenceId,
        exemption: chapterExemptionView(row),
      };
      return;
    }
    coord.sql.exec(
      `UPDATE d6_chapter_exemptions
          SET tombstoned = 1, tombstoned_at = ?,
              tombstone_authorization_ref = ?, tombstone_source = ?,
              tombstone_note = ?
        WHERE occurrence_id = ?`,
      coord._now(), authorizationRef ?? null, source ?? null, note ?? null,
      occurrenceId);
    result = {
      outcome: "applied", alreadyRevoked: false, jobId, occurrenceId,
      exemption: chapterExemptionView(getChapterExemption(coord, occurrenceId)),
    };
  });
  return result;
}
