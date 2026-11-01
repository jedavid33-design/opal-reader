    for (const s2 of slots) evidenceRows.push(...JSON.parse(s2.evidence_json));
    const evidenceByOcc = new Map(evidenceRows.map(e2 => [e2.occurrenceId, e2]));
    const canonicalRows = pinned.rows.map(pr => {
      const ev = evidenceByOcc.get(pr.occurrenceId);
      return { occurrenceId: pr.occurrenceId, revisionKey: pr.revisionKey,
               cacheKey: pr.cacheKey, sha256: ev.computedSha256,
               size: pr.size, format: pr.format };
    }).sort((a, b) => (a.occurrenceId < b.occurrenceId ? -1 : 1));
    const rowsSha256 = sha256HexText(canonicalJson(canonicalRows));
    const certificateSha256 = this._migrationAnchorSha256({
      bookId, migrationId: p.migrationId, freezeDigest: p.freezeDigest, rowsSha256,
      items: evidenceRows.map(ev => ({ occurrenceId: ev.occurrenceId,
        revisionKey: ev.revisionKey, cacheKey: ev.cacheKey,
        objectKey: ev.objectKey, computedSha256: ev.computedSha256,
        metadataSha256: ev.metadataSha256, etag: ev.etag,
        viaProvenance: ev.status === "accepted_provenance" })) });
    this.sql.exec(
      `INSERT INTO migration_books (book_id, migration_id, freeze_digest, row_count, rows_json, rows_sha256, imported_at, certificate_sha256)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      bookId, p.migrationId, p.freezeDigest, canonicalRows.length,
      canonicalJson(canonicalRows), rowsSha256, now, certificateSha256);
    if (!contentEnt)
      this._upsertSyncEntity("content", bookId, bookId, effectiveContent);
    for (const row of canonicalRows) {
      const ev = evidenceByOcc.get(row.occurrenceId);
      // The sync projection's provenance, exactly as the whole-book
      // import would have written it for this row's acceptance.
      const provenance = ev.status === "accepted_provenance"
        ? "migration:freeze_snapshot_attestation" : "migration";
      this._upsertSyncEntity("bindings", `${bookId}:${row.occurrenceId}`, bookId,
        { cacheKey: row.cacheKey, revisionKey: row.revisionKey,
          sha256: ev.computedSha256, format: row.format, size: row.size,
          provenance });
    }
    this.sql.exec(
      `UPDATE migration_imports SET completed_at = ?, certificate_sha256 = ? WHERE book_id = ?`,
      now, certificateSha256, bookId);
    this._logTransition("book", bookId, "MigrateImportChunk", null, "imported",
      null, { commandId, migrationId: p.migrationId, chunks: appliedCount });
    result.bookComplete = true;
    result.certificateSha256 = certificateSha256;
    result.wholeBook = { rowsSha256, certificateSha256 };
    return result;
  }

  // Both-plane completeness against the import record — the shared
  // computation behind the flip gate and the read-back view. The
  // reference set is the manifest row set the book was imported
  // under; completeness is a statement about THAT set (a book may
  // legitimately have occurrences with no audio yet).
  //
  // G4 (Rowan re-review 6354569652): completeness is EXACT,
  // BIDIRECTIONAL set equality, not "at least the expected rows".
  // Forward: every expected row is present in both planes with
  // equal book/occurrence/revisionKey/cacheKey/digest/format/size
  // (and the provenance the pinned row's form demands). Reverse:
  // neither plane holds anything MORE for this book — no extra
  // sync entity (a tombstone is state too), no extra SQL binding
  // for the book's occurrences, no foreign or surplus provenance
  // audit rows — and each attested row's audit record survives an
  // integrity recompute against the stored attestation.
  _migrationCompleteness(bookId) {
    const book = this._oneOrNull(`SELECT * FROM migration_books WHERE book_id = ?`, bookId);
    if (!book) return { book: null, complete: false, missing: ["import_record"], divergences: [] };
    const missing = [], divergences = [];
    const pinned = this._pinnedBook(bookId);
    const expected = JSON.parse(book.rows_json);
    const expectedByOcc = new Map(expected.map(r => [r.occurrenceId, r]));
    const content = this._syncEntity("content", bookId);
    if (!content || content.deleted) missing.push("content");
    const contentOccIds = content && !content.deleted
      ? new Set((JSON.parse(content.data_json || "{}").occurrenceIds) || []) : new Set();
    const expectedProvenance = (row) => {
      const prow = pinned?.byOccurrence.get(row.occurrenceId) || row;
      return this._pinnedForm(prow) === "fingerprinted-distinct"
        ? "migration:freeze_snapshot_attestation" : "migration";
    };
    const diverge = (occurrenceId, plane, field, expectedV, foundV) =>
      divergences.push({ occurrenceId, plane, field, expected: expectedV, found: foundV });

    for (const row of expected) {
      const prov = expectedProvenance(row);
      const b = this._oneOrNull(
        `SELECT * FROM bindings WHERE occurrence_id = ? AND revision_key = ?`,
        row.occurrenceId, row.revisionKey);
      if (!b) missing.push(`sql:${row.occurrenceId}`);
      else {
        if (b.cache_key !== row.cacheKey) diverge(row.occurrenceId, "sql", "cacheKey", row.cacheKey, b.cache_key);
        if (b.provenance !== prov) diverge(row.occurrenceId, "sql", "provenance", prov, b.provenance);
      }
      const idx = this._oneOrNull(`SELECT * FROM cache_index WHERE cache_key = ?`, row.cacheKey);
      if (!idx) missing.push(`index:${row.occurrenceId}`);
      else {
        if (idx.sha256 !== row.sha256) diverge(row.occurrenceId, "index", "sha256", row.sha256, idx.sha256);
        if (idx.format !== row.format) diverge(row.occurrenceId, "index", "format", row.format, idx.format);
        // The identity the import anchored: the revision key, or
        // (legacy rows) null. The cache key itself — the v1 default
        // another honest path may have anchored first — is the one
        // other consistent value; anything else is foreign.
        const identityOk = row.revisionKey.startsWith("legacy:")
          ? (idx.identity === null || idx.identity === row.cacheKey)
          : idx.identity === row.revisionKey;
        if (!identityOk) diverge(row.occurrenceId, "index", "identity",
          row.revisionKey.startsWith("legacy:") ? null : row.revisionKey, idx.identity);
      }
      const e = this._syncEntity("bindings", `${bookId}:${row.occurrenceId}`);
      if (!e || e.deleted) missing.push(`sync:${row.occurrenceId}`);
      else {
        const d = JSON.parse(e.data_json || "{}");
        const wantData = { cacheKey: row.cacheKey, revisionKey: row.revisionKey,
          sha256: row.sha256, format: row.format, size: row.size, provenance: prov };
        if (canonicalJson(d) !== canonicalJson(wantData))
          diverge(row.occurrenceId, "sync", "data", wantData, d);
      }
    }

    // ---- reverse direction: nothing extra, in either plane.
    for (const e of this._all(
        `SELECT * FROM sync_entities WHERE family = 'bindings' AND book_id = ?`, bookId)) {
      const occId = e.entity_key.startsWith(`${bookId}:`)
        ? e.entity_key.slice(bookId.length + 1) : e.entity_key;
      if (!expectedByOcc.has(occId))
        diverge(occId, "sync", "unexpected_row", null, e.deleted ? "tombstone" : "live");
    }
    // SQL bindings are occurrence-global by design (the table's own
    // identity model — AdoptAudio binds without a book context); a
    // row belongs to this book iff its occurrence is one of the
    // book's content occurrences.
    for (const occId of contentOccIds) {
      for (const b of this._all(`SELECT * FROM bindings WHERE occurrence_id = ?`, occId)) {
        const want = expectedByOcc.get(occId);
        if (!want || want.revisionKey !== b.revision_key)
          diverge(occId, "sql", "unexpected_row", want ? want.revisionKey : null, b.revision_key);
      }
    }
    // Provenance audit integrity: exactly one audit row per
    // attested row, under THIS book's migration, its fingerprint
    // recomputing over the stored attestation, the attestation
    // itself field-equal to the approved row (including the
    // freeze's etag). No audit rows for anything else.
    const attested = expected.filter(r => expectedProvenance(r) ===
      "migration:freeze_snapshot_attestation");
    const auditByOcc = new Map();
    for (const a of this._all(`SELECT * FROM migration_audit WHERE book_id = ?`, bookId)) {
      if (a.migration_id !== book.migration_id ||
          !attested.some(r => r.occurrenceId === a.occurrence_id))
        diverge(a.occurrence_id, "audit", "unexpected_row", book.migration_id, a.migration_id);
      else auditByOcc.set(a.occurrence_id,
        [...(auditByOcc.get(a.occurrence_id) || []), a]);
    }
    for (const row of attested) {
      const list = auditByOcc.get(row.occurrenceId) || [];
      if (list.length !== 1) {
        diverge(row.occurrenceId, "audit", "count", 1, list.length);
        continue;
      }
      const a = list[0];
      let ok = a.revision_key === row.revisionKey && a.cache_key === row.cacheKey &&
        a.outcome === "accepted_provenance";
      if (ok) {
        try {
          const att = JSON.parse(a.attestation_json);
          ok = a.attestation_sha256 === sha256HexText(a.attestation_json) &&
            att.bookId === bookId && att.occurrenceId === row.occurrenceId &&
            att.revisionKey === row.revisionKey && att.cacheKey === row.cacheKey &&
            att.sha256 === row.sha256 && att.size === row.size &&
            att.format === row.format && att.snapshotDigest === book.freeze_digest &&
            (!pinned || att.r2Etag === pinned.byOccurrence.get(row.occurrenceId)?.etag);
        } catch { ok = false; }
      }
      if (!ok) diverge(row.occurrenceId, "audit", "integrity",
        "one intact accepted_provenance record", "missing/tampered");
    }

    return { book, complete: missing.length === 0 && divergences.length === 0,
             missing, divergences };
  }

  _migrateRecordFlipGate(p, commandId) {
    const bookId = p.bookId || null;
    if (!bookId || !p.migrationId || !p.certificateSha256)
      return { outcome: "rejected", reason: "migration_shape", bookId };
    const chk = this._migrationCompleteness(bookId);
    if (!chk.book)
      return { outcome: "rejected", reason: "flip_gate_incomplete", bookId,
               missing: chk.missing, divergences: chk.divergences };
    if (chk.book.migration_id !== p.migrationId)
      return { outcome: "rejected", reason: "flip_gate_incomplete", bookId,
               missing: ["migration_mismatch"], divergences: [] };
    if (!chk.complete)
      return { outcome: "rejected", reason: "flip_gate_incomplete", bookId,
               missing: chk.missing, divergences: chk.divergences };
    // G3: the presented certificate must equal the digest the
    // coordinator itself derived and anchored at import time.
    // Anything else — an arbitrary string, another book's
    // certificate, a certificate minted under another migration —
    // certifies nothing and is refused. (An existing gate's stored
    // certificate equals the anchor by construction, so this check
    // subsumes the old caller-string conflict rule.)
    if (!chk.book.certificate_sha256 ||
        p.certificateSha256 !== chk.book.certificate_sha256)
      return { outcome: "rejected", reason: "flip_gate_certificate_mismatch", bookId };
    // B1 (§3A.6, D4-P6): the carry invariant, enforced HERE — in
    // the coordinator, in the gate's own transaction — not by
    // runner ordering. For a book under a freeze-carry pin, the
    // gate additionally fails closed unless BOTH carries are
    // durable, distinct, and pin-matched AND the stored state
    // (position_state; the complete stored job set) recomputes
    // to the pin. The G4 binding completeness above is unchanged
    // and still required; this check is conjunctive with it. A
    // refusal writes zero gate rows. Books with no carry pin
    // (any book outside the approved freeze's carry set) keep
    // the pre-B1 gate semantics exactly.
    if (this._carryBook(bookId)) {
      const carryPin = this._carryBook(bookId);
      // B1-C1 (Rowan B1 review 6369823670): re-verify the DURABLE
      // STORED sync content against the carry pin, here in the
      // gate's own transaction. The chunk-time check (in
      // _migrationChunkState) proves the content the import USED;
      // it cannot see a later alteration of the stored entity
      // through the supported sync path (SyncPush verifies
      // identity/revision, never content). A book whose stored
      // content no longer hashes to the pin — same occurrence IDs,
      // altered order/POV/cast — must not flip: refuse with zero
      // gate rows, distinctly from a carry refusal.
      const storedEnt = this._syncEntity("content", bookId);
      let storedContentSha256 = null;
      if (storedEnt && !storedEnt.deleted && storedEnt.data_json) {
        try {
          storedContentSha256 =
            sha256HexText(canonicalJson(JSON.parse(storedEnt.data_json)));
        } catch { storedContentSha256 = null; }
      }
      if (storedContentSha256 !== carryPin.contentSha256)
        return { outcome: "rejected", reason: "flip_gate_content_mismatch",
                 bookId, expected: carryPin.contentSha256,
                 found: storedContentSha256 };
      const carry = this._migrationCarryVerification(bookId);
      if (!carry.ok)
        return { outcome: "rejected", reason: "flip_gate_carry_incomplete",
                 bookId, missing: carry.missing, divergences: carry.divergences };
    }
    const existing = this._oneOrNull(`SELECT * FROM migration_gates WHERE book_id = ?`, bookId);
    if (existing)
      return { outcome: "applied", bookId, flipped: true, idempotent: true };
    this.sql.exec(
      `INSERT INTO migration_gates (book_id, migration_id, certificate_sha256, flipped_at, detail_json)
       VALUES (?, ?, ?, ?, ?)`,
      bookId, p.migrationId, p.certificateSha256, this._now(),
      JSON.stringify({ commandId }));
    this._logTransition("book", bookId, "MigrateRecordFlipGate", null, "flipped",
      null, { commandId, migrationId: p.migrationId });
    return { outcome: "applied", bookId, flipped: true };
  }

  // ============ B1: the migration-state carry (D4 §3A) ============
  // The chunk importer carries content + bindings only (verified
  // at pin 00661bb); frozen POSITIONS and frozen JOB AGGREGATES
  // ride these two dedicated operator-fenced commands, checked
  // against the carry pin (v2/p8/approved-freeze-carry.mjs,
  // derived from the same approved freeze). Neither command
  // contains a grant, a synthesis, or a provider call; the states
  // they write have no outgoing transitions; and the journal is
  // never fabricated — a carried position is operational state
  // with an honest audit record, not an invented device event.
  _approvedCarry() {
    return (this.env && this.env.approvedFreezeCarry) || APPROVED_FREEZE_CARRY;
  }

  // The carry pin for one book — authoritative ONLY for the
  // freeze it belongs to: a pin whose snapshot digest differs
  // from the active freeze's digest speaks for a different
  // universe of books and is inert here (the same trust-boundary
  // discipline as the manifest/chunk seams: deployment
  // configuration may select the pin set, request data never
  // can). Null when the book has no carry pin.
  _carryBook(bookId) {
    const carry = this._approvedCarry();
    const freeze = this._approvedFreeze();
    if (!carry || !freeze || carry.snapshotDigest !== freeze.snapshotDigest)
      return null;
    return carry.books?.[bookId] || null;
  }

  _carryAuditRow(bookId, kind) {
    return this._oneOrNull(
      `SELECT * FROM migration_carry WHERE book_id = ? AND kind = ? ORDER BY id DESC LIMIT 1`,
      bookId, kind);
  }

  // §3A.2: carry the book's frozen position. The payload must
  // hash EXACTLY to the carry pin; the book's import must be
  // complete under the same migration identity. On acceptance,
  // one transaction writes the position_state row DIRECTLY
  // (frozen occurrence + offset, occ_index derived from the
  // stored content's ordered occurrenceIds, playing = 0,
  // tip = 0 — so the first genuine device event, based at
  // baseSeq 0, folds in as receipt 1 exactly as on a fresh book)
  // and the migration_carry audit row holding the verbatim
  // payload incl. checkpoints. NO position_events row is ever
  // written by this command.
  _migrateImportPositions(p, commandId) {
    const bookId = p.bookId || null;
    const pos = p.position;
    if (!bookId || !p.migrationId || !p.freezeDigest ||
        !pos || typeof pos.occurrenceId !== "string" ||
        typeof pos.offsetSec !== "number" || !(pos.offsetSec >= 0) ||
        !Array.isArray(p.checkpoints))
      return { outcome: "rejected", reason: "migration_shape", bookId };
    if (this._bookTombstoned(bookId))
      return { outcome: "rejected", reason: "rejected_tombstoned", bookId };
    const freeze = this._approvedFreeze();
    if (!freeze || p.freezeDigest !== freeze.snapshotDigest)
      return { outcome: "rejected", reason: "migration_freeze_unapproved", bookId };
    const mismatch = (element, extra = {}) =>
      ({ outcome: "rejected", reason: "migration_carry_mismatch", bookId, element, ...extra });
    const pin = this._carryBook(bookId);
    if (!pin) return mismatch("book_unpinned");
    const book = this._oneOrNull(`SELECT * FROM migration_books WHERE book_id = ?`, bookId);
    if (!book) return mismatch("import_incomplete");
    if (book.migration_id !== p.migrationId || book.freeze_digest !== p.freezeDigest)
      return mismatch("migration_identity");
    const contentEnt = this._syncEntity("content", bookId);
    if (!contentEnt || contentEnt.deleted) return mismatch("import_incomplete");
    const occIds = (JSON.parse(contentEnt.data_json || "{}").occurrenceIds) || [];
    const occIndex = occIds.indexOf(pos.occurrenceId);
    if (occIndex < 0) return mismatch("occurrence");
    const payload = { bookId,
      position: { occurrenceId: pos.occurrenceId, offsetSec: pos.offsetSec },
      checkpoints: p.checkpoints };
    const payloadHash = sha256HexText(canonicalJson(payload));
    if (payloadHash !== pin.position.payloadSha256) return mismatch("position_payload");
    const prior = this._carryAuditRow(bookId, "positions");
    if (prior) {
      // The same carry under a new command id converges on the
      // recorded application (the chunk flow's discipline); a
      // different payload can never reach here — the pin check
      // above already refused it.
      if (prior.payload_hash === payloadHash)
        return { outcome: "applied", bookId, migrationId: p.migrationId, converged: true,
                 position: { occurrenceId: pos.occurrenceId, occIndex,
                             offsetSec: pos.offsetSec, payloadSha256: payloadHash } };
      return mismatch("position_payload");
    }
    // A position_state row with no carry audit is foreign state
    // (a device journal, or tampering): the carry writes the
    // OPENING state of a book no device has played in v2, and
    // refuses rather than overwrite history it cannot see.
    const st = this._oneOrNull(`SELECT * FROM position_state WHERE book_id = ?`, bookId);
    if (st) return mismatch("position_state");
    const now = this._now();
    this.sql.exec(
      `INSERT INTO position_state (book_id, occurrence_id, occ_index, offset_sec, playing, tip, superseded_count)
       VALUES (?, ?, ?, ?, 0, 0, 0)`,
      bookId, pos.occurrenceId, occIndex, pos.offsetSec);
    this.sql.exec(
      `INSERT INTO migration_carry (at, migration_id, book_id, kind, command_id, payload_hash, payload_json)
       VALUES (?, ?, ?, 'positions', ?, ?, ?)`,
      now, p.migrationId, bookId, commandId, payloadHash, canonicalJson(payload));
    this._logTransition("book", bookId, "MigrateImportPositions", null, "position_carried",
      null, { commandId, migrationId: p.migrationId, payloadSha256: payloadHash });
    return { outcome: "applied", bookId, migrationId: p.migrationId,
             position: { occurrenceId: pos.occurrenceId, occIndex,
                         offsetSec: pos.offsetSec, payloadSha256: payloadHash } };
  }

  // §3A.3: carry the book's frozen job aggregates — ONE
  // operator-only, all-or-nothing transaction proving the EXACT
  // pinned set (D4-P5): the submitted aggregates' ordered
  // descriptor (job IDs in pin order, states, definition
  // digests, occurrence-set digests) must hash to the pin's set
  // hash at the pinned count — no duplicates, no extras, no
  // omissions. Job rows are inserted DIRECTLY in their frozen
  // states at revision 1, with the frozen definition taken from
  // the PIN (never from the caller) as data_json, their
  // occurrence rows in the submitted (= pinned) states, and a
  // transition-log entry naming this command as the cause
  // (provenance: carried, never lived). No SubmitJob semantics
  // are reused: there is no queued instant and no fabricated
  // lifecycle. An empty-set book presents the pinned empty
  // descriptor and writes only its audit row + receipt — the
  // proof the empty set was presented and pin-matched, not
  // skipped.
  _migrateImportJobs(p, commandId) {
    const bookId = p.bookId || null;
    if (!bookId || !p.migrationId || !p.freezeDigest || !Array.isArray(p.aggregates))
      return { outcome: "rejected", reason: "migration_shape", bookId };
    if (this._bookTombstoned(bookId))
      return { outcome: "rejected", reason: "rejected_tombstoned", bookId };
    const freeze = this._approvedFreeze();
    if (!freeze || p.freezeDigest !== freeze.snapshotDigest)
      return { outcome: "rejected", reason: "migration_freeze_unapproved", bookId };
    const mismatch = (element, extra = {}) =>
      ({ outcome: "rejected", reason: "migration_carry_mismatch", bookId, element, ...extra });
    const pin = this._carryBook(bookId);
    if (!pin) return mismatch("book_unpinned");
    const book = this._oneOrNull(`SELECT * FROM migration_books WHERE book_id = ?`, bookId);
    if (!book) return mismatch("import_incomplete");
    if (book.migration_id !== p.migrationId || book.freeze_digest !== p.freezeDigest)
      return mismatch("migration_identity");
    const seenJobs = new Set();
    for (const a of p.aggregates) {
      if (!a || typeof a.jobId !== "string" || !Number.isInteger(a.chapterIndex) ||
          typeof a.definitionDigest !== "string" || !Array.isArray(a.occurrences))
        return { outcome: "rejected", reason: "migration_shape", bookId };
      if (seenJobs.has(a.jobId))
        return { outcome: "rejected", reason: "duplicate_row", bookId, jobId: a.jobId };
      seenJobs.add(a.jobId);
      // Only frozen states are carryable, by construction; and
      // only under the kind/lane the frozen records support (all
      // four frozen aggregates are standard-lane chapter jobs —
      // batchJobName is null on every one).
      if (a.v2State !== "parked_policy" && a.v2State !== "superseded")
        return mismatch("state_not_carryable", { jobId: a.jobId, state: a.v2State ?? null });
      if (a.kind !== "job" || a.lane !== "standard")
        return mismatch("kind_lane", { jobId: a.jobId });
      const seenOcc = new Set();
      for (const o of a.occurrences) {
        if (!o || typeof o.occurrenceId !== "string" ||
            typeof o.revisionKey !== "string" || !OCC_STATES.includes(o.state))
          return { outcome: "rejected", reason: "migration_shape", bookId };
        if (seenOcc.has(o.occurrenceId))
          return { outcome: "rejected", reason: "duplicate_row", bookId,
                   jobId: a.jobId, occurrenceId: o.occurrenceId };
        seenOcc.add(o.occurrenceId);
      }
    }
    const descriptor = p.aggregates.map(a => ({
      jobId: a.jobId, chapterIndex: a.chapterIndex, v2State: a.v2State,
      definitionDigest: a.definitionDigest,
      occurrenceSetSha256: sha256HexText(canonicalJson(a.occurrences)) }));
    const setSha256 = sha256HexText(canonicalJson(descriptor));
    if (descriptor.length !== pin.jobs.count || setSha256 !== pin.jobs.setSha256)
      return mismatch("job_set",
        { expectedCount: pin.jobs.count, foundCount: descriptor.length });
    const prior = this._carryAuditRow(bookId, "jobs");
    if (prior) {
      if (prior.payload_hash === setSha256)
        return { outcome: "applied", bookId, migrationId: p.migrationId, converged: true,
                 jobs: { count: descriptor.length, setSha256 } };
      return mismatch("job_set");
    }
    for (const a of p.aggregates)
      if (this._oneOrNull(`SELECT job_id FROM jobs WHERE job_id = ?`, a.jobId))
        return mismatch("job_exists", { jobId: a.jobId });
    const pinByJob = new Map(pin.jobs.aggregates.map(a => [a.jobId, a]));
    const now = this._now();
    for (const a of p.aggregates) {
      const pinAgg = pinByJob.get(a.jobId);
      this.sql.exec(
        `INSERT INTO jobs (job_id, kind, book_id, chapter_index, lane, state, revision, data_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
        a.jobId, a.kind, bookId, a.chapterIndex, a.lane, a.v2State,
        canonicalJson(pinAgg.definition), now, now);
      for (const o of a.occurrences)
        this.sql.exec(
          `INSERT INTO occurrences (job_id, occurrence_id, revision_key, state) VALUES (?, ?, ?, ?)`,
          a.jobId, o.occurrenceId, o.revisionKey, o.state);
      this._logTransition("job", a.jobId, "MigrateImportJobs", null, a.v2State, 1,
        { commandId, migrationId: p.migrationId, cause: pinAgg.cause || "migration_carry" });
    }
    this.sql.exec(
      `INSERT INTO migration_carry (at, migration_id, book_id, kind, command_id, payload_hash, payload_json)
       VALUES (?, ?, ?, 'jobs', ?, ?, ?)`,
      now, p.migrationId, bookId, commandId, setSha256, canonicalJson(descriptor));
    return { outcome: "applied", bookId, migrationId: p.migrationId,
             jobs: { count: descriptor.length, setSha256 } };
  }

  // §3A.5 + §3A.6: the carry verification — recomputed from the
  // STORED rows against the durable audit and the pin, three
  // ways, never from a request echo and never via jobView (which
  // exposes neither data_json nor any digest). SELECT-only: the
  // flip gate calls it inside its transaction; the read-back
  // view calls it on the read-only facade. A book with no carry
  // pin is not applicable and verifies trivially (pre-B1 gate
  // semantics for books outside the carry set).
  _migrationCarryVerification(bookId) {
    const pin = this._carryBook(bookId);
    if (!pin)
      return { applicable: false, ok: true, positions: null, jobs: null,
               missing: [], divergences: [] };
    const missing = [], divergences = [];
    const diverge = (element, field, expected, found, jobId = null) =>
      divergences.push({ element, field, expected, found, ...(jobId ? { jobId } : {}) });
    const contentEnt = this._syncEntity("content", bookId);
    const occIds = contentEnt && !contentEnt.deleted
      ? ((JSON.parse(contentEnt.data_json || "{}").occurrenceIds) || []) : [];
    const receiptOk = (audit, type) => {
      if (!audit || !audit.command_id) return false;
      const cmd = this._oneOrNull(`SELECT * FROM commands WHERE command_id = ?`, audit.command_id);
      return !!cmd && cmd.type === type && cmd.outcome === "applied";
    };
    // ---- positions: audit record + stored state + pin, three-way.
    let positions = null;
    const posAudit = this._carryAuditRow(bookId, "positions");
    if (!posAudit) missing.push("positions_carry");
    else {
      if (posAudit.payload_hash !== pin.position.payloadSha256)
        diverge("positions", "payload_hash", pin.position.payloadSha256, posAudit.payload_hash);
      let auditIntact = false;
      try { auditIntact = sha256HexText(posAudit.payload_json) === posAudit.payload_hash; }
      catch { auditIntact = false; }
      if (!auditIntact)
