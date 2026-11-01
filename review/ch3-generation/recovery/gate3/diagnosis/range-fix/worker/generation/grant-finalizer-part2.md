          reason_detail: "slots_consumed_mismatch" });
    attemptsTotal += attemptRows.length;
    dispatchTotal += dispatchRows.length;
    slotsTotalAll += res.slots_total;
    slotsConsumedAll += res.slots_consumed;
    residualTotal += res.slots_total - res.slots_consumed;
    targets.push({
      occurrenceId: id,
      position: entry.position,
      occurrenceState: occById.get(id).state,
      cacheKey: ex.cache_key,
      executionId: ex.execution_id,
      executionState: ex.state,
      attempts: { total: attemptRows.length, success, policyBlock },
      reservation: {
        reservationId: res.reservation_id, dayKey: res.day_key,
        slotsTotal: res.slots_total, slotsConsumed: res.slots_consumed,
        state: res.state, closeReason: res.close_reason ?? null,
      },
    });
  }
  if (reservationsAll.length !== targetIds.length)
    return refuse("grant_finalization_reservation_mismatch", { grantId });
  if (!targets.every(t => t.reservation.slotsTotal === targets[0].reservation.slotsTotal))
    return refuse("grant_finalization_reservation_mismatch",
      { grantId, reason_detail: "slots_total_not_uniform" });

  // §4.3.20 — derived day totals for the reservation day.
  const dayTotals = derivedDayTotals(coord, reservationDay);

  // §4.3.14 + §4.3.21 — phase proof: no unknown billing anywhere
  // in the phase, the phase is not halted on unknown billing,
  // and no spend intent was ever acquired for a pending
  // occurrence under this job.
  const phaseView = phaseAccountingView(coord, plan.phase);
  if (phaseView.unknownOpen !== 0)
    return refuse("grant_finalization_unknown_open",
      { grantId, unknownOpen: phaseView.unknownOpen });
  const phaseHalt = coord._oneOrNull(
    `SELECT halted_unknown_billing FROM d6_phase_state WHERE phase = ?`, plan.phase);
  if (phaseHalt && phaseHalt.halted_unknown_billing)
    return refuse("grant_finalization_phase_halted", { grantId, phase: plan.phase });
  const pendingIntents = coord._all(
    `SELECT job_id FROM spend_intents WHERE job_id = ? AND occurrence_id IN
       (${pendingIds.map(() => "?").join(",")})`, effJobId, ...pendingIds);
  if (pendingIntents.length > 0)
    return refuse("grant_finalization_pending_spend_intent", { grantId });

  // §4.3.22 — sync watermarks.
  const wmRows = coord._all(
    `SELECT family, tip FROM sync_family_state WHERE family IN ('bindings', 'content')`);
  const watermarks = { bindings: null, content: null };
  for (const r of wmRows) watermarks[r.family] = r.tip;

  // §4.3.23 — each target's binding matches its committed
  // execution's cache key (read-only consistency; never
  // rebinds). The match is on cache_key alone: D6 commits bind
  // under the payload fingerprint as revision key (the
  // d6-integration identity rule), NOT under the job row's
  // request revision_key, so keying this lookup by the
  // occurrence's revision_key would refuse every genuine commit.
  for (const t of targets) {
    const binding = coord._oneOrNull(
      `SELECT * FROM bindings WHERE occurrence_id = ? AND cache_key = ?`,
      t.occurrenceId, t.cacheKey);
    if (!binding || occById.get(t.occurrenceId).cache_key !== t.cacheKey)
      return refuse("grant_finalization_binding_mismatch",
        { grantId, occurrenceId: t.occurrenceId });
    t.bindingCacheKey = t.cacheKey;
  }

  const view = {
    grantId, planId: effPlanId, jobId: effJobId,
    bookId: job.book_id, chapterIndex: job.chapter_index,
    lane: job.lane, phase: plan.phase,
    grant: { grantId, jobId: effJobId, revision: grant.revision, state: grant.state },
    job: { jobId: effJobId, state: job.state, revision: job.revision, kind: job.kind },
    plan: {
      planId: effPlanId, state: plan.state, scope: plan.scope,
      eligibleDigest: plan.eligible_digest ?? null, totals,
    },
    claim: { state: claim.state, consumerId: claim.consumer_id ?? null },
    outbox: { present: true, acked: true, targetIds: [...outboxIds].sort() },
    targets,
    pendingIds,
    partition: { ready: targetIds.length, pending: pendingIds.length },
    attemptsTotal,
    dispatchTotal,
    reservations: {
      count: reservationsAll.length, dayKey: reservationDay,
      slotsTotal: slotsTotalAll, slotsConsumed: slotsConsumedAll,
      residual: residualTotal,
    },
    dayTotals,
    phaseAccounting: phaseView,
    watermarks,
    parkRelease,
    exemptionForFinalOccurrence: false,
    finalOccurrenceId,
  };
  return { classification: "finalizable", view, digest: grantFinalizationDigest(view) };
}

