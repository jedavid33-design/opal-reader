// D6 WS-1 — the grant guard (CONTRACTS.md "Coordinator patches" #2
// + "generation/grant-guards.mjs"). Called from
// GenerationCoordinator._issueGrant when — and only when —
// env.d6StandardOnly is on, after the existing monthly-cap check.
//
// Fail-closed discipline: a job linked to a D6 plan (d6_plan_jobs →
// d6_plans) is refused, in order, when
//   1. its phase is halted for unknown billing
//      ("phase_halted_unknown_billing"),
//   2. settled known cost + in-flight upper bounds + the upper
//      bounds of this grant's target pending occurrences would
//      exceed the phase budget ("phase_budget"), or
//   3. the storage projection (base + committed/flushed D6 bytes +
//      the plan's remaining eligible characters at the pinned rate
//      with the retries/orphans allowance) reaches the 10 GB R2
//      free-tier boundary ("storage_boundary").
// Jobs without a plan are not plan-guarded ({ ok: true }) — with
// the D7-2/D8 exceptions (below): under the production entry's
// halt fence (env.d6HaltFence), a plan-less job attempting a
// grant while GENERATION_HALT !== "0" is refused AND durably
// quarantined (D7-2), and a plan-less job born inside a recorded
// halt epoch is marked + refused on its first guarded attempt
// whenever it happens (D8-2) — so work staged by a legacy
// command while halted can never become grantable through a
// later generic re-arm, even when its halt-era attempts were
// refused before ever reaching this guard.
// If the flag is on but the d6 tables are missing, the lookups
// THROW — loud, never a silent pass (the D6 service ensures the
// schema at construction).
import { createGenStore } from "./genstore.mjs";
import {
  PHASE_BUDGET_MICRO_CENTS, BYTES_PER_CHAR,
  RETRIES_ORPHANS_ALLOWANCE, R2_FREE_TIER_BYTES,
} from "./gen-constants.mjs";
import {
  ensureQuarantineSchema, heldQuarantineStrict, quarantineHoldRow,
  recordQuarantineHold, noteHaltObservation, haltEpochSuspect,
} from "./quarantine.mjs";

export function d6PlanForJob(coord, jobId) {
  const link = coord._oneOrNull(
    `SELECT * FROM d6_plan_jobs WHERE job_id = ?`, jobId);
  if (!link) return null;
  const plan = coord._oneOrNull(
    `SELECT * FROM d6_plans WHERE plan_id = ?`, link.plan_id);
  return plan ? { link, plan } : null;
}

export function d6PhaseHalt(coord, phase) {
  if (!phase) return null;
  const row = coord._oneOrNull(
    `SELECT * FROM d6_phase_state WHERE phase = ?`, phase);
  return row && row.halted_unknown_billing ? row : null;
}

// The fail-closed storage projection for one plan (proposal §12 /
// PINS.md §3): current base usage + D6's own durable bytes + the
// plan's remaining eligible characters (eligible entries not yet
// bound) at 3,012.6 bytes/char with the ×1.10 retries/orphans
// allowance. Refuses at >= 10,000,000,000 bytes.
export function d6StorageProjection(coord, planId) {
  const store = createGenStore(coord);
  const { baseBytes, d6Bytes } = store.storageAccounting();
  const row = coord._one(
    `SELECT COALESCE(SUM(e.char_count), 0) AS chars FROM d6_plan_entries e
      WHERE e.plan_id = ? AND e.disposition = 'eligible'
        AND NOT EXISTS (SELECT 1 FROM bindings b
                         WHERE b.occurrence_id = e.occurrence_id)`, planId);
  const remainingChars = row.chars;
  const projection = baseBytes + d6Bytes +
    remainingChars * BYTES_PER_CHAR * RETRIES_ORPHANS_ALLOWANCE;
  return {
    baseBytes, d6Bytes, remainingChars, projection,
    refuses: projection >= R2_FREE_TIER_BYTES,
  };
}

