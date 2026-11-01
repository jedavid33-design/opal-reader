    // chunk (already applied under another command id) primes
    // nothing; a rejected chunk primes nothing. The apply step
    // re-runs the identical check inside the transaction.
    if (cmd.type === "MigrateImportChunk") {
      const st = this._migrationChunkState(cmd.payload || {});
      if (st && st.ok) prepared = await this._prepareMigrationImport(cmd.payload || {});
    }
    await this.wake();
    const outcome = this._tx(() => this._recordAndApply(cmd, prepared));
    await this._armAlarmIfEarlier(); // the command may have scheduled earlier work
    return { command_id: cmd.command_id, ...outcome };
  }

  // The record+apply block of handleCommand, shared verbatim
  // with the Option D T3 step so an approved execution is
  // indistinguishable from the legacy dispatch: insert the
  // commands row, apply, record the outcome. Caller holds the
  // transaction.
  _recordAndApply(cmd, prepared) {
    this.sql.exec(
      `INSERT INTO commands (command_id, type, payload_json, received_at, outcome)
       VALUES (?, ?, ?, ?, 'recorded')`,
      cmd.command_id, cmd.type, JSON.stringify(cmd.payload || {}), this._now());
    let result;
    if (this._frozen() && cmd.type !== "FreezeDirective")
      result = { outcome: "rejected", reason: "frozen" };
    else
      result = this._applyCommand(cmd.type, cmd.payload || {}, cmd.command_id, prepared);
    this.sql.exec(`UPDATE commands SET outcome = ?, outcome_json = ? WHERE command_id = ?`,
      result.outcome, JSON.stringify(result), cmd.command_id);
    return result;
  }

  // ============ Option D: two-phase migration commands =============
  // (Transport plan update Part 3, Revision 3; Rowan final design
  // review 6373710222.) The four production migration command
  // types no longer execute on submission. The client credential
  // SUBMITS: T1 validates (chunk mandate at the fences, shape,
  // chunk-1 content pin — failures are durable refusals, never
  // pending) and stores the command verbatim + inert as
  // pending_operator with a server-computed canonical hash. The
  // operator credential APPROVES on a separate request naming
  // only (commandId, payloadSha256): T2 claims atomically, the
  // existing preparation runs OUTSIDE any transaction, and T3
  // applies + records the final receipt under the ORIGINAL
  // command id, re-checking owner + state + lease validity
  // inside the transaction. Execution itself is _recordAndApply —
  // every execution-time fence (pins, carry completeness,
  // flip-gate comparisons) runs exactly as before. Reads are
  // pure (I2): they PROJECT overdue/expired and stale-claim
  // states and persist nothing; durable transitions materialize
  // only at mutation entry points (T1 duplicate submit, T2, the
  // reconciliation route). An uncertain execution outcome is
  // needs_reconciliation: manual, evidence-verified settlement
  // only, never an automatic redo (invariant 6, §3.3.6).

  _pendingTtlMs() { return this.env.pendingCommandTtlMs ?? PENDING_COMMAND_TTL_MS; }
  _claimLeaseMs() { return this.env.claimLeaseMs ?? CLAIM_LEASE_MS; }

  // The canonical command the payload hash binds: the command
  // id, its type, and the payload EXACTLY as submitted. A single
  // differing byte anywhere — id, type, or any payload field —
  // is a different command (§3.3.6 invariant 2).
  _pendingHashOf(cmd) {
    return sha256HexText(canonicalJson({
      command_id: cmd.command_id, type: cmd.type, payload: cmd.payload || {} }));
  }

  // The stored record's own integrity (§3.3.6 invariant 2):
  // the canonical hash RECOMPUTED over the record's stored
  // (command_id, type, payload) must equal the digest T1
  // stored. Anything else — a rewritten payload_json, a
  // divergent stored type, a tampered stored digest, an
  // unparseable payload — means the record no longer names
  // the command that was submitted, and every later step
  // (T2 claim, T3 apply, reconciliation) fails closed on it.
  // Comparing an operator-supplied digest against the stored
  // digest alone is NOT this check: a payload rewritten under
  // an intact digest would pass that comparison.
  _pendingIntegrityOk(rec) {
    try {
      return this._pendingHashOf({ command_id: rec.command_id, type: rec.type,
        payload: JSON.parse(rec.payload_json) }) === rec.payload_sha256;
    } catch { return false; }
  }

  // The canonical per-chunk row-set digest (§10): the exact
  // rows a chunk command carries, occurrence-sorted. Computed
  // identically by the chunk apply (which persists it on the
  // migration_chunks slot) and by the reconciliation effects
  // audit (which recomputes it from the pending record's
  // stored payload), so the two can never drift apart.
  _chunkRowsDigest(rows) {
    const canonicalChunkRows = (rows || [])
      .map(r => ({ occurrenceId: r.occurrenceId, revisionKey: r.revisionKey,
                   cacheKey: r.cacheKey, sha256: r.manifest && r.manifest.sha256,
                   size: r.manifest && r.manifest.size,
                   format: r.manifest && r.manifest.format }))
      .sort((a, b) => (a.occurrenceId < b.occurrenceId ? -1 : 1));
    return sha256HexText(canonicalJson(canonicalChunkRows));
  }

  _pendingRecord(commandId) {
    return this._oneOrNull(
      `SELECT * FROM pending_commands WHERE command_id = ?`, commandId);
  }

  // The state VIEW of a two-phase record (§3.3.2/§3.3.4): the
  // stored state projected against the coordinator clock. PURE —
  // SELECTs only, writes nothing; a projected status is
  // authoritative for STOP/display and settles nothing durably.
  // Final states carry their stored receipt's fields at top
  // level; non-final states are unmistakably not receipts (they
  // have no outcome field).
  _pendingView(rec, now = this._now()) {
    if (rec.state === "applied" || rec.state === "refused" || rec.state === "expired") {
      return { command_id: rec.command_id, type: rec.type,
               ...(rec.receipt_json ? JSON.parse(rec.receipt_json) : {}),
               state: rec.state, storedState: rec.state, projected: false };
    }
    const view = { command_id: rec.command_id, type: rec.type,
      migrationId: rec.migration_id, payloadSha256: rec.payload_sha256,
      state: rec.state, storedState: rec.state, projected: false,
      submittedAt: rec.submitted_at, expiresAt: rec.expires_at };
    if (rec.state === "pending_operator" && now >= rec.expires_at) {
      view.state = "expired"; view.projected = true;
    } else if (rec.state === "executing" &&
               (rec.claimed_at === null || now >= rec.claimed_at + this._claimLeaseMs())) {
      view.state = "needs_reconciliation"; view.projected = true;
    }
    if (rec.state === "executing" || rec.state === "needs_reconciliation")
      view.claimedAt = rec.claimed_at;
    if (rec.detail_json) view.detail = JSON.parse(rec.detail_json);
    return view;
  }

  // The receipt surface for BOTH command generations: a two-phase
  // record answers with its state view; anything else keeps the
  // pre-existing receipt shape byte-for-byte. Pure (I2).
  commandReceiptView(commandId) {
    const rec = this._pendingRecord(commandId);
    if (rec) return this._pendingView(rec);
    return this.receipt(commandId);
  }

  // Materialize a projected transition at a mutation entry point
  // (T1 duplicate submit, T2, the reconciliation route — the
  // only writers besides T3/T3′). The caller runs inside _tx
  // with a fresh record and re-reads the row if it continues.
  _materializePending(rec, now) {
    if (rec.state === "pending_operator" && now >= rec.expires_at) {
      this.sql.exec(
        `UPDATE pending_commands SET state = 'expired', receipt_json = ? WHERE command_id = ?`,
        JSON.stringify({ outcome: "rejected", reason: "pending_expired" }), rec.command_id);
    } else if (rec.state === "executing" &&
               (rec.claimed_at === null ||
                now >= rec.claimed_at + this._claimLeaseMs())) {
      // A claimless executing record is definitionally stale
      // (T2 writes the claim atomically with the state), so it
      // materializes exactly as the read projection shows it.
      this.sql.exec(
        `UPDATE pending_commands SET state = 'needs_reconciliation', claim_owner = NULL
         WHERE command_id = ?`, rec.command_id);
    }
  }

  // The row-shape discipline shared by the row-carrying submit
  // checks — the same checks the apply steps name migration_shape
  // / duplicate_row, hoisted to submit time.
  _migrationRowShapeError(rows, bookId) {
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
    return null;
  }

  // The jobs-carry descriptor + set hash (§3A.3) — computed
  // identically by the submit check, the effects audit, and the
  // reconciled receipt; the apply step's own computation is the
  // fourth copy and the suite pins all four to the same value.
  _jobsDescriptor(p) {
    const descriptor = (p.aggregates || []).map(a => ({
      jobId: a.jobId, chapterIndex: a.chapterIndex, v2State: a.v2State,
      definitionDigest: a.definitionDigest,
      occurrenceSetSha256: sha256HexText(canonicalJson(a.occurrences)) }));
    return { descriptor, setSha256: sha256HexText(canonicalJson(descriptor)) };
  }

  // T1 validation (design §3.3.3 Phase 1): every check that does
  // not execute — payload shape, the freeze/chunk/content pins,
  // and the carry pins, mirroring the apply steps' DETERMINISTIC
  // heads. Durable-progress verdicts (import completeness, chunk
  // order/convergence, prior carries, stored-state
  // recomputation) are NOT submit checks: they are re-verified
  // at execution inside T3. Returns null when the command may
  // pend, else the durable refusal object.
  _migrationSubmitRefusal(cmd) {
    const p = cmd.payload || {};
    const bookId = p.bookId || null;
    switch (cmd.type) {
      case "MigrateImportBindings": {
        const rows = Array.isArray(p.rows) ? p.rows : null;
        if (!bookId || !rows || rows.length === 0 || !p.migrationId || !p.freezeDigest)
          return { outcome: "rejected", reason: "migration_shape", bookId };
        if (this._bookTombstoned(bookId))
          return { outcome: "rejected", reason: "rejected_tombstoned", bookId };
        const rowShape = this._migrationRowShapeError(rows, bookId);
        if (rowShape) return rowShape;
        return this._migrationManifestError(p);
      }
      case "MigrateImportChunk": {
        const rows = Array.isArray(p.rows) ? p.rows : null;
        if (!bookId || !rows || rows.length === 0 || !p.migrationId || !p.freezeDigest ||
            !Number.isInteger(p.chunkIndex) || p.chunkIndex < 0)
          return { outcome: "rejected", reason: "migration_shape", bookId };
        if (this._bookTombstoned(bookId))
          return { outcome: "rejected", reason: "rejected_tombstoned", bookId };
        const rowShape = this._migrationRowShapeError(rows, bookId);
        if (rowShape) return rowShape;
        const st = this._migrationChunkState(p, { submitPhase: true });
        return st && st.rejection ? st.rejection : null;
      }
      case "MigrateImportPositions": {
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
        const pin = this._carryBook(bookId);
        if (!pin)
          return { outcome: "rejected", reason: "migration_carry_mismatch",
                   bookId, element: "book_unpinned" };
        const payloadHash = sha256HexText(canonicalJson({ bookId,
          position: { occurrenceId: pos.occurrenceId, offsetSec: pos.offsetSec },
          checkpoints: p.checkpoints }));
        if (payloadHash !== pin.position.payloadSha256)
          return { outcome: "rejected", reason: "migration_carry_mismatch",
                   bookId, element: "position_payload" };
        return null;
      }
      case "MigrateImportJobs": {
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
        const seenJobs = new Set();
        for (const a of p.aggregates) {
          if (!a || typeof a.jobId !== "string" || !Number.isInteger(a.chapterIndex) ||
              typeof a.definitionDigest !== "string" || !Array.isArray(a.occurrences))
            return { outcome: "rejected", reason: "migration_shape", bookId };
          if (seenJobs.has(a.jobId))
            return { outcome: "rejected", reason: "duplicate_row", bookId, jobId: a.jobId };
          seenJobs.add(a.jobId);
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
        const { descriptor, setSha256 } = this._jobsDescriptor(p);
        if (descriptor.length !== pin.jobs.count || setSha256 !== pin.jobs.setSha256)
          return mismatch("job_set",
            { expectedCount: pin.jobs.count, foundCount: descriptor.length });
        return null;
      }
      case "MigrateRecordFlipGate": {
        if (!bookId || !p.migrationId || !p.certificateSha256)
          return { outcome: "rejected", reason: "migration_shape", bookId };
        return null;
      }
      default:
        return { outcome: "rejected", reason: "not_a_migration_command", type: cmd.type };
    }
  }

  // T1 SUBMIT (client credential; the API layer routes the four
  // migration types here). Synchronous by construction: zero R2
  // work, zero business rows — validation is pins + shape only,
  // and the store is one sync transaction.
  submitMigrationCommand(cmd) {
    if (!cmd || typeof cmd.command_id !== "string" || !cmd.command_id)
      return { ok: false, reason: "command_id_required" };
    if (!MIGRATION_COMMAND_TYPES.includes(cmd.type))
      return { ok: false, reason: "not_a_migration_command", type: cmd.type ?? null };
    const hash = this._pendingHashOf(cmd);
    const existing = this._pendingRecord(cmd.command_id);
    if (existing) {
      if (existing.payload_sha256 !== hash)
        return { outcome: "rejected", reason: "pending_payload_conflict",
                 command_id: cmd.command_id, state: existing.state,
                 storedState: existing.state, projected: false };
      // A duplicate submit is a mutation entry point (§3.3.2):
      // it may MATERIALIZE a projected transition, then answers
      // with the current view. It never overwrites the stored
      // record and never changes a live state.
      return this._tx(() => {
        const rec = this._pendingRecord(cmd.command_id);
        this._materializePending(rec, this._now());
        return this._pendingView(this._pendingRecord(cmd.command_id));
      });
    }
    // An id already executed through the legacy dispatch keeps
    // its legacy replay — the two generations never share an id
    // silently.
    const legacy = this._oneOrNull(
      `SELECT * FROM commands WHERE command_id = ?`, cmd.command_id);
    if (legacy) {
      return { command_id: legacy.command_id, outcome: legacy.outcome,
               ...(legacy.outcome_json ? JSON.parse(legacy.outcome_json) : {}),
               replayed: true };
    }
    const refusal = this._migrationSubmitRefusal(cmd);
    return this._tx(() => {
      // Re-check inside the transaction: a racing first submit
      // of the same id resolves to the duplicate-submit path,
      // never to a constraint failure.
      const raced = this._pendingRecord(cmd.command_id);
      if (raced) {
        if (raced.payload_sha256 !== hash)
          return { outcome: "rejected", reason: "pending_payload_conflict",
                   command_id: cmd.command_id, state: raced.state,
                   storedState: raced.state, projected: false };
        this._materializePending(raced, this._now());
        return this._pendingView(this._pendingRecord(cmd.command_id));
      }
      const now = this._now();
      if (refusal) {
        this.sql.exec(
          `INSERT INTO pending_commands (command_id, type, payload_json, migration_id,
             payload_sha256, state, submitted_at, expires_at, receipt_json)
           VALUES (?, ?, ?, ?, ?, 'refused', ?, ?, ?)`,
          cmd.command_id, cmd.type, JSON.stringify(cmd.payload || {}),
          (cmd.payload && cmd.payload.migrationId) || null, hash, now,
          now + this._pendingTtlMs(), JSON.stringify(refusal));
        return this._pendingView(this._pendingRecord(cmd.command_id), now);
      }
      this.sql.exec(
        `INSERT INTO pending_commands (command_id, type, payload_json, migration_id,
           payload_sha256, state, submitted_at, expires_at)
         VALUES (?, ?, ?, ?, ?, 'pending_operator', ?, ?)`,
        cmd.command_id, cmd.type, JSON.stringify(cmd.payload || {}),
        (cmd.payload && cmd.payload.migrationId) || null, hash, now,
        now + this._pendingTtlMs());
      return this._pendingView(this._pendingRecord(cmd.command_id), now);
    });
  }

  // T2 CLAIM + preparation + T3 APPLY (operator credential; the
  // API layer routes POST /v2/command-approvals here). The
  // claim is one sync transaction; preparation is async and
  // OUTSIDE any transaction; the apply is one sync transaction
  // that re-checks owner + state + lease validity before
  // writing anything (§3.3.2). Returns a state view (a final
  // state carries its receipt), the processing view when a live
  // claim by another approval is in flight, or
  // { ok: false, error: "pending_command_not_found" } for an
  // unknown id — which stores nothing.
  async approveMigrationCommand({ commandId, payloadSha256, action = "approve" } = {}) {
    const claim = this._tx(() => {
      const now = this._now();
      const rec = this._pendingRecord(commandId);
      if (!rec) return { kind: "unknown" };
      if (rec.state === "applied" || rec.state === "refused" || rec.state === "expired")
        return { kind: "final", view: this._pendingView(rec, now) };
      if (rec.state === "needs_reconciliation")
        return { kind: "stop", view: this._pendingView(rec, now) };
      if (rec.state === "executing") {
        // A live claim is processing; a lapsed one materializes
        // HERE (T2 is a mutation entry point) to the STOP state.
        if (rec.claimed_at !== null && now >= rec.claimed_at + this._claimLeaseMs()) {
          this._materializePending(rec, now);
          return { kind: "stop",
                   view: this._pendingView(this._pendingRecord(commandId), now) };
        }
        return { kind: "processing", view: this._pendingView(rec, now) };
      }
      // pending_operator: T2 rechecks expiry against coordinator
      // time inside this transaction, regardless of what any
      // earlier read projected (§3.3.2).
      if (now >= rec.expires_at) {
        this._materializePending(rec, now);
        return { kind: "final",
                 view: this._pendingView(this._pendingRecord(commandId), now) };
      }
      // Payload integrity BEFORE anything acts on the record
      // (§3.3.6 invariant 2): the canonical hash is RECOMPUTED
      // over the stored (command_id, type, payload) and must
      // equal the stored digest. The operator-digest comparison
      // below alone would let a record whose payload was
      // rewritten under an intact digest be claimed on a valid
      // approval. A record that fails its own hash names no
      // trustworthy command: it can never be claimed or
      // executed, so the verdict is the same durable fail-closed
      // refusal as the approval-hash mismatch — permanent.
      if (!this._pendingIntegrityOk(rec)) {
        this.sql.exec(
          `UPDATE pending_commands SET state = 'refused', receipt_json = ? WHERE command_id = ?`,
          JSON.stringify({ outcome: "rejected", reason: "pending_payload_integrity" }),
          commandId);
        return { kind: "final",
                 view: this._pendingView(this._pendingRecord(commandId), now) };
      }
      if (payloadSha256 !== rec.payload_sha256) {
        this.sql.exec(
          `UPDATE pending_commands SET state = 'refused', receipt_json = ? WHERE command_id = ?`,
          JSON.stringify({ outcome: "rejected", reason: "pending_hash_mismatch" }),
          commandId);
        return { kind: "final",
                 view: this._pendingView(this._pendingRecord(commandId), now) };
      }
      if (action === "reject") {
        this.sql.exec(
          `UPDATE pending_commands SET state = 'refused', receipt_json = ? WHERE command_id = ?`,
          JSON.stringify({ outcome: "rejected", reason: "operator_rejected" }), commandId);
        return { kind: "final",
                 view: this._pendingView(this._pendingRecord(commandId), now) };
      }
      const owner = crypto.randomUUID();
      this.sql.exec(
        `UPDATE pending_commands SET state = 'executing', claim_owner = ?, claimed_at = ?
         WHERE command_id = ?`, owner, now, commandId);
      return { kind: "claimed", owner, rec: this._pendingRecord(commandId) };
    });
    if (claim.kind === "unknown")
      return { ok: false, error: "pending_command_not_found", command_id: commandId };
    if (claim.kind !== "claimed") return claim.view;

    // ---- preparation: async, outside every transaction. Only
    // the row-carrying commands prepare (the pinned prime
    // discipline, identical to handleCommand's); the carry and
    // gate commands skip it entirely. Preparation mutates
    // nothing durable.
    const rec = claim.rec;
    const cmd = { command_id: rec.command_id, type: rec.type,
                  payload: JSON.parse(rec.payload_json) };
    let prepared = null;
    try {
      if (rec.type === "MigrateImportChunk") {
        const st = this._migrationChunkState(cmd.payload);
        if (st && st.ok) prepared = await this._prepareMigrationImport(cmd.payload);
      } else if (rec.type === "MigrateImportBindings") {
        if (!this._migrationManifestError(cmd.payload))
          prepared = await this._prepareMigrationImport(cmd.payload);
      }
    } catch (e) {
      // An unexpected preparation failure is NOT a validation
      // verdict (§3.3.2, the T3′ row): write nothing, leave the
      // claim to lapse into reconciliation, and answer with the
      // current view. Never improvise a refusal from an
      // exception.
      return this._pendingView(this._pendingRecord(commandId) || rec);
    }

    // ---- T3 APPLY / T3′ REFUSAL: one sync transaction. The
    // owner + state + LEASE checks run first, inside it; on any
    // failure there are no writes of any kind — a stale executor
    // can neither commit nor regain the claim.
    return this._tx(() => {
      const now = this._now();
      const cur = this._pendingRecord(commandId);
      if (!cur || cur.state !== "executing" || cur.claim_owner !== claim.owner ||
          cur.claimed_at === null || now >= cur.claimed_at + this._claimLeaseMs())
        return this._pendingView(cur || rec, now);
      // Payload integrity at the apply gate (§3.3.6 invariant
      // 2): recompute the canonical hash over the CURRENTLY
      // stored record AND over the prepared in-memory command;
      // both must equal the stored digest, so the command that
      // applies is exactly the re-verified stored command.
      // THIS recomputation is authoritative over T2's: if the
      // stored payload changed while preparation was in flight
      // (the async window between claim and apply), the apply
      // fails closed here — _recordAndApply writes nothing,
      // no receipt exists, and the record moves to the STOP
      // state for manual reconciliation. Never a blind retry.
      if (!this._pendingIntegrityOk(cur) ||
          this._pendingHashOf(cmd) !== cur.payload_sha256) {
        this.sql.exec(
          `UPDATE pending_commands SET state = 'needs_reconciliation', claim_owner = NULL,
             detail_json = ? WHERE command_id = ?`,
          JSON.stringify({ integrityFailure: true, at: now }), commandId);
        return this._pendingView(this._pendingRecord(commandId), now);
      }
      const result = this._recordAndApply(cmd, prepared);
      this.sql.exec(
        `UPDATE pending_commands SET state = ?, receipt_json = ? WHERE command_id = ?`,
        result.outcome === "applied" ? "applied" : "refused",
        JSON.stringify(result), commandId);
      return this._pendingView(this._pendingRecord(commandId), now);
    });
  }

  // The business-effect audit a reconciliation verdict rests on
  // (§3.3.5): per command type, whether THIS command's effects
  // are complete-and-pin-exact, provably zero, or neither —
  // recomputed from the durable business rows and the command's
  // own pinned expectations, never from a request. SELECT-only.
  //
  // `complete` is a forensic claim, and it is held to that
  // standard (Rowan code review 6374624466, Blocker B): full,
  // server-recomputed, pin-exact, COMMAND-ATTRIBUTABLE evidence
  // per type — never the mere presence of a slot, a carry
  // marker, or a gate row. A slot under the right migration id
  // with a wrong row digest, a carry marker whose actual stored
  // state was rewritten, a gate row echoing a certificate the
  // book never anchored: all stay `neither`, and the uncertain
  // record is preserved for manual investigation.
  _migrationEffectsAudit(rec) {
    const neither = { complete: false, zero: false };
    // A record whose stored payload fails its own hash
    // (§3.3.6 invariant 2) names no trustworthy command: its
    // payload cannot be the yardstick for any effect.
    if (!this._pendingIntegrityOk(rec)) return neither;
    let p;
