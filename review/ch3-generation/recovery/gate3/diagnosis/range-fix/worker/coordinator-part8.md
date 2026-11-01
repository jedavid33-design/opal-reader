      return { outcome: "rejected", reason: "migration_shape", bookId };
    if (this._bookTombstoned(bookId))
      return { outcome: "rejected", reason: "rejected_tombstoned", bookId };
    const seenOcc = new Set();
    for (const r of rows) {
      if (!r || !r.occurrenceId || !r.revisionKey || !r.cacheKey ||
          !r.manifest || typeof r.manifest.sha256 !== "string" ||
          typeof r.manifest.size !== "number" || !r.manifest.format)
        return { outcome: "rejected", reason: "migration_shape", bookId };
      if (seenOcc.has(r.occurrenceId))
        return { outcome: "rejected", reason: "duplicate_row", bookId, occurrenceId: r.occurrenceId };
      seenOcc.add(r.occurrenceId);
    }
    // G2: the payload must be the approved freeze's row set for
    // this book — pinned in code, matchable but never definable by
    // the caller (see _migrationManifestError).
    const manifestError = this._migrationManifestError(p);
    if (manifestError) return manifestError;
    const pinned = this._pinnedBook(bookId);
    // Content: carried by the command, or already present. A stored
    // content entity that disagrees with the carried one is a
    // divergence — migration never silently rewrites a book's
    // structure. Rows must belong to the book's own occurrence set
    // (the same ownership proof _validateSyncChange performs).
    const contentEnt = this._syncEntity("content", bookId);
    let contentPlan = "present";
    if (p.content) {
      const occIds = Array.isArray(p.content.occurrenceIds) ? p.content.occurrenceIds : null;
      if (!occIds) return { outcome: "rejected", reason: "migration_shape", bookId };
      for (const r of rows)
        if (!occIds.includes(r.occurrenceId))
          return { outcome: "rejected", reason: "unknown_occurrence", bookId, occurrenceId: r.occurrenceId };
      if (contentEnt) {
        if (canonicalJson(JSON.parse(contentEnt.data_json || "{}")) !== canonicalJson(p.content))
          return { outcome: "rejected", reason: "content_divergence", bookId };
        contentPlan = "identical";
      } else contentPlan = "insert";
    } else {
      if (!contentEnt)
        return { outcome: "rejected", reason: "unknown_book", bookId };
      const occIds = (JSON.parse(contentEnt.data_json || "{}").occurrenceIds) || [];
      for (const r of rows)
        if (!occIds.includes(r.occurrenceId))
          return { outcome: "rejected", reason: "unknown_occurrence", bookId, occurrenceId: r.occurrenceId };
    }
    // The import record: a re-import under a different row set is a
    // divergence, never an overwrite. The immutable per-book import
    // identity (consistency addendum to G2/G3) pins migrationId,
    // freezeDigest, size and format alongside the four fields the
    // first version hashed — a re-import redefining ANY pinned
    // field is rejected, including after a gate record exists (the
    // gate's own checks are separate; this fence fires at import).
    const canonicalRows = rows
      .map(r => ({ occurrenceId: r.occurrenceId, revisionKey: r.revisionKey,
                   cacheKey: r.cacheKey, sha256: r.manifest.sha256,
                   size: r.manifest.size, format: r.manifest.format }))
      .sort((a, b) => (a.occurrenceId < b.occurrenceId ? -1 : 1));
    const rowsSha256 = sha256HexText(canonicalJson(canonicalRows));
    const priorBook = this._oneOrNull(`SELECT * FROM migration_books WHERE book_id = ?`, bookId);
    if (priorBook && (priorBook.rows_sha256 !== rowsSha256 ||
                      priorBook.migration_id !== p.migrationId ||
                      priorBook.freeze_digest !== p.freezeDigest))
      return { outcome: "rejected", reason: "migration_book_divergence", bookId };
    // D3: a book with a chunked import IN PROGRESS (chunk
    // bookkeeping exists but no import record yet) is not
    // importable whole — the two paths never interleave on one
    // book. A completed chunked import has its import record above
    // and follows the ordinary divergence/idempotence rules.
    const chunkedImport = this._oneOrNull(
      `SELECT * FROM migration_imports WHERE book_id = ?`, bookId);
    if (chunkedImport && !priorBook)
      return { outcome: "rejected", reason: "migration_book_divergence", bookId };

    // ---- validate EVERY row before applying anything (design §1).
    const { certRows, plans, firstBlock } = this._validateMigrationRows({
      bookId, freezeDigest: p.freezeDigest, rows, pinned, facts, deferSync: false });

    const certificate = { bookId, migrationId: p.migrationId,
      freezeDigest: p.freezeDigest, commandId, rows: certRows,
      totals: { rows: certRows.length, accepted: 0, acceptedIdempotent: 0,
                acceptedProvenance: 0, blocked: 0 } };
    if (firstBlock) {
      for (const c of certRows) {
        c.status = "blocked";
        if (!c.reason) c.reason = "book_rejected";
      }
      certificate.totals.blocked = certRows.length;
      return { outcome: "rejected", reason: firstBlock, bookId, certificate };
    }

    // G3: the canonical certificate digest, derived HERE from the
    // verified class-C facts — never accepted from the caller. It
    // binds every row's import-time verification (object key,
    // computed + retained-metadata digests, observed etag,
    // acceptance class) to the freeze, the migration, and the
    // row-set identity digest. accepted_idempotent normalizes to
    // "accepted": an idempotent re-import observes the same facts
    // and must anchor identically; a re-import whose observations
    // changed under the same rows is a divergence, rejected here —
    // before anything is applied.
    const certificateSha256 = this._migrationAnchorSha256({
      bookId, migrationId: p.migrationId, freezeDigest: p.freezeDigest, rowsSha256,
      items: plans.map(plan => ({ occurrenceId: plan.row.occurrenceId,
        revisionKey: plan.row.revisionKey, cacheKey: plan.row.cacheKey,
        objectKey: plan.cert.objectKey, computedSha256: plan.cert.computedSha256,
        metadataSha256: plan.cert.metadataSha256, etag: plan.cert.etag,
        viaProvenance: plan.viaProvenance })) });
    if (priorBook && priorBook.certificate_sha256 !== certificateSha256)
      return { outcome: "rejected", reason: "migration_book_divergence", bookId };
    certificate.certificateSha256 = certificateSha256;

    // ---- apply: one transaction (the handleCommand transaction),
    // both planes, from the same verified facts.
    if (contentPlan === "insert")
      this._upsertSyncEntity("content", bookId, bookId, p.content);
    if (!priorBook) {
      this.sql.exec(
        `INSERT INTO migration_books (book_id, migration_id, freeze_digest, row_count, rows_json, rows_sha256, imported_at, certificate_sha256)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        bookId, p.migrationId, p.freezeDigest, canonicalRows.length,
        canonicalJson(canonicalRows), rowsSha256, this._now(), certificateSha256);
    }
    for (const plan of plans) {
      const r = plan.row, fact = facts.get(r.cacheKey);
      const provenance = plan.viaProvenance
        ? "migration:freeze_snapshot_attestation" : "migration";
      if (!plan.existingBinding) {
        this.sql.exec(
          `INSERT INTO bindings (occurrence_id, revision_key, cache_key, provenance, bound_at)
           VALUES (?, ?, ?, ?, ?)`,
          r.occurrenceId, r.revisionKey, r.cacheKey, provenance, this._now());
        if (plan.viaProvenance) {
          this.sql.exec(
            `INSERT INTO migration_audit (at, migration_id, book_id, occurrence_id, revision_key,
               cache_key, recorded_identity, attestation_sha256, attestation_json, outcome)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'accepted_provenance')`,
            this._now(), p.migrationId, bookId, r.occurrenceId, r.revisionKey,
            r.cacheKey, plan.recordedIdentity,
            sha256HexText(canonicalJson(r.provenanceAttestation)),
            canonicalJson(r.provenanceAttestation));
        }
      }
      // The cache_index anchor write mirrors validateAndBind's
      // exactly: an existing identity/sha is never silently replaced.
      this.sql.exec(
        `INSERT INTO cache_index (cache_key, identity, format, sha256, recorded_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(cache_key) DO UPDATE SET identity = COALESCE(cache_index.identity, excluded.identity),
           format = excluded.format, sha256 = COALESCE(cache_index.sha256, excluded.sha256),
           recorded_at = excluded.recorded_at`,
        r.cacheKey, r.revisionKey.startsWith("legacy:") ? null : r.revisionKey,
        fact.format, fact.computedSha256, this._now());
      const cur = this._syncEntity("bindings", `${bookId}:${r.occurrenceId}`);
      const curData = cur && !cur.deleted ? JSON.parse(cur.data_json || "{}") : null;
      if (!curData || canonicalJson(curData) !== canonicalJson(plan.syncData))
        this._upsertSyncEntity("bindings", `${bookId}:${r.occurrenceId}`, bookId, plan.syncData);
      plan.cert.status = plan.idempotent ? "accepted_idempotent"
        : plan.viaProvenance ? "accepted_provenance" : "accepted";
    }
    for (const c of certRows) {
      if (c.status === "accepted") certificate.totals.accepted++;
      else if (c.status === "accepted_idempotent") certificate.totals.acceptedIdempotent++;
      else if (c.status === "accepted_provenance") certificate.totals.acceptedProvenance++;
    }
    this._logTransition("book", bookId, "MigrateImportBindings", null, "imported",
      null, { commandId, migrationId: p.migrationId, rows: certRows.length });
    return { outcome: "applied", bookId, migrationId: p.migrationId, certificate };
  }

  // ---- D3 chunked import (design §10). The pre-execution state
  // check for one chunk command: null for shape problems (the
  // apply step names them), else exactly one of { rejection },
  // { converged }, { ok }. Runs before priming (handleCommand) and
  // again inside the command transaction (the apply step) — the
  // same function, so the two can never drift apart. Everything a
  // chunk may carry is pinned: the freeze digest, the book's row
  // set, the chunk's exact membership/order (a contiguous slice of
  // the pinned rows), and the derived size limits — the caller can
  // match the pin, never define it.
  _migrationChunkState(p, { submitPhase = false } = {}) {
    const bookId = p.bookId || null;
    const rows = Array.isArray(p.rows) ? p.rows : null;
    if (!bookId || !rows || rows.length === 0 || !p.migrationId || !p.freezeDigest ||
        !Number.isInteger(p.chunkIndex) || p.chunkIndex < 0)
      return null; // shape errors are the apply step's to name
    const reject = (reason, extra = {}) =>
      ({ rejection: { outcome: "rejected", reason, bookId, chunkIndex: p.chunkIndex, ...extra } });
    const freeze = this._approvedFreeze();
    if (!freeze || p.freezeDigest !== freeze.snapshotDigest)
      return reject("migration_freeze_unapproved");
    const pinned = this._pinnedBook(bookId);
    if (!pinned) return reject("migration_freeze_unapproved");
    const chunksPin = this._approvedChunks();
    if (!chunksPin || chunksPin.snapshotDigest !== freeze.snapshotDigest ||
        !chunksPin.books || !chunksPin.books[bookId])
      return reject("migration_freeze_unapproved");
    const found = this._pinnedChunk(bookId, p.chunkIndex);
    if (!found) return reject("migration_chunk_mismatch", { field: "chunk_index" });
    const { chunk, rows: chunkRows } = found;
    // Pin integrity: the chunk pin's digest must recompute over
    // the whole-book pin's slice — the two pins can never silently
    // disagree about a chunk's membership.
    const sliceTuples = chunkRows.map(r => [r.occurrenceId, r.revisionKey, r.cacheKey,
      r.size, r.format, r.sha256Prefix, r.etag]);
    if (sha256HexText(canonicalJson(sliceTuples)) !== chunk.rowsSha256)
      return reject("migration_manifest_mismatch");
    // Payload match: exactly the pinned chunk, in pinned order.
    if (rows.length !== chunk.rowCount)
      return reject("migration_chunk_mismatch", { occurrenceId: null });
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i], want = chunkRows[i];
      if (!r || r.occurrenceId !== want.occurrenceId ||
          r.revisionKey !== want.revisionKey || r.cacheKey !== want.cacheKey ||
          !r.manifest || r.manifest.size !== want.size ||
          r.manifest.format !== want.format ||
          typeof r.manifest.sha256 !== "string" ||
          !r.manifest.sha256.startsWith(want.sha256Prefix))
        return reject("migration_chunk_mismatch",
          { occurrenceId: (r && r.occurrenceId) || null });
    }
    // Derived limits (v2/p8/migration-chunk-limits.mjs), enforced
    // over the PINNED chunk before any priming: an oversize item
    // or an over-cap chunk is refused no matter what the caller
    // declares, and costs zero R2 contact.
    for (const r of chunkRows)
      if (r.size > MIGRATION_CHUNK_LIMITS.maxItemBytes)
        return reject("migration_item_oversize", { occurrenceId: r.occurrenceId });
    if (chunk.rowCount > MIGRATION_CHUNK_LIMITS.maxRowsPerChunk ||
        chunk.totalBytes > MIGRATION_CHUNK_LIMITS.maxChunkBytes)
      return reject("migration_chunk_oversize");
    // B1 (§3A.7, D4-P4 adopted): server-side full-content
    // enforcement. When the book carries a freeze-carry pin, the
    // content this import will use must hash to the pin BEFORE
    // anything is primed or written — this state check runs in
    // handleCommand ahead of priming and again inside the command
    // transaction, so an altered but binding-compatible content
    // payload (swapped POV, reordered chapters, altered segment
    // data or cast) is refused here, at zero R2 contact, with zero
    // migration business rows. (A durable REJECTED command receipt
    // is still recorded by handleCommand — Rowan checkpoint 1:
    // that receipt is the legitimate record of the refusal, not
    // an import row.)
    //
    // B1-C1 (Rowan B1 review 6369823670): the check covers the
    // EFFECTIVE content — every source the apply step could draw
    // on, in its own precedence: this command's presented content,
    // a preexisting content sync entity, and the copy held in the
    // import record from an earlier chunk. The apply step refuses
    // any divergence BETWEEN sources, so the import can only ever
    // proceed when all present sources agree — and the carry is
    // only sound if that agreed content is the pinned content.
    // Verifying just the presented copy left a hole: altered
    // content already sitting in the sync entity (e.g. landed via
    // SyncPush, which does no content verification) with NO
    // content on the chunk command was used unchecked. Now: every
    // present source must hash to the pin, and if NO trustworthy
    // source exists the chunk refuses here too — pre-prime, at
    // zero R2 contact — rather than priming rows for an apply
    // step that could only fail (or worse, bind against content
    // nobody verified).
    const carryPin = this._carryBook(bookId);
    if (carryPin) {
      const sources = [];
      if (p.content) sources.push(p.content);
      const storedEnt = this._syncEntity("content", bookId);
      if (storedEnt && !storedEnt.deleted && storedEnt.data_json) {
        try { sources.push(JSON.parse(storedEnt.data_json)); }
        catch { sources.push(null); }
      }
      const heldRow = this._oneOrNull(
        `SELECT content_json FROM migration_imports WHERE book_id = ?`, bookId);
      if (heldRow && heldRow.content_json) {
        try { sources.push(JSON.parse(heldRow.content_json)); }
        catch { sources.push(null); }
      }
      if (sources.length === 0)
        return reject("migration_content_mismatch");
      for (const src of sources)
        if (!src || typeof src !== "object" ||
            sha256HexText(canonicalJson(src)) !== carryPin.contentSha256)
          return reject("migration_content_mismatch");
    }
    // Durable state: identity fences, convergence, order.
    const imports = this._oneOrNull(
      `SELECT * FROM migration_imports WHERE book_id = ?`, bookId);
    const priorBook = this._oneOrNull(
      `SELECT * FROM migration_books WHERE book_id = ?`, bookId);
    if (imports && (imports.migration_id !== p.migrationId ||
                    imports.freeze_digest !== p.freezeDigest))
      return reject("migration_book_divergence");
    if (priorBook && !imports)
      return reject("migration_book_divergence"); // whole-book imported; not this path
    // Option D submit phase (§3.3.3 Phase 1): validation stops
    // here. Everything above — shape, freeze/chunk/content pins,
    // derived limits, and the identity fences just checked — is
    // a function of the payload, the pins, and durable identity
    // facts; everything below (slot convergence, chunk order)
    // depends on other commands' progress and is an EXECUTION
    // verdict, re-run inside T3 by the ordinary path. A submit
    // that passes here pends; it has primed nothing and written
    // nothing.
    if (submitPhase) return { ok: true, submitPhase: true, pinned, chunk, chunkRows,
      imports, chunksExpected: imports ? imports.chunks_expected : found.bookChunks.chunkCount };
    const slots = this._all(
      `SELECT * FROM migration_chunks WHERE book_id = ? ORDER BY chunk_index`, bookId);
    const slot = slots.find(s2 => s2.chunk_index === p.chunkIndex);
    if (slot) {
      if (slot.migration_id !== p.migrationId)
        return reject("migration_book_divergence");
      return { converged: { slot, imports,
        chunksExpected: imports ? imports.chunks_expected : slots.length } };
    }
    const appliedIdx = new Set(slots.map(s2 => s2.chunk_index));
    for (let i = 0; i < p.chunkIndex; i++)
      if (!appliedIdx.has(i))
        return reject("migration_chunk_out_of_order", { expectedChunk: i });
    if (appliedIdx.size !== p.chunkIndex)
      return reject("migration_chunk_out_of_order", { expectedChunk: p.chunkIndex });
    return { ok: true, pinned, chunk, chunkRows, imports,
             chunksExpected: imports ? imports.chunks_expected : found.bookChunks.chunkCount };
  }

  // Apply one chunk of a book's migration import. Each chunk
  // primes + byte-verifies ONLY its own rows (the shared three-way
  // validator), persists its class-C evidence, and commits
  // atomically: any blocked row rejects the whole chunk and
  // nothing of it is applied. Applied chunks write the SQL
  // evidence planes (bindings, cache anchors, provenance audit)
  // but NO sync entity — partial state is invisible to clients —
  // and no import record exists, so the flip gate cannot pass.
  // When the final chunk lands, the SAME transaction derives the
  // one whole-book certificate from all chunks' persisted evidence
  // (the G3 formula over the whole book), anchors it, and
  // materializes the sync plane: the book becomes visible
  // atomically, with its certificate, exactly as a whole-book
  // import would have left it.
  _migrateImportChunk(p, commandId, facts) {
    const bookId = p.bookId || null;
    const rows = Array.isArray(p.rows) ? p.rows : null;
    if (!bookId || !rows || rows.length === 0 || !p.migrationId || !p.freezeDigest ||
        !Number.isInteger(p.chunkIndex) || p.chunkIndex < 0)
      return { outcome: "rejected", reason: "migration_shape", bookId };
    if (this._bookTombstoned(bookId))
      return { outcome: "rejected", reason: "rejected_tombstoned", bookId };
    const seenOcc = new Set();
    for (const r of rows) {
      if (!r || !r.occurrenceId || !r.revisionKey || !r.cacheKey ||
          !r.manifest || typeof r.manifest.sha256 !== "string" ||
          typeof r.manifest.size !== "number" || !r.manifest.format)
        return { outcome: "rejected", reason: "migration_shape", bookId };
      if (seenOcc.has(r.occurrenceId))
        return { outcome: "rejected", reason: "duplicate_row", bookId,
                 occurrenceId: r.occurrenceId };
      seenOcc.add(r.occurrenceId);
    }
    const st = this._migrationChunkState(p);
    if (st && st.rejection) return st.rejection;
    if (st && st.converged) {
      // Already applied under another command id: converge on the
      // recorded state. No priming happened for this command
      // (handleCommand's precheck saw the same slot), no effect is
      // repeated — the single recorded application stands.
      const applied = this._all(
        `SELECT chunk_index FROM migration_chunks WHERE book_id = ?`, bookId).length;
      const done = !!(st.converged.imports && st.converged.imports.completed_at);
      return { outcome: "applied", bookId, migrationId: p.migrationId,
        chunkIndex: p.chunkIndex, converged: true,
        chunksApplied: applied, chunksExpected: st.converged.chunksExpected,
        bookComplete: done,
        certificateSha256: done ? st.converged.imports.certificate_sha256 : null };
    }
    if (!st || !st.ok) // unreachable: the state check covers every other case
      return { outcome: "rejected", reason: "migration_shape", bookId };
    const { pinned, chunk, imports } = st;
    const chunksExpected = st.chunksExpected;

    // Content: already present as a sync entity, held in the chunk
    // bookkeeping from an earlier chunk, or carried by this one.
    // The first applied chunk must supply it (or it must already
    // exist); a carried copy that disagrees with the held/stored
    // one is a divergence. The sync content entity itself is
    // written only at completion.
    const contentEnt = this._syncEntity("content", bookId);
    let heldContent = null, contentPlan = "present";
    if (contentEnt) {
      if (p.content &&
          canonicalJson(JSON.parse(contentEnt.data_json || "{}")) !== canonicalJson(p.content))
        return { outcome: "rejected", reason: "content_divergence", bookId };
    } else if (imports && imports.content_json) {
      heldContent = JSON.parse(imports.content_json);
      if (p.content && canonicalJson(heldContent) !== canonicalJson(p.content))
        return { outcome: "rejected", reason: "content_divergence", bookId };
      contentPlan = "held";
    } else if (p.content) {
      heldContent = p.content; contentPlan = "held";
    } else {
      return { outcome: "rejected", reason: "unknown_book", bookId };
    }
    const effectiveContent = contentEnt
      ? JSON.parse(contentEnt.data_json || "{}") : heldContent;
    const occIds = Array.isArray(effectiveContent && effectiveContent.occurrenceIds)
      ? effectiveContent.occurrenceIds : null;
    if (!occIds) return { outcome: "rejected", reason: "migration_shape", bookId };
    for (const r of rows)
      if (!occIds.includes(r.occurrenceId))
        return { outcome: "rejected", reason: "unknown_occurrence", bookId,
                 occurrenceId: r.occurrenceId };

    // Validate every row of THIS chunk (the shared validator, with
    // the sync plane deferred). Any blocked row rejects the whole
    // chunk; earlier chunks stand untouched.
    const { certRows, plans, firstBlock } = this._validateMigrationRows({
      bookId, freezeDigest: p.freezeDigest, rows, pinned, facts, deferSync: true });
    const certificate = { bookId, migrationId: p.migrationId,
      freezeDigest: p.freezeDigest, commandId, chunkIndex: p.chunkIndex,
      rows: certRows,
      totals: { rows: certRows.length, accepted: 0, acceptedIdempotent: 0,
                acceptedProvenance: 0, blocked: 0 } };
    if (firstBlock) {
      for (const c of certRows) {
        c.status = "blocked";
        if (!c.reason) c.reason = "chunk_rejected";
      }
      certificate.totals.blocked = certRows.length;
      return { outcome: "rejected", reason: firstBlock, bookId,
               chunkIndex: p.chunkIndex, certificate };
    }

    // ---- apply this chunk (inside the command transaction): the
    // SQL evidence planes + the chunk record with its persisted
    // class-C evidence. NO sync entity is written here.
    const now = this._now();
    if (!imports) {
      this.sql.exec(
        `INSERT INTO migration_imports (book_id, migration_id, freeze_digest, content_json,
           chunks_expected, started_at, completed_at, certificate_sha256)
         VALUES (?, ?, ?, ?, ?, ?, NULL, NULL)`,
        bookId, p.migrationId, p.freezeDigest,
        contentPlan === "held" ? canonicalJson(heldContent) : null,
        chunksExpected, now);
    }
    for (const plan of plans) {
      const r = plan.row, fact = facts.get(r.cacheKey);
      const provenance = plan.viaProvenance
        ? "migration:freeze_snapshot_attestation" : "migration";
      this.sql.exec(
        `INSERT INTO bindings (occurrence_id, revision_key, cache_key, provenance, bound_at)
         VALUES (?, ?, ?, ?, ?)`,
        r.occurrenceId, r.revisionKey, r.cacheKey, provenance, now);
      if (plan.viaProvenance) {
        this.sql.exec(
          `INSERT INTO migration_audit (at, migration_id, book_id, occurrence_id, revision_key,
             cache_key, recorded_identity, attestation_sha256, attestation_json, outcome)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'accepted_provenance')`,
          now, p.migrationId, bookId, r.occurrenceId, r.revisionKey,
          r.cacheKey, plan.recordedIdentity,
          sha256HexText(canonicalJson(r.provenanceAttestation)),
          canonicalJson(r.provenanceAttestation));
      }
      this.sql.exec(
        `INSERT INTO cache_index (cache_key, identity, format, sha256, recorded_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(cache_key) DO UPDATE SET identity = COALESCE(cache_index.identity, excluded.identity),
           format = excluded.format, sha256 = COALESCE(cache_index.sha256, excluded.sha256),
           recorded_at = excluded.recorded_at`,
        r.cacheKey, r.revisionKey.startsWith("legacy:") ? null : r.revisionKey,
        fact.format, fact.computedSha256, now);
      plan.cert.status = plan.viaProvenance ? "accepted_provenance" : "accepted";
    }
    for (const c of certRows) {
      if (c.status === "accepted") certificate.totals.accepted++;
      else if (c.status === "accepted_provenance") certificate.totals.acceptedProvenance++;
    }
    const chunkRowsSha256 = this._chunkRowsDigest(rows);
    this.sql.exec(
      `INSERT INTO migration_chunks (book_id, chunk_index, migration_id, rows_sha256,
         row_count, total_bytes, evidence_json, command_id, applied_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      bookId, p.chunkIndex, p.migrationId, chunkRowsSha256, rows.length,
      chunk.totalBytes, canonicalJson(certRows), commandId, now);
    this._logTransition("book", bookId, "MigrateImportChunk", null, "chunk_applied",
      null, { commandId, migrationId: p.migrationId, chunkIndex: p.chunkIndex,
              rows: rows.length });

    const appliedCount = this._all(
      `SELECT chunk_index FROM migration_chunks WHERE book_id = ?`, bookId).length;
    const result = { outcome: "applied", bookId, migrationId: p.migrationId,
      chunkIndex: p.chunkIndex, chunksApplied: appliedCount,
      chunksExpected, bookComplete: false, certificateSha256: null, certificate };
    if (appliedCount < chunksExpected) return result;

    // ---- whole-book completion, in the SAME transaction as the
    // final chunk: derive the ONE server-side whole-book
    // certificate from ALL chunks' persisted evidence (the G3
    // formula over the whole book — never a chain of chunk
    // certificates), anchor it in the import record, and only NOW
    // materialize the sync plane, so the book becomes visible
    // atomically with its certificate, exactly as a whole-book
    // import would have left it.
    const slots = this._all(
      `SELECT * FROM migration_chunks WHERE book_id = ? ORDER BY chunk_index`, bookId);
    const evidenceRows = [];