export function d6GrantGuard(coord, job) {
  const jobId = job && (job.job_id ?? job.jobId);
  if (!jobId) return { ok: true };
  const found = d6PlanForJob(coord, jobId);

  // D7-2 QUARANTINE (Rowan ruling 6524426826; Julie's approval
  // 6524562842): the birth-mark fence. Evaluated FIRST — before
  // the phase/budget/storage checks — because a held subject is
  // an ABSOLUTE grant/ledger/outbox fence: no grant issues for it
  // under any phase, budget, or halt state, and NO generic act
  // clears the hold (re-arm, phase binding, settings change, plan
  // retry, a client field, another subject's release). The only
  // clearance is the operator-only per-subject release
  // (service.releaseQuarantine). The quarantine table is lazily
  // ensured HERE, after d6PlanForJob — so the fail-loud contract
  // above is untouched (a store missing the core d6 tables still
  // throws from the plan lookup before this DDL can mask it).
  //
  // D8-1 (Rowan review 6525035570): the hold reads here are
  // STRICT (heldQuarantineStrict). The D7-2 build read them
  // through a catch-all helper, so an arbitrary SELECT failure
  // masqueraded as "no hold" and the guard could continue to a
  // grant. Now the schema is ensured and any read error THROWS
  // inside _issueGrant's transaction — the grant, ledger
  // reservation, and outbox rows roll back with it. An error is
  // never "no hold" at a spending fence.
  //
  // D8-2 (same review): every guarded grant attempt also notes
  // the halt observation for the epoch ledger (quarantine.mjs) —
  // inside this same transaction, so the ledger commits or rolls
  // back with the grant decision it informs.
  ensureQuarantineSchema(coord.sql);
  noteHaltObservation(coord, coord.env);
  if (found && heldQuarantineStrict(coord, "plan", found.plan.plan_id))
    return { ok: false, reason: "plan_quarantined" };
  if (heldQuarantineStrict(coord, "job", jobId))
    return { ok: false, reason: "job_quarantined" };

  if (!found) {
    // Rowan's named hole: a plan-less job is otherwise unguarded,
    // so a legacy grant-producing command (RequestSynthesis, a
    // RequestResume probe, a repair-chain follow-up) from an old
    // client could stage spendable work while halted and have it
    // granted by a later generic re-arm. Under the production
    // entry's halt fence (env.d6HaltFence — set ONLY by
    // worker-entry-prod-d6.js's d6HostEnv; direct constructions
    // keep the exact pre-D7-2 unguarded behavior), a grant
    // attempt for a plan-less job while GENERATION_HALT !== "0"
    // (missing/malformed counts as halted) is REFUSED, and the
    // job is durably marked in the same transaction — the mark,
    // not the halt flag, is what keeps it fenced after re-arm.
    // This guard runs inside _issueGrant's transaction, so the
    // refusal and the mark commit atomically.
    if (coord.env.d6HaltFence === true &&
        coord.env.GENERATION_HALT !== "0") {
      recordQuarantineHold(coord, {
        subjectKind: "job", subjectId: jobId,
        reason: "grant_attempt_while_halted", source: "grant_guard",
      });
      return { ok: false, reason: "generation_halted" };
    }
    // D8-2 EPOCH FENCE (Rowan review 6525035570, blocker D8-2):
    // the halt-branch mark above fires only when a grant attempt
    // REACHES this guard while halted — but _issueGrant checks
    // the quota park, the daily quota, and the monthly cap BEFORE
    // this guard, so a halt-era attempt can be refused early and
    // leave the job unmarked; and an attempt that only ever
    // happens after a generic re-arm never sees the halt branch
    // at all. The halt-EPOCH ledger (quarantine.mjs) closes that
    // hole durably: a plan-less job still in its pre-grant
    // 'queued' state whose birth falls inside a recorded halt
    // epoch is marked NOW — atomically, in this transaction,
    // whenever the first guarded attempt happens — and refused
    // as quarantined. Entry admission (worker-entry-prod-d6.js)
    // refuses the client-reachable staging commands while halted
    // outright; this fence is for the rows that exist in the
    // store despite that (staged under the pre-D8 entry, or
    // written by an operator-plane path). Jobs born before the
    // epoch are never suspect; jobs in any post-grant state are
    // outside this fence (the state-independent hold fence above
    // governs held subjects). One epoch-suspect job is fenced
    // until the operator releases THAT job — never by a generic
    // re-arm. The fence adjudicates a subject's birth ONCE: a job
    // that already HAS a hold row is not re-adjudicated — a held
    // row already refused it above, and a RELEASED row is the
    // operator's completed clearance, which the epoch must never
    // silently re-impose.
    if (coord.env.d6HaltFence === true &&
        coord.env.GENERATION_HALT === "0" &&
        job && job.state === "queued" &&
        !quarantineHoldRow(coord, "job", jobId) &&
        haltEpochSuspect(coord, job.created_at)) {
      recordQuarantineHold(coord, {
        subjectKind: "job", subjectId: jobId,
        reason: "born_while_halted", source: "halt_epoch",
      });
      return { ok: false, reason: "job_quarantined" };
    }
    return { ok: true };
  }
  const { plan } = found;

  if (plan.phase) {
    if (d6PhaseHalt(coord, plan.phase))
      return { ok: false, reason: "phase_halted_unknown_billing" };
    const budget = PHASE_BUDGET_MICRO_CENTS[plan.phase];
    if (budget !== undefined) {
      const store = createGenStore(coord);
      const acct = store.phaseAccounting(plan.phase);
      // The grant's target pending occurrences: this job's eligible
      // plan entries whose occurrences are still pending.
      const pending = coord._one(
        `SELECT COALESCE(SUM(e.upper_micro_cents), 0) AS s
           FROM d6_plan_entries e
           JOIN occurrences o
             ON o.job_id = e.job_id AND o.occurrence_id = e.occurrence_id
          WHERE e.plan_id = ? AND e.job_id = ? AND e.disposition = 'eligible'
            AND o.state = 'pending'`, plan.plan_id, jobId);
      const projected = acct.settledMicro + acct.inFlightUpperMicro + pending.s;
      if (projected > budget) return { ok: false, reason: "phase_budget" };
    }
  }

  const proj = d6StorageProjection(coord, plan.plan_id);
  if (proj.refuses) return { ok: false, reason: "storage_boundary" };
  return { ok: true };
}
