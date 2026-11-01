    return { outcome: "applied", state: after.state, revision: after.revision };
  }

  _requestSynthesis(p, commandId) {
    // §1.1: auditions and single-segment generation pass the same gate as
    // jobs. Cached answer first; otherwise a one-occurrence job + grant.
    if (p.revisionKey && p.occurrenceId) {
      const b = this._oneOrNull(
        `SELECT * FROM bindings WHERE occurrence_id = ? AND revision_key = ?`,
        p.occurrenceId, p.revisionKey);
      if (b) return { outcome: "applied", answer: "cached", cacheKey: b.cache_key };
      // One in-flight operation per (occurrence, revision), whoever asked
      // (P2 review round 2, gap 1): two devices requesting the same audio
      // before either recording exists share the operation — the second
      // request joins it instead of paying for a duplicate synthesis.
      const dupe = this._oneOrNull(
        `SELECT j.job_id AS jobId, o.state AS occState
           FROM occurrences o JOIN jobs j ON j.job_id = o.job_id
          WHERE o.occurrence_id = ? AND o.revision_key = ?
            AND j.state NOT IN ('complete', 'failed', 'cancelled', 'superseded')
          ORDER BY j.created_at DESC LIMIT 1`, p.occurrenceId, p.revisionKey);
      if (dupe && dupe.occState === "outcome_unknown")
        return { outcome: "rejected", reason: "outcome_unknown", jobId: dupe.jobId };
      if (dupe && (dupe.occState === "pending" || dupe.occState === "granted"))
        return { outcome: "applied", answer: "in_progress", jobId: dupe.jobId };
    }
    const jobId = `synth:${commandId}`;
    const sub = this._submitJob({
      jobId, bookId: p.bookId || null, chapterIndex: p.chapterIndex ?? null,
      lane: "standard",
      occurrences: [{ occurrenceId: p.occurrenceId, revisionKey: p.revisionKey }],
      data: { via: "RequestSynthesis", estMicroCents: p.estMicroCents || 0 },
    }, commandId, "synthesis");
    if (sub.outcome !== "applied") return sub;
    const g = this._issueGrant(jobId, { commandId, jobEvent: "grant", cause: "RequestSynthesis" });
    if (!g.ok) return { outcome: "rejected", reason: g.reason, jobId };
    return { outcome: "applied", answer: "granted", jobId, grantId: g.grantId };
  }

  // ---- grants: the atomic budget gate (§1.1, I8) --------------------------
  // One transaction: park check -> quota estimate -> cap -> occurrence
  // transitions -> ledger reservations -> grant + outbox rows. There is no
  // interleaving in which two grants spend the same budget.
  _issueGrant(jobId, { probe = false, commandId = null, bypassPark = false,
                       jobEvent = null, cause = "grant" } = {}) {
    class Rollback extends Error { constructor(reason) { super(reason); this.reason = reason; } }
    try {
      return this._tx(() => {
      const job = this._oneOrNull(`SELECT * FROM jobs WHERE job_id = ?`, jobId);
      if (!job) return { ok: false, reason: "job_not_found" };
      const park = this._oneOrNull(
        `SELECT * FROM quota_parks WHERE released_at IS NULL ORDER BY id DESC LIMIT 1`);
      if (park && !bypassPark) return { ok: false, reason: "quota_parked" };
      const now = this._now();
      const day = dayKeyPT(now), month = monthKey(now);
      const attempts = this._attemptsOn(day);
      if (attempts >= DAILY_QUOTA_LIMIT) return { ok: false, reason: "quota_estimate_exhausted" };
      const settings = this._settings();
      const capMicro = Math.round((settings.monthlyCap ?? 50) * 100 * 10000);
      const spent = this._spendIn(month);
      const pending = this._all(
        `SELECT * FROM occurrences WHERE job_id = ? AND state = 'pending' ORDER BY occurrence_id`, jobId);
      let targets = probe ? pending.slice(0, 1) : pending;
      if (targets.length === 0) return { ok: false, reason: "nothing_pending" };
      const est = JSON.parse(job.data_json || "{}").estMicroCents || 0;
      if (spent + est * targets.length > capMicro) return { ok: false, reason: "spending_cap" };
      // D6 patch 2 (WS-1; CONTRACTS.md "Coordinator patches"): only
      // when the D6 entry sets env.d6StandardOnly — the D6 plan
      // guard (phase halt / phase budget / storage boundary) runs
      // after the monthly-cap check, inside the same transaction.
      // Flag absent => byte-equivalent behavior.
      if (this.env.d6StandardOnly) {
        const d6 = d6GrantGuard(this, job);
        if (!d6.ok) return { ok: false, reason: d6.reason };
      }
      // QUOTA GUARD re-review hold A (Rowan 6545597263): on
      // ARMED D6 non-probe grants, the grant-count budget below
      // is evaluated against the BOUNDED COHORT, not the full
      // pending set. The full-set check refused any job with
      // more pending occurrences than the day's remaining grant
      // count (e.g. 101 fresh occurrences against a fresh day:
      // 0 + 101 > 100) EVERY day, forever — no cohort, however
      // small and fundable, could ever start. The bound is
      // computed here (boundGrantTargets is read-only) and
      // REUSED by the reservation block below, so the count
      // check and the reservation can never disagree about the
      // cohort. Unarmed stores get `pending` back unchanged
      // from boundGrantTargets, and non-D6 callers never enter
      // this branch, so both keep the exact full-set floor
      // semantics. DAILY_QUOTA_LIMIT itself is not weakened:
      // the day's granted-occurrence ledger count still can
      // never exceed it (attempts + cohort <= limit), and the
      // monthly-cap check above keeps full-set semantics.
      let quotaBound = null;
      let countTargets = targets;
      if (this.env.d6StandardOnly && !probe) {
        const link = d6PlanForJob(this, jobId);
        quotaBound = boundGrantTargets(this, {
          planId: link ? link.plan.plan_id : null, pending, dayKey: day });
        countTargets = quotaBound.targets;
      }
      if (attempts + countTargets.length > DAILY_QUOTA_LIMIT)
        return { ok: false, reason: "quota_estimate_exhausted" };
      const grantId = `grant:${jobId}:${job.revision}:${probe ? "probe" : "full"}`;
      const dupe = this._oneOrNull(`SELECT grant_id FROM grants WHERE grant_id = ?`, grantId);
      if (dupe) return { ok: false, reason: "grant_exists" };
      // QUOTA GUARD (QUOTA-ADDENDUM §1.3): grant-time provider-
      // attempt reservations, inside this same transaction, after
      // the duplicate check and before any grant write — a refusal
      // (provider_attempt_budget / provider_attempt_budget_
      // bootstrap_incomplete) therefore leaves no grant row, no
      // ledger row, no outbox row, and no partial reservation.
      // Only under the D6 flag, and inside reserveForGrant only
      // when the quota bootstrap has armed the store: with the
      // flag off, or before arming, this is not called / returns
      // unarmed and grant behavior is byte-for-byte the floor's.
      // The plan identity resolves from the persisted plan link,
      // exactly as the grant guard resolves it.
      if (this.env.d6StandardOnly) {
        const link = d6PlanForJob(this, jobId);
        const planId = link ? link.plan.plan_id : null;
        // QUOTA GUARD correction 1 (Rowan SOURCE HOLD
        // 6545387295): a full grant is bounded to the day's
        // reservation cohort BEFORE reserving — the longest
        // prefix of `pending` whose worst-case slots fit the
        // day's derived headroom (see boundGrantTargets). The
        // remainder stays pending on this same job and is
        // granted by a later grant once this one settles; an
        // empty cohort refuses with the quota reasons, parking
        // the plan on quota exactly as a full-set refusal did.
        // Probe grants are already exactly one occurrence.
        // Unarmed stores get `pending` back unchanged. The
        // monthly-cap check above keeps its existing full-set
        // semantics. The bound itself was computed once, above
        // the grant-count check (re-review hold A, 6545597263:
        // that check is evaluated against this same cohort on
        // armed D6 non-probe grants), and is reused here — the
        // count check and the reservation cannot disagree.
        if (!probe) {
          const bound = quotaBound;
          if (bound.targets.length === 0)
            return { ok: false, reason: bound.reason || "provider_attempt_budget" };
          targets = bound.targets;
        }
        const qr = reserveForGrant(this, {
          grantId, jobId, planId, targets, dayKey: day,
        });
        if (!qr.ok) return { ok: false, reason: qr.reason };
      }
      this.sql.exec(
        `INSERT INTO grants (grant_id, job_id, revision, state, created_at, lease_expires_at)
         VALUES (?, ?, ?, 'issued', ?, ?)`, grantId, jobId, job.revision, now, now + LEASE_MS);
      for (const o of targets) {
        const r = this.applyOccEvent(jobId, o.occurrence_id, "grant", "grant", { grantId });
        if (!r.ok) throw new Error(`grant transition failed: ${r.reason}`);
        this.sql.exec(
          `INSERT INTO ledger_ops (op_key, at, day_key, month_key, kind, est_micro_cents, detail_json)
           VALUES (?, ?, ?, ?, 'attempt', ?, ?)`,
          `op:${grantId}:${o.occurrence_id}`, now, day, month, est,
          JSON.stringify({ jobId, occurrenceId: o.occurrence_id }));
      }
      this.sql.exec(
        `INSERT INTO outbox (id, kind, payload_json, created_at) VALUES (?, 'dispatch', ?, ?)`,
        grantId, JSON.stringify({ grantId, jobId,
          occurrences: targets.map(o => o.occurrence_id) }), now);
      this._schedule(now + LEASE_MS, "lease", grantId, {});
      if (jobEvent) {
        // The job's own transition commits in the SAME transaction as the
        // grant (§1.1: check -> apply transition -> issue grant, atomically).
        // An illegal transition rolls the whole grant back.
        const jr = this.applyJobEvent(jobId, jobEvent, cause, { grantId });
        if (!jr.ok) throw new Rollback(jr.reason);
        // Delivery-fence baseline (round 4): the grant is valid for the
        // job AS ISSUED, including this grant's own transition. Record
        // the post-transition revision on the grant; any LATER job event
        // (pause, cancel, supersede, a newer operation) advances the
        // job's revision past it and fences the dispatch at drain time.
        const after = this._one(`SELECT revision FROM jobs WHERE job_id = ?`, jobId);
        this.sql.exec(`UPDATE grants SET revision = ? WHERE grant_id = ?`,
          after.revision, grantId);
      }
      return { ok: true, grantId, count: targets.length };
      });
    } catch (e) {
      if (e instanceof Rollback) return { ok: false, reason: e.reason };
      throw e;
    }
  }

  // After a SAFE void (the dispatch provably never left and its
  // occurrences returned to pending), a generating job must advance
  // again WITHOUT a device (round 5, Rowan qualification B): enqueue
  // one bounded retry_grant. Park/cap/quota are re-checked by the
  // grant gate itself when the retry fires; a refusal ends the chain
  // (the park/resume machinery owns what happens next), so this can
  // never spin. The retry row is scheduled even while frozen — the
  // retry_grant handler itself defers under a freeze — so exactly one
  // durable deferred retry survives any freeze/thaw (round 6, race 2)
  // instead of being silently dropped here. Paused/cancelled jobs get
  // nothing: resume owns their continuation.
  _scheduleReAdvance(jobId) {
    if (!jobId) return;
    const job = this._oneOrNull(`SELECT * FROM jobs WHERE job_id = ?`, jobId);
    if (!job || job.state !== "generating") return;
    const existing = this._one(
      `SELECT COUNT(*) AS n FROM schedule WHERE kind = 'retry_grant' AND ref = ? AND state = 'pending'`,
      jobId);
    if (existing && existing.n > 0) return;
    this._schedule(this._now() + 30000, "retry_grant", jobId, { cause: "void_re_advance" });
  }

  // Executor entry point (called by the command API / plan advancer).
  async requestGrant(jobId, opts = {}) {
    await this.wake();
    const g = this._issueGrant(jobId, { jobEvent: "grant",
      cause: opts.cause || "requestGrant", probe: !!opts.probe });
    await this._armAlarmIfEarlier(); // the new lease may be the earliest work
    return g;
  }

  // Deliver unsent grants (interruption seam ii: a grant committed but
  // never sent is delivered on the next wake, keyed by grant_id so the
  // send is idempotent). Delivery is ACKNOWLEDGED (P2 review finding 2):
  // the send function is awaited, and a row is marked sent only after it
  // resolves. A missing handler delivers nothing and marks nothing.
  // Round 5 sharpens the failure side: intent is recorded BEFORE
  // invocation, so a throw, rejection, or crash after invocation leaves
  // the row ATTEMPTED-UNCERTAIN — never re-invoked by a drain, never
  // voided as unsent; handoff reconciliation owns it from there.
  async drainOutbox(send) {
    if (typeof send !== "function") return 0;
    const rows = this._all(`SELECT * FROM outbox WHERE sent_at IS NULL ORDER BY created_at`);
    let sent = 0;
    for (const row of rows) {
      const payload = JSON.parse(row.payload_json);
      // Stop means STOP (P2 review round 2, gap 2): a dispatch queued
      // before a pause/cancel/park/freeze must not produce provider work.
      // Frozen: everything waits, nothing is voided. Paused/cancelled/
      // parked/superseded job: the dispatch is VOIDED — it provably never
      // left (this row is unsent), so its occurrences return to pending
      // and a later resume grants them fresh. Work already delivered is
      // in flight and settles by report; this gate governs only what has
      // not been sent yet.
      if (this._frozen()) continue;
      const job = payload.jobId
        ? this._oneOrNull(`SELECT * FROM jobs WHERE job_id = ?`, payload.jobId) : null;
      const grant = payload.grantId
        ? this._oneOrNull(`SELECT * FROM grants WHERE grant_id = ?`, payload.grantId) : null;
      // Rows belonging to settled grants are debris (round 4): cleared
      // without touching accounting — their spend settled by report.
      if (payload.grantId && (!grant || grant.state === "reported" || grant.state === "voided")) {
        this.sql.exec(`DELETE FROM outbox WHERE id = ?`, row.id);
        this._logTransition("grant", payload.grantId, "dispatch_debris_cleared",
          grant ? grant.state : null, grant ? grant.state : null, null,
          { jobId: payload.jobId });
        continue;
      }
      // Handoff state machine (round 5, Rowan qualification A): a row is
      // NEVER INVOKED (send_attempted_at null — provably unsent), ACKED
      // (sent_at set), or ATTEMPTED-UNCERTAIN (invoked, no ACK recorded:
      // the queue may or may not hold the message). Attempted rows are
      // owned by handoff reconciliation — a drain NEVER re-invokes one,
      // because a blind retry is exactly the duplicate-spend risk.
      if (row.send_attempted_at) continue;
      if (job && ["paused_user", "paused_quota", "cancelled", "superseded"].includes(job.state)) {
        this._tx(() => this._voidDispatch(payload, job.state));
        continue;
      }
      // Delivery fence (round 4, Rowan blocker 1): a dispatch may leave
      // ONLY while its grant is live — state 'issued', issued against the
      // job's CURRENT revision, and inside its delivery window. Anything
      // else is provably unsent work and must never be handed to the
      // provider late: expired/revision-stale grants are voided with
      // their reservations released (the work re-grants fresh).
      if (payload.grantId) {
        if (job && grant.revision !== job.revision) {
          this._tx(() => this._voidDispatch(payload, "revision_stale"));
          continue;
        }
        if (this._now() > grant.lease_expires_at) {
          this._tx(() => this._voidDispatch(payload, "delivery_window_expired"));
          this._scheduleReAdvance(payload.jobId);
          continue;
        }
      }
      // Durable intent BEFORE invocation (round 5): from this write on,
      // the handoff is ATTEMPTED. If the process dies, the ACK is lost,
      // or send rejects, the row can never again be mistaken for
      // never-invoked — it reconciles as uncertain instead of voiding.
      this.sql.exec(`UPDATE outbox SET send_attempted_at = ? WHERE id = ? AND send_attempted_at IS NULL`,
        this._now(), row.id);
      try {
        await send(payload);
      } catch {
        continue; // ACK uncertain: reconciliation owns this row now
      }
      // The ACK arrived. Settle against the grant's CURRENT state: a
      // grant voided or reported while the send was in flight is never
      // reactivated by a late continuation (round 5) — the stray message
      // is governed by the executor's dedupe-by-grantId contract, and
      // the event is logged visibly rather than silently re-arming.
      const settled = payload.grantId
        ? this._oneOrNull(`SELECT * FROM grants WHERE grant_id = ?`, payload.grantId) : null;
      if (payload.grantId && settled &&
          settled.state !== "issued" && settled.state !== "handoff_uncertain") {
        this._logTransition("grant", payload.grantId, "handoff_acked_after_settle",
          settled.state, settled.state, null, { jobId: payload.jobId });
        this.sql.exec(`DELETE FROM outbox WHERE id = ?`, row.id);
        continue;
      }
      this.sql.exec(`UPDATE outbox SET sent_at = ? WHERE id = ?`, this._now(), row.id);
      if (payload.grantId) {
        if (settled && settled.state === "handoff_uncertain") {
          this.sql.exec(`UPDATE grants SET state = 'issued' WHERE grant_id = ?`, payload.grantId);
          this._logTransition("grant", payload.grantId, "handoff_resolved",
            "handoff_uncertain", "issued", null, { via: "late_ack" });
        }
        // The execution lease runs from ACKNOWLEDGED HANDOFF, not from
        // grant creation (round 4): time spent waiting for delivery —
        // a broken queue, a backlog — consumes none of it. Supersede
        // the creation-anchored lease row with a handoff-anchored one.
        const t = this._now();
        this.sql.exec(`UPDATE grants SET lease_expires_at = ? WHERE grant_id = ?`,
          t + LEASE_MS, payload.grantId);
        this.sql.exec(
          `UPDATE schedule SET state = 'void' WHERE kind = 'lease' AND ref = ? AND state = 'pending'`,
          payload.grantId);
        this._schedule(t + LEASE_MS, "lease", payload.grantId, { anchored: "handoff" });
      }
      sent++;
    }
    return sent;
  }

  // Net ledger accounting (round 3, fix 1): an 'attempt' row is a
  // RESERVATION made at grant time, not proof of spend. A dispatch that
  // is voided before it is ever sent never contacted the provider, so
  // its reservation is explicitly RELEASED — a compensating
  // 'attempt_release' row (negative estimate, same day/month keys) that
  // preserves the audit trail while removing the charge from every
  // quota/cap count. Attempts that were actually sent keep counting.
  _attemptsOn(day) {
    return this._one(
      `SELECT (SELECT COUNT(*) FROM ledger_ops WHERE day_key = ? AND kind = 'attempt')
            - (SELECT COUNT(*) FROM ledger_ops WHERE day_key = ? AND kind = 'attempt_release')
         AS n`, day, day).n;
  }
  _spendIn(month) {
    return this._one(
      `SELECT COALESCE(SUM(est_micro_cents), 0) AS s FROM ledger_ops
        WHERE month_key = ? AND kind IN ('attempt', 'attempt_release')`, month).s;
  }

  // `reason` records WHY the dispatch is being voided: a job state
  // (paused_user / paused_quota / cancelled / superseded) or a round-4
  // delivery-fence cause (lease_expired_undelivered /
  // delivery_window_expired / revision_stale). Every path through here
  // shares one property: the dispatch provably never left, so its
  // reservations are released and its occurrences return to pending.
  _voidDispatch(payload, reason, opts = {}) {
    const jobState = reason;
    const grantId = payload.grantId;
    // P3 review fix (Rowan): a void NEVER rewrites the acceptance
    // ledger. There is no claimed -> closed transition: a claimed
    // dispatch was accepted — possibly with spend in flight — and
    // marking it closed would make probeVerdict swear a terminal
    // "never accepted" that may be false. A NEVER-claimed grant needs
    // no row here either: claimGrant maps a voided grant to a
    // 'closed' ANSWER at claim time, which is the only way a closed
    // row is ever written for it.
    // P3 round 2 (Rowan): the void itself is fenced the same way —
    // a CLAIMED grant is not voided at all (its reservations are not
    // released and its work is not re-granted out from under a live
    // consumer), unless the caller explicitly owns that semantics:
    // the evidenced Batch never-accepted resolution, whose claim is
    // preserved and whose re-attempt is generation-fenced. The
    // handoff path never passes this flag — it resolves claimed
    // grants as accepted instead (claim fence, handoff_check).
    if (!opts.claimedOk) {
      const claim = this._oneOrNull(`SELECT * FROM claims WHERE grant_id = ?`, grantId);
      if (claim && claim.state === "claimed") {
        this._logTransition("grant", grantId, "void_refused_claimed",
          null, null, null, { reason, claimedBy: claim.consumer_id });
        return false;
      }
    }
    // RANGE-FIX (Option B): half-open PK range, not a LIKE pattern
    // (see generation/prefix-range.mjs). Consumption is per-op and
    // order-independent; the range returns the same PK index order.
    const opsPred = prefixRangeClause("op_key", `op:${grantId}:`);
    const ops = this._all(
      `SELECT * FROM ledger_ops WHERE kind = 'attempt' AND ${opsPred.clause}`,
      ...opsPred.params);
    for (const op of ops) {
      // Release this attempt's reservation exactly once: the provider
      // was never contacted for it, so it must not consume quota or cap.
      const relKey = `rel:${op.op_key}`;
      if (!this._oneOrNull(`SELECT op_key FROM ledger_ops WHERE op_key = ?`, relKey)) {
        const d = JSON.parse(op.detail_json || "{}");
        this.sql.exec(
          `INSERT INTO ledger_ops (op_key, at, day_key, month_key, kind, est_micro_cents, detail_json)
           VALUES (?, ?, ?, ?, 'attempt_release', ?, ?)`,
          relKey, this._now(), op.day_key, op.month_key, -op.est_micro_cents,
          JSON.stringify({ jobId: payload.jobId, occurrenceId: d.occurrenceId || null,
                           grantId, released: "dispatch_voided", jobState,
                           voidReason: reason }));
      }
      const oid = JSON.parse(op.detail_json || "{}").occurrenceId;
      if (!oid) continue;
      const o = this._oneOrNull(
        `SELECT * FROM occurrences WHERE job_id = ? AND occurrence_id = ?`, payload.jobId, oid);
      if (o && o.state === "granted")
        this.applyOccEvent(payload.jobId, oid, "defer", "dispatch_voided",
          { grantId, jobState });
    }
    this.sql.exec(`UPDATE grants SET state = 'voided' WHERE grant_id = ?`, grantId);
    // QUOTA GUARD (QUOTA-ADDENDUM §1.5 / T7): a voided dispatch
    // provably never left, so the grant's provider-attempt
    // reservations close here ('grant_voided'), through the same
    // single release fence as every other closure — exactly once,
    // and never for a grant whose executions can still dispatch.
    // Unarmed: no-op.
    closeReservationsForVoidedGrant(this, grantId);
    this.sql.exec(
      `UPDATE schedule SET state = 'void' WHERE kind = 'lease' AND ref = ? AND state = 'pending'`,
      grantId);
    this.sql.exec(`DELETE FROM outbox WHERE id = ?`, grantId);
    this._logTransition("grant", grantId, "dispatch_voided", "issued", "voided", null,
      { jobId: payload.jobId, jobState, voidReason: reason });
  }

  // Dispatch-time annotation: the executor records the provider request
  // identity into the ledger the moment it dispatches. A request ID is
  // evidence the request was ATTEMPTED — it is NOT proof the provider
  // completed or charged it (round 3, fix 3), so on its own it never
  // justifies calling the occurrence spent.
  noteProviderRequest(grantId, occurrenceId, providerRequestId) {
    const opKey = `op:${grantId}:${occurrenceId}`;
    const row = this._oneOrNull(`SELECT * FROM ledger_ops WHERE op_key = ?`, opKey);
    if (!row) return { ok: false, reason: "op_not_found" };
    const detail = { ...(JSON.parse(row.detail_json || "{}")), providerRequestId };
    this.sql.exec(`UPDATE ledger_ops SET detail_json = ? WHERE op_key = ?`,
      JSON.stringify(detail), opKey);
    return { ok: true };
  }

  // Provider-OUTCOME annotation: the executor records a CONFIRMED
  // terminal provider outcome (with its evidence) when the provider's
  // own record settles what happened to a dispatched request — e.g. a
  // request-status lookup showing the request failed or completed
  // without producing audio. Only a confirmed outcome recorded here can
  // support reconciliation's spent-without-audio exit.
  noteProviderOutcome(grantId, occurrenceId, outcome, evidence = null) {
    if (!["failed", "spent_without_audio"].includes(outcome))
      return { ok: false, reason: "unknown_provider_outcome" };
    const opKey = `op:${grantId}:${occurrenceId}`;
    const row = this._oneOrNull(`SELECT * FROM ledger_ops WHERE op_key = ?`, opKey);
    if (!row) return { ok: false, reason: "op_not_found" };
    const detail = { ...(JSON.parse(row.detail_json || "{}")),
                     providerOutcome: outcome, providerEvidence: evidence };
    this.sql.exec(`UPDATE ledger_ops SET detail_json = ? WHERE op_key = ?`,
      JSON.stringify(detail), opKey);
    return { ok: true };
  }

  // ---- executor reports ----------------------------------------------------
  // Applied transactionally against the grant. A report citing a stale
  // job revision is rejected for state purposes; its audio is still
  // adoptable through bindings (content-addressed audio is never wasted).
  async handleReport(report) {
    if (!report || !report.grantId) return { ok: false, reason: "grant_required" };
    await this.wake();
    const result = this._tx(() => {
      const grant = this._oneOrNull(`SELECT * FROM grants WHERE grant_id = ?`, report.grantId);
      if (!grant) return { ok: false, reason: "grant_not_found" };
      if (grant.state === "reported")
        return { ok: true, replayed: true };
      if (grant.state === "handoff_uncertain") {
        // A report IS handoff proof (round 5): the executor could only
        // report on a dispatch it received. Resolve the uncertainty
        // before applying results; the grant closes as reported below.
        this.sql.exec(`UPDATE outbox SET sent_at = ? WHERE id = ? AND sent_at IS NULL`,
          this._now(), grant.grant_id);
        this._logTransition("grant", grant.grant_id, "handoff_resolved",
          "handoff_uncertain", "issued", null, { via: "executor_report" });
      }
      const job = this._oneOrNull(`SELECT * FROM jobs WHERE job_id = ?`, grant.job_id);
      if (!job) return { ok: false, reason: "job_not_found" };
      if (report.jobRevision !== undefined && report.jobRevision !== job.revision) {
        this._logTransition("job", job.job_id, "report", job.state, job.state, job.revision,
          { rejected: "report", reason: "stale_revision", grantId: grant.grant_id });
        return { ok: false, reason: "stale_revision" };
      }
      let blocked = 0, failed = 0, ready = 0;
      for (const res of report.results || []) {
        if (res.outcome === "success") {
          const v = this.validateAndBind({
            occurrenceId: res.occurrenceId, revisionKey: res.revisionKey,
            cacheKey: res.cacheKey, provenance: "grant:" + grant.grant_id,