// ------------------------------------------------------------------
// GET /v2/d6-grant-finalization-preview — read-only. Derives the
// full precondition state and its digest; writes NOTHING (it does
// not even ensure the audit schema — an absent audit table reads
// as "no audit row").
export function previewGrantFinalization(coord, store, { grantId, planId = null, jobId = null } = {}) {
  if (!isNonblankString(grantId))
    return rejected("grant_finalization_grant_required");
  const d = deriveGrantFinalizationState(coord, store, { grantId, planId, jobId });
  if (d.classification === "refused") return rejected(d.reason, { grantId });
  return {
    outcome: "preview",
    classification: d.classification,
    grantId,
    ...(d.digest ? { preconditionDigest: d.digest } : {}),
    state: d.view,
  };
}

// ------------------------------------------------------------------
// POST /v2/d6-finalize-grant — the action. Closed body (the entry
// enforces the allowlist): { grantId, planId, jobId,
// authorizationRef, expectedPreconditionDigest }. The digest is
// ONLY a concurrency check — every fact is re-derived inside the
// transaction; a state that moved since the preview refuses with
// grant_finalization_digest_mismatch and zero writes.
export function finalizeGrant(coord, store, {
  grantId, planId = null, jobId = null, authorizationRef,
  expectedPreconditionDigest,
} = {}) {
  if (!isNonblankString(grantId))
    return rejected("grant_finalization_grant_required");
  if (!isNonblankString(authorizationRef))
    return rejected("grant_finalization_authorization_ref_required");
  if (!isNonblankString(expectedPreconditionDigest))
    return rejected("grant_finalization_digest_required");
  ensureGrantFinalizationSchema(coord.sql);
  let result = null;
  try {
    coord._tx(() => {
      const d = deriveGrantFinalizationState(coord, store, { grantId, planId, jobId });
      if (d.classification === "already_finalized") {
        result = { outcome: "already_finalized", grantId, state: d.view };
        return;
      }
      if (d.classification === "already_reported_not_finalizer") {
        result = { outcome: "already_reported_not_finalizer", grantId, state: d.view };
        return;
      }
      if (d.classification === "refused") {
        result = rejected(d.reason, { grantId });
        return;
      }
      if (d.digest !== expectedPreconditionDigest) {
        result = rejected("grant_finalization_digest_mismatch", { grantId });
        return;
      }
      const view = d.view;
      const beforeTotals = {
        dayKey: view.dayTotals.dayKey,
        dispatched: view.dayTotals.dispatched,
        reserved: view.dayTotals.reserved,
        consumed: view.dayTotals.consumed,
        attemptsTotal: view.attemptsTotal,
        dispatchTotal: view.dispatchTotal,
        phaseSettledMicro: view.phaseAccounting.settledMicro,
      };
      // Write 1 — the audit row. Its grant_id PRIMARY KEY makes a
      // duplicate write impossible; a conflict throws and rolls
      // the whole finalization back.
      coord.sql.exec(
        `INSERT INTO d6_grant_finalizations
           (grant_id, plan_id, job_id, book_id, chapter_index,
            authorization_ref, precondition_digest, before_totals_json,
            outcome, finalized_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'applied', ?)`,
        grantId, view.planId, view.jobId, view.bookId, view.chapterIndex,
        authorizationRef, d.digest, JSON.stringify(beforeTotals), coord._now());
      // Fail-safe re-assertion (proposal §4.4 note, branch (b)):
      // the generic closure defers still-'granted' targets; the
      // derivation proved there are none, and if that proof is
      // somehow stale the finalizer aborts rather than deferring.
      const stillGranted = coord._one(
        `SELECT COUNT(*) AS n FROM occurrences
          WHERE job_id = ? AND occurrence_id IN (${view.targets.map(() => "?").join(",")})
            AND state = 'granted'`, view.jobId,
        ...view.targets.map(t => t.occurrenceId)).n;
      if (stillGranted !== 0)
        throw new FinalizeAbort("grant_finalization_target_not_ready");
      // Write 2 — the grant closes as reported, with the labeled
      // operator-finalization record (never an executor report).
      const reportJson = JSON.stringify({
        grantId,
        results: [],
        detail: {
          finalization: "operator_grant_finalization",
          authorizationRef,
          preconditionDigest: d.digest,
        },
      });
      coord.sql.exec(
        `UPDATE grants SET state = 'reported', report_json = ? WHERE grant_id = ?`,
        reportJson, grantId);
      // Write 3 — the claim completes (handleReport's own helper;
      // verified by read-back: exactly the 'claimed' row moved).
      coord._completeClaim(grantId);
      const claimAfter = coord._oneOrNull(
        `SELECT * FROM claims WHERE grant_id = ?`, grantId);
      if (!claimAfter || claimAfter.state !== "completed")
        throw new FinalizeAbort("grant_finalization_claim_not_claimed");
      // Write 4 — the reservations settle, STRICTER than
      // handleReport: the sweep's result must be exactly the
      // expected reservation ids in `closed`, with an empty
      // blocked list; anything else aborts the transaction.
      const settle = settleReservationsForGrant(coord, grantId);
      const expectedIds = view.targets.map(t => t.reservation.reservationId).sort();
      const closedIds = [...(settle.closed || [])].sort();
      if (!settle.armed || (settle.blocked || []).length > 0
          || closedIds.length !== expectedIds.length
          || !closedIds.every((id, i) => id === expectedIds[i]))
        throw new FinalizeAbort("grant_finalization_settlement_blocked");
      // Write 5 — job completion derivation (a no-op while the
      // remainder is pending; verified, not assumed).
      const jobRevisionBefore = view.job.revision;
      coord._deriveJobCompletion(view.jobId, "operator_finalization");
      const jobAfter = coord._oneOrNull(
        `SELECT * FROM jobs WHERE job_id = ?`, view.jobId);
      if (!jobAfter || jobAfter.state !== "generating"
          || jobAfter.revision !== jobRevisionBefore)
        throw new FinalizeAbort("grant_finalization_job_state_mismatch");
      // Post-write verification, still inside the transaction:
      // the state must now classify as exactly the finalized
      // shape, with phase money and attempt/dispatch counts
      // untouched. Any divergence aborts (rolls back) — the
      // finalizer never leaves a partial finalization behind.
      const after = deriveGrantFinalizationState(coord, store,
        { grantId, planId, jobId });
      if (after.classification !== "already_finalized")
        throw new FinalizeAbort("grant_finalization_verification_failed");
      const phaseAfter = phaseAccountingView(coord, view.phase);
      if (phaseAfter.settledMicro !== view.phaseAccounting.settledMicro
          || phaseAfter.unknownOpen !== 0)
        throw new FinalizeAbort("grant_finalization_verification_failed");
      const auditAfter = getFinalizationAudit(coord, grantId);
      result = {
        outcome: "applied", alreadyFinalized: false, grantId,
        audit: grantFinalizationAuditView(auditAfter),
        before: { digest: d.digest, dayTotals: view.dayTotals,
                  reservations: view.reservations,
                  phaseAccounting: view.phaseAccounting },
        after: after.view,
      };
    });
  } catch (e) {
    if (e instanceof FinalizeAbort) return rejected(e.reason, { grantId });
    throw e;
  }
  return result;
}
