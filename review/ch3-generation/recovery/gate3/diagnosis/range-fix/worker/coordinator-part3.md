    try { p = JSON.parse(rec.payload_json); } catch { return neither; }
    const bookId = p.bookId || null;
    switch (rec.type) {
      case "MigrateImportChunk": {
        const slot = this._oneOrNull(
          `SELECT * FROM migration_chunks WHERE book_id = ? AND chunk_index = ?`,
          bookId, p.chunkIndex);
        if (slot) return { complete: this._chunkEffectsVerified(rec, p, slot),
                           zero: false };
        const pinned = this._pinnedChunk(bookId, p.chunkIndex);
        if (!pinned) return neither;
        let bound = 0;
        for (const r of pinned.rows) {
          const b = this._oneOrNull(
            `SELECT occurrence_id FROM bindings WHERE occurrence_id = ? AND revision_key = ?`,
            r.occurrenceId, r.revisionKey);
          if (b) bound++;
        }
        return { complete: false, zero: bound === 0 };
      }
      case "MigrateImportBindings": {
        const book = this._oneOrNull(
          `SELECT * FROM migration_books WHERE book_id = ?`, bookId);
        if (book) return { complete: this._bindingsEffectsVerified(p, book),
                           zero: false };
        const pinned = this._pinnedBook(bookId);
        if (!pinned) return neither;
        let bound = 0;
        for (const r of pinned.rows) {
          const b = this._oneOrNull(
            `SELECT occurrence_id FROM bindings WHERE occurrence_id = ? AND revision_key = ?`,
            r.occurrenceId, r.revisionKey);
          if (b) bound++;
        }
        return { complete: false, zero: bound === 0 };
      }
      case "MigrateImportPositions": {
        const carry = this._carryAuditRow(bookId, "positions");
        const payloadHash = sha256HexText(canonicalJson({ bookId,
          position: { occurrenceId: p.position.occurrenceId, offsetSec: p.position.offsetSec },
          checkpoints: p.checkpoints }));
        if (carry) return { complete:
          carry.command_id === rec.command_id &&
          carry.payload_hash === payloadHash &&
          this._auditRowIntact(carry) &&
          this._storedPositionMatches(bookId, p) &&
          this._carryVerificationOk(rec, bookId, "positions"), zero: false };
        const st = this._oneOrNull(
          `SELECT book_id FROM position_state WHERE book_id = ?`, bookId);
        return { complete: false, zero: !st };
      }
      case "MigrateImportJobs": {
        const carry = this._carryAuditRow(bookId, "jobs");
        const { setSha256 } = this._jobsDescriptor(p);
        if (carry) return { complete:
          carry.command_id === rec.command_id &&
          carry.payload_hash === setSha256 &&
          this._auditRowIntact(carry) &&
          this._storedJobsMatch(bookId, p) &&
          this._carryVerificationOk(rec, bookId, "jobs"), zero: false };
        let existing = 0;
        for (const a of p.aggregates || []) {
          const j = this._oneOrNull(`SELECT job_id FROM jobs WHERE job_id = ?`, a.jobId);
          if (j) existing++;
        }
        return { complete: false, zero: existing === 0 };
      }
      case "MigrateRecordFlipGate": {
        const gate = this._oneOrNull(
          `SELECT * FROM migration_gates WHERE book_id = ?`, bookId);
        if (gate) return { complete: this._gateEffectsVerified(rec, p, gate),
                           zero: false };
        return { complete: false, zero: true };
      }
      default: return neither;
    }
  }

  // Chunk `complete`: the slot must be THIS command's — written
  // by it (command attribution), under its migration — and its
  // persisted evidence must recompute exactly: the row digest
  // over the pending record's own stored rows, the row count,
  // and the class-C evidence rows verifying field-for-field
  // against the command's rows and (where pinned) the frozen
  // chunk partition, including the pinned byte total. AND
  // (Correction 2, Rowan re-review 6375091653, B1) the ACTUAL
  // rows the chunk applied — the live bindings / cache_index
  // records and any required provenance attestation — must
  // still be present and exact: the slot and its evidence are
  // the apply's summary of its effects, and a summary is not
  // the effects.
  _chunkEffectsVerified(rec, p, slot) {
    const rows = Array.isArray(p.rows) ? p.rows : [];
    if (slot.migration_id !== p.migrationId) return false;
    if (slot.command_id !== rec.command_id) return false;
    if (slot.row_count !== rows.length) return false;
    if (slot.rows_sha256 !== this._chunkRowsDigest(rows)) return false;
    let evidence;
    try { evidence = JSON.parse(slot.evidence_json); } catch { return false; }
    if (!Array.isArray(evidence) || evidence.length !== rows.length) return false;
    const byOcc = new Map(evidence.map(e => [e && e.occurrenceId, e]));
    if (byOcc.size !== evidence.length) return false;
    for (const r of rows) {
      const ev = byOcc.get(r.occurrenceId);
      if (!ev) return false;
      if (ev.revisionKey !== r.revisionKey || ev.cacheKey !== r.cacheKey) return false;
      if (ev.manifestSha256 !== r.manifest.sha256) return false;
      if (ev.computedSha256 !== r.manifest.sha256) return false;
      if (ev.verified !== true) return false;
      if (ev.status !== "accepted" && ev.status !== "accepted_provenance") return false;
    }
    const pinned = this._pinnedChunk(p.bookId, p.chunkIndex);
    if (pinned) {
      if (slot.total_bytes !== pinned.chunk.totalBytes) return false;
      if (rows.length !== pinned.rows.length) return false;
      const pinnedByOcc = new Map(pinned.rows.map(r => [r.occurrenceId, r]));
      for (const r of rows) {
        const want = pinnedByOcc.get(r.occurrenceId);
        if (!want || want.revisionKey !== r.revisionKey ||
            want.cacheKey !== r.cacheKey) return false;
      }
    }
    // Correction 2 (B1): verify the live applied rows, not only
    // the slot's reported evidence.
    return this._chunkAppliedRowsVerified(p, rows, byOcc, pinned);
  }

  // The live-rows leg of the chunk audit (Correction 2, Rowan
  // re-review 6375091653, B1). For each exact pinned row of the
  // command, SELECT the records the apply wrote and compare
  // them against the slot evidence and the immutable pins —
  // database rows only, no R2 sends. Any missing or divergent
  // row returns false (the audit's `neither`), however intact
  // the slot, its evidence and the commands receipt remain.
  // The expectations mirror _migrationCompleteness — the
  // forensic standard the flip gate already trusts — at chunk
  // scope:
  //   bindings:    keyed (occurrence, revision) — cache_key and
  //                provenance ("migration", or
  //                "migration:freeze_snapshot_attestation" when
  //                the slot evidence's status for the row is
  //                accepted_provenance — the apply's own record
  //                of which path it took);
  //   cache_index: keyed by cache_key — format, SHA-256, and
  //                the applicable identity (the revision key;
  //                for a legacy row, null or the cache key
  //                itself — the two values an honest apply can
  //                have anchored);
  //   attestation: an accepted_provenance row additionally
  //                requires its migration_audit record, intact
  //                and field-equal (see below).
  _chunkAppliedRowsVerified(p, rows, byOcc, pinned) {
    const pinnedByOcc = pinned
      ? new Map(pinned.rows.map(r => [r.occurrenceId, r])) : new Map();
    for (const r of rows) {
      const ev = byOcc.get(r.occurrenceId);
      const wantProvenance = ev.status === "accepted_provenance"
        ? "migration:freeze_snapshot_attestation" : "migration";
      const b = this._oneOrNull(
        `SELECT * FROM bindings WHERE occurrence_id = ? AND revision_key = ?`,
        r.occurrenceId, r.revisionKey);
      if (!b) return false;
      if (b.cache_key !== r.cacheKey) return false;
      if (b.provenance !== wantProvenance) return false;
      const idx = this._oneOrNull(
        `SELECT * FROM cache_index WHERE cache_key = ?`, r.cacheKey);
      if (!idx) return false;
      if (idx.format !== r.manifest.format) return false;
      if (idx.sha256 !== r.manifest.sha256) return false;
      const identityOk = r.revisionKey.startsWith("legacy:")
        ? (idx.identity === null || idx.identity === r.cacheKey)
        : idx.identity === r.revisionKey;
      if (!identityOk) return false;
      if (ev.status === "accepted_provenance" &&
          !this._chunkProvenanceAuditVerified(p, r, pinnedByOcc.get(r.occurrenceId)))
        return false;
    }
    return true;
  }

  // The provenance leg of the chunk audit: the migration_audit
  // row a provenance-accepted row's apply wrote must be present,
  // singular, and THIS migration's; its stored attestation must
  // be intact (the recorded fingerprint recomputes over the
  // stored attestation JSON) and field-equal to the attestation
  // the COMMAND carried — snapshot digest, bookkeeping identity,
  // manifest facts, and (where the chunk is pinned) the pinned
  // row's etag. A corrupted or rewritten attestation earns the
  // chunk no completion credit.
  _chunkProvenanceAuditVerified(p, r, pinnedRow) {
    const att = r.provenanceAttestation || null;
    if (!att) return false;
    const list = this._all(
      `SELECT * FROM migration_audit WHERE book_id = ? AND occurrence_id = ?`,
      p.bookId, r.occurrenceId);
    if (list.length !== 1) return false;
    const a = list[0];
    if (a.migration_id !== p.migrationId) return false;
    if (a.revision_key !== r.revisionKey || a.cache_key !== r.cacheKey) return false;
    if (a.outcome !== "accepted_provenance") return false;
    let stored;
    try { stored = JSON.parse(a.attestation_json); } catch { return false; }
    if (a.attestation_sha256 !== sha256HexText(a.attestation_json)) return false;
    if (canonicalJson(stored) !== canonicalJson(att)) return false;
    if (stored.bookId !== p.bookId || stored.occurrenceId !== r.occurrenceId ||
        stored.revisionKey !== r.revisionKey || stored.cacheKey !== r.cacheKey ||
        stored.sha256 !== r.manifest.sha256 || stored.size !== r.manifest.size ||
        stored.format !== r.manifest.format ||
        stored.snapshotDigest !== p.freezeDigest) return false;
    if (pinnedRow && stored.r2Etag !== pinnedRow.etag) return false;
    return true;
  }

  // Whole-book `complete`: the import record must be internally
  // intact (its stored row set hashes to its stored digest),
  // must describe exactly THIS command's row set, and both
  // planes must pass the shared exact completeness computation
  // (B1/G4 — the same one the flip gate trusts). Attribution
  // rides on the commands receipt binding in
  // reconcileMigrationCommand: migration_books carries no
  // command column, so the audit proves the effect set and the
  // receipt proves whose execution wrote it.
  _bindingsEffectsVerified(p, book) {
    const rows = Array.isArray(p.rows) ? p.rows : [];
    if (book.migration_id !== p.migrationId) return false;
    if (book.freeze_digest !== p.freezeDigest) return false;
    if (book.row_count !== rows.length) return false;
    let storedRows;
    try { storedRows = JSON.parse(book.rows_json); } catch { return false; }
    if (sha256HexText(book.rows_json) !== book.rows_sha256) return false;
    if (!Array.isArray(storedRows) || storedRows.length !== rows.length) return false;
    const byOcc = new Map(storedRows.map(r => [r && r.occurrenceId, r]));
    if (byOcc.size !== storedRows.length) return false;
    for (const r of rows) {
      const s = byOcc.get(r.occurrenceId);
      if (!s || s.revisionKey !== r.revisionKey || s.cacheKey !== r.cacheKey ||
          s.sha256 !== r.manifest.sha256 || s.size !== r.manifest.size ||
          s.format !== r.manifest.format) return false;
    }
    return this._migrationCompleteness(p.bookId).complete === true;
  }

  // A carry audit row is evidence only if it is internally
  // intact: its stored payload hashes to its stored hash.
  _auditRowIntact(row) {
    try { return sha256HexText(row.payload_json) === row.payload_hash; }
    catch { return false; }
  }

  // The stored position_state row must BE the position this
  // command carried (occurrence + offset), not merely exist
  // alongside a matching carry marker.
  _storedPositionMatches(bookId, p) {
    if (!p.position) return false;
    const st = this._oneOrNull(
      `SELECT * FROM position_state WHERE book_id = ?`, bookId);
    return !!st && st.occurrence_id === p.position.occurrenceId &&
           st.offset_sec === p.position.offsetSec;
  }

  // Every aggregate this command carried must exist as a stored
  // job in exactly the state the command named. (An empty
  // aggregate set is bound by the carry row's set hash alone.)
  _storedJobsMatch(bookId, p) {
    for (const a of p.aggregates || []) {
      const j = this._oneOrNull(`SELECT * FROM jobs WHERE job_id = ?`, a.jobId);
      if (!j || j.state !== a.v2State || j.book_id !== bookId) return false;
    }
    return true;
  }

  // The B1 carry verification as the audit's pin leg, scoped to
  // THIS kind: when a carry pin applies to the book, its leg
  // must be divergence-free, its carry/receipt records present,
  // and the carry must name THIS command. Without a pin there
  // is nothing further to verify against — the carry row's own
  // attribution + integrity + stored-state checks above carry
  // the proof.
  _carryVerificationOk(rec, bookId, kind) {
    const v = this._migrationCarryVerification(bookId);
    if (!v.applicable) return true;
    const leg = kind === "positions" ? v.positions : v.jobs;
    if (!leg || leg.commandId !== rec.command_id) return false;
    const missingForKind = kind === "positions"
      ? ["positions_carry", "positions_receipt", "position_state"]
      : ["jobs_carry", "jobs_receipt"];
    if (v.missing.some(m => missingForKind.includes(m))) return false;
    return !v.divergences.some(d => d.element === kind);
  }

  // Gate `complete`: the gate row must name this migration and
  // the certificate the command carried, and that certificate
  // must be the one ANCHORED server-side — in the book record
  // and, for a chunked import, the import record — with both
  // planes exactly complete and (where a carry pin applies) the
  // required carries verified. A gate row echoing a caller's
  // certificate over the wrong book proves nothing. AND
  // (Correction 2, Rowan re-review 6375091653, B2) the gate
  // record must be attributable to THIS command: the gate's
  // stored detail names the command that created it, and that
  // name must equal the pending record's id exactly — a gate
  // flipped by a different command earns this one no credit.
  _gateEffectsVerified(rec, p, gate) {
    if (gate.migration_id !== p.migrationId) return false;
    if (gate.certificate_sha256 !== p.certificateSha256) return false;
    let detail;
    try { detail = JSON.parse(gate.detail_json); } catch { return false; }
    if (!detail || detail.commandId !== rec.command_id) return false;
    const book = this._oneOrNull(
      `SELECT * FROM migration_books WHERE book_id = ?`, p.bookId);
    if (!book || book.certificate_sha256 !== p.certificateSha256) return false;
    const imports = this._oneOrNull(
      `SELECT * FROM migration_imports WHERE book_id = ?`, p.bookId);
    if (imports && (imports.completed_at === null ||
                    imports.certificate_sha256 !== p.certificateSha256)) return false;
    if (this._migrationCompleteness(p.bookId).complete !== true) return false;
    const v = this._migrationCarryVerification(p.bookId);
    if (v.applicable && !v.ok) return false;
    return true;
  }

  // NOTE (Blocker B correction, Rowan 6374624466): there is
  // deliberately NO receipt-reconstruction helper anymore.
  // T3 commits a command's business effects, its commands-row
  // receipt, and its pending-record receipt in ONE transaction
  // — so a state whose effects are complete but whose durable
  // receipt is missing cannot be the product of any execution
  // this code performs. Reconstructing a receipt for such a
  // state would fabricate the very evidence reconciliation
  // exists to verify. Reconciliation therefore settles
  // `applied` ONLY on the existing durable receipt (bound to
  // this record, below); a receipt-less record stays
  // needs_reconciliation — STOP, manual investigation —
  // however complete its effects appear.

  // Manual reconciliation (the control route, §3.3.1/§3.3.5) —
  // the ONLY write path that settles a needs_reconciliation
  // record to a final state. MANDATORY SECURITY DISCIPLINE
  // (Rowan 6373710222): the caller's `outcome` and `evidence`
  // are REQUESTS, never proofs. The verdict is recomputed HERE,
  // server-side, inside this transaction — the durable claim,
  // any existing receipt, and the actual business-effect
  // rows/pins — and a request whose claimed outcome contradicts
  // the verified state fails closed: the uncertain record is
  // preserved untouched, and nothing is granted, executed, or
  // marked complete. This route NEVER executes a migration
  // command, and no approval-path fence (T2 claim, T3
  // owner/state/lease) can be bypassed through it: it can only
  // settle a record a claim already left uncertain.
  reconcileMigrationCommand({ commandId, outcome, evidence } = {}) {
    // The outcome vocabulary is the route's own (applied /
    // refused). Anything else — including the receipt
    // vocabulary's "rejected" — fails closed here too, not only
    // at the API schema fence: an unrecognized outcome must
    // never fall through to a settlement branch.
    if (outcome !== "applied" && outcome !== "refused")
      return { ok: false, error: "malformed_reconciliation", command_id: commandId ?? null };
    return this._tx(() => {
      const now = this._now();
      let rec = this._pendingRecord(commandId);
      if (!rec)
        return { ok: false, error: "pending_command_not_found", command_id: commandId };
      // The one place besides T1/T2 where a lapsed-lease
      // executing record may be materialized (§3.3.2): this
      // route, inside its own transaction, before settling.
      if (rec.state === "executing") this._materializePending(rec, now);
      rec = this._pendingRecord(commandId);
      if (rec.state !== "needs_reconciliation")
        return { ok: false, error: "not_reconcilable", command_id: commandId,
                 state: this._pendingView(rec, now).state };
      // Server-side verification. None of these reads consults
      // the request's outcome or evidence in any way.
      const cmdRow = this._oneOrNull(
        `SELECT * FROM commands WHERE command_id = ?`, commandId);
      const receiptObj = cmdRow && cmdRow.outcome_json
        ? JSON.parse(cmdRow.outcome_json) : null;
      // The commands receipt is evidence only if it is BOUND to
      // this pending record: same id (by lookup), same type, and
      // a stored payload that hashes to the pending record's
      // digest. A row naming a different command — or the same
      // id over a different payload — is foreign paperwork.
      let receiptBound = false;
      if (cmdRow && receiptObj) {
        try {
          receiptBound = cmdRow.type === rec.type &&
            this._pendingHashOf({ command_id: cmdRow.command_id, type: cmdRow.type,
              payload: JSON.parse(cmdRow.payload_json) }) === rec.payload_sha256;
        } catch { receiptBound = false; }
      }
      const audit = this._migrationEffectsAudit(rec);
      // A claim must have existed: reconciliation settles a
      // CLAIM's uncertain outcome, nothing else.
      const claimVerified = rec.claimed_at !== null;
      let canApplied = false, canRefused = false, appliedReceipt = null;
      if (receiptBound && cmdRow.outcome === "applied" && audit.complete) {
        canApplied = true; appliedReceipt = receiptObj;
      } else if (receiptBound && cmdRow.outcome === "rejected" && audit.zero) {
        canRefused = true;
      } else if (!cmdRow && audit.zero) {
        canRefused = true;
      }
      // DELIBERATELY ABSENT (Blocker B, Rowan 6374624466): any
      // receipt-less path to `applied`. T3's atomicity means
      // complete effects without the durable commands receipt
      // cannot be one of this command's executions, however
      // pin-exact the effects audit finds them — the audit
      // still reports effectsComplete truthfully below, but
      // settlement refuses and the record stays
      // needs_reconciliation for manual investigation. This
      // route never invents a receipt.
      canApplied = canApplied && claimVerified;
      canRefused = canRefused && claimVerified;
      const verification = { claimRecorded: claimVerified,
        receiptPresent: !!receiptObj, receiptBound,
        payloadIntegrity: this._pendingIntegrityOk(rec),
        effectsComplete: audit.complete, effectsZero: audit.zero };
      if (outcome === "applied" && !canApplied)
        return { ok: false, error: "reconciliation_evidence_mismatch",
                 command_id: commandId, state: "needs_reconciliation", verification };
      if (outcome === "refused" && !canRefused)
        return { ok: false, error: "reconciliation_evidence_mismatch",
                 command_id: commandId, state: "needs_reconciliation", verification };
      const detail = JSON.stringify({ reconciled: true, settledAt: now,
        evidenceCited: evidence ?? null, verification });
      if (outcome === "applied") {
        this.sql.exec(
          `UPDATE pending_commands SET state = 'applied', receipt_json = ?, detail_json = ?
           WHERE command_id = ?`,
          JSON.stringify(appliedReceipt), detail, commandId);
        return this._pendingView(this._pendingRecord(commandId), now);
      }
      const refusal = receiptBound && cmdRow.outcome === "rejected"
        ? receiptObj : { outcome: "rejected", reason: "reconciled_abandoned" };
      this.sql.exec(
        `UPDATE pending_commands SET state = 'refused', receipt_json = ?, detail_json = ?
         WHERE command_id = ?`,
        JSON.stringify(refusal), detail, commandId);
      return this._pendingView(this._pendingRecord(commandId), now);
    });
  }

  _applyCommand(type, p, commandId, prepared = null) {
    switch (type) {
      case "SubmitJob": return this._submitJob(p, commandId, "job");
      case "RequestRepair": return this._submitJob(p, commandId, "repair");
      case "RequestPause": {
        const r = this.applyJobEvent(p.jobId, "pause", "RequestPause", { commandId });
        return r.ok ? { outcome: "applied", state: r.state, revision: r.revision }
                    : { outcome: "rejected", reason: r.reason };
      }
      case "RequestCancel": {
        const r = this.applyJobEvent(p.jobId, "cancel", "RequestCancel", { commandId });
        return r.ok ? { outcome: "applied", state: r.state, revision: r.revision }
                    : { outcome: "rejected", reason: r.reason };
      }
      case "RequestResume": return this._resume(p, commandId);
      case "RequestSynthesis": return this._requestSynthesis(p, commandId);
      case "AdoptAudio": {
        const v = this.validateAndBind(p);
        return v.bound ? { outcome: "applied", ...v } : { outcome: "rejected", ...v };
      }
      case "ResolveOutcomeUnknown": return this._resolveUnknown(p, commandId);
      case "SetSettings": return this._setSettings(p, commandId);
      case "SyncPush": return this._syncPush(p, commandId);
      case "PushPositionEvents": return this._pushPositionEvents(p, commandId);
      case "DeleteBook": return this._deleteBook(p, commandId);
      case "MigrateImportBindings": return this._migrateImportBindings(p, commandId, prepared);
      case "MigrateRecordFlipGate": return this._migrateRecordFlipGate(p, commandId);
      case "MigrateImportChunk": return this._migrateImportChunk(p, commandId, prepared);
      case "MigrateImportPositions": return this._migrateImportPositions(p, commandId);
      case "MigrateImportJobs": return this._migrateImportJobs(p, commandId);
      case "FreezeDirective": {
        this.sql.exec(`INSERT INTO meta (key, value) VALUES ('frozen', ?)
                       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
          p.freeze ? "1" : "0");
        this._logTransition("account", "account",
          p.freeze ? "FreezeDirective:on" : "FreezeDirective:off", null, null, null, { commandId });
        return { outcome: "applied", frozen: !!p.freeze };
      }
      default: return { outcome: "rejected", reason: "unimplemented" };
    }
  }

  _submitJob(p, commandId, kind) {
    // D6 patch 1 (WS-1; CONTRACTS.md "Coordinator patches"): only
    // when the D6 entry sets env.d6StandardOnly — a lane outside the
    // pinned allowlist is rejected, never honoured. Flag absent =>
    // byte-equivalent behavior.
    if (this.env.d6StandardOnly && !D6_LANE_ALLOWLIST.includes(p.lane || "standard"))
      return { outcome: "rejected", reason: "lane_not_allowed" };
    if (!p.jobId || !Array.isArray(p.occurrences) || p.occurrences.length === 0)
      return { outcome: "rejected", reason: "job_shape" };
    const dupe = this._oneOrNull(`SELECT job_id FROM jobs WHERE job_id = ?`, p.jobId);
    if (dupe) return { outcome: "rejected", reason: "job_exists" };
    const now = this._now();
    this.sql.exec(
      `INSERT INTO jobs (job_id, kind, book_id, chapter_index, lane, state, revision, data_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'queued', 1, ?, ?, ?)`,
      p.jobId, kind, p.bookId || null, p.chapterIndex ?? null, p.lane || "standard",
      JSON.stringify(p.data || {}), now, now);
    for (const o of p.occurrences) {
      this.sql.exec(
        `INSERT INTO occurrences (job_id, occurrence_id, revision_key, state) VALUES (?, ?, ?, 'pending')`,
        p.jobId, o.occurrenceId, o.revisionKey);
    }
    this._logTransition("job", p.jobId, commandId, null, "queued", 1, { kind });
    return { outcome: "applied", jobId: p.jobId, state: "queued", revision: 1 };
  }

  _resume(p, commandId) {
    const job = this._oneOrNull(`SELECT * FROM jobs WHERE job_id = ?`, p.jobId);
    if (!job) return { outcome: "rejected", reason: "job_not_found" };
    if (job.state === "paused_quota") {
      // F5: resume from a quota park is a single-probe grant — exactly one
      // occurrence is dispatched (the probe is the one sanctioned dispatch
      // past an open park); its outcome decides what happens next.
      const g = this._issueGrant(p.jobId, { probe: true, commandId,
        bypassPark: true, jobEvent: "resume_probe", cause: "RequestResume" });
      if (!g.ok) return { outcome: "rejected", reason: g.reason };
      return { outcome: "applied", state: "generating", grantId: g.grantId, probe: true };
    }
    // Work may have settled while the job was paused (in-flight reports
    // landing on a delivered grant): settle FIRST, through the same
    // derivation. If the job is already complete, the resume is
    // satisfied — there is nothing to re-queue and nothing new to
    // dispatch (round 3, fix 4).
    this._deriveJobCompletion(p.jobId, "RequestResume");
    const settled = this._one(`SELECT * FROM jobs WHERE job_id = ?`, p.jobId);
    if (settled.state === "complete")
      return { outcome: "applied", state: "complete", revision: settled.revision };
    const r = this.applyJobEvent(p.jobId, "resume", "RequestResume", { commandId });
    if (!r.ok) return { outcome: "rejected", reason: r.reason };
    // ...and derive again after the resume lands (e.g. the job was
    // re-queued with every occurrence already settled by a reconcile).
    this._deriveJobCompletion(p.jobId, "RequestResume");
    const after = this._one(`SELECT * FROM jobs WHERE job_id = ?`, p.jobId);
