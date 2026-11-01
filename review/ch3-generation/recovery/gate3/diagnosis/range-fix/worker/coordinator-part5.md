            jobId: grant.job_id, expectedSha256: res.sha256 || null });
          if (v.bound) {
            this.sql.exec(`UPDATE occurrences SET cache_key = ? WHERE job_id = ? AND occurrence_id = ?`,
              res.cacheKey, grant.job_id, res.occurrenceId);
            this.applyOccEvent(grant.job_id, res.occurrenceId, "report_success", "report", { grantId: grant.grant_id });
            ready++;
          } else {
            // The executor claimed success but the audio cannot be
            // validated: the dispatch's outcome is genuinely UNPROVEN
            // (§1.2 rule 4). It enters outcome_unknown — whose exits are
            // all reconciliation paths — never ready, and never parked in
            // 'granted' behind a reported grant (P2 review finding 1:
            // the lease handler skips reported grants, so a granted limbo
            // here would be a forever-stuck occurrence).
            this.applyOccEvent(grant.job_id, res.occurrenceId, "report_unvalidated", "report",
              { grantId: grant.grant_id, binding_rejected: v.reason, cacheKey: res.cacheKey });
          }
        } else if (res.outcome === "policy_block") {
          this.applyOccEvent(grant.job_id, res.occurrenceId, "report_blocked", "report",
            { grantId: grant.grant_id, evidence: res.evidence || null });
          blocked++;
        } else if (res.outcome === "daily_limit") {
          // F5: a park requires provider daily-limit EVIDENCE, recorded
          // verbatim. Occurrences not yet attempted stay pending.
          this.sql.exec(`INSERT INTO quota_parks (parked_at, evidence_json) VALUES (?, ?)`,
            this._now(), JSON.stringify(res.evidence || {}));
          this.applyOccEvent(grant.job_id, res.occurrenceId, "defer", "report:daily_limit",
            { grantId: grant.grant_id, deferred: "daily_limit", evidence: res.evidence || null });
          this.applyJobEvent(grant.job_id, "park", "report:daily_limit",
            { grantId: grant.grant_id, evidence: res.evidence || null });
          // QUOTA GUARD (QUOTA-ADDENDUM §1.5): when the park is
          // recorded, the parked grant's still-open reservations
          // close with reason 'quota_park' — dispatch under that
          // grant is impossible while parked, and a resume
          // proceeds by probe -> a NEW grant with NEW reservations
          // against the resume day, so the parked grant and its
          // successor can never double-hold an occurrence.
          // Unarmed stores: a no-op inside the fence.
          closeReservationsForGrant(this, grant.grant_id, "quota_park");
        } else if (res.outcome === "rate_limited") {
          // Generic 429 = weather (B5): bounded backoff via a plan step,
          // never a park. The occurrence returns to pending.
          this.applyOccEvent(grant.job_id, res.occurrenceId, "defer", "report:rate_limited",
            { grantId: grant.grant_id, backoff: true });
          this._schedule(this._now() + 30000, "retry_grant", grant.job_id, { cause: "rate_limited" });
        } else {
          this.applyOccEvent(grant.job_id, res.occurrenceId, "report_failed", "report",
            { grantId: grant.grant_id, error: res.error || "failed" });
          failed++;
        }
      }
      // A report closes its grant: any occurrence this grant dispatched
      // but the report does not mention returns to pending NOW (the
      // executor's report is the grant's final word — it was either not
      // attempted, or the daily-limit ended the run). The lease path is
      // reserved for reports that never arrive at all.
      const reportedIds = new Set((report.results || []).map(r => r.occurrenceId));
      // RANGE-FIX (Option B): half-open PK range, not a LIKE pattern
      // (see generation/prefix-range.mjs). The sweep below is
      // set-membership + per-occurrence independent events, so it is
      // order-independent; the range returns PK index order.
      const grantOpsPred = prefixRangeClause("op_key", `op:${grant.grant_id}:`);
      const grantOps = this._all(
        `SELECT detail_json FROM ledger_ops WHERE kind = 'attempt' AND ${grantOpsPred.clause}`,
        ...grantOpsPred.params);
      for (const op of grantOps) {
        const oid = JSON.parse(op.detail_json || "{}").occurrenceId;
        if (!oid || reportedIds.has(oid)) continue;
        const o = this._oneOrNull(
          `SELECT * FROM occurrences WHERE job_id = ? AND occurrence_id = ?`, grant.job_id, oid);
        if (o && o.state === "granted")
          this.applyOccEvent(grant.job_id, oid, "defer", "report:grant_closed",
            { grantId: grant.grant_id });
      }
      this.sql.exec(`UPDATE grants SET state = 'reported', report_json = ? WHERE grant_id = ?`,
        JSON.stringify(report), grant.grant_id);
      // P3: a reported grant's claim is completed (acceptance ledger).
      this._completeClaim(grant.grant_id);
      // QUOTA GUARD (QUOTA-ADDENDUM §1.5): a report closes its
      // grant, so the grant's reservations settle here — each one
      // closes 'grant_settled' iff dispatch under it has become
      // impossible or complete (the fence in quota-budget.mjs
      // decides per reservation; a still-dispatchable or
      // unknown-billing execution leaves its reservation open and
      // visible, never silently freed). Unarmed: no-op.
      settleReservationsForGrant(this, grant.grant_id);
      // Job-level completion derivation for this grant's job (shared).
      this._deriveJobCompletion(grant.job_id, "report");
      // A successful probe is the evidence that the provider day reset:
      // it releases the account-wide park (F5; never a clock does this, B6).
      if (grant.grant_id.endsWith(":probe") && ready > 0) {
        this.sql.exec(`UPDATE quota_parks SET released_at = ?, release_cause = 'probe_success'
                       WHERE released_at IS NULL`, this._now());
      }
      // B7/F6: a repair plan that finishes with eligible blocked
      // occurrences remaining spawns its follow-on plan server-side —
      // the chain advances with no client present.
      const jobRow = this._oneOrNull(`SELECT * FROM jobs WHERE job_id = ?`, grant.job_id);
      const followOn = report.detail && report.detail.followOn;
      if (jobRow && jobRow.kind === "repair" &&
          (jobRow.state === "complete" || jobRow.state === "partial") &&
          followOn && Array.isArray(followOn.occurrences) && followOn.occurrences.length > 0) {
        // RANGE-FIX (Option B): the follow-on count is a half-open
        // PK range, not a LIKE pattern (see
        // generation/prefix-range.mjs). A COUNT has no order
        // semantics; the range counts exactly the byte-prefix set.
        const followPred = prefixRangeClause("job_id", grant.job_id + ":follow:");
        const prior = this._one(
          `SELECT COUNT(*) AS n FROM jobs WHERE ${followPred.clause}`, ...followPred.params).n;
        const followId = `${grant.job_id}:follow:${prior + 1}`;
        const sub = this._submitJob({
          jobId: followId, bookId: jobRow.book_id, chapterIndex: jobRow.chapter_index,
          lane: jobRow.lane, occurrences: followOn.occurrences,
          data: { ...(JSON.parse(jobRow.data_json || "{}")), chainParent: grant.job_id },
        }, "repair_chain", "repair");
        if (sub.outcome === "applied") {
          this._logTransition("job", followId, "repair_chain", null, "queued", 1,
            { parent: grant.job_id });
          // The chain ADVANCES, not just queues (P2 review finding 5): the
          // follow-on is granted in the same transaction. A refusal
          // (park/cap/quota) leaves it queued for the plan advancer —
          // the report itself is unaffected either way.
          this._issueGrant(followId, { jobEvent: "grant", cause: "repair_chain" });
        }
      }
      return { ok: true, ready, blocked, failed };
    });
    await this._armAlarmIfEarlier(); // a retry/lease from this report may be earliest
    return result;
  }

  // ---- audio bindings + conflict validation (Rowan criterion 2) -----------
  // A create-if-absent conflict NEVER silently overwrites and NEVER binds
  // on faith: the survivor's recorded identity/format is checked against
  // the occurrence's revision first. Unresolvable discrepancies stay
  // visible (binding_conflicts) and unbound.
  // `probe` is injected (env.probe in production = the R2/cache layer;
  // a stub in tests): { exists(cacheKey), sniff(cacheKey), recordedIdentity(cacheKey) }
  validateAndBind({ occurrenceId, revisionKey, cacheKey, provenance = null, jobId = null,
                    expectedSha256 = null }) {
    const probe = this.env.probe;
    const conflict = (expected, found, reason) => {
      this.sql.exec(
        `INSERT INTO binding_conflicts (at, occurrence_id, cache_key, expected, found, reason)
         VALUES (?, ?, ?, ?, ?, ?)`,
        this._now(), occurrenceId, cacheKey, expected, found, reason);
      return { bound: false, reason, expected, found };
    };
    if (!probe || !probe.exists(cacheKey))
      return { bound: false, reason: "object_missing" };
    const fmt = probe.sniff ? probe.sniff(cacheKey) : null;
    if (!fmt) return conflict(revisionKey, null, "format_invalid");
    // Byte-level verification (P2 review finding 3 + round 2 gap 3 +
    // round 3 fix 2): metadata agreement is not content agreement, and
    // for NEW recordings a verified digest is MANDATORY — a missing
    // hash no longer passes. EVERY available authoritative digest must
    // agree with the bytes actually present: the coordinator's own
    // cache index (anchored at an earlier bind), the storage layer's
    // write-time record, AND any caller-stated expected hash. A stated
    // hash that matches the current bytes does NOT excuse a prior
    // anchored digest that disagrees — bytes silently swapped under an
    // old key are a conflict, never a fresh success — and the
    // existing-binding idempotent return runs only AFTER these checks,
    // never instead of them. Legacy revisions keep their documented
    // uncertainty about identity provenance, but a KNOWN digest is never
    // ignored for them either.
    const actualSha = probe.hash ? probe.hash(cacheKey) : null;
    const idx = this._oneOrNull(`SELECT * FROM cache_index WHERE cache_key = ?`, cacheKey);
    const isLegacy = typeof revisionKey === "string" && revisionKey.startsWith("legacy:");
    const idxSha = (idx && idx.sha256) || null;
    const writeSha = probe.recordedSha256 ? probe.recordedSha256(cacheKey) : null;
    if (idxSha && writeSha && idxSha !== writeSha)
      return conflict(idxSha, writeSha, "content_hash_mismatch");
    const recordedSha = idxSha || writeSha;
    for (const stated of [recordedSha, expectedSha256]) {
      if (stated && actualSha !== stated)
        return conflict(stated, actualSha, "content_hash_mismatch");
    }
    const existing = this._oneOrNull(
      `SELECT * FROM bindings WHERE occurrence_id = ? AND revision_key = ?`,
      occurrenceId, revisionKey);
    if (existing && existing.cache_key === cacheKey)
      return { bound: true, idempotent: true, cacheKey };
    if (existing && existing.cache_key !== cacheKey)
      return conflict(revisionKey, existing.cache_key, "binding_conflict_existing");
    if (!expectedSha256 && !isLegacy && !recordedSha)
      return conflict(null, actualSha, "digest_unverified");
    // The survivor's recorded identity: the coordinator's own cache index
    // (written on every bind it has ever made) wins; the storage probe's
    // record is the fallback for objects that predate the coordinator.
    const recorded = (idx && idx.identity) ||
      (probe.recordedIdentity ? probe.recordedIdentity(cacheKey) : null);
    if (recorded && !isLegacy && recorded !== revisionKey)
      return conflict(revisionKey, recorded, "identity_mismatch");
    if (isLegacy && revisionKey !== `legacy:${cacheKey}`)
      return conflict(revisionKey, recorded, "legacy_anchor_mismatch");
    this.sql.exec(
      `INSERT INTO bindings (occurrence_id, revision_key, cache_key, provenance, bound_at)
       VALUES (?, ?, ?, ?, ?)`, occurrenceId, revisionKey, cacheKey, provenance, this._now());
    this.sql.exec(
      `INSERT INTO cache_index (cache_key, identity, format, sha256, recorded_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(cache_key) DO UPDATE SET identity = COALESCE(cache_index.identity, excluded.identity),
         format = excluded.format, sha256 = COALESCE(cache_index.sha256, excluded.sha256),
         recorded_at = excluded.recorded_at`,
      cacheKey, isLegacy ? null : revisionKey, fmt, actualSha, this._now());
    return { bound: true, cacheKey };
  }

  // ---- outcome_unknown reconciliation (§1.2 rule 4) --------------------------
  // The ONLY exits from outcome_unknown. Re-dispatch is not one of them.
  reconcileUnknown(jobId, occurrenceId) {
    return this._tx(() => {
      const occ = this._oneOrNull(
        `SELECT * FROM occurrences WHERE job_id = ? AND occurrence_id = ?`, jobId, occurrenceId);
      if (!occ || occ.state !== "outcome_unknown")
        return { ok: false, reason: "not_unknown" };
      // (a) the deterministic cache key exists -> adopt by binding.
      const candidate = this.env.probe && this.env.probe.keyFor
        ? this.env.probe.keyFor(occ) : null;
      if (candidate) {
        const v = this.validateAndBind({
          occurrenceId, revisionKey: occ.revision_key, cacheKey: candidate,
          provenance: "reconcile:cache", jobId });
        if (v.bound) {
          this.sql.exec(`UPDATE occurrences SET cache_key = ? WHERE job_id = ? AND occurrence_id = ?`,
            candidate, jobId, occurrenceId);
          const r = this.applyOccEvent(jobId, occurrenceId, "reconcile_adopt", "reconcile", { cacheKey: candidate });
          if (r.ok) { this._maybeResolveJob(jobId); return { ok: true, exit: "adopted", cacheKey: candidate }; }
        }
      }
      // (b) a CONFIRMED provider outcome recorded against the EXACT
      // grant that made this occurrence unknown -> spent, visible.
      // Evidence is never borrowed (round 4, Rowan blocker 2): the
      // source grant is read from THIS occurrence's own latest
      // transition into outcome_unknown (both entry paths — lease
      // expiry and unvalidated report — record their grantId), the
      // grant must belong to THIS job, and the attempt row is fetched
      // by its exact op key. No pattern matching over other jobs' or
      // other grants' ledger rows. A dispatch record (providerRequestId)
      // alone is only an attempt: it never proves the provider
      // completed or charged the request, so without a confirmed
      // outcome the occurrence stays outcome_unknown below — visible,
      // and never auto-replayed.
      const entry = this._oneOrNull(
        `SELECT detail_json FROM transitions
          WHERE aggregate = 'occurrence' AND aggregate_id = ? AND to_state = 'outcome_unknown'
          ORDER BY id DESC LIMIT 1`, `${jobId}/${occurrenceId}`);
      const sourceGrantId = entry
        ? (JSON.parse(entry.detail_json || "{}").grantId || null) : null;
      const sourceGrant = sourceGrantId
        ? this._oneOrNull(`SELECT * FROM grants WHERE grant_id = ?`, sourceGrantId) : null;
      const spend = (sourceGrant && sourceGrant.job_id === jobId)
        ? this._oneOrNull(`SELECT * FROM ledger_ops WHERE op_key = ?`,
            `op:${sourceGrantId}:${occurrenceId}`)
        : null;
      if (spend) {
        const d = JSON.parse(spend.detail_json || "{}");
        if (d.providerRequestId &&
            (d.providerOutcome === "failed" || d.providerOutcome === "spent_without_audio")) {
          const r = this.applyOccEvent(jobId, occurrenceId, "reconcile_spent", "reconcile",
            { providerRequestId: d.providerRequestId, providerOutcome: d.providerOutcome,
              providerEvidence: d.providerEvidence ?? null,
              spent_without_audio: true, visible_to_user: true });
          if (r.ok) { this._maybeResolveJob(jobId); return { ok: true, exit: "spent_without_audio" }; }
        }
      }
      // (c) neither -> stays outcome_unknown, surfaced to Julie (F7).
      return { ok: true, exit: "still_unknown" };
    });
  }

  _resolveUnknown(p, commandId) {
    // Julie's explicit authorization of a fresh synthesis (§1.2 rule 4c):
    // the occurrence returns to pending under a NEW operation identity.
    const r = this._tx(() => {
      const occ = this._oneOrNull(
        `SELECT * FROM occurrences WHERE job_id = ? AND occurrence_id = ?`, p.jobId, p.occurrenceId);
      if (!occ || occ.state !== "outcome_unknown")
        return { outcome: "rejected", reason: "not_unknown" };
      const a = this.applyOccEvent(p.jobId, p.occurrenceId, "resolve_resynthesize",
        "ResolveOutcomeUnknown", { commandId, authorized_by: "user" });
      if (!a.ok) return { outcome: "rejected", reason: a.reason };
      const j = this.applyJobEvent(p.jobId, "resolve", "ResolveOutcomeUnknown", { commandId });
      return j.ok ? { outcome: "applied", state: j.state }
                  : { outcome: "rejected", reason: j.reason };
    });
    return r;
  }

  // The single job-completion derivation, shared by report application,
  // reconciliation, and resume (P2 review round 2, gap 4): whenever an
  // occurrence set settles, the job lands in its TRUE state — including
  // 'complete' when a reconciliation made every occurrence ready.
  _deriveJobCompletion(jobId, cause) {
    const counts = this._one(
      `SELECT
         SUM(state = 'ready') AS ready,
         SUM(state = 'blocked_policy') AS blocked,
         SUM(state = 'failed') AS failed,
         SUM(state IN ('pending','granted')) AS open,
         SUM(state = 'outcome_unknown') AS unknown,
         COUNT(*) AS total
       FROM occurrences WHERE job_id = ?`, jobId);
    if (counts.unknown > 0) return this.applyJobEvent(jobId, "unknown", cause, {});
    if (counts.open > 0) {
      const job = this._oneOrNull(`SELECT * FROM jobs WHERE job_id = ?`, jobId);
      if (job && job.state === "outcome_unknown")
        return this.applyJobEvent(jobId, "resolve", cause, {});
      return { ok: true, state: job ? job.state : null };
    }
    if (counts.ready === counts.total)
      return this.applyJobEvent(jobId, "report_complete", cause, {});
    if (counts.ready > 0)
      return this.applyJobEvent(jobId, "report_partial", cause, {});
    if (counts.blocked > 0 || counts.failed > 0)
      return this.applyJobEvent(jobId, "report_failed", cause, {});
    return { ok: true };
  }

  _maybeResolveJob(jobId) { return this._deriveJobCompletion(jobId, "reconcile"); }

  // ---- settings aggregate ----------------------------------------------------
  _settings() {
    const row = this._oneOrNull(`SELECT * FROM settings WHERE id = 1`);
    if (!row) return { monthlyCap: 50, geminiLane: "batch", revision: 0 };
    return { ...JSON.parse(row.data_json), revision: row.revision };
  }

  _setSettings(p, commandId) {
    const cur = this._oneOrNull(`SELECT * FROM settings WHERE id = 1`);
    const curRev = cur ? cur.revision : 0;
    if (p.baseRevision !== undefined && p.baseRevision !== curRev)
      return { outcome: "rejected", reason: "settings_conflict", revision: curRev };
    const data = { ...(cur ? JSON.parse(cur.data_json) : { monthlyCap: 50, geminiLane: "batch" }),
                   ...(p.data || {}) };
    const revision = curRev + 1;
    this.sql.exec(
      `INSERT INTO settings (id, revision, data_json) VALUES (1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET revision = excluded.revision, data_json = excluded.data_json`,
      revision, JSON.stringify(data));
    this._logTransition("settings", "settings", "SetSettings",
      null, null, revision, { commandId });
    // P4: settings is a sync family — every applied update lands in
    // the change history + entity mirror in this same transaction,
    // so devices pull settings as deltas and converge detectably.
    this._appendChange("settings", "settings", null, revision, "upsert", data);
    this.sql.exec(
      `INSERT INTO sync_entities (family, entity_key, book_id, revision, deleted, data_json)
       VALUES ('settings', 'settings', NULL, ?, 0, ?)
       ON CONFLICT(family, entity_key) DO UPDATE SET revision = excluded.revision,
         deleted = 0, data_json = excluded.data_json`,
      revision, JSON.stringify(data));
    return { outcome: "applied", revision, data };
  }

  // ---- durable schedule + alarm watchdog chain (Rowan criterion 1) ----------
  _schedule(dueAt, kind, ref, payload) {
    this.sql.exec(
      `INSERT INTO schedule (due_at, kind, ref, payload_json) VALUES (?, ?, ?, ?)`,
      dueAt, kind, ref, JSON.stringify(payload || {}));
  }

  // Cloudflare's alarm API is asynchronous: getAlarm() and setAlarm()
  // return Promises. These MUST be awaited — treating a Promise as the
  // armed timestamp would read as "armed" forever and silently kill the
  // chain (P2 review finding 5).
  async _armAlarm() {
    const next = this._one(
      `SELECT MIN(due_at) AS due FROM schedule WHERE state = 'pending'`);
    const due = next && next.due !== null ? next.due : this._now() + WATCHDOG_PERIOD_MS;
    await this.state.storage.setAlarm(due);
  }

  // Called on every coordinator wake: if the chain is unarmed (alarm
  // consumed and handler died, retries exhausted, fresh start), re-arm it.
  // Recovery never requires a client — any wake (command, report, alarm)
  // re-establishes the chain, and the chain itself is self-perpetuating.
  async wake() {
    const wd = this._one(
      `SELECT COUNT(*) AS n FROM schedule WHERE state = 'pending' AND kind = 'watchdog'`);
    if (!wd || wd.n === 0) this._schedule(this._now() + WATCHDOG_PERIOD_MS, "watchdog", null, {});
    await this._armAlarmIfEarlier();
  }

  // Arm the alarm at the earliest pending work if it is sooner than the
  // currently armed time (or nothing is armed) — newly scheduled earlier
  // work must ADVANCE the alarm, not wait for it (P2 review round 2,
  // gap 5). Entry points call this after their writes commit.
  async _armAlarmIfEarlier() {
    const armed = await this.state.storage.getAlarm();
    const next = this._one(
      `SELECT MIN(due_at) AS due FROM schedule WHERE state = 'pending'`);
    const due = next && next.due !== null ? next.due : this._now() + WATCHDOG_PERIOD_MS;
    if (armed === null || armed === undefined || due < armed)
      await this.state.storage.setAlarm(due);
  }

  async alarm() {
    try {
      const now = this._now();
      const due = this._all(
        `SELECT * FROM schedule WHERE state = 'pending' AND due_at <= ? ORDER BY due_at`, now);
      for (const row of due) {
        try {
          await this._processScheduleRow(row);
          this.sql.exec(`UPDATE schedule SET state = 'done' WHERE id = ?`, row.id);
        } catch (e) {
          // A poison row backs off and eventually parks as a VISIBLE dead
          // row; it can never kill the chain or starve other rows.
          const attempts = row.attempts + 1;
          if (attempts >= SCHEDULE_MAX_ATTEMPTS) {
            this.sql.exec(`UPDATE schedule SET state = 'dead', attempts = ? WHERE id = ?`, attempts, row.id);
            this.sql.exec(
              `INSERT INTO binding_conflicts (at, occurrence_id, cache_key, expected, found, reason)
               VALUES (?, ?, ?, ?, ?, 'schedule_dead')`,
              now, row.ref, row.kind, String(row.attempts), String(e && e.message || e));
          } else {
            const backoff = Math.min(30000 * 2 ** attempts, 900000);
            this.sql.exec(`UPDATE schedule SET attempts = ?, due_at = ? WHERE id = ?`,
              attempts, now + backoff, row.id);
          }
        }
      }
    } finally {
      // The chain re-arms UNCONDITIONALLY — even if every row threw.
      const wd = this._one(
        `SELECT COUNT(*) AS n FROM schedule WHERE state = 'pending' AND kind = 'watchdog'`);
      if (!wd || wd.n === 0) this._schedule(this._now() + WATCHDOG_PERIOD_MS, "watchdog", null, {});
      await this._armAlarm();
    }
  }

  async _processScheduleRow(row) {
    const payload = JSON.parse(row.payload_json || "{}");
    if (this.env.scheduleHook) this.env.scheduleHook(row, payload); // fault-injection seam (tests)
    switch (row.kind) {
      case "watchdog": {
        // Re-assert the chain + deliver any grants whose send was lost.
        // A missing delivery handler is NOT a delivery: the outbox rows
        // stay unsent and visible rather than being marked sent.
        if (typeof this.env.sendGrant === "function")
          await this.drainOutbox(this.env.sendGrant);
        break;
      }
      case "lease": {
        // Lease expiry (interruption seam iii): occurrences still granted
        // under this grant become outcome_unknown — NEVER re-dispatched.
        // Recovery then attempts SAFE reconciliation immediately, with
        // no device involved (gap 4): adopt from the cache if the audio
        // provably landed, or record the spend ONLY on a confirmed
        // provider outcome (a dispatch record alone proves nothing).
        // Whatever cannot be proven stays outcome_unknown for Julie.
        const grant = this._oneOrNull(`SELECT * FROM grants WHERE grant_id = ?`, row.ref);
        if (!grant || grant.state === "reported" || grant.state === "voided") break;
        // Pre-delivery expiry (round 4, Rowan blocker 1): provider
        // uncertainty may be inferred ONLY for work provably handed
        // off. Delivery is proven by the outbox row's sent_at — the
        // acknowledged handoff. A grant whose dispatch never left has
        // NO unknown outcome to record: void the dispatch, release its
        // reservations, and return its occurrences to pending so the
        // work can be granted fresh. No phantom outcome_unknown, ever.
        const outRow = this._oneOrNull(`SELECT * FROM outbox WHERE id = ?`, grant.grant_id);
        if (!outRow || !outRow.sent_at) {
          if (this._frozen()) {
            // A freeze holds EVERYTHING, including this decision:
            // re-check shortly after thaw instead of voiding mid-freeze.
            // The deferral TOLLS the delivery window — the grant's
            // lease_expires_at moves with the rescheduled row, so a
            // dispatch delivered right after thaw is still in-window
            // for the drain-time fence.
            const tolled = this._now() + 60000;
            this.sql.exec(`UPDATE grants SET lease_expires_at = ? WHERE grant_id = ?`,
              tolled, grant.grant_id);
            this._schedule(tolled, "lease", grant.grant_id, { deferred: "frozen" });
            break;
          }
          if (outRow && outRow.send_attempted_at) {
            // ATTEMPTED, ACK UNCERTAIN (round 5, Rowan qualification A):
            // the send was invoked but no ACK was recorded — the queue
            // may already hold this message. "Not ACKed" is NOT "never
            // left": nothing is voided, no reservation is released, no
            // re-grant is possible (the occurrences stay granted), and
            // the uncertainty is a VISIBLE grant state, resolved only
            // by the queue-acceptance probe (handoff_check) or by the
            // executor's report — never by assumption.
            if (grant.state !== "handoff_uncertain") {
              this.sql.exec(`UPDATE grants SET state = 'handoff_uncertain' WHERE grant_id = ?`,
                grant.grant_id);
              this._logTransition("grant", grant.grant_id, "handoff_uncertain",
                grant.state, "handoff_uncertain", null, { jobId: grant.job_id });
              this._schedule(this._now() + 30000, "handoff_check", grant.grant_id, { tries: 0 });
            }
            break;
          }
          if (outRow) {
