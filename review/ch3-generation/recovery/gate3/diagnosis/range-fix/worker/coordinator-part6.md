            // NEVER INVOKED: provably unsent — the round-4 safe void,
            // and the job re-advances on its own (round 5, B).
            this._tx(() => this._voidDispatch(
              { grantId: grant.grant_id, jobId: grant.job_id },
              "lease_expired_undelivered"));
            this._scheduleReAdvance(grant.job_id);
          } else {
            // No outbox row at all: nothing was ever deliverable, so
            // nothing was sent — retire the grant outright.
            this.sql.exec(`UPDATE grants SET state = 'voided' WHERE grant_id = ?`,
              grant.grant_id);
            this._logTransition("grant", grant.grant_id, "lease_expired_undelivered",
              grant.state, "voided", null, { jobId: grant.job_id, outbox: "absent" });
          }
          break;
        }
        const occs = this._all(
          `SELECT * FROM occurrences WHERE job_id = ? AND state = 'granted'`, grant.job_id);
        // RANGE-FIX (Option B): half-open PK range, not a LIKE
        // pattern (see generation/prefix-range.mjs). The result is
        // consumed as a Set, so it is order-independent.
        const leaseOpsPred = prefixRangeClause("op_key", `op:${grant.grant_id}:`);
        const grantOps = this._all(
          `SELECT detail_json FROM ledger_ops WHERE kind = 'attempt' AND ${leaseOpsPred.clause}`,
          ...leaseOpsPred.params);
        const grantedIds = new Set(grantOps.map(r => JSON.parse(r.detail_json || "{}").occurrenceId));
        const newlyUnknown = [];
        for (const o of occs) {
          if (!grantedIds.has(o.occurrence_id)) continue;
          const r = this.applyOccEvent(grant.job_id, o.occurrence_id, "lease_expired",
            "lease_expiry", { grantId: grant.grant_id });
          if (r.ok) newlyUnknown.push(o.occurrence_id);
        }
        if (newlyUnknown.length > 0)
          this.applyJobEvent(grant.job_id, "unknown", "lease_expiry", { grantId: grant.grant_id });
        for (const oid of newlyUnknown) this.reconcileUnknown(grant.job_id, oid);
        break;
      }
      case "retry_grant": {
        // Bounded-backoff continuation after generic 429s / plan steps /
        // safe voids (round 5, B). A freeze defers it like everything
        // else; a refusal by the grant gate (park, cap, quota, nothing
        // pending) ends the chain — no self-rescheduling, no spin.
        const job = this._oneOrNull(`SELECT * FROM jobs WHERE job_id = ?`, row.ref);
        if (job && this._frozen()) {
          this._schedule(this._now() + 60000, "retry_grant", row.ref,
            { ...payload, deferred: "frozen" });
          break;
        }
        if (job && job.state === "generating") await this.requestGrant(row.ref, { cause: "retry_grant" });
        break;
      }
      case "handoff_check": {
        // Queue-acceptance reconciliation (round 5, A): the ONLY
        // arbiter of an attempted-but-unacknowledged handoff is the
        // queue's own record for this grantId. "accepted" completes
        // the handoff (lease anchors to the confirmation); "not_
        // accepted" proves the message never landed, so the round-4
        // safe void finally applies; "unknown" (or no probe wired)
        // keeps the uncertainty visible and backs off, bounded.
        // P3 CONTRACT for the real queue probe: "not_accepted" must be
        // TERMINAL proof — the queue guarantees this grantId can never
        // be accepted after the verdict (its acceptance ledger is
        // final for the grant), never merely "not seen yet" while a
        // send may still be in flight. Anything short of terminal is
        // "unknown".
        const before = this._oneOrNull(`SELECT * FROM grants WHERE grant_id = ?`, row.ref);
        if (!before || before.state !== "handoff_uncertain") break;
        if (this._frozen()) {
          // A freeze holds this decision too (round 6, race 2): the
          // verdict — and any void it would trigger — waits for thaw,
          // so the re-advance that follows a void is scheduled in the
          // open, never dropped into a freeze and lost.
          this._schedule(this._now() + 60000, "handoff_check", row.ref, payload);
          break;
        }
        let verdict = "unknown";
        if (typeof this.env.probeQueue === "function") {
          try { verdict = await this.env.probeQueue(row.ref); }
          catch { verdict = "unknown"; }
        }
        // The verdict is evidence about the past; it may act ONLY on
        // the CURRENT state, re-read inside one transaction after the
        // await (round 6, race 1): a report or a late ACK can settle
        // the grant while the probe is in flight. A stale verdict is
        // logged and changes nothing — it can neither resurrect a
        // reported grant to 'issued' nor void a delivered one.
        this._tx(() => {
          const grant = this._oneOrNull(`SELECT * FROM grants WHERE grant_id = ?`, row.ref);
          const outRow = this._oneOrNull(`SELECT * FROM outbox WHERE id = ?`, row.ref);
          if (!grant || grant.state !== "handoff_uncertain" || !outRow || outRow.sent_at) {
            this._logTransition("grant", row.ref, "handoff_verdict_stale",
              grant ? grant.state : null, grant ? grant.state : null, null,
              { verdict, jobId: grant ? grant.job_id : null });
            return;
          }
          if (verdict === "accepted") {
            const t = this._now();
            this.sql.exec(`UPDATE outbox SET sent_at = ? WHERE id = ? AND sent_at IS NULL`,
              t, grant.grant_id);
            this.sql.exec(`UPDATE grants SET state = 'issued', lease_expires_at = ? WHERE grant_id = ?`,
              t + LEASE_MS, grant.grant_id);
            this.sql.exec(
              `UPDATE schedule SET state = 'void' WHERE kind = 'lease' AND ref = ? AND state = 'pending'`,
              grant.grant_id);
            this._schedule(t + LEASE_MS, "lease", grant.grant_id, { anchored: "handoff_confirmed" });
            this._logTransition("grant", grant.grant_id, "handoff_resolved",
              "handoff_uncertain", "issued", null, { via: "queue_probe" });
          } else if (verdict === "not_accepted") {
            // THE CLAIM FENCE (P3 round 2, Rowan): before a terminal
            // handoff void/release/re-grant, atomically verify there
            // is NO claimed acceptance for this grant. A claim is
            // stronger evidence than the queue's verdict — a consumer
            // holds the work and may be executing against a spend
            // intent. If a claim exists, the verdict is contradictory/
            // stale: preserve the grant AND its quota accounting, log
            // the contradiction, and reconcile the handoff as ACCEPTED
            // on the claim's own evidence. The execution lease runs
            // from here; an unreported execution ages into
            // outcome-unknown through the normal lease path — never
            // into a void, a false release, and an orphaned report.
            const claim = this._oneOrNull(`SELECT * FROM claims WHERE grant_id = ?`, grant.grant_id);
            if (claim && claim.state === "claimed") {
              const t = this._now();
              this._logTransition("grant", grant.grant_id, "handoff_verdict_contradicts_claim",
                "handoff_uncertain", "handoff_uncertain", null,
                { claimedBy: claim.consumer_id, claimedAt: claim.claimed_at });
              this.sql.exec(`UPDATE outbox SET sent_at = ? WHERE id = ? AND sent_at IS NULL`,
                claim.claimed_at || t, grant.grant_id);
              this.sql.exec(`UPDATE grants SET state = 'issued', lease_expires_at = ? WHERE grant_id = ?`,
                t + LEASE_MS, grant.grant_id);
              this.sql.exec(
                `UPDATE schedule SET state = 'void' WHERE kind = 'lease' AND ref = ? AND state = 'pending'`,
                grant.grant_id);
              this._schedule(t + LEASE_MS, "lease", grant.grant_id, { anchored: "claim_precedence" });
              this._logTransition("grant", grant.grant_id, "handoff_resolved",
                "handoff_uncertain", "issued", null, { via: "claim_precedence" });
            } else {
              this._voidDispatch(
                { grantId: grant.grant_id, jobId: grant.job_id }, "handoff_proven_unaccepted");
              this._scheduleReAdvance(grant.job_id);
            }
          } else {
            const tries = (payload.tries || 0) + 1;
            if (tries <= 5) {
              this._schedule(this._now() + 30000 * 2 ** (tries - 1),
                "handoff_check", grant.grant_id, { tries });
            } else {
              this._logTransition("grant", grant.grant_id, "handoff_unresolved",
                "handoff_uncertain", "handoff_uncertain", null,
                { tries, note: "queue probe could not settle acceptance; uncertainty stays visible" });
            }
          }
        });
        break;
      }
      default: break; // plan_step kinds are interpreted by their owners
    }
  }

  // ---- read models (pure — used by the GET API; no writes) -------------------
  receipt(commandId) {
    const c = this._oneOrNull(`SELECT * FROM commands WHERE command_id = ?`, commandId);
    if (!c) return null;
    return { command_id: c.command_id, type: c.type, outcome: c.outcome,
             ...(c.outcome_json ? JSON.parse(c.outcome_json) : {}),
             received_at: c.received_at };
  }

  jobView(jobId) {
    const job = this._oneOrNull(`SELECT * FROM jobs WHERE job_id = ?`, jobId);
    if (!job) return null;
    const occs = this._all(
      `SELECT occurrence_id, revision_key, state, cache_key FROM occurrences WHERE job_id = ? ORDER BY occurrence_id`,
      jobId);
    // Grant states ride along so a handoff_uncertain grant (round 5) is
    // VISIBLE on the same surface as the job it belongs to — uncertainty
    // that no read model shows is uncertainty that gets forgotten.
    const grants = this._all(
      `SELECT grant_id, state, revision FROM grants WHERE job_id = ? ORDER BY created_at`, jobId);
    return { jobId: job.job_id, kind: job.kind, bookId: job.book_id,
             chapterIndex: job.chapter_index, lane: job.lane, state: job.state,
             revision: job.revision, occurrences: occs, grants };
  }

  quotaView() {
    const now = this._now();
    const day = dayKeyPT(now), month = monthKey(now);
    const attemptsToday = this._attemptsOn(day);
    const spentMonth = this._spendIn(month);
    const park = this._oneOrNull(
      `SELECT * FROM quota_parks WHERE released_at IS NULL ORDER BY id DESC LIMIT 1`);
    const ledgerSeq = this._one(`SELECT COALESCE(MAX(rowid), 0) AS m FROM ledger_ops`).m;
    // QUOTA GUARD surface (QUOTA-ADDENDUM §3.3/§4): when the
    // quota bootstrap has armed the store, the view ALSO carries
    // the provider-dispatch figures, labeled distinctly from the
    // grant counter above — "grants today" (attemptsToday, the
    // estimate ledger) vs "Reader D6 provider requests today,
    // app-counted" (providerDispatchesToday). The two numbers
    // count different things and are never merged. Unarmed, the
    // view is byte-for-byte the floor's.
    const quota = quotaBudgetView(this, day);
    return { dayKey: day, attemptsToday, dailyLimit: DAILY_QUOTA_LIMIT,
             basis: "Reader estimate (server attempt ledger)",
             ...(quota.armed ? {
               providerDispatchesToday: quota.dispatched,
               providerReservedToday: quota.reserved,
               providerAttemptDailyLimit: quota.providerAttemptDailyLimit,
               providerBasis: quota.dispatchesTodayLabel,
               providerLimitProvenance: quota.limitProvenance,
             } : {}),
             monthKey: month, spentMicroCents: spentMonth,
             monthlyCap: this._settings().monthlyCap,
             // P4 money surface: revisioned reads so two devices can
             // detect divergence and converge. A cached copy of this
             // view is display data only — grants re-read the ledger
             // inside their transaction; a cache never authorizes.
             ledgerSeq, settingsRevision: this._settings().revision,
             parked: park ? { parkedAt: park.parked_at,
                              evidence: JSON.parse(park.evidence_json || "{}") } : null };
  }

  settingsView() { return this._settings(); }

  conflictsView() {
    return this._all(`SELECT * FROM binding_conflicts ORDER BY id DESC LIMIT 100`);
  }

  // ============ P3: acceptance claims, spend fences, Batch maps ====
  // The executor-facing surface (Case #5 contracts + gate-2
  // conditions). Every method is one transaction; none of them touches
  // jobs.revision (claims are not job transitions — the executor reads
  // the job's current revision when it reports).

  // ClaimGrant: the acceptance ledger write. Claiming is allowed
  // while the grant is live (issued / delivered / handoff_uncertain).
  // Terminal grant states map to terminal claim answers: reported ->
  // completed, voided/superseded -> closed (this dispatch can never
  // be accepted now). Returns are READ-ONLY evidence (gate-2
  // condition 1): holding or re-reading a claim never permits a
  // provider call — only AcquireSpendIntent does.
  claimGrant({ grantId, consumerId }) {
    return this._tx(() => {
      const grant = this._oneOrNull(`SELECT * FROM grants WHERE grant_id = ?`, grantId);
      if (!grant) return { status: "unknown_grant" };
      const existing = this._oneOrNull(`SELECT * FROM claims WHERE grant_id = ?`, grantId);
      if (existing) {
        return { status: existing.state === "claimed" ? "already_claimed"
                : existing.state, claim: existing };
      }
      if (grant.state === "reported") {
        this.sql.exec(`INSERT INTO claims (grant_id, state, consumer_id, claimed_at, updated_at)
          VALUES (?, 'completed', NULL, NULL, ?)`, grantId, this._now());
        return { status: "completed" };
      }
      if (grant.state === "voided" || grant.state === "superseded") {
        this.sql.exec(`INSERT INTO claims (grant_id, state, consumer_id, claimed_at, closed_reason, updated_at)
          VALUES (?, 'closed', NULL, NULL, ?, ?)`, grantId, `grant_${grant.state}`, this._now());
        return { status: "closed", reason: `grant_${grant.state}` };
      }
      const t = this._now();
      this.sql.exec(`INSERT INTO claims (grant_id, state, consumer_id, claimed_at, updated_at)
        VALUES (?, 'claimed', ?, ?, ?)`, grantId, consumerId, t, t);
      this._logTransition("grant", grantId, "claim_acquired",
        grant.state, grant.state, null, { consumerId });
      return { status: "claimed",
               claim: { grant_id: grantId, state: "claimed", consumer_id: consumerId, claimed_at: t } };
    });
  }

  // The probe's source of truth (contracts addendum): verdicts derive
  // ONLY from claim rows. claimed/completed -> accepted (with the
  // claim timestamp); closed -> not_accepted (terminal: closure
  // itself required terminal evidence); NO ROW -> unknown, forever
  // until a row exists. Absence is never a terminal negative.
  probeVerdict(grantId) {
    const claim = this._oneOrNull(`SELECT * FROM claims WHERE grant_id = ?`, grantId);
    if (!claim) return { verdict: "unknown" };
    if (claim.state === "closed") return { verdict: "not_accepted", reason: claim.closed_reason };
    return { verdict: "accepted", claimedAt: claim.claimed_at };
  }

  // Terminal closure of an unclaimed grant (contract 1): allowed ONLY
  // with terminal delivery evidence supplied by the handoff machinery
  // (the queue's final never-accepted record for this grant) — the
  // caller must name the evidence; a claimed grant REFUSES closure
  // (never closed out from under its consumer). A claim landing after
  // closure is rejected_terminal by claimGrant's row check.
  closeAcceptance({ grantId, evidence }) {
    return this._tx(() => {
      const existing = this._oneOrNull(`SELECT * FROM claims WHERE grant_id = ?`, grantId);
      if (existing) {
        if (existing.state === "claimed") return { closed: false, reason: "claimed" };
        return { closed: existing.state === "closed", reason: existing.closed_reason };
      }
      const grant = this._oneOrNull(`SELECT * FROM grants WHERE grant_id = ?`, grantId);
      if (!grant) return { closed: false, reason: "unknown_grant" };
      const t = this._now();
      this.sql.exec(`INSERT INTO claims (grant_id, state, consumer_id, claimed_at, closed_reason, updated_at)
        VALUES (?, 'closed', NULL, NULL, ?, ?)`, grantId, String(evidence || "terminal_no_accept"), t);
      this._logTransition("grant", grantId, "acceptance_closed",
        grant.state, grant.state, null, { evidence: String(evidence || "") });
      return { closed: true };
    });
  }

  // Marks a claim completed when its grant is reported. Called by
  // handleReport's transaction (internal; not an executor command).
  _completeClaim(grantId) {
    this.sql.exec(`UPDATE claims SET state = 'completed', updated_at = ?
      WHERE grant_id = ? AND state = 'claimed'`, this._now(), grantId);
  }

  // AcquireSpendIntent (gate-2 condition 1): the ONLY permit for a
  // provider call, per OCCURRENCE. Atomic exactly-once. Requires a
  // live claim on the presenting grant held by THIS consumer — owning
  // or re-reading a claim is never enough. A second acquisition by
  // anyone, ever, returns the existing intent with acquired:false:
  // an intent without a recorded known outcome is spent-or-unknown
  // and must be reconciled by evidence, never re-spent. Because the
  // fence follows the occurrence, a deferred occurrence re-granted
  // under a fresh grant meets the same fence — no second spend.
  _latestIntent(jobId, occurrenceId) {
    return this._oneOrNull(
      `SELECT * FROM spend_intents WHERE job_id = ? AND occurrence_id = ?
       ORDER BY generation DESC LIMIT 1`, jobId, occurrenceId);
  }

  _latestBatchMap(jobId, occurrenceId) {
    return this._oneOrNull(
      `SELECT * FROM batch_maps WHERE job_id = ? AND occurrence_id = ?
       ORDER BY generation DESC LIMIT 1`, jobId, occurrenceId);
  }

  acquireSpendIntent({ grantId, jobId, occurrenceId, consumerId }) {
    return this._tx(() => {
      const latest = this._latestIntent(jobId, occurrenceId);
      // A live (non-superseded) intent is the spend boundary: final.
      if (latest && !latest.superseded_at) return { acquired: false, intent: latest };
      const claim = this._oneOrNull(`SELECT * FROM claims WHERE grant_id = ?`, grantId);
      if (!claim || claim.state !== "claimed") return { acquired: false, reason: "not_claimed" };
      if (claim.consumer_id !== consumerId) return { acquired: false, reason: "claimed_by_other" };
      const t = this._now();
      const generation = latest ? latest.generation + 1 : 1;
      this.sql.exec(`INSERT INTO spend_intents (job_id, occurrence_id, grant_id, consumer_id, acquired_at, generation)
        VALUES (?, ?, ?, ?, ?, ?)`, jobId, occurrenceId, grantId, consumerId, t, generation);
      if (latest) this._logTransition("grant", grantId, "spend_intent_acquired",
        "superseded", "acquired", null, { occurrenceId, generation });
      return { acquired: true,
               intent: { job_id: jobId, occurrence_id: occurrenceId, grant_id: grantId,
                         consumer_id: consumerId, acquired_at: t, outcome: null, generation } };
    });
  }

  // Records a KNOWN provider outcome against a spend intent (an HTTP
  // answer — success handled via reports; rejections and known
  // failures land here for reconciliation visibility). An ambiguous
  // outcome is recorded by NOT calling this: the intent stays open.
  noteSpendOutcome({ jobId, occurrenceId, outcome, detail }) {
    return this._tx(() => {
      const cur = this._latestIntent(jobId, occurrenceId);
      if (!cur || cur.superseded_at) return { noted: false, reason: "no_intent" };
      if (cur.outcome) return { noted: false, reason: "already_noted", outcome: cur.outcome };
      this.sql.exec(`UPDATE spend_intents SET outcome = ?, outcome_detail = ?
        WHERE job_id = ? AND occurrence_id = ? AND generation = ?`,
        outcome, detail ? String(detail).slice(0, 320) : null, jobId, occurrenceId, cur.generation);
      return { noted: true };
    });
  }

  // ---- Batch mapping (contract 2). The fence is written BEFORE the
  // billable POST and requires the spend intent (the POST is the one
  // paid action the intent permits). Exactly-once, like the intent,
  // and occurrence-keyed: re-grants poll the existing mapping.
  fenceBatchSubmit({ grantId, jobId, occurrenceId, displayName, consumerId }) {
    return this._tx(() => {
      const existing = this._latestBatchMap(jobId, occurrenceId);
      if (existing && !existing.superseded_at) return { fenced: false, map: existing };
      const intent = this._latestIntent(jobId, occurrenceId);
      if (!intent || intent.superseded_at) return { fenced: false, reason: "no_spend_intent" };
      if (intent.consumer_id !== consumerId) return { fenced: false, reason: "claimed_by_other" };
      const t = this._now();
      const generation = intent.generation;
      this.sql.exec(`INSERT INTO batch_maps (job_id, occurrence_id, grant_id, display_name, provider_name, state, detail, updated_at, generation)
        VALUES (?, ?, ?, ?, NULL, 'fenced', NULL, ?, ?)`, jobId, occurrenceId, grantId, displayName, t, generation);
      return { fenced: true,
               map: { job_id: jobId, occurrence_id: occurrenceId, grant_id: grantId,
                      display_name: displayName, provider_name: null, state: "fenced", generation } };
    });
  }

  _batchTransition(jobId, occurrenceId, fromStates, toState, fields, cause) {
    return this._tx(() => {
      const cur = this._latestBatchMap(jobId, occurrenceId);
      if (!cur) return { ok: false, reason: "no_map" };
      if (cur.superseded_at) return { ok: false, reason: "superseded", map: cur };
      if (!fromStates.includes(cur.state)) return { ok: false, reason: `state_${cur.state}`, map: cur };
      const sets = ["state = ?", "updated_at = ?"];
      const vals = [toState, this._now()];
      for (const [k, v] of Object.entries(fields || {})) { sets.push(`${k} = ?`); vals.push(v); }
      vals.push(jobId, occurrenceId, cur.generation);
      this.sql.exec(`UPDATE batch_maps SET ${sets.join(", ")} WHERE job_id = ? AND occurrence_id = ? AND generation = ?`, ...vals);
      this._logTransition("grant", cur.grant_id, cause, cur.state, toState, null,
        { occurrenceId, displayName: cur.display_name });
      return { ok: true, map: { ...cur, state: toState, ...(fields || {}) } };
    });
  }

  // The provider accepted and returned a name: persist it at once.
  noteBatchSubmitted({ jobId, occurrenceId, providerName }) {
    return this._batchTransition(jobId, occurrenceId, ["fenced"], "submitted",
      { provider_name: providerName }, "batch_submitted");
  }
  // The POST's outcome is unknown (transport loss): the fence stands;
  // this mapping may NEVER be resubmitted (contract 2).
  noteBatchAmbiguous({ jobId, occurrenceId, detail }) {
    return this._batchTransition(jobId, occurrenceId, ["fenced"], "ambiguous",
      { detail: detail ? String(detail).slice(0, 320) : "submit_outcome_unknown" }, "batch_ambiguous");
  }
  // The provider explicitly rejected the submission (an HTTP answer
  // is a KNOWN outcome): the fence clears, the failure is reportable.
  noteBatchRejected({ jobId, occurrenceId, detail }) {
    return this._batchTransition(jobId, occurrenceId, ["fenced"], "rejected",
      { detail: detail ? String(detail).slice(0, 320) : "rejected" }, "batch_rejected");
  }
  // Lookup adoption: enumeration FOUND the job (a match is evidence).
  adoptBatchByLookup({ jobId, occurrenceId, providerName, evidence }) {
    return this._batchTransition(jobId, occurrenceId, ["ambiguous"], "submitted",
      { provider_name: providerName, detail: `adopted_via_lookup: ${String(evidence || "").slice(0, 240)}` },
      "batch_adopted");
  }
  // Explicit resolution of an ambiguous submission as never-accepted,
  // ONLY with named authoritative evidence (gate-2 condition 2 — a
  // missing lookup match is NOT evidence and cannot call this). On
  // closure the fencing dispatch is voided if still open and the job
  // re-advances exactly like a proven unaccepted handoff: the spend
  // reservation is released and the work is re-granted; a job whose
  // occurrence already returned to pending via a partial report is
  // simply re-granted by the same retry path.
  resolveBatchNeverAccepted({ jobId, occurrenceId, evidence }) {
    const ev = String(evidence || "").slice(0, 240);
    const done = this._tx(() => {
      const cur = this._latestBatchMap(jobId, occurrenceId);
      if (!cur) return { ok: false, reason: "no_map" };
      if (cur.superseded_at) return { ok: false, reason: "superseded", map: cur };
      if (cur.state !== "ambiguous") return { ok: false, reason: `state_${cur.state}`, map: cur };
      const t = this._now();
      // Close this generation AND supersede it, atomically: the map
      // and its spend intent are retired together, with the evidence
      // as the audit record. Only a superseded generation may be
      // succeeded — the next claim acquires a FRESH intent at
      // generation+1 (the original permit is never reused).
      this.sql.exec(`UPDATE batch_maps SET state = 'closed', superseded_at = ?,
          detail = ?, updated_at = ?
        WHERE job_id = ? AND occurrence_id = ? AND generation = ?`,
        t, `never_accepted: ${ev}`, t, jobId, occurrenceId, cur.generation);
      const intent = this._latestIntent(jobId, occurrenceId);
      if (intent && !intent.superseded_at) {
        this.sql.exec(`UPDATE spend_intents SET superseded_at = ?, superseded_reason = ?
          WHERE job_id = ? AND occurrence_id = ? AND generation = ?`,
          t, `batch_never_accepted: ${ev}`, jobId, occurrenceId, intent.generation);
      }
      this._logTransition("grant", cur.grant_id, "batch_never_accepted",
        "ambiguous", "closed", null,
        { occurrenceId, generation: cur.generation, evidence: ev });
      this._logTransition("grant", cur.grant_id, "spend_intent_superseded",
        "acquired", "superseded", null,
        { occurrenceId, generation: cur.generation, evidence: ev });
      // Void the fencing dispatch if it is still open (releasing its
      // reservation), then the standard re-advance takes over. The
      // CLAIM on that grant is untouched — acceptance happened; only
      // the batch submission is resolved as never-accepted.
      const grant = cur.grant_id
        ? this._oneOrNull(`SELECT * FROM grants WHERE grant_id = ?`, cur.grant_id) : null;
      if (grant && (grant.state === "issued" || grant.state === "delivered" || grant.state === "handoff_uncertain")) {
        // claimedOk: this caller owns the claimed case — its
        // evidence is about the PROVIDER submission (not the queue
        // handoff), the claim row is preserved untouched, and the
        // re-attempt is generation-fenced (P3 round-2 fence scope).
        this._voidDispatch({ grantId: cur.grant_id, jobId }, "batch_never_accepted", { claimedOk: true });
      }
      return { ok: true, voided: !!grant, generation: cur.generation, map: { ...cur, state: "closed", superseded_at: t } };
    });
    if (done.ok) this._scheduleReAdvance(jobId);
    return done;
  }

  claimView(grantId) {
    return this._oneOrNull(`SELECT * FROM claims WHERE grant_id = ?`, grantId) || null;
  }

  workView(jobId) {
    // Latest generation per occurrence — the current attempt's rows.
    // (Full history stays in the tables + transitions for audit.)
    return {
      intents: this._all(
