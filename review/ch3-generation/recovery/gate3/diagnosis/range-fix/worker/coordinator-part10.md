        diverge("positions", "audit_payload_hash", posAudit.payload_hash, null);
      if (!receiptOk(posAudit, "MigrateImportPositions")) missing.push("positions_receipt");
      const st = this._oneOrNull(`SELECT * FROM position_state WHERE book_id = ?`, bookId);
      if (!st) missing.push("position_state");
      else {
        if (st.occurrence_id !== pin.position.occurrenceId)
          diverge("positions", "occurrence_id", pin.position.occurrenceId, st.occurrence_id);
        if (st.offset_sec !== pin.position.offsetSec)
          diverge("positions", "offset_sec", pin.position.offsetSec, st.offset_sec);
        const wantIdx = occIds.indexOf(pin.position.occurrenceId);
        if (st.occ_index !== wantIdx)
          diverge("positions", "occ_index", wantIdx, st.occ_index);
        // B1-C2 (Rowan B1 review 6369823670): the truthful
        // no-playback baseline. The carried state is the book's
        // OPENING state in v2 — not playing, journal tip 0,
        // nothing superseded — and the position journal for the
        // book is EMPTY: any event row means v2 playback history
        // exists that the frozen record does not account for, and
        // the position the gate would certify is no longer purely
        // the carried one. SCOPE, exactly as bounded in review:
        // this baseline is a condition of the MIGRATION GATE's
        // carry verification only (the D4 pre-flip state). It is
        // NOT a playback restriction — nothing in the position
        // event path consults it, PushPositionEvents keeps its
        // ordinary semantics, and after the flip (D5) genuine
        // device events fold onto the carried state by the normal
        // causality rules, tip advancing from 0 as on any book.
        if (st.playing !== 0)
          diverge("positions", "playing", 0, st.playing);
        if (st.tip !== 0)
          diverge("positions", "tip", 0, st.tip);
        if (st.superseded_count !== 0)
          diverge("positions", "superseded_count", 0, st.superseded_count);
        const journalRows = this._all(
          `SELECT event_id FROM position_events WHERE book_id = ?`, bookId).length;
        if (journalRows !== 0)
          diverge("positions", "position_events", 0, journalRows);
        // The stored state, folded with the audit's verbatim
        // checkpoints, must recompute to the audit's hash (which
        // must equal the pin's): a tampered stored row or a
        // tampered audit both surface here.
        let recomputed = null;
        try {
          const audited = JSON.parse(posAudit.payload_json);
          recomputed = sha256HexText(canonicalJson({ bookId,
            position: { occurrenceId: st.occurrence_id, offsetSec: st.offset_sec },
            checkpoints: audited.checkpoints }));
        } catch { recomputed = null; }
        if (recomputed !== posAudit.payload_hash)
          diverge("positions", "stored_payload_hash", posAudit.payload_hash, recomputed);
      }
      let auditedCheckpoints = null;
      try { auditedCheckpoints = JSON.parse(posAudit.payload_json).checkpoints; }
      catch { auditedCheckpoints = null; }
      positions = { carried: true, commandId: posAudit.command_id,
        payloadSha256: posAudit.payload_hash,
        pinned: { occurrenceId: pin.position.occurrenceId,
                  occIndex: occIds.indexOf(pin.position.occurrenceId),
                  offsetSec: pin.position.offsetSec },
        stored: st ? { occurrenceId: st.occurrence_id, occIndex: st.occ_index,
                       offsetSec: st.offset_sec } : null,
        checkpoints: auditedCheckpoints };
    }
    // ---- jobs: audit descriptor + stored rows + pin, three-way.
    let jobs = null;
    const jobsAudit = this._carryAuditRow(bookId, "jobs");
    if (!jobsAudit) missing.push("jobs_carry");
    else {
      if (jobsAudit.payload_hash !== pin.jobs.setSha256)
        diverge("jobs", "set_hash", pin.jobs.setSha256, jobsAudit.payload_hash);
      let auditIntact = false;
      try { auditIntact = sha256HexText(jobsAudit.payload_json) === jobsAudit.payload_hash; }
      catch { auditIntact = false; }
      if (!auditIntact)
        diverge("jobs", "audit_payload_hash", jobsAudit.payload_hash, null);
      if (!receiptOk(jobsAudit, "MigrateImportJobs")) missing.push("jobs_receipt");
      let auditedDescriptor = null;
      try { auditedDescriptor = JSON.parse(jobsAudit.payload_json); }
      catch { auditedDescriptor = null; }
      const auditedByJob = new Map((auditedDescriptor || []).map(d => [d.jobId, d]));
      const pinByJob = new Map(pin.jobs.aggregates.map(a => [a.jobId, a]));
      const storedJobs = this._all(`SELECT * FROM jobs WHERE book_id = ? ORDER BY job_id`, bookId);
      for (const row of storedJobs)
        if (!pinByJob.has(row.job_id))
          diverge("jobs", "unexpected_job", null, row.job_id);
      const aggregates = [];
      for (const pinAgg of pin.jobs.aggregates) {
        const row = storedJobs.find(r => r.job_id === pinAgg.jobId);
        if (!row) { diverge("jobs", "missing_job", pinAgg.jobId, null, pinAgg.jobId); continue; }
        if (row.state !== pinAgg.v2State)
          diverge("jobs", "state", pinAgg.v2State, row.state, pinAgg.jobId);
        // B1-C2 (Rowan B1 review 6369823670): the COMPLETE stored
        // row is verified, not just its digests — every column of
        // the stored aggregate against the pinned descriptor
        // (which supplies kind, lane, and chapterIndex for every
        // aggregate). A row whose definition still recomputes but
        // whose kind/lane/chapter/revision/book was rewritten is
        // not the carried aggregate.
        if (row.kind !== pinAgg.kind)
          diverge("jobs", "kind", pinAgg.kind, row.kind, pinAgg.jobId);
        if (row.lane !== pinAgg.lane)
          diverge("jobs", "lane", pinAgg.lane, row.lane, pinAgg.jobId);
        if (row.chapter_index !== pinAgg.chapterIndex)
          diverge("jobs", "chapter_index", pinAgg.chapterIndex,
            row.chapter_index, pinAgg.jobId);
        if (row.revision !== 1)
          diverge("jobs", "revision", 1, row.revision, pinAgg.jobId);
        if (row.book_id !== bookId)
          diverge("jobs", "book_id", bookId, row.book_id, pinAgg.jobId);
        let defDigest = null;
        try { defDigest = sha256HexText(canonicalJson(JSON.parse(row.data_json || "{}"))); }
        catch { defDigest = null; }
        if (defDigest !== pinAgg.definitionDigest)
          diverge("jobs", "definition_digest", pinAgg.definitionDigest, defDigest, pinAgg.jobId);
        const audited = auditedByJob.get(pinAgg.jobId);
        if (!audited || audited.definitionDigest !== pinAgg.definitionDigest)
          diverge("jobs", "audit_definition_digest", pinAgg.definitionDigest,
            audited ? audited.definitionDigest : null, pinAgg.jobId);
        const occRows = this._all(
          `SELECT * FROM occurrences WHERE job_id = ? ORDER BY rowid`, pinAgg.jobId)
          .map(r => ({ occurrenceId: r.occurrence_id, revisionKey: r.revision_key, state: r.state }));
        const occDigest = sha256HexText(canonicalJson(occRows));
        if (occDigest !== pinAgg.occurrenceSetSha256)
          diverge("jobs", "occurrence_set_digest", pinAgg.occurrenceSetSha256, occDigest, pinAgg.jobId);
        if (!audited || audited.occurrenceSetSha256 !== pinAgg.occurrenceSetSha256)
          diverge("jobs", "audit_occurrence_set_digest", pinAgg.occurrenceSetSha256,
            audited ? audited.occurrenceSetSha256 : null, pinAgg.jobId);
        aggregates.push({ jobId: pinAgg.jobId, state: row.state,
          chapterIndex: row.chapter_index, definitionDigest: defDigest,
          occurrenceSetSha256: occDigest,
          definitionVerified: defDigest === pinAgg.definitionDigest &&
            occDigest === pinAgg.occurrenceSetSha256 });
      }
      jobs = { carried: true, commandId: jobsAudit.command_id,
        setSha256: jobsAudit.payload_hash, pinnedCount: pin.jobs.count,
        storedCount: storedJobs.length, aggregates };
    }
    return { applicable: true,
             ok: missing.length === 0 && divergences.length === 0,
             positions, jobs, missing, divergences };
  }

  // Read-back surface for the flip fence (design §4, lock 2):
  // SELECT-only, safe on the read-only facade.
  migrationBookView(bookId) {
    const contentEnt = this._syncEntity("content", bookId);
    const book = this._oneOrNull(`SELECT * FROM migration_books WHERE book_id = ?`, bookId);
    const gate = this._oneOrNull(`SELECT * FROM migration_gates WHERE book_id = ?`, bookId);
    const syncBindings = this._all(
      `SELECT * FROM sync_entities WHERE family = 'bindings' AND book_id = ? ORDER BY entity_key`, bookId)
      .map(e => ({ entityKey: e.entity_key,
                   occurrenceId: e.entity_key.slice(bookId.length + 1),
                   revision: e.revision, tombstone: !!e.deleted,
                   data: e.data_json ? JSON.parse(e.data_json) : null }));
    const expected = book ? JSON.parse(book.rows_json) : [];
    const sqlBindings = [], cacheAnchors = [], seenKeys = new Set();
    for (const row of expected) {
      const b = this._oneOrNull(
        `SELECT * FROM bindings WHERE occurrence_id = ? AND revision_key = ?`,
        row.occurrenceId, row.revisionKey);
      sqlBindings.push({ occurrenceId: row.occurrenceId, revisionKey: row.revisionKey,
        cacheKey: b ? b.cache_key : null, provenance: b ? b.provenance : null });
      if (seenKeys.has(row.cacheKey)) continue;
      seenKeys.add(row.cacheKey);
      const idx = this._oneOrNull(`SELECT * FROM cache_index WHERE cache_key = ?`, row.cacheKey);
      cacheAnchors.push({ cacheKey: row.cacheKey, identity: idx ? idx.identity : null,
        sha256: idx ? idx.sha256 : null, format: idx ? idx.format : null });
    }
    const chk = this._migrationCompleteness(bookId);
    return { bookId,
      content: contentEnt ? { revision: contentEnt.revision,
        tombstone: !!contentEnt.deleted,
        occurrenceIds: (JSON.parse(contentEnt.data_json || "{}").occurrenceIds) || [] } : null,
      importRecord: book ? { migrationId: book.migration_id,
        freezeDigest: book.freeze_digest, rowCount: book.row_count,
        rowsSha256: book.rows_sha256, importedAt: book.imported_at,
        certificateSha256: book.certificate_sha256 ?? null } : null,
      pinnedFreeze: (() => { const pb = this._pinnedBook(bookId);
        return pb ? { inApprovedFreeze: true, rowSetSha256: pb.rowSetSha256 }
                  : { inApprovedFreeze: false, rowSetSha256: null }; })(),
      // D3: chunked-import progress for this book (null when the
      // chunked flow never touched it). Partial progress is
      // reported here — an operator surface — while the sync plane
      // above stays empty until completion.
      chunkedImport: (() => {
        const imp = this._oneOrNull(
          `SELECT * FROM migration_imports WHERE book_id = ?`, bookId);
        if (!imp) return null;
        const applied = this._all(
          `SELECT chunk_index FROM migration_chunks WHERE book_id = ? ORDER BY chunk_index`,
          bookId).map(r => r.chunk_index);
        return { migrationId: imp.migration_id, freezeDigest: imp.freeze_digest,
          chunksExpected: imp.chunks_expected, chunksApplied: applied,
          complete: !!imp.completed_at,
          certificateSha256: imp.certificate_sha256 ?? null };
      })(),
      syncBindings, sqlBindings, cacheAnchors,
      gate: gate ? { flipped: true, migrationId: gate.migration_id,
        certificateSha256: gate.certificate_sha256, flippedAt: gate.flipped_at } : null,
      completeness: { complete: chk.complete, missing: chk.missing,
        divergences: chk.divergences },
      // B1 (§3A.4/§3A.5): the carry read-back — positions (the
      // operational positionView + the audit's verbatim payload)
      // and jobs (per-aggregate state PLUS the audit-based
      // definition verification of §3A.5: digests recomputed from
      // the stored rows, required to equal the audit and the
      // pin). Null for books outside the carry pin's freeze.
      carry: (() => {
        if (!this._carryBook(bookId)) return null;
        const v = this._migrationCarryVerification(bookId);
        return { applicable: true, ok: v.ok,
          missing: v.missing, divergences: v.divergences,
          positions: v.positions
            ? { ...v.positions, view: this.positionView(bookId) } : null,
          jobs: v.jobs,
          gatePreconditions: {
            bindingsComplete: chk.complete,
            positionsCarried: !!v.positions && !v.missing.includes("positions_carry"),
            jobsCarried: !!v.jobs && !v.missing.includes("jobs_carry"),
            carryVerified: v.ok,
            ready: chk.complete && v.ok } };
      })() };
  }

  // Position events: append-only journal, deterministic fold.
  // Event identity is (bookId, eventId) WITH payload equivalence:
  // the same id carrying a different payload is a conflict, never
  // a silent replay (Rowan invariant 2).
  _pushPositionEvents(p, commandId) {
    const bookId = p.bookId;
    const events = Array.isArray(p.events) ? p.events : [];
    if (this._bookTombstoned(bookId))
      return { outcome: "applied", bookId,
               outcomes: events.map(ev => ({ eventId: ev.eventId, status: "rejected", reason: "tombstoned" })) };
    const content = this._syncEntity("content", bookId);
    if (!content || content.deleted)
      return { outcome: "rejected", reason: "unknown_book", bookId };
    const occIds = (JSON.parse(content.data_json || "{}").occurrenceIds) || [];
    const outcomes = events.map(ev => this._appendPositionEvent(bookId, occIds, ev));
    return { outcome: "applied", bookId, outcomes };
  }

  _appendPositionEvent(bookId, occIds, ev) {
    const canonical = JSON.stringify({
      deviceId: ev.deviceId, localSeq: ev.localSeq, kind: ev.kind,
      occurrenceId: ev.occurrenceId, offsetSec: ev.offsetSec, baseSeq: ev.baseSeq });
    const prior = this._oneOrNull(
      `SELECT * FROM position_events WHERE book_id = ? AND event_id = ?`, bookId, ev.eventId);
    if (prior) {
      return prior.payload_json === canonical
        ? { eventId: ev.eventId, status: "replay", receiptSeq: prior.receipt_seq, superseded: !!prior.superseded }
        : { eventId: ev.eventId, status: "conflict", reason: "event_id_payload_mismatch" };
    }
    const st = this._oneOrNull(`SELECT * FROM position_state WHERE book_id = ?`, bookId)
      || { occurrence_id: null, occ_index: null, offset_sec: null, playing: 0, tip: 0, superseded_count: 0 };
    if (typeof ev.baseSeq !== "number" || ev.baseSeq > st.tip)
      return { eventId: ev.eventId, status: "rejected", reason: "base_ahead" };
    const idx = occIds.indexOf(ev.occurrenceId);
    if (idx < 0) return { eventId: ev.eventId, status: "rejected", reason: "unknown_occurrence" };
    if (typeof ev.offsetSec !== "number" || !(ev.offsetSec >= 0))
      return { eventId: ev.eventId, status: "rejected", reason: "invalid_offset" };
    if (!["play", "pause", "seek", "checkpoint"].includes(ev.kind))
      return { eventId: ev.eventId, status: "rejected", reason: "invalid_kind" };
    // Staleness is causal, never clock-based: an event created
    // against an older journal tip is stale. A stale event that
    // would move canonical position BACKWARD is recorded but
    // superseded; stale-forward and fresh events fold normally
    // (a deliberate re-read on a synced device is fresh, so it
    // always applies).
    const stale = ev.baseSeq < st.tip;
    const backward = st.occ_index !== null &&
      (idx < st.occ_index || (idx === st.occ_index && ev.offsetSec < st.offset_sec));
    const superseded = stale && backward;
    const receiptSeq = st.tip + 1;
    this.sql.exec(`INSERT INTO position_events (book_id, event_id, receipt_seq, device_id, local_seq,
        kind, occurrence_id, offset_sec, base_seq, superseded, payload_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      bookId, ev.eventId, receiptSeq, ev.deviceId, ev.localSeq, ev.kind,
      ev.occurrenceId, ev.offsetSec, ev.baseSeq, superseded ? 1 : 0, canonical);
    let { occurrence_id, occ_index, offset_sec, playing, superseded_count } = st;
    if (!superseded) {
      occurrence_id = ev.occurrenceId; occ_index = idx; offset_sec = ev.offsetSec;
      if (ev.kind === "play") playing = 1;
      if (ev.kind === "pause") playing = 0;
    } else superseded_count += 1;
    this.sql.exec(
      `INSERT INTO position_state (book_id, occurrence_id, occ_index, offset_sec, playing, tip, superseded_count)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(book_id) DO UPDATE SET occurrence_id = excluded.occurrence_id,
         occ_index = excluded.occ_index, offset_sec = excluded.offset_sec,
         playing = excluded.playing, tip = excluded.tip, superseded_count = excluded.superseded_count`,
      bookId, occurrence_id, occ_index, offset_sec, playing, receiptSeq, superseded_count);
    this._appendChange("position", bookId, bookId, receiptSeq, "event",
      { ...ev, receiptSeq, superseded });
    return { eventId: ev.eventId, status: "accepted", receiptSeq, superseded };
  }

  positionView(bookId) {
    const st = this._oneOrNull(`SELECT * FROM position_state WHERE book_id = ?`, bookId);
    if (!st) return { bookId, canonical: null, asOfReceiptSeq: 0, supersededCount: 0, journalGaps: [] };
    const byDevice = new Map();
    for (const r of this._all(
      `SELECT device_id, local_seq FROM position_events WHERE book_id = ? ORDER BY device_id, local_seq`, bookId)) {
      if (!byDevice.has(r.device_id)) byDevice.set(r.device_id, []);
      byDevice.get(r.device_id).push(r.local_seq);
    }
    const journalGaps = [];
    for (const [deviceId, seqs] of byDevice) {
      const present = new Set(seqs);
      const missing = [];
      for (let s = Math.min(...seqs); s <= Math.max(...seqs); s++)
        if (!present.has(s)) missing.push(s);
      if (missing.length) journalGaps.push({ deviceId, missing });
    }
    return { bookId,
             canonical: { occurrenceId: st.occurrence_id, offsetSec: st.offset_sec, playing: !!st.playing },
             asOfReceiptSeq: st.tip, supersededCount: st.superseded_count, journalGaps };
  }

  // Pull: pinned-watermark snapshot window. sinceSeq is EXCLUSIVE;
  // resync triggers only when the cursor fell below the retained
  // floor (sinceSeq < floor - 1) — sinceSeq = 0 against a history
  // starting at 1 is the normal first pull, never a resync.
  pullChanges({ family, sinceSeq = 0, limit = 200, cursor } = {}) {
    if (!SYNC_FAMILIES.includes(family)) return { error: "unknown_family", family };
    let wm;
    if (cursor !== undefined && cursor !== null) {
      if (cursor.family !== family) return { error: "invalid_cursor", reason: "family_mismatch" };
      sinceSeq = cursor.seq; wm = cursor.watermark;
      if (typeof wm !== "number" || wm < sinceSeq) return { error: "invalid_cursor", reason: "watermark_behind_cursor" };
      if (wm > this._syncTip(family)) return { error: "invalid_cursor", reason: "watermark_ahead_of_tip" };
    }
    const floor = this._syncFloor(family);
    if (sinceSeq < floor - 1) return { resyncRequired: true, family, floorSeq: floor };
    if (wm === undefined) wm = this._syncTip(family);
    const rows = this._all(
      `SELECT * FROM sync_changes WHERE family = ? AND seq > ? AND seq <= ? ORDER BY seq LIMIT ?`,
      family, sinceSeq, wm, Math.max(1, Math.min(limit, 500)));
    const nextSeq = rows.length ? rows[rows.length - 1].seq : sinceSeq;
    return { family, changes: rows.map(r => ({
               seq: r.seq, entityKey: r.entity_key, bookId: r.book_id,
               revision: r.revision, op: r.op,
               payload: r.payload_json ? JSON.parse(r.payload_json) : null })),
             nextSeq, highWatermark: wm, hasMore: nextSeq < wm,
             cursor: { family, seq: nextSeq, watermark: wm } };
  }

  syncSnapshot({ family } = {}) {
    if (!SYNC_FAMILIES.includes(family)) return { error: "unknown_family", family };
    const watermark = this._syncTip(family);
    if (family === "position") {
      const books = this._all(`SELECT book_id FROM position_state ORDER BY book_id`)
        .map(r => this.positionView(r.book_id));
      return { family, watermark, positions: books };
    }
    const entities = this._all(
      `SELECT * FROM sync_entities WHERE family = ? ORDER BY entity_key`, family)
      .map(e => ({ entityKey: e.entity_key, bookId: e.book_id, revision: e.revision,
                   tombstone: !!e.deleted,
                   data: e.data_json ? JSON.parse(e.data_json) : null }));
    return { family, watermark, entities };
  }

  // Phase-two sweep, DRY RUN ONLY (P4 scope): proves references and
  // reports a manifest; deletes nothing. FAILS CLOSED (P4 review
  // blocker 2): any unproven reference — a live job, an incomplete
  // binding of this book, OR an incomplete binding anywhere else
  // (which could be hiding a reference to a candidate object) —
  // empties the manifest entirely and names the blockers. A partial
  // manifest is never emitted.
  sweepDryRun(bookId) {
    const content = this._syncEntity("content", bookId);
    if (!content || !content.deleted) return { error: "not_tombstoned", bookId };
    const blockers = [];
    const liveJobs = this._one(
      `SELECT COUNT(*) AS n FROM jobs WHERE book_id = ? AND state NOT IN ('complete', 'cancelled', 'failed')`,
      bookId).n;
    if (liveJobs > 0) blockers.push(`live_jobs:${liveJobs}`);
    const bindings = this._all(
      `SELECT * FROM sync_entities WHERE family = 'bindings' AND book_id = ?`, bookId);
    const keyOf = json => { try { return JSON.parse(json || "{}").cacheKey || null; } catch { return null; } };
    const ownKeys = new Map();
    for (const b of bindings) {
      const key = keyOf(b.data_json);
      if (!key) blockers.push(`incomplete_own_binding:${b.entity_key}`);
      else ownKeys.set(b.entity_key, key);
    }
    const otherKeys = new Set();
    for (const r of this._all(
      `SELECT entity_key, data_json FROM sync_entities WHERE family = 'bindings' AND (book_id IS NULL OR book_id != ?)`, bookId)) {
      const key = keyOf(r.data_json);
      if (!key) blockers.push(`incomplete_cross_book_binding:${r.entity_key}`);
      else otherKeys.add(key);
    }
    if (blockers.length > 0)
      return { bookId, tombstoned: true, dryRun: true, deletedAnything: false,
               liveJobs, conservative: true, blockedBy: blockers,
               sharedKept: [], wouldRemove: [],
               note: "fail closed: references unproven — manifest withheld in full" };
    const wouldRemove = [{ family: "content", entityKey: bookId }];
    const sharedKept = [];
    for (const [entityKey, key] of ownKeys) {
      if (otherKeys.has(key)) { sharedKept.push(key); continue; }
      wouldRemove.push({ family: "bindings", entityKey, cacheKey: key });
    }
    return { bookId, tombstoned: true, dryRun: true, deletedAnything: false,
             liveJobs, sharedKept, wouldRemove, conservative: false, blockedBy: [],
             note: "all references proven inside one read; manifest complete" };
  }

}

// F7 chapter-state derivation (§1.3): a pure function over the chapter's
// occurrence states and covering job states. Every surface renders this
// verbatim (B8); it is defined here, once.
export function deriveChapterState(occurrenceStates, coveringJobStates) {
  const occ = occurrenceStates || [];
  const jobs = coveringJobStates || [];
  // Completeness is a fact about the audio, not about job bookkeeping:
  // a fully recorded chapter is Complete even if a stale covering job
  // still claims to be generating or parked (P2 review finding 4).
  if (occ.length > 0 && occ.every(s => s === "ready")) return "Complete";
  if (occ.includes("outcome_unknown") || jobs.includes("outcome_unknown")) return "Outcome Unknown";
  if (jobs.some(s => s === "generating" || s === "queued")) return "Generating";
  if (jobs.includes("paused_quota")) return "Quota Paused";
  const ready = occ.filter(s => s === "ready").length;
  const blocked = occ.filter(s => s === "blocked_policy").length;
  if (occ.length > 0 && ready === occ.length) return "Complete";
  if (blocked > 0 && ready === 0) return "Blocked";
  if (ready > 0) return "Partial";
  if (jobs.includes("failed")) return "Failed";
  return "Partial";
}
