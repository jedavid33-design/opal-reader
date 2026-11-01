        `SELECT * FROM spend_intents WHERE job_id = ? AND generation =
           (SELECT MAX(generation) FROM spend_intents s2
             WHERE s2.job_id = spend_intents.job_id AND s2.occurrence_id = spend_intents.occurrence_id)
         ORDER BY occurrence_id`, jobId),
      batchMaps: this._all(
        `SELECT * FROM batch_maps WHERE job_id = ? AND generation =
           (SELECT MAX(generation) FROM batch_maps b2
             WHERE b2.job_id = batch_maps.job_id AND b2.occurrence_id = batch_maps.occurrence_id)
         ORDER BY occurrence_id`, jobId),
    };
  }

  // ============ P4: sync v2 + money authority (Case #6) ============
  // The protocol contracts (addendum, issue #11): per-family
  // append-only change history written in the mutation's own
  // transaction; pinned-watermark paginated pulls; durable per-book
  // receipts (the P2 command log IS the receipt store — a lost ACK
  // re-reads the same receipt, never re-applies); position as an
  // append-only event journal folded deterministically in receipt
  // order; revisioned tombstones; money read-only from the ledger.

  _familyState(family) {
    let st = this._oneOrNull(`SELECT * FROM sync_family_state WHERE family = ?`, family);
    if (!st) {
      // Lazy init from whatever history exists (pre-P4-fix data).
      const mx = this._one(`SELECT COALESCE(MAX(seq), 0) AS tip, MIN(seq) AS fl FROM sync_changes WHERE family = ?`, family);
      st = { family, tip: mx.tip, floor: mx.fl === null ? 1 : mx.fl };
      this.sql.exec(`INSERT INTO sync_family_state (family, tip, floor) VALUES (?, ?, ?)`,
        family, st.tip, st.floor);
    }
    return st;
  }

  _syncTip(family) { return this._familyState(family).tip; }

  _syncFloor(family) { return this._familyState(family).floor; }

  _appendChange(family, entityKey, bookId, revision, op, payload) {
    const st = this._familyState(family);
    const seq = st.tip + 1;
    this.sql.exec(`UPDATE sync_family_state SET tip = ? WHERE family = ?`, seq, family);
    this.sql.exec(`INSERT INTO sync_changes (family, seq, entity_key, book_id, revision, op, payload_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      family, seq, entityKey, bookId, revision, op,
      payload === undefined ? null : JSON.stringify(payload));
    return seq;
  }

  // The ONLY sanctioned history truncation: rows below beforeSeq go,
  // the floor advances to meet them, the tip NEVER moves. A cursor
  // below the new floor hears resyncRequired; a cursor at/above it
  // still receives every later change — no silent misses, ever.
  _pruneSyncHistory(family, beforeSeq) {
    const st = this._familyState(family);
    const floor = Math.max(st.floor, Math.min(beforeSeq, st.tip + 1));
    this.sql.exec(`DELETE FROM sync_changes WHERE family = ? AND seq < ?`, family, floor);
    this.sql.exec(`UPDATE sync_family_state SET floor = ? WHERE family = ?`, floor, family);
    return { family, floor, tip: st.tip };
  }

  _syncEntity(family, entityKey) {
    return this._oneOrNull(`SELECT * FROM sync_entities WHERE family = ? AND entity_key = ?`,
      family, entityKey);
  }

  _bookTombstoned(bookId) {
    if (!bookId) return false;
    const e = this._syncEntity("content", bookId);
    return !!(e && e.deleted);
  }

  _upsertSyncEntity(family, entityKey, bookId, data) {
    const cur = this._syncEntity(family, entityKey);
    const revision = (cur ? cur.revision : 0) + 1;
    this.sql.exec(
      `INSERT INTO sync_entities (family, entity_key, book_id, revision, deleted, data_json)
       VALUES (?, ?, ?, ?, 0, ?)
       ON CONFLICT(family, entity_key) DO UPDATE SET revision = excluded.revision,
         deleted = 0, data_json = excluded.data_json`,
      family, entityKey, bookId, revision, JSON.stringify(data));
    this._appendChange(family, entityKey, bookId, revision, "upsert", data);
    return revision;
  }

  _conflictWindow(family, entityKey, baseRevision) {
    return this._all(
      `SELECT seq, revision, op FROM sync_changes
       WHERE family = ? AND entity_key = ? AND revision > ? ORDER BY seq`,
      family, entityKey, baseRevision).slice(0, 20);
  }

  // Pushes validate and apply PER BOOK (P4 review: the contract's
  // atomicity unit is the book, not the entity). Within a book group
  // every change is validated first; if any fails, NONE of that
  // book's changes commit — the failing change carries its real
  // outcome and its siblings carry 'aborted_book_conflict'. Other
  // books in the same batch are unaffected (abort isolation).
  _validateSyncChange(ch) {
    const { family, entityKey } = ch || {};
    const hard = outcome => ({ ok: false, outcome });
    if (!SYNC_FAMILIES.includes(family) || family === "position" || !entityKey)
      return hard({ entityKey: entityKey || null, status: "invalid" });
    if (family === "settings") {
      if (entityKey !== "settings") return hard({ entityKey, status: "invalid" });
      const curRev = this._settings().revision;
      if (ch.baseRevision !== curRev)
        return hard({ entityKey, status: "conflict", currentRevision: curRev });
      return { ok: true };
    }
    const bookId = ch.bookId || (family === "content" ? entityKey : null);
    // Book identity, verified BEFORE any fence or CAS (P4 follow-up):
    // a change whose identifiers disagree would otherwise be fenced
    // and grouped against the WRONG book — including writing past a
    // tombstone under a live book's name. Content: the entity key IS
    // the book id. Bindings: the key must be "<bookId>:<occurrence>"
    // for a book that exists, and the occurrence must be one of the
    // book's own — ownership is proven, never assumed.
    if (family === "content" && bookId !== entityKey)
      return hard({ entityKey, status: "rejected", reason: "identity_mismatch", bookId });
    if (family === "bindings") {
      if (!bookId || !entityKey.startsWith(`${bookId}:`))
        return hard({ entityKey, status: "rejected", reason: "identity_mismatch", bookId });
      const bookEnt = this._syncEntity("content", bookId);
      if (!bookEnt)
        return hard({ entityKey, status: "rejected", reason: "unknown_book", bookId });
      if (!bookEnt.deleted) {
        const occIds = (JSON.parse(bookEnt.data_json || "{}").occurrenceIds) || [];
        if (!occIds.includes(entityKey.slice(bookId.length + 1)))
          return hard({ entityKey, status: "rejected", reason: "unknown_occurrence", bookId });
      }
    }
    // The delete fence: no family accepts a write against a
    // tombstoned book (Rowan invariant 3) — not content, not
    // bindings, and position events fence separately below.
    if (this._bookTombstoned(bookId)) {
      if (ch.op === "delete" && family === "content") {
        const cur = this._syncEntity("content", bookId);
        return { ok: true, precomputed: { entityKey, status: "applied",
          revision: cur.revision, alreadyTombstoned: true } };
      }
      return hard({ entityKey, status: "rejected_tombstoned", bookId });
    }
    if (ch.op === "delete") {
      if (family !== "content") return hard({ entityKey, status: "invalid" });
      const cur = this._syncEntity("content", bookId);
      const curRev = cur ? cur.revision : 0;
      if (ch.baseRevision !== undefined && ch.baseRevision !== curRev)
        return hard({ entityKey, status: "conflict", currentRevision: curRev,
                      window: this._conflictWindow("content", bookId, ch.baseRevision ?? 0) });
      return { ok: true };
    }
    const cur = this._syncEntity(family, entityKey);
    const curRev = cur ? cur.revision : 0;
    if (ch.baseRevision !== curRev)
      return hard({ entityKey, status: "conflict", currentRevision: curRev,
                    window: this._conflictWindow(family, entityKey, ch.baseRevision ?? 0) });
    return { ok: true };
  }

  _applyValidatedSyncChange(ch) {
    const { family, entityKey } = ch;
    if (family === "settings") {
      const r = this._setSettings({ baseRevision: ch.baseRevision, data: ch.payload || {} }, null);
      return r.outcome === "applied"
        ? { entityKey, status: "applied", revision: r.revision }
        : { entityKey, status: "conflict", currentRevision: r.revision };
    }
    const bookId = ch.bookId || (family === "content" ? entityKey : null);
    if (ch.op === "delete") {
      const r = this._tombstoneBook(bookId, ch.baseRevision);
      return { entityKey, status: r.status, revision: r.revision,
               ...(r.alreadyTombstoned ? { alreadyTombstoned: true } : {}),
               ...(r.currentRevision !== undefined ? { currentRevision: r.currentRevision } : {}) };
    }
    const revision = this._upsertSyncEntity(family, entityKey, bookId, ch.payload ?? null);
    return { entityKey, status: "applied", revision };
  }

  _syncPush(p, commandId) {
    const changes = Array.isArray(p.changes) ? p.changes : [];
    const groups = new Map();
    changes.forEach((ch, i) => {
      const key = !ch || ch.family === "settings" ? "§settings"
        : (ch.bookId || ch.entityKey || `§${i}`);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(i);
    });
    const outcomes = new Array(changes.length);
    for (const idxs of groups.values()) {
      // Group-shape fences (P4 re-review): within one book group, a
      // duplicate entity target or a delete mixed with other writes
      // has no sound sequential reading — both writes would validate
      // against the same pre-state, and an update could land after
      // the group's own tombstone. Such groups are rejected whole:
      // the offending changes carry the reason, siblings abort.
      const seen = new Map();
      let groupViolation = null;
      const dupIdx = new Set();
      for (const i of idxs) {
        const key = `${changes[i].family}:${changes[i].entityKey}`;
        if (seen.has(key)) { dupIdx.add(i); dupIdx.add(seen.get(key)); }
        else seen.set(key, i);
      }
      if (dupIdx.size > 0) groupViolation = "duplicate_entity_in_group";
      const hasDelete = idxs.some(i => changes[i].op === "delete");
      if (hasDelete && idxs.length > 1) groupViolation = "mixed_delete_group";
      if (groupViolation) {
        for (const i of idxs) {
          outcomes[i] = (groupViolation === "mixed_delete_group" || dupIdx.has(i))
            ? { entityKey: changes[i].entityKey, status: "rejected", reason: groupViolation,
                bookId: changes[i].bookId || null }
            : { entityKey: changes[i].entityKey, status: "aborted_book_conflict",
                bookId: changes[i].bookId || null };
        }
        continue;
      }
      const vals = idxs.map(i => this._validateSyncChange(changes[i]));
      if (vals.every(v => v.ok)) {
        idxs.forEach((ci, k) => {
          outcomes[ci] = vals[k].precomputed
            || this._applyValidatedSyncChange(changes[ci]);
        });
      } else {
        idxs.forEach((ci, k) => {
          outcomes[ci] = vals[k].ok
            ? { entityKey: changes[ci].entityKey, status: "aborted_book_conflict",
                bookId: changes[ci].bookId || null }
            : vals[k].outcome;
        });
      }
    }
    return { outcome: "applied", deviceId: p.deviceId || null, outcomes };
  }

  _tombstoneBook(bookId, baseRevision) {
    const cur = this._syncEntity("content", bookId);
    if (cur && cur.deleted)
      return { status: "applied", revision: cur.revision, alreadyTombstoned: true };
    const curRev = cur ? cur.revision : 0;
    if (baseRevision !== undefined && baseRevision !== curRev)
      return { status: "conflict", currentRevision: curRev,
               window: this._conflictWindow("content", bookId, baseRevision ?? 0) };
    const revision = curRev + 1;
    this.sql.exec(
      `INSERT INTO sync_entities (family, entity_key, book_id, revision, deleted, data_json)
       VALUES ('content', ?, ?, ?, 1, NULL)
       ON CONFLICT(family, entity_key) DO UPDATE SET revision = excluded.revision,
         deleted = 1, data_json = NULL`,
      bookId, bookId, revision);
    this._appendChange("content", bookId, bookId, revision, "tombstone", { bookId });
    this._logTransition("book", bookId, "DeleteBook", null, "tombstoned", revision, {});
    return { status: "applied", revision };
  }

  _deleteBook(p, commandId) {
    if (!p.bookId) return { outcome: "rejected", reason: "book_required" };
    const r = this._tombstoneBook(p.bookId, p.baseRevision);
    return r.status === "applied"
      ? { outcome: "applied", bookId: p.bookId, revision: r.revision, alreadyTombstoned: !!r.alreadyTombstoned }
      : { outcome: "rejected", reason: "conflict", bookId: p.bookId, currentRevision: r.currentRevision };
  }

  // ---- migration import (P8; v2/p8/migration-import-design.md) -------------
  // The dedicated verified bind primitive Rowan's D10 ruling
  // (6354217340) requires before any audio-containing flip may be
  // scheduled. It REPLACES the split SyncPush + AdoptAudio path for
  // migration only: prime (async, §2) -> byte-verify (three-way,
  // fail closed, §3) -> bind BOTH planes (sync bindings family +
  // SQL bindings/cache_index) inside this command's ONE transaction
  // (§1), or apply nothing at all. Non-migration commands are
  // untouched: SyncPush still does not verify bytes and AdoptAudio
  // still verifies through the request snapshot.
  //
  // The prime seam: env.migrationPrime(cacheKey) -> fact | null,
  // where fact = { objectKey, format, byteLength, computedSha256,
  // metadataSha256, metadataIdentity, etag }. computedSha256 is
  // ALWAYS the host's fresh digest over the downloaded bytes; the
  // metadata value rides separately and is never trusted (§3).

  // ---- G2: the pinned approved freeze (Rowan re-review
  // 6354569652). The authoritative manifest identity lives in code
  // (v2/p8/approved-freeze-manifest.mjs, derived from Julie's
  // approved frozen snapshot by tools/derive-approved-freeze-
  // manifest.mjs): the freeze's corpus digest plus, per book, the
  // expected binding row set. A deployment/test environment may
  // supply env.approvedFreezeManifest (deployment configuration,
  // inside the trust boundary by definition); request data can
  // NEVER influence which manifest is pinned — caller input may
  // only match it. A manifest is { snapshotDigest, books:
  // { [bookId]: { rowSetSha256, rows: [[occurrenceId, revisionKey,
  // cacheKey, size, format, sha256Prefix, etag], ...] } } }.
  _approvedFreeze() {
    return (this.env && this.env.approvedFreezeManifest) || APPROVED_FREEZE_MANIFEST;
  }

  // The pinned record for one book, normalized: rows as objects
  // plus an occurrence index. Null when the book is not part of
  // the approved freeze.
  _pinnedBook(bookId) {
    const book = this._approvedFreeze()?.books?.[bookId];
    if (!book || !Array.isArray(book.rows)) return null;
    const rows = book.rows.map(t => ({
      occurrenceId: t[0], revisionKey: t[1], cacheKey: t[2],
      size: t[3], format: t[4], sha256Prefix: t[5], etag: t[6],
    }));
    return { rowSetSha256: book.rowSetSha256 ?? null, rows,
             byOccurrence: new Map(rows.map(r => [r.occurrenceId, r])) };
  }

  _pinnedForm(row) {
    return row.revisionKey === row.cacheKey ? "fingerprinted"
      : row.revisionKey === `legacy:${row.cacheKey}` ? "legacy-anchor"
      : "fingerprinted-distinct";
  }

  // ---- D3: the pinned chunk partition (design §10). The chunked
  // import's authoritative partition of the approved freeze lives
  // in code beside the whole-book pin (v2/p8/approved-freeze-
  // chunks.mjs, derived from the committed whole-book pin by
  // tools/derive-approved-freeze-chunks.mjs): per book, ordered
  // contiguous slices of the pinned rows, each with its own row-set
  // digest. env.approvedFreezeChunks is the same kind of seam as
  // env.approvedFreezeManifest — deployment configuration inside
  // the trust boundary; request data can never influence which
  // partition is pinned, only match it.
  _approvedChunks() {
    return (this.env && this.env.approvedFreezeChunks) || APPROVED_FREEZE_CHUNKS;
  }

  // The pinned chunk record for one book plus the slice of the
  // book's pinned rows it covers (normalized objects, pinned
  // order). Null when the book/chunk has no chunk pin.
  _pinnedChunk(bookId, chunkIndex) {
    const bookChunks = this._approvedChunks()?.books?.[bookId];
    if (!bookChunks || !Array.isArray(bookChunks.chunks)) return null;
    const chunk = bookChunks.chunks.find(c => c.index === chunkIndex);
    if (!chunk) return null;
    const pinned = this._pinnedBook(bookId);
    if (!pinned) return null;
    const rows = pinned.rows.slice(chunk.start, chunk.start + chunk.rowCount);
    if (rows.length !== chunk.rowCount) return null;
    return { chunk, rows, bookChunks };
  }

  // The G2 admission check on an import payload, independent of
  // primed facts: null when the payload is exactly the approved
  // freeze's shape for this book, else the rejection. Runs before
  // priming (handleCommand) and again inside the command
  // transaction (the apply step) — the same function, so the two
  // can never drift apart.
  _migrationManifestError(p) {
    const bookId = p.bookId || null;
    const rows = Array.isArray(p.rows) ? p.rows : null;
    if (!bookId || !rows || rows.length === 0 || !p.migrationId || !p.freezeDigest)
      return null; // shape errors are the apply step's to name
    const freeze = this._approvedFreeze();
    if (!freeze || p.freezeDigest !== freeze.snapshotDigest)
      return { outcome: "rejected", reason: "migration_freeze_unapproved", bookId };
    const pinned = this._pinnedBook(bookId);
    if (!pinned)
      return { outcome: "rejected", reason: "migration_freeze_unapproved", bookId };
    if (rows.length !== pinned.rows.length)
      return { outcome: "rejected", reason: "migration_manifest_mismatch", bookId,
               occurrenceId: null };
    const seen = new Set();
    for (const r of rows) {
      if (!r || !r.occurrenceId) continue; // shape errors: apply step
      const want = pinned.byOccurrence.get(r.occurrenceId);
      if (!want || seen.has(r.occurrenceId))
        return { outcome: "rejected", reason: "migration_manifest_mismatch", bookId,
                 occurrenceId: r.occurrenceId };
      seen.add(r.occurrenceId);
      if (r.revisionKey !== want.revisionKey || r.cacheKey !== want.cacheKey ||
          !r.manifest || r.manifest.size !== want.size ||
          r.manifest.format !== want.format ||
          typeof r.manifest.sha256 !== "string" ||
          !r.manifest.sha256.startsWith(want.sha256Prefix))
        return { outcome: "rejected", reason: "migration_manifest_mismatch", bookId,
                 occurrenceId: r.occurrenceId };
    }
    return null;
  }

  async _prepareMigrationImport(p) {
    const facts = new Map();
    const prime = this.env && this.env.migrationPrime;
    const keys = [...new Set((Array.isArray(p.rows) ? p.rows : [])
      .map(r => r && r.cacheKey).filter(k => typeof k === "string" && k))];
    for (const key of keys) {
      if (typeof prime !== "function") { facts.set(key, { unavailable: true }); continue; }
      try { facts.set(key, (await prime(key)) || null); }
      catch (e) { facts.set(key, { error: String(e && e.message || e) }); }
    }
    return facts;
  }

  // The typed provenance acceptance (design §5): every attestation
  // field must agree with the row, the freeze manifest, AND the
  // primed facts. The caller separately proves the disagreement is
  // exactly the known v1 limitation (no recorded identity anywhere
  // but the cache-key default) — an attestation never rescues a
  // positive foreign identity.
  _migrationAttestationValid(att, row, fact, freezeDigest, pinnedRow = null) {
    if (!att || att.kind !== "freeze_snapshot_attestation") return false;
    if (att.snapshotDigest !== freezeDigest) return false;
    if (att.bookId !== row.bookId || att.occurrenceId !== row.occurrenceId) return false;
    if (att.revisionKey !== row.revisionKey || att.cacheKey !== row.cacheKey) return false;
    if (att.sha256 !== fact.computedSha256 || att.sha256 !== row.manifest.sha256) return false;
    if (att.size !== fact.byteLength || att.size !== row.manifest.size) return false;
    if (att.format !== fact.format || att.format !== row.manifest.format) return false;
    if (att.r2Key !== fact.objectKey) return false;
    if (fact.etag !== null && fact.etag !== undefined && att.r2Etag !== fact.etag) return false;
    // G2: the attestation's etag must also be the FREEZE's etag for
    // this row — an attestation minted against any other listing is
    // not the approved freeze's paperwork, however self-consistent.
    if (pinnedRow && att.r2Etag !== pinnedRow.etag) return false;
    if (att.identityLimitation !== "v1_metadata_no_identity") return false;
    return true;
  }

  // Validate EVERY row of a migration import against the primed
  // facts before anything is applied (design §1) — shared verbatim
  // by the whole-book import and the D3 chunked import, so the two
  // paths can never drift apart on what "verified" means. Returns
  // the per-row certificate rows, the apply plans, and the first
  // blocking reason (any blocked row rejects the whole unit).
  //
  // deferSync (chunked import): the sync plane must stay untouched
  // until the book completes, so a row's sync entity may not exist
  // yet in ANY form, and a pre-existing SQL binding for a chunk row
  // is foreign state (the chunk flow records its own writes in
  // migration_chunks; an unrecorded binding did not come from it).
  // Either is a divergence. Idempotence in chunk mode is a property
  // of the chunk slot, never of individual rows.
  _validateMigrationRows({ bookId, freezeDigest, rows, pinned, facts, deferSync = false }) {
    // ---- validate EVERY row before applying anything (design §1).
    const certRows = [];
    const plans = [];
    let firstBlock = null;
    for (const r of rows) {
      const cert = { occurrenceId: r.occurrenceId, revisionKey: r.revisionKey,
        cacheKey: r.cacheKey, objectKey: null, manifestSha256: r.manifest.sha256,
        computedSha256: null, metadataSha256: null, etag: null,
        verified: false, status: "blocked", reason: null };
      const plan = { row: r, cert, viaProvenance: false, idempotent: false,
                     recordedIdentity: null, syncData: null, syncPresent: false };
      const fail = (reason) => { cert.reason = reason; if (!firstBlock) firstBlock = reason; };
      const fact = facts ? facts.get(r.cacheKey) : null;
      if (fact && fact.unavailable) fail("migration_prime_unavailable");
      else if (fact && fact.error) fail("prime_failed");
      else if (!fact) fail("object_missing");
      else {
        cert.objectKey = fact.objectKey ?? null;
        cert.computedSha256 = fact.computedSha256 ?? null;
        cert.metadataSha256 = fact.metadataSha256 ?? null;
        cert.etag = fact.etag ?? null;
        const idx = this._oneOrNull(`SELECT * FROM cache_index WHERE cache_key = ?`, r.cacheKey);
        const existing = this._oneOrNull(
          `SELECT * FROM bindings WHERE occurrence_id = ? AND revision_key = ?`,
          r.occurrenceId, r.revisionKey);
        const syncEnt = this._syncEntity("bindings", `${bookId}:${r.occurrenceId}`);
        const syncData = syncEnt && !syncEnt.deleted
          ? JSON.parse(syncEnt.data_json || "{}") : null;
        if (fact.format !== r.manifest.format) fail("format_mismatch");
        else if (!fact.objectKey || !fact.objectKey.endsWith(`audio/${r.cacheKey}.${fact.format}`))
          fail("object_key_mismatch");
        else if (fact.byteLength !== r.manifest.size) fail("size_mismatch");
        else if (fact.computedSha256 !== r.manifest.sha256) fail("content_hash_mismatch");
        else if (fact.metadataSha256 !== null && fact.metadataSha256 !== undefined &&
                 fact.metadataSha256 !== fact.computedSha256) fail("metadata_digest_mismatch");
        else if (idx && idx.sha256 && idx.sha256 !== fact.computedSha256)
          fail("content_hash_mismatch");
        else if (deferSync && existing) fail("migration_book_divergence");
        else if (existing && existing.cache_key !== r.cacheKey) fail("binding_conflict_existing");
        else if (deferSync && syncEnt) fail("migration_book_divergence");
        else if (syncData && (syncData.cacheKey !== r.cacheKey ||
                               (syncData.sha256 && syncData.sha256 !== fact.computedSha256)))
          fail("sync_binding_divergence");
        else {
          // Identity (design §5). The recorded identity: the
          // coordinator's index wins, the object's metadata is the
          // fallback, and a v1 object with neither defaults to its
          // cache key (the hydrateKey rule, restated on primed
          // facts so the snapshot is never consulted here).
          const recorded = (idx && idx.identity) || fact.metadataIdentity || r.cacheKey;
          plan.recordedIdentity = recorded;
          const isLegacy = r.revisionKey.startsWith("legacy:");
          let accepted = false;
          if (isLegacy) {
            if (r.revisionKey === `legacy:${r.cacheKey}`) accepted = true;
            else fail("legacy_anchor_mismatch");
          } else if (recorded === r.revisionKey) accepted = true;
          else {
            const noPositiveIdentity = !(idx && idx.identity) && !fact.metadataIdentity &&
              recorded === r.cacheKey;
            const att = r.provenanceAttestation || null;
            if (att && noPositiveIdentity &&
                this._migrationAttestationValid(att, { ...r, bookId }, fact, freezeDigest,
                                                pinned.byOccurrence.get(r.occurrenceId))) {
              accepted = true; plan.viaProvenance = true;
            } else if (att && noPositiveIdentity) fail("attestation_invalid");
            else fail("identity_mismatch");
          }
          if (accepted) {
            cert.verified = true;
            plan.syncData = { cacheKey: r.cacheKey, revisionKey: r.revisionKey,
              sha256: fact.computedSha256, format: fact.format, size: fact.byteLength,
              provenance: plan.viaProvenance ? "migration:freeze_snapshot_attestation" : "migration" };
            plan.syncPresent = !!syncData;
            plan.idempotent = !!existing && existing.cache_key === r.cacheKey &&
              !!syncData && canonicalJson(syncData) === canonicalJson(plan.syncData);
            plan.existingBinding = !!existing;
          }
        }
      }
      certRows.push(cert); plans.push(plan);
    }

    return { certRows, plans, firstBlock };
  }

  // The G3 anchor: the canonical certificate digest over the
  // verified class-C facts — derived server-side, never accepted
  // from the caller. Shared by the whole-book import (items from
  // its apply plans) and the chunked import's completion (items
  // from the persisted per-chunk evidence), so a book anchors
  // identically whichever path imported it, given the same facts.
  _migrationAnchorSha256({ bookId, migrationId, freezeDigest, rowsSha256, items }) {
    const anchorMaterial = { v: 1, bookId, migrationId, freezeDigest, rowsSha256,
      rows: items.map(it => ({ occurrenceId: it.occurrenceId,
        revisionKey: it.revisionKey, cacheKey: it.cacheKey,
        objectKey: it.objectKey, computedSha256: it.computedSha256,
        metadataSha256: it.metadataSha256, etag: it.etag,
        status: it.viaProvenance ? "accepted_provenance" : "accepted" }))
        .sort((a, b) => (a.occurrenceId < b.occurrenceId ? -1 : 1)) };
    return sha256HexText(canonicalJson(anchorMaterial));
  }

  _migrateImportBindings(p, commandId, facts) {
    const bookId = p.bookId || null;
    const rows = Array.isArray(p.rows) ? p.rows : null;
    if (!bookId || !rows || rows.length === 0 || !p.migrationId || !p.freezeDigest)
